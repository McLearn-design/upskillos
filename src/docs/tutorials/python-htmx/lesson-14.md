# Lesson 14: Repository Pattern — Separating SQL from Routes

In this lesson, you will build a clean separation between your web routing layer and your database layer by implementing the Repository Pattern. You will start with SQL queries mixed directly into Flask routes, experience the pain of duplicating database connection logic, and progressively refactor the code into standalone functions and then class-based repositories. This separation makes your code testable, maintainable, and keeps your routes thin.

**What you need to know first:**
- Lesson 13 (SQLite Basics)

**Terms used in this lesson:**
- **Repository Pattern** — A design pattern that abstracts data access behind a clean interface, solving the problem of business logic and database queries getting tangled together.
- **Route Handler** — A function that receives an HTTP request and returns an HTTP response, existing to manage the web boundary rather than the data boundary.
- **Throwaway Code** — Code written specifically to isolate and teach a concept, which is discarded before integrating into the main project to ensure clean learning.
- **Pagination** — The process of dividing a large dataset into smaller, manageable chunks (pages) so that the application doesn't load thousands of records into memory at once.

**Objects and methods used:**
- **`sqlite3.connect()`**
  - *What it is:* A standard library function that establishes a connection to a SQLite database.
  - *Implementation:* `def connect(database: str | bytes | PathLike[str], ...) -> Connection`
  - *Its use:* Used to open a connection to the `:memory:` database or a file-based database for executing SQL.
  - *Type:* Free function in the `sqlite3` module.
  - *Responsibility:* Manages the initialization and lifecycle of a database connection object.
  - *Depends on:* A database string (e.g., `':memory:'` or a file path).
  - *Connects to:* Returns a `sqlite3.Connection` object; interacts with the SQLite C extension.
  - *Shape:* A boundary between the Python runtime and the underlying SQLite engine.
- **`sqlite3.Row`**
  - *What it is:* A row factory class that allows column access by name as well as by index.
  - *Implementation:* `class Row`
  - *Its use:* Assigned to `con.row_factory` so that query results act like dictionaries rather than plain tuples.
  - *Type:* Class in the `sqlite3` module.
  - *Responsibility:* Wraps a raw result tuple to provide dictionary-like access to column values.
  - *Depends on:* A database connection setting its `row_factory` attribute.
  - *Connects to:* Consumed by application code iterating over cursor results.
  - *Shape:* A data-transfer object mapping SQL result rows to Python objects.
- **`flask.g`**
  - *What it is:* A global namespace object provided by Flask for storing data during a single application context (request).
  - *Implementation:* A proxy to a request-bound application context dictionary.
  - *Its use:* Used to store the database connection so that it can be reused across multiple function calls within the same request.
  - *Type:* Thread-local proxy object.
  - *Responsibility:* Holds global state scoped safely to the current executing request.
  - *Depends on:* An active Flask application context.
  - *Connects to:* Read/written by repository functions and teardown handlers.
  - *Shape:* An internal state boundary within the web framework's request lifecycle.
- **`@app.teardown_appcontext`**
  - *What it is:* A Flask decorator that registers a function to run when the application context ends.
  - *Implementation:* `def teardown_appcontext(self, f: T_teardown) -> T_teardown`
  - *Its use:* Used to ensure the database connection stored in `g` is closed after the request completes, regardless of success or failure.
  - *Type:* Method decorator on the Flask app instance.
  - *Responsibility:* Guarantees execution of cleanup code at the end of a request boundary.
  - *Depends on:* The Flask app instance and a registered callback function.
  - *Connects to:* Calls the decorated function (e.g., `close_db`).
  - *Shape:* A framework callback boundary for resource management.

---

## Concept Unit: Why routes should not contain SQL

### The Problem
When building web applications, the most obvious way to fetch data is to write SQL directly inside the route that needs it. What happens when multiple routes need to access the same table, or when you want to test the route without touching a real database?

