# Browser Godot Environment — Master Build Specification

**Document type:** Product + technical implementation specification
**Target:** Browser-based game development environment
**Primary deployment:** Static website / GitHub Pages
**Primary game runtime:** Phaser
**Primary language:** TypeScript
**Editor framework:** Web application
**Backend requirement:** None for the core editor
**Goal:** Build a genuine browser-based game development environment inspired by the workflow and concepts of Godot, rather than a generic game-maker UI or visual mockup.

---

# 1. Product Definition

The application is a **full game-development environment that runs inside a web browser**.

It must allow a user to:

1. Create a project.
2. Create and manage scenes.
3. Create hierarchical nodes.
4. Place and manipulate objects visually.
5. Configure object properties through an Inspector.
6. Import and manage assets.
7. Attach scripts to nodes.
8. Define input actions.
9. Create collisions and physics bodies.
10. Create animations.
11. Build levels.
12. Run the current scene.
13. Run the complete game.
14. Pause and restart the game.
15. Save the project.
16. Reopen the project.
17. Undo and redo editor operations.
18. Export a playable HTML5 game.
19. Work entirely from a static-hosted application without requiring a proprietary backend.

The application should feel like an **IDE/game engine**, not like a webpage containing a canvas and some controls.

The central design principle is:

> **Everything the user sees in the editor must correspond to actual project data and actual runtime behavior.**

No fake controls, decorative panels, placeholder inspectors, or UI elements that do not perform the stated operation.

---

# 2. Core Architecture

The application must be divided into distinct systems.

```text
Browser
│
├── Editor Application
│   ├── Main Window
│   ├── Scene Tree
│   ├── Viewport
│   ├── Inspector
│   ├── FileSystem
│   ├── Asset Browser
│   ├── Script Editor
│   ├── Animation Editor
│   └── Output / Debug Panels
│
├── Project System
│   ├── Project Metadata
│   ├── Scene Serialization
│   ├── Resource Serialization
│   ├── Asset Management
│   └── Project Settings
│
├── Editor State
│   ├── Selection
│   ├── Undo/Redo
│   ├── Clipboard
│   ├── Layout
│   └── Workspace
│
├── Engine Abstraction
│   ├── Node System
│   ├── Component System
│   ├── Resource System
│   ├── Signals / Events
│   ├── Input
│   ├── Physics
│   ├── Animation
│   └── Rendering
│
└── Runtime
    └── Phaser Adapter
```

The editor must NOT directly manipulate arbitrary Phaser objects everywhere in the application.

Instead:

```text
Editor Model
     ↓
Scene / Node Data
     ↓
Runtime Adapter
     ↓
Phaser
```

This separation is mandatory.

---

# 3. Fundamental Design Concept

The application is based on a **scene graph**.

Every game scene consists of nodes.

Example:

```text
Main
├── World
│   ├── Ground
│   ├── Platform
│   └── Trees
├── Player
│   ├── Sprite
│   ├── CollisionShape
│   └── CameraTarget
├── Enemies
│   ├── Enemy01
│   └── Enemy02
└── Camera
```

Nodes must have:

- unique identity
- name
- parent
- children
- type
- transform where applicable
- properties
- resources
- optional script
- optional groups/tags
- optional signals/events

The Scene Tree is therefore not merely a visual list.

It represents the actual project hierarchy.

---

# 4. Editor Layout

