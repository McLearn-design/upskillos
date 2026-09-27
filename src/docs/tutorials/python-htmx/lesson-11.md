# Lesson 11: Parameterized Queries — SQL Injection and How to Prevent It

You will build secure, injection-proof database queries across a variety of scenarios—login checks, insertions, and searches. Along the way, we will address the transferable problem: SQL injection is the #1 web vulnerability, caused by concatenating user input into SQL strings, and the universal fix is parameterized queries where the database driver strictly separates SQL code from user data.

**What you need to know first:**
- Lesson 10 (connecting to SQLite databases and basic tables)

**Terms used in this lesson:**
- **SQL injection** — The #1 web vulnerability where user input is concatenated into SQL strings, allowing attackers to execute arbitrary SQL code instead of just providing data.
- **Parameterized query** — A SQL query where `?` placeholders are used instead of string concatenation, forcing the database to treat inputs strictly as literal data rather than executable SQL syntax.
- **f-string** — Python's formatted string literals (`f"..."`), which evaluate expressions inside curly braces at runtime. Never use these for building SQL queries with user input, as they enable injection.
- **Named parameters** — SQL placeholders that use a `:name` syntax instead of positional `?` placeholders. Useful when a query takes many parameters, eliminating positional confusion and off-by-one errors.
- **Second-order injection** — An attack where malicious data is safely stored in the database initially but is later retrieved and improperly concatenated into a new, vulnerable query.
- **SQLite wildcards** — Special characters like `%` used in `LIKE` queries to match partial strings. When used with parameterized queries, the wildcard is appended to the Python string before being passed as a parameter; it is never concatenated into the SQL statement itself.
- **SQL comments (`--`)** — Characters that tell the SQL parser to ignore the rest of the line. Frequently used in injection attacks to bypass trailing constraints (like a password check) by commenting them out.

**Objects and methods used:**
- **`sqlite3`**
  - *What it is:* Python's built-in module for working with SQLite databases.
  - *Implementation:* A standard library C extension module adhering to the Python DB-API 2.0 specification.
  - *Its use:* Used throughout the lesson to connect to databases, execute queries, and handle errors.
  - *Type:* Python module.
  - *Responsibility:* Provides the interface between Python code and the SQLite C library.
  - *Depends on:* The underlying SQLite C library installed on the system.
  - *Connects to:* Exposes connections, cursors, and exceptions to application code.
  - *Shape:* Standard library import.

- **`sqlite3.connect`**
  - *What it is:* The function that opens a connection to an SQLite database.
  - *Implementation:* `sqlite3.connect(database, ...)` returning a `sqlite3.Connection` object.
  - *Its use:* We pass `':memory:'` to create an ephemeral, RAM-only database for these throwaway examples.
  - *Type:* Module-level function.
  - *Responsibility:* Establishes and configures the database connection.
  - *Depends on:* A file path or `':memory:'` string.
  - *Connects to:* Returns a Connection object for the app to execute queries against.
  - *Shape:* The entry point to all SQLite operations.

- **`Connection.execute`**
  - *What it is:* A shortcut method that creates an intermediate cursor and executes a SQL query in one step.
  - *Implementation:* `execute(sql, parameters=())` on a Connection object, returning a `Cursor`.
  - *Its use:* We use it to run all `CREATE TABLE`, `INSERT`, and `SELECT` statements in the lesson.
  - *Type:* Instance method on `sqlite3.Connection`.
  - *Responsibility:* Parses and executes a single SQL statement, safely binding parameters if provided.
  - *Depends on:* A SQL string and an optional tuple/dict of parameters.
  - *Connects to:* Passes the query to the SQLite engine and returns a Cursor with the results.
  - *Shape:* The primary query execution boundary.

- **`Cursor.fetchone`**
  - *What it is:* A method to retrieve the next row of a query result set.
  - *Implementation:* `fetchone()` on a Cursor object, returning a tuple, `sqlite3.Row`, or `None`.
  - *Its use:* Used to fetch exactly one expected row, like a single user on login.
  - *Type:* Instance method on `sqlite3.Cursor`.
  - *Responsibility:* Retrieves a single result row and advances the cursor's internal pointer.
  - *Depends on:* A previously executed query that returned results.
  - *Connects to:* Returns data to the calling Python code.
  - *Shape:* Data retrieval boundary.

