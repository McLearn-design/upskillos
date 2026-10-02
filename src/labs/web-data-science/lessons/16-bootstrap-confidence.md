---
id: wds-16-bootstrap-confidence
title: Confidence intervals and the bootstrap
part: 4. Uncertainty
summary: You only have one sample, but you can resample it thousands of times to see how much your estimate would wobble. That wobble is a confidence interval.
js: typed arrays and measuring performance
height: 420
tolerance: 0.03
controls: [{"name":"n","label":"Sample size","min":5,"max":240,"step":5,"value":30},{"name":"B","label":"Bootstrap resamples","min":100,"max":10000,"step":100,"value":2000},{"name":"stat","label":"Statistic","options":["mean","median","standard deviation"],"value":"mean"},{"name":"level","label":"Confidence level %","min":50,"max":99,"step":1,"value":95}]
---

<!-- explore -->
```js
const sample = load('students').slice(0, params.n).map(d => d.score)
const f = { mean: d3.mean, median: d3.median, 'standard deviation': d3.deviation }[params.stat]
const R = rng(5)
const start = performance.now()
const boot = new Float64Array(params.B)
const buf = new Float64Array(sample.length)
for (let b = 0; b < params.B; b++) {
  for (let i = 0; i < sample.length; i++) buf[i] = sample[Math.floor(R() * sample.length)]
  boot[b] = f(buf)
}
const ms = performance.now() - start
boot.sort()
const alpha = (100 - params.level) / 200
const lo = d3.quantile(boot, alpha), hi = d3.quantile(boot, 1 - alpha)
const est = f(sample)

const { svg, g, w, h } = frame({ margin: { top: 70 } })
const x = d3.scaleLinear().domain(d3.extent(boot)).nice().range([0, w])
const bins = d3.bin().domain(x.domain()).thresholds(50)(boot)
const y = d3.scaleLinear().domain([0, d3.max(bins, b => b.length)]).range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.selectAll('rect').data(bins).join('rect').attr('x', b => x(b.x0)).attr('width', b => Math.max(0, x(b.x1) - x(b.x0) - 1))
  .attr('y', b => y(b.length)).attr('height', b => h - y(b.length))
  .attr('fill', b => b.x1 > lo && b.x0 < hi ? theme.accent : theme.muted).attr('fill-opacity', 0.7)
g.append('line').attr('x1', x(est)).attr('x2', x(est)).attr('y1', -8).attr('y2', h).attr('stroke', theme.bad).attr('stroke-width', 2)
g.append('rect').attr('x', x(lo)).attr('width', x(hi) - x(lo)).attr('y', -20).attr('height', 8).attr('fill', theme.accent)
svg.append('text').attr('x', 48).attr('y', 22).attr('fill', theme.text).attr('font-weight', 600)
  .text(params.stat + ' of the sample = ' + est.toFixed(2) + ';  ' + params.level + '% interval ' + lo.toFixed(2) + ' to ' + hi.toFixed(2))
svg.append('text').attr('x', 48).attr('y', 42).attr('fill', theme.muted).attr('font-size', 12)
  .text(params.B + ' resamples of ' + params.n + ' in ' + ms.toFixed(1) + ' ms (Float64Array buffers, no new arrays per resample)')
```

<!-- learn -->
The red line is the statistic computed on the one sample we have. The histogram shows the same statistic computed on thousands of **bootstrap resamples**: samples of the same size drawn *from our sample*, with replacement. The blue bar marks the middle 95% of them, a **95% confidence interval**.

Play with it:

- **Sample size** up: the interval narrows, roughly with √n, just as lesson 15 predicts.
- **Confidence level** up: the interval widens. More confidence costs precision.
- **Statistic → median**: the bootstrap distribution is lumpy, because a median of a few distinct scores can only take a few values. There's no simple formula for the median's standard error, and the bootstrap doesn't need one.

The **bootstrap** idea: we can't draw new samples from the population, but the sample is our best picture of the population. So we draw from the sample, and see how much the statistic varies. Resampling *with replacement* matters: each resample repeats some values and leaves others out, which mimics the variation between real samples.

What a 95% confidence interval means is subtle. It is **not** "a 95% probability the true value is in this interval": the true value is fixed, and this interval either contains it or not. It means: *the procedure* produces intervals that contain the true value in 95% of samples. Report intervals, not only point estimates: "mean 71 (95% CI 68 to 74)" says how much to trust the 71.

