"use client";

import Link from "next/link";
import Logo from "./Logo";
import { useLanguage } from "./LanguageContext";

export default function Footer() {
  const { lang } = useLanguage();

  const columns = [
    {
      title: lang === "es" ? "Producto" : "Product",
      links: [
        ["/#features", lang === "es" ? "Características" : "Features"],
        ["/#industries", lang === "es" ? "Industrias" : "Industries"],
        ["/demo", lang === "es" ? "Demo interactiva" : "Live demo"],
        ["/onboard", lang === "es" ? "Configuración con IA" : "AI onboarding"],
      ],
    },
    {
      title: lang === "es" ? "Industrias" : "Industries",
      links: [
        ["/#industries", lang === "es" ? "Clínicas" : "Clinics"],
        ["/#industries", lang === "es" ? "Salones y Spas" : "Salons"],
        ["/#industries", lang === "es" ? "Restaurantes" : "Restaurants"],
        ["/#industries", lang === "es" ? "Hoteles" : "Hotels"],
      ],
    },
    {
      title: lang === "es" ? "Recursos" : "Resources",
      links: [
        ["/dashboard", lang === "es" ? "Panel de control" : "Dashboard"],
        ["/dashboard/analytics", lang === "es" ? "Analíticas" : "Analytics"],
        ["/#faq", "FAQ"],
      ],
    },
  ];

  return (
    <footer className="border-t border-white/5 bg-black/20">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5 text-xl font-bold">
            <Logo size={28} />
            <span className="font-display tracking-tight">AIVA</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
            {lang === "es"
              ? "La recepcionista con IA que atiende todas tus llamadas, en cualquier idioma, las 24 horas del día."
              : "The AI receptionist that answers every call, in every language, around the clock."}
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-slate-200">{col.title}</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              {col.links.map(([href, label], i) => (
                <li key={`${href}-${i}`}>
                  {href.startsWith("http") ? (
                    <a href={href} target="_blank" rel="noreferrer" className="transition hover:text-white">
                      {label}
                    </a>
                  ) : (
                    <Link href={href} className="transition hover:text-white">
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5 py-6">
        <p className="container-page text-center text-xs text-slate-500">
          © {new Date().getFullYear()} AIVA. {lang === "es" ? "Todos los derechos reservados." : "All rights reserved."}
        </p>
      </div>
    </footer>
  );
}
