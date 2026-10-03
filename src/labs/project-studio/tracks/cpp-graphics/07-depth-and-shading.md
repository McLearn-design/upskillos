---
title: 7 — Depth and Light: a Solid Cube
track: Graphics from First Principles
runtime: cpp
reference: optional
console: true
---

A wireframe shows every edge, front and back. A solid object must **hide** what's behind it, and its faces need **light** to look solid at all.

| Problem | Old answer | What GPUs do |
|---|---|---|
| hiding | the **painter's algorithm**: sort triangles far to near, draw in that order | a **depth buffer** (z-buffer): one depth per pixel, and keep only the nearest |
| light | — | **shading**: brightness from the angle between the surface and the light |
| wasted work | — | **back-face culling**: skip triangles facing away |

The painter's algorithm fails whenever triangles cross or overlap in a cycle: no order is right. The depth buffer decides **per pixel**, so it never fails, and it costs one number per pixel.

## Step 1 — The specification for depth

**This step: create the supplied `raster/tests/depth_test.cpp` and read it.**

A `Framebuffer` holds two images of the same size: the **colour** image you've been drawing, and a **depth buffer** of `double`s, one per pixel. Every depth starts at infinity: nothing drawn yet.

`fill_triangle_depth` takes the corners in **screen space**: x and y in pixels, and z, the depth `viewport` kept, from −1 at the near plane to 1 at the far plane. For each pixel the triangle covers, it works out the triangle's depth there, and only draws if that's **nearer** than what's already stored.

Read `crossing_triangles_each_win_where_they_are_nearer`: two triangles that pass through each other. On the left red is nearer, on the right blue is. No drawing order can get both halves right.

```cpp file=raster/tests/depth_test.cpp provided
// Provided by the lesson: what the depth buffer must do.
#include "studio_test.hpp"

#include <cmath>

#include "image.h"
#include "render.h"
#include "vec.h"

namespace {

// Two triangles covering most of a 10 x 10 image, at depths 0.2
// (near, red) and 0.8 (far, blue).
void draw_near(Framebuffer& fb)
{
    fill_triangle_depth(fb, {0, 0, 0.2}, {10, 0, 0.2}, {0, 10, 0.2},
                        colors::red);
}

void draw_far(Framebuffer& fb)
{
    fill_triangle_depth(fb, {0, 0, 0.8}, {10, 0, 0.8}, {10, 10, 0.8},
                        colors::blue);
}

} // namespace

TEST(a_new_depth_buffer_is_infinitely_far)
{
    Framebuffer fb(4, 3);
    CHECK_EQ(fb.depth.size(), 12u);
    CHECK(std::isinf(fb.depth_at(3, 2)));
    CHECK_EQ(fb.color.get(3, 2), colors::black);
}

TEST(drawing_records_the_depth)
{
    Framebuffer fb(10, 10);
    CHECK_EQ(fill_triangle_depth(fb, {0, 0, 0.5}, {10, 0, 0.5},
                                 {0, 10, 0.5}, colors::red), 45);
    CHECK_NEAR(fb.depth_at(1, 1), 0.5, 1e-12);
}

TEST(the_near_triangle_wins_when_drawn_last)
{
    Framebuffer fb(10, 10);
    draw_far(fb);
    draw_near(fb);
    CHECK_EQ(fb.color.get(7, 1), colors::red);   // both cover (7, 1)
}

TEST(the_near_triangle_wins_when_drawn_first)
{
    Framebuffer fb(10, 10);
    draw_near(fb);
    draw_far(fb);
    CHECK_EQ(fb.color.get(7, 1), colors::red);
    CHECK_EQ(fb.color.get(8, 8), colors::blue);   // only far covers it
    CHECK_NEAR(fb.depth_at(7, 1), 0.2, 1e-12);
}

TEST(depth_is_interpolated_across_the_triangle)
{
    // Depth 0 on the left edge, 1 on the right: at pixel centre
    // x = 2.5 of a 10-wide triangle it is 0.25.
    Framebuffer fb(10, 10);
    fill_triangle_depth(fb, {0, 0, 0}, {10, 0, 1}, {0, 10, 0},
                        colors::red);
    CHECK_NEAR(fb.depth_at(2, 3), 0.25, 1e-12);
}

TEST(crossing_triangles_each_win_where_they_are_nearer)
{
    // Red leans one way, blue the other: they cross at x = 5. No
    // drawing order gets this right; a depth buffer does.
    Framebuffer fb(10, 10);
    fill_triangle_depth(fb, {0, 0, 0.1}, {10, 0, 0.9}, {0, 10, 0.1},
                        colors::red);
    fill_triangle_depth(fb, {0, 0, 0.9}, {10, 0, 0.1}, {10, 10, 0.1},
                        colors::blue);
    CHECK_EQ(fb.color.get(2, 1), colors::red);
    CHECK_EQ(fb.color.get(7, 1), colors::blue);
}
```

