---
title: 1 — The Game Loop: Fixed Timesteps
track: Games and Engines
trackOrder: 14
runtime: cpp
reference: optional
console: true
---

A game is a program that never stops asking three questions, many times a second: *what did the player press?*, *what happens next?*, *what does it look like now?* That loop, and the machinery that keeps it fast and fair, is what a **game engine** is.

This track builds the core of one, **headless**: no window, no graphics card. Everything a game decides (where the ball is, who scored, which objects collide) is plain C++ that you can test exactly. Drawing is the easy last step; deciding is where the bugs live.

| Lesson | You build |
|---|---|
| 1 | the game loop: a fixed timestep, driven by a fake clock |
| 2 | entities and components: a tiny ECS with three systems |
| 3 | collision and rules: headless Pong, and a tunnelling bug |
| 4 | data-oriented design: 50,000 particles in two layouts |
| 5 | profiling: a scope timer that writes a Chrome trace |

**Want to see a real window?** The *Classic Games in C++ — Pong* track draws a playable Pong in a native window (in the Windows desktop app). Its `update` function is a game loop with the problems this lesson fixes; come back to it afterwards and you'll recognise them.

Choose a **new empty folder** for this track, and run every command from that folder. It will hold:

| Folder | What |
|---|---|
| `testing/` | the test framework |
| `engine/` | the CMake project: the engine (header files), `apps/` (programs) and `tests/` |

## Step 1 — The test framework

**This step: create the supplied `testing/studio_test.hpp`.**

The engine is tested from the first lesson, so the track needs the test framework.

It's the same small framework as in *C++ Foundations*: `TEST(name)`, `CHECK`, `CHECK_EQ`, `CHECK_NEAR` and `CHECK_THROWS`, with GoogleTest-style output. Each track's project folder has its own copy.

```cpp file=testing/studio_test.hpp provided
// studio_test.hpp — a deliberately tiny unit-test framework.
//
// It is small enough to read in one sitting (do!), and it prints results in the
// same format as GoogleTest, which you will switch to in a later track.
//
//   TEST(adds_two_numbers) {
//       CHECK_EQ(add(2, 3), 5);
//   }
//
// Macros: CHECK(cond), CHECK_EQ(a, b), CHECK_NE(a, b), CHECK_NEAR(a, b, tolerance),
//         CHECK_THROWS(expression, ExceptionType)
#pragma once

#include <cmath>
#include <exception>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

namespace studio_test {

struct TestCase {
    const char* name;
    void (*body)();
};

// A function-local static is created the first time it is used, which makes it
// safe to register tests from static objects in any translation unit.
inline std::vector<TestCase>& registry()
{
    static std::vector<TestCase> tests;
    return tests;
}

struct Registrar {
    Registrar(const char* name, void (*body)()) { registry().push_back({name, body}); }
};

// Thrown by a failing CHECK; caught by run_all().
struct Failure {
    std::string message;
};

template <typename T>
std::string show(const T& value)
{
    std::ostringstream out;
    out << value;
    return out.str();
}

inline std::string location(const char* file, int line)
{
    return std::string(file) + ":" + std::to_string(line) + ": ";
}

inline int run_all()
{
    auto& tests = registry();
    int failed = 0;
    std::cout << "[==========] Running " << tests.size() << " tests\n";
    for (const auto& test : tests) {
        // std::endl flushes: if this test crashes the program, the output
        // still shows which test was running.
        std::cout << "[ RUN      ] " << test.name << std::endl;
        try {
            test.body();
            std::cout << "[       OK ] " << test.name << '\n';
        } catch (const Failure& f) {
            ++failed;
            std::cout << f.message << '\n' << "[  FAILED  ] " << test.name << '\n';
        } catch (const std::exception& e) {
            ++failed;
            std::cout << "unexpected exception: " << e.what() << '\n' << "[  FAILED  ] " << test.name << '\n';
        } catch (...) {
            ++failed;
            std::cout << "unexpected non-standard exception\n" << "[  FAILED  ] " << test.name << '\n';
        }
    }
    std::cout << "[==========] " << tests.size() << " tests ran, " << (tests.size() - failed) << " passed, " << failed
              << " failed\n";
    return failed == 0 ? 0 : 1;
}

} // namespace studio_test

#define STUDIO_TEST_CONCAT2(a, b) a##b
#define STUDIO_TEST_CONCAT(a, b) STUDIO_TEST_CONCAT2(a, b)

#define TEST(name)                                                                                                   \
    static void STUDIO_TEST_CONCAT(name, _body)();                                                                   \
    static const studio_test::Registrar STUDIO_TEST_CONCAT(name, _registrar)(#name, &STUDIO_TEST_CONCAT(name, _body)); \
    static void STUDIO_TEST_CONCAT(name, _body)()

#define CHECK(cond)                                                                                     \
    do {                                                                                                \
        if (!(cond))                                                                                    \
            throw studio_test::Failure{studio_test::location(__FILE__, __LINE__) + "CHECK(" #cond ") failed"}; \
    } while (false)

#define STUDIO_TEST_BINARY(a, b, op, name)                                                                     \
    do {                                                                                                     \
        const auto& studio_left = (a);                                                                       \
        const auto& studio_right = (b);                                                                      \
        if (!(studio_left op studio_right))                                                                  \
            throw studio_test::Failure{studio_test::location(__FILE__, __LINE__) + name "(" #a ", " #b ") failed\n" \
                                       "    left:  " + studio_test::show(studio_left) + "\n"                \
                                       "    right: " + studio_test::show(studio_right)};                    \
    } while (false)

#define CHECK_EQ(a, b) STUDIO_TEST_BINARY(a, b, ==, "CHECK_EQ")
#define CHECK_NE(a, b) STUDIO_TEST_BINARY(a, b, !=, "CHECK_NE")

#define CHECK_NEAR(a, b, tolerance)                                                                              \
    do {                                                                                                       \
        const double studio_left = (a);                                                                        \
        const double studio_right = (b);                                                                       \
        if (!(std::fabs(studio_left - studio_right) <= (tolerance)))                                           \
            throw studio_test::Failure{studio_test::location(__FILE__, __LINE__) + "CHECK_NEAR(" #a ", " #b ") failed\n" \
                                       "    left:  " + studio_test::show(studio_left) + "\n"                  \
                                       "    right: " + studio_test::show(studio_right)};                      \
    } while (false)

#define CHECK_THROWS(expression, ExceptionType)                                                                 \
    do {                                                                                                      \
        bool studio_threw = false;                                                                            \
        try {                                                                                                 \
            (void)(expression);                                                                               \
        } catch (const ExceptionType&) {                                                                      \
            studio_threw = true;                                                                              \
        }                                                                                                     \
        if (!studio_threw)                                                                                    \
            throw studio_test::Failure{studio_test::location(__FILE__, __LINE__) + "CHECK_THROWS(" #expression \
                                       ", " #ExceptionType ") failed: nothing was thrown"};                   \
    } while (false)
```

