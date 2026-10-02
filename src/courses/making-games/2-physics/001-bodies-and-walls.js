export default {
  order: 1,

  id: 'mg2-001',

  slug: 'bodies-and-walls',

  title: 'Bodies, Shapes and Walls',

  subtitle: 'A player you move with the keys, and a wall it cannot walk through.',

  tags: ['game-studio', 'physics', 'collision'],

  aliases: 'characterbody2d staticbody2d collisionshape2d moveandslide walls collision minimum translation vector',

  timeToComplete: 30,

  coreConcept: 'A body is a node the physics engine knows about; its collision shape is what bumps into things. A CharacterBody2D moves when its script calls moveAndSlide(), and stops at solid bodies such as a StaticBody2D.',

  prerequisites: ['mg1-004'],

  nextLesson: 'mg2-002',

  hook: {
    question: 'Hero walks right at 200 pixels a second towards a wall. Nothing in your script mentions the wall. How does Hero know to stop, and exactly where does it stop?',
    realWorldContext: 'Every platformer, top-down adventure and racing game needs things that cannot pass through each other. Engines do this once, for every body, so a script only says where it wants to go.',
  },

  intuition: {
    prose: [
      "Hero is 16 pixels wide, standing at x = 300. A wall 20 pixels wide stands at x = 600. Hero moves right at 200 pixels a second. Its right edge is at 300 + 8 = 308; the wall's left edge is at 600 − 10 = 590. The gap is 282 pixels, so after about 1.4 seconds the two edges meet.",
      "Before reading on, predict: where is Hero's centre when it stops? Its right edge sits on the wall's left edge, at 590, so its centre is 8 pixels to the left: x = 582. It stops there however fast it was going.",
      'For this to happen, both need a **collision shape**: a CollisionShape2D under the node, a rectangle or a circle. The picture is what you see; the shape is what bumps. A sprite with no shape walks through everything.',
      'The two are different kinds of **body**. Hero is a **CharacterBody2D**: a body your script moves. The wall is a **StaticBody2D**: a body that never moves, and only gets in the way.',
      'The script sets `this.velocity`, in pixels per second, then calls `this.moveAndSlide()`. That moves Hero by velocity × dt, and if the move would overlap a solid body, pushes Hero back out. It runs in `physicsUpdate(dt)`, which Game Studio calls at a fixed 60 steps a second.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Make a body that walls stop',
        body: "Step 1. Add a CharacterBody2D for the moving thing, and name it (Player).\nStep 2. Under it, add a Sprite2D for the picture and a CollisionShape2D for the shape; size the shape to the picture.\nStep 3. Give it a script (New script gives arrow-key movement): set this.velocity, then call this.moveAndSlide() in physicsUpdate(dt).\nStep 4. Add a StaticBody2D for each wall, with its own CollisionShape2D.\nStep 5. Run, walk into the wall, and check that the body stops at the wall's edge.",
      },
      {
        type: 'warning',
        title: 'No shape, no collision',
        body: 'A body without a CollisionShape2D, or with a shape of size 0, passes through everything. If Player walks through the wall, select each in turn and check there is a shape under it, and that it has a size.',
      },
      {
        type: 'insight',
        title: "Godot's names",
        body: "CharacterBody2D, StaticBody2D, CollisionShape2D, velocity and moveAndSlide() are Godot's names and work the same way there.",
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'A player who cannot walk through walls',
        props: {
          task: 'stop-at-walls',
          lesson: 'mg2-001',
          checkpoint: 'cp-mg2-001-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** Two rectangles with centres $x_A$, $x_B$ and widths $w_A$, $w_B$ overlap across when $|x_A - x_B| < \\tfrac{w_A + w_B}{2}$. The overlap across is $o_x = \\tfrac{w_A + w_B}{2} - |x_A - x_B|$, and down is $o_y = \\tfrac{h_A + h_B}{2} - |y_A - y_B|$. They overlap only when both are positive.',
      'To separate them, the engine pushes along the axis with the smaller overlap, by exactly that much. This shortest push is the **minimum translation vector**. For Hero moving into the wall, $o_x$ is a few pixels while $o_y$ is large, so the push is sideways, back to $x = 582$.',
      "Then it slides: the part of the velocity going into the wall is removed. With $\\mathbf{n}$ the wall's surface direction (length 1, pointing out of it), the new velocity is $\\mathbf{v} - (\\mathbf{v} \\cdot \\mathbf{n})\\,\\mathbf{n}$ when $\\mathbf{v} \\cdot \\mathbf{n} < 0$. Walking diagonally into a wall with $\\mathbf{v} = (200, 100)$ and $\\mathbf{n} = (-1, 0)$: $\\mathbf{v} \\cdot \\mathbf{n} = -200$, so $\\mathbf{v}$ becomes $(0, 100)$, sliding along the wall.",
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, for convex shapes $A$ and $B$, a translation $\\mathbf{t}$ separates them when $A + \\mathbf{t}$ and $B$ have disjoint interiors; the minimum translation vector is the shortest such $\\mathbf{t}$. For two axis-aligned rectangles it lies along an axis, with length $\\min(o_x, o_y)$.',
      'Sliding keeps the tangential part of the velocity and removes the normal part. The invariant is the tangential speed: walking along a wall loses no speed along it.',
      "Geometrically, $(\\mathbf{v} \\cdot \\mathbf{n})\\mathbf{n}$ is the projection of $\\mathbf{v}$ onto the normal, and subtracting it leaves the projection onto the wall's line.",
      'Real engines also test the path, not just the end position, so a very fast body cannot jump over a thin wall in one step ("tunnelling"). At 60 steps a second and game speeds, Game Studio\'s steps are short enough that this rarely matters.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg2-001-ex1',
      title: 'Where it stops',
      difficulty: 'easy',
      problem: 'Player is 16 wide; a wall 20 wide is centred at x = 600. Player walks right into it. Where is its centre?',
      steps: [
        {
          expression: '600 - \\tfrac{20}{2} = 590',
          annotation: "The wall's left edge is half its width left of its centre.",
          strategyTitle: "Step 1: The wall's edge",
        },
        {
          expression: '590 - \\tfrac{16}{2} = 582',
          annotation: "Player's right edge touches it, so its centre is half Player's width further left.",
          strategyTitle: 'Step 2: Back off by half the body',
        },
      ],
      answer: 'Player stops with its centre at x = 582.',
    },
    {
      id: 'mg2-001-ex2',
      title: 'Which way is the push?',
      difficulty: 'medium',
      problem: 'After a step, Player (16 × 22, centre 584, 270) overlaps the wall (20 × 200, centre 600, 270). Which way and how far is it pushed?',
      steps: [
        {
          expression: 'o_x = \\tfrac{16 + 20}{2} - |584 - 600| = 18 - 16 = 2',
          annotation: 'The overlap across is the half-widths summed, less the distance between centres.',
          strategyTitle: 'Step 1: Overlap across',
        },
        {
          expression: 'o_y = \\tfrac{22 + 200}{2} - |270 - 270| = 111',
          annotation: 'The overlap down is far bigger.',
          strategyTitle: 'Step 2: Overlap down',
        },
        {
          expression: 'o_x < o_y \\Rightarrow \\text{push } 2 \\text{ px left}',
          annotation: 'The smaller overlap gives the shortest push, back to x = 582.',
          strategyTitle: 'Step 3: Push along the smaller overlap',
        },
      ],
      answer: 'It is pushed 2 pixels left, to x = 582.',
    },
    {
      id: 'mg2-001-ex3',
      title: 'Sliding along a wall',
      difficulty: 'hard',
      problem: 'Player moves with velocity (200, 100) into a wall whose surface faces left, n = (−1, 0). What velocity is left after the slide?',
      steps: [
        {
          expression: '\\mathbf{v} \\cdot \\mathbf{n} = 200 \\times (-1) + 100 \\times 0 = -200',
          annotation: 'Negative means it is moving into the wall.',
          strategyTitle: 'Step 1: How much goes into the wall',
        },
        {
          expression: '\\mathbf{v} - (\\mathbf{v} \\cdot \\mathbf{n})\\mathbf{n} = (200, 100) - (-200)(-1, 0) = (0, 100)',
          annotation: 'The part into the wall is removed; the part along it stays.',
          strategyTitle: 'Step 2: Remove it',
        },
      ],
      answer: 'The velocity becomes (0, 100), so Player slides down along the wall at 100 px/s.',
    },
  ],

  challenges: [
    {
      id: 'mg2-001-ch1',
      title: 'From the left',
      difficulty: 'easy',
      problem: 'A 24-wide player walks left into a wall 40 wide centred at x = 100. Where does its centre stop?',
      hint: "Find the wall's right edge first.",
      answer: "At x = 132, because the wall's right edge is at 120 and the player's half-width is 12.",
      walkthrough: [
        {
          expression: '100 + 20 + 12 = 132',
          annotation: 'Right edge of the wall, plus half the player.',
        },
      ],
    },
    {
      id: 'mg2-001-ch2',
      title: 'Floor or wall?',
      difficulty: 'medium',
      problem: 'A body 16 × 16 at (100, 92) overlaps a floor 400 × 20 centred at (200, 108). Which way is it pushed, and how far?',
      hint: 'Compare the overlap across and down.',
      answer: 'Up by 2 pixels, because the overlap down (18 − 16 = 2) is smaller than the overlap across (208 − 100 = 108).',
      walkthrough: [],
    },
    {
      id: 'mg2-001-ch3',
      title: 'Debug the ghost',
      difficulty: 'hard',
      problem: "A learner's Player walks straight through the wall. Player has a CharacterBody2D with a Sprite2D under it; the wall is a StaticBody2D with a CollisionShape2D. What is missing?",
      hint: 'What does the engine collide: pictures or shapes?',
      answer: 'Player has no CollisionShape2D, so it has no shape to collide with; add one under Player.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'CharacterBody2D',
        meaning: 'A body your script moves with velocity and moveAndSlide().',
      },
      {
        symbol: 'StaticBody2D',
        meaning: 'A body that never moves and blocks others, such as a wall or floor.',
      },
      {
        symbol: 'CollisionShape2D',
        meaning: 'The rectangle or circle that bumps into things; the picture does not.',
      },
      {
        symbol: 'moveAndSlide()',
        meaning: 'Moves by velocity × dt, pushes out of solid bodies, and slides along them.',
      },
      {
        symbol: 'physicsUpdate(dt)',
        meaning: 'Called 60 times a second exactly; where movement and physics go.',
      },
    ],
    rulesOfThumb: [
      'Size the collision shape to the picture, or a little smaller, so contacts look right.',
      'Move bodies in physicsUpdate, not update, so they step at the physics rate.',
      'If something passes through a wall, check both have shapes first.',
      'Set velocity in pixels per second; moveAndSlide multiplies by dt for you.',
    ],
  },

  misconceptions: [
    {
      falseBelief: "The sprite's picture is what collides.",
      whyStudentsThinkIt: 'You can see the picture touch the wall.',
      correctionExample: 'A Sprite2D with no CollisionShape2D under its body passes through a wall at x = 600 untouched.',
      contrastCase: 'A shape 2 pixels wide under an invisible body still stops at the wall.',
    },
    {
      falseBelief: 'A fast body stops further into the wall than a slow one.',
      whyStudentsThinkIt: 'In real life, faster things hit harder and dent further.',
      correctionExample: 'At 200 or 600 px/s, a 16-wide player stops with its centre at x = 582 at a wall edge of 590.',
      contrastCase: 'Only the overlap is pushed out, so the stopping place depends on the sizes, not the speed.',
    },
  ],

  transferPrompts: [
    {
      situation: 'You want a crate that the player can stand on but which never moves.',
      competingTechniques: ['A StaticBody2D with a shape', 'A Sprite2D on its own'],
      whyThisTechniqueWins: 'A StaticBody2D with a shape blocks and supports bodies; a sprite alone is only a picture.',
    },
    {
      situation: 'An enemy should walk along a corridor and stop at its walls, steered by its own script.',
      competingTechniques: [
        'A CharacterBody2D with moveAndSlide',
        'Changing its position directly',
      ],
      whyThisTechniqueWins: 'Setting position directly ignores walls; moveAndSlide pushes it out of them and slides it along.',
    },
  ],

  debugging: [
    {
      commonError: 'Setting this.position instead of this.velocity.',
      symptom: 'Player moves, but walks through walls.',
      whyItHappened: 'Changing position directly skips collision; only moveAndSlide checks for walls.',
      repairStrategy: 'Set this.velocity in pixels per second and call this.moveAndSlide() in physicsUpdate.',
    },
    {
      commonError: 'Putting the CollisionShape2D beside the body instead of under it.',
      symptom: 'The task says Player has no shape; nothing collides.',
      whyItHappened: 'A shape belongs to the body it is a child of.',
      repairStrategy: 'Drag the CollisionShape2D onto Player in the scene tree so it is indented under it.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Build a body and walls that stop it, and predict where it stops.',
    explainVerbally: 'Explain why the shape, not the picture, collides, and what moveAndSlide does.',
    detectIncorrectApplication: 'Spot movement that sets position directly and so ignores walls.',
    transferToUnfamiliar: 'Work out the push and slide for any overlap and any wall direction.',
  },

  assessment: {
    questions: [
      {
        id: 'mg2-001-assess-1',
        type: 'choice',
        text: 'Which node type never moves and blocks other bodies?',
        options: ['StaticBody2D', 'CharacterBody2D', 'Sprite2D', 'Area2D'],
        answer: 'StaticBody2D',
        hint: 'Walls and floors do not move; a character is moved by its script.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg2-001-quiz-1',
      type: 'choice',
      text: 'What actually bumps into walls?',
      options: [
        'The CollisionShape2D',
        'The Sprite2D',
        'The script',
        "The node's name",
      ],
      answer: 'The CollisionShape2D',
      hints: ['The picture is only what you see.'],
      reviewSection: 'Intuition — the collision shape paragraph',
    },
    {
      id: 'mg2-001-quiz-2',
      type: 'choice',
      text: 'A 16-wide player walks right into a wall whose left edge is at x = 590. Where is its centre?',
      options: ['582', '590', '598', '574'],
      answer: '582',
      hints: [
        "Half the player's width to the left of the edge. 590 is the near-miss: it is the edge.",
      ],
      reviewSection: 'Examples — Where it stops',
    },
    {
      id: 'mg2-001-quiz-3',
      type: 'choice',
      text: 'How often does physicsUpdate(dt) run?',
      options: [
        '60 times a second exactly',
        'Once a frame, however fast the screen',
        'Once a second',
        'Only when bodies touch',
      ],
      answer: '60 times a second exactly',
      hints: ['Physics steps at a fixed rate.'],
      reviewSection: 'Intuition — the moveAndSlide paragraph',
    },
    {
      id: 'mg2-001-quiz-4',
      type: 'choice',
      text: 'Overlaps are 3 across and 40 down. Which way is the push?',
      options: ['Across, by 3', 'Down, by 40', 'Diagonally', 'Neither'],
      answer: 'Across, by 3',
      hints: ['The minimum translation vector takes the smaller overlap.'],
      reviewSection: 'Under the hood — the minimum translation vector',
    },
    {
      id: 'mg2-001-quiz-5',
      type: 'choice',
      text: 'Which of these does NOT stop a CharacterBody2D at a wall?',
      options: [
        'Setting this.position each frame',
        'Setting velocity and calling moveAndSlide()',
        'A wall with a shape',
        'A player with a shape',
      ],
      answer: 'Setting this.position each frame',
      hints: ['Only moveAndSlide checks for walls.'],
      reviewSection: 'Debugging — setting position instead of velocity',
    },
    {
      id: 'mg2-001-quiz-6',
      type: 'choice',
      text: 'Velocity (300, 0) into a floor whose normal is (0, −1). What is left after the slide?',
      options: ['(300, 0)', '(0, 0)', '(300, 300)', '(0, 300)'],
      answer: '(300, 0)',
      hints: ['v · n = 0, so nothing goes into the floor and nothing is removed.'],
      reviewSection: 'Under the hood — sliding',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg2-001-1',
      label: 'Read where a body stops at a wall',
      type: 'read',
    },
    {
      id: 'cp-mg2-001-2',
      label: 'Read what a collision shape is for',
      type: 'read',
    },
    {
      id: 'cp-mg2-001-3',
      label: 'Read the procedure for walls',
      type: 'read',
    },
    {
      id: 'cp-mg2-001-4',
      label: 'Complete "A player who cannot walk through walls" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg2-001-5',
      label: 'Walk diagonally into the wall in Game Studio and watch it slide',
      type: 'lab',
    },
    {
      id: 'cp-mg2-001-6',
      label: 'Work through the push example',
      type: 'example',
    },
    {
      id: 'cp-mg2-001-7',
      label: 'Work through the slide example',
      type: 'example',
    },
    {
      id: 'cp-mg2-001-8',
      label: 'Attempt the ghost debugging challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-2',
}
