---
title: 5 — Lambdas and Function Objects
track: Generic Programming
runtime: cpp
reference: optional
console: true
---

Many algorithms take a **function as an argument**: `std::count_if` needs to know *which* elements to count, `std::sort` *how* to order. In C++ "a function" here means anything you can call with `()`: a plain function, an object of a class with `operator()`, or a **lambda**.

This lesson looks at what a lambda really is (an object, with members), how it **captures** variables, the bug that capturing by reference invites, and then builds `Signal`: a small event system that stores callbacks and calls them later.

## Step 1 — A function object, and the lambda that writes one

**This step: create `lambdas/basics.cpp`: count the long words with a function object, then with a lambda. Build and run it.**

A **function object** (or functor) is an object you can call, because its class defines `operator()`:

```cpp
struct LongerThan {
    std::size_t limit;
    bool operator()(const std::string& word) const
    {
        return word.size() > limit;
    }
};

LongerThan longer_than_5{5};
longer_than_5("iterator");        // calls operator(): true
```

Unlike a plain function, it carries **data**: `limit`. Pass it to `std::count_if(words.begin(), words.end(), longer_than_5)`, and the algorithm calls it once per word.

A **lambda** is a shorter way to write the same thing:

```cpp
std::size_t limit = 5;
auto is_long = [limit](const std::string& word) {
    return word.size() > limit;
};
```

The compiler turns that into a class much like `LongerThan`, with a member `limit` copied from the local variable, and creates one object of it. `[limit]` is the **capture list**: which local variables the object gets copies of.

Use the words `{"map", "iterator", "lambda", "fn", "template"}` and print `functor: ` then `lambda: `, each followed by the count.

```text
g++ -std=c++20 -Wall -Wextra lambdas/basics.cpp -o lambdas/basics
./lambdas/basics
```

```cpp file=lambdas/basics.cpp
#include <algorithm>
#include <cstddef>
#include <iostream>
#include <string>
#include <vector>

// A function object: a struct with operator(), so you can call it.
struct LongerThan {
    std::size_t limit;

    bool operator()(const std::string& word) const
    {
        return word.size() > limit;
    }
};

int main()
{
    std::vector<std::string> words{"map", "iterator", "lambda", "fn",
                                   "template"};

    LongerThan longer_than_5{5};
    std::cout << "functor: "
              << std::count_if(words.begin(), words.end(), longer_than_5)
              << '\n';

    std::size_t limit = 5;
    auto is_long = [limit](const std::string& word) {
        return word.size() > limit;
    };
    std::cout << "lambda: "
              << std::count_if(words.begin(), words.end(), is_long) << '\n';
}
```

```check
matches lambdas/basics.cpp "operator\s*\(\s*\)\s*\(" label="basics.cpp defines a function object with operator()"
matches lambdas/basics.cpp "\[\s*limit\s*\]" label="a lambda captures limit by value"
run "g++ -std=c++20 -Wall -Wextra lambdas/basics.cpp -o lambdas/basics"
run "./lambdas/basics" stdout="functor: 3\nlambda: 3"
```

## Step 2 — Captures: snapshots, references and mutable

**This step: add the code below to the end of `main`. Predict each line before you run it.**

```cpp
auto is_long_ref = [&limit](const std::string& word) {
    return word.size() > limit;
};
limit = 2;
std::cout << "by value: " << std::count_if(
    words.begin(), words.end(), is_long) << '\n';
std::cout << "by reference: " << std::count_if(
    words.begin(), words.end(), is_long_ref) << '\n';

auto next_id = [n = 0]() mutable { return ++n; };
std::cout << "ids: " << next_id() << ' ';
std::cout << next_id() << ' ';
auto copy = next_id;
std::cout << copy() << ' ';
std::cout << next_id() << '\n';
```

**Predict:** after `limit = 2`, does `is_long` count words longer than 5 or longer than 2? And `is_long_ref`? What four ids are printed?

