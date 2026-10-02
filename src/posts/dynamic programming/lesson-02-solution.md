# Lesson 2 — Solution

## Applying `memoize` to Fibonacci

```python
@memoize
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(30))
print(fib(100))
```

This works, and here's the part that trips people up: the recursive calls
`fib(n - 1)` and `fib(n - 2)` *inside the function body* refer to the name
`fib` looked up in the enclosing scope at call time — and by the time this
function actually runs, the name `fib` has already been rebound (by the
decorator) to `wrapper`. So the recursive calls go through the cache too,
not just the outermost call. That's exactly why this works with zero changes
to the body of `fib` itself — the decorator intercepts every call, including
the ones `fib` makes to itself.

## Why this matters (the actual complexity win)

Naive `fib(30)` makes roughly 2.7 million function calls, because the
recursion tree recomputes small values like `fib(5)` thousands of times.
Memoized `fib(30)` computes each distinct value of `n` from `0` to `30`
**exactly once** — 31 total computations, not millions — because every
repeat call is a cache hit.

If you added the cache-hit print statement from Part 3, you'd see it fire
constantly during the `fib(30)` call — that flood of cache hits *is* the
2.7-million-call explosion being intercepted.

## Seeing the cache size

To confirm this concretely, temporarily change `memoize` to expose the cache:

```python
def memoize(func):
    cache = {}
    def wrapper(*args):
        if args in cache:
            return cache[args]
        result = func(*args)
        cache[args] = result
        return result
    wrapper.cache = cache   # expose it for inspection
    return wrapper

@memoize
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

fib(30)
print(len(fib.cache))   # 31 — one entry per distinct n, not per call
```

That `wrapper.cache = cache` line is a small but useful trick: you can attach
extra attributes onto a function object itself, which is how you'll later
recognize things like `lru_cache`'s `.cache_info()` from the standard library
— same underlying idea as what you just built, with extra features.
