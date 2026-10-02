---
id: wds-25-responsive-accessible
title: Responsive and accessible charts
part: 7. Building data apps
summary: Your chart will be read on phones, by people who can't tell red from green, and by screen readers. Build it so it works for all of them.
js: ResizeObserver, matchMedia, and ARIA attributes from code
height: 420
controls: [{"name":"w","label":"Chart width (px)","min":240,"max":900,"step":10,"value":640},{"name":"palette","label":"Palette","options":["red/green","colour-blind safe (Okabe–Ito)"],"value":"red/green"},{"name":"vision","label":"Simulate vision","options":["typical","deuteranopia (no green cones)","protanopia (no red cones)","greyscale"],"value":"typical"},{"name":"labels","label":"Labels","options":["legend","direct labels"],"value":"legend"}]
---

<!-- explore -->
```js
const cafe = load('cafe')
const months = d3.utcMonths(new Date(Date.UTC(2025, 0, 1)), new Date(Date.UTC(2026, 0, 1)))
const series = [['Promotion days', 1], ['Normal days', 0]].map(([name, promo]) => ({
  name, values: months.map(m => ({ m, v: d3.mean(cafe.filter(d => d.promo === promo && d.date.getUTCMonth() === m.getUTCMonth()), d => d.sales) ?? null })),
}))
const palettes = { 'red/green': ['#d62728', '#2ca02c'], 'colour-blind safe (Okabe–Ito)': ['#E69F00', '#0072B2'] }
// Colour-vision simulation matrices (Machado et al. 2009, severity 1), applied in linear RGB.
const sims = {
  'deuteranopia (no green cones)': [[0.367, 0.861, -0.228], [0.280, 0.673, 0.047], [-0.012, 0.043, 0.969]],
  'protanopia (no red cones)': [[0.152, 1.053, -0.205], [0.115, 0.786, 0.099], [-0.004, -0.048, 1.052]],
  greyscale: [[0.2126, 0.7152, 0.0722], [0.2126, 0.7152, 0.0722], [0.2126, 0.7152, 0.0722]],
}
const toLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const toSrgb = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
const see = hex => {
  const M = sims[params.vision]
  if (!M) return hex
  const c = d3.rgb(hex), v = [c.r, c.g, c.b].map(toLin)
  const o = M.map(row => toSrgb(Math.min(1, Math.max(0, row[0] * v[0] + row[1] * v[1] + row[2] * v[2]))))
  return d3.rgb(...o).formatHex()
}
const colors = palettes[params.palette].map(see)

const W = Math.min(params.w, width - 8)
const box = d3.select(el).append('div').style('width', W + 'px').style('height', (height - 8) + 'px')
  .style('border', '1px dashed ' + theme.grid).style('margin', '0 auto')
const svg = box.append('svg').attr('viewBox', [0, 0, W, height - 10]).attr('width', W).attr('height', height - 10)
  .attr('role', 'img').attr('aria-label', 'Line chart: mean daily café sales by month in 2025, promotion days against normal days. Promotion days are higher every month.')
const narrow = W < 420
const m = { l: narrow ? 34 : 50, r: params.labels === 'direct labels' ? (narrow ? 70 : 110) : 16, t: params.labels === 'legend' ? 40 : 16, b: 30 }
const iw = W - m.l - m.r, ih = height - 10 - m.t - m.b
const g = svg.append('g').attr('transform', 'translate(' + m.l + ',' + m.t + ')')
const x = d3.scaleUtc().domain(d3.extent(months)).range([0, iw])
const y = d3.scaleLinear().domain([300, d3.max(series, s => d3.max(s.values, d => d.v))]).nice().range([ih, 0])
const tickCount = Math.max(2, Math.floor(iw / 70))
g.append('g').attr('transform', 'translate(0,' + ih + ')').call(d3.axisBottom(x).ticks(tickCount).tickFormat(d3.utcFormat(narrow ? '%b' : '%B')))
g.append('g').call(d3.axisLeft(y).ticks(Math.max(3, Math.floor(ih / 50))).tickFormat(d3.format('~s')))
series.forEach((s, i) => {
  g.append('path').attr('fill', 'none').attr('stroke', colors[i]).attr('stroke-width', 3)
    .attr('stroke-dasharray', params.palette.startsWith('colour') && i ? '6 4' : null)
    .attr('d', d3.line().defined(d => d.v != null).x(d => x(d.m)).y(d => y(d.v))(s.values))
  if (params.labels === 'direct labels') {
    const lastV = s.values.filter(d => d.v != null).at(-1)
    g.append('text').attr('x', iw + 6).attr('y', y(lastV.v) + 4).attr('fill', colors[i]).attr('font-weight', 700).attr('font-size', narrow ? 10 : 12).text(s.name)
  } else {
    svg.append('rect').attr('x', m.l + i * 150).attr('y', 10).attr('width', 14).attr('height', 14).attr('fill', colors[i])
    svg.append('text').attr('x', m.l + 20 + i * 150).attr('y', 22).attr('fill', theme.text).attr('font-size', 12).text(s.name)
  }
})
svg.append('text').attr('x', W - 6).attr('y', height - 14).attr('text-anchor', 'end').attr('fill', theme.muted).attr('font-size', 10)
  .text(W + 'px wide → ' + tickCount + ' x ticks' + (narrow ? ', short month names' : ''))
```

