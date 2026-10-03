---
title: 5 — Matrices: Move, Turn, Scale
track: Graphics from First Principles
runtime: cpp
reference: optional
console: true
---

A model is drawn many times in many places: twelve tick marks on a clock, a thousand trees in a forest, the same cube turning a little more each frame. You don't store each copy's corners. You store the shape once and a **transform** for each copy: how to move, turn and scale it.

A transform is a **matrix**, and the reason is composition: "turn, then scale, then move" multiplies three matrices into **one**, which then transforms every corner with a few multiplications each. A GPU multiplies matrices by vectors billions of times a second.

| Transform | Written | Effect on (x, y) |
|---|---|---|
| translate | `translate(Vec2{tx, ty})` | (x + tx, y + ty) |
| scale | `scale(Vec2{sx, sy})` | (x · sx, y · sy) |
| rotate | `rotate(angle)` | turned anticlockwise about the origin |

This lesson works in 2D with 3 × 3 matrices. Lesson 6 does the same in 3D with 4 × 4.

## Step 1 — The specification

**This step: create the supplied `raster/tests/mat3_test.cpp` and read it.**

### Why 3 × 3 for 2D?

Rotating and scaling are **linear**: each new coordinate is a sum of multiples of the old ones, which a 2 × 2 matrix can do. Moving is not: `x + tx` adds a constant, and no 2 × 2 matrix adds a constant.

The trick is **homogeneous coordinates**: write the point (x, y) as the column (x, y, 1). The extra 1 gives the matrix a column to keep the translation in:

```text
[ 1  0  tx ] [ x ]   [ x + tx ]
[ 0  1  ty ] [ y ] = [ y + ty ]
[ 0  0  1  ] [ 1 ]   [   1    ]
```

A **direction** (an arrow, not a place) is written with 0 instead: (x, y, 0). Then the translation column is multiplied by 0, and moving doesn't change it, which is right: "north" is north wherever you stand. `transform_point` uses w = 1 and `transform_vector` uses w = 0; one test checks both.

### Which one is applied first?

The vector goes on the **right**: `M * p`. So in `A * B * p`, `B` touches `p` first. `translate(...) * rotate(...)` means *rotate, then translate*: read right to left. The last test pins that down.

```cpp file=raster/tests/mat3_test.cpp provided
// Provided by the lesson: what Mat3 and the 2D transforms must do.
#include "studio_test.hpp"

#include <numbers>

#include "mat.h"
#include "vec.h"

namespace {

constexpr double pi = std::numbers::pi;

void check_near(Vec2 got, Vec2 want)
{
    CHECK_NEAR(got.x, want.x, 1e-12);
    CHECK_NEAR(got.y, want.y, 1e-12);
}

} // namespace

TEST(a_new_matrix_is_the_identity)
{
    const Mat3 id;
    CHECK_EQ(transform_point(id, Vec2{3, -4}), (Vec2{3, -4}));
    CHECK_EQ(id * id, id);
}

TEST(matrix_multiplication_is_rows_times_columns)
{
    Mat3 a;
    a.m[0][1] = 2;   // [1 2 0]
    a.m[1][0] = 3;   // [3 1 0]
    Mat3 b;          // [0 0 1]
    b.m[0][2] = 5;
    const Mat3 r = a * b;
    CHECK_EQ(r.m[0][1], 2.0);
    CHECK_EQ(r.m[0][2], 5.0);    // row 0 of a . column 2 of b
    CHECK_EQ(r.m[1][2], 15.0);   // row 1 of a . column 2 of b
    CHECK_EQ(r.m[2][2], 1.0);
}

TEST(translate_moves_points_but_not_vectors)
{
    const Mat3 t = translate(Vec2{10, 20});
    CHECK_EQ(transform_point(t, Vec2{1, 2}), (Vec2{11, 22}));
    CHECK_EQ(transform_vector(t, Vec2{1, 2}), (Vec2{1, 2}));
}

TEST(scale_multiplies_each_axis)
{
    const Mat3 s = scale(Vec2{2, 3});
    CHECK_EQ(transform_point(s, Vec2{4, 5}), (Vec2{8, 15}));
    CHECK_EQ(transform_vector(s, Vec2{4, 5}), (Vec2{8, 15}));
}

TEST(rotate_turns_anticlockwise)
{
    const Mat3 r = rotate(pi / 2);   // a quarter turn
    check_near(transform_point(r, Vec2{1, 0}), Vec2{0, 1});
    check_near(transform_point(r, Vec2{0, 1}), Vec2{-1, 0});
}

TEST(rotation_keeps_lengths)
{
    const Vec2 v = transform_vector(rotate(0.7), Vec2{3, 4});
    CHECK_NEAR(length(v), 5.0, 1e-12);
}

TEST(the_right_hand_matrix_is_applied_first)
{
    // (translate * rotate) * p == translate(rotate(p))
    const Mat3 m = translate(Vec2{3, 0}) * rotate(pi / 2);
    check_near(transform_point(m, Vec2{1, 0}), Vec2{3, 1});
}
```

