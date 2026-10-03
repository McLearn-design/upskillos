---
title: 2 — Entities and Components
track: Games and Engines
runtime: cpp
reference: optional
console: true
---

A game has thousands of *things*: players, bullets, sparks, crates, triggers. This lesson builds the way most modern engines organise them, and explains why the obvious way stops working.

### The class hierarchy, and where it breaks

In *Classes and Object-Oriented Design* you modelled variety with inheritance and virtual functions. A first game engine usually starts the same way:

```text
GameObject            virtual update(), draw()
├── Player
├── Enemy
│   ├── FlyingEnemy
│   └── ShootingEnemy
└── Bullet
```

Then the designer asks for a **flying enemy that shoots**. Does it inherit from `FlyingEnemy` or `ShootingEnemy`? Both means multiple inheritance and the diamond problem; one means copying the other's code. Next week: a crate that can be set on fire, a bullet that bounces, a player that can fly with a power-up, gained and lost **at run time**. A class can't change its base class while the game runs.

### Entities, components, systems

The fix is to stop asking *what is it?* and ask *what does it have?*

| Idea | Here | Is |
|---|---|---|
| **entity** | `Entity` | just an id number: no data, no code |
| **component** | `Position`, `Velocity`, `Size`, `Lifetime` | plain data attached to an entity |
| **system** | `movement`, `lifetime`, `collisions` | a function that runs over every entity with the right components |

A flying shooting enemy is an entity with a `Position`, a `Velocity`, a `Flight` and a `Gun`. Power-up gained: add a component. Lost: remove it. This is called an **ECS** (entity-component-system); Unity's DOTS, Bevy, and the `EnTT` library (used in *Minecraft*) are industrial versions.

## Step 1 — The specification of the world

**This step: create the supplied `engine/tests/ecs_test.cpp` and read it.**

It describes two classes for a new header, `ecs.h`:

- **`Store<T>`** holds every component of one type, keyed by entity: `add`, `has`, `get`, `remove`, `size`, and iteration in entity order.
- **`World`** hands out entity ids and owns one store per component type: `positions`, `velocities`, `sizes`, `lifetimes`.

Design decisions written into the tests:

- **Ids start at 1.** `0` is free to mean "no entity", like a null pointer.
- **`destroy` removes the entity from every store.** A component left behind for a dead entity is a "zombie": systems keep moving and colliding something that no longer exists.
- **`get` of a missing component throws** `std::out_of_range`. Asking a rock for its velocity is a bug in the caller; it should be loud.

```cpp file=engine/tests/ecs_test.cpp provided
// ecs_test.cpp — the specification of World and Store.
#include "ecs.h"
#include "studio_test.hpp"

#include <stdexcept>

TEST(new_entities_have_distinct_ids)
{
    World w;
    Entity a = w.create();
    Entity b = w.create();
    CHECK_NE(a, b);
    CHECK_NE(a, Entity{0});  // 0 means "no entity"
    CHECK_NE(b, Entity{0});
    CHECK_EQ(w.count(), std::size_t{2});
}

TEST(an_entity_has_only_the_components_it_was_given)
{
    World w;
    Entity rock = w.create();
    Entity bird = w.create();
    w.positions.add(rock, {1, 2});
    w.positions.add(bird, {5, 5});
    w.velocities.add(bird, {3, 0});
    CHECK(!w.velocities.has(rock));
    CHECK(w.velocities.has(bird));
    CHECK_EQ(w.positions.get(rock).y, 2.0f);
    CHECK_EQ(w.velocities.get(bird).x, 3.0f);
}

TEST(adding_again_replaces_the_component)
{
    World w;
    Entity e = w.create();
    w.positions.add(e, {1, 1});
    w.positions.add(e, {7, 8});
    CHECK_EQ(w.positions.get(e).x, 7.0f);
    CHECK_EQ(w.positions.size(), std::size_t{1});
}

TEST(destroy_removes_the_entity_and_all_its_components)
{
    World w;
    Entity e = w.create();
    w.positions.add(e, {});
    w.velocities.add(e, {});
    w.sizes.add(e, {});
    w.lifetimes.add(e, {});
    w.destroy(e);
    CHECK(!w.alive(e));
    CHECK(!w.positions.has(e));
    CHECK(!w.velocities.has(e));
    CHECK(!w.sizes.has(e));
    CHECK(!w.lifetimes.has(e));
    CHECK_EQ(w.count(), std::size_t{0});
}

TEST(get_of_a_missing_component_throws)
{
    World w;
    Entity e = w.create();
    CHECK_THROWS(w.positions.get(e), std::out_of_range);
}
```