```cpp file=lambdas/basics.cpp
#include <algorithm>
#include <cstddef>
#include <iostream>
#include <string>
#include <vector>

// A function object: a struct with operator(), so you can call it.
struct LongerThan {
    std::size_t limit;

    bool operator()(const std::string& word) const
    {
        return word.size() > limit;
    }
};

int main()
{
    std::vector<std::string> words{"map", "iterator", "lambda", "fn",
                                   "template"};

    LongerThan longer_than_5{5};
    std::cout << "functor: "
              << std::count_if(words.begin(), words.end(), longer_than_5)
              << '\n';

    std::size_t limit = 5;
    auto is_long = [limit](const std::string& word) {
        return word.size() > limit;
    };
    std::cout << "lambda: "
              << std::count_if(words.begin(), words.end(), is_long) << '\n';

    // Captures by value are a snapshot, taken when the lambda is made.
    auto is_long_ref = [&limit](const std::string& word) {
        return word.size() > limit;
    };
    limit = 2;
    std::cout << "by value: "
              << std::count_if(words.begin(), words.end(), is_long) << '\n';
    std::cout << "by reference: "
              << std::count_if(words.begin(), words.end(), is_long_ref) << '\n';

    // mutable lets the lambda change its own copy of what it captured.
    auto next_id = [n = 0]() mutable { return ++n; };
    std::cout << "ids: " << next_id() << ' ';
    std::cout << next_id() << ' ';
    auto copy = next_id;
    std::cout << copy() << ' ';
    std::cout << next_id() << '\n';
}
```

### What happened

```text
by value: 3
by reference: 4
ids: 1 2 3 3
```

