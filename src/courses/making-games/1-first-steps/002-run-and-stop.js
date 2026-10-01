export default {
  order: 2,

  id: 'mg1-002',

  slug: 'run-and-stop',

  title: 'Run and Stop',

  subtitle: 'What happens when you press Run, and why changes made while the game runs are not kept.',

  tags: ['game-studio', 'game-loop', 'editor'],

  aliases: 'run stop play test game loop frames per second editor runtime project settings background',

  timeToComplete: 20,

  coreConcept: "The editor holds the game's design; Run starts a separate copy of it that plays frame by frame, and Stop throws that copy away, so only changes made in the editor are kept.",

  prerequisites: ['mg1-001'],

  nextLesson: 'mg1-003',

  hook: {
    question: 'You press Run, and while the game plays you drag the hero somewhere else. Then you press Stop. Where is the hero now?',
    realWorldContext: 'Every engine separates editing from playing. Game designers rely on it to experiment freely while a game runs, and are caught out by it when an hour of tuning vanishes on Stop.',
  },

  intuition: {
    prose: [
      'Your project has Hero at (480, 270). Press **▶ Run** (or F5). The game starts in the middle of the editor, and Hero appears at (480, 270). Nothing moves yet, because nothing tells it to.',
      "While it runs, the Inspector shows some values in purple. Purple values are the **running game's**: they change as the game plays. They are not saved. Press **■ Stop** (or F8) and the editor's own values come back.",
      'Before reading on, predict: if a script moves Hero to (700, 270) while the game runs, where is Hero after Stop? It is back at (480, 270). Run gave the game a **copy** of the project. The copy changed; the project did not.',
      'While running, the game repeats one thing many times a second: it updates every node, then draws the picture. One repeat is a **frame**. At 60 frames per second each frame lasts $1/60$ of a second, about 16.7 milliseconds.',
      "Changes that should last are made in the editor, when the game is stopped. The background colour is one: **Project › Project settings…** holds it, with the game's size, and saving keeps it.",
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Change something and test it',
        body: "Step 1. With the game stopped, make the change in the editor (a property, a setting, a script).\nStep 2. Press ▶ Run (F5) to play the game as a player would.\nStep 3. Watch for the change; purple values in the Inspector are what the running game has now.\nStep 4. Press ■ Stop (F8). The editor's values are in charge again.\nStep 5. If it was wrong, change it in the editor and run again. Save (Ctrl+S) when it is right.",
      },
      {
        type: 'warning',
        title: 'Changes while running are thrown away',
        body: 'Tuning a value while the game runs is a good way to find the right number, but Stop undoes it. Write the number down, stop, then type it into the editor.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Run your game',
        props: {
          task: 'run-and-stop',
          lesson: 'mg1-002',
          checkpoint: 'cp-mg1-002-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** A game runs as a loop. Each pass, a **frame**, does two things: update every node by the time since the last frame, then draw. If frames come $f$ times a second, each lasts $T = 1/f$ seconds: $1/60 \\approx 0.0167$ s at 60 fps, $1/144 \\approx 0.0069$ s on a fast screen.',
      'In $t$ seconds there are $f \\cdot t$ frames. Ten seconds at 60 fps is 600 frames; at 144 fps it is 1440. The number of frames depends on the screen, which is why the next lesson measures movement in seconds rather than frames.',
      'Run copies the project into a sandboxed frame (an iframe) and builds the nodes from the copy. The editor keeps the original. Stop deletes the sandbox, and with it every change the game made. This is the same reason a spreadsheet\'s "preview" never edits your file.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      "Formally, the running game is a state machine: a state (every node's properties) and a step function that maps the state at frame $n$ to frame $n + 1$ given the elapsed time and the input. Run sets the initial state from the project; Stop discards the state.",
      'The invariant is the project itself: no step of the running game writes to it. That is what makes it safe to experiment while the game runs, and also why those experiments vanish.',
      "Picture two copies side by side: the editor's scene on the left, unchanging, and the running copy on the right, changing every 16.7 ms. The purple Inspector values are a window onto the right-hand copy.",
      "Later lessons rely on this separation. A script's ready() starts from the project's values every Run, and a saved game (chapter 6) must be written on purpose, because nothing the running game does is kept by itself.",
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg1-002-ex1',
      title: 'How long is one frame?',
      difficulty: 'easy',
      problem: 'A game runs at 60 frames per second. How long does one frame last?',
      steps: [
        {
          expression: 'T = \\tfrac{1}{f}',
          annotation: 'If 60 frames fit in one second, each one gets one sixtieth of it.',
          strategyTitle: 'Step 1: One second shared between the frames',
        },
        {
          expression: 'T = \\tfrac{1}{60} \\approx 0.0167\\ \\text{s} = 16.7\\ \\text{ms}',
          annotation: 'Multiply by 1000 to turn seconds into milliseconds.',
          strategyTitle: 'Step 2: Put in the numbers',
        },
      ],
      answer: 'One frame lasts about 0.0167 seconds, or 16.7 milliseconds.',
    },
    {
      id: 'mg1-002-ex2',
      title: 'Frames in a short game',
      difficulty: 'medium',
      problem: 'You run your game for 5 seconds on a 144 fps screen. How many frames are drawn?',
      steps: [
        {
          expression: 'n = f \\cdot t',
          annotation: 'Frames per second times seconds counts the frames.',
          strategyTitle: 'Step 1: Frames are rate times time',
        },
        {
          expression: 'n = 144 \\times 5 = 720',
          annotation: 'The same 5 seconds on a 60 fps screen would be 300 frames.',
          strategyTitle: 'Step 2: Put in the numbers',
        },
      ],
      answer: '720 frames are drawn; a 60 fps screen would draw 300 in the same time.',
    },
    {
      id: 'mg1-002-ex3',
      title: 'Where did the tuning go?',
      difficulty: 'hard',
      problem: 'While the game ran, you dragged a platform from y = 400 to y = 360 until a jump just reached it, then pressed Stop. The platform is back at 400. How do you keep the change?',
      steps: [
        {
          expression: '\\text{running copy: } y = 360,\\quad \\text{project: } y = 400',
          annotation: 'The drag changed the running copy only; the project still says 400.',
          strategyTitle: 'Step 1: Say which copy changed',
        },
        {
          expression: '\\text{Stop, then set } y = 360 \\text{ in the Inspector}',
          annotation: 'With the game stopped, the Inspector edits the project.',
          strategyTitle: 'Step 2: Make the change in the editor',
        },
        {
          expression: '\\text{Run again: } y = 360',
          annotation: 'The next Run copies the new value, and Save keeps it.',
          strategyTitle: 'Step 3: Run to confirm, then save',
        },
      ],
      answer: "Stop, type 360 into the platform's y in the Inspector, run to confirm, and save.",
    },
  ],

  challenges: [
    {
      id: 'mg1-002-ch1',
      title: 'A slow screen',
      difficulty: 'easy',
      problem: 'How long is one frame at 30 frames per second?',
      hint: 'Share one second between the frames.',
      answer: 'One frame lasts 1/30 of a second, about 33.3 milliseconds.',
      walkthrough: [
        {
          expression: 'T = \\tfrac{1}{30} \\approx 0.0333\\ \\text{s}',
          annotation: 'Fewer frames a second means each frame lasts longer.',
        },
      ],
    },
    {
      id: 'mg1-002-ch2',
      title: 'Which change survives?',
      difficulty: 'medium',
      problem: 'You change the background colour in Project settings, then press Run, then move Hero while running, then press Stop. Which of the two changes is still there?',
      hint: 'Which change was made in the editor, and which in the running copy?',
      answer: "The background colour stays, because it was set in the editor; Hero's move is gone, because it was made in the running copy.",
      walkthrough: [],
    },
    {
      id: 'mg1-002-ch3',
      title: 'Count frames backwards',
      difficulty: 'hard',
      problem: 'A test counts 900 frames in 15 seconds. What frame rate was the game running at, and how long was each frame?',
      hint: 'Rearrange n = f · t for f, then use T = 1/f.',
      answer: 'It ran at 60 frames per second, so each frame lasted about 16.7 milliseconds.',
      walkthrough: [
        {
          expression: 'f = \\tfrac{n}{t} = \\tfrac{900}{15} = 60,\\quad T = \\tfrac{1}{60}',
          annotation: 'Divide frames by seconds for the rate, then invert the rate for the frame time.',
        },
      ],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'Run (F5)',
        meaning: 'Starts a copy of the project as a game, in a sandbox inside the editor.',
      },
      {
        symbol: 'Stop (F8)',
        meaning: 'Ends the running copy and throws away every change it made.',
      },
      {
        symbol: 'frame',
        meaning: 'One pass of the game loop, which updates every node and then draws the picture.',
      },
      {
        symbol: 'f (frames per second)',
        meaning: 'How many frames the game draws each second; 60 on most screens.',
      },
      {
        symbol: 'T = 1/f',
        meaning: 'How long one frame lasts, in seconds.',
      },
    ],
    rulesOfThumb: [
      'Make lasting changes with the game stopped; use the running game only to try numbers out.',
      "Purple Inspector values are the running game's and will not be saved.",
      'More frames per second means shorter frames, not a longer game.',
      'Run after every small change, so a mistake is found while you still remember what you changed.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Moving a node while the game runs moves it in the project too.',
      whyStudentsThinkIt: 'It is the same node in the same window, and it really did move.',
      correctionExample: 'Drag Hero from x = 480 to x = 700 while running, press Stop, and x is 480 again.',
      contrastCase: 'Moving Hero with the game stopped changes the project, and the next Run starts it at 700.',
    },
    {
      falseBelief: 'A game at 120 fps runs twice as long as one at 60 fps.',
      whyStudentsThinkIt: 'Twice as many frames sounds like twice as much game.',
      correctionExample: 'In 1 second, 120 fps draws 120 frames of 1/120 s each; 60 fps draws 60 of 1/60 s.',
      contrastCase: 'Both games last exactly 1 second; only the number of pictures in that second differs.',
    },
  ],

  transferPrompts: [
    {
      situation: 'You want to find the jump height that just clears a gap, trying many values quickly.',
      competingTechniques: [
        'Tune it while the game runs, write the number down, then set it in the editor',
        'Edit the value in the editor and press Run for every try',
      ],
      whyThisTechniqueWins: 'Tuning live finds the number fastest, as long as you copy the final number into the editor after Stop.',
    },
    {
      situation: 'A friend says your game "lost its colour" when they reopened it, though it looked right when you ran it.',
      competingTechniques: [
        'Check whether the colour was set in Project settings and saved',
        'Assume the running game saves its own changes',
      ],
      whyThisTechniqueWins: 'Only the project, edited with the game stopped and saved, is kept; a colour set by the running game is gone when it stops.',
    },
  ],

  debugging: [
    {
      commonError: 'Tuning values while the game runs and expecting them to stay.',
      symptom: 'After Stop, everything snaps back to how it was before Run.',
      whyItHappened: 'The running game is a copy; Stop throws it away.',
      repairStrategy: 'Note the numbers that worked, stop, type them into the Inspector, then save.',
    },
    {
      commonError: 'Pressing Run before the main scene is set.',
      symptom: 'Game Studio says to set a main scene first, and nothing starts.',
      whyItHappened: 'Run plays the main scene, and the project does not have one yet.',
      repairStrategy: 'Open Project › Project settings… and choose the scene in Main scene, or star it in Files.',
    },
  ],

  mastery: {
    targetLevel: 2,
    solveIndependently: 'Change a project setting, run the game to check it, and stop it.',
    explainVerbally: 'Explain why a change made while the game runs is gone after Stop.',
    detectIncorrectApplication: 'Recognise when a lost change was made in the running copy rather than the editor.',
    transferToUnfamiliar: 'Compute frame times and frame counts for any frame rate and duration.',
  },

  assessment: {
    questions: [
      {
        id: 'mg1-002-assess-1',
        type: 'choice',
        text: 'After Stop, which values does the editor show?',
        options: [
          "The project's values, from before Run",
          'The values the running game ended with',
          'An average of the two',
        ],
        answer: "The project's values, from before Run",
        hint: 'The running game was a copy, and Stop threw the copy away.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg1-002-quiz-1',
      type: 'choice',
      text: 'What does a frame consist of?',
      options: [
        'Updating every node, then drawing the picture',
        'Saving the project, then running it',
        'Loading one image',
        'One second of game time',
      ],
      answer: 'Updating every node, then drawing the picture',
      hints: ['A frame is one pass of the game loop.'],
      reviewSection: 'Intuition — the frame paragraph',
    },
    {
      id: 'mg1-002-quiz-2',
      type: 'choice',
      text: 'How long is one frame at 60 frames per second?',
      options: [
        'About 16.7 milliseconds',
        'About 60 milliseconds',
        '1 second',
        'About 1.67 milliseconds',
      ],
      answer: 'About 16.7 milliseconds',
      hints: ['T = 1/60 seconds; multiply by 1000 for milliseconds.'],
      reviewSection: 'Examples — How long is one frame?',
    },
    {
      id: 'mg1-002-quiz-3',
      type: 'choice',
      text: 'What do purple values in the Inspector mean?',
      options: [
        "They are the running game's values, and will not be saved",
        'They are values with errors',
        'They are the saved values',
        'They are values set by a script in the editor',
      ],
      answer: "They are the running game's values, and will not be saved",
      hints: ['They only appear while the game runs.'],
      reviewSection: 'Intuition — Warning: changes while running are thrown away',
    },
    {
      id: 'mg1-002-quiz-4',
      type: 'choice',
      text: "Where do you change the game's background colour so it is kept?",
      options: [
        'Project › Project settings…, with the game stopped',
        'In the Inspector while the game runs',
        'In the Output panel',
        'Anywhere, as long as the game is running',
      ],
      answer: 'Project › Project settings…, with the game stopped',
      hints: ['Lasting changes are made in the editor.'],
      reviewSection: 'Intuition — Procedure: Change something and test it',
    },
    {
      id: 'mg1-002-quiz-5',
      type: 'choice',
      text: 'Which of these changes is NOT kept after Stop?',
      options: [
        'A node dragged in the viewport while the game ran',
        'A position typed into the Inspector before Run',
        'A background colour set in Project settings before Run',
        'A script saved before Run',
      ],
      answer: 'A node dragged in the viewport while the game ran',
      hints: ['Only one of these was made in the running copy.'],
      reviewSection: 'Intuition — the prediction paragraph',
    },
    {
      id: 'mg1-002-quiz-6',
      type: 'choice',
      text: 'A game draws 600 frames in 5 seconds. What is its frame rate?',
      options: [
        '120 frames per second',
        '60 frames per second',
        '3000 frames per second',
        '600 frames per second',
      ],
      answer: '120 frames per second',
      hints: ['f = n / t. A near-miss is 60, the usual rate, but 600 / 5 is 120.'],
      reviewSection: 'Under the hood — frames in t seconds',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg1-002-1',
      label: 'Read what Run does',
      type: 'read',
    },
    {
      id: 'cp-mg1-002-2',
      label: 'Read why changes while running are not kept',
      type: 'read',
    },
    {
      id: 'cp-mg1-002-3',
      label: 'Read what a frame is',
      type: 'read',
    },
    {
      id: 'cp-mg1-002-4',
      label: 'Complete "Run your game" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg1-002-5',
      label: 'Move Hero while running, stop, and check it returned',
      type: 'lab',
    },
    {
      id: 'cp-mg1-002-6',
      label: 'Work through the frame-time example',
      type: 'example',
    },
    {
      id: 'cp-mg1-002-7',
      label: 'Work through the lost-tuning example',
      type: 'example',
    },
    {
      id: 'cp-mg1-002-8',
      label: 'Attempt the count-frames-backwards challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-1',
}
