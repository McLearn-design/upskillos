export default {
  order: 1,

  id: 'mg8-001',

  slug: 'a-game-that-learns',

  title: 'Bonus: A Game That Learns to Play Itself',

  subtitle: 'Turn Breakout into an environment, and train an agent that beats random play by far.',

  tags: ['game-studio', 'machine-learning', 'reinforcement-learning'],

  aliases: 'reinforcement learning environment agent reward observation action gymnasium cross entropy method policy train',

  timeToComplete: 40,

  coreConcept: "A game becomes a learning environment when you say what an agent sees (numbers from the game), what it can do (the player's controls) and what it earns (a reward). Training searches for a policy, a rule from what it sees to what it does, that earns the most.",

  prerequisites: ['mg7-009'],

  nextLesson: null,

  hook: {
    question: 'Could Breakout learn to play itself, with no rules written for it, only a score to chase? What would it need to see, and what would it count as doing well?',
    realWorldContext: "Game-playing agents learned Atari games, Go and StarCraft this way. The same ideas train robots and recommend videos. Game Studio's Run › Train an agent… applies them to your own games.",
  },

  intuition: {
    prose: [
      "Breakout's agent sees four numbers: how far the ball is across from the paddle (the ball's x minus the paddle's, divided by 480), the ball's height, and its velocity across and down (divided by 360). All are roughly −1 to 1.",
      'It can do two things each step: hold left, or hold right (with Space, so the ball launches). A step is 4 frames, so it decides 15 times a second.',
      'It earns +1 for every brick (10 points) and −3 for every ball it loses. Before reading on, predict: how does playing at random score? Badly: about −5, because it loses its three balls quickly.',
      'Its **policy** is a weighted sum per action: score(left) = w₁ × across + w₂ × height + … + bias, and the same with other weights for right; it takes the higher. Training chooses the weights.',
      'The **cross-entropy method** trains it: try 24 random sets of weights, play a game with each, keep the best 20%, and draw the next 24 around them. Ten rounds take about 15 seconds; the trained agent averages about 37, and its weights say "move towards the ball".',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Train an agent on a game',
        body: "Step 1. Open the Breakout example (Project › Projects and examples…).\nStep 2. Run › Train an agent…: the environment is filled in (what it sees, does and earns).\nStep 3. Press Train; watch each generation's best and elite average climb above the random line.\nStep 4. Read what it learned: the weights for left and right.\nStep 5. Press Watch it play: the real game runs with the agent at the controls.",
      },
      {
        type: 'warning',
        title: 'Rewards teach exactly what they say',
        body: 'With +1 per brick and only −1 per lost ball, random play scored as well as anything: each launch breaks a few bricks for free. The agent learned nothing until losing a ball cost 3. An agent chases the reward you wrote, not the one you meant.',
      },
    ],
    visualizations: [],
  },

  math: {
    prose: [
      "**Under the hood (optional).** An environment has a state; at each step the agent sees an observation $\\mathbf{o}$ (here 4 numbers), picks an action $a$, and gets a reward $r$. An episode's return is $G = r_1 + r_2 + \\cdots$, until the balls run out or 1200 steps pass.",
      'The policy is linear: for each action $a$, $s_a = \\mathbf{w}_a \\cdot \\mathbf{o} + b_a$, and it takes $\\arg\\max_a s_a$. With two actions only the difference matters: go right when $(\\mathbf{w}_R - \\mathbf{w}_L) \\cdot \\mathbf{o} + (b_R - b_L) > 0$. "Move towards the ball" is a large positive weight on the across feature in that difference.',
      "The cross-entropy method keeps a Gaussian over the weights, mean $\\boldsymbol{\\mu}$ and spread $\\boldsymbol{\\sigma}$. Each generation it samples $N$ weight vectors, plays one episode each, keeps the top fraction (the elite), and sets $\\boldsymbol{\\mu}, \\boldsymbol{\\sigma}$ to the elite's mean and spread, plus a little extra spread that shrinks over time so the search does not stop too soon.",
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      "Formally this is a Markov decision process: states, actions, transition (the game's own code), and reward. A policy $\\pi(a \\mid \\mathbf{o})$ is optimal when it maximises the expected return. CEM is a derivative-free optimiser of the policy's parameters, maximising estimated return directly.",
      'The invariant that makes training fair: every candidate in a generation plays the same seeded episode (common random numbers), so differences in score come from the weights, not from luck.',
      'Geometrically, each weight vector is a point in a 10-dimensional space (2 actions × 5 numbers); CEM moves a cloud of points towards the region where returns are high, shrinking it as it closes in.',
      "The ML Lab teaches the methods that scale further: policy gradients and Q-learning, which learn from every step instead of only from whole episodes. The environment here is shaped like Gymnasium's (reset, step), the standard interface those methods use.",
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg8-001-ex1',
      title: "One step's reward",
      difficulty: 'easy',
      problem: "In one step the ball breaks 2 bricks (20 points). The reward is 0.1 per point. What is the step's reward?",
      steps: [
        {
          expression: '0.1 \\times 20 = 2',
          annotation: 'Score changes times their scale.',
          strategyTitle: 'Step 1: Scale the change',
        },
      ],
      answer: 'A reward of 2.',
    },
    {
      id: 'mg8-001-ex2',
      title: 'What the policy does',
      difficulty: 'medium',
      problem: 'Trained weights: left [−4.35, −0.10, 5.30, −4.79], bias −2.12; right [4.15, −4.22, 5.86, −2.75], bias −0.22. The ball is right of the paddle: o = [0.5, 0.5, 0, 0]. Which action?',
      steps: [
        {
          expression: 's_L = -4.35 \\times 0.5 - 0.10 \\times 0.5 - 2.12 \\approx -4.35',
          annotation: 'The left score.',
          strategyTitle: 'Step 1: Left',
        },
        {
          expression: 's_R = 4.15 \\times 0.5 - 4.22 \\times 0.5 - 0.22 = -0.255',
          annotation: 'The right score.',
          strategyTitle: 'Step 2: Right',
        },
      ],
      answer: 'Right, since −0.255 > −4.32: the paddle moves towards the ball.',
    },
    {
      id: 'mg8-001-ex3',
      title: 'Why the first reward failed',
      difficulty: 'hard',
      problem: 'With +1 per brick and −1 per lost ball, a launch breaks about 3 bricks before the ball is lost. Compare an agent that never catches the ball with one that catches it but breaks no more.',
      steps: [
        {
          expression: '3 \\times (3 - 1) = 6',
          annotation: 'Three balls, each +3 then −1.',
          strategyTitle: 'Step 1: Never catching',
        },
        {
          expression: '\\approx 3 \\text{ per launch, and fewer launches}',
          annotation: 'Catching keeps one ball alive but earns no extra in a short episode.',
          strategyTitle: 'Step 2: Catching',
        },
      ],
      answer: 'Not catching scores as well or better, so nothing pushes the agent to learn to catch; raising the loss to −3 fixes that.',
    },
  ],

  challenges: [
    {
      id: 'mg8-001-ch1',
      title: 'Count the weights',
      difficulty: 'easy',
      problem: 'Two actions and four observations, plus a bias each. How many weights?',
      hint: '(observations + 1) × actions.',
      answer: '10 weights.',
      walkthrough: [
        {
          expression: '(4 + 1) \\times 2 = 10',
          annotation: 'One row per action.',
        },
      ],
    },
    {
      id: 'mg8-001-ch2',
      title: 'A better feature',
      difficulty: 'medium',
      problem: "Why observe the ball's x minus the paddle's x, rather than both separately?",
      hint: 'What decides left or right?',
      answer: 'The difference is exactly what decides the move, so one weight expresses "move towards the ball"; separately, the search must find two weights that cancel, which random tries rarely do.',
      walkthrough: [],
    },
    {
      id: 'mg8-001-ch3',
      title: 'Design an environment',
      difficulty: 'hard',
      problem: 'For a platformer, what could the agent see, do and earn, to learn to reach a flag?',
      hint: "Numbers from nodes, the player's actions, and a reward for progress.",
      answer: "See the player's position and velocity and the flag's distance; do left, right, jump; earn the change in distance to the flag each step, a bonus for reaching it, and a penalty for falling.",
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'environment',
        meaning: 'A game seen as states, actions and rewards: reset() and step(action).',
      },
      {
        symbol: 'observation',
        meaning: 'The numbers the agent sees each step.',
      },
      {
        symbol: 'reward',
        meaning: 'What a step earns; the agent maximises their sum.',
      },
      {
        symbol: 'policy',
        meaning: "The agent's rule from observation to action.",
      },
      {
        symbol: 'cross-entropy method',
        meaning: 'Sample weights, keep the best, refit, repeat.',
      },
    ],
    rulesOfThumb: [
      'Reward what you actually want, and test that random play does badly.',
      'Give the agent the features that decide the action.',
      'Seed episodes so candidates are compared fairly.',
      'Watch the trained agent; the score can hide odd behaviour.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'The agent reads the screen like a person.',
      whyStudentsThinkIt: 'People play from pictures.',
      correctionExample: "This agent sees four numbers from the game's nodes and never the pixels.",
      contrastCase: 'Pixel-based agents exist but need far more training.',
    },
    {
      falseBelief: 'More reward always means better play.',
      whyStudentsThinkIt: 'That is what reward is for.',
      correctionExample: 'With −1 per lost ball, an agent could score well while never catching the ball.',
      contrastCase: 'The reward must make the behaviour you want the best way to score.',
    },
  ],

  transferPrompts: [
    {
      situation: "You want an enemy that learns to dodge the player's shots.",
      competingTechniques: [
        'An environment rewarding survival time, with shot positions as observations',
        'Hand-written dodging rules',
      ],
      whyThisTechniqueWins: 'Training can find dodges you did not think of, as long as the reward is right.',
    },
    {
      situation: 'Training stalls at the same score as random play.',
      competingTechniques: ['Check the reward and the features', 'Train for longer'],
      whyThisTechniqueWins: 'If random already scores as well as anything, more training cannot help; the problem is the reward or what the agent sees.',
    },
  ],

  debugging: [
    {
      commonError: 'An observation path that does not exist (a typo in Ball:position.x).',
      symptom: 'The agent sees 0 there and cannot learn from it.',
      whyItHappened: 'Missing values read as 0.',
      repairStrategy: "Check each path against the scene tree and the node's properties.",
    },
    {
      commonError: 'An action using an input action the project does not have.',
      symptom: 'Train an agent refuses, naming the action.',
      whyItHappened: "The agent can only press the project's actions.",
      repairStrategy: 'Use names from Project settings › Input map.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Train an agent on Breakout and read its weights.',
    explainVerbally: 'Explain environment, reward, policy and the cross-entropy method.',
    detectIncorrectApplication: 'Spot a reward that random play already maximises.',
    transferToUnfamiliar: 'Design an environment for another game.',
  },

  assessment: {
    questions: [
      {
        id: 'mg8-001-assess-1',
        type: 'choice',
        text: 'What does the agent maximise?',
        options: [
          'The sum of its rewards',
          'The number of frames',
          "The ball's speed",
          'Its weights',
        ],
        answer: 'The sum of its rewards',
        hint: 'The return.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg8-001-quiz-1',
      type: 'choice',
      text: 'What does the Breakout agent see?',
      options: [
        'Four numbers from the game',
        "The screen's pixels",
        'The score only',
        "The bricks' colours",
      ],
      answer: 'Four numbers from the game',
      hints: ['State, not pixels.'],
      reviewSection: 'Intuition — the observation paragraph',
    },
    {
      id: 'mg8-001-quiz-2',
      type: 'choice',
      text: 'How does the cross-entropy method improve?',
      options: [
        'Keep the best candidates and sample around them',
        'Follow a gradient',
        "Copy a person's play",
        'Try every weight',
      ],
      answer: 'Keep the best candidates and sample around them',
      hints: ['Elite, refit, repeat.'],
      reviewSection: 'Intuition — the training paragraph',
    },
    {
      id: 'mg8-001-quiz-3',
      type: 'choice',
      text: 'Why did the first reward teach nothing?',
      options: [
        'Random play already scored as well as anything',
        'The game was too fast',
        'There were too many weights',
        'The seed was wrong',
      ],
      answer: 'Random play already scored as well as anything',
      hints: ['Free bricks per launch.'],
      reviewSection: 'Intuition — Warning: rewards teach exactly what they say',
    },
    {
      id: 'mg8-001-quiz-4',
      type: 'choice',
      text: 'With two actions, what decides the move?',
      options: [
        'The difference of the two scores',
        'The left score alone',
        'The bias alone',
        'A coin flip',
      ],
      answer: 'The difference of the two scores',
      hints: ['argmax of two.'],
      reviewSection: 'Under the hood — the policy',
    },
    {
      id: 'mg8-001-quiz-5',
      type: 'choice',
      text: 'Which of these does NOT make training fair between candidates?',
      options: [
        'Each candidate playing a different random episode',
        'The same seed for every candidate',
        'Common random numbers',
        'The same episode length',
      ],
      answer: 'Each candidate playing a different random episode',
      hints: ['Luck would decide.'],
      reviewSection: 'Rigor — common random numbers',
    },
    {
      id: 'mg8-001-quiz-6',
      type: 'choice',
      text: 'How many weights for 4 observations and 2 actions with biases?',
      options: ['10', '8', '6', '4'],
      answer: '10',
      hints: ['(4 + 1) × 2.'],
      reviewSection: 'Challenges — count the weights',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg8-001-1',
      label: 'Read what the agent sees, does and earns',
      type: 'read',
    },
    {
      id: 'cp-mg8-001-2',
      label: 'Read how the cross-entropy method trains',
      type: 'read',
    },
    {
      id: 'cp-mg8-001-3',
      label: 'Read why the reward matters',
      type: 'read',
    },
    {
      id: 'cp-mg8-001-4',
      label: 'Train an agent on Breakout with Run › Train an agent…',
      type: 'lab',
    },
    {
      id: 'cp-mg8-001-5',
      label: 'Watch the trained agent play',
      type: 'lab',
    },
    {
      id: 'cp-mg8-001-6',
      label: 'Work through the policy example',
      type: 'example',
    },
    {
      id: 'cp-mg8-001-7',
      label: 'Work through the failed-reward example',
      type: 'example',
    },
    {
      id: 'cp-mg8-001-8',
      label: 'Attempt the design-an-environment challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-8',
}
