---
id: wds-21-pca-in-3d
title: PCA in 3D with three.js
part: 6. Machine learning
summary: Many columns, too many to plot. Rotate a 3D cloud with three.js, find the directions it spreads most along, and flatten it onto them without losing the story.
js: three.js scenes, BufferGeometry and Float32Array, and cleaning up GPU resources
height: 460
controls: [{"name":"flatten","label":"Flatten onto PC1–PC2 plane","min":0,"max":1,"step":0.05,"value":0},{"name":"axes","label":"Principal axes","options":["show","hide"],"value":"show"},{"name":"rotate","label":"Auto-rotate","options":["on","off"],"value":"on"}]
---

<!-- explore -->
```js
const rows = load('shoppers')
const keys = ['visits', 'basket', 'discount']
const stats = keys.map(k => [d3.mean(rows, d => d[k]), d3.deviation(rows, d => d[k])])
const Z = rows.map(d => keys.map((k, j) => (d[k] - stats[j][0]) / stats[j][1]))
const cov = math.divide(math.multiply(math.transpose(Z), Z), Z.length - 1)
const { eigenvectors } = math.eigs(cov)
const pcs = eigenvectors.map(e => ({ value: e.value, dir: e.vector })).sort((a, b) => b.value - a.value)
const normal = pcs[2].dir
const total = d3.sum(pcs, p => p.value)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
camera.position.set(5, 3.5, 6)
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
renderer.setSize(width, height)
el.appendChild(renderer.domElement)
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.autoRotate = params.rotate === 'on'
scene.add(new THREE.AmbientLight(0xffffff, 1.6))
const sun = new THREE.DirectionalLight(0xffffff, 1.8)
sun.position.set(3, 6, 4)
scene.add(sun)

// One small sphere per shopper, drawn in a single call with InstancedMesh.
const segments = ['bargain', 'weekly', 'occasional']
const sphere = new THREE.SphereGeometry(0.06, 12, 8)
const material = new THREE.MeshStandardMaterial({ roughness: 0.5 })
const mesh = new THREE.InstancedMesh(sphere, material, Z.length)
const m4 = new THREE.Matrix4()
Z.forEach((z, i) => {
  const along = z[0] * normal[0] + z[1] * normal[1] + z[2] * normal[2]
  const p = z.map((v, j) => v - params.flatten * along * normal[j])
  m4.makeTranslation(p[0], p[1], p[2])
  mesh.setMatrixAt(i, m4)
  mesh.setColorAt(i, new THREE.Color(theme.palette[segments.indexOf(rows[i].segment)]))
})
scene.add(mesh)

// Axes for the three original variables, and the principal axes as arrows.
const axisMat = new THREE.LineBasicMaterial({ color: theme.muted })
const axisGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([-3, 0, 0, 3, 0, 0, 0, -3, 0, 0, 3, 0, 0, 0, -3, 0, 0, 3]), 3))
scene.add(new THREE.LineSegments(axisGeo, axisMat))
const arrows = []
if (params.axes === 'show') pcs.forEach((pc, i) => {
  const a = new THREE.ArrowHelper(new THREE.Vector3(...pc.dir), new THREE.Vector3(0, 0, 0), 1 + 1.6 * Math.sqrt(pc.value), [0xef4444, 0x22c55e, 0xeab308][i], 0.25, 0.12)
  arrows.push(a)
  scene.add(a)
})

const label = d3.select(el).append('div').style('position', 'absolute').style('left', '12px').style('top', '10px')
  .style('font', '12px system-ui').style('color', theme.text).style('pointer-events', 'none')
label.html('x: visits · y: basket · z: discount (all z-scores). Drag to rotate, scroll to zoom.<br>' +
  segments.map((s, i) => '<span style="color:' + theme.palette[i] + '">●</span> ' + s).join('  ') + '<br>' +
  pcs.map((p, i) => ['red', 'green', 'yellow'][i] + ' PC' + (i + 1) + ': ' + d3.format('.1%')(p.value / total) + ' of variance').join(' · '))

animate(() => { controls.update(); renderer.render(scene, camera) })
onCleanup(() => {
  controls.dispose()
  sphere.dispose(); material.dispose(); mesh.dispose()
  axisGeo.dispose(); axisMat.dispose()
  arrows.forEach(a => a.dispose())
  renderer.dispose()
})
```