The default editor must have a professional multi-panel layout.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ MENU / PROJECT / EDIT / VIEW / RUN / DEBUG / HELP                  │
├──────────────────────────────────────────────────────────────────────┤
│ TOOLBAR                                                             │
│ Select | Move | Rotate | Scale | Snap | Play | Pause | Stop         │
├───────────────┬──────────────────────────────────────┬───────────────┤
│               │                                      │               │
│  SCENE TREE   │             VIEWPORT                 │  INSPECTOR    │
│               │                                      │               │
│               │                                      │               │
│               │                                      │               │
│               │                                      │               │
├───────────────┴──────────────────────────────────────┴───────────────┤
│ FILESYSTEM / ASSETS / ANIMATION / OUTPUT / DEBUG / CONSOLE         │
└──────────────────────────────────────────────────────────────────────┘
```

Panels must be:

- resizable
- collapsible
- dockable where practical
- persistent across sessions
- independently scrollable

The user must be able to focus on the viewport without destroying the editor state.

---

# 5. Main Menu

The application must provide actual menus.

## Project

- New Project
- Open Project
- Save
- Save As
- Project Settings
- Export
- Export Project
- Close Project

## Edit

- Undo
- Redo
- Cut
- Copy
- Paste
- Duplicate
- Delete
- Select All

## Scene

- New Scene
- Open Scene
- Save Scene
- Save Scene As
- Instantiate Scene
- Add Child Node
- Reparent
- Rename

## View

- Zoom In
- Zoom Out
- Frame Selected
- Frame All
- Grid
- Guides
- Snapping
- View Options

## Run

- Run Project
- Run Current Scene
- Pause
- Resume
- Restart
- Stop

---

# 6. Project System

A project is a collection of files and resources.

Example:

```text
MyGame/
│
├── project.json
│
├── scenes/
│   ├── main.scene.json
│   ├── player.scene.json
│   └── enemy.scene.json
│
├── scripts/
│   ├── player.ts
│   └── enemy.ts
│
├── assets/
│   ├── images/
│   ├── audio/
│   ├── fonts/
│   └── tiles/
│
├── animations/
│
└── resources/
```

The exact physical format may differ internally, but the logical separation must exist.

---

# 7. Project File

The project must contain project-level configuration.

Example:

```json
{
  "name": "My Game",
  "version": "1.0.0",
  "engine": "browser-engine",
  "runtime": "phaser",
  "mainScene": "scenes/main.scene.json",
  "resolution": {
    "width": 1280,
    "height": 720
  },
  "settings": {
    "backgroundColor": "#202020"
  }
}
```

Project settings must include at minimum:

- project name
- main scene
- viewport width
- viewport height
- scale mode
- background color
- renderer preference
- physics configuration
- input actions
- default camera settings
- audio settings

---

# 8. Scene System

A scene is an editable collection of nodes.

The user must be able to:

- create a scene
- save a scene
- open a scene
- rename a scene
- duplicate a scene
- instantiate one scene inside another
- edit a scene
- run a scene

Example:

```text
Player.scene
├── Player
│   ├── Sprite
│   ├── CollisionShape
│   └── CameraTarget
```

The scene must be serialized independently from the editor UI.

---

# 9. Scene Tree

The Scene Tree is a functional hierarchy editor.

Required behavior:

### Selection

Clicking a node selects it.

The selected node must:

- become visually highlighted
- become selected in the viewport
- populate the Inspector

Selecting the corresponding object in the viewport must select the Scene Tree node.

Selection must be synchronized bidirectionally.

### Rename

Double-clicking a node name must allow renaming.

Renaming must update the underlying scene data.

### Parenting

Nodes must be draggable within the hierarchy to reparent them.

The system must prevent invalid parent relationships.

### Delete

Deleting a node must remove the actual node.

It must also remove or update its runtime representation.

### Duplicate

Duplicating a node must create a new node with a unique identity.

### Multi-selection

The editor should support selecting multiple nodes.

---

# 10. Node Types

The initial implementation must provide real functional node types.

## Core

- Node
- Node2D
- Container
- Camera
- Empty/Transform node

## Rendering

- Sprite
- AnimatedSprite
- Image
- Text
- Shape
- TileMap

## Physics

- StaticBody
- DynamicBody
- CharacterBody
- Area
- CollisionShape
- Collider

## Audio

- AudioPlayer

## Game Logic

- Timer
- ScriptNode
- EventNode

The architecture must allow additional node types to be registered later.

---

# 11. Node Registry

Node types must be defined through a registry rather than hard-coded throughout the application.

Conceptually:

```typescript
registerNodeType({
    type: "Sprite",
    displayName: "Sprite",
    category: "2D",
    icon: "...",
    properties: [...],
    createRuntimeObject: ...
});
```

This allows future node types to be added without rewriting the editor.

---

# 12. Inspector

The Inspector is one of the most important parts of the environment.

It must display the actual properties of the selected object.

For a Sprite:

```text
Sprite
────────────────────