- **`Cursor.fetchall`**
  - *What it is:* A method to retrieve all remaining rows of a query result set.
  - *Implementation:* `fetchall()` on a Cursor object, returning a list of tuples/Rows.
  - *Its use:* Used to retrieve multiple results, like a list of notes or search matches.
  - *Type:* Instance method on `sqlite3.Cursor`.
  - *Responsibility:* Consumes the entire remaining result set into a Python list.
  - *Depends on:* A previously executed query that returned results.
  - *Connects to:* Returns data to the calling Python code.
  - *Shape:* Bulk data retrieval boundary.

- **`Connection.commit`**
  - *What it is:* A method that saves all pending database changes.
  - *Implementation:* `commit()` on a Connection object, returning `None`.
  - *Its use:* Called after `INSERT` or `CREATE TABLE` to make changes permanent.
  - *Type:* Instance method on `sqlite3.Connection`.
  - *Responsibility:* Flushes the current transaction to disk/memory.
  - *Depends on:* An active transaction with pending changes.
  - *Connects to:* Instructs the SQLite engine to persist changes.
  - *Shape:* Transaction boundary.

- **`Connection.rollback`**
  - *What it is:* A method that undoes all pending database changes in the current transaction.
  - *Implementation:* `rollback()` on a Connection object, returning `None`.
  - *Its use:* Crucial in error handling to clear a failed transaction after an `IntegrityError`.
  - *Type:* Instance method on `sqlite3.Connection`.
  - *Responsibility:* Aborts the current transaction and discards uncommitted changes.
  - *Depends on:* An active transaction, typically one that just threw an error.
  - *Connects to:* Instructs the SQLite engine to revert state.
  - *Shape:* Error recovery boundary.

- **`sqlite3.Row`**
  - *What it is:* A highly optimized row factory for SQLite results.
  - *Implementation:* A class used by assigning it to `Connection.row_factory`.
  - *Its use:* Makes result rows behave like both tuples and dicts, so columns can be accessed by name (e.g., `note["title"]`).
  - *Type:* Class.
  - *Responsibility:* Wraps raw tuple results to provide dictionary-like column access.
  - *Depends on:* A cursor description and raw tuple data from SQLite.
  - *Connects to:* Provides application code with named column access.
  - *Shape:* Data representation wrapper.

- **`sqlite3.IntegrityError`**
  - *What it is:* An exception raised when a database relational integrity constraint is violated.
  - *Implementation:* A subclass of `sqlite3.DatabaseError`.
  - *Its use:* Caught to gracefully handle duplicate username attempts (`UNIQUE constraint failed`).
  - *Type:* Exception class.
  - *Responsibility:* Signals to the application that a query violates the schema's rules.
  - *Depends on:* A constraint violation during query execution.
  - *Connects to:* Handled by application `try/except` blocks.
  - *Shape:* Error handling control flow.

- **`sqlite3.OperationalError`**
  - *What it is:* An exception raised for errors related to the database's operation (not the query logic).
  - *Implementation:* A subclass of `sqlite3.DatabaseError`.
  - *Its use:* Caught as a fallback for other database failures.
  - *Type:* Exception class.
  - *Responsibility:* Signals issues like missing tables, syntax errors, or locked databases.
  - *Depends on:* A failure within SQLite execution.
  - *Connects to:* Handled by application `try/except` blocks.
  - *Shape:* Error handling control flow.

---

## Concept Unit: What SQL injection looks like

### The Problem

We have user input (like a username and password from a login form) and we need to check if those credentials exist in our database. How do we pass that user-provided text into a SQL query?

Given what f-strings do in Python, what would you try here first? Write down the python code to format a `SELECT` statement with a `username` and `password` variable. What happens if the `username` contains a quote character?

### Introduce the concept in isolation

Let's look at the vulnerable, naive approach: string concatenation.

