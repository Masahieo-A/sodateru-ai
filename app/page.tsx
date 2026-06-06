export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* ヘッダー */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <span className="text-2xl">🌱</span>
          <span className="font-black text-indigo-700 text-lg">育てるAI</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="space-y-8">
          <div className="text-center py-6">
            <div className="text-6xl mb-4">🌱</div>
            <h1 className="text-3xl font-black text-gray-900 mb-3">育てるAI</h1>
            <p className="text-gray-600 leading-relaxed">
              AIに英文法を<span className="font-bold text-indigo-600">教えて</span>みよう。
              <br />
              基本を教え、AIと対話しながら練習し、最後はテストで力試し。
              <br />
              あなたの教え方が、AIの理解度を決める。
            </p>
          </div>

          {/* 入口 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="/join"
              className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors text-center shadow-md"
            >
              <span className="text-3xl">🎓</span>
              <span className="text-lg">授業に参加する</span>
              <span className="text-xs font-normal opacity-80">
                参加コードを入力して始める
              </span>
            </a>
            <a
              href="/teacher"
              className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-white border-2 border-indigo-200 text-indigo-700 font-bold hover:border-indigo-400 transition-colors text-center"
            >
              <span className="text-3xl">👩‍🏫</span>
              <span className="text-lg">教員用ページ</span>
              <span className="text-xs font-normal opacity-60">
                授業セッションを作成・管理
              </span>
            </a>
          </div>

          {/* 流れの説明 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-800 mb-4 text-center">学習の流れ</h2>
            <ol className="space-y-3">
              {[
                ["📝", "基本を教える", "AIに文法の基本ルールを説明する"],
                ["💬", "対話で練習", "AIが練習問題を解き、つまずきを質問。あなたが追加で教える"],
                ["📖", "学習内容を確認", "AIが何を学んだかをまとめて振り返る"],
                ["🎯", "テストでスコア", "AIがテストに挑戦。あなたの教え方が採点される"],
              ].map(([icon, title, desc], i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{icon}</span>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">
                      {i + 1}. {title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
