# UpSkillOS 3D Graphics & Modeling Laboratory

## 0. Mission

Build a browser-based, Blender-inspired **3D graphics, modeling, mathematics, and programming laboratory** inside UpSkillOS.

This is NOT a toy 3D viewer.

This is NOT a demo containing three primitives with drag/rotate/scale controls.

This is NOT a simplified Blender clone whose purpose is to imitate Blender's entire feature set.

The goal is to create a serious educational 3D authoring environment where a learner can:

- create and manipulate 3D geometry
- inspect geometry at the vertex/edge/face level
- model objects
- draw curves and profiles
- edit meshes
- transform objects
- understand coordinate systems
- inspect vectors and matrices
- understand normals
- experiment with lighting
- create materials
- write shaders
- animate objects
- write JavaScript/TypeScript to generate and modify scenes
- eventually write Python against the same conceptual scene API
- build procedural geometry
- experiment with graphics mathematics
- save projects
- export finished 3D projects
- use the environment as a laboratory for lessons in UpSkillOS

The application should feel like a **small DCC application crossed with a graphics programming laboratory**.

Three.js is the rendering foundation.

The important distinction is:

> Three.js should be the graphics engine underneath the application, not the application's user-facing abstraction.

The learner should be able to descend from:

```text
3D object
    ↓
mesh
    ↓
geometry
    ↓
vertices / edges / faces
    ↓
vectors
    ↓
matrices
    ↓
GPU buffers
    ↓
shaders
    ↓
pixels
```

The application should make those layers observable.

---

# 1. First Principle: Build the Application, Not a Demo

The current implementation direction is incorrect if it consists primarily of:

- three primitives
- click-and-drag
- rotate
- scale
- a basic canvas
- a few buttons

That is insufficient.

Do not continue adding random tools to a toy implementation.

First establish the underlying architecture and editor model.

The application needs to be designed so additional functionality can be added without rewriting the viewport or scene system.

---

# 2. Core Application Layout

The default application should have a DCC-style layout.

Conceptually:

```text
┌────────────────────────────────────────────────────────────────────┐
│ File  Edit  Add  Object  Mesh  View  Create  Script  Learn        │
├───────────────┬──────────────────────────────────┬─────────────────┤
│               │                                  │                 │
│ SCENE         │                                  │ INSPECTOR       │
│               │                                  │                 │
│ Camera        │                                  │ Object          │
│ Light         │             3D VIEW              │ Transform       │
│ Cube          │                                  │ Geometry        │
│ Sphere        │                                  │ Material        │
│               │                                  │                 │
│               │                                  │                 │
├───────────────┴──────────────────────────────────┴─────────────────┤
│ TOOL / STATUS / INFORMATION                                       │
├───────────────────────────────────────────────────────────────────┤
│ SCRIPT / CONSOLE / OUTPUT                                        │
├───────────────────────────────────────────────────────────────────┤
│ TIMELINE                                                          │
└───────────────────────────────────────────────────────────────────┘
```

The exact UI technology is flexible.

The conceptual separation is not.

The application must have:

1. Scene hierarchy
2. 3D viewport
3. Tool system
4. Inspector/properties
5. Editor/console
6. Timeline
7. Status/information area

Panels should be independently extensible.

---

# 3. Scene System

The application needs an actual scene model.

Do not make the UI directly manipulate random Three.js objects everywhere.

Create an application-level scene representation.

At minimum:

```text
Project
 └── Scene
      ├── Camera
      ├── Lights
      ├── Objects
      │    ├── Transform
      │    ├── Geometry
      │    ├── Material
      │    └── Metadata
      └── Animation
```

Every object should have:

- unique ID
- name
- parent
- children
- transform
- visibility
- selectable state
- geometry reference where applicable
- material reference where applicable

Use a scene graph.

Parent/child transforms must work.

Example:

```text
Robot
 ├── Body
 ├── Head
 │    ├── EyeLeft
 │    └── EyeRight
 └── Arm
      └── Hand
```

Moving `Robot` must move its children.

This is essential for teaching hierarchical transformations.

---

# 4. Transform System

Objects must support:

- translation
- rotation
- scale
- local/world coordinate systems
- transform gizmos
- numeric editing
- snapping
- pivot/origin concepts

