import WebSocket from "ws";

export interface CartesiaCallbacks {
  onAudioChunk: (base64Mulaw: string, contextId: string) => void;
  onError: (err: any) => void;
  onDone: (contextId: string) => void;
}

export class CartesiaLiveClient {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private voiceId: string;
  private callbacks: CartesiaCallbacks;
  private isConnected = false;
  private pendingQueue: any[] = [];

  constructor(
    apiKey: string,
    voiceId = "80ae4708-744d-459d-bd80-58964af17905", // Maritza - Reception Lead
    callbacks: CartesiaCallbacks
  ) {
    this.apiKey = apiKey.trim();
    this.voiceId = voiceId;
    this.callbacks = callbacks;
  }

  public connect(): void {
    const url = `wss://api.cartesia.ai/tts/websocket?api_key=${encodeURIComponent(
      this.apiKey
    )}&cartesia_version=2024-06-10`;

    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      this.isConnected = true;
      console.log("[Cartesia] connected for real-time TTS");
      while (this.pendingQueue.length > 0) {
        const item = this.pendingQueue.shift();
        if (item && this.ws) this.ws.send(JSON.stringify(item));
      }
    });

    this.ws.on("message", (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.data) {
          this.callbacks.onAudioChunk(msg.data, msg.context_id || "");
        }
        if (msg.done) {
          this.callbacks.onDone(msg.context_id || "");
        }
      } catch (err) {
        console.error("[Cartesia message parse error]:", err);
      }
    });

    this.ws.on("error", (err) => {
      console.error("[Cartesia error]:", err);
      this.callbacks.onError(err);
    });

    this.ws.on("close", () => {
      this.isConnected = false;
    });
  }

  public sendText(
    text: string,
    contextId: string,
    continueStream = false
  ): void {
    const payload = {
      context_id: contextId,
      model_id: "sonic-preview",
      transcript: text,
      voice: {
        mode: "id",
        id: this.voiceId,
      },
      output_format: {
        container: "raw",
        encoding: "pcm_mulaw",
        sample_rate: 8000,
      },
      continue: continueStream,
    };

    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pendingQueue.push(payload);
      return;
    }

    this.ws.send(JSON.stringify(payload));
  }

  public cancelContext(contextId: string): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      this.ws.send(JSON.stringify({ context_id: contextId, cancel: true }));
    } catch {}
  }

  public close(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnected = false;
  }
}
