---
id: wds-04-the-data-join
title: The data join, keys and transitions
part: 1. D3 from first principles
summary: When data changes, D3 works out which shapes are new, which stay and which go. Get the key right and a chart can animate change instead of redrawing.
js: callbacks, key functions, references versus copies, immutable updates
height: 300
controls: [{"name":"keyed","label":"Join by","options":["key (the letter)","index (position)"],"value":"key (the letter)"},{"name":"speed","label":"Milliseconds per step","min":400,"max":3000,"step":100,"value":1400}]
---

<!-- explore -->
```js
// Each step: drop a few letters, add a few, shuffle the rest.
const r = rng(4)
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const byKey = params.keyed.startsWith('key')
const svg = d3.select(el).append('svg').attr('width', width).attr('height', height)
const legend = [['entering', theme.good], ['updating', theme.accent], ['leaving', theme.bad]]
legend.forEach(([label, c], i) => {
  svg.append('rect').attr('x', 20 + i * 110).attr('y', 14).attr('width', 12).attr('height', 12).attr('fill', c)
  svg.append('text').attr('x', 38 + i * 110).attr('y', 24).attr('font-size', 12).attr('fill', theme.text).text(label)
})
const status = svg.append('text').attr('x', 20).attr('y', height - 16).attr('fill', theme.muted).attr('font-size', 12)
const row = svg.append('g').attr('transform', 'translate(20,' + (height / 2) + ')')
const step = Math.min(44, (width - 40) / 14)
const t = () => d3.transition().duration(params.speed * 0.7)

let current = d3.shuffle(alphabet.slice(), r).slice(0, 8).sort()
function update() {
  const sel = row.selectAll('g.letter').data(current, byKey ? d => d : null)
  let entered = 0, exited = 0
  sel.join(
    enter => {
      entered = enter.size()
      const gEnter = enter.append('g').attr('class', 'letter')
        .attr('transform', (d, i) => 'translate(' + i * step + ',-60)').style('opacity', 0)
      gEnter.append('rect').attr('width', step - 6).attr('height', step - 6).attr('rx', 6).attr('fill', theme.good)
      gEnter.append('text').attr('x', (step - 6) / 2).attr('y', (step - 6) / 2 + 5).attr('text-anchor', 'middle')
        .attr('fill', '#fff').attr('font-weight', 700)
      return gEnter.call(e => e.transition(t()).style('opacity', 1).attr('transform', (d, i) => 'translate(' + i * step + ',0)'))
    },
    update => update.call(u => u.select('rect').transition(t()).attr('fill', theme.accent))
      .call(u => u.transition(t()).attr('transform', (d, i) => 'translate(' + i * step + ',0)')),
    exit => {
      exited = exit.size()
      return exit.call(x => x.select('rect').attr('fill', theme.bad))
        .call(x => x.transition(t()).attr('transform', (d, i, nodes) => {
          const m = /translate\(([-\d.]+)/.exec(nodes[i].getAttribute('transform') || '')
          return 'translate(' + (m ? m[1] : 0) + ',60)'
        }).style('opacity', 0).remove())
    },
  ).select('text').text(d => d)
  status.text('data: [' + current.join(', ') + ']   entered ' + entered + ', left ' + exited)
}
update()
const timer = d3.interval(() => {
  const keep = d3.shuffle(current.slice(), r).slice(0, 5 + Math.floor(r() * 3))
  const fresh = d3.shuffle(alphabet.filter(a => !current.includes(a)), r).slice(0, 1 + Math.floor(r() * 3))
  current = [...keep, ...fresh].sort()
  update()
}, params.speed)
onCleanup(() => timer.stop())
```

<!-- learn -->
Watch with **Join by: key**: a letter that stays keeps its box and slides to its new place; only genuinely new letters drop in green, and only removed letters fall out in red. Now switch to **index**. D3 pairs data with shapes by position instead, so box 3 is "whatever is third now". Letters appear to morph into other letters, and the animation stops meaning anything.

`selection.data(array, key)` pairs each datum with an existing element and sorts everything into three groups:

- **enter**: data with no element yet (create it);
- **update**: data that already has an element (move or restyle it);
- **exit**: elements whose data is gone (remove them).

`join('rect')` does all three with sensible defaults. When you need different behaviour for each, for example animating new items in from the top, pass three functions instead: `join(enter => ..., update => ..., exit => ...)`.

The **key function** decides what "the same item" means. Without one, D3 matches by index. With `d => d.id`, an item keeps its element for as long as its id survives, wherever it moves in the array. Any chart whose data changes over time needs a key.

