---
title: 3 — Testing Like a Professional, on a Branch
track: Software Engineering in C++
runtime: cpp
reference: optional
console: true
---

This lesson adds the interpreter, the part that computes, and it does so the way teams add features: on a **branch**, merged into `main` only when the tests pass and a reviewer is satisfied.

```text
main               o---o---o-------------------o   merge
                            \                 /
feature/variables            o-----o-----o---o
                             tests  code  fix  app
```

On the way you'll meet the ideas a full test framework such as **GoogleTest** adds to the tiny `studio_test.hpp`: fixtures, table-driven tests, and how a failure tells you which case broke. A reviewer's tests will then find a bug that has been in the parser since lesson 2.

## Step 1 — A branch, and two test-framework ideas

**This step: create a branch called `feature/variables`, then create the supplied `testing/studio_extras.hpp` and read it.**

```text
git switch -c feature/variables
git status
```

A **branch** is a movable name for a line of commits. `git switch -c` creates one and switches to it; `git status` now says `On branch feature/variables`. Commits you make here don't touch `main` until you **merge**. So `main` always holds working code, and a half-finished feature can wait on its branch while you fix something urgent on `main`.

`studio_extras.hpp` adds two ideas from GoogleTest:

**Fixtures.** Most interpreter tests begin the same way: make a fresh `Interpreter`. A fixture is a struct holding that shared setup. `TEST_F(Calc, adds)` makes the test's body a member function of a struct derived from `Calc`, so it uses `calc` directly. A **new** fixture object is built for every test, so no test can leak state, such as a variable, into another. That is what makes tests independent of the order they run in.

**Table-driven tests.** Ten cases of "this line gives that value" are one table and one check. `for_each_row(rows, check)` runs the check on each row and, when one fails, adds `in row 3` to the failure message, so you know *which* case broke.

The macro is worth reading: `##` pastes tokens together into one name (`Calc##_##adds` becomes `Calc_adds`), and `#` turns a parameter into a string. GoogleTest's own macros work the same way, with much more around them.

```cpp file=testing/studio_extras.hpp provided
// studio_extras.hpp: two GoogleTest ideas, added to studio_test.hpp.
//
// TEST_F(Fixture, name): the test body runs inside a fresh Fixture
// object, so it uses the fixture's members directly. Every test gets
// its own object: no test can leave state behind for another.
//
//   struct Calc {
//       interp::Interpreter calc;
//   };
//   TEST_F(Calc, adds) { CHECK_EQ(calc.execute("1 + 2"), 3.0); }
//
// for_each_row(rows, check): runs check(row) for every row of a
// table. A failure says which row failed, counting from 1.
#pragma once

#include "studio_test.hpp"

#include <string>

#define TEST_F(fixture, name)                                             \
    namespace {                                                           \
    struct fixture##_##name##_test : fixture {                            \
        void body();                                                      \
    };                                                                    \
    const studio_test::Registrar fixture##_##name##_registrar(            \
        #fixture "." #name, [] {                                          \
            fixture##_##name##_test test;                                 \
            test.body();                                                  \
        });                                                               \
    }                                                                     \
    void fixture##_##name##_test::body()

namespace studio_test {

template <typename Rows, typename Check>
void for_each_row(const Rows& rows, Check check)
{
    int number = 0;
    for (const auto& row : rows) {
        ++number;
        try {
            check(row);
        } catch (Failure& failure) {
            failure.message += "\n    in row " + std::to_string(number);
            throw;
        }
    }
}

} // namespace studio_test
```

```check
git-branch feature/variables -- git switch -c feature/variables
file testing/studio_extras.hpp
```

## Step 2 — The specification, as fixtures and tables

**This step: create the supplied `tests/interpreter_test.cpp` and read it.**

What the tests ask of `interp::Interpreter`:

| Member | Does |
|---|---|
| `double execute(std::string_view line)` | runs one line and returns its value |
| `std::optional<double> variable(name) const` | a variable's value, or `std::nullopt` if it was never assigned |

- An assignment returns the value it stored, and later lines can use the variable.
- An unknown variable and division by zero throw `interp::EvalError`; syntax errors still throw `SyntaxError`.
- `a_failed_line_changes_nothing`: if `x = 1 / 0` fails, `x` keeps its old value. An interpreter that assigns before it finishes computing would break that.

### The same tests in GoogleTest

