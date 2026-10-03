---
title: 2 — Functions, Headers and Your First Unit Tests
track: C++ Foundations — Thinking in Types
runtime: cpp
reference: optional
console: true
---

Your calculator works. You checked it by hand, by typing inputs and reading outputs. That doesn't scale: after every change you'd have to re-check everything. Professional software has **automated tests**: small programs that call your code and verify the results, in seconds, every time.

To test code, it must be callable from somewhere other than `main`. So first you'll move the arithmetic into **functions** with a clean **interface** in a header. Testable code and well-structured code turn out to be the same thing.

## Step 1 — A test framework you can read

**This step: create the supplied `testing/studio_test.hpp` and skim it.**

Click **Create provided testing/studio_test.hpp** above. It's a complete unit-test framework in about 120 lines, and it lives in its own folder so every project in this track can share it. Real projects use bigger frameworks such as GoogleTest; this one prints results in the same format, so moving to GoogleTest later will feel familiar.

You don't need to understand all of it yet. Notice three things:

- `TEST(name) { ... }` defines a test: a function with a name.
- `CHECK_EQ(a, b)` fails the test if `a` and `b` differ, and reports both values.
- `run_all()` runs every test and prints `[ RUN ]`, `[ OK ]` or `[ FAILED ]` for each.

There's no magic in testing frameworks. Come back and read it properly once you've met macros and templates.

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

## Step 2 — The test program's main

**This step: create the supplied `testing/test_main.cpp`.**

A test program is a second executable with its own `main`. This one runs every registered test.

```cpp file=testing/test_main.cpp provided
// The test program's entry point. Every TEST(...) in the other test files has
// already registered itself by the time main() runs.
#include "studio_test.hpp"

int main()
{
    return studio_test::run_all();
}
```

- `return studio_test::run_all();` makes the program's exit code `0` only when every test passed, so scripts and other tools can tell whether testing succeeded.

```check
file testing/test_main.cpp
```

## Step 3 — Declare an interface

**This step: create `calculator/calc.h` declaring four functions.**

A **function** packages up a computation behind a name:

```cpp
double add(double a, double b)   // return type, name, parameters
{
    return a + b;                // the body
}
```

- `a` and `b` are **parameters**: local variables that start as copies of whatever the caller passes in.
- `return` hands a value back to the caller.

As in *C++ from Zero*, split each function into a **declaration** in a header (what other files may call) and a **definition** in a `.cpp` file (how it works). Declare `add`, `subtract`, `multiply` and `divide`, each taking two `double`s and returning a `double`.

```cpp file=calculator/calc.h
#pragma once

double add(double a, double b);
double subtract(double a, double b);
double multiply(double a, double b);
double divide(double a, double b);
```

```check
contains calculator/calc.h "#pragma once"
matches calculator/calc.h "double\s+add\s*\(\s*double\b[^,]*,\s*double\b[^)]*\)\s*;" label="declares double add(double, double);"
matches calculator/calc.h "double\s+subtract\s*\(\s*double\b[^,]*,\s*double\b[^)]*\)\s*;" label="declares subtract"
matches calculator/calc.h "double\s+multiply\s*\(\s*double\b[^,]*,\s*double\b[^)]*\)\s*;" label="declares multiply"
matches calculator/calc.h "double\s+divide\s*\(\s*double\b[^,]*,\s*double\b[^)]*\)\s*;" label="declares divide" -- A declaration is the first line of the function plus ; with no body.
```

## Step 4 — Define them

**This step: create `calculator/calc.cpp` with the four definitions.**

```cpp
#include "calc.h"

double add(double a, double b)
{
    return a + b;
}
```

- `calc.cpp` includes its own header, so the compiler checks every definition against its declaration.
- Write the other three the same way.

```cpp file=calculator/calc.cpp
#include "calc.h"

double add(double a, double b)
{
    return a + b;
}

double subtract(double a, double b)
{
    return a - b;
}

double multiply(double a, double b)
{
    return a * b;
}

double divide(double a, double b)
{
    return a / b;
}
```

