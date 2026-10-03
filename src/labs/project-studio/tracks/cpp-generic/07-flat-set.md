---
title: 7 — Challenge: a Generic Container from a Specification
track: Generic Programming
runtime: cpp
reference: optional
console: true
---

This lesson gives you requirements and tests, not code. Everything you need has appeared in this track: a class template, a concept, iterators, function objects and the ranges algorithms.

You'll build **`FlatSet<T, Compare>`**: a set of unique values kept in a **sorted `std::vector`**. Looking up a value is a binary search, and iterating is as fast as iterating a vector. For small and medium sets that are read more than they change, it often beats `std::set`, whose nodes are scattered around memory. (C++23 adds a standard `std::flat_set`.)

## Step 1 — Requirements and specification

**This step: read the requirements, then create the supplied `generic/tests/flat_set_test.cpp`.**

`template <std::copyable T, typename Compare = std::ranges::less> class FlatSet`

| Member | Does |
|---|---|
| `FlatSet()`, `FlatSet(compare)` | an empty set, with a default or given comparator |
| `FlatSet{3, 1, 2}` | from an initializer list: the values inserted in turn |
| `insert(v)` | adds `v` in sorted position; `false` if an equivalent value is already there |
| `contains(v)` | binary search |
| `erase(v)` | removes the equivalent value; `false` if there was none |
| `size()`, `empty()` | |
| `begin()`, `end()` | the vector's `const_iterator`s, so the set is read-only from outside |

**Equivalent, not equal.** A set ordered by `Compare` treats `a` and `b` as the same value when neither comes first: `!comp(a, b) && !comp(b, a)`. It never uses `==`. For a comparator that ignores case, `"Apple"` and `"apple"` are the same value.

**Constrain it.** `Compare` must define a strict weak ordering on `T`: there's a standard concept, `std::strict_weak_order<Compare, const T&, const T&>`. Put it in a `requires` clause after the template header.

**Use the algorithms.** `std::ranges::lower_bound(items_, value, compare_)` finds where `value` belongs, in O(log n) steps; `std::ranges::binary_search` answers "is it there?".

```cpp file=generic/tests/flat_set_test.cpp provided
// Provided by the lesson: the specification for FlatSet.
#include "studio_test.hpp"

#include "flat_set.h"

#include <functional>
#include <iterator>
#include <ranges>
#include <string>
#include <vector>

static_assert(std::ranges::random_access_range<FlatSet<int>>);

namespace {
template <typename Set>
std::vector<typename Set::const_iterator::value_type> items(const Set& set)
{
    return {set.begin(), set.end()};
}
} // namespace

TEST(a_new_set_is_empty)
{
    FlatSet<int> s;
    CHECK(s.empty());
    CHECK_EQ(s.size(), 0u);
}

TEST(insert_keeps_values_sorted)
{
    FlatSet<int> s;
    for (int v : {5, 1, 4, 2, 3})
        s.insert(v);
    CHECK(items(s) == (std::vector<int>{1, 2, 3, 4, 5}));
}

TEST(insert_ignores_duplicates)
{
    FlatSet<int> s;
    CHECK(s.insert(7));
    CHECK(!s.insert(7));
    CHECK_EQ(s.size(), 1u);
}

TEST(contains_finds_only_inserted_values)
{
    FlatSet<std::string> s{"pear", "apple", "fig"};
    CHECK(s.contains("fig"));
    CHECK(!s.contains("kiwi"));
}

TEST(erase_removes_a_value)
{
    FlatSet<int> s{3, 1, 2};
    CHECK(s.erase(2));
    CHECK(!s.erase(2));
    CHECK(items(s) == (std::vector<int>{1, 3}));
}

TEST(a_comparator_sets_the_order)
{
    FlatSet<int, std::greater<int>> s{1, 3, 2};
    CHECK(items(s) == (std::vector<int>{3, 2, 1}));
}

TEST(views_and_algorithms_work_on_a_set)
{
    FlatSet<int> s{4, 8, 15, 16, 23, 42};
    auto even = s | std::views::filter([](int n) { return n % 2 == 0; });
    CHECK_EQ(std::ranges::distance(even), 4);
    CHECK_EQ(*std::ranges::find_if(s, [](int n) { return n > 10; }), 15);
}
```

