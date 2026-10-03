---
title: 1 — Files and std::filesystem: a Disk-Usage Tool
track: Systems Programming
trackOrder: 11
runtime: cpp
reference: optional
console: true
---

Every program so far has lived inside its own memory. **Systems programming** is about everything outside it: the files on disk, the other programs running beside yours, and the several threads running inside it at once. The operating system is in charge of all three. C++ gives you standard, portable ways to ask it for things (`std::filesystem`, `std::thread`, `std::atomic`), plus a few small pieces of platform code where the standard stops.

| Lesson | You build |
|---|---|
| 1 | `du`: how much space a folder uses, with `std::filesystem` |
| 2 | a mini shell: processes, exit codes, the environment |
| 3 | pipes: programs that read and write streams |
| 4 | threads, a data race, mutexes, and a deadlock |
| 5 | a blocking queue, with condition variables |
| 6 | atomics and the memory model; a spin lock |
| 7 | a thread pool, and a parallel sum |

Choose a **new empty folder** for this track, and run every command from that folder. The track has four project folders:

| Folder | Lessons | Built with |
|---|---|---|
| `files/` | 1 | CMake |
| `proc/` | 2 and 3 | `g++`, one program at a time |
| `threads/` | 4 to 6 | CMake, with the thread library |
| `pool/` | 7 | CMake |

## Step 1 — The test framework

**This step: create the supplied `testing/studio_test.hpp`.**

The tools in this track are tested, so the track needs the test framework.

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

## Step 3 — A file that isn't there yet

**This step: create the supplied `files/write_demo.cpp`, read it, then build and run it.**

```text
g++ -std=c++20 -Wall -Wextra files/write_demo.cpp -o files/write_demo
./files/write_demo
```

The program writes 14 characters to `files/out/notes.txt`, then asks the file system how big the file is.

- `namespace fs = std::filesystem;` is a **namespace alias**: `fs::path` instead of `std::filesystem::path`. Every example you'll find online uses it.
- `fs::create_directories` makes a folder and any missing parents, like `mkdir -p`. It does nothing if they already exist.
- `fs::file_size` asks the operating system, not your program, how many bytes the file holds on disk.

**Predict:** what size does it print?

```cpp file=files/write_demo.cpp provided
// Writes a small file, then asks the file system how big it is.
#include <filesystem>
#include <fstream>
#include <iostream>

namespace fs = std::filesystem;

int main()
{
    fs::create_directories("files/out");   // like mkdir -p: fine if it exists
    const fs::path path = "files/out/notes.txt";

    std::ofstream out(path);               // opens (and empties) the file
    out << "line 1\nline 2\n";             // 14 characters

    std::cout << "size while open: " << fs::file_size(path) << " bytes\n";
    std::cout << "done\n";
}
```

### What happened

It almost certainly printed `size while open: 0 bytes`. The text wasn't on disk yet.

```text
your program        ofstream's buffer     the file on disk
out << "line 1..." ──► [line 1 line 2] ──X──► (empty)
                       sent when full, on
                       flush(), or on close
```

Asking the operating system to write is a **system call**: a jump into the kernel that costs far more than copying a few bytes. So `std::ofstream` collects your writes in a **buffer** in your program's memory, typically a few kilobytes, and hands the whole buffer over in one call when it fills up, when you call `flush()`, or when the stream is closed.

```check
run "g++ -std=c++20 -Wall -Wextra files/write_demo.cpp -o files/write_demo"
run "./files/write_demo" stdout="size while open: " label="it prints the size while the file is still open"
```

## Step 4 — Let the destructor close it

**This step: put each `std::ofstream` in its own `{ }` block, so the file is closed before you measure it. Then write the same text in binary mode and compare.**

You could call `out.close()`. But you met a better tool in *Memory, Lifetime and Ownership*: **RAII**. An `std::ofstream` *owns* an open file, and its destructor flushes the buffer and closes the file. End the stream's life and the file is complete:

