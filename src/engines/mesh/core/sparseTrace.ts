// A sparse linear system, solved step by step (Heat map › Trace the heat solve). The system is one heat step from
// a vertex, (M + tC) u = δ: M the vertex areas, C the cotan Laplacian (lesson 7.2), t = h² with h the mean edge
// length. The trace shows the matrix's sparsity and why it is symmetric positive definite, then conjugate gradients
// iteration by iteration, and the plain Jacobi method on the same system for comparison.

import type { EditMesh } from './EditMesh';
import { meanEdge, operators, solveCG, type Sparse } from './geometry';
import { Trace, fmt } from './trace';

export interface SolveReport { n: number; nonZeros: number; cgIterations: number; jacobiIterations: number; residuals: number[] }

/** Jacobi iteration: x ← x + D⁻¹ (b − A x), until the relative residual is below tol (or maxIter). */
function jacobi(A: Sparse, b: Float64Array, tol: number, maxIter: number): number {
  const n = A.n, x = new Float64Array(n), D = A.diag();
  const bn = Math.sqrt(b.reduce((s, v) => s + v * v, 0)) || 1;
  for (let k = 1; k <= maxIter; k++) {
    const Ax = A.mul(x);
    let res = 0;
    for (let i = 0; i < n; i++) { const r = b[i] - Ax[i]; res += r * r; x[i] += r / D[i]; }
    if (Math.sqrt(res) / bn < tol) return k;
  }
  return maxIter;
}

export function traceHeatSolve(mesh: EditMesh, source: number, trace?: Trace): SolveReport {
  const { C, mass } = operators(mesh);
  const n = mesh.verts.length, h = meanEdge(mesh), t = h * h;
  const A = C.scaled(t).plusDiag(mass);
  const nonZeros = A.rows.reduce((s, r) => s + r.size, 0);
  const b = new Float64Array(n); b[source] = 1;
  if (trace) {
    trace.step({
      phase: 'The matrix', label: `A = M + tC: ${n} × ${n}, ${nonZeros} non-zeros (${fmt((100 * nonZeros) / (n * n), 2)}% of ${n * n})`,
      detail: `Row i has a non-zero for vertex i and for each of its neighbours, nothing else: the matrix is sparse. t = h² = ${fmt(t, 4)}, h the mean edge length. Stored as rows of (column, value) pairs, it takes ${nonZeros} numbers instead of ${n * n}.`,
      verts: [source],
      quiz: { prompt: `How many non-zero entries does row ${source} of A have? (Vertex ${source} has ${A.rows[source].size - 1} neighbours.)`, answer: [A.rows[source].size], labels: ['non-zeros'], rule: 'One for the vertex itself (the diagonal) and one per neighbour.', tolerance: 0 },
    }, n <= trace.snapshotLimit ? mesh : undefined);
    let sym = 0;
    A.rows.forEach((row, i) => row.forEach((v, j) => { sym = Math.max(sym, Math.abs(v - (A.rows[j].get(i) ?? 0))); }));
    let minDiag = Infinity; A.diag().forEach((d) => { minDiag = Math.min(minDiag, d); });
    trace.step({
      phase: 'Symmetric positive definite', label: `Symmetric (largest |A_ij − A_ji| = ${sym.toExponential(1)}); every diagonal entry positive (smallest ${fmt(minDiag, 5)})`,
      detail: 'C is symmetric with uᵀCu = Σ w (u_i − u_j)² ≥ 0 (for positive weights), and M adds each vertex\'s area on the diagonal, so uᵀAu > 0 for every u ≠ 0. Symmetric positive definite (SPD) is what conjugate gradients needs.',
    });
  }
  const residuals: number[] = [];
  const cg = solveCG(A, b, { tol: 1e-10, onIter: (_, r) => residuals.push(r) });
  const jacobiIterations = jacobi(A, b, 1e-10, 20000);
  if (trace) {
    trace.step({
      phase: 'Conjugate gradients', label: `${cg.iterations} iterations to a relative residual of ${cg.residual.toExponential(1)}`,
      detail: 'Each iteration multiplies A by one vector (cheap: only the non-zeros) and steps along a direction A-orthogonal to all the earlier ones, so it never undoes earlier progress. In exact arithmetic it would finish within n iterations; in practice far sooner.',
      values: residuals.filter((_, k) => k < 6 || k === residuals.length - 1).map((r, k, arr) => [k === arr.length - 1 && residuals.length > 6 ? `iteration ${residuals.length}` : `iteration ${k + 1}`, r.toExponential(2)] as [string, string]),
      field: Array.from(cg.x), fieldLabel: 'heat u', fieldLog: true,
    });
    trace.step({
      phase: 'Jacobi, for comparison', label: `Jacobi needs ${jacobiIterations} iterations for the same accuracy; CG needed ${cg.iterations}`,
      detail: 'Jacobi updates each unknown from its row alone: simple, but information crawls one edge per iteration across the mesh. CG combines all its previous directions, so it is far faster on the systems of geometry processing.',
      values: [['CG', String(cg.iterations)], ['Jacobi', String(jacobiIterations)]],
    });
  }
  return { n, nonZeros, cgIterations: cg.iterations, jacobiIterations, residuals };
}
