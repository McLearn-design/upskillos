// Lesson 5.9: clean topology. Valence (edges at a vertex) is 4 inside a quad grid; other valences are poles. On a
// closed mesh of quads, Σ (4 − valence) = 4χ, so a sphere-like shape needs poles adding up to 8. Subdivision keeps
// every pole and turns each n-gon into an n-pole. A pole on a flat area forces corners away from 90°, which shows
// as pinching after smoothing; that is why poles are placed where the surface already turns.
import { withPicture } from '../notebookScene.js';

const HELPERS = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const key = (a, b) => a < b ? a + '-' + b : b + '-' + a
// Valence of every vertex, and which vertices are on an open edge.
function valences(faces) {
  const edges = new Map()
  faces.forEach((f) => f.forEach((a, i) => { const k = key(a, f[(i + 1) % f.length]); edges.set(k, (edges.get(k) || 0) + 1) }))
  const val = new Map(), open = new Set()
  for (const [k, n] of edges) { const [a, b] = k.split('-').map(Number); val.set(a, (val.get(a) || 0) + 1); val.set(b, (val.get(b) || 0) + 1); if (n === 1) { open.add(a); open.add(b) } }
  return { val, open, E: edges.size }
}
// How many inside vertices have each valence, e.g. "8 × 3, 90 × 4".
function table(faces) {
  const { val, open } = valences(faces), count = {}
  for (const [v, n] of val) if (!open.has(v)) count[n] = (count[n] || 0) + 1
  return Object.keys(count).sort((a, b) => a - b).map((n) => count[n] + ' × ' + n).join(', ')
}
const cube = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [0, 4, 7, 3], [1, 2, 6, 5]]
// One Catmull–Clark step, connectivity only: a point per face and per edge; each face's corner becomes a quad.
function subdivideTopology(faces, nVerts) {
  let next = nVerts
  const facePt = faces.map(() => next++), edgePt = new Map(), out = []
  faces.forEach((f) => f.forEach((a, i) => { const k = key(a, f[(i + 1) % f.length]); if (!edgePt.has(k)) edgePt.set(k, next++) }))
  faces.forEach((f, fi) => f.forEach((v, i) => {
    const prev = f[(i + f.length - 1) % f.length], nxt = f[(i + 1) % f.length]
    out.push([v, edgePt.get(key(v, nxt)), facePt[fi], edgePt.get(key(prev, v))])
  }))
  return { faces: out, nVerts: next }
}
`;

const VALENCE = `${HELPERS}
// A flat 4 × 4 grid: the 9 inside vertices. Predict first: how many edges meet at each?
const grid = []
for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) grid.push([i * 5 + j, i * 5 + j + 1, (i + 1) * 5 + j + 1, (i + 1) * 5 + j])
console.log('4 × 4 grid, inside vertices: ' + table(grid))
// A cube: every vertex is a corner where three faces meet.
console.log('cube: ' + table(cube))`;

const BUDGET = `${HELPERS}
// Σ (4 − valence) over a closed mesh of quads, against 4χ (χ = V − E + F).
function budget(name, faces, nVerts) {
  const { val, E } = valences(faces)
  const sum = [...val.values()].reduce((s, n) => s + 4 - n, 0), chi = nVerts - E + faces.length
  console.log(name + ': ' + table(faces) + '; Σ (4 − valence) = ' + sum + ', 4χ = ' + 4 * chi)
}
budget('cube', cube, 8)
let m = { faces: cube, nVerts: 8 }
for (let level = 1; level <= 2; level++) { m = subdivideTopology(m.faces, m.nVerts); budget('cube subdivided ×' + level, m.faces, m.nVerts) }
// A torus of quads: a 6 × 4 grid whose opposite sides are joined. Predict first: does it need any poles?
const torus = []
for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) torus.push([i * 4 + j, i * 4 + (j + 1) % 4, ((i + 1) % 6) * 4 + (j + 1) % 4, ((i + 1) % 6) * 4 + j])
budget('torus', torus, 24)`;

const NGONS = `${HELPERS}
// A triangular prism: two triangles and three quads. Subdividing turns every face into quads round a face point,
// so a triangle's face point has 3 edges, and an n-gon's has n.
const prism = [[0, 1, 2], [3, 5, 4], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]]
console.log('prism: ' + table(prism) + ' (corners)')
const s = subdivideTopology(prism, 6)
console.log('subdivided once: ' + table(s.faces) + ', all quads now')
// A pentagonal prism: two pentagons and five quads. Each pentagon's centre becomes a 5-pole.
const pent = [[0, 1, 2, 3, 4], [9, 8, 7, 6, 5]]
for (let k = 0; k < 5; k++) pent.push([k, 5 + k, 5 + (k + 1) % 5, (k + 1) % 5])
console.log('pentagonal prism: ' + table(pent))
const t = subdivideTopology(pent, 10)
console.log('subdivided once: ' + table(t.faces) + '; Σ (4 − valence) = ' + [...valences(t.faces).val.values()].reduce((sum, n) => sum + 4 - n, 0))`;

const ANGLES = `${HELPERS}
// On a flat area, the corners round a vertex add up to 360°. With valence k, they average 360° / k.
for (const k of [3, 4, 5, 6, 8]) {
  const a = 360 / k
  console.log('valence ' + k + ': corners average ' + r(a) + '°, ' + (a === 90 ? 'square quads possible' : r(Math.abs(a - 90)) + '° off square'))
}
// Where the surface turns (a cube's corner), the three faces' corners add up to 270°, not 360°: 90° each.
console.log('at a cube corner, 3 faces × 90° = 270°: the 3-pole is exactly where a sphere-like shape turns most')`;

// A cube-sphere: each cube face as a 6 × 6 grid of quads, vertices pushed out onto the unit sphere.
const BALL = `const N = 6, verts = [], faces = [], index = new Map()
const vert = (p) => { const k = p.map((x) => x.toFixed(6)).join(','); if (!index.has(k)) { index.set(k, verts.length); verts.push(p) } return index.get(k) }
// Each cube face: a fixed axis and sign, and two in-face axes ordered so the face's quads wind outward.
for (const [ax, s] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
  const [u, w] = s > 0 ? [(ax + 1) % 3, (ax + 2) % 3] : [(ax + 2) % 3, (ax + 1) % 3]
  const at = (i, j) => { const p = [0, 0, 0]; p[ax] = s; p[u] = -1 + 2 * i / N; p[w] = -1 + 2 * j / N; return vert(p) }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) faces.push([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)])
}
for (const p of verts) { const l = Math.hypot(...p); p.forEach((x, k) => { p[k] = x / l }) }
`;

const PICTURE = withPicture(`${HELPERS}${BALL}
// The 8 vertices where only 3 edges meet are the cube's old corners. Faces touching one amber, the rest blue.
const { val } = valences(faces)
const poles = new Set([...val].filter(([, n]) => n === 3).map(([v]) => v))
console.log(verts.length + ' vertices: ' + table(faces) + '; ' + poles.size + ' poles, each touching 3 amber faces')
show({ verts, faces, groups: faces.map((f) => f.some((v) => poles.has(v)) ? 1 : 0), normals: false })`);

const CHALLENGE = `// A closed mesh of quads shaped like a sphere has 6 vertices with 5 edges.
// Every other vertex has 3 or 4 edges. How many have 3?
const threes = 0
console.log(threes)`;

const SOLVED = CHALLENGE.replace('const threes = 0', 'const threes = 14');

/** The challenge's check: Σ (4 − valence) = 8, so n₃ − 6 = 8 and n₃ = 14. */
export function checkThrees(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+threes\s*=\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return no('Keep the line const threes = …, with a number.');
  const n = Number(m[1]);
  if (n === 14) return { pass: true, message: '14. Each 3-pole adds 4 − 3 = 1 to Σ (4 − valence), each 5-pole adds −1, the 4s add nothing, and the sum must be 4χ = 8: n₃ − 6 = 8, so n₃ = 14. Every 5-pole on a sphere-like shape costs an extra 3-pole somewhere.' };
  if (n === 0) return no('Use the pole budget: Σ (4 − valence) over all vertices is 4χ = 8 for a sphere-like closed quad mesh.');
  if (n === 8) return no('8 is the number with no 5-poles. Each 5-pole contributes 4 − 5 = −1, which more 3-poles must make up.');
  if (n === 2) return no('The 5-poles count against the budget, not towards it: 4 − 5 = −1 each.');
  if (n === 6) return no('Equal numbers of 3- and 5-poles cancel to 0; the budget is 8, not 0. That would be a torus.');
  return no(`With ${n} three-poles and 6 five-poles, Σ (4 − valence) = ${n - 6}, not 8.`);
}

export default {
  id: 'modelling-geometry-5-009',
  slug: 'clean-topology',
  chapter: 'modelling-geometry',
  order: 9,
  title: 'Clean topology',
  subtitle: 'Quads, poles and n-gons: what valence measures, why a closed shape must have poles, and where to put them.',
  tags: ['topology', 'valence', 'poles', 'quads', 'n-gons', 'euler characteristic'],
  coreConcept: 'A vertex\'s valence is the number of edges that meet there; inside a grid of quads it is 4, and any other valence is a pole. On a closed mesh made only of quads, every face has 4 edges and every edge 2 faces, so Σ (4 − valence) = 4χ: 8 for anything shaped like a sphere, 0 for a torus. Poles are therefore unavoidable on a ball, but their total is fixed. Subdivision keeps every pole and turns each n-gon into an n-pole, and a pole on a flat area forces corners away from 90°, which pinches the smoothed surface. Clean topology is mostly quads, with poles few and placed where the surface turns.',
  prerequisites: ['modelling-geometry-5-008', 'modelling-geometry-1-005'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-6-001',

  hook: {
    question: 'Modellers say "all quads" and "watch your poles" as if they were laws. Can a ball be made only of quads where every vertex has four edges? If not, how many exceptions does it need, and does it matter where they go?',
    realWorldContext: 'Topology is what decides whether a character bends cleanly at the elbow, whether a car panel reflects without wobbles after smoothing, and whether loop cuts and edge loops go where you need them. Game and film studios review topology as carefully as shape.',
  },

  intuition: {
    prose: [
      'The **valence** of a vertex is how many edges meet there. Before running cell 1, predict: inside a flat grid of quads, what is it? Four, everywhere. On a cube, every corner has three.',
      'A vertex whose valence is not 4 (on the inside of the surface) is a **pole**. Poles matter because edge loops end or split at them (lesson 4.3), and because subdivision shades and bends slightly differently around them.',
      'Can a closed ball be made of quads with no poles? Count. In a closed quad mesh each face has 4 edges and each edge 2 faces, so $E = 2F$. Each edge has 2 ends, so the valences add up to $2E$. Then $\\sum (4 - \\text{valence}) = 4V - 2E = 4V - 4E + 4F = 4\\chi$. For a sphere-like shape $\\chi = 2$: the sum is $8$, never $0$. A cube spends it as eight 3-poles.',
      'Before running cell 2, predict: subdivide the cube twice. How many poles now? Still eight: subdivision adds only vertices of valence 4 (on quads), so the budget stays spent where it was. A torus has $\\chi = 0$ and needs no poles at all.',
      '**Triangles and n-gons become poles.** Subdividing puts a new vertex in each face, joined to each of its edges: a triangle\'s centre gets 3 edges, a pentagon\'s 5 (cell 3). That is why modellers fix n-gons before subdividing: each leaves a pole wherever it was, not where they chose.',
      'Where should poles go? On a flat area the corners round a vertex add to $360°$: with valence 3 they average $120°$, with 5, $72°$ (cell 4). Quads there cannot be square, and after smoothing the surface pinches slightly. Where the surface turns, like a cube\'s corner ($3 \\times 90° = 270°$), a 3-pole fits naturally. So: mostly quads, poles few, placed where the shape turns or hidden where it does not show.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Check a mesh\'s topology',
        body: 'Step 1. Count edges at every inside vertex: 4 is regular; anything else is a pole.\nStep 2. Count triangles and n-gons; each becomes a pole when subdivided.\nStep 3. For a closed quad mesh, check Σ (4 − valence) = 4χ: the poles a shape cannot avoid.\nStep 4. Look at where the poles are: in flat, visible or bending areas, move them to where the surface turns, or to hidden areas.',
      },
      {
        type: 'warning',
        title: 'Poles of 6 or more',
        body: 'A pole with many edges (the top of a UV sphere has 32) pinches badly under subdivision and shades with a visible star. Replace it with a grid of quads (a cube-sphere instead of a UV sphere) where the surface is smooth.',
      },
      {
        type: 'warning',
        title: 'Triangles in places that bend',
        body: 'A triangle at an elbow or a knee stops the edge loops that should go round the joint (lesson 5.3) and becomes a 3-pole when subdivided. Keep bending areas in clean loops of quads.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: how topology affects shading and deformation',
        body: 'After subdivision, a surface near a regular vertex is as smooth as a curve can be (second derivatives continuous); near a pole it is only first-derivative smooth, so reflections and highlights wobble slightly there (lesson 6.3). When a mesh bends (rigging), edges that run in loops round a joint compress evenly; poles in the joint fold unevenly. Both are why poles go where the shape already turns and no one looks closely.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "a ball of quads can be perfectly regular". The cube-sphere is all quads, but its 8 old cube corners (each touching 3 amber faces) are 3-poles. However finely it is divided, those 8 stay, because Σ (4 − valence) must be 8.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'valences() in the cells is Step 1, table() reports it; budget() in cell 2 is Step 3; subdivideTopology() shows Step 2\'s rule, that a face of k sides leaves a vertex of valence k.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Topology does not reach the GPU as such: it sees triangles. But it decides the normals the GPU interpolates, and around a pole those normals turn unevenly, which the eye picks up in highlights.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Object › Trace clean topology (valence, poles) shows the valence of every vertex as a heat map, marks the poles (predict one\'s valence), counts the face kinds and checks the pole budget. Scripts call mesh.valence(). The status bar\'s triangle and n-gon counts are a quick check.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: measure topology',
        caption: 'Valence and poles, the pole budget, n-gons becoming poles, the angles at a pole, and a cube-sphere\'s eight poles.',
        props: {
          lesson: {
            title: 'Clean topology',
            subtitle: 'Valence, poles and the budget.',
            cells: [
              { type: 'js', instruction: '### 1. Valence\nPredict first: edges at an inside vertex of a quad grid.', startCode: VALENCE },
              { type: 'js', instruction: '### 2. The pole budget\nPredict first: poles after subdividing a cube twice; poles on a torus.', startCode: BUDGET },
              { type: 'js', instruction: '### 3. N-gons become poles\nA triangular and a pentagonal prism, subdivided.', startCode: NGONS },
              { type: 'js', instruction: '### 4. Why poles pinch on flat areas\nThe angles a pole forces.', startCode: ANGLES },
              { type: 'js', instruction: '### 5. See it\nA cube-sphere: all quads, and the 8 poles it cannot avoid (amber). Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 360 },
              { type: 'challenge', instruction: '### 6. Challenge: 5-poles cost 3-poles\nHow many 3-poles must there be? The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkThrees },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Clean topology" in MeshLab](#/lab/mesh-lab?project=clean-topology). A quad ball, a UV sphere and a torus are measured; the quad ball is traced: press Play, predict a pole\'s valence, and check the budget. Then trace the UV sphere and the torus.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Object › Trace clean topology (valence, poles):** the valence heat map, the poles, the face kinds and the budget.\n- **Status bar:** triangle and n-gon counts.\n- In a script: `mesh.valence()`.\n- [Open "Support loops and subdivision" in MeshLab](#/lab/mesh-lab?project=support-loops): what loops near edges do to subdivision.\n- **In Blender:** Select › Select All by Trait › Faces by Sides (find triangles and n-gons); the Statistics overlay counts them; poles are found by eye or with add-ons.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**The pole budget.** On a closed mesh in which every face is a quad, $4F = 2E$ (each face has 4 edges, each edge 2 faces) and $\\sum_v \\text{val}(v) = 2E$. So $\\sum_v (4 - \\text{val}(v)) = 4V - 2E = 4V - 4E + 4F = 4\\chi$. With $\\chi = 2 - 2g$ for a closed surface of genus $g$: a sphere-like shape needs $8$, a torus $0$, a two-holed shape $-8$ (an excess of 5-poles).',
      '**The triangle version.** On a closed mesh of triangles, $3F = 2E$, and the same argument gives $\\sum_v (6 - \\text{val}(v)) = 6\\chi$: an icosahedron spends its $12$ as twelve 5-valent vertices. Each kind of face has its own regular valence: 4 for quads, 6 for triangles.',
      '**Subdivision keeps poles.** One Catmull–Clark step gives each old vertex the same number of edges, each new edge point 4 (on two quads), and each new face point as many as its face had corners. So an old pole stays a pole, every n-gon (n ≠ 4) becomes an n-pole, and everything else is regular: the budget, now over all quads, is still $4\\chi$.',
      '**Angles.** On a flat region, the corners round a vertex sum to $2\\pi$; with valence $k$ the quads there cannot all be square unless $k = 4$. On a curved surface, the angle defect $2\\pi - \\sum \\text{corners}$ is the curvature there (lesson 7.4, Gauss–Bonnet): a cube corner has defect $90°$, and eight of them make $720° = 4\\pi$, the total for any sphere. Poles and curvature are two views of the same budget.',
    ],
    equations: [
      { label: 'Quad pole budget', latex: '\\sum_v \\big(4 - \\operatorname{val}(v)\\big) = 4\\chi' },
      { label: 'Triangle budget', latex: '\\sum_v \\big(6 - \\operatorname{val}(v)\\big) = 6\\chi' },
      { label: 'Average corner at valence k (flat)', latex: '\\frac{360°}{k}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For a closed, connected quadrilateral mesh with Euler characteristic $\\chi$, the irregular vertices satisfy $\\sum_v (4 - \\text{val}(v)) = 4\\chi$. In particular a sphere-like quad mesh has irregular vertices, and if all of them are 3-valent there are exactly eight.',
      '**Invariant viewpoint.** Valence is purely combinatorial: moving vertices never changes it. Only operations that change connectivity (loop cuts, extrudes, dissolves, merges) can move poles, and each of them keeps the budget: they move poles around, they never remove the 8.',
      '**Geometric picture.** Laying a square grid onto a ball is like wrapping a gift in graph paper: the paper must fold or crumple somewhere. The poles are the folds, and topology says there are always 8 units of them.',
      '**Where this goes.** Chapter 6 subdivides: lesson 6.3 looks at what happens near extraordinary vertices (poles) in the limit surface, and 6.4 at loops that keep edges sharp.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-5-009-ex1',
      title: 'A cylinder\'s caps',
      problem: 'A 12-sided cylinder has quads round its side and one 12-sided n-gon on each cap. After one subdivision step, what poles are there?',
      steps: [
        { expression: '\\text{each cap\'s centre: valence } 12', annotation: 'An n-gon becomes an n-pole.' },
        { expression: '\\text{the rim vertices: valence } 3', annotation: 'One side edge and two rim edges, as before subdividing.' },
      ],
      conclusion: 'Two 12-poles at the cap centres, and 3-poles round each rim: 24 of them. Σ(4 − val) = 24 − 16 = 8 = 4χ.',
    },
    {
      id: 'modelling-geometry-5-009-ex2',
      title: 'A torus has room for none',
      problem: 'Can a torus be made of quads with every vertex 4-valent?',
      steps: [
        { expression: '\\chi = 0', annotation: 'Genus 1.' },
        { expression: '\\sum (4 - \\text{val}) = 0', annotation: 'No poles needed.' },
      ],
      conclusion: 'Yes: a grid of quads with its opposite sides joined (cell 2).',
    },
    {
      id: 'modelling-geometry-5-009-ex3',
      title: 'An E-pole and its partner',
      problem: 'A sphere-like quad mesh has twelve 3-poles. How many 5-poles?',
      steps: [
        { expression: '12 \\times 1 + n_5 \\times (-1) = 8', annotation: 'The budget.' },
        { expression: 'n_5 = 4', annotation: 'Solve.' },
      ],
      conclusion: '4 five-poles.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-5-009-ch1',
      difficulty: 'easy',
      problem: 'Why does subdividing a mesh not get rid of its poles?',
      walkthrough: [{ expression: '\\text{old vertices keep their valence}', annotation: 'And new ones on quads are 4-valent.' }],
      answer: 'Each old vertex keeps its number of edges, and every new vertex on a quad has 4; poles stay where they were, and n-gons add new ones.',
    },
    {
      id: 'modelling-geometry-5-009-ch2',
      difficulty: 'medium',
      problem: 'A UV sphere has quads everywhere except triangle fans round its two poles, each pole joined to 32 vertices. Why does the pole budget not apply, and what does subdivision do there?',
      walkthrough: [
        { expression: '\\text{it has triangles}', annotation: 'The budget is for all-quad meshes.' },
        { expression: '\\text{each pole stays a 32-pole; each triangle\'s centre becomes a 3-pole}', annotation: 'Subdivision rule.' },
      ],
      answer: 'The budget needs every face to be a quad; the UV sphere has 64 triangles. Subdividing keeps the two 32-poles and turns each triangle\'s centre into a 3-pole, after which the all-quad budget does hold: 64 × 1 + 2 × (4 − 32) = 64 − 56 = 8.',
    },
    {
      id: 'modelling-geometry-5-009-ch3',
      difficulty: 'hard',
      problem: 'Derive the triangle budget Σ(6 − val) = 6χ, and check it on an octahedron (6 vertices, valence 4).',
      walkthrough: [
        { expression: '3F = 2E, \\quad \\sum \\text{val} = 2E', annotation: 'Each triangle has 3 edges; each edge has 2 faces and 2 ends.' },
        { expression: '\\sum (6 - \\text{val}) = 6V - 2E = 6V - 6E + 6F = 6\\chi', annotation: 'Using 4E = 6F, so −2E = −6E + 6F.' },
        { expression: '6 \\times (6 - 4) = 12 = 6 \\times 2', annotation: 'The octahedron: χ = 2.' },
      ],
      answer: 'With 3F = 2E, Σ(6 − val) = 6V − 2E = 6V − 6E + 4E = 6V − 6E + 6F = 6χ. The octahedron: 6 vertices of valence 4 give 6 × 2 = 12 = 6 × 2. ✓',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\operatorname{val}(v)', meaning: 'Valence: the number of edges at vertex v.' },
      { symbol: '\\text{pole}', meaning: 'An inside vertex whose valence is not the regular one (4 for quads).' },
      { symbol: '\\text{N-pole / E-pole}', meaning: 'A 3-valent / 5-valent pole, the common kinds.' },
      { symbol: '\\chi', meaning: 'The Euler characteristic V − E + F: 2 for a sphere, 0 for a torus.' },
      { symbol: '\\sum (4 - \\operatorname{val})', meaning: 'The pole budget of a closed quad mesh: always 4χ.' },
      { symbol: '\\text{n-gon}', meaning: 'A face with more than 4 corners; becomes an n-pole when subdivided.' },
    ],
    rulesOfThumb: [
      'Mostly quads.',
      'A ball needs poles: 8 units of them.',
      'Put poles where the surface turns, not on flat or bending areas.',
      'Fix n-gons and triangles before subdividing.',
      'Avoid poles of 6 or more on smooth surfaces.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-1-005', label: 'Euler\'s formula', note: 'χ = V − E + F, which sets the pole budget.' },
      { lessonId: 'modelling-geometry-5-008', label: 'Box modelling a character', note: 'The character\'s cage: where its poles are.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-6-001', label: 'Corner cutting', note: 'Subdivision, starting in 2D.' },
      { lessonId: 'modelling-geometry-6-003', label: 'Extraordinary vertices and limits', note: 'What happens near a pole after many subdivisions.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-5-009-1', label: 'Read what valence and poles are', type: 'read' },
    { id: 'cp-modelling-geometry-5-009-2', label: 'Read the derivation of the pole budget', type: 'read' },
    { id: 'cp-modelling-geometry-5-009-3', label: 'Read why n-gons become poles and where poles should go', type: 'read' },
    { id: 'cp-modelling-geometry-5-009-4', label: 'Run cells 1 to 4: valence, budget, n-gons, angles', type: 'lab' },
    { id: 'cp-modelling-geometry-5-009-5', label: 'Trace clean topology on three shapes in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-5-009-6', label: 'Work through example 1, a cylinder\'s caps', type: 'example' },
    { id: 'cp-modelling-geometry-5-009-7', label: 'Work through example 3, an E-pole and its partner', type: 'example' },
    { id: 'cp-modelling-geometry-5-009-8', label: 'Complete the challenge: 5-poles cost 3-poles', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-5-009-assess-1',
        type: 'choice',
        text: 'A sphere-like closed mesh of quads has only 3-poles and 4-valent vertices. How many 3-poles?',
        options: ['8', '6', '12', 'It depends on the size'],
        answer: '8',
        hint: 'Σ (4 − val) = 4χ = 8.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-5-009-quiz-1',
      type: 'choice',
      text: 'What is the valence of an inside vertex of a flat grid of quads?',
      options: ['4', '3', '6', '8'],
      answer: '4',
      hints: ['Cell 1.', 'Up, down, left, right.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-5-009-quiz-2',
      type: 'choice',
      text: 'How many poles does a cube have after two subdivision steps?',
      options: ['8', '0', '32', '96'],
      answer: '8',
      hints: ['Cell 2.', 'Subdivision keeps poles.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-5-009-quiz-3',
      type: 'choice',
      text: 'What does a pentagon become when the mesh is subdivided?',
      options: ['A 5-pole at its centre, surrounded by quads', 'Five triangles', 'A quad', 'Nothing changes'],
      answer: 'A 5-pole at its centre, surrounded by quads',
      hints: ['Cell 3.', 'Its face point joins all 5 edges.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-5-009-quiz-4',
      type: 'choice',
      text: 'Which shape can be made of quads with no poles at all?',
      options: ['A torus', 'A sphere', 'A cube', 'None'],
      answer: 'A torus',
      hints: ['χ = 0.', 'Cell 2.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-5-009-quiz-5',
      type: 'choice',
      text: 'On a flat area, what is the average corner angle round a 5-pole?',
      options: ['72°', '90°', '120°', '60°'],
      answer: '72°',
      hints: ['360° / 5.', 'Cell 4.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-5-009-quiz-6',
      type: 'choice',
      text: 'Where is the best place for a 3-pole on a character?',
      options: ['Where the surface turns, away from joints and close-up areas', 'In the middle of the cheek', 'At the elbow', 'Anywhere: poles do not matter'],
      answer: 'Where the surface turns, away from joints and close-up areas',
      hints: ['The graphics strand.', 'Procedure, Step 4.'],
      reviewSection: 'Insight "The graphics strand"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A good modeller can make a ball with no poles.',
      whyStudentsThinkIt: 'Poles are taught as mistakes.',
      correctionExample: 'Cell 2 and the picture: Σ (4 − valence) = 8 on every sphere-like quad mesh.',
      contrastCase: 'On a torus (χ = 0) no poles are needed, and a perfect grid exists.',
    },
    {
      falseBelief: 'Subdividing more cleans up topology.',
      whyStudentsThinkIt: 'More faces look smoother.',
      correctionExample: 'Cell 2: the cube still has its 8 poles after two subdivisions; cell 3: n-gons add poles.',
      contrastCase: 'Subdivision does turn every face into a quad, so triangles and n-gons disappear as faces, while leaving their poles behind.',
    },
    {
      falseBelief: 'Triangles are always bad.',
      whyStudentsThinkIt: '"All quads" is repeated as a rule.',
      correctionExample: 'Game models are sent to the GPU as triangles anyway; a triangle on a flat, rigid, unsubdivided area is harmless.',
      contrastCase: 'Triangles in subdivided or bending areas do harm: they stop loops and leave 3-poles.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A smooth car door shows a faint star-shaped wobble in its reflections after subdivision.',
      competingTechniques: ['Add more subdivision', 'Find the pole under the wobble and move it to the door\'s edge'],
      whyThisTechniqueWins: 'The pole causes the wobble at any level of subdivision; moving it to where the surface turns hides it.',
    },
    {
      situation: 'You need a sphere that subdivides evenly with no pinched spots.',
      competingTechniques: ['A UV sphere', 'A cube-sphere (a subdivided cube pushed onto a sphere)'],
      whyThisTechniqueWins: 'The cube-sphere spends its budget as 8 mild 3-poles; the UV sphere has two 32-poles ringed by triangles.',
    },
  ],

  debugging: [
    {
      commonError: 'Subdividing a mesh with stray n-gons.',
      symptom: 'Star-shaped pinches and uneven shading wherever an n-gon was.',
      whyItHappened: 'Each n-gon became an n-pole.',
      repairStrategy: 'Find n-gons first (the status bar counts them), cut them into quads, then subdivide.',
    },
    {
      commonError: 'A pole in the middle of a joint.',
      symptom: 'The joint folds unevenly when the rig bends it.',
      whyItHappened: 'The loops round the joint end or split at the pole.',
      repairStrategy: 'Reroute edges so the joint is crossed by clean loops; move the pole above or below it.',
    },
    {
      commonError: 'Trying to remove all poles from a closed shape.',
      symptom: 'Every fix creates a new pole somewhere else.',
      whyItHappened: 'The budget Σ (4 − valence) = 4χ cannot change.',
      repairStrategy: 'Decide where the 8 units of poles should go instead of trying to remove them.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Count valences and poles, check the pole budget, and predict the poles subdivision creates.',
    explainVerbally: 'Explain why a ball needs poles, why n-gons become poles, and where poles should be placed.',
    detectIncorrectApplication: 'Recognise pinches from poles and n-gons, poles in joints, and high-valence poles from their symptoms.',
    transferToUnfamiliar: 'Plan the topology of a new model: the poles it needs and where to put them.',
  },
};
