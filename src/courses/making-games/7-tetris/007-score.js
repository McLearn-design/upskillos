export default {
  order: 7,

  id: 'mg7-007',

  slug: 'score',

  title: 'Tetris 7: Score',

  subtitle: 'More points for more lines at once, shown on a HUD.',

  tags: ['game-studio', 'tetris', 'scoring', 'hud'],

  aliases: 'score lines table array lookup hud label tetris scoring',

  timeToComplete: 25,

  coreConcept: 'Scoring is a lookup: an array [0, 100, 300, 500, 800] indexed by how many lines cleared. lock() adds the points and the lines; draw() shows them in HUD labels.',

  prerequisites: ['mg7-006'],

  nextLesson: 'mg7-008',

  hook: {
    question: 'Clearing four lines one at a time scores 400. Clearing four at once, a "Tetris", scores 800. Why reward the harder move, and how does the code know which happened?',
    realWorldContext: 'Scoring rules shape how people play: a bonus for risk makes players build tall stacks and wait for the I piece. Rules stored as data, in a table, are easy to read and to tune.',
  },

  intuition: {
    prose: [
      'clearLines returns how many rows went: 0, 1, 2, 3 or 4. The points for each are the table [0, 100, 300, 500, 800]. Indexing it with the count gives the points: table[2] = 300.',
      'Before reading on, predict: which scores more, two doubles (two clears of 2 lines) or one Tetris (4 lines)? Two doubles: "300 + 300 = 600. One Tetris: 800. Waiting pays."',
      'lock() keeps two counters: `this.score += [0, 100, 300, 500, 800][cleared]` and `this.lines += cleared`.',
      "The HUD is a CanvasLayer with two Labels, Score and Lines, beside the board (lesson 3.3). draw() sets their text every frame: `scene.get('HUD/Score').text = 'Score ' + this.score`.",
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Score and show it',
        body: "Step 1. Add a CanvasLayer named HUD with Labels Score and Lines, around x = 640.\nStep 2. Add fields score = 0 and lines = 0.\nStep 3. In lock(), after clearLines: this.score += [0, 100, 300, 500, 800][cleared]; this.lines += cleared.\nStep 4. In draw(), set the two labels' text.\nStep 5. Run, clear a line, and watch the numbers.",
      },
      {
        type: 'warning',
        title: 'An array index out of range',
        body: 'The table has entries 0 to 4. If clearLines ever returned 5, table[5] would be undefined and the score would become NaN (not a number) for ever after. Tetris cannot clear 5, but check new rules against the table.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Tetris 7: score',
        props: {
          task: 'tetris-score',
          lesson: 'mg7-007',
          checkpoint: 'cp-mg7-007-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** Points per line rise with the number cleared: $100, 150, 167, 200$ per line for 1 to 4 lines ($100/1$, $300/2$, $500/3$, $800/4$). The table rewards building up for bigger clears.',
      'Splitting 4 lines into clears, the best is one Tetris (800); the worst four singles (400). Any mix of a triple and a single is $500 + 100 = 600$; two doubles also 600.',
      'A lookup table turns a rule into data. Changing the rules (say 1200 for a Tetris) is editing one number, not rewriting if-else chains.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, score is a function $s: \\{0..4\\} \\to \\mathbb{N}$ stored as an array; the total is $\\sum s(k_i)$ over every lock $i$.',
      'The invariant: lines always equals the total rows cleared, and score the sum of their table values.',
      'Picture the table as a bar chart rising faster than a straight line: convex, so big clears are worth more than their parts.',
      'Real Tetris guidelines multiply by the level (next lessons) and add points for drops and combos; each is another term in the sum.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg7-007-ex1',
      title: 'A triple',
      difficulty: 'easy',
      problem: 'A lock clears 3 lines. How many points?',
      steps: [
        {
          expression: '[0, 100, 300, 500, 800][3] = 500',
          annotation: 'Index the table with the count.',
          strategyTitle: 'Step 1: Look it up',
        },
      ],
      answer: '500 points.',
    },
    {
      id: 'mg7-007-ex2',
      title: "A game's total",
      difficulty: 'medium',
      problem: 'Clears of 1, 4, 2 and 1 lines. Total score and lines?',
      steps: [
        {
          expression: '100 + 800 + 300 + 100 = 1300',
          annotation: 'Sum the table values.',
          strategyTitle: 'Step 1: Score',
        },
        {
          expression: '1 + 4 + 2 + 1 = 8',
          annotation: 'Sum the counts.',
          strategyTitle: 'Step 2: Lines',
        },
      ],
      answer: 'Score 1300, lines 8.',
    },
    {
      id: 'mg7-007-ex3',
      title: 'Choosing a strategy',
      difficulty: 'hard',
      problem: 'Eight lines to clear. Compare all singles, all doubles and two Tetrises.',
      steps: [
        {
          expression: '8 \\times 100 = 800',
          annotation: 'Eight singles.',
          strategyTitle: 'Step 1: Singles',
        },
        {
          expression: '4 \\times 300 = 1200,\\ 2 \\times 800 = 1600',
          annotation: 'Four doubles, two Tetrises.',
          strategyTitle: 'Step 2: Doubles and Tetrises',
        },
      ],
      answer: 'Two Tetrises score 1600, twice as much as eight singles.',
    },
  ],

  challenges: [
    {
      id: 'mg7-007-ch1',
      title: 'Single points',
      difficulty: 'easy',
      problem: 'How many points for 2 lines?',
      hint: 'Index 2.',
      answer: 300,
      walkthrough: [
        {
          expression: 'table[2] = 300',
          annotation: 'Direct lookup.',
        },
      ],
    },
    {
      id: 'mg7-007-ch2',
      title: 'Per line',
      difficulty: 'medium',
      problem: 'Points per line for a triple?',
      hint: 'Points ÷ lines.',
      answer: 'About 167, because 500 ÷ 3.',
      walkthrough: [],
    },
    {
      id: 'mg7-007-ch3',
      title: 'Debug the NaN score',
      difficulty: 'hard',
      problem: 'The score shows NaN after the first lock. The line is this.score += table[cleared], and score was never given a starting value. Why?',
      hint: 'What is undefined plus a number?',
      answer: 'score starts undefined, and undefined + 100 is NaN; add the field score = 0.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: '[0, 100, 300, 500, 800]',
        meaning: 'Points for clearing 0 to 4 lines at once.',
      },
      {
        symbol: 'table[k]',
        meaning: 'Looking up the points for k lines.',
      },
      {
        symbol: 'lines',
        meaning: 'Total rows cleared this game.',
      },
      {
        symbol: 'NaN',
        meaning: '\'"Not a number": what arithmetic on undefined gives.\'',
      },
    ],
    rulesOfThumb: [
      'Store rules as data when you can.',
      'Give every counter a starting value.',
      'Update the HUD from the numbers, never the other way.',
      'Reward risk to make play interesting.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Four lines are worth four times one line.',
      whyStudentsThinkIt: 'Points usually add up in proportion.',
      correctionExample: 'One Tetris scores 800, four singles 400.',
      contrastCase: 'The table is convex on purpose.',
    },
    {
      falseBelief: 'The HUD keeps the score.',
      whyStudentsThinkIt: 'The number is shown there.',
      correctionExample: 'this.score is the score; the label only shows it each frame.',
      contrastCase: "Reading the score back from the label's text would be fragile.",
    },
  ],

  transferPrompts: [
    {
      situation: 'Enemy types give 10, 50 and 200 points.',
      competingTechniques: ['A table keyed by type', 'An if-else chain per type'],
      whyThisTechniqueWins: 'The table is one line to read and one number to change.',
    },
    {
      situation: 'Combos should multiply points by the combo count.',
      competingTechniques: [
        'Multiply the table value by a combo counter',
        'Write separate rules per combo length',
      ],
      whyThisTechniqueWins: 'One extra factor covers every length.',
    },
  ],

  debugging: [
    {
      commonError: 'Adding points before clearLines runs.',
      symptom: 'Lines clear but score nothing.',
      whyItHappened: 'cleared is not known yet.',
      repairStrategy: 'Call clearLines first and use what it returns.',
    },
    {
      commonError: 'The labels are not under HUD.',
      symptom: 'An error, no node at HUD/Score.',
      whyItHappened: 'The path does not match the tree.',
      repairStrategy: 'Put Score and Lines under the HUD CanvasLayer.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Score clears from a table and show it on a HUD.',
    explainVerbally: 'Explain why the table rewards bigger clears.',
    detectIncorrectApplication: 'Spot NaN from missing starting values.',
    transferToUnfamiliar: 'Turn scoring rules into tables.',
  },

  assessment: {
    questions: [
      {
        id: 'mg7-007-assess-1',
        type: 'choice',
        text: 'Clears of 2 and 4 lines. Total?',
        options: ['1100', '600', '900', '1200'],
        answer: '1100',
        hint: '300 + 800.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg7-007-quiz-1',
      type: 'choice',
      text: 'Points for a Tetris (4 lines)?',
      options: ['800', '400', '500', '1200'],
      answer: '800',
      hints: ['Index 4.'],
      reviewSection: 'Intuition — the table paragraph',
    },
    {
      id: 'mg7-007-quiz-2',
      type: 'choice',
      text: 'Two doubles or one Tetris?',
      options: [
        'One Tetris: 800 against 600',
        'Two doubles: 600 against 400',
        'They are equal',
        'It depends on the colour',
      ],
      answer: 'One Tetris: 800 against 600',
      hints: ['300 + 300 = 600.'],
      reviewSection: 'Intuition — the prediction paragraph',
    },
    {
      id: 'mg7-007-quiz-3',
      type: 'choice',
      text: 'Where are score and lines updated?',
      options: [
        'In lock(), after clearLines',
        'In draw()',
        'In spawn()',
        'In the HUD',
      ],
      answer: 'In lock(), after clearLines',
      hints: ['When lines are known.'],
      reviewSection: 'Intuition — Procedure',
    },
    {
      id: 'mg7-007-quiz-4',
      type: 'choice',
      text: 'undefined + 100 is what?',
      options: ['NaN', '100', '0', 'An error'],
      answer: 'NaN',
      hints: ['Give counters starting values.'],
      reviewSection: 'Challenges — NaN',
    },
    {
      id: 'mg7-007-quiz-5',
      type: 'choice',
      text: 'Which of these does NOT hold the score?',
      options: [
        'The Score label',
        'this.score',
        'The sum of table values',
        "The game's numbers",
      ],
      answer: 'The Score label',
      hints: ['The label only shows it.'],
      reviewSection: 'Misconceptions — HUD',
    },
    {
      id: 'mg7-007-quiz-6',
      type: 'choice',
      text: 'Points per line for a double?',
      options: ['150', '300', '100', '200'],
      answer: '150',
      hints: ['300 ÷ 2.'],
      reviewSection: 'Under the hood — per line',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg7-007-1',
      label: 'Read the scoring table',
      type: 'read',
    },
    {
      id: 'cp-mg7-007-2',
      label: 'Read why bigger clears score more',
      type: 'read',
    },
    {
      id: 'cp-mg7-007-3',
      label: 'Read the scoring procedure',
      type: 'read',
    },
    {
      id: 'cp-mg7-007-4',
      label: 'Complete "Tetris 7: score" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg7-007-5',
      label: 'Score a double in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg7-007-6',
      label: 'Work through the game-total example',
      type: 'example',
    },
    {
      id: 'cp-mg7-007-7',
      label: 'Work through the strategy example',
      type: 'example',
    },
    {
      id: 'cp-mg7-007-8',
      label: 'Attempt the NaN challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-7',
}
