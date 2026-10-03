// What a learner does at each step of "Reinforcement Learning in pygame", for the walkthrough
// test (rlPygame.desktop.test.js). Keyed "<lesson file name>#<step title>".
//
// By default a step's file (its ```lang file=... block) is typed in for you. An entry adds:
//   run:   commands the lesson tells the learner to type in the terminal (PowerShell)
//   wrong: wrong answers, tried on a copy of the project before the step; each lists the
//          indexes of the step's checks that must fail ("fails").
//   edit:  [[from, to], ...] applied to the step's own target, written to the step's file
//          (how a wrong answer is usually made: the right file with one mistake in it).
// A wrong answer's copy of the project shares the real .venv (a directory junction), so a wrong
// answer that changes installed packages sets copyVenv: true to get a copy of its own.

export const WALKTHROUGH = {
  // ── 0.1 ──────────────────────────────────────────────────────────────────
  '00-01-project-and-venv#Make a virtual environment': {
    run: ['python -m venv .venv'],
    wrong: [{ name: 'did nothing', fails: [0, 1] }],
  },
  '00-01-project-and-venv#Pin the packages': {
    wrong: [
      { name: 'asked for the toy-text extra', edit: [['gymnasium==1.3.0', 'gymnasium[toy-text]==1.3.0']], fails: [2, 4] },
      { name: 'did not pin pygame-ce', edit: [['pygame-ce==2.5.8', 'pygame-ce']], fails: [1] },
    ],
  },
  '00-01-project-and-venv#Install them': {
    run: ['.venv\\Scripts\\python -m pip install -q -r requirements.txt'],
    wrong: [
      { name: 'did nothing', fails: [0, 1] },
      {
        name: 'installed the original pygame instead of pygame-ce',
        copyVenv: true,
        run: ['.venv\\Scripts\\python -m pip install -q numpy==2.5.3 pygame==2.6.1 gymnasium==1.3.0 pytest==9.1.1'],
        fails: [1],
      },
    ],
  },

  // ── 0.2 ──────────────────────────────────────────────────────────────────
  '00-02-know-your-machine#Which Python ran this?': {
    wrong: [{ name: 'tested the environment the wrong way round', edit: [['sys.prefix != sys.base_prefix', 'sys.prefix == sys.base_prefix']], fails: [0] }],
  },
  '00-02-know-your-machine#Read the tests first': {
    wrong: [{ name: 'did not create the tests', fails: [0] }],
  },
  '00-02-know-your-machine#Which packages?': {
    wrong: [
      { name: 'reads comment lines as packages', edit: [['        if not line or line.startswith("#"):', '        if not line:']], fails: [0] },
      { name: 'says ok without comparing versions', edit: [['        if have == wanted:', '        if True:']], fails: [0] },
    ],
  },
  '00-02-know-your-machine#Which GPU?': {
    wrong: [{ name: 'kept the spaces around each field', edit: [['[part.strip() for part in row.split(",")]', 'row.split(",")']], fails: [0] }],
  },

  // ── 0.3 ──────────────────────────────────────────────────────────────────
  '00-03-a-window-and-a-loop#Read the tests first': {
    wrong: [{ name: 'did not create the tests', fails: [0, 1] }],
  },
  '00-03-a-window-and-a-loop#A window that stays open': {
    wrong: [{ name: 'does not return the frame count', edit: [['    pygame.quit()\n    return frames\n', '    pygame.quit()\n']], fails: [0] }],
  },
  '00-03-a-window-and-a-loop#Sixty frames a second': {
    wrong: [{ name: 'never ticks the clock', edit: [['        clock.tick(60)\n', '']], fails: [0] }],
  },
  '00-03-a-window-and-a-loop#Draw a grid': {
    wrong: [{ name: 'swapped rows and columns', edit: [['(col * CELL + 8, row * CELL + 8,', '(row * CELL + 8, col * CELL + 8,']], fails: [0] }],
  },
  '00-03-a-window-and-a-loop#Arrow keys move the player': {
    wrong: [{ name: 'walks through walls', edit: [['row = min(max(cell[0] + delta[0], 0), size - 1)', 'row = cell[0] + delta[0]']], fails: [0] }],
  },

  // ── 1.1 ──────────────────────────────────────────────────────────────────
  '01-01-the-shape-of-a-q-table#Read the tests first': {
    wrong: [{ name: 'did not create the tests', fails: [0] }],
  },
  '01-01-the-shape-of-a-q-table#A table of zeros': {
    wrong: [{ name: 'made a grid-shaped table', edit: [['np.zeros((rows * cols, len(ACTIONS)))', 'np.zeros((rows, cols))']], fails: [0] }],
  },
  '01-01-the-shape-of-a-q-table#Number the cells': {
    wrong: [{ name: 'numbered down the columns', edit: [['return row * cols + col', 'return col * cols + row']], fails: [0] }],
  },
  '01-01-the-shape-of-a-q-table#Ask the table two questions': {
    wrong: [{ name: 'collapsed the wrong axis', edit: [['Q.max(axis=1)', 'Q.max(axis=0)']], fails: [0] }],
  },
  '01-01-the-shape-of-a-q-table#Back to a grid, and onto a colour scale': {
    wrong: [{ name: 'divides by zero when all values are equal', edit: [['    if high == low:\n        return np.zeros(values.shape)\n', '']], fails: [0] }],
  },
  '01-01-the-shape-of-a-q-table#See the table': {
    wrong: [{ name: 'shades with raw values', edit: [['shade = normalise(state_values(Q))', 'shade = state_values(Q)']], fails: [0] }],
  },

  // ── 1.2 ──────────────────────────────────────────────────────────────────
  '01-02-indexing-and-broadcasting#Read the tests first': {
    wrong: [{ name: 'did not create the tests', fails: [0] }],
  },
  '01-02-indexing-and-broadcasting#A row is a window into the table': {
    wrong: [{ name: 'only counts rises', edit: [['np.abs(new - old).max()', '(new - old).max()']], fails: [0] }],
  },
  '01-02-indexing-and-broadcasting#Break ties at random': {
    wrong: [
      { name: 'still takes the first best', edit: [['    best = np.flatnonzero(row == row.max())\n    return int(rng.choice(best))', '    return int(row.argmax())']], fails: [0] },
      { name: 'returns a NumPy integer', edit: [['return int(rng.choice(best))', 'return rng.choice(best)']], fails: [0] },
    ],
  },
  '01-02-indexing-and-broadcasting#Pick one value from every row': {
    wrong: [{ name: 'took whole columns instead of one value per row', edit: [['return Q[np.arange(len(Q)), actions]', 'return Q[:, actions]']], fails: [0] }],
  },
  '01-02-indexing-and-broadcasting#Broadcasting: combining different shapes': {
    wrong: [
      { name: 'forgot keepdims', edit: [['Q.max(axis=1, keepdims=True)', 'Q.max(axis=1)']], fails: [0] },
      { name: 'walks through walls', edit: [['np.clip(row[:, None] + deltas[:, 0], 0, rows - 1)', 'row[:, None] + deltas[:, 0]']], fails: [0] },
    ],
  },
  '01-02-indexing-and-broadcasting#See every best move': {
    wrong: [{ name: 'still draws only the first best move', edit: [['np.flatnonzero(best[state]):', 'np.flatnonzero(best[state])[:1]:']], fails: [0] }],
  },

  // ── 2.1 ──────────────────────────────────────────────────────────────────
  '02-01-probability-by-simulation#Read the tests first': {
    wrong: [{ name: 'did not create the tests', fails: [0] }],
  },
  '02-01-probability-by-simulation#A yes-or-no event': {
    wrong: [
      { name: 'counts exactly p as true', edit: [['rng.random() < p', 'rng.random() <= p']], fails: [0] },
      { name: 'compared the wrong way round', edit: [['rng.random() < p', 'rng.random() > p']], fails: [0] },
    ],
  },
  '02-01-probability-by-simulation#Choosing among several outcomes': {
    wrong: [
      { name: 'searched from the left', edit: [['side="right"', 'side="left"']], fails: [0] },
      { name: 'can run off the end', edit: [['    return min(index, len(probs) - 1)', '    return index']], fails: [0] },
    ],
  },
  '02-01-probability-by-simulation#A slippery floor': {
    wrong: [{ name: 'gave each side the whole slip', edit: [['probs[side] += slip / 2', 'probs[side] += slip']], fails: [0] }],
  },
  '02-01-probability-by-simulation#Walk on the ice': {
    wrong: [{ name: 'drew the bars hanging below the floor', edit: [['(x, FLOOR - height, 60, height)', '(x, FLOOR, 60, height)']], fails: [0] }],
  },

  // ── 2.2 ──────────────────────────────────────────────────────────────────
  '02-02-expectation-and-uncertainty#Read the tests first': {
    wrong: [{ name: 'did not create the tests', fails: [0] }],
  },
  '02-02-expectation-and-uncertainty#The expected value': {
    wrong: [{ name: 'averaged the values, ignoring their probabilities', edit: [['np.sum(np.asarray(values) * np.asarray(probs))', 'np.mean(values)']], fails: [0] }],
  },
  '02-02-expectation-and-uncertainty#The variance: how far single results scatter': {
    // For the ±1 ice the mean absolute distance is also 0.64; the die case in the test catches it.
    wrong: [{ name: 'used absolute distances instead of squared', edit: [['(np.asarray(values) - mean) ** 2', 'np.abs(np.asarray(values) - mean)']], fails: [0] }],
  },
  '02-02-expectation-and-uncertainty#From probabilities to data': {
    wrong: [{ name: 'divided by n', edit: [['np.std(xs, ddof=1)', 'np.std(xs)']], fails: [0] }],
  },
  '02-02-expectation-and-uncertainty#How far off is an average?': {
    wrong: [{ name: 'divided by n instead of its square root', edit: [['sample_std(xs) / np.sqrt(len(xs))', 'sample_std(xs) / len(xs)']], fails: [0] }],
  },
  '02-02-expectation-and-uncertainty#Watch the averages narrow': {
    wrong: [{ name: 'scored the slides as wins', edit: [['np.where(rng.random(n) < SLIP, -1.0, 1.0)', 'np.where(rng.random(n) > SLIP, -1.0, 1.0)']], fails: [0] }],
  },

  // ── 2.3 ──────────────────────────────────────────────────────────────────
  '02-03-the-running-average#Read the tests first': {
    wrong: [{ name: 'did not create the tests', fails: [0] }],
  },
  '02-03-the-running-average#One update rule': {
    wrong: [{ name: 'moved by the target instead of the error', edit: [['estimate + step * (target - estimate)', 'estimate + step * target']], fails: [0] }],
  },
  '02-03-the-running-average#The exact mean, one result at a time': {
    wrong: [{ name: 'counted from 0', edit: [['enumerate(xs, start=1)', 'enumerate(xs)']], fails: [0] }],
  },
  '02-03-the-running-average#A constant step': {
    wrong: [
      { name: 'left the step out of the weights', edit: [['return step * (1 - step) ** np.arange(n)', 'return (1 - step) ** np.arange(n)']], fails: [0] },
      { name: 'ignored the starting estimate', edit: [['    estimate = start\n', '    estimate = 0.0\n']], fails: [0] },
    ],
  },
  '02-03-the-running-average#Watch them follow a change': {
    wrong: [{ name: 'drew high values at the bottom', edit: [['round(BOTTOM - (value - LOW) / (HIGH - LOW) * (BOTTOM - TOP))', 'round(TOP + (value - LOW) / (HIGH - LOW) * (BOTTOM - TOP))']], fails: [0] }],
  },

  // ── 3.1 ──────────────────────────────────────────────────────────────────
  '03-01-a-room-of-slot-machines#Read the tests first': {
    wrong: [{ name: 'did not create the tests', fails: [0] }],
  },
  '03-01-a-room-of-slot-machines#A machine with a hidden average': {
    wrong: [{ name: 'draws a new mean on every pull', edit: [['return float(self.rng.normal(self.means[arm], 1.0))', 'return float(self.rng.normal(0.0, 1.0))']], fails: [0] }],
  },
  '03-01-a-room-of-slot-machines#A learner that keeps averages': {
    wrong: [{ name: 'updates before counting the pull', edit: [['        self.N[arm] += 1\n        self.Q[arm] = update(self.Q[arm], reward, 1 / self.N[arm])', '        self.Q[arm] = update(self.Q[arm], reward, 1 / (self.N[arm] + 2))\n        self.N[arm] += 1']], fails: [0] }],
  },
  '03-01-a-room-of-slot-machines#The room': {
    wrong: [{ name: 'timer forgets the leftover time', edit: [['        self.waited -= fired * self.interval\n', '        self.waited = 0\n']], fails: [0] }],
  },

  // ── 3.2 ──────────────────────────────────────────────────────────────────
  '03-02-explore-or-exploit#Read the tests first': {
    wrong: [{ name: 'did not create the tests', fails: [0] }],
  },
  '03-02-explore-or-exploit#Explore on purpose: ε-greedy': {
    wrong: [{ name: 'random pulls never reach the last machine', edit: [['rng.integers(len(self.Q))', 'rng.integers(len(self.Q) - 1)']], fails: [0] }],
  },
  '03-02-explore-or-exploit#Optimism as exploration': {
    wrong: [{ name: 'ignored the starting value', edit: [['self.Q = np.full(k, float(initial))', 'self.Q = np.zeros(k)']], fails: [0] }],
  },
  '03-02-explore-or-exploit#A fair experiment': {
    wrong: [{ name: 'room and learner share one generator', edit: [['agent_rng = np.random.default_rng([seed, 1])', 'agent_rng = world_rng']], fails: [0] }],
  },
  '03-02-explore-or-exploit#A chart you can reuse': {
    wrong: [{ name: 'traced both band edges left to right', edit: [['upper + lower[::-1]', 'upper + lower']], fails: [0] }],
  },
};
