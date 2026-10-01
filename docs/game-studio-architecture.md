# Game Studio: Phase 0 architecture decisions

Status: **decided**, 2026-09-30. This record comes before any Phase 1 code. The product specification is
[`docs/game-plan.md`](game-plan.md); this record fixes the contract that the specification leaves open, and
records where this build differs from it. Progress is tracked in
[`docs/game-studio-status.md`](game-studio-status.md).

A decision here changes only by a new entry in "Changes to these decisions" at the end, with the reason.

## Contents

1. [Replace the prototype](#adr-1-replace-the-prototype)
2. [Layers and the boundaries between them](#adr-2-layers-and-the-boundaries-between-them)
3. [The runtime runs in its own iframe](#adr-3-the-runtime-runs-in-its-own-iframe)
4. [The script contract](#adr-4-the-script-contract)
5. [The engine API is the only surface user code sees](#adr-5-the-engine-api-is-the-only-surface-user-code-sees)
6. [Nodes, not a separate component system](#adr-6-nodes-not-a-separate-component-system)
7. [Units and conventions](#adr-7-units-and-conventions)
8. [Editor commands: undo and GUI → code are the same thing](#adr-8-editor-commands-undo-and-gui--code-are-the-same-thing)
9. [Inspectability](#adr-9-inspectability)
10. [Persistence and export](#adr-10-persistence-and-export)
11. [Assets: Kenney CC0 as the starter library](#adr-11-assets-kenney-cc0-as-the-starter-library)
12. [Example games are engineering tests](#adr-12-example-games-are-engineering-tests)
13. [Phase 1 and its acceptance test](#adr-13-phase-1-and-its-acceptance-test)
14. [How it is verified](#adr-14-how-it-is-verified)
15. [Deferred on purpose](#adr-15-deferred-on-purpose)

---

## ADR 1: Replace the prototype

**Decision.** Rebuild Game Studio (`src/labs/game-studio`) on a new model. The current app is a prototype:
- scenes are flat lists of coloured shapes;
- behaviour comes from hard-coded presets (`topDown`, `bounce`) and gameplay roles read by the runtime;
- scripts are a single update body with loops, functions and classes forbidden.

None of that fits a node tree, real scripts or real assets.

**Kept:** the lab's route and entry, IndexedDB storage (rewritten), and the teaching text of the example
walkthroughs (reused where the new examples teach the same idea). The Sprite Forge and Tile Mapper
integrations are kept as import paths (ADR 10).

**Not kept:** the old project format (`upskillos-game-project` v2). There is no converter, because there are
no projects worth converting. Old saved projects are left alone in storage, not deleted, and are not
opened.

## ADR 2: Layers and the boundaries between them

```text
        EDITOR (React)                  Scene tree · Viewport · Inspector · Files · Script editor · Code · Output
            │ commands only
            ▼
     PROJECT MODEL (pure TS)            Project · Scene · Node · Resource · Asset · InputMap · Settings
            │ serialize (deterministic, versioned JSON)
            ▼
     RUNTIME PROJECT (JSON + assets)
            │ postMessage protocol
            ▼
 ┌─ sandboxed iframe ───────────────────────────────────────────────┐
 │   USER SCRIPTS  →  GAME API  →  ENGINE  →  PHASER ADAPTER  →  Phaser │
 └──────────────────────────────────────────────────────────────────┘
```

Rules, each enforced by where code lives and by import checks in tests:
- **The model** (`core/`) imports neither React nor Phaser. It is tested in Node.
- **The editor** changes the project only through commands (ADR 8). No React component owns project data.
- **The editor viewport** draws the model with its own renderer. It reads model state; it is not a running
  game. (A viewport that is secretly a Phaser game is how editor and runtime state get tangled.)
- **The engine** (`runtime/engine/`) owns the node tree at run time, the lifecycle, input, signals and
  physics stepping. It talks to Phaser only through `runtime/phaser/`, the adapter. Replacing Phaser means
  replacing that folder.
- **User scripts** see only the Game API (ADR 5).

## ADR 3: The runtime runs in its own iframe

**Decision.** Run and Run Scene create a sandboxed iframe (`sandbox="allow-scripts"`, no same-origin) and send
it the serialized runtime project. Stop destroys the iframe.

**Why:**
- **Isolation.** Editor state cannot be changed by the game. Stop cannot leak timers, listeners, audio or
  WebGL state, because the whole document goes away.
- **Safety.** User code cannot reach the app's storage or the page.
- **Export is the same thing.** An exported game is this runtime, as `index.html` plus the project, without
  the editor.

**Protocol** (all messages are plain JSON):

| Direction | Message |
|---|---|
| editor → runtime | `load { project, assets, scene }` · `pause` · `resume` · `restart` · `inspect { nodeId }` |
| runtime → editor | `ready` · `log { level, args, source }` · `error { message, file, line, column, stack }` · `state { nodeId, props }` (answer to inspect) · `stopped { reason }` |

- **Assets** go in as blobs and become object URLs inside the iframe.
- **Stop** is the editor removing the iframe. No message is needed, so a hung game can always be stopped.
- **Runtime changes never flow back into the project** (the specification's §29). A "Keep this state"
  command may be added later; it would be an explicit command, applied by the editor.

## ADR 4: The script contract

**Language:** JavaScript, as ES modules. TypeScript is added later, by transpiling in the browser, without
changing this contract.

**Shape.** A script is a module whose default export is a class extending the node type it is attached to.
The classes are provided by the engine, as in Godot:

```javascript
export default class Player extends CharacterBody2D {
  speed = 200;                      // plain fields are fine

  ready() {                         // once, after the node and its children are in the tree
    this.jumps = 0;
  }

  update(dt) {                      // every frame; dt in seconds
    const x = input.axis('move_left', 'move_right');
    this.velocity.x = x * this.speed;
  }

  physicsUpdate(dt) {               // fixed 60 Hz, before physics moves bodies
    this.moveAndSlide();
  }

  destroyed() { }                   // once, when removed
}
```

**Lifecycle, in this order every frame:**
1. Input is sampled.
2. `physicsUpdate(dt)` runs zero or more times at a fixed 1/60 s, followed each time by the physics step.
3. `update(dt)` runs once with the frame time.
4. The frame is drawn.

`ready()` runs children-first, as in Godot, so a parent's `ready` can use its children.

**Globals in a script:**

| Global | What it is |
|---|---|
| `input` | The input map (ADR 7) |
| `scene` | The running scene's tree |
| `time` | `now` and `frame` |
| `console` | Forwarded to the Output panel |
| `math` | Vector helpers |
| The node classes | Every registered node type |

**Imports:** scripts may import each other by project path (`import { clamp } from './util.js'`). There is no
network access and no other imports.

**Errors:**
- **Where:** each script is loaded with a `//# sourceURL` of its project path, so stack traces name the file
  and line. The Output panel shows `file:line:column message`, and clicking it opens the script there.
- **What happens:** a script that throws in `update` is reported once and its node stops updating. The game
  keeps running, so one bug does not freeze the rest.

**Why classes that extend nodes, not a free-standing object with `this.node`:**
- `this.position` works directly, as in the specification's examples.
- It matches Godot, which the product is modelled on.
- The Inspector can show a script's own public fields as properties.

## ADR 5: The engine API is the only surface user code sees

User code talks to the Game API, never to Phaser. There is no escape hatch to Phaser objects in version 1.

Every property and method a script can use is documented in `runtime/api.md`, which is generated from the
node registry, and shown in the script editor's reference. Anything not documented there is not API.

Why: the renderer, the physics and even Phaser itself can then change without breaking user projects. It
also keeps the API teachable, because it is small, consistent and in plain terms.

## ADR 6: Nodes, not a separate component system

**Decision.** Composition is by child nodes, as in Godot: a `CharacterBody2D` has a child `CollisionShape2D`
and a child `Sprite2D`. There is no parallel component system.

**Why:**
- One mechanism, not two.
- The scene tree shows everything an object is made of.
- Scene instancing (Phase 7) works on one kind of thing.

The specification's "components where useful" is met by node types, which the registry defines.

**The node registry** (in `core/nodes/`) defines each type. The Inspector, the save format, the Game API
reference and the runtime are all generated from it. Each entry holds:
- a type name and a base type (for inheritance);
- a property schema: name, type, default, range and help text;
- the runtime class.

A property in the schema that the runtime does not use fails a test (ADR 14). That is the specification's
"no fake functionality" rule, made checkable.

**Identity and paths:**
- Every node has a stable id, which is never shown and never reused.
- Sibling names are unique: a clash gets a number added (`Enemy2`). That makes paths
  (`scene.get('Player/Sprite')`) unambiguous for scripts.

## ADR 7: Units and conventions

| Quantity | Convention |
|---|---|
| Distance | Pixels; +x right, **+y down** (screen convention, as Phaser and Godot 2D) |
| Rotation | In the API, **radians**, clockwise-positive on screen, with `rotationDegrees` alongside. The Inspector shows degrees. (Godot does the same, and the maths lessons need radians.) |
| Time | Seconds everywhere (`dt`, timers, animation) |
| Colour | `'#rrggbb'` strings, with optional alpha as a number |
| Input | Named actions only, in scripts: `isPressed(a)`, `isJustPressed(a)`, `isJustReleased(a)`, `axis(neg, pos)`, `vector(left, right, up, down)`. Keys, mouse buttons and gamepad buttons are bound to actions in Project Settings. |

## ADR 8: Editor commands: undo and GUI → code are the same thing

Every change to the project is a command. A command:
- applies itself to the model;
- stores what it needs to undo itself (a before and after patch of the objects it touched);
- has a **label** ("Move Player");
- has **code**: the Scene API call that makes the same change.

```text
Drag Player        →  command "Move Player"  →  code:  scene.get('Player').position = { x: 200, y: 150 }
Add a Sprite       →  command "Add Sprite"   →  code:  scene.add('Sprite2D', { name: 'Sprite', parent: 'Player', texture: 'assets/player.png' })
```

- **The log is replayable:** the tests run the log against an empty project and get the same project. This is
  how MeshLab proves its GUI → code panel is honest.
- **The Code panel** shows this log, one line per action, and the selected node's creation code (ADR 9).
- **A drag is one command:** it updates live, and is committed as one undo step on release.

The Scene API that the log uses is the editor-time twin of the runtime Game API: the same names and the same
property paths, so what you learn from the log works in a script.

## ADR 9: Inspectability

Selecting a node shows, besides its properties:
- **Code:** the call that would create this node as it is now (`scene.add('CharacterBody2D', { … })`), and
  its script, if any.
- **While running:** the live values from the runtime (`inspect` / `state` in ADR 3), next to the saved
  values, marked as not saved.

The teaching loop the product exists for: **visual action → model → API → JavaScript → runtime behaviour.**
Every step of it is visible.

## ADR 10: Persistence and export

- **Storage:** IndexedDB. A project is one JSON document (`formatVersion: 1`, with a migration table from day
  one) plus asset blobs keyed by stable asset id.
- **Saving:**
  - **Explicit save** (Ctrl/Cmd+S) is the "saved" state; there is an unsaved marker, and a warning before
    losing work.
  - **Autosave** writes a separate recovery copy, never the saved project.
- **Project export and import:** a `.zip` (`project.json`, `scenes/`, `scripts/`, `assets/`). A project is
  never trapped in one browser.
- **Game export:** a `.zip` holding `index.html`, the runtime bundle, `project.json` and the assets. It runs
  from any static host, including a GitHub Pages subpath, because every path is relative.
- **Build:** the runtime is a separate Vite entry built to one file. The editor loads that same file into its
  iframe, so the game you test is the game you export.
- **Bringing art in:** Sprite Forge and Tile Mapper export into a project as assets (images, and Tiled-format
  JSON for maps).

## ADR 11: Assets: Kenney CC0 as the starter library

- **Licence, verified 2026-09-30 at kenney.nl/support:** "all game assets on the asset pages are public
  domain licensed (CC0) … even in commercial projects". Attribution is optional. The Kenney logo is reserved
  and is not used.
- **What gets bundled:** each pack's own licence file goes in with it. A `CREDITS.md` names every pack and
  where it came from, even though credit is not required.
- **How much:** a curated subset (characters, tiles, items, UI, a few sounds), aiming for under 10 MB. Each
  example game uses only bundled art.
- **Anything not CC0:**
  - It is bundled only after its licence is checked and recorded in `CREDITS.md`.
  - GPL code or art is not bundled, because it would bind the whole app to the GPL.
  - MIT or Apache code can be adapted, with credit.
- **Names:** the classics are rebuilt under our own names. "Pac-Man" is a trademark, so the game is a maze
  chase. The open-source versions we learned from are credited and linked.

## ADR 12: Example games are engineering tests

Each example is an ordinary project built with the editor and its API, never hand-coded around it.

> **Rule:** if an example needs a capability the engine lacks, the engine gains that capability, for any
> project, and not only for the example.

| Game | Engine capabilities it proves | Phase it lands |
|---|---|---|
| **Platformer** | Sprite, CharacterBody2D, gravity, collision, input, sprite animation, camera follow, scripting | 4–5 |
| **Maze chase** | Tilemap, tile collision, enemies with scripted or grid pathing, collectibles, game state, UI | 6 |
| **Top-down shooter** | Mouse and gamepad input, projectiles, spawning, health, audio, collision layers | 4–7 |
| **Breakout** | Rigid bodies and bounces, instanced bricks (scene instancing), UI, game state | 4, 7 |
| **Puzzle** | Grid logic, reusable pieces, tweening, state, win detection | 5, 7 |

- **Tests:** each example has an automated test, which builds it, runs a scripted input sequence in the
  browser, and checks an outcome (the player reached the flag; the bricks cleared).
- **When an example counts as done:** only once its test passes.

## ADR 13: Phase 1 and its acceptance test

**Phase 1 is:**
- the model;
- the editor shell (scene tree, viewport, Inspector, files, script editor, Output, Code);
- commands with undo and the log;
- assets: image import, and the Kenney starter set;
- Sprite2D, Node2D and CharacterBody2D with movement only (no collision yet);
- scripts;
- input actions;
- the iframe runtime with Run, Stop, pause and resume;
- saving to IndexedDB.

**Acceptance test.** One workflow proves that the model, editor, scripting, runtime, persistence and undo are
connected:

```text
Create Project → Create Scene → Add Node → Add Sprite → Import a real image → Attach JavaScript → Edit the
script → Use the input API → Run in the sandboxed runtime → Move the sprite with keys → Stop (the editor
state is unchanged) → Modify the sprite in the editor → Undo → Redo → Save → Close → Reopen → everything
restored, including the script and the image
```

It runs as an automated browser test with real clicks and keys. It is also checked by hand before Phase 1 is
called done.

## ADR 14: How it is verified

- **Model:** Vitest in Node covers every command (apply, undo, redo), serialization round trips, migrations,
  replay of the code log, and the registry. The registry check fails if a property is declared and never
  read by the runtime.
- **Engine:** Vitest covers the parts that do not need Phaser: lifecycle order, input map, signals,
  fixed-step timing, and the script loader's error mapping.
- **Runtime and editor:** Playwright tests in the repository (not scratch scripts) cover the acceptance
  workflows and each example game. They run against the dev server, which is stopped afterwards.
- **Reporting:** every phase ends with its acceptance test run and the results written to the status file.

## ADR 15: Deferred on purpose

- dockable panels and workspaces;
- capsule and polygon collision (rectangle and circle first);
- turned (rotated) collision rectangles (change 9);
- TypeScript scripts;
- multiplayer;
- a 3D mode.

---

## Changes to these decisions

Recorded during Phase 1 (2026-09-30). None of them change a boundary.

1. **Folder names (ADR 2).** The engine lives in `engine/`, not `runtime/engine/`. `runtime/` holds what runs in
   the iframe: the entry (`main.ts`), the message protocol, the script loader, and the Phaser adapter
   (`runtime/phaserRenderer.ts`, not `runtime/phaser/`). The rule is unchanged: only the adapter imports Phaser.
2. **Undo snapshots (ADR 8).** Each command stores the whole project model, before and after, not a patch of
   what it touched. A project model is small: a thousand nodes is a few hundred kilobytes, and asset bytes are
   never in it. Snapshots cannot miss a field that a patch forgot. Revisit if large projects make undo slow.
3. **A command that changes nothing is not a step (ADR 8).** Setting a value to what it already is adds no undo
   entry and no GUI → code line. The acceptance test found a text field that committed twice; this rule
   stops any such double-fire from reaching the history.
4. **Scripts are syntax-checked before they run (ADR 4).** When a module fails to parse, a browser reports
   "Unexpected token" with no line number. So the editor parses every script (with acorn) before Run, and
   reports `file:line:column`, and the game does not start. The runtime checks too, so an exported game
   reports the same way.
6. **Reparenting keeps the world placement (ADR 8).** Moving a node under another recalculates its local
   position, rotation and scale so it stays where it is on screen, as in Godot's editor. The logged code is the
   reparent call followed by those property lines, so replay is still exact.
7. **Logged numbers are exact (ADR 8).** The log writes each number in the shortest form that reads back as the
   same value. Rounding to 4 decimal places made replay slightly wrong.
8. **An example is Scene API code (ADR 12).** An example is the code that builds it: the same language the
   GUI → code panel writes, run as one command on a new project, with its images from the starter art. So an
   example can only use what the editor and engine really offer, and GUI → code shows exactly how it was
   built. Each is also played headlessly on the real engine in `examples/examples.test.ts`.
5. **The browser tests (ADR 14)** are Node scripts using the Playwright library
   (`npm run game:acceptance`), because the repository has no Playwright test runner. Each one starts and
   stops its own dev server.
9. **Physics is the engine's own (ADR 2, ADR 15).** Collision is in `engine/physics.ts` and the body nodes,
   not Phaser's Arcade or Matter physics. So the engine stays testable in Node without Phaser, and the
   physics tests check exact numbers. Shapes are axis-aligned rectangles and circles; rectangles do not turn
   with their body yet. A CharacterBody2D moves in steps of at most 4 pixels, so it cannot pass through thin
   walls.
10. **"Just pressed" in `physicsUpdate` means since the last physics step (ADR 4).** Frames and physics steps
   run at different rates, so the input keeps a second set of "just" presses and releases, cleared after each
   physics step, and `physicsUpdate` reads that one. This is Godot's rule too.
11. **The API reference is the one description of the Game API (ADR 5).** `core/apiReference.ts` describes every
   class, member and global. The Reference panel shows it, the script editor's types are generated from it, and
   a test checks it against the real engine both ways. So the rule "the engine API is the only surface user code
   sees" is checked, not just stated. The script editor loads JavaScript's own types but not the browser's DOM,
   because scripts do not use the DOM, and its `Node` type hid the engine's.
12. **Some properties hold lists (ADR 6).** `frames` (an AnimatedSprite2D's animations) and `animations` (an
   AnimationPlayer's) are lists of plain objects. Reading, setting and running them always copies them, so a
   script or an editor field cannot change the project behind a command's back. The registry validates their
   whole shape, and the problem report follows each track to its node and property.
13. **Animation editing follows the playhead.** While the Animation panel shows an animation, the viewport and
   Inspector show the scene at the playhead (`applyClip`, the same sampling the engine uses). Editing a
   property that animation already animates sets its key at the playhead, not the node's own value. Godot
   writes previewed values into the scene; here the scene is never changed by scrubbing, so nothing is left
   half-animated when the panel closes.
14. **Tilesets are project files, and the format is now 2 (ADR 10).** A tileset (image, tile size, margin, spacing,
   solid tiles) is shared by every TileMapLayer that uses it, as a Godot TileSet resource is, so it lives in
   `project.tilesets` beside scripts rather than inside a node. Adding that list was the first change to the saved
   format; migration 1 → 2 adds an empty list, keeping the key order so a migrated project saves the same.
15. **Tile layers collide without being bodies (ADR 6).** TileMapLayer extends Node2D, as in Godot. The engine
   collects what bodies collide with as bodies plus tile layers (`Collider`), and a layer's shapes are its solid
   tiles merged into rectangles. Merging is what keeps bodies from catching on the seams between tiles.
16. **A brush stroke is one command, logged as `paint(...)` (ADR 8).** Logging the whole `cells` list after each
   stroke would make GUI → code unreadable, so tile edits are their own commands: `paint`, and in written code
   `fill`, `setCell` and `fromText`, which reads a map drawn as text.
17. **Instances are expanded, not copied (ADR 6, ADR 10).** An instance saves only its source scene's path and what
   it changes: its own properties, and overrides by path inside it. `expandScene` builds the full tree whenever it
   is needed, for the engine and the editor alike, so a change to the source reaches every instance with no
   copying to keep in step. Nodes from an instance get ids derived from the instance's and their own, so they are
   stable across expansions and can be selected and inspected. Format 3.
18. **Signal connections keep their target by id (ADR 8).** Paths change when nodes are renamed or moved; ids do
   not. A connection is logged by path (`connect("bodyEntered", "Player", "collect")`), as every log line is, and
   stored by id. The engine's callbacks are emitted as signals of the same name, so the script-method style and the
   connection style work together.
19. **What lasts between scenes lives in a script module.** Godot uses autoloaded nodes for this. A script module
   is loaded once per game, so its exports already outlast `scene.change()`; no new node kind was needed.
20. **Tasks check by running the learner's game, in a worker.** A task's checks can play the learner's own game on the
   real engine, so a check says what a teacher would ("Hero moves 100 px a second at any frame rate"), not how the
   code must look. Those runs happen in a worker, because the game's script globals (`Node`, `scene`, `input`)
   must not touch the editor's page. Every task is tested to fail on its start and pass on its solution, so a task
   cannot quietly become impossible or trivial.
21. **The art labs hand work over in the page, not as files.** Game Studio, Sprite Forge and Tile Mapper are windows
   on one page, so `src/utils/artBridge.js` passes pictures as Blobs through a per-lab inbox and an event; a lab
   that is just opening takes what is waiting when it mounts. Downloads and uploads still work in each lab, for
   other engines. A picture made in Sprite Forge is marked on its asset (`origin: "sprite-forge:<id>"`), so Edit
   reopens the original document, frames and all, not a re-read PNG. A picture coming back replaces the asset's
   bytes with `replaceAsset`: a new id at the same path, so every node using it changes, and undo restores the old
   id, whose bytes are kept. A map coming back is painted into its parent node by layer name, so the layers' ids,
   scripts and connections survive the round trip (`core/artMaps.ts`).
22. **An exported game is the editor's runtime, starting itself (ADR 10).** The runtime file the editor puts in
   its iframe also ships as the game. When it has no parent window it loads its own project, from the page (the
   one-file export) or from `project.json` beside it (the website export). There is no second "player" build to
   drift from the one you test. A game carries only the images it uses; a script that names an image path counts
   as using it, because scripts choose pictures by path too.
23. **Machine learning uses the game's state and the player's controls (Phase 9).** The environment reads numbers
   from node properties by path and presses input actions, so any game can be learned without changing it, and
   the agent cannot do what a player could not. The spec is JSON so it can come from Python. The same two
   functions, `observeGame` and `pressAction`, serve training and Watch it play in the runtime, so the agent sees
   and acts exactly as it was trained. Training runs in a worker, for the same reason the task checks do.
24. **The art labs follow ADR 8 too.** Tile Mapper and Sprite Forge now treat every edit as a command, `{ label, code,
   run }`. The command is an undo step and a line of code at once: `map.paint(...)` (`mapApi.js`) or
   `sprite.paint(...)` (`spriteApi.js`). The shared hook `src/utils/useCommandHistory.js` keeps the log in step
   with undo and redo, so the log always rebuilds the document on screen from the session's start; a replay test
   in each lab holds it to that. Code typed in a lab's Code panel goes through the same runner as one command, and
   each lab's examples are code on its API, as Game Studio's are on the Scene API.
