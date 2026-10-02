# Course plan: 3D Modelling, Geometry & Graphics

Status (2026-09-30):
- **Lesson 1.1** is built, as a trial.
- **The MeshLab work the lessons need is done** (see "MeshLab work before the lessons"). Lessons are next.
- **Scope widened** at the user's request. The course now teaches four things together: the maths, the
  algorithms, the computer graphics, and the MeshLab tools.
- **Order of work:** finish the open MeshLab items first (see "MeshLab work before the lessons"), then write
  the lessons.

## What the course teaches

Not only modelling. **Every lesson teaches one idea in four strands:**

| Strand | The question it answers | Example (bevel) |
|---|---|---|
| **Maths** | What is true, and why? | Sliding a corner along its edges; the Bézier profile; why the patch at a corner must fan |
| **Algorithm** | How is it computed, with what data, at what cost? | Walk the selected edges; build the strip and corner patches; update the face list |
| **Graphics** | How does it reach the screen? | Why a sharp edge shades wrongly without a bevel; how normals are shared across it |
| **Tool** | How do you use it in MeshLab (and Blender)? | Select edges, Ctrl+B, drag the width, scroll for segments; the Adjust panel |

By the end, a learner can use each tool as a modeller would. They can also explain the maths behind it, write
the algorithm themselves, and say how the result gets drawn.

## Why a new course

MeshLab lets you model, rig, animate, unwrap and shade, and it shows its algorithms as they run: traces,
Predict mode, heat maps. It does not teach the ideas from the ground up. This course does.

It is not an extension of an existing course:
- **Mesh Engine** is computational geometry for CAM: point-to-mesh distance, bounding volumes, signed
  distance, comparing two models.
- **Three.js** teaches the rendering API.

This course links to both where they overlap, and changes neither.

**Who it is for.** Someone who wants to understand 3D graphics deeply, and to use a modelling tool the way
Blender users do: the same audience as MeshLab.

## The shape of every lesson

Each lesson follows `docs/lesson-writing-standard.md` and has four parts:

1. **Learn: the maths.**
   - The one-sentence target first, then concrete numbers before any formula.
   - Every symbol defined before use, and the technique as a numbered procedure.
   - Maths in LaTeX, tied to the code that computes it.
2. **Build it: the algorithm.**
   - A notebook in which the learner writes the algorithm and sees it drawn with three.js.
   - A graded challenge whose check names what is wrong without giving the fix.
3. **Watch MeshLab do it: the algorithm, inside the tool.**
   - The same operation in MeshLab with Record traces on, stepped through in Predict mode: the learner works
     out each step before it is shown.
   - Or a heat map of the quantity the lesson computes.
   - The learner compares their notebook's numbers with MeshLab's.
4. **Use the tool.**
   - A MeshLab project or challenge (a link built with `meshLabLink`).
   - A short "how a modeller uses this": keys, the Adjust panel, when to reach for it, and the Blender
     equivalent.

The **graphics** strand runs through parts 1–3. For each topic, say what the GPU receives, how it is shaded,
and what goes wrong visibly when the maths or the algorithm is wrong.

## Chapters and lessons (about 70 lessons)

Each row gives the lesson title, then the four strands:
- **Maths**
- **Algorithm:** its data structure and its cost
- **Graphics**
- **MeshLab:** the tool taught, and its project (P) or challenge (C)

✓ marks a built lesson. A "(new)" project or challenge does not exist yet and is made alongside its lesson.

### 1. Meshes as data (7)

