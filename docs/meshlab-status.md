# MeshLab — implementation status

Updated 2026-09-28 (session 3). Read this first when resuming MeshLab work. The specification is [meshlab.md](meshlab.md);
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

## Done (session 3, 2026-09-28): bones and skinning

- **Armatures** (`core/armature.ts`): a tree of bones with rest head/tail and a pose rotation in the bone's own
  axes (Blender's convention, y along the bone). Rest B, posed P = P_parent · (B_parent⁻¹B) · R(pose), skin
  S = P·B⁻¹. Add › Armature; bones added from the active bone's tail, edited (name, parent, head, tail) in the
  inspector, which also shows B, P and S for the active bone. Renames follow through to skins and keys.
- **Pose mode** (Tab on an armature): click a bone (picked by screen distance, as Blender does, since a ray
  misses thin bones), rotate it with the gizmo at its head, or type angles; Alt+R clears the pose. Bones are
  drawn as octahedra in front of the mesh; the active one blue.
- **Binding** (Object › Bind to armature, Ctrl+P): automatic weights by bone heat (Baran & Popović 2007, what
  Blender uses): per bone, (C + M·H) w = M·H·p with the cotan Laplacian and CG solver of the heat maps, then
  Blender's weight limits (drop below 0.025, fade to 0.05) and normalisation. Traced: nearest-bone distance, each
  bone's heat, the normalisation. The mesh is parented to the armature.
- **Skinning**: linear blend skinning, evaluated mirror → armature → subdivision (Blender's recommended order);
  every consumer (viewport, heat maps, OBJ/GLB export, statistics) goes through `core/evaluate.ts`. A mesh edited
  after binding is flagged stale and shown undeformed. Heat map › Bone weights; in edit mode the vertex card lists
  a vertex's weights and "Explain skinning here" traces each bone's candidate position and the blend.
  "Limit to 4 bones per vertex" makes MeshLab match glTF and game engines.
- **Bone animation**: I in pose mode keys the active bone's rotation; bones always slerp; the Timeline has a row,
  graph and slerp breakdown for the active bone.
- **GLB export** of the rig: a SkinnedMesh (the mirrored cage, 4 weights per vertex) on a bone hierarchy, with the
  bone animation baked, so Blender imports an armature and action.
- **Example** "Rig and animate the character": ten bones, automatic weights, a wave and a step.
- Script API: `scene.add.armature({ bones })`, `arm.bone(name)` (head, tail, parent, name, `pose`, `set`,
  `keyframe`, `posedHead/Tail`), `addBone`, `removeBone`, `resetPose`, `mesh.bindTo(arm)`, `unbind`, `skin`
  (`weights(bone)`), `setWeights`, `limitWeights`, `showField('weight', { bone })`.
- Found and fixed: the character example's leg step also extruded the arms' undersides (they face down too),
  hanging two flaps under the arms; this was visible as slab-like arms and gave the hands 23% thigh weight.

## Done (2026-09-29): finished example projects

Examples menu and toolbar button open a gallery (grouped like Sim Lab's templates) of eleven finished projects,
each built by a script on a new scene (one undo step), with a setup (selection, frame, panel, playback, camera)
and a "look and try" guide beside the viewport; "Show how it was built" loads its script (JavaScript or Python)
into the Script panel. `core/projects.ts`, `ui/Projects.tsx`.

- Modelling: low-poly island (terrain from a height formula, trees as empties with children, rocks), dining set
  (box modelling, one hierarchy), the box-modelled character.
- Animation: bouncing ball with exact gravity (new ease-in / ease-out interpolation: s = t², 1 − (1 − t)², frame
  counts from t = √(2h/g)), robot arm (nested joints; the carried block baked from the gripper's world matrix),
  Euler vs slerp.
- Rigging: the character walking and waving.
- Geometry: curvature gallery (Gauss–Bonnet totals printed), distance on a trefoil knot (heat method, traced),
  noise and smoothing (curvature spread and volume shrink printed).
- Scripting: a turned vase in Python.

Fixed on the way: `scene.add.empty` and `scene.add.mesh` ignored `parent`, `rotation` and `scale` (hierarchies
built by script silently came out flat); `add.armature` now takes them too. The Timeline shows an armature's bone
curve when the object itself has no keys.

Verification: `core/projects.test.ts` builds every project (Python through Pyodide) with no error, valid meshes,
the setup's selection, one undo step; and checks what the projects claim: the ball's first fall matches
y = top − (top − y₁)t² at every frame and lasts 19 frames; the gallery prints 4π for the sphere and 0 for the
torus; smoothing cuts the curvature spread by over 3× and shrinks the volume; the knot is closed and shows
distance from vertex 0 with the heat-method trace; the gripper has no keys of its own yet moves, and the block is
at the gripper (to 1e-9) from frame 45 to 105 and stays after. Browser: all eleven opened from the gallery by
clicking, each with its selection, guide, playback or heat map, no page errors. `npx vitest run src/labs/mesh-lab`:
13 files, 178 tests (183 with `src/utils` and `src/labs/codelens`).

## Done (2026-09-29): weight painting and dual-quaternion skinning

- **Weight paint mode** (Ctrl+Tab on a bound mesh, or the Weight paint button): the active bone's weights as the
  heat map, a brush ring on the surface, and Draw / Add / Subtract / Blur brushes with value, radius and
  strength. Falloff f = (1 − (d/r)²)²; auto-normalise keeps the painted weight and scales the other bones so every
  vertex still sums to 1; X-mirror paints the mirrored spot on the other side's bone (.L ↔ .R). A press on the mesh
  paints, anywhere else orbits. Each stroke is one undo step, logged as `paintWeights(bone, { …, points })`, which
  replays to the same weights (`core/weightPaint.ts`).
- **Dual-quaternion skinning** (Skin panel › Blend, or `mesh.skinning = 'dual-quaternion'`): the bones' rigid
  motions are blended as dual quaternions (hemisphere-aligned, normalised) in the armature's space, instead of
  averaging the points each bone would give. "Explain skinning here" shows each bone's dual quaternion and the
  blend. glTF stores only linear blending; the Skin panel says so.
- **Examples**: "Fix a bad rig" opens the waving character in weight paint mode on the Spine at frame 24, where
  the chest is dragged by the arm; "Candy wrapper" twists two identical forearms 172°, linear beside dual
  quaternion. The walk-and-wave guide points to weight painting.
- Verification: `core/weightPaint.test.ts` (falloff values; normalisation keeps the painted weight and scales the
  rest, 0.5/0.3/0.2 → 0.8/0.12/0.08; draw/subtract/mirror; a stroke on the chest cuts UpperArm.L's weight there by
  over 80%, keeps every sum at 1, is one undo step, and its logged line replays to the same weights; undo restores
  them); `core/armature.test.ts` (a 0.999π twist: linear pinches the knee ring below half its radius, dual
  quaternion keeps every ring within 1%; the two agree exactly where a vertex follows one bone and in the rest
  pose; method switch undo/log/file); `core/projects.test.ts` (the candy wrapper's middle ring < 0.5r linear,
  > 0.9r dual quaternion, both tubes closed; one stroke on "Fix a bad rig" halves the chest's drift). Browser: the
  project opens in weight paint; a real mouse drag over the chest paints (UpperArm.L weight there 3.29 → 2.62),
  one undo step, the camera did not orbit; the candy wrapper shows the pinch beside the round tube. No page errors.

## Done (2026-09-29): bone roll and editing bones in the viewport

- **Roll**: a bone's turn about its own length, B = T(head) · R(+y → bone) · R_y(roll). It leaves the bone where it
  is but turns its x and z axes, so the same pose rotation bends it in another plane. Inspector field, `bone.roll`,
  kept through files, `addBone`, `add.armature` and the log.
- **Edit bones** (Tab on an armature, as in Blender; pose mode moved to Ctrl+Tab): bones drawn at rest with joint
  spheres; click a joint (screen distance) or a bone's middle (the whole bone) and drag the arrows. Joints that sat
  on the moved one move with it, so connected children stay attached. E extrudes a bone from the selected tail
  and selects its tail; X deletes. Each drag is one undo step, logged as `bone(n).set({ head, tail })` lines.
  While an armature's bones are edited, meshes bound to it are shown in the rest pose (as Blender does).
- **Example** "Tentacle: bones by hand, and roll": a tapered tube on five bones in a travelling wave; the guide has
  you move joints, extrude a sixth segment and roll a bone to change its bending plane. Guides and help texts now
  say Tab = edit bones, Ctrl+Tab = pose.
- Verification: rolling a bone 90° keeps its tail and turns a 90° bend about x from +z to +x; `moveJoint` moves
  touching joints (a tail drags the child's head, a whole bone drags both neighbours' ends); Tab enters bone edit,
  a drag is one step with the two expected log lines, E extrudes and selects the new tail, roll survives a file
  round trip, the log replays to identical bones; the tentacle's Seg 1 swings in z without roll and by the same
  amount in x with 90° roll; bound meshes are exactly at rest while editing bones and posed again after.
  Browser: Tab into bone edit on the tentacle, a click selected the Seg 2/Seg 3 joint, a drag of the X arrow moved
  both ends (one "Move joint" step), clicking the top tail and pressing E grew Seg 5.001; the tentacle stood straight
  at rest behind the bones. No page errors. `npx vitest run src/labs/mesh-lab`: 14 files, 197 tests.

## Done (2026-09-29): UV unwrapping and shaders

- **Seams** (UV menu, or edit mode edge select): mark and clear; "Seams from sharp edges" (every edge over 60°).
  Drawn red in edit mode. Stored on the object as edge keys.
- **Unwrap** (U in edit mode, UV › Unwrap), `core/uv.ts`: charts from the seams, with vertices split into wedges so
  a seam that stops part way still opens the surface; LSCM per chart in Mullen et al.'s form,
  E = ½(uᵀCu + vᵀCv) − ½uᵀSv, with the cotan matrix C of the heat maps and the boundary shoelace matrix S, two
  pins, one CG solve; each chart straightened to its smallest bounding box (a square chart pinned at opposite
  corners otherwise stands on a corner), scaled to its true area, packed in rows into the unit square. Traced.
  "Project from above" for terrain. A closed mesh without seams gets a message, not a broken map.
- **UVs through the modifiers**: mirrored faces reuse their originals' UVs reversed; Catmull–Clark averages them
  with the same stencil as the new faces (linear, Blender's "UV Smooth: None"). The viewport splits vertices at
  seams and draws textures on the evaluated (mirrored, skinned, subdivided) mesh.
- **Distortion**: σ₁/σ₂ of each triangle's map (1 = angles kept), as a heat map (UV › Angle distortion) and in the
  UV tab, which draws the layout over the texture with edit-mode selections highlighted.
- **Materials** (inspector): shading model PBR / Lambert / Blinn–Phong / Toon / Normals / UV / Custom GLSL, each
  with its equation; procedural textures (checker, grid, bricks, wood, stripes) with a repeat scale; shininess.
  The **Shader tab** shows the full GLSL of the model; for Custom, the body of shade(N, L, V, uv, base, light) is
  editable (Apply or Ctrl+Enter). A compile error is shown with its line counted in your code, and the object is
  drawn with Lambert until the code compiles. Lighting comes from the scene's sun.
- Script API: `markSeams`, `clearSeams`, `seams`, `seamsFromSharp`, `unwrap({ method })`, `uv`, `uvDistortion()`,
  `showField('uv')`, `material.shader / texture / textureScale / shininess / glsl`.
- **Examples**: "Unwrap a cube and a sphere", "Shader gallery", the vase now unwrapped with stripes, the dining set in
  wood grain (the plan's "texture the vase" and "wood on the dining set").
- Verification: `core/uv.test.ts` (the distortion measure on a rotation-and-scale map and a 2× stretch; a cube's
  twelve sharp edges give six charts of four; a partial seam doubles exactly the cut vertices; a flat grid unwraps
  with distortion 1; the cube to six equal, axis-aligned, undistorted squares inside [0, 1]²; a sphere opened on one
  meridian converges toward conformal under refinement (48×24 mean < 1.12) while its area ratio varies over 5×; a
  closed mesh without seams is refused; UVs fit the mirrored and subdivided meshes; editor/script flows, logged and
  replayed; every shading model's GLSL frame; the checker pattern). `core/projects.test.ts` (the unwrap project
  prints distortion 1.0000 for the cube, a sphere mean under 1.25 and area variation over 3×; the vase has two
  charts and mean distortion under 1.2; the gallery's models, UVs and GLSL; every dining-set part wood-grained).
  Browser (real GPU): all eight gallery shaders compiled; a broken custom body showed "line 1 of your code: …
  syntax error" and fell back to Lambert; the fix compiled and cleared it; textured cube, sphere, vase and dining
  set drawn; the UV tab's layout. No page errors. `npx vitest run src/labs/mesh-lab`: 15 files, 216 tests (224 with
  `src/utils` and `src/labs/codelens`).
- Noticed, not changed: the selection outline draws every edge of the selected object, so a selected dense mesh
  looks wireframed; Blender outlines only the silhouette.

## Done (2026-09-29): bevel, dissolve, region inset, learning mode

- **Region inset** (I, now the default, as Blender's): the selection's outline moves in by a distance, mitred at
  corners; faces inside keep their shape. "Inset individual faces" stays in the Mesh menu.
- **Bevel** (Ctrl+B): width along the neighbouring edges, 1–12 segments (a quadratic Bézier profile with the old
  corner as control point); corner patches where three or more bevels meet (fanned from a centre point when
  rounded); clamped so bevels do not cross. Rules in `core/modelling.ts`.
- **Dissolve** (Ctrl+X): vertices, edges or faces by the selection mode; the faces around merge, the shape stays.
- All three traced, logged, adjustable afterwards (thickness; width and segments) and in the script API
  (`insetRegion`, `bevel`, `dissolve`). `obj.evaluatedStats()` gives the stats of the mesh as shown.
- **Learning mode, Predict**: trace steps can carry a question (prompt with the inputs, the answer, the rule).
  Catmull–Clark asks for two face points, two edge points and two moved vertices; extrude for a copied vertex;
  inset for an inner corner; skinning (Explain skinning) for the blend. In the trace player's 🎯 Predict mode,
  playback stops at each question (no speed jumps past one), the result is hidden in the panel and the viewport
  (the inputs stay highlighted), answers are checked within 0.01 + 1%, and a score counts right-first-time.
- **Selection outline**: now a silhouette (an inverted hull pushed out along smooth normals, back faces only), not
  every edge; a selected dense mesh no longer looks wireframed. At concave creases (the crate's recessed panels)
  thin outline lines show through, a known limit of the technique.
- **Examples**: "Hard-surface crate" (bevel, region inset, recessed panels, wood), "Support loops and subdivision"
  (plain, bevelled and support-looped cubes under the same subdivision, volumes printed), the dining table's edge
  bevelled, and "Predict Catmull–Clark" in a new Learning group.
- Fixed on the way:
  - Extrude moved a selection of separate pieces along one averaged normal, so six sides of a box went nowhere
    (zero-area walls); each edge-connected piece now moves along its own normal, as in Blender.
  - Undo left the undone step's line in the GUI → code log, so replaying the log after an undo (or an Adjust)
    did not rebuild the scene; undo now removes the line and redo restores it.
  - Adjust re-ran an operation with the selection as it was after the operation, which bevel clears; it now uses
    the selection from before.
  - Dissolve vertices renumbered the mesh before removing the vertices, removing the wrong one.
  - Traces started by scripts did not record the object or the starting mesh, so a Predict question showed the
    finished result (the answers) in the viewport.
- Verification: `core/modelling.test.ts` (a 2 × 2 region inset moves its outline in by exactly the thickness with
  (±0.8, ±0.8) mitred corners; a cube's top inset keeps volume 8; one cube edge bevelled: 7 faces, 10 vertices,
  two pentagons, volume 8 − w²; all twelve: 26 faces with 8 corner triangles and every vertex on the cube; three
  segments; valence-4 ends and a fully bevelled subdivided cube stay closed with χ = 2; dissolve faces, edges and
  vertices give the expected polygons; in the editor: Adjust changes a bevel's segments afterwards, one undo step
  each, log replay equals the mesh); `core/editor.test.ts` (log after undo and redo replays to the scene);
  `core/learning.test.ts` (tolerance; Catmull–Clark's six questions, each answer re-derived from its prompt's
  numbers and rule; extrude and inset questions; the project opens in Predict mode on a trace that starts from the
  8-vertex cube); `core/projects.test.ts` (the crate closed, χ = 2, mean UV distortion < 1.1; support-loop volumes
  ordered plain < bevelled < looped, the looped over 90% of the box). Browser: Ctrl+B on an edge and segments 4 in
  Adjust (logged `bevel([[2, 6]], 0.1, 4)`); the crate and support-loop cubes rendered; Predict stopped at the first
  question with the original cube shown, a wrong answer got "Not quite", the right one "✓ Right" and the rule, the
  score read "0 right first time, 1 of 6 done". No page errors. `npx vitest run src/labs/mesh-lab`: 17 files,
  236 tests (244 with `src/utils` and `src/labs/codelens`).

## Done (2026-09-29): challenges, guide checks, walk cycle, island texture

- **Guided challenges** (`core/challenges.ts`, the gallery's first section): a starting scene, a goal, and a
  checklist evaluated on every change, with hints one at a time and a solution script loaded (not run) on request.
  "Land on frame 20" (a key at 20 on the floor, falling straight, ease-in from rest), "Six squares" (UVs that fit,
  six pieces, no distortion), "Fix the chest" (the arms' weight on the chest under 10% each side, the hands still
  over 85% forearm), "Keep it a box" (subdivision still on, cage closed, 90% of the box's volume after subdivision).
  Starting a challenge clears undo and the log, so they hold only the learner's work.
- **Guides are checked**: every "Menu › Item" in a project guide, description, challenge brief or hint must be an
  item of that menu, and every other "A › B" must be text in the interface; the check proves it catches a
  made-up item and a made-up panel.
- **Walk cycle** project: the rigged character walking four 24-frame cycles: contact and passing keys for thighs
  and shins, the hips dipping 3 frames after each contact and rising at passing, steady forward motion, arms
  relaxed (adding arm swing is left as the exercise).
- **Island textured**: a new procedural "grass" texture on planar UVs; the sea is 14 wide, 2 more than the land,
  because the land's sunken edges showed under a sea the same width when seen from an angle.
- Verification: `core/challenges.test.ts` (for every challenge the start fails and the solution passes; a key at
  20 with linear easing is not enough for "Land on frame 20"); the guide check in `core/projects.test.ts`; the walk
  loops (frames 25 and 49 equal frame 1 bone for bone), dips at frame 4 and rises at frame 10, and covers the same
  distance every 6 frames; the island's grass and UVs. Browser: "Six squares" solved through the UV menu (the
  checklist ticked live to "✓ Challenge complete" after a hint); "Land on frame 20" completed from its solution;
  the walk and the island rendered. No page errors. `npx vitest run src/labs/mesh-lab`: 18 files, 245 tests
  (253 with `src/utils` and `src/labs/codelens`).

## Done (2026-09-29): deep links for lessons

`#/lab/mesh-lab?project=<id>` and `?challenge=<id>` open a project or challenge, built by `meshLabLink(kind, id)`
in `src/labs/mesh-lab/links.ts` (which throws on an unknown id). `EntryShell` opens labs as windows and then
navigates back to the listing, which dropped the query; it now hands the query to the lab through
`src/utils/entryLinks.js` (taken on mount, or announced as an event to a lab already open). Tests: every
project and challenge id round-trips through the link builder and parser; an unknown id throws; the hand-off is
taken once and announced. Browser: a fresh load of `?project=walk-cycle` opened the walk cycle playing with its
guide; changing the address to `?challenge=six-squares` while open started the challenge. The course plan these
serve is `docs/modelling-course-plan.md`.

## Done (2026-09-29): "A mesh is two lists" project

A new Learning example, `two-lists`, for lesson 1.1 of the modelling course. It contains two pyramids typed in as
a vertex list and a face list. One shares its corners (5 vertices); the other gives every face its own copies
(16), and tears when its tip moves. The test checks both counts and the tear.

## Done (2026-09-30): Fill, three more challenges, guides that tick

- **Fill (F in edit mode, Mesh › Fill).** Closes the hole round the selected vertices with one face. The corners
  come from the hole's boundary loop, not the click order. The face is wound opposite to its neighbours' boundary
  edges, so it points the same way they do. If the selection isn't one hole, it says why and changes nothing.
  Logged as `mesh.fill([...])`. F frames the selection in object mode, as before; in edit mode, `.` frames.
- **Challenges, now one per project group:**
  - Learning: "Close the box". The check fails a lid wound the wrong way (the volume comes out negative).
  - Geometry: "The farthest point". Put a flag at the point farthest along the surface from a start on the
    inside of a ring. The tempting answer, straight across the hole, is only 73% of the way; the tests check
    this.
  - Scripting: "Script a staircase". The checklist names the wrong steps.
- **Guides that tick.** A guide step can carry a `done(editor, start)` check. `start` is the scene when the
  project opened. It only uses what the editor already keeps: the GUI → code log labels since opening, object
  transforms, bones, materials, the heat map shown and the mode. The guide shows ✓/○ per step and "n/m ✓".
  26 steps across 17 projects have checks. The tests prove each is unticked when its project opens and ticked
  after the action it describes.
- **Bug the tests found:** paint strokes are logged as "Paint <bone>", so a check looking for "Paint weights"
  would never have ticked.

## Done (2026-09-30): cameras, looking through, rendering a still, the island fly-through

- **Cameras are objects** (`core/camera.ts`, kind `camera`). A camera has a vertical field of view in degrees,
  plus near and far planes. It looks down its own −z axis with +y up, as in three.js and glTF.
  `scene.activeCamera` is the one stills are rendered from. It is saved in scene files, and it is cleared if
  that camera is deleted.
- **Script API:**
  - `scene.add.camera({ position, fov, lookAt })`; the first camera becomes the scene camera.
  - `obj.lookAt(target)`, which works on any object and respects a turned parent.
  - `cam.fov`, and `scene.camera = cam`.
- **Editor:** Add › Camera, and Add › Camera from this view. The View menu gains:
  - Look through the scene camera (0). Dragging or zooming leaves it, keeping the view.
  - Align the scene camera to this view (Ctrl+Alt+0).
  - Render still (PNG).

  All of these are undoable and logged as code. The tests replay the log and get the same camera.
- **Viewport:**
  - The camera is drawn as the pyramid it sees, in the render's shape, with an up triangle.
  - Looking through follows an animated camera every frame. The render's frame is marked, and the rest of the
    view is dimmed.
  - The Inspector's Camera section has field of view (with the wide angle it implies), render size, "Make it
    the scene camera", Look through and Render still.
- **Render still:** a second WebGL renderer at the render size draws only the models and lights, then
  downloads `meshlab-render.png`.
  - The gizmo sets its own parts' visibility while drawing, so it is hidden as a whole. Before that, it
    showed up as a blue disc in the render.
  - Browser check: a 1280 × 720 PNG with 136 colours, and no overlays.
- **Project "Fly-through of the island" (Animation).**
  - It shares the island's code, and keys the camera every 6 frames with lookAt(peak) and quaternion
    rotation (slerp).
  - Test: frame 241 equals frame 1, and between keys the camera stays within 2.6° of the peak (cos > 0.999).
- **Fixed:** `dispose()` now also removes the camera-frame overlay. React mounts twice in development, and a
  second one was left behind.
- **Not done:** cameras are not exported to glTF yet, and the render has no sky (it uses the viewport's
  background colour).

## Done (2026-09-30): loop select, the knife, outlines in creases, smooth UV subdivision

- **Loop select (Alt+click, Edit › Select loop).** `EditMesh.edgeLoop` goes straight on at each 4-edge vertex:
  it takes the edge that shares no face with the one it arrived along. Along a boundary it follows the
  boundary through 3-edge vertices, and it stops at poles, triangles and n-gons. In face mode it selects the
  ring of faces. Tests: torus loops close at 48 and 12 edges; a grid's inside loop runs edge to edge; a UV
  sphere's meridian stops where the pole triangles begin.
- **The knife (K in edit mode, Mesh › Knife).** Drag a line; the cut is the plane through the eye and the
  line's two ends, kept to the wedge between them (`core/knife.ts`).
  - Faces crossed twice are split. New edge vertices go into the neighbouring faces as well, so there are no
    cracks.
  - Only faces facing the eye are cut, unless X-ray is on (then it cuts through).
  - Logged as `mesh.knife({ eye, from, to, through })`, which needs no view; the tests replay it and get the
    same mesh.
  - Tests: a cut all the way round a cube gives 10 faces, 12 vertices, closed, volume 8, with every new vertex
    on the plane. A front-only cut leaves the side faces with 5 corners but the cube closed. A diagonal cut
    uses the existing corners. A short line cuts only between its ends. Esc cancels.
  - Browser: K, then a drag, cut the default cube's front face; it stayed closed and the new edge was
    selected.
- **Outline in concave creases.** The selection outline is an inverted hull, and in a crease its back faces
  could come in front of the body. Now each selected body writes 1 into the stencil buffer (the renderer asks
  for one), and the outline draws only where the stencil is not 1: outside the silhouette. Measured on the
  crate's recessed panels: the lines inside the panels are gone, and outline pixels inside the silhouette
  fell from 1214 to 481. Those 481 were the move gizmo, which that count did not hide; the diff image, which
  hides it, shows none.
- **Smooth UV subdivision.** The subdivision modifier has "Smooth UVs", on by default as in Blender ("keep
  boundaries"). The UVs are subdivided as a mesh of their own, with Catmull–Clark's rules. Corners with the
  same vertex and the same UV are one UV vertex, so seams are boundaries, and boundaries stay linear.
  - Tests: on a flat grid with UVs projected from above, every smoothed UV equals its new vertex's (x, z),
    border included. Islands that are flat squares come out the same as linear. On a sphere with one seam, at
    level 2, the mean angle distortion drops from 1.49 to 1.32 and the worst from 4.89 to 2.89.
  - The old linear UVs are `uvSmooth: false`.
- **Bug fixed on the way (subdivision):** the corners of an open mesh, such as a plane, were rounded off,
  because a corner has two boundary edges and got the along-the-edge rule. Blender keeps them ("keep
  corners"). Now a boundary vertex on only one face stays put, and the trace says so.
- **Not yet:** an example project for loop select, the knife and smooth UVs. They are planned alongside
  lessons 4.3, 4.5 and 6.5, with challenges.

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
- Session 3 (`core/armature.test.ts`, `render/io.test.ts`): B·(0, L, 0) is the tail; a parent's quarter turn
  puts the child at (−1,0,0)–(−2,0,0) exactly; rest pose leaves the mesh unchanged; bone heat on a two-bone tube:
  weights sum to 1, > 0.95 pure at the ends, shared at the knee, fading monotonically; a hard-weighted shin bent
  90° moves rigidly about the knee; a half twist collapses the knee ring (the candy-wrapper artefact); editor add
  bone / rename / delete / bind / pose / undo; bone keys slerp to exactly half the turn halfway; the GUI log
  rebuilds rig, identical weights and animation; files round-trip; the weights heat map equals the skin; a stale
  skin is reported; the script API; the rigged character's hand is ≥ 0.9 forearm with no leg weight and rises
  over 1 unit by frame 24; the exported GLB re-imported by three.js as a SkinnedMesh deforms within 2.3e-7 of
  MeshLab at every vertex with ≤ 4 bones (up to 0.05 off where glTF drops weaker bones), and at every vertex after
  "Limit to 4".
- Browser (session 3): the rig example; Tab into pose mode, a mouse click selects the Head bone, a gizmo drag
  poses it (one undo step, logged as `bone("Head").pose = [...]`); the weights heat map; the vertex weights card
  and the skinning trace (0.053 · (1.382, 1.767, −0.3) + 0.947 · (0.902, 1.892, −0.3) = (0.927, 1.885, −0.3)).
  No page errors.
- Totals at the end of session 3: `npx vitest run src/labs/mesh-lab`: 12 files, 160 tests; with `src/utils` and
  `src/labs/codelens`: 14 files, 165. `npx tsc --noEmit`: no errors in MeshLab, playback or CodeLens.
- Totals at the end of session 2: `npx vitest run src/labs/mesh-lab`: 11 files, 142 tests. With `src/utils` and
  `src/labs/codelens`: 13 files, 147. `npx tsc --noEmit`: no errors in MeshLab, playback or CodeLens.

Bugs found by the browser checks and fixed: React's development double mount left a dead canvas over the live
one; the gizmo's remembered hover axis swallowed clicks after it was detached; extrude walls on a clipped mirror
seam sat inside the mirrored solid (now skipped, as Blender does); trace markers were washed out by the ghost mesh.

## Next, in order

These come before the lessons of the course in `docs/modelling-course-plan.md`, whose lessons 3.7, 4.3, 4.5
and 6.5 need them. That plan's "MeshLab tool coverage" table must gain a row for each new tool.


1. ~~More challenges (one per project group), and guides whose steps tick themselves.~~ Done 2026-09-30.
2. ~~A camera object and a fly-through of the island; render a still to a PNG.~~ Done 2026-09-30.
3. ~~Knife and loop select; the outline showing through concave creases; UV smooth.~~ Done 2026-09-30.

## Example projects: plan

The gallery (`core/projects.ts`) grows with the app. **Rule: every new feature ships with a new example or an
updated one, plus a test of what that example claims** (as `core/projects.test.ts` already does for the ball's
parabola, the Gauss–Bonnet totals and the carried block). A feature is not done while its example is missing or
broken.

### Existing examples to update

| Example | Current compromise | Update when |
|---|---|---|
| Rigged character | Automatic weights on the 66-vertex cage spread arm weight onto the chest. | **Done** (2026-09-29): "Fix a bad rig" opens it in weight paint mode on the chest; the walk-and-wave guide points to it. |
| Rigged character | Twisting a bone collapses the joint (the candy wrapper). | **Done** (2026-09-29): the "Candy wrapper" project, and Skin panel › Blend on any bound mesh. |
| Robot arm | The block is carried by baked keys, because there are no constraints. | Constraints, if added: a live Child Of constraint, keeping the baked version for comparison. |
| Dining set, island | Hard box edges on the table; the island is flat-coloured. | Wood grain **done** (2026-09-29). Still to do: a bevelled table edge (bevel), and a texture on the island (planar UVs). |
| Box-modelled character | Arms and legs are extruded from whole faces, so the shoulders are blocky. | Region inset and bevel: rebuild with cleaner topology. |
| All | Guides are "Tab, click, press I" instructions. | Learning modes: guides become checkpoints with a pause-and-predict step before each operation. |

### New examples, by feature

- **Weight painting and skinning:** "Fix a bad rig" (a poorly weighted arm repaired with the brush); "Candy
  wrapper" (two twisted forearms, linear blend beside dual quaternion).
- **UVs and materials:** "Unwrap a cube and a sphere" (seams, a checker texture, the stretch heat map; why a sphere
  cannot unwrap without distortion, the Gauss–Bonnet idea from the curvature gallery); "Texture the vase" (a
  cylindrical unwrap of the Python vase); a shader gallery (one sphere across roughness, metalness and normal maps,
  with the lighting maths shown).
- **Bevel, dissolve, region inset:** a hard-surface prop (a crate or a phone: bevels and support loops, with and
  without subdivision); a retopology comparison (good and bad quad flow, and what each does to subdivision and
  deformation).
- **Animation:** a proper walk cycle (foot contacts, the hip rising and falling, a clean loop); a camera fly-through
  of the island, if cameras become objects.
- **Learning modes:** guided challenges instead of finished scenes ("extrude this into a table", "make the ball
  land on frame 20", "fix these weights"), graded by the same kind of checks the project tests use.

### Keeping guides honest

Guides name menus and buttons ("Heat map › Bone weights"). The tests check that each project builds and that its
numbers hold, but not that those words still exist in the UI, so a renamed menu leaves a stale guide. Give each
guide step a reference to the menu item or action it mentions, and add a test that the reference exists.

### When the app is finished

One pass over the gallery as a whole: order it as a path (modelling → animation → rigging → geometry → scripting),
remove overlaps (the character now appears in three projects), and check every guide once more in the browser.
