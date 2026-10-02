export default {
  order: 2,

  id: 'mg5-002',

  slug: 'solid-walls',

  title: 'Solid Walls',

  subtitle: 'Walls on their own layer, made solid by marking their tile.',

  tags: ['game-studio', 'tilemaps', 'collision'],

  aliases: 'solid tiles tile collision walls layer merged rectangles seams',

  timeToComplete: 25,

  coreConcept: 'A tileset marks some tiles as solid. Every layer that uses those tiles then blocks bodies there. The engine merges neighbouring solid cells into a few rectangles, so bodies slide smoothly along a wall of many tiles.',

  prerequisites: ['mg5-001'],

  nextLesson: 'mg5-003',

  hook: {
    question: 'You painted a wall of 60 brick tiles round a room. The player walks straight through them. Do you need 60 collision shapes?',
    realWorldContext: 'Tile collision is how almost every 2D level stops its characters. Marking tiles solid once, in the tileset, means every level painted with them is solid too.',
  },

  intuition: {
    prose: [
      "The room's wall is a border 20 cells wide and 12 tall: 20 on the top row, 20 on the bottom, and 10 on each side between them. That is 60 brick cells.",
      'Mark the brick tile, tile 40, as solid: TileMap panel › ■ Solid tiles, then click it in the palette. Every layer using this tileset now blocks bodies wherever tile 40 is.',
      'Before reading on, predict: how many collision rectangles does the engine make for the 60 cells? Four. The top row is one 20-cell rectangle, the bottom another, and each side is one tall 1-by-10 rectangle.',
      'Why merge? With 60 separate squares, a body sliding along the top wall would cross 19 joins between squares, and at each one it can catch on a corner. One long rectangle has no joins.',
      "Keep walls on their own layer: a Walls layer over the Floor. The floor's tiles stay walkable, and the walls can be repainted without touching the floor.",
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Make walls that stop the player',
        body: 'Step 1. Add a second TileMapLayer (Walls) using the same tileset.\nStep 2. Paint the wall tiles where the walls go.\nStep 3. In the TileMap panel, press ■ Solid tiles and click the wall tile in the palette.\nStep 4. Run, and walk into a wall: the player stops at it.',
      },
      {
        type: 'warning',
        title: 'Solid belongs to the tile, not the layer',
        body: 'Marking tile 40 solid makes it solid in every layer that uses the tileset, the floor included. Do not paint the wall tile into the floor layer, or the floor gets walls you cannot see the reason for.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Walls that stop the player',
        props: {
          task: 'solid-walls',
          lesson: 'mg5-002',
          checkpoint: 'cp-mg5-002-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** The engine merges in two passes. First, along each row, it joins consecutive solid cells into runs: the top row of 20 becomes one run $(x = 0, w = 20)$; a side row becomes two runs, $(0, 1)$ and $(19, 1)$.',
      'Second, a run directly below an identical run (same $x$ and $w$) extends it downwards. The ten side runs at $x = 0$ stack into one rectangle $1 \\times 10$; likewise at $x = 19$. Total: 4 rectangles for 60 cells.',
      'Each rectangle is then an ordinary shape for collisions (lesson 2.1): a body overlapping it is pushed out by the minimum translation vector. In world pixels a cell rectangle is $(x t, y t, w t, h t)$ for tiles $t$ wide.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, the merge covers exactly the solid cells with disjoint rectangles. This greedy pass does not always find the fewest possible (that is a harder problem), but it removes every join along rows and down columns of equal runs.',
      'The invariant is the solid region itself: merging changes how it is described, not which points are solid.',
      "Geometrically, the wall's outline becomes a few straight edges; the corners that caught bodies were artefacts of describing one surface as many squares.",
      'Engines go further, joining edges into chains or polygons, which also handles slopes. The idea is the same: describe the solid area by its boundary, not its cells.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg5-002-ex1',
      title: 'Counting the wall',
      difficulty: 'easy',
      problem: 'How many cells are in the border of a 20 × 12 room?',
      steps: [
        {
          expression: '2 \\times 20 + 2 \\times (12 - 2) = 40 + 20 = 60',
          annotation: 'Top and bottom rows, plus the sides between them.',
          strategyTitle: 'Step 1: Rows and sides',
        },
      ],
      answer: '60 cells.',
    },
    {
      id: 'mg5-002-ex2',
      title: 'Merging the border',
      difficulty: 'medium',
      problem: 'Into how many rectangles does the engine merge that border?',
      steps: [
        {
          expression: '\\text{rows } 0, 11: \\text{one run of } 20 \\text{ each}',
          annotation: 'The top and bottom rows are each one run.',
          strategyTitle: 'Step 1: Full rows',
        },
        {
          expression: '\\text{rows } 1\\text{–}10: \\text{runs at } x = 0 \\text{ and } x = 19, \\text{ stacked}',
          annotation: 'Identical runs below each other stack into two tall rectangles.',
          strategyTitle: 'Step 2: The sides',
        },
      ],
      answer: '4 rectangles.',
    },
    {
      id: 'mg5-002-ex3',
      title: 'A gap in the wall',
      difficulty: 'hard',
      problem: 'A doorway removes cells (9, 11) and (10, 11) from the bottom row. How many rectangles now?',
      steps: [
        {
          expression: '\\text{row } 11: (0, 9) \\text{ and } (11, 9)',
          annotation: 'The bottom row splits into two runs of 9.',
          strategyTitle: 'Step 1: Split the row',
        },
        {
          expression: '1 + 2 + 2 = 5',
          annotation: 'The top row, the two sides, and the two halves of the bottom.',
          strategyTitle: 'Step 2: Count',
        },
      ],
      answer: '5 rectangles.',
    },
  ],

  challenges: [
    {
      id: 'mg5-002-ch1',
      title: 'A solid floor',
      difficulty: 'easy',
      problem: 'A floor row of 30 solid cells. How many rectangles?',
      hint: 'One run.',
      answer: 'One rectangle, 30 cells wide.',
      walkthrough: [
        {
          expression: '1',
          annotation: 'Consecutive solid cells in a row are one run.',
        },
      ],
    },
    {
      id: 'mg5-002-ch2',
      title: 'A thick wall',
      difficulty: 'medium',
      problem: 'A wall 3 cells wide and 8 tall, all solid. How many rectangles?',
      hint: 'Each row is one run of 3, and they are identical.',
      answer: 'One rectangle, 3 × 8.',
      walkthrough: [],
    },
    {
      id: 'mg5-002-ch3',
      title: 'Debug the invisible wall',
      difficulty: 'hard',
      problem: 'After marking tile 40 solid, the player is stopped in the middle of the floor. The floor layer looks normal. What should the learner check?',
      hint: 'Solid is per tile, in every layer.',
      answer: 'That no tile 40 was painted into the floor layer; a single brick cell there is solid even if another tile covers it from a layer above.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'solid tile',
        meaning: 'A tile marked in its tileset to block bodies, in every layer.',
      },
      {
        symbol: 'run',
        meaning: 'Consecutive solid cells along one row.',
      },
      {
        symbol: 'merged rectangle',
        meaning: 'Runs stacked down rows into one collision shape.',
      },
      {
        symbol: 'seam',
        meaning: 'The join between two shapes, where a sliding body can catch.',
      },
    ],
    rulesOfThumb: [
      'Put walls on their own layer.',
      'Mark solid tiles once, in the tileset.',
      'Do not paint wall tiles into walkable layers.',
      'Test every wall by walking into it.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Each solid tile gets its own collision square.',
      whyStudentsThinkIt: 'Each tile is painted separately.',
      correctionExample: 'The 60-cell border becomes 4 rectangles.',
      contrastCase: 'Separate squares would leave 56 joins for bodies to catch on.',
    },
    {
      falseBelief: 'Making a layer solid is a layer setting.',
      whyStudentsThinkIt: 'Walls are on their own layer.',
      correctionExample: 'Marking tile 40 makes it solid on the floor layer too, if painted there.',
      contrastCase: 'Solidity belongs to the tile in the tileset.',
    },
  ],

  transferPrompts: [
    {
      situation: 'Water tiles should stop the player but not arrows.',
      competingTechniques: [
        "Put water on its own layer with a collision layer the arrows' mask leaves out",
        'Make water non-solid',
      ],
      whyThisTechniqueWins: 'The tile layer has collision layers like a body, so masks decide who it stops.',
    },
    {
      situation: 'A long floor of many tiles makes the player stutter.',
      competingTechniques: [
        'Tile collision with merged rectangles',
        'A StaticBody2D shape per tile',
      ],
      whyThisTechniqueWins: 'Merged rectangles remove the seams that cause the stutter.',
    },
  ],

  debugging: [
    {
      commonError: 'Clicking the tile in the palette without ■ Solid tiles on.',
      symptom: 'The brush changes, but nothing becomes solid.',
      whyItHappened: 'Without Solid tiles, clicking picks a tile to paint.',
      repairStrategy: 'Press ■ Solid tiles first; the count of solid tiles shows beside it.',
    },
    {
      commonError: 'The player has no collision shape.',
      symptom: 'The player walks through solid tiles.',
      whyItHappened: 'Tiles stop bodies by their shapes; a body with no shape is never stopped.',
      repairStrategy: 'Give the player a CollisionShape2D (lesson 2.1).',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Paint walls on a layer and make them solid.',
    explainVerbally: 'Explain how solid cells become rectangles and why it matters.',
    detectIncorrectApplication: 'Spot solid tiles in a walkable layer.',
    transferToUnfamiliar: 'Count the rectangles for a given wall shape.',
  },

  assessment: {
    questions: [
      {
        id: 'mg5-002-assess-1',
        type: 'choice',
        text: 'Into how many rectangles is a 20 × 12 border merged?',
        options: ['4', '60', '2', '20'],
        answer: '4',
        hint: 'Two full rows and two stacked sides.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg5-002-quiz-1',
      type: 'choice',
      text: 'Where is a tile marked solid?',
      options: [
        'In its tileset',
        'On each layer',
        'On each cell',
        "In the player's script",
      ],
      answer: 'In its tileset',
      hints: ['Solid belongs to the tile.'],
      reviewSection: 'Intuition — Warning: solid belongs to the tile',
    },
    {
      id: 'mg5-002-quiz-2',
      type: 'choice',
      text: 'Why does the engine merge solid cells?',
      options: [
        'So sliding bodies do not catch on seams',
        'To save colours',
        'To draw faster',
        'To make walls thicker',
      ],
      answer: 'So sliding bodies do not catch on seams',
      hints: ['One long edge has no joins.'],
      reviewSection: 'Intuition — the why-merge paragraph',
    },
    {
      id: 'mg5-002-quiz-3',
      type: 'choice',
      text: 'A doorway splits the bottom row of a 20 × 12 border. How many rectangles?',
      options: ['5', '4', '6', '60'],
      answer: '5',
      hints: ['The bottom row becomes two runs.'],
      reviewSection: 'Examples — A gap in the wall',
    },
    {
      id: 'mg5-002-quiz-4',
      type: 'choice',
      text: 'A side of 10 single cells, one above another. How many rectangles?',
      options: ['1', '10', '2', '5'],
      answer: '1',
      hints: ['Identical runs stack.'],
      reviewSection: 'Under the hood — stacking',
    },
    {
      id: 'mg5-002-quiz-5',
      type: 'choice',
      text: 'Which of these does NOT make a wall stop the player?',
      options: [
        'Painting it on its own layer only',
        'Marking its tile solid',
        'The player having a shape',
        'Using moveAndSlide',
      ],
      answer: 'Painting it on its own layer only',
      hints: ['A layer alone is not solid.'],
      reviewSection: 'Misconceptions — layer setting',
    },
    {
      id: 'mg5-002-quiz-6',
      type: 'choice',
      text: 'How many cells in the border of a 10 × 6 room?',
      options: ['28', '60', '32', '24'],
      answer: '28',
      hints: ['2 × 10 + 2 × 4.'],
      reviewSection: 'Examples — Counting the wall',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg5-002-1',
      label: 'Read how solid tiles work',
      type: 'read',
    },
    {
      id: 'cp-mg5-002-2',
      label: 'Read why solid cells are merged',
      type: 'read',
    },
    {
      id: 'cp-mg5-002-3',
      label: 'Read the walls procedure',
      type: 'read',
    },
    {
      id: 'cp-mg5-002-4',
      label: 'Complete "Walls that stop the player" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg5-002-5',
      label: 'Add a doorway to the wall in Game Studio and walk through it',
      type: 'lab',
    },
    {
      id: 'cp-mg5-002-6',
      label: 'Work through the merging example',
      type: 'example',
    },
    {
      id: 'cp-mg5-002-7',
      label: 'Work through the doorway example',
      type: 'example',
    },
    {
      id: 'cp-mg5-002-8',
      label: 'Attempt the invisible-wall challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-5',
}