```check
file raster/tests/depth_test.cpp
```

## Step 2 — A colleague's depth buffer

**This step: create the supplied `raster/render.h`, build, and run the tests. Before you run them, predict which depth tests fail, and why.**

A colleague has written `Framebuffer` and `fill_triangle_depth`. It reuses `edge`, `is_top_left` and `covers` from `draw.h`, and adds one new idea: **barycentric coordinates**.

```cpp
const double l0 = w0 / area;   // how much of corner a
const double l1 = w1 / area;   // ... of b
const double l2 = w2 / area;   // ... of c
const double z = l0 * a.z + l1 * b.z + l2 * c.z;
```

Each edge function, divided by the whole triangle's, is the share of the triangle's area opposite one corner, and that's exactly how much of that corner is "in" the pixel: at corner `a`, `l0` is 1 and the others 0; on the far edge, `l0` is 0. The three always add up to 1. Blending the corners' depths with them gives the depth at the pixel. Any value given at the corners blends the same way: depth here, colours and normals in lesson 8.

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/render.h provided
// render.h: drawing with depth, so near things hide far things.
#pragma once

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <limits>
#include <utility>
#include <vector>

#include "draw.h"
#include "image.h"
#include "vec.h"

// A colour image plus a depth buffer: for every pixel, the depth of
// the nearest thing drawn there so far. Smaller depth is nearer.
struct Framebuffer {
    Image color;
    std::vector<double> depth;

    Framebuffer(int width, int height, Color clear = colors::black)
        : color(width, height, clear),
          depth(static_cast<std::size_t>(width) * height,
                std::numeric_limits<double>::infinity())
    {
    }

    int width() const { return color.width(); }
    int height() const { return color.height(); }

    double& depth_at(int x, int y)
    {
        return depth[static_cast<std::size_t>(y) * width() + x];
    }
};

