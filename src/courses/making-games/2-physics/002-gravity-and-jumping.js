export default {
  order: 2,

  id: 'mg2-002',

  slug: 'gravity-and-jumping',

  title: 'Gravity and Jumping',

  subtitle: 'Fall, land, walk and jump, and know exactly how high a jump goes.',

  tags: ['game-studio', 'physics', 'platformer'],

  aliases: 'gravity jump platformer isonfloor velocity y physics.gravity jump height v squared over 2g euler',

  timeToComplete: 30,

  coreConcept: 'Gravity is a steady change in vertical velocity: every physics step adds gravity × dt to velocity.y. A jump sets velocity.y to a negative number once, and only from the floor; gravity does the rest.',

  prerequisites: ['mg2-001'],

  nextLesson: 'mg2-003',

  hook: {
    question: 'Your player jumps by setting its upward speed to 360 pixels a second, with gravity 980. Can it reach a platform 64 pixels up? What about 70?',
    realWorldContext: 'Platformer designers place every ledge using exactly this sum. A jump that misses a ledge by three pixels is the most common level-design bug, and it is arithmetic, not luck.',
  },

  intuition: {
    prose: [
      'Start with Player falling. Each physics step lasts 1/60 of a second. Gravity is 980 pixels per second per second, so each step adds 980 × 1/60 ≈ 16.3 to velocity.y. After one second of falling it is moving down at 980 pixels a second.',
      'A jump sets velocity.y to −360 (negative is up). Every step, gravity adds 16.3 back. Before reading on, predict: how many steps until it stops rising? 360 ÷ 16.3 ≈ 22 steps, about 0.37 seconds. Then it falls.',
      "While rising it slows steadily, so it covers its average speed, 180 px/s, for 0.37 s: about 66 pixels. That is the jump's height. A 64-pixel ledge is reachable; a 70-pixel one is not.",
      "The player must jump only from the floor. After moveAndSlide(), `this.isOnFloor()` says whether the body is standing on something. And `input.isJustPressed('jump')` is true only on the step Space goes down.",
      "Left and right come from `input.axis('move_left', 'move_right')`, which gives −1, 0 or 1. Multiply by the speed for velocity.x; ↑ and ↓ no longer move the player, because gravity owns velocity.y.",
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Make a platformer player',
        body: "Step 1. In physicsUpdate(dt), read the velocity: const v = this.velocity.\nStep 2. Walking: v.x = input.axis('move_left', 'move_right') * this.speed.\nStep 3. Gravity: v.y += physics.gravity * dt.\nStep 4. Jumping: if (input.isJustPressed('jump') && this.isOnFloor()) v.y = -this.jumpSpeed.\nStep 5. Write it back and move: this.velocity = v; this.moveAndSlide().\nStep 6. Run: Player should land, walk, and jump only from the floor.",
      },
      {
        type: 'warning',
        title: 'Jumping in mid-air',
        body: 'Without the isOnFloor() test, holding or tapping Space in the air jumps again and again: the player flies. Without isJustPressed, holding Space jumps again the moment it lands.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Gravity and jumping',
        props: {
          task: 'gravity-and-jumping',
          lesson: 'mg2-002',
          checkpoint: 'cp-mg2-002-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** With constant gravity $g$, velocity changes at a steady rate: $v(t) = v_0 + g t$. Taking up as negative, a jump starts at $v_0 = -360$ and stops rising when $v = 0$, at $t = 360 / 980 \\approx 0.367$ s.',
      'The height is the area under the speed: a triangle of base $t$ and height $v_0$, so $h = \\tfrac{1}{2} v_0 t = \\tfrac{v_0^2}{2g}$. With $v_0 = 360$ and $g = 980$: $h = \\tfrac{129600}{1960} \\approx 66.1$ px.',
      'The engine steps instead of flowing: each step adds $g\\,\\Delta t$ to $v$, then moves by $v\\,\\Delta t$. Rising, the steps move $\\Delta t\\,(360 - 16.3k)$ for $k = 1$ to 22. Adding them gives about 63.1 px. The stepped jump is about $v_0 \\Delta t / 2 \\approx 3$ px lower than the smooth one.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, the update $v_{n+1} = v_n + g\\Delta t$, $y_{n+1} = y_n + v_{n+1}\\Delta t$ is the semi-implicit Euler method. Its peak height is $\\Delta t \\sum_k (v_0 - k g \\Delta t)$, which approaches $v_0^2/2g$ as $\\Delta t \\to 0$.',
      'The fixed step is the invariant that makes jumps repeatable: at 1/60 s every time, the same jump reaches the same 63.1 px on every screen and every run.',
      'Geometrically, position against time is a parabola, a downward-opening curve whose top is the peak. The stepped version is a polygon inscribed in it.',
      'Real games bend these rules on purpose: stronger gravity when falling, a lower jump when Space is let go early, a few frames\' grace after walking off a ledge ("coyote time"). Each is a change to $g$ or $v$.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg2-002-ex1',
      title: 'Speed after half a second',
      difficulty: 'easy',
      problem: 'Player starts falling from rest. Gravity is 980. How fast is it moving after 0.5 s?',
      steps: [
        {
          expression: 'v = g t = 980 \\times 0.5 = 490',
          annotation: 'Gravity adds 980 px/s of downward speed every second.',
          strategyTitle: 'Step 1: Speed grows steadily',
        },
      ],
      answer: 'It is falling at 490 pixels per second.',
    },
    {
      id: 'mg2-002-ex2',
      title: 'How high a jump goes',
      difficulty: 'medium',
      problem: 'The jump speed is 360 and gravity 980. How high does the smooth jump go, and when does it peak?',
      steps: [
        {
          expression: 't = \\tfrac{v_0}{g} = \\tfrac{360}{980} \\approx 0.367\\ \\text{s}',
          annotation: 'It rises until gravity has taken all 360 px/s away.',
          strategyTitle: 'Step 1: Time to the top',
        },
        {
          expression: 'h = \\tfrac{v_0^2}{2g} = \\tfrac{360^2}{1960} \\approx 66.1\\ \\text{px}',
          annotation: 'The average rising speed, 180, times the rising time.',
          strategyTitle: 'Step 2: Height',
        },
      ],
      answer: 'It peaks after about 0.37 s, about 66 pixels up.',
    },
    {
      id: 'mg2-002-ex3',
      title: 'A jump for a given ledge',
      difficulty: 'hard',
      problem: 'A ledge is 96 pixels up. What jump speed reaches it with gravity 980, with 8 pixels to spare?',
      steps: [
        {
          expression: 'h = 96 + 8 = 104',
          annotation: 'Aim a little higher than the ledge, and remember the stepped jump is about 3 px lower.',
          strategyTitle: 'Step 1: The height wanted',
        },
        {
          expression: 'v_0 = \\sqrt{2 g h} = \\sqrt{2 \\times 980 \\times 104} \\approx 451',
          annotation: 'Rearranging h = v₀²/2g.',
          strategyTitle: 'Step 2: Solve for the speed',
        },
      ],
      answer: 'A jump speed of about 451 reaches 104 pixels, clearing the 96-pixel ledge.',
    },
  ],

  challenges: [
    {
      id: 'mg2-002-ch1',
      title: 'Double the speed',
      difficulty: 'easy',
      problem: 'If the jump speed doubles from 360 to 720, how many times higher is the jump?',
      hint: 'Height grows with the square of the speed.',
      answer: 'Four times higher, about 264 pixels, because h = v₀²/2g.',
      walkthrough: [
        {
          expression: '\\tfrac{720^2}{360^2} = 4',
          annotation: 'Doubling the speed quadruples the height.',
        },
      ],
    },
    {
      id: 'mg2-002-ch2',
      title: 'The moon',
      difficulty: 'medium',
      problem: 'With gravity 160 instead of 980, how high does a 360 jump go?',
      hint: 'Use h = v₀²/2g.',
      answer: 'About 405 pixels, because 129600 ÷ 320 = 405.',
      walkthrough: [],
    },
    {
      id: 'mg2-002-ch3',
      title: 'Debug the flying player',
      difficulty: 'hard',
      problem: "A player keeps rising while Space is held, and can jump again in mid-air. Its jump line is if (input.isPressed('jump')) v.y = -360. What two changes fix it?",
      hint: 'One is about when the key counts; the other is about where the player is.',
      answer: "Use input.isJustPressed('jump') so a jump happens once per press, and add && this.isOnFloor() so it happens only from the floor.",
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'physics.gravity',
        meaning: 'How fast falling speeds up, in px/s per second (980 unless Project settings change it).',
      },
      {
        symbol: 'velocity.y',
        meaning: 'Vertical speed in px/s; negative is up, positive is down.',
      },
      {
        symbol: 'isOnFloor()',
        meaning: 'True after moveAndSlide when the body is standing on something.',
      },
      {
        symbol: 'h = v₀²/2g',
        meaning: 'How high a jump of speed v₀ goes under gravity g.',
      },
      {
        symbol: 'input.axis(neg, pos)',
        meaning: '−1, 0 or 1 from two actions: −1 left, 1 right.',
      },
    ],
    rulesOfThumb: [
      'Gravity changes velocity, never position directly.',
      'Jump with isJustPressed and isOnFloor together.',
      'Height grows with the square of the jump speed.',
      'Leave a few pixels of spare height above the ledges a jump must reach.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Gravity moves the player down by the same distance every step.',
      whyStudentsThinkIt: 'Walking moves the same distance each step, so falling seems the same.',
      correctionExample: 'After 0.5 s falling it moves 8.2 px a step; after 1 s, 16.3 px a step.',
      contrastCase: 'Falling speeds up because gravity adds to velocity, not to position.',
    },
    {
      falseBelief: 'A jump twice as fast goes twice as high.',
      whyStudentsThinkIt: 'Most things in a game scale in proportion.',
      correctionExample: '360 reaches 66 px; 720 reaches 264 px, four times higher.',
      contrastCase: 'Height is v₀²/2g, so it grows with the square.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A designer wants the player to just reach a ledge 150 px up.',
      competingTechniques: ['Solve v₀ = √(2gh) with a little spare', 'Try numbers until it works'],
      whyThisTechniqueWins: 'The formula gives the speed in one step and shows how much spare height there is.',
    },
    {
      situation: 'A ball should fall faster and faster, then land.',
      competingTechniques: [
        'Add gravity × dt to velocity.y each step',
        'Add a fixed number to position.y each step',
      ],
      whyThisTechniqueWins: 'Adding to velocity makes it speed up like a real fall; adding to position falls at one speed.',
    },
  ],

  debugging: [
    {
      commonError: 'Setting v.y = 980 * dt instead of v.y += 980 * dt.',
      symptom: 'Player sinks slowly at one speed and never speeds up.',
      whyItHappened: 'Assigning replaces the speed each step instead of adding to it.',
      repairStrategy: 'Use += so gravity accumulates.',
    },
    {
      commonError: 'Testing isOnFloor() before calling moveAndSlide() in the first step.',
      symptom: 'The first jump after starting does nothing.',
      whyItHappened: 'isOnFloor reports the last moveAndSlide; before any, it is false.',
      repairStrategy: 'Accept it on the first step, or call moveAndSlide every step so isOnFloor is always fresh.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Build a platformer player and choose a jump speed for a given ledge.',
    explainVerbally: 'Explain why falling speeds up and why height grows with the square of the speed.',
    detectIncorrectApplication: 'Spot a jump that works in mid-air, and fix it.',
    transferToUnfamiliar: 'Predict jumps under other gravities, such as a moon level.',
  },

  assessment: {
    questions: [
      {
        id: 'mg2-002-assess-1',
        type: 'choice',
        text: 'With jump speed 360 and gravity 980, can a jump reach a ledge 70 px up?',
        options: [
          'No, it peaks at about 66 px',
          'Yes, it reaches 360 px',
          'Yes, any jump reaches it',
          'Only at 144 fps',
        ],
        answer: 'No, it peaks at about 66 px',
        hint: 'h = 360² ÷ (2 × 980) ≈ 66.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg2-002-quiz-1',
      type: 'choice',
      text: 'How much does gravity 980 add to velocity.y in one physics step?',
      options: ['About 16.3', '980', 'About 0.27', '60'],
      answer: 'About 16.3',
      hints: ['980 × 1/60.'],
      reviewSection: 'Intuition — the falling paragraph',
    },
    {
      id: 'mg2-002-quiz-2',
      type: 'choice',
      text: 'Which sign makes the player go up?',
      options: [
        'Negative velocity.y',
        'Positive velocity.y',
        'Negative velocity.x',
        'Either',
      ],
      answer: 'Negative velocity.y',
      hints: ['y grows downwards on the screen.'],
      reviewSection: 'Intuition — the jump paragraph',
    },
    {
      id: 'mg2-002-quiz-3',
      type: 'choice',
      text: "What does the jump test need besides isJustPressed('jump')?",
      options: [
        'this.isOnFloor()',
        'this.isOnWall()',
        'input.axis',
        'physics.gravity > 0',
      ],
      answer: 'this.isOnFloor()',
      hints: ['Only from the floor.'],
      reviewSection: 'Intuition — Warning: jumping in mid-air',
    },
    {
      id: 'mg2-002-quiz-4',
      type: 'choice',
      text: 'What is the smooth height of a 360 jump at gravity 980?',
      options: ['About 66 px', 'About 132 px', 'About 33 px', '360 px'],
      answer: 'About 66 px',
      hints: ['v₀²/2g; 132 is the near-miss of forgetting the 2.'],
      reviewSection: 'Under the hood — the triangle',
    },
    {
      id: 'mg2-002-quiz-5',
      type: 'choice',
      text: "Which of these does NOT belong in a platformer's physicsUpdate?",
      options: [
        'Moving ↑ and ↓ with input.axis',
        'Adding gravity to velocity.y',
        'Jumping from the floor',
        'Calling moveAndSlide()',
      ],
      answer: 'Moving ↑ and ↓ with input.axis',
      hints: ['Gravity owns the vertical speed.'],
      reviewSection: 'Intuition — the walking paragraph',
    },
    {
      id: 'mg2-002-quiz-6',
      type: 'choice',
      text: 'Why does the stepped jump reach about 63 px, not 66?',
      options: [
        'Each step moves at the speed after gravity has already been added',
        'The screen is too slow',
        'Gravity is wrong',
        'Rounding of pixels',
      ],
      answer: 'Each step moves at the speed after gravity has already been added',
      hints: ['Semi-implicit Euler is a little behind the smooth curve rising.'],
      reviewSection: 'Under the hood — stepping',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg2-002-1',
      label: 'Read how gravity changes speed',
      type: 'read',
    },
    {
      id: 'cp-mg2-002-2',
      label: 'Read how high a jump goes',
      type: 'read',
    },
    {
      id: 'cp-mg2-002-3',
      label: 'Read the platformer procedure',
      type: 'read',
    },
    {
      id: 'cp-mg2-002-4',
      label: 'Complete "Gravity and jumping" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg2-002-5',
      label: 'Change the jump speed to 451 in Game Studio and reach a higher ledge',
      type: 'lab',
    },
    {
      id: 'cp-mg2-002-6',
      label: 'Work through the jump-height example',
      type: 'example',
    },
    {
      id: 'cp-mg2-002-7',
      label: 'Work through the ledge example',
      type: 'example',
    },
    {
      id: 'cp-mg2-002-8',
      label: 'Attempt the flying-player challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-2',
}
