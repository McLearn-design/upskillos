---
id: wds-17-hypothesis-testing
title: A/B tests, permutations and p-values
part: 4. Uncertainty
summary: Design B converted better than design A. Is that real, or the kind of difference chance produces all the time? Shuffle the labels and find out.
js: composing small functions into pipelines
height: 420
controls: [{"name":"n","label":"Visitors analysed","min":100,"max":2000,"step":50,"value":600},{"name":"perms","label":"Shuffles","min":100,"max":5000,"step":100,"value":2000}]
---

<!-- explore -->
```js
const rows = load('abtest').slice(0, params.n)
const rate = (rs, v) => { const g = rs.filter(d => d.variant === v); return d3.mean(g, d => d.converted) }
const observed = rate(rows, 'B') - rate(rows, 'A')
const labels = rows.map(d => d.variant), outcomes = rows.map(d => d.converted)
const R = rng(17)
const nulls = new Float64Array(params.perms)
const shuffledLabels = labels.slice()
for (let p = 0; p < params.perms; p++) {
  for (let i = shuffledLabels.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [shuffledLabels[i], shuffledLabels[j]] = [shuffledLabels[j], shuffledLabels[i]] }
  let sa = 0, na = 0, sb = 0, nb = 0
  for (let i = 0; i < outcomes.length; i++) shuffledLabels[i] === 'A' ? (sa += outcomes[i], na++) : (sb += outcomes[i], nb++)
  nulls[p] = sb / nb - sa / na
}
const extreme = nulls.filter(v => Math.abs(v) >= Math.abs(observed) - 1e-12).length
const pValue = (extreme + 1) / (params.perms + 1)

const { svg, g, w, h } = frame({ margin: { top: 70 } })
const lim = Math.max(d3.max(nulls, Math.abs), Math.abs(observed)) * 1.1
const x = d3.scaleLinear().domain([-lim, lim]).range([0, w])
const bins = d3.bin().domain(x.domain()).thresholds(50)(nulls)
const y = d3.scaleLinear().domain([0, d3.max(bins, b => b.length)]).range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x).tickFormat(d3.format('+.1%')))
g.selectAll('rect').data(bins).join('rect').attr('x', b => x(b.x0)).attr('width', b => Math.max(0, x(b.x1) - x(b.x0) - 1))
  .attr('y', b => y(b.length)).attr('height', b => h - y(b.length))
  .attr('fill', b => Math.abs((b.x0 + b.x1) / 2) >= Math.abs(observed) ? theme.bad : theme.muted).attr('fill-opacity', 0.75)
g.append('line').attr('x1', x(observed)).attr('x2', x(observed)).attr('y1', -10).attr('y2', h).attr('stroke', theme.accent).attr('stroke-width', 3)
g.append('text').attr('x', x(observed) + 6).attr('y', -12).attr('fill', theme.accent).text('observed ' + d3.format('+.2%')(observed))
svg.append('text').attr('x', 48).attr('y', 22).attr('fill', theme.text).attr('font-weight', 600)
  .text('A: ' + d3.format('.1%')(rate(rows, 'A')) + '   B: ' + d3.format('.1%')(rate(rows, 'B')) + '   p ≈ ' + pValue.toFixed(4))
svg.append('text').attr('x', 48).attr('y', 42).attr('fill', theme.muted).attr('font-size', 12)
  .text('grey/red: differences produced by shuffling the A/B labels (no real effect); red: at least as extreme as observed')
```

<!-- learn -->
The blue line is the difference we observed: B's sign-up rate minus A's. The histogram shows what that difference looks like **when there is no real effect**: we shuffle the A and B labels at random, which keeps every visitor's outcome but breaks any link between design and outcome, and recompute the difference thousands of times. The red bars are shuffles at least as extreme as the real result. Their share is the **p-value**.

Start with few visitors: the observed difference sits comfortably inside the grey pile, so chance alone produces gaps that size all the time. Add visitors: the null pile narrows (the standard error shrinks, lesson 15), the observed difference stays about the same, and the p-value falls.

Even with all 2,000 visitors, p only gets down to about 0.07. Yet the data generator *did* give B a real advantage (12.8% against 10.5%). The test isn't wrong: it is **underpowered**. With a 2-point difference on a base rate near 11%, 1,000 visitors per design is too few to tell signal from noise reliably. "Not significant" means "not enough evidence", never "no effect". Real A/B tests choose their sample size in advance, with a **power calculation**, so a real effect of the size that matters would be detected (usually 80% of the time).

The vocabulary of a **hypothesis test**:

- **Null hypothesis** H₀: there is no difference. Shuffling simulates it exactly.
- **Test statistic**: the number that measures the effect, here the difference in rates.
- **p-value**: the probability, *if H₀ were true*, of a statistic at least as extreme as the one observed.
- If p is below a threshold chosen **in advance** (often 0.05), we call the result **statistically significant**.

What a p-value is **not**:

- It is not the probability that H₀ is true.
- It is not the size of the effect. With enough data, a trivial effect gets a tiny p-value. Always report the **effect size** with a confidence interval: "B converts 2.6 points better (95% CI −0.2 to 5.4)".
- It is not proof. At a 0.05 threshold, 1 in 20 tests of *nothing* comes out "significant". Test 20 button colours and one will "win". That is the **multiple comparisons** problem, and it is why you fix the hypothesis before looking at the data.

Because visitors were assigned to A or B **at random**, a real difference here can be read as *caused by* the design. That randomisation is what lets an experiment answer the causal question that correlation (lesson 12) cannot.

<!-- javascript -->
The permutation test is a pipeline: **group → summarise → compare**. Writing each step as a small function, then composing them, keeps it readable:

```js
const pipe = (...fns) => (input) => fns.reduce((value, fn) => fn(value), input)

const byVariant = rows => d3.group(rows, d => d.variant)
const rates = groups => new Map(Array.from(groups, ([k, v]) => [k, d3.mean(v, d => d.converted)]))
const difference = m => m.get('B') - m.get('A')

const effect = pipe(byVariant, rates, difference)
effect(rows)            // the observed difference
effect(shuffled(rows))  // one draw under the null
```

`pipe` takes any number of functions (`...fns` is a **rest parameter**: all the arguments collected into an array) and returns a new function that passes the input through them in order. Each piece is testable alone, and the same `effect` serves both the real data and every shuffle, so they can't drift apart.

<!-- maths -->
For large samples, the **two-proportion z-test** gives nearly the same answer as the permutation test, with a formula. With conversion rates $\hat p_A, \hat p_B$, group sizes $n_A, n_B$, and the pooled rate $\hat p = \frac{x_A + x_B}{n_A + n_B}$ (where $x$ counts conversions):

$$
z = \frac{\hat p_B - \hat p_A}{\sqrt{\hat p (1 - \hat p)\left(\frac{1}{n_A} + \frac{1}{n_B}\right)}}
$$

Under $H_0$, $z$ is approximately standard normal, so the two-sided p-value is $2\,(1 - \Phi(|z|))$. $|z| > 1.96$ corresponds to $p < 0.05$.

The permutation p-value is computed as $\frac{k + 1}{N + 1}$, where $k$ of the $N$ shuffles were at least as extreme. The $+1$ counts the observed arrangement itself as one of the possible shuffles, so the estimate can never be exactly 0.

<!-- code -->
```js
const rows = load('abtest')
const pipe = (...fns) => (input) => fns.reduce((value, fn) => fn(value), input)

const byVariant = rs => d3.group(rs, d => d.variant)
const rates = groups => new Map(Array.from(groups, ([k, v]) => [k, d3.mean(v, d => d.converted)]))
const difference = m => m.get('B') - m.get('A')
const effect = pipe(byVariant, rates, difference)

log('observed difference B − A:', effect(rows))
const counts = d3.rollup(rows, v => ({ n: v.length, x: d3.sum(v, d => d.converted) }), d => d.variant)
log('counts:', Object.fromEntries(counts))

// Task: the z statistic, by composing small functions.
return null
```

<!-- task -->
Using `counts`, compute the **two-proportion z statistic** from the maths section (the pooled rate, the standard error, then z), each step as its own small function. Draw the observed rates of A and B as two bars.

**Return** `[difference, z]`, both rounded to 4 decimal places. Is |z| above 1.96?

<!-- solution -->
```js
const rows = load('abtest')
const pipe = (...fns) => (input) => fns.reduce((value, fn) => fn(value), input)
const byVariant = rs => d3.group(rs, d => d.variant)
const rates = groups => new Map(Array.from(groups, ([k, v]) => [k, d3.mean(v, d => d.converted)]))
const difference = m => m.get('B') - m.get('A')
const effect = pipe(byVariant, rates, difference)

const counts = d3.rollup(rows, v => ({ n: v.length, x: d3.sum(v, d => d.converted) }), d => d.variant)
const A = counts.get('A'), B = counts.get('B')
const pooled = (a, b) => (a.x + b.x) / (a.n + b.n)
const standardError = (a, b) => { const p = pooled(a, b); return Math.sqrt(p * (1 - p) * (1 / a.n + 1 / b.n)) }
const zStat = (a, b) => (b.x / b.n - a.x / a.n) / standardError(a, b)

const diff = effect(rows), z = zStat(A, B)
log('difference', diff, 'z', z, Math.abs(z) > 1.96 ? 'significant at 0.05' : 'not significant at 0.05')

const { g, w, h } = frame()
const data = [['A', A.x / A.n], ['B', B.x / B.n]]
const x = d3.scaleBand().domain(['A', 'B']).range([0, w]).padding(0.4)
const y = d3.scaleLinear().domain([0, 0.2]).range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y).tickFormat(d3.format('.0%')))
g.selectAll('rect').data(data).join('rect').attr('x', d => x(d[0])).attr('width', x.bandwidth())
  .attr('y', d => y(d[1])).attr('height', d => h - y(d[1])).attr('fill', theme.accent)
const r4 = v => Math.round(v * 10000) / 10000
return [r4(diff), r4(z)]
```