```check
file testing/studio_test.hpp
```

## Step 2 — The test runner

**This step: create the supplied `testing/test_main.cpp`.**

The test program's `main`: it runs every registered test and exits with `0` only if all of them passed.

```cpp file=testing/test_main.cpp provided
// The test program's entry point. Every TEST(...) in the other test files has
// already registered itself by the time main() runs.
#include "studio_test.hpp"

int main()
{
    return studio_test::run_all();
}
```

```check
file testing/test_main.cpp
```

## Step 3 — The project's build file

**This step: create the supplied `engine/CMakeLists.txt` and read it.**

It's the same shape as *Graphics from First Principles*:

- The engine is **header-only**: every function is `inline` in a `.h` file, so there's no library to link.
- **Every `apps/NAME.cpp` becomes a program called `NAME`.** Add a file to `apps/` and the next `cmake --build` builds it.
- Every `tests/*_test.cpp` becomes part of one test program, `engine_tests`.
- The build is **Release** (optimised), because lessons 4 and 5 measure speed.

### Why the floating-point flag

A simulation is thousands of floating-point steps, each rounded. `-ffp-contract=off` stops the compiler fusing `a * b + c` into one instruction that rounds once instead of twice. With it, every compiler and CPU rounds the same way, so a test can say "after 3000 updates the ball is *exactly* here", and a replay recorded on one machine plays the same on another. Real engines that need this (networked games, replays) are just as careful.

