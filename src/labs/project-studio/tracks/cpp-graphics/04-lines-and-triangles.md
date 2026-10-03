---
title: 4 — Rasterizing: Lines and Triangles
track: Graphics from First Principles
runtime: cpp
reference: optional
console: true
---

A shape in maths is perfectly thin and smooth; an image is a grid. **Rasterizing** is deciding which pixels a shape covers. It's the heart of a GPU: the hardware rasterizes only points, lines and triangles, and every 3D model is built from triangles.

| Shape | Rule | Algorithm |
|---|---|---|
| line | one pixel per step along its longer direction | Bresenham's, whole numbers only |
| triangle | every pixel whose **centre** is inside | edge functions |

Both have edge cases where a naive version draws gaps or draws pixels twice. The tests count pixels exactly, so every one of them shows up.

## Step 1 — The specification for lines

**This step: create the supplied `raster/tests/line_test.cpp` and read it.**

`draw_line(img, x0, y0, x1, y1, colour)` draws from one pixel to another, **including both ends**. Each test counts the pixels drawn, and some check that a line has exactly one pixel in each column, or in each row: no gaps, no clumps.

Notice the **steep** line: 2 pixels across, 8 down. A line needs one pixel per step along whichever direction is longer.

```cpp file=raster/tests/line_test.cpp provided
// Provided by the lesson: what draw_line must do.
#include "studio_test.hpp"

#include "draw.h"
#include "image.h"

TEST(horizontal_line_includes_both_ends)
{
    Image img(10, 10);
    draw_line(img, 2, 5, 7, 5, colors::white);
    CHECK_EQ(img.count(colors::white), 6);
    CHECK_EQ(img.get(2, 5), colors::white);
    CHECK_EQ(img.get(7, 5), colors::white);
}

TEST(shallow_line_has_one_pixel_per_column)
{
    Image img(10, 10);
    draw_line(img, 0, 0, 8, 2, colors::white);
    CHECK_EQ(img.count(colors::white), 9);
    for (int x = 0; x <= 8; ++x) {
        int in_column = 0;
        for (int y = 0; y < 10; ++y)
            if (img.get(x, y) == colors::white)
                ++in_column;
        CHECK_EQ(in_column, 1);
    }
}

TEST(diagonal_line)
{
    Image img(10, 10);
    draw_line(img, 1, 1, 6, 6, colors::white);
    CHECK_EQ(img.count(colors::white), 6);
    for (int i = 1; i <= 6; ++i)
        CHECK_EQ(img.get(i, i), colors::white);
}

TEST(steep_line_has_no_gaps)
{
    // 2 columns across, 8 rows down: it needs a pixel in every row.
    Image img(10, 10);
    draw_line(img, 2, 1, 4, 9, colors::white);
    CHECK_EQ(img.count(colors::white), 9);
    for (int y = 1; y <= 9; ++y) {
        int in_row = 0;
        for (int x = 0; x < 10; ++x)
            if (img.get(x, y) == colors::white)
                ++in_row;
        CHECK_EQ(in_row, 1);
    }
}

TEST(vertical_line)
{
    Image img(10, 10);
    draw_line(img, 3, 2, 3, 7, colors::white);
    CHECK_EQ(img.count(colors::white), 6);
    CHECK_EQ(img.get(3, 2), colors::white);
    CHECK_EQ(img.get(3, 7), colors::white);
}

TEST(right_to_left_draws_the_same_line)
{
    Image img(10, 10);
    draw_line(img, 7, 5, 2, 5, colors::white);
    CHECK_EQ(img.count(colors::white), 6);
    Image up(10, 10);
    draw_line(up, 4, 9, 2, 1, colors::white);   // the steep one, reversed
    CHECK_EQ(up.count(colors::white), 9);
}

TEST(a_line_off_the_edge_is_clipped)
{
    Image img(10, 10);
    draw_line(img, -5, 4, 14, 4, colors::white);
    CHECK_EQ(img.count(colors::white), 10);
}
```

```check
file raster/tests/line_test.cpp
```

## Step 2 — A first attempt

**This step: create the supplied `raster/draw.h`, build, and run the tests. Before you run them, predict which line tests fail.**

This is the line most people write first: walk along x one column at a time, and compute y from the slope.

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/draw.h provided
// draw.h: lines and filled triangles.
#pragma once

#include <cmath>

#include "image.h"

