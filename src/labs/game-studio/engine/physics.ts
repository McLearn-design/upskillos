// Collision maths: shapes in the world, and how far apart two overlapping shapes must
// be pushed.
//
// Phase 4 shapes are axis-aligned rectangles and circles. A rectangle does not turn when
// its body turns (turned boxes come later); its size is scaled by the body's scale.
//
// separate(a, b) answers: which way, and how far, must a move so it no longer overlaps
// b? That is the "minimum translation vector": the shortest push that ends the overlap.
//   rectangle / rectangle  overlap on x is (half-widths summed) − |dx|, likewise on y;
//                          push along the axis with the smaller overlap
//   circle / rectangle     the rectangle's nearest point to the circle's centre; push from
//                          it to the centre until they are a radius apart (from inside, out
//                          through the nearest face)
//   circle / circle        along the line between the centres, until they are r₁ + r₂ apart

export type WorldShape =
  | { kind: 'rectangle'; x: number; y: number; hw: number; hh: number }
  | { kind: 'circle'; x: number; y: number; r: number };

/** A push: the unit normal it goes along (pointing from b towards a) and how far. */
export interface Push { nx: number; ny: number; depth: number }

function rectRect(a: Extract<WorldShape, { kind: 'rectangle' }>, b: Extract<WorldShape, { kind: 'rectangle' }>): Push | null {
  const dx = a.x - b.x, dy = a.y - b.y;
  const ox = a.hw + b.hw - Math.abs(dx), oy = a.hh + b.hh - Math.abs(dy);
  if (ox <= 0 || oy <= 0) return null;
  return ox < oy ? { nx: dx < 0 ? -1 : 1, ny: 0, depth: ox } : { nx: 0, ny: dy < 0 ? -1 : 1, depth: oy };
}

/** Push the circle out of the rectangle (normal from the rectangle towards the circle). */
function circleRect(c: Extract<WorldShape, { kind: 'circle' }>, r: Extract<WorldShape, { kind: 'rectangle' }>): Push | null {
  const px = Math.max(r.x - r.hw, Math.min(c.x, r.x + r.hw)), py = Math.max(r.y - r.hh, Math.min(c.y, r.y + r.hh));
  const dx = c.x - px, dy = c.y - py, d2 = dx * dx + dy * dy;
  if (d2 > 0) {
    if (d2 >= c.r * c.r) return null;
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: c.r - d };
  }
  // The centre is inside the rectangle: out through the nearest face.
  const faces = [
    { nx: -1, ny: 0, depth: c.x - (r.x - r.hw) + c.r }, { nx: 1, ny: 0, depth: r.x + r.hw - c.x + c.r },
    { nx: 0, ny: -1, depth: c.y - (r.y - r.hh) + c.r }, { nx: 0, ny: 1, depth: r.y + r.hh - c.y + c.r },
  ];
  return faces.reduce((a, b) => (b.depth < a.depth ? b : a));
}

function circleCircle(a: Extract<WorldShape, { kind: 'circle' }>, b: Extract<WorldShape, { kind: 'circle' }>): Push | null {
  const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy), gap = a.r + b.r - d;
  if (gap <= 0) return null;
  return d === 0 ? { nx: 0, ny: -1, depth: gap } : { nx: dx / d, ny: dy / d, depth: gap };
}

/** How to push a out of b, or null if they do not overlap. Touching is not overlapping. */
export function separate(a: WorldShape, b: WorldShape): Push | null {
  if (a.kind === 'rectangle' && b.kind === 'rectangle') return rectRect(a, b);
  if (a.kind === 'circle' && b.kind === 'circle') return circleCircle(a, b);
  if (a.kind === 'circle' && b.kind === 'rectangle') return circleRect(a, b);
  const p = circleRect(b as Extract<WorldShape, { kind: 'circle' }>, a as Extract<WorldShape, { kind: 'rectangle' }>);
  return p && { nx: -p.nx, ny: -p.ny, depth: p.depth };
}

export const overlaps = (a: WorldShape, b: WorldShape): boolean => separate(a, b) !== null;

/** Whether two bodies should collide: one's mask includes a layer the other is on. */
export const scans = (mask: number, layer: number): boolean => (mask & layer) !== 0;
