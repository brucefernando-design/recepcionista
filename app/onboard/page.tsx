"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import type { Business } from "@/lib/types";
import { useLanguage } from "@/components/LanguageContext";

const EXAMPLES_EN: Record<string, string> = {
  "🏥 Clinic": `We're "Green Leaf Dental", a small dental clinic in Austin. Open Monday to Saturday 9am to 7pm. We do checkups ($50, 20 min), cleaning ($120, 40 min), root canals ($450, 60 min) and braces consultations. We accept walk-ins before noon. Free parking. English and Spanish speaking staff.`,
  "🍜 Restaurant": `"Saigon Street Kitchen" — Vietnamese restaurant in Austin, open daily 11am-10pm. Pho (beef $14, chicken $13), banh mi $9, spring rolls $7, iced coffee $5. We do pickup and delivery within 4 miles, free over $25. Vegan pho available. English and Spanish speaking staff.`,
  "💈 Salon": `"Fade Factory" barbershop. Tuesday to Sunday, 10am to 8pm. Skin fades $25 (30 min), beard trims $15 (15 min), kids cuts $18. Walk-ins welcome weekdays, book ahead for weekends. Card and cash accepted.`,
  "🏨 Hotel": `"Casa del Mar" — 24-room boutique hotel, front desk 24/7. Sea-view doubles $160/night, standard doubles $120, family suites $220. Breakfast included. Check-in 3pm, check-out noon. Airport transfers $35. Staff speak English and Spanish.`,
};

const EXAMPLES_ES: Record<string, string> = {
  "🏥 Clínica": `Somos "Clínica Dental Sonrisas" en Ciudad de México. Abrimos de lunes a sábado de 9am a 7pm. Hacemos limpiezas dentales ($600, 30 min), consultas de valoración ($300, 20 min) y ortodoncia ($1200). Aceptamos pacientes sin cita por la mañana. Estacionamiento gratuito. Hablamos español e inglés.`,
  "🍜 Restaurante": `"Pizzería Don Fernando", restaurante de comida italiana artesanal. Abrimos todos los días de 12pm a 10pm. Pizza margarita ($180), pizza cuatro quesos ($240), ensalada césar ($120), refrescos ($35). Hacemos envíos a domicilio y pedidos para recoger en local.`,
  "💈 Barbería": `"Barbería Clásica". De martes a domingo de 10am a 8pm. Corte de cabello ($150, 30 min), arreglo de barba ($100, 20 min), corte infantil ($120). Aceptamos efectivo y tarjeta. Se recomienda agendar cita.`,
  "🏨 Hotel": `"Hotel Boutique Centro". Recepción abierta 24/7. Habitación estándar ($950/noche), suite ejecutiva ($1500/noche). Incluye desayuno continental y wifi de alta velocidad. Check-in 3pm, check-out 12pm.`,
};

