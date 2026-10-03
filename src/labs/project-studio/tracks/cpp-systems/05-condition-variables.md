---
title: 5 — Condition Variables: a Blocking Queue
track: Systems Programming
runtime: cpp
reference: optional
console: true
---

In lesson 3, a pipe connected a producer to a consumer: the writer **waited** when the pipe was full, and the reader waited when it was empty. Threads in one process need the same thing: a queue that one thread fills while another empties it. It's the most common way for threads to cooperate.

The hard part is the waiting. A consumer with nothing to do could check the queue in a loop:

| Wait by… | Costs |
|---|---|
| checking in a tight loop | a whole CPU core, doing nothing useful |
| checking, then sleeping 10 ms | up to 10 ms late for every item |
| a **condition variable** | nothing: the thread sleeps until another thread says something changed |

This lesson builds `BlockingQueue<T>` in `threads/`, with a condition variable, and uses it to connect three stages of a program.

## Step 1 — The specification

**This step: create the supplied `threads/tests/blocking_queue_test.cpp` and read it.**

`template <typename T> class BlockingQueue` in `threads/blocking_queue.h`:

| Member | Does |
|---|---|
| `BlockingQueue(capacity)` | an empty queue that holds at most `capacity` values |
| `push(value)` | waits while the queue is full; `false` (and no push) if it's closed |
| `pop()` | waits while it's empty; a `std::optional<T>` that's empty once the queue is closed **and** empty |
| `try_pop()` | never waits |
| `close()` | no more pushes; wakes every waiting thread |
| `size()` | how many values are queued |
| `waiting()` | how many threads are waiting inside `pop()` right now |

`close()` is how a producer says "that's all". Consumers keep popping what's left, and stop at the first empty `optional`:

```cpp
while (std::optional<int> v = q.pop())   // ends when closed and empty
    use(*v);
```

### How do you test threads?

The tests never depend on which thread runs first, or how fast. They check only what's **certain**:

- one producer and one consumer: the values arrive in order;
- many producers and consumers: the *total* and the *count*, which don't depend on who popped what;
- `close()` and a waiting consumer: whether the consumer was already waiting or not, it must end with an empty `optional`.

Each consumer adds into its own element of `sums`, as in `split_sum`, so the test itself has no data race. And `CHECK`s run only in the main thread: a failing `CHECK` throws, and an exception that escapes a thread's function calls `std::terminate`.