```check
contains calculator/calc.cpp "#include \"calc.h\""
run "g++ -std=c++20 -Wall -Wextra -c calculator/calc.cpp -o calculator/calc.o" label="calc.cpp compiles on its own" -- Each definition is the declaration's first line plus a body in { }.
```

## Step 5 — Use them from main

**This step: change `calculator/main.cpp` to call your functions.**

Add `#include "calc.h"` at the top, then replace `a + b` with `add(a, b)`, `a - b` with `subtract(a, b)`, and so on. Keep the division-by-zero check.

**Predict:** if you build now, with `CMakeLists.txt` unchanged, will it work? Which tool will complain?

### What happens

The linker reports an undefined reference to `add(double, double)`, the same error as in *C++ from Zero*. `main.cpp` compiles, because it has the declarations, but `calc.cpp` isn't part of the build yet. Changing a program's structure without changing its behaviour is called **refactoring**. You'll finish it in the next step.

```cpp file=calculator/main.cpp
#include <iostream>

#include "calc.h"

int main()
{
    double a = 0;
    double b = 0;
    char op = ' ';
    if (!(std::cin >> a >> op >> b)) {
        std::cout << "Error: expected an expression like 3 * 4\n";
        return 1;
    }

    double result = 0;
    switch (op) {
    case '+': result = add(a, b); break;
    case '-': result = subtract(a, b); break;
    case '*': result = multiply(a, b); break;
    case '/':
        if (b == 0) {
            std::cout << "Error: division by zero\n";
            return 0;
        }
        result = divide(a, b);
        break;
    default:
        std::cout << "Unknown operator: " << op << '\n';
        return 0;
    }
    std::cout << a << ' ' << op << ' ' << b << " = " << result << '\n';
    return 0;
}
```

```check
contains calculator/main.cpp "#include \"calc.h\""
matches calculator/main.cpp "\b(add|subtract|multiply|divide)\s*\(" label="main.cpp calls the new functions"
```

## Step 6 — Build the program and its tests

**This step: update `calculator/CMakeLists.txt` with `calc.cpp` and a second target, the test program.**

```cmake
add_executable(calculator main.cpp calc.cpp)
```

- `calc.cpp` joins the `calculator` target, which fixes the linker error.

```cmake
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(calc_tests ../testing/test_main.cpp ${TEST_SOURCES} calc.cpp)
target_include_directories(calc_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)
```

- `file(GLOB ...)` collects every file in `tests/` whose name ends in `_test.cpp` into the variable `TEST_SOURCES`. `CONFIGURE_DEPENDS` re-checks the folder on each build, so a new test file is picked up automatically.
- `calc_tests` is built from the test runner's `main`, every test file, and `calc.cpp`: the code under test. **Not** `main.cpp`, because the test program has its own `main`. That's why the logic had to move out of `main.cpp`.
- `target_include_directories` tells the compiler where to look for `"calc.h"` and `"studio_test.hpp"`.
- `foreach` applies the same warning options to both targets.

```cmake file=calculator/CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(calculator LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(calculator main.cpp calc.cpp)

file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(calc_tests ../testing/test_main.cpp ${TEST_SOURCES} calc.cpp)
target_include_directories(calc_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)

foreach(target calculator calc_tests)
    if(MSVC)
        target_compile_options(${target} PRIVATE /W4)
    else()
        target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic)
    endif()
endforeach()
```

```check
contains calculator/CMakeLists.txt "add_executable(calculator main.cpp calc.cpp)"
contains calculator/CMakeLists.txt "add_executable(calc_tests"
run "cmake --build calculator/build --target calculator" -- An undefined reference means a .cpp file is missing from a target.
run "./calculator/build/calculator" stdin="3 * 4\n" stdout="3 * 4 = 12"
run "./calculator/build/calculator" stdin="1 / 0\n" stdout="Error: division by zero"
```

## Step 7 — Your first test

**This step: create `calculator/tests/calc_test.cpp` with one test, then build and run the test program.**

```cpp
TEST(add_two_positive_numbers)
{
    CHECK_EQ(add(2, 3), 5);
}
```

