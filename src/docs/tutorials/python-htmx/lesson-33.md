# Lesson 33: Capstone Design — Schema, Routes, and Application Skeleton

**What you will build**
The capstone is a notes app with authentication: users register, log in, create/edit/delete notes, search them, and log out. Before writing a single route, we design the full schema and route map. Every feature maps to: a table (data), one or more routes (HTTP endpoints), and one or more templates (HTML fragments). Doing this first prevents mid-build structural refactoring.

**What you need to know first**
Nothing specific to prior lessons is assumed here; we are outlining the capstone architecture from scratch.

**Terms used in this lesson**
- **f-string** — Python syntax for formatting strings with embedded expressions.
- **list comprehension** — Python syntax for creating a list based on an existing iterable.
- **HTTP GET** — An HTTP method used to request data from a specified resource.
- **HTTP POST** — An HTTP method used to send data to a server to create/update a resource.
- **HTTP DELETE** — An HTTP method used to delete the specified resource.
- **foreign key** — A database concept linking a record in one table to a record in another.
- **blueprint** — A Flask concept for organizing a group of related routes and handlers.

**Objects and methods used**

- **`dict`**
  - *What it is:* A built-in Python dictionary type.
  - *Implementation:* `class dict(**kwarg)`
  - *Its use:* Used to store the technology stack definitions.
  - *Type:* Built-in class.
  - *Responsibility:* Maps keys to values for fast retrieval.
  - *Depends on:* Hashable keys.
  - *Connects to:* Accessed via keys.
  - *Shape:* Data structure in memory.

- **`print`**
  - *What it is:* Built-in function to output text to standard output.
  - *Implementation:* `def print(*objects, sep=' ', end='\n', file=sys.stdout, flush=False)`
  - *Its use:* Used to display information during the throwaway labs.
  - *Type:* Built-in function.
  - *Responsibility:* Writes string representations of objects to a stream.
  - *Depends on:* The standard output stream.
  - *Connects to:* OS standard output.
  - *Shape:* Output mechanism.

- **`sqlite3.connect`**
  - *What it is:* Method to open a connection to an SQLite database.
  - *Implementation:* `def connect(database, timeout=5.0, detect_types=0, isolation_level='DEFERRED', check_same_thread=True, factory=Connection, cached_statements=128, uri=False)`
  - *Its use:* Used to connect to the in-memory database or application database file.
  - *Type:* Function in the `sqlite3` module.
  - *Responsibility:* Provides a connection object to interact with the database.
  - *Depends on:* A database file path or `':memory:'`.
  - *Connects to:* SQLite C library.
  - *Shape:* External resource connector.

- **`Connection.executescript`**
  - *What it is:* Method to execute multiple SQL statements at once.
  - *Implementation:* `def executescript(sql_script, /)`
  - *Its use:* Used to run the full schema definition.
  - *Type:* Method on the `sqlite3.Connection` class.
  - *Responsibility:* Executes a script of multiple SQL statements.
  - *Depends on:* A string containing valid SQL.
  - *Connects to:* The SQLite database engine.
  - *Shape:* Database interface.

- **`Connection.commit`**
  - *What it is:* Method to commit the current transaction.
  - *Implementation:* `def commit()`
  - *Its use:* Saves the created tables and indexes.
  - *Type:* Method on the `sqlite3.Connection` class.
  - *Responsibility:* Ensures changes are permanently saved.
  - *Depends on:* An active connection and transaction.
  - *Connects to:* The SQLite database engine.
  - *Shape:* Database interface.

- **`Cursor.fetchall`**
  - *What it is:* Method to fetch all rows of a query result.
  - *Implementation:* `def fetchall()`
  - *Its use:* Used to retrieve the list of tables and indexes from `sqlite_master`.
  - *Type:* Method on the `sqlite3.Cursor` class.
  - *Responsibility:* Returns a list of tuples containing the remaining rows of a query result.
  - *Depends on:* A previously executed query.
  - *Connects to:* The application code expecting a list.
  - *Shape:* Data retriever.

