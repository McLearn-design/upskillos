# Lesson 30: User-Owned Resources — Row-Level Access Control and IDOR Prevention

**What you will build**
You will build a secure data access layer that enforces row-level ownership checks on every database operation. The transferable problem this lesson solves is preventing Insecure Direct Object Reference (IDOR) vulnerabilities, where an attacker can access or modify another user's data simply by guessing or changing a resource ID in a URL or API request. By the end of this lesson, you will see how always including `AND user_id=?` in your SQL queries prevents entire classes of data leaks and unauthorized modifications.

**What you need to know first**
- Lesson 29
- SQL injection prevention (using parameterized queries)
- Session-based authentication

**Terms used in this lesson**
- **IDOR (Insecure Direct Object Reference)** — A security vulnerability that occurs when an application provides direct access to objects based on user-supplied input without verifying if the user is authorized to access that specific object. It exists because IDs are often sequential and predictable, making it easy for attackers to iterate through them.
- **Row-Level Access Control** — A security mechanism that restricts access to specific rows in a database table based on the identity or role of the currently authenticated user. It solves the problem of users being able to read or modify records belonging to other users in a multi-tenant application.
- **Pagination** — The process of dividing a large dataset into smaller, manageable chunks (pages) for display. It exists to improve performance and user experience by not loading thousands of records at once.
- **OFFSET** — A SQL clause that specifies the number of rows to skip before starting to return rows from the query. Used in conjunction with `LIMIT` to implement pagination.
- **LIMIT** — A SQL clause that restricts the maximum number of rows returned by a query.

**Objects and methods used**

- **`sqlite3.connect`**
  - *What it is:* A function that opens a connection to an SQLite database file or an in-memory database.
  - *Implementation:* `def connect(database: str | bytes | PathLike[str], timeout: float = 5.0, detect_types: int = 0, isolation_level: str | None = 'DEFERRED', check_same_thread: bool = True, factory: type[Connection] | None = Connection, cached_statements: int = 128, uri: bool = False, autocommit: bool = False) -> Connection`
  - *Its use:* Used to establish a connection to an in-memory SQLite database (`:memory:`) for demonstration and testing purposes without writing to disk.
  - *Type:* Standalone function.
  - *Responsibility:* Initializes the SQLite engine, allocates memory, and returns a `Connection` object that represents the database session.
  - *Depends on:* A database identifier string (file path or `:memory:`).
  - *Connects to:* Called by application startup code; returns a `Connection` object used by subsequent database operations.
  - *Shape:* A boundary function bridging Python code and the underlying C SQLite library.

- **`sqlite3.Connection.execute`**
  - *What it is:* A method that executes a single SQL statement.
  - *Implementation:* `def execute(self, sql: str, parameters: _Parameters = ()) -> Cursor`
  - *Its use:* Used to run `SELECT`, `UPDATE`, `DELETE`, and `INSERT` statements with parameterized inputs to interact with the database safely.
  - *Type:* Instance method on the `Connection` class.
  - *Responsibility:* Prepares a SQL statement, binds parameters to prevent SQL injection, executes it against the database, and returns a `Cursor` to fetch results.
  - *Depends on:* An active database connection, a SQL query string, and optionally a tuple of parameters to bind.
  - *Connects to:* Called by data access functions; calls the SQLite execution engine; returns a `Cursor`.
  - *Shape:* The primary execution boundary between application logic and the database engine.

- **`sqlite3.Cursor.fetchone`**
  - *What it is:* A method that retrieves the next row of a query result set.
  - *Implementation:* `def fetchone(self) -> Any | None`
  - *Its use:* Used to retrieve a single record, such as a specific note, or check if a record exists.
  - *Type:* Instance method on the `Cursor` class.
  - *Responsibility:* Advances the cursor and returns the data for one row as a sequence (or a `Row` object if `row_factory` is set), returning `None` if no more rows are available.
  - *Depends on:* A successfully executed `SELECT` query on the cursor.
  - *Connects to:* Called by data access functions after `execute`; returns a row or `None`.
  - *Shape:* Data retrieval boundary from the database cursor to application space.

