# MeshLab — implementation status

Updated 2026-09-28. Read this first when resuming MeshLab work. The specification is [meshlab.md](meshlab.md);
this file records what is built, how it was checked, and what comes next.

## Where the code is

| Folder | What | Tested |
|---|---|---|
| `src/labs/mesh-lab/core/` | Scene model, editable mesh and operations, Catmull–Clark, mirror, primitives, editor (commands, undo, GUI → code log), script API, traces, OBJ, examples; `geometry.ts` (cotan Laplacian, CG solver, curvature, heat-method distance, smoothing, iso-lines) and `fields.ts` (heat maps, colour maps) | Headless, vitest |
| `src/labs/mesh-lab/render/` | three.js viewport (drawing, picking, gizmo drags, edit cage, trace overlay), glTF in/out | Browser (Playwright) |
| `src/labs/mesh-lab/ui/` | Outliner, inspector, trace panel, script panel, log, shared controls | Mount test + browser |
| `src/utils/playback.ts` | Step playback shared with CodeLens (same speeds; MeshLab adds 50x, 200x, by phase) | vitest + browser |

The scene model is the only source of truth. The viewport is rebuilt from it; GUI actions and scripts both go
through `Editor.run`, so undo, the log and traces behave the same for both.

## Done (session 1)

**Milestone 1 (spec §44), all 19 items:** create cube, sphere, cylinder (and plane, grid, circle, cone, torus,
empty); hierarchy with drag-to-parent that keeps world position; select (click, Shift, box, all); move, rotate,
scale gizmo; numeric editing with expressions (`pi/4`); local/world gizmo axes; world axes and the active
object's local axes; local and world matrices with the T·R·S breakdown and the parent chain; JavaScript scripts
that change and create objects on the same scene; save/open (`.meshlab.json`) and autosave; undo/redo; GLB export.

**Milestone 2 (§45), mostly:** edit mode with vertex/edge/face selection; move, rotate, scale of vertices through
the gizmo (with mirror clipping); extrude (region, walls only on the border), inset (per face), loop cut (edge
ring, open or closed), subdivide (split and Catmull–Clark), merge at centre, delete (verts/edges/faces), flip;
topology inspection (Euler characteristic, closed, non-manifold, pieces, signed volume). Missing: bevel,
dissolve, region inset, knife.

