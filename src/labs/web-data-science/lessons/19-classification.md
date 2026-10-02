---
id: wds-19-classification
title: Classification and gradient descent
part: 6. Machine learning
summary: Teach a model to separate two classes by nudging its weights downhill, and watch the decision boundary move as it learns. Then judge it with more than accuracy.
js: configuration objects, typed arrays, and an animation loop
height: 440
controls: [{"name":"features","label":"Features","options":["x, y (straight boundary)","+ squares and product (curved)","+ cubes (more curved)"],"value":"+ squares and product (curved)"},{"name":"lr","label":"Learning rate","min":0.01,"max":3,"step":0.01,"value":0.5},{"name":"threshold","label":"Decision threshold","min":0.05,"max":0.95,"step":0.05,"value":0.5},{"name":"epochs","label":"Training steps","min":10,"max":2000,"step":10,"value":800}]
---

<!-- explore -->
```js
const data = load('moons')
const featureSets = {
  'x, y (straight boundary)': p => [1, p.x, p.y],
  '+ squares and product (curved)': p => [1, p.x, p.y, p.x * p.x, p.y * p.y, p.x * p.y],
  '+ cubes (more curved)': p => [1, p.x, p.y, p.x * p.x, p.y * p.y, p.x * p.y, p.x ** 3, p.y ** 3, p.x * p.x * p.y, p.x * p.y * p.y],
}
const phi = featureSets[params.features]
const X = data.map(phi), y = data.map(d => d.label)
const wts = new Float64Array(X[0].length)
const sigmoid = z => 1 / (1 + Math.exp(-z))
const predict = f => sigmoid(f.reduce((s, v, j) => s + v * wts[j], 0))

const legendH = 60
const size = Math.max(120, Math.min(width - 230, height - legendH))
const xs = d3.scaleLinear().domain([-1.6, 2.6]).range([0, size])
const ys = d3.scaleLinear().domain([-1.4, 1.6]).range([size, 0])
const canvas = d3.select(el).append('canvas').attr('width', size).attr('height', size)
  .style('position', 'absolute').style('left', '40px').style('top', legendH + 'px').node()
const ctx = canvas.getContext && canvas.getContext('2d')
const svg = d3.select(el).append('svg').attr('width', width).attr('height', height).style('position', 'absolute').style('left', 0).style('top', 0)
const g = svg.append('g').attr('transform', 'translate(40,' + legendH + ')')
g.selectAll('circle').data(data).join('circle').attr('cx', d => xs(d.x)).attr('cy', d => ys(d.y)).attr('r', 3.5)
  .attr('fill', d => d.label ? theme.accent2 : theme.accent).attr('stroke', theme.text).attr('stroke-width', 0.8)
const info = svg.append('g').attr('transform', 'translate(' + (size + 60) + ',' + legendH + ')')
const title = svg.append('text').attr('x', 40).attr('y', 24).attr('fill', theme.text).attr('font-weight', 600)
const lossPts = []
const cell = 6
function render(step, loss) {
  if (ctx) {
    for (let px = 0; px < size; px += cell) for (let py = 0; py < size; py += cell) {
      const p = predict(phi({ x: xs.invert(px + cell / 2), y: ys.invert(py + cell / 2) }))
      ctx.fillStyle = d3.interpolateRgb(theme.accent, theme.accent2)(p)
      ctx.globalAlpha = 0.12 + 0.3 * Math.abs(p - params.threshold) * 2
      ctx.fillRect(px, py, cell, cell)
    }
  }
  let tp = 0, fp = 0, tn = 0, fn = 0
  X.forEach((f, i) => { const yes = predict(f) >= params.threshold; yes ? (y[i] ? tp++ : fp++) : (y[i] ? fn++ : tn++) })
  title.text('step ' + step + '   log-loss ' + loss.toFixed(3) + '   accuracy ' + d3.format('.1%')((tp + tn) / X.length))
  info.selectAll('*').remove()
  const rows = [['', 'predicted 0', 'predicted 1'], ['actual 0', tn, fp], ['actual 1', fn, tp]]
  rows.forEach((r, i) => r.forEach((v, j) => info.append('text').attr('x', j * 70).attr('y', i * 22).attr('font-size', 12)
    .attr('fill', i && j ? (i === j ? theme.good : theme.bad) : theme.muted).text(v)))
  info.append('text').attr('y', 90).attr('font-size', 12).attr('fill', theme.text).text('precision ' + (tp / Math.max(1, tp + fp)).toFixed(3))
  info.append('text').attr('y', 110).attr('font-size', 12).attr('fill', theme.text).text('recall    ' + (tp / Math.max(1, tp + fn)).toFixed(3))
  lossPts.push([step, loss])
  const lx = d3.scaleLinear().domain([0, params.epochs]).range([0, 150]), ly = d3.scaleLinear().domain([0, 0.8]).range([100, 0])
  const lg = info.append('g').attr('transform', 'translate(0,140)')
  lg.append('text').attr('y', -6).attr('font-size', 12).attr('fill', theme.muted).text('loss while training')
  lg.append('path').attr('fill', 'none').attr('stroke', theme.accent).attr('d', d3.line().x(d => lx(d[0])).y(d => ly(Math.min(0.8, d[1])))(lossPts))
  lg.append('g').attr('transform', 'translate(0,100)').call(d3.axisBottom(lx).ticks(3))
}
let step = 0
animate(() => {
  if (step >= params.epochs) return
  let loss = 0
  for (let k = 0; k < 10 && step < params.epochs; k++, step++) {
    const grad = new Float64Array(wts.length)
    loss = 0
    X.forEach((f, i) => {
      const p = predict(f)
      loss -= y[i] ? Math.log(p + 1e-12) : Math.log(1 - p + 1e-12)
      f.forEach((v, j) => { grad[j] += (p - y[i]) * v })
    })
    loss /= X.length
    grad.forEach((gj, j) => { wts[j] -= params.lr * gj / X.length })
  }
  render(step, loss)
})
```

