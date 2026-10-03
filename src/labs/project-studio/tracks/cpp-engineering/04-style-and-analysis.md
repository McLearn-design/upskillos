---
title: 4 — One Style, Checked by Tools: clang-format and clang-tidy
track: Software Engineering in C++
runtime: cpp
reference: optional
console: true
---

interp has two styles: yours, and the colleague's parser. Reviews of code like that drift into arguments about braces, and real problems get less attention. The professional answer is to let **tools** decide the mechanical questions:

| Tool | Answers | Changes code? |
|---|---|---|
| **clang-format** | how code is laid out: indentation, braces, line breaks | yes, rewrites files to match a style file |
| **clang-tidy** | is this code likely wrong or wasteful? | reports; can apply some fixes |

Both come from the LLVM project, and both read a settings file in the repository, so everyone (and continuous integration, in lesson 6) gets the same answer.

**Do you have them?** Run `clang-format --version` and `clang-tidy --version`.

| System | How to get them |
|---|---|
| Windows, the app's compiler (llvm-mingw) | included, next to `g++` |
| Windows, other compilers | install LLVM from llvm.org, or `winget install LLVM.LLVM` |
| macOS | `brew install llvm`, then use `$(brew --prefix llvm)/bin/clang-tidy` (Xcode doesn't include them) |
| Ubuntu, Debian | `sudo apt install clang-format clang-tidy` |

Different versions occasionally format the same code differently. A team pins one version for everyone; for this lesson, any recent one will do.

## Step 1 — A style file

**This step: create `.clang-format` at the top of the project, then see what clang-format thinks of the parser.**

clang-format looks for a file called `.clang-format` in the file's folder, then in each folder above. One file at the top of the repository covers everything.

| Setting | Means |
|---|---|
| `BasedOnStyle: LLVM` | start from a well-known style, then change only what you must |
| `IndentWidth: 4` | four spaces per level |
| `ColumnLimit: 80` | wrap lines longer than 80 characters |
| `AccessModifierOffset: -4` | `public:` lines up with `class` |
| `BraceWrapping: AfterFunction: true` | a function's `{` goes on its own line |
| `AllowShortFunctionsOnASingleLine: Inline` | one-line bodies only inside a class |
| `PointerAlignment: Left` | `Token& t`, not `Token &t` |

Then ask, without changing anything:

```text
clang-format --dry-run --Werror src/parser.cpp
```

```text
src/parser.cpp:12:34: error: code should be clang-formatted
    [-Wclang-format-violations]
ExprPtr make_number(double value) {
                                 ^
```

More than a hundred places. `--dry-run` reports instead of rewriting; `--Werror` makes it an error, so the exit code isn't 0. That's what makes it usable in scripts: **the exit code is the answer**, and the messages are for people.

Try your own `src/tokenizer.cpp` too. If you typed it the way the lessons showed it, it may already be clean.

```yaml file=.clang-format
# How every C++ file in this project is laid out. clang-format reads
# this file; run it instead of arguing about style in reviews.
BasedOnStyle: LLVM
IndentWidth: 4
ColumnLimit: 80
AccessModifierOffset: -4
BreakBeforeBraces: Custom
BraceWrapping:
  AfterFunction: true
AllowShortFunctionsOnASingleLine: Inline
AllowShortCaseLabelsOnASingleLine: true
PointerAlignment: Left
```

```check
run "clang-format --version" label="clang-format is installed" -- See the table at the top of the lesson.
contains .clang-format "BasedOnStyle: LLVM"
contains .clang-format "IndentWidth: 4"
```

## Step 2 — format and check-format targets

**This step: add a `format` and a `check-format` target to `CMakeLists.txt`, run `format`, then `check-format`.**

Typing the list of files for clang-format every time is error-prone. Let the build know it:

```cmake
find_program(CLANG_FORMAT clang-format)
if(CLANG_FORMAT)
    file(GLOB_RECURSE FORMAT_SOURCES CONFIGURE_DEPENDS
        include/*.h src/*.cpp app/*.cpp tests/*.cpp)
    add_custom_target(format
        COMMAND ${CLANG_FORMAT} -i ${FORMAT_SOURCES}
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
    add_custom_target(check-format
        COMMAND ${CLANG_FORMAT} --dry-run --Werror ${FORMAT_SOURCES}
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
endif()
```

- `find_program` looks for the tool on the `PATH`. If it isn't there, the targets simply don't exist, and the normal build still works for people without it.
- `add_custom_target` makes a target that runs a command instead of compiling. It isn't part of the default build: you ask for it with `--target`.
- `testing/` isn't in the list: it's someone else's code, and you don't restyle code you'll later update from upstream.

While you're in the file, add this near the top, for the next steps:

```cmake
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
```

It makes CMake write `build/compile_commands.json`: every source file with the exact compiler command that builds it. clang-tidy and editors (clangd, VS Code) read it to see your code as the compiler does.

```text
cmake --build build
cmake --build build --target format
cmake --build build --target check-format
./build/interp_tests
```

Build first: a target that's new in `CMakeLists.txt` doesn't exist until CMake has rerun, and a plain `cmake --build` is what notices the change and reruns it. Asked for `--target format` straight away, `make` answers `No rule to make target 'format'`.

`format` rewrites every file in place (`-i`). `check-format` now passes. Formatting never changes what code means, and the tests prove it here.

```cmake file=CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(interp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
# Write build/compile_commands.json, for clang-tidy and editors.
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Settings every target in this project uses. An INTERFACE library
# has no code: linking to it just passes its settings on.
add_library(interp_options INTERFACE)
if(MSVC)
    target_compile_options(interp_options INTERFACE /W4)
else()
    target_compile_options(interp_options INTERFACE -Wall -Wextra -Wpedantic)
endif()

# The interpreter: a library, shared by the app and the tests.
add_library(interp_core
    src/tokenizer.cpp
    src/parser.cpp
    src/interpreter.cpp)
target_include_directories(interp_core PUBLIC include)
target_link_libraries(interp_core PRIVATE interp_options)

# The program people run.
add_executable(calc app/main.cpp)
target_link_libraries(calc PRIVATE interp_core interp_options)

# The tests: ctest runs every add_test.
enable_testing()
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(interp_tests testing/test_main.cpp ${TEST_SOURCES})
target_include_directories(interp_tests PRIVATE testing)
target_link_libraries(interp_tests PRIVATE interp_core interp_options)
add_test(NAME unit_tests COMMAND interp_tests)

# calc itself: a line that works exits with 0; one that doesn't
# must fail (WILL_FAIL turns "exited with 1" into a pass).
add_test(NAME calc_accepts_a_line COMMAND calc "1 + 2 * 3")
add_test(NAME calc_rejects_bad_syntax COMMAND calc "1 +")
set_tests_properties(calc_rejects_bad_syntax PROPERTIES WILL_FAIL TRUE)

# Formatting: "format" rewrites the files, "check-format" only checks.
find_program(CLANG_FORMAT clang-format)
if(CLANG_FORMAT)
    file(GLOB_RECURSE FORMAT_SOURCES CONFIGURE_DEPENDS
        include/*.h src/*.cpp app/*.cpp tests/*.cpp)
    add_custom_target(format
        COMMAND ${CLANG_FORMAT} -i ${FORMAT_SOURCES}
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
    add_custom_target(check-format
        COMMAND ${CLANG_FORMAT} --dry-run --Werror ${FORMAT_SOURCES}
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
endif()
```

```check
contains CMakeLists.txt "add_custom_target(check-format"
contains CMakeLists.txt "set(CMAKE_EXPORT_COMPILE_COMMANDS ON)"
run "cmake --build build --target check-format" label="every file is formatted" -- Run cmake --build build --target format first.
run "cmake --build build"
tests "./build/interp_tests"
```

## Step 3 — Commit the formatting on its own

**This step: look at what formatting changed, and commit it by itself.**

```text
git diff --stat
git add -A
git commit -m "Format every file with clang-format"
```

`git diff --stat` lists the files and how many lines changed in each: mostly `src/parser.cpp`.

A formatting commit should contain **nothing else**. Mixed with a real change, the real change hides among hundreds of moved braces, and no reviewer will find it. Kept apart, it can be skipped: list its hash in a file called `.git-blame-ignore-revs` and `git blame` (which shows who last changed each line) looks straight through it to the commits that matter.

```check
git-clean
git-message "clang-format"
git-tracked .clang-format
```

## Step 4 — clang-tidy finds problems

**This step: create `.clang-tidy` at the top of the project, then run clang-tidy on the parser.**

clang-tidy parses your code with a full C++ compiler front end, then runs **checks** on it: patterns that are legal C++ but likely wrong, slow or outdated. There are hundreds. Enabling them all buries you in noise, so a project picks a list:

| Check | Finds |
|---|---|
| `bugprone-dangling-handle` | a `std::string_view` (or similar) that outlives the string it points into |
| `bugprone-use-after-move` | using an object after `std::move` gave its contents away |
| `performance-for-range-copy` | `for (auto x : v)` copying every element when `const auto&` would do |
| `performance-unnecessary-value-param` | a parameter taken by value, then only copied |
| `modernize-use-nullptr` | `NULL` or `0` used as a pointer |
| `modernize-use-using` | `typedef` where `using` reads better |

`-*` first turns everything off, so a newer clang-tidy with more checks gives the same results. `WarningsAsErrors: '*'` makes any finding fail the run, with a non-zero exit code.

```text
clang-tidy --quiet -p build src/parser.cpp
```

`-p build` points at `build/compile_commands.json`, so clang-tidy compiles the file with your project's flags and include folders. It takes a few seconds: it's compiling.

```text
src/parser.cpp:10:1: error: use 'using' instead of 'typedef'
    [modernize-use-using,-warnings-as-errors]
src/parser.cpp:...: error: parameter 'tokens' is passed by value
    and only copied once; consider moving it to avoid unnecessary
    copies [performance-unnecessary-value-param,...]
```

**Predict** before you read on: why is the second one a real cost, and not just style?

```yaml file=.clang-tidy
# Which clang-tidy checks this project uses. Each one finds a real
# kind of bug or waste; -* first turns off everything else.
Checks: >
  -*,
  bugprone-dangling-handle,
  bugprone-use-after-move,
  performance-for-range-copy,
  performance-unnecessary-value-param,
  modernize-use-nullptr,
  modernize-use-using
# A finding fails the run (exit code 1), so scripts and CI notice.
WarningsAsErrors: '*'
# Report problems in our own headers too, not only in .cpp files.
HeaderFilterRegex: 'include/interp/'
```

### What it found

`Parser(std::vector<Token> tokens) : tokens_(tokens)` receives its own vector (moved in from `tokenize`'s result, so far so good), then **copies** it into `tokens_`, every token's string included, and throws the original away. `tokens_(std::move(tokens))` hands the buffer over instead: no copying at all.

`typedef std::unique_ptr<Expr> ExprPtr;` is correct but old-fashioned; `using ExprPtr = std::unique_ptr<Expr>;` reads left to right, and also works for templates.

```check
run "clang-tidy --version" label="clang-tidy is installed" -- See the table at the top of the lesson.
file build/compile_commands.json label="build/compile_commands.json exists" -- Set CMAKE_EXPORT_COMPILE_COMMANDS to ON, then build.
contains .clang-tidy "performance-unnecessary-value-param"
contains .clang-tidy "WarningsAsErrors"
```

## Step 5 — Fix the findings

**This step: fix both findings in `src/parser.cpp`. Then run clang-tidy on every source file, and commit.**

```cpp
using ExprPtr = std::unique_ptr<Expr>;
...
explicit Parser(std::vector<Token> tokens)
    : tokens_(std::move(tokens)) {}
```

Then the whole project, all on one line:

```text
clang-tidy --quiet -p build src/tokenizer.cpp src/parser.cpp
    src/interpreter.cpp app/main.cpp
```

If it reports something in **your** code, fix that too: that's what it's for. Each finding names its check; search for the name in the clang-tidy documentation for the reasoning, and an example. When a finding is wrong for one particular line, `// NOLINT(check-name)` on that line silences it, with the reason in the comment.

```text
cmake --build build --target check-format
cmake --build build
./build/interp_tests
git add -A
git commit -m "Fix clang-tidy findings: move the tokens, use using"
```

```cpp file=src/parser.cpp
#include "interp/parser.h"

#include "interp/tokenizer.h"

#include <sstream>
#include <utility>
#include <vector>

namespace interp {

namespace {

using ExprPtr = std::unique_ptr<Expr>;

ExprPtr make_number(double value)
{
    auto e = std::make_unique<Expr>();
    e->kind = Expr::Kind::number;
    e->value = value;
    return e;
}

ExprPtr make_variable(std::string name)
{
    auto e = std::make_unique<Expr>();
    e->kind = Expr::Kind::variable;
    e->name = std::move(name);
    return e;
}

ExprPtr make_negate(ExprPtr operand)
{
    auto e = std::make_unique<Expr>();
    e->kind = Expr::Kind::negate;
    e->left = std::move(operand);
    return e;
}

ExprPtr make_binary(char op, ExprPtr left, ExprPtr right)
{
    auto e = std::make_unique<Expr>();
    e->kind = Expr::Kind::binary;
    e->op = op;
    e->left = std::move(left);
    e->right = std::move(right);
    return e;
}

ExprPtr make_assign(std::string name, ExprPtr value)
{
    auto e = std::make_unique<Expr>();
    e->kind = Expr::Kind::assign;
    e->name = std::move(name);
    e->left = std::move(value);
    return e;
}

// A recursive-descent parser: one function per grammar rule.
//
//   statement  = name "=" statement | expression
//   expression = term { ("+" | "-") term }
//   term       = factor { ("*" | "/") factor }
//   factor     = "-" factor | primary
//   primary    = number | name | "(" expression ")"
class Parser {
public:
    explicit Parser(std::vector<Token> tokens) : tokens_(std::move(tokens)) {}

    ExprPtr parse_line()
    {
        ExprPtr result = statement();
        if (peek().kind != TokenKind::end)
            throw SyntaxError("unexpected '" + peek().text + "'");
        return result;
    }

private:
    const Token& peek() const { return tokens_[pos_]; }
    const Token& advance() { return tokens_[pos_++]; }

    bool accept(TokenKind kind)
    {
        if (peek().kind != kind)
            return false;
        ++pos_;
        return true;
    }

    ExprPtr statement()
    {
        // The end token is always there, so pos_ + 1 is in range.
        if (peek().kind == TokenKind::identifier &&
            tokens_[pos_ + 1].kind == TokenKind::equals) {
            std::string name = advance().text;
            advance(); // the "="
            return make_assign(std::move(name), statement());
        }
        return expression();
    }

    ExprPtr expression()
    {
        ExprPtr left = term();
        while (peek().kind == TokenKind::plus ||
               peek().kind == TokenKind::minus) {
            const char op = advance().text[0];
            left = make_binary(op, std::move(left), term());
        }
        return left;
    }

    ExprPtr term()
    {
        ExprPtr left = factor();
        while (peek().kind == TokenKind::star ||
               peek().kind == TokenKind::slash) {
            const char op = advance().text[0];
            left = make_binary(op, std::move(left), factor());
        }
        return left;
    }

    ExprPtr factor()
    {
        if (accept(TokenKind::minus))
            return make_negate(factor());
        return primary();
    }

    ExprPtr primary()
    {
        const Token& token = peek();
        if (accept(TokenKind::number))
            return make_number(token.value);
        if (accept(TokenKind::identifier))
            return make_variable(token.text);
        if (accept(TokenKind::left_paren)) {
            ExprPtr inside = expression();
            if (!accept(TokenKind::right_paren))
                throw SyntaxError("expected ')'");
            return inside;
        }
        if (token.kind == TokenKind::end)
            throw SyntaxError("unexpected end of line");
        throw SyntaxError("unexpected '" + token.text + "'");
    }

    std::vector<Token> tokens_;
    std::size_t pos_ = 0;
};

} // namespace

std::unique_ptr<Expr> parse(std::string_view line)
{
    Parser parser(tokenize(line));
    return parser.parse_line();
}

std::string to_string(const Expr& expr)
{
    std::ostringstream out;
    switch (expr.kind) {
    case Expr::Kind::number: out << expr.value; break;
    case Expr::Kind::variable: out << expr.name; break;
    case Expr::Kind::negate: out << "(-" << to_string(*expr.left) << ')'; break;
    case Expr::Kind::binary:
        out << '(' << to_string(*expr.left) << ' ' << expr.op << ' '
            << to_string(*expr.right) << ')';
        break;
    case Expr::Kind::assign:
        out << '(' << expr.name << " = " << to_string(*expr.left) << ')';
        break;
    }
    return out.str();
}

} // namespace interp
```

```check
run "clang-tidy --quiet -p build src/tokenizer.cpp src/parser.cpp src/interpreter.cpp app/main.cpp" timeout=180 label="clang-tidy finds nothing in src/ and app/" -- Read each finding: it names the line and the check.
run "cmake --build build --target check-format"
run "cmake --build build"
tests "./build/interp_tests"
git-clean
```
