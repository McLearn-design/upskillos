---
id: wds-18-time-series
title: Time series, trends and seasonality
part: 5. Time
summary: Data in time order has structure (trend, weekly rhythm, seasons) hidden under the noise. Smooth it, take it apart, and handle dates without the classic bugs.
js: Date objects, UTC versus local time, and formatting dates
height: 420
controls: [{"name":"window","label":"Rolling window (days)","min":1,"max":61,"step":2,"value":7},{"name":"align","label":"Window position","options":["centred","trailing (past only)"],"value":"centred"},{"name":"view","label":"Show","options":["sales + rolling mean","what is left (sales − rolling mean)","by weekday"],"value":"sales + rolling mean"}]
---

<!-- explore -->
```js
const cafe = load('cafe')
const k = params.window, half = Math.floor(k / 2)
const centred = params.align === 'centred'
const smooth = cafe.map((d, i) => {
  const from = centred ? i - half : i - k + 1, to = centred ? i + half : i
  if (from < 0 || to >= cafe.length) return null
  return d3.mean(cafe.slice(from, to + 1), r => r.sales)
})
const { g, w, h } = frame({ margin: { top: 30 } })
if (params.view === 'by weekday') {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const x = d3.scaleLinear().domain([0, 6]).range([0, w])
  const y = d3.scaleLinear().domain(d3.extent(cafe, d => d.sales)).nice().range([h, 0])
  const weeks = d3.groups(cafe, d => d3.utcWeek(d.date).getTime())
  g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x).ticks(7).tickFormat(i => names[i]))
  g.append('g').call(d3.axisLeft(y))
  const color = d3.scaleSequential(d3.interpolateViridis).domain([0, weeks.length])
  weeks.forEach(([, days], i) => g.append('path').attr('fill', 'none').attr('stroke', color(i)).attr('stroke-opacity', 0.5)
    .attr('d', d3.line().x(d => x(d.date.getUTCDay())).y(d => y(d.sales))(days)))
  g.append('text').attr('y', -10).attr('fill', theme.text).text('One line per week, coloured January (purple) to December (yellow)')
} else {
  const x = d3.scaleUtc().domain(d3.extent(cafe, d => d.date)).range([0, w])
  const resid = params.view.startsWith('what')
  const vals = resid ? cafe.map((d, i) => smooth[i] == null ? null : d.sales - smooth[i]) : cafe.map(d => d.sales)
  const y = d3.scaleLinear().domain(d3.extent(vals.filter(v => v != null))).nice().range([h, 0])
  g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x).ticks(d3.utcMonth.every(1)).tickFormat(d3.utcFormat('%b')))
  g.append('g').call(d3.axisLeft(y))
  g.selectAll('rect.promo').data(cafe.filter(d => d.promo)).join('rect').attr('class', 'promo')
    .attr('x', d => x(d.date) - 1).attr('width', 2).attr('y', 0).attr('height', h).attr('fill', theme.palette[2]).attr('fill-opacity', 0.4)
  g.append('path').attr('fill', 'none').attr('stroke', resid ? theme.accent2 : theme.muted).attr('stroke-width', 1)
    .attr('d', d3.line().defined(v => v != null).x((v, i) => x(cafe[i].date)).y(v => y(v))(vals))
  if (!resid) g.append('path').attr('fill', 'none').attr('stroke', theme.accent).attr('stroke-width', 2.5)
    .attr('d', d3.line().defined(v => v != null).x((v, i) => x(cafe[i].date)).y(v => y(v))(smooth))
  g.append('text').attr('y', -10).attr('fill', theme.text).text(resid ? 'What the rolling mean does not explain' : 'Daily sales (grey), ' + k + '-day rolling mean (blue), promotion days (yellow)')
}
```

<!-- learn -->
The grey line zig-zags every week. A **7-day rolling mean** (each point the average of a week of days) flattens that exactly, because every window contains each weekday once. Try 6 or 8 days and a ripple comes back. Raise the window to 61 and only the slow **trend** and the summer **season** remain. Switch to **what is left** with a 7-day window: the weekly pattern and noise, plus spikes on promotion days. Then look at **by weekday**: the weekend bump is the same shape in every week of the year.

A time series is often thought of as parts added together:

$$\text{observed} = \text{trend} + \text{seasonality} + \text{remainder}$$

- **Trend**: the slow, long-run movement (sales growing through the year).
- **Seasonality**: a pattern that repeats with a fixed period (weekly, yearly).
- **Remainder**: everything else: noise, one-off events, promotions.

Separating them answers better questions. "Was last Saturday good?" means "good *for a Saturday*, at *this time of year*".

