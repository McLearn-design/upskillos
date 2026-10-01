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

## Done: Phase 6, tilemaps (2026-09-30)

The milestone was "the user can build a tile-based level". The Phase 6 browser test does exactly that, in the
editor.

**Tilesets** are project files, like scripts (`tilesets/….tileset`). Each one is:
- an image cut into tiles of a given size, with margin and spacing;
- numbered across, then down;
- with a list of solid tiles: the collision metadata, shared by every layer that uses the tileset.

The project format is now 2. Older projects are migrated on load: the first real use of the migration path,
and it is tested. Scene API: `project.createTileset(path, {...})`, and fields set with
`project.tileset(path).solid = [...]`.

**TileMapLayer** is a node, as in Godot 4.3.
- **Layers** are separate TileMapLayer nodes: a floor, walls in front, coins on top.
- **Properties:** `tileset`, `cells` (stored compactly as `[x, y, tile, …]` in a fixed order), and
  `collisionLayer`.
- **Scripts** have `getCell`, `setCell`, `eraseCell`, `getUsedCells`, `localToMap`, `mapToLocal`,
  `isCellSolid` and `tileSize`.
- **The Scene API** adds `paint([[x, y, tile], …])`, `fill(x, y, w, h, tile)`, `setCell` and
  `fromText(rows, legend)`, which reads a map written as text.
- **The game** draws it with Phaser's real Tilemap and TilemapLayer, rebuilt only when its cells change.

**Collision:** solid tiles are merged into as few rectangles as a greedy pass finds (`solidRects`). A body
sliding along a floor of many tiles therefore meets one flat edge and cannot catch on the seams between tiles.
- Bodies stop at them, and `getSlideCollisions` and `onCollision` name the layer.
- Areas notice them too, as Godot's do.
- Erasing a tile opens the way at once.

**The TileMap panel** is a bottom-panel tab, opened by selecting a TileMapLayer:
- the layer's tileset, and a form to make a tileset from any project image;
- the tools: Paint, Erase, Rectangle, Bucket fill and Pick (Alt-click picks with any tool);
- the palette: the tileset enlarged, where a click chooses the tile;
- "Solid tiles" mode, where clicking palette tiles marks them solid.

