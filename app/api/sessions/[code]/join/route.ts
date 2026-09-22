import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { randomToken } from "@/lib/auth/crypto";
import { getDb } from "@/lib/db";

export const runtime = "edge";

// POST /api/sessions/[code]/join — 生徒がセッションに参加
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const { code } = await params;
  const body = await req.json() as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 20) {
    return NextResponse.json({ error: "名前を入力してください" }, { status: 400 });
  }

  const session = await getDb().prepare(
    "SELECT id,code,unit_id,name,status,created_at FROM sessions WHERE code=? LIMIT 1",
  ).bind(code.toUpperCase()).first<Record<string, unknown> & { id: string; status: string }>();
  if (!session) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  if (session.status === "ended") {
    return NextResponse.json({ error: "このセッションはすでに終了しています" }, { status: 400 });
  }

  // A participant belongs to the signed-in Google account, not to a client
  // supplied student id or nickname. A changed nickname does not create a
  // second account record in the same session.
  const existing = await getDb().prepare(
    `SELECT id,session_id,user_id,name,best_score,attempt_count,last_attempt_at,created_at
       FROM participants WHERE session_id=? AND user_id=? LIMIT 1`,
  ).bind(session.id, user.id).first<Record<string, unknown>>();
  if (existing) {
    return NextResponse.json({ student: existing, session });
  }

  try {
    // The UNIQUE(session_id,user_id) constraint (added to the D1 schema) makes
    // concurrent retries converge on one participant per account/session.
    await getDb().prepare(
      `INSERT INTO participants (id,session_id,user_id,name)
       VALUES (?,?,?,?)`,
    ).bind(randomToken(16), session.id, user.id, name).run();
  } catch (error) {
    if (!(error instanceof Error) || !/unique|constraint/i.test(error.message)) {
      return NextResponse.json({ error: "参加者の登録に失敗しました" }, { status: 500 });
    }
  }
  const student = await getDb().prepare(
    `SELECT id,session_id,user_id,name,best_score,attempt_count,last_attempt_at,created_at
       FROM participants WHERE session_id=? AND user_id=? LIMIT 1`,
  ).bind(session.id, user.id).first<Record<string, unknown>>();
  if (!student) return NextResponse.json({ error: "参加者を取得できませんでした" }, { status: 500 });
  return NextResponse.json({ student, session }, { status: 201 });
}
