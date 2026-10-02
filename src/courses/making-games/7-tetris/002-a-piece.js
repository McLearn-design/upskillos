export default {
  order: 2,

  id: 'mg7-002',

  slug: 'a-piece',

  title: 'Tetris 2: A Piece',

  subtitle: 'A shape, a place and a colour, drawn over the board.',

  tags: ['game-studio', 'tetris', 'objects'],

  aliases: 'tetromino piece cells offsets spawn object type x y',

  timeToComplete: 25,

  coreConcept: 'A falling piece is a small object: its type, its four cells as offsets from a centre, and where that centre is. It is kept apart from the board until it lands; draw() paints it over the board each frame.',

  prerequisites: ['mg7-001'],

  nextLesson: 'mg7-003',

  hook: {
    question: 'The T piece is four cells in a T shape. When it falls one row, do you change four numbers in the board, then four more, every half second?',
    realWorldContext: 'Describing a shape as offsets from a point, then placing it, is how games handle any multi-part thing: pieces, ships, brushes, formations.',
  },

  intuition: {
    prose: [
      'The T piece is four cells around its centre: [−1, 0], [0, 0], [1, 0] and [0, −1], each [x, y]. Put the centre at x = 4, y = 1 and the cells are at (3, 1), (4, 1), (5, 1) and (4, 0).',
      'Before reading on, predict: where are its cells if the centre moves to x = 6, y = 5? Add the same offsets: (5, 5), (6, 5), (7, 5) and (6, 4). Moving the piece is changing two numbers, x and y.',
      "So `this.piece` is an object: `{ type: 'T', cells: PIECES.T, x: 4, y: 1 }`. spawn(type) makes one at the top middle. pieces.js holds all seven shapes, PIECES, and colourOf(type) gives each its colour number.",
      "The piece is not in this.cells. It is still moving, so it is drawn on top: after the board, draw() paints each of the piece's cells, at row piece.y + y and column piece.x + x, with TEXTURES[colourOf(piece.type)].",
      'A cell above the top (row −1) is skipped when drawing: pieces come in from above.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: A piece over the board',
        body: "Step 1. Write spawn(type): this.piece = { type, cells: PIECES[type], x: 4, y: 1 }.\nStep 2. Call this.spawn('T') at the end of ready().\nStep 3. In draw(), after the board, loop over the piece's cells.\nStep 4. For each [x, y]: row = piece.y + y, col = piece.x + x; skip it if it is off the board.\nStep 5. Set that sprite's texture to TEXTURES[colourOf(piece.type)], and run.",
      },
      {
        type: 'warning',
        title: 'Keep the piece out of the board',
        body: 'Writing the falling piece into this.cells leaves a trail: each move would leave its old cells coloured. The piece joins the board only when it lands (lesson 7.4).',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Tetris 2: a piece',
        props: {
          task: 'tetris-piece',
          lesson: 'mg7-002',
          checkpoint: 'cp-mg7-002-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** A piece is a set of offsets $\\{(x_i, y_i)\\}$ and a position $(p_x, p_y)$; its cells are $\\{(p_x + x_i, p_y + y_i)\\}$. Moving by $(d_x, d_y)$ adds to the position only: a translation.',
      'The seven pieces are the seven tetrominoes: every way of joining four squares edge to edge, counting mirror images as different (S and Z, J and L) and turns as the same. There are exactly seven.',
      "Choosing [0, 0] near each piece's middle matters later: turning (lesson 7.5) spins the offsets about [0, 0], so a piece turns in place instead of swinging round a corner.",
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      "Formally, a piece's cells are the translate $P + \\mathbf{p}$ of its shape $P$; the board check (next lesson) asks whether $P + \\mathbf{p}$ lies inside the well and avoids the filled cells.",
      'The invariant of a move is the shape: translating changes where the cells are, never their arrangement.',
      'Picture a stamp (the shape) and where it is pressed (the position); the board is the paper.',
      'Shapes of $n$ squares are polyominoes. Counting mirror images as the same, there are 5 of four squares, 12 of five and 35 of six; Tetris uses the 7 one-sided tetrominoes, where mirror images count separately.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg7-002-ex1',
      title: 'Where the T is',
      difficulty: 'easy',
      problem: 'The T at x = 4, y = 1. Where are its cells?',
      steps: [
        {
          expression: '(4 - 1, 1), (4, 1), (4 + 1, 1), (4, 1 - 1)',
          annotation: 'Add each offset to the centre.',
          strategyTitle: 'Step 1: Add the offsets',
        },
      ],
      answer: '(3, 1), (4, 1), (5, 1) and (4, 0).',
    },
    {
      id: 'mg7-002-ex2',
      title: 'After moving',
      difficulty: 'medium',
      problem: 'The T moves to x = 6, y = 5. Which rows and columns light up?',
      steps: [
        {
          expression: '(5, 5), (6, 5), (7, 5), (6, 4)',
          annotation: 'The same offsets from the new centre.',
          strategyTitle: 'Step 1: New cells',
        },
        {
          expression: 'cells: \\text{row } 5 \\text{ cols } 5\\text{–}7, \\text{ row } 4 \\text{ col } 6',
          annotation: 'In [row][col] terms, y is the row.',
          strategyTitle: 'Step 2: As rows and columns',
        },
      ],
      answer: 'Row 5, columns 5–7, and row 4, column 6.',
    },
    {
      id: 'mg7-002-ex3',
      title: 'Spawning off the top',
      difficulty: 'hard',
      problem: 'An L is [1, −1], [−1, 0], [0, 0], [1, 0]. If it spawned at y = 0, what happens to one cell?',
      steps: [
        {
          expression: 'y = 0 + (-1) = -1',
          annotation: 'The [1, −1] cell is above the board.',
          strategyTitle: 'Step 1: Find the row',
        },
        {
          expression: '\\text{row} < 0 \\Rightarrow \\text{not drawn}',
          annotation: 'draw() skips it; that is why pieces spawn at y = 1.',
          strategyTitle: 'Step 2: Drawing it',
        },
      ],
      answer: 'One cell would be at row −1 and not shown; spawning at y = 1 keeps all four visible.',
    },
  ],

  challenges: [
    {
      id: 'mg7-002-ch1',
      title: 'The O',
      difficulty: 'easy',
      problem: 'The O is [0, 0], [1, 0], [0, 1], [1, 1], at x = 4, y = 1. Its cells?',
      hint: 'Add the offsets.',
      answer: '(4, 1), (5, 1), (4, 2), (5, 2).',
      walkthrough: [
        {
          expression: '(4,1),(5,1),(4,2),(5,2)',
          annotation: 'A 2 × 2 square.',
        },
      ],
    },
    {
      id: 'mg7-002-ch2',
      title: 'Colour numbers',
      difficulty: 'medium',
      problem: "TYPES is ['I', 'O', 'T', 'S', 'Z', 'J', 'L']. What is colourOf('J')?",
      hint: 'Index plus one.',
      answer: '6, because J is at index 5.',
      walkthrough: [],
    },
    {
      id: 'mg7-002-ch3',
      title: 'Debug the trail',
      difficulty: 'hard',
      problem: 'A learner draws the piece by writing it into this.cells each frame. Moving it leaves coloured cells behind. Why?',
      hint: 'Who clears the old cells?',
      answer: 'Nothing clears them; keep the piece out of this.cells and draw it over the board instead.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'this.piece',
        meaning: 'The falling piece: { type, cells, x, y }.',
      },
      {
        symbol: 'offsets',
        meaning: "The piece's cells relative to its centre [0, 0].",
      },
      {
        symbol: 'spawn(type)',
        meaning: 'Makes a new piece of that type at the top middle.',
      },
      {
        symbol: 'colourOf(type)',
        meaning: 'The colour number for a piece type.',
      },
      {
        symbol: 'tetromino',
        meaning: 'One of the seven shapes of four squares joined edge to edge.',
      },
    ],
    rulesOfThumb: [
      'Describe shapes as offsets from a centre.',
      'Move a piece by changing its x and y only.',
      'Keep the falling piece out of the board until it lands.',
      'Skip cells above the top when drawing.',
    ],
  },

  misconceptions: [
    {
      falseBelief: "Moving a piece means moving four cells' numbers.",
      whyStudentsThinkIt: 'Four cells change colour on screen.',
      correctionExample: 'Changing x from 4 to 5 moves all four cells one column.',
      contrastCase: 'The offsets never change for a move.',
    },
    {
      falseBelief: 'The piece is part of the board while it falls.',
      whyStudentsThinkIt: "It is drawn in the board's cells.",
      correctionExample: 'this.cells stays all zeros while the first T falls.',
      contrastCase: 'It joins this.cells only when it lands.',
    },
  ],

  transferPrompts: [
    {
      situation: "A paint program's brush should stamp a 3 × 3 pattern where you click.",
      competingTechniques: ['Offsets from the click point', 'Nine separate click handlers'],
      whyThisTechniqueWins: 'The same offsets stamp anywhere.',
    },
    {
      situation: 'A formation of five ships should move together.',
      competingTechniques: [
        'Ships as offsets from one formation position',
        'Moving each ship by hand',
      ],
      whyThisTechniqueWins: 'Moving the formation moves them all, and the shape stays exact.',
    },
  ],

  debugging: [
    {
      commonError: 'Using piece.x for rows and piece.y for columns.',
      symptom: 'The piece appears turned on its side and in the wrong place.',
      whyItHappened: 'Rows go with y, columns with x.',
      repairStrategy: 'row = piece.y + y, col = piece.x + x.',
    },
    {
      commonError: 'Drawing the piece before the board.',
      symptom: 'The piece is invisible.',
      whyItHappened: 'The board loop paints over it afterwards.',
      repairStrategy: 'Draw the board first, then the piece.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Represent and draw a piece over the board.',
    explainVerbally: 'Explain offsets and why the piece is kept apart from the board.',
    detectIncorrectApplication: 'Spot trails and x/y mix-ups.',
    transferToUnfamiliar: 'Use offsets for brushes and formations.',
  },

  assessment: {
    questions: [
      {
        id: 'mg7-002-assess-1',
        type: 'choice',
        text: 'The T ([−1,0],[0,0],[1,0],[0,−1]) at (4, 1). Which is one of its cells?',
        options: ['(4, 0)', '(4, 2)', '(0, 0)', '(1, 4)'],
        answer: '(4, 0)',
        hint: 'The [0, −1] offset.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg7-002-quiz-1',
      type: 'choice',
      text: 'What does moving the piece one column right change?',
      options: ['piece.x', 'Every offset', 'this.cells', 'The sprites'],
      answer: 'piece.x',
      hints: ['A translation.'],
      reviewSection: 'Intuition — the moving paragraph',
    },
    {
      id: 'mg7-002-quiz-2',
      type: 'choice',
      text: 'Why spawn at y = 1?',
      options: [
        'So cells with offset −1 are on the board',
        'Because row 0 is a wall',
        'To fall faster',
        'No reason',
      ],
      answer: 'So cells with offset −1 are on the board',
      hints: ['Row −1 is not drawn.'],
      reviewSection: 'Examples — Spawning off the top',
    },
    {
      id: 'mg7-002-quiz-3',
      type: 'choice',
      text: 'How many tetrominoes are there?',
      options: ['7', '5', '4', '19'],
      answer: '7',
      hints: ['Mirror images count as different.'],
      reviewSection: 'Under the hood — tetrominoes',
    },
    {
      id: 'mg7-002-quiz-4',
      type: 'choice',
      text: 'Where is a piece cell drawn?',
      options: [
        'Row piece.y + y, column piece.x + x',
        'Row piece.x + x, column piece.y + y',
        'At piece.x, piece.y',
        'At its offset',
      ],
      answer: 'Row piece.y + y, column piece.x + x',
      hints: ['y goes with rows.'],
      reviewSection: 'Intuition — the draw paragraph',
    },
    {
      id: 'mg7-002-quiz-5',
      type: 'choice',
      text: 'Which of these should NOT happen while a piece falls?',
      options: [
        'Writing it into this.cells',
        'Changing piece.y',
        'Drawing it over the board',
        'Reading PIECES',
      ],
      answer: 'Writing it into this.cells',
      hints: ['It would leave a trail.'],
      reviewSection: 'Intuition — Warning: keep the piece out',
    },
    {
      id: 'mg7-002-quiz-6',
      type: 'choice',
      text: "colourOf('I') with TYPES ['I','O','T',...]?",
      options: ['1', '0', '2', '7'],
      answer: '1',
      hints: ['Index 0 plus one; 0 is empty.'],
      reviewSection: 'Challenges — colour numbers',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg7-002-1',
      label: 'Read a piece as offsets',
      type: 'read',
    },
    {
      id: 'cp-mg7-002-2',
      label: 'Read why the piece stays out of the board',
      type: 'read',
    },
    {
      id: 'cp-mg7-002-3',
      label: 'Read the piece procedure',
      type: 'read',
    },
    {
      id: 'cp-mg7-002-4',
      label: 'Complete "Tetris 2: a piece" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg7-002-5',
      label: 'Spawn each of the seven pieces in turn and look at them',
      type: 'lab',
    },
    {
      id: 'cp-mg7-002-6',
      label: 'Work through the after-moving example',
      type: 'example',
    },
    {
      id: 'cp-mg7-002-7',
      label: 'Work through the spawning example',
      type: 'example',
    },
    {
      id: 'cp-mg7-002-8',
      label: 'Attempt the trail challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-7',
}
