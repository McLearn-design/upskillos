export default {
  order: 1,

  id: 'mg8-001',

  slug: 'a-game-that-learns',

  title: 'Bonus: A Game That Learns to Play Itself',

  subtitle: 'Q-learning from the ground up, in a notebook and then in Game Studio, where it learns Breakout from a score alone.',

  tags: [
    'game-studio',
    'machine-learning',
    'reinforcement-learning',
    'q-learning',
  ],

  aliases: 'reinforcement learning q-learning q table bellman equation td error temporal difference epsilon greedy discount return environment agent reward state bins train',

  timeToComplete: 60,

  coreConcept: 'An agent learns by trial and error what each action is worth in each state. Q-learning keeps a table of Q(s, a), the return it expects from taking action a in state s and playing well afterwards, and after every step nudges one entry towards what that step showed: the reward plus the discounted best value of the next state, Q(s, a) ← Q(s, a) + α [r + γ max Q(s′, ·) − Q(s, a)]. Acting greedily on the table is the learned policy. In Game Studio a game becomes the environment: its numbers, cut into bins, are the states; its controls are the actions; its score is the reward.',

  prerequisites: ['mg7-009'],

  nextLesson: null,

  hook: {
    question: 'Could Breakout learn to play itself, with no rules written for it, only a score to chase? Nobody tells it "move towards the ball". How could a table of numbers, updated one step at a time, end up clearing the wall?',
    realWorldContext: "Q-learning (Watkins, 1989) is the root of the agents that learned Atari games from the score alone (DQN, 2015, is Q-learning with a neural network in place of the table). The ML Lab's lab 37 derives it on a gridworld; this lesson builds it again on a game, then trains it on your Breakout in Game Studio with Run › Train an agent….",
  },

  intuition: {
    prose: [
      "**The loop.** An agent and a game take turns. At step t the agent sees the state $S_t$, picks an action $A_t$, and the game answers with a reward $R_{t+1}$ and the next state $S_{t+1}$. An **episode** is one game, from reset until it ends. In Game Studio a step is 4 frames, so a Breakout agent decides 15 times a second; its actions are the player's controls (hold left, or hold right, with Space so the ball launches), and its reward is +1 for every brick and −3 for every lost ball.",
      '**States.** A table needs a finite list of states, and a game\'s numbers are continuous. So each number the agent uses is cut into **bins** by cut points: a value falls in bin $i$ when $i$ of the cuts are below it, and the bins of several numbers combine like digits. The notebook\'s Catch game has 11 offsets (ball minus paddle) times 4 rows: 44 states. Breakout uses 7 bins of "ball minus paddle" and 2 of "going up or down": 14 states. Before running cell 1, predict how often random play catches the ball in Catch: about 1 in 6.',
      '**The return.** What the agent wants is not the next reward but all of them, with later ones counting a little less: $G_t = R_{t+1} + \\gamma R_{t+2} + \\gamma^2 R_{t+3} + \\cdots$, with discount $0 \\le \\gamma < 1$. It satisfies $G_t = R_{t+1} + \\gamma G_{t+1}$: one reward, then the return from the next step on. Before running cell 2, predict the return of a catch in Catch, rewards 0, 0, 0, 1 with $\\gamma = 0.97$: $0.97^3 \\approx 0.913$.',
      "**What an action is worth.** $Q(s, a)$ is the return the agent expects if it takes $a$ in $s$ and plays well afterwards. The best possible values, $Q^*$, obey the **Bellman optimality equation**: $Q^*(s, a) = \\mathbb{E}[R_{t+1} + \\gamma \\max_{a'} Q^*(S_{t+1}, a') \\mid S_t = s, A_t = a]$. One step's reward, then the best you can do from where you land. If you had $Q^*$, playing well would be easy: in each state take the action with the highest value (act **greedily**).",
      "**The update.** The agent does not know $Q^*$, and the game's rules are hidden in its code. But every step it takes is one sample of the right-hand side: it saw $r$ and $s'$. So it moves its estimate a fraction $\\alpha$ towards that sample. The **TD target** is $r + \\gamma \\max_{a'} Q(s', a')$ (just $r$ when the step ended the episode), the **TD error** is $\\delta = \\text{target} - Q(s, a)$, and $Q(s, a) \\leftarrow Q(s, a) + \\alpha\\delta$. Before running cell 3, predict the new value for $Q = 0.5$, $r = 1$, next row $[0.8, 0.3]$, $\\gamma = 0.97$, $\\alpha = 0.2$: the target is $1.776$, $\\delta = 1.276$, so $0.7552$.",
      '**Exploring.** A table that starts at all zeros has nothing to prefer, and an agent that only ever does what it currently thinks best never finds out about the rest. So it acts **ε-greedily**: with probability ε a random action, otherwise the greedy one, ties broken at random. Game Studio lowers ε from 0.3 to 0.02 over training: explore first, exploit later. Before running cell 4, predict how many episodes Catch needs before greedy play catches every ball: about 25.',
      "**What the table holds.** After training, the greedy choices can be right while many numbers are not yet $Q^*$: actions the agent stopped trying keep their old estimates. Cell 5 compares them, then trains with ε = 1 (every action random) and the table converges to $Q^*$ anyway. Q-learning learns the best policy's values while behaving differently: it is **off-policy**, because its target uses the max, not the action it will actually take.",
      '**In Game Studio.** Run › Train an agent… holds the environment as JSON: what the agent sees (node paths such as Ball:position.x, with the bins that make them states), does and earns. Train plays Breakout headless on the real engine, about 100 episodes in 15 seconds. Every 10 episodes it plays greedily, without learning, on games it did not train on, and keeps the best table: a table on binned states is noisy, and one bin hides details that matter. Random play averages −5.3; the trained agent averages 48.0, the whole wall. With only 3 bins across it averages 34.0. Try it below.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Train a Q-learning agent on a game',
        body: 'Step 1. Say what the agent sees: node paths to numbers, scaled to about −1 to 1, and differences (minus) where the difference is what decides the move. Step 2. Cut the deciding numbers into bins: a cut point at each place the right action changes. Step 3. Say what it does (input actions held for a step) and what it earns (how much each value changes). Step 4. Train: α 0.2, γ 0.97, ε from 0.3 down; watch the learning curve and the greedy checks. Step 5. Read the table: rows it visited often, and what it does there. Step 6. Watch it play, and change the states or the reward if it plays oddly.',
      },
      {
        type: 'warning',
        title: 'A table only knows the states you give it',
        body: 'Two situations in the same bin get the same row, so the agent must do the same in both. In Breakout the state leaves out the ball\'s sideways speed, so "far to the right" mixes a ball flying away with one coming back off the wall, and some rows look wrong even after hundreds of visits. Fewer bins make it worse (34 instead of 48); more readings with bins make more states, each visited less often.',
      },
      {
        type: 'warning',
        title: 'Rewards teach exactly what they say',
        body: 'With +1 per brick and nothing for losing a ball, three training runs scored 43, 1 and 48: catching the ball only pays off through later bricks, which a short-sighted or unlucky run misses. With −3 per lost ball all three scored 48. An agent chases the reward you wrote, not the one you meant (ML Lab lesson 37.5).',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 7)',
        body: 'Misconception it contradicts: "the agent learns rules". It learns a number for each state and action; the arrows are just where the biggest number is. Grey squares were never visited, so their row is still all zeros: the table knows nothing there.',
      },
      {
        type: 'insight',
        title: 'The other button, Cross-entropy',
        body: 'Run › Train an agent… also has the cross-entropy method: it never learns values, it tries many random weightings of a linear rule, keeps the best few, and searches around them (37 on Breakout). Q-learning learns from every step; the cross-entropy method only from whole games.',
      },
      {
        type: 'insight',
        title: 'Where this comes from',
        body: "The ML Lab's lab 37 (Reinforcement learning) derives all of this on a gridworld: lesson 37.1 the loop and returns, 37.2 value functions and the Bellman equations, 37.3 value iteration, 37.4 Q-learning, 37.5 reward misspecification. [Open the ML Lab](#/lab/ml-lab) for the full derivations.",
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: Q-learning on a small game',
        caption: "States, returns, one update, training, the table against Q*, Breakout's bins, and a picture of what it learned.",
        props: {
          lesson: {
            title: 'Q-learning',
            subtitle: 'A table of values, learned one step at a time.',
            cells: [
              {
                type: 'js',
                instruction: '### 1. The game and its states\nPredict first: how often random play catches.',
                startCode: "// Catch: a ball falls down 4 rows in one of 5 columns; the paddle starts in column 2 and, each step,\n// moves left, stays, or moves right. Catching earns +1, missing −1. (Game Studio's random-number generator.)\nconst seeded = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }\nconst ROWS = 4, MOVES = [-1, 0, 1], NAMES = ['left', 'stay', 'right']\nconst reset = (rand) => ({ ball: Math.floor(rand() * 5), paddle: 2, row: 0 })\nfunction step(g, a) {                              // S_t, A_t → R_{t+1}, S_{t+1}\n  g.paddle += MOVES[a]; g.row++\n  if (g.row < ROWS) return { reward: 0, done: false }\n  return { reward: g.ball === g.paddle ? 1 : -1, done: true }\n}\n// The state: how far the ball is across from the paddle (−5 to 5) and its row (0 to 3): 11 × 4 = 44 states.\nconst stateOf = (g) => (g.ball - g.paddle + 5) * ROWS + g.row\nconst greedy = (row) => { let b = 0; for (let a = 1; a < row.length; a++) if (row[a] > row[b]) b = a; return b }\n// How often a policy catches, over the 5 starting columns (the rest of the game is fixed).\nfunction catchRate(policy) {\n  let caught = 0\n  for (let b = 0; b < 5; b++) { const g = { ball: b, paddle: 2, row: 0 }; for (;;) { const r = step(g, policy(stateOf(g))); if (r.done) { caught += r.reward > 0; break } } }\n  return caught / 5\n}\n\n// Before running: predict how often random play catches the ball.\nconst rand = seeded(9)\nlet total = 0\nfor (let k = 0; k < 1000; k++) total += catchRate(() => Math.floor(rand() * 3))\nconsole.log('states: ' + 11 * ROWS + ', actions: 3, Q values: ' + 11 * ROWS * 3)\nconsole.log('random play catches ' + (total / 1000).toFixed(3) + ' of the time')",
              },
              {
                type: 'js',
                instruction: '### 2. The return\nPredict first: G₀ for a catch.',
                startCode: "// The return G_t = R_{t+1} + γ R_{t+2} + γ² R_{t+3} + …, and its recursion G_t = R_{t+1} + γ G_{t+1}.\n// A catch: rewards 0, 0, 0, then +1. Predict first: G_0 with γ = 0.97.\nconst gamma = 0.97, rewards = [0, 0, 0, 1]                    // R_1 … R_4\nlet G = 0\nfor (let k = 0; k < rewards.length; k++) G += gamma ** k * rewards[k]\nconsole.log('G_0 by the sum: ' + G.toFixed(6))\nlet back = 0\nfor (let t = rewards.length - 1; t >= 0; t--) back = rewards[t] + gamma * back   // G_t = R_{t+1} + γ G_{t+1}, from the end\nconsole.log('G_0 by the recursion: ' + back.toFixed(6))\nconsole.log('a Breakout brick 15 steps (1 second) away is worth ' + (0.97 ** 15).toFixed(3) + ' now')",
              },
              {
                type: 'js',
                instruction: '### 3. One update\nPredict first: the new Q(s, a).',
                startCode: "// One Q-learning update by hand. Q(s, a) = 0.5; the agent takes a, earns r = 1, lands in s′ whose row is\n// [0.8, 0.3]. γ = 0.97, α = 0.2. Predict first: the new Q(s, a).\nconst q = 0.5, r = 1, nextRow = [0.8, 0.3], gamma = 0.97, alpha = 0.2\nconst target = r + gamma * Math.max(...nextRow)              // r + γ max_a′ Q(s′, a′)\nconst delta = target - q                                     // the TD error δ\nconsole.log('target ' + target.toFixed(4) + ', TD error δ ' + delta.toFixed(4) + ', new Q ' + (q + alpha * delta).toFixed(4))",
              },
              {
                type: 'js',
                instruction: '### 4. Training\nPredict first: how many episodes until it catches every ball.',
                startCode: "// Catch: a ball falls down 4 rows in one of 5 columns; the paddle starts in column 2 and, each step,\n// moves left, stays, or moves right. Catching earns +1, missing −1. (Game Studio's random-number generator.)\nconst seeded = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }\nconst ROWS = 4, MOVES = [-1, 0, 1], NAMES = ['left', 'stay', 'right']\nconst reset = (rand) => ({ ball: Math.floor(rand() * 5), paddle: 2, row: 0 })\nfunction step(g, a) {                              // S_t, A_t → R_{t+1}, S_{t+1}\n  g.paddle += MOVES[a]; g.row++\n  if (g.row < ROWS) return { reward: 0, done: false }\n  return { reward: g.ball === g.paddle ? 1 : -1, done: true }\n}\n// The state: how far the ball is across from the paddle (−5 to 5) and its row (0 to 3): 11 × 4 = 44 states.\nconst stateOf = (g) => (g.ball - g.paddle + 5) * ROWS + g.row\nconst greedy = (row) => { let b = 0; for (let a = 1; a < row.length; a++) if (row[a] > row[b]) b = a; return b }\n// How often a policy catches, over the 5 starting columns (the rest of the game is fixed).\nfunction catchRate(policy) {\n  let caught = 0\n  for (let b = 0; b < 5; b++) { const g = { ball: b, paddle: 2, row: 0 }; for (;;) { const r = step(g, policy(stateOf(g))); if (r.done) { caught += r.reward > 0; break } } }\n  return caught / 5\n}\n// Q-learning, exactly as Game Studio's ml/qlearning.ts does it: ε-greedy (ties broken at random), ε falling\n// linearly from 0.3 to 0.02, and the update Q(s, a) ← Q(s, a) + α [r + γ max Q(s′, ·) − Q(s, a)].\nfunction train({ episodes, alpha = 0.2, gamma = 0.97, epsilon = 0.3, epsilonEnd = 0.02, seed = 1 }) {\n  const rand = seeded(seed), Q = Array.from({ length: 44 }, () => [0, 0, 0])\n  const pick = (row) => { const best = Math.max(...row), ties = [0, 1, 2].filter((a) => row[a] === best); return ties[Math.floor(rand() * ties.length)] }\n  for (let ep = 0; ep < episodes; ep++) {\n    const eps = epsilon + (epsilonEnd - epsilon) * (episodes > 1 ? ep / (episodes - 1) : 1)\n    const g = reset(rand)\n    let s = stateOf(g)\n    for (;;) {\n      const a = rand() < eps ? Math.floor(rand() * 3) : pick(Q[s])         // A_t, ε-greedy\n      const r = step(g, a), next = stateOf(g)                              // R_{t+1}, S_{t+1}\n      const target = r.reward + (r.done ? 0 : gamma * Math.max(...Q[next]))   // the TD target\n      Q[s][a] += alpha * (target - Q[s][a])                                // α × the TD error δ\n      s = next\n      if (r.done) break\n    }\n  }\n  return Q\n}\n\n// Predict first: after how many episodes does the greedy policy catch every ball?\nfor (const episodes of [0, 10, 25, 50, 300]) {\n  const Q = train({ episodes })\n  console.log(String(episodes).padStart(3) + ' episodes: greedy play catches ' + catchRate((s) => greedy(Q[s])))\n}",
              },
              {
                type: 'js',
                instruction: '### 5. The table against Q*\nPredict first: are they equal after 300 episodes?',
                startCode: "// Catch: a ball falls down 4 rows in one of 5 columns; the paddle starts in column 2 and, each step,\n// moves left, stays, or moves right. Catching earns +1, missing −1. (Game Studio's random-number generator.)\nconst seeded = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }\nconst ROWS = 4, MOVES = [-1, 0, 1], NAMES = ['left', 'stay', 'right']\nconst reset = (rand) => ({ ball: Math.floor(rand() * 5), paddle: 2, row: 0 })\nfunction step(g, a) {                              // S_t, A_t → R_{t+1}, S_{t+1}\n  g.paddle += MOVES[a]; g.row++\n  if (g.row < ROWS) return { reward: 0, done: false }\n  return { reward: g.ball === g.paddle ? 1 : -1, done: true }\n}\n// The state: how far the ball is across from the paddle (−5 to 5) and its row (0 to 3): 11 × 4 = 44 states.\nconst stateOf = (g) => (g.ball - g.paddle + 5) * ROWS + g.row\nconst greedy = (row) => { let b = 0; for (let a = 1; a < row.length; a++) if (row[a] > row[b]) b = a; return b }\n// How often a policy catches, over the 5 starting columns (the rest of the game is fixed).\nfunction catchRate(policy) {\n  let caught = 0\n  for (let b = 0; b < 5; b++) { const g = { ball: b, paddle: 2, row: 0 }; for (;;) { const r = step(g, policy(stateOf(g))); if (r.done) { caught += r.reward > 0; break } } }\n  return caught / 5\n}\n// Q-learning, exactly as Game Studio's ml/qlearning.ts does it: ε-greedy (ties broken at random), ε falling\n// linearly from 0.3 to 0.02, and the update Q(s, a) ← Q(s, a) + α [r + γ max Q(s′, ·) − Q(s, a)].\nfunction train({ episodes, alpha = 0.2, gamma = 0.97, epsilon = 0.3, epsilonEnd = 0.02, seed = 1 }) {\n  const rand = seeded(seed), Q = Array.from({ length: 44 }, () => [0, 0, 0])\n  const pick = (row) => { const best = Math.max(...row), ties = [0, 1, 2].filter((a) => row[a] === best); return ties[Math.floor(rand() * ties.length)] }\n  for (let ep = 0; ep < episodes; ep++) {\n    const eps = epsilon + (epsilonEnd - epsilon) * (episodes > 1 ? ep / (episodes - 1) : 1)\n    const g = reset(rand)\n    let s = stateOf(g)\n    for (;;) {\n      const a = rand() < eps ? Math.floor(rand() * 3) : pick(Q[s])         // A_t, ε-greedy\n      const r = step(g, a), next = stateOf(g)                              // R_{t+1}, S_{t+1}\n      const target = r.reward + (r.done ? 0 : gamma * Math.max(...Q[next]))   // the TD target\n      Q[s][a] += alpha * (target - Q[s][a])                                // α × the TD error δ\n      s = next\n      if (r.done) break\n    }\n  }\n  return Q\n}\n// Q*: the Bellman optimality equation, solved backwards from the last row (the game always ends after 4 steps).\n//   Q*(s, a) = R + γ · max_a′ Q*(s′, a′)      (the max term is 0 when the step ends the game)\nfunction qStar(gamma = 0.97) {\n  const Q = Array.from({ length: 44 }, () => [0, 0, 0])\n  for (let row = ROWS - 1; row >= 0; row--) for (let off = -5; off <= 5; off++) for (let a = 0; a < 3; a++) {\n    const off2 = off - MOVES[a], s = (off + 5) * ROWS + row        // the paddle moves, so the offset changes\n    if (row === ROWS - 1) Q[s][a] = off2 === 0 ? 1 : -1              // this step ends it: catch or miss\n    else Q[s][a] = Math.abs(off2) > 5 ? -1 : gamma * Math.max(...Q[(off2 + 5) * ROWS + row + 1])\n  }\n  return Q\n}\n\n// The table learned in 300 episodes against Q*. Predict first: are they equal?\nconst Q = train({ episodes: 300 }), S = qStar()\nconst f = (row) => row.map((x) => x.toFixed(3).padStart(6)).join(' ')\nconsole.log('state (offset, row)    learned Q (left stay right)   Q*')\nfor (const [off, row] of [[2, 0], [1, 2], [0, 3], [1, 3]]) {\n  const s = (off + 5) * ROWS + row\n  console.log('(' + String(off).padStart(2) + ', ' + row + ')            ' + f(Q[s]) + '      ' + f(S[s]))\n}\n// With exploration that never stops (ε = 1: every action random), every reachable pair keeps being tried.\nconst reach = []\nfor (let b = 0; b < 5; b++) { const go = (off, row) => { if (row >= ROWS) return; reach.push((off + 5) * ROWS + row); for (const m of MOVES) go(off - m, row + 1) }; go(b - 2, 0) }\nconst states = [...new Set(reach)]\nfor (const episodes of [1000, 20000]) {\n  const R = train({ episodes, epsilon: 1, epsilonEnd: 1 })\n  let worst = 0\n  for (const s of states) for (let a = 0; a < 3; a++) worst = Math.max(worst, Math.abs(R[s][a] - S[s][a]))\n  console.log('ε = 1, ' + episodes + ' episodes: largest |Q − Q*| ' + worst.toFixed(4) + ', greedy catches ' + catchRate((s) => greedy(R[s])))\n}",
              },
              {
                type: 'js',
                instruction: "### 6. Breakout's states\nPredict first: the state of [0.2, 0.5, −0.3, 0.9].",
                startCode: "// Breakout's states (ml/qlearning.ts): a reading falls in bin i when i of its cut points are below it, and the\n// binned readings combine like digits. Breakout bins the ball's x minus the paddle's (7 bins) and the ball's\n// velocity.y (2 bins). Predict first: the state of [0.2, 0.5, −0.3, 0.9].\nconst binOf = (value, cuts) => { let i = 0; while (i < cuts.length && value >= cuts[i]) i++; return i }\nconst bins = [[-0.25, -0.1, -0.03, 0.03, 0.1, 0.25], [], [], [0]]       // across, height, velocity.x, velocity.y\nconst stateOf = (o) => bins.reduce((s, cuts, i) => (cuts.length ? s * (cuts.length + 1) + binOf(o[i], cuts) : s), 0)\nconsole.log('states: ' + bins.reduce((n, c) => (c.length ? n * (c.length + 1) : n), 1))\nfor (const o of [[0.2, 0.5, -0.3, 0.9], [-0.9, 0.5, 0.3, -0.9], [0, 0.84, 0, -0.94]]) console.log('[' + o.join(', ') + '] is in state ' + stateOf(o))",
              },
              {
                type: 'js',
                instruction: '### 7. See it\nThe Catch table as arrows.',
                startCode: "// Catch: a ball falls down 4 rows in one of 5 columns; the paddle starts in column 2 and, each step,\n// moves left, stays, or moves right. Catching earns +1, missing −1. (Game Studio's random-number generator.)\nconst seeded = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }\nconst ROWS = 4, MOVES = [-1, 0, 1], NAMES = ['left', 'stay', 'right']\nconst reset = (rand) => ({ ball: Math.floor(rand() * 5), paddle: 2, row: 0 })\nfunction step(g, a) {                              // S_t, A_t → R_{t+1}, S_{t+1}\n  g.paddle += MOVES[a]; g.row++\n  if (g.row < ROWS) return { reward: 0, done: false }\n  return { reward: g.ball === g.paddle ? 1 : -1, done: true }\n}\n// The state: how far the ball is across from the paddle (−5 to 5) and its row (0 to 3): 11 × 4 = 44 states.\nconst stateOf = (g) => (g.ball - g.paddle + 5) * ROWS + g.row\nconst greedy = (row) => { let b = 0; for (let a = 1; a < row.length; a++) if (row[a] > row[b]) b = a; return b }\n// How often a policy catches, over the 5 starting columns (the rest of the game is fixed).\nfunction catchRate(policy) {\n  let caught = 0\n  for (let b = 0; b < 5; b++) { const g = { ball: b, paddle: 2, row: 0 }; for (;;) { const r = step(g, policy(stateOf(g))); if (r.done) { caught += r.reward > 0; break } } }\n  return caught / 5\n}\n// Q-learning, exactly as Game Studio's ml/qlearning.ts does it: ε-greedy (ties broken at random), ε falling\n// linearly from 0.3 to 0.02, and the update Q(s, a) ← Q(s, a) + α [r + γ max Q(s′, ·) − Q(s, a)].\nfunction train({ episodes, alpha = 0.2, gamma = 0.97, epsilon = 0.3, epsilonEnd = 0.02, seed = 1 }) {\n  const rand = seeded(seed), Q = Array.from({ length: 44 }, () => [0, 0, 0])\n  const pick = (row) => { const best = Math.max(...row), ties = [0, 1, 2].filter((a) => row[a] === best); return ties[Math.floor(rand() * ties.length)] }\n  for (let ep = 0; ep < episodes; ep++) {\n    const eps = epsilon + (epsilonEnd - epsilon) * (episodes > 1 ? ep / (episodes - 1) : 1)\n    const g = reset(rand)\n    let s = stateOf(g)\n    for (;;) {\n      const a = rand() < eps ? Math.floor(rand() * 3) : pick(Q[s])         // A_t, ε-greedy\n      const r = step(g, a), next = stateOf(g)                              // R_{t+1}, S_{t+1}\n      const target = r.reward + (r.done ? 0 : gamma * Math.max(...Q[next]))   // the TD target\n      Q[s][a] += alpha * (target - Q[s][a])                                // α × the TD error δ\n      s = next\n      if (r.done) break\n    }\n  }\n  return Q\n}\n\n// The Catch table after 300 episodes, as a picture: one square per state (offset across, row down), its colour\n// the best Q (green high, red low, grey never tried), its arrow the action the greedy policy takes.\nconst Q = train({ episodes: 300 })\nconst canvas = document.createElement('canvas'), W = 420, H = 230, cell = 34\ncanvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'\ndocument.body.appendChild(canvas)\nconst g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)\nconst x0 = 24, y0 = 34\nlet tried = 0\nfor (let off = -5; off <= 5; off++) for (let row = 0; row < ROWS; row++) {\n  const q = Q[(off + 5) * ROWS + row], best = Math.max(...q), untried = q.every((v) => v === 0)\n  const x = x0 + (off + 5) * cell, y = y0 + row * cell\n  g.fillStyle = untried ? '#334155' : best >= 0 ? 'rgba(52, 211, 153, ' + (0.25 + 0.75 * best) + ')' : 'rgba(248, 113, 113, ' + (0.25 - 0.75 * best) + ')'\n  g.fillRect(x + 1, y + 1, cell - 2, cell - 2)\n  if (untried) continue\n  tried++\n  g.fillStyle = '#0f1923'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'\n  g.fillText(['←', '•', '→'][greedy(q)], x + cell / 2, y + cell / 2 + 6)\n}\ng.fillStyle = '#cbd5e1'; g.font = '11px sans-serif'; g.textAlign = 'center'\nfor (let off = -5; off <= 5; off++) g.fillText(String(off), x0 + (off + 5) * cell + cell / 2, y0 + ROWS * cell + 14)\ng.textAlign = 'left'; g.fillText('ball − paddle (offset) →', x0, y0 + ROWS * cell + 30)\ng.fillText('row 0 (top) to row 3: arrows are the greedy action', x0, 18)\nconsole.log('states tried: ' + tried + ' of 44')",
                showPreviewByDefault: true,
                outputHeight: 280,
              },
              {
                type: 'challenge',
                instruction: '### 8. Challenge: write the update\nThe cases below check it.',
                startCode: "// Write the Q-learning update. Given Q(s, a), the reward r, the next state's row of Q values and whether the step\n// ended the episode, return the new Q(s, a).\nfunction qUpdate(q, reward, nextRow, done, alpha, gamma) {\n  return q\n}\n\n// ── The check: cases with the answers a correct update gives (leave this part as it is) ──\nconst cases = [\n  { args: [0.4, 0, [1.2, 0.9], false, 0.2, 0.97], want: 0.5528, why: 'the target is r + γ · (the largest Q in the next row); move α of the way from q to it' },\n  { args: [0, 1, [5, 5], true, 0.2, 0.97], want: 0.2, why: 'this step ended the episode: there is no future, so the target is r alone' },\n  { args: [1, 0, [0.3, 0.8, -1], false, 0.5, 0.9], want: 0.86, why: 'use the largest Q in the next row (0.8), not the first' },\n  { args: [-0.5, -1, [2, 2], true, 1, 0.97], want: -1, why: 'with α = 1 the new value is the target itself, and this step ended the episode, so the target is r alone' },\n]\nlet passed = 0\nfor (const [i, c] of cases.entries()) {\n  const got = qUpdate(...c.args)\n  const ok = typeof got === 'number' && Math.abs(got - c.want) < 1e-9\n  passed += ok\n  console.log((ok ? '✓' : '✗') + ' case ' + (i + 1) + ': got ' + (typeof got === 'number' ? +got.toFixed(6) : got) + (ok ? '' : ', want ' + c.want + ': ' + c.why))\n}\nconsole.log(passed === cases.length ? '✓ All 4 cases pass: that is the Q-learning update.' : passed + ' of 4 cases pass.')",
                solutionCode: "// Write the Q-learning update. Given Q(s, a), the reward r, the next state's row of Q values and whether the step\n// ended the episode, return the new Q(s, a).\nfunction qUpdate(q, reward, nextRow, done, alpha, gamma) {\n  const target = reward + (done ? 0 : gamma * Math.max(...nextRow))\n  return q + alpha * (target - q)\n}\n\n// ── The check: cases with the answers a correct update gives (leave this part as it is) ──\nconst cases = [\n  { args: [0.4, 0, [1.2, 0.9], false, 0.2, 0.97], want: 0.5528, why: 'the target is r + γ · (the largest Q in the next row); move α of the way from q to it' },\n  { args: [0, 1, [5, 5], true, 0.2, 0.97], want: 0.2, why: 'this step ended the episode: there is no future, so the target is r alone' },\n  { args: [1, 0, [0.3, 0.8, -1], false, 0.5, 0.9], want: 0.86, why: 'use the largest Q in the next row (0.8), not the first' },\n  { args: [-0.5, -1, [2, 2], true, 1, 0.97], want: -1, why: 'with α = 1 the new value is the target itself, and this step ended the episode, so the target is r alone' },\n]\nlet passed = 0\nfor (const [i, c] of cases.entries()) {\n  const got = qUpdate(...c.args)\n  const ok = typeof got === 'number' && Math.abs(got - c.want) < 1e-9\n  passed += ok\n  console.log((ok ? '✓' : '✗') + ' case ' + (i + 1) + ': got ' + (typeof got === 'number' ? +got.toFixed(6) : got) + (ok ? '' : ', want ' + c.want + ': ' + c.why))\n}\nconsole.log(passed === cases.length ? '✓ All 4 cases pass: that is the Q-learning update.' : passed + ' of 4 cases pass.')",
              },
            ],
          },
        },
      },
      {
        id: 'GameStudioTask',
        title: 'Train an agent with Q-learning',
        props: {
          task: 'q-agent',
          lesson: 'mg8-001',
          checkpoint: 'cp-mg8-001-4',
        },
      },
    ],
  },

  math: {
    prose: [
      "**Under the hood (optional).** A game seen this way is a Markov decision process: states, actions, rewards, and dynamics $p(s', r \\mid s, a)$, here hidden in the game's code. The Markov property says the next state and reward depend only on the current state and action. Catch's state (offset and row) has it exactly; Breakout's binned state does not, which is why its table is noisy.",
      "The action value of a policy $\\pi$ is $Q^\\pi(s, a) = \\mathbb{E}_\\pi[G_t \\mid S_t = s, A_t = a]$, and $Q^*(s, a) = \\max_\\pi Q^\\pi(s, a)$. Splitting the return as $G_t = R_{t+1} + \\gamma G_{t+1}$ and noting that an optimal policy takes the best action from $S_{t+1}$ on gives the Bellman optimality equation. For Catch it can be solved backwards from the last row, because every game ends after 4 steps; cell 5's qStar does exactly that.",
      "Q-learning replaces the expectation with one sample per step and averages with step size $\\alpha$: a stochastic-approximation method. Watkins and Dayan (1992) proved that the table converges to $Q^*$ with probability 1 when every state–action pair is tried infinitely often and the step sizes satisfy $\\sum_t \\alpha_t = \\infty$, $\\sum_t \\alpha_t^2 < \\infty$. Game Studio and the notebook keep $\\alpha$ fixed, which is common in practice and still converges here because Catch's steps are deterministic (cell 5: within 0.0002 of $Q^*$ after 20000 random episodes).",
      'Choosing the best of several greedy checks is model selection: the checks use games the agent did not train on, and the final score is measured on others again, so the score is not flattered by the choice.',
    ],
    equations: [
      {
        label: 'Return',
        latex: 'G_t = R_{t+1} + \\gamma R_{t+2} + \\gamma^2 R_{t+3} + \\cdots = R_{t+1} + \\gamma G_{t+1}',
      },
      {
        label: 'Bellman optimality',
        latex: "Q^*(s, a) = \\mathbb{E}[R_{t+1} + \\gamma \\max_{a'} Q^*(S_{t+1}, a') \\mid S_t = s, A_t = a]",
      },
      {
        label: 'TD error',
        latex: "\\delta_t = R_{t+1} + \\gamma \\max_{a'} Q(S_{t+1}, a') - Q(S_t, A_t)",
      },
      {
        label: 'Q-learning update',
        latex: 'Q(S_t, A_t) \\leftarrow Q(S_t, A_t) + \\alpha\\,\\delta_t',
      },
      {
        label: 'ε-greedy',
        latex: '\\pi(a \\mid s) = \\begin{cases} 1 - \\varepsilon + \\varepsilon / |\\mathcal{A}| & a = \\arg\\max_{b} Q(s, b) \\\\ \\varepsilon / |\\mathcal{A}| & \\text{otherwise} \\end{cases}',
      },
    ],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      "Formal statement: for a finite MDP with $\\gamma < 1$, the Bellman optimality operator $(TQ)(s, a) = \\mathbb{E}[R + \\gamma \\max_{a'} Q(S', a')]$ is a contraction in the max norm with factor $\\gamma$, so it has exactly one fixed point, $Q^*$. Q-learning is a noisy, one-entry-at-a-time application of $T$.",
      "Invariant: the greedy policy of $Q^*$ is optimal, and any table whose largest entry in each row is in the same place as $Q^*$'s plays just as well. That is why cell 4 catches every ball long before cell 5's numbers agree.",
      'Geometric picture: think of the table as a point in a space of 132 numbers (Catch) or 28 (Breakout). Each update moves one coordinate a step towards a target that itself depends on the others; the contraction pulls the whole point towards $Q^*$.',
      "Where it goes next: when the states are too many for a table (pixels, many readings), a neural network estimates $Q(s, a)$ from the numbers instead (deep Q-networks). The ML Lab's lab 58 covers policy gradients, the other family, which learns the policy directly.",
    ],
    callouts: [],
    visualizations: [],
  },

  examples: [
    {
      id: 'mg8-001-ex1',
      title: 'One update',
      difficulty: 'easy',
      problem: 'Q(s, right) = 0.4. The agent holds right, breaks no brick, and lands in s′ whose row is [1.2, 0.9]. γ = 0.97, α = 0.2. What is the new Q(s, right)?',
      steps: [
        {
          expression: '\\text{target} = 0 + 0.97 \\times 1.2 = 1.164',
          annotation: 'The reward plus the discounted best of the next row.',
          strategyTitle: 'Step 1: The target',
        },
        {
          expression: '\\delta = 1.164 - 0.4 = 0.764',
          annotation: 'How far the estimate is from it.',
          strategyTitle: 'Step 2: The TD error',
        },
        {
          expression: '0.4 + 0.2 \\times 0.764 = 0.5528',
          annotation: 'Move α of the way.',
          strategyTitle: 'Step 3: The update',
        },
      ],
      answer: "0.5528 (the challenge's first case).",
    },
    {
      id: 'mg8-001-ex2',
      title: 'Counting states',
      difficulty: 'medium',
      problem: 'Breakout\'s environment bins "ball minus paddle" with 6 cut points and velocity.y with 1. You add "bins": [0] to velocity.x as well. How many states, and how many numbers in the table?',
      steps: [
        {
          expression: '(6 + 1)(1 + 1)(1 + 1) = 28',
          annotation: 'Each binned reading multiplies the count by its number of bins.',
          strategyTitle: 'Step 1: States',
        },
        {
          expression: '28 \\times 2 = 56',
          annotation: 'One value per state and action.',
          strategyTitle: 'Step 2: Q values',
        },
      ],
      answer: '28 states and 56 Q values; each is visited about half as often as with 14 states.',
    },
    {
      id: 'mg8-001-ex3',
      title: 'Q* by hand',
      difficulty: 'hard',
      problem: 'In Catch the ball is one column right of the paddle, in row 2 (two steps left). With γ = 0.97, what is Q*(s, a) for left, stay and right?',
      steps: [
        {
          expression: 'Q^*(\\text{offset } 0, \\text{row } 3, \\text{stay}) = 1',
          annotation: 'Under the ball at the last step, staying catches it.',
          strategyTitle: 'Step 1: The last row',
        },
        {
          expression: 'Q^*(s, \\text{right}) = 0 + 0.97 \\times 1 = 0.97',
          annotation: 'Moving right reaches offset 0 at row 3; then stay. Staying also works (move right next step).',
          strategyTitle: 'Step 2: Right and stay',
        },
        {
          expression: 'Q^*(s, \\text{left}) = 0.97 \\times (-1) = -0.97',
          annotation: 'Offset 2 at row 3 cannot be caught.',
          strategyTitle: 'Step 3: Left',
        },
      ],
      answer: 'Left −0.97, stay 0.97, right 0.97, as cell 5 prints for (1, 2).',
    },
  ],

  challenges: [
    {
      id: 'mg8-001-ch1',
      title: 'The discount',
      difficulty: 'easy',
      problem: 'With γ = 0, what does a Breakout agent care about?',
      hint: 'Only R_{t+1} is left in the return.',
      answer: "Only the next step's reward. Catching the ball earns nothing at once, so with γ = 0 it cannot learn to catch; only avoiding the −3 at the very last moment counts.",
      walkthrough: [
        {
          expression: 'G_t = R_{t+1}',
          annotation: 'Every later term has a factor of 0.',
        },
      ],
    },
    {
      id: 'mg8-001-ch2',
      title: 'Why not learn only from greedy play?',
      difficulty: 'medium',
      problem: 'Explain why cell 4 at 0 episodes catches nothing, and why exploration fixes it.',
      hint: 'What does an all-zero row choose?',
      answer: 'With every Q equal, the first action (left) wins every row, so the paddle always goes left and only catches a ball that happens to be there. Random actions (ε, and random tie-breaking) visit other states and actions, whose rewards then show up in the table.',
      walkthrough: [],
    },
    {
      id: 'mg8-001-ch3',
      title: 'Design states for another game',
      difficulty: 'hard',
      problem: 'For a platformer where the player must jump over a rolling barrel, which readings would you bin, and where would you put the cut points?',
      hint: 'Bin the numbers that decide when to jump.',
      answer: "The barrel's x minus the player's x, cut where a jump must start (say at the distance the barrel covers during a jump, and a little either side), and whether the player is on the ground (one cut). Leave out what does not change the right action, such as the score.",
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      {
        symbol: 'S_t, A_t, R_{t+1}',
        meaning: 'The state seen, the action taken, the reward that follows.',
      },
      {
        symbol: 'G_t',
        meaning: 'The return: all later rewards, each discounted by γ per step.',
      },
      {
        symbol: 'Q(s, a)',
        meaning: 'The return expected from taking a in s and acting well after.',
      },
      {
        symbol: 'Q*',
        meaning: 'The best possible action values; greedy on Q* is optimal.',
      },
      {
        symbol: 'δ',
        meaning: 'The TD error: target minus the current estimate.',
      },
      {
        symbol: 'α, γ, ε',
        meaning: 'Step size, discount, exploration.',
      },
      {
        symbol: 'bins',
        meaning: 'Cut points that turn a number into one of a few states.',
      },
    ],
    rulesOfThumb: [
      'Bin the numbers that decide the action, and cut where the right action changes.',
      'Make losing costly in the reward, and check random play scores badly.',
      'Explore early, exploit late.',
      'Judge the agent by greedy play on games it did not train on.',
      'Read the table where it was visited often.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'The agent learns rules like "move towards the ball".',
      whyStudentsThinkIt: 'That is how a person describes good play.',
      correctionExample: "It learns a number for each state and action; cell 7's arrows are only where the biggest is.",
      contrastCase: 'A hand-written policy is a rule; a Q table only becomes one when you take its argmax.',
    },
    {
      falseBelief: 'When the agent plays well, its table equals Q*.',
      whyStudentsThinkIt: 'The values should be right if the play is right.',
      correctionExample: 'Cell 5 at 300 episodes catches every ball with many entries far from Q*.',
      contrastCase: 'With exploration that never stops, the table does converge (cell 5, ε = 1).',
    },
    {
      falseBelief: 'Training should only take the actions it thinks best.',
      whyStudentsThinkIt: 'Why waste moves?',
      correctionExample: 'Cell 4 at 0 episodes always goes left and catches nothing.',
      contrastCase: 'After training, the greedy policy is what plays.',
    },
  ],

  transferPrompts: [
    {
      situation: "You want an enemy that learns when to dodge the player's shots.",
      competingTechniques: [
        "Q-learning, with the nearest shot's distance and direction binned as the state, and survival rewarded",
        'Hand-written dodging rules',
      ],
      whyThisTechniqueWins: 'Training can find dodges you did not think of, provided the state shows the shot and the reward makes surviving pay.',
    },
    {
      situation: 'Training stalls near random play.',
      competingTechniques: [
        'Check the bins (does the state show what decides the action?) and the reward (does random play already score well?)',
        'Train for much longer',
      ],
      whyThisTechniqueWins: 'If the state hides what matters or the reward does not reward it, more episodes cannot help.',
    },
  ],

  debugging: [
    {
      commonError: 'No bins on any reading.',
      symptom: 'Train an agent says Q-learning needs bins.',
      whyItHappened: 'Without bins there are no states for the table.',
      repairStrategy: 'Add "bins" to the reading that decides the action.',
    },
    {
      commonError: 'Cut points that do not go up.',
      symptom: 'Values land in the wrong bins; some bins never used.',
      whyItHappened: "A value's bin is the count of cuts below it.",
      repairStrategy: "List each reading's cuts in increasing order.",
    },
    {
      commonError: 'Too many bins on too many readings.',
      symptom: 'The learning curve barely rises; many grey rows.',
      whyItHappened: 'Each state is visited too rarely to learn.',
      repairStrategy: 'Bin fewer readings, or train for more episodes.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Write the Q-learning update, and train a Q-learning agent on a Game Studio game.',
    explainVerbally: 'Explain states from bins, the return, Q and Q*, the TD error, and ε-greedy exploration.',
    detectIncorrectApplication: 'Spot states that hide what decides the action, and rewards random play already earns.',
    transferToUnfamiliar: 'Design states, actions and rewards for another game.',
  },

  assessment: {
    questions: [
      {
        id: 'mg8-001-assess-1',
        type: 'choice',
        text: 'Q(s, a) = 0, r = 1, the step ended the episode, α = 0.5. The new Q(s, a) is:',
        options: ['0.5', '1', '0', '1.5'],
        answer: '0.5',
        hint: 'No future term; move halfway to 1.',
      },
    ],
  },

  quiz: [
    {
      id: 'mg8-001-quiz-1',
      type: 'choice',
      text: 'What does Q(s, a) estimate?',
      options: [
        'The return from taking a in s and acting well afterwards',
        'The reward of the next step only',
        'How often a was taken in s',
        'The probability of winning',
      ],
      answer: 'The return from taking a in s and acting well afterwards',
      hints: ['It counts later rewards too.'],
      reviewSection: 'Intuition — what an action is worth',
    },
    {
      id: 'mg8-001-quiz-2',
      type: 'choice',
      text: 'The TD target for a step that does not end the episode is',
      options: ['r + γ max Q(s′, ·)', 'r', 'max Q(s′, ·)', 'Q(s, a) + r'],
      answer: 'r + γ max Q(s′, ·)',
      hints: ['The reward, then the discounted best of the next state.'],
      reviewSection: 'Intuition — the update',
    },
    {
      id: 'mg8-001-quiz-3',
      type: 'choice',
      text: "How many states do Breakout's bins make (7 bins across, 2 for velocity.y)?",
      options: ['14', '9', '28', '4'],
      answer: '14',
      hints: ['Multiply the bin counts.'],
      reviewSection: 'Cell 6',
    },
    {
      id: 'mg8-001-quiz-4',
      type: 'choice',
      text: 'Why does an untrained greedy agent catch nothing in Catch?',
      options: [
        'Every row is all zeros, so it always picks the first action',
        'γ is too small',
        'α is too big',
        'The ball is too fast',
      ],
      answer: 'Every row is all zeros, so it always picks the first action',
      hints: ['Cell 4 at 0 episodes.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'mg8-001-quiz-5',
      type: 'choice',
      text: 'Q-learning is off-policy because',
      options: [
        'Its target uses the best next action, not the one it will take',
        'It never explores',
        'It ignores rewards',
        'It uses a neural network',
      ],
      answer: 'Its target uses the best next action, not the one it will take',
      hints: ['Cell 5 learns Q* while acting at random.'],
      reviewSection: 'Intuition — what the table holds',
    },
    {
      id: 'mg8-001-quiz-6',
      type: 'choice',
      text: 'With 3 bins across instead of 7, the Breakout agent scored',
      options: [
        'Worse (34 instead of 48)',
        'Better',
        'The same',
        'Nothing: it cannot train',
      ],
      answer: 'Worse (34 instead of 48)',
      hints: ['The table cannot tell "just off the edge" from "far away".'],
      reviewSection: 'Warning — a table only knows the states you give it',
    },
  ],

  checkpoints: [
    {
      id: 'cp-mg8-001-1',
      label: 'Read the loop, states and the return',
      type: 'read',
    },
    {
      id: 'cp-mg8-001-2',
      label: 'Read the Bellman equation and the Q-learning update',
      type: 'read',
    },
    {
      id: 'cp-mg8-001-3',
      label: 'Run the notebook: train Catch and compare with Q*',
      type: 'read',
    },
    {
      id: 'cp-mg8-001-4',
      label: 'Complete "Train an agent with Q-learning" in Game Studio',
      type: 'lab',
    },
    {
      id: 'cp-mg8-001-5',
      label: 'Watch your trained agent play Breakout',
      type: 'lab',
    },
    {
      id: 'cp-mg8-001-6',
      label: 'Work through the one-update example',
      type: 'example',
    },
    {
      id: 'cp-mg8-001-7',
      label: 'Work through the Q* by hand example',
      type: 'example',
    },
    {
      id: 'cp-mg8-001-8',
      label: 'Pass the write-the-update challenge',
      type: 'challenge',
    },
  ],

  chapter: 'making-games-8',
}
