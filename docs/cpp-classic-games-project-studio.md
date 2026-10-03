# Classic games in C++ — Project Studio

The curriculum builds recognizable classic mechanics and introduces C++ when the current game needs it. Start with Pong, then reuse its input, update, collision, and state concepts in other classics. Optional modifications and debugging challenges should not block the main build.

## Available now

In the Windows desktop app, open `#/lab/project-studio`, choose **Classic Games in C++ — Pong**, and pick a new empty project folder. Click **Create Pong starter** in lesson 1, then Run. The starter supplies `game.h` and a short runnable `main.cpp`, without overwriting existing learner files.

Lesson 1 now teaches one paddle in nine runnable steps: open the court, change its initial position, name that value, move each update, respond to S, name the speed, respond to W, and correct each boundary separately. Small code blocks are immediately followed by bullet explanations, predictions, and visible experiments. Full target files are collapsed under an optional reference disclosure. The ball and right paddle deliberately remain stationary while the learner understands the first paddle.

The compiler banner detects a working system compiler or the app-managed compiler. Its Install button uses the existing desktop runtime installer. No download happens just from opening the track.

For this checkout, start or restart desktop development with `node scripts/run-desktop-dev.mjs` (equivalent to `npm run desktop:dev`). Restarting Electron is required for main-process runtime changes. An already installed packaged desktop app needs a newly built package to include this work.

The native renderer uses Windows APIs and simple shapes. The first lesson is Windows-only and uses an approximate timer. This is a starting point, not a finished historical recreation or a complete game-development course. The earlier complete rally prototype is preserved as `support/rally-reference.cpp`; it is not presented as a taught beginner lesson or automatically installed.

## Desktop connection

1. Project Studio saves the learner's active file through the existing project filesystem bridge.
2. `project:run` calls `runProjectFile` in `desktop/app/project-fs.cjs`, confined to the picked folder.
3. The C++ runtime's new `projectCommand` uses its existing compiler resolution, compiles the entry `.cpp` with its included headers, and writes `build/<entry-name>.exe` under that folder.
4. The project runner launches that executable with the project folder as its working directory and streams output/exit events through the existing bridge. C++ hides the console window; the program's own native game window opens normally.
5. Lesson 1's checks confirm its source edits. Independent compiled tests verify movement, both-key behavior, boundaries, and unchanged ball/right-paddle state. The preserved rally reference also has a `--check` mode for its prototype rules.

CodeLens tracing is a separate debugger adapter. This track does not require GDB or change CodeLens. It also does not change `courseLoader.js`, course ordering, lesson ids, routes, or progress migrations. Track discovery is the existing Markdown glob; the established tracks remain first.

One source translation unit is supported here. Headers can contain reusable definitions. Compiling several independent `.cpp` files, external graphics dependencies, and build-system configuration are future work.

## Proposed classic progression

| Project | Why these C++ concepts are needed |
|---|---|
| Pong | Variables, arithmetic, conditions, functions, structs, references; then timing and collision geometry |
| Breakout / Arkanoid | Collections of bricks, iteration, removal, levels, lives, and reusable collision functions |
| Snake | A growing ordered body, grid coordinates, containers, input queues, and self-collision |
| Space Invaders | Enemy and projectile collections, spawn timers, ownership, and wave state |
| Tetris | Board arrays, piece data, rotations, collision, locking, line clearing, and state machines |
| Asteroids | Vectors, angles, velocity, screen wrapping, and object lifetime |
| A classic platformer | Tile maps, gravity, collision resolution, animation, and camera coordinates |

Only Pong lesson 1 is currently supplied. The list is a planning sequence, not a catalog of implemented projects. Each project should have a runnable starter, incremental builds, concept explanations, optional changes, a deliberate debugging exercise, and checks against compiled behavior. A later graphics library should be introduced through an explicit dependency/build lesson.

## Initial implementation verification on 2026-10-03

