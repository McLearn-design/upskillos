---
title: 5 — Profiling: Finding the Hot System
track: Games and Engines
runtime: cpp
reference: optional
console: true
---

A game at 60 fps has **16.7 ms** per frame for everything: input, simulation, audio, rendering. When it drops frames, the first question is never "how do I make this faster?" but **"where does the time go?"** Guessing is reliably wrong. A **profiler** measures.

There are two kinds:

| Kind | How | Examples |
|---|---|---|
| **sampling** | interrupts the program thousands of times a second and records which function is running | `perf` (Linux), Instruments (macOS), the Visual Studio profiler, VTune |
| **instrumenting** | code you add marks the start and end of interesting regions | Tracy, Unreal Insights, Chrome's tracing, what you'll build |

A sampler needs no code changes and sees everything, but in a game everything blurs together: which *frame* was slow? An instrumented profiler shows the timeline, frame by frame, named the way your engine thinks ("physics", "AI"). Engines use both; this lesson builds the second.

## Step 1 — The specification of the profiler

**This step: create the supplied `engine/tests/profiler_test.cpp` and read it.**

### A timer that can't be forgotten

The obvious way to time something:

```cpp
auto start = now();
physics(world);
record("physics", start, now() - start);
```

breaks as soon as the region has an early `return` or throws: the `record` never happens. You know the fix from *Memory and Ownership*: **RAII**. A `ScopedTimer`'s constructor reads the clock; its destructor records the event. The destructor runs however the scope ends, so the timer always stops.

```cpp
{
    PROFILE_SCOPE(profiler, "physics");
    physics(world);
}   // ← recorded here
```

### Testing time without depending on time

Real durations change on every run, so a test can't check them. The `Profiler` takes its **clock as a parameter**: a function returning microseconds. Games pass the real one (the default); the tests pass a lambda reading a variable they set by hand, so every start and duration is exact. It's lesson 1's fake clock again: **inject what you can't control**.

### The Chrome trace format

The output is JSON in the **Trace Event Format**, which `chrome://tracing` (in Chrome or Edge) and **Perfetto** (`ui.perfetto.dev`, any browser) both open. Each timed scope is one "complete" event:

```text
{"name":"render","ph":"X","ts":10,"dur":15,"pid":1,"tid":1}
```

| Key | Means |
|---|---|
| `ph` | phase: `"X"` is a complete event (start and duration) |
| `ts`, `dur` | start and duration, in **microseconds** |
| `pid`, `tid` | process and thread: one row per thread in the viewer |

Events go into a `traceEvents` array. The test with the exact string pins down this track's layout, one event per line.

