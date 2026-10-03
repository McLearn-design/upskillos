---
title: 3 — Collision and Game Rules
track: Games and Engines
runtime: cpp
reference: optional
console: true
---

Now a whole game, headless: the rules of **Pong**. Paddles move with input, the ball bounces off walls and paddles, a miss scores a point. No window: a test plays the game by feeding it **scripted inputs** and checks the score, which is how engines test gameplay and how replay systems work (record the inputs, not the video).

The game uses lesson 1's fixed timestep: every `step` gets the same `dt`, so a script of inputs always produces the same game.

## Step 1 — The specification of Pong

**This step: create the supplied `engine/tests/pong_test.cpp` and read it.**

### Axis-aligned bounding boxes

Real collision shapes are complicated, so games first test a simple stand-in: the smallest rectangle around the object, with sides parallel to the axes, an **AABB**. Two AABBs overlap exactly when they overlap on *both* axes:

```text
x:  a.x ─────── a.x+a.w
           b.x ─────── b.x+b.w     a.x < b.x+b.w  and
                                   b.x < a.x+a.w
y:  the same test with y and h
```

Four comparisons, no square roots: that's why every engine uses them, at least as a first filter.

**Touching isn't overlapping** (`<`, not `<=`). A box at `x = 0..10` and one at `x = 10..20` share an edge but no area. If touching counted, a ball resting against a wall would collide with it every frame.

### The rules

`Pong` is a struct of public state (paddles, ball, velocity, scores) plus `step(Input, dt)`. The court is 800 × 600, y grows **down** as on screen, and an `Input` holds `-1`, `0` or `+1` for each paddle. Read each test as a scripted moment of play.

```cpp file=engine/tests/pong_test.cpp provided
// pong_test.cpp — the specification of the Pong rules.
#include "pong.h"
#include "studio_test.hpp"

TEST(boxes_overlap_when_they_share_area)
{
    CHECK(overlaps({0, 0, 10, 10}, {5, 5, 10, 10}));
    CHECK(overlaps({0, 0, 10, 10}, {2, 2, 2, 2}));  // inside
    CHECK(!overlaps({0, 0, 10, 10}, {20, 0, 5, 5}));
}

TEST(touching_boxes_do_not_overlap)
{
    CHECK(!overlaps({0, 0, 10, 10}, {10, 0, 10, 10}));
    CHECK(!overlaps({0, 0, 10, 10}, {0, 10, 10, 10}));
}

TEST(paddle_follows_input_and_stops_at_the_wall)
{
    Pong g;
    g.step({+1, 0}, 0.1f);  // down at 400 px/s for 0.1 s
    CHECK_NEAR(g.left.y, 300.0f, 1e-3);
    for (int i = 0; i < 100; ++i)
        g.step({+1, -1}, 0.1f);
    CHECK_EQ(g.left.y, Pong::height - g.left.h);
    CHECK_EQ(g.right.y, 0.0f);
}

TEST(ball_bounces_off_the_top_wall)
{
    Pong g;
    g.ball = {400, 5, 10, 10};
    g.vx = 0;
    g.vy = -200;
    g.step({}, 0.05f);
    CHECK(g.vy > 0);
    CHECK(g.ball.y >= 0);
}

TEST(ball_bounces_off_a_paddle)
{
    Pong g;
    g.ball = {32, 295, 10, 10};  // just right of the left paddle
    g.vx = -300;
    g.step({}, 0.01f);
    CHECK(g.vx > 0);
    CHECK_EQ(g.right_score, 0);
}

TEST(a_missed_ball_scores_for_the_other_player)
{
    Pong g;
    g.left.y = 0;  // out of the ball's way
    for (int i = 0; i < 300 && g.right_score == 0; ++i)
        g.step({}, 0.01f);
    CHECK_EQ(g.right_score, 1);
    CHECK_EQ(g.left_score, 0);
    CHECK_EQ(g.ball.x, 395.0f);  // served from the centre
    CHECK(g.vx > 0);              // towards the player who scored
}
```

```check
file engine/tests/pong_test.cpp
```

## Step 2 — The rules engine

**This step: create `engine/pong.h` with `Box`, `overlaps`, `Input` and `Pong`. Build and run the tests.**

Requirements (the full code is in the reference, if you get stuck):

