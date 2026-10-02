export default {
  order: 3,

  id: 'mg7-003',

  slug: 'moving-and-walls',

  title: 'Tetris 3: Moving, and Walls',

  subtitle: 'Ask "would it fit?" before every move.',

  tags: ['game-studio', 'tetris', 'collision'],

  aliases: 'canplace move collision check walls isjustpressed grid collision',

  timeToComplete: 25,

  coreConcept: "Grid collision is a question, not physics: canPlace(cells, x, y) says whether a piece's cells, placed there, are all inside the well and on empty cells. move(dx, dy) moves only if the answer is yes.",

  prerequisites: ['mg7-002'],

  nextLesson: 'mg7-004',

  hook: {
    question: 'In chapter 2 the engine pushed bodies out of walls. Tetris pieces never overlap anything, not even for a frame. How?',
    realWorldContext: 'Grid games (Tetris, Sokoban, roguelikes, chess) check a move before making it. "Would it fit?" is the one rule every later rule in this game uses: falling, turning and game over.',
  },

  intuition: {
    prose: [
      'An O piece sits at x = 0: cells at columns 0 and 1. Pressing ← would put them at columns −1 and 0. Column −1 is outside the well, so the move is refused and the piece stays.',
      'canPlace(cells, x, y) checks each cell: column below 0 or above 9, or row below 19, means no. A cell on a non-zero number in this.cells means no. Otherwise yes. A row above the top is allowed.',
      'Before reading on, predict: an O at x = 8 (columns 8 and 9). Can it move right? No: column 10 is past the edge.',
      'move(dx, dy) asks canPlace with the moved position; if it fits, it changes x and y and returns true, else it returns false and changes nothing. That true or false will matter: next lesson, "could not fall" means "landed".',
      'The keys use isJustPressed: one press, one column. With isPressed the piece would race to the wall in a fraction of a second, 60 columns a second.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Moves that respect walls',
        body: 'Step 1. Write canPlace(cells, x, y): for each [cx, cy], col = x + cx, row = y + cy.\nStep 2. Return false if col < 0, col ≥ 10 or row ≥ 20, or if row ≥ 0 and this.cells[row][col] ≠ 0.\nStep 3. Return true after checking every cell.\nStep 4. Write move(dx, dy): if canPlace at the moved position, change x and y and return true; else return false.\nStep 5. In update: isJustPressed move_left → move(−1, 0); move_right → move(1, 0).',
      },
      {
        type: 'warning',
        title: 'Check first, then move',
        body: 'Moving and then checking leaves the piece inside the wall for a moment, and if you forget to move it back it stays there. Ask first; move only on yes.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Tetris 3: moving, and walls',
        props: {
          task: 'tetris-move',
          lesson: 'mg7-003',
          checkpoint: 'cp-mg7-003-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** canPlace is a universal statement: every cell $(c, r)$ of the moved piece satisfies $0 \\leq c < 10$, $r < 20$, and ($r < 0$ or $\\text{cells}[r][c] = 0$). It is true only if no cell fails, so the loop can stop at the first failure.',
      "Each check is a few comparisons for each of 4 cells, so a move costs about 16 operations, whatever happened before. Compare chapter 2's overlap and push: grids make collision exact and cheap.",
      'move returns a boolean, a true-or-false value. Returning what happened, instead of nothing, lets the caller decide what to do next: the fall in lesson 7.4 locks the piece when move(0, 1) is false.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      "Formally, the legal positions are those where the piece's cells form a subset of the empty cells of the well (with rows above the top allowed). Moves are transitions between legal positions; illegal ones are refused.",
      'The invariant: the piece is in a legal position after every frame. No code path can leave it overlapping.',
      'Picture the empty cells as holes in a board; a legal piece fits entirely into holes.',
      'The same check-before-act shape guards turning, spawning and game over in later lessons; this is the single rule the whole game is built on.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg7-003-ex1',
      title: 'Against the left wall',
      difficulty: 'easy',
      problem: 'An O at x = 0. Can it move left?',
      steps: [
        {
          expression: '0 + 0 - 1 = -1 < 0',
          annotation: 'Its [0, 0] cell would be at column −1.',
          strategyTitle: 'Step 1: Check the moved cells',
        },
      ],
      answer: 'No; move(−1, 0) returns false and x stays 0.',
    },
    {
      id: 'mg7-003-ex2',
      title: 'On a filled cell',
      difficulty: 'medium',
      problem: 'cells[5][5] = 2. A single-cell test piece [[1, 0]] at x = 4, y = 5. Can it be placed?',
      steps: [
        {
          expression: 'col = 4 + 1 = 5,\\ row = 5 + 0 = 5',
          annotation: 'The cell lands on (5, 5).',
          strategyTitle: 'Step 1: Where it lands',
        },
        {
          expression: 'cells[5][5] = 2 \\neq 0',
          annotation: 'Filled, so no.',
          strategyTitle: 'Step 2: Check the board',
        },
      ],
      answer: 'No, it would overlap a filled cell.',
    },
    {
      id: 'mg7-003-ex3',
      title: 'Holding the key',
      difficulty: 'hard',
      problem: 'The T starts at x = 4. Holding ← for 0.3 s with isPressed (moving every frame at 60 fps). Where does it end?',
      steps: [
        {
          expression: '0.3 \\times 60 = 18 \\text{ tries}',
          annotation: 'One move attempt per frame.',
          strategyTitle: 'Step 1: Count the tries',
        },
        {
          expression: 'x = 1 \\text{ (its } [-1, 0] \\text{ cell at column } 0)',
          annotation: 'It stops at the wall after 3 moves and the rest are refused.',
          strategyTitle: 'Step 2: Where the wall stops it',
        },
      ],
      answer: 'At x = 1, against the wall; with isJustPressed it would be at x = 3.',
    },
  ],

  challenges: [
    {
      id: 'mg7-003-ch1',
      title: 'Right wall',
      difficulty: 'easy',
      problem: 'The I is [−1,0],[0,0],[1,0],[2,0]. What is the largest x it can have?',
      hint: 'Its rightmost offset is 2.',
      answer: 'x = 7, putting its last cell at column 9.',
      walkthrough: [
        {
          expression: 'x + 2 \\leq 9',
          annotation: 'The last cell must be at most column 9.',
        },
      ],
    },
    {
      id: 'mg7-003-ch2',
      title: 'The floor',
      difficulty: 'medium',
      problem: 'The O ([0,0],[1,0],[0,1],[1,1]). What is the largest y it can have on an empty board?',
      hint: 'Its lowest offset is 1.',
      answer: 'y = 18, putting its bottom cells in row 19.',
      walkthrough: [],
    },
    {
      id: 'mg7-003-ch3',
      title: 'Debug the stuck piece',
      difficulty: 'hard',
      problem: "A learner's move does p.x += dx; then if (!canPlace(p.cells, p.x, p.y)) return false. Moving into a wall leaves the piece inside it. Why?",
      hint: 'What happens to x when it does not fit?',
      answer: 'It moved before checking and never moved back; check canPlace at x + dx first and change x only if it fits.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'canPlace(cells, x, y)',
        meaning: 'Whether every cell, placed there, is inside the well and on an empty cell.',
      },
      {
        symbol: 'move(dx, dy)',
        meaning: 'Moves if it fits; returns true if it moved, false if not.',
      },
      {
        symbol: 'boolean',
        meaning: 'A true-or-false value.',
      },
      {
        symbol: 'isJustPressed',
        meaning: 'True only on the frame the key goes down.',
      },
    ],
    rulesOfThumb: [
      'Check first, then move.',
      'Return what happened, so callers can react.',
      'One press, one step, for grid moves.',
      'Allow rows above the top, so pieces can turn as they enter.',
    ],
  },

  misconceptions: [
    {
      falseBelief: "Tetris walls work like chapter 2's physics walls.",
      whyStudentsThinkIt: 'Both stop things.',
      correctionExample: 'A Tetris piece never overlaps a wall even for a frame; the move is refused.',
      contrastCase: 'Physics moves first and pushes out after.',
    },
    {
      falseBelief: 'A refused move should move the piece as far as it can.',
      whyStudentsThinkIt: 'Sliding up to a wall seems natural.',
      correctionExample: 'Moving by 1 either happens fully or not at all.',
      contrastCase: 'On a grid there is no "partly" a cell.',
    },
  ],

  transferPrompts: [
    {
      situation: 'In Sokoban, the player pushes a crate one square.',
      competingTechniques: [
        "Check the crate's new square is empty, then move both",
        'Move both and undo if it overlaps',
      ],
      whyThisTechniqueWins: 'Checking first never puts the board in an illegal state.',
    },
    {
      situation: 'A chess program generates moves.',
      competingTechniques: [
        'Test each candidate square before allowing it',
        'Allow any and fix later',
      ],
      whyThisTechniqueWins: 'Only legal positions are ever reached.',
    },
  ],

  debugging: [
    {
      commonError: 'Testing col > 10 instead of col >= 10.',
      symptom: 'Pieces can poke one column past the right edge, where there is no sprite.',
      whyItHappened: 'Columns go 0 to 9; 10 is outside.',
      repairStrategy: 'Use col >= COLS.',
    },
    {
      commonError: 'Reading this.cells[row] for a negative row.',
      symptom: 'An error about reading undefined, when a piece turns near the top.',
      whyItHappened: 'There is no row −1.',
      repairStrategy: 'Only look in this.cells when row >= 0.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Write canPlace and move, and wire the keys.',
    explainVerbally: 'Explain why checking before moving keeps the game legal.',
    detectIncorrectApplication: 'Spot move-then-check code and off-by-one edges.',
    transferToUnfamiliar: 'Apply check-before-act to any grid game.',
  },

  assessment: {
    questions: [
      {
        id: 'mg7-003-assess-1',
        type: 'choice',
        text: 'An O at x = 8. Can it move right?',
        options: [
          'No, column 10 is outside',
          'Yes',
          'Only on the floor',
          'Only with isPressed',
        ],
        answer: 'No, column 10 is outside',
        hint: 'Its cells are at 8 and 9.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg7-003-quiz-1',
      type: 'choice',
      text: 'What does move return when the piece cannot move?',
      options: ['false', 'true', 'nothing', 'the new x'],
      answer: 'false',
      hints: ['It reports what happened.'],
      reviewSection: 'Intuition — the move paragraph',
    },
    {
      id: 'mg7-003-quiz-2',
      type: 'choice',
      text: 'Which cell fails canPlace?',
      options: [
        'Column 10',
        'Row −1',
        'Row 19, column 9 when empty',
        'Row 0, column 0 when empty',
      ],
      answer: 'Column 10',
      hints: ['Rows above the top are allowed.'],
      reviewSection: 'Intuition — the canPlace paragraph',
    },
    {
      id: 'mg7-003-quiz-3',
      type: 'choice',
      text: 'Why use isJustPressed for ← and →?',
      options: [
        'One press, one column',
        'It is faster',
        'isPressed does not work',
        'To allow turning',
      ],
      answer: 'One press, one column',
      hints: ['isPressed is true every frame.'],
      reviewSection: 'Examples — Holding the key',
    },
    {
      id: 'mg7-003-quiz-4',
      type: 'choice',
      text: 'The largest x for the I piece ([−1..2, 0])?',
      options: ['7', '9', '8', '6'],
      answer: '7',
      hints: ['Its last cell at 9.'],
      reviewSection: 'Challenges — right wall',
    },
    {
      id: 'mg7-003-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT checked by canPlace?',
      options: ['Rows above the top', 'The left wall', 'The floor', 'Filled cells'],
      answer: 'Rows above the top',
      hints: ['They are allowed.'],
      reviewSection: 'Under the hood — the statement',
    },
    {
      id: 'mg7-003-quiz-6',
      type: 'choice',
      text: 'A move that would overlap a filled cell does what?',
      options: [
        'Nothing; the piece stays',
        'Moves part way',
        'Pushes the piece back',
        'Ends the game',
      ],
      answer: 'Nothing; the piece stays',
      hints: ['All or nothing.'],
      reviewSection: 'Misconceptions — partial moves',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg7-003-1',
      label: 'Read how a move is checked',
      type: 'read',
    },
    {
      id: 'cp-mg7-003-2',
      label: 'Read why move returns true or false',
      type: 'read',
    },
    {
      id: 'cp-mg7-003-3',
      label: 'Read the moving procedure',
      type: 'read',
    },
    {
      id: 'cp-mg7-003-4',
      label: 'Complete "Tetris 3: moving, and walls" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg7-003-5',
      label: 'Try isPressed instead in Game Studio and feel the difference',
      type: 'lab',
    },
    {
      id: 'cp-mg7-003-6',
      label: 'Work through the filled-cell example',
      type: 'example',
    },
    {
      id: 'cp-mg7-003-7',
      label: 'Work through the holding-the-key example',
      type: 'example',
    },
    {
      id: 'cp-mg7-003-8',
      label: 'Attempt the stuck-piece challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-7',
}