```cmake file=engine/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(engine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Optimised, but never with -ffast-math: that lets the compiler reorder
# floating-point maths, so two builds would simulate slightly
# different worlds.
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

if(MSVC)
    add_compile_options(/W4)
else()
    # -ffp-contract=off: no fused multiply-add, so every compiler and
    # CPU rounds a * b + c the same way.
    add_compile_options(-Wall -Wextra -Wpedantic -ffp-contract=off)
endif()

# The library is header-only: these folders are searched for #include.
include_directories(. ../testing)

# Every apps/NAME.cpp becomes a program called NAME.
file(GLOB APP_SOURCES CONFIGURE_DEPENDS apps/*.cpp)
foreach(source ${APP_SOURCES})
    get_filename_component(name ${source} NAME_WE)
    add_executable(${name} ${source})
endforeach()

# Every tests/*_test.cpp file becomes part of the test program.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(engine_tests ../testing/test_main.cpp ${TEST_SOURCES})
```

```check
file engine/CMakeLists.txt
```

## Step 4 — A ball and a fake clock

**This step: create `engine/loop.h` with `Ball`, `update` and `FakeClock`. Then configure and build.**

### The simplest loop

Every game loop looks like this underneath:

```cpp
while (running) {
    read_input();
    update(world, dt);   // move the simulation forward
    render(world);       // draw what it looks like now
}
```

**`update` and `render` are separate on purpose.** `update` changes the world and never draws; `render` draws and never changes anything. That split is what lets this whole track test a game without a window: tests call `update` and look at the numbers.

`dt` ("delta time") is how much game time one update covers, in seconds. The question this lesson answers is: **where does `dt` come from?**

### The pieces

- `Ball`: a height `y` and an upward speed `vy`, in metres and metres per second.
- `update(ball, dt)`: gravity changes the speed, then the speed changes the height. This is **semi-implicit Euler**, the integrator most games use: cheap, and stable enough.

```cpp
b.vy += gravity * dt;   // gravity = -9.8 m/s²
b.y  += b.vy * dt;
```

- `FakeClock`: a test needs time it controls. A real clock (`std::chrono::steady_clock`) gives different frame times on every run; the fake one says frame `k` happens at exactly `k / fps` seconds, counted in **whole microseconds** in a `std::int64_t`. Integers add up exactly; `0.1 + 0.2` in `double` doesn't quite make `0.3`.

`frame_ * 1'000'000 / fps_` multiplies first, then divides, so the rounding never builds up: frame 144 at 144 fps is exactly 1,000,000 µs.

```text
cmake -S engine -B engine/build -G "MinGW Makefiles"     (Windows)
cmake -S engine -B engine/build                          (macOS, Linux)
```

```text
cmake --build engine/build
```

There are no programs or tests yet; the build just proves the project is set up.

```cpp file=engine/loop.h
// loop.h — the timing of a game loop: a ball and a fake clock.
#pragma once

#include <algorithm>
#include <cstdint>

// A ball thrown straight up. Units: metres and seconds.
struct Ball {
    double y = 0.0;   // height
    double vy = 0.0;  // upward speed
};

inline constexpr double gravity = -9.8;

// Advances the ball by dt seconds (semi-implicit Euler).
inline void update(Ball& b, double dt)
{
    b.vy += gravity * dt;
    b.y += b.vy * dt;
}

// A clock for tests: frame k happens at exactly k / fps seconds,
// counted in whole microseconds.
class FakeClock {
public:
    explicit FakeClock(int fps) : fps_(fps) {}
    std::int64_t now_us() const { return frame_ * 1'000'000 / fps_; }
    void next_frame() { ++frame_; }

private:
    std::int64_t fps_;
    std::int64_t frame_ = 0;
};
```

```check
file engine/build/CMakeCache.txt label="engine/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build engine/build"
contains engine/loop.h "class FakeClock"
```

## Step 5 — Variable dt: the obvious loop

**This step: create the supplied `engine/apps/rates.cpp` and read it. Build and run it.**

The obvious answer to "where does `dt` come from?" is: from the clock. Measure how long the last frame took, and update by that much. This is a **variable timestep**, and `variable_dt` simulates it: a ball thrown up at 20 m/s, for 2 seconds of frames.

The exact answer from physics is `y = v·t + ½·g·t² = 40 − 19.6 = 20.4 m`.

**Predict:** the program runs the same 2 seconds on a 30 fps machine and on a 144 fps machine. Will the ball end at the same height?

```text
cmake --build engine/build
./engine/build/rates
```