```check
file raster/tests/mat3_test.cpp
```

## Step 2 — Mat3

**This step: create `raster/mat.h` with `Mat3`, its `*` and `<<`, `transform_point`, `transform_vector`, `translate`, `scale` and `rotate`. Build and run the tests.**

```cpp
struct Mat3 {
    double m[3][3] = {{1, 0, 0}, {0, 1, 0}, {0, 0, 1}};   // identity
    bool operator==(const Mat3&) const = default;
};
```

`m[row][column]`. The default value is the **identity**, the matrix that changes nothing, so `Mat3 r;` is a blank transform to fill in. A defaulted `==` compares arrays element by element.

### Multiplying

Entry (i, j) of `a * b` is row i of `a` dotted with column j of `b`:

```cpp
inline Mat3 operator*(const Mat3& a, const Mat3& b)
{
    Mat3 r;
    for (int i = 0; i < 3; ++i) {
        for (int j = 0; j < 3; ++j) {
            r.m[i][j] = 0;
            for (int k = 0; k < 3; ++k)
                r.m[i][j] += a.m[i][k] * b.m[k][j];
        }
    }
    return r;
}
```

`transform_point(a, p)` is the same idea with the column (p.x, p.y, 1), keeping the first two results. `transform_vector` uses (v.x, v.y, 0).

### Rotation

Turning (1, 0) anticlockwise by angle θ lands on (cos θ, sin θ); turning (0, 1) lands on (−sin θ, cos θ). A matrix's **columns** are where it sends the axes, so:

```text
rotate(θ) = [ cos θ  -sin θ  0 ]
            [ sin θ   cos θ  0 ]
            [   0       0    1 ]
```

`translate` and `scale` start from the identity and set two entries each. `operator<<` prints the three rows on separate lines, so a failing `CHECK_EQ` on matrices is readable.

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/mat.h
// mat.h: matrices for 2D and 3D transforms.
#pragma once

#include <cmath>
#include <ostream>

#include "vec.h"

// A 3 x 3 matrix for 2D transforms, in homogeneous coordinates: the
// point (x, y) is the column (x, y, 1). m[row][column].
struct Mat3 {
    double m[3][3] = {{1, 0, 0}, {0, 1, 0}, {0, 0, 1}};   // identity

    bool operator==(const Mat3&) const = default;
};

inline Mat3 operator*(const Mat3& a, const Mat3& b)
{
    Mat3 r;
    for (int i = 0; i < 3; ++i) {
        for (int j = 0; j < 3; ++j) {
            r.m[i][j] = 0;
            for (int k = 0; k < 3; ++k)
                r.m[i][j] += a.m[i][k] * b.m[k][j];
        }
    }
    return r;
}

inline std::ostream& operator<<(std::ostream& out, const Mat3& a)
{
    for (int i = 0; i < 3; ++i)
        out << '\n' << a.m[i][0] << ' ' << a.m[i][1] << ' ' << a.m[i][2];
    return out;
}

// A point has w = 1, so the matrix's last column (the translation)
// moves it.
inline Vec2 transform_point(const Mat3& a, Vec2 p)
{
    return {a.m[0][0] * p.x + a.m[0][1] * p.y + a.m[0][2],
            a.m[1][0] * p.x + a.m[1][1] * p.y + a.m[1][2]};
}

// A direction has w = 0: translation doesn't change it.
inline Vec2 transform_vector(const Mat3& a, Vec2 v)
{
    return {a.m[0][0] * v.x + a.m[0][1] * v.y,
            a.m[1][0] * v.x + a.m[1][1] * v.y};
}

inline Mat3 translate(Vec2 t)
{
    Mat3 r;
    r.m[0][2] = t.x;
    r.m[1][2] = t.y;
    return r;
}

inline Mat3 scale(Vec2 s)
{
    Mat3 r;
    r.m[0][0] = s.x;
    r.m[1][1] = s.y;
    return r;
}