```cpp file=threads/tests/blocking_queue_test.cpp provided
#include "studio_test.hpp"

#include "blocking_queue.h"

#include <thread>
#include <vector>

// One thread: the queue behaves like a plain first-in, first-out queue.

TEST(pop_returns_values_in_the_order_they_were_pushed)
{
    BlockingQueue<int> q(10);
    CHECK(q.push(1));
    CHECK(q.push(2));
    CHECK(q.push(3));
    CHECK_EQ(q.size(), 3u);
    CHECK_EQ(q.pop().value_or(-1), 1);
    CHECK_EQ(q.pop().value_or(-1), 2);
    CHECK_EQ(q.pop().value_or(-1), 3);
}

TEST(try_pop_on_an_empty_queue_returns_nothing)
{
    BlockingQueue<int> q(10);
    CHECK(!q.try_pop().has_value());
}

TEST(values_pushed_before_close_are_still_delivered)
{
    BlockingQueue<int> q(10);
    q.push(1);
    q.push(2);
    q.close();
    CHECK_EQ(q.pop().value_or(-1), 1);
    CHECK_EQ(q.pop().value_or(-1), 2);
    CHECK(!q.pop().has_value());   // closed and empty: doesn't wait
}

TEST(push_after_close_fails)
{
    BlockingQueue<int> q(10);
    q.close();
    CHECK(!q.push(1));
    CHECK_EQ(q.size(), 0u);
}

// Several threads. Each test's result is the same however the threads
// are scheduled: only the totals and the per-producer order are checked.

TEST(close_wakes_a_waiting_consumer)
{
    BlockingQueue<int> q(10);
    std::optional<int> got = 42;
    std::thread consumer([&] { got = q.pop(); });   // waits: q is empty
    q.close();
    consumer.join();
    CHECK(!got.has_value());
}

TEST(a_full_queue_makes_the_producer_wait_its_turn)
{
    BlockingQueue<int> q(2);   // room for only two values
    std::thread producer([&] {
        for (int i = 1; i <= 1000; ++i)
            q.push(i);
    });
    for (int i = 1; i <= 1000; ++i)
        CHECK_EQ(q.pop().value_or(-1), i);   // one producer: order is kept
    producer.join();
}

TEST(many_producers_and_consumers_lose_nothing)
{
    BlockingQueue<int> q(16);
    std::vector<long long> sums(4, 0);
    std::vector<int> counts(4, 0);

    std::vector<std::thread> consumers;
    for (int c = 0; c < 4; ++c) {
        consumers.emplace_back([&, c] {
            while (std::optional<int> v = q.pop()) {   // until closed and empty
                sums[c] += *v;
                ++counts[c];
            }
        });
    }
    std::vector<std::thread> producers;
    for (int p = 0; p < 4; ++p) {
        producers.emplace_back([&] {
            for (int i = 1; i <= 10'000; ++i)
                q.push(i);
        });
    }
    for (auto& t : producers)
        t.join();
    q.close();   // every value is in; consumers stop once they've drained it
    for (auto& t : consumers)
        t.join();

    long long total = 0;
    int count = 0;
    for (int c = 0; c < 4; ++c) {
        total += sums[c];
        count += counts[c];
    }
    CHECK_EQ(count, 40'000);
    CHECK_EQ(total, 4 * 50'005'000LL);
}
```

```check
file threads/tests/blocking_queue_test.cpp
```

## Step 2 — Write BlockingQueue

**This step: create `threads/blocking_queue.h` and make the specification pass.**

The data: a `std::deque<T>`, a `std::mutex` that guards everything, and two **condition variables**, one for each thing a thread can wait for.

```cpp
std::optional<T> pop()
{
    std::unique_lock lock(m_);
    ++waiting_;
    not_empty_.wait(lock,
                    [this] { return !items_.empty() || closed_; });
    --waiting_;
    return take_front();   // empty optional if closed and empty
}
```

`not_empty_.wait(lock, condition)`:

1. checks the condition, with the mutex locked. If it's true, returns at once;
2. otherwise **unlocks** the mutex and puts the thread to sleep, as one step;
3. when woken, locks the mutex again and goes back to 1.

It's exactly this loop:

```cpp
while (!(items_.empty() == false || closed_))
    not_empty_.wait(lock);
```

- `std::unique_lock`, not `scoped_lock`: `wait` must unlock and relock it.
- Unlocking and sleeping happen as **one** step. Otherwise a `push` could slip in between "the queue is empty" and "go to sleep", and its wake-up would be lost: the consumer would sleep with an item in the queue.
- Why check again after waking? **Spurious wakeups**: the system may wake a waiting thread for no reason. And **stolen wakeups**: another consumer may take the item before this one gets the lock back. With an `if` instead of a loop, the consumer would pop from an empty deque. Always use the form that takes a condition.

The producer's side, and the wake-up:

```cpp
not_full_.wait(lock, [this] {
    return items_.size() < capacity_ || closed_; });
if (closed_)
    return false;
items_.push_back(std::move(value));
not_empty_.notify_one();   // one waiting consumer can go on
```

- `notify_one` wakes one waiting thread, `notify_all` wakes all of them. One new item can feed only one consumer, so `push` wakes one. `take_front` likewise wakes one waiting producer with `not_full_`.
- `close()` sets `closed_` under the lock, then calls `notify_all` on **both** condition variables: every waiting thread must see that the queue is closed.
- `waiting()`, `size()` and `try_pop()` lock the mutex too. `m_` is `mutable`, as in `Account`.