- **`flask.abort`**
  - *What it is:* A function that raises an HTTPException for the given status code.
  - *Implementation:* `def abort(status: int | BaseResponse, *args: Any, **kwargs: Any) -> t.NoReturn`
  - *Its use:* Used to immediately halt request processing and return an error response (like 401 Unauthorized or 404 Not Found) when access control checks fail.
  - *Type:* Standalone function (part of Werkzeug, exposed via Flask).
  - *Responsibility:* Stops execution of the current view function and triggers Flask's error handling mechanism to return an appropriate HTTP response.
  - *Depends on:* An HTTP status code integer.
  - *Connects to:* Called by view functions during validation or authorization; connects to Flask's error handler dispatcher.
  - *Shape:* Control flow boundary that exits the normal request lifecycle and jumps to error handling.

- **`flask.session`**
  - *What it is:* A dictionary-like object that stores data across requests for a specific client.
  - *Implementation:* An instance of `SecureCookieSession` implementing a dictionary interface.
  - *Its use:* Used to retrieve the `user_id` of the currently authenticated user making the request.
  - *Type:* Global context local proxy object.
  - *Responsibility:* Cryptographically signs and serializes data into a cookie sent to the client, and verifies and deserializes it on incoming requests.
  - *Depends on:* The Flask application's `SECRET_KEY` for signing, and an active request context.
  - *Connects to:* Read/written by view functions; connects to Flask's session interface during request setup and teardown.
  - *Shape:* State persistence boundary between stateless HTTP requests.

- **`flask.g`**
  - *What it is:* A namespace object that can store data during an application context.
  - *Implementation:* An instance of `_AppCtxGlobals`.
  - *Its use:* Used to store the database connection (`g.db`) and the loaded user object (`g.user`) so they can be accessed multiple times during a single request without re-fetching or reconnecting.
  - *Type:* Global context local proxy object.
  - *Responsibility:* Provides a request-scoped storage area that is automatically cleared at the end of the request.
  - *Depends on:* An active application context.
  - *Connects to:* Read/written by `before_request` handlers, database getter functions, and view functions.
  - *Shape:* Request-scoped state boundary for sharing resources within a single request lifecycle.

---

## Concept Unit: The IDOR vulnerability

### The Problem
When a user clicks on a note, the URL might look like `/notes/1`. The application extracts the `1`, queries the database for note ID `1`, and returns it. But what stops Bob from manually changing the URL to `/notes/2`, a note belonging to Alice? If the application only looks up the note by its ID, nothing stops him. How do we ensure Bob can only read notes he actually owns, without relying on him "playing fair" with the URL?

### Introduce the concept in isolation
```python
import sqlite3
con = sqlite3.connect(':memory:')
con.row_factory = sqlite3.Row
con.executescript('''
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL);
    CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, body TEXT);
    INSERT INTO users (username) VALUES ('alice'), ('bob');
    INSERT INTO notes (user_id, title, body) VALUES (1, 'Alice secret', 'My private data'), (2, 'Bob secret', 'Bob private data');
''')

# VULNERABLE: no ownership check
def get_note_vulnerable(note_id):
    return con.execute('SELECT * FROM notes WHERE id=?', (note_id,)).fetchone()

# Bob (user_id=2) requests note 1 (Alice's note):
bob_user_id = 2
alices_note = get_note_vulnerable(note_id=1)
print('IDOR: bob reads alice note:', dict(alices_note) if alices_note else None)

# SAFE: always include user_id in WHERE clause
def get_note_safe(note_id, user_id):
    return con.execute('SELECT * FROM notes WHERE id=? AND user_id=?', (note_id, user_id)).fetchone()

result = get_note_safe(note_id=1, user_id=bob_user_id)
print('Safe: bob reads alice note:', result)  # None (not found)
```
When `get_note_vulnerable(1)` runs, it executes `SELECT WHERE id=1`. Alice's note is returned, and Bob (user_id=2) reads it because no ownership is enforced. When `get_note_safe(1, user_id=2)` runs, it executes `SELECT WHERE id=1 AND user_id=2`. Note id=1 has user_id=1 (Alice), which does not equal 2. The database finds no matching row and returns `None`. Bob gets nothing. Always passing the authenticated user's ID into the query enforces ownership at the database level. This is called **row-level access control**.