Provide standard DCC-style transform interaction.

The learner should be able to:

- click an object
- move it
- rotate it
- scale it
- constrain movement to X/Y/Z
- switch local/world coordinates
- change the pivot
- type exact values

Example:

```text
Transform

Position
X  10.000
Y   0.000
Z   5.000

Rotation
X   0°
Y  45°
Z   0°

Scale
X 1
Y 1
Z 1
```

Do not make dragging the primary or only interaction.

Numeric precision matters because this is also a mathematics environment.

---

# 5. Coordinate-System Visualization

The application must explicitly support visualizing:

- world axes
- object/local axes
- camera axes
- normals
- bounding boxes
- origins/pivots
- grid
- optional floor/grid planes

The learner must be able to see the difference between:

```text
world coordinates
local coordinates
camera coordinates
screen coordinates
```

This distinction is fundamental to graphics programming.

---

# 6. Primitive Creation

Provide an Add/Create menu.

At minimum:

```text
Mesh
 ├── Cube
 ├── Sphere
 ├── Cylinder
 ├── Cone
 ├── Torus
 ├── Plane
 └── Custom

Curve
 ├── Line
 ├── Polyline
 ├── Bezier
 └── Circle
```

Primitive parameters should be editable.

For example:

```text
Sphere

Radius       10
Segments     32
Rings        16
```

Do not permanently treat primitives as opaque objects.

The learner must eventually be able to inspect the generated mesh.

---

# 7. Mesh Editing

This is one of the most important requirements.

The application needs an actual mesh editing mode.

Selection modes:

```text
Object
Vertex
Edge
Face
```

When in Edit Mode:

- display vertices
- display edges
- display faces
- select individual elements
- multi-select
- box select
- deselect
- select connected elements

Basic operations:

```text
Move vertex
Move edge
Move face
Extrude
Inset
Bevel
Merge
Delete
Dissolve
Subdivide
Triangulate
```

Do not implement these as visual tricks.

They must modify the underlying mesh data.

---

# 8. Mesh Data Must Be Inspectable

Selecting a mesh should allow the learner to inspect:

```text
Vertices
Edges
Faces
Triangles
Normals
UV coordinates
Attributes
```

For example:

```text
VERTEX 17

Position
X = 2.000
Y = 4.000
Z = 1.500

Normal
X = 0.000
Y = 1.000
Z = 0.000

UV
U = 0.25
V = 0.75
```

The learner should be able to understand that a visible object is constructed from actual data.

---

# 9. Three.js Must Not Be Hidden Forever

The application should have an inspection/developer mode.

For a selected object, expose the corresponding Three.js concepts:

```text
Object3D
Transform
Matrix4
Quaternion
BufferGeometry
BufferAttribute
Material
Texture
Camera
Light
```

For geometry:

```text
position
normal
uv
index
```

For example:

```text
geometry.attributes.position
```

should be inspectable.

Eventually the learner should be able to inspect the underlying typed arrays.

Example:

```javascript
geometry.attributes.position.array;
```

The application should teach the relationship between the high-level object and the underlying representation.

---

# 10. Mathematics Visualization

This is a first-class feature, not an afterthought.

Provide visual overlays for:

## Vectors

Show:

```text
vector origin
vector direction
vector magnitude
```

Operations should be visualizable:

```text
addition
subtraction
dot product
cross product
normalization
projection
reflection
```

Example:

```text
A
 ─────────>

B
     ───────>

A + B
 ─────────────────>
```

For dot product, show the relationship between:

```text
A · B = |A||B|cos(θ)
```

For cross product, visualize the resulting perpendicular vector.

---

# 11. Matrix Visualization

A selected object should be able to expose its transformation matrix.

Example:

```text
WORLD MATRIX

[ ... ... ... ... ]
[ ... ... ... ... ]
[ ... ... ... ... ]
[ ... ... ... ... ]
```

Allow the learner to inspect:

- translation
- rotation
- scale
- parent transformation
- world transformation
- local transformation

Eventually provide an educational explanation:

```text
vertex
  ↓
local matrix
  ↓
world matrix
  ↓
view matrix
  ↓
projection matrix
  ↓
screen
```

This is a central purpose of the application.

---

# 12. Camera Mathematics

