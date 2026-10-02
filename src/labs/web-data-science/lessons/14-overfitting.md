---
id: wds-14-overfitting
title: Overfitting, train and test
part: 3. Relationships and models
summary: A flexible enough model can pass through every training point and still predict badly. Hold data back, measure on it, and rein the model in.
js: pure functions, not mutating inputs, and a seeded shuffle
height: 400
controls: [{"name":"degree","label":"Polynomial degree","min":0,"max":12,"step":1,"value":3},{"name":"logLambda","label":"Regularisation, log10 λ","min":-8,"max":2,"step":0.5,"value":-8},{"name":"n","label":"Training points","min":8,"max":60,"step":1,"value":15},{"name":"seed","label":"Which random sample","min":1,"max":20,"step":1,"value":1}]
---

<!-- explore -->
```js
const R = rng(params.seed)
const truth = x => Math.sin(2.5 * x)
const sample = n => Array.from({ length: n }, () => { const x = R() * 2 - 1; return { x, y: truth(x) + R.normal(0, 0.25) } })
const train = sample(params.n), test = sample(200)
const lambda = 10 ** params.logLambda

function fit(points, degree) {
  const X = points.map(p => d3.range(degree + 1).map(k => p.x ** k))
  const Xt = math.transpose(X)
  const A = math.add(math.multiply(Xt, X), math.multiply(lambda, math.identity(degree + 1)))
  const beta = math.lusolve(A, math.multiply(Xt, points.map(p => p.y))).toArray().flat()
  return x => d3.sum(beta, (b, k) => b * x ** k)
}
const rmse = (f, pts) => Math.sqrt(d3.mean(pts, p => (p.y - f(p.x)) ** 2))
const curve = d3.range(0, 13).map(d => { const f = fit(train, d); return { d, train: rmse(f, train), test: rmse(f, test) } })
const f = fit(train, params.degree)

const left = Math.min(width * 0.62, width - 200)
const { svg, g, h } = frame({ margin: { top: 30 } })
const w = left - 64
const x = d3.scaleLinear().domain([-1, 1]).range([0, w])
const y = d3.scaleLinear().domain([-2, 2]).range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x).ticks(5))
g.append('g').call(d3.axisLeft(y).ticks(5))
g.selectAll('circle.test').data(test).join('circle').attr('class', 'test').attr('cx', d => x(d.x)).attr('cy', d => y(d.y)).attr('r', 2).attr('fill', theme.muted).attr('fill-opacity', 0.35)
g.append('path').attr('fill', 'none').attr('stroke', theme.good).attr('stroke-dasharray', 4).attr('d', d3.line().x(d => x(d)).y(d => y(truth(d)))(d3.ticks(-1, 1, 100)))
g.append('clipPath').attr('id', 'wds-clip').append('rect').attr('width', w).attr('height', h)
g.append('path').attr('clip-path', 'url(#wds-clip)').attr('fill', 'none').attr('stroke', theme.accent2).attr('stroke-width', 2.5).attr('d', d3.line().x(d => x(d)).y(d => y(f(d)))(d3.ticks(-1, 1, 300)))
g.selectAll('circle.train').data(train).join('circle').attr('class', 'train').attr('cx', d => x(d.x)).attr('cy', d => y(d.y)).attr('r', 4).attr('fill', theme.accent)
g.append('text').attr('y', -12).attr('fill', theme.text).attr('font-weight', 600).text('degree ' + params.degree + ': train RMSE ' + curve[params.degree].train.toFixed(3) + ', test RMSE ' + curve[params.degree].test.toFixed(3))

const g2 = svg.append('g').attr('transform', 'translate(' + (left + 46) + ',30)')
const w2 = width - left - 66
const x2 = d3.scaleLinear().domain([0, 12]).range([0, w2])
const y2 = d3.scaleLinear().domain([0, 1]).range([h, 0])
g2.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x2).ticks(4))
g2.append('g').call(d3.axisLeft(y2).ticks(5))
g2.append('text').attr('y', -12).attr('fill', theme.text).text('error by degree')
;[['train', theme.accent], ['test', theme.accent2]].forEach(([k, c]) => g2.append('path').attr('fill', 'none').attr('stroke', c).attr('stroke-width', 2)
  .attr('d', d3.line().x(d => x2(d.d)).y(d => y2(Math.min(1, d[k])))(curve)))
g2.append('line').attr('x1', x2(params.degree)).attr('x2', x2(params.degree)).attr('y1', 0).attr('y2', h).attr('stroke', theme.muted).attr('stroke-dasharray', 3)
```

<!-- learn -->
Blue dots are the **training** data the curve is fitted to; grey dots are fresh **test** data from the same process; the dashed green line is the truth that generated both. Raise the degree from 0 to 12:

- **Degree 0–1** is too stiff to follow the wave: high error on train *and* test. This is **underfitting** (high bias).
- **Degree 3–5** follows the truth: both errors low.
- **Degree 10+** with few points chases the noise. Training error keeps falling, but the curve swings wildly between points, and test error shoots up. This is **overfitting** (high variance).

