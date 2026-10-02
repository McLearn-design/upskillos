---
id: wds-27-capstone-dashboard
title: Capstone: an interactive dashboard
part: 7. Building data apps
summary: Put it all together: loading, cleaning, aggregation, linked charts, brushing, accessibility and a state store, organised the way real data apps are.
js: application state, derived data and pure selectors, rendering from state
height: 620
controls: [{"name":"promo","label":"Days included","options":["all days","promotion days only","normal days only"],"value":"all days"},{"name":"metric","label":"Scatter x axis","options":["temp","day of year"],"value":"temp"}]
---

<!-- explore -->
```js
const rows = load('cafe')
// ── State: one object, changed only through setState. ─────────────────────
let state = { range: null, promo: params.promo, hoverDay: null }
const listeners = []
const setState = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn(state)) }
const subscribe = fn => { listeners.push(fn); fn(state) }

// ── Selectors: pure functions from state to the data each view needs. ─────
const byPromo = s => rows.filter(d => s.promo === 'all days' || (s.promo.startsWith('promotion') ? d.promo : !d.promo))
const inRange = s => byPromo(s).filter(d => !s.range || (d.date >= s.range[0] && d.date <= s.range[1]))
const kpis = s => { const v = inRange(s); return { days: v.length, total: d3.sum(v, d => d.sales), mean: d3.mean(v, d => d.sales), best: d3.greatest(v, d => d.sales) } }
const weekdays = s => { const m = d3.rollup(inRange(s), v => d3.mean(v, d => d.sales), d => d.date.getUTCDay()); return d3.range(7).map(i => ({ day: i, mean: m.get(i) ?? 0 })) }

// ── Layout ───────────────────────────────────────────────────────────────
const root = d3.select(el).style('display', 'grid').style('grid-template-rows', '74px 1fr 1fr').style('gap', '8px').style('padding', '8px')
const tiles = root.append('div').style('display', 'grid').style('grid-template-columns', 'repeat(4, 1fr)').style('gap', '8px')
const tile = label => {
  const t = tiles.append('div').style('border', '1px solid ' + theme.grid).style('border-radius', '8px').style('padding', '8px 10px')
  t.append('div').style('font-size', '11px').style('color', theme.muted).text(label)
  return t.append('div').style('font-size', '20px').style('font-weight', '700').style('color', theme.text)
}
const tDays = tile('Days selected'), tTotal = tile('Total sales'), tMean = tile('Mean per day'), tBest = tile('Best day')
const fmt = d3.format(',.0f'), dateFmt = d3.utcFormat('%a %d %b')
subscribe(s => { const k = kpis(s); tDays.text(k.days); tTotal.text(fmt(k.total)); tMean.text(k.days ? fmt(k.mean) : '–'); tBest.text(k.best ? dateFmt(k.best.date) + ' (' + k.best.sales + ')' : '–') })

const panel = (parent, title) => {
  const div = parent.append('div').style('position', 'relative').style('border', '1px solid ' + theme.grid).style('border-radius', '8px').style('min-height', '0')
  div.append('div').style('position', 'absolute').style('left', '10px').style('top', '6px').style('font-size', '12px').style('font-weight', '600').style('color', theme.text).text(title)
  return div
}
const ph = (height - 74 - 40) / 2
const row2 = root.append('div').style('display', 'grid')
const row3 = root.append('div').style('display', 'grid').style('grid-template-columns', '1fr 1fr').style('gap', '8px')

// ── View 1: the year, with a brush to choose a date range. ────────────────
{
  const W = width - 16, m = { l: 46, r: 12, t: 26, b: 22 }, iw = W - m.l - m.r, ih = ph - m.t - m.b
  const svg = panel(row2, 'Daily sales: drag to select a date range').append('svg').attr('width', W).attr('height', ph)
    .attr('role', 'img').attr('aria-label', 'Daily café sales through 2025')
  const g = svg.append('g').attr('transform', 'translate(' + m.l + ',' + m.t + ')')
  const x = d3.scaleUtc().domain(d3.extent(rows, d => d.date)).range([0, iw])
  const y = d3.scaleLinear().domain([0, d3.max(rows, d => d.sales)]).nice().range([ih, 0])
  g.append('g').attr('transform', 'translate(0,' + ih + ')').call(d3.axisBottom(x).ticks(Math.max(2, iw / 80)))
  g.append('g').call(d3.axisLeft(y).ticks(4, '~s'))
  const line = g.append('path').attr('fill', 'none').attr('stroke-width', 1.5)
  const sel = g.append('path').attr('fill', 'none').attr('stroke', theme.accent).attr('stroke-width', 1.5)
  const marker = g.append('circle').attr('r', 5).attr('fill', theme.accent2).style('display', 'none')
  g.append('g').call(d3.brushX().extent([[0, 0], [iw, ih]]).on('brush end', ({ selection }) =>
    setState({ range: selection ? selection.map(x.invert) : null })))
  const path = d3.line().defined(d => d.sales != null).x(d => x(d.date)).y(d => y(d.sales))
  subscribe(s => {
    const visible = new Set(inRange(s))
    line.attr('stroke', theme.grid).attr('d', path(byPromo(s)))
    sel.attr('d', path(byPromo(s).map(d => visible.has(d) ? d : { ...d, sales: null })))
    const hd = s.hoverDay
    marker.style('display', hd ? null : 'none').attr('cx', hd ? x(hd.date) : 0).attr('cy', hd ? y(hd.sales) : 0)
  })
}

// ── View 2: mean by weekday for the selection. ──────────────────────────
{
  const W = (width - 24) / 2, m = { l: 46, r: 10, t: 26, b: 22 }, iw = W - m.l - m.r, ih = ph - m.t - m.b
  const svg = panel(row3, 'Mean sales by weekday (selection)').append('svg').attr('width', W).attr('height', ph)
  const g = svg.append('g').attr('transform', 'translate(' + m.l + ',' + m.t + ')')
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const x = d3.scaleBand().domain(d3.range(7)).range([0, iw]).padding(0.2)
  const y = d3.scaleLinear().domain([0, d3.max(rows, d => d.sales)]).nice().range([ih, 0])
  g.append('g').attr('transform', 'translate(0,' + ih + ')').call(d3.axisBottom(x).tickFormat(i => names[i]))
  g.append('g').call(d3.axisLeft(y).ticks(4, '~s'))
  const bars = g.append('g')
  subscribe(s => bars.selectAll('rect').data(weekdays(s), d => d.day).join('rect')
    .attr('x', d => x(d.day)).attr('width', x.bandwidth()).attr('fill', theme.accent)
    .transition().duration(250).attr('y', d => y(d.mean)).attr('height', d => ih - y(d.mean)))
}

// ── View 3: what drives sales? ────────────────────────────────────────────
{
  const W = (width - 24) / 2, m = { l: 46, r: 10, t: 26, b: 22 }, iw = W - m.l - m.r, ih = ph - m.t - m.b
  const svg = panel(row3, (params.metric === 'temp' ? 'Temperature' : 'Day of year') + ' vs sales: hover a point').append('svg').attr('width', W).attr('height', ph)
  const g = svg.append('g').attr('transform', 'translate(' + m.l + ',' + m.t + ')')
  const fx = params.metric === 'temp' ? d => d.temp : d => d3.utcDay.count(d3.utcYear(d.date), d.date)
  const x = d3.scaleLinear().domain(d3.extent(rows, fx)).nice().range([0, iw])
  const y = d3.scaleLinear().domain([0, d3.max(rows, d => d.sales)]).nice().range([ih, 0])
  g.append('g').attr('transform', 'translate(0,' + ih + ')').call(d3.axisBottom(x).ticks(5))
  g.append('g').call(d3.axisLeft(y).ticks(4, '~s'))
  const dots = g.append('g')
  let shown = []
  subscribe(s => {
    const visible = new Set(inRange(s))
    shown = byPromo(s)
    dots.selectAll('circle').data(shown).join('circle').attr('cx', d => x(fx(d))).attr('cy', d => y(d.sales)).attr('r', 2.5)
      .attr('fill', d => d === s.hoverDay ? theme.accent2 : visible.has(d) ? theme.accent : theme.grid)
      .attr('fill-opacity', d => visible.has(d) ? 0.85 : 0.5)
  })
  svg.on('pointermove', event => {
    const [px, py] = d3.pointer(event, g.node())
    const nearest = d3.least(shown, d => (x(fx(d)) - px) ** 2 + (y(d.sales) - py) ** 2)
    if (nearest !== state.hoverDay) setState({ hoverDay: nearest })
  }).on('pointerleave', () => setState({ hoverDay: null }))
}
```

