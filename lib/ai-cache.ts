import { supabaseAdmin } from "./supabase-server";

// ============================================================
// AI応答の冪等化キャッシュ
//
// クライアントは各AI呼び出しに attemptId（uuid等）を付ける。
// 成功レスポンスを Supabase の ai_responses テーブルにキャッシュし、
// 同一 attemptId の再呼び出しにはキャッシュを返す。
// → 再試行ボタンの連打・「戻る」操作で同じターンが二重生成されない。
//
// テーブルが未作成でもアプリは止めない（キャッシュなしで動作継続）。
// ============================================================

export async function getCachedAiResponse<T>(
  attemptId: string | undefined | null
): Promise<T | null> {
  if (!attemptId) return null;
  try {
    const { data } = await supabaseAdmin
      .from("ai_responses")
      .select("response")
      .eq("attempt_id", attemptId)
      .maybeSingle();
    return (data?.response as T) ?? null;
  } catch (err) {
    console.warn("[ai-cache] read failed (continuing without cache):", err);
    return null;
  }
}

export async function cacheAiResponse(
  attemptId: string | undefined | null,
  response: unknown
): Promise<void> {
  if (!attemptId) return;
  try {
    const { error } = await supabaseAdmin
      .from("ai_responses")
      .upsert({ attempt_id: attemptId, response });
    if (error) {
      console.warn("[ai-cache] write failed (continuing):", error.message);
    }
  } catch (err) {
    console.warn("[ai-cache] write failed (continuing):", err);
  }
}
