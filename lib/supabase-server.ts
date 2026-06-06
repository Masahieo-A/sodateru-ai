import { createClient } from "@supabase/supabase-js";

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

// 教員認証チェック
export function isTeacherAuthorized(req: Request): boolean {
  const auth = req.headers.get("x-teacher-password");
  return auth === process.env.TEACHER_PASSWORD;
}