For comparison, here is how GoogleTest spells the fixture and the table:

```cpp
class Calc : public ::testing::Test {
protected:
    interp::Interpreter calc;
};

TEST_F(Calc, AssignmentRemembers) {
    EXPECT_EQ(calc.execute("x = 6"), 6.0);
    EXPECT_EQ(calc.execute("x * 7"), 42.0);
}

class Arithmetic : public ::testing::TestWithParam<Row> {};
TEST_P(Arithmetic, Evaluates) {
    interp::Interpreter calc;
    EXPECT_EQ(calc.execute(GetParam().line), GetParam().expected);
}
INSTANTIATE_TEST_SUITE_P(Rows, Arithmetic, ::testing::Values(
    Row{"1 + 2", 3}, Row{"6 * 7", 42}));
```

| GoogleTest adds | Why it helps |
|---|---|
| `EXPECT_*` (keep going) and `ASSERT_*` (stop) | see every failed check in a test, not just the first |
| `TEST_P`: each row is a separate test | one row's failure doesn't hide the others |
| `SetUp()` / `TearDown()` in fixtures | setup that can't go in a constructor |
| matchers: `EXPECT_THAT(v, ElementsAre(1, 2))` | precise messages for containers and strings |
| `--gtest_filter=Calc.*`, `--gtest_repeat=100` | run a subset; shake out flaky tests |
| death tests: `EXPECT_DEATH(f(), "msg")` | check that a program aborts |

```cpp file=tests/interpreter_test.cpp provided
// Provided by the lesson: the specification for Interpreter.
#include "studio_extras.hpp"
#include "studio_test.hpp"

#include "interp/interpreter.h"
#include "interp/tokenizer.h"

#include <string>
#include <vector>

// The fixture: every TEST_F(Calc, ...) gets a new, empty interpreter.
struct Calc {
    interp::Interpreter calc;
};

struct Row {
    std::string line;
    double expected;
};

TEST_F(Calc, evaluates_arithmetic)
{
    const std::vector<Row> rows = {
        {"42", 42},     {"1 + 2", 3},     {"7 - 10", -3},     {"6 * 7", 42},
        {"7 / 2", 3.5}, {"1 + 2 * 3", 7}, {"(1 + 2) * 3", 9}, {"-4 + 1", -3},
        {"2 * -3", -6}, {"--5", 5},       {"0.5 * 4", 2},
    };
    studio_test::for_each_row(rows, [&](const Row& row) {
        CHECK_EQ(calc.execute(row.line), row.expected);
    });
}

TEST_F(Calc, assignment_returns_the_value_and_remembers_it)
{
    CHECK_EQ(calc.execute("x = 6"), 6.0);
    CHECK(calc.variable("x") == 6.0);
    CHECK_EQ(calc.execute("x * 7"), 42.0);
}

TEST_F(Calc, assignment_can_change_a_variable)
{
    calc.execute("total = 10");
    calc.execute("total = total + 5");
    CHECK(calc.variable("total") == 15.0);
}

TEST_F(Calc, unknown_variable_is_an_error)
{
    CHECK_THROWS(calc.execute("y + 1"), interp::EvalError);
    CHECK(!calc.variable("y").has_value());
}

TEST_F(Calc, division_by_zero_is_an_error)
{
    CHECK_THROWS(calc.execute("1 / 0"), interp::EvalError);
    CHECK_THROWS(calc.execute("1 / (2 - 2)"), interp::EvalError);
}

TEST_F(Calc, a_failed_line_changes_nothing)
{
    calc.execute("x = 1");
    CHECK_THROWS(calc.execute("x = 1 / 0"), interp::EvalError);
    CHECK(calc.variable("x") == 1.0);
}

TEST_F(Calc, syntax_errors_come_through)
{
    CHECK_THROWS(calc.execute("1 +"), interp::SyntaxError);
}
```

```check
file tests/interpreter_test.cpp
```

## Step 3 — Declare the interpreter

**This step: write `include/interp/interpreter.h` with `EvalError` and the class `Interpreter`.**

```cpp
class EvalError : public std::runtime_error {
public:
    using std::runtime_error::runtime_error;
};

class Interpreter {
public:
    double execute(std::string_view line);
    std::optional<double> variable(std::string_view name) const;

private:
    double evaluate(const Expr& expr);
    std::map<std::string, double, std::less<>> variables_;
};
```

