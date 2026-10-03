---
title: 2 — Class Templates: a Stack for Any Type
track: Generic Programming
runtime: cpp
reference: optional
console: true
---

Function templates make one algorithm work for many types. **Class templates** do the same for data structures: `std::vector<int>` and `std::vector<std::string>` are two classes stamped out from one template.

This lesson builds `Stack<T>`, a last-in, first-out stack, and starts the project the rest of the track grows: `generic/`, a **header-only** library tested by one test program. By the end you'll know why it has to be header-only.

```text
push(1) push(2) push(3)        top() is 3
                ┌───┐
                │ 3 │  ◄── top: the last in is the first out
                │ 2 │
                │ 1 │
                └───┘
```

## Step 1 — The test framework

**This step: create the supplied `testing/studio_test.hpp`.**

From here on, the generic library is tested, so this track needs the test framework.

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
        // std::endl flushes: if this test crashes the program, the output
        // still shows which test was running.
        std::cout << "[ RUN      ] " << test.name << std::endl;
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

**This step: create the supplied `generic/CMakeLists.txt` and read it.**

There's one program, `generic_tests`, built from the shared test runner and every `tests/*_test.cpp` file. There's no library `.cpp` to compile: every piece of the library is a template in a header, included by the tests that use it. Step 8 shows why.

```cmake file=generic/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(generic LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# The library is header-only: templates live in headers. The tests are
# the program that uses it: every tests/*_test.cpp file becomes part of it.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(generic_tests ../testing/test_main.cpp ${TEST_SOURCES})
target_include_directories(generic_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)

if(MSVC)
    target_compile_options(generic_tests PRIVATE /W4)
else()
    target_compile_options(generic_tests PRIVATE -Wall -Wextra -Wpedantic)
endif()
```

```check
file generic/CMakeLists.txt
```

## Step 4 — The specification

**This step: create the supplied `generic/tests/stack_test.cpp` and read it.**

The tests use `Stack<int>`: a class template's arguments go in angle brackets after its name. Unlike function templates, class templates usually can't deduce `T`: in `Stack<int> s;` there are no arguments to deduce it from.

What the tests ask for:

| Member | Does |
|---|---|
| `push(value)` | puts a copy of `value` on top |
| `top()` | the top value, as a reference you can change |
| `pop()` | removes the top value |
| `empty()`, `size()` | as for `std::vector` |

`top()` and `pop()` on an empty stack throw `std::out_of_range`. The test program won't build until `generic/stack.h` exists.

```cpp file=generic/tests/stack_test.cpp provided
// Provided by the lesson: what Stack<T> must do (tested with ints).
#include "studio_test.hpp"

#include "stack.h"

#include <stdexcept>

TEST(new_stack_is_empty)
{
    Stack<int> s;
    CHECK(s.empty());
    CHECK_EQ(s.size(), 0u);
}

TEST(push_puts_a_value_on_top)
{
    Stack<int> s;
    s.push(4);
    s.push(7);
    CHECK(!s.empty());
    CHECK_EQ(s.size(), 2u);
    CHECK_EQ(s.top(), 7);
}

TEST(pop_removes_the_top_value)
{
    Stack<int> s;
    s.push(4);
    s.push(7);
    s.pop();
    CHECK_EQ(s.size(), 1u);
    CHECK_EQ(s.top(), 4);
}

TEST(last_in_is_first_out)
{
    Stack<int> s;
    for (int i = 1; i <= 5; ++i)
        s.push(i);
    for (int expected = 5; expected >= 1; --expected) {
        CHECK_EQ(s.top(), expected);
        s.pop();
    }
    CHECK(s.empty());
}

TEST(top_can_change_the_top_value)
{
    Stack<int> s;
    s.push(1);
    s.top() = 10;
    CHECK_EQ(s.top(), 10);
}

TEST(a_const_stack_can_be_read)
{
    Stack<int> s;
    s.push(3);
    const Stack<int>& view = s;
    CHECK_EQ(view.top(), 3);
    CHECK_EQ(view.size(), 1u);
}

TEST(empty_stack_rejects_top_and_pop)
{
    Stack<int> s;
    CHECK_THROWS(s.top(), std::out_of_range);
    CHECK_THROWS(s.pop(), std::out_of_range);
}
```

```check
file generic/tests/stack_test.cpp
```

## Step 5 — Write Stack<T>

**This step: create `generic/stack.h` with the class template `Stack<T>`. Then configure, build and run the tests.**

