// Guided challenges: a starting scene, a goal, and a checklist the app keeps
// checking while you work. Unlike an example project, nothing tells you the steps;
// hints unlock one at a time, and a worked solution is there as a script.
//
// A check is a pure function of the scene, so the same code grades a learner in
// the app and proves in the tests that the starting scene does not pass and the
// solution does.

import type { Editor } from '../../../engines/mesh/core/Editor';
import { runScript } from '../../../engines/mesh/core/api';
import { sampleKeys } from '../../../engines/mesh/core/animation';
import { charts, uvFits, angleDistortion } from '../../../engines/mesh/core/uv';
import { evaluatedMesh, skinSource } from '../../../engines/mesh/core/evaluate';
import { heatGeodesic } from '../../../engines/mesh/core/geometry';
import { Box3, Vector3 } from 'three';
import { EXAMPLES } from './examples';
import { fmt } from '../../../engines/mesh/core/trace';
import { lintShaderBody } from '../../../engines/mesh/core/shaderTrace';

export interface Check { label: string; ok: boolean; detail?: string }

export interface Challenge {
  id: string;
  title: string;
  icon: string;
  /** What to achieve, not how. */
  brief: string;
  /** Builds the starting scene. */
  setup: string;
  select?: string;
  hints: string[];
  /** One way to do it, as a script. */
  solution: string;
  check(editor: Editor): Check[];
}

const rigCode = EXAMPLES.find((x) => x.id === 'rig-character')!.code;

