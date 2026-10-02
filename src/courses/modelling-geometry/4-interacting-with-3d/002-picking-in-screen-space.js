// Lesson 4.2: picking in screen space. Vertices and edges have no area, so a ray almost never hits one. Instead
// each is projected to the screen and the nearest one to the pointer, within a few pixels, is picked: distance to
// a point for vertices, distance to a clamped segment for edges.

// The scene: a block 2 wide at the origin, seen by a camera at (3, 2.5, 4), fov 50°, on a 1280 × 720 image.
const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(2)
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l) }
const eye = [3, 2.5, 4], fwd = unit(sub([0, 0, 0], eye)), right = unit(cross(fwd, [0, 1, 0])), up = cross(right, fwd)
const W = 1280, H = 720, f = 1 / Math.tan(25 * Math.PI / 180), near = 0.1, far = 200
// Lessons 3.1 and 3.2: into camera space, divide by the distance, then to pixels. z is the depth after the divide.
function toScreen(p) {
  const o = sub(p, eye), x = dot(o, right), y = dot(o, up), d = dot(o, fwd)
  if (d <= 0) return null
  const zc = ((far + near) / (near - far)) * -d + 2 * far * near / (near - far)
  return { x: (f / (W / H) * x / d + 1) / 2 * W, y: (1 - f * y / d) / 2 * H, z: zc / d }
}
const verts = []
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) verts.push([x, y, z])
const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]
const screen = verts.map(toScreen)
// The closest point of segment a–b to p: how far along (t, clamped to 0..1) and how far away.
function pointSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return { t, d: Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y) }
}
`;

const PROJECT = `${BASE}
screen.forEach((s, i) => console.log('v' + i + ' (' + verts[i].join(', ') + ') → pixel (' + r(s.x) + ', ' + r(s.y) + '), depth ' + s.z.toFixed(5)))`;

const VERTEX = `${BASE}
// The pointer, 7 px right of and 5 px below vertex 7's pixel.
const p = { x: screen[7].x + 7, y: screen[7].y + 5 }
function nearestVertex(p, radius) {
  let best = null, bd = radius, bz = Infinity
  screen.forEach((s, i) => {
    const d = Math.hypot(s.x - p.x, s.y - p.y)
    // Nearer on screen wins; within 1 px of a tie, nearer to the camera wins.
    if (d < bd - 1 || (Math.abs(d - bd) <= 1 && s.z < bz)) { bd = d; bz = s.z; best = i }
  })
  return best === null ? 'nothing within ' + radius + ' px' : 'v' + best + ', ' + r(bd) + ' px away'
}
console.log('pointer (' + r(p.x) + ', ' + r(p.y) + '): ' + nearestVertex(p, 12))
console.log('30 px further right: ' + nearestVertex({ x: p.x + 30, y: p.y }, 12))
const ranked = screen.map((s, i) => ({ i, d: Math.hypot(s.x - p.x, s.y - p.y) })).sort((a, b) => a.d - b.d).slice(0, 3)
console.log('nearest three: ' + ranked.map((x) => 'v' + x.i + ' ' + r(x.d) + ' px').join(', '))`;

const EDGE = `${BASE}
// The edge from v6 to v7 on screen, and three pointers near it.
const a = screen[6], b = screen[7]
const at = (t, off) => ({ x: a.x + t * (b.x - a.x) + off[0], y: a.y + t * (b.y - a.y) + off[1] })
for (const [name, p] of [['beside the middle', at(0.5, [0, 6])], ['beyond v7', at(1.2, [0, 0])], ['far below', at(0.5, [0, 40])]]) {
  const { t, d } = pointSegment(p, a, b)
  console.log(name + ': t = ' + r(t) + ', ' + r(d) + ' px' + (d <= 10 ? ' (picked)' : ' (too far)'))
}`;

const PICTURE = `${BASE}
// Draw the block's edges as they land on the image, the pointer with its 12 px reach, and what it picks.
const p = { x: screen[7].x + 7, y: screen[7].y + 5 }
const canvas = document.createElement('canvas')
canvas.width = 640; canvas.height = 360
canvas.style.cssText = 'display: block; margin: 8px auto; max-width: 100%'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'), k = 0.5                // the 1280 × 720 image at half size
g.fillStyle = '#1e293b'; g.fillRect(0, 0, 640, 360)
g.strokeStyle = '#94a3b8'; g.lineWidth = 2
for (const [i, j] of edges) { g.beginPath(); g.moveTo(screen[i].x * k, screen[i].y * k); g.lineTo(screen[j].x * k, screen[j].y * k); g.stroke() }
let best = null, bd = 12
screen.forEach((s, i) => { const d = Math.hypot(s.x - p.x, s.y - p.y); if (d < bd) { bd = d; best = i } })
for (const [i, s] of screen.entries()) { g.fillStyle = i === best ? '#ef4444' : '#e2e8f0'; g.beginPath(); g.arc(s.x * k, s.y * k, i === best ? 5 : 3, 0, 2 * Math.PI); g.fill() }
g.strokeStyle = '#f59e0b'; g.beginPath(); g.arc(p.x * k, p.y * k, 12 * k, 0, 2 * Math.PI); g.stroke()
g.fillStyle = '#f59e0b'; g.beginPath(); g.arc(p.x * k, p.y * k, 2, 0, 2 * Math.PI); g.fill()
console.log('picked v' + best + ' (red), ' + r(bd) + ' px from the pointer (orange, with its 12 px reach)')`;

const CHALLENGE = `// On screen, an edge runs from a = (100, 100) to b = (300, 200). The pointer is at (250, 100).
// Give [t, d]: how far along the edge its closest point is (0 at a, 1 at b), and how many pixels away.
const answer = [0, 0]

