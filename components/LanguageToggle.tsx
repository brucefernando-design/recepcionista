"use client";

import { useLanguage } from "./LanguageContext";

export default function LanguageToggle() {
  const { lang, toggleLang } = useLanguage();

  return (
    <button
      onClick={toggleLang}
      aria-label="Cambiar idioma / Switch language"
      title={lang === "es" ? "Cambiar a Inglés (EN)" : "Cambiar a Español (ES)"}
      className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-700/80 px-3 text-xs font-semibold text-slate-300 transition hover:border-brand-500 hover:text-white"
    >
      <span className="text-base">{lang === "es" ? "🇪🇸" : "🇺🇸"}</span>
      <span>{lang === "es" ? "ES" : "EN"}</span>
    </button>
  );
}
