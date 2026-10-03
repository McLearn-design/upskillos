---
title: 2 — Binary Files: PPM and BMP
track: Graphics from First Principles
runtime: cpp
reference: optional
console: true
---

A text PPM spends up to 12 characters on a pixel ("255 255 255 "), and reading it back means parsing numbers. A full-HD image would be about 25 MB of text. Real formats store each channel as **one byte**: a binary file.

Binary files bring three new problems, and you'll meet all of them in this lesson:

| Problem | Where it bites |
|---|---|
| text mode changes bytes that look like newlines | a pixel whose value is 10, on Windows |
| a number bigger than a byte has its bytes in some order | BMP's header fields |
| formats can demand alignment | BMP's rows: a bug that only appears at some widths |

You can't read a binary file in the editor to check it, so the lesson starts with a tool that can.

## Step 1 — A tool that reads images back

**This step: create the supplied `raster/apps/imgcheck.cpp`, build, and run it on `images/tiny.ppm`.**

`imgcheck` reads a PPM or BMP file, checks that it's consistent, and tells you what's really in it:

```text
cmake --build raster/build
./raster/build/imgcheck images/tiny.ppm 3 0
```

It prints the format, the size and the file's length in bytes, then the colour of pixel (3, 0).

**Why a separate tool?** You could test a writer by reading the file back with a reader you also wrote. But if you misunderstood the format, the reader would share the misunderstanding, and the round trip would pass. `imgcheck` was written from the format specifications and shares no code with your writers. The checks in this track use it to look at your images.

You don't need to read all of it now. Look at `read_bmp` after step 5, once you know the BMP layout.

