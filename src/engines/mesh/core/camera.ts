// Cameras as scene objects: what a camera sees, and turning an object to face a point.
//
// A camera looks down its own −z axis with +y up, as in three.js and glTF. Its
// field of view is vertical, in degrees; the horizontal one follows from the
// image's aspect ratio. The pyramid it sees (the frustum) runs from the near
// plane to the far plane: at distance d the image rectangle is
// 2·d·tan(fov/2) high and aspect times as wide.

import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Vec3 } from './EditMesh';

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
