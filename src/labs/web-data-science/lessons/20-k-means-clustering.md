---
id: wds-20-k-means-clustering
title: Clustering with k-means
part: 6. Machine learning
summary: No labels this time: find the groups in the data itself. Watch k-means alternate between assigning points and moving centres until nothing changes.
js: async loops, sleeping, and cancelling work that is still running
height: 420
controls: [{"name":"k","label":"Number of clusters k","min":1,"max":7,"step":1,"value":3},{"name":"seed","label":"Starting centres (seed)","min":1,"max":30,"step":1,"value":1},{"name":"scale","label":"Features","options":["standardised (z-scores)","raw units"],"value":"standardised (z-scores)"},{"name":"delay","label":"Milliseconds per step","min":50,"max":1500,"step":50,"value":500}]
---

<!-- explore -->
```js
const rows = load('shoppers')
const std = params.scale.startsWith('standard')
const z = key => { const m = d3.mean(rows, d => d[key]), s = d3.deviation(rows, d => d[key]); return d => std ? (d[key] - m) / s : d[key] }
const fx = z('visits'), fy = z('basket')
const pts = rows.map(d => [fx(d), fy(d)])
const R = rng(params.seed)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let cancelled = false
onCleanup(() => { cancelled = true })

const left = Math.max(200, width - 220)
const { svg, g, h } = frame({ margin: { top: 30 } })
const w = left - 64
const x = d3.scaleLinear().domain(d3.extent(pts, p => p[0])).nice().range([0, w])
const y = d3.scaleLinear().domain(d3.extent(pts, p => p[1])).nice().range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x).ticks(6))
g.append('g').call(d3.axisLeft(y).ticks(6))
g.append('text').attr('x', w).attr('y', h - 6).attr('text-anchor', 'end').attr('fill', theme.muted).text('visits per month' + (std ? ' (z)' : ''))
g.append('text').attr('x', 6).attr('y', 10).attr('fill', theme.muted).text('basket size' + (std ? ' (z)' : ''))
const dots = g.selectAll('circle.pt').data(pts).join('circle').attr('class', 'pt').attr('cx', p => x(p[0])).attr('cy', p => y(p[1])).attr('r', 3).attr('fill', theme.muted)
const title = svg.append('text').attr('x', 48).attr('y', 20).attr('fill', theme.text).attr('font-weight', 600)
const color = i => theme.palette[i % theme.palette.length]

function kmeans(points, k, random) {
  let centres = d3.shuffle(points.slice(), random).slice(0, k).map(p => [...p])
  let assign = new Int32Array(points.length).fill(-1)
  const nearest = p => d3.minIndex(centres, c => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2)
  const inertia = () => d3.sum(points, (p, i) => (p[0] - centres[assign[i]][0]) ** 2 + (p[1] - centres[assign[i]][1]) ** 2)
  return { centres: () => centres, assign: () => assign, inertia, step() {
    const next = Int32Array.from(points, nearest)
    const changed = next.some((a, i) => a !== assign[i])
    assign = next
    centres = centres.map((c, j) => { const mine = points.filter((p, i) => assign[i] === j); return mine.length ? [d3.mean(mine, p => p[0]), d3.mean(mine, p => p[1])] : c })
    return changed
  } }
}
// Elbow: final inertia for k = 1..7 (side panel).
const elbow = d3.range(1, 8).map(k => { const m = kmeans(pts, k, rng(params.seed)); let i = 0; while (m.step() && i++ < 100); return [k, m.inertia()] })
const g2 = svg.append('g').attr('transform', 'translate(' + (left + 40) + ',40)')
const ex = d3.scaleLinear().domain([1, 7]).range([0, width - left - 60]), ey = d3.scaleLinear().domain([0, d3.max(elbow, d => d[1])]).range([h - 20, 0])
g2.append('text').attr('y', -14).attr('fill', theme.text).text('inertia by k (elbow)')
g2.append('g').attr('transform', 'translate(0,' + (h - 20) + ')').call(d3.axisBottom(ex).ticks(7))
g2.append('path').attr('fill', 'none').attr('stroke', theme.accent).attr('stroke-width', 2).attr('d', d3.line().x(d => ex(d[0])).y(d => ey(d[1]))(elbow))
g2.selectAll('circle').data(elbow).join('circle').attr('cx', d => ex(d[0])).attr('cy', d => ey(d[1])).attr('r', d => d[0] === params.k ? 6 : 3).attr('fill', d => d[0] === params.k ? theme.accent2 : theme.accent)

async function run() {
  const model = kmeans(pts, params.k, R)
  const trail = g.append('g')
  for (let it = 1; it <= 100; it++) {
    const before = model.centres()
    const changed = model.step()
    if (cancelled) return
    dots.transition().duration(params.delay * 0.6).attr('fill', (p, i) => color(model.assign()[i]))
    model.centres().forEach((c, j) => trail.append('line').attr('x1', x(before[j][0])).attr('y1', y(before[j][1])).attr('x2', x(c[0])).attr('y2', y(c[1])).attr('stroke', color(j)).attr('stroke-width', 2))
    trail.selectAll('path.c').data(model.centres()).join('path').attr('class', 'c')
      .attr('d', d3.symbol(d3.symbolCross, 160)).attr('transform', c => 'translate(' + x(c[0]) + ',' + y(c[1]) + ') rotate(45)')
      .attr('fill', (c, j) => color(j)).attr('stroke', theme.bg)
    title.text('iteration ' + it + (changed ? '' : ': converged') + '   inertia ' + model.inertia().toFixed(2))
    if (!changed) return
    await sleep(params.delay)
  }
}
run()
```

