---
title: 4 — Binary Search Trees and std::map
track: Data Structures and Algorithms, Measured
runtime: cpp
reference: optional
console: true
---

A hash map is fast, but it scatters keys: it can't answer "what's the smallest key", "list the keys in order" or "what's the first key after 40". A **binary search tree** keeps keys in order *and* finds them in O(log n) steps, when it's in good shape.

```text
            8               every key in a node's left subtree
          /   \             is smaller than the node's key, and
         3     10           every key in its right subtree is
        / \      \          bigger
       1   6      14
```

To find 6: start at 8, go left (6 < 8), then right (6 > 3), found. Each step goes down one level, so the cost is the tree's **height**. This lesson builds one, breaks it, and shows how `std::map` avoids the break.

## Step 1 — The interface

**This step: create the supplied `bst/int_set.h` and read it.**

- Each `Node` **owns** its two children through `std::unique_ptr`, and the set owns the root. Destroying the root destroys the whole tree, with no hand-written destructor: the rule of zero from track 2.
- `height()` counts the nodes on the longest path down from the root.
- `lower_bound(value)` returns the smallest value that's `>= value`. You'll write it later in the lesson. `std::optional<int>` holds either an int or nothing: "there's no such value" is a normal answer, not an error.

```cpp file=bst/int_set.h provided
// int_set.h: a set of ints stored in a binary search tree.
#pragma once

#include <cstddef>
#include <memory>
#include <optional>
#include <vector>

class IntSet {
public:
    // Adds value. Returns false if it was already in the set.
    bool insert(int value);
    bool contains(int value) const;
    std::size_t size() const;

    // The number of nodes on the longest path down from the root
    // (0 for an empty set, 1 for a single value).
    int height() const;

    // Every value, smallest first.
    std::vector<int> in_order() const;

    // The smallest value that is >= value, if there is one.
    std::optional<int> lower_bound(int value) const;

private:
    struct Node {
        int value;
        std::unique_ptr<Node> left;    // smaller values
        std::unique_ptr<Node> right;   // bigger values
    };

    std::unique_ptr<Node> root_;
    std::size_t size_ = 0;
};
```

```check
file bst/int_set.h
```

## Step 2 — The build file

**This step: create the supplied `bst/CMakeLists.txt`.**

One program for now, `int_set_tests`, from the tests and `int_set.cpp`.

```cmake file=bst/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(bst LANGUAGES CXX)

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
add_executable(int_set_tests ../testing/test_main.cpp ${TEST_SOURCES} int_set.cpp)
```

```check
file bst/CMakeLists.txt
```

## Step 3 — The specification

**This step: create the supplied `bst/tests/int_set_test.cpp` and read it.**

`sorted_input_makes_a_tall_tree` expects 100 sorted inserts to make a tree of height **100**. That's not a typo. Draw what happens when you insert 1, 2, 3, 4 into an empty tree, and you'll see why.

```cpp file=bst/tests/int_set_test.cpp provided
// Provided by the lesson: what IntSet must do.
#include "studio_test.hpp"

#include <vector>

#include "int_set.h"

TEST(new_set_is_empty)
{
    IntSet s;
    CHECK_EQ(s.size(), 0u);
    CHECK_EQ(s.height(), 0);
    CHECK(!s.contains(5));
    CHECK(s.in_order().empty());
}

TEST(insert_then_contains)
{
    IntSet s;
    CHECK(s.insert(8));
    CHECK(s.insert(3));
    CHECK(s.insert(10));
    CHECK(s.contains(8));
    CHECK(s.contains(3));
    CHECK(s.contains(10));
    CHECK(!s.contains(4));
    CHECK_EQ(s.size(), 3u);
}

TEST(duplicates_are_ignored)
{
    IntSet s;
    CHECK(s.insert(5));
    CHECK(!s.insert(5));
    CHECK_EQ(s.size(), 1u);
}

TEST(in_order_is_sorted)
{
    IntSet s;
    for (int v : {8, 3, 10, 1, 6, 14, 4, 7, 13})
        s.insert(v);
    CHECK(s.in_order() == (std::vector<int>{1, 3, 4, 6, 7, 8, 10, 13, 14}));
}

TEST(height_of_a_balanced_tree)
{
    // 8 is the root; 3 and 10 are its children; 1 and 6 are 3's
    // children and 14 is 10's right child: three levels.
    IntSet s;
    for (int v : {8, 3, 10, 1, 6, 14})
        s.insert(v);
    CHECK_EQ(s.height(), 3);
}

TEST(sorted_input_makes_a_tall_tree)
{
    IntSet s;
    for (int v = 1; v <= 100; ++v)
        s.insert(v);
    CHECK_EQ(s.height(), 100);
}
```

