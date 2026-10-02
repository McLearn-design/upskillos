export default {
  order: 4,

  id: 'mg2-004',

  slug: 'rigid-bodies-and-bouncing',

  title: 'Rigid Bodies and Bouncing',

  subtitle: 'A ball that falls and bounces by itself, with no script.',

  tags: ['game-studio', 'physics', 'rigid-body'],

  aliases: 'rigidbody2d bounce restitution gravityscale reflect velocity ball',

  timeToComplete: 25,

  coreConcept: 'A RigidBody2D moves by itself: the engine adds gravity to its velocity, moves it, and when it hits a solid body, reflects the part of its velocity going into the surface, keeping a fraction set by bounce.',

  prerequisites: ['mg2-003'],

  nextLesson: 'mg2-005',

  hook: {
    question: 'You drop a ball from 300 pixels above the floor, with bounce 0.8. How high does it come back up? And the time after that?',
    realWorldContext: 'Balls, crates, rubble and ragdolls move by physics rather than by script. A designer tunes them with a few numbers, such as bounce and gravity scale, instead of writing their motion.',
  },

  intuition: {
    prose: [
      'Drop a ball from 300 pixels above the floor. Gravity speeds it up until it hits at about 767 pixels a second. With bounce 0.8 it leaves the floor at 0.8 × 767 ≈ 614 pixels a second, upwards.',
      'Before reading on, predict: how high does it rise? Height grows with the square of speed (lesson 2.2), so 0.8 of the speed gives 0.8² = 0.64 of the height: 192 pixels. Then 0.64 × 192 ≈ 123, then 79.',
      'The ball is a **RigidBody2D**. You do not write its motion: the engine adds gravity × dt to its velocity every step, moves it, and handles hits. Its `gravityScale` multiplies gravity for it (0 floats).',
      '`bounce` is how much speed it keeps when it hits: 1 leaves as fast as it came, 0 stops dead, 0.8 keeps most of it.',
      'It still needs a shape to hit anything: a CollisionShape2D, here a circle of size 26 for a ball 26 pixels across.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Make a bouncing ball',
        body: "Step 1. Add a RigidBody2D (Ball) where it should start.\nStep 2. Under it, add a CollisionShape2D (shape circle, size the ball's width) and a Sprite2D.\nStep 3. Make sure there is a floor: a StaticBody2D with a shape.\nStep 4. Set bounce in the Inspector: 0 stops dead, 1 bounces back as fast.\nStep 5. Run, and watch each bounce come back lower by bounce².",
      },
      {
        type: 'warning',
        title: 'Do not move a rigid body yourself',
        body: "Setting a RigidBody2D's position every frame fights the engine: it jitters and passes through walls. Set its velocity once (a kick), or change gravityScale and bounce, and let physics move it.",
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'A bouncing ball',
        props: {
          task: 'bouncing-ball',
          lesson: 'mg2-004',
          checkpoint: 'cp-mg2-004-4',
        },
      },
    ],
  },

  math: {
    prose: [
      "**Under the hood (optional).** Split the velocity at a hit into the part along the surface normal $\\mathbf{n}$ (length 1, pointing out of the surface) and the rest. The normal part is $(\\mathbf{v} \\cdot \\mathbf{n})\\,\\mathbf{n}$. A bounce with coefficient $e$ reverses it and keeps a fraction $e$: $\\mathbf{v}' = \\mathbf{v} - (1 + e)(\\mathbf{v} \\cdot \\mathbf{n})\\,\\mathbf{n}$.",
      "Falling onto a floor, $\\mathbf{n} = (0, -1)$ and $\\mathbf{v} = (0, 767)$, so $\\mathbf{v} \\cdot \\mathbf{n} = -767$ and $\\mathbf{v}' = (0, 767) - 1.8 \\times (-767)(0, -1) = (0, -614)$. With $e = 0$ the normal speed becomes 0 (it slides, as moveAndSlide does); with $e = 1$ it is fully reversed.",
      'The heights fall geometrically: $h, e^2 h, e^4 h, \\ldots$ The total distance travelled is $h + 2e^2 h + 2e^4 h + \\cdots = h\\,\\tfrac{1 + e^2}{1 - e^2}$. For $h = 300$ and $e = 0.8$: $300 \\times \\tfrac{1.64}{0.36} \\approx 1367$ px before it comes to rest.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, $e$ is the coefficient of restitution, the ratio of the normal speed after an impact to before. The tangential part of the velocity is unchanged (no friction in this model).',
      'The invariant through a hit is the tangential velocity, and with $e = 1$ the speed too: a perfectly elastic bounce loses no energy.',
      "Geometrically, $\\mathbf{v}'$ with $e = 1$ is $\\mathbf{v}$ mirrored in the surface's line: the angle out equals the angle in, as with a ball off a wall or light off a mirror.",
      "Real engines add friction (which slows the tangential part), spin, and mass, so that two moving bodies share an impact. Breakout's ball uses exactly $e = 1$ and no gravity.",
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg2-004-ex1',
      title: 'The second height',
      difficulty: 'easy',
      problem: 'A ball dropped from 300 px with bounce 0.8. How high is the first bounce?',
      steps: [
        {
          expression: '0.8^2 \\times 300 = 0.64 \\times 300 = 192',
          annotation: 'Keeping 0.8 of the speed keeps 0.64 of the height.',
          strategyTitle: 'Step 1: Square the bounce',
        },
      ],
      answer: 'It bounces back up 192 pixels.',
    },
    {
      id: 'mg2-004-ex2',
      title: 'Speed at the floor',
      difficulty: 'medium',
      problem: 'How fast is a ball dropped from 300 px moving at the floor, and how fast does it leave with bounce 0.8?',
      steps: [
        {
          expression: 'v = \\sqrt{2 g h} = \\sqrt{2 \\times 980 \\times 300} \\approx 767',
          annotation: 'The jump formula backwards.',
          strategyTitle: 'Step 1: Speed at the floor',
        },
        {
          expression: '0.8 \\times 767 \\approx 614',
          annotation: 'Bounce keeps that fraction of the speed into the floor.',
          strategyTitle: 'Step 2: Speed leaving',
        },
      ],
      answer: 'It hits at about 767 px/s and leaves at about 614 px/s.',
    },
    {
      id: 'mg2-004-ex3',
      title: 'Off a slanted wall',
      difficulty: 'hard',
      problem: 'A ball moving (300, 0) hits a wall whose normal is (−0.6, −0.8), with bounce 1. What is its new velocity?',
      steps: [
        {
          expression: '\\mathbf{v} \\cdot \\mathbf{n} = 300 \\times (-0.6) = -180',
          annotation: 'The part going into the wall.',
          strategyTitle: 'Step 1: Into the wall',
        },
        {
          expression: "\\mathbf{v}' = (300, 0) - 2 \\times (-180)(-0.6, -0.8) = (300, 0) - (216, 288) = (84, -288)",
          annotation: 'With e = 1, subtract twice the normal part.',
          strategyTitle: 'Step 2: Reflect',
        },
      ],
      answer: 'It leaves at (84, −288), still 300 px/s fast, heading up and slightly right.',
    },
  ],

  challenges: [
    {
      id: 'mg2-004-ch1',
      title: 'Half bounce',
      difficulty: 'easy',
      problem: 'Bounce 0.5, dropped from 200 px. How high is the first bounce?',
      hint: 'Square the bounce.',
      answer: '50 pixels, because 0.5² × 200 = 50.',
      walkthrough: [
        {
          expression: '0.25 \\times 200 = 50',
          annotation: 'A quarter of the height.',
        },
      ],
    },
    {
      id: 'mg2-004-ch2',
      title: 'Which bounce?',
      difficulty: 'medium',
      problem: 'A ball dropped from 400 px first bounces to 100 px. What is its bounce?',
      hint: 'The height ratio is bounce squared.',
      answer: '0.5, because 100/400 = 0.25 and √0.25 = 0.5.',
      walkthrough: [],
    },
    {
      id: 'mg2-004-ch3',
      title: 'Debug the jittery ball',
      difficulty: 'hard',
      problem: "A learner's ball shakes and sometimes falls through the floor. Its script sets this.position.y += 5 every frame. What is wrong?",
      hint: 'Who moves a rigid body?',
      answer: 'The script fights the engine, which also moves the ball; remove the script line and let gravity move it, or set velocity once.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'RigidBody2D',
        meaning: 'A body the engine moves itself, with gravity, velocity and bounces.',
      },
      {
        symbol: 'bounce',
        meaning: 'The fraction of speed into a surface kept on a hit: 0 stops, 1 bounces fully.',
      },
      {
        symbol: 'gravityScale',
        meaning: 'Multiplies gravity for this body: 0 floats, 2 falls twice as hard.',
      },
      {
        symbol: 'v′ = v − (1+e)(v·n)n',
        meaning: 'The velocity after a bounce off a surface with normal n.',
      },
      {
        symbol: 'e²',
        meaning: 'The fraction of the height each bounce keeps.',
      },
    ],
    rulesOfThumb: [
      'Let physics move rigid bodies; kick them with velocity, do not drag them.',
      'Each bounce keeps bounce² of the height.',
      'Use bounce 1 and gravityScale 0 for a Breakout ball.',
      'Give it a circle shape if it is round, so it rolls off corners properly.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Bounce 0.5 keeps half the height.',
      whyStudentsThinkIt: 'The number looks like a fraction of everything.',
      correctionExample: 'Dropped from 200 px with bounce 0.5, it rises to 50 px, a quarter.',
      contrastCase: 'Bounce is a fraction of speed, and height goes with speed squared.',
    },
    {
      falseBelief: 'A rigid body needs a script to fall.',
      whyStudentsThinkIt: 'The CharacterBody2D needed gravity in its script.',
      correctionExample: 'A RigidBody2D with no script falls and bounces as soon as the game runs.',
      contrastCase: 'A CharacterBody2D only moves when its script calls moveAndSlide.',
    },
  ],

  transferPrompts: [
    {
      situation: 'Crates should tumble off a ledge when pushed.',
      competingTechniques: ['RigidBody2D crates', 'CharacterBody2D crates with gravity scripts'],
      whyThisTechniqueWins: "Rigid bodies fall and bounce on their own; scripting each crate's fall is work the engine already does.",
    },
    {
      situation: 'A pinball must keep its speed off every wall.',
      competingTechniques: ['bounce 1', 'bounce 0.8'],
      whyThisTechniqueWins: 'With bounce 1 the reflected speed equals the incoming speed; 0.8 slows it every hit.',
    },
  ],

  debugging: [
    {
      commonError: 'Forgetting a floor under the ball.',
      symptom: 'The ball falls off the bottom of the screen and is gone.',
      whyItHappened: 'Nothing solid is there to hit.',
      repairStrategy: 'Add a StaticBody2D floor with a shape wide enough.',
    },
    {
      commonError: "A circle shape's size set to the radius instead of the width.",
      symptom: 'The ball sinks halfway into the floor before it bounces.',
      whyItHappened: "The shape is half the picture's size.",
      repairStrategy: "Set the circle's size to the ball's full width (26 for a 26-pixel ball).",
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Make a rigid body fall and bounce, and predict its bounce heights.',
    explainVerbally: 'Explain why each bounce keeps bounce² of the height.',
    detectIncorrectApplication: 'Spot scripts that fight the physics of a rigid body.',
    transferToUnfamiliar: 'Reflect a velocity off any slanted surface.',
  },

  assessment: {
    questions: [
      {
        id: 'mg2-004-assess-1',
        type: 'choice',
        text: 'Bounce 0.8, dropped from 300 px. How high is the first bounce?',
        options: ['192 px', '240 px', '300 px', '150 px'],
        answer: '192 px',
        hint: '0.8² × 300.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg2-004-quiz-1',
      type: 'choice',
      text: 'What does bounce 0 do?',
      options: [
        'Stops the speed into the surface dead',
        'Bounces back fully',
        'Makes it fall faster',
        'Removes gravity',
      ],
      answer: 'Stops the speed into the surface dead',
      hints: ['It keeps none of it.'],
      reviewSection: 'Intuition — the bounce paragraph',
    },
    {
      id: 'mg2-004-quiz-2',
      type: 'choice',
      text: 'Bounce 0.5, dropped from 400 px. First bounce?',
      options: ['100 px', '200 px', '50 px', '400 px'],
      answer: '100 px',
      hints: ['0.25 of the height; 200 is the near-miss of halving the height.'],
      reviewSection: 'Examples — The second height',
    },
    {
      id: 'mg2-004-quiz-3',
      type: 'choice',
      text: 'What does gravityScale 0 do?',
      options: [
        'The body floats: no gravity for it',
        'It falls twice as fast',
        'It cannot bounce',
        'It stops moving',
      ],
      answer: 'The body floats: no gravity for it',
      hints: ['It multiplies gravity.'],
      reviewSection: 'Intuition — the RigidBody2D paragraph',
    },
    {
      id: 'mg2-004-quiz-4',
      type: 'choice',
      text: 'With e = 1, a ball hits a wall. What stays the same?',
      options: ['Its speed', 'Its direction', 'Its x velocity always', 'Nothing'],
      answer: 'Its speed',
      hints: [
        'A perfectly elastic bounce mirrors the direction and keeps the speed.',
      ],
      reviewSection: 'Rigor — the mirror',
    },
    {
      id: 'mg2-004-quiz-5',
      type: 'choice',
      text: 'Which of these should NOT be done to a RigidBody2D?',
      options: [
        'Set its position every frame',
        'Set its velocity once to kick it',
        'Change its bounce',
        'Change its gravityScale',
      ],
      answer: 'Set its position every frame',
      hints: ['It fights the engine.'],
      reviewSection: 'Intuition — Warning: do not move a rigid body yourself',
    },
    {
      id: 'mg2-004-quiz-6',
      type: 'choice',
      text: 'Velocity (0, 500) into a floor with normal (0, −1), bounce 0.6. New velocity?',
      options: ['(0, −300)', '(0, −500)', '(0, 300)', '(0, −800)'],
      answer: '(0, −300)',
      hints: ['v − 1.6 × (−500)(0, −1) = (0, −300).'],
      reviewSection: 'Under the hood — the reflection',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg2-004-1',
      label: 'Read how bounce heights shrink',
      type: 'read',
    },
    {
      id: 'cp-mg2-004-2',
      label: 'Read what a rigid body does by itself',
      type: 'read',
    },
    {
      id: 'cp-mg2-004-3',
      label: 'Read the bouncing-ball procedure',
      type: 'read',
    },
    {
      id: 'cp-mg2-004-4',
      label: 'Complete "A bouncing ball" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg2-004-5',
      label: 'Try bounce 1 and 0.5 in Game Studio and compare',
      type: 'lab',
    },
    {
      id: 'cp-mg2-004-6',
      label: 'Work through the speed-at-the-floor example',
      type: 'example',
    },
    {
      id: 'cp-mg2-004-7',
      label: 'Work through the slanted-wall example',
      type: 'example',
    },
    {
      id: 'cp-mg2-004-8',
      label: 'Attempt the jittery-ball challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-2',
}
