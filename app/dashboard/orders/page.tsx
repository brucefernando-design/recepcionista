"use client";

import { useState } from "react";
import { useDashboardData } from "@/lib/useDashboardData";
import type { Order } from "@/lib/types";
import { useLanguage } from "@/components/LanguageContext";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  confirmed: "bg-sky-500/15 text-sky-300",
  ready: "bg-emerald-500/15 text-emerald-300",
  completed: "bg-slate-500/15 text-slate-300",
  cancelled: "bg-red-500/15 text-red-300",
};

const STATUS_LABELS: Record<string, { es: string; en: string }> = {
  pending: { es: "Pendiente", en: "Pending" },
  confirmed: { es: "Confirmado", en: "Confirmed" },
  ready: { es: "Listo", en: "Ready" },
  completed: { es: "Completado", en: "Completed" },
  cancelled: { es: "Cancelado", en: "Cancelled" },
};

const ORDER_TYPES: Record<string, { es: string; en: string }> = {
  pickup: { es: "Para recoger", en: "Pickup" },
  delivery: { es: "A domicilio", en: "Delivery" },
  dine_in: { es: "En el local", en: "Dine-in" },
};

const NEXT_STATUS: Partial<Record<Order["status"], Order["status"]>> = {
  pending: "confirmed",
  confirmed: "ready",
  ready: "completed",
};

export default function OrdersPage() {
  const { data } = useDashboardData();
  const { lang } = useLanguage();
  const [overrides, setOverrides] = useState<Record<string, Order["status"]>>({});

  async function advance(o: Order) {
    const next = NEXT_STATUS[o.status];
    if (!next) return;
    setOverrides((ov) => ({ ...ov, [o.id]: next }));
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: o.id, status: next }),
    });
  }

  function exportCsv() {
    const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
    const rows = [
      ["created", "customer", "phone", "items", "total", "type", "status"],
      ...orders.map((o) => [
        o.createdAt,
        o.customerName,
        o.customerPhone,
        o.items.map((i) => `${i.quantity}x ${i.name}`).join("; "),
        o.total.toFixed(2),
        o.type,
        o.status,
      ]),
    ];
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `aiva-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const orders = (data?.orders ?? [])
    .map((o) => (overrides[o.id] ? { ...o, status: overrides[o.id] } : o))
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{lang === "es" ? "Pedidos y Órdenes" : "Orders"}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {lang === "es" ? "Pedidos tomados por AIVA durante las llamadas telefónicas." : "Phone orders captured by AIVA, item by item."}
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={orders.length === 0}
          className="btn-secondary !px-4 !py-2 text-sm disabled:opacity-40"
        >
          {lang === "es" ? "⬇ Exportar CSV" : "⬇ Export CSV"}
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {orders.length === 0 && (
          <div className="card text-sm text-slate-400">
            {lang === "es"
              ? "No hay pedidos aún — puedes llamar a la demo o simular un pedido."
              : "No orders yet — call the restaurant demo and order a pizza!"}
          </div>
        )}
        {orders.map((o) => {
          const typeText = ORDER_TYPES[o.type]?.[lang] ?? o.type;
          const statusText = STATUS_LABELS[o.status]?.[lang] ?? o.status;
          const nextStatusKey = NEXT_STATUS[o.status];
          const nextStatusLabel = nextStatusKey ? (STATUS_LABELS[nextStatusKey]?.[lang] ?? nextStatusKey) : "";

          return (
            <div key={o.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{o.customerName}</div>
                  <div className="text-xs text-slate-400">
                    {new Date(o.createdAt).toLocaleString(lang === "es" ? "es-MX" : "en-US")} · {typeText}
                    {o.address ? ` · ${o.address}` : ""}
                    {o.estimatedReadyAt && o.status === "confirmed" && (
                      <span className="text-amber-300">
                        {" "}· {lang === "es" ? "listo aprox ~" : "ready ~"}
                        {new Date(o.estimatedReadyAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold">${o.total.toFixed(2)}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      STATUS_COLORS[o.status] ?? ""
                    }`}
                  >
                    {statusText}
                  </span>
                  {nextStatusKey && (
                    <button
                      onClick={() => advance(o)}
                      className="rounded-lg border border-brand-500/40 px-2.5 py-1 text-xs text-brand-300 transition hover:bg-brand-500/15"
                    >
                      → {nextStatusLabel}
                    </button>
                  )}
                </div>
              </div>
              <ul className="mt-4 space-y-1 border-t border-slate-800 pt-3 text-sm text-slate-300">
                {o.items.map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span>
                      {it.quantity}× {it.name}
                      {it.notes ? (
                        <span className="text-slate-500"> — {it.notes}</span>
                      ) : null}
                    </span>
                    <span className="text-slate-400">
                      ${(it.price * it.quantity).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