```cpp file=raster/apps/imgcheck.cpp provided
// imgcheck.cpp: reads a PPM (P3 or P6) or 24-bit BMP file and reports
// what is really in it. It shares no code with your writers, so it
// catches their mistakes instead of repeating them.
//
//   imgcheck FILE          the format, size and file length
//   imgcheck FILE X Y      ...and the colour of pixel (X, Y),
//                          with (0, 0) the top-left pixel
#include <cctype>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <sstream>
#include <string>
#include <vector>

namespace {

struct Picture {
    std::string format;
    int width = 0;
    int height = 0;
    std::vector<int> rgb;   // 3 numbers per pixel, top row first
};

struct Bad {
    std::string why;
};

std::vector<unsigned char> read_all(const std::string& path)
{
    std::ifstream in(path, std::ios::binary);
    if (!in)
        throw Bad{"can't open " + path};
    return {std::istreambuf_iterator<char>(in),
            std::istreambuf_iterator<char>()};
}

// Reads a whitespace-separated number from a PPM header or P3 body.
int next_number(const std::vector<unsigned char>& d, std::size_t& i)
{
    while (i < d.size() && std::isspace(d[i]))
        ++i;
    if (i >= d.size() || !std::isdigit(d[i]))
        throw Bad{"expected a number at byte " + std::to_string(i)};
    int n = 0;
    while (i < d.size() && std::isdigit(d[i]))
        n = n * 10 + (d[i++] - '0');
    return n;
}

Picture read_ppm(const std::vector<unsigned char>& d)
{
    Picture p;
    p.format = d[1] == '3' ? "P3" : "P6";
    std::size_t i = 2;
    p.width = next_number(d, i);
    p.height = next_number(d, i);
    if (next_number(d, i) != 255)
        throw Bad{"the maximum value must be 255"};
    const std::size_t count = std::size_t(p.width) * p.height * 3;
    if (p.format == "P3") {
        for (std::size_t k = 0; k < count; ++k)
            p.rgb.push_back(next_number(d, i));
        return p;
    }
    ++i;   // exactly one whitespace byte after 255
    if (d.size() != i + count)
        throw Bad{"a " + std::to_string(p.width) + " x " +
                  std::to_string(p.height) + " P6 image needs " +
                  std::to_string(i + count) + " bytes, but the file has " +
                  std::to_string(d.size())};
    p.rgb.assign(d.begin() + i, d.end());
    return p;
}

std::uint32_t u32(const std::vector<unsigned char>& d, std::size_t at)
{
    return d[at] | d[at + 1] << 8 | d[at + 2] << 16 |
           std::uint32_t(d[at + 3]) << 24;
}

int u16(const std::vector<unsigned char>& d, std::size_t at)
{
    return d[at] | d[at + 1] << 8;
}

Picture read_bmp(const std::vector<unsigned char>& d)
{
    if (d.size() < 54)
        throw Bad{"too short for a BMP header"};
    Picture p;
    p.format = "BMP";
    p.width = static_cast<std::int32_t>(u32(d, 18));
    const auto h = static_cast<std::int32_t>(u32(d, 22));
    p.height = h < 0 ? -h : h;
    if (u32(d, 2) != d.size())
        throw Bad{"the header says the file is " +
                  std::to_string(u32(d, 2)) + " bytes, but it is " +
                  std::to_string(d.size())};
    if (u32(d, 14) != 40 || u16(d, 26) != 1 || u16(d, 28) != 24 ||
        u32(d, 30) != 0)
        throw Bad{"not an uncompressed 24-bit BMP"};
    const std::size_t offset = u32(d, 10);
    const std::size_t stride = (std::size_t(p.width) * 3 + 3) / 4 * 4;
    const std::size_t need = offset + stride * p.height;
    if (d.size() != need)
        throw Bad{"a " + std::to_string(p.width) + " x " +
                  std::to_string(p.height) + " BMP needs " +
                  std::to_string(need) +
                  " bytes, but the file has " + std::to_string(d.size())};
    for (int y = 0; y < p.height; ++y) {
        const int row = h > 0 ? p.height - 1 - y : y;   // bottom-up?
        for (int x = 0; x < p.width; ++x) {
            const std::size_t at = offset + row * stride + x * 3;
            p.rgb.push_back(d[at + 2]);   // stored B, G, R
            p.rgb.push_back(d[at + 1]);
            p.rgb.push_back(d[at]);
        }
    }
    return p;
}

} // namespace

int main(int argc, char** argv)
{
    if (argc != 2 && argc != 4) {
        std::cerr << "usage: imgcheck FILE [X Y]\n";
        return 2;
    }
    try {
        const std::vector<unsigned char> d = read_all(argv[1]);
        Picture p;
        if (d.size() > 2 && d[0] == 'P' && (d[1] == '3' || d[1] == '6'))
            p = read_ppm(d);
        else if (d.size() > 2 && d[0] == 'B' && d[1] == 'M')
            p = read_bmp(d);
        else
            throw Bad{"not a PPM or BMP file"};
        std::cout << argv[1] << ": " << p.format << ", " << p.width
                  << " x " << p.height << ", " << d.size() << " bytes\n";
        if (argc == 4) {
            const int x = std::stoi(argv[2]);
            const int y = std::stoi(argv[3]);
            if (x < 0 || x >= p.width || y < 0 || y >= p.height)
                throw Bad{"pixel outside the image"};
            const std::size_t at = (std::size_t(y) * p.width + x) * 3;
            std::cout << "pixel (" << x << ", " << y << ") = " << p.rgb[at]
                      << ' ' << p.rgb[at + 1] << ' ' << p.rgb[at + 2]
                      << '\n';
        }
    } catch (const Bad& bad) {
        std::cout << "error: " << bad.why << '\n';
        return 1;
    } catch (const std::exception& e) {   // X or Y isn't a number
        std::cout << "error: " << e.what() << '\n';
        return 1;
    }
}
```

```check
run "cmake --build raster/build"
run "./raster/build/imgcheck images/tiny.ppm" stdout="images/tiny.ppm: P3, 4 x 3" label="imgcheck reads images/tiny.ppm"
run "./raster/build/imgcheck images/tiny.ppm 3 0" stdout="pixel (3, 0) = 0 255 0"
```

## Step 2 — The specification for P6

