---
title: 5 — Error Handling by Design: Exceptions, optional and expected
track: Classes and Abstraction
runtime: cpp
reference: optional
console: true
---

Fraction already reports one error: its constructor **throws** when the denominator is zero. That's right for a constructor. But soon Fraction will read text a person typed, like `3/0`, `abc` or `1.5`, and bad input there isn't exceptional at all. It's Tuesday.

This lesson is about choosing *how* a function reports failure, and then building a parser and a small calculator program that use each method where it fits.

## Step 1 — Four ways to fail

**This step: read and compare. No file changes.**

| Method | Looks like | Good for | Weakness |
|---|---|---|---|
| exception | `throw std::invalid_argument(...)` | broken promises: a caller passed something that must never happen; failures many layers away from the code that can handle them | invisible in the signature; easy to forget to catch; slow when thrown |
| error code | `int parse(text, Fraction& out)` returning `0` or an error number | C APIs, hot loops | easy to ignore; the result comes back through an out-parameter |
| `std::optional<T>` | `std::optional<Fraction> try_parse(text)` | "there may be no answer" (a search that finds nothing) | can't say **why** it failed |
| `std::expected<T, E>` | `std::expected<Fraction, ParseError> parse(text)` | expected failures: user input, files, network | a little more typing at the call site |

`std::expected<T, E>` (C++23) holds **either** a `T` or an error `E`. The failure is part of the return type, so the caller can't miss it, and it carries a reason:

```cpp
auto result = parse_fraction("3/0");
if (result)                          // did it work?
    use(*result);                    // the Fraction
else
    report(result.error());          // ParseError::zero_denominator
```

A useful rule: **throw when a promise is broken; return an error when failure is a normal outcome.** `Fraction(1, 0)` in code is a bug, so it throws. `"1/0"` typed by a user is just bad input, so parsing returns an error.

**Exception safety, briefly.** When something does throw, what state is left behind? Every function offers one of three guarantees:

| Guarantee | Promise | Example |
|---|---|---|
| no-throw | never throws | destructors, moves marked `noexcept` |
| strong | if it throws, nothing changed | `Fraction::operator/=`: checks first, assigns last |
| basic | if it throws, no leaks and invariants still hold | most container operations |

Fraction gets the strong guarantee almost for free: every operator builds a complete new Fraction, and only then assigns it.

**Debugger tip:** to stop at the moment an exception is thrown, before it unwinds the stack, use `breakpoint set -E c++` (lldb) or `catch throw` (gdb).

## Step 2 — C++23

**This step: switch `fraction/CMakeLists.txt` to C++23. Build and run the tests.**

```cmake
# C++23, for std::expected (see expected.h).
set(CMAKE_CXX_STANDARD 23)
```

`cmake --build` notices the changed `CMakeLists.txt` and reconfigures by itself before building. Nothing else changes: C++23 compilers accept C++20 code.

```cmake file=fraction/CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(fraction LANGUAGES CXX)

# C++23, for std::expected (see expected.h).
set(CMAKE_CXX_STANDARD 23)
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
contains fraction/CMakeLists.txt "set(CMAKE_CXX_STANDARD 23)"
run "cmake --build fraction/build"
tests "./fraction/build/fraction_tests"
```

## Step 3 — expected, with a fallback

**This step: create the supplied `fraction/expected.h` and read it.**

`std::expected` is new enough that not every standard library has it yet. GCC 13's library has it in C++23 mode, and so does recent libc++ (Apple's and the app's Clang). But Clang using GCC 13's library, a common Linux setup, doesn't.

`expected.h` deals with that the way real projects do:

- `#include <version>` defines a **feature-test macro** for each library feature that's available. `__cpp_lib_expected` is defined only if `std::expected` exists.
- If it does, `compat::expected` is simply `std::expected`.
- If not, `compat::expected` is a small class with the same basic interface: `has_value()`, `if (result)`, `*result`, `error()`, `value()`, `value_or()`. It stores a `std::variant<T, E>`, which holds exactly one of its alternatives.

