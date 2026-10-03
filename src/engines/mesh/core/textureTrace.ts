// Procedural textures (UV › Trace the texture formula). MeshLab's textures are not images from files: each texel is
// worked out by a formula of (u, v). The trace takes the UV at the centre of a face, applies the material's repeat
// (multiply by the texture scale, keep the fractional part), and steps through that texture's formula to its colour.

import type { TextureName } from './shading';
import { texelColor } from './shading';
import { Trace, fmt } from './trace';

const fract = (x: number) => x - Math.floor(x);

export function traceTexture(name: TextureName, uv: [number, number], scale = 1, trace?: Trace): { u: number; v: number; color: [number, number, number] } {
  const u = fract(uv[0] * scale), v = fract(uv[1] * scale), color = texelColor(name, u, v);
  if (!trace) return { u, v, color };
  trace.step({
    phase: 'Repeat', label: `(${fmt(uv[0], 4)}, ${fmt(uv[1], 4)}) × ${fmt(scale)} → fractional part (${fmt(u, 4)}, ${fmt(v, 4)})`,
    detail: 'The texture covers the unit square and repeats: multiply the UV by the texture scale and keep only the part after the decimal point. A scale of 2 makes the pattern repeat twice across the same surface.',
  });
  if (name === 'checker') {
    const i = Math.floor(u * 8), j = Math.floor(v * 8);
    trace.step({
      phase: 'Formula', label: `square (${i}, ${j}): ${i} + ${j} = ${i + j}, ${(i + j) % 2 === 0 ? 'even: white' : 'odd: coloured'}`,
      detail: 'Cut the square into 8 × 8 cells: cell (floor(8u), floor(8v)). Neighbouring cells differ by 1 in one index, so the parity of their sum alternates like a chessboard. The coloured squares are tinted row by row, so you can tell which way is up.',
      quiz: { prompt: `u = ${fmt(u, 4)}, v = ${fmt(v, 4)}. Which checker cell (floor(8u), floor(8v)) is it in?`, answer: [i, j], labels: ['column', 'row'], rule: 'Multiply by 8 and round down.', tolerance: 0 },
    });
  } else if (name === 'bricks') {
    const ry = v * 8, row = Math.floor(ry), rx = u * 4 + (row % 2) * 0.5, col = Math.floor(rx);
    const inRow = ry - row, inCol = rx - col, mortar = inRow < 0.08 || inCol < 0.04;
    trace.step({
      phase: 'Formula', label: `row ${row}${row % 2 ? ' (shifted half a brick)' : ''}, brick ${col}; ${mortar ? 'in the mortar' : 'in a brick'}`,
      detail: `8 rows of 4 bricks. The row is floor(8v) = ${row}; every other row is shifted by half a brick (rx = 4u + ½ on odd rows) so the joints are staggered. Position inside the brick: ${fmt(inRow, 3)} up, ${fmt(inCol, 3)} along. The bottom 8% and the left 4% of each brick are mortar.${mortar ? '' : ' Each brick gets its own shade from a sine of its row and column (modulo 8 and 4, so the pattern tiles), so they do not all look alike.'}`,
      quiz: { prompt: `v = ${fmt(v, 4)}. Which row of bricks is it, floor(8v)?`, answer: [row], labels: ['row'], rule: 'Eight rows: multiply v by 8 and round down.', tolerance: 0 },
    });
  } else if (name === 'stripes') {
    const k = Math.floor(u * 10);
    trace.step({
      phase: 'Formula', label: `stripe ${k}: ${k % 2 ? 'odd: orange' : 'even: dark'}`,
      detail: 'Ten stripes across u: stripe floor(10u), alternately dark and orange. v plays no part.',
      quiz: { prompt: `u = ${fmt(u, 4)}. Which stripe, floor(10u)?`, answer: [k], labels: ['stripe'], rule: 'Multiply by 10 and round down.', tolerance: 0 },
    });
  } else if (name === 'grid') {
    const du = Math.abs(u * 8 - Math.round(u * 8)), dv = Math.abs(v * 8 - Math.round(v * 8));
    trace.step({
      phase: 'Formula', label: `distance to the nearest grid line: ${fmt(Math.min(du, dv), 3)} of a cell; ${Math.min(du, dv) < 0.04 ? 'on a line' : 'between lines'}`,
      detail: 'Lines every ⅛ in u and v. |8u − round(8u)| is how far u is from the nearest line, in cells; a point is on a line when that, or the same for v, is below 0.04.',
    });
  } else if (name === 'wood') {
    const r = Math.hypot(u - 0.5, (v - 0.5) * 0.25 + 1.2) * 24 + 0.8 * Math.sin(u * 13) + 0.4 * Math.sin(v * 31), t = 0.5 + 0.5 * Math.sin(r * 2 * Math.PI);
    trace.step({
      phase: 'Formula', label: `ring value r = ${fmt(r, 3)}; t = ½ + ½ sin(2πr) = ${fmt(t, 3)}`,
      detail: 'Wood grain is rings round the trunk\'s axis, seen from the side: r is the distance from an axis just off the square, stretched across v, plus small sines that wobble the rings. sin(2πr) turns each whole ring into one light and one dark band; t blends between dark and light wood.',
    });
  } else if (name === 'grass') {
    trace.step({
      phase: 'Formula', label: 'Products of sines: a cheap, repeatable stand-in for noise',
      detail: 'sin(2π(15u + 2v)) · sin(2π(12v − u)), plus half of a finer pair. The frequencies share no simple ratio, so the pattern looks random, yet the same (u, v) always gives the same green; and each sine turns a whole number of times across the square, so the texture tiles without a join. Real noise (Perlin, simplex) does the same job with smoother results.',
    });
  }
  trace.step({
    phase: 'Colour', label: `texel colour (${color.join(', ')})`,
    detail: 'The colour is sRGB, like an image\'s. The shader decodes it to linear and multiplies the material colour by it before lighting.',
    values: [['u', fmt(u, 4)], ['v', fmt(v, 4)], ['texture', name]],
  });
  return { u, v, color };
}
