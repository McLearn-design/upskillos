// How an object's transform moves its vertices, as a trace (Object › Trace the transform). The object's local
// matrix is M = T·R·S: scale first, then rotate (R = Rx·Ry·Rz, three.js's 'XYZ' order), then move. Each vertex
// is a column (x, y, z, 1); M times it is where the vertex is drawn. The steps build S, R and T, combine them,
// then follow each vertex through scale, rotate and move.

import { Euler, Matrix4, Vector3 } from 'three';
import type { Vec3 } from './EditMesh';
import type { SceneObject } from './Scene';
import type { Trace } from './trace';

const r = (x: number) => +(Math.abs(x) < 1e-12 ? 0 : x).toFixed(4);
const v3 = (p: Vector3 | Vec3) => (p instanceof Vector3 ? `(${r(p.x)}, ${r(p.y)}, ${r(p.z)})` : `(${p.map(r).join(', ')})`);
/** A 4×4 matrix as four rows of text (three.js stores it column by column). */
const rows = (m: Matrix4) => [0, 1, 2, 3].map((i) => `[${[0, 1, 2, 3].map((j) => r(m.elements[j * 4 + i])).join('  ')}]`).join(' ');

/** Trace how o's local matrix moves its first vertices (up to `limit`); returns M and where each vertex goes. */
export function traceTransform(o: SceneObject, trace?: Trace, limit = 8): { matrix: number[]; moved: Vec3[] } {
  if (!o.mesh) throw new Error(`${o.name} has no mesh`);
  const S = new Matrix4().makeScale(...o.scale);
  const R = new Matrix4().makeRotationFromEuler(new Euler(o.rotation[0], o.rotation[1], o.rotation[2], 'XYZ'));
  const T = new Matrix4().makeTranslation(...o.position);
  const M = T.clone().multiply(R).multiply(S);
  const deg = o.rotation.map((a) => r(a * 180 / Math.PI));
  if (trace) {
    trace.step({ phase: 'Build', label: `S: scale by ${v3(o.scale)}`, detail: 'A scale matrix has the three scale factors down its diagonal: each coordinate is multiplied by its own factor.', values: [['S', rows(S)]] });
    trace.step({ phase: 'Build', label: `R: rotate ${deg[0]}° about x, ${deg[1]}° about y, ${deg[2]}° about z (R = Rx·Ry·Rz)`, detail: 'Each column of R is where one axis ends up after the rotation. A rotation keeps lengths and angles, so its columns are unit vectors at right angles to each other.', values: [['R', rows(R)]] });
    trace.step({ phase: 'Build', label: `T: move by ${v3(o.position)}`, detail: 'A translation cannot be written as a 3×3 matrix, because it moves the origin. The fourth column of a 4×4 matrix holds it, and the vertex\'s fourth coordinate, 1, picks it up.', values: [['T', rows(T)]] });
    trace.step({
      phase: 'Combine', label: `M = T·R·S: ${rows(M)}`,
      detail: 'Multiplying the matrices makes one matrix that does all three. Read right to left, it scales, then rotates, then moves. Its first three columns are where the object\'s x, y and z axes point (scaled); its fourth column is where the object\'s origin goes.',
      values: [['M', rows(M)]],
      quiz: { prompt: `M = T·R·S, with T moving by ${v3(o.position)}. What is the fourth column of M (its top three numbers)?`, answer: [...o.position], labels: ['x', 'y', 'z'], rule: 'S and R leave the origin where it is, so only T moves it: the fourth column of M is the translation.' },
    });
  }
  const moved: Vec3[] = [];
  o.mesh.verts.forEach((p, i) => {
    const a = new Vector3(...p), s = a.clone().applyMatrix4(S), rr = s.clone().applyMatrix4(R), t = rr.clone().applyMatrix4(T);
    moved.push([t.x, t.y, t.z]);
    if (!trace || i >= limit) return;
    trace.step({
      phase: 'Vertices', label: `v${i}: ${v3(a)} → scaled ${v3(s)} → rotated ${v3(rr)} → moved ${v3(t)}`,
      detail: 'Scale, then rotate, then move: the same as multiplying by M once.',
      verts: [i], values: [['local', v3(a)], ['after S', v3(s)], ['after R', v3(rr)], ['after T (world)', v3(t)]],
      quiz: i === 0 ? { prompt: `v0 is at ${v3(a)} in the object\'s own coordinates. Scale by ${v3(o.scale)}, rotate by ${deg.join('°, ')}° about x, y, z, then move by ${v3(o.position)}. Where is it drawn?`, answer: [t.x, t.y, t.z], labels: ['x', 'y', 'z'], rule: 'Apply S, then R, then T, in that order (M = T·R·S acts on the vertex from the right).' } : undefined,
    });
  });
  return { matrix: [...M.elements], moved };
}

