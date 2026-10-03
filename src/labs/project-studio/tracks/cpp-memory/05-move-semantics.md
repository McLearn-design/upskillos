---
title: 5 — Move Semantics: Stealing Instead of Copying
track: Memory, Lifetime and Ownership
runtime: cpp
reference: optional
console: true
---

A deep copy is correct, but it isn't free: copying a million-element array allocates and copies a million ints. Often the source is about to be thrown away anyway: a temporary, or a local that's being returned. Copying from something nobody will use again is waste.

C++11 added **move semantics**: a way to say "you may steal from this object". This lesson adds moving to `IntArray`, and ends with the rule that makes most of this unnecessary.

## Step 1 — The specification for moving

**This step: create the supplied `dynarray/tests/move_test.cpp` and read it.**

```cpp
IntArray b = std::move(a);
CHECK(b.data() == buffer);   // same memory: nothing was copied
CHECK_EQ(a.size(), 0u);      // the moved-from array is empty, and owns nothing
```

- A move hands the **buffer itself** to the new object, and leaves the source empty. No allocation, no copying of elements.
- The source is left in a **valid but unspecified** state. For `IntArray` that means empty and still usable: the test pushes to it afterwards.
- `moves_promise_not_to_throw`: `std::vector` only moves its elements when it grows if moving can't throw. Otherwise it copies, to keep its strong exception guarantee.

```cpp file=dynarray/tests/move_test.cpp provided
// Provided by the lesson: what moving an IntArray must do.
#include "studio_test.hpp"

#include "int_array.h"

#include <type_traits>
#include <utility>
#include <vector>

TEST(move_construction_steals_the_buffer)
{
    IntArray a(3);
    a[0] = 7;
    const int* buffer = a.data();
    IntArray b = std::move(a);
    CHECK(b.data() == buffer);        // same memory: nothing was copied
    CHECK_EQ(b.size(), 3u);
    CHECK_EQ(b[0], 7);
    CHECK_EQ(a.size(), 0u);           // the moved-from array is empty...
    CHECK(a.data() == nullptr);       // ...and owns nothing
}

TEST(move_assignment_steals_the_buffer_and_frees_the_old_one)
{
    IntArray a(2);
    a[1] = 5;
    const int* buffer = a.data();
    IntArray b(100);
    b = std::move(a);
    CHECK(b.data() == buffer);
    CHECK_EQ(b.size(), 2u);
    CHECK_EQ(b[1], 5);
    CHECK_EQ(a.size(), 0u);
}

TEST(a_moved_from_array_can_be_used_again)
{
    IntArray a(2);
    IntArray b = std::move(a);
    a.push_back(42);                   // valid, empty state: still usable
    CHECK_EQ(a.size(), 1u);
    CHECK_EQ(a[0], 42);
}

TEST(moves_promise_not_to_throw)
{
    // std::vector only moves its elements when it grows if the move can't throw.
    CHECK(std::is_nothrow_move_constructible_v<IntArray>);
    CHECK(std::is_nothrow_move_assignable_v<IntArray>);
}

TEST(a_vector_of_arrays_grows_by_moving)
{
    std::vector<IntArray> arrays;
    for (int i = 0; i < 100; ++i) {
        IntArray a(1);
        a[0] = i;
        arrays.push_back(std::move(a));
    }
    CHECK_EQ(arrays.size(), 100u);
    CHECK_EQ(arrays[99][0], 99);
}
```

```check
file dynarray/tests/move_test.cpp
```

## Step 2 — Declare the moves

**This step: add `data()`, a move constructor and a move assignment operator to `dynarray/int_array.h`.**

```cpp
IntArray(IntArray&& other) noexcept;              // move constructor
IntArray& operator=(IntArray&& other) noexcept;   // move assignment
const int* data() const;                          // where the buffer is (the tests compare it)
```

- `IntArray&&` is an **rvalue reference**: it binds to objects that are about to disappear (temporaries) or that you've explicitly marked with `std::move`. That's how the compiler picks the move over the copy.
- `noexcept` promises the function never throws. Moving only re-points a pointer, so it can't fail.

```cpp file=dynarray/int_array.h
#pragma once

#include <cstddef>

// A resizable array of ints that owns its memory — a small std::vector<int>.
class IntArray {
public:
    IntArray();                            // empty
    explicit IntArray(std::size_t size);   // `size` elements, all zero
    ~IntArray();

    IntArray(const IntArray& other);              // copy constructor
    IntArray& operator=(const IntArray& other);   // copy assignment

    IntArray(IntArray&& other) noexcept;              // move constructor
    IntArray& operator=(IntArray&& other) noexcept;   // move assignment

    std::size_t size() const;
    std::size_t capacity() const;
    const int* data() const;
    int& operator[](std::size_t index);
    const int& operator[](std::size_t index) const;

    int& at(std::size_t index);                // throws std::out_of_range
    const int& at(std::size_t index) const;

    void push_back(int value);
    void pop_back();                           // throws std::out_of_range if empty

private:
    int* data_;
    std::size_t size_;
    std::size_t capacity_;
};
```

