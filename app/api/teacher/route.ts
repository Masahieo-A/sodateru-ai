import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, revokeSession } from "@/lib/auth/session";

export const runtime = "edge";

// POST /api/teacher — Googleログイン済みユーザーの教員権限を確認
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Googleログインが必要です" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "教員権限が必要です" }, { status: 403 });
  return NextResponse.json({ ok: true, user });
}

// GET /api/teacher — 現在ログイン中かを返す（クライアントのリダイレクト判定用）
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  return NextResponse.json({ authenticated: Boolean(user), user: user ?? null, teacher: user?.role === "teacher" });
}

// DELETE /api/teacher — ログアウト（Cookie を失効させる）
export async function DELETE(req: NextRequest) {
  await revokeSession(req);
  return NextResponse.json({ ok: true });
}
