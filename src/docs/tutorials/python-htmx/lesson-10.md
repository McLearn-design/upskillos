# Lesson 10: SQLite3 — The sqlite3 Module, CREATE TABLE, CRUD, and Row Factories

**What you will build**
We will integrate a SQLite database into the app to persist data, allowing the app to scale and maintain state across restarts. The transferable problem here is managing persistent data in a serverless relational database environment.

**What you need to know first**
Lesson 9.

**Terms used in this lesson**
- **Relational Database** — A structured data storage system that organizes data into tables with predefined columns and rows, solving the problem of unstructured, hard-to-query data dumps.
- **SQLite** — A serverless, self-contained SQL database engine, solving the problem of needing a heavy database server process for small-to-medium applications.
- **SQL** — Structured Query Language, the standard syntax for querying and modifying relational databases, solving the problem of needing a unified way to describe data operations.
- **Cursor** — A control structure that enables traversal over the records in a database, solving the problem of managing state and iterating through result sets from queries.
- **Transaction** — A unit of work performed within a database management system against a database, solving the problem of partial updates leaving the database in an inconsistent state.
- **Parameterized Query** — A query where values are passed separately from the SQL string, solving the problem of SQL injection vulnerabilities and manual string escaping.
- **Context Manager** — A control structure (the `with` statement) that automatically handles resource setup and teardown, solving the problem of forgotten file or connection closures.
- **In-memory Database** — A database residing entirely in RAM (using `:memory:` in SQLite), solving the problem of needing a fast, temporary database for testing or throwaway tasks without writing to disk.

**Objects and methods used**
- **`sqlite3`**
  - *What it is:* The Python standard library module for SQLite.
  - *Implementation:* `import sqlite3`
  - *Its use:* To provide the DB-API 2.0 interface for SQLite operations.
  - *Type:* Module.
  - *Responsibility:* Wraps the underlying C library to provide database connectivity.
  - *Depends on:* Python's standard distribution.
  - *Connects to:* C-level SQLite engine.
  - *Shape:* A standard library boundary.
- **`sqlite3.connect`**
  - *What it is:* A function to open a connection to an SQLite database file.
  - *Implementation:* `sqlite3.connect(database)`
  - *Its use:* To connect to `app.db` or `:memory:`.
  - *Type:* Free function.
  - *Responsibility:* Opens a connection and returns a Connection object.
  - *Depends on:* A file path string or `:memory:`.
  - *Connects to:* Returns a `sqlite3.Connection`.
  - *Shape:* Boundary between the app and the database file.
- **`sqlite3.Connection.cursor`**
  - *What it is:* A method to create a cursor object.
  - *Implementation:* `con.cursor()`
  - *Its use:* To get a cursor to execute SQL statements.
  - *Type:* Instance method.
  - *Responsibility:* Creates a new cursor linked to the connection.
  - *Depends on:* An open `sqlite3.Connection`.
  - *Connects to:* Returns a `sqlite3.Cursor`.
  - *Shape:* Internal state management object creation.
- **`sqlite3.Cursor.execute`**
  - *What it is:* A method to execute a single SQL statement.
  - *Implementation:* `cur.execute(sql, parameters=())`
  - *Its use:* To run queries like `CREATE TABLE`, `INSERT`, `SELECT`.
  - *Type:* Instance method.
  - *Responsibility:* Prepares and executes the SQL statement against the database.
  - *Depends on:* A valid SQL string and optional tuple of parameters.
  - *Connects to:* Modifies database state or prepares a result set; returns the cursor itself.
  - *Shape:* Primary execution interface for SQL.
- **`sqlite3.Connection.commit`**
  - *What it is:* A method to commit any pending transaction to the database.
  - *Implementation:* `con.commit()`
  - *Its use:* To ensure `INSERT`, `UPDATE`, and `DELETE` changes are saved.
  - *Type:* Instance method.
  - *Responsibility:* Writes the changes from the current transaction to the disk.
  - *Depends on:* An open `sqlite3.Connection` with a pending transaction.
  - *Connects to:* The SQLite write-ahead log or main database file.
  - *Shape:* Persistence boundary.
