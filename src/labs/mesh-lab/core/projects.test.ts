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