**This step: create the supplied `raster/tests/ppm_test.cpp` and read it.**

**P6** is the binary PPM: the same text header, `P6\n4 3\n255\n`, then each pixel as three raw bytes, red, green, blue, top row first. Nothing between pixels, nothing at the end of a row. So its size is exact: the header plus `width × height × 3` bytes.

Read `a_byte_that_looks_like_a_newline_survives`. To a file, a pixel with red = 10 is the byte 10, which is also the character `'\n'`. A stream opened in **text mode** on Windows writes every `'\n'` as two bytes, `"\r\n"`, the Windows line ending. In a text file that's what you want. In an image it inserts a byte, shifts every later pixel along, and the size test fails.

| Opened with | `'\n'` written as |
|---|---|
| `std::ofstream out(path)` | `\n` on Linux and macOS, **`\r\n` on Windows** |
| `std::ofstream out(path, std::ios::binary)` | `\n` everywhere |

```cpp file=raster/tests/ppm_test.cpp provided
// Provided by the lesson: what write_ppm (binary P6) must do.
#include "studio_test.hpp"

#include <filesystem>
#include <fstream>
#include <iterator>
#include <string>

#include "image.h"
#include "ppm.h"

namespace {

// The whole file, byte for byte.
std::string read_bytes(const std::filesystem::path& path)
{
    std::ifstream in(path, std::ios::binary);
    return {std::istreambuf_iterator<char>(in),
            std::istreambuf_iterator<char>()};
}

std::filesystem::path temp_file(const char* name)
{
    return std::filesystem::temp_directory_path() / name;
}

} // namespace

TEST(p6_is_a_header_then_3_bytes_per_pixel)
{
    Image img(4, 3);
    const auto path = temp_file("raster_p6_size.ppm");
    write_ppm(img, path);
    // "P6\n4 3\n255\n" is 11 bytes, then 4 * 3 pixels * 3 bytes.
    CHECK_EQ(std::filesystem::file_size(path), 11u + 36u);
    CHECK_EQ(read_bytes(path).substr(0, 11), std::string("P6\n4 3\n255\n"));
}

TEST(p6_pixels_are_r_g_b_top_row_first)
{
    Image img(2, 2);
    img.set(0, 0, Color{1, 2, 3});
    img.set(1, 1, Color{200, 100, 50});
    const auto path = temp_file("raster_p6_order.ppm");
    write_ppm(img, path);
    const std::string bytes = read_bytes(path);
    const std::size_t start = 11;   // "P6\n2 2\n255\n"
    CHECK_EQ(int(static_cast<unsigned char>(bytes[start])), 1);
    CHECK_EQ(int(static_cast<unsigned char>(bytes[start + 1])), 2);
    CHECK_EQ(int(static_cast<unsigned char>(bytes[start + 2])), 3);
    CHECK_EQ(int(static_cast<unsigned char>(bytes[start + 9])), 200);
    CHECK_EQ(int(static_cast<unsigned char>(bytes[start + 11])), 50);
}

TEST(a_byte_that_looks_like_a_newline_survives)
{
    // 10 is '\n' and 13 is '\r'. A file opened in text mode on Windows
    // writes '\n' as two bytes, "\r\n", and the image falls apart.
    Image img(1, 1, Color{10, 13, 10});
    const auto path = temp_file("raster_p6_newline.ppm");
    write_ppm(img, path);
    CHECK_EQ(std::filesystem::file_size(path), 11u + 3u);
    CHECK_EQ(read_bytes(path).substr(11), std::string("\n\r\n"));
}
```

```check
file raster/tests/ppm_test.cpp
```

## Step 3 — Write binary PPM

**This step: add `write_ppm` to `raster/ppm.h`: a P6 file, opened in binary mode. Build and run the tests.**

The header is text, so `<<` is right for it. Then each channel goes out as one byte, with `put`:

```cpp
for (Color c : img.pixels()) {
    out.put(static_cast<char>(c.r));
    out.put(static_cast<char>(c.g));
    out.put(static_cast<char>(c.b));
}
```

