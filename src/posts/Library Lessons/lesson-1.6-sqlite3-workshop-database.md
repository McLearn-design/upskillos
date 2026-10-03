# Lesson 1.6: A Tool-Lending Database with `sqlite3`

**Library:** `sqlite3` (standard library), plus a first look at SQL itself
**You will build:** `workshop.py`, a small database application for a community workshop that lends out tools
**Time:** about 100 minutes
**Prerequisites:** Lessons 1.1 to 1.3, functions and dictionaries. Classes are introduced gently in Part 7.

**What survives if you throw `sqlite3` away:** SQL. The statements you write today work, with small dialect changes, in PostgreSQL, MySQL, SQL Server, and every other relational database. The Python-side ideas (connections, parameters, transactions) show up in every database library in every language.

---

## The problem

Everything you've built so far forgets its data when the program ends, or keeps it in a file you must read and rewrite whole. A workshop that lends out drills and saws needs to answer: which tools exist, who has what, what's overdue? And two people must not walk away with the same drill.

A database is a program built to store structured data, answer questions about it, and keep it consistent. **SQLite** is a database that lives in a **single file** and runs inside your own process, with no server to install. Python ships with the driver, which is what `sqlite3` is.

## Two languages in one program

You are about to work in two languages at once:

- **Python**, which runs your program, and
- **SQL**, a separate language for describing what you want from a database. You write SQL as *strings* and hand them to the database to execute.

**Mental model:** `connection (the open database file) → cursor (a handle for running one statement and stepping through its results) → SQL statement (a string) → rows coming back (tuples)`.

The `sqlite3` library does not understand your SQL. It passes the string along. A typo inside the string is only discovered when the statement runs.

### A relational database in one paragraph

Data is organized into **tables**. A table has named, typed **columns** and holds **rows**, one per item. Each row is identified by a **primary key**, a unique value like an ID. Tables relate to each other by storing another table's primary key (a **foreign key**). The big idea: store each fact once, and connect facts by key rather than copying them.

---

## Part 1: Open a database

Create `workshop.py`:

```python
import sqlite3
from pathlib import Path

database_file_path = Path("workshop.db")
connection = sqlite3.connect(database_file_path)
print(connection)
print(database_file_path.exists())
```

Run it. `connect` creates the file if it isn't there. Look at your folder: `workshop.db` exists, and it's tiny, because it holds nothing yet.

There's a special name, `":memory:"`, that gives you a database that lives only in RAM and vanishes at exit. Handy for experiments and tests.

## Part 2: Create a table

Add:

```python
connection.execute("""
    CREATE TABLE IF NOT EXISTS tools (
        tool_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        daily_rental_price REAL NOT NULL
    )
""")
connection.commit()
```

Read the SQL slowly:

- `CREATE TABLE IF NOT EXISTS tools (...)` makes the table only if it's missing, so the script can run repeatedly.
- Each line inside is `column_name TYPE constraints`.
- `INTEGER PRIMARY KEY` makes `tool_id` the unique row identifier. SQLite fills it in automatically (1, 2, 3...) when you don't provide it.
- `NOT NULL` forbids a missing value. `UNIQUE` forbids two rows with the same name.

SQLite types are looser than Python's. There are only `INTEGER`, `REAL`, `TEXT`, `BLOB` and `NUMERIC`, and **no date type**. Dates are conventionally stored as text in the sortable `YYYY-MM-DD` form.

On the Python side:

- `connection.execute(sql)` is a shortcut that creates a cursor, runs the statement, and returns the cursor.
- `connection.commit()` makes your changes permanent. Until you commit, they live in a pending **transaction** (more on this in Part 5).

## Part 3: Insert rows, and the question of safety

Add:

```python
connection.execute(
    "INSERT OR IGNORE INTO tools (name, category, daily_rental_price) VALUES (?, ?, ?)",
    ("cordless drill", "power", 12.0),
)
connection.commit()
```

Three things:

