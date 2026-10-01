export default {
  order: 3,

  id: 'mg1-003',

  slug: 'your-first-script',

  title: 'Your First Script',

  subtitle: 'Make Hero move at 100 pixels a second, the same on every screen, with update(dt).',

  tags: ['game-studio', 'scripting', 'javascript', 'delta-time'],

  aliases: 'script class extends sprite2d ready update dt delta time speed pixels per second frame rate independent',

  timeToComplete: 30,

  coreConcept: 'A script is a class whose update(dt) runs every frame; moving by speed × dt each frame moves the same distance every second, whatever the frame rate.',

  prerequisites: ['mg1-002'],

  nextLesson: 'mg1-004',

  hook: {
    question: 'Two players run your game, one on a 60 fps laptop and one on a 144 fps monitor. Your hero moves 2 pixels every frame. Who wins the race across the screen, and by how much?',
    realWorldContext: "Early PC games tied movement to frames, and became unplayably fast on newer computers. Every engine since gives scripts the frame's duration, dt, so that speed is measured in seconds.",
  },

  intuition: {
    prose: [
      'Hero is at x = 480. Every frame, add 2 to x. After 60 frames x is 600: Hero moved 120 pixels. At 60 frames per second, that took one second, so the speed is 120 pixels per second.',
      'Before reading on, predict: on a 144 fps screen, how far does the same code move Hero in one second? 144 frames × 2 pixels = 288 pixels. The faster screen makes Hero more than twice as fast. That is the bug this lesson fixes.',
      "A **script** is code attached to a node. In Game Studio it is a JavaScript **class** that extends the node's type: `export default class Hero extends Sprite2D`. Inside, `this` is the node, so `this.position` is Hero's position.",
      'Game Studio calls two methods for you. `ready()` runs once, when the game starts. `update(dt)` runs every frame, and `dt` is the time since the last frame in seconds: 1/60 ≈ 0.0167 at 60 fps.',
      'The fix is to move by **speed × dt** each frame. With speed = 100: at 60 fps each frame moves 100 × (1/60) ≈ 1.67 pixels, and 60 of them make 100. At 144 fps each moves 0.69, and 144 of them make 100. Same distance per second, on any screen.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Move a node at a steady speed',
        body: "Step 1. Select the node and press New script in the Inspector; the script opens with ready() and update(dt).\nStep 2. Add a field for the speed in pixels per second: speed = 100;\nStep 3. In update(dt), work out this frame's distance: this.speed * dt.\nStep 4. Set the position with x increased by that distance: this.position = { x: this.position.x + this.speed * dt, y: this.position.y };\nStep 5. Run, and check the speed against a known distance (100 px in 1 s).",
      },
      {
        type: 'warning',
        title: 'A number per frame is not a speed',
        body: 'Adding a fixed number each frame ties the speed to the screen: 2 per frame is 120 px/s at 60 fps and 288 px/s at 144 fps. Always multiply by dt.',
      },
      {
        type: 'definition',
        title: 'Class, field and method',
        body: 'A class describes a kind of object. A field (speed = 100) is a value each object keeps. A method (update) is something it can do. Game Studio makes one object of your class for the node.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Make Hero move',
        props: {
          task: 'first-script',
          lesson: 'mg1-003',
          checkpoint: 'cp-mg1-003-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** Let the frames last $dt_1, dt_2, \\ldots, dt_n$ seconds. They add up to the elapsed time: $dt_1 + dt_2 + \\cdots + dt_n = t$. Moving by $v \\cdot dt_i$ in frame $i$ gives a total distance $v \\cdot dt_1 + \\cdots + v \\cdot dt_n$.',
      'Factor out $v$: the total is $v (dt_1 + \\cdots + dt_n) = v \\cdot t$. That is distance = speed × time, true however many frames there were and however long each one was. This is why the result does not depend on the frame rate.',
      'With a fixed step $s$ per frame instead, the total is $n \\cdot s = f t s$, because there are $f t$ frames in $t$ seconds. It grows with the frame rate $f$: at $s = 2$, $t = 1$, it is 120 at 60 fps and 288 at 144 fps.',
      'The game checks this exactly: the task runs your script at 30 and at 144 frames per second and measures how far Hero went in one second. With speed × dt both are 100 pixels, to within rounding.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      "Formally, update(dt) is a numerical integration of position over time: $x_{n+1} = x_n + v \\, dt_n$ (Euler's method). For constant $v$ it is exact, because the velocity does not change inside a frame.",
      'The invariant is distance per second, $v$. The number of frames and their lengths vary from screen to screen; their sum, the elapsed time, does not, and the method only ever uses that sum.',
      'On a graph of position against time, each frame is a short straight segment of slope $v$. Whatever the segment lengths, consecutive segments of the same slope form one straight line.',
      "When speed itself changes, as with gravity in chapter 2, Euler's method is no longer exact: the error depends on $dt$. That is why physics runs at a fixed step of 1/60 s, a topic for that chapter.",
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg1-003-ex1',
      title: "One frame's distance",
      difficulty: 'easy',
      problem: "Hero's speed is 100 pixels per second. How far does it move in one frame at 60 fps?",
      steps: [
        {
          expression: 'dt = \\tfrac{1}{60} \\approx 0.0167\\ \\text{s}',
          annotation: 'dt is the time since the last frame; at 60 fps it is a sixtieth of a second.',
          strategyTitle: 'Step 1: Find dt',
        },
        {
          expression: 'v \\cdot dt = 100 \\times \\tfrac{1}{60} \\approx 1.67\\ \\text{px}',
          annotation: 'This is what `this.speed * dt` works out each frame.',
          strategyTitle: 'Step 2: Multiply speed by dt',
        },
      ],
      answer: 'Hero moves about 1.67 pixels each frame, which adds up to 100 pixels over 60 frames.',
    },
    {
      id: 'mg1-003-ex2',
      title: 'The same second on two screens',
      difficulty: 'medium',
      problem: 'Show that speed × dt moves Hero 100 pixels in one second at both 30 fps and 144 fps.',
      steps: [
        {
          expression: '30 \\times \\left(100 \\times \\tfrac{1}{30}\\right) = 30 \\times 3.33 = 100',
          annotation: 'Fewer, longer frames each move further.',
          strategyTitle: 'Step 1: 30 frames of 1/30 s',
        },
        {
          expression: '144 \\times \\left(100 \\times \\tfrac{1}{144}\\right) = 144 \\times 0.694 = 100',
          annotation: 'More, shorter frames each move less.',
          strategyTitle: 'Step 2: 144 frames of 1/144 s',
        },
        {
          expression: '100 = 100',
          annotation: 'The task checks exactly this: it runs your script at 30 and 144 fps.',
          strategyTitle: 'Step 3: Compare',
        },
      ],
      answer: 'Both screens move Hero 100 pixels in one second, because frames × (speed × dt) = speed × time.',
    },
    {
      id: 'mg1-003-ex3',
      title: 'Fixing a frame-tied speed',
      difficulty: 'hard',
      problem: 'A script does `this.position = { x: this.position.x + 3, y: this.position.y }` and the designer liked the speed on their 60 fps laptop. Rewrite it so every screen gets that speed.',
      steps: [
        {
          expression: '3 \\times 60 = 180\\ \\text{px/s}',
          annotation: 'The speed the designer saw was 3 pixels per frame times 60 frames per second.',
          strategyTitle: 'Step 1: Find the speed they liked',
        },
        {
          expression: 'x \\leftarrow x + 180 \\cdot dt',
          annotation: 'Add a field `speed = 180;` and use `this.position.x + this.speed * dt`.',
          strategyTitle: 'Step 2: Multiply that speed by dt',
        },
        {
          expression: '144 \\times 180 \\times \\tfrac{1}{144} = 180',
          annotation: 'On a 144 fps screen it is now 180 px/s too, instead of 432.',
          strategyTitle: 'Step 3: Check on another screen',
        },
      ],
      answer: 'Use speed = 180 and move by this.speed * dt; every screen then moves 180 pixels per second.',
    },
  ],

  challenges: [
    {
      id: 'mg1-003-ch1',
      title: 'Slower hero',
      difficulty: 'easy',
      problem: 'How far does a hero with speed 50 move in 4 seconds?',
      hint: 'Distance is speed × time.',
      answer: 'It moves 200 pixels, because 50 × 4 = 200.',
      walkthrough: [
        {
          expression: '50 \\times 4 = 200',
          annotation: 'The frame rate does not appear, because speed × dt adds up to speed × time.',
        },
      ],
    },
    {
      id: 'mg1-003-ch2',
      title: 'Crossing the screen',
      difficulty: 'medium',
      problem: 'Hero starts at x = 0 with speed 240. How long until it reaches the right edge of a 960-wide game?',
      hint: 'Rearrange distance = speed × time for time.',
      answer: 'It takes 4 seconds, because 960 / 240 = 4.',
      walkthrough: [
        {
          expression: 't = \\tfrac{960}{240} = 4\\ \\text{s}',
          annotation: 'Time is distance divided by speed.',
        },
      ],
    },
    {
      id: 'mg1-003-ch3',
      title: 'Diagnose the race',
      difficulty: 'hard',
      problem: 'Two testers report the same race: one finished in 8 seconds, the other in 3.3 seconds. The code adds 2 to x every frame and the track is 960 pixels. What were their frame rates?',
      hint: 'With a fixed step, speed is step × frames per second.',
      answer: 'About 60 fps and 144 fps: 960 / (2 × 60) = 8 s and 960 / (2 × 144) ≈ 3.3 s; multiplying by dt would make both take the same time.',
      walkthrough: [
        {
          expression: 'f = \\tfrac{960}{2 \\cdot t}: \\quad \\tfrac{960}{16} = 60,\\ \\tfrac{960}{6.67} \\approx 144',
          annotation: "Solve t = 960 / (2f) for f with each tester's time.",
        },
      ],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'script',
        meaning: 'A class attached to a node that gives it behaviour; this inside it is the node.',
      },
      {
        symbol: 'ready()',
        meaning: 'Runs once when the game starts, for setting things up.',
      },
      {
        symbol: 'update(dt)',
        meaning: 'Runs every frame; the place to change things over time.',
      },
      {
        symbol: 'dt',
        meaning: "The seconds since the last frame, about 0.0167 at 60 fps; frames' dt add up to the elapsed time.",
      },
      {
        symbol: 'speed × dt',
        meaning: "This frame's distance, so that the total per second is the speed on any screen.",
      },
    ],
    rulesOfThumb: [
      'Every change over time in update(dt) is multiplied by dt.',
      'Keep speeds in fields measured per second, so they read like real speeds.',
      'Check movement against a known distance and time, such as 100 px in 1 s.',
      'If a game feels faster on a better screen, look for a change without dt.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'update(dt) runs once per second.',
      whyStudentsThinkIt: 'Speeds are written per second, so the code looks like it describes one second.',
      correctionExample: 'At 60 fps, update runs 60 times a second, each time with dt ≈ 0.0167.',
      contrastCase: 'If update ran once a second, Hero would jump 100 pixels at a time instead of gliding.',
    },
    {
      falseBelief: 'Multiplying by dt makes a game slower.',
      whyStudentsThinkIt: 'dt is a small number, and multiplying by a small number shrinks things.',
      correctionExample: 'Speed 100 × dt 0.0167 is 1.67 px a frame, and 60 frames make exactly 100 px.',
      contrastCase: "The per-frame step is small, but there are many frames; the per-second speed is the field's value.",
    },
  ],

  transferPrompts: [
    {
      situation: "A cloud should drift across the sky so it takes exactly 30 seconds, on every player's screen.",
      competingTechniques: [
        'A speed in pixels per second multiplied by dt',
        'A fixed number of pixels added each frame',
      ],
      whyThisTechniqueWins: 'speed × dt makes the crossing take distance / speed seconds everywhere; a fixed step takes longer on slow screens and less on fast ones.',
    },
    {
      situation: 'A timer should count down from 10 seconds to 0 in update.',
      competingTechniques: [
        'Subtract dt from the timer each frame',
        'Subtract 1 from the timer each frame',
      ],
      whyThisTechniqueWins: 'The dts add up to real seconds, so subtracting dt reaches 0 after 10 seconds; subtracting 1 reaches 0 after 10 frames, a sixth of a second.',
    },
  ],

  debugging: [
    {
      commonError: 'Writing this.position.x += 2 without dt.',
      symptom: 'The task says Hero moved different distances at 30 and 144 frames a second.',
      whyItHappened: 'A fixed step per frame makes the speed depend on how many frames there are.',
      repairStrategy: 'Replace the 2 with this.speed * dt and add a speed field in pixels per second.',
    },
    {
      commonError: "Spelling the class's method Update or update() without dt.",
      symptom: "Nothing moves, or dt is undefined and Hero's position becomes NaN.",
      whyItHappened: 'Game Studio calls exactly update(dt); a different name is never called, and a missing parameter has no value.',
      repairStrategy: 'Write update(dt) exactly, lower-case, with dt between the brackets.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Write a script that moves a node at a given speed in pixels per second.',
    explainVerbally: 'Explain why speed × dt gives the same distance per second at any frame rate.',
    detectIncorrectApplication: 'Spot movement that is tied to the frame rate and fix it.',
    transferToUnfamiliar: 'Use dt for any change over time, such as a countdown or a fading colour.',
  },

  assessment: {
    questions: [
      {
        id: 'mg1-003-assess-1',
        type: 'choice',
        text: 'At 60 fps, what is dt?',
        options: [
          'About 0.0167 seconds',
          '60 seconds',
          '1 second',
          'About 16.7 seconds',
        ],
        answer: 'About 0.0167 seconds',
        hint: 'dt is the time of one frame, 1/60 of a second.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg1-003-quiz-1',
      type: 'choice',
      text: 'How often does update(dt) run?',
      options: [
        'Once every frame',
        'Once when the game starts',
        'Once a second',
        'Only when a key is pressed',
      ],
      answer: 'Once every frame',
      hints: ['ready() is the one that runs once.'],
      reviewSection: 'Intuition — the ready and update paragraph',
    },
    {
      id: 'mg1-003-quiz-2',
      type: 'choice',
      text: 'Hero adds 2 pixels to x every frame. How fast is it at 144 fps?',
      options: [
        '288 pixels per second',
        '120 pixels per second',
        '2 pixels per second',
        '144 pixels per second',
      ],
      answer: '288 pixels per second',
      hints: [
        'Frames per second times pixels per frame. 120 is the near-miss, the speed at 60 fps.',
      ],
      reviewSection: 'Intuition — the prediction paragraph',
    },
    {
      id: 'mg1-003-quiz-3',
      type: 'choice',
      text: 'Which line moves Hero right at 100 pixels per second on any screen, with speed = 100?',
      options: [
        'this.position = { x: this.position.x + this.speed * dt, y: this.position.y }',
        'this.position = { x: this.position.x + this.speed, y: this.position.y }',
        'this.position = { x: this.position.x + dt, y: this.position.y }',
        'this.position = { x: this.speed * dt, y: this.position.y }',
      ],
      answer: 'this.position = { x: this.position.x + this.speed * dt, y: this.position.y }',
      hints: ['It must add to the old x, and the amount must be speed × dt.'],
      reviewSection: 'Intuition — Procedure: Move a node at a steady speed',
    },
    {
      id: 'mg1-003-quiz-4',
      type: 'choice',
      text: "Inside Hero's script, what is this?",
      options: [
        'The Hero node itself',
        'The whole game',
        'The script file',
        'The scene tree',
      ],
      answer: 'The Hero node itself',
      hints: ["this.position is Hero's position."],
      reviewSection: 'Intuition — the script paragraph',
    },
    {
      id: 'mg1-003-quiz-5',
      type: 'choice',
      text: 'Which of these does NOT need multiplying by dt in update?',
      options: [
        "Setting a sprite's texture when a key is pressed",
        'Moving at 200 pixels per second',
        'Counting a timer down in seconds',
        'Turning at 90 degrees per second',
      ],
      answer: "Setting a sprite's texture when a key is pressed",
      hints: [
        'dt is for amounts per second; a one-off change is not an amount per second.',
      ],
      reviewSection: 'Rules of thumb — every change over time is multiplied by dt',
    },
    {
      id: 'mg1-003-quiz-6',
      type: 'choice',
      text: 'Why does speed × dt give the same distance per second on every screen?',
      options: [
        'Because the dts of all the frames add up to the elapsed time',
        'Because every screen runs at 60 fps',
        'Because dt is always 1/60',
        'Because the engine skips frames on fast screens',
      ],
      answer: 'Because the dts of all the frames add up to the elapsed time',
      hints: ["Factor the speed out of the sum of the frames' distances."],
      reviewSection: 'Under the hood — factoring out v',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg1-003-1',
      label: 'Read the 2-pixels-per-frame example',
      type: 'read',
    },
    {
      id: 'cp-mg1-003-2',
      label: 'Read what ready and update(dt) do',
      type: 'read',
    },
    {
      id: 'cp-mg1-003-3',
      label: 'Read why speed × dt works on every screen',
      type: 'read',
    },
    {
      id: 'cp-mg1-003-4',
      label: 'Complete "Make Hero move" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg1-003-5',
      label: 'Change speed to 200 in Game Studio and predict where Hero is after 1 second',
      type: 'lab',
    },
    {
      id: 'cp-mg1-003-6',
      label: 'Work through the two-screens example',
      type: 'example',
    },
    {
      id: 'cp-mg1-003-7',
      label: 'Work through the frame-tied speed fix',
      type: 'example',
    },
    {
      id: 'cp-mg1-003-8',
      label: 'Attempt the diagnose-the-race challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-1',
}