- **`sqlite3.Connection.close`**
  - *What it is:* A method to close the database connection.
  - *Implementation:* `con.close()`
  - *Its use:* To release file locks and clean up resources when done.
  - *Type:* Instance method.
  - *Responsibility:* Safely shuts down the connection.
  - *Depends on:* An open `sqlite3.Connection`.
  - *Connects to:* The operating system's file handle management.
  - *Shape:* Teardown boundary.
- **`sqlite3.Cursor.fetchone`**
  - *What it is:* A method to fetch the next row of a query result set.
  - *Implementation:* `cur.fetchone()`
  - *Its use:* To retrieve a single expected row or aggregate result.
  - *Type:* Instance method.
  - *Responsibility:* Returns a single sequence (or row object), or `None` if no more rows are available.
  - *Depends on:* A cursor that has just executed a `SELECT` statement.
  - *Connects to:* The underlying SQLite result set buffer.
  - *Shape:* Data retrieval boundary.
- **`sqlite3.Cursor.fetchall`**
  - *What it is:* A method to fetch all remaining rows of a query result.
  - *Implementation:* `cur.fetchall()`
  - *Its use:* To retrieve all matching records at once into a list.
  - *Type:* Instance method.
  - *Responsibility:* Returns a list of all remaining tuples (or row objects) from the query.
  - *Depends on:* A cursor that has just executed a `SELECT` statement.
  - *Connects to:* Memory allocation for the full result set.
  - *Shape:* Data retrieval boundary.
- **`sqlite3.Row`**
  - *What it is:* A highly optimized row factory for SQLite.
  - *Implementation:* `con.row_factory = sqlite3.Row`
  - *Its use:* To allow accessing columns by name instead of just by integer index.
  - *Type:* Class.
  - *Responsibility:* Wraps a tuple result to provide dictionary-like, case-insensitive column access.
  - *Depends on:* Assignment to `Connection.row_factory` or `Cursor.row_factory`.
  - *Connects to:* Replaces the default tuple factory for subsequent fetch calls.
  - *Shape:* Data transformation boundary.
- **`sqlite3.Connection.executemany`**
  - *What it is:* A method to execute an SQL command against all parameter sequences or mappings in a given sequence.
  - *Implementation:* `con.executemany(sql, parameters)`
  - *Its use:* To efficiently bulk-insert multiple records using one query.
  - *Type:* Instance method.
  - *Responsibility:* Reuses the compiled SQL statement and loops over the parameters, inserting them quickly.
  - *Depends on:* An SQL string with placeholders and an iterable of parameter tuples.
  - *Connects to:* The database engine's prepared statement cache.
  - *Shape:* Performance boundary for bulk operations.

## Concept Unit: Connecting and creating a table
### The Problem
How do we create a database file and set up its structure? What would you try first to store user information securely on disk without a heavy server? If you just write to a text file, how do you query it later? We need a relational table.

### Introduce the concept in isolation
We can use the `sqlite3` module to connect to an in-memory database and run a `CREATE TABLE` query.

```python
import sqlite3

con_mem = sqlite3.connect(':memory:')
print('Database version:', sqlite3.sqlite_version)
cur = con_mem.cursor()
cur.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT    NOT NULL UNIQUE,
        email    TEXT    NOT NULL,
        created  TEXT    DEFAULT (datetime('now'))
    )
''')
con_mem.commit()
print('Table created. Rows:', cur.execute('SELECT COUNT(*) FROM users').fetchone()[0])
con_mem.close()
```
Output proves: We successfully connected, created a `users` table, and verified it has 0 rows, all in memory.

### Discard the throwaway
This in-memory script is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we need to initialize the project's persistence layer.
- **Files affected:** `app.py` (modified).
- **Change type:** Add.
- **Location:** At the top of the file, setting up the initial database table.
- **Dependencies:** The `sqlite3` built-in module.

### The New Code
```python
import sqlite3

con = sqlite3.connect('app.db')
cur = con.cursor()
cur.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT    NOT NULL UNIQUE,
        email    TEXT    NOT NULL,
        created  TEXT    DEFAULT (datetime('now'))
    )
''')
con.commit()
con.close()
```

