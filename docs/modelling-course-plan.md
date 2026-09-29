# Course plan: Modelling & Geometry Processing

Status (2026-09-29): **lesson 1.1 built** as a trial, for review before the rest.

## Progress

| Lesson | File | State |
|---|---|---|
| 1.1 A mesh is two lists | `src/courses/modelling-geometry/1-meshes-as-data/001-vertices-and-faces.js` | Built; checked in the browser |

How lesson 1.1 is built, for the lessons after it:
- **Notebook:** a `JSNotebook` visualization, with `props: { lesson: { title, subtitle, cells } }`. Its cell types are
  `js`, `challenge` (with `check`, `solutionCode`) and `markdown`.
- **Picture cells:** each loads three.js with a dynamic `import()` from jsDelivr, because a cell runs as a
  classic script inside a sandboxed iframe. The shared drawing code is one string, appended to each cell.
- **Challenge checks:** read the learner's list from the code without running it. The tests in
  `src/courses/modelling-geometry/lessons.test.js` check each kind of mistake, and check that console-only
  cells print what the prose says. They also check that every MeshLab link names a real project or challenge.
- **Bridge callouts:** the app adds generic "Bridge: …" callouts (`unifiedLessonEnhancer.js`) to any lesson
  without its own. The one for the rigor section talks about driving analytics. Each lesson therefore writes
  its own three, with the same titles.
- **Links:** in-app links in lesson prose (`#/lab/...`) now open in the same tab (`MarkdownProse.jsx`).

## Why this course

MeshLab lets you model, rig, animate, unwrap and shade, and it shows the algorithms as they run. It does not
teach the ideas from the ground up. This course does: each lesson teaches one concept with its maths, has you
build it yourself in a notebook, then sends you into MeshLab to use it on a real model.

**Not an extension of an existing course.**
- *Mesh Engine* is a focused course on computational geometry for CAM (point-to-mesh distance, bounding
  volumes, signed distance, comparing two models). Modelling, animation and rigging would bury that goal.
- *Three.js* teaches the rendering API and WebGL. This course is about geometry processing and animation maths.

Both are linked where they overlap, and neither is changed.

## Who it is for

Someone who wants to understand 3D graphics deeply (the linear algebra, the algorithms, why the numbers come
out as they do), and also to use a modelling tool the way Blender users do. The same audience as MeshLab.

## The shape of every lesson

Each lesson follows `docs/lesson-writing-standard.md`, with three parts:

1. **Learn.** The one-sentence target first. Concrete numbers before the formula; every symbol defined before
   use; the technique as a numbered procedure. Maths in LaTeX, mapped to the code that computes it.
2. **Build it.** A `type: 'js'` sandbox cell with three.js (via an import map, as
   `docs/lesson-visualizations-and-notebooks.md` describes) that computes the thing from scratch, small enough
   to read. Then a `type: 'coding'` challenge whose `check` returns `{ pass, message }` naming what is wrong
   ("face 3 winds clockwise"), never the fix.
3. **Hands on.** A link that opens the matching MeshLab project or challenge, with what to look at there. Built
   with `meshLabLink(kind, id)` from `src/labs/mesh-lab/links.ts`, which throws on an id that does not exist.

## Chapters and lessons (48 lessons)

Each line: the lesson, then the MeshLab project (P) or challenge (C) it links to.

### 1. Meshes as data (5)
1. A mesh is two lists: vertices and faces. *P: two-lists* ✓ built
2. Winding and normals: the cross product decides which side is out. *P: character-model*
3. Edges and neighbours: the edge table, manifold and boundary edges. *P: character-model*
4. Euler's formula, V − E + F = 2, and what holes do to it. *P: curvature-gallery (torus χ = 0)*
5. What the GPU receives: triangles, index buffers, one normal per corner. *Link: Mesh Engine 001 (what a mesh is)*

### 2. Transforms and hierarchies (5)
1. Translation, rotation, scale as matrices. *P: dining-set*
2. Order matters: T·R·S, and why scale-then-rotate differs from rotate-then-scale.
3. Homogeneous coordinates: why a 3D transform is a 4 × 4 matrix.
4. Hierarchies: world = parent × local, all the way up. *P: robot-arm*
5. Euler angles, gimbal lock, and a first look at quaternions. *P: euler-vs-slerp. Link: Three.js ch. 10*

### 3. Modelling operations (5)
1. Extrude: copy, move along the normal, build walls. *P: crate*
2. Inset: per face and as a region; the mitre at a corner. *P: crate*
3. Edge rings and loop cuts. *P: character-model*
4. Bevel: sliding corners, strips, corner patches, profiles. *P: crate*
5. Dissolve and clean topology: merging faces without changing the shape. *P: support-loops*

### 4. Subdivision (4)
1. Smoothing by averaging: Chaikin's corner cutting in 2D.
2. Catmull–Clark: face points, edge points, moved vertices. *P: predict-catmull-clark*
3. Limit surfaces and extraordinary vertices (valence ≠ 4).
4. Support loops: keeping edges sharp under subdivision. *P: support-loops; C: keep-it-a-box*

