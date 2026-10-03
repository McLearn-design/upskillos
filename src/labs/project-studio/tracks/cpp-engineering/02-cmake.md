---
title: 2 — CMake for Real Projects: a Library, an App and Tests
track: Software Engineering in C++
runtime: cpp
reference: optional
console: true
---

So far, `interp_tests` compiles `src/tokenizer.cpp` itself. Add a program people can run, and it would compile `tokenizer.cpp` again. Add a second test program, and again. Real projects put their code in a **library**, built once, and link everything else to it:

```text
              interp_core  (library: src/*.cpp)
              ^         ^
     links to |         | links to
            calc     interp_tests
           (app)       (tests)
```

This lesson builds that shape with **targets**, the unit CMake thinks in, and runs the tests with **CTest**. On the way, a colleague's parser joins the project. Read it as you would at work: it's someone else's code, in someone else's style.

## Step 1 — A colleague's parser: the interface

**This step: create the supplied `include/interp/parser.h` and read it.**

The **parser** turns tokens into a **syntax tree**: the structure the text implies. `1 + 2 * 3` becomes:

```text
      +
     / \
    1   *            to_string: (1 + (2 * 3))
       / \
      2   3
```

The `*` sits lower in the tree, so it's done first: that's precedence, decided once, by the parser, and never again.

- An `Expr` is one node. `kind` says which members matter: a `binary` node uses `op`, `left` and `right`; a `number` node uses only `value`.
- Children are `std::unique_ptr<Expr>`: each node **owns** its children, so destroying the root frees the whole tree (*Memory, Lifetime and Ownership*).
- `to_string` prints a tree with every group in parentheses. It's how the tests see a tree's shape.

```cpp file=include/interp/parser.h provided
#pragma once

#include <memory>
#include <string>
#include <string_view>

namespace interp {

// One node of a syntax tree. `kind` says which members are used.
struct Expr {
    enum class Kind { number, variable, negate, binary, assign };

    Kind kind = Kind::number;
    double value = 0;            // number: its value
    std::string name;            // variable, assign: the variable
    char op = 0;                 // binary: '+', '-', '*' or '/'
    std::unique_ptr<Expr> left;  // binary: the left side;
                                 // negate, assign: the operand
    std::unique_ptr<Expr> right; // binary: the right side
};

// Parses one line: an expression such as 1 + 2 * x, or an
// assignment such as x = 1 + 2. Throws SyntaxError.
std::unique_ptr<Expr> parse(std::string_view line);

// The tree in fully parenthesized form, e.g. "(1 + (2 * x))".
std::string to_string(const Expr& expr);

} // namespace interp
```

```check
file include/interp/parser.h
```

## Step 2 — A colleague's parser: the code

**This step: create the supplied `src/parser.cpp` and read it.**

It's a **recursive-descent** parser: one function per rule of the grammar in its comment, each calling the rules below it. The lower a rule, the tighter its operators bind:

| Rule | Reads | Calls |
|---|---|---|
| `statement` | `x = ...` or an expression | `statement` (for `a = b = 1`), `expression` |
| `expression` | `+` and `-` | `term` |
| `term` | `*` and `/` | `factor` |
| `factor` | a leading `-` | `factor`, `primary` |
| `primary` | a number, a name, `( ... )` | `expression` |

You'll notice it's written in a different style from the tokenizer: two-space indents, braces on the same line, `Token const &`. Two styles in one project is a real cost (every reader adjusts, every diff mixes style with substance), and lesson 4 fixes it with a tool, not with an argument. Leave it as it is for now.

