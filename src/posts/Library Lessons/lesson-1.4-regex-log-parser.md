# Lesson 1.4: A Log Parser with `re`

**Library:** `re` (regular expressions, standard library), plus `datetime`
**You will build:** a parser that turns raw web-server log lines into structured records and summarizes them
**Time:** about 90 minutes
**Prerequisites:** Lesson 1.3 (dictionaries, grouping with `Counter`)

**What survives if you throw `re` away:** pattern matching as a language of its own. Regular expressions work nearly the same in JavaScript, C++, grep, your editor's search box, and database queries.

---

## The problem

Servers write one line of text per request. Millions of lines, one format, no commas to split on cleanly. You want to answer: how many requests failed, which pages are hit most, which clients are noisiest.

```
203.0.113.7 - - [01/Oct/2026:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326
```

`line.split(" ")` falls apart: the timestamp contains a space, the quoted request contains spaces, and some fields can be `-`. You need to describe the **shape** of a line and ask "does this text have that shape, and where are its parts?"

## A pattern is a tiny program

A regular expression ("regex") is a string written in a special mini-language that describes text. The `re` library compiles that string into a matcher and runs it against your text.

**Mental model:** `pattern string → compile → matcher → search text → match object (or None) → groups (the captured parts)`.

Two things to hold on to before you type anything:

1. A match either **succeeds** and returns a *match object*, or **fails** and returns `None`. Forgetting the `None` case is the most common bug in regex code.
2. Always write patterns as **raw strings**: `r"..."`. Regex uses backslashes (`\d`), and Python also uses backslashes for escapes (`\n`). The `r` prefix tells Python to leave backslashes alone.

---

## Part 1: The building blocks (on a different problem)

The log format is intimidating, so we will learn the pieces on something small first: product codes like `SKU-4821-B`.

Create `regex_playground.py`. Type and run each step:

```python
import re

product_code_text = "Order contains SKU-4821-B and SKU-77-A, not sku-9999-C."
print(re.search(r"SKU", product_code_text))
```

The output is a `re.Match` object, showing the span and the matched text. A literal pattern matches itself. Now see the failure case:

```python
print(re.search(r"BANANA", product_code_text))
```

`None`. Make a habit of checking for it.

### Character classes: "any one of these"

```python
print(re.search(r"SKU-\d", product_code_text))
```

`\d` means any one digit. It matched `SKU-4`, only one digit. Other classes to learn:

| Token | Matches one character that is... |
| --- | --- |
| `\d` | a digit |
| `\w` | a letter, digit, or underscore |
| `\s` | whitespace (space, tab, newline) |
| `\D`, `\W`, `\S` | the opposite of the lowercase versions |
| `.` | any character except newline |
| `[ABC]` | one of A, B or C |
| `[A-Z]` | any uppercase letter |
| `[^"]` | anything *except* a double quote |

### Quantifiers: "how many"

```python
print(re.search(r"SKU-\d+", product_code_text))
```

`+` means one or more of the thing before it. Now `SKU-4821` is matched. Others:

| Token | Means |
| --- | --- |
| `+` | one or more |
| `*` | zero or more |
| `?` | zero or one (optional) |
| `{3}` | exactly three |
| `{2,4}` | two to four |

### Putting it together

```python
print(re.search(r"SKU-\d+-[A-Z]", product_code_text))
```

Try each variation on your own and predict first:

```python
print(re.search(r"SKU-\d{2}-[A-Z]", product_code_text))
print(re.search(r"sku-\d+-[A-Z]", product_code_text))
print(re.search(r"(?i)sku-\d+-[A-Z]", product_code_text))
```

Before running, predict which code each one lands on. The first needs exactly two digits, so it skips `SKU-4821-B` and finds `SKU-77-A`. The second is lowercase, so it skips all the uppercase codes and finds only `sku-9999-C`. The third uses an inline flag, `(?i)`, for case-insensitive matching, so it finds the very first code. Flags can also be passed as `re.IGNORECASE`.

### Groups: extracting the parts

Parentheses **capture** the part of the match inside them:

```python
code_match = re.search(r"SKU-(\d+)-([A-Z])", product_code_text)
print(code_match.group(0))   # the whole match
print(code_match.group(1))   # first parentheses
print(code_match.group(2))   # second parentheses
print(code_match.groups())   # all of them as a tuple
```

