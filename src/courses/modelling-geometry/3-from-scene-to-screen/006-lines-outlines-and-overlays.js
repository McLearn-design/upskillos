// Lesson 3.6: lines, outlines and overlays. A selection outline of constant width on screen: the inverted hull
// (the mesh pushed out along its normals by a fraction of its distance, drawn back faces only), and the stencil
// test that keeps it outside the body where a crease would otherwise let it through.

// The box with a recessed panel on its front, and smooth (area-weighted) vertex normals.
const BOX = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const f3 = (v) => v.map(r).join(', ')
const sq = (s, z) => [[-s, -s, z], [s, -s, z], [s, s, z], [-s, s, z]]
// Back corners 0-3, front rim 4-7, the panel's rim on the front 8-11, the panel sunk 0.12 deep 12-15.
const verts = [...sq(0.5, -0.5), ...sq(0.5, 0.5), ...sq(0.3, 0.5), ...sq(0.3, 0.38)]
const faces = [[3, 2, 1, 0], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
  [4, 5, 9, 8], [5, 6, 10, 9], [6, 7, 11, 10], [7, 4, 8, 11],
  [8, 9, 13, 12], [9, 10, 14, 13], [10, 11, 15, 14], [11, 8, 12, 15], [12, 13, 14, 15]]
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l) }
const areaNormal = (f) => { let s = [0, 0, 0]; for (let i = 1; i + 1 < f.length; i++) s = s.map((x, j) => x + cross(sub(verts[f[i]], verts[f[0]]), sub(verts[f[i + 1]], verts[f[0]]))[j]); return s }
const vn = verts.map((_, v) => { let s = [0, 0, 0]; faces.forEach((f) => { if (f.includes(v)) s = s.map((x, j) => x + areaNormal(f)[j]) }); return unit(s) })
const eye = [0.9, 1.3, 2.6]
`;

const WIDTH = `// How wide is something on screen? Width w at distance d covers w · f · (H / 2) / d pixels (lesson 3.2).
const f = 1 / Math.tan(22.5 * Math.PI / 180), H = 600                // MeshLab's viewport: fov 45°, 600 pixels tall
const px = (w, d) => w * f * (H / 2) / d
for (const d of [2, 5, 20]) console.log('distance ' + d + ': a fixed push of 0.01 is ' + px(0.01, d).toFixed(2) + ' px; a push of 0.0035 × d is ' + px(0.0035 * d, d).toFixed(2) + ' px')`;

const HULL = `${BOX}
// The inverted hull: every vertex pushed out along its smooth normal; only the hull's back faces are drawn.
// A face is a back face if its normal points away from the eye.
const facing = (f) => dot(unit(areaNormal(f)), sub(eye, verts[f[0]])) > 0 ? 'front' : 'back'
console.log('the outer walls: ' + [1, 2, 3, 4].map((i) => facing(faces[i])).join(', ') + '; the panel: ' + facing(faces[13]))
console.log('the recess walls: ' + [9, 10, 11, 12].map((i) => facing(faces[i])).join(', '))
// The top recess wall (face 11) faces down, away from the eye: a back face. Its corners on the panel, 14 and 15,
// have normals averaged with the panel's (0, 0, 1), so pushing them moves them towards the eye.
for (const v of [14, 15]) console.log('vertex ' + v + ': normal ' + f3(vn[v]) + ', towards the eye ' + r(dot(vn[v], unit(sub(eye, verts[v])))))`;

const STENCIL = `// The stencil test on a 10 × 10 screen. Body pixels are marked 1; the hull is drawn only where the mark is 0.
const N = 10, body = [], hull = []
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const inBody = x >= 2 && x <= 7 && y >= 2 && y <= 7
  const ring = !inBody && x >= 1 && x <= 8 && y >= 1 && y <= 8   // the hull's rim beyond the silhouette
  const crease = y === 6 && x >= 3 && x <= 6                         // hull back faces that came in front of the body
  body.push(inBody ? 1 : 0)
  hull.push(ring || crease)
}
const drawn = (useStencil) => hull.map((h, i) => h && (!useStencil || body[i] === 0))
for (const s of [false, true]) {
  const d = drawn(s), inside = d.filter((x, i) => x && body[i]).length
  console.log((s ? 'with' : 'without') + ' the stencil: ' + d.filter(Boolean).length + ' outline pixels, ' + inside + ' of them inside the body')
}
const d = drawn(false)
for (let y = N - 1; y >= 0; y--) console.log('row ' + y + ': ' + [...Array(N).keys()].map((x) => d[y * N + x] ? 'o' : body[y * N + x] ? '#' : '.').join(''))`;

const PICTURE_CODE = `${BOX}
// Two copies of the same view: the outline without the stencil (left) and with it (right).
// The push is 0.01 × distance here, three times MeshLab's, so the crease lines are easy to see.
console.log('left: hull only; right: hull and stencil')
showOutline({ verts, faces, eye, k: 0.01 })`;

const OUTLINE_DRAWING = `
// ── drawing (you can leave this part alone) ─────────────────────────────────
function showOutline({ verts, faces, eye, k }) {
  (async () => {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js');
    const dark = document.documentElement.classList.contains('dark');
    for (const stencil of [false, true]) {
      const w = Math.min(270, (document.body.clientWidth || 560) / 2 - 6), h = 300;
      const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.domElement.style.cssText = 'display: inline-block; margin: 0 3px';
      document.body.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(dark ? 0x0f1923 : 0xf1f5f9);
      const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
      camera.position.set(...eye); camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.2));
      const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(3, 5, 4); scene.add(sun);
      // Shared corners and smooth normals, as MeshLab's hull uses.
      const idx = [];
      for (const f of faces) for (let i = 1; i + 1 < f.length; i++) idx.push(f[0], f[i], f[i + 1]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts.flat(), 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      // The body marks its pixels with 1 in the stencil buffer.
      const body = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x8fa3b8, flatShading: true, stencilWrite: stencil, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp }));
      // The hull: pushed out by k × distance along the normal, back faces only, drawn where the mark is not 1.
      const hull = new THREE.Mesh(g, new THREE.ShaderMaterial({
        side: THREE.BackSide, uniforms: { k: { value: k } },
        vertexShader: 'uniform float k; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal); mv.xyz += n * k * -mv.z; gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'void main() { gl_FragColor = vec4(1.0, 0.6, 0.1, 1.0); }',
        stencilWrite: stencil, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp,
      }));
      hull.renderOrder = 1;
      scene.add(body, hull);
      renderer.render(scene, camera);
    }
  })().catch((e) => console.error('The picture could not load three.js: ' + e.message));
}
`;

const CHALLENGE = `// A viewport 1080 pixels tall with a 50° field of view. The outline should be 3 pixels wide.
// MeshLab pushes the hull out by k × distance. What should k be?
// (Write a number, or arithmetic using Math.)
const k = 0.0035