```cpp
{
    std::ofstream out(text_path);           // opens
    out << "line 1\nline 2\n";
}                                           // ~ofstream: flush, close
std::cout << "text mode: " << fs::file_size(text_path) << " bytes\n";
```

This works on every path out of the block, including an exception. That's why you rarely see `close()` in modern C++.

Then write the same 14 characters to `files/out/notes.bin`, opened with `std::ios::binary`, and print its size as `binary mode: 14 bytes`.

### Text mode and binary mode

| Mode | `'\n'` becomes | For |
|---|---|---|
| text (the default) | `\n` on Linux and macOS, **`\r\n` on Windows** | text people read |
| `std::ios::binary` | `\n`, everywhere | everything else: images, data, exact sizes |

**Predict:** on your system, what will the two sizes be? On Windows the text file is 16 bytes: each `'\n'` was written as two bytes, `\r\n`, the Windows line ending. Reading it back in text mode turns them into `'\n'` again. Whenever the exact bytes matter, open the file in binary mode.

```cpp file=files/write_demo.cpp
// Writes the same text in text mode and in binary mode, and compares sizes.
#include <filesystem>
#include <fstream>
#include <iostream>

namespace fs = std::filesystem;

int main()
{
    fs::create_directories("files/out");
    const fs::path text_path = "files/out/notes.txt";
    const fs::path binary_path = "files/out/notes.bin";

    {
        std::ofstream out(text_path);           // text mode (the default)
        out << "line 1\nline 2\n";
    }                                           // ~ofstream: flush, close

    {
        std::ofstream out(binary_path, std::ios::binary);
        out << "line 1\nline 2\n";
    }

    std::cout << "text mode: " << fs::file_size(text_path) << " bytes\n";
    std::cout << "binary mode: " << fs::file_size(binary_path) << " bytes\n";
}
```

```check
run "g++ -std=c++20 -Wall -Wextra files/write_demo.cpp -o files/write_demo"
run "./files/write_demo" stdout="binary mode: 14 bytes" -- Close the binary stream (end its block) before calling file_size.
run "./files/write_demo" stdout="text mode: 14 bytes" os=linux label="the text file is 14 bytes on Linux"
run "./files/write_demo" stdout="text mode: 14 bytes" os=mac label="the text file is 14 bytes on macOS"
```

## Step 5 — The project's build file

**This step: create the supplied `files/CMakeLists.txt` and read it.**

From here on, `files/` is a CMake project. For now it builds one program, `files_tests`, from the shared test runner and every `tests/*_test.cpp` file. The library, `du.h`, is **header-only**: small functions defined `inline` in a header, so there's no library `.cpp` to compile. Step 8 adds the `du` program itself.

`add_compile_options` comes **before** the targets: it sets the options for targets created *after* it in this file.

```cmake file=files/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(files LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# The test program: the shared runner plus every tests/*_test.cpp file.
# du.h is header-only, so there's no library .cpp to list.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(files_tests ../testing/test_main.cpp ${TEST_SOURCES})
target_include_directories(files_tests PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)
```

```check
file files/CMakeLists.txt
```

## Step 6 — The specification

**This step: create the supplied `files/tests/du_test.cpp` and read it.**

`du.h` will provide a `Usage` struct and functions that fill it in:

```cpp
struct Usage {
    std::uintmax_t bytes = 0;    // total size of every regular file
    std::size_t files = 0;
    std::size_t folders = 0;     // below root; root isn't counted
    std::map<std::string, std::uintmax_t> by_extension;
};

Usage summarize(const fs::path& root, std::error_code& ec);
Usage summarize(const fs::path& root);   // throws instead
void make_sample_tree(const fs::path& root);
```

Testing code that touches the disk has a problem: the disk isn't the same on every machine. These tests never look at *your* files. Each one builds its own small folder tree under `fs::temp_directory_path()` (`/tmp` on Linux, `%TEMP%` on Windows), with files of known sizes, and checks the numbers.

Read the last three tests closely: there are **two** `summarize`s, and they report problems differently. Next step explains why.