Your code writes `compat::expected` and `compat::unexpected` and works either way. On a fully C++23 toolchain you could delete the fallback and write `std::` instead.

```cpp file=fraction/expected.h provided
#pragma once

// compat::expected<T, E> holds either a T (success) or an E (the
// reason it failed). It is std::expected (C++23) wherever the standard
// library has it, and a small stand-in with the same basic interface
// where it doesn't yet (for example Clang with GCC 13's library).
#include <version>

#if defined(__cpp_lib_expected)

#include <expected>

namespace compat {
using std::expected;
using std::unexpected;
} // namespace compat

#else

#include <stdexcept>
#include <utility>
#include <variant>

namespace compat {

template <typename E>
class unexpected {
public:
    explicit unexpected(E error) : error_(std::move(error)) {}
    const E& error() const { return error_; }

private:
    E error_;
};

template <typename T, typename E>
class expected {
public:
    expected(T value) : state_(std::in_place_index<0>, std::move(value)) {}
    expected(unexpected<E> failure)
        : state_(std::in_place_index<1>, failure.error())
    {
    }

    bool has_value() const { return state_.index() == 0; }
    explicit operator bool() const { return has_value(); }

    const T& operator*() const { return std::get<0>(state_); }
    const T* operator->() const { return &std::get<0>(state_); }
    const T& value() const
    {
        if (!has_value())
            throw std::logic_error("expected::value: no value");
        return std::get<0>(state_);
    }
    T value_or(T fallback) const
    {
        return has_value() ? std::get<0>(state_) : std::move(fallback);
    }
    const E& error() const { return std::get<1>(state_); }

private:
    std::variant<T, E> state_;
};

} // namespace compat

#endif
```

```check
file fraction/expected.h
```

## Step 4 — The specification for parsing

**This step: create the supplied `fraction/tests/parse_test.cpp` and read it.**

- Success: `result.has_value()` is true and `*result` is the Fraction.
- Failure: `result.error()` says which kind, as a `ParseError`, an `enum class`.
- `zero_denominator_is_an_error_not_an_exception`: `"3/0"` must come back as an error **value**. If your parser builds `Fraction(3, 0)` and lets the constructor throw, the test fails with `unexpected exception`.
- `describe` turns an error into words, for showing to a person.

```cpp file=fraction/tests/parse_test.cpp provided
// Provided by the lesson: turning text into a Fraction, or a reason.
#include "studio_test.hpp"

#include "fraction.h"

TEST(parses_a_fraction)
{
    const auto result = parse_fraction("3/4");
    CHECK(result.has_value());
    CHECK_EQ(*result, Fraction(3, 4));
}

TEST(parses_a_negative_fraction_in_lowest_terms)
{
    const auto result = parse_fraction("-6/8");
    CHECK(result.has_value());
    CHECK_EQ(*result, Fraction(-3, 4));
}

TEST(parses_a_whole_number)
{
    const auto result = parse_fraction("5");
    CHECK(result.has_value());
    CHECK_EQ(*result, Fraction(5));
}

TEST(empty_text_is_an_error)
{
    const auto result = parse_fraction("");
    CHECK(!result.has_value());
    CHECK(result.error() == ParseError::empty);
}

TEST(text_that_is_not_a_fraction_is_an_error)
{
    CHECK(parse_fraction("abc").error() == ParseError::bad_format);
    CHECK(parse_fraction("3/").error() == ParseError::bad_format);
    CHECK(parse_fraction("1.5").error() == ParseError::bad_format);
}

TEST(zero_denominator_is_an_error_not_an_exception)
{
    const auto result = parse_fraction("3/0");
    CHECK(!result.has_value());
    CHECK(result.error() == ParseError::zero_denominator);
}

TEST(errors_describe_themselves)
{
    CHECK_EQ(describe(ParseError::empty), "empty input");
    CHECK_EQ(describe(ParseError::bad_format), "not a fraction");
    CHECK_EQ(describe(ParseError::zero_denominator), "zero denominator");
    CHECK_EQ(describe(ParseError::out_of_range), "number too large");
}
```

