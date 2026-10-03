# Lesson 12.2: CSV Parsing — Hand-Rolled, Then With a Small Library

*Phase 12 — Persistence Layer: Files, JSON, XML, CSV, SQLite*

---

## The simplest real structured format

CSV (comma-separated values) is about as minimal as structured text gets: one record per line, fields separated by commas. Phase 2's checkpoint read a CSV of bare numbers, one per line — the simplest possible case. Real CSV files are messier, and this lesson builds a genuine parser by hand before reaching for a library, following this curriculum's pattern since Lesson 1.6: understand the mechanism, then trust the tool.

## The naive approach, and exactly where it breaks

```cpp
std::vector<std::string> splitNaive(const std::string& line, char delimiter) {
    std::vector<std::string> fields;
    std::stringstream ss(line);
    std::string field;
    while (std::getline(ss, field, delimiter)) {   // std::getline with a custom delimiter, not just '\n'
        fields.push_back(field);
    }
    return fields;
}
```

This works for a clean line like `Alice,30,Engineering`. It breaks the instant a field itself contains a comma — a genuinely common, real case: `"Smith, John",45,Sales`, where the name field is deliberately quoted specifically *because* it contains a comma. The naive splitter sees four fields instead of three, silently corrupting the data. This is worth testing directly before trusting any CSV code — the "looks simple" nature of CSV hides a real amount of necessary complexity the moment real-world data is involved.

## A real parser: handling quoted fields

```cpp
std::vector<std::string> parseCsvLine(const std::string& line) {
    std::vector<std::string> fields;
    std::string current;
    bool inQuotes = false;

    for (size_t i = 0; i < line.size(); i++) {
        char c = line[i];

        if (c == '"') {
            if (inQuotes && i + 1 < line.size() && line[i + 1] == '"') {
                current += '"';   // an ESCAPED quote ("" inside a quoted field means a literal ")
                i++;               // skip the second quote character
            } else {
                inQuotes = !inQuotes;   // toggle quote state
            }
        } else if (c == ',' && !inQuotes) {
            fields.push_back(current);   // only split on a comma OUTSIDE quotes
            current.clear();
        } else {
            current += c;
        }
    }
    fields.push_back(current);   // the last field has no trailing comma to trigger a push

    return fields;
}
```

Trace this against `"Smith, John",45,Sales`: the parser enters quote mode at the first `"`, so the comma immediately after `Smith,` is treated as ordinary text (because `inQuotes` is `true`), correctly keeping `Smith, John` as one field. It exits quote mode at the closing `"`, then correctly splits on the next two genuine, unquoted commas. The escaped-quote handling (`""` inside a quoted field meaning a literal `"` character) is a real, standard CSV convention — test it against a field like `"She said ""hello"""` to confirm it resolves to the single field `She said "hello"`.

## Why this is worth building by hand even though libraries exist

This parser is a direct, concrete instance of Lesson 7.1's state-machine-shaped thinking, applied to text instead of a tree: `inQuotes` is exactly one bit of state, carried character by character, determining how each subsequent character should be interpreted — the same fundamental idea as Lesson 8.3's tombstone flag, or the three-color technique from Lesson 9.3's cycle detection, just applied here to parsing rather than graph traversal or hash tables. Recognizing "this is a small state machine" is a genuinely transferable skill, and CSV parsing is a clean, approachable place to practice it before meeting genuinely larger state machines (a real programming language's lexer, for instance) elsewhere.

## Reading a full CSV file

```cpp
#include <fstream>

std::vector<std::vector<std::string>> readCsv(const std::string& filename) {
    std::ifstream file(filename);
    std::vector<std::vector<std::string>> rows;
    std::string line;

    while (std::getline(file, line)) {
        rows.push_back(parseCsvLine(line));
    }

    return rows;
}
```

```cpp
int main() {
    auto rows = readCsv("people.csv");

    // assume row 0 is a header: "name,age,department"
    for (size_t i = 1; i < rows.size(); i++) {
        std::cout << "Name: " << rows[i][0] << ", Age: " << rows[i][1]
                  << ", Dept: " << rows[i][2] << std::endl;
    }

    return 0;
}
```

## The small library version: `rapidcsv`

For real projects, a small, well-tested header-only library (Phase 5 established the pattern of reaching for header-only third-party libraries) saves you from re-solving edge cases this lesson's hand-rolled parser doesn't yet handle — embedded newlines inside quoted fields, different line-ending conventions (`\n` vs `\r\n`) across operating systems, and more:

```cpp
#include <rapidcsv.h>

int main() {
    rapidcsv::Document doc("people.csv");

    for (size_t i = 0; i < doc.GetRowCount(); i++) {
        std::string name = doc.GetCell<std::string>("name", i);
        int age = doc.GetCell<int>("age", i);
        std::cout << name << " is " << age << std::endl;
    }

    return 0;
}
```

Notice `GetCell<int>("age", i)` — a genuine, real-world use of Lesson 10.3's templates: one function, parameterized by the return type you need, deduced from how you call it, handling the string-to-`int` conversion internally so you don't write `std::stoi` by hand at every call site.

## Try it yourself

**1. Build `parseCsvLine` and test it against a deliberately tricky set of lines**: a plain unquoted line, a line with one quoted field containing a comma, a line with an escaped quote inside a quoted field, and an empty field (two consecutive commas). Confirm every case parses correctly by printing the resulting field count and contents for each.

**2. Generate a realistic, messy CSV with Python** — include some names with commas (`"Smith, John"`), some with quotes inside them, and some perfectly ordinary rows — and confirm your C++ parser handles the whole file correctly, matching what Python's own `csv` module would produce for the same file (a genuinely good cross-check: parse the same file with Python's `csv.reader` and compare field-by-field against your C++ output).

**3. Deliberately break your parser with a genuinely hard case it doesn't yet handle: a quoted field containing a literal newline character.** (Standard CSV allows this — a quoted field can legitimately span multiple physical lines.) Confirm your line-by-line `readCsv` function, which reads one `std::getline` per row, incorrectly treats the embedded newline as the end of the row. This is a real, instructive limitation, and it's exactly the kind of edge case `rapidcsv` or a similarly mature library has already solved for you — a genuine, felt motivation for reaching for the library in real work, beyond a chapter is telling you to.

**4. Install and use `rapidcsv` (or a similar library) against the same messy test file from exercise 2, and confirm it correctly handles the embedded-newline case your hand-rolled version couldn't.**

## What this cost / bought us

| | Naive comma-split | Hand-rolled quote-aware parser | Real library (`rapidcsv`) |
|---|---|---|---|
| Handles quoted fields with commas | No | Yes | Yes |
| Handles escaped quotes | No | Yes | Yes |
| Handles embedded newlines in quoted fields | No | No — a real limitation | Yes |
| Code you wrote and understand completely | Yes | Yes | No — but you understand what it's doing, having built a simpler version yourself |

This lesson's state-machine parser is correct for a genuinely useful subset of real CSV files, and understanding exactly where it stops being correct (embedded newlines) is worth more than either blind trust in a library or blind confidence in your own from-scratch code — precisely the calibrated, "know the mechanism, know its limits, then decide what to trust" discipline this entire curriculum has been building since Lesson 1.6.

---

**Next up: Lesson 12.3 — JSON with `nlohmann/json` — serialize/deserialize your own classes.** You've been *reading* JSON since Phase 5; this lesson closes the loop by *writing* your own `Person`/`TreeNode`-style objects back out to JSON, round-trip.
