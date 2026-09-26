# 育てるAI

> **このリポジトリは更新を終了しました（2026-09-26）。正本は [Masahieo-A/Aomatsu_web](https://github.com/Masahieo-A/Aomatsu_web) の `apps/app-sodateru-ai` に移転しています。** 本番URL: https://sodateru-ai.aomatsu-apps.workers.dev/

学習者がAIへ教え、AIの推論を確認・修正し、最後に独立問題で自分の理解も確かめる授業アプリです。

## 現行構成

- Next.js 16 / React 19 / TypeScript
- Cloudflare Workers（vinext）
- Cloudflare D1
- Google OpenID Connect（`tomidah.com` の確認済みアカウントのみ）
- Gemini API

教員権限は、`TEACHER_ALLOWLIST` またはD1の `teacher_allowlist` に登録したアカウントだけに付与します。

## ローカル起動

1. `.env.example` を参考に、Git管理外の `.dev.vars` を作成します。
2. D1マイグレーションを適用します。
3. vinext 開発サーバーを起動します。

```bash
npm ci
npx wrangler d1 migrations apply DB --local --config wrangler.jsonc
npm run dev:vinext
```

検証コマンド:

```bash
npm run lint
npm run typecheck
npm run build:vinext
npm audit --omit=dev
```

教材JSONの契約は `curriculum/schema/curriculum.schema.json`、例は `curriculum/examples/current-units.json` にあります。教材からJSONを生成するAI向け指示文は、運用時にチャットで渡し、リポジトリには保存しません。

詳細は [docs/構成.md](docs/構成.md) を参照してください。
