# Lesson 11.4: Ranges Pipelines

*Phase 11 — Functional-Style C++*

---

## The verbosity Lesson 11.3 promised to fix

```cpp
std::vector<int> evens;
std::copy_if(numbers.begin(), numbers.end(), std::back_inserter(evens),
    [](int x) { return x % 2 == 0; });

std::vector<int> doubled(evens.size());
std::transform(evens.begin(), evens.end(), doubled.begin(),
    [](int x) { return x * 2; });

int total = std::accumulate(doubled.begin(), doubled.end(), 0);
```

Three separate algorithm calls, two named intermediate containers (`evens`, `doubled`) that exist purely as scaffolding, holding no meaning of their own beyond "the data partway through being processed." C++20's **ranges** library, in `<ranges>`, exists specifically to eliminate this scaffolding.

## The same computation, as a pipeline

```cpp
#include <ranges>
#include <numeric>

namespace views = std::views;

auto result = numbers
    | views::filter([](int x) { return x % 2 == 0; })
    | views::transform([](int x) { return x * 2; });

int total = std::accumulate(result.begin(), result.end(), 0);
```

The `|` operator (yes, ordinary bitwise-or, overloaded — Lesson 2.7's mechanism, again, for a strikingly different, genuinely readable purpose) chains operations left to right, each one transforming the *view* of the data rather than producing a new, separately-stored container. Read the pipeline exactly as written, top to bottom: start with `numbers`, keep only the evens, then double what's left. No `evens`, no `doubled` — the intent reads directly off the code, matching Python's `[x * 2 for x in numbers if x % 2 == 0]` far more closely than Lesson 11.3's three-call version did.

## Lazy evaluation — the genuinely important mechanism underneath

Here's the detail that makes ranges more than syntax sugar, worth understanding precisely. `numbers | views::filter(...) | views::transform(...)` does **not** immediately compute a new, fully-materialized sequence of doubled even numbers. It produces a **view** — a lightweight object describing *how* to compute each element, on demand, only when something actually asks for it (like `std::accumulate` iterating through `result`). This is called **lazy evaluation**, and it stands in direct, deliberate contrast to Lesson 11.3's eager `std::copy_if`/`std::transform`, which fully compute and store `evens`, then fully compute and store `doubled`, before `std::accumulate` ever runs at all.

```cpp
auto result = numbers
    | views::filter([](int x) {
        std::cout << "checking " << x << std::endl;   // add a print to OBSERVE when this actually runs
        return x % 2 == 0;
    })
    | views::transform([](int x) { return x * 2; });

std::cout << "pipeline constructed — nothing printed yet" << std::endl;

for (int v : result) {   // THIS is when the filter lambda actually starts running, one element at a time
    std::cout << "got: " << v << std::endl;
}
```

Run this and watch the output order closely: "pipeline constructed" prints *before* any "checking..." messages, direct, observable proof that building the pipeline didn't do any real work — only iterating over `result` triggers the filter and transform lambdas, and it does so **one element at a time**, interleaved with the consuming loop, rather than computing an entire intermediate `evens` vector up front. This is a genuinely different execution model from Lesson 11.3's algorithms, worth contrasting precisely rather than treating as an implementation detail: eager evaluation does all the filtering, then all the transforming, in two separate full passes, materializing a real vector in between; lazy evaluation interleaves filtering and transforming, one element at a time, materializing nothing extra at all.

## Why laziness can matter for real performance, not just elegance

```cpp
auto result = hugeVector
    | views::filter([](int x) { return x % 2 == 0; })
    | views::transform([](int x) { return x * 2; })
    | views::take(5);   // only want the FIRST 5 results

for (int v : result) {
    std::cout << v << std::endl;
}
```

`views::take(5)` asks for only the first 5 elements of the pipeline's output. With lazy evaluation, the pipeline processes `hugeVector` element by element and **stops the instant 5 results have been produced** — it never touches the rest of `hugeVector` at all, however large it is. The eager, Lesson 11.3-style equivalent would have to fully filter and fully transform the *entire* `hugeVector` first, producing two complete intermediate containers, before finally taking just the first 5 elements from the end result — genuinely wasted work, potentially a huge amount of it, for a large enough `hugeVector`. This is a real, measurable advantage, not merely a stylistic one — lazy pipelines can do meaningfully less total work than the equivalent eager code when only part of the output is actually needed.

## Comparing directly against Python's generator expressions

```python
result = (x * 2 for x in numbers if x % 2 == 0)   # a GENERATOR — also lazy!
first_five = list(itertools.islice(result, 5))     # also only computes what's needed
```

Python's generator expressions (parentheses, not square brackets — a genuinely important distinction from list comprehensions) are *also* lazy, for the identical underlying reason: they compute each element on demand rather than materializing a full list up front. C++'s ranges pipelines are, conceptually, the direct equivalent of Python generator expressions — a fact worth stating plainly, since it closes a loop this curriculum opened all the way back at Lesson 0.5: Python's comprehension syntax and C++'s range-based for loop have looked similar since day one; ranges pipelines are where the *lazy, composable, chainable* side of Python's iteration model finally gets a genuine, first-class C++ equivalent too.

## Try it yourself

**1. Build the filter-then-transform pipeline above, and confirm it produces the same numeric results as Lesson 11.3's three-call, eagerly-evaluated version**, on the same input data.

**2. Add the print-inside-the-lambda instrumentation from this lesson and confirm, directly, that construction and iteration are genuinely separate events** — that nothing runs until the consuming loop actually starts pulling elements.

**3. Build the `views::take(5)` example on a large vector (a million elements) with a print statement inside the filter lambda, and count how many times the print statement actually fires.** It should be a small number, related to finding the first 5 matching elements, not a million — direct, measured proof of the "stops early" claim.

**4. Chain a third operation into a pipeline** — say, `views::filter(...) | views::transform(...) | views::reverse` (if your standard library/compiler version supports it; ranges support varies somewhat by compiler and version, worth checking directly rather than assuming universal availability) — and confirm the combined pipeline still reads clearly, top to bottom, as a description of the transformation being applied.

**5. Rewrite the comparison exercise (once you're comfortable with the mechanism): pick any earlier phase's data-processing task — Phase 0's word counter, Phase 8's category-deduplication project — and reimplement its core logic as a ranges pipeline**, comparing the result against the original imperative version for both correctness and readability.

## What this cost / bought us

| | Eager STL algorithms (Lesson 11.3) | Ranges pipelines (this lesson) |
|---|---|---|
| Intermediate containers | Named, fully materialized, one per step | None — views compute on demand |
| Evaluation timing | Immediate — each call fully runs before the next begins | Lazy — nothing runs until the result is actually consumed |
| Readability for a multi-step transformation | Verbose — a named variable per step | Reads as one continuous description, closer to natural language |
| Work done when only part of the output is needed | Full — processes everything regardless | Can stop early (`views::take`), doing genuinely less work |
| Python equivalent | List comprehension (eager) | **Generator expression (lazy)** |
| Availability | Universally available, any C++11 compiler | Requires C++20 and reasonably current compiler/standard-library support |

This lesson closes the loop this curriculum opened in Lesson 0.5, where a Python `for i in range(5)` and a C++ range-based for loop first looked deceptively similar. Twenty-plus weeks later, ranges pipelines are where that early resemblance becomes a genuine, mechanistic equivalence — not just similar syntax, but the identical underlying idea (lazy, composable, on-demand computation) expressed in both languages, once you have the full apparatus (iterators, lambdas, templates) this curriculum has spent this entire time building up to support it.

---

**Comparison project: take one real task — "average the JSON records where field X > threshold" — and implement it four ways: raw loop, STL algorithms, ranges pipeline, and a Python one-liner, side by side.** This closes out Phase 11.
