---
title: 6 — Ranges, Views and the Standard Algorithms
track: Generic Programming
runtime: cpp
reference: optional
console: true
---

The standard library has over a hundred algorithms: `sort`, `find_if`, `count_if`, `transform`, `accumulate`, `max_element` and many more. A raw loop says *how*; a named algorithm says *what*, and has been tested far more than your loop ever will.

C++20's **ranges** make them easier to use:

```cpp
std::sort(v.begin(), v.end());     // classic: a pair of iterators
std::ranges::sort(v);              // ranges: the whole range
```

and add **views**: lazy pipelines like `v | filter(...) | transform(...)`.

This lesson ends with a project: the grade analyser behind a small report program.

## Step 1 — Views are lazy

**This step: create the supplied `ranges/lazy.cpp`, read it, and predict its output line by line. Then build and run it.**

```text
g++ -std=c++20 -Wall -Wextra ranges/lazy.cpp -o ranges/lazy
./ranges/lazy
```

The pipeline keeps the even numbers, squares them, and takes the first two. The lambdas print each time they're called.

**Predict:** is `pipeline built` printed first, or last? How many times is `is_even` called? `square`?

```cpp file=ranges/lazy.cpp provided
// A pipeline of views. When does each lambda actually run?
#include <iostream>
#include <ranges>
#include <vector>

int main()
{
    std::vector<int> numbers{1, 2, 3, 4, 5, 6, 7, 8};

    auto is_even = [](int n) {
        std::cout << "  is_even(" << n << ")\n";
        return n % 2 == 0;
    };
    auto square = [](int n) {
        std::cout << "  square(" << n << ")\n";
        return n * n;
    };

    auto pipeline = numbers | std::views::filter(is_even)
                            | std::views::transform(square)
                            | std::views::take(2);
    std::cout << "pipeline built\n";

    for (int n : pipeline)
        std::cout << "got " << n << '\n';
}
```

### What happened

```text
pipeline built
  is_even(1)
  is_even(2)
  square(2)
got 4
  is_even(3)
  is_even(4)
  square(4)
got 16
  is_even(5)
  is_even(6)
```

- **Building the pipeline computes nothing.** A view is a small object that remembers the source and the steps. No new vector is made.
- Values are produced **one at a time, on demand**: the loop asks for one, the chain does just enough work to supply it.
- `square` ran twice, not four times: `take(2)` stopped the pipeline.
- But `is_even(5)` and `is_even(6)` did run. After `got 16`, the loop's `++` moves the filter to its next match before `take` notices it's done. Lazy doesn't mean "minimal", and a predicate with side effects can surprise you.

A view also doesn't own its data: `numbers` must outlive `pipeline`, or it dangles like the lambda in lesson 5.

```check
run "g++ -std=c++20 -Wall -Wextra ranges/lazy.cpp -o ranges/lazy"
run "./ranges/lazy" stdout="pipeline built\n  is_even(1)" label="nothing runs until the loop asks"
run "./ranges/lazy" stdout="got 16\n  is_even(5)\n  is_even(6)"
```

## Step 2 — An endless range

**This step: add an endless pipeline to the end of `main`: the first four squares of odd numbers, printed as `odd squares: 1 9 25 49`.**

`std::views::iota(1)` is every integer from 1 upwards, **forever**. With an eager approach (build a vector, then filter it, then square it) that's impossible. With views it's fine, because only what `take` asks for is ever computed:

```cpp
auto odd_squares = std::views::iota(1)
                 | std::views::filter([](int n) { return n % 2 == 1; })
                 | std::views::transform([](int n) { return n * n; })
                 | std::views::take(4);
```

Print `odd squares:`, then each value after a space.

**Order matters.** `iota(1) | take(4) | filter(...)` is something else: the first four integers, *then* the odd ones among them.

The views used in this track: `filter`, `transform`, `take`, `drop`, `iota` and `reverse`, all in `<ranges>`.

