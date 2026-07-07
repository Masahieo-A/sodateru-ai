"use client";

type Props = {
  message: string;
  /** 同じ attemptId で再送する再試行ハンドラ */
  onRetry: () => void;
  /** 再試行以外の補足（例:「スキップして次に進むこともできます」） */
  note?: string;
};

/**
 * AI呼び出しエラーの共通表示（P0-1）。
 * すべてのエラーに「🔄 もう一度」ボタンを付け、押下時は同じ attemptId で
 * 再送する（会話履歴はそのまま保持される）。
 */
export function ErrorRetry({ message, onRetry, note }: Props) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-2">
      <p className="text-sm text-red-700">⚠️ {message}</p>
      <button
        onClick={onRetry}
        className="w-full py-2.5 px-4 bg-red-600 text-white font-bold rounded-xl
          hover:bg-red-700 transition-colors text-sm"
      >
        🔄 もう一度
      </button>
      {note && <p className="text-xs text-red-500 text-center">{note}</p>}
    </div>
  );
}
