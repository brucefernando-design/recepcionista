"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageContext";

const FAQS_DATA = [
  {
    en: {
      q: "How is AIVA different from an IVR or phone tree?",
      a: "There are no menus and no 'press 1'. AIVA holds a natural conversation, understands context, switches languages mid-call, and actually completes tasks — booking, ordering, answering — instead of routing you around.",
    },
    es: {
      q: "¿En qué se diferencia AIVA de un conmutador telefónico tradicional?",
      a: "No hay menús mecánicos ni 'presione 1'. AIVA mantiene una conversación natural, entiende el contexto, cambia de idioma en plena llamada y resuelve las tareas: agenda citas, toma pedidos y responde preguntas.",
    },
  },
  {
    en: {
      q: "What happens when AIVA can't handle a call?",
      a: "It transfers to your staff with full context, or logs a callback request as an action item in your dashboard. No caller ever hits a dead end.",
    },
    es: {
      q: "¿Qué sucede cuando AIVA no puede resolver una llamada?",
      a: "Transfiere la llamada a tu personal con todo el contexto o registra una tarea para devolver la llamada en tu panel de control.",
    },
  },
  {
    en: {
      q: "How long does setup take?",
      a: "Minutes. Describe your business in plain English on the onboarding page and AIVA generates its own configuration — services, FAQs, menu, languages. Point your Twilio number at it and you're live.",
    },
    es: {
      q: "¿Cuánto tiempo toma configurarlo?",
      a: "Solo minutos. Describe tu negocio con tus palabras y AIVA genera automáticamente los servicios, preguntas frecuentes y menú para comenzar a recibir llamadas.",
    },
  },
  {
    en: {
      q: "Which languages does AIVA speak?",
      a: "English, Hindi, Spanish, French, German, Italian, Portuguese and Japanese — and it detects the caller's language automatically, mid-sentence.",
    },
    es: {
      q: "¿Qué idiomas habla AIVA?",
      a: "Español, Inglés, Francés, Alemán, Italiano, Portugués, Japonés e Hindi. Detecta el idioma del cliente automáticamente al hablar.",
    },
  },
  {
    en: {
      q: "Do I keep my existing phone number?",
      a: "Yes. Forward your existing number to AIVA, or port it. Callers never know anything changed — except that someone finally answers.",
    },
    es: {
      q: "¿Puedo mantener mi número de teléfono actual?",
      a: "Sí. Puedes desviar las llamadas de tu línea actual hacia AIVA. Tus clientes no notarán ninguna diferencia técnica, salvo que ahora siempre les contestan.",
    },
  },
];

export default function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);
  const { lang } = useLanguage();

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {FAQS_DATA.map((f, i) => {
        const item = f[lang] ?? f.en;
        const isOpen = open === i;
        return (
          <div
            key={i}
            className={`card !p-0 overflow-hidden transition-colors ${
              isOpen ? "border-brand-500/40" : ""
            }`}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
            >
              <span className="font-medium">{item.q}</span>
              <span
                className={`shrink-0 text-brand-400 transition-transform duration-300 ${
                  isOpen ? "rotate-45" : ""
                }`}
              >
                +
              </span>
            </button>
            <div
              className="grid transition-all duration-300 ease-out"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-5 text-sm leading-relaxed text-slate-400">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