<!-- learn -->
Each iteration does two things, and you can watch both:

1. **Assign**: every point takes the colour of its nearest centre (the crosses).
2. **Update**: every centre moves to the mean of the points now assigned to it (the lines are its trail).

It repeats until no point changes colour. That's **k-means**, and it always stops, though not always at the best answer. Try different **seeds** with k = 5: you get different final clusterings, some clearly worse. Real implementations run k-means many times from different starts and keep the best.

**Clustering** is **unsupervised** learning: there are no labels to learn from, only structure to find. That makes judgement unavoidable:

- **Choosing k.** The **inertia** (the sum of squared distances to the assigned centres) always falls as k grows, so you can't just minimise it. The **elbow** chart shows where adding a cluster stops paying off. Here the bend is at 3.
- **Scaling matters.** Switch to **raw units**. Basket size is measured in pounds (up to ~150) and visits in single digits, so distance is basically basket size alone, and the clusters become horizontal slices. Standardising (z-scores: subtract the mean, divide by the SD) gives each feature an equal say. Distance-based methods need it.
- **k-means assumes round clusters** of similar size. It splits long or curved clusters badly (try it on the moons from lesson 19 sometime); density-based methods like DBSCAN handle those.

A clustering is a description, not a discovery of truth. Name the clusters by looking at what is in them ("frequent small-basket bargain hunters") and check they are useful.

<!-- javascript -->
The figure's animation is an **async loop**: a normal `for` loop that `await`s a pause between steps.

```js
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function run() {
  for (let it = 1; it <= 100; it++) {
    const changed = model.step()
    draw(model)
    if (!changed) return
    await sleep(500)     // the page stays responsive while we wait
  }
}
run()                    // started, not awaited: it runs in the background
```

This reads far more naturally than a chain of `setTimeout` callbacks. But it raises a new problem: **cancellation**. Move a slider while it runs and the lab starts a fresh run, but the old loop is still alive, waiting to wake up and draw into a chart that no longer exists.

Promises can't be stopped from outside, so the loop has to check:

```js
let cancelled = false
onCleanup(() => { cancelled = true })   // this lab calls it before the next run
// ... and inside the loop, after every await:
if (cancelled) return
```

In browser code generally, the standard tool is an `AbortController`: `controller.abort()` sets `controller.signal.aborted`, and `fetch(url, { signal })` actually stops the network request. Any long-running async work you start needs a way to stop it.