| # | Lesson | Maths | Algorithm | Graphics | MeshLab |
|---|---|---|---|---|---|
| 1 ✓ | A mesh is two lists | Vertex list, face list, degree, slot counting | Reading faces back as points; validating lists | Fan triangulation for drawing | Edit mode, G on a vertex; P: two-lists |
| 2 ✓ | Winding and normals | Cross product, right-hand rule, face normal, area | Newell's normal for n-gons | Back-face culling; Flip normals | Normals overlay, Mesh › Flip normals (traced); P: winding-and-normals, C: fix-the-normals |
| 3 ✓ | Edges and neighbours | Edges from faces; manifold and boundary edges | Edge table as a hash map, O(F); neighbour lists | Drawing the wireframe (edge lines) | Wire overlay, status-bar counts (edges, open edges), Edit › Select non-manifold (traced edge table); P: edges-and-neighbours, C: remove-the-fin |
| 4 ✓ | Connected pieces | Graphs, components | Breadth-first search on the face graph | Selection highlighting | Edit › Select linked (face select: traced BFS across shared edges); P: connected-pieces, C: remove-the-floaters |
| 5 | Euler's formula | V − E + F = 2; genus | Counting from the edge table | Why holes change shading seams | P: curvature-gallery (torus χ = 0) |
| 6 | Welding, cleaning and filling holes | Equality with a tolerance; boundary loops | Spatial hashing to merge close points; compacting indices; filling a hole with consistent winding | Cracks and double edges on screen | Merge at centre, F Fill; C: close-the-box |
| 7 | Files: OBJ and glTF | Index bases (1 in OBJ); buffers | Parsing OBJ; writing glTF buffers | What glTF hands the GPU | File › Import / Export OBJ / GLB (link: Mesh Engine 1.4) |

### 2. Vectors, matrices and transforms (8)

| # | Lesson | Maths | Algorithm | Graphics | MeshLab |
|---|---|---|---|---|---|
| 1 | Vectors, dot and cross | Length, angle, projection | — | Lighting uses dot products | Inspector numbers |
| 2 | Translate, rotate, scale | 3×3 matrices, the 4×4 homogeneous form | Building T·R·S | The model matrix in the vertex shader | Move / Rotate / Scale, the matrix readout |
| 3 | Order matters | Non-commuting matrices | Composing and decomposing TRS | Wrong order, visible distortion | Inspector › How it is built: T, R and S |
| 4 | The determinant | Volume scaling; a negative determinant mirrors | 3×3 determinant | Mirroring flips winding, then faces go dark | Negative scale, the determinant readout |
| 5 | Hierarchies | world = parent × local | Walking the parent chain | The scene graph | Outliner parenting, Clear parent; P: robot-arm |
| 6 | Local and global axes | Change of basis | Gizmo axes from the matrix columns | Drawing the gizmo | Local axes toggle |
| 7 | Euler angles and gimbal lock | Rotation order; singularity | Euler to matrix and back | Visible gimbal lock | Rotation mode; P: euler-vs-slerp |
| 8 | Numbers you can type | Grammars and operator precedence | Recursive-descent expression parser | — | Inspector fields accept `pi/4`, `2*1.5` |

### 3. From scene to screen: the rendering pipeline (7)

| # | Lesson | Maths | Algorithm | Graphics | MeshLab |
|---|---|---|---|---|---|
| 1 | Cameras | The view matrix as an inverse transform; look-at | Orbit, pan, zoom | Camera space | Viewport navigation, Frame selected / all |
| 2 | Projection | Perspective divide; orthographic; field of view | Building projection matrices | Clip space, NDC | View › Perspective / Front / Right / Top |
| 3 | Rasterization | Barycentric coordinates; edge functions | Filling triangles, interpolating | Per-pixel attributes | (notebook-only software rasterizer) |
| 4 | The depth buffer | Depth precision, z-fighting | Z-test | Polygon offset for outlines | X-ray toggle |
| 5 | Flat and smooth shading | Vertex normals as weighted averages | Area/angle-weighted normals; split normals at hard edges | Faceted versus smooth | Shade smooth / flat |
| 6 | Lines, outlines and overlays | Screen-space width | Inverted-hull silhouette; the stencil test that keeps it outside the body | Why a hull alone shows through creases, and how the stencil fixes it | Selection outline, Wire, Grid, Axes; P: crate |
| 7 | A camera you can place, and a still image | Camera as an object; lookAt as a change of basis; tall and wide field of view | Rendering offscreen at a size; hiding overlays | Resolution, aspect, the frame | Add › Camera, 0 look through, Render still; P: island-flythrough |

