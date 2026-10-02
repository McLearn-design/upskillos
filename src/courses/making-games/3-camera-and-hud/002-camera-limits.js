export default {
  order: 2,

  id: 'mg3-002',

  slug: 'camera-limits',

  title: 'Camera Limits',

  subtitle: "Never show the empty space past the level's edges.",

  tags: ['game-studio', 'camera'],

  aliases: 'camera limits clamp limittopleft limitbottomright level bounds edges',

  timeToComplete: 20,

  coreConcept: "Camera limits are the edges of the level. The view's centre is clamped so the screen never reaches past them: between the left limit plus half the screen and the right limit minus half the screen.",

  prerequisites: ['mg3-001'],

  nextLesson: 'mg3-003',

  hook: {
    question: 'Player starts at x = 100 in a level that begins at x = 0. With the camera centred on Player, the left 380 pixels of the screen show nothing. How do you stop that, without moving the player?',
    realWorldContext: "Showing past the edge of a level breaks the illusion of a world. Every side-scroller clamps its camera to the level's bounds.",
  },

  intuition: {
    prose: [
      "The screen is 960 wide. If the view's centre is at x = 100, the screen's left edge is at 100 − 480 = −380: 380 pixels of nothing left of the level.",
      "Set `limitTopLeft` x to 0. Before reading on, predict: where does the view's centre go? The screen's left edge may not go below 0, so the centre may not go below 0 + 480 = 480. The view sits at 480 while Player walks the first 480 pixels.",
      'The same holds on the right: with `limitBottomRight` x at 3000, the centre may not pass 3000 − 480 = 2520. Past that, Player walks towards the right edge of the screen while the view stays still.',
      'And the bottom: `limitBottomRight` y at 540 keeps the view from showing below the floor.',
      'This is a **clamp**: keep a number between a low and a high value. The view is clamped to [limit + half the screen, limit − half the screen] on each axis.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Keep the view inside the level',
        body: "Step 1. Find the level's edges in world pixels (left, top, right, bottom).\nStep 2. Select the Camera2D and set limitTopLeft to the left and top edges.\nStep 3. Set limitBottomRight to the right and bottom edges.\nStep 4. Run, and walk to each end: the edges of the screen stop at the edges of the level.",
      },
      {
        type: 'warning',
        title: 'A level smaller than the screen',
        body: 'If the level is narrower than the screen, no centre satisfies both limits. The engine then centres the view on the level, and its edges show past it on both sides.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Camera limits',
        props: {
          task: 'camera-limits',
          lesson: 'mg3-002',
          checkpoint: 'cp-mg3-002-4',
        },
      },
    ],
  },

  math: {
    prose: [
      "**Under the hood (optional).** With limits $L$ (low) and $H$ (high) on one axis and half the screen $h = W / (2 \\times \\text{zoom})$, the view's centre is $\\text{clamp}(c, L + h, H - h) = \\min(H - h, \\max(L + h, c))$.",
      'For $L = 0$, $H = 3000$ and $h = 480$: the centre stays in $[480, 2520]$. Player at 100 gives 480; Player at 1500 gives 1500; Player at 2900 gives 2520.',
      'When $L + h > H - h$, that is when the level is narrower than $2h$, the interval is empty and the centre is $(L + H)/2$. Zooming in (zoom 2) halves $h$, so a small level can fill the screen.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, the clamp is the projection of $c$ onto the interval $[L + h, H - h]$: the nearest point of the interval to $c$. It is applied to each axis independently.',
      'The invariant: whatever the target, the visible rectangle $[c - h, c + h]$ stays inside $[L, H]$ whenever the level is at least as wide as the screen.',
      "Geometrically, the camera's centre moves freely inside a smaller rectangle, the level shrunk by half the screen on every side, and slides along its edges when the target is outside it.",
      'Smoothing and limits combine: the engine clamps the target and smooths towards the clamped point, so the view eases into an edge instead of bouncing off it.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg3-002-ex1',
      title: 'Near the start',
      difficulty: 'easy',
      problem: "Level from x = 0 to 3000, screen 960. Player at x = 100. Where is the view's centre?",
      steps: [
        {
          expression: '\\max(0 + 480, 100) = 480',
          annotation: 'The centre may not go below the left limit plus half the screen.',
          strategyTitle: 'Step 1: Clamp from below',
        },
      ],
      answer: "The view's centre stays at x = 480.",
    },
    {
      id: 'mg3-002-ex2',
      title: 'Near the end',
      difficulty: 'medium',
      problem: 'Same level, Player at x = 2900. Where is the centre, and where is Player on the screen?',
      steps: [
        {
          expression: '\\min(3000 - 480, 2900) = 2520',
          annotation: 'The centre may not pass the right limit minus half the screen.',
          strategyTitle: 'Step 1: Clamp from above',
        },
        {
          expression: '2900 - (2520 - 480) = 860',
          annotation: "The screen's left edge is at world 2040, so Player is 860 pixels into the screen.",
          strategyTitle: 'Step 2: Player on screen',
        },
      ],
      answer: "The centre is at 2520 and Player appears 860 pixels from the screen's left edge.",
    },
    {
      id: 'mg3-002-ex3',
      title: 'A small room',
      difficulty: 'hard',
      problem: "A room 600 wide (x 0 to 600) and a 960 screen. Where is the centre? What if the camera's zoom is 2?",
      steps: [
        {
          expression: '0 + 480 > 600 - 480 \\Rightarrow c = 300',
          annotation: 'No centre fits, so the view is centred on the room.',
          strategyTitle: 'Step 1: Too small',
        },
        {
          expression: 'h = \\tfrac{960}{2 \\times 2} = 240,\\ c \\in [240, 360]',
          annotation: 'At zoom 2 the screen covers 480 world pixels, and the room is wide enough.',
          strategyTitle: 'Step 2: Zoom in',
        },
      ],
      answer: 'At zoom 1 the view centres on x = 300 with gaps either side; at zoom 2 the centre moves within 240 to 360 and no gap shows.',
    },
  ],

  challenges: [
    {
      id: 'mg3-002-ch1',
      title: 'Vertical limits',
      difficulty: 'easy',
      problem: "A level from y = 0 to 540 and a 540-tall screen. Where can the view's centre be vertically?",
      hint: 'Half the screen is 270.',
      answer: 'Only at y = 270: the level is exactly one screen tall.',
      walkthrough: [
        {
          expression: '[0 + 270, 540 - 270] = [270, 270]',
          annotation: 'The interval is a single point.',
        },
      ],
    },
    {
      id: 'mg3-002-ch2',
      title: 'Where the view stops scrolling',
      difficulty: 'medium',
      problem: 'Level 0 to 4000, screen 960. Between which Player positions does the view scroll?',
      hint: 'Inside the clamp interval, the centre follows Player.',
      answer: 'Between x = 480 and x = 3520; outside that the view stays still.',
      walkthrough: [],
    },
    {
      id: 'mg3-002-ch3',
      title: 'Debug the gap at the bottom',
      difficulty: 'hard',
      problem: "A learner set limitTopLeft (0, 0) and limitBottomRight (3000, 0), and now the view shows the level's top half only and cannot move down. What went wrong?",
      hint: 'What does a bottom limit of 0 allow?',
      answer: "The bottom limit 0 makes the level 0 tall, so the view is centred at y = 0 and shows below and above it; set limitBottomRight y to the level's real bottom, 540.",
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'limitTopLeft',
        meaning: "The level's left and top edges; the view never shows past them.",
      },
      {
        symbol: 'limitBottomRight',
        meaning: "The level's right and bottom edges.",
      },
      {
        symbol: 'clamp(c, lo, hi)',
        meaning: 'c kept between lo and hi: min(hi, max(lo, c)).',
      },
      {
        symbol: 'h = W / (2 × zoom)',
        meaning: 'Half the screen in world pixels.',
      },
    ],
    rulesOfThumb: [
      "Set limits to the level's real edges, in world pixels.",
      'The view scrolls only while the player is more than half a screen from an edge.',
      'A level smaller than the screen gets centred; zoom in to fill it.',
      'Check each edge by walking to it.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Limits stop the player at the edges.',
      whyStudentsThinkIt: 'They are called limits.',
      correctionExample: 'With limits 0 to 3000, Player can still walk to x = −50 if no wall stops it; only the view stops.',
      contrastCase: 'Walls stop the player; limits stop the camera.',
    },
    {
      falseBelief: 'With limits, Player always stays in the middle of the screen.',
      whyStudentsThinkIt: 'The camera follows Player.',
      correctionExample: "At x = 2900, Player is 860 px from the screen's left edge, not in the middle (480).",
      contrastCase: 'Only while the view is not clamped does Player stay in the middle.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A minimap marker must stay inside its frame however far the player goes.',
      competingTechniques: [
        "Clamp the marker's position to the frame",
        'Hide the marker when it leaves',
      ],
      whyThisTechniqueWins: 'Clamping keeps it visible at the nearest edge, which tells the player the direction.',
    },
    {
      situation: 'A small puzzle room should fill the screen.',
      competingTechniques: [
        'Zoom the camera so the room is at least a screen wide',
        'Set limits wider than the room',
      ],
      whyThisTechniqueWins: 'Limits wider than the room would show past it; zoom makes the room fill the view.',
    },
  ],

  debugging: [
    {
      commonError: 'Setting limits on a camera that is not current.',
      symptom: 'Nothing changes.',
      whyItHappened: 'The screen uses the current camera.',
      repairStrategy: 'Select the current camera, or tick current on the one you set.',
    },
    {
      commonError: "Using screen sizes instead of the level's edges.",
      symptom: 'The view stops scrolling after 960 pixels.',
      whyItHappened: 'limitBottomRight x was set to the screen width, not the level width.',
      repairStrategy: "Use the level's right edge in world pixels (3000).",
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: "Set limits so the view never shows past a level's edges.",
    explainVerbally: 'Explain the clamp interval and why the player leaves the middle near the ends.',
    detectIncorrectApplication: 'Spot limits that confuse screen and level sizes.',
    transferToUnfamiliar: 'Handle levels smaller than the screen with zoom.',
  },

  assessment: {
    questions: [
      {
        id: 'mg3-002-assess-1',
        type: 'choice',
        text: "Level 0 to 3000, screen 960. Player at 2900. Where is the view's centre?",
        options: ['2520', '2900', '3000', '2040'],
        answer: '2520',
        hint: 'The right limit minus half the screen.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg3-002-quiz-1',
      type: 'choice',
      text: 'What do camera limits stop?',
      options: [
        "The view going past the level's edges",
        'The player going past them',
        'Enemies',
        'The game',
      ],
      answer: "The view going past the level's edges",
      hints: ['Walls stop the player.'],
      reviewSection: 'Misconceptions — limits and walls',
    },
    {
      id: 'mg3-002-quiz-2',
      type: 'choice',
      text: "Level 0 to 3000, screen 960. What range can the view's centre take?",
      options: ['480 to 2520', '0 to 3000', '960 to 2040', '480 to 3000'],
      answer: '480 to 2520',
      hints: ['Half the screen in from each edge.'],
      reviewSection: 'Under the hood — the clamp',
    },
    {
      id: 'mg3-002-quiz-3',
      type: 'choice',
      text: 'What is clamp(700, 480, 2520)?',
      options: ['700', '480', '2520', '1500'],
      answer: '700',
      hints: ['It is already inside.'],
      reviewSection: 'Intuition — the clamp paragraph',
    },
    {
      id: 'mg3-002-quiz-4',
      type: 'choice',
      text: 'A level 600 wide on a 960 screen at zoom 1. Where is the centre?',
      options: [
        'In the middle of the level',
        'At 480',
        'At 0',
        'It follows the player',
      ],
      answer: 'In the middle of the level',
      hints: ['No centre fits both limits.'],
      reviewSection: 'Intuition — Warning: a level smaller than the screen',
    },
    {
      id: 'mg3-002-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT a camera limit setting?',
      options: [
        "The player's speed",
        'limitTopLeft x',
        'limitBottomRight x',
        'limitBottomRight y',
      ],
      answer: "The player's speed",
      hints: ['Limits are edges.'],
      reviewSection: 'Semantics',
    },
    {
      id: 'mg3-002-quiz-6',
      type: 'choice',
      text: 'Zoom 2 on a 960 screen. Half the screen in world pixels?',
      options: ['240', '480', '960', '120'],
      answer: '240',
      hints: ['960 ÷ (2 × 2).'],
      reviewSection: 'Under the hood — zoom',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg3-002-1',
      label: 'Read where the view stops near the start',
      type: 'read',
    },
    {
      id: 'cp-mg3-002-2',
      label: 'Read the clamp',
      type: 'read',
    },
    {
      id: 'cp-mg3-002-3',
      label: 'Read the limits procedure',
      type: 'read',
    },
    {
      id: 'cp-mg3-002-4',
      label: 'Complete "Camera limits" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg3-002-5',
      label: 'Walk to both ends of the level in Game Studio and watch the view stop',
      type: 'lab',
    },
    {
      id: 'cp-mg3-002-6',
      label: 'Work through the near-the-end example',
      type: 'example',
    },
    {
      id: 'cp-mg3-002-7',
      label: 'Work through the small-room example',
      type: 'example',
    },
    {
      id: 'cp-mg3-002-8',
      label: 'Attempt the gap-at-the-bottom challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-3',
}