<!-- learn -->
Drag the cloud around. From some angles two of the shopper segments sit in front of each other and blur together; from others all three separate cleanly. The **red arrow** (PC1) points along the direction the cloud is longest, green (PC2) along the longest direction at right angles to red, and yellow (PC3) along what's left. Now slide **flatten** to 1: every point drops onto the plane of red and green. The cloud barely changes, because there was little spread along yellow to lose. Three dimensions became two, and the clusters survived.

That is **principal component analysis** (PCA):

- It finds new axes, the **principal components**: directions through the data ordered by how much variance they capture.
- Each component's share of the total variance (shown at the top) says how much of the picture it carries.
- Keeping the first two and plotting them gives the most informative flat view of high-dimensional data, at least in the sense of preserving variance.

Things to know before using it:

- **Standardise first** (as here). Otherwise the column with the biggest units dominates, just as with k-means.
- Components are **linear combinations** of the original columns, so they don't have units and may not have a clean meaning. Look at the weights (the eigenvector entries) to interpret them.
- PCA preserves **variance**, which is not always what separates groups. Techniques like t-SNE and UMAP preserve neighbourhoods instead, at the cost of distorting distances.

**About 3D charts.** 3D is the right tool here because you can *rotate* it: depth is ambiguous in any single still image. Static 3D bar and pie charts are almost always worse than 2D. Perspective makes near things big and far things small, and bars hide each other.

**three.js** is the standard library for 3D in the browser, built on WebGL (the GPU). Every scene has the same parts:

- a **scene** that holds objects and lights;
- a **camera** that says where you look from;
- a **renderer** that draws the scene from the camera into a `<canvas>`;
- **meshes**: a *geometry* (shape) plus a *material* (surface);
- and an animation loop that calls `renderer.render(scene, camera)` every frame.

<!-- javascript -->
**three.js** works with classes and objects you configure and connect:

```js
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)  // field of view, aspect, near, far
camera.position.set(5, 3, 6)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(width, height)
el.appendChild(renderer.domElement)        // the <canvas> it draws into
```

**Data goes to the GPU as typed arrays.** A point cloud is one `BufferGeometry` whose `position` attribute is a flat `Float32Array`, `[x0, y0, z0, x1, y1, z1, …]`, read three at a time:

```js
const positions = new Float32Array(points.length * 3)
points.forEach((p, i) => positions.set(p, i * 3))
const geometry = new THREE.BufferGeometry()
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.08, color: 0x38bdf8 })))
```

For thousands of identical shapes, `InstancedMesh` (used in the figure) draws one geometry many times in one GPU call, each with its own transformation matrix and colour.

**Cleaning up.** JavaScript's garbage collector frees ordinary objects, but **not GPU memory**. Geometries, materials, textures and renderers must be released explicitly with `.dispose()`, and event listeners (OrbitControls adds several) must be removed. Otherwise every re-run leaks a little, until the tab slows down or WebGL gives up. That is what the figure's `onCleanup` does. In a React app the same code goes in a `useEffect` cleanup function.

<!-- maths -->
Stack the standardised data as an $n \times p$ matrix $Z$. Its **covariance matrix** (here also the correlation matrix) is

$$
C = \frac{1}{n-1} Z^\top Z
$$

$C$ is symmetric, so it has real eigenvalues $\lambda_1 \ge \lambda_2 \ge \dots \ge \lambda_p \ge 0$ and orthogonal unit eigenvectors $v_1, \dots, v_p$:

$$
C v_k = \lambda_k v_k
$$

