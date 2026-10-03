---
title: 2 — Operator Overloading: Fractions That Do Arithmetic
track: Classes and Abstraction
runtime: cpp
reference: optional
console: true
---

`Fraction` keeps its promises, but it's clumsy to use. You can't write `a + b`, `a == b` or `std::cout << a`. For a number-like type, that's the whole point.

C++ lets a class define what operators mean for it. An overloaded operator is just a function with a special name:

| You write | The compiler calls |
|---|---|
| `a + b` | `operator+(a, b)` or `a.operator+(b)` |
| `a += b` | `a.operator+=(b)` |
| `a == b` | `a.operator==(b)` |
| `std::cout << a` | `operator<<(std::cout, a)` |

This lesson adds comparison, printing and arithmetic to Fraction, and shows the choice that matters most: which operators are **members** and which are **free functions**. Then it covers when not to overload at all.

## Step 1 — The specification for comparing and printing

**This step: create the supplied `fraction/tests/compare_test.cpp` and read it.**

- `std::sort` needs `<` to put fractions in order.
- `CHECK_EQ(v[0], Fraction(-1, 4))` needs `==`, and also `<<`: when a check fails, the test framework prints both values.
- `compares_with_whole_numbers_on_either_side` writes `1 < Fraction(3, 2)`, with the `int` on the left.

The test program won't build until Fraction has these operators.

```cpp file=fraction/tests/compare_test.cpp provided
// Provided by the lesson: comparing and printing fractions.
#include "studio_test.hpp"

#include <algorithm>
#include <sstream>
#include <string>
#include <vector>

#include "fraction.h"

namespace {

std::string text(const Fraction& f)
{
    std::ostringstream out;
    out << f;
    return out.str();
}

} // namespace

TEST(equal_values_compare_equal)
{
    CHECK(Fraction(1, 2) == Fraction(2, 4));
    CHECK(Fraction(1, -3) == Fraction(-1, 3));
    CHECK(Fraction(1, 3) != Fraction(1, 2));
}

TEST(prints_as_numerator_slash_denominator)
{
    CHECK_EQ(text(Fraction(3, 4)), "3/4");
    CHECK_EQ(text(Fraction(1, -3)), "-1/3");
}

TEST(whole_numbers_print_without_a_denominator)
{
    CHECK_EQ(text(Fraction(4, 2)), "2");
    CHECK_EQ(text(Fraction()), "0");
}

TEST(ordering_follows_value)
{
    CHECK(Fraction(1, 3) < Fraction(1, 2));
    CHECK(Fraction(2, 3) > Fraction(3, 5));
    CHECK(Fraction(-1, 2) < Fraction(1, 3));
    CHECK(Fraction(3, 4) <= Fraction(6, 8));
}

TEST(compares_with_whole_numbers_on_either_side)
{
    CHECK(Fraction(1, 2) < 1);
    CHECK(1 < Fraction(3, 2));
    CHECK(Fraction(4, 2) == 2);
}

TEST(sorting_puts_fractions_in_value_order)
{
    std::vector<Fraction> v {{1, 2}, {1, 3}, {-1, 4}, {2, 3}};
    std::sort(v.begin(), v.end());
    CHECK_EQ(v[0], Fraction(-1, 4));
    CHECK_EQ(v[1], Fraction(1, 3));
    CHECK_EQ(v[2], Fraction(1, 2));
    CHECK_EQ(v[3], Fraction(2, 3));
}
```

```check
file fraction/tests/compare_test.cpp
```

## Step 2 — Let the compiler write the comparisons

**This step: in `fraction/fraction.h`, ask the compiler for `==` and `<=>`, and declare `operator<<`.**

C++20 can write comparison operators for you. Add these to the public part of the class:

```cpp
bool operator==(const Fraction& other) const = default;
auto operator<=>(const Fraction& other) const = default;
```

- A **defaulted `==`** compares the members one by one: `num_` with `num_`, `den_` with `den_`. The compiler also rewrites `a != b` as `!(a == b)`.
- **`<=>`**, the "spaceship" operator, answers less, equal or greater in one call. Define it once and the compiler rewrites `<`, `<=`, `>` and `>=` to use it. Defaulted, it compares the members **in order**, like words in a dictionary.
- Both need `#include <compare>`.

