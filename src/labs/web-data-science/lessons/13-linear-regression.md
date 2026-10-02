---
id: wds-13-linear-regression
title: Fitting a line, least squares
part: 3. Relationships and models
summary: Fit a line by hand with sliders and watch the squared errors, then let the formula find the best one. Extend it to several inputs with matrices and math.js.
js: classes, methods and private fields
height: 400
controls: [{"name":"slope","label":"Slope (points per hour)","min":-4,"max":12,"step":0.1,"value":2},{"name":"intercept","label":"Intercept","min":0,"max":100,"step":0.5,"value":55},{"name":"squares","label":"Draw the squared errors","options":["yes","no"],"value":"yes"},{"name":"best","label":"Show the least-squares line","options":["no","yes"],"value":"no"}]
---

<!-- explore -->
```js
const students = load('students').slice(0, 40)
const xs = students.map(d => d.hours), ys = students.map(d => d.score)
const mx = d3.mean(xs), my = d3.mean(ys)
const bestSlope = d3.sum(xs, (x, i) => (x - mx) * (ys[i] - my)) / d3.sum(xs, x => (x - mx) ** 2)
const bestIntercept = my - bestSlope * mx
const sse = (b0, b1) => d3.sum(xs, (x, i) => (ys[i] - (b0 + b1 * x)) ** 2)
const mine = sse(params.intercept, params.slope), best = sse(bestIntercept, bestSlope)

const { g, w, h } = frame({ margin: { top: 50, right: 20 } })
const x = d3.scaleLinear().domain([0, 12]).range([0, w])
const y = d3.scaleLinear().domain([0, 110]).range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y))
g.append('text').attr('x', w).attr('y', h - 6).attr('text-anchor', 'end').attr('fill', theme.muted).text('hours studied')
const pred = xv => params.intercept + params.slope * xv
if (params.squares === 'yes') g.selectAll('rect.sq').data(students).join('rect').attr('class', 'sq')
  .each(function (d) {
    const e = d.score - pred(d.hours)
    const side = Math.abs(y(0) - y(Math.abs(e)))
    d3.select(this).attr('x', x(d.hours)).attr('y', e > 0 ? y(d.score) : y(pred(d.hours)))
      .attr('width', side).attr('height', side)
  })
  .attr('fill', theme.accent2).attr('fill-opacity', 0.12).attr('stroke', theme.accent2).attr('stroke-opacity', 0.4)
g.selectAll('line.res').data(students).join('line').attr('class', 'res')
  .attr('x1', d => x(d.hours)).attr('x2', d => x(d.hours)).attr('y1', d => y(d.score)).attr('y2', d => y(pred(d.hours)))
  .attr('stroke', theme.accent2)
g.selectAll('circle').data(students).join('circle').attr('cx', d => x(d.hours)).attr('cy', d => y(d.score)).attr('r', 3.5).attr('fill', theme.accent)
g.append('line').attr('x1', x(0)).attr('x2', x(12)).attr('y1', y(pred(0))).attr('y2', y(pred(12))).attr('stroke', theme.text).attr('stroke-width', 2)
if (params.best === 'yes') g.append('line').attr('x1', x(0)).attr('x2', x(12))
  .attr('y1', y(bestIntercept)).attr('y2', y(bestIntercept + 12 * bestSlope)).attr('stroke', theme.good).attr('stroke-width', 2).attr('stroke-dasharray', 6)
g.append('text').attr('y', -32).attr('fill', theme.text).attr('font-weight', 600)
  .text('Your line: score = ' + params.intercept + ' + ' + params.slope + ' × hours')
g.append('text').attr('y', -14).attr('fill', mine <= best * 1.02 ? theme.good : theme.text)
  .text('Sum of squared errors: ' + Math.round(mine) + '   (best possible: ' + Math.round(best) + ')')
```

<!-- learn -->
Each pink line is a **residual**: how far the line misses one student. Each square has that miss as its side, so its area is the squared error. Move the slope and intercept to make the total area as small as you can, then turn on the least-squares line to see how close you got. You'll notice that tilting the line around the point (mean hours, mean score) changes things much less than moving it away from that point. The best line always passes through it.

A **linear model** predicts $y$ (score) from $x$ (hours) with two numbers:

- the **intercept**: the prediction when $x = 0$;
- the **slope**: how much the prediction changes per one unit of $x$. Here, "points per extra hour of study", *on average, in this data*.

**Least squares** picks the line with the smallest sum of squared residuals. Squaring makes every miss count as positive, punishes big misses much more than small ones and, conveniently, gives an exact formula (see the maths).

How good is the fit? **R²** is the fraction of the variance in $y$ the line explains: 0 means no better than predicting the mean for everyone, 1 means perfect. Always also look at the **residuals**: if they show a pattern (a curve, a funnel), a straight line is the wrong model.

Two warnings:

- **Extrapolation.** The data covers about 0–12 hours. The line keeps going forever, but the evidence doesn't.
- **Slope is not effect.** Without an experiment, the slope describes an association (lesson 12), not what would happen if a student studied an hour more.

With **several inputs** (hours, sleep, prior score) the model becomes $\hat{y} = b_0 + b_1 x_1 + b_2 x_2 + b_3 x_3$. The neatest way to fit it is with matrices, which is what math.js is for.

<!-- javascript -->
A **class** bundles data with the functions that use it. Models are a natural fit: they have learned parameters and the methods `fit` and `predict`.

