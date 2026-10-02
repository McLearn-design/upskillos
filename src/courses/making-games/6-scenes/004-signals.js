export default {
  order: 4,

  id: 'mg6-004',

  slug: 'signals',

  title: 'Signals',

  subtitle: 'A health display wired to the player with no code joining them.',

  tags: ['game-studio', 'scenes', 'signals'],

  aliases: 'signals emit connect observer pattern events decoupling',

  timeToComplete: 25,

  coreConcept: "A node emits a signal to say something happened (this.emit('healthChanged', health)); other nodes connect a method to it. The emitter does not know who listens, so the player and the display stay independent.",

  prerequisites: ['mg6-003'],

  nextLesson: 'mg6-005',

  hook: {
    question: "When the player is hurt, the health display must change. If the player's script updates the label itself, the player breaks whenever the HUD is redesigned. Is there a way for the player to just announce it?",
    realWorldContext: 'Health bars, achievement popups, sound effects and analytics all react to the same events. Signals (events, observers) let each listen without the source knowing any of them.',
  },

  intuition: {
    prose: [
      "Player has health = 3. Spikes call Player's hurt(), which takes 1 and then says so: `this.emit('healthChanged', this.health)`. That is all Player does.",
      'The display is a Label at HUD/Health with a method show(health) that sets its text to "Health: " + health.',
      'Connect them in the editor: select Player, Inspector › Signals, signal healthChanged, node HUD/Health, method show, Connect. Before reading on, predict: after walking into the spikes, what does the display say? "Health: 2": emit called show(2).',
      "Neither script names the other. Player emits whether anyone listens or not; the display only knows it has a show method. Add a second listener (a sound, a screen flash) and Player's code does not change.",
      'A connection is saved with the scene, by node, so renaming the display does not break it.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Wire a signal',
        body: "Step 1. In the emitter's script, at the moment it happens: this.emit('healthChanged', this.health).\nStep 2. In the listener's script, write the method to call: show(health) { … }.\nStep 3. Select the emitter; Inspector › Signals: signal name, listener node, method; Connect.\nStep 4. Run and make it happen; the listener reacts.",
      },
      {
        type: 'warning',
        title: 'The method must exist',
        body: 'Connecting to a method the listener does not have is an error when the signal fires, naming the node and the method. Write the method first, with the same spelling.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'A health display wired with a signal',
        props: {
          task: 'health-signal',
          lesson: 'mg6-004',
          checkpoint: 'cp-mg6-004-4',
        },
      },
    ],
  },

  math: {
    prose: [
      "**Under the hood (optional).** Each node keeps, for each signal name, a list of connections (target node, method). emit(name, ...args) goes through that list and calls each target's method with the args. With $k$ listeners, one emit makes $k$ calls; with none, it does nothing.",
      'This is the **observer pattern**: a subject keeps a list of observers and notifies them; observers subscribe and unsubscribe. The subject depends only on the list, not on what the observers are.',
      'A mistake in one listener is reported against that listener, and the others still run, so one broken popup cannot stop the health display.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      "Formally, a signal is a map from the emitter's events to a set of callbacks; emitting applies each callback to the event's arguments, in connection order.",
      "The invariant is the emitter's code: adding or removing listeners never changes it. Dependencies point from listeners to the emitter's signal, not the other way.",
      'Picture arrows from the emitter to each listener, drawn in the editor rather than in code.',
      "The engine's own callbacks (bodyEntered, onCollision) are emitted as signals of the same name, so the same connection panel can wire them too.",
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg6-004-ex1',
      title: 'What the display shows',
      difficulty: 'easy',
      problem: 'Health starts at 3. Player is hurt once. What does the display show?',
      steps: [
        {
          expression: '3 - 1 = 2 \\Rightarrow \\texttt{show(2)}',
          annotation: 'hurt() takes 1, then emits the new health.',
          strategyTitle: 'Step 1: Follow the emit',
        },
      ],
      answer: 'Health: 2.',
    },
    {
      id: 'mg6-004-ex2',
      title: 'Two listeners',
      difficulty: 'medium',
      problem: 'healthChanged is connected to HUD/Health.show and Camera.shake. Player is hurt twice. How many calls?',
      steps: [
        {
          expression: '2 \\text{ emits} \\times 2 \\text{ listeners} = 4',
          annotation: 'Each emit calls every connected method.',
          strategyTitle: 'Step 1: Emits × listeners',
        },
      ],
      answer: '4 calls: show twice (with 2, then 1) and shake twice.',
    },
    {
      id: 'mg6-004-ex3',
      title: 'Changing the HUD',
      difficulty: 'hard',
      problem: "The designer replaces the Label with a row of heart sprites. What changes in Player's script?",
      steps: [
        {
          expression: '\\text{Player: emit("healthChanged", health)} \\text{ (unchanged)}',
          annotation: 'Player only announces.',
          strategyTitle: 'Step 1: The emitter',
        },
        {
          expression: '\\text{Hearts.show(health)} + \\text{a new connection}',
          annotation: 'The new display has its own show method and is connected instead.',
          strategyTitle: 'Step 2: The listener',
        },
      ],
      answer: "Nothing in Player's script; only the new display's show method and the connection.",
    },
  ],

  challenges: [
    {
      id: 'mg6-004-ch1',
      title: 'Game over',
      difficulty: 'easy',
      problem: 'When health reaches 0, a Message label should say Game over. Which signal could it listen to?',
      hint: 'The same one.',
      answer: 'healthChanged, with a method that checks whether health is 0.',
      walkthrough: [
        {
          expression: '\\texttt{show(h)}: \\text{if } h = 0 \\ldots',
          annotation: 'Listeners can decide for themselves.',
        },
      ],
    },
    {
      id: 'mg6-004-ch2',
      title: 'A new signal',
      difficulty: 'medium',
      problem: "The player picks up a key. What emit line announces it, carrying the key's colour?",
      hint: 'Name what happened.',
      answer: "this.emit('keyCollected', colour).",
      walkthrough: [],
    },
    {
      id: 'mg6-004-ch3',
      title: 'Debug the silent display',
      difficulty: 'hard',
      problem: "The connection exists, but the display never changes. Player's hurt() does this.health -= 1 and nothing else. Why?",
      hint: 'Who starts a signal?',
      answer: "Nothing emits healthChanged; add this.emit('healthChanged', this.health) after taking the health.",
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'emit(name, …args)',
        meaning: 'Says something happened; calls every connected method with the args.',
      },
      {
        symbol: 'connect',
        meaning: "Joins a node's signal to another node's method.",
      },
      {
        symbol: 'observer pattern',
        meaning: 'A subject notifies a list of observers without knowing them.',
      },
      {
        symbol: 'listener',
        meaning: 'A node whose method is connected to a signal.',
      },
    ],
    rulesOfThumb: [
      'Emit what happened, not what others should do.',
      'Name signals as events in the past tense (healthChanged, keyCollected).',
      "Write the listener's method before connecting.",
      'Prefer a signal when two parts of a game should not depend on each other.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'emit fails if nobody is connected.',
      whyStudentsThinkIt: 'Calling something that is not there usually fails.',
      correctionExample: 'Player emits healthChanged with no listeners and nothing happens, without error.',
      contrastCase: 'Connecting to a method that does not exist is the error, when it fires.',
    },
    {
      falseBelief: "The emitter must know its listeners' names.",
      whyStudentsThinkIt: 'A direct call needs a path to the other node.',
      correctionExample: "Player's script never mentions HUD; the connection, made in the editor, does.",
      contrastCase: 'That is what lets the HUD change freely.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A score, a sound and an achievement should all react to a coin being collected.',
      competingTechniques: [
        'The coin emits collected; each connects',
        'The coin calls all three directly',
      ],
      whyThisTechniqueWins: 'The coin stays simple, and new reactions are added by connecting.',
    },
    {
      situation: 'A door should open when all three switches are pressed.',
      competingTechniques: [
        'Each switch emits pressed; a door script counts them',
        'Each switch checks the other two',
      ],
      whyThisTechniqueWins: 'The switches stay identical and independent; the door owns the rule.',
    },
  ],

  debugging: [
    {
      commonError: 'Connecting to show when the method is called showHealth.',
      symptom: 'An error, the node has no method show, when the signal fires.',
      whyItHappened: 'Connections name the method exactly.',
      repairStrategy: "Use the method's exact name, or rename the method.",
    },
    {
      commonError: 'Emitting before changing the value.',
      symptom: 'The display is always one step behind.',
      whyItHappened: 'The signal carried the old health.',
      repairStrategy: 'Change health first, then emit it.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Emit a signal and connect a listener in the editor.',
    explainVerbally: 'Explain the observer pattern and why it decouples nodes.',
    detectIncorrectApplication: 'Spot missing emits and wrong method names.',
    transferToUnfamiliar: 'Design signals for coins, switches and achievements.',
  },

  assessment: {
    questions: [
      {
        id: 'mg6-004-assess-1',
        type: 'choice',
        text: 'Health 3, hurt once, then emit. What does show receive?',
        options: ['2', '3', '1', 'Nothing'],
        answer: '2',
        hint: 'Change, then emit.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg6-004-quiz-1',
      type: 'choice',
      text: 'What does emit do with no listeners?',
      options: ['Nothing', 'Throws an error', 'Stops the game', 'Calls itself'],
      answer: 'Nothing',
      hints: ['No connections, no calls.'],
      reviewSection: 'Misconceptions — emit with no listeners',
    },
    {
      id: 'mg6-004-quiz-2',
      type: 'choice',
      text: 'Where is a connection made in this lesson?',
      options: [
        "In the Inspector's Signals section",
        "In Player's script",
        "In the HUD's script",
        'In Project settings',
      ],
      answer: "In the Inspector's Signals section",
      hints: ['No code joins them.'],
      reviewSection: 'Intuition — the connect paragraph',
    },
    {
      id: 'mg6-004-quiz-3',
      type: 'choice',
      text: 'Two listeners, three emits. Calls?',
      options: ['6', '5', '3', '2'],
      answer: '6',
      hints: ['Emits × listeners.'],
      reviewSection: 'Examples — Two listeners',
    },
    {
      id: 'mg6-004-quiz-4',
      type: 'choice',
      text: 'What is this pattern called?',
      options: [
        'The observer pattern',
        'The singleton pattern',
        'Recursion',
        'Polling',
      ],
      answer: 'The observer pattern',
      hints: ['Subject and observers.'],
      reviewSection: 'Under the hood — observer',
    },
    {
      id: 'mg6-004-quiz-5',
      type: 'choice',
      text: "Which of these changes Player's script when the HUD is redesigned?",
      options: [
        'Nothing',
        "The new label's name",
        'The new method name',
        "The HUD's position",
      ],
      answer: 'Nothing',
      hints: ['Player only emits.'],
      reviewSection: 'Examples — Changing the HUD',
    },
    {
      id: 'mg6-004-quiz-6',
      type: 'choice',
      text: 'The display lags one step behind. Likely cause?',
      options: [
        'Emitting before changing health',
        'Two listeners',
        'A wrong group',
        'Smoothing',
      ],
      answer: 'Emitting before changing health',
      hints: ['It carried the old value.'],
      reviewSection: 'Debugging — emitting first',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg6-004-1',
      label: 'Read how Player emits',
      type: 'read',
    },
    {
      id: 'cp-mg6-004-2',
      label: 'Read how a connection joins them',
      type: 'read',
    },
    {
      id: 'cp-mg6-004-3',
      label: 'Read the signal procedure',
      type: 'read',
    },
    {
      id: 'cp-mg6-004-4',
      label: 'Complete "A health display wired with a signal" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg6-004-5',
      label: 'Connect a second listener in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg6-004-6',
      label: 'Work through the two-listeners example',
      type: 'example',
    },
    {
      id: 'cp-mg6-004-7',
      label: 'Work through the changing-HUD example',
      type: 'example',
    },
    {
      id: 'cp-mg6-004-8',
      label: 'Attempt the silent-display challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-6',
}