Printing can't be a member. In `std::cout << f`, the **left** operand is the stream, and a member operator always belongs to its left operand. `std::ostream` isn't your class, so `<<` is a **free function**, declared after the class:

```cpp
#include <iosfwd>     // declares std::ostream without all of <iostream>

std::ostream& operator<<(std::ostream& out, const Fraction& f);
```

It returns the stream so that `std::cout << a << " and " << b` chains.

```cpp file=fraction/fraction.h
#pragma once

#include <compare>
#include <iosfwd>

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

    // Comparisons. The compiler writes ==, and != from it.
    bool operator==(const Fraction& other) const = default;
    auto operator<=>(const Fraction& other) const = default;

private:
    int num_ = 0;
    int den_ = 1;
};

// Printing: a free function, because the left operand is the stream.
std::ostream& operator<<(std::ostream& out, const Fraction& f);
```

```check
matches fraction/fraction.h "operator==\s*\([^)]*\)\s*const\s*=\s*default" label="== is defaulted"
matches fraction/fraction.h "operator<=>" label="declares operator<=>"
matches fraction/fraction.h "std::ostream\s*&\s*operator<<\s*\(" label="declares operator<< as a free function"
```

## Step 3 — Printing, and a surprise

**This step: define `operator<<` in `fraction/fraction.cpp`. Build and run the tests. Some fail: work out why before you read on.**

```cpp
std::ostream& operator<<(std::ostream& out, const Fraction& f)
{
    out << f.numerator();
    if (f.denominator() != 1)          // whole numbers print as "2"
        out << '/' << f.denominator();
    return out;
}
```

- It's a free function, so it has no `Fraction::` prefix, and it can only use the public accessors. That's fine: printing needs nothing private.
- `#include <ostream>` in the `.cpp`, where the stream is actually used.

**Predict:** the equality tests pass, thanks to the invariant. Which comparison tests fail? Think about how a defaulted `<=>` compares `1/3` with `1/2`, member by member.

```cpp file=fraction/fraction.cpp
#include "fraction.h"

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

std::ostream& operator<<(std::ostream& out, const Fraction& f)
{
    out << f.numerator();
    if (f.denominator() != 1)
        out << '/' << f.denominator();
    return out;
}
```

### What happened

Equality works, and that's no accident: because every Fraction is stored in lowest terms with a positive denominator, **equal values have equal members**. The invariant made the defaulted `==` correct.

Ordering is broken. The defaulted `<=>` compares `num_` first, and only looks at `den_` when the numerators tie:

```text
1/3 <=> 1/2:  num_ 1 vs 1: tie
              den_ 3 vs 2: 3 is greater
              so 1/3 > 1/2      wrong
```

Memberwise order is right for types like a version number (1.2.3), where the members really are "most significant first". A fraction's value depends on both members together, so it needs a hand-written comparison.

```check
run "cmake --build fraction/build" -- operator<< is a free function: no Fraction:: in front of it. Include <ostream>.
run "./fraction/build/fraction_tests" exit=1 stdout="[       OK ] equal_values_compare_equal" label="equality already works"
run "./fraction/build/fraction_tests" exit=1 stdout="[       OK ] whole_numbers_print_without_a_denominator" -- Print the denominator only when it is not 1.
run "./fraction/build/fraction_tests" exit=1 stdout="[  FAILED  ] ordering_follows_value" label="ordering fails, for now"
```

## Step 4 — Compare by value

**This step: replace the defaulted `<=>` in `fraction/fraction.h` with one that compares values. Every test must pass.**

To compare `a/b` with `c/d`, cross-multiply: `a/b < c/d` exactly when `a·d < c·b`. That's only true because `b` and `d` are **positive**, which is another promise the invariant keeps. With a negative denominator, multiplying would flip the comparison.

```cpp
std::strong_ordering operator<=>(const Fraction& other) const
{
    const long long left = static_cast<long long>(num_) * other.den_;
    const long long right = static_cast<long long>(other.num_) * den_;
    return left <=> right;
}
```

