import { NextRequest, NextResponse } from "next/server";
import { learningSummary } from "@/lib/gemini";
import { getUnitById } from "@/lib/questions";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { LessonMessage } from "@/types";

// POST /api/lesson/summary — 生徒AIの学習内容をまとめる
export async function POST(req: NextRequest) {
  try {
    const body: {
      unit_id?: string;
      dialogue?: LessonMessage[];
      student_id?: string;
    } = await req.json();
    const { unit_id, dialogue, student_id } = body;

    if (!unit_id || !dialogue) {
      return NextResponse.json(
        { error: "unit_id / dialogue は必須です" },
        { status: 400 }
      );
    }

    const unit = getUnitById(unit_id);
    if (!unit) {
      return NextResponse.json(
        { error: "指定された単元が見つかりません" },
        { status: 404 }
      );
    }

    const summary = await learningSummary(unit, dialogue);

    // 授業モード: 対話ログとサマリーをサーバー保存。
    // 以降のテストはこれを「正」として使い、クライアント側の改ざんを防ぐ
    // （さらにテストではサマリーを渡してトークンを削減する）。
    if (student_id) {
      const teachingSummaryText = [
        "【教わった内容】",
        ...summary.taught.map((t) => `- ${t}`),
        "【理解できたこと】",
        ...summary.learned.map((t) => `- ${t}`),
        ...(summary.gaps.length
          ? ["【まだあいまいなこと】", ...summary.gaps.map((t) => `- ${t}`)]
          : []),
      ].join("\n");

      await supabaseAdmin
        .from("students")
        .update({
          dialogue_log: dialogue,
          teaching_summary: teachingSummaryText,
        })
        .eq("id", student_id);
    }

    return NextResponse.json(summary);
  } catch (err) {
    console.error("[/api/lesson/summary]", err);
    return NextResponse.json(
      { error: "学習内容のまとめ中にエラーが発生しました。しばらく後に再試行してください。" },
      { status: 500 }
    );
  }
}
