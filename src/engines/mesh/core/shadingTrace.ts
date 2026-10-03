// Shading one point (Mesh › Trace the shading): the colour the fragment shader computes, worked out in the same
// steps. The inputs are those of shade(N, L, V, uv, base, light) in shading.ts: the unit normal N, the direction to
// the sun L, the direction to the eye V, the material colour and the light colour, all in linear RGB. For Lambert,
// Blinn–Phong, toon and the two debug views this is the shader's own arithmetic, so the result is the pixel's
// colour (before the screen's sRGB encoding, which the last step applies). For PBR it is the textbook Cook–Torrance
// model with GGX, Smith and Schlick terms; three.js's own version adds environment light and its own scaling.

import type { Vec3 } from './EditMesh';
import type { ShaderModel } from './shading';
import { Trace, fmt, fmtV } from './trace';

export type RGB = [number, number, number];

/** sRGB (0–1) to linear, and back: the conversions three.js applies to colours and to the final pixel. */
export const toLinear = (c: number) => (c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4));
export const toSRGB = (c: number) => (c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055);
export function hexToLinear(hex: string): RGB {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => toLinear(x / 255)) as RGB;
}
/** The hemisphere ambient light every MeshLab shader model uses: ground colour below, sky colour above. */
export const SKY = hexToLinear('#dfe6f5').map((x) => x * 0.32) as RGB;
export const GROUND = hexToLinear('#2a2622').map((x) => x * 0.32) as RGB;

export interface ShadeInput {
  model: ShaderModel; P: Vec3; N: Vec3; eye: Vec3; L: Vec3; light: RGB; base: RGB;
  uv?: [number, number] | null; shininess?: number; specular?: number; bands?: number; roughness?: number; metalness?: number;
}
export interface ShadeResult { color: RGB; srgb: [number, number, number]; terms: Record<string, number> }

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const add = (a: RGB, b: RGB): RGB => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: RGB, b: RGB): RGB => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
const scale = (a: RGB, s: number): RGB => [a[0] * s, a[1] * s, a[2] * s];
const rgb = (c: RGB) => `(${c.map((x) => fmt(x, 3)).join(', ')})`;
const offset = (P: Vec3, d: Vec3, k: number): Vec3 => [P[0] + d[0] * k, P[1] + d[1] * k, P[2] + d[2] * k];

