// What a learner does at each step of the cpp-graphics track, for its walkthrough test (walkCppTrack.js).
// Generated with the lessons; see tracks/cpp-foundations.walkthrough.js for the format.
import { configure } from '../walkCppTrack.js';

export const WALKTHROUGH = {
  "01-pixels#Step 1 \u2014 The test framework": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-pixels#Step 2 \u2014 The test runner": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-pixels#Step 3 \u2014 The project's build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-pixels#Step 4 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-pixels#Step 5 \u2014 The Image class": {
    "run": [
      configure("raster"),
    ],
    "wrong": [
      {
        "name": "stored the pixels column by column",
        "files": {
          "raster/image.h": "// image.h: an image in memory, as a grid of RGB pixels.\n#pragma once\n\n#include <cstddef>\n#include <cstdint>\n#include <ostream>\n#include <stdexcept>\n#include <vector>\n\n// One pixel: red, green and blue, each 0 to 255.\nstruct Color {\n    std::uint8_t r = 0;\n    std::uint8_t g = 0;\n    std::uint8_t b = 0;\n\n    bool operator==(const Color&) const = default;\n};\n\n// Prints (255, 0, 0). The + turns each uint8_t into an int:\n// without it, << would print the byte as a character.\ninline std::ostream& operator<<(std::ostream& out, Color c)\n{\n    return out << '(' << +c.r << \", \" << +c.g << \", \" << +c.b << ')';\n}\n\nnamespace colors {\ninline constexpr Color black{0, 0, 0};\ninline constexpr Color white{255, 255, 255};\ninline constexpr Color red{255, 0, 0};\ninline constexpr Color green{0, 255, 0};\ninline constexpr Color blue{0, 0, 255};\n}\n\n// (0, 0) is the top-left pixel; x grows to the right, y grows DOWN.\nclass Image {\npublic:\n    Image(int width, int height, Color fill = colors::black)\n        : width_(width), height_(height)\n    {\n        if (width < 1 || height < 1)\n            throw std::invalid_argument(\"an image needs at least 1 x 1\");\n        pixels_.assign(static_cast<std::size_t>(width) * height, fill);\n    }\n\n    int width() const { return width_; }\n    int height() const { return height_; }\n\n    bool contains(int x, int y) const\n    {\n        return x >= 0 && x < width_ && y >= 0 && y < height_;\n    }\n\n    // Reading outside the image is a bug in the caller: throw.\n    Color get(int x, int y) const\n    {\n        if (!contains(x, y))\n            throw std::out_of_range(\"pixel outside the image\");\n        return pixels_[index(x, y)];\n    }\n\n    // Drawing outside the image is normal (a shape that is partly\n    // off-screen), so those pixels are skipped: clipping.\n    void set(int x, int y, Color c)\n    {\n        if (contains(x, y))\n            pixels_[index(x, y)] = c;\n    }\n\n    // How many pixels have exactly this colour.\n    int count(Color c) const\n    {\n        int n = 0;\n        for (Color p : pixels_)\n            if (p == c)\n                ++n;\n        return n;\n    }\n\n    // Row by row, top row first: pixel (x, y) is at y * width + x.\n    const std::vector<Color>& pixels() const { return pixels_; }\n\nprivate:\n    std::size_t index(int x, int y) const\n    {\n        return static_cast<std::size_t>(x) * height_ + y;\n    }\n\n    int width_;\n    int height_;\n    std::vector<Color> pixels_;\n};\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          2,
        ],
      },
      {
        "name": "get() does not check the position",
        "files": {
          "raster/image.h": "// image.h: an image in memory, as a grid of RGB pixels.\n#pragma once\n\n#include <cstddef>\n#include <cstdint>\n#include <ostream>\n#include <stdexcept>\n#include <vector>\n\n// One pixel: red, green and blue, each 0 to 255.\nstruct Color {\n    std::uint8_t r = 0;\n    std::uint8_t g = 0;\n    std::uint8_t b = 0;\n\n    bool operator==(const Color&) const = default;\n};\n\n// Prints (255, 0, 0). The + turns each uint8_t into an int:\n// without it, << would print the byte as a character.\ninline std::ostream& operator<<(std::ostream& out, Color c)\n{\n    return out << '(' << +c.r << \", \" << +c.g << \", \" << +c.b << ')';\n}\n\nnamespace colors {\ninline constexpr Color black{0, 0, 0};\ninline constexpr Color white{255, 255, 255};\ninline constexpr Color red{255, 0, 0};\ninline constexpr Color green{0, 255, 0};\ninline constexpr Color blue{0, 0, 255};\n}\n\n// (0, 0) is the top-left pixel; x grows to the right, y grows DOWN.\nclass Image {\npublic:\n    Image(int width, int height, Color fill = colors::black)\n        : width_(width), height_(height)\n    {\n        if (width < 1 || height < 1)\n            throw std::invalid_argument(\"an image needs at least 1 x 1\");\n        pixels_.assign(static_cast<std::size_t>(width) * height, fill);\n    }\n\n    int width() const { return width_; }\n    int height() const { return height_; }\n\n    bool contains(int x, int y) const\n    {\n        return x >= 0 && x < width_ && y >= 0 && y < height_;\n    }\n\n    // Reading outside the image is a bug in the caller: throw.\n    Color get(int x, int y) const\n    {\n        return pixels_[index(x, y)];\n    }\n\n    // Drawing outside the image is normal (a shape that is partly\n    // off-screen), so those pixels are skipped: clipping.\n    void set(int x, int y, Color c)\n    {\n        if (contains(x, y))\n            pixels_[index(x, y)] = c;\n    }\n\n    // How many pixels have exactly this colour.\n    int count(Color c) const\n    {\n        int n = 0;\n        for (Color p : pixels_)\n            if (p == c)\n                ++n;\n        return n;\n    }\n\n    // Row by row, top row first: pixel (x, y) is at y * width + x.\n    const std::vector<Color>& pixels() const { return pixels_; }\n\nprivate:\n    std::size_t index(int x, int y) const\n    {\n        return static_cast<std::size_t>(y) * width_ + x;\n    }\n\n    int width_;\n    int height_;\n    std::vector<Color> pixels_;\n};\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "01-pixels#Step 6 \u2014 A program that needs a file format": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-pixels#Step 7 \u2014 PPM: the simplest image file": {
    "wrong": [
      {
        "name": "wrote the image column by column",
        "files": {
          "raster/ppm.h": "// ppm.h: writes an Image as a PPM file.\n#pragma once\n\n#include <filesystem>\n#include <fstream>\n#include <stdexcept>\n\n#include \"image.h\"\n\n// P3, the text version: a short header, then every pixel as three\n// numbers. One image row per line of text.\ninline void write_ppm_text(const Image& img,\n                           const std::filesystem::path& path)\n{\n    std::ofstream out(path);\n    if (!out)\n        throw std::runtime_error(\"can't write \" + path.string());\n    out << \"P3\\n\" << img.width() << ' ' << img.height() << \"\\n255\\n\";\n    for (int x = 0; x < img.width(); ++x) {\n        for (int y = 0; y < img.height(); ++y) {\n            Color c = img.get(x, y);\n            if (y > 0)\n                out << ' ';\n            out << +c.r << ' ' << +c.g << ' ' << +c.b;\n        }\n        out << '\\n';\n    }\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          2,
          3,
        ],
      },
      {
        "name": "forgot the + before each channel",
        "files": {
          "raster/ppm.h": "// ppm.h: writes an Image as a PPM file.\n#pragma once\n\n#include <filesystem>\n#include <fstream>\n#include <stdexcept>\n\n#include \"image.h\"\n\n// P3, the text version: a short header, then every pixel as three\n// numbers. One image row per line of text.\ninline void write_ppm_text(const Image& img,\n                           const std::filesystem::path& path)\n{\n    std::ofstream out(path);\n    if (!out)\n        throw std::runtime_error(\"can't write \" + path.string());\n    out << \"P3\\n\" << img.width() << ' ' << img.height() << \"\\n255\\n\";\n    for (int y = 0; y < img.height(); ++y) {\n        for (int x = 0; x < img.width(); ++x) {\n            Color c = img.get(x, y);\n            if (x > 0)\n                out << ' ';\n            out << c.r << ' ' << c.g << ' ' << c.b;\n        }\n        out << '\\n';\n    }\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "02-binary-images#Step 1 \u2014 A tool that reads images back": {
    "wrong": [
      {
        "name": "did not create it",
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
          2,
        ],
      },
    ],
  },
  "02-binary-images#Step 2 \u2014 The specification for P6": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-binary-images#Step 3 \u2014 Write binary PPM": {
    "wrong": [
      {
        "name": "wrote the channels as numbers",
        "files": {
          "raster/ppm.h": "// ppm.h: writes an Image as a PPM file.\n#pragma once\n\n#include <filesystem>\n#include <fstream>\n#include <stdexcept>\n\n#include \"image.h\"\n\n// P3, the text version: a short header, then every pixel as three\n// numbers. One image row per line of text.\ninline void write_ppm_text(const Image& img,\n                           const std::filesystem::path& path)\n{\n    std::ofstream out(path);\n    if (!out)\n        throw std::runtime_error(\"can't write \" + path.string());\n    out << \"P3\\n\" << img.width() << ' ' << img.height() << \"\\n255\\n\";\n    for (int y = 0; y < img.height(); ++y) {\n        for (int x = 0; x < img.width(); ++x) {\n            Color c = img.get(x, y);\n            if (x > 0)\n                out << ' ';\n            out << +c.r << ' ' << +c.g << ' ' << +c.b;\n        }\n        out << '\\n';\n    }\n}\n\n// P6, the binary version: the same header as text, then each pixel\n// as three raw bytes. Binary mode, so no byte is ever changed.\ninline void write_ppm(const Image& img, const std::filesystem::path& path)\n{\n    std::ofstream out(path, std::ios::binary);\n    if (!out)\n        throw std::runtime_error(\"can't write \" + path.string());\n    out << \"P6\\n\" << img.width() << ' ' << img.height() << \"\\n255\\n\";\n    for (Color c : img.pixels())\n        out << +c.r << +c.g << +c.b;\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "02-binary-images#Step 4 \u2014 A gradient, and its exact size": {
    "wrong": [
      {
        "name": "swapped red and green",
        "files": {
          "raster/apps/gradient.cpp": "// gradient.cpp: red grows to the right, green grows downwards.\n#include <filesystem>\n#include <iostream>\n\n#include \"image.h\"\n#include \"ppm.h\"\n\nint main()\n{\n    Image img(256, 256);\n    for (int y = 0; y < img.height(); ++y) {\n        for (int x = 0; x < img.width(); ++x) {\n            const auto r = static_cast<std::uint8_t>(y);\n            const auto g = static_cast<std::uint8_t>(x);\n            img.set(x, y, Color{r, g, 128});\n        }\n    }\n    std::filesystem::create_directories(\"images\");\n    write_ppm(img, \"images/gradient.ppm\");\n    std::cout << \"wrote images/gradient.ppm\\n\";\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          3,
        ],
      },
    ],
  },
  "02-binary-images#Step 5 \u2014 A colleague's BMP writer": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-binary-images#Step 6 \u2014 Save the gradient as BMP too": {
    "wrong": [
      {
        "name": "did not call write_bmp",
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
          2,
        ],
      },
    ],
  },
  "02-binary-images#Step 7 \u2014 Five pixels wide": {
    "wrong": [
      {
        "name": "did not create it",
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "02-binary-images#Step 8 \u2014 Fix the padding": {
    "wrong": [
      {
        "name": "padded the header sizes but wrote no padding bytes",
        "files": {
          "raster/bmp.h": "// bmp.h: writes an Image as a 24-bit BMP file, which every image\n// viewer and browser can open.\n#pragma once\n\n#include <cstdint>\n#include <filesystem>\n#include <fstream>\n#include <stdexcept>\n\n#include \"image.h\"\n\n// BMP numbers are little-endian: the lowest byte comes first.\n// Writing them byte by byte works on any computer, whatever order\n// its own memory uses.\ninline void put_u16(std::ostream& out, std::uint16_t v)\n{\n    out.put(static_cast<char>(v & 0xFF));\n    out.put(static_cast<char>(v >> 8));\n}\n\ninline void put_u32(std::ostream& out, std::uint32_t v)\n{\n    put_u16(out, static_cast<std::uint16_t>(v & 0xFFFF));\n    put_u16(out, static_cast<std::uint16_t>(v >> 16));\n}\n\ninline void write_bmp(const Image& img, const std::filesystem::path& path)\n{\n    const std::uint32_t width = img.width();\n    const std::uint32_t height = img.height();\n    // Each row is padded with zero bytes to a multiple of 4 bytes.\n    const std::uint32_t row_size = (width * 3 + 3) / 4 * 4;\n    const std::uint32_t padding = row_size - width * 3;\n    const std::uint32_t pixel_bytes = row_size * height;\n\n    std::ofstream out(path, std::ios::binary);\n    if (!out)\n        throw std::runtime_error(\"can't write \" + path.string());\n\n    // The file header: 14 bytes.\n    out.put('B');\n    out.put('M');\n    put_u32(out, 14 + 40 + pixel_bytes);   // the file's size\n    put_u32(out, 0);                       // reserved\n    put_u32(out, 14 + 40);                 // where the pixels start\n\n    // The info header: 40 bytes.\n    put_u32(out, 40);            // this header's size\n    put_u32(out, width);\n    put_u32(out, height);        // positive: the rows are bottom-up\n    put_u16(out, 1);             // colour planes: always 1\n    put_u16(out, 24);            // bits per pixel\n    put_u32(out, 0);             // compression: none\n    put_u32(out, pixel_bytes);\n    put_u32(out, 2835);          // pixels per metre (72 dpi), x\n    put_u32(out, 2835);          // and y\n    put_u32(out, 0);             // palette colours: none\n    put_u32(out, 0);             // important colours: all\n\n    // The pixels: the BOTTOM row first, each pixel as B, G, R,\n    // and each row padded to a multiple of 4 bytes.\n    for (int y = img.height() - 1; y >= 0; --y) {\n        for (int x = 0; x < img.width(); ++x) {\n            const Color c = img.get(x, y);\n            out.put(static_cast<char>(c.b));\n            out.put(static_cast<char>(c.g));\n            out.put(static_cast<char>(c.r));\n        }\n    }\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          2,
          3,
        ],
      },
    ],
  },
  "02-binary-images#Step 9 \u2014 Your tests for write_bmp": {
    "wrong": [
      {
        "name": "only widths that need no padding",
        "files": {
          "raster/tests/bmp_test.cpp": "// My tests for write_bmp.\n#include \"studio_test.hpp\"\n\n#include <filesystem>\n#include <fstream>\n#include <iterator>\n#include <string>\n\n#include \"bmp.h\"\n#include \"image.h\"\n\nnamespace {\n\nstd::string write_and_read(const Image& img, const char* name)\n{\n    const auto path = std::filesystem::temp_directory_path() / name;\n    write_bmp(img, path);\n    std::ifstream in(path, std::ios::binary);\n    return {std::istreambuf_iterator<char>(in),\n            std::istreambuf_iterator<char>()};\n}\n\nint byte(const std::string& bytes, std::size_t at)\n{\n    return static_cast<unsigned char>(bytes[at]);\n}\n\n} // namespace\n\nTEST(bmp_rows_are_padded_to_4_bytes)\n{\n    // 5 pixels * 3 bytes = 15, padded to 16, for each of 3 rows.\n    const std::string bytes = write_and_read(Image(8, 3), \"bmp_pad.bmp\");\n    CHECK_EQ(bytes.size(), 54u + 24u * 3u);\n}\n\nTEST(bmp_has_no_padding_when_the_width_is_a_multiple_of_4)\n{\n    const std::string bytes = write_and_read(Image(4, 2), \"bmp_np.bmp\");\n    CHECK_EQ(bytes.size(), 54u + 12u * 2u);\n}\n\nTEST(bmp_stores_the_bottom_row_first_as_bgr)\n{\n    Image img(4, 3);\n    img.set(0, 2, Color{10, 20, 30});   // the bottom pixel\n    const std::string bytes = write_and_read(img, \"bmp_order.bmp\");\n    CHECK_EQ(byte(bytes, 54), 30);      // B\n    CHECK_EQ(byte(bytes, 55), 20);      // G\n    CHECK_EQ(byte(bytes, 56), 10);      // R\n}\n\nTEST(bmp_size_field_is_little_endian)\n{\n    const std::string bytes = write_and_read(Image(8, 3), \"bmp_le.bmp\");\n    CHECK_EQ(byte(bytes, 2), 126);\n    CHECK_EQ(byte(bytes, 3), 0);\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "03-vectors#Step 1 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-vectors#Step 2 \u2014 Vec2 and Vec3": {
    "wrong": [
      {
        "name": "a sign error in cross",
        "files": {
          "raster/vec.h": "// vec.h: 2D and 3D vectors, with the operators maths writes them with.\n#pragma once\n\n#include <cmath>\n#include <ostream>\n\nstruct Vec2 {\n    double x = 0;\n    double y = 0;\n\n    Vec2& operator+=(Vec2 v) { x += v.x; y += v.y; return *this; }\n    Vec2& operator-=(Vec2 v) { x -= v.x; y -= v.y; return *this; }\n    Vec2& operator*=(double s) { x *= s; y *= s; return *this; }\n    bool operator==(const Vec2&) const = default;\n};\n\nstruct Vec3 {\n    double x = 0;\n    double y = 0;\n    double z = 0;\n\n    Vec3& operator+=(Vec3 v) { x += v.x; y += v.y; z += v.z; return *this; }\n    Vec3& operator-=(Vec3 v) { x -= v.x; y -= v.y; z -= v.z; return *this; }\n    Vec3& operator*=(double s) { x *= s; y *= s; z *= s; return *this; }\n    bool operator==(const Vec3&) const = default;\n};\n\n// The binary operators are free functions written with the compound\n// ones, so a + b and a += b can never disagree.\ninline Vec2 operator+(Vec2 a, Vec2 b) { return a += b; }\ninline Vec2 operator-(Vec2 a, Vec2 b) { return a -= b; }\ninline Vec2 operator-(Vec2 v) { return {-v.x, -v.y}; }\ninline Vec2 operator*(Vec2 v, double s) { return v *= s; }\ninline Vec2 operator*(double s, Vec2 v) { return v *= s; }\ninline Vec2 operator/(Vec2 v, double s) { return v *= 1.0 / s; }\n\ninline Vec3 operator+(Vec3 a, Vec3 b) { return a += b; }\ninline Vec3 operator-(Vec3 a, Vec3 b) { return a -= b; }\ninline Vec3 operator-(Vec3 v) { return {-v.x, -v.y, -v.z}; }\ninline Vec3 operator*(Vec3 v, double s) { return v *= s; }\ninline Vec3 operator*(double s, Vec3 v) { return v *= s; }\ninline Vec3 operator/(Vec3 v, double s) { return v *= 1.0 / s; }\n\ninline std::ostream& operator<<(std::ostream& out, Vec2 v)\n{\n    return out << '(' << v.x << \", \" << v.y << ')';\n}\n\ninline std::ostream& operator<<(std::ostream& out, Vec3 v)\n{\n    return out << '(' << v.x << \", \" << v.y << \", \" << v.z << ')';\n}\n\ninline double dot(Vec2 a, Vec2 b) { return a.x * b.x + a.y * b.y; }\n\ninline double dot(Vec3 a, Vec3 b)\n{\n    return a.x * b.x + a.y * b.y + a.z * b.z;\n}\n\n// A vector perpendicular to both a and b (right-hand rule).\ninline Vec3 cross(Vec3 a, Vec3 b)\n{\n    return {a.y * b.z - a.z * b.y,\n            a.x * b.z - a.z * b.x,\n            a.x * b.y - a.y * b.x};\n}\n\n// The 2D cross product is a number: the z of the 3D one.\n// Positive when b is anticlockwise from a (with y up).\ninline double cross(Vec2 a, Vec2 b) { return a.x * b.y - a.y * b.x; }\n\ninline double length(Vec2 v) { return std::sqrt(dot(v, v)); }\ninline double length(Vec3 v) { return std::sqrt(dot(v, v)); }\n\n// The same direction, length 1. The zero vector has no direction:\n// it stays zero rather than becoming NaN (0 / 0).\ninline Vec3 normalize(Vec3 v)\n{\n    const double len = length(v);\n    return len == 0 ? v : v / len;\n}\n\ninline Vec2 normalize(Vec2 v)\n{\n    const double len = length(v);\n    return len == 0 ? v : v / len;\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
      {
        "name": "normalize divides by zero",
        "files": {
          "raster/vec.h": "// vec.h: 2D and 3D vectors, with the operators maths writes them with.\n#pragma once\n\n#include <cmath>\n#include <ostream>\n\nstruct Vec2 {\n    double x = 0;\n    double y = 0;\n\n    Vec2& operator+=(Vec2 v) { x += v.x; y += v.y; return *this; }\n    Vec2& operator-=(Vec2 v) { x -= v.x; y -= v.y; return *this; }\n    Vec2& operator*=(double s) { x *= s; y *= s; return *this; }\n    bool operator==(const Vec2&) const = default;\n};\n\nstruct Vec3 {\n    double x = 0;\n    double y = 0;\n    double z = 0;\n\n    Vec3& operator+=(Vec3 v) { x += v.x; y += v.y; z += v.z; return *this; }\n    Vec3& operator-=(Vec3 v) { x -= v.x; y -= v.y; z -= v.z; return *this; }\n    Vec3& operator*=(double s) { x *= s; y *= s; z *= s; return *this; }\n    bool operator==(const Vec3&) const = default;\n};\n\n// The binary operators are free functions written with the compound\n// ones, so a + b and a += b can never disagree.\ninline Vec2 operator+(Vec2 a, Vec2 b) { return a += b; }\ninline Vec2 operator-(Vec2 a, Vec2 b) { return a -= b; }\ninline Vec2 operator-(Vec2 v) { return {-v.x, -v.y}; }\ninline Vec2 operator*(Vec2 v, double s) { return v *= s; }\ninline Vec2 operator*(double s, Vec2 v) { return v *= s; }\ninline Vec2 operator/(Vec2 v, double s) { return v *= 1.0 / s; }\n\ninline Vec3 operator+(Vec3 a, Vec3 b) { return a += b; }\ninline Vec3 operator-(Vec3 a, Vec3 b) { return a -= b; }\ninline Vec3 operator-(Vec3 v) { return {-v.x, -v.y, -v.z}; }\ninline Vec3 operator*(Vec3 v, double s) { return v *= s; }\ninline Vec3 operator*(double s, Vec3 v) { return v *= s; }\ninline Vec3 operator/(Vec3 v, double s) { return v *= 1.0 / s; }\n\ninline std::ostream& operator<<(std::ostream& out, Vec2 v)\n{\n    return out << '(' << v.x << \", \" << v.y << ')';\n}\n\ninline std::ostream& operator<<(std::ostream& out, Vec3 v)\n{\n    return out << '(' << v.x << \", \" << v.y << \", \" << v.z << ')';\n}\n\ninline double dot(Vec2 a, Vec2 b) { return a.x * b.x + a.y * b.y; }\n\ninline double dot(Vec3 a, Vec3 b)\n{\n    return a.x * b.x + a.y * b.y + a.z * b.z;\n}\n\n// A vector perpendicular to both a and b (right-hand rule).\ninline Vec3 cross(Vec3 a, Vec3 b)\n{\n    return {a.y * b.z - a.z * b.y,\n            a.z * b.x - a.x * b.z,\n            a.x * b.y - a.y * b.x};\n}\n\n// The 2D cross product is a number: the z of the 3D one.\n// Positive when b is anticlockwise from a (with y up).\ninline double cross(Vec2 a, Vec2 b) { return a.x * b.y - a.y * b.x; }\n\ninline double length(Vec2 v) { return std::sqrt(dot(v, v)); }\ninline double length(Vec3 v) { return std::sqrt(dot(v, v)); }\n\n// The same direction, length 1. The zero vector has no direction:\n// it stays zero rather than becoming NaN (0 / 0).\ninline Vec3 normalize(Vec3 v)\n{\n    return v / length(v);\n}\n\ninline Vec2 normalize(Vec2 v)\n{\n    const double len = length(v);\n    return len == 0 ? v : v / len;\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "03-vectors#Step 3 \u2014 What dot and cross mean: your tests": {
    "wrong": [
      {
        "name": "compared a cosine with CHECK_EQ",
        "files": {
          "raster/tests/vec_own_test.cpp": "// My tests for vec.h.\n#include \"studio_test.hpp\"\n\n#include \"vec.h\"\n\nTEST(dot_of_a_vector_with_itself_is_its_length_squared)\n{\n    const Vec3 v{2, 3, 6};\n    CHECK_EQ(dot(v, v), 49.0);\n    CHECK_EQ(length(v), 7.0);\n}\n\nTEST(cross_is_perpendicular_to_both_inputs)\n{\n    const Vec3 a{1, 2, 3};\n    const Vec3 b{-2, 0, 5};\n    const Vec3 c = cross(a, b);\n    CHECK_EQ(dot(c, a), 0.0);\n    CHECK_EQ(dot(c, b), 0.0);\n}\n\nTEST(dot_of_unit_vectors_is_the_cosine_of_their_angle)\n{\n    const Vec3 a = normalize(Vec3{1, 0, 0});\n    const Vec3 b = normalize(Vec3{1, 1, 0});   // 45 degrees away\n    CHECK_EQ(dot(a, b), 0.7071);\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          2,
          4,
        ],
      },
    ],
  },
  "03-vectors#Step 4 \u2014 Light a sphere with one dot product": {
    "wrong": [
      {
        "name": "did not flip y",
        "files": {
          "raster/apps/sphere.cpp": "// sphere.cpp: a lit sphere, shaded with one dot product per pixel.\n#include <algorithm>\n#include <cmath>\n#include <cstdint>\n#include <filesystem>\n#include <iostream>\n\n#include \"bmp.h\"\n#include \"image.h\"\n#include \"vec.h\"\n\n// 0.0 to 1.0 becomes 0 to 255, rounded to the nearest.\nstd::uint8_t to_byte(double v)\n{\n    v = std::clamp(v, 0.0, 1.0);\n    return static_cast<std::uint8_t>(v * 255 + 0.5);\n}\n\nint main()\n{\n    const int size = 64;\n    const double radius = 28;\n    const Vec2 centre{32, 32};\n    // Towards the light: up, left, and towards the viewer.\n    const Vec3 to_light = normalize(Vec3{-1, 1, 1});\n\n    Image img(size, size);\n    for (int y = 0; y < size; ++y) {\n        for (int x = 0; x < size; ++x) {\n            // The middle of the pixel, relative to the centre, in\n            // radii, with y flipped to point up.\n            const Vec2 p{(x + 0.5 - centre.x) / radius,\n                         (y + 0.5 - centre.y) / radius};\n            const double d2 = dot(p, p);\n            if (d2 > 1)\n                continue;   // outside the sphere: leave it black\n            // On a sphere the normal is the point itself:\n            // x and y from the pixel, z so that its length is 1.\n            const Vec3 normal{p.x, p.y, std::sqrt(1 - d2)};\n            const double lambert = std::max(0.0, dot(normal, to_light));\n            const double light = 0.2 + 0.8 * lambert;\n            img.set(x, y, Color{to_byte(light), to_byte(light * 0.6),\n                                to_byte(light * 0.2)});\n        }\n    }\n    std::filesystem::create_directories(\"images\");\n    write_bmp(img, \"images/sphere.bmp\");\n    std::cout << \"wrote images/sphere.bmp\\n\";\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          3,
        ],
      },
    ],
  },
  "04-lines-and-triangles#Step 1 \u2014 The specification for lines": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-lines-and-triangles#Step 2 \u2014 A first attempt": {
    "wrong": [
      {
        "name": "did not create it",
        "run": [
          configure("raster"),
        ],
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "04-lines-and-triangles#Step 3 \u2014 Bresenham's line algorithm": {
    "wrong": [
      {
        "name": "kept the one-pixel-per-column loop",
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "04-lines-and-triangles#Step 4 \u2014 The specification for triangles": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-lines-and-triangles#Step 5 \u2014 Edge functions": {
    "wrong": [
      {
        "name": "tested the pixel's corner, not its centre",
        "files": {
          "raster/draw.h": "// draw.h: lines and filled triangles.\n#pragma once\n\n#include <algorithm>\n#include <cmath>\n#include <cstdlib>\n#include <utility>\n\n#include \"image.h\"\n#include \"vec.h\"\n\n// Bresenham's line algorithm: whole numbers only. Each step moves one\n// pixel along x, along y, or both, choosing whichever keeps the\n// pixel closest to the true line. Both end points are drawn.\ninline void draw_line(Image& img, int x0, int y0, int x1, int y1,\n                      Color c)\n{\n    const int dx = std::abs(x1 - x0);\n    const int dy = -std::abs(y1 - y0);\n    const int step_x = x0 < x1 ? 1 : -1;\n    const int step_y = y0 < y1 ? 1 : -1;\n    int err = dx + dy;   // how far off the line the next pixel is\n    while (true) {\n        img.set(x0, y0, c);\n        if (x0 == x1 && y0 == y1)\n            break;\n        const int e2 = 2 * err;\n        if (e2 >= dy) {   // moving along x keeps us closer\n            err += dy;\n            x0 += step_x;\n        }\n        if (e2 <= dx) {   // moving along y keeps us closer\n            err += dx;\n            y0 += step_y;\n        }\n    }\n}\n\n// The edge function: positive when p is on one side of the line\n// from a to b, negative on the other side, and 0 on the line.\n// Its size is twice the area of the triangle a, b, p.\ninline double edge(Vec2 a, Vec2 b, Vec2 p)\n{\n    return cross(b - a, p - a);\n}\n\n// Fills every pixel whose CENTRE is inside the triangle a, b, c.\ninline void fill_triangle(Image& img, Vec2 a, Vec2 b, Vec2 c,\n                          Color col)\n{\n    if (edge(a, b, c) < 0)\n        std::swap(b, c);   // one winding order: inside is positive\n    if (edge(a, b, c) == 0)\n        return;            // a flat triangle has no inside\n\n    // Only pixels inside the bounding box can be inside the triangle.\n    const double left = std::min({a.x, b.x, c.x});\n    const double right = std::max({a.x, b.x, c.x});\n    const double top = std::min({a.y, b.y, c.y});\n    const double bottom = std::max({a.y, b.y, c.y});\n    const int min_x = std::max(0, int(std::floor(left)));\n    const int max_x = std::min(img.width() - 1, int(std::ceil(right)));\n    const int min_y = std::max(0, int(std::floor(top)));\n    const int max_y = std::min(img.height() - 1, int(std::ceil(bottom)));\n\n    for (int y = min_y; y <= max_y; ++y) {\n        for (int x = min_x; x <= max_x; ++x) {\n            const Vec2 p{double(x), double(y)};   // the pixel's centre\n            const double w0 = edge(b, c, p);\n            const double w1 = edge(c, a, p);\n            const double w2 = edge(a, b, p);\n            if (w0 >= 0 && w1 >= 0 && w2 >= 0)\n                img.set(x, y, col);\n        }\n    }\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
      {
        "name": "did not handle the other winding order",
        "files": {
          "raster/draw.h": "// draw.h: lines and filled triangles.\n#pragma once\n\n#include <algorithm>\n#include <cmath>\n#include <cstdlib>\n#include <utility>\n\n#include \"image.h\"\n#include \"vec.h\"\n\n// Bresenham's line algorithm: whole numbers only. Each step moves one\n// pixel along x, along y, or both, choosing whichever keeps the\n// pixel closest to the true line. Both end points are drawn.\ninline void draw_line(Image& img, int x0, int y0, int x1, int y1,\n                      Color c)\n{\n    const int dx = std::abs(x1 - x0);\n    const int dy = -std::abs(y1 - y0);\n    const int step_x = x0 < x1 ? 1 : -1;\n    const int step_y = y0 < y1 ? 1 : -1;\n    int err = dx + dy;   // how far off the line the next pixel is\n    while (true) {\n        img.set(x0, y0, c);\n        if (x0 == x1 && y0 == y1)\n            break;\n        const int e2 = 2 * err;\n        if (e2 >= dy) {   // moving along x keeps us closer\n            err += dy;\n            x0 += step_x;\n        }\n        if (e2 <= dx) {   // moving along y keeps us closer\n            err += dx;\n            y0 += step_y;\n        }\n    }\n}\n\n// The edge function: positive when p is on one side of the line\n// from a to b, negative on the other side, and 0 on the line.\n// Its size is twice the area of the triangle a, b, p.\ninline double edge(Vec2 a, Vec2 b, Vec2 p)\n{\n    return cross(b - a, p - a);\n}\n\n// Fills every pixel whose CENTRE is inside the triangle a, b, c.\ninline void fill_triangle(Image& img, Vec2 a, Vec2 b, Vec2 c,\n                          Color col)\n{\n    if (edge(a, b, c) == 0)\n        return;            // a flat triangle has no inside\n\n    // Only pixels inside the bounding box can be inside the triangle.\n    const double left = std::min({a.x, b.x, c.x});\n    const double right = std::max({a.x, b.x, c.x});\n    const double top = std::min({a.y, b.y, c.y});\n    const double bottom = std::max({a.y, b.y, c.y});\n    const int min_x = std::max(0, int(std::floor(left)));\n    const int max_x = std::min(img.width() - 1, int(std::ceil(right)));\n    const int min_y = std::max(0, int(std::floor(top)));\n    const int max_y = std::min(img.height() - 1, int(std::ceil(bottom)));\n\n    for (int y = min_y; y <= max_y; ++y) {\n        for (int x = min_x; x <= max_x; ++x) {\n            const Vec2 p{x + 0.5, y + 0.5};   // the pixel's centre\n            const double w0 = edge(b, c, p);\n            const double w1 = edge(c, a, p);\n            const double w2 = edge(a, b, p);\n            if (w0 >= 0 && w1 >= 0 && w2 >= 0)\n                img.set(x, y, col);\n        }\n    }\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "04-lines-and-triangles#Step 6 \u2014 Two triangles, one edge": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-lines-and-triangles#Step 7 \u2014 The top-left rule": {
    "wrong": [
      {
        "name": "used w > 0 for every edge",
        "files": {
          "raster/draw.h": "// draw.h: lines and filled triangles.\n#pragma once\n\n#include <algorithm>\n#include <cmath>\n#include <cstdlib>\n#include <utility>\n\n#include \"image.h\"\n#include \"vec.h\"\n\n// Bresenham's line algorithm: whole numbers only. Each step moves one\n// pixel along x, along y, or both, choosing whichever keeps the\n// pixel closest to the true line. Both end points are drawn.\ninline void draw_line(Image& img, int x0, int y0, int x1, int y1,\n                      Color c)\n{\n    const int dx = std::abs(x1 - x0);\n    const int dy = -std::abs(y1 - y0);\n    const int step_x = x0 < x1 ? 1 : -1;\n    const int step_y = y0 < y1 ? 1 : -1;\n    int err = dx + dy;   // how far off the line the next pixel is\n    while (true) {\n        img.set(x0, y0, c);\n        if (x0 == x1 && y0 == y1)\n            break;\n        const int e2 = 2 * err;\n        if (e2 >= dy) {   // moving along x keeps us closer\n            err += dy;\n            x0 += step_x;\n        }\n        if (e2 <= dx) {   // moving along y keeps us closer\n            err += dx;\n            y0 += step_y;\n        }\n    }\n}\n\n// The edge function: positive when p is on one side of the line\n// from a to b, negative on the other side, and 0 on the line.\n// Its size is twice the area of the triangle a, b, p.\ninline double edge(Vec2 a, Vec2 b, Vec2 p)\n{\n    return cross(b - a, p - a);\n}\n\n// The top-left rule. A pixel centre exactly on an edge shared by two\n// triangles must belong to exactly one of them. It belongs to the\n// triangle for which the edge is a TOP edge (horizontal, with the\n// inside below it) or a LEFT edge (the inside to its right). With\n// inside positive and y down, those are the edges going right along\n// a horizontal line, or going up.\ninline bool is_top_left(Vec2 from, Vec2 to)\n{\n    const Vec2 d = to - from;\n    return (d.y == 0 && d.x > 0) || d.y < 0;\n}\n\ninline bool covers(double w, bool top_left)\n{\n    return w > 0;\n}\n\n// Fills every pixel whose CENTRE is inside the triangle a, b, c.\ninline void fill_triangle(Image& img, Vec2 a, Vec2 b, Vec2 c,\n                          Color col)\n{\n    if (edge(a, b, c) < 0)\n        std::swap(b, c);   // one winding order: inside is positive\n    if (edge(a, b, c) == 0)\n        return;            // a flat triangle has no inside\n\n    const bool top_left0 = is_top_left(b, c);\n    const bool top_left1 = is_top_left(c, a);\n    const bool top_left2 = is_top_left(a, b);\n\n    // Only pixels inside the bounding box can be inside the triangle.\n    const double left = std::min({a.x, b.x, c.x});\n    const double right = std::max({a.x, b.x, c.x});\n    const double top = std::min({a.y, b.y, c.y});\n    const double bottom = std::max({a.y, b.y, c.y});\n    const int min_x = std::max(0, int(std::floor(left)));\n    const int max_x = std::min(img.width() - 1, int(std::ceil(right)));\n    const int min_y = std::max(0, int(std::floor(top)));\n    const int max_y = std::min(img.height() - 1, int(std::ceil(bottom)));\n\n    for (int y = min_y; y <= max_y; ++y) {\n        for (int x = min_x; x <= max_x; ++x) {\n            const Vec2 p{x + 0.5, y + 0.5};   // the pixel's centre\n            const double w0 = edge(b, c, p);\n            const double w1 = edge(c, a, p);\n            const double w2 = edge(a, b, p);\n            if (covers(w0, top_left0) && covers(w1, top_left1) &&\n                covers(w2, top_left2))\n                img.set(x, y, col);\n        }\n    }\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "04-lines-and-triangles#Step 8 \u2014 The reviewer's tests": {
    "wrong": [
      {
        "name": "top-left flags worked out before the swap",
        "typeFile": true,
        "files": {
          "raster/draw.h": "// draw.h: lines and filled triangles.\n#pragma once\n\n#include <algorithm>\n#include <cmath>\n#include <cstdlib>\n#include <utility>\n\n#include \"image.h\"\n#include \"vec.h\"\n\n// Bresenham's line algorithm: whole numbers only. Each step moves one\n// pixel along x, along y, or both, choosing whichever keeps the\n// pixel closest to the true line. Both end points are drawn.\ninline void draw_line(Image& img, int x0, int y0, int x1, int y1,\n                      Color c)\n{\n    const int dx = std::abs(x1 - x0);\n    const int dy = -std::abs(y1 - y0);\n    const int step_x = x0 < x1 ? 1 : -1;\n    const int step_y = y0 < y1 ? 1 : -1;\n    int err = dx + dy;   // how far off the line the next pixel is\n    while (true) {\n        img.set(x0, y0, c);\n        if (x0 == x1 && y0 == y1)\n            break;\n        const int e2 = 2 * err;\n        if (e2 >= dy) {   // moving along x keeps us closer\n            err += dy;\n            x0 += step_x;\n        }\n        if (e2 <= dx) {   // moving along y keeps us closer\n            err += dx;\n            y0 += step_y;\n        }\n    }\n}\n\n// The edge function: positive when p is on one side of the line\n// from a to b, negative on the other side, and 0 on the line.\n// Its size is twice the area of the triangle a, b, p.\ninline double edge(Vec2 a, Vec2 b, Vec2 p)\n{\n    return cross(b - a, p - a);\n}\n\n// The top-left rule. A pixel centre exactly on an edge shared by two\n// triangles must belong to exactly one of them. It belongs to the\n// triangle for which the edge is a TOP edge (horizontal, with the\n// inside below it) or a LEFT edge (the inside to its right). With\n// inside positive and y down, those are the edges going right along\n// a horizontal line, or going up.\ninline bool is_top_left(Vec2 from, Vec2 to)\n{\n    const Vec2 d = to - from;\n    return (d.y == 0 && d.x > 0) || d.y < 0;\n}\n\ninline bool covers(double w, bool top_left)\n{\n    return w > 0 || (w == 0 && top_left);\n}\n\n// Fills every pixel whose CENTRE is inside the triangle a, b, c.\ninline void fill_triangle(Image& img, Vec2 a, Vec2 b, Vec2 c,\n                          Color col)\n{\n    const bool top_left0 = is_top_left(b, c);\n    const bool top_left1 = is_top_left(c, a);\n    const bool top_left2 = is_top_left(a, b);\n    if (edge(a, b, c) < 0)\n        std::swap(b, c);   // one winding order: inside is positive\n    if (edge(a, b, c) == 0)\n        return;            // a flat triangle has no inside\n\n    // Only pixels inside the bounding box can be inside the triangle.\n    const double left = std::min({a.x, b.x, c.x});\n    const double right = std::max({a.x, b.x, c.x});\n    const double top = std::min({a.y, b.y, c.y});\n    const double bottom = std::max({a.y, b.y, c.y});\n    const int min_x = std::max(0, int(std::floor(left)));\n    const int max_x = std::min(img.width() - 1, int(std::ceil(right)));\n    const int min_y = std::max(0, int(std::floor(top)));\n    const int max_y = std::min(img.height() - 1, int(std::ceil(bottom)));\n\n    for (int y = min_y; y <= max_y; ++y) {\n        for (int x = min_x; x <= max_x; ++x) {\n            const Vec2 p{x + 0.5, y + 0.5};   // the pixel's centre\n            const double w0 = edge(b, c, p);\n            const double w1 = edge(c, a, p);\n            const double w2 = edge(a, b, p);\n            if (covers(w0, top_left0) && covers(w1, top_left1) &&\n                covers(w2, top_left2))\n                img.set(x, y, col);\n        }\n    }\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "04-lines-and-triangles#Step 9 \u2014 Draw a picture": {
    "wrong": [
      {
        "name": "did not save the image",
        "files": {
          "raster/apps/shapes.cpp": "// shapes.cpp: a picture made of triangles and lines.\n#include <cmath>\n#include <filesystem>\n#include <iostream>\n\n#include \"bmp.h\"\n#include \"draw.h\"\n#include \"image.h\"\n#include \"vec.h\"\n\n// A rectangle is two triangles that share a diagonal.\nvoid fill_rect(Image& img, Vec2 top_left, Vec2 bottom_right, Color c)\n{\n    const Vec2 top_right{bottom_right.x, top_left.y};\n    const Vec2 bottom_left{top_left.x, bottom_right.y};\n    fill_triangle(img, top_left, top_right, bottom_right, c);\n    fill_triangle(img, top_left, bottom_right, bottom_left, c);\n}\n\nint main()\n{\n    Image img(200, 150, Color{135, 206, 235});                // sky\n    fill_rect(img, {0, 110}, {200, 150}, Color{60, 160, 60});  // grass\n    fill_rect(img, {60, 70}, {140, 110}, Color{230, 200, 160});\n    fill_triangle(img, {50, 70}, {150, 70}, {100, 30},\n                  Color{180, 40, 40});                         // roof\n    fill_rect(img, {90, 85}, {110, 110}, Color{110, 70, 40});  // door\n\n    // The sun: 12 rays, as lines from its centre.\n    const Color yellow{255, 220, 0};\n    for (int i = 0; i < 12; ++i) {\n        const double angle = i * 3.14159265358979 / 6;\n        const int x = 170 + int(std::lround(18 * std::cos(angle)));\n        const int y = 25 + int(std::lround(18 * std::sin(angle)));\n        draw_line(img, 170, 25, x, y, yellow);\n    }\n\n    std::filesystem::create_directories(\"images\");\n    std::cout << \"wrote images/shapes.bmp\\n\";\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          4,
        ],
      },
    ],
  },
  "05-transforms#Step 1 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-transforms#Step 2 \u2014 Mat3": {
    "wrong": [
      {
        "name": "rotated clockwise",
        "files": {
          "raster/mat.h": "// mat.h: matrices for 2D and 3D transforms.\n#pragma once\n\n#include <cmath>\n#include <ostream>\n\n#include \"vec.h\"\n\n// A 3 x 3 matrix for 2D transforms, in homogeneous coordinates: the\n// point (x, y) is the column (x, y, 1). m[row][column].\nstruct Mat3 {\n    double m[3][3] = {{1, 0, 0}, {0, 1, 0}, {0, 0, 1}};   // identity\n\n    bool operator==(const Mat3&) const = default;\n};\n\ninline Mat3 operator*(const Mat3& a, const Mat3& b)\n{\n    Mat3 r;\n    for (int i = 0; i < 3; ++i) {\n        for (int j = 0; j < 3; ++j) {\n            r.m[i][j] = 0;\n            for (int k = 0; k < 3; ++k)\n                r.m[i][j] += a.m[i][k] * b.m[k][j];\n        }\n    }\n    return r;\n}\n\ninline std::ostream& operator<<(std::ostream& out, const Mat3& a)\n{\n    for (int i = 0; i < 3; ++i)\n        out << '\\n' << a.m[i][0] << ' ' << a.m[i][1] << ' ' << a.m[i][2];\n    return out;\n}\n\n// A point has w = 1, so the matrix's last column (the translation)\n// moves it.\ninline Vec2 transform_point(const Mat3& a, Vec2 p)\n{\n    return {a.m[0][0] * p.x + a.m[0][1] * p.y + a.m[0][2],\n            a.m[1][0] * p.x + a.m[1][1] * p.y + a.m[1][2]};\n}\n\n// A direction has w = 0: translation doesn't change it.\ninline Vec2 transform_vector(const Mat3& a, Vec2 v)\n{\n    return {a.m[0][0] * v.x + a.m[0][1] * v.y,\n            a.m[1][0] * v.x + a.m[1][1] * v.y};\n}\n\ninline Mat3 translate(Vec2 t)\n{\n    Mat3 r;\n    r.m[0][2] = t.x;\n    r.m[1][2] = t.y;\n    return r;\n}\n\ninline Mat3 scale(Vec2 s)\n{\n    Mat3 r;\n    r.m[0][0] = s.x;\n    r.m[1][1] = s.y;\n    return r;\n}\n\n// Anticlockwise by `radians`, with y pointing up.\ninline Mat3 rotate(double radians)\n{\n    const double c = std::cos(radians);\n    const double s = std::sin(radians);\n    Mat3 r;\n    r.m[0][0] = c;\n    r.m[0][1] = s;\n    r.m[1][0] = -s;\n    r.m[1][1] = c;\n    return r;\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
      {
        "name": "multiplied column by row",
        "files": {
          "raster/mat.h": "// mat.h: matrices for 2D and 3D transforms.\n#pragma once\n\n#include <cmath>\n#include <ostream>\n\n#include \"vec.h\"\n\n// A 3 x 3 matrix for 2D transforms, in homogeneous coordinates: the\n// point (x, y) is the column (x, y, 1). m[row][column].\nstruct Mat3 {\n    double m[3][3] = {{1, 0, 0}, {0, 1, 0}, {0, 0, 1}};   // identity\n\n    bool operator==(const Mat3&) const = default;\n};\n\ninline Mat3 operator*(const Mat3& a, const Mat3& b)\n{\n    Mat3 r;\n    for (int i = 0; i < 3; ++i) {\n        for (int j = 0; j < 3; ++j) {\n            r.m[i][j] = 0;\n            for (int k = 0; k < 3; ++k)\n                r.m[i][j] += a.m[k][j] * b.m[i][k];\n        }\n    }\n    return r;\n}\n\ninline std::ostream& operator<<(std::ostream& out, const Mat3& a)\n{\n    for (int i = 0; i < 3; ++i)\n        out << '\\n' << a.m[i][0] << ' ' << a.m[i][1] << ' ' << a.m[i][2];\n    return out;\n}\n\n// A point has w = 1, so the matrix's last column (the translation)\n// moves it.\ninline Vec2 transform_point(const Mat3& a, Vec2 p)\n{\n    return {a.m[0][0] * p.x + a.m[0][1] * p.y + a.m[0][2],\n            a.m[1][0] * p.x + a.m[1][1] * p.y + a.m[1][2]};\n}\n\n// A direction has w = 0: translation doesn't change it.\ninline Vec2 transform_vector(const Mat3& a, Vec2 v)\n{\n    return {a.m[0][0] * v.x + a.m[0][1] * v.y,\n            a.m[1][0] * v.x + a.m[1][1] * v.y};\n}\n\ninline Mat3 translate(Vec2 t)\n{\n    Mat3 r;\n    r.m[0][2] = t.x;\n    r.m[1][2] = t.y;\n    return r;\n}\n\ninline Mat3 scale(Vec2 s)\n{\n    Mat3 r;\n    r.m[0][0] = s.x;\n    r.m[1][1] = s.y;\n    return r;\n}\n\n// Anticlockwise by `radians`, with y pointing up.\ninline Mat3 rotate(double radians)\n{\n    const double c = std::cos(radians);\n    const double s = std::sin(radians);\n    Mat3 r;\n    r.m[0][0] = c;\n    r.m[0][1] = -s;\n    r.m[1][0] = s;\n    r.m[1][1] = c;\n    return r;\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "05-transforms#Step 3 \u2014 Predict: does the order matter?": {
    "wrong": [
      {
        "name": "did not create it",
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
          2,
        ],
      },
    ],
  },
  "05-transforms#Step 4 \u2014 Your tests: transforms that undo and pivot": {
    "wrong": [
      {
        "name": "scaled about the origin only",
        "files": {
          "raster/tests/transform_own_test.cpp": "// My tests for the 2D transforms.\n#include \"studio_test.hpp\"\n\n#include \"mat.h\"\n#include \"vec.h\"\n\nTEST(scale_doubles_lengths)\n{\n    const Mat3 m = scale(Vec2{2, 2});\n    CHECK_EQ(transform_point(m, Vec2{3, 4}), (Vec2{6, 8}));\n}\n\nTEST(rotating_back_undoes_a_rotation)\n{\n    const Mat3 m = rotate(-0.5) * rotate(0.5);\n    const Vec2 v = transform_point(m, Vec2{2, 3});\n    CHECK_NEAR(v.x, 2.0, 1e-12);\n    CHECK_NEAR(v.y, 3.0, 1e-12);\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "05-transforms#Step 5 \u2014 One shape, twelve transforms": {
    "wrong": [
      {
        "name": "placed, then rotated",
        "files": {
          "raster/apps/clock.cpp": "// clock.cpp: one tick-mark shape, drawn 12 times with 12 transforms.\n#include <filesystem>\n#include <iostream>\n#include <numbers>\n\n#include \"bmp.h\"\n#include \"draw.h\"\n#include \"image.h\"\n#include \"mat.h\"\n#include \"vec.h\"\n\n// Draws a triangle given in clock coordinates (the centre is the\n// origin, y points up), transformed by m.\nvoid fill_shape(Image& img, const Mat3& m, Vec2 a, Vec2 b, Vec2 c,\n                Color col)\n{\n    fill_triangle(img, transform_point(m, a), transform_point(m, b),\n                  transform_point(m, c), col);\n}\n\nint main()\n{\n    Image img(200, 200, colors::white);\n    const double turn = 2 * std::numbers::pi;\n\n    // From clock coordinates to pixels: flip y to point down, then\n    // move the origin to the image's centre.\n    const Mat3 to_pixels = translate(Vec2{100, 100}) * scale(Vec2{1, -1});\n\n    for (int hour = 0; hour < 12; ++hour) {\n        // Clockwise, so a NEGATIVE angle; rotate first, then place.\n        const Mat3 m = rotate(-hour * turn / 12) * to_pixels;\n        fill_shape(img, m, {-3, 80}, {3, 80}, {0, 95}, colors::black);\n    }\n\n    // The hands at ten past ten.\n    const double hours = 10 + 10.0 / 60;\n    const Mat3 hour_hand = to_pixels * rotate(-hours * turn / 12);\n    fill_shape(img, hour_hand, {-4, 0}, {4, 0}, {0, 50}, colors::black);\n    const Mat3 minute_hand = to_pixels * rotate(-10.0 / 60 * turn);\n    fill_shape(img, minute_hand, {-3, 0}, {3, 0}, {0, 75}, colors::red);\n\n    std::filesystem::create_directories(\"images\");\n    write_bmp(img, \"images/clock.bmp\");\n    std::cout << \"wrote images/clock.bmp\\n\";\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          3,
        ],
      },
    ],
  },
  "06-3d-projection#Step 1 \u2014 The specification for Mat4": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-3d-projection#Step 2 \u2014 Vec4 and Mat4": {
    "wrong": [
      {
        "name": "rotate_y with the signs swapped",
        "files": {
          "raster/mat.h": "// mat.h: matrices for 2D and 3D transforms.\n#pragma once\n\n#include <cmath>\n#include <ostream>\n\n#include \"vec.h\"\n\n// A 3 x 3 matrix for 2D transforms, in homogeneous coordinates: the\n// point (x, y) is the column (x, y, 1). m[row][column].\nstruct Mat3 {\n    double m[3][3] = {{1, 0, 0}, {0, 1, 0}, {0, 0, 1}};   // identity\n\n    bool operator==(const Mat3&) const = default;\n};\n\ninline Mat3 operator*(const Mat3& a, const Mat3& b)\n{\n    Mat3 r;\n    for (int i = 0; i < 3; ++i) {\n        for (int j = 0; j < 3; ++j) {\n            r.m[i][j] = 0;\n            for (int k = 0; k < 3; ++k)\n                r.m[i][j] += a.m[i][k] * b.m[k][j];\n        }\n    }\n    return r;\n}\n\ninline std::ostream& operator<<(std::ostream& out, const Mat3& a)\n{\n    for (int i = 0; i < 3; ++i)\n        out << '\\n' << a.m[i][0] << ' ' << a.m[i][1] << ' ' << a.m[i][2];\n    return out;\n}\n\n// A point has w = 1, so the matrix's last column (the translation)\n// moves it.\ninline Vec2 transform_point(const Mat3& a, Vec2 p)\n{\n    return {a.m[0][0] * p.x + a.m[0][1] * p.y + a.m[0][2],\n            a.m[1][0] * p.x + a.m[1][1] * p.y + a.m[1][2]};\n}\n\n// A direction has w = 0: translation doesn't change it.\ninline Vec2 transform_vector(const Mat3& a, Vec2 v)\n{\n    return {a.m[0][0] * v.x + a.m[0][1] * v.y,\n            a.m[1][0] * v.x + a.m[1][1] * v.y};\n}\n\ninline Mat3 translate(Vec2 t)\n{\n    Mat3 r;\n    r.m[0][2] = t.x;\n    r.m[1][2] = t.y;\n    return r;\n}\n\ninline Mat3 scale(Vec2 s)\n{\n    Mat3 r;\n    r.m[0][0] = s.x;\n    r.m[1][1] = s.y;\n    return r;\n}\n\n// Anticlockwise by `radians`, with y pointing up.\ninline Mat3 rotate(double radians)\n{\n    const double c = std::cos(radians);\n    const double s = std::sin(radians);\n    Mat3 r;\n    r.m[0][0] = c;\n    r.m[0][1] = -s;\n    r.m[1][0] = s;\n    r.m[1][1] = c;\n    return r;\n}\n\n// ── 3D ──────────────────────────────────────────────────────────────\n\n// A point or direction in homogeneous coordinates: w = 1 for a point,\n// w = 0 for a direction. After a projection, w can be anything.\nstruct Vec4 {\n    double x = 0;\n    double y = 0;\n    double z = 0;\n    double w = 0;\n\n    bool operator==(const Vec4&) const = default;\n};\n\ninline std::ostream& operator<<(std::ostream& out, Vec4 v)\n{\n    return out << '(' << v.x << \", \" << v.y << \", \" << v.z << \", \" << v.w\n               << ')';\n}\n\n// A 4 x 4 matrix for 3D transforms. m[row][column].\nstruct Mat4 {\n    double m[4][4] = {\n        {1, 0, 0, 0}, {0, 1, 0, 0}, {0, 0, 1, 0}, {0, 0, 0, 1}};\n\n    bool operator==(const Mat4&) const = default;\n};\n\ninline Mat4 operator*(const Mat4& a, const Mat4& b)\n{\n    Mat4 r;\n    for (int i = 0; i < 4; ++i) {\n        for (int j = 0; j < 4; ++j) {\n            r.m[i][j] = 0;\n            for (int k = 0; k < 4; ++k)\n                r.m[i][j] += a.m[i][k] * b.m[k][j];\n        }\n    }\n    return r;\n}\n\ninline std::ostream& operator<<(std::ostream& out, const Mat4& a)\n{\n    for (int i = 0; i < 4; ++i)\n        out << '\\n' << a.m[i][0] << ' ' << a.m[i][1] << ' ' << a.m[i][2]\n            << ' ' << a.m[i][3];\n    return out;\n}\n\ninline Vec4 operator*(const Mat4& a, Vec4 v)\n{\n    double r[4];\n    for (int i = 0; i < 4; ++i)\n        r[i] = a.m[i][0] * v.x + a.m[i][1] * v.y + a.m[i][2] * v.z +\n               a.m[i][3] * v.w;\n    return {r[0], r[1], r[2], r[3]};\n}\n\ninline Vec3 transform_point(const Mat4& a, Vec3 p)\n{\n    const Vec4 r = a * Vec4{p.x, p.y, p.z, 1};\n    return {r.x, r.y, r.z};\n}\n\ninline Vec3 transform_vector(const Mat4& a, Vec3 v)\n{\n    const Vec4 r = a * Vec4{v.x, v.y, v.z, 0};\n    return {r.x, r.y, r.z};\n}\n\ninline Mat4 translate(Vec3 t)\n{\n    Mat4 r;\n    r.m[0][3] = t.x;\n    r.m[1][3] = t.y;\n    r.m[2][3] = t.z;\n    return r;\n}\n\ninline Mat4 scale(Vec3 s)\n{\n    Mat4 r;\n    r.m[0][0] = s.x;\n    r.m[1][1] = s.y;\n    r.m[2][2] = s.z;\n    return r;\n}\n\n// Rotations about each axis, anticlockwise when you look along the\n// axis towards the origin (the right-hand rule).\ninline Mat4 rotate_x(double radians)\n{\n    const double c = std::cos(radians), s = std::sin(radians);\n    Mat4 r;\n    r.m[1][1] = c;\n    r.m[1][2] = -s;\n    r.m[2][1] = s;\n    r.m[2][2] = c;\n    return r;\n}\n\ninline Mat4 rotate_y(double radians)\n{\n    const double c = std::cos(radians), s = std::sin(radians);\n    Mat4 r;\n    r.m[0][0] = c;\n    r.m[0][2] = -s;\n    r.m[2][0] = s;\n    r.m[2][2] = c;\n    return r;\n}\n\ninline Mat4 rotate_z(double radians)\n{\n    const double c = std::cos(radians), s = std::sin(radians);\n    Mat4 r;\n    r.m[0][0] = c;\n    r.m[0][1] = -s;\n    r.m[1][0] = s;\n    r.m[1][1] = c;\n    return r;\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "06-3d-projection#Step 3 \u2014 The specification for the camera": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-3d-projection#Step 4 \u2014 Perspective, one division": {
    "wrong": [
      {
        "name": "w = z instead of -z",
        "files": {
          "raster/camera.h": "// camera.h: from 3D world coordinates to pixels.\n#pragma once\n\n#include <cmath>\n\n#include \"mat.h\"\n#include \"vec.h\"\n\n// The view matrix: moves the world so the camera sits at the origin,\n// looking down -z, with y up. (Moving the camera right is the same as\n// moving the whole world left.)\ninline Mat4 look_at(Vec3 eye, Vec3 target, Vec3 up)\n{\n    const Vec3 forward = normalize(target - eye);\n    const Vec3 right = normalize(cross(forward, up));\n    const Vec3 camera_up = cross(right, forward);\n    Mat4 r;\n    r.m[0][0] = right.x;\n    r.m[0][1] = right.y;\n    r.m[0][2] = right.z;\n    r.m[0][3] = -dot(right, eye);\n    r.m[1][0] = camera_up.x;\n    r.m[1][1] = camera_up.y;\n    r.m[1][2] = camera_up.z;\n    r.m[1][3] = -dot(camera_up, eye);\n    r.m[2][0] = -forward.x;\n    r.m[2][1] = -forward.y;\n    r.m[2][2] = -forward.z;\n    r.m[2][3] = dot(forward, eye);\n    return r;\n}\n\n// The projection matrix (OpenGL's convention). It maps the visible\n// frustum to the cube -1..1 on every axis AFTER dividing by w, and it\n// sets w = -z: the distance in front of the camera.\ninline Mat4 perspective(double fov_y, double aspect, double near,\n                        double far)\n{\n    const double f = 1 / std::tan(fov_y / 2);\n    Mat4 r;\n    r.m[0][0] = f / aspect;\n    r.m[1][1] = f;\n    r.m[2][2] = (far + near) / (near - far);\n    r.m[2][3] = 2 * far * near / (near - far);\n    r.m[3][2] = 1;\n    r.m[3][3] = 0;\n    return r;\n}\n\n// Clip space to normalised device coordinates (NDC): divide by w.\n// This one division is what makes far things small.\ninline Vec3 perspective_divide(Vec4 clip)\n{\n    return {clip.x / clip.w, clip.y / clip.w, clip.z / clip.w};\n}\n\n// NDC to pixels: x from -1..1 to 0..width, y from 1..-1 (up) to\n// 0..height (down). z (-1 near, 1 far) is kept, for depth.\ninline Vec3 viewport(Vec3 ndc, int width, int height)\n{\n    return {(ndc.x + 1) / 2 * width, (1 - ndc.y) / 2 * height, ndc.z};\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
      {
        "name": "did not flip y in the viewport",
        "files": {
          "raster/camera.h": "// camera.h: from 3D world coordinates to pixels.\n#pragma once\n\n#include <cmath>\n\n#include \"mat.h\"\n#include \"vec.h\"\n\n// The view matrix: moves the world so the camera sits at the origin,\n// looking down -z, with y up. (Moving the camera right is the same as\n// moving the whole world left.)\ninline Mat4 look_at(Vec3 eye, Vec3 target, Vec3 up)\n{\n    const Vec3 forward = normalize(target - eye);\n    const Vec3 right = normalize(cross(forward, up));\n    const Vec3 camera_up = cross(right, forward);\n    Mat4 r;\n    r.m[0][0] = right.x;\n    r.m[0][1] = right.y;\n    r.m[0][2] = right.z;\n    r.m[0][3] = -dot(right, eye);\n    r.m[1][0] = camera_up.x;\n    r.m[1][1] = camera_up.y;\n    r.m[1][2] = camera_up.z;\n    r.m[1][3] = -dot(camera_up, eye);\n    r.m[2][0] = -forward.x;\n    r.m[2][1] = -forward.y;\n    r.m[2][2] = -forward.z;\n    r.m[2][3] = dot(forward, eye);\n    return r;\n}\n\n// The projection matrix (OpenGL's convention). It maps the visible\n// frustum to the cube -1..1 on every axis AFTER dividing by w, and it\n// sets w = -z: the distance in front of the camera.\ninline Mat4 perspective(double fov_y, double aspect, double near,\n                        double far)\n{\n    const double f = 1 / std::tan(fov_y / 2);\n    Mat4 r;\n    r.m[0][0] = f / aspect;\n    r.m[1][1] = f;\n    r.m[2][2] = (far + near) / (near - far);\n    r.m[2][3] = 2 * far * near / (near - far);\n    r.m[3][2] = -1;\n    r.m[3][3] = 0;\n    return r;\n}\n\n// Clip space to normalised device coordinates (NDC): divide by w.\n// This one division is what makes far things small.\ninline Vec3 perspective_divide(Vec4 clip)\n{\n    return {clip.x / clip.w, clip.y / clip.w, clip.z / clip.w};\n}\n\n// NDC to pixels: x from -1..1 to 0..width, y from 1..-1 (up) to\n// 0..height (down). z (-1 near, 1 far) is kept, for depth.\ninline Vec3 viewport(Vec3 ndc, int width, int height)\n{\n    return {(ndc.x + 1) / 2 * width, (ndc.y + 1) / 2 * height, ndc.z};\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "06-3d-projection#Step 5 \u2014 A wireframe cube": {
    "wrong": [
      {
        "name": "skipped the perspective divide",
        "files": {
          "raster/apps/cube.cpp": "// cube.cpp: a wireframe cube, through model, view and projection.\n#include <cmath>\n#include <filesystem>\n#include <iostream>\n#include <numbers>\n\n#include \"bmp.h\"\n#include \"camera.h\"\n#include \"draw.h\"\n#include \"image.h\"\n#include \"mat.h\"\n#include \"vec.h\"\n\nint main()\n{\n    const int width = 200;\n    const int height = 200;\n    const double degree = std::numbers::pi / 180;\n\n    // The 8 corners of a cube from -1 to 1: bit 0 of the index picks\n    // x, bit 1 picks y, bit 2 picks z.\n    Vec3 corners[8];\n    for (int i = 0; i < 8; ++i)\n        corners[i] = {i & 1 ? 1.0 : -1.0, i & 2 ? 1.0 : -1.0,\n                      i & 4 ? 1.0 : -1.0};\n\n    const Mat4 model = rotate_y(30 * degree) * rotate_x(20 * degree);\n    const Mat4 view = look_at({0, 0, 5}, {0, 0, 0}, {0, 1, 0});\n    const Mat4 projection = perspective(60 * degree, 1.0, 0.1, 100);\n    const Mat4 mvp = projection * view * model;   // model goes first\n\n    int px[8], py[8];\n    for (int i = 0; i < 8; ++i) {\n        const Vec3& c = corners[i];\n        const Vec4 clip = mvp * Vec4{c.x, c.y, c.z, 1};\n        const Vec3 screen =\n            viewport(Vec3{clip.x, clip.y, clip.z}, width, height);\n        px[i] = static_cast<int>(std::lround(screen.x));\n        py[i] = static_cast<int>(std::lround(screen.y));\n        std::cout << \"corner \" << i << \" -> (\" << px[i] << \", \" << py[i]\n                  << \")\\n\";\n    }\n\n    // An edge joins two corners whose indices differ in one bit.\n    Image img(width, height);\n    int edges = 0;\n    for (int a = 0; a < 8; ++a) {\n        for (int bit = 1; bit < 8; bit *= 2) {\n            const int b = a ^ bit;\n            if (a < b) {\n                draw_line(img, px[a], py[a], px[b], py[b], colors::white);\n                ++edges;\n            }\n        }\n    }\n    std::cout << edges << \" edges\\n\";\n\n    std::filesystem::create_directories(\"images\");\n    write_bmp(img, \"images/cube.bmp\");\n    std::cout << \"wrote images/cube.bmp\\n\";\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
          2,
        ],
      },
      {
        "name": "multiplied the matrices in reading order",
        "files": {
          "raster/apps/cube.cpp": "// cube.cpp: a wireframe cube, through model, view and projection.\n#include <cmath>\n#include <filesystem>\n#include <iostream>\n#include <numbers>\n\n#include \"bmp.h\"\n#include \"camera.h\"\n#include \"draw.h\"\n#include \"image.h\"\n#include \"mat.h\"\n#include \"vec.h\"\n\nint main()\n{\n    const int width = 200;\n    const int height = 200;\n    const double degree = std::numbers::pi / 180;\n\n    // The 8 corners of a cube from -1 to 1: bit 0 of the index picks\n    // x, bit 1 picks y, bit 2 picks z.\n    Vec3 corners[8];\n    for (int i = 0; i < 8; ++i)\n        corners[i] = {i & 1 ? 1.0 : -1.0, i & 2 ? 1.0 : -1.0,\n                      i & 4 ? 1.0 : -1.0};\n\n    const Mat4 model = rotate_y(30 * degree) * rotate_x(20 * degree);\n    const Mat4 view = look_at({0, 0, 5}, {0, 0, 0}, {0, 1, 0});\n    const Mat4 projection = perspective(60 * degree, 1.0, 0.1, 100);\n    const Mat4 mvp = model * view * projection;   // model goes first\n\n    int px[8], py[8];\n    for (int i = 0; i < 8; ++i) {\n        const Vec3& c = corners[i];\n        const Vec4 clip = mvp * Vec4{c.x, c.y, c.z, 1};\n        const Vec3 screen =\n            viewport(perspective_divide(clip), width, height);\n        px[i] = static_cast<int>(std::lround(screen.x));\n        py[i] = static_cast<int>(std::lround(screen.y));\n        std::cout << \"corner \" << i << \" -> (\" << px[i] << \", \" << py[i]\n                  << \")\\n\";\n    }\n\n    // An edge joins two corners whose indices differ in one bit.\n    Image img(width, height);\n    int edges = 0;\n    for (int a = 0; a < 8; ++a) {\n        for (int bit = 1; bit < 8; bit *= 2) {\n            const int b = a ^ bit;\n            if (a < b) {\n                draw_line(img, px[a], py[a], px[b], py[b], colors::white);\n                ++edges;\n            }\n        }\n    }\n    std::cout << edges << \" edges\\n\";\n\n    std::filesystem::create_directories(\"images\");\n    write_bmp(img, \"images/cube.bmp\");\n    std::cout << \"wrote images/cube.bmp\\n\";\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
          2,
        ],
      },
    ],
  },
  "06-3d-projection#Step 6 \u2014 Your tests for the camera": {
    "wrong": [
      {
        "name": "stopped at NDC",
        "files": {
          "raster/tests/camera_own_test.cpp": "// My tests for the camera.\n#include \"studio_test.hpp\"\n\n#include <numbers>\n\n#include \"camera.h\"\n#include \"mat.h\"\n#include \"vec.h\"\n\nnamespace {\n\nVec3 project(Vec3 p)\n{\n    const Mat4 proj = perspective(std::numbers::pi / 2, 1, 1, 100);\n    return perspective_divide(proj * Vec4{p.x, p.y, p.z, 1});\n}\n\n} // namespace\n\nTEST(a_point_straight_ahead_lands_in_the_middle)\n{\n    const Vec3 s = project({0, 0, -10});\n    CHECK_NEAR(s.x, 50.0, 1e-9);\n    CHECK_NEAR(s.y, 50.0, 1e-9);\n}\n\nTEST(up_in_the_world_is_up_in_the_image)\n{\n    CHECK(project({0, 1, -10}).y < 50);   // smaller y: higher up\n}\n\nTEST(nearer_points_have_smaller_depth)\n{\n    CHECK(project({0, 0, -2}).z < project({0, 0, -20}).z);\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
          3,
        ],
      },
    ],
  },
  "07-depth-and-shading#Step 1 \u2014 The specification for depth": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "07-depth-and-shading#Step 2 \u2014 A colleague's depth buffer": {
    "wrong": [
      {
        "name": "did not create it",
        "run": [
          configure("raster"),
        ],
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "07-depth-and-shading#Step 3 \u2014 The depth test": {
    "wrong": [
      {
        "name": "kept the farther triangle",
        "files": {
          "raster/render.h": "// render.h: drawing with depth, so near things hide far things.\n#pragma once\n\n#include <algorithm>\n#include <cmath>\n#include <cstddef>\n#include <limits>\n#include <utility>\n#include <vector>\n\n#include \"draw.h\"\n#include \"image.h\"\n#include \"vec.h\"\n\n// A colour image plus a depth buffer: for every pixel, the depth of\n// the nearest thing drawn there so far. Smaller depth is nearer.\nstruct Framebuffer {\n    Image color;\n    std::vector<double> depth;\n\n    Framebuffer(int width, int height, Color clear = colors::black)\n        : color(width, height, clear),\n          depth(static_cast<std::size_t>(width) * height,\n                std::numeric_limits<double>::infinity())\n    {\n    }\n\n    int width() const { return color.width(); }\n    int height() const { return color.height(); }\n\n    double& depth_at(int x, int y)\n    {\n        return depth[static_cast<std::size_t>(y) * width() + x];\n    }\n};\n\n// Fills a triangle whose corners are in SCREEN space: x and y in\n// pixels, z the depth that viewport() kept. Returns how many pixels\n// it wrote.\ninline int fill_triangle_depth(Framebuffer& fb, Vec3 a, Vec3 b, Vec3 c,\n                               Color col)\n{\n    auto flat = [](Vec3 v) { return Vec2{v.x, v.y}; };\n    if (edge(flat(a), flat(b), flat(c)) < 0)\n        std::swap(b, c);\n    const double area = edge(flat(a), flat(b), flat(c));\n    if (area == 0)\n        return 0;\n\n    const bool top_left0 = is_top_left(flat(b), flat(c));\n    const bool top_left1 = is_top_left(flat(c), flat(a));\n    const bool top_left2 = is_top_left(flat(a), flat(b));\n\n    // Only pixels inside the bounding box can be inside the triangle.\n    const double left = std::min({a.x, b.x, c.x});\n    const double right = std::max({a.x, b.x, c.x});\n    const double top = std::min({a.y, b.y, c.y});\n    const double bottom = std::max({a.y, b.y, c.y});\n    const int min_x = std::max(0, int(std::floor(left)));\n    const int max_x = std::min(fb.width() - 1, int(std::ceil(right)));\n    const int min_y = std::max(0, int(std::floor(top)));\n    const int max_y = std::min(fb.height() - 1, int(std::ceil(bottom)));\n\n    int written = 0;\n    for (int y = min_y; y <= max_y; ++y) {\n        for (int x = min_x; x <= max_x; ++x) {\n            const Vec2 p{x + 0.5, y + 0.5};\n            const double w0 = edge(flat(b), flat(c), p);\n            const double w1 = edge(flat(c), flat(a), p);\n            const double w2 = edge(flat(a), flat(b), p);\n            if (!covers(w0, top_left0) || !covers(w1, top_left1) ||\n                !covers(w2, top_left2))\n                continue;\n            // Barycentric coordinates: how much of each corner is in\n            // this pixel. They add up to 1.\n            const double l0 = w0 / area;\n            const double l1 = w1 / area;\n            const double l2 = w2 / area;\n            const double z = l0 * a.z + l1 * b.z + l2 * c.z;\n            if (z <= fb.depth_at(x, y))\n                continue;   // something nearer is already there\n            fb.depth_at(x, y) = z;\n            fb.color.set(x, y, col);\n            ++written;\n        }\n    }\n    return written;\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "07-depth-and-shading#Step 4 \u2014 The specification for shading": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "07-depth-and-shading#Step 5 \u2014 Normals, light and culling": {
    "wrong": [
      {
        "name": "shade truncates instead of rounding",
        "files": {
          "raster/render.h": "// render.h: drawing with depth, so near things hide far things.\n#pragma once\n\n#include <algorithm>\n#include <cmath>\n#include <cstddef>\n#include <cstdint>\n#include <limits>\n#include <utility>\n#include <vector>\n\n#include \"draw.h\"\n#include \"image.h\"\n#include \"vec.h\"\n\n// A colour image plus a depth buffer: for every pixel, the depth of\n// the nearest thing drawn there so far. Smaller depth is nearer.\nstruct Framebuffer {\n    Image color;\n    std::vector<double> depth;\n\n    Framebuffer(int width, int height, Color clear = colors::black)\n        : color(width, height, clear),\n          depth(static_cast<std::size_t>(width) * height,\n                std::numeric_limits<double>::infinity())\n    {\n    }\n\n    int width() const { return color.width(); }\n    int height() const { return color.height(); }\n\n    double& depth_at(int x, int y)\n    {\n        return depth[static_cast<std::size_t>(y) * width() + x];\n    }\n};\n\n// Fills a triangle whose corners are in SCREEN space: x and y in\n// pixels, z the depth that viewport() kept. Returns how many pixels\n// it wrote.\ninline int fill_triangle_depth(Framebuffer& fb, Vec3 a, Vec3 b, Vec3 c,\n                               Color col)\n{\n    auto flat = [](Vec3 v) { return Vec2{v.x, v.y}; };\n    if (edge(flat(a), flat(b), flat(c)) < 0)\n        std::swap(b, c);\n    const double area = edge(flat(a), flat(b), flat(c));\n    if (area == 0)\n        return 0;\n\n    const bool top_left0 = is_top_left(flat(b), flat(c));\n    const bool top_left1 = is_top_left(flat(c), flat(a));\n    const bool top_left2 = is_top_left(flat(a), flat(b));\n\n    // Only pixels inside the bounding box can be inside the triangle.\n    const double left = std::min({a.x, b.x, c.x});\n    const double right = std::max({a.x, b.x, c.x});\n    const double top = std::min({a.y, b.y, c.y});\n    const double bottom = std::max({a.y, b.y, c.y});\n    const int min_x = std::max(0, int(std::floor(left)));\n    const int max_x = std::min(fb.width() - 1, int(std::ceil(right)));\n    const int min_y = std::max(0, int(std::floor(top)));\n    const int max_y = std::min(fb.height() - 1, int(std::ceil(bottom)));\n\n    int written = 0;\n    for (int y = min_y; y <= max_y; ++y) {\n        for (int x = min_x; x <= max_x; ++x) {\n            const Vec2 p{x + 0.5, y + 0.5};\n            const double w0 = edge(flat(b), flat(c), p);\n            const double w1 = edge(flat(c), flat(a), p);\n            const double w2 = edge(flat(a), flat(b), p);\n            if (!covers(w0, top_left0) || !covers(w1, top_left1) ||\n                !covers(w2, top_left2))\n                continue;\n            // Barycentric coordinates: how much of each corner is in\n            // this pixel. They add up to 1.\n            const double l0 = w0 / area;\n            const double l1 = w1 / area;\n            const double l2 = w2 / area;\n            const double z = l0 * a.z + l1 * b.z + l2 * c.z;\n            if (z >= fb.depth_at(x, y))\n                continue;   // something nearer is already there\n            fb.depth_at(x, y) = z;\n            fb.color.set(x, y, col);\n            ++written;\n        }\n    }\n    return written;\n}\n\n// ── Shading ─────────────────────────────────────────────────────────\n\n// The direction a triangle faces: perpendicular to two of its edges.\n// Corners in anticlockwise order, seen from the front, give a normal\n// pointing out of the front (the right-hand rule).\ninline Vec3 face_normal(Vec3 a, Vec3 b, Vec3 c)\n{\n    return normalize(cross(b - a, c - a));\n}\n\n// Lambert's law: a surface facing the light gets all of it, one at\n// an angle gets cos(angle) of it, one facing away gets none.\n// Both vectors must have length 1.\ninline double lambert(Vec3 normal, Vec3 to_light)\n{\n    return std::max(0.0, dot(normal, to_light));\n}\n\n// The colour scaled by a brightness from 0 to 1, rounded.\ninline Color shade(Color base, double brightness)\n{\n    brightness = std::clamp(brightness, 0.0, 1.0);\n    auto channel = [&](std::uint8_t v) {\n        return static_cast<std::uint8_t>(v * brightness);\n    };\n    return {channel(base.r), channel(base.g), channel(base.b)};\n}\n\n// In screen space (y down), a front face's corners go round\n// anticlockwise as you look at it, which makes edge() negative.\n// Positive: we are looking at its back. Zero: edge-on.\ninline bool is_back_facing(Vec3 a, Vec3 b, Vec3 c)\n{\n    return edge(Vec2{a.x, a.y}, Vec2{b.x, b.y}, Vec2{c.x, c.y}) >= 0;\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
      {
        "name": "normal from the edges in the wrong order",
        "files": {
          "raster/render.h": "// render.h: drawing with depth, so near things hide far things.\n#pragma once\n\n#include <algorithm>\n#include <cmath>\n#include <cstddef>\n#include <cstdint>\n#include <limits>\n#include <utility>\n#include <vector>\n\n#include \"draw.h\"\n#include \"image.h\"\n#include \"vec.h\"\n\n// A colour image plus a depth buffer: for every pixel, the depth of\n// the nearest thing drawn there so far. Smaller depth is nearer.\nstruct Framebuffer {\n    Image color;\n    std::vector<double> depth;\n\n    Framebuffer(int width, int height, Color clear = colors::black)\n        : color(width, height, clear),\n          depth(static_cast<std::size_t>(width) * height,\n                std::numeric_limits<double>::infinity())\n    {\n    }\n\n    int width() const { return color.width(); }\n    int height() const { return color.height(); }\n\n    double& depth_at(int x, int y)\n    {\n        return depth[static_cast<std::size_t>(y) * width() + x];\n    }\n};\n\n// Fills a triangle whose corners are in SCREEN space: x and y in\n// pixels, z the depth that viewport() kept. Returns how many pixels\n// it wrote.\ninline int fill_triangle_depth(Framebuffer& fb, Vec3 a, Vec3 b, Vec3 c,\n                               Color col)\n{\n    auto flat = [](Vec3 v) { return Vec2{v.x, v.y}; };\n    if (edge(flat(a), flat(b), flat(c)) < 0)\n        std::swap(b, c);\n    const double area = edge(flat(a), flat(b), flat(c));\n    if (area == 0)\n        return 0;\n\n    const bool top_left0 = is_top_left(flat(b), flat(c));\n    const bool top_left1 = is_top_left(flat(c), flat(a));\n    const bool top_left2 = is_top_left(flat(a), flat(b));\n\n    // Only pixels inside the bounding box can be inside the triangle.\n    const double left = std::min({a.x, b.x, c.x});\n    const double right = std::max({a.x, b.x, c.x});\n    const double top = std::min({a.y, b.y, c.y});\n    const double bottom = std::max({a.y, b.y, c.y});\n    const int min_x = std::max(0, int(std::floor(left)));\n    const int max_x = std::min(fb.width() - 1, int(std::ceil(right)));\n    const int min_y = std::max(0, int(std::floor(top)));\n    const int max_y = std::min(fb.height() - 1, int(std::ceil(bottom)));\n\n    int written = 0;\n    for (int y = min_y; y <= max_y; ++y) {\n        for (int x = min_x; x <= max_x; ++x) {\n            const Vec2 p{x + 0.5, y + 0.5};\n            const double w0 = edge(flat(b), flat(c), p);\n            const double w1 = edge(flat(c), flat(a), p);\n            const double w2 = edge(flat(a), flat(b), p);\n            if (!covers(w0, top_left0) || !covers(w1, top_left1) ||\n                !covers(w2, top_left2))\n                continue;\n            // Barycentric coordinates: how much of each corner is in\n            // this pixel. They add up to 1.\n            const double l0 = w0 / area;\n            const double l1 = w1 / area;\n            const double l2 = w2 / area;\n            const double z = l0 * a.z + l1 * b.z + l2 * c.z;\n            if (z >= fb.depth_at(x, y))\n                continue;   // something nearer is already there\n            fb.depth_at(x, y) = z;\n            fb.color.set(x, y, col);\n            ++written;\n        }\n    }\n    return written;\n}\n\n// ── Shading ─────────────────────────────────────────────────────────\n\n// The direction a triangle faces: perpendicular to two of its edges.\n// Corners in anticlockwise order, seen from the front, give a normal\n// pointing out of the front (the right-hand rule).\ninline Vec3 face_normal(Vec3 a, Vec3 b, Vec3 c)\n{\n    return normalize(cross(c - a, b - a));\n}\n\n// Lambert's law: a surface facing the light gets all of it, one at\n// an angle gets cos(angle) of it, one facing away gets none.\n// Both vectors must have length 1.\ninline double lambert(Vec3 normal, Vec3 to_light)\n{\n    return std::max(0.0, dot(normal, to_light));\n}\n\n// The colour scaled by a brightness from 0 to 1, rounded.\ninline Color shade(Color base, double brightness)\n{\n    brightness = std::clamp(brightness, 0.0, 1.0);\n    auto channel = [&](std::uint8_t v) {\n        return static_cast<std::uint8_t>(v * brightness + 0.5);\n    };\n    return {channel(base.r), channel(base.g), channel(base.b)};\n}\n\n// In screen space (y down), a front face's corners go round\n// anticlockwise as you look at it, which makes edge() negative.\n// Positive: we are looking at its back. Zero: edge-on.\ninline bool is_back_facing(Vec3 a, Vec3 b, Vec3 c)\n{\n    return edge(Vec2{a.x, a.y}, Vec2{b.x, b.y}, Vec2{c.x, c.y}) >= 0;\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "07-depth-and-shading#Step 6 \u2014 A solid cube": {
    "wrong": [
      {
        "name": "the light vector points away from the light",
        "files": {
          "raster/apps/solid_cube.cpp": "// solid_cube.cpp: a solid, lit cube, with a depth buffer and\n// back-face culling.\n#include <array>\n#include <filesystem>\n#include <iostream>\n#include <numbers>\n\n#include \"bmp.h\"\n#include \"camera.h\"\n#include \"image.h\"\n#include \"mat.h\"\n#include \"render.h\"\n#include \"vec.h\"\n\nint main()\n{\n    const int width = 200;\n    const int height = 200;\n    const double degree = std::numbers::pi / 180;\n\n    Vec3 corners[8];   // as in cube.cpp: bits 0, 1, 2 pick x, y, z\n    for (int i = 0; i < 8; ++i)\n        corners[i] = {i & 1 ? 1.0 : -1.0, i & 2 ? 1.0 : -1.0,\n                      i & 4 ? 1.0 : -1.0};\n\n    // Each face's corners, anticlockwise as seen from OUTSIDE the\n    // cube, so every face normal points out.\n    const int faces[6][4] = {\n        {1, 3, 7, 5},   // +x\n        {0, 4, 6, 2},   // -x\n        {6, 7, 3, 2},   // +y\n        {0, 1, 5, 4},   // -y\n        {4, 5, 7, 6},   // +z\n        {0, 2, 3, 1},   // -z\n    };\n\n    const Mat4 model = rotate_y(30 * degree) * rotate_x(20 * degree);\n    const Mat4 view = look_at({0, 0, 5}, {0, 0, 0}, {0, 1, 0});\n    const Mat4 projection = perspective(60 * degree, 1.0, 0.1, 100);\n    const Mat4 mvp = projection * view * model;\n\n    // Where each corner is in the world (for lighting) and on screen.\n    Vec3 world[8], screen[8];\n    for (int i = 0; i < 8; ++i) {\n        const Vec3& c = corners[i];\n        world[i] = transform_point(model, c);\n        screen[i] = viewport(\n            perspective_divide(mvp * Vec4{c.x, c.y, c.z, 1}), width,\n            height);\n    }\n\n    const Vec3 to_light = normalize(Vec3{1, -2, -3});\n    const Color orange{240, 140, 40};\n    Framebuffer fb(width, height, Color{30, 30, 40});\n    int drawn = 0, culled = 0;\n\n    for (const auto& f : faces) {\n        // Two triangles per face: corners 0, 1, 2 and 0, 2, 3.\n        for (const auto& t : {std::array{f[0], f[1], f[2]},\n                              std::array{f[0], f[2], f[3]}}) {\n            if (is_back_facing(screen[t[0]], screen[t[1]],\n                               screen[t[2]])) {\n                ++culled;\n                continue;\n            }\n            const Vec3 n =\n                face_normal(world[t[0]], world[t[1]], world[t[2]]);\n            const double light = 0.15 + 0.85 * lambert(n, to_light);\n            fill_triangle_depth(fb, screen[t[0]], screen[t[1]],\n                                screen[t[2]], shade(orange, light));\n            ++drawn;\n        }\n    }\n    std::cout << \"triangles drawn: \" << drawn << \", culled: \" << culled\n              << '\\n';\n\n    std::filesystem::create_directories(\"images\");\n    write_bmp(fb.color, \"images/solid_cube.bmp\");\n    std::cout << \"wrote images/solid_cube.bmp\\n\";\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          2,
          3,
          4,
        ],
      },
      {
        "name": "faces listed clockwise",
        "files": {
          "raster/apps/solid_cube.cpp": "// solid_cube.cpp: a solid, lit cube, with a depth buffer and\n// back-face culling.\n#include <array>\n#include <filesystem>\n#include <iostream>\n#include <numbers>\n\n#include \"bmp.h\"\n#include \"camera.h\"\n#include \"image.h\"\n#include \"mat.h\"\n#include \"render.h\"\n#include \"vec.h\"\n\nint main()\n{\n    const int width = 200;\n    const int height = 200;\n    const double degree = std::numbers::pi / 180;\n\n    Vec3 corners[8];   // as in cube.cpp: bits 0, 1, 2 pick x, y, z\n    for (int i = 0; i < 8; ++i)\n        corners[i] = {i & 1 ? 1.0 : -1.0, i & 2 ? 1.0 : -1.0,\n                      i & 4 ? 1.0 : -1.0};\n\n    // Each face's corners, anticlockwise as seen from OUTSIDE the\n    // cube, so every face normal points out.\n    const int faces[6][4] = {\n        {5, 7, 3, 1},   // +x\n        {2, 6, 4, 0},   // -x\n        {2, 3, 7, 6},   // +y\n        {4, 5, 1, 0},   // -y\n        {6, 7, 5, 4},   // +z\n        {1, 3, 2, 0},   // -z\n    };\n\n    const Mat4 model = rotate_y(30 * degree) * rotate_x(20 * degree);\n    const Mat4 view = look_at({0, 0, 5}, {0, 0, 0}, {0, 1, 0});\n    const Mat4 projection = perspective(60 * degree, 1.0, 0.1, 100);\n    const Mat4 mvp = projection * view * model;\n\n    // Where each corner is in the world (for lighting) and on screen.\n    Vec3 world[8], screen[8];\n    for (int i = 0; i < 8; ++i) {\n        const Vec3& c = corners[i];\n        world[i] = transform_point(model, c);\n        screen[i] = viewport(\n            perspective_divide(mvp * Vec4{c.x, c.y, c.z, 1}), width,\n            height);\n    }\n\n    const Vec3 to_light = normalize(Vec3{-1, 2, 3});\n    const Color orange{240, 140, 40};\n    Framebuffer fb(width, height, Color{30, 30, 40});\n    int drawn = 0, culled = 0;\n\n    for (const auto& f : faces) {\n        // Two triangles per face: corners 0, 1, 2 and 0, 2, 3.\n        for (const auto& t : {std::array{f[0], f[1], f[2]},\n                              std::array{f[0], f[2], f[3]}}) {\n            if (is_back_facing(screen[t[0]], screen[t[1]],\n                               screen[t[2]])) {\n                ++culled;\n                continue;\n            }\n            const Vec3 n =\n                face_normal(world[t[0]], world[t[1]], world[t[2]]);\n            const double light = 0.15 + 0.85 * lambert(n, to_light);\n            fill_triangle_depth(fb, screen[t[0]], screen[t[1]],\n                                screen[t[2]], shade(orange, light));\n            ++drawn;\n        }\n    }\n    std::cout << \"triangles drawn: \" << drawn << \", culled: \" << culled\n              << '\\n';\n\n    std::filesystem::create_directories(\"images\");\n    write_bmp(fb.color, \"images/solid_cube.bmp\");\n    std::cout << \"wrote images/solid_cube.bmp\\n\";\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "08-pipeline#Step 1 \u2014 Pull the rasterizer out": {
    "wrong": [
      {
        "name": "lost the depth test in the move",
        "files": {
          "raster/render.h": "// render.h: drawing with depth, so near things hide far things.\n#pragma once\n\n#include <algorithm>\n#include <cmath>\n#include <cstddef>\n#include <cstdint>\n#include <limits>\n#include <vector>\n\n#include \"draw.h\"\n#include \"image.h\"\n#include \"vec.h\"\n\n// A colour image plus a depth buffer: for every pixel, the depth of\n// the nearest thing drawn there so far. Smaller depth is nearer.\nstruct Framebuffer {\n    Image color;\n    std::vector<double> depth;\n\n    Framebuffer(int width, int height, Color clear = colors::black)\n        : color(width, height, clear),\n          depth(static_cast<std::size_t>(width) * height,\n                std::numeric_limits<double>::infinity())\n    {\n    }\n\n    int width() const { return color.width(); }\n    int height() const { return color.height(); }\n\n    double& depth_at(int x, int y)\n    {\n        return depth[static_cast<std::size_t>(y) * width() + x];\n    }\n};\n\n// The rasterizer stage. Calls on_pixel(x, y, l0, l1, l2) for every\n// pixel whose centre is inside the screen-space triangle a, b, c,\n// where l0, l1 and l2 are that centre's barycentric coordinates:\n// how much of a, b and c is in it. They add up to 1. Either winding\n// order works, and the weights always belong to a, b, c as given.\ntemplate <typename OnPixel>\nvoid rasterize(Vec3 a, Vec3 b, Vec3 c, int width, int height,\n               OnPixel on_pixel)\n{\n    const Vec2 a2{a.x, a.y}, b2{b.x, b.y}, c2{c.x, c.y};\n    const double area = edge(a2, b2, c2);\n    if (area == 0)\n        return;   // a flat triangle has no inside\n    // With the other winding every edge runs the other way, and the\n    // top-left rule must look at it that way round.\n    auto top_left = [&](Vec2 from, Vec2 to) {\n        return area > 0 ? is_top_left(from, to) : is_top_left(to, from);\n    };\n    const bool top_left0 = top_left(b2, c2);\n    const bool top_left1 = top_left(c2, a2);\n    const bool top_left2 = top_left(a2, b2);\n    const double sign = area > 0 ? 1 : -1;   // makes inside positive\n\n    // Only pixels inside the bounding box can be inside the triangle.\n    const double left = std::min({a.x, b.x, c.x});\n    const double right = std::max({a.x, b.x, c.x});\n    const double top = std::min({a.y, b.y, c.y});\n    const double bottom = std::max({a.y, b.y, c.y});\n    const int min_x = std::max(0, int(std::floor(left)));\n    const int max_x = std::min(width - 1, int(std::ceil(right)));\n    const int min_y = std::max(0, int(std::floor(top)));\n    const int max_y = std::min(height - 1, int(std::ceil(bottom)));\n\n    for (int y = min_y; y <= max_y; ++y) {\n        for (int x = min_x; x <= max_x; ++x) {\n            const Vec2 p{x + 0.5, y + 0.5};\n            const double w0 = sign * edge(b2, c2, p);\n            const double w1 = sign * edge(c2, a2, p);\n            const double w2 = sign * edge(a2, b2, p);\n            if (covers(w0, top_left0) && covers(w1, top_left1) &&\n                covers(w2, top_left2))\n                on_pixel(x, y, w0 / (sign * area), w1 / (sign * area),\n                         w2 / (sign * area));\n        }\n    }\n}\n\n// Fills a triangle whose corners are in SCREEN space: x and y in\n// pixels, z the depth that viewport() kept. Returns how many pixels\n// it wrote.\ninline int fill_triangle_depth(Framebuffer& fb, Vec3 a, Vec3 b, Vec3 c,\n                               Color col)\n{\n    int written = 0;\n    rasterize(a, b, c, fb.width(), fb.height(),\n              [&](int x, int y, double l0, double l1, double l2) {\n                  const double z = l0 * a.z + l1 * b.z + l2 * c.z;\n                  fb.depth_at(x, y) = z;\n                  fb.color.set(x, y, col);\n                  ++written;\n              });\n    return written;\n}\n\n// ── Shading ─────────────────────────────────────────────────────────\n\n// The direction a triangle faces: perpendicular to two of its edges.\n// Corners in anticlockwise order, seen from the front, give a normal\n// pointing out of the front (the right-hand rule).\ninline Vec3 face_normal(Vec3 a, Vec3 b, Vec3 c)\n{\n    return normalize(cross(b - a, c - a));\n}\n\n// Lambert's law: a surface facing the light gets all of it, one at\n// an angle gets cos(angle) of it, one facing away gets none.\n// Both vectors must have length 1.\ninline double lambert(Vec3 normal, Vec3 to_light)\n{\n    return std::max(0.0, dot(normal, to_light));\n}\n\n// The colour scaled by a brightness from 0 to 1, rounded.\ninline Color shade(Color base, double brightness)\n{\n    brightness = std::clamp(brightness, 0.0, 1.0);\n    auto channel = [&](std::uint8_t v) {\n        return static_cast<std::uint8_t>(v * brightness + 0.5);\n    };\n    return {channel(base.r), channel(base.g), channel(base.b)};\n}\n\n// In screen space (y down), a front face's corners go round\n// anticlockwise as you look at it, which makes edge() negative.\n// Positive: we are looking at its back. Zero: edge-on.\ninline bool is_back_facing(Vec3 a, Vec3 b, Vec3 c)\n{\n    return edge(Vec2{a.x, a.y}, Vec2{b.x, b.y}, Vec2{c.x, c.y}) >= 0;\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "08-pipeline#Step 2 \u2014 The specification for the pipeline": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "08-pipeline#Step 3 \u2014 draw_indexed": {
    "wrong": [
      {
        "name": "blended the varyings without dividing by w",
        "files": {
          "raster/pipeline.h": "// pipeline.h: the graphics pipeline, one stage at a time, the way a\n// GPU runs it. You supply the two programmable stages, the vertex\n// shader and the fragment shader, as functions or lambdas.\n#pragma once\n\n#include <cstddef>\n#include <vector>\n\n#include \"camera.h\"\n#include \"image.h\"\n#include \"mat.h\"\n#include \"render.h\"\n#include \"vec.h\"\n\n// What a vertex shader returns: the clip-space position (OpenGL calls\n// it gl_Position), and one \"varying\", a value that the rasterizer\n// interpolates across the triangle for the fragment shader.\nstruct VertexOut {\n    Vec4 position;\n    Vec3 varying;\n};\n\n// What the fragment shader is given for each covered pixel.\nstruct Fragment {\n    int x;\n    int y;\n    double depth;\n    Vec3 varying;\n};\n\n// The fixed-function settings: chosen before drawing, not\n// programmable. On a GPU they are baked into a pipeline object.\nstruct PipelineState {\n    bool depth_test = true;\n    bool cull_back_faces = true;\n};\n\n// What happened during one draw.\nstruct DrawStats {\n    int vertices_shaded = 0;\n    int triangles = 0;\n    int clipped = 0;\n    int culled = 0;\n    int fragments_shaded = 0;\n};\n\ntemplate <typename Vertex, typename VertexShader, typename FragmentShader>\nDrawStats draw_indexed(Framebuffer& target, const PipelineState& state,\n                       const std::vector<Vertex>& vertices,\n                       const std::vector<int>& indices,\n                       VertexShader vertex_shader,\n                       FragmentShader fragment_shader)\n{\n    DrawStats stats;\n\n    // 1. Vertex shader: once per VERTEX, however many triangles use it.\n    std::vector<VertexOut> shaded;\n    shaded.reserve(vertices.size());\n    for (const Vertex& v : vertices) {\n        shaded.push_back(vertex_shader(v));\n        ++stats.vertices_shaded;\n    }\n\n    // 2. Primitive assembly: every three indices make one triangle.\n    for (std::size_t i = 0; i + 2 < indices.size(); i += 3) {\n        const VertexOut& v0 = shaded.at(indices[i]);\n        const VertexOut& v1 = shaded.at(indices[i + 1]);\n        const VertexOut& v2 = shaded.at(indices[i + 2]);\n        ++stats.triangles;\n\n        // 3. Clipping, simplified: drop a triangle with any corner\n        //    behind the camera or nearer than the near plane. A GPU\n        //    cuts such a triangle into pieces instead.\n        auto in_front = [](Vec4 p) { return p.w > 0 && p.z >= -p.w; };\n        if (!in_front(v0.position) || !in_front(v1.position) ||\n            !in_front(v2.position)) {\n            ++stats.clipped;\n            continue;\n        }\n\n        // 4. Perspective divide and viewport transform.\n        const int w = target.width(), h = target.height();\n        const Vec3 s0 = viewport(perspective_divide(v0.position), w, h);\n        const Vec3 s1 = viewport(perspective_divide(v1.position), w, h);\n        const Vec3 s2 = viewport(perspective_divide(v2.position), w, h);\n\n        // 5. Face culling.\n        if (state.cull_back_faces && is_back_facing(s0, s1, s2)) {\n            ++stats.culled;\n            continue;\n        }\n\n        // 6. Rasterizer: which pixels, and how much of each corner.\n        rasterize(s0, s1, s2, w, h,\n                  [&](int x, int y, double l0, double l1, double l2) {\n            // 7. Depth test, before the fragment shader runs\n            //    (\"early-z\"), so hidden pixels cost nothing.\n            const double z = l0 * s0.z + l1 * s1.z + l2 * s2.z;\n            if (state.depth_test && z >= target.depth_at(x, y))\n                return;\n\n            // Perspective-correct interpolation: weight each corner\n            // by 1 / w, so far corners count for less.\n            const double p0 = l0;\n            const double p1 = l1;\n            const double p2 = l2;\n            const Vec3 varying = (p0 * v0.varying + p1 * v1.varying +\n                                  p2 * v2.varying) / (p0 + p1 + p2);\n\n            // 8. Fragment shader: the pixel's colour.\n            const Color color = fragment_shader(Fragment{x, y, z, varying});\n            ++stats.fragments_shaded;\n\n            // 9. Output: write colour and depth to the framebuffer.\n            target.color.set(x, y, color);\n            if (state.depth_test)\n                target.depth_at(x, y) = z;\n        });\n    }\n    return stats;\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
      {
        "name": "ran the vertex shader for every index",
        "files": {
          "raster/pipeline.h": "// pipeline.h: the graphics pipeline, one stage at a time, the way a\n// GPU runs it. You supply the two programmable stages, the vertex\n// shader and the fragment shader, as functions or lambdas.\n#pragma once\n\n#include <cstddef>\n#include <vector>\n\n#include \"camera.h\"\n#include \"image.h\"\n#include \"mat.h\"\n#include \"render.h\"\n#include \"vec.h\"\n\n// What a vertex shader returns: the clip-space position (OpenGL calls\n// it gl_Position), and one \"varying\", a value that the rasterizer\n// interpolates across the triangle for the fragment shader.\nstruct VertexOut {\n    Vec4 position;\n    Vec3 varying;\n};\n\n// What the fragment shader is given for each covered pixel.\nstruct Fragment {\n    int x;\n    int y;\n    double depth;\n    Vec3 varying;\n};\n\n// The fixed-function settings: chosen before drawing, not\n// programmable. On a GPU they are baked into a pipeline object.\nstruct PipelineState {\n    bool depth_test = true;\n    bool cull_back_faces = true;\n};\n\n// What happened during one draw.\nstruct DrawStats {\n    int vertices_shaded = 0;\n    int triangles = 0;\n    int clipped = 0;\n    int culled = 0;\n    int fragments_shaded = 0;\n};\n\ntemplate <typename Vertex, typename VertexShader, typename FragmentShader>\nDrawStats draw_indexed(Framebuffer& target, const PipelineState& state,\n                       const std::vector<Vertex>& vertices,\n                       const std::vector<int>& indices,\n                       VertexShader vertex_shader,\n                       FragmentShader fragment_shader)\n{\n    DrawStats stats;\n\n    // 1. Vertex shader: once per VERTEX, however many triangles use it.\n    std::vector<VertexOut> shaded;\n    for (int index : indices) {\n        shaded.push_back(vertex_shader(vertices.at(index)));\n        ++stats.vertices_shaded;\n    }\n\n    // 2. Primitive assembly: every three indices make one triangle.\n    for (std::size_t i = 0; i + 2 < indices.size(); i += 3) {\n        const VertexOut& v0 = shaded.at(i);\n        const VertexOut& v1 = shaded.at(i + 1);\n        const VertexOut& v2 = shaded.at(i + 2);\n        ++stats.triangles;\n\n        // 3. Clipping, simplified: drop a triangle with any corner\n        //    behind the camera or nearer than the near plane. A GPU\n        //    cuts such a triangle into pieces instead.\n        auto in_front = [](Vec4 p) { return p.w > 0 && p.z >= -p.w; };\n        if (!in_front(v0.position) || !in_front(v1.position) ||\n            !in_front(v2.position)) {\n            ++stats.clipped;\n            continue;\n        }\n\n        // 4. Perspective divide and viewport transform.\n        const int w = target.width(), h = target.height();\n        const Vec3 s0 = viewport(perspective_divide(v0.position), w, h);\n        const Vec3 s1 = viewport(perspective_divide(v1.position), w, h);\n        const Vec3 s2 = viewport(perspective_divide(v2.position), w, h);\n\n        // 5. Face culling.\n        if (state.cull_back_faces && is_back_facing(s0, s1, s2)) {\n            ++stats.culled;\n            continue;\n        }\n\n        // 6. Rasterizer: which pixels, and how much of each corner.\n        rasterize(s0, s1, s2, w, h,\n                  [&](int x, int y, double l0, double l1, double l2) {\n            // 7. Depth test, before the fragment shader runs\n            //    (\"early-z\"), so hidden pixels cost nothing.\n            const double z = l0 * s0.z + l1 * s1.z + l2 * s2.z;\n            if (state.depth_test && z >= target.depth_at(x, y))\n                return;\n\n            // Perspective-correct interpolation: weight each corner\n            // by 1 / w, so far corners count for less.\n            const double p0 = l0 / v0.position.w;\n            const double p1 = l1 / v1.position.w;\n            const double p2 = l2 / v2.position.w;\n            const Vec3 varying = (p0 * v0.varying + p1 * v1.varying +\n                                  p2 * v2.varying) / (p0 + p1 + p2);\n\n            // 8. Fragment shader: the pixel's colour.\n            const Color color = fragment_shader(Fragment{x, y, z, varying});\n            ++stats.fragments_shaded;\n\n            // 9. Output: write colour and depth to the framebuffer.\n            target.color.set(x, y, color);\n            if (state.depth_test)\n                target.depth_at(x, y) = z;\n        });\n    }\n    return stats;\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "08-pipeline#Step 4 \u2014 A scene, through the pipeline": {
    "wrong": [
      {
        "name": "turned the depth test off",
        "files": {
          "raster/apps/scene.cpp": "// scene.cpp: two cubes through the pipeline, lit per pixel.\n#include <filesystem>\n#include <iostream>\n#include <numbers>\n#include <vector>\n\n#include \"bmp.h\"\n#include \"camera.h\"\n#include \"image.h\"\n#include \"mat.h\"\n#include \"pipeline.h\"\n#include \"render.h\"\n#include \"vec.h\"\n\n// The vertex buffer's layout: what each vertex carries.\nstruct Vertex {\n    Vec3 position;\n    Vec3 normal;\n};\n\nstruct Mesh {\n    std::vector<Vertex> vertices;\n    std::vector<int> indices;   // the index buffer\n};\n\n// A cube from -1 to 1. Each face gets its own 4 vertices, because a\n// corner shared by 3 faces needs 3 different normals.\nMesh make_cube()\n{\n    const Vec3 normals[6] = {{1, 0, 0},  {-1, 0, 0}, {0, 1, 0},\n                             {0, -1, 0}, {0, 0, 1},  {0, 0, -1}};\n    Mesh mesh;\n    for (const Vec3& n : normals) {\n        // Two directions across the face, so that u, v, n follow the\n        // right-hand rule: corners go anticlockwise seen from outside.\n        const Vec3 u = n.y != 0 ? Vec3{0, 0, 1} : Vec3{0, 1, 0};\n        const Vec3 v = cross(n, u);\n        const int first = static_cast<int>(mesh.vertices.size());\n        mesh.vertices.push_back({n - u - v, n});\n        mesh.vertices.push_back({n + u - v, n});\n        mesh.vertices.push_back({n + u + v, n});\n        mesh.vertices.push_back({n - u + v, n});\n        for (int i : {0, 1, 2, 0, 2, 3})\n            mesh.indices.push_back(first + i);\n    }\n    return mesh;\n}\n\nvoid report(const char* name, const DrawStats& s)\n{\n    std::cout << name << \": \" << s.vertices_shaded << \" vertices shaded, \"\n              << s.triangles << \" triangles, \" << s.culled\n              << \" culled, \" << s.fragments_shaded\n              << \" fragments shaded\\n\";\n}\n\nint main()\n{\n    const double degree = std::numbers::pi / 180;\n    Framebuffer fb(240, 180, Color{30, 30, 40});\n    const Mesh cube = make_cube();\n\n    // Uniforms: the same for every vertex and fragment of a draw.\n    const Mat4 view = look_at({0, 2, 7}, {0, 0, 0}, {0, 1, 0});\n    const Mat4 projection =\n        perspective(50 * degree, 240.0 / 180.0, 0.1, 100);\n    const Vec3 to_light = normalize(Vec3{-1, 2, 2});\n\n    auto draw_cube = [&](const Mat4& model, Color base) {\n        const Mat4 mvp = projection * view * model;\n        auto vertex_shader = [&](const Vertex& v) {\n            const Vec3 p = v.position;\n            // The normal turns with the model. (These models only\n            // rotate, move and scale evenly, and the fragment shader\n            // normalizes, so the model matrix itself works.)\n            return VertexOut{mvp * Vec4{p.x, p.y, p.z, 1},\n                             transform_vector(model, v.normal)};\n        };\n        auto fragment_shader = [&](const Fragment& f) {\n            const Vec3 n = normalize(f.varying);\n            return shade(base, 0.15 + 0.85 * lambert(n, to_light));\n        };\n        PipelineState no_depth;\n        no_depth.depth_test = false;\n        return draw_indexed(fb, no_depth, cube.vertices,\n                            cube.indices, vertex_shader,\n                            fragment_shader);\n    };\n\n    // The blue cube is in front, but drawn FIRST: only the depth\n    // test keeps the orange cube from painting over it.\n    report(\"blue cube\",\n           draw_cube(translate(Vec3{0.9, -0.4, 1.2}) *\n                         rotate_y(-20 * degree) * rotate_x(15 * degree) *\n                         scale(Vec3{0.7, 0.7, 0.7}),\n                     Color{60, 120, 230}));\n    report(\"orange cube\",\n           draw_cube(translate(Vec3{-0.9, 0, -0.5}) * rotate_y(35 * degree),\n                     Color{240, 140, 40}));\n\n    std::filesystem::create_directories(\"images\");\n    write_bmp(fb.color, \"images/scene.bmp\");\n    std::cout << \"wrote images/scene.bmp\\n\";\n}\n",
        },
        "run": [
          configure("raster"),
        ],
        "fails": [
          3,
        ],
      },
    ],
  },
  "08-pipeline#Step 5 \u2014 Challenge: a debugging shader": {
    "wrong": [
      {
        "name": "did not write it",
        "run": [
          configure("raster"),
        ],
        "fails": [
          1,
          2,
        ],
      },
    ],
  },
};
