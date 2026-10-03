---
title: 1 — Pixels: an Image in Memory and on Disk
track: Graphics from First Principles
trackOrder: 13
runtime: cpp
reference: optional
console: true
---

Every picture on a screen is a grid of coloured dots: **pixels**. A graphics card's whole job is to decide what colour each one should be, millions of times a second. It does that with a fixed sequence of stages called the **graphics pipeline**: vertices go in, get transformed, are assembled into triangles, turned into pixels, and shaded.

You'll build that pipeline yourself, in plain C++, on the CPU. There's no window and no graphics library: your programs write **image files**, and every stage that a GPU hides is code you wrote and can test.

| Lesson | You build |
|---|---|
| 1 | an `Image` in memory, saved as a text PPM file |
| 2 | binary files: PPM and BMP, and a bug that only shows at some widths |
| 3 | vectors: dot and cross products, and a lit sphere |
| 4 | rasterizing lines and triangles, pixel-exact |
| 5 | matrices: translate, rotate, scale, and why order matters |
| 6 | 3D: camera, perspective, and a wireframe cube |
| 7 | the depth buffer and lighting: a solid cube |
| 8 | the pipeline as stages, with vertex and fragment "shaders" |

Choose a **new empty folder** for this track, and run every command from that folder. It will hold:

| Folder | What |
|---|---|
| `testing/` | the test framework |
| `raster/` | the CMake project: the renderer (header files), `apps/` (programs) and `tests/` |
| `images/` | the pictures your programs write |

### Looking at your images

Project Studio's editor opens every file as text, so it can't show a picture. Open the `images/` folder in your file manager and double-click a file:

- **BMP** files (from lesson 2) open everywhere: Windows Photos, macOS Preview, Linux image viewers, and any web browser (drag the file into a tab).
- **PPM** files open in macOS Preview, GIMP, IrfanView and most Linux viewers, but not in Windows Photos. This lesson's tiny PPM is text, so you'll read it in the editor instead.

The checks never look at a picture. They read pixel values and file sizes, exactly.

## Step 1 — The test framework

**This step: create the supplied `testing/studio_test.hpp`.**

The renderer is tested from the first lesson, so the track needs the test framework.

It's the same small framework as in *C++ Foundations*: `TEST(name)`, `CHECK`, `CHECK_EQ`, `CHECK_NEAR` and `CHECK_THROWS`, with GoogleTest-style output. Each track's project folder has its own copy.