### Introduce the concept in isolation
Here is an example of mixing SQL into a route handler. We will run this to see its output.

```python
from flask import Flask
import sqlite3

app = Flask(__name__)

@app.route('/users')
def list_users():
    con = sqlite3.connect(':memory:')  # Simulated for lab
    con.row_factory = sqlite3.Row
    con.execute('CREATE TABLE users (id INTEGER, username TEXT, email TEXT)')
    con.execute('INSERT INTO users VALUES (1, "alice", "alice@example.com")')
    
    rows = con.execute('SELECT id, username, email FROM users ORDER BY username').fetchall()
    con.close()
    return str([dict(r) for r in rows])

# Running list_users() simulating a request
print(list_users())
```

**Output:**
```
[{'id': 1, 'username': 'alice', 'email': 'alice@example.com'}]
```
This output proves that the route successfully executes the query and formats the result. However, notice that 4 lines of connection plumbing occur before any logic, and testing this route requires firing up the full database flow.

### Discard the throwaway
We are deleting this mixed-responsibility route. It will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are demonstrating the anti-pattern before fixing it.
- **Files affected:** None.
- **Change type:** None.
- **Location:** None.
- **Dependencies:** None.

### The New Code
```python
# Anti-pattern demonstration (Do not use in production)
@app.route('/users/<int:uid>')
def get_user(uid):
    con = sqlite3.connect('app.db')  
    con.row_factory = sqlite3.Row
    row = con.execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone()
    con.close()
    if not row: return 'Not found', 404
    return str(dict(row))
```

### The Updated Project
```python
# 1: @app.route('/users/<int:uid>')
# 2: def get_user(uid):
# 3:     con = sqlite3.connect('app.db')  // ← new (repeated connection logic)
# 4:     con.row_factory = sqlite3.Row    // ← new
# 5:     row = con.execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone() // ← new
# 6:     con.close()                      // ← new
# 7:     if not row: return 'Not found', 404
# 8:     return str(dict(row))
```
This structure shows the route doing everything: managing connections, executing SQL, and handling HTTP.

### Mechanical walkthrough
- `@app.route('/users/<int:uid>')`: Registers the URL pattern.
- `def get_user(uid)`: Defines the function.
- `sqlite3.connect('app.db')`: Hardcodes a connection to a physical file, making it impossible to swap to an in-memory database for testing.
- `con.row_factory = sqlite3.Row`: Repeats the configuration that every other route also has to do.
- `con.execute(...)`: Executes the raw SQL query.
- `con.close()`: Manually closes the connection, which might be skipped if an error occurs before this line.

### CS lens
Coupling. By placing the data access logic (SQL) directly inside the presentation logic (Route), we tightly couple the HTTP layer to the storage layer. If the database schema changes, the HTTP route must change.

### SE lens
Testability. You cannot write a unit test for `get_user` without setting up a real file named `app.db`. If you had separated the SQL into a function, you could test the SQL function against an in-memory database, and test the route by passing it a fake function that just returns a dictionary.

### Commands needed
Run: `python app.py`

### Run it
The anti-pattern code executes, but leaves the architecture fragile.

### One sentence connecting to previous unit
Now that we have seen the pain of duplicating database logic in every route, we will extract that logic into dedicated functions.

---

## Concept Unit: Function-based repository

### The Problem
How do we remove the database connection boilerplate and SQL strings from our web routes so the routes can focus solely on HTTP responses?

### Introduce the concept in isolation
We will create standalone functions that handle the SQL, completely isolated from Flask.

```python
import sqlite3

# Lab setup
con = sqlite3.connect(':memory:')
con.row_factory = sqlite3.Row
con.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, password_hash TEXT)')

def user_create(db, username, email, password_hash):
    db.execute('INSERT INTO users (username,email,password_hash) VALUES (?,?,?)', 
               (username, email, password_hash))
    db.commit()
    return db.execute('SELECT last_insert_rowid()').fetchone()[0]

new_id = user_create(con, "bob", "bob@example.com", "hashed123")
print(f"Created user with ID: {new_id}")
```

