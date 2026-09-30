# CAD/CAM Curriculum — Lesson Dependency Graph

How to use this file:
- Each lesson has an `id`, `depends_on` (lesson ids that must be understood first), a one-line `teaches`, and `unlocks` (what capability/lessons become reachable).
- Work top to bottom within a stage, but you don't have to finish a stage before starting the next one if you've satisfied the specific `depends_on` ids — the graph is the real order, the stages are just organization.
- Lessons 1–15 are fully spec'd in the constrained YAML format at the bottom, ready to hand to a teaching agent one at a time. The rest are graph-only until you get there; ask me to expand the next batch when you're close.
- **MVP checkpoint**: everything through Stage 8 (~lesson 70) is enough for a legitimate, honest MVP — viewport, CAD import, associative wireframe, G-code in/out, basic toolpath generation, basic machine model. Stages 9–19 are what turn that MVP into something resembling real CAM software.

---

## Stage 1 — Software Boundaries (JS/TS/build tooling as engineering instrument)

| id | title | depends_on | teaches | unlocks |
|----|-------|-----------|---------|---------|
| 1 | ES Modules as Software Boundaries | — | import/export, module scope, dependency direction | clean separation of geometry math from rendering (L11+) |
| 2 | JS Objects as Domain Data | 1 | identity vs value, references, mutation | representing Tool/Machine/Axis/Point as data (L19+) |
| 3 | Map, Set and Identity | 2 | why arrays fail for IDs/relationships | topology adjacency (L41-44), dependency graphs (L68) |
| 4 | Classes, Prototypes, Composition | 2 | data vs. behavior-on-data | choosing representation for geometry objects |
| 5 | TypeScript for Engineering Data | 2,4 | interfaces, unions, discriminated unions | typed motion commands (L58), typed machine config (L99) |
| 6 | npm and Library Boundaries | 1 | package vs runtime vs build-time | evaluating Three.js's actual scope (L12) |
| 7 | Vite and the Build Pipeline | 6 | source→module→bundle→browser | scaling to a multi-hundred-module app |
| 8 | CSS for a Graphics Application | — | viewport/panel/overlay mechanics only | building the app shell around the viewport |
| 9 | Pointer → Application Coordinates | — | pixels→NDC→ray→world | selection pipeline (L16-17) |
| 10 | Browser File APIs | — | File/Blob, drag-drop, text/binary load | client-side G-code and DXF loading (L48-50) |

## Stage 2 — Three.js as a Rendering System

| id | title | depends_on | teaches | unlocks |
|----|-------|-----------|---------|---------|
| 11 | Scene Graphs | 1 | Object3D hierarchy, local/world transform | machine/fixture/part hierarchy (L18, L25) |
| 12 | Three.js Geometry Internals | 6 | BufferGeometry, attributes, indices | knowing what Three.js is *not* giving you (CAD data) |
| 13 | Rendering a Mathematical Line | 12,22 | CAD line vs. two-vertex segment | distinguishing math geometry from render geometry everywhere after |
| 14 | Curves vs. Tessellation | 13,39 | approximating exact curves, measuring error | chord error, tolerance (L29,39) |
| 15 | Camera Mathematics | 11 | projection, ortho vs perspective | CAD-style standard views |
| 16 | Raycasting | 9,11 | mouse→ray→intersection | entity selection (L17) |
| 17 | Selection and Highlighting | 16 | app selection state vs render state | UI selection separate from data model |
| 18 | Scene Graph Transformations | 11,25 | machine→fixture→part→geometry chain | first concrete link to machine kinematics (Stage 13) |

## Stage 3 — Geometry Mathematics

