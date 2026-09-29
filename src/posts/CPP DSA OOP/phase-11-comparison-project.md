# Phase 11 Comparison Project: One Task, Four Ways

*"Average the JSON records where field X > threshold" — raw loop, STL algorithms, ranges pipeline, and a Python one-liner, side by side.*

---

## The task

Using Phase 5's `people.json` (name/age records, loaded via `nlohmann::json`): **compute the average age of everyone over 30.** One well-defined computation, implemented four genuinely different ways, using every tool this phase and this curriculum has built.

## Setup — shared across all four versions

```cpp
#include <fstream>
#include <nlohmann/json.hpp>
#include <vector>
#include <string>

struct Person {
    std::string name;
    int age;
};

std::vector<Person> loadPeople() {
    std::ifstream file("people.json");
    nlohmann::json j;
    file >> j;

    std::vector<Person> people;
    for (const auto& entry : j) {
        people.push_back({entry["name"], entry["age"]});
    }
    return people;
}
```

---

## Version 1: Raw loop

```cpp
double averageOverThresholdLoop(const std::vector<Person>& people, int threshold) {
    int sum = 0;
    int count = 0;

    for (const Person& p : people) {
        if (p.age > threshold) {
            sum += p.age;
            count++;
        }
    }

    if (count == 0) return 0.0;   // avoid division by zero — an easy edge case to forget
    return static_cast<double>(sum) / count;
}
```

The most direct, explicit version — every step visible, nothing hidden behind a library call. This is also the version most exposed to hand-written bugs: an off-by-one in the loop bound, a forgotten `count == 0` check (division by zero, a real, silent bug on some platforms and a crash on others), or an accidental `>=` instead of `>`. Every earlier lesson's caution about hand-rolled loops applies directly here.

## Version 2: STL algorithms (Lesson 11.3)

```cpp
#include <algorithm>
#include <numeric>

double averageOverThresholdSTL(const std::vector<Person>& people, int threshold) {
    std::vector<Person> filtered;
    std::copy_if(people.begin(), people.end(), std::back_inserter(filtered),
        [threshold](const Person& p) { return p.age > threshold; });

    if (filtered.empty()) return 0.0;

    int sum = std::accumulate(filtered.begin(), filtered.end(), 0,
        [](int acc, const Person& p) { return acc + p.age; });

    return static_cast<double>(sum) / filtered.size();
}
```

`std::copy_if` replaces the loop's `if` check; `std::accumulate` replaces the running-total variable, using a custom combining lambda since we're summing a *field* of `Person`, not `Person` objects themselves directly. Notice this version still needs an intermediate named container (`filtered`) — exactly Lesson 11.3's honestly-acknowledged limitation, unresolved until Version 3.

## Version 3: Ranges pipeline (Lesson 11.4)

```cpp
#include <ranges>

double averageOverThresholdRanges(const std::vector<Person>& people, int threshold) {
    namespace views = std::views;

    auto ages = people
        | views::filter([threshold](const Person& p) { return p.age > threshold; })
        | views::transform([](const Person& p) { return p.age; });

    int sum = 0;
    int count = 0;
    for (int age : ages) {
        sum += age;
        count++;
    }

    if (count == 0) return 0.0;
    return static_cast<double>(sum) / count;
}
```

No intermediate `filtered` vector — `ages` is a lazy view, materializing nothing until the final loop actually pulls elements through it. Notice the final loop is still a plain `for`, computing `sum` and `count` together — `std::accumulate` alone can't easily produce *two* running values (a sum and a count) in one pass without a more elaborate accumulator type, so this version pragmatically mixes the ranges pipeline (for the filter+extract step) with a small manual loop (for the two-value reduction) — a genuinely honest reflection of how real code often looks: reach for the library tool where it fits cleanly, and don't force it where a plain loop is actually clearer.

## Version 4: Python one-liner

```python
import json
from statistics import mean

with open("people.json") as f:
    people = json.load(f)

threshold = 30
ages_over_threshold = [p["age"] for p in people if p["age"] > threshold]
average = mean(ages_over_threshold) if ages_over_threshold else 0
```

Or, genuinely as a one-liner, at some cost to readability:

```python
average = (lambda ages: sum(ages) / len(ages) if ages else 0)(
    [p["age"] for p in people if p["age"] > threshold]
)
```

