---
title: 6 — 3D: Cameras and Perspective
track: Graphics from First Principles
runtime: cpp
reference: optional
console: true
---

A 3D renderer's job is to answer one question for every corner of every triangle: **where on the screen does this point land?** The answer is a chain of transforms, each from one coordinate **space** to the next:

| Space | What the coordinates mean | Reached with |
|---|---|---|
| model | the object's own corners, centred on its origin | (as stored) |
| world | where the object is in the scene | the **model** matrix |
| view | relative to the camera, which looks down −z with y up | the **view** matrix |
| clip | four numbers (x, y, z, w) | the **projection** matrix |
| NDC | the visible region squashed into a cube from −1 to 1 | divide by w |
| screen | pixels | the **viewport** transform |

The three matrices multiply into one, the **model-view-projection** (MVP) matrix: every graphics API you'll meet passes one to its vertex shader. By the end of this lesson your renderer draws a wireframe cube in perspective.

## Step 1 — The specification for Mat4

**This step: create the supplied `raster/tests/mat4_test.cpp` and read it.**

3D works exactly like 2D, one size up: a point is (x, y, z, 1), a direction is (x, y, z, 0), and a 4 × 4 matrix keeps a translation in its last column.

There is one new type, `Vec4`, because after the projection matrix the fourth number, **w**, is no longer 1, and it matters. Lesson 6's whole trick is in what w becomes.

There are three rotations now, one about each axis. Each turns one axis towards the next, following the right-hand rule: thumb along the axis, fingers curl the way it turns.

| Rotation | turns | onto |
|---|---|---|
| `rotate_x` | y | z |
| `rotate_y` | z | x |
| `rotate_z` | x | y |

```cpp file=raster/tests/mat4_test.cpp provided
// Provided by the lesson: what Vec4, Mat4 and the 3D transforms must do.
#include "studio_test.hpp"

#include <numbers>

#include "mat.h"
#include "vec.h"

namespace {

constexpr double pi = std::numbers::pi;

void check_near(Vec3 got, Vec3 want)
{
    CHECK_NEAR(got.x, want.x, 1e-12);
    CHECK_NEAR(got.y, want.y, 1e-12);
    CHECK_NEAR(got.z, want.z, 1e-12);
}

} // namespace

TEST(a_new_mat4_is_the_identity)
{
    const Mat4 id;
    CHECK_EQ((id * Vec4{1, 2, 3, 1}), (Vec4{1, 2, 3, 1}));
    CHECK_EQ(id * id, id);
}

TEST(mat4_times_vec4_is_rows_dot_the_vector)
{
    Mat4 a;
    a.m[0][3] = 5;    // row 0: 1 0 0 5
    a.m[3][2] = -1;   // row 3: 0 0 -1 1
    CHECK_EQ((a * Vec4{1, 2, 3, 1}), (Vec4{6, 2, 3, -2}));
}

TEST(translate_3d_moves_points_but_not_vectors)
{
    const Mat4 t = translate(Vec3{1, 2, 3});
    CHECK_EQ(transform_point(t, Vec3{1, 1, 1}), (Vec3{2, 3, 4}));
    CHECK_EQ(transform_vector(t, Vec3{1, 1, 1}), (Vec3{1, 1, 1}));
}

TEST(scale_3d)
{
    CHECK_EQ(transform_point(scale(Vec3{2, 3, 4}), Vec3{1, 1, 1}),
             (Vec3{2, 3, 4}));
}

TEST(rotations_follow_the_right_hand_rule)
{
    // A quarter turn about each axis takes one axis to the next.
    check_near(transform_point(rotate_x(pi / 2), Vec3{0, 1, 0}),
               Vec3{0, 0, 1});
    check_near(transform_point(rotate_y(pi / 2), Vec3{0, 0, 1}),
               Vec3{1, 0, 0});
    check_near(transform_point(rotate_z(pi / 2), Vec3{1, 0, 0}),
               Vec3{0, 1, 0});
}

TEST(mat4_composition_applies_the_right_hand_matrix_first)
{
    const Mat4 m = translate(Vec3{0, 0, -5}) * rotate_y(pi / 2);
    check_near(transform_point(m, Vec3{0, 0, 1}), Vec3{1, 0, -5});
}
```

```check
file raster/tests/mat4_test.cpp
```

## Step 2 — Vec4 and Mat4