`pixels()` is already in file order, top row first, so it's one loop.

`put` takes a `char`. On most systems `char` is signed, so 200 becomes -56; the cast keeps the same 8 bits, and the file gets the byte 200. The test reads it back as `unsigned char` to see 200 again.

**Predict:** if you forget `std::ios::binary`, which systems fail the newline test?

```text
cmake --build raster/build
./raster/build/raster_tests
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

// P6, the binary version: the same header as text, then each pixel
// as three raw bytes. Binary mode, so no byte is ever changed.
inline void write_ppm(const Image& img, const std::filesystem::path& path)
{
    std::ofstream out(path, std::ios::binary);
    if (!out)
        throw std::runtime_error("can't write " + path.string());
    out << "P6\n" << img.width() << ' ' << img.height() << "\n255\n";
    for (Color c : img.pixels()) {
        out.put(static_cast<char>(c.r));
        out.put(static_cast<char>(c.g));
        out.put(static_cast<char>(c.b));
    }
}
```

### Answer

Only Windows. On Linux and macOS, text mode and binary mode write identical bytes, so the bug passes every test there and breaks the first time a Windows user saves an image with a 10 in it. Whenever a file isn't text, open it with `std::ios::binary`, on every system.

```check
run "cmake --build raster/build"
tests "./raster/build/raster_tests" require="p6_is_a_header_then_3_bytes_per_pixel p6_pixels_are_r_g_b_top_row_first a_byte_that_looks_like_a_newline_survives" -- Write the header with <<, then each channel with out.put(static_cast<char>(...)).
```

## Step 4 — A gradient, and its exact size

**This step: create `raster/apps/gradient.cpp`. It makes a 256 × 256 image where pixel (x, y) is `Color{x, y, 128}`, and saves it as `images/gradient.ppm`. Build it, run it, and check it with `imgcheck`.**

- Red grows from 0 on the left to 255 on the right, green from 0 at the top to 255 at the bottom. Blue is 128 everywhere.
- `x` is an `int`; a `Color` member is a `std::uint8_t`. Initialising one from an `int` inside braces is a **narrowing** error, so convert explicitly: `static_cast<std::uint8_t>(x)`.
- Print `wrote images/gradient.ppm`.

**Predict:** how many bytes will `images/gradient.ppm` be? (The header is `P6\n256 256\n255\n`.)

```text
cmake --build raster/build
./raster/build/gradient
./raster/build/imgcheck images/gradient.ppm 10 200
```

```cpp file=raster/apps/gradient.cpp
// gradient.cpp: red grows to the right, green grows downwards.
#include <filesystem>
#include <iostream>

#include "image.h"
#include "ppm.h"

int main()
{
    Image img(256, 256);
    for (int y = 0; y < img.height(); ++y) {
        for (int x = 0; x < img.width(); ++x) {
            const auto r = static_cast<std::uint8_t>(x);
            const auto g = static_cast<std::uint8_t>(y);
            img.set(x, y, Color{r, g, 128});
        }
    }
    std::filesystem::create_directories("images");
    write_ppm(img, "images/gradient.ppm");
    std::cout << "wrote images/gradient.ppm\n";
}
```

### Answer

The header is 15 bytes and the pixels are 256 × 256 × 3 = 196,608, so **196,623 bytes**, exactly. A binary format has no slack: if the size is off by one, something is wrong. Open the image in a viewer that reads PPM: black top-left, red top-right, green bottom-left, yellow bottom-right, all with a little blue.

```check
run "cmake --build raster/build"
run "./raster/build/gradient" stdout="wrote images/gradient.ppm"
run "./raster/build/imgcheck images/gradient.ppm 10 200" stdout="P6, 256 x 256, 196623 bytes"
run "./raster/build/imgcheck images/gradient.ppm 10 200" stdout="pixel (10, 200) = 10 200 128" -- Red is x, green is y, blue is 128.
```

