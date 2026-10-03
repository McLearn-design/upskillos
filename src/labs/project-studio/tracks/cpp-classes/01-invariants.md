---
title: 1 — Invariants: a Fraction That Keeps Its Promises
track: Classes and Abstraction
trackOrder: 7
runtime: cpp
reference: optional
console: true
---

So far your types have been `struct`s: bundles of public data that any code can read and change. That's fine for an inventory `Item`. It stops being fine the moment a type has **rules**.

A fraction has rules. `2/4` and `1/2` are the same number, so there should be one way to store it. `1/-2` should be `-1/2`. And `1/0` isn't a number at all. A rule that must be true of every object, at every moment, is called an **invariant**:

| Invariant of `Fraction` | Why it's worth having |
|---|---|
| stored in lowest terms | equal values have equal members, so `==` is trivial |
| denominator is positive | the sign lives in one place; comparing is easy |
| denominator is never 0 | every Fraction is a real number |

A **class** is how C++ turns rules into guarantees: the constructors establish the invariant, the data is `private` so nothing else can break it, and every member function can rely on it. That one idea runs through this whole track: Fraction now, notification channels with inheritance and interfaces next, then error handling and value types.

Choose a **new empty folder** for this track. The first project is `fraction/`, built with CMake and tested from the start.

## Step 1 — A struct cannot keep a promise

**This step: create the supplied `fraction/raw.cpp`, predict its output, then build and run it.**

`RawFraction` is a struct with two public `int`s. Read `main` and **predict** each line of output before you run anything.

```text
g++ -std=c++20 -Wall -Wextra fraction/raw.cpp -o fraction/raw
./fraction/raw
```

```cpp file=fraction/raw.cpp provided
// A fraction as a plain struct: two public ints and a lot of hope.
#include <iostream>

struct RawFraction {
    int num;
    int den;
};

bool same(RawFraction a, RawFraction b)
{
    return a.num == b.num && a.den == b.den;
}

void print(const char* label, RawFraction f)
{
    std::cout << label << f.num << '/' << f.den << '\n';
}

int main()
{
    RawFraction half {1, 2};
    RawFraction two_quarters {2, 4};
    std::cout << "1/2 == 2/4? " << (same(half, two_quarters) ? "yes" : "no")
              << '\n';

    RawFraction minus_half {1, -2};
    print("minus half: ", minus_half);

    RawFraction broken {1, 0};      // nothing stops this
    print("broken: ", broken);

    half.den = 0;                   // or this, years later, anywhere
    print("half, after someone's bug: ", half);
    return 0;
}
```

### What happened

```text
1/2 == 2/4? no
minus half: 1/-2
broken: 1/0
half, after someone's bug: 1/0
```

Every line is "correct" C++, and every line is wrong arithmetic:

- `same` compares members, but `2/4` and `1/2` have different members. You could make `same` cross-multiply, but then *every* function that compares, prints or hashes fractions has to remember to do the same.
- Nothing stops `{1, 0}`, and nothing stops `half.den = 0;`, which could be written years later in a file you've never seen.

The rules exist only in the programmer's head. A struct with public fields can't **keep a promise**, because anyone can break it. The rest of this lesson builds a `Fraction` class that can.

```check
run "g++ -std=c++20 -Wall -Wextra -Werror fraction/raw.cpp -o fraction/raw"
run "./fraction/raw" stdout="1/2 == 2/4? no" label="equal values compare unequal"
run "./fraction/raw" stdout="broken: 1/0" label="nothing stops a zero denominator"
```

## Step 2 — The test framework

**This step: create the supplied `testing/studio_test.hpp`.**

Fraction is built test-first, so this track needs the test framework in its new folder.

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

## Step 3 — The test runner

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

## Step 4 — The project's build file

**This step: create the supplied `fraction/CMakeLists.txt`.**

Like `dynarray` in the memory track, `fraction` starts as a library with only a test program: `fraction.cpp` plus every `tests/*_test.cpp` file. A calculator program that uses it arrives in lesson 5.

```cmake file=fraction/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(fraction LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Every tests/*_test.cpp file becomes part of the test program.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(fraction_tests ../testing/test_main.cpp ${TEST_SOURCES} fraction.cpp)
target_include_directories(fraction_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)

if(MSVC)
    target_compile_options(fraction_tests PRIVATE /W4)
else()
    target_compile_options(fraction_tests PRIVATE -Wall -Wextra -Wpedantic)
endif()
```

```check
file fraction/CMakeLists.txt
```

## Step 5 — The specification

**This step: create the supplied `fraction/tests/fraction_test.cpp` and read it.**

Each test states one promise. Notice what they *don't* do: they never touch the fraction's data directly. They create a `Fraction` and ask it questions through `numerator()` and `denominator()`.

- `zero_denominator_is_rejected` expects the constructor to **throw** `std::invalid_argument`. If a constructor can't establish the invariant, the object must not come into existence at all.
- `const_fractions_can_be_read` reads a `const Fraction`. That only compiles if the accessors promise not to change the object.

