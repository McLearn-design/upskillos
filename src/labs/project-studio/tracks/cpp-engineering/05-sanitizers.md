---
title: 5 — Sanitizers in the Test Run
track: Software Engineering in C++
runtime: cpp
reference: optional
console: true
---

Tests check what code **does**. Some bugs don't change what code does, not on your machine, not today: reading memory that has just been freed usually still finds the old bytes there. The program is wrong, the output is right, and every test passes, until a different compiler, optimisation level or input makes it crash in front of a user.

*Memory, Lifetime and Ownership* used **AddressSanitizer** on single files. This lesson builds it into the project as an option, so the whole test suite can run under it, and then uses it on a bug in a colleague's change that the tests can't see.

| Sanitizer | Flag | Finds |
|---|---|---|
| AddressSanitizer (ASan) | `-fsanitize=address` | use after free, use after scope, out-of-bounds, leaks |
| UndefinedBehaviorSanitizer (UBSan) | `-fsanitize=undefined` | signed overflow, bad shifts, null dereference, misaligned access |
| ThreadSanitizer (TSan) | `-fsanitize=thread` | data races (it can't be combined with ASan) |

## Step 1 — A SANITIZE option

**This step: add a `SANITIZE` option to `CMakeLists.txt` that adds the ASan and UBSan flags to every target.**

```cmake
option(SANITIZE "Build with ASan and UBSan" OFF)
if(SANITIZE)
    target_compile_options(interp_options INTERFACE
        -fsanitize=address,undefined -fno-omit-frame-pointer -g)
    target_link_options(interp_options INTERFACE
        -fsanitize=address,undefined)
endif()
```

Put it right after `interp_options` is defined.

- `option` declares a cache variable, `OFF` unless you say otherwise: `cmake ... -DSANITIZE=ON`.
- The flags go on `interp_options`, so every target that links to it, the library, the app and the tests, is built the same way. A sanitized test program linked to an unsanitized library would miss bugs in the library.
- The sanitizer's runtime must be linked in too: `target_link_options`.
- `-fno-omit-frame-pointer` and `-g` give the reports readable call stacks with file names and line numbers.

A sanitized build is slower (about 2x) and bigger, so it lives in its **own** build folder, next to the normal one. `.gitignore` already ignores `build-*/`:

```text
cmake -S . -B build-asan -DSANITIZE=ON          (macOS, Linux)
cmake -S . -B build-asan -G "MinGW Makefiles"
      -DSANITIZE=ON                            (Windows, one line)
cmake --build build-asan
ctest --test-dir build-asan --output-on-failure
```

**Where it works:** GCC and Clang on Linux; Apple's Clang on macOS (ASan and UBSan); Clang on Windows, including the app's llvm-mingw. The GCC from MSYS2 on Windows has no sanitizers, and MSVC spells it `/fsanitize=address`. If your configure or link fails with the option on, read the reports in this lesson instead: the checks never need a sanitizer.

The normal build doesn't change: check it still builds and passes.

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

option(SANITIZE "Build with ASan and UBSan" OFF)
if(SANITIZE)
    target_compile_options(interp_options INTERFACE
        -fsanitize=address,undefined -fno-omit-frame-pointer -g)
    target_link_options(interp_options INTERFACE
        -fsanitize=address,undefined)
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
contains CMakeLists.txt "option(SANITIZE"
matches CMakeLists.txt "target_compile_options\s*\(\s*interp_options\s+INTERFACE\s+-fsanitize=address,undefined" label="the sanitizer flags go on interp_options, for every target"
matches CMakeLists.txt "target_link_options\s*\(\s*interp_options\s+INTERFACE\s+-fsanitize=address,undefined" label="the sanitizer runtime is linked too"
run "cmake --build build"
tests "./build/interp_tests"
```

## Step 2 — A feature request: case-insensitive names

**This step: create the supplied `tests/names_test.cpp` and read it.**

Users complain that `Rate = 3` followed by `rate * 2` says `unknown variable 'rate'`. A colleague has agreed a rule with them, and written it down as tests first: **names are case-insensitive**. `Rate`, `RATE` and `rate` are one variable.

The colleague's implementation arrives in the next step.

```cpp file=tests/names_test.cpp provided
// Provided with the change: names are case-insensitive.
#include "studio_extras.hpp"
#include "studio_test.hpp"

#include "interp/interpreter.h"

struct Names {
    interp::Interpreter calc;
};

TEST_F(Names, any_case_finds_the_same_variable)
{
    calc.execute("Rate = 3");
    CHECK_EQ(calc.execute("rate * RATE"), 9.0);
    CHECK(calc.variable("rAtE") == 3.0);
}

TEST_F(Names, assigning_in_another_case_changes_the_same_variable)
{
    calc.execute("total = 1");
    calc.execute("TOTAL = 2");
    CHECK(calc.variable("total") == 2.0);
}
```

```check
file tests/names_test.cpp
```

## Step 3 — The colleague's change

**This step: create the supplied `src/interpreter.cpp` (it replaces yours), build, and run the tests.**

```text
cmake --build build
./build/interp_tests
```

The change: a helper `folded(name)` returns a lower-case copy of a name, and every store and lookup goes through it. Read `variable()` closely.

Every test passes, the old ones and the new ones. Would you approve this change?

```cpp file=src/interpreter.cpp provided
#include "interp/interpreter.h"

#include <cctype>

namespace interp {

namespace {

// Names are case-insensitive: Rate, RATE and rate are one variable.
// Every name is stored and looked up in lower case.
std::string folded(std::string_view name)
{
    std::string result(name);
    for (char& c : result)
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    return result;
}

} // namespace

double Interpreter::execute(std::string_view line)
{
    const std::unique_ptr<Expr> tree = parse(line);
    return evaluate(*tree);
}

std::optional<double> Interpreter::variable(std::string_view name) const
{
    const std::string_view key = folded(name);
    const auto found = variables_.find(key);
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
        variables_[folded(expr.name)] = value;
        return value;
    }
    }
    throw EvalError("unknown expression");
}

} // namespace interp
```

```check
contains src/interpreter.cpp "folded"
run "cmake --build build"
```

## Step 4 — Run the tests under the sanitizers

**This step: build in `build-asan` with `SANITIZE=ON` and run the tests there, if your compiler supports it. No file changes.**

```text
cmake -S . -B build-asan -DSANITIZE=ON
                     (on Windows, add -G "MinGW Makefiles")
