---
title: 1.2 — Indexing and Broadcasting: Reading and Writing Q[s, a]
track: Reinforcement Learning in pygame
runtime: python
run: qtable_view.py
---

Lesson 1.1 built the Q-table and asked it two questions. This lesson is about the ways an agent reads and writes the table, and about one flaw from last time: an agent that knows nothing always walks up, because `argmax` picks the first of tied values. By the end you'll have:

- a safe way to measure how much the table changed, which every learning method uses to decide when to stop;
- a greedy choice that breaks ties at random;
- a way to read one value from every row at once;
- **broadcasting**, NumPy's rule for combining arrays of different shapes. You'll use it to build the grid world's complete "where does each move lead?" table, with no loops.

## Read the tests first

**This step: create the supplied test file and read it. No code yet.**

Click **Create provided tests/test_indexing.py** above.

```python file=tests/test_indexing.py provided
# Tests for lesson 1.2's additions to qtable.py and qtable_view.py. Run them with:
#   .venv\Scripts\python -m pytest -q tests/test_indexing.py
import numpy as np
import pygame

import qtable
from window import move


def test_change_is_the_largest_difference_either_way():
    old = np.zeros((3, 4))
    new = old.copy()
    new[1, 2] = 0.5
    new[2, 0] = -3.0
    assert qtable.biggest_change(old, new) == 3.0, "a value that went down by 3 is a change of 3"


def test_change_of_identical_tables_is_zero():
    Q = np.arange(12.0).reshape(3, 4)
    assert qtable.biggest_change(Q, Q.copy()) == 0.0


def test_greedy_action_picks_a_clear_best():
    rng = np.random.default_rng(0)
    row = np.array([0.0, 2.0, 1.0, -1.0])
    assert {qtable.greedy_action(row, rng) for _ in range(100)} == {1}


def test_greedy_action_chooses_only_among_tied_bests():
    rng = np.random.default_rng(0)
    row = np.array([0.0, 2.0, 1.0, 2.0])
    assert {qtable.greedy_action(row, rng) for _ in range(200)} == {1, 3}


def test_greedy_action_breaks_ties_evenly():
    rng = np.random.default_rng(0)
    counts = np.bincount([qtable.greedy_action(np.zeros(4), rng) for _ in range(4000)], minlength=4)
    assert counts.min() > 850 and counts.max() < 1150, f"4000 choices among 4 tied actions came out as {counts.tolist()}"


def test_greedy_action_same_seed_same_choices():
    a, b = np.random.default_rng(7), np.random.default_rng(7)
    first = [qtable.greedy_action(np.zeros(4), a) for _ in range(50)]
    second = [qtable.greedy_action(np.zeros(4), b) for _ in range(50)]
    assert first == second, "two generators made with the same seed must make the same choices"


def test_greedy_action_returns_a_plain_int():
    action = qtable.greedy_action(np.zeros(4), np.random.default_rng(0))
    assert type(action) is int, f"got {type(action).__name__}; wrap the choice in int(...)"


def test_values_of_picks_one_value_per_row():
    Q = np.array([[1.0, 5.0, 2.0, 0.0],
                  [-3.0, -1.0, -2.0, -4.0]])
    assert qtable.values_of(Q, np.array([2, 0])).tolist() == [2.0, -3.0]


def test_values_of_the_best_actions_are_the_state_values():
    Q = np.random.default_rng(3).normal(size=(25, 4))
    assert np.array_equal(qtable.values_of(Q, qtable.greedy_actions(Q)), qtable.state_values(Q))


def test_advantages_measure_distance_below_the_best():
    Q = np.array([[1.0, 5.0, 2.0, 0.0],
                  [-3.0, -1.0, -2.0, -4.0]])
    assert qtable.advantages(Q).tolist() == [[-4.0, 0.0, -3.0, -5.0],
                                             [-2.0, 0.0, -1.0, -3.0]]


def test_next_states_has_one_entry_per_state_and_action():
    table = qtable.next_states(5, 5)
    assert table.shape == (25, 4)
    assert np.issubdtype(table.dtype, np.integer), "state numbers are whole numbers"


def test_next_states_agrees_with_move_everywhere():
    table = qtable.next_states(5, 5)
    for state in range(25):
        for action, delta in enumerate(qtable.ACTIONS):
            expected = qtable.state_of(move(qtable.cell_of(state, 5), delta), 5)
            assert table[state, action] == expected, f"state {state}, action {action}"


def test_next_states_on_a_grid_that_is_not_square():
    table = qtable.next_states(3, 4)
    assert table[3].tolist() == [3, 7, 2, 3], "state 3 is the top-right cell of a 3 x 4 grid"
    assert table[11].tolist() == [7, 11, 10, 11], "state 11 is the bottom-right cell"


def test_view_draws_an_arrow_for_every_tied_best_action():
    import qtable_view
    screen = pygame.Surface((qtable_view.WIDTH, qtable_view.HEIGHT))
    qtable_view.draw(screen, qtable_view.example_qtable())
    third = qtable_view.CELL // 3
    centre = qtable_view.CELL // 2
    assert screen.get_at((centre + third, centre))[:3] == qtable_view.ARROW, "right is one of the best moves from (0, 0)"
    assert screen.get_at((centre, centre + third))[:3] == qtable_view.ARROW, "down is one of the best moves from (0, 0)"
    assert screen.get_at((centre, centre - third))[:3] != qtable_view.ARROW, "up is not a best move from (0, 0)"
```