Transform
  Position
    X       100
    Y       200

  Rotation  0°

  Scale
    X       1
    Y       1

Sprite
  Texture   player.png
  Width     64
  Height    64
  Visible   ✓
  Opacity   1

Rendering
  Depth     0
  Flip X    □
  Flip Y    □
```

Changing a value must immediately affect:

1. the scene model
2. the viewport
3. the runtime representation when running

---

# 13. Inspector Property Types

The Inspector must support:

- text
- number
- integer
- boolean
- enum
- color
- vector2
- vector3 where required
- resource reference
- asset reference
- node reference
- array
- object/resource
- range slider
- file selector

The editor must not display every property as a generic text field.

Properties must have appropriate controls.

---

# 14. Transform Editing

Every transform-capable object must expose:

```text
Position
Rotation
Scale
```

The viewport and Inspector must remain synchronized.

For example:

```text
Viewport:
drag Player from X=100 to X=250

↓

Inspector:
X changes from 100 to 250
```

And:

```text
Inspector:
X changes from 250 to 400

↓

Viewport:
Player moves to X=400
```

Every such modification must be undoable.

---

# 15. 2D Viewport

The viewport is the central editor surface.

It must support:

- pan
- zoom
- object selection
- object dragging
- rotation
- scaling
- multi-selection
- box selection
- grid
- snapping
- guides
- rulers where appropriate
- coordinate display
- frame selected
- frame all
- visibility controls

The viewport must represent the actual scene.

It must not be a decorative canvas.

---

# 16. Transform Gizmos

The viewport must provide visual manipulation tools.

### Move

```text
      ↑
      |
      ●────→
```

### Rotate

A rotation control around the selected object.

### Scale

Corner/edge handles for scaling.

Changing a transform through a gizmo must update the Inspector.

---

# 17. Grid and Snapping

The user must be able to:

- enable/disable grid
- change grid size
- snap position
- snap rotation
- snap scale where appropriate

Example:

```text
Grid Size: 16
Snap: ON
```

Dragging an object should then produce positions such as:

```text
X = 96
Y = 144
```

rather than arbitrary floating-point values.

---

# 18. Asset/File System

The editor must contain a functional project filesystem.

Example:

```text
FILESYSTEM

▼ assets
  ▼ images
    player.png
    enemy.png
    tiles.png

  ▼ audio
    jump.wav
    music.mp3

▼ scenes
    main.scene.json
    player.scene.json

▼ scripts
    player.ts
```

Users must be able to:

- create folders
- rename files
- delete files
- move files
- import files
- preview assets
- reference assets from nodes

---

# 19. Asset Import

The application must support browser file import.

At minimum:

### Images

- PNG
- JPG/JPEG
- WebP
- SVG where practical

### Audio

- MP3
- WAV
- OGG

### Fonts

- TTF
- WOFF
- WOFF2

### Code

- JS
- TS

Imported assets must receive stable project identifiers.

---

# 20. Asset Preview

Selecting an image must display a preview.

Selecting audio must provide playback controls.

Selecting a script must open the script editor.

Selecting a scene must open the scene.

Selecting a resource must open its editor.

---

# 21. Drag-and-Drop Assets

Dragging an image from the filesystem into the viewport must create a corresponding Sprite node.

Example:

```text
assets/player.png
       │
       │ drag
       ↓
viewport
       │
       ↓
Sprite
  texture = player.png
