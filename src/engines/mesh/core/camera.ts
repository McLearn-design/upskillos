// Cameras as scene objects: what a camera sees, and turning an object to face a point.
//
// A camera looks down its own −z axis with +y up, as in three.js and glTF. Its
// field of view is vertical, in degrees; the horizontal one follows from the
// image's aspect ratio. The pyramid it sees (the frustum) runs from the near
// plane to the far plane: at distance d the image rectangle is
// 2·d·tan(fov/2) high and aspect times as wide.

import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Vec3 } from './EditMesh';
import type { Trace } from './trace';

export interface CameraSettings {
  /** Vertical field of view, degrees. */
  fov: number;
  near: number;
  far: number;
}

export const DEFAULT_CAMERA: CameraSettings = { fov: 50, near: 0.1, far: 200 };

/** Render sizes offered for stills; the camera view is framed to the chosen aspect. */
export const RENDER_SIZES = [
  { label: '1280 × 720 (16:9)', width: 1280, height: 720 },
  { label: '1920 × 1080 (16:9)', width: 1920, height: 1080 },
  { label: '1080 × 1080 (square)', width: 1080, height: 1080 },
  { label: '800 × 600 (4:3)', width: 800, height: 600 },
] as const;

/**
 * The rotation (XYZ Euler, radians, local to the parent) that points an object's
 * −z axis from `eye` at `target`, keeping its +y as close to world up as it can.
 * `parentWorld` is the parent's world rotation, if the object has a parent.
 * Looking straight up or down, "up" is undefined; three.js then picks a nearby one.
 */
export function lookAtRotation(eye: Vec3, target: Vec3, parentWorld?: Quaternion): Vec3 {
  const m = new Matrix4().lookAt(new Vector3(...eye), new Vector3(...target), new Vector3(0, 1, 0));
  const world = new Quaternion().setFromRotationMatrix(m);
  const local = parentWorld ? parentWorld.clone().invert().multiply(world) : world;
  const e = new Euler().setFromQuaternion(local, 'XYZ');
  return [e.x, e.y, e.z];
}

/** The four corners of the image rectangle at distance d in front of a camera, in its own coordinates. */
export function frustumCorners(fov: number, aspect: number, d: number): Vec3[] {
  const h = d * Math.tan((fov * Math.PI) / 360), w = h * aspect;
  return [[-w, -h, -d], [w, -h, -d], [w, h, -d], [-w, h, -d]];
}

/** The horizontal field of view (degrees) that goes with a vertical one at an aspect ratio. */
export function horizontalFov(fov: number, aspect: number): number {
  return (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * aspect) * 180) / Math.PI;
}

/**
 * A camera's view matrix, as the inverse of its world matrix (Object › Trace the view matrix). The camera's
 * world matrix has its right, up and back axes as columns and its position (the eye) as the fourth column; the
 * view matrix undoes it, so its rows are those unit axes and its fourth column is minus each axis dotted with
 * the eye. A world point then lands in camera space: x right, y up, z towards the viewer, so a point in front
 * of the camera has z < 0, at distance −z. Traced, with Predict questions on the forward direction and on the
 * point's camera-space coordinates.
 */
