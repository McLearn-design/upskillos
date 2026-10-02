# Lesson 4 — 2D Grid DP, and the Phase A Capstone

Every DP problem so far has had **one number** describing "how far along you
are" (a rod length, an amount of money). This lesson introduces DP where the
state is a **pair of numbers** — a position in a grid — and closes Phase A
with a capstone that combines everything: choice-at-every-step (Lesson 3)
with a genuinely multi-dimensional state.

---

## Part 1 — The generic example: counting paths through a grid

**The problem:** you're at the top-left corner of a `rows × columns` grid.
You can only move **right** or **down**. How many distinct paths are there to
the bottom-right corner?

### The recurrence, in words first

The number of ways to reach cell `(row, col)` is the number of ways to reach
the cell just above it, plus the number of ways to reach the cell just to its
left — because every path arriving at `(row, col)` did so by moving down from
`(row-1, col)` or right from `(row, col-1)`, and those are the *only* two
possibilities.

> `paths_to(row, col)` = `paths_to(row - 1, col)` + `paths_to(row, col - 1)`

Base case: there's exactly `1` way to reach any cell in the top row or the
left column (keep moving in the one direction available).

### Building it

Now the cache key needs **two** numbers, not one. Recall from Lesson 2:
`memoize`'s cache is keyed by `args`, the full tuple of arguments — so this
works completely unchanged, because `(row, col)` naturally becomes a
two-element tuple key.

```python
import functools

def memoize(func):
    cache = {}
    @functools.wraps(func)
    def wrapper(*args):
        if args in cache:
            return cache[args]
        result = func(*args)
        cache[args] = result
        return result
    return wrapper

@memoize
def paths_to(row, col):
    if row == 0 or col == 0:
        return 1
    return paths_to(row - 1, col) + paths_to(row, col - 1)

print(paths_to(2, 2))   # 6 -> a 3x3 grid of cells has 6 distinct paths corner to corner
```

Nothing about `memoize` changed. `wrapper(*args)` collected `(row, col)` into
a two-element tuple exactly the way it collected a single-element tuple
before — this is the payoff of building `*args`-based memoization generally
back in Lesson 1, instead of a version hardcoded for one argument.

### Exploration checkpoint — see the table fill in, visually

Copy this file to `grid_paths_explore.py`. Instead of memoized recursion,
build the **tabulated** version: a 2D list (`grid = [[0] * cols for _ in
range(rows)]`), filled in with nested loops, top row and left column set to
`1`, everything else computed as `grid[row][col] = grid[row-1][col] +
grid[row][col-1]`. Print the whole `grid` at the end and look at how the
numbers grow outward from the top-left corner. Come back here once you've
built and printed it.

---

## Challenge — Minimum-cost path through a weighted grid

**The problem:** now each cell has a **cost** to enter (not just 1 path per
step — think of it as a cost grid, e.g. representing terrain difficulty).
Find the *minimum total cost* path from top-left to bottom-right, still only
moving right or down.

**Your task:** write `min_cost_path(row, col, cost_grid)` using `@memoize`,
adapting `paths_to`'s recurrence: instead of *adding* two possibilities
together, you want the **minimum** of two possibilities, plus the cost of the
current cell itself.

Try it on:

```python
cost_grid = [
    [1, 3, 1],
    [1, 5, 1],
    [4, 2, 1],
]
```

The minimum-cost path from `(0, 0)` to `(2, 2)` should total `7`.

One thing to think about before you try it: `@memoize`'s cache key is built
from *all* the arguments passed in — including `cost_grid` itself, if you
pass it as an argument every call. Since a list isn't hashable, this will
actually break the cache. Think about how to work around this (there's more
than one valid way) before checking the solution.

**Solution:** see `lesson-04-solution.md`.

---

## Exploration checkpoint — adding a diagonal move

Copy your working `min_cost_path` to `diagonal_explore.py` and add a third
option: moving diagonally from `(row-1, col-1)`. This means:

1. The recurrence itself needs a third candidate in whatever `min()` call
   you're using.
2. The base case needs rethinking — cell `(0, 0)` is still trivially just its
   own cost, but is the *entire* top row and left column still forced to a
   single path anymore? (They still are, since diagonal moves need both a row
   and column to be nonzero — confirm this for yourself by tracing it.)

Run it on the same `cost_grid` and see whether the minimum cost changes with
the diagonal option available.

---

## Phase A Capstone — 0/1 Knapsack

This combines Lesson 3's "choose the best of several options" with this
lesson's "two-number state," and is genuinely one of the most important DP
patterns you'll encounter (it recurs constantly, including later when we
reach resource-allocation-style RL problems).

**The problem:** you have a knapsack that can hold a maximum `capacity`
(weight), and a set of items, each with a `weight` and a `value`. Unlike
coin change, you can use each item **at most once** ("0/1" — you either take
it (1) or don't (0)). Maximize total value without exceeding capacity.

### The recurrence, in words

For each item, in order, you have a genuine choice at every step: **skip
it**, or **take it** (if it fits). This is a two-number state — which item
you're currently deciding on, and how much capacity you have left:

> `best_value(item_index, remaining_capacity)` = the larger of:
> - `best_value(item_index + 1, remaining_capacity)` (skip this item)
> - `item_values[item_index] + best_value(item_index + 1, remaining_capacity - item_weights[item_index])`
>   (take this item, *only if* `item_weights[item_index] <= remaining_capacity`)

Base case: once `item_index` runs past the last item, there's nothing left
to add — return `0`.

**Your task:** build `best_value(item_index, remaining_capacity)` yourself,
using `@memoize`, given:

```python
item_weights = [2, 3, 4, 5]
item_values  = [3, 4, 5, 6]
capacity = 5
```

The answer should be `7` (taking the items with weight 2 and weight 3, values
3+4). Notice explicitly how this connects everything in Phase A: the
`@memoize` decorator from Lesson 1, the "try every option and take the best"
shape from Lesson 3 (rod cutting/coin change), and the two-number tuple state
from this lesson's grid problems — all in one recurrence.

**Solution:** see `lesson-04-solution.md` (second half, after the
minimum-cost-path solution).

---

**Next: Lesson 5** opens Phase B — the exact same recursive, cached
structure you've now built four times over gets relabeled as "states,"
"actions," and "rewards," which is the vocabulary bridge to value iteration
and, eventually, the Bellman equation.
