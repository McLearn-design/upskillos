export default {
  order: 8,

  id: 'mg7-008',

  slug: 'every-piece-and-the-end',

  title: 'Tetris 8: Every Piece, and the End',

  subtitle: 'A fair shuffled bag of seven, and game over when the well is full.',

  tags: ['game-studio', 'tetris', 'randomness'],

  aliases: 'random bag shuffle fisher yates game over math random fairness',

  timeToComplete: 30,

  coreConcept: 'Pieces come from a bag of all seven, shuffled with Fisher–Yates and used up before refilling, so no piece is missing for long. The game ends when a new piece cannot be placed: canPlace again.',

  prerequisites: ['mg7-007'],

  nextLesson: 'mg7-009',

  hook: {
    question: 'Picking each piece at random, you can wait 30 pieces for an I. Players call that unfair. How do modern games make random pieces that never starve you?',
    realWorldContext: 'Card games shuffle a deck; music players shuffle a playlist; games shuffle loot tables. Shuffling correctly is a classic trap: the obvious way is subtly biased.',
  },

  intuition: {
    prose: [
      'The bag starts as all seven types: I, O, T, S, Z, J, L. Shuffle it, then take one at a time with pop(). When it is empty, refill and shuffle again. Every seven pieces contain each type exactly once.',
      'Before reading on, predict: with the bag, what is the longest possible wait between two I pieces? An I first in one bag and last in the next: 12 pieces between them. Picking at random, there is no limit.',
      'The shuffle is Fisher–Yates: from the last place down to the second, swap each place with a random place at or before it. `j = Math.floor(Math.random() * (i + 1))`, then swap bag[i] and bag[j].',
      'spawn() with no type takes one from the bag. And spawn checks canPlace for the new piece: if it does not fit, the well is full, so `this.over = true` and the Message label says Game over.',
      'While over, update returns at once: nothing moves.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: A fair bag and an ending',
        body: 'Step 1. Field bag = []; write takeFromBag(): if empty, bag = [...TYPES] and shuffle it (Fisher–Yates); return bag.pop().\nStep 2. spawn(type = this.takeFromBag()); call this.spawn() in ready() and lock().\nStep 3. Add a Message label to the HUD.\nStep 4. In spawn: if the new piece does not fit, this.over = true and set Message to Game over.\nStep 5. At the top of update: if (this.over) return.',
      },
      {
        type: 'warning',
        title: 'The biased shuffle',
        body: 'Sorting by a random number, or swapping each place with any random place (not just those at or before it), looks random but makes some orders more likely than others. Use Fisher–Yates exactly.',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Tetris 8: every piece, and the end',
        props: {
          task: 'tetris-bag',
          lesson: 'mg7-008',
          checkpoint: 'cp-mg7-008-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** There are $7! = 5040$ orders of seven pieces. Fisher–Yates picks the last place from 7 choices, the next from 6, and so on: $7 \\times 6 \\times \\cdots \\times 2 = 5040$ equally likely outcomes, one per order. Every order has chance $1/5040$.',
      'The tempting "swap each place with any of the 7" makes $7^7 = 823543$ equally likely runs, which cannot split evenly over 5040 orders (823543 is not a multiple of 5040), so some orders must come up more often.',
      'With independent random picks, the chance of no I in $n$ pieces is $(6/7)^n$: about 1% for $n = 30$. With the bag it is 0 for $n \\geq 13$.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, Fisher–Yates produces a uniformly random permutation: by induction, after placing position $i$, every arrangement of the placed suffix is equally likely, given unbiased random integers.',
      'The invariant of the bag: within each block of seven, each type appears exactly once.',
      'Picture drawing cards from a deck without putting them back, then shuffling a new deck: fair in the short run, not just on average.',
      "Math.random is a pseudorandom generator: deterministic numbers that look random. Seeding one (Game Studio's Train an agent does) makes a game repeat exactly, which is how its checks and training stay reproducible.",
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg7-008-ex1',
      title: 'How many orders',
      difficulty: 'easy',
      problem: 'How many different orders can a bag of 7 come out in?',
      steps: [
        {
          expression: '7! = 7 \\times 6 \\times 5 \\times 4 \\times 3 \\times 2 \\times 1 = 5040',
          annotation: '7 choices for the first, 6 for the next, and so on.',
          strategyTitle: 'Step 1: Factorial',
        },
      ],
      answer: '5040 orders.',
    },
    {
      id: 'mg7-008-ex2',
      title: 'Longest wait',
      difficulty: 'medium',
      problem: 'With the bag, what is the most pieces that can come between two I pieces?',
      steps: [
        {
          expression: '\\text{I first in bag 1, last in bag 2}',
          annotation: 'The worst case puts them as far apart as possible.',
          strategyTitle: 'Step 1: Worst case',
        },
        {
          expression: '6 + 6 = 12',
          annotation: 'Six after it in its bag, six before it in the next.',
          strategyTitle: 'Step 2: Count between',
        },
      ],
      answer: '12 pieces at most.',
    },
    {
      id: 'mg7-008-ex3',
      title: 'When the game ends',
      difficulty: 'hard',
      problem: 'The pile reaches row 1 in columns 3 to 6. A T spawns at x = 4, y = 1. What happens?',
      steps: [
        {
          expression: '\\text{T cells}: (3,1), (4,1), (5,1), (4,0)',
          annotation: 'Where the new piece would be.',
          strategyTitle: 'Step 1: The new cells',
        },
        {
          expression: 'cells[1][3] \\neq 0 \\Rightarrow \\text{canPlace false}',
          annotation: 'It overlaps the pile.',
          strategyTitle: 'Step 2: Check',
        },
      ],
      answer: 'canPlace fails, so over becomes true and Game over shows.',
    },
  ],

  challenges: [
    {
      id: 'mg7-008-ch1',
      title: 'Each round',
      difficulty: 'easy',
      problem: 'In 21 pieces from the bag, how many T pieces?',
      hint: 'Three bags.',
      answer: 'Exactly 3.',
      walkthrough: [
        {
          expression: '21 / 7 = 3',
          annotation: 'One T per bag.',
        },
      ],
    },
    {
      id: 'mg7-008-ch2',
      title: 'Fisher–Yates steps',
      difficulty: 'medium',
      problem: 'For a bag of 7, how many swaps does Fisher–Yates make?',
      hint: 'From place 6 down to place 1.',
      answer: '6 swaps.',
      walkthrough: [],
    },
    {
      id: 'mg7-008-ch3',
      title: 'Debug the endless game',
      difficulty: 'hard',
      problem: 'The well fills to the top, but pieces keep spawning on top of each other. What is missing?',
      hint: 'Where should the game check for the end?',
      answer: 'spawn never checks canPlace for the new piece; if it does not fit, set over and stop updating.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'bag',
        meaning: 'The piece types still to come this round of seven.',
      },
      {
        symbol: 'Fisher–Yates',
        meaning: 'Swap each place, from the end, with a random place at or before it: a fair shuffle.',
      },
      {
        symbol: '7! = 5040',
        meaning: 'The number of orders of seven pieces.',
      },
      {
        symbol: 'over',
        meaning: 'True when a new piece cannot fit; the game stops.',
      },
    ],
    rulesOfThumb: [
      'Shuffle with Fisher–Yates, never by sorting on random numbers.',
      'Use a bag when fairness matters more than surprise.',
      'Check the end at the moment a new piece arrives.',
      'Stop everything with one flag checked at the top of update.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Random picks are fair because each piece has a 1-in-7 chance.',
      whyStudentsThinkIt: 'Fair on average sounds like fair.',
      correctionExample: 'Independent picks can go 30 pieces without an I about 1% of the time.',
      contrastCase: 'The bag guarantees one of each every seven.',
    },
    {
      falseBelief: 'Any way of swapping randomly gives a fair shuffle.',
      whyStudentsThinkIt: 'Every step is random.',
      correctionExample: 'Swapping with any of 7 places gives 823543 runs over 5040 orders, which cannot be even.',
      contrastCase: 'Fisher–Yates gives exactly 5040 equally likely runs.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A card game deals a deck of 52.',
      competingTechniques: [
        'Fisher–Yates on the deck, then deal from the end',
        'Pick a random card each time, allowing repeats',
      ],
      whyThisTechniqueWins: 'A real deck has no repeats, and Fisher–Yates is uniform.',
    },
    {
      situation: 'Loot should feel generous but random.',
      competingTechniques: [
        'A shuffled bag of rewards, refilled when empty',
        'Independent random rolls',
      ],
      whyThisTechniqueWins: 'The bag stops long droughts while staying unpredictable.',
    },
  ],

  debugging: [
    {
      commonError: 'Math.floor(Math.random() * i) instead of (i + 1).',
      symptom: 'The shuffle never leaves an element where it was; some orders never happen.',
      whyItHappened: 'The current place is excluded from the choices.',
      repairStrategy: 'Pick from 0 to i inclusive with Math.random() * (i + 1).',
    },
    {
      commonError: 'Checking over after moving, not at the top of update.',
      symptom: 'After game over, the piece still drifts or locks.',
      whyItHappened: 'Some of update runs before the check.',
      repairStrategy: 'Return at the very start of update when over.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Write a bag with Fisher–Yates and a game-over check.',
    explainVerbally: 'Explain why Fisher–Yates is uniform and the naive swap is not.',
    detectIncorrectApplication: 'Spot biased shuffles and missing end checks.',
    transferToUnfamiliar: 'Use bags and shuffles in other games.',
  },

  assessment: {
    questions: [
      {
        id: 'mg7-008-assess-1',
        type: 'choice',
        text: 'How many orders of a bag of 7?',
        options: ['5040', '49', '823543', '7'],
        answer: '5040',
        hint: '7!.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg7-008-quiz-1',
      type: 'choice',
      text: 'What does the bag guarantee?',
      options: [
        'Each type once every seven pieces',
        'No repeats ever',
        'Random picks',
        'The I comes first',
      ],
      answer: 'Each type once every seven pieces',
      hints: ['Used up before refilling.'],
      reviewSection: 'Intuition — the bag paragraph',
    },
    {
      id: 'mg7-008-quiz-2',
      type: 'choice',
      text: 'In Fisher–Yates, j is picked from where?',
      options: ['0 to i inclusive', '0 to 6 always', 'i to 6', '0 to i − 1'],
      answer: '0 to i inclusive',
      hints: ['At or before i; 0 to i − 1 is the near-miss.'],
      reviewSection: 'Intuition — the shuffle paragraph',
    },
    {
      id: 'mg7-008-quiz-3',
      type: 'choice',
      text: 'When does the game end?',
      options: [
        'When a new piece cannot fit',
        'When the score is 1000',
        'After 100 pieces',
        'When a line clears',
      ],
      answer: 'When a new piece cannot fit',
      hints: ['canPlace in spawn.'],
      reviewSection: 'Intuition — the spawn paragraph',
    },
    {
      id: 'mg7-008-quiz-4',
      type: 'choice',
      text: 'The longest gap between two I pieces with the bag?',
      options: ['12', '6', '7', 'Unlimited'],
      answer: '12',
      hints: ['First in one bag, last in the next.'],
      reviewSection: 'Examples — Longest wait',
    },
    {
      id: 'mg7-008-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT a fair shuffle?',
      options: [
        'Swapping each place with any random place',
        'Fisher–Yates',
        'Drawing without replacement from a hat',
        'Picking a random unused item each time',
      ],
      answer: 'Swapping each place with any random place',
      hints: ['7⁷ runs cannot split evenly.'],
      reviewSection: 'Under the hood — bias',
    },
    {
      id: 'mg7-008-quiz-6',
      type: 'choice',
      text: 'Chance of no I in 30 independent random picks?',
      options: ['About 1%', '0', 'About 50%', 'About 14%'],
      answer: 'About 1%',
      hints: ['(6/7)³⁰.'],
      reviewSection: 'Under the hood — droughts',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg7-008-1',
      label: 'Read how the bag works',
      type: 'read',
    },
    {
      id: 'cp-mg7-008-2',
      label: 'Read Fisher–Yates',
      type: 'read',
    },
    {
      id: 'cp-mg7-008-3',
      label: 'Read the bag and ending procedure',
      type: 'read',
    },
    {
      id: 'cp-mg7-008-4',
      label: 'Complete "Tetris 8: every piece, and the end" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg7-008-5',
      label: 'Play until game over in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg7-008-6',
      label: 'Work through the longest-wait example',
      type: 'example',
    },
    {
      id: 'cp-mg7-008-7',
      label: 'Work through the game-ends example',
      type: 'example',
    },
    {
      id: 'cp-mg7-008-8',
      label: 'Attempt the endless-game challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-7',
}
