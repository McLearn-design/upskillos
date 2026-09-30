# Lesson 4 — Solution

## `min_cost_path`: minimum-cost path through a weighted grid

The unhashable-argument problem: `@memoize`'s cache uses `args` (a tuple) as
a dict key, and tuples require every element inside them to be hashable too.
A list (`cost_grid`) inside that tuple breaks hashing. The cleanest fix: keep
`cost_grid` **out** of the memoized function's arguments entirely, and access
it as a variable from the enclosing scope instead — exactly the closure
pattern from Lesson 1.

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

cost_grid = [
    [1, 3, 1],
    [1, 5, 1],
    [4, 2, 1],
]

@memoize
def min_cost_path(row, col):
    current_cost = cost_grid[row][col]
    if row == 0 and col == 0:
        return current_cost
    if row == 0:
        return current_cost + min_cost_path(row, col - 1)
    if col == 0:
        return current_cost + min_cost_path(row - 1, col)
    return current_cost + min(
        min_cost_path(row - 1, col),
        min_cost_path(row, col - 1),
    )

print(min_cost_path(2, 2))   # 7
```

Only `(row, col)` are passed as arguments — both plain integers, both
hashable — so `@memoize` works exactly as before. `cost_grid` is read
directly from the surrounding scope every time `min_cost_path` runs, the same
way `wrapper` in Lesson 1 read `func` from its enclosing scope.

## 0/1 Knapsack capstone

```python
item_weights = [2, 3, 4, 5]
item_values  = [3, 4, 5, 6]
capacity = 5

@memoize
def best_value(item_index, remaining_capacity):
    if item_index == len(item_weights):
        return 0

    value_if_skipped = best_value(item_index + 1, remaining_capacity)

    value_if_taken = float("-inf")
    if item_weights[item_index] <= remaining_capacity:
        value_if_taken = item_values[item_index] + best_value(
            item_index + 1,
            remaining_capacity - item_weights[item_index],
        )

    return max(value_if_skipped, value_if_taken)

print(best_value(0, capacity))   # 7
```

Notice the full lineage here:

- `@memoize`, unchanged since Lesson 1.
- `max(value_if_skipped, value_if_taken)` — the "try every option, take the
  best" shape from rod cutting and coin change (Lesson 3), just with exactly
  two options (skip/take) instead of a loop over many.
- `(item_index, remaining_capacity)` — a two-number tuple state, exactly like
  `(row, col)` in the grid problems, just meaning something different here
  (which decision you're on, and how much room is left).
- `value_if_taken = float("-inf")` when the item doesn't fit — the same
  "impossible option shouldn't win" pattern as coin change's
  `float("inf")` sentinel, just for a maximum instead of a minimum.

This is the real payoff of Phase A: four "different" problems (Fibonacci,
coin change, grid paths, knapsack) turned out to be the same three or four
ideas — a cached recursive function, a choice among options, and a tuple
representing "where you are" — recombined each time.
