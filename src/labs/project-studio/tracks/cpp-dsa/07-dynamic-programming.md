---
title: 7 — Dynamic Programming: Never Solve the Same Problem Twice
track: Data Structures and Algorithms, Measured
runtime: cpp
reference: optional
console: true
---

Some problems break into smaller problems of the same kind: the answer for 30 is built from the answers for 29 and 28. Recursion expresses that beautifully, and can be catastrophically slow, because the same small problems get solved again and again.

**Dynamic programming** (DP) is the fix: solve each small problem **once** and remember the answer. This lesson counts the calls to see the difference, then uses DP on two classic problems: making change with the fewest coins, and the **edit distance** behind spell checkers and `diff`.

The lesson's files live in `dp/`.

## Step 1 — Count the calls

**This step: create the supplied `dp/fib.cpp`, read it, then build and run it.**

The Fibonacci numbers are 0, 1, 1, 2, 3, 5, 8, …: each is the sum of the two before. The definition turns straight into code:

```cpp
long long fib(int n)
{
    ++calls;
    if (n < 2)
        return n;
    return fib(n - 1) + fib(n - 2);
}
```

**Predict:** `fib(10)` takes 177 calls. How many does `fib(20)` take? `fib(40)`?

```text
g++ -std=c++20 -O2 -Wall -Wextra -Werror dp/fib.cpp -o dp/fib
./dp/fib
```

```cpp file=dp/fib.cpp provided
// How much work does the obvious recursive Fibonacci do?
#include <iostream>

long long calls = 0;   // how many times fib has been called

long long fib(int n)
{
    ++calls;
    if (n < 2)
        return n;
    return fib(n - 1) + fib(n - 2);
}

int main()
{
    for (int n : {10, 20, 30, 40}) {
        calls = 0;
        long long result = fib(n);
        std::cout << "fib(" << n << ") = " << result << " after " << calls
                  << " calls\n";
    }
}
```

### What happened

```text
fib(10) = 55 after 177 calls
fib(20) = 6765 after 21891 calls
fib(30) = 832040 after 2692537 calls
fib(40) = 102334155 after 331160281 calls
```

Every +10 multiplies the work by about 123. The calls form a tree, and the same subproblems appear all over it:

```text
                 fib(5)
           /               \
       fib(4)             fib(3)       ← fib(3) twice
      /      \            /     \
  fib(3)   fib(2)     fib(2)  fib(1)   ← fib(2) three times
```

The number of calls grows like fib(n) itself, about 1.6ⁿ: **exponential**. `fib(90)` would take about 10¹⁹ calls, hundreds of years. Yet there are only 91 *different* subproblems: fib(0) to fib(90).

```check
file dp/fib.cpp
run "g++ -std=c++20 -O2 -Wall -Wextra -Werror dp/fib.cpp -o dp/fib"
run "./dp/fib" stdout="fib(30) = 832040 after 2692537 calls"
```

## Step 2 — Memoisation: remember the answers

**This step: add `fib_memo`, which stores each answer the first time it's computed, and print `fib_memo(40)` and `fib_memo(90)` with their call counts.**

**Memoisation** (from *memo*, a note to yourself) keeps a table of answers. Before computing anything, look it up:

```cpp
// memo[n] is fib(n) once it has been worked out, or -1 before that.
long long fib_memo(int n, std::vector<long long>& memo)
{
    ++memo_calls;
    if (n < 2)
        return n;
    if (memo[n] != -1)
        return memo[n];            // solved before: reuse the answer
    memo[n] = fib_memo(n - 1, memo) + fib_memo(n - 2, memo);
    return memo[n];
}
```

- Add a second `fib_memo(int n)` that creates `std::vector<long long> memo(n + 1, -1)` and calls the first. Two functions with the same name and different parameters are **overloads**.
- Use a separate counter, `memo_calls`, and print lines like `fib_memo(40) = 102334155 after 79 calls`.
- Make the memo `long long` like the results: `fib(90)` is about 2.9 × 10¹⁸, far too big for an `int`.