const f = 1 / Math.tan(25 * Math.PI / 180)
console.log('k = ' + k + ' gives ' + (k * f * 1080 / 2).toFixed(2) + ' pixels')`;

const SOLVED = CHALLENGE.replace('const k = 0.0035', 'const k = 2 * 3 / (1080 / Math.tan(25 * Math.PI / 180))');

const F50 = 1 / Math.tan((25 * Math.PI) / 180);
const RIGHT_K = (2 * 3) / (F50 * 1080);

/** The challenge's check: work out k (a number or arithmetic with Math) and name the slip. */
export function checkThickness(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/^\s*const\s+k\s*=\s*([^\n]+)$/m);
  if (!m) return no('Keep the line const k = …');
  const expr = m[1].trim();
  if (!/^[\w\s.+\-*/()]*$/.test(expr) || /\b(?!Math\b|PI\b|tan\b|sin\b|cos\b|atan\b)[A-Za-z_]\w*/.test(expr)) return no('Write k as a number, or arithmetic using Math.');
  let k;
  try { k = Function('Math', `"use strict"; return (${expr});`)(Math); } catch { return no('k could not be worked out: check the brackets.'); }
  if (typeof k !== 'number' || !Number.isFinite(k) || k <= 0) return no('k should be a positive number.');
  const px = k * F50 * 540;
  const near = (x) => Math.abs(k - x) / x < 0.01;
  if (near(RIGHT_K)) return { pass: true, message: `k = ${+k.toFixed(6)}: pixels = k × f × H / 2, so k = 2 × 3 / (f × 1080) with f = 1 / tan 25° = 2.1445. The distance cancels, so the outline is 3 pixels wide near or far.` };
  if (Math.abs(k - 0.0035) < 1e-12) return no(`0.0035 gives ${px.toFixed(2)} pixels here. Solve pixels = k × f × H / 2 for k, with pixels = 3.`);
  if (near(RIGHT_K / 2)) return no(`k = ${+k.toFixed(6)} gives 1.5 pixels: the image runs from −1 to 1 across H pixels, so one unit of NDC is H / 2 pixels, not H.`);
  if (near(6 / ((1 / Math.tan((50 * Math.PI) / 180)) * 1080))) return no(`k = ${+k.toFixed(6)} uses tan 50°. f = 1 / tan of HALF the field of view, 25°.`);
  if (near(6 / (F50 * 1920))) return no(`k = ${+k.toFixed(6)} uses the width. f goes with the vertical field of view, so use the height, 1080.`);
  return no(`k = ${+k.toFixed(6)} gives ${px.toFixed(2)} pixels, not 3. Pixels = k × f × H / 2.`);
}

export default {
  id: 'modelling-geometry-3-006',
  slug: 'lines-outlines-and-overlays',
  chapter: 'modelling-geometry',
  order: 6,
  title: 'Lines, outlines and overlays',
  subtitle: 'A selection outline the same width near and far: push the mesh out by a fraction of its distance, draw its back faces, and stencil out the creases.',
  tags: ['outline', 'inverted hull', 'stencil', 'overlays', 'screen space'],
  coreConcept: 'Something w wide at distance d covers w·f·(H/2)/d pixels, so pushing a mesh out along its normals by k·d makes a rim k·f·H/2 pixels wide at any distance; drawing only that inverted hull\'s back faces leaves just the rim beyond the silhouette, and a stencil test (body marks its pixels, hull drawn only where unmarked) stops hull faces showing through concave creases.',
  prerequisites: ['modelling-geometry-3-002', 'modelling-geometry-3-004', 'modelling-geometry-3-005'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-3-007',

  hook: {
    question: 'Select an object in a modelling tool and an orange line hugs its silhouette, always 2 or 3 pixels wide, whether the object fills the screen or is a speck. How is a line drawn round a 3D shape, at a fixed width on screen?',
    realWorldContext: 'Selection outlines, toon-shading ink lines, hover highlights and the outlines of game objects you can pick up are all drawn this way, or by a close cousin. The same tricks (screen-space sizes, back faces, the stencil buffer) draw wireframes, grids and gizmos over the shaded model without them fighting it.',
  },

  intuition: {
    prose: [
      'How wide is a line on screen? Something $0.01$ wide at distance $2$ from MeshLab\'s viewport camera (field of view $45°$, $600$ pixels tall) is $3.62$ pixels across. At distance $5$ it is $1.45$; at $20$, $0.36$. Lesson 3.2 says why: on screen, size is divided by distance. A fixed-size outline gets thin far away.',
      'So make the size grow with distance. A push of $k \\times d$ at distance $d$ covers $k d \\cdot f \\cdot (H / 2) / d = k f H / 2$ pixels: the distance cancels. With $k = 0.0035$ that is $2.53$ pixels at any distance. This is **screen-space width**: chosen in pixels, turned into world units at each vertex.',
      'Now the outline itself. Make a copy of the mesh and push every vertex out along its smooth normal (lesson 3.5) by $k d$. The copy is a slightly fatter shell round the body: the **hull**. Draw only its **back faces**, the faces pointing away from the eye. Its front faces would hide the body; its back faces are behind the body, except in a thin rim just beyond the silhouette. That rim is the outline. Turned inside out like this it is called an **inverted hull**.',
      'Before running cell 2, predict: a box with a panel sunk into its front. Seen from above and in front, which of the recess walls are back faces?',
      'Two of them: the top wall faces down and the right wall faces left, both away from an eye above and to the right. Take the top wall. Its corners down on the panel have normals averaged with the panel\'s, which points out at the viewer. So pushing those corners moves them towards the eye, and that part of the hull comes out in front of the panel: a stray orange line inside the box, along the crease.',
      'The **stencil buffer** fixes it. Like the depth buffer (lesson 3.4) it is one more number per pixel. Drawing the selected body writes $1$ into every pixel it covers. Drawing the hull then runs a **stencil test**: it is kept only where the stencil is not $1$, which is outside the body\'s silhouette. The rim survives; the crease lines inside do not. Cell 3 counts it on a toy $10 \\times 10$ screen: $32$ outline pixels with the stray $4$, $28$ after the test.',
      'Other overlays use the same toolbox. **Wire** draws every edge as a line on top of the faces, which are pushed back slightly with polygon offset (lesson 3.4) so the lines win. The **grid** and **axes** are lines too; the gizmo is drawn with no depth test at all, so it is never hidden.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: A constant-width selection outline',
        body: 'Step 1. Choose the width in pixels $p$; with $f = 1 / \\tan(\\theta / 2)$ and image height $H$, set $k = 2p / (f H)$.\nStep 2. Draw the selected bodies, each writing $1$ into the stencil buffer where it covers a pixel.\nStep 3. Draw a copy of each with every vertex moved out along its smooth normal by $k$ times its distance in front ($-z$ in camera space).\nStep 4. Draw only the copy\'s back faces, with the depth test on.\nStep 5. Keep a hull pixel only where the stencil is not $1$.',
      },
      {
        type: 'warning',
        title: 'The hull needs smooth normals',
        body: 'Pushing along flat face normals splits the hull at every edge: the faces move apart and gaps open at corners, so the outline breaks into pieces. Push along vertex normals averaged over the faces (lesson 3.5) so the hull stays one closed shell.',
      },
      {
        type: 'warning',
        title: 'Back faces only, and a closed mesh',
        body: 'Drawing the hull\'s front faces would cover the whole object in orange. And an open mesh (a plane, a cut-open model) has no back faces behind it to make a rim: its outline shows only where its other side faces away.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: the stencil test',
        body: 'WebGL keeps an 8-bit stencil value per pixel next to the depth value. A material can write to it (stencilWrite, with an op such as Replace) and test against it (a function such as NotEqual, with a reference value). three.js needs the renderer created with stencil: true. MeshLab marks selected bodies with 1 and draws their hulls with NotEqual 1, after them (renderOrder 1).',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "an inverted hull only ever shows outside the object". Left, without the stencil: orange lines round the recessed panel, inside the box. Right, with it: only the rim. Invariant: the outer rim is identical in both pictures, because the stencil only removes pixels the body covers.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'px() in cell 1 is the width formula; vn and facing() in cell 2 are Step 3\'s normals and Step 4\'s test; drawn() in cell 3 is Step 5.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The push happens in the vertex shader (mv.xyz += n * k * -mv.z), so the CPU sends the mesh once and the GPU makes the hull at every frame, at the right width for the current camera.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'MeshLab\'s outline is this shader with k = 0.0035. View › Outline stencil on / off shows the creases without the stencil; Object › Trace the outline width (camera) works out the width in pixels on a camera\'s image.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: an inverted-hull outline',
        caption: 'Screen-space width, the hull\'s back faces, the stencil test, and the outline with and without it.',
        props: {
          lesson: {
            title: 'Lines, outlines and overlays',
            subtitle: 'Make an outline that stays the same width on screen and never shows inside the object.',
            cells: [
              { type: 'js', instruction: '### 1. Screen-space width\nA fixed push thins out with distance; a push of k × distance does not.', startCode: WIDTH },
              { type: 'js', instruction: '### 2. Which hull faces are drawn\nPredict first: which recess walls are back faces? Then see which way their corners are pushed.', startCode: HULL },
              { type: 'js', instruction: '### 3. The stencil test\nThe hull is kept only where the body did not mark the pixel.', startCode: STENCIL },
              { type: 'js', instruction: '### 4. With and without the stencil\nThe same view twice: left without the stencil, right with it.', startCode: `${PICTURE_CODE}\n${OUTLINE_DRAWING}`, showPreviewByDefault: true, outputHeight: 330 },
              { type: 'challenge', instruction: '### 5. Challenge: a 3-pixel outline\nChoose k for a 1080-pixel-tall view with a 50° field of view. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkThickness },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Lines, outlines and overlays" in MeshLab](#/lab/mesh-lab?project=outlines). A box with a recessed panel, selected. With **Record traces** on, **Object › Trace the outline width (camera)** works out the push and the width in pixels on the camera\'s image. In **Predict** mode, predict the pixels. Then use **View › Outline stencil on / off** and look at the panel.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Selection outline:** select an object (orange; the active one brighter). Zoom in and out: it stays the same width.\n- **Wire, Grid, Axes, Normals** (toolbar) are line overlays; **X-ray** lets them show through.\n- **View › Outline stencil on / off** shows why the stencil is needed.\n- See the creases on a real model: [the hard-surface crate](#/lab/mesh-lab?project=crate), whose recessed panels showed outline lines before the stencil was added.\n- **In Blender:** Overlays › Outline Selected; Viewport Display › Wireframe; the Solidify modifier with Flip Normals and a backface-culled material is the same inverted-hull trick used for toon ink lines.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why the distance cancels.** After projection (lesson 3.2) a camera-space length $w$ perpendicular to the view, at depth $d$, becomes $w f / d$ in NDC, and NDC from $-1$ to $1$ spans $H$ pixels, so one NDC unit is $H / 2$ pixels. With $w = k d$: $k d \\cdot f / d \\cdot H / 2 = k f H / 2$.',
      '**Why back faces give a rim.** For a closed mesh, every ray from the eye through the body enters through a front face and leaves through a back face. The hull is slightly bigger, so a ray that just misses the body can still pass through the hull: it enters through the hull\'s front face and leaves through a back face, with no body in between. Those rays form the rim. Rays that hit the body meet a hull back face behind it, which the depth test hides.',
      '**Why creases break it.** A smooth vertex normal is an average (lesson 3.5). At a concave crease the average leans towards the open side, so a back face\'s corner there is pushed towards the eye by $k d \\, (\\hat{n} \\cdot \\hat{e})$, where $\\hat{e}$ points to the eye. If that brings it in front of the nearby surface, the depth test lets it through.',
      '**Why the stencil test fixes exactly that.** The stray hull pixels are all inside the body\'s silhouette, because they are in front of body surface. The rim pixels are all outside it. The stencil marks exactly the silhouette, so "not marked" keeps the rim and drops the strays.',
    ],
    equations: [
      { label: 'Screen-space width', latex: '\\text{pixels} = \\frac{w \\, f \\, H}{2 d}, \\qquad w = k d \\;\\Rightarrow\\; \\text{pixels} = \\frac{k f H}{2}' },
      { label: 'The hull', latex: 'p\' = p + k \\, d \\, \\hat{n}_v' },
      { label: 'Stencil test', latex: '\\text{draw hull pixel} \\iff \\text{stencil} \\ne 1' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For a closed, consistently wound mesh and an offset $\\varepsilon$ small compared with its features, the back faces of the $\\varepsilon$-offset surface that pass the depth test against the body are exactly the points of the offset shell outside the body\'s silhouette, plus points near concave regions where the offset of a hidden face crosses a visible one. Intersecting with the complement of the silhouette (the stencil) leaves exactly the first set.',
      '**Invariant viewpoint.** The outline\'s pixel width is invariant under moving the camera closer or further and under zooming the object, because the push is proportional to depth. It is not invariant under changing the field of view or the image height: both are in $k f H / 2$.',
      '**Geometric picture.** The hull is a parallel surface at a distance that grows with depth. Seen from the eye, its silhouette is a slightly bigger copy of the body\'s; the difference of the two silhouettes is a band of constant pixel width. The stencil turns "bigger copy" into "band".',
      '**Where this goes.** Lesson 3.7 hides every overlay (outline, grid, gizmos) when rendering a still. Lesson 4.1 picks objects by the same silhouettes. Screen-space edge detection (on depth and normals, after drawing) is the other common outline method, used when meshes are not closed.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-3-006-ex1',
      title: 'Width on screen',
      problem: 'MeshLab\'s viewport: fov $45°$ ($f = 2.4142$), $600$ pixels tall. How wide is a push of $0.01$ at distance $5$, and a push of $0.0035 \\times 5$?',
      steps: [
        { expression: '0.01 \\times 2.4142 \\times 300 / 5 = 1.45', annotation: 'Width × f × (H / 2) / distance.' },
        { expression: '0.0175 \\times 2.4142 \\times 300 / 5 = 2.53', annotation: 'The push grew with the distance.' },
        { expression: '0.0035 \\times 2.4142 \\times 300 = 2.53', annotation: 'The same number at any distance: the distance cancels.' },
      ],
      conclusion: 'A fixed push of $0.01$ is $1.45$ pixels at $5$; a push of $0.0035 d$ is $2.53$ pixels at $5$, and at every other distance too.',
    },
    {
      id: 'modelling-geometry-3-006-ex2',
      title: 'A back face pushed towards the eye',
      problem: 'The recess\'s top wall faces down, away from the eye at $(0.9, 1.3, 2.6)$. Its corner on the panel has smooth normal mostly along $+z$. Which way does the push move that corner, relative to the eye?',
      steps: [
        { expression: '\\hat{n}_{\\text{wall}} \\cdot (e - p) < 0', annotation: 'Step 4: the wall is a back face, so the hull\'s copy of it is drawn.' },
        { expression: '\\hat{n}_v \\approx \\text{panel normal } (0, 0, 1) \\text{ plus a little of the walls\'}', annotation: 'Lesson 3.5: the corner\'s normal is averaged, and the panel is the biggest face there.' },
        { expression: '\\hat{n}_v \\cdot \\hat{e} > 0', annotation: 'Cell 2: the normal has a positive part towards the eye.' },
        { expression: 'p\' \\text{ moves towards the eye by } k d \\, (\\hat{n}_v \\cdot \\hat{e})', annotation: 'So a drawn back face comes out in front of the panel along the crease.' },
      ],
      conclusion: 'The corner moves towards the viewer, so part of a drawn back face lands in front of the panel: a stray line inside the box, unless the stencil removes it.',
    },
    {
      id: 'modelling-geometry-3-006-ex3',
      title: 'k for a chosen width',
      problem: 'A $4$-pixel outline on a $720$-pixel-tall view with a $60°$ field of view. What $k$?',
      steps: [
        { expression: 'f = 1 / \\tan 30° = 1.7321', annotation: 'Half the field of view.' },
        { expression: 'k = 2 \\times 4 / (1.7321 \\times 720) = 0.006415', annotation: 'Step 1: k = 2p / (f H).' },
        { expression: '0.006415 \\times 1.7321 \\times 360 = 4.0', annotation: 'Check: k f H / 2.' },
      ],
      conclusion: '$k = 0.0064$ gives a 4-pixel outline at every distance on that view.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-3-006-ch1',
      difficulty: 'easy',
      problem: 'With MeshLab\'s $k = 0.0035$, how wide is the outline on a $1200$-pixel-tall viewport with a $45°$ field of view?',
      walkthrough: [
        { expression: '0.0035 \\times 2.4142 \\times 600 = 5.07', annotation: 'k f H / 2 with H / 2 = 600.' },
      ],
      answer: 'About 5.07 pixels: twice the 2.53 of a 600-pixel view, because the width is in proportion to the image height.',
    },
    {
      id: 'modelling-geometry-3-006-ch2',
      difficulty: 'medium',
      problem: 'A plane (a single quad, open) is selected. Its outline appears from some angles and not from others. Why?',
      walkthrough: [
        { expression: '\\text{one face: front from one side, back from the other}', annotation: 'An open mesh has no second layer behind it.' },
        { expression: '\\text{seen from the front: hull back faces} = \\emptyset', annotation: 'Nothing is drawn: no outline.' },
        { expression: '\\text{seen from behind: the whole hull face is a back face}', annotation: 'Then the hull\'s copy is drawn, a slightly bigger quad, wherever nothing hides it.' },
      ],
      answer: 'The inverted hull needs a closed mesh: a single quad has back faces only when seen from behind, so its outline comes and goes with the viewing side (MeshLab draws such faces double-sided, which hides the effect only partly).',
    },
    {
      id: 'modelling-geometry-3-006-ch3',
      difficulty: 'hard',
      problem: 'A toon-shaded game draws ink lines with an inverted hull and no stencil. Lines appear inside a character\'s elbow crease. Give two fixes and what each costs.',
      walkthrough: [
        { expression: '\\text{crease: averaged normals push hidden back faces forward}', annotation: 'The same mechanism as the recessed panel.' },
        { expression: '\\text{fix 1: stencil the body, draw the hull where unmarked}', annotation: 'Exact, but it also removes ink lines the artist may want inside the silhouette (an arm in front of the body).' },
        { expression: '\\text{fix 2: push along normals smoothed less, or a smaller k in creases}', annotation: 'Keeps inner lines, but needs per-vertex tuning and can leave gaps.' },
      ],
      answer: 'Stencil the body (exact, but drops every inner line, including wanted ones such as an arm over the chest), or tame the push in creases with less-averaged normals or a per-vertex thickness (keeps inner lines, costs tuning and risks gaps).',
    },
  ],

  semantics: {
    core: [
      { symbol: 'k', meaning: 'The outline\'s push as a fraction of distance; MeshLab uses 0.0035.' },
      { symbol: 'k f H / 2', meaning: 'The outline\'s width in pixels: the distance cancels.' },
      { symbol: 'p + k d \\hat{n}_v', meaning: 'A hull vertex: pushed out along its smooth normal by k times its distance.' },
      { symbol: '\\text{back face}', meaning: 'A face whose normal points away from the eye; only the hull\'s back faces are drawn.' },
      { symbol: '\\text{stencil}', meaning: 'A per-pixel mark; the body writes 1, and the hull is drawn only where it is not 1.' },
      { symbol: '\\hat{n}_v \\cdot \\hat{e}', meaning: 'How far a pushed vertex moves towards the eye; positive at a crease corner of a back face.' },
    ],
    rulesOfThumb: [
      'Anything that should look the same size on screen: make its world size proportional to distance.',
      'Push the hull along smooth normals, never flat ones.',
      'Draw the hull\'s back faces only.',
      'If outline lines show inside an object, stencil the body.',
      'Outlines need closed meshes; open ones outline only from behind.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-3-002', label: 'Projection', note: 'Size on screen is divided by distance; NDC to pixels multiplies by H / 2.' },
      { lessonId: 'modelling-geometry-3-004', label: 'The depth buffer', note: 'The depth test hides hull faces behind the body; polygon offset keeps wire lines on top.' },
      { lessonId: 'modelling-geometry-3-005', label: 'Flat and smooth shading', note: 'The hull is pushed along averaged vertex normals, which lean at creases.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-3-007', label: 'A camera you can place, and a still image', note: 'Rendering a still hides the outline and every other overlay.' },
      { lessonId: 'modelling-geometry-4-001', label: 'Picking by ray', note: 'Clicking selects the object whose silhouette is under the mouse, the shape the outline traces.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-3-006-1', label: 'Read why pushing by k × distance gives a constant width on screen', type: 'read' },
    { id: 'cp-modelling-geometry-3-006-2', label: 'Read how an inverted hull\'s back faces make a rim', type: 'read' },
    { id: 'cp-modelling-geometry-3-006-3', label: 'Read how the stencil test keeps the outline outside the body', type: 'read' },
    { id: 'cp-modelling-geometry-3-006-4', label: 'Run cells 1 to 3: the width, the back faces, the stencil', type: 'lab' },
    { id: 'cp-modelling-geometry-3-006-5', label: 'Compare the two pictures, and switch the stencil off in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-3-006-6', label: 'Work through example 2, a back face pushed towards the eye', type: 'example' },
    { id: 'cp-modelling-geometry-3-006-7', label: 'Work through example 3, k for a chosen width', type: 'example' },
    { id: 'cp-modelling-geometry-3-006-8', label: 'Complete the challenge: a 3-pixel outline', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-3-006-assess-1',
        type: 'choice',
        text: 'An outline is pushed out by k × distance. What happens to its width on screen when the object moves twice as far away?',
        options: ['It stays the same', 'It halves', 'It doubles', 'It quarters'],
        answer: 'It stays the same',
        hint: 'The push doubles and the divide by distance halves it: k f H / 2.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-3-006-quiz-1',
      type: 'choice',
      text: 'A line 0.02 wide is 4 pixels across at distance 3. How wide is it at distance 6?',
      options: ['2 pixels', '4 pixels', '8 pixels', '1 pixel'],
      answer: '2 pixels',
      hints: ['Size on screen is divided by distance.', 'Twice as far: half as wide.'],
      reviewSection: 'Intuition: the first paragraph, and cell 1',
    },
    {
      id: 'modelling-geometry-3-006-quiz-2',
      type: 'choice',
      text: 'Which faces of the inverted hull are drawn?',
      options: ['Back faces only', 'Front faces only', 'Both', 'Only those inside the body'],
      answer: 'Back faces only',
      hints: ['Front faces would cover the object.', 'Back faces are hidden behind it, except at the rim.'],
      reviewSection: 'Procedure step 4',
    },
    {
      id: 'modelling-geometry-3-006-quiz-3',
      type: 'choice',
      text: 'Why must the hull be pushed along smooth (averaged) normals?',
      options: ['Along flat normals its faces move apart and gaps open at the corners', 'Smooth normals are shorter', 'Flat normals point inwards', 'The stencil needs them'],
      answer: 'Along flat normals its faces move apart and gaps open at the corners',
      hints: ['Each face would move along its own direction.', 'The shell must stay closed.'],
      reviewSection: 'Warning "The hull needs smooth normals"',
    },
    {
      id: 'modelling-geometry-3-006-quiz-4',
      type: 'choice',
      text: 'With the stencil, where is a hull pixel kept?',
      options: ['Only where no selected body covers the pixel', 'Only where the body covers it', 'Everywhere', 'Only on front faces'],
      answer: 'Only where no selected body covers the pixel',
      hints: ['The body writes 1; the hull is drawn where the mark is not 1.', 'That is outside the silhouette.'],
      reviewSection: 'Intuition: the stencil paragraph, and cell 3',
    },
    {
      id: 'modelling-geometry-3-006-quiz-5',
      type: 'choice',
      text: 'Which of these does NOT change the outline\'s width in pixels?',
      options: ['Moving the object further away', 'A narrower field of view', 'A taller image', 'A bigger k'],
      answer: 'Moving the object further away',
      hints: ['Width = k f H / 2.', 'Distance is not in it.'],
      reviewSection: 'Rigor: invariant viewpoint',
    },
    {
      id: 'modelling-geometry-3-006-quiz-6',
      type: 'choice',
      text: 'Where do stray outline lines inside an object come from?',
      options: ['Hull back faces at concave creases pushed in front of nearby surface', 'Z-fighting between body and hull', 'The grid', 'Front faces of the hull'],
      answer: 'Hull back faces at concave creases pushed in front of nearby surface',
      hints: ['Averaged normals lean towards the open side of a crease.', 'Cell 2: the push moves those corners towards the eye.'],
      reviewSection: 'Math: "Why creases break it"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'An outline is drawn by finding the silhouette edges and drawing lines along them.',
      whyStudentsThinkIt: 'That is how you would draw it by hand.',
      correctionExample: 'MeshLab draws a pushed-out copy of the whole mesh, back faces only, and the rim is what survives the depth and stencil tests: no edge is ever found.',
      contrastCase: 'Wire mode does draw edges as lines, every one of them, with no notion of silhouette.',
    },
    {
      falseBelief: 'A line of fixed thickness in 3D looks the same at any distance.',
      whyStudentsThinkIt: 'Its size in the world does not change.',
      correctionExample: 'A push of 0.01 is 3.62 pixels at distance 2 and 0.36 at distance 20.',
      contrastCase: 'A push of 0.0035 × distance is 2.53 pixels at both.',
    },
    {
      falseBelief: 'An inverted hull can never show inside the object.',
      whyStudentsThinkIt: 'Its back faces are behind the body.',
      correctionExample: 'Cell 4, left: at the recessed panel\'s edges, back faces pushed along averaged normals come in front of the panel.',
      contrastCase: 'On a convex box with no recess, the hull shows only as a rim, stencil or not.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A game needs a 2-pixel glow round any item the player can pick up, at any distance.',
      competingTechniques: ['Scale a copy of the item up by 5% and draw it behind', 'An inverted hull pushed by k × distance with k = 2·2/(f H), stencilled'],
      whyThisTechniqueWins: 'Scaling by 5% makes the glow grow and shrink with distance and fails on long thin items; a push proportional to distance holds 2 pixels exactly, and the stencil keeps it outside.',
    },
    {
      situation: 'A selected object is an open mesh (a cloth sheet) and its outline flickers in and out.',
      competingTechniques: ['Increase k', 'Use a screen-space outline: detect edges in the selection mask after drawing', 'Make the cloth double-sided'],
      whyThisTechniqueWins: 'An inverted hull needs a closed mesh; drawing a mask of the selected pixels and outlining its edge on screen works for any mesh. A bigger k or double-sidedness does not give it the back faces it lacks.',
    },
  ],

  debugging: [
    {
      commonError: 'Pushing the hull a fixed world distance.',
      symptom: 'The outline is thick on nearby objects and disappears on distant ones.',
      whyItHappened: 'Size on screen is divided by distance; a fixed push shrinks with it.',
      repairStrategy: 'Push by k times the vertex\'s distance in front (−z in camera space), in the vertex shader.',
    },
    {
      commonError: 'Creating the renderer without a stencil buffer.',
      symptom: 'The stencil settings on the materials do nothing; crease lines stay.',
      whyItHappened: 'With no stencil buffer there is nothing to write to or test.',
      repairStrategy: 'Create the WebGLRenderer with stencil: true, and draw the hull after the bodies (renderOrder).',
    },
    {
      commonError: 'Drawing the hull before the body.',
      symptom: 'With the stencil on, the outline covers the whole object or vanishes.',
      whyItHappened: 'The stencil marks are not written yet when the hull is tested.',
      repairStrategy: 'Draw bodies first, then hulls (a higher renderOrder).',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Choose k for a given width in pixels, decide which hull faces are drawn, and apply the stencil test.',
    explainVerbally: 'Explain why the distance cancels, why back faces make a rim, and why creases need the stencil.',
    detectIncorrectApplication: 'Recognise a fixed-size push, flat-normal gaps, crease lines and a missing stencil buffer from their symptoms.',
    transferToUnfamiliar: 'Design a constant-width glow for game items, or switch to a screen-space outline for open meshes.',
  },
};
