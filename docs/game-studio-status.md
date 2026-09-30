# Game Studio: status

What is done and what is next. The rules are in
[`docs/game-studio-architecture.md`](game-studio-architecture.md); the product specification is
[`docs/game-plan.md`](game-plan.md). Read this file first when resuming.

## Now

**Phase 0 is done (2026-09-30):**
- The architecture decisions are recorded.
- The Kenney licence (CC0) is verified.
- The user approved:
  - replacing the prototype;
  - bundling Kenney art;
  - scripting in Phase 1;
  - GUI → code as a first-class feature.

**Phase 1 is done (2026-09-30), except the Kenney starter set, which is next.** `npm run game:acceptance`
passes 15/15 in a real browser, with real clicks and keys and an empty browser profile. It does, in order:
- create a project, a scene, a node and a sprite;
- import a PNG and assign it;
- attach a script from the template and paste in an edited one;
- run it in the sandboxed iframe, where `ready()` logs to Output and ArrowRight moves the player (x 200 → 315);
- stop, and the editor still says 200;
- edit (320), undo (200), redo (320);
- save, close, reopen, where position, image, thumbnail and script are all restored;
- run again, where the saved project logs "Player ready at 320";
- with no page errors.

**Unit tests:** `npx vitest run src/labs/game-studio` passes 24 tests. They cover:
- the model: commands, undo and redo, GUI → code replay to the same project (ids included), and
  saving and loading with a problem report;
- the engine: lifecycle order, fixed-step physics, error isolation, the script class check, runtime nodes,
  input, transforms, and "no fake controls";
- the script loader: imports, cycles, rewriting, stack locations and syntax errors.

### What Phase 1 contains

| Part | Where | What it does |
|---|---|---|
| Model | `core/` | Project, scenes, nodes, scripts, assets and input map as plain data. Node registry (`registry.ts`). Scene API (`api.ts`). Commands with undo, redo and the code log (`doc.ts`). Versioned saving with migrations and a problem report (`serialize.ts`). Shared 2D transforms (`math2d.ts`, `sceneView.ts`) |
| Engine | `engine/` | Node, Node2D, Sprite2D, CharacterBody2D (`moveAndSlide`, no collision yet). Lifecycle `ready`/`physicsUpdate` (fixed 1/60)/`update`/`destroyed`. Input actions. `addChild`/`queueFree`. Errors isolated per node. A draw list for the renderer. `math`, `Vec2` |
| Runtime | `runtime/` | The iframe entry, the protocol, scripts as ES modules with imports between them and errors mapped to `file:line:column`, the Phaser adapter. Built into one file by `npm run game:runtime` (1.6 MB), which runs before dev and build |
| Editor | `editor/`, `GameStudio.tsx` | See below |

The editor's parts:
- menus, toolbar and shortcuts (Ctrl/Cmd+S, Z, Shift+Z, D, Delete, F, F5, F6, F8);
- the scene tree (select, rename, drag to reparent, add, duplicate, delete);
- files (scenes with the main-scene star, scripts, image import, drag an image into the viewport);
- the viewport (the model drawn in the engine's order, pan, zoom, grid, snapping, drag to move as one undo
  step);
- the Inspector (controls generated from the registry, live values while running, the Code section);
- the Monaco script editor (engine types for completion, unsaved marker, jump to an error's line);
- Output with click-to-source, and GUI → code;
- the project list and Project settings (size, background, main scene, input map with key capture);
- IndexedDB with a recovery copy.

### Problems the tests found and fixed

- **The project list could not close after creating a project.** When no project was open, it was shown
  without a Close handler, and the same missing handler was used to close it after Create.
- **Every Inspector edit was recorded twice** (Enter committed, then blur committed again), so the first
  Ctrl+Z seemed to do nothing. Fields now commit once. Commands that change nothing are no longer steps.
- **Syntax errors came back with no line number.** Scripts are now parsed first (architecture doc,
  change 4).

### Notes

- **The old prototype is gone from `src/labs/game-studio`.** Its example walkthroughs are in git history
  (`src/labs/game-studio/examples.js` before 2026-09-30), and their teaching text can be reused when the
  example games are rebuilt.
- **Its saved projects** are left in IndexedDB's `projects` store, as ADR 1 says.
- **A development-only handle:** `window.__gameStudio = { store }`, for browser tests.

## Next

1. **The Kenney starter set** (the rest of Phase 1). Download a curated CC0 subset (characters, tiles, items, UI),
   keep each pack's licence file, and write `CREDITS.md`. Then make them importable from the Files panel.
2. **Phase 2:** camera and follow, rotate and scale gizmos in the viewport, the asset browser with previews,
   more project settings, and the "run a 2D scene" test.

## Phases

| Phase | Content | Proven by | State |
|---|---|---|---|
| 0 | Architecture decisions, licence check | This record | Done |
| 1 | Model, editor shell, commands, undo, code log, image assets, Sprite/Node2D/CharacterBody2D (no collision), scripts, input, iframe runtime, IndexedDB | The Phase 1 acceptance test | Done, except the Kenney starter set |
| 2 | Camera, more node types, asset browser, drag-and-drop, project settings | Run-a-2D-scene test | |
| 3 | Script editor completeness, Output with click-to-source, TypeScript later | Script error test | |
| 4 | Physics: bodies, shapes, layers and masks, gravity | Platformer, Breakout (physics part) | |
| 5 | Animation: sprite frames, property tracks, timeline | Platformer animation | |
| 6 | Tilemaps: tilesets, painting, tile collision, Tiled import | Maze chase | |
| 7 | Scene instancing, groups, signals, resources | Breakout, puzzle, shooter | |
| 8 | Project zip, game export, Pages-safe output | Export test: open the exported game on its own | |

## Size

About 12–20 agent sessions in all; Phases 1–3 are about 4–6. The bottleneck is checking each feature in a
real browser.