Camera controls should not be treated as magic.

Expose:

- camera position
- target
- field of view
- aspect ratio
- near plane
- far plane
- projection matrix

Provide a visualization of:

```text
camera
   ↓
view frustum
   ↓
near plane
   ↓
far plane
```

Eventually allow learners to experiment with:

```text
perspective projection
orthographic projection
```

---

# 13. Raycasting Laboratory

The application should support visualizing rays.

When the user clicks the viewport:

```text
mouse position
      ↓
screen coordinates
      ↓
camera ray
      ↓
ray/object intersection
      ↓
triangle intersection
```

Display the ray visually.

Show:

```text
origin
direction
intersection point
surface normal
distance
```

This provides the foundation for:

- selection
- sculpting
- picking
- collision
- measurement
- graphics mathematics

---

# 14. Modeling Tools

Provide a real modeling workflow.

Required concepts:

### Extrusion

```text
face
 ↓
normal
 ↓
distance
 ↓
new vertices
 ↓
new faces
```

### Inset

```text
face
 ↓
offset boundary
 ↓
new inner face
```

### Bevel

```text
sharp edge
 ↓
offset geometry
 ↓
new faces
```

### Subdivision

```text
coarse mesh
 ↓
subdivision algorithm
 ↓
higher-resolution mesh
```

The algorithms should be implemented in application geometry code rather than delegated entirely to hidden Three.js behavior.

The learner needs to be able to inspect the transformation.

---

# 15. Curves

Support:

- line segments
- polylines
- Bezier curves
- control points
- curve editing
- curve evaluation

Expose:

```text
P(t)
```

and allow learners to inspect/evaluate points along a curve.

For Bezier curves, make the relationship between control points and the resulting curve visible.

---

# 16. Procedural Modeling

This is a major feature.

Users must be able to generate geometry using code.

Example:

```javascript
const mesh = createMesh();

for (let x = 0; x < 20; x++) {
  for (let y = 0; y < 20; y++) {
    const z = Math.sin(x * 0.3) * Math.cos(y * 0.3);
    mesh.addVertex(x, y, z);
  }
}
```

The viewport updates from the generated geometry.

This turns the environment into a computational geometry laboratory.

Support procedural examples such as:

- grids
- terrain
- waves
- spirals
- parametric surfaces
- fractals
- particle systems
- procedural structures
- L-systems
- noise
- radial patterns

---

# 17. Scripting Environment

The application needs a real code editor.

Minimum requirements:

- syntax highlighting
- execute/run
- clear output
- errors with line numbers
- access to the scene
- access to selected objects
- access to geometry
- ability to create objects
- ability to modify objects
- ability to save scripts

Example:

```javascript
const cube = scene.addCube();

cube.position.set(0, 0, 0);
cube.rotation.y = Math.PI / 4;
```

Then:

```javascript
cube.geometry;
cube.material;
cube.matrix;
```

Then lower level:

```javascript
cube.geometry.attributes.position;
```

The scripting system must operate on the same scene that the GUI operates on.

There must NOT be:

```text
GUI scene
+
separate scripting scene
```

There is one scene.

GUI and code are two interfaces to it.

---

# 18. Console

Provide a console for quick experimentation.

Example:

```text
> scene.objects.length

12

> selected.position

Vector3(10, 0, 5)

> selected.geometry.attributes.position.count

24
```

Errors must be visible.

Do not swallow exceptions.

---

# 19. Shader Laboratory

Add a shader/material experimentation area.

Start with simple materials, then expose shader code.

Learners should eventually be able to modify:

```glsl
vertex shader
fragment shader
```

Provide examples involving:

- normals
- lighting
- UVs
- time
- position
- color
- textures
- procedural patterns

Example educational progression:

```text
position
 ↓
vertex shader
 ↓
rasterization
 ↓
fragment shader
 ↓
pixel
```

---

# 20. Materials

Provide a material inspector containing:

```text
Base Color
Metalness
Roughness
Opacity
Emission
Normal Map
Texture
```

But also allow learners to see what those properties correspond to in the rendering pipeline.

Materials must not become a dead-end GUI.

---

# 21. Lighting

Support:

- ambient/environment lighting
- directional lights
- point lights
- spot lights

Allow inspection of:

```text
light position
direction
intensity
color
distance
angle
```

Visualize light direction and optionally the light's influence.

---

# 22. Normals Laboratory

This deserves its own mode.

Display:

```text
face normals
vertex normals
```

Allow learners to manipulate or regenerate normals.

Show:

```text
normal
light direction
dot(normal, light)
```

visually.

This should connect directly to the shader laboratory.

---

# 23. UV Laboratory

Support UV visualization.

Display:

```text
3D mesh
      ↕
UV coordinates
```

Provide a 2D UV editor eventually.

The learner should understand that UV coordinates map a surface to a 2D domain.

---

# 24. Animation

Provide a timeline.

Minimum:

- play
- pause
- frame navigation
- keyframes
- interpolation
- object transforms
- animation curves

Example:

```text
Frame 0       Frame 30
  ●──────────────●
  0°            360°
```

Allow procedural animation:

```javascript
cube.rotation.y = time * 2;
```

Expose `time`.

---

# 25. Sculpting

Do not attempt Blender's entire sculpting system initially.

Implement an educational sculpting system.

Basic operation:

```text
mouse
 ↓
screen coordinate
 ↓
ray
 ↓
surface intersection
 ↓
affected vertices
 ↓
distance
 ↓
falloff
 ↓
normal
 ↓
displacement
```

Start with:

- draw/push
- pull
- smooth
- flatten

The implementation should make the underlying algorithm inspectable.

---

# 26. Drawing / 2D Construction

Include a 2D drawing mode.

Tools:

- line
- polyline
- rectangle
- circle
- polygon
- Bezier
- freehand

Then support:

```text
2D profile
   ↓
curve
   ↓
extrude
   ↓
3D mesh
```

This creates a bridge between CAD-style construction and graphics programming.

---

# 27. Measurement

Add basic measurement tools.

Examples:

```text
distance
angle
radius
bounding box
```

Selecting two points should show:

```text
Distance = √(dx² + dy² + dz²)
```

Selecting two vectors should show their angle.

This is an educational environment, so the mathematical calculation should be visible.

---

# 28. Snapping

Support:

- grid snapping
- vertex snapping
- edge snapping
- face snapping
- increment rotation
- increment scale

Snapping should be implemented as reusable interaction infrastructure.

---

# 29. Selection Architecture

Selection must be a central system.

Support:

```text
object selection
vertex selection
edge selection
face selection
```

Selection state must be independent of rendering.

Do not scatter selection logic across individual components.

---

# 30. Undo / Redo

All meaningful editing operations must support:

```text
Undo
Redo
```

Do not implement this as random UI state reversal.

Create an operation/history system.

Examples:

```text
Create Object
Move Object
Rotate Object
Extrude Face
Delete Vertex
Change Material
Change Geometry
```

The system should eventually support script-generated operations as well.

---

# 31. Project System

The user must be able to save a project.

A project should contain enough information to reconstruct the scene.

Conceptually:

```text
project/
    project.json
    scene.json
    scripts/
    assets/
    textures/
    shaders/
```

The exact implementation may initially use browser storage and downloadable files.

The important requirement is:

> A project is reproducible.

Do not save only a screenshot.

---

# 32. Export

Support export of finished work.

At minimum:

```text
GLB / glTF
```

Also export project/source data.

A learner should be able to create something in UpSkillOS and take the result outside the application.

---

# 33. Learning Integration

The environment must be designed to work with UpSkillOS lessons.

A lesson should be able to:

1. open the laboratory
2. create an initial project
3. position the learner at a specific state
4. give the learner a task
5. allow code entry
6. allow GUI interaction
7. inspect the resulting state
8. verify the result
9. continue from that state

Example:

```text
Lesson:
"Understand Rotation Matrices"

Initial state:
Cube at origin.

Task 1:
Rotate cube 45° around Y.

Task 2:
Inspect matrix.

Task 3:
Change rotation to 90°.

Task 4:
Construct the matrix manually.

Task 5:
Apply it to a vertex.

Task 6:
Implement the transformation in JavaScript.
```

This is the intended educational model.

---

# 34. "Explain This" Infrastructure

The application should eventually be able to explain selected concepts.

For example, selecting a matrix can expose:

```text
WHAT IS THIS?

This is the object's world transformation matrix.

WHAT DOES IT CONTROL?

It transforms coordinates from local space
into world space.

WHAT DOES THE RAW DATA LOOK LIKE?

Matrix4

WHY DOES IT EXIST?

The renderer needs a mathematical representation
of the object's transformation.
```

This should be generated from actual application state, not hardcoded generic explanations.

---

# 35. Architecture

Use a layered architecture.

Conceptually:

```text
┌──────────────────────────────┐
│           UI                 │
│ panels / menus / inspector   │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│       Editor Systems         │
│ selection / tools / history  │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│       Scene Model             │
│ objects / meshes / materials │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│      Graphics Abstraction    │
│ Three.js adapters/rendering  │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│          WebGL/WebGPU        │
└──────────────────────────────┘
```

Do not put application logic directly inside React components.

Do not make React state the mesh data model.

Do not make Three.js objects the only source of truth.

Create clear boundaries.

---

# 36. Important Three.js Rule

Three.js should handle rendering infrastructure where appropriate.

Do not unnecessarily reinvent:

- cameras
- renderers
- GPU buffer management
- standard materials
- raycasting infrastructure
- loaders
- exporters
- controls where appropriate

But application-specific concepts should belong to UpSkillOS.

For example:

```text
Three.js:
    Mesh
    BufferGeometry
    Material
    Camera
    Renderer

UpSkillOS:
    EditorObject
    Selection
    Tool
    Command
    History
    Project
    LessonState
    Inspector
    GeometryOperation
```

---

# 37. Do Not Overengineer the First Implementation

Build vertically.

Do NOT spend weeks creating empty infrastructure for every future feature.

The first real slice should be:

```text
Create Cube
      ↓
Scene hierarchy
      ↓
Select Cube
      ↓
Move / Rotate / Scale
      ↓
Inspector
      ↓
Transform matrix
      ↓
Save project
      ↓
Run JavaScript against Cube
```

That is the first meaningful foundation.

Then add mesh editing.

Then procedural geometry.

Then materials/shaders.

Then animation.

Then sculpting.

Then advanced systems.

---

# 38. Required Development Strategy

Every feature must follow:

```text
USER ACTION
    ↓
APPLICATION STATE
    ↓
UNDERLYING DATA
    ↓
RENDERED RESULT
    ↓
INSPECTABLE RESULT
```

For example:

```text
User extrudes face
       ↓
Mesh operation
       ↓
Vertices/indices modified
       ↓
BufferGeometry updated
       ↓
Viewport changes
       ↓
Inspector reports new topology
```

Do not implement a visual approximation that bypasses the underlying model.

---

# 39. Testing

Tests are required from the beginning.

Especially test pure geometry/math operations.

Examples:

```text
Vector operations
Matrix transformations
Mesh extrusion
Mesh subdivision
Vertex manipulation
Coordinate conversion
Ray intersection
Selection
Undo/redo
Project serialization
```

Geometry algorithms should be testable without a browser viewport.

Example:

```text
extrudeFace(mesh, faceId, distance)
```

should be testable as a pure operation.

---

# 40. Performance

The application should be designed for reasonably large educational scenes.

Avoid unnecessary React rerenders for every mouse movement.

The viewport interaction loop should be independent of the React render cycle where appropriate.

Use Three.js efficiently.

Geometry updates should update only the required buffers.

Do not rebuild the entire scene every frame.

---

# 41. Visual Quality

The application should look like a serious desktop graphics application.

Do not use:

- giant colorful toy buttons
- excessive rounded cards
- simplistic demo UI
- three oversized primitive buttons
- a generic dashboard aesthetic

Use a compact professional editor layout.

Think:

```text
Blender
+
CAD editor
+
IDE
+
interactive mathematics laboratory
```

not:

```text
educational website
with a 3D canvas
```

---

# 42. The Application's Identity

The defining feature is:

> **Everything the learner sees can eventually be explained in terms of the data and mathematics underneath it.**

A cube is not merely a cube.

It is:

```text
Object
  ↓
Transform
  ↓
Mesh
  ↓
Vertices
Edges
Faces
  ↓
Attributes
  ↓
Matrices
  ↓
Camera
  ↓
Projection
  ↓
GPU
  ↓
Pixels
```