<!-- learn -->
Brush a range on the top chart, say the summer. All four KPI tiles, the weekday bars and the scatter update together. Hover the scatter and the same day lights up on the timeline. Switch **days included** to promotion days only and everything re-derives from the smaller set. It's three charts and four numbers, but it already answers real questions: *Are summer weekends better than winter weekends? Do promotions work equally on every weekday?*

The code behind it is organised the way real data apps are, and that organisation matters more than any single chart:

1. **One state object** holds everything the user has chosen: the date range, the filter, the hovered day. Nothing else is stored anywhere.
2. **State changes only through `setState`**, which creates a new state and notifies subscribers.
3. **Selectors** are pure functions that derive what each view needs from the data and the state (`inRange`, `kpis`, `weekdays`). They contain the data logic, and they are trivial to test.
4. **Views** subscribe and redraw from state. They never talk to each other: the brush sets `range`, the scatter sets `hoverDay`, and whoever cares re-renders.

This is **unidirectional data flow**: user event → `setState` → selectors → views. It is the architecture of React, Vue and Svelte apps, and of Redux-style stores. Once a dashboard grows past a few charts, it is the difference between code you can change and code you are afraid to touch.

**Where to go from here**: the lab's Explore figures are all readable code (open "How is this built?"), and the patterns repeat. For larger projects:

- **Observable Plot** for quick, good-looking standard charts, built on d3;
- **React or Svelte** for the app around the charts, with d3 for scales and shapes and the framework owning the DOM;
- **Apache Arrow and DuckDB-Wasm** for millions of rows queried in the browser;
- **Web Workers** to move heavy computation off the main thread so the interface never freezes.

<!-- javascript -->
**State, derived data and selectors.** Store the minimum; derive the rest:

```js
let state = { range: null, promo: 'all days' }           // what the user chose
const inRange = s => rows.filter(d => !s.range || (d.date >= s.range[0] && d.date <= s.range[1]))
const kpis = s => { const v = inRange(s); return { days: v.length, total: d3.sum(v, d => d.sales) } }
```

Never store `total` in state as well. Two copies of one fact eventually disagree.

**Rendering from state.** A view is a function of state. Write it so it can run any number of times, building from the join (lesson 4) rather than appending blindly:

```js
subscribe(s => bars.selectAll('rect').data(weekdays(s), d => d.day).join('rect') /* ... */)
```

Run twice, it updates the existing bars, rather than drawing a second set on top.

**Memoisation.** If a selector is expensive and called by several views, cache its last result:

```js
function memoize(fn) {
  let lastArg, lastResult
  return arg => (arg === lastArg ? lastResult : (lastResult = fn((lastArg = arg))))
}
const inRangeCached = memoize(inRange)
```

This works *because* state is replaced, never mutated: an unchanged state is the same object, so `===` is a complete check. Immutability (lesson 4) and pure selectors (lesson 14) are what make this cheap and safe.

<!-- maths -->
A dashboard is a set of functions of one state $s$:

$$
\text{view}_k = R_k\big(f_k(D, s)\big)
$$

where $D$ is the data, $f_k$ is a pure selector and $R_k$ renders. Because $f_k$ is a function (same inputs, same output), you can test it without a browser, cache it by its inputs, and reason about each view without the others. Interaction is just a sequence of states $s_0 \to s_1 \to s_2 \dots$ produced by events. Keep every state, and **undo** comes for free: step back through the list.

<!-- code -->
```js
const rows = load('cafe')

// A pure selector: (rows, state) → the numbers for the KPI tiles.
function selectKpis(rows, state) {
  // Task: filter by state.from…state.to (inclusive) and state.promo ('all' | 'yes' | 'no'),
  // then compute { days, total, mean, best }.
  return { days: 0, total: 0, mean: 0, best: null }
}

const summer = { from: new Date(Date.UTC(2025, 5, 1)), to: new Date(Date.UTC(2025, 7, 31)), promo: 'all' }
const k = selectKpis(rows, summer)
log(k)

// Render the tiles from the result (HTML is fine for this part).
const tiles = d3.select(el).append('div').style('display', 'flex').style('gap', '12px').style('padding', '12px')
Object.entries(k).forEach(([label, value]) => {
  const t = tiles.append('div').style('border', '1px solid ' + theme.grid).style('border-radius', '8px').style('padding', '10px 14px')
  t.append('div').style('font-size', '12px').style('color', theme.muted).text(label)
  t.append('div').style('font-size', '22px').style('font-weight', '700').text(JSON.stringify(value))
})
return k
```

<!-- task -->
Write the selector `selectKpis(rows, state)`. It must be **pure**: no reading globals, no changing `rows`. It keeps the days from `state.from` to `state.to` inclusive, and `state.promo` filters them to `'all'` days, promotion days (`'yes'`) or normal days (`'no'`). It returns:

- `days`: the number of days kept;
- `total`: their total sales;
- `mean`: mean sales per day, rounded to 1 decimal place;
- `best`: `{ date, sales }` for the best day, with `date` as a `'YYYY-MM-DD'` string.

The code returns the KPIs for June to August with all days. As a stretch, add a brushable line chart below the tiles that recomputes them from the brushed range: the explore figure shows one way.

<!-- solution -->
```js
const rows = load('cafe')

function selectKpis(rows, state) {
  const kept = rows.filter(d =>
    d.date >= state.from && d.date <= state.to &&
    (state.promo === 'all' || (state.promo === 'yes' ? d.promo === 1 : d.promo === 0)))
  const best = d3.greatest(kept, d => d.sales)
  return {
    days: kept.length,
    total: d3.sum(kept, d => d.sales),
    mean: kept.length ? Math.round(d3.mean(kept, d => d.sales) * 10) / 10 : 0,
    best: best ? { date: best.date.toISOString().slice(0, 10), sales: best.sales } : null,
  }
}

const summer = { from: new Date(Date.UTC(2025, 5, 1)), to: new Date(Date.UTC(2025, 7, 31)), promo: 'all' }
const k = selectKpis(rows, summer)

const tiles = d3.select(el).append('div').style('display', 'flex').style('gap', '12px').style('padding', '12px')
Object.entries(k).forEach(([label, value]) => {
  const t = tiles.append('div').style('border', '1px solid ' + theme.grid).style('border-radius', '8px').style('padding', '10px 14px')
  t.append('div').style('font-size', '12px').style('color', theme.muted).text(label)
  t.append('div').style('font-size', '22px').style('font-weight', '700').text(JSON.stringify(value))
})
return k
```
