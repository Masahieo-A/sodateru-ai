@AGENTS.md

# sodateru-ai（授業用AIアプリ）

- Next.js 16（App Router・TypeScript）+ Cloudflare D1/Workers（vinext）+ Google OIDC + Gemini API + Tailwind。
- コマンド: `npm run dev` / `build` / `start` / `lint`。
- デプロイ: GitHub `Masahieo-A/sodateru-ai` → Cloudflare Workers（vinext）。
- DBスキーマは `migrations/`。現行構成は `docs/構成.md`、旧設計の背景資料は DESIGN.md。
- Next.js は学習データと差分あり — AGENTS.md の指示どおり `node_modules/next/dist/docs/` を先に参照。
- ファイル役割: README.md=公開用 / docs/要件定義.md=機能要件（バイブコーディング時の正） / docs/構成.md=開発者向け構成メモ。
