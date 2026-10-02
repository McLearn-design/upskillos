CodeLens has a strong foundation, but it is **not yet reliable enough to teach JavaScript, TypeScript, Python, and C++ as equally supported languages**. JavaScript is the closest; the other three need significant runtime work.

### Implementation status — 2026-09-29

- ✅ The full-screen CodeLens shell now stops above the active desktop taskbar (64 px mac dock or 48 px Windows taskbar) while retaining full height on smaller screens.
- ✅ The stack-depth timeline is pinned to a 28 px graph inside a 32 px strip, overriding the app-wide responsive SVG rule that previously expanded it into the workspace.
- ✅ JavaScript and the current TypeScript execution path now run in a disposable Web Worker instead of blocking the interface.
- ✅ TypeScript now uses `typescript.transpileModule`, reports compiler diagnostics separately, and maps generated trace lines back to the learner's TypeScript source. Parameter properties and the starter output are preserved correctly.
- ✅ JavaScript and TypeScript now stop before unsupported generators, async/await, module syntax, and other unhandled constructs can produce a misleading trace. Browser and Node API failures explain the sandbox boundary instead of appearing as generic reference errors.
- ✅ A Sandbox guide beside the language selector documents supported features, and execution limits now display prominent, cause-specific guidance for loops, recursion, output, trace size, and memory growth.
- ✅ CodeLens now provides Stop/Run again controls, keeps partial trace batches, and reports completed, stopped, limited, syntax-error, and runtime-error outcomes separately.
- ✅ JavaScript runs are bounded by runtime, statement, trace-event, trace-size, output, recursion, heap-object, and heap-property limits. Variable snapshots use bounded previews instead of copying arbitrarily large structures into every event.

- ✅ All 10 built-in examples execute without an interpreter error.
- ✅ All 42 DSA/design-pattern CodeLens handoffs execute without an interpreter error (previously 33/42).
- ✅ A focused regression suite now runs both collections and checks the repaired compatibility behavior.
- ✅ Unreliable syntax-only complexity labels are hidden until reviewed metadata or a defensible analyser replaces them.
- ✅ The workspace defaults to one right-side panel. Learners can choose **Learn & output**, **Data structures**, or **Split view**.
- ✅ `Array.from`, `Object.fromEntries`, `Symbol.iterator`, Map iteration, custom iteration, and destructured callback parameters cover the compatibility failures found in the initial audit.
- ⏳ The learning library, specialized DSA views, and splitting CodeLens.tsx remain planned below.

### Implementation status — 2026-10-01

Direction agreed: JavaScript, TypeScript and Python run in the browser; languages that need a real compiler and debugger run in the desktop app, on the learner's own toolchains.