## Step 5 — A colleague's BMP writer

**This step: create the supplied `raster/bmp.h` and read it with the table below.**

**BMP** is Windows' bitmap format, and every viewer and browser can open it. A colleague has written `write_bmp`. The file is two headers and then the pixels:

| Bytes | Field | Value here |
|---|---|---|
| 0–1 | signature | `'B' 'M'` |
| 2–5 | file size in bytes | 54 + pixel bytes |
| 10–13 | where the pixels start | 54 |
| 14–17 | info header size | 40 |
| 18–21, 22–25 | width, height | a **positive** height means rows are stored **bottom row first** |
| 26–27, 28–29 | planes, bits per pixel | 1, 24 |
| 30–33 | compression | 0, none |
| 54… | the pixels | each pixel **B, G, R**; each row's length **rounded up to a multiple of 4 bytes**, padded with zeros |

### Little-endian

The file size is a 32-bit number, four bytes, and the format says they're **little-endian**: lowest byte first. 102 is `0x00000066`, stored as `66 00 00 00`.

```cpp
inline void put_u16(std::ostream& out, std::uint16_t v)
{
    out.put(static_cast<char>(v & 0xFF));   // low byte
    out.put(static_cast<char>(v >> 8));     // high byte
}
```

You might be tempted to write the `std::uint32_t` straight from memory with `out.write(reinterpret_cast<const char*>(&v), 4)`. That writes the bytes in whatever order *your* CPU keeps them. x86 and Apple's ARM chips happen to be little-endian, so it works, until it runs on one that isn't. Shifting and masking gives the format's order on every machine.

The bottom-up rows and B, G, R order are history: they matched how early Windows hardware stored pictures. Formats keep their quirks forever.

Read the code against the table. Does it follow every rule?

```cpp file=raster/bmp.h provided
// bmp.h: writes an Image as a 24-bit BMP file, which every image
// viewer and browser can open.
#pragma once

#include <cstdint>
#include <filesystem>
#include <fstream>
#include <stdexcept>

#include "image.h"

// BMP numbers are little-endian: the lowest byte comes first.
// Writing them byte by byte works on any computer, whatever order
// its own memory uses.
inline void put_u16(std::ostream& out, std::uint16_t v)
{
    out.put(static_cast<char>(v & 0xFF));
    out.put(static_cast<char>(v >> 8));
}

inline void put_u32(std::ostream& out, std::uint32_t v)
{
    put_u16(out, static_cast<std::uint16_t>(v & 0xFFFF));
    put_u16(out, static_cast<std::uint16_t>(v >> 16));
}

inline void write_bmp(const Image& img, const std::filesystem::path& path)
{
    const std::uint32_t width = img.width();
    const std::uint32_t height = img.height();
    const std::uint32_t row_size = width * 3;
    const std::uint32_t pixel_bytes = row_size * height;

    std::ofstream out(path, std::ios::binary);
    if (!out)
        throw std::runtime_error("can't write " + path.string());

    // The file header: 14 bytes.
    out.put('B');
    out.put('M');
    put_u32(out, 14 + 40 + pixel_bytes);   // the file's size
    put_u32(out, 0);                       // reserved
    put_u32(out, 14 + 40);                 // where the pixels start

    // The info header: 40 bytes.
    put_u32(out, 40);            // this header's size
    put_u32(out, width);
    put_u32(out, height);        // positive: the rows are bottom-up
    put_u16(out, 1);             // colour planes: always 1
    put_u16(out, 24);            // bits per pixel
    put_u32(out, 0);             // compression: none
    put_u32(out, pixel_bytes);
    put_u32(out, 2835);          // pixels per metre (72 dpi), x
    put_u32(out, 2835);          // and y
    put_u32(out, 0);             // palette colours: none
    put_u32(out, 0);             // important colours: all

    // The pixels: the BOTTOM row first, each pixel as B, G, R.
    for (int y = img.height() - 1; y >= 0; --y) {
        for (int x = 0; x < img.width(); ++x) {
            const Color c = img.get(x, y);
            out.put(static_cast<char>(c.b));
            out.put(static_cast<char>(c.g));
            out.put(static_cast<char>(c.r));
        }
    }
}
```

