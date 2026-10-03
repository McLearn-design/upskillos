---
title: 4 — Threads, Data Races and Mutexes
track: Systems Programming
runtime: cpp
reference: optional
console: true
---

A **thread** is a path of execution inside a process. A process starts with one, running `main`, and can start more. Each thread has its own stack (its own local variables and function calls), and they all share everything else: globals, the heap, open files.

```text
one process: one memory, shared by all its threads
┌───────────────────────────────────────────────┐
│  globals and the heap: every thread sees them  │
│                                               │
│   thread 1       thread 2       thread 3      │
│   [its stack]    [its stack]    [its stack]   │
└───────────────────────────────────────────────┘
```

Threads are how one program uses several CPU cores at once, and how it keeps responding while one part waits. Sharing memory is what makes them fast to start and to talk to each other, compared with processes. It's also what makes them dangerous: two threads changing the same variable at the same time is the source of some of the hardest bugs in programming. This lesson makes one on purpose, then fixes it.

The project folder is `threads/`.

## Step 1 — Four threads, one sum

**This step: write `threads/split_sum.cpp`, which adds up 1 to 100,000,000 by giving a quarter of the range to each of four threads.**

```cpp
std::vector<std::thread> threads;
for (int w = 0; w < workers; ++w) {
    const long long first = n * w / workers + 1;
    const long long last = n * (w + 1) / workers + 1;
    threads.emplace_back([&partial, w, first, last] {
        partial[w] = sum_range(first, last);   // runs on the new thread
    });
}
for (std::thread& t : threads)
    t.join();   // wait for each thread to finish
```

- Constructing a `std::thread` with a function (here a lambda) **starts** a new thread running it, at once. The constructor returns while the new thread is still working.
- `t.join()` waits until thread `t` has finished. After the joins, all four results are ready.
- Each thread writes **only its own** element, `partial[w]`. No two threads touch the same variable, so they need no coordination. Splitting the work so that threads share nothing is the best design whenever it's possible.
- The lambda captures `w`, `first` and `last` **by value**: each thread gets its own copy. Capturing `w` by reference would give every thread the *same* `w`, which the loop keeps changing while the threads read it.

Add up `partial` at the end, and print `total: 5000000050000000` and `std::thread::hardware_concurrency()`, the number of threads the machine can run at once.

```text
g++ -std=c++20 -Wall -Wextra -pthread threads/split_sum.cpp
    -o threads/split_sum
./threads/split_sum
```

`-pthread` links the system's thread library. On Linux with an older C library, a program that uses `std::thread` without it fails when the first thread starts. On macOS and Windows it's harmless. CMake does this for you, as you'll see in step 3.

```cpp file=threads/split_sum.cpp
// split_sum: adds 1 + 2 + ... + n on four threads at once.
#include <iostream>
#include <thread>
#include <vector>

// first + (first + 1) + ... + (last - 1)
long long sum_range(long long first, long long last)
{
    long long total = 0;
    for (long long i = first; i < last; ++i)
        total += i;
    return total;
}

int main()
{
    const long long n = 100'000'000;
    const int workers = 4;
    std::vector<long long> partial(workers, 0);   // one slot per thread

    std::vector<std::thread> threads;
    for (int w = 0; w < workers; ++w) {
        const long long first = n * w / workers + 1;
        const long long last = n * (w + 1) / workers + 1;
        threads.emplace_back([&partial, w, first, last] {
            partial[w] = sum_range(first, last);   // runs on the new thread
        });
    }
    for (std::thread& t : threads)
        t.join();   // wait for each thread to finish

    long long total = 0;
    for (long long p : partial)
        total += p;
    std::cout << "total: " << total << '\n';
    std::cout << "this machine runs " << std::thread::hardware_concurrency()
              << " threads at once\n";
}
```

```check
run "g++ -std=c++20 -Wall -Wextra -pthread threads/split_sum.cpp -o threads/split_sum"
run "./threads/split_sum" stdout="total: 5000000050000000"
```

## Step 2 — Forgetting join, and std::jthread

**This step: delete the `join` loop, build and run once, then switch to `std::jthread`.**