In the viewport, while the panel is open:
- the selected layer shows its cell grid and the cell under the pointer;
- a drag paints every cell it crosses (Bresenham's line), previewed live;
- each stroke is one command, logged as `paint([...])`;
- solid tiles are drawn as collision outlines, like body shapes.

Tilesets are listed in Files.

**The fourth example, Maze Chase** (Tiny Dungeon art). Eat every coin before two ghosts catch you. It has:
- three tile layers, with the map written as text and read with `fromText`;
- movement from cell centre to cell centre that asks the map where it can go;
- coins that are tiles, so eating one is `eraseCell`;
- ghosts that find the player with a breadth-first search, in `scripts/grid.js`, a module both ghosts import.

Tested headlessly:
- every cell is reachable;
- walking a row eats exactly its five coins and stops at the centre of the last open cell;
- a ghost's route is the shortest one;
- a ghost catches a standing player, which costs a life and sends everyone home;
- the last coin wins;
- erasing a wall opens a passage the player uses.

**Potion Hunt now uses tiles.** Its 240 floor and wall sprites, and the StaticBody2D with four shapes, are two
TileMapLayers. Its wall tests pass unchanged, which shows the tile collision has the same geometry.

**Problems found and fixed:**
- **The script editor could not resolve imports between scripts.** Monaco only knew the script that was open,
  so `import … from './grid.js'` would have been underlined as missing. Every project script is now a Monaco
  model, kept in step with its saved or unsaved text.
- **`node.children` and `node.parent` were typed as plain Node,** so `child.restart()` (a method from the
  child's own script) was underlined. They are typed like `get()` now.
- **Two infinite loops** in the first draft of Maze Chase's scripts: a "next cell" equal to the current cell.
  The headless tests hung, and showed it before it reached the browser.
- **The example tests imported every image as 16 × 16.** That was harmless until a tileset's tile count
  depended on its image's size; they now read each PNG's real size.
- **The bottom panel was a fixed 190 px,** too short for a tile palette. It now resizes by dragging its top
  edge, and remembers its height in this browser.

**Not done yet:** importing maps from Tiled (`.tmj` files). The spec's §40 list does not need it, but the
phase table names it.

**Tested:**
- `npx vitest run src/labs/game-studio`: 129 tests in 10 files. New: tile maths, tilesets and layers in the
  model (including the migration), the engine's tiles (the API; landing; a 40-tile slide checked every frame
  for snags; landing on a seam; walls; erasing; rigid bounces; areas), "no fake controls" for the three new
  properties, and Maze Chase.
- `e2e/phase6.acceptance.mjs` (11/11).
- `npm run game:acceptance`: 15/15, 9/9, 10/10, 10/10, 10/10 and 11/11.

## Done: Phase 3's error test, and Tiled import (2026-10-01)

**Phase 3 is complete.** `e2e/phase3.acceptance.mjs` (6/6), through the editor:
- A script that throws on its 30th frame is reported once in Output, with its file, line and node:
  `scripts/broken.js:6 this.notThere is not a function (node Broken)`.
- Another script keeps logging, because the error stopped only its own node.
- Clicking the error opens the script at line 6.
- Typing a syntax error and pressing Run refuses to start ("Not running: 1 script has a syntax error"),
  pointing at `scripts/broken.js:3:20`.
- Clicking that error puts the cursor at line 3, column 20.

**Tiled import** finishes the Phase 6 row. Tiled (mapeditor.org) is the free map editor most 2D art is made
for, and Kenney's packs include Tiled maps.
- **Formats:** maps in Tiled's XML (`.tmx`) or JSON (`.tmj`), with tilesets inside the map or in their own
  files (`.tsx`, `.tsj`).
- **Layer data:** CSV, arrays or uncompressed base64; finite maps and infinite maps (chunks); group layers;
  layer offsets; hidden layers.
- **Solid tiles:** taken from a tile's collision shapes, or a `solid` / `collides` property.
- **Flipped and turned tiles:** Tiled's three flip flags are kept in the cell. The editor and Phaser draw them
  the same way, using the mapping Phaser's own Tiled loader uses. Kenney's sample map depends on this for its
  walls.
- **An import is Scene API code run as one command**, so it is one undo step and GUI → code shows it: a tileset
  for each Tiled tileset, a TileMapLayer for each tile layer (one per tileset when a layer uses several),
  painted with `paint([...])`.
- **Images** are matched by the end of their path: `../Tilemap/tilemap.png` finds
  `assets/tiny-dungeon/tilemap/tilemap.png`.
- **What it cannot take, it says how to fix in Tiled:** compressed layers ("set Tile Layer Format to CSV"),
  a tileset file not chosen with the map, an image not in the project, or an isometric map. Object and image
  layers are left out, and named in the message.

**In the editor:**
- Files › Import… also takes `.tmx` and `.tmj`, with their `.tsx` and `.tsj` chosen alongside.
- Starter art › Tiny Dungeon has "Tiled map: sample-map.tmx › Import". It is Kenney's own sample, now in
  `starter/tiny-dungeon/tiled/`; it adds the sheet it needs and imports the map.

**Tested:**
- `core/xml.ts`: a small XML reader, so the model still runs in Node.
- `core/tiled.test.ts` (8 tests), on Kenney's real files:
  - 32 × 20 cells and three layers;
  - gid 51 with its flags becomes tile 50 with the same flags;
  - the import builds a project with no problems;
- and on JSON maps covering every other form and every error message.
- The Phase 6 browser test (13/13) imports the sample both ways, and the game draws it.

## Done: Phase 7, scene composition (2026-10-01)

The milestone was "the user can build a multi-scene game". Zombie Arena is one, and the Phase 7 browser test
works with it in the editor.

**Scenes inside scenes (§41).** A node can be an instance of another scene (`instance: "scenes/coin.scene"`).
- Its type, properties, script, groups, connections and children come from that scene, so editing the source
  changes every instance.
- Saved on the instance is only what differs: its own properties, and `overrides` (changed properties of
  nodes inside it, by path: `{ "Sprite": { "scale": … } }`). That is the spec's "source scene, instance,
  instance overrides".
- `expandScene` builds the full tree for the engine and the editor. Nodes from an instance get stable ids
  (`<instance>:<id in its scene>`).
- They can be changed (as overrides) but not renamed, moved or deleted, which belongs in their own scene.
- A scene cannot contain itself, directly or through others; the problem report names any loop.
- **In the editor:**
  - Files › ⧉ puts a scene into the one being edited.
  - The tree shows an instance's contents greyed and marks instances with ⧉ (click to open the source).
  - The Inspector says where a node comes from, marks overridden properties, and ↺ puts the source's value
    back.
  - GUI → code logs `scene.instance(...)`, and overrides as `scene.get("Zombie2/Sprite").scale = …`.

**Groups (§42).** Nodes have groups, set in Inspector › Groups. Scripts use:
- `isInGroup`, `addToGroup`, `removeFromGroup`;
- `scene.getNodesInGroup`, `scene.callGroup`.

**Signals (§43).** Any node can `emit(name, ...args)`, and `connect(name, target, method)` or a function
connects to it.
- The engine's own events (`bodyEntered`, `bodyExited`, `animationFinished`, `onCollision`) are emitted as
  signals too, so an area with no script can still be wired to something.
- Connections can be saved in the scene, from Inspector › Signals, and are wired when the game starts. They
  keep their target by id, so renaming or moving it does not break them, and deleting it removes them.
- A connected method that does not exist is reported against the node it should belong to.

**Scenes while the game runs:**
- `scene.instantiate(path)` makes a copy of a scene, with its scripts, for bullets and enemies.
- `scene.change(path)` switches scenes at the end of the frame: old nodes get `destroyed()`, new ones
  `ready()`.
- Values that must last from scene to scene live in a script module: modules are loaded once per game.
  Zombie Arena's `state.js` keeps the score and the best.

**Resources.** In Godot, resources are shared data files. Here the shared files are tilesets (Phase 6) and
scenes used as instances. A general data file type is not needed yet, and has not been invented.

**Format 3:** instances, overrides, groups and connections on nodes. Format 2 projects migrate unchanged.

**The fifth example, Zombie Arena** (Top-down Shooter art):
- a title screen, an arena and game over, switched with `scene.change`;
- the player is an instance of `player.scene`;
- zombies and bullets come from `zombie.scene` and `bullet.scene`, made while running;
- bullets hit `isInGroup('zombies')`;
- each zombie's `died` signal is connected in code;
- the player's `healthChanged` is connected to the HUD in the scene, with no code wiring;
- the score and best are kept in `state.js`.

**Breakout now uses instances:** its 48 bricks are instances of `brick.scene`, in the group `bricks`. The rows
below the first override only their picture. Its tests pass unchanged.

**Problems found and fixed:**
- **Renaming, deleting or duplicating a node inside an instance failed with "No node n9:n5".** The commands
  worked out the node's path for the log before anything else; they now find it through the expanded scene,
  so the clear message ("rename it in its own scene") comes through.
- **After changing a node inside an instance, the selection was cleared.** The store kept only selected nodes
  it could find in the saved scene; it now looks in the expanded scene.
- **`node.children`, `node.parent` and `scene.root` were typed as plain Node** in the script editor, so calling
  a method from that node's own script (`scene.root.gameOver()`) was underlined. They are typed like `get()`.
- **The Files panel grew wider than its column** when a long image name did not fit, which hid the ★ and ⧉
  buttons. Names now shorten with "…".
- **Closing a script tab could make Monaco report "Canceled" as a page error,** once every script was kept
  as a model. Models are now kept when a tab closes, set to the project's text when opened, and removed when
  their script is deleted.

**Tested:**
- `npx vitest run src/labs/game-studio`: 159 tests in 13 files. New:
  - `core/instances.test.ts`: expansion, the source changing every instance, overrides (logged, replayed and
    removed again), loops, refused edits, groups and connections as commands, connections surviving a rename,
    the problem report, format 3;
  - `engine/scenes.test.ts`: instances running their scripts, groups, `connect` and `emit`, a connection saved
    in the scene, a missing method reported once, `callGroup`, `instantiate`, `change`;
  - Zombie Arena played through: title → arena, shooting, a kill scoring through the signal, zombies coming,
    the HUD through the saved connection, game over, back to the title.
- `e2e/phase7.acceptance.mjs` (9/9).
- `npm run game:acceptance`: all eight browser tests pass (15, 6, 9, 12, 10, 10, 13 and 9 checks).

## Fixed: switching projects could silently do nothing (2026-10-01)

The user found that creating a project, opening another, or starting a tutorial left the current project open.
There were two causes.
- **A running game kept playing over the new project.** Switching never stopped it, and the editor shows the
  running game instead of the viewport. Every switch now stops the game, and drops the old project's task and
  panel state.
- **The "unsaved changes" question used the browser's `confirm()`.** A browser can be told to stop showing such
  boxes, and then `confirm()` answers "no" without asking, so nothing happened. The editor now asks its own
  question (`store.ask`, `QuestionDialog`): **Save, then continue**, **Continue without saving**, or **Cancel**.
  Every other `confirm()` (stop a task, Show me, delete a project) is replaced too.

**Tested:** `e2e/switching.acceptance.mjs` (6/6), starting with an example open, unsaved, and its game running:
- creating a project asks, inside the editor;
- Cancel keeps everything, still running;
- "Continue without saving" switches and stops the game;
- "Save, then continue" saves first (the project appears in the saved list);
- starting a tutorial while a game runs works.

The browser tests used to accept every browser dialog automatically, which hid this. They now answer "no", as a
browser that blocks dialogs does, so any `confirm()` left anywhere would show up as a failure.

## Done: 18 tutorials in Help › Tutorials, and the home page search (2026-10-01)

The user found the in-editor tutorials good and asked for many more, ahead of the course lessons. **Help ›
Tutorials** now has five chains, 18 tasks, following the course outline:

| Tutorial | Tasks |
|---|---|
| First steps | a character on the screen; run your game; make Hero move (100 px/s on any screen); steer with the keyboard |
| Physics | walls that stop you; gravity and jumping; coins (areas); a bouncing ball; collision layers |
| Camera and HUD | a camera that follows (and smoothing); camera limits; a HUD that stays put |
| Animation | a walking AnimatedSprite2D; a door sliding open by keyframes; a switch that opens it from a script |
| Tilemaps | a tileset and a floor; solid walls on their own layer; Kenney's map from Tiled |

- **Checks:** play checks can now arrange the game first (`setup`: put the player on a coin), press keys later
  (`keysAt`: after landing), and watch every frame (`watch`, with the camera's view: the top of a jump, how far
  the camera lags).
- **Tested** as every task is: each start is not already done, and each solution passes every step (21 task
  tests).
- **The browser test** does two tutorials through the real editor, as their steps say: Physics' first three
  steps, including New script giving a CharacterBody2D arrow-key movement, and the Tiled task with the real
  Starter art Import button.

**Fixed:**
- **Typing "game studio" in the home page search did not find Game Studio** (typing "studio" did). The search
  treats "game" as "show only games", and Game Studio is a builder, so it was filtered out before its own name
  was looked at. A query found in an item's own text now always matches; category words narrow only other
  searches. Tested in `src/pages/matchItem.test.js`.
- **Long dialogs ran off the screen** (the Tutorials list): the overlay centred them with a grid, so their height
  limit did nothing. Centred with flexbox, they fit and scroll.

## Done: "Try it", tasks for the course and for Help › Tutorials (2026-10-01)

A **task** is one thing to try (`tasks/`): a starting project (Scene API code), steps with checks and hints, and a
solution. There are three kinds of check:
- **project**, which looks at the project ("a Sprite2D called Hero");
- **play**, which runs the learner's own game, headless, on the real engine, with keys held ("holding → moves Hero
  right", "100 px a second at 30 and at 144 frames a second");
- **editor**, which looks at what the learner did ("the game has been run").

- **Opening a task:** a lesson's link (`gameStudioLink(task, { from, lesson, checkpoint })`) or Help ›
  Tutorials… The task starts as a new project.
- **The task panel** sits beside the viewport. Steps tick off as Game Studio sees them done. The step you are on
  says what is not right yet, and has a hint. "Show me" applies the solution as one undo step.
- **Finishing** marks the lesson's checkpoint in the app's progress. "Back to the lesson" returns to it; in a
  tutorial, "Next task" goes on.
- **Play checks run in a worker,** away from the editor's page, and read scripts as typed (saved or not).
- **Chapter 1's four tasks:** put a character on the screen, run your game, make Hero move (at 100 px/s on any
  screen), and steer Hero with the keyboard (diagonals no faster).

