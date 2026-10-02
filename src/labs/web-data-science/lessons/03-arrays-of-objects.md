---
id: wds-03-arrays-of-objects
title: Arrays of objects and visual encodings
part: 1. D3 from first principles
summary: Real data has many variables per item. Store each item as an object, then choose which variable drives position, size and colour.
js: objects, destructuring, map, filter and spread
height: 380
controls: [{"name":"x","label":"x position","options":["weight","speed","lifespan","legs"],"value":"weight"},{"name":"y","label":"y position","options":["speed","weight","lifespan","legs"],"value":"speed"},{"name":"size","label":"Circle size","options":["none","weight","lifespan"],"value":"lifespan"},{"name":"color","label":"Colour","options":["diet","none"],"value":"diet"}]
---

<!-- explore -->
```js
// Invented animals: rough, made-up numbers chosen to make a readable chart.
const animals = [
  { name: 'Mouse', weight: 0.02, speed: 13, lifespan: 2, legs: 4, diet: 'omnivore' },
  { name: 'Cat', weight: 4, speed: 48, lifespan: 15, legs: 4, diet: 'carnivore' },
  { name: 'Dog', weight: 30, speed: 45, lifespan: 13, legs: 4, diet: 'omnivore' },
  { name: 'Horse', weight: 500, speed: 70, lifespan: 28, legs: 4, diet: 'herbivore' },
  { name: 'Ostrich', weight: 110, speed: 70, lifespan: 45, legs: 2, diet: 'omnivore' },
  { name: 'Elephant', weight: 5000, speed: 40, lifespan: 65, legs: 4, diet: 'herbivore' },
  { name: 'Cheetah', weight: 50, speed: 110, lifespan: 12, legs: 4, diet: 'carnivore' },
  { name: 'Rabbit', weight: 2, speed: 56, lifespan: 9, legs: 4, diet: 'herbivore' },
  { name: 'Chicken', weight: 2.5, speed: 14, lifespan: 8, legs: 2, diet: 'omnivore' },
  { name: 'Bear', weight: 300, speed: 56, lifespan: 25, legs: 4, diet: 'omnivore' },
  { name: 'Wolf', weight: 40, speed: 60, lifespan: 13, legs: 4, diet: 'carnivore' },
  { name: 'Tortoise', weight: 200, speed: 0.3, lifespan: 150, legs: 4, diet: 'herbivore' },
]
const { g, w, h } = frame({ margin: { right: 90, bottom: 44 } })
const axisScale = (key, range) => {
  const ext = d3.extent(animals, d => d[key])
  return ext[1] / Math.max(ext[0], 1e-9) > 200
    ? d3.scaleLog().domain(ext).range(range).nice()
    : d3.scaleLinear().domain([0, ext[1]]).range(range).nice()
}
const x = axisScale(params.x, [0, w])
const y = axisScale(params.y, [h, 0])
const r = params.size === 'none' ? () => 6 : d3.scaleSqrt().domain([0, d3.max(animals, d => d[params.size])]).range([3, 24])
const color = d3.scaleOrdinal().domain(['herbivore', 'omnivore', 'carnivore']).range(theme.palette)

g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x).ticks(6, '~s'))
g.append('g').call(d3.axisLeft(y).ticks(6, '~s'))
g.append('text').attr('x', w).attr('y', h + 34).attr('text-anchor', 'end').attr('fill', theme.muted).text(params.x + (x.base ? ' (log scale)' : ''))
g.append('text').attr('y', -4).attr('fill', theme.muted).text(params.y + (y.base ? ' (log scale)' : ''))

const dots = g.selectAll('g.animal').data(animals).join('g').attr('class', 'animal')
  .attr('transform', d => 'translate(' + x(d[params.x]) + ',' + y(d[params.y]) + ')')
dots.append('circle')
  .attr('r', d => r(params.size === 'none' ? 0 : d[params.size]))
  .attr('fill', d => params.color === 'none' ? theme.accent : color(d.diet))
  .attr('fill-opacity', 0.7).attr('stroke', theme.bg)
dots.append('text').attr('x', 8).attr('y', 4).attr('font-size', 11).attr('fill', theme.text).text(d => d.name)

if (params.color !== 'none') {
  const legend = g.append('g').attr('transform', 'translate(' + (w + 14) + ',10)')
  color.domain().forEach((k, i) => {
    legend.append('circle').attr('cy', i * 18).attr('r', 5).attr('fill', color(k))
    legend.append('text').attr('x', 10).attr('y', i * 18 + 4).attr('font-size', 11).attr('fill', theme.text).text(k)
  })
}
```

<!-- learn -->
Try putting `legs` on an axis: every animal piles onto two lines, because `legs` has only two values. Put `weight` on x and the scale switches to **log** by itself, because elephants weigh 250,000 times as much as mice. Turn the size off and on: size adds a third variable to a 2D chart, but it is much harder to compare precisely than position.

Each item, here an animal, is one **object**. Each property is one **variable**. A list of such objects, all with the same properties, is **tidy data**: one row per observation, one column per variable. Nearly every dataset in this course has that shape, and so does what `d3.csvParse` gives you.