### Discard the throwaway
This standalone SQLite script is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are simulating the vulnerability in isolation before updating the main project.
- **Files affected:** `app.py`
- **Change type:** refactor
- **Location:** Inside the database fetch logic for getting a single note.
- **Dependencies:** Requires a logged-in user session.

### The New Code
```python
def get_note(note_id, user_id):
    return get_db().execute(
        'SELECT * FROM notes WHERE id=? AND user_id=?', 
        (note_id, user_id)
    ).fetchone()
```

### The Updated Project
```python
# 1
def get_note(note_id, user_id):
    return get_db().execute(
        'SELECT * FROM notes WHERE id=? AND user_id=?', # ← new
        (note_id, user_id)                              # ← new
    ).fetchone()
```
The data access function now requires both the `note_id` from the request and the `user_id` from the authenticated session, ensuring a record is only returned if it matches both conditions.

### Mechanical walkthrough
- `def get_note(note_id, user_id):` defines a function taking the requested note ID and the current user's ID.
- `get_db()` retrieves the active SQLite connection for the request.
- `.execute(...)` prepares and runs the SQL statement.
- `'SELECT * FROM notes WHERE id=? AND user_id=?'` is the SQL query. It demands that both the `id` column matches the first parameter AND the `user_id` column matches the second parameter.
- `(note_id, user_id)` is the tuple of parameters bound safely to the `?` placeholders.
- `.fetchone()` retrieves the single matching row, returning `None` if the row doesn't exist or doesn't belong to the user.

### CS lens
Access control is fundamentally a set intersection problem. The set of "resources the user requested" (id=1) intersects with the set of "resources the user owns" (user_id=2). If the intersection is empty, access is denied. By pushing this intersection logic down into the database via SQL's `AND` operator, we avoid transferring unauthorized data over the network into application memory only to discard it later.

### SE lens
Secure by default. If a developer writes `get_note(note_id)` and forgets to check ownership later in the view logic, the application has an IDOR vulnerability. By requiring `user_id` as a mandatory parameter in the data access function signature itself, the compiler/interpreter forces the caller to provide it. You make the insecure action impossible to compile or run, rather than relying on developer vigilance.

### Commands needed
Run: `python app.py`

### Run it
Execute the application. Attempting to fetch a note belonging to another user will now return no data.

### One sentence connecting to previous unit
Now that reading data is protected, we must ensure modifying data is equally secure against IDOR attacks.

---

## Concept Unit: Ownership check in all CRUD operations

### The Problem
We've secured `SELECT` statements, but what about `UPDATE` and `DELETE`? If a user submits a form to change the title of note ID 5, and the backend just runs `UPDATE notes SET title=? WHERE id=5`, a malicious user can edit anyone's notes. How do we ensure an update or delete operation only affects rows the user owns, without having to run a `SELECT` first just to check?

