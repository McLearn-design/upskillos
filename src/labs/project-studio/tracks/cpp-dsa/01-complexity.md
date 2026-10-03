---
title: 1 — Complexity You Can See
track: Data Structures and Algorithms, Measured
trackOrder: 9
runtime: cpp
reference: optional
console: true
---

Two programs can give the same answers and still differ by a factor of a thousand in speed. This track is about *why*: how the way you store data and the steps you take to search it decide how a program behaves as the data grows.

You won't take that on trust. Every lesson **measures**: you'll build a data structure, check it with tests, then race it against the alternatives, including the standard library's.

| Lesson | You build | You measure |
|---|---|---|
| 1 | a benchmark harness | linear vs binary search |
| 2 | a sorted-insert helper | vector vs list vs deque |
| 3 | a hash map | yours vs `std::unordered_map` |
| 4 | a binary search tree | balanced vs degenerate |
| 5 | a heap, a scheduler | |
| 6 | a route finder | BFS vs Dijkstra |
| 7 | dynamic programming | calls: exponential vs linear |
| 8 | a mini database | scans vs indexes |

Choose a **new empty folder** for this track, and run every command from it. Each lesson's project gets its own folder inside it; this lesson's is `bench/`.

> Timings depend on your machine, so yours won't match the numbers in these lessons, and the checks never look at them. The checks only look at **answers**, which must be exactly right on every machine.

## Step 1 — A benchmark harness

**This step: create the supplied `bench/bench.h` and read it.**

Timing code sounds easy: read the clock, run the code, read the clock again. Done naively, the numbers are mostly noise. `bench.h` handles the three classic traps:

| Trap | What goes wrong | `bench.h`'s answer |
|---|---|---|
| Cold start | the first run pays for empty caches and fresh memory | one **warm-up** call, not timed |
| Noise | other programs, the OS and the CPU's clock speed interfere | several **repetitions**; report the **median** |
| Dead code | the optimiser deletes work whose result is never used | `bench::keep(result)` |

- `std::chrono::steady_clock` is the clock to time with: it never jumps backwards, unlike the wall clock (`system_clock`), which can change when the computer syncs its time.
- The **median** (the middle value once sorted) ignores a run that was unlucky, such as one interrupted by another program. An average would let that one run drag the result.
- `median_ns` takes the work as a **lambda**, `[&] { ... }`: a small unnamed function that can use the variables around it. You'll write several in this lesson.

You'll reuse this header in every lesson of the track.

```cpp file=bench/bench.h provided
// bench.h: a tiny benchmark harness, shared by every lesson in this track.
//
//   double ns = bench::median_ns([&] { /* the work to time */ });
//   bench::keep(result);   // stop the optimiser from deleting the work
#pragma once

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <vector>

namespace bench {

// Results the benchmarks compute are written here. The compiler must perform
// every write to a volatile variable, so it can't skip the work behind them.
inline volatile std::uint64_t sink = 0;

inline void keep(std::uint64_t value)
{
    sink = sink + value;
}

// Calls fn once to warm up, then `reps` more times, timing each call.
// Returns the median time of one call, in nanoseconds.
template <typename Fn>
double median_ns(Fn fn, int reps = 7)
{
    fn();   // warm-up: fills the caches and pages in the memory
    std::vector<double> times;
    for (int i = 0; i < reps; ++i) {
        auto start = std::chrono::steady_clock::now();
        fn();
        auto stop = std::chrono::steady_clock::now();
        std::chrono::duration<double, std::nano> took = stop - start;
        times.push_back(took.count());
    }
    std::sort(times.begin(), times.end());
    return times[times.size() / 2];   // the middle one: ignores rare hiccups
}

} // namespace bench
```

```check
file bench/bench.h
```

## Step 2 — Two ways to search

**This step: create `bench/search.cpp` with `linear_find`, `binary_find` and a `main` that checks they agree.**

**Linear search** looks at every element in turn. It works on any vector.

**Binary search** needs a **sorted** vector, and uses that to throw away half of the remaining elements at every step:

```text
looking for 40 in [ 2  8 15 23 40 42 57 91 ]
  range [0, 8): mid 4 holds 40   40 < 40? no:  range [0, 4)
  range [0, 4): mid 2 holds 15   15 < 40? yes: range [3, 4)
  range [3, 4): mid 3 holds 23   23 < 40? yes: range [4, 4)
  empty: lo = 4, and v[4] is 40. Found.
```

