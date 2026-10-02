---
id: wds-09-summary-statistics
title: Centre and spread
part: 2. Working with real data
summary: Two or three numbers can summarise thousands, if you choose them knowing what each one ignores. Drag one value far away and see which summaries flinch.
js: reduce, sort comparators, and copying before you sort
height: 340
controls: [{"name":"outlier","label":"Move the last score to","min":0,"max":400,"step":5,"value":64},{"name":"n","label":"Students in the sample","min":5,"max":60,"step":1,"value":25}]
---

<!-- explore -->
```js
const scores = load('students').slice(0, params.n).map(d => d.score)
scores[scores.length - 1] = params.outlier
const mean = d3.mean(scores), median = d3.median(scores), sd = d3.deviation(scores)
const sorted = [...scores].sort(d3.ascending)
const q1 = d3.quantile(sorted, 0.25), q3 = d3.quantile(sorted, 0.75)

const { g, w, h } = frame({ margin: { top: 30 } })
const x = d3.scaleLinear().domain([0, Math.max(120, params.outlier + 10)]).range([0, w])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
// Dot plot: stack equal-ish values.
const bins = d3.bin().domain(x.domain()).thresholds(60)(scores)
bins.forEach(b => b.forEach((v, j) => g.append('circle')
  .attr('cx', x(v)).attr('cy', h * 0.55 - j * 9).attr('r', 4)
  .attr('fill', v === params.outlier ? theme.accent2 : theme.accent).attr('fill-opacity', 0.8)))
// Mean ± 1 SD band, and the box from Q1 to Q3.
g.append('rect').attr('x', x(mean - sd)).attr('width', x(mean + sd) - x(mean - sd)).attr('y', h * 0.62).attr('height', 12).attr('fill', theme.accent).attr('fill-opacity', 0.25)
g.append('rect').attr('x', x(q1)).attr('width', x(q3) - x(q1)).attr('y', h * 0.8).attr('height', 16).attr('fill', 'none').attr('stroke', theme.text)
const marks = [['mean', mean, theme.bad, 0], ['median', median, theme.good, 1]]
marks.forEach(([name, v, c, k]) => {
  g.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', 0).attr('y2', h).attr('stroke', c).attr('stroke-width', 2)
  g.append('text').attr('x', x(v) + 4).attr('y', -12 + k * 14).attr('fill', c).attr('font-size', 12).text(name + ' ' + v.toFixed(1))
})
g.append('text').attr('x', 0).attr('y', h * 0.62 - 4).attr('font-size', 11).attr('fill', theme.muted).text('mean ± 1 SD: ' + sd.toFixed(1))
g.append('text').attr('x', 0).attr('y', h * 0.8 - 4).attr('font-size', 11).attr('fill', theme.muted).text('IQR (Q1 to Q3): ' + (q3 - q1).toFixed(1))
```

<!-- learn -->
Drag the last student's score (pink) to 400. The **mean** chases it, and the **standard deviation** band balloons. The **median** and the **IQR** box hardly move. One bad value, a typo such as 400 for 40.0, can drag the mean anywhere; it can only nudge the median one place.

That is the idea of **robustness**. Summaries come in pairs, one for the centre and one for the spread:

| Centre | Spread | Sensitive to outliers? |
|---|---|---|
| mean | standard deviation (SD) | yes: every value pulls |
| median | interquartile range (IQR) | no: only the order matters |

- The **median** is the middle value of the sorted data. **Quartiles** cut the sorted data into quarters: Q1 has 25% of values below it, Q3 has 75%. The **IQR** is Q3 − Q1, the width of the middle half.
- The **standard deviation** is roughly the typical distance from the mean, in the data's own units.
- A **box plot** draws exactly the robust summary: the box goes from Q1 to Q3, with a line at the median and whiskers to the most extreme values within 1.5 × IQR of the box. Anything beyond that is drawn as a dot, a candidate outlier.

When mean and median disagree a lot, that disagreement is the finding: the data is skewed or has outliers. Report both.

D3 has these built in: `d3.mean`, `d3.median`, `d3.deviation`, `d3.variance`, `d3.extent`, `d3.quantile(sortedValues, p)`. Each takes an optional accessor, `d3.mean(rows, d => d.score)`, and skips `null` and `NaN` values, which is usually what you want, but worth knowing.

<!-- javascript -->
**`reduce` for sums.** `values.reduce((s, v) => s + v, 0)` is the sum. A mean is the sum divided by the length.

**The sort trap.** `Array.prototype.sort` with no argument compares values *as strings*:

```js
[10, 9, 1].sort()                    // [1, 10, 9]  !
[10, 9, 1].sort((a, b) => a - b)     // [1, 9, 10]
```

A **comparator** `(a, b) => ...` returns a negative number if `a` should come first, a positive one if `b` should, and `0` for a tie. `a - b` sorts ascending; `b - a` descending. `d3.ascending` and `d3.descending` work for strings and dates too.

**`sort` changes the array in place**, and returns it, which makes this bug easy to write:

```js
const sorted = scores.sort((a, b) => a - b)   // scores is now sorted too
const sorted = [...scores].sort((a, b) => a - b)   // copy first
const sorted = scores.toSorted((a, b) => a - b)    // or the newer non-mutating method
```

<!-- maths -->
For values $x_1, \dots, x_n$:

$$
\bar{x} = \frac{1}{n}\sum_{i=1}^{n} x_i, \qquad
s^2 = \frac{1}{n-1}\sum_{i=1}^{n} (x_i - \bar{x})^2, \qquad
s = \sqrt{s^2}
$$

Why $n-1$? The deviations $x_i - \bar{x}$ are measured from the sample mean, which is by construction the point that makes them as small as possible. They come out slightly smaller than deviations from the true population mean $\mu$, and dividing by $n-1$ instead of $n$ corrects that on average (**Bessel's correction**). `d3.variance` and `d3.deviation` use $n-1$.

Each value's pull on the mean is $\frac{x_i}{n}$, unbounded, so one value can move the mean anywhere. The median has a **breakdown point** of 50%: you must corrupt half the data to move it arbitrarily far. The mean's breakdown point is $0$.

For an even $n$ the median is the average of the two middle values. `d3.quantile` interpolates linearly between neighbours: for probability $p$, it takes position $i = (n - 1)p$ in the sorted data and blends the values on either side.

<!-- code -->
```js
const students = load('students')
const scores = students.map(d => d.score)

// A box plot of the scores, built from d3's summaries.
const sorted = [...scores].sort(d3.ascending)
const q1 = d3.quantile(sorted, 0.25), med = d3.quantile(sorted, 0.5), q3 = d3.quantile(sorted, 0.75)
const iqr = q3 - q1
const lo = d3.min(sorted.filter(v => v >= q1 - 1.5 * iqr))
const hi = d3.max(sorted.filter(v => v <= q3 + 1.5 * iqr))

const { g, w, h } = frame()
const x = d3.scaleLinear().domain([0, 100]).range([0, w])
const cy = h / 2
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('line').attr('x1', x(lo)).attr('x2', x(hi)).attr('y1', cy).attr('y2', cy).attr('stroke', theme.text)
g.append('rect').attr('x', x(q1)).attr('width', x(q3) - x(q1)).attr('y', cy - 30).attr('height', 60)
  .attr('fill', theme.accent).attr('fill-opacity', 0.3).attr('stroke', theme.text)
g.append('line').attr('x1', x(med)).attr('x2', x(med)).attr('y1', cy - 30).attr('y2', cy + 30).attr('stroke', theme.text).attr('stroke-width', 2)
g.selectAll('circle').data(sorted.filter(v => v < lo || v > hi)).join('circle')
  .attr('cx', d => x(d)).attr('cy', cy).attr('r', 3).attr('fill', theme.bad)

log('d3 says: mean', d3.mean(scores), 'sd', d3.deviation(scores), 'median', d3.median(scores))

// Task: compute these yourself, without d3.
function mean(values) { return 0 }
function sd(values) { return 0 }
function median(values) { return 0 }
return { mean: mean(scores), sd: sd(scores), median: median(scores) }
```

<!-- task -->
Implement `mean`, `sd` (the sample standard deviation, dividing by n − 1) and `median` yourself, using `reduce` and a sorted **copy**, not any `d3` function. Your numbers should match the ones d3 logs. Then check that your `median` did not reorder `scores`.

<!-- solution -->
```js
const students = load('students')
const scores = students.map(d => d.score)

const sorted = [...scores].sort(d3.ascending)
const q1 = d3.quantile(sorted, 0.25), med = d3.quantile(sorted, 0.5), q3 = d3.quantile(sorted, 0.75)
const iqr = q3 - q1
const lo = d3.min(sorted.filter(v => v >= q1 - 1.5 * iqr))
const hi = d3.max(sorted.filter(v => v <= q3 + 1.5 * iqr))

const { g, w, h } = frame()
const x = d3.scaleLinear().domain([0, 100]).range([0, w])
const cy = h / 2
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('line').attr('x1', x(lo)).attr('x2', x(hi)).attr('y1', cy).attr('y2', cy).attr('stroke', theme.text)
g.append('rect').attr('x', x(q1)).attr('width', x(q3) - x(q1)).attr('y', cy - 30).attr('height', 60)
  .attr('fill', theme.accent).attr('fill-opacity', 0.3).attr('stroke', theme.text)
g.append('line').attr('x1', x(med)).attr('x2', x(med)).attr('y1', cy - 30).attr('y2', cy + 30).attr('stroke', theme.text).attr('stroke-width', 2)

function mean(values) {
  return values.reduce((s, v) => s + v, 0) / values.length
}
function sd(values) {
  const m = mean(values)
  const ss = values.reduce((s, v) => s + (v - m) ** 2, 0)
  return Math.sqrt(ss / (values.length - 1))
}
function median(values) {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
return { mean: mean(scores), sd: sd(scores), median: median(scores) }
```