/**
 * Take a matrix apart into position, scale and rotation (Object › Decompose the matrix). The fourth column is
 * the position; the lengths of the first three columns are the scale; the columns divided by their lengths are
 * the rotation, if they are at right angles to each other. If they are not, the matrix has a shear, and no
 * T·R·S makes it: the check says how far from right angles they are. Traced, with Predict questions on the
 * first column's length and on the angle between columns 1 and 3.
 */
export function traceDecompose(elements: ArrayLike<number>, trace?: Trace): { position: Vec3; scale: Vec3; rotationDeg: Vec3; shearDeg: number; det: number } {
  const m = new Matrix4().fromArray(Array.from(elements));
  const e = m.elements, col = (j: number) => new Vector3(e[j * 4], e[j * 4 + 1], e[j * 4 + 2]);
  const c = [col(0), col(1), col(2)], position: Vec3 = [e[12], e[13], e[14]];
  const scale = c.map((v) => v.length()) as Vec3;
  const u = c.map((v, i) => v.clone().divideScalar(scale[i] || 1));
  const angle = (a: Vector3, b: Vector3) => Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * 180 / Math.PI;
  const pairs: [number, number][] = [[0, 1], [0, 2], [1, 2]];
  const angles = pairs.map(([i, j]) => angle(u[i], u[j]));
  const shearDeg = Math.max(...angles.map((a) => Math.abs(a - 90)));
  const det = m.determinant();
  const eul = new Euler().setFromRotationMatrix(new Matrix4().makeBasis(u[0], u[1], u[2]), 'XYZ');
  const rotationDeg = [eul.x, eul.y, eul.z].map((a) => r(a * 180 / Math.PI)) as Vec3;
  if (trace) {
    trace.step({ phase: 'Position', label: `Fourth column: position ${v3(position)}`, detail: 'S and R leave the origin where it is, so where M sends the origin, its fourth column, is the translation.', values: [['M', rows(m)], ['position', v3(position)]] });
    trace.step({
      phase: 'Scale', label: `Column lengths: scale ${v3(scale)}`, detail: 'Each of the first three columns is where an axis goes. A rotation keeps lengths, so how long each column is is how much that axis was scaled.',
      values: [['column 1', v3(c[0])], ['column 2', v3(c[1])], ['column 3', v3(c[2])], ['lengths', v3(scale)]],
      quiz: { prompt: `Column 1 of M is ${v3(c[0])}. What is its length, the scale along the object's x axis?`, answer: [scale[0]], labels: ['|column 1|'], rule: 'Length = √(x² + y² + z²) of the column.' },
    });
    trace.step({ phase: 'Rotation', label: `Columns divided by their lengths: rotation ${rotationDeg.join('°, ')}° about x, y, z`, detail: 'With the scale divided out, the columns are where the axes point: a rotation, if they are at right angles.', values: [['unit columns', u.map((v) => v3(v)).join('  ')], ['rotation (XYZ)', `${rotationDeg.join('°, ')}°`]] });
    trace.step({
      phase: 'Check', label: shearDeg < 1e-6 ? 'The columns are at right angles: M is exactly T·R·S' : `The columns are not at right angles (${angles.map((a) => `${r(a)}°`).join(', ')}): a shear of ${r(shearDeg)}°, which no T·R·S can make`,
      detail: shearDeg < 1e-6 ? 'Position, scale and rotation rebuild M exactly.' : 'A scale applied after a rotation stretches along the world\'s axes instead of the object\'s, and squares become slanted. Position, rotation and scale cannot describe that, so the rotation and scale above are only an approximation of M.',
      values: [['angle 1–2', `${r(angles[0])}°`], ['angle 1–3', `${r(angles[1])}°`], ['angle 2–3', `${r(angles[2])}°`], ['shear', `${r(shearDeg)}°`]],
      quiz: { prompt: `The unit columns are ${u.map((v) => v3(v)).join(', ')}. What is the angle between column 1 and column 3, in degrees?`, answer: [angles[1]], labels: ['angle (degrees)'], rule: 'cos θ = (unit column 1) · (unit column 3); a rotation\'s columns are at exactly 90°.', tolerance: 0.2 },
    });
  }
  return { position, scale, rotationDeg, shearDeg, det };
}

