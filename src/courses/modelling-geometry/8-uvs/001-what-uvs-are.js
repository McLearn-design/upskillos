// Lesson 8.1: what UVs are. A UV map sends each face corner to a point (u, v) of a texture's unit square. UVs belong
// to corners, not vertices: where a seam cuts the surface, one vertex has a UV in each piece (a wedge each), so a GPU
// mesh with UVs has more vertices than the model. Inside a triangle the UV is blended from the corners with
// barycentric weights; the texture is then read at that point: a texel, or a blend of the four nearest.
import { withPicture } from '../notebookScene.js';

const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
`;

const WEDGES = `${BASE}
// A cube: 8 vertices, 6 square faces. Two ways to give it UVs, both per corner.
const V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
const F = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]]
const square = [[0, 0], [1, 0], [1, 1], [0, 1]]
// (a) An atlas: face k gets its own tile of a 3 × 2 grid, so no two faces share texture.
const atlas = F.map((f, k) => square.map(([s, t]) => [((k % 3) + s) / 3, (Math.floor(k / 3) + t) / 2]))
// (b) The whole texture on every face.
const whole = F.map(() => square)
// A wedge is a distinct (vertex, UV) pair. Predict first: how many for each?
const wedges = (uv) => new Set(F.flatMap((f, k) => f.map((v, i) => v + ':' + uv[k][i].join(',')))).size
console.log('vertices ' + V.length + ', corners ' + F.flat().length)
console.log('atlas: ' + wedges(atlas) + ' wedges; whole texture on each face: ' + wedges(whole) + ' wedges')`;

const BARY = `${BASE}
// A triangle in 3D with a UV at each corner. Where does a point inside it read the texture?
const A = [0, 0, 0], B = [2, 0, 0], C = [0, 1, 2]
const uvA = [0.1, 0.1], uvB = [0.9, 0.2], uvC = [0.3, 0.8]
const sub = (a, b) => a.map((x, i) => x - b[i]), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const area = (p, q, s) => Math.hypot(...cross(sub(q, p), sub(s, p))) / 2
const P = [0, 1, 2].map((i) => 0.2 * A[i] + 0.5 * B[i] + 0.3 * C[i])     // a point, 0.2 A + 0.5 B + 0.3 C
// Barycentric weights from areas: each corner's weight is the area of the triangle opposite it, over the whole.
const whole = area(A, B, C), w = [area(P, B, C) / whole, area(A, P, C) / whole, area(A, B, P) / whole]
// Predict first: the UV at P.
const uv = [0, 1].map((k) => w[0] * uvA[k] + w[1] * uvB[k] + w[2] * uvC[k])
console.log('weights ' + w.map(r).join(', ') + ' (they add to ' + r(w[0] + w[1] + w[2]) + ')')
console.log('UV at P: ' + uv.map(r).join(', '))`;

const LOOKUP = `${BASE}
// A tiny 4 × 4 texture of grey levels, row 0 at v = 0. Texel (x, y) covers u in [x/4, (x+1)/4), v in [y/4, (y+1)/4).
const tex = [[0, 10, 20, 30], [40, 50, 60, 70], [80, 90, 100, 110], [120, 130, 140, 150]]   // tex[y][x]
const N = 4, wrap = (x) => x - Math.floor(x)                                              // the texture repeats
function nearest(u, v) { const x = Math.floor(wrap(u) * N), y = Math.floor(wrap(v) * N); return tex[y][x] }
// Bilinear: texel centres are at (x + ½)/N; blend the four around the point.
function bilinear(u, v) {
  const fx = wrap(u) * N - 0.5, fy = wrap(v) * N - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0
  const at = (x, y) => tex[(y + N) % N][(x + N) % N]
  return (1 - tx) * (1 - ty) * at(x0, y0) + tx * (1 - ty) * at(x0 + 1, y0) + (1 - tx) * ty * at(x0, y0 + 1) + tx * ty * at(x0 + 1, y0 + 1)
}
// Predict first: the nearest texel's value at (0.3, 0.6), and at (1.3, 0.6).
for (const [u, v] of [[0.3, 0.6], [1.3, 0.6], [0.375, 0.625]]) console.log('(' + u + ', ' + v + '): nearest ' + nearest(u, v) + ', bilinear ' + r(bilinear(u, v)))`;

const PICTURE = withPicture(`${BASE}
// Two cubes with an 8 × 8 checker (rows tinted, as in MeshLab). Left: UVs per corner, the whole texture on each face.
// Right: one UV per vertex, (u, v) = ((x + 1)/2, (z + 1)/2), the same at a vertex in all three of its faces.
const V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
const F = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]]
const square = [[0, 0], [1, 0], [1, 1], [0, 1]]
function checker([u, v]) {
  const i = Math.floor(u * 8), j = Math.floor(v * 8), row = Math.min(7, Math.max(0, j)) / 7
  return (i + j) % 2 === 0 ? [0.92, 0.92, 0.92] : [(40 + 180 * row) / 255, 70 / 255, (220 - 150 * row) / 255]
}
const lerp2 = (q, s, t) => [0, 1].map((k) => (1 - s) * (1 - t) * q[0][k] + s * (1 - t) * q[1][k] + s * t * q[2][k] + (1 - s) * t * q[3][k])
const lerp3 = (q, s, t) => [0, 1, 2].map((k) => (1 - s) * (1 - t) * q[0][k] + s * (1 - t) * q[1][k] + s * t * q[2][k] + (1 - s) * t * q[3][k])
const verts = [], faces = [], colors = []
function cube(dx, uvOf) {
  F.forEach((f, k) => {
    const P = f.map((v) => V[v]), Q = uvOf(f, k)
    // Each face as 8 × 8 small quads, each coloured by the texture at its centre's UV.
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {
      const c = checker(lerp2(Q, (a + 0.5) / 8, (b + 0.5) / 8)), o = verts.length
      for (const [s, t] of [[a, b], [a + 1, b], [a + 1, b + 1], [a, b + 1]]) { const p = lerp3(P, s / 8, t / 8); verts.push([p[0] * 0.8 + dx, p[1] * 0.8 + 1, p[2] * 0.8]); colors.push(c) }
      faces.push([o, o + 1, o + 2, o + 3])
    }
  })
}
cube(-1.3, () => square)
cube(1.3, (f) => f.map((v) => [(V[v][0] + 1) / 2, (V[v][2] + 1) / 2]))
console.log('left: ' + 6 * 4 + ' corner UVs; right: ' + V.length + ' vertex UVs')
show({ verts, faces, colors, zoom: 1.5 })`);

const CHALLENGE = `// A UV sphere with 16 segments and 8 rings has 114 vertices: a pole at each end and 7 rings of 16.
// It is cut along one meridian, from pole to pole, and unwrapped. How many wedges (distinct vertex-and-UV pairs)?
const wedges = 0
console.log(wedges)`;

const SOLVED = CHALLENGE.replace('const wedges = 0', 'const wedges = 114 + 7');

/** The challenge's check: the 7 seam vertices between the poles get two UVs each; the poles keep one. 121. */
export function checkWedges(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+wedges\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const wedges = …, with a number or a sum.');
  const expr = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  // Only plain arithmetic is evaluated: this runs in the page, not the cell's sandbox.
  if (!/^[\d\s+\-*/()]+$/.test(expr)) return no('Write the count as a number or plain arithmetic, like 114 + 1.');
  let v;
  try { v = Number(new Function('return (' + expr + ')')()); } catch { return no('That expression did not run.'); }
  if (v === 121) return { pass: true, message: '121: the seam runs through 9 vertices, but the two poles are where it starts and ends, so the faces round a pole can be walked round without crossing the cut and the pole keeps one UV. The 7 vertices in between are split in two: 114 + 7 = 121. MeshLab\'s "What UVs are" project prints the same.' };
  if (v === 0) return no('Start from 114 vertices. Which of them sit on the cut, and how many UVs does each get?');
  if (v === 123) return no('123 also splits the two poles. The seam ends at each pole: walking round a pole you can go the long way round without crossing it, so the pole stays one wedge.');
  if (v === 114) return no('With a seam, the vertices on it have one UV on each side of the cut.');
  if (v === 480) return no('480 is the number of face corners. Many corners at one vertex share a UV: count distinct (vertex, UV) pairs.');
  return no(`${v} is not right. Count the vertices on the meridian, and decide which of them the cut really splits.`);
}

export default {
  id: 'modelling-geometry-8-001',
  slug: 'what-uvs-are',
  chapter: 'modelling-geometry',
  order: 1,
  title: 'What UVs are',
  subtitle: 'A point on the texture for every face corner: why corners and not vertices, how a point inside a face finds its UV, and how the texture is read.',
  tags: ['uv', 'texture coordinates', 'wedges', 'barycentric', 'texel', 'bilinear', 'texture mapping'],
  coreConcept: 'A UV map gives every face corner a point (u, v) in the unit square of a texture. UVs belong to corners, not vertices: a vertex where the surface is cut has a different UV in each piece, and each distinct (vertex, UV) pair is a wedge, so the GPU mesh has one vertex per wedge. Inside a triangle the UV is blended from its corners with barycentric weights (each the area of the opposite sub-triangle over the whole). The texture is then read at that point: the texel floor(u·W), floor(v·H), or a bilinear blend of the four nearest, with the texture repeating outside [0, 1].',
  prerequisites: ['modelling-geometry-6-005', 'modelling-geometry-7-001'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-8-002',

  hook: {
    question: 'A cube has 8 vertices. Paint a different picture on each of its six faces, and the exported model suddenly has 24 vertices. Where did the other 16 come from, and how does the GPU know which part of the picture goes where?',
    realWorldContext: 'Every textured model in games, film and product visualisation carries UVs. Artists unwrap them by hand or with tools, texture painters paint in them, and game engines duplicate vertices along every UV seam when they upload a mesh. Reading a model\'s vertex count after export is one of the first places UVs show up.',
  },

  intuition: {
    prose: [
      'A texture is an image; a UV map says, for each point of the surface, which point of the image it shows. The image\'s square is the **UV square**: $u$ across from $0$ to $1$, $v$ up from $0$ to $1$. A model stores a $(u, v)$ for each **face corner**.',
      'Why corners and not vertices? Because a vertex can need two UVs. Picture a cube unfolded flat: the corner of the box where three faces meet appears three times in the unfolded picture, once in each face\'s square. Each distinct pairing of a vertex with a UV is a **wedge**. Before running cell 1, predict how many wedges the cube has when each face gets its own tile of the texture ($24$: every corner of the box is split three ways), and when every face shows the whole texture (fewer: some corners happen to get the same UV twice).',
      'Inside a face, the UV is blended from the corners. On a triangle the weights are **barycentric**: a point $P = w_A A + w_B B + w_C C$ with $w_A + w_B + w_C = 1$, and each weight is the area of the little triangle opposite that corner divided by the whole. Before running cell 2, predict the UV at $0.2A + 0.5B + 0.3C$: the same weights applied to the corner UVs.',
      'Finally the lookup. A texture of $W \\times H$ pixels (**texels**) covers the UV square, so the texel at $(u, v)$ is $(\\lfloor uW \\rfloor, \\lfloor vH \\rfloor)$. Outside $[0, 1]$ the texture usually **repeats**, so only the fractional part counts. Before running cell 3, predict the nearest texel\'s value at $(0.3, 0.6)$ and at $(1.3, 0.6)$: the same. A GPU normally blends the four texels nearest the point (**bilinear filtering**) so the image does not look blocky.',
      'The picture shows why per-vertex UVs are not enough: the right cube has one UV per vertex, taken from above. Its top looks right, but its sides squeeze the whole texture into stripes, because both vertices of each vertical edge have the same $(x, z)$.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Reading a texture at a point',
        body: 'Step 1. Find the triangle the point is in and its barycentric weights (w_A, w_B, w_C).\nStep 2. Blend the corner UVs: uv = w_A uv_A + w_B uv_B + w_C uv_C.\nStep 3. Scale by the texture\'s repeat and keep the fractional part.\nStep 4. Texel = floor(u · W), floor(v · H); or blend the four nearest texel centres (bilinear).',
      },
      {
        type: 'warning',
        title: 'UVs are per corner',
        body: 'Storing one UV per vertex cannot represent a seam: the two sides of a cut need different UVs at the same vertex. Formats like OBJ store a separate UV list with an index per corner; GPU meshes duplicate the vertex once per wedge.',
      },
      {
        type: 'warning',
        title: 'Which way is v?',
        body: 'Most tools put v = 0 at the bottom of the image; image files store the top row first. If a texture appears upside down, the importer has not flipped v (v → 1 − v).',
      },
      {
        type: 'insight',
        title: 'The graphics strand: texture lookup',
        body: 'The vertex shader passes each corner\'s UV on; the rasterizer blends it across the triangle (with perspective correction); the fragment shader reads the texture at the blended UV. A checker texture is the standard test: square, evenly sized squares mean an undistorted map.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "a UV per vertex is enough". The left cube gives each face its own corner UVs and shows a clean checker on every face; the right cube has one UV per vertex and its sides smear into stripes.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'wedges() counts distinct vertex-and-UV pairs; the weights in cell 2 are the area ratios; nearest() and bilinear() in cell 3 are Step 4.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The GPU\'s vertex buffer has one entry per wedge (position, normal, UV together), so the vertex count after upload is the wedge count. The sampler does Steps 3 and 4 in hardware: the wrap mode is the repeat, the filter mode is nearest or bilinear.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'UV › Trace a texture lookup (one face) follows the centre of a selected face: its corners\' UVs, the wedge count, the UV at the centre (predict it), and the texel and checker square it reads. The UV tab shows the layout; the Inspector\'s texture × sets the repeat. In a script: obj.traceUVLookup(face) and mesh.uv.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: UVs, corner by corner',
        caption: 'Wedges on a cube, barycentric interpolation, a texture lookup, and per-corner against per-vertex UVs.',
        props: {
          lesson: {
            title: 'What UVs are',
            subtitle: 'Corners, weights, texels.',
            cells: [
              { type: 'js', instruction: '### 1. Corners, not vertices\nPredict first: how many wedges?', startCode: WEDGES },
              { type: 'js', instruction: '### 2. Inside a triangle\nPredict first: the UV at P.', startCode: BARY },
              { type: 'js', instruction: '### 3. Reading the texture\nPredict first: the nearest texel at (0.3, 0.6) and (1.3, 0.6).', startCode: LOOKUP },
              { type: 'js', instruction: '### 4. See it\nPer-corner UVs on the left, per-vertex UVs on the right. Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 5. Challenge: a globe\'s wedges\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkWedges },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "What UVs are" in MeshLab](#/lab/mesh-lab?project=what-uvs-are). A box and a globe with a checker; one face\'s lookup is traced: press Play, and predict the UV at the face\'s centre.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Edit mode, select one face, UV › Trace a texture lookup.**\n- The UV tab draws the layout; the Inspector sets the texture and its repeat (×).\n- In a script: `obj.traceUVLookup(face)` returns the vertex, corner and wedge counts and the texel; `mesh.uv` is the UV of every face corner.\n- [Open "Unwrap a cube and a sphere"](#/lab/mesh-lab?project=unwrap-basics) for the next lessons.\n- **Elsewhere:** Blender\'s UV editor, glTF\'s TEXCOORD_0 attribute (one per GPU vertex).' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**A UV map** is a function from the surface to the plane, $\\phi: S \\to \\mathbb{R}^2$, given by its values at face corners and linear on each triangle. Where the surface is cut, $\\phi$ is allowed to jump: the two sides of a seam map to different places.',
      '**Barycentric coordinates.** A point of triangle $ABC$ is $P = w_A A + w_B B + w_C C$ with $w_A + w_B + w_C = 1$ and all $w \\ge 0$ inside. Then $w_A = \\text{area}(PBC)/\\text{area}(ABC)$, and likewise for the others. The UV at $P$ is $w_A\\,\\text{uv}_A + w_B\\,\\text{uv}_B + w_C\\,\\text{uv}_C$: the unique linear map matching the corners.',
      '**Sampling.** A $W \\times H$ texture has texel $(x, y)$ centred at $\\big((x + \\tfrac12)/W, (y + \\tfrac12)/H\\big)$. Nearest sampling takes $(\\lfloor uW \\rfloor, \\lfloor vH \\rfloor)$; bilinear sampling blends the four texels around $(uW - \\tfrac12, vH - \\tfrac12)$ by its fractional parts. Repeat wrapping replaces $u$ by $u - \\lfloor u \\rfloor$.',
      '**Counting wedges.** Corners at a vertex are joined into one wedge when you can walk between them round the vertex without crossing a seam. A vertex in the middle of a seam is split in two; a vertex where a seam ends is not split.',
    ],
    equations: [
      { label: 'Barycentric point', latex: 'P = w_A A + w_B B + w_C C, \\quad w_A + w_B + w_C = 1' },
      { label: 'Weight', latex: 'w_A = \\frac{\\text{area}(PBC)}{\\text{area}(ABC)}' },
      { label: 'Interpolated UV', latex: '\\text{uv}(P) = w_A\\,\\text{uv}_A + w_B\\,\\text{uv}_B + w_C\\,\\text{uv}_C' },
      { label: 'Texel', latex: '(x, y) = (\\lfloor uW \\rfloor, \\lfloor vH \\rfloor)' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** A per-corner UV assignment defines a map that is linear on each triangle and continuous across every edge whose two sides agree; across a seam it may be discontinuous. The GPU mesh has exactly one vertex per wedge, and the wedge count equals the number of vertices plus, for each vertex, the number of seam-separated sectors around it minus one.',
      '**Invariant viewpoint.** UVs do not depend on where the model is placed: moving, rotating or scaling the object leaves every corner\'s UV and every texel lookup unchanged. They change only when the mesh is unwrapped again or edited.',
      '**Geometric picture.** Think of the texture as a sheet of printed paper and the UV map as instructions for cutting it and gluing pieces onto the model: each face corner says which point of the paper is glued there.',
      '**Where this goes.** Lesson 8.2 decides where to cut (seams and charts); 8.3 and 8.4 compute the UVs automatically; 8.5 measures how much a map stretches the paper.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-8-001-ex1',
      title: 'The centre of a triangle',
      problem: 'A triangle\'s corners have UVs $(0, 0)$, $(0.6, 0)$, $(0, 0.3)$. What is the UV at its centroid?',
      steps: [{ expression: '\\tfrac13(0, 0) + \\tfrac13(0.6, 0) + \\tfrac13(0, 0.3) = (0.2, 0.1)', annotation: 'Equal weights at the centroid.' }],
      conclusion: '(0.2, 0.1).',
    },
    {
      id: 'modelling-geometry-8-001-ex2',
      title: 'Which texel',
      problem: 'A $512 \\times 512$ texture is read at $(0.25, 0.7)$. Which texel?',
      steps: [{ expression: '(\\lfloor 0.25 \\cdot 512 \\rfloor, \\lfloor 0.7 \\cdot 512 \\rfloor) = (128, 358)', annotation: '0.7 · 512 = 358.4.' }],
      conclusion: 'Texel (128, 358).',
    },
    {
      id: 'modelling-geometry-8-001-ex3',
      title: 'A cylinder\'s seam',
      problem: 'An open tube has 2 rings of 12 vertices and is cut along one vertical edge. How many wedges?',
      steps: [{ expression: '24 + 2 = 26', annotation: 'Both ends of the cut edge are on the boundary, where the cut runs through; each is split.' }],
      conclusion: '26: the two vertices on the cut have two UVs each.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-8-001-ch1',
      difficulty: 'easy',
      problem: 'Why does a cube with a separate texture tile per face have 24 wedges?',
      walkthrough: [{ expression: '8 \\times 3 = 24', annotation: 'Each vertex is on three faces, each in a different tile.' }],
      answer: 'Every vertex is a corner of three faces, and each face is in its own tile, so each vertex has three different UVs: 8 × 3 = 24.',
    },
    {
      id: 'modelling-geometry-8-001-ch2',
      difficulty: 'medium',
      problem: 'A point has barycentric weights (0.5, 0.5, 0) in a triangle. Where is it, and what UV does it get?',
      walkthrough: [{ expression: 'P = \\tfrac12 A + \\tfrac12 B', annotation: 'No weight on C.' }],
      answer: 'It is the midpoint of edge AB, and its UV is the average of the UVs at A and B. C does not matter, which is why neighbouring triangles agree along their shared edge.',
    },
    {
      id: 'modelling-geometry-8-001-ch3',
      difficulty: 'hard',
      problem: 'Explain why a vertex at the end of a seam is not split, but a vertex in its middle is.',
      walkthrough: [
        { expression: '\\text{middle: the seam crosses the vertex\'s fan twice}', annotation: 'Two sectors.' },
        { expression: '\\text{end: the seam enters the fan once}', annotation: 'One sector: the faces can be walked round the other way.' },
      ],
      answer: 'Corners at a vertex share a UV when you can walk between them round the vertex without crossing a seam. A seam through the middle of a vertex cuts its fan of faces twice, leaving two sectors; a seam that ends there cuts it once, so the fan is still one connected sector.',
    },
  ],

  semantics: {
    core: [
      { symbol: '(u, v)', meaning: 'A point of the texture\'s unit square.' },
      { symbol: '\\text{wedge}', meaning: 'A vertex together with one of its UVs: one GPU vertex.' },
      { symbol: 'w_A, w_B, w_C', meaning: 'Barycentric weights: area ratios, adding to 1.' },
      { symbol: 'W \\times H', meaning: 'The texture\'s size in texels.' },
      { symbol: '\\lfloor uW \\rfloor', meaning: 'The texel column at u.' },
      { symbol: 'u - \\lfloor u \\rfloor', meaning: 'Repeat wrapping.' },
    ],
    rulesOfThumb: [
      'UVs live on corners.',
      'Wedges = GPU vertices.',
      'Barycentric weights are area ratios.',
      'Repeat keeps the fractional part.',
      'A checker shows distortion at a glance.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-6-005', label: 'Subdividing UVs', note: 'UVs carried through subdivision, and why borders differ.' },
      { lessonId: 'modelling-geometry-7-001', label: 'Fields and colour maps', note: 'Values blended across a triangle the same way.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-8-002', label: 'Seams and charts', note: 'Where to cut so the surface can lie flat.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-8-001-1', label: 'Read why UVs are stored per corner', type: 'read' },
    { id: 'cp-modelling-geometry-8-001-2', label: 'Read barycentric interpolation', type: 'read' },
    { id: 'cp-modelling-geometry-8-001-3', label: 'Read how a texel is chosen', type: 'read' },
    { id: 'cp-modelling-geometry-8-001-4', label: 'Run cells 1 to 3: wedges, barycentric, lookup', type: 'lab' },
    { id: 'cp-modelling-geometry-8-001-5', label: 'Trace a texture lookup in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-8-001-6', label: 'Work through example 1, the centre of a triangle', type: 'example' },
    { id: 'cp-modelling-geometry-8-001-7', label: 'Work through example 2, which texel', type: 'example' },
    { id: 'cp-modelling-geometry-8-001-8', label: 'Complete the challenge: a globe\'s wedges', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-8-001-assess-1',
        type: 'choice',
        text: 'A 256 × 256 texture with repeat wrapping is read at (1.5, 0.25). Which texel (nearest)?',
        options: ['(128, 64)', '(384, 64)', '(255, 64)', '(0, 64)'],
        answer: '(128, 64)',
        hint: 'Keep the fractional part of u.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-8-001-quiz-1',
      type: 'choice',
      text: 'Why are UVs stored per face corner rather than per vertex?',
      options: ['A vertex on a seam needs a different UV in each piece', 'It uses less memory', 'GPUs cannot read per-vertex data', 'Corners are easier to count'],
      answer: 'A vertex on a seam needs a different UV in each piece',
      hints: ['Cell 1.', 'Warning "UVs are per corner".'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-8-001-quiz-2',
      type: 'choice',
      text: 'A cube with its own texture tile on each face has how many wedges?',
      options: ['24', '8', '6', '36'],
      answer: '24',
      hints: ['Cell 1.', 'Challenge 1.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-8-001-quiz-3',
      type: 'choice',
      text: 'A point\'s barycentric weight for corner A is:',
      options: ['The area of the triangle opposite A over the whole area', 'Its distance to A', 'One third', 'The angle at A'],
      answer: 'The area of the triangle opposite A over the whole area',
      hints: ['Cell 2.', 'Math, Barycentric coordinates.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-8-001-quiz-4',
      type: 'choice',
      text: 'With repeat wrapping, reading at u = 1.3 is the same as reading at:',
      options: ['u = 0.3', 'u = 1', 'u = 0.7', 'nothing: it is outside the texture'],
      answer: 'u = 0.3',
      hints: ['Cell 3.', 'Keep the fractional part.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-8-001-quiz-5',
      type: 'choice',
      text: 'A seam that ends at a vertex splits that vertex into:',
      options: ['One wedge (it is not split)', 'Two wedges', 'Three wedges', 'As many wedges as faces'],
      answer: 'One wedge (it is not split)',
      hints: ['Challenge 3.', 'The globe\'s poles.'],
      reviewSection: 'Challenge',
    },
    {
      id: 'modelling-geometry-8-001-quiz-6',
      type: 'choice',
      text: 'Bilinear filtering reads:',
      options: ['A blend of the four texels nearest the point', 'The single nearest texel', 'The whole texture\'s average', 'A random texel'],
      answer: 'A blend of the four texels nearest the point',
      hints: ['Cell 3.', 'Procedure, Step 4.'],
      reviewSection: 'Cell 3',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A UV per vertex is enough.',
      whyStudentsThinkIt: 'Positions and normals of smooth surfaces are per vertex.',
      correctionExample: 'The picture: the right cube, with one UV per vertex, smears its sides into stripes.',
      contrastCase: 'A surface with no seams (a plane) can use one UV per vertex.',
    },
    {
      falseBelief: 'A mesh\'s vertex count is the same in the modeller and on the GPU.',
      whyStudentsThinkIt: 'It is the same model.',
      correctionExample: 'Cell 1: 8 vertices, 24 wedges, and the GPU stores one vertex per wedge.',
      contrastCase: 'Without seams or sharp normals, the counts agree.',
    },
    {
      falseBelief: 'UVs outside 0 to 1 are an error.',
      whyStudentsThinkIt: 'The texture square is 0 to 1.',
      correctionExample: 'Cell 3: with repeat wrapping, (1.3, 0.6) reads the same texel as (0.3, 0.6); tiling textures rely on it.',
      contrastCase: 'With clamp wrapping, values outside are pinned to the edge texel.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A game model exports with three times as many vertices as the modeller shows, and the team suspects a bug.',
      competingTechniques: ['Merge vertices by distance', 'Count the UV and normal seams'],
      whyThisTechniqueWins: 'The extra vertices are wedges: one per distinct UV (and normal) at each vertex. Merging them would break the texture; reducing seams is the real fix if the count matters.',
    },
    {
      situation: 'A brick wall texture must repeat 10 times across a long wall.',
      competingTechniques: ['A texture 10 times wider', 'UVs from 0 to 10 with repeat wrapping'],
      whyThisTechniqueWins: 'Repeat wrapping reads the same small texture 10 times, with no extra memory.',
    },
  ],

  debugging: [
    {
      commonError: 'Storing UVs per vertex when importing a model with seams.',
      symptom: 'Smeared stripes along seams; textures that jump.',
      whyItHappened: 'Each vertex kept only one of its UVs.',
      repairStrategy: 'Keep the per-corner UV indices (OBJ\'s vt index) and split vertices into wedges on upload.',
    },
    {
      commonError: 'Forgetting to flip v between image and UV conventions.',
      symptom: 'Textures upside down.',
      whyItHappened: 'Images store the top row first; UVs put v = 0 at the bottom.',
      repairStrategy: 'Use v → 1 − v once, in the importer.',
    },
    {
      commonError: 'Interpolating UVs with weights that do not add to 1.',
      symptom: 'Textures drift or scale inside triangles.',
      whyItHappened: 'Distances used as weights instead of area ratios.',
      repairStrategy: 'Use barycentric weights: area ratios, which always add to 1.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Count a mesh\'s wedges and compute the UV and texel at a point.',
    explainVerbally: 'Explain why UVs are per corner, how barycentric weights work, and how a texture is sampled.',
    detectIncorrectApplication: 'Recognise per-vertex UVs, flipped v and bad weights.',
    transferToUnfamiliar: 'Read vertex counts, tiling and texture artefacts in any engine.',
  },
};
