# Lesson 12.5: SQLite via the `sqlite3` C API

*Phase 12 — Persistence Layer: Files, JSON, XML, CSV, SQLite*
*Your first real "database" — no server needed.*

---

## A genuinely different kind of persistence

Every format in this phase so far — CSV, JSON, XML — shares a real limitation: to find one specific record, you load the *entire* file into memory and search it yourself, exactly Lesson 5.4's O(n) linear scan, applied to a file instead of a linked list. For a file with a million records, that's a million records loaded and scanned, every single time, for every single query. A database flips this: the data lives in a format specifically designed for **querying** without loading everything, using real indexes (Phase 7's BSTs and Phase 8's hash tables, doing real work inside the database engine itself) to jump directly to what you need. **SQLite** is a genuine, production-grade relational database — used in literally billions of devices (it's the database engine inside nearly every smartphone, most web browsers, and a huge amount of embedded software) — that requires no separate server process at all: the entire database lives in one file on disk, and your program talks to it directly through a library.

## Creating a database and a table

```cpp
#include <sqlite3.h>
#include <iostream>

int main() {
    sqlite3* db;
    int result = sqlite3_open("people.db", &db);   // creates the file if it doesn't exist

    if (result != SQLITE_OK) {
        std::cerr << "Can't open database: " << sqlite3_errmsg(db) << std::endl;
        return 1;
    }

    const char* createTableSql =
        "CREATE TABLE IF NOT EXISTS people ("
        "id INTEGER PRIMARY KEY, "
        "name TEXT NOT NULL, "
        "age INTEGER"
        ");";

    char* errMsg = nullptr;
    result = sqlite3_exec(db, createTableSql, nullptr, nullptr, &errMsg);

    if (result != SQLITE_OK) {
        std::cerr << "SQL error: " << errMsg << std::endl;
        sqlite3_free(errMsg);
    }

    sqlite3_close(db);   // notice: this is manual, C-style cleanup — the next lesson covers this directly
    return 0;
}
```

`sqlite3_open` and `sqlite3_close` are a genuine acquire/release pair — exactly RAII's shape (Lesson 2.5), just not wrapped in a C++ class yet, because `sqlite3` is a plain C library, predating and entirely independent of C++'s object model. This matters, and it's worth naming directly: **every raw `sqlite3*` handle you open needs a matching `sqlite3_close`, on every exit path, by hand** — precisely Lesson 1.4's manual-cleanup discipline, resurfacing here because you're interfacing with a C API that has no concept of destructors at all. This is exactly the gap the Repository pattern (arriving in two lessons) will close by wrapping this raw API inside a proper C++ RAII class.

## Inserting data — and a critical safety lesson

```cpp
void insertPerson(sqlite3* db, const std::string& name, int age) {
    std::string sql = "INSERT INTO people (name, age) VALUES ('" + name + "', " + std::to_string(age) + ");";
    char* errMsg = nullptr;
    sqlite3_exec(db, sql.c_str(), nullptr, nullptr, &errMsg);
}
```

**Do not use this code.** It's shown deliberately, as a worked example of a real, serious vulnerability: **SQL injection.** If `name` were, say, `Robert'); DROP TABLE people; --`, the resulting SQL string would be:

```sql
INSERT INTO people (name, age) VALUES ('Robert'); DROP TABLE people; --', 30);
```

The attacker-controlled string closes the intended `INSERT` statement early and injects a second, malicious statement — a real, famous, widely-documented attack (named, with dark humor, "Little Bobby Tables" in the programming community), responsible for real, serious data breaches in real production systems over the decades. **Never build SQL strings by directly concatenating user-provided or external data into them.** The fix: **prepared statements**, which separate the SQL *structure* from the *data* entirely, so data can never be interpreted as SQL syntax, no matter what it contains.

## The correct, safe way: prepared statements

```cpp
void insertPersonSafe(sqlite3* db, const std::string& name, int age) {
    sqlite3_stmt* stmt;
    const char* sql = "INSERT INTO people (name, age) VALUES (?, ?);";   // ? are PLACEHOLDERS

    sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);

    sqlite3_bind_text(stmt, 1, name.c_str(), -1, SQLITE_TRANSIENT);   // bind the FIRST ? to name
    sqlite3_bind_int(stmt, 2, age);                                      // bind the SECOND ? to age

    int result = sqlite3_step(stmt);   // actually execute the statement
    if (result != SQLITE_DONE) {
        std::cerr << "Insert failed: " << sqlite3_errmsg(db) << std::endl;
    }

    sqlite3_finalize(stmt);   // another manual cleanup step — matches sqlite3_prepare_v2
}
```

The `?` placeholders are never textually substituted with `name`'s raw content — `sqlite3_bind_text` hands the database engine `name`'s value as *pure data*, through a dedicated binding mechanism, structurally incapable of being reinterpreted as SQL syntax, no matter what characters it contains. This is the single most important lesson in this entire phase, worth restating precisely: **the fix for SQL injection is not "carefully sanitize the input string" — it's "never build the query by inserting data into a string at all."** Sanitization-based approaches are a real, historically common source of bugs, because there's always some edge case (an unusual character encoding, a cleverly crafted input) a manual sanitizer misses; prepared statements eliminate the entire vulnerability class structurally, the same "turn a discipline into a guarantee" theme this curriculum has repeated since Lesson 2.3's constructors.

## Querying data

```cpp
void printAllPeople(sqlite3* db) {
    sqlite3_stmt* stmt;
    const char* sql = "SELECT id, name, age FROM people;";

    sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);

    while (sqlite3_step(stmt) == SQLITE_ROW) {   // one call per ROW returned — note the loop shape
        int id = sqlite3_column_int(stmt, 0);
        const unsigned char* name = sqlite3_column_text(stmt, 1);
        int age = sqlite3_column_int(stmt, 2);

        std::cout << id << ": " << name << ", age " << age << std::endl;
    }

    sqlite3_finalize(stmt);
}
```

`sqlite3_step` returning `SQLITE_ROW` repeatedly, once per result row, until it finally returns `SQLITE_DONE`, is structurally the same shape as Phase 9's BFS `while (!queue.empty())` or Lesson 9.2's DFS stack loop — "repeatedly pull the next thing until there's nothing left" — a genuinely recurring shape across this entire curriculum, now applied to database rows instead of graph vertices.

## Querying with a parameter — a `WHERE` clause, safely

```cpp
std::optional<int> findAgeByName(sqlite3* db, const std::string& name) {
    sqlite3_stmt* stmt;
    const char* sql = "SELECT age FROM people WHERE name = ?;";

    sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
    sqlite3_bind_text(stmt, 1, name.c_str(), -1, SQLITE_TRANSIENT);

    std::optional<int> result;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        result = sqlite3_column_int(stmt, 0);
    }

    sqlite3_finalize(stmt);
    return result;   // Lesson 11.2's std::optional — a clean, real-world "might not have found anything" case
}
```

Notice `std::optional<int>` returning cleanly from this function — a genuine, practical use of Lesson 11.2's material: "found a matching person with this age" and "no person with that name exists" are both entirely legitimate, expected outcomes of a database lookup, and `std::optional` expresses that distinction honestly, without a sentinel value or an awkward output parameter.

## Try it yourself

**1. Build the full pipeline above: create a table, insert several people using the safe, prepared-statement version, and query them back, confirming every field round-trips correctly.**

**2. Deliberately construct the SQL-injection scenario using the unsafe `insertPerson` function from this lesson, with a name like `Robert'); DROP TABLE people; --`, in a throwaway test database you don't mind losing.** Confirm the table genuinely gets dropped — direct, felt, slightly alarming proof of why this vulnerability is treated so seriously in real software, rather than an abstract warning to take on faith. Then confirm the prepared-statement version handles the identical malicious string completely safely, storing it as an inert, harmless literal name.