| id | title | depends_on | teaches | unlocks |
|----|-------|-----------|---------|---------|
| 19 | Points and Vectors | 2 | add/subtract/scale/magnitude/normalize | everything downstream in geometry |
| 20 | Dot Product | 19 | projection, angle, perpendicularity | tool engagement math (L75), offsets (L38) |
| 21 | Cross Product | 19 | normals, orientation, frames | coordinate frames (L24), tool axis (L71) |
| 22 | Parametric Lines | 19 | P(t) = P0 + tD | extension/trim/intersection (L30-34) |
| 23 | Planes | 19,21 | plane rep, distance, intersection | machining plane logic, safe planes |
| 24 | Coordinate Frames | 21 | orthonormal basis from origin+X+Y+Z | work offsets, tool frames, all of Stage 13 |
| 25 | Transform Matrices | 24 | translation/rotation/composition/inverse | associative geometry propagation (L66) |
| 26 | Homogeneous Coordinates | 25 | why 4×4 for translation | matrix stacks used everywhere after |
| 27 | Rotation Representations | 25 | Euler vs matrix vs axis-angle vs quaternion | choosing rep per problem (kinematics, L100+) |
| 28 | Floating-Point Geometry | 19 | epsilon, approximate equality, error accumulation | robust intersection tests (L30-34) |
| 29 | Geometric Tolerances | 28 | modeling vs display vs machining tolerance | offset/trim robustness (L38), verification (L94) |

## Stage 4 — Computational Geometry

| id | title | depends_on | teaches | unlocks |
|----|-------|-----------|---------|---------|
| 30 | Point/Segment Distance | 22,29 | closest-point calc | trimming, engagement calcs |
| 31 | Segment/Segment Intersection | 22,29 | crossing/parallel/coincident/endpoint cases | polyline processing (L35) |
| 32 | Circle Geometry | 19,29 | point-on-circle, line/circle, tangent construction | arc representation (L33) |
| 33 | Arc Representation | 32,23 | center/radius/plane/start/end/direction | rendering arcs, G02/G03 (L54) |
| 34 | Arc/Line & Arc/Arc Intersection | 32,33 | tangency and intersection cases | fillet, lead-in geometry (L77) |
| 35 | Polylines | 31 | ordered segments, connectivity, length | profile/contour geometry (L76) |
| 36 | Polygon Orientation | 35 | CW/CCW, signed area | offset direction (L38), pocket boundary (L79) |
| 37 | Point-in-Polygon | 36 | containment, holes | pocket boundary detection (L79) |
| 38 | Offset Curves | 20,30,31,34,29 | normal offset, corners, self-intersection, trimming | profile (L76), pocket (L80), cutter comp (L74) |
| 39 | Curve Approximation | 14,29 | tolerance-driven tessellation | display + toolpath segmentation (L63) |
| 40 | Spatial Acceleration | 3 | bounding box/sphere, grid, BVH | collision detection (L90-93), large-scene perf |

## Stage 5 — CAD Representation

| id | title | depends_on | teaches | unlocks |
|----|-------|-----------|---------|---------|
| 41 | Mesh Topology | 12 | vertex/edge/face/triangle/adjacency | mesh-based stock (L88) |
| 42 | Geometry vs. Topology | 22,41 | curve≠edge, surface≠face | associative modeling (Stage 8) — the core idea |
| 43 | B-Rep | 42 | solid/shell/face/loop/edge/vertex | model edge extraction (L84) |
| 44 | Orientation (B-Rep) | 43 | face/edge orientation and why it matters | correct offset/normal direction on real solids |
| 45 | Tessellating CAD Geometry | 39,43 | exact geometry → triangles | STL export/import understanding |
| 46 | STEP/IGES/Native CAD | 43 | exact geometry+topology vs. tessellated | evaluating whether you need a kernel |
| 47 | Geometry Kernels (OCCT etc.) | 46 | what a kernel provides vs. what you still build | architecture decision point, not before |
| 48 | DXF as 2D Geometry Source | 10,33,35 | parsing lines/arcs/polylines from DXF | first real import pipeline |

## Stage 6 — G-code

