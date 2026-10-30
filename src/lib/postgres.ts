import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  // Conserva un solo pool durante recargas de desarrollo.
  var pliegoluzPostgresPool: Pool | undefined;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está configurado.");
  }

  if (!globalThis.pliegoluzPostgresPool) {
    const sslMode = process.env.POSTGRES_SSL?.toLowerCase();
    globalThis.pliegoluzPostgresPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: positiveInteger(process.env.POSTGRES_POOL_MAX, 10),
      idleTimeoutMillis: positiveInteger(process.env.POSTGRES_IDLE_TIMEOUT_MS, 30_000),
      connectionTimeoutMillis: positiveInteger(process.env.POSTGRES_CONNECTION_TIMEOUT_MS, 10_000),
      ssl: sslMode === "require" ? { rejectUnauthorized: true } : undefined,
    });
  }

  return globalThis.pliegoluzPostgresPool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return (await getDatabase().query<T>(text, values)).rows;
}

export async function oneOrNull<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  const rows = await query<T>(text, values);
  return rows[0] ?? null;
}

export async function withTransaction<T>(operation: (client: PoolClient) => Promise<T>) {
  const client = await getDatabase().connect();
  try {
    await client.query("begin");
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export function postgresErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
}