**Beyond the milestones:** mirror and subdivision-surface modifiers (live, applicable); algorithm traces for
extrude, inset, loop cut, Catmull–Clark, merge, mirror, played back over the viewport with CodeLens-style
controls; the GUI → code log (replaying it rebuilds the scene; tested); "Adjust last operation" (change an
extrude's distance, an inset's amount, a loop cut's position after the fact); OBJ import and export that keep
quads (the Blender round trip); glTF/GLB import (welded); script examples including a box-modelled character;
Monaco with autocomplete for the scene API; the inspector's GPU data view (typed arrays, triangle → face).

## Done (session 2, 2026-09-28)

**Heat maps and the mesh Laplacian.** `Heat map` menu and a legend on the viewport (what the colours mean, the
range, quick switches, iso-lines on/off):

- distance along the surface from the selected vertices, by the heat method (Crane et al. 2013): heat flow,
  normalised gradient, divergence, Poisson solve. Traced: the trace colours the mesh at each step (heat on a log
  scale, the divergence, the final distance with iso-lines) and draws the gradient arrows;
- mean curvature H (from the cotan Laplacian of position) and Gaussian curvature K (angle defect), on a
  blue–white–red scale clamped to the 2nd–98th percentile, so corners do not wash out the rest;
- height (y); a script's own values (`mesh.showField([...])`);
- **Smooth vertices** (Mesh menu): Laplacian smoothing of the selection, traced, adjustable afterwards.

A field is a view, not part of the scene (not saved, not undone). It is recomputed after every change, so
distance follows the mesh while you extrude or drag, and it is computed on the evaluated mesh (modifiers
applied), which is what you see. Script API: `mesh.curvature()`, `mesh.geodesic(from)`, `mesh.smooth()`,
`mesh.laplacian()`, `mesh.showField()`, `scene.hideField()`, all in the editor's autocomplete.

A quad can be cut into triangles along either diagonal, and always cutting the same way biased the cotan weights:
on a quad sphere (true H = 1) mean curvature ranged 0.74–1.57 and the subdivided character came out blotchy.
Each face is now the average of its distinct fan triangulations (both diagonals for a quad): 0.986–1.016
(5th–95th percentile), outliers only at the eight valence-3 corners.

**Python, and stepping through a script.** The script panel has a JavaScript | Python switch. Python runs in
the browser through Pyodide (loaded on first use) against the same `scene` API: a thin Python layer converts at
the boundary (keyword arguments are the options object, so `scene.add.cube(size=2)`; lists and tuples become
arrays; `obj.position = (1, 2, 3)`; a lambda passed as a callback gets only the arguments it declares).
**Step through** runs the script recording every line (acorn-instrumented statements for JavaScript,
`sys.settrace` for Python): a player with the CodeLens speeds highlights the line in the editor, lists the
variables after it, shows the output so far, and the viewport shows the scene as it was after that line. A scene
copy is taken only when a hash of the scene changes; recording stops after 4000 lines (the script still
finishes). Errors name their line (Python: `Line 3: NameError: …`) and roll the scene back. Three Python
examples. Assigning a whole vector (`cube.position = [1, 2, 3]`) now works in JavaScript too; before, it
silently replaced the handle and changed nothing.

**Keyframe animation.** Position, rotation and scale keys per object (Blender's way: go to a frame, pose,
press I). Interpolation per key: constant, linear or ease (3t² − 2t³). Rotation either per Euler angle or by
quaternion slerp, switchable per object. A **Timeline** tab: transport (Space plays, ← → step), frame range and
fps, keys per channel on a ruler you scrub, a graph of each channel against frame (in slerp mode the Euler curves
are drawn dashed beside it), and the interpolation worked out at the current frame: t, s, q₀, q₁, θ, the two
slerp weights, and how many degrees Euler would be off. The active object's motion path is drawn in the viewport
(parents' animation included). Changing frame is not an undo step; keys are, and each is logged as
`obj.keyframe(frame, {...})`, so the GUI log rebuilds an animation. Script API: `keyframe`, `deleteKeyframe`,
`setInterpolation`, `rotationMode`, `animation`, `sample(frame)`, `clearAnimation`, `scene.frame`,
`scene.setTimeline`. GLB export bakes every frame into a glTF animation (Blender imports it as an action). Example:
"Euler vs quaternion rotation" (two boxes, same keys).

**three.js r186.** The repository moved from r168 to r186 (see `docs/threejs-r168-r186-upgrade.md`). MeshLab
needed no change: it already handled `TransformControls.getHelper()`, uses no removed API, and passed its tests,
typecheck and the browser run below on r186.

## Verification

- `npx vitest run src/labs/mesh-lab`: 7 files, 98 tests (session 1). They cover primitives (closed, outward, Euler,
  volumes against formulas); Catmull–Clark against hand-worked values (corner (1,1,1) → (5/9, 5/9, 5/9), edge
  point (¾, 0, ¾), 26 verts / 24 quads); mirror, inset, loop cut, delete, merge; world = parent × local;
  re-parenting keeps the world position; undo/redo; atomic scripts; replaying the GUI log; every example script;
  the character is one closed, connected surface; OBJ round trip; expressions; the mount (Tab into edit mode,
  Add menu).
- Browser (Chromium, dev server): face select → extrude → trace playback (border edges, Catmull–Clark phases);
  vertex drag +1 in x, 90° vertex rotation (−1,−1,−1) → (−1,−1,1), object drag, each logged and undone; the
  character script; playback at 50x (10 steps per tick) and by phase; CodeLens playback still advances.
- `npx tsc --noEmit`: no errors in MeshLab, `utils/playback.ts` or CodeLens.
- Session 2: `npx vitest run src/labs/mesh-lab`: 9 files, 127 tests (with `src/utils`: 11 files, 132). New in `core/geometry.test.ts`: conjugate
  gradients exact on a 2×2 system; the cotan matrix symmetric with zero row sums, mass summing to the area, and
  zero on linear functions; Gauss–Bonnet exact (cube, sphere, cylinder 4π; torus 0); a cube's corners π/2 each;
  sphere K = 1/r² and H = 1/r; the quad-sphere diagonal test; heat-method distance on a flat 41×41 grid within one
  edge (measured 0.06 for edge 0.1) and on a sphere within 1% of great-circle distance (measured 0.1%, about 50 ms
  for 2,000 vertices); smoothing; iso-lines; the editor flow (distance recomputed after an extrude, dropped with its
  object; fields on the evaluated mesh; the script API; smoothing undo and adjust).
- Browser (Chromium, r186): distance on a sphere (farthest 4.694 against π·1.5 = 4.712) and a torus; the trace's
  heat, gradient and Poisson steps coloured on the mesh; Gaussian curvature on a torus (red outside, blue inside,
  white on the top and bottom circles); mean curvature on the subdivided character. No page errors.
- Session 2, scripting (`core/scripting.test.ts`, Pyodide loaded from node_modules): instrumented JavaScript
  gives the same results as the original (single-statement loop and if bodies included); recorded lines, variables
  and scene states for a loop; error line and rollback; the 4000-line cap; Python keyword options, lists,
  handles, callbacks, `sys.settrace` line order, error lines, syntax errors; every Python example.
- Browser: Python staircase stepped line by line (2 objects after the first line, 4 after nine, 8 at the end),
  played at 10x, "Back to result" restores the real scene with one undo step; a Python error marks line 3 and
  rolls back; JavaScript stepping highlights the line. First Python start about 1 s from the dev server. A
  Monaco "Canceled" error when switching languages (two editor models) was fixed by using one model.
- Session 2, animation (`core/animation.test.ts`, `render/io.test.ts`): ease values; hold before the first and after
  the last key; constant steps; slerp halfway to 90° about y is 45°; constant angular speed; q vs −q takes the
  short way; on keys (0,0,0) → (90°,90°,0) the total turn is 120°, slerp's midpoint is 60° along it and Euler's is
  off the shortest arc; keys through the editor, frame changes not in undo, log replay rebuilds the keys; delete,
  clear, undo; file round trip (and old files get the default timeline); a child follows its animated parent;
  the script API; an exported GLB read back by three's GLTFLoader has the clip (25 baked frames, position 3 and a
  90° slerp turn at the middle frame).
- Browser: the Euler vs slerp example at frame 36 (Euler (44.4, 44.4, 0)°, slerp (26.3, 41.2, 26.3)°) with the
  Timeline's graph and slerp panel; Space played 23 frames in one second at 24 fps; I keyed frames 1, 40 and 72;
  at frame 20 the cube was at (1.442, 0.962, 0) = eased t = 19/39; the motion path drawn. No page errors.
- Totals at the end of session 2: `npx vitest run src/labs/mesh-lab`: 11 files, 142 tests. With `src/utils` and
  `src/labs/codelens`: 13 files, 147. `npx tsc --noEmit`: no errors in MeshLab, playback or CodeLens.

Bugs found by the browser checks and fixed: React's development double mount left a dead canvas over the live
one; the gizmo's remembered hover axis swallowed clicks after it was detached; extrude walls on a clipped mirror
seam sat inside the mirrored solid (now skipped, as Blender does); trace markers were washed out by the ghost mesh.

## Next, in order

1. Bones and skinning: an armature of joints, vertex weights (heat map of each bone's influence, reusing the field
   view), linear blend skinning, and posing/keying bones with the timeline above.
2. UVs (LSCM unwrap, which reuses the cotan Laplacian and the CG solver) and materials/shaders.
3. Bevel, dissolve and region inset; then learning modes built on the traces (pause before a step and predict).