// A first attempt at a line: step along x, one pixel per column,
// and work out each column's y from the slope.
inline void draw_line(Image& img, int x0, int y0, int x1, int y1,
                      Color c)
{
    const double slope = double(y1 - y0) / (x1 - x0);
    for (int x = x0; x <= x1; ++x) {
        const double y = y0 + slope * (x - x0);
        img.set(x, static_cast<int>(std::lround(y)), c);
    }
}
```

### What happened

Three tests fail, for three reasons:

| Test | Why it fails |
|---|---|
| `steep_line_has_no_gaps` | one pixel per **column**: a line 2 across and 8 down gets 3 pixels, with gaps between |
| `right_to_left_draws_the_same_line` | when `x1 < x0` the loop `x <= x1` never runs: nothing is drawn |
| `vertical_line` | `x1 - x0` is 0, so the slope is 5 / 0, which in floating point is infinity, and `0 * infinity` is NaN |

The fix for the first two is to step along whichever direction is longer, in whichever direction the line goes. And there's no need for floating point at all.

```check
file raster/draw.h
run "cmake --build raster/build"
```

## Step 3 — Bresenham's line algorithm

**This step: replace `draw_line` in `raster/draw.h` with Bresenham's algorithm. Build and run the tests until every line test passes.**

Bresenham's algorithm (1962, for a pen plotter) steps one pixel at a time and keeps a whole-number **error term**: how far the pixel it's on is from the true line. At each step it moves along x, along y, or both, whichever keeps the error smallest.

```cpp
inline void draw_line(Image& img, int x0, int y0, int x1, int y1,
                      Color c)
{
    const int dx = std::abs(x1 - x0);
    const int dy = -std::abs(y1 - y0);
    const int step_x = x0 < x1 ? 1 : -1;
    const int step_y = y0 < y1 ? 1 : -1;
    int err = dx + dy;   // how far off the line the next pixel is
    while (true) {
        img.set(x0, y0, c);
        if (x0 == x1 && y0 == y1)
            break;
        const int e2 = 2 * err;
        if (e2 >= dy) {   // moving along x keeps us closer
            err += dy;
            x0 += step_x;
        }
        if (e2 <= dx) {   // moving along y keeps us closer
            err += dx;
            y0 += step_y;
        }
    }
}
```

- `step_x` and `step_y` are +1 or -1, so one loop handles every direction: all eight **octants**.
- `dy` is stored **negative**. Then `err` is `dx + dy`, and the two tests compare it against each axis without separate code for steep and shallow lines.
- `2 * err` avoids the halves that "is the line above or below the middle of this pixel?" would need.
- The loop stops on reaching the end point, so both ends are drawn.

Include `<cstdlib>` for `std::abs`, and remove the `<cmath>` include: nothing in this file needs it any more.

To see it work, step through it in the debugger, or paste the function into a `.cpp` with a small `main` and use 🔬 **Trace in CodeLens** to watch `err`.

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/draw.h
// draw.h: lines and filled triangles.
#pragma once

#include <cstdlib>

#include "image.h"

// Bresenham's line algorithm: whole numbers only. Each step moves one
// pixel along x, along y, or both, choosing whichever keeps the
// pixel closest to the true line. Both end points are drawn.
inline void draw_line(Image& img, int x0, int y0, int x1, int y1,
                      Color c)
{
    const int dx = std::abs(x1 - x0);
    const int dy = -std::abs(y1 - y0);
    const int step_x = x0 < x1 ? 1 : -1;
    const int step_y = y0 < y1 ? 1 : -1;
    int err = dx + dy;   // how far off the line the next pixel is
    while (true) {
        img.set(x0, y0, c);
        if (x0 == x1 && y0 == y1)
            break;
        const int e2 = 2 * err;
        if (e2 >= dy) {   // moving along x keeps us closer
            err += dy;
            x0 += step_x;
        }
        if (e2 <= dx) {   // moving along y keeps us closer
            err += dx;
            y0 += step_y;
        }
    }
}
```

```check
run "cmake --build raster/build"
tests "./raster/build/raster_tests" require="steep_line_has_no_gaps vertical_line right_to_left_draws_the_same_line a_line_off_the_edge_is_clipped" -- Step in both directions with step_x and step_y, and keep dy negative.
```

## Step 4 — The specification for triangles

**This step: create the supplied `raster/tests/triangle_test.cpp` and read it.**

