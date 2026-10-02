---
id: wds-12-correlation
title: Relationships and correlation
part: 3. Relationships and models
summary: A scatter plot shows how two variables move together; the correlation coefficient squeezes that into one number. Learn what the number can and cannot see.
js: flatMap and building nested data
height: 380
controls: [{"name":"r","label":"Target correlation","min":-1,"max":1,"step":0.05,"value":0.6},{"name":"n","label":"Points","min":5,"max":400,"step":5,"value":120},{"name":"shape","label":"Data shape","options":["straight line","curve (U shape)","one outlier","two clusters"],"value":"straight line"}]
---

<!-- explore -->
```js
const R = rng(77)
let pts = Array.from({ length: params.n }, () => {
  const a = R.normal(), b = R.normal()
  return [a, params.r * a + Math.sqrt(1 - params.r ** 2) * b]
})
if (params.shape.startsWith('curve')) pts = pts.map(([a]) => [a, a * a + R.normal(0, 0.3)])
if (params.shape.startsWith('one')) pts = [...pts.map(([a]) => [a, R.normal(0, 1)]), [6, 6]]
if (params.shape.startsWith('two')) pts = pts.map(([a, b], i) => i % 2 ? [a * 0.4 - 2, b * 0.4 - 2] : [a * 0.4 + 2, b * 0.4 + 2])

const pearson = (xs, ys) => {
  const mx = d3.mean(xs), my = d3.mean(ys)
  const cov = d3.sum(xs, (x, i) => (x - mx) * (ys[i] - my))
  return cov / Math.sqrt(d3.sum(xs, x => (x - mx) ** 2) * d3.sum(ys, y => (y - my) ** 2))
}
const ranks = vs => { const order = d3.range(vs.length).sort((i, j) => vs[i] - vs[j]); const r = []; order.forEach((i, k) => r[i] = k); return r }
const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
const r = pearson(xs, ys), rho = pearson(ranks(xs), ranks(ys))

const { g, w, h } = frame({ margin: { top: 30 } })
const x = d3.scaleLinear().domain(d3.extent(xs)).nice().range([0, w])
const y = d3.scaleLinear().domain(d3.extent(ys)).nice().range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
const mx = d3.mean(xs), my = d3.mean(ys)
g.append('line').attr('x1', x(mx)).attr('x2', x(mx)).attr('y1', 0).attr('y2', h).attr('stroke', theme.grid).attr('stroke-dasharray', 4)
g.append('line').attr('y1', y(my)).attr('y2', y(my)).attr('x1', 0).attr('x2', w).attr('stroke', theme.grid).attr('stroke-dasharray', 4)
g.selectAll('circle').data(pts).join('circle').attr('cx', d => x(d[0])).attr('cy', d => y(d[1])).attr('r', 3)
  .attr('fill', d => (d[0] - mx) * (d[1] - my) > 0 ? theme.accent : theme.accent2).attr('fill-opacity', 0.7)
g.append('text').attr('y', -10).attr('fill', theme.text).attr('font-weight', 600)
  .text('Pearson r = ' + r.toFixed(3) + '    Spearman ρ = ' + rho.toFixed(3))
```

<!-- learn -->
Blue points are in the quadrants where both variables are above their means, or both below; pink points are where one is above and the other below. **Pearson's r** is essentially blue minus pink, weighted by distance from the centre. Slide the target to 0 and the colours balance; to −1 and pink wins.

Now try the other shapes:

- **Curve (U shape)**: a perfect, strong relationship, and r is close to **0**. r only measures *straight-line* association.
- **One outlier**: 120 unrelated points plus one far away give a respectable r. A single point manufactured it.
- **Two clusters**: no relationship *within* either cluster, yet r is near 1, because the clusters differ.

**Spearman's ρ** is Pearson's r computed on the **ranks** instead of the values. It measures whether y tends to go up when x goes up, in a straight line or not, and it shrugs off outliers. Compare the two on each shape.

So: always plot first, then compute. And **correlation is not causation**. Hours studied and exam score are correlated in the students data. That fits "studying raises scores", but also "keen students both study and score well", and r cannot tell those apart. Experiments (lesson 17) can.

A **correlation matrix** shows r for every pair of columns at once, drawn as a heat map. It is a quick map of a new dataset, as long as you remember everything above.

<!-- javascript -->
**`flatMap`** maps each item to an *array* and joins the results into one flat array. It is the natural tool for "every pair":

```js
const cols = ['hours', 'sleep', 'score']
const pairs = cols.flatMap(a => cols.map(b => ({ a, b })))
// 9 objects: {a:'hours',b:'hours'}, {a:'hours',b:'sleep'}, ...
```