```cpp file=engine/tests/profiler_test.cpp provided
// profiler_test.cpp — the specification of the profiler. A fake
// clock makes every duration exact.
#include "profiler.h"
#include "studio_test.hpp"

#include <sstream>
#include <stdexcept>

TEST(a_scoped_timer_records_when_its_scope_ends)
{
    std::int64_t t = 100;
    Profiler p([&t] { return t; });
    {
        ScopedTimer timer(p, "physics");
        t = 130;
        CHECK_EQ(p.events().size(), std::size_t{0});  // still running
    }
    CHECK_EQ(p.events().size(), std::size_t{1});
    CHECK_EQ(p.events()[0].name, std::string("physics"));
    CHECK_EQ(p.events()[0].start_us, std::int64_t{100});
    CHECK_EQ(p.events()[0].duration_us, std::int64_t{30});
}

TEST(nested_scopes_record_the_inner_one_first)
{
    std::int64_t t = 0;
    Profiler p([&t] { return t; });
    {
        PROFILE_SCOPE(p, "frame");
        t = 10;
        {
            PROFILE_SCOPE(p, "render");
            t = 25;
        }
        t = 40;
    }
    CHECK_EQ(p.events().size(), std::size_t{2});
    CHECK_EQ(p.events()[0].name, std::string("render"));
    CHECK_EQ(p.events()[0].duration_us, std::int64_t{15});
    CHECK_EQ(p.events()[1].name, std::string("frame"));
    CHECK_EQ(p.events()[1].duration_us, std::int64_t{40});
}

TEST(an_exception_still_ends_the_timer)
{
    std::int64_t t = 0;
    Profiler p([&t] { return t; });
    try {
        PROFILE_SCOPE(p, "load");
        t = 7;
        throw std::runtime_error("missing file");
    } catch (const std::runtime_error&) {
    }
    CHECK_EQ(p.events().size(), std::size_t{1});
    CHECK_EQ(p.events()[0].duration_us, std::int64_t{7});
}

TEST(total_adds_up_every_scope_with_a_name)
{
    Profiler p([] { return std::int64_t{0}; });
    p.record("ai", 0, 5);
    p.record("physics", 5, 20);
    p.record("ai", 25, 6);
    CHECK_EQ(p.total_us("ai"), std::int64_t{11});
    CHECK_EQ(p.total_us("audio"), std::int64_t{0});
}

TEST(chrome_json_has_one_complete_event_per_scope)
{
    Profiler p([] { return std::int64_t{0}; });
    p.record("render", 10, 15);
    p.record("frame", 0, 40);
    std::ostringstream out;
    p.write_chrome_json(out);
    CHECK_EQ(out.str(), std::string(
        "{\"traceEvents\":[\n"
        "{\"name\":\"render\",\"ph\":\"X\",\"ts\":10,\"dur\":15,"
        "\"pid\":1,\"tid\":1},\n"
        "{\"name\":\"frame\",\"ph\":\"X\",\"ts\":0,\"dur\":40,"
        "\"pid\":1,\"tid\":1}\n"
        "]}\n"));
}

TEST(names_are_escaped_in_json)
{
    Profiler p([] { return std::int64_t{0}; });
    p.record("say \"hi\" \\ bye", 0, 1);
    std::ostringstream out;
    p.write_chrome_json(out);
    CHECK(out.str().find("\"name\":\"say \\\"hi\\\" \\\\ bye\"") !=
          std::string::npos);
}

TEST(an_empty_profile_is_still_valid_json)
{
    Profiler p;
    std::ostringstream out;
    p.write_chrome_json(out);
    CHECK_EQ(out.str(), std::string("{\"traceEvents\":[\n]}\n"));
}
```

```check
file engine/tests/profiler_test.cpp
```

## Step 2 — Profiler and ScopedTimer

**This step: create `engine/profiler.h` with `TraceEvent`, `steady_now_us`, `Profiler`, `ScopedTimer` and the `PROFILE_SCOPE` macro. Build and run the tests.**

