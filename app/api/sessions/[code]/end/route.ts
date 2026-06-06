import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isTeacherAuthorized } from "@/lib/supabase-server";

// POST /api/sessions/[code]/end — セッション終了（教員用）
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
    .update({ status: "ended" })
    .eq("code", code.toUpperCase())
    .neq("status", "ended")
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "セッションを終了できませんでした" }, { status: 400 });
  }
  return NextResponse.json(data);
}
