---
title: 6 — Atomics and the Memory Model
track: Systems Programming
runtime: cpp
reference: optional
console: true
---

A mutex makes any amount of code safe to run from several threads. For one variable, that's a heavy tool: the processor can update a single value safely by itself, with an **atomic** instruction, and C++ gives you those through `std::atomic<T>`.

Atomics also lead to the deepest question in this track: when one thread writes to memory, *when* does another thread see it? The answer is the C++ **memory model**, and it's why a mutex works at all.

## Step 1 — An atomic counter

**This step: make `counter` in `threads/race.cpp` a `std::atomic<int>`, and remove the mutex.**

```cpp
std::atomic<int> counter = 0;   // shared, and safe to share
// ...
counter.fetch_add(1);           // one indivisible step
```

`fetch_add` is a single **read-modify-write**: no other thread can come between its read and its write. On x86 it's one instruction, `lock xadd`. `++counter` on an atomic does the same thing.

**Predict:** is this also safe?

```cpp
counter = counter + 1;
```

It isn't. It's an atomic **load**, then an atomic **store**: each is safe on its own, but another thread can come between them, exactly as in lesson 4. Every individual operation on an atomic is indivisible; a sequence of them isn't.

Time the three versions of `race`: the atomic one is several times faster than the mutex, but still slower than one thread. Every core must take turns owning the cache line that holds `counter`. An atomic is cheap; a *shared* atomic that every thread writes isn't.

```cpp file=threads/race.cpp
// race: four threads add 1 to the same atomic counter.
#include <atomic>
#include <iostream>
#include <thread>
#include <vector>

int main()
{
    const int workers = 4;
    const int per_thread = 1'000'000;
    std::atomic<int> counter = 0;   // shared, and safe to share

    {
        std::vector<std::jthread> threads;
        for (int w = 0; w < workers; ++w) {
            threads.emplace_back([&counter] {
                for (int i = 0; i < per_thread; ++i)
                    counter.fetch_add(1);   // one indivisible step
            });
        }
    }   // joined

    std::cout << "expected " << workers * per_thread
              << ", got " << counter << '\n';
}
```

```check
contains threads/race.cpp "std::atomic<int>"
lacks threads/race.cpp "mutex" label="the mutex is gone"
lacks threads/race.cpp "counter = counter + 1" label="no separate load and store" -- counter = counter + 1 is a load, then a store: another thread can come between them.
run "cmake --build threads/build"
run "./threads/build/race" stdout="expected 4000000, got 4000000"
```

## Step 2 — Publishing data: acquire and release

**This step: write `threads/publish.cpp`. One thread prepares a message, then raises a flag; another waits for the flag, then prints the message.**

```cpp
std::string message;              // plain data: not atomic
int answer = 0;
std::atomic<bool> ready = false;  // the flag that publishes them

// writer thread
message = "hello from the writer";
answer = 42;
ready.store(true, std::memory_order_release);   // publish

// reader thread
while (!ready.load(std::memory_order_acquire))   // wait for it
    std::this_thread::yield();
std::cout << message << ", answer " << answer << '\n';
```

`message` and `answer` aren't atomic. Why is reading them safe? Compilers and processors **reorder** memory operations when a single thread can't tell the difference. Without a rule, the reader could see `ready == true` and still read the old `message`. The rule is a pair:

| On | Order | Guarantees |
|---|---|---|
| the writer's store | `release` | no write before it moves after it |
| the reader's load | `acquire` | no read after it moves before it |

When an acquire load reads the value of a release store, everything the writer did **before** the store **happens before** everything the reader does **after** the load. That's how a flag *publishes* ordinary data. Locking a mutex is an acquire, and unlocking it is a release: that's why data written inside a critical section is visible to the next thread that locks.

- With no order argument, atomics use `memory_order_seq_cst`, which is at least as strong. Use the default unless you've measured a reason not to.
- `memory_order_relaxed` guarantees only that the one variable is updated atomically. It's right for a counter nobody reads until the threads are joined, and wrong here.
- A program with a missing acquire usually still *works* on x86, which reorders very little, then fails on ARM: phones, and Apple's M-series Macs.

### Why not `volatile`?

Older code (and some other languages) uses `volatile bool ready` for this. In C++, `volatile` means "every access must really happen", which is for memory-mapped hardware registers. It makes no operation atomic and orders nothing between threads, so a `volatile` flag is still a data race. For threads, use `std::atomic`.

```text
g++ -std=c++20 -Wall -Wextra -pthread threads/publish.cpp
    -o threads/publish
./threads/publish
```

```cpp file=threads/publish.cpp
// publish: one thread prepares data, then raises a flag; another waits
// for the flag, then reads the data.
#include <atomic>
#include <iostream>
#include <string>
#include <thread>

std::string message;              // plain data: not atomic
int answer = 0;
std::atomic<bool> ready = false;  // the flag that publishes them

int main()
{
    std::jthread writer([] {
        message = "hello from the writer";
        answer = 42;
        ready.store(true, std::memory_order_release);   // publish
    });

    std::jthread reader([] {
        while (!ready.load(std::memory_order_acquire))   // wait for it
            std::this_thread::yield();
        // Everything the writer did before its release store is
        // visible here, after the acquire load that saw true.
        std::cout << message << ", answer " << answer << '\n';
    });
}
```