**Predict:** without the `join`s, what happens when `threads` is destroyed at the end of `main`?

### What happens

```text
terminate called without an active exception
Aborted
```

A `std::thread` that is still **joinable** (started, and not yet joined) calls `std::terminate` from its destructor, which ends the program. The destructor can't know what you wanted: waiting might hang forever, and letting the thread run on might leave it using variables that are being destroyed. So it refuses to guess.

C++20 adds **`std::jthread`** ("joining thread"), whose destructor joins. It's RAII for threads, like `std::unique_ptr` for memory and `std::ofstream` for files:

```cpp
{
    std::vector<std::jthread> threads;
    for (int w = 0; w < workers; ++w) {
        // ... emplace_back as before
    }
}   // each jthread's destructor joins it
```

Put the vector in its own block, and read `partial` only after the block: by then every thread has finished. A `jthread` can also be asked to stop (through a `std::stop_token`), which a `std::thread` can't.

Use `std::jthread` from now on, unless you need to choose the moment of the join yourself.

```cpp file=threads/split_sum.cpp
// split_sum: adds 1 + 2 + ... + n on four threads at once.
#include <iostream>
#include <thread>
#include <vector>

// first + (first + 1) + ... + (last - 1)
long long sum_range(long long first, long long last)
{
    long long total = 0;
    for (long long i = first; i < last; ++i)
        total += i;
    return total;
}

int main()
{
    const long long n = 100'000'000;
    const int workers = 4;
    std::vector<long long> partial(workers, 0);   // one slot per thread

    {
        std::vector<std::jthread> threads;
        for (int w = 0; w < workers; ++w) {
            const long long first = n * w / workers + 1;
            const long long last = n * (w + 1) / workers + 1;
            threads.emplace_back([&partial, w, first, last] {
                partial[w] = sum_range(first, last);
            });
        }
    }   // each jthread's destructor joins it

    long long total = 0;
    for (long long p : partial)
        total += p;
    std::cout << "total: " << total << '\n';
    std::cout << "this machine runs " << std::thread::hardware_concurrency()
              << " threads at once\n";
}
```

```check
contains threads/split_sum.cpp "std::jthread"
lacks threads/split_sum.cpp ".join()" label="no join() calls left"
run "g++ -std=c++20 -Wall -Wextra -pthread threads/split_sum.cpp -o threads/split_sum"
run "./threads/split_sum" stdout="total: 5000000050000000" -- Read partial only after the block holding the jthreads has ended.
```

## Step 3 — The project's build file

**This step: create the supplied `threads/CMakeLists.txt` and read it.**

```cmake
find_package(Threads REQUIRED)
target_link_libraries(race PRIVATE Threads::Threads)
```

`find_package(Threads)` finds the system's thread library, and `Threads::Threads` adds whatever each system needs to use it: `-pthread` on Linux, nothing elsewhere. Every target that starts threads links it. The test program does too: lessons 5 and 6 test thread-safe code.

The test program is built from every `tests/*_test.cpp` file. There are none yet, so for now it runs zero tests.

```cmake file=threads/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(threads LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# Finds the system's thread library: on Linux this adds -pthread.
find_package(Threads REQUIRED)

add_executable(race race.cpp)
target_link_libraries(race PRIVATE Threads::Threads)

# The test program: the shared runner plus every tests/*_test.cpp file.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(threads_tests ../testing/test_main.cpp ${TEST_SOURCES})
target_include_directories(threads_tests PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)
target_link_libraries(threads_tests PRIVATE Threads::Threads)
```

```check
file threads/CMakeLists.txt
```

## Step 4 — A data race

**This step: create the supplied `threads/race.cpp`, read it, then configure, build and run it a few times.**

Four threads each add 1 to the same `int`, a million times.

```text
cmake -S threads -B threads/build -G "MinGW Makefiles"     (Windows)
cmake -S threads -B threads/build                          (macOS, Linux)
```

```text
cmake --build threads/build
./threads/build/race
```

**Predict:** what will it print? The same every time?