```cpp file=src/parser.cpp provided
#include "interp/parser.h"
#include "interp/tokenizer.h"
#include <sstream>
#include <utility>
#include <vector>

namespace interp {
namespace {

typedef std::unique_ptr<Expr> ExprPtr;

ExprPtr make_number(double value) {
  auto e = std::make_unique<Expr>();
  e->kind = Expr::Kind::number; e->value = value;
  return e;
}

ExprPtr make_variable(std::string name) {
  auto e = std::make_unique<Expr>();
  e->kind = Expr::Kind::variable; e->name = std::move(name);
  return e;
}

ExprPtr make_negate(ExprPtr operand) {
  auto e = std::make_unique<Expr>();
  e->kind = Expr::Kind::negate; e->left = std::move(operand);
  return e;
}

ExprPtr make_binary(char op, ExprPtr left, ExprPtr right) {
  auto e = std::make_unique<Expr>();
  e->kind = Expr::Kind::binary; e->op = op;
  e->left = std::move(left); e->right = std::move(right);
  return e;
}

ExprPtr make_assign(std::string name, ExprPtr value) {
  auto e = std::make_unique<Expr>();
  e->kind = Expr::Kind::assign; e->name = std::move(name);
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
class Parser
{
  public:
  explicit Parser(std::vector<Token> tokens) : tokens_(tokens) {}

  ExprPtr parse_line() {
    ExprPtr result = statement();
    if (peek().kind != TokenKind::end) throw SyntaxError("unexpected '" + peek().text + "'");
    return result;
  }

  private:
  Token const &peek() const { return tokens_[pos_]; }
  Token const &advance() { return tokens_[pos_++]; }

  bool accept(TokenKind kind) {
    if (peek().kind != kind) return false;
    ++pos_;
    return true;
  }

  ExprPtr statement() {
    // The end token is always there, so pos_ + 1 is in range.
    if (peek().kind == TokenKind::identifier && tokens_[pos_ + 1].kind == TokenKind::equals) {
      std::string name = advance().text;
      advance();  // the "="
      return make_assign(std::move(name), statement());
    }
    return expression();
  }

  ExprPtr expression() {
    ExprPtr left = term();
    if (peek().kind == TokenKind::plus || peek().kind == TokenKind::minus) {
      char op = advance().text[0];
      return make_binary(op, std::move(left), expression());
    }
    return left;
  }

  ExprPtr term() {
    ExprPtr left = factor();
    if (peek().kind == TokenKind::star || peek().kind == TokenKind::slash) {
      char op = advance().text[0];
      return make_binary(op, std::move(left), term());
    }
    return left;
  }

  ExprPtr factor() {
    if (accept(TokenKind::minus)) return make_negate(factor());
    return primary();
  }

  ExprPtr primary() {
    Token const &token = peek();
    if (accept(TokenKind::number)) return make_number(token.value);
    if (accept(TokenKind::identifier)) return make_variable(token.text);
    if (accept(TokenKind::left_paren)) {
      ExprPtr inside = expression();
      if (!accept(TokenKind::right_paren)) throw SyntaxError("expected ')'");
      return inside;
    }
    if (token.kind == TokenKind::end) throw SyntaxError("unexpected end of line");
    throw SyntaxError("unexpected '" + token.text + "'");
  }

  std::vector<Token> tokens_;
  std::size_t pos_ = 0;
};

}  // namespace

std::unique_ptr<Expr> parse(std::string_view line) {
  Parser parser(tokenize(line));
  return parser.parse_line();
}

std::string to_string(const Expr &expr) {
  std::ostringstream out;
  switch (expr.kind) {
    case Expr::Kind::number: out << expr.value; break;
    case Expr::Kind::variable: out << expr.name; break;
    case Expr::Kind::negate: out << "(-" << to_string(*expr.left) << ')'; break;
    case Expr::Kind::binary: out << '(' << to_string(*expr.left) << ' ' << expr.op << ' ' << to_string(*expr.right) << ')'; break;
    case Expr::Kind::assign: out << '(' << expr.name << " = " << to_string(*expr.left) << ')'; break;
  }
  return out.str();
}

}  // namespace interp
```

```check
file src/parser.cpp
```

## Step 3 — The parser's tests

**This step: create the supplied `tests/parser_test.cpp` and read it.**

The helper `tree("1 + 2 * 3")` parses a line and returns `"(1 + (2 * 3))"`, so each check states a tree's shape in one line. The tests promise precedence, parentheses, negation, assignment, and a `SyntaxError` for lines that aren't valid, including `3 = x`.

The build file doesn't know about `parser.cpp` yet. The next step fixes that, properly.

```cpp file=tests/parser_test.cpp provided
// Provided with the parser: what it promises.
#include "studio_test.hpp"

#include "interp/parser.h"
#include "interp/tokenizer.h"

#include <string>

namespace {

// Parses a line and shows the tree, fully parenthesized.
std::string tree(const std::string& line)
{
    return interp::to_string(*interp::parse(line));
}

} // namespace

TEST(parses_a_number_and_a_name)
{
    CHECK_EQ(tree("42"), "42");
    CHECK_EQ(tree("2.5"), "2.5");
    CHECK_EQ(tree("rate"), "rate");
}

TEST(multiplication_binds_tighter_than_addition)
{
    CHECK_EQ(tree("1 + 2 * 3"), "(1 + (2 * 3))");
    CHECK_EQ(tree("1 * 2 + 3"), "((1 * 2) + 3)");
    CHECK_EQ(tree("8 / 4 - 1"), "((8 / 4) - 1)");
}

TEST(parentheses_group_first)
{
    CHECK_EQ(tree("(1 + 2) * 3"), "((1 + 2) * 3)");
}

TEST(minus_in_front_negates)
{
    CHECK_EQ(tree("-x"), "(-x)");
    CHECK_EQ(tree("2 * -3"), "(2 * (-3))");
}

TEST(assignment_has_a_name_on_the_left)
{
    CHECK_EQ(tree("x = 1 + 2"), "(x = (1 + 2))");
}

TEST(bad_lines_are_syntax_errors)
{
    CHECK_THROWS(interp::parse(""), interp::SyntaxError);
    CHECK_THROWS(interp::parse("1 +"), interp::SyntaxError);
    CHECK_THROWS(interp::parse("(1 + 2"), interp::SyntaxError);
    CHECK_THROWS(interp::parse("1 2"), interp::SyntaxError);
    CHECK_THROWS(interp::parse("3 = x"), interp::SyntaxError);
}
```

