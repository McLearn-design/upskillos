// Algorithm traces.
//
// Every mesh operation can be handed a Trace. As it works it records steps: a
// short label, the phase of the algorithm it belongs to, the elements it is
// looking at, the values it computed, and - for small meshes - the whole mesh
// as it stands after the step. The trace panel plays those steps back over the
// viewport, so an operation can be watched instead of only run.
//
// Recording is opt-in (no Trace, no cost) and bounded: past `limit` steps a
// trace stops recording individual steps and only counts them, and meshes above
// `snapshotLimit` vertices are not copied per step. A large mesh still gets its
// phase boundaries, which is what the "by phase" playback mode uses.

import type { MeshSnapshot, Vec3 } from './EditMesh';

export interface TracePoint { p: Vec3; label?: string; color?: string }
export interface TraceArrow { from: Vec3; to: Vec3; label?: string; color?: string }

/**
 * A question a learner can answer before the step is shown (Predict mode): the prompt gives
 * the inputs, `answer` is what the algorithm computed, `rule` is shown afterwards.
 */
export interface Quiz { prompt: string; answer: number[]; labels?: string[]; rule: string; tolerance?: number }

/** Whether a prediction is right: each number within the tolerance (default 0.01, plus 1% of its size). */
export function checkQuiz(q: Quiz, given: number[]): { correct: boolean; off: number[] } {
  const off = q.answer.map((a, i) => Math.abs((given[i] ?? NaN) - a));
  const tol = (a: number) => (q.tolerance ?? 0.01) + 0.01 * Math.abs(a);
  return { correct: off.every((d, i) => Number.isFinite(d) && d <= tol(q.answer[i])), off };
}

export interface TraceStep {
  /** The stage of the algorithm this step belongs to, e.g. "Face points". */
  phase: string;
  /** One line saying what happened. */
  label: string;
  /** Optional longer explanation or formula. */
  detail?: string;
  verts?: number[];
  edges?: [number, number][];
  faces?: number[];
  points?: TracePoint[];
  arrows?: TraceArrow[];
  /** Name/value pairs shown beside the step. */
  values?: [string, string][];
  /** The mesh as it stands after this step (small meshes only). */
  mesh?: MeshSnapshot;
  /** A value per vertex, drawn as a heat map while this step is shown. */
  field?: number[];
  fieldLabel?: string;
  /** Colour by log(value): for fields spanning many orders of magnitude, like heat. */
  fieldLog?: boolean;
  /** Colour around zero (blue negative, red positive) instead of low to high. */
  fieldDiverging?: boolean;
  /** Draw this many iso-lines of the field. */
  contours?: number;
  /** A prediction to make before the step is shown. */
  quiz?: Quiz;
}

export interface MeshLike { toSnapshot(): MeshSnapshot; verts: Vec3[] }

export class Trace {
  readonly op: string;
  readonly steps: TraceStep[] = [];
  /** Steps that were counted but not recorded because the limit was reached. */
  skipped = 0;
  readonly limit: number;
  readonly snapshotLimit: number;
  /** The mesh before the operation (small meshes only). */
  before?: MeshSnapshot;

  constructor(op: string, { limit = 800, snapshotLimit = 4000 } = {}) {
    this.op = op;
    this.limit = limit;
    this.snapshotLimit = snapshotLimit;
  }

  /** Record a step. Pass the mesh to store its state after the step. */
  step(s: TraceStep, mesh?: MeshLike): void {
    if (this.steps.length >= this.limit) { this.skipped++; return; }
    if (mesh && mesh.verts.length <= this.snapshotLimit) s.mesh = mesh.toSnapshot();
    this.steps.push(s);
  }

  /** Whether per-element steps are worth recording (small enough to watch). */
  detailed(count: number): boolean {
    return this.steps.length + count <= this.limit;
  }

  /** The index of the first step of each phase, in order. */
  phases(): { phase: string; start: number }[] {
    const out: { phase: string; start: number }[] = [];
    this.steps.forEach((s, i) => { if (!out.length || out[out.length - 1].phase !== s.phase) out.push({ phase: s.phase, start: i }); });
    return out;
  }
}

export const fmt = (x: number, d = 3) => (Math.abs(x) < 5e-13 ? 0 : x).toFixed(d).replace(/\.?0+$/, '') || '0';
export const fmtV = (v: Vec3, d = 3) => `(${fmt(v[0], d)}, ${fmt(v[1], d)}, ${fmt(v[2], d)})`;
