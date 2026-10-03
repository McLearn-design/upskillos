---
title: 4.1 — Modules: One File Becomes Two
runtime: none
---

`grid.js` does everything: it names columns, builds the table, tracks the selection and handles typing. Every feature you add makes it longer. Worse, its pieces can't be used on their own: to try `columnName` you have to load the whole page.

Python solved this for you long ago: a program is many `.py` files, and one file uses another with `import`. Each file is a **module**. JavaScript has modules too. This lesson moves `columnName` into a module of its own, and then runs straight into a wall that the rest of the sprint gets you over.

## A branch

```powershell
git switch -c modules-and-vite
```

```check
git-branch modules-and-vite -- Run git switch -c modules-and-vite
```

## columns.js

This step opens a new file, `columns.js`. **Move** your `columnName` function into it: cut it out of `grid.js` and paste it here, then put `export` in front of `function`. The one below is one correct answer to lesson 3.6's challenge; if yours is different and passed, keep yours.

```javascript file=columns.js
export function columnName(index) {
  let name = "";
  while (index >= 0) {
    name = String.fromCharCode(65 + (index % 26)) + name;
    index = Math.floor(index / 26) - 1;
  }
  return name;
}
```

**`export`** marks what this module offers to other files. Anything not exported stays private to the module. (Python exports every top-level name; JavaScript exports only what you mark.)

```check
contains columns.js "export function columnName" -- Put export in front of function columnName.
```

## Import it in grid.js

`grid.js` starts with an `import` line now, no longer contains `columnName`, and goes back to 26 columns:

```javascript file=grid.js
import { columnName } from "./columns.js";

const columns = 26;
const rows = 100;

const table = document.querySelector("#grid");

const head = document.createElement("thead");
const headerRow = document.createElement("tr");
headerRow.appendChild(document.createElement("th"));
for (let c = 0; c < columns; c++) {
  const th = document.createElement("th");
  th.textContent = columnName(c);
  headerRow.appendChild(th);
}
head.appendChild(headerRow);
table.appendChild(head);

const body = document.createElement("tbody");
for (let r = 0; r < rows; r++) {
  const tr = document.createElement("tr");
  const rowHeader = document.createElement("th");
  rowHeader.textContent = r + 1;
  tr.appendChild(rowHeader);
  for (let c = 0; c < columns; c++) {
    const td = document.createElement("td");
    td.addEventListener("click", () => select(c, r));
    tr.appendChild(td);
  }
  body.appendChild(tr);
}
table.appendChild(body);

const nameBox = document.querySelector("#name-box");
const formulaBar = document.querySelector("#formula-bar");
let selected = null;
let selectedColumn = 0;
let selectedRow = 0;

function cellAt(column, row) {
  return body.rows[row].cells[column + 1];
}

function select(column, row) {
  if (selected !== null) {
    selected.classList.remove("selected");
  }
  selected = cellAt(column, row);
  selectedColumn = column;
  selectedRow = row;
  selected.classList.add("selected");
  nameBox.textContent = columnName(column) + (row + 1);
  formulaBar.value = selected.textContent;
  formulaBar.focus();
}

formulaBar.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    selected.textContent = formulaBar.value;
    if (selectedRow + 1 < rows) {
      select(selectedColumn, selectedRow + 1);
    }
  }
});

select(0, 0);
```

`import { columnName } from "./columns.js";` is Python's `from columns import column_name`, with two differences:

- The file is named by a **path**, with its `.js` ending, and **`./`** in front. `./` means "in the same folder as this file" (lesson 0.1's relative paths). A browser needs the exact file.
- The names you import go in **`{ }`**.

```check
contains grid.js "import { columnName } from \"./columns.js\";" -- Add the import line at the top of grid.js.
lacks grid.js "function columnName" -- Move columnName out of grid.js (columns.js has it now).
```

## Tell the browser it's a module

A file that uses `import` must be loaded as a module. Add `type="module"` to the script tag in `index.html`:

```html file=index.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Spreadsheet</title>
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <h1>Spreadsheet</h1>
    <div id="toolbar">
      <div id="name-box"></div>
      <input id="formula-bar" autocomplete="off">
    </div>
    <table id="grid"></table>
    <script type="module" src="grid.js"></script>
  </body>
</html>
```

```check
contains index.html "<script type=\"module\" src=\"grid.js\"></script>" -- Add type="module" to the script tag.
```

## The wall

Refresh the page in your browser. The grid is **gone**: an empty page under the toolbar. Open the Console (F12):

```text
Access to script at 'file:///C:/Users/you/Documents/spreadsheet/grid.js' from origin 'null' has been blocked by CORS policy: Cross origin requests are only supported for protocol schemes: chrome, chrome-untrusted, data, http, https.
```

(The list at the end varies a little between browsers.)

Read the first part: access to the script was **blocked**. Modules come with stricter safety rules than old-style scripts, and one rule is that a page opened as a **file** (`file:///`, from your disk) may not load modules at all. Otherwise any web page you saved and opened could read other files from your disk. Modules must come from a web address: `http` or `https`, the last two items in that list.

So the page needs a **web server**: a program that hands files to the browser over HTTP. The rest of this sprint installs a professional one. (The check below serves your folder over HTTP itself, so it passes even though the page is broken when opened as a file.)

```check
page index.html "document.querySelectorAll('tbody td').length" 2600 server=static errors=none label="served over HTTP, the grid builds with the module"
page index.html "(await import('/columns.js')).columnName(26)" AA server=static label="columns.js exports a working columnName"
page index.html "typeof window.columnName" undefined server=static label="columnName is no longer a global"
```

## Modules don't share by accident

The last check needs a word. In sprint 3, `columnName` was a **global**: any script on the page, and the Console, could call it. A module's names are private unless exported, and only reach files that import them. In the Console now, `columnName(26)` would be a `ReferenceError`.

That's a feature. In a big program, globals are how one part accidentally breaks another; modules make every connection between files visible in an `import` line.

## Commit, even though it's broken

```powershell
git add columns.js
git commit -am "Move columnName into its own module"
```

Committing a page that doesn't open as a file is fine **on a branch**: `main` still has the working version, and the next lessons fix this branch before it's merged. That's what branches are for.

```check
git-tracked columns.js
git-clean
```
