CodeLens has a strong foundation, but it is **not yet reliable enough to teach JavaScript, TypeScript, Python, and C++ as equally supported languages**. JavaScript is the closest; the other three need significant runtime work.

### Implementation status — 2026-09-29

- ✅ The full-screen CodeLens shell now stops above the active desktop taskbar (64 px mac dock or 48 px Windows taskbar) while retaining full height on smaller screens.
- ✅ The stack-depth timeline is pinned to a 28 px graph inside a 32 px strip, overriding the app-wide responsive SVG rule that previously expanded it into the workspace.
- ✅ JavaScript and the current TypeScript execution path now run in a disposable Web Worker instead of blocking the interface.
- ✅ TypeScript now uses `typescript.transpileModule`, reports compiler diagnostics separately, and maps generated trace lines back to the learner's TypeScript source. Parameter properties and the starter output are preserved correctly.
- ✅ CodeLens now provides Stop/Run again controls, keeps partial trace batches, and reports completed, stopped, limited, syntax-error, and runtime-error outcomes separately.
- ✅ JavaScript runs are bounded by runtime, statement, trace-event, trace-size, output, recursion, heap-object, and heap-property limits. Variable snapshots use bounded previews instead of copying arbitrarily large structures into every event.

- ✅ All 10 built-in examples execute without an interpreter error.
- ✅ All 42 DSA/design-pattern CodeLens handoffs execute without an interpreter error (previously 33/42).
- ✅ A focused regression suite now runs both collections and checks the repaired compatibility behavior.
- ✅ Unreliable syntax-only complexity labels are hidden until reviewed metadata or a defensible analyser replaces them.
- ✅ The workspace defaults to one right-side panel. Learners can choose **Learn & output**, **Data structures**, or **Split view**.
- ✅ `Array.from`, `Object.fromEntries`, `Symbol.iterator`, Map iteration, custom iteration, and destructured callback parameters cover the compatibility failures found in the initial audit.
- ⏳ Python worker isolation, richer Python tracing, the learning library, specialized DSA views, and C++ remain planned below.

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
