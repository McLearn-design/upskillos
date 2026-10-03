---
title: 2 — vector, list and deque: the Cost of Memory
track: Data Structures and Algorithms, Measured
runtime: cpp
reference: optional
console: true
---

Big-O counts steps. But a step isn't a fixed amount of time: reading a value that's already in the CPU's cache takes about a nanosecond, and reading one from main memory can take a hundred. This lesson races three standard containers and finds that **where data lives in memory** can matter more than the step count.

| Container | Layout | Insert in the middle | Reach element i |
|---|---|---|---|
| `std::vector` | one contiguous block | O(n): shift everything after it | O(1) |
| `std::list` | separate nodes, linked by pointers | O(1), once you're there | O(n): follow i links |
| `std::deque` | a row of fixed-size blocks | O(n) | O(1) |

On paper, `std::list` should win any job that inserts in the middle. You'll test that claim.

## Step 1 — The test framework

**This step: create the supplied `testing/studio_test.hpp`.**

This lesson tests the helpers before racing them, so the track needs its test framework.

It's the same small framework as in *C++ Foundations*: `TEST(name)`, `CHECK`, `CHECK_EQ`, `CHECK_NEAR` and `CHECK_THROWS`, with GoogleTest-style output. Each track's project folder has its own copy.

```cpp file=testing/studio_test.hpp provided
// studio_test.hpp — a deliberately tiny unit-test framework.
//
// It is small enough to read in one sitting (do!), and it prints results in the
// same format as GoogleTest, which you will switch to in a later track.
//
//   TEST(adds_two_numbers) {
//       CHECK_EQ(add(2, 3), 5);
//   }
//
// Macros: CHECK(cond), CHECK_EQ(a, b), CHECK_NE(a, b), CHECK_NEAR(a, b, tolerance),
//         CHECK_THROWS(expression, ExceptionType)
#pragma once

#include <cmath>
#include <exception>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

namespace studio_test {

struct TestCase {
    const char* name;
    void (*body)();
};

// A function-local static is created the first time it is used, which makes it
// safe to register tests from static objects in any translation unit.
inline std::vector<TestCase>& registry()
{
    static std::vector<TestCase> tests;
    return tests;
}

struct Registrar {
    Registrar(const char* name, void (*body)()) { registry().push_back({name, body}); }
};

// Thrown by a failing CHECK; caught by run_all().
struct Failure {
    std::string message;
};

template <typename T>
std::string show(const T& value)
{
    std::ostringstream out;
    out << value;
    return out.str();
}

inline std::string location(const char* file, int line)
{
    return std::string(file) + ":" + std::to_string(line) + ": ";
}

inline int run_all()
{
    auto& tests = registry();
    int failed = 0;
    std::cout << "[==========] Running " << tests.size() << " tests\n";
    for (const auto& test : tests) {
        // std::endl flushes: if this test crashes the program, the output
        // still shows which test was running.
        std::cout << "[ RUN      ] " << test.name << std::endl;
        try {
            test.body();
            std::cout << "[       OK ] " << test.name << '\n';
        } catch (const Failure& f) {
            ++failed;
            std::cout << f.message << '\n' << "[  FAILED  ] " << test.name << '\n';
        } catch (const std::exception& e) {
            ++failed;
            std::cout << "unexpected exception: " << e.what() << '\n' << "[  FAILED  ] " << test.name << '\n';
        } catch (...) {
            ++failed;
            std::cout << "unexpected non-standard exception\n" << "[  FAILED  ] " << test.name << '\n';
        }
    }
    std::cout << "[==========] " << tests.size() << " tests ran, " << (tests.size() - failed) << " passed, " << failed
              << " failed\n";
    return failed == 0 ? 0 : 1;
}

} // namespace studio_test

#define STUDIO_TEST_CONCAT2(a, b) a##b
#define STUDIO_TEST_CONCAT(a, b) STUDIO_TEST_CONCAT2(a, b)

#define TEST(name)                                                                                                   \
    static void STUDIO_TEST_CONCAT(name, _body)();                                                                   \
    static const studio_test::Registrar STUDIO_TEST_CONCAT(name, _registrar)(#name, &STUDIO_TEST_CONCAT(name, _body)); \
    static void STUDIO_TEST_CONCAT(name, _body)()

#define CHECK(cond)                                                                                     \
    do {                                                                                                \
        if (!(cond))                                                                                    \
            throw studio_test::Failure{studio_test::location(__FILE__, __LINE__) + "CHECK(" #cond ") failed"}; \
    } while (false)

#define STUDIO_TEST_BINARY(a, b, op, name)                                                                     \
    do {                                                                                                     \
        const auto& studio_left = (a);                                                                       \
        const auto& studio_right = (b);                                                                      \
        if (!(studio_left op studio_right))                                                                  \
            throw studio_test::Failure{studio_test::location(__FILE__, __LINE__) + name "(" #a ", " #b ") failed\n" \
                                       "    left:  " + studio_test::show(studio_left) + "\n"                \
                                       "    right: " + studio_test::show(studio_right)};                    \
    } while (false)

#define CHECK_EQ(a, b) STUDIO_TEST_BINARY(a, b, ==, "CHECK_EQ")
#define CHECK_NE(a, b) STUDIO_TEST_BINARY(a, b, !=, "CHECK_NE")

#define CHECK_NEAR(a, b, tolerance)                                                                              \
    do {                                                                                                       \
        const double studio_left = (a);                                                                        \
        const double studio_right = (b);                                                                       \
        if (!(std::fabs(studio_left - studio_right) <= (tolerance)))                                           \
            throw studio_test::Failure{studio_test::location(__FILE__, __LINE__) + "CHECK_NEAR(" #a ", " #b ") failed\n" \
                                       "    left:  " + studio_test::show(studio_left) + "\n"                  \
                                       "    right: " + studio_test::show(studio_right)};                      \
    } while (false)

#define CHECK_THROWS(expression, ExceptionType)                                                                 \
    do {                                                                                                      \
        bool studio_threw = false;                                                                            \
        try {                                                                                                 \
            (void)(expression);                                                                               \
        } catch (const ExceptionType&) {                                                                      \
            studio_threw = true;                                                                              \
        }                                                                                                     \
        if (!studio_threw)                                                                                    \
            throw studio_test::Failure{studio_test::location(__FILE__, __LINE__) + "CHECK_THROWS(" #expression \
                                       ", " #ExceptionType ") failed: nothing was thrown"};                   \
    } while (false)
```

