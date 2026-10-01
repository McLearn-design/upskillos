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

## Done: the first example, Potion Hunt (2026-09-30)

**What it is:** a top-down dungeon from Kenney's Tiny Dungeon art. You walk the hero round, collect eight
potions and keep away from a bat. It has a following camera limited to the level, a HUD with a count, and
a message at the end.

**How it is built:**
- **Only the real Scene API:** `examples/potionHunt.ts` is the same kind of code the GUI → code panel
  writes. A loop lays the 240 floor and wall tiles.
- **Its scripts** (`player.js`, `bat.js`) use only the documented Game API.
- **Opening it** from the project list makes a new project: the images come from the starter art, and the
  code runs as one undoable command (`Doc.runCode`). GUI → code then shows the whole build.
- **A guide beside the viewport** says what to look at and try.
- **The walls** are a StaticBody2D with four rectangle shapes; the hero is a CharacterBody2D, and the
  potions and the bat are Area2Ds (rebuilt on Phase 4 physics, below).

**Added to the engine and editor for it** (each works for any project):
- **Camera limits** (`limitTopLeft`, `limitBottomRight`, Godot's style, with defaults so large they do
  nothing). The editor draws them.
- **Running a block of Scene API code** as one command.
- **Collapsible branches in the scene tree,** with branches over 20 children closed at first.
- **Framing:** a project or scene opens framed to its content, and there's a Frame all menu item.

**Tested:**
- `examples/examples.test.ts` plays the example on the real engine, with its scripts loaded as ES modules
  and no special cases. It checks:
  - every example builds soundly and its GUI → code log replays exactly;
  - the HUD starts at 0 / 8;
  - standing on each potion counts up, and at 8 the message shows;
  - the bat moves, and touching it sends the hero back to the start;
  - the hero stops at the wall;
  - the camera stays within the dungeon.
- `e2e/examples.acceptance.mjs` opens each example from the project list in a browser, runs it, plays it
  with the arrow keys, and finds no script errors.
- All of this is in `npm run game:acceptance`.

## Done: Phase 4, physics (2026-09-30)

The engine's own collision, in `engine/physics.ts` and `engine/nodes.ts`, not Phaser's (architecture doc,
change 9). Shapes are axis-aligned: a rectangle does not turn with its body yet.

| Part | What it does |
|---|---|
| **CollisionShape2D** | `shape` (rectangle or circle) and `size` (a circle uses `size.x` as its diameter). The editor draws body shapes teal and area shapes green |
| **StaticBody2D** | Never moves; others stop against it. `collisionLayer` |
| **CharacterBody2D** | Moved by its script: `velocity`, then `moveAndSlide()`, which stops at solid bodies and keeps the part of the velocity along the surface. Then `isOnFloor()`, `isOnWall()`, `isOnCeiling()`, `getSlideCollisions()`. It moves in steps of at most 4 pixels, so it cannot pass through a thin wall |
| **RigidBody2D** | Moves by itself: gravity × `gravityScale`, and `bounce` (1 keeps all its speed, 0 stops dead) off solid bodies. `onCollision(body, normal)` |
| **Area2D** | Solid to nothing; `bodyEntered(body)` and `bodyExited(body)` when bodies on its mask come in and go out, and `getOverlappingBodies()` |
| **Layers and masks** | 16 layers. A body stops at another when its mask includes a layer the other is on. The Inspector shows 16 toggles |
| **Gravity** | A project setting (default 980 pixels per second²), and `physics.gravity` in scripts |

**Order in each physics step:** every `physicsUpdate`, then rigid bodies move, then areas report who came
in and went out.

**Input in `physicsUpdate` (change 10):** "just pressed" there means since the last physics step, not
since the last frame. A screen faster than 60 Hz draws some frames with no physics step, and a jump
pressed in one of those was lost before.

**Tested:** `engine/physics.test.ts` (stopping at a wall at exactly 84, sliding, landing, no tunnelling,
bounce 1, 0.5 and 0, gravity, areas), the "no fake controls" test in `engine/engine.test.ts` (every
physics property must change what happens in a scenario), and the input test above.

## Done: the second example, Coin Run (2026-09-30)