```text
cmake --build threads/build
./threads/build/threads_tests
```

```cpp file=threads/blocking_queue.h
// blocking_queue.h: a queue that threads can share. pop() waits for a
// value; push() waits for room. close() ends it for everyone.
#pragma once

#include <condition_variable>
#include <cstddef>
#include <deque>
#include <mutex>
#include <optional>
#include <utility>

template <typename T>
class BlockingQueue {
public:
    explicit BlockingQueue(std::size_t capacity) : capacity_(capacity) {}

    // Waits while the queue is full. False if the queue was closed.
    bool push(T value)
    {
        std::unique_lock lock(m_);
        not_full_.wait(lock,
                       [this] { return items_.size() < capacity_ || closed_; });
        if (closed_)
            return false;
        items_.push_back(std::move(value));
        not_empty_.notify_one();   // one waiting consumer can go on
        return true;
    }

    // Waits while the queue is empty. Nothing once it's closed and empty.
    std::optional<T> pop()
    {
        std::unique_lock lock(m_);
        ++waiting_;
        not_empty_.wait(lock, [this] { return !items_.empty() || closed_; });
        --waiting_;
        return take_front();
    }

    // Never waits.
    std::optional<T> try_pop()
    {
        std::scoped_lock lock(m_);
        return take_front();
    }

    // No more pushes. Values already queued can still be popped.
    void close()
    {
        {
            std::scoped_lock lock(m_);
            closed_ = true;
        }
        not_empty_.notify_all();   // every waiter must re-check
        not_full_.notify_all();
    }

    std::size_t size() const
    {
        std::scoped_lock lock(m_);
        return items_.size();
    }

    // How many threads are waiting inside pop() right now.
    std::size_t waiting() const
    {
        std::scoped_lock lock(m_);
        return waiting_;
    }

private:
    // Call with m_ locked.
    std::optional<T> take_front()
    {
        if (items_.empty())
            return std::nullopt;
        T value = std::move(items_.front());
        items_.pop_front();
        not_full_.notify_one();   // one waiting producer can go on
        return value;
    }

    mutable std::mutex m_;
    std::condition_variable not_empty_;
    std::condition_variable not_full_;
    std::deque<T> items_;
    std::size_t capacity_;
    std::size_t waiting_ = 0;
    bool closed_ = false;
};
```

```check
matches threads/blocking_queue.h "\.wait\s*\(\s*\w+\s*,\s*\[" label="the waits use the form with a condition"
run "cmake --build threads/build"
tests "./threads/build/threads_tests" require="pop_returns_values_in_the_order_they_were_pushed values_pushed_before_close_are_still_delivered push_after_close_fails close_wakes_a_waiting_consumer a_full_queue_makes_the_producer_wait_its_turn many_producers_and_consumers_lose_nothing" timeout=60 -- A test that never finishes: check every wait's condition includes closed_.
```

## Step 3 — A bug to diagnose: close

**This step: create the supplied `threads/tests/close_test.cpp`, read it, build and run the tests.**

Here's a `close()` that looks reasonable. It passes every test in the specification:

```cpp
void close()
{
    {
        std::scoped_lock lock(m_);
        closed_ = true;
    }
    not_empty_.notify_one();
    not_full_.notify_one();
}
```

**Predict:** three consumers are waiting in `pop()` on an empty queue. What happens to each of them when this `close()` runs?

The new tests set up exactly that situation, and it needs care. "Start three threads, then close" isn't enough: maybe the threads haven't reached `pop()` yet. And "sleep 100 ms, then close" is a guess that a slow machine will get wrong. Instead, the test waits until `q.waiting()` says all three are inside `pop()`. It waits only for something that is certain to happen, so its outcome doesn't depend on timing.