**Output:**
```
Created user with ID: 1
```
This proves that the SQL logic can live in a plain Python function that takes a database connection as an argument, separating it from any web framework.

### Discard the throwaway
We are deleting this isolated lab example. It will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are building the application architecture.
- **Files affected:** `app.py` (created)
- **Change type:** add
- **Location:** At the top level of the file.
- **Dependencies:** Flask, sqlite3.

### The New Code
```python
def user_get_all():
    return get_db().execute('SELECT id, username, email FROM users ORDER BY username').fetchall()

def user_get_by_id(user_id):
    return get_db().execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone()
```

### The Updated Project
```python
# 1: def user_get_all(): // ← new
# 2:     return get_db().execute('SELECT id, username, email FROM users ORDER BY username').fetchall() // ← new
# 3: 
# 4: def user_get_by_id(user_id): // ← new
# 5:     return get_db().execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone() // ← new
# 6:
# 7: @app.route('/users')
# 8: def list_users():
# 9:     return str([dict(r) for r in user_get_all()]) // Route is now 1 line!
```
The application now defines specific functions for database actions, and the route merely calls them.

### Mechanical walkthrough
- `def user_get_all()`: A function dedicated entirely to retrieving all users.
- `get_db()`: A helper (which we will define fully in unit 5) that provides the database connection.
- `.execute(...)`: Runs the SQL query.
- `.fetchall()`: Retrieves all rows.
- The route `list_users()` now contains exactly zero lines of SQL or connection management.

### CS lens
Abstraction. We have raised the level of abstraction. The route no longer knows *how* users are stored (SQL, JSON, in-memory list); it only knows that `user_get_all()` returns them.

### SE lens
Maintainability. If the `users` table gets a new column, you only update `user_get_all()`. The 50 routes that might display users don't need to be touched.

### Commands needed
Run: `python app.py`

### Run it
The code executes cleanly, with routes delegating to the functions.

### One sentence connecting to previous unit
While standalone functions work, grouping related database functions together into a class provides even better organization.

---

## Concept Unit: Class-based repository

### The Problem
As our application grows, having 50 standalone functions like `user_get_all`, `user_create`, `note_get_all`, and `note_create` pollutes the global namespace. How can we group related data access logic together?

### Introduce the concept in isolation
We will encapsulate user-related database operations inside a class.

```python
import sqlite3

class UserRepositoryLab:
    def __init__(self, db):
        self.db = db
        
    def create(self, username):
        self.db.execute('INSERT INTO users (username) VALUES (?)', (username,))
        self.db.commit()
        return self.db.execute('SELECT last_insert_rowid()').fetchone()[0]

con = sqlite3.connect(':memory:')
con.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT)')
repo = UserRepositoryLab(con)
print("New ID:", repo.create("charlie"))
```

**Output:**
```
New ID: 1
```
This proves that a class can hold the database connection in its instance state (`self.db`) and expose methods for data access.

### Discard the throwaway
We are deleting this lab class. It will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are defining the class structure.
- **Files affected:** `app.py` (modified)
- **Change type:** add
- **Location:** Below the Flask app initialization.
- **Dependencies:** sqlite3.

### The New Code
```python
class UserRepository:
    def __init__(self, db):
        self.db = db

    def get_all(self):
        return self.db.execute(
            'SELECT id, username, email, created FROM users ORDER BY username'
        ).fetchall()

    def get_by_id(self, user_id):
        return self.db.execute(
            'SELECT * FROM users WHERE id = ?', (user_id,)
        ).fetchone()

    def create(self, username, email, password_hash):
        self.db.execute(
            'INSERT INTO users (username, email, password_hash) VALUES (?,?,?)',
            (username, email, password_hash)
        )
        self.db.commit()
        return self.db.execute('SELECT last_insert_rowid()').fetchone()[0]
```

