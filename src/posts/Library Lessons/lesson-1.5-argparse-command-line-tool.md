# Lesson 1.5: Turn the Log Parser into a Command-Line Tool with `argparse`

**Library:** `argparse` (standard library), plus `sys` and `json`
**You will build:** `logstats.py`, a real command: `python logstats.py access.log --top 3 --format json`
**Time:** about 75 minutes
**Prerequisites:** Lesson 1.4 (you need your working `log_parser.py`), Lesson 0.1 (what `import` really does)

**What survives if you throw `argparse` away:** how programs receive input from outside (arguments, flags, exit codes), and how to design a command-line interface people can guess.

---

## The problem

Right now, to analyze a different log file you open `log_parser.py` and edit the filename. To change how many top paths to show, you edit again. A tool should take those choices as **arguments** at the moment you run it.

## What the shell hands your program

When you type `python logstats.py access.log --top 3` into a terminal, the shell splits the line on spaces and Python gives you a list called `sys.argv`:

```
['logstats.py', 'access.log', '--top', '3']
```

The first item is the script name. The rest are plain strings. Python has no idea that `--top` is special. Everything beyond this is something a library gives you, or something you write.

### The naive way

Make a throwaway file `argv_demo.py`:

```python
import sys

print(sys.argv)
```

Run it with different arguments:

```
python argv_demo.py
python argv_demo.py access.log
python argv_demo.py access.log --top 3
python argv_demo.py "my file.log"
```

The last one shows how the shell handles spaces: quotes keep `my file.log` as one item.

Now imagine writing the rest by hand: is `--top` followed by a value? Is the value a number? What if the user types `--top=3`? What about `-t 3`? What does `--help` print? What if they pass an unknown option? You'd be rewriting a parser. `argparse` is that parser.

**Mental model:** you *declare* the arguments your program accepts (names, types, defaults, help text) → `argparse` reads `sys.argv`, checks it against your declaration, and returns a `Namespace` object whose attributes hold the values. It also writes `--help` and error messages for you.

---

## Part 1: Make `log_parser.py` importable

You want `logstats.py` to *use* the parsing code you already wrote. That means importing `log_parser`. And Lesson 0.1 told you what `import` does: it **runs the file from top to bottom**. If you import `log_parser` as it is now, it will write `access.log`, parse it, and print all your counters. That's not what a library should do.

Prove it. In a terminal in your project folder:

```
python -c "import log_parser"
```

Everything prints. We need to separate "definitions" (safe to import) from "things that happen when run as a script".

Open `log_parser.py` and reorganize. **Keep** the imports, `LOG_LINE_PATTERN`, and `parse_log_line`. **Delete** the top-level code that creates `sample_log_lines`, writes the file, loops over lines, and prints counters. Then add these functions at the bottom:

```python
def read_log_file(log_file_path):
    parsed_records = []
    malformed_line_count = 0

    for line_text in log_file_path.read_text().splitlines():
        record = parse_log_line(line_text)
        if record is None:
            malformed_line_count += 1
        else:
            parsed_records.append(record)

    return parsed_records, malformed_line_count


def write_sample_log_file(log_file_path):
    sample_log_lines = [
        '203.0.113.7 - - [01/Oct/2026:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326',
        '198.51.100.23 - - [01/Oct/2026:13:55:41 +0000] "GET /products/42 HTTP/1.1" 200 5120',
        '203.0.113.7 - - [01/Oct/2026:13:56:02 +0000] "POST /login HTTP/1.1" 401 128',
        '192.0.2.99 - - [01/Oct/2026:14:02:10 +0000] "GET /missing-page HTTP/1.1" 404 512',
        '203.0.113.7 - - [01/Oct/2026:14:03:55 +0000] "POST /login HTTP/1.1" 401 128',
        '198.51.100.23 - - [01/Oct/2026:14:10:00 +0000] "GET /products/42 HTTP/1.1" 304 -',
        'this line is corrupted',
        '192.0.2.99 - - [02/Oct/2026:09:00:01 +0000] "GET /index.html HTTP/1.1" 500 900',
    ]
    log_file_path.write_text("\n".join(sample_log_lines) + "\n")


if __name__ == "__main__":
    write_sample_log_file(Path("access.log"))
    print("Wrote access.log")
```