```check
contains threads/publish.cpp "memory_order_release"
contains threads/publish.cpp "memory_order_acquire"
run "g++ -std=c++20 -Wall -Wextra -pthread threads/publish.cpp -o threads/publish"
run "./threads/publish" stdout="hello from the writer, answer 42"
```

## Step 3 — Compare and exchange: the specification

**This step: create the supplied `threads/tests/atomic_max_test.cpp` and read it.**

`fetch_add` covers adding. What about "raise the maximum to `value`, if `value` is larger"? There's no `fetch_max` in C++20. You need the building block of every lock-free algorithm, **compare-and-exchange** (CAS):

```cpp
bool current.compare_exchange_weak(int& expected, int desired);
```

As one indivisible step: *if* `current` still holds `expected`, store `desired` and return `true`. Otherwise, copy what it holds now into `expected`, and return `false`.

So you read the value, compute the new value from it, and store it **only if nobody changed it in the meantime**. If somebody did, you've just been given the new value: compute again and retry.

`atomic_max.h` will provide `bool update_max(std::atomic<int>& current, int value)`: raise `current` to `value` if `value` is larger, returning `true` if this call changed it.

Look at how the tests with four threads stay deterministic: the final maximum is the same whatever the order, and "each raise is won by exactly one thread" gives bounds that hold for every order.

```cpp file=threads/tests/atomic_max_test.cpp provided
#include "studio_test.hpp"

#include "atomic_max.h"

#include <atomic>
#include <thread>
#include <vector>

TEST(update_max_raises_a_smaller_value)
{
    std::atomic<int> m = 3;
    CHECK(update_max(m, 10));
    CHECK_EQ(m.load(), 10);
}

TEST(update_max_keeps_a_larger_value)
{
    std::atomic<int> m = 10;
    CHECK(!update_max(m, 3));
    CHECK(!update_max(m, 10));   // equal is not larger
    CHECK_EQ(m.load(), 10);
}

// Four threads each offer 100000 different values. Whatever the
// interleaving, the result must be the largest value offered.
TEST(update_max_from_four_threads_finds_the_largest)
{
    std::atomic<int> m = 0;
    {
        std::vector<std::jthread> threads;
        for (int t = 0; t < 4; ++t) {
            threads.emplace_back([&m, t] {
                for (int i = 0; i < 100'000; ++i)
                    update_max(m, i * 4 + t);   // t = 3 offers 399999
            });
        }
    }
    CHECK_EQ(m.load(), 399'999);
}

// Exactly one thread can win each raise, so counting wins from many
// threads offering the same values gives an exact answer.
TEST(each_raise_is_won_by_exactly_one_thread)
{
    std::atomic<int> m = 0;
    std::atomic<int> wins = 0;
    {
        std::vector<std::jthread> threads;
        for (int t = 0; t < 4; ++t) {
            threads.emplace_back([&] {
                for (int v = 1; v <= 50'000; ++v)
                    if (update_max(m, v))
                        ++wins;
            });
        }
    }
    CHECK_EQ(m.load(), 50'000);
    CHECK(wins.load() >= 1);
    CHECK(wins.load() <= 50'000);   // never more than one win per value
}
```

```check
file threads/tests/atomic_max_test.cpp
```

## Step 4 — Write update_max

**This step: create `threads/atomic_max.h` with `update_max`, using a compare-and-exchange loop.**

```cpp
inline bool update_max(std::atomic<int>& current, int value)
{
    int seen = current.load();
    while (seen < value) {
        if (current.compare_exchange_weak(seen, value))
            return true;
        // failed: seen now holds the newer value; check again
    }
    return false;   // current was already at least value
}
```

- The loop ends either way: this thread stored `value`, or `current` became at least as large.
- `_weak` may fail even when the values match (on some processors), so it must be in a loop. In a loop it's the faster choice. `compare_exchange_strong` never fails spuriously, for code without a loop.
- Equal isn't larger: `update_max(m, 10)` when `m` is 10 changes nothing and returns `false`.

This is **lock-free**: no thread ever waits for another to release something, and if one thread is paused in the middle, the others carry on.

```cpp file=threads/atomic_max.h
// atomic_max.h: lock-free updates built on compare_exchange.
#pragma once

#include <atomic>

// Raises current to value if value is larger, even while other threads
// do the same. Returns true if this call changed it.
inline bool update_max(std::atomic<int>& current, int value)
{
    int seen = current.load();
    while (seen < value) {
        // If current still holds seen, store value and return true.
        // If not, another thread got there first: seen is reloaded with
        // what current holds now, and the loop checks again.
        if (current.compare_exchange_weak(seen, value))
            return true;
    }
    return false;   // current was already at least value
}
```

