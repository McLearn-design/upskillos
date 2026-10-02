export default {
  order: 2,

  id: 'mg4-002',

  slug: 'keyframes-on-a-timeline',

  title: 'Keyframes on a Timeline',

  subtitle: 'A door that slides open, made of two keys and the time between them.',

  tags: ['game-studio', 'animation', 'keyframes'],

  aliases: 'animationplayer keyframes timeline track interpolation lerp autoplay tween',

  timeToComplete: 25,

  coreConcept: "An AnimationPlayer changes other nodes' properties over time. Each track holds keys, a value at a time; between two keys the value is interpolated in a straight line.",

  prerequisites: ['mg4-001'],

  nextLesson: 'mg4-003',

  hook: {
    question: 'A door should slide up 120 pixels over one second. You could write a script with a timer. Is there a way with no code at all?',
    realWorldContext: 'Doors, moving platforms, flashing pickups, cut-scenes and menu transitions are keyframed, not coded. Animators set a few values at a few times, and the engine fills in every frame between.',
  },

  intuition: {
    prose: [
      'The door starts at y = 340. A key at 0 s says y = 340; a key at 1 s says y = 220. At 0.5 s the door is half way: y = 280.',
      'Before reading on, predict: where is it at 0.25 s? A quarter of the way from 340 to 220: 340 − 30 = 310. The engine fills every in-between value with a straight line. This is **interpolation**.',
      "An **AnimationPlayer** holds named animations. Each has a length and tracks. A **track** is one property of one node (Door's position), with **keys** at chosen times.",
      'In the Animation panel, select the node, move the playhead to a time, set the property, and press ◆ to set a key there. Scrubbing the playhead previews it without changing the scene.',
      "**autoplay** starts an animation when the game starts. Paths in tracks start at the AnimationPlayer's parent, so `Door` means the Door beside it.",
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Keyframe a property',
        body: 'Step 1. Add an AnimationPlayer beside the node to animate (same parent).\nStep 2. In the Animation panel, + New, name the animation and set its length.\nStep 3. Select the node; at 0 s press ◆ beside the property to key its start.\nStep 4. Move the playhead to the end, change the property, press ◆ again.\nStep 5. Scrub to check, tick autoplay (or play it from a script), and run.',
      },
      {
        type: 'warning',
        title: 'Editing the scene versus setting a key',
        body: "While an animation is open, changing a property that has a track sets its key at the playhead, not the node's own value. Close the panel to edit the node itself.",
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'A door that slides open',
        props: {
          task: 'sliding-door',
          lesson: 'mg4-002',
          checkpoint: 'cp-mg4-002-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** Between keys $(t_0, a)$ and $(t_1, b)$, the value at time $t$ is $v(t) = a + (b - a)\\,s$ with $s = \\tfrac{t - t_0}{t_1 - t_0}$, the fraction of the way from $t_0$ to $t_1$. This is **linear interpolation**, "lerp".',
      'For the door, $a = 340$, $b = 220$, $t_0 = 0$, $t_1 = 1$: at $t = 0.25$, $s = 0.25$ and $v = 340 - 120 \\times 0.25 = 310$. Positions interpolate x and y separately.',
      'The speed is constant: $(b - a)/(t_1 - t_0) = -120$ px/s throughout. An easing curve replaces $s$ by a function of $s$, such as $s^2$ (start slow) or $3s^2 - 2s^3$ (slow at both ends), to change the feel.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, a track is a piecewise-linear function of time through its keys: constant before the first key, linear between consecutive keys, constant after the last.',
      'The invariant of linear interpolation is constant speed within each segment; the values at the keys are exactly what was set.',
      'Geometrically, the value against time is a polyline through the keys. In 2D, a position track traces straight segments through space.',
      'Curves through keys (Bézier or Catmull–Rom splines) give smooth motion with no corners at the keys; the same s from 0 to 1 drives them.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg4-002-ex1',
      title: 'Half way',
      difficulty: 'easy',
      problem: 'Keys y = 340 at 0 s and y = 220 at 1 s. Where is the door at 0.5 s?',
      steps: [
        {
          expression: '340 + (220 - 340) \\times 0.5 = 280',
          annotation: 'Half the change, added to the start.',
          strategyTitle: 'Step 1: Lerp',
        },
      ],
      answer: 'The door is at y = 280.',
    },
    {
      id: 'mg4-002-ex2',
      title: 'Between two later keys',
      difficulty: 'medium',
      problem: 'Keys at 1 s (y 220) and 3 s (y 300). Where is it at 2.5 s?',
      steps: [
        {
          expression: 's = \\tfrac{2.5 - 1}{3 - 1} = 0.75',
          annotation: 'Three quarters of the way through the segment.',
          strategyTitle: 'Step 1: The fraction',
        },
        {
          expression: '220 + 80 \\times 0.75 = 280',
          annotation: 'Three quarters of the change.',
          strategyTitle: 'Step 2: Lerp',
        },
      ],
      answer: 'It is at y = 280.',
    },
    {
      id: 'mg4-002-ex3',
      title: 'Eased',
      difficulty: 'hard',
      problem: 'The same door, but with easing 3s² − 2s³. Where is it at 0.25 s?',
      steps: [
        {
          expression: '3(0.25)^2 - 2(0.25)^3 = 0.1875 - 0.03125 = 0.15625',
          annotation: 'The eased fraction is smaller early on.',
          strategyTitle: 'Step 1: Ease s',
        },
        {
          expression: '340 - 120 \\times 0.15625 = 321.25',
          annotation: 'It has moved less than the linear 310.',
          strategyTitle: 'Step 2: Lerp with it',
        },
      ],
      answer: 'About y = 321, so it starts more gently than the linear door.',
    },
  ],

  challenges: [
    {
      id: 'mg4-002-ch1',
      title: 'Three quarters',
      difficulty: 'easy',
      problem: 'Keys x = 0 at 0 s and x = 400 at 2 s. Where at 1.5 s?',
      hint: 'The fraction is 1.5 ÷ 2.',
      answer: 'x = 300.',
      walkthrough: [
        {
          expression: '400 \\times 0.75 = 300',
          annotation: 'Three quarters of 400.',
        },
      ],
    },
    {
      id: 'mg4-002-ch2',
      title: 'Speed of the door',
      difficulty: 'medium',
      problem: 'The door moves from y 340 to 220 in 0.5 s instead. How fast does it move?',
      hint: 'Change ÷ time.',
      answer: '240 px/s upwards, because 120 ÷ 0.5 = 240.',
      walkthrough: [],
    },
    {
      id: 'mg4-002-ch3',
      title: 'Debug the door that will not move',
      difficulty: 'hard',
      problem: 'A learner set both keys with the playhead at 0 s, changing y between them. Running, the door jumps to its final place at once. Why?',
      hint: 'When are the two keys?',
      answer: 'Both keys are at 0 s, so the second replaced the first and there is nothing between; move the playhead to 1 s before setting the second key.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'AnimationPlayer',
        meaning: "Changes other nodes' properties over time from keyframes.",
      },
      {
        symbol: 'track',
        meaning: 'One property of one node, with keys.',
      },
      {
        symbol: 'key',
        meaning: 'A value at a time on a track.',
      },
      {
        symbol: 'a + (b − a)s',
        meaning: 'Linear interpolation: the value a fraction s of the way from a to b.',
      },
      {
        symbol: 'autoplay',
        meaning: 'The animation that starts when the game starts.',
      },
    ],
    rulesOfThumb: [
      'Key the start before changing anything.',
      'Move the playhead before setting the next key.',
      "Paths start at the AnimationPlayer's parent; keep it beside what it animates.",
      'Scrub to preview; the scene is not changed by scrubbing.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'You must key every frame.',
      whyStudentsThinkIt: 'An animation shows a value every frame.',
      correctionExample: 'Two keys, at 0 s and 1 s, give the door 60 positions a second by interpolation.',
      contrastCase: 'Keys are only where the motion changes direction or speed.',
    },
    {
      falseBelief: 'Scrubbing the timeline moves the door in the scene.',
      whyStudentsThinkIt: 'The door moves in the viewport.',
      correctionExample: 'After scrubbing to 1 s and closing the panel, the door is back at y = 340.',
      contrastCase: 'Only setting a key (or editing without the panel) changes saved values.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A platform should move left and right forever.',
      competingTechniques: [
        'A looping animation with keys at both ends',
        'A script that flips direction at each end',
      ],
      whyThisTechniqueWins: 'The looping animation needs no code and shows its path on the timeline.',
    },
    {
      situation: 'A pickup should flash by changing its opacity.',
      competingTechniques: [
        'A looping track on opacity with keys at 1, 0.2, 1',
        'Toggling visibility in update',
      ],
      whyThisTechniqueWins: 'The track interpolates smoothly and needs no timing code.',
    },
  ],

  debugging: [
    {
      commonError: 'The AnimationPlayer is under the door instead of beside it.',
      symptom: 'The track says there is no node Door.',
      whyItHappened: "Paths start at the player's parent, which is now the door.",
      repairStrategy: "Move the AnimationPlayer to the door's parent, or change the track's path.",
    },
    {
      commonError: 'Forgetting autoplay (or a play call).',
      symptom: 'Nothing happens when the game runs.',
      whyItHappened: 'An animation does not play by itself.',
      repairStrategy: 'Tick autoplay, or call play from a script (next lesson).',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Keyframe a property and play it.',
    explainVerbally: 'Explain tracks, keys and linear interpolation.',
    detectIncorrectApplication: 'Spot keys set at the same time, or a misplaced player.',
    transferToUnfamiliar: 'Compute values between keys, with and without easing.',
  },

  assessment: {
    questions: [
      {
        id: 'mg4-002-assess-1',
        type: 'choice',
        text: 'Keys y 340 at 0 s and y 220 at 1 s. Where at 0.25 s?',
        options: ['310', '280', '250', '330'],
        answer: '310',
        hint: 'A quarter of the way.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg4-002-quiz-1',
      type: 'choice',
      text: 'What is a track?',
      options: [
        'One property of one node, with keys',
        'A list of pictures',
        'A sound',
        'A camera path',
      ],
      answer: 'One property of one node, with keys',
      hints: ["Door's position is a track."],
      reviewSection: 'Intuition — the AnimationPlayer paragraph',
    },
    {
      id: 'mg4-002-quiz-2',
      type: 'choice',
      text: 'What fills in the values between keys?',
      options: [
        'Linear interpolation',
        'The script',
        'Random values',
        'Nothing; it jumps',
      ],
      answer: 'Linear interpolation',
      hints: ['A straight line between them.'],
      reviewSection: 'Under the hood — lerp',
    },
    {
      id: 'mg4-002-quiz-3',
      type: 'choice',
      text: 'Keys at 1 s (0) and 3 s (100). Value at 2 s?',
      options: ['50', '66.7', '100', '33.3'],
      answer: '50',
      hints: [
        'Half way through the segment; 66.7 is the near-miss of dividing by 3.',
      ],
      reviewSection: 'Examples — Between two later keys',
    },
    {
      id: 'mg4-002-quiz-4',
      type: 'choice',
      text: 'Track paths start where?',
      options: [
        "At the AnimationPlayer's parent",
        'At the scene root always',
        'At the AnimationPlayer',
        'At the camera',
      ],
      answer: "At the AnimationPlayer's parent",
      hints: ['Door means the Door beside it.'],
      reviewSection: 'Intuition — the autoplay paragraph',
    },
    {
      id: 'mg4-002-quiz-5',
      type: 'choice',
      text: 'Which of these does NOT change the saved scene?',
      options: [
        'Scrubbing the playhead',
        'Setting a key',
        'Editing a property with the panel closed',
        'Adding a track',
      ],
      answer: 'Scrubbing the playhead',
      hints: ['Scrubbing previews.'],
      reviewSection: 'Misconceptions — scrubbing',
    },
    {
      id: 'mg4-002-quiz-6',
      type: 'choice',
      text: 'With linear keys, how fast does a door move from 340 to 220 over 1 s?',
      options: ['120 px/s all the way', 'Fast then slow', 'Slow then fast', '60 px/s'],
      answer: '120 px/s all the way',
      hints: ['Linear means constant speed.'],
      reviewSection: 'Rigor — constant speed',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg4-002-1',
      label: 'Read where the door is between keys',
      type: 'read',
    },
    {
      id: 'cp-mg4-002-2',
      label: 'Read tracks and keys',
      type: 'read',
    },
    {
      id: 'cp-mg4-002-3',
      label: 'Read the keyframe procedure',
      type: 'read',
    },
    {
      id: 'cp-mg4-002-4',
      label: 'Complete "A door that slides open" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg4-002-5',
      label: 'Add a third key so the door comes back down, in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg4-002-6',
      label: 'Work through the later-keys example',
      type: 'example',
    },
    {
      id: 'cp-mg4-002-7',
      label: 'Work through the eased example',
      type: 'example',
    },
    {
      id: 'cp-mg4-002-8',
      label: 'Attempt the door-that-will-not-move challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-4',
}
