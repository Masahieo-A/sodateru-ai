import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isTeacherAuthorized, listStudents } from "@/lib/supabase-server";

// GET /api/teacher/sessions/[id] — セッション詳細と参加者一覧（教員の授業管理画面用）
// ブラウザから Supabase へ直接接続すると、学校のフィルタ等で *.supabase.co が
// 遮断された環境で "TypeError: Failed to fetch" になるため、サーバー経由で取得する。
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTeacherAuthorized(req)) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }
  const { id } = await params;
  const { data: session, error } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!session) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  const { data: students, error: stError } = await listStudents(session.id);
  if (stError) return NextResponse.json({ error: stError.message }, { status: 500 });
  return NextResponse.json({ session, students: students ?? [] });
}