```check
file engine/tests/ecs_test.cpp
```

## Step 2 — Store and World

**This step: create `engine/ecs.h` with `Entity`, `Store<T>`, the four components and `World`. Build and run the tests.**

- `using Entity = std::uint32_t;`
- `Store<T>` wraps a `std::map<Entity, T>`. `add` uses `insert_or_assign` (adding again replaces), `has` uses `contains` (C++20), `get` uses `at`, which already throws `std::out_of_range`. Give it `begin()`/`end()` (const and non-const) returning the map's iterators, so a system can write `for (auto& [entity, v] : w.velocities)`.
- The components are plain structs with default member values, for example `struct Velocity { float x = 0, y = 0; };`. `Size` defaults to `1 × 1`.
- `World` keeps `Entity next_ = 1;` and a `std::set<Entity> alive_`. `create` hands out `next_++`; `destroy` erases the id from `alive_` and from **all four** stores; `alive` and `count` read the set.

### Why a `std::map`, for now

A map keeps entities in id order, which makes every system's output deterministic and easy to test. It's also slow: every component is a separate heap node, scattered through memory, and every `get` walks a tree. Lesson 4 measures what that costs and replaces it with packed arrays; the tests you're about to pass will check that the replacement behaves the same.

```text
cmake --build engine/build
./engine/build/engine_tests
```

```cpp file=engine/ecs.h
// ecs.h — entities are ids; components live in one store per type.
#pragma once

#include <cstddef>
#include <cstdint>
#include <map>
#include <set>

using Entity = std::uint32_t;  // 0 is never an entity

// Every component of one type, looked up by entity.
template <typename T>
class Store {
public:
    void add(Entity e, T value) { items_.insert_or_assign(e, value); }
    bool has(Entity e) const { return items_.contains(e); }
    T& get(Entity e) { return items_.at(e); }
    const T& get(Entity e) const { return items_.at(e); }
    void remove(Entity e) { items_.erase(e); }
    std::size_t size() const { return items_.size(); }

    // In entity order: for (auto& [entity, component] : store)
    auto begin() { return items_.begin(); }
    auto end() { return items_.end(); }
    auto begin() const { return items_.begin(); }
    auto end() const { return items_.end(); }

private:
    std::map<Entity, T> items_;
};

// Components: plain data, no behaviour.
struct Position { float x = 0, y = 0; };
struct Velocity { float x = 0, y = 0; };
struct Size { float w = 1, h = 1; };     // a collision box
struct Lifetime { float seconds = 0; };  // destroyed at zero

class World {
public:
    Entity create()
    {
        Entity e = next_++;
        alive_.insert(e);
        return e;
    }

    void destroy(Entity e)
    {
        alive_.erase(e);
        positions.remove(e);
        velocities.remove(e);
        sizes.remove(e);
        lifetimes.remove(e);
    }

    bool alive(Entity e) const { return alive_.contains(e); }
    std::size_t count() const { return alive_.size(); }

    Store<Position> positions;
    Store<Velocity> velocities;
    Store<Size> sizes;
    Store<Lifetime> lifetimes;

private:
    Entity next_ = 1;
    std::set<Entity> alive_;
};
```

```check
run "cmake --build engine/build"
tests "./engine/build/engine_tests" require="new_entities_have_distinct_ids an_entity_has_only_the_components_it_was_given adding_again_replaces_the_component destroy_removes_the_entity_and_all_its_components get_of_a_missing_component_throws" -- destroy must remove the entity from every store, and ids start at 1.
```

## Step 3 — The specification of the systems

**This step: create the supplied `engine/tests/systems_test.cpp` and read it.**

Three systems for a new header, `systems.h`. Each is a free function that takes the `World`:

| System | Reads | Does |
|---|---|---|
| `movement(w, dt)` | `Velocity`, `Position` | moves every entity that has both |
| `lifetime(w, dt)` | `Lifetime` | counts down; destroys entities at zero or below |
| `collisions(w)` | `Position`, `Size` | returns every overlapping pair |

