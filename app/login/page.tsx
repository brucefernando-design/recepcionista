"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { useAuth } from "@/components/AuthContext";
import { useLanguage } from "@/components/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { lang } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await login(email, password);
    setLoading(false);

    if (res.ok) {
      router.push("/dashboard");
    } else {
      setError(
        res.error ||
          (lang === "es"
            ? "Credenciales incorrectas. Intenta nuevamente."
            : "Invalid credentials. Please try again.")
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="absolute right-6 top-6">
        <LanguageToggle />
      </div>

      <div className="card w-full max-w-md p-8 shadow-2xl">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 text-2xl font-bold">
            <Logo size={32} />
            <span className="font-display tracking-tight">AIVA</span>
          </Link>
          <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-white">
            {lang === "es" ? "Iniciar sesión" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {lang === "es"
              ? "Accede al panel de control de tu recepcionista"
              : "Sign in to manage your AI receptionist"}
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              {lang === "es" ? "Correo electrónico" : "Email address"}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="mt-1.5 w-full rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-2.5 text-sm text-white outline-none transition focus:border-brand-500"
            />
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

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-2 w-full !py-3 text-sm font-semibold disabled:opacity-50"
          >
            {loading
              ? lang === "es"
                ? "Entrando..."
                : "Signing in..."
              : lang === "es"
              ? "Entrar al panel"
              : "Sign In"}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-800 pt-5 text-center text-sm text-slate-400">
          {lang === "es" ? "¿Aún no tienes cuenta? " : "Don't have an account? "}
          <Link href="/register" className="font-medium text-brand-400 transition hover:text-brand-300">
            {lang === "es" ? "Crear cuenta" : "Register here"}
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
