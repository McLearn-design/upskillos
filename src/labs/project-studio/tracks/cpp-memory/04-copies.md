---
title: 4 — Copies, Crashes and the Rule of Three
track: Memory, Lifetime and Ownership
runtime: cpp
reference: optional
console: true
---

Your `IntArray` works. This lesson copies one, watches it crash, and fixes it properly. Along the way: **shallow** versus **deep** copies, the special member functions the compiler writes for you, and the **rule of three**.

## Step 1 — Copying goes wrong

**This step: create the supplied `dynarray/tests/copy_test.cpp`, build and run the tests, and read what happens. Don't fix anything yet.**

The new tests **copy** arrays:

```cpp
IntArray b = a;     // copy constructor
b = a;              // copy assignment
```

You never wrote either of those, yet it compiles. When you don't write them, the compiler generates them, copying each member one by one.

**Predict:** `IntArray b = a;` copies `data_`, `size_` and `capacity_`. What does `b[0] = 99;` do to `a`? And what happens at the end of the test, when both destructors run?

Then build and run the tests. With `-DSANITIZE=ON` you'll see `AddressSanitizer: attempting double-free`. Without it, the program may crash, print a heap-corruption message, or appear to finish.

```cpp file=dynarray/tests/copy_test.cpp provided
// Provided by the lesson: what copying an IntArray must do.
#include "studio_test.hpp"

#include "int_array.h"

TEST(copies_are_independent)
{
    IntArray a(3);
    a[0] = 1;
    IntArray b = a;          // copy construction
    b[0] = 99;
    CHECK_EQ(a[0], 1);
    CHECK_EQ(b[0], 99);
    CHECK_EQ(b.size(), 3u);
}

TEST(assignment_copies_and_is_independent)
{
    IntArray a(2);
    a[1] = 5;
    IntArray b(10);
    b = a;                   // copy assignment
    CHECK_EQ(b.size(), 2u);
    CHECK_EQ(b[1], 5);
    b[1] = 6;
    CHECK_EQ(a[1], 5);
}

TEST(self_assignment_is_harmless)
{
    IntArray a(2);
    a[0] = 42;
    IntArray& same = a;
    a = same;
    CHECK_EQ(a[0], 42);
    CHECK_EQ(a.size(), 2u);
}
```

### Shallow copies

The generated copy constructor copies the **pointer**, not the buffer it points to. Now `a` and `b` share one buffer:

```text
a.data_ ──┐
          ├──►  [ 99, 0, 0 ]        one buffer, two owners
b.data_ ──┘
```

Writing `b[0]` changes `a[0]`. When the test ends, both destructors run `delete[]` on the same memory: a **double free**. That's undefined behaviour, and the allocator may crash or corrupt itself.

This is a **shallow copy**. `IntArray` needs a **deep copy**: a new buffer with the same contents.

```check
file dynarray/tests/copy_test.cpp
```

## Step 2 — The rule of three: declare it

**This step: declare a copy constructor and a copy assignment operator in `dynarray/int_array.h`.**

> If a class needs a hand-written **destructor**, it almost certainly needs a hand-written **copy constructor** and **copy assignment operator** too. That's the **rule of three**.

The destructor frees a resource, so each copy must get its *own* resource.

```cpp
IntArray(const IntArray& other);              // make a new array as a copy of other
IntArray& operator=(const IntArray& other);   // turn an existing array into a copy of other
```

- Assignment returns `IntArray&`, a reference to the object that was assigned to, so `a = b = c;` works the way it does for `int`.

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

    std::size_t size() const;
    std::size_t capacity() const;
    int& operator[](std::size_t index);
    const int& operator[](std::size_t index) const;

    void push_back(int value);

private:
    int* data_;
    std::size_t size_;
    std::size_t capacity_;
};
```

```check
matches dynarray/int_array.h "IntArray\s*\(\s*const\s+IntArray\s*&" label="declares the copy constructor"
matches dynarray/int_array.h "IntArray\s*&\s*operator=\s*\(\s*const\s+IntArray\s*&" label="declares copy assignment"
```

## Step 3 — Deep copies

**This step: define both in `dynarray/int_array.cpp`. All the tests must pass, with no crash.**

The **copy constructor** is straightforward: allocate a buffer of `other.capacity_` (or nothing, if it's 0), copy `other.size_` elements, copy the counts.

**Copy assignment** is trickier, because the target already owns a buffer:

```cpp
IntArray& IntArray::operator=(const IntArray& other)
{
    if (this == &other)       // a = a; must not free the buffer it's about to copy from
        return *this;
    IntArray copy(other);     // 1. make the copy first: if allocation fails, *this is untouched
    delete[] data_;           // 2. release our old buffer
    data_ = copy.data_;       // 3. take over the copy's buffer and counts
    // ... size_, capacity_ ...
    copy.data_ = nullptr;     // 4. the copy no longer owns it, so its destructor frees nothing
    return *this;
}
```

- `this` is a pointer to the object the member function was called on. `*this` is the object itself.
- Making the copy before touching `*this` means a failed allocation (an exception) leaves the object unchanged. That's the **strong exception guarantee**.

If your compiler supports it, configure a sanitized build too, and run the tests under it:

```text
cmake -S dynarray -B dynarray/build-asan -DSANITIZE=ON
cmake --build dynarray/build-asan
./dynarray/build-asan/int_array_tests
```

```cpp file=dynarray/int_array.cpp
#include "int_array.h"

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
```

```check
run "cmake --build dynarray/build"
tests "./dynarray/build/int_array_tests" require="copies_are_independent self_assignment_is_harmless" -- The copy needs its own new buffer, with the elements copied into it. Check this == &other first.
```

## Step 4 — Challenge: bounds checking (the header)

**This step: no code is given. Declare `at` (two versions, like `operator[]`) and `pop_back` in `dynarray/int_array.h`.**

`a[100]` on a 3-element array reads someone else's memory. Undefined behaviour again, and without a sanitizer nothing stops it. `std::vector` offers a checked alternative, `at()`. Add the same:

- `at(index)`: like `operator[]`, but throws `std::out_of_range` if `index >= size()`.
- `pop_back()`: removes the last element; throws `std::out_of_range` if the array is empty.

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

    std::size_t size() const;
    std::size_t capacity() const;
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
matches dynarray/int_array.h "int\s*&\s*at\s*\(" label="declares int& at(...)"
matches dynarray/int_array.h "const\s+int\s*&\s*at\s*\([^)]*\)\s*const" label="declares the const at(...) const"
matches dynarray/int_array.h "void\s+pop_back\s*\(" label="declares pop_back()"
```

