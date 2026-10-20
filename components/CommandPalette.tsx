"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "./LanguageContext";

const COMMANDS: { es: string; en: string; href: string; icon: string }[] = [
  { es: "Resumen general", en: "Overview", href: "/dashboard", icon: "📊" },
  { es: "Llamadas", en: "Calls", href: "/dashboard/calls", icon: "📞" },
  { es: "Citas", en: "Appointments", href: "/dashboard/appointments", icon: "📅" },
  { es: "Pedidos", en: "Orders", href: "/dashboard/orders", icon: "🍽️" },
  { es: "Tareas y seguimientos", en: "Action items", href: "/dashboard/tasks", icon: "✅" },
  { es: "Analíticas", en: "Analytics", href: "/dashboard/analytics", icon: "📈" },
  { es: "Editor de conocimiento", en: "Knowledge editor", href: "/dashboard/settings", icon: "🧠" },
  { es: "Probar la demo", en: "Try the demo", href: "/demo", icon: "🎙️" },
  { es: "Agregar un negocio", en: "Add a business", href: "/onboard", icon: "✨" },
];

export default function CommandPalette() {
  const router = useRouter();
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  const matches = COMMANDS.filter((c) => {
    const label = c[lang] ?? c.en;
    return label.toLowerCase().includes(query.toLowerCase());
  });

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 pt-32 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) go(matches[0].href);
          }}
          placeholder={lang === "es" ? "Ir a…" : "Jump to…"}
          className="w-full border-b border-slate-800 bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ul className="max-h-72 overflow-y-auto p-2">
          {matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">
              {lang === "es" ? "Sin resultados" : "No matches"}
            </li>
          )}
          {matches.map((c) => (
            <li key={c.href}>
              <button
                onClick={() => go(c.href)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/5"
              >
                <span>{c.icon}</span>
                {c[lang] ?? c.en}
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-800 px-4 py-2 text-[11px] text-slate-600">
          {lang === "es"
            ? "⌘K / Ctrl-K para abrir · Enter para seleccionar · Esc para cerrar"
            : "⌘K / Ctrl-K to toggle · Enter to open · Esc to close"}
        </div>
      </div>
    </div>
  );
}
