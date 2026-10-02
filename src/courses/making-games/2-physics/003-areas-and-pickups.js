export default {
  order: 3,

  id: 'mg2-003',

  slug: 'areas-and-pickups',

  title: 'Areas and Pickups',

  subtitle: 'Things that notice the player without stopping it, such as coins.',

  tags: ['game-studio', 'physics', 'areas'],

  aliases: 'area2d bodyentered pickups coins queuefree overlap trigger zone',

  timeToComplete: 25,

  coreConcept: "An Area2D is a region that notices bodies entering and leaving it but never blocks them. Its script's bodyEntered(body) runs once when a body starts to overlap it: the place to collect a coin, open a door or take damage.",

  prerequisites: ['mg2-002'],

  nextLesson: 'mg2-004',

  hook: {
    question: 'A coin must vanish and add 1 to the score when the player touches it, but the player must walk straight through it. A wall would stop the player. What kind of node is the coin?',
    realWorldContext: 'Pickups, checkpoints, spikes, doors that open as you approach, the zone that ends a level: all are regions that notice you without stopping you. Godot calls them areas; Unity calls them triggers.',
  },

  intuition: {
    prose: [
      "Player is 16 × 22 at x = 300, walking right on the floor. A coin 18 × 18 sits at x = 360. Their edges meet when the centres are 8 + 9 = 17 pixels apart, at Player x = 343. At that moment the coin's `bodyEntered(body)` runs, with `body` set to Player.",
      'Before reading on, predict: does Player slow down when it reaches the coin? No. The coin is an **Area2D**: it only notices. Player keeps walking at full speed, straight through.',
      "The coin removes itself with `this.queueFree()`. Queued means at the end of this frame, so the rest of the frame's code still finds it; then it is gone from the game.",
      "To count it, the coin tells Player: `body.collect()`. Player's own `collect()` adds 1 to its `coins` field and shows it in a Label. The coin needs to know only that Player can collect.",
      "Check who entered. A coin should ignore an enemy that walks into it: `if (body.name !== 'Player') return`.",
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Make a pickup',
        body: "Step 1. Add an Area2D (Coin) with a Sprite2D and a CollisionShape2D under it.\nStep 2. Give Coin a script with bodyEntered(body).\nStep 3. Ignore bodies that should not collect it: if (body.name !== 'Player') return.\nStep 4. Tell the collector, body.collect(), then remove the pickup, this.queueFree().\nStep 5. In Player's script, write collect(): add 1 to a field and show it in a Label.",
      },
      {
        type: 'warning',
        title: 'An area is not a body',
        body: 'Using a StaticBody2D for a coin makes Player bump into it and stop. Using an Area2D for a floor makes Player fall through it. Areas notice; bodies block.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Coins to collect',
        props: {
          task: 'collect-coins',
          lesson: 'mg2-003',
          checkpoint: 'cp-mg2-003-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** After each physics step the engine tests every area against every body its mask can see. Two rectangles overlap when both $|x_A - x_B| < \\tfrac{w_A + w_B}{2}$ and $|y_A - y_B| < \\tfrac{h_A + h_B}{2}$. Two circles overlap when the distance between centres is less than the sum of their radii: $\\sqrt{(x_A - x_B)^2 + (y_A - y_B)^2} < r_A + r_B$.',
      "The area keeps the set of bodies inside it. Comparing this step's set with last step's gives the news: in now but not before means bodyEntered; in before but not now means bodyExited. So bodyEntered runs once per visit, not every step.",
      'Touching is not overlapping: at exactly $|x_A - x_B| = \\tfrac{w_A + w_B}{2}$ the edges meet but nothing enters. That is why a body resting against a wall is not "inside" it.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, bodyEntered fires for body $b$ at step $n$ exactly when $b \\in S_n$ and $b \\notin S_{n-1}$, where $S_n$ is the set of bodies overlapping the area after step $n$; bodyExited is the reverse.',
      'The invariant is the set difference: however long a body stands inside, it entered once. Events come from changes, not states.',
      'Geometrically, overlap is a test of whether two shapes share interior points. For two axis-aligned rectangles it splits into two independent interval tests, one per axis.',
      'Testing every area against every body takes about areas × bodies tests a step. Large games divide space into cells first ("broad phase") and only test pairs in the same cells. With a few hundred nodes it is not needed.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg2-003-ex1',
      title: 'When the coin is reached',
      difficulty: 'easy',
      problem: 'Player (16 wide) walks right; a coin 18 wide is centred at x = 360. At what Player x does bodyEntered run?',
      steps: [
        {
          expression: '\\tfrac{16 + 18}{2} = 17',
          annotation: 'The centres must be closer than half the widths added.',
          strategyTitle: 'Step 1: The touching distance',
        },
        {
          expression: '360 - 17 = 343',
          annotation: 'Just past 343 they overlap, and the coin hears about it.',
          strategyTitle: "Step 2: From the coin's centre",
        },
      ],
      answer: "bodyEntered runs as soon as Player's x passes 343.",
    },
    {
      id: 'mg2-003-ex2',
      title: 'Two round things',
      difficulty: 'medium',
      problem: 'A ball of radius 13 at (100, 100) and a round area of radius 20 at (125, 120). Do they overlap?',
      steps: [
        {
          expression: 'd = \\sqrt{25^2 + 20^2} = \\sqrt{1025} \\approx 32.0',
          annotation: 'The distance between centres, by Pythagoras.',
          strategyTitle: 'Step 1: Distance between centres',
        },
        {
          expression: '32.0 < 13 + 20 = 33',
          annotation: 'Less than the radii added, so they overlap, by about 1 pixel.',
          strategyTitle: 'Step 2: Compare with the radii',
        },
      ],
      answer: 'Yes, they overlap by about 1 pixel, so bodyEntered would run.',
    },
    {
      id: 'mg2-003-ex3',
      title: 'Who counts?',
      difficulty: 'hard',
      problem: "An enemy walks into a coin, then Player does. The coin's script is bodyEntered(body) { body.collect(); this.queueFree() }. What goes wrong, and what fixes it?",
      steps: [
        {
          expression: '\\text{enemy enters} \\Rightarrow \\texttt{enemy.collect()}',
          annotation: 'The enemy has no collect method, so this is an error, and the enemy "takes" the coin.',
          strategyTitle: 'Step 1: Follow the enemy',
        },
        {
          expression: '\\text{if body.name} \\ne \\text{Player: return}',
          annotation: 'Checking who entered first means only Player collects.',
          strategyTitle: 'Step 2: Check the body',
        },
      ],
      answer: 'The enemy triggers it and calls a method it lacks; check that the body is Player first.',
    },
  ],

  challenges: [
    {
      id: 'mg2-003-ch1',
      title: 'Tall coin',
      difficulty: 'easy',
      problem: 'A coin 10 wide is centred at x = 500. A player 20 wide walks left from x = 600. At what x does it reach the coin?',
      hint: 'Half the widths added.',
      answer: 'At x = 515, because the centres must be within 15 pixels.',
      walkthrough: [
        {
          expression: '500 + \\tfrac{20 + 10}{2} = 515',
          annotation: 'Coming from the right, add the touching distance.',
        },
      ],
    },
    {
      id: 'mg2-003-ch2',
      title: 'Once or every step?',
      difficulty: 'medium',
      problem: 'Player stands inside a healing zone for 2 seconds. How many times does bodyEntered run?',
      hint: 'Events come from changes.',
      answer: 'Once, when Player first overlapped it; staying inside is not a new entry.',
      walkthrough: [],
    },
    {
      id: 'mg2-003-ch3',
      title: 'The wall that should be a door',
      difficulty: 'hard',
      problem: 'A learner made a level exit as a StaticBody2D with a script that has bodyEntered. Player bumps into it and nothing happens. Explain and fix.',
      hint: 'Which node types call bodyEntered?',
      answer: 'Only an Area2D calls bodyEntered, and a StaticBody2D blocks Player instead; make the exit an Area2D with the same shape and script.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'Area2D',
        meaning: 'A region that notices bodies entering and leaving but never blocks them.',
      },
      {
        symbol: 'bodyEntered(body)',
        meaning: 'Runs once when a body starts to overlap the area.',
      },
      {
        symbol: 'bodyExited(body)',
        meaning: 'Runs once when a body stops overlapping it.',
      },
      {
        symbol: 'queueFree()',
        meaning: 'Removes the node at the end of this frame.',
      },
      {
        symbol: 'overlap',
        meaning: 'Sharing interior points; touching edges is not overlapping.',
      },
    ],
    rulesOfThumb: [
      'If it should notice, use an Area2D; if it should block, use a body.',
      'Check who entered before doing anything.',
      'Let the collector count; let the pickup only say it was collected.',
      'Remove pickups with queueFree, so the frame finishes cleanly.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'bodyEntered runs every step a body is inside.',
      whyStudentsThinkIt: 'The body is still touching the area on every step.',
      correctionExample: 'Standing 2 s in a zone calls bodyEntered once, not 120 times.',
      contrastCase: 'To act every step while inside, track it yourself between bodyEntered and bodyExited.',
    },
    {
      falseBelief: 'An Area2D slows the player down a little.',
      whyStudentsThinkIt: 'Overlapping feels like a collision.',
      correctionExample: 'Walking through a coin at 200 px/s, Player is still at 200 px/s.',
      contrastCase: 'Only bodies (Static, Character, Rigid) push and slide.',
    },
  ],

  transferPrompts: [
    {
      situation: 'Spikes should hurt the player once each time it lands on them.',
      competingTechniques: [
        'An Area2D whose bodyEntered calls body.hurt()',
        'A StaticBody2D that checks distance in update',
      ],
      whyThisTechniqueWins: 'The area reports each new touch once, and the player can stand among spikes without being blocked.',
    },
    {
      situation: 'A door should open when the player comes within 50 px.',
      competingTechniques: [
        'An Area2D 100 px wide around the door',
        "Compare positions every frame in the player's script",
      ],
      whyThisTechniqueWins: "The area's shape is the trigger zone, visible in the editor, and the door needs no code in the player.",
    },
  ],

  debugging: [
    {
      commonError: 'Calling queueFree() before body.collect().',
      symptom: 'Usually works, but collect is sometimes skipped in other designs where removal is immediate.',
      whyItHappened: 'The order states intent poorly; code after removal runs on a node that is going.',
      repairStrategy: 'Tell the collector first, then remove the pickup.',
    },
    {
      commonError: "The coin's shape is far smaller than its picture.",
      symptom: 'Player visibly walks over the coin and nothing happens.',
      whyItHappened: 'Only the shape is tested, and Player never reaches it.',
      repairStrategy: 'Size the CollisionShape2D to the picture.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Build a pickup that counts and disappears.',
    explainVerbally: 'Explain the difference between an area and a body, and why bodyEntered runs once.',
    detectIncorrectApplication: 'Recognise a trigger built from a body, and fix it.',
    transferToUnfamiliar: 'Use areas for spikes, doors and level exits.',
  },

  assessment: {
    questions: [
      {
        id: 'mg2-003-assess-1',
        type: 'choice',
        text: 'Which node lets the player walk through it but notices when it does?',
        options: ['Area2D', 'StaticBody2D', 'CharacterBody2D', 'Sprite2D'],
        answer: 'Area2D',
        hint: 'Areas notice; bodies block.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg2-003-quiz-1',
      type: 'choice',
      text: 'When does bodyEntered(body) run?',
      options: [
        'Once, when a body starts to overlap',
        'Every step while overlapping',
        'When the game starts',
        'When the body stops',
      ],
      answer: 'Once, when a body starts to overlap',
      hints: ['Events come from changes.'],
      reviewSection: 'Under the hood — entering and leaving',
    },
    {
      id: 'mg2-003-quiz-2',
      type: 'choice',
      text: 'What does queueFree() do?',
      options: [
        'Removes the node at the end of the frame',
        'Hides it but keeps it',
        'Pauses it',
        'Removes it and every other coin',
      ],
      answer: 'Removes the node at the end of the frame',
      hints: ['Queued means later this frame.'],
      reviewSection: 'Intuition — the queueFree paragraph',
    },
    {
      id: 'mg2-003-quiz-3',
      type: 'choice',
      text: 'A coin 18 wide at x = 360; Player 16 wide comes from the left. When does it enter?',
      options: ['Past x = 343', 'Past x = 351', 'At x = 360', 'Past x = 342'],
      answer: 'Past x = 343',
      hints: [
        "Half the widths added is 17; 351 is the near-miss of using only the coin's half-width.",
      ],
      reviewSection: 'Examples — When the coin is reached',
    },
    {
      id: 'mg2-003-quiz-4',
      type: 'choice',
      text: 'Who should add 1 to the score?',
      options: [
        "Player's collect(), called by the coin",
        "The coin, by reading Player's field",
        'The floor',
        'The Label',
      ],
      answer: "Player's collect(), called by the coin",
      hints: ['The collector keeps its own count.'],
      reviewSection: 'Intuition — the collect paragraph',
    },
    {
      id: 'mg2-003-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT a good use of an Area2D?',
      options: ['A floor to stand on', 'A coin', 'Spikes', 'A level exit'],
      answer: 'A floor to stand on',
      hints: ['A floor must block; an area never does.'],
      reviewSection: 'Intuition — Warning: an area is not a body',
    },
    {
      id: 'mg2-003-quiz-6',
      type: 'choice',
      text: 'Circles of radius 10 and 12 have centres 22 apart. Do they overlap?',
      options: ['No, they only touch', 'Yes', 'Yes, by 22', 'Only if both are areas'],
      answer: 'No, they only touch',
      hints: ['22 equals 10 + 12, and touching is not overlapping.'],
      reviewSection: 'Under the hood — touching',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg2-003-1',
      label: 'Read when a pickup is reached',
      type: 'read',
    },
    {
      id: 'cp-mg2-003-2',
      label: 'Read how an area differs from a body',
      type: 'read',
    },
    {
      id: 'cp-mg2-003-3',
      label: 'Read the pickup procedure',
      type: 'read',
    },
    {
      id: 'cp-mg2-003-4',
      label: 'Complete "Coins to collect" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg2-003-5',
      label: 'Add a second coin in Game Studio and collect both',
      type: 'lab',
    },
    {
      id: 'cp-mg2-003-6',
      label: 'Work through the round overlap example',
      type: 'example',
    },
    {
      id: 'cp-mg2-003-7',
      label: 'Work through the who-counts example',
      type: 'example',
    },
    {
      id: 'cp-mg2-003-8',
      label: 'Attempt the wall-that-should-be-a-door challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-2',
}
