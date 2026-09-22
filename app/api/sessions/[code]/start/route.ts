import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

export const runtime = "edge";

// POST /api/sessions/[code]/start — セッション開始（教員用）
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "教員権限が必要です" }, { status: 403 });
  const { code } = await params;
  const result = await getDb().prepare(
    "UPDATE sessions SET status='active' WHERE code=? AND teacher_user_id=? AND status='waiting'",
  ).bind(code.toUpperCase(), user.id).run();
  const data = await getDb().prepare(
    "SELECT id,code,unit_id,name,status,created_at FROM sessions WHERE code=? AND teacher_user_id=? LIMIT 1",
  ).bind(code.toUpperCase(), user.id).first<Record<string, unknown>>();
  if (!data || !result.success || data.status !== "active") {
    return NextResponse.json({ error: "セッションを開始できませんでした" }, { status: 400 });
  }
  return NextResponse.json(data);
}
