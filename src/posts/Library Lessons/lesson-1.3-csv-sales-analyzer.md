# Lesson 1.3: A Sales Analyzer with `csv`

**Library:** `csv` (standard library), plus `collections` for counting
**You will build:** a script that reads a coffee-shop sales file and answers questions about it
**Time:** about 75 minutes
**Prerequisites:** Lessons 1.1 and 1.2 (`pathlib`, files, dictionaries)

**What survives if you throw `csv` away:** rows and columns as a data shape, turning text into typed values, and grouping/aggregating by a key. All of that reappears in pandas (Level 4) and in every database.

---

## The problem

A shop exports its daily sales as a spreadsheet saved as `.csv`. You want answers: total revenue, best-selling drink, revenue per day. Opening the file and counting by eye doesn't scale.

## What a CSV file actually is

CSV stands for *comma-separated values*. It is plain text. Each line is a row. Within a row, fields are separated by commas:

```
date,drink,size,quantity,unit_price
2026-09-01,latte,medium,2,4.50
```

Everything in the file is **text**. The `4.50` is the four characters `4`, `.`, `5`, `0`. Nothing says it's a number. Turning it into one is your job, and forgetting is the most common CSV bug.

### Why not just `line.split(",")`?

Try imagining the row `2026-09-01,"mocha, extra shot",large,1,5.25`. The drink name contains a comma. A plain split cuts it into the wrong number of pieces. CSV solves this with **quoting**: a field wrapped in double quotes may contain commas. And a quote *inside* a quoted field is written as two quotes. The `csv` library knows all these rules so you don't reimplement them.

**Mental model:** `file → reader (text lines → lists or dicts of strings) → your conversion (strings → numbers/dates) → your aggregation`.

The library handles only the first arrow. The conversion and aggregation are yours.

---

## Part 1: Make a data file

You need data. Create `sales_analyzer.py` and type a script that writes one. This also reviews `pathlib`:

```python
import csv
from pathlib import Path

sales_file_path = Path("sales.csv")

sales_rows_to_write = [
    ["date", "drink", "size", "quantity", "unit_price"],
    ["2026-09-01", "latte", "medium", "2", "4.50"],
    ["2026-09-01", "espresso", "small", "1", "3.00"],
    ["2026-09-01", "mocha, extra shot", "large", "1", "5.25"],
    ["2026-09-02", "latte", "large", "3", "5.00"],
    ["2026-09-02", "tea", "small", "4", "2.50"],
    ["2026-09-03", "latte", "medium", "1", "4.50"],
    ["2026-09-03", "espresso", "small", "2", "3.00"],
]

with sales_file_path.open("w", newline="") as sales_file:
    csv_writer = csv.writer(sales_file)
    csv_writer.writerows(sales_rows_to_write)
```

Three things to understand here:

- `with ... as sales_file:` opens the file and **guarantees it closes** when the indented block ends, even if an error happens.
- `newline=""` is required by the `csv` docs. The library handles line endings itself, and without this you can get blank lines on Windows. Read that sentence in `help(csv.writer)` yourself.
- `csv.writer(file)` returns a writer object. Calling `.writerows(list_of_lists)` writes every row, adding quotes where needed.

Run it, then open `sales.csv` in a text editor (not a spreadsheet). Find the mocha row. The library added the quotes for you.

## Part 2: Read it back as lists

Add below:

```python
with sales_file_path.open(newline="") as sales_file:
    csv_reader = csv.reader(sales_file)
    for row_as_list in csv_reader:
        print(row_as_list)
```

Run it. Every item is a string, including the quantity. The header is just another row. The mocha row has five fields, not six, so the quoting worked.

Check the type of the reader: `print(type(csv_reader))`. It's not a list. It's an **iterator**: it produces one row at a time as you loop. That means a 10-gigabyte file would not blow up your memory, as long as you process each row as it arrives.

## Part 3: Read it as dictionaries

Lists make you remember "column 3 is quantity." Dictionaries let the header name each field. Replace the reading block with:

```python
def read_sales_rows(csv_file_path):
    sales_rows = []
    with csv_file_path.open(newline="") as sales_file:
        for row_as_dictionary in csv.DictReader(sales_file):
            sales_rows.append(row_as_dictionary)
    return sales_rows


all_sales_rows = read_sales_rows(sales_file_path)
print(all_sales_rows[0])
print(all_sales_rows[0]["drink"])
```

`csv.DictReader` reads the first row as the header and uses those names as keys for every following row. You now write `row["quantity"]` instead of `row[3]`.

## Part 4: Convert text into real values

The values are still strings. Prove it breaks things:

```python
print(all_sales_rows[0]["quantity"] * 2)
```

You get `"22"`, not `4`. String repetition. Now convert in one place. Add:

```python
def convert_row_types(raw_row):
    return {
        "date": raw_row["date"],
        "drink": raw_row["drink"],
        "size": raw_row["size"],
        "quantity": int(raw_row["quantity"]),
        "unit_price": float(raw_row["unit_price"]),
    }


typed_sales_rows = [convert_row_types(raw_row) for raw_row in all_sales_rows]
print(typed_sales_rows[0])
```

