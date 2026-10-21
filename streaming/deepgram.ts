import WebSocket from "ws";

export interface DeepgramCallbacks {
  onTranscript: (text: string, isFinal: boolean, speechFinal: boolean) => void;
  onSpeechStarted: () => void;
  onError: (err: any) => void;
  onClose: () => void;
}

export class DeepgramLiveClient {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private language: string;
  private callbacks: DeepgramCallbacks;
  private isConnected = false;

  constructor(apiKey: string, language = "es", callbacks: DeepgramCallbacks) {
    this.apiKey = apiKey.trim();
    this.language = language;
    this.callbacks = callbacks;
  }

  public connect(): void {
    const url =
      `wss://api.deepgram.com/v1/listen?` +
      `model=nova-2&` +
      `language=${encodeURIComponent(this.language)}&` +
      `smart_format=true&` +
      `encoding=mulaw&` +
      `sample_rate=8000&` +
      `channels=1&` +
      `endpointing=300&` +
      `interim_results=true`;

    this.ws = new WebSocket(url, {
      headers: {
        Authorization: `Token ${this.apiKey}`,
      },
    });

    this.ws.on("open", () => {
      this.isConnected = true;
      console.log("[Deepgram] connected for real-time STT");
    });

    this.ws.on("message", (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());

        // Barge-in: user began speaking while audio may be playing
        if (msg.type === "SpeechStarted") {
          this.callbacks.onSpeechStarted();
          return;
        }

        if (msg.channel && msg.channel.alternatives && msg.channel.alternatives[0]) {
          const alt = msg.channel.alternatives[0];
          const transcript = (alt.transcript || "").trim();
          if (transcript) {
            const isFinal = Boolean(msg.is_final);
            const speechFinal = Boolean(msg.speech_final);
            this.callbacks.onTranscript(transcript, isFinal, speechFinal);
          }
        }
      } catch (err) {
        console.error("[Deepgram message error]:", err);
      }
    });

    this.ws.on("error", (err) => {
      console.error("[Deepgram error]:", err);
      this.callbacks.onError(err);
    });

    this.ws.on("close", () => {
      this.isConnected = false;
      this.callbacks.onClose();
    });
  }

  public sendAudioChunk(base64Mulaw: string): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const buffer = Buffer.from(base64Mulaw, "base64");
    this.ws.send(buffer);
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
