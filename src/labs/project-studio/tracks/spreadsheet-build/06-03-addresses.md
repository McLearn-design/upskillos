---
title: 6.3 — Addresses: a Type for a Cell's Position
runtime: none
---

A cell's position has been two loose numbers, `column` and `row`, passed around separately, and lesson 3.4 showed how easily two numbers get swapped. This lesson gives a position a type of its own, **`Address`**, and two functions: one that writes an address as text (`B3`), and one that reads text back into an address.

Tests first again.

## The tests

This step opens a new file, `address.test.ts`:

```typescript file=address.test.ts
import { describe, expect, it } from "vitest";
import { formatAddress, parseAddress } from "./address.ts";

describe("formatAddress", () => {
  it("writes the column letters, then the row counted from 1", () => {
    expect(formatAddress({ column: 0, row: 0 })).toBe("A1");
    expect(formatAddress({ column: 1, row: 2 })).toBe("B3");
    expect(formatAddress({ column: 26, row: 99 })).toBe("AA100");
  });
});

describe("parseAddress", () => {
  it("reads an address", () => {
    expect(parseAddress("B3")).toEqual({ column: 1, row: 2 });
    expect(parseAddress("AA100")).toEqual({ column: 26, row: 99 });
  });

  it("accepts lower-case letters", () => {
    expect(parseAddress("b3")).toEqual({ column: 1, row: 2 });
  });

  it("rejects text that isn't an address", () => {
    expect(parseAddress("3B")).toBeNull();
    expect(parseAddress("B")).toBeNull();
    expect(parseAddress("B0")).toBeNull();
    expect(parseAddress("B3 ")).toBeNull();
    expect(parseAddress("")).toBeNull();
  });

  it("undoes formatAddress", () => {
    for (let column = 0; column < 800; column += 7) {
      for (let row = 0; row < 120; row += 13) {
        const address = { column, row };
        expect(parseAddress(formatAddress(address))).toEqual(address);
      }
    }
  });
});
```

### New in these tests

- **`{ column: 1, row: 2 }`** is an **object**: named values in `{ }`. It's like a Python dictionary with fixed keys, written without quotes around the names. You read a value with a dot: `address.column`.
- **`toEqual`** instead of `toBe`. `toBe` asks "is this the very same thing?"; two objects built separately are never the same thing, even with the same contents. `toEqual` compares the contents. It's Python's `is` versus `==`.
- **`toBeNull()`** checks for `null`: `parseAddress` returns `null` for text that isn't an address, rather than guessing.
- The rejects test is where the decisions are written down: `B0` isn't an address (rows start at 1), and neither is `B3 ` with a space. Tests are a precise description of what the code should do.
- **`{ column, row }`** in the last test is short for `{ column: column, row: row }`.

Run the tests: `address.test.ts` fails with *Cannot find module './address.ts'*. Red.

```check
file address.test.ts
run "npx vitest run" exit=1 stderr="address.ts" label="the address tests fail: address.ts doesn't exist yet (red)"
```

## address.ts

This step opens `address.ts`:

```typescript file=address.ts
import { columnIndex, columnName } from "./columns.ts";

export interface Address {
  column: number;
  row: number;
}

export function formatAddress(address: Address): string {
  return columnName(address.column) + (address.row + 1);
}

export function parseAddress(text: string): Address | null {
  const match = /^([A-Z]+)([1-9][0-9]*)$/.exec(text.toUpperCase());
  if (match === null) {
    return null;
  }
  const [, letters, digits] = match;
  if (letters === undefined || digits === undefined) {
    return null;
  }
  return { column: columnIndex(letters), row: Number(digits) - 1 };
}
```

### interface Address

```typescript
export interface Address {
  column: number;
  row: number;
}
```

An **interface** names the shape of an object: an `Address` is any object with a `column` and a `row`, both numbers. It exists only for TypeScript and disappears from the JavaScript the browser runs. From now on, a function can take one `Address` instead of two numbers, and every place that builds one has to say `column:` and `row:` out loud. `select({ column: r, row: c })` is much harder to write by accident than `select(r, c)`.

### A regular expression

```typescript
/^([A-Z]+)([1-9][0-9]*)$/
```

is a **regular expression**: a pattern for text. Python has the same thing in its `re` module, with the same pattern language. Between the `/` marks:

- **`^`** and **`$`**: the start and the end of the text. Without them, `"xB3y"` would match.
- **`[A-Z]+`**: one or more (`+`) capital letters.
- **`[1-9][0-9]*`**: a digit from 1 to 9, then any number (`*` means zero or more) of digits. That's what rules out `B0` and `B03`.
- **`( )`**: capture what matched inside, so the letters and the digits can be used separately.

**`.exec(text)`** tries the pattern: it returns `null` if the text doesn't match, otherwise a list whose item 0 is the whole match and items 1 and 2 are the two captured parts. `text.toUpperCase()` first, so `b3` matches too.

### Destructuring, and why the extra check

**`const [, letters, digits] = match;`** unpacks the list into variables, like Python's `_, letters, digits = match`. The leading comma skips item 0.

Then an `if` that can never be true: when the pattern matched, both groups always matched too. Delete those four lines and run both tools:

```text
PS C:\Users\you\Documents\spreadsheet> npx tsc
address.ts:18:32 - error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.

18   return { column: columnIndex(letters), row: Number(digits) - 1 };
                                  ~~~~~~~


Found 1 error in address.ts:18
```

The tests all pass, but `tsc` complains: `noUncheckedIndexedAccess` (lesson 5.1) says reading item 1 of a list might give `undefined`, and TypeScript doesn't know the pattern's rules. The check tells it. Put the lines back.

```check
run "npx vitest run" stdout="11 passed" label="all 11 tests pass"
run "npx tsc" label="the project type-checks"
page index.html "(async () => { const { parseAddress, formatAddress } = await import('/address.ts'); return JSON.stringify([parseAddress('C7'), parseAddress('zz10'), parseAddress('A01'), parseAddress('A 1'), formatAddress({ column: 51, row: 4 })]); })()" "[{\"column\":2,\"row\":6},{\"column\":701,\"row\":9},null,null,\"AZ5\"]" server=vite label="parseAddress and formatAddress handle C7, zz10, A01, A 1 and AZ5"
```

## Commit

```powershell
git add address.ts address.test.ts
git commit -m "Add the Address type, with formatAddress and parseAddress"
```

```check
git-tracked address.ts
git-tracked address.test.ts
git-clean
```