- The name says what's being tested. When a test fails, its name is the first thing you read.
- `CHECK_EQ(actual, expected)`: call the code, state what the answer must be.

```text
cmake --build calculator/build
./calculator/build/calc_tests
```

```text
[==========] Running 1 tests
[ RUN      ] add_two_positive_numbers
[       OK ] add_two_positive_numbers
[==========] 1 tests ran, 1 passed, 0 failed
```

**Make it fail on purpose:** change the `5` to `6`, rebuild and run. Read the failure: it names the file, the line, the expression, and both values. Then change it back.

```cpp file=calculator/tests/calc_test.cpp
#include "studio_test.hpp"

#include "calc.h"

TEST(add_two_positive_numbers)
{
    CHECK_EQ(add(2, 3), 5);
}
```

```check
file calculator/tests/calc_test.cpp -- The file goes in a tests folder inside calculator, and its name must end in _test.cpp.
run "cmake --build calculator/build" -- Did CMake pick up the new test file? Its name must end in _test.cpp.
run "./calculator/build/calc_tests" stdout="[       OK ] add_two_positive_numbers"
```

## Step 8 — Test every function

**This step: add at least one test each for `subtract`, `multiply` and `divide`.**

Good tests:

- have **descriptive names**, such as `subtract_can_go_negative`;
- check **interesting cases**, not only the obvious one: negative results, zero, fractions;
- are **independent**: each makes sense on its own.

Floating-point arithmetic isn't exact (`0.1 + 0.2` is not exactly `0.3`). For results that can't be represented exactly, compare within a tolerance:

```cpp
CHECK_NEAR(divide(1, 3), 0.333333, 1e-6);
```

```cpp file=calculator/tests/calc_test.cpp
#include "studio_test.hpp"

#include "calc.h"

TEST(add_two_positive_numbers)
{
    CHECK_EQ(add(2, 3), 5);
}

TEST(subtract_can_go_negative)
{
    CHECK_EQ(subtract(3, 4), -1);
}

TEST(multiply_by_zero_is_zero)
{
    CHECK_EQ(multiply(12345, 0), 0);
    CHECK_EQ(multiply(3, 4), 12);
}

TEST(divide_gives_fractions)
{
    CHECK_NEAR(divide(3, 4), 0.75, 1e-12);
    CHECK_NEAR(divide(1, 3), 0.333333333333, 1e-9);
}
```

```check
matches calculator/tests/calc_test.cpp "\bsubtract\s*\(" label="a test calls subtract"
matches calculator/tests/calc_test.cpp "\bmultiply\s*\(" label="a test calls multiply"
matches calculator/tests/calc_test.cpp "\bdivide\s*\(" label="a test calls divide"
run "cmake --build calculator/build"
run "./calculator/build/calc_tests" stdout=" passed, 0 failed" -- Read the failing test's message: it shows both values.
```

## Step 9 — Red: a test for behaviour that doesn't exist yet

**This step: add a test saying that dividing by zero must throw an exception. Watch it fail.**

Right now `divide(1, 0)` returns infinity, and `main` has to remember to check for zero before calling it. Every other caller would have to remember too. Better: make `divide` itself refuse bad input by **throwing an exception**.

Work test-first, the rhythm of **test-driven development**. First write a test that describes the behaviour you want:

```cpp
#include <stdexcept>

TEST(divide_by_zero_throws)
{
    CHECK_THROWS(divide(1, 0), std::invalid_argument);
}
```

- `CHECK_THROWS(expression, Type)` passes only if evaluating the expression throws an exception of that type.
- `std::invalid_argument` (from `<stdexcept>`) is the standard exception for "this input isn't allowed".

Build and run the tests. **This one should fail:** seeing it fail proves it can detect the problem. A test that has never failed might not be testing anything.