```check
contains threads/atomic_max.h "compare_exchange"
run "cmake --build threads/build"
tests "./threads/build/threads_tests" require="update_max_raises_a_smaller_value update_max_keeps_a_larger_value update_max_from_four_threads_finds_the_largest each_raise_is_won_by_exactly_one_thread" timeout=60
```

## Step 5 — A spin lock: the specification

**This step: create the supplied `threads/tests/spin_lock_test.cpp` and read it.**

A **spin lock** is a mutex that waits by looping instead of sleeping. Building one shows what a mutex must do. Here's a first attempt:

```cpp
void lock()
{
    while (locked_)        // wait until it's free...
        ;
    locked_ = true;        // ...then take it
}
```

**Predict:** `locked_` is a `std::atomic<bool>`. Can two threads both get past `lock()`?

### Check, then act

Yes. Both threads can read `false`, both leave the loop, and both store `true`. Checking and taking must be **one** atomic step: the same problem as `counter = counter + 1`, and the same cure, a read-modify-write.

`SpinLock` will have `lock()`, `try_lock()` (take it if it's free, without waiting) and `unlock()`. Those are the names the standard library looks for, so `std::scoped_lock` works with your lock as it does with `std::mutex`.

```cpp file=threads/tests/spin_lock_test.cpp provided
#include "studio_test.hpp"

#include "spin_lock.h"

#include <mutex>
#include <thread>
#include <vector>

TEST(try_lock_fails_while_it_is_held)
{
    SpinLock s;
    CHECK(s.try_lock());
    CHECK(!s.try_lock());
    s.unlock();
    CHECK(s.try_lock());
    s.unlock();
}

TEST(it_works_with_scoped_lock)
{
    SpinLock s;
    {
        std::scoped_lock lock(s);   // needs lock() and unlock()
        CHECK(!s.try_lock());
    }
    CHECK(s.try_lock());
    s.unlock();
}

// The race from lesson 4, protected by a SpinLock: the total is exact.
TEST(it_protects_a_shared_counter)
{
    SpinLock s;
    long long counter = 0;
    {
        std::vector<std::jthread> threads;
        for (int t = 0; t < 4; ++t) {
            threads.emplace_back([&] {
                for (int i = 0; i < 100'000; ++i) {
                    std::scoped_lock lock(s);
                    ++counter;
                }
            });
        }
    }
    CHECK_EQ(counter, 400'000);
}
```

```check
file threads/tests/spin_lock_test.cpp
```

## Step 6 — Exercise: write SpinLock

**This step: no code is given. Create `threads/spin_lock.h` with the class `SpinLock`, and make its tests pass.**

Requirements:

- One member, `std::atomic<bool> locked_`.
- Taking the lock is one read-modify-write: `locked_.exchange(true)` stores `true` and returns the **old** value. Old `false` means you took it; old `true` means someone else holds it.
- `lock()` takes it with `memory_order_acquire`, and `unlock()` stores `false` with `memory_order_release`: the pair from step 2. Whatever one thread did inside the lock is visible to the next thread that takes it.
- While it's held, wait with a plain `load` in an inner loop, calling `std::this_thread::yield()`, and only try `exchange` again when it looks free. An `exchange` is a write: many threads hammering one with writes fight over the cache line even while nobody can win.

### Should you use it?

Almost never. A thread spinning on a lock whose holder has been paused by the operating system burns its whole time slice doing nothing. `std::mutex` already spins briefly before it sleeps, and is hard to beat. Spin locks belong in places that can't sleep, such as an operating system kernel, and in very short critical sections, after measuring. You've built one to see that a lock is just an atomic flag plus the acquire and release orderings.

```cpp file=threads/spin_lock.h
// spin_lock.h: a lock that waits by spinning instead of sleeping.
// For learning. In real code use std::mutex: it spins briefly, then
// sleeps, and it's what you should measure against.
#pragma once

#include <atomic>
#include <thread>

class SpinLock {
public:
    void lock()
    {
        // exchange returns the old value: true means someone else holds it.
        while (locked_.exchange(true, std::memory_order_acquire)) {
            // Spin on a plain load until it looks free, so the waiting
            // threads only read the cache line instead of writing it.
            while (locked_.load(std::memory_order_relaxed))
                std::this_thread::yield();
        }
    }

    bool try_lock()
    {
        return !locked_.exchange(true, std::memory_order_acquire);
    }

    void unlock()
    {
        locked_.store(false, std::memory_order_release);
    }

private:
    std::atomic<bool> locked_ = false;
};
```

```check
matches threads/spin_lock.h "(exchange|test_and_set)\s*\(" label="taking the lock is one read-modify-write"
contains threads/spin_lock.h "memory_order_release"
run "cmake --build threads/build"
tests "./threads/build/threads_tests" require="try_lock_fails_while_it_is_held it_works_with_scoped_lock it_protects_a_shared_counter" timeout=60
```