- `TraceEvent`: `name`, `start_us`, `duration_us`.
- `steady_now_us()`: `std::chrono::steady_clock` (never `system_clock`, which jumps when the computer's clock is corrected), converted with `duration_cast<microseconds>`.
- `Profiler`: `using Clock = std::function<std::int64_t()>;`, a constructor taking one (default `steady_now_us`), `now()`, `record(name, start, duration)`, `events()`, `total_us(name)` and `write_chrome_json(std::ostream&)`.
- JSON: `{"traceEvents":[`, then each event on its own line, separated by `,` + newline, then a newline and `]}` + newline. Exactly the strings in the tests.
- **Escape names.** A `"` or `\` inside a name would end the JSON string early and break the whole file; put a `\` before each.
- `ScopedTimer` stores a reference to the profiler, the name and the start time. Delete its copy operations: a copied timer would record twice.

### The macro

`PROFILE_SCOPE(p, "physics")` must declare a variable with a **unique name**, or two scopes in one block would clash. `__LINE__` gives the line number, but `profile_scope_##__LINE__` pastes the *word* `__LINE__`, because `##` happens before macros inside it expand. The standard trick is one extra level, which expands `__LINE__` first:

```cpp
#define PROFILE_JOIN2(a, b) a##b
#define PROFILE_JOIN(a, b) PROFILE_JOIN2(a, b)
#define PROFILE_SCOPE(profiler, name) \
    ScopedTimer PROFILE_JOIN(profile_scope_, __LINE__)(profiler, name)
```

```text
cmake --build engine/build
./engine/build/engine_tests
```

```cpp file=engine/profiler.h
// profiler.h — RAII scope timers, saved as a Chrome trace.
#pragma once

#include <chrono>
#include <cstdint>
#include <functional>
#include <ostream>
#include <string>
#include <utility>
#include <vector>

// One timed scope: when it started and how long it took.
struct TraceEvent {
    std::string name;
    std::int64_t start_us;
    std::int64_t duration_us;
};

inline std::int64_t steady_now_us()
{
    using namespace std::chrono;
    return duration_cast<microseconds>(
               steady_clock::now().time_since_epoch())
        .count();
}

class Profiler {
public:
    using Clock = std::function<std::int64_t()>;

    // Tests pass a fake clock; games use the real one.
    explicit Profiler(Clock clock = steady_now_us)
        : clock_(std::move(clock)) {}

    std::int64_t now() const { return clock_(); }

    void record(std::string name, std::int64_t start,
                std::int64_t duration)
    {
        events_.push_back({std::move(name), start, duration});
    }

    const std::vector<TraceEvent>& events() const { return events_; }

    // All the time spent in scopes with this name.
    std::int64_t total_us(const std::string& name) const
    {
        std::int64_t sum = 0;
        for (const auto& e : events_)
            if (e.name == name)
                sum += e.duration_us;
        return sum;
    }

    // The Trace Event Format that chrome://tracing and Perfetto read.
    void write_chrome_json(std::ostream& out) const
    {
        out << "{\"traceEvents\":[";
        for (std::size_t i = 0; i < events_.size(); ++i) {
            const auto& e = events_[i];
            out << (i ? ",\n" : "\n") << "{\"name\":\""
                << escaped(e.name) << "\",\"ph\":\"X\",\"ts\":"
                << e.start_us << ",\"dur\":" << e.duration_us
                << ",\"pid\":1,\"tid\":1}";
        }
        out << "\n]}\n";
    }

private:
    static std::string escaped(const std::string& s)
    {
        std::string out;
        for (char c : s) {
            if (c == '"' || c == '\\')
                out += '\\';
            out += c;
        }
        return out;
    }

    Clock clock_;
    std::vector<TraceEvent> events_;
};

// Times its own lifetime: from construction to the end of the scope,
// however the scope ends (return, break, exception).
class ScopedTimer {
public:
    ScopedTimer(Profiler& profiler, std::string name)
        : profiler_(profiler), name_(std::move(name)),
          start_(profiler.now()) {}

    ~ScopedTimer()
    {
        profiler_.record(std::move(name_), start_,
                         profiler_.now() - start_);
    }

    ScopedTimer(const ScopedTimer&) = delete;
    ScopedTimer& operator=(const ScopedTimer&) = delete;

private:
    Profiler& profiler_;
    std::string name_;
    std::int64_t start_;
};

// PROFILE_SCOPE(p, "physics"); times the rest of the enclosing block.
// The two-step join makes a unique variable name from the line number.
#define PROFILE_JOIN2(a, b) a##b
#define PROFILE_JOIN(a, b) PROFILE_JOIN2(a, b)
#define PROFILE_SCOPE(profiler, name) \
    ScopedTimer PROFILE_JOIN(profile_scope_, __LINE__)(profiler, name)
```

```check
run "cmake --build engine/build"
tests "./engine/build/engine_tests" require="a_scoped_timer_records_when_its_scope_ends nested_scopes_record_the_inner_one_first an_exception_still_ends_the_timer total_adds_up_every_scope_with_a_name chrome_json_has_one_complete_event_per_scope names_are_escaped_in_json an_empty_profile_is_still_valid_json" -- Record in the destructor, and escape " and \ in names.
```

## Step 3 — Profile a frame

**This step: create the supplied `engine/apps/profiled_game.cpp`. Build it, run it, and open `trace.json` in a trace viewer.**

It builds lesson 2's world with 2,000 moving boxes (half of them sparks that burn out), runs 60 frames, and times each frame and each system. Then it prints each system's total and writes `trace.json` into the track folder.

**Predict:** which of the three systems takes the most time? By how much?

```text
cmake --build engine/build
./engine/build/profiled_game
```

### Viewing the trace

1. Open **ui.perfetto.dev** in any browser, choose **Open trace file**, and pick `trace.json` from the track folder. (Or type `chrome://tracing` into Chrome or Edge, and **Load** it.) Nothing is uploaded: Perfetto runs in the page.
2. Zoom with **W**/**S** (or Ctrl + mouse wheel) and pan with **A**/**D**.
3. Each frame is a bar, with its systems nested underneath. Click a bar to see its exact duration; select a range to get totals per name.

```cpp file=engine/apps/profiled_game.cpp provided
// profiled_game.cpp — a busy world, every system timed.
#include "particles.h"  // for Rng
#include "profiler.h"
#include "systems.h"

#include <cstdio>
#include <fstream>

// 2,000 boxes scattered over a 1000 x 1000 field; half of them
// are sparks that burn out.
World make_world()
{
    World w;
    Rng rng{1};
    for (int i = 0; i < 2000; ++i) {
        Entity e = w.create();
        w.positions.add(e, {rng.next() * 1000, rng.next() * 1000});
        w.velocities.add(e, {rng.next() * 40 - 20,
                             rng.next() * 40 - 20});
        w.sizes.add(e, {4, 4});
        if (i % 2)
            w.lifetimes.add(e, {rng.next() * 2});
    }
    return w;
}

int main()
{
    Profiler profiler;
    World world = make_world();
    std::size_t hits = 0;

    for (int frame = 0; frame < 60; ++frame) {
        PROFILE_SCOPE(profiler, "frame");
        {
            PROFILE_SCOPE(profiler, "movement");
            movement(world, 1.0f / 60);
        }
        {
            PROFILE_SCOPE(profiler, "lifetime");
            lifetime(world, 1.0f / 60);
        }
        {
            PROFILE_SCOPE(profiler, "collisions");
            hits += collisions(world).size();
        }
    }

    std::printf("entities left: %zu, collisions seen: %zu\n",
                world.count(), hits);
    for (const char* name : {"movement", "lifetime", "collisions"})
        std::printf("%-10s %8.2f ms\n", name,
                    profiler.total_us(name) / 1000.0);

    std::ofstream out("trace.json");
    profiler.write_chrome_json(out);
    std::printf("wrote trace.json (%zu events)\n",
                profiler.events().size());
}
```

### What happened

On a test machine:

```text
movement      11.78 ms
lifetime       1.47 ms
collisions   329.31 ms
```

Collisions is **25 times** the rest put together. In the viewer every frame is almost entirely `collisions`, with `movement` a sliver at the start. That's the **hot system**, and the reason is visible in the code, now that we know where to look: it tests every pair, `2000 × 1999 / 2 ≈ 2,000,000` tests a frame, while movement does 2,000 updates.

Optimising `movement` (lesson 4's SoA would help it) would save at most 12 ms of 340. **Always profile first**: the slow part is rarely where you'd guess.

### A sampling profiler, for comparison

On Linux, `perf record ./engine/build/profiled_game` then `perf report` shows the same answer by function, with no code changes. On Windows, Visual Studio's **Debug → Performance Profiler → CPU Usage** does the same; on macOS, Instruments' **Time Profiler**. They're the tools to reach for when you don't yet know which region to instrument.

```check
run "cmake --build engine/build"
run "./engine/build/profiled_game" stdout="wrote trace.json (240 events)" label="60 frames × 4 scopes recorded"
contains trace.json "{\"traceEvents\":[" label="trace.json is a Chrome trace"
contains trace.json "{\"name\":\"collisions\",\"ph\":\"X\"" label="trace.json has the collisions scopes"
```

## Step 4 — A reviewer's tests for a faster collision system

**This step: create the supplied `engine/tests/grid_review_test.cpp` and read it.**

The profile says collisions are the problem, and why: most of those two million tests compare boxes on opposite sides of the field. A **broad phase** skips pairs that can't possibly touch, before the exact test (the **narrow phase**) runs.

The simplest broad phase is a **uniform grid**:

```text
┌────┬────┬────┬────┐
│ a  │    │    │    │   Put each box in every cell it touches.
├────┼────┼────┼────┤   Test only boxes that share a cell.
│  b │ c  │    │    │   a is never tested against d.
├────┼────┼────┼────┤
│    │  c │    │  d │   c touches two cells.
└────┴────┴────┴────┘
```

With boxes spread out, each cell holds a handful, and the work drops from `n²/2` towards `n`.

The reviewer's tests describe `collisions_grid(world, cell_size)` in a new header, `broadphase.h`, and demand **exactly** the same result as `collisions`: same pairs, same order. The brute-force version you already trust becomes the **test oracle** for the fast one, checked on 2,400 random boxes. Note the trap they're probing: a box spanning several cells shares more than one cell with its neighbour.

```cpp file=engine/tests/grid_review_test.cpp provided
// grid_review_test.cpp — a reviewer's tests: the grid must agree
// with the all-pairs version, exactly.
#include "broadphase.h"
#include "particles.h"  // for Rng
#include "studio_test.hpp"

static World scatter(std::uint32_t seed, int n, float field, float big)
{
    World w;
    Rng rng{seed};
    for (int i = 0; i < n; ++i) {
        Entity e = w.create();
        w.positions.add(e, {rng.next() * field - field / 2,
                            rng.next() * field - field / 2});
        w.sizes.add(e, {1 + rng.next() * big, 1 + rng.next() * big});
    }
    return w;
}

TEST(grid_finds_the_same_pairs_as_checking_all_pairs)
{
    for (std::uint32_t seed = 1; seed <= 5; ++seed) {
        World w = scatter(seed, 400, 200, 8);
        auto expected = collisions(w);
        CHECK(!expected.empty());
        CHECK(collisions_grid(w, 8) == expected);
    }
}

TEST(boxes_bigger_than_a_cell_are_reported_once)
{
    World w = scatter(9, 200, 100, 30);  // many boxes span cells
    CHECK(collisions_grid(w, 4) == collisions(w));
}

TEST(negative_positions_work)
{
    World w;
    Entity a = w.create(), b = w.create();
    w.positions.add(a, {-5, -5}); w.sizes.add(a, {2, 2});
    w.positions.add(b, {-4, -4}); w.sizes.add(b, {2, 2});
    auto hits = collisions_grid(w, 3);
    CHECK_EQ(hits.size(), std::size_t{1});
}

TEST(entities_without_a_position_are_skipped)
{
    World w;
    Entity a = w.create();
    w.sizes.add(a, {5, 5});  // no Position
    CHECK(collisions_grid(w, 4).empty());
}
```

```check
file engine/tests/grid_review_test.cpp
```

## Step 5 — Challenge: a grid broad phase

**This step: create `engine/broadphase.h` with `collisions_grid` so the reviewer's tests pass. No code this time; the reference has one solution.**

What you need to decide:

- **Gathering:** the same `{entity, position, size}` vector as `collisions`.
- **Cell coordinates:** `std::floor(x / cell)`, as an integer. `floor`, not a cast: a cast rounds −0.5 to 0, putting boxes either side of 0 in the same cell column (harmless but wasteful) and making negative positions behave differently from positive ones.
- **The grid:** a `std::unordered_map` from a cell key to the indices of the boxes in it. Combine the two cell coordinates into one `std::int64_t` key, for example `(cx << 32) ^ (cy & 0xffffffff)`.
- **Duplicates:** two boxes sharing two cells are found twice. Put the smaller id first in each pair, then `std::sort` and `std::unique` + `erase`. Sorting also gives the order the tests want.

```text
cmake --build engine/build
./engine/build/engine_tests
```

```cpp file=engine/broadphase.h
// broadphase.h — collisions with a uniform grid: only boxes that
// share a grid cell are tested against each other.
#pragma once

#include "systems.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <unordered_map>
#include <vector>

// The same answer as collisions(w), usually far faster.
// cell: the grid's cell size; about the size of a typical box.
inline std::vector<Pair> collisions_grid(const World& w, float cell)
{
    struct Body { Entity e; Position p; Size s; };
    std::vector<Body> bodies;
    for (const auto& [e, size] : w.sizes)
        if (w.positions.has(e))
            bodies.push_back({e, w.positions.get(e), size});

    // Every cell a box touches gets the box's index.
    auto key = [](std::int64_t cx, std::int64_t cy) {
        return (cx << 32) ^ (cy & 0xffffffff);
    };
    std::unordered_map<std::int64_t, std::vector<std::size_t>> grid;
    for (std::size_t i = 0; i < bodies.size(); ++i) {
        const Body& b = bodies[i];
        auto x0 = static_cast<std::int64_t>(std::floor(b.p.x / cell));
        auto y0 = static_cast<std::int64_t>(std::floor(b.p.y / cell));
        auto x1 = static_cast<std::int64_t>(
            std::floor((b.p.x + b.s.w) / cell));
        auto y1 = static_cast<std::int64_t>(
            std::floor((b.p.y + b.s.h) / cell));
        for (auto cx = x0; cx <= x1; ++cx)
            for (auto cy = y0; cy <= y1; ++cy)
                grid[key(cx, cy)].push_back(i);
    }

    // Test pairs within each cell. Boxes sharing several cells are
    // found more than once, so sort and remove the repeats.
    std::vector<Pair> hits;
    for (const auto& [k, members] : grid)
        for (std::size_t i = 0; i < members.size(); ++i)
            for (std::size_t j = i + 1; j < members.size(); ++j) {
                const Body& a = bodies[members[i]];
                const Body& b = bodies[members[j]];
                if (boxes_overlap(a.p, a.s, b.p, b.s))
                    hits.emplace_back(std::min(a.e, b.e),
                                      std::max(a.e, b.e));
            }
    std::sort(hits.begin(), hits.end());
    hits.erase(std::unique(hits.begin(), hits.end()), hits.end());
    return hits;
}
```

```check
run "cmake --build engine/build"
tests "./engine/build/engine_tests" require="grid_finds_the_same_pairs_as_checking_all_pairs boxes_bigger_than_a_cell_are_reported_once negative_positions_work entities_without_a_position_are_skipped" -- Boxes in several cells are found more than once: sort the pairs and remove duplicates.
```

## Step 6 — Profile again

**This step: change `engine/apps/profiled_game.cpp` to run both collision systems each frame, under their own scopes, and check they agree. Build, run, and compare the traces.**

- Include `broadphase.h`.
- Each frame, time `collisions(world)` under `"collisions"` as before, then `collisions_grid(world, 8)` under `"collisions_grid"`, keeping both results.
- Keep a `bool same` that stays `true` only while the two results are equal every frame, and print `grid matches all pairs: yes` (or `NO`) before writing the trace.
- Add `"collisions_grid"` to the printed totals.

Running both every frame is how you'd roll out an optimisation safely: the new system runs alongside the old one, compared, until you trust it. Then delete the old call.

```text
cmake --build engine/build
./engine/build/profiled_game
```

Reload `trace.json` in Perfetto: each frame now has four system bars, and the grid one is a fraction of the old one.

```cpp file=engine/apps/profiled_game.cpp
// profiled_game.cpp — a busy world, every system timed.
#include "broadphase.h"
#include "particles.h"  // for Rng
#include "profiler.h"
#include "systems.h"

#include <cstdio>
#include <fstream>

// 2,000 boxes scattered over a 1000 x 1000 field; half of them
// are sparks that burn out.
World make_world()
{
    World w;
    Rng rng{1};
    for (int i = 0; i < 2000; ++i) {
        Entity e = w.create();
        w.positions.add(e, {rng.next() * 1000, rng.next() * 1000});
        w.velocities.add(e, {rng.next() * 40 - 20,
                             rng.next() * 40 - 20});
        w.sizes.add(e, {4, 4});
        if (i % 2)
            w.lifetimes.add(e, {rng.next() * 2});
    }
    return w;
}

int main()
{
    Profiler profiler;
    World world = make_world();
    std::size_t hits = 0;
    bool same = true;

    for (int frame = 0; frame < 60; ++frame) {
        PROFILE_SCOPE(profiler, "frame");
        {
            PROFILE_SCOPE(profiler, "movement");
            movement(world, 1.0f / 60);
        }
        {
            PROFILE_SCOPE(profiler, "lifetime");
            lifetime(world, 1.0f / 60);
        }
        std::vector<Pair> slow, fast;
        {
            PROFILE_SCOPE(profiler, "collisions");
            slow = collisions(world);
        }
        {
            PROFILE_SCOPE(profiler, "collisions_grid");
            fast = collisions_grid(world, 8);
        }
        hits += fast.size();
        same = same && fast == slow;
    }

    std::printf("entities left: %zu, collisions seen: %zu\n",
                world.count(), hits);
    for (const char* name : {"movement", "lifetime", "collisions",
                             "collisions_grid"})
        std::printf("%-15s %8.2f ms\n", name,
                    profiler.total_us(name) / 1000.0);

    std::printf("grid matches all pairs: %s\n", same ? "yes" : "NO");

    std::ofstream out("trace.json");
    profiler.write_chrome_json(out);
    std::printf("wrote trace.json (%zu events)\n",
                profiler.events().size());
}
```

### What happened

```text
collisions        327.61 ms
collisions_grid    37.75 ms
grid matches all pairs: yes
```

About **9 times** faster, with identical results. The grid now costs about three times `movement`; profile again to choose the next target, or stop: at 0.6 ms a frame, collisions fit comfortably in 16.7 ms.

That loop, **measure → find the hot spot → fix it → verify it's still correct → measure again**, is the whole of performance work. This track gave you each tool for it: fixed timesteps and fake clocks for repeatable runs, components and systems to name the work, tests as oracles, cache-friendly layouts, and a profiler to point the way.

```check
run "cmake --build engine/build"
run "./engine/build/profiled_game" stdout="grid matches all pairs: yes" label="the grid agrees with all pairs"
run "./engine/build/profiled_game" stdout="wrote trace.json (300 events)" label="60 frames × 5 scopes recorded"
contains trace.json "{\"name\":\"collisions_grid\",\"ph\":\"X\"" label="trace.json has the collisions_grid scopes"
```