### The Updated Project
```python
# ← new
1: import sqlite3
2: 
3: con = sqlite3.connect('app.db')
4: cur = con.cursor()
5: cur.execute('''
6:     CREATE TABLE IF NOT EXISTS users (
7:         id       INTEGER PRIMARY KEY AUTOINCREMENT,
8:         username TEXT    NOT NULL UNIQUE,
9:         email    TEXT    NOT NULL,
10:        created  TEXT    DEFAULT (datetime('now'))
11:    )
12: ''')
13: con.commit()
14: con.close()
# ← new

# Existing code follows...
```
This sets up our `app.db` file with a `users` table the first time the script is evaluated.

### Mechanical walkthrough
1. `import sqlite3` loads the standard library module.
2. `sqlite3.connect('app.db')` opens the file, creating it if it doesn't exist, and returns a connection.
3. `con.cursor()` creates a cursor object to send SQL statements.
4. `cur.execute(...)` sends the SQL text to the SQLite engine.
5. `CREATE TABLE IF NOT EXISTS users` ensures we don't error out if the table is already there.
6. `id INTEGER PRIMARY KEY AUTOINCREMENT` makes a unique, auto-incrementing ID for each row.
7. `username TEXT NOT NULL UNIQUE` ensures usernames are text, cannot be missing, and must be unique.
8. `email TEXT NOT NULL` ensures emails are required text.
9. `created TEXT DEFAULT (datetime('now'))` automatically sets the creation time.
10. `con.commit()` writes the transaction (the schema change) to disk.
11. `con.close()` closes the connection safely.

### CS lens
A relational database uses a schema to enforce data integrity at the storage level. The `CREATE TABLE` statement is Data Definition Language (DDL). By defining `UNIQUE` and `NOT NULL` constraints, we push the responsibility of data validation down to the database engine, ensuring that no application bug can ever insert a duplicate or missing username.

### SE lens
Using `IF NOT EXISTS` is a primitive form of a database migration. It allows the application to boot up and initialize its own state if it is running on a fresh machine, making deployments easier since the app can bootstrap its own dependencies.

### Commands needed
Run: `python app.py`

### Run it
Running this will silently create `app.db` in your directory.

### One sentence connecting to previous unit
Now that we have a table to store users, we need to know how to insert and retrieve them.

## Concept Unit: INSERT, SELECT, UPDATE, DELETE
### The Problem
How do we actually put data into the table and read it back? If we use string concatenation to build our SQL queries, how do we prevent malicious input from breaking the query?

### Introduce the concept in isolation
We use parameterized queries `?` with `execute()` to safely insert, retrieve, update, and delete rows.

```python
import sqlite3
con = sqlite3.connect(':memory:')
con.execute('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, email TEXT NOT NULL)')
con.commit()

# INSERT
con.execute('INSERT INTO users (username, email) VALUES (?, ?)', ('alice', 'alice@example.com'))
con.execute('INSERT INTO users (username, email) VALUES (?, ?)', ('bob',   'bob@example.com'))
con.commit()

# SELECT
rows = con.execute('SELECT id, username, email FROM users').fetchall()
print('All users:', rows)

# SELECT with WHERE
row = con.execute('SELECT * FROM users WHERE username = ?', ('alice',)).fetchone()
print('Alice:', row)

# UPDATE
con.execute('UPDATE users SET email = ? WHERE id = ?', ('newalice@example.com', 1))
con.commit()

# DELETE
con.execute('DELETE FROM users WHERE id = ?', (2,))
con.commit()
print('After delete:', con.execute('SELECT COUNT(*) FROM users').fetchone()[0])
con.close()
```
Output proves: We successfully inserted Alice and Bob, retrieved them, updated Alice's email, deleted Bob, and verified 1 row remained.

### Discard the throwaway
This in-memory script is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified).
- **Change type:** Add.
- **Location:** Below the table creation.
- **Dependencies:** The existing `sqlite3` connection.

### The New Code
```python
def create_user(username, email):
    con = sqlite3.connect('app.db')
    con.execute('INSERT INTO users (username, email) VALUES (?, ?)', (username, email))
    con.commit()
    con.close()

def get_all_users():
    con = sqlite3.connect('app.db')
    rows = con.execute('SELECT id, username, email FROM users').fetchall()
    con.close()
    return rows
```

