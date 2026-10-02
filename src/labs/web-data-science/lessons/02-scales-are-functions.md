---
id: wds-02-scales-are-functions
title: Scales are functions
part: 1. D3 from first principles
summary: A scale turns data units into pixels. It is just a function, and once you see that, axes, log charts and bubble sizes all follow.
js: closures, functions that return functions, method chaining
height: 300
controls: [{"name":"type","label":"Scale type","options":["linear","sqrt","log"],"value":"linear"},{"name":"domainMax","label":"Domain maximum","min":50,"max":300,"step":10,"value":100},{"name":"clamp","label":"Clamp to range","options":["off","on"],"value":"off"}]
---

<!-- explore -->
```js
const values = [1, 5, 10, 25, 50, 75, 100, 150]
const { g, w, h } = frame({ margin: { top: 40, bottom: 50, left: 30, right: 30 } })

const make = { linear: d3.scaleLinear, sqrt: d3.scaleSqrt, log: d3.scaleLog }[params.type]
const scale = make()
  .domain([params.type === 'log' ? 1 : 0, params.domainMax])
  .range([0, w])
  .clamp(params.clamp === 'on')

// Top: the data, evenly spaced. Bottom: where the scale puts each value.
const even = d3.scaleLinear().domain([0, 150]).range([0, w])
g.append('g').call(d3.axisTop(even).ticks(6))
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(scale).ticks(6, '~s'))
g.append('text').attr('y', -28).attr('fill', theme.muted).text('data value')
g.append('text').attr('y', h + 40).attr('fill', theme.muted).text('pixels: scale(value)')

g.selectAll('line.map').data(values).join('line')
  .attr('x1', d => even(d)).attr('y1', 0)
  .attr('x2', d => scale(d)).attr('y2', h)
  .attr('stroke', d => d > params.domainMax ? theme.bad : theme.accent)
  .attr('stroke-width', 1.5)
g.selectAll('circle').data(values).join('circle')
  .attr('cx', d => scale(d)).attr('cy', h).attr('r', 4)
  .attr('fill', d => d > params.domainMax ? theme.bad : theme.accent)
g.append('text').attr('x', w).attr('y', h / 2).attr('text-anchor', 'end').attr('fill', theme.bad)
  .text(values.some(d => d > params.domainMax) && params.clamp === 'off' ? 'red: outside the domain, drawn off the range' : '')
```

<!-- learn -->
Each line joins a data value (top) to the pixel the scale gives it (bottom). With a **linear** scale the lines stay parallel: equal steps in data become equal steps on screen. Switch to **sqrt** or **log** and small values get room while large ones are squeezed together. Lower the domain maximum below 150 and the red values fall off the right edge, unless you **clamp**.

A scale has two halves:

- the **domain**: the range of values in your data, e.g. `[0, 100]` exam points;
- the **range**: the pixels those values should land on, e.g. `[0, 600]`.

`d3.scaleLinear().domain([0, 100]).range([0, 600])` returns a **function**. Call it with a value and you get a pixel: `scale(50)` is `300`. Call `scale.invert(300)` and you get `50` back, which is how a mouse position becomes a data value later on.

For a vertical axis the range is usually flipped, `[height, 0]`, because SVG's `y` grows downward and bigger values should go up.

Three more scales cover most charts:

- `d3.scaleBand()` maps *categories* to evenly spaced bands, with a `bandwidth()` for bar width.
- `d3.scaleSqrt()` is for circle sizes: area should grow with the value, and area grows with the radius squared.
- `d3.scaleLog()` is for data that grows by multiplying (populations, prices). It cannot include 0.

Axes are drawn **from** scales: `d3.axisBottom(scale)` reads the domain and range and draws ticks and labels. `scale.nice()` rounds the domain out to round numbers so the axis ends on a tick.

<!-- javascript -->
**A function that returns a function.** `d3.scaleLinear()` returns a function that *remembers* its domain and range. That memory is a **closure**: a function keeps access to the variables that existed where it was created, even after the outer function has returned.

```js
function makeScale(d0, d1, r0, r1) {
  // d0, d1, r0, r1 live on inside the returned function
  return (x) => r0 + ((x - d0) / (d1 - d0)) * (r1 - r0)
}
const toPixels = makeScale(0, 100, 0, 600)
toPixels(50)   // 300
```

**Method chaining.** `d3.scaleLinear().domain([0, 1]).range([0, 600])` works because each setter changes the scale and then returns the scale itself, so the next method has something to be called on. You will build a chainable function yourself in lesson 6.

<!-- maths -->
A linear scale is the straight line through two points: $(d_0, r_0)$ and $(d_1, r_1)$.

$$
\text{scale}(x) = r_0 + \frac{x - d_0}{d_1 - d_0}\,(r_1 - r_0)
$$

The fraction $t = \frac{x - d_0}{d_1 - d_0}$ says how far along the domain $x$ is ($0$ at the start, $1$ at the end). The scale then goes the same fraction of the way along the range. Inverting it solves for $x$:

$$
x = d_0 + \frac{\text{px} - r_0}{r_1 - r_0}\,(d_1 - d_0)
$$

A **log** scale applies the same formula to $\log x$, so equal *ratios* get equal distances: $1 \to 10$ is as long as $10 \to 100$. A **sqrt** scale uses $\sqrt{x}$: a circle with radius $\propto \sqrt{x}$ has area $\pi r^2 \propto x$, so the eye reads the area in proportion to the value.

<!-- code -->
```js
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const rainfall = [84, 61, 66, 58, 55, 62, 56, 66, 68, 85, 89, 90]

const { g, w, h } = frame()
const x = d3.scaleBand().domain(months).range([0, w]).padding(0.2)
const y = d3.scaleLinear().domain([0, d3.max(rainfall)]).nice().range([h, 0])

g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))

g.selectAll('rect').data(rainfall).join('rect')
  .attr('x', (d, i) => x(months[i]))
  .attr('y', d => y(d))
  .attr('width', x.bandwidth())
  .attr('height', d => h - y(d))
  .attr('fill', theme.accent)

// Task: write makeScale(domain, range) without d3.
function makeScale([d0, d1], [r0, r1]) {
  return (x) => 0 // fix me
}
const s = makeScale([0, 40], [300, 0])
return [s(0), s(10), s(40)]
```

<!-- task -->
The chart above uses D3's scales. Below it, finish `makeScale` so it returns a linear scale **function**, built from the formula in the maths section (or your own reasoning). For the domain `[0, 40]` and the flipped range `[300, 0]`, the code returns `[s(0), s(10), s(40)]`, which should be `[300, 225, 0]`.

<!-- solution -->
```js
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const rainfall = [84, 61, 66, 58, 55, 62, 56, 66, 68, 85, 89, 90]

const { g, w, h } = frame()
const x = d3.scaleBand().domain(months).range([0, w]).padding(0.2)
const y = d3.scaleLinear().domain([0, d3.max(rainfall)]).nice().range([h, 0])

g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))

g.selectAll('rect').data(rainfall).join('rect')
  .attr('x', (d, i) => x(months[i]))
  .attr('y', d => y(d))
  .attr('width', x.bandwidth())
  .attr('height', d => h - y(d))
  .attr('fill', theme.accent)

function makeScale([d0, d1], [r0, r1]) {
  return (x) => r0 + ((x - d0) / (d1 - d0)) * (r1 - r0)
}
const s = makeScale([0, 40], [300, 0])
return [s(0), s(10), s(40)]
```
