---
id: wds-22-interaction
title: Tooltips, hover and zoom
part: 7. Building data apps
summary: Overview first, then zoom and filter, then details on demand. Make a chart answer questions when you point at it, and find the nearest point fast.
js: DOM events, pointer coordinates, and handlers that remove themselves
height: 440
controls: [{"name":"hover","label":"Tooltip finds","options":["nearest point (Delaunay)","only exact hits on a dot"],"value":"nearest point (Delaunay)"},{"name":"zoom","label":"Zoom and pan","options":["on","off"],"value":"on"},{"name":"r","label":"Dot radius","min":1,"max":8,"step":0.5,"value":3}]
---

<!-- explore -->
```js
const rows = load('students')
const groups = ['A', 'B', 'C']
const color = d3.scaleOrdinal(groups, theme.palette)
const { svg, g, w, h, margin } = frame({ margin: { right: 70, top: 20 } })
const x0 = d3.scaleLinear().domain(d3.extent(rows, d => d.hours)).nice().range([0, w])
const y0 = d3.scaleLinear().domain([0, 100]).range([h, 0])
let x = x0, y = y0
const gx = g.append('g').attr('transform', 'translate(0,' + h + ')')
const gy = g.append('g')
g.append('clipPath').attr('id', 'wds-zoom-clip').append('rect').attr('width', w).attr('height', h)
const plot = g.append('g').attr('clip-path', 'url(#wds-zoom-clip)')
const dots = plot.selectAll('circle').data(rows).join('circle').attr('r', params.r)
  .attr('fill', d => color(d.group)).attr('fill-opacity', 0.75).attr('stroke', theme.bg)
const ring = plot.append('circle').attr('r', params.r + 4).attr('fill', 'none').attr('stroke', theme.text).attr('stroke-width', 2).style('display', 'none')
const tip = d3.select(el).append('div').attr('class', 'wds-tip').style('display', 'none')
let delaunay
function draw() {
  gx.call(d3.axisBottom(x)); gy.call(d3.axisLeft(y))
  dots.attr('cx', d => x(d.hours)).attr('cy', d => y(d.score))
  delaunay = d3.Delaunay.from(rows, d => x(d.hours), d => y(d.score))
}
draw()
function show(d) {
  ring.style('display', null).attr('cx', x(d.hours)).attr('cy', y(d.score))
  tip.style('display', null).style('left', (margin.left + x(d.hours)) + 'px').style('top', (margin.top + y(d.score)) + 'px')
    .html('<b>Student ' + d.id + '</b> (group ' + d.group + ')<br>' + d.hours + ' h study, ' + d.sleep + ' h sleep<br>score <b>' + d.score + '</b>')
}
function hide() { ring.style('display', 'none'); tip.style('display', 'none') }
if (params.hover.startsWith('nearest')) {
  svg.on('pointermove', event => {
    const [px, py] = d3.pointer(event, g.node())
    if (px < 0 || py < 0 || px > w || py > h) return hide()
    show(rows[delaunay.find(px, py)])
  }).on('pointerleave', hide)
} else {
  dots.on('pointerenter', (event, d) => show(d)).on('pointerleave', hide)
}
if (params.zoom === 'on') {
  const zoom = d3.zoom().scaleExtent([1, 20]).translateExtent([[0, 0], [w, h]]).extent([[0, 0], [w, h]])
    .on('zoom', ({ transform }) => { x = transform.rescaleX(x0); y = transform.rescaleY(y0); draw() })
  svg.call(zoom).on('dblclick.zoom', () => svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity))
}
// Legend: hover a group to highlight it.
const legend = g.append('g').attr('transform', 'translate(' + (w + 16) + ',10)')
groups.forEach((k, i) => {
  const item = legend.append('g').attr('transform', 'translate(0,' + i * 22 + ')').style('cursor', 'pointer')
  item.append('circle').attr('r', 6).attr('fill', color(k))
  item.append('text').attr('x', 12).attr('y', 4).attr('fill', theme.text).text('group ' + k)
  item.on('pointerenter', () => dots.attr('fill-opacity', d => d.group === k ? 0.95 : 0.08))
      .on('pointerleave', () => dots.attr('fill-opacity', 0.75))
})
g.append('text').attr('x', w).attr('y', -6).attr('text-anchor', 'end').attr('fill', theme.muted).attr('font-size', 11)
  .text(params.zoom === 'on' ? 'scroll to zoom, drag to pan, double-click to reset' : '')
```

<!-- learn -->
Move the pointer over the chart. In **nearest point** mode the tooltip always shows the student closest to the pointer, so you never have to land on a 3-pixel dot. Switch to **only exact hits** and shrink the dots to see how frustrating precise targeting is. Scroll to zoom into the crowded middle, and hover the legend to pick out one group.

A good interactive chart follows Ben Shneiderman's mantra: **overview first, zoom and filter, then details on demand.**