- **`std::strong_ordering`** is the result type: less, equal or greater, where equal means interchangeable. Comparing two `long long`s with `<=>` produces one.
- `long long` because two `int`s multiplied can overflow an `int`, which is undefined behaviour.
- Keep `operator==` defaulted. It's still correct, and faster than cross-multiplying.

`1 < Fraction(3, 2)` works too. The compiler converts `1` with `Fraction(int)`, and C++20 also tries `<=>` with the operands **swapped**, so a member `<=>` works with the `int` on either side.

```cpp file=fraction/fraction.h
#pragma once

#include <compare>
#include <iosfwd>

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

// Printing: a free function, because the left operand is the stream.
std::ostream& operator<<(std::ostream& out, const Fraction& f);
```

```check
run "cmake --build fraction/build"
tests "./fraction/build/fraction_tests" require="ordering_follows_value compares_with_whole_numbers_on_either_side sorting_puts_fractions_in_value_order" -- Compare num_ * other.den_ with other.num_ * den_, as long long.
```

## Step 5 — The specification for arithmetic

**This step: create the supplied `fraction/tests/arithmetic_test.cpp` and read it.**

Four operators, their compound forms (`+=` and friends), and unary minus. Dividing by zero throws `std::domain_error`: the maths isn't defined, and there is no sensible Fraction to return.

Before you add operators, know when **not** to:

| Overload | Verdict |
|---|---|
| `+ - * /` for a number type | yes: the meaning is obvious |
| `==`, `<=>` for any value type | yes: needed by sorting, searching, tests |
| `<<` for printing | yes: the standard library convention |
| `^` for "to the power of" | no: `^` binds more loosely than `+`, so `a ^ 2 + 1` is `a ^ 3` |
| `+` to add an item to a list | no: `list + item` hides that the list changed. Name it `add` |
| `operator double()` | rarely: silent conversions make overloads ambiguous. Prefer `to_double()` |

Never overload `&&`, `||` or the comma operator: the overloaded versions lose short-circuiting and their order of evaluation.

The test for an operator: would a reader guess what it does, with no documentation? If not, write a named function.

```cpp file=fraction/tests/arithmetic_test.cpp provided
// Provided by the lesson: arithmetic on fractions.
#include "studio_test.hpp"

#include <stdexcept>

#include "fraction.h"

TEST(adds)
{
    CHECK_EQ(Fraction(1, 2) + Fraction(1, 3), Fraction(5, 6));
    CHECK_EQ(Fraction(1, 4) + Fraction(1, 4), Fraction(1, 2));
}

TEST(subtracts)
{
    CHECK_EQ(Fraction(1, 2) - Fraction(1, 3), Fraction(1, 6));
    CHECK_EQ(Fraction(1, 3) - Fraction(1, 2), Fraction(-1, 6));
}

TEST(multiplies)
{
    CHECK_EQ(Fraction(2, 3) * Fraction(3, 4), Fraction(1, 2));
}

TEST(divides)
{
    CHECK_EQ(Fraction(1, 2) / Fraction(1, 4), Fraction(2));
    CHECK_EQ(Fraction(1, 2) / Fraction(-3, 4), Fraction(-2, 3));
}

TEST(dividing_by_zero_throws)
{
    CHECK_THROWS(Fraction(1, 2) / Fraction(0), std::domain_error);
}

TEST(negates)
{
    CHECK_EQ(-Fraction(3, 4), Fraction(-3, 4));
    CHECK_EQ(-Fraction(), Fraction());
}

TEST(compound_assignment_changes_the_left_side)
{
    Fraction f(1, 2);
    f += Fraction(1, 4);
    CHECK_EQ(f, Fraction(3, 4));
    f -= Fraction(1, 2);
    CHECK_EQ(f, Fraction(1, 4));
    f *= Fraction(8);
    CHECK_EQ(f, Fraction(2));
    f /= Fraction(4);
    CHECK_EQ(f, Fraction(1, 2));
}

TEST(whole_numbers_work_on_either_side)
{
    const Fraction half(1, 2);
    CHECK_EQ(half + 1, Fraction(3, 2));
    CHECK_EQ(1 + half, Fraction(3, 2));
    CHECK_EQ(2 * half, Fraction(1));
    CHECK_EQ(1 - half, half);
}
```

