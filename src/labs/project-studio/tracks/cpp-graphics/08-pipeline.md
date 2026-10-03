---
title: 8 — The Pipeline, Made Visible
track: Graphics from First Principles
runtime: cpp
reference: optional
console: true
---

`solid_cube.cpp` works, but everything is mixed together in one `main`: transforming, culling, lighting, filling. A GPU splits the same work into a fixed sequence of **stages**, and lets you program two of them:

```text
vertex buffer + index buffer
        │
  1. vertex shader        ← your code: once per vertex
  2. primitive assembly   (3 indices → a triangle)
  3. clipping
  4. perspective divide + viewport
  5. face culling
  6. rasterizer           (which pixels; barycentric weights)
  7. depth test
  8. fragment shader      ← your code: once per covered pixel
  9. output to the framebuffer
```

In this lesson you build that function, `draw_indexed`, with the two programmable stages passed in as lambdas. Then you'll see, stage by stage, what OpenGL and Vulkan call each piece.

## Step 1 — Pull the rasterizer out

**This step: refactor `raster/render.h`: move the pixel loop out of `fill_triangle_depth` into a function template, `rasterize`, that calls a function for every covered pixel. Rebuild and rerun everything: nothing should change.**

The pipeline needs the rasterizer as a stage on its own: given three screen-space corners, report each covered pixel and its barycentric weights, and let the caller decide what to do with them.

```cpp
template <typename OnPixel>
void rasterize(Vec3 a, Vec3 b, Vec3 c, int width, int height,
               OnPixel on_pixel)
```

It calls `on_pixel(x, y, l0, l1, l2)`. `OnPixel` is any type that can be called that way: in practice, a lambda. Making it a template parameter, rather than a `std::function`, lets the compiler inline the lambda into the loop, which matters when it runs once per pixel.

**One trap.** `fill_triangle_depth` swapped `b` and `c` to fix the winding. The weights then belonged to the swapped corners, which didn't matter while the only value blended was a depth computed from the same swapped corners. A pipeline blends values the *caller* attached to `a`, `b` and `c`, so `rasterize` must not swap. Instead:

- multiply each edge value by `sign`, +1 or −1, so inside is positive either way;
- for the other winding, every edge runs backwards, so ask `is_top_left(to, from)` instead of `is_top_left(from, to)`.

Then `fill_triangle_depth` becomes a few lines:

```cpp
rasterize(a, b, c, fb.width(), fb.height(),
          [&](int x, int y, double l0, double l1, double l2) {
              const double z = l0 * a.z + l1 * b.z + l2 * c.z;
              if (z >= fb.depth_at(x, y))
                  return;   // something nearer is already there
              fb.depth_at(x, y) = z;
              fb.color.set(x, y, col);
              ++written;
          });
```

Inside the lambda, `return` skips one pixel, like `continue` did in the loop.

This is a **refactoring**: the structure changes, the behaviour mustn't. The tests and `solid_cube` are your proof.

```text
cmake --build raster/build
./raster/build/raster_tests
./raster/build/solid_cube
```