**This step: add `Vec4`, `Mat4` and the 3D transforms to `raster/mat.h`. Build and run the tests.**

This time there's no code to copy: each piece is its 2D version, one size up. You need:

- `struct Vec4` with `x, y, z, w`, a defaulted `==`, and `<<`;
- `struct Mat4`: `double m[4][4]`, defaulting to the identity, a defaulted `==`, and `<<`;
- `Mat4 * Mat4` and `Mat4 * Vec4`;
- `transform_point(const Mat4&, Vec3)` (w = 1) and `transform_vector(const Mat4&, Vec3)` (w = 0);
- `translate(Vec3)` and `scale(Vec3)`. These **overload** the 2D versions: C++ picks by the argument's type, `Vec2` or `Vec3`;
- `rotate_x`, `rotate_y`, `rotate_z`.

Each rotation is the 2D rotation, written into the two axes it turns, with the third axis left alone. Following the table in the last step:

| | changes rows and columns | the `-sin` goes in |
|---|---|---|
| `rotate_z` | 0 and 1 (x, y) | `m[0][1]` |
| `rotate_x` | 1 and 2 (y, z) | `m[1][2]` |
| `rotate_y` | 2 and 0 (z, x) | `m[2][0]` |

`rotate_y` looks backwards at first: its order is z then x, so in row-and-column terms `m[0][2]` gets `+sin` and `m[2][0]` gets `-sin`. If a rotation test fails, check that sign.

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

// ── 3D ──────────────────────────────────────────────────────────────

// A point or direction in homogeneous coordinates: w = 1 for a point,
// w = 0 for a direction. After a projection, w can be anything.
struct Vec4 {
    double x = 0;
    double y = 0;
    double z = 0;
    double w = 0;

    bool operator==(const Vec4&) const = default;
};

inline std::ostream& operator<<(std::ostream& out, Vec4 v)
{
    return out << '(' << v.x << ", " << v.y << ", " << v.z << ", " << v.w
               << ')';
}

// A 4 x 4 matrix for 3D transforms. m[row][column].
struct Mat4 {
    double m[4][4] = {
        {1, 0, 0, 0}, {0, 1, 0, 0}, {0, 0, 1, 0}, {0, 0, 0, 1}};

    bool operator==(const Mat4&) const = default;
};

inline Mat4 operator*(const Mat4& a, const Mat4& b)
{
    Mat4 r;
    for (int i = 0; i < 4; ++i) {
        for (int j = 0; j < 4; ++j) {
            r.m[i][j] = 0;
            for (int k = 0; k < 4; ++k)
                r.m[i][j] += a.m[i][k] * b.m[k][j];
        }
    }
    return r;
}

inline std::ostream& operator<<(std::ostream& out, const Mat4& a)
{
    for (int i = 0; i < 4; ++i)
        out << '\n' << a.m[i][0] << ' ' << a.m[i][1] << ' ' << a.m[i][2]
            << ' ' << a.m[i][3];
    return out;
}

inline Vec4 operator*(const Mat4& a, Vec4 v)
{
    double r[4];
    for (int i = 0; i < 4; ++i)
        r[i] = a.m[i][0] * v.x + a.m[i][1] * v.y + a.m[i][2] * v.z +
               a.m[i][3] * v.w;
    return {r[0], r[1], r[2], r[3]};
}

inline Vec3 transform_point(const Mat4& a, Vec3 p)
{
    const Vec4 r = a * Vec4{p.x, p.y, p.z, 1};
    return {r.x, r.y, r.z};
}

inline Vec3 transform_vector(const Mat4& a, Vec3 v)
{
    const Vec4 r = a * Vec4{v.x, v.y, v.z, 0};
    return {r.x, r.y, r.z};
}

inline Mat4 translate(Vec3 t)
{
    Mat4 r;
    r.m[0][3] = t.x;
    r.m[1][3] = t.y;
    r.m[2][3] = t.z;
    return r;
}

inline Mat4 scale(Vec3 s)
{
    Mat4 r;
    r.m[0][0] = s.x;
    r.m[1][1] = s.y;
    r.m[2][2] = s.z;
    return r;
}

// Rotations about each axis, anticlockwise when you look along the
// axis towards the origin (the right-hand rule).
inline Mat4 rotate_x(double radians)
{
    const double c = std::cos(radians), s = std::sin(radians);
    Mat4 r;
    r.m[1][1] = c;
    r.m[1][2] = -s;
    r.m[2][1] = s;
    r.m[2][2] = c;
    return r;
}