```cpp file=threads/race.cpp provided
// race: four threads add 1 to the same counter, a million times each.
#include <iostream>
#include <thread>
#include <vector>

int main()
{
    const int workers = 4;
    const int per_thread = 1'000'000;
    int counter = 0;   // shared by every thread

    {
        std::vector<std::jthread> threads;
        for (int w = 0; w < workers; ++w) {
            threads.emplace_back([&counter] {
                for (int i = 0; i < per_thread; ++i)
                    ++counter;   // read, add 1, write back
            });
        }
    }   // joined

    std::cout << "expected " << workers * per_thread
              << ", got " << counter << '\n';
}
```

### What happened

Something like `expected 4000000, got 1481035`, and a different number each run. `++counter` looks like one step, but the processor does three:

```text
load counter into a register   →  add 1  →  store the register back
```

When two threads interleave those steps, one thread's work is lost:

| thread A | thread B | counter |
|---|---|---|
| load (0) | | 0 |
| | load (0) | 0 |
| add → 1 | add → 1 | 0 |
| store 1 | | 1 |
| | store 1 | **1**, not 2 |

Two threads accessing the same variable at the same time, at least one of them writing, without synchronisation, is a **data race**. In C++ a data race is **undefined behaviour**, not just a wrong number: the compiler may assume it never happens, and optimise accordingly. With optimisations on, the loop may even be turned into a single `counter += 1000000`, which hides the bug until a different compiler shows it.

On a machine with one core, or by luck, the total can come out right. A test that passes proves nothing about a data race. That's why the checks in this track only ever check a result that is **certain**.

### Seeing races: ThreadSanitizer

ThreadSanitizer is to data races what AddressSanitizer is to memory errors. It reports the two accesses and where each thread was:

```text
g++ -std=c++20 -g -fsanitize=thread -pthread threads/race.cpp
    -o threads/race-tsan
./threads/race-tsan
```

```text
WARNING: ThreadSanitizer: data race
  Write of size 4 by thread T2:
    #0 operator() race.cpp:18
  Previous write of size 4 by thread T1:
    #0 operator() race.cpp:18
```

It works with GCC and Clang on Linux, and Apple's Clang on macOS. Not on Windows. It's a learning and testing tool: no check here depends on it.

```check
file threads/build/CMakeCache.txt label="threads/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build threads/build"
run "./threads/build/race" stdout="expected 4000000, got" label="race runs and prints a total"
```

## Step 5 — Fix it: a mutex

**This step: protect `counter` with a `std::mutex`, so the program always prints `expected 4000000, got 4000000`.**

A **mutex** (mutual exclusion) is a lock that only one thread can hold at a time. A thread that tries to lock it while another holds it **waits** until it's unlocked. Code that runs while holding the lock is a **critical section**: only one thread is ever inside it.

```cpp
std::mutex counter_mutex;
// ...
for (int i = 0; i < per_thread; ++i) {
    std::scoped_lock lock(counter_mutex);   // waits its turn
    ++counter;
}   // ~scoped_lock unlocks
```

- Never call `lock()` and `unlock()` yourself: an exception or an early `return` between them leaves the mutex locked forever. `std::scoped_lock` locks in its constructor and unlocks in its destructor. (`std::lock_guard` is the older version for one mutex.)
- The mutex doesn't protect anything by itself. It works only because **every** access to `counter` takes it. Declare each mutex next to the data it guards, and say so in a comment.
- Locking also makes the writes of the thread that unlocks visible to the thread that locks next. Lesson 6 is about that guarantee.

Time it, and you'll find it's much *slower* than one thread doing all 4,000,000 additions: the threads spend their time waiting for each other. A mutex makes shared data safe; it doesn't make it fast. `split_sum`'s design, where each thread works on its own data and the results are combined once at the end, is the fast one.

```cpp file=threads/race.cpp
// race: four threads add 1 to the same counter, one at a time.
#include <iostream>
#include <mutex>
#include <thread>
#include <vector>

int main()
{
    const int workers = 4;
    const int per_thread = 1'000'000;
    int counter = 0;          // shared by every thread...
    std::mutex counter_mutex; // ...and only touched while this is locked

    {
        std::vector<std::jthread> threads;
        for (int w = 0; w < workers; ++w) {
            threads.emplace_back([&counter, &counter_mutex] {
                for (int i = 0; i < per_thread; ++i) {
                    std::scoped_lock lock(counter_mutex);   // waits its turn
                    ++counter;
                }   // ~scoped_lock unlocks
            });
        }
    }   // joined

    std::cout << "expected " << workers * per_thread
              << ", got " << counter << '\n';
}
```