```cpp file=threads/tests/close_test.cpp provided
#include "studio_test.hpp"

#include "blocking_queue.h"

#include <thread>
#include <vector>

// Waits until n threads are inside pop(). Only waits for something that
// is certain to happen, so the test can't depend on timing.
template <typename T>
void wait_for_waiters(const BlockingQueue<T>& q, std::size_t n)
{
    while (q.waiting() < n)
        std::this_thread::yield();
}

TEST(close_wakes_every_waiting_consumer)
{
    BlockingQueue<int> q(10);
    std::vector<std::thread> consumers;
    for (int c = 0; c < 3; ++c)
        consumers.emplace_back([&] { q.pop(); });
    wait_for_waiters(q, 3);   // all three are asleep in pop()

    q.close();   // must wake all three, or join() below waits forever
    for (auto& t : consumers)
        t.join();
    CHECK_EQ(q.waiting(), 0u);
}

TEST(close_releases_a_producer_waiting_for_room)
{
    BlockingQueue<int> q(1);
    q.push(1);   // full
    bool pushed = true;
    std::thread producer([&] { pushed = q.push(2); });   // waits for room
    q.close();
    producer.join();
    CHECK(!pushed);
    CHECK_EQ(q.pop().value_or(-1), 1);
    CHECK(!q.pop().has_value());
}
```

### What happens with notify_one

One consumer wakes, sees `closed_`, and returns. The other two sleep forever: nothing will ever notify them again. The test's `join()` waits for them forever too, and the test program is stopped after its time limit.

The rule: when a change can let **several** waiting threads go on (closing, shutting down, a flag every thread checks), use `notify_all`. When it can let exactly one go on (one new item), `notify_one` is enough, and cheaper.

If your queue passes, compare your `close()` with the one above anyway: it's one of the most common bugs in real queues.

```check
file threads/tests/close_test.cpp
run "cmake --build threads/build"
tests "./threads/build/threads_tests" require="close_wakes_every_waiting_consumer close_releases_a_producer_waiting_for_room" timeout=30 -- close() can let every waiting thread go on, so it must wake all of them: notify_all.
```

## Step 4 — Three stages, two queues

**This step: add a `pipeline` program to `threads/CMakeLists.txt` and write `threads/pipeline.cpp`. It must print `received 5000 results` and `divisors of 1 to 5000: 43376`.**

```cmake
add_executable(pipeline pipeline.cpp)
target_link_libraries(pipeline PRIVATE Threads::Threads)
```

```text
producer ──jobs──► 3 workers ──results──► main
```

A producer thread pushes the numbers 1 to 5000 into `jobs`. Three workers each pop numbers, count each one's divisors, and push the counts into `results`. `main` pops the results and adds them up.

The work is easy. **Stopping** is the part to design, because every stage must learn that there's no more input, and only after it really has all of it:

| Order | Who | Does |
|---|---|---|
| 1 | producer | pushes the last job, then closes `jobs` |
| 2 | workers | pop until `jobs` is closed and empty, then return |
| 3 | finisher | joins the three workers, **then** closes `results` |
| 4 | main | pops until `results` is closed and empty |

Step 3 needs its own thread, the finisher, which starts the workers (in a block of `std::jthread`s) and closes `results` once the block has joined them. If a worker closed `results` itself when it ran out of jobs, the other two might still be pushing their last results into a closed queue.

```text
cmake --build threads/build
./threads/build/pipeline
```

