---
title: 3 — Independent Work: GCD and LCM
track: C++ Foundations — Thinking in Types
runtime: cpp
reference: optional
console: true
---

Until now, every step has told you what code to write. This lesson doesn't.

You get **requirements and tests**, and you decide how to meet them. That's the shift from following a tutorial to writing software: the tests say *what* must be true, and the *how* is yours. Both functions go into the calculator's `calc.h` and `calc.cpp`.

The full solutions are under **Full reference file (optional)**. Try properly before you open them: the struggle is where the learning happens.

## Step 1 — The specification arrives as tests

**This step: create the supplied `calculator/tests/gcd_test.cpp` and read every test.**

The **greatest common divisor** of two whole numbers is the largest number that divides both: `gcd(12, 18)` is `6`.

Click **Create provided calculator/tests/gcd_test.cpp** above. Read the tests: they *are* the specification. Notice what they demand beyond the obvious:

- `gcd(0, 7)`: what should zero do?
- `gcd(-12, 18)`: the answer is never negative.
- `gcd(1, 1'000'000'000'000'000'000)`: a loop that counts down one at a time would take years. (The `'` marks are digit separators, allowed in C++14 and later, to make long numbers readable.)

The test program won't link until `gcd` exists. You'll fix that next.

```cpp file=calculator/tests/gcd_test.cpp provided
// Provided by the lesson. Do not edit these tests — make them pass.
#include "studio_test.hpp"

#include "calc.h"

TEST(gcd_of_two_positive_numbers)
{
    CHECK_EQ(gcd(12, 18), 6);
    CHECK_EQ(gcd(18, 12), 6);
}

TEST(gcd_of_coprime_numbers_is_one)
{
    CHECK_EQ(gcd(17, 5), 1);
}

TEST(gcd_with_zero)
{
    CHECK_EQ(gcd(0, 7), 7);
    CHECK_EQ(gcd(7, 0), 7);
    CHECK_EQ(gcd(0, 0), 0);
}

TEST(gcd_is_never_negative)
{
    CHECK_EQ(gcd(-12, 18), 6);
    CHECK_EQ(gcd(12, -18), 6);
    CHECK_EQ(gcd(-12, -18), 6);
}

TEST(gcd_is_fast_for_large_numbers)
{
    // A loop that subtracts or counts down one at a time would take years here.
    CHECK_EQ(gcd(1, 1'000'000'000'000'000'000LL), 1);
    CHECK_EQ(gcd(2'000'000'014LL, 3'000'000'021LL), 1'000'000'007LL);
}
```

```check
file calculator/tests/gcd_test.cpp
```

## Step 2 — Declare gcd

**This step: add the declaration of `gcd` to `calculator/calc.h`.**

```cpp
long long gcd(long long a, long long b);
```

- `long long` is a whole-number type of at least 64 bits: about ±9.2 × 10¹⁸. An `int` (usually 32 bits) tops out around 2.1 billion, too small for the tests' numbers.

```cpp file=calculator/calc.h
#pragma once

double add(double a, double b);
double subtract(double a, double b);
double multiply(double a, double b);
double divide(double a, double b);

long long gcd(long long a, long long b);
```

```check
matches calculator/calc.h "long\s+long\s+gcd\s*\(\s*long\s+long\b[^,]*,\s*long\s+long\b[^)]*\)\s*;" label="calc.h declares long long gcd(long long, long long);"
```

## Step 3 — Implement gcd

**This step: implement `gcd` in `calculator/calc.cpp` so every test in `gcd_test.cpp` passes. No code is given.**

Questions to think through before you type:

1. If a number `d` divides both `a` and `b`, does it also divide the remainder `a % b`? (`%` is the remainder operator: `17 % 5` is `2`.)
2. So how does `gcd(a, b)` relate to `gcd(b, a % b)`? Try it by hand on `gcd(18, 12)`.
3. What is `gcd(a, 0)`? That's where the process stops.
4. What should happen to negative inputs before you start?

Build and run the tests after every small change. A failing test tells you exactly which requirement you haven't met yet.

```cpp file=calculator/calc.cpp
#include "calc.h"

#include <stdexcept>

double add(double a, double b)
{
    return a + b;
}

double subtract(double a, double b)
{
    return a - b;
}

double multiply(double a, double b)
{
    return a * b;
}

double divide(double a, double b)
{
    if (b == 0)
        throw std::invalid_argument("division by zero");
    return a / b;
}

long long gcd(long long a, long long b)
{
    // Euclid's algorithm: gcd(a, b) == gcd(b, a % b), and gcd(a, 0) == a.
    a = a < 0 ? -a : a;
    b = b < 0 ? -b : b;
    while (b != 0) {
        long long remainder = a % b;
        a = b;
        b = remainder;
    }
    return a;
}
```

### Euclid's algorithm

Any number that divides `a` and `b` also divides `a % b`, and the reverse holds too. So `gcd(a, b) = gcd(b, a % b)`, and the numbers shrink fast: `gcd(18, 12) → gcd(12, 6) → gcd(6, 0) = 6`. It takes a few dozen steps even for 18-digit numbers. It's one of the oldest algorithms still in daily use, more than 2,000 years old.

`a < 0 ? -a : a` is the **conditional operator**: if the condition holds, the value is the first expression, otherwise the second.

```check
run "cmake --build calculator/build" -- The definition must match the declaration: long long gcd(long long a, long long b)
tests "./calculator/build/calc_tests" require="gcd_with_zero gcd_is_never_negative gcd_is_fast_for_large_numbers" timeout=20 -- gcd(a, 0) is a, and gcd(0, 0) is 0. Make both inputs non-negative first. Subtracting or counting down one at a time is far too slow. Use the remainder.
```

