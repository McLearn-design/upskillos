// @vitest-environment happy-dom
//
// Does MeshLab's scene setup actually work against the three.js version that is
// installed?
//
// WHY THIS EXISTS
//
// MeshLab shipped calling `transform.getHelper()`. That method was added in
// three r169, when TransformControls stopped being an Object3D and its gizmo
// moved to a separate object. This project is on 0.168.0, so the call threw and
// the lab failed to load with "transform.getHelper is not a function".
//
// Nothing caught it. TypeScript was happy, esbuild bundled it, and the lesson
// checkers do not look at labs. The failure only appears when the component
// mounts in a browser.
//
// So this reproduces the setup sequence headlessly. WebGLRenderer is left out
// deliberately - it needs a real WebGL context, and its API was never the
// problem. Everything that drifted between versions is here.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

const here = dirname(fileURLToPath(import.meta.url));
// The three.js code lives in the viewport and the file exporters now.
const source = ['render/Viewport.ts', 'render/io.ts'].map((f) => readFileSync(resolve(here, f), 'utf8')).join('\n');

describe('the installed three.js has everything MeshLab names', () => {
  it('exposes every THREE.X the component refers to', () => {
    const used = new Set<string>();
    for (const m of source.matchAll(/\bTHREE\.([A-Z][A-Za-z0-9_]*)/g)) used.add(m[1]);
    expect(used.size).toBeGreaterThan(5);

    const missing = [...used].filter((name) => !(name in THREE));
    expect(missing, `not in three ${THREE.REVISION}: ${missing.join(', ')}`).toEqual([]);
  });

  it('does not call getHelper() unguarded', () => {
    // The exact regression: a bare call with no check that the method exists.
    const calls = /\b\w+\.getHelper\(\)/.test(source);
    const guarded = /typeof\s+\w+\.getHelper\s*===\s*'function'/.test(source);
    expect(!calls || guarded, 'getHelper() is called without checking it exists').toBe(true);
  });
});

describe('the scene MeshLab builds, on the installed version', () => {
  it('constructs controls and puts the gizmo in the scene', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1.5, 0.1, 1000);
    camera.position.set(5, 4, 7);

    const canvas = document.createElement('canvas');

    const orbit = new OrbitControls(camera, canvas as unknown as HTMLElement);
    orbit.enableDamping = true;
    expect(orbit.enabled).toBe(true);

    const transform = new TransformControls(camera, canvas as unknown as HTMLElement);

    // The line that failed. Whichever API this version has, adding the gizmo
    // must work and must actually put something in the scene.
    const withHelper = transform as unknown as { getHelper?: () => THREE.Object3D };
    const gizmo: THREE.Object3D = typeof withHelper.getHelper === 'function'
      ? withHelper.getHelper()
      : (transform as unknown as THREE.Object3D);

    expect(gizmo).toBeInstanceOf(THREE.Object3D);
    const before = scene.children.length;
    scene.add(gizmo);
    expect(scene.children.length).toBe(before + 1);

    // And the modes the toolbar switches between have to be accepted.
    for (const mode of ['translate', 'rotate', 'scale'] as const) {
      transform.setMode(mode);
      expect(transform.mode).toBe(mode);
    }

    orbit.dispose();
    transform.dispose();
  });

  it('builds the starting objects, lights and helpers', () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a1a1a');

    scene.add(new THREE.AmbientLight(0x404060, 0.8));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(5, 8, 5);
    dir.castShadow = true;
    scene.add(dir);
    scene.add(new THREE.GridHelper(10, 10));
    scene.add(new THREE.AxesHelper(2));

    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.4, metalness: 0.3 }),
    );
    scene.add(cube);
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xff6644, roughness: 0.6 }),
    ));
    scene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(4, 4),
      new THREE.MeshStandardMaterial({ color: 0x44cc88, side: THREE.DoubleSide }),
    ));
    const point = new THREE.PointLight(0xffffff, 1, 10);
    point.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffff00 }),
    ));
    scene.add(point);

    expect(scene.children.length).toBe(8);

    // The selection outline, rebuilt on every selection change.
    const edges = new THREE.EdgesGeometry(cube.geometry);
    const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffff00 }));
    expect(outline.geometry.attributes.position.count).toBeGreaterThan(0);
  });

  it('raycasts against the scene the way picking does', () => {
    const scene = new THREE.Scene();
    const cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial());
    scene.add(cube);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(scene.children, true);

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].object).toBe(cube);
  });

  it('reads the transform matrix the inspector displays', () => {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    cube.rotation.y = Math.PI / 4;
    cube.updateMatrix();

    const e = cube.matrix.elements;
    expect(e.length).toBe(16);
    // A 45 degree turn about Y: cos and sin are both 0.7071, which is exactly
    // what the inspector's derivation panel claims.
    expect(e[0]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(e[8]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(e[2]).toBeCloseTo(-Math.SQRT1_2, 6);
  });
});
