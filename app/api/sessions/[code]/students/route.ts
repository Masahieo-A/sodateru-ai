import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, listStudents } from "@/lib/supabase-server";

// GET /api/sessions/[code]/students — 参加者ランキング（生徒画面用）
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { data: session } = await supabaseAdmin
    .from("sessions")
    .select("id")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  const { data, error } = await listStudents(session.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