```cpp file=raster/render.h
// render.h: drawing with depth, so near things hide far things.
#pragma once

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <limits>
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

// The rasterizer stage. Calls on_pixel(x, y, l0, l1, l2) for every
// pixel whose centre is inside the screen-space triangle a, b, c,
// where l0, l1 and l2 are that centre's barycentric coordinates:
// how much of a, b and c is in it. They add up to 1. Either winding
// order works, and the weights always belong to a, b, c as given.
template <typename OnPixel>
void rasterize(Vec3 a, Vec3 b, Vec3 c, int width, int height,
               OnPixel on_pixel)
{
    const Vec2 a2{a.x, a.y}, b2{b.x, b.y}, c2{c.x, c.y};
    const double area = edge(a2, b2, c2);
    if (area == 0)
        return;   // a flat triangle has no inside
    // With the other winding every edge runs the other way, and the
    // top-left rule must look at it that way round.
    auto top_left = [&](Vec2 from, Vec2 to) {
        return area > 0 ? is_top_left(from, to) : is_top_left(to, from);
    };
    const bool top_left0 = top_left(b2, c2);
    const bool top_left1 = top_left(c2, a2);
    const bool top_left2 = top_left(a2, b2);
    const double sign = area > 0 ? 1 : -1;   // makes inside positive

    // Only pixels inside the bounding box can be inside the triangle.
    const double left = std::min({a.x, b.x, c.x});
    const double right = std::max({a.x, b.x, c.x});
    const double top = std::min({a.y, b.y, c.y});
    const double bottom = std::max({a.y, b.y, c.y});
    const int min_x = std::max(0, int(std::floor(left)));
    const int max_x = std::min(width - 1, int(std::ceil(right)));
    const int min_y = std::max(0, int(std::floor(top)));
    const int max_y = std::min(height - 1, int(std::ceil(bottom)));

    for (int y = min_y; y <= max_y; ++y) {
        for (int x = min_x; x <= max_x; ++x) {
            const Vec2 p{x + 0.5, y + 0.5};
            const double w0 = sign * edge(b2, c2, p);
            const double w1 = sign * edge(c2, a2, p);
            const double w2 = sign * edge(a2, b2, p);
            if (covers(w0, top_left0) && covers(w1, top_left1) &&
                covers(w2, top_left2))
                on_pixel(x, y, w0 / (sign * area), w1 / (sign * area),
                         w2 / (sign * area));
        }
    }
}

// Fills a triangle whose corners are in SCREEN space: x and y in
// pixels, z the depth that viewport() kept. Returns how many pixels
// it wrote.
inline int fill_triangle_depth(Framebuffer& fb, Vec3 a, Vec3 b, Vec3 c,
                               Color col)
{
    int written = 0;
    rasterize(a, b, c, fb.width(), fb.height(),
              [&](int x, int y, double l0, double l1, double l2) {
                  const double z = l0 * a.z + l1 * b.z + l2 * c.z;
                  if (z >= fb.depth_at(x, y))
                      return;   // something nearer is already there
                  fb.depth_at(x, y) = z;
                  fb.color.set(x, y, col);
                  ++written;
              });
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
contains raster/render.h "void rasterize(" -- Add a function template rasterize(a, b, c, width, height, on_pixel).
run "cmake --build raster/build"
tests "./raster/build/raster_tests" -- A refactoring must not change behaviour: compare with the loop you moved.
run "./raster/build/solid_cube" stdout="triangles drawn: 6, culled: 6"
run "./raster/build/imgcheck images/solid_cube.bmp 115 110" stdout="pixel (115, 110) = 106 62 18" label="solid_cube draws the same picture"
```

## Step 2 — The specification for the pipeline

**This step: create the supplied `raster/tests/pipeline_test.cpp` and read it.**

`draw_indexed(target, state, vertices, indices, vertex_shader, fragment_shader)`:

| Argument | Is | GPU name |
|---|---|---|
| `vertices` | a vector of any vertex type you like | vertex buffer |
| `indices` | every 3 make a triangle | index buffer |
| `vertex_shader` | `VertexOut(const Vertex&)`: a clip-space position, plus a `Vec3` to blend | vertex shader |
| `fragment_shader` | `Color(const Fragment&)`: a pixel's colour | fragment (pixel) shader |
| `state` | depth test on or off, culling on or off | pipeline state |
| `target` | colour + depth | framebuffer with a depth attachment |

It returns `DrawStats`: how many vertices were shaded, triangles assembled, clipped, culled, and fragments shaded. The tests use them to see inside the pipeline:

- **The vertex shader runs once per vertex**, not once per index. A square is 4 vertices but 6 indices: the shared corners are shaded once. That saving is why index buffers exist.
- **Every pixel of a full-screen square is shaded exactly once**: the top-left rule, doing its job inside the pipeline.
- **Varyings are perspective-correct.** The last-but-one test explains: on screen, a far corner's share of a pixel is smaller than its screen distance suggests.

The tests give positions directly in clip space, so their vertex shaders just pass them on.