```check
file fraction/tests/parse_test.cpp
```

## Step 5 — Declare the parser

**This step: add `ParseError`, `parse_fraction` and `describe` to the end of `fraction/fraction.h`.**

```cpp
#include <string_view>

#include "expected.h"

enum class ParseError {
    empty,              // ""
    bad_format,         // "abc", "3/", "1.5"
    zero_denominator,   // "3/0"
    out_of_range,       // "99999999999"
};

compat::expected<Fraction, ParseError> parse_fraction(
    std::string_view text);
std::string_view describe(ParseError error);
```

- `std::string_view` is a read-only view of characters owned by someone else: a `std::string`, a literal, part of a bigger text. Passing one copies nothing.
- The **return type** documents every outcome: a Fraction, or one of four named reasons. Compare `Fraction parse(const std::string&)`, which tells you nothing about failure.

```cpp file=fraction/fraction.h
#pragma once

#include <compare>
#include <iosfwd>
#include <string_view>

#include "expected.h"

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

    // Arithmetic that changes this fraction: members.
    Fraction& operator+=(const Fraction& other);
    Fraction& operator-=(const Fraction& other);
    Fraction& operator*=(const Fraction& other);
    Fraction& operator/=(const Fraction& other);  // throws on zero
    Fraction operator-() const;                    // unary minus: -f

    // Comparisons. The compiler writes ==, and != from it.
    bool operator==(const Fraction& other) const = default;
    std::strong_ordering operator<=>(const Fraction& other) const
    {
        // a/b < c/d  is  a*d < c*b, because b and d are positive.
        // long long: the products may not fit in an int.
        const long long left = static_cast<long long>(num_) * other.den_;
        const long long right = static_cast<long long>(other.num_) * den_;
        return left <=> right;
    }

private:
    int num_ = 0;
    int den_ = 1;
};

// Arithmetic that makes a new fraction: free functions, so a whole
// number converts on either side (1 + f as well as f + 1).
Fraction operator+(Fraction left, const Fraction& right);
Fraction operator-(Fraction left, const Fraction& right);
Fraction operator*(Fraction left, const Fraction& right);
Fraction operator/(Fraction left, const Fraction& right);

// Printing: a free function, because the left operand is the stream.
std::ostream& operator<<(std::ostream& out, const Fraction& f);

// Reading a Fraction from text such as "3/4", "-6/8" or "5". Failure
// is an ordinary outcome here, so it is a value, not an exception.
enum class ParseError {
    empty,              // ""
    bad_format,         // "abc", "3/", "1.5"
    zero_denominator,   // "3/0"
    out_of_range,       // "99999999999"
};

compat::expected<Fraction, ParseError> parse_fraction(
    std::string_view text);
std::string_view describe(ParseError error);
```

```check
contains fraction/fraction.h "enum class ParseError"
matches fraction/fraction.h "compat::expected\s*<\s*Fraction\s*,\s*ParseError\s*>\s*parse_fraction" label="declares compat::expected<Fraction, ParseError> parse_fraction(...)"
matches fraction/fraction.h "describe\s*\(\s*ParseError" label="declares describe(ParseError)"
```

## Step 6 — Parse

**This step: implement `parse_fraction` and `describe` in `fraction/fraction.cpp`. Build and run the tests.**

The accepted forms are `N` and `N/D`, where `N` is digits with an optional `-` in front and `D` is digits only. Nothing else, not even spaces.

A plan:

1. Empty text: `return compat::unexpected(ParseError::empty);`
2. Find the slash: `text.find('/')` gives its position, or `std::string_view::npos` if there isn't one.
3. Read the part before it as an `int`. No slash: that's a whole number, `return Fraction(n);`.
4. Read the part after it, digits only. If it's 0, return `zero_denominator` **before** constructing anything.
5. `return Fraction(n, d);` A Fraction converts to the expected's success value.

