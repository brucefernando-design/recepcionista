"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ActionItem } from "@/lib/types";
import { useLanguage } from "./LanguageContext";

const NAV = [
  { href: "/dashboard", en: "Overview", es: "Resumen", icon: "📊" },
  { href: "/dashboard/calls", en: "Calls", es: "Llamadas", icon: "📞" },
  { href: "/dashboard/appointments", en: "Appointments", es: "Citas", icon: "📅" },
  { href: "/dashboard/orders", en: "Orders", es: "Pedidos", icon: "🍽️" },
  { href: "/dashboard/tasks", en: "Action items", es: "Tareas", icon: "✅" },
  { href: "/dashboard/day-sheet", en: "Day sheet", es: "Agenda del día", icon: "🖨" },
  { href: "/dashboard/analytics", en: "Analytics", es: "Analíticas", icon: "📈" },
  { href: "/dashboard/settings", en: "Knowledge", es: "Conocimiento", icon: "🧠" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [openTasks, setOpenTasks] = useState(0);
  const { lang } = useLanguage();

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const tasks: ActionItem[] = await fetch("/api/tasks").then((r) => r.json());
        if (active) setOpenTasks(tasks.filter((t) => !t.done).length);
      } catch {}
    }
    poll();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, 10_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  return (
    <nav className="sticky top-24 space-y-1">
      {NAV.map((item) => {
        const active = pathname === item.href;
        const label = item[lang] ?? item.en;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all duration-200 ${
              active
                ? "bg-brand-500/15 font-semibold text-brand-300 shadow-sm shadow-brand-500/10 ring-1 ring-brand-500/30"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            <span className="text-base transition-transform duration-200 group-hover:scale-110">
              {item.icon}
            </span>
            <span className="flex-1">{label}</span>
            {item.href === "/dashboard/tasks" && openTasks > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500/20 px-1.5 text-xs font-semibold text-brand-300">
                {openTasks}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