**What it is:** a side-on platformer from Kenney's Pixel Platformer art. Run and jump along a level 60 tiles
long, collect ten coins, reach the flag; fall down a gap and you go back to the start.

**What it shows**, all with the real Scene API and Game API (`examples/platformer.ts`):
- gravity as a project setting, added to `velocity.y` by the player's script;
- jumping only when `isOnFloor()`, and a shorter jump if you let go early;
- one StaticBody2D for all the ground and platforms: a `stretch()` function in the build code lays each
  stretch's tiles and one rectangle shape covering them;
- invisible walls (shapes with no picture) at both ends;
- coins as Area2Ds sharing one script, bobbing on a sine wave; a flag Area2D that ends the level;
- a two-picture walk (the script swaps `texture`);
- a backdrop where a plain picture is stretched with `scale`;
- a camera at zoom 3 that scrolls the level and stops at its edges, and a HUD.

**Tested** in `examples/examples.test.ts`, headlessly on the real engine:
- the player lands at exactly 222 (ground top 234 − half its shape);
- a jump rises exactly what the step-by-step sum of gravity gives (about 69 pixels);
- holding jump does not jump again in mid-air;
- running and jumping lands on the first platform (168);
- falling down a gap sends the player back to the start;
- every coin counts, the flag shows the message and stops the player;
- the invisible edges stop the player;
- the camera's view never leaves the level.

The browser test opens it, runs it and plays it with the arrow keys and Space.

**Totals then:** `npx vitest run src/labs/game-studio` passed 54 tests in 5 files; `npm run game:acceptance`
passed 15/15, 9/9 and 6/6. After the API reference and Breakout below: 71 tests in 6 files, and 15/15, 9/9, 8/8 and 10/10.

**Browser test fixes found on the way:** the site's welcome tour popup could appear part-way through a test
and cover the button it clicked; the harness now marks the tour as seen before the page loads. When a
browser test fails, the harness saves a screenshot to the system temp folder and prints its path.
Phase 1's key-move step holds the key 1.2 s, because headless Chromium's frames are uneven.

## Done: the API reference, and the script editor's help (2026-09-30)

**What it is:** Help › API reference (F1), docked beside the viewport. It covers every class, property,
method and global a script can use. Each entry gives:
- what it does, and Godot's name for it;
- a short example script, with a Copy button;
- the Inspector properties it has, marked as such;
- links to the classes it extends.

A search finds names, Godot names, descriptions and examples (`move_and_slide` finds `moveAndSlide`). The
contents page explains how a script works and how Godot's names map. It also documents the Scene API, the
language GUI → code writes. The Inspector links each node type to its entry, and the script editor has an
API reference link.

**One source:** `core/apiReference.ts` holds the reference. Inspector properties come from the node registry,
with its help text, so the Inspector and the reference cannot disagree. The script editor's completion and
hover types are generated from it (architecture doc, change 11).

**Tested:** `core/apiReference.test.ts` checks it against the real engine, both ways:
- every entry and member exists;
- nothing a script can reach is missing (a short list of engine internals is named in the test);
- every script global is covered;
- each class extends what the engine's class extends;
- the Scene API entries match the real project, scene and node handles;
- the generated types compile;
- every example in the reference, and every example game's scripts, type-check against them;
- a misspelt method is caught.

`e2e/reference.acceptance.mjs` checks it in a browser:
- F1, an entry, a search by Godot name, and the Inspector's links;
- hover in the script editor shows the reference's text;
- an example script has nothing underlined, and `this.queueFre()` is underlined with "Did you mean
  'queueFree'?".

**Problems it found and fixed:**
- **Hover and completion were broken for every node method from Node.** The script editor loaded the
  browser's own types, whose `Node` clashed with the engine's. So `this.queueFree()`, `this.path` and
  `this.children` had no help. The editor now loads JavaScript's types without the browser's, and `console`
  is declared as part of the API.
- **The script editor never underlined mistakes.** Monaco checks only syntax in JavaScript unless told
  otherwise. It now checks names and types too, with the noisy "could be typed" hints off.
- **The example guide covered the script editor.** It now shows only over the scene view.
- **Scripts could not refer to PhysicsBody2D,** for example `body instanceof PhysicsBody2D`. It is now a
  script global.