```cpp file=fraction/tests/fraction_test.cpp provided
// Provided by the lesson: the promises every Fraction keeps.
#include "studio_test.hpp"

#include <stdexcept>

#include "fraction.h"

TEST(default_fraction_is_zero)
{
    Fraction zero;
    CHECK_EQ(zero.numerator(), 0);
    CHECK_EQ(zero.denominator(), 1);
}

TEST(whole_number_has_denominator_one)
{
    Fraction three(3);
    CHECK_EQ(three.numerator(), 3);
    CHECK_EQ(three.denominator(), 1);
}

TEST(fraction_is_stored_in_lowest_terms)
{
    Fraction f(6, 8);
    CHECK_EQ(f.numerator(), 3);
    CHECK_EQ(f.denominator(), 4);
}

TEST(negative_denominator_moves_sign_to_numerator)
{
    Fraction f(1, -2);
    CHECK_EQ(f.numerator(), -1);
    CHECK_EQ(f.denominator(), 2);
}

TEST(two_negatives_make_a_positive)
{
    Fraction f(-3, -9);
    CHECK_EQ(f.numerator(), 1);
    CHECK_EQ(f.denominator(), 3);
}

TEST(zero_has_one_spelling)
{
    Fraction f(0, -5);
    CHECK_EQ(f.numerator(), 0);
    CHECK_EQ(f.denominator(), 1);
}

TEST(zero_denominator_is_rejected)
{
    CHECK_THROWS(Fraction(1, 0), std::invalid_argument);
}

TEST(const_fractions_can_be_read)
{
    const Fraction f(2, 3);
    CHECK_EQ(f.numerator(), 2);
    CHECK_EQ(f.denominator(), 3);
}
```

```check
file fraction/tests/fraction_test.cpp
```

## Step 6 — The class

**This step: create `fraction/fraction.h` with the `Fraction` class below.**

```cpp
class Fraction {
public:
    Fraction() = default;                      // 0/1
    Fraction(int whole);                       // whole/1
    Fraction(int numerator, int denominator);  // throws on 0

    int numerator() const;
    int denominator() const;

private:
    int num_ = 0;
    int den_ = 1;
};
```

- **`private:`** members can be used only by Fraction's own member functions. This is what makes the invariant enforceable: there's no `f.den_ = 0` anywhere outside the class, because it wouldn't compile.
- **Constructors** are the only way to make a Fraction, so if each one establishes the invariant, *every* Fraction has it.
- **`int num_ = 0;`** is a default member initialiser. `Fraction() = default;` asks the compiler to write the empty constructor, which uses those initialisers: `0/1`.
- **`const`** after an accessor promises it doesn't change the object, so it can be called on a `const Fraction` or through a `const Fraction&`.
- `Fraction(int whole)` is deliberately **not** `explicit`: an `int` can quietly become a Fraction, so `f + 1` will work in lesson 2. That's a design choice. For most one-argument constructors, `explicit` is the safer default.

The trailing `_` on member names is a common convention: it tells you at a glance that `den_` is data, not a local variable.

**Experiment later:** once the project builds, write `f.den_ = 0;` in a test. The compiler refuses: `'int Fraction::den_' is private within this context`. That error *is* the guarantee.

```cpp file=fraction/fraction.h
#pragma once

// A rational number that is always stored in lowest terms, with a
// positive denominator. Every constructor establishes that promise,
// and nothing outside the class can break it.
class Fraction {
public:
    Fraction() = default;                      // 0/1
    Fraction(int whole);                       // whole/1, implicit
    Fraction(int numerator, int denominator);  // throws on denominator 0

    int numerator() const;
    int denominator() const;

private:
    int num_ = 0;
    int den_ = 1;
};
```

```check
matches fraction/fraction.h "class\s+Fraction\b" label="fraction.h defines class Fraction"
matches fraction/fraction.h "private\s*:" label="the data is private"
matches fraction/fraction.h "int\s+numerator\s*\(\s*\)\s*const" label="declares int numerator() const"
matches fraction/fraction.h "int\s+denominator\s*\(\s*\)\s*const" label="declares int denominator() const"
```

## Step 7 — Establish the invariant

**This step: create `fraction/fraction.cpp` with both constructors and both accessors. Then configure, build and run the tests.**

The two-argument constructor does all the work. In order:

1. **Reject** a zero denominator: `throw std::invalid_argument("...")` (from `<stdexcept>`). Throwing from a constructor means the object is never created, so no broken Fraction ever exists.
2. **Normalise the sign**: if the denominator is negative, negate both numbers. `1/-2` becomes `-1/2`, and `-3/-9` becomes `3/9`.
3. **Reduce**: divide both by their greatest common divisor, `std::gcd` from `<numeric>`. `std::gcd(0, 5)` is `5`, so `0/5` becomes `0/1`: zero has one spelling too.

```cpp
Fraction::Fraction(int numerator, int denominator)
    : num_(numerator), den_(denominator)
{
    if (den_ == 0)
        throw std::invalid_argument("Fraction: zero denominator");
    // 2. normalise the sign, 3. reduce
}
```

