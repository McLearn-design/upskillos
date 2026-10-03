---
title: 5.2 — Fixing the Type Errors
runtime: none
---

Twenty-four errors, in a handful of kinds. Each kind is a question TypeScript is asking about your code, and answering it makes the code clearer and safer.

## Say what columnName takes and gives

```typescript file=columns.ts
export function columnName(index: number): string {
  let name = "";
  while (index >= 0) {
    name = String.fromCharCode(65 + (index % 26)) + name;
    index = Math.floor(index / 26) - 1;
  }
  return name;
}
```

**`index: number`** is a **type annotation**: the parameter `index` must be a number. **`): string`** after the brackets says the function returns a string. (Python has the same idea, written almost the same way: `def column_name(index: int) -> str:`. Python itself ignores those hints; TypeScript enforces them.)

The error was *Parameter 'index' implicitly has an 'any' type*. **`any`** is TypeScript's "could be anything; don't check it". With no annotation, TypeScript couldn't work out a parameter's type, and `strict` refuses to quietly use `any`.

Now anyone calling `columnName` with the wrong kind of value finds out at once. `columnName(String(c))`, passing the text `"3"` instead of the number `3`, would give:

```text
grid.ts:21:31 - error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
```

In JavaScript that call would have run and quietly returned a wrong answer.

```check
contains columns.ts "index: number" -- Annotate the parameter: (index: number)
contains columns.ts "): string" -- Annotate the return type: ): string
```

## Fix grid.ts

Replace `grid.ts` with this version. The sections below go through each change and the error it answers.

```typescript file=grid.ts
import { columnName } from "./columns.ts";

const columns = 26;
const rows = 100;

function find<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error("The page has no element matching " + selector);
  }
  return element;
}

const table = find<HTMLTableElement>("#grid");

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
  rowHeader.textContent = String(r + 1);
  tr.appendChild(rowHeader);
  for (let c = 0; c < columns; c++) {
    const td = document.createElement("td");
    td.addEventListener("click", () => select(c, r));
    tr.appendChild(td);
  }
  body.appendChild(tr);
}
table.appendChild(body);

const nameBox = find<HTMLDivElement>("#name-box");
const formulaBar = find<HTMLInputElement>("#formula-bar");

let selected: HTMLTableCellElement | null = null;
let selectedColumn = 0;
let selectedRow = 0;

function cellAt(column: number, row: number): HTMLTableCellElement | undefined {
  return body.rows[row]?.cells[column + 1];
}

function select(column: number, row: number): void {
  const cell = cellAt(column, row);
  if (cell === undefined) {
    return;
  }
  if (selected !== null) {
    selected.classList.remove("selected");
  }
  selected = cell;
  selectedColumn = column;
  selectedRow = row;
  cell.classList.add("selected");
  nameBox.textContent = columnName(column) + (row + 1);
  formulaBar.value = cell.textContent;
  formulaBar.focus();
}

formulaBar.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && selected !== null) {
    selected.textContent = formulaBar.value;
    if (selectedRow + 1 < rows) {
      select(selectedColumn, selectedRow + 1);
    }
  }
});

select(0, 0);
```

### "'table' is possibly 'null'": the find helper

`document.querySelector("#grid")` gives the element, or **`null`** if no element matches, for example if the `id` were misspelled. JavaScript would carry on until `table.appendChild` failed with *Cannot read properties of null*. TypeScript makes you decide what should happen instead.

The answer here is `find`: look the element up, and if it isn't there, stop immediately with a clear message. **`throw new Error(...)`** is JavaScript's `raise`: it stops the program with an error, and the message says exactly what's missing. After that `if`, the function can only reach `return element` with a real element, so its result is never `null`, and every use of `table`, `nameBox` and `formulaBar` is safe.

**`find<HTMLTableElement>("#grid")`**: the part in `< >` is a **type argument**. `querySelector` can't know what kind of element `#grid` will be, so you tell it. That's what fixes *Property 'value' does not exist on type 'Element'*: an `Element` could be anything, but an `HTMLInputElement` has a `value`. In the definition, `<T extends Element>` makes `find` work for any kind of element: `T` stands for whichever kind the caller names. (Lists in Python work the same way in type hints: `list[str]`.)

The *Property 'key' does not exist on type 'Event'* error disappears too. Now that TypeScript knows `formulaBar` is an input, it knows a `"keydown"` listener receives a keyboard event, which has a `key`.

### "Type 'number' is not assignable to type 'string'"

`textContent` holds text. `rowHeader.textContent = r + 1` gave it a number, which the browser converted for you, and TypeScript wants that conversion written down: **`String(r + 1)`**. Small, but it's exactly the kind of mix-up behind `"B" + 2 + 1` in lesson 3.4.

### "Variable 'selected' implicitly has type 'any'"

```typescript
let selected: HTMLTableCellElement | null = null;
```

`selected` starts as `null` and later holds a cell, so its type is "a table cell **or** null". The **`|`** builds a **union type**: one of several types. TypeScript then insists that any code using `selected` first checks which one it has. That's why the Enter listener now says `&& selected !== null`: before the check, `selected` might be `null`; after it, TypeScript knows it's a cell. Checking narrows the type, and that's called **narrowing**.

### "Object is possibly 'undefined'"

This one is the bug from lesson 3.5. `body.rows[row]` is `undefined` when there's no such row: row 101, say. `noUncheckedIndexedAccess` makes TypeScript say so.

- **`body.rows[row]?.cells[column + 1]`**: **`?.`** means "if what's on the left is `undefined` or `null`, stop and give `undefined`; otherwise carry on". So `cellAt` returns a cell, or `undefined` for a position off the grid, and its return type says exactly that: `HTMLTableCellElement | undefined`.
- **`select`** checks for `undefined` first and does nothing for a position that doesn't exist, instead of crashing. Selecting off the edge of the grid is now harmless, wherever it comes from.
- **`: void`** says `select` returns nothing.

## Zero errors

```powershell
npx tsc
```

```text
PS C:\Users\you\Documents\spreadsheet> npx tsc
PS C:\Users\you\Documents\spreadsheet>
```

No output means no errors: the same "silence means success" as `mkdir` on macOS. Check the page through Vite too: everything works as before.

```check
run "npx tsc" label="`npx tsc` finds no errors" -- Run npx tsc and fix what it reports.
page index.html "document.querySelector('#name-box').textContent" A1 server=vite errors=none label="A1 is selected when the page opens"
page index.html "(() => { document.querySelectorAll('tbody tr')[1].querySelectorAll('td')[1].click(); const bar = document.querySelector('#formula-bar'); bar.value = 'Coffee'; bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); return document.querySelectorAll('tbody tr')[1].querySelectorAll('td')[1].textContent + ' ' + document.querySelector('#name-box').textContent; })()" "Coffee B3" server=vite label="typing into B2 and pressing Enter still works"
page index.html "(() => { document.querySelectorAll('tbody tr')[99].querySelectorAll('td')[0].click(); const bar = document.querySelector('#formula-bar'); bar.value = 'last'; bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); return document.querySelector('#name-box').textContent; })()" A100 server=vite errors=none label="Enter on the last row stays on A100"
```

## Commit

```powershell
git commit -am "Fix the type errors"
```

```check
git-clean
```
