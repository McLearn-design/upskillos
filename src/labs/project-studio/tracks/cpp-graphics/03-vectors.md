---
title: 3 — Vectors: Position, Direction and Light
track: Graphics from First Principles
runtime: cpp
reference: optional
console: true
---

Graphics is geometry: where things are, which way they face, where the light comes from. All of it is written with **vectors**: a few numbers that together mean a position or a direction.

| Operation | Gives | Used for |
|---|---|---|
| `a + b`, `a - b`, `v * s` | a vector | moving, the direction from one point to another, scaling |
| `dot(a, b)` | a number: how much `a` and `b` point the same way | lighting, angles, "is this in front or behind?" |
| `cross(a, b)` | a vector at right angles to both | the direction a surface faces |
| `length(v)`, `normalize(v)` | a number, a vector of length 1 | distances, directions |

You'll write `Vec2` and `Vec3` with operators, as you wrote operators for classes in *Classes and Resource Management*, then use one dot product per pixel to light a sphere.

## Step 1 — The specification

**This step: create the supplied `raster/tests/vec_test.cpp` and read it.**

Most checks use `CHECK_EQ`, because the values are **exact** in floating point: small whole numbers, halves and quarters have exact binary representations, and adding or multiplying them gives exact results.

Others use `CHECK_NEAR(a, b, tolerance)`. `normalize` divides by a square root, and √14 has no exact binary representation, so the result is the nearest `double`, not the true value. Comparing it with `==` would test luck. The last test shows the classic case: `0.1 + 0.2` is `0.30000000000000004`, because neither 0.1 nor 0.2 is exact in binary.

The rule: `CHECK_EQ` when every input and step is exact; `CHECK_NEAR`, with a tolerance much bigger than rounding error and much smaller than a real mistake, when anything isn't.

```cpp file=raster/tests/vec_test.cpp provided
// Provided by the lesson: what Vec2 and Vec3 must do.
#include "studio_test.hpp"

#include "vec.h"

TEST(vectors_add_and_subtract)
{
    const Vec3 a{1, 2, 3};
    const Vec3 b{10, 20, 30};
    CHECK_EQ(a + b, (Vec3{11, 22, 33}));
    CHECK_EQ(b - a, (Vec3{9, 18, 27}));
    CHECK_EQ(-a, (Vec3{-1, -2, -3}));
    CHECK_EQ((Vec2{1, 2} + Vec2{3, 4}), (Vec2{4, 6}));
}

TEST(compound_assignment_changes_the_left_side)
{
    Vec3 v{1, 1, 1};
    v += Vec3{1, 2, 3};
    CHECK_EQ(v, (Vec3{2, 3, 4}));
    v -= Vec3{2, 2, 2};
    CHECK_EQ(v, (Vec3{0, 1, 2}));
    v *= 3;
    CHECK_EQ(v, (Vec3{0, 3, 6}));
}

TEST(scaling_works_on_either_side)
{
    const Vec3 v{1, -2, 4};
    CHECK_EQ(v * 2, (Vec3{2, -4, 8}));
    CHECK_EQ(2 * v, (Vec3{2, -4, 8}));
    CHECK_EQ(v / 2, (Vec3{0.5, -1, 2}));
    CHECK_EQ((Vec2{3, 4} * 2), (Vec2{6, 8}));
}

TEST(dot_product)
{
    CHECK_EQ(dot(Vec3{1, 2, 3}, Vec3{4, 5, 6}), 32.0);
    CHECK_EQ(dot(Vec3{1, 0, 0}, Vec3{0, 1, 0}), 0.0);   // perpendicular
    CHECK_EQ(dot(Vec2{2, 3}, Vec2{4, -1}), 5.0);
}

TEST(cross_product_follows_the_right_hand_rule)
{
    const Vec3 x{1, 0, 0}, y{0, 1, 0}, z{0, 0, 1};
    CHECK_EQ(cross(x, y), z);
    CHECK_EQ(cross(y, z), x);
    CHECK_EQ(cross(y, x), -z);   // swap the order, flip the result
    CHECK_EQ(cross(Vec3{1, 2, 3}, Vec3{4, 5, 6}), (Vec3{-3, 6, -3}));
    CHECK_EQ(cross(Vec2{1, 0}, Vec2{0, 1}), 1.0);
}

TEST(length_and_normalize)
{
    CHECK_EQ(length(Vec3{3, 4, 0}), 5.0);
    CHECK_EQ(length(Vec2{3, 4}), 5.0);
    const Vec3 n = normalize(Vec3{1, 2, 3});
    CHECK_NEAR(length(n), 1.0, 1e-12);
    CHECK_NEAR(n.x * 2, n.y, 1e-12);   // still the same direction
    CHECK_NEAR(n.x * 3, n.z, 1e-12);
}

TEST(normalizing_zero_gives_zero_not_nan)
{
    CHECK_EQ(normalize(Vec3{0, 0, 0}), (Vec3{0, 0, 0}));
}

TEST(floating_point_needs_a_tolerance)
{
    const Vec3 v = Vec3{0.1, 0.2, 0} + Vec3{0.2, 0.1, 0};
    CHECK(v.x != 0.3);              // 0.1 + 0.2 is 0.30000000000000004
    CHECK_NEAR(v.x, 0.3, 1e-12);
}
```

