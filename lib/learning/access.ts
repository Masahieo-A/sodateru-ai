import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import type { LessonMessage } from "@/types";

type LessonScope = {
  participantId?: unknown;
  sessionId?: unknown;
  unitId?: unknown;
};

export type AuthorizedLessonScope = {
  participantId: string;
  sessionId: string;
  unitId: string;
  userId: string;
};

export type LessonScopeResult =
  | { ok: true; scope: AuthorizedLessonScope }
  | { ok: false; status: 400 | 401 | 403; error: string };

export async function authorizeLessonScope(
  request: Request,
  input: LessonScope,
): Promise<LessonScopeResult> {
  const user = await getSessionUser(request);
  if (!user) return { ok: false, status: 401, error: "ログインが必要です" };

  if (
    typeof input.participantId !== "string" ||
    typeof input.sessionId !== "string" ||
    typeof input.unitId !== "string" ||
    input.participantId.length > 128 ||
    input.sessionId.length > 128 ||
    input.unitId.length > 128
  ) {
    return { ok: false, status: 400, error: "授業参加情報が不正です" };
  }

  const row = await getDb().prepare(
    `SELECT p.id
       FROM participants p
       JOIN sessions s ON s.id=p.session_id
      WHERE p.id=? AND p.user_id=? AND p.session_id=?
        AND s.unit_id=? AND s.status='active'
      LIMIT 1`,
  ).bind(input.participantId, user.id, input.sessionId, input.unitId)
    .first<{ id: string }>();

  if (!row) {
    return { ok: false, status: 403, error: "授業参加権限を確認できません" };
  }

  return {
    ok: true,
    scope: {
      participantId: input.participantId,
      sessionId: input.sessionId,
      unitId: input.unitId,
      userId: user.id,
    },
  };
}

export function boundedDialogue(value: unknown): LessonMessage[] | null {
  if (!Array.isArray(value) || value.length > 40) return null;
  let totalLength = 0;
  const messages: LessonMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "teacher" && role !== "student") || typeof content !== "string") {
      return null;
    }
    if (content.length > 4_000) return null;
    totalLength += content.length;
    if (totalLength > 20_000) return null;
    messages.push({ role, content });
  }
  return messages;
}
