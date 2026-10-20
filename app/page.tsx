"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import LiveCallDemo from "@/components/LiveCallDemo";
import FaqAccordion from "@/components/FaqAccordion";
import JsonLd from "@/components/JsonLd";
import { useLanguage } from "@/components/LanguageContext";

const FEATURES_DATA = [
  {
    icon: "📞",
    en: {
      title: "Answers every call",
      body: "AIVA picks up 24/7 in under a second. No hold music, no missed customers, no voicemail black hole.",
    },
    es: {
      title: "Atiende cada llamada",
      body: "AIVA contesta 24/7 en menos de un segundo. Sin esperas musicales, sin clientes perdidos ni buzones de voz.",
    },
  },
  {
    icon: "📅",
    en: {
      title: "Books appointments",
      body: "Checks live availability, proactively offers free slots, confirms details back, and texts an SMS confirmation.",
    },
    es: {
      title: "Agenda citas y reservas",
      body: "Verifica disponibilidad en tiempo real, sugiere horarios libres, confirma detalles y envía confirmaciones por SMS.",
    },
  },
  {
    icon: "🧠",
    en: {
      title: "Post-call intelligence",
      body: "Every call gets a summary, caller sentiment, staff action items — and upsell opportunities spotted in conversation.",
    },
    es: {
      title: "Inteligencia post-llamada",
      body: "Cada llamada genera un resumen, análisis de sentimiento, tareas para el personal y oportunidades de venta detectadas.",
    },
  },
  {
    icon: "🍽️",
    en: {
      title: "Takes orders",
      body: "Full order capture with item-by-item confirmation, pickup or delivery, and an accurate total every time.",
    },
    es: {
      title: "Toma pedidos por teléfono",
      body: "Captura pedidos artículo por artículo, para retiro o entrega a domicilio, con totales siempre exactos.",
    },
  },
  {
    icon: "🌍",
    en: {
      title: "Speaks 8+ languages",
      body: "AIVA detects the caller's language mid-sentence and switches instantly — greetings in English, dessert in Spanish.",
    },
    es: {
      title: "Habla más de 8 idiomas",
      body: "AIVA detecta el idioma del cliente al hablar y cambia de inmediato entre español, inglés y más con fluidez nativa.",
    },
  },
  {
    icon: "✨",
    en: {
      title: "Onboards itself",
      body: "Describe your business in plain English. AIVA generates its own services, FAQs and menu — live in minutes.",
    },
    es: {
      title: "Configuración automática",
      body: "Describe tu negocio con tus propias palabras y AIVA genera sus servicios, preguntas frecuentes y menú en minutos.",
    },
  },
];

const INDUSTRIES_DATA = [
  {
    icon: "🏥",
    en: {
      name: "Clinics",
      body: "Appointment booking, insurance questions and walk-in guidance — while your front desk focuses on patients in the room.",
    },
    es: {
      name: "Clínicas y Consultorios",
      body: "Agendamiento de citas, dudas de seguros y atención a pacientes mientras tu recepción atiende a quienes están en sala.",
    },
  },
  {
    icon: "💇",
    en: {
      name: "Salons & Spas",
      body: "Bookings for cuts, color and spa services, stylist availability, and product questions handled while your team keeps working.",
    },
    es: {
      name: "Salones y Barberías",
      body: "Citas para cortes, color y tratamientos, disponibilidad de estilistas y preguntas de servicios sin interrumpir el trabajo.",
    },
  },
  {
    icon: "🍕",
    en: {
      name: "Restaurants",
      body: "Phone orders taken accurately during the dinner rush, reservations booked, and menu questions answered in any language.",
    },
    es: {
      name: "Restaurantes",
      body: "Toma de pedidos precisa en horas pico, reservas de mesas y resolución de dudas del menú en cualquier idioma.",
    },
  },
  {
    icon: "🏨",
    en: {
      name: "Hotels",
      body: "Room availability, rate questions, spa bookings, and airport pickups — a concierge that never sleeps.",
    },
    es: {
      name: "Hoteles",
      body: "Disponibilidad de habitaciones, tarifas, reservas y atención al huésped las 24 horas con un conserje incansable.",
    },
  },
];