`fill_triangle(img, a, b, c, colour)` takes the three corners as `Vec2`s, which needn't be whole numbers, and fills every pixel whose **centre**, `(x + 0.5, y + 0.5)`, is inside the triangle.

Why centres? A pixel is one sample of the picture. Deciding by "does the shape touch any part of the pixel" would make every shape fatter, and two shapes side by side would overlap. With one sample point per pixel, each pixel is either in or out.

The first test's triangle has corners (0, 0), (8, 0) and (0, 5): its long edge passes between pixel centres, never through one, so there is no doubt about any pixel. 20 centres are inside.

```cpp file=raster/tests/triangle_test.cpp provided
// Provided by the lesson: what fill_triangle must do.
#include "studio_test.hpp"

#include "draw.h"
#include "image.h"
#include "vec.h"

TEST(fills_the_pixels_whose_centres_are_inside)
{
    Image img(10, 10);
    fill_triangle(img, {0, 0}, {8, 0}, {0, 5}, colors::white);
    CHECK_EQ(img.count(colors::white), 20);
    CHECK_EQ(img.get(0, 0), colors::white);
    CHECK_EQ(img.get(6, 0), colors::white);   // centre (6.5, 0.5): in
    CHECK_EQ(img.get(7, 0), colors::black);   // centre (7.5, 0.5): out
    CHECK_EQ(img.get(0, 4), colors::white);
    CHECK_EQ(img.get(0, 5), colors::black);
}

TEST(either_winding_order_fills_the_same_pixels)
{
    Image img(10, 10);
    fill_triangle(img, {0, 0}, {0, 5}, {8, 0}, colors::white);
    CHECK_EQ(img.count(colors::white), 20);
}

TEST(a_flat_triangle_fills_nothing)
{
    Image img(10, 10);
    fill_triangle(img, {0, 0}, {4, 4}, {9, 9}, colors::white);
    CHECK_EQ(img.count(colors::white), 0);
}

TEST(a_triangle_missing_every_centre_fills_nothing)
{
    Image img(10, 10);
    fill_triangle(img, {0, 0}, {0.4, 0}, {0, 0.4}, colors::white);
    CHECK_EQ(img.count(colors::white), 0);
}

TEST(a_triangle_bigger_than_the_image_is_clipped)
{
    Image img(10, 10);
    fill_triangle(img, {-10, -10}, {50, -10}, {-10, 50}, colors::white);
    CHECK_EQ(img.count(colors::white), 100);
}
```

```check
file raster/tests/triangle_test.cpp
```

## Step 5 — Edge functions

**This step: add `edge` and `fill_triangle` to `raster/draw.h`. Build and run the tests.**

### Which side of a line is a point on?

The 2D cross product from lesson 3 answers it:

```cpp
inline double edge(Vec2 a, Vec2 b, Vec2 p)
{
    return cross(b - a, p - a);
}
```

It's positive when `p` is on one side of the line through `a` and `b`, negative on the other, and **zero exactly on it**. (Its size is twice the area of the triangle `a, b, p`.)

```text
      a ●───────────► b
          +  +  +          edge(a, b, p) > 0 on this side
                           (y down: below the line)
```

A point is inside the triangle when it's on the inside of **all three** edges: `a→b`, `b→c` and `c→a`. Which sign is "inside" depends on the order of the corners, clockwise or anticlockwise. So first make the order consistent: if `edge(a, b, c)` is negative, swap `b` and `c`. Now inside is positive for every edge. If it's zero, the corners are in a line and there's nothing to fill.

### Only test the pixels that could be inside

The **bounding box** of the corners, clipped to the image, holds every pixel that might be inside. A GPU does the same, in parallel, in blocks of pixels.

```cpp
for (int y = min_y; y <= max_y; ++y) {
    for (int x = min_x; x <= max_x; ++x) {
        const Vec2 p{x + 0.5, y + 0.5};   // the pixel's centre
        const double w0 = edge(b, c, p);
        const double w1 = edge(c, a, p);
        const double w2 = edge(a, b, p);
        if (w0 >= 0 && w1 >= 0 && w2 >= 0)
            img.set(x, y, col);
    }
}
```

