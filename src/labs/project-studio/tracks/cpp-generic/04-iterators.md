---
title: 4 — Iterators: Make Your Container Work with Everything
track: Generic Programming
runtime: cpp
reference: optional
console: true
---

Why does `std::find` work on a `std::vector`, a `std::list`, a `std::string` and a plain array, when those store their elements in completely different ways? Because it never touches the container. It only uses **iterators**: small objects that know how to reach the current element (`*it`) and move to the next (`++it`).

```text
algorithms  ──uses──►  iterators  ◄──provides──  containers
std::find              *it  ++it  ==             vector, list,
std::accumulate                                  your Ring
range-for
```

Write an iterator for your own container, and every algorithm, and range-for, works on it for free. In this lesson you build `Ring<T, N>`, a fixed-size **ring buffer**, give it an iterator, and then write `Range`, which has no container behind it at all.

## Step 1 — A ring buffer: the specification

**This step: create the supplied `generic/tests/ring_test.cpp` and read it.**

A ring buffer keeps **the last N values** pushed into it, in a fixed array. It's used for "the last 100 log lines", a moving average of the last 10 readings, or audio samples: memory use is fixed, and pushing never allocates.

```text
Ring<int, 3>, after push 1 2 3 4 5:

items_:  [ 4 | 5 | 3 ]        start_ = 2: the oldest value
               ▲     ▲
            newest  oldest    logical order: 3 4 5
```

When it's full, a push **overwrites the oldest** value, and the "start" moves on one place, wrapping around to 0 at the end: hence "ring".

`Ring<int, 3>` has two template arguments, and the second isn't a type: it's a **non-type template parameter**, a `std::size_t` value fixed at compile time, as in `std::array<int, 3>`. `Ring<int, 3>` and `Ring<int, 4>` are different types.

The tests ask for `push`, `size`, `capacity`, `empty`, `full`, `r[i]` (0 is the oldest value) and `at(i)`, which throws `std::out_of_range`.

```cpp file=generic/tests/ring_test.cpp provided
// Provided by the lesson: what Ring<T, N> must do.
#include "studio_test.hpp"

#include "ring.h"

#include <stdexcept>
#include <string>

TEST(new_ring_is_empty)
{
    Ring<int, 3> r;
    CHECK(r.empty());
    CHECK_EQ(r.size(), 0u);
    CHECK_EQ(r.capacity(), 3u);
}

TEST(push_adds_values_oldest_first)
{
    Ring<int, 3> r;
    r.push(10);
    r.push(20);
    CHECK_EQ(r.size(), 2u);
    CHECK_EQ(r[0], 10);
    CHECK_EQ(r[1], 20);
    CHECK(!r.full());
}

TEST(a_full_ring_overwrites_the_oldest_value)
{
    Ring<int, 3> r;
    for (int v : {1, 2, 3, 4, 5})
        r.push(v);
    CHECK(r.full());
    CHECK_EQ(r.size(), 3u);
    CHECK_EQ(r[0], 3);
    CHECK_EQ(r[1], 4);
    CHECK_EQ(r[2], 5);
}

TEST(at_checks_the_index)
{
    Ring<std::string, 2> r;
    r.push("a");
    CHECK_EQ(r.at(0), "a");
    CHECK_THROWS(r.at(1), std::out_of_range);
}

TEST(a_ring_of_one_keeps_the_newest)
{
    Ring<int, 1> r;
    r.push(1);
    r.push(2);
    CHECK_EQ(r.size(), 1u);
    CHECK_EQ(r[0], 2);
}
```

```check
file generic/tests/ring_test.cpp
```

## Step 2 — Write Ring<T, N>

**This step: create `generic/ring.h` with the class template `Ring<T, N>`, and make the tests pass.**

```cpp
template <std::semiregular T, std::size_t N>
class Ring {
    static_assert(N > 0, "a Ring needs room for at least one value");
public:
    // push, size, capacity, empty, full, operator[], at
private:
    std::array<T, N> items_{};
    std::size_t start_ = 0;   // where the oldest value is
    std::size_t size_ = 0;
};
```