inline Mat4 rotate_y(double radians)
{
    const double c = std::cos(radians), s = std::sin(radians);
    Mat4 r;
    r.m[0][0] = c;
    r.m[0][2] = s;
    r.m[2][0] = -s;
    r.m[2][2] = c;
    return r;
}

inline Mat4 rotate_z(double radians)
{
    const double c = std::cos(radians), s = std::sin(radians);
    Mat4 r;
    r.m[0][0] = c;
    r.m[0][1] = -s;
    r.m[1][0] = s;
    r.m[1][1] = c;
    return r;
}
```

```check
run "cmake --build raster/build"
tests "./raster/build/raster_tests" require="a_new_mat4_is_the_identity mat4_times_vec4_is_rows_dot_the_vector translate_3d_moves_points_but_not_vectors rotations_follow_the_right_hand_rule mat4_composition_applies_the_right_hand_matrix_first rotate_turns_anticlockwise" -- rotate_y turns z towards x: m[0][2] = sin, m[2][0] = -sin.
```

## Step 3 — The specification for the camera

**This step: create the supplied `raster/tests/camera_test.cpp` and read it.**

`camera.h` will hold the last three links in the chain:

| Function | Does |
|---|---|
| `look_at(eye, target, up)` | the **view** matrix: a camera at `eye` looking at `target` |
| `perspective(fov_y, aspect, near, far)` | the **projection** matrix |
| `perspective_divide(clip)` | clip space to NDC: divide by w |
| `viewport(ndc, width, height)` | NDC to pixels, keeping z for depth |

Read `twice_as_far_is_half_as_big`. That's what perspective *is*: an object's size on screen is its real size divided by its distance.

And `the_edges_of_the_view_map_to_plus_or_minus_one`: with a 90° field of view, the visible region at distance 4 is 4 up and 4 down, so a point at height 4 and distance 4 lands exactly on the top edge of the picture, y = 1 in NDC.

```cpp file=raster/tests/camera_test.cpp provided
// Provided by the lesson: what the camera functions must do.
#include "studio_test.hpp"

#include <numbers>

#include "camera.h"
#include "mat.h"
#include "vec.h"

namespace {

constexpr double pi = std::numbers::pi;

void check_near(Vec3 got, Vec3 want)
{
    CHECK_NEAR(got.x, want.x, 1e-9);
    CHECK_NEAR(got.y, want.y, 1e-9);
    CHECK_NEAR(got.z, want.z, 1e-9);
}

Vec3 to_ndc(const Mat4& proj, Vec3 p)
{
    return perspective_divide(proj * Vec4{p.x, p.y, p.z, 1});
}

} // namespace

TEST(look_at_from_the_z_axis_is_a_translation)
{
    const Mat4 view = look_at({0, 0, 5}, {0, 0, 0}, {0, 1, 0});
    check_near(transform_point(view, Vec3{1, 2, 0}), Vec3{1, 2, -5});
}

TEST(look_at_puts_the_target_straight_ahead)
{
    const Mat4 view = look_at({3, 4, 5}, {1, 1, 1}, {0, 1, 0});
    const Vec3 t = transform_point(view, Vec3{1, 1, 1});
    CHECK_NEAR(t.x, 0.0, 1e-9);
    CHECK_NEAR(t.y, 0.0, 1e-9);
    CHECK(t.z < 0);   // in front of the camera: negative z
}

TEST(perspective_sets_w_to_the_distance)
{
    const Mat4 proj = perspective(pi / 2, 1, 1, 10);
    const Vec4 clip = proj * Vec4{0, 0, -7, 1};
    CHECK_NEAR(clip.w, 7.0, 1e-12);
}

TEST(near_and_far_planes_map_to_minus_one_and_one)
{
    const Mat4 proj = perspective(pi / 2, 1, 1, 10);
    CHECK_NEAR(to_ndc(proj, {0, 0, -1}).z, -1.0, 1e-12);
    CHECK_NEAR(to_ndc(proj, {0, 0, -10}).z, 1.0, 1e-12);
}

