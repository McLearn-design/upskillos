export default {
  order: 1,

  id: 'mg1-001',

  slug: 'scenes-nodes-and-positions',

  title: 'Scenes, Nodes and Positions',

  subtitle: 'Put a character exactly where you want it, and know why (0, 0) is in the top-left corner.',

  tags: ['game-studio', 'nodes', 'coordinates'],

  aliases: 'game studio editor scene tree inspector sprite2d position coordinates y down top-left origin',

  timeToComplete: 25,

  coreConcept: 'A game is a tree of nodes, and every visible node has a position: two numbers saying how far right and how far down it is from the top-left corner of the game area.',

  prerequisites: [],

  nextLesson: 'mg1-002',

  hook: {
    question: 'A game window is 960 pixels wide and 540 pixels tall. Which two numbers put a character in its exact middle, and which way does the second number count?',
    realWorldContext: 'Every 2D game engine (Godot, Unity, Phaser, Game Studio) places things with x and y numbers. Getting the direction of y wrong is the most common first mistake, and it makes characters fall upwards and menus appear off the screen.',
  },

  intuition: {
    prose: [
      'Start with a game area 960 pixels wide and 540 tall. A green astronaut sits at x = 480, y = 270. The x number says how far right it is from the left edge: 480 of 960 is half way. The y number says how far **down** it is from the top edge: 270 of 540 is half way down. So (480, 270) is the middle.',
      'Now move it to (480, 100). Before reading on, predict: does it go up or down on the screen? It goes **up**. y = 100 is only 100 pixels below the top edge, closer to the top than 270 was. In a game, a bigger y means lower on the screen, the opposite of a graph in a maths book.',
      'The point (0, 0) is called the **origin**. In Game Studio it is the top-left corner of the game area, drawn as a blue rectangle in the viewport. Every position is measured from it: x to the right, y down.',
      'The astronaut itself is a **node**: one thing in the game, with a type and properties. This one is a Sprite2D, the type that shows a picture. Its properties include `texture` (which picture) and `position` (where). A **scene** is a tree of nodes: the scene tree on the left shows it.',
      "Three panels do the work. The **scene tree** lists the nodes; **+ Add…** above it adds one under the node selected. The **viewport** in the middle shows them; you can drag them there. The **Inspector** on the right shows the selected node's properties as fields you can type into.",
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Place a node at an exact position',
        body: 'Step 1. Add the node: + Add… above the scene tree, then pick its type (Sprite2D for a picture).\nStep 2. Select it in the scene tree, so the Inspector shows its properties.\nStep 3. Give it what it needs to be seen: for a Sprite2D, choose a texture.\nStep 4. Name it: double-click it in the scene tree and type a name (names are case-sensitive).\nStep 5. Type its position in the Inspector: x is pixels right of the left edge, y is pixels down from the top.\nStep 6. Check it in the viewport against the blue game-area rectangle.',
      },
      {
        type: 'warning',
        title: 'y counts downwards',
        body: 'If you think of y as "up", everything lands mirrored top-to-bottom. A character meant to be near the bottom at y = 50 appears near the top instead. Near the bottom of a 540-tall area is y ≈ 500.',
      },
      {
        type: 'insight',
        title: "Godot's names",
        body: "Game Studio uses Godot's names on purpose: Sprite2D, the scene tree, the Inspector, and +y pointing down are all the same in Godot, so what you learn here carries straight over.",
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Put a character on the screen',
        props: {
          task: 'first-sprite',
          lesson: 'mg1-001',
          checkpoint: 'cp-mg1-001-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** A position is a pair of numbers $(x, y)$. In screen coordinates the origin is the top-left corner, $x$ grows to the right and $y$ grows downward. The middle of an area of width $W$ and height $H$ is $(W/2, H/2)$; for $960 \\times 540$ that is $(480, 270)$.',
      'Maths books draw $y$ upward, with the origin at the bottom-left. A point at maths height $y_m$ in an area of height $H$ is at screen height $y_s = H - y_m$, because it is $y_m$ above the bottom edge and the bottom edge is $H$ below the top. So $y_m = 100$ in a 540-tall area is $y_s = 440$: near the bottom.',
      'Converting back uses the same formula, $y_m = H - y_s$, because subtracting from $H$ twice returns where you started: $H - (H - y) = y$. A transformation that undoes itself like this is called an involution.',
      'Moving a node by $(dx, dy)$ adds to each number separately: $(x + dx, y + dy)$. Moving the astronaut from the middle by $(0, -170)$ gives $(480, 100)$: a negative $dy$ means up the screen.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      "Formally, screen coordinates are a basis for the plane with origin at the area's top-left corner, unit vector $(1, 0)$ one pixel right and $(0, 1)$ one pixel down. A position is a vector in that basis, valid for any real numbers: a node at $(-50, 270)$ exists, it is just left of the visible area.",
      'What does not change when you switch between maths and screen coordinates is distance: $\\sqrt{dx^2 + dy^2}$ is the same in both, because flipping $y$ only changes the sign of $dy$, and squaring removes the sign. That is why speeds and sizes need no conversion, only directions do.',
      'Geometrically, the conversion $y \\mapsto H - y$ is a reflection in the horizontal line $y = H/2$, followed by nothing else: the middle row of the screen stays where it is, and the top and bottom swap.',
      "Later, nodes inside other nodes have positions relative to their parent. The screen position is then the parent's transform applied to the child's position: the same idea as here, with the parent's position as the origin. Chapter 6 uses this for scenes inside scenes.",
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg1-001-ex1',
      title: 'The middle of the game area',
      difficulty: 'easy',
      problem: 'The game area is 960 × 540. Where must the Hero sprite go to be exactly in the middle?',
      steps: [
        {
          expression: 'x = \\tfrac{960}{2} = 480',
          annotation: 'Half the width is the middle across, counted from the left edge.',
          strategyTitle: 'Step 1: Halve the width',
        },
        {
          expression: 'y = \\tfrac{540}{2} = 270',
          annotation: 'Half the height is the middle down, counted from the top edge (y grows downward).',
          strategyTitle: 'Step 2: Halve the height',
        },
        {
          expression: '(x, y) = (480, 270)',
          annotation: "Type 480 and 270 into the Inspector's position fields with Hero selected.",
          strategyTitle: 'Step 3: Type it in the Inspector',
        },
      ],
      answer: 'Hero goes at (480, 270), half way across and half way down the 960 × 540 game area.',
    },
    {
      id: 'mg1-001-ex2',
      title: 'Near the bottom-right corner',
      difficulty: 'medium',
      problem: 'Place a coin 40 pixels in from the right edge and 40 pixels up from the bottom edge of a 960 × 540 game area.',
      steps: [
        {
          expression: 'x = 960 - 40 = 920',
          annotation: 'The right edge is at x = 960; 40 pixels in from it is 40 less.',
          strategyTitle: 'Step 1: Measure x from the right edge',
        },
        {
          expression: 'y = 540 - 40 = 500',
          annotation: 'Up from the bottom edge means a smaller y, because y counts down from the top.',
          strategyTitle: 'Step 2: Measure y from the bottom edge',
        },
        {
          expression: '(920, 500)',
          annotation: "Check in the viewport that the coin sits just inside the blue rectangle's bottom-right corner.",
          strategyTitle: 'Step 3: Check it in the viewport',
        },
      ],
      answer: 'The coin goes at (920, 500); "up from the bottom" became a subtraction from 540.',
    },
    {
      id: 'mg1-001-ex3',
      title: 'A position from a maths graph',
      difficulty: 'hard',
      problem: 'A level designer sketched a platform on graph paper at (300, 120), with y measured up from the bottom of a 540-tall game. Where is it in Game Studio?',
      steps: [
        {
          expression: 'x_s = x_m = 300',
          annotation: 'Both systems measure x from the left edge to the right, so x does not change.',
          strategyTitle: 'Step 1: Keep x',
        },
        {
          expression: 'y_s = H - y_m = 540 - 120 = 420',
          annotation: '120 above the bottom edge is 420 below the top edge.',
          strategyTitle: 'Step 2: Flip y with H − y',
        },
        {
          expression: '(300, 420)',
          annotation: 'The platform is in the lower part of the screen, as the sketch showed.',
          strategyTitle: 'Step 3: Check the picture matches',
        },
      ],
      answer: "The platform is at (300, 420) in Game Studio's coordinates.",
    },
  ],

  challenges: [
    {
      id: 'mg1-001-ch1',
      title: 'The top-left quarter',
      difficulty: 'easy',
      problem: 'Where is the middle of the top-left quarter of a 960 × 540 game area?',
      hint: 'The top-left quarter is 480 wide and 270 tall, starting at (0, 0).',
      answer: 'Its middle is (240, 135), half of 480 across and half of 270 down.',
      walkthrough: [
        {
          expression: '(\\tfrac{480}{2}, \\tfrac{270}{2}) = (240, 135)',
          annotation: 'The quarter starts at the origin, so its middle is half its own size in each direction.',
        },
      ],
    },
    {
      id: 'mg1-001-ch2',
      title: 'Which way did it move?',
      difficulty: 'medium',
      problem: "A sprite's position changes from (480, 270) to (430, 320). Describe the move on screen in words.",
      hint: 'Work out the change in x and the change in y separately, and remember which way y counts.',
      answer: 'It moved 50 pixels left and 50 pixels down, diagonally towards the bottom-left.',
      walkthrough: [
        {
          expression: 'dx = 430 - 480 = -50,\\quad dy = 320 - 270 = +50',
          annotation: 'A negative dx is left; a positive dy is down, because y grows downward.',
        },
      ],
    },
    {
      id: 'mg1-001-ch3',
      title: 'Debug the falling title',
      difficulty: 'hard',
      problem: 'A learner wanted a title 60 pixels below the top of the screen and typed y = 480, thinking "540 minus 60". The title appears near the bottom. What went wrong, and what should y be?',
      hint: 'Which edge is y measured from in Game Studio?',
      answer: 'They converted as if y counted up from the bottom; in Game Studio y already counts down from the top, so 60 below the top is simply y = 60.',
      walkthrough: [
        {
          expression: 'y = 60',
          annotation: 'No conversion is needed when the distance is already measured from the top edge.',
        },
      ],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'node',
        meaning: 'One thing in the game, with a type that decides what it does and properties that set how.',
      },
      {
        symbol: 'scene',
        meaning: 'A tree of nodes that is saved as one file and can be run as a game.',
      },
      {
        symbol: 'Sprite2D',
        meaning: 'The node type that shows a picture (its texture) at its position.',
      },
      {
        symbol: 'position (x, y)',
        meaning: 'Where a node is; x counts pixels right from the left edge, y counts pixels down from the top.',
      },
      {
        symbol: 'origin (0, 0)',
        meaning: "The point every position is measured from; in Game Studio, the game area's top-left corner.",
      },
    ],
    rulesOfThumb: [
      'Bigger y means lower on the screen; if something is upside down, check the sign of y first.',
      'The middle of the game area is half the width and half the height.',
      'Measure "from the right" as width minus distance and "from the bottom" as height minus distance.',
      'Name nodes as you make them; checks, scripts and you will look for them by name.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'A bigger y moves a node up the screen, as on a graph.',
      whyStudentsThinkIt: 'Maths lessons draw y upward from an origin at the bottom-left.',
      correctionExample: 'In a 540-tall game, y = 500 is 40 pixels above the bottom edge, near the bottom.',
      contrastCase: 'Placing a ground strip at y = 20 "to be low" puts it at the top of the screen, so a player standing on it would hang from the ceiling.',
    },
    {
      falseBelief: 'The origin (0, 0) is in the middle of the screen.',
      whyStudentsThinkIt: 'Graphs often centre the axes, and the camera later follows the player.',
      correctionExample: 'A node at (0, 0) shows its centre exactly on the top-left corner of the game area.',
      contrastCase: 'To be in the middle a node needs (480, 270) in a 960 × 540 game, not (0, 0).',
    },
  ],

  transferPrompts: [
    {
      situation: 'You are given a 640 × 360 game instead of 960 × 540 and asked to put a sign in the middle.',
      competingTechniques: [
        "Halve this game's width and height",
        'Reuse (480, 270) from the bigger game',
      ],
      whyThisTechniqueWins: "The middle depends on the area's size; (320, 180) is the middle of 640 × 360, while (480, 270) would sit right of and below it.",
    },
    {
      situation: 'A maths tool gives you a list of points with y measured up from the bottom, for a 540-tall level.',
      competingTechniques: ['Convert each y with 540 − y', 'Type the numbers in as they are'],
      whyThisTechniqueWins: 'Typing them in unchanged mirrors the level top-to-bottom; 540 − y measures the same distances from the top edge, which is what Game Studio expects.',
    },
  ],

  debugging: [
    {
      commonError: "Typing a position into the wrong node's Inspector.",
      symptom: 'The node you meant to move stays put while another one jumps.',
      whyItHappened: 'The Inspector always shows the node selected in the scene tree, which was not the one in mind.',
      repairStrategy: "Click the node's name in the scene tree first and read its name at the top of the Inspector.",
    },
    {
      commonError: 'Naming the node "hero" when the task asks for "Hero".',
      symptom: 'The task says there is no Sprite2D called Hero, although you can see it.',
      whyItHappened: 'Names are case-sensitive, so hero and Hero are different names.',
      repairStrategy: 'Double-click the node and retype the name exactly, including capitals.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Place any node at a position described in words, such as "40 pixels in from the right edge".',
    explainVerbally: 'Explain why a bigger y is lower on the screen, and where the origin is.',
    detectIncorrectApplication: 'Spot a position that was converted as if y counted upward, and fix it.',
    transferToUnfamiliar: "Convert graph-paper coordinates (y up) into Game Studio's for a game of any height.",
  },

  assessment: {
    questions: [
      {
        id: 'mg1-001-assess-1',
        type: 'choice',
        text: 'In a 960 × 540 game, a node at (100, 500) is near which corner?',
        options: [
          'The bottom-left',
          'The top-left',
          'The bottom-right',
          'The top-right',
        ],
        answer: 'The bottom-left',
        hint: 'x = 100 is near the left edge; y = 500 is near the bottom because y counts down from the top.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg1-001-quiz-1',
      type: 'choice',
      text: "Where is (0, 0) in Game Studio's game area?",
      options: [
        'The top-left corner',
        'The middle',
        'The bottom-left corner',
        'Wherever the camera points',
      ],
      answer: 'The top-left corner',
      hints: ['The blue rectangle in the viewport starts at the origin.'],
      reviewSection: 'Intuition — the origin paragraph',
    },
    {
      id: 'mg1-001-quiz-2',
      type: 'choice',
      text: 'A sprite moves from (200, 300) to (200, 250). Which way did it go on screen?',
      options: [
        'Up by 50 pixels',
        'Down by 50 pixels',
        'Left by 50 pixels',
        'It did not move',
      ],
      answer: 'Up by 50 pixels',
      hints: ['y got smaller, and smaller y is higher on the screen.'],
      reviewSection: 'Intuition — Warning: y counts downwards',
    },
    {
      id: 'mg1-001-quiz-3',
      type: 'choice',
      text: 'Which node type shows a picture?',
      options: ['Sprite2D', 'Node2D', 'Camera2D', 'Label'],
      answer: 'Sprite2D',
      hints: ['Its texture property chooses the picture.'],
      reviewSection: 'Intuition — the node paragraph',
    },
    {
      id: 'mg1-001-quiz-4',
      type: 'choice',
      text: 'What is the middle of a 640 × 360 game area?',
      options: ['(320, 180)', '(480, 270)', '(640, 360)', '(180, 320)'],
      answer: '(320, 180)',
      hints: [
        "Halve this area's width and height; (480, 270) is the middle of a different size.",
      ],
      reviewSection: 'Examples — The middle of the game area',
    },
    {
      id: 'mg1-001-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT a correct way to put a node 40 pixels above the bottom of a 540-tall game?',
      options: [
        'Setting y to 40',
        'Setting y to 500',
        'Setting y to 540 − 40',
        'Dragging it until the Inspector shows y = 500',
      ],
      answer: 'Setting y to 40',
      hints: ['y = 40 is 40 pixels below the top edge, not above the bottom one.'],
      reviewSection: 'Examples — Near the bottom-right corner',
    },
    {
      id: 'mg1-001-quiz-6',
      type: 'choice',
      text: 'A graph-paper point is at maths height 90 in a 540-tall game. What is its y in Game Studio?',
      options: ['450', '90', '630', '-90'],
      answer: '450',
      hints: [
        'Use y_s = H − y_m. A near-miss is to keep 90, forgetting that the two systems measure from different edges.',
      ],
      reviewSection: 'Under the hood — converting from maths coordinates',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg1-001-1',
      label: 'Read the middle-of-the-screen example',
      type: 'read',
    },
    {
      id: 'cp-mg1-001-2',
      label: 'Read why y counts downwards',
      type: 'read',
    },
    {
      id: 'cp-mg1-001-3',
      label: 'Read the procedure for placing a node',
      type: 'read',
    },
    {
      id: 'cp-mg1-001-4',
      label: 'Complete "Put a character on the screen" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg1-001-5',
      label: 'Move Hero to (480, 100) in Game Studio and check your prediction',
      type: 'lab',
    },
    {
      id: 'cp-mg1-001-6',
      label: 'Work through the bottom-right corner example',
      type: 'example',
    },
    {
      id: 'cp-mg1-001-7',
      label: 'Work through the graph-paper example',
      type: 'example',
    },
    {
      id: 'cp-mg1-001-8',
      label: 'Attempt the falling-title debugging challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-1',
}
