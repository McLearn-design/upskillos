import { beforeAll, describe, expect, it } from 'vitest';
import { loadPyodide } from 'pyodide';
import { Editor } from './Editor';
import { PROJECTS, PROJECT_GROUPS, openProject } from './projects';
import { sampleKeys } from './animation';
import type { PyodideLike } from './python';

let py: PyodideLike;
beforeAll(async () => { py = (await loadPyodide()) as unknown as PyodideLike; }, 60000);

describe('example projects', () => {
  it('have unique ids, known groups and a guide', () => {
    expect(new Set(PROJECTS.map((p) => p.id)).size).toBe(PROJECTS.length);
    for (const p of PROJECTS) { expect(PROJECT_GROUPS).toContain(p.group); expect(p.guide.length).toBeGreaterThanOrEqual(3); }
  });

  for (const p of PROJECTS) {
    it(`"${p.title}" builds without errors and its setup points at real things`, () => {
      const e = new Editor();
      const r = openProject(e, p, py);
      expect(r.error, r.output.join('\n')).toBeNull();
      if (p.setup.select) expect(e.activeObject?.name).toBe(p.setup.select);
      expect(e.scene.get('Cube')).toBeUndefined();
      expect(e.undoStack.length).toBe(1); // one undo step takes the whole build back
      for (const o of e.scene.objects) if (o.mesh) expect(o.mesh.validate()).toEqual([]);
    });
  }
});

