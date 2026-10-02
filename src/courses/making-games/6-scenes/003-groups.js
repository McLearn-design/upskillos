export default {
  order: 3,

  id: 'mg6-003',

  slug: 'groups',

  title: 'Groups',

  subtitle: 'Bullets that hit only enemies, by asking what group a body is in.',

  tags: ['game-studio', 'scenes', 'groups'],

  aliases: 'groups addtogroup isingroup getnodesingroup callgroup tags',

  timeToComplete: 20,

  coreConcept: "A group is a label any node can carry, such as enemies. Code asks body.isInGroup('enemies') instead of checking names, and scene.getNodesInGroup or callGroup reach every member at once.",

  prerequisites: ['mg6-002'],

  nextLesson: 'mg6-004',

  hook: {
    question: 'Bullets should destroy enemies but not the floor or the player. There are two enemies now, and twenty later, named Enemy, Enemy2, Bat, Ghost. How does a bullet know what to hit?',
    realWorldContext: 'Games sort things into kinds: enemies, pickups, hazards, interactables. Groups (tags in Unity) let code talk about a kind without knowing every name.',
  },

  intuition: {
    prose: [
      'Enemy and Enemy2 are in the group enemies: Inspector › Groups, type enemies, press Enter, for each.',
      "In bullet.js's bodyEntered: `if (body.isInGroup('enemies')) body.queueFree()`, then the bullet removes itself. The floor is not in the group, so it survives; the bullet still stops at it.",
      "Before reading on, predict: you add a Bat and put it in enemies. Do you change the bullet's code? No: the bullet asks about the group, not the name.",
      "Groups also reach many at once. `scene.getNodesInGroup('enemies')` gives every member, and `scene.callGroup('enemies', 'freeze')` calls freeze() on each that has it.",
      'A node can be in several groups (enemies and flying), and a group can hold any kind of node.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Act on a kind of thing',
        body: "Step 1. Choose a group name for the kind (enemies).\nStep 2. Add each member to it: Inspector › Groups (or this.addToGroup in a script).\nStep 3. Where it matters, ask body.isInGroup('enemies') instead of checking names.\nStep 4. To reach them all, use scene.getNodesInGroup or scene.callGroup.",
      },
      {
        type: 'warning',
        title: 'Group names are exact',
        body: 'enemies and Enemies are different groups. A typo makes isInGroup quietly false, so nothing happens and no error says why. Copy the name.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Bullets that hit only enemies',
        props: {
          task: 'enemy-group',
          lesson: 'mg6-003',
          checkpoint: 'cp-mg6-003-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** Each node keeps a set of group names. isInGroup is a set membership test, $g \\in G_n$; adding is $G_n \\leftarrow G_n \\cup \\{g\\}$. Sets make the test take the same time however many groups there are.',
      'getNodesInGroup walks the tree and keeps the nodes whose sets contain the name: about one test per node, so a scene of 500 nodes costs 500 tests. Calling it every frame is fine for small scenes; for big ones, do it when something changes.',
      "Compared with names: a check like `name === 'Enemy' || name === 'Enemy2' || …` grows with every new enemy, while the group test stays one line.",
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, a group is the set $\\{n : g \\in G_n\\}$ of nodes carrying name $g$. Group operations are set operations: membership, union (several groups), intersection (nodes in both).',
      'The invariant is the kind, not the identity: code written against enemies keeps working as enemies are added, renamed or removed.',
      'Picture the nodes as dots and each group as a coloured outline round some of them; outlines can overlap.',
      'Groups pair with collision layers: layers decide what physically touches; groups decide what a touch means.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg6-003-ex1',
      title: 'What survives a hit',
      difficulty: 'easy',
      problem: 'A bullet hits the floor (no groups) and later Enemy (in enemies). What is removed each time?',
      steps: [
        {
          expression: '\\text{floor: bullet only}',
          annotation: 'The floor is not in enemies, so only the bullet goes.',
          strategyTitle: 'Step 1: The floor',
        },
        {
          expression: '\\text{Enemy: Enemy and the bullet}',
          annotation: 'Enemy is in the group.',
          strategyTitle: 'Step 2: The enemy',
        },
      ],
      answer: 'The floor survives; Enemy is removed; the bullet is removed both times.',
    },
    {
      id: 'mg6-003-ex2',
      title: 'Freeze them all',
      difficulty: 'medium',
      problem: 'A power-up should stop every enemy for 3 s. Which call reaches them all?',
      steps: [
        {
          expression: '\\texttt{scene.callGroup("enemies", "freeze", 3)}',
          annotation: 'Calls freeze(3) on each member that has a freeze method.',
          strategyTitle: 'Step 1: Call the group',
        },
      ],
      answer: "scene.callGroup('enemies', 'freeze', 3), with each enemy's script defining freeze(seconds).",
    },
    {
      id: 'mg6-003-ex3',
      title: 'Two groups',
      difficulty: 'hard',
      problem: 'Arrows should hit enemies that are not flying. Enemies carry enemies; bats also carry flying. Write the test.',
      steps: [
        {
          expression: '\\text{isInGroup(enemies)} \\wedge \\neg\\,\\text{isInGroup(flying)}',
          annotation: 'In one group and not the other.',
          strategyTitle: 'Step 1: Combine the tests',
        },
      ],
      answer: "if (body.isInGroup('enemies') && !body.isInGroup('flying')) body.queueFree().",
    },
  ],

  challenges: [
    {
      id: 'mg6-003-ch1',
      title: 'A new enemy',
      difficulty: 'easy',
      problem: 'You add a Ghost. What makes bullets hit it?',
      hint: 'The bullet asks about a group.',
      answer: 'Add Ghost to the enemies group; no code changes.',
      walkthrough: [
        {
          expression: '\\text{Groups: enemies}',
          annotation: 'In the Inspector.',
        },
      ],
    },
    {
      id: 'mg6-003-ch2',
      title: 'Count the enemies',
      difficulty: 'medium',
      problem: 'How does the HUD show how many enemies are left?',
      hint: 'A group gives all its members.',
      answer: "Use scene.getNodesInGroup('enemies').length.",
      walkthrough: [],
    },
    {
      id: 'mg6-003-ch3',
      title: 'Debug the bullet-proof enemy',
      difficulty: 'hard',
      problem: 'Bullets pass enemies without removing them. bullet.js checks isInGroup(\'enemy\'); the enemies are in "enemies". Fix it.',
      hint: 'Exact names.',
      answer: "Use the same name everywhere, isInGroup('enemies').",
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'group',
        meaning: 'A name any number of nodes can carry, standing for a kind of thing.',
      },
      {
        symbol: 'isInGroup(name)',
        meaning: 'Whether this node carries the group name.',
      },
      {
        symbol: 'scene.getNodesInGroup(name)',
        meaning: 'Every node in the group, in tree order.',
      },
      {
        symbol: 'scene.callGroup(name, method, …)',
        meaning: 'Calls the method on every member that has it.',
      },
    ],
    rulesOfThumb: [
      'Ask about kinds (groups), not names.',
      'Name groups in the plural and lower case, and reuse the exact name.',
      'Use layers for what touches, groups for what a touch means.',
      'Put a node in as many groups as describe it.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'A group is a parent node that holds its members.',
      whyStudentsThinkIt: 'Grouping things usually means putting them together.',
      correctionExample: 'Enemy and Enemy2 stay where they are in the tree; each just carries the name enemies.',
      contrastCase: 'A parent changes position and drawing; a group changes nothing but membership.',
    },
    {
      falseBelief: 'A misspelt group name gives an error.',
      whyStudentsThinkIt: 'Misspelt node paths do.',
      correctionExample: "isInGroup('enemy') is simply false for nodes in enemies.",
      contrastCase: 'That silence is why group names should be copied, not retyped.',
    },
  ],

  transferPrompts: [
    {
      situation: 'Pressing E should open the nearest interactable thing (chests, doors, levers).',
      competingTechniques: [
        'Put them in a group interactables and search it',
        'Check each by name',
      ],
      whyThisTechniqueWins: 'The group covers every kind of interactable, present and future.',
    },
    {
      situation: 'A bomb should damage every enemy within 100 px.',
      competingTechniques: [
        "Loop over scene.getNodesInGroup('enemies') and check distance",
        'Loop over every node in the scene',
      ],
      whyThisTechniqueWins: 'The group gives exactly the candidates, no others.',
    },
  ],

  debugging: [
    {
      commonError: 'Adding the group to only one of the enemies.',
      symptom: 'Bullets remove Enemy but pass Enemy2.',
      whyItHappened: 'Each node joins the group separately.',
      repairStrategy: 'Add the group to every member, or to the source scene of an enemy instance.',
    },
    {
      commonError: 'Removing the bullet before checking the group.',
      symptom: 'Works, but code after queueFree runs on a leaving node and is easy to break.',
      whyItHappened: 'The order hides intent.',
      repairStrategy: 'Check and act on the body first, then remove the bullet.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Use a group to decide what a bullet hits.',
    explainVerbally: 'Explain why groups beat name checks.',
    detectIncorrectApplication: 'Spot mismatched group names.',
    transferToUnfamiliar: 'Combine group tests, and reach every member.',
  },

  assessment: {
    questions: [
      {
        id: 'mg6-003-assess-1',
        type: 'choice',
        text: 'You add a Bat to enemies. What else must change for bullets to hit it?',
        options: ['Nothing', 'bullet.js', 'The floor', 'The camera'],
        answer: 'Nothing',
        hint: 'The bullet asks about the group.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg6-003-quiz-1',
      type: 'choice',
      text: 'How does a bullet tell an enemy from the floor?',
      options: [
        "body.isInGroup('enemies')",
        "body.name === 'Floor'",
        'body.position',
        'Its collision layer only',
      ],
      answer: "body.isInGroup('enemies')",
      hints: ['Ask about the kind.'],
      reviewSection: 'Intuition — the bullet paragraph',
    },
    {
      id: 'mg6-003-quiz-2',
      type: 'choice',
      text: "What does scene.callGroup('enemies', 'freeze') do?",
      options: [
        'Calls freeze() on every enemy that has it',
        'Freezes the game',
        'Removes the group',
        'Calls freeze() once',
      ],
      answer: 'Calls freeze() on every enemy that has it',
      hints: ['One call, every member.'],
      reviewSection: 'Intuition — the reach-many paragraph',
    },
    {
      id: 'mg6-003-quiz-3',
      type: 'choice',
      text: 'How many groups can a node be in?',
      options: ['As many as you like', 'One', 'Two', 'None, groups hold scenes'],
      answer: 'As many as you like',
      hints: ['enemies and flying.'],
      reviewSection: 'Intuition — several groups',
    },
    {
      id: 'mg6-003-quiz-4',
      type: 'choice',
      text: "What happens with isInGroup('Enemies') when the group is enemies?",
      options: [
        'It is false, silently',
        'An error',
        'It is true',
        'It adds the group',
      ],
      answer: 'It is false, silently',
      hints: ['Names are exact and there is no error.'],
      reviewSection: 'Intuition — Warning: group names are exact',
    },
    {
      id: 'mg6-003-quiz-5',
      type: 'choice',
      text: 'Which of these does a group NOT do?',
      options: [
        'Move its members together',
        "Let code test a node's kind",
        'List its members',
        'Call a method on its members',
      ],
      answer: 'Move its members together',
      hints: ['That is a parent node.'],
      reviewSection: 'Misconceptions — a group is not a parent',
    },
    {
      id: 'mg6-003-quiz-6',
      type: 'choice',
      text: 'How do you count the enemies left?',
      options: [
        "scene.getNodesInGroup('enemies').length",
        'Count names starting with Enemy',
        'A fixed number',
        'scene.root.children.length',
      ],
      answer: "scene.getNodesInGroup('enemies').length",
      hints: ['The group lists its members.'],
      reviewSection: 'Challenges — count the enemies',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg6-003-1',
      label: 'Read how a bullet asks about a group',
      type: 'read',
    },
    {
      id: 'cp-mg6-003-2',
      label: 'Read how to reach every member',
      type: 'read',
    },
    {
      id: 'cp-mg6-003-3',
      label: 'Read the group procedure',
      type: 'read',
    },
    {
      id: 'cp-mg6-003-4',
      label: 'Complete "Bullets that hit only enemies" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg6-003-5',
      label: 'Add a third enemy to the group in Game Studio and shoot it',
      type: 'lab',
    },
    {
      id: 'cp-mg6-003-6',
      label: 'Work through the freeze example',
      type: 'example',
    },
    {
      id: 'cp-mg6-003-7',
      label: 'Work through the two-groups example',
      type: 'example',
    },
    {
      id: 'cp-mg6-003-8',
      label: 'Attempt the bullet-proof-enemy challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-6',
}