Numbered groups are fragile; add a third group in the middle and every number shifts. **Named groups** fix that:

```python
code_match = re.search(r"SKU-(?P<item_number>\d+)-(?P<variant_letter>[A-Z])", product_code_text)
print(code_match.group("item_number"))
print(code_match.groupdict())
```

`groupdict()` gives you a dictionary, ready to use.

### Finding all matches

`search` stops at the first match. For all of them:

```python
print(re.findall(r"SKU-\d+-[A-Z]", product_code_text))
for each_match in re.finditer(r"SKU-(?P<item_number>\d+)", product_code_text):
    print(each_match.start(), each_match.group("item_number"))
```

`findall` returns strings (or tuples when there are groups). `finditer` returns match objects, so you also get positions. Read `help(re.findall)` and notice how its return type changes depending on whether your pattern has groups. That surprises people constantly.

### Anchors and the three entry points

| Function | Succeeds when... |
| --- | --- |
| `re.search(p, s)` | the pattern appears *anywhere* in `s` |
| `re.match(p, s)` | the pattern matches at the *start* of `s` |
| `re.fullmatch(p, s)` | the pattern matches the *whole* of `s` |

`^` and `$` anchor to the start and end of the text inside a pattern. When you want to validate a whole line, use `fullmatch` (or anchors) so that junk before or after can't sneak through.

### Greedy vs lazy

```python
quoted_text = 'first "alpha" and second "beta" done'
print(re.search(r'".+"', quoted_text).group())
print(re.search(r'".+?"', quoted_text).group())
print(re.search(r'"[^"]+"', quoted_text).group())
```

The first is **greedy**: `.+` grabs as much as it can, then backs off only until the last `"`. The second adds `?` to be **lazy**: as little as possible. The third avoids the issue by saying "anything that is not a quote." For structured logs, the third style is usually the most reliable.

---

## Part 2: Describe one log line

Now the real task. Create `log_parser.py`. First, some data:

```python
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

log_file_path = Path("access.log")

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
```

Build the pattern **in pieces**, so each piece is visible. Add:

```python
client_address_piece = r"(?P<client_address>\S+)"
identity_pieces = r"\S+ \S+"
timestamp_piece = r"\[(?P<timestamp_text>[^\]]+)\]"
request_piece = r'"(?P<http_method>[A-Z]+) (?P<request_path>\S+) (?P<protocol>[^"]+)"'
status_piece = r"(?P<status_code>\d{3})"
size_piece = r"(?P<response_size>\d+|-)"

LOG_LINE_PATTERN = re.compile(
    "^" + client_address_piece + " " + identity_pieces + " " + timestamp_piece
    + " " + request_piece + " " + status_piece + " " + size_piece + "$"
)
```

Go through it piece by piece:

- `\S+` is "one or more non-space characters." Addresses contain no spaces.
- `\[` and `\]` are escaped brackets. Bare `[` starts a character class, so a literal bracket needs a backslash.
- `[^\]]+` is "anything but a closing bracket", the lazy-free way to say "up to the `]`."
- `\d+|-` is alternation: digits, **or** a dash. The log uses `-` when there was no body.
- `re.compile` turns the pattern string into a reusable object so Python doesn't have to re-parse the string on every line. The compiled object has `.search`, `.fullmatch`, and the other functions as methods.

Test it on one line:

```python
first_match = LOG_LINE_PATTERN.match(sample_log_lines[0])
print(first_match.groupdict())
```

Then the corrupted line:

```python
print(LOG_LINE_PATTERN.match(sample_log_lines[6]))
```

`None`. Anything that doesn't have the shape is rejected. That's how you'll count malformed lines.

## Part 3: From text to typed record

Same boundary lesson as the CSV: matched text is all strings. Add a conversion function:

```python
def parse_log_line(line_text):
    line_match = LOG_LINE_PATTERN.match(line_text)
    if line_match is None:
        return None

    fields = line_match.groupdict()
    response_size_text = fields["response_size"]
    return {
        "client_address": fields["client_address"],
        "when": datetime.strptime(fields["timestamp_text"], "%d/%b/%Y:%H:%M:%S %z"),
        "http_method": fields["http_method"],
        "request_path": fields["request_path"],
        "status_code": int(fields["status_code"]),
        "response_size": 0 if response_size_text == "-" else int(response_size_text),
    }


print(parse_log_line(sample_log_lines[2]))
```