**Predict:** how many calls for `fib_memo(90)`?

```cpp file=dp/fib.cpp
// How much work does the obvious recursive Fibonacci do?
#include <iostream>
#include <vector>

long long calls = 0;   // how many times fib has been called

long long fib(int n)
{
    ++calls;
    if (n < 2)
        return n;
    return fib(n - 1) + fib(n - 2);
}

long long memo_calls = 0;

// memo[n] is fib(n) once it has been worked out, or -1 before that.
long long fib_memo(int n, std::vector<long long>& memo)
{
    ++memo_calls;
    if (n < 2)
        return n;
    if (memo[n] != -1)
        return memo[n];            // solved before: reuse the answer
    memo[n] = fib_memo(n - 1, memo) + fib_memo(n - 2, memo);
    return memo[n];
}

long long fib_memo(int n)
{
    std::vector<long long> memo(n + 1, -1);
    return fib_memo(n, memo);
}

int main()
{
    for (int n : {10, 20, 30, 40}) {
        calls = 0;
        long long result = fib(n);
        std::cout << "fib(" << n << ") = " << result << " after " << calls
                  << " calls\n";
    }
    for (int n : {40, 90}) {
        memo_calls = 0;
        long long result = fib_memo(n);
        std::cout << "fib_memo(" << n << ") = " << result << " after "
                  << memo_calls << " calls\n";
    }
}
```

### What happened

179 calls for n = 90, and 79 for n = 40: **2n − 1**. Each `fib_memo(k)` does real work once, and every other call is an instant lookup. Exponential became **linear**, O(n), for the price of O(n) memory.

```check
run "g++ -std=c++20 -O2 -Wall -Wextra -Werror dp/fib.cpp -o dp/fib"
run "./dp/fib" stdout="fib_memo(40) = 102334155 after 79 calls" -- Check the memo before recursing, and store the answer before returning it.
run "./dp/fib" stdout="fib_memo(90) = 2880067194370816120" -- Store the answers as long long: fib(90) doesn't fit in an int.
```

## Step 3 — Tabulation: bottom-up

**This step: add `fib_table`, which builds the answers from the bottom up with a loop, and print `fib_table(90)`.**

Memoisation works **top-down**: start from the big problem and recurse. **Tabulation** works **bottom-up**: solve the smallest problems first, in an order where everything a problem needs is already solved.

```text
i:       0  1  2  3  4  5  ...  90
fib(i):  0  1  1  2  3  5  ...  2880067194370816120
              ↑ each one is the two before it, added
```

Each step needs only the previous two values, so keep just those two, not the whole table: **O(n) time, O(1) memory**, and no recursion to overflow the stack.

```cpp
long long before = 0;   // fib(i - 2)
long long last = 1;     // fib(i - 1)
for (int i = 2; i <= n; ++i) {
    long long next = before + last;
    before = last;
    last = next;
}
return last;
```

Return `n` itself when `n < 2`, and print the line `fib_table(90) = …`.

| | Time | Memory |
|---|---|---|
| plain recursion | O(1.6ⁿ) | O(n) stack |
| memoisation | O(n) | O(n) table + O(n) stack |
| tabulation | O(n) | O(1) here; usually a table |

