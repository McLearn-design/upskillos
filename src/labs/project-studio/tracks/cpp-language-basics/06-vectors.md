---
title: 6 — std::vector and Algorithms: a Grade Book
track: C++ Foundations — Thinking in Types
runtime: cpp
reference: optional
console: true
---

So far your programs handled each number the moment they read it. Many problems need **all** the data first: you can't find a median until you've seen every score. You need a **container**.

`std::vector` is the container you'll use more than all the others put together: a growable sequence of values of one type, stored side by side in memory, that manages its own memory. In this lesson you'll build a grade book in `gradebook/`, and meet the standard library's **algorithms**: tested, optimised functions such as `std::sort` that work on any sequence.

## Step 1 — The project's build file

**This step: create the supplied `gradebook/CMakeLists.txt`.**

The usual shape: a program called `grades`, and a test program called `grades_tests`, both using `grades.cpp`.

```cmake file=gradebook/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(gradebook LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(grades main.cpp grades.cpp)

# Every tests/*_test.cpp file becomes part of the test program.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(grades_tests ../testing/test_main.cpp ${TEST_SOURCES} grades.cpp)
target_include_directories(grades_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)

foreach(target grades grades_tests)
    if(MSVC)
        target_compile_options(${target} PRIVATE /W4)
    else()
        target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic)
    endif()
endforeach()
```

```check
file gradebook/CMakeLists.txt
```

## Step 2 — The interface

**This step: create the supplied `gradebook/grades.h` and read it.**

```cpp file=gradebook/grades.h provided
#pragma once

#include <vector>

// Mean of the scores. Throws std::invalid_argument if there are none.
double average(const std::vector<int>& scores);

// Middle value of the scores (mean of the two middle values for an even count).
// Throws std::invalid_argument if there are none.
double median(std::vector<int> scores);

// Letter grade for each score: 90+ A, 80+ B, 70+ C, 60+ D, otherwise F.
std::vector<char> letter_grades(const std::vector<int>& scores);

// How many scores are at least `threshold`.
int count_at_least(const std::vector<int>& scores, int threshold);
```

- Three of the functions take `const std::vector<int>&`: read-only access to the caller's vector, without copying it.
- `median` takes `std::vector<int>`, **by value**: it gets its own copy. You'll find out why in step 8.

```check
file gradebook/grades.h
```

## Step 3 — An empty implementation file

**This step: create the supplied `gradebook/grades.cpp`.**

It includes the headers you'll need, and nothing else yet. You'll fill it in as the tests arrive.

```cpp file=gradebook/grades.cpp provided
#include "grades.h"

#include <algorithm>
#include <numeric>
#include <stdexcept>

// Your implementations go here.
```

```check
file gradebook/grades.cpp
```

## Step 4 — A list that grows

**This step: create `gradebook/main.cpp`: read scores until the input ends, store them in a vector, and print them back.**

```cpp
#include <vector>

std::vector<int> scores;     // an empty vector of ints
scores.push_back(90);        // append        → {90}
scores.push_back(72);        //               → {90, 72}
scores.size();               // how many      → 2
scores[0];                   // first element → 90 (positions start at 0)
scores.empty();              // is it empty?  → false
```

- `<int>` says what the vector holds. Every element has the same type, and the compiler checks it.
- The vector grows as needed: you never say in advance how big it will be.

For the input `90 72 85`, print:

```text
count: 3
scores: 90 72 85
```

Print the scores with a range-based for loop: `for (int s : scores) std::cout << ' ' << s;`

```text
cmake -S gradebook -B gradebook/build -G "MinGW Makefiles"     (Windows)
cmake -S gradebook -B gradebook/build                          (macOS, Linux)
cmake --build gradebook/build --target grades
```

```cpp file=gradebook/main.cpp
#include <iostream>
#include <vector>

#include "grades.h"

int main()
{
    std::vector<int> scores;
    int score = 0;
    while (std::cin >> score)
        scores.push_back(score);

    std::cout << "count: " << scores.size() << '\n';
    std::cout << "scores:";
    for (int s : scores)
        std::cout << ' ' << s;
    std::cout << '\n';
    return 0;
}
```