## Step 4 — Declare lcm

**This step: declare `lcm` in `calculator/calc.h`.**

The **least common multiple** is the smallest non-negative number that both numbers divide: `lcm(4, 6)` is `12`. By convention `lcm(x, 0)` is `0`.

```cpp file=calculator/calc.h
#pragma once

double add(double a, double b);
double subtract(double a, double b);
double multiply(double a, double b);
double divide(double a, double b);

long long gcd(long long a, long long b);
long long lcm(long long a, long long b);
```

```check
matches calculator/calc.h "long\s+long\s+lcm\s*\(\s*long\s+long\b[^,]*,\s*long\s+long\b[^)]*\)\s*;" label="calc.h declares long long lcm(long long, long long);"
```

## Step 5 — Implement lcm

**This step: implement `lcm` in `calculator/calc.cpp`. No tests are given this time.**

A useful fact: `lcm(a, b) × gcd(a, b) = |a × b|`.

Before you write it, think about the edge cases: zero, negative numbers, and two very large numbers whose product doesn't fit in a `long long`, even though their LCM does. In the next step you'll write tests for these cases yourself.

```cpp file=calculator/calc.cpp
#include "calc.h"

#include <stdexcept>

double add(double a, double b)
{
    return a + b;
}

double subtract(double a, double b)
{
    return a - b;
}

double multiply(double a, double b)
{
    return a * b;
}

double divide(double a, double b)
{
    if (b == 0)
        throw std::invalid_argument("division by zero");
    return a / b;
}

long long gcd(long long a, long long b)
{
    // Euclid's algorithm: gcd(a, b) == gcd(b, a % b), and gcd(a, 0) == a.
    a = a < 0 ? -a : a;
    b = b < 0 ? -b : b;
    while (b != 0) {
        long long remainder = a % b;
        a = b;
        b = remainder;
    }
    return a;
}

long long lcm(long long a, long long b)
{
    if (a == 0 || b == 0)
        return 0;
    a = a < 0 ? -a : a;
    b = b < 0 ? -b : b;
    // Divide before multiplying so the intermediate value never exceeds the result.
    return a / gcd(a, b) * b;
}
```

```check
contains calculator/calc.cpp "lcm"
run "cmake --build calculator/build"
tests "./calculator/build/calc_tests"
```

## Step 6 — Write your own tests

**This step: create `calculator/tests/lcm_test.cpp` with at least three tests of `lcm`.**

Use the structure of the other test files. Test what you decided in step 5: an ordinary case, zero, negative numbers. Run them.

```cpp file=calculator/tests/lcm_test.cpp
#include "studio_test.hpp"

#include "calc.h"

TEST(lcm_of_small_numbers)
{
    CHECK_EQ(lcm(4, 6), 12);
}

TEST(lcm_with_zero_is_zero)
{
    CHECK_EQ(lcm(0, 9), 0);
}

TEST(lcm_of_negative_numbers_is_positive)
{
    CHECK_EQ(lcm(-3, 5), 15);
}
```

```check
file calculator/tests/lcm_test.cpp -- The name must end in _test.cpp, in calculator/tests.
matches calculator/tests/lcm_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="lcm_test.cpp has at least three tests"
run "cmake --build calculator/build"
tests "./calculator/build/calc_tests"
```

## Step 7 — The reviewer's tests

**This step: create the supplied `calculator/tests/lcm_review_test.cpp`, run the tests, and fix `lcm` if any of the reviewer's tests fail.**

In a team, your work is reviewed: another engineer tries the cases *they* think matter. Click **Create provided calculator/tests/lcm_review_test.cpp** above, then build and run the tests.

If one fails, don't change the reviewer's test: work out which input your tests didn't cover, and fix `lcm` in `calc.cpp`. A failure in `review_lcm_avoids_needless_overflow` is the classic one: `a * b` can overflow even when the answer fits. Dividing by the GCD *before* multiplying keeps every intermediate value no bigger than the result.

```cpp file=calculator/tests/lcm_review_test.cpp provided
// The reviewer's tests for lcm. Do not edit them: make them pass.
#include "studio_test.hpp"

#include "calc.h"

TEST(review_lcm_basic)
{
    CHECK_EQ(lcm(4, 6), 12);
    CHECK_EQ(lcm(6, 4), 12);
    CHECK_EQ(lcm(7, 5), 35);
    CHECK_EQ(lcm(12, 12), 12);
}

TEST(review_lcm_with_zero)
{
    CHECK_EQ(lcm(0, 5), 0);
    CHECK_EQ(lcm(5, 0), 0);
    CHECK_EQ(lcm(0, 0), 0);
}

TEST(review_lcm_is_never_negative)
{
    CHECK_EQ(lcm(-4, 6), 12);
    CHECK_EQ(lcm(4, -6), 12);
}

TEST(review_lcm_avoids_needless_overflow)
{
    // a * b would overflow long long here, but the answer fits comfortably.
    const long long big = 3'000'000'000'000'000'000LL;
    CHECK_EQ(lcm(big, big), big);
    CHECK_EQ(lcm(big, 2), big);
}
```

```check
file calculator/tests/lcm_review_test.cpp
run "cmake --build calculator/build"
tests "./calculator/build/calc_tests" require="review_lcm_avoids_needless_overflow" -- Multiplying a * b first overflows long long. Divide by gcd(a, b) first. Fix lcm in calc.cpp. Don't edit the reviewer's tests.
```