const TESTIMONIALS_DATA = [
  {
    en: {
      quote: "We used to miss 30+ calls a week during dinner service. Now every single one is answered — and the order totals are always right.",
      name: "Marco B.",
      role: "Owner, Bella Notte Trattoria",
    },
    es: {
      quote: "Solíamos perder más de 30 llamadas a la semana durante las cenas. Ahora se atiende cada una y los pedidos son exactos.",
      name: "Marco B.",
      role: "Propietario, Bella Notte Trattoria",
    },
  },
  {
    en: {
      quote: "Patients switch languages mid-call like it's nothing. Our front desk finally breathes.",
      name: "Dr. Priya S.",
      role: "Sunrise Family Clinic",
    },
    es: {
      quote: "Nuestros pacientes hablan en español o inglés indistintamente y AIVA se adapta al instante. La recepción por fin puede respirar.",
      name: "Dra. Priya S.",
      role: "Sunrise Family Clinic",
    },
  },
  {
    en: {
      quote: "The upsell radar paid for itself in a month. It noticed callers kept asking about keratin — we added it to the menu.",
      name: "Elena R.",
      role: "Luxe Hair & Beauty",
    },
    es: {
      quote: "El análisis de llamadas se pagó solo el primer mes: notó que muchos preguntaban por keratina y lo añadimos al menú.",
      name: "Elena R.",
      role: "Luxe Hair & Beauty",
    },
  },
];

const LANGS = ["Español", "English", "हिन्दी", "Français", "Deutsch", "Italiano", "Português", "日本語"];