- The box: `std::floor` of the smallest corner coordinate and `std::ceil` of the largest, then `std::max(0, ...)` and `std::min(width - 1, ...)` to keep it inside the image. `std::min({a.x, b.x, c.x})` takes the smallest of a list (`<algorithm>`).
- Name the three values `w0`, `w1`, `w2`: in lesson 7 they become **weights** that blend the corners.

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/draw.h
// draw.h: lines and filled triangles.
#pragma once

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <utility>

#include "image.h"
#include "vec.h"

// Bresenham's line algorithm: whole numbers only. Each step moves one
// pixel along x, along y, or both, choosing whichever keeps the
// pixel closest to the true line. Both end points are drawn.
inline void draw_line(Image& img, int x0, int y0, int x1, int y1,
                      Color c)
{
    const int dx = std::abs(x1 - x0);
    const int dy = -std::abs(y1 - y0);
    const int step_x = x0 < x1 ? 1 : -1;
    const int step_y = y0 < y1 ? 1 : -1;
    int err = dx + dy;   // how far off the line the next pixel is
    while (true) {
        img.set(x0, y0, c);
        if (x0 == x1 && y0 == y1)
            break;
        const int e2 = 2 * err;
        if (e2 >= dy) {   // moving along x keeps us closer
            err += dy;
            x0 += step_x;
        }
        if (e2 <= dx) {   // moving along y keeps us closer
            err += dx;
            y0 += step_y;
        }
    }
}

// The edge function: positive when p is on one side of the line
// from a to b, negative on the other side, and 0 on the line.
// Its size is twice the area of the triangle a, b, p.
inline double edge(Vec2 a, Vec2 b, Vec2 p)
{
    return cross(b - a, p - a);
}

// Fills every pixel whose CENTRE is inside the triangle a, b, c.
inline void fill_triangle(Image& img, Vec2 a, Vec2 b, Vec2 c,
                          Color col)
{
    if (edge(a, b, c) < 0)
        std::swap(b, c);   // one winding order: inside is positive
    if (edge(a, b, c) == 0)
        return;            // a flat triangle has no inside

    // Only pixels inside the bounding box can be inside the triangle.
    const double left = std::min({a.x, b.x, c.x});
    const double right = std::max({a.x, b.x, c.x});
    const double top = std::min({a.y, b.y, c.y});
    const double bottom = std::max({a.y, b.y, c.y});
    const int min_x = std::max(0, int(std::floor(left)));
    const int max_x = std::min(img.width() - 1, int(std::ceil(right)));
    const int min_y = std::max(0, int(std::floor(top)));
    const int max_y = std::min(img.height() - 1, int(std::ceil(bottom)));

    for (int y = min_y; y <= max_y; ++y) {
        for (int x = min_x; x <= max_x; ++x) {
            const Vec2 p{x + 0.5, y + 0.5};   // the pixel's centre
            const double w0 = edge(b, c, p);
            const double w1 = edge(c, a, p);
            const double w2 = edge(a, b, p);
            if (w0 >= 0 && w1 >= 0 && w2 >= 0)
                img.set(x, y, col);
        }
    }
}
```

```check
run "cmake --build raster/build"
tests "./raster/build/raster_tests" require="fills_the_pixels_whose_centres_are_inside either_winding_order_fills_the_same_pixels a_flat_triangle_fills_nothing a_triangle_bigger_than_the_image_is_clipped" -- Test each pixel at its centre (x + 0.5, y + 0.5), and swap b and c when edge(a, b, c) is negative.
```

## Step 6 — Two triangles, one edge

**This step: create the supplied `raster/tests/shared_edge_test.cpp`. Before you build and run the tests, predict the result.**

A mesh is triangles sharing edges: a square is two triangles that share a diagonal. The test fills an 8 × 8 square's two halves separately and adds up the pixels.

The diagonal from (0, 0) to (8, 8) passes **exactly** through 8 pixel centres: (0.5, 0.5), (1.5, 1.5), and so on. For them, `edge` returns exactly 0. All the coordinates are multiples of 0.5, which binary floating point holds exactly, so there's no rounding to hide behind.

**Predict:** what is `upper + lower`?

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/tests/shared_edge_test.cpp provided
// Provided by the lesson: two triangles that share an edge must not
// both draw the pixels on it.
#include "studio_test.hpp"

#include "draw.h"
#include "image.h"
#include "vec.h"

namespace {

int filled(Vec2 a, Vec2 b, Vec2 c)
{
    Image img(10, 10);
    fill_triangle(img, a, b, c, colors::white);
    return img.count(colors::white);
}

} // namespace

TEST(two_halves_of_a_square_fill_it_exactly_once)
{
    // The 8 x 8 square, cut along its diagonal from (0, 0) to (8, 8).
    // That diagonal passes exactly through 8 pixel centres.
    const int upper = filled({0, 0}, {8, 0}, {8, 8});
    const int lower = filled({0, 0}, {8, 8}, {0, 8});
    CHECK_EQ(upper + lower, 64);
}

TEST(the_other_diagonal_too)
{
    const int left = filled({0, 0}, {8, 0}, {0, 8});
    const int right = filled({8, 0}, {8, 8}, {0, 8});
    CHECK_EQ(left + right, 64);
}
```