- `variables_` maps names to values. `std::less<>` (with empty angle brackets) is a **transparent** comparator: it lets `find` take a `std::string_view` directly. With the default `std::less<std::string>`, every lookup would first build a temporary `std::string`.
- `evaluate` is private: callers give text to `execute`, never trees.
- Include `"interp/parser.h"` for `Expr`, and `<functional>`, `<map>`, `<optional>`, `<stdexcept>`, `<string>` and `<string_view>` for the rest. A header includes what **it** uses, so it compiles wherever it's included.

```cpp file=include/interp/interpreter.h
#pragma once

#include "interp/parser.h"

#include <functional>
#include <map>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>

namespace interp {

// Thrown when a line parses but can't be evaluated.
class EvalError : public std::runtime_error {
public:
    using std::runtime_error::runtime_error;
};

// Runs lines of the calculator language, remembering variables
// from one line to the next.
class Interpreter {
public:
    // Runs one line and returns its value. Throws SyntaxError or
    // EvalError, and then nothing has changed.
    double execute(std::string_view line);

    // The variable's value, or nothing if it was never assigned.
    std::optional<double> variable(std::string_view name) const;

private:
    double evaluate(const Expr& expr);

    // std::less<> lets find() take a std::string_view.
    std::map<std::string, double, std::less<>> variables_;
};

} // namespace interp
```

```check
contains include/interp/interpreter.h "class EvalError"
contains include/interp/interpreter.h "class Interpreter"
matches include/interp/interpreter.h "std::map\s*<\s*std::string\s*,\s*double\s*,\s*std::less\s*<\s*>\s*>" label="variables are a std::map<std::string, double, std::less<>>"
```

## Step 4 — Evaluate the tree

**This step: write `src/interpreter.cpp`.**

`evaluate` is a `switch` on the node's kind, calling itself for the children: the tree's shape decides the order of the arithmetic.

| Kind | Value |
|---|---|
| `number` | `expr.value` |
| `variable` | the stored value; if there is none, throw `EvalError("unknown variable 'y'")` |
| `negate` | `-evaluate(*expr.left)` |
| `binary` | evaluate both sides, then apply `op`; `/` by zero throws `EvalError("division by zero")` |
| `assign` | evaluate the right side **first**, then store it, then return it |

```cpp
double Interpreter::execute(std::string_view line)
{
    const std::unique_ptr<Expr> tree = parse(line);
    return evaluate(*tree);
}
```

`variable` is a `find` on the map: return `found->second`, or `std::nullopt` when `found == variables_.end()`.

The order in `assign` is what `a_failed_line_changes_nothing` checks. If you wrote `variables_[expr.name] = evaluate(*expr.left);`, C++17 evaluates the right side first, so it would work, but `variables_[name]` *creates* the entry for a new name, so a reader has to know that rule to see it's correct. A separate line makes the order obvious.

The library doesn't build this file yet: next step.

```cpp file=src/interpreter.cpp
#include "interp/interpreter.h"

namespace interp {

double Interpreter::execute(std::string_view line)
{
    const std::unique_ptr<Expr> tree = parse(line);
    return evaluate(*tree);
}

std::optional<double> Interpreter::variable(std::string_view name) const
{
    const auto found = variables_.find(name);
    if (found == variables_.end())
        return std::nullopt;
    return found->second;
}

double Interpreter::evaluate(const Expr& expr)
{
    switch (expr.kind) {
    case Expr::Kind::number: return expr.value;
    case Expr::Kind::variable: {
        const std::optional<double> value = variable(expr.name);
        if (!value)
            throw EvalError("unknown variable '" + expr.name + "'");
        return *value;
    }
    case Expr::Kind::negate: return -evaluate(*expr.left);
    case Expr::Kind::binary: {
        const double left = evaluate(*expr.left);
        const double right = evaluate(*expr.right);
        switch (expr.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/':
            if (right == 0)
                throw EvalError("division by zero");
            return left / right;
        }
        throw EvalError(std::string("unknown operator '") + expr.op + "'");
    }
    case Expr::Kind::assign: {
        const double value = evaluate(*expr.left);
        variables_[expr.name] = value;
        return value;
    }
    }
    throw EvalError("unknown expression");
}

} // namespace interp
```

