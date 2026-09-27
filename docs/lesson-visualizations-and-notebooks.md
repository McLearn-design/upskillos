# Visualizations and notebooks in a lesson

How an interactive block gets from a lesson file onto the page, what shape it
has to be in, and the two ways it can fail without telling you.

Companion to [lesson-writing-standard.md](lesson-writing-standard.md), which
covers what a good lesson *says*. This covers what makes the interactive parts
actually appear.

## The one rule

> **A visualization entry needs an `id`, and everything it wants to configure
> goes in `props`.**

Everything below is a consequence of that.

## How an entry is resolved

`normalizeViz()` in [src/components/lesson/MicroCycleLesson.jsx](../src/components/lesson/MicroCycleLesson.jsx)
is the gate:

```js
function normalizeViz(v) {
  if (!v) return null
  const id = v.id ?? v.vizId
  if (!id) return null                 // ← no id, entry discarded entirely
  return {
    id,
    initialProps: v.initialProps,
    props: v.props ?? v.visualizationProps ?? {},
    title: v.title,
    caption: v.caption,
    mathBridge: v.mathBridge,
  }
}
```

**Six fields survive. Anything else you put on the entry is dropped.**

| You wrote | What happens |
|---|---|
| `id` or `vizId` | kept — and required. Missing it discards the whole entry |
| `props` or `visualizationProps` | kept, and passed to the component as `params` |
| `initialProps`, `title`, `caption`, `mathBridge` | kept |
| `type` | **dropped.** Harmless, but it is not what selects the component — `id` is |
| `cells` | **dropped.** This is the one that bites |

## The failure that does not look like a failure

```js
// WRONG — and it renders a perfectly good notebook full of someone else's code
{
  id: 'PythonNotebook',
  type: 'PythonNotebook',
  cells: [ /* your cells */ ],        // dropped by normalizeViz
}
```

`PythonNotebook` reads `params.initialCells`. Finding none, it falls back to
its own `STARTER_CELLS`. So the page shows a working, running notebook —
containing the component's default demo content instead of yours.

There is no error. Nothing is red. The lesson looks finished.

```js
// RIGHT
{
  id: 'PythonNotebook',
  title: 'Optional heading',
  caption: 'Optional line underneath',
  props: {
    initialCells: [
      { id: 1, cellTitle: '...', prose: ['...'], code: 'import numpy as np' },
    ],
  },
}
```

**This affected 58 lessons** — the whole `physics/2-vectors-*` chapter among
them — and neither checker caught it. See "What the checkers do not catch".

## Where cells may live

Four locations are understood, and they are equivalent as far as the cells
themselves go:

```text
intuition.visualizations[]      a notebook inside the intuition section
math.visualizations[]           pulled out and rendered AFTER the examples,
                                in the labs area — see LAB_VIZ_IDS
notebooks.python                the physics-course shape
notebooks.matlab                same, for OpenMatNotebook
```

`LAB_VIZ_IDS` in `MicroCycleLesson.jsx` is `PythonNotebook`,
`OpenMatNotebook`, `GcodeNotebook`. A notebook in `math.visualizations` is
moved to the labs section so it does not interrupt the middle of the lesson;
one in `intuition.visualizations` renders in place.

In every case the cells go in `props.initialCells`.

### A cell

```js
{
  id: 1,                          // optional; generated if absent
  cellTitle: 'What this shows',   // heading above the cell
  prose: ['A paragraph.', 'Another.'],
  code: 'import numpy as np\nprint(np.arange(5))',
  language: 'python',             // default. 'matlab' for OpenMatNotebook
}
```

**Cells in one lesson share a namespace and run in order**, so a later cell
can use what an earlier one defined. Both the app and
`scripts/check_python_cells.mjs` behave this way.

### What Pyodide has

