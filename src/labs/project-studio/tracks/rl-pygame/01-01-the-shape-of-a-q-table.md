---
title: 1.1 — Arrays: the Shape of a Q-table
track: Reinforcement Learning in pygame
runtime: python
---

A Q-learning agent learns one number for every pair of **state** (where it is) and **action** (what it could do there): how good it is to take that action there. All of these numbers together form a table, the **Q-table**. In a 5 × 5 grid with four moves, that's 25 rows of 4 numbers. The agent's whole knowledge is that table, and learning means changing the numbers in it.

In this lesson you build the table as a NumPy array, ask it the two questions an agent asks ("how good is this cell?" and "which way should I go?"), and draw the answers in pygame. The numbers are made up for now. Learning them from experience is what the rest of the series is for.

NumPy's central object is the **array**: a grid of numbers, all of one type, stored side by side in memory. Arithmetic on an array works on the whole grid at once, with no Python loop, and is much faster than the same work on lists. (The Notebook Lab's *Machine Learning* series, lesson 1, measures how much faster.)

## Read the tests first

**This step: create the supplied test file and read it. No code yet.**

Click **Create provided tests/test_qtable.py** above.

```python file=tests/test_qtable.py provided
# Tests for qtable.py and qtable_view.py. Run them from the project folder with:
#   .venv\Scripts\python -m pytest -q tests/test_qtable.py
import numpy as np
import pygame

import qtable


def test_new_table_has_a_row_per_cell_and_a_column_per_action():
    Q = qtable.new_qtable(3, 5)
    assert Q.shape == (15, 4), "3 rows x 5 columns is 15 cells; there are 4 actions"
    assert Q.dtype == np.float64, "values will be fractions, so the table holds floats"
    assert not Q.any(), "a new agent knows nothing: every value starts at 0"


def test_state_numbers_go_along_each_row():
    assert qtable.state_of((0, 0), 5) == 0
    assert qtable.state_of((0, 4), 5) == 4
    assert qtable.state_of((1, 0), 5) == 5, "the cell after (0, 4) is the start of row 1"
    assert qtable.state_of((2, 3), 5) == 13


def test_state_numbers_turn_back_into_cells():
    for state in range(15):
        row, col = qtable.cell_of(state, 5)
        assert qtable.state_of((row, col), 5) == state


def test_values_are_the_best_number_in_each_row():
    Q = np.array([[1.0, 5.0, 2.0, 0.0],
                  [-3.0, -1.0, -2.0, -4.0]])
    assert qtable.state_values(Q).tolist() == [5.0, -1.0]


def test_greedy_actions_are_where_each_row_is_largest():
    Q = np.array([[1.0, 5.0, 2.0, 0.0],
                  [-3.0, -1.0, -2.0, -4.0]])
    assert qtable.greedy_actions(Q).tolist() == [1, 1]


def test_grid_puts_states_back_in_rows():
    grid = qtable.as_grid(np.arange(6.0), 2, 3)
    assert grid.shape == (2, 3)
    assert grid[1, 0] == 3.0, "state 3 is row 1, column 0 when there are 3 columns"


def test_normalise_maps_lowest_to_0_and_highest_to_1():
    out = qtable.normalise(np.array([-8.0, -4.0, 0.0]))
    assert out.tolist() == [0.0, 0.5, 1.0]


def test_normalise_all_equal_values_does_not_divide_by_zero():
    out = qtable.normalise(np.zeros(4))
    assert out.tolist() == [0.0, 0.0, 0.0, 0.0]


def test_view_example_values_rise_towards_the_goal():
    import qtable_view
    Q = qtable_view.example_qtable()
    values = qtable.as_grid(qtable.state_values(Q), 5, 5)
    assert values[4, 4] == 0.0, "standing on the goal, the best move stays on it"
    assert values[0, 0] == -7.0, "from the far corner the best move still leaves 7 steps"


def test_view_mix_blends_two_colours():
    import qtable_view
    assert qtable_view.mix((0, 0, 0), (200, 100, 50), 0.0) == (0, 0, 0)
    assert qtable_view.mix((0, 0, 0), (200, 100, 50), 0.5) == (100, 50, 25)
    assert qtable_view.mix((0, 0, 0), (200, 100, 50), 1.0) == (200, 100, 50)


def test_view_draws_the_best_cell_hot_and_the_worst_cold():
    import qtable_view
    screen = pygame.Surface((qtable_view.WIDTH, qtable_view.HEIGHT))
    qtable_view.draw(screen, qtable_view.example_qtable())
    cell = qtable_view.CELL
    assert screen.get_at((4 * cell + 6, 4 * cell + 6))[:3] == qtable_view.HOT
    assert screen.get_at((6, 6))[:3] == qtable_view.COLD


def test_view_window_opens_and_closes():
    import qtable_view
    assert qtable_view.run(max_frames=2) == 2
```