`datetime.strptime(text, format)` parses text using a format string where `%d` is the day, `%b` an abbreviated month name, `%Y` a four-digit year, `%H:%M:%S` the time, and `%z` the UTC offset. Check the table in `help(datetime.strptime)` or the docs and rebuild the format string from the log's timestamp yourself.

## Part 4: Read the whole file and count

```python
parsed_records = []
malformed_line_count = 0

for line_text in log_file_path.read_text().splitlines():
    record = parse_log_line(line_text)
    if record is None:
        malformed_line_count += 1
    else:
        parsed_records.append(record)

print("Parsed:", len(parsed_records), "Malformed:", malformed_line_count)
```

Now the questions:

```python
requests_per_status = Counter(record["status_code"] for record in parsed_records)
print(requests_per_status)

requests_per_path = Counter(record["request_path"] for record in parsed_records)
print(requests_per_path.most_common(3))

failed_logins_per_client = Counter(
    record["client_address"]
    for record in parsed_records
    if record["request_path"] == "/login" and record["status_code"] == 401
)
print(failed_logins_per_client)

server_errors = [record for record in parsed_records if record["status_code"] >= 500]
print(len(server_errors), "server error(s)")
```

Last, group by calendar date using the parsed `datetime`:

```python
requests_per_day = Counter(record["when"].date() for record in parsed_records)
for day, count in sorted(requests_per_day.items()):
    print(day, count)
```

Parsing once into proper types is what makes these one-liners possible. A regex on every question would be slow and error-prone.

---

## Break it

1. **Greedy trap.** Replace `[^"]+` in the request piece with `.+`. Run on the sample. Does it still work here? Why might it break on a path containing a quote?
2. **Unescaped bracket.** Change `\[` to `[` in the timestamp piece and run. Read the `re.error`. It points at the pattern, not at your data.
3. **Missing `None` check.** Remove the `if line_match is None` guard. Which line triggers the error, and what is the message? This is the single most common regex crash.
4. **Wrong format string.** Change `%b` to `%m` in `strptime`. Read the `ValueError`. It quotes both the text and the format.

---

## Explore (guided)

Copy `log_parser.py` to `log_parser_explore.py`.

1. **`verbose` mode.** Rewrite the pattern as one multi-line raw string using `re.VERBOSE`, with a comment after each piece. Look up what `re.VERBOSE` does to spaces in the pattern, and what you must do to match a literal space.
2. **No-regex version.** Write `parse_log_line_without_regex(line_text)` using `str.split`, `str.partition`, and slicing only. Test it on all eight lines. Count how many special cases you needed (the quoted request, the bracketed time, `-`). That is the work regex was doing for you.
3. **Search vs fullmatch.** Replace `.match` with `.search` in `parse_log_line` and add a line like `'junk ' + sample_log_lines[0]` to the data. Does the junk line now parse? Which entry point is right for validating a whole line, and why?

Return to the original file. Then go further on your own: look at the "Regular Expression HOWTO" in the Python docs and try lookaheads (`(?=...)`) and `re.sub` with a function as the replacement.

---

## Challenge

The same server also writes an *application* log in a different shape:

```
2026-10-01 13:55:36 ERROR [payments] Card declined for order #48213
2026-10-01 13:56:10 INFO [orders] Order #48214 created
2026-10-01 14:02:11 WARNING [payments] Retrying gateway (attempt 2)
2026-10-01 14:03:00 ERROR [inventory] Stock count negative for item 77
```

Write `APP_LOG_PATTERN` and `parse_app_log_line(line_text)` that return a typed record (a real `datetime`, a `level`, a `component`, a `message`). Then answer, with `Counter`:

- How many lines of each level are there?
- Which component produced the most `ERROR` lines?
- Extract every order number mentioned anywhere in the messages (hint: a *second*, small pattern on the `message` field, using `findall`).

Treat lines that fail to parse the same way as before: count them, don't crash.

Solution is in `solutions/solutions-batch-2.md`.

---

## What you should now be able to say

- A regex describes a shape; a match object carries the parts; no match means `None`.
- Compile once, reuse; write raw strings; use named groups.
- `search`, `match` and `fullmatch` answer different questions.
- Parse to typed records once, then ask questions of the records.

**Next:** Lesson 1.5, where your scripts stop being edited-and-rerun files and become real command-line tools.
