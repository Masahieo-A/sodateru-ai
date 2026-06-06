# 育てるAI — 設計・使用書

> AIに英文法を「教える」ことで、自分自身の理解と説明力を高める学習Webアプリ

---

## 目次

1. [コンセプト](#1-コンセプト)
2. [技術スタック](#2-技術スタック)
3. [ディレクトリ構成](#3-ディレクトリ構成)
4. [セットアップ手順](#4-セットアップ手順)
5. [使い方（ユーザー向け）](#5-使い方ユーザー向け)
6. [アーキテクチャ設計](#6-アーキテクチャ設計)
7. [AIプロンプト設計（知識制御）](#7-aiプロンプト設計知識制御)
8. [データ型定義](#8-データ型定義)
9. [APIリファレンス](#9-apiリファレンス)
10. [問題セット一覧](#10-問題セット一覧)
11. [スコア評価の仕組み](#11-スコア評価の仕組み)
12. [Supabaseセットアップ](#12-supabaseセットアップ)
13. [今後の拡張予定（Phase 3）](#13-今後の拡張予定phase-3)
3. [ディレクトリ構成](#3-ディレクトリ構成)
4. [セットアップ手順](#4-セットアップ手順)
5. [使い方（ユーザー向け）](#5-使い方ユーザー向け)
6. [アーキテクチャ設計](#6-アーキテクチャ設計)
7. [AIプロンプト設計（知識制御）](#7-aiプロンプト設計知識制御)
8. [データ型定義](#8-データ型定義)
9. [APIリファレンス](#9-apiリファレンス)
10. [問題セット一覧](#10-問題セット一覧)
11. [スコア評価の仕組み](#11-スコア評価の仕組み)
12. [今後の拡張予定（Phase 2以降）](#12-今後の拡張予定phase-2以降)

---

## 1. コンセプト

### 学習の逆転：AIに「教える」

一般的な生成AI活用では、生徒がAIから答えやヒントを「もらう」。  
本アプリはその逆で、**生徒がAIに英文法を「教え」**、AIは教わった内容だけを使って問題を解く。

```
通常:  生徒 ──質問→ AI ──答え→ 生徒
育てるAI: 生徒 ──説明→ AI ──解答・思考過程→ 生徒（自分の説明の穴に気づく）
```

### 教育的根拠

- **Learning by Teaching**（教えることで学ぶ）：教育心理学で実証されている学習促進効果
- **Teachable Agent**研究（Betty's Brain等）の系譜：エージェントに教える設計が理解深化に結びつく
- AIが「迷った箇所・不足知識」を可視化することで、学習者のメタ認知を誘発する

### 本アプリの独自性

| 点 | 内容 |
|---|---|
| 知識制御 | Geminiに「教わった知識だけで解く」よう制約するガードレール設計 |
| 思考過程可視化 | AIがどの説明をどう使ったか・どこで迷ったかをテキストで提示 |
| スコア化 | 教え方の正確性・明確さ・網羅性を100点満点でスコアリング |
| 反復改善 | フィードバックを受けて説明を改善し、何度でも再挑戦できる |

---

## 2. 技術スタック

| 層 | 採用技術 | バージョン |
|---|---|---|
| フレームワーク | **Next.js** (App Router) | 16.2.6 |
| 言語 | **TypeScript** | ^5 |
| スタイリング | **Tailwind CSS** | ^4 |
| AIモデル | **Google Gemini 2.5 Flash** | — |
| AI SDK | **@google/generative-ai** | ^0.24.1 |
| ユーティリティ | clsx / tailwind-merge | — |
| ランタイム | Node.js / Vercel Edge 対応 | — |

---

## 3. ディレクトリ構成

```
sodateru-ai/
│
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # ルートレイアウト
│   ├── page.tsx                      # ホーム（個人練習 + 授業入口）
│   ├── globals.css
│   ├── join/
│   │   └── page.tsx                  # 生徒: 参加コード入力
│   ├── session/[code]/
│   │   └── page.tsx                  # 生徒: 待機→授業→ランキング
│   ├── teacher/
│   │   ├── page.tsx                  # 教員: ログイン
│   │   ├── dashboard/
│   │   │   └── page.tsx              # 教員: セッション一覧・作成
│   │   └── session/[id]/
│   │       └── page.tsx              # 教員: リアルタイムランキング・管理
│   └── api/
│       ├── teach/route.ts            # POST /api/teach（Gemini評価 + DB保存）
│       ├── teacher/route.ts          # POST /api/teacher（教員認証）
│       └── sessions/
│           ├── route.ts              # GET/POST /api/sessions
│           └── [code]/
│               ├── route.ts          # GET /api/sessions/[code]
│               ├── join/route.ts     # POST /api/sessions/[code]/join
│               ├── start/route.ts    # POST /api/sessions/[code]/start
│               └── end/route.ts      # POST /api/sessions/[code]/end
│
├── components/
│   ├── UnitSelector.tsx              # 単元選択カード
│   ├── TeachingInput.tsx             # 説明文入力フォーム
│   └── ResultDisplay.tsx             # スコア・思考過程表示
│
├── lib/
│   ├── gemini.ts                     # Gemini 2.5 Flash クライアント
│   ├── questions.ts                  # 単元・問題セット定義
│   ├── supabase.ts                   # Supabaseクライアント（anon key）
│   ├── supabase-server.ts            # Supabaseサーバークライアント（service role）
│   └── utils.ts
│
├── types/index.ts                    # 全TypeScript型定義
├── supabase/schema.sql               # DBスキーマ（Supabase SQL Editorで実行）
├── .env.local                        # 環境変数 ※gitignore対象
├── .env.example                      # 環境変数サンプル
└── DESIGN.md                         # 本ドキュメント
```

---

## 4. セットアップ手順

### 必要なもの

- Node.js 18以上
- Google AI Studio の Gemini APIキー → https://aistudio.google.com/apikey
- Supabase アカウント（無料）→ https://supabase.com

### Step 1: 依存関係のインストール

```bash
cd sodateru-ai
npm install
```

### Step 2: Supabase プロジェクト作成

1. https://supabase.com でプロジェクトを新規作成
2. **SQL Editor** を開き `supabase/schema.sql` の内容を貼り付けて実行
3. **Project Settings > API** からキーを確認

### Step 3: 環境変数の設定

`.env.local` を編集：

```env
GEMINI_API_KEY=AIzaSy...（Gemini APIキー）

NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...（anon key）
SUPABASE_SERVICE_ROLE_KEY=eyJ...（service_role key）

TEACHER_PASSWORD=（教員パスワードに使う任意の文字列）
```

### Step 4: 起動

```bash
npm run dev
# → http://localhost:3000
```

### ビルド・本番起動

```bash
npm run build
npm run start
```

---

## 5. 使い方（ユーザー向け）

### 【授業モード】の使い方

#### 教員の操作手順

1. `http://localhost:3000/teacher` にアクセス
2. `.env.local` に設定した `TEACHER_PASSWORD` を入力してログイン
3. **ダッシュボード**で「授業名」と「単元」を入力してセッション作成
4. 発行された **6文字の参加コード** を生徒に伝える（黒板・投影など）
5. 「管理」ボタンでセッション画面を開き **「授業を開始する」** をクリック
6. リアルタイムランキングで生徒のスコアをリアルタイム確認
7. 授業終了後「授業を終了する」をクリック

#### 生徒の操作手順

1. `http://localhost:3000/join` にアクセス（またはトップページから「授業に参加する」）
2. 教員から伝えられた **参加コード**（6文字）とニックネームを入力
3. 待機画面で教員のスタートを待つ
4. 授業開始後 → 教える → スコア確認 → 改善して再挑戦　を繰り返す

---

### 【個人練習モード】の使い方

トップページ下部「または個人で練習」から単元を選んで開始。

### ステップ1：単元を選ぶ

トップ画面に4つの英文法単元が表示されます。学習したい単元をタップ。

```
📚 単元一覧
┌─────────────┐ ┌─────────────┐
│ 関係副詞    │ │ 関係代名詞  │
│ 6問         │ │ 6問         │
└─────────────┘ └─────────────┘
┌─────────────┐ ┌─────────────┐
│ 受動態      │ │ 仮定法      │
│ 6問         │ │ 6問         │
└─────────────┘ └─────────────┘
```

### ステップ2：AIに教える

テキストエリアに、選んだ文法のルールを **自分の言葉で** 説明します。

**入力のコツ：**
- 「〇〇は〜のときに使う」という使い分けを書く
- 例文を添えると AIが理解しやすい
- 注意点・例外も書くとスコアが上がる

**入力例（関係副詞の場合）：**
```
関係副詞はwhere/when/why/howの4種類があります。
whereは場所を表す先行詞につきます（the city, the placeなど）。
whenは時を表す先行詞につきます（the day, the timeなど）。
whyはthe reasonとセットで使います。
howは「方法」を表し、先行詞なしで使います。
例：This is the city where I was born.
例：I remember the day when we met.
```

「✅ 送信できます」が出たら「🚀 AIに教える」ボタンを押す。

### ステップ3：結果を確認する

AIが教わった内容だけを使って問題を解き、以下を返します。

| 表示項目 | 内容 |
|---|---|
| **教え方スコア** | 0〜100点（説明の質の総合評価） |
| **AI正答率** | 何問正解したか（例：6/6問） |
| **スコア内訳** | 正確性・わかりやすさ・網羅性の3指標 |
| **AIのフィードバック** | 良かった点と具体的な改善アドバイス |
| **AIが迷った・わからなかったこと** | 説明の穴の具体的なリスト |
| **問題ごとの回答と思考過程** | AIがどの説明を使って解いたかを問ごとに表示 |

### ステップ4：再挑戦

「🔄 説明を改善して再挑戦」ボタンを押すと入力画面に戻ります。  
前回のスコアと比較しながら、説明を改善して何度でも挑戦できます。

ヘッダー右上に**最高スコア**が表示されます。

---

## 6. アーキテクチャ設計

### 画面遷移（全体）

```
/（ホーム）
├── /join  ─────────────────────────────────────────────────┐
│   └── /session/[code]                                      │
│         ├── waiting: 待機（教員スタート待ち）              │ 生徒
│         ├── active:  教える→結果→ランキング               │
│         └── ended:   終了・最終ランキング                  │
│                                                            ┘
└── /teacher  ──────────────────────────────────────────────┐
    └── /teacher/dashboard                                   │
          └── /teacher/session/[id]                          │ 教員
                ├── 参加者一覧・スタート                     │
                └── リアルタイムランキング                   │
                                                             ┘
```

### データフロー（授業モード）

```
生徒ブラウザ
  ↓ POST /api/sessions/[code]/join  { name }
  ← { student, session }（localStorage に保存）

教員ブラウザ
  ↓ POST /api/sessions/[code]/start
  → Supabase sessions.status = "active"
  → 生徒画面が Realtime で検知 → 授業開始画面に切替

生徒ブラウザ
  ↓ POST /api/teach  { unit_id, explanation, student_id, session_id }
  → Gemini 2.5 Flash で評価
  → attempts に記録 / students.best_score を更新
  ← TeachResult
  → Supabase Realtime → 全員のランキングが即時更新
```

### コンポーネント責務

| ファイル | 責務 |
|---|---|
| `app/page.tsx` | ホーム（個人練習 + 授業入口） |
| `app/join/page.tsx` | 参加コード・ニックネーム入力 |
| `app/session/[code]/page.tsx` | 生徒セッション全体（待機・授業・ランキング） |
| `app/teacher/page.tsx` | 教員ログイン |
| `app/teacher/dashboard/page.tsx` | セッション作成・一覧 |
| `app/teacher/session/[id]/page.tsx` | リアルタイムランキング・開始/終了 |
| `components/UnitSelector` | 単元カード選択 |
| `components/TeachingInput` | 説明入力フォーム・バリデーション |
| `components/ResultDisplay` | スコア・思考過程・フィードバック表示 |

---

## 7. AIプロンプト設計（知識制御）

本アプリの核心部分。Geminiに「教わった知識だけで解く」よう制約します。

### プロンプト構造

```
[役割定義]
あなたは「{unit.name}」について全く知識がない英語学習者です。

[ルール（ガードレール）]
- 先生が教えた内容以外の英文法知識は絶対に使ってはいけません
- 先生が教えていないことは「教えてもらっていない」と正直に述べてください
- 問題ごとに思考過程を日本語で示してください

[先生の説明（生徒が入力したテキスト）]
---
{explanation}
---

[問題]
問題1: "..." の ___ に入る語句を答えてください。
...

[出力形式（JSON固定）]
{
  "answers": [...],
  "missing_knowledge": [...],
  "teaching_score": 0-100,
  "score_breakdown": { "accuracy": 0-100, "clarity": 0-100, "completeness": 0-100 },
  "feedback": "...",
  "ai_correct_count": N,
  "total_questions": N
}
```

### Gemini設定

| 設定項目 | 値 | 理由 |
|---|---|---|
| `model` | `gemini-2.5-flash` | 高速・高精度・JSON対応 |
| `responseMimeType` | `application/json` | 構造化出力を強制 |
| `temperature` | `0.3` | 低めに設定し安定した評価を得る |

---

## 8. データ型定義

`types/index.ts` で定義されています。

```typescript
// 単元（英文法カテゴリ）
type GrammarUnit = {
  id: string;           // "relative-adverb" など
  name: string;         // "関係副詞"
  description: string;  // "where / when / why / how を使った関係節"
  questions: Question[];
};

// 穴埋め問題
type Question = {
  id: number;
  sentence: string;  // "This is the city ___ I was born."
  blank: string;     // "___"
  answer: string;    // "where"
  hint?: string;     // "場所を表す関係副詞"
};

// Geminiが返す各問の回答
type AIAnswer = {
  question_id: number;
  answer: string;    // AIの回答
  thinking: string;  // 思考過程（日本語）
  is_correct: boolean;
};

// /api/teach の完全なレスポンス
type TeachResult = {
  answers: AIAnswer[];
  missing_knowledge: string[];     // 不足していた知識のリスト
  teaching_score: number;          // 総合スコア（0-100）
  score_breakdown: {
    accuracy: number;              // 正確性
    clarity: number;               // わかりやすさ
    completeness: number;          // 網羅性
  };
  feedback: string;                // 先生へのフィードバック文
  ai_correct_count: number;        // AIの正解数
  total_questions: number;         // 総問題数
};

// APIリクエスト
type TeachRequest = {
  unit_id: string;      // 単元ID
  explanation: string;  // 生徒が入力した説明文
};
```

---

## 9. APIリファレンス

### `POST /api/teach`

生徒の説明文をGeminiに送り、評価結果を返します。

**リクエスト**

```json
{
  "unit_id": "relative-adverb",
  "explanation": "関係副詞はwhere/when/why/howの4種類があります。..."
}
```

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `unit_id` | string | ✅ | 単元ID（下記一覧参照） |
| `explanation` | string | ✅ | 生徒の説明文（20文字以上） |

**レスポンス（200 OK）**

```json
{
  "answers": [
    {
      "question_id": 1,
      "answer": "where",
      "thinking": "先生がwhereは場所を表す先行詞につくと説明したので...",
      "is_correct": true
    }
  ],
  "missing_knowledge": ["howの具体的な例文がなかった"],
  "teaching_score": 75,
  "score_breakdown": {
    "accuracy": 95,
    "clarity": 80,
    "completeness": 40
  },
  "feedback": "whereとwhenの説明は例文が明確で分かりやすかった。howの例文を追加するとさらに良くなります。",
  "ai_correct_count": 6,
  "total_questions": 6
}
```

**エラーレスポンス**

| ステータス | 条件 | メッセージ |
|---|---|---|
| 400 | unit_id または explanation が未指定 | `"unit_id と explanation は必須です"` |
| 400 | 説明文が20文字未満 | `"説明文が短すぎます。..."` |
| 404 | 存在しない unit_id | `"指定された単元が見つかりません"` |
| 500 | Gemini APIエラー | `"AI評価中にエラーが発生しました。..."` |

---

## 10. 問題セット一覧

`lib/questions.ts` に定義。各単元6問の穴埋め形式。

### 関係副詞（`relative-adverb`）

| # | 問題文 | 正解 |
|---|---|---|
| 1 | This is the city ___ I was born. | where |
| 2 | I remember the day ___ we first met. | when |
| 3 | That is the reason ___ he left early. | why |
| 4 | The library ___ I study every day is very quiet. | where |
| 5 | Do you know the way ___ she solved the problem? | how |
| 6 | Summer is the season ___ I love most. | when |

### 関係代名詞（`relative-pronoun`）

| # | 問題文 | 正解 |
|---|---|---|
| 1 | The man ___ lives next door is a doctor. | who |
| 2 | The book ___ I read yesterday was interesting. | which |
| 3 | She is the only person ___ can help me. | who |
| 4 | This is the house ___ I grew up in. | which |
| 5 | The students ___ passed the exam were happy. | who |
| 6 | The movie ___ we watched last night was amazing. | which |

### 受動態（`passive-voice`）

| # | 問題文 | 正解 |
|---|---|---|
| 1 | This letter ___ written by Tom yesterday. | was |
| 2 | English ___ spoken all over the world. | is |
| 3 | The cake has ___ eaten by the children. | been |
| 4 | The window ___ broken by the ball. | was |
| 5 | The new museum will ___ opened next year. | be |
| 6 | These shoes ___ made in Italy. | were |

### 仮定法（`subjunctive`）

| # | 問題文 | 正解 |
|---|---|---|
| 1 | If I ___ a bird, I could fly. | were |
| 2 | If she had studied harder, she ___ have passed. | would |
| 3 | I wish I ___ taller. | were |
| 4 | If it ___ raining, we would go out. | weren't |
| 5 | He talks as if he ___ everything. | knew |
| 6 | If I ___ known the answer, I would have told you. | had |

---

## 11. スコア評価の仕組み

### 教え方スコア（0〜100点）

Geminiが以下の3観点を評価し、総合スコアを算出します。

| 観点 | 内容 | 高スコアの条件 |
|---|---|---|
| **正確性**（accuracy） | 説明の内容が文法的に正しいか | 誤った説明・誤用がない |
| **わかりやすさ**（clarity） | 表現が明瞭で理解しやすいか | 簡潔・具体的・例文あり |
| **網羅性**（completeness） | 問題を解くのに必要な情報が揃っているか | 全パターン・例外も網羅 |

### スコアの目安

| スコア | 評価 | 色 |
|---|---|---|
| 80〜100 | 優秀な説明 | 緑 |
| 60〜79 | 改善の余地あり | 黄 |
| 0〜59 | 要改善 | 赤 |

### AI正答率との関係

- 説明の**正確性**が低い → AIが誤答する（教えた内容が間違っていた）
- 説明の**網羅性**が低い → AIが問題を解けない（必要な情報がなかった）
- 説明の**わかりやすさ**が低い → AIが迷う（曖昧な説明で思考過程が長くなる）

---

## 12. Supabaseセットアップ

### DBテーブル構成

| テーブル | 役割 |
|---|---|
| `sessions` | 授業セッション（コード・単元・ステータス） |
| `students` | セッション参加者（名前・ベストスコア・試行回数） |
| `attempts` | 各試行の記録（説明文・スコア・Gemini応答JSON） |

### Realtime 設定

`supabase/schema.sql` の最後に以下が含まれています：

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE students;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
```

Supabase ダッシュボードの **Database > Replication** で `students` と `sessions` テーブルの Realtime が有効になっているか確認してください。

### 教員認証の仕組み

簡易的なパスワード認証を採用：

1. 教員が `/teacher` でパスワード入力
2. `POST /api/teacher` でサーバー側の `TEACHER_PASSWORD` 環境変数と照合
3. 一致すれば `localStorage` にパスワードを保存
4. 以降の教員用APIコールは `x-teacher-password` ヘッダーにパスワードを付与

> **注意**: これは試運転用の簡易認証です。本番運用時は Supabase Auth などへの移行を検討してください。

---

## 13. 今後の拡張予定（Phase 3）

実際の試運転を経てブラッシュアップ後に構築予定。

| 機能 | 内容 |
|---|---|
| 単元追加 | 不定詞・動名詞・比較表現など |
| カスタム問題 | 教員が独自の穴埋め問題を登録できる |
| 難易度設定 | 問題の難易度をAIが動的に調整 |
| 生徒の成長グラフ | スコア推移の可視化 |
| 忘却機能 | 教え方の品質に応じてAIが意図的に「忘れる」実装 |

---

*作成日：2026-05-26 / Phase 1+2 実装完了時点*