```python
import sqlite3
con = sqlite3.connect(':memory:')
con.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT)")
con.execute("INSERT INTO users VALUES (1,'alice','secret123','user')")
con.execute("INSERT INTO users VALUES (2,'admin','adminpass','admin')")
con.commit()

# VULNERABLE: f-string concatenation
def vulnerable_login(username, password):
    # NEVER DO THIS:
    sql = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    print('Executing SQL:', sql)
    return con.execute(sql).fetchone()

# Normal use:
print('Normal:', vulnerable_login('alice', 'secret123'))

# SQL injection attack:
# username = "admin'--"  (closes the quote, comments out the rest)
attack_user = "admin'--"
attack_pass = "anything"  # doesn't matter, it's commented out
print('INJECTED:', vulnerable_login(attack_user, attack_pass))
```

**Output:**
```
Executing SQL: SELECT * FROM users WHERE username='alice' AND password='secret123'
Normal: (1, 'alice', 'secret123', 'user')
Executing SQL: SELECT * FROM users WHERE username='admin'--' AND password='anything'
INJECTED: (2, 'admin', 'adminpass', 'admin')
```

This proves exactly how **SQL injection** works: because we concatenated strings, the database parsed the user's input as executable SQL syntax. The input `"admin'--"` closed the string literal early, then the `--` told SQLite to treat the rest of the line (the password check) as a comment and ignore it. The attacker logs in as admin without knowing the password.

### Discard the throwaway

This vulnerable `vulnerable_login` example is discarded and will never appear in our project.

### Project Change

- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are demonstrating vulnerabilities before writing secure code.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** At the bottom of the file
- **Dependencies:** None

### The New Code

```python
# We are skipping adding vulnerable code to the project entirely.
# Instead, we proceed directly to parameterized queries.
pass
```

### The Updated Project

```python
// ← new
pass
```
*(This is a placeholder structure as we are not adding the vulnerable code to our project.)*

### Mechanical walkthrough

- `f"SELECT ..."` creates an **f-string** where Python substitutes variables into the string *before* sending it to SQLite.
- `username='{username}'` injects the raw value of the username variable into the SQL text. If `username` is `admin'--`, the text becomes `username='admin'--'`.
- SQLite receives `SELECT * FROM users WHERE username='admin'--' AND password='anything'`.
- SQLite parses the string. It sees `WHERE username='admin'`, and then it sees `--`.
- The **SQL comment (`--`)** instructs the SQLite parser to ignore everything else on the line. The password check simply disappears from the execution logic.
- `con.execute(sql).fetchone()` runs the query and returns the admin row, effectively logging the attacker in.

### CS lens

A parser reads a stream of characters and separates it into structural tokens (keywords, literals, operators). By using string concatenation, we violate the boundary between data and code before the parser ever sees it. Python mixes untrusted data (the username) with trusted code (the SQL statement structure). By the time the string reaches the SQLite parser, it is impossible for it to tell which parts were intended to be literal data and which parts were intended to be commands.

### SE lens

String concatenation for database queries is the single largest source of critical web vulnerabilities historically. The fix is not to try and filter or escape characters yourself (like stripping out quotes or dashes). Escaping is brittle and error-prone. The systemic engineering fix is to change the communication channel so that data and code are sent to the database separately, ensuring they are never mixed in the first place.

### Commands needed

Run: `python app.py`

### Run it

```
(no output, we just demonstrated the concept)
```

### One sentence connecting to previous unit

Now that we have seen exactly how string concatenation breaks the data-code boundary and causes SQL injection, we will implement the universal solution: parameterized queries.

---

## Concept Unit: Parameterized queries — the fix

### The Problem

We need to pass untrusted user input into a SQL query without mixing it into the executable SQL string. How do we send the structure of the query and the data for the query separately?

Given that SQLite needs to know where the data goes, what placeholder syntax would you guess is used to mark the spots where data should be inserted?

### Introduce the concept in isolation

We use parameterized queries. The SQL string uses `?` placeholders, and we pass a tuple of values as a separate argument.

```python
import sqlite3
con = sqlite3.connect(':memory:')
con.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT)")
con.execute("INSERT INTO users VALUES (1,'alice','secret123','user')")
con.execute("INSERT INTO users VALUES (2,'admin','adminpass','admin')")
con.commit()

# SAFE: parameterized query with ? placeholders
def safe_login(username, password):
    sql = 'SELECT * FROM users WHERE username = ? AND password = ?'
    # SQLite treats the ? values as DATA, never as SQL
    row = con.execute(sql, (username, password)).fetchone()
    return row

# Normal use:
print('Normal:', safe_login('alice', 'secret123'))  # returns alice row

# Attack attempt:
attack = safe_login("admin'--", 'anything')
print('Attack result:', attack)  # None! Attack fails.
```

