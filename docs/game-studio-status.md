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

**Phase 1 is done (2026-09-30).** `npm run game:acceptance`
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

## Done: the Kenney starter set and Phase 2 (2026-09-30)

**Starter art** (`src/labs/game-studio/starter/`, 4.0 MB, 871 images) holds five Kenney CC0 packs:
- Pixel Platformer;
- Tiny Dungeon;
- Top-down Shooter;
- Puzzle Pack 2 (paddles, balls, bricks);
- UI Pack.

Each pack keeps its own `License.txt`, and `CREDITS.md` lists them. The sound packs wait for the audio node.

In the editor, a **Starter art** tab sits beside Files. Pick a pack and folder, then drag a thumbnail into
the viewport: the image is added to the project (once) and a Sprite2D appears where you dropped it. Or
pick several and use "Add to project".

**Phase 2:**

| Feature | What it does |
|---|---|
| **Camera2D** | Under a node, it follows it. `current`, `zoom`, and `smoothing` (the view closes 1 − e^(−k·dt) of the gap each frame). The editor draws each camera's frame |
| **Label** | Text, with `text`, `fontSize` and `color`. Its origin is the top-left corner |
| **CanvasLayer** | A screen layer, for the HUD. Its children are placed on the screen, and a second Phaser camera draws them, so they neither move nor zoom with the world |
| **Move / Rotate / Scale tools** | W, E and R, from the toolbar too. With Snap, rotation goes in 15° steps and scale in 0.1 steps. Rotate and scale work on the selection wherever you press |
| **Reparenting keeps world placement** | Dragging a node onto another in the tree keeps it where it is on screen (the local transform is recalculated), as in Godot's editor |
| **Pixel art setting** | On by default. Hard-edged scaling in the game and the viewport, so the Kenney pixel packs stay crisp when zoomed |

**Other changes:**
- The API types in the script editor gain the new classes.
- A sibling name that clashes counts on from its number (`Tile0009` → `Tile0010`), as Godot does.

**Tested:**
- `npx vitest run src/labs/game-studio` passes 28 tests. New ones cover no camera, a camera following
  exactly, the smoothing formula, the HUD on the screen, reparenting in place, and name numbering. The
  "no fake controls" check covers every property of the new types, and now also compares the camera view.
- `npm run game:acceptance` runs both browser tests: Phase 1 passes 15/15 and Phase 2 passes 9/9.
- The Phase 2 test builds a pixel-platformer scene from the starter art by dragging, reparents the character
  under the player, adds a zoomed camera and a HUD, attaches the movement script, and rotates (90°) and
  scales (2×) a tile, undoing both. It then runs: holding → scrolls the ground while the HUD's pixels stay
  identical.

**Bugs found and fixed:**
- **The GUI → code log was not exact.** It rounded numbers to 4 decimal places, so π/2 was written as
  1.5708 and replay gave a slightly different project. Numbers are now written in their shortest exact form.
- **Pressing next to a node with Rotate or Scale cleared the selection.** It now acts on the selection.

## Next

1. **Phase 3, the script editor.** Most of it is already in: tabs, the unsaved marker, errors at their line,
   the console, and Monaco's own search and replace. Still to do: a script error test in the browser, and
   hover documentation from the API types.
2. **Phase 4, physics.** Collision shapes (rectangle and circle), StaticBody2D, Area2D, collision layers and
   masks, gravity, and `moveAndSlide` that stops and slides. That is what the platformer and Breakout need.

## Phases

| Phase | Content | Proven by | State |
|---|---|---|---|
| 0 | Architecture decisions, licence check | This record | Done |
| 1 | Model, editor shell, commands, undo, code log, image assets, Sprite/Node2D/CharacterBody2D (no collision), scripts, input, iframe runtime, IndexedDB, the Kenney starter set | The Phase 1 acceptance test | Done |
| 2 | Camera, more node types, asset browser, drag-and-drop, project settings | Phase 2 browser test | Done |
| 3 | Script editor completeness, Output with click-to-source, TypeScript later | Script error test | |
| 4 | Physics: bodies, shapes, layers and masks, gravity | Platformer, Breakout (physics part) | |
| 5 | Animation: sprite frames, property tracks, timeline | Platformer animation | |
| 6 | Tilemaps: tilesets, painting, tile collision, Tiled import | Maze chase | |
| 7 | Scene instancing, groups, signals, resources | Breakout, puzzle, shooter | |
| 8 | Project zip, game export, Pages-safe output | Export test: open the exported game on its own | |

## Size

About 12–20 agent sessions in all; Phases 1–3 are about 4–6. The bottleneck is checking each feature in a
real browser.