```cpp file=dp/fib.cpp
// How much work does the obvious recursive Fibonacci do?
#include <iostream>
#include <vector>

long long calls = 0;   // how many times fib has been called

long long fib(int n)
{
    ++calls;
    if (n < 2)
        return n;
    return fib(n - 1) + fib(n - 2);
}

long long memo_calls = 0;

// memo[n] is fib(n) once it has been worked out, or -1 before that.
long long fib_memo(int n, std::vector<long long>& memo)
{
    ++memo_calls;
    if (n < 2)
        return n;
    if (memo[n] != -1)
        return memo[n];            // solved before: reuse the answer
    memo[n] = fib_memo(n - 1, memo) + fib_memo(n - 2, memo);
    return memo[n];
}

long long fib_memo(int n)
{
    std::vector<long long> memo(n + 1, -1);
    return fib_memo(n, memo);
}

// Bottom-up: start from the smallest problems, keep only the last two.
long long fib_table(int n)
{
    if (n < 2)
        return n;
    long long before = 0;   // fib(i - 2)
    long long last = 1;     // fib(i - 1)
    for (int i = 2; i <= n; ++i) {
        long long next = before + last;
        before = last;
        last = next;
    }
    return last;
}

int main()
{
    for (int n : {10, 20, 30, 40}) {
        calls = 0;
        long long result = fib(n);
        std::cout << "fib(" << n << ") = " << result << " after " << calls
                  << " calls\n";
    }
    for (int n : {40, 90}) {
        memo_calls = 0;
        long long result = fib_memo(n);
        std::cout << "fib_memo(" << n << ") = " << result << " after "
                  << memo_calls << " calls\n";
    }
    std::cout << "fib_table(90) = " << fib_table(90) << '\n';
}
```

```check
run "g++ -std=c++20 -O2 -Wall -Wextra -Werror dp/fib.cpp -o dp/fib"
run "./dp/fib" stdout="fib_table(90) = 2880067194370816120" -- Loop for i from 2 up to and including n.
```

## Step 4 — The build file

**This step: create the supplied `dp/CMakeLists.txt`.**

The next two problems are functions with tests. They'll live in a header, `dp/dp.h`, as `inline` functions, so the only program is `dp_tests`, with no `.cpp` file besides the tests.

- `inline` lets a function be *defined* in a header that several `.cpp` files include. Without it, each file would get its own definition and the linker would complain.

```cmake file=dp/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(dp LANGUAGES CXX)

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

# Every tests/*_test.cpp file becomes part of the test program.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(dp_tests ../testing/test_main.cpp ${TEST_SOURCES})
```

```check
file dp/CMakeLists.txt
```

## Step 5 — Coin change: the specification

**This step: create the supplied `dp/tests/coins_test.cpp` and read it.**

`min_coins(coins, amount)` returns the fewest coins that add up to exactly `amount`, using as many of each coin as needed, or -1 if it can't be done.

Look at `greedy_is_not_always_best`. The obvious strategy, "take the biggest coin that fits, repeat", is called **greedy**. It happens to be optimal for real currencies like {1, 2, 5, 10, 20, 50}, but with coins {1, 3, 4} and amount 6 it takes 4 + 1 + 1 when 3 + 3 is better.

**Predict:** why is the recursion "fewest coins for `a` = 1 + the best of fewest coins for `a − c`, over every coin `c`" a dynamic programming problem? Which subproblems repeat?

```cpp file=dp/tests/coins_test.cpp provided
// Provided by the lesson: what min_coins must do.
#include "studio_test.hpp"

#include <vector>

#include "dp.h"

TEST(zero_needs_no_coins)
{
    CHECK_EQ(min_coins({1, 2, 5}, 0), 0);
}

TEST(one_coin_is_enough)
{
    CHECK_EQ(min_coins({1, 2, 5}, 5), 1);
}

TEST(uk_coins)
{
    CHECK_EQ(min_coins({1, 2, 5, 10, 20, 50}, 88), 6);   // 50 20 10 5 2 1
}

TEST(greedy_is_not_always_best)
{
    // Greedy takes the biggest coin first: 4 + 1 + 1 = 3 coins.
    // The best is 3 + 3 = 2 coins.
    CHECK_EQ(min_coins({1, 3, 4}, 6), 2);
}

TEST(impossible_amounts)
{
    CHECK_EQ(min_coins({2}, 3), -1);
    CHECK_EQ(min_coins({5, 10}, 12), -1);
}

TEST(large_amounts_are_quick)
{
    CHECK_EQ(min_coins({1, 7, 10}, 100000), 10000);
    CHECK_EQ(min_coins({3, 7}, 100001), 14287);   // 14285 sevens + 2 threes
}
```

```check
file dp/tests/coins_test.cpp
```

## Step 6 — Coin change, bottom-up

**This step: create `dp/dp.h` with `min_coins`, solved by tabulation. Configure, build and run the tests.**

