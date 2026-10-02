---
id: wds-05-lines-and-areas
title: Lines, areas and path generators
part: 1. D3 from first principles
summary: Lines and areas are a single SVG path. D3's generators write the path for you from an array, and the curve you pick changes what the chart claims.
js: Array.from, reduce, and building strings
height: 340
controls: [{"name":"n","label":"Data points","min":4,"max":60,"step":1,"value":14},{"name":"curve","label":"Curve","options":["linear","monotoneX","natural","basis","step"],"value":"linear"},{"name":"area","label":"Fill area","options":["no","yes"],"value":"no"},{"name":"gap","label":"Missing value at","min":-1,"max":59,"step":1,"value":-1}]
---

<!-- explore -->
```js
const r = rng(9)
// Invented readings: a smooth signal plus noise, one per step.
const data = Array.from({ length: params.n }, (_, i) => ({
  t: i,
  v: i === params.gap ? null : 50 + 30 * Math.sin(i / 3) + r.normal(0, 6),
}))
const { g, w, h } = frame()
const x = d3.scaleLinear().domain([0, params.n - 1]).range([0, w])
const y = d3.scaleLinear().domain([0, 100]).range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))

const curve = { linear: d3.curveLinear, monotoneX: d3.curveMonotoneX, natural: d3.curveNatural, basis: d3.curveBasis, step: d3.curveStep }[params.curve]
const defined = d => d.v != null
if (params.area === 'yes') {
  const area = d3.area().defined(defined).x(d => x(d.t)).y0(h).y1(d => y(d.v)).curve(curve)
  g.append('path').attr('d', area(data)).attr('fill', theme.accent).attr('fill-opacity', 0.2)
}
const line = d3.line().defined(defined).x(d => x(d.t)).y(d => y(d.v)).curve(curve)
g.append('path').attr('d', line(data)).attr('fill', 'none').attr('stroke', theme.accent).attr('stroke-width', 2)
g.selectAll('circle').data(data.filter(defined)).join('circle')
  .attr('cx', d => x(d.t)).attr('cy', d => y(d.v)).attr('r', 3).attr('fill', theme.accent2)
const d = line(data) || ''
g.append('text').attr('x', 4).attr('y', 12).attr('fill', theme.muted).attr('font-size', 11)
  .text('path d = "' + d.slice(0, 60) + (d.length > 60 ? '…' : '') + '"  (' + d.length + ' characters)')
```

<!-- learn -->
The pink dots are the data; the line is a **claim** about what happens between them. `linear` claims nothing beyond straight segments. `natural` and `basis` draw smooth curves: `basis` doesn't even pass through the points, and `natural` overshoots above and below the data near sharp turns. `monotoneX` is smooth but never invents a peak that isn't in the data, which is usually what you want for measurements. `step` says the value held until the next reading.

Set **Missing value at** to a point: with `.defined()`, the line breaks there instead of pretending to know the value.

SVG draws lines and areas as a `path` element, whose `d` attribute is a little drawing language: `M10,20` moves the pen, `L30,40` draws a line, `C` draws a curve. You never need to write it by hand: `d3.line()` is a **path generator**, a function that turns an array into that string.

```js
const line = d3.line().x(d => x(d.t)).y(d => y(d.v))
path.attr('d', line(data))
```

Note the difference from bars: a bar chart joins *one element per datum*, but a line is *one element for the whole array*. So you call `line(data)` once instead of using `selectAll().data().join()`.

`d3.area()` is the same idea with two y accessors: `y0` for the bottom edge and `y1` for the top. Point `y0` at a second series and you get a **band**, for example a range of uncertainty around an estimate.

<!-- javascript -->
**Making data with `Array.from`.** `Array.from({ length: 5 }, (_, i) => i * i)` gives `[0, 1, 4, 9, 16]`. The first argument says how long the array is; the function receives `(value, index)`, and the `_` means "a parameter I'm ignoring". This is the standard way to generate data for testing a chart.

**`reduce`** walks an array carrying an **accumulator**, the running result:

```js
[3, 5, 2].reduce((total, d) => total + d, 0)              // 10
// A running total needs the accumulator to be an array:
[3, 5, 2].reduce((acc, d) => [...acc, (acc.at(-1) ?? 0) + d], [])   // [3, 8, 10]
```

The second argument (`0`, `[]`) is the starting value. Always pass it: without it, `reduce` starts with the first item, which fails on an empty array.

`acc.at(-1)` is the last item; `?? 0` means "or 0 if that is null or undefined", which handles the first step.

<!-- maths -->
Curves are built from cubic **Bézier** segments, which SVG draws natively with `C`:

$$
B(t) = (1-t)^3 P_0 + 3(1-t)^2 t\, P_1 + 3(1-t) t^2\, P_2 + t^3 P_3, \quad t \in [0, 1]
$$

The curve starts at $P_0$, ends at $P_3$ and is pulled toward the control points $P_1, P_2$. Curve types differ in how they choose control points. **Natural** cubic splines make the second derivative continuous, which is smooth but can overshoot. **Monotone** cubic interpolation (Fritsch–Carlson) limits the slopes so that between two points the curve never goes above the higher one or below the lower one.

<!-- code -->
```js
// Invented daily sign-ups for a new website, 30 days.
const r = rng(12)
const daily = Array.from({ length: 30 }, (_, i) => Math.round(20 + i * 1.5 + r.normal(0, 8)))

const { g, w, h } = frame()
const x = d3.scaleLinear().domain([0, daily.length - 1]).range([0, w])
const y = d3.scaleLinear().domain([0, d3.max(daily)]).nice().range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))

const line = d3.line().x((d, i) => x(i)).y(d => y(d)).curve(d3.curveMonotoneX)
g.append('path').attr('d', line(daily)).attr('fill', 'none').attr('stroke', theme.accent).attr('stroke-width', 2)

// Task: the running total of sign-ups, day by day.
const cumulative = []
return cumulative
```

<!-- task -->
Build `cumulative`, the **running total** of `daily` (day 0's value, then day 0 + day 1, and so on), with `reduce` or a loop. Draw it as a filled `d3.area()` on its own y scale, in place of the daily line, and **return** the `cumulative` array.

<!-- solution -->
```js
const r = rng(12)
const daily = Array.from({ length: 30 }, (_, i) => Math.round(20 + i * 1.5 + r.normal(0, 8)))

const cumulative = daily.reduce((acc, d) => [...acc, (acc.at(-1) ?? 0) + d], [])

const { g, w, h } = frame()
const x = d3.scaleLinear().domain([0, daily.length - 1]).range([0, w])
const y = d3.scaleLinear().domain([0, d3.max(cumulative)]).nice().range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))

const area = d3.area().x((d, i) => x(i)).y0(h).y1(d => y(d)).curve(d3.curveMonotoneX)
g.append('path').attr('d', area(cumulative)).attr('fill', theme.accent).attr('fill-opacity', 0.3)
  .attr('stroke', theme.accent)
return cumulative
```
