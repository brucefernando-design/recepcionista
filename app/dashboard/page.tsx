"use client";

import Link from "next/link";
import { useDashboardData } from "@/lib/useDashboardData";
import { useLanguage } from "@/components/LanguageContext";

const OUTCOME_LABELS: Record<string, { es: string; en: string }> = {
  appointment_booked: { es: "Cita agendada", en: "Appointment booked" },
  order_taken: { es: "Pedido tomado", en: "Order taken" },
  faq_answered: { es: "FAQ respondida", en: "FAQ answered" },
  transferred: { es: "Transferida", en: "Transferred" },
  in_progress: { es: "En curso", en: "In progress" },
  missed: { es: "Perdida", en: "Missed" },
};

export default function DashboardOverview() {
  const { data } = useDashboardData();
  const { lang } = useLanguage();

  const stats = [
    {
      label: lang === "es" ? "Llamadas totales" : "Total calls",
      value: data?.calls.length ?? "—",
      href: "/dashboard/calls",
      icon: "📞",
    },
    {
      label: lang === "es" ? "Citas agendadas" : "Appointments",
      value: data?.appointments.length ?? "—",
      href: "/dashboard/appointments",
      icon: "📅",
    },
    {
      label: lang === "es" ? "Pedidos recibidos" : "Orders",
      value: data?.orders.length ?? "—",
      href: "/dashboard/orders",
      icon: "🍽️",
    },
    {
      label: lang === "es" ? "Ingresos (pedidos)" : "Revenue (orders)",
      value: data ? `$${data.orders.reduce((s, o) => s + o.total, 0).toFixed(2)}` : "—",
      href: "/dashboard/orders",
      icon: "💰",
    },
  ];

  const today = new Date().toISOString().slice(0, 10);
  const todaysAppts = (data?.appointments ?? [])
    .filter((a) => a.date === today && a.status === "confirmed")
    .sort((a, b) => a.time.localeCompare(b.time));

  const recentCalls = (data?.calls ?? [])
    .slice()
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 5);

  const dayAgo = Date.now() - 86400_000;
  const needsAttention = (data?.calls ?? []).filter(
    (c) =>
      new Date(c.startedAt).getTime() > dayAgo &&
      (c.sentiment === "negative" || c.resolved === false)
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">{lang === "es" ? "Resumen General" : "Overview"}</h1>
      <p className="mt-1 text-sm text-slate-400">
        {lang === "es"
          ? "Actividad en tiempo real de tus líneas telefónicas con AIVA. Prueba la "
          : "Live activity across your AIVA lines. Try the "}
        <Link href="/demo" className="text-brand-400 hover:underline">
          {lang === "es" ? "demo en vivo" : "demo"}
        </Link>
        {lang === "es"
          ? " y observa cómo se registran las llamadas aquí."
          : " and watch bookings appear here."}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card !p-5 transition hover:border-brand-500/50">
            <div className="text-2xl">{s.icon}</div>
            <div className="mt-3 text-2xl font-bold">{s.value}</div>
            <div className="mt-1 text-xs text-slate-400">{s.label}</div>
          </Link>
        ))}
      </div>

      {needsAttention.length > 0 && (
        <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-5">
          <h2 className="flex items-center gap-2 font-semibold text-red-300">
            ⚠️ {lang === "es" ? "Requiere atención" : "Needs attention"}
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs">
              {needsAttention.length}
            </span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {lang === "es"
              ? "Llamadas no resueltas o clientes insatisfechos en las últimas 24 horas."
              : "Unhappy or unresolved callers in the last 24 hours."}
          </p>
          <ul className="mt-3 space-y-2">
            {needsAttention.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-start gap-3 text-sm">
                <span>{c.sentiment === "negative" ? "😠" : "⚠️"}</span>
                <div className="min-w-0">
                  <span className="text-slate-300">{c.summary ?? c.callerPhone}</span>
                  <span className="ml-2 text-xs text-slate-500">{c.callerPhone}</span>
                </div>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/calls"
            className="mt-3 inline-block text-xs text-red-300 hover:underline"
          >
            {lang === "es" ? "Revisar todas las llamadas →" : "Review all calls →"}
          </Link>
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold">{lang === "es" ? "Agenda de hoy" : "Today's schedule"}</h2>
      <div className="mt-4">
        {todaysAppts.length === 0 ? (
          <div className="card text-sm text-slate-400">
            {lang === "es" ? "No hay citas programadas para hoy" : "No appointments today"}
            {data ? "" : "…"}
          </div>
        ) : (
          <div className="card !p-4">
            <ol className="space-y-2 text-sm">
              {todaysAppts.map((a) => (
                <li key={a.id} className="flex items-center gap-4">
                  <span className="w-14 shrink-0 font-mono text-brand-300">{a.time}</span>
                  <span className="font-medium">{a.customerName}</span>
                  <span className="text-slate-400">· {a.serviceName}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <h2 className="mt-10 text-lg font-semibold">{lang === "es" ? "Llamadas recientes" : "Recent calls"}</h2>
      <div className="mt-4 space-y-3">
        {recentCalls.length === 0 && (
          <div className="card text-sm text-slate-400">
            {lang === "es"
              ? "Aún no hay llamadas registradas. Puedes probar la demo o llamar al número de Twilio configurado."
              : "No calls yet. Point a Twilio number at AIVA, or use the web demo to simulate a conversation."}
          </div>
        )}
        {recentCalls.map((c) => {
          const outcomeText = OUTCOME_LABELS[c.outcome]?.[lang] ?? c.outcome.replace(/_/g, " ");
          return (
            <Link key={c.id} href="/dashboard/calls" className="card flex items-center justify-between !p-4 transition hover:border-brand-500/50">
              <div>
                <div className="text-sm font-medium">{c.callerPhone}</div>
                <div className="text-xs text-slate-400">
                  {new Date(c.startedAt).toLocaleString(lang === "es" ? "es-MX" : "en-US")}
                </div>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                {outcomeText}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
