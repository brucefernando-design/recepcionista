"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Waveform from "@/components/Waveform";
import type { Business } from "@/lib/types";
import { useLanguage } from "@/components/LanguageContext";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const SPEECH_LOCALES: Record<string, string> = {
  es: "es-MX", en: "en-US", hi: "hi-IN", fr: "fr-FR",
  de: "de-DE", it: "it-IT", pt: "pt-BR", ja: "ja-JP",
};

const TYPE_EMOJI: Record<string, string> = {
  clinic: "🏥", salon: "💇", restaurant: "🍕", hotel: "🏨",
};

const QUICK_PROMPTS_EN: Record<string, string[]> = {
  clinic: [
    "I'd like to book a checkup tomorrow at 3pm",
    "Do you accept walk-ins?",
    "What times are free on Friday?",
  ],
  salon: [
    "Can I get a haircut this Saturday?",
    "How much is hair coloring?",
    "I need to reschedule my appointment",
  ],
  restaurant: [
    "I'd like to order two margherita pizzas for pickup",
    "Do you have vegan options?",
    "Table for four tonight at 8?",
  ],
  hotel: [
    "Do you have a king room this weekend?",
    "What time is check-in?",
    "Is breakfast included?",
  ],
};

const QUICK_PROMPTS_ES: Record<string, string[]> = {
  clinic: [
    "Quisiera agendar una cita para mañana a las 3pm",
    "¿Aceptan pacientes sin cita previa?",
    "¿Qué horarios tienen libres este viernes?",
  ],
  salon: [
    "¿Tienen hora para un corte de cabello este sábado?",
    "¿Cuánto cuesta el tinte de cabello?",
    "Necesito reagendar mi cita",
  ],
  restaurant: [
    "Quisiera pedir dos pizzas margherita para llevar",
    "¿Tienen opciones veganas o vegetarianas?",
    "¿Mesa para cuatro personas hoy a las 8pm?",
  ],
  hotel: [
    "¿Tienen habitación disponible para este fin de semana?",
    "¿A qué hora es el check-in?",
    "¿Tienen estacionamiento incluido?",
  ],
};