```check
file generic/tests/flat_set_test.cpp
```

## Step 2 — Build FlatSet

**This step: no code is given. Create `generic/flat_set.h` and make the specification pass.**

Hints, if you need them:

- Store the comparator as a member, `Compare compare_{};`, and pass it to every algorithm.
- `insert`: find the `lower_bound`. If it isn't `end()` and the value there is equivalent (`!compare_(value, *at)`), return `false`. Otherwise `items_.insert(at, value)`.
- `std::vector<T>::const_iterator` needs `typename` in front inside a template: `using const_iterator = typename std::vector<T>::const_iterator;`. The compiler can't know it's a type until it knows `T`.

```cpp file=generic/flat_set.h
#pragma once

#include <algorithm>
#include <concepts>
#include <cstddef>
#include <functional>
#include <initializer_list>
#include <utility>
#include <vector>

// A set kept as a sorted vector: fast lookups by binary search, and
// cache-friendly iteration. Compare decides the order, and two values
// are "the same" when neither comes before the other.
template <std::copyable T, typename Compare = std::ranges::less>
    requires std::strict_weak_order<Compare, const T&, const T&>
class FlatSet {
public:
    using const_iterator = typename std::vector<T>::const_iterator;

    FlatSet() = default;
    explicit FlatSet(Compare compare) : compare_(std::move(compare)) {}

    FlatSet(std::initializer_list<T> values, Compare compare = Compare())
        : compare_(std::move(compare))
    {
        for (const T& value : values)
            insert(value);
    }

    bool insert(const T& value)
    {
        auto at = std::ranges::lower_bound(items_, value, compare_);
        if (at != items_.end() && !compare_(value, *at))
            return false; // an equivalent value is already here
        items_.insert(at, value);
        return true;
    }

    bool contains(const T& value) const
    {
        return std::ranges::binary_search(items_, value, compare_);
    }

    bool erase(const T& value)
    {
        auto at = std::ranges::lower_bound(items_, value, compare_);
        if (at == items_.end() || compare_(value, *at))
            return false;
        items_.erase(at);
        return true;
    }

    std::size_t size() const { return items_.size(); }
    bool empty() const { return items_.empty(); }

    const_iterator begin() const { return items_.begin(); }
    const_iterator end() const { return items_.end(); }

private:
    std::vector<T> items_;
    Compare compare_{};
};
```

```check
contains generic/flat_set.h "std::strict_weak_order"
run "cmake --build generic/build"
tests "./generic/build/generic_tests" require="insert_keeps_values_sorted insert_ignores_duplicates a_comparator_sets_the_order views_and_algorithms_work_on_a_set"
```

## Step 3 — Your own tests

**This step: create `generic/tests/flat_set_own_test.cpp` with at least three tests, one of them using a lambda as the comparator.**

A lambda's type has no name you can write, so get it with `decltype`, and pass the lambda itself to the constructor:

```cpp
auto shorter = [](const std::string& a, const std::string& b) {
    return a.size() < b.size();
};
FlatSet<std::string, decltype(shorter)> s(shorter);
```

What does `s.insert("two")` return after `s.insert("one")`? Write a test that pins down your answer.

Other ideas: the smallest and largest values end up first and last; erasing from an empty set; a set built from a list with duplicates.

```cpp file=generic/tests/flat_set_own_test.cpp
// My tests for FlatSet.
#include "studio_test.hpp"

#include "flat_set.h"

#include <string>
#include <vector>

TEST(inserting_the_smallest_and_largest)
{
    FlatSet<int> s{5};
    s.insert(9);
    s.insert(1);
    CHECK_EQ(*s.begin(), 1);
    CHECK_EQ(*(s.end() - 1), 9);
}

TEST(erase_from_an_empty_set_is_harmless)
{
    FlatSet<int> s;
    CHECK(!s.erase(3));
    CHECK(s.empty());
}

TEST(a_lambda_comparator_by_length)
{
    auto shorter = [](const std::string& a, const std::string& b) {
        return a.size() < b.size();
    };
    FlatSet<std::string, decltype(shorter)> s(shorter);
    s.insert("three");
    s.insert("one");
    CHECK(!s.insert("two")); // same length as "one": equivalent
    CHECK_EQ(*s.begin(), "one");
}
```