TEST(the_edges_of_the_view_map_to_plus_or_minus_one)
{
    // A 90-degree view: at distance 4, the view is 4 up and 4 down.
    const Mat4 proj = perspective(pi / 2, 1, 1, 10);
    CHECK_NEAR(to_ndc(proj, {4, 4, -4}).x, 1.0, 1e-12);
    CHECK_NEAR(to_ndc(proj, {0, -4, -4}).y, -1.0, 1e-12);
    // A wider image (aspect 2) shows twice as much sideways.
    const Mat4 wide = perspective(pi / 2, 2, 1, 10);
    CHECK_NEAR(to_ndc(wide, {8, 0, -4}).x, 1.0, 1e-12);
}

TEST(twice_as_far_is_half_as_big)
{
    const Mat4 proj = perspective(pi / 3, 1, 0.1, 100);
    const double near_x = to_ndc(proj, {1, 0, -3}).x;
    const double far_x = to_ndc(proj, {1, 0, -6}).x;
    CHECK_NEAR(far_x, near_x / 2, 1e-12);
}

TEST(viewport_maps_ndc_corners_to_pixel_corners)
{
    check_near(viewport({-1, 1, 0}, 200, 100), Vec3{0, 0, 0});
    check_near(viewport({1, -1, 0}, 200, 100), Vec3{200, 100, 0});
    check_near(viewport({0, 0, 0.5}, 200, 100), Vec3{100, 50, 0.5});
}
```

```check
file raster/tests/camera_test.cpp
```

## Step 4 — Perspective, one division

**This step: create `raster/camera.h` with `look_at`, `perspective`, `perspective_divide` and `viewport`. Build and run the tests.**

### Similar triangles

The camera is at the origin looking down −z. A point (x, y, z) in front of it has distance `d = -z`. On a screen at distance 1, it appears at height `y / d`:

```text
        ● (y, at distance d)
       /|
      / |  y
     /  |
cam ●───┼──────
    1   d          on screen: y / d
```

So the projection has to divide by the distance. A matrix can only multiply and add, so it doesn't divide: it sets **w = d**, and the divide by w happens afterwards, in `perspective_divide`. That one division is why the fourth coordinate exists.

```cpp
inline Mat4 perspective(double fov_y, double aspect, double near,
                        double far)
{
    const double f = 1 / std::tan(fov_y / 2);
    Mat4 r;
    r.m[0][0] = f / aspect;
    r.m[1][1] = f;
    r.m[2][2] = (far + near) / (near - far);
    r.m[2][3] = 2 * far * near / (near - far);
    r.m[3][2] = -1;   // w = -z: the distance
    r.m[3][3] = 0;
    return r;
}
```

- `f` scales x and y so the edges of the field of view land on ±1 after the divide. `fov_y` is the **vertical** angle the camera sees; dividing x by `aspect` (width ÷ height) stops a wide image stretching.
- Row 2 maps z so that the **near** plane becomes −1 and the **far** plane +1 after the divide: that's the depth lesson 7 compares. Anything outside is invisible: too close, or too far.
- This is OpenGL's projection matrix, line for line.

### The other three

- `perspective_divide(clip)` returns `{clip.x / clip.w, clip.y / clip.w, clip.z / clip.w}`.
- `viewport(ndc, width, height)` maps x from −1..1 to 0..width, and y from 1..−1 to 0..height, because NDC's y points up and pixels' y points down. It keeps `ndc.z`.
- `look_at` builds the camera's own axes: `forward` from eye to target, `right = cross(forward, up)`, and the camera's real `up = cross(right, forward)`, all normalised. Its rows are `right`, `up` and `-forward`, with `-dot(axis, eye)` in the last column: moving the camera right is the same as moving the whole world left. Copy it from the full file.

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/camera.h
// camera.h: from 3D world coordinates to pixels.
#pragma once

#include <cmath>

#include "mat.h"
#include "vec.h"

// The view matrix: moves the world so the camera sits at the origin,
// looking down -z, with y up. (Moving the camera right is the same as
// moving the whole world left.)
inline Mat4 look_at(Vec3 eye, Vec3 target, Vec3 up)
{
    const Vec3 forward = normalize(target - eye);
    const Vec3 right = normalize(cross(forward, up));
    const Vec3 camera_up = cross(right, forward);
    Mat4 r;
    r.m[0][0] = right.x;
    r.m[0][1] = right.y;
    r.m[0][2] = right.z;
    r.m[0][3] = -dot(right, eye);
    r.m[1][0] = camera_up.x;
    r.m[1][1] = camera_up.y;
    r.m[1][2] = camera_up.z;
    r.m[1][3] = -dot(camera_up, eye);
    r.m[2][0] = -forward.x;
    r.m[2][1] = -forward.y;
    r.m[2][2] = -forward.z;
    r.m[2][3] = dot(forward, eye);
    return r;
}

// The projection matrix (OpenGL's convention). It maps the visible
// frustum to the cube -1..1 on every axis AFTER dividing by w, and it
// sets w = -z: the distance in front of the camera.
inline Mat4 perspective(double fov_y, double aspect, double near,
                        double far)
{
    const double f = 1 / std::tan(fov_y / 2);
    Mat4 r;
    r.m[0][0] = f / aspect;
    r.m[1][1] = f;
    r.m[2][2] = (far + near) / (near - far);
    r.m[2][3] = 2 * far * near / (near - far);
    r.m[3][2] = -1;
    r.m[3][3] = 0;
    return r;
}

// Clip space to normalised device coordinates (NDC): divide by w.
// This one division is what makes far things small.
inline Vec3 perspective_divide(Vec4 clip)
{
    return {clip.x / clip.w, clip.y / clip.w, clip.z / clip.w};
}

// NDC to pixels: x from -1..1 to 0..width, y from 1..-1 (up) to
// 0..height (down). z (-1 near, 1 far) is kept, for depth.
inline Vec3 viewport(Vec3 ndc, int width, int height)
{
    return {(ndc.x + 1) / 2 * width, (1 - ndc.y) / 2 * height, ndc.z};
}
```