// Fills a triangle whose corners are in SCREEN space: x and y in
// pixels, z the depth that viewport() kept. Returns how many pixels
// it wrote.
inline int fill_triangle_depth(Framebuffer& fb, Vec3 a, Vec3 b, Vec3 c,
                               Color col)
{
    auto flat = [](Vec3 v) { return Vec2{v.x, v.y}; };
    if (edge(flat(a), flat(b), flat(c)) < 0)
        std::swap(b, c);
    const double area = edge(flat(a), flat(b), flat(c));
    if (area == 0)
        return 0;

    const bool top_left0 = is_top_left(flat(b), flat(c));
    const bool top_left1 = is_top_left(flat(c), flat(a));
    const bool top_left2 = is_top_left(flat(a), flat(b));

    // Only pixels inside the bounding box can be inside the triangle.
    const double left = std::min({a.x, b.x, c.x});
    const double right = std::max({a.x, b.x, c.x});
    const double top = std::min({a.y, b.y, c.y});
    const double bottom = std::max({a.y, b.y, c.y});
    const int min_x = std::max(0, int(std::floor(left)));
    const int max_x = std::min(fb.width() - 1, int(std::ceil(right)));
    const int min_y = std::max(0, int(std::floor(top)));
    const int max_y = std::min(fb.height() - 1, int(std::ceil(bottom)));

    int written = 0;
    for (int y = min_y; y <= max_y; ++y) {
        for (int x = min_x; x <= max_x; ++x) {
            const Vec2 p{x + 0.5, y + 0.5};
            const double w0 = edge(flat(b), flat(c), p);
            const double w1 = edge(flat(c), flat(a), p);
            const double w2 = edge(flat(a), flat(b), p);
            if (!covers(w0, top_left0) || !covers(w1, top_left1) ||
                !covers(w2, top_left2))
                continue;
            // Barycentric coordinates: how much of each corner is in
            // this pixel. They add up to 1.
            const double l0 = w0 / area;
            const double l1 = w1 / area;
            const double l2 = w2 / area;
            const double z = l0 * a.z + l1 * b.z + l2 * c.z;
            fb.depth_at(x, y) = z;
            fb.color.set(x, y, col);
            ++written;
        }
    }
    return written;
}
```

### What happened

```text
[  FAILED  ] the_near_triangle_wins_when_drawn_first
[  FAILED  ] crossing_triangles_each_win_where_they_are_nearer
```

`the_near_triangle_wins_when_drawn_last` **passes**: drawing far to near looks right without any depth test, which is the painter's algorithm. Draw near first and the far triangle paints over it.

**Diagnose:** the code computes `z` and stores it in the depth buffer, but never *reads* the depth buffer. It writes a depth it never tests.

```check
file raster/render.h
run "cmake --build raster/build"
```

## Step 3 — The depth test

**This step: fix `fill_triangle_depth` in `raster/render.h`: skip a pixel unless the triangle is nearer there than the depth already stored. Build and run the tests.**

The **depth test** is one comparison, before writing anything:

```cpp
if (z >= fb.depth_at(x, y))
    continue;   // something nearer is already there
```

Smaller z is nearer. On equal depths the first triangle drawn keeps the pixel, so two copies of the same surface don't flicker between each other.

Why does it work for crossing triangles? Each **pixel** compares independently. Red wins the pixels where red is nearer and blue wins the others, and the line where they cross appears by itself, exactly, with no geometry code at all.

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/render.h
// render.h: drawing with depth, so near things hide far things.
#pragma once

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <limits>
#include <utility>
#include <vector>

#include "draw.h"
#include "image.h"
#include "vec.h"

// A colour image plus a depth buffer: for every pixel, the depth of
// the nearest thing drawn there so far. Smaller depth is nearer.
struct Framebuffer {
    Image color;
    std::vector<double> depth;

    Framebuffer(int width, int height, Color clear = colors::black)
        : color(width, height, clear),
          depth(static_cast<std::size_t>(width) * height,
                std::numeric_limits<double>::infinity())
    {
    }

    int width() const { return color.width(); }
    int height() const { return color.height(); }

    double& depth_at(int x, int y)
    {
        return depth[static_cast<std::size_t>(y) * width() + x];
    }
};

// Fills a triangle whose corners are in SCREEN space: x and y in
// pixels, z the depth that viewport() kept. Returns how many pixels
// it wrote.
inline int fill_triangle_depth(Framebuffer& fb, Vec3 a, Vec3 b, Vec3 c,
                               Color col)
{
    auto flat = [](Vec3 v) { return Vec2{v.x, v.y}; };
    if (edge(flat(a), flat(b), flat(c)) < 0)
        std::swap(b, c);
    const double area = edge(flat(a), flat(b), flat(c));
    if (area == 0)
        return 0;

    const bool top_left0 = is_top_left(flat(b), flat(c));
    const bool top_left1 = is_top_left(flat(c), flat(a));
    const bool top_left2 = is_top_left(flat(a), flat(b));

    // Only pixels inside the bounding box can be inside the triangle.
    const double left = std::min({a.x, b.x, c.x});
    const double right = std::max({a.x, b.x, c.x});
    const double top = std::min({a.y, b.y, c.y});
    const double bottom = std::max({a.y, b.y, c.y});
    const int min_x = std::max(0, int(std::floor(left)));
    const int max_x = std::min(fb.width() - 1, int(std::ceil(right)));
    const int min_y = std::max(0, int(std::floor(top)));
    const int max_y = std::min(fb.height() - 1, int(std::ceil(bottom)));

    int written = 0;
    for (int y = min_y; y <= max_y; ++y) {
        for (int x = min_x; x <= max_x; ++x) {
            const Vec2 p{x + 0.5, y + 0.5};
            const double w0 = edge(flat(b), flat(c), p);
            const double w1 = edge(flat(c), flat(a), p);
            const double w2 = edge(flat(a), flat(b), p);
            if (!covers(w0, top_left0) || !covers(w1, top_left1) ||
                !covers(w2, top_left2))
                continue;
            // Barycentric coordinates: how much of each corner is in
            // this pixel. They add up to 1.
            const double l0 = w0 / area;
            const double l1 = w1 / area;
            const double l2 = w2 / area;
            const double z = l0 * a.z + l1 * b.z + l2 * c.z;
            if (z >= fb.depth_at(x, y))
                continue;   // something nearer is already there
            fb.depth_at(x, y) = z;
            fb.color.set(x, y, col);
            ++written;
        }
    }
    return written;
}
```

