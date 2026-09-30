// Vec2: the vector type scripts use. Mutable, so `this.position.x += 5` works; the
// methods return new vectors, so `a.add(b)` does not change `a`.

export class Vec2 {
  constructor(public x = 0, public y = 0) {}

  static from(v: { x: number; y: number }): Vec2 { return new Vec2(v.x, v.y); }

  add(v: { x: number; y: number }): Vec2 { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v: { x: number; y: number }): Vec2 { return new Vec2(this.x - v.x, this.y - v.y); }
  scale(k: number): Vec2 { return new Vec2(this.x * k, this.y * k); }
  dot(v: { x: number; y: number }): number { return this.x * v.x + this.y * v.y; }
  length(): number { return Math.hypot(this.x, this.y); }
  /** The same direction with length 1 (or zero, for the zero vector). */
  normalized(): Vec2 { const l = this.length(); return l === 0 ? new Vec2() : this.scale(1 / l); }
  distanceTo(v: { x: number; y: number }): number { return Math.hypot(this.x - v.x, this.y - v.y); }
  /** The angle from +x, in radians, clockwise on screen (+y is down). */
  angle(): number { return Math.atan2(this.y, this.x); }
  /** Partway toward v: t = 0 is this, 1 is v. */
  lerp(v: { x: number; y: number }, t: number): Vec2 { return new Vec2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t); }
  set(x: number, y: number): this { this.x = x; this.y = y; return this; }
  copy(): Vec2 { return new Vec2(this.x, this.y); }
  toString(): string { return `(${+this.x.toFixed(3)}, ${+this.y.toFixed(3)})`; }
  toJSON(): { x: number; y: number } { return { x: this.x, y: this.y }; }
}