```

This is a core workflow and must work reliably.

---

# 22. Script System

The environment must support scripting.

The primary scripting language should be JavaScript or TypeScript.

A script can be attached to a node.

Example:

```typescript
export default class Player {
  update(delta: number) {
    // game logic
  }
}
```

The actual API should be defined by the engine layer rather than requiring users to manipulate raw Phaser objects everywhere.

---

# 23. Engine Script API

Scripts should be able to interact with nodes through an engine-level API.

For example:

```typescript
player.position.x += 100 * delta;
```

rather than forcing the user to know:

```typescript
player.phaserObject.x += ...
```

The runtime should expose useful abstractions such as:

```text
node
parent
children
position
rotation
scale
visible
velocity
input
camera
audio
animation
physics
signals
```

---

# 24. Script Lifecycle

The engine must define predictable lifecycle methods.

For example:

```typescript
ready();
update(delta);
physicsUpdate(delta);
destroy();
```

The exact naming can differ, but the lifecycle must be explicit and documented.

The same lifecycle must be used consistently.

---

# 25. Script Editor

The script editor must provide:

- syntax highlighting
- line numbers
- indentation
- search
- replace
- file tabs
- unsaved-change indicator
- error display
- console output

The editor must clearly distinguish:

```text
saved
unsaved
error
running
```

---

# 26. Runtime

The runtime is the actual game.

The editor must never fake runtime behavior.

When the user clicks:

```text
▶ Run
```

the project must be instantiated using the runtime engine.

For the initial implementation:

```text
Engine Scene Model
        ↓
Phaser Adapter
        ↓
Phaser Scene
        ↓
Browser Canvas
```

---

# 27. Phaser Integration

Phaser should be treated as a runtime implementation.

The editor should not expose Phaser-specific implementation details unless appropriate.

For example:

```text
Engine Sprite
     ↓
Phaser Sprite
```

The user should work with:

```text
Sprite
Position
Texture
Animation
Physics
```

rather than being required to understand Phaser internals.

---

# 28. Run Modes

The editor must support:

## Run Project

Starts the configured main scene.

## Run Current Scene

Starts the currently open scene.

## Pause

Freezes runtime execution.

## Resume

Continues execution.

## Restart

Restarts the current runtime.

## Stop

Terminates runtime and returns to editing.

---

# 29. Runtime / Editor Separation

Runtime state must not silently overwrite editor state.

For example:

```text
Editor:
Player X = 100

Run:
Player moves to X = 500

Stop:

Editor:
Player X remains 100
```

Runtime modifications must only modify the project when explicitly requested.

---

# 30. Debugging

The environment must provide an Output/Debug panel.

It should display:

```text
INFO
WARNING
ERROR
LOG
```

Script errors must show:

- file
- line
- column
- message

Example:

```text
ERROR
player.ts:24:17
Cannot read property 'velocity' of undefined
```

Clicking an error should open the relevant source location.

---

# 31. Console

Scripts must be able to produce output:

```typescript
console.log("Player spawned");
```

The editor must capture runtime logs into the Output panel.

---

# 32. Input System

Input must be abstracted into named actions.

Example:

```text
Input Map

move_left   ← A / Left Arrow
move_right  ← D / Right Arrow
jump        ← Space
attack      ← J
```

Scripts should be able to use:

```typescript
input.isPressed("move_left");
input.isJustPressed("jump");
```

rather than hard-coded key checks everywhere.

---

# 33. Input Settings

The user must be able to:

- create actions
- rename actions
- remove actions
- assign keys
- assign mouse buttons
- assign gamepad controls

The action configuration must be stored in the project.

---

# 34. Physics

The engine must support functional physics.

At minimum:

- static bodies
- dynamic bodies
- character bodies
- areas/triggers
- collision shapes
- collision layers
- collision masks
- gravity
- velocity
- collision callbacks

Physics should be integrated into the node system.

---

# 35. Collision Editing

Collision shapes must be visually editable.

Supported initial shapes:

- rectangle
- circle
- capsule
- polygon

The user should be able to see collision geometry in the editor.

---

# 36. Collision Layers

Project settings must provide collision configuration.

Example:

```text
Layer 1: Player
Layer 2: Enemy
Layer 3: World
Layer 4: Projectile
```

Objects must be able to specify:

```text
Collision Layer
Collision Mask
```

---

# 37. Camera

The engine must support cameras.

A camera must be able to:

- follow an object
- have position
- have zoom
- have bounds
- be active/inactive

The editor must display camera boundaries when appropriate.

---

# 38. Animation

The editor must include an animation system.

Initial capabilities:

- create animation
- rename animation
- delete animation
- timeline
- keyframes
- play
- pause
- scrub
- animation duration

Properties that can be animated should include:

- position
- rotation
- scale
- opacity
- visibility
- sprite frame
- arbitrary supported numeric properties

---

# 39. Animation Timeline

Example:

```text
Animation: PlayerWalk