// Anticlockwise by `radians`, with y pointing up.
inline Mat3 rotate(double radians)
{
    const double c = std::cos(radians);
    const double s = std::sin(radians);
    Mat3 r;
    r.m[0][0] = c;
    r.m[0][1] = -s;
    r.m[1][0] = s;
    r.m[1][1] = c;
    return r;
}
```

```check
run "cmake --build raster/build"
tests "./raster/build/raster_tests" require="matrix_multiplication_is_rows_times_columns translate_moves_points_but_not_vectors rotate_turns_anticlockwise the_right_hand_matrix_is_applied_first" -- r.m[i][j] is row i of a times column j of b; rotate puts -sin in row 0, column 1.
```

## Step 3 — Predict: does the order matter?

**This step: create the supplied `raster/apps/order.cpp`. Before you build and run it, predict both results.**

It takes the point (1, 0) and applies a quarter turn anticlockwise and a move of 3 to the right, in both orders:

```cpp
transform_point(move_right * quarter_turn, p)   // turn, then move
transform_point(quarter_turn * move_right, p)   // move, then turn
```

**Predict:** where does the point end up each time? Sketch it on paper: the turn is always about the **origin**.

```text
cmake --build raster/build
./raster/build/order
```

```cpp file=raster/apps/order.cpp provided
// order.cpp: does the order of two transforms matter?
#include <cmath>
#include <cstdio>
#include <numbers>

#include "mat.h"
#include "vec.h"

void show(const char* what, Vec2 p)
{
    // + 0.0 turns -0.0 into 0.0, so a tiny negative error prints as 0.
    std::printf("%-26s (%.2f, %.2f)\n", what,
                std::round(p.x * 100) / 100 + 0.0,
                std::round(p.y * 100) / 100 + 0.0);
}

int main()
{
    const Mat3 quarter_turn = rotate(std::numbers::pi / 2);
    const Mat3 move_right = translate(Vec2{3, 0});
    const Vec2 p{1, 0};

    show("start:", p);
    show("rotate, then translate:",
         transform_point(move_right * quarter_turn, p));
    show("translate, then rotate:",
         transform_point(quarter_turn * move_right, p));
}
```

### What happened

```text
start:                     (1.00, 0.00)
rotate, then translate:    (3.00, 1.00)
translate, then rotate:    (0.00, 4.00)
```

```text
rotate, then translate          translate, then rotate
  (0,1) ──► (3,1)                       (0,4)
    ▲                                     ▲ quarter turn
    │ turn                                │ about the origin
  (1,0)                           (1,0) ──────► (4,0)
```

Turn first and the point swings around the origin while it's still close, then moves. Move first and it's 4 away when it turns, so it swings round a big arc. Matrix multiplication isn't commutative: `A * B` is usually not `B * A`.

The useful rule: **to turn or scale an object about its own centre, do it while the object is still at the origin, then move it into place.** That's why model files keep their objects centred on the origin.

The `(0.00, 4.00)` hides a detail: `cos(π / 2)` in floating point is about 6 × 10⁻¹⁷, not 0. The program rounds to two places before printing, and the tests use `CHECK_NEAR`.

```check
run "cmake --build raster/build"
run "./raster/build/order" stdout="(3.00, 1.00)" label="rotate, then translate gives (3.00, 1.00)"
run "./raster/build/order" stdout="(0.00, 4.00)" label="translate, then rotate gives (0.00, 4.00)"
```

## Step 4 — Your tests: transforms that undo and pivot

**This step: create `raster/tests/transform_own_test.cpp` with at least two tests. One must scale about a point that is not the origin, by composing `translate`, `scale` and `translate`.**

The order rule from the last step builds a transform you'll use constantly: **scale (or turn) about a pivot point `p`**:

```text
translate(p) * scale(s) * translate(-p)
     3.            2.            1.
 move it back   scale it   move p to the origin
```

Read right to left. Test that `p` itself doesn't move, and that a point one unit away ends up `s` units away.

More ideas:

- `rotate(-a) * rotate(a)` changes nothing (`CHECK_NEAR`: cos and sin aren't exact);
- four quarter turns are a full turn;
- `scale(Vec2{2, 2})` doubles the length of any vector.

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/tests/transform_own_test.cpp
// My tests for the 2D transforms.
#include "studio_test.hpp"

#include <numbers>

#include "mat.h"
#include "vec.h"

TEST(scaling_about_a_point_keeps_that_point_still)
{
    // Move the point to the origin, scale, move it back.
    const Vec2 p{5, 7};
    const Mat3 m = translate(p) * scale(Vec2{2, 2}) * translate(-p);
    CHECK_EQ(transform_point(m, p), p);
    CHECK_EQ(transform_point(m, Vec2{6, 7}), (Vec2{7, 7}));
}

TEST(rotating_back_undoes_a_rotation)
{
    const Mat3 m = rotate(-0.5) * rotate(0.5);
    const Vec2 v = transform_point(m, Vec2{2, 3});
    CHECK_NEAR(v.x, 2.0, 1e-12);
    CHECK_NEAR(v.y, 3.0, 1e-12);
}

TEST(four_quarter_turns_are_a_full_turn)
{
    const Mat3 q = rotate(std::numbers::pi / 2);
    const Vec2 v = transform_point(q * q * q * q, Vec2{1, 0});
    CHECK_NEAR(v.x, 1.0, 1e-12);
    CHECK_NEAR(v.y, 0.0, 1e-12);
}
```