export default function OnboardPage() {
  const { lang } = useLanguage();
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Business | null>(null);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-domain";

  const examples = lang === "es" ? EXAMPLES_ES : EXAMPLES_EN;

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? (lang === "es" ? "Error al generar negocio" : "Generation failed"));
      setResult(data as Business);
    } catch (e) {
      setError(e instanceof Error ? e.message : (lang === "es" ? "Ocurrió un error inesperado" : "Something went wrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="container-page max-w-3xl py-12">
        {!result ? (
          <>
            <div className="text-center">
              <p className="mb-3 inline-block rounded-full border border-brand-500/40 bg-brand-500/10 px-4 py-1 text-sm text-brand-300">
                ✨ {lang === "es" ? "Configuración automática con IA" : "AI self-onboarding"}
              </p>
              <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
                {lang === "es" ? "Describe tu negocio." : "Describe your business."}
                <br />
                <span className="text-gradient">
                  {lang === "es" ? "AIVA se configura sola." : "AIVA configures itself."}
                </span>
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-slate-400">
                {lang === "es"
                  ? "Escribe unas oraciones sobre tu negocio: servicios, precios, horarios, etc. La inteligencia artificial creará tu recepcionista completa con FAQs, menú y reglas sin formularios."
                  : "Write a few sentences — services, prices, hours, languages. Claude turns it into a complete receptionist: services, FAQs, menu, everything. No forms."}
              </p>
            </div>

            <div className="card mt-10">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={8}
                placeholder={lang === "es" ? "Cuéntale a AIVA sobre tu negocio, tus servicios, horarios y precios…" : "Tell AIVA about your business…"}
                className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm outline-none focus:border-brand-500"
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(examples).map(([label, text]) => (
                    <button
                      key={label}
                      className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400 transition hover:border-brand-500/60 hover:text-white"
                      onClick={() => setDescription(text)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={generate}
                  disabled={loading || description.trim().length < 20}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? (lang === "es" ? "Creando tu recepcionista…" : "Building your receptionist…")
                    : (lang === "es" ? "✨ Crear mi recepcionista" : "✨ Generate my receptionist")}
                </button>
              </div>
              {error && (
                <p className="mt-3 text-sm text-red-400">{error}</p>
              )}
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="animate-floaty text-5xl">🎉</div>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">
              {lang === "es" ? `¡${result.name} está lista!` : `${result.name} is live!`}
            </h1>
            <p className="mt-2 text-slate-400">
              {lang === "es"
                ? "AIVA aprendió sobre tu negocio en segundos. Esto es lo que configuró:"
                : "AIVA learned your business in seconds. Here's what it knows:"}
            </p>

            <div className="card mt-8 text-left">
              <dl className="grid gap-4 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-slate-500">{lang === "es" ? "Tipo / Giro" : "Type"}</dt>
                  <dd className="font-medium capitalize">{result.type}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{lang === "es" ? "Horario" : "Hours"}</dt>
                  <dd className="font-medium">{result.hours}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{lang === "es" ? "Idiomas" : "Languages"}</dt>
                  <dd className="font-medium uppercase">
                    {result.languages.join(", ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{lang === "es" ? "Servicios aprendidos" : "Services learned"}</dt>
                  <dd className="font-medium">{result.services.length}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{lang === "es" ? "Preguntas frecuentes (FAQs)" : "FAQs learned"}</dt>
                  <dd className="font-medium">{result.faqs.length}</dd>
                </div>
                {result.menu && (
                  <div>
                    <dt className="text-slate-500">{lang === "es" ? "Productos del menú" : "Menu items"}</dt>
                    <dd className="font-medium">{result.menu.length}</dd>
                  </div>
                )}
                {result.rooms && (
                  <div>
                    <dt className="text-slate-500">{lang === "es" ? "Tipos de habitación" : "Room types"}</dt>
                    <dd className="font-medium">{result.rooms.length}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="card mt-6 text-left">
              <h3 className="text-sm font-semibold">📞 {lang === "es" ? "Conectar con número telefónico (Twilio)" : "Connect a phone number"}</h3>
              <p className="mt-2 text-xs text-slate-400">
                {lang === "es"
                  ? "En la configuración de voz de tu número de Twilio, pon que cuando entre una llamada ('A call comes in') haga POST a:"
                  : "In your Twilio number's voice settings, set \"A call comes in\" to POST to:"}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-lg bg-slate-950 px-3 py-2 text-xs text-brand-300">
                  {origin}/api/voice/incoming?businessId={result.id}
                </code>
                <button
                  onClick={() =>
                    navigator.clipboard?.writeText(
                      `${origin}/api/voice/incoming?businessId=${result.id}`
                    )
                  }
                  className="btn-secondary shrink-0 !px-3 !py-2 text-xs"
                >
                  {lang === "es" ? "Copiar" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {lang === "es"
                  ? "¿Aún no tienes Twilio? Puedes probarla ahora mismo en la demo web interactiva con el mismo cerebro de IA."
                  : "No Twilio yet? Just try the browser demo — same AI brain."}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href={`/demo?biz=${result.id}`} className="btn-primary">
                🎙️ {lang === "es" ? "Hablar con tu recepcionista" : "Talk to your receptionist"}
              </Link>
              <button
                onClick={() => {
                  setResult(null);
                  setDescription("");
                }}
                className="btn-secondary"
              >
                {lang === "es" ? "Configurar otro negocio" : "Onboard another business"}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