```check
run "cmake --build raster/build"
tests "./raster/build/raster_tests" require="the_near_triangle_wins_when_drawn_first the_near_triangle_wins_when_drawn_last crossing_triangles_each_win_where_they_are_nearer depth_is_interpolated_across_the_triangle" -- Skip the pixel when z >= the depth already stored there.
```

## Step 4 — The specification for shading

**This step: create the supplied `raster/tests/shading_test.cpp` and read it.**

Four small functions:

| Function | Returns |
|---|---|
| `face_normal(a, b, c)` | the direction a triangle faces, length 1 |
| `lambert(normal, to_light)` | how much light the surface catches, 0 to 1 |
| `shade(colour, brightness)` | the colour scaled and rounded |
| `is_back_facing(a, b, c)` | whether a screen-space triangle faces away |

The convention for "front", in OpenGL and in this renderer: a triangle's corners go round **anticlockwise as seen from the front**. That's why the cube's faces will be listed anticlockwise as seen from outside.

```cpp file=raster/tests/shading_test.cpp provided
// Provided by the lesson: what the shading functions must do.
#include "studio_test.hpp"

#include <cmath>

#include "image.h"
#include "render.h"
#include "vec.h"

TEST(face_normal_follows_the_right_hand_rule)
{
    // Anticlockwise in the x-y plane, seen from +z: faces +z.
    const Vec3 n = face_normal({0, 0, 0}, {2, 0, 0}, {0, 2, 0});
    CHECK_EQ(n, (Vec3{0, 0, 1}));
    CHECK_EQ(face_normal({0, 0, 0}, {0, 2, 0}, {2, 0, 0}),
             (Vec3{0, 0, -1}));
}

TEST(lambert_is_the_cosine_of_the_angle_to_the_light)
{
    const Vec3 up{0, 1, 0};
    CHECK_EQ(lambert(up, up), 1.0);
    CHECK_EQ(lambert(up, Vec3{1, 0, 0}), 0.0);   // light skims past
    const Vec3 sixty_degrees{std::sqrt(0.75), 0.5, 0};
    CHECK_NEAR(lambert(up, sixty_degrees), 0.5, 1e-12);
}

TEST(lambert_is_never_negative)
{
    CHECK_EQ(lambert(Vec3{0, 1, 0}, Vec3{0, -1, 0}), 0.0);
}

TEST(shade_scales_and_rounds_each_channel)
{
    CHECK_EQ(shade(Color{200, 100, 51}, 0.5), (Color{100, 50, 26}));
    CHECK_EQ(shade(Color{200, 100, 50}, 1.0), (Color{200, 100, 50}));
    CHECK_EQ(shade(Color{200, 100, 50}, 0.0), colors::black);
    CHECK_EQ(shade(Color{200, 100, 50}, 7.0), (Color{200, 100, 50}));
}

TEST(back_faces_go_round_clockwise_on_screen)
{
    // Screen space, y down: (0,0) -> (0,8) -> (8,0) goes round
    // anticlockwise as you look at it. That's a front face.
    CHECK(!is_back_facing({0, 0, 0}, {0, 8, 0}, {8, 0, 0}));
    CHECK(is_back_facing({0, 0, 0}, {8, 0, 0}, {0, 8, 0}));
}
```

```check
file raster/tests/shading_test.cpp
```

