"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { useAuth } from "@/components/AuthContext";
import { useLanguage } from "@/components/LanguageContext";
import type { TenantInfo } from "@/lib/db";

interface AdminStats {
  totalBusinesses: number;
  totalCalls: number;
  totalAppointments: number;
  totalOrders: number;
  tenants: TenantInfo[];
  recentCalls: any[];
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { lang } = useLanguage();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tenants" | "calls" | "create">("tenants");
  const [filter, setFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<any | null>(null);

  // New business form state
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newBizName, setNewBizName] = useState("");
  const [newBizType, setNewBizType] = useState<"clinic" | "salon" | "restaurant" | "hotel">("clinic");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Twilio modal state
  const [editingTwilioBiz, setEditingTwilioBiz] = useState<TenantInfo | null>(null);
  const [twilioPhone, setTwilioPhone] = useState("");
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [savingTwilio, setSavingTwilio] = useState(false);
  const [twilioMsg, setTwilioMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function openTwilioModal(t: TenantInfo) {
    setEditingTwilioBiz(t);
    setBusinessPhone(t.business.phone || "");
    setTwilioPhone(t.business.twilioPhone || t.business.phone || "");
    setTwilioSid(t.business.twilioSid || "");
    setTwilioToken(t.business.twilioToken || "");
    setStaffPhone(t.business.staffPhone || "");
    setTwilioMsg(null);
  }

  async function handleSaveTwilio(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTwilioBiz) return;
    setSavingTwilio(true);
    setTwilioMsg(null);
    try {
      const res = await fetch(`/api/admin/business/${editingTwilioBiz.business.id}/twilio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: businessPhone,
          twilioPhone,
          twilioSid,
          twilioToken,
          staffPhone,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTwilioMsg({ type: "success", text: "¡Twilio configurado con éxito para este negocio!" });
        await loadStats();
        setTimeout(() => setEditingTwilioBiz(null), 1200);
      } else {
        setTwilioMsg({ type: "error", text: data.error || "Error al guardar Twilio" });
      }
    } catch (err: any) {
      setTwilioMsg({ type: "error", text: err.message || "Error al conectar" });
    }
    setSavingTwilio(false);
  }

  const isSuper =
    user?.email?.toLowerCase().trim() === "bruce.fernando@hotmail.com" ||
    user?.role === "superadmin";

  useEffect(() => {
    if (!authLoading && (!user || !isSuper)) {
      router.push("/login");
      return;
    }

    if (isSuper) {
      loadStats();
    }
  }, [user, authLoading, isSuper, router]);

  async function loadStats() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/overview");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {}
    setLoading(false);
  }

  async function handleDelete(userId: string, businessId: string, name: string) {
    if (!confirm(`¿Estás seguro de eliminar el negocio "${name}" y todos sus datos?`)) return;
    setDeletingId(userId);
    try {
      const res = await fetch(`/api/admin/tenant/${userId}?businessId=${businessId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadStats();
      }
    } catch {}
    setDeletingId(null);
  }

  async function handleCreateTenant(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateMsg(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newOwnerName,
          email: newEmail,
          password: newPassword,
          businessName: newBizName,
          businessType: newBizType,
          businessPhone: newPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateMsg({ type: "error", text: data.error || "Error al crear la cuenta" });
      } else {
        setCreateMsg({
          type: "success",
          text: `¡Cuenta para "${newBizName}" creada con éxito! El usuario ya puede iniciar sesión.`,
        });
        setNewOwnerName("");
        setNewEmail("");
        setNewPassword("");
        setNewBizName("");
        setNewPhone("");
        await loadStats();
        setActiveTab("tenants");
      }
    } catch (err: any) {
      setCreateMsg({ type: "error", text: err.message || "Error al crear la cuenta" });
    }
    setCreating(false);
  }

  if (authLoading || (!isSuper && loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Cargando panel Superadmin...
      </div>
    );
  }