```cpp file=files/tests/du_test.cpp provided
#include "studio_test.hpp"

#include "du.h"

#include <filesystem>
#include <fstream>
#include <string>
#include <system_error>

namespace fs = std::filesystem;

namespace {

// Each test builds its own folder under the system's temporary folder,
// so the tests never depend on what's on your disk.
fs::path fresh_folder(const std::string& name)
{
    const fs::path dir = fs::temp_directory_path() / ("studio-du-" + name);
    fs::remove_all(dir);
    fs::create_directories(dir);
    return dir;
}

void write_file(const fs::path& path, std::size_t bytes)
{
    fs::create_directories(path.parent_path());
    std::ofstream out(path, std::ios::binary);
    out << std::string(bytes, 'x');
}

} // namespace

TEST(an_empty_folder_is_all_zeros)
{
    const Usage usage = summarize(fresh_folder("empty"));
    CHECK_EQ(usage.bytes, 0u);
    CHECK_EQ(usage.files, 0u);
    CHECK_EQ(usage.folders, 0u);
    CHECK(usage.by_extension.empty());
}

TEST(counts_files_and_bytes_in_nested_folders)
{
    const fs::path root = fresh_folder("nested");
    write_file(root / "a.txt", 10);
    write_file(root / "sub" / "b.txt", 20);
    write_file(root / "sub" / "deeper" / "c.bin", 5);

    const Usage usage = summarize(root);
    CHECK_EQ(usage.bytes, 35u);
    CHECK_EQ(usage.files, 3u);
    CHECK_EQ(usage.folders, 2u);   // sub and sub/deeper; not root itself
}

TEST(groups_bytes_by_extension)
{
    const fs::path root = fresh_folder("extensions");
    write_file(root / "a.txt", 10);
    write_file(root / "b.txt", 20);
    write_file(root / "c.bin", 5);
    write_file(root / "Makefile", 7);

    const Usage usage = summarize(root);
    CHECK_EQ(usage.by_extension.size(), 3u);
    CHECK_EQ(usage.by_extension.at(".txt"), 30u);
    CHECK_EQ(usage.by_extension.at(".bin"), 5u);
    CHECK_EQ(usage.by_extension.at("(none)"), 7u);
}

TEST(the_sample_tree_matches_its_description)
{
    const fs::path root = fresh_folder("sample");
    make_sample_tree(root);

    const Usage usage = summarize(root);
    CHECK_EQ(usage.bytes, 5750u);
    CHECK_EQ(usage.files, 7u);
    CHECK_EQ(usage.folders, 4u);
    CHECK_EQ(usage.by_extension.at(".cpp"), 500u);
}

TEST(a_missing_folder_sets_the_error_code)
{
    const fs::path missing = fresh_folder("missing") / "not-here";
    std::error_code ec;
    const Usage usage = summarize(missing, ec);
    CHECK(ec);                      // some error, whatever the system calls it
    CHECK_EQ(usage.files, 0u);
}

TEST(a_file_is_not_a_folder)
{
    const fs::path root = fresh_folder("file");
    write_file(root / "a.txt", 3);
    std::error_code ec;
    summarize(root / "a.txt", ec);
    CHECK(ec == std::errc::not_a_directory);
}

TEST(the_throwing_version_throws_filesystem_error)
{
    const fs::path missing = fresh_folder("throws") / "not-here";
    CHECK_THROWS(summarize(missing), fs::filesystem_error);
}
```

```check
file files/tests/du_test.cpp
```

## Step 7 — Walk the tree: write du.h

**This step: create `files/du.h` and make the tests pass. Then configure, build and run them.**

### Paths and entries

- An `fs::path` is a value holding a path. `root / "src" / "main.cpp"` joins parts with the right separator for the system.
- `path.extension()` is `".cpp"` for `main.cpp`, and empty for `LICENSE`.
- A `fs::directory_entry` is one item found in a folder. It caches what the system told you about it, so `entry.is_directory()` and `entry.file_size()` are often free.