```check
matches dynarray/int_array.h "IntArray\s*\(\s*IntArray\s*&&[^)]*\)\s*noexcept" label="declares the move constructor, noexcept"
matches dynarray/int_array.h "IntArray\s*&\s*operator=\s*\(\s*IntArray\s*&&[^)]*\)\s*noexcept" label="declares move assignment, noexcept"
matches dynarray/int_array.h "const\s+int\s*\*\s*data\s*\(\s*\)\s*const" label="declares const int* data() const"
```

## Step 3 — Steal the buffer

**This step: define `data`, the move constructor and move assignment in `dynarray/int_array.cpp`.**

```cpp
IntArray::IntArray(IntArray&& other) noexcept
    : data_(other.data_), size_(other.size_), capacity_(other.capacity_)
{
    other.data_ = nullptr;   // other's destructor must not free what we took
    other.size_ = 0;
    other.capacity_ = 0;
}
```

Move assignment is the same idea, but first `delete[]` the buffer this object already owns. Guard against `a = std::move(a);` the way copy assignment does.

```cpp file=dynarray/int_array.cpp
#include "int_array.h"

#include <stdexcept>

IntArray::IntArray() : data_(nullptr), size_(0), capacity_(0)
{
}

IntArray::IntArray(std::size_t size) : data_(new int[size]()), size_(size), capacity_(size)
{
}

IntArray::IntArray(const IntArray& other)
    : data_(other.capacity_ ? new int[other.capacity_] : nullptr), size_(other.size_), capacity_(other.capacity_)
{
    for (std::size_t i = 0; i < size_; ++i)
        data_[i] = other.data_[i];
}

IntArray& IntArray::operator=(const IntArray& other)
{
    if (this == &other)
        return *this;
    IntArray copy(other);            // copy first: if that throws, *this is untouched
    delete[] data_;
    data_ = copy.data_;
    size_ = copy.size_;
    capacity_ = copy.capacity_;
    copy.data_ = nullptr;            // copy no longer owns the buffer
    return *this;
}

IntArray::IntArray(IntArray&& other) noexcept
    : data_(other.data_), size_(other.size_), capacity_(other.capacity_)
{
    // Take the buffer, and leave `other` empty but valid: its destructor must not free what we took.
    other.data_ = nullptr;
    other.size_ = 0;
    other.capacity_ = 0;
}

IntArray& IntArray::operator=(IntArray&& other) noexcept
{
    if (this == &other)
        return *this;
    delete[] data_;
    data_ = other.data_;
    size_ = other.size_;
    capacity_ = other.capacity_;
    other.data_ = nullptr;
    other.size_ = 0;
    other.capacity_ = 0;
    return *this;
}

IntArray::~IntArray()
{
    delete[] data_;
}

std::size_t IntArray::size() const
{
    return size_;
}

std::size_t IntArray::capacity() const
{
    return capacity_;
}

const int* IntArray::data() const
{
    return data_;
}

int& IntArray::operator[](std::size_t index)
{
    return data_[index];
}

const int& IntArray::operator[](std::size_t index) const
{
    return data_[index];
}

void IntArray::push_back(int value)
{
    if (size_ == capacity_) {
        const std::size_t new_capacity = capacity_ == 0 ? 4 : capacity_ * 2;
        int* bigger = new int[new_capacity];
        for (std::size_t i = 0; i < size_; ++i)
            bigger[i] = data_[i];
        delete[] data_;
        data_ = bigger;
        capacity_ = new_capacity;
    }
    data_[size_] = value;
    ++size_;
}

int& IntArray::at(std::size_t index)
{
    if (index >= size_)
        throw std::out_of_range("IntArray::at: index out of range");
    return data_[index];
}

const int& IntArray::at(std::size_t index) const
{
    if (index >= size_)
        throw std::out_of_range("IntArray::at: index out of range");
    return data_[index];
}

void IntArray::pop_back()
{
    if (size_ == 0)
        throw std::out_of_range("IntArray::pop_back: array is empty");
    --size_;
}
```

```check
run "cmake --build dynarray/build"
run "./dynarray/build/int_array_tests" stdout="[       OK ] move_construction_steals_the_buffer" -- Take other's pointer, then set other.data_ to nullptr.
run "./dynarray/build/int_array_tests" stdout="[       OK ] a_moved_from_array_can_be_used_again" -- Leave the source empty: size 0, capacity 0, no buffer.
run "./dynarray/build/int_array_tests" stdout=" passed, 0 failed"
```

## Step 4 — Predict: what does std::move do?

**This step: predict, then experiment. No file changes.**

```cpp
IntArray a(1000);
std::move(a);                     // on its own line
std::cout << a.size() << '\n';
```

**Predict:** does it print `1000` or `0`?

### What happens

`1000`. **`std::move` moves nothing.** It's only a cast: it turns `a` into an rvalue reference, which says "you may steal from this". The stealing happens only when that result is given to something that moves: a move constructor or move assignment. Here nothing receives it, so nothing happens.

