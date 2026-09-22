export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold">利用規約</h1>
        <p className="mt-2 text-sm text-slate-500">最終更新日: 2026年9月22日</p>

        <div className="mt-8 space-y-6 leading-7">
          <section>
            <h2 className="text-xl font-semibold">1. 目的</h2>
            <p className="mt-2">
              育てるAIは、学校の授業において、学習者が説明した内容をAIが確認し、練習と評価を支援する教育用サービスです。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. 利用条件</h2>
            <p className="mt-2">
              利用者は、所属校が許可したGoogleアカウントを用い、教員の指示および学校の情報利用規程に従って本サービスを利用してください。アカウントの共有や不正利用は禁止します。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. AI生成内容</h2>
            <p className="mt-2">
              AIの出力は学習支援を目的としており、常に正確であることを保証するものではありません。疑問がある場合は教材または担当教員に確認してください。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. サービスの変更</h2>
            <p className="mt-2">
              安全性、教育上の必要性、保守運用上の理由により、機能や提供条件を変更または停止することがあります。
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
