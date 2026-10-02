// Lesson 3.7: a camera you can place, and a still image. A scene camera is an object: look-at is a change of
// basis decoded into its Rotation fields; its field of view is vertical, the wide one follows from the image's
// shape; looking through it frames that shape inside the viewport; a still is rendered off screen at a size.

const LOOK = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(3)
const f3 = (v) => v.map(r).join(', ')
const sub = (a, b) => a.map((x, i) => x - b[i]), unit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l) }
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const eye = [6, 4, 8], target = [0, 0.5, 0]
// Look-at (lesson 3.1): forward, then right and up by cross products.
const forward = unit(sub(target, eye)), right = unit(cross(forward, [0, 1, 0])), up = cross(right, forward), back = forward.map((x) => -x)
console.log('right ' + f3(right) + '   up ' + f3(up) + '   back ' + f3(back))
// The rotation with right, up and back as its COLUMNS (lesson 2.6: columns are where the object's axes go).
const R = [0, 1, 2].map((i) => [right[i], up[i], back[i]])
// Decoded as XYZ Euler angles (lesson 2.7): what the Rotation fields show.
const deg = 180 / Math.PI
const y = Math.asin(R[0][2]), x = Math.atan2(-R[1][2], R[2][2]), z = Math.atan2(-R[0][1], R[0][0])
console.log('rotation fields: ' + [x, y, z].map((a) => (a * deg).toFixed(2)).join('°, ') + '°')`;

const FOV = `// The field of view is vertical. The wide angle follows from the image's shape (aspect = width / height):
// the top edge is at tan(tall / 2) on a screen 1 away, the side edge aspect times further out.
const wide = (tall, aspect) => 2 * Math.atan(Math.tan(tall / 2 * Math.PI / 180) * aspect) * 180 / Math.PI
for (const [name, a] of [['16:9', 16 / 9], ['1:1', 1], ['4:3', 4 / 3], ['2.39:1', 2.39]]) {
  console.log(name + ': 50° tall, ' + wide(50, a).toFixed(1) + '° wide')
}`;

const FRAME = `// Looking through the camera in a 900 × 600 viewport. The render's shape is framed inside it.
function frame(W, H, renderW, renderH, fov) {
  const a = renderW / renderH, view = W / H
  // If the viewport is narrower than the render, widen the view's field of view so the render's full width fits.
  const vfov = view >= a ? fov : 2 * Math.atan(Math.tan(fov / 2 * Math.PI / 180) * a / view) * 180 / Math.PI
  const fw = view >= a ? H * a : W, fh = view >= a ? H : W / a
  return 'frame ' + fw.toFixed(1) + ' × ' + fh.toFixed(1) + ', bars ' + ((W - fw) / 2).toFixed(1) + ' left and right, ' + ((H - fh) / 2).toFixed(1) + ' top and bottom; the view uses ' + vfov.toFixed(1) + '° tall'
}
console.log('1280 × 720 render: ' + frame(900, 600, 1280, 720, 50))
console.log('1080 × 1080 render: ' + frame(900, 600, 1080, 1080, 50))`;

const STILLS = `// Two stills from the same camera, 50° tall: 16:9 and square. Rendered off screen at their own size,
// with nothing but the scene in them: no grid, no outline, no gizmo.
console.log('the same camera, two image shapes: the square one keeps the height and loses the sides')
showStills({ eye: [6, 4, 8], target: [0, 0.5, 0], fov: 50, sizes: [[320, 180], [180, 180]] })`;

const STILL_DRAWING = `
// ── drawing (you can leave this part alone) ─────────────────────────────────
function showStills({ eye, target, fov, sizes }) {
  (async () => {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd4e6);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 6, 4); scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: 0x556070 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x4f8fd9 }));
    box.position.set(0, 0.5, 0); scene.add(box);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 16), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
    ball.position.set(2, 0.6, -1); scene.add(ball);
    for (const [w, h] of sizes) {
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(w, h);
      renderer.domElement.style.cssText = 'display: inline-block; margin: 6px; outline: 1px solid #94a3b8';
      document.body.appendChild(renderer.domElement);
      const camera = new THREE.PerspectiveCamera(fov, w / h, 0.1, 200);
      camera.position.set(...eye); camera.lookAt(...target);
      renderer.render(scene, camera);
    }
  })().catch((e) => console.error('The picture could not load three.js: ' + e.message));
}
`;

const CHALLENGE = `// A cinema frame is 2.39 times as wide as it is tall. The camera's field of view is 30° tall.
// How many degrees wide is the view? (Write a number, or arithmetic using Math.)
const wide = 0