```check
file tests/parser_test.cpp
```

## Step 4 — The app

**This step: write `app/main.cpp`, the `calc` program. For now it shows how each line parses.**

| Run | Prints |
|---|---|
| `calc "1 + 2 * 3"` | `(1 + (2 * 3))` |
| `calc "1 +"` | `error: unexpected end of line` |
| `calc` (no arguments) | reads lines until the input ends; blank lines are skipped |

Every argument is parsed as a line. `main` returns `1` if **any** line failed, so scripts (and CTest, next step) can tell. A helper that parses one line and prints the result keeps `main` short:

```cpp
bool show_line(const std::string& line)
{
    try {
        const auto tree = interp::parse(line);
        std::cout << interp::to_string(*tree) << '\n';
        return true;
    } catch (const interp::SyntaxError& e) {
        std::cout << "error: " << e.what() << '\n';
        return false;
    }
}
```

In `main`: `all_worked = show_line(argv[i]) && all_worked;`. The order matters: `all_worked && show_line(...)` would stop running lines after the first failure, because `&&` skips its right side when the left is false.

It isn't built yet: that's next.

```cpp file=app/main.cpp
// calc: for now, shows how each line parses.
//
//   calc "1 + 2 * 3"   parses each argument as a line
//   calc               reads lines until the input ends
#include "interp/parser.h"
#include "interp/tokenizer.h"

#include <iostream>
#include <string>

namespace {

// Parses one line, printing its tree or "error: why". Returns
// whether it worked.
bool show_line(const std::string& line)
{
    try {
        const auto tree = interp::parse(line);
        std::cout << interp::to_string(*tree) << '\n';
        return true;
    } catch (const interp::SyntaxError& e) {
        std::cout << "error: " << e.what() << '\n';
        return false;
    }
}

bool is_blank(const std::string& line)
{
    return line.find_first_not_of(" \t\r") == std::string::npos;
}

} // namespace

int main(int argc, char* argv[])
{
    bool all_worked = true;
    if (argc > 1) {
        for (int i = 1; i < argc; ++i)
            all_worked = show_line(argv[i]) && all_worked;
    } else {
        std::string line;
        while (std::getline(std::cin, line)) {
            if (!is_blank(line))
                all_worked = show_line(line) && all_worked;
        }
    }
    return all_worked ? 0 : 1;
}
```

```check
contains app/main.cpp "interp::parse"
contains app/main.cpp "SyntaxError"
```

## Step 5 — Targets: a library, an app, the tests

**This step: rewrite `CMakeLists.txt` with a library, the app and the tests, then build and run CTest.**

A **target** is anything CMake builds, plus everything needed to use it: its sources, its include folders, its compiler options, what it links to. In modern CMake you describe targets and their relationships, and CMake works out the command lines.

```cmake
add_library(interp_core
    src/tokenizer.cpp
    src/parser.cpp)
target_include_directories(interp_core PUBLIC include)

add_executable(calc app/main.cpp)
target_link_libraries(calc PRIVATE interp_core)
```

- `add_library` compiles the sources once, into a **static library**: an archive of compiled code (`libinterp_core.a`, or `.lib`).
- `target_link_libraries(calc PRIVATE interp_core)` links `calc` to it, **and** gives `calc` whatever `interp_core` says its users need.

That last part is the key idea, **usage requirements**. Each setting has a scope:

| Keyword | Applies to the target itself | Passed on to targets that link to it |
|---|---|---|
| `PRIVATE` | yes | no |
| `INTERFACE` | no | yes |
| `PUBLIC` | yes | yes |

`include` is `PUBLIC`: the library's own `.cpp` files need its headers, and so does everyone who uses the library. The warning flags are different: they're how *we* build, not something users need. They go in **`interp_options`**, an `INTERFACE` library: it has no code at all, only settings that every target which links to it receives.

The tests become CTest tests:

```cmake
enable_testing()
add_test(NAME unit_tests COMMAND interp_tests)
add_test(NAME calc_accepts_a_line COMMAND calc "1 + 2 * 3")
add_test(NAME calc_rejects_bad_syntax COMMAND calc "1 +")
set_tests_properties(calc_rejects_bad_syntax PROPERTIES WILL_FAIL TRUE)
```

A CTest test is a command that **passes when it exits with 0**. `COMMAND interp_tests` uses the target's name, and CMake substitutes the path of the built program. `WILL_FAIL` inverts the result: the test passes only if `calc "1 +"` reports failure.