**Tested:**
- `tasks/tasks.test.ts`: every task's start is sound and not already done, and its solution passes every step;
  links open their task, and an unknown task fails there.
- `e2e/tasks.acceptance.mjs` (7/7):
  - a lesson-style link opens the task;
  - every step ticks as it is done in the editor;
  - the checkpoint is marked, and Back returns to the lesson;
  - a script typed but not saved passes the play checks;
  - "Next task" and "Show me".

**Fixed on the way:** Monaco reports its own cancelled work as an unhandled "Canceled" error when an editor
closes; it came and went in Phase 3's browser test. Only that exact error is now silenced, as VS Code does.

## Next

1. **The course, "Making Games with Game Studio"** (the user asked for it, 2026-10-01): lessons that send the
   learner into Game Studio to try each idea and back for the next. **"Try it" is done,** with 18 tutorials
   (below). Next: more tutorials (Scenes, then Game logic and the projects), then lessons 1.1–1.4 as a trial. The plan is in
   [game-studio-course-plan.md](game-studio-course-plan.md).
2. **Phase 8, export:** the project as a zip, and the game exported to run on its own (Pages-safe).
3. **Phase 9, machine learning (the user asked for it at the end of the plan).** A Gymnasium-style environment
   around any Game Studio game:
   - `reset()` and `step(action)`, returning what the agent sees, its reward, and whether the game has ended;
   - the game runs headless, faster than real time, as the example tests already do;
   - the author chooses the observation (game state, such as ball and paddle positions), the actions (the input
     map) and the reward.
   The same environment would be usable from Python in the ML Lab (Pyodide, beside Lab 37 on reinforcement
   learning), with a way to watch a trained agent play in the editor. It learns from game state, not screen
   pixels: learning from pixels is too slow in a browser. About 2–3 sessions.