### 4. Interacting with 3D: how a modelling tool works (7)

| # | Lesson | Maths | Algorithm | Graphics | MeshLab |
|---|---|---|---|---|---|
| 1 | Picking by ray | The ray from the mouse through the inverse projection | Ray–triangle intersection (Möller–Trumbore) | Hover highlight | Click-select objects, faces |
| 2 | Picking in screen space | Distance from a point to a segment | Nearest vertex or edge on screen | Why thin things need a pick radius | Vertex / edge select, bones |
| 3 | Box and loop selection | Point-in-rectangle after projection; edge loops through quads | Box select; the loop walk (straight on at 4-edge vertices, stop at poles) | Selection colours | B box select, Alt+click loop select |
| 4 | Dragging with a gizmo | Projecting mouse motion onto an axis or plane | Axis and plane constraints; snapping to the grid | Gizmo drawing | G/R/S, X/Y/Z, Snap |
| 5 | The knife | A screen line is a plane through the eye; plane–edge intersection | Split faces crossed twice; share edge vertices so no cracks | Front faces only, or through with X-ray | K Knife |
| 6 | Undo and redo | State as a value | Snapshots and the command pattern; the redo stack | — | Ctrl+Z / Ctrl+Shift+Z, one undo per operation |
| 7 | Every click is code | Serialising actions | The GUI → code recorder | — | Script › GUI → code log |

### 5. Modelling operations (9)

| # | Lesson | Maths | Algorithm | Graphics | MeshLab |
|---|---|---|---|---|---|
| 1 | Extrude | Offsetting along a normal | Copy the region, build walls on its boundary edges; one normal per region | Shading of the new walls | E; P: crate |
| 2 | Inset | Offsetting a polygon inwards; mitres | Per face and as a region | Support for bevels and panels | I, Inset individual; P: crate |
| 3 | Edge rings and loop cuts | Walking opposite edges of quads | Ring traversal; splitting | Edge flow | Ctrl+R Loop cut; P: character-model |
| 4 | Bevel | Sliding corners along edges; Bézier profiles | Strips, corner patches, fans | Catching highlights on edges | Ctrl+B, segments; P: crate, dining-set |
| 5 | Dissolve and delete | Keeping the shape while merging faces | Merging faces across an edge; removing vertices | n-gons and how they are drawn | Ctrl+X Dissolve, Delete |
| 6 | Merge and smooth vertices | Averages; Laplacian smoothing as one step | Merge at centre; neighbour average | — | Merge at centre, Smooth vertices |
| 7 | Mirror and modifiers | Reflection matrices | A non-destructive modifier stack; welding on the mirror plane | The cage versus the evaluated mesh | Mirror modifier, Apply modifiers; P: character-model |
| 8 | Box modelling a character | Topology planning | A sequence of operations | Silhouette | P: character-model |
| 9 | Clean topology | Quads, poles, n-gons | Measuring valence | How topology affects shading and deformation | P: support-loops |

### 6. Subdivision (5)

| # | Lesson | Maths | Algorithm | Graphics | MeshLab |
|---|---|---|---|---|---|
| 1 | Corner cutting | Chaikin in 2D; limit curves | Repeated averaging | Smooth curves from coarse ones | notebook |
| 2 | Catmull–Clark | Face, edge and vertex points; (F̄ + 2R̄ + (n−3)V)/n | One subdivision step with the edge table | Smooth-shaded result | Subdivide smooth; P: predict-catmull-clark |
| 3 | Extraordinary vertices and limits | Valence ≠ 4; limit positions | Levels and cost (×4 faces a level) | Pinching near poles | Subdivision modifier levels |
| 4 | Keeping edges sharp | Support loops pull the limit surface | Adding loops, measuring volume | Hard-surface looks | P: support-loops; C: keep-it-a-box |
| 5 | Subdividing UVs | Catmull–Clark on a UV mesh; affine reproduction; boundaries kept | UV vertices = same vertex and same UV; seams as boundaries | Texture distortion on the smoothed surface (1.49 → 1.32 mean on a sphere) | Subdivision modifier › Smooth UVs |