| id | title | depends_on | teaches | unlocks |
|----|-------|-----------|---------|---------|
| 49 | Lexical Analysis of G-code | 10 | char stream → tokens → words | parser (L50) |
| 50 | G-code Parsing | 49,5 | blocks, structured (not stringly-typed) output | modal state tracking (L51) |
| 51 | Modal State | 50 | controller state persists across blocks | coordinate state resolution (L52) |
| 52 | Coordinate State | 51 | absolute/incremental, units, offsets, plane | motion interpretation (L53) |
| 53 | Motion Interpretation | 52,22 | G00/G01/G02/G03 → geometric motion | circular interpolation (L54) |
| 54 | Circular Interpolation | 53,33 | center/radius format, plane, CW/CCW, helical | canonical motion (L56) |
| 55 | G-code Execution Model | 52,53 | machine state after every block | verification against generated toolpath (L94) |
| 56 | Canonical Motion | 53,54,58 | controller syntax vs. general motion rep | CAM kernel boundary — major milestone |
| 57 | Controller Dialects | 56 | what varies vs. what normalizes | post-processing (Stage 17) |

## Stage 7 — Toolpaths

| id | title | depends_on | teaches | unlocks |
|----|-------|-----------|---------|---------|
| 58 | Toolpath Data Representation | 5,25 | rapid/linear/circular/dwell/toolchange as data, decoupled from G-code | everything in Stage 10 |
| 59 | Toolpath Rendering | 58,13 | render canonical motion directly | visualizing generated and imported paths identically |
| 60 | Toolpath Metadata | 58 | operation/tool/feed/spindle/CS attached to motion | analysis (L62), post (L145) |
| 61 | Toolpath Transformations | 58,25 | translate/rotate/mirror a toolpath | multi-part patterning, setup transforms |
| 62 | Toolpath Analysis | 58,60 | length, cut vs. rapid length, time estimate | feed optimization later (L175) |
| 63 | Toolpath Segmentation | 39,58 | one logical move → many computed segments | simulation stepping (L122) |

## Stage 8 — CAD/CAM Association (the core architectural idea)

| id | title | depends_on | teaches | unlocks |
|----|-------|-----------|---------|---------|
| 64 | Construction Geometry | 42,22 | geometry that is not model topology | your original "line extends past the edge" feature |
| 65 | Geometry References | 64,3 | associate without becoming | non-destructive CAM geometry |
| 66 | Transforming Associated Geometry | 65,25 | model moves → reference propagates | live associativity |
| 67 | Derived Geometry | 65,43 | geometry from edges/faces/intersections/projections, keeping lineage | face→region (L85) |
| 68 | Dependency Graphs | 3,65 | model→derived→operation→toolpath as a graph | regeneration (L69) |
| 69 | Regeneration | 68 | what needs recompute when a dependency changes | responsive CAM editing |
| 70 | Reference Failure | 68,69 | deleted face / changed topology / stale operation | robustness — required before this is a real MVP |

## Stage 9 — Tool and Cutting Geometry

| id | title | depends_on | teaches | unlocks |
|----|-------|-----------|---------|---------|
| 71 | Tool Geometry | 21,19 | axis/tip/diameter/corner radius/flutes | tool display, path generation inputs |
| 72 | Holder and Tool Assembly | 71,25 | full collision envelope as a transform chain | collision detection (L90-93) |
| 73 | Cutter/Path Relationship | 71,58 | TCP path vs. actual cutting geometry | cutter comp (L74) |
| 74 | Cutter Compensation Geometry | 38,73 | the offset operation underneath G41/G42 | real (not magic) comp handling |
| 75 | Cutting Engagement | 20,71 | radial/axial engagement as geometry | adaptive toolpaths (L174) |

## Stage 10 — Generate Toolpaths from Geometry

| id | title | depends_on | teaches | unlocks |
|----|-------|-----------|---------|---------|
| 76 | Profile Generation | 38,71 | closed geometry + tool → cutting path | first real "CAM operation" |
| 77 | Lead-in/Lead-out Geometry | 34,76 | approach/retract geometry | linking (L78) |
| 78 | Linking and Retracts | 77,58 | connect discontinuous cuts safely | full operation output |
| 79 | Pocket Boundaries | 36,37 | inner/outer loops, containment | pocket toolpath (L80) |
| 80 | Pocket Toolpath Generation | 38,79 | area clearance from boundary+tool | facing/pocketing family |
| 81 | Facing | 80 | simple planar clearance | — |
| 82 | Drilling | 58,71 | canned-cycle-equivalent motion, not just points | hole operations |
| 83 | Slots | 76,80 | combined profile+pocket logic | — |
| 84 | Model Edge → CAM Geometry | 43,65 | extract edge, retain source association | your "extends past model edge" workflow, concretely |
| 85 | Face → Machining Region | 43,67 | derive usable region from a face | surfacing entry point |
| 86 | Projection | 23,67 | project geometry onto a surface | 3D toolpaths (L87) |
| 87 | 3D Surface Toolpaths | 86,75 | surface eval, stepover, scallop, tolerance | Stage 19 advanced surfacing |

