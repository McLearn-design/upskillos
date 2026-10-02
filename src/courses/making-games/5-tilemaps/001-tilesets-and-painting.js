export default {
  order: 1,

  id: 'mg5-001',

  slug: 'tilesets-and-painting',

  title: 'Tilesets and Painting',

  subtitle: 'Cut a sheet of art into numbered tiles, and paint a floor with them.',

  tags: ['game-studio', 'tilemaps'],

  aliases: 'tileset tilemaplayer tile sheet tile id margin spacing paint grid cells',

  timeToComplete: 25,

  coreConcept: 'A tileset cuts one image into a grid of equal tiles, numbered left to right, top to bottom, from 0. A TileMapLayer is a grid of cells, each showing one tile number, so a whole level is a list of small numbers.',

  prerequisites: ['mg4-003'],

  nextLesson: 'mg5-002',

  hook: {
    question: 'A dungeon level is 20 by 12 squares, each 16 pixels. Drawing it as one big picture means 320 × 192 pixels to paint by hand. How do games build levels from a few dozen small pictures instead?',
    realWorldContext: 'From Super Mario Bros. to Stardew Valley, 2D levels are tilemaps: a small sheet of art reused across a grid. It saves memory, makes levels quick to change, and lets the game ask "what is at this cell?".',
  },

  intuition: {
    prose: [
      "Kenney's Tiny Dungeon sheet is 192 × 176 pixels, cut into 16 × 16 tiles: 192 ÷ 16 = 12 across and 176 ÷ 16 = 11 down, 132 tiles. They are numbered along each row: 0 to 11 on the first row, 12 to 23 on the second, and so on.",
      'Before reading on, predict: where is tile 40 in the sheet? 40 ÷ 12 = 3 remainder 4: row 3, column 4, counting from 0. That is the grey brick wall.',
      'A **tileset** records the image and the tile size (and any margin round the edge or spacing between tiles). It is a project file, shared by every layer that uses it.',
      'A **TileMapLayer** is a grid of cells. Each cell holds a tile number, or nothing. With the layer at (0, 0), cell (5, 3) is drawn at (80, 48): 5 × 16 across and 3 × 16 down.',
      'In the TileMap panel you pick a tile in the palette and paint cells in the viewport: dragging paints one at a time, Rectangle fills a block.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Paint a floor',
        body: 'Step 1. Add a TileMapLayer (Floor); selecting it opens the TileMap panel.\nStep 2. + New tileset…: choose the sheet and its tile size (16 × 16 for Tiny Dungeon), and Create.\nStep 3. Pick a floor tile in the palette.\nStep 4. Paint in the viewport, or choose Rectangle and drag a block.\nStep 5. Run to see it in the game.',
      },
      {
        type: 'warning',
        title: 'The wrong tile size scrambles everything',
        body: "Cutting an 18-pixel sheet into 16-pixel tiles makes every tile a slice of two pictures. Use the size the art was drawn at; Kenney's packs say it in their names and in the starter art notes.",
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'A tileset and a floor',
        props: {
          task: 'paint-a-floor',
          lesson: 'mg5-001',
          checkpoint: 'cp-mg5-001-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** With an image $W$ pixels wide, tiles $t$ wide, a margin $m$ round the edge and spacing $s$ between tiles, the number of columns is $C = \\left\\lfloor \\tfrac{W - 2m + s}{t + s} \\right\\rfloor$. For Tiny Dungeon: $\\lfloor 192 / 16 \\rfloor = 12$.',
      'Tile $i$ is at column $i \\bmod C$ and row $\\lfloor i / C \\rfloor$, and its top-left pixel in the image is $(m + (i \\bmod C)(t + s),\\ m + \\lfloor i / C \\rfloor (t + s))$. Tile 40: column 4, row 3, pixel (64, 48).',
      'Going the other way, a world point $(x, y)$ is in cell $(\\lfloor x / t \\rfloor, \\lfloor y / t \\rfloor)$ of a layer at the origin: (85, 50) is cell (5, 3). That is how a game asks what is under the player.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, numbering tiles row by row is the map $(c, r) \\mapsto rC + c$, with inverse $i \\mapsto (i \\bmod C, \\lfloor i / C \\rfloor)$. The same row-major order stores any 2D grid in a list.',
      "The invariant is the tile's identity: tile 40 is the brick wall in every layer that uses this tileset, which is why changing a tileset's image restyles every map at once.",
      "Geometrically, a layer is a lattice of squares; a cell's world rectangle is $[ct, (c+1)t) \\times [rt, (r+1)t)$.",
      'Storing only the painted cells, as Game Studio does, is a sparse representation: an empty 1000 × 1000 map costs nothing. Dense arrays (Tetris, chapter 7) suit small grids where every cell matters.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg5-001-ex1',
      title: 'How many tiles',
      difficulty: 'easy',
      problem: 'A sheet 192 × 176 pixels with 16 × 16 tiles. How many tiles?',
      steps: [
        {
          expression: '\\tfrac{192}{16} \\times \\tfrac{176}{16} = 12 \\times 11 = 132',
          annotation: 'Columns times rows.',
          strategyTitle: 'Step 1: Columns times rows',
        },
      ],
      answer: '132 tiles, 12 across and 11 down.',
    },
    {
      id: 'mg5-001-ex2',
      title: 'Where is tile 40?',
      difficulty: 'medium',
      problem: 'In that sheet, where is tile 40, in the grid and in pixels?',
      steps: [
        {
          expression: '40 \\bmod 12 = 4,\\ \\lfloor 40 / 12 \\rfloor = 3',
          annotation: 'Column is the remainder, row is the whole part.',
          strategyTitle: 'Step 1: Column and row',
        },
        {
          expression: '(4 \\times 16, 3 \\times 16) = (64, 48)',
          annotation: 'No margin or spacing in this sheet.',
          strategyTitle: 'Step 2: Pixels',
        },
      ],
      answer: 'Column 4, row 3, starting at pixel (64, 48).',
    },
    {
      id: 'mg5-001-ex3',
      title: 'A sheet with spacing',
      difficulty: 'hard',
      problem: 'A sheet 379 pixels wide has 18-pixel tiles with 1 pixel between them and no margin. How many columns?',
      steps: [
        {
          expression: 'C = \\left\\lfloor \\tfrac{379 + 1}{18 + 1} \\right\\rfloor = \\left\\lfloor 20 \\right\\rfloor = 20',
          annotation: 'Adding one spacing to the width makes every tile plus its gap fit evenly.',
          strategyTitle: 'Step 1: Columns',
        },
      ],
      answer: "20 columns (Pixel Platformer's unpacked sheet).",
    },
  ],

  challenges: [
    {
      id: 'mg5-001-ch1',
      title: 'Tile number from place',
      difficulty: 'easy',
      problem: 'In a 12-column sheet, which number is the tile at column 7, row 2?',
      hint: 'Row × columns + column.',
      answer: 'Tile 31, because 2 × 12 + 7 = 31.',
      walkthrough: [
        {
          expression: '2 \\times 12 + 7 = 31',
          annotation: 'Row-major numbering.',
        },
      ],
    },
    {
      id: 'mg5-001-ch2',
      title: 'Which cell?',
      difficulty: 'medium',
      problem: '16-pixel tiles, layer at the origin. Which cell holds the point (200, 37)?',
      hint: 'Divide and round down.',
      answer: 'Cell (12, 2), because ⌊200/16⌋ = 12 and ⌊37/16⌋ = 2.',
      walkthrough: [],
    },
    {
      id: 'mg5-001-ch3',
      title: 'Debug the sliced tiles',
      difficulty: 'hard',
      problem: "A learner's tiles each show the edges of two pictures. The sheet is Pixel Platformer's packed sheet, 360 × 162. They chose 16 × 16. What is wrong?",
      hint: 'What size divides 360 and 162 evenly?',
      answer: 'The tiles are 18 × 18 (360 ÷ 18 = 20 and 162 ÷ 18 = 9); make a new tileset at 18.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'tileset',
        meaning: 'An image cut into a grid of equal, numbered tiles.',
      },
      {
        symbol: 'TileMapLayer',
        meaning: 'A grid of cells, each showing one tile number.',
      },
      {
        symbol: 'tile i → (i mod C, ⌊i/C⌋)',
        meaning: 'The column and row of tile i in a sheet C tiles wide.',
      },
      {
        symbol: 'cell (c, r) → (c·t, r·t)',
        meaning: 'Where a cell is drawn, for tiles t pixels wide.',
      },
      {
        symbol: 'margin and spacing',
        meaning: "Pixels round the sheet's edge and between its tiles.",
      },
    ],
    rulesOfThumb: [
      'Use the tile size the art was drawn at.',
      'Count columns first; everything else follows from it.',
      'Use Rectangle for big areas and the brush for details.',
      'Keep floors and walls on separate layers.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Tiles are numbered down each column.',
      whyStudentsThinkIt: 'Either order seems possible.',
      correctionExample: 'In a 12-wide sheet, tile 12 is the first tile of the second row, not the second tile of the first column.',
      contrastCase: 'Numbering is left to right, then top to bottom, from 0.',
    },
    {
      falseBelief: 'Each cell stores its own copy of the picture.',
      whyStudentsThinkIt: 'Every cell shows a picture.',
      correctionExample: 'A floor of 200 cells stores 200 small numbers and one shared image.',
      contrastCase: "Change the tileset's image and every one of those cells changes.",
    },
  ],

  transferPrompts: [
    {
      situation: 'A game needs to know what the player is standing on.',
      competingTechniques: [
        "Convert the player's feet to a cell and read its tile",
        'Give every floor tile its own Area2D',
      ],
      whyThisTechniqueWins: 'One division finds the cell; hundreds of areas would be slow and fiddly.',
    },
    {
      situation: 'A level must be reskinned for a snow world.',
      competingTechniques: [
        "Swap the tileset's image for a snow sheet with the same layout",
        'Repaint the level with new tiles',
      ],
      whyThisTechniqueWins: 'The cells keep their numbers, so the same level appears in snow at once.',
    },
  ],

  debugging: [
    {
      commonError: 'Painting on the wrong layer.',
      symptom: 'Walls appear behind the floor, or the floor shows over the player.',
      whyItHappened: 'The TileMap panel paints the selected layer.',
      repairStrategy: 'Select the layer in the scene tree before painting.',
    },
    {
      commonError: 'A layer with no tileset.',
      symptom: 'The palette is empty and nothing paints.',
      whyItHappened: 'A layer needs a tileset to draw from.',
      repairStrategy: 'Choose a tileset in the TileMap panel, or make one with + New tileset….',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Make a tileset and paint a floor.',
    explainVerbally: 'Explain tile numbering and how cells map to the world.',
    detectIncorrectApplication: 'Spot a wrong tile size from scrambled tiles.',
    transferToUnfamiliar: 'Find the cell under any point, and the tile under any number.',
  },

  assessment: {
    questions: [
      {
        id: 'mg5-001-assess-1',
        type: 'choice',
        text: 'In a 12-column sheet, where is tile 40?',
        options: [
          'Column 4, row 3',
          'Column 3, row 4',
          'Column 40, row 0',
          'Column 0, row 40',
        ],
        answer: 'Column 4, row 3',
        hint: '40 = 3 × 12 + 4.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg5-001-quiz-1',
      type: 'choice',
      text: 'How many 16-pixel tiles across a 192-pixel sheet?',
      options: ['12', '16', '11', '192'],
      answer: '12',
      hints: ['192 ÷ 16.'],
      reviewSection: 'Intuition — the sheet paragraph',
    },
    {
      id: 'mg5-001-quiz-2',
      type: 'choice',
      text: 'Where is cell (5, 3) drawn with 16-pixel tiles?',
      options: ['(80, 48)', '(5, 3)', '(48, 80)', '(16, 16)'],
      answer: '(80, 48)',
      hints: ['Times 16 each way; (48, 80) swaps them.'],
      reviewSection: 'Intuition — the cell paragraph',
    },
    {
      id: 'mg5-001-quiz-3',
      type: 'choice',
      text: "What does a TileMapLayer's cell store?",
      options: ['A tile number', 'A copy of the picture', 'A node', 'A colour'],
      answer: 'A tile number',
      hints: ['Small numbers, one shared image.'],
      reviewSection: 'Misconceptions — copies',
    },
    {
      id: 'mg5-001-quiz-4',
      type: 'choice',
      text: 'Which cell holds point (85, 50) with 16-pixel tiles?',
      options: ['(5, 3)', '(85, 50)', '(6, 4)', '(5, 4)'],
      answer: '(5, 3)',
      hints: ['Round down.'],
      reviewSection: 'Under the hood — world to cell',
    },
    {
      id: 'mg5-001-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT part of a tileset?',
      options: ["The player's speed", 'The image', 'The tile size', 'The spacing'],
      answer: "The player's speed",
      hints: ['A tileset describes the sheet.'],
      reviewSection: 'Intuition — the tileset paragraph',
    },
    {
      id: 'mg5-001-quiz-6',
      type: 'choice',
      text: 'A 360 × 162 sheet. Which tile size fits evenly?',
      options: ['18', '16', '20', '32'],
      answer: '18',
      hints: ['360 ÷ 18 = 20 and 162 ÷ 18 = 9.'],
      reviewSection: 'Challenges — the sliced tiles',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg5-001-1',
      label: 'Read how a sheet is numbered',
      type: 'read',
    },
    {
      id: 'cp-mg5-001-2',
      label: "Read what a layer's cells hold",
      type: 'read',
    },
    {
      id: 'cp-mg5-001-3',
      label: 'Read the painting procedure',
      type: 'read',
    },
    {
      id: 'cp-mg5-001-4',
      label: 'Complete "A tileset and a floor" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg5-001-5',
      label: 'Paint a second room with Rectangle in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg5-001-6',
      label: 'Work through the tile-40 example',
      type: 'example',
    },
    {
      id: 'cp-mg5-001-7',
      label: 'Work through the spacing example',
      type: 'example',
    },
    {
      id: 'cp-mg5-001-8',
      label: 'Attempt the sliced-tiles challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-5',
}