**3. Write `findAgeByName` and confirm it correctly returns `std::nullopt` for a name that doesn't exist in the table, and a real age for one that does.**

**4. Compare query speed against a linear scan through an equivalent in-memory `std::vector<Person>`, for a table/vector with 100,000 rows, searching by name.** Time both, using the `<chrono>` technique from Phase 3. (SQLite can create an index on the `name` column — `CREATE INDEX idx_name ON people(name);` — try the comparison both with and without this index, and notice the dramatic difference it makes; this is Phase 7/8's BST/hash-table machinery, operating inside the database engine, exactly as this lesson's opening claimed.)

## What this cost / bought us

| | CSV/JSON/XML (Lessons 12.1–12.4) | SQLite (this lesson) |
|---|---|---|
| Querying a specific record | Load the whole file, scan it yourself — O(n) | Can use real indexes — O(log n) or better |
| Concurrent access from multiple parts of a program | Not safe without your own coordination | Built-in transaction support (beyond this lesson's scope, but real) |
| Risk of injection-style vulnerabilities | Not applicable — these are plain data formats | **Real, and genuinely serious** — mitigated entirely by prepared statements |
| Setup complexity | Minimal — just a file | A real schema (`CREATE TABLE`), a real query language (SQL) |
| Cleanup discipline | RAII-friendly fstream objects (Lesson 12.1) | Manual, C-style (`sqlite3_close`/`sqlite3_finalize`) — a real gap the next pattern closes |

SQLite is the first tool in this phase that's a genuine database, not just a file format — real indexing, a real query language, and a real, serious security surface that demands the discipline this lesson insisted on. The raw C API's manual cleanup is a real, deliberate rough edge, left unresolved specifically so the next lesson's Repository pattern has something concrete and necessary to fix.

---

**Next up: Lesson 12.6 — Calling a free REST API with `cpr`/`libcurl`, parsing the JSON response into your own objects.** You've already done this once, in Phase 9's checkpoint — this lesson formalizes it as first-class material, closing the loop on this phase's full survey of persistence and data-exchange formats.
