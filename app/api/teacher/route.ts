import { NextRequest, NextResponse } from "next/server";
import {
  TEACHER_COOKIE,
  teacherSessionToken,
  isTeacherAuthorized,
} from "@/lib/supabase-server";

const MAX_AGE = 60 * 60 * 8; // 8時間

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

// POST /api/teacher — 教員パスワード認証（成功時に httpOnly Cookie を発行）
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!password || password !== process.env.TEACHER_PASSWORD) {
    return NextResponse.json(
      { error: "パスワードが正しくありません" },
      { status: 401 }
    );
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TEACHER_COOKIE, teacherSessionToken(), cookieOptions(MAX_AGE));
  return res;
}

// GET /api/teacher — 現在ログイン中かを返す（クライアントのリダイレクト判定用）
export async function GET(req: NextRequest) {
  return NextResponse.json({ authenticated: isTeacherAuthorized(req) });
}

// DELETE /api/teacher — ログアウト（Cookie を失効させる）
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TEACHER_COOKIE, "", cookieOptions(0));
  return res;
}
