---
id: wds-07-loading-data
title: Loading and parsing data
part: 2. Working with real data
summary: Data arrives as text, over a network, some time later. Parse it into typed rows and handle the waiting with promises and async/await.
js: promises, async/await, try/catch and Promise.all
height: 380
controls: [{"name":"parse","label":"Parse with","options":["d3.csvParse (all text)","d3.csvParse + d3.autoType"],"value":"d3.csvParse (all text)"},{"name":"n","label":"Students shown","min":5,"max":40,"step":1,"value":16}]
---

<!-- explore -->
```js
const typed = params.parse.includes('autoType')
const rows = typed ? d3.csvParse(datasets.students, d3.autoType) : d3.csvParse(datasets.students)
const shown = rows.slice(0, params.n).sort((a, b) => d3.descending(a.hours, b.hours))

const { g, w, h } = frame({ margin: { left: 70, top: 34 } })
const y = d3.scaleBand().domain(shown.map(d => d.id)).range([0, h]).padding(0.15)
const x = d3.scaleLinear().domain([0, 12]).range([0, w])
g.append('g').attr('transform', 'translate(0,' + h + ')').call(d3.axisBottom(x))
g.append('g').call(d3.axisLeft(y).tickFormat(id => 'student ' + id))
g.selectAll('rect').data(shown).join('rect')
  .attr('y', d => y(d.id)).attr('height', y.bandwidth())
  .attr('width', d => x(+d.hours)).attr('fill', typed ? theme.accent : theme.bad)
g.selectAll('text.v').data(shown).join('text').attr('class', 'v')
  .attr('x', d => x(+d.hours) + 4).attr('y', d => y(d.id) + y.bandwidth() / 2 + 4)
  .attr('font-size', 10).attr('fill', theme.text).text(d => JSON.stringify(d.hours))
g.append('text').attr('y', -14).attr('fill', theme.text).attr('font-weight', 600)
  .text('Sorted by hours, largest first?  typeof hours = "' + typeof rows[0].hours + '"')
log('First row as parsed:', rows[0])
```

<!-- learn -->
With plain `d3.csvParse`, the bars are red and the "largest first" sort is wrong: `"9.1"` comes before `"10.4"`. Every value is a **string**, and strings sort letter by letter, so `"9"` beats `"1"`. The quotes in the labels give it away. Turn on `d3.autoType` and the values become numbers, and the sort is right.

A CSV file is plain text: a header line, then one line per row, values separated by commas. Parsing turns it into the tidy array of objects from lesson 3:

```js
const rows = d3.csvParse(text)                   // every value a string
const rows = d3.csvParse(text, d3.autoType)      // numbers, dates, null for empty
```

`autoType` guesses each value's type: things that look like numbers become numbers, ISO dates such as `2025-03-01` become `Date` objects, and empty cells become `null`. Guessing can be wrong (a postcode like `01234` becomes the number 1234), so for important data write the row conversion yourself:

```js
d3.csvParse(text, d => ({ id: d.id, hours: +d.hours, group: d.group }))
```

Real data lives on a server. `fetch(url)` asks for it and `d3.csv(url)` fetches *and* parses. Neither can return the data straight away, because the network takes time, so they return a **promise**: an object standing for a value that will arrive later.

In this lab the datasets are already in the page (`datasets.students` is the CSV text, and `load('students')` parses it with `autoType`), so nothing goes over the network. In the task you'll simulate the delay so you can practise the real pattern.

Always **look at the parsed data** before charting it: log the first row, check the types and count the rows.

<!-- javascript -->
**Promises.** A promise is *pending*, then either *fulfilled* with a value or *rejected* with an error. You can make one yourself:

```js
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
```

**async/await.** Inside an `async` function, `await` pauses that function until the promise settles, then gives you its value. The rest of the page carries on in the meantime.

```js
async function loadStudents() {
  const response = await fetch('students.csv')
  if (!response.ok) throw new Error('HTTP ' + response.status)
  const text = await response.text()
  return d3.csvParse(text, d3.autoType)
}
```

An `async` function always returns a promise, so its caller `await`s it too. Your code in this lab already runs inside an async function, which is why `await` works at the top level here.

**Errors.** A rejected promise becomes a thrown error at the `await`, so you handle it with `try { ... } catch (err) { ... }`.

**In parallel.** Two `await`s in a row wait one after the other. `Promise.all` starts them together and waits for both:

```js
const [a, b] = await Promise.all([loadA(), loadB()])   // total time is the slower one, not the sum
```

<!-- code -->
```js
// Pretend these come from a server: wait, then hand back the CSV text.
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function fakeFetch(name) {
  await delay(200)
  if (!(name in datasets)) throw new Error('404: no dataset ' + name)
  return datasets[name]
}

const start = performance.now()
const text = await fakeFetch('students')
const students = d3.csvParse(text, d3.autoType)
log('students:', students.length, 'rows in', Math.round(performance.now() - start), 'ms')
table(students, 5)

// Task: load 'students' and 'cafe' in parallel, and handle a missing dataset.
return null
```

<!-- task -->
1. Load `students` **and** `cafe` in parallel with `Promise.all`, parse both with `autoType`, and log how long the pair took (it should be about 200 ms, not 400).
2. Wrap a call to `fakeFetch('weather')` in `try`/`catch` and `log` the error message instead of crashing.
3. **Return** `[students.length, cafe.length]`.

<!-- solution -->
```js
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function fakeFetch(name) {
  await delay(200)
  if (!(name in datasets)) throw new Error('404: no dataset ' + name)
  return datasets[name]
}

const start = performance.now()
const [studentText, cafeText] = await Promise.all([fakeFetch('students'), fakeFetch('cafe')])
const students = d3.csvParse(studentText, d3.autoType)
const cafe = d3.csvParse(cafeText, d3.autoType)
log('both loaded in', Math.round(performance.now() - start), 'ms')

try {
  await fakeFetch('weather')
} catch (err) {
  log('Could not load weather:', err.message)
}
return [students.length, cafe.length]
```
