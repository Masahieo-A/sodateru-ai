import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

export const runtime = "edge";

// GET /api/sessions/[code]/students — 参加者ランキング（生徒画面用）
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getSessionUser(_req);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const { code } = await params;
  const session = await getDb().prepare("SELECT id,teacher_user_id FROM sessions WHERE code=? LIMIT 1")
    .bind(code.toUpperCase()).first<{ id: string; teacher_user_id: string | null }>();
  if (!session) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  if (session.teacher_user_id !== user.id) {
    const membership = await getDb().prepare(
      "SELECT id FROM participants WHERE session_id=? AND user_id=? LIMIT 1",
    ).bind(session.id, user.id).first<{ id: string }>();
    if (!membership) return NextResponse.json({ error: "このセッションへの参加が必要です" }, { status: 403 });
  }
  const { results } = await getDb().prepare(
    `SELECT id,session_id,name,best_score,attempt_count,last_attempt_at,created_at
       FROM participants WHERE session_id=?
      ORDER BY best_score DESC, last_attempt_at ASC, created_at ASC LIMIT 100`,
  ).bind(session.id).all();
  return NextResponse.json(results);
}