Two tests are worth reading closely before you start:

- `test_greedy_action_breaks_ties_evenly` makes 4000 random choices among 4 tied actions and expects each to come up between 850 and 1150 times. Not exactly 1000: random choices are uneven, and lesson 2.2 shows how to work out how uneven they're allowed to be. A test of something random must allow for that, or it will fail now and then for no reason.
- `test_next_states_agrees_with_move_everywhere` checks the fast, loop-free version you'll write against your plain `move` from lesson 0.3, in all 100 cases. Writing a slow, obviously correct version first and testing the fast one against it is a standard way to check clever code.

```check
file tests/test_indexing.py -- Click "Create provided tests/test_indexing.py" above.
```

## A row is a window into the table

Start at the prompt (`.venv\Scripts\python`), and predict each answer first:

```text
>>> import numpy as np
>>> from qtable import new_qtable
>>> Q = new_qtable(5, 5)
>>> row = Q[0]
>>> row[3] = 5.0
>>> Q[0]
array([0., 0., 0., 5.])
```

Changing `row` changed `Q`. In lesson 1.1 you saw that an array is a block of memory plus a description of how to read it (a start position, a shape, strides). `Q[0]` doesn't copy anything. It makes a new description, "start at byte 0, 4 numbers, 8 bytes apart", of the **same memory**. That's called a **view**. NumPy confirms it:

```text
>>> np.shares_memory(row, Q)
True
```

Plain assignment copies even less. `old = Q` doesn't make an array at all: it gives the existing array a second name. To keep the values as they are now, you need `.copy()`, which reserves new memory and copies every number into it:

```text
>>> old = Q
>>> snapshot = Q.copy()
>>> Q[0, 0] = 1.0
>>> old[0, 0], snapshot[0, 0]
(np.float64(1.0), np.float64(0.0))
```

Why this matters for learning: a learning method changes the table over and over, and stops when the changes become tiny. To measure a change, you must keep the "before" table, and that has to be a copy. With `old = Q`, old and new are the same memory, the change is always 0, and the method stops after the first round thinking it has finished. Add a function that measures the change:

```python file=qtable.py
import numpy as np

# Action 0 is up, 1 down, 2 left, 3 right: (row change, column change).
ACTIONS = [(-1, 0), (1, 0), (0, -1), (0, 1)]


def new_qtable(rows, cols):
    return np.zeros((rows * cols, len(ACTIONS)))


def state_of(cell, cols):
    row, col = cell
    return row * cols + col


def cell_of(state, cols):
    return divmod(state, cols)


def state_values(Q):
    return Q.max(axis=1)


def greedy_actions(Q):
    return Q.argmax(axis=1)


def as_grid(values, rows, cols):
    return values.reshape(rows, cols)


def normalise(values):
    low, high = values.min(), values.max()
    if high == low:
        return np.zeros(values.shape)
    return (values - low) / (high - low)


def biggest_change(old, new):
    return np.abs(new - old).max()
```

How `biggest_change` works:

1. `new - old` subtracts the two tables element by element, giving a table of differences of the same shape.
2. `np.abs` makes every difference positive, so a value that **fell** by 3 counts as a change of 3, just like one that rose by 3. Without it, `.max()` would only see the biggest rise.
3. `.max()` with no `axis` looks at every element and returns the single largest.

```check
run ".venv/Scripts/python -m pytest -q tests/test_indexing.py -k change" label="biggest_change measures the largest change, up or down" -- A value that fell by 3 has changed by 3: take the absolute value before the maximum.
```

## Break ties at random

`argmax` returns the first of several equal values. To choose among **all** the best ones, you first need to know which they are. Comparing an array with a number compares every element and gives an array of `True`/`False` answers, called a **boolean mask**:

```text
>>> row = np.array([0.0, 2.0, 1.0, 2.0])
>>> row == row.max()
array([False,  True, False,  True])
>>> np.flatnonzero(row == row.max())
array([1, 3])
```

`np.flatnonzero` returns the positions where the mask is `True` (it counts `True` as 1 and `False` as 0, so "non-zero" means "true"). Those positions are the tied best actions. Then pick one of them at random:

```python file=qtable.py
import numpy as np

# Action 0 is up, 1 down, 2 left, 3 right: (row change, column change).
ACTIONS = [(-1, 0), (1, 0), (0, -1), (0, 1)]


def new_qtable(rows, cols):
    return np.zeros((rows * cols, len(ACTIONS)))


def state_of(cell, cols):
    row, col = cell
    return row * cols + col


def cell_of(state, cols):
    return divmod(state, cols)


def state_values(Q):
    return Q.max(axis=1)


def greedy_actions(Q):
    return Q.argmax(axis=1)


def as_grid(values, rows, cols):
    return values.reshape(rows, cols)


def normalise(values):
    low, high = values.min(), values.max()
    if high == low:
        return np.zeros(values.shape)
    return (values - low) / (high - low)


def biggest_change(old, new):
    return np.abs(new - old).max()


def greedy_action(row, rng):
    best = np.flatnonzero(row == row.max())
    return int(rng.choice(best))
```

**How `rng` makes random choices.** `np.random.default_rng(seed)` makes a **random number generator**. It isn't truly random. Inside, it holds a large number, its **state**, set from the seed. Every time you ask for a random number, it scrambles the state into a new one with a fixed formula, and derives the number you asked for from it. The formula is designed so the output looks random and passes statistical tests for randomness, but the same seed always gives the same sequence:

```text
>>> rng = np.random.default_rng(42)
>>> [int(rng.choice(np.array([1, 3]))) for _ in range(10)]
[1, 3, 3, 1, 1, 3, 1, 3, 1, 1]
```

Run those two lines twice and you get the same ten choices both times. That's the point: a learning run you can repeat exactly is one you can debug. Lesson 2.1 looks closer at seeds and what they do and don't guarantee.

`rng.choice(best)` picks one element of `best`, each equally likely. It returns a NumPy integer, `np.int64(3)`, and `int(…)` turns it into a plain Python `int`. Inside arithmetic the two behave the same, but they print differently, and Gymnasium's environments in Chapter 8 expect a plain `int` for an action.

The agent is passed `rng` rather than making its own. That way one seed, set in one place, controls every random choice in a run.

```check
run ".venv/Scripts/python -m pytest -q tests/test_indexing.py -k greedy_action" label="greedy_action picks a best action, breaking ties at random" -- Find every position equal to the maximum (a boolean mask and np.flatnonzero), pick one with rng.choice, and return int(...).
```