0s       0.5s       1.0s
│---------│----------│
●         ●          ●

Position
●---------●----------●

Rotation
●--------------------●

Sprite Frame
●----●----●----●----●
```

The timeline must correspond to actual runtime animation.

---

# 40. Tilemap System

The editor should provide a tilemap workflow.

Required functionality:

- import tileset
- define tile size
- create tilemap
- paint tiles
- erase tiles
- rectangle fill
- bucket fill where appropriate
- select tile
- layers
- collision metadata

The tilemap must render correctly in Phaser.

---

# 41. Scene Instancing

A scene must be usable as a reusable object.

For example:

```text
Player.scene
```

can be instantiated in:

```text
Main.scene
```

The user should be able to modify the source Player scene and have instances reflect the changes.

The system must distinguish:

```text
source scene
instance
instance overrides
```

---

# 42. Groups / Tags

Nodes should support groups.

Example:

```text
Player
Groups:
  player
  damageable
```

Scripts should be able to query groups.

---

# 43. Signals / Events

The engine should provide an event/signal system.

Example:

```text
Player
   │
   └── health_changed
             ↓
        HealthBar
```

A user should be able to connect events without manually wiring every interaction through global code.

---

# 44. Undo / Redo

Undo/redo is mandatory.

Every meaningful editor operation must be undoable.

Examples:

- moving an object
- changing a property
- adding a node
- deleting a node
- renaming
- reparenting
- importing an asset
- changing animation
- changing tilemap contents

The undo system should operate on editor commands rather than screenshots or UI state.

---

# 45. Clipboard

The editor must support:

- copy
- cut
- paste
- duplicate

Copied nodes must preserve their properties and hierarchy.

References must be handled safely.

---

# 46. Save System

The editor must distinguish:

```text
Saved
Unsaved
```

The application must warn before losing unsaved changes.

The user must be able to explicitly save.

Autosave may also be implemented.

---

# 47. Browser Persistence

Because the application is static-hosted, local persistence must be supported.

Use browser storage such as:

```text
IndexedDB
```

for project persistence.

The application must support:

```text
Create project
Save locally
Open locally
Delete project
Duplicate project
```

---

# 48. Project Import / Export

The user must be able to export a project as a portable archive.

Example:

```text
MyGame.zip
│
├── project.json
├── scenes/
├── scripts/
├── assets/
└── resources/
```

The user must be able to import that archive into another browser session.

A project must not become permanently trapped in one browser database.

---

# 49. Game Export

The environment must be capable of producing a static HTML5 game.

Expected output:

```text
dist/
├── index.html
├── game.js
├── assets/
└── resources/
```

The exported game must not require the editor.

It should run independently as a static website.

---

# 50. GitHub Pages Compatibility

The entire editor must function when hosted at a path such as:

```text
https://username.github.io/project/
```

It must NOT assume:

```text
/
```

is the application root.

Asset paths must work correctly under GitHub Pages subpaths.

The application must not require:

- Node server at runtime
- PHP
- Python server
- database
- WebSocket server
- proprietary backend

The development/build process may use Node tooling, but the resulting application must be statically deployable.

---

# 51. Responsive Behavior

The editor is primarily desktop-oriented.

The application should support:

- desktop
- laptop
- large tablet where practical

Mobile phones are not the primary target.

Do not sacrifice the desktop editor experience merely to make it responsive.

---

# 52. Editor Workspaces

The application should eventually support workspace modes.

Example:

```text
2D
Script
Animation
Tilemap
Debug
```

Switching workspaces changes which panels are emphasized.

---

# 53. Keyboard Shortcuts

Required initial shortcuts:

```text
Ctrl/Cmd + S       Save
Ctrl/Cmd + Z       Undo
Ctrl/Cmd + Shift+Z Redo
Ctrl/Cmd + C       Copy
Ctrl/Cmd + X       Cut
Ctrl/Cmd + V       Paste
Ctrl/Cmd + D       Duplicate
Delete             Delete
F                  Frame selected
W                  Move
E                  Rotate
R                  Scale
F6                 Run current scene
F5                 Run project
F8                 Stop
```

The exact mappings can be configurable later.

---

# 54. Visual Design Requirements

The application should have the visual density of a professional development tool.

Avoid:

- giant cards
- excessive rounded containers
- excessive whitespace
- marketing-style UI
- unnecessary gradients
- decorative illustrations
- generic dashboard layouts
- fake statistics
- "Create your first game!" landing-page UI inside the editor

The editor should look like an actual development environment.

Use:

- compact panels
- clear hierarchy
- dense information presentation
- toolbars
- tree views
- property editors
- tabs
- status bars
- viewport overlays
- contextual controls

The interface should communicate:

> **This is a tool for building software.**

not:

> **This is a marketing website for a game maker.**

---

# 55. No Fake Functionality

This is a critical requirement.

A control must not exist merely because a real engine would have that control.

For every UI feature:

```text
UI control
   ↓