To read an `int`, use `std::from_chars` from `<charconv>`. It never throws, never skips spaces, and reports exactly how far it got:

```cpp
int value = 0;
const char* first = text.data();
const char* last = text.data() + text.size();
const auto [end, error] = std::from_chars(first, last, value);
// error == std::errc()                    : it read a number
// error == std::errc::result_out_of_range : too big for an int
// end != last                             : stopped early: "3x"
```

It accepts a leading `-`, so check for one yourself where it isn't allowed. A small helper, `parse_int(text, allow_minus)` returning `compat::expected<int, ParseError>`, keeps `parse_fraction` short. Put it in an unnamed `namespace { }` so it's private to this file.

For `describe`, a `switch` over the four values returns `"empty input"`, `"not a fraction"`, `"zero denominator"` and `"number too large"`.

```cpp file=fraction/fraction.cpp
#include "fraction.h"

#include <charconv>
#include <numeric>
#include <ostream>
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

Fraction& Fraction::operator+=(const Fraction& other)
{
    // a/b + c/d = (a*d + c*b) / (b*d); the constructor reduces it.
    *this = Fraction(num_ * other.den_ + other.num_ * den_,
                     den_ * other.den_);
    return *this;
}

Fraction& Fraction::operator-=(const Fraction& other)
{
    return *this += -other;
}

Fraction& Fraction::operator*=(const Fraction& other)
{
    *this = Fraction(num_ * other.num_, den_ * other.den_);
    return *this;
}

Fraction& Fraction::operator/=(const Fraction& other)
{
    if (other.num_ == 0)
        throw std::domain_error("Fraction: division by zero");
    *this = Fraction(num_ * other.den_, den_ * other.num_);
    return *this;
}

Fraction Fraction::operator-() const
{
    return Fraction(-num_, den_);
}

Fraction operator+(Fraction left, const Fraction& right)
{
    return left += right;
}

Fraction operator-(Fraction left, const Fraction& right)
{
    return left -= right;
}

Fraction operator*(Fraction left, const Fraction& right)
{
    return left *= right;
}

Fraction operator/(Fraction left, const Fraction& right)
{
    return left /= right;
}

std::ostream& operator<<(std::ostream& out, const Fraction& f)
{
    out << f.numerator();
    if (f.denominator() != 1)
        out << '/' << f.denominator();
    return out;
}

namespace {

// Reads text that must be one whole int and nothing else: digits,
// with a '-' in front only if allow_minus is true.
compat::expected<int, ParseError> parse_int(std::string_view text,
                                            bool allow_minus)
{
    if (text.empty() || (text.front() == '-' && !allow_minus))
        return compat::unexpected(ParseError::bad_format);
    int value = 0;
    const char* first = text.data();
    const char* last = text.data() + text.size();
    const auto [end, error] = std::from_chars(first, last, value);
    if (error == std::errc::result_out_of_range)
        return compat::unexpected(ParseError::out_of_range);
    if (error != std::errc() || end != last)
        return compat::unexpected(ParseError::bad_format);
    return value;
}

} // namespace

compat::expected<Fraction, ParseError> parse_fraction(std::string_view text)
{
    if (text.empty())
        return compat::unexpected(ParseError::empty);

    const std::size_t slash = text.find('/');
    const auto numerator = parse_int(text.substr(0, slash), true);
    if (!numerator)
        return compat::unexpected(numerator.error());
    if (slash == std::string_view::npos)
        return Fraction(*numerator);

    const auto denominator = parse_int(text.substr(slash + 1), false);
    if (!denominator)
        return compat::unexpected(denominator.error());
    if (*denominator == 0)
        return compat::unexpected(ParseError::zero_denominator);
    return Fraction(*numerator, *denominator);
}

std::string_view describe(ParseError error)
{
    switch (error) {
    case ParseError::empty: return "empty input";
    case ParseError::bad_format: return "not a fraction";
    case ParseError::zero_denominator: return "zero denominator";
    case ParseError::out_of_range: return "number too large";
    }
    return "unknown error";
}
```