## Pick one value from every row

Sometimes you need a different column from each row: for each state, the value of the action the agent actually took there. NumPy does this when you index with two lists of positions:

```text
>>> Q = np.array([[1.0, 5.0, 2.0, 0.0], [-3.0, -1.0, -2.0, -4.0]])
>>> Q[[0, 1], [2, 0]]
array([ 2., -3.])
```

**How pairing works:** NumPy walks the two lists together, element by element, and treats each pair as one `[row, column]`: first `Q[0, 2]` (which is 2), then `Q[1, 0]` (which is -3). It returns one value per pair. This is called **fancy indexing**. Unlike slicing, it always copies, because the values it picks needn't be evenly spaced in memory, so no single stride could describe them.

```python file=qtable.py
import numpy as np

# Action 0 is up, 1 down, 2 left, 3 right: (row change, column change).
ACTIONS = [(-1, 0), (1, 0), (0, -1), (0, 1)]


def new_qtable(rows, cols):
    return np.zeros((rows * cols, len(ACTIONS)))


def state_of(cell, cols):
    row, col = cell
    return row * cols + col


def cell_of(state, cols):
    return divmod(state, cols)


def state_values(Q):
    return Q.max(axis=1)


def greedy_actions(Q):
    return Q.argmax(axis=1)


def as_grid(values, rows, cols):
    return values.reshape(rows, cols)


def normalise(values):
    low, high = values.min(), values.max()
    if high == low:
        return np.zeros(values.shape)
    return (values - low) / (high - low)


def biggest_change(old, new):
    return np.abs(new - old).max()


def greedy_action(row, rng):
    best = np.flatnonzero(row == row.max())
    return int(rng.choice(best))


def values_of(Q, actions):
    return Q[np.arange(len(Q)), actions]
```

`np.arange(len(Q))` is `[0, 1, …, 24]`, one row number per state, and `actions` gives one column per state. The test checks one fact you can predict: taking every state's greedy action gives each state's value, so `values_of(Q, greedy_actions(Q))` equals `state_values(Q)`.

```check
run ".venv/Scripts/python -m pytest -q tests/test_indexing.py -k values_of" label="values_of picks one value from each row" -- Index with two arrays at once: Q[row_numbers, actions], where row_numbers is 0, 1, 2, ... one per row.
```

## Broadcasting: combining different shapes

Here's a question for every state at once: how much worse is each action than that state's best? That's each row minus its own maximum. `Q.max(axis=1)` has shape `(2,)`, and `Q` has shape `(2, 4)`. Try subtracting them directly. The error's last line says:

```text
>>> Q - Q.max(axis=1)
…
ValueError: operands could not be broadcast together with shapes (2,4) (2,)
```

**How NumPy combines arrays of different shapes**, the **broadcasting** rule:

1. Line the two shapes up from the **right**: `(2, 4)` against `(2,)` lines up 4 with 2.
2. In each position, the sizes must be equal, or one of them must be 1. (A missing position counts as 1.)
3. A size of 1 is **stretched** to match the other: NumPy reuses that one value along the whole dimension, without copying it.

`4` against `2` is neither equal nor 1, hence the error. `keepdims=True` keeps the collapsed axis as size 1 instead of removing it:

```text
>>> Q.max(axis=1, keepdims=True)
array([[ 5.],
       [-1.]])
```

Its shape is `(2, 1)`, a column. Now `(2, 4)` against `(2, 1)`: 4 against 1 stretches, and 2 against 2 is equal. So each row's maximum is reused across all four columns of that row:

```text
Q                    max, stretched          Q - max
[ 1   5   2   0]  -  [ 5   5   5   5]   =   [-4   0  -3  -5]
[-3  -1  -2  -4]     [-1  -1  -1  -1]       [-2   0  -1  -3]
```

The best action in each row comes out exactly 0. The others show how far below the best they are. In reinforcement learning this difference is called the **advantage**.

