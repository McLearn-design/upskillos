---
id: wds-26-threejs-data-landscape
title: A 3D data landscape with three.js
part: 7. Building data apps
summary: Turn a year of daily sales into a city of bars you can fly around, with hover picking. Then build the 2D heat map that says the same thing more precisely, and learn when each is the right choice.
js: InstancedMesh, raycasting, and an object lifecycle
height: 480
controls: [{"name":"scale","label":"Bar height scale","min":0.2,"max":3,"step":0.1,"value":1},{"name":"colour","label":"Colour by","options":["sales","temperature","promotion"],"value":"sales"},{"name":"rotate","label":"Auto-rotate","options":["off","on"],"value":"off"}]
---

<!-- explore -->
```js
const cafe = load('cafe')
const week = d => d3.utcWeek.count(d3.utcYear(d.date), d.date)
const nWeeks = d3.max(cafe, week) + 1
const hScale = d3.scaleLinear().domain([0, d3.max(cafe, d => d.sales)]).range([0, 4 * params.scale])
const colourOf = {
  sales: d => d3.interpolateViridis((d.sales - 300) / 500),
  temperature: d => d3.interpolateRdYlBu(1 - (d.temp + 2) / 28),
  promotion: d => (d.promo ? theme.accent2 : theme.muted),
}[params.colour]

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 200)
camera.position.set(-2, 20, 36)
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
renderer.setSize(width, height)
el.appendChild(renderer.domElement)
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 1, 0)
controls.enableDamping = true
controls.autoRotate = params.rotate === 'on'
scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.5))
const sun = new THREE.DirectionalLight(0xffffff, 2)
sun.position.set(10, 20, 8)
scene.add(sun)

const box = new THREE.BoxGeometry(0.8, 1, 0.8)
box.translate(0, 0.5, 0)   // grow bars up from the floor, not out of the middle
const material = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.05 })
const bars = new THREE.InstancedMesh(box, material, cafe.length)
const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), quat = new THREE.Quaternion(), sc = new THREE.Vector3()
const baseColour = []
cafe.forEach((d, i) => {
  pos.set(week(d) - nWeeks / 2, 0, (d.date.getUTCDay() - 3) * 1.1)
  sc.set(1, Math.max(0.01, hScale(d.sales)), 1)
  bars.setMatrixAt(i, m4.compose(pos, quat, sc))
  baseColour[i] = new THREE.Color(colourOf(d))
  bars.setColorAt(i, baseColour[i])
})
scene.add(bars)
const floor = new THREE.Mesh(new THREE.PlaneGeometry(nWeeks + 2, 9), new THREE.MeshStandardMaterial({ color: theme.grid }))
floor.rotation.x = -Math.PI / 2
scene.add(floor)

// Picking: cast a ray from the camera through the pointer, see which bar it hits.
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2()
const tip = d3.select(el).append('div').attr('class', 'wds-tip').style('display', 'none').style('transform', 'translate(12px, -50%)')
let hovered = -1
const onMove = event => {
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObject(bars)[0]
  if (hovered >= 0) bars.setColorAt(hovered, baseColour[hovered])
  hovered = hit ? hit.instanceId : -1
  if (hovered >= 0) {
    bars.setColorAt(hovered, new THREE.Color(theme.bad))
    const d = cafe[hovered]
    tip.style('display', null).style('left', (event.clientX - rect.left) + 'px').style('top', (event.clientY - rect.top) + 'px')
      .html(d3.utcFormat('%a %d %b')(d.date) + '<br><b>' + d.sales + '</b> sales, ' + d.temp + ' °C' + (d.promo ? ', promotion' : ''))
  } else tip.style('display', 'none')
  bars.instanceColor.needsUpdate = true
}
renderer.domElement.addEventListener('pointermove', onMove)

d3.select(el).append('div').style('position', 'absolute').style('left', '12px').style('top', '10px').style('pointer-events', 'none')
  .style('font', '12px system-ui').style('color', theme.text)
  .text('Each bar is a day: weeks run left to right, weekdays front to back (Sun at the back). Drag to orbit, scroll to zoom, hover for details.')

animate(() => { controls.update(); renderer.render(scene, camera) })
onCleanup(() => {
  renderer.domElement.removeEventListener('pointermove', onMove)
  controls.dispose()
  box.dispose(); material.dispose(); bars.dispose()
  floor.geometry.dispose(); floor.material.dispose()
  renderer.dispose()
})
```