| Capture | The lambda object holds | Sees later changes? |
|---|---|---|
| `[limit]` | a copy, made when the lambda was created | no |
| `[&limit]` | a reference to the variable | yes |
| `[n = 0]` | a new member, initialised to 0 | (it's its own) |
| `[=]`, `[&]` | copies of / references to whatever the body uses | |

- A lambda's `operator()` is `const` by default: it can't change its own copies. **`mutable`** removes that `const`, so `++n` changes the lambda's member, and the count survives between calls.
- `auto copy = next_id;` copies the **whole object**, including `n`, which was 2. From then on there are two independent counters: `copy()` gives 3, and `next_id()` also gives 3.

Prefer explicit captures (`[limit]`, `[&total]`) over `[=]` and `[&]`: the list documents what the lambda depends on.

```check
contains lambdas/basics.cpp "mutable"
run "g++ -std=c++20 -Wall -Wextra lambdas/basics.cpp -o lambdas/basics"
run "./lambdas/basics" stdout="by value: 3\nby reference: 4" label="the value capture is a snapshot; the reference sees limit = 2"
run "./lambdas/basics" stdout="ids: 1 2 3 3" label="a copied lambda carries on from its own copy of n"
```

## Step 3 — A callback that outlives what it captured

**This step: create the supplied `lambdas/dangling.cpp`, read it, build it and run it.**

```text
g++ -std=c++20 -Wall -Wextra lambdas/dangling.cpp -o lambdas/dangling
./lambdas/dangling
```

This is the pattern behind every event system: register a callback **now**, call it **later**. `add_greeter` builds a message and stores a lambda that prints it. `main` calls the callbacks afterwards.

It compiles without a warning. **Predict:** what will it print? Look at where `message` lives, and when it dies.

```cpp file=lambdas/dangling.cpp provided
// Callbacks registered now, run later. It compiles cleanly. Is it right?
#include <functional>
#include <iostream>
#include <string>
#include <vector>

std::vector<std::function<void()>> callbacks;

void add_greeter(const std::string& who)
{
    std::string message = "Hello, " + who + "! Welcome back.";
    callbacks.push_back([&message] { std::cout << message << '\n'; });
}

int main()
{
    add_greeter("Ada");
    add_greeter("Grace");
    for (const auto& callback : callbacks)
        callback();
}
```

### The bug

`[&message]` stores a **reference** to a local variable of `add_greeter`. When `add_greeter` returns, `message` is destroyed. The callbacks run later, and read through dangling references: undefined behaviour, as with a dangling pointer in *Memory, Lifetime and Ownership*. You might see garbage, nothing, the right text, or a crash, and it can change from one build to the next.

AddressSanitizer catches it, if your compiler supports it:

```text
g++ -std=c++20 -g -fsanitize=address lambdas/dangling.cpp -o lambdas/dangling-asan
./lambdas/dangling-asan
ERROR: AddressSanitizer: heap-use-after-free ...
```

The rule: **a lambda that may outlive the current scope must not capture locals by reference.** That includes anything stored in a container, returned, or handed to another thread.

```check
file lambdas/dangling.cpp
run "g++ -std=c++20 -Wall -Wextra lambdas/dangling.cpp -o lambdas/dangling" label="it compiles without a warning"
```

## Step 4 — Fix it: capture by value

**This step: change the capture so each callback owns its own copy of the message. It must print both greetings.**

```cpp
callbacks.push_back([message] { std::cout << message << '\n'; });
```

Now the lambda object has a `std::string` member, a copy of `message`. The local can die; the copy lives as long as the callback.

If the copy is expensive and the local is about to die anyway, **move** it into the lambda with an init-capture:

```cpp
callbacks.push_back([message = std::move(message)] { ... });
```

Expected output:

```text
Hello, Ada! Welcome back.
Hello, Grace! Welcome back.
```

```cpp file=lambdas/dangling.cpp
// Callbacks registered now, run later. Each lambda keeps its own copy.
#include <functional>
#include <iostream>
#include <string>
#include <vector>

std::vector<std::function<void()>> callbacks;

void add_greeter(const std::string& who)
{
    std::string message = "Hello, " + who + "! Welcome back.";
    callbacks.push_back([message] { std::cout << message << '\n'; });
}

int main()
{
    add_greeter("Ada");
    add_greeter("Grace");
    for (const auto& callback : callbacks)
        callback();
}
```

```check
lacks lambdas/dangling.cpp "[&" label="no capture by reference" -- [&] captures by reference too.
run "g++ -std=c++20 -Wall -Wextra lambdas/dangling.cpp -o lambdas/dangling"
run "./lambdas/dangling" stdout="Hello, Ada! Welcome back.\nHello, Grace! Welcome back."
```

## Step 5 — Signal: the specification

**This step: create the supplied `generic/tests/signal_test.cpp` and read it.**

A `Signal` is a list of callbacks ("slots"). `connect` adds one and returns an id; `emit(args...)` calls every slot with those arguments; `disconnect(id)` removes one. GUI toolkits, game engines and plug-in systems are built on this idea.

```cpp
Signal<std::string, int> scored;
auto id = scored.connect([](std::string name, int points) { ... });
scored.emit("Ada", 90);       // calls every connected slot
scored.disconnect(id);
```

Two new things in the tests:

- **`Signal<std::string, int>`, `Signal<int>`, `Signal<>`**: any number of argument types. The class is a **variadic template**, `template <typename... Args>`. `Args` is a *pack* of types; `Args...` expands it wherever a list of types is needed, and `args...` expands a pack of values.
- **Different kinds of slot**: a lambda, a function object (`Doubler`), and a **generic lambda**, `[](auto n) { ... }`, whose `operator()` is itself a template.

A `Signal` must store all of those in one `std::vector`, but each lambda has its own unique type. That's the job of **`std::function<void(Args...)>`**: it can hold *any* callable with a matching call signature.

| | template parameter `F` | `std::function` |
|---|---|---|
| the type | each lambda's own | one type for all |
| can be stored in a vector | only one kind | any mix |
| call cost | inlined | an indirect call |
| when the lambda is big | stored in place | may allocate |

Rule of thumb: an algorithm that calls a function right away takes a template parameter (like `std::count_if`); something that **stores** callables for later uses `std::function`.

```cpp file=generic/tests/signal_test.cpp provided
// Provided by the lesson: what Signal<Args...> must do.
#include "studio_test.hpp"

#include "signal.h"

#include <string>
#include <vector>

TEST(a_new_signal_has_no_slots)
{
    Signal<int> s;
    CHECK_EQ(s.size(), 0u);
    s.emit(1); // nothing to call, and that's fine
}

TEST(emit_calls_a_slot_with_the_arguments)
{
    Signal<std::string, int> s;
    std::string got;
    s.connect([&got](std::string name, int score) {
        got = name + "=" + std::to_string(score);
    });
    s.emit("Ada", 90);
    CHECK_EQ(got, "Ada=90");
}

TEST(slots_run_in_the_order_they_were_connected)
{
    Signal<> s;
    std::vector<int> order;
    s.connect([&order] { order.push_back(1); });
    s.connect([&order] { order.push_back(2); });
    s.connect([&order] { order.push_back(3); });
    s.emit();
    CHECK(order == (std::vector<int>{1, 2, 3}));
}

TEST(connections_get_different_ids)
{
    Signal<> s;
    auto a = s.connect([] {});
    auto b = s.connect([] {});
    CHECK_NE(a, b);
    CHECK_EQ(s.size(), 2u);
}

TEST(a_disconnected_slot_is_not_called)
{
    Signal<int> s;
    int total = 0;
    auto id = s.connect([&total](int n) { total += n; });
    s.emit(5);
    CHECK(s.disconnect(id));
    s.emit(5);
    CHECK_EQ(total, 5);
    CHECK_EQ(s.size(), 0u);
}

namespace {
struct Doubler { // a function object works as a slot too
    int* out;
    void operator()(int n) const { *out = n * 2; }
};
} // namespace

TEST(function_objects_and_generic_lambdas_are_slots)
{
    Signal<int> s;
    int doubled = 0;
    std::string text;
    s.connect(Doubler{&doubled});
    s.connect([&text](auto n) { text = std::to_string(n); });
    s.emit(21);
    CHECK_EQ(doubled, 42);
    CHECK_EQ(text, "21");
}
```

```check
file generic/tests/signal_test.cpp
```

## Step 6 — Write Signal

**This step: create `generic/signal.h` with the class template `Signal<Args...>`, and make the tests pass.**

```cpp
template <typename... Args>
class Signal {
public:
    using Slot = std::function<void(Args...)>;
    using Id = std::size_t;

    Id connect(Slot slot);
    bool disconnect(Id id);        // false if there was no such slot
    void emit(Args... args) const;
    std::size_t size() const;

private:
    struct Entry {
        Id id;
        Slot slot;
    };
    std::vector<Entry> slots_;
    Id next_id_ = 1;
};
```

- `connect` stores `Entry{next_id_, std::move(slot)}` and returns `next_id_++`: ids are never reused, even after a disconnect.
- `disconnect` finds the entry with `std::find_if` and a lambda that captures `id`, then erases it.
- `emit` calls `entry.slot(args...)` for each entry, in order. `args...` passes every argument on.

Passing a lambda to `connect(Slot slot)` converts it to a `std::function`, which takes a **copy** of the lambda object. A `mutable` lambda's state then lives inside the `Signal`.

```cpp file=generic/signal.h
#pragma once

#include <algorithm>
#include <cstddef>
#include <functional>
#include <utility>
#include <vector>

// A Signal calls every connected function ("slot") when it's emitted.
// Signal<int> passes an int to each slot; Signal<> passes nothing.
template <typename... Args>
class Signal {
public:
    using Slot = std::function<void(Args...)>;
    using Id = std::size_t;

    Id connect(Slot slot)
    {
        slots_.push_back(Entry{next_id_, std::move(slot)});
        return next_id_++;
    }

    bool disconnect(Id id)
    {
        auto found =
            std::find_if(slots_.begin(), slots_.end(),
                         [id](const Entry& entry) { return entry.id == id; });
        if (found == slots_.end())
            return false;
        slots_.erase(found);
        return true;
    }

    void emit(Args... args) const
    {
        for (const Entry& entry : slots_)
            entry.slot(args...);
    }

    std::size_t size() const { return slots_.size(); }

private:
    struct Entry {
        Id id;
        Slot slot;
    };

    std::vector<Entry> slots_;
    Id next_id_ = 1;
};
```

```check
matches generic/signal.h "template\s*<\s*typename\s*\.\.\.\s*Args\s*>" label="Signal is a variadic template"
contains generic/signal.h "std::function"
run "cmake --build generic/build"
tests "./generic/build/generic_tests" require="slots_run_in_the_order_they_were_connected a_disconnected_slot_is_not_called function_objects_and_generic_lambdas_are_slots"
```

## Step 7 — Your own tests

**This step: create `generic/tests/signal_own_test.cpp` with at least three tests of `Signal`.**

Ideas:

- A `mutable` lambda that counts its own calls keeps counting across several `emit`s (capture a vector by reference to see the counts).
- Disconnecting one slot leaves the others connected.
- `disconnect` of an id that was never returned gives `false`.

Capturing by reference in tests is fine: the variables live until the end of the test, longer than the `Signal`.

```cpp file=generic/tests/signal_own_test.cpp
// My tests for Signal.
#include "studio_test.hpp"

#include "signal.h"

#include <vector>

TEST(a_mutable_slot_keeps_its_own_state)
{
    Signal<> s;
    std::vector<int> seen;
    s.connect([&seen, n = 0]() mutable { seen.push_back(++n); });
    s.emit();
    s.emit();
    s.emit();
    CHECK(seen == (std::vector<int>{1, 2, 3}));
}

TEST(disconnect_only_removes_that_slot)
{
    Signal<int> s;
    int a = 0;
    int b = 0;
    auto first = s.connect([&a](int n) { a += n; });
    s.connect([&b](int n) { b += n; });
    s.disconnect(first);
    s.emit(3);
    CHECK_EQ(a, 0);
    CHECK_EQ(b, 3);
}

TEST(disconnecting_an_unknown_id_returns_false)
{
    Signal<> s;
    CHECK(!s.disconnect(12345));
}
```

```check
matches generic/tests/signal_own_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="signal_own_test.cpp has at least three tests"
run "cmake --build generic/build"
tests "./generic/build/generic_tests"
```

## Step 8 — The reviewer's tests

**This step: create the supplied `generic/tests/signal_review_test.cpp`, run the tests, and fix `signal.h` if any fail.**

Look at `review_ids_are_never_reused`. An id that comes back after a disconnect is a classic event-system bug: some old code still holding the first id would disconnect someone else's slot.

```cpp file=generic/tests/signal_review_test.cpp provided
// The reviewer's tests for Signal. Do not edit them: make them pass.
#include "studio_test.hpp"

#include "signal.h"

#include <string>
#include <vector>

TEST(review_disconnecting_twice_returns_false)
{
    Signal<> s;
    auto id = s.connect([] {});
    CHECK(s.disconnect(id));
    CHECK(!s.disconnect(id));
}

TEST(review_ids_are_never_reused)
{
    Signal<> s;
    int calls = 0;
    auto first = s.connect([] {});
    s.disconnect(first);
    auto second = s.connect([&calls] { ++calls; });
    CHECK_NE(first, second);
    CHECK(!s.disconnect(first)); // first is gone: second must survive
    s.emit();
    CHECK_EQ(calls, 1);
}

TEST(review_every_slot_sees_the_same_arguments)
{
    Signal<const std::string&> s;
    std::vector<std::string> log;
    s.connect([&log](const std::string& m) { log.push_back("a:" + m); });
    s.connect([&log](const std::string& m) { log.push_back("b:" + m); });
    s.emit("click");
    CHECK(log == (std::vector<std::string>{"a:click", "b:click"}));
}

TEST(review_a_slot_can_be_any_callable)
{
    Signal<int> s;
    std::function<void(int)> stored = [](int) {};
    s.connect(stored);
    s.connect([](int) {});
    CHECK_EQ(s.size(), 2u);
}
```

```check
file generic/tests/signal_review_test.cpp
run "cmake --build generic/build"
tests "./generic/build/generic_tests" require="review_ids_are_never_reused review_every_slot_sees_the_same_arguments" -- Keep a counter for ids; don't derive them from the number of slots.
```