```cpp file=ranges/lazy.cpp
// A pipeline of views. When does each lambda actually run?
#include <iostream>
#include <ranges>
#include <vector>

int main()
{
    std::vector<int> numbers{1, 2, 3, 4, 5, 6, 7, 8};

    auto is_even = [](int n) {
        std::cout << "  is_even(" << n << ")\n";
        return n % 2 == 0;
    };
    auto square = [](int n) {
        std::cout << "  square(" << n << ")\n";
        return n * n;
    };

    auto pipeline = numbers | std::views::filter(is_even)
                            | std::views::transform(square)
                            | std::views::take(2);
    std::cout << "pipeline built\n";

    for (int n : pipeline)
        std::cout << "got " << n << '\n';

    // An endless range: only as much is computed as take(4) asks for.
    auto odd_squares = std::views::iota(1)
                     | std::views::filter([](int n) { return n % 2 == 1; })
                     | std::views::transform([](int n) { return n * n; })
                     | std::views::take(4);
    std::cout << "odd squares:";
    for (int n : odd_squares)
        std::cout << ' ' << n;
    std::cout << '\n';
}
```

```check
contains ranges/lazy.cpp "std::views::iota"
run "g++ -std=c++20 -Wall -Wextra ranges/lazy.cpp -o ranges/lazy"
run "./ranges/lazy" stdout="odd squares: 1 9 25 49" -- take(4) goes last: filter and transform first, then take the first four results.
```

## Step 3 — The grade analyser, written with loops

**This step: create the supplied `generic/grades.h` and read it.**

This is a working library for exam results, written the way you might write it after the *Foundations* track: one hand-written loop per question. Each line of input looks like `Ada,maths,91`.

| Function | Answers |
|---|---|
| `parse_result(line)` | a `Result`, or nothing if the line is malformed |
| `average(results, subject)` | the mean score in one subject |
| `passed(results, mark)` | the names of everyone at or above `mark` |
| `count_failing(results, mark)` | how many are below |
| `find_student(results, name)` | the first result for that name |
| `top(results, n)` | the best `n`, highest first, ties in input order |

`std::optional<Result>` is "a `Result`, or nothing". Test it like a bool; reach the value with `*` or `->`.

Look at `top`: a hand-written insertion sort. It works, but it's slow for big inputs, and it took real care to keep equal scores in order.

```cpp file=generic/grades.h provided
#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <vector>

// One line of a results file: "Ada,maths,91".
struct Result {
    std::string name;
    std::string subject;
    int score = 0;
};

// Parses "name,subject,score". Returns nothing if the line is malformed.
inline std::optional<Result> parse_result(const std::string& line)
{
    auto first = line.find(',');
    auto second =
        first == std::string::npos ? first : line.find(',', first + 1);
    if (second == std::string::npos)
        return std::nullopt;
    Result r{line.substr(0, first), line.substr(first + 1, second - first - 1),
             0};
    try {
        std::size_t used = 0;
        std::string score = line.substr(second + 1);
        r.score = std::stoi(score, &used);
        if (used != score.size())
            return std::nullopt;
    } catch (const std::exception&) {
        return std::nullopt;
    }
    if (r.name.empty() || r.subject.empty())
        return std::nullopt;
    return r;
}

// The mean score in one subject, or 0 if nobody took it.
inline double average(const std::vector<Result>& results,
                      const std::string& subject)
{
    int total = 0;
    int count = 0;
    for (const Result& r : results) {
        if (r.subject == subject) {
            total += r.score;
            ++count;
        }
    }
    return count == 0 ? 0.0 : static_cast<double>(total) / count;
}

// The names of everyone who scored at least pass_mark, in input order.
inline std::vector<std::string> passed(const std::vector<Result>& results,
                                       int pass_mark)
{
    std::vector<std::string> names;
    for (const Result& r : results)
        if (r.score >= pass_mark)
            names.push_back(r.name);
    return names;
}

// How many results are below pass_mark.
inline std::size_t count_failing(const std::vector<Result>& results,
                                 int pass_mark)
{
    std::size_t count = 0;
    for (const Result& r : results)
        if (r.score < pass_mark)
            ++count;
    return count;
}

// The first result for this student, if there is one.
inline std::optional<Result> find_student(const std::vector<Result>& results,
                                          const std::string& name)
{
    for (const Result& r : results)
        if (r.name == name)
            return r;
    return std::nullopt;
}

// The n best results, highest score first. Equal scores keep their
// input order.
inline std::vector<Result> top(std::vector<Result> results, std::size_t n)
{
    // Insertion sort, highest first: stable, but slow for big inputs.
    for (std::size_t i = 1; i < results.size(); ++i) {
        Result moving = results[i];
        std::size_t j = i;
        while (j > 0 && results[j - 1].score < moving.score) {
            results[j] = results[j - 1];
            --j;
        }
        results[j] = moving;
    }
    if (results.size() > n)
        results.resize(n);
    return results;
}
```