/** `draw` maps a world point to where the trace overlay draws it (the object's own space). */
export function shadePoint(inp: ShadeInput, trace?: Trace, { arrowLength = 0.6, draw = (p: Vec3) => p }: { arrowLength?: number; draw?: (p: Vec3) => Vec3 } = {}): ShadeResult {
  const { model, P: Pw, base, light } = inp;
  const P = draw(Pw);
  const N = norm(inp.N), L = norm(inp.L), V = norm([inp.eye[0] - Pw[0], inp.eye[1] - Pw[1], inp.eye[2] - Pw[2]]);
  const along = (_: Vec3, d: Vec3, k: number) => draw(offset(Pw, d, k));
  const NL = dot(N, L), NV = dot(N, V), d = Math.max(NL, 0);
  const t = N[1] * 0.5 + 0.5, ambient: RGB = [GROUND[0] + (SKY[0] - GROUND[0]) * t, GROUND[1] + (SKY[1] - GROUND[1]) * t, GROUND[2] + (SKY[2] - GROUND[2]) * t];
  const terms: Record<string, number> = { 'N·L': NL, 'N·V': NV };
  const arrows = [
    { from: P, to: along(P, N, arrowLength), label: 'N', color: '#60a5fa' },
    { from: P, to: along(P, L, arrowLength), label: 'L', color: '#facc15' },
    { from: P, to: along(P, V, arrowLength), label: 'V', color: '#34d399' },
  ];
  trace?.step({
    phase: 'Vectors', label: `N = ${fmtV(N)}, L = ${fmtV(L)}, V = ${fmtV(V)}`,
    detail: 'Three unit vectors at the point: N the surface normal, L towards the light (the sun is so far away that L is the same everywhere), V towards the eye. Every shading model is built from their dot products.',
    points: [{ p: P, color: '#f8fafc' }], arrows, values: [['N·L', fmt(NL, 4)], ['N·V', fmt(NV, 4)]],
  });
  if (model !== 'normals' && model !== 'uv' && model !== 'custom') trace?.step({
    phase: 'Ambient', label: `Ambient light ${rgb(ambient)}: ${Math.round(100 * t)}% sky, ${100 - Math.round(100 * t)}% ground`,
    detail: 'Light that comes from everywhere: the sky above and the ground below, blended by how far N points up (N.y ½ + ½). Without it, everything facing away from the sun would be black.',
    arrows: [arrows[0]],
  });
  let color: RGB;
  if (model === 'lambert' || model === 'blinn-phong' || model === 'toon') {
    trace?.step({
      phase: 'Cosine law', label: `d = max(N·L, 0) = ${fmt(d, 4)}`,
      detail: 'A beam of light spreads over more surface the more slanted the surface is to it: the light per unit area falls with the cosine of the angle between N and L. Facing away (N·L < 0), the sun adds nothing.',
      arrows: [arrows[0], arrows[1]],
      ...(model === 'lambert' ? { quiz: { prompt: `N = ${fmtV(N, 4)} and L = ${fmtV(L, 4)}. What is d = max(N·L, 0)?`, answer: [d], labels: ['d'], rule: 'N·L = NₓLₓ + N_yL_y + N_zL_z, then 0 if negative.', tolerance: 0.005 } } : {}),
    });
  }
  if (model === 'lambert') {
    color = mul(base, add(ambient, scale(light, d)));
    trace?.step({ phase: 'Colour', label: `base · (ambient + d · light) = ${rgb(color)}`, detail: 'The surface reflects its own colour of whatever light arrives: the ambient light, plus the sun weakened by the cosine law.' });
  } else if (model === 'blinn-phong') {
    const H = norm([L[0] + V[0], L[1] + V[1], L[2] + V[2]]), NH = Math.max(dot(N, H), 0), sh = inp.shininess ?? 40, sp = inp.specular ?? 0.5;
    const s = d > 0 ? Math.pow(NH, sh) : 0;
    terms['N·H'] = NH; terms.s = s;
    trace?.step({
      phase: 'Half vector', label: `H = normalize(L + V) = ${fmtV(H)}; N·H = ${fmt(NH, 4)}`,
      detail: 'A mirror would send the light straight to the eye if N pointed exactly halfway between L and V. H is that halfway direction; N·H measures how close the surface comes to it.',
      arrows: [arrows[0], arrows[1], arrows[2], { from: P, to: along(P, H, arrowLength), label: 'H', color: '#f472b6' }],
    });
    trace?.step({
      phase: 'Highlight', label: `s = (N·H)^${fmt(sh)} = ${fmt(s, 4)}`,
      detail: 'Raising N·H to a high power keeps only directions very close to H: the bigger the shininess, the smaller and sharper the highlight. The highlight is added in the light\'s colour, scaled by the material\'s specular strength.',
      quiz: { prompt: `N·H = ${fmt(NH, 4)} and the shininess is ${fmt(sh)}. What is the highlight s = (N·H)^shininess?`, answer: [s], labels: ['s'], rule: 'Raise N·H to the shininess: the result falls off very fast as N·H drops below 1.', tolerance: Math.max(0.002, 0.01 * s) },
    });
    color = add(mul(base, add(ambient, scale(light, d))), scale(light, s * sp));
    trace?.step({ phase: 'Colour', label: `base · (ambient + d · light) + s · light · ${fmt(sp, 3)} = ${rgb(color)}`, detail: 'The Lambert part in the surface\'s colour, plus a highlight in the light\'s colour.' });
  } else if (model === 'toon') {
    const bands = inp.bands ?? 3, q = Math.floor(d * bands) / bands, rim = Math.pow(1 - Math.max(NV, 0), 4);
    terms.band = q; terms.rim = rim;
    trace?.step({
      phase: 'Bands', label: `floor(d · ${bands}) / ${bands} = floor(${fmt(d * bands, 3)}) / ${bands} = ${fmt(q, 4)}`,
      detail: 'Cartoon shading rounds the cosine down to one of a few levels, so the light changes in flat steps instead of smoothly.',
      quiz: { prompt: `d = ${fmt(d, 4)} and there are ${bands} bands. What is floor(d · ${bands}) / ${bands}?`, answer: [q], labels: ['band'], rule: 'Multiply by the number of bands, round down, divide back.', tolerance: 0.001 },
    });
    trace?.step({ phase: 'Rim', label: `rim = (1 − N·V)⁴ = ${fmt(rim, 4)}`, detail: 'Where the surface turns away from the eye (N·V near 0, the silhouette), a rim light is added: an outline glow typical of cartoons.', arrows: [arrows[0], arrows[2]] });
    color = add(mul(base, add(ambient, scale(light, q))), scale(light, rim * 0.35));
    trace?.step({ phase: 'Colour', label: `base · (ambient + band · light) + rim · 0.35 · light = ${rgb(color)}`, detail: 'Lambert with the cosine replaced by its band, plus the rim.' });
  } else if (model === 'pbr') {
    const rough = Math.max(0.05, inp.roughness ?? 0.5), metal = inp.metalness ?? 0, a = rough * rough, a2 = a * a;
    const H = norm([L[0] + V[0], L[1] + V[1], L[2] + V[2]]), NH = Math.max(dot(N, H), 0), VH = Math.max(dot(V, H), 0), nl = Math.max(NL, 1e-4), nv = Math.max(NV, 1e-4);
    const D = a2 / (Math.PI * ((NH * NH) * (a2 - 1) + 1) ** 2);
    const F0: RGB = [0.04 + (base[0] - 0.04) * metal, 0.04 + (base[1] - 0.04) * metal, 0.04 + (base[2] - 0.04) * metal];
    const f = Math.pow(1 - VH, 5), F: RGB = [F0[0] + (1 - F0[0]) * f, F0[1] + (1 - F0[1]) * f, F0[2] + (1 - F0[2]) * f];
    const gv = nl * Math.sqrt(nv * nv * (1 - a2) + a2), gl = nv * Math.sqrt(nl * nl * (1 - a2) + a2), Vis = 0.5 / (gv + gl);
    const spec: RGB = scale(F, D * Vis), kd = 1 - metal;
    const diffuse: RGB = [(1 - F[0]) * kd * base[0] / Math.PI, (1 - F[1]) * kd * base[1] / Math.PI, (1 - F[2]) * kd * base[2] / Math.PI];
    color = add(mul(base, ambient), scale(mul(add(diffuse, spec), light), Math.PI * d));
    Object.assign(terms, { D, F: F[1], Vis, 'N·H': NH, 'V·H': VH });
    trace?.step({
      phase: 'Microfacets (D)', label: `GGX: α = roughness² = ${fmt(a, 4)}; D = α² / (π((N·H)²(α² − 1) + 1)²) = ${fmt(D, 4)}`,
      detail: 'A rough surface is a field of tiny mirrors (microfacets) pointing every which way. D is how many of them point along H, so that they reflect the light to the eye. Smooth surfaces have them all near N: a tall narrow peak, a small bright highlight. Rough ones spread out.',
      arrows: [arrows[0], { from: P, to: along(P, H, arrowLength), label: 'H', color: '#f472b6' }], values: [['roughness', fmt(rough, 3)], ['N·H', fmt(NH, 4)]],
    });
    trace?.step({
      phase: 'Fresnel (F)', label: `Schlick: F = F₀ + (1 − F₀)(1 − V·H)⁵ = ${fmt(F[1], 4)} (green channel; F₀ = ${fmt(F0[1], 3)})`,
      detail: 'Every surface reflects more at grazing angles (look along a table top and it shines). F₀ is the reflectance head-on: about 0.04 for non-metals, the metal\'s own colour for metals. Schlick\'s formula raises it towards 1 as V·H falls.',
      quiz: { prompt: `F₀ = ${fmt(F0[1], 4)} and V·H = ${fmt(VH, 4)}. What is F = F₀ + (1 − F₀)(1 − V·H)⁵?`, answer: [F[1]], labels: ['F'], rule: 'Schlick\'s approximation: (1 − V·H)⁵ grows quickly as the angle becomes grazing.', tolerance: Math.max(0.002, 0.01 * F[1]) },
    });
    trace?.step({
      phase: 'Shadowing (G)', label: `Smith (height-correlated): visibility V = ${fmt(Vis, 4)}`,
      detail: 'Some microfacets are hidden from the light or from the eye by their neighbours, more so at grazing angles. The Smith term removes that light; combined with the 1/(4 (N·L)(N·V)) of the Cook–Torrance formula it is this visibility factor.',
    });
    trace?.step({
      phase: 'Energy', label: `specular D·F·V = ${fmt(spec[1], 4)}, diffuse (1 − F)(1 − metalness)·base/π = ${fmt(diffuse[1], 4)} (green); result ${rgb(color)}`,
      detail: 'Light that is reflected by the mirror-like part (F) is not available for diffuse scattering, so the diffuse is scaled by 1 − F; metals have no diffuse at all. The sum is multiplied by the light arriving, π · light · (N·L) in three.js\'s units, plus the ambient light on the base colour.',
    });
  } else if (model === 'normals') {
    color = [N[0] * 0.5 + 0.5, N[1] * 0.5 + 0.5, N[2] * 0.5 + 0.5];
    trace?.step({
      phase: 'Encode', label: `c = N · ½ + ½ = ${rgb(color)}`,
      detail: 'A debug view: the normal\'s three components, each from −1 to 1, are squeezed into 0 to 1 and shown as red, green and blue. Faces pointing along +x are red, +y green, +z blue; a face pointing the wrong way shows the opposite colour.',
      quiz: { prompt: `N = ${fmtV(N, 4)}. What colour (r, g, b, each 0 to 1) does the normals view show?`, answer: color, labels: ['r', 'g', 'b'], rule: 'Each component times ½, plus ½.', tolerance: 0.005 },
    });
  } else if (model === 'uv') {
    const uv = inp.uv ?? [0, 0];
    color = [uv[0], uv[1], 0];
    trace?.step({ phase: 'Encode', label: `c = (u, v, 0) = ${rgb(color)}`, detail: 'A debug view: u is shown as red and v as green. Smooth gradients mean smooth UVs; a sudden jump in colour is a seam.' });
  } else {
    color = mul(base, add(ambient, scale(light, d)));
    trace?.step({ phase: 'Custom', label: 'Your shade() runs on the GPU only', detail: 'The custom model is GLSL, compiled by the graphics driver; the trace can show its inputs (N, L, V, uv, base, light) but not run it. The colour below is Lambert, for comparison.' });
  }
  const srgb = color.map((x) => Math.round(255 * Math.min(1, Math.max(0, toSRGB(Math.max(0, x)))))) as [number, number, number];
  trace?.step({
    phase: 'Result', label: `linear ${rgb(color)} → screen (${srgb.join(', ')})`,
    detail: 'Light adds up in linear units, so all the arithmetic above is linear. Screens expect sRGB, which spends more of its 256 levels on dark shades: the last step encodes each channel (roughly c^(1/2.2)), clamps it to 0–1 and scales to 0–255.',
    points: [{ p: P, color: `rgb(${srgb.join(',')})` }],
  });
  return { color, srgb, terms };
}