```cpp file=testing/studio_test.hpp provided
// studio_test.hpp — a deliberately tiny unit-test framework.
//
// It is small enough to read in one sitting (do!), and it prints results in the
// same format as GoogleTest, which you will switch to in a later track.
//
//   TEST(adds_two_numbers) {
//       CHECK_EQ(add(2, 3), 5);
//   }
//
// Macros: CHECK(cond), CHECK_EQ(a, b), CHECK_NE(a, b), CHECK_NEAR(a, b, tolerance),
//         CHECK_THROWS(expression, ExceptionType)
#pragma once

#include <cmath>
#include <exception>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

namespace studio_test {

struct TestCase {
    const char* name;
    void (*body)();
};

// A function-local static is created the first time it is used, which makes it
// safe to register tests from static objects in any translation unit.
inline std::vector<TestCase>& registry()
{
    static std::vector<TestCase> tests;
    return tests;
}

struct Registrar {
    Registrar(const char* name, void (*body)()) { registry().push_back({name, body}); }
};

// Thrown by a failing CHECK; caught by run_all().
struct Failure {
    std::string message;
};

template <typename T>
std::string show(const T& value)
{
    std::ostringstream out;
    out << value;
    return out.str();
}

inline std::string location(const char* file, int line)
{
    return std::string(file) + ":" + std::to_string(line) + ": ";
}

inline int run_all()
{
    auto& tests = registry();
    int failed = 0;
    std::cout << "[==========] Running " << tests.size() << " tests\n";
    for (const auto& test : tests) {
        // std::endl flushes: if this test crashes the program, the output
        // still shows which test was running.
        std::cout << "[ RUN      ] " << test.name << std::endl;
        try {
            test.body();
            std::cout << "[       OK ] " << test.name << '\n';
        } catch (const Failure& f) {
            ++failed;
            std::cout << f.message << '\n' << "[  FAILED  ] " << test.name << '\n';
        } catch (const std::exception& e) {
            ++failed;
            std::cout << "unexpected exception: " << e.what() << '\n' << "[  FAILED  ] " << test.name << '\n';
        } catch (...) {
            ++failed;
            std::cout << "unexpected non-standard exception\n" << "[  FAILED  ] " << test.name << '\n';
        }
    }
    std::cout << "[==========] " << tests.size() << " tests ran, " << (tests.size() - failed) << " passed, " << failed
              << " failed\n";
    return failed == 0 ? 0 : 1;
}

} // namespace studio_test

#define STUDIO_TEST_CONCAT2(a, b) a##b
#define STUDIO_TEST_CONCAT(a, b) STUDIO_TEST_CONCAT2(a, b)

#define TEST(name)                                                                                                   \
    static void STUDIO_TEST_CONCAT(name, _body)();                                                                   \
    static const studio_test::Registrar STUDIO_TEST_CONCAT(name, _registrar)(#name, &STUDIO_TEST_CONCAT(name, _body)); \
    static void STUDIO_TEST_CONCAT(name, _body)()

#define CHECK(cond)                                                                                     \
    do {                                                                                                \
        if (!(cond))                                                                                    \
            throw studio_test::Failure{studio_test::location(__FILE__, __LINE__) + "CHECK(" #cond ") failed"}; \
    } while (false)

#define STUDIO_TEST_BINARY(a, b, op, name)                                                                     \
    do {                                                                                                     \
        const auto& studio_left = (a);                                                                       \
        const auto& studio_right = (b);                                                                      \
        if (!(studio_left op studio_right))                                                                  \
            throw studio_test::Failure{studio_test::location(__FILE__, __LINE__) + name "(" #a ", " #b ") failed\n" \
                                       "    left:  " + studio_test::show(studio_left) + "\n"                \
                                       "    right: " + studio_test::show(studio_right)};                    \
    } while (false)

#define CHECK_EQ(a, b) STUDIO_TEST_BINARY(a, b, ==, "CHECK_EQ")
#define CHECK_NE(a, b) STUDIO_TEST_BINARY(a, b, !=, "CHECK_NE")

#define CHECK_NEAR(a, b, tolerance)                                                                              \
    do {                                                                                                       \
        const double studio_left = (a);                                                                        \
        const double studio_right = (b);                                                                       \
        if (!(std::fabs(studio_left - studio_right) <= (tolerance)))                                           \
            throw studio_test::Failure{studio_test::location(__FILE__, __LINE__) + "CHECK_NEAR(" #a ", " #b ") failed\n" \
                                       "    left:  " + studio_test::show(studio_left) + "\n"                  \
                                       "    right: " + studio_test::show(studio_right)};                      \
    } while (false)

#define CHECK_THROWS(expression, ExceptionType)                                                                 \
    do {                                                                                                      \
        bool studio_threw = false;                                                                            \
        try {                                                                                                 \
            (void)(expression);                                                                               \
        } catch (const ExceptionType&) {                                                                      \
            studio_threw = true;                                                                              \
        }                                                                                                     \
        if (!studio_threw)                                                                                    \
            throw studio_test::Failure{studio_test::location(__FILE__, __LINE__) + "CHECK_THROWS(" #expression \
                                       ", " #ExceptionType ") failed: nothing was thrown"};                   \
    } while (false)
```

```check
file testing/studio_test.hpp
```

## Step 2 — The test runner

**This step: create the supplied `testing/test_main.cpp`.**

The test program's `main`: it runs every registered test and exits with `0` only if all of them passed.

