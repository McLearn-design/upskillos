# Course plan: Making Games with Game Studio

Status (2026-10-01): **"Try it" is built and tested; lessons 1.1–1.4 are next.** Decided with the user (2026-10-01):
- **Full, deep maths in every lesson, labelled optional:** "Under the hood (optional)". A learner can skip it
  and still finish the course.
- **Both forms: the course, and learning inside Game Studio.** The same tasks serve the course's "Try it"
  links and Game Studio's own Help › Tutorials, beside a manual (see "Inside Game Studio too").
- **Each task starts from a known state** (the previous task's solution). The course name stays the working
  title until the user picks another.

The user asked for it once Phase 7 was finished: "a course that opens the game to try hands on, and goes back to
the course to learn the next piece, repeat this way". Game Studio's progress is in [game-studio-status.md](game-studio-status.md); its design is in
[game-studio-architecture.md](game-studio-architecture.md).

## The idea: learn, try, come back

Each lesson is one idea, taught in the course, then practised in Game Studio:

```text
 Lesson (in the course)              Game Studio                          Lesson again
 ┌──────────────────────────┐        ┌──────────────────────────────┐     ┌──────────────────────┐
 │ the idea, with pictures, │ Try it │ the task, already set up     │Back │ what just happened,  │
 │ worked examples, and     │ ─────▶ │ checks tick off as you work  │───▶ │ why it works, quiz,  │
 │ what to expect           │        │ hints if you are stuck       │     │ then the next idea   │
 └──────────────────────────┘        └──────────────────────────────┘     └──────────────────────┘
```

- **"Try it"** opens Game Studio with the lesson's task: a starting project, a goal, and checks.
- **In Game Studio,** a task panel beside the viewport says what to do, in steps. Each step ticks off when Game
  Studio sees it done. Hints appear if a check keeps failing.
- **"Back to the lesson"** appears when every check passes. It returns to the exact lesson, which records the
  lab checkpoint as done, then explains what happened and why.

A lesson can send you to Game Studio more than once, for example a small task in the middle and a bigger one at
the end.

## What the course teaches

**Two layers in every lesson.**
- **How to do it in Game Studio:** the editor, the nodes, and the script API, with Godot's name for each,
  so the knowledge carries over. Everyone does this part.
- **Under the hood (optional):** the full maths and algorithms that make it work, with derivations, worked
  numbers checked against the engine, and the code that implements them. It is clearly labelled optional:
  skipping it never blocks a task or a quiz in the main path. It has its own optional checkpoint and questions.

For example, the lesson on walls teaches adding a StaticBody2D and its shapes, and also how `moveAndSlide` finds
the shortest push out of a wall (the minimum translation vector) and keeps the sliding part of the velocity.

**By the end**, a learner can build a complete game from an empty project:
- scenes and instances;
- physics, animation and tilemaps;
- a HUD, and game states over several scenes.

They will also be able to explain the main techniques: kinematics, collision resolution, interpolation,
pathfinding, and signals.

## How "Try it" works (built 2026-10-01)

Built in `src/labs/game-studio/tasks/` and `editor/TaskPanel.tsx`. The first four tasks (chapter 1) exist. They are
tested in `tasks/tasks.test.ts` and in the browser in `e2e/tasks.acceptance.mjs`. What was built, and what differs
from the first plan:
- **Play checks run in a worker** (`tasks/checker.worker.ts`). A game's scripts expect globals such as `Node`,
  `scene` and `input`; on the editor's page `Node` is the browser's own.
- **Checks read scripts as typed, saved or not,** and run again as the learner types. Run saves first anyway,
  and a step should not wait on remembering Ctrl+S.
- **The link reaches Game Studio through the app's entry links** (`src/utils/entryLinks.js`). The app opens a lab
  as a window and leaves the address, so the query is handed over (MeshLab does the same).
- **Finishing marks the checkpoint at once,** through `useProgress().markCheckpoint`.

The design as planned:

1. **Links.** `gameStudioLink(taskId, { from, lesson, checkpoint })` gives
   `#/lab/game-studio?task=<id>&from=<lesson route>&lesson=<id>&checkpoint=<id>`.
   - Lessons build their links with it, so a task id that does not exist fails a test instead of opening an
     empty editor (MeshLab's rule).
   - `from` is where "Back to the lesson" goes.

2. **Tasks.** A task, in `src/labs/game-studio/tasks/`, is plain data and code, like an example:
   - **title and goal:** what you are making, in a sentence;
   - **start:** Scene API code for the starting project (often the previous task's solution), plus its images
     from the starter art;
   - **steps:** what to do, in order, each with a check and hints;
   - **solution:** Scene API code that completes it, used by the tests and offered after several failed tries
     ("Show me").

3. **Checks** come in two kinds, both using what Game Studio already has:
   - **Project checks** look at the project itself. Example: "a CharacterBody2D named Player with a
     CollisionShape2D under it", or "the Walls layer uses a tileset with solid tiles".
   - **Play checks** run the learner's own game, headless and faster than real time, on the real engine (the
     example tests already do this), with input pressed for them. Example: "holding → for 2 s moves the
     Player at least 100 px", "it stops at the wall", or "a jump lands on the platform".
   - Checks run as the learner works, and tick off in the task panel.

4. **The task panel** sits beside the viewport, like the example guide: the goal, the steps with ticks, a hint
   when a step keeps failing, "Show me" (applies the solution, one undo step), and "Back to the lesson".

5. **Progress.** The link also carries the lesson's id and checkpoint id; finishing the task calls the app's
   `markCheckpoint(lessonId, checkpointId)` (`src/context/ProgressContext.jsx`), so the checkpoint is ticked even
   before the learner goes back.

6. **Tests, so a task cannot quietly break:**
   - For every task, a unit test builds the start and checks that the checks fail (so they test something).
     It then applies the solution and checks that they all pass.
   - A browser test follows one lesson round the loop: the link, the task panel, finishing, and back to the
     lesson with its checkpoint done.

## Inside Game Studio too

The same tasks work without the course, for someone who opens Game Studio first:
- **Help › Tutorials** lists the tasks in chains (the course's chapters). Starting one opens its task panel, with
  **Next task** instead of "Back to the lesson".
- **Help › Manual** has one short page per part of the editor and engine. Each page links to its reference
  entries, its tutorial tasks, its course lesson, and the example that shows it.

The course remains where the full explanations and the optional maths live; the manual is the quick "how do I…".

## The course outline (draft)

Lesson ids follow the course standard; titles are working titles. Each lesson has at least one task. **Under the
hood** is the maths or algorithm the lesson explains.

**1. First steps**
- 1.1 The editor: scenes, nodes, the Inspector. *Task:* add a sprite and place it. *Under the hood:*
  positions, and +y pointing down.
- 1.2 Run and stop; what is saved and what is not. *Task:* run, change a value live, see it reset.
- 1.3 Your first script: `ready` and `update(dt)`. *Task:* make a sprite move across the screen. *Under the
  hood:* speed × time, and why `dt` makes it the same on every screen.
- 1.4 Input actions. *Task:* move with the arrow keys, diagonals no faster. *Under the hood:* normalizing a
  vector.

**2. Physics**
- 2.1 Bodies and shapes. *Task:* a player that cannot walk through a wall. *Under the hood:* the minimum
  translation vector.
- 2.2 Sliding along walls. *Task:* walk along a wall diagonally. *Under the hood:* removing the part of the
  velocity going into a surface (the dot product).
- 2.3 Gravity and jumping. *Task:* jump onto a platform 3 tiles up. *Under the hood:* v² / 2g, and stepping
  physics at a fixed 1/60 s.
- 2.4 Areas and pickups. *Task:* coins that disappear and count. *Under the hood:* overlap tests.
- 2.5 Rigid bodies and bouncing. *Task:* a bouncing ball. *Under the hood:* reflecting a velocity, and what
  bounce does.
- 2.6 Layers and masks. *Task:* a ball that passes through the paddle. *Under the hood:* bits and the `&`
  operator.

**3. Camera and HUD**
- 3.1 A camera that follows. *Task:* scroll a long level. *Under the hood:* smoothing as 1 − e^(−k·dt).
- 3.2 Camera limits. *Task:* never show past the level's edge.
- 3.3 A HUD on a CanvasLayer. *Task:* a score that stays put.

**4. Animation**
- 4.1 Sprite animation. *Task:* idle, walk and jump. *Under the hood:* frames per second and time.
- 4.2 Keyframes on a timeline. *Task:* a door that slides open. *Under the hood:* linear interpolation.
- 4.3 Animation from scripts. *Task:* play the door's animation when the player arrives.

**5. Tilemaps**
- 5.1 Tilesets. *Task:* cut a sheet into tiles. *Under the hood:* tile numbers, margin and spacing.
- 5.2 Painting a level. *Task:* paint a room with walls. *Under the hood:* bucket fill (flood fill).
- 5.3 Solid tiles. *Task:* walls that stop the player. *Under the hood:* merging tiles into rectangles, and why.
- 5.4 Grid movement. *Task:* move cell to cell in a maze. *Under the hood:* map ↔ world coordinates.
- 5.5 Maps from Tiled. *Task:* import Kenney's sample map.

**6. Scenes**
- 6.1 Scenes inside scenes. *Task:* a coin scene used ten times. *Under the hood:* sources and overrides.
- 6.2 Making things while the game runs. *Task:* a gun that fires bullets.
- 6.3 Groups. *Task:* bullets that only hit enemies.
- 6.4 Signals. *Task:* a health bar wired to the player with no code. *Under the hood:* the observer pattern.
- 6.5 Several scenes. *Task:* title → game → game over, keeping the score.

**7. Game logic**
- 7.1 Chasing the player. *Task:* a ghost that finds you. *Under the hood:* breadth-first search.
- 7.2 Game states. *Task:* start, play, pause and over. *Under the hood:* state machines.
- 7.3 Difficulty over time. *Task:* enemies that come faster. *Under the hood:* curves and timers.

**8. Projects**
- 8.1 to 8.3: build Coin Run, Breakout and Zombie Arena from an empty project, as chains of tasks, with less
  help each time.

**9. Machine learning (after Phase 9)**
- A game as an environment, a reward, and an agent that learns to play Breakout. It links to the ML Lab.

## Order of work

1. **"Try it" in Game Studio:** links, tasks, checks, the task panel, the way back, progress, and tests. About
   1–2 agent sessions.
2. **Lessons 1.1 to 1.4 as a trial,** written to [lesson-writing-standard.md](lesson-writing-standard.md) through
   the YAML course workflow ([course-from-yaml.md](contributing/course-from-yaml.md)). The user reviews them and
   the loop before the rest is written.
3. **Chapters 2–8,** about one session per chapter. The bottleneck is checking that each task's checks are fair:
   they pass for every reasonable way of doing it, not only the solution's.
4. **Chapter 9** after Game Studio's Phase 9.

Phase 8 (export) can go before or after; no lesson before chapter 8 needs it.

## Still open

- **The course's name** in the catalogue. Working title: "Making Games with Game Studio".