export default function Home() {
  const { lang } = useLanguage();

  return (
    <>
      <JsonLd />
      <Navbar />
      <main className="overflow-x-clip">
        {/* ---------- Hero ---------- */}
        <section className="relative pb-24 pt-16 md:pt-24">
          <div className="orb left-[-10%] top-[-5%] h-96 w-96 animate-orb bg-brand-600/50" aria-hidden />
          <div className="orb right-[-12%] top-[30%] h-[28rem] w-[28rem] animate-orb bg-purple-600/40 [animation-delay:-8s]" aria-hidden />

          <div className="container-page relative grid items-center gap-14 lg:grid-cols-2">
            <div>
              <Reveal>
                <p className="eyebrow">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  {lang === "es" ? "Tu recepcionista con IA 24/7" : "Your 24/7 AI receptionist"}
                </p>
              </Reveal>
              <Reveal delay={100}>
                <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
                  {lang === "es" ? (
                    <>
                      No pierdas
                      <br />
                      otra llamada.
                      <br />
                      <em className="text-gradient not-italic">AIVA contesta.</em>
                    </>
                  ) : (
                    <>
                      Never miss
                      <br />
                      another call.
                      <br />
                      <em className="text-gradient not-italic">AIVA answers.</em>
                    </>
                  )}
                </h1>
              </Reveal>
              <Reveal delay={200}>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-400">
                  {lang === "es"
                    ? "AIVA atiende tu teléfono, agenda citas, toma pedidos y responde preguntas en el idioma de tu cliente. Diseñada para clínicas, salones, restaurantes y hoteles."
                    : "AIVA answers your phone, books appointments, takes orders and answers questions — in your customer's language. Built for clinics, salons, restaurants and hotels."}
                </p>
              </Reveal>
              <Reveal delay={300}>
                <div className="mt-9 flex flex-wrap gap-4">
                  <Link href="/demo" className="btn-primary">
                    {lang === "es" ? "🎙️ Probar con voz ahora" : "🎙️ Talk to AIVA now"}
                  </Link>
                  <Link href="/onboard" className="btn-secondary">
                    {lang === "es" ? "✨ Crear la tuya en 2 min" : "✨ Build yours in 2 minutes"}
                  </Link>
                </div>
              </Reveal>
              <Reveal delay={400}>
                <div className="mt-10 flex items-center gap-8 text-sm text-slate-500">
                  {[
                    ["<1s", lang === "es" ? "tiempo de respuesta" : "answer time"],
                    ["24/7", lang === "es" ? "siempre activa" : "always on"],
                    ["8+", lang === "es" ? "idiomas nativos" : "languages"],
                  ].map(([stat, label]) => (
                    <div key={label}>
                      <div className="font-display text-2xl font-semibold text-slate-100">{stat}</div>
                      <div className="mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            <Reveal delay={250} className="relative">
              <LiveCallDemo />
            </Reveal>
          </div>

          {/* language marquee */}
          <div className="marquee-mask relative mt-20 overflow-hidden">
            <div className="flex w-max animate-marquee gap-4">
              {[...LANGS, ...LANGS, ...LANGS, ...LANGS].map((l, i) => (
                <span
                  key={i}
                  className="whitespace-nowrap rounded-full border border-white/5 bg-white/[0.03] px-5 py-2 text-sm text-slate-400"
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section id="features" className="py-24">
          <div className="container-page">
            <Reveal>
              <p className="eyebrow">{lang === "es" ? "Capacidades" : "Capabilities"}</p>
              <h2 className="mt-4 max-w-xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
                {lang === "es" ? (
                  <>
                    Todo lo que hace una gran recepcionista.
                    <span className="text-slate-500"> Y mucho más.</span>
                  </>
                ) : (
                  <>
                    Everything a great receptionist does.
                    <span className="text-slate-500"> And a few things none can.</span>
                  </>
                )}
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES_DATA.map((f, i) => {
                const item = f[lang] ?? f.en;
                return (
                  <Reveal key={f.icon + i} delay={i * 80}>
                    <div className="card card-hover h-full">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 text-2xl">
                        {f.icon}
                      </div>
                      <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------- Industries ---------- */}
        <section id="industries" className="relative py-24">
          <div className="orb left-[40%] top-[10%] h-80 w-80 animate-orb bg-brand-700/30" aria-hidden />
          <div className="container-page relative">
            <Reveal>
              <p className="eyebrow">{lang === "es" ? "Industrias" : "Industries"}</p>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight md:text-5xl">
                {lang === "es" ? "Diseñado para tu negocio." : "Built for your front desk."}
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-5 md:grid-cols-2">
              {INDUSTRIES_DATA.map((ind, i) => {
                const item = ind[lang] ?? ind.en;
                return (
                  <Reveal key={ind.icon + i} delay={i * 100}>
                    <div className="card card-hover flex h-full gap-5">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-purple-500/15 text-3xl">
                        {ind.icon}
                      </div>
                      <div>
                        <h3 className="font-display text-xl font-semibold">{item.name}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------- Testimonials ---------- */}
        <section className="py-24">
          <div className="container-page">
            <Reveal>
              <p className="eyebrow">{lang === "es" ? "Opiniones" : "Loved by owners"}</p>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight md:text-5xl">
                {lang === "es" ? "El teléfono dejó de ser un problema." : "The phone stopped being a problem."}
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {TESTIMONIALS_DATA.map((t, i) => {
                const item = t[lang] ?? t.en;
                return (
                  <Reveal key={item.name} delay={i * 100}>
                    <figure className="card card-hover flex h-full flex-col">
                      <div className="text-brand-400" aria-hidden>★★★★★</div>
                      <blockquote className="mt-4 flex-1 font-display text-lg leading-relaxed text-slate-200">
                        “{item.quote}”
                      </blockquote>
                      <figcaption className="mt-6 text-sm">
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-slate-500">{item.role}</div>
                      </figcaption>
                    </figure>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="py-24">
          <div className="container-page">
            <Reveal>
              <div className="text-center">
                <p className="eyebrow">FAQ</p>
                <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight">
                  {lang === "es" ? "Preguntas frecuentes" : "Questions, answered."}
                </h2>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="mt-12">
                <FaqAccordion />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="pb-28">
          <div className="container-page">
            <Reveal>
              <div className="card-glow">
                <div className="relative overflow-hidden !p-14 text-center">
                  <div className="orb left-[20%] top-[-40%] h-64 w-64 animate-orb bg-brand-500/40" aria-hidden />
                  <h2 className="relative font-display text-4xl font-semibold tracking-tight md:text-5xl">
                    {lang === "es" ? "Escucha a AIVA por ti mismo." : "Hear AIVA for yourself."}
                  </h2>
                  <p className="relative mx-auto mt-4 max-w-xl text-slate-400">
                    {lang === "es"
                      ? "Habla con AIVA en tu navegador y comprueba cómo agenda una cita, toma un pedido y responde en español e inglés en tiempo real."
                      : "Speak to AIVA in your browser and watch it book an appointment, take an order, and switch languages — live."}
                  </p>
                  <div className="relative mt-9 flex flex-wrap justify-center gap-4">
                    <Link href="/demo" className="btn-primary">
                      {lang === "es" ? "🎙️ Iniciar prueba" : "🎙️ Start the demo"}
                    </Link>
                    <Link href="/onboard" className="btn-secondary">
                      {lang === "es" ? "Configurar mi negocio" : "Build your receptionist"}
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