The right-hand panel is the whole story in one picture: training error only ever goes down as the model gets more flexible, while test error falls and then rises. **Training error is not an honest estimate of how a model will do on new data.** Change the random sample with the seed slider: the overfitted curve changes completely each time, while the degree-3 curve hardly moves.

Two cures, both in the sliders:

- **More data.** Push the training points up to 60, and even degree 12 behaves.
- **Regularisation.** Raise λ. Ridge regression adds a penalty on large coefficients, so the curve has to *earn* its wiggles. A high-degree model with a good λ does as well as the right low-degree one.

The workflow every model in this course should follow:

1. **Split** the data at random: a training set (often 80%) and a test set (20%) you don't look at.
2. Fit, and choose settings (degree, λ), using the training data only, ideally with **cross-validation**: rotate which part of the training data is held out.
3. Report the error on the **test set**, once, at the end.

<!-- javascript -->
**Pure functions** return a result computed only from their arguments, and change nothing outside themselves. `fit(points, degree)` in the figure is pure: same input, same model, and the input array is left alone. Pure functions are easy to test and safe to call twice.

The opposite, mutating an input, causes some of the hardest bugs in data code:

```js
function split(rows) {
  rows.sort(() => Math.random() - 0.5)  // 1. mutates the caller's array! 2. biased shuffle
  return [rows.slice(0, 80), rows.slice(80)]
}
```

A correct shuffle is the **Fisher–Yates** algorithm: walk from the end, swapping each position with a random earlier (or the same) position. Do it on a **copy**, with a **seeded** generator so the split is reproducible:

```js
function shuffled(items, random) {
  const a = [...items]                         // copy: the input is untouched
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))   // 0 ≤ j ≤ i
    ;[a[i], a[j]] = [a[j], a[i]]               // swap by destructuring
  }
  return a
}
```

The `;` before `[` stops JavaScript from reading the line as part of the previous one, a classic trap when you leave out semicolons.

<!-- maths -->
For a new point, the expected squared error of a fitted model $\hat{f}$ splits into three parts:

$$
\mathbb{E}\big[(y - \hat{f}(x))^2\big]
= \underbrace{\big(\mathbb{E}[\hat{f}(x)] - f(x)\big)^2}_{\text{bias}^2}
+ \underbrace{\mathrm{Var}\big[\hat{f}(x)\big]}_{\text{variance}}
+ \underbrace{\sigma^2}_{\text{noise}}
$$

Flexible models lower the bias and raise the variance (the curve depends a lot on which sample you happened to get). The noise $\sigma^2$ is a floor no model can go below; here $\sigma = 0.25$, so no test RMSE can beat about 0.25 on average.

**Ridge regression** minimises the squared error plus a penalty:

$$
\min_\beta \;\lVert y - X\beta\rVert^2 + \lambda \lVert \beta \rVert^2
\quad\Rightarrow\quad
\beta = (X^\top X + \lambda I)^{-1} X^\top y
$$

Adding $\lambda I$ also makes the system well-conditioned, which is why the figure never fails even at degree 12 with 8 points: there, $X^\top X$ alone is nearly singular.

<!-- code -->
```js
const students = load('students')

function shuffled(items, random) {
  const a = [...items]
  // Task: Fisher–Yates goes here.
  return a
}
const rows = shuffled(students, rng(42))
log('first five ids after shuffling:', rows.slice(0, 5).map(d => d.id))

function fitLine(points) {
  const mx = d3.mean(points, d => d.hours), my = d3.mean(points, d => d.score)
  const slope = d3.sum(points, d => (d.hours - mx) * (d.score - my)) / d3.sum(points, d => (d.hours - mx) ** 2)
  return x => my + slope * (x - mx)
}

// Task: split, fit on train, measure on test.
return null
```

<!-- task -->
1. Finish `shuffled` with Fisher–Yates, exactly as in the JavaScript section (loop `i` from the end down to 1, `j = Math.floor(random() * (i + 1))`).
2. The first 192 shuffled rows (80%) are the training set, the other 48 the test set.
3. Fit `score` from `hours` on the training set with `fitLine`, and compute the RMSE (the square root of the mean squared error) on **both** sets. Log both.

**Return** the test RMSE rounded to 3 decimal places. Is it higher or lower than the training RMSE?

<!-- solution -->
```js
const students = load('students')

function shuffled(items, random) {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const rows = shuffled(students, rng(42))
const train = rows.slice(0, 192), test = rows.slice(192)

function fitLine(points) {
  const mx = d3.mean(points, d => d.hours), my = d3.mean(points, d => d.score)
  const slope = d3.sum(points, d => (d.hours - mx) * (d.score - my)) / d3.sum(points, d => (d.hours - mx) ** 2)
  return x => my + slope * (x - mx)
}
const f = fitLine(train)
const rmse = pts => Math.sqrt(d3.mean(pts, d => (d.score - f(d.hours)) ** 2))
log('train RMSE', rmse(train), 'test RMSE', rmse(test))
return Math.round(rmse(test) * 1000) / 1000
```
