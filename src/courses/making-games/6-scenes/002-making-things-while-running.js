export default {
  order: 2,

  id: 'mg6-002',

  slug: 'making-things-while-running',

  title: 'Making Things While the Game Runs',

  subtitle: 'A gun that fires bullets, each a new copy of a scene.',

  tags: ['game-studio', 'scenes', 'spawning'],

  aliases: 'instantiate addchild spawn bullets cooldown queuefree lifetime',

  timeToComplete: 25,

  coreConcept: 'scene.instantiate(path) makes a new copy of a scene while the game runs; addChild puts it in the game. A cooldown timer limits how often it happens, and each copy removes itself when its job is done.',

  prerequisites: ['mg6-001'],

  nextLesson: 'mg6-003',

  hook: {
    question: 'A gun fires while Space is held. You cannot place bullets in the editor, because nobody knows when they will be fired. Where do they come from?',
    realWorldContext: 'Bullets, particles, enemies arriving in waves, pickups dropped by enemies: games create things as they play. Spawning from a scene, with a limit on how often, is the standard pattern.',
  },

  intuition: {
    prose: [
      'bullet.scene is an Area2D with a picture, a shape, and a script that moves it right at 400 pixels a second and removes it after 1.5 seconds. So a bullet travels 400 × 1.5 = 600 pixels, then is gone.',
      "When Space is pressed, Player makes one: `const b = scene.instantiate('scenes/bullet.scene')`, sets `b.position` just right of itself, and `scene.root.addChild(b)`. Until it is added, it is not in the game.",
      'Before reading on, predict: with a cooldown of 0.25 seconds while Space is held, how many bullets are flying at once? Four a second, each living 1.5 seconds: about 6.',
      'The **cooldown** is a timer counting down by dt. Fire only when it is at or below 0, then set it back to 0.25. That limits the rate whatever the frame rate.',
      'Each bullet removes itself with queueFree when its life runs out or it hits something, so they do not pile up forever.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Spawn things from a scene',
        body: "Step 1. Build the thing as its own scene, with a script that moves it and removes it (queueFree) when done.\nStep 2. To make one: const b = scene.instantiate('scenes/bullet.scene').\nStep 3. Place it: b.position = this.position.add({ x: 20, y: 0 }).\nStep 4. Add it to the game: scene.root.addChild(b).\nStep 5. Limit the rate with a cooldown that counts down by dt.",
      },
      {
        type: 'warning',
        title: 'Things that never leave',
        body: 'A bullet that never calls queueFree flies off the screen forever. After a minute of firing there are hundreds, and the game slows down. Give every spawned thing a way to remove itself.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'A gun that fires',
        props: {
          task: 'spawn-bullets',
          lesson: 'mg6-002',
          checkpoint: 'cp-mg6-002-4',
        },
      },
    ],
  },

  math: {
    prose: [
      "**Under the hood (optional).** With a cooldown $c$ seconds, the fire rate is $1/c$ per second: $c = 0.25$ gives 4. Each bullet lives $L$ seconds, so in a steady stream the number alive is about rate × lifetime, $L / c = 1.5 / 0.25 = 6$. This is Little's law: items in a system = arrival rate × time each spends there.",
      'The range is speed × lifetime: $400 \\times 1.5 = 600$ px. To reach the far side of a 960-pixel screen from its middle, a bullet needs $480 / 400 = 1.2$ s of life.',
      'Counting the cooldown down by $dt$ (rather than by frames) keeps the rate at $1/c$ on every screen, the same reasoning as speed × dt in lesson 1.3.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, with cooldown $c$ and Space held from $t = 0$, shots occur at $t = 0, c, 2c, \\ldots$, rounded up to the next physics or frame step; the long-run rate is exactly $1/c$.',
      'The invariant is the cap: however long Space is held, no more than $\\lceil L/c \\rceil$ bullets exist at once.',
      'Picture each bullet as a segment of length $L$ on a timeline, starting every $c$: the number of segments over any instant is about $L/c$.',
      'Games that spawn thousands of things reuse them instead of making and freeing each one ("object pools"); the rate and lifetime arithmetic is the same.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg6-002-ex1',
      title: 'Fire rate',
      difficulty: 'easy',
      problem: 'A cooldown of 0.25 s. How many shots a second?',
      steps: [
        {
          expression: '\\tfrac{1}{0.25} = 4',
          annotation: 'One shot per cooldown.',
          strategyTitle: 'Step 1: One over the cooldown',
        },
      ],
      answer: '4 shots a second.',
    },
    {
      id: 'mg6-002-ex2',
      title: 'Bullets in the air',
      difficulty: 'medium',
      problem: '4 shots a second, each bullet living 1.5 s. How many are flying at once?',
      steps: [
        {
          expression: '4 \\times 1.5 = 6',
          annotation: 'Rate times lifetime.',
          strategyTitle: "Step 1: Little's law",
        },
      ],
      answer: 'About 6 bullets at once.',
    },
    {
      id: 'mg6-002-ex3',
      title: 'Choosing a lifetime',
      difficulty: 'hard',
      problem: 'Bullets fly at 400 px/s and should just leave a 960-wide screen when fired from its middle. What lifetime?',
      steps: [
        {
          expression: '\\tfrac{960}{2} = 480\\ \\text{px to the edge}',
          annotation: 'From the middle to the edge.',
          strategyTitle: 'Step 1: Distance',
        },
        {
          expression: '\\tfrac{480}{400} = 1.2\\ \\text{s}',
          annotation: 'Distance ÷ speed.',
          strategyTitle: 'Step 2: Time',
        },
      ],
      answer: 'A lifetime of 1.2 s (a little more, to be safe).',
    },
  ],

  challenges: [
    {
      id: 'mg6-002-ch1',
      title: 'Faster gun',
      difficulty: 'easy',
      problem: 'What cooldown gives 10 shots a second?',
      hint: 'One over the rate.',
      answer: '0.1 s.',
      walkthrough: [
        {
          expression: '\\tfrac{1}{10} = 0.1',
          annotation: 'Seconds per shot.',
        },
      ],
    },
    {
      id: 'mg6-002-ch2',
      title: 'Range',
      difficulty: 'medium',
      problem: 'Bullets at 300 px/s living 2 s. How far do they go?',
      hint: 'Speed × time.',
      answer: '600 pixels.',
      walkthrough: [],
    },
    {
      id: 'mg6-002-ch3',
      title: 'Debug the invisible bullets',
      difficulty: 'hard',
      problem: "A learner's code instantiates a bullet and sets its position when Space is pressed, but no bullet appears. What is missing?",
      hint: 'When is a new node part of the game?',
      answer: 'It was never added: call scene.root.addChild(b) after setting its position.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'scene.instantiate(path)',
        meaning: 'A new copy of a scene, not yet in the game.',
      },
      {
        symbol: 'addChild(node)',
        meaning: 'Puts a node under another, into the running game; its ready() runs.',
      },
      {
        symbol: 'cooldown',
        meaning: 'A timer that must reach 0 before the next shot; it limits the rate.',
      },
      {
        symbol: 'rate × lifetime',
        meaning: 'How many spawned things are alive at once.',
      },
    ],
    rulesOfThumb: [
      'Every spawned thing needs a way to remove itself.',
      'Set the position before adding, so it never appears at (0, 0) for a frame.',
      'Count timers down by dt.',
      "Keep the spawned thing's behaviour in its own scene's script.",
    ],
  },

  misconceptions: [
    {
      falseBelief: 'instantiate puts the copy straight into the game.',
      whyStudentsThinkIt: 'The copy exists as soon as it is made.',
      correctionExample: 'Without addChild, the bullet is never drawn or moved.',
      contrastCase: 'addChild is what attaches it to the running tree.',
    },
    {
      falseBelief: 'Holding Space with isPressed fires once per frame no matter what.',
      whyStudentsThinkIt: 'isPressed is true every frame.',
      correctionExample: 'With a 0.25 s cooldown, it fires 4 times a second, not 60.',
      contrastCase: 'The cooldown decides the rate.',
    },
  ],

  transferPrompts: [
    {
      situation: 'An enemy should drop a coin when it dies.',
      competingTechniques: [
        "Instantiate coin.scene at the enemy's position and add it",
        'Hide a coin inside every enemy',
      ],
      whyThisTechniqueWins: 'Spawning makes coins only when needed, wherever the enemy was.',
    },
    {
      situation: 'Enemies arrive every 3 seconds.',
      competingTechniques: [
        'A spawner with a 3 s timer counting down by dt',
        'Placing 100 enemies off screen',
      ],
      whyThisTechniqueWins: 'The spawner makes exactly as many as needed, as long as the game lasts.',
    },
  ],

  debugging: [
    {
      commonError: 'Adding the bullet as a child of Player.',
      symptom: 'Bullets move with the player and turn when it turns.',
      whyItHappened: "A child's position is relative to its parent.",
      repairStrategy: "Add it to scene.root, at the player's position.",
    },
    {
      commonError: 'Resetting the cooldown every frame.',
      symptom: 'The gun never fires again after the first shot.',
      whyItHappened: 'The timer is set back to 0.25 before it reaches 0.',
      repairStrategy: 'Set it only when you fire.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Spawn things from a scene at a controlled rate.',
    explainVerbally: 'Explain instantiate, addChild and the cooldown.',
    detectIncorrectApplication: 'Spot spawned things that never leave.',
    transferToUnfamiliar: 'Size rates and lifetimes with rate × lifetime.',
  },

  assessment: {
    questions: [
      {
        id: 'mg6-002-assess-1',
        type: 'choice',
        text: 'Cooldown 0.25 s, lifetime 1.5 s. About how many bullets fly at once?',
        options: ['6', '4', '1.5', '60'],
        answer: '6',
        hint: 'Rate × lifetime.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg6-002-quiz-1',
      type: 'choice',
      text: 'What makes a new copy of a scene while running?',
      options: [
        'scene.instantiate(path)',
        'scene.change(path)',
        'queueFree()',
        'duplicate in the editor',
      ],
      answer: 'scene.instantiate(path)',
      hints: ['scene.change replaces the whole scene.'],
      reviewSection: 'Intuition — the instantiate paragraph',
    },
    {
      id: 'mg6-002-quiz-2',
      type: 'choice',
      text: 'What puts the copy into the game?',
      options: ['addChild', 'instantiate alone', 'ready()', 'position'],
      answer: 'addChild',
      hints: ['Until added, it is not in the game.'],
      reviewSection: 'Misconceptions — instantiate',
    },
    {
      id: 'mg6-002-quiz-3',
      type: 'choice',
      text: 'A 0.2 s cooldown. Shots a second?',
      options: ['5', '2', '20', '0.2'],
      answer: '5',
      hints: ['1 ÷ 0.2.'],
      reviewSection: 'Under the hood — rate',
    },
    {
      id: 'mg6-002-quiz-4',
      type: 'choice',
      text: 'Speed 400, lifetime 1.5 s. Range?',
      options: ['600 px', '400 px', '267 px', '1.5 px'],
      answer: '600 px',
      hints: ['Speed × time.'],
      reviewSection: 'Under the hood — range',
    },
    {
      id: 'mg6-002-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT a way a bullet should leave the game?',
      options: [
        'Flying off the screen forever',
        'queueFree when its life runs out',
        'queueFree when it hits something',
        'Both queueFree cases',
      ],
      answer: 'Flying off the screen forever',
      hints: ['It must remove itself.'],
      reviewSection: 'Intuition — Warning: things that never leave',
    },
    {
      id: 'mg6-002-quiz-6',
      type: 'choice',
      text: 'Why add bullets to scene.root, not Player?',
      options: [
        'So they do not move with the player',
        'So they are faster',
        'So they can be freed',
        'It does not matter',
      ],
      answer: 'So they do not move with the player',
      hints: ['A child moves with its parent.'],
      reviewSection: 'Debugging — child of Player',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg6-002-1',
      label: 'Read how bullets are made',
      type: 'read',
    },
    {
      id: 'cp-mg6-002-2',
      label: 'Read how the cooldown limits the rate',
      type: 'read',
    },
    {
      id: 'cp-mg6-002-3',
      label: 'Read the spawning procedure',
      type: 'read',
    },
    {
      id: 'cp-mg6-002-4',
      label: 'Complete "A gun that fires" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg6-002-5',
      label: 'Change the cooldown to 0.1 s in Game Studio and count the bullets',
      type: 'lab',
    },
    {
      id: 'cp-mg6-002-6',
      label: 'Work through the bullets-in-the-air example',
      type: 'example',
    },
    {
      id: 'cp-mg6-002-7',
      label: 'Work through the lifetime example',
      type: 'example',
    },
    {
      id: 'cp-mg6-002-8',
      label: 'Attempt the invisible-bullets challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-6',
}
