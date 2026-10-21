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

export interface PendingCallAction {
  type: "hangup" | "transfer";
  to?: string;
}

export const pendingCallActions = new Map<string, PendingCallAction>();

export function normalizePhoneToE164(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.replace(/\D/g, "");
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 12 && digits.startsWith("52")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) {
    // 867 (Nuevo Laredo), 81 (Monterrey), 55 (CDMX), 33 (GDL), etc. -> +52; US area codes like 956 -> +1
    const usAreaCodes = new Set(["956", "210", "512", "713", "281", "832", "214", "469", "972", "361", "915", "817"]);
    const area = digits.slice(0, 3);
    return usAreaCodes.has(area) ? `+1${digits}` : `+52${digits}`;
  }
  return `+${digits}`;
}

const FALLBACK_REPLY = "Disculpe, no alcancé a escucharle bien. ¿Me lo podría repetir, por favor?";

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
  private callStartedAt = new Date().toISOString();
  private callOutcome: CallLog["outcome"] = "faq_answered";
  private closingCall = false;
  private cleanedUp = false;

  // Playback tracking: Twilio buffers audio ahead of real time, so we estimate
  // when the caller will actually finish hearing what we already sent.
  private playbackEndsAt = 0;
  private turnAudioStartedAt = 0;

  // In-flight LLM generation state
  private abortController: AbortController | null = null;
  private generating = false;
  private turnGenerationStartedAt = 0;
  private inFlightUserText = "";
  private partialReply = "";
  private turnSeq = 0;

  private speechBuffer = "";
  private speechDebounceTimer: NodeJS.Timeout | null = null;

  constructor(twilioWs: WebSocket, config: StreamSessionConfig) {
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
    this.deepgram = new DeepgramLiveClient(this.config.deepgramKey, "es", {
      onTranscript: (text, isFinal, speechFinal) => {
        this.handleIncomingTranscript(text, isFinal, speechFinal);
      },
      onSpeechStarted: () => {
        this.handleBargeIn();
      },
      onError: (err) => console.error("[Session Deepgram error]:", err),
      onClose: () => console.log("[Session Deepgram closed]"),
    });
    this.deepgram.connect();

    // Initialize Cartesia for real-time TTS
    this.cartesia = new CartesiaLiveClient(
      this.config.cartesiaKey,
      this.config.cartesiaVoiceId || "80ae4708-744d-459d-bd80-58964af17905",
      {
        onAudioChunk: (base64Mulaw) => {
          this.sendAudioToTwilio(base64Mulaw);
        },
        onError: (err) => console.error("[Session Cartesia error]:", err),
        onDone: () => {},
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

  private isAudioPlaying(): boolean {
    return Date.now() < this.playbackEndsAt - 150;
  }

  private handleIncomingTranscript(text: string, isFinal: boolean, speechFinal: boolean): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (speechFinal) {
      if (this.speechDebounceTimer) {
        clearTimeout(this.speechDebounceTimer);
        this.speechDebounceTimer = null;
      }
      const fullText = (this.speechBuffer ? `${this.speechBuffer} ${trimmed}` : trimmed).trim();
      this.speechBuffer = "";
      if (fullText.length > 1) {
        void this.handleUserSpeech(fullText);
      }
      return;
    }

    if (isFinal) {
      this.speechBuffer = (this.speechBuffer ? `${this.speechBuffer} ${trimmed}` : trimmed).trim();

      // Debounce: if the caller finished a phrase and pauses, answer.
      if (this.speechDebounceTimer) clearTimeout(this.speechDebounceTimer);
      this.speechDebounceTimer = setTimeout(() => {
        this.speechDebounceTimer = null;
        const fullText = this.speechBuffer.trim();
        this.speechBuffer = "";
        if (fullText.length > 1) {
          void this.handleUserSpeech(fullText);
        }
      }, 700);
    }
  }

  private handleBargeIn(): void {
    if (this.closingCall) return;
    // Only interrupt when the caller is really hearing us. Never kill a reply
    // that is still being generated (that caused silent, unanswered turns).
    if (!this.isAudioPlaying()) return;
    if (Date.now() - this.turnAudioStartedAt < 400) return;

    console.log("[Barge-in] User interrupted AI. Cutting audio immediately.");
    this.playbackEndsAt = 0;

    if (this.twilioWs.readyState === WebSocket.OPEN && this.streamSid) {
      this.twilioWs.send(JSON.stringify({ event: "clear", streamSid: this.streamSid }));
    }
    if (this.cartesia && this.currentContextId) {
      this.cartesia.cancelContext(this.currentContextId);
    }
    if (this.abortController) {
      // Keep conversational context of what was said before the interruption.
      if (this.generating && this.inFlightUserText) {
        this.history.push({ role: "user", content: this.inFlightUserText });
        if (this.partialReply.trim()) {
          this.history.push({ role: "assistant", content: this.partialReply.trim() });
        }
      }
      this.abortController.abort();
      this.abortController = null;
      this.generating = false;
      this.inFlightUserText = "";
    }
  }

  private scheduleCloseAfterPlayback(): void {
    if (this.closingCall) return;
    this.closingCall = true;
    const check = () => {
      const remaining = this.playbackEndsAt - Date.now();
      if (remaining > 150) {
        setTimeout(check, Math.min(remaining + 250, 1000));
        return;
      }
      console.log("[Session] Closing Twilio WS to execute post-stream action (hangup/transfer)");
      if (this.twilioWs.readyState === WebSocket.OPEN) {
        this.twilioWs.close();
      }
    };
    // Give Cartesia ~800ms to stream the final audio chunks to Twilio first
    setTimeout(check, 800);
  }

  private async handleUserSpeech(userTextRaw: string): Promise<void> {
    if (this.closingCall) return;
    let userText = userTextRaw;

    // If a reply is still being generated and no audio has been heard yet:
    // - If the caller just says a short check-in ("¿Bueno?", "¿Estás ahí?", "¿Lo tienes?") after >900ms,
    //   let the in-flight response/tool finish instead of aborting and restarting it from zero!
    if (this.generating && this.abortController && !this.isAudioPlaying()) {
      const elapsed = Date.now() - this.turnGenerationStartedAt;
      const isShortCheckIn =
        elapsed > 900 &&
        /^[¿?¡!\s]*(bueno|alo|aló|lo tienes|me escuchas|est[aá]s ah[ií]|sigues ah[ií]|hola|oye)[¿?¡!.\s]*$/i.test(
          userTextRaw.trim()
        );
      if (isShortCheckIn) {
        console.log("[Turn keep-alive] Ignoring short check-in while tool/LLM finishes:", userTextRaw);
        return;
      }
      console.log("[Turn merge] caller kept talking before reply was heard");
      userText = `${this.inFlightUserText} ${userTextRaw}`.trim();
      this.abortController.abort();
      this.abortController = null;
      this.generating = false;
      if (this.cartesia && this.currentContextId) this.cartesia.cancelContext(this.currentContextId);
    }

    console.log("[Caller speech]:", userText);
    this.transcript.push({ role: "caller", text: userText, timestamp: new Date().toISOString() });

    if (!this.business) return;

    const seq = ++this.turnSeq;
    this.currentContextId = `ctx_${Date.now()}`;
    const contextId = this.currentContextId;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    this.generating = true;
    this.turnGenerationStartedAt = Date.now();
    this.inFlightUserText = userText;
    this.partialReply = "";
    this.turnAudioStartedAt = 0;

    let spoke = false;
    let errored = false;
    let shouldCloseAfterPlayback = false;
    let bookedInTurn = false;

    // NOTE: the current user message is passed separately; history only holds past turns.
    await streamGroqResponse(
      this.config.groqKey,
      this.business,
      this.history,
      userText,
      {
        onSentenceClause: (clause) => {
          if (seq !== this.turnSeq || signal.aborted) return;
          console.log("[Groq clause -> Cartesia]:", clause);
          spoke = true;
          this.partialReply += (this.partialReply ? " " : "") + clause;
          this.cartesia?.sendText(clause, contextId, true);
        },
        onToolEvent: (event) => {
          console.log("[Session tool event]:", event);
          if (event === "appointment_booked") {
            this.callOutcome = "appointment_booked";
            bookedInTurn = true;
          } else if (event === "callback_scheduled" || event === "callback_logged") {
            this.callOutcome = "callback_scheduled";
          } else if (event === "order_taken") {
            this.callOutcome = "order_taken";
          } else if (event === "transferred" || event === "transfer_requested") {
            this.callOutcome = "transferred";
            const target = normalizePhoneToE164(
              this.business?.staffPhone ||
                (this.business as any)?.transferPhone ||
                this.business?.phone ||
                ""
            );
            if (this.callSid && target) {
              pendingCallActions.set(this.callSid, { type: "transfer", to: target });
            } else if (this.callSid) {
              pendingCallActions.set(this.callSid, { type: "hangup" });
            }
            shouldCloseAfterPlayback = true;
          } else if (event === "call_ended") {
            if (this.callSid) {
              pendingCallActions.set(this.callSid, { type: "hangup" });
            }
            shouldCloseAfterPlayback = true;
          }
        },
        onComplete: (reply) => {
          if (seq !== this.turnSeq || signal.aborted) return;
          if (reply) {
            this.transcript.push({ role: "aiva", text: reply, timestamp: new Date().toISOString() });
            this.history.push({ role: "user", content: userText });
            const historyReply = bookedInTurn
              ? `${reply} [SISTEMA: La cita YA quedó registrada y confirmada exitosamente en la base de datos en este turno. Si el cliente pregunta "¿lo tienes?" o "¿ya quedó?", confírmale que SÍ está agendada y NO vuelvas a llamar check_availability ni book_appointment.]`
              : reply;
            this.history.push({ role: "assistant", content: historyReply });
          }
        },
        onError: (err) => {
          errored = true;
          console.error("[Groq stream error]:", err);
        },
      },
      signal
    );

    if (seq !== this.turnSeq || signal.aborted) return;

    this.generating = false;
    this.inFlightUserText = "";

    if ((errored || !spoke) && !shouldCloseAfterPlayback) {
      // Never leave the caller in silence.
      this.transcript.push({ role: "aiva", text: FALLBACK_REPLY, timestamp: new Date().toISOString() });
      this.cartesia?.sendText(FALLBACK_REPLY, contextId, false);
      return;
    }

    // Close the Cartesia context so it flushes remaining audio.
    this.cartesia?.sendText("", contextId, false);

    if (shouldCloseAfterPlayback) {
      this.scheduleCloseAfterPlayback();
    }
  }

  public speakToCaller(text: string): void {
    this.currentContextId = `ctx_${Date.now()}`;
    console.log("[speakToCaller -> Cartesia]:", text);
    this.cartesia?.sendText(text, this.currentContextId, false);
  }

  private sendAudioToTwilio(base64Mulaw: string): void {
    if (this.twilioWs.readyState !== WebSocket.OPEN || !this.streamSid) {
      return;
    }
    const now = Date.now();
    // mulaw 8kHz: 8 bytes per ms
    const bytes = Math.floor((base64Mulaw.length * 3) / 4);
    const durationMs = bytes / 8;
    if (now >= this.playbackEndsAt) {
      this.turnAudioStartedAt = now;
      this.playbackEndsAt = now + durationMs;
    } else {
      this.playbackEndsAt += durationMs;
    }
    this.twilioWs.send(
      JSON.stringify({
        event: "media",
        streamSid: this.streamSid,
        media: { payload: base64Mulaw },
      })
    );
  }

  public async cleanup(): Promise<void> {
    if (this.cleanedUp) return;
    this.cleanedUp = true;
    console.log("[Call ended] Saving transcript to database...");
    if (this.speechDebounceTimer) clearTimeout(this.speechDebounceTimer);
    if (this.abortController) this.abortController.abort();
    if (this.deepgram) this.deepgram.close();
    if (this.cartesia) this.cartesia.close();

    if (this.callSid) {
      await upsertCall({
        id: this.callSid,
        businessId: this.businessId,
        callerPhone: this.callerPhone || "unknown",
        language: "es",
        channel: "phone",
        startedAt: this.callStartedAt,
        endedAt: new Date().toISOString(),
        outcome: this.callOutcome,
        transcript: this.transcript,
      });
    }
  }
}
