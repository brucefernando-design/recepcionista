"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "es" | "en";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (dict: { en: string; es: string }) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "es",
  setLang: () => {},
  toggleLang: () => {},
  t: (dict) => dict.es,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("es");

  useEffect(() => {
    const saved = localStorage.getItem("aiva.lang") as Language | null;
    if (saved === "es" || saved === "en") {
      setLangState(saved);
      document.documentElement.lang = saved;
    } else {
      setLangState("es");
      document.documentElement.lang = "es";
    }
  }, []);

  function setLang(newLang: Language) {
    setLangState(newLang);
    localStorage.setItem("aiva.lang", newLang);
    document.documentElement.lang = newLang;
  }

  function toggleLang() {
    const next: Language = lang === "es" ? "en" : "es";
    setLang(next);
  }

  function t(dict: { en: string; es: string }): string {
    return dict[lang] ?? dict.en;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