The list comprehension (`[p["age"] for p in people if p["age"] > threshold]`) is doing exactly what Version 3's `filter` + `transform` pipeline does — filter, then extract a field — in one compact expression, no explicit lambda syntax needed for something this simple. This is Python's real, genuine advantage for exactly this kind of small, self-contained data transformation: less ceremony, because the language's whole design assumes this pattern is common enough to deserve dedicated syntax, rather than a composed library.

## Running all four and confirming they agree

```cpp
int main() {
    std::vector<Person> people = loadPeople();
    int threshold = 30;

    std::cout << "loop:   " << averageOverThresholdLoop(people, threshold) << std::endl;
    std::cout << "STL:    " << averageOverThresholdSTL(people, threshold) << std::endl;
    std::cout << "ranges: " << averageOverThresholdRanges(people, threshold) << std::endl;

    return 0;
}
```

All three C++ versions, and the Python version run separately, should produce identical numeric results on the same `people.json`. Confirming this isn't a formality — it's a genuine correctness check across four independently-written implementations of the same logic, and any disagreement would point to a real bug in one of them, worth actually tracking down rather than dismissing as a rounding quirk.

## Try it yourself

**1. Implement and run all four versions against the same `people.json`, and confirm all four produce matching results**, to at least a few decimal places for the numeric comparisons.

**2. Time all three C++ versions against the same, larger dataset (regenerate `people.json` with 100,000 records using Python), using the `<chrono>` technique from Phase 3.** Predict which will be fastest before running — the honest, likely answer is that all three perform comparably, since Lesson 10.3 and 11.3's "zero-cost abstraction" claims predict the STL and ranges versions should compile down to code doing essentially the identical work as the raw loop. Confirm or update your prediction with real measured numbers.

**3. Break the empty-input edge case deliberately.** Set `threshold` to a value higher than every age in the dataset (guaranteeing zero matches) and confirm all three C++ versions correctly return `0.0` rather than crashing or producing garbage from a division by zero — a direct test of whether the `count == 0`/`filtered.empty()` checks were actually necessary (they are; try removing one and observe what happens).

**4. Write a fifth version using Lesson 4's Strategy-pattern comparator idea, generalized: a function that takes the field to filter on and the threshold as parameters, rather than hardcoding "age" and "over."** This is a genuine synthesis exercise, pulling together templates (Phase 10), lambdas (Phase 4 and this phase), and the STL algorithms or ranges approach of your choice, into one reusable, generic "average of records matching a predicate, mapped through a field extractor" function.

## What this cost / bought us

| | Raw loop | STL algorithms | Ranges pipeline | Python |
|---|---|---|---|---|
| Lines of code | Fewest in C++ terms, but most manual | More calls, one intermediate container | Fewest C++ lines with real composability | Shortest overall |
| Intermediate containers | None (single pass) | One (`filtered`) | None — lazy views | One (list comprehension's result) |
| Readability of *intent* | Requires reading the loop body | Names each step (`copy_if`, `accumulate`) | Reads as a pipeline, close to natural language | Very high — dedicated syntax |
| Correctness risk | Highest — everything hand-written | Lower — relies on tested library code | Lower — relies on tested library code | Lowest — dedicated language support for exactly this pattern |
| Performance | Baseline | Comparable (zero-cost abstraction) | Comparable, with early-exit potential (Lesson 11.4) | Meaningfully slower — Phase 3's entire interpreted-vs-compiled lesson, still true |

This closing comparison is a fitting summary for the whole phase, and arguably for large parts of the whole curriculum: **C++ can express nearly every one of Python's convenient, high-level patterns — it typically requires more explicit ceremony to get there, and it pays that ceremony back with compiled speed and static-type safety that Python's version doesn't offer.** Neither language is simply "better" — they're optimized for different points on the ceremony-versus-safety-versus-speed spectrum this entire curriculum has been mapping out since Lesson 0.1's very first comparison.

---

**Phase 11 is complete.** Functions as first-class values with three genuinely different passing mechanisms compared honestly, `std::optional`/`std::variant` as compiler-enforced replacements for patterns you'd previously had to maintain by discipline alone, STL algorithms as C++'s `map`/`filter`/`reduce`, and ranges pipelines finally delivering the lazy, composable evaluation model Python's generator expressions have had since early in this curriculum.

**Next up: Phase 12 — Persistence Layer: Files, JSON, XML, CSV, SQLite.** Everything this curriculum has sprinkled in as file-I/O checkpoints — `<fstream>`, JSON parsing — becomes first-class material, tied directly to two new patterns: Repository and Factory.