### 7. Geometry on a surface: discrete differential geometry (8)

| # | Lesson | Maths | Algorithm | Graphics | MeshLab |
|---|---|---|---|---|---|
| 1 | Fields on a mesh and colour maps | A value per vertex; interpolation | Mapping values to colours (turbo, cool-warm) | Vertex colours | Heat map › Height (y), the legend |
| 2 | The Laplacian | Umbrella average to cotan weights | Sparse matrix assembly | — | P: smoothing |
| 3 | Mean curvature | Laplacian of position | Per-vertex H with the mixed area | Heat map | Heat map › Mean curvature (H); P: curvature-gallery |
| 4 | Gaussian curvature | Angle defect; Gauss–Bonnet | Summing angles | Heat map | Heat map › Gaussian curvature (K) |
| 5 | Sparse linear systems | Symmetric positive-definite systems | Conjugate gradients; iteration counts | — | Trace iteration counts; P: knot-distance |
| 6 | Distance on a surface | The heat method: diffuse, normalise, solve | Two sparse solves | Contour lines | Heat map › Distance from selected vertices; P: knot-distance; C: farthest-point |
| 7 | Smoothing as heat flow | Implicit versus explicit steps; shrinkage | Implicit smoothing | Before and after | Smooth vertices; P: smoothing |
| 8 | Level sets and contours | Marching along edges | Contour extraction per triangle | Contour lines | Contours on any heat map (link: Mesh Engine thresholds) |

### 8. UVs (6)

| # | Lesson | Maths | Algorithm | Graphics | MeshLab |
|---|---|---|---|---|---|
| 1 | What UVs are | A map from the surface to the plane | Per-corner attributes (wedges) | Texture lookup | UV tab, checker texture |
| 2 | Seams and charts | Cutting a surface into discs | Charts by BFS across non-seam edges | Visible seams | Mark seam, Seams from sharp; C: six-squares |
| 3 | Projection | Planar and cylindrical maps | Project from above | Stretching on steep faces | Project from above; P: island |
| 4 | Conformal maps and LSCM | Cauchy–Riemann, least squares, pins | Sparse CG solve per chart | Checker squares stay square | Unwrap (LSCM); P: unwrap-basics |
| 5 | Measuring distortion | Singular values σ₁/σ₂ of the 2×2 Jacobian | Per-triangle SVD | Distortion heat map | Angle distortion heat map |
| 6 | Straighten and pack | Minimal bounding box (rotating calipers) | Shelf packing | Texel density | The UV layout; P: dining-set |

### 9. Shading and textures (7)

| # | Lesson | Maths | Algorithm | Graphics | MeshLab |
|---|---|---|---|---|---|
| 1 | Light and the cosine law | Lambert, irradiance | Per-pixel N·L | The fragment shader | Shader model: Lambert; P: shader-gallery |
| 2 | Highlights | Phong, Blinn–Phong, the half vector | Specular exponent | Shininess | Blinn–Phong, Shininess |
| 3 | Physically based shading | Microfacets, Fresnel, energy conservation | GGX, Smith, Schlick | Roughness and metalness | PBR model |
| 4 | Stylised shading | Quantising light | Toon bands | Outlines with toon | Toon model |
| 5 | Debug views | Normals and UVs as colours | Encoding vectors in RGB | Finding bad normals and UVs | Normals and UV shader models |
| 6 | Procedural textures | Periodic functions, noise | Checker, grid, bricks, wood, grass | Texture scale, repeating | Texture choices; P: dining-set, island |
| 7 | Write a shader | GLSL, colour space and tone mapping | Compiling; mapping error lines | Shader errors | Custom GLSL (C: toon shader, new) |

### 10. Animation (7)