A material is not merely a color picker.

It eventually becomes:

```text
Material
  ↓
Shader
  ↓
Lighting
  ↓
Vectors
  ↓
Dot products
  ↓
Pixels
```

A sculpting brush is not merely a mouse interaction.

It becomes:

```text
Mouse
 ↓
Ray
 ↓
Intersection
 ↓
Distance
 ↓
Falloff
 ↓
Normal
 ↓
Vertex displacement
 ↓
Mesh
```

That is the educational purpose of the application.

---

# 43. Explicit Non-Goals

Do NOT initially attempt to implement:

- full Blender feature parity
- professional character rigging
- full animation production
- advanced physics
- complete compositor
- video editor
- production renderer
- every Blender modifier
- every Blender node
- every CAD operation
- professional sculpting parity

Those can be considered later.

The initial application should instead establish a deep, coherent subset.

---

# 44. First Milestone

The first milestone is NOT "three primitives work."

The first milestone is:

## A functioning miniature 3D editor

A user can:

1. create a cube
2. create a sphere
3. create a cylinder
4. see them in a scene hierarchy
5. select them
6. move them
7. rotate them
8. scale them
9. numerically edit transforms
10. switch local/world coordinates
11. see XYZ axes
12. inspect the object's transform matrix
13. enter JavaScript
14. manipulate the selected object from JavaScript
15. create an object from JavaScript
16. save the scene
17. reload the scene
18. undo/redo operations
19. export the scene as GLB/glTF

If these cannot all work coherently, do not move on to sculpting or fancy effects.

---

# 45. Second Milestone

Add real mesh editing:

```text
Object Mode
      ↓
Edit Mode
      ↓
Vertex / Edge / Face selection
      ↓
Move
Extrude
Inset
Bevel
Merge
Delete
Subdivide
      ↓
Inspect topology
```

---

# 46. Third Milestone

Add the mathematics laboratory:

```text
vectors
matrices
normals
coordinate systems
raycasting
projection
camera mathematics
```

with visual overlays.

---

# 47. Fourth Milestone

Add:

```text
procedural geometry
curves
2D drawing
measurement
```

and make them scriptable.

---

# 48. Fifth Milestone

Add:

```text
materials
textures
lighting
shaders
UVs
```

---

# 49. Sixth Milestone

Add:

```text
animation
timeline
keyframes
procedural animation
```

---

# 50. Seventh Milestone

Add:

```text
educational sculpting
advanced geometry
node-based procedural workflows
```

---

# 51. Agent Rules

When implementing this specification:

### Rule 1

Do not interpret "Blender-like" as "make a canvas with three draggable shapes."

### Rule 2

Do not build fake functionality that only changes visual appearance.

### Rule 3

Do not hardcode individual primitive behavior into the UI.

### Rule 4

Do not put the entire application into one component.

### Rule 5

Do not create disconnected systems for GUI editing and scripting.

### Rule 6

The GUI and scripting environment must operate on the same underlying scene.

### Rule 7

Prefer reusable systems over individual feature hacks.

### Rule 8

Every geometry operation should ultimately operate on actual geometry data.

### Rule 9

Every important mathematical concept should have a path to inspection.

### Rule 10

Every major feature should be usable independently of the lesson system.

### Rule 11

The application must remain useful as a standalone 3D creation environment.

### Rule 12

Do not implement future features prematurely.

Build one complete vertical slice at a time.

---

# 52. Definition of Success

A successful implementation should make this possible:

```javascript
const cube = scene.addCube({
  size: 10,
});

cube.position.set(5, 0, 0);

cube.rotation.y = Math.PI / 4;

for (const vertex of cube.geometry.vertices) {
  vertex.z += Math.sin(vertex.x);
}
```

The user should see the result immediately.

They should then be able to select the cube and inspect:

```text
Object
Transform
Matrix
Geometry
Vertices
Normals
Material
```

They should be able to enter Edit Mode and modify the actual mesh.

They should be able to save it.

They should be able to export it.

And an UpSkillOS lesson should be able to take over the same environment and teach the mathematics behind what just happened.

That is the product.

**Do not stop at primitive manipulation. Build the underlying editor and graphics laboratory architecture that makes all of the above possible.**