<!-- learn -->
Drag the **width** down to phone size: the number of ticks and the month names adapt instead of overlapping. Then turn on **simulate vision: deuteranopia**, the most common colour-vision deficiency (about 1 in 12 men, 1 in 200 women). With the red/green palette the two lines become almost the same muddy colour. Switch to the **Okabe–Ito** palette, which was designed to stay distinct, and to **direct labels**, which name each line where it ends. Then even greyscale works.

**Responsive charts.** A chart should be laid out for the space it actually has:

- Measure the container (`el.clientWidth`) instead of hard-coding a width, and **redraw when it changes** with a `ResizeObserver`.
- Base the **tick count** on the space, roughly one tick per 60–80 pixels, and abbreviate labels when narrow.
- A `viewBox` makes an SVG scale like an image. That's fine for icons, but for charts scaling also shrinks the text. Redrawing at the new size keeps text readable.

**Accessible charts.**

- **Never use colour alone.** Add a second cue (direct labels, dashes, shapes), and use a colour-blind-safe palette.
- **Contrast**: text and important lines need at least a 4.5:1 contrast ratio against the background (3:1 for large text and graphics).
- **Text alternatives**: give the SVG `role="img"` and an `aria-label` stating the *finding*, not just "a chart". For anything a reader may need exact values from, also provide the data as a real `<table>` (it can be visually hidden).
- **Keyboard**: interactive marks need `tabindex="0"`, a visible focus style, and the same actions on `keydown` as on hover or click.
- **Motion**: respect `prefers-reduced-motion` by skipping or shortening transitions for people who asked for less motion.

<!-- javascript -->
**`ResizeObserver`** calls you whenever an element's size changes, whether from a window resize, a sidebar opening or a flex layout reflowing:

```js
const observer = new ResizeObserver(entries => {
  const { width } = entries[0].contentRect
  draw(width)
})
observer.observe(el)
onCleanup(() => observer.disconnect())   // always disconnect when done
```

Combine it with a debounce (lesson 23) if drawing is expensive.

**`matchMedia`** reads CSS media queries from JavaScript:

```js
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const duration = reduceMotion ? 0 : 600
const dark = window.matchMedia('(prefers-color-scheme: dark)')
dark.addEventListener('change', e => redraw(e.matches))
```

**ARIA from code** is just attributes:

```js
svg.attr('role', 'img').attr('aria-label', 'Sales rose 40% from January to August')
bars.attr('tabindex', 0).attr('role', 'listitem').attr('aria-label', d => d.day + ': ' + d.value)
```

A **visually hidden** element stays readable by screen readers but takes no space on screen. The standard CSS for it is `position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap`. (`display: none` would hide it from screen readers too.)

<!-- maths -->
**Contrast ratio** (WCAG) compares the relative luminances $L_1 > L_2$ of two colours:

$$
\text{contrast} = \frac{L_1 + 0.05}{L_2 + 0.05}, \qquad
L = 0.2126\,R + 0.7152\,G + 0.0722\,B
$$