The subproblems are "fewest coins for every amount from 0 up to `amount`". Each one needs only *smaller* amounts, so fill a table from 0 upwards:

```text
coins {1, 3, 4}, amount 6
a:        0  1  2  3  4  5  6
best[a]:  0  1  2  1  1  2  2
best[6] = 1 + min(best[5], best[3], best[2])
        = 1 + min(2, 1, 2) = 2
```

- `std::vector<int> best(amount + 1, -1)`: -1 means "can't be made (yet)". `best[0] = 0`.
- For each amount `a` from 1 up, try each coin as the **last** coin: if `coin <= a` and `best[a - coin]` isn't -1, then `best[a - coin] + 1` coins make `a`. Keep the smallest.
- Return `best[amount]`.

The cost is O(amount × number of coins), which is why `large_amounts_are_quick` finishes instantly even for 100,000.

```text
cmake -S dp -B dp/build -G "MinGW Makefiles"     (Windows)
cmake -S dp -B dp/build                          (macOS, Linux)
```

```text
cmake --build dp/build
./dp/build/dp_tests
```

```cpp file=dp/dp.h
// dp.h: dynamic programming, bottom-up.
#pragma once

#include <string>
#include <vector>

// The fewest coins that add up to amount, using any number of each coin.
// -1 if no combination of coins makes exactly amount.
inline int min_coins(const std::vector<int>& coins, int amount)
{
    // best[a] = the fewest coins that make a, or -1 if a can't be made.
    std::vector<int> best(amount + 1, -1);
    best[0] = 0;                                // zero coins make 0
    for (int a = 1; a <= amount; ++a) {
        for (int coin : coins) {
            if (coin > a || best[a - coin] == -1)
                continue;   // this coin can't be the last one
            int with_coin = best[a - coin] + 1;   // a - coin, plus this coin
            if (best[a] == -1 || with_coin < best[a])
                best[a] = with_coin;
        }
    }
    return best[amount];
}
```

```check
file dp/build/CMakeCache.txt label="dp/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build dp/build" -- Define min_coins as an inline function in dp.h, starting with #pragma once.
tests "./dp/build/dp_tests" require="greedy_is_not_always_best impossible_amounts large_amounts_are_quick" -- Try every coin as the last one, and keep the smallest count.
```

## Step 7 — Edit distance: the reviewer's tests

**This step: create the supplied `dp/tests/edit_distance_review_test.cpp` and read it.**

The **edit distance** (or Levenshtein distance) between two strings is the fewest single-character insertions, deletions and replacements that turn one into the other. "kitten" to "sitting" is 3: replace k with s, replace e with i, insert g. Spell checkers suggest the dictionary words with the smallest distance to what you typed; `diff` and DNA alignment use close relatives of it.

The test program won't build until `edit_distance` exists. That's the next step.

```cpp file=dp/tests/edit_distance_review_test.cpp provided
// The reviewer's tests for edit_distance. Do not edit them: make them pass.
#include "studio_test.hpp"

#include <string>

#include "dp.h"

TEST(review_identical_strings)
{
    CHECK_EQ(edit_distance("kitten", "kitten"), 0);
    CHECK_EQ(edit_distance("", ""), 0);
}

TEST(review_from_or_to_empty)
{
    CHECK_EQ(edit_distance("", "abc"), 3);
    CHECK_EQ(edit_distance("abcd", ""), 4);
}

TEST(review_classic_example)
{
    // kitten -> sitten -> sittin -> sitting
    CHECK_EQ(edit_distance("kitten", "sitting"), 3);
}

TEST(review_one_of_each_edit)
{
    CHECK_EQ(edit_distance("cat", "cut"), 1);    // replace
    CHECK_EQ(edit_distance("cat", "cart"), 1);   // insert
    CHECK_EQ(edit_distance("cart", "cat"), 1);   // delete
}

TEST(review_is_symmetric)
{
    CHECK_EQ(edit_distance("sunday", "saturday"), 3);
    CHECK_EQ(edit_distance("saturday", "sunday"), 3);
}

TEST(review_long_strings_are_quick)
{
    std::string a(2000, 'a');
    std::string b = a;
    b[1000] = 'b';
    CHECK_EQ(edit_distance(a, b), 1);
    CHECK_EQ(edit_distance(a, a + "xyz"), 3);
}
```

