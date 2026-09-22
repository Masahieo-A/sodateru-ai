import { env } from "cloudflare:workers";
import type { CloudflareEnv } from "../types";

export type DbEnv = CloudflareEnv;

export function getEnv(): DbEnv {
  return env as unknown as DbEnv;
}

export function getDb(): D1Database {
  const database = getEnv().DB;
  if (!database) throw new Error("D1 binding DB is not configured");
  return database;
}

export function nowIso(): string {
  return new Date().toISOString();
}