- The range `[lo, hi)` is **half-open**: `lo` is in it, `hi` isn't. It starts as `[0, size)` and shrinks until it's empty. Then `lo` is where `x` is, or where it would go.
- `lo + (hi - lo) / 2` is the middle. The obvious `(lo + hi) / 2` can overflow when the numbers are huge.
- Each function adds the number of elements it looked at to `looked`, so you can count the work as well as time it.

```cpp
std::size_t binary_find(const std::vector<int>& v, int x, long& looked)
{
    std::size_t lo = 0;
    std::size_t hi = v.size();
    while (lo < hi) {
        std::size_t mid = lo + (hi - lo) / 2;
        ++looked;
        if (v[mid] < x)
            lo = mid + 1;   // x can only be to the right of mid
        else
            hi = mid;       // x is at mid or to its left
    }
    // ... is v[lo] equal to x?
}
```

Before measuring anything, make sure both are **correct**: `main` searches 1000 even numbers for every value from -1 to 1998 and counts how often the two functions agree. A fast wrong answer is worthless.

```text
g++ -std=c++20 -O2 -Wall -Wextra -Werror bench/search.cpp -o bench/search
./bench/search
```

> 🔬 Binary search is a classic place for off-by-one mistakes. If yours disagrees, **Trace in CodeLens** with a small vector and watch `lo`, `mid` and `hi`.

```cpp file=bench/search.cpp
#include <cstddef>
#include <iostream>
#include <vector>

// Returns the index of x in v, or v.size() if x isn't there.
// Adds the number of elements it looked at to `looked`.
std::size_t linear_find(const std::vector<int>& v, int x, long& looked)
{
    for (std::size_t i = 0; i < v.size(); ++i) {
        ++looked;
        if (v[i] == x)
            return i;
    }
    return v.size();
}

// The same, for a sorted v: halve the range [lo, hi) until it is empty.
std::size_t binary_find(const std::vector<int>& v, int x, long& looked)
{
    std::size_t lo = 0;
    std::size_t hi = v.size();
    while (lo < hi) {
        std::size_t mid = lo + (hi - lo) / 2;
        ++looked;
        if (v[mid] < x)
            lo = mid + 1;   // x can only be to the right of mid
        else
            hi = mid;       // x is at mid or to its left
    }
    if (lo < v.size() && v[lo] == x)
        return lo;
    return v.size();
}

// 0, 2, 4, ...: n sorted even numbers, so every odd number is missing.
std::vector<int> evens(int n)
{
    std::vector<int> v;
    for (int i = 0; i < n; ++i)
        v.push_back(2 * i);
    return v;
}

int main()
{
    std::vector<int> v = evens(1000);
    long looked = 0;
    int agree = 0;
    for (int x = -1; x < 2000; ++x) {
        if (linear_find(v, x, looked) == binary_find(v, x, looked))
            ++agree;
    }
    std::cout << "linear_find and binary_find agree on " << agree
              << " of 2001 lookups\n";
}
```

```check
matches bench/search.cpp "std::size_t\s+binary_find\s*\(" label="search.cpp defines binary_find"
run "g++ -std=c++20 -O2 -Wall -Wextra -Werror bench/search.cpp -o bench/search"
run "./bench/search" stdout="agree on 2001 of 2001 lookups" -- Compare v[mid] < x, not <=: when v[mid] equals x, x is at mid or to its left.
```

## Step 3 — Count the work

**This step: add a loop to `main` that searches for a missing value in 1,000, 10,000, 100,000 and 1,000,000 numbers, and prints how many elements each search looked at.**

Before timing anything, count. A missing value is the **worst case**: linear search has to look at everything.

```cpp
for (int n : {1000, 10000, 100000, 1000000}) {
    std::vector<int> big = evens(n);
    long lin = 0;
    long bin = 0;
    linear_find(big, 2 * n + 1, lin);   // bigger than every element
    binary_find(big, 2 * n + 1, bin);
    std::cout << "n=" << n << ": linear looks at " << lin
              << ", binary at " << bin << '\n';
}
```

**Predict:** the linear numbers are easy. What will binary search's be? Each step halves the range, and 2¹⁰ is about 1,000.

