---
title: 2 — Reading What the Compiler Tells You
track: C++ from Zero — Tools of the Trade
runtime: cpp
run: greet.cpp
reference: optional
console: true
---

Beginners often read a compiler error as the computer saying *no*. Professionals read it as the computer saying *exactly where to look*. The compiler checks the whole program before it ever runs, so every error it catches is a bug that never reaches a user.

In this lesson you're handed broken code on purpose. Fix it, but first work out **what the message actually says**. Two habits to start now:

1. **Fix the first error first.** One mistake can confuse the compiler into reporting several more.
2. **Read the location.** `greet.cpp:6:34` means file `greet.cpp`, line 6, column 34.

Your compiler is either GCC or Clang (the app's own compiler is Clang). They word messages slightly differently; both wordings are shown below.

## Step 1 — Build it and read the first error

**This step: create the supplied `greet.cpp`, build it in the terminal, and read. Don't fix anything yet.**

Click **Create provided greet.cpp** above. The file has two mistakes. Build it:

```text
g++ -std=c++20 -Wall -Wextra greet.cpp -o greet
```

Find the **first** line containing `error`. It says one of:

```text
GCC:
greet.cpp:6:34: error: expected ';' before '}' token

Clang:
greet.cpp:6:34: error: expected ';' after return statement
```

**Predict:** which line needs fixing, and what goes there? Line 6 or line 7? Look at both before reading on.

```cpp file=greet.cpp provided
#include <iostream>
#include <string>

std::string greeting(std::string name)
{
    return "Hello, " + name + "!"
}

int main()
{
    std::string who = "Ada";
    std::cout << greting(who) << '\n';
    return 0;
}
```

### What the message means

`6:34` is line 6, column 34: the end of the `return` statement. A statement ends with `;`, and the compiler only noticed it was missing when it reached the next token, the `}` on line 7. With "expected ;" errors, always look at the end of the statement **just before** the reported position. The `}` on line 7 is correct: it closes the function.

```check
file greet.cpp
run "g++ -std=c++20 -fsyntax-only greet.cpp" exit=1 label="greet.cpp doesn't compile yet (that's expected)" -- Create the provided file without changing it.
```

## Step 2 — Fix it, rebuild, read again

**This step: add the one missing `;`, then rebuild.**

The build still fails, because there's a second mistake. That's how real debugging feels: fix one thing, rebuild, read again. The new first error is one of:

```text
GCC:
error: 'greting' was not declared in this scope;
       did you mean 'greeting'?

Clang:
error: use of undeclared identifier 'greting';
       did you mean 'greeting'?
```

**"Not declared"** means the compiler has never seen anything with that name at that point. C++ requires every name to be declared before it's used, and it matches names exactly. Usual causes:

- a typo, as here (the compiler even suggests the fix),
- a missing `#include` for something from the library,
- a missing `std::` prefix,
- using a variable outside the `{ }` block where it was declared.

You'll fix the name in the next step. This step only asks that the semicolon error is gone.

```cpp file=greet.cpp
#include <iostream>
#include <string>

std::string greeting(std::string name)
{
    return "Hello, " + name + "!";
}

int main()
{
    std::string who = "Ada";
    std::cout << greting(who) << '\n';
    return 0;
}
```

```check
contains greet.cpp "\"!\";" label="the return statement ends with ;" -- The end of line 6 needs a semicolon.
```

## Step 3 — Make it build and run

**This step: fix the name, then build and run. No warnings allowed.**

Rebuild until there are no errors, then run `./greet`, or press **Run greet.cpp** above the editor:

```text
Hello, Ada!
```

`"Hello, " + name + "!"` works because `name` is a `std::string`: adding a string and a text literal makes a new string. `"Hello, " + "!"` on its own would *not* compile: two plain literals can't be added. You'll see why when you learn about memory.

```cpp file=greet.cpp
#include <iostream>
#include <string>

std::string greeting(std::string name)
{
    return "Hello, " + name + "!";
}

int main()
{
    std::string who = "Ada";
    std::cout << greeting(who) << '\n';
    return 0;
}
```

```check
run "g++ -std=c++20 -Wall -Wextra -Werror greet.cpp -o greet" -- Line 12 calls a function whose name is spelled differently from the one defined on line 4.
run "./greet" stdout="Hello, Ada!"
```

## Step 4 — A program that compiles but is wrong

**This step: create the supplied `count.cpp`, build it, and read the warning. Don't fix it yet.**

Click **Create provided count.cpp** above. It compiles: build and run it:

```text
g++ -std=c++20 -Wall -Wextra count.cpp -o count
./count
```

The compiler prints a **warning**, not an error, and the program even prints a number. Run it a few times. The warning is one of:

```text
GCC:
count.cpp:8:23: warning: comparison of integer
                expressions of different signedness

Clang:
count.cpp:8:23: warning: comparison of integers
                of different signs
```

**Predict:** what total *should* it print for 90, 72 and 85? Does it? Now look closely at line 8 and count how many times the loop body runs.

```cpp file=count.cpp provided
#include <iostream>
#include <vector>

int main()
{
    std::vector<int> scores { 90, 72, 85 };
    int total = 0;
    for (int i = 0; i <= scores.size(); ++i)
        total += scores[i];
    std::cout << "Total: " << total << '\n';
    return 0;
}
```

### Two bugs on one line

1. `scores.size()` is an *unsigned* number (it can't be negative), and `i` is a signed `int`. Mixing them converts the `int` to unsigned, so a negative number would become a huge positive one. That's what the warning is about.
2. While you're looking at that line: `i <= scores.size()` lets `i` reach 3, but a 3-element vector's valid positions are 0, 1 and 2. Reading `scores[3]` is **undefined behaviour**: the program may print garbage, crash, or seem to work. Nothing guarantees which.

The warning didn't name the second bug, but it pointed at the right line. **Treat warnings as bugs waiting to happen.**

```check
file count.cpp
run "g++ -std=c++20 -Wall -Wextra -Werror count.cpp -o count" exit=1 label="with -Werror, the warning stops the build" -- Create the provided file without changing it.
```

## Step 5 — Fix the loop

**This step: change line 8 so the program builds with no warnings and prints `Total: 247`.**

Two ways to fix it. Use `std::size_t`, the unsigned type `size()` returns, with `<`:

```cpp
    for (std::size_t i = 0; i < scores.size(); ++i)
        total += scores[i];
```

Or don't use positions at all. A **range-based for loop** visits each element once, with nothing to get wrong:

```cpp
    for (int score : scores)
        total += score;
```

Prefer the second form whenever you don't need the position.

```cpp file=count.cpp
#include <iostream>
#include <vector>

int main()
{
    std::vector<int> scores { 90, 72, 85 };
    int total = 0;
    for (int score : scores)
        total += score;
    std::cout << "Total: " << total << '\n';
    return 0;
}
```

```check
run "g++ -std=c++20 -Wall -Wextra -Werror count.cpp -o count" -- The warning names the line. Use std::size_t, or a range-based for loop.
run "./count" stdout="Total: 247" -- Valid positions in a 3-element vector are 0, 1 and 2: the loop must stop before 3.
```
