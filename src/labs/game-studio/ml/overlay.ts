// A Q table drawn over a grid game (EnvSpec.overlay): what the agent has learned, where it applies. Each cell gets a
// square coloured by its best Q (red low, yellow middle, green high; grey where it has never been) and an arrow for
// the action it would take there. The runtime adds these to the frame it draws, while training in view and while
// watching a trained agent play.
import type { DrawItem } from '../engine/game';
import type { EnvSpec } from './env';
import { greedy } from './brain';

const ID = 2_000_000_000;   // far above the engine's own drawing ids

/** red → yellow → green for t from 0 to 1. */
function heat(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  const r = c < 0.5 ? 220 : Math.round(220 - (c - 0.5) * 2 * 170), g = c < 0.5 ? Math.round(60 + c * 2 * 160) : 220, b = 60;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** The overlay for a table: a square and an arrow per cell. A state is column × rows + row. */
export function overlayItems(o: NonNullable<EnvSpec['overlay']>, table: number[][], visits?: number[] | null): DrawItem[] {
  const [cols, rows] = o.grid, [cw, ch] = o.cell, [ox, oy] = o.origin ?? [0, 0];
  const arrows = o.arrows ?? table[0]?.map((_, a) => String(a)) ?? [];
  const tried = (s: number) => (visits ? visits[s] > 0 : table[s].some((q) => q !== 0));
  const best = table.map((row) => Math.max(...row));
  const seen = best.filter((_, s) => tried(s));
  const lo = Math.min(...seen, 0), hi = Math.max(...seen, lo + 1e-9);
  const items: DrawItem[] = [];
  const base = { rotation: 0, scaleX: 1, scaleY: 1, screen: false };
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const s = c * rows + r;
    if (s >= table.length) continue;
    const x = ox + (c + 0.5) * cw, y = oy + (r + 0.5) * ch;
    items.push({ ...base, id: ID + s * 2, kind: 'rect', x, y, width: cw - 1, height: ch - 1, alpha: tried(s) ? 0.45 : 0.25, depth: 900, color: tried(s) ? heat((best[s] - lo) / (hi - lo)) : '#64748b' });
    if (!tried(s)) continue;
    const size = Math.round(Math.min(cw, ch) * 0.7);
    items.push({ ...base, id: ID + s * 2 + 1, kind: 'text', x: x - size * 0.32, y: y - size * 0.62, alpha: 1, depth: 901, text: arrows[greedy(table[s])] ?? '?', fontSize: size, color: '#ffffff' });
  }
  return items;
}
