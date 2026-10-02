---
id: wds-15-sampling-and-the-clt
title: Sampling and the central limit theorem
part: 4. Uncertainty
summary: Take many samples, average each one, and the averages pile up into a bell curve, whatever the shape you started with. That pile is why statistics works.
js: generator functions and iterators
height: 420
tolerance: 0.08
controls: [{"name":"shape","label":"Population shape","options":["skewed (exponential)","uniform","two humps","dice (1–6)"],"value":"skewed (exponential)"},{"name":"n","label":"Sample size n","min":1,"max":100,"step":1,"value":5},{"name":"samples","label":"Number of samples","min":50,"max":3000,"step":50,"value":1500}]
---

<!-- explore -->
```js
const R = rng(3)
const draw = {
  'skewed (exponential)': () => -Math.log(1 - R()) * 10,
  uniform: () => R() * 30,
  'two humps': () => (R() < 0.5 ? R.normal(8, 2.5) : R.normal(24, 2.5)),
  'dice (1–6)': () => 1 + Math.floor(R() * 6),
}[params.shape]
const population = Array.from({ length: 20000 }, draw)
const mu = d3.mean(population), sigma = d3.deviation(population)
const domain = d3.extent(population)

const top = (height - 60) * 0.38, bottom = (height - 60) * 0.62
const svg = d3.select(el).append('svg').attr('width', width).attr('height', height)
const x = d3.scaleLinear().domain(domain).nice().range([50, width - 20])
function hist(gy, gh, values, color, label, density) {
  const g = svg.append('g').attr('transform', 'translate(0,' + gy + ')')
  const bins = d3.bin().domain(x.domain()).thresholds(60)(values)
  const dens = b => b.length / values.length / (b.x1 - b.x0)
  const yMax = Math.max(d3.max(bins, dens), density ? density(mu) : 0)
  const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([gh, 0])
  g.selectAll('rect').data(bins).join('rect').attr('x', b => x(b.x0)).attr('width', b => Math.max(0, x(b.x1) - x(b.x0) - 1))
    .attr('y', b => y(dens(b))).attr('height', b => gh - y(dens(b))).attr('fill', color).attr('fill-opacity', 0.6)
  g.append('g').attr('transform', 'translate(0,' + gh + ')').call(d3.axisBottom(x).ticks(8))
  g.append('text').attr('x', 50).attr('y', 4).attr('fill', theme.text).attr('font-weight', 600).text(label)
  if (density) g.append('path').attr('fill', 'none').attr('stroke', theme.bad).attr('stroke-width', 2)
    .attr('d', d3.line().x(d => x(d)).y(d => y(density(d)))(d3.ticks(x.domain()[0], x.domain()[1], 300)))
  return g
}
hist(10, top, population.slice(0, 5000), theme.muted, 'Population: mean ' + mu.toFixed(2) + ', SD ' + sigma.toFixed(2))

const se = sigma / Math.sqrt(params.n)
const normal = t => Math.exp(-0.5 * ((t - mu) / se) ** 2) / (se * Math.sqrt(2 * Math.PI))
const means = []
let layer = null
animate(() => {
  if (means.length >= params.samples) return
  for (let k = 0; k < Math.max(10, params.samples / 60) && means.length < params.samples; k++) {
    let s = 0
    for (let i = 0; i < params.n; i++) s += draw()
    means.push(s / params.n)
  }
  layer?.remove()
  layer = hist(top + 50, bottom, means, theme.accent,
    means.length + ' sample means (n = ' + params.n + '): SD ' + d3.deviation(means)?.toFixed(3) + ', theory σ/√n = ' + se.toFixed(3), normal)
})
```

<!-- learn -->
The grey histogram is a **population**, deliberately not bell-shaped. Below it, each blue observation is the **mean of a sample** of n values drawn from that population. Start with n = 1: the means are just single draws, so the blue histogram copies the grey one. Now raise n to 5, 20, 100. Two things happen:

1. The blue histogram turns into a **bell curve**, and matches the red normal curve, even for the lopsided exponential, the two humps and the dice.
2. It gets **narrower**. Its spread is close to σ/√n: to halve it you need four times the sample size.

This is the **central limit theorem** (CLT), and it is the reason we can say anything about a population from one sample:

- The mean of one sample is one draw from that blue distribution: the **sampling distribution** of the mean.
- Its centre is the true mean, so the sample mean is **unbiased**.
- Its spread, the **standard error** σ/√n, tells you how far a sample mean typically lands from the truth.
- Because it is approximately normal, about 95% of sample means fall within 2 standard errors of the true mean. Lesson 16 turns that into a confidence interval.