**This finishes most of Phase 3.** Hover documentation is in, and mistakes are underlined before Run. Still
to do: a browser test for a script error at run time with click-to-source.

## Done: the third example, Breakout (2026-09-30)

**What it is:** from Kenney's Puzzle Pack 2. Bat the ball into a wall of 48 bricks with the paddle, and clear
them with three balls. Where the ball lands on the paddle aims it.

**What it shows** (`examples/breakout.ts`):
- a RigidBody2D that moves by itself, with `gravityScale` 0 and `bounce` 1;
- `onCollision(body, normal)`, used both to break bricks and to steer the ball off the paddle;
- collision layers: the ball is on layer 2 and collides with layer 1; the paddle's mask leaves out layer 2,
  so the ball never blocks it;
- a game with no camera, where the world is the screen;
- high-resolution art brought down to size with `scale`.

**Tested** headlessly:
- the HUD at the start;
- the ball follows the paddle until Space;
- the launch angle, and exactly 360 px/s kept through 300 frames of bouncing;
- the first brick breaks (47 left, score 10);
- landing half-way to the paddle's end sends it 30° right;
- three misses end the game, and Space then does nothing;
- the paddle stops at the wall at x = 52;
- the ball never blocks the paddle;
- all 48 bricks give "You cleared the wall!".

Its scripts also type-check against the API reference, and the browser test opens it and plays it.

**Fixed on the way:** the starter art's Puzzle Pack had no balls, although the credits said it did. The
pack keeps them in colour subfolders, which the first import missed. All 40 (black, blue, grey, yellow) are
in `starter/puzzle-pack/balls/` now, from the same Kenney download (its licence file is unchanged).

**Phase 4 is now proven** by all three examples: Potion Hunt, Coin Run and Breakout.

## Done: Phase 5, animation (2026-09-30)

Two nodes, as in Godot, each with its editor. Both are in the API reference.

**AnimatedSprite2D:** named animations made of pictures, such as idle, walk and jump.
- Each animation has a speed in frames per second, and loops or not.
- Properties: `animation`, `playing`, `speedScale`, `frame`, `flipX`, `flipY`, `opacity`.
- Scripts call `play(name)`, `pause()`, `stop()` and `isPlaying()`, and can write `animationFinished(name)`.
- The Inspector edits the animations: add, rename, delete, fps, loop, and add or remove pictures. Each
  animation has a small preview playing at its own speed. `animation` is chosen from the names.
- Renaming the animation that is showing renames it in `animation` too, as one undo step (`Doc.setProps`,
  new: several properties of one node as one command).

**AnimationPlayer:** named animations of keyframes.
- Each animation has a length, loops or not, and has tracks. A track is one property of one node: a path from
  the player's parent, as in Godot, with keys.
- Between keys, numbers and vectors move in a straight line, colours blend, and anything else (true/false,
  text, a picture, layers) switches at each key.
- Properties: `animations`, `autoplay`, `speedScale`.
- Scripts call `play(name)`, `pause()`, `stop()`, `seek(time)` and `isPlaying()`, read `currentAnimation`
  and `currentTime`, and can write `animationFinished(name)`.
- A track to a missing node or property is reported in Output, and in the problem report with the key
  values checked against the property.

**The Animation panel** (a bottom-panel tab, opened by selecting an AnimationPlayer):
- choose, create, rename and delete animations; set the length, loop and autoplay;
- a ruler to click or drag the playhead along;
- tracks with keyframe diamonds: click one to edit its time and value, drag it to move it, delete it;
- ▶ previews at the player's speed.

While it shows an animation:
- the viewport and the Inspector show the scene as it is at the playhead;
- ◆ beside every Inspector property adds a key at the playhead;
- editing a property that already has a track, by typing or by dragging in the viewport, sets its key at the
  playhead instead of the node's own value.

So what you see is what you edit (architecture doc, change 13).

**The timeline shows what the game does:** the editor's preview (`applyClip`) and the engine use the same
sampling function (`core/animation.ts`). A test compares them at seven times, including exactly on a key and
past the end, for a position, an angle, a colour and a true/false.