cmake --build build-asan
./build-asan/interp_tests
```

**Predict:** will this build pass too?

### What happened

The test program stops in the middle of a test:

```text
[ RUN      ] Review.chained_assignment_sets_every_name
==20746==ERROR: AddressSanitizer: stack-use-after-scope
READ of size 1 at 0x7f0a22c052f0 thread T0
    ...
    #11 in interp::Interpreter::variable(...) src/interpreter.cpp:30
    #12 in body tests/interpreter_review_test.cpp:33
...
Address 0x7f0a22c052f0 is located in stack of thread T0
  in frame interp::Interpreter::variable(...) interpreter.cpp:28
    [96, 112) 'key' (line 29)
    [224, 256) '<unknown>' <== Memory access ... inside this variable
```

Read it from the bottom of the stack up: `variable()`, line 30, read one byte of an **unnamed** object (`<unknown>`) on its own stack frame, after that object's scope had ended. Line 29:

```cpp
const std::string_view key = folded(name);
```

`folded` returns a `std::string`: a **temporary**. A `string_view` doesn't own characters; it points at someone else's. The temporary string is destroyed at the end of that line, and `key` points into a dead object. `find(key)` on line 30 reads the dead bytes.

Without the sanitizer, the bytes were still there, so the lookup found the right variable and every test passed. Nothing guarantees that: an optimised build, another compiler, or a name longer than about 15 characters (too long to fit inside the string object, so its characters live on the heap and are freed) can turn it into wrong answers.

### Two more tools that see it

- **Clang** warns when it compiles the file: `object backing the pointer will be destroyed at the end of the full-expression [-Wdangling-gsl]`. GCC 13 says nothing. Read warnings; build with more than one compiler.
- **clang-tidy**, with the checks from lesson 4:

```text
clang-tidy --quiet -p build src/interpreter.cpp
src/interpreter.cpp:29:34: error: std::basic_string_view outlives
    its value [bugprone-dangling-handle,-warnings-as-errors]
```

Each layer catches different bugs: the compiler's warnings, static analysis, tests, tests under sanitizers. Lesson 6 runs all of them on every change.

**UBSan** found nothing here, but it's in the same build for free. Try it in a scratch file: `int big = INT_MAX; big + 1` compiled with `-fsanitize=undefined` reports `signed integer overflow: 2147483647 + 1 cannot be represented in type 'int'`. Without it, the program quietly prints a negative number.

## Step 5 — Fix it, and make the test run say so

**This step: fix `variable()` so the folded name lives as long as it's used. Run the tests and clang-tidy, and commit.**

The simplest fix gives the temporary a lifetime: store it in a `std::string`, or use it directly within the same expression.

```cpp
const auto found = variables_.find(folded(name));
```

A temporary lives until the end of the **full expression** it was created in, the whole statement here, so it outlives `find`. The other uses of `folded` in the file are already like that.

```text
cmake --build build
./build/interp_tests
clang-tidy --quiet -p build src/interpreter.cpp
git add -A
git commit -m "Case-insensitive names, without a dangling string_view"
```

If you have a sanitizer build, run it again: `cmake --build build-asan` and `ctest --test-dir build-asan`. Clean.

**The rule:** a `std::string_view` (like a reference, a pointer or an iterator) must never outlive what it views. Use it for parameters, where the caller's string outlives the call. Be suspicious of one in a local variable, and of one stored in a class: who owns those characters, and for how long?

```cpp file=src/interpreter.cpp
#include "interp/interpreter.h"

#include <cctype>

namespace interp {

namespace {

// Names are case-insensitive: Rate, RATE and rate are one variable.
// Every name is stored and looked up in lower case.
std::string folded(std::string_view name)
{
    std::string result(name);
    for (char& c : result)
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    return result;
}

} // namespace

double Interpreter::execute(std::string_view line)
{
    const std::unique_ptr<Expr> tree = parse(line);
    return evaluate(*tree);
}

std::optional<double> Interpreter::variable(std::string_view name) const
{
    const auto found = variables_.find(folded(name));
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
        variables_[folded(expr.name)] = value;
        return value;
    }
    }
    throw EvalError("unknown expression");
}

} // namespace interp
```

```check
lacks src/interpreter.cpp "std::string_view key = folded" label="no string_view keeps pointing at a dead temporary"
run "cmake --build build"
tests "./build/interp_tests" require="Names.any_case_finds_the_same_variable Names.assigning_in_another_case_changes_the_same_variable"
run "clang-tidy --quiet -p build src/interpreter.cpp" timeout=120 label="clang-tidy finds nothing in interpreter.cpp"
git-clean
git-message "string_view"
```
