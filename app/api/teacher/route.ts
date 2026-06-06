import { NextRequest, NextResponse } from "next/server";

// POST /api/teacher — 教員パスワード認証
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!password || password !== process.env.TEACHER_PASSWORD) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