The accessors are one line each: `return num_;`. Define members outside the class with the `Fraction::` prefix, `const` included: `int Fraction::numerator() const`.

```text
cmake -S fraction -B fraction/build -G "MinGW Makefiles"     (Windows)
cmake -S fraction -B fraction/build                          (macOS, Linux)
```

```text
cmake --build fraction/build
./fraction/build/fraction_tests
```

**Watch it work:** a constructor that normalises is a good place for a breakpoint. With the debugger, `breakpoint set --name Fraction::Fraction` (lldb) or `break Fraction::Fraction` (gdb), run the tests, and step through `Fraction(1, -2)` watching `num_` and `den_` change.

```cpp file=fraction/fraction.cpp
#include "fraction.h"

#include <numeric>
#include <stdexcept>

Fraction::Fraction(int whole) : num_(whole), den_(1)
{
}

Fraction::Fraction(int numerator, int denominator)
    : num_(numerator), den_(denominator)
{
    if (den_ == 0)
        throw std::invalid_argument("Fraction: zero denominator");
    if (den_ < 0) {             // keep the sign in the numerator
        num_ = -num_;
        den_ = -den_;
    }
    const int divisor = std::gcd(num_, den_);   // always positive here
    num_ /= divisor;
    den_ /= divisor;
}

int Fraction::numerator() const
{
    return num_;
}

int Fraction::denominator() const
{
    return den_;
}
```

```check
file fraction/build/CMakeCache.txt label="fraction/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build fraction/build" -- Define each member as Fraction::name, matching the declaration exactly, const included. std::gcd needs #include <numeric>.
tests "./fraction/build/fraction_tests" require="fraction_is_stored_in_lowest_terms negative_denominator_moves_sign_to_numerator zero_denominator_is_rejected" -- Check for 0 first and throw; then flip both signs if the denominator is negative; then divide both by std::gcd.
```

## Step 8 — The specification for to_double

**This step: create the supplied `fraction/tests/convert_test.cpp` and read it.**

It asks for one more member: `to_double()`, the fraction's value as a `double`. Look at how `as_percent` calls it: through a `const Fraction&`, the usual way to pass an object you only want to look at.

The test program won't build until `Fraction` has `to_double`.

```cpp file=fraction/tests/convert_test.cpp provided
// Provided by the lesson: reading a Fraction as a double.
#include "studio_test.hpp"

#include "fraction.h"

namespace {

double as_percent(const Fraction& f)   // only looks at f
{
    return f.to_double() * 100.0;
}

} // namespace

TEST(to_double_divides)
{
    Fraction f(3, 4);
    CHECK_NEAR(f.to_double(), 0.75, 1e-12);
}

TEST(to_double_works_on_a_const_reference)
{
    CHECK_NEAR(as_percent(Fraction(1, 8)), 12.5, 1e-12);
    CHECK_NEAR(as_percent(Fraction(-1, 4)), -25.0, 1e-12);
}
```

```check
file fraction/tests/convert_test.cpp
```

## Step 9 — const member functions

**This step: add `to_double()` to `fraction/fraction.h`, defined inside the class. Build and run the tests.**

A member function can be **defined** right inside the class body. That's normal for very short functions:

```cpp
double to_double() const
{
    return static_cast<double>(num_) / den_;
}
```

- `static_cast<double>(num_)` converts before dividing. `num_ / den_` alone would be integer division: `3 / 4` is `0`.
- Dividing by `den_` is always safe here. You don't need to check it: the invariant says it's never 0. That's the payoff of an invariant: code inside the class stops being defensive.

**Predict:** what happens if you forget the `const`?

### Forgetting const

```text
convert_test.cpp: error: passing 'const Fraction' as 'this'
argument discards qualifiers
```

Inside `as_percent`, `f` is a `const Fraction&`. Calling a non-`const` member on it could change a const object, so the compiler refuses. The rule of thumb: **every member function that doesn't change the object is `const`.** Forgetting it is harmless until the day someone passes your object by `const&`.

```cpp file=fraction/fraction.h
#pragma once

// A rational number that is always stored in lowest terms, with a
// positive denominator. Every constructor establishes that promise,
// and nothing outside the class can break it.
class Fraction {
public:
    Fraction() = default;                      // 0/1
    Fraction(int whole);                       // whole/1, implicit
    Fraction(int numerator, int denominator);  // throws on denominator 0

    int numerator() const;
    int denominator() const;

    // Defined inside the class: short, and the same for every caller.
    double to_double() const
    {
        return static_cast<double>(num_) / den_;
    }

private:
    int num_ = 0;
    int den_ = 1;
};
```

```check
matches fraction/fraction.h "double\s+to_double\s*\(\s*\)\s*const" label="declares double to_double() const"
run "cmake --build fraction/build" -- to_double must be const: as_percent calls it through a const Fraction&.
tests "./fraction/build/fraction_tests" require="to_double_divides to_double_works_on_a_const_reference" -- Convert to double before dividing: integer 3 / 4 is 0.
```
