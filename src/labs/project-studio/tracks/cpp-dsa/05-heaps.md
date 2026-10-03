---
title: 5 — Heaps and Priority Queues
track: Data Structures and Algorithms, Measured
runtime: cpp
reference: optional
console: true
---

An operating system picks the most urgent thread to run next. A game picks the next event in time order. A route planner (next lesson) picks the closest unexplored town. All of them need a **priority queue**: add items in any order, and always take out the most important one.

| Keep the items in… | Add | Take the most important |
|---|---|---|
| an unsorted vector | O(1) | O(n): search for it |
| a sorted vector | O(n): shift to make room | O(1) |
| a **binary heap** | O(log n) | O(log n) |

The heap is cheap at both ends, and it's just a vector, so it's cache-friendly too. You'll build one, then use the standard library's.

## Step 1 — A tree stored in a vector

**This step: create the supplied `heap/min_heap.h` and read it.**

A binary heap is a tree with two rules:

1. **Shape:** every level is full except possibly the last, which fills from the left. So the tree can be stored **level by level in a vector**, with no pointers at all.
2. **Order:** every parent is `<=` its children. So the smallest value is always at the root, index 0. (That's a *min*-heap; a max-heap flips the rule.)

```text
            1                 index:  0  1  2  3  4  5
          /   \               value:  1  3  2  7  4  5
         3     2
        / \   /               parent of i:    (i - 1) / 2
       7   4 5                children of i:  2i + 1, 2i + 2
```

Unlike a search tree, a heap isn't sorted: 2 is to the right of 3, and 7 is below 3. It only promises the smallest is on top, and that's much cheaper to maintain.

```cpp file=heap/min_heap.h provided
// min_heap.h: a binary min-heap of ints, stored in a vector.
//
// The tree lives in the vector level by level. For the node at index i:
//   parent at (i - 1) / 2,  children at 2 * i + 1 and 2 * i + 2.
// The heap rule: every parent is <= its children, so the smallest
// value is always at index 0.
#pragma once

#include <cstddef>
#include <vector>

class MinHeap {
public:
    void push(int value);

    // The smallest value. Throws std::out_of_range if the heap is empty.
    int top() const;

    // Removes and returns the smallest value.
    // Throws std::out_of_range if the heap is empty.
    int pop();

    std::size_t size() const;
    bool empty() const;

private:
    // Moves data_[i] up until its parent is <= it.
    void sift_up(std::size_t i);
    // Moves data_[i] down until its children are >= it.
    void sift_down(std::size_t i);

    std::vector<int> data_;
};
```

```check
file heap/min_heap.h
```

## Step 2 — The build file

**This step: create the supplied `heap/CMakeLists.txt`.**

The usual shape: `min_heap_tests`, from the tests and `min_heap.cpp`, in a Release build.

```cmake file=heap/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(heap LANGUAGES CXX)

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
add_executable(min_heap_tests ../testing/test_main.cpp ${TEST_SOURCES} min_heap.cpp)
```

```check
file heap/CMakeLists.txt
```

## Step 3 — The specification

**This step: create the supplied `heap/tests/min_heap_test.cpp` and read it.**

`a_thousand_random_values_come_out_sorted` is the strongest test: whatever order values go in, popping must give them back smallest first. (That's also a sorting algorithm, **heap sort**: n pushes and n pops, O(n log n).)

```cpp file=heap/tests/min_heap_test.cpp provided
// Provided by the lesson: what MinHeap must do.
#include "studio_test.hpp"

#include <random>
#include <vector>

#include "min_heap.h"

TEST(new_heap_is_empty)
{
    MinHeap h;
    CHECK(h.empty());
    CHECK_EQ(h.size(), 0u);
}

TEST(top_is_the_smallest)
{
    MinHeap h;
    h.push(5);
    CHECK_EQ(h.top(), 5);
    h.push(8);
    CHECK_EQ(h.top(), 5);
    h.push(2);
    CHECK_EQ(h.top(), 2);
    CHECK_EQ(h.size(), 3u);
}

TEST(pop_returns_values_smallest_first)
{
    MinHeap h;
    for (int v : {5, 8, 2, 9, 1, 7})
        h.push(v);
    std::vector<int> out;
    while (!h.empty())
        out.push_back(h.pop());
    CHECK(out == (std::vector<int>{1, 2, 5, 7, 8, 9}));
}

TEST(duplicates_all_come_out)
{
    MinHeap h;
    for (int v : {3, 1, 3, 1, 3})
        h.push(v);
    std::vector<int> out;
    while (!h.empty())
        out.push_back(h.pop());
    CHECK(out == (std::vector<int>{1, 1, 3, 3, 3}));
}

TEST(a_thousand_random_values_come_out_sorted)
{
    std::mt19937 rng(1);
    MinHeap h;
    for (int i = 0; i < 1000; ++i)
        h.push(static_cast<int>(rng() % 500));
    int previous = h.pop();
    for (int i = 1; i < 1000; ++i) {
        int next = h.pop();
        CHECK(previous <= next);
        previous = next;
    }
    CHECK(h.empty());
}
```

```check
file heap/tests/min_heap_test.cpp
```

## Step 4 — Sift up, sift down

**This step: create `heap/min_heap.cpp`. Configure, build and run the tests.**

**push**: put the new value at the end (the only place that keeps the shape), then **sift it up**: while it's smaller than its parent, swap them.

```cpp
void MinHeap::sift_up(std::size_t i)
{
    while (i > 0) {
        std::size_t parent = (i - 1) / 2;
        if (data_[parent] <= data_[i])
            return;                     // the heap rule holds: done
        std::swap(data_[parent], data_[i]);
        i = parent;
    }
}
```

**pop**: the root is the answer. To fill its place, move the **last** value to the root (keeping the shape), `pop_back()`, then **sift it down**: while it's bigger than one of its children, swap it with the **smaller** child.

```text
pop from 1,3,2,7,4,5:   take 1; move 5 to the root: 5,3,2,7,4
   5 > smaller child 2: swap        2,3,5,7,4
   5 has no children left: done
```

- Why the smaller child? Whichever child moves up becomes the parent of the other, so it must be the smaller one.
- A child index may be past the end: check `left < data_.size()` (and the same for `right`) before comparing.
- Both loops go down or up one level at a time, and the tree has about log₂ n levels: **O(log n)**.
- `top` and `pop` throw `std::out_of_range` (from `<stdexcept>`) when the heap is empty.

```text
cmake -S heap -B heap/build -G "MinGW Makefiles"     (Windows)
cmake -S heap -B heap/build                          (macOS, Linux)
```

```text
cmake --build heap/build
./heap/build/min_heap_tests
```

```cpp file=heap/min_heap.cpp
#include "min_heap.h"

#include <stdexcept>
#include <utility>

void MinHeap::push(int value)
{
    data_.push_back(value);        // the new leaf, at the end
    sift_up(data_.size() - 1);     // then restore the heap rule above it
}

int MinHeap::top() const
{
    if (data_.empty())
        throw std::out_of_range("MinHeap::top: the heap is empty");
    return data_[0];
}

int MinHeap::pop()
{
    if (data_.empty())
        throw std::out_of_range("MinHeap::pop: the heap is empty");
    int smallest = data_[0];
    data_[0] = data_.back();       // the last leaf fills the hole at the root
    data_.pop_back();
    if (!data_.empty())
        sift_down(0);              // then sinks to where it belongs
    return smallest;
}

std::size_t MinHeap::size() const
{
    return data_.size();
}

bool MinHeap::empty() const
{
    return data_.empty();
}

void MinHeap::sift_up(std::size_t i)
{
    while (i > 0) {
        std::size_t parent = (i - 1) / 2;
        if (data_[parent] <= data_[i])
            return;                         // the heap rule holds: done
        std::swap(data_[parent], data_[i]);
        i = parent;
    }
}

void MinHeap::sift_down(std::size_t i)
{
    while (true) {
        std::size_t left = 2 * i + 1;
        std::size_t right = 2 * i + 2;
        std::size_t smallest = i;   // the smallest of i and its children
        if (left < data_.size() && data_[left] < data_[smallest])
            smallest = left;
        if (right < data_.size() && data_[right] < data_[smallest])
            smallest = right;
        if (smallest == i)
            return;                         // both children are bigger: done
        std::swap(data_[i], data_[smallest]);
        i = smallest;
    }
}
```

```check
file heap/build/CMakeCache.txt label="heap/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build heap/build"
tests "./heap/build/min_heap_tests" -- sift_down must compare with both children, and swap with the smaller one.
```

## Step 5 — The reviewer's tests

**This step: create the supplied `heap/tests/min_heap_review_test.cpp`, rebuild, and fix `min_heap.cpp` if any test fails.**

The reviewer checks that an empty heap throws exactly `std::out_of_range` (`CHECK_THROWS` names the type it expects), that a heap still works after being emptied, and a few awkward orders.

```cpp file=heap/tests/min_heap_review_test.cpp provided
// The reviewer's tests for MinHeap. Do not edit them: make them pass.
#include "studio_test.hpp"

#include <stdexcept>
#include <vector>

#include "min_heap.h"

TEST(review_empty_heap_throws_out_of_range)
{
    MinHeap h;
    CHECK_THROWS(h.top(), std::out_of_range);
    CHECK_THROWS(h.pop(), std::out_of_range);
}

TEST(review_heap_is_usable_after_emptying)
{
    MinHeap h;
    h.push(4);
    CHECK_EQ(h.pop(), 4);
    CHECK_THROWS(h.pop(), std::out_of_range);
    h.push(9);
    CHECK_EQ(h.top(), 9);
}

TEST(review_descending_input)
{
    MinHeap h;
    for (int v = 100; v > 0; --v)
        h.push(v);
    for (int v = 1; v <= 100; ++v)
        CHECK_EQ(h.pop(), v);
}

TEST(review_push_and_pop_interleaved)
{
    MinHeap h;
    h.push(10);
    h.push(4);
    CHECK_EQ(h.pop(), 4);
    h.push(7);
    h.push(1);
    CHECK_EQ(h.pop(), 1);
    CHECK_EQ(h.pop(), 7);
    h.push(3);
    CHECK_EQ(h.pop(), 3);
    CHECK_EQ(h.pop(), 10);
    CHECK(h.empty());
}

TEST(review_negative_values)
{
    MinHeap h;
    for (int v : {0, -5, 3, -20, 8})
        h.push(v);
    CHECK_EQ(h.pop(), -20);
    CHECK_EQ(h.pop(), -5);
}
```

```check
file heap/tests/min_heap_review_test.cpp
run "cmake --build heap/build"
tests "./heap/build/min_heap_tests" require="review_empty_heap_throws_out_of_range review_descending_input" -- Throw std::out_of_range, not another exception type, from top and pop.
```

## Step 6 — Mistake on purpose: an unfair scheduler

**This step: create the supplied `heap/scheduler.cpp`, read it, build it, and run it with the input below.**

The standard library's priority queue is `std::priority_queue`: a binary heap, like yours, on top of a `std::vector`. This scheduler uses it to run the most urgent task first.

- `std::priority_queue` keeps the **largest** element on top, according to a comparison you can supply. Here `RunsLater(a, b)` returns true when `a` should run *after* `b`.
- Its third template argument is the comparison's type: `std::priority_queue<Task, std::vector<Task>, RunsLater>`.

The commands are `add <priority> <name>`, `run` and `count`. Build it, start it in the terminal, and type this, ending with Ctrl+D (macOS, Linux) or Ctrl+Z then Enter (Windows):

```text
add 2 email
add 2 backup
add 2 report
add 2 tests
add 9 deploy
run
run
run
run
run
```

**Predict:** `deploy` runs first. The other four all have priority 2 and were added in the order email, backup, report, tests. In what order do they run?

```cpp file=heap/scheduler.cpp provided
// A task scheduler: the most important task runs first, and tasks with the
// same priority should run in the order they were added.
//
//   add <priority> <name>    queue a task (bigger priority = more urgent)
//   run                      run the most urgent task
//   count                    how many tasks are waiting
#include <iostream>
#include <queue>
#include <string>
#include <vector>

struct Task {
    int priority;
    std::string name;
};

// std::priority_queue keeps the "biggest" element on top, where "a is
// smaller than b" means: a runs later than b.
struct RunsLater {
    bool operator()(const Task& a, const Task& b) const
    {
        return a.priority < b.priority;   // less urgent runs later
    }
};

int main()
{
    std::priority_queue<Task, std::vector<Task>, RunsLater> waiting;
    std::string command;
    while (std::cin >> command) {
        if (command == "add") {
            Task task;
            std::cin >> task.priority >> task.name;
            waiting.push(task);
            std::cout << "added " << task.name << '\n';
        } else if (command == "run") {
            if (waiting.empty()) {
                std::cout << "nothing to run\n";
            } else {
                std::cout << "running " << waiting.top().name << '\n';
                waiting.pop();
            }
        } else if (command == "count") {
            std::cout << waiting.size() << " waiting\n";
        } else {
            std::cout << "unknown command: " << command << '\n';
        }
    }
}
```

### Diagnosis

On the machine these lessons were written on:

```text
running deploy
running report
running backup
running email
running tests
```

A heap is **not stable**: it promises nothing about the order of equal elements. Sifting moves values around the tree, so ties come out in whatever order the swaps left them. Your standard library may print a different order, possibly even the "right" one. That's worse: the bug is still there, it just hides until the input changes.

If ties should run first-come first-served, the comparison has to *say so*.

```check
file heap/scheduler.cpp
run "g++ -std=c++20 -Wall -Wextra -Werror heap/scheduler.cpp -o heap/scheduler"
run "./heap/scheduler" stdin="add 2 email\nadd 2 backup\nadd 2 report\nadd 2 tests\nadd 9 deploy\nrun\nrun\nrun\nrun\nrun\nrun\n" stdout="added deploy\nrunning deploy" label="deploy runs first"
```

## Step 7 — Fix the tie-break

**This step: give every `Task` an `order` number (0 for the first task added, then 1, 2, …) and use it to break ties in `RunsLater`.**

```cpp
bool operator()(const Task& a, const Task& b) const
{
    if (a.priority != b.priority)
        return a.priority < b.priority;   // less urgent runs later
    return a.order > b.order;             // added later runs later
}
```

- Count tasks with a `long added = 0;` in `main`, and set `task.order = added++;` when one is added.
- The comparison now gives every pair of tasks a definite order, so the result no longer depends on how the heap happened to shuffle them. That's the general cure for an unstable algorithm: make the key unique.

Rebuild and run it with the same input. Now it's deploy, then email, backup, report, tests.

**Big-O:** each `add` and each `run` is O(log n). With a sorted vector instead, `add` would be O(n); with an unsorted one, `run` would be.

```cpp file=heap/scheduler.cpp
// A task scheduler: the most important task runs first, and tasks with the
// same priority run in the order they were added.
//
//   add <priority> <name>    queue a task (bigger priority = more urgent)
//   run                      run the most urgent task
//   count                    how many tasks are waiting
#include <iostream>
#include <queue>
#include <string>
#include <vector>

struct Task {
    int priority;
    long order;         // 0 for the first task added, 1 for the next, ...
    std::string name;
};

// std::priority_queue keeps the "biggest" element on top, where "a is
// smaller than b" means: a runs later than b.
struct RunsLater {
    bool operator()(const Task& a, const Task& b) const
    {
        if (a.priority != b.priority)
            return a.priority < b.priority;   // less urgent runs later
        return a.order > b.order;             // added later runs later
    }
};

int main()
{
    std::priority_queue<Task, std::vector<Task>, RunsLater> waiting;
    long added = 0;
    std::string command;
    while (std::cin >> command) {
        if (command == "add") {
            Task task;
            std::cin >> task.priority >> task.name;
            task.order = added++;
            waiting.push(task);
            std::cout << "added " << task.name << '\n';
        } else if (command == "run") {
            if (waiting.empty()) {
                std::cout << "nothing to run\n";
            } else {
                std::cout << "running " << waiting.top().name << '\n';
                waiting.pop();
            }
        } else if (command == "count") {
            std::cout << waiting.size() << " waiting\n";
        } else {
            std::cout << "unknown command: " << command << '\n';
        }
    }
}
```

```check
matches heap/scheduler.cpp "a\.order|b\.order" label="RunsLater compares the order numbers"
run "g++ -std=c++20 -Wall -Wextra -Werror heap/scheduler.cpp -o heap/scheduler"
run "./heap/scheduler" stdin="add 2 email\nadd 2 backup\nadd 2 report\nadd 2 tests\nadd 9 deploy\nrun\nrun\nrun\nrun\nrun\nrun\n" stdout="running deploy\nrunning email\nrunning backup\nrunning report\nrunning tests\nnothing to run" -- When priorities are equal, the task with the smaller order number runs first.
```
