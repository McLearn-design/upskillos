# Solutions, Batch 2

Try each challenge first. Compare your *approach*, not just your output. Every solution below was run and checked.

---

## Lesson 1.3: A robust sales reader

```python
def read_typed_sales(csv_file_path):
    typed_rows = []
    problem_messages = []

    with csv_file_path.open(newline="") as sales_file:
        dict_reader = csv.DictReader(sales_file)
        for raw_row in dict_reader:
            file_line_number = dict_reader.line_num
            try:
                typed_rows.append(convert_row_types(raw_row))
            except (ValueError, TypeError, KeyError) as error:
                problem_messages.append(
                    f"line {file_line_number}: {type(error).__name__}: {error} "
                    f"(row was {dict(raw_row)})"
                )

    return typed_rows, problem_messages


typed_sales_rows, problem_messages = read_typed_sales(sales_file_path)
total_revenue = sum(row["quantity"] * row["unit_price"] for row in typed_sales_rows)
print("Total revenue:", total_revenue)
for problem_message in problem_messages:
    print("PROBLEM", problem_message)
```

**Why these choices**

- `DictReader` already **skips completely blank lines**, so that requirement costs nothing. Check the docs for `csv.DictReader` to confirm.
- `dict_reader.line_num` is the number of lines the reader has consumed from the file. Unlike `enumerate`, it keeps counting through blank lines and through quoted fields that span several physical lines, so it matches what a text editor shows. (The header is line 1.)
- Three exception types are caught for three different failures: `ValueError` for text like `two`, `KeyError` for a missing header name, and `TypeError` for a **short row**. When a row has fewer fields than the header, `DictReader` fills the missing ones with `None`, and `int(None)` raises `TypeError`.
- Only those exceptions are caught. A bare `except:` would also hide your own typos.

**On the judgment question:** skipping 3 bad rows out of 10,000 and reporting them is usually right. Skipping 10,000 out of 10,000 means the whole file is the wrong shape, and the honest behavior is to stop and say so. A simple rule: if the problems exceed some fraction (say, half) of all rows, raise an error instead of continuing.

---

## Lesson 1.4: The application log

```python
APP_LOG_PATTERN = re.compile(
    r"^(?P<timestamp_text>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) "
    r"(?P<level>[A-Z]+) "
    r"\[(?P<component>[^\]]+)\] "
    r"(?P<message>.+)$"
)

ORDER_NUMBER_PATTERN = re.compile(r"order #(\d+)", re.IGNORECASE)


def parse_app_log_line(line_text):
    line_match = APP_LOG_PATTERN.match(line_text)
    if line_match is None:
        return None

    fields = line_match.groupdict()
    return {
        "when": datetime.strptime(fields["timestamp_text"], "%Y-%m-%d %H:%M:%S"),
        "level": fields["level"],
        "component": fields["component"],
        "message": fields["message"],
    }
```

Answering the three questions:

```python
app_records = []
malformed_line_count = 0
for line_text in app_log_lines:
    record = parse_app_log_line(line_text)
    if record is None:
        malformed_line_count += 1
    else:
        app_records.append(record)

lines_per_level = Counter(record["level"] for record in app_records)
errors_per_component = Counter(
    record["component"] for record in app_records if record["level"] == "ERROR"
)
order_numbers = [
    order_number
    for record in app_records
    for order_number in ORDER_NUMBER_PATTERN.findall(record["message"])
]

print(lines_per_level)
print(errors_per_component.most_common(1))
print(order_numbers)
```

On the four sample lines: two `ERROR`, one `INFO`, one `WARNING`; order numbers `['48213', '48214']`.

**Notes**

- The pattern is built by joining adjacent raw string literals. Python concatenates them at compile time, which gives you a readable multi-line pattern with no `re.VERBOSE` needed.
- The order-number pattern uses `re.IGNORECASE` because one message says `order #48213` and another says `Order #48214`.
- Because the pattern has exactly **one** group, `findall` returns a list of plain strings. With two or more groups it would return tuples (the surprise mentioned in the lesson).
- In the sample data `payments` and `inventory` each have one error, a **tie**. `most_common(1)` returns one of them (the one counted first). If a tie matters to you, take `most_common()` and look at all entries sharing the top count.