4. **After Game Studio is finished: bring Tile Mapper up to Game Studio's standard (the user asked for this,
   2026-09-30).** `src/labs/tile-mapper` should get the same treatment:
   - a real architecture with an architecture doc;
   - commands with undo, and GUI → code;
   - "no fake controls" tests and browser acceptance tests;
   - examples built only from real features;
   - the same look, and an API reference if it has scripting.
   It should also work with Game Studio's tilemaps (Phase 6). Sprite Lab (`src/labs/sprite-forge`) is to be
   integrated the same way.

## Phases

| Phase | Content | Proven by | State |
|---|---|---|---|
| 0 | Architecture decisions, licence check | This record | Done |
| 1 | Model, editor shell, commands, undo, code log, image assets, Sprite/Node2D/CharacterBody2D (no collision), scripts, input, iframe runtime, IndexedDB, the Kenney starter set | The Phase 1 acceptance test | Done |
| 2 | Camera, more node types, asset browser, drag-and-drop, project settings | Phase 2 browser test | Done |
| 3 | Script editor completeness, Output with click-to-source, TypeScript later | Script error test | Done: API reference, hover docs, underlined mistakes, run-time and syntax errors with click-to-source (phase 3 test) |
| 4 | Physics: bodies, shapes, layers and masks, gravity | Platformer, Breakout (physics part) | Done: Potion Hunt, Coin Run and Breakout all pass |
| 5 | Animation: sprite frames, property tracks, timeline | Platformer animation | Done: AnimatedSprite2D, AnimationPlayer and the Animation panel; Coin Run uses both |
| 6 | Tilemaps: tilesets, painting, tile collision, Tiled import | Maze chase | Done: tilesets, TileMapLayer, the TileMap panel, Tiled import, Maze Chase |
| 7 | Scene instancing, groups, signals, resources | Breakout, puzzle, shooter | Done: instances with overrides, groups, signals, instantiate and change; Breakout (instanced bricks) and Zombie Arena |
| 8 | Project zip, game export, Pages-safe output | Export test: open the exported game on its own | |
| 9 | Machine learning: a Gymnasium-style environment for any game, used from the ML Lab | Train an agent to play Breakout from game state | |
| After | Tile Mapper (and Sprite Lab) brought up to Game Studio's standard | Their own acceptance tests, and use from Game Studio | |

## Size

About 12–20 agent sessions in all; Phases 1–3 are about 4–6. The bottleneck is checking each feature in a
real browser.