```check
file fraction/tests/arithmetic_test.cpp
```

## Step 6 — Members or free functions?

**This step: declare the arithmetic operators in `fraction/fraction.h`: the compound ones and unary minus as members, the binary ones as free functions.**

```cpp
// in the class: these change (or read) *this
Fraction& operator+=(const Fraction& other);
Fraction& operator-=(const Fraction& other);
Fraction& operator*=(const Fraction& other);
Fraction& operator/=(const Fraction& other);
Fraction operator-() const;                 // -f

// after the class: these make a new Fraction
Fraction operator+(Fraction left, const Fraction& right);
// ... and -, *, / the same way
```

The rule:

- **Members** for operators that change the left operand (`+=`) or naturally belong to the object (unary `-`). They return `Fraction&`, a reference to `*this`, like `int`'s `+=` does.
- **Free functions** for symmetric operators (`+`, `-`, `*`, `/`). Here's why it matters:

| `operator+` is a… | `half + 1` | `1 + half` |
|---|---|---|
| member | ✓ `1` converts to Fraction | ✗ `1` is an `int`: no `int::operator+` |
| free function | ✓ | ✓ either side converts |

A member operator never converts its left operand. A free one treats both sides the same.

`left` is taken **by value** on purpose: it's a copy you can modify and return, so `operator+` is just `return left += right;`.

```cpp file=fraction/fraction.h
#pragma once

#include <compare>
#include <iosfwd>

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
```

```check
matches fraction/fraction.h "Fraction\s*&\s*operator\+=\s*\(" label="declares Fraction& operator+="
matches fraction/fraction.h "^Fraction\s+operator\+\s*\(" label="operator+ is a free function, declared after the class" -- Declare it at the start of a line, outside the class: Fraction operator+(Fraction left, const Fraction& right);
matches fraction/fraction.h "operator-\s*\(\s*\)\s*const" label="declares unary minus: Fraction operator-() const"
matches fraction/fraction.h "Fraction\s*&\s*operator/=\s*\(" label="declares Fraction& operator/="
```

## Step 7 — Arithmetic

**This step: define the operators in `fraction/fraction.cpp`. Build and run the tests.**

Write the compound operators first, by building a **new Fraction** and assigning it:

```cpp
Fraction& Fraction::operator+=(const Fraction& other)
{
    // a/b + c/d = (a*d + c*b) / (b*d)
    *this = Fraction(num_ * other.den_ + other.num_ * den_,
                     den_ * other.den_);
    return *this;
}
```

- The constructor reduces and normalises the result, so the invariant holds without any new code. Every operator that goes through the constructor is correct by construction.
- `this` points to the object the member was called on, and `*this` is the object. Returning `*this` by reference makes `(f += a) += b` change `f` twice.
- `/=` must throw `std::domain_error` when `other` is zero, **before** changing anything.
- `-=` can reuse `+=`: `return *this += -other;`.

Then each free operator is one line:

```cpp
Fraction operator+(Fraction left, const Fraction& right)
{
    return left += right;
}
```

> These products can overflow `int` for large fractions. A production class would use a wider type or check, but the structure would be the same.

```cpp file=fraction/fraction.cpp
#include "fraction.h"

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
```

```check
run "cmake --build fraction/build" -- Members are Fraction::operator+=; free functions have no Fraction:: prefix.
tests "./fraction/build/fraction_tests" require="adds divides dividing_by_zero_throws negates compound_assignment_changes_the_left_side whole_numbers_work_on_either_side" -- Build each result with the Fraction constructor, so it is reduced. /= throws std::domain_error when other is zero.
```

## Step 8 — Your own tests

**This step: create `fraction/tests/my_arithmetic_test.cpp` with at least three tests of your own.**

The specification tested the obvious cases. Look for the ones it missed:

- an operator applied to the object itself: `f -= f`, `f /= f`
- negative operands, zero operands, whole numbers on both sides
- chaining compound assignments
- what happens to `f` when `f /= 0` throws

Start the file like the others: `#include "studio_test.hpp"` and `#include "fraction.h"`.