**In the examples:** Coin Run's player is an AnimatedSprite2D (idle, walk, jump), so the walk no longer needs a
script swapping pictures. Its flag waves, and reaching the flag plays an AnimationPlayer that grows the
message from 8 to 40 pixels.

**Problems found and fixed:**
- **List values were broken in two places.** Reading a list property copied it into a plain object
  (`propValue`), and the engine turned any object value into a vector (`applyProps`). Both now copy lists
  properly.
- **A key could be reached a frame late.** Thirty steps of 1/60 add up to 0.49999999999999994, not 0.5, so a
  key at 0.5 s was missed until the next frame. Key times now allow for rounding (tested).

**Tested:**
- `npx vitest run src/labs/game-studio`: 103 tests in 8 files, covering:
  - frame timing, speed, looping, play, pause, stop and finishing, for both nodes;
  - validation and the problem report;
  - the sampling maths;
  - preview and engine agreeing;
  - "no fake controls" for every new property;
  - Coin Run's animations.
- `e2e/phase5.acceptance.mjs` (10/10), in a browser:
  - builds a sprite animation in the Inspector, and undoes a rename in one step;
  - adds an AnimationPlayer, and keys a position at 0 s with ◆;
  - scrubs to 2 s and types a new x, which becomes a key while the node keeps its own value;
  - reads x = 150 at 1 s;
  - turns on autoplay and runs, and reads both the frame and the position changing in the running game.
- `npm run game:acceptance`: 15/15, 9/9, 8/8, 10/10 and 10/10.

## Next

1. **Phase 3, the script editor:** a browser test for a run-time script error and click-to-source.
2. **Phase 6, tilemaps:** Coin Run and Potion Hunt lay hundreds of Sprite2Ds; a TileMap will replace them.
   Then a maze chase. The user's Tile Mapper lab is to be integrated here.
3. **Phase 7, scene instancing, groups and signals**, then **Phase 8, export**.
4. **Phase 9, machine learning (the user asked for it at the end of the plan).** A Gymnasium-style environment
   around any Game Studio game:
   - `reset()` and `step(action)`, returning what the agent sees, its reward, and whether the game has ended;
   - the game runs headless, faster than real time, as the example tests already do;
   - the author chooses the observation (game state, such as ball and paddle positions), the actions (the input
     map) and the reward.
   The same environment would be usable from Python in the ML Lab (Pyodide, beside Lab 37 on reinforcement
   learning), with a way to watch a trained agent play in the editor. It learns from game state, not screen
   pixels: learning from pixels is too slow in a browser. About 2–3 sessions.

## Phases

| Phase | Content | Proven by | State |
|---|---|---|---|
| 0 | Architecture decisions, licence check | This record | Done |
| 1 | Model, editor shell, commands, undo, code log, image assets, Sprite/Node2D/CharacterBody2D (no collision), scripts, input, iframe runtime, IndexedDB, the Kenney starter set | The Phase 1 acceptance test | Done |
| 2 | Camera, more node types, asset browser, drag-and-drop, project settings | Phase 2 browser test | Done |
| 3 | Script editor completeness, Output with click-to-source, TypeScript later | Script error test | Mostly done: API reference, hover docs, underlined mistakes; the run-time error test is left |
| 4 | Physics: bodies, shapes, layers and masks, gravity | Platformer, Breakout (physics part) | Done: Potion Hunt, Coin Run and Breakout all pass |
| 5 | Animation: sprite frames, property tracks, timeline | Platformer animation | Done: AnimatedSprite2D, AnimationPlayer and the Animation panel; Coin Run uses both |
| 6 | Tilemaps: tilesets, painting, tile collision, Tiled import | Maze chase | |
| 7 | Scene instancing, groups, signals, resources | Breakout, puzzle, shooter | |
| 8 | Project zip, game export, Pages-safe output | Export test: open the exported game on its own | |
| 9 | Machine learning: a Gymnasium-style environment for any game, used from the ML Lab | Train an agent to play Breakout from game state | |

## Size

About 12–20 agent sessions in all; Phases 1–3 are about 4–6. The bottleneck is checking each feature in a
real browser.