### The Updated Project
```python
import sqlite3

con = sqlite3.connect('app.db')
cur = con.cursor()
cur.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT    NOT NULL UNIQUE,
        email    TEXT    NOT NULL,
        created  TEXT    DEFAULT (datetime('now'))
    )
''')
con.commit()
con.close()

# ← new
18: def create_user(username, email):
19:     con = sqlite3.connect('app.db')
20:     con.execute('INSERT INTO users (username, email) VALUES (?, ?)', (username, email))
21:     con.commit()
22:     con.close()
23: 
24: def get_all_users():
25:     con = sqlite3.connect('app.db')
26:     rows = con.execute('SELECT id, username, email FROM users').fetchall()
27:     con.close()
28:     return rows
# ← new
```
These functions open short-lived connections to manipulate and read the database.

### Mechanical walkthrough
1. `def create_user(username, email):` defines our insertion function.
2. `sqlite3.connect('app.db')` opens a new connection to the file.
3. `con.execute('INSERT INTO users...', (username, email))` executes an `INSERT` command. The `?` are parameter placeholders, and the tuple provides the values. SQLite safely escapes them.
4. `con.commit()` saves the new row.
5. `def get_all_users():` defines our retrieval function.
6. `con.execute('SELECT ...').fetchall()` executes a `SELECT` command and returns all rows as a list of tuples.
7. `con.close()` closes the connection.

### CS lens
Parameterized queries prevent SQL injection, which occurs when user input is concatenated directly into an SQL string, allowing an attacker to execute arbitrary commands. By passing parameters separately, the database driver ensures they are strictly treated as literal values, never as executable code.

### SE lens
Opening and closing a connection for every single operation is robust against concurrency issues in simple apps, but adds overhead. Later, we might use a connection pool or a request-bound context manager to manage resources more efficiently.

### Commands needed
Run: `python app.py`

### Run it
The functions are defined and ready to be called by our application routes.

### One sentence connecting to previous unit
Returning lists of tuples is functional, but accessing data by index `row[1]` is brittle; we need a better way.

## Concept Unit: Row factory — accessing columns by name
### The Problem
When we fetch rows, they come back as tuples like `(1, 'alice', 'alice@example.com')`. If we add a new column or change the `SELECT` order, `row[1]` might stop being the username. How do we access columns by name to make our code robust?

### Introduce the concept in isolation
We can change the connection's `row_factory` to `sqlite3.Row`, which wraps the results in a dictionary-like object.

```python
import sqlite3
con = sqlite3.connect(':memory:')
con.execute('CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL)')
con.executemany('INSERT INTO products VALUES (?,?,?)', [(1,'Apple',0.99),(2,'Banana',0.49),(3,'Cherry',2.99)])
con.commit()

# Without row_factory: rows are tuples
row_tuple = con.execute('SELECT * FROM products WHERE id=1').fetchone()
print('Tuple:', row_tuple)
print('Name:', row_tuple[1])

# With sqlite3.Row factory: rows behave like dicts
con.row_factory = sqlite3.Row
row = con.execute('SELECT * FROM products WHERE id=1').fetchone()
print('Row name:', row['name'])
print('Keys:', row.keys())

# Convert to dict
d = dict(row)
print('Dict:', d)
con.close()
```
Output proves: By setting the `row_factory`, we can access the columns by their string names `row['name']` and convert the row to a standard dictionary.

### Discard the throwaway
This in-memory script is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified).
- **Change type:** Refactor.
- **Location:** Inside `get_all_users`.
- **Dependencies:** The `sqlite3.Row` object.

### The New Code
```python
def get_all_users():
    con = sqlite3.connect('app.db')
    con.row_factory = sqlite3.Row
    rows = con.execute('SELECT id, username, email FROM users').fetchall()
    con.close()
    return [dict(row) for row in rows]
```

### The Updated Project
```python
# ← new
24: def get_all_users():
25:     con = sqlite3.connect('app.db')
26:     con.row_factory = sqlite3.Row
27:     rows = con.execute('SELECT id, username, email FROM users').fetchall()
28:     con.close()
29:     return [dict(row) for row in rows]
# ← new
```
Our fetch function now returns a list of dictionaries, meaning templates can access `user['username']`.

