export default {
  order: 5,

  id: 'mg7-005',

  slug: 'turning',

  title: 'Tetris 5: Turning',

  subtitle: 'A quarter turn is [x, y] → [−y, x], and a nudge when a wall is in the way.',

  tags: ['game-studio', 'tetris', 'rotation'],

  aliases: 'rotate rotation matrix quarter turn wall kick tetris rotate offsets',

  timeToComplete: 30,

  coreConcept: 'Turning a piece a quarter turn clockwise maps each offset [x, y] to [−y, x]. If the turned piece does not fit, try it nudged sideways by 1 or 2 columns ("wall kicks") before giving up.',

  prerequisites: ['mg7-004'],

  nextLesson: 'mg7-006',

  hook: {
    question: 'How do you turn a T piece a quarter turn using only its four offsets, with no pictures and no angles?',
    realWorldContext: "Rotating points about a centre is everywhere in games and graphics: aiming, orbiting, sprites, and every 3D engine's camera. The quarter turn is its simplest case.",
  },

  intuition: {
    prose: [
      "The T's offsets are [−1, 0], [0, 0], [1, 0] and [0, −1]: a bar with a bump on top. Turn it a quarter turn clockwise and the bump should point right.",
      "Try the rule [x, y] → [−y, x] on the bump [0, −1]: it becomes [1, 0], to the right. The bar's ends [−1, 0] and [1, 0] become [0, −1] and [0, 1], up and down. The bar now stands up with the bump on the right.",
      'Before reading on, predict: what does the rule do to [1, 0], the cell to the right? It becomes [0, 1], below. Right turns to down: clockwise on the screen, because y grows downwards.',
      'rotated(cells) returns a new list with every cell turned; it does not change the list it was given. rotate() uses canPlace on the turned cells; if they do not fit, it tries them moved 1 left, 1 right, 2 left, 2 right.',
      'The O does not turn: it looks the same turned, and turning it about a corner cell would make it wobble.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Turn with wall kicks',
        body: "Step 1. rotated(cells): return cells.map(([x, y]) => [-y, x]).\nStep 2. rotate(): if the piece is an O, return.\nStep 3. const cells = this.rotated(p.cells).\nStep 4. For dx of [0, -1, 1, -2, 2]: if canPlace(cells, p.x + dx, p.y), use them, add dx to x, and stop.\nStep 5. In update: isJustPressed('move_up') → this.rotate().",
      },
      {
        type: 'warning',
        title: 'Do not turn the original list',
        body: "Changing the cells in place would also change PIECES.T itself, since the piece's cells are that same list: every new T would spawn already turned. Make a new list with map.",
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Tetris 5: turning',
        props: {
          task: 'tetris-rotate',
          lesson: 'mg7-005',
          checkpoint: 'cp-mg7-005-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** Turning a point $(x, y)$ by angle $\\theta$ about the origin gives $(x\\cos\\theta - y\\sin\\theta,\\ x\\sin\\theta + y\\cos\\theta)$. As a matrix, $\\begin{pmatrix} \\cos\\theta & -\\sin\\theta \\\\ \\sin\\theta & \\cos\\theta \\end{pmatrix}$, the rotation matrix.',
      'For a quarter turn, $\\theta = 90°$: $\\cos\\theta = 0$, $\\sin\\theta = 1$, so $(x, y) \\mapsto (-y, x)$. Whole numbers stay whole numbers: grid cells turn into grid cells.',
      'In maths books $y$ points up and this turns anticlockwise; on the screen $y$ points down, so the same formula looks clockwise. Four quarter turns give $(x, y) \\to (-y, x) \\to (-x, -y) \\to (y, -x) \\to (x, y)$: back where it started.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, the map $R(x, y) = (-y, x)$ is linear, preserves distances ($x^2 + y^2$ is unchanged), and $R^4$ is the identity: it generates the four rotations of a square.',
      "The invariant is the shape's size and connectivity: turned cells are still four, still joined edge to edge, each at the same distance from the centre.",
      "Geometrically, every offset swings a quarter circle about [0, 0]; offsets near the centre barely move, which is why the centre is chosen in each piece's middle.",
      'Modern Tetris uses the "Super Rotation System", with a table of kicks per piece and turn. The simple list 0, −1, +1, −2, +2 is a cut-down version with the same purpose.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg7-005-ex1',
      title: 'Turning one cell',
      difficulty: 'easy',
      problem: 'Turn [2, −1] a quarter turn clockwise.',
      steps: [
        {
          expression: '[x, y] \\mapsto [-y, x]: [2, -1] \\mapsto [1, 2]',
          annotation: 'The new x is minus the old y; the new y is the old x.',
          strategyTitle: 'Step 1: Apply the rule',
        },
      ],
      answer: 'It becomes [1, 2].',
    },
    {
      id: 'mg7-005-ex2',
      title: 'Turning the T',
      difficulty: 'medium',
      problem: 'Turn the T ([−1,0],[0,0],[1,0],[0,−1]).',
      steps: [
        {
          expression: '[-1,0] \\mapsto [0,-1],\\ [0,0] \\mapsto [0,0]',
          annotation: 'The left end goes up; the centre stays.',
          strategyTitle: 'Step 1: First two',
        },
        {
          expression: '[1,0] \\mapsto [0,1],\\ [0,-1] \\mapsto [1,0]',
          annotation: 'The right end goes down; the bump goes right.',
          strategyTitle: 'Step 2: The rest',
        },
      ],
      answer: '[0,−1], [0,0], [0,1], [1,0]: standing up, with the bump on the right.',
    },
    {
      id: 'mg7-005-ex3',
      title: 'A kick off the wall',
      difficulty: 'hard',
      problem: 'A standing I ([0,−1],[0,0],[0,1],[0,2]) at x = 0 turns. Which kick fits?',
      steps: [
        {
          expression: '\\text{turned}: [1,0],[0,0],[-1,0],[-2,0]',
          annotation: 'Lying flat, reaching 2 columns left of the centre.',
          strategyTitle: 'Step 1: Turn it',
        },
        {
          expression: 'dx = 0, -1, 1: \\text{col } -2 \\text{ or } -1 \\text{ out};\\ dx = -2 \\text{ worse}',
          annotation: 'The first three tries and −2 all leave cells left of column 0.',
          strategyTitle: 'Step 2: Try the kicks',
        },
        {
          expression: 'dx = 2: \\text{cols } 0\\text{–}3',
          annotation: 'Nudged 2 right, it fits.',
          strategyTitle: 'Step 3: The one that fits',
        },
      ],
      answer: 'The +2 kick; the I ends lying flat in columns 0 to 3, at x = 2.',
    },
  ],

  challenges: [
    {
      id: 'mg7-005-ch1',
      title: 'Twice',
      difficulty: 'easy',
      problem: 'Turn [1, 0] twice.',
      hint: 'Apply the rule two times.',
      answer: '[−1, 0]: two quarter turns are a half turn.',
      walkthrough: [
        {
          expression: '[1,0] \\mapsto [0,1] \\mapsto [-1,0]',
          annotation: 'Right, then down, then left.',
        },
      ],
    },
    {
      id: 'mg7-005-ch2',
      title: 'Anticlockwise',
      difficulty: 'medium',
      problem: 'What rule turns a quarter turn anticlockwise on screen?',
      hint: 'Three clockwise turns.',
      answer: '[x, y] → [y, −x].',
      walkthrough: [],
    },
    {
      id: 'mg7-005-ch3',
      title: 'Debug the pre-turned T',
      difficulty: 'hard',
      problem: "After turning a T once, every new T spawns already turned. rotated() swaps each cell's numbers in place. Why?",
      hint: "Which list is the piece's cells?",
      answer: "The piece's cells are PIECES.T itself, so changing them in place changes the template; return a new list with map.",
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: '[x, y] → [−y, x]',
        meaning: 'A quarter turn clockwise on the screen.',
      },
      {
        symbol: 'rotation matrix',
        meaning: '[[cos θ, −sin θ], [sin θ, cos θ]], which turns points by θ.',
      },
      {
        symbol: 'wall kick',
        meaning: 'Trying the turned piece nudged sideways when it does not fit in place.',
      },
      {
        symbol: 'rotated(cells)',
        meaning: 'A new list of turned cells; the old list is unchanged.',
      },
    ],
    rulesOfThumb: [
      'Turn offsets about the centre, never absolute positions.',
      'Return new lists; never change shared ones.',
      'Try kicks in order of smallest nudge first.',
      'Skip turning shapes that look the same turned.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Turning needs angles and sine and cosine.',
      whyStudentsThinkIt: 'Rotation is taught with trigonometry.',
      correctionExample: 'For 90° the formula is just [−y, x], whole numbers only.',
      contrastCase: 'Other angles do need cos and sin, and give fractions.',
    },
    {
      falseBelief: 'The formula turns anticlockwise because maths says so.',
      whyStudentsThinkIt: 'In maths books it is anticlockwise.',
      correctionExample: 'On screen, [1, 0] (right) becomes [0, 1] (down): clockwise.',
      contrastCase: "Flipping y's direction flips the apparent direction of turning.",
    },
  ],

  transferPrompts: [
    {
      situation: 'A turret should point at 90° steps as the player presses Q and E.',
      competingTechniques: [
        'Turn its direction vector with [x, y] → [−y, x]',
        'Keep an angle and compute cos and sin',
      ],
      whyThisTechniqueWins: 'For quarter turns the swap rule is exact and simple.',
    },
    {
      situation: 'A puzzle piece must turn but not go through walls.',
      competingTechniques: [
        'Turn, check, and try small nudges',
        'Turn and push it out afterwards',
      ],
      whyThisTechniqueWins: 'Checking before committing never leaves it overlapping.',
    },
  ],

  debugging: [
    {
      commonError: 'Writing [y, −x] by mistake.',
      symptom: 'Pieces turn the wrong way (anticlockwise).',
      whyItHappened: 'That is three quarter turns.',
      repairStrategy: 'Use [−y, x]: [1, 0] must become [0, 1].',
    },
    {
      commonError: 'Turning the O.',
      symptom: 'The O wobbles one column each turn.',
      whyItHappened: 'Its centre is a corner cell, so turning swings it.',
      repairStrategy: 'Return early when the piece is an O.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Write rotated and rotate with kicks.',
    explainVerbally: "Derive [−y, x] from the rotation matrix and explain the screen's clockwise.",
    detectIncorrectApplication: 'Spot in-place changes to shared lists.',
    transferToUnfamiliar: 'Apply quarter turns to any grid shape or direction.',
  },

  assessment: {
    questions: [
      {
        id: 'mg7-005-assess-1',
        type: 'choice',
        text: 'Turn [1, 0] a quarter turn clockwise on screen.',
        options: ['[0, 1]', '[0, −1]', '[−1, 0]', '[1, 1]'],
        answer: '[0, 1]',
        hint: 'Right becomes down.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg7-005-quiz-1',
      type: 'choice',
      text: 'What does [x, y] → [−y, x] do on screen?',
      options: [
        'A quarter turn clockwise',
        'A quarter turn anticlockwise',
        'A flip',
        'A half turn',
      ],
      answer: 'A quarter turn clockwise',
      hints: ['y grows downwards.'],
      reviewSection: 'Intuition — the prediction paragraph',
    },
    {
      id: 'mg7-005-quiz-2',
      type: 'choice',
      text: 'Turn [0, −1].',
      options: ['[1, 0]', '[−1, 0]', '[0, 1]', '[0, −1]'],
      answer: '[1, 0]',
      hints: ['−(−1) = 1.'],
      reviewSection: 'Examples — Turning the T',
    },
    {
      id: 'mg7-005-quiz-3',
      type: 'choice',
      text: 'Which kicks does rotate() try, in order?',
      options: ['0, −1, 1, −2, 2', '1, 2, 3', '−2, 2', '0 only'],
      answer: '0, −1, 1, −2, 2',
      hints: ['Smallest nudge first.'],
      reviewSection: 'Intuition — Procedure',
    },
    {
      id: 'mg7-005-quiz-4',
      type: 'choice',
      text: 'The rotation matrix entries for 90°?',
      options: [
        'cos = 0, sin = 1',
        'cos = 1, sin = 0',
        'cos = sin = 0.707',
        'cos = −1, sin = 0',
      ],
      answer: 'cos = 0, sin = 1',
      hints: ['90°.'],
      reviewSection: 'Under the hood — the matrix',
    },
    {
      id: 'mg7-005-quiz-5',
      type: 'choice',
      text: 'Which piece should NOT turn?',
      options: ['O', 'T', 'I', 'L'],
      answer: 'O',
      hints: ['It looks the same and would wobble.'],
      reviewSection: 'Intuition — the O paragraph',
    },
    {
      id: 'mg7-005-quiz-6',
      type: 'choice',
      text: 'Four quarter turns of any cell give what?',
      options: ['The same cell', 'Its mirror', 'Zero', 'A half turn'],
      answer: 'The same cell',
      hints: ['R⁴ is the identity.'],
      reviewSection: 'Rigor — R⁴',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg7-005-1',
      label: 'Read the quarter-turn rule',
      type: 'read',
    },
    {
      id: 'cp-mg7-005-2',
      label: 'Read why it is clockwise on screen',
      type: 'read',
    },
    {
      id: 'cp-mg7-005-3',
      label: 'Read the turning procedure',
      type: 'read',
    },
    {
      id: 'cp-mg7-005-4',
      label: 'Complete "Tetris 5: turning" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg7-005-5',
      label: 'Turn an I against each wall in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg7-005-6',
      label: 'Work through the T example',
      type: 'example',
    },
    {
      id: 'cp-mg7-005-7',
      label: 'Work through the kick example',
      type: 'example',
    },
    {
      id: 'cp-mg7-005-8',
      label: 'Attempt the pre-turned-T challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-7',
}