```check
file bst/tests/int_set_test.cpp
```

## Step 4 — Insert, find, and walk in order

**This step: create `bst/int_set.cpp` with `insert`, `contains`, `size`, `height` and `in_order`. Configure, build and run the tests.**

**Insert** walks down from the root to the empty spot where the value belongs. The neat trick is to walk with a pointer *to the `unique_ptr`* that will hold the new node, so the root needs no special case:

```cpp
std::unique_ptr<Node>* slot = &root_;
while (*slot) {                       // while that spot has a node
    Node& node = **slot;
    if (value == node.value)
        return false;                 // already there
    slot = value < node.value ? &node.left : &node.right;
}
*slot = std::make_unique<Node>(Node{value, nullptr, nullptr});
```

**Contains** is the same walk, with a plain `const Node*` that follows `left.get()` or `right.get()`.

**Height** and **in-order traversal** are naturally **recursive**: a tree is a node plus two smaller trees.

```cpp
// in_order: everything in the left subtree, then this node,
// then everything in the right subtree, so values come out sorted.
visit_in_order(node->left.get(), out);
out.push_back(node->value);
visit_in_order(node->right.get(), out);
```

- The recursive helpers take a `const Node*` and stop at `nullptr`. `Node` is private, so write them as templates (`template <typename Node>`) inside an unnamed `namespace { }` in the `.cpp` file: the template finds the type when it's called.
- A tree's height is 0 when empty, otherwise 1 + the larger of its subtrees' heights (`std::max`, from `<algorithm>`).
- Leave `lower_bound` for later. It's declared but not defined, which is fine as long as nothing calls it yet.

```text
cmake -S bst -B bst/build -G "MinGW Makefiles"     (Windows)
cmake -S bst -B bst/build                          (macOS, Linux)
```

```text
cmake --build bst/build
./bst/build/int_set_tests
```

```cpp file=bst/int_set.cpp
#include "int_set.h"

#include <algorithm>

bool IntSet::insert(int value)
{
    // slot points at the unique_ptr where value belongs: start at the root
    // and go left or right until we reach an empty one.
    std::unique_ptr<Node>* slot = &root_;
    while (*slot) {
        Node& node = **slot;
        if (value == node.value)
            return false;
        slot = value < node.value ? &node.left : &node.right;
    }
    *slot = std::make_unique<Node>(Node{value, nullptr, nullptr});
    ++size_;
    return true;
}

bool IntSet::contains(int value) const
{
    const Node* node = root_.get();
    while (node) {
        if (value == node->value)
            return true;
        node = value < node->value ? node->left.get() : node->right.get();
    }
    return false;
}

std::size_t IntSet::size() const
{
    return size_;
}

// Helpers that only this file needs go in an unnamed namespace.
namespace {

template <typename Node>
int height_of(const Node* node)
{
    if (!node)
        return 0;
    return 1 + std::max(height_of(node->left.get()),
                        height_of(node->right.get()));
}

template <typename Node>
void visit_in_order(const Node* node, std::vector<int>& out)
{
    if (!node)
        return;
    visit_in_order(node->left.get(), out);    // everything smaller first
    out.push_back(node->value);               // then this node
    visit_in_order(node->right.get(), out);   // then everything bigger
}

} // namespace

int IntSet::height() const
{
    return height_of(root_.get());
}

std::vector<int> IntSet::in_order() const
{
    std::vector<int> out;
    visit_in_order(root_.get(), out);
    return out;
}
```