```cpp file=raster/tests/pipeline_test.cpp provided
// Provided by the lesson: what draw_indexed must do.
#include "studio_test.hpp"

#include <cmath>
#include <vector>

#include "image.h"
#include "mat.h"
#include "pipeline.h"
#include "render.h"
#include "vec.h"

namespace {

// These tests give positions straight in clip space, so the vertex
// shader just passes them on.
struct V {
    Vec4 position;
    Vec3 color;
};

VertexOut pass_through(const V& v)
{
    return {v.position, v.color};
}

Color white_fragment(const Fragment&)
{
    return colors::white;
}

// Two triangles covering the whole screen, anticlockwise (front).
const std::vector<V> quad = {
    {{-1, -1, 0, 1}, {}}, {{1, -1, 0, 1}, {}},
    {{1, 1, 0, 1}, {}},   {{-1, 1, 0, 1}, {}}};
const std::vector<int> quad_indices = {0, 1, 2, 0, 2, 3};

// Two triangles over the same pixels: the first nearer (NDC z -0.5),
// the second farther (0.5).
const std::vector<V> near_and_far = {
    {{-1, -1, -0.5, 1}, {}}, {{1, -1, -0.5, 1}, {}},
    {{1, 1, -0.5, 1}, {}},   {{-1, -1, 0.5, 1}, {}},
    {{1, -1, 0.5, 1}, {}},   {{1, 1, 0.5, 1}, {}}};

Color red_fragment(const Fragment&) { return colors::red; }
Color blue_fragment(const Fragment&) { return colors::blue; }

} // namespace

TEST(the_vertex_shader_runs_once_per_vertex)
{
    Framebuffer fb(8, 8);
    int calls = 0;
    const DrawStats stats = draw_indexed(
        fb, PipelineState{}, quad, quad_indices,
        [&](const V& v) { ++calls; return pass_through(v); },
        white_fragment);
    CHECK_EQ(calls, 4);   // 4 vertices, though 6 indices
    CHECK_EQ(stats.vertices_shaded, 4);
    CHECK_EQ(stats.triangles, 2);
}

TEST(a_full_screen_quad_shades_every_pixel_exactly_once)
{
    Framebuffer fb(8, 8);
    int fragments = 0;
    const DrawStats stats = draw_indexed(
        fb, PipelineState{}, quad, quad_indices, pass_through,
        [&](const Fragment&) { ++fragments; return colors::white; });
    CHECK_EQ(fragments, 64);
    CHECK_EQ(stats.fragments_shaded, 64);
    CHECK_EQ(fb.color.count(colors::white), 64);
}

TEST(back_faces_are_culled_only_when_asked)
{
    const std::vector<int> clockwise = {0, 2, 1};
    Framebuffer fb(8, 8);
    DrawStats stats = draw_indexed(fb, PipelineState{}, quad, clockwise,
                                   pass_through, white_fragment);
    CHECK_EQ(stats.culled, 1);
    CHECK_EQ(stats.fragments_shaded, 0);

    PipelineState no_culling;
    no_culling.cull_back_faces = false;
    stats = draw_indexed(fb, no_culling, quad, clockwise, pass_through,
                         white_fragment);
    CHECK_EQ(stats.culled, 0);
    CHECK(stats.fragments_shaded > 0);
}

TEST(the_depth_test_keeps_the_nearer_fragment)
{
    Framebuffer fb(8, 8);
    draw_indexed(fb, PipelineState{}, near_and_far, {0, 1, 2},
                 pass_through, red_fragment);
    const DrawStats stats = draw_indexed(fb, PipelineState{},
                                         near_and_far, {3, 4, 5},
                                         pass_through, blue_fragment);
    CHECK_EQ(stats.fragments_shaded, 0);   // all hidden: early-z
    CHECK_EQ(fb.color.get(6, 6), colors::red);
}

TEST(without_a_depth_test_the_last_triangle_wins)
{
    PipelineState no_depth;
    no_depth.depth_test = false;
    Framebuffer fb(8, 8);
    draw_indexed(fb, no_depth, near_and_far, {0, 1, 2}, pass_through,
                 red_fragment);
    draw_indexed(fb, no_depth, near_and_far, {3, 4, 5}, pass_through,
                 blue_fragment);
    CHECK_EQ(fb.color.get(6, 6), colors::blue);
}

TEST(varyings_are_blended_from_the_corners)
{
    const std::vector<V> tri = {{{-1, -1, 0, 1}, {1, 0, 0}},
                                {{1, -1, 0, 1}, {0, 1, 0}},
                                {{-1, 1, 0, 1}, {0, 0, 1}}};
    Framebuffer fb(8, 8);
    bool weights_add_up = true;
    Vec3 corner{};
    draw_indexed(fb, PipelineState{}, tri, {0, 1, 2}, pass_through,
                 [&](const Fragment& f) {
                     const Vec3 v = f.varying;
                     if (std::abs(v.x + v.y + v.z - 1) > 1e-12)
                         weights_add_up = false;
                     if (f.x == 0 && f.y == 7)   // next to corner 0
                         corner = v;
                     return colors::white;
                 });
    CHECK(weights_add_up);
    CHECK(corner.x > 0.8);
}

TEST(varyings_are_perspective_correct)
{
    // Corner 1 is three times as far away (w = 3) as the others.
    const std::vector<V> tri = {{{-1, -1, 0, 1}, {0, 0, 0}},
                                {{3, -3, 0, 3}, {1, 0, 0}},
                                {{-1, 1, 0, 1}, {0, 0, 0}}};
    Framebuffer fb(8, 8);
    double at_pixel = -1;
    draw_indexed(fb, PipelineState{}, tri, {0, 1, 2}, pass_through,
                 [&](const Fragment& f) {
                     if (f.x == 3 && f.y == 7)
                         at_pixel = f.varying.x;
                     return colors::white;
                 });
    // On screen, pixel (3, 7) is 0.4375 of the way to corner 1, but
    // in 3D it's much less, because that corner is far away: 7 / 34.
    CHECK_NEAR(at_pixel, 7.0 / 34.0, 1e-12);
}

TEST(a_triangle_behind_the_camera_is_clipped)
{
    const std::vector<V> behind = {{{-1, -1, 0, -1}, {}},
                                   {{1, -1, 0, -1}, {}},
                                   {{1, 1, 0, -1}, {}}};
    Framebuffer fb(8, 8);
    const DrawStats stats = draw_indexed(fb, PipelineState{}, behind,
                                         {0, 1, 2}, pass_through,
                                         white_fragment);
    CHECK_EQ(stats.clipped, 1);
    CHECK_EQ(stats.fragments_shaded, 0);
}
```