`fs::recursive_directory_iterator` visits every entry below a folder, depth first. Used as a range, it's one line:

```cpp
for (const fs::directory_entry& entry :
     fs::recursive_directory_iterator(root))
    // ...
```

### Errors: exceptions or error codes?

Almost every `std::filesystem` function comes in two versions:

| Call | On failure |
|---|---|
| `fs::file_size(p)` | throws `fs::filesystem_error` |
| `fs::file_size(p, ec)` | sets `ec` (a `std::error_code`), and doesn't throw |

A disk walk meets problems as a normal part of life: a file deleted while you walk, a folder you aren't allowed to read, a link to nowhere. If each threw, you'd need a `try` around every call. So `summarize` uses the `ec` versions throughout, and the throwing `summarize` is a thin wrapper for callers who'd rather not check. The standard library itself is designed this way.

```cpp
inline Usage summarize(const fs::path& root, std::error_code& ec)
{
    Usage usage;
    if (!fs::is_directory(root, ec)) {
        if (!ec)   // it exists, but it's not a folder
            ec = std::make_error_code(std::errc::not_a_directory);
        return usage;
    }

    const auto options = fs::directory_options::skip_permission_denied;
    fs::recursive_directory_iterator it(root, options, ec);
    for (; !ec && it != fs::recursive_directory_iterator();
         it.increment(ec)) {
        const fs::directory_entry& entry = *it;
        // count it: a folder, a regular file, or skip it
    }
    return usage;
}
```

- The range-for can't take an `ec`: `++it` throws. So the loop is written out, with `it.increment(ec)`. A default-constructed iterator is the end.
- `skip_permission_denied` skips folders you may not open, instead of failing the whole walk. On Linux or macOS, try `./files/build/du /etc` after step 8, with and without it.
- Inside the loop use a second `std::error_code` for each entry, and **skip** an entry that fails: one unreadable file shouldn't stop the count.
- Files with no extension are counted under `"(none)"`.
- Links to folders aren't followed (that's the default), so a link that points back up the tree can't make the walk go round forever.

The throwing version:

```cpp
inline Usage summarize(const fs::path& root)
{
    std::error_code ec;
    Usage usage = summarize(root, ec);
    if (ec)
        throw fs::filesystem_error("summarize", root, ec);
    return usage;
}
```

`make_sample_tree` builds the same tree as the tests: copy it from the full file. It writes each file with a helper, `write_bytes`, whose `std::ofstream` closes when the function returns: the last step's lesson, put to work.

```text
cmake -S files -B files/build -G "MinGW Makefiles"     (Windows)
cmake -S files -B files/build                          (macOS, Linux)
```

```text
cmake --build files/build
./files/build/files_tests
```

