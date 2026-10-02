// Lesson 3.5: flat and smooth shading. One normal per face gives facets; one normal per vertex, averaged from the
// faces round it, gives smooth curves, but drags hard edges round; auto smooth splits normals at sharp edges.
import { withPicture } from '../notebookScene.js';

// A cylinder like MeshLab's: radius 1, height 2, 16 sides; bottom ring 0–15 at y = −1, top ring 16–31 at y = 1.
const CYL = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const f3 = (v) => v.map(r).join(', ')
const n = 16, verts = [], faces = []
for (const y of [-1, 1]) for (let k = 0; k < n; k++) verts.push([Math.cos(2 * Math.PI * k / n), y, Math.sin(2 * Math.PI * k / n)])
faces.push([...Array(n).keys()])                                  // the bottom cap (faces down)
faces.push([...Array(n).keys()].map((k) => n + (n - k) % n))      // the top cap (faces up)
for (let k = 0; k < n; k++) faces.push([(k + 1) % n, k, n + k, n + (k + 1) % n])   // the sides, facing out
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l) }
// A face's cross products, summed over a fan of triangles: its normal times twice its area.
function areaNormal(face) {
  let s = [0, 0, 0]
  for (let i = 1; i + 1 < face.length; i++) s = s.map((x, j) => x + cross(sub(verts[face[i]], verts[face[0]]), sub(verts[face[i + 1]], verts[face[0]]))[j])
  return s
}
// The face's angle at one of its corners.
function angleAt(face, k) {
  const p = verts[face[k]], a = unit(sub(verts[face[(k + face.length - 1) % face.length]], p)), b = unit(sub(verts[face[(k + 1) % face.length]], p))
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b))))
}
`;

const FLAT = `${CYL}
// Flat shading: one normal per face, the same at all its corners.
const side = faces[2], cap = faces[0]
console.log('a side face: normal ' + f3(unit(areaNormal(side))) + ', area ' + r(Math.hypot(...areaNormal(side)) / 2))
console.log('the bottom cap: normal ' + f3(unit(areaNormal(cap))) + ', area ' + r(Math.hypot(...areaNormal(cap)) / 2))
console.log('flat shading uses ' + faces.length + ' normals, one per face')`;

const AVERAGE = `${CYL}
// Smooth shading: vertex 0, on the bottom rim, takes one normal averaged from the faces round it.
const round = faces.map((face, fi) => ({ face, fi, k: face.indexOf(0) })).filter((x) => x.k >= 0)
console.log('vertex 0 is on faces ' + round.map((x) => x.fi).join(', '))
for (const weight of ['area', 'angle']) {
  let s = [0, 0, 0]
  for (const { face, k } of round) {
    const w = weight === 'area' ? Math.hypot(...areaNormal(face)) / 2 : angleAt(face, k)
    s = s.map((x, j) => x + unit(areaNormal(face))[j] * w)
  }
  const nrm = unit(s)
  console.log(weight + '-weighted: ' + f3(nrm) + ', tilted ' + r(Math.asin(-nrm[1]) * 180 / Math.PI) + '° down from the side')
}`;

const LIGHT = `${CYL}
// A light from the upper right: L points towards it. Brightness is N · L (lesson 2.1), clipped at 0.
const L = [0.6, 0.8, 0]
const sideN = unit(areaNormal(faces[2]))
console.log('the side face\\'s own normal: N · L = ' + r(Math.max(0, dot(sideN, L))))
console.log('vertex 0, area-weighted (0.4472, -0.8944, 0): N · L = ' + r(Math.max(0, dot([0.4472, -0.8944, 0], L))))
console.log('so across the side face the light fades from ' + r(dot(sideN, L)) + ' to 0 at the bottom rim: the dark smear')`;

const AUTO = `${CYL}
// Auto smooth: a corner averages only the faces round its vertex within 30° of its own face.
const fn = faces.map((face) => unit(areaNormal(face))), limit = Math.cos(30 * Math.PI / 180)
const corner = faces.map((face, fi) => face.map((v) => {
  let s = [0, 0, 0]
  faces.forEach((g, gi) => { if (g.includes(v) && dot(fn[gi], fn[fi]) >= limit - 1e-12) s = s.map((x, j) => x + areaNormal(g)[j]) })
  return unit(s)
}))
console.log('vertex 0 on the side face: ' + f3(corner[2][faces[2].indexOf(0)]) + '; on the cap: ' + f3(corner[0][0]))
// The GPU keeps one normal per vertex, so a position is sent once for each different normal its corners need.
const sent = (normalAt) => new Set(faces.flatMap((face, fi) => face.map((v, k) => v + '|' + normalAt(fi, k, v).map((x) => x.toFixed(6)).join()))).size
const vn = verts.map((_, v) => { let s = [0, 0, 0]; faces.forEach((g) => { if (g.includes(v)) s = s.map((x, j) => x + areaNormal(g)[j]) }); return unit(s) })
console.log('vertices sent to the GPU: flat ' + sent((fi) => fn[fi]) + ', smooth ' + sent((fi, k, v) => vn[v]) + ', auto smooth ' + sent((fi, k) => corner[fi][k]))`;

const PICTURE_CODE = `${CYL}
// Three copies side by side: flat, smooth (area-weighted), auto smooth (30°). Each corner gets its normal.
const fn = faces.map((face) => unit(areaNormal(face))), limit = Math.cos(30 * Math.PI / 180)
const vn = verts.map((_, v) => { let s = [0, 0, 0]; faces.forEach((g) => { if (g.includes(v)) s = s.map((x, j) => x + areaNormal(g)[j]) }); return unit(s) })
const flat = faces.map((face, fi) => face.map(() => fn[fi]))
const smooth = faces.map((face) => face.map((v) => vn[v]))
const auto = faces.map((face, fi) => face.map((v) => {
  let s = [0, 0, 0]
  faces.forEach((g, gi) => { if (g.includes(v) && dot(fn[gi], fn[fi]) >= limit - 1e-12) s = s.map((x, j) => x + areaNormal(g)[j]) })
  return unit(s)
}))
const all = { verts: [], faces: [], groups: [], shading: [] }
for (const [i, normals] of [flat, smooth, auto].entries()) {
  const base = all.verts.length
  all.verts.push(...verts.map((p) => [p[0] + (i - 1) * 2.6, p[1], p[2]]))
  faces.forEach((face, fi) => { all.faces.push(face.map((v) => v + base)); all.groups.push(0); all.shading.push(normals[fi]) })
}
console.log('left: flat; middle: smooth; right: auto smooth 30°')
show({ ...all, zoom: 1.6 })`;

const CHALLENGE = `// A box 2 long (x), 1 tall (y) and 1 deep (z) has a corner at the origin, where three faces meet:
// the face at x = 0 (normal (-1, 0, 0)), the face at y = 0 (normal (0, -1, 0)), the face at z = 0 (normal (0, 0, -1)).
// What is the corner's AREA-weighted smooth normal? (Unit length.)
const normal = [0, 0, 0]

console.log('normal ' + normal.join(', ') + ', length ' + Math.hypot(...normal).toFixed(4))`;

const SOLVED = CHALLENGE.replace('const normal = [0, 0, 0]', 'const normal = [-1 / 3, -2 / 3, -2 / 3]');

const RIGHT = [-1 / 3, -2 / 3, -2 / 3];

/** The challenge's check: read the normal (numbers or fractions) and name the slip. */
export function checkCorner(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/^\s*const\s+normal\s*=\s*\[([^\]\n]*)\]/m);
  const parts = m ? m[1].split(',').map((s) => s.trim()) : [];
  if (parts.length !== 3 || !parts.every((s) => /^-?[\d.]+(\s*\/\s*[\d.]+)?$/.test(s))) return no('Keep const normal = [x, y, z] with three numbers or fractions such as -2 / 3.');
  const v = parts.map((s) => s.split('/').map(Number).reduce((a, b) => a / b));
  const near = (q, tol = 0.005) => q.every((x, i) => Math.abs(x - v[i]) < tol);
  const fmt = (q) => `(${q.map((x) => +x.toFixed(4)).join(', ')})`;
  if (near(RIGHT)) return { pass: true, message: `${fmt(v)}: the faces have areas 1 (x = 0, 1 × 1), 2 (y = 0, 2 × 1) and 2 (z = 0, 2 × 1); the weighted sum is (−1, −2, −2), which is 3 long. The two big faces pull the normal towards themselves.` };
  if (v.every((x) => x === 0)) return no('Weight each face\'s normal by its area, add them, and make the result 1 long.');
  const s3 = -1 / Math.sqrt(3);
  if (near([s3, s3, s3])) return no(`${fmt(v)} weights all three faces equally. That is also what angle weighting gives here (every angle at a box corner is 90°), but area weighting counts the two 2 × 1 faces twice as much as the 1 × 1 face.`);
  if (near([-1, -2, -2], 0.01)) return no(`${fmt(v)} is the weighted sum, 3 long. Divide by its length to make it a unit normal.`);
  if (near(RIGHT.map((x) => -x))) return no(`${fmt(v)} points into the box. The faces\' normals point out, (−1, 0, 0) and so on, so their average does too.`);
  if (near([-2 / 3, -1 / 3, -2 / 3]) || near([-2 / 3, -2 / 3, -1 / 3])) return no(`${fmt(v)} has the areas on the wrong faces. The face at x = 0 is the small one: it is 1 tall and 1 deep.`);
  const l = Math.hypot(...v);
  if (Math.abs(l - 1) > 0.01) return no(`${fmt(v)} is ${+l.toFixed(3)} long; a normal must be 1 long.`);
  return no(`${fmt(v)} is not the area-weighted average. Areas: 1 for x = 0, 2 for y = 0, 2 for z = 0.`);
}