```js
class LinearModel {
  #slope = 0          // private fields: only methods of this class can see them
  #intercept = 0

  fit(xs, ys) {
    const mx = d3.mean(xs), my = d3.mean(ys)
    this.#slope = d3.sum(xs, (x, i) => (x - mx) * (ys[i] - my)) / d3.sum(xs, x => (x - mx) ** 2)
    this.#intercept = my - this.#slope * mx
    return this                 // so you can write new LinearModel().fit(xs, ys)
  }
  predict(x) { return this.#intercept + this.#slope * x }
  get slope() { return this.#slope }   // a read-only property
}

const model = new LinearModel().fit(hours, scores)
model.predict(5)
model.slope        // works
model.#slope       // SyntaxError: private
```

`new` creates an object; inside methods, `this` is that object. A `get` accessor looks like a property from outside but runs a function. The `#` fields are truly private, so no outside code can put the model into an inconsistent state.

<!-- maths -->
Minimise $S(b_0, b_1) = \sum_i (y_i - b_0 - b_1 x_i)^2$. Setting both partial derivatives to zero:

$$
\frac{\partial S}{\partial b_0} = -2\sum_i (y_i - b_0 - b_1 x_i) = 0
\;\Rightarrow\; b_0 = \bar{y} - b_1 \bar{x}
$$

$$
\frac{\partial S}{\partial b_1} = -2\sum_i x_i (y_i - b_0 - b_1 x_i) = 0
\;\Rightarrow\; b_1 = \frac{\sum_i (x_i - \bar{x})(y_i - \bar{y})}{\sum_i (x_i - \bar{x})^2}
$$

The first line is why the best line passes through $(\bar{x}, \bar{y})$.

With $p$ inputs, stack a column of ones and the inputs into the **design matrix** $X$ ($n \times (p+1)$) and the targets into $y$. Minimising $\lVert y - X\beta \rVert^2$ gives the **normal equations**:

$$
X^\top X \beta = X^\top y \quad\Rightarrow\quad \beta = (X^\top X)^{-1} X^\top y
$$

In practice you *solve* the system (`math.lusolve`) rather than invert the matrix: it is faster and more accurate.

$$
R^2 = 1 - \frac{\sum_i (y_i - \hat{y}_i)^2}{\sum_i (y_i - \bar{y})^2}
$$

<!-- code -->
```js
const students = load('students')

class LinearModel {
  #slope = 0
  #intercept = 0
  fit(xs, ys) {
    const mx = d3.mean(xs), my = d3.mean(ys)
    this.#slope = d3.sum(xs, (x, i) => (x - mx) * (ys[i] - my)) / d3.sum(xs, x => (x - mx) ** 2)
    this.#intercept = my - this.#slope * mx
    return this
  }
  predict(x) { return this.#intercept + this.#slope * x }
  get slope() { return this.#slope }
}

const model = new LinearModel().fit(students.map(d => d.hours), students.map(d => d.score))
log('one input: each extra hour ≈', model.slope.toFixed(2), 'points')

// math.js works with matrices: here is a tiny example.
const A = math.matrix([[2, 1], [1, 3]])
const b = [3, 5]
log('solve A·v = b:', math.lusolve(A, b).toArray().flat())

// Task: fit score from hours, sleep and prior together.
return null
```

<!-- task -->
Build the design matrix `X` (one row per student: `[1, hours, sleep, prior]`) and the vector `y` of scores. Solve the normal equations $X^\top X\,\beta = X^\top y$ with `math.transpose`, `math.multiply` and `math.lusolve`.

**Return** the four coefficients `[b0, b1, b2, b3]`, each rounded to 3 decimal places. Then draw predicted against actual scores: a good model puts the points along the diagonal.

<!-- solution -->
```js
const students = load('students')
const X = students.map(d => [1, d.hours, d.sleep, d.prior])
const y = students.map(d => d.score)

const Xt = math.transpose(X)
const beta = math.lusolve(math.multiply(Xt, X), math.multiply(Xt, y)).flat()
const coef = beta.map(v => Math.round(v * 1000) / 1000)
log('score ≈', coef[0], '+', coef[1], '× hours +', coef[2], '× sleep +', coef[3], '× prior')

const predicted = X.map(row => d3.sum(row, (v, i) => v * beta[i]))
const ssRes = d3.sum(y, (v, i) => (v - predicted[i]) ** 2)
const ssTot = d3.sum(y, v => (v - d3.mean(y)) ** 2)
log('R² =', 1 - ssRes / ssTot)

const { g, w, h } = frame()
const s = d3.scaleLinear().domain([0, 100]).range([0, Math.min(w, h)])
const ys = d3.scaleLinear().domain([0, 100]).range([Math.min(w, h), 0])
g.append('g').attr('transform', 'translate(0,' + Math.min(w, h) + ')').call(d3.axisBottom(s))
g.append('g').call(d3.axisLeft(ys))
g.append('line').attr('x1', s(0)).attr('y1', ys(0)).attr('x2', s(100)).attr('y2', ys(100)).attr('stroke', theme.muted).attr('stroke-dasharray', 4)
g.selectAll('circle').data(y).join('circle')
  .attr('cx', (d, i) => s(predicted[i])).attr('cy', d => ys(d)).attr('r', 3).attr('fill', theme.accent).attr('fill-opacity', 0.6)
return coef
```