```cpp file=threads/pipeline.cpp
// pipeline: numbers flow through two queues and three workers.
//
//   producer ──jobs──► 3 workers ──results──► main
#include "blocking_queue.h"

#include <iostream>
#include <optional>
#include <thread>
#include <vector>

// How many whole numbers divide n. Slow on purpose: real work.
int divisors(int n)
{
    int count = 0;
    for (int d = 1; d <= n; ++d)
        if (n % d == 0)
            ++count;
    return count;
}

int main()
{
    const int n = 5'000;
    BlockingQueue<int> jobs(64);
    BlockingQueue<int> results(64);

    std::jthread producer([&] {
        for (int i = 1; i <= n; ++i)
            jobs.push(i);
        jobs.close();                          // 1. no more jobs
    });

    std::jthread finisher([&] {
        {
            std::vector<std::jthread> workers;
            for (int w = 0; w < 3; ++w) {
                workers.emplace_back([&] {
                    while (std::optional<int> job = jobs.pop())
                        results.push(divisors(*job));   // 2. drain jobs
                });
            }
        }                                      // 3. workers joined...
        results.close();                       // ...so no more results
    });

    long long total = 0;
    int received = 0;
    while (std::optional<int> r = results.pop()) {   // 4. drain results
        total += *r;
        ++received;
    }
    std::cout << "received " << received << " results\n";
    std::cout << "divisors of 1 to " << n << ": " << total << '\n';
}
```

```check
contains threads/CMakeLists.txt "add_executable(pipeline" -- Add the two lines for pipeline to the end of threads/CMakeLists.txt.
run "cmake --build threads/build"
run "./threads/build/pipeline" stdout="received 5000 results\ndivisors of 1 to 5000: 43376" timeout=60
```

## Step 5 — Waiting with a time limit

**This step: add `pop_for(timeout)` to `BlockingQueue`: like `pop()`, but it gives up and returns an empty `optional` after the timeout.**

A thread that waits forever can't notice anything else: a request to stop, or a deadline. `wait_for` takes a time limit as well as the condition:

```cpp
template <typename Rep, typename Period>
std::optional<T> pop_for(std::chrono::duration<Rep, Period> timeout)
```

- A `std::chrono::duration` is a number with a unit. `using namespace std::chrono_literals;` lets callers write `20ms` or `5s`. Taking any `duration<Rep, Period>` accepts all of them.
- `cv.wait_for(lock, timeout, condition)` waits like `wait`, but at most `timeout`. It returns the condition's value: `false` means it timed out.
- It measures time on a **steady clock**, which only moves forward. A clock you can set (the wall clock) can jump when the system's time is corrected.
- Count the thread in `waiting_` as `pop()` does.

After a timeout, return `take_front()` anyway: it's empty, unless a value arrived at the last moment.

```cpp file=threads/blocking_queue.h
// blocking_queue.h: a queue that threads can share. pop() waits for a
// value; push() waits for room. close() ends it for everyone.
#pragma once

#include <chrono>
#include <condition_variable>
#include <cstddef>
#include <deque>
#include <mutex>
#include <optional>
#include <utility>

template <typename T>
class BlockingQueue {
public:
    explicit BlockingQueue(std::size_t capacity) : capacity_(capacity) {}

    // Waits while the queue is full. False if the queue was closed.
    bool push(T value)
    {
        std::unique_lock lock(m_);
        not_full_.wait(lock,
                       [this] { return items_.size() < capacity_ || closed_; });
        if (closed_)
            return false;
        items_.push_back(std::move(value));
        not_empty_.notify_one();   // one waiting consumer can go on
        return true;
    }

    // Waits while the queue is empty. Nothing once it's closed and empty.
    std::optional<T> pop()
    {
        std::unique_lock lock(m_);
        ++waiting_;
        not_empty_.wait(lock, [this] { return !items_.empty() || closed_; });
        --waiting_;
        return take_front();
    }

    // Like pop(), but gives up after the timeout and returns nothing.
    template <typename Rep, typename Period>
    std::optional<T> pop_for(std::chrono::duration<Rep, Period> timeout)
    {
        std::unique_lock lock(m_);
        ++waiting_;
        not_empty_.wait_for(lock, timeout,
                            [this] { return !items_.empty() || closed_; });
        --waiting_;
        return take_front();   // empty if it timed out
    }

    // Never waits.
    std::optional<T> try_pop()
    {
        std::scoped_lock lock(m_);
        return take_front();
    }

    // No more pushes. Values already queued can still be popped.
    void close()
    {
        {
            std::scoped_lock lock(m_);
            closed_ = true;
        }
        not_empty_.notify_all();   // every waiter must re-check
        not_full_.notify_all();
    }

    std::size_t size() const
    {
        std::scoped_lock lock(m_);
        return items_.size();
    }

    // How many threads are waiting inside pop() right now.
    std::size_t waiting() const
    {
        std::scoped_lock lock(m_);
        return waiting_;
    }

private:
    // Call with m_ locked.
    std::optional<T> take_front()
    {
        if (items_.empty())
            return std::nullopt;
        T value = std::move(items_.front());
        items_.pop_front();
        not_full_.notify_one();   // one waiting producer can go on
        return value;
    }

    mutable std::mutex m_;
    std::condition_variable not_empty_;
    std::condition_variable not_full_;
    std::deque<T> items_;
    std::size_t capacity_;
    std::size_t waiting_ = 0;
    bool closed_ = false;
};
```

