# Lesson 3 — Solution

## `min_coins`: minimum coins to make an amount

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

coin_denominations = [1, 5, 10, 25]

@memoize
def min_coins(amount):
    if amount == 0:
        return 0
    best_so_far = float("inf")
    for coin in coin_denominations:
        if coin > amount:
            continue
        remaining_after_this_coin = amount - coin
        coins_for_remainder = min_coins(remaining_after_this_coin)
        if coins_for_remainder == float("inf"):
            continue   # that remainder is impossible, skip it
        best_so_far = min(best_so_far, 1 + coins_for_remainder)
    return best_so_far

print(min_coins(63))   # 6 -> e.g. 25 + 25 + 10 + 1 + 1 + 1
```

The two differences from `best_revenue`, explained:

- **`float("inf")` instead of `float("-inf")`.** We're now looking for the
  smallest value, so we start by assuming everything is "worse" (i.e. bigger)
  than any real answer could be, exactly mirroring why `best_revenue` started
  at negative infinity for a maximum search.
- **Propagating impossibility.** If `min_coins(remaining_after_this_coin)`
  itself returns `float("inf")`, that means there's no way to make that
  remainder — and `1 + float("inf")` is still `float("inf")`, so it would
  never accidentally be picked by `min()` over a real, finite answer. The
  explicit `if coins_for_remainder == float("inf"): continue` isn't strictly
  required (the arithmetic already protects you) but makes the impossibility
  case readable rather than relying on a subtle property of `float("inf")`
  arithmetic.
- Notice `min_coins(0)` returning `0` is what makes the whole recursion
  bottom out correctly — using a coin that exactly equals the remaining
  amount always finds this base case.

## Why unlimited coins works with a single-argument cache

You might wonder how the code "knows" it can reuse the same coin multiple
times. It's built into the recurrence itself: `min_coins(remaining_after_this_
coin)` is free to choose the *same* coin again on its own turn — there's no
tracking of "coins used so far," only "amount still needed." This is what
makes it "unlimited supply" rather than "each coin usable once" (that's a
different, harder problem — the 0/1 knapsack style problem in Lesson 4's
capstone touches exactly this distinction).