### The Updated Project
```python
# 1: class UserRepository: // ← new
# 2:     def __init__(self, db): // ← new
# 3:         self.db = db // ← new
# ... (methods omitted for brevity, but all belong inside this class)
# 15:    def create(self, username, email, password_hash): // ← new
# 16:        self.db.execute('INSERT INTO users...', (username, email, password_hash)) // ← new
# 17:        self.db.commit() // ← new
# 18:        return self.db.execute('SELECT last_insert_rowid()').fetchone()[0] // ← new
```
The repository class encapsulates the database connection and the SQL queries for the `users` table.

### Mechanical walkthrough
- `class UserRepository:`: Defines a new class to hold user data operations.
- `def __init__(self, db)`: The constructor accepts an already-open database connection.
- `self.db = db`: Stores the connection as instance state.
- `def get_all(self)`: A method that uses `self.db` to execute a query.
- `def create(self, username, email, password_hash)`: Executes an `INSERT`, calls `self.db.commit()` to save the transaction, and uses `SELECT last_insert_rowid()` to fetch the ID of the newly inserted row.

### CS lens
Encapsulation. The `UserRepository` encapsulates the database connection and the specific SQL syntax required to interact with the `users` table. The rest of the application interacts only with the repository's public methods (`create`, `get_all`), completely shielded from SQL.

### SE lens
Dependency Injection. By passing `db` into `__init__`, we are injecting the dependency rather than hardcoding it. In a unit test, we can pass a mock database or an in-memory database to `UserRepository`, making tests fast and reliable.

### Commands needed
Run: `python app.py`

### Run it
The class is defined and ready to be instantiated.

### One sentence connecting to previous unit
Now that we have a structure for grouping queries, let's look at a more complex repository that handles pagination and authorization.

---

## Concept Unit: Notes repository with pagination

### The Problem
When a user has hundreds of notes, fetching all of them at once with `SELECT * FROM notes` is inefficient and slow. Furthermore, how do we ensure a user can only edit their own notes?

### Introduce the concept in isolation
We will use the `LIMIT` and `OFFSET` SQL clauses to implement pagination, and the `WHERE` clause for data-layer authorization.

```python
import sqlite3

con = sqlite3.connect(':memory:')
con.row_factory = sqlite3.Row
con.execute('CREATE TABLE notes (id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT)')
for i in range(1, 25):
    con.execute('INSERT INTO notes (user_id, title) VALUES (?, ?)', (1, f"Note {i}"))

page = 2
per_page = 10
offset = (page - 1) * per_page

rows = con.execute('SELECT title FROM notes WHERE user_id=1 LIMIT ? OFFSET ?', 
                   (per_page, offset)).fetchall()
print([dict(r) for r in rows])
```

**Output:**
```
[{'title': 'Note 11'}, {'title': 'Note 12'}, {'title': 'Note 13'}, {'title': 'Note 14'}, {'title': 'Note 15'}, {'title': 'Note 16'}, {'title': 'Note 17'}, {'title': 'Note 18'}, {'title': 'Note 19'}, {'title': 'Note 20'}]
```
This proves that mathematically calculating the offset based on the page number allows us to fetch exactly the slice of records we need.

### Discard the throwaway
We are deleting this pagination lab. It will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are adding the notes data layer.
- **Files affected:** `app.py` (modified)
- **Change type:** add
- **Location:** Below the `UserRepository`.
- **Dependencies:** None.