| # | Lesson | Maths | Algorithm | Graphics | MeshLab |
|---|---|---|---|---|---|
| 1 | Keyframes | Piecewise functions of time | Sampling keys at a frame | Redrawing per frame | I to key, the Timeline; P: bouncing-ball |
| 2 | Interpolation and easing | Linear, ease-in/out; s = t² for gravity | Easing functions | Motion that reads as weight | Interpolation per key; C: land-on-20 |
| 3 | Quaternions | Rotations on the 4D unit sphere | Euler ⇄ quaternion | — | Rotation mode |
| 4 | Slerp | Great-circle interpolation, constant speed | Slerp and its shortest-path sign | Smooth turns | P: euler-vs-slerp |
| 5 | Motion through a hierarchy | Composition over time | Baking world motion into keys | Motion paths | P: robot-arm, island-flythrough (a camera keyed with lookAt and slerp) |
| 6 | A walk cycle | Contact, down, passing, up; loops | Cyclic keys | Foot sliding | P: walk-cycle |
| 7 | Animation in files | Channels and samplers | Writing a glTF animation clip | Playback elsewhere | Export GLB with animation |

### 11. Rigging and skinning (8)

| # | Lesson | Maths | Algorithm | Graphics | MeshLab |
|---|---|---|---|---|---|
| 1 | Bones | The bone's frame, from its head, tail and roll | Rest matrix B | Drawing bones | Add › Armature, bones mode (Tab), E extrude |
| 2 | Posing | Posed P, skin S = P·B⁻¹ | Walking the bone chain | Pose mode | Ctrl+Tab pose; P: tentacle |
| 3 | Roll and editing joints | Rotation about the bone's own axis | Moving joints together | Rest pose while editing | Bone roll, joint drag |
| 4 | Linear blend skinning | Weighted sum of matrices | Per-vertex blend on the CPU or GPU | The skinning vertex shader | Bind to armature; P: walk-and-wave |
| 5 | Automatic weights | Heat diffusion from bones | A sparse solve per bone; limits and normalising | Weight heat map | Heat map › Bone weights |
| 6 | Weight painting | Brush falloff (1 − (d/r)²)²; normalising | Dabs, mirror by bone name | Painting in the viewport | Weight paint mode; P: fix-a-bad-rig; C: fix-the-chest |
| 7 | The candy wrapper and dual quaternions | Dual numbers; blending rigid motions | DQS | Volume kept at twisting joints | Skin panel › Blend; P: candy-wrapper |
| 8 | Skins in files | Four influences per vertex | Limiting and renormalising; glTF skins | Skinned mesh on the GPU | Limit to 4 bones, Export GLB |

### 12. Modelling by code (5)

| # | Lesson | Maths | Algorithm | Graphics | MeshLab |
|---|---|---|---|---|---|
| 1 | The scene API | — | Building meshes from lists and primitives | — | Script panel; P: island; C: staircase |
| 2 | Parametric surfaces | Surfaces of revolution; tubes along curves | Generating grids of vertices and quads | Normals from parameters | P: knot-distance, python-vase |
| 3 | Python in the browser | — | Pyodide; bridging two languages | — | Python scripts; P: python-vase |
| 4 | Recording algorithms | Instrumentation | How traces and Predict questions are made | Showing a trace in the viewport | Record traces, Algorithm trace |
| 5 | A capstone model | All of the above | Plan, script, check | Render a still | A capstone challenge (new) |

## MeshLab tool coverage

Every MeshLab tool is taught in at least one lesson. When a tool is added to MeshLab, add a row here and a
place in a lesson.

