---
id: wds-23-linked-views
title: Brushing and linked views
part: 7. Building data apps
summary: Select points in one chart and see them in every other. Linked views turn a few simple charts into an exploration tool, held together by shared state and events.
js: EventTarget and custom events, publish/subscribe, debouncing
height: 440
controls: [{"name":"other","label":"Linked histogram shows","options":["sleep","prior","score"],"value":"sleep"},{"name":"mode","label":"Brush","options":["2D (x and y)","x only"],"value":"2D (x and y)"}]
---

<!-- explore -->
```js
const rows = load('students')
// Shared state, and an event bus that announces changes to it.
const bus = new EventTarget()
let selected = null
const select = s => { selected = s; bus.dispatchEvent(new CustomEvent('selection', { detail: s })) }

const svg = d3.select(el).append('svg').attr('width', width).attr('height', height)
const half = width / 2
const m = { l: 48, t: 40, b: 36 }
const pw = half - m.l - 24, ph = height - m.t - m.b

// View 1: scatter with a brush.
const g1 = svg.append('g').attr('transform', 'translate(' + m.l + ',' + m.t + ')')
const x = d3.scaleLinear().domain(d3.extent(rows, d => d.hours)).nice().range([0, pw])
const y = d3.scaleLinear().domain([0, 100]).range([ph, 0])
g1.append('g').attr('transform', 'translate(0,' + ph + ')').call(d3.axisBottom(x))
g1.append('g').call(d3.axisLeft(y))
g1.append('text').attr('y', -14).attr('fill', theme.text).attr('font-weight', 600).text('hours vs score: drag to select')
const dots = g1.append('g').selectAll('circle').data(rows).join('circle')
  .attr('cx', d => x(d.hours)).attr('cy', d => y(d.score)).attr('r', 3)
const brush = (params.mode.startsWith('2D') ? d3.brush() : d3.brushX()).extent([[0, 0], [pw, ph]])
  .on('start brush end', ({ selection: s }) => {
    if (!s) return select(null)
    const [[x0, y0], [x1, y1]] = params.mode.startsWith('2D') ? s : [[s[0], 0], [s[1], ph]]
    select(rows.filter(d => x(d.hours) >= x0 && x(d.hours) <= x1 && y(d.score) >= y0 && y(d.score) <= y1))
  })
g1.append('g').call(brush)

// View 2: histogram of another variable, all students vs the selection.
const key = params.other
const g2 = svg.append('g').attr('transform', 'translate(' + (half + m.l) + ',' + m.t + ')')
const x2 = d3.scaleLinear().domain(d3.extent(rows, d => d[key])).nice().range([0, pw])
const bin = d3.bin().value(d => d[key]).domain(x2.domain()).thresholds(16)
const all = bin(rows)
const y2 = d3.scaleLinear().domain([0, d3.max(all, b => b.length)]).nice().range([ph, 0])
g2.append('g').attr('transform', 'translate(0,' + ph + ')').call(d3.axisBottom(x2))
g2.append('g').call(d3.axisLeft(y2))
g2.selectAll('rect.all').data(all).join('rect').attr('class', 'all')
  .attr('x', b => x2(b.x0) + 1).attr('width', b => Math.max(0, x2(b.x1) - x2(b.x0) - 1))
  .attr('y', b => y2(b.length)).attr('height', b => ph - y2(b.length)).attr('fill', theme.grid)
const sel = g2.append('g')
const title2 = g2.append('text').attr('y', -14).attr('fill', theme.text).attr('font-weight', 600)

// Each view subscribes to the bus; neither knows the other exists.
bus.addEventListener('selection', ({ detail }) => {
  dots.attr('fill', d => !detail || detail.includes(d) ? theme.accent : theme.grid)
})
bus.addEventListener('selection', ({ detail }) => {
  const bins = bin(detail ?? [])
  sel.selectAll('rect').data(bins).join('rect')
    .attr('x', b => x2(b.x0) + 1).attr('width', b => Math.max(0, x2(b.x1) - x2(b.x0) - 1))
    .attr('y', b => y2(b.length)).attr('height', b => ph - y2(b.length)).attr('fill', theme.accent)
  title2.text(key + ': ' + (detail ? detail.length + ' selected, mean ' + (d3.mean(detail, d => d[key]) ?? NaN).toFixed(1) + ' vs all ' + d3.mean(rows, d => d[key]).toFixed(1) : 'all ' + rows.length + ' students'))
})
select(null)
```

<!-- learn -->
Drag a rectangle over the **high scorers** (top of the left chart) and look at the right-hand histogram: it highlights their sleep, prior scores or exam scores. Then move the rectangle to the low scorers and compare. Two plain charts, linked by a selection, become a tool for asking "what else is different about *these* students?". This is called **brushing and linking**.