describe('what the projects claim', () => {
  const open = (id: string) => { const e = new Editor(); const r = openProject(e, PROJECTS.find((p) => p.id === id)!, py); return { e, r }; };

  it('the bouncing ball follows the gravity parabola exactly between keys', () => {
    const { e } = open('bouncing-ball');
    const keys = e.scene.get('Ball')!.anim!.position!;
    // The first fall: from the top key (rest) to the first bounce, y = top − (top − y₁)·t², t the fraction of the time.
    const [k0, k1] = keys;
    for (let f = k0.frame + 1; f < k1.frame; f++) {
      const t = (f - k0.frame) / (k1.frame - k0.frame);
      expect(sampleKeys(keys, f).value[1]).toBeCloseTo(k0.value[1] - (k0.value[1] - k1.value[1]) * t * t, 12);
    }
    // Falling 3 m under g = 9.8 takes √(2·3/9.8) s = 0.78 s = 19 frames at 24 fps.
    expect(k1.frame - k0.frame).toBe(19);
  });

  it('the curvature gallery prints Gauss–Bonnet: 4π for the sphere, 0 for the torus', () => {
    const { r } = open('curvature-gallery');
    expect(r.output.find((l) => l.startsWith('Sphere'))).toMatch(/Σ K·area = 4\.000000π\s+χ = 2/);
    expect(r.output.find((l) => l.startsWith('Torus'))).toMatch(/= -?0\.000000π\s+χ = 0/);
  });

  it('smoothing flattens the curvature spread and shrinks the volume', () => {
    const { r } = open('smoothing');
    const parse = (name: string) => { const m = r.output.find((l) => l.startsWith(name))!.match(/volume ([\d.]+) .* ± ([\d.]+)/)!; return { vol: +m[1], spread: +m[2] }; };
    const a = parse('Bumpy'), b = parse('Smoothed ×5'), c = parse('Smoothed ×40');
    expect(b.spread).toBeLessThan(a.spread / 3);
    expect(c.vol).toBeLessThan(b.vol); expect(b.vol).toBeLessThan(a.vol);
  });

  it('the knot is one closed tube and shows distance from vertex 0', () => {
    const { e } = open('knot-distance');
    expect(e.field?.spec).toEqual({ kind: 'geodesic', sources: [0] });
    expect(e.scene.get('Trefoil')!.mesh!.stats().closed).toBe(true);
    expect(e.trace?.op).toBe('Heat method');
  });

  it('the candy wrapper: at the full twist the linear tube pinches, the dual-quaternion one stays round', async () => {
    const { skinnedSource } = await import('./evaluate');
    const { e } = open('candy-wrapper');
    e.setFrame(36);
    const mid = (name: string) => {
      const o = e.scene.get(name)!, v = skinnedSource(e.scene, o).verts;
      return Array.from({ length: 16 }, (_, j) => 8 * 16 + j).reduce((s, i) => s + Math.hypot(v[i][0], v[i][2]), 0) / 16;
    };
    expect(mid('Linear blend')).toBeLessThan(0.5 * 0.25);
    expect(mid('Dual quaternion')).toBeGreaterThan(0.9 * 0.25);
    for (const n of ['Linear blend', 'Dual quaternion']) { const s = e.scene.get(n)!.mesh!.stats(); expect(s.closed).toBe(true); expect(s.volume).toBeGreaterThan(0); }
  });

  it('fix a bad rig: opens painting the spine, and painting the chest stops the arm dragging it', async () => {
    const { skinnedSource, skinSource } = await import('./evaluate');
    const { e } = open('fix-a-bad-rig');
    expect(e.mode).toBe('weight'); expect(e.activeBone).toBe('Spine'); expect(e.frame).toBe(24);
    const body = () => e.scene.get('Character')!;
    const src = skinSource(body()).verts;
    const chest = src.map((v, i) => [v, i] as const).filter(([v]) => v[0] > 0.2 && v[0] < 0.65 && v[1] > 0.8 && v[1] < 1.25).map(([, i]) => i);
    const drift = () => { const p = skinnedSource(e.scene, body()).verts; return chest.reduce((s, i) => s + Math.hypot(p[i][0] - src[i][0], p[i][1] - src[i][1], p[i][2] - src[i][2]), 0) / chest.length; };
    const before = drift();
    const pos = skinnedSource(e.scene, body()).verts;
    e.paint = { ...e.paint, brush: 'draw', value: 1, strength: 0.8, radius: 0.35 };
    e.beginStroke(); for (const i of chest) e.strokeDab(pos[i]); e.endStroke();
    expect(drift()).toBeLessThan(before * 0.5); // the chest stays nearly where it rests
  });

  it('the tentacle: rolling a bone 90° turns its bending plane from forward to sideways', async () => {
    const { posedEnds } = await import('./armature');
    const { e } = open('tentacle');
    e.setFrame(13);                                   // Seg 1 at a full swing
    const tip = () => posedEnds(e.scene.get('Tentacle rig')!.bones!).get('Seg 1')!.tail;
    const a = tip();
    expect(Math.abs(a[2])).toBeGreaterThan(0.2); expect(Math.abs(a[0])).toBeLessThan(1e-9);   // swings in z
    e.enterBoneEdit(); e.setBone('Seg 1', { roll: Math.PI / 2 }); e.exitBoneEdit();
    e.setFrame(13);
    const b = tip();
    expect(Math.abs(b[0])).toBeCloseTo(Math.abs(a[2]), 9); expect(Math.abs(b[2])).toBeLessThan(1e-9); // same swing, now in x
  });

  it('the robot gripper moves only because its parents turn', () => {
    const { e } = open('robot-arm');
    const g = e.scene.get('Gripper')!;
    expect(g.anim).toBeUndefined();
    const at = (f: number) => e.scene.worldMatrixAt(g, f).elements.slice(12, 15);
    expect(Math.hypot(...at(1).map((x, i) => x - at(45)[i]))).toBeGreaterThan(1);
    // The block is carried: at the gripper while held, left where it was let go.
    const b = e.scene.get('Block')!;
    const bAt = (f: number) => e.scene.worldMatrixAt(b, f).elements.slice(12, 15);
    for (const f of [45, 60, 75, 90, 105]) expect(Math.hypot(...bAt(f).map((x, i) => x - at(f)[i]))).toBeLessThan(1e-9);
    expect(bAt(120)).toEqual(bAt(105));
    expect(Math.hypot(...bAt(105).map((x, i) => x - bAt(45)[i]))).toBeGreaterThan(1);
  });
});

