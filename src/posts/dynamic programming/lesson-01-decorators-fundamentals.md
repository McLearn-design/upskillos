# Lesson 1 — Decorators From Fundamentals

Before we touch dynamic programming at all, we need a real, general
understanding of decorators — not just enough to build one caching trick.
Decorators show up everywhere in Python (web frameworks, testing tools,
built-in features like `@property`), and they're all the same underlying
mechanism wearing different clothes. This lesson builds that mechanism from
the ground up.

---

## Part 1 — Functions are just values

The whole idea of a decorator rests on one fact: in Python, a function is an
object like any other. It can be assigned to a variable, passed into another
function, and returned out of one. Type this and run it:

```python
def greet():
    return "hello"

say_hi = greet          # no parentheses — we're not calling it, just naming it
print(say_hi)           # <function greet at 0x...> — it's a function object
print(say_hi())         # "hello" — now we call it
```

`greet` and `say_hi` are two names pointing at the *same* function object.
Nothing was copied. This matters because decorators work entirely by
rebinding names to different function objects.

### Passing a function into another function

```python
def call_twice(some_function):
    some_function()
    some_function()

def announce():
    print("Announcing!")

call_twice(announce)
```

`call_twice` never calls `announce` by name directly — it receives whatever
function object is passed in as `some_function`, and calls that. This is the
core shape every decorator uses.

## Part 2 — Returning a function from a function, and closures

A decorator's real job is: take a function in, return a **new, different**
function out. Type this:

```python
def shout(func):
    def wrapper():
        result = func()
        return result.upper()
    return wrapper

def greet():
    return "hello"

loud_greet = shout(greet)
print(loud_greet())   # "HELLO"
print(greet())        # "hello" — original untouched
```

What's happening, mechanically:

- `shout(greet)` runs `shout`'s body once. Inside it, `func` refers to the
  original `greet` function.
- `wrapper` is defined *inside* `shout`. It references `func` from the
  enclosing scope — this is a **closure**: `wrapper` remembers `func` even
  after `shout` has already finished running and returned.
- `shout` returns `wrapper` itself (not the result of calling it) — so
  `loud_greet` is now a function, specifically the `wrapper` function, which
  still has access to the original `greet` via the closure.
- Calling `loud_greet()` runs `wrapper()`, which calls the original `func()`
  and modifies its result before handing it back.

This — a function that wraps another function and returns the wrapped
version — **is** a decorator. Everything else is just syntax convenience.

## Part 3 — The `@` syntax is purely sugar

This:

```python
@shout
def greet():
    return "hello"
```

is **identical** to:

```python
def greet():
    return "hello"

greet = shout(greet)
```

`@shout` above a function definition means: define the function, then
immediately pass it into `shout` and rebind the name to whatever comes back.
Type both versions and confirm `greet()` behaves the same either way.

### Exploration checkpoint — write your own from scratch

Copy this file to `decorators_explore.py`. Without looking back at `shout`,
write a decorator called `add_exclamation` that wraps any zero-argument
function and appends `"!"` to its return value. Apply it with `@` syntax to a
function of your choice. Come back here once it works.

## Part 4 — Handling arguments: `*args` and `**kwargs`

`wrapper` above only works on functions that take zero arguments. Real
functions take arguments of all kinds. Type this:

```python
def logged(func):
    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__} with args={args}, kwargs={kwargs}")
        result = func(*args, **kwargs)
        print(f"{func.__name__} returned {result}")
        return result
    return wrapper

@logged
def add(a, b):
    return a + b

@logged
def describe(name, age=0):
    return f"{name} is {age}"

add(3, 4)
describe("Sam", age=42)
```

- `*args` collects positional arguments into a tuple.
- `**kwargs` collects keyword arguments into a dict.
- `func(*args, **kwargs)` unpacks both back out when calling the real
  function, so this `wrapper` works on **any** function signature, not just
  one specific shape.