```check
file dp/tests/edit_distance_review_test.cpp
```

## Step 8 — Challenge: edit distance

**This step: add `edit_distance(a, b)` to `dp/dp.h`, solved with a table, and make every test pass.**

The subproblem: `d[i][j]` = the edit distance between the **first i characters** of `a` and the **first j characters** of `b`. The answer is `d[a.size()][b.size()]`.

```text
          ""  s  i  t  t  i  n  g
     ""    0  1  2  3  4  5  6  7    ← insert j characters
     k     1  1  2  3  4  5  6  7
     i     2  2  1  2  3  4  5  6
     t     3  3  2  1  2  3  4  5
     t     4  4  3  2  1  2  3  4
     e     5  5  4  3  2  2  3  4
     n     6  6  5  4  3  3  2  3
     ↑ delete i characters              d[6][7] = 3
```

Every other cell comes from its three neighbours above and to the left. The last characters are `a[i - 1]` and `b[j - 1]`; the cheapest of:

- **replace** (free if they're already equal): `d[i - 1][j - 1]` + 0 or 1;
- **delete** `a`'s last character: `d[i - 1][j] + 1`;
- **insert** `b`'s last character: `d[i][j - 1] + 1`.

Fill row by row, so the three neighbours are always ready. `std::min({x, y, z})`, from `<algorithm>`, takes the smallest of a list. The table is `std::vector<std::vector<int>>`; mind the first row and column.

The cost is O(|a| × |b|), against an exponential number of possible edit sequences.

```cpp file=dp/dp.h
// dp.h: dynamic programming, bottom-up.
#pragma once

#include <algorithm>
#include <cstddef>
#include <string>
#include <vector>

// The fewest coins that add up to amount, using any number of each coin.
// -1 if no combination of coins makes exactly amount.
inline int min_coins(const std::vector<int>& coins, int amount)
{
    // best[a] = the fewest coins that make a, or -1 if a can't be made.
    std::vector<int> best(amount + 1, -1);
    best[0] = 0;                                // zero coins make 0
    for (int a = 1; a <= amount; ++a) {
        for (int coin : coins) {
            if (coin > a || best[a - coin] == -1)
                continue;   // this coin can't be the last one
            int with_coin = best[a - coin] + 1;   // a - coin, plus this coin
            if (best[a] == -1 || with_coin < best[a])
                best[a] = with_coin;
        }
    }
    return best[amount];
}

// The fewest single-character insertions, deletions and replacements
// that turn a into b.
inline int edit_distance(const std::string& a, const std::string& b)
{
    // d[i][j] = the distance between the first i characters of a and the
    // first j characters of b.
    std::vector<std::vector<int>> d(a.size() + 1,
                                    std::vector<int>(b.size() + 1, 0));
    for (std::size_t i = 0; i <= a.size(); ++i)
        d[i][0] = static_cast<int>(i);          // delete all i characters
    for (std::size_t j = 0; j <= b.size(); ++j)
        d[0][j] = static_cast<int>(j);          // insert all j characters
    for (std::size_t i = 1; i <= a.size(); ++i) {
        for (std::size_t j = 1; j <= b.size(); ++j) {
            int replace = d[i - 1][j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1);
            int remove = d[i - 1][j] + 1;
            int insert = d[i][j - 1] + 1;
            d[i][j] = std::min({replace, remove, insert});
        }
    }
    return d[a.size()][b.size()];
}
```

```check
matches dp/dp.h "int\s+edit_distance\s*\(" label="dp.h defines edit_distance"
run "cmake --build dp/build"
tests "./dp/build/dp_tests" require="review_from_or_to_empty review_classic_example review_long_strings_are_quick" -- The first row and column are the distances to and from the empty string: 0, 1, 2, ...
```
