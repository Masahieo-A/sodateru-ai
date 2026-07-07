// ============================================================
// 参加者情報の localStorage 管理（P2-6）
//
// キーはセッションコード単位（sodateru:participant:{CODE}）。
// /join の submit 時は常にサーバで参加者を作成/取得し、レスポンスで
// ここを上書きする（キャッシュ読み出しで join をスキップしない）。
// 共有端末で別セッション・別ニックネームが混ざらないようにする。
// ============================================================

export type StoredParticipant = {
  studentId: string;
  studentName: string;
  sessionId: string;
};

const keyFor = (sessionCode: string) =>
  `sodateru:participant:${sessionCode.toUpperCase()}`;

export function loadParticipant(sessionCode: string): StoredParticipant | null {
  try {
    const raw = localStorage.getItem(keyFor(sessionCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredParticipant>;
    if (!parsed.studentId || !parsed.studentName || !parsed.sessionId) return null;
    return parsed as StoredParticipant;
  } catch {
    return null;
  }
}

export function saveParticipant(
  sessionCode: string,
  participant: StoredParticipant
): void {
  localStorage.setItem(keyFor(sessionCode), JSON.stringify(participant));
}

/** 「別の名前で参加し直す」用：該当セッションの参加者情報を破棄する */
export function clearParticipant(sessionCode: string): void {
  localStorage.removeItem(keyFor(sessionCode));
}