## Stage 11 — Stock and Verification

| id | title | depends_on | teaches | unlocks |
|----|-------|-----------|---------|---------|
| 88 | Stock Models | 41,40 | box/mesh/heightfield/voxel tradeoffs | material removal (L89) |
| 89 | Material Removal | 88,58 | simple removal simulation | verification (L94) |
| 90 | Tool/Stock Intersection | 40,72,89 | collision test tool vs. stock | — |
| 91 | Tool/Fixture Collision | 40,72 | collision test tool vs. fixture | — |
| 92 | Holder Collision | 72,40 | collision envelope vs. environment | — |
| 93 | Machine Collision | 92,18 | whole-machine collision | full simulation (Stage 15) |
| 94 | Verification | 89,55 | compare simulated result to target geometry | trustable simulation |

## Stage 12 — Machine Definitions

| id | title | depends_on | teaches | unlocks |
|----|-------|-----------|---------|---------|
| 95 | Machine as Kinematic Structure | 18,25 | joints/links/tool-workpiece, not hardcoded | Stage 13 entirely |
| 96 | Linear Axis Definition | 95 | axis vector, limits, home, vel/accel | machine config data (L99) |
| 97 | Rotary Axis Definition | 95,27 | rotation axis, pivot, limits, wrap | 4/5-axis kinematics (L104-105) |
| 98 | Machine Coordinate Frames | 24,95 | machine/workpiece/fixture/tool chain | inverse kinematics (L101) |
| 99 | Machine Configuration Data | 5,96,97 | machine defs as editable data, not code | user-buildable machines |

## Stage 13 — Kinematics

| id | title | depends_on | teaches | unlocks |
|----|-------|-----------|---------|---------|
| 100 | Forward Kinematics | 98 | axis positions → tool pose | simulation (L121) |
| 101 | Inverse Kinematics | 100,27 | desired pose → axis positions | multi-axis posting |
| 102 | 3-Axis Kinematics | 100,101 | simplest case, sanity check | — |
| 103 | 3+2 Kinematics | 102,97 | fixed rotary + 3-axis motion | — |
| 104 | 4-Axis Kinematics | 97,101 | one rotary in motion | — |
| 105 | 5-Axis Kinematics | 104 | two rotaries in motion | singularities (L108) |
| 106 | Machine Configuration Solutions | 101,105 | multiple valid axis solutions for one TCP | posting decisions |
| 107 | Rotary-Axis Limits | 97,106 | valid math ≠ physically usable | posting robustness |
| 108 | Singularities | 105 | loss of useful DOF | 5-axis path robustness |
| 109 | TCP | 71,98,101 | tool tip/orientation ↔ rotary axes ↔ machine coords | full multi-axis posting |

## Stage 14 — Machine Dynamics

| id | title | depends_on | teaches | unlocks |
|----|-------|-----------|---------|---------|
| 110 | Path Velocity | 58 | programmed path speed ≠ axis speed | axis limits (L111) |
| 111 | Axis Velocity Limits | 96,110 | per-axis vel caps | trajectory planning |
| 112 | Acceleration Limits | 111 | per-axis accel caps | trapezoidal profiles (L114) |
| 113 | Jerk | 112 | rate of accel change | S-curve profiles (L115) |
| 114 | Trapezoidal Motion Profiles | 112 | accel/const/decel velocity shape | basic trajectory planning |
| 115 | S-Curve Profiles | 113,114 | smoother jerk-limited profile | realistic sim (L121-126) |
| 116 | Coordinated Axis Motion | 100,114 | all axes arrive together | multi-axis trajectory |
| 117 | Feedrate Limiting | 111,116 | clamping to achievable feed | lookahead (L118) |
| 118 | Lookahead | 117,119 | pre-reading blocks to plan velocity | corner velocity (L119) |
| 119 | Corner Velocity | 116 | cornering without overshoot | realistic simulation |
| 120 | Trajectory vs. Geometric Toolpath | 58,116 | explicit separation of the two concepts | correct mental model for Stage 15 |