The variance of the data projected onto a unit direction $u$ is $u^\top C u$, and the direction that maximises it is $v_1$, with variance $\lambda_1$. Then $v_2$ maximises it among directions orthogonal to $v_1$, and so on. So:

- the **scores** (new coordinates) are $Z v_k$;
- the **explained variance ratio** of component $k$ is $\lambda_k / \sum_j \lambda_j$;
- the "flatten" slider moves each point $z$ to $z - t\,(z \cdot v_3)\,v_3$, removing (for $t = 1$) its component along the last eigenvector.

Numerically, PCA is usually computed with the singular value decomposition $Z = U \Sigma V^\top$, whose right singular vectors $V$ are the eigenvectors of $C$, without ever forming $C$.

<!-- code -->
```js
// A minimal three.js scene: the shoppers as a point cloud.
const rows = load('shoppers')
const keys = ['visits', 'basket', 'discount']
const z = key => { const m = d3.mean(rows, d => d[key]), s = d3.deviation(rows, d => d[key]); return d => (d[key] - m) / s }
const fs = keys.map(z)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
camera.position.set(5, 4, 6)
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setSize(width, height)
el.appendChild(renderer.domElement)
const controls = new OrbitControls(camera, renderer.domElement)

const positions = new Float32Array(rows.length * 3)
rows.forEach((d, i) => positions.set(fs.map(f => f(d)), i * 3))
const geometry = new THREE.BufferGeometry()
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
const material = new THREE.PointsMaterial({ size: 0.12, color: new THREE.Color(theme.accent) })
scene.add(new THREE.Points(geometry, material))

animate(() => renderer.render(scene, camera))
onCleanup(() => { controls.dispose(); geometry.dispose(); material.dispose(); renderer.dispose() })

// Task: PCA on four standardised columns, then a flat 2D view.
return null
```

<!-- task -->
Now do PCA yourself, on **four** columns: `visits`, `basket`, `discount` and `spend`.

1. Standardise each column, and build the 4 × 4 covariance matrix $C = Z^\top Z / (n - 1)$ with `math.transpose`, `math.multiply` and `math.divide`.
2. `math.eigs(C)` returns `{ eigenvectors: [{ value, vector }] }`, in ascending order of value.
3. Replace the 3D scene with a **2D d3 scatter** of the first two component scores (`Z · v₁` and `Z · v₂`), coloured by `segment`. (You can remove the three.js code: d3 is enough for a flat view.)

**Return** the four explained variance ratios, largest first, each rounded to 4 decimal places.

<!-- solution -->
```js
const rows = load('shoppers')
const keys = ['visits', 'basket', 'discount', 'spend']
const Z = rows.map(d => keys.map(k => d[k]))
keys.forEach((k, j) => {
  const m = d3.mean(Z, r => r[j]), s = d3.deviation(Z, r => r[j])
  Z.forEach(r => { r[j] = (r[j] - m) / s })
})
const C = math.divide(math.multiply(math.transpose(Z), Z), Z.length - 1)
const pcs = math.eigs(C).eigenvectors.map(e => ({ value: e.value, dir: e.vector })).sort((a, b) => b.value - a.value)
const total = d3.sum(pcs, p => p.value)
const ratios = pcs.map(p => Math.round(p.value / total * 10000) / 10000)
log('explained variance:', ratios)

const scores = Z.map(r => [d3.sum(r, (v, j) => v * pcs[0].dir[j]), d3.sum(r, (v, j) => v * pcs[1].dir[j])])
const segments = ['bargain', 'weekly', 'occasional']
const { g, w, h } = frame()
const x = d3.scaleLinear().domain(d3.extent(scores, s => s[0])).nice().range([0, w])
const y = d3.scaleLinear().domain(d3.extent(scores, s => s[1])).nice().range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
g.selectAll('circle').data(scores).join('circle')
  .attr('cx', s => x(s[0])).attr('cy', s => y(s[1])).attr('r', 3)
  .attr('fill', (s, i) => theme.palette[segments.indexOf(rows[i].segment)])
return ratios
```