After `IntArray b = std::move(a);`, though, never rely on `a`'s contents again. Either give it a new value, or let it be destroyed.

## Step 5 — The rule of five, and the rule of zero

**This step: read, then create the supplied `dynarray/grid.h`. No checks yet.**

`IntArray` now has all five special member functions: destructor, copy constructor, copy assignment, move constructor and move assignment. That's the **rule of five**: a class that manages a resource directly usually needs all five, written carefully.

Most classes shouldn't manage a resource directly. Build them from members that already do, such as `std::vector`, `std::string` and `std::unique_ptr`, and write **none** of the five: the compiler-generated versions copy, move and destroy each member correctly. That's the **rule of zero**, and it's what you should do almost all the time.

`grid.h` declares `Grid`, a rows × cols table of ints. Its only container is a `std::vector<int>`, so it needs no special members at all. You'll implement it next.

```cpp file=dynarray/grid.h provided
#pragma once

#include <cstddef>
#include <vector>

// A rows × cols grid of ints. Its only data member is a std::vector, which already knows how to
// copy, move and destroy itself, so Grid needs none of the five special member functions.
class Grid {
public:
    Grid(std::size_t rows, std::size_t cols);

    std::size_t rows() const;
    std::size_t cols() const;
    int& at(std::size_t row, std::size_t col);               // throws std::out_of_range
    const int& at(std::size_t row, std::size_t col) const;

private:
    std::size_t rows_;
    std::size_t cols_;
    std::vector<int> cells_;
};
```

```check
file dynarray/grid.h
```

## Step 6 — Challenge: Grid, with the rule of zero

**This step: no code is given. Create `dynarray/grid.cpp`, add it to the test program in `dynarray/CMakeLists.txt`, and pass the reviewer's tests in the next step.**

- Store the cells **row by row** in one vector of `rows × cols` ints: cell (r, c) lives at position `r * cols + c`.
- `at(r, c)` throws `std::out_of_range` if either index is out of range.
- Add `grid.cpp` after `int_array.cpp` in the `add_executable` line of `CMakeLists.txt`.

```cpp file=dynarray/grid.cpp
#include "grid.h"

#include <stdexcept>

Grid::Grid(std::size_t rows, std::size_t cols) : rows_(rows), cols_(cols), cells_(rows * cols, 0)
{
}

std::size_t Grid::rows() const
{
    return rows_;
}

std::size_t Grid::cols() const
{
    return cols_;
}

int& Grid::at(std::size_t row, std::size_t col)
{
    if (row >= rows_ || col >= cols_)
        throw std::out_of_range("Grid::at: position out of range");
    return cells_[row * cols_ + col];   // row by row: row r starts at r * cols
}

const int& Grid::at(std::size_t row, std::size_t col) const
{
    if (row >= rows_ || col >= cols_)
        throw std::out_of_range("Grid::at: position out of range");
    return cells_[row * cols_ + col];
}
```

```check
file dynarray/grid.cpp
contains dynarray/grid.cpp "cols"
```

## Step 7 — The reviewer's tests

**This step: create the supplied `dynarray/tests/grid_review_test.cpp`, add `grid.cpp` to the build if you haven't, and make every test pass.**

The last test copies and moves a `Grid`. You wrote no copy or move code, and it works anyway: that's the rule of zero.

```cpp file=dynarray/tests/grid_review_test.cpp provided
// The reviewer's tests for Grid. Do not edit them: make them pass.
#include "studio_test.hpp"

#include "grid.h"

#include <stdexcept>
#include <utility>

TEST(review_grid_starts_zeroed)
{
    Grid g(2, 3);
    CHECK_EQ(g.rows(), 2u);
    CHECK_EQ(g.cols(), 3u);
    CHECK_EQ(g.at(1, 2), 0);
}

TEST(review_cells_are_independent)
{
    Grid g(3, 4);
    g.at(0, 1) = 5;
    g.at(1, 0) = 9;
    CHECK_EQ(g.at(0, 1), 5);
    CHECK_EQ(g.at(1, 0), 9);
    CHECK_EQ(g.at(2, 3), 0);
}

TEST(review_out_of_range_throws)
{
    Grid g(2, 2);
    CHECK_THROWS(g.at(2, 0), std::out_of_range);
    CHECK_THROWS(g.at(0, 2), std::out_of_range);
}

TEST(review_copies_are_deep_and_moves_steal)
{
    Grid a(2, 2);
    a.at(0, 0) = 1;
    Grid b = a;
    b.at(0, 0) = 2;
    CHECK_EQ(a.at(0, 0), 1);
    Grid c = std::move(b);
    CHECK_EQ(c.at(0, 0), 2);
}
```

```check
file dynarray/tests/grid_review_test.cpp
contains dynarray/CMakeLists.txt "grid.cpp" -- Add grid.cpp to the add_executable line.
run "cmake --build dynarray/build"
run "./dynarray/build/int_array_tests" stdout="[       OK ] review_cells_are_independent" -- Cell (r, c) is at r * cols + c.
run "./dynarray/build/int_array_tests" stdout=" passed, 0 failed"
```
