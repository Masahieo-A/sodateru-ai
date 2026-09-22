import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

export const runtime = "edge";

// POST /api/sessions/[code]/end — セッション終了（教員用）
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "教員権限が必要です" }, { status: 403 });
  const { code } = await params;
  await getDb().prepare(
    "UPDATE sessions SET status='ended' WHERE code=? AND teacher_user_id=? AND status!='ended'",
  ).bind(code.toUpperCase(), user.id).run();
  const data = await getDb().prepare(
    "SELECT id,code,unit_id,name,status,created_at FROM sessions WHERE code=? AND teacher_user_id=? LIMIT 1",
  ).bind(code.toUpperCase(), user.id).first<Record<string, unknown>>();
  if (!data || data.status !== "ended") {
    return NextResponse.json({ error: "セッションを終了できませんでした" }, { status: 400 });
  }
  return NextResponse.json(data);
}