`d3.brush()` adds a draggable selection rectangle and reports its extent in pixels; `d3.brushX()` selects a range along x only, the standard control for picking a time window on a time series. You convert the pixels back to data (or compare in pixel space, as the figure does) to find the selected rows.

The important part is the **architecture**:

- There is one piece of **shared state**: the current selection.
- Views don't talk to each other. They **subscribe** to changes of the state, and anything can **publish** a change.
- Adding a third view means adding one more subscriber. Nothing else changes.

This **publish/subscribe** pattern, also called an **event bus**, keeps a dashboard of five or ten linked charts manageable. Frameworks like React organise state the same way: one source of truth, with views re-rendering when it changes (lesson 27).

<!-- javascript -->
**`EventTarget`** is the browser's built-in event system, the same one DOM elements use, and you can make your own:

```js
const bus = new EventTarget()
bus.addEventListener('selection', (event) => log(event.detail))
bus.dispatchEvent(new CustomEvent('selection', { detail: [1, 2, 3] }))
```

`CustomEvent` carries any payload in `detail`.

**A store from scratch.** The same idea with a closure, and a function to unsubscribe:

```js
function createStore(initial) {
  let state = initial
  const listeners = new Set()
  return {
    getState: () => state,
    setState(patch) {
      state = { ...state, ...patch }           // immutable update
      listeners.forEach(fn => fn(state))
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)        // call this to unsubscribe
    },
  }
}
```

**Debouncing.** A brush fires dozens of events per second. If every one triggers expensive work (a query, a big redraw), wait until the events pause:

```js
function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
const onBrush = debounce(runQuery, 150)   // runs 150 ms after the last brush event
```

`timer` lives in the closure, shared by every call of the returned function. **Throttling** is the cousin: run at most once every `ms`, rather than only after a pause.

<!-- maths -->
Brushing is conditioning. The right-hand histogram shows the **conditional distribution** of the second variable given that the first two fall in the brushed region $S$:

$$
P(\text{sleep} \in B \mid (\text{hours}, \text{score}) \in S) = \frac{\#\{i : \text{sleep}_i \in B,\ (\text{hours}_i, \text{score}_i) \in S\}}{\#\{i : (\text{hours}_i, \text{score}_i) \in S\}}
$$

If the selected bars have the same *shape* as the grey ones, the variables look independent of the selection. A shift means they are associated. Be careful when the selection is small, though: with $n$ selected points, a sample proportion has standard error $\sqrt{p(1-p)/n}$, so shapes drawn from a dozen points are mostly noise.

<!-- code -->
```js
function createStore(initial) {
  let state = initial
  const listeners = new Set()
  return {
    getState: () => state,
    setState(patch) {
      // Task: merge the patch into a NEW state object, then notify every listener.
    },
    subscribe(fn) {
      listeners.add(fn)
      // Task: return a function that unsubscribes fn.
    },
  }
}

const store = createStore({ selection: [] })
const seen = []
const unsubscribe = store.subscribe(state => seen.push(state.selection.length))

store.setState({ selection: [1, 2] })
store.setState({ selection: [1, 2, 3, 4, 5] })
unsubscribe?.()
store.setState({ selection: [] })

log('listener saw:', seen)
return seen
```

<!-- task -->
Finish `createStore`. `setState` must build a **new** state object from the old state and the patch, then call every listener with it. `subscribe` must return a function that removes the listener.

With the script as written, the listener should be notified twice and then never again, so the code returns the selection sizes it saw: `[2, 5]`. As a bonus, add a `debounce` helper and log how many times a debounced listener fires when `setState` is called ten times in a row.

<!-- solution -->
```js
function createStore(initial) {
  let state = initial
  const listeners = new Set()
  return {
    getState: () => state,
    setState(patch) {
      state = { ...state, ...patch }
      listeners.forEach(fn => fn(state))
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}

const store = createStore({ selection: [] })
const seen = []
const unsubscribe = store.subscribe(state => seen.push(state.selection.length))

store.setState({ selection: [1, 2] })
store.setState({ selection: [1, 2, 3, 4, 5] })
unsubscribe?.()
store.setState({ selection: [] })

function debounce(fn, ms) {
  let timer
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms) }
}
let fired = 0
const off = store.subscribe(debounce(() => { fired++ }, 50))
for (let i = 0; i < 10; i++) store.setState({ selection: [i] })
await new Promise(resolve => setTimeout(resolve, 120))
off()
log('debounced listener fired', fired, 'time(s) for 10 updates')
return seen
```