```check
file raster/tests/pipeline_test.cpp
```

## Step 3 — draw_indexed

**This step: create `raster/pipeline.h` with `VertexOut`, `Fragment`, `PipelineState`, `DrawStats` and the function template `draw_indexed`. Build and run the tests.**

The types come first:

```cpp
struct VertexOut {
    Vec4 position;   // clip space: OpenGL's gl_Position
    Vec3 varying;    // blended across the triangle
};

struct Fragment {
    int x;
    int y;
    double depth;
    Vec3 varying;
};

struct PipelineState {
    bool depth_test = true;
    bool cull_back_faces = true;
};
```

`DrawStats` has five `int` counters, all starting at 0. Then `draw_indexed` follows the stages in order. Write each as a commented block:

1. **Vertex shader.** Call it once for each vertex, into a `std::vector<VertexOut>`.
2. **Primitive assembly.** Step through `indices` three at a time; look the three up with `.at()`, which throws on a bad index instead of reading garbage.
3. **Clipping.** A full clipper cuts triangles at the near plane. Ours drops any triangle with a corner where `w <= 0` (behind the camera) or `z < -w` (nearer than the near plane). Count it.
4. **Divide and viewport**, for each corner.
5. **Culling**, if `state.cull_back_faces`. Count it.
6. **Rasterize**, with a lambda that does stages 7 to 9.
7. **Depth test**, if `state.depth_test`: return early if the pixel is not nearer. Testing *before* the fragment shader is what GPUs call **early-z**: hidden pixels never run your shader.
8. **Fragment shader**: blend the varying, build a `Fragment`, call it, count it.
9. **Output**: set the colour; write the depth if the depth test is on.

### Perspective-correct blending

The barycentric weights measure **screen** area. But a far corner covers less of the real surface per pixel than a near one. Divide each weight by its corner's `w` (its distance), then renormalise:

```cpp
const double p0 = l0 / v0.position.w;
const double p1 = l1 / v1.position.w;
const double p2 = l2 / v2.position.w;
const Vec3 varying = (p0 * v0.varying + p1 * v1.varying +
                      p2 * v2.varying) / (p0 + p1 + p2);
```

Without it, textures on a road wobble and swim as the camera moves: the original PlayStation's famous look. The depth needs no correction, because NDC z is already in screen space.

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/pipeline.h
// pipeline.h: the graphics pipeline, one stage at a time, the way a
// GPU runs it. You supply the two programmable stages, the vertex
// shader and the fragment shader, as functions or lambdas.
#pragma once

#include <cstddef>
#include <vector>

#include "camera.h"
#include "image.h"
#include "mat.h"
#include "render.h"
#include "vec.h"

// What a vertex shader returns: the clip-space position (OpenGL calls
// it gl_Position), and one "varying", a value that the rasterizer
// interpolates across the triangle for the fragment shader.
struct VertexOut {
    Vec4 position;
    Vec3 varying;
};

// What the fragment shader is given for each covered pixel.
struct Fragment {
    int x;
    int y;
    double depth;
    Vec3 varying;
};

// The fixed-function settings: chosen before drawing, not
// programmable. On a GPU they are baked into a pipeline object.
struct PipelineState {
    bool depth_test = true;
    bool cull_back_faces = true;
};

// What happened during one draw.
struct DrawStats {
    int vertices_shaded = 0;
    int triangles = 0;
    int clipped = 0;
    int culled = 0;
    int fragments_shaded = 0;
};