### What is `if __name__ == "__main__"`?

Every module has a built-in name called `__name__`. When Python runs a file **directly** (`python log_parser.py`), it sets `__name__` to the string `"__main__"`. When the file is **imported**, `__name__` is the module's own name (`"log_parser"`). So that `if` means "only do this when I'm the program being run, not a library being imported."

Check both:

```
python log_parser.py
python -c "import log_parser"
```

The first writes the sample file. The second does nothing visible. That's the correct behavior for a library.

Add one scratch line to see the mechanism, run both commands, then delete it:

```python
print("my __name__ is", __name__)
```

## Part 2: The smallest parser

Create `logstats.py`:

```python
import argparse
from pathlib import Path

argument_parser = argparse.ArgumentParser(
    description="Summarize a web server access log."
)
argument_parser.add_argument("log_file", type=Path, help="path to the access log file")

parsed_arguments = argument_parser.parse_args()
print(parsed_arguments)
print(parsed_arguments.log_file, type(parsed_arguments.log_file))
```

Run each of these and read the output carefully:

```
python logstats.py access.log
python logstats.py
python logstats.py --help
python logstats.py access.log extra_thing
```

You wrote no error handling, yet missing and extra arguments produce clear messages and a usage line, and `--help` documents your tool. The `type=Path` means `argparse` converts the raw string to a `Path` object for you, the same idea as `int` for numbers.

Check `help(argparse.ArgumentParser.add_argument)` and the signature of `parse_args`. What does `parse_args` read when you pass nothing? (Answer: `sys.argv[1:]`.)

## Part 3: Options, defaults, and flags

There are three kinds of argument. Add each in turn, directly after the `log_file` line:

**Positional**: required, identified by position. You just added one.

**Option with a value**:

```python
argument_parser.add_argument(
    "--top", type=int, default=3,
    help="how many of the most requested paths to show (default: 3)",
)
argument_parser.add_argument(
    "--status", type=int,
    help="only count requests with this HTTP status code",
)
```

Names starting with `--` are optional. If the user leaves them out you get the `default`, and when none is given the default is `None`. `type=int` converts, and fails with a clean message if the user types `--top banana`.

**Restricted choices**:

```python
argument_parser.add_argument(
    "--format", choices=["text", "json"], default="text",
    help="how to print the results",
)
```

**On/off flag**:

```python
argument_parser.add_argument(
    "--show-malformed", action="store_true",
    help="also report how many lines could not be parsed",
)
```

`action="store_true"` means the option takes no value: it's `False` if absent and `True` if present. Notice the dash in `--show-malformed` becomes an underscore in the attribute: `parsed_arguments.show_malformed`.

Try:

```
python logstats.py access.log --top 5 --status 404
python logstats.py access.log --top=5
python logstats.py access.log --top banana
python logstats.py access.log --format xml
python logstats.py access.log --show-malformed
python logstats.py --top 2 access.log
```

Order of options relative to the positional doesn't matter.

## Part 4: Do the actual work

Now wire the parsed arguments to real behavior. Delete the two `print` lines at the bottom of `logstats.py` and restructure the file into functions. First the top of the file:

```python
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from log_parser import read_log_file
```

Keep the argument declarations, but move them inside a function:

```python
def build_argument_parser():
    argument_parser = argparse.ArgumentParser(
        description="Summarize a web server access log."
    )
    argument_parser.add_argument("log_file", type=Path, help="path to the access log file")
    # ... paste your --top, --status, --format and --show-malformed declarations here,
    #     with the same names and indentation inside this function ...
    return argument_parser
```

