import { describe, expect, it } from 'vitest';
import { GROUND, SKY, hexToLinear, shadePoint, toLinear, toSRGB } from './shadingTrace';
import { Trace } from './trace';
import type { Vec3 } from './EditMesh';

const base = { P: [0, 0, 0] as Vec3, light: [1, 1, 1] as [number, number, number], base: [0.5, 0.25, 0.1] as [number, number, number] };

describe('shading one point', () => {
  it('sRGB and linear are inverses; #ffffff is 1', () => {
    for (const c of [0, 0.02, 0.2, 0.5, 1]) expect(toSRGB(toLinear(c))).toBeCloseTo(c, 3);
    expect(hexToLinear('#ffffff')).toEqual([1, 1, 1]);
  });

  it('Lambert: the cosine law, plus a sky-and-ground ambient', () => {
    const t = new Trace('Trace the shading');
    // Light 60° from the normal: d = cos 60° = 0.5. N straight up: ambient is all sky.
    const r = shadePoint({ ...base, model: 'lambert', N: [0, 1, 0], L: [Math.sin(Math.PI / 3), Math.cos(Math.PI / 3), 0], eye: [0, 5, 5] }, t);
    expect(r.terms['N·L']).toBeCloseTo(0.5, 12);
    r.color.forEach((c, k) => expect(c).toBeCloseTo(base.base[k] * (SKY[k] + 0.5), 12));
    expect(t.steps.map((s) => s.phase)).toEqual(['Vectors', 'Ambient', 'Cosine law', 'Colour', 'Result']);
    expect(t.steps[2].quiz!.answer[0]).toBeCloseTo(0.5, 12);
    // Facing away: no sun at all. N straight down: ambient is all ground.
    const away = shadePoint({ ...base, model: 'lambert', N: [0, -1, 0], L: [0, 1, 0], eye: [0, 5, 5] });
    away.color.forEach((c, k) => expect(c).toBeCloseTo(base.base[k] * GROUND[k], 12));
  });

  it('Blinn–Phong: the highlight is 1 when N is halfway between L and V, and falls with the shininess', () => {
    const r = shadePoint({ ...base, model: 'blinn-phong', N: [0, 1, 0], L: [1, 1, 0], eye: [-5, 5, 0], shininess: 40, specular: 0.5 });
    expect(r.terms['N·H']).toBeCloseTo(1, 12);
    expect(r.terms.s).toBeCloseTo(1, 12);
    const off = shadePoint({ ...base, model: 'blinn-phong', N: [0, 1, 0], L: [1, 1, 0], eye: [0, 5, 5], shininess: 40 });
    expect(off.terms.s).toBeCloseTo(Math.pow(off.terms['N·H'], 40), 12);
    expect(off.terms.s).toBeLessThan(0.1);
  });

  it('toon bands, the normals view, and PBR\'s Fresnel at normal incidence', () => {
    const toon = shadePoint({ ...base, model: 'toon', N: [0, 1, 0], L: [Math.sin(1), Math.cos(1), 0], eye: [0, 5, 5], bands: 3 });
    expect(toon.terms.band).toBeCloseTo(Math.floor(Math.cos(1) * 3) / 3, 12);
    expect(shadePoint({ ...base, model: 'normals', N: [1, 0, 0], L: [0, 1, 0], eye: [0, 0, 5] }).color).toEqual([1, 0.5, 0.5]);
    // Looking straight down the normal, with the light behind the eye: V = H, so F = F₀ = 0.04 for a non-metal.
    const pbr = shadePoint({ ...base, model: 'pbr', N: [0, 1, 0], L: [0, 1, 0], eye: [0, 5, 0], roughness: 0.5, metalness: 0 });
    expect(pbr.terms.F).toBeCloseTo(0.04, 9);
    expect(pbr.terms['V·H']).toBeCloseTo(1, 12);
  });
});
