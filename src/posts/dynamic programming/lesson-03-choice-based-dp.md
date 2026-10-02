# Lesson 3 — Choice-Based DP: Rod Cutting, Then Coin Change

Lessons 1–2 solved problems where there was exactly one way to compute an
answer — you just needed to avoid recomputing it. This lesson introduces DP
problems where, at every step, you have **several options**, and the DP
recurrence has to pick the best one. This is a genuinely new shape, so we
build it on a problem that isn't your actual target, then hand you the target
cold.

---

## Part 1 — The generic example: rod cutting

**The problem:** you have a rod of length `n`. You can cut it into pieces of
any lengths you like (or not cut it at all). Each possible piece length has a
known selling price. You want to choose a set of cuts that maximizes total
revenue.

```python
price_by_length = {1: 2, 2: 5, 3: 7, 4: 9, 5: 11}
```

So a length-2 piece sells for 5, a length-5 piece sells for 11, etc. If you
have a rod of length 5, should you sell it whole for 11? Or cut it into two
length-2 pieces (5+5=10) plus a length-1 piece (2), for 12 total? You have to
try combinations to know.

### The recurrence, in words first

For a rod of length `remaining_length`, try **every possible first cut**
(length `1` up to `remaining_length`), and for each one, ask: "what's the
best I can do with the rest, plus this cut's price?" Take whichever first cut
gives the highest total. In words:

> `best_revenue(remaining_length)` = the largest, over every `cut_length`
> from 1 to `remaining_length`, of `price_by_length[cut_length] +
> best_revenue(remaining_length - cut_length)`

This is recursive: `best_revenue` calls itself on a smaller `remaining_length`
for every candidate cut. That's exactly the shape Lessons 1–2 already gave you
tools for — a recursive function with repeated sub-calls is a memoization
candidate.

### Building it

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

price_by_length = {1: 2, 2: 5, 3: 7, 4: 9, 5: 11}

@memoize
def best_revenue(remaining_length):
    if remaining_length == 0:
        return 0
    best_so_far = float("-inf")
    for cut_length in range(1, remaining_length + 1):
        if cut_length not in price_by_length:
            continue
        candidate_revenue = price_by_length[cut_length] + best_revenue(remaining_length - cut_length)
        best_so_far = max(best_so_far, candidate_revenue)
    return best_so_far

print(best_revenue(5))   # 12 — two length-2 pieces + one length-1 piece
```

Walk through the mechanics:

- `best_so_far = float("-inf")` — we start assuming nothing beats "negative
  infinity" so that the very first real candidate we check always wins the
  initial comparison. This is the standard starting point whenever you're
  computing a maximum with `max()` in a loop.
- The `for cut_length in range(1, remaining_length + 1)` loop is the "try
  every option" part — this is the new idea Lessons 1–2 didn't need, because
  there was only ever one way to compute `fib(n)`.
- `@memoize` works exactly as it did for `fib` — `remaining_length` becomes
  the cache key, because the cache dict's keys are `*args` tuples, and here
  there's exactly one argument.
- The base case `remaining_length == 0` returns `0` — a rod of length 0 is
  worth nothing, and every recursive chain eventually bottoms out there.

### Exploration checkpoint — see the choices actually get compared

Copy this file to `rod_cutting_explore.py`. Add a `print` inside the loop
showing `cut_length` and `candidate_revenue` for every candidate tried at the
top-level call `best_revenue(5)` — you'll need to temporarily remove
`@memoize` or add the print before the memoized wrapper's cache check to see
every comparison happen the first time through. Confirm by hand that `12` is
really the best of everything tried. Come back here once you've seen it.

---

## Challenge — Coin change: minimum coins to make an amount

**The problem:** given coin denominations (e.g. `[1, 5, 10, 25]`) and a
target `amount`, find the **minimum number of coins** needed to make exactly
that amount (assume unlimited coins of each denomination).

This has the *exact same shape* as rod cutting: at each amount, try every
coin as the "last coin used," and take the best result from what's left over.

**Your task:** write `min_coins(amount)` yourself, using `@memoize`, following
the same pattern as `best_revenue` — but note two differences you'll need to
handle:
1. You want the **minimum**, not the maximum, so your starting "worse than
   anything real" value and your comparison function both need to flip.
2. Some amounts can't be made exactly with the given coins (e.g. amount `3`
   with only `[5, 10]`) — you need a way to represent "impossible" and make
   sure it doesn't accidentally get chosen as if it were a low, good answer.

Try it on `coin_denominations = [1, 5, 10, 25]` and `amount = 63` before
checking the solution.

**Solution:** see `lesson-03-solution.md`.

---

## Exploration checkpoint — swap `min` for `max`

Copy your working `min_coins` to `max_coins_explore.py` and change every
`min`-related piece to its `max` counterpart (comparison direction and the
starting sentinel value). Run it on the same denominations and amount.

You've now built a solver for a **different, real problem**: the maximum
number of coins that can be used to make an amount exactly (as opposed to the
fewest). Same skeleton, same recurrence shape, opposite optimization goal.
Confirm the answer makes sense — for `amount = 63` with `[1, 5, 10, 25]`, the
max-coins answer should use lots of `1`s.

---

**Next: Lesson 4** — DP over a 2D table instead of a single number, using a
grid, closing out Phase A with a capstone that ties this lesson's
choice-at-every-step idea together with a two-dimensional state.