### The New Code
```python
class NoteRepository:
    def __init__(self, db):
        self.db = db

    def get_by_user(self, user_id, page=1, per_page=10):
        offset = (page - 1) * per_page
        rows = self.db.execute(
            'SELECT id, title, body, created FROM notes WHERE user_id=? ORDER BY created DESC LIMIT ? OFFSET ?',
            (user_id, per_page, offset)
        ).fetchall()
        
        total = self.db.execute('SELECT COUNT(*) FROM notes WHERE user_id=?', (user_id,)).fetchone()[0]
        
        return {
            'notes': rows, 
            'total': total, 
            'page': page, 
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        }

    def update(self, note_id, user_id, title, body):
        self.db.execute(
            'UPDATE notes SET title=?, body=? WHERE id=? AND user_id=?',
            (title, body, note_id, user_id)
        )
        self.db.commit()
```

### The Updated Project
```python
# 1: class NoteRepository: // ← new
# 2:     def __init__(self, db): // ← new
# 3:         self.db = db // ← new
# 4: 
# 5:     def get_by_user(self, user_id, page=1, per_page=10): // ← new
# 6:         offset = (page - 1) * per_page // ← new
# 7:         rows = self.db.execute( // ← new
# 8:             'SELECT id, title, body, created FROM notes WHERE user_id=? ORDER BY created DESC LIMIT ? OFFSET ?', // ← new
# 9:             (user_id, per_page, offset) // ← new
# 10:        ).fetchall() // ← new
# 11:        total = self.db.execute('SELECT COUNT(*) FROM notes WHERE user_id=?', (user_id,)).fetchone()[0] // ← new
# 12:        return {'notes': rows, 'total': total, 'page': page, 'per_page': per_page, 'total_pages': (total + per_page - 1) // per_page} // ← new
```
The `NoteRepository` now handles the math for pagination and ensures authorization checks happen directly in the SQL.

### Mechanical walkthrough
- `def get_by_user(self, user_id, page=1, per_page=10)`: Accepts the user ID and pagination parameters with defaults.
- `offset = (page - 1) * per_page`: Calculates how many records to skip. Page 1 skips 0. Page 2 skips 10.
- `LIMIT ? OFFSET ?`: SQL syntax that restricts the number of rows returned and sets the starting point.
- `total = self.db.execute('SELECT COUNT(*)...').fetchone()[0]`: Executes a second query just to get the total number of records, necessary for calculating the total number of pages.
- `'total_pages': (total + per_page - 1) // per_page`: Integer division math trick to calculate the ceiling of `total / per_page` without importing the `math` module.
- `WHERE id=? AND user_id=?`: In the `update` method, this ensures that even if a malicious user passes another user's `note_id`, the `UPDATE` affects 0 rows because the `user_id` won't match.

### CS lens
Algorithm Efficiency. By using `LIMIT` and `OFFSET`, we push the filtering work down to the database engine (which is highly optimized in C) rather than pulling all rows into Python memory and slicing the list.

### SE lens
Defense in Depth. By putting the `user_id=?` check inside the repository's `UPDATE` statement, we enforce authorization at the data layer. Even if the routing layer forgets to verify ownership, the data layer will simply update zero rows.

### Commands needed
Run: `python app.py`

### Run it
The pagination and update logic is cleanly defined in the repository.

### One sentence connecting to previous unit
To actually use these repositories in a web context, we need a reliable way to pass a database connection to them for every incoming request.

---

## Concept Unit: Wiring repository into Flask with get_db()

### The Problem
If the repository classes require a database connection, where does that connection come from during a web request, and how do we ensure it is safely closed when the request ends?

### Introduce the concept in isolation
We will use Flask's `g` object and teardown hooks to manage resource lifecycles.

```python
from flask import Flask, g
import sqlite3

app = Flask(__name__)
app.config['DATABASE'] = ':memory:'

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db = g.pop('db', None)
    if db: 
        print("Closing DB connection")
        db.close()

with app.app_context():
    con1 = get_db()
    con2 = get_db()
    print("Same connection?", con1 is con2)
```

