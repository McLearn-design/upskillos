---
title: 1 — Function Templates: Write It Once
track: Generic Programming
trackOrder: 8
runtime: cpp
reference: optional
console: true
---

So far every function you've written works on one type. `std::vector`, `std::sort` and `std::max` are different: they work on *any* type that supports what they need. This track shows how that's done, and how to write such code yourself.

**Generic programming** means writing an algorithm or a container once, in terms of what it *needs* from a type (copy it, compare two of them, add them), and letting the compiler produce a version for each type you use it with.

| Lesson | You build |
|---|---|
| 1 | function templates, and how to read their errors |
| 2 | `Stack<T>`, a class template |
| 3 | concepts: requirements the compiler checks |
| 4 | `Ring<T, N>` and `Range`, with your own iterators |
| 5 | lambdas, and `Signal`, a callback system |
| 6 | ranges and views: a grade analyser |
| 7 | `FlatSet`, a container designed from a specification |

Choose a **new empty folder** for this track. You'll run every command from that folder. This lesson's programs live in `templates/` and are built directly with `g++`.

## Step 1 — Three copies of one function

**This step: create the supplied `templates/max_of.cpp`, read it, then build and run it.**

```text
g++ -std=c++20 -Wall -Wextra templates/max_of.cpp -o templates/max_of
./templates/max_of
```

The file has three `max_of` functions. Their bodies are identical, character for character: `return a < b ? b : a;`. Only the types differ. That's **overloading**: several functions share a name, and the compiler picks one by the argument types.

**Predict:** the last line calls `max_of('a', 'z')`. There's no `char` version. Will it compile? If it does, what will it print?

```cpp file=templates/max_of.cpp provided
// Three functions with the same body. Only the types differ.
#include <iostream>
#include <string>

int max_of(int a, int b)
{
    return a < b ? b : a;
}

double max_of(double a, double b)
{
    return a < b ? b : a;
}

std::string max_of(const std::string& a, const std::string& b)
{
    return a < b ? b : a;
}

int main()
{
    std::cout << max_of(3, 7) << '\n';
    std::cout << max_of(2.5, 1.5) << '\n';
    std::cout << max_of(std::string("pear"), std::string("apple")) << '\n';
    std::cout << max_of('a', 'z') << '\n';
}
```

### What happened

It printed `122`, not `z`.

- No overload takes `char`, so the compiler converts the arguments. A `char` can be **promoted** to an `int`, which is a better match than converting to `double` or building a `std::string`.
- `'z'` is the number 122 in ASCII, so `max_of(int, int)` returns `122`, and `std::cout` prints an `int` as a number.

Copy-pasting has two costs, then: every bug must be fixed in three places, and any type you didn't write a copy for is silently converted to one you did.

```check
run "g++ -std=c++20 -Wall -Wextra templates/max_of.cpp -o templates/max_of"
run "./templates/max_of" stdout="7\n2.5\npear\n"
run "./templates/max_of" stdout="122" label="max_of('a', 'z') prints 122"
```

## Step 2 — One template instead of three

**This step: replace the three `max_of` functions with one function template.**

```cpp
template <typename T>
T max_of(const T& a, const T& b)
{
    return a < b ? b : a;
}
```

- `template <typename T>` says: what follows is a **recipe**, with a placeholder type called `T`. (`class T` means the same thing; `typename` is the modern spelling.)
- A template isn't a function yet. When you call `max_of(3, 7)`, the compiler **deduces** `T = int` from the arguments and writes, behind the scenes, `int max_of(const int&, const int&)`. That's an **instantiation**.
- Each distinct `T` gets its own instantiation, compiled like code you'd typed yourself. There's no run-time cost: the generated `max_of<int>` is as fast as your hand-written one.
- `const T&` instead of `T`: `T` might be a long `std::string`, and copying it just to compare would be waste.

| Call | `T` is | Instantiation |
|---|---|---|
| `max_of(3, 7)` | `int` | `max_of<int>` |
| `max_of(2.5, 1.5)` | `double` | `max_of<double>` |
| `max_of('a', 'z')` | `char` | `max_of<char>` |

The template's body is also its **requirements**: `T` must support `<`, and must be copyable (it's returned by value). Any type that does, works.

**Predict** what the last line prints now, then build and run.

> 🔬 **Trace** this file in CodeLens and step into `max_of`: the frames are named `max_of<int>`, `max_of<double>` and so on, one per instantiation.

```cpp file=templates/max_of.cpp
// One template instead of three copies.
#include <iostream>
#include <string>

template <typename T>
T max_of(const T& a, const T& b)
{
    return a < b ? b : a;
}

int main()
{
    std::cout << max_of(3, 7) << '\n';
    std::cout << max_of(2.5, 1.5) << '\n';
    std::cout << max_of(std::string("pear"), std::string("apple")) << '\n';
    std::cout << max_of('a', 'z') << '\n';
}
```