```check
file testing/studio_test.hpp
```

## Step 2 — The test runner

**This step: create the supplied `testing/test_main.cpp`.**

The test program's `main`: it runs every registered test and exits with `0` only if all of them passed.

```cpp file=testing/test_main.cpp provided
// The test program's entry point. Every TEST(...) in the other test files has
// already registered itself by the time main() runs.
#include "studio_test.hpp"

int main()
{
    return studio_test::run_all();
}
```

```check
file testing/test_main.cpp
```

## Step 3 — The specification

**This step: create the supplied `containers/tests/sorted_test.cpp` and read it.**

The race needs two helpers in `containers/sorted.h`, which you'll write:

- `insert_sorted(c, value)` inserts into an already-sorted container so that it stays sorted.
- `sum(c)` adds up every element.

They're **templates**: one definition that works for `std::vector<int>`, `std::list<int>` and `std::deque<int>`. The tests check all three.

Look at `as_vector`: it copies any container into a vector so the tests can compare results with `==`. A `std::list` can't be compared directly with a `std::vector`.

```cpp file=containers/tests/sorted_test.cpp provided
// Provided by the lesson: what insert_sorted and sum must do.
#include "studio_test.hpp"

#include <deque>
#include <list>
#include <vector>

#include "sorted.h"

// Copies any container into a vector, so results can be compared with ==.
template <typename Container>
std::vector<int> as_vector(const Container& c)
{
    return std::vector<int>(c.begin(), c.end());
}

// Inserts the same values into any container type.
template <typename Container>
Container insert_all(std::vector<int> values)
{
    Container c;
    for (int v : values)
        insert_sorted(c, v);
    return c;
}

TEST(insert_into_empty_vector)
{
    std::vector<int> v;
    insert_sorted(v, 7);
    CHECK(as_vector(v) == std::vector<int>{7});
}

TEST(vector_stays_sorted)
{
    auto v = insert_all<std::vector<int>>({5, 1, 4, 1, 3});
    CHECK(as_vector(v) == (std::vector<int>{1, 1, 3, 4, 5}));
}

TEST(list_stays_sorted)
{
    auto l = insert_all<std::list<int>>({5, 1, 4, 1, 3});
    CHECK(as_vector(l) == (std::vector<int>{1, 1, 3, 4, 5}));
}

TEST(deque_stays_sorted)
{
    auto d = insert_all<std::deque<int>>({5, 1, 4, 1, 3});
    CHECK(as_vector(d) == (std::vector<int>{1, 1, 3, 4, 5}));
}

TEST(inserts_at_both_ends)
{
    auto v = insert_all<std::vector<int>>({10, 20, 5, 30});
    CHECK(as_vector(v) == (std::vector<int>{5, 10, 20, 30}));
}

TEST(sum_of_each_container)
{
    std::vector<int> v{1, 2, 3};
    std::list<int> l{1, 2, 3};
    std::deque<int> d{1, 2, 3};
    CHECK_EQ(sum(v), 6);
    CHECK_EQ(sum(l), 6);
    CHECK_EQ(sum(d), 6);
    CHECK_EQ(sum(std::vector<int>{}), 0);
}
```

