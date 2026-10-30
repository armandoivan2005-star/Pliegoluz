import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { loadEnvConfig } from "@next/env";
import pg from "pg";

loadEnvConfig(process.cwd());
const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Configura DATABASE_URL antes de aplicar el esquema.");

const schemaPath = path.resolve(process.cwd(), "postgres", "schema.sql");
const schema = await fs.readFile(schemaPath, "utf8");
const client = new Client({
  connectionString,
  ssl: process.env.POSTGRES_SSL?.toLowerCase() === "require" ? { rejectUnauthorized: true } : undefined,
});

try {
  await client.connect();
  await client.query(schema);
  console.log("Esquema de PostgreSQL aplicado correctamente.");
} finally {
  await client.end();
}
