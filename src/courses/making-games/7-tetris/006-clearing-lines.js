export default {
  order: 6,

  id: 'mg7-006',

  slug: 'clearing-lines',

  title: 'Tetris 6: Clearing Lines',

  subtitle: 'Take out full rows and let everything above drop down.',

  tags: ['game-studio', 'tetris', 'arrays'],

  aliases: 'clear lines filter full rows unshift array new rows tetris',

  timeToComplete: 25,

  coreConcept: 'A row is full when it has no 0. clearLines keeps only the rows that still have a 0, adds new empty rows on top until there are 20 again, and returns how many went. Everything above a cleared row drops by itself.',

  prerequisites: ['mg7-005'],

  nextLesson: 'mg7-007',

  hook: {
    question: 'Two rows fill up at once. Do you move every cell above them down by two, one at a time?',
    realWorldContext: "Filtering a list (keeping what passes a test) is one of programming's most-used ideas: search results, inventory sorting, removing dead enemies. Tetris shows it with a picture.",
  },

  intuition: {
    prose: [
      'Rows 18 and 19 are full: no zeros. Row 17 has one cell, [2, 0, 0, …]. After clearing, that row should be at the bottom, row 19, with every row above it moved down two.',
      'Instead of moving cells, keep rows. `this.cells.filter((row) => row.includes(0))` keeps every row that has an empty cell: 18 rows, in order. The two full rows are simply not kept.',
      'Before reading on, predict: where is the old row 17 in the kept list? It is now the last, index 17 of 18. Put two new empty rows at the top with unshift, and it becomes index 19: the bottom.',
      'The count is 20 minus the rows kept: 2. clearLines returns it, for scoring next lesson.',
      'lock() calls clearLines after writing the piece into the board, so a piece that completes a row clears it at once.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Clear full rows',
        body: 'Step 1. const kept = this.cells.filter((row) => row.includes(0)).\nStep 2. const cleared = 20 - kept.length.\nStep 3. While kept.length < 20: kept.unshift(new Array(10).fill(0)).\nStep 4. this.cells = kept; return cleared.\nStep 5. In lock(), after writing the piece: this.clearLines().',
      },
      {
        type: 'warning',
        title: 'Each new row its own array',
        body: 'Adding the same empty row object twice makes two rows that are one array: filling a cell in one fills it in the other. Make each with its own new Array(10).fill(0).',
      },
    ],
    visualizations: [
      {
        id: 'GameStudioTask',
        title: 'Tetris 6: clearing lines',
        props: {
          task: 'tetris-lines',
          lesson: 'mg7-006',
          checkpoint: 'cp-mg7-006-4',
        },
      },
    ],
  },

  math: {
    prose: [
      '**Under the hood (optional).** filter keeps the order of what it keeps. If rows $r_1 < r_2 < \\cdots$ survive, they stay in that order, so each surviving row moves down by the number of full rows below it.',
      'That is exactly the falling rule: a row with $k$ full rows beneath it drops $k$ places. filter computes all of these at once, for 20 rows, with no per-cell work.',
      'Testing a row is up to 10 comparisons, so a whole clear costs at most 200, then up to 4 new rows (at most four rows can fill at once, since a piece spans at most four rows).',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, clearLines maps a board $B$ to $Z^k \\,\\|\\, \\text{filter}(B, \\text{notFull})$: $k$ zero rows followed by the non-full rows in order, where $k$ is the number removed.',
      'The invariants: 20 rows, every row length 10, and the relative order of surviving rows unchanged.',
      'Picture the board as a stack of strips; pull the full strips out and the rest slide down under gravity.',
      'This is "naive gravity": cells above a cleared row do not fall into holes beside them. Some Tetris variants use cascade gravity instead, where every cell falls as far as it can.',
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg7-006-ex1',
      title: 'How many cleared',
      difficulty: 'easy',
      problem: 'After filtering, 17 rows are kept. How many were cleared?',
      steps: [
        {
          expression: '20 - 17 = 3',
          annotation: 'The rows not kept were full.',
          strategyTitle: 'Step 1: Subtract',
        },
      ],
      answer: '3 rows were cleared.',
    },
    {
      id: 'mg7-006-ex2',
      title: 'Where a row ends up',
      difficulty: 'medium',
      problem: 'Rows 18 and 19 are full. Where does the old row 17 end up, and the old row 5?',
      steps: [
        {
          expression: '17 + 2 = 19',
          annotation: 'Two full rows were below it.',
          strategyTitle: 'Step 1: Row 17',
        },
        {
          expression: '5 + 2 = 7',
          annotation: 'The same two were below it too.',
          strategyTitle: 'Step 2: Row 5',
        },
      ],
      answer: 'Row 17 moves to 19; row 5 moves to 7.',
    },
    {
      id: 'mg7-006-ex3',
      title: 'A gap between',
      difficulty: 'hard',
      problem: 'Rows 16 and 19 are full; 17 and 18 are not. Where do 17 and 18 go?',
      steps: [
        {
          expression: '17: \\text{one full row below (19)} \\Rightarrow 18',
          annotation: 'Count only the full rows beneath.',
          strategyTitle: 'Step 1: Row 17',
        },
        {
          expression: '18: \\text{one full row below} \\Rightarrow 19',
          annotation: 'Row 16 is above, so it does not count.',
          strategyTitle: 'Step 2: Row 18',
        },
      ],
      answer: 'Row 17 goes to 18 and row 18 to 19; rows above 16 move down two.',
    },
  ],

  challenges: [
    {
      id: 'mg7-006-ch1',
      title: 'A Tetris',
      difficulty: 'easy',
      problem: 'Four rows clear at once. How many new rows are added at the top?',
      hint: 'Back to 20.',
      answer: 'Four.',
      walkthrough: [
        {
          expression: '20 - 16 = 4',
          annotation: 'One new row per cleared row.',
        },
      ],
    },
    {
      id: 'mg7-006-ch2',
      title: 'Is it full?',
      difficulty: 'medium',
      problem: 'What does [1,2,3,4,5,6,7,1,2,3].includes(0) say, and what does that mean?',
      hint: 'Is there a 0?',
      answer: 'false, so the row is full and will be cleared.',
      walkthrough: [],
    },
    {
      id: 'mg7-006-ch3',
      title: 'Debug the linked rows',
      difficulty: 'hard',
      problem: 'After clearing two lines, placing a piece in the top row also colours the row below it. The code adds the same const empty = new Array(10).fill(0) twice. Why?',
      hint: 'How many arrays were added?',
      answer: 'Both top rows are one array; create a new array for each row inside the loop.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'row.includes(0)',
        meaning: 'Whether the row has an empty cell, so is not full.',
      },
      {
        symbol: 'filter(test)',
        meaning: 'A new list of the items that pass, in their order.',
      },
      {
        symbol: 'unshift(item)',
        meaning: 'Puts an item at the start of a list.',
      },
      {
        symbol: 'clearLines()',
        meaning: 'Removes full rows, refills to 20, and returns how many went.',
      },
    ],
    rulesOfThumb: [
      'Keep what passes rather than removing what fails one by one.',
      'Every new row is its own array.',
      'Return the count; scoring needs it.',
      'Clear right after locking.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Each cell above a cleared row must be moved down by hand.',
      whyStudentsThinkIt: 'That is what happens on screen.',
      correctionExample: 'filter keeps 18 rows in order; adding 2 on top moves them all at once.',
      contrastCase: 'Moving cells one by one is slower and easy to get wrong.',
    },
    {
      falseBelief: 'Cells fall into holes beside them after a clear.',
      whyStudentsThinkIt: 'Gravity pulls everything.',
      correctionExample: 'A cell above a gap stays above it; whole rows move down, not single cells.',
      contrastCase: 'That is naive gravity; cascade gravity is a different rule.',
    },
  ],

  transferPrompts: [
    {
      situation: 'Dead enemies should be removed from a list each frame.',
      competingTechniques: [
        'enemies = enemies.filter((e) => e.alive)',
        'Loop and splice out each dead one',
      ],
      whyThisTechniqueWins: 'filter is one line, keeps order and cannot skip items the way splicing during a loop can.',
    },
    {
      situation: 'A shop should show only items the player can afford.',
      competingTechniques: [
        'items.filter((i) => i.price <= gold)',
        'Hiding the others one by one',
      ],
      whyThisTechniqueWins: 'The test states the rule; filter applies it.',
    },
  ],

  debugging: [
    {
      commonError: 'Using push instead of unshift for the new rows.',
      symptom: 'Cleared rows reappear empty at the bottom and the pile floats.',
      whyItHappened: 'push adds at the end, the bottom of the board.',
      repairStrategy: 'Use unshift to add at the top.',
    },
    {
      commonError: 'Testing row.includes(1) for fullness.',
      symptom: 'Rows of other colours never clear.',
      whyItHappened: 'Full means no zeros, not all ones.',
      repairStrategy: 'Keep rows that include 0.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Write clearLines with filter and new rows.',
    explainVerbally: 'Explain why filter moves every row by the number of full rows below.',
    detectIncorrectApplication: 'Spot shared rows and push/unshift mix-ups.',
    transferToUnfamiliar: 'Use filter for any keep-what-passes job.',
  },

  assessment: {
    questions: [
      {
        id: 'mg7-006-assess-1',
        type: 'choice',
        text: 'Rows 18 and 19 are full. Where does row 17 go?',
        options: ['19', '17', '18', '15'],
        answer: '19',
        hint: 'Two full rows below it.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg7-006-quiz-1',
      type: 'choice',
      text: 'When is a row full?',
      options: [
        'When it has no 0',
        'When it has a 1',
        'When it has 10 cells',
        'When it is at the bottom',
      ],
      answer: 'When it has no 0',
      hints: ['0 is empty.'],
      reviewSection: 'Intuition — the filter paragraph',
    },
    {
      id: 'mg7-006-quiz-2',
      type: 'choice',
      text: 'What does filter keep?',
      options: [
        'The rows that pass the test, in order',
        'The full rows',
        'Random rows',
        'Only the first row',
      ],
      answer: 'The rows that pass the test, in order',
      hints: ['Order is kept.'],
      reviewSection: 'Under the hood — order',
    },
    {
      id: 'mg7-006-quiz-3',
      type: 'choice',
      text: 'Where are new empty rows added?',
      options: [
        'At the top, with unshift',
        'At the bottom, with push',
        'In the middle',
        'Nowhere',
      ],
      answer: 'At the top, with unshift',
      hints: ['The pile drops down.'],
      reviewSection: 'Debugging — push and unshift',
    },
    {
      id: 'mg7-006-quiz-4',
      type: 'choice',
      text: 'Rows 16 and 19 full. Where does row 17 go?',
      options: ['18', '19', '17', '15'],
      answer: '18',
      hints: ['Only row 19 is below it.'],
      reviewSection: 'Examples — A gap between',
    },
    {
      id: 'mg7-006-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT true after clearLines?',
      options: [
        'Cells have fallen into holes beside them',
        'There are 20 rows',
        'Each row has 10 cells',
        'Surviving rows keep their order',
      ],
      answer: 'Cells have fallen into holes beside them',
      hints: ['Whole rows move.'],
      reviewSection: 'Misconceptions — holes',
    },
    {
      id: 'mg7-006-quiz-6',
      type: 'choice',
      text: 'The most rows one piece can clear?',
      options: ['4', '2', '10', '20'],
      answer: '4',
      hints: ['A piece spans at most 4 rows.'],
      reviewSection: 'Under the hood — cost',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg7-006-1',
      label: 'Read how filter clears rows',
      type: 'read',
    },
    {
      id: 'cp-mg7-006-2',
      label: 'Read where the kept rows end up',
      type: 'read',
    },
    {
      id: 'cp-mg7-006-3',
      label: 'Read the clearing procedure',
      type: 'read',
    },
    {
      id: 'cp-mg7-006-4',
      label: 'Complete "Tetris 6: clearing lines" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg7-006-5',
      label: 'Clear two lines at once in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg7-006-6',
      label: 'Work through the where-a-row-ends-up example',
      type: 'example',
    },
    {
      id: 'cp-mg7-006-7',
      label: 'Work through the gap-between example',
      type: 'example',
    },
    {
      id: 'cp-mg7-006-8',
      label: 'Attempt the linked-rows challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-7',
}