**Trailing vs centred windows.** A centred window uses future days, so it lags less but is only possible after the fact. A trailing window uses only the past, which is what you'd have live on a dashboard, but it **lags behind** turning points by about half its width. Compare the two around the summer peak.

Charting time:

- `d3.scaleUtc()` is a linear scale whose domain is dates; its axis picks sensible ticks (days, months, years).
- `d3.utcFormat('%b %d')` formats dates; `d3.utcParse('%d/%m/%Y')` reads non-ISO dates.
- `d3.utcDay`, `d3.utcWeek`, `d3.utcMonth` are **intervals**: `d3.utcMonth(date)` rounds down to the start of the month, `d3.utcMonth.range(a, b)` lists every month between two dates.

<!-- javascript -->
JavaScript's `Date` is a timestamp, the milliseconds since 1 January 1970 UTC, plus methods with famous traps:

```js
new Date(2025, 0, 31)              // 31 JANUARY: months count from 0
new Date('2025-01-31')             // ISO date only: midnight UTC
new Date('2025-01-31T00:00')       // with a time: midnight LOCAL time
date.getDay()                      // weekday in the viewer's time zone
date.getUTCDay()                   // weekday in UTC: the same for every viewer
```

Daily data is safest kept in **UTC** throughout: parse as UTC (`d3.autoType` does for ISO dates), use `getUTC…` methods and `d3.utc…` functions. Otherwise a viewer in New York sees every date shifted to the day before.

**Dates as Map keys.** Dates are objects, and objects are compared by reference:

```js
const a = new Date(0), b = new Date(0)
a === b                  // false: two different objects
a.getTime() === b.getTime()   // true
new Map([[a, 1]]).get(b)      // undefined!
```

So when grouping by month, key by a **number** (`+d3.utcMonth(d.date)` or `d.date.getUTCMonth()`), not by the `Date` object.

`Intl.DateTimeFormat` formats for the reader's locale: `new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(date)` gives "March".

<!-- maths -->
A trailing moving average of width $k$ is

$$
\text{MA}_t = \frac{1}{k}\sum_{j=0}^{k-1} y_{t-j}
$$

It is a **convolution** of the series with a box of height $1/k$. If the series has a periodic component with period $p$ and $k$ is a multiple of $p$, every window contains whole cycles, whose sum is constant: the moving average removes that component completely. Any other $k$ leaves a ripple.

A trailing average responds to a change at time $t$ with a delay of about $(k-1)/2$ steps, the average age of the values in its window. A centred window has zero delay, at the cost of needing future values.

<!-- code -->
```js
const cafe = load('cafe')
log('first date:', cafe[0].date.toISOString(), ' weekday (UTC):', cafe[0].date.getUTCDay())

// A trap: grouping by Date objects.
const byMonthWrong = d3.rollup(cafe, v => d3.sum(v, d => d.sales), d => d3.utcMonth(d.date))
log('groups when keyed by Date objects:', byMonthWrong.size)

const { g, w, h } = frame()
const x = d3.scaleUtc().domain(d3.extent(cafe, d => d.date)).range([0, w])
const y = d3.scaleLinear().domain([0, d3.max(cafe, d => d.sales)]).nice().range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
g.append('path').attr('fill', 'none').attr('stroke', theme.accent)
  .attr('d', d3.line().x(d => x(d.date)).y(d => y(d.sales))(cafe))

// Task: total sales per month.
return null
```

<!-- task -->
The code shows the trap: keyed by `Date` objects, `rollup` makes one group per *row*. Fix the key so it is a number, and compute the **total sales for each month**.

Replace the line chart with 12 monthly bars labelled Jan … Dec (`d3.utcFormat('%b')`), and **return** the 12 totals in calendar order.

<!-- solution -->
```js
const cafe = load('cafe')
const byMonth = d3.rollup(cafe, v => d3.sum(v, d => d.sales), d => d.date.getUTCMonth())
const months = d3.utcMonth.range(new Date(Date.UTC(2025, 0, 1)), new Date(Date.UTC(2026, 0, 1)))
const totals = months.map(m => byMonth.get(m.getUTCMonth()))
const fmt = d3.utcFormat('%b')

const { g, w, h } = frame()
const x = d3.scaleBand().domain(months.map(fmt)).range([0, w]).padding(0.15)
const y = d3.scaleLinear().domain([0, d3.max(totals)]).nice().range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y).tickFormat(d3.format('~s')))
g.selectAll('rect').data(totals).join('rect')
  .attr('x', (d, i) => x(fmt(months[i]))).attr('width', x.bandwidth())
  .attr('y', d => y(d)).attr('height', d => h - y(d)).attr('fill', theme.accent)
return totals
```
