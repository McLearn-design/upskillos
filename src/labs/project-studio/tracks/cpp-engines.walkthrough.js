// What a learner does at each step of the cpp-engines track, for its walkthrough test (walkCppTrack.js).
// Generated with the lessons; see tracks/cpp-foundations.walkthrough.js for the format.
import { configure } from '../walkCppTrack.js';

export const WALKTHROUGH = {
  "01-game-loop#Step 1 \u2014 The test framework": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-game-loop#Step 2 \u2014 The test runner": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-game-loop#Step 3 \u2014 The project's build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-game-loop#Step 4 \u2014 A ball and a fake clock": {
    "run": [
      configure("engine"),
    ],
    "wrong": [
      {
        "name": "did not configure",
        "files": {
          "engine/loop.h": "// loop.h — the timing of a game loop: a ball and a fake clock.\n#pragma once\n\n#include <algorithm>\n#include <cstdint>\n\n// A ball thrown straight up. Units: metres and seconds.\nstruct Ball {\n    double y = 0.0;   // height\n    double vy = 0.0;  // upward speed\n};\n\ninline constexpr double gravity = -9.8;\n\n// Advances the ball by dt seconds (semi-implicit Euler).\ninline void update(Ball& b, double dt)\n{\n    b.vy += gravity * dt;\n    b.y += b.vy * dt;\n}\n\n// A clock for tests: frame k happens at exactly k / fps seconds,\n// counted in whole microseconds.\nclass FakeClock {\npublic:\n    explicit FakeClock(int fps) : fps_(fps) {}\n    std::int64_t now_us() const { return frame_ * 1'000'000 / fps_; }\n    void next_frame() { ++frame_; }\n\nprivate:\n    std::int64_t fps_;\n    std::int64_t frame_ = 0;\n};\n",
        },
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "01-game-loop#Step 5 \u2014 Variable dt: the obvious loop": {
    "wrong": [
      {
        "name": "did not create it",
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "01-game-loop#Step 6 \u2014 The specification of a fixed timestep": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-game-loop#Step 7 \u2014 FixedTimestep": {
    "wrong": [
      {
        "name": "threw the leftover time away",
        "files": {
          "engine/loop.h": "// loop.h — the timing of a game loop: a ball, a fake clock, and a\n// fixed timestep with an accumulator.\n#pragma once\n\n#include <algorithm>\n#include <cstdint>\n\n// A ball thrown straight up. Units: metres and seconds.\nstruct Ball {\n    double y = 0.0;   // height\n    double vy = 0.0;  // upward speed\n};\n\ninline constexpr double gravity = -9.8;\n\n// Advances the ball by dt seconds (semi-implicit Euler).\ninline void update(Ball& b, double dt)\n{\n    b.vy += gravity * dt;\n    b.y += b.vy * dt;\n}\n\n// A clock for tests: frame k happens at exactly k / fps seconds,\n// counted in whole microseconds.\nclass FakeClock {\npublic:\n    explicit FakeClock(int fps) : fps_(fps) {}\n    std::int64_t now_us() const { return frame_ * 1'000'000 / fps_; }\n    void next_frame() { ++frame_; }\n\nprivate:\n    std::int64_t fps_;\n    std::int64_t frame_ = 0;\n};\n\n// Turns real frame times into a whole number of fixed-size updates.\nclass FixedTimestep {\npublic:\n    explicit FixedTimestep(std::int64_t step_us,\n                           std::int64_t max_frame_us = 250'000)\n        : step_us_(step_us), max_frame_us_(max_frame_us) {}\n\n    // Adds one frame's time; returns how many updates to run now.\n    int add_frame(std::int64_t frame_us)\n    {\n        acc_us_ += std::min(frame_us, max_frame_us_);\n        int steps = 0;\n        while (acc_us_ >= step_us_) {\n            acc_us_ -= step_us_;\n            ++steps;\n        }\n        acc_us_ = 0;\n        return steps;\n    }\n\n    // The step in seconds: the dt every update gets.\n    double dt() const { return step_us_ / 1e6; }\n\n    // How far between the last two updates \"now\" is, from 0 to 1.\n    double alpha() const\n    {\n        return static_cast<double>(acc_us_) / step_us_;\n    }\n\nprivate:\n    std::int64_t step_us_;\n    std::int64_t max_frame_us_;\n    std::int64_t acc_us_ = 0;\n};\n\n// Blends two states: t = 0 gives a, t = 1 gives b.\ninline double lerp(double a, double b, double t)\n{\n    return a + (b - a) * t;\n}\n",
        },
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
        ],
      },
      {
        "name": "no clamp on long frames",
        "files": {
          "engine/loop.h": "// loop.h — the timing of a game loop: a ball, a fake clock, and a\n// fixed timestep with an accumulator.\n#pragma once\n\n#include <algorithm>\n#include <cstdint>\n\n// A ball thrown straight up. Units: metres and seconds.\nstruct Ball {\n    double y = 0.0;   // height\n    double vy = 0.0;  // upward speed\n};\n\ninline constexpr double gravity = -9.8;\n\n// Advances the ball by dt seconds (semi-implicit Euler).\ninline void update(Ball& b, double dt)\n{\n    b.vy += gravity * dt;\n    b.y += b.vy * dt;\n}\n\n// A clock for tests: frame k happens at exactly k / fps seconds,\n// counted in whole microseconds.\nclass FakeClock {\npublic:\n    explicit FakeClock(int fps) : fps_(fps) {}\n    std::int64_t now_us() const { return frame_ * 1'000'000 / fps_; }\n    void next_frame() { ++frame_; }\n\nprivate:\n    std::int64_t fps_;\n    std::int64_t frame_ = 0;\n};\n\n// Turns real frame times into a whole number of fixed-size updates.\nclass FixedTimestep {\npublic:\n    explicit FixedTimestep(std::int64_t step_us,\n                           std::int64_t max_frame_us = 250'000)\n        : step_us_(step_us), max_frame_us_(max_frame_us) {}\n\n    // Adds one frame's time; returns how many updates to run now.\n    int add_frame(std::int64_t frame_us)\n    {\n        acc_us_ += frame_us;\n        int steps = 0;\n        while (acc_us_ >= step_us_) {\n            acc_us_ -= step_us_;\n            ++steps;\n        }\n        return steps;\n    }\n\n    // The step in seconds: the dt every update gets.\n    double dt() const { return step_us_ / 1e6; }\n\n    // How far between the last two updates \"now\" is, from 0 to 1.\n    double alpha() const\n    {\n        return static_cast<double>(acc_us_) / step_us_;\n    }\n\nprivate:\n    std::int64_t step_us_;\n    std::int64_t max_frame_us_;\n    std::int64_t acc_us_ = 0;\n};\n\n// Blends two states: t = 0 gives a, t = 1 gives b.\ninline double lerp(double a, double b, double t)\n{\n    return a + (b - a) * t;\n}\n",
        },
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "01-game-loop#Step 8 \u2014 The same throw, at a fixed step": {
    "wrong": [
      {
        "name": "one fixed update per frame",
        "files": {
          "engine/apps/rates.cpp": "// rates.cpp — the same throw, simulated at two frame rates.\n#include \"loop.h\"\n\n#include <cstdio>\n\n// Variable dt: one update per frame, by however long the frame took.\ndouble variable_dt(int fps)\n{\n    FakeClock clock(fps);\n    Ball ball{0.0, 20.0};\n    std::int64_t last = clock.now_us();\n    while (clock.now_us() < 2'000'000) {\n        clock.next_frame();\n        std::int64_t now = clock.now_us();\n        update(ball, (now - last) / 1e6);\n        last = now;\n    }\n    return ball.y;\n}\n\n// Fixed dt: as many 10 ms updates as the frames' time adds up to.\ndouble fixed_dt(int fps)\n{\n    FakeClock clock(fps);\n    FixedTimestep timestep(10'000);\n    Ball ball{0.0, 20.0};\n    Ball previous = ball;\n    std::int64_t last = clock.now_us();\n    while (clock.now_us() < 2'000'000) {\n        clock.next_frame();\n        std::int64_t now = clock.now_us();\n        int steps = 1;\n        last = now;\n        for (int i = 0; i < steps; ++i) {\n            previous = ball;\n            update(ball, timestep.dt());\n        }\n        // Rendering would draw the ball here, between two states:\n        double drawn = lerp(previous.y, ball.y, timestep.alpha());\n        (void)drawn;\n    }\n    return ball.y;\n}\n\nint main()\n{\n    std::printf(\"Thrown up at 20 m/s; height after 2 s.\\n\");\n    std::printf(\"Exact answer: 20.400 m\\n\\n\");\n    for (int fps : {30, 144})\n        std::printf(\"variable dt, %3d fps: y = %.3f m\\n\", fps,\n                    variable_dt(fps));\n    for (int fps : {30, 144})\n        std::printf(\"fixed dt,    %3d fps: y = %.3f m\\n\", fps,\n                    fixed_dt(fps));\n}\n",
        },
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
          2,
        ],
      },
    ],
  },
  "02-entities#Step 1 \u2014 The specification of the world": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-entities#Step 2 \u2014 Store and World": {
    "wrong": [
      {
        "name": "destroy forgets the lifetimes store",
        "files": {
          "engine/ecs.h": "// ecs.h — entities are ids; components live in one store per type.\n#pragma once\n\n#include <cstddef>\n#include <cstdint>\n#include <map>\n#include <set>\n\nusing Entity = std::uint32_t;  // 0 is never an entity\n\n// Every component of one type, looked up by entity.\ntemplate <typename T>\nclass Store {\npublic:\n    void add(Entity e, T value) { items_.insert_or_assign(e, value); }\n    bool has(Entity e) const { return items_.contains(e); }\n    T& get(Entity e) { return items_.at(e); }\n    const T& get(Entity e) const { return items_.at(e); }\n    void remove(Entity e) { items_.erase(e); }\n    std::size_t size() const { return items_.size(); }\n\n    // In entity order: for (auto& [entity, component] : store)\n    auto begin() { return items_.begin(); }\n    auto end() { return items_.end(); }\n    auto begin() const { return items_.begin(); }\n    auto end() const { return items_.end(); }\n\nprivate:\n    std::map<Entity, T> items_;\n};\n\n// Components: plain data, no behaviour.\nstruct Position { float x = 0, y = 0; };\nstruct Velocity { float x = 0, y = 0; };\nstruct Size { float w = 1, h = 1; };     // a collision box\nstruct Lifetime { float seconds = 0; };  // destroyed at zero\n\nclass World {\npublic:\n    Entity create()\n    {\n        Entity e = next_++;\n        alive_.insert(e);\n        return e;\n    }\n\n    void destroy(Entity e)\n    {\n        alive_.erase(e);\n        positions.remove(e);\n        velocities.remove(e);\n        sizes.remove(e);\n    }\n\n    bool alive(Entity e) const { return alive_.contains(e); }\n    std::size_t count() const { return alive_.size(); }\n\n    Store<Position> positions;\n    Store<Velocity> velocities;\n    Store<Size> sizes;\n    Store<Lifetime> lifetimes;\n\nprivate:\n    Entity next_ = 1;\n    std::set<Entity> alive_;\n};\n",
        },
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "02-entities#Step 3 \u2014 The specification of the systems": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-entities#Step 4 \u2014 Three systems": {
    "wrong": [
      {
        "name": "touching boxes collide (<=)",
        "files": {
          "engine/systems.h": "// systems.h — behaviour: functions that run over the components.\n#pragma once\n\n#include \"ecs.h\"\n\n#include <utility>\n#include <vector>\n\n// Everything with a Position and a Velocity moves.\ninline void movement(World& w, float dt)\n{\n    for (auto& [e, v] : w.velocities) {\n        if (!w.positions.has(e))\n            continue;\n        Position& p = w.positions.get(e);\n        p.x += v.x * dt;\n        p.y += v.y * dt;\n    }\n}\n\n// Everything with a Lifetime counts down, and is destroyed at zero.\ninline void lifetime(World& w, float dt)\n{\n    std::vector<Entity> expired;\n    for (auto& [e, life] : w.lifetimes) {\n        life.seconds -= dt;\n        if (life.seconds <= 0)\n            expired.push_back(e);\n    }\n    for (Entity e : expired)  // after the loop: never erase mid-walk\n        w.destroy(e);\n}\n\n// Do two boxes (top-left corner + size) share any area?\ninline bool boxes_overlap(Position a, Size as, Position b, Size bs)\n{\n    return a.x <= b.x + bs.w && b.x <= a.x + as.w &&\n           a.y < b.y + bs.h && b.y < a.y + as.h;\n}\n\nusing Pair = std::pair<Entity, Entity>;\n\n// Every overlapping pair (first < second), in order.\n// Checks every pair: n * (n - 1) / 2 tests.\ninline std::vector<Pair> collisions(const World& w)\n{\n    struct Body { Entity e; Position p; Size s; };\n    std::vector<Body> bodies;  // gathered once: no lookups in the loop\n    for (const auto& [e, size] : w.sizes)\n        if (w.positions.has(e))\n            bodies.push_back({e, w.positions.get(e), size});\n\n    std::vector<Pair> hits;\n    for (std::size_t i = 0; i < bodies.size(); ++i)\n        for (std::size_t j = i + 1; j < bodies.size(); ++j) {\n            const Body& a = bodies[i];\n            const Body& b = bodies[j];\n            if (boxes_overlap(a.p, a.s, b.p, b.s))\n                hits.emplace_back(a.e, b.e);\n        }\n    return hits;\n}\n",
        },
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "02-entities#Step 5 \u2014 Your own tests": {
    "wrong": [
      {
        "name": "tests named differently",
        "files": {
          "engine/tests/ecs_own_test.cpp": "// ecs_own_test.cpp — my own tests for the entity world.\n#include \"systems.h\"\n#include \"studio_test.hpp\"\n\nTEST(fresh_ids)\n{\n    World w;\n    Entity old = w.create();\n    w.destroy(old);\n    Entity fresh = w.create();\n    CHECK_NE(fresh, old);  // a stale id can't name the new entity\n    CHECK(!w.alive(old));\n}\n\nTEST(time_left)\n{\n    World w;\n    Entity e = w.create();\n    w.lifetimes.add(e, {1.0f});\n    lifetime(w, 0.25f);\n    CHECK(w.alive(e));\n    CHECK_NEAR(w.lifetimes.get(e).seconds, 0.75f, 1e-6);\n}\n",
        },
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "03-collision#Step 1 \u2014 The specification of Pong": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-collision#Step 2 \u2014 The rules engine": {
    "wrong": [
      {
        "name": "paddles not clamped",
        "files": {
          "engine/pong.h": "// pong.h — the rules of Pong, with no window: boxes, bounces, scores.\n#pragma once\n\n#include <algorithm>\n#include <cmath>\n\n// An axis-aligned bounding box: top-left corner, width, height.\n// y grows downwards, as on a screen.\nstruct Box {\n    float x = 0, y = 0, w = 0, h = 0;\n};\n\n// Do a and b share any area? Touching edges don't count.\ninline bool overlaps(const Box& a, const Box& b)\n{\n    return a.x < b.x + b.w && b.x < a.x + a.w &&\n           a.y < b.y + b.h && b.y < a.y + a.h;\n}\n\n// One frame's controls: -1 up, +1 down, 0 still.\nstruct Input {\n    int left = 0;\n    int right = 0;\n};\n\nclass Pong {\npublic:\n    static constexpr float width = 800, height = 600;\n    static constexpr float paddle_speed = 400;  // pixels per second\n    static constexpr float serve_speed = 300;\n\n    Box left{20, 260, 10, 80};\n    Box right{770, 260, 10, 80};\n    Box ball{395, 295, 10, 10};\n    float vx = -serve_speed, vy = 0;\n    int left_score = 0, right_score = 0;\n\n    void step(Input in, float dt)\n    {\n        move_paddle(left, in.left, dt);\n        move_paddle(right, in.right, dt);\n\n        move_ball(dt);\n    }\n\n    // Ball back to the centre, moving towards one side (-1 or +1).\n    void serve(int direction)\n    {\n        ball.x = (width - ball.w) / 2;\n        ball.y = (height - ball.h) / 2;\n        vx = serve_speed * direction;\n        vy = 0;\n    }\n\nprivate:\n    static void move_paddle(Box& p, int dir, float dt)\n    {\n        p.y = p.y + dir * paddle_speed * dt;\n    }\n\n    // Moves the ball once; returns true if someone scored.\n    bool move_ball(float dt)\n    {\n        ball.x += vx * dt;\n        ball.y += vy * dt;\n\n        if (ball.y < 0) {\n            ball.y = 0;\n            vy = std::abs(vy);\n        } else if (ball.y + ball.h > height) {\n            ball.y = height - ball.h;\n            vy = -std::abs(vy);\n        }\n\n        // Bounce only while moving towards the paddle.\n        if (vx < 0 && overlaps(ball, left)) {\n            vx = -vx;\n            vy = spin(left);\n        } else if (vx > 0 && overlaps(ball, right)) {\n            vx = -vx;\n            vy = spin(right);\n        }\n\n        if (ball.x + ball.w < 0) {\n            ++right_score;\n            serve(+1);\n            return true;\n        }\n        if (ball.x > width) {\n            ++left_score;\n            serve(-1);\n            return true;\n        }\n        return false;\n    }\n\n    // Hitting near a paddle's end sends the ball off at an angle.\n    float spin(const Box& p) const\n    {\n        float offset = (ball.y + ball.h / 2) - (p.y + p.h / 2);\n        return offset * 8;\n    }\n};\n",
        },
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "03-collision#Step 3 \u2014 A bug report: the ball went through my paddle": {
    "wrong": [
      {
        "name": "did not create it",
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "03-collision#Step 4 \u2014 Fix tunnelling with sub-steps": {
    "wrong": [
      {
        "name": "sub-steps the full dt each time",
        "files": {
          "engine/pong.h": "// pong.h — the rules of Pong, with no window: boxes, bounces, scores.\n#pragma once\n\n#include <algorithm>\n#include <cmath>\n\n// An axis-aligned bounding box: top-left corner, width, height.\n// y grows downwards, as on a screen.\nstruct Box {\n    float x = 0, y = 0, w = 0, h = 0;\n};\n\n// Do a and b share any area? Touching edges don't count.\ninline bool overlaps(const Box& a, const Box& b)\n{\n    return a.x < b.x + b.w && b.x < a.x + a.w &&\n           a.y < b.y + b.h && b.y < a.y + a.h;\n}\n\n// One frame's controls: -1 up, +1 down, 0 still.\nstruct Input {\n    int left = 0;\n    int right = 0;\n};\n\nclass Pong {\npublic:\n    static constexpr float width = 800, height = 600;\n    static constexpr float paddle_speed = 400;  // pixels per second\n    static constexpr float serve_speed = 300;\n\n    Box left{20, 260, 10, 80};\n    Box right{770, 260, 10, 80};\n    Box ball{395, 295, 10, 10};\n    float vx = -serve_speed, vy = 0;\n    int left_score = 0, right_score = 0;\n\n    void step(Input in, float dt)\n    {\n        move_paddle(left, in.left, dt);\n        move_paddle(right, in.right, dt);\n\n        // Never move the ball more than half its size at a time,\n        // or a fast ball can jump over a paddle (tunnelling).\n        float distance = std::max(std::abs(vx), std::abs(vy)) * dt;\n        float half = ball.w / 2;\n        int steps = static_cast<int>(std::ceil(distance / half));\n        steps = std::max(steps, 1);\n        for (int i = 0; i < steps; ++i)\n            if (move_ball(dt))\n                break;  // a point was scored: the ball was served\n    }\n\n    // Ball back to the centre, moving towards one side (-1 or +1).\n    void serve(int direction)\n    {\n        ball.x = (width - ball.w) / 2;\n        ball.y = (height - ball.h) / 2;\n        vx = serve_speed * direction;\n        vy = 0;\n    }\n\nprivate:\n    static void move_paddle(Box& p, int dir, float dt)\n    {\n        p.y = std::clamp(p.y + dir * paddle_speed * dt, 0.0f,\n                         height - p.h);\n    }\n\n    // Moves the ball once; returns true if someone scored.\n    bool move_ball(float dt)\n    {\n        ball.x += vx * dt;\n        ball.y += vy * dt;\n\n        if (ball.y < 0) {\n            ball.y = 0;\n            vy = std::abs(vy);\n        } else if (ball.y + ball.h > height) {\n            ball.y = height - ball.h;\n            vy = -std::abs(vy);\n        }\n\n        // Bounce only while moving towards the paddle.\n        if (vx < 0 && overlaps(ball, left)) {\n            vx = -vx;\n            vy = spin(left);\n        } else if (vx > 0 && overlaps(ball, right)) {\n            vx = -vx;\n            vy = spin(right);\n        }\n\n        if (ball.x + ball.w < 0) {\n            ++right_score;\n            serve(+1);\n            return true;\n        }\n        if (ball.x > width) {\n            ++left_score;\n            serve(-1);\n            return true;\n        }\n        return false;\n    }\n\n    // Hitting near a paddle's end sends the ball off at an angle.\n    float spin(const Box& p) const\n    {\n        float offset = (ball.y + ball.h / 2) - (p.y + p.h / 2);\n        return offset * 8;\n    }\n};\n",
        },
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "03-collision#Step 5 \u2014 A reviewer's tests": {
    "wrong": [
      {
        "name": "bounces on any overlap",
        "files": {
          "engine/tests/pong_review_test.cpp": "// pong_review_test.cpp — a reviewer's tests for the Pong rules.\n#include \"pong.h\"\n#include \"studio_test.hpp\"\n\nTEST(a_ball_inside_a_paddle_does_not_stick)\n{\n    Pong g;\n    g.ball = {25, 295, 10, 10};  // overlapping the left paddle...\n    g.vx = 300;                  // ...but already moving away\n    for (int i = 0; i < 3; ++i)\n        g.step({}, 0.01f);\n    CHECK(g.vx > 0);\n}\n\nTEST(a_fast_miss_still_scores)\n{\n    Pong g;\n    g.left.y = 0;\n    g.vx = -3000;\n    for (int i = 0; i < 20; ++i)\n        g.step({}, 0.01f);\n    CHECK_EQ(g.right_score, 1);\n}\n\nTEST(hitting_the_paddle_top_sends_the_ball_up)\n{\n    Pong g;\n    g.ball = {32, 262, 10, 10};  // near the top of the left paddle\n    g.vx = -300;\n    g.step({}, 0.01f);\n    CHECK(g.vx > 0);\n    CHECK(g.vy < 0);  // up the screen\n}\n\nTEST(scripted_rally_is_repeatable)\n{\n    // The same inputs must always give the same game.\n    auto play = [] {\n        Pong g;\n        for (int i = 0; i < 3000; ++i)\n            g.step({(i / 50) % 2 ? 1 : -1, (i / 70) % 2 ? -1 : 1},\n                   0.01f);\n        return g;\n    };\n    Pong a = play(), b = play();\n    CHECK_EQ(a.left_score, b.left_score);\n    CHECK_EQ(a.right_score, b.right_score);\n    CHECK_EQ(a.ball.x, b.ball.x);\n}\n",
          "engine/pong.h": "// pong.h — the rules of Pong, with no window: boxes, bounces, scores.\n#pragma once\n\n#include <algorithm>\n#include <cmath>\n\n// An axis-aligned bounding box: top-left corner, width, height.\n// y grows downwards, as on a screen.\nstruct Box {\n    float x = 0, y = 0, w = 0, h = 0;\n};\n\n// Do a and b share any area? Touching edges don't count.\ninline bool overlaps(const Box& a, const Box& b)\n{\n    return a.x < b.x + b.w && b.x < a.x + a.w &&\n           a.y < b.y + b.h && b.y < a.y + a.h;\n}\n\n// One frame's controls: -1 up, +1 down, 0 still.\nstruct Input {\n    int left = 0;\n    int right = 0;\n};\n\nclass Pong {\npublic:\n    static constexpr float width = 800, height = 600;\n    static constexpr float paddle_speed = 400;  // pixels per second\n    static constexpr float serve_speed = 300;\n\n    Box left{20, 260, 10, 80};\n    Box right{770, 260, 10, 80};\n    Box ball{395, 295, 10, 10};\n    float vx = -serve_speed, vy = 0;\n    int left_score = 0, right_score = 0;\n\n    void step(Input in, float dt)\n    {\n        move_paddle(left, in.left, dt);\n        move_paddle(right, in.right, dt);\n\n        // Never move the ball more than half its size at a time,\n        // or a fast ball can jump over a paddle (tunnelling).\n        float distance = std::max(std::abs(vx), std::abs(vy)) * dt;\n        float half = ball.w / 2;\n        int steps = static_cast<int>(std::ceil(distance / half));\n        steps = std::max(steps, 1);\n        for (int i = 0; i < steps; ++i)\n            if (move_ball(dt / steps))\n                break;  // a point was scored: the ball was served\n    }\n\n    // Ball back to the centre, moving towards one side (-1 or +1).\n    void serve(int direction)\n    {\n        ball.x = (width - ball.w) / 2;\n        ball.y = (height - ball.h) / 2;\n        vx = serve_speed * direction;\n        vy = 0;\n    }\n\nprivate:\n    static void move_paddle(Box& p, int dir, float dt)\n    {\n        p.y = std::clamp(p.y + dir * paddle_speed * dt, 0.0f,\n                         height - p.h);\n    }\n\n    // Moves the ball once; returns true if someone scored.\n    bool move_ball(float dt)\n    {\n        ball.x += vx * dt;\n        ball.y += vy * dt;\n\n        if (ball.y < 0) {\n            ball.y = 0;\n            vy = std::abs(vy);\n        } else if (ball.y + ball.h > height) {\n            ball.y = height - ball.h;\n            vy = -std::abs(vy);\n        }\n\n        // Bounce only while moving towards the paddle.\n        if (overlaps(ball, left)) {\n            vx = -vx;\n            vy = spin(left);\n        } else if (overlaps(ball, right)) {\n            vx = -vx;\n            vy = spin(right);\n        }\n\n        if (ball.x + ball.w < 0) {\n            ++right_score;\n            serve(+1);\n            return true;\n        }\n        if (ball.x > width) {\n            ++left_score;\n            serve(-1);\n            return true;\n        }\n        return false;\n    }\n\n    // Hitting near a paddle's end sends the ball off at an angle.\n    float spin(const Box& p) const\n    {\n        float offset = (ball.y + ball.h / 2) - (p.y + p.h / 2);\n        return offset * 8;\n    }\n};\n",
        },
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "04-data-oriented#Step 1 \u2014 The specification: two layouts, one world": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-data-oriented#Step 2 \u2014 Particles, both ways": {
    "wrong": [
      {
        "name": "SoA draws the numbers in a different order",
        "files": {
          "engine/particles.h": "// particles.h — one simulation, two memory layouts.\n#pragma once\n\n#include <array>\n#include <cstddef>\n#include <cstdint>\n#include <vector>\n\n// A tiny random number generator with the same output everywhere\n// (std::uniform_real_distribution may differ between libraries).\nstruct Rng {\n    std::uint32_t state;\n    float next()  // in [0, 1)\n    {\n        state = state * 1664525u + 1013904223u;\n        return static_cast<float>(state >> 8) * (1.0f / 16777216.0f);\n    }\n};\n\ninline constexpr float particle_gravity = -9.8f;\n\n// Array of structs: each particle's fields side by side.\nstruct ParticleAoS {\n    float x, y, vx, vy;           // hot: used every update\n    float r, g, b, a, age, size;  // cold: used only for drawing\n    std::array<char, 24> name;\n};\n\n// Struct of arrays: each field in its own array.\nstruct ParticlesSoA {\n    std::vector<float> x, y, vx, vy;\n    std::vector<float> r, g, b, a, age, size;\n    std::vector<std::array<char, 24>> name;\n    std::size_t count() const { return x.size(); }\n};\n\ninline std::vector<ParticleAoS> make_aos(std::size_t n,\n                                         std::uint32_t seed)\n{\n    Rng rng{seed};\n    std::vector<ParticleAoS> ps(n);\n    for (auto& p : ps) {\n        p.x = rng.next() * 100;\n        p.y = rng.next() * 100;\n        p.vx = rng.next() * 20 - 10;\n        p.vy = rng.next() * 20 - 10;\n        p.r = p.g = p.b = p.a = 1;\n        p.age = 0;\n        p.size = 1;\n        p.name = {};\n    }\n    return ps;\n}\n\n// The same particles: the generator is called in the same order.\ninline ParticlesSoA make_soa(std::size_t n, std::uint32_t seed)\n{\n    Rng rng{seed};\n    ParticlesSoA ps;\n    for (std::size_t i = 0; i < n; ++i) {\n        ps.y.push_back(rng.next() * 100);\n        ps.x.push_back(rng.next() * 100);\n        ps.vx.push_back(rng.next() * 20 - 10);\n        ps.vy.push_back(rng.next() * 20 - 10);\n    }\n    for (auto* v : {&ps.r, &ps.g, &ps.b, &ps.a, &ps.size})\n        v->assign(n, 1.0f);\n    ps.age.assign(n, 0.0f);\n    ps.name.assign(n, {});\n    return ps;\n}\n\n// Gravity, movement, and a bounce off the floor at y = 0.\ninline void update(std::vector<ParticleAoS>& ps, float dt)\n{\n    for (auto& p : ps) {\n        float vy = p.vy + particle_gravity * dt;\n        float y = p.y + vy * dt;\n        bool below = y < 0;  // bounce: mirror, and lose half the speed\n        p.x += p.vx * dt;\n        p.y = below ? -y : y;\n        p.vy = below ? -vy * 0.5f : vy;\n    }\n}\n\ninline void update(ParticlesSoA& ps, float dt)\n{\n    const std::size_t n = ps.count();\n    float* x = ps.x.data();\n    float* y = ps.y.data();\n    const float* vx = ps.vx.data();\n    float* vy = ps.vy.data();\n    for (std::size_t i = 0; i < n; ++i) {\n        float v = vy[i] + particle_gravity * dt;\n        float h = y[i] + v * dt;\n        bool below = h < 0;\n        x[i] += vx[i] * dt;\n        y[i] = below ? -h : h;\n        vy[i] = below ? -v * 0.5f : v;\n    }\n}\n\n// Sum of every position, in order: equal sums mean equal worlds\n// (almost certainly; a checksum can't prove it).\ninline double checksum(const std::vector<ParticleAoS>& ps)\n{\n    double sum = 0;\n    for (const auto& p : ps)\n        sum += static_cast<double>(p.x) + p.y;\n    return sum;\n}\n\ninline double checksum(const ParticlesSoA& ps)\n{\n    double sum = 0;\n    for (std::size_t i = 0; i < ps.count(); ++i)\n        sum += static_cast<double>(ps.x[i]) + ps.y[i];\n    return sum;\n}\n",
        },
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "04-data-oriented#Step 3 \u2014 The benchmark": {
    "wrong": [
      {
        "name": "did not create it",
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "04-data-oriented#Step 4 \u2014 Removing objects without breaking ids": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-data-oriented#Step 5 \u2014 DenseStore": {
    "wrong": [
      {
        "name": "forgot to update the moved id",
        "files": {
          "engine/dense.h": "// dense.h — items packed in one array, found by ids that never\n// change.\n#pragma once\n\n#include <cstddef>\n#include <cstdint>\n#include <unordered_map>\n#include <utility>\n#include <vector>\n\ntemplate <typename T>\nclass DenseStore {\npublic:\n    using Id = std::uint32_t;  // 0 is never an id\n\n    Id add(T value)\n    {\n        Id id = next_++;\n        index_of_[id] = items_.size();\n        items_.push_back(std::move(value));\n        ids_.push_back(id);\n        return id;\n    }\n\n    bool has(Id id) const { return index_of_.contains(id); }\n    T& get(Id id) { return items_[index_of_.at(id)]; }\n    const T& get(Id id) const { return items_[index_of_.at(id)]; }\n\n    // Swap and pop: the last item moves into the hole. O(1).\n    void remove(Id id)\n    {\n        auto found = index_of_.find(id);\n        if (found == index_of_.end())\n            return;\n        std::size_t hole = found->second;\n        std::size_t last = items_.size() - 1;\n        if (hole != last) {\n            items_[hole] = std::move(items_[last]);\n            ids_[hole] = ids_[last];\n        }\n        items_.pop_back();\n        ids_.pop_back();\n        index_of_.erase(id);\n    }\n\n    std::size_t size() const { return items_.size(); }\n\n    // Packed, for fast loops: items()[i] belongs to ids()[i].\n    std::vector<T>& items() { return items_; }\n    const std::vector<T>& items() const { return items_; }\n    const std::vector<Id>& ids() const { return ids_; }\n\nprivate:\n    std::vector<T> items_;\n    std::vector<Id> ids_;\n    std::unordered_map<Id, std::size_t> index_of_;\n    Id next_ = 1;\n};\n",
        },
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "05-profiling#Step 1 \u2014 The specification of the profiler": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-profiling#Step 2 \u2014 Profiler and ScopedTimer": {
    "wrong": [
      {
        "name": "names not escaped",
        "files": {
          "engine/profiler.h": "// profiler.h — RAII scope timers, saved as a Chrome trace.\n#pragma once\n\n#include <chrono>\n#include <cstdint>\n#include <functional>\n#include <ostream>\n#include <string>\n#include <utility>\n#include <vector>\n\n// One timed scope: when it started and how long it took.\nstruct TraceEvent {\n    std::string name;\n    std::int64_t start_us;\n    std::int64_t duration_us;\n};\n\ninline std::int64_t steady_now_us()\n{\n    using namespace std::chrono;\n    return duration_cast<microseconds>(\n               steady_clock::now().time_since_epoch())\n        .count();\n}\n\nclass Profiler {\npublic:\n    using Clock = std::function<std::int64_t()>;\n\n    // Tests pass a fake clock; games use the real one.\n    explicit Profiler(Clock clock = steady_now_us)\n        : clock_(std::move(clock)) {}\n\n    std::int64_t now() const { return clock_(); }\n\n    void record(std::string name, std::int64_t start,\n                std::int64_t duration)\n    {\n        events_.push_back({std::move(name), start, duration});\n    }\n\n    const std::vector<TraceEvent>& events() const { return events_; }\n\n    // All the time spent in scopes with this name.\n    std::int64_t total_us(const std::string& name) const\n    {\n        std::int64_t sum = 0;\n        for (const auto& e : events_)\n            if (e.name == name)\n                sum += e.duration_us;\n        return sum;\n    }\n\n    // The Trace Event Format that chrome://tracing and Perfetto read.\n    void write_chrome_json(std::ostream& out) const\n    {\n        out << \"{\\\"traceEvents\\\":[\";\n        for (std::size_t i = 0; i < events_.size(); ++i) {\n            const auto& e = events_[i];\n            out << (i ? \",\\n\" : \"\\n\") << \"{\\\"name\\\":\\\"\"\n                << escaped(e.name) << \"\\\",\\\"ph\\\":\\\"X\\\",\\\"ts\\\":\"\n                << e.start_us << \",\\\"dur\\\":\" << e.duration_us\n                << \",\\\"pid\\\":1,\\\"tid\\\":1}\";\n        }\n        out << \"\\n]}\\n\";\n    }\n\nprivate:\n    static std::string escaped(const std::string& s)\n    {\n        std::string out;\n        for (char c : s) {\n            out += c;\n        }\n        return out;\n    }\n\n    Clock clock_;\n    std::vector<TraceEvent> events_;\n};\n\n// Times its own lifetime: from construction to the end of the scope,\n// however the scope ends (return, break, exception).\nclass ScopedTimer {\npublic:\n    ScopedTimer(Profiler& profiler, std::string name)\n        : profiler_(profiler), name_(std::move(name)),\n          start_(profiler.now()) {}\n\n    ~ScopedTimer()\n    {\n        profiler_.record(std::move(name_), start_,\n                         profiler_.now() - start_);\n    }\n\n    ScopedTimer(const ScopedTimer&) = delete;\n    ScopedTimer& operator=(const ScopedTimer&) = delete;\n\nprivate:\n    Profiler& profiler_;\n    std::string name_;\n    std::int64_t start_;\n};\n\n// PROFILE_SCOPE(p, \"physics\"); times the rest of the enclosing block.\n// The two-step join makes a unique variable name from the line number.\n#define PROFILE_JOIN2(a, b) a##b\n#define PROFILE_JOIN(a, b) PROFILE_JOIN2(a, b)\n#define PROFILE_SCOPE(profiler, name) \\\n    ScopedTimer PROFILE_JOIN(profile_scope_, __LINE__)(profiler, name)\n",
        },
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "05-profiling#Step 3 \u2014 Profile a frame": {
    "wrong": [
      {
        "name": "did not create it",
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
          2,
          3,
        ],
      },
    ],
  },
  "05-profiling#Step 4 \u2014 A reviewer's tests for a faster collision system": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-profiling#Step 5 \u2014 Challenge: a grid broad phase": {
    "wrong": [
      {
        "name": "duplicates not removed",
        "files": {
          "engine/broadphase.h": "// broadphase.h — collisions with a uniform grid: only boxes that\n// share a grid cell are tested against each other.\n#pragma once\n\n#include \"systems.h\"\n\n#include <algorithm>\n#include <cmath>\n#include <cstdint>\n#include <unordered_map>\n#include <vector>\n\n// The same answer as collisions(w), usually far faster.\n// cell: the grid's cell size; about the size of a typical box.\ninline std::vector<Pair> collisions_grid(const World& w, float cell)\n{\n    struct Body { Entity e; Position p; Size s; };\n    std::vector<Body> bodies;\n    for (const auto& [e, size] : w.sizes)\n        if (w.positions.has(e))\n            bodies.push_back({e, w.positions.get(e), size});\n\n    // Every cell a box touches gets the box's index.\n    auto key = [](std::int64_t cx, std::int64_t cy) {\n        return (cx << 32) ^ (cy & 0xffffffff);\n    };\n    std::unordered_map<std::int64_t, std::vector<std::size_t>> grid;\n    for (std::size_t i = 0; i < bodies.size(); ++i) {\n        const Body& b = bodies[i];\n        auto x0 = static_cast<std::int64_t>(std::floor(b.p.x / cell));\n        auto y0 = static_cast<std::int64_t>(std::floor(b.p.y / cell));\n        auto x1 = static_cast<std::int64_t>(\n            std::floor((b.p.x + b.s.w) / cell));\n        auto y1 = static_cast<std::int64_t>(\n            std::floor((b.p.y + b.s.h) / cell));\n        for (auto cx = x0; cx <= x1; ++cx)\n            for (auto cy = y0; cy <= y1; ++cy)\n                grid[key(cx, cy)].push_back(i);\n    }\n\n    // Test pairs within each cell. Boxes sharing several cells are\n    // found more than once, so sort and remove the repeats.\n    std::vector<Pair> hits;\n    for (const auto& [k, members] : grid)\n        for (std::size_t i = 0; i < members.size(); ++i)\n            for (std::size_t j = i + 1; j < members.size(); ++j) {\n                const Body& a = bodies[members[i]];\n                const Body& b = bodies[members[j]];\n                if (boxes_overlap(a.p, a.s, b.p, b.s))\n                    hits.emplace_back(std::min(a.e, b.e),\n                                      std::max(a.e, b.e));\n            }\n    std::sort(hits.begin(), hits.end());\n    return hits;\n}\n",
        },
        "run": [
          configure("engine"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "05-profiling#Step 6 \u2014 Profile again": {
    "wrong": [
      {
        "name": "did not add the grid scope",
        "files": {
          "engine/apps/profiled_game.cpp": "// profiled_game.cpp — a busy world, every system timed.\n#include \"broadphase.h\"\n#include \"particles.h\"  // for Rng\n#include \"profiler.h\"\n#include \"systems.h\"\n\n#include <cstdio>\n#include <fstream>\n\n// 2,000 boxes scattered over a 1000 x 1000 field; half of them\n// are sparks that burn out.\nWorld make_world()\n{\n    World w;\n    Rng rng{1};\n    for (int i = 0; i < 2000; ++i) {\n        Entity e = w.create();\n        w.positions.add(e, {rng.next() * 1000, rng.next() * 1000});\n        w.velocities.add(e, {rng.next() * 40 - 20,\n                             rng.next() * 40 - 20});\n        w.sizes.add(e, {4, 4});\n        if (i % 2)\n            w.lifetimes.add(e, {rng.next() * 2});\n    }\n    return w;\n}\n\nint main()\n{\n    Profiler profiler;\n    World world = make_world();\n    std::size_t hits = 0;\n    bool same = true;\n\n    for (int frame = 0; frame < 60; ++frame) {\n        PROFILE_SCOPE(profiler, \"frame\");\n        {\n            PROFILE_SCOPE(profiler, \"movement\");\n            movement(world, 1.0f / 60);\n        }\n        {\n            PROFILE_SCOPE(profiler, \"lifetime\");\n            lifetime(world, 1.0f / 60);\n        }\n        std::vector<Pair> slow, fast;\n        {\n            PROFILE_SCOPE(profiler, \"collisions\");\n            slow = collisions(world);\n        }\n        {\n            \n            fast = collisions_grid(world, 8);\n        }\n        hits += fast.size();\n        same = same && fast == slow;\n    }\n\n    std::printf(\"entities left: %zu, collisions seen: %zu\\n\",\n                world.count(), hits);\n    for (const char* name : {\"movement\", \"lifetime\", \"collisions\",\n                             \"collisions_grid\"})\n        std::printf(\"%-15s %8.2f ms\\n\", name,\n                    profiler.total_us(name) / 1000.0);\n\n    std::printf(\"grid matches all pairs: %s\\n\", same ? \"yes\" : \"NO\");\n\n    std::ofstream out(\"trace.json\");\n    profiler.write_chrome_json(out);\n    std::printf(\"wrote trace.json (%zu events)\\n\",\n                profiler.events().size());\n}\n",
        },
        "run": [
          configure("engine"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
};