### What happened

```text
CHECK_EQ(upper + lower, 64) failed
    left:  72
    right: 64
```

The 8 pixels on the diagonal pass `w >= 0` for **both** triangles, so both draw them.

In an opaque image you'd never see it: the second colour simply replaces the first. But it's still wrong:

- **Wasted work.** On a GPU every covered pixel runs a program (lesson 8). Shared edges are everywhere in a mesh.
- **Visible seams with transparency.** Draw a half-transparent mesh and the shared-edge pixels are blended twice: a darker line along every edge.

Switching to `w > 0` doesn't help: then **neither** triangle draws them, and a line of background shows through. Each pixel on a shared edge must belong to exactly one of the two triangles.

```check
file raster/tests/shared_edge_test.cpp
run "cmake --build raster/build"
```

## Step 7 — The top-left rule

**This step: add the top-left rule to `fill_triangle` in `raster/draw.h`. Build and run the tests until the shared-edge tests pass.**

Direct3D, OpenGL and Vulkan all settle it with the same convention. A pixel centre exactly on an edge belongs to the triangle only if that edge is a **top** edge or a **left** edge of it:

- **top edge**: exactly horizontal, with the triangle below it;
- **left edge**: the triangle is to its right.

A shared edge is the left edge of one triangle and the right edge of the other (or the top of one and the bottom of the other), so exactly one of them gets the pixel.

After the swap, the corners go round so that inside is positive. With y pointing down, that means a top edge goes **right** along a horizontal line, and a left edge goes **up**:

```cpp
inline bool is_top_left(Vec2 from, Vec2 to)
{
    const Vec2 d = to - from;
    return (d.y == 0 && d.x > 0) || d.y < 0;
}

inline bool covers(double w, bool top_left)
{
    return w > 0 || (w == 0 && top_left);
}
```

Work out the three flags once per triangle, before the loops (`is_top_left(b, c)` for `w0`, and so on), and test each weight with `covers`.

**Check it by hand:** the triangle (0, 0), (8, 0), (0, 8). The edge from (0, 8) to (0, 0) goes up: a left edge, so it keeps its pixels. The diagonal from (8, 0) to (0, 8) goes down: not top-left, so its pixels belong to the neighbouring triangle.

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/draw.h
// draw.h: lines and filled triangles.
#pragma once

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <utility>

#include "image.h"
#include "vec.h"

// Bresenham's line algorithm: whole numbers only. Each step moves one
// pixel along x, along y, or both, choosing whichever keeps the
// pixel closest to the true line. Both end points are drawn.
inline void draw_line(Image& img, int x0, int y0, int x1, int y1,
                      Color c)
{
    const int dx = std::abs(x1 - x0);
    const int dy = -std::abs(y1 - y0);
    const int step_x = x0 < x1 ? 1 : -1;
    const int step_y = y0 < y1 ? 1 : -1;
    int err = dx + dy;   // how far off the line the next pixel is
    while (true) {
        img.set(x0, y0, c);
        if (x0 == x1 && y0 == y1)
            break;
        const int e2 = 2 * err;
        if (e2 >= dy) {   // moving along x keeps us closer
            err += dy;
            x0 += step_x;
        }
        if (e2 <= dx) {   // moving along y keeps us closer
            err += dx;
            y0 += step_y;
        }
    }
}

// The edge function: positive when p is on one side of the line
// from a to b, negative on the other side, and 0 on the line.
// Its size is twice the area of the triangle a, b, p.
inline double edge(Vec2 a, Vec2 b, Vec2 p)
{
    return cross(b - a, p - a);
}

