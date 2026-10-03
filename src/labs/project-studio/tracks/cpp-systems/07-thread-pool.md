---
title: 7 — Project: a Thread Pool
track: Systems Programming
runtime: cpp
reference: optional
console: true
---

Starting a thread costs tens of microseconds and a stack's worth of memory. For a few long jobs that's nothing. For thousands of small jobs (requests to a server, tiles of an image, chunks of a sum) it dominates. A **thread pool** starts a fixed number of worker threads once, and feeds them jobs through a queue:

```text
submit(job) ──► [ job queue ] ──► worker 1 ─┐
submit(job) ──►                 ► worker 2 ─┼─► futures
submit(job) ──►                 ► worker 3 ─┘
```

This lesson gives you requirements and tests, not code. You have every piece: threads and joining (lesson 4), a queue with condition variables and a clean shutdown (lesson 5), and atomics for the tests (lesson 6). One new piece, `std::future`, is explained in step 2.

The project folder is `pool/`.

## Step 1 — The project's build file

**This step: create the supplied `pool/CMakeLists.txt`.**

The same shape as `threads/`: a header-only library (`submit` will be a template) and a test program linked with `Threads::Threads`. Step 6 adds a program.

```cmake file=pool/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(pool LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(Threads REQUIRED)

# thread_pool.h is header-only: submit() is a template.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(pool_tests ../testing/test_main.cpp ${TEST_SOURCES})
target_include_directories(pool_tests PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)
target_link_libraries(pool_tests PRIVATE Threads::Threads)
```

```check
file pool/CMakeLists.txt
```

## Step 2 — Requirements and specification

**This step: read the requirements, then create the supplied `pool/tests/thread_pool_test.cpp`.**

`class ThreadPool` in `pool/thread_pool.h`:

| Member | Does |
|---|---|
| `ThreadPool(n)` | starts `n` worker threads; `n == 0` throws `std::invalid_argument` |
| `submit(job)` | queues `job` (anything callable with no arguments) and returns a `std::future` of its result; throws `std::runtime_error` after `shutdown()` |
| `wait_all()` | waits until every job submitted so far has **finished** (not just left the queue) |
| `shutdown()` | stops taking jobs, runs every job already queued, joins the workers. Calling it again does nothing |
| `~ThreadPool()` | calls `shutdown()` |
| `size()` | the number of workers |

Copying a pool makes no sense: `= delete` the copy operations.

### Futures: a result that arrives later

`submit` returns at once, long before the job has run. It hands back a **`std::future<R>`**: a claim ticket for a value that will arrive later. `f.get()` waits until it's there and returns it, or rethrows the exception the job threw.

The other end of a future is filled in by a **`std::packaged_task<R()>`**: a wrapper around a function that, when called, runs it and stores its result (or its exception) for the future.

```cpp
std::packaged_task<int()> task([] { return 6 * 7; });
std::future<int> answer = task.get_future();
task();                      // in a worker: runs the lambda
answer.get();                // anywhere: 42
```

Two details you'll meet:

- `std::invoke_result_t<F>` is the type that calling an `F` returns: the `R` for `submit`'s future.
- The queue can hold `std::function<void()>`, but a `std::function` must be copyable, and a `packaged_task` can only be moved. Make the task with `std::make_shared`, and queue a small lambda that holds the `shared_ptr` and calls the task. (C++23's `std::move_only_function` removes the need.)

Read the last test closely. It must prove that `shutdown()` runs jobs that are still **queued**, so it must be certain some are. It holds the only worker in a first job, behind a "gate" (a future it waits on), and only opens the gate once `submit` has started throwing, which proves shutdown has begun.

```cpp file=pool/tests/thread_pool_test.cpp provided
#include "studio_test.hpp"

#include "thread_pool.h"

#include <atomic>
#include <chrono>
#include <future>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

TEST(size_is_the_number_of_workers)
{
    ThreadPool pool(3);
    CHECK_EQ(pool.size(), 3u);
}

TEST(submit_returns_a_future_with_the_result)
{
    ThreadPool pool(2);
    std::future<int> answer = pool.submit([] { return 6 * 7; });
    CHECK_EQ(answer.get(), 42);   // get() waits for the job
}

TEST(jobs_can_return_any_type)
{
    ThreadPool pool(2);
    std::future<std::string> text =
        pool.submit([] { return std::string("pool"); });
    std::future<void> nothing = pool.submit([] {});
    nothing.get();
    CHECK_EQ(text.get(), "pool");
}

TEST(every_job_runs_exactly_once)
{
    ThreadPool pool(4);
    std::atomic<long long> total = 0;
    std::atomic<int> runs = 0;
    for (int i = 1; i <= 1000; ++i) {
        pool.submit([&total, &runs, i] {
            total += i;
            ++runs;
        });
    }
    pool.wait_all();
    CHECK_EQ(runs.load(), 1000);
    CHECK_EQ(total.load(), 500'500LL);
}

TEST(an_exception_travels_through_the_future)
{
    ThreadPool pool(1);
    std::future<int> f = pool.submit([]() -> int {
        throw std::runtime_error("job failed");
    });
    CHECK_THROWS(f.get(), std::runtime_error);
}

// A gate holds the only worker inside the first job, so the other jobs
// are certainly still queued when shutdown starts. shutdown() must run
// them all before it returns.
TEST(shutdown_finishes_the_jobs_already_queued)
{
    ThreadPool pool(1);
    std::promise<void> gate;
    std::shared_future<void> opened = gate.get_future().share();
    std::atomic<int> done = 0;

    pool.submit([opened] { opened.wait(); });
    for (int i = 0; i < 100; ++i)
        pool.submit([&done] { ++done; });

    std::thread closer([&pool] { pool.shutdown(); });
    // Once shutdown has started, submit throws. Wait for that (for at
    // most 10 seconds), then open the gate.
    const auto give_up =
        std::chrono::steady_clock::now() + std::chrono::seconds(10);
    bool stopping = false;
    while (!stopping && std::chrono::steady_clock::now() < give_up) {
        try {
            pool.submit([] {});
            std::this_thread::sleep_for(std::chrono::microseconds(100));
        } catch (const std::runtime_error&) {
            stopping = true;
        }
    }
    gate.set_value();
    closer.join();
    CHECK(stopping);
    CHECK_EQ(done.load(), 100);
}
```

```check
file pool/tests/thread_pool_test.cpp
```

## Step 3 — Build ThreadPool

**This step: no code is given. Create `pool/thread_pool.h` and make the specification pass. Then configure, build and run the tests.**

Hints, if you need them:

- The state: a `std::mutex`, a `std::deque<std::function<void()>>` of jobs, a `std::vector<std::thread>` of workers, a `bool stopping_`, and a count of **unfinished** jobs: queued *or running*. `wait_all` waits for that count to reach zero, on its own condition variable.
- A worker loops: wait until there's a job or the pool is stopping. If there's a job, take it **even if stopping**; return only when stopping *and* the queue is empty. Run the job **after unlocking**, so the other workers can take jobs meanwhile. Then lock again, decrement the count, and notify if it reached zero.
- `shutdown()` sets `stopping_` under the lock, wakes **all** workers, and joins them. Return early if it was already stopping, or the second call would join threads that are already joined.
- A `packaged_task` never throws when called: a job's exception goes into its future. So a job that throws can't kill its worker, or skip the count.

```text
cmake -S pool -B pool/build -G "MinGW Makefiles"     (Windows)
cmake -S pool -B pool/build                          (macOS, Linux)
```

```text
cmake --build pool/build
./pool/build/pool_tests
```

```cpp file=pool/thread_pool.h
// thread_pool.h: a fixed set of worker threads that run submitted jobs.
#pragma once

#include <condition_variable>
#include <cstddef>
#include <deque>
#include <functional>
#include <future>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <thread>
#include <type_traits>
#include <utility>
#include <vector>

class ThreadPool {
public:
    explicit ThreadPool(std::size_t threads)
    {
        if (threads == 0)
            throw std::invalid_argument("ThreadPool: needs a thread");
        for (std::size_t i = 0; i < threads; ++i)
            workers_.emplace_back([this] { work(); });
    }

    ~ThreadPool() { shutdown(); }

    ThreadPool(const ThreadPool&) = delete;
    ThreadPool& operator=(const ThreadPool&) = delete;

    // Queues job to run on a worker. The future delivers its result,
    // or the exception it threw.
    template <typename F>
    auto submit(F job) -> std::future<std::invoke_result_t<F>>
    {
        using R = std::invoke_result_t<F>;   // what job() returns
        // std::function must be copyable and a packaged_task isn't,
        // so the queue holds a copyable pointer to it.
        auto task = std::make_shared<std::packaged_task<R()>>(std::move(job));
        std::future<R> result = task->get_future();
        {
            std::scoped_lock lock(m_);
            if (stopping_)
                throw std::runtime_error("ThreadPool: submit after shutdown");
            jobs_.push_back([task] { (*task)(); });
            ++unfinished_;
        }
        job_ready_.notify_one();
        return result;
    }

    // Waits until every job submitted so far has finished.
    void wait_all()
    {
        std::unique_lock lock(m_);
        all_done_.wait(lock, [this] { return unfinished_ == 0; });
    }

    // Stops taking jobs, finishes the queued ones, joins the workers.
    // Safe to call more than once.
    void shutdown()
    {
        {
            std::scoped_lock lock(m_);
            if (stopping_)
                return;
            stopping_ = true;
        }
        job_ready_.notify_all();
        for (std::thread& t : workers_)
            t.join();
    }

    std::size_t size() const { return workers_.size(); }

private:
    void work()
    {
        while (true) {
            std::function<void()> job;
            {
                std::unique_lock lock(m_);
                job_ready_.wait(lock, [this] {
                    return !jobs_.empty() || stopping_;
                });
                if (jobs_.empty())
                    return;   // stopping, and nothing left to do
                job = std::move(jobs_.front());
                jobs_.pop_front();
            }
            job();   // outside the lock: other workers keep going
            {
                std::scoped_lock lock(m_);
                --unfinished_;
                if (unfinished_ == 0)
                    all_done_.notify_all();
            }
        }
    }

    std::mutex m_;
    std::condition_variable job_ready_;
    std::condition_variable all_done_;
    std::deque<std::function<void()>> jobs_;
    std::vector<std::thread> workers_;
    std::size_t unfinished_ = 0;   // queued or running
    bool stopping_ = false;
};
```

```check
file pool/build/CMakeCache.txt label="pool/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build pool/build"
tests "./pool/build/pool_tests" require="submit_returns_a_future_with_the_result jobs_can_return_any_type every_job_runs_exactly_once an_exception_travels_through_the_future shutdown_finishes_the_jobs_already_queued" timeout=90 -- A worker may only return when the pool is stopping AND the queue is empty.
```

## Step 4 — Your own tests

**This step: create `pool/tests/thread_pool_own_test.cpp` with at least three tests. One must use a pool with a single worker.**

A pool with one worker runs jobs one at a time, in the order they were queued: a deterministic case you can check exactly. A vector that only the worker writes can be read safely after `wait_all()`, because `wait_all` locks the same mutex the worker unlocked after the job: lesson 6's release and acquire.

Ideas:

- `ThreadPool(0)` throws;
- each future gets its own job's result, though jobs finish in any order;
- one worker runs jobs in submission order;
- `wait_all()` twice in a row.

```cpp file=pool/tests/thread_pool_own_test.cpp
#include "studio_test.hpp"

#include "thread_pool.h"

#include <future>
#include <stdexcept>
#include <vector>

TEST(a_pool_needs_at_least_one_thread)
{
    CHECK_THROWS(ThreadPool(0), std::invalid_argument);
}

// Jobs finish in any order, but each future belongs to its own job.
TEST(each_future_gets_its_own_jobs_result)
{
    ThreadPool pool(4);
    std::vector<std::future<int>> squares;
    for (int i = 0; i < 100; ++i)
        squares.push_back(pool.submit([i] { return i * i; }));
    for (int i = 0; i < 100; ++i)
        CHECK_EQ(squares[i].get(), i * i);
}

// With one worker, jobs run one at a time in the order they were queued.
TEST(one_worker_runs_jobs_in_order)
{
    ThreadPool pool(1);
    std::vector<int> order;   // only the worker touches it until wait_all
    for (int i = 0; i < 10; ++i)
        pool.submit([&order, i] { order.push_back(i); });
    pool.wait_all();          // wait_all locks the same mutex: safe to read
    CHECK_EQ(order.size(), 10u);
    for (int i = 0; i < 10; ++i)
        CHECK_EQ(order[i], i);
}
```

```check
matches pool/tests/thread_pool_own_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="thread_pool_own_test.cpp has at least three tests"
matches pool/tests/thread_pool_own_test.cpp "ThreadPool\s+\w+\s*[({]\s*1\s*[)}]" label="a test uses a pool with one worker"
run "cmake --build pool/build"
tests "./pool/build/pool_tests" timeout=90
```

## Step 5 — The reviewer's tests

**This step: create the supplied `pool/tests/thread_pool_review_test.cpp`, build, run the tests, and fix `thread_pool.h` until everything passes.**

The reviewer probes what the specification didn't:

- `submit` after `shutdown()` throws, and `shutdown()` twice (then the destructor, a third time) is harmless.
- `wait_all()` with nothing submitted returns at once.
- A job that throws doesn't stop its worker, and still counts as finished for `wait_all`.
- Four threads submitting at once lose no jobs.
- A job can submit another job, and `wait_all` waits for both.

### A deadlock to know about

The reviewer did **not** write this test, because it can never pass:

```cpp
ThreadPool pool(1);
auto outer = pool.submit([&] {
    auto inner = pool.submit([] { return 1; });
    return inner.get();   // waits for inner...
});
```

The only worker is busy running `outer`, which waits for `inner`, which waits in the queue for a free worker. Forever. A job that **waits for another job of the same pool** can deadlock it, once every worker is doing that. Submitting a job from a job is fine; waiting for it is the danger. Real job systems either forbid it, or let a waiting worker run other jobs while it waits.

```cpp file=pool/tests/thread_pool_review_test.cpp provided
#include "studio_test.hpp"

#include "thread_pool.h"

#include <atomic>
#include <future>
#include <stdexcept>
#include <thread>
#include <vector>

TEST(review_submit_after_shutdown_throws)
{
    ThreadPool pool(2);
    pool.shutdown();
    CHECK_THROWS(pool.submit([] { return 1; }), std::runtime_error);
}

TEST(review_shutdown_twice_then_destroy_is_harmless)
{
    ThreadPool pool(2);
    pool.submit([] {});
    pool.shutdown();
    pool.shutdown();
}   // and the destructor shuts down a third time

TEST(review_wait_all_with_nothing_submitted_returns_at_once)
{
    ThreadPool pool(2);
    pool.wait_all();
    pool.wait_all();
}

TEST(review_a_job_that_throws_does_not_stop_its_worker)
{
    ThreadPool pool(1);   // one worker: it must survive the first job
    std::future<int> bad =
        pool.submit([]() -> int { throw std::logic_error("bad"); });
    std::future<int> good = pool.submit([] { return 5; });
    CHECK_THROWS(bad.get(), std::logic_error);
    CHECK_EQ(good.get(), 5);
}

TEST(review_wait_all_counts_jobs_that_threw)
{
    ThreadPool pool(2);
    for (int i = 0; i < 10; ++i)
        pool.submit([] { throw std::runtime_error("ignored"); });
    pool.wait_all();   // must not wait forever
}

TEST(review_many_threads_can_submit_at_once)
{
    ThreadPool pool(3);
    std::atomic<int> runs = 0;
    {
        std::vector<std::jthread> clients;
        for (int c = 0; c < 4; ++c) {
            clients.emplace_back([&] {
                for (int i = 0; i < 250; ++i)
                    pool.submit([&runs] { ++runs; });
            });
        }
    }
    pool.wait_all();
    CHECK_EQ(runs.load(), 1000);
}

TEST(review_a_job_can_submit_another_job)
{
    ThreadPool pool(2);
    std::atomic<int> runs = 0;
    pool.submit([&] {
        ++runs;
        pool.submit([&runs] { ++runs; });   // queued before this job ends
    });
    pool.wait_all();   // so this waits for both
    CHECK_EQ(runs.load(), 2);
}
```

```check
file pool/tests/thread_pool_review_test.cpp
run "cmake --build pool/build"
tests "./pool/build/pool_tests" require="review_submit_after_shutdown_throws review_shutdown_twice_then_destroy_is_harmless review_a_job_that_throws_does_not_stop_its_worker review_wait_all_counts_jobs_that_threw review_a_job_can_submit_another_job" timeout=90 -- shutdown() must return at once if the pool is already stopping.
```

## Step 6 — A parallel sum

**This step: add a `psum` program to `pool/CMakeLists.txt` and write `pool/main.cpp`. It adds up 10,000,000 numbers on one thread, then on the pool, and checks they agree.**

```cmake
add_executable(psum main.cpp)
target_link_libraries(psum PRIVATE Threads::Threads)
```

`parallel_sum(pool, data)` cuts the vector into chunks, submits one job per chunk, and adds up the futures' results:

```cpp
parts.push_back(pool.submit([&data, begin, end] {
    return std::accumulate(data.begin() + begin,
                           data.begin() + end, 0LL);
}));
```

- Use a few chunks per worker (`pool.size() * 4`), not exactly one: if one worker is slowed down, the others take its remaining chunks.
- `0LL` makes `std::accumulate` add in `long long`: it adds in the type of its starting value. With `0` it would add in `int`, and the whole sum, about 5 billion, doesn't fit in one.
- Capturing `data` by reference is safe because `parallel_sum` waits for every future before it returns.
- The data is `i % 1000` for each index `i`, so the total is certain: `4995000000`. Only that's checked, never the times.

```text
serial:   4995000000 in 57 ms
parallel: 4995000000 in 20 ms on 4 threads
results match
```

The default build has no optimisation. For real timings, configure a second build folder with `-DCMAKE_BUILD_TYPE=Release` added. Adding numbers is limited by how fast memory delivers them, so expect less than a 4× speed-up on 4 cores: measuring tells you which kind of work is worth spreading out.

### Where to go from here

- `std::async(std::launch::async, f)` runs one job on a new thread and returns a future: fine for a few big jobs.
- C++20's `std::latch`, `std::barrier` and `std::counting_semaphore` cover other common ways for threads to wait for each other.
- Run your tests under ThreadSanitizer (`-fsanitize=thread`) on Linux or macOS: a clean run of `pool_tests` is good evidence the pool has no data races.

```cpp file=pool/main.cpp
// psum: adds up a large vector on one thread, then on a thread pool.
#include "thread_pool.h"

#include <algorithm>
#include <chrono>
#include <future>
#include <iostream>
#include <numeric>
#include <thread>
#include <vector>

using Clock = std::chrono::steady_clock;

double ms_since(Clock::time_point start)
{
    const std::chrono::duration<double, std::milli> elapsed =
        Clock::now() - start;
    return elapsed.count();
}

long long parallel_sum(ThreadPool& pool, const std::vector<int>& data)
{
    // A few chunks per worker, so a slow worker doesn't hold everyone up.
    const std::size_t chunks = pool.size() * 4;
    const std::size_t chunk_size = (data.size() + chunks - 1) / chunks;

    std::vector<std::future<long long>> parts;
    for (std::size_t begin = 0; begin < data.size(); begin += chunk_size) {
        const std::size_t end = std::min(begin + chunk_size, data.size());
        parts.push_back(pool.submit([&data, begin, end] {
            return std::accumulate(data.begin() + begin,
                                   data.begin() + end, 0LL);
        }));
    }

    long long total = 0;
    for (std::future<long long>& part : parts)
        total += part.get();   // waits for that chunk
    return total;
}

int main()
{
    std::vector<int> data(10'000'000);
    for (std::size_t i = 0; i < data.size(); ++i)
        data[i] = static_cast<int>(i % 1000);

    auto start = Clock::now();
    const long long serial = std::accumulate(data.begin(), data.end(), 0LL);
    std::cout << "serial:   " << serial << " in " << ms_since(start) << " ms\n";

    ThreadPool pool(std::max(1u, std::thread::hardware_concurrency()));
    start = Clock::now();
    const long long parallel = parallel_sum(pool, data);
    std::cout << "parallel: " << parallel << " in " << ms_since(start)
              << " ms on " << pool.size() << " threads\n";

    std::cout << (serial == parallel ? "results match\n" : "RESULTS DIFFER\n");
}
```

```check
contains pool/CMakeLists.txt "add_executable(psum" -- Add the two lines for psum to the end of pool/CMakeLists.txt.
run "cmake --build pool/build"
run "./pool/build/psum" stdout="results match" timeout=120
run "./pool/build/psum" stdout="parallel: 4995000000" timeout=120
```