```check
file containers/tests/sorted_test.cpp
```

## Step 4 — The race, and a prediction

**This step: create the supplied `containers/main.cpp`, read it, and write down your predictions.**

It runs two races, each with all three containers:

1. **Insert 5,000 random values one at a time, keeping the container sorted.** Each insert walks from the front to the right position, then inserts there.
2. **Add up a million sorted values**: a simple walk from start to end.

`std::mt19937` is a random number generator whose sequence the C++ standard fixes exactly, so every run, on every compiler, races on the same data.

**Predict:** in race 1, a list insert is O(1) once you've found the place, while a vector insert has to shift on average 2,500 elements along. Which container wins? In race 2 every container does the same million additions. Will they take about the same time?

```cpp file=containers/main.cpp provided
// Races std::vector, std::list and std::deque at two jobs.
#include <algorithm>
#include <cstdint>
#include <deque>
#include <iomanip>
#include <iostream>
#include <list>
#include <random>
#include <string>
#include <vector>

#include "bench.h"
#include "sorted.h"

// n pseudo-random numbers. std::mt19937 gives the same sequence on
// every compiler, so every run races on the same data.
std::vector<int> random_values(int n)
{
    std::mt19937 rng(42);
    std::vector<int> values;
    for (int i = 0; i < n; ++i)
        values.push_back(static_cast<int>(rng() % 1'000'000));
    return values;
}

template <typename Container>
Container build_sorted(const std::vector<int>& values)
{
    Container c;
    for (int v : values)
        insert_sorted(c, v);
    return c;
}

void row(const std::string& name, double ms)
{
    std::cout << "  " << std::left << std::setw(8) << name << std::right
              << std::fixed << std::setprecision(2) << std::setw(10) << ms
              << " ms\n";
}

int main()
{
    // Race 1: keep a sequence sorted while inserting values one by one.
    const std::vector<int> values = random_values(5000);
    std::cout << "Race 1: insert " << values.size()
              << " values, keeping them sorted\n";
    row("vector", bench::median_ns([&] {
        bench::keep(build_sorted<std::vector<int>>(values).size());
    }, 5) / 1e6);
    row("list", bench::median_ns([&] {
        bench::keep(build_sorted<std::list<int>>(values).size());
    }, 5) / 1e6);
    row("deque", bench::median_ns([&] {
        bench::keep(build_sorted<std::deque<int>>(values).size());
    }, 5) / 1e6);

    auto v = build_sorted<std::vector<int>>(values);
    auto l = build_sorted<std::list<int>>(values);
    auto d = build_sorted<std::deque<int>>(values);
    bool same = std::vector<int>(l.begin(), l.end()) == v
                && std::vector<int>(d.begin(), d.end()) == v;
    std::cout << "  all three hold the same " << v.size()
              << " values in order: " << (same ? "yes" : "NO") << "\n\n";

    // Race 2: add up a million sorted values.
    std::vector<int> big = random_values(1'000'000);
    std::list<int> big_list(big.begin(), big.end());
    big_list.sort();   // relinks the nodes: now they are scattered in memory
    std::sort(big.begin(), big.end());
    std::deque<int> big_deque(big.begin(), big.end());
    std::cout << "Race 2: add up " << big.size() << " sorted values\n";
    row("vector", bench::median_ns([&] { bench::keep(sum(big)); }) / 1e6);
    row("list", bench::median_ns([&] { bench::keep(sum(big_list)); }) / 1e6);
    row("deque", bench::median_ns([&] { bench::keep(sum(big_deque)); }) / 1e6);
    bool sums_agree = sum(big) == sum(big_list) && sum(big) == sum(big_deque);
    std::cout << "  all three sums agree: " << (sums_agree ? "yes" : "NO")
              << '\n';
}
```

