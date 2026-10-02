---
id: wds-01-bars-from-an-array
title: Bars from an array
part: 1. D3 from first principles
summary: Your first chart is five numbers and a loop. D3 turns each value in an array into an SVG shape, and that one idea carries every chart in this course.
js: arrays, arrow functions and the index argument
height: 300
controls: [{"name":"n","label":"How many values","min":1,"max":24,"step":1,"value":7},{"name":"gap","label":"Gap between bars","min":0,"max":20,"step":1,"value":4},{"name":"scale","label":"Pixels per unit","min":2,"max":30,"step":1,"value":12}]
---

<!-- explore -->
```js
// Some made-up numbers: the first n values of a short list.
const all = [12, 5, 9, 16, 3, 11, 7, 14, 6, 18, 2, 10, 13, 8, 4, 15, 9, 12, 5, 17, 6, 11, 3, 14]
const values = all.slice(0, params.n)

const svg = d3.select(el).append('svg').attr('width', width).attr('height', height)
const barWidth = (width - 40) / values.length - params.gap

svg.selectAll('rect')
  .data(values)
  .join('rect')
  .attr('x', (d, i) => 20 + i * (barWidth + params.gap))
  .attr('y', d => height - 30 - d * params.scale)
  .attr('width', Math.max(1, barWidth))
  .attr('height', d => d * params.scale)
  .attr('fill', theme.accent)

svg.selectAll('text')
  .data(values)
  .join('text')
  .attr('x', (d, i) => 20 + i * (barWidth + params.gap) + barWidth / 2)
  .attr('y', height - 12)
  .attr('text-anchor', 'middle')
  .attr('fill', theme.muted)
  .attr('font-size', 11)
  .text(d => d)
```

<!-- learn -->
Move the sliders. Every bar is one number from an array, and nothing else decides how many bars there are. Push **Pixels per unit** up and the tallest bars run off the top. That is the problem the next lesson's *scales* solve.

A chart is a **mapping** from data to visual properties. Here each value becomes a rectangle whose height is the value times a constant, and whose `x` position depends on where the value sits in the array. Data science on the web is mostly this: decide which property of the data drives which property of the picture.

D3 does that mapping with three calls:

1. `d3.select(el)` picks the element to draw in (the output box).
2. `.selectAll('rect').data(values)` pairs every value with a rectangle, *whether or not the rectangles exist yet*.
3. `.join('rect')` creates the rectangles that are missing (and removes any extra), so there is exactly one per value.

After `join`, every `.attr(name, fn)` call runs `fn` once per rectangle, passing that rectangle's value `d` and its position `i`. You never write the loop yourself; D3 writes it.

SVG measures `y` downward from the top, so a bar of height `h` standing on a baseline at `height - 30` starts at `y = height - 30 - h`.

<!-- javascript -->
You only need basic JavaScript to start. The two things this lesson leans on:

**Arrow functions.** `d => d * 12` is a function that takes `d` and returns `d * 12`. With two parameters you need brackets: `(d, i) => 20 + i * 30`. With a body of several statements you need braces and an explicit `return`:

```js
const barY = (d) => {
  const h = d * 12
  return height - 30 - h
}
```

**Callbacks get the index too.** D3, like the array methods `map`, `filter` and `forEach`, calls your function with the value *and* its index. That is why `(d, i) => ...` can place bar `i` at `i * (barWidth + gap)`.

```js
[10, 20, 30].map((d, i) => d + i)   // [10, 21, 32]
```

<!-- code -->
```js
// An array of numbers. Change them and press Run.
const sales = [4, 8, 15, 16, 23, 42]

const svg = d3.select(el).append('svg')
  .attr('width', width)
  .attr('height', height)

svg.selectAll('rect')
  .data(sales)
  .join('rect')
  .attr('x', (d, i) => 30 + i * 60)
  .attr('y', d => height - 20 - d * 5)
  .attr('width', 50)
  .attr('height', d => d * 5)
  .attr('fill', theme.accent)

log('Number of bars:', sales.length)

// Task: return the total of all the values in sales.
return null
```

<!-- task -->
Add a value label above each bar (a `text` element per value, like the figure at the top uses), then make the code **return the total** of the values in `sales`, for example with a `for` loop or `sales.reduce((sum, d) => sum + d, 0)`.

<!-- solution -->
```js
const sales = [4, 8, 15, 16, 23, 42]

const svg = d3.select(el).append('svg')
  .attr('width', width)
  .attr('height', height)

svg.selectAll('rect')
  .data(sales)
  .join('rect')
  .attr('x', (d, i) => 30 + i * 60)
  .attr('y', d => height - 20 - d * 5)
  .attr('width', 50)
  .attr('height', d => d * 5)
  .attr('fill', theme.accent)

svg.selectAll('text')
  .data(sales)
  .join('text')
  .attr('x', (d, i) => 30 + i * 60 + 25)
  .attr('y', d => height - 24 - d * 5)
  .attr('text-anchor', 'middle')
  .attr('fill', theme.text)
  .text(d => d)

let total = 0
for (const d of sales) total += d
return total
```