---

## Lesson 1.5: Subcommands

```python
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from log_parser import read_log_file


def handle_paths(parsed_records, arguments):
    top_paths = Counter(r["request_path"] for r in parsed_records).most_common(arguments.top)
    text_lines = [f"{count:>5}  {path}" for path, count in top_paths]
    return {"top_paths": top_paths}, text_lines


def handle_clients(parsed_records, arguments):
    top_clients = Counter(r["client_address"] for r in parsed_records).most_common(arguments.top)
    text_lines = [f"{count:>5}  {client}" for client, count in top_clients]
    return {"top_clients": top_clients}, text_lines


def handle_errors(parsed_records, arguments):
    error_records = [r for r in parsed_records if r["status_code"] >= 400]
    json_ready_errors = [{**r, "when": r["when"].isoformat()} for r in error_records]
    text_lines = [
        f"{r['when']:%Y-%m-%d %H:%M:%S}  {r['client_address']}  "
        f"{r['http_method']} {r['request_path']}  {r['status_code']}"
        for r in error_records
    ]
    return {"errors": json_ready_errors}, text_lines


def build_argument_parser():
    shared_options_parser = argparse.ArgumentParser(add_help=False)
    shared_options_parser.add_argument("log_file", type=Path, help="path to the access log file")
    shared_options_parser.add_argument("--format", choices=["text", "json"], default="text")

    top_level_parser = argparse.ArgumentParser(description="Summarize a web server access log.")
    subcommand_parsers = top_level_parser.add_subparsers(dest="command", required=True)

    paths_parser = subcommand_parsers.add_parser(
        "paths", parents=[shared_options_parser], help="most requested paths")
    paths_parser.add_argument("--top", type=int, default=3)
    paths_parser.set_defaults(handler=handle_paths)

    clients_parser = subcommand_parsers.add_parser(
        "clients", parents=[shared_options_parser], help="busiest clients")
    clients_parser.add_argument("--top", type=int, default=3)
    clients_parser.set_defaults(handler=handle_clients)

    errors_parser = subcommand_parsers.add_parser(
        "errors", parents=[shared_options_parser], help="requests with status 400 or higher")
    errors_parser.set_defaults(handler=handle_errors)

    return top_level_parser


def main():
    top_level_parser = build_argument_parser()
    arguments = top_level_parser.parse_args()
    if not arguments.log_file.exists():
        top_level_parser.error(f"file not found: {arguments.log_file}")

    parsed_records, _ = read_log_file(arguments.log_file)
    json_ready_data, text_lines = arguments.handler(parsed_records, arguments)

    if arguments.format == "json":
        print(json.dumps(json_ready_data, indent=2))
    else:
        print("\n".join(text_lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

**The ideas to take from it**

- **`parents=[shared_options_parser]`** lets three subcommands share `log_file` and `--format` without repeating the declarations. The shared parser is made with `add_help=False`, otherwise each child would get a conflicting `-h`.
- **`add_subparsers(dest="command", required=True)`** makes choosing a subcommand mandatory. Without `required=True`, running with no subcommand gets past `argparse` and then crashes later with an `AttributeError` on `arguments.handler`, instead of printing a usage message.
- **`set_defaults(handler=...)`** stores the function to call on the parsed `Namespace`. Dispatch becomes `arguments.handler(...)` with no `if command == ...` chain. Adding a fourth subcommand means adding one function and one parser, and touching nothing else.
- **Each handler returns two things**: data for JSON, and lines for text. The "output format" decision lives in `main`, in one place, rather than three.
- `{**r, "when": r["when"].isoformat()}` copies the record and replaces the `datetime`, which JSON can't serialize (the type table from Lesson 1.2 again).
- Order matters in the command line: the subcommand comes first, then its own arguments (`logstats.py paths access.log --top 3`).

Try `python logstats.py --help`, then `python logstats.py paths --help`. They show different text, because each level has its own parser.

---

## Lesson 1.6: Lending rules in the database

Two valid designs are shown. Read both: they enforce the rule in different places.

### Design A: check inside one explicit transaction

```python
    def check_out_tool(self, tool_id, borrower_name, checked_out_on):
        with self.connection:
            self.connection.execute("BEGIN IMMEDIATE")

            tool_row = self.connection.execute(
                "SELECT name FROM tools WHERE tool_id = ?", (tool_id,)
            ).fetchone()
            if tool_row is None:
                raise ValueError(f"there is no tool with id {tool_id}")

            open_loan_row = self.connection.execute(
                "SELECT borrower_name FROM loans WHERE tool_id = ? AND returned_on IS NULL",
                (tool_id,),
            ).fetchone()
            if open_loan_row is not None:
                raise ValueError(
                    f"{tool_row['name']} is already out with {open_loan_row['borrower_name']}"
                )

            self.connection.execute(
                "INSERT INTO loans (tool_id, borrower_name, checked_out_on) VALUES (?, ?, ?)",
                (tool_id, borrower_name, checked_out_on),
            )