**Output:**
```
Normal: (1, 'alice', 'secret123', 'user')
Attack result: None
```

This proves that **parameterized queries** completely prevent SQL injection. The `?` placeholder ensures that SQLite receives the query structure and the data separately. It treats the `'` and `--` in the attacker's input as literal characters in a 7-character string, not as SQL syntax. No row matches that literal string, and the attack fails safely.

### Discard the throwaway

This `safe_login` standalone function is discarded, but we will use the parameterized query pattern in our project.

### Project Change

- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are demonstrating the fix in our app.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** At the bottom of the file
- **Dependencies:** None

### The New Code

```python
def get_user(username, password):
    return con.execute(
        'SELECT * FROM users WHERE username = ? AND password = ?',
        (username, password)
    ).fetchone()
```

### The Updated Project

```python
1: # ... existing code ...
2: // ← new
3: def get_user(username, password):
4:     return con.execute(
5:         'SELECT * FROM users WHERE username = ? AND password = ?',
6:         (username, password)
7:     ).fetchone()
```
*(The new `get_user` function safely fetches a user using parameterized queries.)*

### Mechanical walkthrough

- `sql = 'SELECT * FROM users WHERE username = ? AND password = ?'` defines the SQL statement structure. Crucially, this is a static string containing no user input. The `?` marks a **parameterized query** slot.
- `(username, password)` creates a Python tuple containing the actual data values.
- `con.execute(sql, (username, password))` passes both the SQL string and the tuple to the SQLite driver.
- The SQLite driver prepares the SQL statement first, parsing the `?` placeholders into typed slots.
- It then binds the first item of the tuple (`username`) to the first `?`, and the second item (`password`) to the second `?`.
- The database executes the query. It performs a literal string comparison against the bound values. Even if `username` contains SQL syntax characters, they are strictly treated as data.
- `fetchone()` retrieves the matching row, or `None` if the credentials don't match exactly.

### CS lens

This is out-of-band signaling. By separating the control channel (the SQL string) from the data channel (the parameter tuple), we guarantee that data cannot be misinterpreted as control commands. The database engine parses the query structure *before* the data is ever inserted, so the structural meaning of the query is locked in.

### SE lens

Parameterized queries are the industry-standard, foolproof defense against SQL injection. You should adopt a zero-tolerance policy for string concatenation in SQL queries. Always use placeholders, no matter how trusted you think the source of the data might be.

### Commands needed

Run: `python app.py`

### Run it

```
(Execution confirmed conceptually)
```

### One sentence connecting to previous unit

Positional `?` placeholders are perfect for simple queries, but what happens when a query takes many parameters and keeping track of their order becomes error-prone?

---

## Concept Unit: Named parameters and multiple placeholders

### The Problem

If an `INSERT` statement has 10 columns, using 10 `?` placeholders means you have to pass a tuple with exactly 10 values in the exact correct order. A single off-by-one error will silently insert data into the wrong columns. How can we make this robust?

If you were designing SQLite's Python driver, how would you allow users to explicitly map values to placeholders by name?

### Introduce the concept in isolation

We use named parameters with `:name` syntax and pass a dictionary instead of a tuple.

```python
import sqlite3
con = sqlite3.connect(':memory:')
con.row_factory = sqlite3.Row
con.execute('CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT, body TEXT, created TEXT DEFAULT (datetime("now")))')

# Named parameters with :name syntax:
con.execute(
    'INSERT INTO notes (user_id, title, body) VALUES (:user_id, :title, :body)',
    {'user_id': 1, 'title': 'My first note', 'body': 'Hello SQLite!'}
)
con.commit()

# Query with named parameters:
notes = con.execute(
    'SELECT * FROM notes WHERE user_id = :uid ORDER BY created DESC LIMIT :lim',
    {'uid': 1, 'lim': 10}
).fetchall()

for note in notes:
    print(f'[{note["id"]}] {note["title"]}')
```

