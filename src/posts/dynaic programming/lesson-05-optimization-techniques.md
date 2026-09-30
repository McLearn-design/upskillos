# Lesson 5 — Optimization Techniques: Tail Recursion, Trampolining, and Space Optimization

Everything in Phase A made recursive DP solutions *fast* (avoiding
recomputation). This lesson is about a different axis entirely: making them
**not run out of stack space or memory** — which becomes a real, practical
problem the moment `n` gets large.

---

## Part 1 — What "tail position" actually means

A recursive call is in **tail position** when it's the very last action a
function performs — there is nothing left to do with its result except hand
it straight back.

```python
# NOT tail recursive: multiplication happens AFTER the recursive call returns
def factorial(n):
    if n == 0:
        return 1
    return n * factorial(n - 1)   # work remains after the call: the multiply
```

```python
# tail recursive: the recursive call is the literal last thing that happens
def factorial_tail(n, accumulator=1):
    if n == 0:
        return accumulator
    return factorial_tail(n - 1, n * accumulator)   # nothing left to do after this
```

The rewrite's trick is an **accumulator parameter**: instead of doing the
multiplication *after* the recursive call returns, you do it *before*,
folding the running total into the argument you pass down. This
accumulator-passing style is a general technique for converting non-tail
recursion into tail recursion — you'll use it again below.

### Why this distinction usually matters (and why it doesn't in Python)

In languages with **tail-call optimization (TCO)**, the interpreter/compiler
recognizes a tail-recursive call and reuses the current stack frame instead
of pushing a new one — so `factorial_tail` could run with `n` in the
millions using constant stack space, turning recursion into a loop under the
hood.

**Python does not do this.** Ever. This is a deliberate CPython design
decision (partly for clearer tracebacks), not a missing optimization waiting
to be added. Confirm it yourself:

```python
import sys
print(sys.getrecursionlimit())   # usually 1000

factorial_tail(2000)   # RecursionError, even though this IS tail recursive
```

Being tail-recursive buys you *nothing* in Python by default — both versions
above blow the stack at roughly the same `n`. This is genuinely surprising if
you've used a language that does optimize this, and it's why the next
section exists.

---

## Part 2 — Trampolining: manually getting tail-recursion's benefit

**Generic example (not our real target yet):** instead of a function calling
itself directly, have it return a description of "the next call to make" —
a zero-argument callable — and let an outer loop keep invoking those
descriptions until a real value comes back, instead of a callable.

```python
def factorial_bounced(n, accumulator=1):
    if n == 0:
        return accumulator
    return lambda: factorial_bounced(n - 1, n * accumulator)

def trampoline(bouncing_function, *args):
    result = bouncing_function(*args)
    while callable(result):
        result = result()
    return result

print(trampoline(factorial_bounced, 2000))   # works fine, no RecursionError
```

Walk through the mechanics carefully:

- `factorial_bounced` never actually calls itself directly. Instead of
  `return factorial_bounced(n - 1, ...)`, it returns `lambda: factorial_bounced(n - 1, ...)`
  — a tiny anonymous function that, when called with no arguments, *will*
  make that next call. Returning this instead of calling it directly means
  the current stack frame gets to exit (return) *before* the next call ever
  happens.
- `trampoline` is the driving loop. It calls `bouncing_function(*args)` once
  to get things started. Then, as long as what comes back is itself
  `callable()` (a lambda, in our case, rather than a plain number), it keeps
  calling that thing and replacing `result` with whatever comes back next.
- The loop only stops once `result` is a real value (an `int`, not a
  callable) — that's your final answer.
- Stack depth stays **constant** throughout, because each `lambda` call
  happens fresh from inside `trampoline`'s loop, not nested inside the
  previous call's frame. This is the manual equivalent of what a real TCO
  implementation would do automatically.

### Exploration checkpoint — watch the stack actually stay flat

Copy this file to `trampoline_explore.py`. Add `import traceback` and, inside
`trampoline`'s loop, print `len(traceback.extract_stack())` each iteration.
Compare that against printing the same thing inside plain, non-trampolined
`factorial_tail` at a few different values of `n` (you'll need to temporarily
add the same print there). Confirm the trampolined version's stack depth
stays flat while the plain recursive version's grows with `n`. Come back here
once you've seen the difference.

---

## Challenge — Trampoline a genuine tail-recursive sum