- **`load_dotenv`**
  - *What it is:* Function to load environment variables from a `.env` file.
  - *Implementation:* `def load_dotenv(dotenv_path=None, stream=None, verbose=False, override=False, interpolate=True, encoding='utf-8')`
  - *Its use:* Used to load `SECRET_KEY` and `DATABASE_URL`.
  - *Type:* Function in the `dotenv` package.
  - *Responsibility:* Reads key-value pairs from a `.env` file and sets them as environment variables.
  - *Depends on:* A `.env` file.
  - *Connects to:* `os.environ`.
  - *Shape:* Configuration loader.

- **`Flask`**
  - *What it is:* The core application class for the Flask web framework.
  - *Implementation:* `class Flask(import_name, static_url_path=None, static_folder='static', static_host=None, host_matching=False, subdomain_matching=False, template_folder='templates', instance_path=None, instance_relative_config=False, root_path=None)`
  - *Its use:* Used to create the central application instance.
  - *Type:* Class.
  - *Responsibility:* Manages routes, configuration, and the request/response cycle.
  - *Depends on:* Python environment and WSGI server.
  - *Connects to:* Web requests and responses.
  - *Shape:* Application core.

- **`Flask.config.from_mapping`**
  - *What it is:* Method to update application configuration from a dictionary or keyword arguments.
  - *Implementation:* `def from_mapping(*mapping, **kwargs)`
  - *Its use:* Used to set application configuration like `SECRET_KEY` and `DATABASE`.
  - *Type:* Method on the Flask configuration dictionary.
  - *Responsibility:* Safely updates configuration values.
  - *Depends on:* A dictionary of configuration keys and values.
  - *Connects to:* `app.config`.
  - *Shape:* Configuration mutator.

- **`g`**
  - *What it is:* A Flask global namespace object for holding request-specific data.
  - *Implementation:* An instance of `_AppCtxGlobals`.
  - *Its use:* Used to store the database connection during a request.
  - *Type:* Global object proxy.
  - *Responsibility:* Provides a temporary namespace for data during an application context.
  - *Depends on:* An active application context.
  - *Connects to:* Request lifecycle.
  - *Shape:* Request-scoped storage.

- **`Flask.teardown_appcontext`**
  - *What it is:* Decorator to register a function to run when the application context ends.
  - *Implementation:* `def teardown_appcontext(self, f)`
  - *Its use:* Used to ensure the database connection is closed at the end of each request.
  - *Type:* Method decorator.
  - *Responsibility:* Registers cleanup tasks.
  - *Depends on:* A function to execute.
  - *Connects to:* The end of the application context lifecycle.
  - *Shape:* Lifecycle hook.


## Concept Unit: The capstone application
### The Problem
We need a concrete definition of what we are building and the tools required to build it.
What are the necessary components of an authenticated web application? If we want live search and partial page updates, what frontend tools should we use?

### Introduce the concept in isolation
```python
# Capstone: Authenticated Notes App
# Features:
# - User registration with email and password (argon2)
# - Login / logout / remember me
# - Create, read, update, delete notes (per-user)
# - Live search with HTMX (hx-get + debounce)
# - Pagination
# - Flash messages and error handling
# - Security headers, CSRF protection
# Tech stack:
# Python 3.12, Flask 3, SQLite3, HTMX 2 (CDN), Jinja2
# pip install flask argon2-cffi python-dotenv

stack = {
    'language':  'Python 3.12',
    'framework': 'Flask 3',
    'database':  'SQLite3 (stdlib)',
    'frontend':  'HTMX 2 via CDN + minimal CSS',
    'auth':      'argon2-cffi + Flask sessions',
    'config':    'python-dotenv (.env file)',
}
for k, v in stack.items():
    print(f'{k:12}: {v}')
print()
print('Install: pip install flask argon2-cffi python-dotenv')
```
This script isolates the planning step by printing out the exact technical stack and feature list we will use. We use a Python **dictionary** to store and display the stack.