The same rule builds a whole table from two short lists. `r[:, None]` adds a size-1 axis, turning a row of numbers into a column:

```text
>>> r = np.arange(3)
>>> r[:, None]
array([[0],
       [1],
       [2]])
>>> r[:, None] + np.array([10, 20, 30, 40])
array([[10, 20, 30, 40],
       [11, 21, 31, 41],
       [12, 22, 32, 42]])
```

`(3, 1)` against `(4,)`: lined up from the right, 1 against 4 stretches the column across, and the missing position against 3 stretches the row down. Every element of the result is "this row's number + this column's number", a whole table from one `+`. Use this to compute where **every** action leads from **every** state at once:

```python file=qtable.py
import numpy as np

# Action 0 is up, 1 down, 2 left, 3 right: (row change, column change).
ACTIONS = [(-1, 0), (1, 0), (0, -1), (0, 1)]


def new_qtable(rows, cols):
    return np.zeros((rows * cols, len(ACTIONS)))


def state_of(cell, cols):
    row, col = cell
    return row * cols + col


def cell_of(state, cols):
    return divmod(state, cols)


def state_values(Q):
    return Q.max(axis=1)


def greedy_actions(Q):
    return Q.argmax(axis=1)


def as_grid(values, rows, cols):
    return values.reshape(rows, cols)


def normalise(values):
    low, high = values.min(), values.max()
    if high == low:
        return np.zeros(values.shape)
    return (values - low) / (high - low)


def biggest_change(old, new):
    return np.abs(new - old).max()


def greedy_action(row, rng):
    best = np.flatnonzero(row == row.max())
    return int(rng.choice(best))


def values_of(Q, actions):
    return Q[np.arange(len(Q)), actions]


def advantages(Q):
    return Q - Q.max(axis=1, keepdims=True)


def next_states(rows, cols):
    states = np.arange(rows * cols)
    row, col = divmod(states, cols)
    deltas = np.array(ACTIONS)
    new_row = np.clip(row[:, None] + deltas[:, 0], 0, rows - 1)
    new_col = np.clip(col[:, None] + deltas[:, 1], 0, cols - 1)
    return new_row * cols + new_col
```

`next_states`, traced:

1. `states` is `[0, 1, …, 24]`, and `divmod(states, cols)` works element by element, just as it does on single numbers: `row` holds each state's row and `col` its column, both shape `(25,)`.
2. `deltas = np.array(ACTIONS)` is the four `(row change, column change)` pairs as a `(4, 2)` array. `deltas[:, 0]` is the row changes, `[-1, 1, 0, 0]`, and `deltas[:, 1]` is the column changes, `[0, 0, -1, 1]`.
3. `row[:, None] + deltas[:, 0]` is `(25, 1)` against `(4,)`, giving a `(25, 4)` table: the row you'd land on for every state and action, before walls.
4. `np.clip(x, 0, rows - 1)` is `move`'s `min(max(…))` for a whole array at once. Anything below 0 becomes 0, and anything above the last row becomes the last row: `np.clip([-1, 0, 4, 5], 0, 4)` gives `[0, 0, 4, 4]`.
5. `new_row * cols + new_col` is `state_of`, applied to all 100 cells of the table at once.

Check one row by hand. State 4 is cell (0, 4), the top-right corner:

```text
>>> from qtable import next_states
>>> next_states(5, 5)[4]
array([4, 9, 3, 4])
```

Up hits the wall (stays at 4), down goes to 9, left goes to 3, right hits the wall (4). This table is the grid world's **transition table**: for every state and action, the state that comes next. Chapter 4 builds the environment from exactly this.

`advantages` is one line: the row-wise maximum with `keepdims`, subtracted from the whole table.

```check
run ".venv/Scripts/python -m pytest -q tests/test_indexing.py -k \"advantages or next_states\"" label="advantages and next_states work" -- advantages: keepdims=True keeps the maximum as a column so it broadcasts across each row. next_states: clip each new row and column into the grid before combining them.
```