- **Overview**: the static chart must already make sense. Interaction is for the reader's *next* question, not a substitute for a clear first view. Many readers never hover at all, and touch screens have no hover.
- **Zoom and filter**: `d3.zoom()` turns wheel and drag gestures (and pinch, on touch screens) into a **transform**: a scale k and a translation. `transform.rescaleX(x)` gives a new scale for the zoomed view, so you redraw with it and the axes follow. Rescaling (*semantic* zoom) keeps dots and text the same size. The alternative, scaling the whole SVG group (*geometric* zoom), makes everything bigger, including text and line widths.
- **Details on demand**: tooltips show exact values that would clutter the overview.

**Finding the nearest point.** Comparing the pointer with every point on each move takes time proportional to the number of points. `d3.Delaunay.from(points)` builds a **Delaunay triangulation** once, after which `delaunay.find(x, y)` returns the nearest point almost instantly, even for many thousands of points. Rebuild it when the positions change, as after a zoom.

<!-- javascript -->
**Events.** `selection.on('pointermove', handler)` adds a listener; the handler receives the **event** object and, for D3 selections, the element's datum:

```js
dots.on('pointerenter', (event, d) => show(d))
svg.on('pointermove', (event) => {
  const [px, py] = d3.pointer(event, g.node())   // pointer position in g's coordinate system
})
```

Use **pointer events** (`pointermove`, `pointerdown`…) rather than mouse events: one set of handlers covers mouse, touch and pen.

`d3.pointer(event, node)` converts the page coordinates into the coordinate system of `node`, including any `transform` on it. Without that, every margin and translate would be your problem.

**Arrow functions vs `function`.** Inside a `function` handler, `this` is the element the listener is on; in an arrow function, `this` is whatever it was outside. D3 code often uses `function (event, d) { d3.select(this)... }` for that reason.

**Namespaces and removing listeners.** `.on('pointermove.tooltip', fn)` names the listener so you can replace or remove just that one: `.on('pointermove.tooltip', null)`. In plain DOM code, `el.addEventListener(type, fn)` needs a matching `removeEventListener(type, fn)` with the *same* function, or an `AbortController`:

```js
const controller = new AbortController()
window.addEventListener('resize', onResize, { signal: controller.signal })
controller.abort()   // removes every listener registered with that signal
```

<!-- maths -->
The **Voronoi diagram** of a set of points divides the plane into cells: each point's cell is the region closer to it than to any other point. Hovering anywhere in a cell should show that cell's point, and that is exactly what nearest-point lookup computes.

The **Delaunay triangulation** is the Voronoi diagram's dual: two points are joined by an edge when their cells share a border. It can be built in $O(n \log n)$ time. To find the cell containing a query point, `find` walks across the triangulation from a starting point, always moving to a neighbour that is closer to the query. Starting from the previous answer, as with a moving pointer, the walk usually takes only a few steps, against $O(n)$ for checking every point.

<!-- code -->
```js
const rows = load('students')
const { svg, g, w, h, margin } = frame()
const x = d3.scaleLinear().domain(d3.extent(rows, d => d.hours)).nice().range([0, w])
const y = d3.scaleLinear().domain([0, 100]).range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
g.selectAll('circle').data(rows).join('circle')
  .attr('cx', d => x(d.hours)).attr('cy', d => y(d.score)).attr('r', 3).attr('fill', theme.accent)

// A tooltip element, positioned over the chart (class wds-tip is styled already).
const tip = d3.select(el).append('div').attr('class', 'wds-tip').style('display', 'none')

// Task: show the nearest student on hover, and find one programmatically.
return null
```

<!-- task -->
1. Build a `d3.Delaunay` from the students' **pixel** positions, and on `pointermove` over the SVG show the tooltip for the nearest student (use `d3.pointer(event, g.node())`, and add the margins back to position the tooltip). Hide it on `pointerleave`.
2. In **data units**, build a second Delaunay on `[hours, score]` and **return** the `id` of the student nearest to 5 hours and a score of 70.

The two answers can differ: why? (Think about what one unit of hours and one point of score are worth in pixels.)

<!-- solution -->
```js
const rows = load('students')
const { svg, g, w, h, margin } = frame()
const x = d3.scaleLinear().domain(d3.extent(rows, d => d.hours)).nice().range([0, w])
const y = d3.scaleLinear().domain([0, 100]).range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
g.selectAll('circle').data(rows).join('circle')
  .attr('cx', d => x(d.hours)).attr('cy', d => y(d.score)).attr('r', 3).attr('fill', theme.accent)
const tip = d3.select(el).append('div').attr('class', 'wds-tip').style('display', 'none')

const pixels = d3.Delaunay.from(rows, d => x(d.hours), d => y(d.score))
svg.on('pointermove', event => {
  const [px, py] = d3.pointer(event, g.node())
  const d = rows[pixels.find(px, py)]
  tip.style('display', null)
    .style('left', (margin.left + x(d.hours)) + 'px').style('top', (margin.top + y(d.score)) + 'px')
    .text('student ' + d.id + ': ' + d.hours + ' h, score ' + d.score)
}).on('pointerleave', () => tip.style('display', 'none'))

const dataSpace = d3.Delaunay.from(rows, d => d.hours, d => d.score)
return rows[dataSpace.find(5, 70)].id
```