| MeshLab | Taught in |
|---|---|
| File: New, Open, Save | 1.7 (as data formats), 12.1 |
| File: Import OBJ/glTF, Export OBJ, Export GLB | 1.7, 10.7, 11.8 |
| Edit: Undo, Redo | 4.6 |
| Edit: Duplicate, Delete, Select all | 5.5, 4.3 |
| Edit: Select linked | 1.4 |
| Add: primitives, Empty, Armature | 12.1, 2.5, 11.1 |
| Mesh: Extrude, Inset (region), Inset individual | 5.1, 5.2 |
| Mesh: Bevel edges | 5.4 |
| Mesh: Loop cut | 5.3 |
| Mesh: Subdivide faces, Subdivide smooth | 6.1, 6.2 |
| Mesh: Merge at centre, Smooth vertices | 5.6, 7.7 |
| Mesh: Flip normals | 1.2 |
| Mesh: Fill (F) | 1.6 |
| Mesh: Dissolve, Delete | 5.5 |
| UV: Mark seam, Clear seam, Seams from sharp | 8.2 |
| UV: Unwrap (LSCM), Project from above | 8.4, 8.3 |
| UV: Angle distortion heat map, UV layout | 8.5, 8.6 |
| Heat map: distance, H, K, height, bone weights | 7.6, 7.3, 7.4, 7.1, 11.5 |
| Object: Edit mode, Shade smooth/flat | 1.1, 3.5 |
| Object: Mirror and subdivision modifiers, Apply | 5.7, 6.3 |
| Object: Clear parent | 2.5 |
| Object: Insert keyframe, Clear animation | 10.1 |
| Object: Bind, Unbind, Pose mode, Clear pose | 11.4, 11.2 |
| View: Frame, Front/Right/Top, Perspective | 3.1, 3.2 |
| Add: Camera, Camera from this view; View: Look through, Align camera, Render still; Inspector: Camera | 3.7, 10.5 |
| Toolbar: Move, Rotate, Scale, Local axes, Snap | 2.2, 2.6, 4.4 |
| Toolbar: Grid, Axes, Normals, Wire, X-ray | 3.6, 1.2, 1.3, 3.4 |
| Toolbar: Record traces | 12.4 (and part 3 of most lessons) |
| Inspector: transform, matrices, expressions, material | 2.2–2.4, 2.8, chapter 9 |
| Outliner: parenting by drag | 2.5 |
| Timeline: keys, interpolation, playback | 10.1, 10.2 |
| UV tab | chapter 8 |
| Shader tab: models, textures, custom GLSL | chapter 9 |
| Script tab: JavaScript, Python, Step through | 12.1–12.3 |
| GUI → code log | 4.7 |
| Algorithm trace, Predict mode | 12.4 (and part 3 of most lessons) |
| Weight paint mode: brush, mirror, normalise | 11.6 |
| Bones mode: select, drag joints, extrude, roll | 11.1, 11.3 |
| Skin panel: blend method, limit influences | 11.7, 11.8 |
| Examples and challenges gallery; guide steps that tick | every lesson's part 4 |
| Edit: Select loop (Alt+click) | 4.3 |
| Mesh: Knife (K) | 4.5 |
| Subdivision modifier: Smooth UVs | 6.5 |

## MeshLab work before the lessons

These are the open items in `docs/meshlab-status.md`, which lessons 3.7, 4.3, 4.5 and 6.5 depend on:

1. ~~More challenges, one per project group, and guides whose steps tick themselves.~~ Done 2026-09-30, along with Fill (F).
2. ~~A camera object; a fly-through of the island; rendering a still to a PNG.~~ Done 2026-09-30.
3. ~~Knife and loop select; the outline showing through concave creases; UV smooth.~~ Done 2026-09-30.

Also needed by lessons:
- `?example=<id>` links, which load a script example.
- The challenges marked "new" in the tables above. They are made alongside their lessons, not in advance.

## How lessons are built and checked

**Conventions, from lesson 1.1:**
- **Notebook:** a `JSNotebook` visualization, with `props: { lesson: { title, subtitle, cells } }`. Its cell types
  are `js`, `challenge` (with `check`, `solutionCode`) and `markdown`.
- **Picture cells:** each loads three.js with a dynamic `import()` from jsDelivr, because a cell runs as a
  classic script inside a sandboxed iframe. The shared drawing code is one string, appended to each cell.
- **Challenge checks:** read the learner's answer from the code without running it, and name what is wrong.
  The tests in `src/courses/modelling-geometry/lessons.test.js` check each kind of mistake, and check that
  console-only cells print what the prose says. They also check that every MeshLab link names a real project or
  challenge.
