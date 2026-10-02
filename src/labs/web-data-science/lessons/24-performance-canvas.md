---
id: wds-24-performance-canvas
title: Big data in the browser, Canvas and quadtrees
part: 7. Building data apps
summary: SVG is lovely until you have 50,000 points. Learn when to switch to Canvas, how to keep it sharp, and how to find points under the pointer without checking them all.
js: requestAnimationFrame, measuring frames, and devicePixelRatio
height: 440
controls: [{"name":"n","label":"Number of points","min":1000,"max":50000,"step":1000,"value":5000},{"name":"renderer","label":"Draw with","options":["Canvas","SVG (one element per point)"],"value":"Canvas"},{"name":"alpha","label":"Point opacity","min":0.02,"max":1,"step":0.02,"value":0.3}]
---

<!-- explore -->
```js
const R = rng(8)
const n = params.renderer.startsWith('SVG') ? Math.min(params.n, 20000) : params.n
const pts = Array.from({ length: n }, (_, i) => {
  const c = i % 3
  return [R.normal([0.3, 0.6, 0.7][c], 0.12), R.normal([0.4, 0.7, 0.3][c], 0.1)]
})
const m = { l: 40, t: 40 }
const w = width - m.l - 20, h = height - m.t - 30
const x = d3.scaleLinear().domain([0, 1]).range([0, w]), y = d3.scaleLinear().domain([0, 1]).range([h, 0])
const t0 = performance.now()
let ctx = null
if (params.renderer === 'Canvas') {
  const dpr = window.devicePixelRatio || 1
  const canvas = d3.select(el).append('canvas').attr('width', w * dpr).attr('height', h * dpr)
    .style('width', w + 'px').style('height', h + 'px').style('position', 'absolute').style('left', m.l + 'px').style('top', m.t + 'px').node()
  ctx = canvas.getContext && canvas.getContext('2d')
  if (ctx) {
    ctx.scale(dpr, dpr)
    ctx.globalAlpha = params.alpha
    ctx.fillStyle = theme.accent
    for (const [px, py] of pts) { ctx.beginPath(); ctx.arc(x(px), y(py), 2, 0, 2 * Math.PI); ctx.fill() }
  }
}
const svg = d3.select(el).append('svg').attr('width', width).attr('height', height).style('position', 'absolute').style('left', 0).style('top', 0)
const g = svg.append('g').attr('transform', 'translate(' + m.l + ',' + m.t + ')')
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
if (params.renderer.startsWith('SVG')) g.append('g').selectAll('circle').data(pts).join('circle')
  .attr('cx', d => x(d[0])).attr('cy', d => y(d[1])).attr('r', 2).attr('fill', theme.accent).attr('fill-opacity', params.alpha)
const drawMs = performance.now() - t0
const title = svg.append('text').attr('x', m.l).attr('y', 18).attr('fill', theme.text).attr('font-weight', 600)
  .text(n.toLocaleString() + ' points, ' + params.renderer + ': first draw ' + drawMs.toFixed(0) + ' ms' + (n < params.n ? ' (SVG capped at 20,000)' : ''))
const status = svg.append('text').attr('x', m.l).attr('y', 34).attr('fill', theme.muted).attr('font-size', 12).text('hover: the quadtree finds the nearest point')

// Nearest point with a quadtree, in pixel space.
const qt = d3.quadtree().x(d => x(d[0])).y(d => y(d[1])).addAll(pts)
const ring = g.append('circle').attr('r', 6).attr('fill', 'none').attr('stroke', theme.accent2).attr('stroke-width', 2).style('display', 'none')
svg.on('pointermove', event => {
  const [px, py] = d3.pointer(event, g.node())
  const s = performance.now()
  const d = qt.find(px, py, 30)
  const us = (performance.now() - s) * 1000
  if (!d) { ring.style('display', 'none'); return }
  ring.style('display', null).attr('cx', x(d[0])).attr('cy', y(d[1]))
  status.text('nearest point (' + d[0].toFixed(3) + ', ' + d[1].toFixed(3) + ') found in ' + us.toFixed(0) + ' µs among ' + n.toLocaleString())
})
// Frame-rate meter: how smoothly can the page animate right now?
let frames = 0, last = performance.now()
animate(() => {
  frames++
  const now = performance.now()
  if (now - last > 1000) { title.text(title.text().split('  |')[0] + '  |  ' + frames + ' fps'); frames = 0; last = now }
})
```