```check
run "cmake --build raster/build"
tests "./raster/build/raster_tests" require="perspective_sets_w_to_the_distance near_and_far_planes_map_to_minus_one_and_one twice_as_far_is_half_as_big viewport_maps_ndc_corners_to_pixel_corners look_at_puts_the_target_straight_ahead" -- Row 3 of the projection is 0 0 -1 0, so that w = -z.
```

## Step 5 — A wireframe cube

**This step: write `raster/apps/cube.cpp`: project the 8 corners of a cube onto a 200 × 200 image, print where each lands, and join them with 12 lines. Save it as `images/cube.bmp`.**

The cube's corners are every combination of ±1. Number them 0 to 7 and let the bits of the number choose: bit 0 picks x, bit 1 y, bit 2 z.

```cpp
for (int i = 0; i < 8; ++i)
    corners[i] = {i & 1 ? 1.0 : -1.0, i & 2 ? 1.0 : -1.0,
                  i & 4 ? 1.0 : -1.0};
```

Then the chain, with `degree = std::numbers::pi / 180`:

```cpp
const Mat4 model = rotate_y(30 * degree) * rotate_x(20 * degree);
const Mat4 view = look_at({0, 0, 5}, {0, 0, 0}, {0, 1, 0});
const Mat4 projection = perspective(60 * degree, 1.0, 0.1, 100);
const Mat4 mvp = projection * view * model;   // model goes first
```

For each corner: `mvp * Vec4{x, y, z, 1}`, then `perspective_divide`, then `viewport`. Round x and y to whole pixels with `std::lround` and print each as `corner 0 -> (53, 118)`.

**Edges:** two corners are joined when their numbers differ in exactly one bit, one coordinate. So for each corner `a` and each `bit` in 1, 2, 4, join `a` to `a ^ bit` (`^` is exclusive or: it flips that bit) when `a < a ^ bit`, so each edge is drawn once. Count them and print `12 edges`.

**Predict:** in the picture, will the cube's near face and far face be the same size?

```text
cmake --build raster/build
./raster/build/cube
```