```cpp file=engine/apps/rates.cpp provided
// rates.cpp — the same throw, simulated at two frame rates.
#include "loop.h"

#include <cstdio>

// Variable dt: one update per frame, by however long the frame took.
double variable_dt(int fps)
{
    FakeClock clock(fps);
    Ball ball{0.0, 20.0};
    std::int64_t last = clock.now_us();
    while (clock.now_us() < 2'000'000) {
        clock.next_frame();
        std::int64_t now = clock.now_us();
        update(ball, (now - last) / 1e6);
        last = now;
    }
    return ball.y;
}

int main()
{
    std::printf("Thrown up at 20 m/s; height after 2 s.\n");
    std::printf("Exact answer: 20.400 m\n\n");
    for (int fps : {30, 144})
        std::printf("variable dt, %3d fps: y = %.3f m\n", fps,
                    variable_dt(fps));
}
```

### What happened

```text
variable dt,  30 fps: y = 20.073 m
variable dt, 144 fps: y = 20.332 m
```

Same game, same 2 seconds, **different worlds**: a third of a metre apart. Neither is 20.4.

Each Euler step pretends the speed was constant for the whole `dt`. The error per step grows with `dt`, so a slow machine (big `dt`) is less accurate than a fast one. In a game this means:

- a jump is higher on a fast PC, so a ledge is reachable there and not on a laptop;
- a recorded replay (just the inputs) plays differently on another machine;
- two networked players' simulations drift apart;
- a long hitch (a 2-second `dt` while a level loads) teleports objects through walls.

```check
run "cmake --build engine/build"
run "./engine/build/rates" stdout="variable dt,  30 fps: y = 20.073 m" label="30 fps ends at 20.073 m"
run "./engine/build/rates" stdout="variable dt, 144 fps: y = 20.332 m" label="144 fps ends at 20.332 m"
```

## Step 6 — The specification of a fixed timestep

**This step: create the supplied `engine/tests/timestep_test.cpp` and read it.**

The fix is to **decouple simulation time from frame time**. The simulation always steps by the same small `dt` (here 10 ms: 100 updates per second). Each frame, the real time that passed goes into an **accumulator**; the loop runs as many whole steps as fit and keeps the remainder for next frame.

```text
step = 10 ms         acc before  +frame   steps   acc after
frame 1 (4 ms)            0         4       0        4
frame 2 (4 ms)            4         8       0        8
frame 3 (4 ms)            8        12       1        2
frame 4 (25 ms)           2        27       2        7
```

Fast machines run 0 or 1 steps per frame, slow ones several, and both run **the same steps**.

Read the tests for the rest of the design:

- **`a_long_frame_is_clamped`:** if a frame took 3 seconds (a debugger breakpoint, a laptop waking up), catching up would take 300 steps, which take time, which makes the next frame long... the **spiral of death**. So a frame counts as at most 250 ms; the game slows down instead of freezing.
- **`alpha()`** is how far "now" is between the last update and the next, from 0 to 1. It's for rendering: see the next step.
- The last test is the promise: at 30, 60 or 144 fps, the ball ends at **exactly** the same height, compared with `CHECK_EQ`, not `CHECK_NEAR`.

```cpp file=engine/tests/timestep_test.cpp provided
// timestep_test.cpp — the specification of FixedTimestep.
#include "loop.h"
#include "studio_test.hpp"

TEST(fake_clock_frames_add_up_exactly)
{
    FakeClock clock(144);
    for (int i = 0; i < 144; ++i)
        clock.next_frame();
    CHECK_EQ(clock.now_us(), 1'000'000);
}

TEST(a_short_frame_runs_no_update_yet)
{
    FixedTimestep t(10'000);
    CHECK_EQ(t.add_frame(4'000), 0);
    CHECK_EQ(t.add_frame(4'000), 0);
    CHECK_EQ(t.add_frame(4'000), 1);  // 12 ms in total
}

TEST(leftover_time_carries_to_the_next_frame)
{
    FixedTimestep t(10'000);
    CHECK_EQ(t.add_frame(25'000), 2);
    CHECK_NEAR(t.alpha(), 0.5, 1e-12);  // 5 ms of 10 left over
    CHECK_EQ(t.add_frame(5'000), 1);
    CHECK_NEAR(t.alpha(), 0.0, 1e-12);
}

TEST(a_long_frame_is_clamped)
{
    FixedTimestep t(10'000, 250'000);
    CHECK_EQ(t.add_frame(3'000'000), 25);  // not 300
}

TEST(dt_is_the_step_in_seconds)
{
    FixedTimestep t(10'000);
    CHECK_NEAR(t.dt(), 0.01, 1e-15);
}

TEST(lerp_blends_two_states)
{
    CHECK_NEAR(lerp(10.0, 20.0, 0.0), 10.0, 1e-12);
    CHECK_NEAR(lerp(10.0, 20.0, 0.25), 12.5, 1e-12);
    CHECK_NEAR(lerp(10.0, 20.0, 1.0), 20.0, 1e-12);
}

// The point of it all: the same updates at any frame rate.
static double fixed_height(int fps)
{
    FakeClock clock(fps);
    FixedTimestep t(10'000);
    Ball ball{0.0, 20.0};
    std::int64_t last = 0;
    while (clock.now_us() < 1'000'000) {
        clock.next_frame();
        for (int n = t.add_frame(clock.now_us() - last); n > 0; --n)
            update(ball, t.dt());
        last = clock.now_us();
    }
    return ball.y;
}

TEST(fixed_steps_give_the_same_result_at_any_frame_rate)
{
    CHECK_EQ(fixed_height(30), fixed_height(144));
    CHECK_EQ(fixed_height(60), fixed_height(144));
}
```