```cpp file=bench/search.cpp
#include <cstddef>
#include <iostream>
#include <vector>

// Returns the index of x in v, or v.size() if x isn't there.
// Adds the number of elements it looked at to `looked`.
std::size_t linear_find(const std::vector<int>& v, int x, long& looked)
{
    for (std::size_t i = 0; i < v.size(); ++i) {
        ++looked;
        if (v[i] == x)
            return i;
    }
    return v.size();
}

// The same, for a sorted v: halve the range [lo, hi) until it is empty.
std::size_t binary_find(const std::vector<int>& v, int x, long& looked)
{
    std::size_t lo = 0;
    std::size_t hi = v.size();
    while (lo < hi) {
        std::size_t mid = lo + (hi - lo) / 2;
        ++looked;
        if (v[mid] < x)
            lo = mid + 1;   // x can only be to the right of mid
        else
            hi = mid;       // x is at mid or to its left
    }
    if (lo < v.size() && v[lo] == x)
        return lo;
    return v.size();
}

// 0, 2, 4, ...: n sorted even numbers, so every odd number is missing.
std::vector<int> evens(int n)
{
    std::vector<int> v;
    for (int i = 0; i < n; ++i)
        v.push_back(2 * i);
    return v;
}

int main()
{
    std::vector<int> v = evens(1000);
    long looked = 0;
    int agree = 0;
    for (int x = -1; x < 2000; ++x) {
        if (linear_find(v, x, looked) == binary_find(v, x, looked))
            ++agree;
    }
    std::cout << "linear_find and binary_find agree on " << agree
              << " of 2001 lookups\n";

    // The worst case: a value bigger than everything, so it is missing.
    std::cout << "\nLooking for a missing value:\n";
    for (int n : {1000, 10000, 100000, 1000000}) {
        std::vector<int> big = evens(n);
        long lin = 0;
        long bin = 0;
        linear_find(big, 2 * n + 1, lin);
        binary_find(big, 2 * n + 1, bin);
        std::cout << "n=" << n << ": linear looks at " << lin
                  << ", binary at " << bin << '\n';
    }
}
```

### What happened

```text
n=1000: linear looks at 1000, binary at 9
n=1000000: linear looks at 1000000, binary at 19
```

Multiply n by 1,000 and linear search does **1,000 times** the work; binary search does **10 more steps**. That's what **Big-O notation** describes: how the work grows with n, ignoring constant factors.

| Search | Steps for n | Big-O |
|---|---|---|
| linear | n | O(n): *linear* |
| binary | about log₂ n | O(log n): *logarithmic* |

Big-O ignores constants on purpose: they depend on the machine, while the growth doesn't. For large n, growth wins every time.

```check
run "g++ -std=c++20 -O2 -Wall -Wextra -Werror bench/search.cpp -o bench/search"
run "./bench/search" stdout="n=1000: linear looks at 1000, binary at 9" -- Start each count at 0 inside the loop.
run "./bench/search" stdout="n=1000000: linear looks at 1000000, binary at 19" -- Search for 2 * n + 1, which is bigger than every element.
```

## Step 4 — Now time it

**This step: include `bench.h` and add a timing table: the median time per lookup for each n, for both searches.**

```cpp
#include "bench.h"
```

`"bench.h"` in quotes means "look next to this file first", so the header in `bench/` is found.

For each n, time a batch of 100 lookups spread across the whole range, and divide by 100. A single lookup by binary search takes nanoseconds: too short for the clock to measure well.

```cpp
auto lookups = [&](auto find) {
    long looked = 0;
    for (int q = 0; q < 100; ++q)
        find(big, (2 * n / 100) * q + 1, looked);
    bench::keep(looked);   // use the result: the work can't be skipped
};
double lin = bench::median_ns([&] { lookups(linear_find); }) / 100;
double bin = bench::median_ns([&] { lookups(binary_find); }) / 100;
```

- `lookups` takes the search function as a parameter (`auto find`), so the same code times both.
- The values searched for are odd, so they're all missing: the worst case again.
- `std::setw(10)` (from `<iomanip>`) pads the next value to 10 characters, so the columns line up.

Build with `-O2` as before, and run it. The whole program takes well under a second.