```check
file containers/main.cpp
```

## Step 5 — The build file

**This step: create the supplied `containers/CMakeLists.txt` and read it.**

It builds two programs: `race` from `main.cpp`, and `sorted_tests` from every `tests/*_test.cpp` file. Two things are new:

```cmake
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()
```

- A **build type** picks the compiler flags. **Release** turns optimisation on (`-O3` with GCC and Clang); **Debug** turns it off and adds debugging information. Lesson 1 showed why benchmarks must use Release.
- If you want a Debug build to step through in the debugger, configure a second folder: `cmake -S containers -B containers/build-debug -DCMAKE_BUILD_TYPE=Debug`.

```cmake
include_directories(. ../bench ../testing)
```

- Every program can include headers from this folder, from `bench/` (the harness from lesson 1) and from `testing/`.

```cmake file=containers/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(containers LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Timings mean nothing without optimisation: build Release unless
# configured with -DCMAKE_BUILD_TYPE=Debug.
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# Warnings for every target below.
if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# This folder, the benchmark harness and the test framework.
include_directories(. ../bench ../testing)

add_executable(race main.cpp)

# Every tests/*_test.cpp file becomes part of the test program.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(sorted_tests ../testing/test_main.cpp ${TEST_SOURCES})
```

```check
file containers/CMakeLists.txt
```

## Step 6 — Write the helpers, then race

**This step: create `containers/sorted.h` with `insert_sorted` and `sum`. Configure, build, run the tests, then run the race.**

```cpp
template <typename Container>
void insert_sorted(Container& c, int value)
{
    auto it = c.begin();
    while (it != c.end() && *it < value)
        ++it;
    c.insert(it, value);
}
```

- `template <typename Container>` lets the compiler write a version of the function for each container type it's used with.
- Template definitions go in the **header**, not a `.cpp` file: the compiler needs the whole definition wherever the template is used.
- `c.insert(it, value)` inserts *before* `it`. Every one of the three containers has it, which is what makes one template work for all of them.
- Start the file with `#pragma once`. `sum` is a simple loop over `c` that adds into a `long long`.

```text
cmake -S containers -B containers/build -G "MinGW Makefiles"     (Windows)
cmake -S containers -B containers/build                          (macOS, Linux)
```

```text
cmake --build containers/build
./containers/build/sorted_tests
./containers/build/race
```

```cpp file=containers/sorted.h
// sorted.h: helpers that work on any sequence container (vector, list, deque).
#pragma once

// Inserts value into c, which is sorted, so that c stays sorted.
// Walks from the front to the first element that isn't smaller.
template <typename Container>
void insert_sorted(Container& c, int value)
{
    auto it = c.begin();
    while (it != c.end() && *it < value)
        ++it;
    c.insert(it, value);
}

// Adds up every element, visiting them in order.
template <typename Container>
long long sum(const Container& c)
{
    long long total = 0;
    for (int x : c)
        total += x;
    return total;
}
```

### What happened

```text
Race 1: insert 5000 values, keeping them sorted
  vector        2.19 ms
  list         28.35 ms
  deque         4.09 ms
Race 2: add up 1000000 sorted values
  vector        0.38 ms
  list         92.44 ms
  deque         0.46 ms
```

The vector won both races, and the list lost race 2 by a factor of more than 200. The reason is the **cache**:

```text
vector: [ 3 | 8 | 12 | 15 | 21 | 30 | ... ]   neighbours in memory

list:   [3]──►[8]──►[12]──►[15]──► ...         each node anywhere
```

