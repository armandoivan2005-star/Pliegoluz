import process from "node:process";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Configura DATABASE_URL antes de comprobar PostgreSQL.");

const client = new Client({
  connectionString,
  ssl: process.env.POSTGRES_SSL?.toLowerCase() === "require" ? { rejectUnauthorized: true } : undefined,
});

try {
  await client.connect();
  const version = await client.query("select current_database() as database, current_user as role, version()");
  const tables = await client.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
      order by table_name`,
    [[
      "firebase_profiles",
      "books",
      "chapters",
      "reading_progress",
      "book_favorites",
      "book_ratings",
    ]],
  );
  const expected = 6;
  if (tables.rowCount !== expected) {
    throw new Error(`Esquema incompleto: se encontraron ${tables.rowCount} de ${expected} tablas principales.`);
  }

  const counts = await client.query(
    `select
       (select count(*)::integer from public.firebase_profiles) as users,
       (select count(*)::integer from public.books) as books,
       (select count(*)::integer from public.chapters) as chapters,
       (select count(*)::integer from public.firebase_profiles where role = 'admin') as admins`,
  );
  console.log({
    database: version.rows[0].database,
    role: version.rows[0].role,
    tables: tables.rows.map((row) => row.table_name),
    counts: counts.rows[0],
  });
} finally {
  await client.end();
}