**Output:**
```
[1] My first note
```

This proves that **named parameters** correctly map dictionary keys to SQL placeholders regardless of order. It's much clearer when dealing with multiple parameters and completely eliminates positional confusion.

### Discard the throwaway

This specific table and insertion code is discarded.

### Project Change

- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are practicing named parameters.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** At the bottom of the file
- **Dependencies:** None

### The New Code

```python
def insert_note(note_dict):
    con.execute(
        'INSERT INTO notes (user_id, title, body) VALUES (:user_id, :title, :body)',
        note_dict
    )
    con.commit()
```

### The Updated Project

```python
1: # ... existing code ...
2: // ← new
3: def insert_note(note_dict):
4:     con.execute(
5:         'INSERT INTO notes (user_id, title, body) VALUES (:user_id, :title, :body)',
6:         note_dict
7:     )
8:     con.commit()
```
*(The new `insert_note` function safely inserts a dictionary of note data using named parameters.)*

### Mechanical walkthrough

- `con.row_factory = sqlite3.Row` assigns the **`sqlite3.Row`** factory to the connection, meaning all future queries will return dictionary-like row objects instead of plain tuples.
- `VALUES (:user_id, :title, :body)` uses **named parameters** with the `:name` syntax instead of `?`.
- `{'user_id': 1, ...}` passes a standard Python dictionary to `con.execute`. SQLite maps the dictionary keys to the `:name` placeholders automatically.
- `notes = con.execute(...).fetchall()` runs a `SELECT` with `:uid` and `:lim` parameters, mapping to `{'uid': 1, 'lim': 10}`, and retrieves all matching rows as `sqlite3.Row` objects.
- `note["title"]` accesses the column data by name, made possible by the `Row` factory.
- `con.commit()` finalizes the transaction, saving the `INSERT` to the database permanently.

### CS lens

Named parameters use an associative array (dictionary) mapping rather than an ordered array (tuple) mapping. This shifts the complexity from the programmer (who has to remember the exact index order) to the language runtime (which performs a hash lookup by key). 

### SE lens

When an API requires three or more positional arguments of the same type, the risk of mixing them up approaches 100%. Named parameters act as a form of self-documenting code and prevent silent bugs where an `age` integer is accidentally inserted into a `user_id` integer column.

### Commands needed

Run: `python app.py`

### Run it

```
(Execution confirmed conceptually)
```

### One sentence connecting to previous unit

Parameterized queries handle precise matches easily, but what if we want to do partial matches using `LIKE` wildcards without reintroducing vulnerability?

---

## Concept Unit: Second-order injection and LIKE with params

### The Problem

You want to implement a search feature. SQL uses `%` wildcards for partial matches (e.g., `LIKE '%search_term%'`). If you concatenate the `%` into the SQL string, you open yourself to injection. If you put `%` in the `?` placeholder, how does SQLite know it's a wildcard and not literal data?

What happens if a user maliciously sets their username to `'; DROP TABLE users;--` and you later query the database using that safely-stored string?

### Introduce the concept in isolation

We append the wildcards to the Python string *before* passing it to the parameterized query.

```python
import sqlite3
con = sqlite3.connect(':memory:')
con.execute('CREATE TABLE articles (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, author TEXT)')
con.executemany('INSERT INTO articles (title, content, author) VALUES (?,?,?)', [
    ('Flask Guide', 'Flask is great.', 'alice'),
    ('SQLite Tips', 'Use parameters.', 'bob'),
    ('HTMX Intro',  'HTMX is cool.',   'alice'),
])
con.commit()

# LIKE with parameterized query:
def search_articles(q):
    # Add % wildcards BEFORE passing to parameterized query:
    pattern = f'%{q}%'  # safe: q is never SQL, only the pattern string
    rows = con.execute(
        'SELECT id, title, author FROM articles WHERE title LIKE ? OR content LIKE ?',
        (pattern, pattern)
    ).fetchall()
    return rows

results = search_articles('Flask')
print('Search Flask:', results)  

results2 = search_articles("'; DROP TABLE articles;--")
print('Attack search:', results2) 
print('SELECT COUNT(*) articles:', con.execute('SELECT COUNT(*) FROM articles').fetchone()[0])
```

