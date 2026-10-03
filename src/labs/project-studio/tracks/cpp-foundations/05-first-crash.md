---
title: 5 — Your First Crash, and the Debugger
track: C++ from Zero — Tools of the Trade
runtime: cpp
run: inventory.cpp
reference: optional
console: true
---

Some bugs can't be found by the compiler: they only show up while the program runs. When that happens, beginners add print statements and guess. Engineers use a **debugger**: a program that runs yours under its control, pauses it on any line, and shows the real value of every variable at that moment.

This lesson hands you a program that crashes. Don't fix it by reading the code. **Find the bug with the debugger first.** That habit will save you hundreds of hours.

You'll meet a **pointer** here: a variable holding the *address* of another object.

- `Item*` means "address of an `Item`".
- `&item` takes an object's address.
- `item->quantity` means "the `quantity` of the object at this address".
- `nullptr` is a special address meaning "no object".

That's all you need for now. Pointers get a full treatment when you study memory.

## Step 1 — Run it and watch it fail

**This step: create the supplied `inventory.cpp`, build it with debug information, and run it.**

Click **Create provided inventory.cpp** above. Read it once, briefly, without hunting for the bug. Then:

```text
g++ -std=c++20 -g -Wall -Wextra inventory.cpp -o inventory
./inventory
```

- `-g` asks the compiler to include **debug information**: a map from machine code back to your source lines and variable names. Without it, a debugger can only show raw addresses.

**Predict:** the program looks up nuts, screws and bolts. What will it print?

**Observe:** it prints `nuts: 80`, then stops. Depending on your system you'll see `Segmentation fault`, or nothing more at all, and a non-zero exit code (`echo $LASTEXITCODE` or `echo $?`). The operating system stopped the program because it touched memory it doesn't own. The output tells you roughly *when* it died, but not *why*.

```cpp file=inventory.cpp provided
#include <iostream>
#include <string>
#include <vector>

struct Item {
    std::string name;
    int quantity;
};

// Returns the address of the item with the given name.
Item* find_item(std::vector<Item>& items, const std::string& name)
{
    for (Item& item : items) {
        if (item.name == name)
            return &item;
    }
    return nullptr;
}

int main()
{
    std::vector<Item> items { {"bolts", 120}, {"nuts", 80}, {"washers", 200} };
    std::vector<std::string> wanted { "nuts", "screws", "bolts" };

    for (const std::string& name : wanted) {
        Item* item = find_item(items, name);
        std::cout << name << ": " << item->quantity << '\n';
    }
    return 0;
}
```

```check
file inventory.cpp
run "g++ -std=c++20 -g -Wall -Wextra -Werror inventory.cpp -o inventory" label="it compiles cleanly, so the compiler can't see this bug" -- Create the provided file without changing it.
```

## Step 2 — Stop at the crash and look inside

**This step: run the program under the debugger, and read the variables at the moment it crashes. No file changes.**

`lldb` comes with the app's C++ compiler. If you installed your own compiler, you may have `gdb` instead; the commands are listed side by side.

| System | Start the debugger |
|---|---|
| Windows | `lldb inventory.exe` |
| macOS, Linux | `lldb ./inventory` |
| with gdb instead | `gdb ./inventory` |

Then, at the debugger's prompt:

| What | lldb | gdb |
|---|---|---|
| start the program | `run` | `run` |
| show the call stack | `bt` | `bt` |
| show a variable | `frame variable name` | `print name` |
| show the pointer | `frame variable item` | `print item` |
| quit | `quit` | `quit` |

The program runs until it crashes. The debugger then **stops on the exact line** that made the bad access and prints it.

**Predict, then look:** when it stops, what are `name` and `item`?

### What you should find

`name` is `"screws"` and `item` is `0x0`, the null pointer. `find_item` searched the whole vector, found no screws, and returned `nullptr` to mean "not found". Then `item->quantity` tried to read memory at address 0, which no program is allowed to touch.

`bt` (*backtrace*) shows the **call stack**: the chain of function calls that led here, with `main` at or near the bottom. In bigger programs it tells you how you got to the crash.

## Step 3 — Pause before it goes wrong

**This step: set a breakpoint and step through one loop iteration. No file changes.**

A crash is where the program *died*. The interesting question is where it *went wrong*. A **breakpoint** pauses the program before a line runs.

| What | lldb | gdb |
|---|---|---|
| pause before line 26 | `breakpoint set --file inventory.cpp --line 26` | `break inventory.cpp:26` |
| start the program | `run` | `run` |
| show a variable | `frame variable name` | `print name` |
| run this line, stop at the next | `next` | `next` |
| go inside the function being called | `step` | `step` |
| run to the next breakpoint | `continue` | `continue` |

Line 26 is `Item* item = find_item(items, name);`. Stop there on the second loop iteration (`continue` once) so that `name` is `"screws"`. Then `step` *into* `find_item` and `next` through its loop: watch it compare each item's name, fall out of the loop, and reach `return nullptr`.

`find_item` is doing exactly what its design says: `nullptr` is how it reports "not found". The bug is that `main` never checks for it.

## Step 4 — Fix the bug

**This step: change `main` so the program prints all three lines.**

```text
nuts: 80
screws: not found
bolts: 120
```

There's more than one correct fix. The check only looks at what the program does. One way: check the pointer before using it.

```cpp
        if (item == nullptr) {
            std::cout << name << ": not found\n";
            continue;
        }
```

- `continue` skips the rest of this loop iteration and goes on to the next name.

### What to remember

- A crash is not a mystery. Build with `-g`, run under the debugger, and read the stopping line, the variables and the call stack.
- Using a null pointer (`*p` or `p->member`) is **undefined behaviour**. On desktop systems it usually crashes immediately, which is the *lucky* outcome.
- Later you'll meet designs that make this bug impossible to write, such as `std::optional` and references.

```cpp file=inventory.cpp
#include <iostream>
#include <string>
#include <vector>

struct Item {
    std::string name;
    int quantity;
};

// Returns the address of the item with the given name, or nullptr if there is none.
Item* find_item(std::vector<Item>& items, const std::string& name)
{
    for (Item& item : items) {
        if (item.name == name)
            return &item;
    }
    return nullptr;
}

int main()
{
    std::vector<Item> items { {"bolts", 120}, {"nuts", 80}, {"washers", 200} };
    std::vector<std::string> wanted { "nuts", "screws", "bolts" };

    for (const std::string& name : wanted) {
        Item* item = find_item(items, name);
        if (item == nullptr) {
            std::cout << name << ": not found\n";
            continue;
        }
        std::cout << name << ": " << item->quantity << '\n';
    }
    return 0;
}
```

```check
run "g++ -std=c++20 -g -Wall -Wextra -Werror inventory.cpp -o inventory"
run "./inventory" stdout="nuts: 80\nscrews: not found\nbolts: 120" -- The program must not use item->quantity when item is nullptr.
```
