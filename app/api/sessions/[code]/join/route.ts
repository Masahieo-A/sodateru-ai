import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// POST /api/sessions/[code]/join — 生徒がセッションに参加
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "名前を入力してください" }, { status: 400 });
  }

  // セッション取得
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();
  if (sessionErr || !session) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  if (session.status === "ended") {
    return NextResponse.json({ error: "このセッションはすでに終了しています" }, { status: 400 });
  }

  // 参加者の一意性は (session_id, nickname) で判定する（P2-6）：
  // - 同名での再参加 → 既存参加者として復帰（進捗・スコアを引き継ぐ）
  // - 別名での参加   → 新規参加者を作成（PC教室の共有端末・クラス替え対応）
  const { data: existing } = await supabaseAdmin
    .from("students")
    .select("*")
    .eq("session_id", session.id)
    .eq("name", name.trim())
    .single();
  if (existing) {
    return NextResponse.json({ student: existing, session });
  }

  // 新規生徒を登録
  const { data: student, error: studentErr } = await supabaseAdmin
    .from("students")
    .insert({ session_id: session.id, name: name.trim() })
    .select()
    .single();
  if (studentErr) {
    return NextResponse.json({ error: studentErr.message }, { status: 500 });
  }
  return NextResponse.json({ student, session }, { status: 201 });
}