template <typename Vertex, typename VertexShader, typename FragmentShader>
DrawStats draw_indexed(Framebuffer& target, const PipelineState& state,
                       const std::vector<Vertex>& vertices,
                       const std::vector<int>& indices,
                       VertexShader vertex_shader,
                       FragmentShader fragment_shader)
{
    DrawStats stats;

    // 1. Vertex shader: once per VERTEX, however many triangles use it.
    std::vector<VertexOut> shaded;
    shaded.reserve(vertices.size());
    for (const Vertex& v : vertices) {
        shaded.push_back(vertex_shader(v));
        ++stats.vertices_shaded;
    }

    // 2. Primitive assembly: every three indices make one triangle.
    for (std::size_t i = 0; i + 2 < indices.size(); i += 3) {
        const VertexOut& v0 = shaded.at(indices[i]);
        const VertexOut& v1 = shaded.at(indices[i + 1]);
        const VertexOut& v2 = shaded.at(indices[i + 2]);
        ++stats.triangles;

        // 3. Clipping, simplified: drop a triangle with any corner
        //    behind the camera or nearer than the near plane. A GPU
        //    cuts such a triangle into pieces instead.
        auto in_front = [](Vec4 p) { return p.w > 0 && p.z >= -p.w; };
        if (!in_front(v0.position) || !in_front(v1.position) ||
            !in_front(v2.position)) {
            ++stats.clipped;
            continue;
        }

        // 4. Perspective divide and viewport transform.
        const int w = target.width(), h = target.height();
        const Vec3 s0 = viewport(perspective_divide(v0.position), w, h);
        const Vec3 s1 = viewport(perspective_divide(v1.position), w, h);
        const Vec3 s2 = viewport(perspective_divide(v2.position), w, h);

        // 5. Face culling.
        if (state.cull_back_faces && is_back_facing(s0, s1, s2)) {
            ++stats.culled;
            continue;
        }

        // 6. Rasterizer: which pixels, and how much of each corner.
        rasterize(s0, s1, s2, w, h,
                  [&](int x, int y, double l0, double l1, double l2) {
            // 7. Depth test, before the fragment shader runs
            //    ("early-z"), so hidden pixels cost nothing.
            const double z = l0 * s0.z + l1 * s1.z + l2 * s2.z;
            if (state.depth_test && z >= target.depth_at(x, y))
                return;

            // Perspective-correct interpolation: weight each corner
            // by 1 / w, so far corners count for less.
            const double p0 = l0 / v0.position.w;
            const double p1 = l1 / v1.position.w;
            const double p2 = l2 / v2.position.w;
            const Vec3 varying = (p0 * v0.varying + p1 * v1.varying +
                                  p2 * v2.varying) / (p0 + p1 + p2);

            // 8. Fragment shader: the pixel's colour.
            const Color color = fragment_shader(Fragment{x, y, z, varying});
            ++stats.fragments_shaded;

            // 9. Output: write colour and depth to the framebuffer.
            target.color.set(x, y, color);
            if (state.depth_test)
                target.depth_at(x, y) = z;
        });
    }
    return stats;
}
```

```check
run "cmake --build raster/build"
tests "./raster/build/raster_tests" require="the_vertex_shader_runs_once_per_vertex a_full_screen_quad_shades_every_pixel_exactly_once back_faces_are_culled_only_when_asked the_depth_test_keeps_the_nearer_fragment without_a_depth_test_the_last_triangle_wins varyings_are_blended_from_the_corners varyings_are_perspective_correct a_triangle_behind_the_camera_is_clipped" -- Shade each vertex once, before assembling triangles; divide each weight by its corner's w.
```

## Step 4 — A scene, through the pipeline

**This step: write `raster/apps/scene.cpp`: two cubes drawn with `draw_indexed`, lit per pixel by a fragment shader. Print each draw's statistics and save `images/scene.bmp`.**

### The vertex buffer

Each vertex carries a position **and** a normal:

```cpp
struct Vertex {
    Vec3 position;
    Vec3 normal;
};
```

So a cube needs **24** vertices, not 8: a corner is shared by three faces, and each face needs it with a different normal. `make_cube()` builds them face by face: for a face normal `n`, two directions across the face, `u` and `v = cross(n, u)`, give the corners `n - u - v`, `n + u - v`, `n + u + v`, `n - u + v`, anticlockwise from outside, and indices 0, 1, 2, 0, 2, 3.

### Uniforms and shaders

Values that are the same for every vertex of a draw, the matrices and the light, are **uniforms**. Here they're simply what the lambdas capture:

```cpp
auto vertex_shader = [&](const Vertex& v) {
    const Vec3 p = v.position;
    return VertexOut{mvp * Vec4{p.x, p.y, p.z, 1},
                     transform_vector(model, v.normal)};
};
auto fragment_shader = [&](const Fragment& f) {
    const Vec3 n = normalize(f.varying);
    return shade(base, 0.15 + 0.85 * lambert(n, to_light));
};
```

The normal travels as the varying and is blended per pixel, then normalised again, because blending unit vectors shortens them. Lighting each pixel like this is **per-pixel** (Phong-style) lighting.

### The scene

- A 240 × 180 framebuffer cleared to `Color{30, 30, 40}`; `look_at({0, 2, 7}, {0, 0, 0}, {0, 1, 0})`; `perspective(50 * degree, 240.0 / 180.0, 0.1, 100)`; `to_light = normalize(Vec3{-1, 2, 2})`.
- Draw the **blue** cube first, `Color{60, 120, 230}`, with model `translate(Vec3{0.9, -0.4, 1.2}) * rotate_y(-20 * degree) * rotate_x(15 * degree) * scale(Vec3{0.7, 0.7, 0.7})`.
- Then the **orange** cube, `Color{240, 140, 40}`, with model `translate(Vec3{-0.9, 0, -0.5}) * rotate_y(35 * degree)`.
- After each draw print, for example, `blue cube: 24 vertices shaded, 12 triangles, 6 culled, 3001 fragments shaded`.

A lambda `draw_cube(model, colour)` that builds the shaders and calls `draw_indexed` keeps `main` short.

**Predict:** the blue cube is nearer but drawn first. What stops the orange cube painting over it, and what does that do to the orange cube's fragment count?

```text
cmake --build raster/build
./raster/build/scene
```

```cpp file=raster/apps/scene.cpp
// scene.cpp: two cubes through the pipeline, lit per pixel.
#include <filesystem>
#include <iostream>
#include <numbers>
#include <vector>