```cpp file=bench/search.cpp
#include <cstddef>
#include <iomanip>
#include <iostream>
#include <vector>

#include "bench.h"

// Returns the index of x in v, or v.size() if x isn't there.
// Adds the number of elements it looked at to `looked`.
std::size_t linear_find(const std::vector<int>& v, int x, long& looked)
{
    for (std::size_t i = 0; i < v.size(); ++i) {
        ++looked;
        if (v[i] == x)
            return i;
    }
    return v.size();
}

// The same, for a sorted v: halve the range [lo, hi) until it is empty.
std::size_t binary_find(const std::vector<int>& v, int x, long& looked)
{
    std::size_t lo = 0;
    std::size_t hi = v.size();
    while (lo < hi) {
        std::size_t mid = lo + (hi - lo) / 2;
        ++looked;
        if (v[mid] < x)
            lo = mid + 1;   // x can only be to the right of mid
        else
            hi = mid;       // x is at mid or to its left
    }
    if (lo < v.size() && v[lo] == x)
        return lo;
    return v.size();
}

// 0, 2, 4, ...: n sorted even numbers, so every odd number is missing.
std::vector<int> evens(int n)
{
    std::vector<int> v;
    for (int i = 0; i < n; ++i)
        v.push_back(2 * i);
    return v;
}

int main()
{
    std::vector<int> v = evens(1000);
    long looked = 0;
    int agree = 0;
    for (int x = -1; x < 2000; ++x) {
        if (linear_find(v, x, looked) == binary_find(v, x, looked))
            ++agree;
    }
    std::cout << "linear_find and binary_find agree on " << agree
              << " of 2001 lookups\n";

    // The worst case: a value bigger than everything, so it is missing.
    std::cout << "\nLooking for a missing value:\n";
    for (int n : {1000, 10000, 100000, 1000000}) {
        std::vector<int> big = evens(n);
        long lin = 0;
        long bin = 0;
        linear_find(big, 2 * n + 1, lin);
        binary_find(big, 2 * n + 1, bin);
        std::cout << "n=" << n << ": linear looks at " << lin
                  << ", binary at " << bin << '\n';
    }

    // Time 100 lookups of values spread across the whole range.
    std::cout << "\nTime per lookup (median of 7 runs):\n";
    std::cout << "         n   linear ns   binary ns\n";
    for (int n : {1000, 10000, 100000, 1000000}) {
        std::vector<int> big = evens(n);
        auto lookups = [&](auto find) {
            long looked = 0;
            for (int q = 0; q < 100; ++q)
                find(big, (2 * n / 100) * q + 1, looked);
            bench::keep(looked);
        };
        double lin = bench::median_ns([&] { lookups(linear_find); }) / 100;
        double bin = bench::median_ns([&] { lookups(binary_find); }) / 100;
        std::cout << std::setw(10) << n << std::setw(12) << std::fixed
                  << std::setprecision(1) << lin << std::setw(12) << bin
                  << '\n';
    }
}
```

### Reading the numbers

```text
         n   linear ns   binary ns
      1000       313.3        18.6
     10000      4030.5        23.3
    100000     31717.9        24.2
   1000000    402985.7        38.4
```

Your numbers will differ, but the **shape** won't:

- Linear search's time grows about 10× per row, just like the count: **O(n)**.
- Binary search's time barely moves: **O(log n)**. It creeps up at a million because 4 MB of numbers no longer fits in the CPU's fastest caches, so each look waits longer for memory. Lesson 2 is about that effect.
- At n = 1000 linear search costs only about 0.3 ns per element: modern CPUs compare several ints per instruction. **Constant factors are real**, which is why for very small n (a dozen elements) linear search can win.

```check
contains bench/search.cpp "bench::median_ns"
run "g++ -std=c++20 -O2 -Wall -Wextra -Werror bench/search.cpp -o bench/search" -- #include "bench.h" at the top of search.cpp, and #include <iomanip> for std::setw.
run "./bench/search" stdout="agree on 2001 of 2001 lookups"
run "./bench/search" stdout="linear ns" label="it prints the timing table"
```

## Step 5 — Why debug timings lie

**This step: build the same program without optimisation, run both versions, and compare. No file changes.**

```text
g++ -std=c++20 -O0 bench/search.cpp -o bench/search-debug
./bench/search-debug
./bench/search
```

`-O0` means "no optimisation". It's what you get by default from `g++`, and from a CMake **Debug** build. **Predict:** will both searches slow down by the same factor?

### What happened

On the machine these lessons were written on, linear search got about **7× slower** at `-O0` and binary search about **3× slower**. They didn't slow down equally, so even the *comparison* between them changed.

Without optimisation the compiler translates your code literally:

- every variable lives in memory, and is loaded and stored around every operation, instead of staying in a register;
- small functions, such as `std::vector`'s `operator[]` and `size()`, are real calls instead of being **inlined** (copied into the caller and then simplified);
- no **vectorisation**: an optimised linear search compares several ints per instruction.