export function traceView(elements: ArrayLike<number>, point: Vec3, trace?: Trace): { eye: Vec3; right: Vec3; up: Vec3; forward: Vec3; view: number[]; camera: Vec3 } {
  const world = new Matrix4().fromArray(Array.from(elements));
  const e = world.elements, col = (j: number) => new Vector3(e[j * 4], e[j * 4 + 1], e[j * 4 + 2]).normalize();
  const right = col(0), up = col(1), back = col(2), eye = new Vector3(e[12], e[13], e[14]);
  const forward = back.clone().negate();
  // Unscaled axes, so the inverse is the transpose of the turn and minus the turned eye.
  const view = new Matrix4().set(
    right.x, right.y, right.z, -right.dot(eye),
    up.x, up.y, up.z, -up.dot(eye),
    back.x, back.y, back.z, -back.dot(eye),
    0, 0, 0, 1,
  );
  const off = new Vector3(...point).sub(eye);
  const cam: Vec3 = [right.dot(off), up.dot(off), back.dot(off)];
  const arr = (v: Vector3): Vec3 => [v.x, v.y, v.z];
  if (trace) {
    const r = (x: number) => +(Math.abs(x) < 1e-12 ? 0 : x).toFixed(4);
    const v3 = (v: Vec3 | Vector3) => `(${(v instanceof Vector3 ? arr(v) : v).map(r).join(', ')})`;
    trace.step({
      phase: 'Camera', label: `Eye ${v3(eye)}; right ${v3(right)}, up ${v3(up)}, looking along ${v3(forward)}`,
      detail: 'A camera looks down its own −z axis, with +y up and +x to the right. The columns of its world matrix are those axes in the world (lesson 2.6); the fourth column is where it stands, the eye.',
      values: [['eye', v3(eye)], ['right (x column)', v3(right)], ['up (y column)', v3(up)], ['back (z column)', v3(back)], ['forward = −back', v3(forward)]],
      quiz: { prompt: `The camera's z column (its back axis, unit length) is ${v3(back)}. Which way does it look (a unit vector)?`, answer: arr(forward), labels: ['x', 'y', 'z'], rule: 'A camera looks along its −z axis: flip the sign of the z column.' },
    });
    const rows = [0, 1, 2].map((i) => `[${[0, 1, 2, 3].map((j) => r(view.elements[j * 4 + i])).join('  ')}]`).join(' ');
    trace.step({
      phase: 'Inverse', label: `View matrix = inverse of the camera's world matrix: ${rows}`,
      detail: 'The world matrix turns the camera\'s axes into the world\'s and then moves to the eye. The view matrix undoes both in reverse order: move the eye back to the origin, then turn the world so the camera\'s axes line up with x, y and z. A turn\'s inverse is its transpose, so the rows are the camera\'s axes.',
      values: [['row 1 (right)', `${v3(right)}, −right·eye = ${r(-right.dot(eye))}`], ['row 2 (up)', `${v3(up)}, −up·eye = ${r(-up.dot(eye))}`], ['row 3 (back)', `${v3(back)}, −back·eye = ${r(-back.dot(eye))}`]],
    });
    trace.step({
      phase: 'Camera space', label: `World point ${v3(point)} is at ${v3(cam)} in camera space: ${cam[2] < 0 ? `${r(-cam[2])} in front` : 'behind the camera'}`,
      detail: 'Offset from the eye, then dot with each camera axis: how far right, how far up, and how far back. In front of the camera, z is negative; the further away, the more negative.',
      values: [['offset from eye', v3(off)], ['right · offset', String(r(cam[0]))], ['up · offset', String(r(cam[1]))], ['back · offset', String(r(cam[2]))]],
      quiz: { prompt: `The eye is at ${v3(eye)}; the camera's right, up and back axes are ${v3(right)}, ${v3(up)}, ${v3(back)}. Where is the world point ${v3(point)} in camera space?`, answer: cam, labels: ['x', 'y', 'z'], rule: 'Subtract the eye, then dot the offset with right, up and back in turn.' },
    });
    const check = view.clone().multiply(world).elements.reduce((m, x, k) => Math.max(m, Math.abs(x - (k % 5 === 0 ? 1 : 0))), 0);
    trace.step({ phase: 'Check', label: `view × world = identity (largest error ${r(check)})`, detail: 'The view matrix undoes the camera\'s world matrix exactly, so their product changes nothing.', values: [['largest error', String(check.toExponential(1))]] });
  }
  return { eye: arr(eye), right: arr(right), up: arr(up), forward: arr(forward), view: [...view.elements], camera: cam };
}