```check
matches generic/tests/flat_set_own_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="flat_set_own_test.cpp has at least three tests"
contains generic/tests/flat_set_own_test.cpp "decltype"
run "cmake --build generic/build"
tests "./generic/build/generic_tests"
```

## Step 4 — The reviewer's tests

**This step: create the supplied `generic/tests/flat_set_review_test.cpp`, build, run the tests, and fix `flat_set.h` until everything passes.**

The reviewer checks three things the specification didn't:

- **Equivalence**: a case-insensitive set must find `"APPLE"` when it holds `"Apple"`. Anything that uses `==`, such as `std::ranges::find`, gets this wrong.
- **A compile-time requirement**: `FlatSet<Point>`, for a `Point` with no `<`, must be rejected *by the constraint*, so a `requires` expression can detect it.
- A `const` set can be searched and iterated.

If the `static_assert` about `Point` fails, look at your default comparator. `std::less<T>` *declares* a call operator for every `T`, so the concept check believes it works, and the error only appears later, inside the body. `std::ranges::less` is itself constrained: it only accepts types that really have `<`. That's the difference between a constrained and an unconstrained function object, and the reason the requirements asked for `std::ranges::less`.

When this passes, you've designed a generic container that works with range-for, every `std::ranges` algorithm and every view, with any type and any ordering, and that rejects the wrong ones with a clear error.

```cpp file=generic/tests/flat_set_review_test.cpp provided
// The reviewer's tests for FlatSet. Do not edit them: make them pass.
#include "studio_test.hpp"

#include "flat_set.h"

#include <cctype>
#include <string>
#include <vector>

namespace {

// Orders words ignoring case: "Apple" and "apple" are equivalent.
struct IgnoreCase {
    bool operator()(const std::string& a, const std::string& b) const
    {
        return std::lexicographical_compare(
            a.begin(), a.end(), b.begin(), b.end(), [](char x, char y) {
                return std::tolower(static_cast<unsigned char>(x)) <
                       std::tolower(static_cast<unsigned char>(y));
            });
    }
};

struct Point { // has no < at all
    int x, y;
};

template <typename T>
concept CanMakeFlatSet = requires {
    typename FlatSet<T>;
    FlatSet<T>{};
};

} // namespace

static_assert(CanMakeFlatSet<int>);
static_assert(!CanMakeFlatSet<Point>, "FlatSet<Point> needs a comparator");

TEST(review_equivalent_is_not_the_same_as_equal)
{
    FlatSet<std::string, IgnoreCase> s{"Apple", "banana"};
    CHECK(s.contains("APPLE"));
    CHECK(!s.insert("apple"));
    CHECK(s.erase("BANANA"));
    CHECK_EQ(s.size(), 1u);
}

TEST(review_a_large_set_stays_sorted_and_unique)
{
    FlatSet<int> s;
    for (int i = 0; i < 1000; ++i)
        s.insert((i * 37) % 101);
    CHECK_EQ(s.size(), 101u);
    std::vector<int> v(s.begin(), s.end());
    for (std::size_t i = 1; i < v.size(); ++i)
        CHECK(v[i - 1] < v[i]);
}

TEST(review_a_const_set_can_be_searched_and_iterated)
{
    const FlatSet<int> s{2, 4, 6};
    CHECK(s.contains(4));
    int total = 0;
    for (int n : s)
        total += n;
    CHECK_EQ(total, 12);
}
```

```check
file generic/tests/flat_set_review_test.cpp
run "cmake --build generic/build" -- If the static_assert about Point fails, the default comparator must be std::ranges::less.
tests "./generic/build/generic_tests" require="review_equivalent_is_not_the_same_as_equal review_a_large_set_stays_sorted_and_unique review_a_const_set_can_be_searched_and_iterated" -- Search with the comparator (lower_bound, binary_search), never with ==.
```