- `std::semiregular T` is lesson 3 at work: `std::array<T, N>` default-constructs N values and `push` copies into them, so `T` must be default-constructible and copyable. `semiregular` is the standard concept for exactly that.
- `static_assert(N > 0)` rejects `Ring<int, 0>` at compile time.
- `capacity()` can be `static constexpr`: it's just `N`, known before the program runs.

The two formulas that make it a ring:

| | |
|---|---|
| logical index `i` lives at | `items_[(start_ + i) % N]` |
| the next free slot is | `items_[(start_ + size_) % N]` |

`push` writes to the next free slot. If the ring wasn't full, `++size_`; if it was, the write just overwrote the oldest value, so `start_ = (start_ + 1) % N`.

```cpp file=generic/ring.h
#pragma once

#include <array>
#include <concepts>
#include <cstddef>
#include <stdexcept>

// A fixed-size ring buffer: it keeps the last N values pushed.
// When it's full, a push overwrites the oldest value.
template <std::semiregular T, std::size_t N>
class Ring {
    static_assert(N > 0, "a Ring needs room for at least one value");

public:
    void push(const T& value)
    {
        items_[(start_ + size_) % N] = value;
        if (size_ < N)
            ++size_;
        else
            start_ = (start_ + 1) % N; // the oldest value was overwritten
    }

    std::size_t size() const { return size_; }
    static constexpr std::size_t capacity() { return N; }
    bool empty() const { return size_ == 0; }
    bool full() const { return size_ == N; }

    // Index 0 is the oldest value, size() - 1 the newest.
    const T& operator[](std::size_t index) const
    {
        return items_[(start_ + index) % N];
    }

    const T& at(std::size_t index) const
    {
        if (index >= size_)
            throw std::out_of_range("Ring::at: index out of range");
        return (*this)[index];
    }

private:
    std::array<T, N> items_{};
    std::size_t start_ = 0; // where the oldest value is
    std::size_t size_ = 0;
};
```

```check
matches generic/ring.h "template\s*<[^>]*std::size_t\s+N\s*>" label="Ring has a std::size_t N template parameter"
run "cmake --build generic/build"
tests "./generic/build/generic_tests" require="a_full_ring_overwrites_the_oldest_value a_ring_of_one_keeps_the_newest" -- When the ring is full, push overwrites items_[start_] and moves start_ on by one, wrapping with % N.
```

## Step 3 — What range-for needs

**This step: create the supplied `generic/tests/ring_iter_test.cpp` and read it. The test program won't build until the next step.**

The tests use a `Ring` with range-for, `std::find`, `std::accumulate`, `std::ranges::count_if` and `std::ranges::max`. None of them know what a `Ring` is. What do they need?

**Predict:** range-for is a shorthand. What do you think `for (int v : r) { ... }` turns into?

### What range-for means

```cpp
auto it = r.begin();
auto stop = r.end();
for (; it != stop; ++it) {
    int v = *it;
    ...
}
```

So a type works with range-for if it has `begin()` and `end()`, and what they return supports `!=`, `++` and `*`. That's an **iterator**. `end()` is one past the last element, never dereferenced: a half-open range `[begin, end)`, so an empty range is simply `begin() == end()`.

The two `static_assert`s at the top ask the standard library whether `Ring`'s iterator really is a **forward iterator**, and `Ring` a **forward range**. Those concepts check everything the algorithms rely on, at compile time.