## Stage 15 — Machine Simulation

| id | title | depends_on | teaches | unlocks |
|----|-------|-----------|---------|---------|
| 121 | Animate Machine Kinematics | 100,11 | drive scene graph from axis positions | — |
| 122 | Simulate Toolpath Through Machine | 63,121 | step through segmented toolpath | full sim |
| 123 | Apply Axis Limits | 96,122 | flag overtravel | — |
| 124 | Apply Velocity Limits | 111,122 | flag infeasible feed | — |
| 125 | Apply Acceleration Limits | 112,122 | flag infeasible accel | — |
| 126 | Detect Kinematic Violations | 107,108,123-125 | combine all limit checks | reliable pre-flight check |
| 127 | Simulate Stock Removal | 89,122 | remove material as sim runs | verification pipeline |
| 128 | Simulate Machine Collision | 93,122 | collision-checked simulation | production-grade sim |

## Stage 16 — Manufacturing Systems (generality tests)

| id | title | depends_on |
|----|-------|-----------|
| 129 | 3-Axis Milling | 102,80 |
| 130 | 4-Axis Milling | 104,80 |
| 131 | Simultaneous 5-Axis Milling | 105,87 |
| 132 | B-Axis Turning | 97,81 |
| 133 | C-Axis Live Tooling | 97,132 |
| 134 | Mill-Turn | 132,133 |
| 135 | Main/Sub Spindle | 134 |
| 136 | Swiss Guide-Bushing Kinematics | 95,135 |
| 137 | Swiss Tooling Relationships | 136,72 |
| 138 | Multi-Channel Execution | 135 |
| 139 | Channel Synchronization | 138,116 |
| 140 | Part Transfer | 135,139 |
| 141 | Thread Synchronization | 139,54 |
| 142 | Wire EDM | 95 (as independent process, not milling-derived) |
| 143 | Tapered Wire Geometry | 142,23 |
| 144 | Four-Axis Wire Kinematics | 142,104 |

## Stage 17 — Post Processing

| id | title | depends_on |
|----|-------|-----------|
| 145 | Canonical Motion → Machine Language | 56,99 |
| 146 | Modal Output | 51,145 |
| 147 | Controller-Specific Syntax | 57,145 |
| 148 | Machine-Specific Coord Transforms | 98,145 |
| 149 | Tool Changes and Machine Events | 60,145 |
| 150 | Multi-Channel Post Output | 138,145 |
| 151 | Post Verification | 55,94,145 |

## Stage 18 — Advanced CAD/CAM Mathematics

| id | title | depends_on |
|----|-------|-----------|
| 152 | Parametric Curves | 22 |
| 153 | Bézier Curves | 152 |
| 154 | B-Splines | 153 |
| 155 | NURBS | 154 |
| 156 | Curve Derivatives | 152 |
| 157 | Surface Parameterization | 155 |
| 158 | Surface Normals | 157,21 |
| 159 | Curve/Surface Intersection | 157,31 |
| 160 | Surface/Surface Intersection | 157 |
| 161 | Boolean Geometry | 43,160 |
| 162 | Robust B-Rep Operations | 161,28 |
| 163 | Adaptive Tessellation | 39,157 |
| 164 | Spatial Acceleration Structures (adv.) | 40,161 |
| 165 | Robust Geometric Predicates | 28,31 |

## Stage 19 — Advanced CAM