```cpp file=calculator/tests/calc_test.cpp
#include "studio_test.hpp"

#include "calc.h"

#include <stdexcept>

TEST(add_two_positive_numbers)
{
    CHECK_EQ(add(2, 3), 5);
}

TEST(subtract_can_go_negative)
{
    CHECK_EQ(subtract(3, 4), -1);
}

TEST(multiply_by_zero_is_zero)
{
    CHECK_EQ(multiply(12345, 0), 0);
    CHECK_EQ(multiply(3, 4), 12);
}

TEST(divide_gives_fractions)
{
    CHECK_NEAR(divide(3, 4), 0.75, 1e-12);
    CHECK_NEAR(divide(1, 3), 0.333333333333, 1e-9);
}

TEST(divide_by_zero_throws)
{
    CHECK_THROWS(divide(1, 0), std::invalid_argument);
}
```

```check
matches calculator/tests/calc_test.cpp "CHECK_THROWS\s*\(\s*divide\s*\(" label="a test checks that divide throws"
run "cmake --build calculator/build"
run "./calculator/build/calc_tests" exit=1 stdout="[  FAILED  ] divide_by_zero_throws" label="the new test fails (red), as it should for now" -- Write the test only. divide doesn't throw yet, so the test must fail.
```

## Step 10 — Green: make divide throw

**This step: change `divide` in `calculator/calc.cpp` so the test passes.**

```cpp
double divide(double a, double b)
{
    if (b == 0)
        throw std::invalid_argument("division by zero");
    return a / b;
}
```

- `throw` stops the function immediately. Control jumps back up the chain of callers until something **catches** the exception.
- Add `#include <stdexcept>` to `calc.cpp`.

Build and run the tests again: all of them pass.

```cpp file=calculator/calc.cpp
#include "calc.h"

#include <stdexcept>

double add(double a, double b)
{
    return a + b;
}

double subtract(double a, double b)
{
    return a - b;
}

double multiply(double a, double b)
{
    return a * b;
}

double divide(double a, double b)
{
    if (b == 0)
        throw std::invalid_argument("division by zero");
    return a / b;
}
```

```check
contains calculator/calc.cpp "throw"
run "cmake --build calculator/build"
run "./calculator/build/calc_tests" stdout=" passed, 0 failed"
```

## Step 11 — Refactor: catch it in main

**This step: remove `main`'s own zero check and catch the exception instead.**

```cpp
try {
    // ... the switch ...
} catch (const std::invalid_argument& e) {
    std::cout << "Error: " << e.what() << '\n';
}
```

- `try { ... }` marks code whose exceptions you're ready to handle.
- `catch (const std::invalid_argument& e)` runs if that kind of exception is thrown inside the `try`.
- `e.what()` is the message given to `throw`: `"division by zero"`.

**Try it:** comment out the `catch` and enter `1 / 0`. Nothing catches the exception, so the program terminates. Then put it back.

The calculator must still print `Error: division by zero` for `1 / 0`, and every test must pass.

```cpp file=calculator/main.cpp
#include <iostream>
#include <stdexcept>

#include "calc.h"

int main()
{
    double a = 0;
    double b = 0;
    char op = ' ';
    if (!(std::cin >> a >> op >> b)) {
        std::cout << "Error: expected an expression like 3 * 4\n";
        return 1;
    }

    try {
        double result = 0;
        switch (op) {
        case '+': result = add(a, b); break;
        case '-': result = subtract(a, b); break;
        case '*': result = multiply(a, b); break;
        case '/': result = divide(a, b); break;
        default:
            std::cout << "Unknown operator: " << op << '\n';
            return 0;
        }
        std::cout << a << ' ' << op << ' ' << b << " = " << result << '\n';
    } catch (const std::invalid_argument& e) {
        std::cout << "Error: " << e.what() << '\n';
    }
    return 0;
}
```

```check
contains calculator/main.cpp "catch" -- Wrap the calculation in try { } and add a catch for std::invalid_argument.
lacks calculator/main.cpp "b == 0" label="main no longer checks for zero itself"
run "cmake --build calculator/build"
run "./calculator/build/calculator" stdin="1 / 0\n" stdout="Error: division by zero"
run "./calculator/build/calculator" stdin="9 / 3\n" stdout="9 / 3 = 3"
run "./calculator/build/calc_tests" stdout=" passed, 0 failed"
```
