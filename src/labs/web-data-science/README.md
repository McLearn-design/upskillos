# Data Science on the Web

Open `#/lab/web-data-science`. The lab teaches data science by building it in the browser with the libraries the app already ships: **d3**, **three.js** and **math.js**. It assumes basic JavaScript, HTML, CSS and SVG, and teaches the rest of the JavaScript as it goes: closures, destructuring, Map and Set, promises and async/await, generators, classes, typed arrays, events and application state. By the end, a learner can build an interactive data app.

Every lesson has the same shape:

1. **Explore**: an interactive figure with sliders, shown first to build intuition. "How is this built?" reveals its source, which is the same kind of code the learner writes.
2. **Understand**: the data-science idea.
3. **JavaScript**: the language technique the lesson's code relies on.
4. **The maths**: collapsed and marked *optional*, but every lesson has it.
5. **Your turn**: a task, a code editor (Monaco), live output and console, and **Check answer**.

The 27 lessons are in seven parts: D3 from first principles (with hand-made data), working with real data, relationships and models, uncertainty, time, machine learning, and building data apps.

## Files

| File | What it does |
|---|---|
| `meta.js`, `index.jsx` | Lab metadata (discovered automatically) and the lab shell: sidebar, progress, lesson page |
| `lessons/NN-slug.md` | One lesson per file; the number prefix sets the order |
| `lessons.js` | Finds and parses the lesson files |
| `runtime.js` | Runs lesson code: provides `d3`, `THREE`, `math`, `el`, `frame()`, `load()`, `log()`, … |
| `data.js` | Seeded synthetic datasets (`students`, `survey`, `cafe`, `abtest`, `shoppers`, `moons`) |
| `Explore.jsx`, `Practice.jsx`, `Output.jsx` | The figure, the task editor and checker, and the shared output panel |
| `lessons.test.js`, `runtime.test.js` | Run every figure, starter and solution; test the runtime |

## Writing a lesson

A lesson file is front matter, then sections opened by an HTML comment on its own line:

````md
---
id: wds-28-my-topic                 # progress key: unique, never change it once published
title: My topic
part: 7. Building data apps         # lessons with the same part are grouped in the sidebar
summary: One or two sentences.
js: the JavaScript technique taught
height: 400                         # output height in px
tolerance: 0.05                     # optional: relative tolerance for numeric answers
controls: [{"name":"n","label":"Points","min":1,"max":100,"step":1,"value":20},{"name":"mode","label":"Mode","options":["a","b"],"value":"a"}]
---

<!-- explore -->
```js
// draws with params.n and params.mode; re-runs when a control changes
```

<!-- learn -->
Markdown. `$…$` and `$$…$$` are LaTeX.

<!-- javascript -->
<!-- maths -->
<!-- code -->
```js
// starter code; must run without errors and must NOT already answer the task
```

<!-- task -->
What to do. The code must `return` the answer.

<!-- solution -->
```js
// its return value is the answer key: no answers are written down twice
```
````

Code runs as the body of an async function, so `await` and `return` work at the top level. The names it can use are listed in `GLOBALS` in `runtime.js`, and in the lab's **Reference** panel. Anything that keeps running (timers, `animate`, listeners, three.js renderers) must be stopped in `onCleanup`.

Prose is rendered by `MarkdownProse`, which converts bare `\command` sequences to LaTeX. Keep regular expressions and other backslashes inside code spans or code blocks.

## Checking

```sh
npx vitest run src/labs/web-data-science
```

This runs every figure at its default and extreme control values, every starter, and every solution, and checks that the starter does not already pass. Code that uses three.js (WebGL) is only parsed there, because happy-dom has no WebGL. Open those lessons in a browser to check them.