| id | title | depends_on |
|----|-------|-----------|
| 166 | Chordal Tolerance | 39,63 |
| 167 | Path Simplification | 166 |
| 168 | Arc Fitting | 167,33 |
| 169 | Smoothing | 168,119 |
| 170 | Scallop Height | 87,157 |
| 171 | Surface-Finish Geometry | 170 |
| 172 | Tool Engagement (adv.) | 75,157 |
| 173 | Rest Material | 172,88 |
| 174 | Adaptive Toolpaths | 75,172 |
| 175 | Feed Optimization | 62,117 |
| 176 | Machine-Dynamics-Aware Toolpaths | 115,175 |

---

# Appendix: How to Expand a Lesson (read this first if context was lost)

If you're starting a new session — different chat, different model, doesn't
matter — and need lesson specs beyond what's already written below, use this
procedure. It's deterministic: following it correctly should produce a spec
equivalent to the ones already in this file, regardless of which agent runs it.

**Procedure, given a lesson's `id`:**

1. Pull that row from the dependency graph table above: `title`, `depends_on`,
   `teaches`, `unlocks`.
2. For every id in `depends_on`, confirm those lessons already have a full
   YAML spec (in this file or a session log). If any don't, expand those
   first — a lesson can't be honestly spec'd if its prerequisites are still
   just a one-line table row.
3. Fill the YAML fields in this order:
   - `assumes`: copy `depends_on` from the table.
   - `learner_already_knows`: the manufacturing/CNC concepts from the
     learner baseline (see the top of the original curriculum discussion —
     CNC programming, G-code, tooling, feeds/speeds, work offsets, Mastercam/
     GibbsCAM/PartMaker workflow) that are *directly relevant to this
     specific lesson*. Don't list the whole baseline every time — only what
     this lesson would otherwise waste time re-explaining.
   - `teach`: expand the table's one-line `teaches` into the actual list of
     sub-concepts, matching the granularity used in lessons 1–15 (roughly
     3–6 bullet points, each a concept not a sentence of prose).
   - `do_not_teach`: anything a generic tutorial would include here that
     this curriculum explicitly excludes — usually either (a) something
     from `learner_already_knows`, or (b) something that belongs to a later
     lesson id (check `unlocks` and the graph for what depends on this one).
   - `implementation`: the language/library already established by this
     point in the graph (JavaScript through ~L5, TypeScript available after
     L5, Three.js only once a lesson's table row is in Stage 2 or later and
     actually needs rendering).
   - `experiment`: one small, runnable thing — never a full feature, never
     multiple concepts at once. It should be checkable by eye or by a single
     assertion.
   - `verification`: a concrete, numeric or boolean check — never "looks
     correct" or "behaves as expected."
   - `unlocks`: copy from the table.
4. Sanity check against the Lesson Delivery Contract (separate file,
   `lesson-delivery-contract.md`): does this spec give an agent enough to
   run phases 1–5 without inventing scope? If the `experiment` can't be
   attempted from `teach` alone plus prerequisites, the spec is incomplete —
   fix it before using it.
5. Append the finished YAML block to this file, in `id` order, so the file
   stays the single source of truth and future sessions don't redo work.

**If your own codebase has diverged from what a lesson assumes** (e.g. you
chose classes over discriminated unions back in lesson 4), say so explicitly
when expanding — step 3's `implementation` and `experiment` should match your
actual code, not a hypothetical clean-room version.

This procedure is intentionally mechanical rather than clever — the goal is
that two different sessions, given the same lesson id and the same graph,
produce interchangeable specs.

---

# Fully-Specified Lessons 1–15

```yaml
id: 1
title: ES Modules as Software Boundaries
assumes: []
learner_already_knows:
  - basic JavaScript syntax
  - CNC/CAM domain knowledge (not needed for this lesson but stated for context)
teach:
  - import/export syntax
  - module scope
  - named vs default exports
  - what a "dependency direction" is and why it matters
  - circular dependencies and why they're a smell
do_not_teach:
  - basic JS syntax
  - build tooling (comes in L7)
implementation: [JavaScript]
experiment:
  - write a pure function computing distance between two points in geometry.js
  - import it into a separate render.js that draws two points and a label showing the distance
  - the two files must not know about each other's internals — geometry.js has no Three.js import
verification:
  - geometry.js runs correctly in isolation (e.g. under a plain node script or test), with zero DOM/Three.js dependency
unlocks: [11]
```

