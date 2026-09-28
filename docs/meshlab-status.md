# MeshLab — implementation status

Updated 2026-09-27. Read this first when resuming MeshLab work. The specification is [meshlab.md](meshlab.md);
this file records what is built, how it was checked, and what comes next.

## Where the code is

| Folder | What | Tested |
|---|---|---|
| `src/labs/mesh-lab/core/` | Scene model, editable mesh and operations, Catmull–Clark, mirror, primitives, editor (commands, undo, GUI → code log), script API, traces, OBJ, examples | Headless, vitest |
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

## Verification

- `npx vitest run src/labs/mesh-lab`: 7 files, 98 tests. They cover primitives (closed, outward, Euler,
  volumes against formulas); Catmull–Clark against hand-worked values (corner (1,1,1) → (5/9, 5/9, 5/9), edge
  point (¾, 0, ¾), 26 verts / 24 quads); mirror, inset, loop cut, delete, merge; world = parent × local;
  re-parenting keeps the world position; undo/redo; atomic scripts; replaying the GUI log; every example script;
  the character is one closed, connected surface; OBJ round trip; expressions; the mount (Tab into edit mode,
  Add menu).
- Browser (Chromium, dev server): face select → extrude → trace playback (border edges, Catmull–Clark phases);
  vertex drag +1 in x, 90° vertex rotation (−1,−1,−1) → (−1,−1,1), object drag, each logged and undone; the
  character script; playback at 50x (10 steps per tick) and by phase; CodeLens playback still advances.
- `npx tsc --noEmit`: no errors in MeshLab, `utils/playback.ts` or CodeLens.

Bugs found by the browser checks and fixed: React's development double mount left a dead canvas over the live
one; the gizmo's remembered hover axis swallowed clicks after it was detached; extrude walls on a clipped mirror
seam sat inside the mirrored solid (now skipped, as Blender does); trace markers were washed out by the ghost mesh.

## Next (session 2), in order

1. Python through Pyodide with the same API names; the CodeLens link (step a script's lines and the geometry together).
2. Heat maps and the mesh Laplacian: curvature, smoothing, geodesic distance by the heat method, with traces.
3. UVs (LSCM unwrap) and materials/shaders.
4. Bones, skinning and keyframe animation (quaternions, slerp, linear blend skinning).
5. Bevel, dissolve and region inset; then learning modes built on the traces (pause before a step and predict).