```cpp file=testing/test_main.cpp provided
// The test program's entry point. Every TEST(...) in the other test files has
// already registered itself by the time main() runs.
#include "studio_test.hpp"

int main()
{
    return studio_test::run_all();
}
```

```check
file testing/test_main.cpp
```

## Step 3 — The project's build file

**This step: create the supplied `raster/CMakeLists.txt` and read it.**

The renderer is **header-only**: every function is `inline` in a `.h` file, so there is no library to compile and link. Each program includes what it needs.

- **Every `apps/NAME.cpp` becomes a program called `NAME`.** `file(GLOB ... CONFIGURE_DEPENDS)` lists the files, and the `foreach` loop adds one executable for each. Add a new `.cpp` to `apps/` and the next `cmake --build` notices it and builds it: no editing this file.
- Every `tests/*_test.cpp` becomes part of one test program, `raster_tests`, as in earlier tracks.

### Why the floating-point flags

The checks in this track compare **exact** pixels. A pixel is drawn when its centre is inside a shape, and that's decided by floating-point arithmetic. So every compiler must do that arithmetic the same way.

| Flag | What it would do | Here |
|---|---|---|
| `-ffast-math` | lets the compiler reorder and simplify floating-point maths | never used |
| `-ffp-contract=off` | forbids fusing `a * b + c` into one **FMA** instruction, which rounds once instead of twice | on |

