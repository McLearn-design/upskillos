---
id: wds-10-distributions
title: Distributions, histograms and density
part: 2. Working with real data
summary: The shape of the data matters more than any single number. Histograms and density curves show it, and the bin width decides what story they tell.
js: higher-order functions, functions that build functions
height: 360
controls: [{"name":"column","label":"Variable","options":["score","hours","sleep","prior"],"value":"score"},{"name":"bins","label":"Number of bins","min":2,"max":60,"step":1,"value":12},{"name":"bw","label":"Density bandwidth","min":0.2,"max":15,"step":0.2,"value":4},{"name":"view","label":"Show","options":["histogram + density","histogram","density","ECDF"],"value":"histogram + density"}]
---

<!-- explore -->
```js
const values = load('students').map(d => d[params.column])
const [lo, hi] = d3.extent(values)
const pad = (hi - lo) * 0.08
const { g, w, h } = frame({ margin: { top: 24 } })
const x = d3.scaleLinear().domain([lo - pad, hi + pad]).range([0, w])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('text').attr('x', w).attr('y', h - 6).attr('text-anchor', 'end').attr('fill', theme.muted).text(params.column)

if (params.view === 'ECDF') {
  const sorted = [...values].sort(d3.ascending)
  const y = d3.scaleLinear().domain([0, 1]).range([h, 0])
  g.append('g').call(d3.axisLeft(y).tickFormat(d3.format('.0%')))
  g.append('path').attr('fill', 'none').attr('stroke', theme.accent).attr('stroke-width', 2)
    .attr('d', d3.line().curve(d3.curveStepAfter).x(d => x(d[0])).y(d => y(d[1]))(sorted.map((v, i) => [v, (i + 1) / sorted.length])))
  g.append('text').attr('y', -8).attr('fill', theme.text).text('Fraction of students at or below each value')
} else {
  const bins = d3.bin().domain(x.domain()).thresholds(params.bins)(values)
  // d3 puts bin edges on round numbers, so the end bins can be slivers:
  // divide each count by its own bin's width, not one shared width.
  const dens = b => b.length / values.length / (b.x1 - b.x0)
  // Density in "per unit" so histogram and curve share an axis.
  const kernel = u => Math.abs(u) <= 1 ? 0.75 * (1 - u * u) : 0
  const kde = t => d3.mean(values, v => kernel((t - v) / params.bw)) / params.bw
  const grid = d3.ticks(x.domain()[0], x.domain()[1], 200)
  const density = grid.map(t => [t, kde(t)])
  const yMax = Math.max(d3.max(bins, dens), d3.max(density, d => d[1]))
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([h, 0])
  g.append('g').call(d3.axisLeft(y).ticks(5))
  if (params.view !== 'density') g.selectAll('rect').data(bins).join('rect')
    .attr('x', b => x(b.x0) + 1).attr('width', b => Math.max(0, x(b.x1) - x(b.x0) - 1))
    .attr('y', b => y(dens(b))).attr('height', b => h - y(dens(b)))
    .attr('fill', theme.accent).attr('fill-opacity', 0.5)
  if (params.view !== 'histogram') g.append('path').attr('fill', 'none').attr('stroke', theme.accent2).attr('stroke-width', 2.5)
    .attr('d', d3.line().x(d => x(d[0])).y(d => y(d[1]))(density))
  g.append('text').attr('y', -8).attr('fill', theme.text).text(bins.length + ' bins, ' + d3.format('.3~f')(d3.max(bins, b => b.x1 - b.x0)) + ' wide (end bins may be cut short)')
}
g.selectAll('line.rug').data(values).join('line').attr('class', 'rug')
  .attr('x1', d => x(d)).attr('x2', d => x(d)).attr('y1', h).attr('y2', h - 6).attr('stroke', theme.text).attr('stroke-opacity', 0.3)
```

<!-- learn -->
Drag the bins down to 2 and the scores look like a single lump. Drag them up to 60 and they become noise. Somewhere between is a useful picture, and **there is no single correct bin width**. Try the same with the density bandwidth: too small and every student gets a spike, too large and real features are smoothed away.

A **distribution** says how often each value occurs. Look for:

- **centre** and **spread** (lesson 9);
- **shape**: symmetric, or **skewed** (a long tail on one side); one peak or several (**modes**). Two peaks often mean two groups mixed together;
- **gaps** and **outliers**.

Three standard views:

- A **histogram** cuts the range into bins and draws one bar per bin. `d3.bin()` does the counting: each bin it returns is an array of the values in it, with `x0` and `x1` for its edges. Bars must touch, and the y axis must start at zero.
- A **kernel density estimate** (KDE) puts a small bump on each value and adds them up. The **bandwidth** is the bump's width. It is a smooth histogram without bin edges, but it can spill past the data's real limits.
- The **empirical cumulative distribution function** (ECDF) plots, for each value, the fraction of the data at or below it. It needs no bins and no bandwidth at all, so nothing is hidden. Its drawback is that it is harder to read at a glance.

The little ticks along the bottom (a **rug**) show every individual value. Adding one to any distribution chart is a cheap way to keep an honest view of the raw data.

<!-- javascript -->
A **higher-order function** takes or returns a function. You have used them since lesson 1 (`map`, `filter`, accessors). Now write one.

A kernel density estimate is naturally built as a function that returns a function:

```js
function kde(kernel, bandwidth, values) {
  return (t) => d3.mean(values, v => kernel((t - v) / bandwidth)) / bandwidth
}
const epanechnikov = u => Math.abs(u) <= 1 ? 0.75 * (1 - u * u) : 0
const density = kde(epanechnikov, 4, scores)   // a function of t
density(70)                                    // the estimated density at 70
```

The kernel itself is a parameter, so swapping in a Gaussian bump is one argument. D3's own API works the same way: `d3.bin().thresholds(20)` *returns a binning function*, which you then call on data.

<!-- maths -->
A histogram with bin width $b$ estimates the **density** in a bin as

$$
\hat{f}(x) = \frac{\text{count in the bin}}{n\,b}
$$

so the bar areas sum to 1. That is what the figure plots, which is why the histogram and the curve can share an axis.

The kernel density estimate with kernel $K$ and bandwidth $h$ is

$$
\hat{f}_h(t) = \frac{1}{n h} \sum_{i=1}^{n} K\!\left(\frac{t - x_i}{h}\right),
\qquad K(u) = \tfrac{3}{4}(1 - u^2) \text{ for } |u| \le 1
$$

($K$ here is the Epanechnikov kernel). A common starting bandwidth is **Silverman's rule of thumb**:

$$
h \approx 0.9\, \min\!\left(s, \tfrac{\text{IQR}}{1.34}\right) n^{-1/5}
$$

The bandwidth trades **bias** (too smooth, features erased) against **variance** (too wiggly, noise shown as features). The same trade-off reappears in lesson 14.

<!-- code -->
```js
const scores = load('students').map(d => d.score)

const { g, w, h } = frame()
const x = d3.scaleLinear().domain([0, 100]).range([0, w])
const bins = d3.bin().domain([0, 100]).thresholds(5)(scores)
const y = d3.scaleLinear().domain([0, d3.max(bins, b => b.length)]).nice().range([h, 0])

g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
g.selectAll('rect').data(bins).join('rect')
  .attr('x', b => x(b.x0) + 1).attr('width', b => x(b.x1) - x(b.x0) - 1)
  .attr('y', b => y(b.length)).attr('height', b => h - y(b.length))
  .attr('fill', theme.accent)

// Task: ten bins of width 10, and their counts.
return bins.map(b => b.length)
```

<!-- task -->
`thresholds(5)` is only a *suggestion*: d3 picks "nice" edges near it. Pass an explicit array of the edges *between* bins instead, `[10, 20, …, 90]` (`d3.range` can build it), so that with the domain `[0, 100]` there are exactly **ten bins of width 10**. Then label each bar with its count. The code returns the counts.

<!-- solution -->
```js
const scores = load('students').map(d => d.score)

const { g, w, h } = frame()
const x = d3.scaleLinear().domain([0, 100]).range([0, w])
const bins = d3.bin().domain([0, 100]).thresholds(d3.range(10, 100, 10))(scores)
const y = d3.scaleLinear().domain([0, d3.max(bins, b => b.length)]).nice().range([h, 0])

g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
g.selectAll('rect').data(bins).join('rect')
  .attr('x', b => x(b.x0) + 1).attr('width', b => x(b.x1) - x(b.x0) - 1)
  .attr('y', b => y(b.length)).attr('height', b => h - y(b.length))
  .attr('fill', theme.accent)
g.selectAll('text.count').data(bins).join('text').attr('class', 'count')
  .attr('x', b => (x(b.x0) + x(b.x1)) / 2).attr('y', b => y(b.length) - 4)
  .attr('text-anchor', 'middle').attr('fill', theme.text).text(b => b.length)

return bins.map(b => b.length)
```
