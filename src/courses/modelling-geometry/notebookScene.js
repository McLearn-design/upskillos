// Drawing for this course's notebook cells. A JSNotebook cell runs as a classic script in a sandboxed iframe,
// so three.js is loaded with a dynamic import() from jsDelivr (the same version as the app), and this code is
// appended to a cell: `show({ verts, faces })` draws a mesh with its normals.
//
// Faces whose normal points away from the mesh's centre are blue; faces whose normal points towards it are
// red, so a face wound the wrong way stands out. Each normal is an arrow from the face's centre. Drag to turn
// the model; it turns slowly by itself until you do.
//
// show({ verts, faces, edges: true }) draws the edge table instead: the faces plain and see-through, and each
// edge coloured by how many faces it is on: one (open) orange, two grey, three or more red.
//
// show({ verts, faces, groups }) colours each face by its group (groups[i] is face i's piece number), from a
// palette of eight colours, with no normals.

export const PICTURE = `
// ── drawing (you can leave this part alone) ─────────────────────────────────
function show({ verts, faces, normals = true, edges = false, groups = null }) {
    const PALETTE = [0x4f8fd9, 0xf59e0b, 0x10b981, 0xd946ef, 0xef4444, 0x14b8a6, 0xa3e635, 0x94a3b8];
  (async () => {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js');
    const w = Math.min(560, document.body.clientWidth || 560), h = 320;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.domElement.style.cssText = 'display: block; margin: 0 auto; cursor: grab';
    document.body.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(document.documentElement.classList.contains('dark') ? 0x0f1923 : 0xf1f5f9);
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(3.2, 2.6, 4.2);
    camera.lookAt(0, 0.5, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(3, 5, 4); scene.add(sun);
    const model = new THREE.Group(); scene.add(model);
    const centre = verts.reduce((a, v) => [a[0] + v[0] / verts.length, a[1] + v[1] / verts.length, a[2] + v[2] / verts.length], [0, 0, 0]);
    for (const [fi, f] of faces.entries()) {
      // Newell's normal (the right-hand rule round the corners, in order) and the face's centre.
      let n = [0, 0, 0], c = [0, 0, 0];
      f.forEach((k, i) => {
        const p = verts[k], q = verts[f[(i + 1) % f.length]];
        n = [n[0] + (p[1] - q[1]) * (p[2] + q[2]), n[1] + (p[2] - q[2]) * (p[0] + q[0]), n[2] + (p[0] - q[0]) * (p[1] + q[1])];
        c = [c[0] + p[0] / f.length, c[1] + p[1] / f.length, c[2] + p[2] / f.length];
      });
      const len = Math.hypot(...n) || 1, u = n.map((x) => x / len);
      const out = edges || u[0] * (c[0] - centre[0]) + u[1] * (c[1] - centre[1]) + u[2] * (c[2] - centre[2]) > 0;
      // The face as a fan of triangles, in the order given, so three.js sees the same winding.
      const pos = [];
      for (let i = 1; i + 1 < f.length; i++) for (const k of [f[0], f[i], f[i + 1]]) pos.push(...verts[k]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      model.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: groups ? PALETTE[groups[fi] % PALETTE.length] : edges ? 0x94a3b8 : out ? 0x4f8fd9 : 0xd94f4f, side: THREE.DoubleSide, flatShading: true, polygonOffset: true, polygonOffsetFactor: 1, transparent: edges, opacity: edges ? 0.55 : 1, depthWrite: !edges })));
      if (!edges) model.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x1e293b })));
      if (normals && !edges && !groups) model.add(new THREE.ArrowHelper(new THREE.Vector3(...u), new THREE.Vector3(...c), 0.7, out ? 0x1d4ed8 : 0xb91c1c, 0.18, 0.1));
    }
    if (edges) {
      // The edge table: each edge once, under its two vertex numbers smallest first, with how many faces it is on.
      const table = new Map();
      for (const f of faces) f.forEach((a, i) => { const b = f[(i + 1) % f.length], k = a < b ? a + '-' + b : b + '-' + a; table.set(k, (table.get(k) || 0) + 1); });
      const colour = (n) => (n === 1 ? 0xf59e0b : n === 2 ? 0x334155 : 0xdc2626);
      for (const [k, n] of table) {
        const [a, b] = k.split('-').map(Number);
        // A thin tube, not a line, so it is as thick as it looks in every browser.
        const p = new THREE.Vector3(...verts[a]), q = new THREE.Vector3(...verts[b]);
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(n === 2 ? 0.012 : 0.025, n === 2 ? 0.012 : 0.025, p.distanceTo(q), 8), new THREE.MeshBasicMaterial({ color: colour(n) }));
        tube.position.copy(p).add(q).multiplyScalar(0.5);
        tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.clone().sub(p).normalize());
        model.add(tube);
      }
    }
    // Fit the camera to the model: the same direction for every model, at a distance set by its size.
    const radius = Math.max(...verts.map((v) => Math.hypot(v[0] - centre[0], v[1] - centre[1], v[2] - centre[2])));
    camera.position.set(0.544, 0.442, 0.714).multiplyScalar(4.2 * radius).add(new THREE.Vector3(0, centre[1], 0));
    camera.lookAt(0, centre[1], 0);
    // Turn about the middle of the model, not about x = z = 0.
    for (const part of model.children) part.position.sub(new THREE.Vector3(centre[0], 0, centre[2]));
    let spin = true, drag = null;
    renderer.domElement.addEventListener('pointerdown', (e) => { spin = false; drag = e.clientX; });
    window.addEventListener('pointerup', () => { drag = null; });
    window.addEventListener('pointermove', (e) => { if (drag !== null) { model.rotation.y += (e.clientX - drag) * 0.01; drag = e.clientX; } });
    renderer.setAnimationLoop(() => { if (spin) model.rotation.y += 0.004; renderer.render(scene, camera); });
  })().catch((e) => console.error('The picture could not load three.js: ' + e.message));
}
`;

/** A cell's code with the drawing appended. */
export const withPicture = (code) => `${code}\n${PICTURE}`;
