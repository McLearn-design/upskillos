---
title: 3.2 — Functions and Loops: Naming the Columns
runtime: none
---

Before the script can build a grid, it needs the column names: A, B, C, all the way to Z. That's a function (turn a column's position into its letter) and a loop (do it 26 times). Both work like Python's, with different punctuation.

## A function

Replace `grid.js` with this:

```javascript file=grid.js
const columns = 26;
const rows = 100;

function columnName(index) {
  return String.fromCharCode(65 + index);
}

const names = [];
for (let i = 0; i < columns; i++) {
  names.push(columnName(i));
}
console.log(names.join(" "));
```

Refresh the page and look at the Console:

```text
A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
```

### The function, next to Python

```javascript
function columnName(index) {
  return String.fromCharCode(65 + index);
}
```

is Python's

```python
def column_name(index):
    return chr(65 + index)
```

- **`function`** instead of `def`, and the body goes between **`{` `}`** instead of being indented after a `:`. Indent it anyway: JavaScript ignores indentation, but people read it.
- **`return`** works exactly as in Python.
- Names: Python uses `snake_case`; JavaScript's convention is **`camelCase`**: `columnName`, not `column_name`.
- **`String.fromCharCode(65)`** is Python's `chr(65)`: the character with that number. Letters are numbered in order and `A` is 65, so `65 + 0` is `A`, `65 + 1` is `B`, and so on. (`"B".charCodeAt(0)` is Python's `ord("B")`, giving 66.)

### The loop, next to Python

```javascript
for (let i = 0; i < columns; i++) {
  names.push(columnName(i));
}
```

is Python's `for i in range(columns): names.append(column_name(i))`. The round brackets after `for` hold three parts, separated by `;`:

1. **`let i = 0`**: before the loop starts, make a variable `i` set to 0.
2. **`i < columns`**: before each pass, check this. When it's false, the loop ends.
3. **`i++`**: after each pass, add 1 to `i`. (`i++` is short for `i = i + 1`.)

So `i` goes 0, 1, …, 25, the same numbers `range(26)` gives.

- **`names.push(...)`** adds to the end of an array, like Python's `.append(...)`.
- **`names.join(" ")`** joins the array's items into one string with a space between them: Python's `" ".join(names)`, written the other way round.

```check
page index.html "columnName(0)" A label="columnName(0) is A"
page index.html "columnName(25)" Z label="columnName(25) is Z"
page index.html "true" true console="A B C D E F G H I J K L M N O P Q R S T U V W X Y Z" errors=none label="the Console shows A to Z"
```

## Predict, then check

What is `columnName(26)`, the 27th column? A spreadsheet calls it `AA`.

Decide what you think the function returns, then type `columnName(26)` into the Console and press Enter.

It returns `'['`. Character 91 comes after `Z` in the character table, and it's a bracket. Try `columnName(27)`, `28` and `29`: `\`, `]` and `^`.

No error, and no warning: a wrong answer that looks like an answer, the pattern from lesson 3.1. The grid only needs A to Z for now, so leave it. Fixing it properly is this sprint's challenge, at the end.

## Commit

```powershell
git commit -am "Name the columns A to Z"
```

```check
git-clean
```