<!-- maths -->
k-means minimises the **within-cluster sum of squares** over assignments $c_i$ and centres $\mu_j$:

$$
J = \sum_{i=1}^{n} \lVert x_i - \mu_{c_i} \rVert^2
$$

It alternates two exact minimisations:

- with centres fixed, $J$ is minimised by assigning each point to its nearest centre;
- with assignments fixed, $J$ is minimised by setting each $\mu_j$ to the mean of its points (setting $\partial J/\partial \mu_j = -2\sum_{c_i = j}(x_i - \mu_j) = 0$).

Neither step can increase $J$, and there are finitely many assignments, so the algorithm must stop. But it stops at a **local** minimum: finding the global one is NP-hard in general. **k-means++** reduces the risk by choosing starting centres far apart: each new one is picked with probability proportional to its squared distance from the nearest centre chosen so far.

<!-- code -->
```js
const rows = load('shoppers')
const standardise = key => {
  const m = d3.mean(rows, d => d[key]), s = d3.deviation(rows, d => d[key])
  return rows.map(d => (d[key] - m) / s)
}
const vx = standardise('visits'), vy = standardise('basket')
const points = rows.map((d, i) => [vx[i], vy[i]])

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
let centres = points.slice(0, 3).map(p => [...p])   // start: the first three points

// Task: iterate assign → update until the assignments stop changing.
let assign = points.map(p => d3.minIndex(centres, c => dist2(p, c)))

const { g, w, h } = frame()
const x = d3.scaleLinear().domain(d3.extent(vx)).nice().range([0, w])
const y = d3.scaleLinear().domain(d3.extent(vy)).nice().range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
g.selectAll('circle').data(points).join('circle')
  .attr('cx', p => x(p[0])).attr('cy', p => y(p[1])).attr('r', 3).attr('fill', (p, i) => theme.palette[assign[i]])
return null
```

<!-- task -->
Finish k-means with k = 3, starting from the first three points (already done above):

1. In a loop: move each centre to the mean of its points, then reassign every point to its nearest centre.
2. Stop when no assignment changes. Log how many iterations it took.
3. Draw the final clusters and their centres.

**Return** the three cluster sizes sorted from smallest to largest. The data was generated from three segments of 100 shoppers each: how close do you get?

<!-- solution -->
```js
const rows = load('shoppers')
const standardise = key => {
  const m = d3.mean(rows, d => d[key]), s = d3.deviation(rows, d => d[key])
  return rows.map(d => (d[key] - m) / s)
}
const vx = standardise('visits'), vy = standardise('basket')
const points = rows.map((d, i) => [vx[i], vy[i]])
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
let centres = points.slice(0, 3).map(p => [...p])
let assign = points.map(p => d3.minIndex(centres, c => dist2(p, c)))

let iterations = 0
while (true) {
  iterations++
  centres = centres.map((c, j) => {
    const mine = points.filter((p, i) => assign[i] === j)
    return mine.length ? [d3.mean(mine, p => p[0]), d3.mean(mine, p => p[1])] : c
  })
  const next = points.map(p => d3.minIndex(centres, c => dist2(p, c)))
  const changed = next.some((a, i) => a !== assign[i])
  assign = next
  if (!changed) break
}
log('converged after', iterations, 'iterations')

const { g, w, h } = frame()
const x = d3.scaleLinear().domain(d3.extent(vx)).nice().range([0, w])
const y = d3.scaleLinear().domain(d3.extent(vy)).nice().range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
g.selectAll('circle').data(points).join('circle')
  .attr('cx', p => x(p[0])).attr('cy', p => y(p[1])).attr('r', 3).attr('fill', (p, i) => theme.palette[assign[i]])
g.selectAll('path').data(centres).join('path').attr('d', d3.symbol(d3.symbolCross, 200))
  .attr('transform', c => 'translate(' + x(c[0]) + ',' + y(c[1]) + ')').attr('fill', theme.text)

const sizes = d3.range(3).map(j => assign.filter(a => a === j).length)
return sizes.sort((a, b) => a - b)
```
