# Lesson engine audit — 2026-10-03

Scope: source inspection of course discovery, progress derivation, lesson visualization and recovery rendering, and the Markdown lesson engine's challenge grading. This is a focused engineering audit, not an exhaustive review of every lesson or a browser verification of every course. Catalog totals and identity findings remain in [the generated inventory](generated/project-inventory.md).

## Fixed in this audit

- JavaScript assertion labels were inserted into template literals with only backticks escaped. Backslashes could alter the displayed label; `${…}` could execute as interpolation and break an otherwise valid test. Labels now use JSON serialization, including the result payload, so pipes also survive parsing. Python and compiled-language output retain their existing protocol.
- A runtime error after an earlier passing assertion was discarded by `runTests`. It now preserves earlier results and includes runtime errors as failures. An empty result run also returns an explicit failure.
- CSS and React/Vue iframe listeners accepted any window's message with a matching type. They now require the originating test frame and an array payload. A CSS regression test verifies unrelated messages are ignored and the frame is removed after completion.
- A rejected challenge runner left the Run Tests control busy indefinitely. The component now reports the failure and clears its busy state in `finally`.

## Recommended next work

| Priority | Area | Evidence and improvement |
|---|---|---|
| High | SQL Fundamentals | `src/engine/lesson/testRunner.ts` binds raw query text for JavaScript checks; `src/labs/lesson-engine/content/sql-fundamentals/level-1.md` checks substrings. Execute against a small deterministic SQLite fixture and compare columns and rows, including NULL and empty-result cases. Keep textual checks only where style is explicitly assessed. |
| High | Course visualizations | `src/components/viz/VizFrame.jsx` builds a global registry keyed only by file stem; later course entries overwrite earlier ones. Resolve by course plus stem, retaining explicitly shared notebook components, and test two courses with the same visualization name. |
| High | Spiral recovery guidance | `src/components/lesson/MicroCycleLesson.jsx` reads `pt.label` and `pt.note`, but the existing roadmap records bare-id content. Resolve references within the current course using chapter/slug routes; show an explicit unresolved reference rather than a blank card. |
| Medium | Chemistry notebook delivery | The roadmap records Chemistry 1-0 cells present in the named lesson export while the loader prefers the default export. Compare exported content and wire the notebook through the rendered lesson. Verify in a browser before calling this repaired. |
| Medium | Calculus / precalculus identity | The current inventory still lists shared published ids. Course-scoped progress avoids cross-course completion collisions, but global title/reference lookup remains ambiguous. Use explicit migrations if ids change; do not rename published ids as a quick cleanup. |
| Medium | Python challenge authoring | `buildPythonHarness` trims every test line, losing indentation for setup functions and loops. Preserve structured setup blocks and add real Python execution tests before expanding challenge authoring to multiline test fixtures. |
| Medium | React / Vue runtime reliability | The challenge frames fetch frameworks from a CDN and execute assertions immediately after user code. Bundle supported runtimes locally and provide a mount/flush contract for asynchronous rendering, with offline and delayed-render tests. |
| Medium | In-flight navigation | Challenge runs report through the active lesson callbacks after awaiting execution. Add cancellation or a run identity tied to the lesson and step, with tests for navigation before completion. |

The course loader already has useful regression coverage comparing manifest ids to loaded lessons and conservatively omitting ambiguous legacy slugs. Preserve that behavior when improving discovery or references.

## Verification

- `node node_modules/vitest/vitest.mjs run src/engine/lesson/testRunner.test.ts src/engine/lesson/parser.test.ts src/engine/lesson/executor.test.ts src/context/lessonProgress.test.js`: **4 files passed, 50 tests passed**. Vite printed deprecation warnings for esbuild configuration and said oxc takes precedence.
- `node scripts/generate-project-facts.mjs --check`: **Project facts are current**, with existing content findings listed in the inventory.
- `node src/scripts/build-lesson-titles.js --check` and `node scripts/build-lesson-ids.mjs --check`: **Lesson titles are current** and **Lesson id map is current**.
- `node node_modules/vitest/vitest.mjs run src/courses/courseLoader.test.js`: **1 file passed, 8 tests passed**, including comparison against every loaded lesson id.
- `node scripts/check-docs.mjs`: **Contributor docs checked: 8 file(s), links, paths and commands all exist**.
- `git diff --check -- src/engine/lesson docs/lesson-engine-audit-2026-10-03.md docs/contributor-experience-and-lms-roadmap.md`: no whitespace errors; Git printed CRLF conversion warnings.
- `node node_modules/typescript/bin/tsc --noEmit --pretty false`: exited 1 with diagnostics in ConceptBlock, progressMigration tests, backend-lab, image-lab-wip, LessonEngineLab, PracticeExplorerModal, and useMathOSState. No diagnostics pointed to edited files. A pre-change TypeScript baseline was not captured, so this is not a verified baseline comparison.
- The first test command using `npx` could not start because `npx` is unavailable in this shell. The DOM test initially ran without a DOM environment, then a jsdom attempt failed because that package is absent. It now uses the repository's installed happy-dom environment and passes.
- The broad engine test attempt was interrupted; it included desktop WPF integration tests. No full-suite or production-build success is claimed.

Existing Project Studio, package, and desktop changes were present before the audit and were left intact. No lesson ids, lesson routes, or generated files were changed.