```check
contains gradebook/main.cpp "push_back" label="main.cpp appends scores with push_back"
file gradebook/build/CMakeCache.txt label="gradebook/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build gradebook/build --target grades"
run "./gradebook/build/grades" stdin="90 72 85\n" stdout="count: 3\nscores: 90 72 85" -- Read in a while loop, push_back each score, then print them all after the loop.
run "./gradebook/build/grades" stdin="" stdout="count: 0"
```

## Step 5 — The specification for average

**This step: create the supplied `gradebook/tests/average_test.cpp` and read it.**

Notice `average_is_not_integer_division`: the average of 1 and 2 is 1.5, not 1. And an empty list has no average, so it must throw.

```cpp file=gradebook/tests/average_test.cpp provided
// Provided by the lesson.
#include "studio_test.hpp"

#include "grades.h"

#include <stdexcept>

TEST(average_of_several_scores)
{
    CHECK_NEAR(average({90, 72, 85, 55}), 75.5, 1e-9);
}

TEST(average_of_one_score_is_that_score)
{
    CHECK_NEAR(average({42}), 42.0, 1e-9);
}

TEST(average_is_not_integer_division)
{
    CHECK_NEAR(average({1, 2}), 1.5, 1e-9);
}

TEST(average_of_nothing_throws)
{
    CHECK_THROWS(average({}), std::invalid_argument);
}
```

```check
file gradebook/tests/average_test.cpp
```

## Step 6 — Average, with an algorithm

**This step: implement `average` in `gradebook/grades.cpp`.**

You could write the sum loop yourself; you did in lesson 4. The standard library already has it:

```cpp
#include <numeric>

double total = std::accumulate(scores.begin(), scores.end(), 0.0);
```

- `scores.begin()` and `scores.end()` are **iterators**: positions in the sequence. An algorithm takes a **range**: from `begin()` up to, but not including, `end()`. It's the same half-open range as `for (i = 0; i < n; ++i)`. That's how one `std::accumulate` works on vectors, arrays, lists, and anything else with iterators.
- The third argument is the starting value, and **its type is the type of the result**. Start at `0` and you get an `int` sum; start at `0.0` and you get a `double`.
- Divide by `static_cast<double>(scores.size())`.

```cpp file=gradebook/grades.cpp
#include "grades.h"

#include <algorithm>
#include <numeric>
#include <stdexcept>

double average(const std::vector<int>& scores)
{
    if (scores.empty())
        throw std::invalid_argument("average of no scores");
    const double total = std::accumulate(scores.begin(), scores.end(), 0.0);
    return total / static_cast<double>(scores.size());
}
```

```check
run "cmake --build gradebook/build --target grades_tests"
run "./gradebook/build/grades_tests" stdout="[       OK ] average_is_not_integer_division" -- Start accumulate at 0.0, not 0, so the sum is a double.
run "./gradebook/build/grades_tests" stdout="[       OK ] average_of_nothing_throws" -- Check scores.empty() first and throw std::invalid_argument.
run "./gradebook/build/grades_tests" stdout=" passed, 0 failed"
```

## Step 7 — The specification for median

**This step: create the supplied `gradebook/tests/median_test.cpp` and read it.**

Look at `median_does_not_reorder_the_callers_scores`. It passes a vector to `median`, then checks that the vector is still in its original order.

```cpp file=gradebook/tests/median_test.cpp provided
// Provided by the lesson.
#include "studio_test.hpp"

#include "grades.h"

#include <stdexcept>
#include <vector>

TEST(median_of_odd_count_is_middle_value)
{
    CHECK_NEAR(median({90, 55, 72}), 72.0, 1e-9);
}

TEST(median_of_even_count_averages_the_middle_two)
{
    CHECK_NEAR(median({90, 72, 85, 55}), 78.5, 1e-9);
}

TEST(median_does_not_reorder_the_callers_scores)
{
    const std::vector<int> scores {3, 1, 2};
    median(scores);
    CHECK_EQ(scores[0], 3);
    CHECK_EQ(scores[1], 1);
}

TEST(median_of_nothing_throws)
{
    CHECK_THROWS(median({}), std::invalid_argument);
}
```

```check
file gradebook/tests/median_test.cpp
```

## Step 8 — Median: sorting a copy

**This step: implement `median` in `gradebook/grades.cpp`.**