#include "bmp.h"
#include "camera.h"
#include "image.h"
#include "mat.h"
#include "pipeline.h"
#include "render.h"
#include "vec.h"

// The vertex buffer's layout: what each vertex carries.
struct Vertex {
    Vec3 position;
    Vec3 normal;
};

struct Mesh {
    std::vector<Vertex> vertices;
    std::vector<int> indices;   // the index buffer
};

// A cube from -1 to 1. Each face gets its own 4 vertices, because a
// corner shared by 3 faces needs 3 different normals.
Mesh make_cube()
{
    const Vec3 normals[6] = {{1, 0, 0},  {-1, 0, 0}, {0, 1, 0},
                             {0, -1, 0}, {0, 0, 1},  {0, 0, -1}};
    Mesh mesh;
    for (const Vec3& n : normals) {
        // Two directions across the face, so that u, v, n follow the
        // right-hand rule: corners go anticlockwise seen from outside.
        const Vec3 u = n.y != 0 ? Vec3{0, 0, 1} : Vec3{0, 1, 0};
        const Vec3 v = cross(n, u);
        const int first = static_cast<int>(mesh.vertices.size());
        mesh.vertices.push_back({n - u - v, n});
        mesh.vertices.push_back({n + u - v, n});
        mesh.vertices.push_back({n + u + v, n});
        mesh.vertices.push_back({n - u + v, n});
        for (int i : {0, 1, 2, 0, 2, 3})
            mesh.indices.push_back(first + i);
    }
    return mesh;
}

void report(const char* name, const DrawStats& s)
{
    std::cout << name << ": " << s.vertices_shaded << " vertices shaded, "
              << s.triangles << " triangles, " << s.culled
              << " culled, " << s.fragments_shaded
              << " fragments shaded\n";
}