```

**Why `BEGIN IMMEDIATE`?** By default, Python's `sqlite3` only opens a transaction *right before the first INSERT/UPDATE/DELETE*. Your two `SELECT` checks would run **outside** any transaction, so another connection could insert a loan in the gap between your check and your insert. `BEGIN IMMEDIATE` starts the transaction (and takes the write lock) up front, so the check and the insert are one indivisible step. If any `ValueError` is raised inside the `with`, the transaction is rolled back automatically.

### Design B: let the database enforce it

Add one statement to `_create_tables`:

```python
            self.connection.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS one_open_loan_per_tool
                ON loans(tool_id) WHERE returned_on IS NULL
            """)
```

This is a **partial unique index**: it says "no two rows may share a `tool_id` *among rows where `returned_on IS NULL`*". A tool can have any number of finished loans, but only one open one. Now the rule holds for every program that ever touches the file, not just yours:

```python
    def check_out_tool_with_index(self, tool_id, borrower_name, checked_out_on):
        try:
            with self.connection:
                self.connection.execute(
                    "INSERT INTO loans (tool_id, borrower_name, checked_out_on) VALUES (?, ?, ?)",
                    (tool_id, borrower_name, checked_out_on),
                )
        except sqlite3.IntegrityError as error:
            raise ValueError(f"cannot check out tool {tool_id}: {error}") from error
```

**Trade-off:** Design A gives friendlier messages (it names the borrower) and can carry richer rules. Design B can't be bypassed or raced. In real systems you often use **both**: the database as the final guarantee, the Python check for the nice error message.

### The two query methods

```python
    def tools_currently_out(self):
        return self.connection.execute("""
            SELECT tools.name, loans.borrower_name, loans.checked_out_on
            FROM loans
            JOIN tools ON tools.tool_id = loans.tool_id
            WHERE loans.returned_on IS NULL
            ORDER BY loans.checked_out_on
        """).fetchall()

    def loans_per_category(self):
        return self.connection.execute("""
            SELECT tools.category, COUNT(loans.loan_id) AS loan_count
            FROM tools
            LEFT JOIN loans ON loans.tool_id = tools.tool_id
            GROUP BY tools.category
            ORDER BY tools.category
        """).fetchall()
```

`LEFT JOIN` starts from `tools`, so a category whose tools were never lent still appears, with `COUNT(loans.loan_id)` equal to 0. (`COUNT(loans.loan_id)` counts non-NULL values; `COUNT(*)` would count the empty joined row as 1, which is wrong here. Try it.)

### Testing against memory

```python
workshop = WorkshopDatabase(":memory:")
drill_id = workshop.add_tool("drill", "power", 12.0)
workshop.add_tool("hammer", "hand", 2.0)

workshop.check_out_tool(drill_id, "Priya", "2026-10-01")

try:
    workshop.check_out_tool(drill_id, "Marcus", "2026-10-02")
except ValueError as error:
    print(error)                  # drill is already out with Priya

try:
    workshop.check_out_tool(99, "Nobody", "2026-10-02")
except ValueError as error:
    print(error)                  # there is no tool with id 99

workshop.return_tool(drill_id, "2026-10-03")
workshop.check_out_tool(drill_id, "Marcus", "2026-10-04")   # works now
print([tuple(row) for row in workshop.loans_per_category()])
# [('hand', 0), ('power', 2)]
```

If you keep the partial index from Design B in `_create_tables`, Design A still works. The Python checks just run first, so the friendly messages win.
