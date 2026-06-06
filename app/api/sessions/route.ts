import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, generateCode, isTeacherAuthorized } from "@/lib/supabase-server";
import { getUnitById } from "@/lib/questions";

// GET /api/sessions — セッション一覧（教員用）
export async function GET(req: NextRequest) {
  if (!isTeacherAuthorized(req)) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/sessions — セッション作成（教員用）
export async function POST(req: NextRequest) {
  if (!isTeacherAuthorized(req)) {
    return NextResponse.json({ error: "認証エラー" }, { status: 401 });
  }
  const { unit_id, name } = await req.json();
  if (!unit_id || !name?.trim()) {
    return NextResponse.json({ error: "unit_id と name は必須です" }, { status: 400 });
  }
  if (!getUnitById(unit_id)) {
    return NextResponse.json({ error: "指定された単元が見つかりません" }, { status: 404 });
  }

  // コード衝突を避けるため最大5回リトライ
  let data = null;
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const res = await supabaseAdmin
      .from("sessions")
      .insert({ code, unit_id, name: name.trim() })
      .select()
      .single();
    if (!res.error) { data = res.data; break; }
    if (!res.error.message.includes("unique")) {
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }
  }
  if (!data) return NextResponse.json({ error: "コード生成に失敗しました" }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
