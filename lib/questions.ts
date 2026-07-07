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
        requiredTopics: [0],
        explanation:
          "先行詞 the city は「場所」なので where。when は時、which/who は関係代名詞で副詞の働きをしないため不可。",
        hint: "場所を表す関係副詞",
        commonMistake: {
          label: "C",
          misconception:
            "the city という名詞を修飾するのだから、名詞につなぐのは関係代名詞 which だと考えて選んでしまう（後ろの文で主語や目的語は欠けておらず、「そこで」という副詞の働きが必要になっている、という点まで見られていない）。",
        },
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
        requiredTopics: [1],
        explanation:
          "先行詞 the day は「時」なので when。where は場所、why は理由、how は方法用。",
        hint: "時を表す関係副詞",
        commonMistake: {
          label: "A",
          misconception:
            "「私たちが初めて出会ったところ」と、出会った場面（場所）を思い浮かべてしまい、その感覚のまま where を選んでしまう（先行詞 the day が「時」を表す名詞である、という確認より場面のイメージが先に立っている）。",
        },
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
        requiredTopics: [3],
        explanation:
          "「方法」は how だが、the way と how は併用できない。the way があるので how 単独ではなく…という引っかけ。正しくは the way / how のどちらか一方。ここでは how を選ぶ（the way how は誤用）。",
        hint: "方法を表す関係副詞（the way how は不可）",
        commonMistake: {
          label: "B",
          misconception:
            "先生に「how＝方法」と教わったので、the way（方法）と how を一緒に並べれば『方法』をより正確に表せると思い込み、the way how を選んでしまう（the way と how は併用できない、という点までは咀嚼しきれていない）。",
        },
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
        requiredTopics: [2],
        explanation: "先行詞 the reason は「理由」なので why。",
        commonMistake: {
          label: "D",
          misconception:
            "the reason は人ではない「物・事」の名詞なので、物には which という対応をそのまま当てはめて選んでしまう（節の中で欠けているのは「その理由で」という副詞の働きであり、関係副詞 why が必要という見方ができていない）。",
        },
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
        requiredTopics: [0],
        explanation: "先行詞 the library は「場所」なので where。",
        commonMistake: {
          label: "B",
          misconception:
            "every day という時間の表現が目に入り、「毎日勉強する時」の話だと感じて when を選んでしまう（先行詞が the library（場所）であることより、節の中の時間表現に引っ張られている）。",
        },
      },
      {
        id: 3,
        sentence: "This is the restaurant ___ we had dinner last night.",
        choices: [
          { label: "A", text: "where" },
          { label: "B", text: "when" },
          { label: "C", text: "which" },
          { label: "D", text: "why" },
        ],
        answerLabel: "A",
        requiredTopics: [0],
        explanation:
          "先行詞 the restaurant は「場所」で、節内で副詞（there＝そこで）が欠けるので関係副詞 where。had dinner は自動詞的に完結しており目的語は欠けていないため、関係代名詞 which は不可。",
        commonMistake: {
          label: "C",
          misconception:
            "the restaurant は物の名詞だから、名詞につなぐのは関係代名詞 which だと考えて選んでしまう（had dinner のあとに目的語の欠けはなく、必要なのは「そこで」という副詞の働きだ、という確認までできていない）。",
        },
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
        requiredTopics: [1],
        explanation: "the day は「時」なので when。",
        commonMistake: {
          label: "A",
          misconception:
            "「あなたが空いているところを教えて」という日本語の感覚で、「空いている状況＝場面・場所」のように捉えて where を選んでしまう（先行詞 the day が「時」を表す名詞であることを見落としている）。",
        },
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
        requiredTopics: [0],
        explanation: "the village は「場所」、節内で副詞（there）が欠けるので where。",
        commonMistake: {
          label: "B",
          misconception:
            "the village という名詞に直接つなぐなら関係代名詞、と考えて which を選んでしまう（lives のあとに欠けているのは「そこに」という副詞の働きであり、関係副詞 where が必要という確認までできていない）。",
        },
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
        requiredTopics: [2],
        explanation: "the reason は「理由」なので why。",
        commonMistake: {
          label: "A",
          misconception:
            "「どうして怒っているのか分からない」という日本語から、「どうして＝how」という訳語の感覚で how を選んでしまう（先行詞 the reason（理由）には why が対応する、という結びつきより日本語の感覚が先に立っている）。",
        },
      },
    ],
    starterScaffold: {
      coreQuestion: "関係副詞を使うかどうかは、何を見れば判断できる？",
      sentenceStarters: [
        "関係副詞は、＿＿＿＿を説明するときに使います。",
        "先行詞が場所なら＿＿＿＿、時なら＿＿＿＿、理由なら＿＿＿＿を使います。",
        "後ろの文が＿＿＿＿になっているかも確認します。",
        "注意点として、＿＿＿＿があります。",
      ],
      explanationSlots: [
        {
          id: "purpose",
          label: "何のために使う文法か",
          prompt: "この文法の役割を一言で説明しよう",
          placeholder: "例：場所・時・理由などを表す名詞を、後ろから説明するために使う",
          required: true,
        },
        {
          id: "decision",
          label: "見分け方・判断手順",
          prompt: "何を見れば使う語を決められるか",
          placeholder: "例：先行詞が場所・時・理由・方法のどれかを見て、where / when / why を選ぶ",
          required: true,
        },
        {
          id: "example",
          label: "例文での説明",
          prompt: "例文を1つ使って説明しよう",
          placeholder: "例：This is the city where I was born. では、the city が場所なので where を使う",
          required: true,
        },
        {
          id: "warning",
          label: "注意点",
          prompt: "AIが間違えそうな点を先に教えよう",
          placeholder: "例：the way と how は一緒に使わない",
          required: false,
        },
        {
          id: "misconception",
          label: "AIがしそうな勘違い",
          prompt: "AIがどこで間違えそうか予想しよう",
          placeholder: "例：場所を表す名詞があれば必ず where だと勘違いするかもしれない",
          required: false,
        },
      ],
      workedExample: {
        weak: "where は場所、when は時、why は理由です。",
        strong:
          "関係副詞は、場所・時・理由などを表す先行詞を後ろから説明するときに使います。先行詞が場所なら where、時なら when、理由なら why を使います。たとえば This is the city where I was born. では、the city が場所を表すので where を使います。ただし、the way と how は一緒に使わない点に注意します。",
        commentary:
          "弱い説明は対応表だけで、判断手順や例文がない。良い説明は、役割・見分け方・例文・注意点がそろっている。",
      },
      commonTeachingMoves: [
        "対応表で整理する",
        "例文に線を引くように説明する",
        "なぜ他の選択肢ではないかを説明する",
        "間違えやすい例を先に教える",
      ],
    },
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
        "先行詞の所有（「〜の」の関係）を表すパターン",
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
        requiredTopics: [0],
        explanation:
          "先行詞 the man は「人」で、節内で主語（lives の主語）なので主格 who。which は物用、whom は目的格。",
        hint: "人を先行詞とする主格",
        commonMistake: {
          label: "C",
          misconception:
            "人を指す関係代名詞としては whom のほうがかたくて正式だ、というイメージで whom を選んでしまう（節の中で lives の主語として働いているので主格 who が必要、という節内の役割の確認ができていない）。",
        },
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
        requiredTopics: [1],
        explanation:
          "先行詞 the book は「物」で read の目的語が欠けている（目的格）ので which。人なら whom/who。",
        hint: "物を先行詞とする目的格",
        commonMistake: {
          label: "D",
          misconception:
            "「私が昨日読んだもの」という日本語から、「もの・こと」＝ what という対応で what を選んでしまう（先行詞 the book がすでにあるので、先行詞を含む what は使えない、という整理ができていない）。",
        },
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
        requiredTopics: [2],
        explanation:
          "the only person のように only が付くと that が好まれる。who も可だが選択肢では that。which は物用、what は先行詞を含むため不可。",
        hint: "only が付く先行詞は that が好まれる",
        commonMistake: {
          label: "B",
          misconception:
            "the only person を「私を助けてくれる人（そのもの）」とひとかたまりで捉えてしまい、先行詞を含む関係代名詞 what を使えると思い込む（先行詞 person がすでにあるので what は不可、という整理が追いついていない）。",
        },
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
        requiredTopics: [1],
        explanation: "the house は物で in の目的語が欠ける（目的格）ので which。",
        commonMistake: {
          label: "C",
          misconception:
            "the house は場所だから関係副詞を使うはず、と考え、選択肢に where がないので同じ関係副詞の仲間である when に飛びついてしまう（in の目的語が欠けているので関係代名詞 which が必要、という節内の欠けの確認ができていない）。",
        },
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
        requiredTopics: [0],
        explanation: "the students は人で passed の主語（主格）なので who。",
        commonMistake: {
          label: "C",
          misconception:
            "人を表す関係代名詞は whom のほうがかたくて正式だと覚えていて whom を選んでしまう（passed の主語が欠けている＝主格 who が必要、という節の中での働きの確認が抜けている）。",
        },
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
        requiredTopics: [1],
        explanation: "the movie は物で watched の目的語が欠ける（目的格）ので which。",
        commonMistake: {
          label: "D",
          misconception:
            "last night に映画を見た場面を思い浮かべ、「私たちが（そこで）見た」という場面の感覚で where を選んでしまう（watched の目的語が欠けているので関係代名詞 which が必要、という点に気づけていない）。",
        },
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
        requiredTopics: [4],
        explanation:
          "「その女の子の母親」と所有関係を表すので所有格 whose。",
        commonMistake: {
          label: "A",
          misconception:
            "先行詞 a girl が人なので、「人＝ who」という対応をそのまま当てはめてしまう（「その女の子の母親」という所有の関係を表すには所有格 whose が必要、という一歩先まで考えられていない）。",
        },
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
        requiredTopics: [1],
        explanation: "the car は物で is parked の主語（主格）なので which。",
        commonMistake: {
          label: "D",
          misconception:
            "「外に停めてあるものは私のです」という日本語から、「もの」＝ what という対応で what を選んでしまう（先行詞 the car がすでにあるので、先行詞を含む what は使えない、という点が抜けている）。",
        },
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
        requiredTopics: [3],
        explanation:
          "a person は人で respects の目的語が欠ける（目的格）ので whom。which は物用。",
        commonMistake: {
          label: "A",
          misconception:
            "respects の目的語が欠けている＝目的格、目的格といえば which、という覚え方をそのまま当てはめてしまう（which は物用で、先行詞が人のときの目的格は whom になる、という区別までできていない）。",
        },
      },
    ],
    starterScaffold: {
      coreQuestion: "関係代名詞を使い分けるとき、先行詞の何を見ればいい？",
      sentenceStarters: [
        "関係代名詞は、＿＿＿＿を後ろから説明するときに使います。",
        "先行詞が人なら＿＿＿＿、物なら＿＿＿＿を使います。",
        "節の中で主語のときは＿＿＿＿、目的語のときは＿＿＿＿になります。",
        "注意点として、＿＿＿＿があります。",
      ],
      explanationSlots: [
        {
          id: "purpose",
          label: "何のために使う文法か",
          prompt: "この文法の役割を一言で説明しよう",
          placeholder: "例：名詞（先行詞）を後ろから説明し、その名詞が文の中でどんな働きかを表すために使う",
          required: true,
        },
        {
          id: "decision",
          label: "見分け方・判断手順",
          prompt: "何を見れば使う語を決められるか",
          placeholder: "例：先行詞が人か物かを見て、さらに節の中で主語・目的語・所有のどれかを見る",
          required: true,
        },
        {
          id: "example",
          label: "例文での説明",
          prompt: "例文を1つ使って説明しよう",
          placeholder: "例：The man who lives next door is a doctor. では、the man が人で主語の働きなので who",
          required: true,
        },
        {
          id: "warning",
          label: "注意点",
          prompt: "AIが間違えそうな点を先に教えよう",
          placeholder: "例：only や all が付く先行詞は that が好まれる／目的格は省略できる",
          required: false,
        },
        {
          id: "misconception",
          label: "AIがしそうな勘違い",
          prompt: "AIがどこで間違えそうか予想しよう",
          placeholder: "例：先行詞が人なら常に who だと思い込み、目的格 whom を見落とすかもしれない",
          required: false,
        },
      ],
      workedExample: {
        weak: "who は人、which は物に使います。",
        strong:
          "関係代名詞は、名詞（先行詞）を後ろから説明するときに使います。先行詞が人なら who、物なら which を使い、さらに節の中で主語の働きか目的語の働きかで主格・目的格を選びます。たとえば The book which I read was interesting. では、the book が物で read の目的語が欠けているので目的格の which を使います。所有を表すときは whose を使う点にも注意します。",
        commentary:
          "弱い説明は人/物の対応だけ。良い説明は、先行詞の種類に加えて『節の中での働き』まで踏み込み、例文で示している。",
      },
      commonTeachingMoves: [
        "先行詞が人か物かをまず分ける",
        "節の中で何が欠けているか（主語/目的語）を確認させる",
        "例文で欠けている部分を指し示す",
        "所有格 whose の例も1つ見せる",
      ],
    },
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
        requiredTopics: [1],
        explanation:
          "yesterday があり過去・主語は単数なので was。is は現在、were は複数主語、be は原形。",
        hint: "過去・単数主語の受動態",
        commonMistake: {
          label: "A",
          misconception:
            "受動態＝「is ＋ 過去分詞」という代表の形でひとかたまりに覚えていて、そのまま is を入れてしまう（yesterday があるので be動詞を過去形 was にする、という時制の確認が抜けている）。",
        },
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
        requiredTopics: [0],
        explanation:
          "一般的事実＝現在・主語 English は単数なので is。are は複数主語、been は完了形で使う。",
        hint: "現在・単数主語の受動態",
        commonMistake: {
          label: "C",
          misconception:
            "all over the world（世界中で）という広がりから、話している人がたくさんいる＝複数のイメージで are を選んでしまう（be動詞を合わせる相手は主語 English（単数）だ、という点を取り違えている）。",
        },
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
        requiredTopics: [3],
        explanation:
          "現在完了の受動態 has been + 過去分詞。has の後ろは been。was/being は不可。",
        hint: "現在完了の受動態（has been + p.p.）",
        commonMistake: {
          label: "B",
          misconception:
            "「食べられた」という過去の出来事だから was を入れればよいと思い込み、has was eaten のような形を、過去の受動態のつもりで選んでしまう（has の後ろは過去分詞 been になる、という現在完了の形までは結びついていない）。",
        },
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
        requiredTopics: [1],
        explanation: "過去・単数主語なので was。",
        commonMistake: {
          label: "A",
          misconception:
            "The window is broken.（窓が割れている）という見慣れた形が頭に浮かび、そのまま is を選んでしまう（by the ball というボールが割った過去の出来事の話なので was にする、という時制の判断が抜けている）。",
        },
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
        requiredTopics: [2],
        explanation: "未来の受動態 will be + 過去分詞。助動詞 will の後ろは原形 be。",
        commonMistake: {
          label: "D",
          misconception:
            "opened の前に置く be動詞として、完了形でよく見かける been の形を思い出してそのまま入れてしまう（been は have/has とセットで使う形で、助動詞 will の後ろは原形 be になる、という区別がついていない）。",
        },
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
        requiredTopics: [1],
        explanation: "過去・複数主語 these shoes なので were。",
        commonMistake: {
          label: "B",
          misconception:
            "made in Italy＝「イタリアで作られた」という過去のイメージから、過去形の be動詞といえば was と反射的に選んでしまう（主語 these shoes が複数なので were になる、という数の一致まで確認していない）。",
        },
      },
      {
        id: 4,
        sentence: "These letters ___ written by Shakespeare.",
        choices: [
          { label: "A", text: "is" },
          { label: "B", text: "were" },
          { label: "C", text: "was" },
          { label: "D", text: "been" },
        ],
        answerLabel: "B",
        requiredTopics: [1],
        explanation:
          "主語 these letters は複数で、by Shakespeare（故人）から過去の出来事なので be動詞は were。is は現在・単数、was は過去だが単数主語用、been は完了形で使う。受動態は主語の数と時制に be動詞を一致させる点がポイント。",
        commonMistake: {
          label: "C",
          misconception:
            "シェイクスピア＝昔の人だから過去形、過去形の be動詞といえば was と考えて選んでしまう（主語 these letters が複数なので were になる、という数への注意が抜けている）。",
        },
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
        requiredTopics: [3],
        explanation: "現在完了の受動態 has been + 過去分詞。",
        commonMistake: {
          label: "C",
          misconception:
            "already（もうすでに終わった）という過去の感覚から、過去形の was を入れたくなってしまう（has の後ろに続くのは過去分詞 been、という現在完了の形と結びついていない）。",
        },
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
        requiredTopics: [1],
        explanation: "two years ago があり過去・単数主語なので was。",
        commonMistake: {
          label: "A",
          misconception:
            "橋は今も建っていて存在しているのだから現在形でよい、と考えて is を選んでしまう（two years ago という過去を表す語句に合わせて be動詞を was にする、という時制の確認ができていない）。",
        },
      },
    ],
    starterScaffold: {
      coreQuestion: "受動態の be動詞の形は、何を見れば決められる？",
      sentenceStarters: [
        "受動態は、＿＿＿＿を主語にして「〜される／された」と表すときに使います。",
        "形は ＿＿＿＿ ＋ 過去分詞です。",
        "be動詞の形は、＿＿＿＿と＿＿＿＿で変わります。",
        "注意点として、＿＿＿＿があります。",
      ],
      explanationSlots: [
        {
          id: "purpose",
          label: "何のために使う文法か",
          prompt: "この文法の役割を一言で説明しよう",
          placeholder: "例：動作を受ける側を主語にして「〜される・された」と表すために使う",
          required: true,
        },
        {
          id: "decision",
          label: "見分け方・判断手順",
          prompt: "be動詞の形は何で決まるか説明しよう",
          placeholder: "例：時制（現在・過去・未来・完了）と主語の数（単数・複数）で be動詞を選ぶ",
          required: true,
        },
        {
          id: "example",
          label: "例文での説明",
          prompt: "例文を1つ使って説明しよう",
          placeholder: "例：This letter was written by Tom. では、過去で主語が単数なので was ＋ written",
          required: true,
        },
        {
          id: "warning",
          label: "注意点",
          prompt: "AIが間違えそうな点を先に教えよう",
          placeholder: "例：助動詞 will の後ろは be、現在完了は has/have been になる",
          required: false,
        },
        {
          id: "misconception",
          label: "AIがしそうな勘違い",
          prompt: "AIがどこで間違えそうか予想しよう",
          placeholder: "例：過去の出来事だからと has の後ろに was を入れてしまうかもしれない",
          required: false,
        },
      ],
      workedExample: {
        weak: "be動詞 ＋ 過去分詞で「〜される」です。",
        strong:
          "受動態は、動作を受ける側を主語にして「〜される・された」と表すときに使い、形は be動詞 ＋ 過去分詞です。be動詞の形は時制と主語の数で変わり、たとえば This letter was written by Tom. では過去で主語が単数なので was を使います。助動詞のあとは be（will be opened）、現在完了は has/have been（has been finished）になる点に注意します。",
        commentary:
          "弱い説明は形だけ。良い説明は、be動詞をどう選ぶか（時制・数）を判断手順として示し、時制ごとの例まで挙げている。",
      },
      commonTeachingMoves: [
        "時制ごとに be動詞の形を表で整理する",
        "主語の数で was / were を選び分けさせる",
        "助動詞・完了形のときの形を別に教える",
        "by 〜 で動作主を表すことを見せる",
      ],
    },
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
        requiredTopics: [0],
        explanation:
          "仮定法過去では主語に関わらず be動詞は were を使う（I were）。was は口語では使われるが文法上は were が正式。",
        hint: "仮定法過去の be動詞は were",
        commonMistake: {
          label: "B",
          misconception:
            "主語が I なので、ふつうの過去形どおり was でよいと考えてしまう（仮定法では主語に関わらず were を使う、という特別なルールと結びついていない）。",
        },
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
        requiredTopics: [1],
        explanation:
          "仮定法過去完了：If + had + p.p., 主節は would/could/might have + p.p.。will は直説法用。",
        hint: "仮定法過去完了の主節（would have + p.p.）",
        commonMistake: {
          label: "A",
          misconception:
            "「合格していただろう」という推量だから、推量・未来を表す will でよいと考えてしまう（事実に反する仮定では、主節の助動詞も過去形 would にずらす、という時制の対応ができていない）。",
        },
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
        requiredTopics: [2],
        explanation:
          "wish + 仮定法過去。現在の事実に反する願望で be動詞は were。",
        hint: "wish + 仮定法過去",
        commonMistake: {
          label: "B",
          misconception:
            "主語が I なので、be動詞はふつうの過去形 was でよいと思い込んでしまう（仮定法では主語に関わらず were を使う、という点を取りこぼしている）。",
        },
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
        requiredTopics: [0],
        explanation: "仮定法過去の否定。be動詞は主語に関わらず were → weren't。",
        commonMistake: {
          label: "B",
          misconception:
            "主語 it は単数なので、ふつうの過去形どおり wasn't でよいと考えてしまう（仮定法では主語に関わらず were（weren't）を使う、というルールが抜けている）。",
        },
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
        requiredTopics: [3],
        explanation: "as if + 仮定法過去。現在の事実に反するので過去形 knew。",
        commonMistake: {
          label: "B",
          misconception:
            "主語が he で今の話をしているのだから、三単現の knows が正しいと考えてしまう（as if の後ろは事実に反する内容なので時制を1つ過去にずらす、という仮定法の形と結びついていない）。",
        },
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
        requiredTopics: [1],
        explanation: "仮定法過去完了の if 節：If + had + p.p.。",
        commonMistake: {
          label: "A",
          misconception:
            "known の前に置くなら、見慣れた現在完了 I have known の並びのまま have でよいと考えてしまう（過去の事実に反する仮定では If + had + 過去分詞と、時制をさらに一つ過去へずらす点が抜けている）。",
        },
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
        requiredTopics: [0],
        explanation: "仮定法過去の主節は would + 動詞原形。",
        commonMistake: {
          label: "A",
          misconception:
            "「受け入れるだろう・受け入れるつもりだ」という未来の話に感じて will を選んでしまう（仮定法過去の主節では will を過去形 would にずらす、という対応ができていない）。",
        },
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
        requiredTopics: [2],
        explanation:
          "過去の事実に反する後悔の願望 wish + 仮定法過去完了 had + p.p.。",
        commonMistake: {
          label: "A",
          misconception:
            "「wish の後ろは過去形」と覚えていて、そのまま過去形 studied を選んでしまう（when I was young という過去の事実に反する願望なので、さらに一つ前の had studied（過去完了）にする、という区別がついていない）。",
        },
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
        requiredTopics: [1],
        explanation:
          "仮定法過去完了の主節：would have + 過去分詞（caught）。",
        commonMistake: {
          label: "B",
          misconception:
            "「仮定法の主節は would を使う」と覚えていて、caught の前に would だけを入れてしまう（過去の事実に反する仮定では would have + 過去分詞という形になる、という仮定法過去完了の主節の形まで整理できていない）。",
        },
      },
    ],
    starterScaffold: {
      coreQuestion: "仮定法では、動詞の時制を実際の時よりどうずらす？",
      sentenceStarters: [
        "仮定法は、＿＿＿＿を「もし〜なら」と仮定して表すときに使います。",
        "「今」の仮定なら動詞を＿＿＿＿、「過去」の仮定なら＿＿＿＿にします。",
        "if節が＿＿＿＿なら、主節は＿＿＿＿になります。",
        "注意点として、＿＿＿＿があります。",
      ],
      explanationSlots: [
        {
          id: "purpose",
          label: "何のために使う文法か",
          prompt: "この文法の役割を一言で説明しよう",
          placeholder: "例：現実と違うこと・ありえないことを「もし〜なら」と仮定して表すために使う",
          required: true,
        },
        {
          id: "decision",
          label: "見分け方・判断手順",
          prompt: "動詞の形をどう決めるか説明しよう",
          placeholder: "例：「今」の仮定なら時制を1つ過去にずらし、「過去」の仮定なら過去完了にする",
          required: true,
        },
        {
          id: "example",
          label: "例文での説明",
          prompt: "例文を1つ使って説明しよう",
          placeholder: "例：If I were a bird, I could fly. では現在の事実に反するので were ＋ could",
          required: true,
        },
        {
          id: "warning",
          label: "注意点",
          prompt: "AIが間違えそうな点を先に教えよう",
          placeholder: "例：仮定法過去の be動詞は主語に関わらず were を使う（wish / as if も同じ形）",
          required: false,
        },
        {
          id: "misconception",
          label: "AIがしそうな勘違い",
          prompt: "AIがどこで間違えそうか予想しよう",
          placeholder: "例：主語が I だから was でよいと思い込むかもしれない",
          required: false,
        },
      ],
      workedExample: {
        weak: "if を使って「もし〜なら」と言うのが仮定法です。",
        strong:
          "仮定法は、現実と違うことを「もし〜なら」と仮定して表すときに使います。「今」の仮定なら動詞の時制を1つ過去にずらし（仮定法過去）、「過去」の仮定なら過去完了にします（仮定法過去完了）。たとえば If I were a bird, I could fly. では現在の事実に反するので were ＋ could を使います。仮定法過去の be動詞は主語に関わらず were を使う点に注意します。",
        commentary:
          "弱い説明は普通の条件文と区別できていない。良い説明は、現実に反する点・時制を1つずらす手順・were のルールを示している。",
      },
      commonTeachingMoves: [
        "「現実かどうか」で直説法と仮定法を区別する",
        "if節と主節の時制の対応を表で整理する",
        "be動詞は were になることを強調する",
        "wish / as if も同じ形だと結びつける",
      ],
    },
  },
];

export function getUnitById(id: string): GrammarUnit | undefined {
  return GRAMMAR_UNITS.find((u) => u.id === id);
}