Editor state
   ↓
Project data
   ↓
Runtime behavior
```

must be connected.

For example, if the Inspector contains:

```text
Gravity: 980
```

changing it must actually change the physics behavior.

If the UI contains:

```text
Collision Layer: 2
```

the runtime must actually use collision layer 2.

If the UI contains:

```text
Animation: Walk
```

the animation must actually play.

---

# 56. No Demo-Only Architecture

Do not implement the system around a single example character.

The engine must support arbitrary user-created projects.

Bad architecture:

```text
if object.name === "Player"
```

Good architecture:

```text
node.type
node.components
node.properties
node.script
```

The system must be data-driven.

---

# 57. Component Architecture

Where useful, nodes should support components.

Example:

```text
Player
├── Transform
├── Sprite
├── PhysicsBody
├── CollisionShape
└── Script
```

Components must expose standardized properties.

The architecture must make it possible to add new components without rewriting the entire editor.

---

# 58. Resource Architecture

Assets and reusable data should be represented as resources.

Examples:

```text
Texture
Audio
Font
Animation
Material
Tileset
PhysicsMaterial
Script
```

Nodes reference resources rather than duplicating resource data unnecessarily.

---

# 59. Stable IDs

Every project entity must have a stable ID.

Example:

```json
{
  "id": "node_8f91a2",
  "name": "Player",
  "type": "CharacterBody"
}
```

Do not use display names as unique identifiers.

Two nodes may be named:

```text
Enemy
Enemy
```

provided their IDs remain unique.

---

# 60. Serialization

The editor model must be serializable.

At minimum:

```text
Project
Scene
Node
Component
Resource
Animation
InputMap
Settings
```

must be representable as persistent data.

The serialization format should be:

- deterministic
- versioned
- human-readable where practical
- migration-friendly

---

# 61. Versioning

Project files must contain a format version.

Example:

```json
{
  "formatVersion": 1
}
```

Future versions must be able to migrate old projects.

---

# 62. Error Handling

The application must fail gracefully.

Examples:

If an asset is missing:

```text
Missing Resource
assets/player.png
```

If a script fails:

```text
Script Error
player.ts:42
```

If a scene cannot load:

```text
Scene Load Error
```

Do not silently fail.

---

# 63. Loading States

Long operations must provide visible feedback.

Examples:

```text
Importing...
Loading scene...
Compiling script...
Starting runtime...
Exporting...
```

---

# 64. Performance Requirements

The editor should remain usable with:

- hundreds of nodes
- thousands of simple nodes where practical
- many assets
- large scenes

Avoid unnecessary full-editor re-renders.

Viewport rendering must be isolated from UI rendering.

---

# 65. State Management

Editor state should be centrally managed.

Separate:

```text
Project State
Editor State
Runtime State
UI State
```

Do not store critical project state only inside individual React components or UI elements.

---

# 66. Runtime State

Runtime state must be isolated from editor state.

Conceptually:

```text
PROJECT
   │
   ├── Editor State
   │
   └── Runtime Clone
           │
           └── Phaser