```check
file raster/bmp.h
```

## Step 6 — Save the gradient as BMP too

**This step: make `gradient.cpp` also save `images/gradient.bmp` with `write_bmp`, and print `wrote images/gradient.bmp`. Build, run, check it, and open it in your image viewer.**

```text
cmake --build raster/build
./raster/build/gradient
./raster/build/imgcheck images/gradient.bmp 10 200
```

`imgcheck` reads the rows bottom-up and the channels as B, G, R, so pixel (10, 200) should come out as `10 200 128` again, the same as the PPM.

```cpp file=raster/apps/gradient.cpp
// gradient.cpp: red grows to the right, green grows downwards.
#include <filesystem>
#include <iostream>

#include "bmp.h"
#include "image.h"
#include "ppm.h"

int main()
{
    Image img(256, 256);
    for (int y = 0; y < img.height(); ++y) {
        for (int x = 0; x < img.width(); ++x) {
            const auto r = static_cast<std::uint8_t>(x);
            const auto g = static_cast<std::uint8_t>(y);
            img.set(x, y, Color{r, g, 128});
        }
    }
    std::filesystem::create_directories("images");
    write_ppm(img, "images/gradient.ppm");
    std::cout << "wrote images/gradient.ppm\n";
    write_bmp(img, "images/gradient.bmp");
    std::cout << "wrote images/gradient.bmp\n";
}
```

### What happened

It works: 54 header bytes plus 196,608 pixel bytes is 196,662, and the viewer shows the same gradient as the PPM. Your colleague's writer looks correct.

```check
run "cmake --build raster/build"
run "./raster/build/gradient" stdout="wrote images/gradient.bmp"
run "./raster/build/imgcheck images/gradient.bmp 10 200" stdout="BMP, 256 x 256, 196662 bytes"
run "./raster/build/imgcheck images/gradient.bmp 10 200" stdout="pixel (10, 200) = 10 200 128"
```

## Step 7 — Five pixels wide

**This step: create the supplied `raster/apps/stripes.cpp`. Build it, run it, then run `imgcheck` on the image it writes.**

It saves a 5 × 3 image: a red column on the left, a blue one on the right, white between.

```text
cmake --build raster/build
./raster/build/stripes
./raster/build/imgcheck images/stripes.bmp 4 1
```

**Predict:** the gradient worked. Will this?

```cpp file=raster/apps/stripes.cpp provided
// stripes.cpp: a 5 x 3 image with a red, a white and a blue column.
#include <filesystem>
#include <iostream>

#include "bmp.h"
#include "image.h"

int main()
{
    Image img(5, 3, colors::white);
    for (int y = 0; y < img.height(); ++y) {
        img.set(0, y, colors::red);    // left column
        img.set(4, y, colors::blue);   // right column
    }
    std::filesystem::create_directories("images");
    write_bmp(img, "images/stripes.bmp");
    std::cout << "wrote images/stripes.bmp\n";
}
```

### What happened

```text
error: a 5 x 3 BMP needs 102 bytes, but the file has 99
```

Open the image in a viewer: some refuse it, others show the colours sliding diagonally across the rows.

**Diagnose before you read on:** which rule from the table does `bmp.h` break, and why didn't the gradient notice?

A row of 5 pixels is 15 bytes, and the format wants every row to start at a multiple of 4 bytes, so each row needs **one** byte of padding: 16 bytes per row, 48 for the image, 102 for the file. The writer writes 15 per row. A reader that follows the format starts row 1 one byte too early, and every row after drifts further: that's the diagonal slide.

The gradient was 256 pixels wide: 768 bytes per row, already a multiple of 4. **Any width that is a multiple of 4 hides this bug.** Testing only round numbers is how it shipped.

