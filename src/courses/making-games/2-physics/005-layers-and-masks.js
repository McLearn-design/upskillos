export default {
  order: 5,

  id: 'mg2-005',

  slug: 'layers-and-masks',

  title: 'Collision Layers and Masks',

  subtitle: 'Decide exactly what collides with what, with two rows of tick boxes.',

  tags: ['game-studio', 'physics', 'layers'],

  aliases: 'collision layer mask bits bitmask and operator binary collisionlayer collisionmask',

  timeToComplete: 25,

  coreConcept: 'Every body is on some collision layers and scans some others (its mask). A body stops at another only if its mask includes a layer the other is on. Layers are bits of a number, and the test is mask AND layer ≠ 0.',

  prerequisites: ['mg2-004'],

  nextLesson: 'mg3-001',

  hook: {
    question: 'A ball should fall through a glass shelf but land on the floor beneath it. Both are StaticBody2Ds. How can the ball treat them differently?',
    realWorldContext: 'Bullets that pass through their own team, ghosts that walk through walls, a player who can drop through thin platforms: all are collision layers. Every major engine has them.',
  },

  intuition: {
    prose: [
      "The floor and the glass both start on layer 1. The ball's mask is layer 1: it scans layer 1. So it hits both, and lands on the glass at y = 250.",
      'Move the glass to layer 2 only. Before reading on, predict: where does the ball land now? On the floor. Its mask still scans layer 1 only, and the glass is no longer on layer 1, so the ball does not see it.',
      "So each body has two settings. `collisionLayer` is what it is: the layers it is on. `collisionMask` is what it looks for: the layers it scans. A body stops at another only if its mask includes one of the other's layers.",
      'A second ball, Ball2, with layers 1 and 2 both ticked in its mask, scans the glass again and lands on it, while the first ball still falls through.',
      'The Inspector shows each as a row of numbered tick boxes. Under the hood each row is one number, one bit per layer.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Make one thing pass through another',
        body: 'Step 1. Decide what each layer means (1 world, 2 glass, 3 enemies, …).\nStep 2. Put each body on its layer: Inspector › collisionLayer.\nStep 3. For each moving body, tick the layers it should hit: Inspector › collisionMask.\nStep 4. To pass through something, leave its layer out of your mask.\nStep 5. Run, and check each pair: hits when mask and layer share a tick.',
      },
      {
        type: 'warning',
        title: 'Layer and mask are different',
        body: 'Moving the ball to layer 2 does not make it pass through glass on layer 2: what matters for the ball stopping is its mask. Ask "what am I?" for the layer and "what do I hit?" for the mask.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Collision layers',
        props: {
          task: 'collision-layers',
          lesson: 'mg2-005',
          checkpoint: 'cp-mg2-005-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** Layer $k$ is the number $2^{k-1}$: layer 1 is 1, layer 2 is 2, layer 3 is 4, layer 4 is 8. A set of layers is their sum, so layers 1 and 2 together are 3, written in binary as 11.',
      "The bitwise AND, written $\\&$, keeps the bits two numbers share: $3 \\,\\&\\, 2 = 2$ (binary 11 and 10 share 10), and $1 \\,\\&\\, 2 = 0$ (01 and 10 share nothing). The engine's test is exactly $\\text{mask} \\,\\&\\, \\text{layer} \\neq 0$.",
      "For the task: the ball's mask is 1 and the glass's layer is 2, so $1 \\,\\&\\, 2 = 0$ and it passes through. Ball2's mask is 3, so $3 \\,\\&\\, 2 = 2 \\neq 0$ and it lands. The floor is layer 1: $1 \\,\\&\\, 1 = 1$ and $3 \\,\\&\\, 1 = 1$, so both land on it.",
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, with layers as sets $L_A$ and masks as sets $M_A$, body $A$ is stopped by $B$ when $M_A \\cap L_B \\neq \\emptyset$. Bitwise AND on the numbers computes that intersection, all layers at once.',
      "The test is not symmetric: $A$ can scan $B$ while $B$ ignores $A$. Breakout uses this: the paddle's mask omits the ball's layer, so the ball bounces off the paddle but never pushes it.",
      "Picture a grid of layers against masks: each tick box in the mask row lights up a column of layers it scans. A pair collides where a lit column meets the other body's layer.",
      'With 32 bits a number holds 32 layers, which is why engines offer that many. The same bit tricks appear everywhere in programming, from file permissions to graphics flags (Tiled stores tile flips this way, in chapter 5).',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg2-005-ex1',
      title: 'Layer numbers',
      difficulty: 'easy',
      problem: 'What number stands for layers 1 and 3 together?',
      steps: [
        {
          expression: '2^{0} + 2^{2} = 1 + 4 = 5',
          annotation: 'Layer k is 2 to the power k − 1; a set is the sum.',
          strategyTitle: 'Step 1: Add the bits',
        },
      ],
      answer: 'Layers 1 and 3 together are 5 (binary 101).',
    },
    {
      id: 'mg2-005-ex2',
      title: 'Does it land on the glass?',
      difficulty: 'medium',
      problem: "The glass is on layer 2 only. Ball's mask is 1; Ball2's mask is 3. Which land on the glass?",
      steps: [
        {
          expression: '1 \\,\\&\\, 2 = 0',
          annotation: 'Ball shares no bit with the glass, so it falls through.',
          strategyTitle: 'Step 1: Ball',
        },
        {
          expression: '3 \\,\\&\\, 2 = 2 \\neq 0',
          annotation: 'Ball2 shares bit 2, so it lands.',
          strategyTitle: 'Step 2: Ball2',
        },
      ],
      answer: 'Only Ball2 lands on the glass; Ball falls through to the floor.',
    },
    {
      id: 'mg2-005-ex3',
      title: 'A team game',
      difficulty: 'hard',
      problem: 'Walls on layer 1, players on 2, player bullets on 3, enemies on 4. Player bullets should hit walls and enemies only. What is their mask?',
      steps: [
        {
          expression: '\\text{walls} = 1,\\ \\text{enemies} = 2^{3} = 8',
          annotation: 'The layers to scan, as bits.',
          strategyTitle: 'Step 1: The layers to hit',
        },
        {
          expression: '1 + 8 = 9',
          annotation: 'A mask of 9 (binary 1001) scans layers 1 and 4.',
          strategyTitle: 'Step 2: Add them',
        },
      ],
      answer: "The bullets' mask is 9, ticking layers 1 and 4, so they ignore players and each other.",
    },
  ],

  challenges: [
    {
      id: 'mg2-005-ch1',
      title: 'Read a mask',
      difficulty: 'easy',
      problem: 'A mask of 6. Which layers does it scan?',
      hint: 'Write 6 in binary.',
      answer: 'Layers 2 and 3, because 6 = 2 + 4 (binary 110).',
      walkthrough: [
        {
          expression: '6 = 4 + 2 = 2^{2} + 2^{1}',
          annotation: 'Bits for layers 3 and 2.',
        },
      ],
    },
    {
      id: 'mg2-005-ch2',
      title: 'Who sees whom?',
      difficulty: 'medium',
      problem: 'A is on layer 1 with mask 2; B is on layer 2 with mask 4. Does A stop at B? Does B stop at A?',
      hint: 'Test each direction separately.',
      answer: 'A stops at B (2 & 2 = 2), but B does not stop at A (4 & 1 = 0).',
      walkthrough: [],
    },
    {
      id: 'mg2-005-ch3',
      title: 'Debug the ghost ball',
      difficulty: 'hard',
      problem: 'To make a ball pass through glass, a learner put the ball on layer 2 (where the glass is) and left its mask at 1. It still falls through the glass, but now another ball with mask 2 lands on it. Explain.',
      hint: 'Which setting decides what the ball itself hits?',
      answer: "The ball's own mask decides what it hits, and 1 & 2 = 0 already made it pass the glass; moving its layer only changed what can see it, so another ball with mask 2 now lands on it too.",
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'collisionLayer',
        meaning: 'The layers a body is on: what it is.',
      },
      {
        symbol: 'collisionMask',
        meaning: 'The layers a body scans: what it hits.',
      },
      {
        symbol: '2^(k−1)',
        meaning: 'The number for layer k; a set of layers is the sum.',
      },
      {
        symbol: 'mask & layer ≠ 0',
        meaning: 'The test for whether a body stops at another.',
      },
      {
        symbol: '&',
        meaning: 'Bitwise AND, keeping only the bits two numbers share.',
      },
    ],
    rulesOfThumb: [
      'Name your layers before using them, and keep a note of the plan.',
      'Layer answers "what am I"; mask answers "what do I hit".',
      'Test each direction of a pair separately.',
      'To ignore something, take its layer out of your mask, not yours out of its.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Two bodies on the same layer always collide.',
      whyStudentsThinkIt: 'It sounds like being on the same layer means being in the same world.',
      correctionExample: 'Two bodies on layer 2 with masks of 1 ignore each other, because 1 & 2 = 0.',
      contrastCase: "What matters is each one's mask against the other's layer.",
    },
    {
      falseBelief: 'Collision is always two-way.',
      whyStudentsThinkIt: 'In real life, if A bumps B, B bumps A.',
      correctionExample: "In Breakout the ball's mask includes the paddle, but the paddle's mask omits the ball, so the ball bounces and the paddle never moves.",
      contrastCase: "Each body's own mask decides what stops it.",
    },
  ],

  transferPrompts: [
    {
      situation: 'The player should drop through thin platforms but stand on the ground.',
      competingTechniques: [
        "Put platforms on their own layer and leave it out of the player's mask while dropping",
        'Delete the platforms when the player presses down',
      ],
      whyThisTechniqueWins: 'Changing the mask is instant and reversible; deleting platforms breaks the level.',
    },
    {
      situation: 'Enemies should not block each other in a crowded room.',
      competingTechniques: [
        "Leave the enemy layer out of the enemies' mask",
        'Space them out by hand',
      ],
      whyThisTechniqueWins: 'One mask setting covers every enemy, however many there are.',
    },
  ],

  debugging: [
    {
      commonError: "Changing the ball's layer instead of the glass's.",
      symptom: 'The ball still lands on the glass, or other things start landing on the ball.',
      whyItHappened: "The ball's own mask decides what it hits.",
      repairStrategy: "Move the glass to a layer the ball's mask leaves out, or take the glass's layer out of the ball's mask.",
    },
    {
      commonError: "Unticking every layer of a body's own layer row.",
      symptom: 'Nothing ever stops at it; it is invisible to physics.',
      whyItHappened: 'A body on no layers has layer 0, and anything & 0 is 0.',
      repairStrategy: 'Keep at least one layer ticked for anything others should hit.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Set layers and masks so chosen pairs collide and others pass through.',
    explainVerbally: 'Explain the difference between layer and mask, and the AND test.',
    detectIncorrectApplication: "Spot a fix that changed the wrong body's layer.",
    transferToUnfamiliar: 'Plan layers for a team game with bullets and pickups.',
  },

  assessment: {
    questions: [
      {
        id: 'mg2-005-assess-1',
        type: 'choice',
        text: 'Ball mask 1, glass layer 2. Does the ball land on the glass?',
        options: [
          'No, because 1 & 2 = 0',
          'Yes, because both are bodies',
          'Yes, because 1 + 2 = 3',
          'Only with bounce 1',
        ],
        answer: 'No, because 1 & 2 = 0',
        hint: 'The mask and layer share no bit.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg2-005-quiz-1',
      type: 'choice',
      text: "What does a body's collisionMask say?",
      options: [
        'Which layers it hits',
        'Which layer it is on',
        'How bouncy it is',
        'Which group it is in',
      ],
      answer: 'Which layers it hits',
      hints: ['Mask is what it scans.'],
      reviewSection: 'Intuition — the two settings',
    },
    {
      id: 'mg2-005-quiz-2',
      type: 'choice',
      text: 'What number is layer 4?',
      options: ['8', '4', '16', '3'],
      answer: '8',
      hints: ['2 to the power 3; 4 is the near-miss of using k instead of k − 1.'],
      reviewSection: 'Under the hood — bits',
    },
    {
      id: 'mg2-005-quiz-3',
      type: 'choice',
      text: 'What is 5 & 3?',
      options: ['1', '7', '8', '0'],
      answer: '1',
      hints: ['101 and 011 share only the last bit.'],
      reviewSection: 'Under the hood — AND',
    },
    {
      id: 'mg2-005-quiz-4',
      type: 'choice',
      text: 'A has mask 2; B is on layer 2 with mask 1; A is on layer 4. What happens?',
      options: [
        'A stops at B, B ignores A',
        'Both stop',
        'Neither stops',
        'B stops at A, A ignores B',
      ],
      answer: 'A stops at B, B ignores A',
      hints: ['2 & 2 ≠ 0, but 1 & 4 = 0.'],
      reviewSection: 'Rigor — not symmetric',
    },
    {
      id: 'mg2-005-quiz-5',
      type: 'choice',
      text: 'Which of these does NOT make the ball pass through the glass?',
      options: [
        'Putting the ball on layer 2',
        'Putting the glass on layer 2 only',
        "Taking the glass's layer out of the ball's mask",
        "Leaving the ball's mask at 1 with the glass on layer 2",
      ],
      answer: 'Putting the ball on layer 2',
      hints: ["The ball's layer is about what sees the ball, not what it hits."],
      reviewSection: 'Intuition — Warning: layer and mask are different',
    },
    {
      id: 'mg2-005-quiz-6',
      type: 'choice',
      text: 'Bullets should hit walls (layer 1) and enemies (layer 4). Their mask?',
      options: ['9', '5', '4', '14'],
      answer: '9',
      hints: ['1 + 8.'],
      reviewSection: 'Examples — A team game',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg2-005-1',
      label: 'Read what layers and masks are',
      type: 'read',
    },
    {
      id: 'cp-mg2-005-2',
      label: 'Read why the ball falls through the glass',
      type: 'read',
    },
    {
      id: 'cp-mg2-005-3',
      label: 'Read the pass-through procedure',
      type: 'read',
    },
    {
      id: 'cp-mg2-005-4',
      label: 'Complete "Collision layers" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg2-005-5',
      label: 'Make a third ball that ignores the floor in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg2-005-6',
      label: 'Work through the glass example',
      type: 'example',
    },
    {
      id: 'cp-mg2-005-7',
      label: 'Work through the team-game example',
      type: 'example',
    },
    {
      id: 'cp-mg2-005-8',
      label: 'Attempt the ghost-ball challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-2',
}