/**
 * The determinant of a matrix's 3×3 part, worked out (Object › Determinant of the matrix): expanded along the
 * first row, checked against the triple product c1 · (c2 × c3), then read as a volume factor and a sign. With a
 * closed mesh, its volume in its own coordinates times det is the volume it fills in the world, negative when
 * mirrored. Traced, with Predict questions on det and on that volume.
 */
export function traceDeterminant(elements: ArrayLike<number>, localVolume: number | null, trace?: Trace): { det: number; worldVolume: number | null } {
  const e = Array.from(elements);
  // Row i, column j of the 3×3 part (three.js stores column by column).
  const a = (i: number, j: number) => e[j * 4 + i];
  const t1 = a(0, 0) * (a(1, 1) * a(2, 2) - a(1, 2) * a(2, 1));
  const t2 = a(0, 1) * (a(1, 0) * a(2, 2) - a(1, 2) * a(2, 0));
  const t3 = a(0, 2) * (a(1, 0) * a(2, 1) - a(1, 1) * a(2, 0));
  const det = t1 - t2 + t3;
  const c = [0, 1, 2].map((j) => new Vector3(a(0, j), a(1, j), a(2, j)));
  const triple = c[0].dot(c[1].clone().cross(c[2]));
  const worldVolume = localVolume === null ? null : localVolume * det;
  if (trace) {
    const row = (i: number) => `[${[0, 1, 2].map((j) => r(a(i, j))).join('  ')}]`;
    trace.step({ phase: 'Matrix', label: `The 3×3 part: ${row(0)} ${row(1)} ${row(2)}`, detail: 'The determinant uses only the first three rows and columns: the move in the fourth column changes where things are, not how big they are.', values: [['rows', `${row(0)} ${row(1)} ${row(2)}`]] });
    trace.step({
      phase: 'Expand', label: `det = ${r(a(0, 0))}·(${r(a(1, 1))}·${r(a(2, 2))} − ${r(a(1, 2))}·${r(a(2, 1))}) − ${r(a(0, 1))}·(…) + ${r(a(0, 2))}·(…) = ${r(t1)} − ${r(t2)} + ${r(t3)} = ${r(det)}`,
      detail: 'Along the first row: each entry times the 2×2 determinant left when its row and column are crossed out, with signs + − +. A 2×2 determinant of [p q; s t] is pt − qs.',
      values: [['first term', String(r(t1))], ['second term', String(r(t2))], ['third term', String(r(t3))], ['det', String(r(det))]],
      quiz: { prompt: `The 3×3 part is ${row(0)} ${row(1)} ${row(2)}. What is its determinant?`, answer: [det], labels: ['det'], rule: 'Expand along the first row with signs + − +; for a diagonal matrix it is just the product of the diagonal.' },
    });
    trace.step({ phase: 'Triple product', label: `Check: column 1 · (column 2 × column 3) = ${r(triple)}`, detail: 'The columns are where the three axes go. The unit cube they started as becomes the slanted box they span, and its signed volume is this triple product: the same number as the determinant.', values: [['c1 · (c2 × c3)', String(r(triple))]] });
    trace.step({
      phase: 'Meaning', label: `|det| = ${r(Math.abs(det))}: volumes are multiplied by ${r(Math.abs(det))}. ${det < 0 ? 'det is negative: the object is mirrored.' : det === 0 ? 'det is 0: everything is squashed flat.' : 'det is positive: not mirrored.'}`,
      detail: 'A negative determinant means the axes have swapped handedness, like a reflection in a mirror. Every face\'s corners then go round the other way on screen, so a renderer that does not correct for it culls or darkens the wrong side.',
      values: [['volume factor', String(r(Math.abs(det)))], ['mirrored', det < 0 ? 'yes' : 'no'], ...(localVolume === null ? [] : [['mesh volume (own coordinates)', String(r(localVolume))], ['in the world (signed)', String(r(worldVolume!))]] as [string, string][])],
      quiz: localVolume === null ? undefined : { prompt: `The mesh holds a volume of ${r(localVolume)} in its own coordinates, and det = ${r(det)}. What signed volume does it fill in the world?`, answer: [worldVolume!], labels: ['volume'], rule: 'Volumes scale by det, sign included: a mirrored closed mesh measures negative, as if inside out.' },
    });
  }
  return { det, worldVolume };
}