```check
matches templates/max_of.cpp "template\s*<\s*(typename|class)\s+T\s*>" label="max_of.cpp declares a template with a type parameter T"
lacks templates/max_of.cpp "double max_of(double" label="the hand-written copies are gone"
run "g++ -std=c++20 -Wall -Wextra templates/max_of.cpp -o templates/max_of"
run "./templates/max_of" stdout="7\n2.5\npear\nz" label="max_of('a', 'z') now prints z"
```

## Step 3 — Deduction, and when it fails

**This step: make `max_of` compare `3` with `7.5`, printing `7.5`.**

First try the obvious: add `std::cout << max_of(3, 7.5) << '\n';` and build. It fails:

```text
GCC:   no matching function for call to 'max_of(int, double)'
       note: deduced conflicting types for parameter 'const T'
             ('int' and 'double')
Clang: no matching function for call to 'max_of'
       note: candidate template ignored: deduced conflicting
             types for parameter 'T' ('int' vs. 'double')
```

**Deduction** looks at each argument separately. The first says `T = int`, the second `T = double`, and the compiler won't guess which you meant. Unlike ordinary functions, templates don't convert arguments to make deduction work.

You have three ways out:

| Fix | Code | Trade-off |
|---|---|---|
| Say what `T` is | `max_of<double>(3, 7.5)` | clear; 3 converts to 3.0 |
| Convert an argument | `max_of(3.0, 7.5)` | only works for literals |
| Two type parameters | `template <typename A, typename B>` | which type to return? |

Use the first: an **explicit template argument**. With `T` given, there's nothing to deduce, and `3` converts to `double` as it would for an ordinary function.

```cpp
std::cout << max_of<double>(3, 7.5) << '\n';
```

```cpp file=templates/max_of.cpp
// One template instead of three copies.
#include <iostream>
#include <string>

template <typename T>
T max_of(const T& a, const T& b)
{
    return a < b ? b : a;
}

int main()
{
    std::cout << max_of(3, 7) << '\n';
    std::cout << max_of(2.5, 1.5) << '\n';
    std::cout << max_of(std::string("pear"), std::string("apple")) << '\n';
    std::cout << max_of('a', 'z') << '\n';
    std::cout << max_of<double>(3, 7.5) << '\n';
}
```

```check
matches templates/max_of.cpp "max_of\s*<\s*double\s*>\s*\(\s*3\s*,\s*7\.5\s*\)" label="max_of.cpp calls max_of<double>(3, 7.5)"
run "g++ -std=c++20 -Wall -Wextra templates/max_of.cpp -o templates/max_of" -- Conflicting types: give the template argument explicitly, max_of<double>(...).
run "./templates/max_of" stdout="z\n7.5"
```

## Step 4 — A template error, on purpose

**This step: create the supplied `templates/points.cpp`, read it, and build it. It won't compile: read the error.**

```text
g++ -std=c++20 -Wall -Wextra templates/points.cpp -o templates/points
```

`largest` finds the biggest item in a vector by calling `max_of` on each. It works for `int`s. `main` then calls it with `Point`s.

Template errors have a reputation for being long. They're long because they tell a story, from the line that broke up to the line *you* wrote. GCC prints it top-down:

```text
points.cpp: In instantiation of 'T max_of(const T&, const T&)
                                [with T = Point]':
points.cpp:16:22:   required from 'T largest(...) [with T = Point]'
points.cpp:31:22:   required from here
points.cpp:8:14: error: no match for 'operator<'
                 (operand types are 'const Point' and 'const Point')
```

Clang puts the error first, then the chain of notes:

```text
points.cpp:8:14: error: invalid operands to binary expression
                 ('const Point' and 'const Point')
points.cpp:16:16: note: in instantiation of ... 'max_of<Point>'
                  requested here
points.cpp:31:15: note: in instantiation of ... 'largest<Point>'
                  requested here
```

How to read one:

1. **Find the word `error`.** That's *what* failed: `a < b`, inside `max_of`, because `Point` has no `<`.
2. **Find the instantiation that names your types:** `[with T = Point]`, or `max_of<Point>`.
3. **Find your own line:** GCC's `required from here`, Clang's last `requested here`. Line 31, `largest(points)`, is where the chain started.

The error *happened* in `max_of`, but the *mistake* is in `main`: asking for the largest of something that can't be compared. The template body is code you might not even own (it could be inside the standard library), so the fix is usually at the bottom of the chain, not the top.

