export default {
  order: 3,

  id: 'mg3-003',

  slug: 'a-hud-on-a-canvaslayer',

  title: 'A HUD on a CanvasLayer',

  subtitle: 'A score that stays in the corner while the level scrolls.',

  tags: ['game-studio', 'hud', 'ui'],

  aliases: 'hud canvaslayer label score screen coordinates world coordinates ui overlay',

  timeToComplete: 20,

  coreConcept: 'Nodes in the world are drawn where the camera puts them; nodes under a CanvasLayer are drawn at fixed places on the screen. A HUD (score, health, messages) goes under a CanvasLayer so it never scrolls.',

  prerequisites: ['mg3-002'],

  nextLesson: 'mg4-001',

  hook: {
    question: 'You put a "Score: 0" label at (16, 12). When Player walks right and the camera follows, the score slides off the screen. Why, and how do you pin it to the corner?',
    realWorldContext: 'Scores, health bars, ammo counts and pause menus are drawn over the game, fixed to the screen. Every engine separates the world from the screen this way.',
  },

  intuition: {
    prose: [
      "A Label at world position (16, 12). With the camera centred at x = 1500, the screen's left edge is world x 1020, so the label is 1004 pixels off the left of the screen. It scrolled away with the level.",
      "Before reading on, predict: how do you keep it at the corner without moving it every frame? Put it under a **CanvasLayer**. A CanvasLayer's children are placed in screen coordinates: (16, 12) means 16 pixels from the screen's left and 12 from its top, wherever the camera is.",
      "So a game has two coordinate systems. **World coordinates** are where things are in the level; the camera decides which part shows. **Screen coordinates** are where things are on the screen; (0, 0) is always the screen's top-left corner.",
      "A script updates the label's text: `scene.get('HUD/Score').text = 'Score: ' + score`. The path goes through the CanvasLayer's name, because the label is its child.",
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Make a HUD',
        body: "Step 1. Add a CanvasLayer to the scene's root, and name it HUD.\nStep 2. Add a Label under HUD for each thing to show (Score, Health), at screen positions.\nStep 3. From a script, set its text: scene.get('HUD/Score').text = ...\nStep 4. Run and walk: the HUD stays put while the world scrolls.",
      },
      {
        type: 'warning',
        title: 'A HUD in the world',
        body: 'A Label that is not under a CanvasLayer is part of the world. It looks right until the camera moves, then scrolls away. If a HUD scrolls, check its parent in the scene tree.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'A HUD that stays put',
        props: {
          task: 'hud',
          lesson: 'mg3-003',
          checkpoint: 'cp-mg3-003-4',
        },
      },
    ],
  },

  math: {
    prose: [
      "**Under the hood (optional).** With the camera's view centred at $(c_x, c_y)$, zoom $z$ and a screen $W$ by $H$, a world point $(x, y)$ appears on the screen at $\\big((x - c_x) z + \\tfrac{W}{2},\\ (y - c_y) z + \\tfrac{H}{2}\\big)$.",
      'For the label at world $(16, 12)$ with the view at $(1500, 270)$, $z = 1$ on a $960 \\times 540$ screen: $(16 - 1500 + 480,\\ 12 - 270 + 270) = (-1004, 12)$. Off the left of the screen.',
      "A CanvasLayer's children skip that conversion: their positions are already screen coordinates. Converting back, a screen point $(s_x, s_y)$ is world $\\big((s_x - W/2)/z + c_x,\\ (s_y - H/2)/z + c_y\\big)$, which is how a mouse click finds what it hit.",
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, the world-to-screen map is an affine transformation: a scale by $z$ and a translation. A CanvasLayer replaces it with the identity for its subtree.',
      'The invariant of a HUD is its screen position under every camera movement; the invariant of a world node is its world position.',
      "Geometrically, the screen is a window sliding over the world; the HUD is painted on the window's glass.",
      "CanvasLayers have a layer number: higher layers are drawn over lower ones, so a pause menu can sit over the HUD. Parallax backgrounds are the in-between case: layers that scroll at a fraction of the camera's speed.",
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg3-003-ex1',
      title: 'Where a world label appears',
      difficulty: 'easy',
      problem: 'The view is centred at x = 480 (no scrolling yet). A world label is at x = 16. Where is it on the screen?',
      steps: [
        {
          expression: '16 - 480 + 480 = 16',
          annotation: 'With the view at the start, world and screen agree.',
          strategyTitle: 'Step 1: Convert',
        },
      ],
      answer: 'At screen x = 16, which is why it looked right before walking.',
    },
    {
      id: 'mg3-003-ex2',
      title: 'After walking',
      difficulty: 'medium',
      problem: 'The view is now centred at x = 1500. Where is the world label at x = 16 on the screen?',
      steps: [
        {
          expression: '16 - 1500 + 480 = -1004',
          annotation: 'Negative means left of the screen.',
          strategyTitle: 'Step 1: Convert',
        },
      ],
      answer: 'At screen x = −1004, off the left edge: it has scrolled away.',
    },
    {
      id: 'mg3-003-ex3',
      title: 'Where did the player click?',
      difficulty: 'hard',
      problem: 'The view is at (1500, 270), zoom 1, screen 960 × 540. A click at screen (100, 300). Which world point is it?',
      steps: [
        {
          expression: 'x = 100 - 480 + 1500 = 1120',
          annotation: 'Screen to world adds the camera back.',
          strategyTitle: 'Step 1: Across',
        },
        {
          expression: 'y = 300 - 270 + 270 = 300',
          annotation: 'The camera is at the default height.',
          strategyTitle: 'Step 2: Down',
        },
      ],
      answer: 'The click is at world (1120, 300).',
    },
  ],

  challenges: [
    {
      id: 'mg3-003-ch1',
      title: 'Corner positions',
      difficulty: 'easy',
      problem: 'On a 960 × 540 screen, what screen position puts a 100-wide label 16 pixels from the right edge?',
      hint: "The label's position is its left edge for text.",
      answer: 'x = 844, because 960 − 16 − 100 = 844.',
      walkthrough: [
        {
          expression: '960 - 16 - 100 = 844',
          annotation: 'Measured from the right.',
        },
      ],
    },
    {
      id: 'mg3-003-ch2',
      title: 'Zoomed world',
      difficulty: 'medium',
      problem: 'View at (1000, 270), zoom 2, screen 960 × 540. Where does world (1100, 270) appear?',
      hint: 'Multiply the offset by the zoom.',
      answer: 'At screen (680, 270), because (1100 − 1000) × 2 + 480 = 680.',
      walkthrough: [],
    },
    {
      id: 'mg3-003-ch3',
      title: 'Debug the missing score',
      difficulty: 'hard',
      problem: 'After moving Score under HUD, the script\'s line scene.get(\'Score\').text = ... throws "no node at Score". Why, and what is the fix?',
      hint: 'Paths follow the tree.',
      answer: "Score is now HUD's child, so its path is HUD/Score; use scene.get('HUD/Score').",
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'CanvasLayer',
        meaning: 'Draws its children in screen coordinates, so they never scroll.',
      },
      {
        symbol: 'world coordinates',
        meaning: 'Where things are in the level; the camera picks what shows.',
      },
      {
        symbol: 'screen coordinates',
        meaning: 'Where things are on the screen; (0, 0) is its top-left.',
      },
      {
        symbol: 'Label',
        meaning: 'A node that draws text; set its text from a script.',
      },
      {
        symbol: "scene.get('HUD/Score')",
        meaning: 'A node by its path from the scene root.',
      },
    ],
    rulesOfThumb: [
      'Anything that should not scroll goes under a CanvasLayer.',
      "Update the HUD's text when the value changes, not every frame, if you can.",
      'Paths change when you move nodes; update scene.get calls.',
      "Keep the HUD's labels clear of the screen's edges by at least 10 pixels.",
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Positions mean the same thing for every node.',
      whyStudentsThinkIt: 'Every node has a position property.',
      correctionExample: "(16, 12) under HUD is always the screen's corner; in the world it is near the level's start.",
      contrastCase: "A CanvasLayer changes the meaning of its children's positions.",
    },
    {
      falseBelief: 'A HUD must be moved with the camera every frame.',
      whyStudentsThinkIt: 'That is how you would keep something on screen by hand.',
      correctionExample: 'Under a CanvasLayer, the label at (16, 12) stays put with no script at all.',
      contrastCase: 'Moving it by hand works but jitters with smoothing and is easy to get wrong.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A "Paused" banner must cover the middle of the screen whatever the camera shows.',
      competingTechniques: [
        "A Label under a CanvasLayer at the screen's middle",
        "A Label at the camera's world position, moved each frame",
      ],
      whyThisTechniqueWins: 'The CanvasLayer keeps it fixed with no code; the camera-following label lags when smoothing is on.',
    },
    {
      situation: 'Damage numbers should float up from enemies and scroll with the world.',
      competingTechniques: [
        "Labels in the world, at the enemy's position",
        'Labels under the HUD',
      ],
      whyThisTechniqueWins: 'They belong to a place in the level, so they should move with it; HUD labels would stay on screen as the enemy scrolls away.',
    },
  ],

  debugging: [
    {
      commonError: 'Making the Label a child of the camera instead of a CanvasLayer.',
      symptom: 'It nearly stays put but drifts and wobbles with smoothing.',
      whyItHappened: "The camera's position is not the view's position while smoothing.",
      repairStrategy: 'Put HUD labels under a CanvasLayer.',
    },
    {
      commonError: 'Forgetting to update the path after moving a label.',
      symptom: 'An error, no node at "Score".',
      whyItHappened: 'The path now goes through HUD.',
      repairStrategy: "Use the full path, scene.get('HUD/Score').",
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Build a HUD that shows a value and never scrolls.',
    explainVerbally: 'Explain world and screen coordinates and what a CanvasLayer changes.',
    detectIncorrectApplication: 'Spot a HUD in the world, and labels that should be in the world.',
    transferToUnfamiliar: 'Convert between screen and world, for clicks.',
  },

  assessment: {
    questions: [
      {
        id: 'mg3-003-assess-1',
        type: 'choice',
        text: 'Where should a score label go so it never scrolls?',
        options: [
          'Under a CanvasLayer',
          'Under the camera',
          'Under Player',
          'At the scene root',
        ],
        answer: 'Under a CanvasLayer',
        hint: 'Its children use screen coordinates.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg3-003-quiz-1',
      type: 'choice',
      text: 'What does a CanvasLayer change for its children?',
      options: [
        'Their positions are screen coordinates',
        'Their colour',
        'Their collision layers',
        'Nothing',
      ],
      answer: 'Their positions are screen coordinates',
      hints: ["Painted on the window's glass."],
      reviewSection: 'Intuition — the CanvasLayer paragraph',
    },
    {
      id: 'mg3-003-quiz-2',
      type: 'choice',
      text: 'View at x = 1500, screen 960. Where is a world label at x = 16 on the screen?',
      options: ['−1004', '16', '1004', '496'],
      answer: '−1004',
      hints: ['16 − 1500 + 480.'],
      reviewSection: 'Examples — After walking',
    },
    {
      id: 'mg3-003-quiz-3',
      type: 'choice',
      text: 'Score is under HUD. Its path?',
      options: ['HUD/Score', 'Score', 'Score/HUD', 'Main/Score'],
      answer: 'HUD/Score',
      hints: ['Parent first.'],
      reviewSection: 'Challenges — the missing score',
    },
    {
      id: 'mg3-003-quiz-4',
      type: 'choice',
      text: 'A click at screen (480, 270), view at (2000, 270), zoom 1. Which world point?',
      options: ['(2000, 270)', '(480, 270)', '(2480, 540)', '(1520, 270)'],
      answer: '(2000, 270)',
      hints: ["The middle of the screen is the view's centre."],
      reviewSection: 'Under the hood — screen to world',
    },
    {
      id: 'mg3-003-quiz-5',
      type: 'choice',
      text: 'Which of these does NOT belong on a CanvasLayer?',
      options: ['A coin in the level', 'The score', 'A health bar', 'A pause menu'],
      answer: 'A coin in the level',
      hints: ['It belongs to a place in the world.'],
      reviewSection: 'Transfer — damage numbers',
    },
    {
      id: 'mg3-003-quiz-6',
      type: 'choice',
      text: 'Why does a label under the camera wobble with smoothing?',
      options: [
        "The camera's position is not the view's position while smoothing",
        'Labels cannot be children',
        'The text changes',
        'Zoom',
      ],
      answer: "The camera's position is not the view's position while smoothing",
      hints: ['The view lags the camera.'],
      reviewSection: 'Debugging — child of the camera',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg3-003-1',
      label: 'Read why a world label scrolls away',
      type: 'read',
    },
    {
      id: 'cp-mg3-003-2',
      label: 'Read world and screen coordinates',
      type: 'read',
    },
    {
      id: 'cp-mg3-003-3',
      label: 'Read the HUD procedure',
      type: 'read',
    },
    {
      id: 'cp-mg3-003-4',
      label: 'Complete "A HUD that stays put" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg3-003-5',
      label: 'Add a Health label to the HUD in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg3-003-6',
      label: 'Work through the after-walking example',
      type: 'example',
    },
    {
      id: 'cp-mg3-003-7',
      label: 'Work through the click example',
      type: 'example',
    },
    {
      id: 'cp-mg3-003-8',
      label: 'Attempt the missing-score challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-3',
}
