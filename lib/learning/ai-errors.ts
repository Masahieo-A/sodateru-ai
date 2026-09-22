export function publicAiError(error: unknown, fallback: string): { error: string; code?: string } {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 402 || /\[402\b|prepayment credits are depleted/i.test(message)) {
    return {
      error: "Gemini APIの前払い残高が不足しているため、AI機能を利用できません。管理者に連絡してください。",
      code: "PREPAID_CREDITS_DEPLETED",
    };
  }
  if (status === 404 && /model/i.test(message)) {
    return { error: "AIモデルを利用できません。管理者に連絡してください。", code: "AI_MODEL_UNAVAILABLE" };
  }
  return { error: fallback };
}
