# C++ from Zero — Project Studio

A five-lesson track for learners who have never compiled anything. It teaches the tools before the language: the compiler, the stages of a build, reading errors, the linker, CMake and the debugger. Each lesson builds and runs real programs in the learner's own project folder, and every step is checked against the real compiler.

## Available now

In the desktop app, open `#/lab/project-studio`, choose **C++ from Zero — Tools of the Trade**, and pick a new empty project folder. All five lessons use the same folder.

| Lesson | Teaches | Builds |
|---|---|---|
| 1 — From a Text File to a Running Program | finding the compiler, `main`, exit codes, `#include`, `std::cout`, then preprocess / compile / link by hand | `hello.cpp` |
| 2 — Reading What the Compiler Tells You | location in a message, fixing the first error first, "not declared", warnings as bug reports, an off-by-one hidden behind a warning | `greet.cpp`, `count.cpp` |
| 3 — When the Compiler Is Happy but the Build Fails | declaration vs definition, headers, object files, reading a linker error, overloading | `area.h`, `area.cpp`, `shapes.cpp` |
| 4 — Building with CMake | installing CMake, targets, configure vs build, out-of-source builds, language version and warnings, adding a source file | `CMakeLists.txt`, `greeting.h`, `greeting.cpp` |
| 5 — Your First Crash, and the Debugger | `-g`, running under `lldb` or `gdb`, call stack, variables, breakpoints and stepping, a null pointer | `inventory.cpp` |

Lessons follow the Pong track's rhythm: a short code block, bullet explanations, a prediction, then build and observe. Broken starting files are `provided` fences (created by a button, never overwriting learner work). Full files are collapsed under the optional reference. The Run button is shown only for lessons whose program is a single `.cpp` file; the multi-file lessons build in the terminal, which is what they teach.

The commands in the lessons work in the app's PowerShell terminal and in macOS and Linux shells. Where they differ (CMake's configure step on Windows), both are shown.

## Desktop changes

**The app's compiler is on the terminal's PATH.** The app-managed toolchain (llvm-mingw) is installed in the app's data folder, so before this change `g++` typed in a Project Studio terminal was "not recognized" for learners who used **Install C++ compiler**. Now:

- `cpp.cjs` exports `toolchainBinDir(app)`: the folder holding the installed toolchain's `g++.exe`, or `null`.
- `terminal.cjs` `shellEnv({ extraPath })` appends folders to PATH. They go *after* the learner's own PATH, so a compiler the learner installed still wins, matching `resolveCompiler`.
- `main.cjs` passes the toolchain folder to new terminals and to step checks.

That one folder also provides `lldb.exe` (lesson 5), `mingw32-make.exe` (CMake's `MinGW Makefiles` generator in lesson 4, so Visual Studio isn't needed), and `libc++.dll`, which programs built in the terminal without `-static` load when they start.

**`console: true` frontmatter.** The Run output said "Game launched in a separate window" for every C++ lesson. A lesson with `console: true` now says "Program started. Its output appears below." Existing tracks are unchanged.

## Tests

`src/labs/project-studio/cppFoundations.desktop.test.js` walks the whole track like a learner, in a fresh folder. For every step it:

1. types each step's file, or creates the provided file, and runs the terminal commands the lesson gives (`tracks/cpp-foundations.walkthrough.js`);
2. requires every check to pass;
3. first tries deliberately wrong answers on a copy of the project (a missing `;`, a misnamed function, the wrong output, a definition with the wrong parameter type, a source file left off the CMake target), and requires the named checks to fail.

It needs `g++` on PATH and CMake for lesson 4. To walk it with the app's own toolchain, set `CPP_TOOLCHAIN_BIN` to its `bin` folder. `toolchainPath.test.js` covers the PATH change.

```text
npx vitest run src/labs/project-studio/cppFoundations.desktop.test.js src/labs/project-studio/toolchainPath.test.js
```

## Verification on 2026-10-03

- Walkthrough: all five lessons and every wrong answer pass on Linux with GCC 13 and with Clang 18 as `g++`, and with CMake 3.28. The whole `src/labs/project-studio` suite passes (Windows-only tests skipped).
- The pinned llvm-mingw release (20260826) was inspected: its `bin` folder contains `g++.exe`, `lldb.exe`, `mingw32-make.exe` and `libc++.dll`.

**Not yet verified on Windows:** running the track in the desktop app, CMake with `-G "MinGW Makefiles"` against the app's toolchain, and `lldb` on a MinGW-built program. Running the walkthrough on Windows with `CPP_TOOLCHAIN_BIN` set to the installed toolchain covers the first two.

## Learning tools added after the first track

**Trace in CodeLens.** C++ lessons show a **🔬 Trace in CodeLens** button whenever a `.cpp` file is open. It hands the file to CodeLens (the same `codelens-handoff` the blog's code blocks use), which compiles it with debug information and steps through it under GDB: every line's local variables, the call stack and the heap, with **Back to Project Studio** returning to the same step. CodeLens compiles one file, so `codeLensHandoff.js` pastes in the project's own `#include "…"` headers first. Definitions in another `.cpp` file can't be traced this way. Lesson 5 uses it to show the crash: tracing the provided `inventory.cpp` stops with SIGSEGV on line 27, with `item` null and `name` `"screws"` (checked by driving `runtimes/codelens.cjs` directly with GDB 15 on Linux).

CodeLens needs GDB with Python, which comes with MSYS2 and most Linux systems but not with the app-managed llvm-mingw. Without it, CodeLens says so; `lldb` in the terminal still works.

**Typed input in checks.** A `run` check can type into the program: `run "./calc" stdin="3 4\n" stdout="3 + 4 = 7"`. On macOS and Linux the text is the shell's stdin. On Windows a program started by `powershell -Command` doesn't reliably read PowerShell's stdin, so the text goes through a temporary file: `Get-Content -Raw -LiteralPath <file> | <command>`. The Windows path is not yet verified on Windows.
