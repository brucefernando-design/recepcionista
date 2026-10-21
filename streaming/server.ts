import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import { parse } from "url";
import {
  CallStreamingSession,
  pendingCallActions,
  normalizePhoneToE164,
  type StreamSessionConfig,
} from "./session";
import { query } from "../lib/postgres";
import { getBusiness } from "../lib/db";
import type { TwilioInboundMessage } from "./types";

const PORT = parseInt(process.env.PORT || "8088", 10);

let globalKeys: StreamSessionConfig | null = null;

async function getApiKeys(): Promise<StreamSessionConfig> {
  if (globalKeys) return globalKeys;
  let deepgramKey = process.env.DEEPGRAM_API_KEY || "";
  let cartesiaKey = process.env.CARTESIA_API_KEY || "";
  let cartesiaVoiceId = process.env.CARTESIA_VOICE_ID || "";
  let groqKey = process.env.GROQ_API_KEY || "";

  // Check database settings fallback
  try {
    const res = await query(
      "SELECT key, value FROM system_settings WHERE key IN ('deepgram_api_key', 'cartesia_api_key', 'cartesia_voice_id', 'groq_api_key')"
    );
    for (const row of res.rows) {
      if (row.key === "deepgram_api_key" && !deepgramKey) deepgramKey = row.value;
      if (row.key === "cartesia_api_key" && !cartesiaKey) cartesiaKey = row.value;
      if (row.key === "cartesia_voice_id" && !cartesiaVoiceId) cartesiaVoiceId = row.value;
      if (row.key === "groq_api_key" && !groqKey) groqKey = row.value;
    }
  } catch (err) {
    console.error("[Settings DB fetch error]:", err);
  }

  globalKeys = { deepgramKey, cartesiaKey, cartesiaVoiceId, groqKey };
  return globalKeys;
}

const server = http.createServer(async (req, res) => {
  const { pathname, query: queryParams } = parse(req.url || "", true);

  if (pathname === "/health" || pathname === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "aiva-voice-streamer" }));
    return;
  }

  // Twilio inbound webhook: returns TwiML with <Connect><Stream>
  if (pathname === "/incoming") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      const params = new URLSearchParams(body);
      const host = req.headers.host || `localhost:${PORT}`;
      const isHttps = req.headers["x-forwarded-proto"] === "https";
      const wsProtocol = isHttps ? "wss" : "ws";
      const httpProtocol = isHttps ? "https" : "http";
      const businessId = (queryParams.businessId as string) || (params.get("businessId") as string) || "biz_clinic";
      const from = params.get("From") || (queryParams.From as string) || "unknown";

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsProtocol}://${host}/media-stream">
      <Parameter name="businessId" value="${businessId}" />
      <Parameter name="callerPhone" value="${from}" />
    </Stream>
  </Connect>
  <Redirect method="POST">${httpProtocol}://${host}/after-stream?businessId=${businessId}</Redirect>
</Response>`;

      res.writeHead(200, { "Content-Type": "text/xml" });
      res.end(twiml);
    });
    return;
  }

  // Post-stream TwiML handler: executes transfer (<Dial>) or hangup (<Hangup>) when WS closes
  if (pathname === "/after-stream") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      const params = new URLSearchParams(body);
      const callSid = params.get("CallSid") || (queryParams.CallSid as string) || "";
      const businessId = (queryParams.businessId as string) || (params.get("businessId") as string) || "biz_clinic";

      const action = callSid ? pendingCallActions.get(callSid) : undefined;
      if (callSid) pendingCallActions.delete(callSid);

      console.log("[/after-stream] CallSid:", callSid, "Action:", JSON.stringify(action));

      if (action?.type === "transfer") {
        let targetPhone = action.to || "";
        if (!targetPhone) {
          const biz = await getBusiness(businessId).catch(() => null);
          targetPhone = normalizePhoneToE164(
            biz?.staffPhone || (biz as any)?.transferPhone || biz?.phone || ""
          );
        }
        if (targetPhone) {
          const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="25">${targetPhone}</Dial>
  <Hangup />
</Response>`;
          res.writeHead(200, { "Content-Type": "text/xml" });
          res.end(twiml);
          return;
        }
      }

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup />
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

wss.on("connection", (ws: WebSocket) => {
  console.log("[Twilio Media Stream] New connection opened");
  let session: CallStreamingSession | null = null;
  const messageQueue: WebSocket.RawData[] = [];

  const handleMessage = async (data: WebSocket.RawData) => {
    try {
      const msg: TwilioInboundMessage = JSON.parse(data.toString());
      console.log("[Twilio WS event]:", msg.event);

      if (msg.event === "start") {
        console.log("[Twilio] Stream started:", msg.start.streamSid);
        const businessId = msg.start.customParameters?.businessId || "biz_clinic";
        const callerPhone = msg.start.customParameters?.callerPhone || "";

        const keys = globalKeys || (await getApiKeys());
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
  };

  ws.on("message", (data: WebSocket.RawData) => {
    if (!globalKeys) {
      messageQueue.push(data);
    } else {
      void handleMessage(data);
    }
  });

  if (!globalKeys) {
    getApiKeys().then((keys) => {
      globalKeys = keys;
      while (messageQueue.length > 0) {
        const item = messageQueue.shift();
        if (item) void handleMessage(item);
      }
    });
  }

  ws.on("close", async () => {
    console.log("[Twilio Media Stream] Connection closed");
    if (session) {
      await session.cleanup();
      session = null;
    }
  });
});

server.listen(PORT, async () => {
  console.log(`🚀 AIVA Real-Time Voice Streaming Engine listening on port ${PORT}`);
  // Prefetch API keys at startup
  await getApiKeys();
  console.log("✅ API keys prefetched from database");
});
