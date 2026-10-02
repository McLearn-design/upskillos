export default {
  order: 1,

  id: 'mg4-001',

  slug: 'sprite-animation',

  title: 'Sprite Animation',

  subtitle: 'A character that walks when it moves and stands when it stops.',

  tags: ['game-studio', 'animation', 'sprites'],

  aliases: 'animatedsprite2d frames fps walk idle play animation flipbook',

  timeToComplete: 25,

  coreConcept: 'An AnimatedSprite2D shows a list of pictures one after another, at a number of frames per second. It holds several named animations (walk, idle), and a script chooses which one plays with play(name).',

  prerequisites: ['mg3-003'],

  nextLesson: 'mg4-002',

  hook: {
    question: 'Your character slides across the floor like a statue. You have two pictures of it mid-step. How do you make it walk, and only while it is moving?',
    realWorldContext: 'Sprite animation is a flipbook: games from the 1980s to today draw characters this way. Choosing the right animation for what the character is doing is called an animation state.',
  },

  intuition: {
    prose: [
      'The walk animation has two pictures, A and B, at 8 frames per second. Each picture shows for 1/8 = 0.125 seconds: A from 0 to 0.125 s, B to 0.25 s, then A again. Four steps a second.',
      'Before reading on, predict: which picture shows at t = 0.3 s? 0.3 ÷ 0.125 = 2.4, so it is in its third slot, counting from 0 that is slot 2, and slot 2 of a two-picture loop is A again.',
      'An **AnimatedSprite2D** holds several named animations, each a list of pictures with its own fps and whether it loops. `walk` has two pictures at 8 fps; `idle` has one.',
      "The script picks one every frame: `this.get('Sprite').play(moving ? 'walk' : 'idle')`. Calling play with the animation that is already playing does nothing, so the walk keeps going instead of restarting each frame.",
      '"Moving" is a question about the body: `this.velocity.x !== 0`. The animation follows the physics, not the keys, so a player pushed by something also walks.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Animate a character',
        body: "Step 1. Replace the character's Sprite2D with an AnimatedSprite2D named Sprite.\nStep 2. In the Inspector, add an animation, name it walk, add its pictures in order, and set its fps.\nStep 3. Add idle with one picture.\nStep 4. In the character's script, each frame: this.get('Sprite').play(moving ? 'walk' : 'idle').\nStep 5. Run and check: walking plays walk, stopping shows idle.",
      },
      {
        type: 'warning',
        title: 'An animation name must exist',
        body: "play('Walk') when the animation is called walk is an error: names are case-sensitive, and the message lists the animations it does have.",
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'A walking character',
        props: {
          task: 'walk-animation',
          lesson: 'mg4-001',
          checkpoint: 'cp-mg4-001-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** At $f$ frames per second each picture lasts $1/f$ seconds. After $t$ seconds of a looping animation of $n$ pictures, the picture showing is number $\\lfloor t f \\rfloor \\bmod n$, counting from 0. The floor $\\lfloor x \\rfloor$ rounds down; $\\bmod$ is the remainder.',
      'For walk: $f = 8$, $n = 2$, $t = 0.3$: $\\lfloor 2.4 \\rfloor = 2$ and $2 \\bmod 2 = 0$, picture A. At $t = 0.4$: $\\lfloor 3.2 \\rfloor = 3$, $3 \\bmod 2 = 1$, picture B.',
      "The engine adds each frame's dt to a timer and moves to the next picture each time the timer passes $1/f$, keeping the leftover. So it stays in time however uneven the frames are: the same idea as speed × dt.",
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, the picture index is a function of elapsed time, $i(t) = \\lfloor t f \\rfloor \\bmod n$ for a loop, and $\\min(\\lfloor t f \\rfloor, n - 1)$ for an animation that plays once and stops.',
      "The invariant is the animation's period, $n / f$ seconds: two pictures at 8 fps repeat every 0.25 s on every screen, because the timer counts seconds, not frames.",
      'Picture the timeline as slots of width $1/f$; the playhead slides along it at one second per second and wraps at the end.',
      "Animation states grow into state machines (idle, walk, jump, fall, hurt) with rules for moving between them, chosen from the body's velocity and isOnFloor(). The same choose-and-play pattern scales up.",
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg4-001-ex1',
      title: 'How long each picture lasts',
      difficulty: 'easy',
      problem: 'An animation runs at 8 fps. How long does each picture show?',
      steps: [
        {
          expression: '\\tfrac{1}{8} = 0.125\\ \\text{s}',
          annotation: 'Eight pictures share each second.',
          strategyTitle: 'Step 1: One over the rate',
        },
      ],
      answer: 'Each picture shows for 0.125 seconds.',
    },
    {
      id: 'mg4-001-ex2',
      title: 'Which picture now?',
      difficulty: 'medium',
      problem: 'A loop of 4 pictures at 10 fps. Which picture shows after 0.75 s?',
      steps: [
        {
          expression: '\\lfloor 0.75 \\times 10 \\rfloor = 7',
          annotation: 'Seven whole pictures have passed.',
          strategyTitle: 'Step 1: Pictures passed',
        },
        {
          expression: '7 \\bmod 4 = 3',
          annotation: 'The loop wraps every 4.',
          strategyTitle: 'Step 2: Wrap round',
        },
      ],
      answer: 'Picture 3, the last of the four (counting from 0).',
    },
    {
      id: 'mg4-001-ex3',
      title: 'Matching feet to speed',
      difficulty: 'hard',
      problem: 'Each walk cycle (2 pictures) moves the feet 24 pixels along the ground. Player walks at 96 px/s. What fps stops the feet sliding?',
      steps: [
        {
          expression: '\\tfrac{96}{24} = 4\\ \\text{cycles a second}',
          annotation: 'The feet should complete one cycle per 24 pixels.',
          strategyTitle: 'Step 1: Cycles per second',
        },
        {
          expression: '4 \\times 2 = 8\\ \\text{fps}',
          annotation: 'Two pictures per cycle.',
          strategyTitle: 'Step 2: Pictures per second',
        },
      ],
      answer: '8 fps, so the feet move with the ground instead of skating over it.',
    },
  ],

  challenges: [
    {
      id: 'mg4-001-ch1',
      title: 'The period',
      difficulty: 'easy',
      problem: 'How long is one loop of 6 pictures at 12 fps?',
      hint: 'Pictures ÷ rate.',
      answer: 'Half a second, because 6 ÷ 12 = 0.5.',
      walkthrough: [
        {
          expression: '\\tfrac{6}{12} = 0.5',
          annotation: "The animation's period.",
        },
      ],
    },
    {
      id: 'mg4-001-ch2',
      title: 'Running faster',
      difficulty: 'medium',
      problem: 'The player now runs at 144 px/s with the same 24-pixel cycle. What fps should walk use?',
      hint: 'Cycles per second, times pictures per cycle.',
      answer: '12 fps, because 144 ÷ 24 = 6 cycles a second, times 2 pictures.',
      walkthrough: [],
    },
    {
      id: 'mg4-001-ch3',
      title: 'Debug the frozen walk',
      difficulty: 'hard',
      problem: "A learner's script calls this.get('Sprite').stop(); this.get('Sprite').play('walk') every frame while moving, and the character never moves its feet. Why?",
      hint: 'What does stop() do to the picture and the timer?',
      answer: "stop() goes back to the first picture and resets the timer every frame, so the second picture is never reached; call only play('walk'), which carries on if it is already playing.",
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'AnimatedSprite2D',
        meaning: "Shows a named animation's pictures one after another.",
      },
      {
        symbol: 'fps',
        meaning: 'Pictures per second; each shows for 1/fps seconds.',
      },
      {
        symbol: 'play(name)',
        meaning: 'Starts that animation, or carries on if it is already playing.',
      },
      {
        symbol: '⌊t·f⌋ mod n',
        meaning: 'The picture showing after t seconds of a loop.',
      },
      {
        symbol: 'loop',
        meaning: 'Whether the animation starts again after its last picture.',
      },
    ],
    rulesOfThumb: [
      "Choose the animation from the body's state, not the keys.",
      'Call play every frame; it does not restart a running animation.',
      "Match the walk's fps to the speed so the feet do not slide.",
      'Keep names short and lower-case, and use them exactly.',
    ],
  },

  misconceptions: [
    {
      falseBelief: "Calling play('walk') every frame restarts the walk.",
      whyStudentsThinkIt: 'Playing something usually starts it from the beginning.',
      correctionExample: "play('walk') while walk plays changes nothing, so both pictures keep alternating.",
      contrastCase: "play('idle') then play('walk') does restart walk, because the animation changed.",
    },
    {
      falseBelief: 'A faster screen plays animations faster.',
      whyStudentsThinkIt: 'More frames a second sounds like faster motion.',
      correctionExample: 'At 8 fps, two pictures loop every 0.25 s on 60 Hz and 144 Hz screens alike.',
      contrastCase: "The animation's timer counts seconds with dt, as movement does.",
    },
  ],

  transferPrompts: [
    {
      situation: 'A coin should spin all the time.',
      competingTechniques: [
        'An AnimatedSprite2D with a looping spin animation',
        "Changing the sprite's texture in a script",
      ],
      whyThisTechniqueWins: 'The animated sprite does the timing; a script would repeat what it already does.',
    },
    {
      situation: 'The player should show a jump picture while in the air.',
      competingTechniques: [
        "Play 'jump' when not isOnFloor(), else walk or idle",
        "Play 'jump' when Space is pressed",
      ],
      whyThisTechniqueWins: "The body's state covers falling off ledges too; the key only covers jumping.",
    },
  ],

  debugging: [
    {
      commonError: 'Pictures added in the wrong order.',
      symptom: 'The walk looks like a stagger.',
      whyItHappened: 'Frames play in list order.',
      repairStrategy: 'Reorder the pictures in the Inspector.',
    },
    {
      commonError: 'Checking velocity before moveAndSlide.',
      symptom: 'Walk plays for a moment when walking into a wall.',
      whyItHappened: 'The velocity is reduced only by moveAndSlide.',
      repairStrategy: 'Choose the animation after moveAndSlide, or in update.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Animate a character with walk and idle chosen by its state.',
    explainVerbally: 'Explain fps, the picture index, and why play does not restart a running animation.',
    detectIncorrectApplication: 'Spot code that restarts the animation every frame.',
    transferToUnfamiliar: "Match an animation's fps to a movement speed.",
  },

  assessment: {
    questions: [
      {
        id: 'mg4-001-assess-1',
        type: 'choice',
        text: 'Two pictures at 8 fps. Which shows at 0.3 s (counting from 0)?',
        options: ['Picture 0', 'Picture 1', 'Picture 2', 'Neither'],
        answer: 'Picture 0',
        hint: '⌊2.4⌋ = 2, and 2 mod 2 = 0.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg4-001-quiz-1',
      type: 'choice',
      text: 'How long does each picture of a 12 fps animation show?',
      options: ['1/12 s', '12 s', '1/60 s', '0.12 s'],
      answer: '1/12 s',
      hints: ['One over the rate; 0.12 is the near-miss.'],
      reviewSection: 'Examples — How long each picture lasts',
    },
    {
      id: 'mg4-001-quiz-2',
      type: 'choice',
      text: "What does play('walk') do while walk is already playing?",
      options: [
        'Nothing: it carries on',
        'Restarts it',
        'Stops it',
        'Plays it twice as fast',
      ],
      answer: 'Nothing: it carries on',
      hints: ['Only a different animation restarts.'],
      reviewSection: 'Intuition — the play paragraph',
    },
    {
      id: 'mg4-001-quiz-3',
      type: 'choice',
      text: 'What should choose between walk and idle?',
      options: [
        "The body's velocity",
        'Which key is held',
        'The frame number',
        'The camera',
      ],
      answer: "The body's velocity",
      hints: ['Follow the physics.'],
      reviewSection: 'Intuition — the moving paragraph',
    },
    {
      id: 'mg4-001-quiz-4',
      type: 'choice',
      text: '4 pictures at 10 fps. Which picture at 0.75 s?',
      options: ['3', '7', '0', '2'],
      answer: '3',
      hints: ['7 mod 4.'],
      reviewSection: 'Under the hood — the index',
    },
    {
      id: 'mg4-001-quiz-5',
      type: 'choice',
      text: 'Which of these does NOT make the walk restart every frame?',
      options: [
        "Calling play('walk') every frame",
        "Calling stop() then play('walk')",
        "Calling play('idle') then play('walk')",
        'Setting frame = 0 each frame',
      ],
      answer: "Calling play('walk') every frame",
      hints: ['It carries on if already playing.'],
      reviewSection: 'Misconceptions — play every frame',
    },
    {
      id: 'mg4-001-quiz-6',
      type: 'choice',
      text: 'A 24-pixel step cycle of 2 pictures at 96 px/s. What fps?',
      options: ['8', '4', '12', '96'],
      answer: '8',
      hints: ['4 cycles a second, 2 pictures each.'],
      reviewSection: 'Examples — Matching feet to speed',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg4-001-1',
      label: 'Read how long each picture shows',
      type: 'read',
    },
    {
      id: 'cp-mg4-001-2',
      label: 'Read how a script picks the animation',
      type: 'read',
    },
    {
      id: 'cp-mg4-001-3',
      label: 'Read the animation procedure',
      type: 'read',
    },
    {
      id: 'cp-mg4-001-4',
      label: 'Complete "A walking character" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg4-001-5',
      label: 'Change walk to 12 fps in Game Studio and watch the difference',
      type: 'lab',
    },
    {
      id: 'cp-mg4-001-6',
      label: 'Work through the which-picture example',
      type: 'example',
    },
    {
      id: 'cp-mg4-001-7',
      label: 'Work through the feet-and-speed example',
      type: 'example',
    },
    {
      id: 'cp-mg4-001-8',
      label: 'Attempt the frozen-walk challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-4',
}