Store the items in a `std::vector<T>`: its back is the top of the stack. You get memory management, growth and copying for free (the rule of zero from *Memory, Lifetime and Ownership*).

```cpp
template <typename T>
class Stack {
public:
    void push(const T& value) { items_.push_back(value); }
    void pop();
    T& top();
    const T& top() const;
    bool empty() const { return items_.empty(); }
    std::size_t size() const { return items_.size(); }

private:
    std::vector<T> items_;
};
```

Inside the class, `T` is just a type name, and `Stack` on its own means `Stack<T>`. Short members can be defined right in the class. A member defined **outside** the class is a template too, so it repeats the template header and names the class `Stack<T>`:

```cpp
template <typename T>
void Stack<T>::pop()
{
    if (items_.empty())
        throw std::out_of_range("Stack::pop: the stack is empty");
    items_.pop_back();
}
```

- Two `top()`s, as for `IntArray::operator[]`: the `const` one lets you read the top of a `const Stack&`.
- Both still go **in the header**, below the class. Not in a `.cpp`: you'll find out why at the end of this lesson.
- `#include` `<cstddef>`, `<stdexcept>` and `<vector>`, and start with `#pragma once`.

```text
cmake -S generic -B generic/build -G "MinGW Makefiles"     (Windows)
cmake -S generic -B generic/build                          (macOS, Linux)
```

```text
cmake --build generic/build
./generic/build/generic_tests
```

```cpp file=generic/stack.h
#pragma once

#include <cstddef>
#include <stdexcept>
#include <vector>

// A last-in, first-out stack of any copyable type, built on std::vector.
template <typename T>
class Stack {
public:
    void push(const T& value) { items_.push_back(value); }
    void pop();
    T& top();
    const T& top() const;

    bool empty() const { return items_.empty(); }
    std::size_t size() const { return items_.size(); }

private:
    std::vector<T> items_;
};

// Members defined outside the class are templates too, so each one
// repeats the template header, and the class is named Stack<T>.
template <typename T>
void Stack<T>::pop()
{
    if (items_.empty())
        throw std::out_of_range("Stack::pop: the stack is empty");
    items_.pop_back();
}

template <typename T>
T& Stack<T>::top()
{
    if (items_.empty())
        throw std::out_of_range("Stack::top: the stack is empty");
    return items_.back();
}

template <typename T>
const T& Stack<T>::top() const
{
    if (items_.empty())
        throw std::out_of_range("Stack::top: the stack is empty");
    return items_.back();
}
```

```check
file generic/build/CMakeCache.txt label="generic/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build generic/build" -- Each member defined outside the class starts with template <typename T> and is named Stack<T>::name.
tests "./generic/build/generic_tests" require="last_in_is_first_out empty_stack_rejects_top_and_pop" -- top() and pop() on an empty stack throw std::out_of_range.
```

## Step 6 — Your own tests: Stack<std::string>

**This step: create `generic/tests/stack_string_test.cpp` with at least three tests of `Stack<std::string>`.**

The specification only tried `int`. A template should be tested with more than one type, especially one that's different in kind: a `std::string` owns memory, and is expensive to copy.

Ideas:

- the last string pushed is the one on top;
- pushing three words and popping them all gives them in reverse;
- `s.top() += "!"` changes the string inside the stack (a reference, not a copy);
- an empty `Stack<std::string>` throws too.

Start the file with `#include "studio_test.hpp"` and `#include "stack.h"`. The build picks up any new `*_test.cpp` file by itself.

```cpp file=generic/tests/stack_string_test.cpp
// My tests: Stack<T> with a type that isn't a number.
#include "studio_test.hpp"

#include "stack.h"

#include <stdexcept>
#include <string>

TEST(string_stack_returns_the_last_string)
{
    Stack<std::string> s;
    s.push("first");
    s.push("second");
    CHECK_EQ(s.top(), "second");
}

TEST(string_stack_reverses_words)
{
    Stack<std::string> s;
    for (const char* word : {"one", "two", "three"})
        s.push(word);
    std::string reversed;
    while (!s.empty()) {
        reversed += s.top() + " ";
        s.pop();
    }
    CHECK_EQ(reversed, "three two one ");
}

TEST(string_stack_top_can_be_edited)
{
    Stack<std::string> s;
    s.push("draft");
    s.top() += " 2";
    CHECK_EQ(s.top(), "draft 2");
}

TEST(empty_string_stack_throws)
{
    Stack<std::string> s;
    CHECK_THROWS(s.top(), std::out_of_range);
}
```

