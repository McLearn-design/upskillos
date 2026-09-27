const note = (lines, title, detail) => ({ lines, title, detail })

// These walkthroughs keep the original quick-reference snippets useful as
// lessons. Each note points to the exact lines it explains instead of merely
// restating what the finished snippet accomplishes.
export const CORE_SNIPPET_WALKTHROUGHS = {
  'euler-step': [
    note('1–2', 'Integrate acceleration into velocity', 'Multiplying acceleration by elapsed seconds produces the change in velocity for this frame.'),
    note('3–4', 'Integrate velocity into position', 'The updated velocity advances position, making this the more stable semi-implicit form of Euler integration.'),
  ],
  rk4: [
    note('1–2', 'Sample the current slope', '`k1` records velocity and acceleration at the beginning of the time interval.'),
    note('3–4', 'Test two midpoint estimates', '`k2` and `k3` use half steps, with the second midpoint correcting the first.'),
    note('5', 'Sample the predicted endpoint', '`k4` checks the slope after a full step based on the last midpoint estimate.'),
    note('6–9', 'Blend the four samples', 'The 1:2:2:1 weighted average cancels much of Euler’s local error for smooth differential equations.'),
  ],
  'spring-force': [
    note('1', 'Set physical parameters', '`k` controls stiffness, `b` controls damping, and `rest` is the equilibrium position.'),
    note('2', 'Add restoring and damping forces', 'The spring term opposes displacement; the damping term opposes motion. Their sum is the net one-dimensional force.'),
  ],
  'gravity-two-body': [
    note('1–3', 'Measure the separation vector', 'Subtract positions for direction, then use its Euclidean length as center-to-center distance.'),
    note('4', 'Apply the inverse-square law', 'Masses strengthen attraction while squared distance weakens it rapidly.'),
    note('5', 'Turn magnitude into components', 'Dividing displacement by distance creates a unit direction, then multiplying by force produces x/y force.'),
  ],
  bounce: [
    note('1–2', 'Detect and correct penetration', 'The radius is 0.3, so its center cannot fall below y=0.3. Correction prevents repeated sinking.'),
    note('3', 'Reverse and reduce normal velocity', 'The minus sign changes direction and restitution 0.75 retains 75% of the incoming speed.'),
  ],
  'canvas-clear': [
    note('1', 'Choose the replacement color', 'Canvas drawing state stores this fill style until another value replaces it.'),
    note('2', 'Cover every retained pixel', 'Canvas is immediate-mode but persistent: old pixels remain until this rectangle paints over them.'),
  ],
  'canvas-circle': [
    note('1', 'Start an independent path', 'Without `beginPath`, the new arc could join and refill geometry left from earlier drawing.'),
    note('2', 'Describe a full revolution', 'The center and radius set position and size; 0 through 2π traces the complete circumference.'),
    note('3–4', 'Choose paint and rasterize', '`fillStyle` configures the brush while `fill` converts the current path into pixels.'),
  ],
  'canvas-line': [
    note('1–3', 'Describe one segment', '`moveTo` positions the path cursor and `lineTo` adds geometry from that point to the endpoint.'),
    note('4–6', 'Configure and render the stroke', 'Color and width are context state; `stroke` finally rasterizes the path outline.'),
  ],
  'canvas-dashed': [
    note('1', 'Set the dash pattern', 'The array alternates six painted pixels with four skipped pixels along every stroked subpath.'),
    note('2–5', 'Build and stroke normally', 'Dash behavior changes presentation, not path geometry.'),
    note('6', 'Restore a solid line', 'Canvas state persists, so resetting prevents unrelated later paths from inheriting dashes.'),
  ],
  'canvas-grid': [
    note('1–2', 'Define spacing and appearance', 'One shared step keeps horizontal and vertical cells square.'),
    note('3–5', 'Generate vertical lines', 'Increment x while spanning the full canvas height.'),
    note('6–8', 'Generate horizontal lines', 'Increment y while spanning the full canvas width.'),
  ],
  'canvas-axes': [
    note('1', 'Place a mathematical origin', 'Half width and half height locate the visual center of the canvas.'),
    note('2', 'Configure both axes once', 'The two following strokes share color and width.'),
    note('3–4', 'Draw horizontal and vertical basis lines', 'Each independent path crosses the origin and spans one full viewport dimension.'),
  ],
  'three-sphere': [
    note('1–4', 'Pair shape with shading', 'SphereGeometry supplies vertices and normals; MeshPhongMaterial determines how lights color those vertices.'),
    note('5', 'Enter the scene graph', 'A mesh is not rendered until it is reachable from `scene`.'),
  ],
  'three-box': [
    note('1–4', 'Build a renderable mesh', 'BoxGeometry describes six faces while MeshStandardMaterial uses physically based lighting parameters.'),
    note('5', 'Attach it to the world', 'Adding the mesh lets scene traversal include it in render calls.'),
  ],
  'three-trail': [
    note('1–2', 'Store a bounded position history', 'A new Vector3 freezes the current position; removing the oldest point prevents unbounded growth.'),
    note('3', 'Remove the previous render object', 'The old line must leave the scene before its replacement is added.'),
    note('4–7', 'Rebuild geometry through the samples', '`setFromPoints` writes the position buffer and LineBasicMaterial gives the connected path a constant screen-space stroke.'),
    note('8', 'Display the replacement', 'The new line becomes visible on the next render.'),
  ],
  'three-light': [
    note('1', 'Configure source color, power, and reach', 'A point light radiates in every direction; the distance value limits its influence.'),
    note('2', 'Place the emitter', 'Lighting depends on the world-space vector from each surface point to this position.'),
    note('3', 'Include it in lighting traversal', 'The renderer only evaluates lights attached to the scene.'),
  ],
  'three-grid': [
    note('1', 'Create a visual scale reference', 'The arguments mean 40 world units, 20 divisions, then center-line and ordinary-line colors.'),
  ],
  'math-clamp': [
    note('1', 'Apply upper and lower bounds', 'The inner minimum caps values above `hi`; the outer maximum raises values below `lo`.'),
  ],
  'math-lerp': [
    note('1', 'Scale the interval from a to b', '`b-a` is the full displacement. Multiplying by `t` takes a fraction of it, and adding `a` restores the correct origin.'),
  ],
  'math-polar': [
    note('1', 'Project radius horizontally', 'Cosine is the x component of a unit direction at `theta`; radius scales it.'),
    note('2', 'Project radius vertically', 'Sine supplies the matching y component, placing the point on a circle of radius `r`.'),
  ],
  'math-normalize': [
    note('1–2', 'Measure length safely', 'Hypotenuse returns vector magnitude. Falling back to one prevents a divide-by-zero result for the zero vector.'),
    note('3', 'Remove magnitude', 'Dividing both components by the same length preserves direction and produces unit length.'),
  ],
  'math-rotate': [
    note('1–2', 'Evaluate the rotation basis', 'Cosine and sine are reused across both output components.'),
    note('3', 'Multiply by the 2×2 matrix', 'The returned components are exactly `[c −s; s c] × [x; y]`.'),
  ],
  'math-matrix4': [
    note('1', 'Create the neutral transform', 'Identity has ones on the diagonal and zeros elsewhere, leaving every homogeneous point unchanged.'),
  ],
}