```check
file generic/grades.h
```

## Step 4 — Tests before the rewrite

**This step: create the supplied `generic/tests/grades_test.cpp`, build, and run the tests. They pass already.**

You're about to rewrite every function. **Refactoring** is changing how code works without changing what it does, and tests that pass *before* the change are how you know you've succeeded: they must still pass afterwards.

```cpp file=generic/tests/grades_test.cpp provided
// Provided by the lesson: what the grade functions must do. They pass
// with the loop version, and must still pass after you rewrite it.
#include "studio_test.hpp"

#include "grades.h"

#include <string>
#include <vector>

namespace {
std::vector<Result> sample()
{
    return {
        {"Ada", "maths", 91},     {"Linus", "maths", 48},
        {"Grace", "physics", 77}, {"Alan", "maths", 75},
        {"Grace", "maths", 91},   {"Edsger", "physics", 39},
    };
}
} // namespace

TEST(parse_reads_a_good_line)
{
    auto r = parse_result("Ada,maths,91");
    CHECK(r.has_value());
    CHECK_EQ(r->name, "Ada");
    CHECK_EQ(r->subject, "maths");
    CHECK_EQ(r->score, 91);
}

TEST(parse_rejects_bad_lines)
{
    CHECK(!parse_result("").has_value());
    CHECK(!parse_result("Ada,maths").has_value());
    CHECK(!parse_result("Ada,maths,lots").has_value());
    CHECK(!parse_result("Ada,maths,9x").has_value());
    CHECK(!parse_result(",maths,50").has_value());
}

TEST(average_is_per_subject)
{
    CHECK_NEAR(average(sample(), "maths"), 76.25, 1e-9);
    CHECK_NEAR(average(sample(), "physics"), 58.0, 1e-9);
}

TEST(average_of_an_unknown_subject_is_zero)
{
    CHECK_NEAR(average(sample(), "art"), 0.0, 1e-9);
}

TEST(passed_lists_names_in_input_order)
{
    CHECK(passed(sample(), 75) ==
          (std::vector<std::string>{"Ada", "Grace", "Alan", "Grace"}));
    CHECK(passed(sample(), 100).empty());
}

TEST(count_failing_counts_scores_below_the_mark)
{
    CHECK_EQ(count_failing(sample(), 50), 2u);
    CHECK_EQ(count_failing(sample(), 0), 0u);
}

TEST(find_student_returns_the_first_match)
{
    auto grace = find_student(sample(), "Grace");
    CHECK(grace.has_value());
    CHECK_EQ(grace->subject, "physics");
    CHECK(!find_student(sample(), "Barbara").has_value());
}

TEST(top_is_highest_first_and_keeps_ties_in_order)
{
    auto best = top(sample(), 3);
    CHECK_EQ(best.size(), 3u);
    CHECK_EQ(best[0].name, "Ada");
    CHECK_EQ(best[1].name, "Grace");
    CHECK_EQ(best[1].subject, "maths");
    CHECK_EQ(best[2].name, "Grace");
    CHECK_EQ(best[2].subject, "physics");
}

TEST(top_of_more_than_there_are_returns_them_all)
{
    CHECK_EQ(top(sample(), 50).size(), 6u);
}
```

```check
file generic/tests/grades_test.cpp
run "cmake --build generic/build"
tests "./generic/build/generic_tests" require="top_is_highest_first_and_keeps_ties_in_order passed_lists_names_in_input_order"
```

## Step 5 — Rewrite with algorithms, views and projections