```check
matches threads/race.cpp "std::(scoped_lock|lock_guard|unique_lock)" label="race.cpp locks the mutex with a lock object"
run "cmake --build threads/build"
run "./threads/build/race" stdout="expected 4000000, got 4000000" -- Lock the mutex around every ++counter, in every thread.
```

## Step 6 — Deadlock

**This step: create the supplied `threads/deadlock.cpp`, build it and run it. Stop it with Ctrl+C.**

```text
g++ -std=c++20 -Wall -Wextra -pthread threads/deadlock.cpp
    -o threads/deadlock
./threads/deadlock
```

Each account has its own mutex. A transfer locks the account it takes money from, then the one it gives money to. Two threads transfer money between the same two accounts, in opposite directions. (The `sleep_for` between the two locks makes the problem happen every time instead of once in a while.)

**Predict:** what does it print?

```cpp file=threads/deadlock.cpp provided
// deadlock: two threads transfer money between the same two accounts,
// in opposite directions.
#include <chrono>
#include <iostream>
#include <mutex>
#include <thread>

struct Account {
    std::mutex m;
    int balance = 100;
};

void transfer(Account& from, Account& to, int amount)
{
    std::scoped_lock lock_from(from.m);
    // Pause, to make the problem show up every time instead of sometimes.
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    std::scoped_lock lock_to(to.m);
    from.balance -= amount;
    to.balance += amount;
}

int main()
{
    Account alice, bob;
    {
        std::jthread t1([&] { transfer(alice, bob, 10); });
        std::jthread t2([&] { transfer(bob, alice, 20); });
    }
    std::cout << "alice " << alice.balance << ", bob " << bob.balance << '\n';
}
```

### What happened

Nothing. It never finishes:

| thread 1: alice → bob | thread 2: bob → alice |
|---|---|
| locks alice | locks bob |
| waits for bob… | waits for alice… |

Each thread holds one lock and waits for the other's. Neither will ever let go. That's a **deadlock**. It needs four things at once: locks held while waiting for more locks, in a cycle, with no way to take a lock away. Break any one and it can't happen.

The usual fixes break the cycle:

- **Lock ordering.** Always take locks in one global order: by account number, say. Then both threads lock alice first, and one simply waits for the other.
- **Lock both at once.** `std::scoped_lock lock(from.m, to.m);` with *several* mutexes uses a deadlock-avoidance algorithm: it locks one, *tries* the others, and if one is busy, releases everything and tries again in a different order.

Without the `sleep_for`, this program would finish correctly almost every time, and hang once in a thousand runs, on a customer's machine. Concurrency bugs depend on timing, which is why you have to reason about them, not just test them.

```check
file threads/deadlock.cpp
run "g++ -std=c++20 -Wall -Wextra -pthread threads/deadlock.cpp -o threads/deadlock" label="deadlock.cpp builds"
```

## Step 7 — The specification: thread-safe accounts

**This step: create the supplied `threads/tests/bank_test.cpp` and read it.**

`threads/bank.h` will hold an `Account` with a balance, and a `transfer` that's safe to call from any number of threads:

| | Does |
|---|---|
| `Account(balance)` | an account with a starting balance |
| `balance()` | the balance now; safe to call while others transfer |
| `transfer(from, to, amount)` | all or nothing: throws `std::runtime_error` if `from` has less than `amount`, and changes neither account |
| `transfer(a, a, amount)` | throws `std::invalid_argument` |

The last test is lesson 4's problem: two threads moving money in opposite directions, 100,000 times each. Look at what it checks: only the **final balances**, which are the same whatever order the transfers happened in. With a lock-ordering bug, this test never finishes.