/**
 * How a point reaches the image (Object › Trace the projection): into camera space with the view matrix, then
 * the projection matrix makes clip coordinates (x, y, z, w) with w = −z, the distance in front; dividing by w
 * gives normalised device coordinates, −1 to 1 across the image, and those become pixels. Perspective only, as
 * MeshLab's cameras are; three.js's (OpenGL's) convention, so depth also runs −1 (near) to 1 (far). Traced, with
 * Predict questions on the normalised coordinates and on the pixel.
 */
export function traceProjection(elements: ArrayLike<number>, cam: CameraSettings, size: { width: number; height: number }, point: Vec3, trace?: Trace): { camera: Vec3; clip: [number, number, number, number]; ndc: Vec3; pixel: [number, number]; inside: boolean } {
  const c = traceView(elements, point).camera;
  const aspect = size.width / size.height, n = cam.near, fr = cam.far;
  const f = 1 / Math.tan((cam.fov * Math.PI) / 360);
  const P = [[f / aspect, 0, 0, 0], [0, f, 0, 0], [0, 0, (fr + n) / (n - fr), (2 * fr * n) / (n - fr)], [0, 0, -1, 0]];
  const clip = P.map((row) => row[0] * c[0] + row[1] * c[1] + row[2] * c[2] + row[3]) as [number, number, number, number];
  const w = clip[3];
  const ndc: Vec3 = [clip[0] / w, clip[1] / w, clip[2] / w];
  const pixel: [number, number] = [((ndc[0] + 1) / 2) * size.width, ((1 - ndc[1]) / 2) * size.height];
  const inside = w > 0 && ndc.every((x) => Math.abs(x) <= 1);
  if (trace) {
    const r = (x: number) => +(Math.abs(x) < 1e-12 ? 0 : x).toFixed(4);
    const v = (a: number[]) => `(${a.map(r).join(', ')})`;
    trace.step({ phase: 'Camera space', label: `${v(point)} in camera space: ${v(c)}`, detail: 'The view matrix first (lesson 3.1): x right, y up, z back, so in front means z < 0.', values: [['camera space', v(c)]] });
    trace.step({
      phase: 'Projection matrix', label: `fov ${cam.fov}°, aspect ${r(aspect)}, near ${n}, far ${fr}: f = 1 / tan(fov / 2) = ${r(f)}`,
      detail: 'Row 1 scales x by f / aspect and row 2 scales y by f, so the edges of the view land at ±1. Row 3 maps depth from near to far onto −1 to 1. Row 4 copies −z into w: the distance in front of the camera, saved for the divide.',
      values: P.map((row, i) => [`row ${i + 1}`, v(row)] as [string, string]),
    });
    trace.step({ phase: 'Clip space', label: `P × (${c.map(r).join(', ')}, 1) = ${v(clip)}`, detail: 'Clip coordinates: x, y and z are scaled, and w is the distance in front. The GPU clips triangles here, against −w ≤ x, y, z ≤ w, before dividing.', values: [['clip (x, y, z, w)', v(clip)]] });
    trace.step({
      phase: 'Divide', label: `Divide by w = ${r(w)}: normalised device coordinates ${v(ndc)}`,
      detail: 'The perspective divide: x and y shrink in proportion to distance, which is why far things look small. After it, the visible region is the cube from −1 to 1 on every axis.',
      values: [['ndc', v(ndc)]],
      quiz: { prompt: `Clip coordinates are ${v(clip)}. What are the normalised device coordinates (x, y, z)?`, answer: ndc, labels: ['x', 'y', 'z'], rule: 'Divide x, y and z by w, the fourth number.' },
    });
    trace.step({
      phase: 'Pixels', label: `On a ${size.width} × ${size.height} image: pixel (${r(pixel[0])}, ${r(pixel[1])})${inside ? '' : ' (outside the image)'}`,
      detail: 'x from −1 to 1 becomes 0 to the width; y from −1 to 1 becomes the height to 0, because pixel rows count downwards from the top.',
      values: [['pixel x = (x + 1) / 2 × width', String(r(pixel[0]))], ['pixel y = (1 − y) / 2 × height', String(r(pixel[1]))], ['inside the view', inside ? 'yes' : 'no']],
      quiz: { prompt: `Normalised device coordinates x = ${r(ndc[0])}, y = ${r(ndc[1])}. Which pixel is that on a ${size.width} × ${size.height} image?`, answer: pixel, labels: ['px', 'py'], rule: 'px = (x + 1) / 2 × width; py = (1 − y) / 2 × height (rows count down from the top).' },
    });
  }
  return { camera: c, clip, ndc, pixel, inside };
}