```check
file raster/tests/vec_test.cpp
```

## Step 2 — Vec2 and Vec3

**This step: create `raster/vec.h` with `Vec2`, `Vec3`, their operators, `dot`, `cross`, `length` and `normalize`. Build and run the tests.**

Each vector is a struct of `double`s with default member values, so `Vec3{}` is zero and `Vec3{1, 2, 3}` sets them in order. GPUs use 32-bit `float` for speed; `double` keeps rounding out of your way while you learn.

### Write the compound operators first

As in *Classes and Resource Management*: `+=` changes the object, so it's a member that returns `*this`; `+` makes a new value, so it's a free function **written with `+=`**. Then the two can never disagree:

```cpp
struct Vec3 {
    double x = 0;
    double y = 0;
    double z = 0;

    Vec3& operator+=(Vec3 v)
    {
        x += v.x;
        y += v.y;
        z += v.z;
        return *this;
    }
    bool operator==(const Vec3&) const = default;
};

inline Vec3 operator+(Vec3 a, Vec3 b) { return a += b; }
```

`a` is taken **by value**: it's already a copy, so `a += b` changes the copy and returns it. Vectors of two or three `double`s are cheap to copy; pass them by value everywhere.

You also need `-=`, `*=` (by a number), binary `-`, unary `-`, `v * s` **and** `s * v` (two functions: C++ doesn't assume multiplication commutes), `v / s`, and `operator<<` so failing checks print `(1, 2, 3)`. The same set for `Vec2`.

### The products

```cpp
inline double dot(Vec3 a, Vec3 b)
{
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

inline Vec3 cross(Vec3 a, Vec3 b)
{
    return {a.y * b.z - a.z * b.y,
            a.z * b.x - a.x * b.z,
            a.x * b.y - a.y * b.x};
}
```

- The 2D `cross(Vec2 a, Vec2 b)` returns a **number**, `a.x * b.y - a.y * b.x`: the z of the 3D cross product of `(a, 0)` and `(b, 0)`. It's positive when `b` is anticlockwise from `a`. Lesson 4 decides whether a pixel is inside a triangle with it.
- `length(v)` is `std::sqrt(dot(v, v))`: Pythagoras.
- `normalize(v)` divides by the length. The zero vector has no length to divide by, and `0.0 / 0.0` is **NaN**, "not a number", which poisons every calculation it touches. Return the zero vector unchanged instead.

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/vec.h
// vec.h: 2D and 3D vectors, with the operators maths writes them with.
#pragma once

#include <cmath>
#include <ostream>

struct Vec2 {
    double x = 0;
    double y = 0;

    Vec2& operator+=(Vec2 v) { x += v.x; y += v.y; return *this; }
    Vec2& operator-=(Vec2 v) { x -= v.x; y -= v.y; return *this; }
    Vec2& operator*=(double s) { x *= s; y *= s; return *this; }
    bool operator==(const Vec2&) const = default;
};

struct Vec3 {
    double x = 0;
    double y = 0;
    double z = 0;

    Vec3& operator+=(Vec3 v) { x += v.x; y += v.y; z += v.z; return *this; }
    Vec3& operator-=(Vec3 v) { x -= v.x; y -= v.y; z -= v.z; return *this; }
    Vec3& operator*=(double s) { x *= s; y *= s; z *= s; return *this; }
    bool operator==(const Vec3&) const = default;
};

// The binary operators are free functions written with the compound
// ones, so a + b and a += b can never disagree.
inline Vec2 operator+(Vec2 a, Vec2 b) { return a += b; }
inline Vec2 operator-(Vec2 a, Vec2 b) { return a -= b; }
inline Vec2 operator-(Vec2 v) { return {-v.x, -v.y}; }
inline Vec2 operator*(Vec2 v, double s) { return v *= s; }
inline Vec2 operator*(double s, Vec2 v) { return v *= s; }
inline Vec2 operator/(Vec2 v, double s) { return v *= 1.0 / s; }

inline Vec3 operator+(Vec3 a, Vec3 b) { return a += b; }
inline Vec3 operator-(Vec3 a, Vec3 b) { return a -= b; }
inline Vec3 operator-(Vec3 v) { return {-v.x, -v.y, -v.z}; }
inline Vec3 operator*(Vec3 v, double s) { return v *= s; }
inline Vec3 operator*(double s, Vec3 v) { return v *= s; }
inline Vec3 operator/(Vec3 v, double s) { return v *= 1.0 / s; }

inline std::ostream& operator<<(std::ostream& out, Vec2 v)
{
    return out << '(' << v.x << ", " << v.y << ')';
}

inline std::ostream& operator<<(std::ostream& out, Vec3 v)
{
    return out << '(' << v.x << ", " << v.y << ", " << v.z << ')';
}

inline double dot(Vec2 a, Vec2 b) { return a.x * b.x + a.y * b.y; }

inline double dot(Vec3 a, Vec3 b)
{
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

// A vector perpendicular to both a and b (right-hand rule).
inline Vec3 cross(Vec3 a, Vec3 b)
{
    return {a.y * b.z - a.z * b.y,
            a.z * b.x - a.x * b.z,
            a.x * b.y - a.y * b.x};
}

// The 2D cross product is a number: the z of the 3D one.
// Positive when b is anticlockwise from a (with y up).
inline double cross(Vec2 a, Vec2 b) { return a.x * b.y - a.y * b.x; }

inline double length(Vec2 v) { return std::sqrt(dot(v, v)); }
inline double length(Vec3 v) { return std::sqrt(dot(v, v)); }

// The same direction, length 1. The zero vector has no direction:
// it stays zero rather than becoming NaN (0 / 0).
inline Vec3 normalize(Vec3 v)
{
    const double len = length(v);
    return len == 0 ? v : v / len;
}

inline Vec2 normalize(Vec2 v)
{
    const double len = length(v);
    return len == 0 ? v : v / len;
}
```

```check
run "cmake --build raster/build"
tests "./raster/build/raster_tests" require="vectors_add_and_subtract scaling_works_on_either_side cross_product_follows_the_right_hand_rule normalizing_zero_gives_zero_not_nan" -- cross(x, y) must be z; normalize must return the zero vector unchanged.
```

## Step 3 — What dot and cross mean: your tests

**This step: create `raster/tests/vec_own_test.cpp` with at least three tests of your own. One must use `cross`, and one must use `CHECK_NEAR`.**

The two products have geometric meanings worth pinning down in tests:

```text
dot(a, b) = |a| |b| cos(angle between them)

  same way      at right angles     opposite
  ──► ──►          ──►               ──►  ◄──
  dot > 0        ▲  dot = 0          dot < 0
                 │
```

- With two vectors of length 1, `dot` **is** the cosine of the angle: 1 when they point the same way, 0 at right angles, -1 when opposite. That's why lighting uses it.
- `dot(v, v)` is the length squared.
- `cross(a, b)` is at right angles to both `a` and `b`, so its dot with either is 0. Its length is the area of the parallelogram they span, and its direction follows the **right-hand rule**: fingers along `a`, curl them towards `b`, and your thumb points along the cross product.

**Predict** before you write each test: which `CHECK_EQ`s are exact, and which need `CHECK_NEAR`?

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/tests/vec_own_test.cpp
// My tests for vec.h.
#include "studio_test.hpp"

#include "vec.h"

TEST(dot_of_a_vector_with_itself_is_its_length_squared)
{
    const Vec3 v{2, 3, 6};
    CHECK_EQ(dot(v, v), 49.0);
    CHECK_EQ(length(v), 7.0);
}

TEST(cross_is_perpendicular_to_both_inputs)
{
    const Vec3 a{1, 2, 3};
    const Vec3 b{-2, 0, 5};
    const Vec3 c = cross(a, b);
    CHECK_EQ(dot(c, a), 0.0);
    CHECK_EQ(dot(c, b), 0.0);
}

TEST(dot_of_unit_vectors_is_the_cosine_of_their_angle)
{
    const Vec3 a = normalize(Vec3{1, 0, 0});
    const Vec3 b = normalize(Vec3{1, 1, 0});   // 45 degrees away
    CHECK_NEAR(dot(a, b), std::sqrt(0.5), 1e-12);
}
```

```check
matches raster/tests/vec_own_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="vec_own_test.cpp has at least three tests"
matches raster/tests/vec_own_test.cpp "\bcross\s*\(" label="a test uses cross"
matches raster/tests/vec_own_test.cpp "CHECK_NEAR\s*\(" label="a test uses CHECK_NEAR"
run "cmake --build raster/build"
tests "./raster/build/raster_tests"
```

## Step 4 — Light a sphere with one dot product

**This step: create `raster/apps/sphere.cpp`. It draws a 64 × 64 image of a sphere lit from the upper left, and saves `images/sphere.bmp`. Build it, run it, and look at it.**

No triangles yet: for each pixel, work out whether it's on the sphere, which way the surface faces there, and how much light that face catches.

### The surface's direction

The sphere has radius 28 pixels and its centre is at (32, 32). For each pixel, take its **centre** `(x + 0.5, y + 0.5)`, measure from the sphere's centre, divide by the radius, and **flip y** so it points up, as maths expects:

```cpp
const Vec2 p{(x + 0.5 - centre.x) / radius,
             (centre.y - (y + 0.5)) / radius};
```

If `dot(p, p) > 1` the pixel is outside the circle: leave it black. Otherwise, on a sphere of radius 1 the **normal**, the direction the surface faces, is the point itself. You have its x and y, and its length must be 1, so `z = std::sqrt(1 - dot(p, p))`, pointing towards you.

### Lambert's law

A surface facing the light straight on catches all of it. Tilt it, and the same light spreads over more area, so each bit gets less: `cos(angle)` of it. Both vectors have length 1, so that cosine is one dot product:

```cpp
const Vec3 to_light = normalize(Vec3{-1, 1, 1});   // left, up, out
const double lambert = std::max(0.0, dot(normal, to_light));
const double light = 0.2 + 0.8 * lambert;
```

- `std::max(0.0, ...)`: a surface facing away gets no light, not negative light.
- The `0.2` is **ambient** light: a cheap stand-in for light bouncing around the room, so the dark side isn't pure black.

Colour each pixel orange scaled by `light`: red `light`, green `light * 0.6`, blue `light * 0.2`, each turned into a byte with this helper:

```cpp
// 0.0 to 1.0 becomes 0 to 255, rounded to the nearest.
std::uint8_t to_byte(double v)
{
    v = std::clamp(v, 0.0, 1.0);
    return static_cast<std::uint8_t>(v * 255 + 0.5);
}
```

Converting a `double` to an integer type **truncates**; adding 0.5 first rounds to the nearest instead.

```text
cmake --build raster/build
./raster/build/sphere
```

```cpp file=raster/apps/sphere.cpp
// sphere.cpp: a lit sphere, shaded with one dot product per pixel.
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <filesystem>
#include <iostream>

#include "bmp.h"
#include "image.h"
#include "vec.h"

// 0.0 to 1.0 becomes 0 to 255, rounded to the nearest.
std::uint8_t to_byte(double v)
{
    v = std::clamp(v, 0.0, 1.0);
    return static_cast<std::uint8_t>(v * 255 + 0.5);
}

int main()
{
    const int size = 64;
    const double radius = 28;
    const Vec2 centre{32, 32};
    // Towards the light: up, left, and towards the viewer.
    const Vec3 to_light = normalize(Vec3{-1, 1, 1});

    Image img(size, size);
    for (int y = 0; y < size; ++y) {
        for (int x = 0; x < size; ++x) {
            // The middle of the pixel, relative to the centre, in
            // radii, with y flipped to point up.
            const Vec2 p{(x + 0.5 - centre.x) / radius,
                         (centre.y - (y + 0.5)) / radius};
            const double d2 = dot(p, p);
            if (d2 > 1)
                continue;   // outside the sphere: leave it black
            // On a sphere the normal is the point itself:
            // x and y from the pixel, z so that its length is 1.
            const Vec3 normal{p.x, p.y, std::sqrt(1 - d2)};
            const double lambert = std::max(0.0, dot(normal, to_light));
            const double light = 0.2 + 0.8 * lambert;
            img.set(x, y, Color{to_byte(light), to_byte(light * 0.6),
                                to_byte(light * 0.2)});
        }
    }
    std::filesystem::create_directories("images");
    write_bmp(img, "images/sphere.bmp");
    std::cout << "wrote images/sphere.bmp\n";
}
```

### What happened

Open `images/sphere.bmp`: a flat disc has become a ball, by shading alone. Real-time graphics does exactly this, with the normal coming from a triangle mesh instead of a formula. You'll meet Lambert's law again in lesson 7.

```check
run "cmake --build raster/build"
run "./raster/build/sphere" stdout="wrote images/sphere.bmp"
run "./raster/build/imgcheck images/sphere.bmp 0 0" stdout="pixel (0, 0) = 0 0 0" label="the corner, outside the sphere, is black"
run "./raster/build/imgcheck images/sphere.bmp 20 20" stdout="pixel (20, 20) = 244 146 49" label="the upper left, facing the light, is bright" -- Flip y so it points up, and light from normalize(Vec3{-1, 1, 1}).
run "./raster/build/imgcheck images/sphere.bmp 45 45" stdout="pixel (45, 45) = 51 31 10" label="the lower right, facing away, has only ambient light"
```
