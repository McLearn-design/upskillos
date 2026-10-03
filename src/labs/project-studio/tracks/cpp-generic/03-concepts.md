---
title: 3 — Concepts: Say What a Template Needs
track: Generic Programming
runtime: cpp
reference: optional
console: true
---

A template's requirements are hidden in its body. `max_of` needs `<`, but nothing in `template <typename T>` says so: you find out when instantiation fails, deep inside code you didn't write.

C++20 **concepts** put the requirements in the signature. A concept is a named yes-or-no question about a type, answered at compile time:

```cpp
std::integral<int>            // true
std::integral<std::string>    // false
```

A template **constrained** by a concept only accepts types that satisfy it. The error, if any, is at your call, and names the requirement you missed.

## Step 1 — An error far from the mistake

**This step: create the supplied `concepts/mean.cpp`, read it, and build it. It won't compile: find where the error points.**

```text
g++ -std=c++20 -Wall -Wextra concepts/mean.cpp -o concepts/mean
```

`mean` adds the values with `sum`, then divides by the count. It's meant for numbers. `main` also calls it with names.

**Predict:** `sum` of `{"Ada", "Grace"}` works: `std::string` has `+=`, so it's `"AdaGrace"`. Where does it go wrong, and which line will the error point to?

```cpp file=concepts/mean.cpp provided
// mean() works for ages and prices. What about names?
#include <iostream>
#include <string>
#include <vector>

template <typename T>
T sum(const std::vector<T>& values)
{
    T total{};
    for (const T& value : values)
        total += value;
    return total;
}

template <typename T>
double mean(const std::vector<T>& values)
{
    return sum(values) / static_cast<double>(values.size());
}

int main()
{
    std::vector<int> ages{31, 45, 28};
    std::vector<double> prices{2.5, 4.0};
    std::vector<std::string> names{"Ada", "Grace"};

    std::cout << mean(ages) << '\n';
    std::cout << mean(prices) << '\n';
    std::cout << mean(names) << '\n';
}
```

### What happened

```text
mean.cpp:18: error: no match for 'operator/' (operand types are
             'std::string' and 'double')
    18 |     return sum(values) / static_cast<double>(values.size());
```

The error points into **`mean`'s body**, line 18: dividing a string by a number. Nothing on that line is wrong. The mistake is line 29, calling `mean` with strings at all, and that appears only as `required from here` (GCC) or a note (Clang).

Here the chain is two lines. In real libraries the body is often several templates deep, and the error lands in a file you've never opened. Worse, some wrong types *don't* fail: with `std::vector<bool>`, `mean` compiles and returns nonsense.

```check
file concepts/mean.cpp
run "g++ -std=c++20 -Wall -Wextra concepts/mean.cpp -o concepts/mean" exit=1 label="it doesn't compile"
```

## Step 2 — Constrain the template

**This step: define a concept `Number` and constrain `mean` with it. Keep the `mean(names)` line, build again, and compare the error.**

```cpp
#include <concepts>

template <typename T>
concept Number = std::integral<T> || std::floating_point<T>;

template <Number T>                   // instead of <typename T>
double mean(const std::vector<T>& values)
```

- `concept Number = ...;` names a compile-time condition on `T`. `std::integral` and `std::floating_point` are standard concepts from `<concepts>`; `||` combines them.
- `template <Number T>` means: `T` must satisfy `Number`. Two other spellings mean the same:

```cpp
template <typename T>
    requires Number<T>
double mean(const std::vector<T>& values);

double mean(const std::vector<Number auto>& values);   // no T
```

The compiler now checks the concept **before** looking at the body. For `std::string` the check fails, so `mean` isn't a candidate at all:

```text
GCC:   error: no matching function for call to 'mean(...)'
       note: constraints not satisfied
       note: no operand of the disjunction is satisfied
Clang: error: no matching function for call to 'mean'
       note: because 'std::string' does not satisfy 'Number'
```

The error is at **your** line, 34, and says which requirement failed.

```cpp file=concepts/mean.cpp
// mean() works for ages and prices. What about names?
#include <concepts>
#include <iostream>
#include <string>
#include <vector>

template <typename T>
T sum(const std::vector<T>& values)
{
    T total{};
    for (const T& value : values)
        total += value;
    return total;
}

// A concept: a named, compile-time yes/no question about a type.
template <typename T>
concept Number = std::integral<T> || std::floating_point<T>;

template <Number T>
double mean(const std::vector<T>& values)
{
    return sum(values) / static_cast<double>(values.size());
}

int main()
{
    std::vector<int> ages{31, 45, 28};
    std::vector<double> prices{2.5, 4.0};
    std::vector<std::string> names{"Ada", "Grace"};

    std::cout << mean(ages) << '\n';
    std::cout << mean(prices) << '\n';
    std::cout << mean(names) << '\n';
}
```

```check
matches concepts/mean.cpp "concept\s+Number\s*=" label="mean.cpp defines the concept Number"
run "g++ -std=c++20 -Wall -Wextra concepts/mean.cpp -o concepts/mean" exit=1 stderr="no matching function for call to" label="the error is now at the call: no matching function"
```