### Discard the throwaway
This planning script is a throwaway and will not be part of the final project.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are starting a new capstone project.
- **Files affected:** None yet.
- **Change type:** Planning.
- **Location:** N/A
- **Dependencies:** None.

### The New Code
```python
# No actual project code is written in this unit; we are establishing the design.
```

### The Updated Project
No project code has been added yet.

### Mechanical walkthrough
- The `stack` variable is assigned a dictionary containing our technology choices.
- A `for` loop iterates over `stack.items()`, unpacking the keys and values.
- An `f-string` formats the output, padding the key to 12 characters (`{k:12}`) for alignment.
- The `print` function outputs the formatted string.

### CS lens
Designing a system's architecture before implementation is a core principle of software engineering. By defining the stack (Python, Flask, SQLite, HTMX), we fix the boundaries of our system and the interfaces between components.

### SE lens
Documenting the stack and required dependencies (`pip install flask argon2-cffi python-dotenv`) ensures the project can be reliably reproduced by other developers or deployed to a server.

### Commands needed
Run: `python app.py`

### Run it
Predicted output:
```
language    : Python 3.12
framework   : Flask 3
database    : SQLite3 (stdlib)
frontend    : HTMX 2 via CDN + minimal CSS
auth        : argon2-cffi + Flask sessions
config      : python-dotenv (.env file)

Install: pip install flask argon2-cffi python-dotenv
```

### One sentence connecting to previous unit
Now that we know the tech stack and the features required, we must design the data models that will support them.


## Concept Unit: Database schema
### The Problem
We need a structured way to store users and their notes.
How do we ensure that usernames and emails are unique? How do we link notes to the user who created them, and ensure those notes are deleted if the user is removed?

### Introduce the concept in isolation
```python
SCHEMA_SQL = '''
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'user',
    created       TEXT    DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notes (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title   TEXT    NOT NULL,
    body    TEXT    NOT NULL DEFAULT '',
    created TEXT    DEFAULT (datetime('now')),
    updated TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(user_id, created DESC);
'''
import sqlite3
con = sqlite3.connect(':memory:')
con.executescript(SCHEMA_SQL)
con.commit()
tables = con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print('Tables created:', [t[0] for t in tables])
indexes = con.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()
print('Indexes:', [i[0] for i in indexes])
```
This isolates the database schema in an in-memory SQLite database, proving the tables and indexes are created successfully without needing a file on disk.

### Discard the throwaway
This script is a throwaway to verify our SQL syntax and will not be used in the final project.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are defining the database schema.
- **Files affected:** `schema.sql` (created)
- **Change type:** Add.
- **Location:** Entire file.
- **Dependencies:** None.

### The New Code
```sql
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'user',
    created       TEXT    DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notes (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title   TEXT    NOT NULL,
    body    TEXT    NOT NULL DEFAULT '',
    created TEXT    DEFAULT (datetime('now')),
    updated TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(user_id, created DESC);
```

### The Updated Project
```sql
1: CREATE TABLE IF NOT EXISTS users (
2:     id            INTEGER PRIMARY KEY AUTOINCREMENT,
3:     username      TEXT    NOT NULL UNIQUE,
4:     email         TEXT    NOT NULL UNIQUE,
5:     password_hash TEXT    NOT NULL,
6:     role          TEXT    NOT NULL DEFAULT 'user',
7:     created       TEXT    DEFAULT (datetime('now'))
8: );
9: CREATE TABLE IF NOT EXISTS notes (
10:     id      INTEGER PRIMARY KEY AUTOINCREMENT,
11:     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
12:     title   TEXT    NOT NULL,
13:     body    TEXT    NOT NULL DEFAULT '',
14:     created TEXT    DEFAULT (datetime('now')),
15:     updated TEXT    DEFAULT (datetime('now'))
16: );
17: CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
18: CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(user_id, created DESC);
```
This schema defines two tables with a foreign key relationship and indexes for fast querying.