```check
file engine/tests/timestep_test.cpp
```

## Step 7 — FixedTimestep

**This step: add `FixedTimestep` and `lerp` to `engine/loop.h`. Build and run the tests.**

```cpp
class FixedTimestep {
public:
    explicit FixedTimestep(std::int64_t step_us,
                           std::int64_t max_frame_us = 250'000);
    int add_frame(std::int64_t frame_us);  // updates to run now
    double dt() const;     // the step, in seconds
    double alpha() const;  // leftover / step, from 0 to 1
private:
    std::int64_t step_us_, max_frame_us_, acc_us_ = 0;
};
```

- `add_frame` adds `std::min(frame_us, max_frame_us_)` to the accumulator, then takes out whole steps in a loop, counting them. The leftover **stays** in the accumulator.
- Everything is in integer microseconds, so the leftover is exact, frame after frame. Only `dt()` and `alpha()` turn time into `double`.
- `lerp(a, b, t)` returns `a + (b - a) * t`.

### Interpolation: why `alpha` exists

With 100 updates a second and a 144 Hz screen, most frames fall *between* two updates. Drawing the latest state makes motion stutter: some frames show the same position twice. So the loop keeps the **previous** state too, and render draws a blend:

```cpp
for (int i = 0; i < steps; ++i) {
    previous = ball;
    update(ball, timestep.dt());
}
render(lerp(previous.y, ball.y, timestep.alpha()));
```

The picture lags up to one step (10 ms) behind the simulation, which nobody notices, and moves smoothly at any frame rate. The simulation itself never sees `alpha`: rendering reads the world, never changes it.

```text
cmake --build engine/build
./engine/build/engine_tests
```

```cpp file=engine/loop.h
// loop.h — the timing of a game loop: a ball, a fake clock, and a
// fixed timestep with an accumulator.
#pragma once

#include <algorithm>
#include <cstdint>

// A ball thrown straight up. Units: metres and seconds.
struct Ball {
    double y = 0.0;   // height
    double vy = 0.0;  // upward speed
};

inline constexpr double gravity = -9.8;

// Advances the ball by dt seconds (semi-implicit Euler).
inline void update(Ball& b, double dt)
{
    b.vy += gravity * dt;
    b.y += b.vy * dt;
}

// A clock for tests: frame k happens at exactly k / fps seconds,
// counted in whole microseconds.
class FakeClock {
public:
    explicit FakeClock(int fps) : fps_(fps) {}
    std::int64_t now_us() const { return frame_ * 1'000'000 / fps_; }
    void next_frame() { ++frame_; }

private:
    std::int64_t fps_;
    std::int64_t frame_ = 0;
};

// Turns real frame times into a whole number of fixed-size updates.
class FixedTimestep {
public:
    explicit FixedTimestep(std::int64_t step_us,
                           std::int64_t max_frame_us = 250'000)
        : step_us_(step_us), max_frame_us_(max_frame_us) {}

    // Adds one frame's time; returns how many updates to run now.
    int add_frame(std::int64_t frame_us)
    {
        acc_us_ += std::min(frame_us, max_frame_us_);
        int steps = 0;
        while (acc_us_ >= step_us_) {
            acc_us_ -= step_us_;
            ++steps;
        }
        return steps;
    }

    // The step in seconds: the dt every update gets.
    double dt() const { return step_us_ / 1e6; }

    // How far between the last two updates "now" is, from 0 to 1.
    double alpha() const
    {
        return static_cast<double>(acc_us_) / step_us_;
    }

private:
    std::int64_t step_us_;
    std::int64_t max_frame_us_;
    std::int64_t acc_us_ = 0;
};

// Blends two states: t = 0 gives a, t = 1 gives b.
inline double lerp(double a, double b, double t)
{
    return a + (b - a) * t;
}
```