The median is the middle value once the scores are sorted:

```cpp
#include <algorithm>

std::sort(scores.begin(), scores.end());     // ascending, in place
```

With `n` sorted values and `mid = n / 2`:

- odd `n`: the median is `scores[mid]`;
- even `n`: it's the mean of the two middle values, `(scores[mid - 1] + scores[mid]) / 2.0`. Divide by `2.0`, not `2`, or you're back to integer division.

`std::sort` takes about n log n steps: sorting a million scores needs about 20 million comparisons, not a trillion. Choosing a good algorithm matters far more than tuning code. You'll measure this yourself later in the course.

```cpp file=gradebook/grades.cpp
#include "grades.h"

#include <algorithm>
#include <numeric>
#include <stdexcept>

double average(const std::vector<int>& scores)
{
    if (scores.empty())
        throw std::invalid_argument("average of no scores");
    const double total = std::accumulate(scores.begin(), scores.end(), 0.0);
    return total / static_cast<double>(scores.size());
}

double median(std::vector<int> scores)
{
    if (scores.empty())
        throw std::invalid_argument("median of no scores");
    std::sort(scores.begin(), scores.end());
    const std::size_t mid = scores.size() / 2;
    if (scores.size() % 2 == 1)
        return scores[mid];
    return (scores[mid - 1] + scores[mid]) / 2.0;
}
```

```check
run "cmake --build gradebook/build --target grades_tests"
run "./gradebook/build/grades_tests" stdout="[       OK ] median_of_even_count_averages_the_middle_two" -- Even count: the mean of positions mid - 1 and mid, divided by 2.0.
run "./gradebook/build/grades_tests" stdout="[       OK ] median_does_not_reorder_the_callers_scores" -- median takes its vector by value: sort that copy.
run "./gradebook/build/grades_tests" stdout=" passed, 0 failed"
```

## Step 9 — Predict: why does median take a copy?

**This step: think it through. No file changes.**

`average` takes `const std::vector<int>&`. `median` takes `std::vector<int>`, by value.

**Predict:** what would go wrong with each of these alternatives for `median`?

1. `const std::vector<int>& scores`
2. `std::vector<int>& scores`

### What happens

1. With `const&`, `std::sort` won't compile: you promised not to modify the vector, and sorting modifies it.
2. With plain `&`, it compiles, and it **re-orders the caller's vector**: a surprising side effect. The test `median_does_not_reorder_the_callers_scores` exists to catch exactly that.

By value is right: median needs a copy it can sort anyway, so taking one costs nothing extra. The rule of thumb:

| The function… | Take it as |
|---|---|
| only reads it | `const T&` |
| needs its own copy anyway | `T` (by value) |
| must change the caller's object | `T&` |

## Step 10 — Challenge: letter grades

**This step: implement `letter_grades` and `count_at_least` in `gradebook/grades.cpp`. No code is given.**

- `letter_grades`: one letter per score: 90 and above `A`, 80+ `B`, 70+ `C`, 60+ `D`, otherwise `F`.
- `count_at_least(scores, threshold)`: how many scores are `>= threshold`.

Try writing `count_at_least` with `std::count_if` and a **lambda**, a small unnamed function written inline:

```cpp
auto is_high = [](int s) { return s >= 90; };                 // a lambda
std::count_if(v.begin(), v.end(), is_high);                   // counts where it returns true

[threshold](int s) { return s >= threshold; }                 // captures threshold from the function around it
```

- `[]` lists what the lambda **captures**: variables from the surrounding code that it can use.
- `std::count_if` returns a count of a wide integer type; convert it with `static_cast<int>`.

