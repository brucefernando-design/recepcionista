const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:Escritorio1411@db.doqxdedbjhtcmsjlxrdl.supabase.co:5432/postgres";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Load seed data from store.json or fallback
async function seed() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, "../data/store.json"), "utf8");
    const store = JSON.parse(raw);

    for (const biz of store.businesses || []) {
      await pool.query(
        `INSERT INTO businesses (id, name, type, phone, staff_phone, address, hours, languages, services, faqs, menu, rooms, holidays, announcement, greeting, webhook_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           type = EXCLUDED.type,
           services = EXCLUDED.services,
           faqs = EXCLUDED.faqs,
           menu = EXCLUDED.menu;`,
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
    }
    console.log("SEEDED_BUSINESSES_SUCCESS");
  } catch (err) {
    console.error("SEED_ERROR:", err);
  } finally {
    await pool.end();
  }
}

seed();
