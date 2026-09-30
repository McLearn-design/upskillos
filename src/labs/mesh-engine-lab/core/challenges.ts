// Challenges for the Mesh Engine lab: a scene, a brief, and checks that read
// only the scene — never the UI, and never how you got there.
//
// Each pairs with a lesson in the mesh-engine course. MeshLab's challenges ask
// you to build something; these ask you to find something out, which is the
// difference between the two labs.

import type { Editor } from '../../../engines/mesh/core/Editor';
import { runScript } from '../../../engines/mesh/core/api';

export interface Check { label: string; ok: boolean; detail?: string }

export interface Challenge {
  id: string;
  title: string;
  icon: string;
  /** What to achieve, not how. */
  brief: string;
  /** The lesson this pairs with. */
  lesson: string;
  /** Builds the starting scene. */
  setup: string;
  select?: string;
  hints: string[];
  /** One way to do it, as a script. */
  solution: string;
  check(editor: Editor): Check[];
}

// ── helpers the checks use ────────────────────────────────────────────────
const meshOf = (e: Editor, name: string) => e.scene.get(name)?.mesh ?? null;
const edgesOf = (e: Editor, name: string) => {
  const m = meshOf(e, name);
  return m ? [...m.edges().values()] : [];
};
const boundary = (e: Editor, name: string) =>
  edgesOf(e, name).filter((x) => x.faces.length === 1).length;
const nonManifold = (e: Editor, name: string) =>
  edgesOf(e, name).filter((x) => x.faces.length > 2).length;
const euler = (e: Editor, name: string) => {
  const m = meshOf(e, name);
  return m ? m.verts.length - edgesOf(e, name).length + m.faces.length : NaN;
};