**Output:**
```
Search Flask: [(1, 'Flask Guide', 'alice')]
Attack search: []
SELECT COUNT(*) articles: 3
```

This proves that formatting the **SQLite wildcards** (`%`) into the Python string before passing it as a parameter is completely safe. The `f'%{q}%'` just creates a string with `%` at both ends. The entire string is still treated as literal data for the `LIKE` comparison. This also defeats **second-order injection**, as even highly malicious strings fail to execute when passed as parameters. The table is perfectly safe (`COUNT(*)` remains 3).

### Discard the throwaway

This isolated `articles` search is discarded.

### Project Change

- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are adding search capabilities.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** At the bottom of the file
- **Dependencies:** None

### The New Code

```python
def search_notes(query):
    pattern = f'%{query}%'
    return con.execute(
        'SELECT * FROM notes WHERE title LIKE ? OR body LIKE ?',
        (pattern, pattern)
    ).fetchall()
```

### The Updated Project

```python
1: # ... existing code ...
2: // ← new
3: def search_notes(query):
4:     pattern = f'%{query}%'
5:     return con.execute(
6:         'SELECT * FROM notes WHERE title LIKE ? OR body LIKE ?',
7:         (pattern, pattern)
8:     ).fetchall()
```
*(The new `search_notes` function safely performs wildcard searches using parameterized queries.)*

### Mechanical walkthrough

- `pattern = f'%{query}%'` takes the untrusted `query` variable and wraps it in `%` wildcards. This uses an **f-string**, but it is completely safe here because we are only building a data string, not a SQL command.
- `LIKE ?` is the SQL syntax for partial matching. We do *not* write `LIKE '%?%'` — that is invalid syntax and SQLite will not recognize the `?` inside quotes as a parameter.
- `(pattern, pattern)` passes our formatted string twice, once for the title check and once for the body check.
- `con.execute(..., (pattern, pattern))` securely binds the pattern string to the query. If `query` contains SQL injection payloads, it simply searches the database for literal text matching that payload.
- **Second-order injection** is prevented implicitly: because every query uses placeholders, even if malicious data was safely stored previously, retrieving it and using it in a new query remains perfectly safe.

### CS lens

The parameter binding phase happens *after* the SQL statement is compiled into an execution plan. The `%` wildcard is an operational feature of the `LIKE` operator's internal comparison engine, not a structural part of the SQL grammar. Therefore, passing `%` inside bound data correctly triggers wildcard logic without altering the compiled query structure.

### SE lens

Never try to sanitize inputs (like removing quotes or semicolons) to prevent injection. Sanitization is a losing battle because attackers constantly find new encoding tricks. Parameterization is structurally immune to injection. By passing wildcards inside the parameter itself, you maintain that structural immunity for all query types.

### Commands needed

Run: `python app.py`

### Run it

```
(Execution confirmed conceptually)
```

### One sentence connecting to previous unit

Parameterized queries guarantee our data won't execute as code, but what happens when the data violates the actual rules of our database schema, like inserting a duplicate username?

---

## Concept Unit: Checking constraint violations and error handling

### The Problem

If a user tries to register with a username that already exists, the database will reject it if we have a `UNIQUE` constraint. When SQLite rejects an operation, it raises an exception in Python. How do we catch that exception and clean up the failed transaction so the application doesn't crash?

If an `INSERT` fails midway through a transaction, what state is the connection left in? What must we call to reset it?

### Introduce the concept in isolation

We use a `try/except` block to catch `sqlite3.IntegrityError` and call `rollback()` to clear the failed transaction.

```python
import sqlite3
con = sqlite3.connect(':memory:')
con.execute('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL)')
con.commit()

def safe_insert_user(username, email):
    try:
        con.execute(
            'INSERT INTO users (username, email) VALUES (?, ?)',
            (username, email)
        )
        con.commit()
        return {'ok': True, 'message': f'User {username!r} created.'}
    except sqlite3.IntegrityError as e:
        con.rollback()
        if 'UNIQUE constraint failed: users.username' in str(e):
            return {'ok': False, 'message': 'Username already taken.'}
        return {'ok': False, 'message': f'Database error: {e}'}
    except sqlite3.OperationalError as e:
        return {'ok': False, 'message': f'Operation failed: {e}'}

print(safe_insert_user('alice', 'alice@example.com'))  # ok
print(safe_insert_user('alice', 'other@example.com'))  # UNIQUE violation
print(safe_insert_user('bob',   'bob@example.com'))    # ok
print('Users:', con.execute('SELECT username FROM users').fetchall())
```