export default function DemoPage() {
  const { lang: globalLang } = useLanguage();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("biz_clinic");
  const [lang, setLang] = useState<string>(globalLang);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [ending, setEnding] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState<number>(1.18);
  const callIdRef = useRef<string>(`web_${Date.now().toString(36)}`);
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLang(globalLang);
  }, [globalLang]);

  useEffect(() => {
    fetch("/api/businesses")
      .then((r) => r.json())
      .then((list) => {
        setBusinesses(list);
        const params = new URLSearchParams(window.location.search);
        const biz = params.get("biz");
        const preLang = params.get("lang");
        if (biz && list.some((b: Business) => b.id === biz)) setBusinessId(biz);
        if (preLang && SPEECH_LOCALES[preLang]) setLang(preLang);
      })
      .catch(() => {});
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) setVoiceSupported(false);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, thinking]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        recognitionRef.current?.stop();
        setListening(false);
        window.speechSynthesis?.cancel();
      }
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const business = businesses.find((b) => b.id === businessId);

  function speakIn(text: string, langCode: string) {
    try {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const targetLocale = SPEECH_LOCALES[langCode] ?? "es-MX";
      utter.lang = targetLocale;
      utter.rate = speechRate;
      utter.pitch = 1.02;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const langPrefix = targetLocale.slice(0, 2).toLowerCase();
        const matchingVoices = voices.filter((v) =>
          v.lang.toLowerCase().replace("_", "-").startsWith(langPrefix)
        );
        const bestVoice =
          matchingVoices.find(
            (v) =>
              v.name.toLowerCase().includes("natural") ||
              v.name.toLowerCase().includes("mexico") ||
              v.name.toLowerCase().includes("sabina") ||
              v.lang.toLowerCase().replace("_", "-") === targetLocale.toLowerCase()
          ) ||
          matchingVoices.find((v) => v.name.toLowerCase().includes("google")) ||
          matchingVoices[0];

        if (bestVoice) {
          utter.voice = bestVoice;
        }
      }

      window.speechSynthesis.speak(utter);
    } catch {
      // speech synthesis unavailable
    }
  }

  async function send(message: string) {
    const text = message.trim();
    if (!text || thinking) return;
    setInput("");
    const history = turns;
    setTurns((t) => [...t, { role: "user", content: text }]);
    setThinking(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          history,
          message: text,
          callId: callIdRef.current,
        }),
      });
      const data = await res.json();
      const reply: string =
        data.reply ??
        (lang === "es"
          ? "Disculpa, ha ocurrido un error. Por favor intenta de nuevo."
          : "Sorry, something went wrong. Please try again.");
      if (data.language && SPEECH_LOCALES[data.language]) setLang(data.language);
      setTurns((t) => [...t, { role: "assistant", content: reply }]);
      speakIn(reply, data.language ?? lang);
    } catch {
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content:
            lang === "es"
              ? "Error de conexión — por favor intenta de nuevo."
              : "Connection error — please try again.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  function startListening() {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = SPEECH_LOCALES[lang] ?? "es-ES";
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setListening(false);
      send(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function reset() {
    setTurns([]);
    setInsight(null);
    callIdRef.current = `web_${Date.now().toString(36)}`;
    window.speechSynthesis?.cancel();
  }

  async function endCall() {
    if (turns.length === 0 || ending) return;
    setEnding(true);
    setInsight(null);
    try {
      const res = await fetch("/api/calls/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: callIdRef.current }),
      });
      const call = await res.json();
      if (res.ok && call.summary) {
        setInsight(
          `📋 ${call.summary} · ${lang === "es" ? "sentimiento" : "sentiment"}: ${call.sentiment ?? "n/a"}` +
            (call.upsellOpportunity ? ` · 💡 ${call.upsellOpportunity}` : "")
        );
      } else {
        setInsight(lang === "es" ? "Llamada guardada en el panel." : "Call saved to the dashboard.");
      }
    } catch {
      setInsight(lang === "es" ? "Llamada guardada en el panel." : "Call saved to the dashboard.");
    } finally {
      setEnding(false);
      callIdRef.current = `web_${Date.now().toString(36)}`;
      setTurns([]);
    }
  }

  const quickPrompts = lang === "es" ? QUICK_PROMPTS_ES : QUICK_PROMPTS_EN;

  return (
    <>
      <Navbar />
      <main className="container-page relative py-12">
        <div className="orb left-[-8%] top-[5%] h-80 w-80 animate-orb bg-brand-600/30" aria-hidden />
        <div className="orb right-[-8%] bottom-[10%] h-80 w-80 animate-orb bg-purple-600/25 [animation-delay:-10s]" aria-hidden />

        <div className="relative mb-10 text-center">
          <p className="eyebrow">{lang === "es" ? "Demostración en vivo" : "Live demo"}</p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            {lang === "es" ? "Habla con AIVA." : "Talk to AIVA."}
          </h1>
          <p className="mt-3 text-slate-400">
            {lang === "es"
              ? "Elige un negocio, habla por micrófono o escribe — AIVA se encarga del resto."
              : "Pick a business, then speak or type — AIVA handles the rest."}
          </p>
        </div>

        <div className="relative mx-auto max-w-2xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <select
                value={businessId}
                onChange={(e) => {
                  setBusinessId(e.target.value);
                  reset();
                }}
                className="min-w-44 flex-1 rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-2 text-sm outline-none transition focus:border-brand-500"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {TYPE_EMOJI[b.type] ?? "📞"} {b.name}
                  </option>
                ))}
              </select>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm outline-none transition focus:border-brand-500"
              >
                {Object.keys(SPEECH_LOCALES).map((code) => (
                  <option key={code} value={code}>
                    {code.toUpperCase()}
                  </option>
                ))}
              </select>
              <button
                onClick={endCall}
                disabled={turns.length === 0 || ending}
                className="btn-secondary !px-3.5 !py-2 text-xs sm:text-sm disabled:opacity-40"
                title={lang === "es" ? "Colgar y ver análisis" : "Hang up and run post-call analysis"}
              >
                {ending
                  ? (lang === "es" ? "Analizando…" : "Analyzing…")
                  : (lang === "es" ? "☎️ Colgar" : "☎️ End call")}
              </button>
              <button onClick={reset} className="btn-secondary !px-3.5 !py-2 text-xs sm:text-sm">
                {lang === "es" ? "Reiniciar" : "Reset"}
              </button>
            </div>

            {/* Selector de ritmo / velocidad de voz */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/80 px-2.5 py-1.5 text-xs">
              <span className="text-slate-400 font-medium mr-1">⚡ {lang === "es" ? "Ritmo:" : "Speed:"}</span>
              {[
                { label: "1.0x", rate: 1.0, title: "Normal" },
                { label: "1.18x Ágil", rate: 1.18, title: "Ágil y natural" },
                { label: "1.3x", rate: 1.3, title: "Rápido" },
              ].map((opt) => (
                <button
                  key={opt.rate}
                  type="button"
                  title={opt.title}
                  onClick={() => setSpeechRate(opt.rate)}
                  className={`rounded-lg px-2 py-0.5 font-medium transition ${
                    speechRate === opt.rate
                      ? "bg-brand-500 text-white font-semibold shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {insight && (
            <div className="mb-4 animate-fade-up rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-sm leading-relaxed text-brand-200">
              {insight}
            </div>
          )}

          {/* phone frame */}
          <div className="card-glow">
            <div className="!p-0 overflow-hidden">
              {/* call header */}
              <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-purple-500 text-lg">
                    {business ? TYPE_EMOJI[business.type] ?? "📞" : "📞"}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0b0d17] ${
                        turns.length > 0 ? "bg-emerald-400" : "bg-slate-500"
                      }`}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">
                      {business?.name ?? (lang === "es" ? "Cargando…" : "Loading…")}
                    </div>
                    <div
                      className={`text-xs ${
                        turns.length > 0 ? "text-emerald-400" : "text-slate-500"
                      }`}
                    >
                      {thinking
                        ? (lang === "es" ? "AIVA está pensando…" : "AIVA is thinking…")
                        : listening
                        ? (lang === "es" ? "Escuchándote…" : "Listening to you…")
                        : turns.length > 0
                        ? (lang === "es" ? "● En llamada con AIVA" : "● On call with AIVA")
                        : (lang === "es" ? "Lista para responder" : "Ready to answer")}
                    </div>
                  </div>
                </div>
                {(thinking || listening || turns.length > 0) && <Waveform />}
              </div>

              {/* transcript */}
              <div
                className="flex h-[400px] flex-col gap-3 overflow-y-auto p-5"
                aria-live="polite"
                aria-label="Conversation transcript"
              >
                {turns.length === 0 && (
                  <div className="m-auto text-center text-slate-500">
                    <div className="animate-floaty text-5xl">🎙️</div>
                    <p className="mt-4 text-sm">
                      {business
                        ? (lang === "es"
                            ? `Estás llamando a ${business.name}. ¡Di hola!`
                            : `You're calling ${business.name}. Say hello!`)
                        : (lang === "es" ? "Cargando negocios…" : "Loading businesses…")}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-600">
                      {lang === "es"
                        ? 'Prueba decir: "Quisiera agendar una cita para mañana"'
                        : 'Try: "I\'d like to book an appointment tomorrow at 3pm"'}
                    </p>
                  </div>
                )}
                {turns.map((t, i) => (
                  <div
                    key={i}
                    className={`animate-fade-up max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      t.role === "user"
                        ? "self-end rounded-br-md bg-brand-600/90 text-white"
                        : "self-start rounded-bl-md bg-white/[0.06] text-slate-100"
                    }`}
                  >
                    {t.content}
                  </div>
                ))}
                {thinking && (
                  <div className="typing-dots flex gap-1 self-start rounded-2xl rounded-bl-md bg-white/[0.06] px-4 py-3">
                    <span />
                    <span />
                    <span />
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* quick prompts */}
              {turns.length === 0 && business && (
                <div className="flex flex-wrap gap-2 border-t border-white/5 px-4 pt-3">
                  {(quickPrompts[business.type] ?? []).map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="rounded-full border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 transition hover:border-brand-500/60 hover:text-white"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* composer */}
              <form
                className="flex gap-3 border-t border-white/5 bg-white/[0.02] p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
              >
                {voiceSupported && (
                  <button
                    type="button"
                    onClick={listening ? stopListening : startListening}
                    className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl transition-all duration-300 ${
                      listening
                        ? "pulse-ring bg-red-500"
                        : "bg-gradient-to-br from-brand-400 to-brand-600 hover:scale-105"
                    }`}
                    title={listening ? (lang === "es" ? "Detener" : "Stop listening") : (lang === "es" ? "Hablar" : "Speak")}
                  >
                    <span className="relative z-10">{listening ? "⏹" : "🎙️"}</span>
                  </button>
                )}
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    listening
                      ? (lang === "es" ? "Escuchando…" : "Listening…")
                      : (lang === "es" ? "O escribe tu mensaje aquí… (presiona / para enfocar)" : "Or type your message… (press / to focus)")
                  }
                  className="flex-1 rounded-xl border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm outline-none transition focus:border-brand-500"
                />
                <button type="submit" className="btn-primary !px-5" disabled={thinking}>
                  {lang === "es" ? "Enviar" : "Send"}
                </button>
              </form>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-2 text-center text-xs text-slate-500">
            <p>
              {lang === "es" ? (
                <>
                  Las reservas y pedidos hechos aquí se reflejan en el{" "}
                  <Link href="/dashboard" className="text-brand-400 hover:underline">
                    panel de control
                  </Link>
                  {" "}— cuelga la llamada para ver el análisis de la IA.
                </>
              ) : (
                <>
                  Bookings and orders made here appear live in the{" "}
                  <Link href="/dashboard" className="text-brand-400 hover:underline">
                    dashboard
                  </Link>
                  {" "}— hang up to see AIVA&apos;s post-call analysis.
                </>
              )}
            </p>
            <button
              onClick={() => {
                const url = `${window.location.origin}/demo?biz=${businessId}&lang=${lang}`;
                navigator.clipboard?.writeText(url);
              }}
              className="text-slate-400 hover:text-white"
            >
              🔗 {lang === "es" ? "Copiar enlace de este negocio" : "Copy shareable link to this business"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