```check
file bst/build/CMakeCache.txt label="bst/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build bst/build"
tests "./bst/build/int_set_tests" -- insert must stop and return false when it meets a node holding the same value.
```

## Step 5 — The degenerate tree

**This step: create the supplied `bst/main.cpp`, add a `heights` program to `bst/CMakeLists.txt`, then build and run it.**

```cmake
add_executable(heights main.cpp int_set.cpp)
```

`main.cpp` inserts the keys 0 to 1999 into one IntSet in shuffled order, into another in sorted order, and into a `std::map` in sorted order. Then it prints the heights and times lookups.

**Predict:** what's the height of each IntSet? (log₂ 2000 is about 11.) How much slower are lookups in the sorted one?

```text
cmake --build bst/build
./bst/build/heights
```

```cpp file=bst/main.cpp provided
// The same 2000 keys, inserted in two different orders.
#include <cstdint>
#include <iomanip>
#include <iostream>
#include <map>
#include <random>
#include <utility>
#include <vector>

#include "bench.h"
#include "int_set.h"

// 0, 1, 2, ... n-1, shuffled. A hand-written shuffle (Fisher-Yates) with
// std::mt19937 gives the same order with every compiler.
std::vector<int> shuffled(int n)
{
    std::vector<int> v;
    for (int i = 0; i < n; ++i)
        v.push_back(i);
    std::mt19937 rng(7);
    for (int i = n - 1; i > 0; --i)
        std::swap(v[i], v[rng() % (i + 1)]);
    return v;
}

template <typename Set>
double time_lookups(const Set& set, int n)
{
    return bench::median_ns([&] {
        std::uint64_t found = 0;
        for (int key = 0; key < n; ++key)
            found += set.contains(key) ? 1 : 0;
        bench::keep(found);
    }) / n;
}

int main()
{
    const int n = 2000;
    IntSet random_tree;
    for (int key : shuffled(n))
        random_tree.insert(key);
    IntSet sorted_tree;
    for (int key = 0; key < n; ++key)
        sorted_tree.insert(key);
    std::map<int, bool> balanced;
    for (int key = 0; key < n; ++key)
        balanced[key] = true;

    std::cout << "random order: " << random_tree.size() << " keys, height "
              << random_tree.height() << '\n';
    std::cout << "sorted order: " << sorted_tree.size() << " keys, height "
              << sorted_tree.height() << '\n';

    std::cout << "\nTime to find one key:\n" << std::fixed
              << std::setprecision(1)
              << "  random-order IntSet " << std::setw(9)
              << time_lookups(random_tree, n) << " ns\n"
              << "  sorted-order IntSet " << std::setw(9)
              << time_lookups(sorted_tree, n) << " ns\n"
              << "  std::map (sorted)   " << std::setw(9)
              << time_lookups(balanced, n) << " ns\n";
}
```

### What happened

```text
random order: 2000 keys, height 27
sorted order: 2000 keys, height 2000

Time to find one key:
  random-order IntSet      45.2 ns
  sorted-order IntSet    1566.9 ns
  std::map (sorted)        49.0 ns
```

Inserting sorted keys sends every new key to the right of the last one. The "tree" is a linked list leaning to the right, and every operation is **O(n)**. Random order gives a height of 27: not the ideal 11, but still O(log n) on average.

Sorted input is common in real life (ids, timestamps, names read from a sorted file), so a plain BST is a trap. `std::map` is a **red-black tree**: after each insert or erase it checks a few colour rules and **rotates** nodes where needed to stay balanced:

```text
  1                     2
   \     rotate left   / \
    2    ──────────►  1   3
     \
      3
```

Its height is never more than about 2 × log₂ n, whatever the order of the keys, so `std::map` guarantees O(log n) for insert, find and erase.

> Recursion depth matters too. `height()` on the sorted tree recurses 2,000 deep. With a million sorted keys, it, and the destructor chain of `unique_ptr`s, would **overflow the stack** and crash. Balanced trees never get that deep.

```check
contains bst/CMakeLists.txt "add_executable(heights" -- Add add_executable(heights main.cpp int_set.cpp) to the end of CMakeLists.txt.
run "cmake --build bst/build"
run "./bst/build/heights" stdout="sorted order: 2000 keys, height 2000"
run "./bst/build/heights" stdout="random order: 2000 keys, height 27"
```

## Step 6 — Ordered queries: the specification

**This step: create the supplied `bst/tests/lower_bound_test.cpp` and read it.**

An **ordered query** asks about keys near a value, not equal to it: "the first appointment at or after 14:00", "the cheapest flight costing at least £100". A hash map can't answer those without looking at every key. A search tree can, in O(height).

The test program won't link until `lower_bound` is defined.

```cpp file=bst/tests/lower_bound_test.cpp provided
// Provided by the lesson: what IntSet::lower_bound must do.
#include "studio_test.hpp"

#include "int_set.h"

namespace {

IntSet example()
{
    IntSet s;
    for (int v : {20, 10, 30, 5, 15, 25, 35})
        s.insert(v);
    return s;
}

} // namespace

TEST(lower_bound_finds_an_exact_match)
{
    CHECK(example().lower_bound(15) == 15);
    CHECK(example().lower_bound(20) == 20);
}

TEST(lower_bound_finds_the_next_bigger_value)
{
    CHECK(example().lower_bound(16) == 20);
    CHECK(example().lower_bound(21) == 25);
    CHECK(example().lower_bound(-100) == 5);
}

TEST(lower_bound_past_the_end_is_empty)
{
    CHECK(!example().lower_bound(36).has_value());
    CHECK(!IntSet{}.lower_bound(0).has_value());
}
```

```check
file bst/tests/lower_bound_test.cpp
```

## Step 7 — Challenge: lower_bound

**This step: no code is given. Define `IntSet::lower_bound` in `bst/int_set.cpp` and make every test pass.**

Walk down from the root, once, and remember the best candidate so far:

