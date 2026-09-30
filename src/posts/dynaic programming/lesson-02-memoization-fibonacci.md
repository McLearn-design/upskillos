# Lesson 2 — Memoization, Fibonacci, and Tabulation

You already know how decorators, closures, and `*args`/`**kwargs` work from
Lesson 1. This lesson applies that directly to solve a real performance
problem, then shows a completely different way to solve the same problem
without recursion at all.

---

## Part 1 — A function that's needlessly slow

```python
import time

def slow_square(n):
    time.sleep(1)  # pretend this represents real, expensive work
    return n * n

start = time.time()
print(slow_square(4))
print(slow_square(4))   # same input again
print(slow_square(4))   # and again
print(f"Took {time.time() - start:.1f} seconds")
```

About 3 seconds, for the same question asked three times. `slow_square` has
no memory of past calls.

## Part 2 — Building `memoize` (you already have every piece needed)

```python
import functools

def memoize(func):
    cache = {}

    @functools.wraps(func)
    def wrapper(*args):
        if args in cache:
            print(f"  (cache hit for {args})")
            return cache[args]
        result = func(*args)
        cache[args] = result
        return result

    return wrapper
```

This is Lesson 1's `logged` pattern, with the print-and-forward behavior
replaced by check-cache-first behavior. Same closure over `cache`, same
`*args` handling, same `@functools.wraps` housekeeping. The only new idea is
using `args` (a tuple, hashable, so it's a valid dict key) as the cache key
itself, rather than just logging it.

```python
@memoize
def slow_cube(n):
    time.sleep(1)
    return n ** 3

start = time.time()
print(slow_cube(3))
print(slow_cube(3))   # instant, cache hit
print(f"Took {time.time() - start:.1f} seconds")
```

### Exploration checkpoint — inspect the cache directly

Copy this file to `memoize_explore.py`. Temporarily add
`wrapper.cache_contents = cache` inside `memoize` (right before `return
wrapper`), call `slow_cube` with a few different arguments, then print
`slow_cube.cache_contents` and look at exactly what's stored — keys are
argument tuples, values are the results. Come back here once you've seen it.

## Part 3 — The actual target: naive recursive Fibonacci

```python
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
```

Try `fib(30)` and time it — noticeably slow. The reason: the recursion tree
recomputes the same sub-calls (like `fib(5)`) thousands of times over.

**Challenge:** apply `@memoize` to `fib` and confirm `fib(30)` and even
`fib(100)` now run instantly. Before you try it: recursive calls inside `fib`
call `fib` by name — think about which version of `fib` those internal calls
end up hitting once you've decorated it, and whether that's a problem.

Don't check the solution until you've actually tried it.

**Solution:** see `lesson-02-solution.md`.

## Part 4 — Tabulation: solving it with no recursion at all

Memoization is "top-down" — start from the big problem, recurse down, cache
along the way. **Tabulation** is "bottom-up" — build the answer up from the
smallest cases using a plain loop, no recursion, no decorator:

```python
def fib_tabulated(n):
    table = [0, 1]
    for i in range(2, n + 1):
        table.append(table[i - 1] + table[i - 2])
    return table[n]
```

`table` is a plain list where `table[i]` holds the answer for `fib(i)`,
computed once, in order, left to right — no function call overhead, no
dictionary, no recursion depth limit to worry about.

### Exploration checkpoint — compare them properly

Copy this file to `fib_compare.py` and:

1. Time memoized `fib` vs. `fib_tabulated` for a large `n` (try `n = 500` —
   naive recursive `fib` even memoized will hit Python's recursion depth
   limit around there; tabulated won't, which is itself an important
   difference to notice).
2. Print `len(cache)` for the memoized version and `len(table)` for the
   tabulated version — are they storing the same amount of data?
3. Try modifying `fib_tabulated` to only keep the last two values instead of
   the whole list (since that's all `fib` ever actually needs) — how much
   memory does that save for large `n`?

Come back here once you've compared them side by side.

---

**Next: Lesson 3** — DP problems where you're not just remembering *one*
answer per input, but choosing the *best* of several options at each step
(coin change), including an exploration checkpoint where swapping a single
word (`min` → `max`) turns it into a different problem entirely.
