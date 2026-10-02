export default {
  order: 1,

  id: 'mg7-001',

  slug: 'the-board',

  title: 'Tetris 1: The Board',

  subtitle: 'A grid of numbers, 10 across and 20 down, and a grid of pictures that shows it.',

  tags: ['game-studio', 'tetris', 'arrays'],

  aliases: 'tetris board 2d array grid cells sprites draw numbers row column',

  timeToComplete: 30,

  coreConcept: "The game is numbers; the screen only shows them. Tetris's board is a 2D array, cells[row][col], where 0 is empty and 1 to 7 is the colour of what landed there. Every frame, draw() sets each of 200 sprites' pictures from its number.",

  prerequisites: ['mg6-005'],

  nextLesson: 'mg7-002',

  hook: {
    question: 'A Tetris well is 10 cells wide and 20 tall. Is it 200 nodes you move around, or something simpler that the game can reason about?',
    realWorldContext: "Puzzle games, board games, minesweeper, match-three and level editors all keep their state as a grid of numbers and draw it. Separating the data from the picture is the first step of almost any game's design.",
  },

  intuition: {
    prose: [
      'Start with one row of the board: ten numbers, [0, 0, 0, 3, 3, 3, 0, 0, 0, 0]. The zeros are empty cells; the threes are part of a pink piece that has landed. The whole board is twenty such rows: an array of arrays.',
      '`this.cells[19][0]` is the bottom-left cell: row 19 (the last of 20, counting from 0), column 0. Before reading on, predict: which cell is `this.cells[0][9]`? The top-right one.',
      'The pictures are 200 Sprite2D nodes made once, in ready(), one per cell, kept in `this.sprites[row][col]`. Each is 26 pixels square (the art is 128 pixels, so scale 26/128) with its centre at column × 26 + 13, row × 26 + 13.',
      "draw() runs every frame and sets every sprite's texture to `TEXTURES[this.cells[row][col]]`: colour 0 is the black empty-cell picture, colours 1 to 7 the pieces'. Change a number and its picture follows on the next frame.",
      'The rule this whole game follows: change the numbers, never the pictures. Moving, landing, clearing and scoring will all be changes to `this.cells` and a few other numbers.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: A board you can see',
        body: "Step 1. Give Board (a Node2D at 350, 10) a script.\nStep 2. In ready(), make this.cells: 20 rows, each new Array(10).fill(0).\nStep 3. In ready(), make 200 Sprite2Ds in two loops, place and scale each, addChild it, and keep it in this.sprites[row][col].\nStep 4. Write draw(): every sprite's texture = TEXTURES[this.cells[row][col]].\nStep 5. Call this.draw() in update(dt), and run.",
      },
      {
        type: 'warning',
        title: 'Rows first, then columns',
        body: 'cells[row][col] is down first, then across, the opposite of (x, y). Mixing them up draws the board on its side or reads past the end of a row. Name the loop variables row and col, not i and j.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Tetris 1: the board',
        props: {
          task: 'tetris-board',
          lesson: 'mg7-001',
          checkpoint: 'cp-mg7-001-4',
        },
      },
    ],
  },

  math: {
    prose: [
      "**Under the hood (optional).** A 2D array can also be stored as one list of $R \\times C$ numbers: cell $(r, c)$ is entry $rC + c$, and entry $i$ is cell $(\\lfloor i / C \\rfloor, i \\bmod C)$. This row-major order is how tilesets (lesson 5.1) and Tiled's layers number their cells.",
      "A cell's centre on the screen is $(x_0 + cS + S/2,\\ y_0 + rS + S/2)$ for the board at $(x_0, y_0)$ and cells $S$ pixels: cell (19, 0) is at $(350 + 13,\\ 10 + 494 + 13) = (363, 517)$.",
      'The board is 10 × 26 = 260 pixels wide and 20 × 26 = 520 tall. At (350, 10) it spans x 350 to 610 and y 10 to 530, centred in the 960 × 540 game area: $350 + 130 = 480$.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, the board is a function $\\{0..19\\} \\times \\{0..9\\} \\to \\{0..7\\}$, and draw() is a function from boards to pictures. Keeping the game in the first and only deriving the second is the model–view separation.',
      'The invariant: the pictures always equal draw(cells) at the end of a frame, whatever changed the numbers.',
      'Picture two grids side by side, one of digits and one of coloured squares, with draw() mapping each digit to its square.',
      "Because the game is numbers, it can be tested and reasoned about without pictures: the task's checks read this.cells directly, and an AI could play it from the numbers alone (chapter 8).",
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg7-001-ex1',
      title: 'Reading a cell',
      difficulty: 'easy',
      problem: 'Which cell is cells[19][0], and which is cells[0][9]?',
      steps: [
        {
          expression: 'cells[19][0]: \\text{row } 19, \\text{ column } 0',
          annotation: 'The last row (bottom) and the first column (left).',
          strategyTitle: 'Step 1: Row then column',
        },
        {
          expression: 'cells[0][9]: \\text{row } 0, \\text{ column } 9',
          annotation: 'The first row (top) and the last column (right).',
          strategyTitle: 'Step 2: The other corner',
        },
      ],
      answer: 'cells[19][0] is bottom-left; cells[0][9] is top-right.',
    },
    {
      id: 'mg7-001-ex2',
      title: 'Where a sprite goes',
      difficulty: 'medium',
      problem: 'The board is at (350, 10) with 26-pixel cells. Where is the centre of cell row 2, column 5?',
      steps: [
        {
          expression: 'x = 350 + 5 \\times 26 + 13 = 493',
          annotation: 'Columns go across.',
          strategyTitle: 'Step 1: Across',
        },
        {
          expression: 'y = 10 + 2 \\times 26 + 13 = 75',
          annotation: 'Rows go down.',
          strategyTitle: 'Step 2: Down',
        },
      ],
      answer: 'At (493, 75).',
    },
    {
      id: 'mg7-001-ex3',
      title: 'One list instead',
      difficulty: 'hard',
      problem: 'If the board were one list of 200 numbers, row by row, which entry is row 7, column 3, and which cell is entry 156?',
      steps: [
        {
          expression: '7 \\times 10 + 3 = 73',
          annotation: 'Row times width plus column.',
          strategyTitle: 'Step 1: Cell to entry',
        },
        {
          expression: '156 = 15 \\times 10 + 6',
          annotation: 'Divide by the width for the row; the remainder is the column.',
          strategyTitle: 'Step 2: Entry to cell',
        },
      ],
      answer: 'Entry 73; entry 156 is row 15, column 6.',
    },
  ],

  challenges: [
    {
      id: 'mg7-001-ch1',
      title: 'The middle cell',
      difficulty: 'easy',
      problem: 'Which cell is half way down on the left edge?',
      hint: '20 rows, counting from 0.',
      answer: 'cells[10][0] (or cells[9][0]; 20 rows have no single middle).',
      walkthrough: [
        {
          expression: '20 / 2 = 10',
          annotation: 'Row 10 is the first of the bottom half.',
        },
      ],
    },
    {
      id: 'mg7-001-ch2',
      title: 'A taller well',
      difficulty: 'medium',
      problem: "A 22-row well with 24-pixel cells at y = 0. Where is the bottom row's centre?",
      hint: 'Row 21.',
      answer: 'At y = 21 × 24 + 12 = 516.',
      walkthrough: [],
    },
    {
      id: 'mg7-001-ch3',
      title: 'Debug the shared row',
      difficulty: 'hard',
      problem: 'A learner made the board with const row = new Array(10).fill(0); for 20 rows, this.cells.push(row). Setting cells[19][0] = 1 colours the whole left column. Why?',
      hint: 'How many arrays are there?',
      answer: 'Every row is the same array, so changing one changes all twenty; make a new array for each row inside the loop.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'cells[row][col]',
        meaning: 'The board: 0 empty, 1 to 7 the colour of what landed.',
      },
      {
        symbol: 'sprites[row][col]',
        meaning: 'The picture for each cell, made once.',
      },
      {
        symbol: 'draw()',
        meaning: "Sets every sprite's texture from its cell's number.",
      },
      {
        symbol: 'TEXTURES[n]',
        meaning: 'The picture for colour number n (0 is empty).',
      },
      {
        symbol: 'rC + c',
        meaning: "A cell's position in one row-major list.",
      },
    ],
    rulesOfThumb: [
      'Change the numbers, never the pictures.',
      'Rows first, then columns.',
      'Make every row its own array.',
      'Draw everything every frame; it is simpler than tracking changes.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'The pieces are moved by moving their sprites.',
      whyStudentsThinkIt: 'That is how Hero moved in chapter 1.',
      correctionExample: 'In Tetris no sprite ever moves; draw() changes which cells show colour.',
      contrastCase: 'The 200 sprites stay where ready() put them for the whole game.',
    },
    {
      falseBelief: 'cells[x][y] is across then down.',
      whyStudentsThinkIt: 'Positions are (x, y).',
      correctionExample: 'cells[19][0] is row 19 (down), column 0 (across).',
      contrastCase: 'An array of rows is indexed by row first.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A minesweeper game needs to know which squares hold mines.',
      competingTechniques: [
        'A 2D array of numbers, drawn each frame',
        'One node per square, each holding its state',
      ],
      whyThisTechniqueWins: 'The array is easy to count neighbours in and to reset; nodes would scatter the state.',
    },
    {
      situation: 'A board game should be saved and loaded.',
      competingTechniques: ['Save the array of numbers', "Save every sprite's picture"],
      whyThisTechniqueWins: 'The numbers are the game; the pictures can always be redrawn from them.',
    },
  ],

  debugging: [
    {
      commonError: 'Making the sprites in update instead of ready.',
      symptom: 'The game slows to a crawl and the scene tree fills with thousands of sprites.',
      whyItHappened: 'update runs every frame, making 200 more each time.',
      repairStrategy: 'Make them once, in ready(); only change textures in draw().',
    },
    {
      commonError: 'Forgetting scale 26/128.',
      symptom: 'Huge overlapping squares fill the screen.',
      whyItHappened: 'The art is 128 pixels and the cells 26.',
      repairStrategy: 'Set s.scale = { x: 26 / 128, y: 26 / 128 }.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Build a board as a 2D array and draw it with sprites.',
    explainVerbally: 'Explain why the game is the numbers and the pictures only show them.',
    detectIncorrectApplication: 'Spot shared rows and row/column mix-ups.',
    transferToUnfamiliar: 'Convert between cells, list entries and screen positions.',
  },

  assessment: {
    questions: [
      {
        id: 'mg7-001-assess-1',
        type: 'choice',
        text: 'Which cell is cells[19][0]?',
        options: ['Bottom-left', 'Top-left', 'Bottom-right', 'Top-right'],
        answer: 'Bottom-left',
        hint: 'Row 19 is the last row.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg7-001-quiz-1',
      type: 'choice',
      text: 'What does a 0 in cells mean?',
      options: ['An empty cell', 'The first piece', 'Black colour paint', 'A wall'],
      answer: 'An empty cell',
      hints: ['1 to 7 are colours.'],
      reviewSection: 'Intuition — the row paragraph',
    },
    {
      id: 'mg7-001-quiz-2',
      type: 'choice',
      text: 'How many sprites does the board make?',
      options: ['200', '10', '20', '7'],
      answer: '200',
      hints: ['One per cell.'],
      reviewSection: 'Intuition — the sprites paragraph',
    },
    {
      id: 'mg7-001-quiz-3',
      type: 'choice',
      text: 'Where is the centre of cell row 0, column 0, with the board at (350, 10)?',
      options: ['(363, 23)', '(350, 10)', '(376, 36)', '(13, 13)'],
      answer: '(363, 23)',
      hints: ["Add half a cell to the board's corner."],
      reviewSection: 'Under the hood — centres',
    },
    {
      id: 'mg7-001-quiz-4',
      type: 'choice',
      text: 'Where should the sprites be made?',
      options: ['In ready()', 'In update()', 'In draw()', 'In the editor by hand'],
      answer: 'In ready()',
      hints: ['Once.'],
      reviewSection: 'Debugging — sprites in update',
    },
    {
      id: 'mg7-001-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT how the board changes in this game?',
      options: [
        "Moving a sprite's position",
        'Changing a number in cells',
        'draw() setting a texture',
        'Making a new row array',
      ],
      answer: "Moving a sprite's position",
      hints: ['Sprites never move.'],
      reviewSection: 'Misconceptions — moving sprites',
    },
    {
      id: 'mg7-001-quiz-6',
      type: 'choice',
      text: 'As one row-major list of width 10, which entry is row 4, column 2?',
      options: ['42', '24', '6', '8'],
      answer: '42',
      hints: ['4 × 10 + 2.'],
      reviewSection: 'Under the hood — one list',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg7-001-1',
      label: 'Read the board as numbers',
      type: 'read',
    },
    {
      id: 'cp-mg7-001-2',
      label: 'Read how the sprites show it',
      type: 'read',
    },
    {
      id: 'cp-mg7-001-3',
      label: 'Read the board procedure',
      type: 'read',
    },
    {
      id: 'cp-mg7-001-4',
      label: 'Complete "Tetris 1: the board" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg7-001-5',
      label: 'Set a few cells to colours in ready() and see them',
      type: 'lab',
    },
    {
      id: 'cp-mg7-001-6',
      label: 'Work through the sprite-position example',
      type: 'example',
    },
    {
      id: 'cp-mg7-001-7',
      label: 'Work through the one-list example',
      type: 'example',
    },
    {
      id: 'cp-mg7-001-8',
      label: 'Attempt the shared-row challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-7',
}
