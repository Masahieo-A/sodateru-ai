import { getDb, getEnv, nowIso } from "../db";
import { randomToken, sha256, signValue, verifySignedValue } from "./crypto";

export const SESSION_COOKIE = "sodateru_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export interface AuthUser {
  id: string;
  google_sub: string;
  email: string;
  name: string;
  picture_url: string | null;
  role: "student" | "teacher";
}

function cookieValue(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function createSession(userId: string): Promise<{ value: string; maxAge: number }> {
  const raw = randomToken(32);
  const signed = await signValue(raw, getEnv().AUTH_SECRET);
  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000).toISOString();
  await getDb().prepare("INSERT INTO auth_sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)")
    .bind(randomToken(16), userId, await sha256(raw), expiresAt).run();
  return { value: signed, maxAge: MAX_AGE_SECONDS };
}

export async function getSessionUser(request: Request): Promise<AuthUser | null> {
  const signed = cookieValue(request);
  if (!signed) return null;
  const raw = await verifySignedValue(signed, getEnv().AUTH_SECRET);
  if (!raw) return null;
  const row = await getDb().prepare(
    `SELECT u.id,u.google_sub,u.email,u.name,u.picture_url,u.role
       FROM auth_sessions a JOIN users u ON u.id=a.user_id
      WHERE a.token_hash=? AND a.expires_at>? LIMIT 1`,
  ).bind(await sha256(raw), nowIso()).first<AuthUser>();
  return row ?? null;
}

export async function revokeSession(request: Request): Promise<void> {
  const signed = cookieValue(request);
  if (!signed) return;
  const raw = await verifySignedValue(signed, getEnv().AUTH_SECRET);
  if (raw) await getDb().prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(await sha256(raw)).run();
}

export function sessionCookie(value: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