```check
contains src/interpreter.cpp "Interpreter::execute"
contains src/interpreter.cpp "division by zero"
```

## Step 5 — Build it, test it, commit it on the branch

**This step: add `src/interpreter.cpp` to `interp_core`'s sources, build, run the tests, and commit.**

```cmake
add_library(interp_core
    src/tokenizer.cpp
    src/parser.cpp
    src/interpreter.cpp)
```

Library sources are listed by name, unlike the tests' glob: adding a file to a library is a decision a reviewer should see in the diff.

```text
cmake --build build
./build/interp_tests
git add -A
git commit -m "Add an interpreter with variables"
```

The output shows the fixture names: `[ RUN      ] Calc.evaluates_arithmetic`. If a row of the table fails, the message ends with `in row N`.

The commit goes on `feature/variables`. `git log --oneline --all --graph` draws both branches: `main` is still where you left it.

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
```

```check
contains CMakeLists.txt "src/interpreter.cpp"
run "cmake --build build"
tests "./build/interp_tests" require="Calc.evaluates_arithmetic Calc.assignment_returns_the_value_and_remembers_it Calc.unknown_variable_is_an_error Calc.division_by_zero_is_an_error Calc.a_failed_line_changes_nothing" -- Evaluate the right side of an assignment before storing it.
git-tracked src/interpreter.cpp -- Commit on the feature/variables branch.
git-branch feature/variables
```

## Step 6 — The reviewer's tests

**This step: create the supplied `tests/interpreter_review_test.cpp`, build, and run the tests. One will fail.**

```text
cmake --build build
./build/interp_tests
```

A reviewer reads your change and adds tests of their own, aimed at the edges. **Predict** before you run: which line of the table could possibly be wrong? Every one of them is simple arithmetic.

```cpp file=tests/interpreter_review_test.cpp provided
// The reviewer's tests. Do not edit them: make them pass.
#include "studio_extras.hpp"
#include "studio_test.hpp"

#include "interp/interpreter.h"

#include <string>
#include <vector>

struct Review {
    interp::Interpreter calc;
};

struct ReviewRow {
    std::string line;
    double expected;
};

TEST_F(Review, operators_of_equal_rank_work_left_to_right)
{
    const std::vector<ReviewRow> rows = {
        {"1 + 2 + 3", 6},  {"10 - 4 + 1", 7}, {"8 - 3 - 2", 3},
        {"2 * 3 * 4", 24}, {"16 / 4 / 2", 2}, {"12 / 3 * 2", 8},
    };
    studio_test::for_each_row(rows, [&](const ReviewRow& row) {
        CHECK_EQ(calc.execute(row.line), row.expected);
    });
}

TEST_F(Review, chained_assignment_sets_every_name)
{
    CHECK_EQ(calc.execute("a = b = 4"), 4.0);
    CHECK(calc.variable("a") == 4.0);
    CHECK(calc.variable("b") == 4.0);
}

TEST_F(Review, names_are_whole_words)
{
    calc.execute("rate = 2");
    calc.execute("rate2 = 3");
    CHECK_EQ(calc.execute("rate * rate2"), 6.0);
    CHECK_THROWS(calc.execute("rat"), interp::EvalError);
}

TEST_F(Review, parentheses_can_nest)
{
    CHECK_EQ(calc.execute("((2))"), 2.0);
    CHECK_EQ(calc.execute("(1 - (2 - (3 - 4)))"), -2.0);
}
```

### What happened

```text
[ RUN      ] Review.operators_of_equal_rank_work_left_to_right
tests/interpreter_review_test.cpp:26: CHECK_EQ(calc.execute(row.line),
    row.expected) failed
    left:  5
    right: 7
    in row 2