- **Bridge callouts:** the app adds generic "Bridge: …" callouts (`unifiedLessonEnhancer.js`) to any lesson
  without its own, and the rigor one talks about driving analytics. Each lesson therefore writes its own three,
  with the same titles.
- **Links:** in-app links in lesson prose (`#/lab/...`) open in the same tab (`MarkdownProse.jsx`).
- **Numbers in the text:** every numeric claim is computed by a cell or checked against MeshLab's tested code.
  The course test proves the cells print what the text says.

**Each lesson:**
- Run `node scripts/validate-lesson-schema.mjs`, `node scripts/check_js_cells.mjs --files` and
  `node scripts/check_latex.mjs --files`.
- Run `npx vitest run src/courses/modelling-geometry`.
- **Open it in a browser:** run every cell, and follow the MeshLab link.
- After adding lessons, run `npm run facts`.

**Files:** `src/courses/modelling-geometry/<N>-<chapter>/<NNN>-<slug>.js`. Lesson ids are unique across all
courses and never change once published.

## Progress

| Lesson | File | State |
|---|---|---|
| 1.1 A mesh is two lists | `src/courses/modelling-geometry/1-meshes-as-data/001-vertices-and-faces.js` | Built; checked in the browser. Gets a part 3 once lesson 1.2 fixes the pattern. **Open:** its `semantics` symbols are written `$…$`, but the semantics list passes the symbol straight to KaTeX, so 6 show as errors (`$v_i$`, `$n$`, `$f = …$`, `$|f|$`, `$\deg(v)$`, `$M = (V, F)$`); drop the dollars and put words in `\text{…}`. Left for the user, who reviews old lesson files |
| 1.2 Winding and normals | `src/courses/modelling-geometry/1-meshes-as-data/002-winding-and-normals.js` | Built; checked in the browser (cells, pictures, graded check, both MeshLab links). Notebook pictures use `notebookScene.js` (`withPicture`); notebook cell text does not render `$…$` maths, so cells use plain numbers |
| 1.3 Edges and neighbours | `src/courses/modelling-geometry/1-meshes-as-data/003-edges-and-neighbours.js` | Built; checked in the browser. MeshLab gained a traced edge-table build (`EditMesh.edgeTable`, `mesh.edgeTable()` in scripts), Edit › Select non-manifold (Shift+Ctrl+Alt+M) and edge counts in the status bar. Notebook checks share `faceList.js` (`readFaces`, `edgeTable`) |
| 1.4 Connected pieces | `src/courses/modelling-geometry/1-meshes-as-data/004-connected-pieces.js` | Built; checked in the browser. MeshLab gained `EditMesh.pieces` (traced breadth-first search; `mesh.pieces()` in scripts); Select linked in face select now follows shared edges (it used to follow shared vertices, as vertex and edge select still do). The notebook picture helper colours faces by piece (`groups`) |

## Size

About 70 lessons, which is **12–18 agent sessions** at 4–6 lessons a session. Before that come about 2–3
sessions of MeshLab work.

The bottleneck is verification, not writing. Every cell has to be run, every number tested, and every lesson
opened in a browser. The notebook-only software rasterizer (3.3) and the knife (4.5) are the largest single
pieces.

## Open questions for review

1. **Name.** The scope is now wider than modelling. Working title: "3D Modelling, Geometry & Graphics". The
   folder and id stay `modelling-geometry`, because lesson 1.1's id already uses it. Only the label shown to
   learners changes.
2. **Order.** Chapter 3 (rendering) and chapter 4 (interaction) could come before chapter 2 for someone who
   wants to see the screen side first. As written, the maths of transforms comes first, because both depend
   on it.
3. **Python.** Notebooks are in JavaScript, because three.js runs natively. Should some lessons also offer a
   Python version (MeshLab runs both)?
4. **Depth of proofs.** Give short proofs in full (Euler's formula, Gauss–Bonnet on a polyhedron). For long
   ones (the heat method's convergence, LSCM's optimality), state them and check them with numbers.
