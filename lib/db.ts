import { query } from "./postgres";
import type {
  ActionItem,
  Appointment,
  Business,
  CallLog,
  Order,
  WaitlistEntry,
} from "./types";
import { intervalsOverlap } from "./overlap";
import { hashPassword, comparePassword } from "./auth";
import { seedBusinesses } from "./seed";

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// ---------------- Users ----------------
export interface DbUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  businessId: string;
  role: string;
  createdAt: string;
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const res = await query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [
    email.trim(),
  ]);
  if (!res.rows[0]) return null;
  const r = res.rows[0];
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    name: r.name,
    businessId: r.business_id,
    role: r.role,
    createdAt: r.created_at,
  };
}

export async function findUserById(id: string): Promise<DbUser | null> {
  const res = await query("SELECT * FROM users WHERE id = $1", [id]);
  if (!res.rows[0]) return null;
  const r = res.rows[0];
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    name: r.name,
    businessId: r.business_id,
    role: r.role,
    createdAt: r.created_at,
  };
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  businessName: string;
  businessType: Business["type"];
  businessPhone?: string;
}): Promise<{ user: DbUser; business: Business }> {
  const existing = await findUserByEmail(data.email);
  if (existing) {
    throw new Error("El correo electrónico ya está registrado");
  }

  const userId = newId("usr");
  const businessId = newId("biz");
  const passwordHash = await hashPassword(data.password);

  const newBiz: Business = {
    id: businessId,
    name: data.businessName,
    type: data.businessType || "clinic",
    phone: data.businessPhone || "+1 (555) 000-0000",
    address: "Por definir",
    hours: "Lun–Vie 9:00–18:00",
    languages: ["es", "en"],
    services: [
      {
        id: "svc_general",
        name: "Consulta general",
        durationMinutes: 30,
        price: 30,
      },
    ],
    faqs: [
      {
        id: "faq_1",
        question: "¿Cuál es el horario de atención?",
        answer: "Atendemos de lunes a viernes de 9:00 a 18:00.",
      },
    ],
  };

  await addBusiness(newBiz);

  await query(
    `INSERT INTO users (id, email, password_hash, name, business_id, role)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, data.email.toLowerCase().trim(), passwordHash, data.name, businessId, "owner"]
  );

  const user: DbUser = {
    id: userId,
    email: data.email.toLowerCase().trim(),
    passwordHash,
    name: data.name,
    businessId,
    role: "owner",
    createdAt: new Date().toISOString(),
  };

  return { user, business: newBiz };
}

// ---------------- Businesses ----------------
function mapBusiness(r: any): Business {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    phone: r.phone,
    staffPhone: r.staff_phone || undefined,
    address: r.address || "",
    hours: r.hours || "",
    holidays: r.holidays || [],
    announcement: r.announcement || undefined,
    greeting: r.greeting || undefined,
    webhookUrl: r.webhook_url || undefined,
    languages: r.languages || ["es"],
    services: r.services || [],
    faqs: r.faqs || [],
    menu: r.menu || undefined,
    rooms: r.rooms || undefined,
  };
}

export async function getBusinesses(): Promise<Business[]> {
  try {
    const res = await query("SELECT * FROM businesses ORDER BY created_at ASC");
    if (res.rows && res.rows.length > 0) return res.rows.map(mapBusiness);
  } catch (err) {
    console.error("[db.getBusinesses error]", err);
  }
  return seedBusinesses;
}

export async function getBusiness(id: string): Promise<Business | undefined> {
  try {
    const res = await query("SELECT * FROM businesses WHERE id = $1", [id]);
    if (res.rows && res.rows[0]) return mapBusiness(res.rows[0]);
  } catch (err) {
    console.error("[db.getBusiness error]", err);
  }
  return seedBusinesses.find((b) => b.id === id);
}

export async function addBusiness(biz: Business): Promise<Business> {
  await query(
    `INSERT INTO businesses (id, name, type, phone, staff_phone, address, hours, languages, services, faqs, menu, rooms, holidays, announcement, greeting, webhook_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       type = EXCLUDED.type,
       phone = EXCLUDED.phone,
       staff_phone = EXCLUDED.staff_phone,
       address = EXCLUDED.address,
       hours = EXCLUDED.hours,
       languages = EXCLUDED.languages,
       services = EXCLUDED.services,
       faqs = EXCLUDED.faqs,
       menu = EXCLUDED.menu,
       rooms = EXCLUDED.rooms,
       holidays = EXCLUDED.holidays,
       announcement = EXCLUDED.announcement,
       greeting = EXCLUDED.greeting,
       webhook_url = EXCLUDED.webhook_url;`,
    [
      biz.id,
      biz.name,
      biz.type,
      biz.phone,
      biz.staffPhone || null,
      biz.address || null,
      biz.hours || null,
      JSON.stringify(biz.languages || ["es"]),
      JSON.stringify(biz.services || []),
      JSON.stringify(biz.faqs || []),
      JSON.stringify(biz.menu || []),
      JSON.stringify(biz.rooms || []),
      JSON.stringify(biz.holidays || []),
      biz.announcement || null,
      biz.greeting || null,
      biz.webhookUrl || null,
    ]
  );
  return biz;
}

export async function updateBusiness(biz: Business): Promise<Business> {
  return addBusiness(biz);
}

// ---------------- Appointments ----------------
function mapAppointment(r: any): Appointment {
  return {
    id: r.id,
    businessId: r.business_id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    serviceId: r.service_id,
    serviceName: r.service_name,
    date: r.date,
    time: r.time,
    durationMinutes: r.duration_minutes,
    status: r.status,
    notes: r.notes || undefined,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

export async function getAppointments(businessId?: string): Promise<Appointment[]> {
  const sql = businessId
    ? "SELECT * FROM appointments WHERE business_id = $1 ORDER BY date DESC, time DESC"
    : "SELECT * FROM appointments ORDER BY date DESC, time DESC";
  const params = businessId ? [businessId] : [];
  const res = await query(sql, params);
  return res.rows.map(mapAppointment);
}

export async function addAppointment(appt: Appointment): Promise<Appointment> {
  await query(
    `INSERT INTO appointments (id, business_id, customer_name, customer_phone, service_id, service_name, date, time, duration_minutes, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      appt.id,
      appt.businessId,
      appt.customerName,
      appt.customerPhone,
      appt.serviceId || null,
      appt.serviceName,
      appt.date,
      appt.time,
      appt.durationMinutes ?? 30,
      appt.status || "confirmed",
      appt.notes || null,
    ]
  );
  return appt;
}

export async function isSlotTaken(
  businessId: string,
  date: string,
  time: string,
  durationMinutes = 30
): Promise<boolean> {
  const appts = await getAppointments(businessId);
  return appts.some(
    (a) =>
      a.date === date &&
      a.status === "confirmed" &&
      intervalsOverlap(time, durationMinutes, a.time, a.durationMinutes ?? 30)
  );
}

export async function findAppointmentsByPhone(
  businessId: string,
  customerPhone: string
): Promise<Appointment[]> {
  const res = await query(
    "SELECT * FROM appointments WHERE business_id = $1 AND customer_phone = $2 ORDER BY date DESC",
    [businessId, customerPhone]
  );
  return res.rows.map(mapAppointment);
}

export async function rescheduleAppointment(
  id: string,
  date: string,
  time: string
): Promise<Appointment | undefined> {
  const res = await query(
    "UPDATE appointments SET date = $1, time = $2 WHERE id = $3 RETURNING *",
    [date, time, id]
  );
  return res.rows[0] ? mapAppointment(res.rows[0]) : undefined;
}

export async function markAppointmentReminded(id: string): Promise<Appointment | undefined> {
  const res = await query("SELECT * FROM appointments WHERE id = $1", [id]);
  return res.rows[0] ? mapAppointment(res.rows[0]) : undefined;
}

export async function setAppointmentStatus(
  id: string,
  status: Appointment["status"]
): Promise<Appointment | undefined> {
  const res = await query(
    "UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *",
    [status, id]
  );
  return res.rows[0] ? mapAppointment(res.rows[0]) : undefined;
}

export async function cancelAndPromoteWaitlist(id: string) {
  const appt = await setAppointmentStatus(id, "cancelled");
  if (!appt) return { appt: null, promoted: null };
  const res = await query(
    "SELECT * FROM waitlist WHERE business_id = $1 AND date = $2 AND status = 'waiting' ORDER BY created_at ASC LIMIT 1",
    [appt.businessId, appt.date]
  );
  let promoted: WaitlistEntry | null = null;
  if (res.rows[0]) {
    await query("UPDATE waitlist SET status = 'notified' WHERE id = $1", [res.rows[0].id]);
    promoted = mapWaitlist(res.rows[0]);
  }
  return { appt, promoted };
}

// ---------------- Orders ----------------
function mapOrder(r: any): Order {
  return {
    id: r.id,
    businessId: r.business_id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    items: r.items || [],
    total: Number(r.total || 0),
    type: r.type,
    address: r.address || undefined,
    status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

export async function getOrders(businessId?: string): Promise<Order[]> {
  const sql = businessId
    ? "SELECT * FROM orders WHERE business_id = $1 ORDER BY created_at DESC"
    : "SELECT * FROM orders ORDER BY created_at DESC";
  const params = businessId ? [businessId] : [];
  const res = await query(sql, params);
  return res.rows.map(mapOrder);
}

export async function addOrder(order: Order): Promise<Order> {
  await query(
    `INSERT INTO orders (id, business_id, customer_name, customer_phone, items, total, type, address, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      order.id,
      order.businessId,
      order.customerName,
      order.customerPhone,
      JSON.stringify(order.items || []),
      order.total,
      order.type,
      order.address || null,
      order.status || "confirmed",
    ]
  );
  return order;
}

export async function setOrderStatus(
  id: string,
  status: Order["status"]
): Promise<Order | undefined> {
  const res = await query(
    "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
    [status, id]
  );
  return res.rows[0] ? mapOrder(res.rows[0]) : undefined;
}

// ---------------- Action items ----------------
function mapActionItem(r: any): ActionItem {
  return {
    id: r.id,
    businessId: r.business_id,
    callId: r.call_id || undefined,
    text: r.text,
    customerPhone: r.customer_phone || undefined,
    done: Boolean(r.done),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

export async function getActionItems(businessId?: string): Promise<ActionItem[]> {
  const sql = businessId
    ? "SELECT * FROM action_items WHERE business_id = $1 ORDER BY created_at DESC"
    : "SELECT * FROM action_items ORDER BY created_at DESC";
  const params = businessId ? [businessId] : [];
  const res = await query(sql, params);
  return res.rows.map(mapActionItem);
}

export async function addActionItem(item: ActionItem): Promise<ActionItem> {
  await query(
    `INSERT INTO action_items (id, business_id, call_id, text, customer_phone, done)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [item.id, item.businessId, item.callId || null, item.text, item.customerPhone || null, item.done || false]
  );
  return item;
}

export async function setActionItemDone(
  id: string,
  done: boolean
): Promise<ActionItem | undefined> {
  const res = await query(
    "UPDATE action_items SET done = $1 WHERE id = $2 RETURNING *",
    [done, id]
  );
  return res.rows[0] ? mapActionItem(res.rows[0]) : undefined;
}

// ---------------- Waitlist ----------------
function mapWaitlist(r: any): WaitlistEntry {
  return {
    id: r.id,
    businessId: r.business_id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    serviceName: r.service_name,
    date: r.date,
    status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

export async function getWaitlist(businessId?: string): Promise<WaitlistEntry[]> {
  const sql = businessId
    ? "SELECT * FROM waitlist WHERE business_id = $1 ORDER BY created_at DESC"
    : "SELECT * FROM waitlist ORDER BY created_at DESC";
  const params = businessId ? [businessId] : [];
  const res = await query(sql, params);
  return res.rows.map(mapWaitlist);
}

export async function addWaitlistEntry(entry: WaitlistEntry): Promise<WaitlistEntry> {
  await query(
    `INSERT INTO waitlist (id, business_id, customer_name, customer_phone, service_name, date, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.id,
      entry.businessId,
      entry.customerName,
      entry.customerPhone,
      entry.serviceName,
      entry.date,
      entry.status || "waiting",
    ]
  );
  return entry;
}

export async function setWaitlistStatus(
  id: string,
  status: WaitlistEntry["status"]
): Promise<WaitlistEntry | undefined> {
  const res = await query(
    "UPDATE waitlist SET status = $1 WHERE id = $2 RETURNING *",
    [status, id]
  );
  return res.rows[0] ? mapWaitlist(res.rows[0]) : undefined;
}

export async function nextWaitingFor(
  businessId: string,
  date: string
): Promise<WaitlistEntry | undefined> {
  const res = await query(
    "SELECT * FROM waitlist WHERE business_id = $1 AND date = $2 AND status = 'waiting' ORDER BY created_at ASC LIMIT 1",
    [businessId, date]
  );
  return res.rows[0] ? mapWaitlist(res.rows[0]) : undefined;
}

// ---------------- Call Logs ----------------
function mapCall(r: any): CallLog {
  return {
    id: r.id,
    businessId: r.business_id,
    callerPhone: r.caller_phone,
    language: r.language || "es",
    channel: r.channel || "web",
    startedAt: r.started_at ? new Date(r.started_at).toISOString() : new Date().toISOString(),
    endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : undefined,
    outcome: r.outcome,
    transcript: r.transcript || [],
    summary: r.summary || undefined,
    sentiment: r.sentiment || undefined,
    intent: r.intent || undefined,
    resolved: r.resolved !== null ? Boolean(r.resolved) : true,
    actionItems: r.action_items || [],
  };
}

export async function getCalls(businessId?: string): Promise<CallLog[]> {
  try {
    const sql = businessId
      ? "SELECT * FROM calls WHERE business_id = $1 ORDER BY started_at DESC"
      : "SELECT * FROM calls ORDER BY started_at DESC";
    const params = businessId ? [businessId] : [];
    const res = await query(sql, params);
    return res.rows.map(mapCall);
  } catch (err) {
    console.error("[db.getCalls error]", err);
    return [];
  }
}

export async function getCall(id: string): Promise<CallLog | undefined> {
  try {
    const res = await query("SELECT * FROM calls WHERE id = $1", [id]);
    return res.rows[0] ? mapCall(res.rows[0]) : undefined;
  } catch (err) {
    console.error("[db.getCall error]", err);
    return undefined;
  }
}

export async function upsertCall(call: CallLog): Promise<CallLog> {
  try {
    await query(
      `INSERT INTO calls (id, business_id, caller_phone, language, channel, started_at, ended_at, outcome, transcript, summary, sentiment, intent, resolved, action_items)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         ended_at = EXCLUDED.ended_at,
         outcome = EXCLUDED.outcome,
         transcript = EXCLUDED.transcript,
         summary = EXCLUDED.summary,
         sentiment = EXCLUDED.sentiment,
         intent = EXCLUDED.intent,
         resolved = EXCLUDED.resolved,
         action_items = EXCLUDED.action_items;`,
      [
        call.id,
        call.businessId,
        call.callerPhone,
        call.language || "es",
        call.channel || "web",
        call.startedAt || new Date().toISOString(),
        call.endedAt || null,
        call.outcome || "in_progress",
        JSON.stringify(call.transcript || []),
        call.summary || null,
        call.sentiment || null,
        call.intent || null,
        call.resolved ?? true,
        JSON.stringify(call.actionItems || []),
      ]
    );
  } catch (err) {
    console.error("[db.upsertCall error]", err);
  }
  return call;
}
