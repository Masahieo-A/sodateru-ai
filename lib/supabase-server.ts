import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// サーバーサイド用（service role key — RLS をバイパス）
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 6文字の参加コードを生成（大文字英数字）
export function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい文字を除外
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ============================================================
// 教員認証（httpOnly Cookie ベース）
//
// 以前は平文パスワードを localStorage に保存し、全リクエストの
// ヘッダーに乗せていた（XSS で窃取可能・DevTools で常時露出）。
// 現在はログイン時にサーバーが httpOnly Cookie を発行し、
// Cookie には平文ではなく TEACHER_PASSWORD から導出したトークンを保存する。
// ============================================================

export const TEACHER_COOKIE = "teacher_session";

/** TEACHER_PASSWORD から決定的に導出される認証トークン（平文は保存しない） */
export function teacherSessionToken(): string {
  return crypto
    .createHmac("sha256", process.env.TEACHER_PASSWORD ?? "")
    .update("teacher-session-v1")
    .digest("hex");
}

/** Cookie ヘッダーから指定名の値を取り出す */
function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

// 教員認証チェック（Cookie のトークンを検証）
export function isTeacherAuthorized(req: Request): boolean {
  const token = readCookie(req.headers.get("cookie"), TEACHER_COOKIE);
  if (!token) return false;
  const expected = teacherSessionToken();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b); // タイミング攻撃対策
}
