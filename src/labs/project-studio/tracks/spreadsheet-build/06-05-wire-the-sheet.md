---
title: 6.5 — Wire the Grid to the Sheet, and Use a Debugger
runtime: none
---

The `Sheet` is tested and works, but the page doesn't use it yet. This lesson changes `grid.ts` so the data lives in the sheet and the page only **shows** it, and positions travel as `Address` objects instead of two loose numbers. Then you'll watch it run, line by line, in the browser's debugger.

## The new grid.ts

```typescript file=grid.ts
import { formatAddress, type Address } from "./address.ts";
import { columnName } from "./columns.ts";
import { Sheet } from "./sheet.ts";

const columns = 26;
const rows = 100;
const sheet = new Sheet();

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
    td.addEventListener("click", () => select({ column: c, row: r }));
    tr.appendChild(td);
  }
  body.appendChild(tr);
}
table.appendChild(body);

const nameBox = find<HTMLDivElement>("#name-box");
const formulaBar = find<HTMLInputElement>("#formula-bar");

let selected: Address = { column: 0, row: 0 };

function cellAt(address: Address): HTMLTableCellElement | undefined {
  return body.rows[address.row]?.cells[address.column + 1];
}

function select(address: Address): void {
  const cell = cellAt(address);
  if (cell === undefined) {
    return;
  }
  cellAt(selected)?.classList.remove("selected");
  selected = address;
  cell.classList.add("selected");
  nameBox.textContent = formatAddress(address);
  formulaBar.value = sheet.get(address);
  formulaBar.focus();
}

formulaBar.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sheet.set(selected, formulaBar.value);
    const cell = cellAt(selected);
    if (cell !== undefined) {
      cell.textContent = sheet.get(selected);
    }
    select({ column: selected.column, row: selected.row + 1 });
  }
});

select({ column: 0, row: 0 });
```

### What changed, and why it's simpler

- **`const sheet = new Sheet();`**: the one place the data lives.
- **`select({ column: c, row: r })`**: every position is an `Address`, with its parts named. Swapping them would mean writing `{ column: r, row: c }`, a mistake you'd see.
- **`selected`** is now the selected **address**, never `null`: there's always a selected cell. `selectedColumn` and `selectedRow` are gone; `selected.column` and `selected.row` replace them.
- **`cellAt(selected)?.classList.remove("selected")`**: `?.` (lesson 5.2) skips the call if the old cell doesn't exist.
- **`formatAddress(address)`** writes the name box, using the same tested function as everything else, instead of building `"B" + (row + 1)` by hand.
- **The formula bar shows `sheet.get(address)`**, what the sheet holds, not the cell's text.
- **Enter** stores the text in the sheet, then draws the cell from the sheet. The page is drawn **from** the data, never the other way round. Sprint 7 makes that matter: the sheet will hold `=B2*C2` and the cell will show `7`.
- **Enter on the last row** asks to select row 101; `select` finds no cell there and does nothing. The special check from sprint 3 isn't needed any more.

Run `npm test` and `npm run check`, and try the page (`npm run dev`): type into a few cells, click away and back. The formula bar shows each cell's text from the sheet.

```check
run "npm run check" label="the project type-checks"
run "npm test" stdout="16 passed" label="all 16 tests pass"
page index.html "document.querySelector('#name-box').textContent" A1 server=vite errors=none label="A1 is selected when the page opens"
page index.html "(() => { document.querySelectorAll('tbody tr')[1].querySelectorAll('td')[2].click(); const bar = document.querySelector('#formula-bar'); bar.value = 'Coffee'; bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); return document.querySelectorAll('tbody tr')[1].querySelectorAll('td')[2].textContent + ' ' + document.querySelector('#name-box').textContent; })()" "Coffee C3" server=vite label="typing Coffee into C2 and pressing Enter fills C2 and moves to C3"
page index.html "(() => { const rows = document.querySelectorAll('tbody tr'); rows[1].querySelectorAll('td')[2].click(); const bar = document.querySelector('#formula-bar'); bar.value = 'Coffee'; bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); rows[6].querySelectorAll('td')[3].click(); rows[1].querySelectorAll('td')[2].click(); return bar.value; })()" Coffee server=vite label="coming back to C2 shows Coffee in the formula bar"
page index.html "(() => { document.querySelectorAll('tbody tr')[99].querySelectorAll('td')[0].click(); const bar = document.querySelector('#formula-bar'); bar.value = 'last'; bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); return document.querySelector('#name-box').textContent + ' ' + document.querySelectorAll('tbody tr')[99].querySelectorAll('td')[0].textContent; })()" "A100 last" server=vite errors=none label="Enter on the last row writes the cell and stays on A100"
page index.html "(() => { const rows = document.querySelectorAll('tbody tr'); rows[2].querySelectorAll('td')[1].click(); rows[7].querySelectorAll('td')[4].click(); return document.querySelectorAll('td.selected').length; })()" 1 server=vite label="only one cell is outlined at a time"
```

## Watch it run: the debugger

`console.log` shows what you thought to print. A **debugger** stops the program at a line you choose and lets you look at everything: every variable, as it is at that moment. Then you move forward one line at a time.

With the page open from `npm run dev`, open DevTools (**F12**) and click the **Sources** tab (Firefox calls it *Debugger*). Press **Ctrl+P** (Cmd+P on macOS), type `grid.ts`, and press Enter. Your TypeScript file opens, exactly as you wrote it. Vite sends a **source map** with the JavaScript: a file that tells the browser which line of your source each piece of running code came from.

1. Find the line `sheet.set(selected, formulaBar.value);` and click its **line number**. A blue marker appears: a **breakpoint**.
2. Click cell `B2` on the page, type `Bagel` in the formula bar and press **Enter**.
3. The page freezes and DevTools highlights the breakpoint line: the program is **paused** just before running it.
4. Hover over `selected`: `{column: 1, row: 1}`. Hover over `formulaBar.value`: `"Bagel"`. The **Scope** pane lists every variable that exists right here.
5. Press **F10** (*step over*): the highlighted line runs and the next one is highlighted. Hover over `sheet` and open it up: its `cells` map now holds `B2 → Bagel`.
6. Press **F8** (*resume*) to let the program carry on. Click the breakpoint marker again to remove it.

When something goes wrong and you don't know why, this is faster than guessing: stop just before the wrong thing happens, and look.

(You can also write the statement `debugger;` on a line of code: when DevTools is open, the browser pauses there. Never commit one.)

```check
lacks grid.ts "debugger" label="no debugger statement left in grid.ts"
```

## Commit

```powershell
git commit -am "Keep the data in a Sheet; the grid only draws it"
```

```check
git-clean
```