Why does the format want this? Machines of the time read memory fastest in 4-byte words, and a row starting on a word boundary could be copied to the screen with whole-word moves. GPUs still pad image rows today; the padded row length is called the **stride** or **pitch**.

```check
run "cmake --build raster/build"
run "./raster/build/stripes" stdout="wrote images/stripes.bmp"
```

## Step 8 — Fix the padding

**This step: fix `write_bmp` in `raster/bmp.h`: round each row up to a multiple of 4 bytes, use that row size in the header, and write the padding bytes after each row. Then build and check both images.**

The rounding trick, for whole numbers: add 3, then divide by 4 and multiply by 4. The division throws away the remainder, so this rounds *up*.

```cpp
const std::uint32_t row_size = (width * 3 + 3) / 4 * 4;
const std::uint32_t padding = row_size - width * 3;
```

| width | `width * 3` | `row_size` | padding |
|---|---|---|---|
| 4 | 12 | 12 | 0 |
| 5 | 15 | 16 | 1 |
| 6 | 18 | 20 | 2 |
| 7 | 21 | 24 | 3 |

```text
cmake --build raster/build
./raster/build/stripes
./raster/build/imgcheck images/stripes.bmp 4 1
./raster/build/gradient
./raster/build/imgcheck images/gradient.bmp 10 200
```

```cpp file=raster/bmp.h
// bmp.h: writes an Image as a 24-bit BMP file, which every image
// viewer and browser can open.
#pragma once

#include <cstdint>
#include <filesystem>
#include <fstream>
#include <stdexcept>

#include "image.h"

// BMP numbers are little-endian: the lowest byte comes first.
// Writing them byte by byte works on any computer, whatever order
// its own memory uses.
inline void put_u16(std::ostream& out, std::uint16_t v)
{
    out.put(static_cast<char>(v & 0xFF));
    out.put(static_cast<char>(v >> 8));
}

inline void put_u32(std::ostream& out, std::uint32_t v)
{
    put_u16(out, static_cast<std::uint16_t>(v & 0xFFFF));
    put_u16(out, static_cast<std::uint16_t>(v >> 16));
}

inline void write_bmp(const Image& img, const std::filesystem::path& path)
{
    const std::uint32_t width = img.width();
    const std::uint32_t height = img.height();
    // Each row is padded with zero bytes to a multiple of 4 bytes.
    const std::uint32_t row_size = (width * 3 + 3) / 4 * 4;
    const std::uint32_t padding = row_size - width * 3;
    const std::uint32_t pixel_bytes = row_size * height;

    std::ofstream out(path, std::ios::binary);
    if (!out)
        throw std::runtime_error("can't write " + path.string());

    // The file header: 14 bytes.
    out.put('B');
    out.put('M');
    put_u32(out, 14 + 40 + pixel_bytes);   // the file's size
    put_u32(out, 0);                       // reserved
    put_u32(out, 14 + 40);                 // where the pixels start

    // The info header: 40 bytes.
    put_u32(out, 40);            // this header's size
    put_u32(out, width);
    put_u32(out, height);        // positive: the rows are bottom-up
    put_u16(out, 1);             // colour planes: always 1
    put_u16(out, 24);            // bits per pixel
    put_u32(out, 0);             // compression: none
    put_u32(out, pixel_bytes);
    put_u32(out, 2835);          // pixels per metre (72 dpi), x
    put_u32(out, 2835);          // and y
    put_u32(out, 0);             // palette colours: none
    put_u32(out, 0);             // important colours: all

    // The pixels: the BOTTOM row first, each pixel as B, G, R,
    // and each row padded to a multiple of 4 bytes.
    for (int y = img.height() - 1; y >= 0; --y) {
        for (int x = 0; x < img.width(); ++x) {
            const Color c = img.get(x, y);
            out.put(static_cast<char>(c.b));
            out.put(static_cast<char>(c.g));
            out.put(static_cast<char>(c.r));
        }
        for (std::uint32_t i = 0; i < padding; ++i)
            out.put(0);
    }
}
```

