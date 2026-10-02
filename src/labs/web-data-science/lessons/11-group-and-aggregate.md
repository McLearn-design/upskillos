---
id: wds-11-group-and-aggregate
title: Group, aggregate and compare
part: 2. Working with real data
summary: Most questions are comparisons between groups. Split the rows by a key, summarise each group, and draw the summaries side by side, without hiding how many rows each one stands for.
js: Map, iterating entries, Object.fromEntries and Array.from
height: 360
controls: [{"name":"metric","label":"Measure","options":["score","hours","sleep","prior"],"value":"score"},{"name":"agg","label":"Summary","options":["mean","median","max","count"],"value":"mean"},{"name":"split","label":"Split each group by","options":["nothing","passed"],"value":"nothing"},{"name":"points","label":"Show every student","options":["yes","no"],"value":"yes"}]
---

<!-- explore -->
```js
const rows = load('students')
const summarise = { mean: v => d3.mean(v, d => d[params.metric]), median: v => d3.median(v, d => d[params.metric]),
  max: v => d3.max(v, d => d[params.metric]), count: v => v.length }[params.agg]
const subKey = params.split === 'passed' ? d => (d.passed ? 'passed' : 'failed') : () => 'all'
const groups = [...new Set(rows.map(d => d.group))].sort()
const subs = params.split === 'passed' ? ['failed', 'passed'] : ['all']
const table2 = d3.rollup(rows, summarise, d => d.group, subKey)
const nested = d3.group(rows, d => d.group, subKey)

const { g, w, h } = frame({ margin: { right: 90 } })
const x0 = d3.scaleBand().domain(groups).range([0, w]).padding(0.2)
const x1 = d3.scaleBand().domain(subs).range([0, x0.bandwidth()]).padding(0.08)
const yMax = params.agg === 'count' ? d3.max([...table2.values()].flatMap(m => [...m.values()]))
  : d3.max(rows, d => d[params.metric])
const y = d3.scaleLinear().domain([0, yMax]).nice().range([h, 0])
const color = d3.scaleOrdinal().domain(subs).range(params.split === 'passed' ? [theme.bad, theme.good] : [theme.accent])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x0).tickFormat(k => 'group ' + k))
g.append('g').call(d3.axisLeft(y))
for (const [group, bySub] of table2) {
  for (const [sub, value] of bySub) {
    const bx = x0(group) + x1(sub)
    g.append('rect').attr('x', bx).attr('width', x1.bandwidth()).attr('y', y(value)).attr('height', h - y(value))
      .attr('fill', color(sub)).attr('fill-opacity', 0.45)
    g.append('text').attr('x', bx + x1.bandwidth() / 2).attr('y', y(value) - 4).attr('text-anchor', 'middle')
      .attr('font-size', 11).attr('fill', theme.text).text(d3.format('.3~r')(value))
    const members = nested.get(group).get(sub)
    g.append('text').attr('x', bx + x1.bandwidth() / 2).attr('y', h - 6).attr('text-anchor', 'middle')
      .attr('font-size', 10).attr('fill', theme.muted).text('n=' + members.length)
    if (params.points === 'yes' && params.agg !== 'count') {
      const jitter = rng(group.charCodeAt(0) + sub.length)
      g.append('g').selectAll('circle').data(members).join('circle')
        .attr('cx', () => bx + x1.bandwidth() * (0.15 + 0.7 * jitter())).attr('cy', d => y(d[params.metric]))
        .attr('r', 2).attr('fill', color(sub))
    }
  }
}
subs.forEach((s, i) => {
  g.append('rect').attr('x', w + 12).attr('y', i * 18).attr('width', 12).attr('height', 12).attr('fill', color(s))
  g.append('text').attr('x', w + 30).attr('y', i * 18 + 10).attr('font-size', 12).attr('fill', theme.text).text(s)
})
```

<!-- learn -->
With **mean score** and **every student** shown, the bars say group A does best. The dots show how much each group's students overlap: plenty of A students score below plenty of C students. Now split by **passed**: the "n=" labels under each bar show how few failures there are in group A, so that bar rests on very little data. Switch the summary to **count** to see the group sizes directly.

This pattern is called **split–apply–combine**:

1. **Split** the rows into groups by a key (`group`, or `group` *and* `passed`).
2. **Apply** a summary to each group (mean, median, count…).
3. **Combine** the results into a new, smaller table, and chart that.

D3 has a family of functions for it, all returning `Map`s:

```js
d3.group(rows, d => d.group)                       // Map: key → array of rows
d3.rollup(rows, v => d3.mean(v, d => d.score), d => d.group)   // Map: key → summary
d3.rollup(rows, v => v.length, d => d.group, d => d.passed)    // nested: two keys
d3.rollups(...)                                    // the same, as [key, value] arrays
```

Good habits when charting group summaries:

- **Show the n.** A mean of 3 rows and a mean of 300 look identical as bars.
- **Show the spread**, at least when the groups are small: put the points (or a box plot) over the bars.
- **Order the groups meaningfully**: by value for ranking, or in their natural order (months, ages). Alphabetical order is rarely the meaningful one.

<!-- javascript -->
**Map** is a key→value collection, like an object, with some differences that matter for data:

```js
const m = new Map()
m.set('A', 80).set('B', 72)     // chainable
m.get('A')                      // 80
m.has('C')                      // false
m.size                          // 2
```

- Keys can be **any type**: numbers, dates, even objects. An object's keys are always turned into strings.
- A Map remembers **insertion order** and is directly iterable.

**Iterating** gives `[key, value]` pairs, which destructuring unpacks:

```js
for (const [group, meanScore] of m) log(group, meanScore)
```

**Converting**:

```js
Object.fromEntries(m)                          // { A: 80, B: 72 }
Array.from(m, ([key, value]) => ({ key, value }))   // [{ key: 'A', value: 80 }, ...]
[...m.keys()], [...m.values()]
```

The second form, an array of objects, is the shape `selectAll().data()` wants for drawing.

<!-- maths -->
How much should you trust a group's mean? Its **standard error** is

$$
\text{SE}(\bar{x}) = \frac{s}{\sqrt{n}}
$$

It shrinks with the square root of the group size: a group of 4 has a mean twice as uncertain as a group of 16 with the same spread. Error bars of $\bar{x} \pm 2\,\text{SE}$ are a rough 95% range for the true mean (lesson 16 does this properly).

Aggregation can also mislead outright. In **Simpson's paradox** a comparison flips direction when you split by a third variable, because the groups contain different mixes of that variable. The overall rate is a weighted average of the subgroup rates,

$$
\bar{p} = \sum_k w_k\, p_k, \qquad w_k = \frac{n_k}{n}
$$

and different weights can reverse the order of two weighted averages even when every $p_k$ points the same way.

<!-- code -->
```js
const cafe = load('cafe')
log('first day:', cafe[0].date, '(a', cafe[0].date.constructor.name + ')')

// Mean sales by promotion day vs normal day.
const byPromo = d3.rollup(cafe, v => d3.mean(v, d => d.sales), d => d.promo)
log('mean sales by promo:', Object.fromEntries(byPromo))

const data = Array.from(byPromo, ([promo, mean]) => ({ label: promo ? 'promotion' : 'normal', mean }))
const { g, w, h } = frame()
const x = d3.scaleBand().domain(data.map(d => d.label)).range([0, w]).padding(0.3)
const y = d3.scaleLinear().domain([0, d3.max(data, d => d.mean)]).nice().range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
g.selectAll('rect').data(data).join('rect')
  .attr('x', d => x(d.label)).attr('width', x.bandwidth())
  .attr('y', d => y(d.mean)).attr('height', d => h - y(d.mean)).attr('fill', theme.accent)

// Task: mean sales for each day of the week, Sunday first.
return null
```

<!-- task -->
`autoType` turned each `date` into a `Date`. Use `d3.rollup` with the key `d => d.date.getUTCDay()` (0 = Sunday … 6 = Saturday) to find the **mean sales for each day of the week**. Chart them as bars labelled Sun to Sat, and **return** an array of 7 means in that order, each rounded to 1 decimal place (`Math.round(v * 10) / 10`).

<!-- solution -->
```js
const cafe = load('cafe')
const byDay = d3.rollup(cafe, v => d3.mean(v, d => d.sales), d => d.date.getUTCDay())
const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const means = d3.range(7).map(day => Math.round(byDay.get(day) * 10) / 10)

const { g, w, h } = frame()
const x = d3.scaleBand().domain(names).range([0, w]).padding(0.2)
const y = d3.scaleLinear().domain([0, d3.max(means)]).nice().range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
g.selectAll('rect').data(means).join('rect')
  .attr('x', (d, i) => x(names[i])).attr('width', x.bandwidth())
  .attr('y', d => y(d)).attr('height', d => h - y(d)).attr('fill', theme.accent)
return means
```