export default {
  id: 'modelling-geometry-3-005',
  slug: 'flat-and-smooth-shading',
  chapter: 'modelling-geometry',
  order: 5,
  title: 'Flat and smooth shading',
  subtitle: 'One normal per face makes facets; one per vertex makes curves. Average them well, and keep hard edges hard.',
  tags: ['shading', 'vertex normals', 'smooth shading', 'auto smooth', 'hard edges'],
  coreConcept: 'Flat shading uses each face\'s own normal; smooth shading gives each vertex a weighted average of the normals of the faces round it (by area or by angle) and blends it across faces; auto smooth averages only faces within an angle of each other, so sharp edges keep separate normals and stay crisp.',
  prerequisites: ['modelling-geometry-1-002', 'modelling-geometry-3-003', 'modelling-geometry-2-001'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-3-006',

  hook: {
    question: 'A 16-sided cylinder looks faceted. Click Shade smooth and its sides become round, but dark smears appear along its rims. Where do they come from, and how do modellers get round sides with crisp rims?',
    realWorldContext: 'Every game asset and every model in a modelling tool chooses, edge by edge, whether the light should blend across it or break. That is decided by vertex normals: how they are averaged, and where they are split. Blender\'s Shade smooth, Shade auto smooth and sharp edges are all this one idea.',
  },

  intuition: {
    prose: [
      'Take a cylinder with $16$ flat sides, radius $1$, height $2$. Each side face has its own **face normal**: the side at angle $0$ points along about $(0.98, 0, 0.20)$. The light on a face depends on its normal (lesson 2.1: brightness is $N \\cdot L$). With one normal per face, each face is one even shade. That is **flat shading**, and the $16$ sides show as facets.',
      'A real cylinder is round: its normal turns smoothly round it. **Smooth shading** fakes that. Each vertex gets one **vertex normal**, an average of the normals of the faces that meet there. The rasterizer (lesson 3.3) blends the vertex normals across each face, and the light is computed with the blended normal at every pixel. The facets disappear.',
      'An average of what, exactly? Vertex $0$, on the bottom rim, touches three faces: two sides, each with area $0.78$, and the bottom cap, a $16$-sided face with area $3.06$. **Area weighting** counts each face in proportion to its area. Before running cell 2, predict: which way does vertex 0\'s normal point?',
      'Mostly down. The cap is four times bigger than either side, so it pulls the normal to $(0.4472, -0.8944, 0)$: $63°$ down from the side\'s direction. Light from the upper right gives the side face $N \\cdot L = 0.59$ with its own normal but $0$ at the rim. Blended across the face, that is the dark smear.',
      '**Angle weighting** counts each face by its angle at the vertex instead: $157.5°$ for the cap, $90°$ for each side. It still tilts the normal, to $(0.7462, -0.6657, 0)$, and has one big advantage: cutting a face into more triangles does not change it.',
      'The real fix is to not average across the rim at all. The rim is a **hard edge**: the faces on its two sides are $90°$ apart. **Auto smooth** gives each face corner its own normal, averaged only over the faces round that vertex within a set angle (often $30°$) of the corner\'s own face. At vertex $0$, the side faces\' corners get $(1, 0, 0)$ and the cap\'s corner gets $(0, -1, 0)$. Sides blend; the rim stays crisp.',
      'The GPU stores one normal per vertex, so a position is sent once for each different normal its corners need. The cylinder has $32$ vertices; drawn flat it needs $96$ (every rim vertex has three different face normals), smooth $32$, and with auto smooth $64$ (each rim vertex once for the sides and once for its cap).',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Vertex normals for smooth and auto-smooth shading',
        body: 'Step 1. For each face, sum the cross products of its fan of triangles: the result is its normal times twice its area.\nStep 2. For each vertex, list the faces round it.\nStep 3. Weight each face: by its area (half the length from Step 1), or by its angle at the vertex.\nStep 4. Add the faces\' unit normals times their weights, and make the sum one unit long: the vertex normal.\nStep 5. For auto smooth, do Step 4 once per face corner, using only the faces within the angle (say $30°$) of that corner\'s face.\nStep 6. Send one normal per corner to the GPU; corners on hard edges get different normals.',
      },
      {
        type: 'warning',
        title: 'Smooth shading does not change the shape',
        body: 'Only the normals change, so only the light changes. The silhouette of a 16-sided cylinder is still a 16-sided polygon, and its shadow still has 16 corners. If the outline looks faceted, add geometry (subdivision, lesson 6.1), not smoothing.',
      },
      {
        type: 'warning',
        title: 'Big faces next to small ones smear',
        body: 'Area weighting lets one big face (a cap, a floor) dominate every vertex it touches. Cures: auto smooth, marking the edge sharp, angle weighting, or a support loop of thin faces near the edge (lesson 5.3).',
      },
      {
        type: 'insight',
        title: 'The graphics strand: faceted versus smooth',
        body: 'Flat shading on the GPU is the same normal at a triangle\'s three corners (or the material\'s flatShading, which computes it per pixel from the screen-space slope). Smooth shading is three different normals blended by the barycentric weights. three.js\'s computeVertexNormals is area-weighted; Blender weights by angle (and optionally by area); glTF files carry the normals exactly as the tool split them.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "smooth shading makes the model smooth". All three cylinders have exactly the same 32 vertices and 18 faces; only the normals differ. Left: facets. Middle: round sides, smeared rims. Right: round sides, crisp rims. Invariant: the outline, the same 16-sided shape in all three.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'areaNormal() in the cells is Step 1; the loop in cell 2 is Steps 2 to 4 with both weights; cell 4\'s corner normals are Step 5.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The normals of Step 6 go in the geometry\'s normal attribute; the vertex shader passes them on and the rasterizer blends them, so the fragment shader sees a smooth normal at every pixel.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Object › Shade smooth averages by area everywhere; Object › Shade auto smooth (30°) splits normals at sharper edges; Mesh › Trace the vertex normal (one vertex) traces Steps 2 to 5 for a selected vertex.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: vertex normals',
        caption: 'Face normals, weighted vertex normals, the light they give, auto smooth, and three cylinders side by side.',
        props: {
          lesson: {
            title: 'Flat and smooth shading',
            subtitle: 'Average face normals into vertex normals, by area and by angle, and split them at hard edges.',
            cells: [
              { type: 'js', instruction: '### 1. Flat: one normal per face\nA side face and the cap: their normals and areas.', startCode: FLAT },
              { type: 'js', instruction: '### 2. Smooth: one normal per vertex\nPredict first: which way does the rim vertex\'s normal point? Then weigh the three faces by area and by angle.', startCode: AVERAGE },
              { type: 'js', instruction: '### 3. Where the smear comes from\nThe light the side face gets with its own normal, and with the rim vertex\'s averaged one.', startCode: LIGHT },
              { type: 'js', instruction: '### 4. Auto smooth\nEach corner averages only faces within 30° of its own face: the rim gets two normals.', startCode: AUTO },
              { type: 'js', instruction: '### 5. See all three\nFlat, smooth and auto smooth: the same mesh, different normals. Drag to turn the picture.', startCode: withPicture(PICTURE_CODE), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 6. Challenge: a box corner\nThe area-weighted normal where three faces of different sizes meet. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkCorner },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Flat and smooth shading" in MeshLab](#/lab/mesh-lab?project=flat-and-smooth). Three cylinders: flat, smooth, auto smooth. With **Record traces** on, the script traces vertex 0\'s normal on the smooth one. In **Predict** mode, predict the cap\'s weight, then the averaged normal. Compare with cell 2. Then auto-smooth it.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Object › Shade flat / Shade smooth / Shade auto smooth (30°).**\n- **Mesh › Trace the vertex normal (one vertex):** in edit mode, vertex select, one vertex selected.\n- **Normals** (toolbar) draws the face normals.\n- In a script: object.smooth = true, object.autoSmooth = 30, mesh.vertexNormal(v, { weight: \'angle\' }).\n- **In Blender:** right-click › Shade Smooth, Shade Auto Smooth (an angle, 30° by default), Shade Flat; Edge › Mark Sharp splits normals along chosen edges whatever their angle.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why the fan of cross products gives area.** Each triangle\'s cross product has length twice its area and points along the face\'s normal (lesson 2.1). A flat face\'s triangles all share that normal, so their cross products add to the normal times twice the face\'s area.',
      '**Why averaging normals approximates a curve.** On a real cylinder the normal at a point is the direction straight out of the surface. At vertex $0$ of the side faces, the true normal is $(1, 0, 0)$. The two side faces\' normals are $11.25°$ either side of it, so their average is exactly $(1, 0, 0)$: averaging recovers the true curve\'s normal.',
      '**Why the cap ruins it.** The cap\'s normal $(0, -1, 0)$ is $90°$ from the side. Its weight, $3.06$ against $0.78 + 0.78$, pulls the average to $\\frac{3.06 (0, -1, 0) + 1.56 (1, 0, 0)}{|\\ldots|} = (0.447, -0.894, 0)$. No real surface through the rim has that normal: the average is meaningless across a hard edge.',
      '**Why angle weights survive cutting.** Cut a face into two triangles through a vertex: the face\'s angle at that vertex is split into two angles that add up to it, each with the same normal. Their weighted contribution is unchanged. Area weights also add up, but a cut through another vertex changes which triangles touch this one, so only angle weighting is fully independent of how faces are split.',
    ],
    equations: [
      { label: 'Face normal and area', latex: '\\vec{A}_f = \\sum_{i} (v_i - v_0) \\times (v_{i+1} - v_0) = 2 \\, \\text{area}(f) \\, \\hat{n}_f' },
      { label: 'Vertex normal', latex: '\\hat{n}_v = \\frac{\\sum_{f \\ni v} w_f \\, \\hat{n}_f}{\\big| \\sum_{f \\ni v} w_f \\, \\hat{n}_f \\big|}, \\quad w_f = \\text{area}(f) \\text{ or } \\theta_f(v)' },
      { label: 'Auto smooth', latex: '\\hat{n}_{f, v} \\propto \\sum_{g \\ni v, \\; \\hat{n}_g \\cdot \\hat{n}_f \\ge \\cos 30°} w_g \\, \\hat{n}_g' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** A polygon mesh has no tangent plane at its vertices and edges, so it has no normal there. A vertex normal is a choice: an estimate of the normal of a smooth surface the mesh approximates. Area- and angle-weighted averages converge to the true normal as a smooth surface is sampled more finely (with regular sampling), and no average is meaningful across a crease.',
      '**Invariant viewpoint.** Shading changes the light, never the geometry: silhouettes, shadows and intersections are those of the flat faces. Auto smooth is invariant to the mesh being turned or moved: it depends only on angles between faces.',
      '**Geometric picture.** Picture the unit normals of the faces round a vertex as points on a sphere. Smooth shading picks their weighted centre. Auto smooth first groups the points into clusters within $30°$ of each face, and picks a centre per cluster: one cluster on a smooth patch, two on an edge, three at a corner.',
      '**Where this goes.** Normal maps (chapter 9) store a different normal at every pixel, faking far more detail than the mesh has. Curvature (chapter 7) measures how fast these normals turn. Subdivision surfaces (chapter 6) add real geometry so that smooth shading and silhouettes finally agree.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-3-005-ex1',
      title: 'A cube corner',
      problem: 'A cube of side $2$ centred at the origin has a corner at $(-1, -1, -1)$. What is its smooth (area-weighted) normal?',
      steps: [
        { expression: '\\hat{n} = (-1, 0, 0), \\; (0, -1, 0), \\; (0, 0, -1)', annotation: 'Step 2: three faces meet at the corner; their normals point out.' },
        { expression: 'w = 4, 4, 4', annotation: 'Step 3: every face of the cube is 2 × 2.' },
        { expression: '\\sum = (-4, -4, -4), \\quad |\\sum| = 4\\sqrt{3}', annotation: 'Step 4: add.' },
        { expression: '\\hat{n}_v = (-0.5774, -0.5774, -0.5774)', annotation: 'Divide by the length: straight out of the corner.' },
      ],
      conclusion: 'The corner\'s smooth normal points straight out along the diagonal, which is why a smooth-shaded cube looks like a blob: every corner is rounded off in the light.',
    },
    {
      id: 'modelling-geometry-3-005-ex2',
      title: 'The cylinder\'s rim vertex',
      problem: 'Vertex $0$ of the 16-sided cylinder touches the cap (area $3.0615$, normal $(0, -1, 0)$) and two sides (area $0.7804$, normals $(0.9808, 0, \\pm 0.1951)$). Find its area-weighted normal.',
      steps: [
        { expression: '3.0615 \\, (0, -1, 0) = (0, -3.0615, 0)', annotation: 'Step 4, the cap.' },
        { expression: '0.7804 \\, (0.9808, 0, 0.1951) + 0.7804 \\, (0.9808, 0, -0.1951) = (1.5308, 0, 0)', annotation: 'The two sides: their z parts cancel.' },
        { expression: '(1.5308, -3.0615, 0) / 3.4229 = (0.4472, -0.8944, 0)', annotation: 'Add and make it 1 long.' },
      ],
      conclusion: 'The normal points $63.4°$ down: the cap dominates, and the sides near the rim are shaded as if they faced the floor.',
    },
    {
      id: 'modelling-geometry-3-005-ex3',
      title: 'The same vertex with auto smooth',
      problem: 'With auto smooth at $30°$, which normals does vertex $0$ get?',
      steps: [
        { expression: '\\hat{n}_{\\text{side}} \\cdot \\hat{n}_{\\text{cap}} = 0 < \\cos 30° = 0.866', annotation: 'Step 5: the cap is 90° from either side, so the sides\' corners leave it out.' },
        { expression: '\\text{side corners: } (1.5308, 0, 0) / 1.5308 = (1, 0, 0)', annotation: 'The two sides are 22.5° apart, within 30°: they average to the true outward normal.' },
        { expression: '\\text{cap corner: } (0, -1, 0)', annotation: 'The cap\'s corner sees only the cap.' },
      ],
      conclusion: 'Two normals at one vertex: $(1, 0, 0)$ for the sides and $(0, -1, 0)$ for the cap. The rim is crisp and the sides stay round.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-3-005-ch1',
      difficulty: 'easy',
      problem: 'Four faces of equal area meet at a vertex, with normals $(0, 1, 0)$, $(0, 1, 0)$, $(1, 0, 0)$ and $(-1, 0, 0)$. What is the vertex normal?',
      walkthrough: [
        { expression: '(0, 2, 0) + (1, 0, 0) + (-1, 0, 0) = (0, 2, 0)', annotation: 'Equal weights: just add the unit normals.' },
        { expression: '(0, 1, 0)', annotation: 'Make it 1 long.' },
      ],
      answer: 'Straight up, (0, 1, 0): the two side faces cancel and the two up faces agree.',
    },
    {
      id: 'modelling-geometry-3-005-ch2',
      difficulty: 'medium',
      problem: 'A modeller splits a cylinder\'s cap into 16 triangles round a centre vertex. With area weighting, does the rim smear get better or worse?',
      walkthrough: [
        { expression: '\\text{cap area at vertex 0: } 3.06 \\to \\text{two triangles of } 0.19 \\text{ each}', annotation: 'Now only the two cap triangles touching vertex 0 count, not the whole cap.' },
        { expression: '0.38 \\, (0, -1, 0) + 1.53 \\, (1, 0, 0)', annotation: 'The sides now outweigh the cap four to one.' },
        { expression: '\\text{tilt} = \\arctan(0.38 / 1.53) \\approx 14°', annotation: 'Much less than 63°.' },
      ],
      answer: 'Better: the cap now touches the rim vertex only through two thin triangles, so area weighting tilts the normal about 14° instead of 63°. The smear shrinks but is still there; auto smooth removes it entirely.',
    },
    {
      id: 'modelling-geometry-3-005-ch3',
      difficulty: 'hard',
      problem: 'A game model looks right in the modelling tool but its hard edges smear in the engine. The export has one normal per vertex. What went wrong, and what must the exported mesh contain?',
      walkthrough: [
        { expression: '\\text{hard edge} \\Rightarrow \\text{two normals at one vertex}', annotation: 'Auto smooth gives a vertex on a hard edge one normal per side.' },
        { expression: '\\text{one normal per vertex} \\Rightarrow \\text{averaged across the edge}', annotation: 'The engine (or the exporter) recomputed or merged them into one.' },
        { expression: '\\text{export: split vertices along hard edges, each with its own normal}', annotation: 'glTF and OBJ can carry duplicate positions with different normals.' },
      ],
      answer: 'The split normals were merged into one per vertex, so the engine averaged across the hard edges; the exported mesh must duplicate each vertex on a hard edge, one copy per side, each carrying its own normal (or export the normals and tell the engine not to recompute them).',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\hat{n}_f', meaning: 'A face\'s unit normal: straight out of the face.' },
      { symbol: '\\vec{A}_f', meaning: 'The summed cross products of a face\'s fan: its normal times twice its area.' },
      { symbol: '\\hat{n}_v', meaning: 'A vertex normal: the weighted average of the faces\' normals round the vertex, made 1 long.' },
      { symbol: 'w_f', meaning: 'A face\'s weight in the average: its area, or its angle at the vertex.' },
      { symbol: '\\hat{n}_{f, v}', meaning: 'A corner normal: one per face corner, so a vertex on a hard edge can have several.' },
      { symbol: '30°', meaning: 'A typical auto-smooth angle: faces closer than this blend, sharper edges stay hard.' },
    ],
    rulesOfThumb: [
      'Smooth curved surfaces; keep edges between flat parts hard.',
      'If a smooth model shows dark smears along edges, an average crosses a hard edge.',
      'Angle weighting does not care how faces are triangulated; area weighting does.',
      'Smoothing changes the light, not the silhouette.',
      'Exporting hard edges means duplicating vertices, one per side.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-1-002', label: 'Winding and normals', note: 'Face normals from the right-hand rule, and Newell\'s fan of cross products.' },
      { lessonId: 'modelling-geometry-3-003', label: 'Rasterization', note: 'Vertex normals are blended across each triangle with the barycentric weights.' },
      { lessonId: 'modelling-geometry-2-001', label: 'Vectors, dot and cross', note: 'Brightness N · L, and the dot product test for "within 30°".' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-3-006', label: 'Lines, outlines and overlays', note: 'The selection outline pushes the mesh out along its smooth normals.' },
      { lessonId: 'modelling-geometry-5-004', label: 'Bevel', note: 'A bevel adds real geometry at an edge so it catches light without smearing.' },
      { lessonId: 'modelling-geometry-9-001', label: 'Light and the cosine law', note: 'The lighting that turns these normals into brightness, per pixel.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-3-005-1', label: 'Read how flat and smooth shading differ: one normal per face or per vertex', type: 'read' },
    { id: 'cp-modelling-geometry-3-005-2', label: 'Read how area and angle weights make a vertex normal', type: 'read' },
    { id: 'cp-modelling-geometry-3-005-3', label: 'Read how auto smooth keeps hard edges hard', type: 'read' },
    { id: 'cp-modelling-geometry-3-005-4', label: 'Run cells 1 to 4 and find where the rim smear comes from', type: 'lab' },
    { id: 'cp-modelling-geometry-3-005-5', label: 'Compare the three cylinders, and trace the rim vertex in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-3-005-6', label: 'Work through example 2, the cylinder\'s rim vertex', type: 'example' },
    { id: 'cp-modelling-geometry-3-005-7', label: 'Work through example 3, the same vertex with auto smooth', type: 'example' },
    { id: 'cp-modelling-geometry-3-005-8', label: 'Complete the challenge: a box corner', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-3-005-assess-1',
        type: 'choice',
        text: 'Two faces meet at an edge 60° apart. With auto smooth at 30°, how are the normals at that edge?',
        options: ['Split: each side keeps its own', 'Averaged into one', 'Both point along the edge', 'Set to zero'],
        answer: 'Split: each side keeps its own',
        hint: '60° is more than 30°, so neither face is counted in the other\'s corner normal.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-3-005-quiz-1',
      type: 'choice',
      text: 'What does smooth shading change?',
      options: ['The normals, and so the light', 'The vertex positions', 'The silhouette', 'The number of faces'],
      answer: 'The normals, and so the light',
      hints: ['The mesh keeps its 32 vertices and 18 faces.', 'Look at the outline in cell 5.'],
      reviewSection: 'Warning "Smooth shading does not change the shape"',
    },
    {
      id: 'modelling-geometry-3-005-quiz-2',
      type: 'choice',
      text: 'At the cylinder\'s rim vertex, why does area weighting tilt the normal so far down?',
      options: ['The cap is much bigger than the side faces', 'The cap has more corners', 'The sides face inward', 'The light comes from below'],
      answer: 'The cap is much bigger than the side faces',
      hints: ['Area 3.06 against 0.78 + 0.78.', 'Bigger faces pull harder.'],
      reviewSection: 'Intuition: the prediction, and example 2',
    },
    {
      id: 'modelling-geometry-3-005-quiz-3',
      type: 'choice',
      text: 'Which weighting gives the same vertex normal however the faces are cut into triangles?',
      options: ['Angle weighting', 'Area weighting', 'Equal weighting', 'None of them'],
      answer: 'Angle weighting',
      hints: ['Cutting a face splits its angle at a vertex into parts that add up to it.', 'Math: "Why angle weights survive cutting".'],
      reviewSection: 'Math: "Why angle weights survive cutting"',
    },
    {
      id: 'modelling-geometry-3-005-quiz-4',
      type: 'choice',
      text: 'With auto smooth at 30°, how many normals does a cube corner get?',
      options: ['3', '1', '6', '8'],
      answer: '3',
      hints: ['Three faces meet there, each 90° from the others.', '90° > 30°: no averaging.'],
      reviewSection: 'Rigor: geometric picture',
    },
    {
      id: 'modelling-geometry-3-005-quiz-5',
      type: 'choice',
      text: 'Which of these will NOT make a smooth-shaded cylinder\'s outline round?',
      options: ['Shade auto smooth', 'Adding more sides', 'Subdivision', 'A higher segment count when creating it'],
      answer: 'Shade auto smooth',
      hints: ['Shading changes the light, not the shape.', 'Only more geometry changes the outline.'],
      reviewSection: 'Warning "Smooth shading does not change the shape"',
    },
    {
      id: 'modelling-geometry-3-005-quiz-6',
      type: 'choice',
      text: 'A smooth-shaded box looks like a soft blob. What is the usual fix?',
      options: ['Auto smooth (or mark its edges sharp)', 'Area weighting', 'Flip its normals', 'Raise the near plane'],
      answer: 'Auto smooth (or mark its edges sharp)',
      hints: ['Its 90° edges should stay hard.', 'Averaging across them rounds the light off.'],
      reviewSection: 'Intuition: the auto smooth paragraph',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Smooth shading smooths the model.',
      whyStudentsThinkIt: 'The facets disappear, so the surface looks rounder.',
      correctionExample: 'The three cylinders of cell 5 have identical vertices; the smooth one still has a 16-sided outline.',
      contrastCase: 'Subdivision (lesson 6.1) moves vertices and adds faces: the outline really becomes rounder.',
    },
    {
      falseBelief: 'A vertex has exactly one normal.',
      whyStudentsThinkIt: 'In plain smooth shading it does.',
      correctionExample: 'With auto smooth, vertex 0 of the cylinder has (1, 0, 0) on the side faces and (0, −1, 0) on the cap.',
      contrastCase: 'A vertex in the middle of the cylinder\'s side has one normal under any setting: all faces round it are within 30°.',
    },
    {
      falseBelief: 'Averaging the faces round a vertex always gives the right normal.',
      whyStudentsThinkIt: 'On smooth patches it does, and recovers the true curve\'s normal.',
      correctionExample: 'Across the rim it gives (0.4472, −0.8944, 0), a direction no real surface through the rim has, and the side goes dark.',
      contrastCase: 'At a vertex on the side, the two side faces 22.5° apart average to (1, 0, 0), the true normal.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A car body is mostly smooth panels with a few sharp creases along the doors.',
      competingTechniques: ['Shade the whole car flat', 'Shade smooth with auto smooth (or marked sharp edges) at the creases', 'Shade smooth everywhere'],
      whyThisTechniqueWins: 'The panels need blended normals and the creases need split ones; flat shows facets everywhere, and plain smooth smears every crease.',
    },
    {
      situation: 'A low-poly game wants a deliberately faceted, crystal look.',
      competingTechniques: ['Smooth shading with a normal map', 'Flat shading (or auto smooth at 0°)'],
      whyThisTechniqueWins: 'Flat shading gives each face its own even shade, which is the look; smooth shading would hide the facets the style is built on.',
    },
  ],

  debugging: [
    {
      commonError: 'Smooth-shading a model with large flat faces next to small curved ones.',
      symptom: 'Dark or light streaks along the edges where the big faces meet the curve.',
      whyItHappened: 'Area weighting lets the big faces dominate the vertex normals along the edge.',
      repairStrategy: 'Use auto smooth, mark the edge sharp, or add a thin support loop next to it.',
    },
    {
      commonError: 'Recomputing normals after import, with one normal per vertex.',
      symptom: 'Hard edges that were crisp in the modelling tool are soft in the engine.',
      whyItHappened: 'The split normals were thrown away and averaged across every edge.',
      repairStrategy: 'Import the file\'s normals as they are, or split vertices at hard edges before recomputing.',
    },
    {
      commonError: 'Averaging un-normalised face normals and forgetting the areas they carry.',
      symptom: 'Normals tilt towards big faces even when equal weights were intended.',
      whyItHappened: 'The fan of cross products is twice the area long; adding them without normalising is area weighting.',
      repairStrategy: 'Normalise each face normal first if you want equal or angle weights; keep the length only for area weights.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute face normals and areas, area- and angle-weighted vertex normals, and auto-smooth corner normals.',
    explainVerbally: 'Explain why averaging recovers a curve\'s normal on smooth patches and fails across a hard edge, and what auto smooth changes.',
    detectIncorrectApplication: 'Recognise rim smears, merged hard-edge normals and blob-shaded boxes, and name their cause.',
    transferToUnfamiliar: 'Choose flat, smooth or auto smooth (or sharp edges) for a car body, a crystal style or a game export.',
  },
};