**Output:**
```
Same connection? True
Closing DB connection
```
This proves that `get_db()` safely caches the connection on `g` so multiple calls in the same request reuse the same connection, and the teardown hook automatically runs at the end of the context.

### Discard the throwaway
We are deleting this Flask context lab. It will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are wiring the app.
- **Files affected:** `app.py` (modified)
- **Change type:** add
- **Location:** At the top of the file, above the routes.
- **Dependencies:** Flask, sqlite3.

### The New Code
```python
app.config['DATABASE'] = ':memory:'

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA foreign_keys=ON')
        g.db.executescript('''
            CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT, body TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
        ''')
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db = g.pop('db', None)
    if db: db.close()

def user_repo():
    return UserRepository(get_db())
```

### The Updated Project
```python
# 1: app.config['DATABASE'] = ':memory:' // ← new
# 2: 
# 3: def get_db(): // ← new
# 4:     if 'db' not in g: // ← new
# 5:         g.db = sqlite3.connect(app.config['DATABASE']) // ← new
# 6:         g.db.row_factory = sqlite3.Row // ← new
# 7:         g.db.execute('PRAGMA foreign_keys=ON') // ← new
# 8:         g.db.executescript('...') // ← new
# 9:     return g.db // ← new
# 10: 
# 11: @app.teardown_appcontext // ← new
# 12: def close_db(e=None): // ← new
# 13:     db = g.pop('db', None) // ← new
# 14:     if db: db.close() // ← new
# 15: 
# 16: def user_repo(): // ← new
# 17:     return UserRepository(get_db()) // ← new
```
We now have a robust system that ensures exactly one database connection per request, and factory functions to create repositories connected to it.

### Mechanical walkthrough
- `app.config['DATABASE'] = ':memory:'`: Stores the database location in Flask's config dictionary.
- `if 'db' not in g:`: Checks if a connection was already opened during this HTTP request.
- `g.db = sqlite3.connect(...)`: Opens the connection and stores it on `g` (the request-local global).
- `g.db.execute('PRAGMA foreign_keys=ON')`: Enables foreign key enforcement in SQLite, which is off by default.
- `@app.teardown_appcontext`: Tells Flask to execute the following function when the request ends.
- `db = g.pop('db', None)`: Removes the connection from `g`.
- `def user_repo():`: A factory function that gets the current request's connection and injects it into a new `UserRepository` instance.

### CS lens
Resource Lifecycle Management. Opening a database connection is expensive, and leaving it open causes resource leaks. Tying the connection lifecycle explicitly to the HTTP request lifecycle guarantees that resources are acquired precisely when needed and predictably released.

### SE lens
Factory Pattern. `user_repo()` acts as a factory. The route just calls `repo = user_repo()` and doesn't need to know how the database connection was retrieved or configured.

### Commands needed
Run: `python app.py`

### Run it
The Flask app is now fully wired to safely supply database connections to your repositories.

### One sentence connecting to previous unit
With the plumbing in place, our routes can now perform complex database operations securely in just 2 or 3 lines of code.

---

## Closing

### Connect the pieces
Let's trace a full HTTP request through our new architecture.

Imagine a user makes a `POST /notes` request to create a note for `user_id=3`. 
1. The route function is invoked by Flask.
2. The route calls `note_repo = NoteRepository(get_db())`.
3. Inside `get_db()`, Flask sees there is no connection in `g` yet, opens one to `app.db`, and stores it on `g`.
4. The route calls `note_repo.create(user_id=3, title='My Note')`.
5. Inside `NoteRepository.create()`, the `INSERT INTO notes (user_id, title, body) VALUES (3, 'My Note', '')` SQL is executed and committed, returning the new `id`.
6. The route returns a `201 Created` HTTP response.
7. The request ends. Flask triggers `@app.teardown_appcontext`, which calls `close_db()`, cleanly closing the SQLite connection.

All SQL is isolated in the repository. All HTTP logic is isolated in the route. All connection management is isolated in the framework hooks.