<!-- javascript -->
Resampling is a hot loop: 10,000 resamples × 240 values is 2.4 million random picks. Two habits keep loops like this fast:

**Typed arrays.** `new Float64Array(n)` is a fixed-length array of 64-bit floats, stored contiguously like in C. It is initialised to zeros, can't hold anything but numbers, and the engine can optimise loops over it well. `Float32Array`, `Int32Array` and `Uint8Array` exist too. Three.js uses `Float32Array` for every vertex position (lesson 21).

**Reuse buffers.** Allocating a new array per resample creates garbage for the collector to clean up. Allocate one buffer outside the loop and overwrite it:

```js
const buf = new Float64Array(sample.length)
for (let b = 0; b < B; b++) {
  for (let i = 0; i < buf.length; i++) buf[i] = sample[Math.floor(random() * sample.length)]
  stats[b] = d3.mean(buf)
}
```

**Measure, don't guess.** `performance.now()` is a high-resolution timestamp in milliseconds:

```js
const t0 = performance.now()
// ... work ...
log('took', performance.now() - t0, 'ms')
```

One gotcha: `typedArray.sort()` sorts *numerically*, unlike a normal array's default string sort (lesson 9).

<!-- maths -->
When the CLT applies, the classic interval for a mean is

$$
\bar{x} \pm t_{n-1,\,0.975}\,\frac{s}{\sqrt{n}}
$$

where $t$ is about 2 for moderate $n$ (and about 1.96 for large $n$). The bootstrap **percentile interval** instead takes the 2.5th and 97.5th percentiles of the bootstrap statistics $\hat\theta^*_1, \dots, \hat\theta^*_B$.

Why it works is the **plug-in principle**: the empirical distribution $\hat F$ (each observed value with probability $1/n$) approximates the true $F$. Then the variation of $\hat\theta^*$ around $\hat\theta$ under $\hat F$ approximates the variation of $\hat\theta$ around $\theta$ under $F$. With $B$ resamples, the Monte Carlo error in a percentile shrinks like $1/\sqrt{B}$, which is why a few thousand resamples is usual.

<!-- code -->
```js
const sales = load('cafe').map(d => d.sales)
log('days:', sales.length, ' median daily sales:', d3.median(sales))

// One bootstrap resample, as a starting point.
const random = rng(7)
const resample = Array.from(sales, () => sales[Math.floor(random() * sales.length)])
log('median of one resample:', d3.median(resample))

// Task: 2000 resamples → a 95% interval for the median.
return null
```

<!-- task -->
Using `rng(7)` (as above), compute the median of **2000** bootstrap resamples of `sales` into a `Float64Array`. Use one reusable buffer, and time the loop with `performance.now()`.

Sort the medians and **return** `[lo, hi]`, the 2.5% and 97.5% quantiles (`d3.quantile`). Draw their histogram with the interval marked. The checker allows 3% either way, since resampling in a different order uses different random numbers.

<!-- solution -->
```js
const sales = load('cafe').map(d => d.sales)
const random = rng(7)
const B = 2000
const medians = new Float64Array(B)
const buf = new Float64Array(sales.length)
const t0 = performance.now()
for (let b = 0; b < B; b++) {
  for (let i = 0; i < buf.length; i++) buf[i] = sales[Math.floor(random() * sales.length)]
  medians[b] = d3.median(buf)
}
log('took', (performance.now() - t0).toFixed(1), 'ms')
medians.sort()
const lo = d3.quantile(medians, 0.025), hi = d3.quantile(medians, 0.975)

const { g, w, h } = frame()
const x = d3.scaleLinear().domain(d3.extent(medians)).nice().range([0, w])
const bins = d3.bin().domain(x.domain()).thresholds(40)(medians)
const y = d3.scaleLinear().domain([0, d3.max(bins, b => b.length)]).range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.selectAll('rect').data(bins).join('rect')
  .attr('x', b => x(b.x0)).attr('width', b => Math.max(0, x(b.x1) - x(b.x0) - 1))
  .attr('y', b => y(b.length)).attr('height', b => h - y(b.length))
  .attr('fill', b => b.x0 >= lo && b.x1 <= hi ? theme.accent : theme.muted)
return [lo, hi]
```