Caveats: "large enough n" depends on the population (very skewed data needs more), the samples must be **independent and random**, and the CLT is about **means** (and sums). Medians and maximums have their own sampling distributions, which the bootstrap handles.

<!-- javascript -->
A **generator function**, written `function*`, can pause. Each `yield` hands out one value and freezes the function until someone asks for the next:

```js
function* counter() {
  let i = 0
  while (true) yield i++        // infinite, and that's fine: it's lazy
}
const it = counter()            // nothing runs yet
it.next()                       // { value: 0, done: false }
it.next().value                 // 1
```

Generators are **iterators**, so `for...of`, spread and `Array.from` all work on them, as long as they end. To cut an infinite generator short, write another generator:

```js
function* take(iterable, k) {
  if (k <= 0) return
  for (const v of iterable) {
    yield v
    if (--k <= 0) return
  }
}
[...take(counter(), 3)]          // [0, 1, 2]
```

Why bother? A stream of samples is naturally infinite. A generator separates *producing* values from *deciding how many you need*, and keeps only one value in memory at a time.

<!-- maths -->
If $X_1, \dots, X_n$ are independent with mean $\mu$ and variance $\sigma^2$, the sample mean $\bar{X} = \frac{1}{n}\sum X_i$ has

$$
\mathbb{E}[\bar{X}] = \mu, \qquad
\mathrm{Var}[\bar{X}] = \frac{1}{n^2}\sum_{i=1}^{n}\mathrm{Var}[X_i] = \frac{\sigma^2}{n}
$$

(variances of independent variables add). So the **standard error** is $\sigma/\sqrt{n}$.

The **central limit theorem** says more: the *shape* tends to normal,

$$
\frac{\bar{X} - \mu}{\sigma / \sqrt{n}} \;\xrightarrow{d}\; \mathcal{N}(0, 1) \quad \text{as } n \to \infty
$$

For one uniform draw on $[0, 1]$: $\mu = \tfrac12$, $\sigma^2 = \tfrac{1}{12}$. So the mean of 25 has standard error $\sqrt{1/12}/5 \approx 0.0577$, which you can check in the task.

<!-- code -->
```js
// An infinite stream of numbers from a seeded generator.
function* uniforms(random) {
  while (true) yield random()
}
function* take(iterable, k) {
  if (k <= 0) return
  for (const v of iterable) {
    yield v
    if (--k <= 0) return
  }
}
log('five uniforms:', [...take(uniforms(rng(1)), 5)])

// Task: a stream of sample means, and the spread of 2000 of them.
function* sampleMeans(random, n) {
  // yield the mean of n draws, forever
}
const means = [...take(sampleMeans(rng(1), 25), 2000)]
log('means collected:', means.length)
return null
```

<!-- task -->
1. Write the generator `sampleMeans(random, n)`: forever, draw `n` values with `random()`, and `yield` their mean.
2. Collect 2000 means of samples of size 25, and draw their histogram with `d3.bin`.
3. **Return** the standard deviation of the 2000 means (`d3.deviation`). The maths section predicts about 0.0577. The checker accepts anything within 8% of the reference answer, since a different but correct method uses different random numbers.

<!-- solution -->
```js
function* take(iterable, k) {
  if (k <= 0) return
  for (const v of iterable) {
    yield v
    if (--k <= 0) return
  }
}
function* sampleMeans(random, n) {
  while (true) {
    let sum = 0
    for (let i = 0; i < n; i++) sum += random()
    yield sum / n
  }
}
const means = [...take(sampleMeans(rng(1), 25), 2000)]

const { g, w, h } = frame()
const x = d3.scaleLinear().domain([0.3, 0.7]).range([0, w])
const bins = d3.bin().domain(x.domain()).thresholds(40)(means)
const y = d3.scaleLinear().domain([0, d3.max(bins, b => b.length)]).nice().range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
g.selectAll('rect').data(bins).join('rect')
  .attr('x', b => x(b.x0) + 1).attr('width', b => Math.max(0, x(b.x1) - x(b.x0) - 1))
  .attr('y', b => y(b.length)).attr('height', b => h - y(b.length)).attr('fill', theme.accent)
log('SD of means:', d3.deviation(means), ' theory:', Math.sqrt(1 / 12) / 5)
return d3.deviation(means)
```