```check
run "cmake --build engine/build"
tests "./engine/build/engine_tests" require="fake_clock_frames_add_up_exactly a_short_frame_runs_no_update_yet leftover_time_carries_to_the_next_frame a_long_frame_is_clamped dt_is_the_step_in_seconds lerp_blends_two_states fixed_steps_give_the_same_result_at_any_frame_rate" -- Keep the leftover in the accumulator (subtract a step at a time), and clamp each frame to max_frame_us.
```

## Step 8 — The same throw, at a fixed step

**This step: add `fixed_dt` to `engine/apps/rates.cpp`, and print its result at both frame rates. Build and run it.**

`fixed_dt(fps)` is the loop from the last step, driven by the same fake clock:

- a `FixedTimestep timestep(10'000)`, a `Ball` and a `previous` copy;
- each frame: `add_frame(now - last)`, then that many `update(ball, timestep.dt())` calls, saving `previous` before each;
- where rendering would happen, compute the blended height (and, with no screen, `(void)` it to say it's unused on purpose).

Print both frame rates after the variable-dt lines, in the same format with `fixed dt,    ` at the start.

**Predict:** what will the two new lines say? Will either be 20.400?

```text
cmake --build engine/build
./engine/build/rates
```

```cpp file=engine/apps/rates.cpp
// rates.cpp — the same throw, simulated at two frame rates.
#include "loop.h"

#include <cstdio>

// Variable dt: one update per frame, by however long the frame took.
double variable_dt(int fps)
{
    FakeClock clock(fps);
    Ball ball{0.0, 20.0};
    std::int64_t last = clock.now_us();
    while (clock.now_us() < 2'000'000) {
        clock.next_frame();
        std::int64_t now = clock.now_us();
        update(ball, (now - last) / 1e6);
        last = now;
    }
    return ball.y;
}

// Fixed dt: as many 10 ms updates as the frames' time adds up to.
double fixed_dt(int fps)
{
    FakeClock clock(fps);
    FixedTimestep timestep(10'000);
    Ball ball{0.0, 20.0};
    Ball previous = ball;
    std::int64_t last = clock.now_us();
    while (clock.now_us() < 2'000'000) {
        clock.next_frame();
        std::int64_t now = clock.now_us();
        int steps = timestep.add_frame(now - last);
        last = now;
        for (int i = 0; i < steps; ++i) {
            previous = ball;
            update(ball, timestep.dt());
        }
        // Rendering would draw the ball here, between two states:
        double drawn = lerp(previous.y, ball.y, timestep.alpha());
        (void)drawn;
    }
    return ball.y;
}

int main()
{
    std::printf("Thrown up at 20 m/s; height after 2 s.\n");
    std::printf("Exact answer: 20.400 m\n\n");
    for (int fps : {30, 144})
        std::printf("variable dt, %3d fps: y = %.3f m\n", fps,
                    variable_dt(fps));
    for (int fps : {30, 144})
        std::printf("fixed dt,    %3d fps: y = %.3f m\n", fps,
                    fixed_dt(fps));
}
```

### What happened

```text
fixed dt,     30 fps: y = 20.302 m
fixed dt,    144 fps: y = 20.302 m
```

Identical, to the last bit: both machines ran 200 updates of exactly 0.01 s. It still isn't 20.4, because Euler at 10 ms still has error, but it's **the same error everywhere**, which is what a game needs. A designer tunes the jump once; replays and network play stay in sync.

| | Variable dt | Fixed dt + accumulator |
|---|---|---|
| same result on every machine | no | yes |
| simple | yes | a little more code |
| smooth drawing | yes | needs interpolation |
| survives a long hitch | no | yes, with the clamp |

Engines like Unity (`FixedUpdate`) and Unreal's physics work this way. Glenn Fiedler's article *Fix Your Timestep!* is the classic write-up.

```check
run "cmake --build engine/build"
run "./engine/build/rates" stdout="fixed dt,     30 fps: y = 20.302 m" label="fixed dt at 30 fps"
run "./engine/build/rates" stdout="fixed dt,    144 fps: y = 20.302 m" label="fixed dt at 144 fps" -- Run timestep.dt() updates as add_frame says, with FixedTimestep timestep(10'000).
```