### Introduce the concept in isolation
```python
import sqlite3
con = sqlite3.connect(':memory:')
con.row_factory = sqlite3.Row
con.executescript('''
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL);
    CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT DEFAULT '');
    INSERT INTO users (username) VALUES ('alice'), ('bob');
    INSERT INTO notes (user_id, title, body) VALUES (1,'Alice Note','Secret'),(2,'Bob Note','Also secret');
''')

def note_update(note_id, user_id, title, body):
    con.execute('UPDATE notes SET title=?, body=? WHERE id=? AND user_id=?', (title, body, note_id, user_id))
    con.commit()
    return con.execute('SELECT changes()').fetchone()[0]  # rows affected

# Alice (id=1) tries to update Bob's note (id=2):
affected = note_update(note_id=2, user_id=1, title='Hacked', body='Pwned')
print('Rows updated (alice -> bob note):', affected)  # 0 (no change)

# Bob updates his own note:
affected2 = note_update(note_id=2, user_id=2, title='Updated Bob', body='New content')
print('Rows updated (bob -> bob note):', affected2)   # 1 (success)
```
When `UPDATE notes SET ... WHERE id=2 AND user_id=1` runs, the database looks for a row matching both conditions. Note id=2 has user_id=2 (Bob). The condition fails, so 0 rows are affected. `SELECT changes()` in SQLite returns the number of rows affected by the last INSERT, UPDATE, or DELETE. Alice's attack silently fails with 0 rows changed. When Bob updates his own note, it matches, and 1 row is affected.

### Discard the throwaway
This standalone SQLite script is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition.
- **Files affected:** `app.py`
- **Change type:** refactor
- **Location:** Data access functions for updating and deleting notes.
- **Dependencies:** None.

### The New Code
```python
def delete_note(note_id, user_id):
    db = get_db()
    db.execute('DELETE FROM notes WHERE id=? AND user_id=?', (note_id, user_id))
    db.commit()
```

### The Updated Project
```python
# 1
def delete_note(note_id, user_id):
    db = get_db()
    db.execute('DELETE FROM notes WHERE id=? AND user_id=?', (note_id, user_id)) # ← new
    db.commit()
```
The delete function now restricts the `DELETE` statement to only affect rows where `user_id` matches the authenticated user.

### Mechanical walkthrough
- `def delete_note(note_id, user_id):` defines the function.
- `db.execute('DELETE FROM notes WHERE id=? AND user_id=?', (note_id, user_id))` executes the deletion. The crucial addition is `AND user_id=?`. If `note_id` belongs to a different user, this query safely deletes exactly zero rows.
- `db.commit()` writes the changes to disk.

### CS lens
Atomic operations. By enforcing authorization within the `UPDATE` or `DELETE` statement itself, the operation is atomic. If you instead did `SELECT` to check ownership, then `DELETE`, a race condition (Time-of-Check to Time-of-Use) could theoretically occur. Pushing the constraint into the database engine guarantees safety at the transaction level.

### SE lens
Defense in depth. Even if the UI hides the delete button for notes you don't own, attackers don't use the UI—they send HTTP requests directly. The backend must independently enforce all authorization rules. By baking the `user_id` requirement into every mutating SQL statement, the database itself becomes a hard boundary preventing unauthorized modification.

### Commands needed
Run: `python app.py`

### Run it
Execute the application. Forging a delete request for another user's note will result in no database changes.

### One sentence connecting to previous unit
With the database layer secure, we need to handle how the web routing layer responds when an unauthorized request is made.

---

## Concept Unit: Enforcing ownership in Flask routes

### The Problem
When a user attempts to access a note that doesn't exist, we return a 404 Not Found. What should we return when a user attempts to access a note that *does* exist, but belongs to someone else? If we return 403 Forbidden, we've just told the attacker "This note ID exists, it's just not yours." An attacker can use this to enumerate all valid note IDs in the system. How do we prevent this information leak?

