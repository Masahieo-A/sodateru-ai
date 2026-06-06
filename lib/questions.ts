import { GrammarUnit } from "@/types";

// ============================================================
// 育てるAI — 単元・問題データ
//
// ⚠️ ここの problem コンテンツ（practiceQuestions / testQuestions）は
//    サンプルです。各単元ごとに自由に差し替えてください。
//    - practiceQuestions: AIと1問ずつ対話しながら教え込む練習用（3問程度）
//    - testQuestions:     最後にAIが解いてスコアを確定するテスト用（6問程度）
//    各問は4択（choices）＋正解ラベル（answerLabel）で定義します。
// ============================================================

export const GRAMMAR_UNITS: GrammarUnit[] = [
  {
    id: "relative-adverb",
    name: "関係副詞",
    description: "where / when / why / how を使った関係節",
    teachingGuide: {
      assumedKnowledge: [
        "関係代名詞（who / which / that）の基本的な使い方",
        "場所・時・理由を表す副詞・接続詞（there, then, because など）",
      ],
      coverageTopics: [
        "場所を表す名詞が先行詞になるパターン",
        "時を表す名詞が先行詞になるパターン",
        "理由を表す名詞が先行詞になるパターン",
        "方法を表すパターン（先行詞の扱いに注意点あり）",
      ],
      thinkingPrompts: [
        "先行詞が「場所」「時」「理由」「方法」のとき、それぞれ何を使う？対応表を作るイメージで整理しよう",
        "「方法」を表すとき、先行詞と関係副詞の組み合わせには特別なルールがある。それは何だろう？",
        "関係副詞は節の中で副詞の代わりをしている。たとえば where は「そこで（and there）」に言い換えられる、と説明するとイメージが伝わりやすいかも",
      ],
    },
    practiceQuestions: [
      {
        id: 1,
        sentence: "This is the city ___ I was born.",
        choices: [
          { label: "A", text: "where" },
          { label: "B", text: "when" },
          { label: "C", text: "which" },
          { label: "D", text: "who" },
        ],
        answerLabel: "A",
        explanation:
          "先行詞 the city は「場所」なので where。when は時、which/who は関係代名詞で副詞の働きをしないため不可。",
        hint: "場所を表す関係副詞",
      },
      {
        id: 2,
        sentence: "I remember the day ___ we first met.",
        choices: [
          { label: "A", text: "where" },
          { label: "B", text: "when" },
          { label: "C", text: "why" },
          { label: "D", text: "how" },
        ],
        answerLabel: "B",
        explanation:
          "先行詞 the day は「時」なので when。where は場所、why は理由、how は方法用。",
        hint: "時を表す関係副詞",
      },
      {
        id: 3,
        sentence: "Do you know the way ___ she solved the problem?",
        choices: [
          { label: "A", text: "how" },
          { label: "B", text: "the way how" },
          { label: "C", text: "where" },
          { label: "D", text: "when" },
        ],
        answerLabel: "A",
        explanation:
          "「方法」は how だが、the way と how は併用できない。the way があるので how 単独ではなく…という引っかけ。正しくは the way / how のどちらか一方。ここでは how を選ぶ（the way how は誤用）。",
        hint: "方法を表す関係副詞（the way how は不可）",
      },
    ],
    testQuestions: [
      {
        id: 1,
        sentence: "That is the reason ___ he left early.",
        choices: [
          { label: "A", text: "where" },
          { label: "B", text: "when" },
          { label: "C", text: "why" },
          { label: "D", text: "which" },
        ],
        answerLabel: "C",
        explanation: "先行詞 the reason は「理由」なので why。",
      },
      {
        id: 2,
        sentence: "The library ___ I study every day is very quiet.",
        choices: [
          { label: "A", text: "where" },
          { label: "B", text: "when" },
          { label: "C", text: "who" },
          { label: "D", text: "why" },
        ],
        answerLabel: "A",
        explanation: "先行詞 the library は「場所」なので where。",
      },
      {
        id: 3,
        sentence: "Summer is the season ___ I love most.",
        choices: [
          { label: "A", text: "where" },
          { label: "B", text: "when" },
          { label: "C", text: "which" },
          { label: "D", text: "why" },
        ],
        answerLabel: "C",
        explanation:
          "the season を「目的語」として修飾しており、love の目的語が欠けているので関係代名詞 which。時の先行詞でも、節内で副詞ではなく目的語が欠ける場合は関係代名詞を使う点に注意。",
      },
      {
        id: 4,
        sentence: "Tell me the day ___ you are free.",
        choices: [
          { label: "A", text: "where" },
          { label: "B", text: "when" },
          { label: "C", text: "why" },
          { label: "D", text: "how" },
        ],
        answerLabel: "B",
        explanation: "the day は「時」なので when。",
      },
      {
        id: 5,
        sentence: "This is the village ___ my grandfather lives.",
        choices: [
          { label: "A", text: "where" },
          { label: "B", text: "which" },
          { label: "C", text: "when" },
          { label: "D", text: "who" },
        ],
        answerLabel: "A",
        explanation: "the village は「場所」、節内で副詞（there）が欠けるので where。",
      },
      {
        id: 6,
        sentence: "I don't know the reason ___ she is angry.",
        choices: [
          { label: "A", text: "how" },
          { label: "B", text: "when" },
          { label: "C", text: "why" },
          { label: "D", text: "where" },
        ],
        answerLabel: "C",
        explanation: "the reason は「理由」なので why。",
      },
    ],
  },
  {
    id: "relative-pronoun",
    name: "関係代名詞",
    description: "who / which / that / whom を使った関係節",
    teachingGuide: {
      assumedKnowledge: [
        "代名詞の主格・目的格の区別（he/him, she/her など）",
        "名詞を後ろから修飾する構造（形容詞節）の概念",
      ],
      coverageTopics: [
        "先行詞が「人」のとき、関係節内で主語の役割になるパターン",
        "先行詞が「物・事」のとき、主語または目的語の役割になるパターン",
        "先行詞が人でも物でも使える汎用的なパターン",
        "目的語として使う場合に適用される特別なルール",
      ],
      thinkingPrompts: [
        "先行詞が「人」か「物・事」かで使う語が変わる。それぞれ何を使う？",
        "関係節の中で「主語」として働くとき（主格）と「目的語」として働くとき（目的格）とで、何か変わるか？",
        "目的格の関係代名詞には、ある特徴的なルールがある。それを教えると理解が深まる",
      ],
    },
    practiceQuestions: [
      {
        id: 1,
        sentence: "The man ___ lives next door is a doctor.",
        choices: [
          { label: "A", text: "who" },
          { label: "B", text: "which" },
          { label: "C", text: "whom" },
          { label: "D", text: "where" },
        ],
        answerLabel: "A",
        explanation:
          "先行詞 the man は「人」で、節内で主語（lives の主語）なので主格 who。which は物用、whom は目的格。",
        hint: "人を先行詞とする主格",
      },
      {
        id: 2,
        sentence: "The book ___ I read yesterday was interesting.",
        choices: [
          { label: "A", text: "who" },
          { label: "B", text: "which" },
          { label: "C", text: "whose" },
          { label: "D", text: "what" },
        ],
        answerLabel: "B",
        explanation:
          "先行詞 the book は「物」で read の目的語が欠けている（目的格）ので which。人なら whom/who。",
        hint: "物を先行詞とする目的格",
      },
      {
        id: 3,
        sentence: "She is the only person ___ can help me.",
        choices: [
          { label: "A", text: "which" },
          { label: "B", text: "what" },
          { label: "C", text: "that" },
          { label: "D", text: "whose" },
        ],
        answerLabel: "C",
        explanation:
          "the only person のように only が付くと that が好まれる。who も可だが選択肢では that。which は物用、what は先行詞を含むため不可。",
        hint: "only が付く先行詞は that が好まれる",
      },
    ],
    testQuestions: [
      {
        id: 1,
        sentence: "This is the house ___ I grew up in.",
        choices: [
          { label: "A", text: "who" },
          { label: "B", text: "which" },
          { label: "C", text: "when" },
          { label: "D", text: "whose" },
        ],
        answerLabel: "B",
        explanation: "the house は物で in の目的語が欠ける（目的格）ので which。",
      },
      {
        id: 2,
        sentence: "The students ___ passed the exam were happy.",
        choices: [
          { label: "A", text: "who" },
          { label: "B", text: "which" },
          { label: "C", text: "whom" },
          { label: "D", text: "what" },
        ],
        answerLabel: "A",
        explanation: "the students は人で passed の主語（主格）なので who。",
      },
      {
        id: 3,
        sentence: "The movie ___ we watched last night was amazing.",
        choices: [
          { label: "A", text: "who" },
          { label: "B", text: "which" },
          { label: "C", text: "whose" },
          { label: "D", text: "where" },
        ],
        answerLabel: "B",
        explanation: "the movie は物で watched の目的語が欠ける（目的格）ので which。",
      },
      {
        id: 4,
        sentence: "I know a girl ___ mother is a famous singer.",
        choices: [
          { label: "A", text: "who" },
          { label: "B", text: "which" },
          { label: "C", text: "whose" },
          { label: "D", text: "whom" },
        ],
        answerLabel: "C",
        explanation:
          "「その女の子の母親」と所有関係を表すので所有格 whose。",
      },
      {
        id: 5,
        sentence: "The car ___ is parked outside is mine.",
        choices: [
          { label: "A", text: "who" },
          { label: "B", text: "which" },
          { label: "C", text: "whom" },
          { label: "D", text: "what" },
        ],
        answerLabel: "B",
        explanation: "the car は物で is parked の主語（主格）なので which。",
      },
      {
        id: 6,
        sentence: "He is a person ___ everyone respects.",
        choices: [
          { label: "A", text: "which" },
          { label: "B", text: "whom" },
          { label: "C", text: "whose" },
          { label: "D", text: "what" },
        ],
        answerLabel: "B",
        explanation:
          "a person は人で respects の目的語が欠ける（目的格）ので whom。which は物用。",
      },
    ],
  },
  {
    id: "passive-voice",
    name: "受動態",
    description: "be動詞 + 過去分詞 の構造",
    teachingGuide: {
      assumedKnowledge: [
        "be動詞の現在形（am / is / are）と過去形（was / were）",
        "過去分詞の作り方（規則変化：-ed、主な不規則変化）",
        "能動態の基本文構造（主語 ＋ 動詞 ＋ 目的語）",
      ],
      coverageTopics: [
        "現在形の受動態（〜される）",
        "過去形の受動態（〜された）※主語の数による違いあり",
        "未来形の受動態（〜されるだろう）",
        "現在完了形の受動態（すでに〜された）",
        "動作主を表す方法",
      ],
      thinkingPrompts: [
        "現在・過去・未来・現在完了、それぞれの時制で be動詞の形はどう変わる？時制ごとに整理して教えよう",
        "主語が単数のときと複数のときで、過去形の be動詞は何が変わる？",
        "現在完了の受動態は通常の受動態に何かが加わった形。その「加わる要素」を説明できると完璧",
        "動作を行った人や原因を文に含めたいとき、どのように表現するか？",
      ],
    },
    practiceQuestions: [
      {
        id: 1,
        sentence: "This letter ___ written by Tom yesterday.",
        choices: [
          { label: "A", text: "is" },
          { label: "B", text: "was" },
          { label: "C", text: "were" },
          { label: "D", text: "be" },
        ],
        answerLabel: "B",
        explanation:
          "yesterday があり過去・主語は単数なので was。is は現在、were は複数主語、be は原形。",
        hint: "過去・単数主語の受動態",
      },
      {
        id: 2,
        sentence: "English ___ spoken all over the world.",
        choices: [
          { label: "A", text: "is" },
          { label: "B", text: "was" },
          { label: "C", text: "are" },
          { label: "D", text: "been" },
        ],
        answerLabel: "A",
        explanation:
          "一般的事実＝現在・主語 English は単数なので is。are は複数主語、been は完了形で使う。",
        hint: "現在・単数主語の受動態",
      },
      {
        id: 3,
        sentence: "The cake has ___ eaten by the children.",
        choices: [
          { label: "A", text: "be" },
          { label: "B", text: "was" },
          { label: "C", text: "been" },
          { label: "D", text: "being" },
        ],
        answerLabel: "C",
        explanation:
          "現在完了の受動態 has been + 過去分詞。has の後ろは been。was/being は不可。",
        hint: "現在完了の受動態（has been + p.p.）",
      },
    ],
    testQuestions: [
      {
        id: 1,
        sentence: "The window ___ broken by the ball.",
        choices: [
          { label: "A", text: "is" },
          { label: "B", text: "was" },
          { label: "C", text: "were" },
          { label: "D", text: "been" },
        ],
        answerLabel: "B",
        explanation: "過去・単数主語なので was。",
      },
      {
        id: 2,
        sentence: "The new museum will ___ opened next year.",
        choices: [
          { label: "A", text: "is" },
          { label: "B", text: "be" },
          { label: "C", text: "was" },
          { label: "D", text: "been" },
        ],
        answerLabel: "B",
        explanation: "未来の受動態 will be + 過去分詞。助動詞 will の後ろは原形 be。",
      },
      {
        id: 3,
        sentence: "These shoes ___ made in Italy.",
        choices: [
          { label: "A", text: "is" },
          { label: "B", text: "was" },
          { label: "C", text: "were" },
          { label: "D", text: "be" },
        ],
        answerLabel: "C",
        explanation: "過去・複数主語 these shoes なので were。",
      },
      {
        id: 4,
        sentence: "Rice ___ grown in many Asian countries.",
        choices: [
          { label: "A", text: "is" },
          { label: "B", text: "are" },
          { label: "C", text: "were" },
          { label: "D", text: "been" },
        ],
        answerLabel: "A",
        explanation: "現在・単数主語 rice（不可算）なので is。",
      },
      {
        id: 5,
        sentence: "The report has ___ finished already.",
        choices: [
          { label: "A", text: "be" },
          { label: "B", text: "been" },
          { label: "C", text: "was" },
          { label: "D", text: "being" },
        ],
        answerLabel: "B",
        explanation: "現在完了の受動態 has been + 過去分詞。",
      },
      {
        id: 6,
        sentence: "The bridge ___ built two years ago.",
        choices: [
          { label: "A", text: "is" },
          { label: "B", text: "was" },
          { label: "C", text: "were" },
          { label: "D", text: "be" },
        ],
        answerLabel: "B",
        explanation: "two years ago があり過去・単数主語なので was。",
      },
    ],
  },
  {
    id: "subjunctive",
    name: "仮定法",
    description: "if 節を使った仮定・非現実の表現",
    teachingGuide: {
      assumedKnowledge: [
        "動詞の過去形（規則・不規則変化）",
        "助動詞 would / could / might の基本的な意味",
        "if節を使った条件文（現実的な条件：If it rains, I will ... など）",
      ],
      coverageTopics: [
        "現在の事実と異なることを仮定するパターン（if節を使う）",
        "過去の事実と異なることを仮定するパターン（if節を使う）",
        "「〜であればよかったのに」という願望を表すパターン",
        "「まるで〜のように」という様子を表すパターン",
      ],
      thinkingPrompts: [
        "「今もし〜なら」と「あの時もし〜だったなら」では、if節と主節それぞれの動詞の形がどう違う？時制の対応に注目して整理しよう",
        "仮定法でbe動詞を使うとき、主語に関わらず特定の形を使う。それは何か、そしてなぜそうなるか説明できると差がつく",
        "通常の条件文（直説法）と仮定法の違いは何か？「現実かどうか」という観点から説明すると伝わりやすい",
        "wish や as if の後に続く動詞の形は、仮定法のどのパターンと同じか？",
      ],
    },
    practiceQuestions: [
      {
        id: 1,
        sentence: "If I ___ a bird, I could fly.",
        choices: [
          { label: "A", text: "am" },
          { label: "B", text: "was" },
          { label: "C", text: "were" },
          { label: "D", text: "be" },
        ],
        answerLabel: "C",
        explanation:
          "仮定法過去では主語に関わらず be動詞は were を使う（I were）。was は口語では使われるが文法上は were が正式。",
        hint: "仮定法過去の be動詞は were",
      },
      {
        id: 2,
        sentence: "If she had studied harder, she ___ have passed.",
        choices: [
          { label: "A", text: "will" },
          { label: "B", text: "would" },
          { label: "C", text: "can" },
          { label: "D", text: "must" },
        ],
        answerLabel: "B",
        explanation:
          "仮定法過去完了：If + had + p.p., 主節は would/could/might have + p.p.。will は直説法用。",
        hint: "仮定法過去完了の主節（would have + p.p.）",
      },
      {
        id: 3,
        sentence: "I wish I ___ taller.",
        choices: [
          { label: "A", text: "am" },
          { label: "B", text: "was" },
          { label: "C", text: "were" },
          { label: "D", text: "will be" },
        ],
        answerLabel: "C",
        explanation:
          "wish + 仮定法過去。現在の事実に反する願望で be動詞は were。",
        hint: "wish + 仮定法過去",
      },
    ],
    testQuestions: [
      {
        id: 1,
        sentence: "If it ___ raining, we would go out.",
        choices: [
          { label: "A", text: "isn't" },
          { label: "B", text: "wasn't" },
          { label: "C", text: "weren't" },
          { label: "D", text: "won't be" },
        ],
        answerLabel: "C",
        explanation: "仮定法過去の否定。be動詞は主語に関わらず were → weren't。",
      },
      {
        id: 2,
        sentence: "He talks as if he ___ everything.",
        choices: [
          { label: "A", text: "know" },
          { label: "B", text: "knows" },
          { label: "C", text: "knew" },
          { label: "D", text: "will know" },
        ],
        answerLabel: "C",
        explanation: "as if + 仮定法過去。現在の事実に反するので過去形 knew。",
      },
      {
        id: 3,
        sentence: "If I ___ known the answer, I would have told you.",
        choices: [
          { label: "A", text: "have" },
          { label: "B", text: "had" },
          { label: "C", text: "has" },
          { label: "D", text: "would" },
        ],
        answerLabel: "B",
        explanation: "仮定法過去完了の if 節：If + had + p.p.。",
      },
      {
        id: 4,
        sentence: "If I were you, I ___ accept the offer.",
        choices: [
          { label: "A", text: "will" },
          { label: "B", text: "would" },
          { label: "C", text: "am going to" },
          { label: "D", text: "can" },
        ],
        answerLabel: "B",
        explanation: "仮定法過去の主節は would + 動詞原形。",
      },
      {
        id: 5,
        sentence: "I wish I ___ harder when I was young.",
        choices: [
          { label: "A", text: "studied" },
          { label: "B", text: "had studied" },
          { label: "C", text: "study" },
          { label: "D", text: "have studied" },
        ],
        answerLabel: "B",
        explanation:
          "過去の事実に反する後悔の願望 wish + 仮定法過去完了 had + p.p.。",
      },
      {
        id: 6,
        sentence: "If he had left earlier, he ___ caught the train.",
        choices: [
          { label: "A", text: "would have" },
          { label: "B", text: "would" },
          { label: "C", text: "will have" },
          { label: "D", text: "had" },
        ],
        answerLabel: "A",
        explanation:
          "仮定法過去完了の主節：would have + 過去分詞（caught）。",
      },
    ],
  },
];

export function getUnitById(id: string): GrammarUnit | undefined {
  return GRAMMAR_UNITS.find((u) => u.id === id);
}