console.log('t = ' + answer[0] + ', d = ' + answer[1] + ' px')`;

const SOLVED = CHALLENGE.replace('const answer = [0, 0]', 'const answer = [0.6, Math.hypot(30, 60)]');

/** The challenge's check: read [t, d] (numbers or arithmetic with Math) and name the slip. */
export function checkSegment(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/^\s*const\s+answer\s*=\s*\[([^\n]*)\]\s*$/m);
  if (!m) return no('Keep the line const answer = [t, d].');
  if (!/^[\w\s.+\-*/(),]*$/.test(m[1]) || /\b(?!Math\b|hypot\b|sqrt\b)[A-Za-z_]\w*/.test(m[1])) return no('Write t and d as numbers, or arithmetic using Math.');
  let v;
  try { v = Function('Math', `"use strict"; return [${m[1]}];`)(Math); } catch { return no('The answer could not be worked out: check the brackets.'); }
  if (!Array.isArray(v) || v.length !== 2 || !v.every((x) => typeof x === 'number' && Number.isFinite(x))) return no('Give two numbers: [t, d].');
  const [t, d] = v, close = (x, y, tol) => Math.abs(x - y) < tol;
  if (close(t, 0.6, 0.005) && close(d, Math.hypot(30, 60), 0.05)) return { pass: true, message: 't = (p − a)·(b − a) / |b − a|² = (150, 0)·(200, 100) / 50000 = 0.6; the closest point is a + 0.6 (b − a) = (220, 160), and (250, 100) is √(30² + 60²) = 67.08 px from it.' };
  if (t === 0 && d === 0) return no('Project the pointer onto the edge: t = (p − a)·(b − a) / |b − a|², then measure from a + t (b − a).');
  if (close(t, 30000 / Math.hypot(200, 100), 0.5)) return no(`t = ${+t.toFixed(2)} divides by |b − a|, not |b − a|². Dividing by the length squared makes t run from 0 to 1 along the edge.`);
  if (close(d, 150, 0.05)) return no('150 px is the distance to a, the start of the edge. The closest point is partway along it.');
  if (close(d, Math.hypot(50, 100), 0.05)) return no(`${+d.toFixed(2)} px is the distance to b, the end of the edge. The closest point is partway along it.`);
  if (close(t, 0.6, 0.005)) return no(`t = 0.6 is right. The closest point is then (220, 160); d is the distance from (250, 100) to it.`);
  return no(`t = ${+t.toFixed(3)} is not where the closest point is. t = (p − a)·(b − a) / |b − a|².`);
}

export default {
  id: 'modelling-geometry-4-002',
  slug: 'picking-in-screen-space',
  chapter: 'modelling-geometry',
  order: 2,
  title: 'Picking in screen space',
  subtitle: 'Points and lines are too thin to hit with a ray. Project them to the screen and pick the nearest within a few pixels.',
  tags: ['picking', 'screen space', 'point to segment', 'vertex select', 'edge select'],
  coreConcept: 'Vertices and edges are picked by projecting them to pixels and measuring screen distance to the pointer: the nearest vertex within a radius (12 px in MeshLab), ties within a pixel going to the one nearer the camera; for edges, the distance to the segment\'s closest point, t = ((p − a)·(b − a)) / |b − a|² clamped to 0..1.',
  prerequisites: ['modelling-geometry-4-001', 'modelling-geometry-3-002', 'modelling-geometry-2-001'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-4-003',

  hook: {
    question: 'A vertex is a point: it has no size at all. A ray from the mouse would have to pass exactly through it. How does a modelling tool let you click a vertex?',
    realWorldContext: 'Every editor that lets you grab points or lines works in screen space: vertices and edges in Blender and MeshLab, control points of curves in Illustrator, bones in a rig, handles on a gizmo. The rule is always the same: what is drawn nearest the pointer, within a few pixels, wins.',
  },

  intuition: {
    prose: [
      'A ray from the eye (lesson 4.1) hits a face, which has area. A vertex has none. The chance that the ray passes exactly through one is zero. And the user does not aim in 3D anyway: they aim at a dot on the screen.',
      'So turn the question round. Project every vertex to the screen (lesson 3.2), the way it is drawn. Then measure, in pixels, how far each one is from the pointer: $d = \\sqrt{(x - p_x)^2 + (y - p_y)^2}$. The nearest wins, if it is within a **pick radius**. MeshLab uses $12$ pixels for vertices.',
      'Before running cell 2, predict: the pointer is $7$ pixels right of a corner and $5$ below. Is the corner within reach?',
      'Yes: $\\sqrt{7^2 + 5^2} = 8.60$ pixels, under $12$. Move the pointer $30$ pixels further right and nothing is within $12$: nothing is picked, so a click in empty space selects nothing.',
      'Two vertices can be drawn on top of each other: a front corner and a back corner can land on nearly the same pixel. Within a pixel of a tie, MeshLab picks the one **nearer the camera**, using the depth after the divide. It does not check whether the vertex is hidden behind a face, so a back corner can be picked when it is the nearest dot on screen.',
      'Edges are segments on the screen. The closest point of segment $a \\to b$ to the pointer $p$ is at $t = \\frac{(p - a) \\cdot (b - a)}{|b - a|^2}$ along it: the dot product measures how far $p$ reaches along the edge (lesson 2.1), and dividing by the length squared makes $t$ run from $0$ at $a$ to $1$ at $b$.',
      'If $t$ comes out below $0$ or above $1$, the closest point of the infinite line is off the end of the edge, so $t$ is **clamped** to the end. Then the distance is from $p$ to $a + t(b - a)$. The nearest edge within $10$ pixels wins.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Pick a vertex or an edge in screen space',
        body: 'Step 1. Project every vertex to a pixel $(x, y)$ with a depth $z$; skip those behind the camera.\nStep 2. Vertices: $d = |(x, y) - p|$ for each.\nStep 3. Keep the smallest $d$ under the radius (12 px); if two are within 1 px of each other, keep the one with the smaller depth.\nStep 4. Edges: for each, $t = (p - a)\\cdot(b - a) / |b - a|^2$, clamped to $[0, 1]$.\nStep 5. $d = |a + t(b - a) - p|$; keep the smallest under the radius (10 px).\nStep 6. Nothing under the radius: pick nothing.',
      },
      {
        type: 'warning',
        title: 'Clamp t to the edge',
        body: 'Without the clamp, a pointer far beyond the end of an edge but close to the line through it would pick that edge. Clamping measures to the edge itself.',
      },
      {
        type: 'warning',
        title: 'Pixels, not world units',
        body: 'Measure in pixels. A radius in world units would be huge for close objects and tiny for distant ones; people aim by what they see.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: why thin things need a pick radius',
        body: 'A vertex is drawn as a dot a few pixels wide, an edge as a line one or two pixels wide: much bigger on screen than their true size, zero. The pick radius matches what is drawn, plus the slack a hand needs. Blender uses about the same 10 to 15 pixels.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "you must click exactly on a vertex". The orange circle is the pointer\'s 12-pixel reach; the red corner is inside it and is picked though the pointer is not on it. Invariant: the result depends only on where things are drawn, not where they are in 3D.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'toScreen() in the cells is Step 1; nearestVertex() is Steps 2, 3 and 6; pointSegment() is Steps 4 and 5.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Picking needs the same projection the GPU used to draw, so the CPU repeats it for every vertex when you click. For huge meshes, tools render vertex ids into a hidden image and read the pixels near the pointer instead.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'MeshLab\'s viewport picks vertices and edges with these exact functions (core/screenPick.ts). Mesh › Trace screen picking traces them for the scene camera; in a script, camera.tracePickNear(object, px, py, \'vert\' or \'edge\').' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: screen-space picking',
        caption: 'Project the corners, pick the nearest within a radius, measure to an edge, and see the reach.',
        props: {
          lesson: {
            title: 'Picking in screen space',
            subtitle: 'Find the vertex or edge drawn nearest the pointer.',
            cells: [
              { type: 'js', instruction: '### 1. Every corner on the screen\nThe block\'s 8 corners projected to pixels, with their depths.', startCode: PROJECT },
              { type: 'js', instruction: '### 2. The nearest vertex\nPredict first: is a corner 7 px right and 5 px down within a 12 px reach?', startCode: VERTEX },
              { type: 'js', instruction: '### 3. Distance to an edge\nThe closest point of a segment, with t clamped to its ends.', startCode: EDGE },
              { type: 'js', instruction: '### 4. See the reach\nThe block as drawn, the pointer with its 12 px reach, and the vertex it picks.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 380 },
              { type: 'challenge', instruction: '### 5. Challenge: point to segment\nGive t and the distance for one pointer and one edge.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkSegment },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Picking in screen space" in MeshLab](#/lab/mesh-lab?project=screen-picking). With **Record traces** on, the script projects the block\'s vertices onto the camera\'s image and picks from a pointer 7 px right of and 5 px below a corner. In **Predict** mode, predict the distance. Compare with cell 2.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Edit mode:** 1 vertex select, 2 edge select, 3 face select (face select uses the ray of lesson 4.1).\n- Click near a vertex or edge: within 12 px (vertices) or 10 px (edges) is enough. Shift+click adds to the selection.\n- **Mesh › Trace screen picking (scene camera, image centre)** traces the pick for the scene camera.\n- **In Blender:** the same in edit mode; in solid view only visible vertices can be picked unless X-ray (Alt+Z) is on.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why the projection is the right space.** The user sees, and aims at, the projected dots. Two vertices 1 m apart in 3D can be 1 pixel apart on screen (one behind the other) or 500 pixels apart (side by side, close to the camera). Only the screen distance says which one the user meant.',
      '**Why $t = (p - a)\\cdot(b - a) / |b - a|^2$.** The closest point of the line $a + t(b - a)$ to $p$ is where $p - (a + t(b - a))$ is perpendicular to the line: $(p - a - t(b - a)) \\cdot (b - a) = 0$, so $t |b - a|^2 = (p - a)\\cdot(b - a)$.',
      '**Why clamping is right.** Along the line, the distance to $p$ grows as you move away from that foot point in either direction (it is the square root of a quadratic in $t$ with its minimum there). So on the segment $[0, 1]$, the closest point is the foot if it lies inside, and otherwise the end nearest to it.',
      '**Why ties go to the nearer vertex.** When two dots overlap, the nearer one is drawn on top, so it is the one the user sees and means.',
    ],
    equations: [
      { label: 'Vertex distance', latex: 'd = \\sqrt{(x - p_x)^2 + (y - p_y)^2}' },
      { label: 'Closest point on a segment', latex: 't = \\operatorname{clamp}\\Big( \\frac{(p - a)\\cdot(b - a)}{|b - a|^2}, 0, 1 \\Big), \\qquad d = |a + t(b - a) - p|' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** Screen-space picking selects $\\arg\\min_i \\| \\pi(v_i) - p \\|$ over the projected elements within radius $\\rho$, where $\\pi$ is the projection to pixels; for segments the distance is $\\min_{t \\in [0,1]} \\| \\pi(a) + t(\\pi(b) - \\pi(a)) - p \\|$. Projection maps straight edges to straight segments (lesson 3.2), so projecting only the endpoints is exact.',
      '**Invariant viewpoint.** The pick depends only on the image: zooming, orbiting or moving the object changes it exactly as it changes what is drawn. It is not invariant under changing the radius, which trades precision (small) for ease (large).',
      '**Geometric picture.** Around each projected vertex is a disc of radius 12 px; the screen splits into the regions nearest each vertex (a Voronoi diagram), cut off at the discs. Around each edge is a stadium shape: a rectangle with round ends, from the clamping.',
      '**Where this goes.** Box selection (lesson 4.3) projects vertices the same way and tests them against a rectangle. Snapping (lesson 4.4) picks the nearest vertex to a dragged point. Gizmo handles are picked by screen distance too.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-4-002-ex1',
      title: 'Within reach?',
      problem: 'A vertex is drawn at $(400, 300)$. The pointer is at $(409, 308)$. With a 12 px radius, is it picked?',
      steps: [
        { expression: 'd = \\sqrt{9^2 + 8^2} = \\sqrt{145} = 12.04', annotation: 'Step 2: distance on screen.' },
        { expression: '12.04 > 12', annotation: 'Step 3: just outside the radius.' },
      ],
      conclusion: 'Not picked: the pointer is 12.04 px away, a hair beyond the 12 px reach.',
    },
    {
      id: 'modelling-geometry-4-002-ex2',
      title: 'An edge, inside its ends',
      problem: 'An edge runs from $a = (0, 0)$ to $b = (100, 0)$ on screen. The pointer is at $(40, 6)$.',
      steps: [
        { expression: 't = \\frac{(40, 6)\\cdot(100, 0)}{100^2} = 0.4', annotation: 'Step 4: inside 0..1, no clamping.' },
        { expression: 'd = |(40, 0) - (40, 6)| = 6', annotation: 'Step 5: straight down to the edge.' },
      ],
      conclusion: 'The edge is 6 px away, within 10: picked.',
    },
    {
      id: 'modelling-geometry-4-002-ex3',
      title: 'An edge, beyond its end',
      problem: 'Same edge; the pointer is at $(108, 3)$.',
      steps: [
        { expression: 't = \\frac{108 \\cdot 100}{10000} = 1.08 \\to 1', annotation: 'Step 4: beyond b, clamped.' },
        { expression: 'd = |(100, 0) - (108, 3)| = \\sqrt{73} = 8.54', annotation: 'Step 5: distance to the end b.' },
      ],
      conclusion: 'The closest point is the end $b$, $8.54$ px away: still within 10, so the edge is picked; without clamping the distance would wrongly be 3.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-4-002-ch1',
      difficulty: 'easy',
      problem: 'Two vertices are drawn at $(200, 200)$ and $(205, 200)$, depths $0.95$ and $0.98$. The pointer is at $(202.5, 200)$. Which is picked?',
      walkthrough: [
        { expression: 'd = 2.5 \\text{ and } 2.5', annotation: 'A tie on screen.' },
        { expression: '0.95 < 0.98', annotation: 'The first is nearer the camera.' },
      ],
      answer: 'The first, at (200, 200): it is the same distance on screen, and nearer the camera, so it is the one drawn on top.',
    },
    {
      id: 'modelling-geometry-4-002-ch2',
      difficulty: 'medium',
      problem: 'A user clicks on the middle of a face, far from every vertex, in vertex select. Nothing is picked. Is that a bug?',
      walkthrough: [
        { expression: '\\min d > 12', annotation: 'No vertex within reach.' },
        { expression: '\\text{Step 6: pick nothing}', annotation: 'Clicking empty space clears the selection, which is how users deselect.' },
      ],
      answer: 'No: vertex select picks only vertices within 12 px, so a click far from all of them picks nothing (and clears the selection), which is intended.',
    },
    {
      id: 'modelling-geometry-4-002-ch3',
      difficulty: 'hard',
      problem: 'In a dense mesh, users complain they keep picking vertices on the back of the model. Suggest a fix and its cost.',
      walkthrough: [
        { expression: '\\text{screen distance ignores occlusion}', annotation: 'A back vertex can be the nearest dot.' },
        { expression: '\\text{test visibility: depth buffer at the vertex\'s pixel}', annotation: 'Keep it only if its depth is not behind what was drawn there.' },
        { expression: '\\text{cost: a depth read per vertex, and an X-ray mode to turn it off}', annotation: 'Blender does this: solid mode picks visible vertices only.' },
      ],
      answer: 'Drop vertices that are hidden: compare each one\'s depth with the depth buffer at its pixel (or cast a short ray to it) and skip it if something is in front; it costs a depth read or ray per candidate, and needs an X-ray mode for when the user does want hidden vertices.',
    },
  ],

  semantics: {
    core: [
      { symbol: '(x, y, z)', meaning: 'A vertex on screen: its pixel and its depth after the divide.' },
      { symbol: 'p', meaning: 'The pointer, in pixels.' },
      { symbol: 'd', meaning: 'Distance on screen, in pixels, from the pointer to a vertex or to an edge\'s closest point.' },
      { symbol: '\\rho', meaning: 'The pick radius: 12 px for vertices, 10 px for edges in MeshLab.' },
      { symbol: 't', meaning: 'Where along an edge its closest point is: 0 at a, 1 at b, clamped to the edge.' },
      { symbol: 'z \\text{ tie-break}', meaning: 'Within a pixel of a tie, the vertex nearer the camera wins.' },
    ],
    rulesOfThumb: [
      'Pick what is drawn: measure on the screen, in pixels.',
      'Clamp t; measure to the segment, not the line.',
      'A radius of 10 to 15 px matches what people can aim at.',
      'Ties go to the nearer thing, which is drawn on top.',
      'Faces have area: pick them with a ray; points and lines have none: pick them on screen.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-4-001', label: 'Picking by ray', note: 'Faces are picked by a ray; vertices and edges need this instead.' },
      { lessonId: 'modelling-geometry-3-002', label: 'Projection', note: 'Every vertex goes to a pixel and a depth.' },
      { lessonId: 'modelling-geometry-2-001', label: 'Vectors, dot and cross', note: 'The dot product measures how far the pointer reaches along an edge.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-4-003', label: 'Box and loop selection', note: 'Box select projects vertices the same way and tests them against a rectangle.' },
      { lessonId: 'modelling-geometry-4-004', label: 'Dragging with a gizmo', note: 'Gizmo handles and snapping targets are picked by screen distance.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-4-002-1', label: 'Read why vertices and edges are picked on the screen, not by a ray', type: 'read' },
    { id: 'cp-modelling-geometry-4-002-2', label: 'Read the pick radius and the depth tie-break', type: 'read' },
    { id: 'cp-modelling-geometry-4-002-3', label: 'Read the closest point on a segment, and why t is clamped', type: 'read' },
    { id: 'cp-modelling-geometry-4-002-4', label: 'Run cells 1 to 3 and find what each pointer picks', type: 'lab' },
    { id: 'cp-modelling-geometry-4-002-5', label: 'Trace screen picking in MeshLab in Predict mode, and pick a corner yourself', type: 'lab' },
    { id: 'cp-modelling-geometry-4-002-6', label: 'Work through example 1, within reach', type: 'example' },
    { id: 'cp-modelling-geometry-4-002-7', label: 'Work through example 3, beyond the edge\'s end', type: 'example' },
    { id: 'cp-modelling-geometry-4-002-8', label: 'Complete the challenge: point to segment', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-4-002-assess-1',
        type: 'choice',
        text: 'An edge on screen runs from (0, 0) to (10, 0). The pointer is at (−6, 8). How far is the edge?',
        options: ['10 px', '8 px', '6 px', '14 px'],
        answer: '10 px',
        hint: 't = −0.6 clamps to 0, so measure to (0, 0): √(36 + 64) = 10.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-4-002-quiz-1',
      type: 'choice',
      text: 'Why are vertices not picked with a ray?',
      options: ['A ray almost never passes exactly through a point', 'Rays are too slow', 'Vertices are behind the faces', 'Rays only work in orthographic views'],
      answer: 'A ray almost never passes exactly through a point',
      hints: ['A point has no area.', 'A face has area, so a ray can hit it.'],
      reviewSection: 'Intuition: the first paragraph',
    },
    {
      id: 'modelling-geometry-4-002-quiz-2',
      type: 'choice',
      text: 'A vertex is 8.6 px from the pointer; MeshLab\'s radius is 12 px. Is it picked (if nearest)?',
      options: ['Yes', 'No', 'Only in X-ray', 'Only if it is in front'],
      answer: 'Yes',
      hints: ['8.6 < 12.', 'Cell 2.'],
      reviewSection: 'Intuition: the prediction, and cell 2',
    },
    {
      id: 'modelling-geometry-4-002-quiz-3',
      type: 'choice',
      text: 'For an edge from a to b, t = 1.4. What does the picker do?',
      options: ['Clamps t to 1 and measures to b', 'Uses t = 1.4', 'Ignores the edge', 'Clamps t to 0'],
      answer: 'Clamps t to 1 and measures to b',
      hints: ['The closest point of the line is beyond b.', 'The closest point of the edge is then b itself.'],
      reviewSection: 'Warning "Clamp t to the edge"',
    },
    {
      id: 'modelling-geometry-4-002-quiz-4',
      type: 'choice',
      text: 'Two vertices are equally far from the pointer on screen. Which does MeshLab pick?',
      options: ['The one nearer the camera', 'The one with the lower number', 'The one further away', 'Neither'],
      answer: 'The one nearer the camera',
      hints: ['It is drawn on top.', 'The depth breaks the tie.'],
      reviewSection: 'Intuition: the tie paragraph',
    },
    {
      id: 'modelling-geometry-4-002-quiz-5',
      type: 'choice',
      text: 'Which of these is picked with a ray rather than by screen distance?',
      options: ['A face', 'A vertex', 'An edge', 'A gizmo arrow handle'],
      answer: 'A face',
      hints: ['Faces have area.', 'Lesson 4.1.'],
      reviewSection: 'Rules of thumb',
    },
    {
      id: 'modelling-geometry-4-002-quiz-6',
      type: 'choice',
      text: 'Why is the pick radius in pixels rather than in world units?',
      options: ['Users aim at what is drawn, whose size on screen depends on distance', 'Pixels are smaller', 'World units are not defined in edit mode', 'GPUs need pixels'],
      answer: 'Users aim at what is drawn, whose size on screen depends on distance',
      hints: ['A world radius would be huge near the camera and tiny far away.', 'Warning "Pixels, not world units".'],
      reviewSection: 'Warning "Pixels, not world units"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'To select a vertex you must click exactly on it.',
      whyStudentsThinkIt: 'A point seems to need a precise click.',
      correctionExample: 'A pointer 7 px right and 5 px below a corner picks it: 8.60 px is within the 12 px reach.',
      contrastCase: '30 px further right, nothing is within reach and nothing is picked.',
    },
    {
      falseBelief: 'The distance to an edge is the distance to the line through it.',
      whyStudentsThinkIt: 'Point-to-line distance is the formula people remember.',
      correctionExample: 'For the edge (0, 0)–(100, 0) and the pointer (108, 3), the line is 3 px away, but the edge itself is 8.54 px away, at its end.',
      contrastCase: 'For a pointer beside the middle of the edge, the two distances are the same.',
    },
    {
      falseBelief: 'Only visible vertices can be picked.',
      whyStudentsThinkIt: 'You can only see the front of a solid model.',
      correctionExample: 'MeshLab picks the nearest dot on screen whatever is in front of it, so a back corner can be picked.',
      contrastCase: 'Blender in solid mode tests visibility and skips hidden vertices unless X-ray is on.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A vector drawing app must let users grab the control points of curves.',
      competingTechniques: ['Test whether the click is inside each control point\'s exact position', 'Pick the nearest control point within about 10 px of the click'],
      whyThisTechniqueWins: 'Exact hits are impossible to make on purpose; a screen radius matches the dots that are drawn.',
    },
    {
      situation: 'A map app must let users tap a road (a polyline) on a phone.',
      competingTechniques: ['Distance from the tap to each road\'s vertices', 'Distance from the tap to each road segment, clamped, within a finger-sized radius'],
      whyThisTechniqueWins: 'A tap in the middle of a long straight stretch is far from every vertex but right on the segment; segment distance with clamping finds it.',
    },
  ],

  debugging: [
    {
      commonError: 'Measuring the pick radius in world units.',
      symptom: 'Picking is too easy on close objects and impossible on distant ones.',
      whyItHappened: 'A world distance looks bigger or smaller on screen with depth.',
      repairStrategy: 'Project first and measure in pixels.',
    },
    {
      commonError: 'Forgetting to clamp t.',
      symptom: 'Clicking in empty space beyond the end of an edge selects that edge.',
      whyItHappened: 'The distance to the infinite line is small there; the edge itself is far.',
      repairStrategy: 'Clamp t to 0..1 before measuring.',
    },
    {
      commonError: 'Not skipping vertices behind the camera.',
      symptom: 'Clicking selects a vertex that is not on screen at all.',
      whyItHappened: 'A point behind the camera projects through the divide to a mirrored pixel (lesson 3.2).',
      repairStrategy: 'Skip any vertex with w ≤ 0 (in front distance ≤ 0) before measuring.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Project vertices, pick the nearest within a radius with the depth tie-break, and compute clamped point-to-segment distances.',
    explainVerbally: 'Explain why thin things are picked on screen, and why t is clamped.',
    detectIncorrectApplication: 'Recognise world-unit radii, unclamped segments and behind-camera points from their symptoms.',
    transferToUnfamiliar: 'Design picking for curve handles in a drawing app or roads on a map.',
  },
};