```cpp file=threads/tests/bank_test.cpp provided
#include "studio_test.hpp"

#include "bank.h"

#include <stdexcept>
#include <thread>

TEST(a_transfer_moves_money)
{
    Account a(100), b(50);
    transfer(a, b, 30);
    CHECK_EQ(a.balance(), 70);
    CHECK_EQ(b.balance(), 80);
}

TEST(a_transfer_without_enough_money_throws_and_changes_nothing)
{
    Account a(10), b(0);
    CHECK_THROWS(transfer(a, b, 11), std::runtime_error);
    CHECK_EQ(a.balance(), 10);
    CHECK_EQ(b.balance(), 0);
}

TEST(a_transfer_to_the_same_account_is_rejected)
{
    Account a(10);
    CHECK_THROWS(transfer(a, a, 1), std::invalid_argument);
}

// Two threads move money back and forth between the same two accounts.
// With a lock-ordering bug this test never finishes.
TEST(opposite_transfers_at_once_neither_deadlock_nor_lose_money)
{
    Account a(1'000'000), b(1'000'000);
    {
        std::jthread there([&] {
            for (int i = 0; i < 100'000; ++i)
                transfer(a, b, 1);
        });
        std::jthread back([&] {
            for (int i = 0; i < 100'000; ++i)
                transfer(b, a, 2);
        });
    }
    CHECK_EQ(a.balance(), 1'100'000);
    CHECK_EQ(b.balance(), 900'000);
}
```

```check
file threads/tests/bank_test.cpp
```

## Step 8 — Write bank.h

**This step: create `threads/bank.h` and make the tests pass.**

```cpp
class Account {
public:
    explicit Account(int balance) : balance_(balance) {}

    int balance() const
    {
        std::scoped_lock lock(m_);
        return balance_;
    }

    friend void transfer(Account& from, Account& to, int amount);

private:
    mutable std::mutex m_;   // balance() is const, but must lock
    int balance_;
};
```

- Even *reading* `balance_` needs the lock: a read at the same time as another thread's write is a data race too.
- `balance()` is `const`, and locking changes the mutex. `mutable` allows that: the mutex isn't part of the account's value.
- `transfer` is a **friend**: a free function allowed to use the private members. It needs both accounts' mutexes.

Write `transfer` (as an `inline` function after the class):

1. If `&from == &to`, throw `std::invalid_argument`. Locking the same mutex twice is undefined behaviour, and with `scoped_lock` it can hang forever.
2. Lock **both** mutexes in one `std::scoped_lock`.
3. With both held, check the balance and throw `std::runtime_error` if it's too low, then move the money. Checking *inside* the lock matters: checked before it, another thread could take the money between the check and the move.

The build picks up the new test file by itself.

```text
cmake --build threads/build
./threads/build/threads_tests
```

```cpp file=threads/bank.h
// bank.h: accounts that several threads can use at once.
#pragma once

#include <mutex>
#include <stdexcept>

class Account {
public:
    explicit Account(int balance) : balance_(balance) {}

    int balance() const
    {
        std::scoped_lock lock(m_);
        return balance_;
    }

    friend void transfer(Account& from, Account& to, int amount);

private:
    mutable std::mutex m_;   // mutable: balance() is const but must lock
    int balance_;
};

// Moves amount from one account to the other, all or nothing.
inline void transfer(Account& from, Account& to, int amount)
{
    if (&from == &to)   // locking one mutex twice is undefined behaviour
        throw std::invalid_argument("transfer: same account");

    std::scoped_lock lock(from.m_, to.m_);   // both, without deadlock
    if (from.balance_ < amount)
        throw std::runtime_error("transfer: not enough money");
    from.balance_ -= amount;
    to.balance_ += amount;
}
```

```check
matches threads/bank.h "scoped_lock(\s*<[^>]*>)?\s+\w+\s*\(\s*\w+\.\w+\s*,\s*\w+\.\w+\s*\)" label="transfer locks both mutexes in one scoped_lock" -- std::scoped_lock lock(from.m_, to.m_);
run "cmake --build threads/build"
tests "./threads/build/threads_tests" require="a_transfer_without_enough_money_throws_and_changes_nothing a_transfer_to_the_same_account_is_rejected opposite_transfers_at_once_neither_deadlock_nor_lose_money" timeout=60 -- If it stops with a time-out, look for two locks taken one at a time.
```
