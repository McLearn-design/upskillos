export default {
  order: 4,

  id: 'mg7-004',

  slug: 'falling-and-landing',

  title: 'Tetris 4: Falling and Landing',

  subtitle: 'A timer made from dt, a piece that lands, and the next one.',

  tags: ['game-studio', 'tetris', 'timers'],

  aliases: 'timer interval fall lock soft drop dt accumulate land',

  timeToComplete: 25,

  coreConcept: 'A timer is dt added up. When it reaches the fall interval the piece tries to move down; if move(0, 1) is refused, the piece has landed, so lock() copies its cells into the board and a new piece spawns.',

  prerequisites: ['mg7-003'],

  nextLesson: 'mg7-005',

  hook: {
    question: 'Tetris pieces fall one row every half second, not smoothly. And when one cannot fall any further it becomes part of the pile. How does the game know the moment it lands?',
    realWorldContext: 'Timers made from dt run cooldowns, spawns, day–night cycles and turn clocks. And "the move failed, so something happened" is a pattern every grid game uses.',
  },

  intuition: {
    prose: [
      'Add `timer = 0` and `interval = 0.5` to the class. Each frame, `this.timer += dt`. At 60 frames a second, after 30 frames the timer reaches 0.5: set it back to 0 and move(0, 1). One row every half second.',
      'Before reading on, predict: starting at row 1, where is the piece after 2.1 seconds? Four falls (at 0.5, 1.0, 1.5 and 2.0 s): row 5.',
      'When move(0, 1) returns false, the piece cannot fall: it is on the floor or on the pile. That false is the landing: `if (!this.move(0, 1)) this.lock()`.',
      'lock() writes the piece into the board: for each of its cells, `this.cells[p.y + y][p.x + x] = colourOf(p.type)`. Now those cells are part of the pile, and the next piece will stop on them. Then spawn a new piece.',
      'Soft drop: while ↓ is held, use 0.05 s instead of the interval, so the piece falls ten times as fast.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Fall, land and lock',
        body: "Step 1. Fields: timer = 0, interval = 0.5.\nStep 2. In update: this.timer += dt; const wait = input.isPressed('move_down') ? 0.05 : this.interval.\nStep 3. If this.timer >= wait: this.timer = 0, then if (!this.move(0, 1)) this.lock().\nStep 4. lock(): copy each of the piece's cells into this.cells with its colour number, then spawn.\nStep 5. Run: pieces fall, pile up, and ↓ drops them faster.",
      },
      {
        type: 'warning',
        title: 'Count seconds, not frames',
        body: 'Falling every 30 frames is half a second at 60 fps but a fifth of a second at 144. Add dt to the timer, as in lesson 1.3, so it is half a second everywhere.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Tetris 4: falling and landing',
        props: {
          task: 'tetris-fall',
          lesson: 'mg7-004',
          checkpoint: 'cp-mg7-004-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** The timer after $n$ frames is $\\sum dt_i$, the elapsed time. Falling whenever it passes the interval $I$ gives $\\lfloor t / I \\rfloor$ falls in $t$ seconds: $\\lfloor 2.1 / 0.5 \\rfloor = 4$.',
      "Setting the timer back to 0 (rather than subtracting $I$) loses the leftover each time, up to one frame's worth, so over many falls it drifts slightly slow. Subtracting keeps exact time; for Tetris either feels the same.",
      'From row 1, a T (bottom offset 0) falls until its bottom cells reach row 19: 18 falls, $18 \\times 0.5 = 9$ s. With soft drop, $18 \\times 0.05 = 0.9$ s.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, the game has two clocks: the frame clock (variable $dt$) and the fall clock (fixed $I$). The timer converts one into the other; this is how fixed-rate events are scheduled in a variable-rate loop.',
      'The invariant of lock: after it, the board contains every landed cell exactly once, and the falling piece is a new one at the top.',
      'Picture time as a line marked every $I$ seconds; each mark is a fall attempt, and a refused attempt is a landing.',
      'Real Tetris games add "lock delay", a short grace after touching down when the piece can still slide; it is a second timer that starts when move(0, 1) first fails.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg7-004-ex1',
      title: 'Falls in 2.1 seconds',
      difficulty: 'easy',
      problem: 'Interval 0.5 s, starting at row 1. Which row after 2.1 s?',
      steps: [
        {
          expression: '\\lfloor 2.1 / 0.5 \\rfloor = 4',
          annotation: 'Four whole intervals have passed.',
          strategyTitle: 'Step 1: Count the falls',
        },
        {
          expression: '1 + 4 = 5',
          annotation: 'One row per fall.',
          strategyTitle: 'Step 2: Add them',
        },
      ],
      answer: 'Row 5.',
    },
    {
      id: 'mg7-004-ex2',
      title: 'Time to land',
      difficulty: 'medium',
      problem: 'A T spawns at row 1 on an empty board. How long until it locks?',
      steps: [
        {
          expression: '19 - 1 = 18 \\text{ falls}',
          annotation: 'Its bottom cells start in row 1 and stop in row 19.',
          strategyTitle: 'Step 1: Falls needed',
        },
        {
          expression: '18 \\times 0.5 + 0.5 = 9.5\\ \\text{s}',
          annotation: 'Plus one more interval for the refused fall that locks it.',
          strategyTitle: 'Step 2: Time',
        },
      ],
      answer: 'About 9.5 seconds (9 s to arrive, plus the refused fall).',
    },
    {
      id: 'mg7-004-ex3',
      title: 'What lock writes',
      difficulty: 'hard',
      problem: 'A T (colour 3) locks at x = 4, y = 19. Which cells become 3?',
      steps: [
        {
          expression: '(3,19),(4,19),(5,19),(4,18)',
          annotation: 'The offsets [−1,0],[0,0],[1,0],[0,−1] from (4, 19).',
          strategyTitle: 'Step 1: The cells',
        },
        {
          expression: 'cells[19][3..5] = 3,\\ cells[18][4] = 3',
          annotation: 'As rows and columns.',
          strategyTitle: 'Step 2: Into the board',
        },
      ],
      answer: 'Row 19 columns 3–5 and row 18 column 4 become 3.',
    },
  ],

  challenges: [
    {
      id: 'mg7-004-ch1',
      title: 'Faster level',
      difficulty: 'easy',
      problem: 'With interval 0.25 s, how many falls in 3 s?',
      hint: 'Time ÷ interval.',
      answer: '12 falls.',
      walkthrough: [
        {
          expression: '3 / 0.25 = 12',
          annotation: 'Whole intervals.',
        },
      ],
    },
    {
      id: 'mg7-004-ch2',
      title: 'Soft drop time',
      difficulty: 'medium',
      problem: 'Holding ↓ the whole way from row 1 to 19, how long does the fall take?',
      hint: '18 falls at 0.05 s.',
      answer: '0.9 seconds.',
      walkthrough: [],
    },
    {
      id: 'mg7-004-ch3',
      title: 'Debug the hovering pile',
      difficulty: 'hard',
      problem: "Pieces stop at the bottom, but the next piece falls straight through the last one. lock() only calls this.spawn('T'). What is missing?",
      hint: 'What makes landed cells solid for canPlace?',
      answer: "lock never writes the piece into this.cells, so canPlace sees empty cells; write each cell's colour before spawning.",
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'timer',
        meaning: 'Seconds added up from dt; reaching the interval triggers a fall.',
      },
      {
        symbol: 'interval',
        meaning: 'Seconds between falls (0.5).',
      },
      {
        symbol: 'lock()',
        meaning: 'Copies the landed piece into the board and spawns the next.',
      },
      {
        symbol: 'soft drop',
        meaning: 'A shorter wait (0.05 s) while ↓ is held.',
      },
      {
        symbol: '⌊t / I⌋',
        meaning: 'How many falls happen in t seconds.',
      },
    ],
    rulesOfThumb: [
      'Build timers from dt.',
      'Treat a refused fall as a landing.',
      'Lock, then spawn, in that order.',
      'Keep the fall interval in one field, so levels can change it.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'The piece should check every frame whether something is below it.',
      whyStudentsThinkIt: 'Landing seems like something to watch for.',
      correctionExample: 'The landing is simply move(0, 1) returning false at a fall.',
      contrastCase: 'One check per fall attempt is enough, and it is the same check as moving.',
    },
    {
      falseBelief: 'Landed pieces stay as pieces.',
      whyStudentsThinkIt: 'They still look like their shapes.',
      correctionExample: 'After lock, the T is just four 3s in this.cells; there is no T object any more.',
      contrastCase: 'That is what lets lines clear through the middle of old pieces (next lessons).',
    },
  ],

  transferPrompts: [
    {
      situation: 'A turn-based game gives each player 30 seconds.',
      competingTechniques: ['A timer adding dt, compared with 30', 'Counting frames up to 1800'],
      whyThisTechniqueWins: 'dt makes it 30 real seconds on any screen.',
    },
    {
      situation: 'In a match-three game, gems fall into gaps.',
      competingTechniques: [
        'Try moving each gem down a row each step; stop when refused',
        'Animate them smoothly and hope they line up',
      ],
      whyThisTechniqueWins: 'The same check-and-move rule keeps the grid exact.',
    },
  ],

  debugging: [
    {
      commonError: 'Not resetting the timer.',
      symptom: 'After the first half second the piece falls every frame and slams down.',
      whyItHappened: 'The timer stays above the interval.',
      repairStrategy: 'Set this.timer = 0 when it fires.',
    },
    {
      commonError: 'Spawning before copying the piece into the board.',
      symptom: 'Nothing locks; pieces vanish when they land.',
      whyItHappened: 'spawn replaced this.piece before its cells were written.',
      repairStrategy: 'Write the cells first, then spawn.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Make pieces fall on a timer, land and lock.',
    explainVerbally: 'Explain timers from dt and why a refused fall means landing.',
    detectIncorrectApplication: 'Spot frame-counted timers and lock order bugs.',
    transferToUnfamiliar: 'Schedule fixed-rate events in any game.',
  },

  assessment: {
    questions: [
      {
        id: 'mg7-004-assess-1',
        type: 'choice',
        text: 'Interval 0.5 s from row 1. Row after 2.1 s?',
        options: ['5', '4', '3', '6'],
        answer: '5',
        hint: 'Four falls.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg7-004-quiz-1',
      type: 'choice',
      text: 'What makes the timer?',
      options: [
        'Adding dt each frame',
        'Adding 1 each frame',
        'The clock on the wall',
        'physicsUpdate',
      ],
      answer: 'Adding dt each frame',
      hints: ['Seconds, not frames.'],
      reviewSection: 'Intuition — Warning: count seconds',
    },
    {
      id: 'mg7-004-quiz-2',
      type: 'choice',
      text: 'What tells the game a piece has landed?',
      options: [
        'move(0, 1) returning false',
        'Its y reaching 19',
        'A collision event',
        'The timer reaching 0',
      ],
      answer: 'move(0, 1) returning false',
      hints: ['It could not fall.'],
      reviewSection: 'Intuition — the landing paragraph',
    },
    {
      id: 'mg7-004-quiz-3',
      type: 'choice',
      text: 'What does lock() do first?',
      options: [
        "Writes the piece's cells into the board",
        'Spawns a new piece',
        'Clears lines',
        'Resets the timer',
      ],
      answer: "Writes the piece's cells into the board",
      hints: ['Then spawn.'],
      reviewSection: 'Intuition — the lock paragraph',
    },
    {
      id: 'mg7-004-quiz-4',
      type: 'choice',
      text: 'Soft drop wait?',
      options: ['0.05 s', '0.5 s', '0 s', '1 s'],
      answer: '0.05 s',
      hints: ['Ten times faster.'],
      reviewSection: 'Intuition — soft drop',
    },
    {
      id: 'mg7-004-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT left after a T locks?',
      options: [
        'A T object',
        'Four 3s in this.cells',
        'A new falling piece',
        'The pile',
      ],
      answer: 'A T object',
      hints: ['It is just numbers now.'],
      reviewSection: 'Misconceptions — landed pieces',
    },
    {
      id: 'mg7-004-quiz-6',
      type: 'choice',
      text: 'Falls in 3 s at interval 0.25 s?',
      options: ['12', '4', '6', '0.75'],
      answer: '12',
      hints: ['3 ÷ 0.25.'],
      reviewSection: 'Under the hood — counting falls',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg7-004-1',
      label: 'Read how the timer works',
      type: 'read',
    },
    {
      id: 'cp-mg7-004-2',
      label: 'Read how landing is detected',
      type: 'read',
    },
    {
      id: 'cp-mg7-004-3',
      label: 'Read the fall procedure',
      type: 'read',
    },
    {
      id: 'cp-mg7-004-4',
      label: 'Complete "Tetris 4: falling and landing" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg7-004-5',
      label: 'Stack several pieces in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg7-004-6',
      label: 'Work through the time-to-land example',
      type: 'example',
    },
    {
      id: 'cp-mg7-004-7',
      label: 'Work through the what-lock-writes example',
      type: 'example',
    },
    {
      id: 'cp-mg7-004-8',
      label: 'Attempt the hovering-pile challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-7',
}