```check
matches raster/tests/transform_own_test.cpp "(\bTEST\s*\([\s\S]*){2}" label="transform_own_test.cpp has at least two tests"
matches raster/tests/transform_own_test.cpp "translate\s*\([\s\S]*scale\s*\([\s\S]*translate\s*\(" label="a test scales about a pivot: translate, scale, translate"
run "cmake --build raster/build"
tests "./raster/build/raster_tests"
```

## Step 5 — One shape, twelve transforms

**This step: write `raster/apps/clock.cpp`: a 200 × 200 white clock face with twelve black tick marks and two hands, made from one tick shape and twelve transforms. Save it as `images/clock.bmp`, build, run, and open it.**

Describe each shape in **clock coordinates**: the centre is the origin, y points up, and a tick at 12 o'clock is the triangle (−3, 80), (3, 80), (0, 95). Then one matrix takes clock coordinates to pixels:

```cpp
const Mat3 to_pixels = translate(Vec2{100, 100}) * scale(Vec2{1, -1});
```

Right to left: flip y so it points down, then move the origin to the image's centre.

For the tick at each hour, turn first, then place:

```cpp
const Mat3 m = to_pixels * rotate(-hour * turn / 12);
```

Clockwise is a **negative** angle with y up, and `turn` is 2π (`std::numbers::pi`, from `<numbers>`). A helper transforms the three corners and fills the triangle:

```cpp
void fill_shape(Image& img, const Mat3& m, Vec2 a, Vec2 b, Vec2 c,
                Color col)
{
    fill_triangle(img, transform_point(m, a), transform_point(m, b),
                  transform_point(m, c), col);
}
```

For the hands, use long thin triangles from the centre, (−4, 0), (4, 0), (0, 50) for the hours and (−3, 0), (3, 0), (0, 75) in red for the minutes, turned to ten past ten.

**Predict:** what would `rotate(...) * to_pixels` draw instead?

```text
cmake --build raster/build
./raster/build/clock
```

```cpp file=raster/apps/clock.cpp
// clock.cpp: one tick-mark shape, drawn 12 times with 12 transforms.
#include <filesystem>
#include <iostream>
#include <numbers>

#include "bmp.h"
#include "draw.h"
#include "image.h"
#include "mat.h"
#include "vec.h"

// Draws a triangle given in clock coordinates (the centre is the
// origin, y points up), transformed by m.
void fill_shape(Image& img, const Mat3& m, Vec2 a, Vec2 b, Vec2 c,
                Color col)
{
    fill_triangle(img, transform_point(m, a), transform_point(m, b),
                  transform_point(m, c), col);
}

int main()
{
    Image img(200, 200, colors::white);
    const double turn = 2 * std::numbers::pi;

    // From clock coordinates to pixels: flip y to point down, then
    // move the origin to the image's centre.
    const Mat3 to_pixels = translate(Vec2{100, 100}) * scale(Vec2{1, -1});

    for (int hour = 0; hour < 12; ++hour) {
        // Clockwise, so a NEGATIVE angle; rotate first, then place.
        const Mat3 m = to_pixels * rotate(-hour * turn / 12);
        fill_shape(img, m, {-3, 80}, {3, 80}, {0, 95}, colors::black);
    }

    // The hands at ten past ten.
    const double hours = 10 + 10.0 / 60;
    const Mat3 hour_hand = to_pixels * rotate(-hours * turn / 12);
    fill_shape(img, hour_hand, {-4, 0}, {4, 0}, {0, 50}, colors::black);
    const Mat3 minute_hand = to_pixels * rotate(-10.0 / 60 * turn);
    fill_shape(img, minute_hand, {-3, 0}, {3, 0}, {0, 75}, colors::red);

    std::filesystem::create_directories("images");
    write_bmp(img, "images/clock.bmp");
    std::cout << "wrote images/clock.bmp\n";
}
```

### Answer

`rotate(...) * to_pixels` places the tick first and turns it afterwards, about the **pixel** origin, the image's top-left corner. Most ticks would swing right out of the image. Try it.

```check
run "cmake --build raster/build"
run "./raster/build/clock" stdout="wrote images/clock.bmp"
run "./raster/build/imgcheck images/clock.bmp 100 15" stdout="pixel (100, 15) = 0 0 0" label="the 12 o'clock tick is at the top"
run "./raster/build/imgcheck images/clock.bmp 185 100" stdout="pixel (185, 100) = 0 0 0" label="the 3 o'clock tick is on the right" -- Rotate first, then place: to_pixels * rotate(-hour * turn / 12).
run "./raster/build/imgcheck images/clock.bmp 100 60" stdout="pixel (100, 60) = 255 255 255" label="the face is white between the centre and 12"
```