/**
 * Two points through the depth buffer (Object › Trace the depth buffer): each one's distance in front of the
 * camera, its depth after the divide (0 at the near plane, 1 at the far plane, as stored), and the whole number
 * a 24-bit depth buffer keeps. Equal numbers mean the depth test cannot tell the surfaces apart: z-fighting. The
 * last step gives the depth resolution at the first point's distance, d² (f − n) / (f n 2^bits): surfaces closer
 * together than that fight. Traced, with Predict questions on the first stored depth and on the resolution.
 */
export function traceDepth(elements: ArrayLike<number>, cam: CameraSettings, a: Vec3, b: Vec3, bits = 24, trace?: Trace): { distance: [number, number]; depth: [number, number]; stored: [number, number]; fight: boolean; resolution: number } {
  const n = cam.near, f = cam.far, top = 2 ** bits - 1;
  const distance = [a, b].map((p) => -traceView(elements, p).camera[2]) as [number, number];
  const depth = distance.map((d) => (f * (d - n)) / (d * (f - n))) as [number, number];
  const stored = depth.map((x) => Math.round(Math.min(1, Math.max(0, x)) * top)) as [number, number];
  const fight = stored[0] === stored[1];
  const resolution = (distance[0] ** 2 * (f - n)) / (f * n * 2 ** bits);
  if (trace) {
    const r = (x: number, k = 4) => +(Math.abs(x) < 1e-12 ? 0 : x).toFixed(k);
    const v = (p: Vec3) => `(${p.map((x) => r(x)).join(', ')})`;
    trace.step({ phase: 'Distance', label: `${v(a)} is ${r(distance[0])} in front; ${v(b)} is ${r(distance[1])} in front`, detail: 'Into camera space with the view matrix (lesson 3.1); the distance in front is −z.', values: [['near, far', `${n}, ${f}`], ['distance A', String(r(distance[0]))], ['distance B', String(r(distance[1]))]] });
    trace.step({
      phase: 'Depth', label: `Depth after the divide: A ${r(depth[0], 7)}, B ${r(depth[1], 7)}`,
      detail: 'The projection maps the near plane to 0 and the far plane to 1 (as stored; NDC\'s −1 to 1, halved and moved). In between it goes as 1 / distance, so most of the range is used up close to the camera.',
      values: [['depth = f (d − n) / (d (f − n))', `${r(depth[0], 7)}, ${r(depth[1], 7)}`]],
      quiz: { prompt: `Near ${n}, far ${f}. Point A is ${r(distance[0])} in front of the camera. What depth (0 at near, 1 at far) does it get?`, answer: [depth[0]], labels: ['depth'], rule: 'depth = f (d − n) / (d (f − n)).', tolerance: 0.0005 },
    });
    trace.step({ phase: 'Store', label: `A ${bits}-bit depth buffer keeps whole numbers 0 to ${top}: A ${stored[0]}, B ${stored[1]}`, detail: 'Each pixel stores the depth as a whole number. Depths closer together than one step round to the same number.', values: [['A × (2^bits − 1)', String(r(depth[0] * top, 2))], ['B × (2^bits − 1)', String(r(depth[1] * top, 2))]] });
    trace.step({
      phase: 'Compare', label: fight ? `Equal (${stored[0]}): the depth test cannot tell A from B, so they fight` : `${stored[0] < stored[1] ? 'A' : 'B'} is nearer by ${Math.abs(stored[1] - stored[0])} steps: the depth test keeps it`,
      detail: `At A's distance, one step of the depth buffer is ${r(resolution, 6)} long: surfaces closer together than that cannot be told apart. Raising the near plane shrinks it far more than lowering the far plane.`,
      values: [['resolution at A, d² (f − n) / (f n 2^bits)', String(r(resolution, 6))], ['A and B apart', String(r(Math.abs(distance[1] - distance[0]), 6))]],
      quiz: { prompt: `Near ${n}, far ${f}, a ${bits}-bit depth buffer. How far apart must two surfaces ${r(distance[0])} in front be before the depth test can tell them apart? (d² (f − n) / (f n 2^bits))`, answer: [resolution], labels: ['distance'], rule: 'The depth resolution grows with the square of the distance and shrinks as the near plane moves out.', tolerance: resolution * 0.03 },
    });
  }
  return { distance, depth, stored, fight, resolution };
}