<!-- learn -->
Orbit the landscape. From above and in front you can see the weekend ridge running the length of the year, and the summer hill rising in the middle. Colour by **temperature** and the summer hill turns red. Colour by **promotion** and the scattered spikes light up pink. Hover a bar for its exact numbers.

Now try to answer: *was the third Tuesday in March higher or lower than the third Tuesday in May?* It's surprisingly hard. Bars hide each other, perspective shrinks the far ones, and there's no axis to read a height from. 3D gives a vivid **overview**, and it is poor at **precise comparison**. The task builds the 2D alternative, a **calendar heat map**, which makes that lookup easy and is printable.

When 3D is the right choice:

- The data really is spatial: terrain, buildings, molecules, a robot arm, a point cloud.
- Interaction is available, so the viewer can rotate (lesson 21).
- It is the **engagement** layer of a piece, with precise 2D views next to it.

Techniques in this scene that carry to any three.js data visualization:

- **InstancedMesh**: 365 bars, one draw call. Each instance gets a matrix (position, rotation, scale) and a colour.
- **Translate the geometry** so its origin is at the bottom: then scaling y grows a bar upward from the floor, the 3D version of SVG's flipped y axis.
- **Raycasting** for hover: a ray from the camera through the pointer, tested against the mesh. `instanceId` says which bar was hit.
- **Lights** make shape readable: a hemisphere light for soft ambient colour, a directional "sun" for shading.

<!-- javascript -->
**An object lifecycle.** Anything you create that holds resources outside JavaScript's garbage collector, such as GPU buffers, event listeners, timers, observers or animation frames, needs an explicit end. The figure follows a pattern worth copying in every visualization component:

```js
// create
const renderer = new THREE.WebGLRenderer()
const onMove = event => { /* ... */ }
renderer.domElement.addEventListener('pointermove', onMove)

// run
animate(() => renderer.render(scene, camera))

// destroy, in reverse order, releasing everything created above
onCleanup(() => {
  renderer.domElement.removeEventListener('pointermove', onMove)
  geometry.dispose(); material.dispose()
  renderer.dispose()
})
```

Keeping the handler in a named constant (`onMove`) is what makes it removable: `removeEventListener` needs the *same function object* that was added.

**Reusing objects in hot paths.** The figure allocates one `Matrix4`, `Vector3` and `Quaternion` and reuses them for all 365 bars instead of creating new objects in the loop. three.js methods like `m4.compose(pos, quat, scale)` write into an existing object and return it, for exactly this reason.

**Pointer to normalised device coordinates.** WebGL's screen runs from −1 to 1 in both directions, with y pointing *up*:

```js
const rect = canvas.getBoundingClientRect()
const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1
const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1
```

<!-- maths -->
A **perspective camera** projects a point at depth $z$ (distance along the view direction) onto the screen at

$$
x_{\text{screen}} = \frac{f\, x}{z}, \qquad y_{\text{screen}} = \frac{f\, y}{z}, \qquad f = \frac{1}{\tan(\text{fov}/2)}
$$

so apparent size falls off as $1/z$: a bar twice as far away looks half as tall. That is why heights can't be compared across a 3D chart unless the bars are the same distance from the camera.

Each instance is placed with a 4 × 4 **transformation matrix** $M = T\,R\,S$ (translate × rotate × scale, applied right to left to each vertex in homogeneous coordinates $(x, y, z, 1)$). Lesson 2's scales were 1D linear maps; this is the same idea in 3D, with translation folded in by the extra coordinate.