describe('bone edit mode shows the rest pose', () => {
  it('while the tentacle rig is edited the tentacle is straight; leaving puts the pose back', async () => {
    const { skinnedSource, skinSource } = await import('./evaluate');
    const e = new Editor();
    openProject(e, PROJECTS.find((p) => p.id === 'tentacle')!, py);
    e.setFrame(13);
    const t = () => e.scene.get('Tentacle')!;
    const moved = () => { const a = skinnedSource(e.scene, t()).verts, b = skinSource(t()).verts; return Math.max(...a.map((v, i) => Math.hypot(v[0] - b[i][0], v[1] - b[i][1], v[2] - b[i][2]))); };
    expect(moved()).toBeGreaterThan(0.3);
    e.enterBoneEdit();
    expect(moved()).toBe(0);
    e.exitBoneEdit();
    expect(moved()).toBeGreaterThan(0.3);
  });
});

describe('UV and material projects', () => {
  const open = (id: string) => { const e = new Editor(); const r = openProject(e, PROJECTS.find((p) => p.id === id)!, py); return { e, r }; };

  it('unwrap basics: the cube has no distortion, the sphere keeps angles well but not areas', () => {
    const { r } = open('unwrap-basics');
    expect(r.output[0]).toBe('cube: worst angle distortion 1.0000');
    expect(Number(r.output[1].split(' ').at(-1))).toBeLessThan(1.25);
    expect(Number(r.output[2].match(/varies ([\d.]+)×/)![1])).toBeGreaterThan(3);
  });

  it('the vase gets a band and a disc, with little angle distortion', async () => {
    const { uvFits, charts } = await import('./uv');
    const { e, r } = open('python-vase');
    const v = e.scene.get('Vase')!;
    expect(uvFits(v.mesh!, v.uv)).toBe(true);
    expect(charts(v.mesh!, new Set(v.seams)).length).toBe(2);
    expect(Number(r.output.at(-1)!.match(/mean ([\d.]+)/)![1])).toBeLessThan(1.2);
  });

  it('the shader gallery has one sphere per model, all unwrapped, and the custom GLSL set', async () => {
    const { uvFits } = await import('./uv');
    const { e } = open('shader-gallery');
    const want = { PBR: 'pbr', Lambert: 'lambert', 'Blinn–Phong 10': 'blinn-phong', 'Blinn–Phong 120': 'blinn-phong', Toon: 'toon', Normals: 'normals', UV: 'uv', Custom: 'custom' };
    for (const [n, m] of Object.entries(want)) { const o = e.scene.get(n)!; expect(o.material.shader).toBe(m); expect(uvFits(o.mesh!, o.uv)).toBe(true); }
    expect(e.scene.get('Blinn–Phong 120')!.material.shininess).toBe(120);
    expect(e.scene.get('Custom')!.material.glsl).toMatch(/^float d = max/);
  });

  it('the dining set is wood-grained: every part unwrapped with the wood texture', async () => {
    const { uvFits } = await import('./uv');
    const { e } = open('dining-set');
    const parts = e.scene.objects.filter((o) => o.mesh);
    expect(parts.length).toBeGreaterThan(20);
    for (const o of parts) { expect(o.material.texture).toBe('wood'); expect(uvFits(o.mesh!, o.uv)).toBe(true); }
  });
});

describe('hard-surface projects', () => {
  const open = (id: string) => { const e = new Editor(); const r = openProject(e, PROJECTS.find((p) => p.id === id)!, py); return { e, r }; };

  it('the crate is closed, bevelled, panelled and fully unwrapped', async () => {
    const { uvFits, angleDistortion } = await import('./uv');
    const { e } = open('crate');
    const c = e.scene.get('Crate')!, s = c.mesh!.stats();
    expect(s.closed).toBe(true); expect(s.euler).toBe(2);
    expect(s.volume).toBeLessThan(1.6 ** 3); expect(s.volume).toBeGreaterThan(0.85 * 1.6 ** 3); // six 5 cm recesses and the bevels take about 11%
    expect(uvFits(c.mesh!, c.uv)).toBe(true);
    const d = angleDistortion(c.mesh!, c.uv!);
    expect(d.reduce((a, b) => a + b, 0) / d.length).toBeLessThan(1.1);
  });

  it('support loops: the more support near the edges, the closer the subdivided volume stays to the box', () => {
    const { r } = open('support-loops');
    const pct = (name: string) => Number(r.output.find((l) => l.startsWith(name))!.match(/\((\d+)%\)/)![1]);
    const a = pct('No support loops'), b = pct('Bevelled edges'), c = pct('Support loops');
    expect(a).toBeLessThan(b); expect(b).toBeLessThan(c); expect(c).toBeGreaterThan(90); expect(a).toBeLessThan(80);
  });
});

