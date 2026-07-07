@AGENTS.md

# sodateru-ai（授業用AIアプリ）

- Next.js 16（App Router・TypeScript）+ Supabase + Gemini API（@google/generative-ai）+ Tailwind。
- コマンド: `npm run dev` / `build` / `start` / `lint`。
- デプロイ: GitHub `Masahieo-A/sodateru-ai` → Vercel `sodateru-ai`（所有者が手動作成・Import、push は SSH のみ）。
- DBスキーマは `supabase/schema.sql`。設計資料は DESIGN.md。
- Next.js は学習データと差分あり — AGENTS.md の指示どおり `node_modules/next/dist/docs/` を先に参照。
- ファイル役割: README.md=公開用 / docs/要件定義.md=機能要件（バイブコーディング時の正） / docs/構成.md=開発者向け構成メモ。