Doing every conversion in one function means the rest of the program can trust the types. This is the same boundary idea you'll meet again with validation libraries.

*(A note on `float` for money: it's fine for learning, but binary floats can't represent every decimal exactly. Real money code uses `decimal.Decimal`. You'll explore this below.)*

## Part 5: Answer questions by grouping

**Total revenue.** Each row's revenue is `quantity * unit_price`:

```python
def revenue_of_row(typed_row):
    return typed_row["quantity"] * typed_row["unit_price"]


total_revenue = sum(revenue_of_row(typed_row) for typed_row in typed_sales_rows)
print("Total revenue:", total_revenue)
```

**Revenue per day.** This is *grouping*: collect rows sharing a key, then combine each group. The plain-Python way is a dictionary you update:

```python
revenue_by_date = {}
for typed_row in typed_sales_rows:
    date_text = typed_row["date"]
    revenue_by_date[date_text] = revenue_by_date.get(date_text, 0) + revenue_of_row(typed_row)

for date_text in sorted(revenue_by_date):
    print(date_text, round(revenue_by_date[date_text], 2))
```

The `.get(key, 0)` pattern gives you 0 the first time a date appears. (You used `.get` with a fallback in 1.1.)

Now the same task with a library tool built for it. Add `from collections import defaultdict` at the top, then:

```python
revenue_by_drink = defaultdict(float)
for typed_row in typed_sales_rows:
    revenue_by_drink[typed_row["drink"]] += revenue_of_row(typed_row)

for drink_name, drink_revenue in revenue_by_drink.items():
    print(drink_name, round(drink_revenue, 2))
```

A `defaultdict(float)` calls `float()` (which gives `0.0`) to create a missing entry on first access, so you skip the `.get`. Compare the two grouping loops: same job, different mechanics. Neither is "the" way.

**Units sold per drink, ranked.** For counting there's a specialist, `collections.Counter`. Add `from collections import Counter` and:

```python
units_sold_by_drink = Counter()
for typed_row in typed_sales_rows:
    units_sold_by_drink[typed_row["drink"]] += typed_row["quantity"]

print(units_sold_by_drink.most_common(2))
```

Run `help(Counter.most_common)` to see its signature. What does it return, and what happens if you pass no argument?

---

## Break it

1. **Missing column.** Edit `sales.csv` by hand and delete the `quantity` header name (leave the data). Run. Which line fails, and does the error mention which row?
2. **Bad number.** Change a quantity to `two`. Read the `ValueError`. It tells you the bad text but not the row. Your program should do better (this is the challenge).
3. **Blank lines.** Add an empty line in the middle. Does `DictReader` skip it? Does `csv.reader`?
4. **The newline trap.** Remove `newline=""` from the write step, regenerate, and look at the file in an editor. Restore it.

---

## Explore (guided)

Copy `sales_analyzer.py` to `sales_analyzer_explore.py`.

1. **Delimiters.** Rewrite the file with tabs by passing `delimiter="\t"` to `csv.writer`, and read it back with `delimiter="\t"` on the reader. Then deliberately read it with the wrong delimiter and look at what each row becomes.
2. **Money precision.** In a scratch file, run `print(0.1 + 0.2)`. Then redo the revenue calculation with `from decimal import Decimal`, converting `unit_price` with `Decimal(raw_row["unit_price"])` instead of `float(...)`. Compare totals across 10,000 rows of 0.10. (Generate them in a loop.)
3. **Streaming.** Change `read_sales_rows` into a *generator*: replace `append` with `yield`. Then total revenue without ever storing all rows in a list. What stops working? (Try calling `len()` on it.)

Return to the original file once you can explain what each change cost and bought. Then go further on your own: look up `csv.DictWriter`, `csv.Sniffer`, and the `dialect` concept in the documentation.

---

## Challenge

Make the analyzer **robust**. Write `read_typed_sales(csv_file_path)` that:

- Skips completely blank lines.
- If a row has an unparseable `quantity` or `unit_price`, does **not** crash. It collects a problem message that includes the **row number in the file** (header is row 1) and the offending text, and carries on.
- Returns *two* values: the list of good typed rows, and the list of problem messages.
- Then print the revenue total from the good rows, followed by the problem messages.

Test it with the broken variants from Break it. Think about what the right behavior is when 3 rows out of 10,000 are bad, and what it would be when all of them are.

Solution is in `solutions/solutions-batch-2.md`.

---

## What you should now be able to say

- CSV is text; the library only splits it correctly, and conversion is yours.
- `reader` gives lists, `DictReader` gives dictionaries keyed by header.
- Readers are iterators: one row at a time.
- Grouping means choosing a key, then combining the rows that share it.
- Convert types in one place, at the boundary.

**Next:** Lesson 1.4, where the data is messy free-form text and splitting on commas won't save you.
