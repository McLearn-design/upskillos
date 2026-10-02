export default {
  order: 3,

  id: 'mg4-003',

  slug: 'animation-from-scripts',

  title: 'Animation from Scripts',

  subtitle: "Play the door's animation when the player steps on a switch.",

  tags: ['game-studio', 'animation', 'scripting'],

  aliases: 'animationplayer play from script switch trigger animationfinished',

  timeToComplete: 20,

  coreConcept: "An animation can wait until the game asks for it. A script finds the AnimationPlayer with scene.get and calls play(name) when something happens, such as a body entering a switch's area.",

  prerequisites: ['mg4-002'],

  nextLesson: 'mg5-001',

  hook: {
    question: 'The door opens on its own as the game starts. It should open only when the player stands on a switch. What joins the switch to the door?',
    realWorldContext: 'Levels are full of cause and effect: pressure plates, levers, keys and doors. The pattern is always an event (something entered) starting an animation somewhere else.',
  },

  intuition: {
    prose: [
      "The switch is an Area2D on the floor at x = 420. Player walks right from x = 200. When their shapes overlap, the switch's `bodyEntered(body)` runs, with `body` set to Player.",
      "In it: `scene.get('DoorAnimation').play('open')`. Before reading on, predict: what happens if Player walks onto the switch twice? The second time, the open animation has already finished, so play starts it again from the start and the door snaps down and slides up again.",
      'To open only once, remember it: a field `used = false`, and in bodyEntered, `if (this.used) return; this.used = true`.',
      'Untick autoplay first: otherwise the door opens when the game starts, before anyone touches the switch.',
      'The switch does not need to know how the door opens. It only says "play open". The animation could slide, fade or swing; the switch\'s code stays the same.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Trigger an animation',
        body: "Step 1. Untick the animation's autoplay so it waits.\nStep 2. Make the trigger: an Area2D (Switch) with a CollisionShape2D.\nStep 3. In its script's bodyEntered(body), check the body is Player.\nStep 4. Call scene.get('DoorAnimation').play('open').\nStep 5. Run, walk onto the switch, and watch the door.",
      },
      {
        type: 'warning',
        title: 'Paths from the scene root',
        body: "scene.get takes a path from the scene's root: 'DoorAnimation' works when it is the root's child. If it is inside another node, include it: 'Level/DoorAnimation'.",
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'A switch that opens the door',
        props: {
          task: 'door-switch',
          lesson: 'mg4-003',
          checkpoint: 'cp-mg4-003-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** An AnimationPlayer keeps an elapsed time $e$ for the playing animation, adding $\\Delta t$ each frame. For an animation of length $L$ that does not loop, the time used is $\\min(e, L)$; at $e \\geq L$ it stops and calls animationFinished.',
      'play(name) starts a new or finished animation from $e = 0$ (one already playing just carries on). So playing at $t_p$ puts the door at $v(t - t_p)$ from the track: stepping on the switch at 3 s, the door is at $340 - 120(t - 3)$ until $t = 4$, then stays at 220.',
      "This is an event-driven design: nothing checks every frame whether the player is on the switch; the area's set difference (lesson 2.3) produces one event, and the event starts a process that runs itself.",
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      "Formally, the door's position is $v(\\min(t - t_p, L))$ for $t \\geq t_p$, where $t_p$ is when play was called and $v$ the track's interpolation.",
      'The invariant is the animation itself: the same keys play the same way whenever they start. Only the start time comes from the game.',
      "Picture two timelines, the game's and the animation's; play pins the animation's 0 to the game's $t_p$.",
      'Signals (chapter 6) generalise this: the switch emits "pressed", and any number of things connect to it without the switch naming them.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg4-003-ex1',
      title: 'When the door finishes',
      difficulty: 'easy',
      problem: 'Player steps on the switch at t = 3 s. The animation is 1 s long. When is the door fully open?',
      steps: [
        {
          expression: '3 + 1 = 4\\ \\text{s}',
          annotation: 'The animation starts when play is called and lasts its length.',
          strategyTitle: 'Step 1: Start plus length',
        },
      ],
      answer: 'At t = 4 s.',
    },
    {
      id: 'mg4-003-ex2',
      title: 'Where the door is',
      difficulty: 'medium',
      problem: 'Same switch at 3 s. Where is the door at t = 3.5 s?',
      steps: [
        {
          expression: 't - t_p = 0.5',
          annotation: 'Half a second into the animation.',
          strategyTitle: 'Step 1: Animation time',
        },
        {
          expression: '340 - 120 \\times 0.5 = 280',
          annotation: 'The track at 0.5 s.',
          strategyTitle: 'Step 2: Read the track',
        },
      ],
      answer: 'It is at y = 280, half way up.',
    },
    {
      id: 'mg4-003-ex3',
      title: 'Opening once',
      difficulty: 'hard',
      problem: 'Player walks off the switch and back on at t = 6 s. Without a used field, what happens to the door?',
      steps: [
        {
          expression: '\\texttt{play("open")} \\Rightarrow e = 0',
          annotation: 'The finished animation starts again.',
          strategyTitle: 'Step 1: Play restarts it',
        },
        {
          expression: 'v(0) = 340',
          annotation: 'The door jumps down to its first key, then slides up again.',
          strategyTitle: 'Step 2: The first key',
        },
      ],
      answer: 'The door snaps shut and opens again; a used field stops the second play.',
    },
  ],

  challenges: [
    {
      id: 'mg4-003-ch1',
      title: 'A slower door',
      difficulty: 'easy',
      problem: 'The open animation is 2 s long. The switch is pressed at 5 s. When is the door open?',
      hint: 'Start plus length.',
      answer: 'At 7 s.',
      walkthrough: [
        {
          expression: '5 + 2 = 7',
          annotation: 'It starts when played.',
        },
      ],
    },
    {
      id: 'mg4-003-ch2',
      title: 'Two switches',
      difficulty: 'medium',
      problem: "Two switches should both open the same door. What changes in the door's animation?",
      hint: 'Who calls play?',
      answer: "Nothing; both switch scripts call scene.get('DoorAnimation').play('open').",
      walkthrough: [],
    },
    {
      id: 'mg4-003-ch3',
      title: 'Debug the door that opens at the start',
      difficulty: 'hard',
      problem: "The door opens as soon as the game starts, before anyone touches the switch. The switch's script is right. Why?",
      hint: 'What else starts animations?',
      answer: 'autoplay is still set to open; untick it so only the switch plays it.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: "scene.get('DoorAnimation')",
        meaning: 'The node at that path from the scene root.',
      },
      {
        symbol: "play('open')",
        meaning: 'Starts the animation from its beginning (or carries on if it is playing).',
      },
      {
        symbol: 'animationFinished(name)',
        meaning: 'Called when an animation that does not loop ends.',
      },
      {
        symbol: 'event-driven',
        meaning: 'Acting when something happens, instead of checking every frame.',
      },
    ],
    rulesOfThumb: [
      'Untick autoplay for animations a trigger starts.',
      'Check who entered before playing.',
      'Guard one-off triggers with a field.',
      'Let the trigger say what to play, and the animation say how.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'The switch must move the door itself.',
      whyStudentsThinkIt: "Something has to change the door's position.",
      correctionExample: "One line, play('open'), and the existing track moves the door 120 px over 1 s.",
      contrastCase: "Moving it in the switch's script would duplicate the animation in code.",
    },
    {
      falseBelief: 'play on a finished animation does nothing.',
      whyStudentsThinkIt: 'It is already done.',
      correctionExample: 'Stepping on again at 6 s restarts it from the first key.',
      contrastCase: 'play only carries on when the animation is still playing.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A chest should open when the player presses a key near it.',
      competingTechniques: [
        "An Area2D to know the player is near, and play('open') when the key is pressed",
        'Check distance to every chest every frame in the player',
      ],
      whyThisTechniqueWins: 'The area tracks nearness by itself; the player script stays simple.',
    },
    {
      situation: 'A cut-scene should play when the player enters a room.',
      competingTechniques: [
        'A trigger area that plays the cut-scene animation',
        'A timer that starts it after some seconds',
      ],
      whyThisTechniqueWins: 'The trigger ties it to the player arriving, whenever that is.',
    },
  ],

  debugging: [
    {
      commonError: 'Misspelling the animation name.',
      symptom: 'An error saying the player has no animation by that name.',
      whyItHappened: 'Names are exact.',
      repairStrategy: 'Copy the name from the Animation panel.',
    },
    {
      commonError: 'Playing the animation every frame while on the switch.',
      symptom: 'The door opens, then snaps shut and opens again, over and over, while the player stands there.',
      whyItHappened: "play carries on while it is playing, but once it has finished, the next frame's play starts it again from the first key.",
      repairStrategy: 'Play it in bodyEntered, which runs once per entry, and guard it with a used field.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Trigger an animation from an area, once.',
    explainVerbally: "Explain how play sets the animation's start time.",
    detectIncorrectApplication: 'Spot autoplay or per-frame play bugs.',
    transferToUnfamiliar: 'Wire any trigger to any animation.',
  },

  assessment: {
    questions: [
      {
        id: 'mg4-003-assess-1',
        type: 'choice',
        text: 'Switch pressed at 3 s, a 1 s animation. Where is the door (340 → 220) at 3.25 s?',
        options: ['310', '280', '220', '340'],
        answer: '310',
        hint: 'A quarter of a second in.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg4-003-quiz-1',
      type: 'choice',
      text: 'Where does the switch call play?',
      options: [
        'In bodyEntered',
        'In update, every frame',
        'In ready',
        "In the door's script",
      ],
      answer: 'In bodyEntered',
      hints: ['Once per entry.'],
      reviewSection: 'Intuition — the switch paragraph',
    },
    {
      id: 'mg4-003-quiz-2',
      type: 'choice',
      text: 'Why untick autoplay?',
      options: [
        'So the door waits for the switch',
        'So the door moves faster',
        'So the switch works at all',
        'It does not matter',
      ],
      answer: 'So the door waits for the switch',
      hints: ['Otherwise it opens at the start.'],
      reviewSection: 'Intuition — the autoplay paragraph',
    },
    {
      id: 'mg4-003-quiz-3',
      type: 'choice',
      text: 'What does play do to a finished animation?',
      options: [
        'Starts it again from the beginning',
        'Nothing',
        'Plays it backwards',
        'Removes it',
      ],
      answer: 'Starts it again from the beginning',
      hints: ['It is not playing any more.'],
      reviewSection: 'Examples — Opening once',
    },
    {
      id: 'mg4-003-quiz-4',
      type: 'choice',
      text: 'How do you make a switch work only once?',
      options: [
        'A field set to true the first time, checked first',
        'Calling play twice',
        'Unticking loop',
        'A bigger shape',
      ],
      answer: 'A field set to true the first time, checked first',
      hints: ['Remember it was used.'],
      reviewSection: 'Intuition — the used paragraph',
    },
    {
      id: 'mg4-003-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT needed to open the door from a switch?',
      options: [
        'A script on the door',
        'An Area2D switch',
        'A play call',
        'The open animation',
      ],
      answer: 'A script on the door',
      hints: ['The door has no code at all.'],
      reviewSection: 'Misconceptions — the switch moves the door',
    },
    {
      id: 'mg4-003-quiz-6',
      type: 'choice',
      text: 'Pressed at 2 s, length 1 s. Where is the door at 5 s?',
      options: ['220, fully open', '340', '280', '100'],
      answer: '220, fully open',
      hints: ['It stays at the last key.'],
      reviewSection: 'Under the hood — after the end',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg4-003-1',
      label: 'Read how the switch plays the door',
      type: 'read',
    },
    {
      id: 'cp-mg4-003-2',
      label: 'Read how to open only once',
      type: 'read',
    },
    {
      id: 'cp-mg4-003-3',
      label: 'Read the trigger procedure',
      type: 'read',
    },
    {
      id: 'cp-mg4-003-4',
      label: 'Complete "A switch that opens the door" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg4-003-5',
      label: 'Make the switch work only once in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg4-003-6',
      label: 'Work through the where-is-the-door example',
      type: 'example',
    },
    {
      id: 'cp-mg4-003-7',
      label: 'Work through the opening-once example',
      type: 'example',
    },
    {
      id: 'cp-mg4-003-8',
      label: 'Attempt the door-opens-at-start challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-4',
}
