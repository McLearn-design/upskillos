# Lesson 11.3: STL Algorithms — `transform`, `filter`/`copy_if`, `accumulate`

*Phase 11 — Functional-Style C++*
*The C++ equivalent of Python's `map`/`filter`/`reduce`/comprehensions.*

---

## The Python anchor, directly

```python
numbers = [1, 2, 3, 4, 5, 6]

doubled = list(map(lambda x: x * 2, numbers))
evens = list(filter(lambda x: x % 2 == 0, numbers))
total = sum(numbers)   # or: from functools import reduce; reduce(lambda a, b: a + b, numbers)

# or, more idiomatically:
doubled = [x * 2 for x in numbers]
evens = [x for x in numbers if x % 2 == 0]
```

C++'s `<algorithm>` header provides genuine, direct equivalents — and because they operate on the iterator interface (Phase 7's Iterator pattern payoff, now paying off a third time), they work on `std::vector`, `std::deque`, your own `BST` from Phase 7, and any other type providing `begin()`/`end()`, uniformly.

## `std::transform` — the `map` equivalent

```cpp
#include <algorithm>
#include <vector>

std::vector<int> numbers = {1, 2, 3, 4, 5, 6};
std::vector<int> doubled(numbers.size());

std::transform(numbers.begin(), numbers.end(), doubled.begin(),
    [](int x) { return x * 2; });
```

`std::transform` takes a source range (`begin`, `end`), a destination iterator (`doubled.begin()` — note `doubled` must already have room, via `.resize()` above, or you'd need `std::back_inserter`, shown below), and a lambda applied to each element. This is a direct structural translation of `map(lambda x: x * 2, numbers)`, using iterators instead of Python's implicit sequence protocol.

## `std::copy_if` — the `filter` equivalent

```cpp
#include <iterator>

std::vector<int> evens;
std::copy_if(numbers.begin(), numbers.end(), std::back_inserter(evens),
    [](int x) { return x % 2 == 0; });
```

`std::back_inserter(evens)` is worth understanding precisely rather than treating as magic incantation: it's a special iterator adapter that, instead of writing to an existing slot, calls `evens.push_back(...)` every time something is written *through* it — exactly the mechanism that lets `std::copy_if` grow the destination container as it goes, rather than requiring you to pre-size it the way `std::transform`'s example above did. This is itself a small, elegant application of the Iterator pattern (Phase 7): `back_inserter` returns an object satisfying the iterator interface's `*`/`++` requirements, but its `operator*` and `operator++` are implemented to trigger a `push_back` rather than to navigate real stored data — an iterator whose entire job is side effects, not traversal.

## `std::accumulate` — the `reduce`/`sum` equivalent

```cpp
#include <numeric>   // NOTE: a different header than <algorithm>

int total = std::accumulate(numbers.begin(), numbers.end(), 0);   // 0 is the starting value

int product = std::accumulate(numbers.begin(), numbers.end(), 1,
    [](int acc, int x) { return acc * x; });   // custom combining operation, like reduce's second argument
```

The three-argument form (`begin`, `end`, starting value) directly matches Python's `sum()`. The four-argument form, with a custom combining lambda, directly matches `functools.reduce(lambda acc, x: acc * x, numbers, 1)` — same shape, same idea, C++ requiring the include and the explicit starting value up front rather than inferring one.

## Chaining these together — reading it as a pipeline

```cpp
std::vector<int> numbers = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

std::vector<int> evens;
std::copy_if(numbers.begin(), numbers.end(), std::back_inserter(evens),
    [](int x) { return x % 2 == 0; });

std::vector<int> doubled(evens.size());
std::transform(evens.begin(), evens.end(), doubled.begin(),
    [](int x) { return x * 2; });

int total = std::accumulate(doubled.begin(), doubled.end(), 0);

std::cout << "total: " << total << std::endl;   // sum of doubled even numbers
```

This is the direct equivalent of Python's `sum(x * 2 for x in numbers if x % 2 == 0)` — three explicit, separate steps in C++ versus one compact generator expression in Python. Worth being honest about the comparison rather than overselling it: **this genuinely is more verbose than Python's version**, each step needing its own named intermediate container and explicit function call. Lesson 11.4's ranges pipelines, arriving next, are C++'s direct answer to exactly this verbosity — this lesson deliberately shows you the "long form" first so the improvement ranges bring is felt rather than assumed.

## Other genuinely useful STL algorithms worth knowing exist

```cpp
#include <algorithm>

bool anyNegative = std::any_of(numbers.begin(), numbers.end(), [](int x) { return x < 0; });
bool allPositive = std::all_of(numbers.begin(), numbers.end(), [](int x) { return x > 0; });
int maxVal = *std::max_element(numbers.begin(), numbers.end());
int countEvens = std::count_if(numbers.begin(), numbers.end(), [](int x) { return x % 2 == 0; });
std::sort(numbers.begin(), numbers.end());   // Lesson 10.2's whole subject, one call
```

This is far from an exhaustive list — `<algorithm>` contains dozens of genuinely useful functions — but the pattern across all of them is identical, and now completely familiar: an iterator range, an optional lambda for customization, one clear job each. Once you've internalized this shape, reaching for a new algorithm you haven't used before mostly means recognizing "this is a `std::transform`-shaped problem" or "this is an `std::accumulate`-shaped problem" and looking up the exact name.

## Why this matters beyond convenience

These aren't just shorter syntax for loops you could write by hand — they carry real, structural advantages worth naming. A hand-written loop can accidentally do the wrong thing (an off-by-one bound, Lesson 10.1's overflow-style bug class); `std::transform` and `std::accumulate` have been correct, tested, optimized code for decades, used by essentially the entire C++ ecosystem, exactly Lesson 3.3's "the standard library earned its reputation" theme, applying here to correctness and clarity rather than raw speed. And because they operate through the iterator interface, they work identically on `std::vector`, `std::deque`, and — genuinely, not hypothetically — your own Phase 7 `BST`, without you writing a single additional line to enable that.

