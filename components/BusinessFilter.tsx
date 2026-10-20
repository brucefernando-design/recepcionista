"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Business } from "@/lib/types";
import { useAuth } from "./AuthContext";

interface FilterState {
  businessId: string | null; // null = all businesses
  businesses: Business[];
  setBusinessId: (id: string | null) => void;
}

const Ctx = createContext<FilterState>({
  businessId: null,
  businesses: [],
  setBusinessId: () => {},
});

export function useBusinessFilter() {
  return useContext(Ctx);
}

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [businessId, setBusinessIdState] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  useEffect(() => {
    fetch("/api/businesses")
      .then((r) => r.json())
      .then((list) => {
        setBusinesses(list);
        if (user?.businessId) {
          setBusinessIdState(user.businessId);
        } else {
          const saved = localStorage.getItem("aiva.businessFilter");
          if (saved) setBusinessIdState(saved === "all" ? null : saved);
        }
      })
      .catch(() => {});
  }, [user]);

  function setBusinessId(id: string | null) {
    setBusinessIdState(id);
    localStorage.setItem("aiva.businessFilter", id ?? "all");
  }

  return (
    <Ctx.Provider value={{ businessId, businesses, setBusinessId }}>
      {children}
    </Ctx.Provider>
  );
}

export function BusinessSelect() {
  const { user, business } = useAuth();
  const { businessId, businesses, setBusinessId } = useBusinessFilter();

  if (user && business) {
    return (
      <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-3.5 py-2.5 text-xs">
        <div className="font-semibold text-brand-300 truncate">{business.name}</div>
        <div className="text-[11px] text-slate-400 capitalize">{business.type}</div>
      </div>
    );
  }

  return (
    <select
      value={businessId ?? "all"}
      onChange={(e) =>
        setBusinessId(e.target.value === "all" ? null : e.target.value)
      }
      className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm outline-none transition focus:border-brand-500"
      title="Filter dashboard by business"
    >
      <option value="all">Todos los negocios</option>
      {businesses.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