**This step: rewrite `average`, `passed`, `count_failing`, `find_student` and `top` in `generic/grades.h` with no `for` or `while` loops. The tests must still pass.**

Three tools do almost all the work.

**Projections.** Most `std::ranges` algorithms take an optional last argument: a **projection**, applied to each element before it's looked at. A pointer to a member, like `&Result::score`, works as one:

```cpp
// sort by score, highest first; equal scores keep their order
std::ranges::stable_sort(results, std::ranges::greater{},
                         &Result::score);

// the first Result whose name is name
auto found = std::ranges::find(results, name, &Result::name);
```

No lambda, no hand-written comparison. `stable_sort` keeps equal elements in their original order; plain `sort` doesn't promise to.

**Counting with a predicate:**

```cpp
auto below = [pass_mark](int score) { return score < pass_mark; };
std::ranges::count_if(results, below, &Result::score);
```

**Views, then copying into a vector:**

```cpp
auto at_least = [pass_mark](const Result& r) {
    return r.score >= pass_mark;
};
std::ranges::copy(results | std::views::filter(at_least)
                          | std::views::transform(&Result::name),
                  std::back_inserter(names));
```

`std::back_inserter(names)` is an output iterator that calls `push_back` on `names` for each value written through it.

For `average`, build a view of one subject's scores, count it with `std::ranges::distance`, and add it up with `std::accumulate(scores.begin(), scores.end(), 0)` from `<numeric>`. Return `0.0` if the count is 0.

Headers: `<algorithm>`, `<functional>`, `<iterator>`, `<numeric>` and `<ranges>`. `parse_result` has no loop; leave it as it is.

```cpp file=generic/grades.h
#pragma once

#include <algorithm>
#include <cstddef>
#include <functional>
#include <iterator>
#include <numeric>
#include <optional>
#include <ranges>
#include <string>
#include <vector>

// One line of a results file: "Ada,maths,91".
struct Result {
    std::string name;
    std::string subject;
    int score = 0;
};

// Parses "name,subject,score". Returns nothing if the line is malformed.
inline std::optional<Result> parse_result(const std::string& line)
{
    auto first = line.find(',');
    auto second =
        first == std::string::npos ? first : line.find(',', first + 1);
    if (second == std::string::npos)
        return std::nullopt;
    Result r{line.substr(0, first),
             line.substr(first + 1, second - first - 1), 0};
    try {
        std::size_t used = 0;
        std::string score = line.substr(second + 1);
        r.score = std::stoi(score, &used);
        if (used != score.size())
            return std::nullopt;
    } catch (const std::exception&) {
        return std::nullopt;
    }
    if (r.name.empty() || r.subject.empty())
        return std::nullopt;
    return r;
}

// The mean score in one subject, or 0 if nobody took it.
inline double average(const std::vector<Result>& results,
                      const std::string& subject)
{
    auto in_subject = [&subject](const Result& r) {
        return r.subject == subject;
    };
    auto scores = results | std::views::filter(in_subject)
                          | std::views::transform(&Result::score);
    auto count = std::ranges::distance(scores);
    if (count == 0)
        return 0.0;
    int total = std::accumulate(scores.begin(), scores.end(), 0);
    return static_cast<double>(total) / count;
}

// The names of everyone who scored at least pass_mark, in input order.
inline std::vector<std::string> passed(const std::vector<Result>& results,
                                       int pass_mark)
{
    auto at_least = [pass_mark](const Result& r) {
        return r.score >= pass_mark;
    };
    std::vector<std::string> names;
    std::ranges::copy(results | std::views::filter(at_least)
                              | std::views::transform(&Result::name),
                      std::back_inserter(names));
    return names;
}

// How many results are below pass_mark.
inline std::size_t count_failing(const std::vector<Result>& results,
                                 int pass_mark)
{
    auto below = [pass_mark](int score) { return score < pass_mark; };
    auto count = std::ranges::count_if(results, below, &Result::score);
    return static_cast<std::size_t>(count);
}

// The first result for this student, if there is one.
inline std::optional<Result> find_student(const std::vector<Result>& results,
                                          const std::string& name)
{
    auto found = std::ranges::find(results, name, &Result::name);
    if (found == results.end())
        return std::nullopt;
    return *found;
}

// The n best results, highest score first. Equal scores keep their
// input order.
inline std::vector<Result> top(std::vector<Result> results, std::size_t n)
{
    std::ranges::stable_sort(results, std::ranges::greater{},
                             &Result::score);
    if (results.size() > n)
        results.resize(n);
    return results;
}
```