## Step 5 — Normals, light and culling

**This step: add `face_normal`, `lambert`, `shade` and `is_back_facing` to `raster/render.h`. Build and run the tests.**

### Which way a triangle faces

Two edges lie in the triangle, so their cross product is perpendicular to it. With the corners anticlockwise from the front, the right-hand rule makes it point **out of the front**:

```cpp
inline Vec3 face_normal(Vec3 a, Vec3 b, Vec3 c)
{
    return normalize(cross(b - a, c - a));
}
```

### Light

`lambert` is lesson 3's sphere, as a function: `std::max(0.0, dot(normal, to_light))`. `shade` multiplies each channel by the brightness, clamped to 0..1, and **rounds**: `static_cast<std::uint8_t>(v * brightness + 0.5)`.

### Back faces

A closed object, seen from outside, shows only its front faces; every back face is hidden behind a front one. So triangles facing away can be skipped before rasterizing: **back-face culling**, which halves the work for free.

After projection, a front face's corners still go round anticlockwise as you look at the screen. But screen y points **down**, which flips the sign of the edge function: front faces give a **negative** `edge(a, b, c)`. So:

```cpp
inline bool is_back_facing(Vec3 a, Vec3 b, Vec3 c)
{
    return edge(Vec2{a.x, a.y}, Vec2{b.x, b.y}, Vec2{c.x, c.y}) >= 0;
}
```

Zero means the triangle is edge-on, a line with no pixels; culling it costs nothing.

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/render.h
// render.h: drawing with depth, so near things hide far things.
#pragma once

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <utility>
#include <vector>

#include "draw.h"
#include "image.h"
#include "vec.h"

// A colour image plus a depth buffer: for every pixel, the depth of
// the nearest thing drawn there so far. Smaller depth is nearer.
struct Framebuffer {
    Image color;
    std::vector<double> depth;

    Framebuffer(int width, int height, Color clear = colors::black)
        : color(width, height, clear),
          depth(static_cast<std::size_t>(width) * height,
                std::numeric_limits<double>::infinity())
    {
    }

    int width() const { return color.width(); }
    int height() const { return color.height(); }

    double& depth_at(int x, int y)
    {
        return depth[static_cast<std::size_t>(y) * width() + x];
    }
};

// Fills a triangle whose corners are in SCREEN space: x and y in
// pixels, z the depth that viewport() kept. Returns how many pixels
// it wrote.
inline int fill_triangle_depth(Framebuffer& fb, Vec3 a, Vec3 b, Vec3 c,
                               Color col)
{
    auto flat = [](Vec3 v) { return Vec2{v.x, v.y}; };
    if (edge(flat(a), flat(b), flat(c)) < 0)
        std::swap(b, c);
    const double area = edge(flat(a), flat(b), flat(c));
    if (area == 0)
        return 0;

    const bool top_left0 = is_top_left(flat(b), flat(c));
    const bool top_left1 = is_top_left(flat(c), flat(a));
    const bool top_left2 = is_top_left(flat(a), flat(b));

    // Only pixels inside the bounding box can be inside the triangle.
    const double left = std::min({a.x, b.x, c.x});
    const double right = std::max({a.x, b.x, c.x});
    const double top = std::min({a.y, b.y, c.y});
    const double bottom = std::max({a.y, b.y, c.y});
    const int min_x = std::max(0, int(std::floor(left)));
    const int max_x = std::min(fb.width() - 1, int(std::ceil(right)));
    const int min_y = std::max(0, int(std::floor(top)));
    const int max_y = std::min(fb.height() - 1, int(std::ceil(bottom)));

    int written = 0;
    for (int y = min_y; y <= max_y; ++y) {
        for (int x = min_x; x <= max_x; ++x) {
            const Vec2 p{x + 0.5, y + 0.5};
            const double w0 = edge(flat(b), flat(c), p);
            const double w1 = edge(flat(c), flat(a), p);
            const double w2 = edge(flat(a), flat(b), p);
            if (!covers(w0, top_left0) || !covers(w1, top_left1) ||
                !covers(w2, top_left2))
                continue;
            // Barycentric coordinates: how much of each corner is in
            // this pixel. They add up to 1.
            const double l0 = w0 / area;
            const double l1 = w1 / area;
            const double l2 = w2 / area;
            const double z = l0 * a.z + l1 * b.z + l2 * c.z;
            if (z >= fb.depth_at(x, y))
                continue;   // something nearer is already there
            fb.depth_at(x, y) = z;
            fb.color.set(x, y, col);
            ++written;
        }
    }
    return written;
}