- `node node_modules/vitest/vitest.mjs run src/labs/project-studio/CppProjectRuntime.test.jsx src/labs/project-studio/cppPong.desktop.test.js src/labs/project-studio/cppProject.desktop.test.js src/labs/project-studio/checks.test.js`: **4 files passed, 23 tests passed**, with Vite esbuild/oxc deprecation warnings. Real compiler tests ran on the installed MinGW compiler; no compiler tests were skipped on this machine.
- Tests compile each runnable lesson step; check both paddle boundaries, ball movement, both wall and paddle returns, both scoring directions, and a hidden real native window's timer, paint, and Escape-close events. A deliberately broken paddle return fails the supplied check.
- Adapter tests cover sibling headers, nested source folders, paths with spaces, rebuilding changed disk content, failed compilation removing stale output, missing toolchains, picked-root handoff, and refusal of escaped paths. Existing unsupported runtimes still return their previous unsupported result.
- Runtime UI tests cover using an installed compiler, installation only after a click, refreshed status, and recoverable installation errors.
- `node src/scripts/build-lesson-titles.js`, `node scripts/build-lesson-ids.mjs`, and `node scripts/generate-project-facts.mjs` regenerated the catalog; the facts generator reported the existing identity findings in the generated inventory.
- `node node_modules/vitest/vitest.mjs run src/labs/project-studio/projectChecks.test.js`: **7 assertions passed**, but the suite exited 1 because its existing synchronous temporary-folder cleanup encountered Windows `EPERM`. This repeated on a rerun; it is not recorded as a passing suite.
- A combined run adding `src/labs/project-studio/projectChecks.test.js` to the four focused files reported **30 tests passed**, but failed its cleanup hook even with a temporary retry experiment. That experiment was reverted; the existing cleanup implementation is unchanged.
- `node node_modules/vite/bin/vite.js build` with `NODE_OPTIONS=--max-old-space-size=8192`: **built in 4m 38s**, exit 0. Existing warnings included stale Browserslist data, broad Tailwind patterns, a CSS `-3` identifier, eval usage, a mixed static/dynamic import, and large chunks. This was the Vite production build, not the packaging command or a full `npm run build` pipeline.
- `node scripts/check-docs.mjs`: **Contributor docs checked: 8 file(s), links, paths and commands all exist**. The three catalog generators with `--check` reported current titles, ids, and facts, with existing inventory findings.
- `node --check desktop/app/runtimes/cpp.cjs` and `node --check desktop/app/project-fs.cjs`: exited 0 without diagnostics. `git diff --check` found no whitespace errors, with CRLF conversion warnings.

The native smoke test opens its game window hidden; a manual visual review in the desktop app was not performed. The tests validate real native execution and game behavior, while the build validates renderer bundling.

No compiler was installed, no course was modified, and no commit or push was made.

## Lesson 1 teaching revision

The original lesson demanded copying a large Windows adapter and jumped directly to complete game rules. It also mentioned an Apply step control that did not exist. The revised lesson supplies the adapter through an explicit starter action, teaches smaller changes, explains code with bullets, and makes reference files optional. These authoring features are opt-in (`provided` fences and `reference: optional` frontmatter); existing tracks retain their usual reference display.

Starter creation preflights every destination. For tracks supplying support files, it preserves an existing learner entry file and adds missing infrastructure; a conflicting support file still prevents writes. Run also supplies missing infrastructure before compilation. The original complete prototype remains outside the lesson so its work is preserved without claiming those mechanics have been taught.

Every step now explicitly distinguishes reading the supplied `main.cpp` from editing it, and states where an addition or replacement belongs. `game.h` remains supplied and unchanged throughout lesson 1.

Each visible teaching snippet has an adjacent Read only, Add, or Replace instruction naming `main.cpp` and its exact location. Placement uses existing statements and closing braces as anchors, including whether a new block belongs inside a function but outside another conditional. The three introductory snippets are explicitly identified as code already supplied in the editor.

Revision verification:

- `node node_modules/vitest/vitest.mjs run src/labs/project-studio/LessonPanel.test.jsx src/labs/project-studio/cppPong.desktop.test.js src/labs/project-studio/providedFiles.test.js src/labs/project-studio/CppProjectRuntime.test.jsx src/labs/project-studio/cppProject.desktop.test.js src/labs/project-studio/checks.test.js`: **6 files passed, 30 tests passed**. Vite printed esbuild/oxc configuration warnings. Every step compiled; independent paddle tests passed and a deliberately incorrect boundary failed. Renderer tests distinguish read/setup from editing and preserve other tracks' full reference display.
- A temporary Playwright preview used the real lesson panel, parsed lesson, Markdown renderer, and previously built application stylesheet. It confirmed three visible introductory teaching blocks of at most four lines, each followed by a bullet list, with the full reference collapsed. Step 2 shows only the one-line position edit. It reported **no page errors**. Initial requests timed out during global CSS processing; the preview then used the existing built stylesheet. Temporary preview files were removed and the dev server was stopped.
- `node scripts/check-docs.mjs` reported **Contributor docs checked: 8 file(s), links, paths and commands all exist**; `git diff --check` reported no whitespace errors, with CRLF conversion warnings.
- The earlier production-build result belongs to the initial implementation. A new production build was not run for this teaching revision.

## Starter and desktop-process repair

An entry file matching the reference does not prove the header exists. The starter button remains available to repair a missing `game.h`, and retains a learner's existing `main.cpp`. Runtime status now reports whether the loaded Electron runtime supports project execution. The C++ banner flags older bridges, and an unsupported Run result explains how to restart the updated desktop process. Updating renderer content alone cannot replace runtime modules already loaded by Electron; installed releases require an updated desktop build.

Lesson 1 explicitly checks setup before Run and teaches C++ declarations, types, parameters, references, arguments, braces, semicolons, case sensitivity, and the distinction between supplied names and keywords. An optional missing-semicolon experiment introduces compiler diagnostics without adding another code dump.

Verification: `node node_modules/vitest/vitest.mjs run src/labs/project-studio/LessonPanel.test.jsx src/labs/project-studio/providedFiles.test.js src/labs/project-studio/CppProjectRuntime.test.jsx src/labs/project-studio/cppPong.desktop.test.js src/labs/project-studio/cppProject.desktop.test.js src/labs/project-studio/checks.test.js` reported **6 files passed, 33 tests passed**, with Vite esbuild/oxc deprecation warnings. This includes missing-header repair without overwriting typed code, repair when the main file matches, legacy-bridge messaging, and compilation of all lesson steps. `node --check desktop/app/main.cjs` and `node --check desktop/app/runtimes/cpp.cjs` exited 0 without diagnostics. No installed app was replaced or running desktop session restarted during this repair.

## Visible game and process controls

The C++ executable now launches with `windowsHide: false`: Windows startup settings can suppress a native game's first `ShowWindow` call as well as its console. Compilation still hides the compiler window. Project Studio exposes Stop through the existing stop-run bridge, which now includes individual project processes. A stop requested during compilation is applied after launch. Output explains where the game opened, and events received before the run-id response are retained so an immediate exit does not leave the UI running. Rejected run requests also clear the running state.

Verification: the six focused suites listed above passed **34 tests** after adding live-process termination coverage. After adding native window visibility coverage, `node node_modules/vitest/vitest.mjs run src/labs/project-studio/cppPong.desktop.test.js src/labs/project-studio/cppProject.desktop.test.js` reported **2 files passed, 11 tests passed**, with Vite esbuild/oxc warnings. The visibility probe uses the supplied lesson header, the actual launch setting, `IsWindowVisible`, and Escape to close after three ticks. `node --check desktop/app/main.cjs` and `node --check desktop/app/project-fs.cjs` exited 0; Babel parsed Project Studio JSX successfully. An existing running app must be fully restarted to load the changed runtime.
