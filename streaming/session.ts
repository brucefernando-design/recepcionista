import WebSocket from "ws";
import { DeepgramLiveClient } from "./deepgram";
import { CartesiaLiveClient } from "./cartesia";
import { streamGroqResponse } from "./groq-stream";
import type { Business, CallLog } from "../lib/types";
import { upsertCall, getBusiness } from "../lib/db";
import type { ChatTurn } from "../lib/agent";

export interface StreamSessionConfig {
  deepgramKey: string;
  cartesiaKey: string;
  cartesiaVoiceId?: string;
  groqKey: string;
}

export class CallStreamingSession {
  private twilioWs: WebSocket;
  private streamSid = "";
  private callSid = "";
  private businessId = "biz_clinic";
  private callerPhone = "";
  private business: Business | null = null;
  private config: StreamSessionConfig;

  private deepgram: DeepgramLiveClient | null = null;
  private cartesia: CartesiaLiveClient | null = null;

  private transcript: CallLog["transcript"] = [];
  private history: ChatTurn[] = [];
  private currentContextId = "";
  private isAiSpeaking = false;
  private abortController: AbortController | null = null;

  constructor(
    twilioWs: WebSocket,
    config: StreamSessionConfig
  ) {
    this.twilioWs = twilioWs;
    this.config = config;
  }

  public async initialize(
    streamSid: string,
    callSid: string,
    businessId: string,
    callerPhone: string
  ): Promise<void> {
    this.streamSid = streamSid;
    this.callSid = callSid;
    this.businessId = businessId || "biz_clinic";
    this.callerPhone = callerPhone || "";

    this.business = await getBusiness(this.businessId);

    // Initialize Deepgram for real-time STT
    this.deepgram = new DeepgramLiveClient(
      this.config.deepgramKey,
      "es",
      {
        onTranscript: (text, isFinal, speechFinal) => {
          if (speechFinal && text.trim().length > 1) {
            this.handleUserSpeech(text.trim());
          }
        },
        onSpeechStarted: () => {
          this.handleBargeIn();
        },
        onError: (err) => console.error("[Session Deepgram error]:", err),
        onClose: () => console.log("[Session Deepgram closed]"),
      }
    );
    this.deepgram.connect();

    // Initialize Cartesia for real-time TTS
    this.cartesia = new CartesiaLiveClient(
      this.config.cartesiaKey,
      this.config.cartesiaVoiceId || "80ae4708-744d-459d-bd80-58964af17905", // Maritza - Reception Lead
      {
        onAudioChunk: (base64Mulaw) => {
          this.sendAudioToTwilio(base64Mulaw);
        },
        onError: (err) => console.error("[Session Cartesia error]:", err),
        onDone: () => {
          this.isAiSpeaking = false;
        },
      }
    );
    this.cartesia.connect();

    // Play greeting
    setTimeout(() => {
      const greeting = `Gracias por comunicarse con ${
        this.business?.name || "Allia2"
      }. Soy AIVA, su recepcionista virtual. ¿En qué le puedo ayudar hoy?`;
      this.speakToCaller(greeting);
    }, 400);
  }

  public handleAudioFromTwilio(base64Mulaw: string): void {
    if (this.deepgram) {
      this.deepgram.sendAudioChunk(base64Mulaw);
    }
  }

  private handleBargeIn(): void {
    if (this.isAiSpeaking) {
      console.log("[Barge-in] User interrupted AI. Cutting audio immediately.");
      this.isAiSpeaking = false;

      // 1. Tell Twilio to clear its audio playback buffer immediately
      if (this.twilioWs.readyState === WebSocket.OPEN && this.streamSid) {
        this.twilioWs.send(
          JSON.stringify({
            event: "clear",
            streamSid: this.streamSid,
          })
        );
      }

      // 2. Abort Cartesia context
      if (this.cartesia && this.currentContextId) {
        this.cartesia.cancelContext(this.currentContextId);
      }

      // 3. Abort Groq token generation
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }
    }
  }

  private async handleUserSpeech(userText: string): Promise<void> {
    console.log("[Caller speech]:", userText);
    const now = new Date().toISOString();
    this.transcript.push({ role: "caller", text: userText, timestamp: now });
    this.history.push({ role: "user", content: userText });

    if (!this.business) return;

    this.currentContextId = `ctx_${Date.now()}`;
    this.isAiSpeaking = true;
    this.abortController = new AbortController();

    let fullReply = "";

    await streamGroqResponse(
      this.config.groqKey,
      this.business,
      this.history,
      userText,
      {
        onSentenceClause: (clause) => {
          console.log("[Groq clause -> Cartesia]:", clause);
          if (this.cartesia) {
            this.cartesia.sendText(clause, this.currentContextId, true);
          }
        },
        onComplete: (reply) => {
          fullReply = reply;
          const finishedNow = new Date().toISOString();
          this.transcript.push({
            role: "aiva",
            text: fullReply,
            timestamp: finishedNow,
          });
          this.history.push({ role: "assistant", content: fullReply });
        },
        onError: (err) => console.error("[Groq stream error]:", err),
      },
      this.abortController.signal
    );
  }

  public speakToCaller(text: string): void {
    this.currentContextId = `ctx_${Date.now()}`;
    this.isAiSpeaking = true;
    console.log("[speakToCaller -> Cartesia]:", text);
    if (this.cartesia) {
      this.cartesia.sendText(text, this.currentContextId, false);
    }
  }

  private sendAudioToTwilio(base64Mulaw: string): void {
    if (this.twilioWs.readyState !== WebSocket.OPEN || !this.streamSid) {
      return;
    }
    console.log(`[Audio -> Twilio]: sending ${base64Mulaw.length} bytes mulaw to ${this.streamSid}`);
    const msg = {
      event: "media",
      streamSid: this.streamSid,
      media: {
        payload: base64Mulaw,
      },
    };
    this.twilioWs.send(JSON.stringify(msg));
  }

  public async cleanup(): Promise<void> {
    console.log("[Call ended] Saving transcript to database...");
    if (this.deepgram) this.deepgram.close();
    if (this.cartesia) this.cartesia.close();

    if (this.callSid) {
      await upsertCall({
        id: this.callSid,
        businessId: this.businessId,
        callerPhone: this.callerPhone || "unknown",
        language: "es",
        channel: "phone",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        outcome: "faq_answered",
        transcript: this.transcript,
      });
    }
  }
}
