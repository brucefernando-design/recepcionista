"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Business } from "@/lib/types";

export interface User {
  id: string;
  email: string;
  name: string;
  businessId: string;
  role?: string;
}

interface AuthState {
  user: User | null;
  business: Business | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ ok: boolean; error?: string }>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    businessName: string;
    businessType: Business["type"];
    businessPhone?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  business: null,
  loading: true,
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
        setBusiness(data.business || null);
      } else {
        setUser(null);
        setBusiness(null);
      }
    } catch {
      setUser(null);
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  async function login(email: string, pass: string) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || "Error al iniciar sesión" };
      }
      setUser(data.user);
      setBusiness(data.business);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || "Error de conexión" };
    }
  }

  async function register(formData: {
    email: string;
    password: string;
    name: string;
    businessName: string;
    businessType: Business["type"];
    businessPhone?: string;
  }) {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || "Error al registrarse" };
      }
      setUser(data.user);
      setBusiness(data.business);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || "Error de conexión" };
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
    setBusiness(null);
    window.location.href = "/";
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        business,
        loading,
        login,
        register,
        logout,
        refresh: checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