```cpp file=files/du.h
// du.h: how much space a folder uses, with std::filesystem.
#pragma once

#include <cstdint>
#include <filesystem>
#include <fstream>
#include <map>
#include <string>
#include <system_error>

namespace fs = std::filesystem;

struct Usage {
    std::uintmax_t bytes = 0;    // total size of every regular file
    std::size_t files = 0;
    std::size_t folders = 0;     // below root; root itself isn't counted
    std::map<std::string, std::uintmax_t> by_extension;   // ".txt" -> bytes
};

// Reports problems through ec. Never throws a filesystem_error.
inline Usage summarize(const fs::path& root, std::error_code& ec)
{
    Usage usage;
    if (!fs::is_directory(root, ec)) {
        if (!ec)   // it exists, but it's not a folder
            ec = std::make_error_code(std::errc::not_a_directory);
        return usage;
    }

    const auto options = fs::directory_options::skip_permission_denied;
    fs::recursive_directory_iterator it(root, options, ec);
    for (; !ec && it != fs::recursive_directory_iterator(); it.increment(ec)) {
        const fs::directory_entry& entry = *it;
        std::error_code entry_ec;   // a problem with one entry: skip it
        if (entry.is_directory(entry_ec)) {
            ++usage.folders;
            continue;
        }
        if (!entry.is_regular_file(entry_ec))
            continue;               // a broken link, a socket, ...
        const std::uintmax_t size = entry.file_size(entry_ec);
        if (entry_ec)
            continue;               // it vanished, or can't be read

        usage.bytes += size;
        ++usage.files;
        std::string ext = entry.path().extension().string();
        usage.by_extension[ext.empty() ? "(none)" : ext] += size;
    }
    return usage;
}

// The same, but a problem throws std::filesystem::filesystem_error.
inline Usage summarize(const fs::path& root)
{
    std::error_code ec;
    Usage usage = summarize(root, ec);
    if (ec)
        throw fs::filesystem_error("summarize", root, ec);
    return usage;
}

// Writes a file of exactly `bytes` bytes, creating its folders.
inline void write_bytes(const fs::path& path, std::size_t bytes)
{
    fs::create_directories(path.parent_path());
    std::ofstream out(path, std::ios::binary);
    out << std::string(bytes, 'x');
}   // out is closed here, so the file is complete

// A small tree with known sizes: 5750 bytes, 7 files, 4 folders.
inline void make_sample_tree(const fs::path& root)
{
    fs::remove_all(root);
    write_bytes(root / "readme.txt", 120);
    write_bytes(root / "LICENSE", 50);
    write_bytes(root / "src" / "main.cpp", 300);
    write_bytes(root / "src" / "util.cpp", 200);
    write_bytes(root / "src" / "util.h", 80);
    write_bytes(root / "assets" / "logo.png", 1000);
    write_bytes(root / "assets" / "music" / "theme.ogg", 4000);
    fs::create_directories(root / "assets" / "music" / "unused");
}
```

```check
file files/build/CMakeCache.txt label="files/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build files/build"
tests "./files/build/files_tests" require="groups_bytes_by_extension a_missing_folder_sets_the_error_code a_file_is_not_a_folder the_throwing_version_throws_filesystem_error" -- Files without an extension go under "(none)".
```

## Step 8 — The du program

**This step: add the `du` program to `files/CMakeLists.txt` and write `files/main.cpp`. It must print the sample tree's summary, biggest extension first.**

Add one line to the end of `files/CMakeLists.txt`:

```cmake
add_executable(du main.cpp)
```

The program takes a folder, and with `--sample` creates the sample tree there first:

```text
./files/build/du --sample files/sample
created files/sample
5750 bytes in 7 files and 4 folders
    4000  .ogg
    1000  .png
     500  .cpp
     120  .txt
      80  .h
      50  (none)
```

- `std::map` keeps the extensions in name order. To list the biggest first, copy the pairs into a vector and sort by size. `std::stable_sort` keeps equal sizes in name order. (`std::sort` might not.)
- `std::setw(8)` from `<iomanip>` right-aligns the next number in 8 columns.
- **A gotcha:** `std::cout << path` prints the path *in quotes*, `"files/sample"`, so that a path with spaces can be read back. Print `path.string()` when you want the bare text.

### Reporting failure

`./files/build/du files/nope` must not throw. It prints one line to **standard error** and returns `1`:

```text
du: cannot read files/nope: No such file or directory
```

- Errors go to `std::cerr`, not `std::cout`, so that someone saving the output to a file, or a program reading it, gets only the real results. Lesson 3 shows why that matters.
- The value `main` returns is the **exit code**: `0` for success, `1` for failure, `2` for "you used me wrongly" by convention. Lesson 2 is about exit codes.
- `ec.message()` is the system's own wording, so it differs between systems. The `du: cannot read` part is yours.

