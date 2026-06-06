import { NextRequest, NextResponse } from "next/server";
import { evaluateTeaching } from "@/lib/gemini";
import { getUnitById } from "@/lib/questions";
import { supabaseAdmin } from "@/lib/supabase-server";
import { TeachRequest } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body: TeachRequest & { student_id?: string; session_id?: string } = await req.json();
    const { unit_id, explanation, student_id, session_id } = body;

    if (!unit_id || !explanation?.trim()) {
      return NextResponse.json(
        { error: "unit_id と explanation は必須です" },
        { status: 400 }
      );
    }
    const unit = getUnitById(unit_id);
    if (!unit) {
      return NextResponse.json({ error: "指定された単元が見つかりません" }, { status: 404 });
    }
    if (explanation.trim().length < 20) {
      return NextResponse.json(
        { error: "説明文が短すぎます。もう少し詳しく教えてください。" },
        { status: 400 }
      );
    }

    const result = await evaluateTeaching(unit, explanation);

    // 授業モード: DB に保存してスコアを更新
    if (student_id && session_id) {
      // attempts に記録
      await supabaseAdmin.from("attempts").insert({
        student_id,
        session_id,
        explanation: explanation.trim(),
        teaching_score: result.teaching_score,
        ai_correct_count: result.ai_correct_count,
        total_questions: result.total_questions,
        result_json: result,
      });

      // 生徒の best_score と attempt_count を更新
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
    console.error("[/api/teach]", err);
    return NextResponse.json(
      { error: "AI評価中にエラーが発生しました。しばらく後に再試行してください。" },
      { status: 500 }
    );
  }
}