// The top-left rule. A pixel centre exactly on an edge shared by two
// triangles must belong to exactly one of them. It belongs to the
// triangle for which the edge is a TOP edge (horizontal, with the
// inside below it) or a LEFT edge (the inside to its right). With
// inside positive and y down, those are the edges going right along
// a horizontal line, or going up.
inline bool is_top_left(Vec2 from, Vec2 to)
{
    const Vec2 d = to - from;
    return (d.y == 0 && d.x > 0) || d.y < 0;
}

inline bool covers(double w, bool top_left)
{
    return w > 0 || (w == 0 && top_left);
}

// Fills every pixel whose CENTRE is inside the triangle a, b, c.
inline void fill_triangle(Image& img, Vec2 a, Vec2 b, Vec2 c,
                          Color col)
{
    if (edge(a, b, c) < 0)
        std::swap(b, c);   // one winding order: inside is positive
    if (edge(a, b, c) == 0)
        return;            // a flat triangle has no inside

    const bool top_left0 = is_top_left(b, c);
    const bool top_left1 = is_top_left(c, a);
    const bool top_left2 = is_top_left(a, b);

    // Only pixels inside the bounding box can be inside the triangle.
    const double left = std::min({a.x, b.x, c.x});
    const double right = std::max({a.x, b.x, c.x});
    const double top = std::min({a.y, b.y, c.y});
    const double bottom = std::max({a.y, b.y, c.y});
    const int min_x = std::max(0, int(std::floor(left)));
    const int max_x = std::min(img.width() - 1, int(std::ceil(right)));
    const int min_y = std::max(0, int(std::floor(top)));
    const int max_y = std::min(img.height() - 1, int(std::ceil(bottom)));

    for (int y = min_y; y <= max_y; ++y) {
        for (int x = min_x; x <= max_x; ++x) {
            const Vec2 p{x + 0.5, y + 0.5};   // the pixel's centre
            const double w0 = edge(b, c, p);
            const double w1 = edge(c, a, p);
            const double w2 = edge(a, b, p);
            if (covers(w0, top_left0) && covers(w1, top_left1) &&
                covers(w2, top_left2))
                img.set(x, y, col);
        }
    }
}
```

```check
run "cmake --build raster/build"
tests "./raster/build/raster_tests" require="two_halves_of_a_square_fill_it_exactly_once the_other_diagonal_too fills_the_pixels_whose_centres_are_inside" -- A pixel centre with w == 0 is covered only when that edge is top-left.
```

## Step 8 — The reviewer's tests

**This step: create the supplied `raster/tests/triangle_review_test.cpp`, build, run the tests, and fix `draw.h` if any fail.**

A reviewer looks for the cases the specification didn't try:

- **A fan**: eight triangles around the centre of the square, sharing edges in every direction, diagonal, horizontal and vertical. Every pixel is covered exactly once.
- **A horizontal shared edge**, through a row of pixel centres: it must go to the triangle below, whose top edge it is.
- **The other winding order**: the same square, corners listed clockwise instead. The rule must not depend on how the caller ordered the corners.
- **A sliver** 0.2 pixels wide that still contains a column of pixel centres.

```cpp file=raster/tests/triangle_review_test.cpp provided
// The reviewer's tests for fill_triangle. Do not edit them: make them
// pass.
#include "studio_test.hpp"

#include "draw.h"
#include "image.h"
#include "vec.h"

namespace {

int filled(Vec2 a, Vec2 b, Vec2 c)
{
    Image img(10, 10);
    fill_triangle(img, a, b, c, colors::white);
    return img.count(colors::white);
}

} // namespace

TEST(review_a_fan_of_eight_triangles_covers_the_square_once)
{
    // Eight triangles around the centre (4, 4) of the 8 x 8 square.
    const Vec2 ring[] = {{0, 0}, {4, 0}, {8, 0}, {8, 4},
                         {8, 8}, {4, 8}, {0, 8}, {0, 4}};
    int total = 0;
    for (int i = 0; i < 8; ++i)
        total += filled({4, 4}, ring[i], ring[(i + 1) % 8]);
    CHECK_EQ(total, 64);
}

TEST(review_a_shared_horizontal_edge_goes_to_the_triangle_below)
{
    // Both triangles touch the line y = 4.5, through row 4's centres.
    Image img(10, 10);
    fill_triangle(img, {4, 0}, {0, 4.5}, {8, 4.5}, colors::red);
    fill_triangle(img, {0, 4.5}, {8, 4.5}, {4, 9}, colors::blue);
    CHECK_EQ(img.get(4, 4), colors::blue);
    const int above = filled({4, 0}, {0, 4.5}, {8, 4.5});
    const int below = filled({0, 4.5}, {8, 4.5}, {4, 9});
    CHECK_EQ(above + below, img.count(colors::red) +
                                img.count(colors::blue));
}

