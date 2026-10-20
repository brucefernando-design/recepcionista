const { Pool } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:Escritorio1411@db.doqxdedbjhtcmsjlxrdl.supabase.co:5432/postgres";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  business_id TEXT NOT NULL,
  role TEXT DEFAULT 'owner',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  phone TEXT NOT NULL,
  staff_phone TEXT,
  address TEXT,
  hours TEXT,
  languages JSONB DEFAULT '["es"]'::jsonb,
  services JSONB DEFAULT '[]'::jsonb,
  faqs JSONB DEFAULT '[]'::jsonb,
  menu JSONB DEFAULT '[]'::jsonb,
  rooms JSONB DEFAULT '[]'::jsonb,
  holidays JSONB DEFAULT '[]'::jsonb,
  announcement TEXT,
  greeting TEXT,
  webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  service_id TEXT,
  service_name TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  duration_minutes INT DEFAULT 30,
  status TEXT DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  total NUMERIC DEFAULT 0,
  type TEXT DEFAULT 'pickup',
  address TEXT,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  caller_phone TEXT NOT NULL,
  language TEXT DEFAULT 'es',
  channel TEXT DEFAULT 'web',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  outcome TEXT DEFAULT 'in_progress',
  transcript JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  sentiment TEXT,
  intent TEXT,
  resolved BOOLEAN DEFAULT true,
  action_items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  call_id TEXT,
  text TEXT NOT NULL,
  customer_phone TEXT,
  done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waitlist (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  service_name TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

async function init() {
  try {
    await pool.query(schema);
    console.log("SCHEMA_CREATED_SUCCESS");
  } catch (err) {
    console.error("SCHEMA_ERROR:", err);
  } finally {
    await pool.end();
  }
}

init();