- Constants: `width = 800`, `height = 600`, `paddle_speed = 400`, `serve_speed = 300`, as `static constexpr float`.
- Starting state: `left{20, 260, 10, 80}`, `right{770, 260, 10, 80}`, `ball{395, 295, 10, 10}`, `vx = -serve_speed`, `vy = 0`, both scores 0.
- `step(in, dt)`: move each paddle by `dir * paddle_speed * dt`, clamped to the court (`std::clamp`), then move the ball once.
- Moving the ball: add velocity × `dt`; off the top or bottom, put it back on the edge and point `vy` back into the court (`std::abs`); hitting a paddle **while moving towards it** reverses `vx` and sets `vy` to `(ball centre − paddle centre) × 8`, so the paddle's ends send the ball off at an angle.
- Scoring: completely past the left edge (`ball.x + ball.w < 0`) is a point for the right player, then `serve(+1)`; past the right edge, a point for the left, `serve(-1)`.
- `serve(direction)`: ball to the centre `((800 − 10) / 2, (600 − 10) / 2)`, `vx = serve_speed * direction`, `vy = 0`.

```text
cmake --build engine/build
./engine/build/engine_tests
```

```cpp file=engine/pong.h
// pong.h — the rules of Pong, with no window: boxes, bounces, scores.
#pragma once

#include <algorithm>
#include <cmath>

// An axis-aligned bounding box: top-left corner, width, height.
// y grows downwards, as on a screen.
struct Box {
    float x = 0, y = 0, w = 0, h = 0;
};

// Do a and b share any area? Touching edges don't count.
inline bool overlaps(const Box& a, const Box& b)
{
    return a.x < b.x + b.w && b.x < a.x + a.w &&
           a.y < b.y + b.h && b.y < a.y + a.h;
}

// One frame's controls: -1 up, +1 down, 0 still.
struct Input {
    int left = 0;
    int right = 0;
};

class Pong {
public:
    static constexpr float width = 800, height = 600;
    static constexpr float paddle_speed = 400;  // pixels per second
    static constexpr float serve_speed = 300;

    Box left{20, 260, 10, 80};
    Box right{770, 260, 10, 80};
    Box ball{395, 295, 10, 10};
    float vx = -serve_speed, vy = 0;
    int left_score = 0, right_score = 0;

    void step(Input in, float dt)
    {
        move_paddle(left, in.left, dt);
        move_paddle(right, in.right, dt);

        move_ball(dt);
    }

    // Ball back to the centre, moving towards one side (-1 or +1).
    void serve(int direction)
    {
        ball.x = (width - ball.w) / 2;
        ball.y = (height - ball.h) / 2;
        vx = serve_speed * direction;
        vy = 0;
    }

private:
    static void move_paddle(Box& p, int dir, float dt)
    {
        p.y = std::clamp(p.y + dir * paddle_speed * dt, 0.0f,
                         height - p.h);
    }

    // Moves the ball once; returns true if someone scored.
    bool move_ball(float dt)
    {
        ball.x += vx * dt;
        ball.y += vy * dt;

        if (ball.y < 0) {
            ball.y = 0;
            vy = std::abs(vy);
        } else if (ball.y + ball.h > height) {
            ball.y = height - ball.h;
            vy = -std::abs(vy);
        }

        // Bounce only while moving towards the paddle.
        if (vx < 0 && overlaps(ball, left)) {
            vx = -vx;
            vy = spin(left);
        } else if (vx > 0 && overlaps(ball, right)) {
            vx = -vx;
            vy = spin(right);
        }

        if (ball.x + ball.w < 0) {
            ++right_score;
            serve(+1);
            return true;
        }
        if (ball.x > width) {
            ++left_score;
            serve(-1);
            return true;
        }
        return false;
    }

    // Hitting near a paddle's end sends the ball off at an angle.
    float spin(const Box& p) const
    {
        float offset = (ball.y + ball.h / 2) - (p.y + p.h / 2);
        return offset * 8;
    }
};
```

```check
run "cmake --build engine/build"
tests "./engine/build/engine_tests" require="boxes_overlap_when_they_share_area touching_boxes_do_not_overlap paddle_follows_input_and_stops_at_the_wall ball_bounces_off_the_top_wall ball_bounces_off_a_paddle a_missed_ball_scores_for_the_other_player" -- Clamp paddles with std::clamp(y, 0.0f, height - p.h), and serve from the centre towards the scorer.
```

## Step 3 — A bug report: the ball went through my paddle

**This step: create the supplied `engine/tests/tunnel_test.cpp`, build, and run the tests. One test fails: that's expected.**

A player reports that late in a rally, when the ball is fast, it sometimes passes straight through the paddle. The test reproduces it: the paddle is right in the ball's path, and the ball moves at 3000 pixels per second.

**Predict, before running:** at `dt = 0.01`, how far does the ball move in one `step`? The paddle is 10 pixels wide and the ball 10. Can they ever overlap?

```text
cmake --build engine/build
./engine/build/engine_tests
```

