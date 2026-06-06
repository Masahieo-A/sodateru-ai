import { NextRequest, NextResponse } from "next/server";
import { runTest } from "@/lib/gemini";
import { getUnitById } from "@/lib/questions";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { LessonMessage } from "@/types";

// POST /api/lesson/test — テスト問題をAIが解いてスコアを確定し、DBに保存
export async function POST(req: NextRequest) {
  try {
    const body: {
      unit_id?: string;
      dialogue?: LessonMessage[];
      student_id?: string;
      session_id?: string;
    } = await req.json();
    const { unit_id, dialogue, student_id, session_id } = body;

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

    const result = await runTest(unit, dialogue);

    // 授業モード: DB に保存してスコアを更新
    if (student_id && session_id) {
      // dialogue（教えた全内容）をテキスト化して保存
      const explanationText = dialogue
        .map((m) => `[${m.role === "teacher" ? "先生" : "AI"}] ${m.content}`)
        .join("\n");

      await supabaseAdmin.from("attempts").insert({
        student_id,
        session_id,
        explanation: explanationText,
        teaching_score: result.teaching_score,
        ai_correct_count: result.ai_correct_count,
        total_questions: result.total_questions,
        result_json: result,
      });

      const { data: student } = await supabaseAdmin
        .from("students")
        .select("best_score, attempt_count")
        .eq("id", student_id)
        .single();

      if (student) {
        await supabaseAdmin
          .from("students")
          .update({
            best_score: Math.max(student.best_score, result.teaching_score),
            attempt_count: student.attempt_count + 1,
            last_attempt_at: new Date().toISOString(),
          })
          .eq("id", student_id);
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/lesson/test]", err);
    return NextResponse.json(
      { error: "テスト評価中にエラーが発生しました。しばらく後に再試行してください。" },
      { status: 500 }
    );
  }
}