<!-- code -->
```js
const cafe = load('cafe')
const week = d => d3.utcWeek.count(d3.utcYear(d.date), d.date)
log('weeks:', d3.max(cafe, week) + 1, ' first day:', cafe[0].date.toISOString().slice(0, 10), 'is weekday', cafe[0].date.getUTCDay())

// A start on the calendar heat map: one square per day.
const cell = Math.min(16, (width - 60) / 54)
const svg = d3.select(el).append('svg').attr('width', width).attr('height', height)
const g = svg.append('g').attr('transform', 'translate(40,30)')
const color = d3.scaleSequential(d3.interpolateViridis).domain(d3.extent(cafe, d => d.sales))
g.selectAll('rect').data(cafe).join('rect')
  .attr('x', d => week(d) * cell).attr('y', 0)
  .attr('width', cell - 1).attr('height', cell - 1)
  .attr('fill', d => color(d.sales))

// Task: place each day by weekday, label it, and return the week × weekday matrix.
return null
```

<!-- task -->
Finish the **calendar heat map**: put each day in the row for its weekday (`getUTCDay()`, Sunday on top), label the rows Sun…Sat and the months along the top, add a colour legend, and show a tooltip (`wds-tip`) with the date and sales on hover.

**Return** the matrix behind it: an array with one entry per week (53 of them), each an array of 7 sales values indexed by weekday, with `null` for days outside 2025.

<!-- solution -->
```js
const cafe = load('cafe')
const week = d => d3.utcWeek.count(d3.utcYear(d.date), d.date)
const nWeeks = d3.max(cafe, week) + 1
const matrix = Array.from({ length: nWeeks }, () => Array(7).fill(null))
cafe.forEach(d => { matrix[week(d)][d.date.getUTCDay()] = d.sales })

const cell = Math.min(16, (width - 60) / 54)
const svg = d3.select(el).append('svg').attr('width', width).attr('height', height)
const g = svg.append('g').attr('transform', 'translate(40,40)')
const color = d3.scaleSequential(d3.interpolateViridis).domain(d3.extent(cafe, d => d.sales))
const tip = d3.select(el).append('div').attr('class', 'wds-tip').style('display', 'none')
g.selectAll('rect').data(cafe).join('rect')
  .attr('x', d => week(d) * cell).attr('y', d => d.date.getUTCDay() * cell)
  .attr('width', cell - 1).attr('height', cell - 1).attr('fill', d => color(d.sales))
  .on('pointerenter', (event, d) => tip.style('display', null)
    .style('left', (40 + week(d) * cell + cell / 2) + 'px').style('top', (40 + d.date.getUTCDay() * cell) + 'px')
    .text(d3.utcFormat('%a %d %b')(d.date) + ': ' + d.sales))
  .on('pointerleave', () => tip.style('display', 'none'))
g.selectAll('text.day').data(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).join('text').attr('class', 'day')
  .attr('x', -6).attr('y', (d, i) => i * cell + cell * 0.75).attr('text-anchor', 'end').attr('font-size', 10).attr('fill', theme.muted).text(d => d)
g.selectAll('text.month').data(d3.utcMonths(new Date(Date.UTC(2025, 0, 1)), new Date(Date.UTC(2026, 0, 1)))).join('text').attr('class', 'month')
  .attr('x', m => d3.utcWeek.count(d3.utcYear(m), m) * cell).attr('y', -8).attr('font-size', 10).attr('fill', theme.muted).text(d3.utcFormat('%b'))
const lg = g.append('g').attr('transform', 'translate(0,' + (7 * cell + 24) + ')')
const ticks = color.ticks(5)
ticks.forEach((t, i) => {
  lg.append('rect').attr('x', i * 60).attr('width', 58).attr('height', 10).attr('fill', color(t))
  lg.append('text').attr('x', i * 60).attr('y', 24).attr('font-size', 10).attr('fill', theme.text).text(t)
})
return matrix
```
