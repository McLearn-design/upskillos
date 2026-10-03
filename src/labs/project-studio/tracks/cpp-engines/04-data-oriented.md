---
title: 4 — Data-Oriented Design
track: Games and Engines
runtime: cpp
reference: optional
console: true
---

Lesson 2's world stores every component in a `std::map`. With fifty objects, nobody would notice. With 50,000 sparks, bullets and leaves, the game starts dropping frames, and the profiler (lesson 5) shows time going not into maths but into **waiting for memory**.

### Why memory is the bottleneck

A CPU can do an addition in well under a nanosecond. Fetching a value from main memory takes around **100 ns**. Caches hide that, as long as the data you need next is already in them:

| Where | Typical size | Time to read |
|---|---|---|
| L1 cache | 32–128 KB per core | ~1 ns |
| L2 cache | 0.5–4 MB | ~4 ns |
| L3 cache | 8–64 MB, shared | ~15 ns |
| main memory | GBs | ~100 ns |

Memory moves into cache in blocks of **64 bytes**, called **cache lines**. Read one `float` and its 15 neighbours come along for free. So the question that decides speed is: **of each 64 bytes the CPU fetched, how many did the loop actually use?**

**Data-oriented design** means laying out data for the loops that read it, rather than for how we'd describe the objects in English.

## Step 1 — The specification: two layouts, one world

**This step: create the supplied `engine/tests/layout_test.cpp` and read it.**

A particle has **hot** data, read every update (position and velocity), and **cold** data, read only when drawing (colour, age, size, a debug name). There are two ways to store 50,000 of them:

```text
array of structs (AoS): one 64-byte struct per particle
[x y vx vy r g b a age size name...][x y vx vy r g b a ...]...

struct of arrays (SoA): one array per field
x:  [x x x x x x x x x x x x x x x x ...]
y:  [y y y y y y y y y y y y y y y y ...]
vx: ...
```

The update reads 16 bytes per particle. In AoS, each cache line holds **one** particle, so 48 of every 64 bytes fetched are cold data, wasted. In SoA, each cache line of `x` holds **16** useful values.

The tests say both layouts must produce **identical** results: same starting particles from the same seed, same updates, same checksum, compared with `CHECK_EQ`. A speed-up that changes the game's behaviour isn't an optimisation; it's a bug.