- If a node's value is `>= value`, it's a candidate. A *smaller* candidate can only be in its left subtree, so go left.
- Otherwise the node is too small, and so is its whole left subtree: go right.
- When you fall off the tree, the last candidate you remembered is the answer (or there wasn't one).

Return the candidate as `std::optional<int>`: an empty `std::optional<int>` (`{}` or `std::nullopt`) means "none".

```cpp file=bst/int_set.cpp
#include "int_set.h"

#include <algorithm>

bool IntSet::insert(int value)
{
    // slot points at the unique_ptr where value belongs: start at the root
    // and go left or right until we reach an empty one.
    std::unique_ptr<Node>* slot = &root_;
    while (*slot) {
        Node& node = **slot;
        if (value == node.value)
            return false;
        slot = value < node.value ? &node.left : &node.right;
    }
    *slot = std::make_unique<Node>(Node{value, nullptr, nullptr});
    ++size_;
    return true;
}

bool IntSet::contains(int value) const
{
    const Node* node = root_.get();
    while (node) {
        if (value == node->value)
            return true;
        node = value < node->value ? node->left.get() : node->right.get();
    }
    return false;
}

std::size_t IntSet::size() const
{
    return size_;
}

// Helpers that only this file needs go in an unnamed namespace.
namespace {

template <typename Node>
int height_of(const Node* node)
{
    if (!node)
        return 0;
    return 1 + std::max(height_of(node->left.get()),
                        height_of(node->right.get()));
}

template <typename Node>
void visit_in_order(const Node* node, std::vector<int>& out)
{
    if (!node)
        return;
    visit_in_order(node->left.get(), out);    // everything smaller first
    out.push_back(node->value);               // then this node
    visit_in_order(node->right.get(), out);   // then everything bigger
}

} // namespace

int IntSet::height() const
{
    return height_of(root_.get());
}

std::vector<int> IntSet::in_order() const
{
    std::vector<int> out;
    visit_in_order(root_.get(), out);
    return out;
}

std::optional<int> IntSet::lower_bound(int value) const
{
    std::optional<int> best;   // the smallest value >= value seen so far
    const Node* node = root_.get();
    while (node) {
        if (node->value >= value) {
            best = node->value;       // a candidate; a smaller one may be left
            node = node->left.get();
        } else {
            node = node->right.get(); // too small: look right
        }
    }
    return best;
}
```

```check
matches bst/int_set.cpp "IntSet::lower_bound\s*\(" label="int_set.cpp defines lower_bound"
run "cmake --build bst/build"
tests "./bst/build/int_set_tests" require="lower_bound_finds_an_exact_match lower_bound_finds_the_next_bigger_value" -- A node >= value is only a candidate: keep going left to look for a smaller one.
```

## Step 8 — Your own tests: what std::map can do

**This step: create `bst/tests/map_test.cpp` with at least three tests that pin down how `std::map`'s ordered queries behave.**

Writing tests against a library is a good way to learn it exactly: each test records a fact you checked, instead of one you assumed. Cover:

- **iteration order**: a `std::map` visits its keys in sorted order, whatever order they were inserted in;
- **`lower_bound(k)`**: an iterator to the first key `>= k`, or `end()` if there's none;
- **`upper_bound(k)`**: the first key `> k`. Together, `lower_bound(a)` up to `upper_bound(b)` is every key in `[a, b]`.

```cpp
std::map<int, std::string> m{{50, "Ada"}, {70, "Grace"}, {90, "Alan"}};
CHECK_EQ(m.lower_bound(71)->second, std::string("Alan"));
```

- `->second` is the value of the key–value pair the iterator points to. Compare an iterator with `m.end()` before using it.

```cpp file=bst/tests/map_test.cpp
// My tests: what std::map's ordered queries do.
#include "studio_test.hpp"

#include <map>
#include <string>

namespace {

std::map<int, std::string> scores()
{
    return {{50, "Ada"}, {70, "Grace"}, {90, "Alan"}};
}

} // namespace

TEST(map_iterates_in_key_order)
{
    std::map<int, std::string> m{{90, "Alan"}, {50, "Ada"}, {70, "Grace"}};
    std::string names;
    for (const auto& [score, name] : m)
        names += name + " ";
    CHECK_EQ(names, std::string("Ada Grace Alan "));
}

TEST(map_lower_bound_includes_the_key)
{
    auto m = scores();
    CHECK_EQ(m.lower_bound(70)->second, std::string("Grace"));
    CHECK_EQ(m.lower_bound(71)->second, std::string("Alan"));
    CHECK(m.lower_bound(91) == m.end());
}

TEST(map_upper_bound_excludes_the_key)
{
    auto m = scores();
    CHECK_EQ(m.upper_bound(70)->second, std::string("Alan"));
    CHECK(m.upper_bound(90) == m.end());
}

TEST(map_range_between_two_bounds)
{
    auto m = scores();
    int count = 0;
    for (auto it = m.lower_bound(60); it != m.upper_bound(90); ++it)
        ++count;
    CHECK_EQ(count, 2);
}
```

```check
matches bst/tests/map_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="map_test.cpp has at least three tests"
contains bst/tests/map_test.cpp "lower_bound"
contains bst/tests/map_test.cpp "upper_bound"
run "cmake --build bst/build"
tests "./bst/build/int_set_tests"
```