// ── Shading ─────────────────────────────────────────────────────────

// The direction a triangle faces: perpendicular to two of its edges.
// Corners in anticlockwise order, seen from the front, give a normal
// pointing out of the front (the right-hand rule).
inline Vec3 face_normal(Vec3 a, Vec3 b, Vec3 c)
{
    return normalize(cross(b - a, c - a));
}

// Lambert's law: a surface facing the light gets all of it, one at
// an angle gets cos(angle) of it, one facing away gets none.
// Both vectors must have length 1.
inline double lambert(Vec3 normal, Vec3 to_light)
{
    return std::max(0.0, dot(normal, to_light));
}

// The colour scaled by a brightness from 0 to 1, rounded.
inline Color shade(Color base, double brightness)
{
    brightness = std::clamp(brightness, 0.0, 1.0);
    auto channel = [&](std::uint8_t v) {
        return static_cast<std::uint8_t>(v * brightness + 0.5);
    };
    return {channel(base.r), channel(base.g), channel(base.b)};
}

// In screen space (y down), a front face's corners go round
// anticlockwise as you look at it, which makes edge() negative.
// Positive: we are looking at its back. Zero: edge-on.
inline bool is_back_facing(Vec3 a, Vec3 b, Vec3 c)
{
    return edge(Vec2{a.x, a.y}, Vec2{b.x, b.y}, Vec2{c.x, c.y}) >= 0;
}
```

```check
run "cmake --build raster/build"
tests "./raster/build/raster_tests" require="face_normal_follows_the_right_hand_rule lambert_is_never_negative shade_scales_and_rounds_each_channel back_faces_go_round_clockwise_on_screen" -- shade rounds: add 0.5 before converting to std::uint8_t.
```

## Step 6 — A solid cube

**This step: write `raster/apps/solid_cube.cpp`: lesson 6's cube, solid, lit, with a depth buffer and back-face culling. Print how many triangles were drawn and culled, and save `images/solid_cube.bmp`.**

Use the same corners and the same model, view and projection as `cube.cpp`. Each face is 4 corners, **anticlockwise as seen from outside**, and becomes two triangles: corners 0, 1, 2 and 0, 2, 3.

```cpp
const int faces[6][4] = {
    {1, 3, 7, 5},   // +x
    {0, 4, 6, 2},   // -x
    {6, 7, 3, 2},   // +y
    {0, 1, 5, 4},   // -y
    {4, 5, 7, 6},   // +z
    {0, 2, 3, 1},   // -z
};
```

For each corner, keep two positions: `transform_point(model, c)` in the **world**, for lighting, and the screen position, for drawing. Then for each triangle:

1. `is_back_facing(screen...)`: count it as culled and skip it;
2. `face_normal(world...)`, then `0.15 + 0.85 * lambert(n, to_light)`, with `to_light = normalize(Vec3{-1, 2, 3})`: up, left and towards the viewer;
3. `fill_triangle_depth(fb, screen..., shade(Color{240, 140, 40}, light))`.

Clear the framebuffer to `Color{30, 30, 40}`. Print `triangles drawn: 6, culled: 6` with your counts, and save `fb.color`.

`for (const auto& t : {std::array{f[0], f[1], f[2]}, std::array{f[0], f[2], f[3]}})` loops over the two triangles of a face (`<array>`).

**Predict:** how many of the 12 triangles are culled?

```text
cmake --build raster/build
./raster/build/solid_cube
```

```cpp file=raster/apps/solid_cube.cpp
// solid_cube.cpp: a solid, lit cube, with a depth buffer and
// back-face culling.
#include <array>
#include <filesystem>
#include <iostream>
#include <numbers>

#include "bmp.h"
#include "camera.h"
#include "image.h"
#include "mat.h"
#include "render.h"
#include "vec.h"