```cpp file=generic/tests/ring_iter_test.cpp provided
// Provided by the lesson: iterating over a Ring, with range-for and
// with the standard algorithms.
#include "studio_test.hpp"

#include "ring.h"

#include <algorithm>
#include <iterator>
#include <numeric>
#include <ranges>
#include <string>
#include <vector>

// The standard library's own checks: is it a real forward iterator?
static_assert(std::forward_iterator<Ring<int, 4>::const_iterator>);
static_assert(std::ranges::forward_range<Ring<int, 4>>);

namespace {
Ring<int, 4> last_four(std::initializer_list<int> values)
{
    Ring<int, 4> r;
    for (int v : values)
        r.push(v);
    return r;
}
} // namespace

TEST(range_for_visits_oldest_to_newest)
{
    Ring<int, 4> r = last_four({1, 2, 3, 4, 5, 6});
    std::vector<int> seen;
    for (int v : r)
        seen.push_back(v);
    CHECK(seen == (std::vector<int>{3, 4, 5, 6}));
}

TEST(an_empty_ring_has_nothing_to_visit)
{
    Ring<int, 4> r;
    CHECK(r.begin() == r.end());
}

TEST(classic_algorithms_work)
{
    Ring<int, 4> r = last_four({7, 1, 9, 4, 2});
    CHECK_EQ(std::accumulate(r.begin(), r.end(), 0), 16);
    CHECK(std::find(r.begin(), r.end(), 7) == r.end());   // overwritten
    CHECK(std::find(r.begin(), r.end(), 9) != r.end());
}

TEST(ranges_algorithms_work)
{
    Ring<int, 4> r = last_four({7, 1, 9, 4, 2});
    CHECK_EQ(std::ranges::count_if(r, [](int v) { return v > 3; }), 2);
    CHECK_EQ(std::ranges::max(r), 9);
}

TEST(arrow_reaches_members)
{
    Ring<std::string, 2> r;
    r.push("hello");
    CHECK_EQ(r.begin()->size(), 5u);
}

TEST(a_ring_can_fill_a_vector)
{
    Ring<int, 4> r = last_four({1, 2, 3});
    std::vector<int> copy(r.begin(), r.end());
    CHECK(copy == (std::vector<int>{1, 2, 3}));
}
```

```check
file generic/tests/ring_iter_test.cpp
```

## Step 4 — Write the iterator

**This step: add a nested class `const_iterator`, and `begin()` and `end()`, to `Ring` in `generic/ring.h`. All the tests must pass.**

The iterator remembers **which ring** and **which logical index**, not a position in `items_`. Then `*it` is just `(*ring_)[index_]`, the wrap-around is handled by `operator[]`, and `end()` is index `size_`.

```cpp
class const_iterator {
public:
    using iterator_category = std::forward_iterator_tag;
    using value_type = T;
    using difference_type = std::ptrdiff_t;
    using pointer = const T*;
    using reference = const T&;

    const_iterator() = default;
    const_iterator(const Ring* ring, std::size_t index)
        : ring_(ring), index_(index) {}

    const T& operator*() const { return (*ring_)[index_]; }
    const T* operator->() const { return &(*ring_)[index_]; }
    const_iterator& operator++() { ++index_; return *this; }
    const_iterator operator++(int);   // it++: return the old copy
    bool operator==(const const_iterator&) const = default;

private:
    const Ring* ring_ = nullptr;
    std::size_t index_ = 0;
};

const_iterator begin() const { return const_iterator(this, 0); }
const_iterator end() const { return const_iterator(this, size_); }
```

- The `using` lines are how algorithms ask an iterator about itself: what it points at, and how to measure distances. `#include <iterator>` for the tag.
- `const_` because it only reads: changing a value through it isn't allowed. That's enough for every algorithm in the tests.
- A defaulted `==` compares both members. C++20 writes `!=` from it.
- It must be default-constructible (`const_iterator() = default`): `std::forward_iterator` requires it.

### Iterator categories

Different containers can move their iterators in different ways, and algorithms ask for the least they need:

| Category | Adds | Example |
|---|---|---|
| input | read once, `++` | reading `std::cin` |
| forward | read again, copy and come back | `std::forward_list`, your `Ring` |
| bidirectional | `--` | `std::list`, `std::map` |
| random access | `it + n`, `it[n]`, `<` | `std::deque` |
| contiguous | elements adjacent in memory | `std::vector`, `std::array` |

`std::sort` needs random access, so `std::sort` on a `std::list` doesn't compile. `std::find` only needs input. Giving `Ring`'s iterator `--` and `+ n` would make it random-access: a good exercise once the tests pass.