```check
run "cmake --build fraction/build" -- std::from_chars needs #include <charconv>.
tests "./fraction/build/fraction_tests" require="parses_a_fraction parses_a_whole_number text_that_is_not_a_fraction_is_an_error zero_denominator_is_an_error_not_an_exception errors_describe_themselves" -- Check for a zero denominator before calling the Fraction constructor, which throws.
```

## Step 7 — A calculator

**This step: create `fraction/main.cpp`, a calculator that reads lines like `1/2 + 1/3` and prints the result or an error.**

| Input | Output |
|---|---|
| `1/2 + 1/3` | `= 5/6` |
| `x + 1` | `error: 'x': not a fraction` |
| `3/0 * 1` | `error: '3/0': zero denominator` |
| `1 / 0` | `error: division by zero` |
| `1 % 2` | `error: unknown operator '%'` |

Read three words at a time until the input ends: `while (std::cin >> left >> op >> right)`.

Here the methods meet. Parsing returns `expected`. Division by zero **throws** from `operator/`, because inside Fraction it's a broken promise. At the edge of the program, the calculator catches it and turns it into an ordinary error, so one bad line doesn't end the session:

```cpp
using Result = compat::expected<Fraction, std::string>;

Result calculate(const std::string& left, const std::string& op,
                 const std::string& right)
{
    const auto a = parse_fraction(left);
    if (!a)
        return compat::unexpected(explain(left, a.error()));
    // ... the same for right ...
    try {
        if (op == "+") return *a + *b;
        // ... -, *, / ...
    } catch (const std::domain_error&) {
        return compat::unexpected(std::string("division by zero"));
    }
    return compat::unexpected("unknown operator '" + op + "'");
}
```

`explain` builds `'x': not a fraction` from the text and `describe(error)`. The program isn't built yet: the next step adds it to `CMakeLists.txt`.

```cpp file=fraction/main.cpp
// A fraction calculator: reads lines like "1/2 + 1/3" and prints
// "= 5/6", or a clear error.
#include <iostream>
#include <stdexcept>
#include <string>

#include "fraction.h"

namespace {

using Result = compat::expected<Fraction, std::string>;

std::string explain(const std::string& text, ParseError error)
{
    return "'" + text + "': " + std::string(describe(error));
}

Result calculate(const std::string& left, const std::string& op,
                 const std::string& right)
{
    const auto a = parse_fraction(left);
    if (!a)
        return compat::unexpected(explain(left, a.error()));
    const auto b = parse_fraction(right);
    if (!b)
        return compat::unexpected(explain(right, b.error()));

    try {
        if (op == "+") return *a + *b;
        if (op == "-") return *a - *b;
        if (op == "*") return *a * *b;
        if (op == "/") return *a / *b;
    } catch (const std::domain_error&) {
        return compat::unexpected(std::string("division by zero"));
    }
    return compat::unexpected("unknown operator '" + op + "'");
}

} // namespace

int main()
{
    std::string left, op, right;
    while (std::cin >> left >> op >> right) {
        const auto result = calculate(left, op, right);
        if (result)
            std::cout << "= " << *result << '\n';
        else
            std::cout << "error: " << result.error() << '\n';
    }
    return 0;
}
```

```check
contains fraction/main.cpp "parse_fraction"
matches fraction/main.cpp "catch\s*\(\s*const\s+std::domain_error\s*&" label="catches std::domain_error"
```

## Step 8 — Build the calculator

**This step: add a `fraction_calc` program to `fraction/CMakeLists.txt`, build it, and try it.**

```cmake
add_executable(fraction_calc main.cpp fraction.cpp)
```

Put it after the `set(...)` lines, and add `fraction_calc` to the warning settings: the reference file uses a `foreach` loop over both targets, as the earlier tracks did.

```text
cmake --build fraction/build
./fraction/build/fraction_calc
```

Type a few lines, including bad ones. End the input with **Ctrl+D** (macOS, Linux) or **Ctrl+Z** then Enter (Windows).