### Introduce the concept in isolation
```python
import sqlite3, secrets
from flask import Flask, session, request, g, abort

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript('''
            CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT DEFAULT '');
            INSERT INTO users (username) VALUES ('alice'), ('bob');
            INSERT INTO notes (user_id, title, body) VALUES (1,'Alice Note','Secret'),(2,'Bob Note','Private');
        ''')
    return g.db

@app.route('/notes/<int:note_id>')
def note_detail(note_id):
    user_id = session.get('user_id')
    if not user_id: abort(401)
    
    note = get_db().execute('SELECT * FROM notes WHERE id=? AND user_id=?', (note_id, user_id)).fetchone()
    
    if note is None: abort(404)  # not found OR not owned: same response
    return f'Note {note["id"]}: {note["title"]}'

with app.test_request_context():
    print('404 vs 403 for unauthorized resource: return 404 (no info leak about existence)')
```
When Bob (user_id=2) requests `/notes/1`, `SELECT WHERE id=1 AND user_id=2` returns `None`. The code then calls `abort(404)`, returning 404 Not Found, not 403 Forbidden. A 404 leaks no information: Bob doesn't know if note 1 doesn't exist, or if it just belongs to someone else. A 403 would confirm the resource's existence. Returning 404 for unauthorized objects prevents enumeration.

### Discard the throwaway
This standalone Flask script is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** add
- **Location:** Inside the Flask route handlers for individual notes.
- **Dependencies:** Flask `abort` function.

### The New Code
```python
    note = get_db().execute('SELECT * FROM notes WHERE id=? AND user_id=?', (note_id, user_id)).fetchone()
    if note is None:
        abort(404)
```

### The Updated Project
```python
# 1
@app.route('/notes/<int:note_id>')
def view_note(note_id):
    user_id = session.get('user_id')
    if not user_id: 
        abort(401)
        
    note = get_db().execute('SELECT * FROM notes WHERE id=? AND user_id=?', (note_id, user_id)).fetchone() # ← new
    if note is None: # ← new
        abort(404)   # ← new
        
    return render_template('note.html', note=note)
```
The view function fetches the note using the secure `user_id` constraint, and returns a 404 if the query yields nothing, masking the difference between non-existent and unowned resources.

### Mechanical walkthrough
- `note = get_db().execute(...)` runs the secure SQL query.
- `if note is None:` checks if a row was returned. Because the query includes `AND user_id=?`, `None` means either the note ID is completely invalid, OR the note ID is valid but belongs to another user.
- `abort(404)` halts execution and sends a 404 Not Found HTTP response. The attacker cannot distinguish between a bad ID and an ID they don't own.

### CS lens
Information theory. A system leaks information whenever its observable outputs differ based on hidden state. If the system returns 404 for "does not exist" and 403 for "exists but not yours", the difference in the HTTP status code is a signal that leaks the hidden state (the existence of the record). By mapping both hidden states to the exact same observable output (404), the signal channel is closed.

### SE lens
Handling missing vs. unauthorized resources identically simplifies the codebase. You don't need to write separate logic to first check existence, then check ownership, and finally return different errors. One secure query handles both cases, leading to shorter, more robust code that is secure by design.

### Commands needed
Run: `python app.py`

### Run it
Execute the application. Attempting to navigate to another user's note URL will present a standard 404 page, revealing nothing.

### One sentence connecting to previous unit
Securing individual items is vital, but we also must secure lists of items so a user only ever sees their own data in dashboards and index pages.

---

## Concept Unit: Listing only owned resources

### The Problem
When a user logs in and visits their dashboard, they should see a list of their notes. If the application runs `SELECT * FROM notes`, it will fetch every note from every user in the system. How do we ensure list views and pagination only ever operate on the current user's slice of the data?