- The `?` marks are **placeholders**. You pass the actual values separately, as a tuple in the same order.
- `OR IGNORE` skips a row that would violate a constraint (here, a duplicate name) instead of raising an error. That's why re-running the script is safe.
- You never glued the values into the SQL string. This isn't style. It's security. Let's see why.

### Why placeholders are non-negotiable

Add this self-contained experiment (it uses a separate throwaway in-memory database):

```python
demo_connection = sqlite3.connect(":memory:")
demo_connection.execute("CREATE TABLE secrets (owner TEXT, secret TEXT)")
demo_connection.execute(
    "INSERT INTO secrets VALUES ('alice', 'alice-private'), ('bob', 'bob-private')"
)

requested_owner = "nobody' OR '1'='1"

unsafe_sql = f"SELECT * FROM secrets WHERE owner = '{requested_owner}'"
print(unsafe_sql)
print("Unsafe:", demo_connection.execute(unsafe_sql).fetchall())

print("Safe:", demo_connection.execute(
    "SELECT * FROM secrets WHERE owner = ?", (requested_owner,)
).fetchall())
```

Run it. The unsafe version returned **everyone's secrets**: the text the user supplied became part of the SQL itself. This is called *SQL injection*, and it's among the oldest and most damaging bugs in software. With placeholders, the database treats your value strictly as data, never as code. The rule: **never build SQL with f-strings or `+` using outside values.** (Table and column names can't be placeholders; those you choose from a fixed list in your own code.)

Delete the experiment once you've understood it.

Now insert many rows at once with `executemany`:

```python
starter_tools = [
    ("hand saw", "hand", 4.0),
    ("circular saw", "power", 15.0),
    ("hammer", "hand", 2.0),
    ("orbital sander", "power", 9.0),
    ("tape measure", "measuring", 1.0),
    ("spirit level", "measuring", 2.5),
]
connection.executemany(
    "INSERT OR IGNORE INTO tools (name, category, daily_rental_price) VALUES (?, ?, ?)",
    starter_tools,
)
connection.commit()
```

## Part 4: Ask questions with SELECT

`SELECT` is the heart of SQL: you describe the rows you want, and the database figures out how to get them. Add and run each:

```python
cursor = connection.execute("SELECT tool_id, name, category FROM tools")
print(cursor.fetchone())
print(cursor.fetchall())
```

The cursor is a stream. `fetchone()` takes one row (a tuple) and moves forward; `fetchall()` takes whatever remains. Run it and notice the first row is **missing** from the second print. You can also loop over a cursor directly: `for row in cursor:`.

Now filtering, sorting, limiting:

```python
power_tools = connection.execute(
    "SELECT name, daily_rental_price FROM tools WHERE category = ? ORDER BY daily_rental_price DESC",
    ("power",),
).fetchall()
print(power_tools)
```

A single-item tuple needs a trailing comma: `("power",)`. Without it, Python sees plain parentheses around a string, and `sqlite3` complains about the number of bindings. (Try it and read the message.)

Common clauses to know:

| Clause | Meaning |
| --- | --- |
| `WHERE condition` | keep only rows meeting the condition |
| `ORDER BY column [DESC]` | sort |
| `LIMIT n` | at most n rows |
| `LIKE '%saw%'` | text pattern (`%` matches any run of characters) |
| `COUNT(*)`, `SUM(x)`, `AVG(x)`, `MIN(x)`, `MAX(x)` | aggregate functions |

Tuples make you remember column positions. Fix that with a row factory:

```python
connection.row_factory = sqlite3.Row

for tool_row in connection.execute("SELECT * FROM tools WHERE daily_rental_price < ?", (5,)):
    print(tool_row["name"], tool_row["daily_rental_price"], tuple(tool_row.keys()))
```

`sqlite3.Row` behaves like a tuple *and* lets you read by column name. Set `row_factory` before you create the cursor you want it to apply to.

## Part 5: Transactions

A **transaction** is a group of changes that succeed or fail together. `sqlite3` opens one automatically before your first `INSERT`/`UPDATE`/`DELETE`; nothing is permanent until `commit()`, and `rollback()` discards it.

Prove it. Add:

```python
connection.execute(
    "INSERT INTO tools (name, category, daily_rental_price) VALUES (?, ?, ?)",
    ("mystery tool", "other", 99.0),
)
print(connection.execute("SELECT COUNT(*) FROM tools").fetchone()[0])
connection.rollback()
print(connection.execute("SELECT COUNT(*) FROM tools").fetchone()[0])
```

The count went up, then went back. The insert was discarded.

The idiomatic way to guarantee commit-or-rollback is to use the connection as a context manager:

```python
try:
    with connection:
        connection.execute(
            "INSERT INTO tools (name, category, daily_rental_price) VALUES (?, ?, ?)",
            ("temporary tool", "other", 1.0),
        )
        connection.execute(
            "INSERT INTO tools (name, category, daily_rental_price) VALUES (?, ?, ?)",
            ("hammer", "hand", 2.0),    # duplicate name, will fail
        )
except sqlite3.IntegrityError as error:
    print("Rolled back because:", error)

print(connection.execute("SELECT COUNT(*) FROM tools WHERE name = 'temporary tool'").fetchone()[0])
```

The second insert violated `UNIQUE`, so the block raised, the `with` rolled back, and `temporary tool` was never saved either. (Note: `with connection` manages the *transaction*. It does **not** close the connection.)

All-or-nothing is the reason databases exist. Remember it for Part 6.

## Part 6: A second table and a JOIN

Who borrowed what? That's a different kind of fact from "what is a tool", so it gets its own table. Add:

```python
connection.execute("PRAGMA foreign_keys = ON")

connection.execute("""
    CREATE TABLE IF NOT EXISTS loans (
        loan_id INTEGER PRIMARY KEY,
        tool_id INTEGER NOT NULL REFERENCES tools(tool_id),
        borrower_name TEXT NOT NULL,
        checked_out_on TEXT NOT NULL,
        returned_on TEXT
    )
""")
connection.commit()
```

- `REFERENCES tools(tool_id)` declares a **foreign key**: every loan must point at a tool that exists.
- `returned_on` has no `NOT NULL`: `NULL` means "not returned yet." (That's `None` in Python.)
- `PRAGMA foreign_keys = ON` is a quirk worth memorizing: SQLite **does not enforce foreign keys unless you turn it on, and the setting is per connection.** Without it, the database will happily accept a loan for a tool that doesn't exist.

Add some loans. Unlike the tools, nothing prevents duplicate loan rows, so **every run of this block adds four more rows.** Run it once, then comment it out (put `#` at the start of each line). If you add them twice by accident, delete `workshop.db` and rerun the whole script to start clean.

```python
connection.executemany(
    "INSERT INTO loans (tool_id, borrower_name, checked_out_on, returned_on) VALUES (?, ?, ?, ?)",
    [
        (1, "Priya", "2026-09-20", "2026-09-22"),
        (1, "Marcus", "2026-09-25", None),
        (3, "Priya", "2026-09-28", None),
        (4, "Dana", "2026-09-29", "2026-09-30"),
    ],
)
connection.commit()
```

Now a question that spans both tables: "which tools are out right now, and who has them?" You need columns from `loans` (who) and `tools` (the name). A **JOIN** pairs rows from two tables where a condition holds:

```python
tools_currently_out = connection.execute("""
    SELECT tools.name, loans.borrower_name, loans.checked_out_on
    FROM loans
    JOIN tools ON tools.tool_id = loans.tool_id
    WHERE loans.returned_on IS NULL
    ORDER BY loans.checked_out_on
""").fetchall()

for row in tools_currently_out:
    print(row["name"], "->", row["borrower_name"], "since", row["checked_out_on"])
```

Two details: you test for missing values with `IS NULL`, never `= NULL`, and `tools.name` qualifies a column with its table to avoid ambiguity.

Next, aggregation with `GROUP BY`: "how many times has each tool been lent?"

```python
loan_counts = connection.execute("""
    SELECT tools.name, COUNT(loans.loan_id) AS times_lent
    FROM tools
    LEFT JOIN loans ON loans.tool_id = tools.tool_id
    GROUP BY tools.tool_id
    ORDER BY times_lent DESC, tools.name
""").fetchall()

for row in loan_counts:
    print(row["name"], row["times_lent"])
```

`GROUP BY` is the same idea as your `Counter`/`defaultdict` from Lesson 1.3, done inside the database. `LEFT JOIN` keeps tools that were never lent (count 0); a plain `JOIN` would drop them. Change `LEFT JOIN` to `JOIN` and compare.

Now try to break the foreign key on purpose:

```python
try:
    with connection:
        connection.execute(
            "INSERT INTO loans (tool_id, borrower_name, checked_out_on) VALUES (?, ?, ?)",
            (999, "Ghost", "2026-10-01"),
        )
except sqlite3.IntegrityError as error:
    print("Refused:", error)
```

## Part 7: Wrap it in a class

The loose script is getting long, and every operation repeats the same connection details. Group the connection and the operations that go with it into a **class**, a bundle of data plus the functions that act on it. (If classes are new to you, it's a good moment to read about `__init__` and `self`. The code below uses only those.)

Create a new file `workshop_db.py` (a module you'll import later), and type it in small pieces. First the skeleton:

```python
import sqlite3


class WorkshopDatabase:
    def __init__(self, database_file_path):
        self.connection = sqlite3.connect(database_file_path)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA foreign_keys = ON")
        self._create_tables()

    def close(self):
        self.connection.close()
```

`__init__` runs when you create an instance: `WorkshopDatabase("workshop.db")`. `self` is the instance itself; `self.connection` is a value stored on it. Every method receives `self` as its first parameter so it can reach the same connection.

Then the table creation, reusing the SQL you've already tested (copy both `CREATE TABLE` statements from `workshop.py`):

```python
    def _create_tables(self):
        with self.connection:
            self.connection.execute("""CREATE TABLE IF NOT EXISTS tools (...)""")
            self.connection.execute("""CREATE TABLE IF NOT EXISTS loans (...)""")
```

(Replace the `...` with the column lists from Parts 2 and 6.) Then the operations:

```python
    def add_tool(self, name, category, daily_rental_price):
        with self.connection:
            cursor = self.connection.execute(
                "INSERT INTO tools (name, category, daily_rental_price) VALUES (?, ?, ?)",
                (name, category, daily_rental_price),
            )
        return cursor.lastrowid

    def list_tools(self, category=None):
        if category is None:
            return self.connection.execute("SELECT * FROM tools ORDER BY name").fetchall()
        return self.connection.execute(
            "SELECT * FROM tools WHERE category = ? ORDER BY name", (category,)
        ).fetchall()

    def check_out_tool(self, tool_id, borrower_name, checked_out_on):
        with self.connection:
            self.connection.execute(
                "INSERT INTO loans (tool_id, borrower_name, checked_out_on) VALUES (?, ?, ?)",
                (tool_id, borrower_name, checked_out_on),
            )

    def return_tool(self, tool_id, returned_on):
        with self.connection:
            self.connection.execute(
                "UPDATE loans SET returned_on = ? WHERE tool_id = ? AND returned_on IS NULL",
                (returned_on, tool_id),
            )
```

New pieces: `cursor.lastrowid` gives the primary key SQLite assigned to the row just inserted. `UPDATE table SET column = value WHERE condition` changes existing rows; **forgetting the `WHERE` updates every row.** Say that out loud once.

Now use the class from a small script, `use_workshop.py`:

```python
from workshop_db import WorkshopDatabase

workshop = WorkshopDatabase("workshop.db")
for tool_row in workshop.list_tools("hand"):
    print(tool_row["tool_id"], tool_row["name"])

workshop.check_out_tool(2, "Dana", "2026-10-02")
workshop.return_tool(2, "2026-10-03")
workshop.close()
```

Notice that the code using the class contains **no SQL at all**. The SQL is one layer down, behind a small public API, exactly like the `math_tools` package from Lesson 0.2.

---

## Break it

1. **Double checkout.** Call `workshop.check_out_tool(1, "Someone", "2026-10-03")` right after Marcus still has tool 1. It succeeds. Two people now hold the same drill. The database enforced the constraints you declared and none you didn't. (This is the challenge.)
2. **Missing WHERE.** In a scratch copy of the database, run `UPDATE loans SET returned_on = '2026-10-03'` with no `WHERE` and print every loan. Restore by deleting the copy.
3. **Single-item tuple.** Pass `(category)` instead of `(category,)` in `list_tools` and read the error.
4. **Forgot `commit`.** In a script, insert a row without committing, close the connection, reopen, and count rows. Where did the row go?
5. **Foreign keys off.** Remove the `PRAGMA foreign_keys = ON` line and repeat the ghost-loan insert from Part 6. Does it get refused?

---

## Explore (guided)

Copy `workshop.db` to `workshop_explore.db`, and work on the copy.

1. **See the plan.** Run `connection.execute("EXPLAIN QUERY PLAN SELECT * FROM loans WHERE borrower_name = 'Priya'").fetchall()` and print the rows. Then add `CREATE INDEX idx_loans_borrower ON loans(borrower_name)` and run the plan query again. Compare. This is the database telling you how it will find rows, and an index is how you make "find by name" fast on millions of rows.
2. **Look from outside.** Open `workshop_explore.db` in a SQLite viewer (the `sqlite3` command-line tool, or the free DB Browser for SQLite). Run `.schema` or browse the tables. Confirm it's the same data you've been editing from Python.
3. **No database.** Reproduce "which tools are out right now and who has them" using only Python lists of dictionaries, with a loop to match loans to tools. Write it, then compare it to the 6-line SQL. Now imagine 500,000 loans. That's what the library is buying you.

Return to the original afterwards. When you're comfortable, go further: look up `PRAGMA journal_mode=WAL`, SQL `INSERT ... ON CONFLICT DO UPDATE` (upsert), and how `sqlite3.register_adapter` stores Python `datetime` objects.

---

## Challenge

Make the lending rules real, in `WorkshopDatabase`:

1. **`check_out_tool`** must refuse (raise `ValueError` with a clear message that includes the borrower currently holding it) when the tool already has a loan with `returned_on IS NULL`. It must also raise `ValueError` if the `tool_id` doesn't exist, instead of leaking an `IntegrityError`. Do the check and the insert inside **one transaction**. Think about why checking first and inserting second in two separate transactions would leave a gap.
2. **`tools_currently_out()`** returns the JOIN query from Part 6 as a list of rows.
3. **`loans_per_category()`** returns, for each category, the number of loans ever made. You'll need a JOIN, a GROUP BY, and to decide how a category with no loans should appear.
4. **Test** each with an in-memory database (`WorkshopDatabase(":memory:")`) so your real data isn't touched.

Solution is in `solutions/solutions-batch-2.md`.

---

## What you should now be able to say

- SQL is a second language embedded in strings; `sqlite3` carries it to the database and carries rows back.
- Placeholders keep values out of the SQL text. That is how injection is prevented.
- A transaction groups changes so they succeed or fail together; `with connection:` handles commit and rollback.
- Tables hold facts once; foreign keys and JOINs connect them; GROUP BY aggregates.
- The database enforces only the rules you declare, and some (like foreign keys in SQLite) must be switched on.

**Next:** Level 1 wraps up with `logging`, `subprocess`, and `urllib`. After that, Level 2 brings your first external dependency.