```cpp file=raster/apps/cube.cpp
// cube.cpp: a wireframe cube, through model, view and projection.
#include <cmath>
#include <filesystem>
#include <iostream>
#include <numbers>

#include "bmp.h"
#include "camera.h"
#include "draw.h"
#include "image.h"
#include "mat.h"
#include "vec.h"

int main()
{
    const int width = 200;
    const int height = 200;
    const double degree = std::numbers::pi / 180;

    // The 8 corners of a cube from -1 to 1: bit 0 of the index picks
    // x, bit 1 picks y, bit 2 picks z.
    Vec3 corners[8];
    for (int i = 0; i < 8; ++i)
        corners[i] = {i & 1 ? 1.0 : -1.0, i & 2 ? 1.0 : -1.0,
                      i & 4 ? 1.0 : -1.0};

    const Mat4 model = rotate_y(30 * degree) * rotate_x(20 * degree);
    const Mat4 view = look_at({0, 0, 5}, {0, 0, 0}, {0, 1, 0});
    const Mat4 projection = perspective(60 * degree, 1.0, 0.1, 100);
    const Mat4 mvp = projection * view * model;   // model goes first

    int px[8], py[8];
    for (int i = 0; i < 8; ++i) {
        const Vec3& c = corners[i];
        const Vec4 clip = mvp * Vec4{c.x, c.y, c.z, 1};
        const Vec3 screen =
            viewport(perspective_divide(clip), width, height);
        px[i] = static_cast<int>(std::lround(screen.x));
        py[i] = static_cast<int>(std::lround(screen.y));
        std::cout << "corner " << i << " -> (" << px[i] << ", " << py[i]
                  << ")\n";
    }

    // An edge joins two corners whose indices differ in one bit.
    Image img(width, height);
    int edges = 0;
    for (int a = 0; a < 8; ++a) {
        for (int bit = 1; bit < 8; bit *= 2) {
            const int b = a ^ bit;
            if (a < b) {
                draw_line(img, px[a], py[a], px[b], py[b], colors::white);
                ++edges;
            }
        }
    }
    std::cout << edges << " edges\n";

    std::filesystem::create_directories("images");
    write_bmp(img, "images/cube.bmp");
    std::cout << "wrote images/cube.bmp\n";
}
```

### What happened

Open `images/cube.bmp`. The near face is bigger than the far face, though both are 2 × 2 in the model: their corners have different w, so they're divided by different distances. A cube with all its edges parallel on screen would need an **orthographic** projection, which sets w = 1 for every point: no divide, no perspective. Technical drawings and many 2D games use one.

```check
run "cmake --build raster/build"
run "./raster/build/cube" stdout="corner 0 -> (53, 118)" -- mvp = projection * view * model; divide by w before the viewport.
run "./raster/build/cube" stdout="corner 7 -> (159, 76)"
run "./raster/build/cube" stdout="12 edges" label="cube draws 12 edges"
run "./raster/build/imgcheck images/cube.bmp 53 118" stdout="pixel (53, 118) = 255 255 255" label="corner 0 is drawn white"
```

## Step 6 — Your tests for the camera

**This step: create `raster/tests/camera_own_test.cpp` with at least three tests that project points all the way to pixels with `viewport`.**

Write a helper that runs the whole chain for one point, from the view space onwards, and then test what a viewer would expect to see:

- a point straight ahead lands in the middle of the image;
- a point **above** the camera's axis lands **higher** in the image: a *smaller* pixel y;
- a nearer point gets a smaller depth than a farther one;
- a point to the right lands right of the middle.

The second one catches the most common bug in a new renderer: an upside-down picture.

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/tests/camera_own_test.cpp
// My tests for the camera.
#include "studio_test.hpp"

#include <numbers>

#include "camera.h"
#include "mat.h"
#include "vec.h"

namespace {

Vec3 project(Vec3 p)
{
    const Mat4 proj = perspective(std::numbers::pi / 2, 1, 1, 100);
    const Vec3 ndc = perspective_divide(proj * Vec4{p.x, p.y, p.z, 1});
    return viewport(ndc, 100, 100);
}

} // namespace

TEST(a_point_straight_ahead_lands_in_the_middle)
{
    const Vec3 s = project({0, 0, -10});
    CHECK_NEAR(s.x, 50.0, 1e-9);
    CHECK_NEAR(s.y, 50.0, 1e-9);
}

TEST(up_in_the_world_is_up_in_the_image)
{
    CHECK(project({0, 1, -10}).y < 50);   // smaller y: higher up
}

TEST(nearer_points_have_smaller_depth)
{
    CHECK(project({0, 0, -2}).z < project({0, 0, -20}).z);
}
```

```check
matches raster/tests/camera_own_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="camera_own_test.cpp has at least three tests"
contains raster/tests/camera_own_test.cpp "viewport(" -- Take the points all the way to pixels with viewport().
run "cmake --build raster/build"
tests "./raster/build/raster_tests"
```
