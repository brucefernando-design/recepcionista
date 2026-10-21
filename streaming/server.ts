import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import { parse } from "url";
import { CallStreamingSession, type StreamSessionConfig } from "./session";
import { query } from "../lib/postgres";
import type { TwilioInboundMessage } from "./types";

const PORT = parseInt(process.env.PORT || "8080", 10);

async function getApiKeys(): Promise<StreamSessionConfig> {
  let deepgramKey = process.env.DEEPGRAM_API_KEY || "";
  let cartesiaKey = process.env.CARTESIA_API_KEY || "";
  let groqKey = process.env.GROQ_API_KEY || "";

  // Check database settings fallback
  try {
    const res = await query(
      "SELECT key, value FROM system_settings WHERE key IN ('deepgram_api_key', 'cartesia_api_key', 'groq_api_key')"
    );
    for (const row of res.rows) {
      if (row.key === "deepgram_api_key" && !deepgramKey) deepgramKey = row.value;
      if (row.key === "cartesia_api_key" && !cartesiaKey) cartesiaKey = row.value;
      if (row.key === "groq_api_key" && !groqKey) groqKey = row.value;
    }
  } catch (err) {
    console.error("[Settings DB fetch error]:", err);
  }

  return { deepgramKey, cartesiaKey, groqKey };
}

const server = http.createServer(async (req, res) => {
  const { pathname, query: queryParams } = parse(req.url || "", true);

  if (pathname === "/health" || pathname === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "aiva-voice-streamer" }));
    return;
  }

  // Twilio inbound webhook: returns TwiML with <Connect><Stream>
  if (pathname === "/incoming" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      const params = new URLSearchParams(body);
      const host = req.headers.host || `localhost:${PORT}`;
      const wsProtocol = req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";
      const businessId = (queryParams.businessId as string) || "biz_clinic";
      const from = params.get("From") || "unknown";

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsProtocol}://${host}/media-stream">
      <Parameter name="businessId" value="${businessId}" />
      <Parameter name="callerPhone" value="${from}" />
    </Stream>
  </Connect>
</Response>`;

      res.writeHead(200, { "Content-Type": "text/xml" });
      res.end(twiml);
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const { pathname } = parse(req.url || "");
  if (pathname === "/media-stream") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", async (ws: WebSocket) => {
  console.log("[Twilio Media Stream] New connection opened");
  const keys = await getApiKeys();
  let session: CallStreamingSession | null = null;

  ws.on("message", async (data: WebSocket.RawData) => {
    try {
      const msg: TwilioInboundMessage = JSON.parse(data.toString());

      if (msg.event === "start") {
        console.log("[Twilio] Stream started:", msg.start.streamSid);
        const businessId = msg.start.customParameters?.businessId || "biz_clinic";
        const callerPhone = msg.start.customParameters?.callerPhone || "";

        session = new CallStreamingSession(ws, keys);
        await session.initialize(
          msg.start.streamSid,
          msg.start.callSid,
          businessId,
          callerPhone
        );
      } else if (msg.event === "media") {
        if (session) {
          session.handleAudioFromTwilio(msg.media.payload);
        }
      } else if (msg.event === "stop") {
        console.log("[Twilio] Stream stopped");
        if (session) {
          await session.cleanup();
          session = null;
        }
      }
    } catch (err) {
      console.error("[Twilio stream message error]:", err);
    }
  });

  ws.on("close", async () => {
    console.log("[Twilio Media Stream] Connection closed");
    if (session) {
      await session.cleanup();
      session = null;
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 AIVA Real-Time Voice Streaming Engine listening on port ${PORT}`);
});