```check
matches threads/blocking_queue.h "wait_for\s*\(" label="pop_for uses wait_for"
run "cmake --build threads/build"
tests "./threads/build/threads_tests" timeout=60
```

## Step 6 — Your own tests for pop_for

**This step: create `threads/tests/pop_for_test.cpp` with at least three tests of `pop_for`. At least one must involve a second thread.**

Tests with time in them are where flaky tests come from. Two rules keep yours deterministic:

- **Only check time in the safe direction.** `pop_for(20ms)` on an empty queue must take *at least* 20 ms: that's guaranteed. "At most 25 ms" isn't: a busy machine can be late. If you must check an upper bound, make it huge (10 seconds for something that should be instant).
- **Never sleep to "make sure" another thread has got somewhere.** Wait for it to tell you. `waiting()` says when a thread is inside `pop_for`.

Ideas:

- a value that's already queued comes back at once;
- an empty queue gives up, after at least the timeout;
- a closed queue returns at once, without waiting for the timeout;
- a value pushed by another thread while `pop_for` waits is returned.

Measure with `std::chrono::steady_clock::now()`. The difference of two time points is a duration, which you can compare with `20ms`.

```cpp file=threads/tests/pop_for_test.cpp
#include "studio_test.hpp"

#include "blocking_queue.h"

#include <chrono>
#include <thread>

using namespace std::chrono_literals;
using Clock = std::chrono::steady_clock;

TEST(pop_for_returns_a_value_that_is_already_there)
{
    BlockingQueue<int> q(4);
    q.push(5);
    CHECK_EQ(q.pop_for(10s).value_or(-1), 5);
}

// wait_for with a predicate only gives up once the time has passed,
// measured on a steady clock, so this holds on any machine.
TEST(pop_for_on_an_empty_queue_gives_up_after_the_timeout)
{
    BlockingQueue<int> q(4);
    const auto start = Clock::now();
    CHECK(!q.pop_for(20ms).has_value());
    CHECK(Clock::now() - start >= 20ms);
}

TEST(pop_for_on_a_closed_queue_does_not_wait)
{
    BlockingQueue<int> q(4);
    q.close();
    const auto start = Clock::now();
    CHECK(!q.pop_for(30s).has_value());
    CHECK(Clock::now() - start < 10s);   // generous: it should be instant
}

TEST(pop_for_gets_a_value_pushed_while_it_waits)
{
    BlockingQueue<int> q(4);
    std::thread producer([&] {
        while (q.waiting() == 0)   // until main is inside pop_for
            std::this_thread::yield();
        q.push(7);
    });
    CHECK_EQ(q.pop_for(60s).value_or(-1), 7);
    producer.join();
}
```

```check
matches threads/tests/pop_for_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="pop_for_test.cpp has at least three tests"
contains threads/tests/pop_for_test.cpp "std::thread"
run "cmake --build threads/build"
tests "./threads/build/threads_tests" timeout=60
```