An FMA is faster and slightly more precise, and some compilers use it by default on some CPUs (Apple's, for one). Then `a * b + c` can differ in the last bit between your machine and someone else's, and a pixel that sits exactly on an edge can flip. Turning contraction off makes the results the same everywhere that follows the IEEE 754 standard, which is everywhere you'll build this.

The build is **Release**, optimised, as rendering is slow without it.

```cmake file=raster/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(raster LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Optimised, but never with -ffast-math: that lets the compiler reorder
# floating-point maths, which changes which pixels get drawn.
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

if(MSVC)
    add_compile_options(/W4)
else()
    # -ffp-contract=off: no fused multiply-add, so every compiler and
    # CPU rounds a * b + c the same way, and draws the same pixels.
    add_compile_options(-Wall -Wextra -Wpedantic -ffp-contract=off)
endif()

# The library is header-only: these folders are searched for #include.
include_directories(. ../testing)

# Every apps/NAME.cpp becomes a program called NAME.
file(GLOB APP_SOURCES CONFIGURE_DEPENDS apps/*.cpp)
foreach(source ${APP_SOURCES})
    get_filename_component(name ${source} NAME_WE)
    add_executable(${name} ${source})
endforeach()

# Every tests/*_test.cpp file becomes part of the test program.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(raster_tests ../testing/test_main.cpp ${TEST_SOURCES})
```

```check
file raster/CMakeLists.txt
```

## Step 4 — The specification

**This step: create the supplied `raster/tests/image_test.cpp` and read it.**

An `Image` is a width, a height, and one `Color` per pixel. A `Color` is three bytes: red, green and blue, each from 0 (none) to 255 (full). Mixing them makes every other colour: `{255, 255, 0}` is yellow, `{128, 128, 128}` is grey.

The coordinates are the ones every image format and graphics API uses for pixels:

```text
(0,0) ──► x
  │   ┌───┬───┬───┬───┐
  ▼   │0,0│1,0│2,0│3,0│
  y   ├───┼───┼───┼───┤
      │0,1│1,1│2,1│3,1│
      ├───┼───┼───┼───┤
      │0,2│1,2│2,2│3,2│
      └───┴───┴───┴───┘
```

**y grows downwards**, because screens and files go top row first. Maths uses y up; you'll flip between the two in later lessons.

Two design decisions are written into the tests:

- **`set` outside the image does nothing.** Shapes are often partly off-screen; skipping the pixels that don't exist is called **clipping**, and it saves every drawing function from checking.
- **`get` outside the image throws `std::out_of_range`.** Reading a pixel that doesn't exist is always a bug in the caller, so it should be loud.

```cpp file=raster/tests/image_test.cpp provided
// Provided by the lesson: what Image must do.
#include "studio_test.hpp"

#include <stdexcept>

#include "image.h"

TEST(new_image_has_its_size_and_fill)
{
    Image img(4, 3, colors::blue);
    CHECK_EQ(img.width(), 4);
    CHECK_EQ(img.height(), 3);
    CHECK_EQ(img.pixels().size(), 12u);
    CHECK_EQ(img.get(0, 0), colors::blue);
    CHECK_EQ(img.get(3, 2), colors::blue);
}

TEST(the_default_fill_is_black)
{
    Image img(2, 2);
    CHECK_EQ(img.count(colors::black), 4);
}

TEST(set_then_get)
{
    Image img(4, 3);
    img.set(1, 2, colors::red);
    CHECK_EQ(img.get(1, 2), colors::red);
    CHECK_EQ(img.get(2, 1), colors::black);
    CHECK_EQ(img.count(colors::red), 1);
}

TEST(pixels_are_stored_row_by_row)
{
    Image img(4, 3);
    img.set(1, 2, colors::red);   // row 2, column 1
    CHECK_EQ(img.pixels()[2 * 4 + 1], colors::red);
}

TEST(drawing_outside_is_ignored)
{
    Image img(4, 3);
    img.set(-1, 0, colors::red);
    img.set(4, 0, colors::red);
    img.set(0, -1, colors::red);
    img.set(0, 3, colors::red);
    CHECK_EQ(img.count(colors::red), 0);
}

TEST(reading_outside_throws)
{
    Image img(4, 3);
    CHECK_THROWS(img.get(4, 0), std::out_of_range);
    CHECK_THROWS(img.get(0, 3), std::out_of_range);
    CHECK_THROWS(img.get(-1, 0), std::out_of_range);
}

TEST(an_empty_image_is_an_error)
{
    CHECK_THROWS(Image(0, 3), std::invalid_argument);
    CHECK_THROWS(Image(4, -1), std::invalid_argument);
}
```

```check
file raster/tests/image_test.cpp
```

## Step 5 — The Image class

**This step: create `raster/image.h` with `Color`, the `colors` constants and `Image`. Then configure, build and run the tests.**

### One vector, row by row

The pixels live in **one** `std::vector<Color>`, top row first:

```text
       x=0  x=1  x=2  x=3
y=0  [  0 ][  1 ][  2 ][  3 ]
y=1  [  4 ][  5 ][  6 ][  7 ]
y=2  [  8 ][  9 ][ 10 ][ 11 ]

index = y * width + x
```

Why not a `std::vector<std::vector<Color>>`? That's one heap allocation per row, scattered through memory. One vector is one allocation, rows end to end, which is faster to walk and is exactly the layout image files and GPUs use, so writing a file becomes one loop.

```cpp
std::size_t index(int x, int y) const
{
    return static_cast<std::size_t>(y) * width_ + x;
}
```

The cast makes the multiplication happen in `std::size_t`: `y * width_` in `int` overflows for a very large image.

### The pieces

- `Color` has three `std::uint8_t` members (from `<cstdint>`: exactly 8 bits, 0 to 255) and `bool operator==(const Color&) const = default;`. A defaulted `==` (C++20) compares member by member, as in *Classes*.
- `operator<<` prints `(255, 0, 0)`, so a failing `CHECK_EQ` can show the colours. A `std::uint8_t` is a kind of `char`, and `<<` would print the byte as a character, so write `+c.r`: unary `+` promotes it to `int`.
- `namespace colors` holds `inline constexpr Color` constants: `black`, `white`, `red`, `green`, `blue`. `inline` lets a header define a variable that many `.cpp` files include.
- The constructor throws `std::invalid_argument` unless both sizes are at least 1, then fills the vector with `pixels_.assign(count, fill)`. The fill defaults to black.
- `contains(x, y)`, `get`, `set`, `count(c)` (how many pixels are exactly `c`), and `pixels()` returning a `const` reference to the vector.

```text
cmake -S raster -B raster/build -G "MinGW Makefiles"     (Windows)
cmake -S raster -B raster/build                          (macOS, Linux)
```

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/image.h
// image.h: an image in memory, as a grid of RGB pixels.
#pragma once

#include <cstddef>
#include <cstdint>
#include <ostream>
#include <stdexcept>
#include <vector>

// One pixel: red, green and blue, each 0 to 255.
struct Color {
    std::uint8_t r = 0;
    std::uint8_t g = 0;
    std::uint8_t b = 0;

    bool operator==(const Color&) const = default;
};

// Prints (255, 0, 0). The + turns each uint8_t into an int:
// without it, << would print the byte as a character.
inline std::ostream& operator<<(std::ostream& out, Color c)
{
    return out << '(' << +c.r << ", " << +c.g << ", " << +c.b << ')';
}

namespace colors {
inline constexpr Color black{0, 0, 0};
inline constexpr Color white{255, 255, 255};
inline constexpr Color red{255, 0, 0};
inline constexpr Color green{0, 255, 0};
inline constexpr Color blue{0, 0, 255};
}

// (0, 0) is the top-left pixel; x grows to the right, y grows DOWN.
class Image {
public:
    Image(int width, int height, Color fill = colors::black)
        : width_(width), height_(height)
    {
        if (width < 1 || height < 1)
            throw std::invalid_argument("an image needs at least 1 x 1");
        pixels_.assign(static_cast<std::size_t>(width) * height, fill);
    }

    int width() const { return width_; }
    int height() const { return height_; }

    bool contains(int x, int y) const
    {
        return x >= 0 && x < width_ && y >= 0 && y < height_;
    }

    // Reading outside the image is a bug in the caller: throw.
    Color get(int x, int y) const
    {
        if (!contains(x, y))
            throw std::out_of_range("pixel outside the image");
        return pixels_[index(x, y)];
    }

    // Drawing outside the image is normal (a shape that is partly
    // off-screen), so those pixels are skipped: clipping.
    void set(int x, int y, Color c)
    {
        if (contains(x, y))
            pixels_[index(x, y)] = c;
    }

    // How many pixels have exactly this colour.
    int count(Color c) const
    {
        int n = 0;
        for (Color p : pixels_)
            if (p == c)
                ++n;
        return n;
    }

    // Row by row, top row first: pixel (x, y) is at y * width + x.
    const std::vector<Color>& pixels() const { return pixels_; }

private:
    std::size_t index(int x, int y) const
    {
        return static_cast<std::size_t>(y) * width_ + x;
    }

    int width_;
    int height_;
    std::vector<Color> pixels_;
};
```

```check
file raster/build/CMakeCache.txt label="raster/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build raster/build"
tests "./raster/build/raster_tests" require="new_image_has_its_size_and_fill pixels_are_stored_row_by_row drawing_outside_is_ignored reading_outside_throws an_empty_image_is_an_error" -- Store pixel (x, y) at index y * width + x, and make get() throw std::out_of_range outside the image.
```

## Step 6 — A program that needs a file format

**This step: create the supplied `raster/apps/tiny.cpp` and read it. It won't build until the next step.**

It makes a 4 × 3 white image with a coloured pixel in three corners and black in the fourth, and saves it with `write_ppm_text`, which you'll write next.

`std::filesystem::create_directories("images")` makes the `images/` folder if it isn't there yet. The path is relative, so it's inside the folder you run the program from: always the track folder.

**Predict:** you'll open the file as text. Which corner's numbers come first?

```cpp file=raster/apps/tiny.cpp provided
// tiny.cpp: a 4 x 3 image small enough to read as text.
#include <filesystem>
#include <iostream>

#include "image.h"
#include "ppm.h"

int main()
{
    Image img(4, 3, colors::white);
    img.set(0, 0, colors::red);     // top-left
    img.set(3, 0, colors::green);   // top-right
    img.set(0, 2, colors::blue);    // bottom-left
    img.set(3, 2, colors::black);   // bottom-right

    std::filesystem::create_directories("images");
    write_ppm_text(img, "images/tiny.ppm");
    std::cout << "wrote images/tiny.ppm\n";
}
```

```check
file raster/apps/tiny.cpp
```

## Step 7 — PPM: the simplest image file

**This step: create `raster/ppm.h` with `write_ppm_text`. Build, run `tiny`, and open `images/tiny.ppm` in the editor.**

An image file is the pixel grid plus enough information to rebuild it: at least its width and height. **PPM** (portable pixmap) is about the simplest format there is. Its text version, called **P3**, is a three-line header and then every pixel as three numbers:

```text
P3          ← the format: a text pixmap
4 3         ← width, then height
255         ← the largest value a channel can have
255 0 0 255 255 255 255 255 255 0 255 0     ← row 0
...
```

Write exactly this layout: one image row per line, numbers separated by single spaces, a newline after every row.

```cpp
inline void write_ppm_text(const Image& img,
                           const std::filesystem::path& path)
{
    std::ofstream out(path);
    if (!out)
        throw std::runtime_error("can't write " + path.string());
    out << "P3\n" << img.width() << ' ' << img.height() << "\n255\n";
    // then every row, top to bottom
}
```

- Inside the rows, use `+c.r` again, or the bytes go out as characters.
- If the file can't be opened (a missing folder, no permission), throw: a function that silently writes nothing is much harder to debug.
- `inline` matters here: `ppm.h` will be included by many programs, and the tests, which are several `.cpp` files linked together. Without `inline`, each would define its own `write_ppm_text` and the linker would reject the duplicates.

```text
cmake --build raster/build
./raster/build/tiny
```

```cpp file=raster/ppm.h
// ppm.h: writes an Image as a PPM file.
#pragma once

#include <filesystem>
#include <fstream>
#include <stdexcept>

#include "image.h"

// P3, the text version: a short header, then every pixel as three
// numbers. One image row per line of text.
inline void write_ppm_text(const Image& img,
                           const std::filesystem::path& path)
{
    std::ofstream out(path);
    if (!out)
        throw std::runtime_error("can't write " + path.string());
    out << "P3\n" << img.width() << ' ' << img.height() << "\n255\n";
    for (int y = 0; y < img.height(); ++y) {
        for (int x = 0; x < img.width(); ++x) {
            Color c = img.get(x, y);
            if (x > 0)
                out << ' ';
            out << +c.r << ' ' << +c.g << ' ' << +c.b;
        }
        out << '\n';
    }
}
```

### What happened

Open `images/tiny.ppm` in the editor:

```text
P3
4 3
255
255 0 0 255 255 255 255 255 255 0 255 0
255 255 255 255 255 255 255 255 255 255 255 255
0 0 255 255 255 255 255 255 255 0 0 0
```

The red pixel at (0, 0) comes first: files store the **top row first**, left to right, matching `pixels()`. That's why the layout chosen in the last step makes writing a file a single pass over memory.

Open it in an image viewer if you have one that reads PPM. It's tiny: zoom right in, and you'll see four squares across and three down.

**Experiment:** change a number in the file in the editor, save, and reopen it in the viewer. The file *is* the picture.

```check
run "cmake --build raster/build"
run "./raster/build/tiny" stdout="wrote images/tiny.ppm"
contains images/tiny.ppm "P3\n4 3\n255\n255 0 0 255 255 255 255 255 255 0 255 0\n" label="images/tiny.ppm starts with the header and the top row" -- One row per line, single spaces between numbers, and +c.r so each channel is written as a number.
contains images/tiny.ppm "\n0 0 255 255 255 255 255 255 255 0 0 0\n" label="images/tiny.ppm ends with the bottom row"
```