Notice what *isn't* here: no `Player::update`, no virtual functions. An entity with a velocity but no position is simply skipped by `movement`, and one with no `Lifetime` lives forever. Behaviour comes from which components exist.

`collisions` returns `std::vector<std::pair<Entity, Entity>>` with the smaller id first, each pair once, in order. Boxes that only **touch** don't collide (lesson 3 explains why).

```cpp file=engine/tests/systems_test.cpp provided
// systems_test.cpp — the specification of the three systems.
#include "systems.h"
#include "studio_test.hpp"

TEST(movement_moves_by_velocity_times_dt)
{
    World w;
    Entity e = w.create();
    w.positions.add(e, {10, 20});
    w.velocities.add(e, {4, -2});
    movement(w, 0.5f);
    CHECK_NEAR(w.positions.get(e).x, 12.0f, 1e-6);
    CHECK_NEAR(w.positions.get(e).y, 19.0f, 1e-6);
}

TEST(movement_leaves_entities_without_velocity_alone)
{
    World w;
    Entity wall = w.create();
    w.positions.add(wall, {3, 3});
    Entity ghost = w.create();  // a velocity but no position
    w.velocities.add(ghost, {1, 1});
    movement(w, 1.0f);
    CHECK_EQ(w.positions.get(wall).x, 3.0f);
    CHECK(!w.positions.has(ghost));
}

TEST(lifetime_destroys_entities_whose_time_ran_out)
{
    World w;
    Entity spark = w.create();
    w.positions.add(spark, {});
    w.lifetimes.add(spark, {0.5f});
    Entity rock = w.create();
    lifetime(w, 0.25f);
    CHECK(w.alive(spark));
    lifetime(w, 0.25f);
    CHECK(!w.alive(spark));
    CHECK(!w.positions.has(spark));
    CHECK(w.alive(rock));  // no Lifetime: lives forever
}

TEST(collisions_reports_each_overlapping_pair_once)
{
    World w;
    Entity a = w.create(), b = w.create(), c = w.create();
    w.positions.add(a, {0, 0});   w.sizes.add(a, {2, 2});
    w.positions.add(b, {1, 1});   w.sizes.add(b, {2, 2});
    w.positions.add(c, {50, 50}); w.sizes.add(c, {2, 2});
    auto hits = collisions(w);
    CHECK_EQ(hits.size(), std::size_t{1});
    CHECK_EQ(hits[0].first, a);
    CHECK_EQ(hits[0].second, b);
}

TEST(touching_edges_are_not_a_collision)
{
    World w;
    Entity a = w.create(), b = w.create();
    w.positions.add(a, {0, 0}); w.sizes.add(a, {2, 2});
    w.positions.add(b, {2, 0}); w.sizes.add(b, {2, 2});
    CHECK_EQ(collisions(w).size(), std::size_t{0});
}
```

```check
file engine/tests/systems_test.cpp
```

## Step 4 — Three systems

**This step: create `engine/systems.h` with `movement`, `lifetime`, `boxes_overlap`, the `Pair` alias and `collisions`. Build and run the tests.**

Requirements, with the traps marked:

- `movement`: loop over `w.velocities`; skip entities without a position; `p.x += v.x * dt`, and the same for `y`.
- `lifetime`: subtract `dt` from each lifetime. **Don't call `w.destroy` inside the loop**: destroying erases from the very map you're walking, which invalidates the loop's iterator (undefined behaviour: maybe a crash, maybe skipped entities, maybe nothing today). Collect the expired ids in a `std::vector`, and destroy them after the loop.
- `boxes_overlap(Position a, Size as, Position b, Size bs)`: two boxes overlap when each one starts before the other ends, on both axes, with `<`.
- `collisions`: first gather every entity with a size and a position into a local `std::vector` of `{entity, position, size}`, then test every pair `i < j` of that vector. Gathering first means the inner loop, which runs `n²/2` times, does no map lookups.

```text
cmake --build engine/build
./engine/build/engine_tests
```