- Memory reaches the CPU in **cache lines** of 64 bytes: 16 ints at a time. Walking a vector uses every int of every line it fetches, and the CPU's **prefetcher** sees the pattern and fetches the next lines before they're asked for.
- A list node holds one int plus two pointers, and `big_list.sort()` relinked the nodes, so consecutive values are scattered across memory. Every step is a fresh fetch from main memory, and the prefetcher can't guess the next address until the pointer has arrived.
- In race 1, *finding* the position is O(n) for all three. The vector's "expensive" shifting is one `memmove` of contiguous memory: the fastest operation memory can do.
- `deque` stores elements in contiguous blocks, so it walks almost as fast as a vector.

> **Default to `std::vector`.** Choose another container when you've measured a reason. `std::list` earns its place when you need elements that never move (pointers to them stay valid) or you splice lists together.

```check
file containers/build/CMakeCache.txt label="containers/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build containers/build" -- Templates go in the header: check sorted.h defines insert_sorted and sum, and starts with #pragma once.
tests "./containers/build/sorted_tests" -- insert_sorted walks while *it < value, then inserts before it.
run "./containers/build/race" stdout="all three hold the same 5000 values in order: yes"
run "./containers/build/race" stdout="all three sums agree: yes"
```

## Step 7 — Challenge: prepend

**This step: no code is given. Add a template `prepend(c, value)` to `containers/sorted.h` that inserts `value` at the front of any of the three containers.**

Only `list` and `deque` have `push_front`. `std::vector` doesn't, on purpose: inserting at its front means moving every element, and the standard library avoids making slow operations look cheap. One `insert` call works for all three.

**Predict** (no need to code it, but try it in `main.cpp` if you're curious): to prepend 100,000 values, how does a vector compare with a deque? Which Big-O does each have per prepend?

### Answer

A vector shifts everything on every prepend: O(n) each, O(n²) in total. A deque has room at the front of its first block (or adds a new block), so each prepend is O(1). Here the deque wins by a factor of hundreds: the step count really does matter when the gap is n versus 1.

```cpp file=containers/sorted.h
// sorted.h: helpers that work on any sequence container (vector, list, deque).
#pragma once

// Inserts value into c, which is sorted, so that c stays sorted.
// Walks from the front to the first element that isn't smaller.
template <typename Container>
void insert_sorted(Container& c, int value)
{
    auto it = c.begin();
    while (it != c.end() && *it < value)
        ++it;
    c.insert(it, value);
}

// Adds up every element, visiting them in order.
template <typename Container>
long long sum(const Container& c)
{
    long long total = 0;
    for (int x : c)
        total += x;
    return total;
}

// Inserts value at the front of c.
template <typename Container>
void prepend(Container& c, int value)
{
    c.insert(c.begin(), value);
}
```

```check
matches containers/sorted.h "void\s+prepend\s*\(" label="sorted.h defines prepend"
run "cmake --build containers/build"
```

## Step 8 — Your own tests

**This step: create `containers/tests/prepend_test.cpp` with at least three tests of `prepend`, covering all three container types between them.**

Ideas: prepending to an empty container; several prepends come out in reverse order; prepending keeps the existing elements after the new one.

Unlike `as_vector` in the provided tests, you can compare two containers *of the same type* directly: `CHECK(d == (std::deque<int>{3, 2, 1}));`. The extra parentheses stop the commas inside the braces from splitting the macro's arguments.

Rebuild and run the tests: CMake finds the new file by itself, because of the `tests/*_test.cpp` pattern.

```cpp file=containers/tests/prepend_test.cpp
// My tests for prepend.
#include "studio_test.hpp"

#include <deque>
#include <list>
#include <vector>

#include "sorted.h"

TEST(prepend_to_an_empty_vector)
{
    std::vector<int> v;
    prepend(v, 4);
    CHECK(v == std::vector<int>{4});
}

TEST(prepend_puts_values_in_reverse_order)
{
    std::deque<int> d;
    for (int x : {1, 2, 3})
        prepend(d, x);
    CHECK(d == (std::deque<int>{3, 2, 1}));
}

TEST(prepend_keeps_what_was_there)
{
    std::list<int> l{8, 9};
    prepend(l, 7);
    CHECK(l == (std::list<int>{7, 8, 9}));
}
```

```check
matches containers/tests/prepend_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="prepend_test.cpp has at least three tests"
contains containers/tests/prepend_test.cpp "prepend("
run "cmake --build containers/build"
tests "./containers/build/sorted_tests"
```
