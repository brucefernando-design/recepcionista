"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { useAuth } from "@/components/AuthContext";
import { useLanguage } from "@/components/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import type { BusinessType } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { lang } = useLanguage();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("clinic");
  const [businessPhone, setBusinessPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(
        lang === "es"
          ? "La contraseña debe tener al menos 6 caracteres."
          : "Password must be at least 6 characters."
      );
      return;
    }

    setLoading(true);

    const res = await register({
      name,
      email,
      password,
      businessName,
      businessType,
      businessPhone,
    });

    setLoading(false);

    if (res.ok) {
      router.push("/dashboard");
    } else {
      setError(
        res.error ||
          (lang === "es"
            ? "Ocurrió un error al registrarse. Intenta nuevamente."
            : "Registration failed. Please try again.")
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="absolute right-6 top-6">
        <LanguageToggle />
      </div>

      <div className="card w-full max-w-lg p-8 shadow-2xl">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 text-2xl font-bold">
            <Logo size={32} />
            <span className="font-display tracking-tight">AIVA</span>
          </Link>
          <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-white">
            {lang === "es" ? "Crea tu cuenta de recepcionista" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {lang === "es"
              ? "Cada negocio cuenta con su propio panel privado y recepcionista IA"
              : "Set up your independent business dashboard and AI receptionist"}
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                {lang === "es" ? "Tu nombre" : "Your name"}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Carlos Pérez"
                className="mt-1.5 w-full rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-2.5 text-sm text-white outline-none transition focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                {lang === "es" ? "Correo electrónico" : "Email"}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="carlos@minegocio.com"
                className="mt-1.5 w-full rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-2.5 text-sm text-white outline-none transition focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              {lang === "es" ? "Contraseña" : "Password"}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-2.5 text-sm text-white outline-none transition focus:border-brand-500"
            />
          </div>

          <div className="border-t border-slate-800/80 pt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-400">
              {lang === "es" ? "Datos de tu negocio" : "Business Information"}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                {lang === "es" ? "Nombre del negocio" : "Business name"}
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Clínica Dental Sonrisas"
                className="mt-1.5 w-full rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-2.5 text-sm text-white outline-none transition focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                {lang === "es" ? "Tipo de negocio" : "Industry / Type"}
              </label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                className="mt-1.5 w-full rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-2.5 text-sm text-white outline-none transition focus:border-brand-500"
              >
                <option value="clinic">{lang === "es" ? "Clínica / Salud" : "Clinic / Health"}</option>
                <option value="salon">{lang === "es" ? "Salón / Spa / Barbería" : "Salon / Spa / Barber"}</option>
                <option value="restaurant">{lang === "es" ? "Restaurante / Cafetería" : "Restaurant / Cafe"}</option>
                <option value="hotel">{lang === "es" ? "Hotel / Alojamiento" : "Hotel / Hospitality"}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              {lang === "es" ? "Teléfono de contacto" : "Phone number"}
            </label>
            <input
              type="tel"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              placeholder="+52 55 1234 5678"
              className="mt-1.5 w-full rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-2.5 text-sm text-white outline-none transition focus:border-brand-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-3 w-full !py-3 text-sm font-semibold disabled:opacity-50"
          >
            {loading
              ? lang === "es"
                ? "Creando cuenta..."
                : "Creating..."
              : lang === "es"
              ? "Crear mi cuenta y acceder"
              : "Register and Access Dashboard"}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-800 pt-5 text-center text-sm text-slate-400">
          {lang === "es" ? "¿Ya tienes una cuenta? " : "Already have an account? "}
          <Link href="/login" className="font-medium text-brand-400 transition hover:text-brand-300">
            {lang === "es" ? "Iniciar sesión" : "Sign In"}
          </Link>
        </div>

        <div className="mt-3 text-center">
          <Link href="/" className="text-xs text-slate-500 transition hover:text-slate-400">
            ← {lang === "es" ? "Volver al inicio" : "Back to home"}
          </Link>
        </div>
      </div>
    </div>
  );
}