### Mechanical walkthrough
1. `con.row_factory = sqlite3.Row` changes the behavior of `fetchall()` and `fetchone()` on this connection to return `Row` objects instead of plain tuples.
2. `rows = con.execute(...)` retrieves the data.
3. `return [dict(row) for row in rows]` iterates through the `Row` objects and converts each one to a standard Python dictionary using `dict()`.

### CS lens
A factory is an object or function whose sole responsibility is to create other objects. Here, the `row_factory` allows the SQLite driver to defer the instantiation of result objects to a pluggable component, decoupling the C-level fetching from the Python-level object representation.

### SE lens
Returning a standard Python dictionary rather than a framework-specific `Row` object from our database access layer creates a clear boundary. Our web templates and business logic don't need to know we're using SQLite; they just interact with standard dictionaries.

### Commands needed
Run: `python app.py`

### Run it
The function now safely returns dictionaries that are immune to column reordering.

### One sentence connecting to previous unit
We are managing the open and close cycle manually, but Python has a better built-in way to handle resources.

## Concept Unit: executemany and context manager
### The Problem
Manually calling `con.commit()` and `con.close()` is error-prone; if an exception happens between them, the connection might leak or stay locked. Also, if we want to insert many rows, looping `execute()` is slow. How do we bulk insert safely?

### Introduce the concept in isolation
We can use a `with` statement (a context manager) to auto-commit or auto-rollback, and `executemany()` to insert multiple rows efficiently.

```python
import sqlite3

with sqlite3.connect('app.db') as con:
    con.row_factory = sqlite3.Row
    con.execute('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, body TEXT)')
    
    notes = [
        ('Python basics',    'Variables, functions, classes.'),
        ('Flask routing',    '@app.route decorator.'),
        ('SQLite queries',   'SELECT, INSERT, UPDATE, DELETE.'),
    ]
    con.executemany('INSERT INTO notes (title, body) VALUES (?,?)', notes)
print('Notes inserted, transaction committed automatically.')
```
Output proves: The context manager automatically commits the transaction upon successful exit, and `executemany` inserted all three tuples using one statement.

### Discard the throwaway
This script is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified).
- **Change type:** Refactor.
- **Location:** In our database connection usage.
- **Dependencies:** The Python `with` statement.

### The New Code
```python
def create_users_bulk(user_tuples):
    with sqlite3.connect('app.db') as con:
        con.executemany('INSERT INTO users (username, email) VALUES (?, ?)', user_tuples)
```

### The Updated Project
```python
# ← new
18: def create_user(username, email):
19:     with sqlite3.connect('app.db') as con:
20:         con.execute('INSERT INTO users (username, email) VALUES (?, ?)', (username, email))
21: 
22: def create_users_bulk(user_tuples):
23:     with sqlite3.connect('app.db') as con:
24:         con.executemany('INSERT INTO users (username, email) VALUES (?, ?)', user_tuples)
# ← new
```
We replaced manual commits and closes with the `with` statement for safety and added a bulk operation.

### Mechanical walkthrough
1. `with sqlite3.connect('app.db') as con:` opens the connection and starts a context manager.
2. `con.execute(...)` runs the insert.
3. If no exception occurs, the context manager automatically calls `con.commit()` upon exiting the `with` block.
4. If an exception occurs, it automatically calls `con.rollback()`.
5. `con.executemany(..., user_tuples)` prepares the SQL statement exactly once, then executes it repeatedly for every tuple in the `user_tuples` list, which is highly efficient.

### CS lens
The context manager pattern (`__enter__` and `__exit__` magic methods) ensures resource cleanup regardless of execution flow (normal or exception). This is deterministic finalization, a key advantage of Python's resource management over relying entirely on a garbage collector.

### SE lens
Using `executemany` prevents the overhead of parsing and compiling the SQL string repeatedly. In databases, the network or parsing overhead often dwarfs the actual insertion time, so batching operations is a primary performance optimization.

### Commands needed
Run: `python app.py`

### Run it
The functions are refactored to be safe and performant.

### One sentence connecting to previous unit
Now that we have data, we might need to search it or analyze it in aggregate.

## Concept Unit: Aggregate queries and LIKE search
### The Problem
If we have thousands of users and want to find ones matching a specific domain, fetching all of them into Python to filter them is incredibly slow and wastes memory. How do we ask the database to do the filtering and math for us?