`numpy`, `pandas`, `scikit-learn`, `matplotlib`, `scipy`, plus the standard
library. `micropip` can install more at runtime. There is **no** `vtk`,
`pyvista` or `trimesh` — anything needing a compiled native extension outside
Pyodide's list is unavailable.

### Uploading a file

`PythonNotebook` writes uploaded files into Pyodide's virtual filesystem at
`/home/pyodide/uploads`, so a cell can open one by path like any local file.
Nothing leaves the browser. That is what makes a lesson able to work on the
learner's own data — a CSV, or a 100,000-triangle STL — rather than a toy.

## Interactive cells that are not notebooks

These live in the lesson's `cells:` array — the linear reading view — not in
`visualizations`. Different mechanism, no `normalizeViz` involved.

### A live sandbox

```js
{
  type: 'js',
  instruction: '### Markdown above the sandbox',
  html: '<canvas id="cv" width="300" height="300"></canvas>',
  css: 'body{margin:0;background:#0a0f1e}',
  startCode: 'var ctx = document.getElementById("cv").getContext("2d");',
  outputHeight: 400,
}
```

Runs in an iframe. `three` is a dependency of the app, and a sandbox can pull
it from a CDN with an import map if the cell needs 3D.

### One the learner has to complete

```js
{
  type: 'coding',
  instruction: '### 🎯 Challenge: ...',
  html: '...', css: '...',
  startCode: '// TODO 1: ...',
  check: (code) => /someRequirement/.test(code),
  successMessage: '✓ ... and why it worked',
  failMessage: 'Which specific thing to look at',
  outputHeight: 320,
}
```

`check` receives the learner's source as a string. Two things worth doing:

- **Check the thing, not a keyword.** Parsing out the array they wrote and
  testing its contents beats `/TRIANGLES/.test(code)`, which passes on a
  comment.
- **Make `failMessage` diagnostic.** "Check all three TODOs" is useless;
  "12 triangles, 36 indices, every index 0–7" tells them which one is wrong.

## What the checkers do not catch

| Checker | Catches | Misses |
|---|---|---|
| `validate-lesson-schema.mjs` | the lesson survives the builder's load/save round-trip | anything inside a visualization entry |
| `check_python_cells.mjs` | every Python cell runs under Pyodide | **where the cells live** |

`check_python_cells.mjs` finds cells by walking for any array named `cells`
**or** `initialCells`, anywhere in the object. So a notebook with its cells in
the wrong place still gets executed in CI and still passes — while rendering
nothing on the page. That is exactly how 58 lessons shipped broken.

If you are adding a notebook, the test is not "does CI pass". It is **open the
lesson and look at it.**

### Two known sources of noise

- **Fill-in-the-blank cells.** A cell containing `# YOUR CODE HERE` is a
  deliberate exercise and cannot run. It is reported as a `SyntaxError`. 12
  physics lessons are in this state on purpose.
- **Non-Python cells.** An `OpenMatNotebook` holds MATLAB. The checker now
  skips any cell whose `language` is not Python; before that it reported six
  SyntaxErrors per lesson on the wave chapter.

## Fixing an existing lesson

```
node scripts/fix-notebook-cells.mjs --dry     # what would change
node scripts/fix-notebook-cells.mjs           # apply, then verify by import
```

It moves a notebook entry's `cells:` into `props: { initialCells: }`. It
deliberately **does not reindent** — cell bodies are template literals holding
Python, and shifting them two spaces is an `IndentationError`.

## Checklist for a new interactive block

- [ ] The entry has an `id`, and it matches a registered component
- [ ] Everything configurable is inside `props`
- [ ] For a notebook: cells are in `props.initialCells`, not `cells`
- [ ] Each cell has `code`, and `prose` that says what to watch for
- [ ] `node scripts/check_python_cells.mjs --files <file>` runs them
- [ ] `node scripts/validate-lesson-schema.mjs <file>` passes
- [ ] **You opened the lesson in the browser and saw your own content**

That last one is not ceremony. It is the only check that catches the failure
this document exists for.