```cmake file=fraction/CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(fraction LANGUAGES CXX)

# C++23, for std::expected (see expected.h).
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(fraction_calc main.cpp fraction.cpp)

# Every tests/*_test.cpp file becomes part of the test program.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(fraction_tests ../testing/test_main.cpp ${TEST_SOURCES} fraction.cpp)
target_include_directories(fraction_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)

foreach(target fraction_calc fraction_tests)
    if(MSVC)
        target_compile_options(${target} PRIVATE /W4)
    else()
        target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic)
    endif()
endforeach()
```

```check
matches fraction/CMakeLists.txt "add_executable\s*\(\s*fraction_calc\s+main\.cpp\s+fraction\.cpp" label="adds the fraction_calc program"
run "cmake --build fraction/build"
run "./fraction/build/fraction_calc" stdin="1/2 + 1/3\n-3/4 * 2\n" stdout="= 5/6\n= -3/2"
run "./fraction/build/fraction_calc" stdin="x + 1\n3/0 * 1\n" stdout="error: 'x': not a fraction\nerror: '3/0': zero denominator" -- Quote the text that failed: 'x': not a fraction.
run "./fraction/build/fraction_calc" stdin="1 / 0\n1 % 2\n2 * 2\n" stdout="error: division by zero\nerror: unknown operator '%'\n= 4" -- Catch std::domain_error around the arithmetic, so the program keeps going.
```

## Step 9 — The reviewer's tests

**This step: create the supplied `fraction/tests/parse_review_test.cpp`, run the tests, and fix the parser if any fail.**

Parsers are where reviewers find the most bugs, because input can be anything. These tests try the edges of the format: a lone slash, two slashes, spaces, a `+` sign, a negative denominator, numbers too big for an `int`.

`review_only_the_numerator_may_be_negative` catches a subtle one: `std::from_chars` happily reads `-4`, so a parser that uses it for the denominator without checking accepts `3/-4`.

```cpp file=fraction/tests/parse_review_test.cpp provided
// The reviewer's tests for parse_fraction. Do not edit them: make them
// pass.
#include "studio_test.hpp"

#include "fraction.h"

TEST(review_slash_needs_numbers_on_both_sides)
{
    CHECK(parse_fraction("/4").error() == ParseError::bad_format);
    CHECK(parse_fraction("/").error() == ParseError::bad_format);
    CHECK(parse_fraction("-").error() == ParseError::bad_format);
}

TEST(review_only_one_slash)
{
    CHECK(parse_fraction("3/4/5").error() == ParseError::bad_format);
}

TEST(review_nothing_extra_around_the_numbers)
{
    CHECK(parse_fraction(" 3/4").error() == ParseError::bad_format);
    CHECK(parse_fraction("3/4 ").error() == ParseError::bad_format);
    CHECK(parse_fraction("3 /4").error() == ParseError::bad_format);
    CHECK(parse_fraction("+3/4").error() == ParseError::bad_format);
}

TEST(review_only_the_numerator_may_be_negative)
{
    CHECK(parse_fraction("3/-4").error() == ParseError::bad_format);
    CHECK(parse_fraction("-3/-4").error() == ParseError::bad_format);
}

TEST(review_numbers_too_large_for_int)
{
    CHECK(parse_fraction("99999999999").error()
          == ParseError::out_of_range);
    CHECK(parse_fraction("1/99999999999").error()
          == ParseError::out_of_range);
}

TEST(review_zero_is_a_fine_numerator)
{
    const auto result = parse_fraction("0/7");
    CHECK(result.has_value());
    CHECK_EQ(*result, Fraction(0));
}
```

```check
file fraction/tests/parse_review_test.cpp
run "cmake --build fraction/build"
tests "./fraction/build/fraction_tests" require="review_slash_needs_numbers_on_both_sides review_only_one_slash review_only_the_numerator_may_be_negative review_numbers_too_large_for_int" -- The denominator is digits only: reject a leading - yourself. from_chars must use every character: check end == last.
```