## See every best move

The viewer from lesson 1.1 drew one arrow per cell, and when moves tied, `argmax` hid all but the first. An advantage of exactly 0 marks **every** best action, so draw an arrow for each:

```python file=qtable_view.py
import numpy as np
import pygame

from qtable import ACTIONS, advantages, cell_of, new_qtable, normalise, state_of, state_values
from window import BACKGROUND, CELL, GRID, HEIGHT, LINE, WIDTH, move

GOAL = (4, 4)
COLD = (30, 41, 59)
HOT = (45, 212, 191)
ARROW = (241, 245, 249)


def example_qtable():
    Q = new_qtable(GRID, GRID)
    for state in range(GRID * GRID):
        cell = cell_of(state, GRID)
        for action, delta in enumerate(ACTIONS):
            row, col = move(cell, delta)
            Q[state, action] = -(abs(row - GOAL[0]) + abs(col - GOAL[1]))
    return Q


def mix(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def draw(screen, Q):
    screen.fill(BACKGROUND)
    shade = normalise(state_values(Q))
    best = advantages(Q) == 0
    for state in range(GRID * GRID):
        row, col = cell_of(state, GRID)
        rect = (col * CELL, row * CELL, CELL, CELL)
        pygame.draw.rect(screen, mix(COLD, HOT, shade[state]), rect)
        pygame.draw.rect(screen, LINE, rect, 1)
        centre = (col * CELL + CELL // 2, row * CELL + CELL // 2)
        for action in np.flatnonzero(best[state]):
            d_row, d_col = ACTIONS[action]
            tip = (centre[0] + d_col * CELL // 3, centre[1] + d_row * CELL // 3)
            pygame.draw.line(screen, ARROW, centre, tip, 3)
            pygame.draw.circle(screen, ARROW, tip, 5)


def run(max_frames=None):
    Q = example_qtable()
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Q-table")
    clock = pygame.time.Clock()
    frames = 0
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        draw(screen, Q)
        pygame.display.flip()
        clock.tick(30)
        frames += 1
        if max_frames is not None and frames >= max_frames:
            running = False
    pygame.quit()
    return frames


if __name__ == "__main__":
    print(example_qtable()[state_of((0, 0), GRID)])
    run()
```

What changed, and how it works:

- `best = advantages(Q) == 0` is a `(25, 4)` boolean mask, `True` for every action that matches its state's best value.
- `np.flatnonzero(best[state])` turns one row of the mask into the positions of its `True` values: `[1, 3]` for a cell where down and right tie. The inner `for` draws one arrow per position, using the same tip arithmetic as before.
- `greedy_actions` is no longer imported, because the mask replaced it. `numpy` is now imported for `flatnonzero`.

Comparing floats with `==` is usually risky: `0.1 + 0.2 == 0.3` is `False` in Python, because those decimals can't be stored exactly in binary. It's safe here, because the advantage of the best action is a value minus **itself**, which is exactly 0.

Run it. Most cells now show two arrows, down and right, since from most cells both are equally good ways to the goal. Along the bottom row and the right-hand column only one move gets closer.

```predict
question: How many arrows will the goal cell have now? (Its row of values from lesson 1.1 is `[-1, 0, -1, 0]`.)
answer: 2
explain: Down and right both bump into walls and stay on the goal, so both score 0, the row's best. Both have an advantage of exactly 0, so the goal gets two arrows, down and right, both pointing into the walls. The values still have no idea that reaching the goal should **end** the episode. Chapter 4 fixes that.
verify: .venv/Scripts/python -c "import qtable_view as v, qtable as q; print(int((q.advantages(v.example_qtable())[24] == 0).sum()))"
```

```check
run ".venv/Scripts/python -m pytest -q tests/test_indexing.py tests/test_qtable.py" label="all lesson 1.1 and 1.2 tests pass" -- Draw an arrow for every action whose advantage is 0: loop over np.flatnonzero(best[state]).
```