console.log('wide: ' + wide + '°')`;

const SOLVED = CHALLENGE.replace('const wide = 0', 'const wide = 2 * Math.atan(Math.tan(15 * Math.PI / 180) * 2.39) * 180 / Math.PI');

const RIGHT_WIDE = (2 * Math.atan(Math.tan((15 * Math.PI) / 180) * 2.39) * 180) / Math.PI;

/** The challenge's check: work out the wide angle (a number or arithmetic with Math) and name the slip. */
export function checkWide(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/^\s*const\s+wide\s*=\s*([^\n]+)$/m);
  if (!m) return no('Keep the line const wide = …');
  const expr = m[1].trim();
  if (!/^[\w\s.+\-*/()]*$/.test(expr) || /\b(?!Math\b|PI\b|tan\b|atan\b|sin\b|cos\b)[A-Za-z_]\w*/.test(expr)) return no('Write the angle as a number, or arithmetic using Math.');
  let a;
  try { a = Function('Math', `"use strict"; return (${expr});`)(Math); } catch { return no('The angle could not be worked out: check the brackets.'); }
  if (typeof a !== 'number' || !Number.isFinite(a)) return no('The angle should come out as a number of degrees.');
  const near = (x) => Math.abs(a - x) < 0.2;
  if (near(RIGHT_WIDE)) return { pass: true, message: `${+a.toFixed(1)}°: the top edge is at tan 15° = 0.268 on a screen 1 away, the side edge 2.39 times that, 0.640, and 2 × atan 0.640 = 65.3°. Angles do not scale with the aspect ratio; tangents do.` };
  if (a === 0) return no('Work it out: tan of half the tall angle, times the aspect ratio, then 2 × atan of that.');
  if (near(30 * 2.39)) return no(`${+a.toFixed(1)}° multiplies the angle by 2.39. The image is 2.39 times as wide on a flat screen, so it is the tangent that scales: 2 × atan(tan 15° × 2.39).`);
  if (near(RIGHT_WIDE / 2)) return no(`${+a.toFixed(1)}° is half the view: atan gives the angle from the middle to one side. Double it.`);
  if (near((2 * Math.atan(Math.tan((30 * Math.PI) / 180) * 2.39) * 180) / Math.PI)) return no(`${+a.toFixed(1)}° starts from tan 30°. The top edge is at HALF the tall angle, 15°, from the line of sight.`);
  if (near(2 * Math.atan(Math.tan((15 * Math.PI) / 180) * 2.39))) return no(`${+a.toFixed(3)} is in radians. Multiply by 180 / π for degrees.`);
  return no(`${+a.toFixed(1)}° is not the wide angle. Steps: tan 15°, times 2.39, atan, times 2, in degrees.`);
}

export default {
  id: 'modelling-geometry-3-007',
  slug: 'a-camera-and-a-still',
  chapter: 'modelling-geometry',
  order: 7,
  title: 'A camera you can place, and a still image',
  subtitle: 'A scene camera is an object: aim it with look-at, frame its picture, and render a still at a size.',
  tags: ['camera', 'look-at', 'field of view', 'aspect ratio', 'render'],
  coreConcept: 'A scene camera is an object whose rotation look-at builds as a change of basis (right, up, back as columns) and the Rotation fields show as XYZ Euler angles; its vertical field of view and the image\'s aspect give the wide angle 2·atan(tan(θ/2)·a); looking through it frames that shape in the viewport, and a still renders exactly that view off screen at the chosen size.',
  prerequisites: ['modelling-geometry-3-001', 'modelling-geometry-3-002', 'modelling-geometry-2-007'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-4-001',

  hook: {
    question: 'The viewport is for working; a camera is for the picture you hand over. Why does the same camera show more of the scene in a 16:9 render than in a square one, and how does a tool turn "point at that box" into three rotation numbers?',
    realWorldContext: 'Every finished image of a 3D scene, a product shot, an architectural view or a game\'s cut-scene, comes from a camera placed as an object, aimed, given a lens and an image size, and rendered off screen without any of the editor\'s overlays. The same few numbers decide what is in the frame.',
  },

  intuition: {
    prose: [
      'Place a camera at $(6, 4, 8)$ and aim it at the box at $(0, 0.5, 0)$. Lesson 3.1 built its axes: forward towards the box, **right** $= (0.8, 0, -0.6)$, **up** $= (-0.198, 0.944, -0.264)$, and **back** $= -$forward $= (0.566, 0.330, 0.755)$.',
      'A camera is an object, so the tool must store it as a position and a rotation. The rotation whose **columns** are right, up and back turns the camera\'s own $x$, $y$ and $z$ onto those three directions (lesson 2.6). So **look-at is a change of basis**: from the camera\'s own axes to the ones that point at the target.',
      'The Rotation fields show Euler angles (lesson 2.7), so that rotation is decoded: $y = \\arcsin(r_{13})$, then $x$ and $z$ by atan2. Before running cell 1, predict: is the camera turned left or right about $y$? It comes out $(-23.63°, 34.49°, 13.92°)$: turned $34.5°$ about $y$, tipped down, and rolled a little, which is what keeps it upright in this order.',
      'The camera\'s **field of view** is the vertical angle, $50°$. The image\'s **aspect** $a$ is its width over its height. On a screen $1$ away, the top edge is at $\\tan 25° = 0.466$; the side edge is $a$ times further out. So the wide angle is $2 \\arctan(0.466 \\, a)$: $79.3°$ for $16{:}9$, $50°$ for a square, $96.2°$ for $2.39{:}1$ cinema.',
      'Pressing **0** looks through the camera. The viewport rarely has the render\'s shape, so the tool draws the render\'s **frame** inside it and darkens the rest. A $900 \\times 600$ viewport is less wide than $16{:}9$, so the frame fills its width ($900 \\times 506$) and the view\'s own field of view is widened to $57.9°$ so that the render\'s full width still fits.',
      'A **still** is rendered **off screen**: a separate image of exactly the render size, drawn from the camera with the camera\'s field of view and that size\'s aspect, and with every overlay switched off (grid, outlines, gizmos, the camera\'s own pyramid). What you saw in the frame is what you get, at full resolution.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Place, frame and render a camera',
        body: 'Step 1. Place the camera: position $e$. Aim it: forward $f = (t - e)/|t - e|$, right $= f \\times (0,1,0)$ normalised, up $=$ right $\\times f$.\nStep 2. Its rotation $R$ has columns right, up, $-f$; decode $R$ to XYZ Euler angles for the Rotation fields.\nStep 3. Choose the vertical field of view $\\theta$ and the render size $W \\times H$; the wide angle is $2 \\arctan(\\tan(\\theta/2) \\cdot W/H)$.\nStep 4. To look through it in a viewport of aspect $v$: if $v \\ge W/H$ the frame is the viewport\'s height; else it is the viewport\'s width, and the view\'s field of view becomes $2 \\arctan(\\tan(\\theta/2) \\cdot (W/H)/v)$.\nStep 5. To render a still: draw the scene once into a $W \\times H$ image with that camera, overlays hidden, and save it.',
      },
      {
        type: 'warning',
        title: 'Angles do not scale with the aspect; tangents do',
        body: 'A 16:9 image is 1.78 times as wide as it is tall, but its wide angle is not $1.78 \\times 50° = 89°$: it is $79.3°$. Screens are flat, so it is the distance across the screen, $\\tan$ of the half angle, that is multiplied.',
      },
      {
        type: 'warning',
        title: 'Changing the render size changes the picture',
        body: 'With the vertical field of view fixed, a squarer render keeps the same height of the scene and loses the sides; a wider one shows more at the sides. Set the render size before composing the shot.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: resolution, aspect, the frame',
        body: 'A still is a render target: an image the GPU draws into instead of the screen. Its resolution sets the pixels; its aspect, with the vertical field of view, sets the projection matrix (lesson 3.2: $x$ is divided by the aspect). The viewport\'s frame (the passepartout) only shows where that image\'s edges will be.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "a square image is a zoomed-in version of a wide one". Both stills are from the same camera with the same $50°$ vertical view: the box and ball are the same size in both, and the square one simply cuts off the sides. Invariant: the vertical extent of the scene.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'Cell 1 is Steps 1 and 2; wide() in cell 2 is Step 3; frame() in cell 3 is Step 4; cell 4 renders Step 5 twice.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'A still is a second WebGLRenderer (or a render target) the size of the image; the camera\'s aspect is set to W / H before rendering, so the projection matches the image.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Add › Camera places one; 0 looks through; Ctrl+Alt+0 puts the camera where you are looking from; the Inspector sets its field of view and the render size; View › Render still (PNG) saves the image; Object › Trace look-at aims it and traces Steps 1 and 2.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: a scene camera',
        caption: 'Look-at as a change of basis, the wide angle, the frame in the viewport, and two stills.',
        props: {
          lesson: {
            title: 'A camera you can place, and a still image',
            subtitle: 'Turn "look at that" into Rotation fields, frame a render, and draw stills at two sizes.',
            cells: [
              { type: 'js', instruction: '### 1. Look-at as a change of basis\nPredict first: is the camera turned left or right about y? Then the axes, the rotation, and the Rotation fields.', startCode: LOOK },
              { type: 'js', instruction: '### 2. Tall and wide\nThe field of view is vertical; the wide angle depends on the image\'s shape.', startCode: FOV },
              { type: 'js', instruction: '### 3. The frame in the viewport\nA 16:9 render and a square one, framed in a 900 × 600 viewport.', startCode: FRAME },
              { type: 'js', instruction: '### 4. Two stills\nThe same camera rendered off screen at 320 × 180 and 180 × 180.', startCode: `${STILLS}\n${STILL_DRAWING}`, showPreviewByDefault: true, outputHeight: 240 },
              { type: 'challenge', instruction: '### 5. Challenge: a cinema frame\nHow wide is a 30°-tall view at 2.39:1? The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkWide },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "A camera you can place" in MeshLab](#/lab/mesh-lab?project=camera-and-still). With **Record traces** on, the script traces **look-at**: forward, right and up, the change of basis, the Euler angles. In **Predict** mode, predict forward and the Y rotation; compare with cell 1. Then change the render size and look through the camera (0).' },
              { type: 'markdown', instruction: '### Use the tool\n- **Add › Camera**; **Add › Camera from this view**; **Ctrl+Alt+0** puts the scene camera where you are looking from.\n- **0** looks through the scene camera; orbiting leaves it.\n- **Inspector › Camera:** field of view (tall, with the wide angle shown), near and far, render size, Render still.\n- **View › Render still (PNG)** renders off screen at the render size, overlays hidden.\n- **Object › Trace look-at** aims the selected camera at the first mesh, traced.\n- A camera that moves: [the island fly-through](#/lab/mesh-lab?project=island-flythrough).\n- **In Blender:** Numpad 0 looks through; Ctrl+Alt+Numpad 0 aligns the camera to the view; Output Properties set the resolution; F12 renders a still.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why the columns make the rotation.** A rotation $R$ sends the unit vector $(1, 0, 0)$ to its first column, $(0, 1, 0)$ to its second, $(0, 0, 1)$ to its third (lesson 2.6). The camera must send its own $x$ to right, its $y$ to up and its $z$ to back. So $R = [\\,\\text{right} \\; \\text{up} \\; \\text{back}\\,]$. Its columns are unit length and at right angles (lesson 3.1), so it is a rotation.',
      '**Why the wide angle uses tangents.** On a screen $1$ away the image is $2 \\tan(\\theta/2)$ tall. Being $a$ times as wide, it is $2 a \\tan(\\theta/2)$ wide, so its half-width is $a \\tan(\\theta/2)$ and the half angle to the side is $\\arctan(a \\tan(\\theta/2))$. Doubling gives the wide angle.',
      '**Why the frame widens the view.** In a viewport of aspect $v < a$, the render\'s full width must fill the viewport\'s width. The view\'s horizontal half-extent must be $a \\tan(\\theta/2)$, and the viewport\'s is $v \\tan(\\theta\'/2)$ for its vertical view $\\theta\'$. Equal: $\\tan(\\theta\'/2) = \\tan(\\theta/2) \\cdot a / v$.',
      '**Why the still matches the frame.** The still uses the camera\'s $\\theta$ and aspect $a$; the frame shows, inside the viewport, exactly the region of the view that a camera with $\\theta$ and $a$ covers. The two projections agree on that region, so what is inside the frame is the image.',
    ],
    equations: [
      { label: 'Look-at rotation', latex: 'R = \\begin{pmatrix} \\text{right} & \\text{up} & \\text{back} \\end{pmatrix}, \\quad \\text{back} = \\frac{e - t}{|e - t|}' },
      { label: 'Wide angle', latex: '\\theta_{\\text{wide}} = 2 \\arctan\\big( a \\tan(\\theta / 2) \\big)' },
      { label: 'View widened to fit', latex: '\\tan(\\theta\' / 2) = \\tan(\\theta / 2) \\cdot \\frac{a}{v} \\quad (v < a)' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** Given an eye $e$, a target $t \\ne e$ and an up direction $\\hat{y}$ not parallel to $t - e$, there is exactly one rotation sending $-\\hat{z}$ to $(t - e)/|t - e|$ and keeping the image of $\\hat{x}$ horizontal with the image of $\\hat{y}$ above the horizon: the look-at rotation. Its Euler angles in a fixed order are unique away from gimbal lock (lesson 2.7).',
      '**Invariant viewpoint.** The vertical field of view is the camera\'s invariant here: changing the render size changes the wide angle and the crop, never the vertical extent. Scaling the render size without changing its shape changes only the number of pixels, never what is in the frame.',
      '**Geometric picture.** The camera\'s view is a pyramid with the eye at its tip (lesson 3.2). The render size fixes its cross-section\'s shape; the field of view fixes how steep it is top to bottom. The frame in the viewport is that pyramid\'s cross-section drawn inside the viewport\'s own, wider or taller, pyramid.',
      '**Where this goes.** Animating a camera (chapter 10) keys its position and rotation like any object; a camera parented to a moving object (lesson 2.5) follows it. Picking (lesson 4.1) runs the camera backwards, from a pixel to a ray. Physical cameras describe the same field of view as a focal length over a sensor height: $\\theta = 2 \\arctan(h / 2F)$.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-3-007-ex1',
      title: 'A camera on the z axis',
      problem: 'A camera at $(0, 1, 5)$ looks at $(0, 1, 0)$. What are its axes and its Rotation fields?',
      steps: [
        { expression: 'f = (0, 0, -1), \\; \\text{right} = (1, 0, 0), \\; \\text{up} = (0, 1, 0), \\; \\text{back} = (0, 0, 1)', annotation: 'Step 1: it looks straight down −z.' },
        { expression: 'R = I', annotation: 'Step 2: its columns are the world\'s own axes.' },
        { expression: '(0°, 0°, 0°)', annotation: 'An unturned camera already looks down −z.' },
      ],
      conclusion: 'A camera looking along −z needs no rotation at all: that is why −z is the camera\'s looking direction.',
    },
    {
      id: 'modelling-geometry-3-007-ex2',
      title: 'The lesson\'s camera',
      problem: 'The camera at $(6, 4, 8)$ looks at $(0, 0.5, 0)$. Find its Y rotation.',
      steps: [
        { expression: '\\text{back} = (6, 3.5, 8) / 10.597 = (0.566, 0.330, 0.755)', annotation: 'Step 1: back = (e − t) / |e − t|.' },
        { expression: 'r_{13} = \\text{back}_x = 0.566', annotation: 'Step 2: row 1, column 3 of R is the x part of its third column, back.' },
        { expression: 'y = \\arcsin(0.566) = 34.49°', annotation: 'Lesson 2.7: y = asin(r13).' },
      ],
      conclusion: 'The camera is turned $34.49°$ about $y$; the other two fields, $-23.63°$ and $13.92°$, come from atan2 of the other entries.',
    },
    {
      id: 'modelling-geometry-3-007-ex3',
      title: 'A square render in a wide viewport',
      problem: 'A $1080 \\times 1080$ render is framed in a $900 \\times 600$ viewport. Where is the frame, and what field of view does the view use?',
      steps: [
        { expression: 'v = 1.5 \\ge a = 1', annotation: 'Step 4: the viewport is wider than the render.' },
        { expression: '\\text{frame} = 600 \\times 600, \\text{ bars } 150 \\text{ left and right}', annotation: 'The frame takes the viewport\'s height.' },
        { expression: '\\theta\' = \\theta = 50°', annotation: 'No widening is needed: the render\'s height fills the view\'s height.' },
      ],
      conclusion: 'The frame is a centred $600 \\times 600$ square; the view keeps the camera\'s $50°$.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-3-007-ch1',
      difficulty: 'easy',
      problem: 'A camera\'s field of view is $60°$ tall. How wide is it for a square render?',
      walkthrough: [{ expression: '2 \\arctan(\\tan 30° \\cdot 1) = 60°', annotation: 'With a = 1 the wide angle equals the tall one.' }],
      answer: '60°: a square image is as wide as it is tall, so its two angles are equal.',
    },
    {
      id: 'modelling-geometry-3-007-ch2',
      difficulty: 'medium',
      problem: 'A product shot looks right at $1920 \\times 1080$. The client asks for a $1080 \\times 1920$ phone version. What happens to the shot, and what must change?',
      walkthrough: [
        { expression: 'a: 1.78 \\to 0.5625', annotation: 'The image becomes tall and narrow.' },
        { expression: '\\theta \\text{ fixed} \\Rightarrow \\text{same height of scene, much narrower}', annotation: 'Wide angle: 79.3° → 2 atan(tan 25° × 0.5625) = 29.4° for a 50° camera.' },
        { expression: '\\text{recompose: move back, or raise } \\theta', annotation: 'To keep the product\'s width in frame, the camera must see more.' },
      ],
      answer: 'With the same vertical field of view the portrait image keeps the same height of scene but only about 29° of width, so the sides of the product are cut off; move the camera back or widen the field of view and recompose.',
    },
    {
      id: 'modelling-geometry-3-007-ch3',
      difficulty: 'hard',
      problem: 'A script places a camera straight above a model, at $(0, 10, 0)$, and calls look-at on the origin. The camera spins wildly from frame to frame. Why, and what is a fix?',
      walkthrough: [
        { expression: 'f = (0, -1, 0) \\parallel \\hat{y}', annotation: 'Forward is parallel to the reference up.' },
        { expression: 'f \\times \\hat{y} = 0', annotation: 'No right axis: look-at is undefined (lesson 3.1), and tiny changes pick wildly different right axes.' },
        { expression: '\\text{fix: a different reference up, e.g. } (0, 0, -1)', annotation: 'For a top view, the world\'s −z is a natural "up" on the image.' },
      ],
      answer: 'Looking straight down makes forward parallel to the reference up, so the right axis is undefined and tiny changes swing it round; use a different up (such as the world\'s −z) for top views.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'R = [\\text{right} \\; \\text{up} \\; \\text{back}]', meaning: 'The look-at rotation: its columns are where the camera\'s own x, y, z go. A change of basis.' },
      { symbol: '\\theta', meaning: 'The vertical field of view: the angle from the image\'s bottom edge to its top.' },
      { symbol: 'a = W / H', meaning: 'The render\'s aspect ratio: its width over its height.' },
      { symbol: '2 \\arctan(a \\tan(\\theta/2))', meaning: 'The horizontal field of view: tangents scale with the aspect, angles do not.' },
      { symbol: '\\text{frame}', meaning: 'The render\'s rectangle drawn inside the viewport when looking through the camera.' },
      { symbol: '\\text{still}', meaning: 'An image rendered off screen from the camera at the render size, with no overlays.' },
    ],
    rulesOfThumb: [
      'Set the render size first, then compose the shot through the frame.',
      'The vertical field of view stays; the sides change with the image\'s shape.',
      'Multiply tangents by the aspect ratio, never angles.',
      'For a top view, give look-at a different up direction.',
      'What is inside the frame is exactly the still.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-3-001', label: 'Cameras', note: 'Look-at: forward, right, up by cross products.' },
      { lessonId: 'modelling-geometry-3-002', label: 'Projection', note: 'The aspect ratio divides x in the projection matrix; f = 1 / tan(θ/2).' },
      { lessonId: 'modelling-geometry-2-007', label: 'Euler angles and gimbal lock', note: 'Decoding a rotation into the XYZ Rotation fields.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-4-001', label: 'Picking by ray', note: 'The camera run backwards: a pixel becomes a ray into the scene.' },
      { lessonId: 'modelling-geometry-10-001', label: 'Keyframes', note: 'A camera is animated by keying its position and rotation like any object.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-3-007-1', label: 'Read why look-at is a change of basis', type: 'read' },
    { id: 'cp-modelling-geometry-3-007-2', label: 'Read how the wide angle follows from the tall one and the aspect', type: 'read' },
    { id: 'cp-modelling-geometry-3-007-3', label: 'Read how the frame and the still match', type: 'read' },
    { id: 'cp-modelling-geometry-3-007-4', label: 'Run cells 1 to 3: the Rotation fields, the angles, the frame', type: 'lab' },
    { id: 'cp-modelling-geometry-3-007-5', label: 'Compare the two stills, and render a still in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-3-007-6', label: 'Work through example 2, the lesson camera\'s Y rotation', type: 'example' },
    { id: 'cp-modelling-geometry-3-007-7', label: 'Work through example 3, a square render in a wide viewport', type: 'example' },
    { id: 'cp-modelling-geometry-3-007-8', label: 'Complete the challenge: a cinema frame', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-3-007-assess-1',
        type: 'choice',
        text: 'A camera with a 50° vertical field of view renders a 16:9 image. How wide is the view?',
        options: ['79.3°', '88.9°', '50°', '28.1°'],
        answer: '79.3°',
        hint: '2 atan(tan 25° × 16/9); 88.9° is 50° × 16/9, which wrongly scales the angle.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-3-007-quiz-1',
      type: 'choice',
      text: 'What are the columns of the look-at rotation?',
      options: ['Right, up and back', 'Right, up and forward', 'The eye and the target', 'The world\'s x, y and z'],
      answer: 'Right, up and back',
      hints: ['They are where the camera\'s own x, y, z go.', 'The camera\'s z points back, away from what it sees.'],
      reviewSection: 'Math: "Why the columns make the rotation"',
    },
    {
      id: 'modelling-geometry-3-007-quiz-2',
      type: 'choice',
      text: 'The render size changes from 16:9 to square, the field of view stays 50°. What happens to the picture?',
      options: ['Same height of scene, the sides cut off', 'It zooms in', 'It zooms out', 'Nothing'],
      answer: 'Same height of scene, the sides cut off',
      hints: ['The field of view is vertical.', 'Cell 4 shows both.'],
      reviewSection: 'Callout "What the picture shows (cell 4)"',
    },
    {
      id: 'modelling-geometry-3-007-quiz-3',
      type: 'choice',
      text: 'Why is a 16:9 view at 50° tall not 89° wide?',
      options: ['On a flat screen it is the tangents that scale with the aspect, not the angles', 'Because of the near plane', 'Because three.js rounds angles', 'Because the camera rolls'],
      answer: 'On a flat screen it is the tangents that scale with the aspect, not the angles',
      hints: ['Half-height on a screen 1 away is tan 25°.', 'Half-width is 16/9 times that.'],
      reviewSection: 'Warning "Angles do not scale with the aspect; tangents do"',
    },
    {
      id: 'modelling-geometry-3-007-quiz-4',
      type: 'choice',
      text: 'A 16:9 render is framed in a 900 × 600 viewport. How tall is the frame?',
      options: ['506.25', '600', '450', '337.5'],
      answer: '506.25',
      hints: ['The viewport (1.5) is narrower than 16:9 (1.78), so the frame takes its width.', '900 / (16/9).'],
      reviewSection: 'Intuition: the frame paragraph, and cell 3',
    },
    {
      id: 'modelling-geometry-3-007-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT in a rendered still?',
      options: ['The selection outline', 'The objects\' colours', 'The lighting', 'Objects in the frame'],
      answer: 'The selection outline',
      hints: ['A still shows the scene only.', 'Overlays are for working.'],
      reviewSection: 'Intuition: the last paragraph',
    },
    {
      id: 'modelling-geometry-3-007-quiz-6',
      type: 'choice',
      text: 'A camera at (0, 1, 5) looks at (0, 1, 0). What are its Rotation fields?',
      options: ['(0°, 0°, 0°)', '(0°, 180°, 0°)', '(90°, 0°, 0°)', '(0°, 90°, 0°)'],
      answer: '(0°, 0°, 0°)',
      hints: ['It looks down −z.', 'A camera already looks down its own −z.'],
      reviewSection: 'Example 1',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A square render is a zoomed-in crop of a wide render.',
      whyStudentsThinkIt: 'It shows less of the scene.',
      correctionExample: 'Cell 4: the box and ball are the same size in both stills; the square one only loses the sides.',
      contrastCase: 'Narrowing the field of view (say 50° to 30°) is a zoom: everything gets bigger.',
    },
    {
      falseBelief: 'The wide angle is the tall angle times the aspect ratio.',
      whyStudentsThinkIt: 'The image is aspect times as wide, so the angle seems to scale too.',
      correctionExample: '50° tall at 16:9 is 79.3° wide, not 88.9°.',
      contrastCase: 'For very small angles the two are nearly equal, because tan is nearly linear near 0.',
    },
    {
      falseBelief: 'Look-at stores a target in the camera.',
      whyStudentsThinkIt: 'You aim it at a point, so the point seems to be kept.',
      correctionExample: 'After look-at, MeshLab\'s camera has only Position (6, 4, 8) and Rotation (−23.63°, 34.49°, 13.92°); move the box and the camera does not follow.',
      contrastCase: 'A "track to" constraint (Blender) does keep a target and re-aims every frame.',
    },
  ],

  transferPrompts: [
    {
      situation: 'An architecture firm needs the same interior view as a 16:9 slide and as a 4:5 social-media image.',
      competingTechniques: ['Render once at 16:9 and crop', 'Keep the camera, set each render size, and adjust the field of view or position per format'],
      whyThisTechniqueWins: 'Cropping a 16:9 image to 4:5 throws away most of its width and resolution; rendering each size directly, with the composition checked in the frame, keeps every pixel.',
    },
    {
      situation: 'A turntable animation must keep a product centred as the camera circles it.',
      competingTechniques: ['Key the camera\'s rotation by hand at each position', 'Move the camera on a circle and call look-at on the product each frame'],
      whyThisTechniqueWins: 'Look-at turns "point at the product" into the right rotation at every frame, with no hand-keyed angles drifting off centre.',
    },
  ],

  debugging: [
    {
      commonError: 'Composing a shot in the viewport without looking through the camera.',
      symptom: 'The rendered still crops or shows things that were not expected.',
      whyItHappened: 'The viewport has its own camera and shape; only the frame shows the still\'s edges.',
      repairStrategy: 'Press 0 and compose inside the frame, with the final render size set.',
    },
    {
      commonError: 'Setting the field of view as the horizontal angle.',
      symptom: 'A 16:9 render shows much more of the scene than intended.',
      whyItHappened: 'three.js and MeshLab take a vertical field of view; a horizontal value used as vertical is far too wide.',
      repairStrategy: 'Convert: tall = 2 atan(tan(wide / 2) / aspect).',
    },
    {
      commonError: 'Calling look-at with the camera directly above or below the target.',
      symptom: 'NaN rotations or a camera that spins between frames.',
      whyItHappened: 'Forward is parallel to the reference up, so there is no right axis.',
      repairStrategy: 'Use a different reference up for top and bottom views.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Aim a camera with look-at, turn its rotation into Euler fields, compute the wide angle and the frame, and render a still.',
    explainVerbally: 'Explain look-at as a change of basis, why tangents scale with the aspect, and why the frame equals the still.',
    detectIncorrectApplication: 'Spot a horizontal angle used as vertical, angles scaled by the aspect, a crop where a re-render was needed, and look-at from straight above.',
    transferToUnfamiliar: 'Set up the same shot for several formats, or a turntable with look-at.',
  },
};