- ✅ **Python rebuilt (plan step 5).** One tracer, written in Python (`interpreter/python/codelens_tracer.py`), runs in two hosts: Pyodide in a Web Worker in the browser (off the main thread; Stop discards the worker), and the learner's own CPython in the desktop app. It records list, tuple, dict, set, deque and class-instance contents with stable object ids, so shared references, linked lists and the heap view work for Python. Limits on time, steps, recursion and output end runaway programs with their own status; `except Exception:` can't swallow them. Class bodies are no longer traced as calls.
- ✅ **C and C++ on the desktop (plan step 6, via GDB rather than DAP).** `desktop/app/runtimes/codelens.cjs` compiles with `-g -O0` and steps through the program under the learner's GDB using its Python API (`codelens/gdb_tracer.py`). Pointers become arrows in the heap view; structs, arrays and std::vector/string/map (via libstdc++'s printers) become objects; variables appear only once declared. Single-line loops stop at the step limit (temporary breakpoints on the line's addresses); a program stuck inside one step is killed at a hard limit and the steps traced so far are kept. Segfaults are reported on their line. The language menu offers C and C++ only where GDB with Python support and the compilers are found; Go only where its backend tools are.
- ✅ **Line-by-line explanations for Python and C/C++.** Instead of "line N runs next", each step says what that line does with its real values: assignments, updates, loop iterations and endings, `if`/`while` conditions true or false, returns, prints, definitions, closing braces. Tracers say what kind of statement each line is (Python's syntax tree; C/C++ source text); `traceOutcomes.ts` works out what each line actually did from the events that follow, shared by both languages; `explainTrace.ts` writes the sentence.
- ✅ Tests run the real tracers on CPython and GDB when installed (skipped otherwise): shared references, recursion, containers, explanations, limits, crashes, compile errors.
- ⏳ Not yet: Rust (needs `rustup target add x86_64-pc-windows-gnu` for GDB-readable debug info), Java/Kotlin (would need a JDI tracer), C#, return values for C/C++ calls, and per-line printed output for C/C++ (output is read when the program ends).

**Later on 2026-10-01:**

- ✅ **C# on the desktop.** .NET has no command-line debugger in the SDK, so `codelens/csharp/` rewrites the program instead: before each statement it adds a call reporting the line and the variables that have a value there (the compiler's own definite-assignment analysis decides which), wraps each method in a call/return pair, and makes each loop check a step. It is compiled in memory with the SDK's own Roslyn (nothing downloaded) and run in a small tracer program, built once per SDK (about 2 s, then about 2 s per run). Classes, records, structs, lists, arrays, dictionaries, StringBuilder, exceptions, recursion, iterators (`yield`, shown like Python generators), local functions, `async`/`await` and LINQ (shown as a query that hasn't run yet) all trace. Uncaught exceptions are reported where they were thrown; compile errors on their line.
- ✅ **JavaScript and TypeScript line explanations**, like Python's: the interpreter now says which kind of statement each step is, so a loop, its `let i = 0` and its `{` on one line are told apart; each pass of a loop explains its check or the item it took. Top-level block variables (a loop's `i`) now appear in the variables view; the Call Stack panel marks the innermost frame as current.
- ✅ **C/C++ return values and per-line output.** A GDB finish breakpoint on each call catches its return value ("Returns 4" instead of "Returns `x * x`"); stdout is made unbuffered, so each step shows what it printed.
- ✅ **Learning library (plan step 7).** `library.ts` + `LibraryBrowser.tsx` replace the dropdown: 12 examples (data structures, algorithms, patterns, functional, React internals), each with the concept, prerequisites, difficulty, what to watch, complexity and invariants where they matter, edge cases, exercises, and expected output, in up to five languages (JS, TS, Python, C#, C++). Load, copy, reset after editing, and compare two languages side by side. `library.test.ts` runs every variant (C# and C++ through the real desktop tracers) and checks its output.
- ✅ **Accessibility (part of step 9).** Keyboard playback (← → step, Home/End, Space), each step's explanation announced to screen readers, dialogs with Escape and focus handling, arrow keys in the library list.
- ⏳ Still open: specialized DSA views and pattern diagrams (step 8); the rest of step 9 (splitting `CodeLens.tsx`, now 3,500 lines, and a typed event union); Rust; Java/Kotlin.

### Confirmed problems

- All 10 examples in the CodeLens dropdown execute successfully.
- The DSA/design-pattern course contains 42 CodeLens activities.
- The initial audit found **9 failing activities** (33/42). The repaired interpreter now runs all 42:
  - Missing `Array.from`
  - Missing `Object.fromEntries`
  - Missing `Symbol`
  - Incorrect `Map`/iterator behavior
  - Two data-structure execution failures
- Dedicated interpreter regression tests now protect the built-in examples and all course handoffs.

The initial automatic complexity analysis was unsafe for teaching and reported:

| Algorithm | CodeLens result | Correct interpretation |
|---|---:|---:|
| Binary search | `O(n)` | `O(log n)` |
| Recursive Fibonacci | `O(n) recursive` | `O(2ⁿ)` without memoization |
| Fixed ten-iteration loop | `O(n)` | `O(1)` |
| Two sequential loops | `O(n²)` | Usually `O(n + m)` |

The estimator counted loops without understanding bounds or even distinguishing nested loops from sequential loops. Those automatic labels are now disabled. Curriculum-authored complexity metadata is safer than pretending arbitrary complexity can be inferred reliably.

### Language readiness

| Language | Readiness (2026-10-01) | Main limitation |
|---|---|---|
| JavaScript | Educational subset, browser | Custom interpreter: no generators, async/await or modules |
| TypeScript | Educational subset, browser | Single file; inherits the JavaScript subset |
| Python | Full CPython semantics, browser (Pyodide) and desktop | Programs that read input get none |
| C, C++ | Desktop, with GDB | Needs GDB with Python and GCC/Clang on the machine |
| C# | Desktop, with the .NET SDK | Lambdas run without line steps; static fields aren't shown; a `Span` that lives across an `await` can't be traced |

The table below the line is the original 2026-09 audit, kept for the record.

| Language | Readiness | Main limitation |
|---|---|---|
| JavaScript | Promising subset | Custom interpreter still lacks parts of JavaScript |
| TypeScript | Promising subset | Real transpilation is in place, but execution inherits the JavaScript subset and does not resolve imports or perform project-wide type checking |
| Python | Useful for basic flow/recursion | Cannot meaningfully visualize Python data structures |
| C++ | Not implemented | No UI option or backend adapter |

TypeScript now uses `typescript.transpileModule` inside the execution worker. The included starter's parameter property:

```ts
constructor(public name: string) {}
```

is correctly compiled with its required assignment:

```js
constructor(name) { this.name = name }
```

The starter now produces:

```text
Rex says woof
Rex fetches ball!
```

Generated trace locations are mapped back to the TypeScript source, and syntax diagnostics retain their original line and column. CodeLens remains a single-file educational runtime rather than a full TypeScript project builder, so imports and project-wide semantic type checking remain outside the supported subset.

Python tracing in [pythonTracer.ts](C:/Users/g4m3r/Documents/testing%20tutorials/open-calc/src/labs/codelens/codelens/interpreter/pythonTracer.ts:1) only records list and dictionary lengths. It does not preserve elements, keys, object fields, links, mutations, or reference identity. That means linked lists, trees, graphs, hash tables, and object-oriented patterns cannot be visualized accurately. Pyodide also runs on the main thread without cancellation or a timeout.

C++ is only mentioned as future backend work. The language type in [types.ts](C:/Users/g4m3r/Documents/testing%20tutorials/open-calc/src/labs/codelens/codelens/types.ts:10) contains JS, TS, Python, and Go, while [server.mjs](C:/Users/g4m3r/Documents/testing%20tutorials/open-calc/backend/server.mjs:130) only registers the Go native adapter. This machine has `g++` and `gdb`, but no C++ CodeLens adapter exists.

### Robustness plan

1. **Establish a truthful baseline**
   - Remove or label inferred complexity as experimental.
   - Add automated tests for all 10 built-in examples.
   - Add a test that executes all 42 course handoffs.
   - Record expected output and important invariants for every example.
   - Publish a supported-language-feature matrix inside CodeLens.

2. **Protect the interface**
   - Move JavaScript and Python execution into workers.
   - Add Stop, timeout, event-count, memory, recursion, and trace-size limits.
   - Return partial traces with a clear “execution limit reached” event.
   - Prevent an infinite loop or very large trace from freezing the application.

3. **Fix JavaScript compatibility**
   - Repair `Array.from`, `Object.fromEntries`, `Symbol`, Map iteration, RegExp, and other missing standard functionality.
   - Fix all nine failing course examples.
   - Build conformance tests for arrays, maps, sets, iterators, classes, errors, closures, and object mutation.
   - Clearly describe this as an educational JavaScript subset until coverage is broader.

4. **Replace TypeScript stripping**
   - ✅ Use `typescript.transpileModule`.
   - ✅ Preserve source maps so trace lines still point to the TypeScript source.
   - ✅ Show compile diagnostics separately from runtime errors.
   - ✅ Test interfaces, enums, generics, parameter properties, optional properties, unions, access modifiers, casts, and exports.

5. **Rebuild Python tracing**
   - Run Pyodide in a worker, following the worker architecture already used by the ML Lab.
   - Filter tracing to the learner’s `<codelens>` file.
   - Serialize bounded list contents, dictionaries, sets, tuples, objects, and reference IDs.
   - Generate normalized create/mutate/delete events.
   - Restore stdout/stderr handlers after execution.
   - Propagate Python exceptions into the normal error result.

6. **Add C++ as a real adapter**
   - Add C++ to the UI and language types.
   - Compile with debug symbols and connect through GDB/DAP.
   - Capture stack frames, locals, arrays, structs, pointers, and allocation events.
   - Treat native execution as trusted local functionality until it is isolated. The current native backend executes submitted code directly on the host.
   - Hide C++ gracefully when its required tools are unavailable.

7. **Turn examples into a learning library**
   - Replace the small JS-only dropdown in [snippets.ts](C:/Users/g4m3r/Documents/testing%20tutorials/open-calc/src/labs/codelens/codelens/snippets.ts:3) with an OpenMAT-style example browser.
   - Give each example:
     - Concept and prerequisites
     - Difficulty
     - Language variants
     - Explanation beside the code
     - Expected output
     - What to watch during execution
     - Complexity and invariants
     - Edge cases and exercises
   - Let learners load, copy, modify, reset, and compare language versions.

8. **Teach the subjects properly**
   - DSA needs specialized array, linked-list, tree, heap, hash-table, and graph views.
   - Show invariants such as sorted partitions, visited sets, queue frontiers, heap order, and union-find parents.
   - Design patterns need more than line stepping: show object collaboration and sequence diagrams, the problem before the pattern, tradeoffs, and cases where the pattern should not be used.
   - Include a naive implementation, refactoring, final pattern, tests, and a modification challenge.

9. **Make the code maintainable**
   - [CodeLens.tsx](C:/Users/g4m3r/Documents/testing%20tutorials/open-calc/src/labs/codelens/codelens/CodeLens.tsx:1) is 3,064 lines. Split it into the workspace shell, execution controller, language adapters, playback controls, inspectors, example browser, and teaching panels.
   - Replace the loose trace-event index signature with a versioned discriminated union.
   - Add keyboard navigation, focus management, accessible labels, and responsive layouts.

The best implementation order is: **tests and truthful complexity → workers and execution limits → JavaScript compatibility → TypeScript → Python data tracing → learning library → C++**. After the first three stages, CodeLens could be dependable for JavaScript DSA and pattern instruction. TypeScript and Python should remain marked experimental until their runtime work is complete, and C++ should not be advertised until its adapter exists.