  if (!isSuper) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="mt-4 text-2xl font-bold text-white">Acceso Denegado</h1>
        <p className="mt-2 text-sm text-slate-400">
          Esta sección está reservada exclusivamente para el Superadministrador de la plataforma.
        </p>
        <Link href="/" className="btn-primary mt-6">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const filteredTenants = (stats?.tenants || []).filter(
    (t) =>
      t.business.name.toLowerCase().includes(filter.toLowerCase()) ||
      t.user.email.toLowerCase().includes(filter.toLowerCase()) ||
      t.user.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 pb-20 text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-900/80 backdrop-blur-md">
        <div className="container-page flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Logo size={28} />
              <span className="font-display text-lg font-bold">AIVA</span>
            </Link>
            <span className="rounded-lg bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30">
              👑 Superadmin
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>Sesión: <strong className="text-white">{user?.email}</strong></span>
            <Link href="/dashboard" className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:bg-white/5 hover:text-white">
              Ir a mi Dashboard →
            </Link>
          </div>
        </div>
      </header>

      <main className="container-page pt-8">
        {/* Title & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">
              Panel de Control Superadmin
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Gestiona todos los negocios, cuentas de amigos y supervisa el consumo de la IA.
            </p>
          </div>
          <button
            onClick={() => setActiveTab("create")}
            className="btn-primary !px-4 !py-2.5 text-sm"
          >
            + Dar de alta nuevo amigo / negocio
          </button>
        </div>

        {/* Global KPI Cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Negocios Activos</span>
              <span className="text-2xl">🏢</span>
            </div>
            <div className="mt-3 font-display text-3xl font-bold text-white">
              {stats?.totalBusinesses ?? 0}
            </div>
            <div className="mt-1 text-xs text-slate-500">Cuentas independientes</div>
          </div>

          <div className="card border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Llamadas Totales</span>
              <span className="text-2xl">📞</span>
            </div>
            <div className="mt-3 font-display text-3xl font-bold text-brand-400">
              {stats?.totalCalls ?? 0}
            </div>
            <div className="mt-1 text-xs text-slate-500">Atendidas por Claude Haiku</div>
          </div>

          <div className="card border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Citas Agendadas</span>
              <span className="text-2xl">📅</span>
            </div>
            <div className="mt-3 font-display text-3xl font-bold text-emerald-400">
              {stats?.totalAppointments ?? 0}
            </div>
            <div className="mt-1 text-xs text-slate-500">Confirmadas en plataforma</div>
          </div>

          <div className="card border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Pedidos Tomados</span>
              <span className="text-2xl">🍽️</span>
            </div>
            <div className="mt-3 font-display text-3xl font-bold text-purple-400">
              {stats?.totalOrders ?? 0}
            </div>
            <div className="mt-1 text-xs text-slate-500">Restaurantes y comercios</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-10 flex border-b border-white/10">
          <button
            onClick={() => setActiveTab("tenants")}
            className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "tenants"
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Negocios y Amigos ({stats?.tenants?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("calls")}
            className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "calls"
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Auditoría de Llamadas Recientes ({stats?.recentCalls?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "create"
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            + Crear Negocio Manualmente
          </button>
        </div>

        {/* TAB 1: Tenants List */}
        {activeTab === "tenants" && (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-4">
              <input
                type="text"
                placeholder="Buscar por negocio, dueño o correo..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-brand-500"
              />
              <button
                onClick={loadStats}
                className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
              >
                🔄 Actualizar
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-slate-900/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-5 py-3.5">Negocio</th>
                      <th className="px-5 py-3.5">Dueño</th>
                      <th className="px-5 py-3.5">Teléfono</th>
                      <th className="px-5 py-3.5 text-center">Llamadas</th>
                      <th className="px-5 py-3.5 text-center">Citas</th>
                      <th className="px-5 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredTenants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                          No se encontraron negocios registrados.
                        </td>
                      </tr>
                    ) : (
                      filteredTenants.map((t) => (
                        <tr key={t.user.id} className="transition hover:bg-white/[0.02]">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-white">{t.business.name}</div>
                            <div className="text-xs text-slate-500 capitalize">{t.business.type}</div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="text-slate-200">{t.user.name}</div>
                            <div className="text-xs text-slate-500">{t.user.email}</div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="text-xs font-mono text-slate-200">
                              {t.business.twilioPhone || t.business.phone || "Sin número"}
                            </div>
                            {t.business.twilioSid ? (
                              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                                ⚡ Twilio propio
                              </span>
                            ) : (
                              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-400">
                                🌐 Twilio global
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-center font-medium text-slate-300">
                            {t.stats.callsCount}
                          </td>
                          <td className="px-5 py-4 text-center font-medium text-emerald-400">
                            {t.stats.appointmentsCount}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openTwilioModal(t)}
                                className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-300 transition hover:bg-purple-500/20"
                                title="Configurar número y cuenta de Twilio para este negocio"
                              >
                                ⚙️ Twilio
                              </button>
                              <Link
                                href={`/dashboard`}
                                onClick={() => localStorage.setItem("aiva.businessFilter", t.business.id)}
                                className="rounded-lg border border-brand-500/40 bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-300 hover:bg-brand-500/20"
                                title="Ver lo que ve este negocio en su dashboard"
                              >
                                Ver Dashboard ↗
                              </Link>
                              {t.user.email !== "bruce.fernando@hotmail.com" && (
                                <button
                                  disabled={deletingId === t.user.id}
                                  onClick={() => handleDelete(t.user.id, t.business.id, t.business.name)}
                                  className="rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                                >
                                  {deletingId === t.user.id ? "Eliminando..." : "Eliminar"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Recent Calls Across All Businesses */}
        {activeTab === "calls" && (
          <div className="mt-6">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-slate-900/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-5 py-3.5">Fecha</th>
                      <th className="px-5 py-3.5">Negocio</th>
                      <th className="px-5 py-3.5">Cliente</th>
                      <th className="px-5 py-3.5">Resultado</th>
                      <th className="px-5 py-3.5">Resumen de IA</th>
                      <th className="px-5 py-3.5 text-right">Transcripción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(stats?.recentCalls || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                          Aún no se han registrado llamadas en la base de datos.
                        </td>
                      </tr>
                    ) : (
                      (stats?.recentCalls || []).map((c: any) => (
                        <tr key={c.id} className="transition hover:bg-white/[0.02]">
                          <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-400">
                            {new Date(c.started_at).toLocaleString("es-MX", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-5 py-4 font-medium text-white">
                            {c.business_name || c.business_id}
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-300">
                            {c.caller_phone}
                          </td>
                          <td className="px-5 py-4">
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                              {c.outcome}
                            </span>
                          </td>
                          <td className="max-w-xs truncate px-5 py-4 text-xs text-slate-400">
                            {c.summary || "Llamada completada."}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {c.transcript && c.transcript.length > 0 ? (
                              <button
                                onClick={() => setSelectedCall(c)}
                                className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-brand-300 hover:bg-white/5"
                              >
                                Ver conversación
                              </button>
                            ) : (
                              <span className="text-xs text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Create New Tenant Form */}
        {activeTab === "create" && (
          <div className="mt-6 max-w-xl">
            <div className="card p-6 shadow-xl">
              <h2 className="font-display text-xl font-semibold text-white">
                Dar de alta negocio para un amigo
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Crea sus credenciales de acceso y configura los datos básicos de su recepcionista.
              </p>

              {createMsg && (
                <div
                  className={`mt-4 rounded-xl p-3 text-sm ${
                    createMsg.type === "success"
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border border-red-500/30 bg-red-500/10 text-red-300"
                  }`}
                >
                  {createMsg.text}
                </div>
              )}

              <form onSubmit={handleCreateTenant} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase">
                      Nombre del amigo
                    </label>
                    <input
                      type="text"
                      required
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                      placeholder="Ej. Roberto Gómez"
                      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase">
                      Correo para su acceso
                    </label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="amigo@correo.com"
                      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase">
                    Contraseña provisional
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-brand-500"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase">
                      Nombre del negocio
                    </label>
                    <input
                      type="text"
                      required
                      value={newBizName}
                      onChange={(e) => setNewBizName(e.target.value)}
                      placeholder="Ej. Barbería El Estilo"
                      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase">
                      Tipo de negocio
                    </label>
                    <select
                      value={newBizType}
                      onChange={(e) => setNewBizType(e.target.value as any)}
                      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-brand-500"
                    >
                      <option value="clinic">Clínica / Salud</option>
                      <option value="salon">Salón / Spa / Barbería</option>
                      <option value="restaurant">Restaurante / Bar</option>
                      <option value="hotel">Hotel / Hospedaje</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase">
                    Teléfono del negocio
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+52 55 0000 0000"
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white outline-none focus:border-brand-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary mt-2 w-full !py-2.5 text-sm"
                >
                  {creating ? "Registrando cuenta..." : "Crear cuenta para mi amigo"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Transcript Viewer */}
        {selectedCall && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="card w-full max-w-xl max-h-[80vh] flex flex-col p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Llamada de {selectedCall.caller_phone}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Negocio: {selectedCall.business_name} • {new Date(selectedCall.started_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCall(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="my-4 flex-1 space-y-3 overflow-y-auto pr-2">
                {selectedCall.transcript.map((turn: any, i: number) => (
                  <div
                    key={i}
                    className={`flex flex-col ${
                      turn.role === "caller" ? "items-start" : "items-end"
                    }`}
                  >
                    <span className="text-[10px] text-slate-500 uppercase">
                      {turn.role === "caller" ? "Cliente" : "Recepcionista IA"}
                    </span>
                    <div
                      className={`mt-1 max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
                        turn.role === "caller"
                          ? "bg-slate-800 text-slate-200"
                          : "bg-brand-500/20 text-brand-200 border border-brand-500/30"
                      }`}
                    >
                      {turn.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 pt-3 text-right">
                <button
                  onClick={() => setSelectedCall(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-white/5"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Twilio Configuration */}
        {editingTwilioBiz && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="card w-full max-w-lg p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Configurar Twilio y Telefonía
                  </h3>
                  <p className="text-xs text-brand-400 font-medium">
                    Negocio: {editingTwilioBiz.business.name} ({editingTwilioBiz.user.name})
                  </p>
                </div>
                <button
                  onClick={() => setEditingTwilioBiz(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {twilioMsg && (
                <div
                  className={`mt-4 rounded-xl p-3 text-xs ${
                    twilioMsg.type === "success"
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border border-red-500/30 bg-red-500/10 text-red-300"
                  }`}
                >
                  {twilioMsg.text}
                </div>
              )}

              <form onSubmit={handleSaveTwilio} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase">
                    Número de Twilio asignado (Entrantes)
                  </label>
                  <input
                    type="tel"
                    required
                    value={twilioPhone}
                    onChange={(e) => setTwilioPhone(e.target.value)}
                    placeholder="+52 55 1234 5678"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand-500 font-mono"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Las llamadas recibidas a este número serán atendidas con los datos de este negocio.
                  </p>
                </div>

                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-300 uppercase">
                      Cuenta de Twilio del amigo (Pago Propio)
                    </span>
                    <span className="text-[10px] text-slate-400">Opcional</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Si este amigo paga su propio saldo, ingresa sus claves. Si lo dejas vacío, usará la cuenta global.
                  </p>
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      Twilio Account SID del amigo
                    </label>
                    <input
                      type="text"
                      value={twilioSid}
                      onChange={(e) => setTwilioSid(e.target.value)}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-brand-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      Twilio Auth Token del amigo
                    </label>
                    <input
                      type="password"
                      value={twilioToken}
                      onChange={(e) => setTwilioToken(e.target.value)}
                      placeholder="••••••••••••••••••••••••••••••••"
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-brand-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase">
                    Teléfono personal / Desvío a humano
                  </label>
                  <input
                    type="tel"
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value)}
                    placeholder="+52 55 9876 5432"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand-500 font-mono"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    A dónde transferir la llamada cuando el cliente pida hablar con un encargado.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-400">
                  <div className="font-semibold text-slate-300">Webhook para este número en Twilio:</div>
                  <div className="mt-1 rounded bg-black/50 p-2 font-mono text-[11px] text-brand-300 select-all break-all">
                    https://recepcionista-zeta.vercel.app/api/voice/incoming?businessId={editingTwilioBiz.business.id}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingTwilioBiz(null)}
                    className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-white/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingTwilio}
                    className="btn-primary !px-5 !py-2 text-xs font-semibold"
                  >
                    {savingTwilio ? "Guardando..." : "Guardar Twilio"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