### Introduce the concept in isolation
```python
import sqlite3, secrets
from flask import Flask, session, g, request

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript('''
            CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, created TEXT DEFAULT (datetime("now")));
            INSERT INTO notes (user_id,title) VALUES (1,'Alice A'),(1,'Alice B'),(2,'Bob A'),(1,'Alice C');
        ''')
    return g.db

@app.route('/notes')
def list_notes():
    user_id = session.get('user_id')
    if not user_id:
        return '[]'
    
    page = int(request.args.get('page', 1))
    per_page = 10
    offset = (page - 1) * per_page
    
    notes = get_db().execute(
        'SELECT id, title, created FROM notes WHERE user_id=? ORDER BY created DESC LIMIT ? OFFSET ?',
        (user_id, per_page, offset)
    ).fetchall()
    
    total = get_db().execute('SELECT COUNT(*) FROM notes WHERE user_id=?', (user_id,)).fetchone()[0]
    return str({'notes': [dict(n) for n in notes], 'total': total, 'page': page})

with app.test_request_context():
    print('List: WHERE user_id=? ensures users only see their own notes')
```
When Alice (user_id=1) requests `/notes`, the query is `SELECT ... WHERE user_id=1 ORDER BY created DESC LIMIT 10 OFFSET 0`. This returns Alice's 3 notes and ignores Bob's. The `COUNT(*)` query also includes `WHERE user_id=?`, so the pagination logic accurately knows Alice has 3 total items, not 4. Never use `SELECT * FROM notes` without scoping it to the current user.

### Discard the throwaway
This standalone list script is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** refactor
- **Location:** The route handler that lists notes for the dashboard.
- **Dependencies:** None.

### The New Code
```python
    notes = get_db().execute(
        'SELECT * FROM notes WHERE user_id=? ORDER BY created DESC',
        (user_id,)
    ).fetchall()
```

### The Updated Project
```python
# 1
@app.route('/dashboard')
def dashboard():
    user_id = session.get('user_id')
    if not user_id:
        return redirect(url_for('login'))
        
    notes = get_db().execute(
        'SELECT * FROM notes WHERE user_id=? ORDER BY created DESC', # ← new
        (user_id,)                                                   # ← new
    ).fetchall()
    
    return render_template('dashboard.html', notes=notes)
```
The dashboard query is now globally constrained by `user_id=?`, ensuring the list view is secure against data leakage.

### Mechanical walkthrough
- `notes = get_db().execute(...)` runs the database query.
- `'SELECT * FROM notes WHERE user_id=? ORDER BY created DESC'` fetches notes, strictly filtered to only those matching `user_id`, and sorts them by creation date.
- `(user_id,)` binds the authenticated session ID to the parameter.
- `.fetchall()` retrieves all matching rows as a list. If the user has no notes, it returns an empty list, not an error.

### CS lens
Multi-tenancy. In a multi-tenant database architecture where all users share the same tables, the `user_id` column acts as a logical partition. Every query against a shared table must include the partition key (`user_id`) to ensure isolation between tenants, effectively simulating a separate database for each user.

### SE lens
Consistency across endpoints. A common vulnerability pattern is securing the single-item view (`/notes/5`) but forgetting to secure the list view (`/notes`), allowing an attacker to scrape all data by just calling the list endpoint. Applying the `user_id` constraint universally across all read, update, delete, and list operations guarantees a watertight access model.

### Commands needed
Run: `python app.py`

### Run it
Execute the application. Logging in as different users will correctly isolate their dashboard data.

### One sentence connecting to previous unit
While strict row-level ownership is correct for regular users, sometimes a system requires privileged roles that deliberately bypass these restrictions.

---

## Concept Unit: Admin bypass — when admins SHOULD see all resources

### The Problem
Sometimes, users like support staff or administrators need to view or manage resources across the entire application, regardless of who owns them. If we hardcode `AND user_id=?` into every single data access function, admins are blocked too. How do we build an architecture that strictly enforces ownership for regular users, but safely allows authorized administrative bypass?