## Step 5 — Challenge: bounds checking (the code)

**This step: no code is given. Define `at` and `pop_back` in `dynarray/int_array.cpp`.**

`pop_back` doesn't need to free anything: the memory stays allocated for the next `push_back`.

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
matches dynarray/int_array.cpp "IntArray::at\s*\(" label="defines at" -- Define both versions: int& IntArray::at(std::size_t index) and the const one.
matches dynarray/int_array.cpp "IntArray::pop_back\s*\(" label="defines pop_back"
contains dynarray/int_array.cpp "std::out_of_range" -- at throws std::out_of_range when the index is not below size_.
run "cmake --build dynarray/build" -- #include <stdexcept> for std::out_of_range.
```

## Step 6 — Your own tests

**This step: create `dynarray/tests/at_test.cpp` with at least three tests of `at` and `pop_back`.**

Think about the boundaries: the last valid index, the first invalid one, an empty array, a `const` array.

```cpp file=dynarray/tests/at_test.cpp
#include "studio_test.hpp"

#include "int_array.h"

#include <stdexcept>

TEST(at_returns_element)
{
    IntArray a(1);
    a.at(0) = 3;
    CHECK_EQ(a.at(0), 3);
}

TEST(at_past_the_end_throws)
{
    IntArray a(1);
    CHECK_THROWS(a.at(1), std::out_of_range);
}

TEST(pop_back_shrinks)
{
    IntArray a(2);
    a.pop_back();
    CHECK_EQ(a.size(), 1u);
}
```

```check
matches dynarray/tests/at_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="at_test.cpp has at least three tests"
run "cmake --build dynarray/build"
tests "./dynarray/build/int_array_tests"
```

## Step 7 — The reviewer's tests

**This step: create the supplied `dynarray/tests/at_review_test.cpp`, run the tests, and fix `int_array.cpp` if any fail.**

When this passes, you've built, and understood, the core of the most important container in C++.

```cpp file=dynarray/tests/at_review_test.cpp provided
// The reviewer's tests for at() and pop_back(). Do not edit them: make them pass.
#include "studio_test.hpp"

#include "int_array.h"

#include <stdexcept>

TEST(review_at_reads_and_writes_valid_indices)
{
    IntArray a(3);
    a.at(0) = 5;
    a.at(2) = 7;
    CHECK_EQ(a.at(0), 5);
    CHECK_EQ(a[2], 7);
    const IntArray& c = a;
    CHECK_EQ(c.at(2), 7);
}

TEST(review_at_rejects_out_of_range_indices)
{
    IntArray a(3);
    CHECK_THROWS(a.at(3), std::out_of_range);
    CHECK_THROWS(a.at(1000), std::out_of_range);
    IntArray empty;
    CHECK_THROWS(empty.at(0), std::out_of_range);
    const IntArray& c = a;
    CHECK_THROWS(c.at(3), std::out_of_range);
}

TEST(review_pop_back_removes_the_last_element)
{
    IntArray a;
    a.push_back(1);
    a.push_back(2);
    a.pop_back();
    CHECK_EQ(a.size(), 1u);
    CHECK_EQ(a[0], 1);
    a.push_back(3);
    CHECK_EQ(a[1], 3);
}

TEST(review_pop_back_on_empty_throws)
{
    IntArray a;
    CHECK_THROWS(a.pop_back(), std::out_of_range);
    a.push_back(1);
    a.pop_back();
    CHECK_THROWS(a.pop_back(), std::out_of_range);
}
```

```check
file dynarray/tests/at_review_test.cpp
run "cmake --build dynarray/build"
tests "./dynarray/build/int_array_tests" require="review_at_rejects_out_of_range_indices" -- Valid indices are 0 to size() - 1: index == size() is out of range.
```