<!-- learn -->
The model is learning live: the background shows the probability it gives to "pink" at every point, and the boundary between colours is where that probability equals the threshold.

- With **x, y** features the boundary can only be a straight line, and the moons can't be separated by one. Accuracy stalls in the 80s.
- Add **squares and a product** and the boundary can bend; add **cubes** and it can bend more.
- Push the **learning rate** too high and the loss jumps around instead of falling. Too low and it crawls.
- Move the **threshold**: precision and recall trade against each other, while the boundary itself (the model) stays the same.

**Classification** predicts a category. **Logistic regression** computes a weighted sum of the features, $z = w \cdot x$, and squashes it into a probability with the S-shaped **sigmoid**. It learns the weights by **gradient descent**: compute how the error would change if each weight moved a little (the gradient), step every weight a little the other way, and repeat. Most of machine learning, neural networks included, trains like this.

**Accuracy** alone hides a lot. The **confusion matrix** counts the four outcomes:

- **Precision** = TP / (TP + FP): of the cases flagged positive, how many really were. Low precision means **false alarms**.
- **Recall** = TP / (TP + FN): of the real positives, how many were caught. Low recall means **misses**.

If 1% of emails are spam, "never spam" is 99% accurate and completely useless (recall 0). Which error is worse depends on the use: a missed tumour costs more than a false alarm, while a spam filter that hides real email is worse than one that lets spam through. The **threshold** is how you choose between them, and it is a decision about costs, not a statistical one.

<!-- javascript -->
**Configuration objects.** A training function with many settings is clearer with one options object and defaults than with a long list of positional arguments:

```js
function train(X, y, { learningRate = 0.5, steps = 500, onStep = () => {} } = {}) {
  const w = new Float64Array(X[0].length)   // all zeros to start
  for (let s = 0; s < steps; s++) {
    // ... compute the gradient, update w ...
    onStep(s, w)
  }
  return w
}
train(X, y, { steps: 1000 })   // every other option keeps its default
```

`onStep` is a **callback hook**: the caller can watch training without the training code knowing about charts.

**Animating a long computation.** A loop of 2000 steps that redraws each time would freeze the page until it finished, because the browser can only paint between your scripts. The figure does a few steps per **animation frame** instead, then returns, so the browser can paint and stay responsive:

```js
let step = 0
animate(() => {                 // called about 60 times a second
  if (step >= total) return
  for (let k = 0; k < 10; k++) trainOneStep()
  render()
})
```

