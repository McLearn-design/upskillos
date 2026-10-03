---
title: 1 — Version Control from the First Line
track: Software Engineering in C++
trackOrder: 10
runtime: cpp
reference: optional
console: true
---

The earlier tracks taught the language. This one teaches the work around it: the tools and habits that let a program grow for years, with several people changing it, without breaking. You'll apply each one to a single project that grows across the track: **interp**, a small calculator language with variables.

```text
x = 6            ->  = 6
x * (3 + 4)      ->  = 42
y + 1            ->  error: unknown variable 'y'
```

| Lesson | Practice | interp gains |
|---|---|---|
| 1 | Git: history from the first line | a tokenizer |
| 2 | CMake for real projects | a parser, a library, an app |
| 3 | testing like a professional; branches | an interpreter |
| 4 | clang-format and clang-tidy | one style, fewer bugs |
| 5 | sanitizers in the test run | a fix for a hidden bug |
| 6 | continuous integration | builds on three systems |
| 7 | packaging and releases | version 1.0.0 |

Choose a **new empty folder** for this track. It's a whole repository, so run every command from that folder: the project's `CMakeLists.txt` will sit at the top of it, next to `.git`.

## Step 1 — A repository, and who you are

**This step: make the folder a Git repository, and tell it your name and email.**

```text
git init -b main
git config user.name "Your Name"
git config user.email "you@example.com"
```

**Git** records **snapshots** of your project, called **commits**. Each commit holds every file as it was, who made it, when, and a message saying why. With that history you can see what changed and when, undo a mistake, and work on two things at once without mixing them up.

- `git init` creates a hidden `.git` folder: the repository. Every snapshot lives there. Delete it and the history is gone; copy the folder and the history comes with it.
- `-b main` names the first **branch** `main`. (Older Git calls it `master` unless told otherwise. Lesson 3 explains branches.)
- Every commit records an author. `git config` **without** `--global` stores your name and email in `.git/config`, for this repository only. With `--global` it would apply to every repository on your computer. This course keeps its settings inside the project folder.

Use your real name and email if you'll publish the project (lesson 6 puts it on GitHub). Check what Git knows:

```text
git config user.name
git status
```

`git status` is the command you'll run most often. Right now it says `No commits yet` and `nothing to commit`.

```check
git-repo -- Run git init -b main in the track folder (the folder this project is open in).
contains .git/config "[user]" label="your name and email are set for this repository" -- Run git config user.name "Your Name" without --global.
git-config user.email
```

## Step 2 — Ignore what the build makes, then commit

**This step: create `.gitignore`, then make the first commit.**

Soon you'll configure CMake into a `build` folder: thousands of generated files, different on every machine, recreated by every build. They must never go into the history. A **`.gitignore`** file lists the paths Git should pretend aren't there:

| Line | Ignores |
|---|---|
| `build/` | any folder called `build`, and everything in it |
| `build-*/` | folders like `build-asan` (lesson 5 makes one) |
| `# ...` | nothing: a comment |

The trailing `/` means "a folder". Then record the first snapshot:

```text
git add .gitignore
git commit -m "Ignore build folders"
```

A commit is made in two moves:

```text
working folder  --git add-->  staging area  --git commit-->  history
(your files)                  (the next                      (snapshots,
                               snapshot)                      for good)
```

- `git add` copies a file's current content into the **staging area**: what the next commit will contain.
- `git commit` turns the staging area into a commit. `-m` gives the message.

Two steps instead of one let you choose exactly what goes into each commit, even when you've changed many files.

**Messages** say *why*, in the imperative, like an instruction: "Ignore build folders", not "changes" or "fixed stuff". In a year, `git log` is how you'll find out why a line exists.

```text file=.gitignore
# Build output: never commit it. Anyone can rebuild it from the
# sources, and it's different on every machine.
build/
build-*/
```

```check
git-ignored build/CMakeCache.txt label="Git ignores the build folder" -- Add the line build/ to .gitignore.
git-ignored build-asan/interp_tests label="Git ignores build-asan too" -- Add the line build-*/ to .gitignore.
git-tracked .gitignore -- git add .gitignore, then git commit -m "Ignore build folders".
```

## Step 3 — The test framework

**This step: create the supplied `testing/studio_test.hpp`.**

