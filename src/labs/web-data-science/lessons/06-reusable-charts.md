---
id: wds-06-reusable-charts
title: Reusable charts and small multiples
part: 1. D3 from first principles
summary: Wrap a chart in a function and you can draw it many times, with different data and options. Small multiples, dashboards and every chart library are built this way.
js: closures as private state, default parameters, getter/setter functions
height: 420
controls: [{"name":"shared","label":"y axis","options":["shared by all","separate per chart"],"value":"shared by all"},{"name":"cols","label":"Columns","min":1,"max":4,"step":1,"value":3},{"name":"type","label":"Mark","options":["line","bars"],"value":"line"}]
---

<!-- explore -->
```js
// Six invented series: monthly visitors to six made-up parks.
const r = rng(21)
const parks = ['Ashdown', 'Birchwood', 'Cliffside', 'Dunmore', 'Elmhurst', 'Fernvale']
const series = parks.map((name, k) => ({
  name,
  values: Array.from({ length: 12 }, (_, m) => Math.max(0, (k === 2 ? 900 : 120 + k * 40) * (1 + 0.6 * Math.sin((m - 3) / 12 * 2 * Math.PI)) + r.normal(0, 25))),
}))

function sparkChart({ w = 200, h = 100, yMax = null, type = 'line', color = theme.accent } = {}) {
  return function draw(selection, { name, values }) {
    const x = d3.scaleLinear().domain([0, values.length - 1]).range([0, w])
    const y = d3.scaleLinear().domain([0, yMax ?? d3.max(values)]).nice().range([h, 0])
    selection.append('text').attr('y', -8).attr('font-weight', 600).attr('fill', theme.text).text(name)
    selection.append('g').call(d3.axisLeft(y).ticks(3, '~s'))
    if (type === 'line') {
      selection.append('path').attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2)
        .attr('d', d3.line().x((d, i) => x(i)).y(d => y(d))(values))
    } else {
      selection.selectAll('rect').data(values).join('rect').attr('fill', color)
        .attr('x', (d, i) => x(i) - w / 30).attr('width', w / 15).attr('y', d => y(d)).attr('height', d => h - y(d))
    }
  }
}
const cols = params.cols, rows = Math.ceil(series.length / cols)
const cellW = width / cols, cellH = height / rows
const chart = sparkChart({
  w: cellW - 70, h: cellH - 50, type: params.type,
  yMax: params.shared.startsWith('shared') ? d3.max(series, s => d3.max(s.values)) : null,
})
const svg = d3.select(el).append('svg').attr('width', width).attr('height', height)
series.forEach((s, i) => {
  const cell = svg.append('g').attr('transform', 'translate(' + ((i % cols) * cellW + 50) + ',' + (Math.floor(i / cols) * cellH + 28) + ')')
  chart(cell, s)
})
```

<!-- learn -->
Switch between a **shared** and a **separate** y axis. With a shared axis, one park clearly dwarfs the rest, and the others look flat. With separate axes, every chart fills its box: the seasonal *shape* of each park is easy to see, but Cliffside now looks no bigger than Ashdown. Neither is wrong. They answer different questions, and a chart should say on its axes which one it is answering.

**Small multiples** are the same chart repeated over subsets of the data. Because the design stays fixed, the eye compares the data instead of relearning the chart for each panel.

To draw a chart many times, put it in a function. A common D3 pattern has two layers:

1. a **configuration** function that takes options (size, colour, scale) and returns
2. a **draw** function that takes a place to draw and the data.

```js
const chart = sparkChart({ w: 200, h: 100 })   // configure once
chart(svg.append('g'), parkA)                     // draw many times
chart(svg.append('g'), parkB)
```

The figure's `sparkChart` works this way. So does `d3.axisBottom(scale)`: configure, then `.call()` it on a selection.

Libraries add **getter/setter** methods so options can change after creation: `chart.color('red')` sets, `chart.color()` gets. You'll write one in the task.

<!-- javascript -->
**Default parameters and destructuring together** give a function named options with defaults:

```js
function sparkChart({ w = 200, h = 100, color = 'steelblue' } = {}) { ... }
sparkChart({ h: 50 })   // w = 200, h = 50, color = 'steelblue'
sparkChart()            // the final `= {}` makes this work too
```

**Closures as private state.** The variables of an outer function live on in the functions it returns, and nothing else can reach them:

```js
function makeChart() {
  let color = 'steelblue'              // private
  function chart(selection, data) { /* uses color */ }
  chart.color = function (value) {     // functions are objects: add methods
    if (value === undefined) return color   // getter
    color = value
    return chart                       // return the chart so calls chain
  }
  return chart
}
const c = makeChart().color('tomato')
c.color()   // 'tomato'
```

Returning `chart` from the setter is what makes `makeChart().color('tomato').width(300)` chain, exactly like D3's own scales.

<!-- maths -->
A shared axis keeps **ratios** honest. With a common scale $y(v) = k v$, the heights of two bars satisfy $\frac{y(a)}{y(b)} = \frac{a}{b}$, so a bar twice as tall is twice the value, across panels.

With separate axes, each panel has its own $k_i = \frac{H}{\max_i}$, so heights become $\frac{y_i(a)}{y_j(b)} = \frac{a / \max_i}{b / \max_j}$. That compares each value with its own panel's peak: right for comparing **shapes**, wrong for comparing **sizes**.

<!-- code -->
```js
// A reusable bar chart with a getter/setter for colour.
function barChart() {
  let color = theme.accent
  let w = 180, h = 90

  function chart(selection, values) {
    const x = d3.scaleBand().domain(d3.range(values.length)).range([0, w]).padding(0.15)
    const y = d3.scaleLinear().domain([0, d3.max(values)]).range([h, 0])
    selection.selectAll('rect').data(values).join('rect')
      .attr('x', (d, i) => x(i)).attr('width', x.bandwidth())
      .attr('y', d => y(d)).attr('height', d => h - y(d))
      .attr('fill', color)
  }
  chart.color = function (value) {
    if (value === undefined) return color
    color = value
    return chart
  }
  return chart
}

const weeks = [[3, 5, 2, 8], [6, 1, 4, 4, 7], [2, 2, 9]]
const svg = d3.select(el).append('svg').attr('width', width).attr('height', height)
const chart = barChart()
chart(svg.append('g').attr('transform', 'translate(20,20)'), weeks[0])

// Task: draw every week as a small multiple.
return el.querySelectorAll('rect').length
```

<!-- task -->
1. Draw **all three** weeks side by side as small multiples, each in its own translated `g`. Use `forEach` with the index to space them out.
2. Give the chart a `width` getter/setter like `color` (getter with no argument, setter returns `chart`), and use it to make each panel 160 pixels wide.

The code returns how many bars are on screen, which should be one per value across all three weeks.

<!-- solution -->
```js
function barChart() {
  let color = theme.accent
  let w = 180, h = 90

  function chart(selection, values) {
    const x = d3.scaleBand().domain(d3.range(values.length)).range([0, w]).padding(0.15)
    const y = d3.scaleLinear().domain([0, d3.max(values)]).range([h, 0])
    selection.selectAll('rect').data(values).join('rect')
      .attr('x', (d, i) => x(i)).attr('width', x.bandwidth())
      .attr('y', d => y(d)).attr('height', d => h - y(d))
      .attr('fill', color)
  }
  chart.color = function (value) {
    if (value === undefined) return color
    color = value
    return chart
  }
  chart.width = function (value) {
    if (value === undefined) return w
    w = value
    return chart
  }
  return chart
}

const weeks = [[3, 5, 2, 8], [6, 1, 4, 4, 7], [2, 2, 9]]
const svg = d3.select(el).append('svg').attr('width', width).attr('height', height)
const chart = barChart().width(160)
weeks.forEach((values, i) => {
  chart(svg.append('g').attr('transform', 'translate(' + (20 + i * (chart.width() + 30)) + ',20)'), values)
})
return el.querySelectorAll('rect').length
```