### Mechanical walkthrough
- `CREATE TABLE IF NOT EXISTS users` creates the `users` table if it isn't already present.
- `id INTEGER PRIMARY KEY AUTOINCREMENT` makes `id` the primary key, automatically incrementing.
- `username` and `email` are marked `UNIQUE`, ensuring no duplicate accounts.
- `password_hash` stores the argon2 hashed password.
- In the `notes` table, `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE` creates a foreign key to the `users` table. `ON DELETE CASCADE` means deleting a user automatically deletes their notes.
- `CREATE INDEX` creates indexes on `user_id` and a composite index on `user_id, created DESC` to optimize queries filtering by user and sorting by date.

### CS lens
Relational databases rely on normalization and constraints (like `UNIQUE` and `FOREIGN KEY`) to maintain data integrity. Indexes are specialized data structures (typically B-trees) maintained by the database engine to speed up lookups at the cost of slower writes.

### SE lens
Defining the schema in a standalone SQL file is a standard practice for maintaining database state. It allows the schema to be version-controlled and run to initialize new environments cleanly.

### Commands needed
Run: `python app.py`

### Run it
Predicted output:
```
Tables created: ['users', 'notes']
Indexes: ['idx_notes_user_id', 'idx_notes_created']
```

### One sentence connecting to previous unit
With the database schema established, we now need to map out the HTTP routes that will interact with this data.


## Concept Unit: Route map
### The Problem
We need to define every URL endpoint our application will expose.
What happens when a user submits the registration form? Which endpoints need to return full HTML pages, and which ones return HTMX partial fragments?

### Introduce the concept in isolation
```python
# Full route map for the capstone app:
routes = [
    # Auth:
    ('GET',    '/register',            'Show registration form'),
    ('POST',   '/register',            'Process registration'),
    ('GET',    '/login',               'Show login form'),
    ('POST',   '/login',               'Process login'),
    ('POST',   '/logout',              'Log out and clear session'),
    # Notes (all require login):
    ('GET',    '/notes',               'List notes (paginated, searchable)'),
    ('GET',    '/notes/new',           'Show new note form'),
    ('POST',   '/notes',               'Create note'),
    ('GET',    '/notes/<id>',          'Show single note'),
    ('GET',    '/notes/<id>/edit',     'Show edit form'),
    ('POST',   '/notes/<id>/edit',     'Update note'),
    ('DELETE', '/notes/<id>',          'Delete note (HTMX hx-delete)'),
    # HTMX partials:
    ('GET',    '/notes/search',        'Live search fragment (hx-get)'),
    ('GET',    '/notes/<id>/edit-inline', 'Inline edit form fragment'),
    # Misc:
    ('GET',    '/',                    'Redirect to /notes or /login'),
]
for method, path, desc in routes:
    print(f'{method:6} {path:35} {desc}')
```
This isolates the planning of our application's routes by printing out a list of tuples representing HTTP methods, paths, and their purpose.

### Discard the throwaway
This script is a throwaway design artifact and will not be included in the project source code.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are outlining the route map.
- **Files affected:** None yet.
- **Change type:** Planning.
- **Location:** N/A
- **Dependencies:** None.

### The New Code
```python
# No actual project code is written in this unit; we are establishing the route map.
```

### The Updated Project
No project code has been added yet.

### Mechanical walkthrough
- A list named `routes` is created, holding tuples of `(method, path, description)`.
- A `for` loop unpacks each tuple into `method`, `path`, and `desc`.
- An `f-string` pads the method to 6 characters and the path to 35 characters to align the output in columns.
- The `print` function outputs the resulting string.