interp is built test-first: for every piece, the tests come before the code, and every commit should leave them passing.

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

## Step 4 — The test runner

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

## Step 5 — The project's build file

**This step: create the supplied `CMakeLists.txt` and read it.**

For now it builds one program, `interp_tests`, from the test runner, every `tests/*_test.cpp` file and the tokenizer. Lesson 2 replaces it with the shape real projects use.

The project's folders, from the start:

| Folder | Holds |
|---|---|
| `include/interp/` | headers: what the rest of the world may use |
| `src/` | the code behind them |
| `tests/` | the tests |
| `testing/` | the test framework |

`include/interp/tokenizer.h` is included as `"interp/tokenizer.h"`. The `interp/` prefix keeps the name unique: another library's `tokenizer.h` can't be mistaken for it.

```cmake file=CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(interp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# For now, one program: the tests, built with the tokenizer.
# Lesson 2 turns this into a library, an app and the tests.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(interp_tests
    testing/test_main.cpp ${TEST_SOURCES} src/tokenizer.cpp)
target_include_directories(interp_tests PRIVATE include testing)

if(MSVC)
    target_compile_options(interp_tests PRIVATE /W4)
else()
    target_compile_options(interp_tests PRIVATE -Wall -Wextra -Wpedantic)
endif()
```

```check
file CMakeLists.txt
```

## Step 6 — What a tokenizer does

**This step: create the supplied `include/interp/tokenizer.h` and read it.**

An interpreter reads text in three stages. Each takes the previous one's output:

```text
"x = 2 * (y + 1)"
   | tokenize          lesson 1
   v
x  =  2  *  (  y  +  1  )  end
   | parse             lesson 2
   v
(x = (2 * (y + 1)))    a tree
   | evaluate          lesson 3
   v
= 8                    (if y is 3)
```

The **tokenizer** (or *lexer*) turns characters into **tokens**: the words of the language. Spaces disappear; `12` becomes one number token, not two digits. The parser never has to think about characters again.

The header is the tokenizer's **contract**:

- `TokenKind` is an `enum class`: the kinds of words. Every line ends with an `end` token, so the parser can always look one token ahead without running off the end.
- `Token` holds the kind, the text as typed, and the value of a number.
- `SyntaxError` derives from `std::runtime_error`: `using std::runtime_error::runtime_error;` **inherits its constructors**, so `throw SyntaxError("message")` works with no code of our own.

```cpp file=include/interp/tokenizer.h provided
#pragma once

#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

namespace interp {

enum class TokenKind {
    number,      // 42, 3.5
    identifier,  // x, rate_2
    plus,        // +
    minus,       // -
    star,        // *
    slash,       // /
    left_paren,  // (
    right_paren, // )
    equals,      // =
    end,         // the end of the line: always the last token
};

struct Token {
    TokenKind kind;
    std::string text; // the characters as they were typed
    double value = 0; // the number, for a number token
};

// Thrown for text the language can't read.
class SyntaxError : public std::runtime_error {
public:
    using std::runtime_error::runtime_error;
};

// Splits one line into tokens, ending with a TokenKind::end token.
std::vector<Token> tokenize(std::string_view line);

} // namespace interp
```

```check
file include/interp/tokenizer.h
```

## Step 7 — The specification

**This step: create the supplied `tests/tokenizer_test.cpp` and read it.**

The helper `kinds` turns a line's tokens into words, such as `"number + name end"`. Comparing strings gives readable failures: `CHECK_EQ` prints both sides.

| Rule | Example | Tokens |
|---|---|---|
| a number is digits, maybe `.` and more digits | `12+3.5` | `number + number end` |
| spaces and tabs separate tokens, then vanish | `  7 \t*  2 ` | `number * number end` |
| a name is a letter or `_`, then letters, digits, `_` | `rate_2 = _x` | `name = name end` |
| a digit can't start a name | `2x` | `number name end` |
| anything else is a `SyntaxError` | `2 $ 3`, `3.`, `1.2.3` | (throws) |