TEST(review_the_top_left_rule_does_not_depend_on_winding)
{
    const int upper = filled({8, 8}, {8, 0}, {0, 0});
    const int lower = filled({0, 8}, {8, 8}, {0, 0});
    CHECK_EQ(upper + lower, 64);
}

TEST(review_a_thin_sliver_still_fills_its_centres)
{
    // 0.2 pixels wide, around the centres of column 3.
    CHECK_EQ(filled({3.4, 0}, {3.6, 0}, {3.5, 10}), 10);
}
```

```check
file raster/tests/triangle_review_test.cpp
run "cmake --build raster/build"
tests "./raster/build/raster_tests" require="review_a_fan_of_eight_triangles_covers_the_square_once review_a_shared_horizontal_edge_goes_to_the_triangle_below review_the_top_left_rule_does_not_depend_on_winding review_a_thin_sliver_still_fills_its_centres" -- Work out the top-left flags AFTER swapping b and c, from the edges as they then run.
```

## Step 9 — Draw a picture

**This step: write `raster/apps/shapes.cpp`: a 200 × 150 picture made from filled triangles and lines, saved as `images/shapes.bmp`. Build it, run it, and open it.**

Your picture, your choice. It must use `fill_triangle` and `draw_line`. The reference draws a house: a sky, grass and walls are each a rectangle (two triangles sharing a diagonal), a roof is one triangle, and a sun is twelve lines from a centre point. A small helper keeps that tidy:

```cpp
void fill_rect(Image& img, Vec2 top_left, Vec2 bottom_right, Color c)
```

Remember the coordinates: (0, 0) is the top-left pixel and y grows downwards.

```text
cmake --build raster/build
./raster/build/shapes
./raster/build/imgcheck images/shapes.bmp
```

```cpp file=raster/apps/shapes.cpp
// shapes.cpp: a picture made of triangles and lines.
#include <cmath>
#include <filesystem>
#include <iostream>

#include "bmp.h"
#include "draw.h"
#include "image.h"
#include "vec.h"

// A rectangle is two triangles that share a diagonal.
void fill_rect(Image& img, Vec2 top_left, Vec2 bottom_right, Color c)
{
    const Vec2 top_right{bottom_right.x, top_left.y};
    const Vec2 bottom_left{top_left.x, bottom_right.y};
    fill_triangle(img, top_left, top_right, bottom_right, c);
    fill_triangle(img, top_left, bottom_right, bottom_left, c);
}

int main()
{
    Image img(200, 150, Color{135, 206, 235});                // sky
    fill_rect(img, {0, 110}, {200, 150}, Color{60, 160, 60});  // grass
    fill_rect(img, {60, 70}, {140, 110}, Color{230, 200, 160});
    fill_triangle(img, {50, 70}, {150, 70}, {100, 30},
                  Color{180, 40, 40});                         // roof
    fill_rect(img, {90, 85}, {110, 110}, Color{110, 70, 40});  // door

    // The sun: 12 rays, as lines from its centre.
    const Color yellow{255, 220, 0};
    for (int i = 0; i < 12; ++i) {
        const double angle = i * 3.14159265358979 / 6;
        const int x = 170 + int(std::lround(18 * std::cos(angle)));
        const int y = 25 + int(std::lround(18 * std::sin(angle)));
        draw_line(img, 170, 25, x, y, yellow);
    }

    std::filesystem::create_directories("images");
    write_bmp(img, "images/shapes.bmp");
    std::cout << "wrote images/shapes.bmp\n";
}
```

```check
contains raster/apps/shapes.cpp "fill_triangle(" -- Draw at least one filled triangle.
contains raster/apps/shapes.cpp "draw_line(" -- Draw at least one line.
run "cmake --build raster/build"
run "./raster/build/shapes" label="shapes runs"
run "./raster/build/imgcheck images/shapes.bmp" stdout="images/shapes.bmp: BMP, 200 x 150" label="images/shapes.bmp is a 200 x 150 BMP" -- Save the image with write_bmp(img, "images/shapes.bmp").
```