where $R, G, B$ are **linear** (not gamma-encoded) channel values in $[0, 1]$. An sRGB channel value $c$ is linearised as $c/12.92$ if $c \le 0.04045$, otherwise $\left(\frac{c + 0.055}{1.055}\right)^{2.4}$. The ratio runs from 1 (identical) to 21 (black on white).

Colour-vision deficiency simulation works in the same linear space: each colour is multiplied by a $3 \times 3$ matrix that approximates what the remaining cone types respond to (the figure uses the matrices of Machado, Oliveira and Fernandes, 2009). Deuteranopia maps red and green onto nearly the same colour, which is exactly why a red/green palette fails.

<!-- code -->
```js
const cafe = load('cafe')
const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const byDay = d3.rollup(cafe, v => d3.mean(v, d => d.sales), d => d.date.getUTCDay())
const data = names.map((day, i) => ({ day, value: Math.round(byDay.get(i)) }))

const { svg, g, w, h } = frame()
const x = d3.scaleBand().domain(names).range([0, w]).padding(0.2)
const y = d3.scaleLinear().domain([0, d3.max(data, d => d.value)]).nice().range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
g.selectAll('rect').data(data).join('rect')
  .attr('x', d => x(d.day)).attr('width', x.bandwidth())
  .attr('y', d => y(d.value)).attr('height', d => h - y(d.value)).attr('fill', theme.accent)

// Task: make this chart accessible, then read your table back.
const table = el.querySelector('table')
return {
  role: svg.attr('role'),
  hasLabel: Boolean(svg.attr('aria-label')),
  rows: table ? Array.from(table.querySelectorAll('tbody tr'), tr => { const [day, value] = tr.querySelectorAll('td'); return [day.textContent, Number(value.textContent)] }) : [],
}
```

<!-- task -->
1. Give the SVG `role="img"` and an `aria-label` that states the main finding (which days sell most?).
2. Add a **visually hidden** `<table>` to `el`, built with d3 from `data`: a `<caption>`, a header row in a `<thead>`, and one `<tr>` per day in a `<tbody>`, with the day in the first cell and the value in the second.
3. Add a `ResizeObserver` that logs the new width when `el` resizes, and disconnect it in `onCleanup`.

The return statement reads your table back, so it should report 7 rows that match the bars.

<!-- solution -->
```js
const cafe = load('cafe')
const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const byDay = d3.rollup(cafe, v => d3.mean(v, d => d.sales), d => d.date.getUTCDay())
const data = names.map((day, i) => ({ day, value: Math.round(byDay.get(i)) }))
const best = d3.greatest(data, d => d.value)

const { svg, g, w, h } = frame()
svg.attr('role', 'img').attr('aria-label', 'Bar chart of mean daily café sales by weekday in 2025. Weekends sell most; the highest is ' + best.day + ' at ' + best.value + '.')
const x = d3.scaleBand().domain(names).range([0, w]).padding(0.2)
const y = d3.scaleLinear().domain([0, d3.max(data, d => d.value)]).nice().range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
g.selectAll('rect').data(data).join('rect')
  .attr('x', d => x(d.day)).attr('width', x.bandwidth())
  .attr('y', d => y(d.value)).attr('height', d => h - y(d.value)).attr('fill', theme.accent)

const hidden = d3.select(el).append('table')
  .style('position', 'absolute').style('width', '1px').style('height', '1px')
  .style('overflow', 'hidden').style('clip-path', 'inset(50%)').style('white-space', 'nowrap')
hidden.append('caption').text('Mean daily sales by weekday, 2025')
hidden.append('thead').append('tr').selectAll('th').data(['Day', 'Mean sales']).join('th').text(d => d)
hidden.append('tbody').selectAll('tr').data(data).join('tr')
  .selectAll('td').data(d => [d.day, d.value]).join('td').text(d => d)

const observer = new ResizeObserver(entries => log('resized to', Math.round(entries[0].contentRect.width), 'px'))
observer.observe(el)
onCleanup(() => observer.disconnect())

const table = el.querySelector('table')
return {
  role: svg.attr('role'),
  hasLabel: Boolean(svg.attr('aria-label')),
  rows: table ? Array.from(table.querySelectorAll('tbody tr'), tr => { const [day, value] = tr.querySelectorAll('td'); return [day.textContent, Number(value.textContent)] }) : [],
}
```
