# C++ from zero to mastery — the Project Studio series

A complete path from "I've edited a Python script once" to designing, debugging, testing, profiling and shipping serious C++ software. Every lesson is a Project Studio track lesson: the learner types real code into real files, builds with the real compiler and CMake, and every step is checked. Every track has a walkthrough test (`walkCppTrack.js`) that plays a learner through every step and tries wrong answers the checks must reject.

## How the series teaches

- **The tools before the language.** Compiler, linker, errors, CMake and the debugger come first, so nothing later is magic.
- **One concept per step**: a short code block, bullet explanations, a prediction, then build and observe.
- **Scaffolding fades.** Guided steps give the code; later steps give only requirements and tests; challenges give neither. Full files stay available under *Full reference file (optional)*.
- **Tests from the start.** Specifications arrive as test files. Learners write their own tests, and then a reviewer's test file checks the cases they missed.
- **Mistakes on purpose.** Lessons hand over broken code and ask for a diagnosis before a fix: compiler errors, linker errors, warnings, crashes, copies that should have been references.
- **See the machine.** Trace in CodeLens shows variables, the call stack and the heap at every step. The debugger (lldb or gdb) is taught early and used throughout. AddressSanitizer is used once memory is the subject.

## Tracks

Status: ✅ built and walkthrough-tested, 🛠 next, 📋 planned.

| # | Track | Lessons | Status |
|---|---|---|---|
| 0 | **C++ from Zero — Tools of the Trade** (`cpp-foundations`) | first program and the build stages, reading compiler errors and warnings, compiler vs. linker, CMake, first crash and the debugger | ✅ 5 lessons |
| 1 | **C++ Foundations — Thinking in Types** (`cpp-language-basics`) | values, types and input; functions, headers and unit tests (red, green, refactor); independent work (GCD and LCM, with a reviewer's tests); loops; strings; `std::vector` and algorithms; structs, references, `const`, `std::optional`, `enum class` | ✅ 7 lessons |
| 2 | **Memory, Lifetime and Ownership** (`cpp-memory`) | stack, heap and lifetime made visible with a tracing type; `new`/`delete` and `std::unique_ptr`; use-after-free caught by AddressSanitizer, then fixed by redesigning ownership; build your own dynamic array (tests first, growth by doubling); shallow vs. deep copies and the rule of three; bounds checking with `at`; move semantics, the rule of five and the rule of zero; `unique_ptr`, `shared_ptr`, `weak_ptr` and ownership cycles | ✅ 6 lessons |
| 3 | **Classes and Abstraction** (`cpp-classes`) | invariants and encapsulation (a test-first `Fraction`); operator overloading, `<=>`, members vs. free functions; inheritance, `virtual`, `override`, `final`, virtual destructors and slicing, and when not to inherit; interfaces injected so code can be tested with fakes; exceptions vs. error codes vs. `optional` vs. `expected`; value types and a `Money` capstone | ✅ 6 lessons |
| 4 | **Generic Programming** (`cpp-generic`) | function templates and reading template errors; class templates (`Stack<T>`) and why they live in headers; concepts; writing your own iterators (`Ring<T, N>`, a sentinel-ended `Range`); lambdas, captures and a dangling-capture bug; ranges, views and laziness; a `FlatSet` challenge | ✅ 7 lessons |
| 5 | **Data Structures and Algorithms, Measured** (`cpp-dsa`) | complexity you can see (a benchmark harness, and why `-O0` timings lie); `vector` vs. `list` vs. `deque`; build a hash map, then race `unordered_map`; binary search trees, tree height and `std::map`; heaps and a priority-queue scheduler; graphs (BFS, DFS, Dijkstra); dynamic programming. Project: a mini in-memory database with indexes chosen per query | ✅ 8 lessons |
| 6 | **Software Engineering in C++** (`cpp-engineering`) | one growing project, a command interpreter (tokenizer, parser, interpreter), kept in Git from the first lesson; CMake libraries, targets and `ctest`; fixtures and table tests, feature branches and merges (GoogleTest shown in prose); clang-format and clang-tidy; sanitizers in the test run; a CI workflow for Linux, Windows and macOS; versioning, `install()`, CPack and a release tag | ✅ 7 lessons |
| 7 | **Systems Programming** (`cpp-systems`) | files and `std::filesystem` (a `du` tool); processes, exit codes and the environment, and a mini shell; pipes, buffering and flushing; threads, data races, mutexes and deadlock; condition variables and a blocking queue; atomics and acquire/release; a thread pool with futures | ✅ 7 lessons |
| 8 | **Networking** (`cpp-networking`) | sockets, addresses and byte order behind a portable RAII `Socket` (Winsock and BSD); a TCP echo server with partial reads and writes; message framing tested without a network; a chat room on a `poll` event loop; an HTTP/1.1 server; an authoritative multiplayer tic-tac-toe server. Every test runs on 127.0.0.1 with ports the system picks | ✅ 6 lessons |
| 9 | **Graphics from First Principles** (`cpp-graphics`) | a software renderer that writes image files: pixels, PPM and BMP (row padding); vectors and Lambert shading; Bresenham lines and filled triangles with the top-left rule; 2D transforms with matrices; 3D projection and a wireframe cube; depth buffer, shading and back-face culling; the GPU pipeline rebuilt with vertex and fragment shader lambdas, mapped to OpenGL and Vulkan. Real OpenGL and Vulkan lessons are still planned | ✅ 8 lessons |
| 10 | **Games and Engines** (`cpp-engines`) | the game loop with a fixed timestep (and why variable timesteps drift); entities, components and systems; collision, headless Pong rules and tunnelling; data-oriented design, struct-of-arrays and swap-and-pop at 50,000+ objects; a scoped profiler that writes Chrome trace files. *Classic Games in C++ — Pong* is the windowed game | ✅ 5 lessons (Pong ✅) |
| 11 | **Mastery** | templates and `constexpr` at compile time; coroutines; allocators; object layout, vtables and the ABI; a catalogue of undefined behaviour; performance engineering; reading and changing a large codebase. Capstone: a production-style application | 📋 |

Tracks 0 and 1 are needed by everything else. After Track 2, the learner can take Track 3 or Track 5 next; Tracks 7 to 11 build on 3 to 6.

## Lab features the series relies on

| Feature | Where | Status |
|---|---|---|
| App-managed compiler on the terminal's PATH (`g++`, `lldb`, `mingw32-make`) | `desktop/app/terminal.cjs`, `runtimes/cpp.cjs` | ✅ |
| `console: true` output message | `index.jsx` | ✅ |
| Typed input in checks: `run "./calc" stdin="3 4\n" stdout="7"` | `desktop/app/project-checks.cjs` | ✅ (Windows path not yet verified on Windows) |
| 🔬 Trace in CodeLens for the open `.cpp` file, with local headers pasted in | `codeLensHandoff.js` | ✅ (needs GDB) |
| Track walkthrough tests with wrong answers | `walkCppTrack.js` | ✅ |
| AddressSanitizer / UBSan builds for memory lessons | Track 2 lessons show `-fsanitize=address,undefined` builds and a `SANITIZE` CMake option; checks never depend on a sanitizer, because not every Windows toolchain ships one | ✅ |
| CodeLens with lldb, for learners who only have the app's compiler | `runtimes/codelens.cjs` | 📋 |
| `tests` check: runs a GoogleTest-style test program and reports each failed test with its message, the test a crash happened in, and required tests that didn't run | `project-checks.cjs` (`parseTestOutput`) | ✅ |
| `run … without="text"`: the output must not include the text (a destructor that should no longer run, a warning that should be gone) | `project-checks.cjs` | ✅ |