Code full of small function calls, such as anything using the standard library, suffers most. So a debug-build benchmark measures how well your code survives *not* being optimised, which isn't what your users will run.

> **Rule for the whole track:** measure only optimised builds. With `g++` that's `-O2`; with CMake it's a **Release** build. From lesson 2 on, each project's `CMakeLists.txt` asks for Release automatically.

Debug builds are still what you want for **debugging**: with `-O0 -g`, the debugger shows every variable exactly as written.

## Step 6 — Mistake on purpose: an impossible benchmark

**This step: create the supplied `bench/broken.cpp`, build it, run it, and work out what's wrong before reading on.**

A colleague is delighted: their loop adds up 20 million numbers in a few *nanoseconds*.

```text
g++ -std=c++20 -O2 -Wall -Wextra bench/broken.cpp -o bench/broken
./bench/broken
```

**Predict:** a modern CPU does a few billion simple operations per second. How long *should* 20 million additions, each with a `%`, take?

```cpp file=bench/broken.cpp provided
// A benchmark from a colleague: "my loop adds up 20 million numbers
// in no time at all!" Is it right?
#include <cstdint>
#include <iostream>

#include "bench.h"

int main()
{
    const std::uint64_t n = 20'000'000;
    double ns = bench::median_ns([&] {
        std::uint64_t sum = 0;
        for (std::uint64_t i = 0; i < n; ++i)
            sum += i % 7;
    });
    std::cout << "adding up " << n << " numbers took " << ns / 1e6
              << " ms\n";
}
```

### Diagnosis

20 million iterations should take tens of milliseconds, not nanoseconds. The loop **never ran**.

`sum` is never used after the loop: nothing prints it, returns it or stores it anywhere. The C++ standard lets the compiler make any change that doesn't alter what the program *observably* does (its output, and reads and writes of `volatile` variables). Computing a number nobody looks at changes nothing observable, so at `-O2` the whole loop is deleted. You timed an empty lambda.

Clang even warns about it: `variable 'sum' set but not used`. GCC doesn't.

This is the most common way benchmarks lie, and it gets subtler: the optimiser can also delete *part* of the work, or compute the answer at compile time if the input is known.

```check
file bench/broken.cpp
run "g++ -std=c++20 -O2 -Wall -Wextra bench/broken.cpp -o bench/broken"
run "./bench/broken" stdout="numbers took"
```

## Step 7 — Fix the benchmark

**This step: make the loop's result observable with `bench::keep(sum)`, and print the sum after the timing.**

```cpp
std::uint64_t result = 0;
double ns = bench::median_ns([&] {
    std::uint64_t sum = 0;
    for (std::uint64_t i = 0; i < n; ++i)
        sum += i % 7;
    bench::keep(sum);   // the sum is used, so the loop must run
    result = sum;
});
// ... then print "sum = " and result
```

`bench::keep` writes the value into `bench::sink`, which is `volatile`. A write to a volatile variable counts as observable behaviour, so the compiler must compute the value that's written, and so must run the loop. This is the same idea as Google Benchmark's `DoNotOptimize`.

Printing `result` is a second check: if the sum is right, the work really happened. Build with `-Werror` this time, so any warning stops the build:

```text
g++ -std=c++20 -O2 -Wall -Wextra -Werror bench/broken.cpp -o bench/broken
./bench/broken
```

Now the time is in milliseconds, which is believable. **Whenever a benchmark looks too good to be true, check that the work is used.**

```cpp file=bench/broken.cpp
// A benchmark from a colleague: "my loop adds up 20 million numbers
// in no time at all!" Is it right?
#include <cstdint>
#include <iostream>

#include "bench.h"

int main()
{
    const std::uint64_t n = 20'000'000;
    std::uint64_t result = 0;
    double ns = bench::median_ns([&] {
        std::uint64_t sum = 0;
        for (std::uint64_t i = 0; i < n; ++i)
            sum += i % 7;
        bench::keep(sum);   // the sum is used, so the loop must run
        result = sum;
    });
    std::cout << "adding up " << n << " numbers took " << ns / 1e6
              << " ms\n";
    std::cout << "sum = " << result << '\n';
}
```

```check
contains bench/broken.cpp "bench::keep"
run "g++ -std=c++20 -O2 -Wall -Wextra -Werror bench/broken.cpp -o bench/broken"
run "./bench/broken" stdout="sum = 59999997" -- Store the sum in a variable declared outside the lambda, and print it after the timing.
```