```check
lacks generic/grades.h "for (" label="no for loops in grades.h"
lacks generic/grades.h "while (" label="no while loops in grades.h"
matches generic/grades.h "&Result::(score|name)" label="grades.h uses a projection"
run "cmake --build generic/build"
tests "./generic/build/generic_tests" require="top_is_highest_first_and_keeps_ties_in_order average_is_per_subject" -- Highest first is std::ranges::greater{}; stable_sort keeps ties in order.
```

## Step 6 — The report program

**This step: create `grades/report.cpp`, a program that reads results from standard input and prints a report. Build it with `g++` and try it.**

```text
g++ -std=c++20 -Wall -Wextra -Igeneric grades/report.cpp -o grades/report
```

`-Igeneric` adds `generic/` to the folders searched by `#include "grades.h"`. The library is header-only, so there's nothing else to compile or link.

Requirements:

- Read lines with `std::getline(std::cin, line)` until the input ends. Drop a trailing `'\r'` first (files saved on Windows end lines with `\r\n`). Keep every line that parses; count the ones that don't.
- Then print the report, using the library's functions with a pass mark of 50:

```text
results: 6 (1 skipped)
maths average: 76.25
failing: 2
passed: Ada Grace Alan Grace
top 3:
  Ada maths 91
  Grace maths 91
  Grace physics 77
```

That's the output for this input. Type it in after starting `./grades/report`, then end the input with **Ctrl+D** (macOS, Linux) or **Ctrl+Z** then Enter (Windows):

```text
Ada,maths,91
Linus,maths,48
not a result
Grace,physics,77
Alan,maths,75
Grace,maths,91
Edsger,physics,39
```

Reading and printing are naturally loops, and that's fine: the *questions* are answered by the library.

```cpp file=grades/report.cpp
// Reads "name,subject,score" lines and prints a short report.
#include "grades.h"

#include <iostream>
#include <string>
#include <vector>

int main()
{
    std::vector<Result> results;
    int skipped = 0;
    std::string line;
    while (std::getline(std::cin, line)) {
        if (!line.empty() && line.back() == '\r') // a file saved on Windows
            line.pop_back();
        if (auto r = parse_result(line))
            results.push_back(*r);
        else
            ++skipped;
    }

    std::cout << "results: " << results.size() << " (" << skipped
              << " skipped)\n";
    std::cout << "maths average: " << average(results, "maths") << '\n';
    std::cout << "failing: " << count_failing(results, 50) << '\n';

    std::cout << "passed:";
    for (const std::string& name : passed(results, 50))
        std::cout << ' ' << name;
    std::cout << '\n';

    std::cout << "top 3:\n";
    for (const Result& r : top(results, 3))
        std::cout << "  " << r.name << ' ' << r.subject << ' ' << r.score
                  << '\n';
}
```

```check
contains grades/report.cpp "grades.h"
run "g++ -std=c++20 -Wall -Wextra -Igeneric grades/report.cpp -o grades/report"
run "./grades/report" stdin="Ada,maths,91\nLinus,maths,48\nnot a result\nGrace,physics,77\nAlan,maths,75\nGrace,maths,91\nEdsger,physics,39\n" stdout="results: 6 (1 skipped)\nmaths average: 76.25\nfailing: 2\npassed: Ada Grace Alan Grace\n" label="the report's summary lines"
run "./grades/report" stdin="Ada,maths,91\nLinus,maths,48\nnot a result\nGrace,physics,77\nAlan,maths,75\nGrace,maths,91\nEdsger,physics,39\n" stdout="top 3:\n  Ada maths 91\n  Grace maths 91\n  Grace physics 77" label="the top 3"
```