<!-- learn -->
Switch between **Canvas** and **SVG** and compare the first-draw time. Then push the number of points up. SVG slows down in proportion to the number of points (that's why it is capped here), while Canvas stays quick. Turn the opacity down at 50,000 points: overlapping semi-transparent dots show **density**, revealing that the three blobs have dense cores that solid dots would have hidden. Hover anywhere: the quadtree finds the nearest of 50,000 points in microseconds.

**SVG** keeps one DOM element per mark. That's what makes it easy: each circle has events, CSS, transitions and accessibility attributes, and the browser redraws it for you. But every element costs memory and layout work. Past a few thousand marks, interaction gets sluggish.

**Canvas** is a bitmap you paint with commands. The browser forgets the shapes as soon as they are painted. It is fast because there is nothing to keep track of, and that is also the cost: no events per point, no CSS and nothing for a screen reader. To update, you clear and redraw everything; to find what's under the pointer, you need your own data structure.

**WebGL** (three.js, lesson 21) draws on the GPU: millions of points.

| Points | Use |
|---|---|
| up to ~2,000 | SVG: simplest, accessible, easy interactivity |
| ~2,000 to ~200,000 | Canvas, often with SVG on top for axes and highlights (as here) |
| more | WebGL, or aggregate first (bin into a heat map) |

Often the best answer to "too many points" is to **aggregate**: 50,000 dots carry less readable information than a 2D histogram (lesson 10, in two dimensions) or a density contour (`d3.contourDensity`).

A **quadtree** recursively splits the plane into four quadrants until each holds few points. A nearest-neighbour search then skips every quadrant that can't contain a closer point. `d3.quadtree` builds one in a single line; `find(x, y, radius)` searches it.

<!-- javascript -->
**`requestAnimationFrame(fn)`** asks the browser to call `fn` just before the next repaint, normally 60 times per second, paused when the tab is hidden. It is the right clock for anything visual, never `setInterval`. To keep a loop going, `fn` requests the next frame itself:

```js
function frame(time) {
  draw(time)
  id = requestAnimationFrame(frame)
}
let id = requestAnimationFrame(frame)
// later: cancelAnimationFrame(id)
```

At 60 fps you have about **16 ms per frame** for everything. Measure with `performance.now()` before and after. If drawing takes 40 ms, you get 25 fps, and the page feels it.

**Sharp canvas on high-DPI screens.** A canvas is a bitmap of `width × height` pixels; on a "retina" screen each CSS pixel is 2 or 3 device pixels, so a naively sized canvas looks blurry. Make the bitmap bigger and scale the drawing:

```js
const dpr = window.devicePixelRatio || 1
canvas.width = w * dpr; canvas.height = h * dpr          // the bitmap
canvas.style.width = w + 'px'; canvas.style.height = h + 'px'   // the size on screen
ctx.scale(dpr, dpr)    // now draw in CSS pixels as usual
```

**Batch canvas work.** Set `fillStyle` once, not per point, and draw many shapes before filling when they share a style. Each state change has a cost.

<!-- maths -->
Checking every point costs $O(n)$ per query. A quadtree over points spread evenly has depth about $\log_4 n$, so a typical query costs about $O(\log n)$ plus the handful of points near the answer. For $n = 50{,}000$, that is around 8 levels instead of 50,000 distance computations.

The search keeps the best distance found so far, $d^*$. A quadrant whose bounding box $[x_0, x_1] \times [y_0, y_1]$ is farther than $d^*$ from the query $(q_x, q_y)$ can be skipped whole. The distance from a point to a box is

$$
\operatorname{dist}(q, \text{box}) = \sqrt{\max(x_0 - q_x,\, 0,\, q_x - x_1)^2 + \max(y_0 - q_y,\, 0,\, q_y - y_1)^2}
$$

Visiting the nearest quadrants first makes $d^*$ small early, so most of the tree gets pruned.

<!-- code -->
```js
const random = rng(3)
const points = Array.from({ length: 10000 }, () => [random(), random()])
const centre = [0.5, 0.5], radius = 0.05

// Brute force: check every point.
let t = performance.now()
const brute = points.filter(([x, y]) => (x - centre[0]) ** 2 + (y - centre[1]) ** 2 <= radius ** 2).length
log('brute force:', brute, 'points in', (performance.now() - t).toFixed(2), 'ms')

const tree = d3.quadtree().addAll(points)

// Task: count the same points with tree.visit, skipping far-away quadrants.
let count = 0
return count
```

<!-- task -->
Use `tree.visit((node, x0, y0, x1, y1) => …)` to count the points within `radius` of `centre`. `visit` calls your function for each quadrant, top-down. A leaf node has no `length` property and holds a point in `node.data` (follow `node.next` for duplicates). Return `true` to **skip** a quadrant's children, which you should do when its box `[x0, x1] × [y0, y1]` is entirely farther than `radius` from the centre.

**Return** the count, which must equal the brute-force answer. Time both and log the times. Then plot the points on a canvas, highlighting the ones you found.

<!-- solution -->
```js
const random = rng(3)
const points = Array.from({ length: 10000 }, () => [random(), random()])
const centre = [0.5, 0.5], radius = 0.05
const [cx, cy] = centre

let t = performance.now()
const brute = points.filter(([x, y]) => (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2).length
log('brute force:', brute, 'in', (performance.now() - t).toFixed(2), 'ms')

const tree = d3.quadtree().addAll(points)
const found = []
t = performance.now()
tree.visit((node, x0, y0, x1, y1) => {
  if (!node.length) {
    let leaf = node
    do {
      const [x, y] = leaf.data
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) found.push(leaf.data)
    } while ((leaf = leaf.next))
  }
  const dx = Math.max(x0 - cx, 0, cx - x1), dy = Math.max(y0 - cy, 0, cy - y1)
  return dx * dx + dy * dy > radius * radius
})
log('quadtree:', found.length, 'in', (performance.now() - t).toFixed(2), 'ms')

const size = Math.min(width, height) - 20
const canvas = d3.select(el).append('canvas').attr('width', size).attr('height', size).node()
const ctx = canvas.getContext && canvas.getContext('2d')
if (ctx) {
  ctx.fillStyle = theme.muted
  for (const [x, y] of points) ctx.fillRect(x * size, (1 - y) * size, 1.5, 1.5)
  ctx.fillStyle = theme.accent2
  for (const [x, y] of found) ctx.fillRect(x * size - 1, (1 - y) * size - 1, 3, 3)
}
return found.length
```