```cpp file=engine/tests/tunnel_test.cpp provided
// tunnel_test.cpp — a bug report, as a test.
#include "pong.h"
#include "studio_test.hpp"

// "At top speed the ball sometimes goes straight through my paddle."
TEST(a_fast_ball_cannot_pass_through_a_paddle)
{
    Pong g;          // the left paddle is right in the ball's path
    g.vx = -3000;    // 30 pixels per 10 ms update
    for (int i = 0; i < 20; ++i)
        g.step({}, 0.01f);
    CHECK_EQ(g.right_score, 0);
    CHECK(g.vx > 0);  // it bounced
}
```

### What happened

The ball moves **30 pixels per step**. They overlap only while the ball's left edge is between `x = 10` and `x = 30` (the paddle spans 20 to 30; the ball is 10 wide), a window **20 pixels** wide. Watch the ball's left edge, step by step:

```text
x = 65 → 35 → 5      the paddle is at 20..30
         ↑     ↑
   not yet   already past
```

At no moment did the boxes overlap, so `overlaps` was never true. This is **tunnelling**: collision is tested at moments, and a fast object can be on one side at one moment and the other side at the next. It's a classic in real games: bullets through thin walls, players through floors after a long frame.

```check
run "cmake --build engine/build"
run "./engine/build/engine_tests" exit=1 stdout="[  FAILED  ] a_fast_ball_cannot_pass_through_a_paddle" label="the tunnelling test fails, for now"
```

## Step 4 — Fix tunnelling with sub-steps

**This step: change `step` in `engine/pong.h` so the ball never moves more than half its width at a time. Build and run the tests: all pass.**

There are two standard fixes:

| Fix | How | Trade-off |
|---|---|---|
| **sub-stepping** | split a fast move into several small moves, testing each | simple; costs more steps when fast |
| **swept test** | compute *when* during the step the moving box first touches the other (a ray against an enlarged box) | exact and one test; more maths, harder to get right |

Physics engines call the swept version **continuous collision detection** (CCD) and switch it on only for fast, small objects, because it's expensive. For Pong, sub-stepping is plenty:

```cpp
float distance = std::max(std::abs(vx), std::abs(vy)) * dt;
float half = ball.w / 2;
int steps = static_cast<int>(std::ceil(distance / half));
steps = std::max(steps, 1);
for (int i = 0; i < steps; ++i)
    if (move_ball(dt / steps))
        break;
```

- Make `move_ball` (private) return `true` when it scores. After a serve, the rest of this step's distance belongs to the old rally, so stop.
- At 30 pixels per step, that's 6 sub-steps of 5 pixels, so the ball can't skip a 20-pixel window. At normal speed (3 pixels per step) it's still one step, so slow play costs nothing.

```text
cmake --build engine/build
./engine/build/engine_tests
```

```cpp file=engine/pong.h
// pong.h — the rules of Pong, with no window: boxes, bounces, scores.
#pragma once

#include <algorithm>
#include <cmath>

// An axis-aligned bounding box: top-left corner, width, height.
// y grows downwards, as on a screen.
struct Box {
    float x = 0, y = 0, w = 0, h = 0;
};

// Do a and b share any area? Touching edges don't count.
inline bool overlaps(const Box& a, const Box& b)
{
    return a.x < b.x + b.w && b.x < a.x + a.w &&
           a.y < b.y + b.h && b.y < a.y + a.h;
}

// One frame's controls: -1 up, +1 down, 0 still.
struct Input {
    int left = 0;
    int right = 0;
};

class Pong {
public:
    static constexpr float width = 800, height = 600;
    static constexpr float paddle_speed = 400;  // pixels per second
    static constexpr float serve_speed = 300;

    Box left{20, 260, 10, 80};
    Box right{770, 260, 10, 80};
    Box ball{395, 295, 10, 10};
    float vx = -serve_speed, vy = 0;
    int left_score = 0, right_score = 0;

    void step(Input in, float dt)
    {
        move_paddle(left, in.left, dt);
        move_paddle(right, in.right, dt);

        // Never move the ball more than half its size at a time,
        // or a fast ball can jump over a paddle (tunnelling).
        float distance = std::max(std::abs(vx), std::abs(vy)) * dt;
        float half = ball.w / 2;
        int steps = static_cast<int>(std::ceil(distance / half));
        steps = std::max(steps, 1);
        for (int i = 0; i < steps; ++i)
            if (move_ball(dt / steps))
                break;  // a point was scored: the ball was served
    }

    // Ball back to the centre, moving towards one side (-1 or +1).
    void serve(int direction)
    {
        ball.x = (width - ball.w) / 2;
        ball.y = (height - ball.h) / 2;
        vx = serve_speed * direction;
        vy = 0;
    }

private:
    static void move_paddle(Box& p, int dir, float dt)
    {
        p.y = std::clamp(p.y + dir * paddle_speed * dt, 0.0f,
                         height - p.h);
    }

    // Moves the ball once; returns true if someone scored.
    bool move_ball(float dt)
    {
        ball.x += vx * dt;
        ball.y += vy * dt;

        if (ball.y < 0) {
            ball.y = 0;
            vy = std::abs(vy);
        } else if (ball.y + ball.h > height) {
            ball.y = height - ball.h;
            vy = -std::abs(vy);
        }

        // Bounce only while moving towards the paddle.
        if (vx < 0 && overlaps(ball, left)) {
            vx = -vx;
            vy = spin(left);
        } else if (vx > 0 && overlaps(ball, right)) {
            vx = -vx;
            vy = spin(right);
        }

        if (ball.x + ball.w < 0) {
            ++right_score;
            serve(+1);
            return true;
        }
        if (ball.x > width) {
            ++left_score;
            serve(-1);
            return true;
        }
        return false;
    }

    // Hitting near a paddle's end sends the ball off at an angle.
    float spin(const Box& p) const
    {
        float offset = (ball.y + ball.h / 2) - (p.y + p.h / 2);
        return offset * 8;
    }
};
```