```

Running the game must create a runtime representation.

Stopping the game destroys runtime state without corrupting the editor.

---

# 67. Testing Requirements

The application must have automated tests for critical systems.

At minimum:

### Project

- create project
- save project
- load project
- serialize project
- deserialize project

### Scene

- create node
- delete node
- duplicate node
- reparent node
- save scene
- load scene

### Inspector

- edit property
- synchronize viewport
- synchronize scene tree

### Runtime

- instantiate scene
- create Phaser object
- start game
- stop game

### Undo

- undo property change
- redo property change
- undo node creation
- undo node deletion
- undo reparenting

---

# 68. Acceptance Test: Basic Game

The completed environment must allow a user to perform this workflow without manually editing internal project files:

```text
1. Create project.
2. Create Main scene.
3. Add a Sprite.
4. Import player.png.
5. Assign player.png to Sprite.
6. Move Sprite to X=200, Y=300.
7. Add a physics body.
8. Add collision.
9. Create Player script.
10. Attach script.
11. Define move_left and move_right.
12. Press Run.
13. Move the player.
14. Stop.
15. Save.
16. Close project.
17. Reopen project.
18. Scene is restored exactly.
```

This workflow is a mandatory milestone.

---

# 69. Acceptance Test: Scene Editing

The following must work:

```text
Create Node
    ↓
Rename Node
    ↓
Move Node
    ↓
Rotate Node
    ↓
Change Inspector property
    ↓
Duplicate Node
    ↓
Reparent Node
    ↓
Undo
    ↓
Redo
    ↓
Save
    ↓
Reload
```

The final scene must retain the correct state.

---

# 70. Acceptance Test: Runtime

Given:

```text
Player
Enemy
Platform
```

the user must be able to:

```text
Run
 ↓
Player appears
 ↓
Player moves
 ↓
Player collides with Platform
 ↓
Player interacts with Enemy
 ↓
Console receives events/logs
 ↓
Pause
 ↓
Resume
 ↓
Stop
```

---

# 71. Acceptance Test: Export

The user must be able to:

```text
Create game
    ↓
Export
    ↓
Receive static game
    ↓
Open exported index.html/site
    ↓
Game runs without editor
```

The exported game must contain only the runtime and project assets required to run it.

---

# 72. Development Phases

Do not attempt every feature simultaneously.

Implement in vertical slices.

## Phase 1 — Editor Foundation

Implement:

- application shell
- project state
- Scene Tree
- viewport
- Inspector
- node model
- save/load
- undo/redo

The editor must already be genuinely functional.

---

## Phase 2 — 2D Engine

Implement:

- Sprite
- textures
- transforms
- camera
- Phaser runtime
- Run/Stop
- asset import

Milestone:

> User can build and run a simple 2D scene.

---

## Phase 3 — Scripting

Implement:

- script files
- script editor
- node scripts
- lifecycle
- runtime errors
- console
- input actions

Milestone:

> User can program a game.

---

## Phase 4 — Physics

Implement:

- bodies
- collisions
- collision shapes
- layers/masks
- physics settings

Milestone:

> User can create an actual physics-based game.

---

## Phase 5 — Animation

Implement:

- animations
- timeline
- keyframes
- sprite animation

Milestone:

> User can create animated characters.

---

## Phase 6 — Tilemaps

Implement:

- tileset
- tilemap
- painting
- erasing
- collision metadata

Milestone:

> User can build a tile-based level.

---

## Phase 7 — Scene Composition

Implement:

- scene instancing
- reusable scenes
- groups
- signals
- resources

Milestone:

> User can build a multi-scene game.

---

## Phase 8 — Export

Implement:

- project export
- HTML5 runtime export
- asset packaging
- GitHub Pages-compatible output

Milestone:

> User can publish a game as a static website.

---

# 73. Architecture Rules for the Coding Agent

The implementation agent MUST follow these rules.

### Rule 1

Do not build mock interfaces.

### Rule 2

Do not implement controls that have no underlying behavior.

### Rule 3

Do not hard-code the demonstration game.

### Rule 4

Do not make the editor dependent on one scene.

### Rule 5

Do not make Phaser objects the editor's source of truth.

### Rule 6

Do not put all application state into UI components.

### Rule 7

Do not sacrifice project serialization for convenience.

### Rule 8

Do not create placeholder functionality and mark it as complete.

### Rule 9

Every major feature must have an actual data model.

### Rule 10

Every editor feature must ultimately affect either project data or runtime behavior.

---

# 74. Definition of "Complete"

The application is NOT considered complete merely because it contains:

- a sidebar
- a canvas
- an inspector-looking panel
- a scene tree
- buttons labeled Run
- buttons labeled Save
- a few draggable shapes

Those constitute a visual prototype.

The application is considered functionally complete only when the UI, project model, editor, runtime, and serialization are connected.

The minimum complete architecture is:

```text
                    PROJECT
                       │
             ┌─────────┴─────────┐
             │                   │
          SCENES               ASSETS
             │                   │
             ↓                   ↓
        SCENE MODEL        RESOURCE MODEL
             │                   │
             └─────────┬─────────┘
                       ↓
                  EDITOR MODEL
                       │
          ┌────────────┼────────────┐
          ↓            ↓            ↓
      Scene Tree    Inspector    Viewport
          │            │            │
          └────────────┼────────────┘
                       ↓
                  SERIALIZATION
                       │
                       ↓
                  RUNTIME MODEL
                       │
                       ↓
                     PHASER
                       │
                       ↓
                    GAME
