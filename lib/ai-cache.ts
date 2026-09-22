import { getDb, nowIso } from "./db";
import { randomToken, sha256 } from "./auth/crypto";

type IdempotencyRow = { key: string; request_hash: string; response_json: string; expires_at: string | null };
type PendingResponse = { pending: true; token: string };
export type AiReservation<T> =
  | { kind: "owner" }
  | { kind: "pending" }
  | { kind: "conflict" }
  | { kind: "completed"; response: T };

function isPending(value: unknown): value is PendingResponse {
  return Boolean(value && typeof value === "object" &&
    (value as { pending?: unknown }).pending === true);
}

export async function getCachedAiResponse<T>(attemptId: string | undefined | null): Promise<T | null> {
  if (!attemptId) return null;
  try {
    const row = await getDb().prepare(
      "SELECT response_json FROM idempotency WHERE key=? AND (expires_at IS NULL OR expires_at>?) LIMIT 1",
    ).bind(attemptId, nowIso()).first<{ response_json: string }>();
    if (!row) return null;
    const response = JSON.parse(row.response_json) as unknown;
    return isPending(response) ? null : response as T;
  } catch (error) {
    console.warn("[ai-cache] read failed (continuing without cache):", error);
    return null;
  }
}

/** Claim an idempotency key before an expensive AI call. */
export async function reserveAiResponse<T>(
  attemptId: string | undefined | null,
  requestHash: string,
  userId?: string,
): Promise<AiReservation<T>> {
  if (!attemptId) return { kind: "owner" };
  try {
    const token = randomToken(16);
    const leaseUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    await getDb().prepare(
      `INSERT OR IGNORE INTO idempotency (key,user_id,request_hash,response_json,created_at,expires_at)
       VALUES (?,?,?,?,?,?)`,
    ).bind(attemptId, userId ?? null, requestHash,
      JSON.stringify({ pending: true, token }), nowIso(), leaseUntil).run();
    const row = await getDb().prepare(
      "SELECT key,request_hash,response_json,expires_at FROM idempotency WHERE key=? LIMIT 1",
    ).bind(attemptId).first<IdempotencyRow>();
    if (!row) return { kind: "owner" };
    if (row.request_hash !== requestHash) return { kind: "conflict" };
    const response = JSON.parse(row.response_json) as unknown;
    if (!isPending(response)) return { kind: "completed", response: response as T };
    if (row.expires_at && row.expires_at <= nowIso()) {
      await getDb().prepare(
        `UPDATE idempotency SET user_id=?,response_json=?,expires_at=?
           WHERE key=? AND request_hash=? AND response_json=? AND expires_at<=?`,
      ).bind(userId ?? null, JSON.stringify({ pending: true, token }), leaseUntil,
        attemptId, requestHash, row.response_json, nowIso()).run();
      const current = await getDb().prepare(
        "SELECT response_json FROM idempotency WHERE key=? AND request_hash=? LIMIT 1",
      ).bind(attemptId, requestHash).first<{ response_json: string }>();
      if (current) {
        const currentResponse = JSON.parse(current.response_json) as unknown;
        if (isPending(currentResponse) && currentResponse.token === token) return { kind: "owner" };
      }
      return { kind: "pending" };
    }
    return response.token === token ? { kind: "owner" } : { kind: "pending" };
  } catch (error) {
    console.warn("[ai-cache] reservation failed (continuing without reservation):", error);
    return { kind: "owner" };
  }
}

/** Let a failed request be retried without waiting for the lease timeout. */
export async function expireAiResponse(attemptId: string | undefined | null, requestHash: string): Promise<void> {
  if (!attemptId) return;
  try {
    await getDb().prepare(
      "UPDATE idempotency SET expires_at=? WHERE key=? AND request_hash=?",
    ).bind(nowIso(), attemptId, requestHash).run();
  } catch (error) {
    console.warn("[ai-cache] failed to expire reservation:", error);
  }
}

export async function cacheAiResponse(
  attemptId: string | undefined | null,
  response: unknown,
  requestHash?: string,
): Promise<void> {
  if (!attemptId) return;
  try {
    const hash = requestHash ?? await sha256(attemptId);
    await getDb().prepare(
      `INSERT INTO idempotency (key,user_id,request_hash,response_json,created_at,expires_at)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(key) DO UPDATE SET response_json=excluded.response_json,expires_at=NULL
       WHERE idempotency.request_hash=excluded.request_hash`,
    ).bind(attemptId, null, hash, JSON.stringify(response), nowIso(), null).run();
  } catch (error) {
    console.warn("[ai-cache] write failed (continuing):", error);
  }
}
