"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import LanguageToggle from "./LanguageToggle";
import { useLanguage } from "./LanguageContext";
import { useAuth } from "./AuthContext";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { lang } = useLanguage();
  const { user, business, logout } = useAuth();

  const links: [string, string][] = [
    ["/#features", lang === "es" ? "Características" : "Features"],
    ["/#industries", lang === "es" ? "Industrias" : "Industries"],
    ["/dashboard", lang === "es" ? "Panel de control" : "Dashboard"],
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "glass shadow-[0_10px_40px_-20px_rgba(0,0,0,0.8)]" : ""
      }`}
    >
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5 text-xl font-bold">
          <span className="transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105">
            <Logo />
          </span>
          <span className="font-display tracking-tight">AIVA</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="relative py-1 transition-colors hover:text-white after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-gradient-to-r after:from-brand-400 after:to-purple-400 after:transition-transform after:duration-300 hover:after:scale-x-100"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <LanguageToggle />
          <ThemeToggle />
          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-300 transition hover:bg-brand-500/20"
              >
                <span>👤</span>
                <span className="max-w-[120px] truncate">{business?.name || user.name}</span>
              </Link>
              <button
                onClick={() => logout()}
                className="rounded-xl border border-slate-700/80 px-2.5 py-1.5 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white"
                title={lang === "es" ? "Cerrar sesión" : "Log out"}
              >
                {lang === "es" ? "Salir" : "Exit"}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-xl border border-slate-700/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white md:inline-flex"
            >
              {lang === "es" ? "Iniciar sesión" : "Log in"}
            </Link>
          )}
          <Link href="/demo" className="btn-primary !px-4 !py-2 text-sm">
            {lang === "es" ? "Probar demo" : "Try the demo"}
          </Link>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/80 text-lg md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* mobile menu */}
      {open && (
        <nav className="glass animate-fade-up border-t border-white/5 px-6 py-4 md:hidden">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              {label}
            </Link>
          ))}
          <div className="mt-2 border-t border-white/5 pt-2">
            {user ? (
              <button
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="block w-full text-left rounded-lg px-3 py-2.5 text-sm text-red-400 transition hover:bg-white/5"
              >
                {lang === "es" ? "Cerrar sesión" : "Log out"}
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm text-brand-300 font-medium transition hover:bg-white/5"
              >
                {lang === "es" ? "Iniciar sesión / Registrarse" : "Log in / Register"}
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