```

Row 2 is `10 - 4 + 1`. Arithmetic says 7: operators of equal rank work **left to right**, `(10 - 4) + 1`. The interpreter said 5, which is `10 - (4 + 1)`. Ask the parser directly:

```text
./build/calc "10 - 4 + 1" "8 - 3 - 2"
```

`calc` still prints trees on this branch: `(10 - (4 + 1))` and `(8 - (3 - 2))`. The trees lean the wrong way.

Look at `expression()` in `src/parser.cpp`:

```cpp
ExprPtr left = term();
if (peek().kind == TokenKind::plus || ...) {
  char op = advance().text[0];
  return make_binary(op, std::move(left), expression());
}
```

After the operator, it calls `expression()` **again** for the right side, which swallows everything to the end: `4 + 1` becomes one subtree. That's **right-associative**, correct for `a = b = 1` and wrong for `-` and `/`. `term()` has the same bug.

Why did the tests in lesson 2 miss it? None of them had two operators of the **same** rank in a row. Precedence was tested; associativity wasn't. And `1 + 2 + 3` gives 6 either way, so the bug hides behind `+` and `*`.

```check
file tests/interpreter_review_test.cpp
run "cmake --build build"
```

## Step 7 — Fix the parser

**This step: make `expression()` and `term()` in `src/parser.cpp` loop instead of recursing. Then run the tests and commit.**

Build the tree **leftwards**: read one operand, then, while an operator of this rank follows, combine what you have so far with the next operand.

```cpp
ExprPtr expression() {
  ExprPtr left = term();
  while (peek().kind == TokenKind::plus ||
         peek().kind == TokenKind::minus) {
    char op = advance().text[0];
    left = make_binary(op, std::move(left), term());
  }
  return left;
}
```

`8 - 3 - 2`: `left` is `8`, then `(8 - 3)`, then `((8 - 3) - 2)`. The right side is now `term()`: one operand of the next rank down, never a whole expression. Do the same in `term()`, with `factor()` for the right side.

Keep the file's two-space style for now: a fix should change only what it fixes, so the diff shows nothing else. Then:

```text
cmake --build build
./build/interp_tests
git add -A
git commit -m "Fix: operators of equal rank associate left"
```

`git show` displays the commit you just made: the reviewer's tests, and four changed lines in the parser.

```cpp file=src/parser.cpp
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
    while (peek().kind == TokenKind::plus || peek().kind == TokenKind::minus) {
      char op = advance().text[0];
      left = make_binary(op, std::move(left), term());
    }
    return left;
  }

  ExprPtr term() {
    ExprPtr left = factor();
    while (peek().kind == TokenKind::star || peek().kind == TokenKind::slash) {
      char op = advance().text[0];
      left = make_binary(op, std::move(left), factor());
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
run "cmake --build build"
tests "./build/interp_tests" require="Review.operators_of_equal_rank_work_left_to_right Review.chained_assignment_sets_every_name" -- Fix term() as well as expression(): 16 / 4 / 2 is 2.
git-message "associate" label="the fix is committed, and its message says what it fixes"
```

## Step 8 — calc computes

**This step: change `app/main.cpp` to run each line through an `Interpreter` and print `= value`, or `error: why`. Build, try it, and commit.**

| Input lines | Output |
|---|---|
| `x = 6` then `x * 7` | `= 6` then `= 42` |
| `y + 1` | `error: unknown variable 'y'` |
| `1 / 0` | `error: division by zero` |

One `interp::Interpreter` lives in `main` for the whole run, so variables carry from one line to the next. `run_line` catches both error types:

```cpp
try {
    const double value = interpreter.execute(line);
    std::cout << "= " << value << '\n';
    return true;
} catch (const interp::SyntaxError& e) {
    std::cout << "error: " << e.what() << '\n';
} catch (const interp::EvalError& e) {
    std::cout << "error: " << e.what() << '\n';
}
return false;
```

Compute `value` **before** printing anything: `std::cout << "= " << interpreter.execute(line)` writes `= ` and only then evaluates, so an error would leave a stray `= ` on the line.

```text
cmake --build build
./build/calc "x = 6" "x * 7"
ctest --test-dir build
git add -A
git commit -m "calc evaluates lines and keeps variables"
```

CTest's two `calc` tests still pass: they only check exit codes, so they didn't care that `calc` stopped printing trees. Tests that check what matters, and nothing more, survive changes like this.

```cpp file=app/main.cpp
// calc: a calculator with variables.
//
//   calc "x = 6" "x * 7"   runs each argument as a line
//   calc                   reads lines until the input ends
#include "interp/interpreter.h"
#include "interp/tokenizer.h"

#include <iostream>
#include <string>

namespace {

// Runs one line, printing "= value" or "error: why". Returns
// whether it worked.
bool run_line(interp::Interpreter& interpreter, const std::string& line)
{
    try {
        const double value = interpreter.execute(line);
        std::cout << "= " << value << '\n';
        return true;
    } catch (const interp::SyntaxError& e) {
        std::cout << "error: " << e.what() << '\n';
    } catch (const interp::EvalError& e) {
        std::cout << "error: " << e.what() << '\n';
    }
    return false;
}

bool is_blank(const std::string& line)
{
    return line.find_first_not_of(" \t\r") == std::string::npos;
}

} // namespace

int main(int argc, char* argv[])
{
    interp::Interpreter interpreter;
    bool all_worked = true;
    if (argc > 1) {
        for (int i = 1; i < argc; ++i)
            all_worked = run_line(interpreter, argv[i]) && all_worked;
    } else {
        std::string line;
        while (std::getline(std::cin, line)) {
            if (!is_blank(line))
                all_worked = run_line(interpreter, line) && all_worked;
        }
    }
    return all_worked ? 0 : 1;
}
```

```check
run "cmake --build build"
run "./build/calc" stdin="x = 6\nx * 7\n" stdout="= 6\n= 42"
run "./build/calc" stdin="y + 1\n1 / 0\n2 * 2\n" stdout="error: unknown variable 'y'\nerror: division by zero\n= 4" exit=1 -- Catch EvalError as well as SyntaxError, and keep reading lines.
run "ctest --test-dir build" stdout="100% tests passed"
git-message "evaluates"
```

## Step 9 — Merge into main

**This step: merge `feature/variables` into `main`, then delete the branch.**

```text
git switch main
git merge --no-ff feature/variables -m "Merge feature/variables"
git branch -d feature/variables
git log --oneline --graph
```

- `git switch main` goes back to `main`. Look in `src/`: `interpreter.cpp` is gone. Git has put the folder back to `main`'s snapshot. Nothing is lost; it's on the branch.
- `git merge feature/variables` brings the branch's commits into `main`. Here `main` hasn't moved since the branch started, so Git could simply slide `main` forward (a **fast-forward**). `--no-ff` makes a **merge commit** anyway, so the history keeps the shape of the diagram at the top of this lesson: you can see which commits came in together as one feature.
- `git branch -d` deletes a branch that's been merged. (It refuses one that hasn't: `-D` forces it, and throws away the work.)

If both branches had changed the same lines, `git merge` would stop with a **conflict** and mark both versions in the file (`<<<<<<<`, `=======`, `>>>>>>>`). You'd edit the file to what it should be, then `git add` it and `git commit`.

On a team, this merge happens on a hosting site as a **pull request**: the branch is pushed, colleagues review the diff, continuous integration (lesson 6) runs the tests, and only then does it merge.

```check
git-branch main
git-tracked src/interpreter.cpp label="main has the interpreter" -- git merge --no-ff feature/variables
git-message "Merge feature/variables" label="there is a merge commit"
git-no-branch feature/variables -- git branch -d feature/variables
git-clean
```

## Step 10 — GoogleTest in a real project

**This step: read. No file changes.**

`studio_test.hpp` is a teaching tool. Real projects use a framework such as **GoogleTest** (or Catch2, or doctest). The usual way to get it is CMake's **FetchContent**, which downloads a dependency while configuring:

```cmake
include(FetchContent)
FetchContent_Declare(googletest
    URL https://github.com/google/googletest/archive/v1.15.2.zip
    URL_HASH SHA256=<the archive's hash>)
FetchContent_MakeAvailable(googletest)

add_executable(interp_gtests tests/interpreter_gtest.cpp)
target_link_libraries(interp_gtests
    PRIVATE interp_core GTest::gtest_main)
include(GoogleTest)
gtest_discover_tests(interp_gtests)
```

`gtest_discover_tests` registers every `TEST` as its own CTest test, so `ctest -R Calc` runs just those.

This course doesn't use it, because the trade-offs matter more than the snippet:

| Approach | For | Against |
|---|---|---|
| FetchContent from a URL | one command, a pinned version | configure needs the network; a firewall or an outage breaks every fresh build |
| `find_package(GTest)` | uses an installed copy, works offline | every machine and CI runner must install it first |
| a package manager (vcpkg, Conan) | versions and hashes in a manifest, cached | one more tool to learn and install |
| copy it into the repository ("vendoring") | always there, fully offline | hundreds of files in your history; updates are manual |

Whichever you choose: **pin an exact version** (a tag, or better a hash), never "latest". A test framework that changes under you can turn a green build red with no change of yours. `URL_HASH` also proves the download is the file you meant.