```yaml
id: 2
title: JavaScript Objects as Domain Data
assumes: [1]
learner_already_knows:
  - Tool, Machine, Axis, Point, Line, ToolpathMove as manufacturing concepts
teach:
  - object identity vs. value equality
  - references and aliasing
  - nested objects and arrays of objects
  - mutation vs. copying (shallow vs deep)
  - object lifetime in a running application
do_not_teach:
  - classes/OOP (comes in L4)
  - any application architecture
implementation: [JavaScript]
experiment:
  - represent a Tool, a Point, and a ToolpathMove as plain objects
  - write a function that "moves" a toolpath move by mutating it, and another that returns a new moved copy
  - demonstrate a bug caused by two variables referencing the same object, then fix it
verification:
  - show that mutating a shared reference affects both variables; show the copy-based version doesn't
unlocks: [3, 4, 5, 19]
```

```yaml
id: 3
title: Map, Set and Identity
assumes: [2]
teach:
  - why array indexOf/includes breaks down for entity identity
  - Map for id→object lookup
  - Set for uniqueness (e.g. selected entity ids)
  - stable identity vs. structural equality
do_not_teach:
  - full topology model (comes in Stage 5)
implementation: [JavaScript]
experiment:
  - build a small "selection set" of geometry ids using a Set
  - build an id→geometry Map and demonstrate O(1) lookup vs. array scan
verification:
  - selection toggling is idempotent (selecting twice = selected once)
unlocks: [41, 68]
```

```yaml
id: 4
title: Classes, Prototypes and Composition
assumes: [2]
teach:
  - plain data object vs. object with attached behavior
  - prototype-based method sharing
  - composition over inheritance for geometry types
do_not_teach:
  - TypeScript typing (comes in L5)
implementation: [JavaScript]
experiment:
  - represent a Line two ways: (a) plain {p0, p1} object with free functions, (b) a Line class with .length() method
  - discuss which is easier to serialize, which is easier to extend with ArcSegment/PolylineSegment
verification:
  - both representations produce identical length() results for the same input
unlocks: [5]
```

```yaml
id: 5
title: TypeScript for Engineering Data
assumes: [2, 4]
teach:
  - interfaces and type aliases
  - union types
  - discriminated unions (the "kind" tag pattern)
  - generics (minimal — just enough for e.g. Result<T>)
  - optional properties
do_not_teach:
  - advanced generic constraints, decorators, or anything beyond what's needed for motion/machine data
implementation: [TypeScript]
experiment:
  - define LinearMove, CircularMove, RapidMove as a discriminated union on a `kind` field
  - write a function that switches on `kind` and the compiler forces exhaustiveness
verification:
  - adding a new move kind and forgetting to handle it in the switch produces a compile error
unlocks: [50, 58, 99]
```

```yaml
id: 6
title: npm and Library Boundaries
assumes: [1]
teach:
  - package vs. dependency vs. version
  - runtime library vs. build-time tool
  - what "browser library" means for something like Three.js
do_not_teach:
  - Vite specifics (comes in L7)
implementation: [JavaScript]
experiment:
  - install three, inspect its package.json exports field, identify what's actually shipped to the browser vs. what's tooling
verification:
  - can state, in one sentence, what Three.js's runtime footprint is vs. its dev dependencies
unlocks: [7, 12]
```

```yaml
id: 7
title: Vite and the Browser Build Pipeline
assumes: [6]
teach:
  - source → module graph → bundle → browser
  - dev server vs. production build
  - why this matters at hundreds-of-modules scale
implementation: [JavaScript, Vite]
experiment:
  - set up a minimal Vite project with geometry.js and render.js from L1, confirm hot reload works on geometry.js changes
verification:
  - editing geometry.js updates the rendered scene without a full page reload
unlocks: []
```

