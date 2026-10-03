---
title: 3 — When the Compiler Is Happy but the Build Fails
track: C++ from Zero — Tools of the Trade
runtime: cpp
reference: optional
console: true
---

Real programs are split across many files. Each `.cpp` file is compiled **on its own**, into its own object file, and then the **linker** joins the object files into one program. So there are two different tools that can reject your code, and their messages look very different.

In this lesson you'll split a tiny program across three files, break the link step on purpose, and fix it. You'll build in the terminal: the **Run** button compiles a single `.cpp` file, and this program needs two.

## Step 1 — A header: the promise

**This step: create the supplied `area.h` and read it.**

Click **Create provided area.h** above.

```cpp
double circle_area(double radius);
```

- This is a **declaration**: a promise that a function with this name, parameter type and return type exists *somewhere*. It has no body: just `;` where the `{ ... }` would be.
- A file of declarations is a **header**. Other files `#include` it to learn what they may call.
- `#pragma once` at the top stops the same header being pasted twice into one file.

```cpp file=area.h provided
#pragma once

// A declaration: "a function with this name and signature exists somewhere".
double circle_area(double radius);
```

```check
file area.h
```

## Step 2 — A caller that trusts the promise

**This step: create the supplied `shapes.cpp`, then compile it on its own.**

Click **Create provided shapes.cpp** above. It includes `area.h` and calls `circle_area(radius)`. Compile **just this file** with `-c` (compile, don't link):

```text
g++ -std=c++20 -c shapes.cpp
```

**Predict:** `circle_area` has no body anywhere yet. Will this succeed?

```cpp file=shapes.cpp provided
#include <iomanip>
#include <iostream>

#include "area.h"

int main()
{
    double radius = 5.0;
    std::cout << std::fixed << std::setprecision(2);
    std::cout << "Area of a circle with radius " << std::setprecision(0) << radius << ": "
              << std::setprecision(2) << circle_area(radius) << '\n';
    return 0;
}
```

### It compiles

The compiler only needs the **declaration** to check that the call is correct: the right name, a `double` argument, a `double` result. It leaves a note in `shapes.o` saying "this needs `circle_area(double)`, address unknown" for the linker to fill in.

- `#include "area.h"` uses quotes, so the preprocessor looks next to `shapes.cpp` first. Angle brackets, `<iostream>`, are for the standard library and other installed libraries.
- `std::fixed` and `std::setprecision(2)` (from `<iomanip>`) print numbers with exactly two decimal places.

```check
run "g++ -std=c++20 -c shapes.cpp" label="shapes.cpp compiles on its own" -- Create the provided file without changing it.
```

## Step 3 — Link, and read who complains

**This step: create the supplied `area.cpp`, compile it, then link the two object files.**

Click **Create provided area.cpp** above. It's meant to contain the definition of `circle_area`, but look inside. Then:

```text
g++ -std=c++20 -c area.cpp
g++ shapes.o area.o -o shapes
```

Both `-c` commands succeed. The last one, the link, fails with one of:

```text
GCC (GNU ld):
undefined reference to `circle_area(double)'

The app's Clang (LLD):
ld.lld: error: undefined symbol: circle_area(double)

macOS:
Undefined symbols for architecture ...
```

**Predict before reading on:** is this a syntax error? A missing header? Which program printed it?

```cpp file=area.cpp provided
#include "area.h"

// TODO: the definition of circle_area belongs here.
```

### The linker can't keep the promise

Notice the message names `ld`, `ld.lld` or "symbols": it comes from the **linker**, not the compiler. Every file compiled. `shapes.o` needs `circle_area(double)`, and no object file *defines* it.

| Error from | Means | Usual causes |
|---|---|---|
| the compiler (`file:line:col: error`) | this file isn't valid C++ | typos, missing `;`, missing `#include` |
| the linker (`undefined reference`, `undefined symbol`) | something declared was never defined | definition missing, its signature differs, or its `.cpp` isn't in the build |

Never fix it with `#include "area.cpp"`: as soon as two files did that, the function would be defined twice, and the linker reports that too ("multiple definition", "duplicate symbol").

```check
file area.cpp
run "g++ -std=c++20 -c area.cpp" label="area.cpp compiles on its own"
run "g++ -std=c++20 shapes.cpp area.cpp -o shapes" exit=1 label="linking fails (that's expected for now)" -- Create the provided area.cpp without adding a definition yet.
```

## Step 4 — Keep the promise

**This step: write the definition of `circle_area` in `area.cpp`, then build and run.**

The definition must match the declaration exactly: same name, a `double` parameter, a `double` result. A circle's area is π × r².

```cpp
#include <numbers>

double circle_area(double radius)
{
    return std::numbers::pi * radius * radius;
}
```

- This is a **definition**: the same first line as the declaration, plus a body.
- `std::numbers::pi` (from `<numbers>`, C++20) is π to full `double` precision.

Build both files and link them in one command, then run:

```text
g++ -std=c++20 -Wall -Wextra shapes.cpp area.cpp -o shapes
./shapes
```

```text
Area of a circle with radius 5: 78.54
```

**Experiment, after it works:** change the definition to take an `int` instead of a `double` and rebuild. The compiler is happy, and the linker isn't. C++ functions can be **overloaded** (several functions with one name and different parameter types), so the parameter types are part of a function's identity. `circle_area(int)` doesn't keep the promise made for `circle_area(double)`. Change it back.

```cpp file=area.cpp
#include "area.h"

#include <numbers>

double circle_area(double radius)
{
    return std::numbers::pi * radius * radius;
}
```

```check
run "g++ -std=c++20 -Wall -Wextra -Werror shapes.cpp area.cpp -o shapes" -- The definition's first line must match area.h exactly: double circle_area(double radius)
run "./shapes" stdout="Area of a circle with radius 5: 78.54"
```