Then the summary logic, which takes plain values and returns plain data (so it's easy to test and reuse):

```python
def summarize(parsed_records, top_count, status_filter):
    if status_filter is not None:
        parsed_records = [
            record for record in parsed_records
            if record["status_code"] == status_filter
        ]

    requests_per_path = Counter(record["request_path"] for record in parsed_records)
    requests_per_status = Counter(record["status_code"] for record in parsed_records)

    return {
        "total_requests": len(parsed_records),
        "top_paths": requests_per_path.most_common(top_count),
        "status_counts": dict(requests_per_status),
    }
```

Then a function that prints in the chosen format:

```python
def print_summary(summary, output_format):
    if output_format == "json":
        print(json.dumps(summary, indent=2))
        return

    print("Total requests:", summary["total_requests"])
    print("Top paths:")
    for path, count in summary["top_paths"]:
        print(" ", count, path)
    print("Status codes:", summary["status_counts"])
```

Finally the entry point:

```python
def main():
    argument_parser = build_argument_parser()
    arguments = argument_parser.parse_args()

    if not arguments.log_file.exists():
        argument_parser.error(f"file not found: {arguments.log_file}")

    parsed_records, malformed_line_count = read_log_file(arguments.log_file)
    summary = summarize(parsed_records, arguments.top, arguments.status)
    print_summary(summary, arguments.format)

    if arguments.show_malformed:
        print("Malformed lines:", malformed_line_count, file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
```

Several ideas here deserve a closer look:

- `argument_parser.error(message)` prints the usage line and the message to the error stream and exits with status **2**. That's the standard code for "you called me wrong."
- `print(..., file=sys.stderr)` writes to the **error stream**, separate from the normal output stream. Why does that matter? Run with `--format json --show-malformed > out.json` in a shell. The JSON lands in the file; the malformed count still shows on screen. Output you want to pipe stays clean.
- `sys.exit(main())` turns `main`'s return value into the process **exit code**. By convention, `0` means success, anything else means failure. Other programs (and `&&` in a shell) rely on this.
- `main` does little but connect the pieces. `summarize` and `print_summary` don't know about `argparse` at all.

Run it:

```
python log_parser.py
python logstats.py access.log
python logstats.py access.log --top 1 --format json
python logstats.py access.log --status 401
python logstats.py missing.log
echo $?
```

(On Windows PowerShell, use `echo $LASTEXITCODE`.) The last pair shows the failing exit code.

---

## Break it

1. **Order of declarations.** Move `add_argument("log_file", ...)` below the options and run `--help`. Does the behavior change? Does the displayed usage?
2. **Wrong default type.** Set `default="3"` (a string) on `--top` while keeping `type=int`. Run without `--top`. Does `type` get applied to defaults? (The docs say when. Look it up.)
3. **Forgotten guard.** Remove `if __name__ == "__main__":` from `logstats.py` and run `python -c "import logstats"`. What happened, and why is it a problem if someone writes tests?
4. **Shadowed filter.** Run with `--status 0`. Then think: what does the line `if status_filter is not None` protect you from that `if status_filter:` would get wrong?

---

## Explore (guided)

Copy `logstats.py` to `logstats_explore.py`.

1. **Short flags.** Give `--top` the short alias `-n`, with `add_argument("-n", "--top", ...)`. Run `--help` and note how both names appear. Then try `-n3`.
2. **Mutually exclusive options.** Look up `add_mutually_exclusive_group` and make `--status` and a new `--min-status` option exclusive. Trigger the error on purpose.
3. **Strings only.** Rebuild the same interface by looping over `sys.argv` by hand: handle the filename, `--top N`, `--status N`, and `--show-malformed`. Count how many lines you needed, and which error cases you skipped.

Return to the original afterwards. When you're ready to look beyond the standard library, search for how third-party libraries like `typer` and `click` declare arguments, and compare them with what you wrote today. (Level 2 does exactly that.)

---

## Challenge

Real tools like `git` have **subcommands**: `git commit`, `git log`. Restructure `logstats.py` so these work:

```
python logstats.py paths access.log --top 3
python logstats.py clients access.log --top 3
python logstats.py errors access.log
```

- `paths`: top requested paths (what you have now).
- `clients`: top client addresses by request count.
- `errors`: every record with status 400 or higher, one per line, showing time, client, method, path and status.

Requirements: `--help` at the top level lists the three subcommands, each subcommand has its own `--help`, and `--format json` works for all three. Look up `add_subparsers` and `set_defaults(handler=...)` in the docs to find the pattern for dispatching.

Solution is in `solutions/solutions-batch-2.md`.

---

## What you should now be able to say

- The shell gives your program a list of strings; `argparse` turns your declarations into validation, conversion, and help.
- `if __name__ == "__main__"` separates importing from running.
- Logic that takes plain values and returns plain data is reusable; the command-line layer is a thin skin over it.
- Exit codes and the error stream are part of a command's public behavior.

**Next:** Lesson 1.6, where results stop disappearing when the program ends.