`Rng` is a tiny generator of our own because `std::uniform_real_distribution` is allowed to give different numbers in different standard libraries (libstdc++, libc++, Microsoft's), and these tests must pass everywhere.

```cpp file=engine/tests/layout_test.cpp provided
// layout_test.cpp — both layouts must simulate the same world.
#include "particles.h"
#include "studio_test.hpp"

TEST(rng_is_repeatable_and_in_range)
{
    Rng a{42}, b{42};
    for (int i = 0; i < 1000; ++i) {
        float x = a.next();
        CHECK_EQ(x, b.next());
        CHECK(x >= 0.0f && x < 1.0f);
    }
}

TEST(an_aos_particle_fills_one_cache_line)
{
    CHECK_EQ(sizeof(ParticleAoS), std::size_t{64});
}

TEST(both_layouts_start_identical)
{
    auto aos = make_aos(1000, 7);
    auto soa = make_soa(1000, 7);
    CHECK_EQ(soa.count(), std::size_t{1000});
    CHECK_EQ(aos[999].vy, soa.vy[999]);
    CHECK_EQ(checksum(aos), checksum(soa));
}

TEST(both_layouts_simulate_identically)
{
    auto aos = make_aos(1000, 7);
    auto soa = make_soa(1000, 7);
    for (int frame = 0; frame < 500; ++frame) {
        update(aos, 0.01f);
        update(soa, 0.01f);
    }
    CHECK_EQ(checksum(aos), checksum(soa));
    CHECK_EQ(aos[500].x, soa.x[500]);
}

TEST(particles_bounce_off_the_floor)
{
    auto soa = make_soa(1000, 3);
    for (int frame = 0; frame < 500; ++frame) {
        update(soa, 0.01f);
        for (float y : soa.y)
            CHECK(y >= 0.0f);
    }
}
```

```check
file engine/tests/layout_test.cpp
```

## Step 2 — Particles, both ways

**This step: create `engine/particles.h` with `Rng`, `ParticleAoS`, `ParticlesSoA`, and `make_aos`, `make_soa`, `update` and `checksum` for each. Build and run the tests.**

- `Rng::next()`: `state = state * 1664525u + 1013904223u;` (a linear congruential generator; unsigned overflow wraps, by definition), then the top 24 bits scaled into `[0, 1)`: `(state >> 8) * (1.0f / 16777216.0f)`.
- `ParticleAoS`: ten `float`s and a `std::array<char, 24> name`: 40 + 24 = **64 bytes**, one cache line.
- `ParticlesSoA`: one `std::vector` per field, and `count()`.
- `make_aos` / `make_soa`: for each particle, call `rng.next()` for `x`, `y`, `vx`, `vy` **in that order** (`x` and `y` in 0..100, velocities in −10..10); cold fields get `1`, age `0`.
- `update`: gravity, move, and bounce off the floor. Write it **without an `if`**, so the compiler can turn it into SIMD instructions that do 4 or 8 particles at once:

```cpp
float vy = p.vy + particle_gravity * dt;
float y = p.y + vy * dt;
bool below = y < 0;   // bounce: mirror, lose half the speed
p.x += p.vx * dt;
p.y = below ? -y : y;
p.vy = below ? -vy * 0.5f : vy;
```

  The SoA version does the same with `ps.x[i]` and friends. Take the arrays' `.data()` pointers into locals first; it saves the optimiser re-reading each vector's internals.
- `checksum`: the sum of every `x + y`, in index order, in `double`.

**The same operations in the same order give the same bits.** Both versions must do exactly the same arithmetic per particle; even `(a + b) + c` versus `a + (b + c)` can change the last bit.

```text
cmake --build engine/build
./engine/build/engine_tests
```

```cpp file=engine/particles.h
// particles.h — one simulation, two memory layouts.
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

// A tiny random number generator with the same output everywhere
// (std::uniform_real_distribution may differ between libraries).
struct Rng {
    std::uint32_t state;
    float next()  // in [0, 1)
    {
        state = state * 1664525u + 1013904223u;
        return static_cast<float>(state >> 8) * (1.0f / 16777216.0f);
    }
};

inline constexpr float particle_gravity = -9.8f;

// Array of structs: each particle's fields side by side.
struct ParticleAoS {
    float x, y, vx, vy;           // hot: used every update
    float r, g, b, a, age, size;  // cold: used only for drawing
    std::array<char, 24> name;
};

// Struct of arrays: each field in its own array.
struct ParticlesSoA {
    std::vector<float> x, y, vx, vy;
    std::vector<float> r, g, b, a, age, size;
    std::vector<std::array<char, 24>> name;
    std::size_t count() const { return x.size(); }
};

inline std::vector<ParticleAoS> make_aos(std::size_t n,
                                         std::uint32_t seed)
{
    Rng rng{seed};
    std::vector<ParticleAoS> ps(n);
    for (auto& p : ps) {
        p.x = rng.next() * 100;
        p.y = rng.next() * 100;
        p.vx = rng.next() * 20 - 10;
        p.vy = rng.next() * 20 - 10;
        p.r = p.g = p.b = p.a = 1;
        p.age = 0;
        p.size = 1;
        p.name = {};
    }
    return ps;
}

// The same particles: the generator is called in the same order.
inline ParticlesSoA make_soa(std::size_t n, std::uint32_t seed)
{
    Rng rng{seed};
    ParticlesSoA ps;
    for (std::size_t i = 0; i < n; ++i) {
        ps.x.push_back(rng.next() * 100);
        ps.y.push_back(rng.next() * 100);
        ps.vx.push_back(rng.next() * 20 - 10);
        ps.vy.push_back(rng.next() * 20 - 10);
    }
    for (auto* v : {&ps.r, &ps.g, &ps.b, &ps.a, &ps.size})
        v->assign(n, 1.0f);
    ps.age.assign(n, 0.0f);
    ps.name.assign(n, {});
    return ps;
}

// Gravity, movement, and a bounce off the floor at y = 0.
inline void update(std::vector<ParticleAoS>& ps, float dt)
{
    for (auto& p : ps) {
        float vy = p.vy + particle_gravity * dt;
        float y = p.y + vy * dt;
        bool below = y < 0;  // bounce: mirror, and lose half the speed
        p.x += p.vx * dt;
        p.y = below ? -y : y;
        p.vy = below ? -vy * 0.5f : vy;
    }
}

inline void update(ParticlesSoA& ps, float dt)
{
    const std::size_t n = ps.count();
    float* x = ps.x.data();
    float* y = ps.y.data();
    const float* vx = ps.vx.data();
    float* vy = ps.vy.data();
    for (std::size_t i = 0; i < n; ++i) {
        float v = vy[i] + particle_gravity * dt;
        float h = y[i] + v * dt;
        bool below = h < 0;
        x[i] += vx[i] * dt;
        y[i] = below ? -h : h;
        vy[i] = below ? -v * 0.5f : v;
    }
}

// Sum of every position, in order: equal sums mean equal worlds
// (almost certainly; a checksum can't prove it).
inline double checksum(const std::vector<ParticleAoS>& ps)
{
    double sum = 0;
    for (const auto& p : ps)
        sum += static_cast<double>(p.x) + p.y;
    return sum;
}

inline double checksum(const ParticlesSoA& ps)
{
    double sum = 0;
    for (std::size_t i = 0; i < ps.count(); ++i)
        sum += static_cast<double>(ps.x[i]) + ps.y[i];
    return sum;
}
```

```check
run "cmake --build engine/build"
tests "./engine/build/engine_tests" require="rng_is_repeatable_and_in_range an_aos_particle_fills_one_cache_line both_layouts_start_identical both_layouts_simulate_identically particles_bounce_off_the_floor" -- Draw x, y, vx, vy in the same order in both makers, and do the same arithmetic in both updates.
```

## Step 3 — The benchmark

**This step: create the supplied `engine/apps/bench.cpp` and read it. Build it, and run it three ways.**

It makes the same particles in both layouts, times 300 updates of each with `std::chrono::steady_clock`, and prints the times and whether the checksums match. Its arguments are the particle count and the number of frames.

**Predict:** at 50,000 particles, how much faster will SoA be: not at all, 2×, 10×?

```text
cmake --build engine/build
./engine/build/bench
./engine/build/bench 500000 50
./engine/build/bench 2000000 20
```

The checks only look at `checksums match: yes`; timings differ on every machine and every run, so no check could depend on them.

```cpp file=engine/apps/bench.cpp provided
// bench.cpp — the same 50,000 particles in two layouts, timed.
#include "particles.h"

#include <chrono>
#include <cstdio>
#include <string>

template <typename F>
double milliseconds(F&& work)
{
    auto start = std::chrono::steady_clock::now();
    work();
    std::chrono::duration<double, std::milli> took =
        std::chrono::steady_clock::now() - start;
    return took.count();
}

// Usage: bench [particles] [frames]
int main(int argc, char* argv[])
{
    const std::size_t n = argc > 1 ? std::stoul(argv[1]) : 50'000;
    const int frames = argc > 2 ? std::stoi(argv[2]) : 300;
    auto aos = make_aos(n, 2024);
    auto soa = make_soa(n, 2024);

    double t_aos = milliseconds([&] {
        for (int f = 0; f < frames; ++f)
            update(aos, 1.0f / 60);
    });
    double t_soa = milliseconds([&] {
        for (int f = 0; f < frames; ++f)
            update(soa, 1.0f / 60);
    });

    std::printf("%zu particles, %d frames\n", n, frames);
    std::printf("array of structs: %8.2f ms\n", t_aos);
    std::printf("struct of arrays: %8.2f ms\n", t_soa);
    std::printf("checksum: %.3f\n", checksum(soa));
    std::printf("checksums match: %s\n",
                checksum(aos) == checksum(soa) ? "yes" : "NO");
}
```

### What happened

On one test machine (4 MB of L2 cache per core, 33 MB of L3):

```text
particles   AoS        SoA
50,000      23 ms      24 ms     (3.2 MB: fits in cache)
500,000     164 ms     35 ms     (32 MB: doesn't)
2,000,000   305 ms     62 ms
```

At 50,000 the AoS array is 3.2 MB, which fits in this machine's cache, so both layouts run at the speed of the arithmetic. Once the data is bigger than the cache, every update streams it from main memory, and AoS fetches **four times as many bytes**, so it's about four times slower. A laptop with a smaller cache shows the gap at a smaller count; try a few sizes on yours.

That's the shape of most performance problems in games: correct code, with the time going to memory traffic. And a lesson in benchmarking: **measure at the size you'll really run**, because a benchmark that fits in cache can tell you the opposite of the truth.

| | Array of structs | Struct of arrays |
|---|---|---|
| a loop over a few fields of every object | wastes cache lines | uses every byte |
| everything about one object | one cache line | one line per field |
| adding, removing objects | one push/erase | one per array |
| easy to read | yes | less so |

```check
run "cmake --build engine/build"
run "./engine/build/bench 20000 10" stdout="checksums match: yes" label="the layouts agree"
```

## Step 4 — Removing objects without breaking ids

**This step: create the supplied `engine/tests/dense_test.cpp` and read it.**

Packed arrays have one problem: **removal**. Sparks die all the time. Erasing from the middle of a `std::vector` shifts everything after it down one place: O(n) per removal, and worse, every particle after the hole now has a **different index**. Anything that remembered "my target is index 812" now points at someone else.

Two ideas fix both problems:

**Swap and pop.** Move the *last* item into the hole, then shrink by one. O(1), and the array stays packed. Order changes, but a particle system doesn't care about order.

```text
ids:   [1 ant][2 bee][3 cat][4 dog]     remove 2
                  ↑               │
                  └── 4 dog ──────┘
ids:   [1 ant][4 dog][3 cat]
```

**Stable ids.** Never hand out indices. Hand out ids that never change, and keep a map from id to current index, updating it when an item moves. This is a simple **slot map**, the structure behind most ECS libraries' component storage.

The tests describe `DenseStore<T>` in a new header, `dense.h`: `add` returns an id, `get(id)`, `has(id)`, `remove(id)`, and `items()` / `ids()` for fast loops, where `items()[i]` belongs to `ids()[i]`.

```cpp file=engine/tests/dense_test.cpp provided
// dense_test.cpp — the specification of DenseStore.
#include "dense.h"
#include "studio_test.hpp"

#include <stdexcept>
#include <string>
#include <vector>

using Ids = std::vector<DenseStore<std::string>::Id>;

TEST(items_are_found_by_their_id)
{
    DenseStore<std::string> s;
    auto a = s.add("ant");
    auto b = s.add("bee");
    CHECK_NE(a, b);
    CHECK_EQ(s.get(a), std::string("ant"));
    CHECK_EQ(s.get(b), std::string("bee"));
    CHECK_EQ(s.size(), std::size_t{2});
}

TEST(removal_moves_the_last_item_into_the_hole)
{
    DenseStore<std::string> s;
    auto a = s.add("ant");
    auto b = s.add("bee");
    auto c = s.add("cat");
    auto d = s.add("dog");
    s.remove(b);
    CHECK_EQ(s.size(), std::size_t{3});
    CHECK(s.ids() == (Ids{a, d, c}));
    CHECK_EQ(s.items()[1], std::string("dog"));
}

TEST(ids_stay_valid_after_removing_others)
{
    DenseStore<std::string> s;
    auto a = s.add("ant");
    auto b = s.add("bee");
    auto c = s.add("cat");
    s.remove(a);
    CHECK_EQ(s.get(b), std::string("bee"));
    CHECK_EQ(s.get(c), std::string("cat"));  // c moved; its id didn't
}

TEST(a_removed_id_is_gone_and_never_reused)
{
    DenseStore<std::string> s;
    auto a = s.add("ant");
    s.remove(a);
    CHECK(!s.has(a));
    CHECK_THROWS(s.get(a), std::out_of_range);
    auto b = s.add("bee");
    CHECK_NE(a, b);
}

TEST(removing_the_last_item_and_removing_twice_are_fine)
{
    DenseStore<std::string> s;
    auto a = s.add("ant");
    auto b = s.add("bee");
    s.remove(b);  // the last one: nothing to move
    s.remove(b);  // already gone: nothing happens
    CHECK_EQ(s.size(), std::size_t{1});
    CHECK_EQ(s.get(a), std::string("ant"));
}
```

```check
file engine/tests/dense_test.cpp
```

## Step 5 — DenseStore

**This step: create `engine/dense.h` with `DenseStore<T>`. Build and run the tests.**

This time, requirements only:

- Three members: `std::vector<T> items_`, `std::vector<Id> ids_` (parallel to it), and `std::unordered_map<Id, std::size_t> index_of_`. Plus `Id next_ = 1`.
- `add`: give out `next_++`, record its index, push to both vectors.
- `get`: `items_[index_of_.at(id)]`, so an unknown id throws `std::out_of_range`.
- `remove`: find the hole; if it isn't the last slot, move the last item and its id into it and **update the moved id's index**; then pop both vectors and erase the removed id. Removing an id that isn't there does nothing.
- Watch the case where the hole *is* the last slot: moving an item onto itself is at best pointless.

### Where this goes next

`Store<T>` in `ecs.h` could wrap a `DenseStore` (or keep its own parallel vectors) and the systems would loop over packed arrays instead of tree nodes. Lesson 2's tests would tell you if the swap broke anything: that's what they're for. Production ECS libraries add one more trick, **generations** (an id is index + a counter bumped on reuse), so ids can be recycled safely without the hash map.

```text
cmake --build engine/build
./engine/build/engine_tests
```

```cpp file=engine/dense.h
// dense.h — items packed in one array, found by ids that never
// change.
#pragma once

#include <cstddef>
#include <cstdint>
#include <unordered_map>
#include <utility>
#include <vector>

template <typename T>
class DenseStore {
public:
    using Id = std::uint32_t;  // 0 is never an id

    Id add(T value)
    {
        Id id = next_++;
        index_of_[id] = items_.size();
        items_.push_back(std::move(value));
        ids_.push_back(id);
        return id;
    }

    bool has(Id id) const { return index_of_.contains(id); }
    T& get(Id id) { return items_[index_of_.at(id)]; }
    const T& get(Id id) const { return items_[index_of_.at(id)]; }

    // Swap and pop: the last item moves into the hole. O(1).
    void remove(Id id)
    {
        auto found = index_of_.find(id);
        if (found == index_of_.end())
            return;
        std::size_t hole = found->second;
        std::size_t last = items_.size() - 1;
        if (hole != last) {
            items_[hole] = std::move(items_[last]);
            ids_[hole] = ids_[last];
            index_of_[ids_[hole]] = hole;
        }
        items_.pop_back();
        ids_.pop_back();
        index_of_.erase(id);
    }

    std::size_t size() const { return items_.size(); }

    // Packed, for fast loops: items()[i] belongs to ids()[i].
    std::vector<T>& items() { return items_; }
    const std::vector<T>& items() const { return items_; }
    const std::vector<Id>& ids() const { return ids_; }

private:
    std::vector<T> items_;
    std::vector<Id> ids_;
    std::unordered_map<Id, std::size_t> index_of_;
    Id next_ = 1;
};
```

```check
run "cmake --build engine/build"
tests "./engine/build/engine_tests" require="items_are_found_by_their_id removal_moves_the_last_item_into_the_hole ids_stay_valid_after_removing_others a_removed_id_is_gone_and_never_reused removing_the_last_item_and_removing_twice_are_fine" -- After moving the last item into the hole, update index_of_ for the moved id.
```
