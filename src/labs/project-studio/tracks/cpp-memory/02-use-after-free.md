---
title: 2 — Use After Free, and AddressSanitizer
track: Memory, Lifetime and Ownership
runtime: cpp
reference: optional
console: true
---

Lesson 1 showed objects dying on schedule. This lesson shows what happens when code keeps using an object **after** it died, and the tool that catches it.

You'll also meet the idea the rest of this track is built on: **ownership**. Every resource should have exactly one clear owner responsible for releasing it, and the type system should say who that is.

## Step 1 — A program that seems to work

**This step: create the supplied `lifetime/dangling.cpp`, read it, then build and run it.**

```text
g++ -std=c++20 -Wall -Wextra lifetime/dangling.cpp -o lifetime/dangling
./lifetime/dangling
```

It compiles without a single warning. It may even print the right answer.

**Predict:** read `main` line by line. Is there anything wrong with the last `std::cout`?

```cpp file=lifetime/dangling.cpp provided
#include <iostream>
#include <string>

// Builds a greeting on the heap and hands back its address.
std::string* make_greeting(const std::string& name)
{
    std::string* greeting = new std::string("Hello, " + name + "!");
    return greeting;
}

// Prints the text, then tidies up after itself.
void print_and_cleanup(std::string* text)
{
    std::cout << *text << '\n';
    delete text;
}

int main()
{
    std::string* greeting = make_greeting("Ada");
    print_and_cleanup(greeting);
    std::cout << "Length: " << greeting->size() << '\n';
    return 0;
}
```

### The bug

`make_greeting` creates a string on the heap and returns its address. `print_and_cleanup` prints it, then `delete`s it. Then `main` calls `greeting->size()` on memory that has already been released. `greeting` is now a **dangling pointer**: it still holds an address, but no object lives there any more.

Reading freed memory is **undefined behaviour**. The program may print the right length (the bytes happen to still be there), print garbage, or crash, and it may behave differently on another machine, another compiler, or next Tuesday. "It worked when I ran it" proves nothing.

```check
file lifetime/dangling.cpp
run "g++ -std=c++20 -Wall -Wextra -Werror lifetime/dangling.cpp -o lifetime/dangling" label="it compiles with no warnings at all"
```

## Step 2 — Make the bug visible: AddressSanitizer

**This step: build the program with AddressSanitizer and read its report. No file changes.**

**AddressSanitizer** (ASan) is a compiler feature that adds checks around every memory access. Instead of undefined behaviour, you get an immediate, precise report:

```text
g++ -std=c++20 -g -fsanitize=address lifetime/dangling.cpp -o lifetime/dangling-asan
./lifetime/dangling-asan
```

```text
ERROR: AddressSanitizer: heap-use-after-free on address 0x6020...
READ of size 8 ...
    #1 ... in main dangling.cpp:22              ← where freed memory was used
freed by thread T0 here:
    #1 ... in print_and_cleanup(...) dangling.cpp:15   ← where it was freed
previously allocated by thread T0 here:
    #1 ... in make_greeting(...) dangling.cpp:7        ← where it was created
```

Read it bottom to top and it tells the whole story: allocated in `make_greeting`, freed in `print_and_cleanup`, used afterwards in `main`.

- `-fsanitize=address` turns the checks on. `-g` lets the report name files and lines.
- A sanitized program runs about twice as slowly and uses more memory, so it's for development and tests, not releases.

**Where it works:** GCC and Clang on Linux, Apple's Clang on macOS, and Clang on Windows. The GCC that comes with MSYS2 on Windows doesn't support it. If your compiler says `-fsanitize=address` is unsupported, read the report above: it's exactly what you'd see.

## Step 3 — Who owns it?

**This step: think about the design. No file changes.**

Moving the `delete` to the end of `main` would make this program correct. But it wouldn't fix the real problem.

**Predict:** what's the *root* cause? Look at the three functions and ask, for each, "is this function responsible for deleting the string?"

### The root cause

Nothing in the code says who **owns** the string. `print_and_cleanup` assumed it did, and deleted it. `main` assumed it still could use it. A raw pointer (`std::string*`) says nothing about ownership: who must delete it, and when.

C++'s answer is to put ownership in the **type**:

| Type | Says |
|---|---|
| `std::string` (a value) | I own my contents, and I clean them up |
| `std::unique_ptr<T>` | I am the one owner of this heap object |
| `T&`, `const T&`, `T*` | I only look at something someone else owns |

When each type tells the truth, the compiler can enforce it.

## Step 4 — Fix the design, not the symptom

**This step: rewrite `lifetime/dangling.cpp` with no `new` and no `delete` at all.**

A `std::string` already manages its own memory. Return it **by value**:

```cpp
std::string make_greeting(const std::string& name)
{
    return "Hello, " + name + "!";
}
```

- The caller receives its own string, which it owns and which cleans itself up.
- Returning by value is cheap: the compiler builds the result directly in the caller's variable, or *moves* it (lesson 4) rather than copying.

`print_and_cleanup` now has nothing to clean up: make it `void print(const std::string& text)`. The program must print:

```text
Hello, Ada!
Length: 11
```

If your compiler supports it, rebuild with `-fsanitize=address` and confirm the report is gone.

```cpp file=lifetime/dangling.cpp
#include <iostream>
#include <string>

// Builds a greeting and returns it by value: the caller owns the result.
std::string make_greeting(const std::string& name)
{
    return "Hello, " + name + "!";
}

void print(const std::string& text)
{
    std::cout << text << '\n';
}

int main()
{
    std::string greeting = make_greeting("Ada");
    print(greeting);
    std::cout << "Length: " << greeting.size() << '\n';
    return 0;
}
```

```check
lacks lifetime/dangling.cpp "new " label="no new"
lacks lifetime/dangling.cpp "delete" label="no delete" -- The fix is to stop managing the memory by hand: return std::string by value.
run "g++ -std=c++20 -Wall -Wextra -Werror lifetime/dangling.cpp -o lifetime/dangling"
run "./lifetime/dangling" stdout="Hello, Ada!\nLength: 11"
```