/** What traceWorld needs from a scene: an object's parent and its local matrix. */
export interface ChainScene { get(id: string): SceneObject | undefined; localMatrix(o: SceneObject): Matrix4 }

/**
 * How an object's world matrix is built (Object › Trace the world matrix): walk up the parent chain to the
 * root, then multiply the local matrices from the root down, world = parent's world × local. Each step shows
 * where that node's origin lands in the world. Traced, with Predict questions on the second node down (if any)
 * and on the object itself.
 */
export function traceWorld(scene: ChainScene, o: SceneObject, trace?: Trace): { chain: string[]; origins: Vec3[]; matrix: number[] } {
  const chain: SceneObject[] = [];
  for (let n: SceneObject | undefined = o; n; n = n.parent ? scene.get(n.parent) : undefined) chain.unshift(n);
  if (trace) trace.step({ phase: 'Walk up', label: `${o.name}'s chain, from the root: ${chain.map((n) => n.name).join(' → ')}`, detail: 'Each object stores only its transform relative to its parent. To know where it is in the world, follow the parents up to one that has none, the root.', values: [['chain', chain.map((n) => n.name).join(' → ')]] });
  const world = new Matrix4(), origins: Vec3[] = [];
  chain.forEach((n, k) => {
    const parentOrigin = origins[k - 1] ?? [0, 0, 0];
    world.multiply(scene.localMatrix(n));
    const at: Vec3 = [world.elements[12], world.elements[13], world.elements[14]];
    origins.push(at);
    if (!trace) return;
    const deg = n.rotation.map((a) => r(a * 180 / Math.PI));
    const ask = (k === 1 && chain.length > 2) || k === chain.length - 1 && k > 0;
    trace.step({
      phase: k === 0 ? 'Root' : 'Multiply',
      label: k === 0 ? `${n.name} (the root): world = its own matrix; origin at ${v3(at)}` : `${n.name}: world = ${chain[k - 1].name}'s world × its local (at ${v3(n.position)}, turned ${deg.join('°, ')}°); origin now at ${v3(at)}`,
      detail: k === 0 ? 'A root has no parent, so its world matrix is its local matrix.' : 'The local offset is measured in the parent\'s frame: it is turned by everything above, then added to the parent\'s origin. The turns add up too: this node is turned by its own rotation on top of all its parents\'.',
      values: [['local position', v3(n.position)], ['local turn (x, y, z)', `${deg.join('°, ')}°`], ['world origin', v3(at)], ['world', rows(world)]],
      quiz: ask ? { prompt: `${chain[k - 1].name}'s origin is at ${v3(parentOrigin)} in the world. ${n.name} sits at ${v3(n.position)} in ${chain[k - 1].name}'s frame, which is turned by everything above it. Where is ${n.name}'s origin in the world?`, answer: at, labels: ['x', 'y', 'z'], rule: 'Turn the local offset by the parent\'s world rotation (all the turns above, added), then add the parent\'s world origin: world = parent world × local.' } : undefined,
    });
  });
  return { chain: chain.map((n) => n.name), origins, matrix: [...world.elements] };
}