int main()
{
    const double degree = std::numbers::pi / 180;
    Framebuffer fb(240, 180, Color{30, 30, 40});
    const Mesh cube = make_cube();

    // Uniforms: the same for every vertex and fragment of a draw.
    const Mat4 view = look_at({0, 2, 7}, {0, 0, 0}, {0, 1, 0});
    const Mat4 projection =
        perspective(50 * degree, 240.0 / 180.0, 0.1, 100);
    const Vec3 to_light = normalize(Vec3{-1, 2, 2});

    auto draw_cube = [&](const Mat4& model, Color base) {
        const Mat4 mvp = projection * view * model;
        auto vertex_shader = [&](const Vertex& v) {
            const Vec3 p = v.position;
            // The normal turns with the model. (These models only
            // rotate, move and scale evenly, and the fragment shader
            // normalizes, so the model matrix itself works.)
            return VertexOut{mvp * Vec4{p.x, p.y, p.z, 1},
                             transform_vector(model, v.normal)};
        };
        auto fragment_shader = [&](const Fragment& f) {
            const Vec3 n = normalize(f.varying);
            return shade(base, 0.15 + 0.85 * lambert(n, to_light));
        };
        return draw_indexed(fb, PipelineState{}, cube.vertices,
                            cube.indices, vertex_shader,
                            fragment_shader);
    };

    // The blue cube is in front, but drawn FIRST: only the depth
    // test keeps the orange cube from painting over it.
    report("blue cube",
           draw_cube(translate(Vec3{0.9, -0.4, 1.2}) *
                         rotate_y(-20 * degree) * rotate_x(15 * degree) *
                         scale(Vec3{0.7, 0.7, 0.7}),
                     Color{60, 120, 230}));
    report("orange cube",
           draw_cube(translate(Vec3{-0.9, 0, -0.5}) * rotate_y(35 * degree),
                     Color{240, 140, 40}));

    std::filesystem::create_directories("images");
    write_bmp(fb.color, "images/scene.bmp");
    std::cout << "wrote images/scene.bmp\n";
}
```

### What happened

The depth test, with early-z: where the blue cube is in front, the orange cube's fragments fail the depth test **before** its fragment shader runs, so they're never shaded or counted. Draw opaque objects roughly near to far and the GPU skips most hidden work. That's why engines sort them that way, even with a depth buffer.

### Your pipeline, in OpenGL and Vulkan terms

| In `raster/` | OpenGL | Vulkan |
|---|---|---|
| `std::vector<Vertex>` | vertex buffer object (VBO), described by a vertex array object (VAO) | `VkBuffer` + vertex input description |
| `std::vector<int>` indices | element buffer (`GL_ELEMENT_ARRAY_BUFFER`) | index buffer |
| `struct Vertex`'s members | vertex attributes (`glVertexAttribPointer`) | vertex attribute descriptions |
| captured `mvp`, `to_light` | uniforms (`glUniformMatrix4fv`), uniform buffers | uniform buffer + descriptor set, or push constants |
| `vertex_shader` lambda | vertex shader in GLSL; writes `gl_Position` | vertex shader in GLSL or HLSL, compiled to SPIR-V |
| `VertexOut::varying` | an `out` variable in the vertex shader, `in` in the fragment shader | the same, with `layout(location = N)` |
| `fragment_shader` lambda | fragment shader; writes an `out vec4` colour | fragment shader |
| clipping, divide, viewport, rasterizer | fixed-function; `glViewport` | fixed-function; viewport state |
| `PipelineState` | global switches: `glEnable(GL_DEPTH_TEST)`, `glEnable(GL_CULL_FACE)` | one immutable **pipeline state object** (`VkPipeline`) |
| `Framebuffer` | the default framebuffer, or a framebuffer object (FBO) | `VkFramebuffer` / render pass attachments |
| `Framebuffer::depth` | the depth buffer | the depth attachment |
| `draw_indexed(...)` | `glDrawElements` | `vkCmdDrawIndexed`, recorded into a command buffer |
| `DrawStats` | pipeline statistics queries | pipeline statistics queries |

The biggest difference is **where the code runs**. A GPU runs your vertex shader on thousands of vertices at once, and your fragment shader on thousands of pixels at once, so shaders can't share variables or depend on each other's order: exactly the shape your lambdas already have. Everything else in the pipeline, from clipping to the depth test, is hardware.

```check
run "cmake --build raster/build"
run "./raster/build/scene" stdout="blue cube: 24 vertices shaded, 12 triangles, 6 culled" -- 24 vertices per cube: 4 for each face, each with the face's normal.
run "./raster/build/scene" stdout="orange cube: 24 vertices shaded, 12 triangles, 6 culled"
run "./raster/build/imgcheck images/scene.bmp 120 105" stdout="pixel (120, 105) = 37 73 141" label="the nearer blue cube is in front of the orange one" -- Draw with the depth test on (PipelineState{}), blue first.
run "./raster/build/imgcheck images/scene.bmp 100 80" stdout="pixel (100, 80) = 108 63 18" label="the orange cube is lit per pixel"
```

## Step 5 — Challenge: a debugging shader

**This step: write `raster/apps/normals.cpp`: the same scene and the same pipeline, with a different fragment shader that shows each pixel's normal as a colour. Save it as `images/normals.bmp`.**

No code this time. Map each axis of the normalised normal from −1..1 to 0..255: x to red, y to green, z to blue. A face pointing at the camera turns bluish, one pointing up greenish, one pointing right pinkish.

This is a real technique: when lighting looks wrong, graphics programmers swap in exactly this shader. A normal pointing the wrong way shows up instantly as the wrong colour.

Nothing outside the fragment shader should need to change. That's the point of the pipeline: the stages stay put, and the programmable ones are just functions you pass in.

```text
cmake --build raster/build
./raster/build/normals
```

More fragment shaders to try, each a few lines: **toon** shading (round the brightness to three levels), a **checkerboard** (from `f.x` and `f.y`), **fog** (blend towards the background colour as `f.depth` approaches 1).

```cpp file=raster/apps/normals.cpp
// normals.cpp: the same scene, with a debugging fragment shader that
// shows each pixel's normal as a colour.
#include <cstdint>
#include <filesystem>
#include <iostream>
#include <numbers>
#include <vector>

#include "bmp.h"
#include "camera.h"
#include "image.h"
#include "mat.h"
#include "pipeline.h"
#include "render.h"
#include "vec.h"

// The vertex buffer's layout: what each vertex carries.
struct Vertex {
    Vec3 position;
    Vec3 normal;
};

struct Mesh {
    std::vector<Vertex> vertices;
    std::vector<int> indices;   // the index buffer
};

// A cube from -1 to 1. Each face gets its own 4 vertices, because a
// corner shared by 3 faces needs 3 different normals.
Mesh make_cube()
{
    const Vec3 normals[6] = {{1, 0, 0},  {-1, 0, 0}, {0, 1, 0},
                             {0, -1, 0}, {0, 0, 1},  {0, 0, -1}};
    Mesh mesh;
    for (const Vec3& n : normals) {
        // Two directions across the face, so that u, v, n follow the
        // right-hand rule: corners go anticlockwise seen from outside.
        const Vec3 u = n.y != 0 ? Vec3{0, 0, 1} : Vec3{0, 1, 0};
        const Vec3 v = cross(n, u);
        const int first = static_cast<int>(mesh.vertices.size());
        mesh.vertices.push_back({n - u - v, n});
        mesh.vertices.push_back({n + u - v, n});
        mesh.vertices.push_back({n + u + v, n});
        mesh.vertices.push_back({n - u + v, n});
        for (int i : {0, 1, 2, 0, 2, 3})
            mesh.indices.push_back(first + i);
    }
    return mesh;
}