### CS lens
RESTful API design conventions use HTTP methods to indicate intent: GET for reading data, POST for creating or modifying data, and DELETE for removal. Our route map follows this mapping directly.

### SE lens
Mapping out all routes and their HTTP verbs before writing handlers prevents route collisions and ensures all necessary CRUD (Create, Read, Update, Delete) operations and HTMX endpoints are accounted for.

### Commands needed
Run: `python app.py`

### Run it
Predicted output:
```
GET    /register                           Show registration form
POST   /register                           Process registration
GET    /login                              Show login form
POST   /login                              Process login
POST   /logout                             Log out and clear session
GET    /notes                              List notes (paginated, searchable)
GET    /notes/new                          Show new note form
POST   /notes                              Create note
GET    /notes/<id>                         Show single note
GET    /notes/<id>/edit                    Show edit form
POST   /notes/<id>/edit                    Update note
DELETE /notes/<id>                         Delete note (HTMX hx-delete)
GET    /notes/search                       Live search fragment (hx-get)
GET    /notes/<id>/edit-inline             Inline edit form fragment
GET    /                                   Redirect to /notes or /login
```

### One sentence connecting to previous unit
Having mapped out the URLs, we now need a Flask application capable of serving them and connecting to our database.


## Concept Unit: Application factory and configuration
### The Problem
We need to initialize our Flask application and safely load secrets.
How do we keep our `SECRET_KEY` and database credentials out of version control while making them available to Flask, and how do we ensure the database connection closes safely after every request?

### Introduce the concept in isolation
```python
import os, sqlite3
from dotenv import load_dotenv
from flask import Flask, g

load_dotenv()

def create_app(test_config=None):
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'dev-insecure-please-change'),
        DATABASE=os.environ.get('DATABASE_URL', 'app.db'),
        DEBUG=os.environ.get('DEBUG', 'false').lower() == 'true',
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
        SESSION_COOKIE_SECURE=False,  # True in production (HTTPS)
    )
    if test_config:
        app.config.from_mapping(test_config)

    def get_db():
        if 'db' not in g:
            g.db = sqlite3.connect(app.config['DATABASE'], detect_types=sqlite3.PARSE_DECLTYPES)
            g.db.row_factory = sqlite3.Row
            g.db.execute('PRAGMA foreign_keys = ON')
            g.db.execute('PRAGMA journal_mode = WAL')
        return g.db

    @app.teardown_appcontext
    def close_db(e=None):
        db = g.pop('db', None)
        if db:
            db.close()

    app.get_db = get_db  # attach for use in blueprints
    return app

print('Application factory: create_app() called once at startup')
print('test_config: override DATABASE=":memory:" in tests')
```
This isolates the Flask application factory pattern. It demonstrates loading environment variables and setting up database connection management tied to the request lifecycle.

### Discard the throwaway
This script is a throwaway version of the core app setup to prove the application factory works.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are creating the application skeleton.
- **Files affected:** `app.py` (created)
- **Change type:** Add.
- **Location:** Entire file.
- **Dependencies:** `flask`, `python-dotenv`.

### The New Code
```python
import os, sqlite3
from dotenv import load_dotenv
from flask import Flask, g

load_dotenv()

def create_app(test_config=None):
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'dev-insecure-please-change'),
        DATABASE=os.environ.get('DATABASE_URL', 'app.db'),
        DEBUG=os.environ.get('DEBUG', 'false').lower() == 'true',
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
        SESSION_COOKIE_SECURE=False,
    )
    if test_config:
        app.config.from_mapping(test_config)

    def get_db():
        if 'db' not in g:
            g.db = sqlite3.connect(app.config['DATABASE'], detect_types=sqlite3.PARSE_DECLTYPES)
            g.db.row_factory = sqlite3.Row
            g.db.execute('PRAGMA foreign_keys = ON')
            g.db.execute('PRAGMA journal_mode = WAL')
        return g.db

    @app.teardown_appcontext
    def close_db(e=None):
        db = g.pop('db', None)
        if db:
            db.close()

    app.get_db = get_db
    return app
```