int main()
{
    const int width = 200;
    const int height = 200;
    const double degree = std::numbers::pi / 180;

    Vec3 corners[8];   // as in cube.cpp: bits 0, 1, 2 pick x, y, z
    for (int i = 0; i < 8; ++i)
        corners[i] = {i & 1 ? 1.0 : -1.0, i & 2 ? 1.0 : -1.0,
                      i & 4 ? 1.0 : -1.0};

    // Each face's corners, anticlockwise as seen from OUTSIDE the
    // cube, so every face normal points out.
    const int faces[6][4] = {
        {1, 3, 7, 5},   // +x
        {0, 4, 6, 2},   // -x
        {6, 7, 3, 2},   // +y
        {0, 1, 5, 4},   // -y
        {4, 5, 7, 6},   // +z
        {0, 2, 3, 1},   // -z
    };

    const Mat4 model = rotate_y(30 * degree) * rotate_x(20 * degree);
    const Mat4 view = look_at({0, 0, 5}, {0, 0, 0}, {0, 1, 0});
    const Mat4 projection = perspective(60 * degree, 1.0, 0.1, 100);
    const Mat4 mvp = projection * view * model;

    // Where each corner is in the world (for lighting) and on screen.
    Vec3 world[8], screen[8];
    for (int i = 0; i < 8; ++i) {
        const Vec3& c = corners[i];
        world[i] = transform_point(model, c);
        screen[i] = viewport(
            perspective_divide(mvp * Vec4{c.x, c.y, c.z, 1}), width,
            height);
    }

    const Vec3 to_light = normalize(Vec3{-1, 2, 3});
    const Color orange{240, 140, 40};
    Framebuffer fb(width, height, Color{30, 30, 40});
    int drawn = 0, culled = 0;

    for (const auto& f : faces) {
        // Two triangles per face: corners 0, 1, 2 and 0, 2, 3.
        for (const auto& t : {std::array{f[0], f[1], f[2]},
                              std::array{f[0], f[2], f[3]}}) {
            if (is_back_facing(screen[t[0]], screen[t[1]],
                               screen[t[2]])) {
                ++culled;
                continue;
            }
            const Vec3 n =
                face_normal(world[t[0]], world[t[1]], world[t[2]]);
            const double light = 0.15 + 0.85 * lambert(n, to_light);
            fill_triangle_depth(fb, screen[t[0]], screen[t[1]],
                                screen[t[2]], shade(orange, light));
            ++drawn;
        }
    }
    std::cout << "triangles drawn: " << drawn << ", culled: " << culled
              << '\n';

    std::filesystem::create_directories("images");
    write_bmp(fb.color, "images/solid_cube.bmp");
    std::cout << "wrote images/solid_cube.bmp\n";
}
```

### What happened

Exactly half: 6 culled. From outside, you can see at most three faces of a cube at once, and here you see three: the front, the top and the left. The other three face away.

**Experiment:** comment out the culling. The picture doesn't change, because the depth buffer hides the back faces anyway; the renderer just does twice the work to get it. Then also turn off the depth test: now the order of `faces` decides what you see, and the back faces paint over the front.

Each face is one flat colour, because the whole face has one normal. That's **flat shading**. Smooth objects give each **corner** its own normal and blend the light across the triangle: lesson 8's pipeline can do it.

```check
run "cmake --build raster/build"
run "./raster/build/solid_cube" stdout="triangles drawn: 6, culled: 6" -- Cull triangles whose screen-space corners go round clockwise: is_back_facing.
run "./raster/build/imgcheck images/solid_cube.bmp 115 110" stdout="pixel (115, 110) = 106 62 18" label="the front face, turned away from the light, is dark"
run "./raster/build/imgcheck images/solid_cube.bmp 100 65" stdout="pixel (100, 65) = 178 104 30" label="the top face, facing the light, is bright" -- Light each face with its WORLD-space normal and to_light = normalize(Vec3{-1, 2, 3}).
run "./raster/build/imgcheck images/solid_cube.bmp 68 100" stdout="pixel (68, 100) = 165 96 27" label="the left face"
```
