export default {
  order: 3,

  id: 'mg5-003',

  slug: 'maps-from-tiled',

  title: 'Maps from Tiled and Tile Mapper',

  subtitle: 'Bring in levels made in other editors, and edit them round trip.',

  tags: ['game-studio', 'tilemaps', 'tiled'],

  aliases: 'tiled tmx tmj import gid firstgid flip flags tile mapper send to game studio',

  timeToComplete: 20,

  coreConcept: "Levels are often made in a dedicated map editor. Game Studio imports Tiled's .tmx and .tmj files, turning their tilesets and layers into its own; Tile Mapper sends maps straight in and edits them again.",

  prerequisites: ['mg5-002'],

  nextLesson: 'mg6-001',

  hook: {
    question: "Kenney's Tiny Dungeon comes with a sample level made in Tiled, a free map editor used by thousands of games. Can you use it as it is, rather than repainting it?",
    realWorldContext: "Tiled's file format is read by Godot, Phaser, Unity plugins and many more. Being able to bring maps in (and send them out) means a level is not locked into one tool.",
  },

  intuition: {
    prose: [
      'The sample map has three layers and one tileset, the same 192 × 176 sheet. Import it from Starter art › Tiny Dungeon: Game Studio adds the sheet as an image, makes a tileset, and adds one TileMapLayer per layer.',
      "Tiled numbers tiles from 1, not 0, and 0 means an empty cell. So Tiled's tile 41 is Game Studio's tile 40, the brick wall. Each tileset starts at a **firstgid**; tile = gid − firstgid.",
      "Before reading on, predict: how can Tiled store a tile flipped left to right, in one number? It sets the number's highest bit. The top three bits mean flipped across, flipped down, and flipped diagonally.",
      'Game Studio keeps those flips, so a mirrored torch still faces the right way. Tiles given a solid (or collides) property in Tiled come in as solid tiles in the tileset.',
      "Tile Mapper, the app's own map editor, connects directly: TileMap panel › New map… opens it, and Send to Game Studio puts the map back in, repainting the same layers each time.",
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Bring in a map',
        body: 'Step 1. From Tiled: Import… in Files, choosing the .tmx or .tmj (and its tileset files and image together).\nStep 2. Or from the starter art: Starter art › the pack › Import beside its Tiled map.\nStep 3. Or from Tile Mapper: TileMap panel › New map… (or Edit in Tile Mapper), paint, then Send to Game Studio.\nStep 4. Check the layers in the scene tree, and the solid tiles in the TileMap panel.',
      },
      {
        type: 'warning',
        title: 'The image must come too',
        body: "A Tiled map names its tileset's image. Import the image with it (or first), or Game Studio says which image it is missing and imports nothing.",
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'A map from Tiled',
        props: {
          task: 'tiled-map',
          lesson: 'mg5-003',
          checkpoint: 'cp-mg5-003-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** Tiled stores each cell as a 32-bit global tile id. The low bits are the gid; bit 31 ($2^{31}$) is flipped across, bit 30 ($2^{30}$) flipped down, bit 29 ($2^{29}$) flipped diagonally.',
      'To read a cell, mask off the flags: $\\text{gid} = n \\,\\&\\, (2^{29} - 1)$, then $\\text{tile} = \\text{gid} - \\text{firstgid}$. For $n = 2^{31} + 41$ with firstgid 1: gid 41, tile 40, flipped across.',
      "A layer's data is row-major, like a tileset: cell $(x, y)$ is entry $y W + x$ for a map $W$ cells wide, the same numbering as in lesson 5.1.",
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, each cell value $n$ decodes to $(\\text{gid}, h, v, d)$ with $h = \\lfloor n / 2^{31} \\rfloor$, and so on; the gid selects the tileset with the largest firstgid not above it.',
      'The invariant through import is the picture: every cell shows the same tile, flipped the same way, at the same place. Game Studio keeps the flags, so a round trip through Tiled changes nothing.',
      'The diagonal flip swaps x and y; combined with the other two, the three flags give all eight ways to turn and mirror a square tile.',
      'Bit packing like this appeared in collision layers (lesson 2.5): small facts stored as bits of one number, read with AND.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg5-003-ex1',
      title: "From Tiled's number",
      difficulty: 'easy',
      problem: "A cell holds gid 41 and the tileset's firstgid is 1. Which Game Studio tile is it?",
      steps: [
        {
          expression: '41 - 1 = 40',
          annotation: 'Tiled counts from firstgid; Game Studio from 0.',
          strategyTitle: 'Step 1: Subtract firstgid',
        },
      ],
      answer: 'Tile 40, the brick wall.',
    },
    {
      id: 'mg5-003-ex2',
      title: 'A flipped tile',
      difficulty: 'medium',
      problem: 'A cell holds 2147483689 (that is 2³¹ + 41). What is it?',
      steps: [
        {
          expression: '2147483689 - 2^{31} = 41',
          annotation: 'The top bit is set: flipped across.',
          strategyTitle: 'Step 1: Remove the flag',
        },
        {
          expression: '41 - 1 = 40',
          annotation: 'Then subtract firstgid.',
          strategyTitle: 'Step 2: The tile',
        },
      ],
      answer: 'Tile 40, mirrored left to right.',
    },
    {
      id: 'mg5-003-ex3',
      title: 'Two tilesets',
      difficulty: 'hard',
      problem: 'A map has tilesets starting at firstgid 1 (132 tiles) and 133. A cell holds gid 140. Which tileset and tile?',
      steps: [
        {
          expression: '140 \\geq 133',
          annotation: 'The tileset with the largest firstgid not above the gid.',
          strategyTitle: 'Step 1: Pick the tileset',
        },
        {
          expression: '140 - 133 = 7',
          annotation: "Subtract that tileset's firstgid.",
          strategyTitle: 'Step 2: The tile',
        },
      ],
      answer: 'Tile 7 of the second tileset.',
    },
  ],

  challenges: [
    {
      id: 'mg5-003-ch1',
      title: 'Empty cell',
      difficulty: 'easy',
      problem: 'What does gid 0 mean in Tiled?',
      hint: 'Tiled counts tiles from 1.',
      answer: 'An empty cell, with no tile.',
      walkthrough: [
        {
          expression: '0',
          annotation: 'Tiles start at firstgid, at least 1.',
        },
      ],
    },
    {
      id: 'mg5-003-ch2',
      title: 'Which entry?',
      difficulty: 'medium',
      problem: "A map 30 cells wide. Which entry of a layer's data is cell (4, 2)?",
      hint: 'Row-major.',
      answer: 'Entry 64, because 2 × 30 + 4 = 64.',
      walkthrough: [],
    },
    {
      id: 'mg5-003-ch3',
      title: 'Debug the failed import',
      difficulty: 'hard',
      problem: 'Importing a .tmx alone says the tileset uses an image that is not in the project. What should the learner do?',
      hint: 'What does the map refer to?',
      answer: "Import the tileset's image too (with the map, or before it), then import the map again.",
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'Tiled',
        meaning: 'A free map editor whose .tmx and .tmj files many engines read.',
      },
      {
        symbol: 'gid',
        meaning: "Tiled's global tile number: tileset's firstgid plus the tile, 0 for empty.",
      },
      {
        symbol: 'firstgid',
        meaning: "The gid of a tileset's tile 0.",
      },
      {
        symbol: 'flip flags',
        meaning: 'The top three bits of a cell: flipped across, down, diagonally.',
      },
      {
        symbol: 'Send to Game Studio',
        meaning: "Tile Mapper's way to put a map into the open project.",
      },
    ],
    rulesOfThumb: [
      "Import the map's images with it.",
      "Subtract firstgid to get Game Studio's tile.",
      'Mask off the flags before reading a gid.',
      'Edit maps in Tile Mapper, or Tiled, and send them back rather than repainting.',
    ],
  },

  misconceptions: [
    {
      falseBelief: "Tiled's tile numbers are the same as Game Studio's.",
      whyStudentsThinkIt: 'Both number the same sheet.',
      correctionExample: "Tiled's 41 is Game Studio's 40 with firstgid 1.",
      contrastCase: 'Tiled reserves 0 for empty, so its numbering starts at 1.',
    },
    {
      falseBelief: 'A flipped tile needs a separate flipped picture in the sheet.',
      whyStudentsThinkIt: 'The picture looks different.',
      correctionExample: 'Gid 2³¹ + 41 is the same tile 40, drawn mirrored.',
      contrastCase: 'Three bits give all eight orientations of one picture.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A designer builds levels in Tiled while you program in Game Studio.',
      competingTechniques: ['Import their .tmx files', 'Rebuild each level by hand'],
      whyThisTechniqueWins: 'Import keeps the levels exactly, and can be repeated when they change.',
    },
    {
      situation: 'You want autotiled terrain in a level.',
      competingTechniques: [
        'Paint it in Tile Mapper and Send to Game Studio',
        'Pick each edge tile by hand',
      ],
      whyThisTechniqueWins: "Tile Mapper's autotiling picks the joining tiles for you.",
    },
  ],

  debugging: [
    {
      commonError: 'Choosing only the .tmx when it uses a separate .tsx tileset file.',
      symptom: 'An error naming the .tsx it needs.',
      whyItHappened: 'The map refers to the tileset file instead of including it.',
      repairStrategy: 'Select the .tmx and its .tsx files together in Import….',
    },
    {
      commonError: 'Editing the imported layers and then re-importing.',
      symptom: 'Your changes are gone, or the layers are doubled.',
      whyItHappened: "Import adds the map's layers again.",
      repairStrategy: "Edit in one place; for round trips use Tile Mapper's Send, which repaints the same layers.",
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Import a Tiled map, or send one from Tile Mapper.',
    explainVerbally: 'Explain gids, firstgid and flip flags.',
    detectIncorrectApplication: 'Diagnose a failed import.',
    transferToUnfamiliar: 'Decode any cell value, with several tilesets.',
  },

  assessment: {
    questions: [
      {
        id: 'mg5-003-assess-1',
        type: 'choice',
        text: 'Gid 41, firstgid 1. Which Game Studio tile?',
        options: ['40', '41', '42', '0'],
        answer: '40',
        hint: 'Subtract firstgid.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg5-003-quiz-1',
      type: 'choice',
      text: 'What does gid 0 mean?',
      options: ['An empty cell', 'Tile 0', 'A flipped tile', 'The first tileset'],
      answer: 'An empty cell',
      hints: ['Tiled counts from 1.'],
      reviewSection: 'Intuition — the firstgid paragraph',
    },
    {
      id: 'mg5-003-quiz-2',
      type: 'choice',
      text: 'Which bit means flipped across?',
      options: ['2³¹', '2²⁹', '2⁰', '2¹⁶'],
      answer: '2³¹',
      hints: ['The highest of the three.'],
      reviewSection: 'Under the hood — the flags',
    },
    {
      id: 'mg5-003-quiz-3',
      type: 'choice',
      text: 'Firstgids 1 and 133; gid 140. Which tile?',
      options: [
        'Tile 7 of the second tileset',
        'Tile 139 of the first',
        'Tile 140',
        'Tile 7 of the first',
      ],
      answer: 'Tile 7 of the second tileset',
      hints: ['Largest firstgid not above the gid.'],
      reviewSection: 'Examples — Two tilesets',
    },
    {
      id: 'mg5-003-quiz-4',
      type: 'choice',
      text: 'What must come with a Tiled map when you import it?',
      options: [
        'Its tileset images (and .tsx files)',
        'A script',
        'A camera',
        'Nothing',
      ],
      answer: 'Its tileset images (and .tsx files)',
      hints: ['The map only names them.'],
      reviewSection: 'Intuition — Warning: the image must come too',
    },
    {
      id: 'mg5-003-quiz-5',
      type: 'choice',
      text: 'Which of these does NOT bring a map into Game Studio?',
      options: [
        'Copying a screenshot of it',
        'Import… with the .tmx',
        'Starter art › Import',
        'Tile Mapper › Send to Game Studio',
      ],
      answer: 'Copying a screenshot of it',
      hints: ['A picture has no cells.'],
      reviewSection: 'Intuition — Procedure',
    },
    {
      id: 'mg5-003-quiz-6',
      type: 'choice',
      text: 'A map 20 wide. Which data entry is cell (3, 5)?',
      options: ['103', '53', '23', '100'],
      answer: '103',
      hints: ['5 × 20 + 3.'],
      reviewSection: 'Under the hood — row-major',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg5-003-1',
      label: 'Read what an import makes',
      type: 'read',
    },
    {
      id: 'cp-mg5-003-2',
      label: 'Read gids and flip flags',
      type: 'read',
    },
    {
      id: 'cp-mg5-003-3',
      label: 'Read the ways to bring in a map',
      type: 'read',
    },
    {
      id: 'cp-mg5-003-4',
      label: 'Complete "A map from Tiled" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg5-003-5',
      label: 'Make a map in Tile Mapper and send it to Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg5-003-6',
      label: 'Work through the flipped-tile example',
      type: 'example',
    },
    {
      id: 'cp-mg5-003-7',
      label: 'Work through the two-tilesets example',
      type: 'example',
    },
    {
      id: 'cp-mg5-003-8',
      label: 'Attempt the failed-import challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-5',
}
