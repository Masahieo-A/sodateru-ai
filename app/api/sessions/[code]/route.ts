import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// GET /api/sessions/[code] — コードでセッション取得（生徒・教員共用）
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  return NextResponse.json(data);
}
