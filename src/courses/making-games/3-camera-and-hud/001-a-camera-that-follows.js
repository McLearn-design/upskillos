export default {
  order: 1,

  id: 'mg3-001',

  slug: 'a-camera-that-follows',

  title: 'A Camera That Follows',

  subtitle: 'Scroll a level longer than the screen, smoothly, the same on every screen.',

  tags: ['game-studio', 'camera'],

  aliases: 'camera2d follow smoothing scroll view exponential smoothing lerp frame rate independent',

  timeToComplete: 25,

  coreConcept: 'A Camera2D decides which part of the world the screen shows: its position is the centre of the view. Under a node, it goes where the node goes. With smoothing k, the view closes a fraction 1 − e^(−k·dt) of the gap each frame, which feels the same at any frame rate.',

  prerequisites: ['mg2-005'],

  nextLesson: 'mg3-002',

  hook: {
    question: 'A level is 3000 pixels long and the screen 960 wide. How does the screen show the part where the player is, and how do you make it glide instead of jump?',
    realWorldContext: 'Nearly every game that is bigger than one screen has a camera that follows the player. How it follows, snapping, lagging or leading, is one of the first things players feel.',
  },

  intuition: {
    prose: [
      "The world is 3000 pixels wide; the screen shows 960 of them. If the camera is at x = 1500, the screen shows world x from 1500 − 480 = 1020 to 1500 + 480 = 1980: the camera's position is the middle of the view.",
      "Put the Camera2D under Player. A child goes where its parent goes, so the camera is always at Player's position, and Player is always in the middle of the screen.",
      "Snapping like that can feel stiff. Set the camera's `smoothing` to 5. Now the view does not jump to the camera; each frame it moves part of the way there.",
      'Before reading on, predict: with smoothing 5, how much of a sudden 100-pixel gap is left after one second? Each second leaves e^(−5) ≈ 0.007 of it: under 1 pixel. Half the gap goes in about 0.14 seconds.',
      'The fraction moved each frame is 1 − e^(−k·dt), not a fixed 10%, so a 144 fps screen catches up exactly as fast as a 60 fps one.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Make the view follow the player',
        body: 'Step 1. Add a Camera2D as a child of Player.\nStep 2. Leave current ticked: the current camera is the one the screen uses.\nStep 3. Run, and walk: the view keeps Player in the middle.\nStep 4. Set smoothing (5 is gentle, 10 is snappy, 0 snaps) and run again.\nStep 5. Check how quickly it catches up when Player stops.',
      },
      {
        type: 'warning',
        title: 'A camera beside the player does nothing',
        body: 'A Camera2D added to the scene root stays where you put it, and the player walks off the screen. It must be under Player in the scene tree (indented beneath it) to follow.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'A camera that follows',
        props: {
          task: 'follow-camera',
          lesson: 'mg3-001',
          checkpoint: 'cp-mg3-001-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** Let $g$ be the gap between where the view is and where the camera is. Each frame of length $\\Delta t$ the view moves a fraction $f = 1 - e^{-k\\,\\Delta t}$ of the gap, so the gap becomes $g\\,e^{-k\\,\\Delta t}$.',
      'After frames of lengths $\\Delta t_1, \\ldots, \\Delta t_n$ the gap is $g\\,e^{-k\\Delta t_1} \\cdots e^{-k\\Delta t_n} = g\\,e^{-k(\\Delta t_1 + \\cdots + \\Delta t_n)} = g\\,e^{-k t}$. It depends only on the elapsed time $t$: that is why it is frame-rate independent.',
      'A fixed fraction per frame, say 10%, would leave $0.9^n$ after $n$ frames: $0.9^{60} \\approx 0.002$ after a second at 60 fps, but $0.9^{144} \\approx 0.0000025$ at 144 fps. The half-life of $e^{-kt}$ is $\\ln 2 / k$: 0.139 s for $k = 5$.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      "Formally, the view $p$ follows the target $c$ by $\\dot{p} = k(c - p)$, whose exact solution over one step is $p \\leftarrow c + (p - c)e^{-k\\Delta t}$. Using $1 - e^{-k\\Delta t}$ as the step's fraction is that exact solution, not an approximation.",
      'The invariant is the decay per unit time: whatever the frame lengths, the gap shrinks by $e^{-k}$ each second.',
      "Geometrically, the view's distance from the target against time is an exponential decay curve, steep at first and flattening as it closes.",
      'The same smoothing appears for volume fades, health bars that drain, and following enemies. Lerping by a fixed fraction per frame, a common shortcut, is the frame-rate-dependent version of it.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg3-001-ex1',
      title: 'What the screen shows',
      difficulty: 'easy',
      problem: 'The camera is at x = 1500 and the screen is 960 wide. Which world x does the screen show?',
      steps: [
        {
          expression: '1500 - \\tfrac{960}{2} = 1020',
          annotation: 'The camera is the middle; half the screen is to its left.',
          strategyTitle: 'Step 1: Left edge',
        },
        {
          expression: '1500 + 480 = 1980',
          annotation: 'And half to its right.',
          strategyTitle: 'Step 2: Right edge',
        },
      ],
      answer: 'The screen shows world x from 1020 to 1980.',
    },
    {
      id: 'mg3-001-ex2',
      title: 'How fast it catches up',
      difficulty: 'medium',
      problem: 'With smoothing 5, the view is 100 px behind when Player stops. How far behind is it after 0.2 s?',
      steps: [
        {
          expression: '100 \\times e^{-5 \\times 0.2} = 100 \\times e^{-1} \\approx 36.8',
          annotation: 'The gap shrinks by e to the minus k times the time.',
          strategyTitle: 'Step 1: Decay over the time',
        },
      ],
      answer: 'About 37 pixels behind after 0.2 seconds.',
    },
    {
      id: 'mg3-001-ex3',
      title: 'The same on two screens',
      difficulty: 'hard',
      problem: 'Show that with smoothing 5, one second leaves the same gap at 60 fps and at 144 fps.',
      steps: [
        {
          expression: '(e^{-5/60})^{60} = e^{-5}',
          annotation: 'Sixty frames, each leaving e^(−5/60).',
          strategyTitle: 'Step 1: 60 fps',
        },
        {
          expression: '(e^{-5/144})^{144} = e^{-5}',
          annotation: 'The exponents add to −5 either way.',
          strategyTitle: 'Step 2: 144 fps',
        },
      ],
      answer: 'Both leave e^(−5) ≈ 0.7% of the gap, so the camera feels the same on both screens.',
    },
  ],

  challenges: [
    {
      id: 'mg3-001-ch1',
      title: 'A wider screen',
      difficulty: 'easy',
      problem: 'A 1280-wide screen with the camera at x = 800. Which world x does it show?',
      hint: 'Half the width each side.',
      answer: 'From 160 to 1440.',
      walkthrough: [
        {
          expression: '800 \\pm 640',
          annotation: 'Half of 1280 is 640.',
        },
      ],
    },
    {
      id: 'mg3-001-ch2',
      title: 'Half-life',
      difficulty: 'medium',
      problem: 'With smoothing 10, how long until a gap halves?',
      hint: 'The half-life is ln 2 ÷ k.',
      answer: 'About 0.069 seconds, because 0.693 ÷ 10 ≈ 0.069.',
      walkthrough: [],
    },
    {
      id: 'mg3-001-ch3',
      title: 'Debug the runaway player',
      difficulty: 'hard',
      problem: 'A learner added a Camera2D, ran, and the player walked off the screen. The camera is at the scene root. Fix it.',
      hint: 'Where must the camera be in the tree?',
      answer: "Drag the Camera2D onto Player so it is Player's child; then it moves with Player.",
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'Camera2D',
        meaning: 'Decides what the screen shows: its position is the middle of the view.',
      },
      {
        symbol: 'current',
        meaning: 'The camera the screen uses; only one is current at a time.',
      },
      {
        symbol: 'smoothing',
        meaning: 'How quickly the view catches up: 0 snaps, bigger is snappier.',
      },
      {
        symbol: '1 − e^(−k·dt)',
        meaning: 'The fraction of the gap closed in a frame of length dt.',
      },
      {
        symbol: 'ln 2 / k',
        meaning: 'How long it takes to close half the gap.',
      },
    ],
    rulesOfThumb: [
      'Put the camera under what it follows.',
      'Smoothing 5 is gentle, 10 is snappy; above 20 feels like no smoothing.',
      "Scale each frame's fraction by dt, never use a fixed fraction.",
      'Check smoothing by stopping suddenly and watching the catch-up.',
    ],
  },

  misconceptions: [
    {
      falseBelief: "The camera's position is the top-left corner of the screen.",
      whyStudentsThinkIt: "The game area's own origin is its top-left corner.",
      correctionExample: 'A camera at (1500, 270) on a 960 × 540 screen shows x 1020 to 1980.',
      contrastCase: 'Only with no camera does the screen show the world from (0, 0).',
    },
    {
      falseBelief: 'Smoothing 0.1 per frame works the same everywhere.',
      whyStudentsThinkIt: 'The code looks the same on every screen.',
      correctionExample: 'After 1 s, 10% per frame leaves 0.2% of the gap at 60 fps but 0.0003% at 144 fps.',
      contrastCase: '1 − e^(−k·dt) leaves e^(−k) after one second on any screen.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A health bar should drain smoothly towards the real health.',
      competingTechniques: [
        'Move it by 1 − e^(−k·dt) of the gap each frame',
        'Move it 10% of the gap each frame',
      ],
      whyThisTechniqueWins: 'The exponential form drains at the same speed whatever the frame rate.',
    },
    {
      situation: 'A boss arena should stay still on screen while the player moves inside it.',
      competingTechniques: [
        'A Camera2D placed in the arena, not under the player',
        'A Camera2D under the player',
      ],
      whyThisTechniqueWins: 'A camera that is not a child of the player stays put and frames the arena.',
    },
  ],

  debugging: [
    {
      commonError: 'Two cameras both ticked current.',
      symptom: 'The view follows the wrong one.',
      whyItHappened: 'The screen can use only one camera.',
      repairStrategy: 'Untick current on the camera you are not using.',
    },
    {
      commonError: 'Smoothing set very high to "make it smooth".',
      symptom: 'It feels exactly like no smoothing.',
      whyItHappened: 'A big k closes the gap almost entirely every frame.',
      repairStrategy: 'Lower smoothing to between 3 and 10.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Make a camera follow, with chosen smoothing.',
    explainVerbally: "Explain what the camera's position means and why the smoothing formula is frame-rate independent.",
    detectIncorrectApplication: 'Spot fixed-fraction smoothing and replace it.',
    transferToUnfamiliar: 'Use exponential smoothing for other values that should glide.',
  },

  assessment: {
    questions: [
      {
        id: 'mg3-001-assess-1',
        type: 'choice',
        text: "Camera at x = 1000, screen 960 wide. What is the screen's left edge in the world?",
        options: ['520', '1000', '40', '0'],
        answer: '520',
        hint: 'The camera is the middle.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg3-001-quiz-1',
      type: 'choice',
      text: 'Where must a Camera2D be to follow Player?',
      options: [
        'Under Player in the scene tree',
        'At the scene root',
        'Anywhere, if current is ticked',
        'Under the floor',
      ],
      answer: 'Under Player in the scene tree',
      hints: ['A child goes where its parent goes.'],
      reviewSection: 'Intuition — Warning: a camera beside the player',
    },
    {
      id: 'mg3-001-quiz-2',
      type: 'choice',
      text: 'With smoothing k, what fraction of the gap is closed in a frame of length dt?',
      options: ['1 − e^(−k·dt)', 'k·dt always', '10%', 'e^(−k)'],
      answer: '1 − e^(−k·dt)',
      hints: ['k·dt is close for small values but can exceed 1.'],
      reviewSection: 'Under the hood — the fraction',
    },
    {
      id: 'mg3-001-quiz-3',
      type: 'choice',
      text: 'Smoothing 5, a 100 px gap. How much is left after 1 s?',
      options: ['Under 1 px', '50 px', '20 px', '0 px exactly'],
      answer: 'Under 1 px',
      hints: ['100 × e^(−5) ≈ 0.67.'],
      reviewSection: 'Intuition — the prediction paragraph',
    },
    {
      id: 'mg3-001-quiz-4',
      type: 'choice',
      text: 'What is the half-life with smoothing 5?',
      options: ['About 0.14 s', 'About 0.2 s', '5 s', 'About 0.7 s'],
      answer: 'About 0.14 s',
      hints: ['ln 2 ÷ 5.'],
      reviewSection: 'Under the hood — half-life',
    },
    {
      id: 'mg3-001-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT frame-rate independent?',
      options: [
        'Closing 10% of the gap every frame',
        'Closing 1 − e^(−k·dt) of it',
        'Moving speed × dt',
        'Counting a timer down by dt',
      ],
      answer: 'Closing 10% of the gap every frame',
      hints: ['More frames close more.'],
      reviewSection: 'Misconceptions — fixed fractions',
    },
    {
      id: 'mg3-001-quiz-6',
      type: 'choice',
      text: 'Smoothing 0 means what?',
      options: [
        'The view snaps to the camera',
        'The camera never moves',
        'The view never catches up',
        'Smoothing is maximal',
      ],
      answer: 'The view snaps to the camera',
      hints: ['No smoothing at all.'],
      reviewSection: 'Intuition — Procedure',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg3-001-1',
      label: 'Read what the screen shows for a camera position',
      type: 'read',
    },
    {
      id: 'cp-mg3-001-2',
      label: 'Read why the camera goes under Player',
      type: 'read',
    },
    {
      id: 'cp-mg3-001-3',
      label: 'Read how smoothing closes the gap',
      type: 'read',
    },
    {
      id: 'cp-mg3-001-4',
      label: 'Complete "A camera that follows" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg3-001-5',
      label: 'Try smoothing 2 and 15 in Game Studio and compare',
      type: 'lab',
    },
    {
      id: 'cp-mg3-001-6',
      label: 'Work through the catch-up example',
      type: 'example',
    },
    {
      id: 'cp-mg3-001-7',
      label: 'Work through the two-screens example',
      type: 'example',
    },
    {
      id: 'cp-mg3-001-8',
      label: 'Attempt the runaway-player challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-3',
}