The whole file is in the reference below. Then:

```text
cmake --build build
ctest --test-dir build
```

`cmake --build` sees the changed `CMakeLists.txt` and reconfigures by itself.

```text
1/3 Test #1: unit_tests ...............   Passed    0.01 sec
2/3 Test #2: calc_accepts_a_line ......   Passed    0.00 sec
3/3 Test #3: calc_rejects_bad_syntax ..   Passed    0.00 sec

100% tests passed, 0 tests failed out of 3
```

Why CTest, when `interp_tests` already runs every test? Because a real project has many test programs, and scripts, and command-line checks like these two. CTest runs them all, in parallel with `-j`, and gives one answer. Add `--output-on-failure` to see a failing program's output.

```cmake file=CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(interp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

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
    src/parser.cpp)
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
```

```check
matches CMakeLists.txt "add_library\s*\(\s*interp_core\b" label="CMakeLists.txt adds the interp_core library"
matches CMakeLists.txt "target_include_directories\s*\(\s*interp_core\s+PUBLIC\s+include" label="interp_core's include folder is PUBLIC"
matches CMakeLists.txt "target_link_libraries\s*\(\s*calc\s+PRIVATE\s+interp_core" label="calc links to interp_core"
run "cmake --build build" -- Every target that includes "interp/..." headers must get the include folder: make it PUBLIC on interp_core and link to interp_core.
run "ctest --test-dir build" stdout="100% tests passed" -- Run ctest --test-dir build --output-on-failure to see what failed.
```

## Step 6 — Your own parser tests

**This step: create `tests/parser_more_test.cpp` with at least three tests of cases the provided tests don't try. Build and run CTest.**

You're the second reader of this parser. Probe what the provided tests skip:

- nested parentheses: `((1))`, `2 * (3 + (4 - 1))`;
- names mixed with operators: `rate * hours + bonus`;
- a minus in front of a group: `-(1 + 2)` is `(-(1 + 2))`;
- broken lines: `1 + 2)`, `()`.

Start the file with the same includes and `tree` helper as `parser_test.cpp`. The helper is in an unnamed namespace in each file, so the two copies don't clash.

The glob in `CMakeLists.txt` picks up the new file, and `CONFIGURE_DEPENDS` makes `cmake --build` notice it.

> 🔬 To watch the recursion, put a breakpoint on `Parser::expression` in your debugger, run `calc "1 + 2 * 3"`, and look at the call stack (`bt`) each time it stops: `statement → expression → term → factor → primary`, one frame per grammar rule.

```cpp file=tests/parser_more_test.cpp
// My own tests for the parser: cases the provided tests don't try.
#include "studio_test.hpp"

#include "interp/parser.h"
#include "interp/tokenizer.h"

#include <string>

namespace {

std::string tree(const std::string& line)
{
    return interp::to_string(*interp::parse(line));
}

} // namespace

TEST(nested_parentheses)
{
    CHECK_EQ(tree("((1))"), "1");
    CHECK_EQ(tree("2 * (3 + (4 - 1))"), "(2 * (3 + (4 - 1)))");
}

TEST(names_work_like_numbers)
{
    CHECK_EQ(tree("rate * hours + bonus"), "((rate * hours) + bonus)");
}

TEST(minus_applies_to_a_group)
{
    CHECK_EQ(tree("-(1 + 2)"), "(-(1 + 2))");
}

TEST(an_unclosed_or_stray_parenthesis_is_an_error)
{
    CHECK_THROWS(interp::parse("(1 + 2"), interp::SyntaxError);
    CHECK_THROWS(interp::parse("1 + 2)"), interp::SyntaxError);
    CHECK_THROWS(interp::parse("()"), interp::SyntaxError);
}
```

```check
matches tests/parser_more_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="parser_more_test.cpp has at least three tests"
run "cmake --build build"
run "ctest --test-dir build" stdout="100% tests passed"
```

## Step 7 — Commit the new structure

**This step: check `calc` by hand, then commit.**

```text
./build/calc "1 + 2 * 3" "(1 + 2) * 3" "x = -y"
git status
git add -A
git commit -m "Split into a library, an app and tests; add the parser"
```

Look at `git status` before you add: `CMakeLists.txt` is **modified**, the parser files and `app/` are **new**. `git diff CMakeLists.txt` shows the old and new build side by side.

**Did you move files?** If you ever reorganise folders, use `git mv old new` instead of moving them yourself: Git then records a rename, and `git log --follow new` still finds the file's whole history.

```check
run "./build/calc \"1 + 2 * 3\" \"(1 + 2) * 3\"" stdout="(1 + (2 * 3))\n((1 + 2) * 3)"
git-tracked src/parser.cpp
git-tracked app/main.cpp
git-clean
```