```check
contains generic/tests/stack_string_test.cpp "Stack<std::string>"
matches generic/tests/stack_string_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="stack_string_test.cpp has at least three tests"
run "cmake --build generic/build"
tests "./generic/build/generic_tests"
```

## Step 7 — Why not a .cpp file?

**This step: create the supplied `linkdemo/twice.cpp` and read it.**

With ordinary functions you split code in two: declarations in a header, definitions in a `.cpp` file compiled once. Each `.cpp` file is compiled **separately**, into its own object file, and the **linker** joins them, matching each call to a definition.

`twice.cpp` does exactly that for a function template. Read it, and ask: when the compiler compiles *this file*, which `twice` does it generate? `twice<int>`? `twice<double>`?

```cpp file=linkdemo/twice.cpp provided
// twice is defined here, in its own .cpp file, the way you would
// split an ordinary function into a header and a source file.
template <typename T>
T twice(T value)
{
    return value + value;
}
```

```check
file linkdemo/twice.cpp
```

## Step 8 — A linker error, on purpose

**This step: create the supplied `linkdemo/main.cpp`, then build both files together. It won't link: read the error.**

```text
g++ -std=c++20 -Wall -Wextra linkdemo/main.cpp linkdemo/twice.cpp -o linkdemo/demo
```

**Predict:** both files compile without an error. Which step fails, and why?

```cpp file=linkdemo/main.cpp provided
#include <iostream>

// What twice.h would contain: only the declaration.
template <typename T>
T twice(T value);

int main()
{
    std::cout << twice(21) << '\n';
}
```

### What happened

```text
undefined reference to `int twice<int>(int)'          (GCC, Linux)
undefined symbol: int twice<int>(int)                 (lld, Windows)
Undefined symbols for architecture ...: twice<int>    (macOS)
```

Follow each file through the compiler on its own:

| File | Sees | Produces |
|---|---|---|
| `main.cpp` | the declaration, and a call `twice(21)` | a *call* to `twice<int>`, to be found later |
| `twice.cpp` | the template definition, and no calls | **nothing**: no one asked for any `T` |

A template is only a recipe. Code is generated where it's **used with a type, and the definition is visible**. In `main.cpp` the use is there but the definition isn't; in `twice.cpp` it's the reverse. So `twice<int>` is never generated, and the linker can't find it.

That's why templates live in headers: every file that uses `Stack<std::string>` includes the whole template, and the compiler generates exactly the instantiations it needs. (If two files generate the same `Stack<int>::push`, the linker keeps one copy.)

```check
file linkdemo/main.cpp
run "g++ -std=c++20 -Wall -Wextra linkdemo/main.cpp linkdemo/twice.cpp -o linkdemo/demo" exit=1 label="it compiles, but doesn't link"
```

## Step 9 — Explicit instantiation, and its price

**This step: make the program link by adding an explicit instantiation of `twice<int>` to the end of `linkdemo/twice.cpp`. It must print `42`.**

The usual fix is to move the template into a header. There's another, sometimes used to keep a big template's compile time down: tell the compiler, in `twice.cpp`, to generate a version even though nothing there calls it.

```cpp
template int twice<int>(int);
```

- That's an **explicit instantiation definition**: `template` followed by a declaration with the arguments filled in. It generates `twice<int>` in `twice.cpp`'s object file, where the linker finds it.
- Careful: `template <> int twice<int>(int);` (with `<>`) means something else, an *explicit specialisation*: a promise of a hand-written version. It generates nothing.

**The price:** you must list every type in advance. Add `std::cout << twice(1.5)` to `main.cpp` and the link fails again, now for `twice<double>`. A library can't know every type its users will invent, which is why `generic/` is header-only, like most of the standard library.

```cpp file=linkdemo/twice.cpp
// twice is defined here, in its own .cpp file, the way you would
// split an ordinary function into a header and a source file.
template <typename T>
T twice(T value)
{
    return value + value;
}

// Instantiate twice<int> here, where the definition is visible.
template int twice<int>(int);
```

```check
matches linkdemo/twice.cpp "template\s+int\s+twice\s*<\s*int\s*>\s*\(\s*int\s*\)\s*;" label="twice.cpp explicitly instantiates twice<int>" -- template, then the declaration with T replaced by int: no <> after template.
run "g++ -std=c++20 -Wall -Wextra linkdemo/main.cpp linkdemo/twice.cpp -o linkdemo/demo"
run "./linkdemo/demo" stdout="42"
```