```yaml
id: 8
title: CSS for a Graphics Application
assumes: []
teach:
  - viewport sizing (100vh/dvh pitfalls)
  - flex/grid for panel layout
  - absolute positioning for overlays
  - pointer-events control for click-through panels
  - CSS variables and state classes
do_not_teach:
  - visual design/aesthetics
implementation: [CSS]
experiment:
  - build a layout: full-bleed viewport, floating toolbar, right-side property panel, bottom status bar — no visual polish, just correct mechanics
verification:
  - resizing the window keeps the viewport full-bleed and panels correctly docked
unlocks: []
```

```yaml
id: 9
title: Pointer Coordinates to Application Coordinates
assumes: []
teach:
  - browser pixel coordinates
  - canvas-relative coordinates
  - normalized device coordinates (NDC)
  - camera ray construction from NDC
implementation: [JavaScript, Three.js]
experiment:
  - log all four coordinate representations for a single mouse click in a Three.js canvas
verification:
  - clicking the exact center of the canvas produces NDC (0,0)
unlocks: [16]
```

```yaml
id: 10
title: Browser File APIs
assumes: []
teach:
  - File and Blob
  - reading text (G-code, DXF) vs. binary (STL)
  - drag-and-drop file handling
  - triggering downloads
implementation: [JavaScript]
experiment:
  - drag a .nc/.txt file onto the page and print its raw text content to the console
verification:
  - a multi-line G-code file's line count matches what a text editor reports
unlocks: [48, 49]
```

```yaml
id: 11
title: Scene Graphs
assumes: [1]
teach:
  - Object3D parent/child hierarchy
  - local transform vs. world transform
  - matrixWorld and when it updates
implementation: [Three.js]
experiment:
  - build a 3-level hierarchy (machine → fixture → part), rotate the machine node, observe the part's world position change without touching the part node
verification:
  - part's world position, computed manually via matrix composition, matches Three.js's reported world position
unlocks: [15, 16, 18]
```

```yaml
id: 12
title: Three.js Geometry Internals
assumes: [6]
teach:
  - BufferGeometry structure
  - position/normal/uv attributes
  - indexed vs. non-indexed geometry
do_not_teach:
  - materials, lighting (not relevant to CAD accuracy)
implementation: [Three.js]
experiment:
  - construct a single triangle by hand via BufferGeometry (no helper geometry classes), inspect the raw attribute arrays
verification:
  - can state exactly which numbers in the attribute array correspond to which triangle vertex
unlocks: [13, 41]
```

```yaml
id: 13
title: Rendering a Mathematical Line
assumes: [12, 22]
teach:
  - the distinction between a CAD line (P(t) = P0 + tD, infinite/bounded by parameter) and a rendered line segment (two vertices)
  - why "the line" in your app should not be the same object as "the Three.js Line"
implementation: [Three.js]
experiment:
  - represent a line as {p0, direction, tMin, tMax}; write a render() function that produces a Three.js Line from it; change tMax and confirm only the render updates, the math object is unaffected until you choose to change it
verification:
  - the same math-line object can produce two different rendered lengths depending on tMin/tMax without mutating p0/direction
unlocks: [14, 59]
```

```yaml
id: 14
title: Curves vs. Tessellation
assumes: [13, 39]
teach:
  - approximating an exact curve with line segments
  - measuring chord error between the approximation and the exact curve
implementation: [JavaScript, Three.js]
experiment:
  - tessellate a circle at 3 different segment counts, compute max chord error for each, render all three overlaid
verification:
  - chord error decreases as segment count increases, matching the known formula for chord error on a circle
unlocks: [39, 45]
```

```yaml
id: 15
title: Camera Mathematics
assumes: [11]
teach:
  - projection transform
  - perspective vs. orthographic
  - view matrix / camera coordinate system
implementation: [Three.js]
experiment:
  - implement toggleable front/top/right CAD-style orthographic views plus a perspective view, switching cameras on the same scene
verification:
  - orthographic top view shows no perspective foreshortening on a known test cube; measured on-screen edge lengths match real proportions
unlocks: [16]
```