With plain `map` you would get an array of arrays instead. `d3.cross(cols, cols)` builds the same pairs as `[a, b]` arrays.

A **matrix** in JavaScript is an array of row arrays. `matrix[i][j]` is row `i`, column `j`:

```js
const matrix = cols.map(a => cols.map(b => corr(a, b)))
```

For drawing, flatten it into one object per cell (with `flatMap`) so a single `selectAll('rect').data(cells)` draws the whole heat map.

<!-- maths -->
For paired values $(x_i, y_i)$ with means $\bar{x}, \bar{y}$:

$$
r = \frac{\sum_i (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum_i (x_i - \bar{x})^2}\,\sqrt{\sum_i (y_i - \bar{y})^2}}
$$

The numerator is (up to a factor of $n-1$) the **covariance**: each term is positive in the blue quadrants and negative in the pink ones. Dividing by the spreads makes $r$ unit-free and confines it to $[-1, 1]$; that it can't exceed 1 follows from the Cauchy–Schwarz inequality.

Equivalently, $r$ is the average product of **z-scores**, $z = (x - \bar{x})/s$:

$$
r = \frac{1}{n-1}\sum_i z_{x,i}\, z_{y,i}
$$

$r^2$ is the fraction of the variance in $y$ that a straight line in $x$ explains, which links this lesson to the next.

<!-- code -->
```js
const students = load('students')
const cols = ['hours', 'sleep', 'prior', 'score']

function corr(a, b) {
  const xs = students.map(d => d[a]), ys = students.map(d => d[b])
  const mx = d3.mean(xs), my = d3.mean(ys)
  const num = d3.sum(xs, (x, i) => (x - mx) * (ys[i] - my))
  return num / Math.sqrt(d3.sum(xs, x => (x - mx) ** 2) * d3.sum(ys, y => (y - my) ** 2))
}
log('r(hours, score) =', corr('hours', 'score'))

// A scatter of hours against score.
const { g, w, h } = frame()
const x = d3.scaleLinear().domain(d3.extent(students, d => d.hours)).nice().range([0, w])
const y = d3.scaleLinear().domain([0, 100]).range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
g.selectAll('circle').data(students).join('circle')
  .attr('cx', d => x(d.hours)).attr('cy', d => y(d.score)).attr('r', 3).attr('fill', theme.accent)

// Task: the full correlation matrix, drawn as a heat map.
return []
```

<!-- task -->
Replace the scatter with a **correlation heat map**: a 4 × 4 grid of squares, one per pair of `cols`, coloured with `d3.scaleSequential(d3.interpolateRdBu).domain([-1, 1])`, and with r printed in each square.

**Return** the matrix as an array of 4 rows of 4 numbers, `matrix[i][j] = corr(cols[i], cols[j])`, each rounded to 3 decimal places.

<!-- solution -->
```js
const students = load('students')
const cols = ['hours', 'sleep', 'prior', 'score']

function corr(a, b) {
  const xs = students.map(d => d[a]), ys = students.map(d => d[b])
  const mx = d3.mean(xs), my = d3.mean(ys)
  const num = d3.sum(xs, (x, i) => (x - mx) * (ys[i] - my))
  return num / Math.sqrt(d3.sum(xs, x => (x - mx) ** 2) * d3.sum(ys, y => (y - my) ** 2))
}
const round3 = v => Math.round(v * 1000) / 1000
const matrix = cols.map(a => cols.map(b => round3(corr(a, b))))
const cells = cols.flatMap((a, i) => cols.map((b, j) => ({ a, b, r: matrix[i][j] })))

const { g, w, h } = frame({ margin: { left: 60, bottom: 40 } })
const size = Math.min(w, h)
const band = d3.scaleBand().domain(cols).range([0, size]).padding(0.04)
const color = d3.scaleSequential(d3.interpolateRdBu).domain([-1, 1])
g.append('g').attr('transform', 'translate(0,' + size + ')').call(d3.axisBottom(band))
g.append('g').call(d3.axisLeft(band))
g.selectAll('rect').data(cells).join('rect')
  .attr('x', d => band(d.a)).attr('y', d => band(d.b))
  .attr('width', band.bandwidth()).attr('height', band.bandwidth()).attr('fill', d => color(d.r))
g.selectAll('text.r').data(cells).join('text').attr('class', 'r')
  .attr('x', d => band(d.a) + band.bandwidth() / 2).attr('y', d => band(d.b) + band.bandwidth() / 2 + 4)
  .attr('text-anchor', 'middle').attr('fill', d => Math.abs(d.r) > 0.6 ? '#fff' : '#111').text(d => d.r.toFixed(2))
return matrix
```
