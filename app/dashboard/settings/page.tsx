"use client";

import { useEffect, useState } from "react";
import type { Business } from "@/lib/types";
import type { FaqSuggestion } from "@/lib/faqSuggest";
import { useLanguage } from "@/components/LanguageContext";

export default function SettingsPage() {
  const { lang } = useLanguage();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selected, setSelected] = useState<Business | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<FaqSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  async function handleScrapeUrl(targetUrl?: string, existingId?: string) {
    if (!selected) return;
    const urlToFetch = (targetUrl ?? scrapeUrl).trim();
    if (!urlToFetch) return;

    if (existingId) setScrapingId(existingId);
    else setScraping(true);
    setScrapeError(null);

    try {
      const res = await fetch("/api/knowledge/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlToFetch, businessName: selected.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al extraer la página web");

      const currentSources = selected.webSources ?? [];
      if (existingId) {
        update({
          webSources: currentSources.map((w) =>
            w.id === existingId
              ? { ...w, title: data.title, summary: data.summary, updatedAt: data.updatedAt }
              : w
          ),
        });
      } else {
        update({
          webSources: [
            ...currentSources,
            {
              id: data.id,
              url: data.url,
              title: data.title,
              summary: data.summary,
              updatedAt: data.updatedAt,
            },
          ],
        });
        setScrapeUrl("");
      }
    } catch (err: any) {
      setScrapeError(err?.message || "No se pudo extraer información de esa URL");
    } finally {
      setScraping(false);
      setScrapingId(null);
    }
  }

  async function fetchSuggestions() {
    if (!selected) return;
    setSuggesting(true);
    setSuggestNote(null);
    try {
      const res = await fetch(`/api/faq-suggestions?businessId=${selected.id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setSuggestions(data.suggestions);
      if (data.suggestions.length === 0) {
        setSuggestNote(
          lang === "es"
            ? "No se detectaron preguntas faltantes — tus preguntas frecuentes cubren todo lo que piden los clientes. 🎉"
            : "No gaps found — your FAQs cover what callers ask. 🎉"
        );
      }
    } catch (e) {
      setSuggestNote(e instanceof Error ? e.message : (lang === "es" ? "Error al buscar preguntas" : "Suggestion failed"));
    } finally {
      setSuggesting(false);
    }
  }

  function acceptSuggestion(s: FaqSuggestion) {
    if (!selected) return;
    update({
      faqs: [
        ...selected.faqs,
        { id: `f_${Date.now()}`, question: s.question, answer: s.draft_answer },
      ],
    });
    setSuggestions((list) => list.filter((x) => x.question !== s.question));
  }

  useEffect(() => {
    fetch("/api/businesses")
      .then((r) => r.json())
      .then((list: Business[]) => {
        setBusinesses(list);
        setSelected(list[0] ?? null);
      })
      .catch(() => {});
  }, []);

  function update(patch: Partial<Business>) {
    if (!selected) return;
    setSelected({ ...selected, ...patch });
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected),
      });
      if (res.ok) {
        setSavedAt(Date.now());
        setBusinesses((bs) =>
          bs.map((b) => (b.id === selected.id ? selected : b))
        );
      }
    } finally {
      setSaving(false);
    }
  }

  if (!selected) {
    return <div className="text-sm text-slate-400">{lang === "es" ? "Cargando conocimiento…" : "Loading…"}</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{lang === "es" ? "Conocimiento y Configuración" : "Knowledge"}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {lang === "es"
              ? "Entrena a AIVA en vivo — los cambios aplican automáticamente en la siguiente llamada."
              : "Teach AIVA live — changes apply to the very next call."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selected.id}
            onChange={(e) =>
              setSelected(businesses.find((b) => b.id === e.target.value) ?? null)
            }
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <a
            href={`/api/businesses/${selected.id}/export`}
            className="btn-secondary !px-3 !py-2 text-xs"
            title={lang === "es" ? "Descargar esta configuración como JSON" : "Download this configuration as JSON"}
          >
            {lang === "es" ? "⬇ Exportar" : "⬇ Export"}
          </a>
          <label
            className="btn-secondary cursor-pointer !px-3 !py-2 text-xs"
            title={lang === "es" ? "Importar un archivo JSON como nuevo negocio" : "Import a config JSON as a new business"}
          >
            {lang === "es" ? "⬆ Importar" : "⬆ Import"}
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const body = await file.text();
                  const res = await fetch("/api/businesses/import", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body,
                  });
                  const created = await res.json();
                  if (!res.ok) throw new Error(created.error ?? "import failed");
                  setBusinesses((bs) => [...bs, created]);
                  setSelected(created);
                } catch (err) {
                  alert(err instanceof Error ? err.message : (lang === "es" ? "Error al importar" : "Import failed"));
                } finally {
                  e.target.value = "";
                }
              }}
            />
          </label>
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold">{lang === "es" ? "Datos básicos del negocio" : "Basics"}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label={lang === "es" ? "Nombre del negocio" : "Business name"} value={selected.name} onChange={(v) => update({ name: v })} />
          <Field label={lang === "es" ? "Horario de atención" : "Hours"} value={selected.hours} onChange={(v) => update({ hours: v })} />
          <Field label={lang === "es" ? "Teléfono principal" : "Phone"} value={selected.phone} onChange={(v) => update({ phone: v })} />
          <Field label={lang === "es" ? "Dirección física" : "Address"} value={selected.address} onChange={(v) => update({ address: v })} />
          <Field
            label={lang === "es" ? "Teléfono de desvío a personal / humano (opcional)" : "Staff transfer number (optional)"}
            value={selected.staffPhone ?? ""}
            onChange={(v) => update({ staffPhone: v || undefined })}
          />
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold">{lang === "es" ? "Voz, Saludos y Avisos" : "Voice & announcements"}</h2>
        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="text-slate-400">
              {lang === "es"
                ? "Saludo personalizado (opcional — usa {name} para el nombre del negocio)"
                : "Custom greeting (optional — use {name} for the business name)"}
            </span>
            <input
              value={selected.greeting ?? ""}
              onChange={(e) => update({ greeting: e.target.value || undefined })}
              placeholder={lang === "es" ? `Gracias por llamar a ${selected.name}. Mi nombre es AIVA, ¿en qué puedo ayudarte hoy?` : `Thank you for calling ${selected.name}. This is AIVA…`}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">
              {lang === "es"
                ? "Anuncio especial — se leerá a cada cliente al inicio de la llamada mientras esté activo"
                : "Announcement — read to every caller while set"}
            </span>
            <input
              value={selected.announcement ?? ""}
              onChange={(e) =>
                update({ announcement: e.target.value || undefined })
              }
              placeholder={lang === "es" ? "Cerramos a las 3 PM este viernes por capacitación del personal." : "We close at 3 PM this Friday for staff training."}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">
              {lang === "es"
                ? "URL de Webhook saliente — AIVA enviará eventos de reservas/pedidos aquí (Zapier, Make, n8n, tu backend)"
                : "Outbound webhook URL — AIVA POSTs booking/order/callback events here (Zapier, n8n, your backend)"}
            </span>
            <input
              value={selected.webhookUrl ?? ""}
              onChange={(e) => update({ webhookUrl: e.target.value || undefined })}
              placeholder="https://hooks.zapier.com/…"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">
              {lang === "es"
                ? "Cierres por días festivos — fechas separadas por coma (AAAA-MM-DD), nunca agendables"
                : "Holiday closures — comma-separated dates (YYYY-MM-DD), never bookable"}
            </span>
            <input
              value={(selected.holidays ?? []).join(", ")}
              onChange={(e) =>
                update({
                  holidays: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
                })
              }
              placeholder="2026-12-25, 2027-01-01"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
        </div>
      </div>

      {/* Custom Prompt / System Instructions Card */}
      <div className="card mt-6 border-brand-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-brand-950/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-white">
              {lang === "es"
                ? "🧠 Prompt / Instrucciones Personalizadas de AIVA"
                : "🧠 Custom System Prompt & Instructions"}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {lang === "es"
                ? "Define libremente quién es tu empresa, qué sistemas o servicios ofreces, cómo debe responder AIVA y qué objetivo tiene en cada llamada."
                : "Define who your business is, what you offer, AIVA's tone, and call goals."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const prodNames = (selected.menu ?? [])
                .filter((m) => m.available !== false)
                .map((m) => m.name)
                .join(", ");
              const svcNames = selected.services.map((s) => s.name).join(", ");
              const template = `Somos ${selected.name}, una empresa de tecnología y soluciones digitales.\nOfrecemos los siguientes sistemas y servicios: ${
                prodNames || svcNames || "Consultoría y demostraciones"
              }.\n- Cuando un cliente pregunte por nuestros sistemas o servicios, explícalos de forma breve, clara y entusiasta usando nuestra base de conocimiento.\n- Tu objetivo principal es resolver sus dudas y ofrecerle agendar una cita o demostración personalizada (pidiendo día, hora, nombre y teléfono).\n- Si pide hablar con un asesor humano, transfiérelo de inmediato.`;
              update({ customPrompt: template });
            }}
            className="rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-300 hover:bg-brand-500/20"
          >
            {lang === "es" ? "✨ Insertar plantilla sugerida" : "✨ Insert template"}
          </button>
        </div>
        <textarea
          value={selected.customPrompt ?? ""}
          onChange={(e) => update({ customPrompt: e.target.value })}
          rows={5}
          placeholder={
            lang === "es"
              ? "Ejemplo: Somos Allia2, empresa desarrolladora de software. Ofrecemos TuKardex (control escolar/kardex), Cruceline, EasyConta (sistema contable), MiHotel (gestión hotelera) y Recepcionista de WhatsApp con IA. Nuestro objetivo es explicar brevemente cada solución y agendar una cita o demostración..."
              : "Example: We are a software company offering demos and consultations..."
          }
          className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
        />
      </div>

      {/* Website Knowledge Base Card */}
      <div className="card mt-6 border-indigo-500/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-white">
              {lang === "es"
                ? "🌐 Base de Conocimiento desde Páginas Web (URLs)"
                : "🌐 Website Knowledge Base (URLs)"}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {lang === "es"
                ? "Ingresa la dirección de tus páginas web (ej. tukardex.com, mihotel.com). AIVA extraerá y resumirá toda la información para responder dudas al instante durante las llamadas."
                : "Paste any website URL to automatically extract and summarize knowledge for live calls."}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              update({
                webSources: [
                  ...(selected.webSources ?? []),
                  {
                    id: `web_${Date.now()}`,
                    url: "https://",
                    title: lang === "es" ? "Nota de conocimiento" : "Knowledge note",
                    summary: "",
                    updatedAt: new Date().toISOString(),
                  },
                ],
              })
            }
            className="text-xs text-brand-400 hover:underline"
          >
            {lang === "es" ? "+ Agregar nota manual" : "+ Add manual note"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="text"
            value={scrapeUrl}
            onChange={(e) => setScrapeUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleScrapeUrl();
              }
            }}
            placeholder={
              lang === "es"
                ? "https://tukardex.com o pega cualquier enlace de tu sitio web…"
                : "https://example.com…"
            }
            className="min-w-60 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={scraping || !scrapeUrl.trim()}
            onClick={() => void handleScrapeUrl()}
            className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50"
          >
            {scraping
              ? lang === "es"
                ? "⏳ Extrayendo información…"
                : "⏳ Extracting…"
              : lang === "es"
              ? "🔍 Extraer información de la web"
              : "🔍 Extract from web"}
          </button>
        </div>

        {scrapeError && (
          <p className="mt-2 text-xs text-amber-400">{scrapeError}</p>
        )}

        <div className="mt-4 space-y-4">
          {(selected.webSources ?? []).length === 0 ? (
            <p className="text-xs text-slate-500">
              {lang === "es"
                ? "Aún no has agregado páginas web. Pega una URL arriba y haz clic en «Extraer información de la web»."
                : "No website sources added yet."}
            </p>
          ) : (
            (selected.webSources ?? []).map((w, i) => (
              <div
                key={w.id}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <input
                      value={w.title}
                      onChange={(e) => {
                        const webSources = [...(selected.webSources ?? [])];
                        webSources[i] = { ...w, title: e.target.value };
                        update({ webSources });
                      }}
                      placeholder={lang === "es" ? "Título de la página / producto" : "Title"}
                      className="min-w-44 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white"
                    />
                    <input
                      value={w.url}
                      onChange={(e) => {
                        const webSources = [...(selected.webSources ?? [])];
                        webSources[i] = { ...w, url: e.target.value };
                        update({ webSources });
                      }}
                      placeholder="https://..."
                      className="min-w-52 flex-1 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-xs text-brand-300"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={scrapingId === w.id || !w.url || w.url === "https://"}
                      onClick={() => void handleScrapeUrl(w.url, w.id)}
                      className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-brand-500 hover:text-white disabled:opacity-40"
                    >
                      {scrapingId === w.id
                        ? lang === "es"
                          ? "Actualizando…"
                          : "Syncing…"
                        : lang === "es"
                        ? "🔄 Re-escanear web"
                        : "🔄 Re-scan"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        update({
                          webSources: (selected.webSources ?? []).filter(
                            (x) => x.id !== w.id
                          ),
                        })
                      }
                      className="text-slate-500 hover:text-red-400"
                      title={lang === "es" ? "Eliminar fuente web" : "Remove"}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <textarea
                  value={w.summary}
                  onChange={(e) => {
                    const webSources = [...(selected.webSources ?? [])];
                    webSources[i] = { ...w, summary: e.target.value };
                    update({ webSources });
                  }}
                  rows={4}
                  placeholder={
                    lang === "es"
                      ? "Información extraída de la página web (puedes editarla o complementarla libremente)…"
                      : "Extracted website knowledge…"
                  }
                  className="mt-2.5 w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-300"
                />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold">{lang === "es" ? "Idiomas en los que responde AIVA" : "Languages AIVA answers in"}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {["en", "hi", "es", "fr", "de", "it", "pt", "ja"].map((code) => {
            const active = selected.languages.includes(code);
            return (
              <button
                key={code}
                onClick={() =>
                  update({
                    languages: active
                      ? selected.languages.filter((l) => l !== code)
                      : [...selected.languages, code],
                  })
                }
                className={`rounded-full border px-4 py-1.5 text-sm uppercase transition ${
                  active
                    ? "border-brand-500/60 bg-brand-500/20 text-brand-200"
                    : "border-slate-700 text-slate-400 hover:border-slate-500"
                }`}
              >
                {code}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{lang === "es" ? "Servicios" : "Services"}</h2>
          <button
            className="text-sm text-brand-400 hover:underline"
            onClick={() =>
              update({
                services: [
                  ...selected.services,
                  { id: `svc_${Date.now()}`, name: lang === "es" ? "Nuevo servicio" : "New service", durationMinutes: 30, price: 0 },
                ],
              })
            }
          >
            {lang === "es" ? "+ Agregar servicio" : "+ Add service"}
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {selected.services.map((s, i) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3">
              <input
                value={s.name}
                placeholder={lang === "es" ? "Nombre del servicio" : "Service name"}
                onChange={(e) => {
                  const services = [...selected.services];
                  services[i] = { ...s, name: e.target.value };
                  update({ services });
                }}
                className="min-w-40 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={s.durationMinutes}
                  onChange={(e) => {
                    const services = [...selected.services];
                    services[i] = { ...s, durationMinutes: Number(e.target.value) };
                    update({ services });
                  }}
                  className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  title={lang === "es" ? "Duración (minutos)" : "Duration (min)"}
                />
                <span className="text-xs text-slate-500">min</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">$</span>
                <input
                  type="number"
                  value={s.price}
                  onChange={(e) => {
                    const services = [...selected.services];
                    services[i] = { ...s, price: Number(e.target.value) };
                    update({ services });
                  }}
                  className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  title={lang === "es" ? "Precio" : "Price"}
                />
              </div>
              <button
                className="text-slate-500 hover:text-red-400"
                onClick={() =>
                  update({ services: selected.services.filter((x) => x.id !== s.id) })
                }
                title={lang === "es" ? "Eliminar servicio" : "Remove"}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {selected.menu && (
        <div className="card mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{lang === "es" ? "Menú de productos / Catálogo" : "Menu"}</h2>
            <button
              className="text-sm text-brand-400 hover:underline"
              onClick={() =>
                update({
                  menu: [
                    ...(selected.menu ?? []),
                    {
                      id: `m_${Date.now()}`,
                      name: lang === "es" ? "Nuevo producto" : "New item",
                      description: "",
                      price: 0,
                      category: lang === "es" ? "Principales" : "Mains",
                      available: true,
                    },
                  ],
                })
              }
            >
              {lang === "es" ? "+ Agregar producto" : "+ Add item"}
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {selected.menu.map((m, i) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3">
                <input
                  value={m.name}
                  placeholder={lang === "es" ? "Nombre del producto" : "Item name"}
                  onChange={(e) => {
                    const menu = [...selected.menu!];
                    menu[i] = { ...m, name: e.target.value };
                    update({ menu });
                  }}
                  className="min-w-40 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  value={m.description ?? ""}
                  placeholder={lang === "es" ? "Descripción breve (qué hace / qué incluye)…" : "Short description…"}
                  onChange={(e) => {
                    const menu = [...selected.menu!];
                    menu[i] = { ...m, description: e.target.value };
                    update({ menu });
                  }}
                  className="min-w-52 flex-[2] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500">$</span>
                  <input
                    type="number"
                    value={m.price}
                    onChange={(e) => {
                      const menu = [...selected.menu!];
                      menu[i] = { ...m, price: Number(e.target.value) };
                      update({ menu });
                    }}
                    className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    title={lang === "es" ? "Precio" : "Price"}
                  />
                </div>
                <button
                  onClick={() => {
                    const menu = [...selected.menu!];
                    menu[i] = { ...m, available: !m.available };
                    update({ menu });
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                    m.available
                      ? "border-emerald-500/40 text-emerald-300"
                      : "border-slate-600 text-slate-500"
                  }`}
                  title={lang === "es" ? "Alternar disponibilidad — productos agotados no se aceptan en llamadas" : "Toggle availability — 86'd items are refused on calls"}
                >
                  {m.available ? (lang === "es" ? "Disponible" : "available") : (lang === "es" ? "Agotado" : "86'd")}
                </button>
                <button
                  className="text-slate-500 hover:text-red-400"
                  onClick={() =>
                    update({ menu: selected.menu!.filter((x) => x.id !== m.id) })
                  }
                  title={lang === "es" ? "Eliminar producto" : "Remove"}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{lang === "es" ? "Preguntas frecuentes (FAQs)" : "FAQs"}</h2>
          <button
            className="text-sm text-brand-400 hover:underline"
            onClick={() =>
              update({
                faqs: [
                  ...selected.faqs,
                  { id: `f_${Date.now()}`, question: lang === "es" ? "¿Nueva pregunta?" : "New question?", answer: "" },
                ],
              })
            }
          >
            {lang === "es" ? "+ Agregar pregunta" : "+ Add FAQ"}
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {selected.faqs.map((f, i) => (
            <div key={f.id} className="rounded-xl border border-slate-800 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <input
                    value={f.question}
                    placeholder={lang === "es" ? "¿Pregunta del cliente?" : "Question"}
                    onChange={(e) => {
                      const faqs = [...selected.faqs];
                      faqs[i] = { ...f, question: e.target.value };
                      update({ faqs });
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium"
                  />
                  <textarea
                    value={f.answer}
                    placeholder={lang === "es" ? "Respuesta que dará la recepcionista…" : "Answer..."}
                    rows={2}
                    onChange={(e) => {
                      const faqs = [...selected.faqs];
                      faqs[i] = { ...f, answer: e.target.value };
                      update({ faqs });
                    }}
                    className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300"
                  />
                </div>
                <button
                  className="text-slate-500 hover:text-red-400"
                  onClick={() =>
                    update({ faqs: selected.faqs.filter((x) => x.id !== f.id) })
                  }
                  title={lang === "es" ? "Eliminar pregunta" : "Remove"}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-6 border-amber-500/30">
        <h2 className="font-semibold">📢 {lang === "es" ? "Difusión y Aviso de emergencia" : "Emergency broadcast"}</h2>
        <p className="mt-1 text-xs text-slate-400">
          {lang === "es"
            ? "Envía un mensaje SMS a todos los clientes que tienen cita hoy o mañana — avisos de cierre, retrasos, imprevistos. Un mensaje por cliente."
            : "Text everyone with an appointment today — closures, delays, weather. One message per customer."}
        </p>
        <BroadcastForm businessId={selected.id} lang={lang} />
      </div>

      <div className="card mt-6 border-brand-500/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">🧠 {lang === "es" ? "Preguntas que faltan en tu base de conocimiento" : "FAQs AIVA thinks you're missing"}</h2>
            <p className="mt-1 text-xs text-slate-400">
              {lang === "es"
                ? "Detectadas a partir de llamadas reales donde los clientes hicieron preguntas que aún no están registradas. Acéptalas para añadirlas."
                : "Mined from real calls it couldn't fully answer. Accept to add — then edit any [FILL IN] placeholders above."}
            </p>
          </div>
          <button
            onClick={fetchSuggestions}
            disabled={suggesting}
            className="btn-secondary !px-4 !py-2 text-sm disabled:opacity-50"
          >
            {suggesting
              ? (lang === "es" ? "Analizando historial…" : "Mining call history…")
              : (lang === "es" ? "Detectar preguntas faltantes" : "Find knowledge gaps")}
          </button>
        </div>
        {suggestNote && <p className="mt-3 text-sm text-slate-400">{suggestNote}</p>}
        {suggestions.length > 0 && (
          <div className="mt-4 space-y-3">
            {suggestions.map((s) => (
              <div key={s.question} className="animate-fade-up rounded-xl border border-slate-800 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{s.question}</div>
                    <p className="mt-1 text-sm text-slate-400">{s.draft_answer}</p>
                    <p className="mt-2 text-xs text-slate-600">↳ {s.evidence}</p>
                  </div>
                  <button
                    onClick={() => acceptSuggestion(s)}
                    className="btn-primary shrink-0 !px-3 !py-1.5 text-xs"
                  >
                    {lang === "es" ? "+ Aceptar" : "+ Accept"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-4 mt-6 flex items-center justify-end gap-3">
        {savedAt && Date.now() - savedAt < 4000 && (
          <span className="text-sm text-emerald-400">{lang === "es" ? "Guardado ✓" : "Saved ✓"}</span>
        )}
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving
            ? (lang === "es" ? "Guardando…" : "Saving…")
            : (lang === "es" ? "Guardar cambios" : "Save changes")}
        </button>
      </div>
    </div>
  );
}

function BroadcastForm({ businessId, lang }: { businessId: string; lang: "es" | "en" }) {
  const [message, setMessage] = useState("");
  const [scope, setScope] = useState<"today" | "tomorrow" | "both">("today");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    if (!message.trim() || busy) return;
    const confirmPrompt =
      lang === "es"
        ? `¿Enviar SMS a todos los clientes con cita (${scope === "today" ? "hoy" : scope === "tomorrow" ? "mañana" : "ambos días"})?`
        : `Text every customer with an appointment (${scope})?`;
    if (!confirm(confirmPrompt)) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, message, scope }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setResult(
        lang === "es"
          ? `Se encontraron ${data.matched} cliente(s), se enviaron ${data.sent} SMS${data.sent === 0 ? " (¿Twilio no configurado?)" : ""}.`
          : `Matched ${data.matched} customer${data.matched === 1 ? "" : "s"}, sent ${data.sent} SMS${data.sent === 0 ? " (Twilio not configured?)" : ""}.`
      );
      setMessage("");
    } catch (e) {
      setResult(e instanceof Error ? e.message : (lang === "es" ? "Error al enviar difusión" : "Broadcast failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={lang === "es" ? "Ej: Hoy cerramos a las 2 PM por mantenimiento eléctrico." : "We're closing at 2 PM today due to a power outage."}
        className="min-w-64 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
      />
      <select
        value={scope}
        onChange={(e) => setScope(e.target.value as typeof scope)}
        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
      >
        <option value="today">{lang === "es" ? "Citas de hoy" : "Today's appointments"}</option>
        <option value="tomorrow">{lang === "es" ? "Citas de mañana" : "Tomorrow's"}</option>
        <option value="both">{lang === "es" ? "Ambos días" : "Both days"}</option>
      </select>
      <button
        onClick={send}
        disabled={busy || !message.trim()}
        className="btn-secondary !border-amber-500/40 !px-4 !py-2 text-sm !text-amber-300 disabled:opacity-40"
      >
        {busy ? (lang === "es" ? "Enviando…" : "Sending…") : (lang === "es" ? "Enviar aviso" : "Send broadcast")}
      </button>
      {result && <p className="w-full text-xs text-slate-400">{result}</p>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
      />
    </label>
  );
}
