import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import type { LessonMessage } from "@/types";

export const runtime = "edge";

function parseDialogue(value: unknown): LessonMessage[] {
  let parsed: unknown;
  try { parsed = typeof value === "string" ? JSON.parse(value) : null; } catch { parsed = null; }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is LessonMessage =>
    item !== null && typeof item === "object" &&
    (item.role === "teacher" || item.role === "student") &&
    typeof item.content === "string"
  );
}

// The ranking endpoint stays small; a teacher fetches one learner's writing on demand.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "教員権限が必要です" }, { status: 403 });

  const { id, participantId } = await params;
  const db = getDb();
  const participant = await db.prepare(
    `SELECT p.id,p.name,p.dialogue_log,p.teaching_summary,p.best_score,p.attempt_count,
            u.email AS account_email
       FROM participants p
       JOIN sessions s ON s.id=p.session_id
       LEFT JOIN users u ON u.id=p.user_id
      WHERE p.id=? AND p.session_id=? AND s.teacher_user_id=? LIMIT 1`,
  ).bind(participantId, id, user.id).first<Record<string, unknown>>();
  if (!participant) return NextResponse.json({ error: "学習者が見つかりません" }, { status: 404 });

  const { results: attemptRows } = await db.prepare(
    `SELECT id,explanation,teaching_score,ai_correct_count,total_questions,created_at
       FROM attempts WHERE participant_id=? AND session_id=?
      ORDER BY created_at DESC LIMIT 50`,
  ).bind(participantId, id).all<Record<string, unknown>>();

  return NextResponse.json({
    participant: {
      id: participant.id,
      name: participant.name,
      email: participant.account_email ?? null,
      best_score: participant.best_score,
      attempt_count: participant.attempt_count,
      dialogue: parseDialogue(participant.dialogue_log),
      teaching_summary: participant.teaching_summary ?? null,
    },
    attempts: attemptRows,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