```cpp file=engine/systems.h
// systems.h — behaviour: functions that run over the components.
#pragma once

#include "ecs.h"

#include <utility>
#include <vector>

// Everything with a Position and a Velocity moves.
inline void movement(World& w, float dt)
{
    for (auto& [e, v] : w.velocities) {
        if (!w.positions.has(e))
            continue;
        Position& p = w.positions.get(e);
        p.x += v.x * dt;
        p.y += v.y * dt;
    }
}

// Everything with a Lifetime counts down, and is destroyed at zero.
inline void lifetime(World& w, float dt)
{
    std::vector<Entity> expired;
    for (auto& [e, life] : w.lifetimes) {
        life.seconds -= dt;
        if (life.seconds <= 0)
            expired.push_back(e);
    }
    for (Entity e : expired)  // after the loop: never erase mid-walk
        w.destroy(e);
}

// Do two boxes (top-left corner + size) share any area?
inline bool boxes_overlap(Position a, Size as, Position b, Size bs)
{
    return a.x < b.x + bs.w && b.x < a.x + as.w &&
           a.y < b.y + bs.h && b.y < a.y + as.h;
}

using Pair = std::pair<Entity, Entity>;

// Every overlapping pair (first < second), in order.
// Checks every pair: n * (n - 1) / 2 tests.
inline std::vector<Pair> collisions(const World& w)
{
    struct Body { Entity e; Position p; Size s; };
    std::vector<Body> bodies;  // gathered once: no lookups in the loop
    for (const auto& [e, size] : w.sizes)
        if (w.positions.has(e))
            bodies.push_back({e, w.positions.get(e), size});

    std::vector<Pair> hits;
    for (std::size_t i = 0; i < bodies.size(); ++i)
        for (std::size_t j = i + 1; j < bodies.size(); ++j) {
            const Body& a = bodies[i];
            const Body& b = bodies[j];
            if (boxes_overlap(a.p, a.s, b.p, b.s))
                hits.emplace_back(a.e, b.e);
        }
    return hits;
}
```

### Testing it in the debugger

Systems are ordinary functions, which makes them easy to watch. Put a breakpoint in `lifetime`, run `engine_tests` under the debugger (`lldb ./engine/build/engine_tests` or `gdb`), and print `expired` after the loop. In a class hierarchy, the same logic would be spread over every class's `update`.

```check
run "cmake --build engine/build"
tests "./engine/build/engine_tests" require="movement_moves_by_velocity_times_dt movement_leaves_entities_without_velocity_alone lifetime_destroys_entities_whose_time_ran_out collisions_reports_each_overlapping_pair_once touching_edges_are_not_a_collision" -- Use < (not <=) in the overlap test, and destroy expired entities after the loop.
```

## Step 5 — Your own tests

**This step: write `engine/tests/ecs_own_test.cpp` with two tests of your own, named exactly as below. Build and run.**

- **`ids_are_not_reused_after_destroy`**: create an entity, destroy it, create another; the new id must differ from the old one, and the old one must not be alive. Why it matters: other code may still hold the old id (a homing missile's target). If ids were reused, that missile would silently chase a brand-new entity.
- **`lifetime_keeps_entities_with_time_left`**: an entity with 1 second left, after `lifetime(w, 0.25f)`, is alive with 0.75 s left (use `CHECK_NEAR`; 0.25 happens to be exact in binary, but don't rely on that habit).

Include `systems.h` (it includes `ecs.h`) and `studio_test.hpp`.

```text
cmake --build engine/build
./engine/build/engine_tests
```

```cpp file=engine/tests/ecs_own_test.cpp
// ecs_own_test.cpp — my own tests for the entity world.
#include "systems.h"
#include "studio_test.hpp"

TEST(ids_are_not_reused_after_destroy)
{
    World w;
    Entity old = w.create();
    w.destroy(old);
    Entity fresh = w.create();
    CHECK_NE(fresh, old);  // a stale id can't name the new entity
    CHECK(!w.alive(old));
}

TEST(lifetime_keeps_entities_with_time_left)
{
    World w;
    Entity e = w.create();
    w.lifetimes.add(e, {1.0f});
    lifetime(w, 0.25f);
    CHECK(w.alive(e));
    CHECK_NEAR(w.lifetimes.get(e).seconds, 0.75f, 1e-6);
}
```

```check
run "cmake --build engine/build"
tests "./engine/build/engine_tests" require="ids_are_not_reused_after_destroy lifetime_keeps_entities_with_time_left" -- Name the tests exactly as in the step.
```