```

---

# 75. The Most Important UX Principle

The environment should behave according to the following invariant:

> **If I change something in one representation of my game, every other representation updates.**

For example:

```text
Scene Tree
    ↕
Viewport
    ↕
Inspector
    ↕
Scene Data
    ↕
Runtime
```

Changing a node's position in the Scene Tree/Viewport/Inspector must update the same underlying node.

The runtime must be generated from that underlying data.

Saving must save that underlying data.

Loading must reconstruct that underlying data.

---

# 76. Final Product Vision

The finished product should feel like:

```text
             BROWSER GAME ENGINE
                    │
        ┌───────────┴───────────┐
        │                       │
     EDITOR                   ENGINE
        │                       │
   ┌────┼────┐             ┌────┼────┐
   │    │    │             │    │    │
Scene  View Inspector   Physics Input Runtime
Tree   port
   │                       │
   └───────────┬───────────┘
               ↓
             GAME
```

A user should be able to sit down at the website and think:

> "I am inside a game engine."

They should be able to create a project, construct a scene, manipulate objects, write code, configure physics, run the game, debug it, save it, and export it.

The application is **not** a game-themed website.

It is a **game development environment implemented as a web application**.

---

# 77. Agent Deliverable Requirements

When implementing this specification, the coding agent must:

1. Inspect the existing codebase before replacing anything.
2. Preserve useful existing functionality.
3. Establish the core architecture before adding cosmetic features.
4. Implement features incrementally.
5. Keep the application runnable after each major phase.
6. Avoid fake UI.
7. Avoid hard-coded demo behavior.
8. Maintain clear separation between editor, project model, and runtime.
9. Document major architectural decisions.
10. Provide a working implementation rather than a visual approximation.

For each completed phase, the agent should be able to demonstrate the corresponding acceptance workflow.

---

# 78. Priority Order

When tradeoffs are necessary, prioritize in this order:

```text
1. Correct architecture
2. Actual functionality
3. Project persistence
4. Editor ↔ data synchronization
5. Runtime correctness
6. Undo/redo
7. Usability
8. Performance
9. Visual polish
10. Decorative features
```

Never reverse this priority.

A functional primitive editor is preferable to a beautiful fake editor.

---

# 79. Initial Target

The first serious milestone is NOT "make it look like Godot."

The first serious milestone is:

> **Create a browser application in which a user can create a project, create a scene, add a Sprite, import an image, position it using the viewport and Inspector, save the scene, reload it, and run that scene through Phaser.**

Once that vertical slice works correctly, expand the same architecture to physics, scripting, animation, tilemaps, signals, scene instancing, and export.

That is the foundation of the Browser Godot Environment.
