---
title: 3 — Build Your Own Dynamic Array
track: Memory, Lifetime and Ownership
runtime: cpp
reference: optional
console: true
---

You've used `std::vector` and `std::string`: classes that manage heap memory so you don't have to. This lesson removes the magic. You'll write `IntArray`, a small `std::vector<int>`, yourself.

```text
IntArray object (on the stack)            heap buffer
┌────────────────────────┐               ┌────┬────┬────┬────┬────┬────┬────┬────┐
│ data_     ─────────────┼─────────────► │ 4  │ 8  │ 15 │ 16 │    │    │    │    │
│ size_     = 4          │               └────┴────┴────┴────┴────┴────┴────┴────┘
│ capacity_ = 8          │                 ◄─── size ───►
└────────────────────────┘                 ◄───────── capacity ─────────►
```

It's also your first real **class**: data that's `private`, reachable only through member functions. The class's job is to keep its **invariants** true at all times: `size_ <= capacity_`, and `data_` points to a buffer of `capacity_` ints that this object alone owns.

## Step 1 — The test framework

**This step: create the supplied `testing/studio_test.hpp`.**

The memory lessons test everything they build, so this track needs the test framework.

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
        std::cout << "[ RUN      ] " << test.name << '\n';
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

## Step 3 — The project's build file

**This step: create the supplied `dynarray/CMakeLists.txt` and read it.**

Two things are new:

- There's no `main.cpp` and no program, only the test program. A library is often developed this way: its tests are the first program that uses it.
- An **option**, `SANITIZE`. Configure with `-DSANITIZE=ON` and the tests are built with AddressSanitizer, so any memory mistake fails loudly. Use it whenever your compiler supports it.

```cmake file=dynarray/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(dynarray LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# The library is tested, not run: every tests/*_test.cpp file becomes part of the test program.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(int_array_tests ../testing/test_main.cpp ${TEST_SOURCES} int_array.cpp)
target_include_directories(int_array_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)

if(MSVC)
    target_compile_options(int_array_tests PRIVATE /W4)
else()
    target_compile_options(int_array_tests PRIVATE -Wall -Wextra -Wpedantic)
endif()

# Configure with -DSANITIZE=ON to build the tests with AddressSanitizer and UndefinedBehaviorSanitizer
# (GCC and Clang on Linux and macOS, Clang on Windows).
option(SANITIZE "Build the tests with AddressSanitizer and UndefinedBehaviorSanitizer" OFF)
if(SANITIZE)
    target_compile_options(int_array_tests PRIVATE -fsanitize=address,undefined -fno-omit-frame-pointer)
    target_link_options(int_array_tests PRIVATE -fsanitize=address,undefined)
endif()
```

```check
file dynarray/CMakeLists.txt
```

## Step 4 — The class declaration

**This step: create the supplied `dynarray/int_array.h` and read it.**

```cpp
class IntArray {
public:                     // anyone may call these
    explicit IntArray(std::size_t size);
    ~IntArray();
    std::size_t size() const;
    int& operator[](std::size_t index);
    const int& operator[](std::size_t index) const;
private:                    // only IntArray's own member functions can touch these
    int* data_;
    std::size_t size_;
};
```

- A `class` is a `struct` whose members are private unless you say otherwise. Privacy is what lets the class protect its invariants: no outside code can set `size_` to something wrong.
- `operator[]` makes `a[i]` work. Returning `int&` lets callers assign through it: `a[0] = 10;`.
- A member function marked `const`, like `size() const`, promises not to change the object, so it can be called on a `const IntArray&`. That's why there are two `operator[]`s.
- `explicit` stops `IntArray a = 5;` from silently making a five-element array.

```cpp file=dynarray/int_array.h provided
#pragma once

#include <cstddef>

// A resizable array of ints that owns its memory — a small std::vector<int>.
class IntArray {
public:
    explicit IntArray(std::size_t size);   // `size` elements, all zero
    ~IntArray();

    std::size_t size() const;
    int& operator[](std::size_t index);
    const int& operator[](std::size_t index) const;

private:
    int* data_;
    std::size_t size_;
};
```

```check
file dynarray/int_array.h
```

## Step 5 — The specification

**This step: create the supplied `dynarray/tests/basics_test.cpp` and read it.**