### Introduce the concept in isolation
We use SQL `GROUP BY` to aggregate data and `LIKE` to perform pattern matching on text.

```python
import sqlite3

with sqlite3.connect(':memory:') as con:
    con.row_factory = sqlite3.Row
    con.execute('CREATE TABLE sales (id INTEGER PRIMARY KEY, product TEXT, amount REAL, region TEXT)')
    con.executemany('INSERT INTO sales VALUES (?,?,?,?)', [
        (1,'Widget',  120.0,'North'),(2,'Gadget',  80.0,'South'),
        (3,'Widget',   95.0,'South'),(4,'Gadget', 200.0,'North'),
        (5,'Widget',  150.0,'East'), (6,'Gadget',  60.0,'East'),
    ])
    
    totals = con.execute('SELECT product, SUM(amount) as total, COUNT(*) as count FROM sales GROUP BY product').fetchall()
    for row in totals:
        print(f'{row["product"]}: total={row["total"]}, count={row["count"]}')
        
    results = con.execute('SELECT * FROM sales WHERE product LIKE ?', ('Wid%',)).fetchall()
    print('Widget sales:', [dict(r) for r in results])
```
Output proves: `GROUP BY` successfully calculated the `SUM` and `COUNT` for each product. `LIKE 'Wid%'` successfully matched rows starting with "Wid".

### Discard the throwaway
This in-memory script is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified).
- **Change type:** Add.
- **Location:** Below our other database functions.
- **Dependencies:** The existing `sqlite3` connection setup.

### The New Code
```python
def search_users(username_prefix):
    with sqlite3.connect('app.db') as con:
        con.row_factory = sqlite3.Row
        rows = con.execute('SELECT * FROM users WHERE username LIKE ?', (f'{username_prefix}%',)).fetchall()
        return [dict(r) for r in rows]

def get_user_count():
    with sqlite3.connect('app.db') as con:
        return con.execute('SELECT COUNT(*) FROM users').fetchone()[0]
```

### The Updated Project
```python
# ← new
26: def search_users(username_prefix):
27:     with sqlite3.connect('app.db') as con:
28:         con.row_factory = sqlite3.Row
29:         rows = con.execute('SELECT * FROM users WHERE username LIKE ?', (f'{username_prefix}%',)).fetchall()
30:         return [dict(r) for r in rows]
31: 
32: def get_user_count():
33:     with sqlite3.connect('app.db') as con:
34:         return con.execute('SELECT COUNT(*) FROM users').fetchone()[0]
# ← new
```
We now have functions to perform searches and basic counts directly at the database level.

### Mechanical walkthrough
1. `def search_users(username_prefix):` accepts a partial string.
2. `f'{username_prefix}%'` creates a pattern. The `%` wildcard character in SQL means "match zero or more of any character".
3. `WHERE username LIKE ?` performs case-insensitive pattern matching using the parameter.
4. `def get_user_count():` retrieves a single aggregate value.
5. `SELECT COUNT(*)` calculates the total number of rows.
6. `.fetchone()[0]` takes the first (and only) row tuple, and extracts the first element (the integer count itself).

### CS lens
Relational databases are heavily optimized for set-based math and filtering. Pushing computation (like `COUNT` or `LIKE`) to the database layer utilizes specialized data structures like B-trees, minimizing the amount of data transferred over the connection to the application layer.

### SE lens
Using `COUNT(*)` prevents the classic mistake of `len(get_all_users())`, which would fetch every single row into memory just to count them. Efficient systems always minimize network bandwidth and memory footprint by requesting exactly what they need.

### Commands needed
Run: `python app.py`

### Run it
The aggregate and search functions are ready for use.

### One sentence connecting to previous unit
These functions form the core of any backend API's data access layer.

## Closing
### Connect the pieces
Trace inserting a user (alice, alice@example.com) into SQLite: `con.execute(INSERT, ('alice','alice@example.com'))` -> parameterized -> row inserted with `id=1` -> `con.commit()` -> data persisted to `app.db` -> `SELECT` with `row_factory` returns a dict `{'id':1,'name':'alice'}` -> passed to Jinja2 template through all concept units. This is the entire foundation of dynamic web applications: securely storing user input on disk and querying it back flexibly.