```check
run "cmake --build raster/build"
run "./raster/build/stripes" stdout="wrote images/stripes.bmp"
run "./raster/build/imgcheck images/stripes.bmp 4 1" stdout="BMP, 5 x 3, 102 bytes" -- Write row_size - width * 3 zero bytes after each row, and use the padded row size in pixel_bytes.
run "./raster/build/imgcheck images/stripes.bmp 4 1" stdout="pixel (4, 1) = 0 0 255"
run "./raster/build/gradient" stdout="wrote images/gradient.bmp"
run "./raster/build/imgcheck images/gradient.bmp" stdout="BMP, 256 x 256, 196662 bytes" label="images/gradient.bmp is still 196662 bytes"
```

## Step 9 — Your tests for write_bmp

**This step: create `raster/tests/bmp_test.cpp` with at least three tests of `write_bmp`. At least one must use an image with an odd width.**

Write each test image to a file in `std::filesystem::temp_directory_path()`, read the whole file back as bytes, and check them. `ppm_test.cpp` has the helpers you need. Ideas:

- the file size for widths that need 0 and 1 bytes of padding;
- the first pixel bytes are the **bottom-left** pixel, as B, G, R;
- a header field, little-endian: bytes 2–5 hold the file size.

Then build and run every test.

The bug in this lesson survived because every test image had a convenient size. That's the lesson for your tests: pick the cases where the rule *does something*. For padding, that's widths 1, 2, 3, 5, 6, 7.

```text
cmake --build raster/build
./raster/build/raster_tests
```

```cpp file=raster/tests/bmp_test.cpp
// My tests for write_bmp.
#include "studio_test.hpp"

#include <filesystem>
#include <fstream>
#include <iterator>
#include <string>

#include "bmp.h"
#include "image.h"

namespace {

std::string write_and_read(const Image& img, const char* name)
{
    const auto path = std::filesystem::temp_directory_path() / name;
    write_bmp(img, path);
    std::ifstream in(path, std::ios::binary);
    return {std::istreambuf_iterator<char>(in),
            std::istreambuf_iterator<char>()};
}

int byte(const std::string& bytes, std::size_t at)
{
    return static_cast<unsigned char>(bytes[at]);
}

} // namespace

TEST(bmp_rows_are_padded_to_4_bytes)
{
    // 5 pixels * 3 bytes = 15, padded to 16, for each of 3 rows.
    const std::string bytes = write_and_read(Image(5, 3), "bmp_pad.bmp");
    CHECK_EQ(bytes.size(), 54u + 16u * 3u);
}

TEST(bmp_has_no_padding_when_the_width_is_a_multiple_of_4)
{
    const std::string bytes = write_and_read(Image(4, 2), "bmp_np.bmp");
    CHECK_EQ(bytes.size(), 54u + 12u * 2u);
}

TEST(bmp_stores_the_bottom_row_first_as_bgr)
{
    Image img(1, 3);
    img.set(0, 2, Color{10, 20, 30});   // the bottom pixel
    const std::string bytes = write_and_read(img, "bmp_order.bmp");
    CHECK_EQ(byte(bytes, 54), 30);      // B
    CHECK_EQ(byte(bytes, 55), 20);      // G
    CHECK_EQ(byte(bytes, 56), 10);      // R
}

TEST(bmp_size_field_is_little_endian)
{
    const std::string bytes = write_and_read(Image(5, 3), "bmp_le.bmp");
    CHECK_EQ(byte(bytes, 2), 102);      // 102 = 0x66, lowest byte first
    CHECK_EQ(byte(bytes, 3), 0);
}
```

```check
matches raster/tests/bmp_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="bmp_test.cpp has at least three tests"
matches raster/tests/bmp_test.cpp "Image\s*\w*\s*[({]\s*\d*[13579]\s*," label="a test uses an Image with an odd width" -- An odd width can never be a multiple of 4, so its rows need padding.
run "cmake --build raster/build"
tests "./raster/build/raster_tests"
```