Naive recursive list-summing isn't tail recursive as usually written:

```python
def sum_list(numbers):
    if not numbers:
        return 0
    return numbers[0] + sum_list(numbers[1:])   # addition happens AFTER the call
```

**Your task, in two steps:**
1. Rewrite `sum_list` in tail-recursive form using the accumulator-passing
   trick from Part 1 (`sum_list_tail(numbers, accumulator=0)`).
2. Convert *that* into a trampolined version (`sum_list_bounced`), following
   `factorial_bounced`'s pattern, and confirm it can sum a list of 5,000+
   numbers without hitting `RecursionError`, while the plain recursive
   version from above cannot.

**Solution:** see `lesson-05-solution.md`.

---

## Part 3 — Space optimization: you don't always need the whole table

Go back to Lesson 4's grid DP. The tabulated version stores the **entire**
`rows × cols` grid — but look closely at the recurrence:
`grid[row][col]` only ever depends on `grid[row-1][col]` and
`grid[row][col-1]` — the row directly above, and the current row so far.
**You never look further back than one row.** That means you never actually
need to keep old rows around at all.

```python
def paths_to_grid(rows, cols):
    previous_row = [1] * cols   # row 0: every cell reachable exactly 1 way
    for row in range(1, rows):
        current_row = [1]       # column 0 of every row: always 1 way (straight down)
        for col in range(1, cols):
            current_row.append(previous_row[col] + current_row[col - 1])
        previous_row = current_row   # this row becomes "previous" for the next iteration
    return previous_row[cols - 1]

print(paths_to_grid(3, 3))   # 6, same answer as Lesson 4's paths_to(2, 2)
```

This drops memory use from `O(rows × cols)` down to `O(cols)` — you're
storing two rows' worth of data at any moment (`previous_row` and
`current_row`), never the whole grid. For a huge grid, this is the
difference between a program that runs and one that doesn't fit in memory at
all.

### Exploration checkpoint — apply this to minimum-cost paths

Copy this file to `space_optimized_explore.py` and rewrite Lesson 4's
`min_cost_path` the same way — a two-row rolling version instead of the full
memoized recursive version. You'll need to convert from top-down recursion to
bottom-up tabulation first (same shift as Lesson 2's `fib` →
`fib_tabulated`), *then* apply the rolling-row trick on top of that. Confirm
it gives the same answer (`7`) as before, using far less memory for a large
grid.

---

## Part 4 — What this costs you, concretely (a complexity recap)

| Version | Time | Space |
|---|---|---|
| Naive recursive `fib` | exponential | `O(n)` (call stack depth) |
| Memoized `fib` (Lesson 2) | `O(n)` | `O(n)` (cache) + `O(n)` (call stack) |
| Tabulated `fib_tabulated` | `O(n)` | `O(n)` (full list) |
| Rolling-variables `fib` (last-two-values only) | `O(n)` | `O(1)` |
| Full grid DP (Lesson 4) | `O(rows × cols)` | `O(rows × cols)` |
| Rolling-row grid DP (this lesson) | `O(rows × cols)` | `O(cols)` |

Notice: the *time* complexity doesn't change at all between the last two
grid rows — you're not doing less work, you're storing less of it at once.
That distinction (time vs. space, independently) is worth sitting with; it's
easy to conflate "faster" with "uses less memory," and they're genuinely
separate axes.

---

## Go further, once this is solid

You now have real footing for the more specialized DP optimizations used in
competitive programming and some research contexts — worth searching once
the above is comfortable, not before:
- **Divide-and-conquer optimization** — restructuring certain DP recurrences
  to run in `O(n log n)` instead of `O(n²)` when the "best choice" has a
  monotonicity property.
- **Monotonic deque optimization** — using a deque to keep sliding-window DP
  transitions at `O(n)` instead of `O(n·k)`.
- **Matrix exponentiation for linear recurrences** — computing something like
  `fib(n)` for enormous `n` (billions) in `O(log n)` by expressing the
  recurrence as a matrix power.
- **Bitmask DP** — using an integer's bits as a compact representation of
  "which subset of items has been used so far," common in problems like the
  traveling salesman problem.

---

**Next: Lesson 6** opens Phase B — the same recursive, cached (or now,
space-optimized) structure gets relabeled as "states," "actions," and
"rewards," the vocabulary bridge to value iteration and the Bellman equation.