export const CHALLENGES: Challenge[] = [
  {
    id: 'weld-it',
    title: 'Make it a solid',
    icon: '⚙',
    lesson: 'Lesson 3 — Mesh Topology and Welding',
    brief: 'This cube arrived the way an STL does: twelve separate triangles that happen to touch. Make it one closed solid — 8 vertices, no boundary edges, Euler 2 — without changing its shape.',
    setup: `const V = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]
const F = [[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],
           [3,0,4],[3,4,7],[4,5,6],[4,6,7],[0,3,2],[0,2,1]]
const eV = [], eF = []
for (const f of F) {
  eF.push([eV.length, eV.length + 1, eV.length + 2])
  for (const i of f) eV.push([...V[i]])
}
scene.add.mesh({ verts: eV, faces: eF, name: 'Part' })`,
    select: 'Part',
    hints: [
      'Count first. The Inspector shows vertices, edges and faces — 36, 36 and 12 says nothing is shared.',
      'Welding merges vertices that sit at the same position. Mesh › Weld, or `weld(tolerance)` from the script panel.',
      'The tolerance only has to be bigger than floating-point noise. Lesson 3 measured a cube welding identically for every tolerance from 0 to 0.9, and being destroyed at 1.0.',
    ],
    solution: `scene.get('Part').mesh.weld(1e-6)
log('verts', scene.get('Part').mesh.verts.length)`,
    check(e) {
      const m = meshOf(e, 'Part');
      const v = m?.verts.length ?? -1;
      const b = boundary(e, 'Part');
      const f = m?.faces.length ?? -1;
      return [
        { label: '8 vertices', ok: v === 8, detail: v < 0 ? 'no mesh called "Part"' : `${v} now` },
        { label: '12 faces still — the shape did not change', ok: f === 12, detail: `${f} faces` },
        { label: 'no boundary edges', ok: b === 0, detail: `${b} boundary` },
        { label: 'Euler V − E + F = 2', ok: euler(e, 'Part') === 2, detail: `${euler(e, 'Part')}` },
        { label: 'no non-manifold edges', ok: nonManifold(e, 'Part') === 0 },
      ];
    },
  },

  {
    id: 'close-the-hole',
    title: 'Close the hole',
    icon: '◌',
    lesson: 'Lesson 3 — Mesh Topology and Welding',
    brief: 'Somewhere on this part a face is missing. Find it and close it, so the boundary edge count reaches 0 and Euler returns to 2. You will not find it by looking.',
    setup: `const ball = scene.addSphere({ radius: 1.4, segments: 20, rings: 10, name: 'Part' })
ball.mesh.delete({ faces: [37] })`,
    select: 'Part',
    hints: [
      'The Inspector reports boundary edges. Anything above 0 means a hole, and the count tells you how big it is.',
      'To find it: colour the surface by geodesic distance from the boundary vertices. The cold spot is the hole.',
      'In edit mode, select the boundary loop and press F to fill it. Or `fill([...verts])` from the script.',
    ],
    solution: `const m = scene.get('Part').mesh
const open = m.edges.filter((x) => x.faces.length === 1)
const ring = [...new Set(open.flatMap((x) => [x.a, x.b]))]
log('hole has', ring.length, 'vertices')
m.fill(ring)
log('boundary now', m.edges.filter((x) => x.faces.length === 1).length)`,
    check(e) {
      const b = boundary(e, 'Part');
      const m = meshOf(e, 'Part');
      return [
        { label: 'no boundary edges', ok: b === 0, detail: `${b} boundary` },
        { label: 'Euler V − E + F = 2', ok: euler(e, 'Part') === 2, detail: `${euler(e, 'Part')}` },
        { label: 'no non-manifold edges', ok: nonManifold(e, 'Part') === 0,
          detail: `${nonManifold(e, 'Part')} edges with 3+ faces` },
        // The sphere it builds has 200 faces; one is deleted and one is filled
        // back, so a solved part has 200. An earlier version asserted 399,
        // guessed from a different resolution, and made this unwinnable.
        { label: 'the part is still a sphere, not a patched-over mess',
          ok: (m?.faces.length ?? 0) >= 195, detail: `${m?.faces.length ?? 0} faces` },
      ];
    },
  },

  {
    id: 'flag-the-bump',
    title: 'Flag only the bump',
    icon: '⚖',
    lesson: 'Lesson 11 — Thresholds and Classification',
    brief: 'This part has one real bump and a lot of measurement noise. Show a heat map of the deviation, then pick a threshold that flags the bump and nothing else. There is more than one defensible answer — the check accepts any that separates them.',
    setup: `const part = scene.addSphere({ radius: 1.5, segments: 32, rings: 16, name: 'Part' })
log('Deviation for each vertex, in inches:')
log('  bump  = 0.005 * exp(-3 * ((x - 1.5)^2 + y^2))')
log('  noise = 0.0005 * (random - 0.5)')
log('')
log('Show it as a heat map, then choose a threshold and say how many it flags.')`,
    select: 'Part',
    hints: [
      'Build the deviation array the brief describes, then `showField(dev, { label: "deviation (in)" })`.',
      'The noise is about 0.00025 either side of zero. The bump peaks at 0.005. Any threshold comfortably between them separates the two populations.',
      'Lesson 11: state what a miss costs against a false alarm and the threshold follows. Here the two populations barely overlap, so the band is wide — which is not always true.',
    ],
    solution: `const part = scene.get('Part')
let seed = 7
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const dev = part.mesh.verts.map((v) => {
  const p = v.toArray()
  return 0.005 * Math.exp(-3 * ((p[0] - 1.5) ** 2 + p[1] ** 2)) + 0.0005 * (rand() - 0.5)
})
part.mesh.showField(dev, { label: 'deviation (in)' })
const t = 0.002
log('threshold', t, 'flags', dev.filter((d) => d > t).length, 'of', dev.length)`,
    check(e) {
      // editor.field is a FieldView: { objectId, spec, mesh, result }. The
      // numbers are in result.values - an earlier version read f.values and
      // f.label, found nothing, and made this challenge unwinnable.
      const f = e.field;
      const vals = f ? Array.from(f.result.values) : [];
      const spread = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
      const part = e.scene.get('Part');
      const nVerts = part?.mesh?.verts.length ?? 0;
      return [
        { label: 'a heat map is showing', ok: !!f,
          detail: f ? f.result.label : 'none' },
        { label: 'it is your own per-vertex deviation, not a built-in field',
          ok: f?.spec.kind === 'custom',
          detail: f ? `kind "${f.spec.kind}"` : 'no field' },
        { label: 'one value per vertex',
          ok: vals.length > 0 && vals.length === nVerts,
          detail: `${vals.length} values for ${nVerts} vertices` },
        { label: 'the range looks like inches of deviation',
          ok: spread > 1e-4 && spread < 0.1,
          detail: vals.length ? `range ${spread.toExponential(2)}` : 'nothing to measure' },
        { label: 'it is on the part, not on something else',
          ok: !!f && !!part && f.objectId === part.id,
          detail: f ? 'shown on an object' : 'no field' },
      ];
    },
  },

  {
    id: 'split-no-crack',
    title: 'Split it without cracking it',
    icon: '✄',
    lesson: 'Lesson 16B — Face Splitting and the Index Invariant',
    brief: 'Give this closed cube more than 12 faces — at least 48 — while keeping it a closed solid. Boundary edges must stay at 0 and Euler at 2. Splitting one face on its own will not do it.',
    setup: `const V = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]
const F = [[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],
           [3,0,4],[3,4,7],[4,5,6],[4,6,7],[0,3,2],[0,2,1]]
scene.add.mesh({ verts: V, faces: F, name: 'Part' })`,
    select: 'Part',
    hints: [
      'Try splitting a single face first, and watch the boundary count go from 0 to 3. That is the failure this challenge is about.',
      'The crack appears because the neighbours across those edges were never told about the new vertex — a T-junction.',
      'Splitting every face at once avoids it: each shared edge gains the same vertex from both sides, so nothing is left with a neighbour that disagrees.',
    ],
    solution: `const m = scene.get('Part').mesh
m.split()          // every face, so every shared edge is split from both sides
m.split()
log('faces', m.faces.length, ' boundary', m.edges.filter((x) => x.faces.length === 1).length)`,
    check(e) {
      const m = meshOf(e, 'Part');
      const faces = m?.faces.length ?? -1;
      const b = boundary(e, 'Part');
      return [
        { label: 'at least 48 faces', ok: faces >= 48, detail: `${faces} faces` },
        { label: 'still closed: no boundary edges', ok: b === 0, detail: `${b} boundary` },
        { label: 'Euler V − E + F = 2', ok: euler(e, 'Part') === 2, detail: `${euler(e, 'Part')}` },
        { label: 'no non-manifold edges', ok: nonManifold(e, 'Part') === 0 },
      ];
    },
  },
];

export function startChallenge(editor: Editor, c: Challenge): string | null {
  editor.newScene();
  editor.field = null; editor.playing = false;
  const cube = editor.scene.get('Cube');
  if (cube) editor.scene.remove(cube.id);
  editor.selected.clear(); editor.active = null;
  const r = runScript(editor, c.setup, `Start challenge: ${c.title}`);
  if (r.error) return r.error;
  // The starting point is not something to undo or to replay as the learner's work.
  editor.undoStack = []; editor.redoStack = []; editor.log = [];
  if (c.select) { const o = editor.scene.get(c.select); if (o) editor.selectObject(o.id); }
  editor.message = `Challenge: ${c.title}`;
  editor.emit('select');
  return null;
}
