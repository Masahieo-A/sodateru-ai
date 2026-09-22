export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold">プライバシーポリシー</h1>
        <p className="mt-2 text-sm text-slate-500">最終更新日: 2026年9月22日</p>

        <div className="mt-8 space-y-6 leading-7">
          <section>
            <h2 className="text-xl font-semibold">1. 取得する情報</h2>
            <p className="mt-2">
              育てるAIは、Googleログインからメールアドレス、氏名、Googleアカウントの識別子を取得します。また、授業への参加、学習者の説明、練習・テストの回答、AIとの確認内容、得点および学習進捗を保存します。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. 利用目的</h2>
            <p className="mt-2">
              取得した情報は、学校ドメイン所属者の本人確認、授業の実施、学習支援、理解度の記録、教員による学習結果の確認、およびサービスの安全な運用のために利用します。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. 外部サービス</h2>
            <p className="mt-2">
              認証にはGoogle OAuth、データ保存とアプリ配信にはCloudflare、学習支援文の生成にはGoogle Gemini APIを利用します。学習支援に必要な範囲で入力内容がこれらのサービスに送信される場合があります。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. 情報の管理</h2>
            <p className="mt-2">
              保存情報へのアクセスは、認証済み利用者と権限を付与された教員に限定します。法令に基づく場合を除き、本人の同意なく第三者へ販売しません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. 問い合わせ・削除依頼</h2>
            <p className="mt-2">
              保存情報の確認、訂正、削除を希望する場合は、所属校の本サービス管理教員へお問い合わせください。
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
