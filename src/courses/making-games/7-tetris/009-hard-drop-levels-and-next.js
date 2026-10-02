export default {
  order: 9,

  id: 'mg7-009',

  slug: 'hard-drop-levels-and-next',

  title: 'Tetris 9: Hard Drop, Levels and Next',

  subtitle: 'Finish the game, and see how far you have come.',

  tags: ['game-studio', 'tetris', 'difficulty'],

  aliases: 'hard drop levels getter interval geometric next piece preview difficulty curve',

  timeToComplete: 30,

  coreConcept: 'Hard drop moves down until move(0, 1) fails, then locks. Every 10 lines is a level; a getter works out the fall interval, 0.5 × 0.85^(level − 1), so the game speeds up by itself. The next piece is taken from the bag early and shown.',

  prerequisites: ['mg7-008'],

  nextLesson: 'mg8-001',

  hook: {
    question: 'Good Tetris gets faster as you improve. How much faster each level, so it is hard but not suddenly impossible?',
    realWorldContext: 'Difficulty curves decide whether players feel challenged or crushed. Speeding up by the same percentage each level is a common, gentle choice; so is showing what comes next, so players can plan.',
  },

  intuition: {
    prose: [
      'Hard drop: `while (this.move(0, 1)) {}`, then lock(). The loop keeps moving down while it can; the first refusal ends it, and the piece locks where it landed. Space calls it.',
      'Levels: `get level() { return 1 + Math.floor(this.lines / 10); }`. A getter is worked out each time it is read, so the level changes by itself as lines go up. 0 to 9 lines is level 1; 25 lines is level 3.',
      'The interval becomes a getter too: `0.5 * Math.pow(0.85, this.level - 1)`. Level 1 falls every 0.5 s, level 2 every 0.425 s, level 3 every 0.361 s: 15% faster each level.',
      'Before reading on, predict: at which level is the interval first under 0.1 s? 0.5 × 0.85^(n − 1) < 0.1 means 0.85^(n − 1) < 0.2: n − 1 ≥ 10, so level 11, after 100 lines.',
      'Next: in ready(), `this.next = this.takeFromBag()` before spawning; spawn() with no type uses next and takes a new next. A Next label shows it. Points also multiply by the level.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Finish the game',
        body: 'Step 1. hardDrop(): while (this.move(0, 1)) {} then this.lock(); Space calls it.\nStep 2. Replace interval = 0.5 with get level() and get interval() as above.\nStep 3. Multiply the points by this.level in lock(), and show the level with the lines.\nStep 4. Add this.next: take it in ready(); spawn() uses it and takes another; show it in a Next label.\nStep 5. Play a whole game.',
      },
      {
        type: 'warning',
        title: 'A field hides a getter',
        body: 'Leaving the field interval = 0.5 in the class beside get interval() means the field wins: the game never speeds up. Remove the field when you add the getter.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Tetris 9: hard drop, levels and next',
        props: {
          task: 'tetris-finish',
          lesson: 'mg7-009',
          checkpoint: 'cp-mg7-009-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** The interval is a geometric sequence: $I_n = 0.5 \\times 0.85^{\\,n-1}$. Each level multiplies it by 0.85, so the fall rate $1/I_n$ grows by $1/0.85 \\approx 1.18$, 18% more falls a second per level.',
      'Solving $0.5 \\times 0.85^{n-1} < 0.1$: $(n - 1)\\ln 0.85 < \\ln 0.2$, so $n - 1 > \\ln 0.2 / \\ln 0.85 \\approx 9.9$, and $n = 11$. Logarithms turn "how many times do I multiply" into division.',
      'Speed grows smoothly with no sudden jump: level 5 is $0.5 \\times 0.85^4 \\approx 0.261$ s, level 10 $\\approx 0.116$ s. A linear rule ($0.5 - 0.05(n-1)$) would hit 0 at level 11, an impossible game.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, $I_n = I_1 r^{n-1}$ with $0 < r < 1$ decreases to 0 but never reaches it, unlike any linear decrease; the ratio $I_{n+1}/I_n = r$ is the same at every level.',
      'The invariant of a geometric curve is the relative step: each level feels like the same increase in difficulty.',
      'Plotted against level, the interval is a decaying exponential; on a logarithmic axis it is a straight line.',
      'The same curve sets enemy health, prices and experience in many games, because players perceive ratios more than differences. Chapter 8 lets an agent learn this very game from its numbers.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg7-009-ex1',
      title: 'The level from lines',
      difficulty: 'easy',
      problem: 'The player has cleared 25 lines. What level is it?',
      steps: [
        {
          expression: '1 + \\lfloor 25 / 10 \\rfloor = 1 + 2 = 3',
          annotation: 'A new level every 10 lines.',
          strategyTitle: 'Step 1: Divide and round down',
        },
      ],
      answer: 'Level 3.',
    },
    {
      id: 'mg7-009-ex2',
      title: 'The interval at level 3',
      difficulty: 'medium',
      problem: 'How long between falls at level 3, and how many falls a second?',
      steps: [
        {
          expression: '0.5 \\times 0.85^{2} = 0.5 \\times 0.7225 \\approx 0.361\\ \\text{s}',
          annotation: 'Two levels of 15% faster.',
          strategyTitle: 'Step 1: The interval',
        },
        {
          expression: '1 / 0.361 \\approx 2.77',
          annotation: 'One over the interval.',
          strategyTitle: 'Step 2: The rate',
        },
      ],
      answer: 'About 0.361 s, so about 2.8 falls a second.',
    },
    {
      id: 'mg7-009-ex3',
      title: 'Points on level 3',
      difficulty: 'hard',
      problem: 'On level 3 a single line clears. How many points with the level multiplier?',
      steps: [
        {
          expression: '100 \\times 3 = 300',
          annotation: 'The table value times the level.',
          strategyTitle: 'Step 1: Multiply',
        },
      ],
      answer: '300 points.',
    },
  ],

  challenges: [
    {
      id: 'mg7-009-ch1',
      title: 'Level 2',
      difficulty: 'easy',
      problem: 'The interval at level 2?',
      hint: 'One factor of 0.85.',
      answer: '0.425 s.',
      walkthrough: [
        {
          expression: '0.5 \\times 0.85 = 0.425',
          annotation: '15% less.',
        },
      ],
    },
    {
      id: 'mg7-009-ch2',
      title: 'When under 0.2 s',
      difficulty: 'medium',
      problem: 'At which level is the interval first under 0.2 s?',
      hint: '0.85^(n − 1) < 0.4.',
      answer: 'Level 7, since 0.85⁵ ≈ 0.444 and 0.85⁶ ≈ 0.377.',
      walkthrough: [],
    },
    {
      id: 'mg7-009-ch3',
      title: 'Debug the game that never speeds up',
      difficulty: 'hard',
      problem: 'The level label goes up, but pieces fall at the same speed at level 5. The class has interval = 0.5 and get interval(). Why?',
      hint: 'Which wins, a field or a getter?',
      answer: 'The field shadows the getter; remove interval = 0.5 so get interval() is used.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'hardDrop()',
        meaning: 'Moves down until it cannot, then locks.',
      },
      {
        symbol: 'get level()',
        meaning: '1 + ⌊lines/10⌋, worked out whenever it is read.',
      },
      {
        symbol: 'get interval()',
        meaning: '0.5 × 0.85^(level − 1): seconds between falls.',
      },
      {
        symbol: 'geometric sequence',
        meaning: 'Each term is the last times the same ratio.',
      },
      {
        symbol: 'next',
        meaning: 'The piece after the falling one, taken from the bag early and shown.',
      },
    ],
    rulesOfThumb: [
      'Speed up by a percentage, not a fixed amount.',
      'Use getters for values worked out from others.',
      'Show what is coming, so players can plan.',
      'Drop loops stop at the first refused move.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Making the game 0.05 s faster each level is gentle.',
      whyStudentsThinkIt: '0.05 s sounds small.',
      correctionExample: 'From 0.5, ten steps of 0.05 reach 0: an impossible level 11.',
      contrastCase: '15% steps still leave 0.1 s at level 11.',
    },
    {
      falseBelief: 'A getter is computed once.',
      whyStudentsThinkIt: 'Fields are set once.',
      correctionExample: 'get level() gives 1 at 9 lines and 2 at 10, with no code to update it.',
      contrastCase: 'A field would need updating by hand each time lines change.',
    },
  ],

  transferPrompts: [
    {
      situation: 'Enemies should get tougher each wave.',
      competingTechniques: ['Health × 1.15 each wave', 'Health + 10 each wave'],
      whyThisTechniqueWins: 'A ratio feels like the same step at every wave; a fixed add becomes trivial later.',
    },
    {
      situation: 'A value depends on two others and must always be right.',
      competingTechniques: ['A getter computing it', 'A field updated wherever the others change'],
      whyThisTechniqueWins: 'The getter cannot be forgotten or go stale.',
    },
  ],

  debugging: [
    {
      commonError: 'Hard drop with if instead of while.',
      symptom: 'Space moves the piece down one row and locks it in mid-air.',
      whyItHappened: 'if moves at most once.',
      repairStrategy: 'Loop with while until move(0, 1) returns false.',
    },
    {
      commonError: 'Taking next after spawning in ready().',
      symptom: 'The first spawn uses undefined and the game errors.',
      whyItHappened: 'spawn reads this.next before it was set.',
      repairStrategy: 'Set this.next = this.takeFromBag() before the first spawn.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Add hard drop, levels and the next piece.',
    explainVerbally: 'Explain the geometric speed-up and why it is gentler than a linear one.',
    detectIncorrectApplication: 'Spot field-shadowed getters and if-not-while drops.',
    transferToUnfamiliar: 'Design difficulty curves with ratios and logarithms.',
  },

  assessment: {
    questions: [
      {
        id: 'mg7-009-assess-1',
        type: 'choice',
        text: '25 lines. Level?',
        options: ['3', '2', '25', '4'],
        answer: '3',
        hint: '1 + ⌊2.5⌋.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg7-009-quiz-1',
      type: 'choice',
      text: 'What does hard drop loop on?',
      options: [
        'while (this.move(0, 1))',
        'if (this.move(0, 1))',
        'for 20 rows',
        'until Space is released',
      ],
      answer: 'while (this.move(0, 1))',
      hints: ['Until the first refusal.'],
      reviewSection: 'Intuition — hard drop',
    },
    {
      id: 'mg7-009-quiz-2',
      type: 'choice',
      text: 'The interval at level 3?',
      options: ['About 0.361 s', '0.35 s', '0.425 s', '0.5 s'],
      answer: 'About 0.361 s',
      hints: ['0.5 × 0.85²; 0.35 is the near-miss of subtracting.'],
      reviewSection: 'Examples — The interval at level 3',
    },
    {
      id: 'mg7-009-quiz-3',
      type: 'choice',
      text: 'First level with an interval under 0.1 s?',
      options: ['11', '10', '9', 'Never'],
      answer: '11',
      hints: ['n − 1 > 9.9.'],
      reviewSection: 'Under the hood — logarithms',
    },
    {
      id: 'mg7-009-quiz-4',
      type: 'choice',
      text: 'Why use a getter for level?',
      options: [
        'It is worked out whenever read, so it is never stale',
        'It is faster',
        'Fields cannot be numbers',
        'To hide it',
      ],
      answer: 'It is worked out whenever read, so it is never stale',
      hints: ['No code updates it.'],
      reviewSection: 'Misconceptions — getters',
    },
    {
      id: 'mg7-009-quiz-5',
      type: 'choice',
      text: 'Which of these breaks the speed-up?',
      options: [
        'Leaving interval = 0.5 beside get interval()',
        'Using Math.pow',
        'Multiplying points by level',
        'Showing the next piece',
      ],
      answer: 'Leaving interval = 0.5 beside get interval()',
      hints: ['The field shadows the getter.'],
      reviewSection: 'Intuition — Warning: a field hides a getter',
    },
    {
      id: 'mg7-009-quiz-6',
      type: 'choice',
      text: 'A single on level 4. Points?',
      options: ['400', '100', '800', '104'],
      answer: '400',
      hints: ['100 × 4.'],
      reviewSection: 'Examples — Points on level 3',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg7-009-1',
      label: 'Read how hard drop works',
      type: 'read',
    },
    {
      id: 'cp-mg7-009-2',
      label: 'Read the level curve',
      type: 'read',
    },
    {
      id: 'cp-mg7-009-3',
      label: 'Read the finishing procedure',
      type: 'read',
    },
    {
      id: 'cp-mg7-009-4',
      label: 'Complete "Tetris 9: hard drop, levels and next" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg7-009-5',
      label: 'Play a whole game of your Tetris in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg7-009-6',
      label: 'Work through the level-3 example',
      type: 'example',
    },
    {
      id: 'cp-mg7-009-7',
      label: 'Work through the points example',
      type: 'example',
    },
    {
      id: 'cp-mg7-009-8',
      label: 'Attempt the never-speeds-up challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-7',
}
