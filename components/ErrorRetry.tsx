"use client";

import { AppIcon } from "@/components/AppIcon";

type Props = {
  message: string;
  /** 同じ attemptId で再送する再試行ハンドラ */
  onRetry?: () => void;
  /** 再試行以外の補足（例:「スキップして次に進むこともできます」） */
  note?: string;
};

/**
 * AI呼び出しエラーの共通表示（P0-1）。
 * 再試行できるエラーでは同じ attemptId で再送する。
 */
export function ErrorRetry({ message, onRetry, note }: Props) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-2">
      <p className="text-sm text-red-700"><AppIcon name="warning" /> {message}</p>
      {onRetry && <button
        onClick={onRetry}
        className="w-full py-2.5 px-4 bg-red-600 text-white font-bold rounded-xl
          hover:bg-red-700 transition-colors text-sm"
      >
        <AppIcon name="refresh" /> もう一度
      </button>}
      {note && onRetry && <p className="text-xs text-red-500 text-center">{note}</p>}
    </div>
  );
}