### The Updated Project
```python
1: import os, sqlite3
2: from dotenv import load_dotenv
3: from flask import Flask, g
4: 
5: load_dotenv()
6: 
7: def create_app(test_config=None):
8:     app = Flask(__name__, template_folder='templates', static_folder='static')
9:     app.config.from_mapping(
10:         SECRET_KEY=os.environ.get('SECRET_KEY', 'dev-insecure-please-change'),
11:         DATABASE=os.environ.get('DATABASE_URL', 'app.db'),
12:         DEBUG=os.environ.get('DEBUG', 'false').lower() == 'true',
13:         SESSION_COOKIE_HTTPONLY=True,
14:         SESSION_COOKIE_SAMESITE='Lax',
15:         SESSION_COOKIE_SECURE=False,
16:     )
17:     if test_config:
18:         app.config.from_mapping(test_config)
19: 
20:     def get_db():
21:         if 'db' not in g:
22:             g.db = sqlite3.connect(app.config['DATABASE'], detect_types=sqlite3.PARSE_DECLTYPES)
23:             g.db.row_factory = sqlite3.Row
24:             g.db.execute('PRAGMA foreign_keys = ON')
25:             g.db.execute('PRAGMA journal_mode = WAL')
26:         return g.db
27: 
28:     @app.teardown_appcontext
29:     def close_db(e=None):
30:         db = g.pop('db', None)
31:         if db:
32:             db.close()
33: 
34:     app.get_db = get_db
35:     return app
```
The application factory function `create_app` sets up configuration and database management, ensuring connections are closed at the end of each request.

### Mechanical walkthrough
- `load_dotenv()` reads a `.env` file into `os.environ`.
- `create_app` instantiates `Flask(__name__)`, specifying template and static folder paths.
- `app.config.from_mapping` sets internal Flask variables securely. `os.environ.get` retrieves environment variables, providing fallback defaults.
- `get_db` checks the `g` object for an existing `db` connection. If none exists, it creates one using `sqlite3.connect`.
- `sqlite3.Row` configures the connection to return rows that act like dictionaries, allowing access by column name.
- `PRAGMA foreign_keys = ON` enforces the foreign key constraints we defined in our schema.
- `@app.teardown_appcontext` registers `close_db` to run at the end of every request. `g.pop('db', None)` safely retrieves and removes the connection, closing it if it exists.
- `app.get_db = get_db` attaches the function to the app object, making it accessible later when we split routes into blueprints.

### CS lens
The Application Factory pattern is a structural design pattern. Instead of creating a global application instance, a function creates it. This allows multiple instances of the app to exist simultaneously, which is essential for isolated testing (e.g., passing a `test_config` with an in-memory database).

### SE lens
Managing external resources (like database connections) within the request lifecycle prevents resource leaks. Attaching the connection to the `g` object ensures that a single request reuses the same connection, avoiding the overhead of opening multiple connections per request.

### Commands needed
Run: `python app.py`

### Run it
Predicted output:
```
Application factory: create_app() called once at startup
test_config: override DATABASE=":memory:" in tests
```

### One sentence connecting to previous unit
To keep our code organized as the application grows, we will use a structured project layout separating routes, templates, and configurations.


## Concept Unit: Project file structure
### The Problem
We need an organized directory layout for our capstone project.
If we put all routes, models, and HTML in one file, it becomes unmaintainable. How do we separate concerns so templates, static assets, and Python modules live in distinct locations?

