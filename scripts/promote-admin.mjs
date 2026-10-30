import process from "node:process";
import nextEnv from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
const email = process.argv[2]?.trim().toLowerCase();

if (!connectionString) throw new Error("Configura DATABASE_URL antes de promover un administrador.");
if (!email || !email.includes("@")) throw new Error("Uso: npm run db:promote-admin -- admin@ejemplo.com");

const client = new Client({
  connectionString,
  ssl: process.env.POSTGRES_SSL?.toLowerCase() === "require" ? { rejectUnauthorized: true } : undefined,
});

try {
  await client.connect();
  const result = await client.query(
    `update public.firebase_profiles
       set role = 'admin', suspended_at = null, updated_at = now()
     where lower(email) = $1
     returning id, email, role`,
    [email],
  );

  if (result.rowCount !== 1) {
    throw new Error("No se encontró exactamente un perfil. Inicia sesión una vez con Firebase y vuelve a ejecutar el comando.");
  }

  console.log(`Administrador restaurado: ${result.rows[0].email}`);
} finally {
  await client.end();
}