## Step 3 — Concepts are questions you can ask

**This step: remove `names` and the `mean(names)` line, and add three `static_assert`s about `Number`. The program must build and print the two means.**

A concept is a compile-time `bool`, so you can test it directly. `static_assert(condition)` stops the build if the condition is false:

```cpp
static_assert(Number<int>);
static_assert(Number<double>);
static_assert(!Number<std::string>);
```

These are **tests that run in the compiler**: if someone changes `Number` so that strings are accepted, the program stops building.

A concept says what's *allowed*, so choose it with care. `std::integral<bool>` and `std::integral<char>` are true: `mean` would now accept `std::vector<bool>`. If that matters, exclude it: `Number<T> && !std::same_as<T, bool>`.

```cpp file=concepts/mean.cpp
// mean() accepts numbers, and says so in its signature.
#include <concepts>
#include <iostream>
#include <string>
#include <vector>

template <typename T>
T sum(const std::vector<T>& values)
{
    T total{};
    for (const T& value : values)
        total += value;
    return total;
}

// A concept: a named, compile-time yes/no question about a type.
template <typename T>
concept Number = std::integral<T> || std::floating_point<T>;

template <Number T>
double mean(const std::vector<T>& values)
{
    return sum(values) / static_cast<double>(values.size());
}

static_assert(Number<int>);
static_assert(Number<double>);
static_assert(!Number<std::string>);

int main()
{
    std::vector<int> ages{31, 45, 28};
    std::vector<double> prices{2.5, 4.0};

    std::cout << mean(ages) << '\n';
    std::cout << mean(prices) << '\n';
}
```

```check
matches concepts/mean.cpp "static_assert\s*\(\s*!\s*Number\s*<" label="a static_assert checks that something is not a Number"
run "g++ -std=c++20 -Wall -Wextra concepts/mean.cpp -o concepts/mean"
run "./concepts/mean" stdout="34.6667\n3.25"
```

## Step 4 — A concept of your own: the specification

**This step: create the supplied `generic/tests/shapes_test.cpp` and read it.**

Concepts aren't only for number types. A **requires-expression** lists the operations a type must support, and the compiler checks each one:

```cpp
template <typename T>
concept Shape = requires(const T& shape) {
    { shape.area() } -> std::convertible_to<double>;
    { shape.name() } -> std::convertible_to<std::string>;
};
```

Read it as: "given a `const T&` called `shape`, `shape.area()` must compile and give something convertible to `double`, and `shape.name()` something convertible to `std::string`". Nothing is called: the compiler only checks that the code *would* compile.

The tests define four types and expect `Square` and `Circle` to be shapes, `Label` and `Blob` not. Then they test two functions that work on a vector of any one shape type:

- `total_area(shapes)`: the sum of the areas, `0` for none;
- `largest(shapes)`: a reference to the shape with the largest area; throws `std::invalid_argument` if there are none.

The `static_assert`s at the top are tests too: if one fails, the test program doesn't build.

```cpp file=generic/tests/shapes_test.cpp provided
// Provided by the lesson: what the Shape concept, total_area and
// largest must do.
#include "studio_test.hpp"

#include "shapes.h"

#include <stdexcept>
#include <string>
#include <vector>

namespace {

struct Square {
    double side;
    double area() const { return side * side; }
    std::string name() const { return "square"; }
};

struct Circle {
    double radius;
    double area() const { return 3.14159 * radius * radius; }
    const char* name() const { return "circle"; }   // converts to std::string
};

struct Label {   // no area at all
    std::string text;
    std::string name() const { return text; }
};

struct Blob {    // an area, but no name
    int area() const { return 2; }
};

} // namespace

// Concepts are checked by the compiler, so these tests run at compile
// time: if one fails, the test program doesn't build.
static_assert(Shape<Square>);
static_assert(Shape<Circle>);
static_assert(!Shape<Label>, "a Shape needs area()");
static_assert(!Shape<Blob>, "a Shape needs name()");
static_assert(!Shape<int>);

TEST(total_area_adds_every_shape)
{
    std::vector<Square> squares{{1.0}, {2.0}, {3.0}};
    CHECK_NEAR(total_area(squares), 14.0, 1e-9);
}

TEST(total_area_of_no_shapes_is_zero)
{
    std::vector<Circle> none;
    CHECK_NEAR(total_area(none), 0.0, 1e-9);
}

TEST(largest_finds_the_biggest_shape)
{
    std::vector<Circle> circles{{1.0}, {3.0}, {2.0}};
    CHECK_NEAR(largest(circles).radius, 3.0, 1e-9);
}

TEST(largest_of_no_shapes_throws)
{
    std::vector<Square> none;
    CHECK_THROWS(largest(none), std::invalid_argument);
}
```

```check
file generic/tests/shapes_test.cpp
```

## Step 5 — Write the Shape concept

**This step: create `generic/shapes.h` with the `Shape` concept, `total_area` and `largest`, and make the tests pass.**

Use the concept from the previous step, and constrain both functions with it:

```cpp
template <Shape S>
double total_area(const std::vector<S>& shapes)
{
    double total = 0.0;
    for (const S& shape : shapes)
        total += shape.area();
    return total;
}
```

`largest` returns `const S&`, a reference into the vector. Keep a pointer to the best shape so far, starting at `&shapes.front()`, and return `*best`. Check for an empty vector **first**: `front()` of an empty vector is undefined behaviour.

### Concepts or virtual functions?

If you've used interfaces in Java or C#, or virtual functions in C++, `Shape` looks like one. The difference:

| | concept `Shape` | virtual `area()` |
|---|---|---|
| checked | at compile time | at run time |
| a `vector` holds | one shape type | any mix, through pointers |
| the type must | just have the members | inherit from a base class |
| call cost | none: it's inlined | an indirect call |

A `std::vector<Square>` can't also hold a `Circle`. When you need a mixed collection, you need run-time polymorphism. When you don't, concepts are faster and need no base class.

```cpp file=generic/shapes.h
#pragma once

#include <concepts>
#include <stdexcept>
#include <string>
#include <vector>

// A type is a Shape if it can tell you its area and its name.
template <typename T>
concept Shape = requires(const T& shape) {
    { shape.area() } -> std::convertible_to<double>;
    { shape.name() } -> std::convertible_to<std::string>;
};

template <Shape S>
double total_area(const std::vector<S>& shapes)
{
    double total = 0.0;
    for (const S& shape : shapes)
        total += shape.area();
    return total;
}

template <Shape S>
const S& largest(const std::vector<S>& shapes)
{
    if (shapes.empty())
        throw std::invalid_argument("largest: there are no shapes");
    const S* best = &shapes.front();
    for (const S& shape : shapes)
        if (shape.area() > best->area())
            best = &shape;
    return *best;
}
```

```check
matches generic/shapes.h "concept\s+Shape\s*=\s*requires" label="shapes.h defines Shape with a requires-expression"
run "cmake --build generic/build" -- If a static_assert fails, check that Shape requires both area() and name().
tests "./generic/build/generic_tests" require="total_area_adds_every_shape largest_of_no_shapes_throws"
```

## Step 6 — Challenge: Summable

**This step: no code is given. Create `generic/sum.h` with a concept `Summable` and a function template `sum` constrained by it.**

`mean` used a `sum` that relied on `+=`. Write a better one, whose requirements are in its signature:

- `Summable<T>` is true when you can make an empty `T` with `T{}` (the standard concept `std::default_initializable<T>`) **and** adding two `const T&`s gives something convertible to `T`.
- `sum(values)` takes a `const std::vector<T>&` and returns the total, starting from `T{}`. For an empty vector that's `0`, or `""` for strings.

Combine a standard concept and a requires-expression with `&&`.

```cpp file=generic/sum.h
#pragma once

#include <concepts>
#include <vector>

// Summable: you can make an empty one (T{}), and adding two gives a T.
template <typename T>
concept Summable =
    std::default_initializable<T> && requires(const T& a, const T& b) {
        { a + b } -> std::convertible_to<T>;
    };

template <Summable T>
T sum(const std::vector<T>& values)
{
    T total{};
    for (const T& value : values)
        total = total + value;
    return total;
}
```

```check
matches generic/sum.h "concept\s+Summable\s*=" label="sum.h defines the concept Summable"
matches generic/sum.h "(Summable\s+T|requires\s+Summable)" label="sum is constrained by Summable"
```

## Step 7 — Challenge: test it, at compile time and at run time

**This step: create `generic/tests/sum_test.cpp` with `static_assert`s for `Summable` and at least three tests of `sum`.**

- `static_assert`s: at least one type that is `Summable` and one that isn't. A small struct with no `+` will do.
- Tests: ints, an empty vector, and strings (`sum` of `{"gen", "er", "ic"}` is `"generic"`).

```cpp file=generic/tests/sum_test.cpp
// My tests for Summable and sum.
#include "studio_test.hpp"

#include "sum.h"

#include <string>
#include <vector>

namespace {
struct Colour {   // can't be added
    int r, g, b;
};
} // namespace

static_assert(Summable<int>);
static_assert(Summable<double>);
static_assert(Summable<std::string>);
static_assert(!Summable<Colour>);

TEST(sum_adds_ints)
{
    CHECK_EQ(sum(std::vector<int>{1, 2, 3, 4}), 10);
}

TEST(sum_of_nothing_is_the_empty_value)
{
    CHECK_EQ(sum(std::vector<int>{}), 0);
    CHECK_EQ(sum(std::vector<std::string>{}), "");
}

TEST(sum_joins_strings)
{
    CHECK_EQ(sum(std::vector<std::string>{"gen", "er", "ic"}), "generic");
}
```

```check
matches generic/tests/sum_test.cpp "static_assert\s*\(\s*!\s*Summable" label="a static_assert checks a type that is not Summable"
matches generic/tests/sum_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="sum_test.cpp has at least three tests"
run "cmake --build generic/build"
tests "./generic/build/generic_tests"
```