/** MeshLab's selection outline: each vertex is pushed out along its normal by this fraction of its distance from the eye. */
export const OUTLINE_THICKNESS = 0.0035;

/**
 * How wide the selection outline is on a camera's image (Object › Trace the outline width): the inverted hull is
 * pushed out by k × d at distance d, and something w wide at distance d is w · f · (H / 2) / d pixels across, so
 * the outline is k · f · H / 2 pixels wide whatever the distance. Traced, with a Predict question on the pixels.
 */
export function traceOutline(elements: ArrayLike<number>, cam: CameraSettings, size: { width: number; height: number }, point: Vec3, k = OUTLINE_THICKNESS, trace?: Trace): { distance: number; push: number; pixels: number } {
  const distance = -traceView(elements, point).camera[2];
  const f = 1 / Math.tan((cam.fov * Math.PI) / 360), push = k * distance, pixels = (push * f * (size.height / 2)) / distance;
  if (trace) {
    const r = (x: number, n = 4) => +x.toFixed(n);
    trace.step({ phase: 'Distance', label: `The object is ${r(distance)} in front of the camera`, detail: 'The outline is drawn in camera space (lesson 3.1): its push depends on the distance in front, −z.', values: [['distance', String(r(distance))]] });
    trace.step({ phase: 'Push', label: `Every vertex is pushed out along its normal by ${k} × ${r(distance)} = ${r(push, 5)}`, detail: 'The inverted hull: a copy of the mesh, pushed out along its smooth normals and drawn back faces only, so only the rim beyond the silhouette shows. A fixed push would look thick near the camera and vanish far away; a push proportional to distance does not.', values: [['k', String(k)], ['push = k × distance', String(r(push, 5))]] });
    trace.step({
      phase: 'Pixels', label: `On a ${size.height}-pixel-tall image with fov ${cam.fov}°: ${r(pixels, 2)} pixels wide`,
      detail: 'Something w wide at distance d covers w × f × (H / 2) / d pixels (lesson 3.2: the divide by distance, then NDC to pixels). With w = k × d the distance cancels: k × f × H / 2.',
      values: [['f = 1 / tan(fov / 2)', String(r(1 / Math.tan((cam.fov * Math.PI) / 360)))], ['pixels = k f H / 2', String(r(pixels, 2))]],
      quiz: { prompt: `The outline is pushed out by ${k} × distance. The camera has fov ${cam.fov}° (f = ${r(f)}) and the image is ${size.height} pixels tall. How many pixels wide is the outline?`, answer: [pixels], labels: ['pixels'], rule: 'k × f × H / 2: the distance cancels.', tolerance: 0.05 },
    });
    trace.step({ phase: 'Stencil', label: 'The body marks its pixels in the stencil buffer; the hull is drawn only where nothing is marked', detail: 'In a concave crease the hull\'s back faces can come in front of the body and show as a stray line inside the object. The stencil test keeps the outline to pixels the body does not cover: outside the silhouette only. View › Outline stencil on / off shows the difference.', values: [] });
  }
  return { distance, push, pixels };
}