```cpp file=tests/tokenizer_test.cpp provided
// Provided by the lesson: the specification for tokenize().
#include "studio_test.hpp"

#include "interp/tokenizer.h"

#include <string>
#include <string_view>

using interp::TokenKind;

namespace {

// The kinds of a line's tokens as words, such as "number + name end":
// easy to compare, and easy to read when a check fails.
std::string kinds(std::string_view line)
{
    std::string result;
    for (const interp::Token& token : interp::tokenize(line)) {
        if (!result.empty())
            result += ' ';
        switch (token.kind) {
        case TokenKind::number: result += "number"; break;
        case TokenKind::identifier: result += "name"; break;
        case TokenKind::plus: result += "+"; break;
        case TokenKind::minus: result += "-"; break;
        case TokenKind::star: result += "*"; break;
        case TokenKind::slash: result += "/"; break;
        case TokenKind::left_paren: result += "("; break;
        case TokenKind::right_paren: result += ")"; break;
        case TokenKind::equals: result += "="; break;
        case TokenKind::end: result += "end"; break;
        }
    }
    return result;
}

} // namespace

TEST(empty_line_has_only_the_end_token)
{
    CHECK_EQ(kinds(""), "end");
}

TEST(reads_numbers_and_operators)
{
    CHECK_EQ(kinds("12+3.5"), "number + number end");
    const auto tokens = interp::tokenize("12+3.5");
    CHECK_EQ(tokens[0].text, "12");
    CHECK_EQ(tokens[0].value, 12.0);
    CHECK_EQ(tokens[2].text, "3.5");
    CHECK_EQ(tokens[2].value, 3.5);
}

TEST(skips_spaces_and_tabs)
{
    CHECK_EQ(kinds("  7 \t*  2 "), "number * number end");
}

TEST(reads_every_symbol)
{
    CHECK_EQ(kinds("+-*/()="), "+ - * / ( ) = end");
}

TEST(reads_names)
{
    CHECK_EQ(kinds("rate_2 = _x"), "name = name end");
    const auto tokens = interp::tokenize("rate_2 = _x");
    CHECK_EQ(tokens[0].text, "rate_2");
    CHECK_EQ(tokens[2].text, "_x");
}

TEST(a_name_cannot_start_with_a_digit)
{
    // "2x" is the number 2, then the name x.
    CHECK_EQ(kinds("2x"), "number name end");
}

TEST(rejects_unknown_characters)
{
    CHECK_THROWS(interp::tokenize("2 $ 3"), interp::SyntaxError);
    CHECK_THROWS(interp::tokenize("x % 2"), interp::SyntaxError);
}

TEST(a_point_needs_digits_after_it)
{
    CHECK_THROWS(interp::tokenize("3."), interp::SyntaxError);
    CHECK_THROWS(interp::tokenize("3.x"), interp::SyntaxError);
    CHECK_THROWS(interp::tokenize("1.2.3"), interp::SyntaxError);
}
```

```check
file tests/tokenizer_test.cpp
```

## Step 8 — Write the tokenizer

**This step: write `src/tokenizer.cpp`. Then configure, build and run the tests.**

Walk through the line with an index `i`. At each position, the character decides what comes next:

| Character | Do |
|---|---|
| space or tab | skip it |
| digit | read digits; if a `.` follows, it must be followed by more digits; convert the text with `std::stod` |
| letter or `_` | read letters, digits and `_` as one name |
| `+ - * / ( ) =` | one token of that kind |
| anything else | `throw SyntaxError("unexpected character '$'")` |

Finish with `tokens.push_back({TokenKind::end, ""});`.

Two details matter:

- `<cctype>` functions such as `std::isdigit` take an `int` that must be a valid `unsigned char` value. A `char` can be negative (é in UTF-8 is two negative `char`s), and passing one is undefined behaviour. Convert first: `std::isdigit(static_cast<unsigned char>(c))`. Small helpers (`is_digit`, `starts_name`) keep that noise out of the loop.
- Put the helpers in an unnamed `namespace { }`: they're private to this file.

```cpp
std::vector<Token> tokenize(std::string_view line)
{
    std::vector<Token> tokens;
    std::size_t i = 0;
    while (i < line.size()) {
        const char c = line[i];
        const std::size_t start = i;
        if (is_space(c)) {
            ++i;
        } else if (is_digit(c)) {
            // ... advance i past the number ...
            std::string text(line.substr(start, i - start));
            const double value = std::stod(text);
            tokens.push_back(
                {TokenKind::number, std::move(text), value});
        } else ...
    }
    tokens.push_back({TokenKind::end, ""});
    return tokens;
}
```