In plain browser code that is `requestAnimationFrame(fn)`, which you call again inside `fn` to keep going (this lab's `animate` does that for you, and cancels it on the next run).

<!-- maths -->
With features $x$ and weights $w$, the model is

$$
p = \sigma(w^\top x), \qquad \sigma(z) = \frac{1}{1 + e^{-z}}
$$

Training minimises the average **log-loss** (cross-entropy):

$$
L(w) = -\frac{1}{n}\sum_{i=1}^{n} \Big[ y_i \log p_i + (1 - y_i)\log(1 - p_i) \Big]
$$

Using $\sigma'(z) = \sigma(z)(1 - \sigma(z))$, the gradient simplifies beautifully:

$$
\nabla_w L = \frac{1}{n}\sum_{i=1}^{n} (p_i - y_i)\, x_i
$$

and gradient descent repeats $w \leftarrow w - \eta\, \nabla_w L$ with learning rate $\eta$. The loss is convex, so with a small enough $\eta$ it reaches the global minimum. Too large an $\eta$ overshoots, which is the oscillation you can see in the figure.

The decision boundary is where $p = t$ for threshold $t$, i.e. where $w^\top x = \log\frac{t}{1-t}$. It is linear in the *features*, so it can be curved in the original $(x, y)$ plane once the features include $x^2$, $xy$ and so on.

<!-- code -->
```js
const data = load('moons')
const phi = p => [1, p.x, p.y, p.x * p.x, p.y * p.y, p.x * p.y]
const X = data.map(phi), y = data.map(d => d.label)
const sigmoid = z => 1 / (1 + Math.exp(-z))

function train(X, y, { learningRate = 0.5, steps = 500 } = {}) {
  const w = new Float64Array(X[0].length)
  for (let s = 0; s < steps; s++) {
    const grad = new Float64Array(w.length)
    X.forEach((f, i) => {
      const p = sigmoid(f.reduce((acc, v, j) => acc + v * w[j], 0))
      f.forEach((v, j) => { grad[j] += (p - y[i]) * v })
    })
    grad.forEach((gj, j) => { w[j] -= learningRate * gj / X.length })
  }
  return w
}
const w = train(X, y)
const probs = X.map(f => sigmoid(f.reduce((acc, v, j) => acc + v * w[j], 0)))
log('weights:', Array.from(w, v => +v.toFixed(3)))

// Task: the confusion matrix at threshold 0.5.
return null
```

<!-- task -->
Using `probs` and the true labels `y`, with **label 1 as the positive class** and threshold 0.5 (predict 1 when `p >= 0.5`), count `tp`, `fp`, `tn` and `fn`.

Draw the points coloured by whether each prediction was right or wrong, and **return** `{ tp, fp, tn, fn, precision, recall }` with precision and recall rounded to 3 decimal places.

<!-- solution -->
```js
const data = load('moons')
const phi = p => [1, p.x, p.y, p.x * p.x, p.y * p.y, p.x * p.y]
const X = data.map(phi), y = data.map(d => d.label)
const sigmoid = z => 1 / (1 + Math.exp(-z))

function train(X, y, { learningRate = 0.5, steps = 500 } = {}) {
  const w = new Float64Array(X[0].length)
  for (let s = 0; s < steps; s++) {
    const grad = new Float64Array(w.length)
    X.forEach((f, i) => {
      const p = sigmoid(f.reduce((acc, v, j) => acc + v * w[j], 0))
      f.forEach((v, j) => { grad[j] += (p - y[i]) * v })
    })
    grad.forEach((gj, j) => { w[j] -= learningRate * gj / X.length })
  }
  return w
}
const w = train(X, y)
const probs = X.map(f => sigmoid(f.reduce((acc, v, j) => acc + v * w[j], 0)))

let tp = 0, fp = 0, tn = 0, fn = 0
probs.forEach((p, i) => {
  const predicted = p >= 0.5 ? 1 : 0
  if (predicted === 1 && y[i] === 1) tp++
  else if (predicted === 1) fp++
  else if (y[i] === 0) tn++
  else fn++
})
const r3 = v => Math.round(v * 1000) / 1000

const { g, w: gw, h } = frame()
const x = d3.scaleLinear().domain([-1.6, 2.6]).range([0, gw])
const ys = d3.scaleLinear().domain([-1.4, 1.6]).range([h, 0])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(ys))
g.selectAll('circle').data(data).join('circle')
  .attr('cx', d => x(d.x)).attr('cy', d => ys(d.y)).attr('r', 4)
  .attr('fill', (d, i) => ((probs[i] >= 0.5 ? 1 : 0) === d.label ? theme.good : theme.bad))
return { tp, fp, tn, fn, precision: r3(tp / (tp + fp)), recall: r3(tp / (tp + fn)) }
```
