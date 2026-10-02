export default {
  order: 1,

  id: 'mg6-001',

  slug: 'scenes-inside-scenes',

  title: 'Scenes Inside Scenes',

  subtitle: 'Make a coin once, use it many times, and change every copy at once.',

  tags: ['game-studio', 'scenes', 'instances'],

  aliases: 'scene instance prefab packed scene override reuse',

  timeToComplete: 25,

  coreConcept: 'A scene can be used inside another scene as an instance. Each instance follows its source scene, so changing the source changes every instance; an instance can also override a property, such as its position, for itself.',

  prerequisites: ['mg5-003'],

  nextLesson: 'mg6-002',

  hook: {
    question: 'A level has 40 coins. You decide they should spin and be a little bigger. Do you edit 40 coins?',
    realWorldContext: 'Every game reuses things: enemies, pickups, doors, whole rooms. Godot calls a reusable scene a scene instance; Unity calls it a prefab. Building from reusable pieces is how levels stay easy to change.',
  },

  intuition: {
    prose: [
      'Make coin.scene: an Area2D root named Coin, with a Sprite2D and a CollisionShape2D. Then put three instances of it in main.scene at x = 400, 500 and 600.',
      'Each instance saves only two things: which scene it is (scenes/coin.scene), and what it changes, its position. Everything else comes from coin.scene.',
      'Before reading on, predict: you open coin.scene and give it a script that removes the coin when Player touches it. How many coins now have the script? All three: they are all coin.scene.',
      "An **override** is a property an instance sets for itself. Each coin's position is an override. If one coin overrides its sprite's texture, it keeps its own picture while the others follow the source.",
      'Instances show ⧉ in the scene tree. Their insides come from the source scene, so edit them there: open the source scene.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Reuse a thing as a scene',
        body: 'Step 1. Files › + beside scenes/: choose the root type (Area2D for a coin), and name the scene.\nStep 2. Build the thing in its own scene: picture, shape, script on the root.\nStep 3. Open the level, and press ⧉ beside the scene in Files to add an instance; place it.\nStep 4. Add as many as you need; change the source scene to change them all.\nStep 5. For one-off differences, change a property on that instance only (an override).',
      },
      {
        type: 'warning',
        title: 'Edit the source, not a copy',
        body: 'Changing something inside one instance is an override for that coin alone. To change every coin, open coin.scene and change it there.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'One coin, many times',
        props: {
          task: 'scene-instances',
          lesson: 'mg6-001',
          checkpoint: 'cp-mg6-001-4',
        },
      },
    ],
  },

  math: {
    prose: [
      "**Under the hood (optional).** When a scene runs, each instance is expanded: the source scene's tree is copied in, then the instance's overrides are applied on top. Overrides are keyed by a path inside the instance, such as Sprite.texture.",
      "So the value a coin shows for a property is the override if there is one, else the source's value: an override wins. With 40 coins and 1 override, changing the source changes 39 of them for that property.",
      'Storing instances this way is compact: a coin instance saves a path and a position, about 60 characters, while a full copy of the coin would save every node and property. And nothing can drift out of step.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      "Formally, an instance is a function of its source: expand(source, overrides) = source with each override's property replaced. Expansion happens whenever the scene is built, so it always reflects the current source.",
      "The invariant is the source's single definition: there is one coin, and many references to it.",
      "Picture the scene tree with some branches drawn faintly: those are borrowed from source scenes, and only the overridden leaves are drawn in the instance's own ink.",
      'Instances can contain instances (a room scene with coin instances inside), and the same expansion applies recursively; a scene that contains itself would never finish, so that is refused.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg6-001-ex1',
      title: 'What an instance saves',
      difficulty: 'easy',
      problem: 'A coin instance at (500, 389). What does main.scene save for it?',
      steps: [
        {
          expression: '\\text{instance: scenes/coin.scene},\\ \\text{position: } (500, 389)',
          annotation: "The source scene's path, and its own position.",
          strategyTitle: 'Step 1: Path and overrides',
        },
      ],
      answer: 'The path of coin.scene and its position override; everything else comes from coin.scene.',
    },
    {
      id: 'mg6-001-ex2',
      title: 'Who follows the change?',
      difficulty: 'medium',
      problem: "Three coins; coin 2 overrides its sprite's texture. You change the texture in coin.scene. Which coins change?",
      steps: [
        {
          expression: '\\text{coins 1, 3: no override} \\Rightarrow \\text{follow the source}',
          annotation: "They show the source's new texture.",
          strategyTitle: 'Step 1: Coins without an override',
        },
        {
          expression: '\\text{coin 2: override wins}',
          annotation: 'It keeps its own texture.',
          strategyTitle: 'Step 2: The overridden coin',
        },
      ],
      answer: 'Coins 1 and 3 change; coin 2 keeps its own picture.',
    },
    {
      id: 'mg6-001-ex3',
      title: 'A room of coins',
      difficulty: 'hard',
      problem: 'room.scene contains 5 coin instances; the level contains 4 room instances. How many coins, and how many change when coin.scene changes?',
      steps: [
        {
          expression: '4 \\times 5 = 20',
          annotation: 'Each room expands to 5 coins.',
          strategyTitle: 'Step 1: Count',
        },
        {
          expression: '20',
          annotation: 'All of them, unless some override the changed property.',
          strategyTitle: 'Step 2: Who follows',
        },
      ],
      answer: '20 coins, all of which follow coin.scene except for overridden properties.',
    },
  ],

  challenges: [
    {
      id: 'mg6-001-ch1',
      title: 'Bigger coins',
      difficulty: 'easy',
      problem: 'How do you make all 40 coins 20% bigger at once?',
      hint: "Where does the coin's picture live?",
      answer: "Open coin.scene and set its sprite's scale to 1.2; every instance follows.",
      walkthrough: [
        {
          expression: '\\text{edit coin.scene}',
          annotation: 'One change in the source.',
        },
      ],
    },
    {
      id: 'mg6-001-ch2',
      title: 'One gold coin',
      difficulty: 'medium',
      problem: 'One coin should be gold while the rest stay as they are. How?',
      hint: 'An override is for one instance.',
      answer: "Change that instance's sprite texture only; it becomes an override for that coin.",
      walkthrough: [],
    },
    {
      id: 'mg6-001-ch3',
      title: 'Debug the stubborn coin',
      difficulty: 'hard',
      problem: "After changing coin.scene's picture, one coin still shows the old one. Why?",
      hint: 'What wins over the source?',
      answer: 'That coin has an override for its picture; remove the override (or set it to the new picture).',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'instance',
        meaning: 'A use of a scene inside another; it follows its source.',
      },
      {
        symbol: 'source scene',
        meaning: 'The scene an instance is made from.',
      },
      {
        symbol: 'override',
        meaning: 'A property an instance sets for itself; it wins over the source.',
      },
      {
        symbol: 'expand',
        meaning: 'Build the full tree from the source plus overrides.',
      },
    ],
    rulesOfThumb: [
      'Anything used twice deserves its own scene.',
      'Edit the source to change every copy.',
      'Override only what really differs.',
      "Put the script on the source scene's root.",
    ],
  },

  misconceptions: [
    {
      falseBelief: 'An instance is a copy that stops following the source.',
      whyStudentsThinkIt: 'Copy and paste works that way.',
      correctionExample: 'Adding a script to coin.scene gives it to all three coins at once.',
      contrastCase: 'Only overridden properties stop following.',
    },
    {
      falseBelief: 'Every property of an instance is an override.',
      whyStudentsThinkIt: 'Each coin shows all its properties in the Inspector.',
      correctionExample: 'A coin saves only its position; its picture, shape and script come from coin.scene.',
      contrastCase: 'Only properties changed on the instance are saved as overrides.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A level needs 12 identical enemies.',
      competingTechniques: ['An enemy scene with 12 instances', 'Duplicate one enemy 11 times'],
      whyThisTechniqueWins: 'The instances all follow one scene, so fixing the enemy fixes all 12.',
    },
    {
      situation: 'Every room of a dungeon shares a door design.',
      competingTechniques: [
        'A door scene instanced in each room',
        'Building the door in each room',
      ],
      whyThisTechniqueWins: 'The door changes in one place for every room.',
    },
  ],

  debugging: [
    {
      commonError: 'Editing inside an instance to change every coin.',
      symptom: 'Only one coin changes.',
      whyItHappened: 'Changes on an instance are overrides for it alone.',
      repairStrategy: 'Open the source scene and make the change there.',
    },
    {
      commonError: "The scene's root is the wrong type.",
      symptom: 'The coin cannot notice the player.',
      whyItHappened: 'A Node2D root has no bodyEntered; the coin needs an Area2D root.',
      repairStrategy: 'Make the scene again with Area2D as its root.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Make a scene and use it as many instances.',
    explainVerbally: 'Explain what an instance saves and why overrides win.',
    detectIncorrectApplication: 'Spot an override hiding a source change.',
    transferToUnfamiliar: 'Plan nested scenes for rooms and their contents.',
  },

  assessment: {
    questions: [
      {
        id: 'mg6-001-assess-1',
        type: 'choice',
        text: 'Three coin instances; you add a script to coin.scene. How many coins have it?',
        options: ['All three', 'None', 'Only the first', 'Only new ones'],
        answer: 'All three',
        hint: 'They are all coin.scene.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg6-001-quiz-1',
      type: 'choice',
      text: 'What does an instance save?',
      options: [
        'Its source scene and its overrides',
        'A full copy of the scene',
        'Only its name',
        'Nothing',
      ],
      answer: 'Its source scene and its overrides',
      hints: ['The rest comes from the source.'],
      reviewSection: 'Intuition — the instance paragraph',
    },
    {
      id: 'mg6-001-quiz-2',
      type: 'choice',
      text: 'When an instance overrides a property, what happens when the source changes it?',
      options: [
        'The override wins',
        'The source wins',
        'Both are averaged',
        'It is an error',
      ],
      answer: 'The override wins',
      hints: ['Overrides are applied on top.'],
      reviewSection: 'Under the hood — expansion',
    },
    {
      id: 'mg6-001-quiz-3',
      type: 'choice',
      text: 'How do you change every coin?',
      options: [
        'Edit coin.scene',
        'Edit one instance',
        "Edit main.scene's root",
        'Duplicate a coin',
      ],
      answer: 'Edit coin.scene',
      hints: ['The source.'],
      reviewSection: 'Intuition — Warning: edit the source',
    },
    {
      id: 'mg6-001-quiz-4',
      type: 'choice',
      text: '4 rooms, each with 5 coin instances. How many coins?',
      options: ['20', '9', '5', '4'],
      answer: '20',
      hints: ['4 × 5.'],
      reviewSection: 'Examples — A room of coins',
    },
    {
      id: 'mg6-001-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT an override?',
      options: [
        "A coin's picture set in coin.scene",
        "One coin's position",
        "One coin's picture changed on the instance",
        "One coin's scale changed on the instance",
      ],
      answer: "A coin's picture set in coin.scene",
      hints: ["That is the source's value."],
      reviewSection: 'Misconceptions — overrides',
    },
    {
      id: 'mg6-001-quiz-6',
      type: 'choice',
      text: 'What root does a coin scene need to notice the player?',
      options: ['Area2D', 'Node2D', 'Sprite2D', 'Label'],
      answer: 'Area2D',
      hints: ['It notices bodies.'],
      reviewSection: 'Debugging — the root type',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg6-001-1',
      label: 'Read what an instance saves',
      type: 'read',
    },
    {
      id: 'cp-mg6-001-2',
      label: 'Read what an override is',
      type: 'read',
    },
    {
      id: 'cp-mg6-001-3',
      label: 'Read the reuse procedure',
      type: 'read',
    },
    {
      id: 'cp-mg6-001-4',
      label: 'Complete "One coin, many times" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg6-001-5',
      label: 'Make one gold coin with an override in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg6-001-6',
      label: 'Work through the who-follows example',
      type: 'example',
    },
    {
      id: 'cp-mg6-001-7',
      label: 'Work through the room-of-coins example',
      type: 'example',
    },
    {
      id: 'cp-mg6-001-8',
      label: 'Attempt the stubborn-coin challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-6',
}
