import { GrammarUnit } from "@/types";

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
    questions: [
      {
        id: 1,
        sentence: "This is the city ___ I was born.",
        blank: "___",
        answer: "where",
        hint: "場所を表す関係副詞",
      },
      {
        id: 2,
        sentence: "I remember the day ___ we first met.",
        blank: "___",
        answer: "when",
        hint: "時を表す関係副詞",
      },
      {
        id: 3,
        sentence: "That is the reason ___ he left early.",
        blank: "___",
        answer: "why",
        hint: "理由を表す関係副詞",
      },
      {
        id: 4,
        sentence: "The library ___ I study every day is very quiet.",
        blank: "___",
        answer: "where",
        hint: "場所を表す関係副詞",
      },
      {
        id: 5,
        sentence: "Do you know the way ___ she solved the problem?",
        blank: "___",
        answer: "how",
        hint: "方法を表す関係副詞",
      },
      {
        id: 6,
        sentence: "Summer is the season ___ I love most.",
        blank: "___",
        answer: "when",
        hint: "時を表す関係副詞",
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
    questions: [
      {
        id: 1,
        sentence: "The man ___ lives next door is a doctor.",
        blank: "___",
        answer: "who",
        hint: "人を先行詞とする主格の関係代名詞",
      },
      {
        id: 2,
        sentence: "The book ___ I read yesterday was interesting.",
        blank: "___",
        answer: "which",
        hint: "物を先行詞とする目的格の関係代名詞",
      },
      {
        id: 3,
        sentence: "She is the only person ___ can help me.",
        blank: "___",
        answer: "who",
        hint: "人を先行詞とする主格の関係代名詞",
      },
      {
        id: 4,
        sentence: "This is the house ___ I grew up in.",
        blank: "___",
        answer: "which",
        hint: "物を先行詞とする目的格の関係代名詞",
      },
      {
        id: 5,
        sentence: "The students ___ passed the exam were happy.",
        blank: "___",
        answer: "who",
        hint: "人を先行詞とする主格の関係代名詞",
      },
      {
        id: 6,
        sentence: "The movie ___ we watched last night was amazing.",
        blank: "___",
        answer: "which",
        hint: "物を先行詞とする目的格の関係代名詞",
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
    questions: [
      {
        id: 1,
        sentence: "This letter ___ written by Tom yesterday.",
        blank: "___",
        answer: "was",
        hint: "過去の受動態",
      },
      {
        id: 2,
        sentence: "English ___ spoken all over the world.",
        blank: "___",
        answer: "is",
        hint: "現在の受動態",
      },
      {
        id: 3,
        sentence: "The cake has ___ eaten by the children.",
        blank: "___",
        answer: "been",
        hint: "現在完了の受動態",
      },
      {
        id: 4,
        sentence: "The window ___ broken by the ball.",
        blank: "___",
        answer: "was",
        hint: "過去の受動態",
      },
      {
        id: 5,
        sentence: "The new museum will ___ opened next year.",
        blank: "___",
        answer: "be",
        hint: "未来の受動態",
      },
      {
        id: 6,
        sentence: "These shoes ___ made in Italy.",
        blank: "___",
        answer: "were",
        hint: "過去の受動態（複数主語）",
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
    questions: [
      {
        id: 1,
        sentence: "If I ___ a bird, I could fly.",
        blank: "___",
        answer: "were",
        hint: "仮定法過去（be動詞は were を使う）",
      },
      {
        id: 2,
        sentence: "If she had studied harder, she ___ have passed.",
        blank: "___",
        answer: "would",
        hint: "仮定法過去完了",
      },
      {
        id: 3,
        sentence: "I wish I ___ taller.",
        blank: "___",
        answer: "were",
        hint: "wish + 仮定法過去",
      },
      {
        id: 4,
        sentence: "If it ___ raining, we would go out.",
        blank: "___",
        answer: "weren't",
        hint: "仮定法過去（否定）",
      },
      {
        id: 5,
        sentence: "He talks as if he ___ everything.",
        blank: "___",
        answer: "knew",
        hint: "as if + 仮定法過去",
      },
      {
        id: 6,
        sentence: "If I ___ known the answer, I would have told you.",
        blank: "___",
        answer: "had",
        hint: "仮定法過去完了（if節）",
      },
    ],
  },
];

export function getUnitById(id: string): GrammarUnit | undefined {
  return GRAMMAR_UNITS.find((u) => u.id === id);
}