This `logged` decorator is a genuinely useful, general-purpose tool — it's
one of the most common real-world uses of decorators: instrumenting a
function's calls without changing the function's own code at all.

## Part 5 — Decorators that take their own arguments

Sometimes you want to configure the decorator itself, e.g. `@repeat(3)` to
run a function three times. This needs one extra layer of nesting:

```python
def repeat(times):
    def decorator(func):
        def wrapper(*args, **kwargs):
            for _ in range(times):
                func(*args, **kwargs)
        return wrapper
    return decorator

@repeat(3)
def say_hello():
    print("Hello!")

say_hello()   # prints "Hello!" three times
```

Trace the layers carefully:

- `repeat(3)` is called first (note the parentheses in `@repeat(3)`) — it
  returns `decorator`, a function that expects a function as its argument.
- `@repeat(3)` above `say_hello` then applies that returned `decorator` to
  `say_hello`, exactly like Part 3.
- So `@repeat(3)` is really `say_hello = repeat(3)(say_hello)` — two function
  calls chained together.

### Exploration checkpoint — a decorator with a configurable argument

Copy this file again and write `@retry(n)`: a decorator that, if the wrapped
function raises an exception, tries calling it again up to `n` times before
giving up and re-raising. This is a real pattern used in production code for
things like flaky network calls. Come back here once you've got something
working, even if it's rough.

## Part 6 — Where decorators actually show up in the wild

This is the part usually skipped, and it's the part that shows you these
aren't just a caching trick:

- **Web frameworks (e.g. Flask):** `@app.route("/users")` above a function
  registers that function to handle requests to `/users`. The decorator
  doesn't wrap the function's *behavior* the way `logged` did — it uses the
  function as a value to store in a lookup table (a dict mapping URL paths to
  handler functions) as a side effect, then typically returns the original
  function completely unchanged. Same mechanism, completely different purpose
  — registration instead of behavior modification.
- **Built-ins `@staticmethod`, `@classmethod`, `@property`:** these change how
  a method behaves when accessed on a class/instance (covered properly once
  you're doing OOP lessons) — again, the same wrap-and-return-a-callable
  mechanism, applied to methods instead of plain functions.
- **Testing frameworks (e.g. pytest fixtures, `@pytest.mark.parametrize`):**
  decorators that attach metadata to a test function, read later by the test
  runner rather than changing what happens when you call the function
  yourself.
- **Caching (`functools.lru_cache`):** the standard library's built-in version
  of the `memoize` idea — same closure-and-cache mechanism you're about to
  build yourself in Lesson 2, just with extra features like a max size limit.

The common thread across all of these: a decorator takes a function object
and does *something* with it — wrap its behavior, register it somewhere,
attach metadata to it — and returns some callable in its place (often, but
not always, a wrapped version of the original).

### One rough edge worth knowing about: `func.__name__`

Run this:

```python
@logged
def add(a, b):
    return a + b

print(add.__name__)
```

You'll get `'wrapper'`, not `'add'` — because `add` now *is* `wrapper`, and
`wrapper` never bothered to say what it's really standing in for. The
standard library fixes this with `functools.wraps`:

```python
import functools

def logged(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper
```

Add `@functools.wraps(func)` to your own `logged` from Part 4, rerun the
`__name__` check, and confirm it now correctly reports `'add'`. This is a
minor detail, but it's the kind of thing that causes confusing bugs later if
you don't know it's happening.

---

## Go further, once this is solid

You now have real footing to look up `functools.lru_cache` (Python's built-in
memoization decorator) and understand what it's doing internally, or to look
at how a real Flask app registers routes with `@app.route`, and recognize the
"function as a value" pattern immediately. Worth a search once you've built
everything above yourself.

**Next: Lesson 2** — you'll use exactly what you built here (a closure that
wraps a function and keeps a cache dict) to solve the Fibonacci slowdown
problem, and then compare it against a completely non-recursive alternative
(tabulation).