/**
 * How look-at turns a camera (Object › Trace look-at): forward from the eye to the target, right and up by cross
 * products (lesson 3.1), those three as the columns of a rotation (a change of basis, lesson 2.6), and that
 * rotation decoded into the XYZ Euler angles the Rotation fields show (lesson 2.7). The same numbers as
 * lookAtRotation, worked out. Traced, with Predict questions on forward and on the Y rotation.
 */
export function traceLookAt(eye: Vec3, target: Vec3, trace?: Trace): { right: Vec3; up: Vec3; back: Vec3; rotationDeg: Vec3 } {
  const e = new Vector3(...eye), t = new Vector3(...target);
  const forward = t.clone().sub(e).normalize();
  const right = forward.clone().cross(new Vector3(0, 1, 0));
  if (right.lengthSq() < 1e-12) throw new Error('look-at: the target is straight above or below, so there is no right axis');
  right.normalize();
  const up = right.clone().cross(forward), back = forward.clone().negate();
  const m = new Matrix4().makeBasis(right, up, back);
  const eu = new Euler().setFromRotationMatrix(m, 'XYZ');
  const rotationDeg: Vec3 = [eu.x, eu.y, eu.z].map((a) => (a * 180) / Math.PI) as Vec3;
  const arr = (v: Vector3): Vec3 => [v.x, v.y, v.z];
  if (trace) {
    const r = (x: number) => +(Math.abs(x) < 1e-12 ? 0 : x).toFixed(4);
    const v3 = (v: Vector3 | Vec3) => `(${(v instanceof Vector3 ? arr(v) : v).map(r).join(', ')})`;
    trace.step({ phase: 'Forward', label: `From the eye ${v3(e)} to the target ${v3(t)}: forward ${v3(forward)}`, detail: 'The camera looks down its own −z axis, so −z must point at the target: forward is the unit vector from the eye to it.', values: [['target − eye', v3(t.clone().sub(e))], ['forward', v3(forward)]], quiz: { prompt: `The camera stands at ${v3(e)} and looks at ${v3(t)}. What is forward (a unit vector)?`, answer: arr(forward), labels: ['x', 'y', 'z'], rule: '(target − eye), divided by its length.' } });
    trace.step({ phase: 'Right and up', label: `right = forward × (0, 1, 0) = ${v3(right)}; up = right × forward = ${v3(up)}`, detail: 'Keeping the camera upright: right is level (no y part), and up is at right angles to both (lesson 3.1).', values: [['right', v3(right)], ['up', v3(up)], ['back = −forward', v3(back)]] });
    const rows = [0, 1, 2].map((i) => `[${[0, 1, 2].map((j) => r(m.elements[j * 4 + i])).join('  ')}]`).join(' ');
    trace.step({ phase: 'Change of basis', label: `The rotation with right, up and back as its columns: ${rows}`, detail: 'A rotation\'s columns are where it sends the object\'s own x, y and z (lesson 2.6). So this is the turn that makes the camera\'s x point right, its y up and its z back: look-at is a change of basis.', values: [['R', rows]] });
    trace.step({
      phase: 'Rotation fields', label: `Decoded as XYZ Euler angles: (${rotationDeg.map(r).join('°, ')}°)`,
      detail: 'Lesson 2.7: y = asin(r13), then x and z by atan2. These are the numbers the Inspector\'s Rotation fields show for the camera.',
      values: [['rotation x, y, z', `${rotationDeg.map(r).join('°, ')}°`]],
      quiz: { prompt: `Decode the rotation into XYZ Euler angles. What is the Y rotation, in degrees (y = asin of row 1, column 3)?`, answer: [rotationDeg[1]], labels: ['y°'], rule: 'y = asin(r13), where r13 is the x part of the back axis.', tolerance: 0.2 },
    });
  }
  return { right: arr(right), up: arr(up), back: arr(back), rotationDeg };
}