`.tolist()` turns an array back into a plain Python list, so it can be compared with `==` against a list. (Comparing two arrays with `==` gives an array of `True`/`False`, one per element, which `assert` can't use directly.) The `qtable_view` tests import it inside each test, so the earlier tests run before that file exists.

```check
file tests/test_qtable.py -- Click "Create provided tests/test_qtable.py" above.
```

## A table of zeros

Create `qtable.py`:

```python file=qtable.py
import numpy as np

# Action 0 is up, 1 down, 2 left, 3 right: (row change, column change).
ACTIONS = [(-1, 0), (1, 0), (0, -1), (0, 1)]


def new_qtable(rows, cols):
    return np.zeros((rows * cols, len(ACTIONS)))
```

- `import numpy as np` is the universal convention. Every NumPy example you'll read calls it `np`.
- `ACTIONS` gives each action a number, its position in the list. Arrays are indexed by numbers, so the table's column 3 means "right" because `ACTIONS[3]` is right. The deltas are the same as `MOVES` in `window.py`.
- `np.zeros(shape)` makes an array filled with `0.0`. The **shape** is a tuple with one length per dimension: `(25, 4)` means 25 rows and 4 columns. One row per state, one column per action.

Now explore it. Typing `.venv\Scripts\python` with no file name starts Python's **interactive prompt**, `>>>`. Each line you type runs immediately, and the value of an expression is shown. It's the quickest way to answer "what does this do?" Type the lines after `>>>`, one at a time, and **predict each answer before pressing Enter**:

```text
.venv\Scripts\python
>>> from qtable import new_qtable
>>> Q = new_qtable(5, 5)
>>> Q.shape
(25, 4)
>>> Q.size
100
>>> Q.dtype
dtype('float64')
>>> Q[0]
array([0., 0., 0., 0.])
>>> Q[:, 3]
array([0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.,
       0., 0., 0., 0., 0., 0., 0., 0.])
>>> Q[0, 3] = 2.5
>>> Q[0]
array([0. , 0. , 0. , 2.5])
>>> exit()
```

- `size` is the total number of elements: 25 × 4.
- `dtype` is the element type. `float64` is a 64-bit floating-point number, the same precision as a Python `float`. Every element of an array has this one type, which is part of why arrays are fast.
- `Q[0]` is row 0: state 0's four action values. `Q[:, 3]` means "every row, column 3": the value of moving right, in all 25 states. `:` on its own means "all of this dimension".
- `Q[0, 3] = 2.5` sets one value: state 0, action 3. A two-dimensional array takes both indexes inside one pair of brackets, separated by a comma. That one line, with a better number than 2.5, is how a Q-learning agent learns.

### How an array is laid out in memory

A Python list of lists is a list of separate list objects, each holding pointers to separate number objects scattered around memory. An array is one unbroken block of raw numbers. `Q` is 100 numbers of 8 bytes each (`float64` is 64 bits, which is 8 bytes), so it's 800 bytes, stored row after row:

```text
byte:    0     8    16    24 | 32    40    48    56 | 64  …
value:  Q[0,0] Q[0,1] Q[0,2] Q[0,3] | Q[1,0] Q[1,1] …
         └────── state 0 ──────┘   └─── state 1 ───
```

The array also stores its **strides**: how many bytes to step for each index. Check at the prompt:

```text
>>> Q.strides
(32, 8)
```

One step along axis 0 (the next state) moves 32 bytes, past a whole row of 4 numbers. One step along axis 1 (the next action) moves 8 bytes. So `Q[s, a]` is found with arithmetic, `start + s*32 + a*8`, with no searching: `Q[13, 2]` is at byte 13 × 32 + 2 × 8 = 432. `Q[:, 3]` doesn't copy column 3. It describes "start at byte 24, then every 32 bytes", which reads the same memory differently. This layout is what lets NumPy's whole-array operations run as tight loops in compiled C, instead of one Python step per number.

```check
run ".venv/Scripts/python -m pytest -q tests/test_qtable.py -k new_table" label="new_qtable makes a (cells, actions) table of zeros" -- One row per cell (rows * cols of them) and one column per action.
```

## Number the cells

The grid's cells are `(row, column)` pairs, but the table's rows are numbered 0 to 24. Each cell needs a **state number**. Count along each row, then go to the next row, the way you read a page:

```text
 0  1  2  3  4
 5  6  7  8  9
10 11 12 13 14
15 16 17 18 19
20 21 22 23 24
```

Cell (2, 3) is 2 full rows of 5 in, plus 3 more, so it's state 2 × 5 + 3 = 13. Going back, 13 divided by 5 is 2, remainder 3. Add both directions:

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
```

`divmod(a, b)` returns `(a // b, a % b)`: the whole number of times `b` fits into `a`, and what's left over. For state 13 with 5 columns: 13 = 2 × 5 + 3, so `divmod(13, 5)` is `(2, 3)`. That's row 2, column 3: undoing `row * cols + col` exactly, because the column is always less than `cols` and so it's always the remainder. The test checks every state from 0 to 14: converting a state to a cell and back must return the same state. A test of this kind, "there and back gives what you started with", catches a whole family of mistakes at once.

```check
run ".venv/Scripts/python -m pytest -q tests/test_qtable.py -k state_numbers" label="state_of and cell_of convert both ways" -- A cell's state number is (its row × the number of columns) + its column.
```

## Ask the table two questions

An agent standing in a state asks two things:

1. **How good is it to be here?** Use the best of the four action values in that row. This is the state's **value**.
2. **Which way should I go?** Take the action with the best value: the **greedy** action.

You could answer them with a Python loop over the rows. NumPy answers them for every state at once:

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
```

`axis` says which dimension to **collapse**. Axis 0 runs down the rows and axis 1 runs across the columns. `Q.max(axis=1)` takes the maximum across the columns of each row, so one number is left per row: an array of 25 values, one per state. `argmax` gives the **position** of the maximum instead of the maximum itself, which is the action's number.

```text
            up  down  left  right       max(axis=1)   argmax(axis=1)
state 0  [ 1.0   5.0   2.0   0.0 ]  →      5.0              1
state 1  [-3.0  -1.0  -2.0  -4.0 ]  →     -1.0              1
```

```predict
question: In a brand-new table, every value is 0. Which action will `greedy_actions` choose in each state?
choice: up (action 0) in every state
choice: right (action 3) in every state
choice: a different random action in each state
answer: up (action 0) in every state
explain: At the prompt, `greedy_actions(new_qtable(2, 2))` returns `array([0, 0, 0, 0])`: action 0, up, everywhere. Read on for why.
verify: .venv/Scripts/python -c "from qtable import new_qtable, greedy_actions; a = set(greedy_actions(new_qtable(2, 2)).tolist()); print('up (action 0) in every state' if a == {0} else a)"
```

To see why, here's what `argmax` does for each row, written as the Python it's equivalent to (NumPy runs it in C):

```python
best = 0
for a in range(1, len(row)):
    if row[a] > row[best]:      # strictly greater
        best = a
```

It replaces the best only when a value is **strictly** greater, so when values tie, the first one stays. When every value is 0, nothing is ever greater than `row[0]`, so the answer is always action 0, up. An agent that knows nothing always goes up. That's a real flaw: an untrained agent should try things, not march into the top wall. Lesson 1.2 fixes it by breaking ties at random.

`Q.max(axis=0)` is also legal, but it answers a different question: the best value of each *action* over all states. It has 4 numbers, not 25. If your shapes come out wrong, the axis is the first thing to check.

```check
run ".venv/Scripts/python -m pytest -q tests/test_qtable.py -k \"best_number or greedy\"" label="state_values and greedy_actions work row by row" -- Collapse axis 1 (across the columns), leaving one number per row.
```

## Back to a grid, and onto a colour scale

The 25 state values are a flat list, but the screen is a grid. `reshape` turns them back into 5 rows of 5. To shade each cell, the values also need to be scaled to between 0 (worst) and 1 (best):

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
```

**How `reshape` works without copying.** The 25 values are 25 numbers in a row in memory, with strides `(8,)`: step 8 bytes to the next value. `reshape(5, 5)` makes a new array object that points at **the same memory**, with new strides, `(40, 8)`: 40 bytes to the next row (5 values), 8 to the next column. Element `[2, 3]` is then at byte 2 × 40 + 3 × 8 = 104, which is value number 13. That's state 13, because states were numbered along each row, exactly the order `reshape` fills in. That's why the cells were numbered that way. Prove that nothing was copied:

```text
>>> import numpy as np
>>> v = np.arange(25.0)
>>> g = v.reshape(5, 5)
>>> g[2, 3] = 99
>>> v[13]
np.float64(99.0)
```

Changing the grid changed the flat array, because they're two views of one block of memory.

**How `normalise` works.** It first finds the lowest and highest values. Then `values - low` subtracts that one number from **every** element: NumPy repeats a single number across the whole array for you (lesson 1.2 shows the rule). Dividing by `(high - low)` then divides every element. Worked through:

```text
values             [-8, -4,  0]      low = -8, high = 0
values - low       [ 0,  4,  8]      the lowest is now 0
÷ (high - low = 8) [ 0, 0.5, 1]      the highest is now 1
```

**Why the `if` comes first.** If every value is the same, `high - low` is 0, and every element becomes 0 / 0. NumPy doesn't raise an error for this: it prints a `RuntimeWarning` and puts `nan` ("not a number") in the result. And `nan` spreads, since any arithmetic with `nan` gives `nan`. A new table is all zeros, so this is the very first case the viewer will meet. The function checks for it before dividing.

```check
run ".venv/Scripts/python -m pytest -q tests/test_qtable.py -k \"grid or normalise\"" label="as_grid and normalise work" -- normalise: when every value is the same, return zeros before dividing.
```

## See the table

Now draw it. `qtable_view.py` fills a table with made-up values, then shades each cell by its value and draws an arrow for its greedy action:

```python file=qtable_view.py
import pygame

from qtable import ACTIONS, cell_of, greedy_actions, new_qtable, normalise, state_of, state_values
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
    best = greedy_actions(Q)
    for state in range(GRID * GRID):
        row, col = cell_of(state, GRID)
        rect = (col * CELL, row * CELL, CELL, CELL)
        pygame.draw.rect(screen, mix(COLD, HOT, shade[state]), rect)
        pygame.draw.rect(screen, LINE, rect, 1)
        centre = (col * CELL + CELL // 2, row * CELL + CELL // 2)
        d_row, d_col = ACTIONS[best[state]]
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

**How `example_qtable` makes up its values.** These are values a well-trained agent might have learned. For each state and each action, it asks where that action leads, using your `move` from `window.py`, and scores it as minus the number of steps still left from there to the goal. On a grid with no diagonal moves, that number is `|row difference| + |column difference|`. Closer is better, so less negative is better. One state, worked through:

```text
state 0 is cell (0, 0); the goal is (4, 4)
up    → move gives (0, 0) (wall) → |0-4| + |0-4| = 8 → Q[0, 0] = -8
down  → move gives (1, 0)        → |1-4| + |0-4| = 7 → Q[0, 1] = -7
left  → move gives (0, 0) (wall) → 8                 → Q[0, 2] = -8
right → move gives (0, 1)        → 7                 → Q[0, 3] = -7
```

`enumerate(ACTIONS)` hands out each action's number together with its delta, `(0, (-1, 0))`, then `(1, (1, 0))` and so on, so the loop knows both which column to write and which way to move.

**How `mix` blends two colours.** For each of red, green and blue, it starts at `a`'s value and goes a fraction `t` of the way to `b`'s: `x + (y - x) * t`. `zip(a, b)` pairs up the three channels. Halfway (`t = 0.5`) from `COLD` to `HOT`:

```text
red:   30 + (45 - 30)  * 0.5 =  37.5 → 38
green: 41 + (212 - 41) * 0.5 = 126.5 → 126
blue:  59 + (191 - 59) * 0.5 = 125.0 → 125
```

`round` is needed because a pixel's channels must be whole numbers. Python's `round` rounds an exact half to the nearest **even** number, which is why 126.5 becomes 126.

**How each cell is drawn.** `shade[state]` is that state's value, scaled to between 0 and 1, so the worst cell gets `COLD`, the best gets `HOT`, and everything else something in between. `pygame.draw.rect(…, rect, 1)` draws again with a final width argument, which draws only the outline, 1 pixel wide. That gives the grid lines.

**How the arrow points the right way.** It starts at the cell's centre. The greedy action's delta says which way: for "down", `(d_row, d_col)` is `(1, 0)`. The tip is the centre moved `d_col * CELL // 3` pixels across (x) and `d_row * CELL // 3` pixels down (y). For "down" that's 0 across and 26 down, a third of a cell. This is the same row-to-y, column-to-x rule as `window.py`.
- `from window import …` reuses the constants and `move` you wrote in lesson 0.3. Notice the run loop is almost a copy of `window.py`'s. When several files repeat the same loop, it's time to share it. A later lesson does exactly that, and builds the viewer the rest of the series uses.

Run `qtable_view.py`. The output shows pygame's greeting, then the start cell's row:

```text
pygame-ce 2.5.8 (SDL 2.32.10, Python 3.13.14)
[-8. -7. -8. -7.]
```

From (0, 0): up and left bump into walls and stay put, 8 steps from the goal. Down and right each get one step closer.

In the window, the cells brighten towards the goal at the bottom right, and the arrows point the way there.

Three predictions. Make each one before you look at the window.

```predict
question: Down and right are tied in the top-left cell. Which way does its arrow point?
choice: down
choice: right
choice: both
answer: down
explain: `argmax` keeps the first of tied values. Down is action 1 and right is action 3, so down comes first. The viewer draws one arrow per cell, so the tie is hidden. Lesson 1.2 draws every tied best action.
verify: .venv/Scripts/python -c "import qtable_view as v, qtable as q; print(['up', 'down', 'left', 'right'][q.greedy_actions(v.example_qtable())[0]])"
```

```predict
question: The goal cell is state 24. Work out its row of four values by hand (up, down, left, right). What's the largest of them?
answer: 0
explain: From the goal (4, 4): up goes to (3, 4), 1 step away, so −1. Down hits the wall and stays on the goal, 0 steps, so 0. Left goes to (4, 3), so −1. Right hits the wall, so 0. The row is `[-1, 0, -1, 0]`. Down and right tie at 0, and `argmax` picks down, the first, which is why the goal's arrow points into the wall. Check with `qtable_view.example_qtable()[24]` at the prompt.
verify: .venv/Scripts/python -c "import qtable_view as v; print(v.example_qtable()[24].max())"
```

```predict
question: Change `GOAL` to `(0, 4)`, the top-right corner. Which cells will change colour, and which arrows?
explain: Every cell's values are distances to the goal, so everything is recomputed. The brightest cells are now around the top right, and the bottom-left cell is the darkest. The arrows now point up or right, towards the new goal. Run it to check, then set `GOAL` back to `(4, 4)`.
```

The goal-cell prediction shows something important. These made-up values have no idea of an episode **ending**. Standing on the goal, walking into the wall "keeps you there", which scores as well as anything. In Chapter 4 the goal becomes a **terminal** state: reaching it ends the episode, and nothing after it counts. You'll see that change the values near the goal.

```check
run ".venv/Scripts/python -m pytest -q tests/test_qtable.py" label="all Q-table tests pass" timeout=120 -- Each cell's colour comes from normalise(state_values(Q)), not from the raw values: mix needs a number between 0 and 1.
```