**Transitions** interpolate attributes over time: `selection.transition().duration(500).attr('x', 100)`. They make change readable: the eye can follow an object that moves, but not one that disappears and reappears somewhere else.

<!-- javascript -->
**Callbacks.** `join(enter => ..., update => ..., exit => ...)` hands D3 three functions to call later, each receiving a selection. You decide *what* happens; D3 decides *when*.

**References versus copies.** Arrays and objects are passed by reference:

```js
const a = [3, 1, 2]
const b = a          // same array, two names
b.sort()             // a is now [1, 2, 3] too!
const c = [...a]     // a real copy
```

Charts get confusing when something mutates the data they hold. The safe habit is **immutable updates**: build a new array instead of changing the old one.

```js
const added   = [...items, newItem]
const removed = items.filter(d => d.id !== idToRemove)
const changed = items.map(d => d.id === id ? { ...d, value: 42 } : d)
```

**Set** holds unique values and answers `has` quickly, which is what you need to compare two lists by key:

```js
const ids = new Set(items.map(d => d.id))
ids.has(7)   // true or false
```

<!-- maths -->
The data join is set algebra on keys. If $B$ is the set of keys before and $A$ the set after:

$$
\text{enter} = A \setminus B, \qquad \text{update} = A \cap B, \qquad \text{exit} = B \setminus A
$$

With a `Set`, each of these takes one pass: checking membership is (on average) constant time, so the whole join is $O(|A| + |B|)$ rather than the $O(|A|\cdot|B|)$ of comparing every pair.

<!-- code -->
```js
const before = [
  { id: 1, name: 'apples', count: 5 },
  { id: 2, name: 'pears', count: 3 },
  { id: 3, name: 'plums', count: 8 },
  { id: 4, name: 'figs', count: 2 },
]
const after = [
  { id: 3, name: 'plums', count: 6 },
  { id: 1, name: 'apples', count: 9 },
  { id: 5, name: 'kiwis', count: 4 },
]

// Draw `before`, then join `after` by id after one second.
const { g, w, h } = frame()
const x = d3.scaleLinear().domain([0, 10]).range([0, w])
function draw(data) {
  g.selectAll('rect').data(data, d => d.id).join(
    enter => enter.append('rect').attr('fill', theme.good).attr('height', 24).attr('width', 0),
    update => update.attr('fill', theme.accent),
    exit => exit.attr('fill', theme.bad).transition().duration(600).attr('width', 0).remove(),
  ).attr('y', (d, i) => i * 32)
    .transition().duration(600).attr('width', d => x(d.count))
}
draw(before)
const timer = d3.timeout(() => draw(after), 1000)
onCleanup(() => timer.stop())

// Task: which ids enter, update and exit?
return { enter: [], update: [], exit: [] }
```

<!-- task -->
Without using D3, work out the join yourself. Using `Set`, `filter` and `map`, **return** `{ enter, update, exit }`: three arrays of **ids**, each in ascending order, for joining `after` onto `before` by `id`. Run the code to watch D3 agree with you.

<!-- solution -->
```js
const before = [
  { id: 1, name: 'apples', count: 5 },
  { id: 2, name: 'pears', count: 3 },
  { id: 3, name: 'plums', count: 8 },
  { id: 4, name: 'figs', count: 2 },
]
const after = [
  { id: 3, name: 'plums', count: 6 },
  { id: 1, name: 'apples', count: 9 },
  { id: 5, name: 'kiwis', count: 4 },
]

const { g, w, h } = frame()
const x = d3.scaleLinear().domain([0, 10]).range([0, w])
function draw(data) {
  g.selectAll('rect').data(data, d => d.id).join(
    enter => enter.append('rect').attr('fill', theme.good).attr('height', 24).attr('width', 0),
    update => update.attr('fill', theme.accent),
    exit => exit.attr('fill', theme.bad).transition().duration(600).attr('width', 0).remove(),
  ).attr('y', (d, i) => i * 32)
    .transition().duration(600).attr('width', d => x(d.count))
}
draw(before)
const timer = d3.timeout(() => draw(after), 1000)
onCleanup(() => timer.stop())

const beforeIds = new Set(before.map(d => d.id))
const afterIds = new Set(after.map(d => d.id))
const asc = (a, b) => a - b
return {
  enter: [...afterIds].filter(id => !beforeIds.has(id)).sort(asc),
  update: [...afterIds].filter(id => beforeIds.has(id)).sort(asc),
  exit: [...beforeIds].filter(id => !afterIds.has(id)).sort(asc),
}
```