```cpp file=generic/ring.h
#pragma once

#include <array>
#include <concepts>
#include <cstddef>
#include <iterator>
#include <stdexcept>

// A fixed-size ring buffer: it keeps the last N values pushed.
// When it's full, a push overwrites the oldest value.
template <std::semiregular T, std::size_t N>
class Ring {
    static_assert(N > 0, "a Ring needs room for at least one value");

public:
    void push(const T& value)
    {
        items_[(start_ + size_) % N] = value;
        if (size_ < N)
            ++size_;
        else
            start_ = (start_ + 1) % N; // the oldest value was overwritten
    }

    std::size_t size() const { return size_; }
    static constexpr std::size_t capacity() { return N; }
    bool empty() const { return size_ == 0; }
    bool full() const { return size_ == N; }

    // Index 0 is the oldest value, size() - 1 the newest.
    const T& operator[](std::size_t index) const
    {
        return items_[(start_ + index) % N];
    }

    const T& at(std::size_t index) const
    {
        if (index >= size_)
            throw std::out_of_range("Ring::at: index out of range");
        return (*this)[index];
    }

    // Walks the values from oldest to newest. It remembers the ring and
    // a logical index (0 = oldest), not a position in items_.
    class const_iterator {
    public:
        using iterator_category = std::forward_iterator_tag;
        using value_type = T;
        using difference_type = std::ptrdiff_t;
        using pointer = const T*;
        using reference = const T&;

        const_iterator() = default;
        const_iterator(const Ring* ring, std::size_t index)
            : ring_(ring), index_(index)
        {
        }

        const T& operator*() const { return (*ring_)[index_]; }
        const T* operator->() const { return &(*ring_)[index_]; }

        const_iterator& operator++() // ++it
        {
            ++index_;
            return *this;
        }

        const_iterator operator++(int) // it++
        {
            const_iterator old = *this;
            ++index_;
            return old;
        }

        bool operator==(const const_iterator&) const = default;

    private:
        const Ring* ring_ = nullptr;
        std::size_t index_ = 0;
    };

    const_iterator begin() const { return const_iterator(this, 0); }
    const_iterator end() const { return const_iterator(this, size_); }

private:
    std::array<T, N> items_{};
    std::size_t start_ = 0; // where the oldest value is
    std::size_t size_ = 0;
};
```

```check
matches generic/ring.h "class\s+const_iterator" label="Ring has a nested const_iterator class"
run "cmake --build generic/build" -- A failing static_assert names the requirement: forward iterators need a default constructor, ==, both ++s, and the using lines.
tests "./generic/build/generic_tests" require="range_for_visits_oldest_to_newest ranges_algorithms_work" -- The iterator holds a logical index: *it is (*ring_)[index_], end() is index size_.
```

## Step 5 — Challenge: Range, with a sentinel

**This step: no code is given. Create `generic/range.h` with a class `Range` whose iterator generates numbers instead of reading them from a container.**

`Range(start, stop, step)` is the integers from `start` up to, not including, `stop`, counting by `step` (default 1). Like Python's `range`.

```text
Range(0, 5)        0 1 2 3 4
Range(0, 10, 3)    0 3 6 9
Range(10, 0, -4)   10 6 2
Range(5, 5)        (nothing)
```

**Predict:** if `end()` returned an iterator at `stop`, and the loop ran until `it == end()`, what would `Range(0, 10, 3)` do?

### A sentinel

It would never stop: `it` goes 0, 3, 6, 9, 12, … and is never *equal* to 10. The end of this range isn't a position, it's a **condition**: "reached or passed `stop`".

C++20 allows `end()` to return a different type from `begin()`, a **sentinel**, that's only compared with iterators. The standard has a ready-made one, `std::default_sentinel_t`, so you only write the comparison:

```cpp
std::default_sentinel_t end() const { return std::default_sentinel; }

// in the iterator:
bool operator==(std::default_sentinel_t) const
{
    return step_ > 0 ? current_ >= stop_ : current_ <= stop_;
}
```

Requirements:

- `Range(start, stop, step = 1)` throws `std::invalid_argument` if `step` is 0.
- `Range::iterator` is a forward iterator: `value_type` and `difference_type`, a default constructor, `*it` returns the current `int`, both `++`s, and `==` with another iterator.
- `begin()` and `end()` are `const`.

Range-for and the `std::ranges` algorithms accept a sentinel. The older `std::find(r.begin(), r.end(), 7)` doesn't compile: it needs both ends to be the same type. That's one reason to prefer `std::ranges::find(r, 7)`.