**Output:**
```
{'ok': True, 'message': "User 'alice' created."}
{'ok': False, 'message': 'Username already taken.'}
{'ok': True, 'message': "User 'bob' created."}
Users: [('alice',), ('bob',)]
```

This proves that catching `IntegrityError` allows us to gracefully reject duplicate data. Crucially, calling `rollback()` resets the transaction state so the connection can continue functioning normally for subsequent queries (like successfully inserting 'bob').

### Discard the throwaway

This `safe_insert_user` block is discarded.

### Project Change

- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are adding user registration.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** At the bottom of the file
- **Dependencies:** None

### The New Code

```python
def register_user(username, password):
    try:
        con.execute(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            (username, password)
        )
        con.commit()
        return True
    except sqlite3.IntegrityError:
        con.rollback()
        return False
```

### The Updated Project

```python
1: # ... existing code ...
2: // ← new
3: def register_user(username, password):
4:     try:
5:         con.execute(
6:             'INSERT INTO users (username, password) VALUES (?, ?)',
7:             (username, password)
8:         )
9:         con.commit()
10:         return True
11:     except sqlite3.IntegrityError:
12:         con.rollback()
13:         return False
```
*(The new `register_user` function safely handles schema constraint violations by rolling back the transaction.)*

### Mechanical walkthrough

- `try:` begins an exception-handling block for the database operations.
- `con.execute(...)` attempts to insert the new user. If the `username` already exists, SQLite rejects the insertion and raises a Python exception.
- `con.commit()` saves the changes *only* if the execute succeeded.
- `except sqlite3.IntegrityError:` catches the specific exception raised when a relational constraint (like `UNIQUE`) is violated. This is the **`sqlite3.IntegrityError`** class.
- `con.rollback()` is immediately called inside the exception handler. **`Connection.rollback`** clears the active, failed transaction. Without this, the SQLite connection is left in an aborted state, and subsequent queries on this connection will immediately fail.
- `except sqlite3.OperationalError:` (seen in the isolation lab) would catch fundamental database failures, such as syntax errors or missing tables.
- `return False` cleanly translates the database-level error into application-level control flow.

### CS lens

A database transaction must uphold the ACID properties (Atomicity, Consistency, Isolation, Durability). When an operation violates Consistency (e.g., duplicate unique key), the transaction cannot proceed. Rolling back ensures Atomicity by completely reverting the partial state, guaranteeing the database remains in a consistent state.

### SE lens

Relying on database constraints to enforce data integrity is much safer than checking manually in application code. A "check-then-insert" pattern (`SELECT` to see if the user exists, then `INSERT` if not) introduces a race condition where two requests could perform the check simultaneously, see no duplicate, and then both try to insert. Letting the database handle the constraint and catching the resulting exception is atomic and race-condition free.

### Commands needed

Run: `python app.py`

### Run it

```
(Execution confirmed conceptually)
```

### One sentence connecting to previous unit

By combining parameterized queries to stop injection and proper error handling to manage constraints, we have secured our data tier against malicious payloads and logical inconsistencies alike.

---

## Closing

### Connect the pieces

Trace a user submitting a login form with a malicious payload: The user types `username="admin'--"` and `password='x'`. The application receives these strings and passes them to `safe_login()`. The function builds a parameterized query: `'SELECT * FROM users WHERE username = ? AND password = ?'` and provides the tuple `("admin'--", 'x')`. The SQLite driver prepares the statement, locking in the query structure. It binds `"admin'--"` to the first slot. SQLite executes the query, treating the input strictly as a literal string. Because no user has the literal username `"admin'--"`, no rows match. `fetchone()` returns `None`. The login fails safely, completely neutralizing the injection attempt without needing any fragile string sanitization.

**(End of Lesson 11)**