```text
cmake -S . -B build -G "MinGW Makefiles"     (Windows)
cmake -S . -B build                          (macOS, Linux)
```

```text
cmake --build build
./build/interp_tests
```

Then ask Git what it thinks: `git status`. The `build` folder isn't listed. That's your `.gitignore` at work.

```cpp file=src/tokenizer.cpp
#include "interp/tokenizer.h"

#include <cctype>

namespace interp {

namespace {

bool is_space(char c)
{
    return std::isspace(static_cast<unsigned char>(c)) != 0;
}

bool is_digit(char c)
{
    return std::isdigit(static_cast<unsigned char>(c)) != 0;
}

bool starts_name(char c)
{
    return std::isalpha(static_cast<unsigned char>(c)) != 0 || c == '_';
}

bool continues_name(char c)
{
    return starts_name(c) || is_digit(c);
}

TokenKind symbol_kind(char c)
{
    switch (c) {
    case '+': return TokenKind::plus;
    case '-': return TokenKind::minus;
    case '*': return TokenKind::star;
    case '/': return TokenKind::slash;
    case '(': return TokenKind::left_paren;
    case ')': return TokenKind::right_paren;
    case '=': return TokenKind::equals;
    }
    throw SyntaxError(std::string("unexpected character '") + c + "'");
}

} // namespace

std::vector<Token> tokenize(std::string_view line)
{
    std::vector<Token> tokens;
    std::size_t i = 0;
    while (i < line.size()) {
        const char c = line[i];
        const std::size_t start = i;
        if (is_space(c)) {
            ++i;
        } else if (is_digit(c)) {
            while (i < line.size() && is_digit(line[i]))
                ++i;
            if (i < line.size() && line[i] == '.') {
                ++i;
                if (i == line.size() || !is_digit(line[i]))
                    throw SyntaxError("a number needs digits after '.'");
                while (i < line.size() && is_digit(line[i]))
                    ++i;
            }
            std::string text(line.substr(start, i - start));
            const double value = std::stod(text);
            tokens.push_back({TokenKind::number, std::move(text), value});
        } else if (starts_name(c)) {
            while (i < line.size() && continues_name(line[i]))
                ++i;
            tokens.push_back({TokenKind::identifier,
                              std::string(line.substr(start, i - start))});
        } else {
            tokens.push_back({symbol_kind(c), std::string(1, c)});
            ++i;
        }
    }
    tokens.push_back({TokenKind::end, ""});
    return tokens;
}

} // namespace interp
```

```check
file build/CMakeCache.txt label="build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build build"
tests "./build/interp_tests" require="reads_numbers_and_operators reads_every_symbol reads_names a_name_cannot_start_with_a_digit rejects_unknown_characters a_point_needs_digits_after_it" -- A number with a point needs a digit right after it: throw SyntaxError when there is none.
```

## Step 9 — Commit the tokenizer

**This step: review what you're about to commit, then commit it.**

```text
git status
git add -A
git status
git diff --staged
git commit -m "Add a tokenizer, with its tests"
git log --oneline
```

- `git status` before `add`: everything new is **untracked**. `build/` isn't there.
- `git add -A` stages every change in the folder: new, changed and deleted files. It's safe only because `.gitignore` keeps the build out. Read the second `git status` before committing, every time.
- `git diff --staged` shows exactly what the commit will contain, line by line (press `q` to leave the pager). Reviewing your own diff before committing catches leftover debugging lines, and files you didn't mean to touch.
- `git log --oneline` lists the history, newest first: two commits.

**Experiment:** change a line in `src/tokenizer.cpp`, then run `git diff` (no `--staged`): it shows changes not staged yet. `git restore src/tokenizer.cpp` throws the change away and puts back the committed version. `git restore` can't be undone, so use it only for changes you really don't want.

| Command | Shows |
|---|---|
| `git status` | which files changed, and which are staged |
| `git diff` | changes not staged yet |
| `git diff --staged` | what the next commit will contain |
| `git log --oneline` | the history |

```check
git-tracked src/tokenizer.cpp
git-tracked testing/studio_test.hpp
git-untracked build/CMakeCache.txt label="the build folder is not committed"
git-clean -- Stage everything with git add -A, then commit.
git-message "tokenizer" label="a commit message mentions the tokenizer"
```