A chart **encodes** variables as visual **channels**:

| Channel | Good for | How precisely we read it |
|---|---|---|
| Position on a common axis | numbers | best |
| Length | numbers | good |
| Area (circle size) | numbers | poor: use for a rough third variable |
| Colour hue | categories | good for up to about 6 categories |
| Colour lightness | ordered numbers | rough |

Use the most precise channel for the comparison that matters most. Put the question you care about on x and y.

In code, the only change from lesson 1 is that `d` is now an object, so the accessor picks a property: `.attr('cx', d => x(d.weight))`.

<!-- javascript -->
**Objects** group named values: `const cat = { name: 'Cat', weight: 4 }`. Read a property with a dot, `cat.weight`, or with brackets and a string, `cat['weight']`. Brackets let the property name come from a variable, which is how the figure above lets you choose the axes: `d[params.x]`.

**Destructuring** unpacks properties into variables:

```js
const { name, weight } = cat         // name = 'Cat', weight = 4
const { g, w, h } = frame()          // the helper returns an object
animals.map(({ name }) => name)      // destructure right in the parameter
```

**map and filter** make new arrays without changing the old one:

```js
const heavy = animals.filter(a => a.weight > 100)     // keep some items
const names = heavy.map(a => a.name)                  // transform each item
```

**Spread** copies: `[...animals]` is a new array with the same items, and `{ ...cat, weight: 5 }` is a new object with one property changed. Sorting changes an array in place, so copy first: `[...names].sort()`.

<!-- maths -->
Why does the figure use `scaleSqrt` for circle size? We perceive a circle's **area**, $A = \pi r^2$. For the area to be proportional to the value $v$:

$$
\pi r^2 = k\,v \quad\Rightarrow\quad r = \sqrt{k v / \pi} \propto \sqrt{v}
$$

If you mapped the value to the radius linearly instead, a value twice as big would get four times the area, and the chart would exaggerate every difference.

The automatic log axis uses a rule of thumb: when $\max / \min > 200$, a linear axis would cram almost every point into a corner, while a log axis spreads them by their order of magnitude.

<!-- code -->
```js
const animals = [
  { name: 'Mouse', weight: 0.02, speed: 13, legs: 4 },
  { name: 'Cat', weight: 4, speed: 48, legs: 4 },
  { name: 'Horse', weight: 500, speed: 70, legs: 4 },
  { name: 'Ostrich', weight: 110, speed: 70, legs: 2 },
  { name: 'Cheetah', weight: 50, speed: 110, legs: 4 },
  { name: 'Chicken', weight: 2.5, speed: 14, legs: 2 },
  { name: 'Wolf', weight: 40, speed: 60, legs: 4 },
]

const { g, w, h } = frame()
const x = d3.scaleLog().domain(d3.extent(animals, d => d.weight)).range([0, w]).nice()
const y = d3.scaleLinear().domain([0, d3.max(animals, d => d.speed)]).range([h, 0]).nice()
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x).ticks(5, '~s'))
g.append('g').call(d3.axisLeft(y))

g.selectAll('circle').data(animals).join('circle')
  .attr('cx', d => x(d.weight))
  .attr('cy', d => y(d.speed))
  .attr('r', 6)
  .attr('fill', theme.accent)

// Task: the names of the four-legged animals faster than 45 km/h, A to Z.
const answer = []
return answer
```

<!-- task -->
1. Colour the two-legged animals differently from the four-legged ones (a ternary in the `fill` accessor will do).
2. Using `filter`, `map` and a sorted copy, **return the names** of the four-legged animals with a speed above 45, in alphabetical order.

<!-- solution -->
```js
const animals = [
  { name: 'Mouse', weight: 0.02, speed: 13, legs: 4 },
  { name: 'Cat', weight: 4, speed: 48, legs: 4 },
  { name: 'Horse', weight: 500, speed: 70, legs: 4 },
  { name: 'Ostrich', weight: 110, speed: 70, legs: 2 },
  { name: 'Cheetah', weight: 50, speed: 110, legs: 4 },
  { name: 'Chicken', weight: 2.5, speed: 14, legs: 2 },
  { name: 'Wolf', weight: 40, speed: 60, legs: 4 },
]

const { g, w, h } = frame()
const x = d3.scaleLog().domain(d3.extent(animals, d => d.weight)).range([0, w]).nice()
const y = d3.scaleLinear().domain([0, d3.max(animals, d => d.speed)]).range([h, 0]).nice()
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x).ticks(5, '~s'))
g.append('g').call(d3.axisLeft(y))

g.selectAll('circle').data(animals).join('circle')
  .attr('cx', d => x(d.weight))
  .attr('cy', d => y(d.speed))
  .attr('r', 6)
  .attr('fill', d => d.legs === 2 ? theme.accent2 : theme.accent)

const answer = [...animals.filter(a => a.legs === 4 && a.speed > 45).map(a => a.name)].sort()
return answer
```