Notice the last test, `many_arrays_come_and_go`. It creates and destroys a hundred arrays. It can't see a leak by itself, but built with `-DSANITIZE=ON` on Linux, a destructor that forgets to free memory is reported as a leak when the tests finish.

```cpp file=dynarray/tests/basics_test.cpp provided
// Provided by the lesson: what a fixed-size IntArray must do.
#include "studio_test.hpp"

#include "int_array.h"

TEST(new_array_has_requested_size)
{
    IntArray a(5);
    CHECK_EQ(a.size(), 5u);
}

TEST(new_array_is_zero_filled)
{
    IntArray a(4);
    for (std::size_t i = 0; i < a.size(); ++i)
        CHECK_EQ(a[i], 0);
}

TEST(elements_can_be_written_and_read)
{
    IntArray a(3);
    a[0] = 10;
    a[2] = 30;
    CHECK_EQ(a[0], 10);
    CHECK_EQ(a[1], 0);
    CHECK_EQ(a[2], 30);
}

TEST(const_array_can_be_read)
{
    IntArray a(2);
    a[1] = 7;
    const IntArray& view = a;
    CHECK_EQ(view[1], 7);
}

TEST(many_arrays_come_and_go)
{
    // With AddressSanitizer on Linux, a destructor that forgets delete[] is reported as a leak.
    for (int i = 0; i < 100; ++i) {
        IntArray a(1000);
        a[999] = i;
    }
}
```

```check
file dynarray/tests/basics_test.cpp
```

## Step 6 — A class that owns memory

**This step: create `dynarray/int_array.cpp` with the constructor, the destructor, `size` and both `operator[]`s. Then configure, build and run the tests.**

**Defining members outside the class** uses the class name as a prefix:

```cpp
std::size_t IntArray::size() const
{
    return size_;
}
```

**The constructor's initialiser list** sets members before the body runs:

```cpp
IntArray::IntArray(std::size_t size) : data_(new int[size]()), size_(size)
{
}
```

- `new int[size]()` allocates an array of `size` ints on the heap. The `()` at the end fills it with zeros.

**The destructor** gives the memory back:

```cpp
IntArray::~IntArray()
{
    delete[] data_;
}
```

- Memory from `new[]` must be released with `delete[]`. Plain `delete` on an array is undefined behaviour (AddressSanitizer reports `alloc-dealloc-mismatch`).
- This one line is why `IntArray` never leaks: the destructor runs automatically whenever an IntArray's lifetime ends. That's RAII again, and now you're the one writing it.

```text
cmake -S dynarray -B dynarray/build -G "MinGW Makefiles"     (Windows)
cmake -S dynarray -B dynarray/build                          (macOS, Linux)
```

```text
cmake --build dynarray/build
./dynarray/build/int_array_tests
```

```cpp file=dynarray/int_array.cpp
#include "int_array.h"

IntArray::IntArray(std::size_t size) : data_(new int[size]()), size_(size)
{
}

IntArray::~IntArray()
{
    delete[] data_;
}

std::size_t IntArray::size() const
{
    return size_;
}

int& IntArray::operator[](std::size_t index)
{
    return data_[index];
}

const int& IntArray::operator[](std::size_t index) const
{
    return data_[index];
}
```

```check
file dynarray/build/CMakeCache.txt label="dynarray/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build dynarray/build" -- Every member is defined as IntArray::name, matching the declaration exactly, const included.
tests "./dynarray/build/int_array_tests" require="new_array_is_zero_filled" -- new int[size]() with the () zero-fills the array.
```

## Step 7 — The specification for growing

**This step: create the supplied `dynarray/tests/growth_test.cpp` and read it.**

A fixed size isn't very useful. These tests ask for an empty constructor, `push_back`, and `capacity()`.

Look at `capacity_grows_geometrically`. It pushes 100,000 values and counts how many times the capacity changes: fewer than 40. You'll see why in the next steps.

The test program won't build until `IntArray` has those members.