### Introduce the concept in isolation
```python
import sqlite3, secrets
from flask import Flask, session, g

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript('''
            CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, role TEXT DEFAULT 'user');
            CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL);
            INSERT INTO users (username,role) VALUES ('alice','user'),('bob','user'),('charlie','admin');
            INSERT INTO notes (user_id,title) VALUES (1,'Alice Note'),(2,'Bob Note');
        ''')
    return g.db

@app.before_request
def load_user():
    uid=session.get('user_id')
    g.user=get_db().execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone() if uid else None

@app.route('/notes')
def list_notes():
    if g.user is None: return 'Unauthorized', 401
    
    if g.user['role'] == 'admin':
        # Admin: see all notes
        notes = get_db().execute('SELECT n.id, n.title, u.username FROM notes n JOIN users u ON n.user_id=u.id').fetchall()
    else:
        # Regular user: only own notes
        notes = get_db().execute('SELECT id, title FROM notes WHERE user_id=?', (g.user['id'],)).fetchall()
        
    return str([dict(n) for n in notes])

with app.test_request_context():
    print('Admin: no WHERE user_id filter -> sees all notes')
```
When `g.user['role'] == 'admin'`, the code executes `SELECT notes JOIN users` with no `user_id` filter, returning all notes with their owner's username. When `g.user['role'] == 'user'`, it executes `SELECT WHERE user_id=g.user['id']`, returning only their notes. This explicit if/else branch makes the security model easy to audit. The admin bypass is intentional, documented, and explicitly verified.

### Discard the throwaway
This standalone admin script is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** add
- **Location:** At the top of a route that supports administrative viewing.
- **Dependencies:** User object loaded into Flask `g`.

### The New Code
```python
    if g.user['role'] == 'admin':
        notes = get_db().execute('SELECT * FROM notes').fetchall()
    else:
        notes = get_db().execute('SELECT * FROM notes WHERE user_id=?', (g.user['id'],)).fetchall()
```

### The Updated Project
```python
# 1
@app.route('/all_notes')
def all_notes():
    if g.user is None:
        abort(401)
        
    if g.user['role'] == 'admin': # ← new
        notes = get_db().execute('SELECT * FROM notes').fetchall() # ← new
    else: # ← new
        notes = get_db().execute('SELECT * FROM notes WHERE user_id=?', (g.user['id'],)).fetchall() # ← new
        
    return render_template('all_notes.html', notes=notes)
```
The view explicitly branches based on the user's role, providing an unfiltered query for administrators while maintaining the strict ownership check for everyone else.

### Mechanical walkthrough
- `if g.user['role'] == 'admin':` checks the `role` column of the currently authenticated user.
- `notes = get_db().execute('SELECT * FROM notes').fetchall()` runs an unconstrained query, retrieving every record in the table, effectively bypassing the row-level access control.
- `else:` catches all non-admin users.
- `notes = get_db().execute('SELECT * FROM notes WHERE user_id=?', (g.user['id'],)).fetchall()` runs the standard, secured query, restricting output to owned rows.

### CS lens
Role-Based Access Control (RBAC). We are layering RBAC on top of our existing row-level access control. RBAC determines *what actions* a user can perform globally (e.g., "admins can read all"), while row-level control determines *which specific objects* a normal user can act upon based on ownership.

### SE lens
Explicit branches are safer than complex dynamic SQL. It might be tempting to dynamically build the `WHERE` clause string based on roles, but explicit `if/else` blocks with completely separate `execute()` calls are far easier to audit for security. A security reviewer can instantly see the admin path and the user path without mentally evaluating string concatenation.

### Commands needed
Run: `python app.py`

### Run it
Execute the application. Logging in as an administrator will display the global list, while normal users remain sandboxed.

### One sentence connecting to previous unit
Combining row-level access control with explicit role-based bypasses creates a robust, auditable security foundation for multi-user applications.

---

## Closing

### Connect the pieces
By incorporating the authenticated `user_id` into the `WHERE` clause of every database query, we have completely mitigated Insecure Direct Object Reference (IDOR) vulnerabilities. If an attacker like Bob (user_id=2) requests a `DELETE /notes/1` (Alice's note), the backend executes `DELETE FROM notes WHERE id=1 AND user_id=2`. Although `id=1` exists, `user_id=1` does not equal `2`. The operation results in 0 rows affected, and Alice's note remains untouched. Returning a 404 for both non-existent and unauthorized resources further prevents data enumeration, ensuring attackers cannot even map out the system's private data footprint. Explicit branching allows administrators to safely bypass these rules without compromising the default security posture for regular users.
