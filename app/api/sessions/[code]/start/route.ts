import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isTeacherAuthorized } from "@/lib/supabase-server";

// POST /api/sessions/[code]/start — セッション開始（教員用）
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!isTeacherAuthorized(req)) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }
  const { code } = await params;
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .update({ status: "active" })
    .eq("code", code.toUpperCase())
    .eq("status", "waiting")
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "セッションを開始できませんでした" }, { status: 400 });
  }
  return NextResponse.json(data);
}
