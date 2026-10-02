export default {
  order: 5,

  id: 'mg6-005',

  slug: 'changing-scenes',

  title: 'Changing Scenes',

  subtitle: 'A title screen, a level, and moving between them while keeping the score.',

  tags: ['game-studio', 'scenes', 'game-states'],

  aliases: 'scene change title screen main scene game over level select keep score module',

  timeToComplete: 25,

  coreConcept: 'A game is several scenes: a title, levels, game over. The main scene is where it starts; scene.change(path) replaces the running scene with another. What must last between scenes lives in a script module, not a node.',

  prerequisites: ['mg6-004'],

  nextLesson: 'mg7-001',

  hook: {
    question: "The game should open on a title screen, start the level when Space is pressed, and show the score on a game-over screen afterwards. The level's nodes are thrown away when the scene changes. Where does the score survive?",
    realWorldContext: 'Every finished game moves between screens: menus, levels, cut-scenes, results. Godot does it with change_scene; Unity with LoadScene. Keeping state across them is a classic first problem.',
  },

  intuition: {
    prose: [
      "Make title.scene: a Node2D root named Title with a Label saying the game's name. Mark it as the main scene (☆ in Files): Run starts there now.",
      "Title's script: in update, `if (input.isJustPressed('jump')) scene.change('scenes/main.scene')`. The title's nodes are removed, main.scene is built fresh, and its ready() methods run.",
      'Before reading on, predict: Player keeps score = 7 in a field, and the level changes to gameover.scene. What is score there? There is no Player any more: its field went with it.',
      "To keep it, put it in a script module: `scripts/state.js` exports an object, `export const state = { score: 0 }`. Any script imports it, `import { state } from './state.js'`. Modules load once per game, so the object survives every scene change.",
      'The game over scene reads `state.score` to show it; pressing Space sets `state.score = 0` and changes back to the title.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Move between scenes',
        body: "Step 1. Make each screen its own scene (title, level, game over).\nStep 2. Mark the first as the main scene (☆ beside it in Files).\nStep 3. Where the screen should end, call scene.change('scenes/next.scene').\nStep 4. Keep anything that must last in a module (scripts/state.js) and import it where needed.\nStep 5. Run from the start and go round the whole loop.",
      },
      {
        type: 'warning',
        title: 'Nodes do not survive a change',
        body: 'After scene.change, every node of the old scene is gone, with its fields. Keep a reference to an old node and using it fails. Store values, not nodes, in the state module.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'A title screen',
        props: {
          task: 'title-scene',
          lesson: 'mg6-005',
          checkpoint: 'cp-mg6-005-4',
        },
      },
    ],
  },

  math: {
    prose: [
      "**Under the hood (optional).** A game's screens form a **state machine**: states (title, level, game over) and transitions (Space on the title → level; out of health → game over; Space → title). At any time exactly one state is active.",
      "scene.change is a transition: it ends the current state (freeing its nodes at the end of the frame) and enters the next (building it and calling ready). Nothing of the old state's nodes remains.",
      "Data with a longer life than a state lives outside it. Modules are loaded once per run, so their top-level objects last as long as the game does; this is the same idea as Godot's autoloads.",
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, the screen flow is a finite automaton $(S, s_0, \\delta)$: screens $S$, start $s_0$ (the main scene), and transitions $\\delta$ triggered by events.',
      "The invariant across transitions is the module state; everything owned by a scene is recreated from the scene's file on entry, so each level starts the same way.",
      "Draw each scene as a box and each scene.change as an arrow labelled with what triggers it; the whole game's structure fits on one page.",
      "Inside a scene, the same pattern recurs: a player has states (idle, running, jumping), a boss has phases. Chapter 7's Tetris has playing and over.",
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg6-005-ex1',
      title: 'Where the game starts',
      difficulty: 'easy',
      problem: 'title.scene is marked ☆ and main.scene is not. Which scene does Run show first?',
      steps: [
        {
          expression: '\\text{main scene} = \\text{title.scene}',
          annotation: 'The starred scene is where Run begins.',
          strategyTitle: 'Step 1: The main scene',
        },
      ],
      answer: 'The title screen.',
    },
    {
      id: 'mg6-005-ex2',
      title: 'Keeping the score',
      difficulty: 'medium',
      problem: 'Player adds 10 to state.score for each coin (state from scripts/state.js). After 3 coins the game changes to gameover.scene. What can it show?',
      steps: [
        {
          expression: '3 \\times 10 = 30',
          annotation: "The module's object kept counting.",
          strategyTitle: 'Step 1: The count',
        },
        {
          expression: '\\texttt{state.score} = 30 \\text{ after the change}',
          annotation: 'Modules survive scene changes.',
          strategyTitle: 'Step 2: Across the change',
        },
      ],
      answer: 'Score: 30, read from state.score.',
    },
    {
      id: 'mg6-005-ex3',
      title: 'The whole loop',
      difficulty: 'hard',
      problem: 'Title → level → game over → title. Write the transitions and what resets.',
      steps: [
        {
          expression: '\\text{title} \\xrightarrow{\\text{Space}} \\text{level} \\xrightarrow{\\text{health} = 0} \\text{game over} \\xrightarrow{\\text{Space}} \\text{title}',
          annotation: 'Each arrow is a scene.change in the scene it leaves.',
          strategyTitle: 'Step 1: Transitions',
        },
        {
          expression: '\\text{state.score} \\leftarrow 0 \\text{ when leaving game over}',
          annotation: "The level's nodes reset by themselves; the module's score must be reset on purpose.",
          strategyTitle: 'Step 2: What resets',
        },
      ],
      answer: 'Three scene.change calls; reset state.score when a new game starts, since only it survives.',
    },
  ],

  challenges: [
    {
      id: 'mg6-005-ch1',
      title: 'A second level',
      difficulty: 'easy',
      problem: "Reaching a flag should start level 2. What call goes in the flag's bodyEntered?",
      hint: 'Change scene.',
      answer: "scene.change('scenes/level2.scene').",
      walkthrough: [
        {
          expression: '\\texttt{scene.change("scenes/level2.scene")}',
          annotation: 'A transition to the next state.',
        },
      ],
    },
    {
      id: 'mg6-005-ch2',
      title: 'Lives across levels',
      difficulty: 'medium',
      problem: 'Lives should carry from level 1 to level 2. Where do they live?',
      hint: 'What survives a change?',
      answer: 'In the state module (state.lives), not in Player.',
      walkthrough: [],
    },
    {
      id: 'mg6-005-ch3',
      title: 'Debug the forgotten score',
      difficulty: 'hard',
      problem: 'The game over screen always shows Score 0. The score was a field on Player. Why, and what fixes it?',
      hint: "What happens to Player's fields on a scene change?",
      answer: 'Player was freed with the level, taking its field; keep the score in scripts/state.js and read it there.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'main scene',
        meaning: 'The scene Run starts with (☆ in Files).',
      },
      {
        symbol: 'scene.change(path)',
        meaning: 'Replaces the running scene with another, built fresh.',
      },
      {
        symbol: 'script module',
        meaning: 'A script file loaded once per game; its exports survive scene changes.',
      },
      {
        symbol: 'state machine',
        meaning: 'States with transitions between them; exactly one is active.',
      },
    ],
    rulesOfThumb: [
      'One screen, one scene.',
      'Keep values that must last in a state module.',
      "Reset the module's values when a new game starts.",
      'Draw the screen flow before building it.',
    ],
  },

  misconceptions: [
    {
      falseBelief: "A node's fields survive scene.change.",
      whyStudentsThinkIt: 'The game is still running.',
      correctionExample: 'Player.score = 7 is gone after changing to gameover.scene, with Player.',
      contrastCase: 'state.score in a module is still 7.',
    },
    {
      falseBelief: 'scene.change keeps the old scene and adds the new one.',
      whyStudentsThinkIt: 'instantiate adds things.',
      correctionExample: "After the change, none of the title's nodes exist.",
      contrastCase: 'To add things to the current scene, use instantiate and addChild.',
    },
  ],

  transferPrompts: [
    {
      situation: 'The game should remember the highest score while it runs.',
      competingTechniques: [
        'A best field in the state module, updated at game over',
        "A field on the game-over scene's root",
      ],
      whyThisTechniqueWins: 'The module survives every change; the game-over scene is rebuilt each time.',
    },
    {
      situation: 'A pause menu should appear over the level without losing it.',
      competingTechniques: [
        'A CanvasLayer menu shown in the same scene',
        'scene.change to a pause scene',
      ],
      whyThisTechniqueWins: 'Changing scene would throw the level away; an overlay keeps it.',
    },
  ],

  debugging: [
    {
      commonError: 'Forgetting to mark the title as the main scene.',
      symptom: 'Run starts on the level, skipping the title.',
      whyItHappened: 'Run starts at the main scene.',
      repairStrategy: 'Press ☆ beside title.scene in Files.',
    },
    {
      commonError: 'Mistyping the path in scene.change.',
      symptom: 'An error that there is no such scene, when Space is pressed.',
      whyItHappened: 'Paths are exact and include scenes/ and .scene.',
      repairStrategy: 'Copy the path from Files.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Build a title, a level and a game over, with the score kept between them.',
    explainVerbally: 'Explain scene.change and why modules survive it.',
    detectIncorrectApplication: 'Spot state kept in nodes that a change will free.',
    transferToUnfamiliar: "Design a game's screen flow as a state machine.",
  },

  assessment: {
    questions: [
      {
        id: 'mg6-005-assess-1',
        type: 'choice',
        text: 'Where should the score live to survive scene changes?',
        options: ['In a script module', 'On Player', 'In a Label', 'On the camera'],
        answer: 'In a script module',
        hint: 'Modules load once per game.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg6-005-quiz-1',
      type: 'choice',
      text: 'What does scene.change do?',
      options: [
        'Replaces the running scene with another',
        'Adds a scene on top',
        'Saves the scene',
        'Restarts the editor',
      ],
      answer: 'Replaces the running scene with another',
      hints: ['The old nodes are gone.'],
      reviewSection: 'Intuition — the change paragraph',
    },
    {
      id: 'mg6-005-quiz-2',
      type: 'choice',
      text: 'Which scene does Run start with?',
      options: [
        'The main scene',
        'The scene open in the editor',
        'The first scene alphabetically',
        'The newest scene',
      ],
      answer: 'The main scene',
      hints: ['☆ in Files.'],
      reviewSection: 'Examples — Where the game starts',
    },
    {
      id: 'mg6-005-quiz-3',
      type: 'choice',
      text: 'Why does state.score survive a scene change?',
      options: [
        'Modules load once per game',
        'Labels remember it',
        'scene.change copies fields',
        'It is saved to disk',
      ],
      answer: 'Modules load once per game',
      hints: ['The module is not part of any scene.'],
      reviewSection: 'Under the hood — longer life',
    },
    {
      id: 'mg6-005-quiz-4',
      type: 'choice',
      text: 'How many screens are active at once in a state machine?',
      options: ['Exactly one', 'All of them', 'Two', 'None'],
      answer: 'Exactly one',
      hints: ['One state at a time.'],
      reviewSection: 'Under the hood — state machine',
    },
    {
      id: 'mg6-005-quiz-5',
      type: 'choice',
      text: 'Which of these does NOT survive scene.change?',
      options: [
        'A field on Player',
        'state.score in a module',
        'An exported constant',
        "The project's settings",
      ],
      answer: 'A field on Player',
      hints: ['Player goes with its scene.'],
      reviewSection: 'Misconceptions — fields',
    },
    {
      id: 'mg6-005-quiz-6',
      type: 'choice',
      text: 'A pause menu should keep the level. Which approach?',
      options: [
        'A CanvasLayer overlay in the same scene',
        'scene.change to a pause scene',
        'queueFree the level',
        'A new main scene',
      ],
      answer: 'A CanvasLayer overlay in the same scene',
      hints: ['Changing scene throws the level away.'],
      reviewSection: 'Transfer — pause menu',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg6-005-1',
      label: 'Read how scene.change works',
      type: 'read',
    },
    {
      id: 'cp-mg6-005-2',
      label: 'Read where state survives',
      type: 'read',
    },
    {
      id: 'cp-mg6-005-3',
      label: 'Read the scene-flow procedure',
      type: 'read',
    },
    {
      id: 'cp-mg6-005-4',
      label: 'Complete "A title screen" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg6-005-5',
      label: 'Add a game over scene with the score in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg6-005-6',
      label: 'Work through the keeping-the-score example',
      type: 'example',
    },
    {
      id: 'cp-mg6-005-7',
      label: 'Work through the whole-loop example',
      type: 'example',
    },
    {
      id: 'cp-mg6-005-8',
      label: 'Attempt the forgotten-score challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-6',
}