```cpp file=dynarray/tests/growth_test.cpp provided
// Provided by the lesson: what push_back and growth must do.
#include "studio_test.hpp"

#include "int_array.h"

TEST(default_array_is_empty)
{
    IntArray a;
    CHECK_EQ(a.size(), 0u);
}

TEST(push_back_appends)
{
    IntArray a;
    a.push_back(4);
    a.push_back(8);
    CHECK_EQ(a.size(), 2u);
    CHECK_EQ(a[0], 4);
    CHECK_EQ(a[1], 8);
}

TEST(push_back_grows_past_the_initial_size)
{
    IntArray a(2);
    a[0] = 1;
    a[1] = 2;
    a.push_back(3);
    CHECK_EQ(a.size(), 3u);
    CHECK_EQ(a[0], 1);
    CHECK_EQ(a[2], 3);
}

TEST(many_push_backs_keep_every_value)
{
    IntArray a;
    for (int i = 0; i < 10000; ++i)
        a.push_back(i * 3);
    CHECK_EQ(a.size(), 10000u);
    for (std::size_t i = 0; i < a.size(); ++i)
        CHECK_EQ(a[i], static_cast<int>(i) * 3);
}

TEST(capacity_grows_geometrically)
{
    // Growing one element at a time would copy the whole array on every push_back.
    IntArray a;
    int reallocations = 0;
    std::size_t last = a.capacity();
    for (int i = 0; i < 100000; ++i) {
        a.push_back(i);
        if (a.capacity() != last) {
            ++reallocations;
            last = a.capacity();
        }
    }
    CHECK(a.capacity() >= a.size());
    CHECK(reallocations < 40);
}
```

```check
file dynarray/tests/growth_test.cpp
```

## Step 8 — Size and capacity

**This step: update `dynarray/int_array.h` with an empty constructor, `capacity()`, `push_back`, and a `capacity_` member.**

C++ arrays can't grow in place. To make room, `push_back` must:

1. allocate a **new, bigger** buffer,
2. copy the existing elements across,
3. `delete[]` the old buffer,
4. point `data_` at the new one.

That's expensive, so don't do it on every `push_back`. Keep two numbers: `size_` (elements in use) and `capacity_` (elements allocated). Only reallocate when they're equal.

```cpp
IntArray();                        // empty: no buffer, size 0, capacity 0
std::size_t capacity() const;
void push_back(int value);
// and a new private member:  std::size_t capacity_;
```

```cpp file=dynarray/int_array.h
#pragma once

#include <cstddef>

// A resizable array of ints that owns its memory — a small std::vector<int>.
class IntArray {
public:
    IntArray();                            // empty
    explicit IntArray(std::size_t size);   // `size` elements, all zero
    ~IntArray();

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
contains dynarray/int_array.h "capacity_"
matches dynarray/int_array.h "void\s+push_back\s*\(\s*int\b" label="declares push_back(int)"
matches dynarray/int_array.h "std::size_t\s+capacity\s*\(\s*\)\s*const" label="declares capacity() const"
```

## Step 9 — push_back, and why doubling

**This step: implement the empty constructor, `capacity`, and `push_back` in `dynarray/int_array.cpp`. Every constructor must initialise `capacity_`.**

```cpp
void IntArray::push_back(int value)
{
    if (size_ == capacity_) {
        // allocate, copy, delete[], re-point: see the previous step
    }
    data_[size_] = value;
    ++size_;
}
```

**Predict:** if each reallocation adds just one more slot, how many element copies does it take to push 100,000 values? And if each reallocation **doubles** the capacity?

### Why doubling wins

Growing by one: 1 + 2 + 3 + … + 99,999 copies, about **5 billion**. Doubling: reallocations at 4, 8, 16, …, about 17 of them, and the copies add up to less than twice the final size: about **200,000**. The *average* cost per `push_back` is constant. That's called **amortised** constant time, and it's exactly what `std::vector` does.

> If you forget to initialise `capacity_` in a constructor, it holds garbage. Your tests may pass by luck, or fail at random. UndefinedBehaviorSanitizer and careful constructor lists both help.

```cpp file=dynarray/int_array.cpp
#include "int_array.h"

IntArray::IntArray() : data_(nullptr), size_(0), capacity_(0)
{
}

IntArray::IntArray(std::size_t size) : data_(new int[size]()), size_(size), capacity_(size)
{
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
run "cmake --build dynarray/build" -- Define every new member declared in int_array.h.
tests "./dynarray/build/int_array_tests" require="many_push_backs_keep_every_value capacity_grows_geometrically" -- Copy every existing element into the new buffer before deleting the old one. Double the capacity (starting from, say, 4) instead of adding one.
```