```check
run "cmake --build engine/build"
tests "./engine/build/engine_tests" require="a_fast_ball_cannot_pass_through_a_paddle boxes_overlap_when_they_share_area touching_boxes_do_not_overlap paddle_follows_input_and_stops_at_the_wall ball_bounces_off_the_top_wall ball_bounces_off_a_paddle a_missed_ball_scores_for_the_other_player" -- Split the ball move into ceil(distance / (ball.w / 2)) sub-steps of dt / steps each.
```

## Step 5 — A reviewer's tests

**This step: create the supplied `engine/tests/pong_review_test.cpp`, build, and run the tests. If any fail, fix `pong.h`.**

A colleague reviewing your change added four tests, each a bug they've seen in other Pong clones:

- **sticky paddles:** a ball that overlaps a paddle while moving *away* must not bounce again. If `vx` flips on any overlap, a ball caught inside the paddle flips every step and buzzes in place. Bouncing only while moving towards the paddle prevents it.
- **a fast miss still scores:** sub-stepping mustn't stop a point being scored.
- **spin:** hitting near the top of a paddle sends the ball up.
- **repeatability:** two games fed the same 3000 scripted inputs end identically, down to the ball's exact position. This is what makes replays and lock-step networking possible, and what lesson 1's fixed timestep bought.

If your `pong.h` follows the requirements, these pass already; if one fails, its message says which rule to look at.

```text
cmake --build engine/build
./engine/build/engine_tests
```

```cpp file=engine/tests/pong_review_test.cpp provided
// pong_review_test.cpp — a reviewer's tests for the Pong rules.
#include "pong.h"
#include "studio_test.hpp"

TEST(a_ball_inside_a_paddle_does_not_stick)
{
    Pong g;
    g.ball = {25, 295, 10, 10};  // overlapping the left paddle...
    g.vx = 300;                  // ...but already moving away
    for (int i = 0; i < 3; ++i)
        g.step({}, 0.01f);
    CHECK(g.vx > 0);
}

TEST(a_fast_miss_still_scores)
{
    Pong g;
    g.left.y = 0;
    g.vx = -3000;
    for (int i = 0; i < 20; ++i)
        g.step({}, 0.01f);
    CHECK_EQ(g.right_score, 1);
}

TEST(hitting_the_paddle_top_sends_the_ball_up)
{
    Pong g;
    g.ball = {32, 262, 10, 10};  // near the top of the left paddle
    g.vx = -300;
    g.step({}, 0.01f);
    CHECK(g.vx > 0);
    CHECK(g.vy < 0);  // up the screen
}

TEST(scripted_rally_is_repeatable)
{
    // The same inputs must always give the same game.
    auto play = [] {
        Pong g;
        for (int i = 0; i < 3000; ++i)
            g.step({(i / 50) % 2 ? 1 : -1, (i / 70) % 2 ? -1 : 1},
                   0.01f);
        return g;
    };
    Pong a = play(), b = play();
    CHECK_EQ(a.left_score, b.left_score);
    CHECK_EQ(a.right_score, b.right_score);
    CHECK_EQ(a.ball.x, b.ball.x);
}
```

```check
run "cmake --build engine/build"
tests "./engine/build/engine_tests" require="a_ball_inside_a_paddle_does_not_stick a_fast_miss_still_scores hitting_the_paddle_top_sends_the_ball_up scripted_rally_is_repeatable" -- Bounce only while the ball moves towards the paddle (vx < 0 for the left one).
```