### Introduce the concept in isolation
```python
# Capstone project structure:
structure = '''
capstone/
    app.py              # create_app(), register blueprints
    .env                # SECRET_KEY, DATABASE_URL (not in git)
    .env.example        # template (in git)
    .gitignore          # includes: .env, app.db, __pycache__/
    requirements.txt    # flask, argon2-cffi, python-dotenv
    schema.sql          # SQL schema (run once with flask init-db)
    templates/
        base.html       # <html>, <head>, <nav>, HTMX script, flash messages
        auth/
            login.html
            register.html
        notes/
            list.html   # paginated note list
            form.html   # create / edit form
            detail.html # single note view
            _note.html  # note card partial (used by HTMX swaps)
    static/
        style.css       # minimal CSS
    auth/
        __init__.py     # auth Blueprint
        routes.py       # /register, /login, /logout
        helpers.py      # get_db, validate_*, login_required
    notes/
        __init__.py     # notes Blueprint
        routes.py       # /notes/* routes
        repository.py   # NoteRepository class (SQL in one place)
'''
print(structure)
print('Single app.py (simpler): all routes in one file for learning purposes')
print('Blueprint split (better for real projects): auth/ and notes/ packages')
```
This isolates the project structure planning, printing a tree representation of where files will eventually reside.

### Discard the throwaway
This planning layout is a throwaway visualization and will not be executed as code in the project.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are outlining project architecture.
- **Files affected:** None yet.
- **Change type:** Planning.
- **Location:** N/A
- **Dependencies:** None.

### The New Code
```python
# No actual project code is written in this unit; we are establishing the file structure.
```

### The Updated Project
No project code has been added yet.

### Mechanical walkthrough
- `base.html` serves as the master template containing common `<html>` and `<head>` tags, including the HTMX CDN script.
- `_note.html` is prefixed with an underscore to denote it as a partial fragment, used specifically for HTMX swaps.
- `requirements.txt` defines our external dependencies.
- `.env` holds secrets and is strictly ignored in version control via `.gitignore`, while `.env.example` provides a template.
- Python logic is split into `auth/` and `notes/` directories. Using Flask blueprints in these modules allows for better organization in larger projects, isolating routes and logic by feature.

### CS lens
Separation of Concerns is a foundational architectural principle. By decoupling data logic (`schema.sql`, `repository.py`), view presentation (`templates/`), and routing/control (`routes.py`), each layer can be modified independently.

### SE lens
File naming conventions and directory structures communicate intent to other developers. Placing secrets in `.env` and ignoring them via `.gitignore` prevents critical security breaches.

### Commands needed
Run: `python app.py`

### Run it
Predicted output:
```
capstone/
    app.py              # create_app(), register blueprints
    .env                # SECRET_KEY, DATABASE_URL (not in git)
    .env.example        # template (in git)
    .gitignore          # includes: .env, app.db, __pycache__/
    requirements.txt    # flask, argon2-cffi, python-dotenv
    schema.sql          # SQL schema (run once with flask init-db)
    templates/
        base.html       # <html>, <head>, <nav>, HTMX script, flash messages
        auth/
            login.html
            register.html
        notes/
            list.html   # paginated note list
            form.html   # create / edit form
            detail.html # single note view
            _note.html  # note card partial (used by HTMX swaps)
    static/
        style.css       # minimal CSS
    auth/
        __init__.py     # auth Blueprint
        routes.py       # /register, /login, /logout
        helpers.py      # get_db, validate_*, login_required
    notes/
        __init__.py     # notes Blueprint
        routes.py       # /notes/* routes
        repository.py   # NoteRepository class (SQL in one place)

Single app.py (simpler): all routes in one file for learning purposes
Blueprint split (better for real projects): auth/ and notes/ packages
```

### One sentence connecting to previous unit
With our full application architecture planned out, we are now ready to begin writing the implementation in the upcoming lessons.

## Closing
### Connect the pieces
In this lesson, we established the full foundational design for the capstone project. By defining the database schema, mapping the HTTP routes, scaffolding the application factory, and structuring the file layout, we have created a complete blueprint. Every subsequent lesson will build one specific piece of this design until the entire authenticated, HTMX-powered application is complete.