import { readFileSync, readdirSync } from 'fs';
import { CHALLENGES } from './challenges';

describe('guides name things that exist', () => {
  it('every "Menu › Item" in a guide or hint is a real menu item; every other "A › B" is text in the interface', () => {
    const dir = new URL('..', import.meta.url).pathname;
    const meshlab = readFileSync(dir + 'MeshLab.tsx', 'utf8');
    const ui = meshlab + readdirSync(dir + 'ui').map((f) => readFileSync(dir + 'ui/' + f, 'utf8')).join('\n');
    // The menus: `Name: [ ... ],` or `'Name': [ ... ],` inside the menus object, with their item labels.
    const block = meshlab.slice(meshlab.indexOf('const menus'), meshlab.indexOf('const stats'));
    const menus = new Map<string, string>();
    const keys = [...block.matchAll(/\n {4}'?([A-Z][A-Za-z ]+)'?: \[/g)];
    keys.forEach((k, i) => menus.set(k[1], block.slice(k.index!, keys[i + 1]?.index ?? block.length)));
    expect([...menus.keys()]).toEqual(expect.arrayContaining(['File', 'Mesh', 'UV', 'Heat map', 'Object']));
    const stale = (texts: string[]) => {
      const refs = texts.flatMap((t) => [...t.matchAll(/([A-Z][A-Za-z]+(?: [a-z]+)?) › ([A-Z][^.,:;()"]*?)(?=[.,:;()"]|$| (?:and|then|or|on|with|to|in)\b)/g)].map((m) => [m[1], m[2].trim()] as const));
      const bad: string[] = [];
      for (const [a, b] of refs) {
        const lead = b.split(' ').slice(0, 2).join(' ');
        if (menus.has(a)) { if (!menus.get(a)!.includes(lead)) bad.push(`${a} › ${b} (no such item in the ${a} menu)`); }
        else if (!ui.includes(lead)) bad.push(`${a} › ${b} (no such text in the interface)`);
      }
      return { refs, bad };
    };
    // The check itself catches a made-up item and a made-up panel.
    expect(stale(['Use Heat map › Banana split here.', 'See Frobnicator panel › Zork.']).bad.length).toBe(2);
    const { refs, bad } = stale([...PROJECTS.flatMap((p) => [...p.guide, p.desc]), ...CHALLENGES.flatMap((c) => [...c.hints, c.brief])]);
    expect(refs.length).toBeGreaterThan(10);
    expect(bad).toEqual([]);
  });
});

describe('the walk cycle', () => {
  it('loops, dips after each contact, and moves forward at a steady speed', () => {
    const e = new Editor();
    expect(openProject(e, PROJECTS.find((p) => p.id === 'walk-cycle')!).error).toBeNull();
    const rig = () => e.scene.get('Rig')!;
    const pose = (f: number) => { e.setFrame(f); return rig().bones!.map((b) => b.pose.map((x) => +x.toFixed(9))); };
    expect(pose(25)).toEqual(pose(1));                  // one cycle later, the same pose
    expect(pose(49)).toEqual(pose(1));
    const at = (f: number) => { e.setFrame(f); return [...rig().position]; };
    expect(at(4)[1]).toBeLessThan(at(1)[1]); expect(at(10)[1]).toBeGreaterThan(at(1)[1]); // down, then up
    // Steady forward speed: the same distance every 6 frames.
    const z = [1, 7, 13, 19, 25, 31].map((f) => at(f)[2]);
    const steps = z.slice(1).map((v, i) => v - z[i]);
    for (const d of steps) expect(d).toBeCloseTo(steps[0], 9);
  });

  it('the island is grass on planar UVs', async () => {
    const { uvFits } = await import('./uv');
    const e = new Editor(); openProject(e, PROJECTS.find((p) => p.id === 'island')!);
    const land = e.scene.get('Island')!;
    expect(land.material.texture).toBe('grass'); expect(uvFits(land.mesh!, land.uv)).toBe(true);
  });
});