void report(const char* name, const DrawStats& s)
{
    std::cout << name << ": " << s.vertices_shaded << " vertices shaded, "
              << s.triangles << " triangles, " << s.culled
              << " culled, " << s.fragments_shaded
              << " fragments shaded\n";
}

int main()
{
    const double degree = std::numbers::pi / 180;
    Framebuffer fb(240, 180, Color{30, 30, 40});
    const Mesh cube = make_cube();

    // Uniforms: the same for every vertex and fragment of a draw.
    const Mat4 view = look_at({0, 2, 7}, {0, 0, 0}, {0, 1, 0});
    const Mat4 projection =
        perspective(50 * degree, 240.0 / 180.0, 0.1, 100);

    auto draw_cube = [&](const Mat4& model, Color) {
        const Mat4 mvp = projection * view * model;
        auto vertex_shader = [&](const Vertex& v) {
            const Vec3 p = v.position;
            // The normal turns with the model. (These models only
            // rotate, move and scale evenly, and the fragment shader
            // normalizes, so the model matrix itself works.)
            return VertexOut{mvp * Vec4{p.x, p.y, p.z, 1},
                             transform_vector(model, v.normal)};
        };
        auto fragment_shader = [](const Fragment& f) {
            // Each axis from -1..1 to 0..255: x is red, y is green,
            // z is blue. A face pointing right is pinkish, one
            // pointing up is greenish, one pointing at you is bluish.
            const Vec3 n = normalize(f.varying);
            auto channel = [](double v) {
                return static_cast<std::uint8_t>((v + 1) / 2 * 255 + 0.5);
            };
            return Color{channel(n.x), channel(n.y), channel(n.z)};
        };
        return draw_indexed(fb, PipelineState{}, cube.vertices,
                            cube.indices, vertex_shader,
                            fragment_shader);
    };

    // The blue cube is in front, but drawn FIRST: only the depth
    // test keeps the orange cube from painting over it.
    report("blue cube",
           draw_cube(translate(Vec3{0.9, -0.4, 1.2}) *
                         rotate_y(-20 * degree) * rotate_x(15 * degree) *
                         scale(Vec3{0.7, 0.7, 0.7}),
                     Color{60, 120, 230}));
    report("orange cube",
           draw_cube(translate(Vec3{-0.9, 0, -0.5}) * rotate_y(35 * degree),
                     Color{240, 140, 40}));

    std::filesystem::create_directories("images");
    write_bmp(fb.color, "images/normals.bmp");
    std::cout << "wrote images/normals.bmp\n";
}
```

### What's next: OpenGL and Vulkan

You've built every stage that a GPU runs for you. To put pixels in a **window** at 60 frames a second, a real program adds three things your renderer didn't need:

- **A window and an event loop.** The operating system owns the screen. A small library such as **GLFW** or **SDL** opens a window, creates a drawing context for it, and reports keys and mouse movement. Each frame you draw into a back buffer and **swap** it to the screen, so viewers never see a half-drawn frame.
- **Loading the API.** OpenGL's functions live in the graphics driver, not in a library you link, and must be looked up at run time. **glad** generates that loading code. Vulkan uses a loader library, often with **volk**.
- **Getting data to the GPU.** Your vectors live in CPU memory. The GPU has its own, so you create buffers, copy vertices and indices into them once, and then each frame issue draws that refer to them. Shaders are separate programs, in GLSL, compiled by the driver (OpenGL) or ahead of time to SPIR-V (Vulkan).

The two APIs differ in how much they decide for you:

| | OpenGL | Vulkan |
|---|---|---|
| state | global switches you flip as you go | everything baked into pipeline objects up front |
| memory | the driver manages it | you allocate it and choose where it lives |
| synchronisation | implicit | explicit: you say when the GPU may read what the CPU wrote |
| a first triangle | about 150 lines | about 1,000 lines |
| what you get | fast to learn | predictable performance, and nothing hidden |

Every table row above is a box in the diagram at the start of this lesson. OpenGL lets you learn them one at a time; Vulkan makes you name all of them before the first pixel. Either way you'll now know what each one is for, because you've written it.

```check
run "cmake --build raster/build"
run "./raster/build/normals" label="normals runs"
run "./raster/build/imgcheck images/normals.bmp" stdout="images/normals.bmp: BMP, 240 x 180" label="images/normals.bmp is a 240 x 180 BMP" -- Save the framebuffer's colour image with write_bmp(fb.color, "images/normals.bmp").
```
