export default {
  order: 4,

  id: 'mg1-004',

  slug: 'input-actions',

  title: 'Steering with Input Actions',

  subtitle: 'Move with the arrow keys or WASD, at the same speed in every direction, diagonals included.',

  tags: ['game-studio', 'input', 'vectors', 'normalization'],

  aliases: 'input actions keyboard arrow keys wasd move_left move_right input.vector direction normalize diagonal speed',

  timeToComplete: 30,

  coreConcept: 'Scripts ask about named actions instead of keys, and turn four of them into a direction of length 1, so moving by direction × speed × dt is equally fast in every direction.',

  prerequisites: ['mg1-003'],

  nextLesson: null,

  hook: {
    question: 'Hero moves 100 pixels a second when you hold →, and 100 when you hold ↓. How fast does it go when you hold both?',
    realWorldContext: 'Many early games let players move faster diagonally, and speedrunners still exploit it. Input actions and normalized directions are how every modern engine avoids it, and let players choose their keys.',
  },

  intuition: {
    prose: [
      'Hold → and Hero should go right. Write the direction as two numbers: (1, 0) means one step right and none down. Holding ↓ gives (0, 1). Moving by direction × 100 × dt goes 100 pixels a second either way.',
      'Before reading on, predict: hold → and ↓ together, the direction is (1, 1). How far is that in one second at speed 100? Each second Hero goes 100 right and 100 down. That is the diagonal of a 100-by-100 square: about 141 pixels. Diagonals are 41% faster.',
      'The length of a direction (x, y) is $\\sqrt{x^2 + y^2}$, by Pythagoras. (1, 0) has length 1, but (1, 1) has length $\\sqrt{2} \\approx 1.414$. To fix it, divide each number by the length: (1, 1) becomes (0.707, 0.707), which has length 1. Making a direction length 1 is called **normalizing** it.',
      "Scripts should not ask about keys either. An **input action** is a name, such as `move_left`, bound to keys: ← and A. The script asks `input.isPressed('move_left')`, and a player can rebind the keys in **Project › Project settings…** without the script changing.",
      "Game Studio does both jobs in one call: `input.vector('move_left', 'move_right', 'move_up', 'move_down')` looks at the four actions and gives a direction already normalized, or (0, 0) when no key is held. `direction.scale(this.speed * dt)` turns it into this frame's step.",
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Steer a node with the keyboard',
        body: "Step 1. Open the node's script; keep the speed field (pixels per second).\nStep 2. In update(dt), get a direction: const direction = input.vector('move_left', 'move_right', 'move_up', 'move_down');\nStep 3. Turn it into this frame's step: direction.scale(this.speed * dt).\nStep 4. Add the step to the position: this.position = this.position.add(direction.scale(this.speed * dt));\nStep 5. Run and check: no key, no movement; each arrow, 100 px/s; two arrows together, still 100 px/s.",
      },
      {
        type: 'warning',
        title: 'Adding two directions yourself',
        body: 'If you build the direction by adding (1, 0) and (0, 1) for two held keys, you get (1, 1), of length 1.414. Normalize the sum, or use input.vector, which already does.',
      },
      {
        type: 'definition',
        title: 'Vector',
        body: "A vector is a pair of numbers (x, y) treated as one thing: a position, a step or a direction. Game Studio's Vec2 has add, scale, length and normalized, so you can work with whole vectors at once.",
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Steer Hero with the keyboard',
        props: {
          task: 'input-actions',
          lesson: 'mg1-004',
          checkpoint: 'cp-mg1-004-4',
        },
      },
    ],
  },

  math: {
    prose: [
      "**Under the hood (optional).** A direction is a vector $\\mathbf{d} = (x, y)$. Its length is $|\\mathbf{d}| = \\sqrt{x^2 + y^2}$: the two numbers are the sides of a right-angled triangle, and the length is its hypotenuse, by Pythagoras' theorem.",
      'Moving by $\\mathbf{d} \\cdot v \\cdot dt$ each frame covers $|\\mathbf{d}| \\cdot v$ pixels per second, because scaling a vector by a number scales its length by that number. With $|\\mathbf{d}| = 1$ that is exactly $v$. With $\\mathbf{d} = (1, 1)$ it is $\\sqrt{2}\\, v \\approx 141$ at $v = 100$.',
      'Normalizing divides by the length: $\\hat{\\mathbf{d}} = \\mathbf{d} / |\\mathbf{d}|$. Its length is $|\\mathbf{d}| / |\\mathbf{d}| = 1$. For $(1, 1)$: $(1/\\sqrt{2}, 1/\\sqrt{2}) \\approx (0.707, 0.707)$, and $0.707^2 + 0.707^2 = 0.5 + 0.5 = 1$.',
      "The zero vector $(0, 0)$ has length 0 and cannot be divided by it. input.vector returns $(0, 0)$ when no key is held, and Vec2's normalized() does the same for a zero vector, so standing still never divides by zero.",
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, normalization maps every non-zero vector $\\mathbf{d}$ to the unit vector $\\mathbf{d}/|\\mathbf{d}|$ with the same direction; it is undefined at $\\mathbf{0}$, which input.vector handles by returning $\\mathbf{0}$.',
      'The invariant is direction: $\\mathbf{d}$ and $\\hat{\\mathbf{d}}$ point the same way, because one is a positive multiple of the other. Only the length changes, to 1, which is what makes speed the same in every direction.',
      'Geometrically, the eight directions from four keys lie on a square of side 2 around the origin; normalizing pulls the four corners in to the unit circle, so all eight lie on it.',
      'A gamepad stick gives directions anywhere inside the circle, with length meaning "how far pushed". There, a length below 1 is wanted (walking slowly), and only lengths above 1 are reduced: clamping instead of normalizing. Chapter 2\'s velocity uses the same vector operations.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg1-004-ex1',
      title: 'The length of a diagonal',
      difficulty: 'easy',
      problem: 'How long is the direction (1, 1)?',
      steps: [
        {
          expression: '|(1, 1)| = \\sqrt{1^2 + 1^2}',
          annotation: 'The two numbers are the sides of a right-angled triangle; the length is the long side.',
          strategyTitle: 'Step 1: Use Pythagoras',
        },
        {
          expression: '= \\sqrt{2} \\approx 1.414',
          annotation: 'Longer than 1, so moving by it is about 41% faster than moving by (1, 0).',
          strategyTitle: 'Step 2: Work it out',
        },
      ],
      answer: 'The direction (1, 1) is about 1.414 long, not 1.',
    },
    {
      id: 'mg1-004-ex2',
      title: 'Normalizing the diagonal',
      difficulty: 'medium',
      problem: 'Normalize (1, 1), and check that the result has length 1.',
      steps: [
        {
          expression: '\\tfrac{(1, 1)}{\\sqrt{2}} = (0.707, 0.707)',
          annotation: 'Divide each number by the length, 1.414.',
          strategyTitle: 'Step 1: Divide by the length',
        },
        {
          expression: '\\sqrt{0.707^2 + 0.707^2} = \\sqrt{0.5 + 0.5} = 1',
          annotation: 'Measuring again gives 1, so this direction moves at exactly the speed.',
          strategyTitle: 'Step 2: Check the length',
        },
      ],
      answer: '(1, 1) normalized is about (0.707, 0.707), which has length 1.',
    },
    {
      id: 'mg1-004-ex3',
      title: 'A step for one frame',
      difficulty: 'hard',
      problem: '→ and ↓ are held. Speed is 100 and dt is 1/60. What does `direction.scale(this.speed * dt)` give, and how far is that step?',
      steps: [
        {
          expression: '\\mathbf{d} = (0.707, 0.707)',
          annotation: 'input.vector gives the normalized direction for → and ↓ together.',
          strategyTitle: 'Step 1: The direction',
        },
        {
          expression: '100 \\times \\tfrac{1}{60} = 1.667',
          annotation: "speed × dt is this frame's distance.",
          strategyTitle: "Step 2: This frame's distance",
        },
        {
          expression: '(0.707, 0.707) \\times 1.667 = (1.18, 1.18),\\quad |(1.18, 1.18)| = 1.667',
          annotation: 'Scaling the direction by the distance gives the step, and its length is that distance.',
          strategyTitle: 'Step 3: Scale the direction',
        },
      ],
      answer: 'The step is about (1.18, 1.18), a distance of 1.667 pixels, the same as a straight step.',
    },
  ],

  challenges: [
    {
      id: 'mg1-004-ch1',
      title: 'Straight left',
      difficulty: 'easy',
      problem: 'Which direction does input.vector give when only ← is held, and how long is it?',
      hint: 'Left is negative x.',
      answer: 'It gives (−1, 0), which has length 1.',
      walkthrough: [
        {
          expression: '|(-1, 0)| = \\sqrt{1 + 0} = 1',
          annotation: 'A single key already gives a direction of length 1.',
        },
      ],
    },
    {
      id: 'mg1-004-ch2',
      title: 'Up and left',
      difficulty: 'medium',
      problem: 'Normalize (−1, −1). Which way does it point on screen?',
      hint: 'Divide by the length, then remember that negative y is up.',
      answer: 'It is about (−0.707, −0.707), pointing up and to the left.',
      walkthrough: [
        {
          expression: '\\tfrac{(-1, -1)}{\\sqrt{2}} \\approx (-0.707, -0.707)',
          annotation: 'Negative x is left and negative y is up the screen.',
        },
      ],
    },
    {
      id: 'mg1-004-ch3',
      title: 'Debug the speedy diagonal',
      difficulty: 'hard',
      problem: "A script builds the direction with input.axis('move_left', 'move_right') for x and input.axis('move_up', 'move_down') for y, then moves by it times speed × dt. The task says diagonals go 141 px a second. Fix it.",
      hint: 'input.axis gives each number separately; together they make (1, 1) on a diagonal.',
      answer: 'Normalize the direction before scaling it (new Vec2(x, y).normalized()), or use input.vector, which returns it normalized; the diagonal then moves 100 px a second.',
      walkthrough: [
        {
          expression: '|(1, 1)| = 1.414 \\;\\Rightarrow\\; \\tfrac{(1, 1)}{1.414} = (0.707, 0.707)',
          annotation: 'Dividing by the length brings the diagonal back to length 1.',
        },
      ],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'input action',
        meaning: 'A name such as move_left bound to keys; scripts ask about the name, players choose the keys.',
      },
      {
        symbol: 'input.vector(left, right, up, down)',
        meaning: 'The direction the four actions point, normalized, or (0, 0) when none is held.',
      },
      {
        symbol: 'vector (x, y)',
        meaning: 'Two numbers treated as one, for a position, a step or a direction.',
      },
      {
        symbol: '|d| = √(x² + y²)',
        meaning: "A vector's length, the hypotenuse of the triangle its two numbers make.",
      },
      {
        symbol: 'normalize',
        meaning: 'Divide a vector by its length so it keeps its direction and has length 1.',
      },
    ],
    rulesOfThumb: [
      'Ask about actions, never keys, so players can rebind them.',
      'A direction should be length 1 before you multiply it by a speed.',
      "If diagonals feel fast, print the direction's length; 1.414 means it was not normalized.",
      'Build the step as direction × speed × dt, then add it to the position.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Holding two arrow keys moves at the same speed as one, without doing anything.',
      whyStudentsThinkIt: 'Each key is set up to move 100 px a second, so both together feel like 100 too.',
      correctionExample: '(1, 1) × 100 moves 100 right and 100 down each second, which is 141 px along the diagonal.',
      contrastCase: 'Normalized, (0.707, 0.707) × 100 moves 70.7 right and 70.7 down, which is 100 px along the diagonal.',
    },
    {
      falseBelief: 'Normalizing changes which way the vector points.',
      whyStudentsThinkIt: 'All the numbers change, so it seems the direction must have changed too.',
      correctionExample: '(2, 0) normalized is (1, 0); both point right, only the length changed from 2 to 1.',
      contrastCase: 'Swapping x and y, (0, 2), would change the direction; dividing both by the same number never does.',
    },
  ],

  transferPrompts: [
    {
      situation: 'An enemy should walk towards the player at 80 px a second, from wherever it is.',
      competingTechniques: [
        'Normalize (player − enemy) and scale it by 80 × dt',
        "Add (player − enemy) × dt to the enemy's position",
      ],
      whyThisTechniqueWins: '(player − enemy) is longer when the player is far away, so using it directly makes the enemy faster at a distance; normalizing keeps 80 px a second at any distance.',
    },
    {
      situation: 'Players ask to use I, J, K and L to move instead of the arrow keys.',
      competingTechniques: [
        'Bind the keys to the existing actions in Project settings',
        'Change every script to check for the new keys',
      ],
      whyThisTechniqueWins: 'Scripts ask about move_left and friends, so binding new keys to those actions needs no code change.',
    },
  ],

  debugging: [
    {
      commonError: 'Adding the direction to the position without speed × dt.',
      symptom: 'Hero shoots off the screen, moving one pixel every frame (60 px/s at 60 fps, more on fast screens).',
      whyItHappened: 'A direction is length 1; without scaling it is a step of one pixel per frame.',
      repairStrategy: 'Scale it first, this.position.add(direction.scale(this.speed * dt)).',
    },
    {
      commonError: "Misspelling an action, input.vector('move_left', 'move_rigth', …).",
      symptom: 'Game Studio reports there is no input action "move_rigth", and points to the Input map.',
      whyItHappened: 'Actions are looked up by name; a misspelt name does not exist.',
      repairStrategy: 'Copy the name from Project › Project settings… › Input map.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Write a script that steers a node with input.vector at a given speed.',
    explainVerbally: 'Explain why an unnormalized diagonal is about 41% faster.',
    detectIncorrectApplication: 'Recognise a direction that is not length 1 from its symptom and fix it.',
    transferToUnfamiliar: 'Normalize any vector, such as the direction from an enemy to the player.',
  },

  assessment: {
    questions: [
      {
        id: 'mg1-004-assess-1',
        type: 'choice',
        text: 'What is the length of (0.6, 0.8)?',
        options: ['1', '1.4', '0.7', '0.2'],
        answer: '1',
        hint: '0.36 + 0.64 = 1, and the square root of 1 is 1.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg1-004-quiz-1',
      type: 'choice',
      text: 'Unnormalized, how fast does Hero go diagonally with speed 100?',
      options: [
        'About 141 pixels per second',
        '100 pixels per second',
        '200 pixels per second',
        'About 70.7 pixels per second',
      ],
      answer: 'About 141 pixels per second',
      hints: [
        'The length of (1, 1) is √2 ≈ 1.414. 200 is the near-miss of adding the two speeds.',
      ],
      reviewSection: 'Intuition — the prediction paragraph',
    },
    {
      id: 'mg1-004-quiz-2',
      type: 'choice',
      text: 'What does normalizing a vector do?',
      options: [
        'Keeps its direction and makes its length 1',
        'Makes both numbers equal',
        'Rounds both numbers to whole pixels',
        'Turns it to point right',
      ],
      answer: 'Keeps its direction and makes its length 1',
      hints: ['Divide by the length.'],
      reviewSection: 'Intuition — Definition: Vector',
    },
    {
      id: 'mg1-004-quiz-3',
      type: 'choice',
      text: 'Why do scripts ask about input actions instead of keys?',
      options: [
        'So players can change the keys without changing the scripts',
        'Because keys cannot be read in JavaScript',
        'Because actions are faster',
        'So that diagonals are normalized',
      ],
      answer: 'So players can change the keys without changing the scripts',
      hints: ['Actions are names bound to keys in Project settings.'],
      reviewSection: 'Intuition — the input action paragraph',
    },
    {
      id: 'mg1-004-quiz-4',
      type: 'choice',
      text: 'What does input.vector return when no key is held?',
      options: ['(0, 0)', '(1, 0)', 'An error', '(1, 1)'],
      answer: '(0, 0)',
      hints: [
        'Standing still is the zero vector, which is not normalized because it cannot be.',
      ],
      reviewSection: 'Under the hood — the zero vector',
    },
    {
      id: 'mg1-004-quiz-5',
      type: 'choice',
      text: 'Which of these directions would NOT give the speed you set if scaled by speed × dt?',
      options: ['(1, 1)', '(0.707, 0.707)', '(0, −1)', '(0.6, 0.8)'],
      answer: '(1, 1)',
      hints: ['Work out each length; only one is not 1.'],
      reviewSection: 'Examples — The length of a diagonal',
    },
    {
      id: 'mg1-004-quiz-6',
      type: 'choice',
      text: 'Which line steers Hero correctly?',
      options: [
        "this.position = this.position.add(input.vector('move_left', 'move_right', 'move_up', 'move_down').scale(this.speed * dt))",
        "this.position = this.position.add(input.vector('move_left', 'move_right', 'move_up', 'move_down'))",
        "this.position = input.vector('move_left', 'move_right', 'move_up', 'move_down').scale(this.speed * dt)",
        "this.position = this.position.add(input.vector('move_left', 'move_right', 'move_up', 'move_down').scale(this.speed))",
      ],
      answer: "this.position = this.position.add(input.vector('move_left', 'move_right', 'move_up', 'move_down').scale(this.speed * dt))",
      hints: [
        'It must add a step to the old position, and the step is direction × speed × dt.',
      ],
      reviewSection: 'Intuition — Procedure: Steer a node with the keyboard',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg1-004-1',
      label: 'Read the diagonal prediction',
      type: 'read',
    },
    {
      id: 'cp-mg1-004-2',
      label: 'Read how normalizing fixes the diagonal',
      type: 'read',
    },
    {
      id: 'cp-mg1-004-3',
      label: 'Read what input actions are for',
      type: 'read',
    },
    {
      id: 'cp-mg1-004-4',
      label: 'Complete "Steer Hero with the keyboard" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg1-004-5',
      label: 'Bind I, J, K and L to the move actions in Project settings and try them',
      type: 'lab',
    },
    {
      id: 'cp-mg1-004-6',
      label: 'Work through the normalizing example',
      type: 'example',
    },
    {
      id: 'cp-mg1-004-7',
      label: 'Work through the one-frame step example',
      type: 'example',
    },
    {
      id: 'cp-mg1-004-8',
      label: 'Attempt the speedy-diagonal debugging challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-1',
}