```cpp file=templates/points.cpp provided
// largest() works for ints. Does it work for Points?
#include <iostream>
#include <vector>

template <typename T>
T max_of(const T& a, const T& b)
{
    return a < b ? b : a;
}

template <typename T>
T largest(const std::vector<T>& items)
{
    T best = items.at(0);
    for (const T& item : items)
        best = max_of(best, item);
    return best;
}

struct Point {
    int x;
    int y;
};

int main()
{
    std::vector<int> scores{4, 9, 2};
    std::cout << largest(scores) << '\n';

    std::vector<Point> points{{1, 2}, {3, 1}, {2, 5}};
    Point p = largest(points);
    std::cout << p.x << ',' << p.y << '\n';
}
```

```check
file templates/points.cpp
run "g++ -std=c++20 -Wall -Wextra templates/points.cpp -o templates/points" exit=1 stderr="Point" label="it doesn't compile: Point has no <"
```

## Step 5 — Fix it: give Point an order

**This step: give `Point` a comparison, so `largest(points)` compiles. It must print `3,1`.**

`max_of` needs `a < b`. What should "less than" mean for points? There's no single right answer, so C++ makes you decide. A common choice is **lexicographic** order, like words in a dictionary: compare `x` first, and only if the `x`s are equal, compare `y`.

C++20 can write that for you:

```cpp
#include <compare>

struct Point {
    int x;
    int y;

    auto operator<=>(const Point&) const = default;
};
```

- `<=>` is the **three-way comparison** ("spaceship") operator. It answers less, equal or greater in one call.
- `= default` asks the compiler to compare the members **in the order they're declared**: `x`, then `y`.
- From `<=>`, the compiler derives `<`, `<=`, `>` and `>=`.

**Predict:** of `{1, 2}`, `{3, 1}` and `{2, 5}`, which is largest in this order?

```cpp file=templates/points.cpp
// largest() works for ints. Does it work for Points?
#include <compare>
#include <iostream>
#include <vector>

template <typename T>
T max_of(const T& a, const T& b)
{
    return a < b ? b : a;
}

template <typename T>
T largest(const std::vector<T>& items)
{
    T best = items.at(0);
    for (const T& item : items)
        best = max_of(best, item);
    return best;
}

struct Point {
    int x;
    int y;

    // Compare x first, then y: the order the members are declared in.
    auto operator<=>(const Point&) const = default;
};

int main()
{
    std::vector<int> scores{4, 9, 2};
    std::cout << largest(scores) << '\n';

    std::vector<Point> points{{1, 2}, {3, 1}, {2, 5}};
    Point p = largest(points);
    std::cout << p.x << ',' << p.y << '\n';
}
```

```check
matches templates/points.cpp "operator\s*(<=>|<)" label="Point defines a comparison"
run "g++ -std=c++20 -Wall -Wextra templates/points.cpp -o templates/points"
run "./templates/points" stdout="9\n3,1" -- Compare x first; only if the xs are equal, compare y.
```

## Step 6 — Challenge: two templates of your own

**This step: no code is given. Create `templates/challenge.cpp` with two function templates and a `main` that uses them.**

- `print_row(items)` takes a `const std::vector<T>&` and prints the items on one line, separated by single spaces (no space after the last one), then a newline.
- `count_greater(items, limit)` returns how many items are greater than `limit`, as a `std::size_t`. Use only `<` on the items, as `max_of` does: then a type needs just one operator to work with it.

`main` must use them on `{3, 8, 1, 9}` and on `{"pear", "fig", "apple"}` (a `std::vector<std::string>`), printing exactly:

```text
3 8 1 9
2 greater than 5
pear fig apple
1 greater than kiwi
```

Watch the last line: with `items` a vector of `std::string` and `limit` the literal `"kiwi"`, deduction sees two different types again. You know three ways out.

```cpp file=templates/challenge.cpp
#include <cstddef>
#include <iostream>
#include <string>
#include <vector>

template <typename T>
void print_row(const std::vector<T>& items)
{
    for (std::size_t i = 0; i < items.size(); ++i) {
        if (i > 0)
            std::cout << ' ';
        std::cout << items[i];
    }
    std::cout << '\n';
}

template <typename T>
std::size_t count_greater(const std::vector<T>& items, const T& limit)
{
    std::size_t count = 0;
    for (const T& item : items)
        if (limit < item)
            ++count;
    return count;
}

int main()
{
    std::vector<int> numbers{3, 8, 1, 9};
    std::vector<std::string> fruit{"pear", "fig", "apple"};

    print_row(numbers);
    std::cout << count_greater(numbers, 5) << " greater than 5\n";
    print_row(fruit);
    std::cout << count_greater(fruit, std::string("kiwi"))
              << " greater than kiwi\n";
}
```

```check
matches templates/challenge.cpp "(template\s*<[\s\S]*){2}" label="challenge.cpp has two templates"
run "g++ -std=c++20 -Wall -Wextra templates/challenge.cpp -o templates/challenge"
run "./templates/challenge" stdout="3 8 1 9\n2 greater than 5\npear fig apple\n1 greater than kiwi" -- No space after the last item on a row.
```