```cpp file=gradebook/grades.cpp
#include "grades.h"

#include <algorithm>
#include <numeric>
#include <stdexcept>

double average(const std::vector<int>& scores)
{
    if (scores.empty())
        throw std::invalid_argument("average of no scores");
    const double total = std::accumulate(scores.begin(), scores.end(), 0.0);
    return total / static_cast<double>(scores.size());
}

double median(std::vector<int> scores)
{
    if (scores.empty())
        throw std::invalid_argument("median of no scores");
    std::sort(scores.begin(), scores.end());
    const std::size_t mid = scores.size() / 2;
    if (scores.size() % 2 == 1)
        return scores[mid];
    return (scores[mid - 1] + scores[mid]) / 2.0;
}

std::vector<char> letter_grades(const std::vector<int>& scores)
{
    std::vector<char> grades;
    grades.reserve(scores.size());
    for (int s : scores) {
        if (s >= 90)
            grades.push_back('A');
        else if (s >= 80)
            grades.push_back('B');
        else if (s >= 70)
            grades.push_back('C');
        else if (s >= 60)
            grades.push_back('D');
        else
            grades.push_back('F');
    }
    return grades;
}

int count_at_least(const std::vector<int>& scores, int threshold)
{
    return static_cast<int>(std::count_if(scores.begin(), scores.end(), [threshold](int s) { return s >= threshold; }));
}
```

```check
contains gradebook/grades.cpp "letter_grades"
contains gradebook/grades.cpp "count_at_least"
run "cmake --build gradebook/build --target grades_tests" -- Both definitions must match grades.h exactly.
```

## Step 11 — The full report

**This step: change `gradebook/main.cpp` to print the full report.**

```text
count: 4
average: 75.5
median: 78.5
grades: A C B F
passed: 3
```

- "passed" counts scores of at least 60.
- No scores at all: print `no scores`. Check before calling `average` or `median`, which throw on empty input.

```cpp file=gradebook/main.cpp
#include <iostream>
#include <vector>

#include "grades.h"

int main()
{
    std::vector<int> scores;
    int score = 0;
    while (std::cin >> score)
        scores.push_back(score);

    if (scores.empty()) {
        std::cout << "no scores\n";
        return 0;
    }

    std::cout << "count: " << scores.size() << '\n';
    std::cout << "average: " << average(scores) << '\n';
    std::cout << "median: " << median(scores) << '\n';
    std::cout << "grades:";
    for (char g : letter_grades(scores))
        std::cout << ' ' << g;
    std::cout << '\n';
    std::cout << "passed: " << count_at_least(scores, 60) << '\n';
    return 0;
}
```

```check
run "cmake --build gradebook/build --target grades"
run "./gradebook/build/grades" stdin="90 72 85 55\n" stdout="count: 4\naverage: 75.5\nmedian: 78.5\ngrades: A C B F\npassed: 3"
run "./gradebook/build/grades" stdin="" stdout="no scores" -- Check scores.empty() before calling average or median: they throw on empty input.
```

## Step 12 — The reviewer's tests

**This step: create the supplied `gradebook/tests/report_review_test.cpp`, run the tests, and fix `grades.cpp` if any fail.**

The reviewer tested the boundaries: exactly 90, 89, 80, 79, and so on. Boundaries are where off-by-one mistakes live.

```cpp file=gradebook/tests/report_review_test.cpp provided
// The reviewer's tests for letter_grades and count_at_least. Do not edit them: make them pass.
#include "studio_test.hpp"

#include "grades.h"

#include <vector>

TEST(review_letter_grade_boundaries)
{
    const std::vector<char> g = letter_grades({100, 90, 89, 80, 79, 70, 69, 60, 59, 0});
    const std::vector<char> want {'A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'F', 'F'};
    CHECK_EQ(g.size(), want.size());
    for (std::size_t i = 0; i < want.size(); ++i)
        CHECK_EQ(g[i], want[i]);
}

TEST(review_letter_grades_of_nothing)
{
    CHECK(letter_grades({}).empty());
}

TEST(review_count_at_least)
{
    CHECK_EQ(count_at_least({90, 72, 85, 55}, 80), 2);
    CHECK_EQ(count_at_least({90, 72, 85, 55}, 0), 4);
    CHECK_EQ(count_at_least({90, 72, 85, 55}, 91), 0);
    CHECK_EQ(count_at_least({}, 50), 0);
    CHECK_EQ(count_at_least({50, 50}, 50), 2);
}
```

```check
file gradebook/tests/report_review_test.cpp
run "cmake --build gradebook/build --target grades_tests"
run "./gradebook/build/grades_tests" stdout="[       OK ] review_letter_grade_boundaries" -- 90 is an A and 89 a B: compare with >=, highest grade first.
run "./gradebook/build/grades_tests" stdout=" passed, 0 failed"
```