## Try it yourself

**1. Rebuild the "sum of doubled even numbers" pipeline above from scratch, and separately write the equivalent as one hand-rolled `for` loop.** Compare the two versions for readability, and time both on a large dataset using the `<chrono>` technique from Phase 3 — confirm they perform comparably (the STL versions are not inherently slower; they typically compile down to essentially the same machine code as a well-written loop, another instance of Lesson 10.3's zero-cost abstraction principle).

**2. Run the identical pipeline against your own `BST` from Phase 7**, using its `begin()`/`end()` iterator instead of a `std::vector`'s. Confirm `std::copy_if`, `std::transform`, and `std::accumulate` all work correctly, unmodified, against your custom type — direct, satisfying proof that Phase 7's Iterator investment pays off generically, not just for the one example it was originally demonstrated with.

**3. Use `std::any_of` and `std::all_of` to validate a dataset** — for instance, confirm no value in a vector is negative, and that at least one value exceeds some threshold — printing a clear pass/fail message for each check.

**4. Implement your own simplified `myTransform` as a template function**, mirroring `std::transform`'s signature and behavior, using Lesson 10.3's template mechanism directly. This is a genuinely good synthesis exercise: you're not just using generic, iterator-based code anymore, you're writing it, closing the loop on exactly how these library functions are built.

## What this cost / bought us

| | Hand-written loops | STL algorithms (this lesson) |
|---|---|---|
| Correctness risk | Real — off-by-one errors, forgotten edge cases | Low — decades of real-world use and testing |
| Works generically across container types | Only if you write it that way deliberately | Yes, automatically, via the iterator interface |
| Readability for someone who knows the STL | Requires reading the loop's logic to understand intent | The function name states the intent directly (`transform`, `copy_if`, `accumulate`) |
| Performance | Depends entirely on how it's written | Typically comparable to a well-written loop — zero-cost abstraction |
| Python equivalent | A hand-written loop, equally verbose | `map`/`filter`/`reduce`, more compact in Python's syntax |

---

**Next up: Lesson 11.4 — Ranges pipelines.** The direct fix for this lesson's honestly-acknowledged verbosity — chaining these same operations together without the intermediate named containers, C++20's answer to Python's generator expressions.