export const CHALLENGES: Challenge[] = [
  {
    id: 'land-on-20',
    title: 'Land on frame 20',
    icon: '⚽',
    brief: 'The ball is keyed at frame 1, three metres up. Make it fall from rest and land on the floor exactly at frame 20, the way gravity would.',
    select: 'Ball',
    setup: `scene.setTimeline({ start: 1, end: 40 })
scene.add.plane({ name: 'Floor', size: 8 }).material.color = '#3a3f47'
const ball = scene.add.uvSphere({ name: 'Ball', radius: 0.5, segments: 24, rings: 12, position: [0, 3, 0] })
ball.smooth = true
ball.material.color = '#e4572e'
ball.keyframe(1, { position: [0, 3, 0], interp: 'linear' })`,
    hints: [
      'Go to frame 20 (type it in the Timeline\'s F box), move the ball down until it touches the floor, and press I.',
      'Touching the floor means its centre is one radius (0.5) above it.',
      'Falling from rest is slow at first and fast at the end: under gravity the height goes with t², which is the ease-in interpolation. It is set on the key the motion leaves: frame 1.',
    ],
    solution: `const ball = scene.get('Ball')
ball.keyframe(20, { position: [0, 0.5, 0] })   // on the floor at frame 20
ball.setInterpolation(1, 'ease-in')            // from rest: s = t²`,
    check(e) {
      const b = e.scene.get('Ball'), keys = b?.anim?.position ?? [];
      const at20 = keys.length ? sampleKeys(keys, 20).value : b?.position ?? [0, 0, 0];
      const k1 = keys.find((k) => k.frame === 1);
      return [
        { label: 'A position key at frame 20', ok: keys.some((k) => k.frame === 20) },
        { label: 'At frame 20 the ball rests on the floor (centre 0.5 up)', ok: Math.abs(at20[1] - 0.5) < 0.02, detail: `centre at y = ${fmt(at20[1], 3)}` },
        { label: 'It falls straight down', ok: Math.hypot(at20[0], at20[2]) < 0.05 },
        { label: 'It starts from rest and speeds up (ease-in on the frame 1 key)', ok: k1?.interp === 'ease-in', detail: k1 ? `frame 1 key: ${k1.interp}` : 'no key at frame 1' },
      ];
    },
  },
  {
    id: 'six-squares',
    title: 'Six squares',
    icon: '🗺️',
    brief: 'Give the box UVs so the checker shows as perfect squares on every side: six separate pieces, no distortion.',
    select: 'Box',
    setup: `const box = scene.add.cube({ name: 'Box', size: 1.6, position: [0, 0.8, 0] })
box.material.texture = 'checker'`,
    hints: [
      'A closed box cannot be flattened without cutting it. The cuts are seams: UV › Mark seam on selected edges (edit mode, edge select).',
      'To get six pieces, cut along all twelve edges. UV › Seams from sharp edges does exactly that.',
      'Then unwrap: U in edit mode, or UV › Unwrap (LSCM). The UV tab shows the layout.',
    ],
    solution: `const m = scene.get('Box').mesh
m.seamsFromSharp(60)   // the twelve 90° edges
m.unwrap()`,
    check(e) {
      const b = e.scene.get('Box'), m = b?.mesh;
      const fits = !!m && uvFits(m, b!.uv);
      const pieces = m ? charts(m, new Set(b!.seams ?? [])).length : 0;
      const worst = fits ? Math.max(...angleDistortion(m!, b!.uv!)) : Infinity;
      return [
        { label: 'The box has UVs that fit it', ok: fits },
        { label: 'Six pieces (one per side)', ok: pieces === 6, detail: `${pieces} piece${pieces === 1 ? '' : 's'}` },
        { label: 'No distortion: every checker square is square', ok: worst < 1.01, detail: Number.isFinite(worst) ? `worst σ₁/σ₂ = ${fmt(worst, 3)}` : undefined },
      ];
    },
  },
  {
    id: 'fix-the-chest',
    title: 'Fix the chest',
    icon: '🖌️',
    brief: 'When the character raises its arms, automatic weights let them drag the chest along. Repaint the weights so the chest follows the spine, and the hands still follow the arms.',
    select: 'Character',
    setup: rigCode,
    hints: [
      'Select the Character and press Ctrl+Tab: weight paint mode. The heat map is the selected bone\'s weights.',
      'Choose the Spine in the panel, brush Draw, Value 1, and paint over the chest on both sides (or turn on X-mirror and paint one).',
      'Go to frame 24 to see the arm raised while you paint. Keep away from the hands: they must stay on the arms.',
    ],
    solution: `// Paint the spine onto the chest, both sides at once (the spine is its own mirror).
const body = scene.get('Character')
const chest = body.mesh.verts.filter((v) => v.x > 0.25 && v.x < 0.62 && v.y > 0.75 && v.y < 1.25).map((v) => [v.x, v.y, v.z])
body.paintWeights('Spine', { points: chest, brush: 'draw', value: 1, strength: 1, radius: 0.3, mirror: true })`,
    check(e) {
      const body = e.scene.get('Character'), sk = body?.skin;
      if (!body?.mesh || !sk) return [{ label: 'The character is bound to its armature', ok: false }];
      const src = skinSource(body).verts;
      const w = (bone: string, pick: (v: [number, number, number]) => boolean) => {
        const b = sk.bones.indexOf(bone), vs = src.map((v, i) => [v, i] as const).filter(([v]) => pick(v)).map(([, i]) => i);
        return b < 0 || !vs.length ? 0 : vs.reduce((s, i) => s + sk.weights[b][i], 0) / vs.length;
      };
      const chestL = w('UpperArm.L', (v) => v[0] > 0.25 && v[0] < 0.62 && v[1] > 0.75 && v[1] < 1.25);
      const chestR = w('UpperArm.R', (v) => v[0] < -0.25 && v[0] > -0.62 && v[1] > 0.75 && v[1] < 1.25);
      const handL = w('Forearm.L', (v) => v[0] > 1.4), handR = w('Forearm.R', (v) => v[0] < -1.4);
      return [
        { label: 'Left chest: the left arm\'s weight under 10%', ok: chestL < 0.1, detail: `${fmt(chestL * 100, 1)}%` },
        { label: 'Right chest: the right arm\'s weight under 10%', ok: chestR < 0.1, detail: `${fmt(chestR * 100, 1)}%` },
        { label: 'The hands still follow the forearms (over 85%)', ok: handL > 0.85 && handR > 0.85, detail: `${fmt(handL * 100, 0)}%, ${fmt(handR * 100, 0)}%` },
      ];
    },
  },
  {
    id: 'toon-shader',
    title: 'A toon shader of your own',
    icon: '🖌️',
    brief: 'Give the ball a custom shader: light in 4 flat bands, and a black outline where the surface turns edge-on to the eye (N·V below 0.3). Write it in the Shader tab; it must also pass MeshLab\'s checks.',
    select: 'Ball',
    setup: `const ball = scene.add.uvSphere({ name: 'Ball', radius: 1, segments: 48, rings: 24, position: [0, 1, 0] })
ball.smooth = true
ball.material.color = '#e0643c'`,
    hints: [
      'In the Inspector set Shader to Custom; the Shader tab then shows the body of shade(N, L, V, uv, base, light).',
      'Bands: float d = floor(max(dot(N, L), 0.0) * 4.0) / 4.0; then use d where Lambert uses max(dot(N, L), 0.0).',
      'Outline: if (dot(N, V) < 0.3) return vec3(0.0); before the lit colour. Remember 4.0 and 0.0, not 4 and 0.',
    ],
    solution: `const b = scene.get('Ball')
b.material.shader = 'custom'
b.material.glsl = \`float d = floor(max(dot(N, L), 0.0) * 4.0) / 4.0;
if (dot(N, V) < 0.3) return vec3(0.0);
return base * (ambient + d * light);\``,
    check(e) {
      const b = e.scene.get('Ball');
      const glsl = b?.material.shader === 'custom' ? b.material.glsl ?? '' : '';
      const code = glsl.replace(/\/\/.*$/gm, '');
      const problems = glsl ? lintShaderBody(glsl) : [];
      return [
        { label: 'The ball uses a custom shader', ok: !!glsl },
        { label: 'Light is cut into 4 bands (floor of N·L times 4.0, over 4.0)', ok: /floor\s*\(/.test(code) && /dot\s*\(\s*N\s*,\s*L\s*\)/.test(code) && /\b4\.0\b/.test(code) },
        { label: 'An outline where N·V is below 0.3', ok: /dot\s*\(\s*N\s*,\s*V\s*\)\s*<\s*0\.3\b/.test(code) },
        { label: 'It passes the checks (brackets, semicolons, floats, a return)', ok: !!glsl && problems.length === 0, detail: problems.slice(0, 2).map((p) => `line ${p.line}: ${p.message}`).join('; ') || undefined },
      ];
    },
  },
  {
    id: 'keep-it-a-box',
    title: 'Keep it a box',
    icon: '🧊',
    brief: 'This box has a subdivision modifier and has melted into a blob. Without removing the modifier, make it look like a box with softened edges again: at least 90% of the plain box\'s volume.',
    select: 'Box',
    setup: `const box = scene.add.cube({ name: 'Box', size: 1.4, position: [0, 0.9, 0] })
box.modifiers.add('subsurf', { levels: 2 })
box.smooth = true`,
    hints: [
      'Subdivision averages every vertex with its neighbours. With nothing close to an edge, the edge melts away.',
      'Add edges close to each sharp edge ("support loops"): Tab, face select, A for all faces, then Mesh › Inset individual faces, or inset each side as its own region.',
      'Bevel works too (Ctrl+B on all edges, with a small width), though it holds the shape less tightly. The volume shows in the checklist.',
    ],
    solution: `const m = scene.get('Box').mesh
for (const f of m.faces.map((f) => f.index)) m.insetRegion([f], 0.1)   // a support loop 10 cm from every edge`,
    check(e) {
      const b = e.scene.get('Box');
      if (!b?.mesh) return [{ label: 'The box is there', ok: false }];
      const sub = b.modifiers.some((m) => m.type === 'subsurf' && m.enabled);
      const vol = evaluatedMesh(e.scene, b).stats().volume, full = 1.4 ** 3;
      return [
        { label: 'The subdivision modifier is still on', ok: sub },
        { label: 'The cage is still one closed surface', ok: b.mesh.stats().closed },
        { label: 'After subdivision it keeps 90% of the box\'s volume', ok: sub && vol >= 0.9 * full, detail: `${fmt((100 * vol) / full, 1)}%` },
      ];
    },
  },
  {
    id: 'close-the-box',
    title: 'Close the box',
    icon: '📦',
    brief: 'This box has lost its lid: the top face is gone and you can see inside. Close it with one new face, so the box is a closed solid again with every face pointing outwards.',
    select: 'Box',
    setup: `const box = scene.add.cube({ name: 'Box', size: 1.4, position: [0, 0.7, 0] })
box.mesh.delete({ faces: box.mesh.faces.top() })`,
    hints: [
      'A face is a list of the vertices round it. Here they are the four corners round the hole.',
      'Tab for edit mode, press 1 for vertex select, then click one corner of the hole and Shift-click the other three.',
      'Press F (Mesh › Fill). The new face is wound the same way as the faces beside it, so it points outwards.',
    ],
    solution: `const m = scene.get('Box').mesh
m.fill(m.verts.filter((v) => v.y > 0.6).map((v) => v.index))   // the four corners round the hole`,
    check(e) {
      const b = e.scene.get('Box'), m = b?.mesh;
      if (!m) return [{ label: 'The box is there', ok: false }];
      const s = m.stats(), full = 1.4 ** 3, vol = m.volume();
      return [
        { label: 'Six faces', ok: s.faces === 6, detail: `${s.faces} face${s.faces === 1 ? '' : 's'}` },
        { label: 'Closed: every edge has a face on each side', ok: s.closed, detail: s.closed ? undefined : `${m.boundaryEdges().length} edges have a face on one side only` },
        { label: 'Every face points outwards (the volume comes out positive)', ok: s.closed && Math.abs(vol - full) < 1e-6, detail: s.closed ? `volume ${fmt(vol, 3)}; a box 1.4 on a side holds ${fmt(full, 3)}` : undefined },
      ];
    },
  },
  {
    id: 'fix-the-normals',
    title: 'Turn the faces outwards',
    icon: '🧭',
    brief: 'Two faces of this box are wound the wrong way round, so their normals point into the box and they shade dark. Find them and turn them outwards, so every face of the closed box points out.',
    select: 'Box',
    setup: `const box = scene.add.cube({ name: 'Box', size: 1.4, position: [0, 0.7, 0] })
box.mesh.flip([...box.mesh.faces.top(), ...box.mesh.faces.facing([1, 0, 0])])   // the lid and the +x side, wound inwards`,
    hints: [
      'Turn on Normals in the toolbar: each face shows a line along its normal. Two of them point into the box.',
      'Tab for edit mode, press 3 for face select, then click one inward face and Shift-click the other.',
      'Mesh › Flip normals reverses the order of the selected faces\' corners, and with it the direction of their normals.',
    ],
    solution: `const m = scene.get('Box').mesh
// A face points out when its normal leads away from the box's centre. The mesh's corners are in the box's own
// coordinates, centred on (0, 0, 0), so that is n · centre > 0.
m.flip(m.faces.filter((f) => f.normal[0] * f.center[0] + f.normal[1] * f.center[1] + f.normal[2] * f.center[2] < 0).map((f) => f.index))`,
    check(e) {
      const m = e.scene.get('Box')?.mesh;
      if (!m) return [{ label: 'The box is there', ok: false }];
      // The box's centre, and which faces point towards it instead of away.
      const c = m.verts.reduce((a, v) => [a[0] + v[0] / m.verts.length, a[1] + v[1] / m.verts.length, a[2] + v[2] / m.verts.length], [0, 0, 0]);
      const inward = m.faces.map((_, i) => i).filter((i) => { const n = m.faceNormal(i), p = m.faceCenter(i); return n[0] * (p[0] - c[0]) + n[1] * (p[1] - c[1]) + n[2] * (p[2] - c[2]) < 0; });
      const s = m.stats();
      return [
        { label: 'Still a closed box of six faces', ok: s.faces === 6 && s.closed, detail: `${s.faces} faces${s.closed ? '' : ', not closed'}` },
        { label: 'Every face points outwards', ok: inward.length === 0, detail: inward.length ? `face${inward.length === 1 ? '' : 's'} ${inward.join(', ')} still point${inward.length === 1 ? 's' : ''} into the box` : undefined },
        { label: 'So the volume comes out positive', ok: m.volume() > 0, detail: `volume ${fmt(m.volume(), 3)}` },
      ];
    },
  },
  {
    id: 'remove-the-fin',
    title: 'Remove the fin',
    icon: '🦈',
    brief: 'Someone added an extra face that cuts diagonally through this box. Two of its edges are now on three faces each, and its other two edges are open. Remove it, so every edge is on exactly two faces again.',
    select: 'Box',
    setup: `const V = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]
const sides = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]]
scene.add.mesh({ name: 'Box', verts: V, faces: [...sides, [0, 1, 7, 6]], position: [-0.5, 0, -0.5] })   // the last face is the fin`,
    hints: [
      'Edit › Select non-manifold lights up the problem edges: the two on three faces, and the two open ones. All four belong to one face.',
      'Press 3 for face select and click the face that cuts through the box (X-ray in the toolbar lets you see inside).',
      'X deletes the selected face. The status bar then reads 12 edges, with no open edges.',
    ],
    solution: `const m = scene.get('Box').mesh
// The six sides each face straight along an axis; the fin is the one face whose normal is diagonal.
m.delete({ faces: m.faces.where((f) => Math.max(...f.normal.map(Math.abs)) < 0.99) })`,
    check(e) {
      const m = e.scene.get('Box')?.mesh;
      if (!m) return [{ label: 'The box is there', ok: false }];
      const s = m.stats();
      const list = (es: { a: number; b: number }[]) => es.map((x) => `${x.a}-${x.b}`).join(', ');
      const open = m.boundaryEdges(), many = m.nonManifoldEdges();
      return [
        { label: 'No edge on three or more faces', ok: many.length === 0, detail: many.length ? `edge${many.length === 1 ? '' : 's'} ${list(many)}` : undefined },
        { label: 'No open edges', ok: open.length === 0, detail: open.length ? `edge${open.length === 1 ? '' : 's'} ${list(open)}` : undefined },
        { label: 'Still the box: its 8 corners and 6 sides', ok: s.verts === 8 && s.faces === 6 && Math.abs(m.volume() - 1) < 1e-9, detail: `${s.verts} corners, ${s.faces} faces` },
      ];
    },
  },
  {
    id: 'remove-the-floaters',
    title: 'Remove the floaters',
    icon: '🫧',
    brief: 'A scan came back with two small bits floating next to the object: separate pieces of the same mesh. Delete both, and keep the block.',
    select: 'Scan',
    setup: `const verts = [], faces = []
const SIDES = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]]
function block(p, size) {
  const base = verts.length
  for (let i = 0; i < 8; i++) verts.push([p[0] + size * (i % 2), p[1] + size * (Math.floor(i / 2) % 2), p[2] + size * Math.floor(i / 4)])
  for (const s of SIDES) faces.push(s.map((k) => base + k))
}
block([0.6, 1.2, 0.1], 0.15)   // a floater
block([-0.8, -0.8, -0.8], 1.6) // the block
block([-1.3, 0.4, 0.5], 0.2)   // another floater
scene.add.mesh({ name: 'Scan', verts, faces, position: [0, 0.8, 0] })`,
    hints: [
      'Tab for edit mode and press 3 for face select. Click any face of a floater, then Ctrl+L (Edit › Select linked) selects its whole piece.',
      'Shift-click a face of the other floater and press Ctrl+L again to add its piece, or do one at a time.',
      'X deletes the selected faces. The status bar should end at 6 faces.',
    ],
    solution: `const m = scene.get('Scan').mesh
// Keep the piece with the largest area; delete the rest.
const area = (piece) => piece.reduce((sum, f) => sum + m.faces[f].area, 0)
const pieces = m.pieces().sort((a, b) => area(b) - area(a))
m.delete({ faces: pieces.slice(1).flat() })`,
    check(e) {
      const m = e.scene.get('Scan')?.mesh;
      if (!m) return [{ label: 'The scan is there', ok: false }];
      const pieces = m.pieces();
      const big = pieces.find((p) => p.length === 6 && Math.abs(p.reduce((a, f) => a + m.faceArea(f), 0) - 6 * 1.6 * 1.6) < 1e-6);
      return [
        { label: 'One piece left', ok: pieces.length === 1, detail: `${pieces.length} piece${pieces.length === 1 ? '' : 's'}` },
        { label: 'It is the block, all 6 sides', ok: !!big, detail: big ? undefined : 'the large block is not whole' },
      ];
    },
  },
  {
    id: 'farthest-point',
    title: 'The farthest point',
    icon: '🚩',
    brief: 'An ant starts at the red ball on the inside of the ring and can only walk on the surface. Put the yellow flag on the point it would take longest to reach.',
    select: 'Ring',
    setup: `const ring = scene.add.torus({ name: 'Ring', radius: 1, tube: 0.35, segments: 48, tubeSegments: 16 })
const start = ring.mesh.verts[8]                     // on the inside of the ring
const ball = scene.add.uvSphere({ name: 'Start', radius: 0.1, position: [start.x, start.y, start.z] })
ball.material.color = '#e4572e'
const flag = scene.add.uvSphere({ name: 'Flag', radius: 0.1, position: [0, 1, 0] })
flag.material.color = '#f2c14e'`,
    hints: [
      'Walking on the surface is not a straight line through the air, so measure it on the surface: Tab, click the vertex at the red ball, then Heat map › Distance from selected vertices.',
      'Red is far and blue is near. The contour lines join points at the same distance, so the farthest point is where they close round nothing.',
      'Tab back to object mode, select the Flag and move it there: drag with G, or type the vertex’s position into the Inspector.',
    ],
    solution: `const ring = scene.get('Ring')
const d = ring.mesh.geodesic(8)                      // surface distance from the start, by the heat method
const far = d.indexOf(Math.max(...d))
const p = ring.mesh.verts[far]
scene.get('Flag').position = [p.x, p.y, p.z]
log('farthest vertex', far, 'at distance', d[far].toFixed(3))`,
    check(e) {
      const ring = e.scene.get('Ring'), flag = e.scene.get('Flag');
      if (!ring?.mesh || !flag) return [{ label: 'The ring and the flag are there', ok: false }];
      const d = heatGeodesic(ring.mesh, [8]), max = Math.max(...d);
      const world = ring.mesh.verts.map((v) => new Vector3(...v).applyMatrix4(e.scene.worldMatrix(ring)));
      const at = new Vector3(...flag.position);
      let near = 0;
      world.forEach((p, i) => { if (p.distanceTo(at) < world[near].distanceTo(at)) near = i; });
      const gap = world[near].distanceTo(at), share = d[near] / max;
      return [
        { label: 'The flag is on the ring’s surface (within 0.1 of a vertex)', ok: gap < 0.1, detail: `${fmt(gap, 3)} from the nearest vertex` },
        { label: 'It is at the farthest point: at least 97% of the longest walk', ok: gap < 0.1 && share >= 0.97, detail: `${fmt(share * 100, 1)}% of the farthest distance` },
      ];
    },
  },
  {
    id: 'staircase',
    title: 'Script a staircase',
    icon: '🪜',
    brief: 'Build a staircase of ten steps from code: each step a block 1 wide, 0.3 deep and 0.2 higher than the one before, standing on the floor and climbing towards +z from z = 0. Name them Step 1 to Step 10.',
    setup: `scene.add.plane({ name: 'Floor', size: 8, position: [0, 0, 1.5] }).material.color = '#3a3f47'`,
    hints: [
      'Open the Script tab. A loop with k from 1 to 10 adds one step each time round.',
      'scene.add.cube({ size: 1 }) makes a cube from -0.5 to 0.5 on each axis. Its scale stretches it, and its position moves its centre.',
      'Step k is h = 0.2 k high, so its centre is at y = h / 2. It covers z from 0.3 (k - 1) to 0.3 k, so its centre is at z = 0.3 k - 0.15.',
    ],
    solution: `for (let k = 1; k <= 10; k++) {
  const h = 0.2 * k
  scene.add.cube({ name: 'Step ' + k, size: 1, position: [0, h / 2, 0.3 * k - 0.15], scale: [1, h, 0.3] })
}`,
    check(e) {
      const steps = e.scene.objects.filter((o) => o.mesh && /^Step \d+$/.test(o.name));
      const box = (o: typeof steps[number]) => {
        const b = new Box3();
        for (const v of o.mesh!.verts) b.expandByPoint(new Vector3(...v).applyMatrix4(e.scene.worldMatrix(o)));
        return b;
      };
      const k = (o: typeof steps[number]) => Number(o.name.slice(5));
      const ok = (a: number, b: number) => Math.abs(a - b) < 1e-3;
      const bad = (test: (b: Box3, k: number) => boolean) => steps.filter((o) => !test(box(o), k(o))).map((o) => o.name);
      const names = new Set(steps.map(k));
      const allNamed = names.size === 10 && [...names].every((n) => n >= 1 && n <= 10);
      const size = bad((b) => ok(b.max.x - b.min.x, 1) && ok(b.max.z - b.min.z, 0.3));
      const height = bad((b, n) => ok(b.min.y, 0) && ok(b.max.y, 0.2 * n));
      const place = bad((b, n) => ok(b.min.z, 0.3 * (n - 1)) && ok(b.min.x, -0.5));
      const list = (xs: string[]) => (xs.length ? `wrong: ${xs.slice(0, 3).join(', ')}${xs.length > 3 ? '…' : ''}` : undefined);
      return [
        { label: 'Ten steps, named Step 1 to Step 10', ok: allNamed, detail: `${steps.length} found` },
        { label: 'Each step is 1 wide and 0.3 deep', ok: allNamed && !size.length, detail: list(size) },
        { label: 'Step k stands on the floor and is 0.2 × k high', ok: allNamed && !height.length, detail: list(height) },
        { label: 'Each starts where the one before ends, climbing from z = 0', ok: allNamed && !place.length, detail: list(place) },
      ];
    },
  },
];

/** Build a challenge's starting scene on a new scene (the default cube removed, the sun kept). */
export function startChallenge(editor: Editor, c: Challenge): string | null {
  editor.newScene();
  editor.field = null; editor.playing = false;
  const cube = editor.scene.get('Cube');
  if (cube) editor.scene.remove(cube.id);
  editor.selected.clear(); editor.active = null;
  // The setup is not traced: its trace would show how the starting scene was made, which can give the
  // answer away (fix-the-normals' setup flips the very faces the learner has to find).
  const tracing = editor.traceEnabled;
  editor.traceEnabled = false;
  const r = runScript(editor, c.setup, `Start challenge: ${c.title}`);
  editor.traceEnabled = tracing;
  if (r.error) return r.error;
  // The starting point is not something to undo or to replay as the learner's work.
  editor.undoStack = []; editor.redoStack = []; editor.log = [];
  if (c.select) { const o = editor.scene.get(c.select); if (o) editor.selectObject(o.id); }
  editor.message = `Challenge: ${c.title}`;
  editor.emit('select');
  return null;
}