### 5. Discrete differential geometry (6)
1. The Laplacian on a mesh: from the umbrella average to cotan weights. *P: smoothing*
2. Mean curvature from the Laplacian of position. *P: curvature-gallery*
3. Gaussian curvature as angle defect, and Gauss–Bonnet. *P: curvature-gallery*
4. Solving big sparse systems: conjugate gradients. *P: knot-distance (the trace's CG counts)*
5. Distance along a surface: the heat method. *P: knot-distance*
6. Smoothing as heat flow, and why it shrinks. *P: smoothing*

### 6. UVs (4)
1. What UVs are: a map from the surface to a square.
2. Seams, charts and wedges: cutting a surface open. *C: six-squares*
3. Conformal maps and LSCM. *P: unwrap-basics*
4. Distortion, packing, and why a sphere cannot lie flat. *P: unwrap-basics*

### 7. Shading (5)
1. Light and the cosine law: Lambert. *P: shader-gallery. Link: Three.js lighting chapters*
2. Highlights: Phong and Blinn–Phong. *P: shader-gallery*
3. Physically based shading: microfacets, energy, metalness. *P: shader-gallery*
4. Textures: sampling, repeating, procedural patterns. *P: dining-set (wood), island (grass)*
5. Write a shader in GLSL. *P: shader-gallery (Custom)*

### 8. Animation (5)
1. Keyframes and interpolation. *P: bouncing-ball*
2. Easing curves, and why gravity is ease-in. *P: bouncing-ball; C: land-on-20*
3. Quaternions: rotations as points on a 4D sphere. *P: euler-vs-slerp*
4. Slerp: the shortest turn at constant speed. *P: euler-vs-slerp*
5. Motion through a hierarchy: baking and motion paths. *P: robot-arm*

### 9. Rigging and skinning (6)
1. Bones and bone matrices: rest B, posed P, skin S = P·B⁻¹. *P: tentacle*
2. Linear blend skinning. *P: walk-and-wave*
3. Automatic weights: heat spreading from bones. *P: walk-and-wave*
4. Weight painting and normalisation. *P: fix-a-bad-rig; C: fix-the-chest*
5. The candy wrapper, and dual quaternions. *P: candy-wrapper*
6. A walk cycle: contact, down, passing, up. *P: walk-cycle*

### 10. Modelling by code (3)
1. Scripting a model: the scene API. *P: island*
2. The GUI → code log: every click as a line of code. *P: any*
3. Procedural modelling: curves, tubes, surfaces of revolution. *P: knot-distance, python-vase*

## Work in MeshLab this course needs

- **Done:** deep links, `#/lab/mesh-lab?project=<id>` and `?challenge=<id>`, which work on a fresh page load and
  when the lab is already open (`src/utils/entryLinks.js` carries the query past `EntryShell`'s redirect).
- **To add as lessons need them:**
  - `?example=<id>`, to load a script example into the Script panel. Several chapter 1 and 10 lessons want a
    script rather than a whole project.
  - One challenge per chapter where none exists yet:
    - Ch. 1: close a mesh with a missing face;
    - Ch. 2: parent the wheels so they turn with the car;
    - Ch. 3: extrude an arm;
    - Ch. 5: find the flattest point;
    - Ch. 7: write a toon shader;
    - Ch. 10: script a staircase.
  - A test that imports each lesson and calls `meshLabLink` for every link it contains.

## How it is built and checked

- **Files:** `src/courses/<course>/<N>-<chapter>/<NNN>-<slug>.js`, discovered automatically (`AGENTS.md`).
  Lesson ids are unique across all courses and never change once published.
- **Each lesson:**
  - `node scripts/validate-lesson-schema.mjs <file>`, `node scripts/check_js_cells.mjs --files <file>` and
    `node scripts/check_latex.mjs --files <file>`;
  - then **open it in a browser**: neither checker can tell whether a notebook's cells reached the page.
- **Every numeric claim** in a lesson is computed by a cell or checked against MeshLab's tested code, not
  written from memory.
- **After adding the course:** `npm run facts`, and commit the regenerated files.
- **Session record:** a handoff file for the course records what is done and what is next, and is read first
  each session.

## Size

About 6–10 agent sessions: one or two chapters a session. The bottleneck is verification (every sandbox cell
run, every lesson opened in a browser), not writing.

## Open questions for review

1. **Name and id.** Lesson 1.1 went ahead with "Modelling & Geometry Processing" (`modelling-geometry`), 🔺,
   domain `creative`, colour violet. The label, icon and colour can still change. The id cannot change once
   the course is published, because it is part of the lesson ids.
2. **Order.** Chapters 1–4 lean on each other; 5–9 are fairly independent after 4. Build in order, or start
   with the chapter you most want (rigging, say)?
3. **Python.** MeshLab scripts in both languages. Keep the course's notebooks in JavaScript (three.js runs
   natively) with a Python aside where it helps, or offer both?
4. **Depth of maths.** Proofs where they are short (Euler's formula, Gauss–Bonnet on a polyhedron), statements
   with checks where they are long (the heat method's convergence)?