```cpp file=files/main.cpp
// du: how much space a folder uses, by file extension.
//   du <folder>            summarize a folder
//   du --sample <folder>   create the sample tree there first
#include "du.h"

#include <algorithm>
#include <iomanip>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

int main(int argc, char* argv[])
{
    std::vector<std::string> args(argv + 1, argv + argc);
    if (args.size() == 2 && args[0] == "--sample") {
        make_sample_tree(args[1]);
        std::cout << "created " << args[1] << '\n';
        args.erase(args.begin());
    }
    if (args.size() != 1) {
        std::cerr << "usage: du [--sample] <folder>\n";
        return 2;
    }

    const fs::path root = args[0];
    std::error_code ec;
    const Usage usage = summarize(root, ec);
    if (ec) {
        std::cerr << "du: cannot read " << root.string() << ": "
                  << ec.message() << '\n';
        return 1;
    }

    std::cout << usage.bytes << " bytes in " << usage.files
              << " files and " << usage.folders << " folders\n";

    // Biggest first; equal sizes in name order.
    std::vector<std::pair<std::string, std::uintmax_t>> rows(
        usage.by_extension.begin(), usage.by_extension.end());
    std::stable_sort(rows.begin(), rows.end(),
                     [](const auto& a, const auto& b) {
                         return a.second > b.second;
                     });
    for (const auto& [ext, bytes] : rows)
        std::cout << std::setw(8) << bytes << "  " << ext << '\n';
}
```

```check
contains files/CMakeLists.txt "add_executable(du main.cpp)" -- Add add_executable(du main.cpp) to the end of files/CMakeLists.txt.
run "cmake --build files/build"
run "./files/build/du --sample files/sample" stdout="created files/sample"
run "./files/build/du files/sample" stdout="5750 bytes in 7 files and 4 folders\n    4000  .ogg\n    1000  .png\n     500  .cpp\n     120  .txt\n      80  .h\n      50  (none)" -- Biggest first: copy the map into a vector and stable_sort it by size.
run "./files/build/du files/nope" exit=1 stderr="du: cannot read files/nope" label="a missing folder: an error message and exit code 1" -- Print path.string(), not the path itself: a path prints in quotes.
```

## Step 9 — Your own tests: what is an extension?

**This step: create `files/tests/extension_test.cpp` with at least three tests that pin down what counts as an extension. Include `archive.tar.gz` and `.gitignore`.**

`du` groups files by `path.extension()`, so its report is only as good as your understanding of that one function. Don't guess: write tests, and let them tell you.

**Predict, then test:**

| Name | `extension()`? | `stem()`? |
|---|---|---|
| `archive.tar.gz` | ? | ? |
| `.gitignore` | ? | ? |
| `notes.` | ? | ? |

`stem()` is the file name without its extension. At least one test should go through `summarize`, so it checks what `du` will actually report: build a small folder with `write_bytes` and look in `by_extension`.

Start the file with `#include "studio_test.hpp"` and `#include "du.h"`. The build picks the new file up by itself.

```cpp file=files/tests/extension_test.cpp
#include "studio_test.hpp"

#include "du.h"

#include <filesystem>
#include <string>

namespace fs = std::filesystem;

// What does std::filesystem call the extension of each name?
TEST(only_the_last_dot_starts_the_extension)
{
    CHECK_EQ(fs::path("archive.tar.gz").extension().string(), ".gz");
    CHECK_EQ(fs::path("archive.tar.gz").stem().string(), "archive.tar");
}

TEST(a_leading_dot_is_part_of_the_name)
{
    CHECK_EQ(fs::path(".gitignore").extension().string(), "");
    CHECK_EQ(fs::path(".gitignore").stem().string(), ".gitignore");
}

TEST(summarize_files_dotfiles_under_none)
{
    const fs::path root = fs::temp_directory_path() / "studio-du-own";
    fs::remove_all(root);
    write_bytes(root / ".gitignore", 4);
    write_bytes(root / "backup.tar.gz", 6);

    const Usage usage = summarize(root);
    CHECK_EQ(usage.by_extension.at("(none)"), 4u);
    CHECK_EQ(usage.by_extension.at(".gz"), 6u);
}
```

```check
matches files/tests/extension_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="extension_test.cpp has at least three tests"
contains files/tests/extension_test.cpp "tar.gz"
contains files/tests/extension_test.cpp ".gitignore"
run "cmake --build files/build"
tests "./files/build/files_tests"
```