```cpp file=fraction/tests/my_arithmetic_test.cpp
// My own tests for Fraction's arithmetic.
#include "studio_test.hpp"

#include "fraction.h"

TEST(adding_a_negative_subtracts)
{
    CHECK_EQ(Fraction(1, 2) + Fraction(-1, 3), Fraction(1, 6));
}

TEST(multiplying_by_zero_gives_zero)
{
    CHECK_EQ(Fraction(7, 9) * Fraction(0), Fraction(0));
}

TEST(subtracting_twice_returns_to_the_start)
{
    Fraction f(2, 5);
    f -= Fraction(1, 5);
    f -= Fraction(1, 5);
    CHECK_EQ(f, Fraction(0));
}

TEST(dividing_by_a_whole_number)
{
    CHECK_EQ(Fraction(3, 4) / 3, Fraction(1, 4));
}
```

```check
matches fraction/tests/my_arithmetic_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="my_arithmetic_test.cpp has at least three tests"
run "cmake --build fraction/build"
tests "./fraction/build/fraction_tests"
```

## Step 9 — The reviewer's tests

**This step: create the supplied `fraction/tests/operators_review_test.cpp`, run the tests, and fix your operators if any fail.**

A reviewer reads your class looking for the cases you didn't think about. Two of these tests check promises that are easy to break without noticing:

- `review_compound_assignment_returns_the_object`: if `+=` returns a `Fraction` **by value** instead of `Fraction&`, `(f += a) += b` adds `b` to a temporary copy, and `f` silently misses it.
- `review_failed_division_leaves_the_fraction_unchanged`: when an operation throws, the object should be exactly as it was. That's called the **strong exception guarantee**, and you get it for free by checking first and assigning last.

```cpp file=fraction/tests/operators_review_test.cpp provided
// The reviewer's tests for Fraction's operators. Do not edit them:
// make them pass.
#include "studio_test.hpp"

#include <stdexcept>

#include "fraction.h"

TEST(review_operating_on_itself)
{
    Fraction f(3, 4);
    f -= f;
    CHECK_EQ(f, Fraction(0));
    Fraction g(3, 4);
    g /= g;
    CHECK_EQ(g, Fraction(1));
    Fraction h(2, 3);
    h *= h;
    CHECK_EQ(h, Fraction(4, 9));
}

TEST(review_compound_assignment_returns_the_object)
{
    Fraction f(1, 2);
    (f += Fraction(1, 4)) += Fraction(1, 4);
    CHECK_EQ(f, Fraction(1));
    (f *= 3) /= 2;
    CHECK_EQ(f, Fraction(3, 2));
}

TEST(review_failed_division_leaves_the_fraction_unchanged)
{
    Fraction f(5, 7);
    CHECK_THROWS(f /= Fraction(0, 3), std::domain_error);
    CHECK_EQ(f, Fraction(5, 7));
}

TEST(review_whole_numbers_divide_on_either_side)
{
    CHECK_EQ(Fraction(1) / 3, Fraction(1, 3));
    CHECK_EQ(3 / Fraction(1, 2), Fraction(6));
    CHECK_EQ(Fraction(1, 2) - 1, Fraction(-1, 2));
}

TEST(review_results_are_in_lowest_terms)
{
    const Fraction sum = Fraction(1, 6) + Fraction(1, 3);
    CHECK_EQ(sum.numerator(), 1);
    CHECK_EQ(sum.denominator(), 2);
    const Fraction product = Fraction(-2, 3) * Fraction(-3, 2);
    CHECK_EQ(product.numerator(), 1);
    CHECK_EQ(product.denominator(), 1);
}

TEST(review_negative_values_order_correctly)
{
    CHECK(Fraction(-1, 2) < Fraction(-1, 3));
    CHECK(-Fraction(1, 3) > -Fraction(1, 2));
    CHECK(Fraction(-3) < Fraction(-5, 2));
}
```

```check
file fraction/tests/operators_review_test.cpp
run "cmake --build fraction/build"
tests "./fraction/build/fraction_tests" require="review_operating_on_itself review_compound_assignment_returns_the_object review_failed_division_leaves_the_fraction_unchanged" -- Compound assignment returns Fraction& (return *this;). Throw before you assign anything.
```
