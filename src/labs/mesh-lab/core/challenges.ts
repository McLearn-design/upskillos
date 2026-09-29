// Guided challenges: a starting scene, a goal, and a checklist the app keeps
// checking while you work. Unlike an example project, nothing tells you the steps;
// hints unlock one at a time, and a worked solution is there as a script.
//
// A check is a pure function of the scene, so the same code grades a learner in
// the app and proves in the tests that the starting scene does not pass and the
// solution does.

import type { Editor } from './Editor';
import { runScript } from './api';
import { sampleKeys } from './animation';
import { charts, uvFits, angleDistortion } from './uv';
import { evaluatedMesh, skinSource } from './evaluate';
import { EXAMPLES } from './examples';
import { fmt } from './trace';

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
];

/** Build a challenge's starting scene on a new scene (the default cube removed, the sun kept). */
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