```cpp file=generic/range.h
#pragma once

#include <cstddef>
#include <iterator>
#include <stdexcept>

// The integers from start up to (not including) stop, in steps of step.
// Range(0, 10, 3) is 0 3 6 9; Range(10, 0, -4) is 10 6 2.
class Range {
public:
    class iterator {
    public:
        using value_type = int;
        using difference_type = std::ptrdiff_t;

        iterator() = default;
        iterator(int current, int stop, int step)
            : current_(current), stop_(stop), step_(step)
        {
        }

        int operator*() const { return current_; }

        iterator& operator++()
        {
            current_ += step_;
            return *this;
        }

        iterator operator++(int)
        {
            iterator old = *this;
            current_ += step_;
            return old;
        }

        bool operator==(const iterator&) const = default;

        // Compared with the sentinel: have we reached or passed stop?
        bool operator==(std::default_sentinel_t) const
        {
            return step_ > 0 ? current_ >= stop_ : current_ <= stop_;
        }

    private:
        int current_ = 0;
        int stop_ = 0;
        int step_ = 1;
    };

    Range(int start, int stop, int step = 1)
        : start_(start), stop_(stop), step_(step)
    {
        if (step == 0)
            throw std::invalid_argument("Range: step can't be 0");
    }

    iterator begin() const { return iterator(start_, stop_, step_); }
    std::default_sentinel_t end() const { return std::default_sentinel; }

private:
    int start_;
    int stop_;
    int step_;
};
```

```check
file generic/range.h
contains generic/range.h "std::default_sentinel_t" -- end() returns std::default_sentinel_t.
```

## Step 6 — The reviewer's tests

**This step: create the supplied `generic/tests/range_review_test.cpp`, build, run the tests, and fix `range.h` if any fail.**

If the tests never finish, your sentinel comparison is probably `==` on `stop`: `Range(0, 10, 3)` jumps past 10 and keeps counting. Press **Ctrl+C** to stop it.

```cpp file=generic/tests/range_review_test.cpp provided
// The reviewer's tests for Range. Do not edit them: make them pass.
#include "studio_test.hpp"

#include "range.h"

#include <algorithm>
#include <iterator>
#include <ranges>
#include <stdexcept>
#include <vector>

static_assert(std::forward_iterator<Range::iterator>);
static_assert(std::sentinel_for<std::default_sentinel_t, Range::iterator>);
static_assert(std::ranges::forward_range<Range>);

namespace {
std::vector<int> collect(const Range& r)
{
    std::vector<int> out;
    for (int n : r)
        out.push_back(n);
    return out;
}
} // namespace

TEST(review_counts_up_by_one)
{
    CHECK(collect(Range(0, 5)) == (std::vector<int>{0, 1, 2, 3, 4}));
}

TEST(review_steps_past_stop_without_running_forever)
{
    CHECK(collect(Range(0, 10, 3)) == (std::vector<int>{0, 3, 6, 9}));
}

TEST(review_counts_down)
{
    CHECK(collect(Range(10, 0, -4)) == (std::vector<int>{10, 6, 2}));
}

TEST(review_empty_ranges)
{
    CHECK(collect(Range(5, 5)).empty());
    CHECK(collect(Range(5, 1)).empty());
    CHECK(collect(Range(1, 5, -1)).empty());
}

TEST(review_step_zero_is_rejected)
{
    CHECK_THROWS(Range(0, 5, 0), std::invalid_argument);
}

TEST(review_ranges_algorithms_accept_the_sentinel)
{
    Range r(1, 20, 2);
    CHECK_EQ(std::ranges::count_if(r, [](int n) { return n % 3 == 0; }), 3);
    CHECK(std::ranges::find(r, 7) != r.end());
    CHECK(std::ranges::find(r, 8) == r.end());
}
```

```check
file generic/tests/range_review_test.cpp
run "cmake --build generic/build"
tests "./generic/build/generic_tests" require="review_counts_down review_ranges_algorithms_accept_the_sentinel" timeout=30 -- Counting down, the range ends when current <= stop.
```
