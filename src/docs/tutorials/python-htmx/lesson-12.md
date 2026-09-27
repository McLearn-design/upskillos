# Lesson 12: Database Connections in Flask — g, teardown_appcontext, and get_db()

What you will build
In this lesson, you will build the database connection management for a Flask application. You will learn how to open a database connection on demand during a request, store it safely in Flask's per-request global context (`g`), and guarantee its closure at the end of the request using `teardown_appcontext`, preventing connection leaks. You will also build a CLI command to initialize the database schema.

What you need to know first
- Python 3.12 syntax
- Flask basics (routing, applications)
- SQLite basics (tables, queries)

Terms used in this lesson
- **Application Context** — A per-request namespace in Flask used for storing resources like database connections that live exactly as long as one HTTP request. It isolates state between concurrent requests.
- **Connection Leak** — A failure to close a database connection after use, exhausting the pool of available connections and eventually crashing the application.
- **Lazy Initialization** — A pattern where a resource (like a database connection) is created only at the exact moment it is first requested, rather than upfront.
- **Write-Ahead Log (WAL)** — An SQLite journaling mode that improves concurrency by allowing readers to proceed while a write is occurring.
- **Foreign Key Constraint** — A database rule enforcing that a reference from one table to another must point to an existing row. In SQLite, this is off by default and must be explicitly enabled per connection.

Objects and methods used
- **`Flask`**
  - *What it is:* The central application object in the Flask framework.
  - *Implementation:* `class Flask`
  - *Its use:* Acts as the registry for routes, configuration, and context teardown hooks.
  - *Type:* Class
  - *Responsibility:* Manages the lifecycle of the web application and dispatches incoming HTTP requests to the correct view functions.
  - *Depends on:* The name of the application module (`__name__`).
  - *Connects to:* WSGI servers, view functions.
  - *Shape:* The core framework boundary.
- **`g`**
  - *What it is:* Flask's global namespace for storing per-request data.
  - *Implementation:* `flask.g` proxy object.
  - *Its use:* Used to store the active database connection for the current request.
  - *Type:* Context Local Proxy
  - *Responsibility:* Provides a safe place to store data that must be shared across functions within a single request without passing it explicitly, while ensuring it does not bleed into other requests.
  - *Depends on:* An active application or request context.
  - *Connects to:* Application code needing request-scoped data.
  - *Shape:* A thread-local global variable.
- **`sqlite3.connect`**
  - *What it is:* The standard library function to open a connection to an SQLite database file.
  - *Implementation:* `def connect(database, timeout=5.0, detect_types=0, isolation_level='DEFERRED', check_same_thread=True, factory=Connection, cached_statements=128, uri=False)`
  - *Its use:* Opens the physical connection to `app.db`.
  - *Type:* Function
  - *Responsibility:* Establishes communication with the SQLite database file and returns a Connection object.
  - *Depends on:* A file path or `:memory:`.
  - *Connects to:* The filesystem, SQLite library.
  - *Shape:* Resource allocator.
- **`sqlite3.Row`**
  - *What it is:* A specialized row factory for SQLite connections.
  - *Implementation:* `class Row`
  - *Its use:* Assigned to `db.row_factory` to return dictionary-like objects instead of plain tuples from queries.
  - *Type:* Class
  - *Responsibility:* Wraps query result tuples to provide both index-based and name-based access to columns.
  - *Depends on:* An executed query's results.
  - *Connects to:* The `Connection`'s `row_factory` attribute.
  - *Shape:* Data transformation layer.
- **`app.teardown_appcontext`**
  - *What it is:* A decorator for registering a function to run at the end of the request context.
  - *Implementation:* `@app.teardown_appcontext`
  - *Its use:* Registers `close_db` to ensure the database connection is closed after every request.
  - *Type:* Method (used as decorator)
  - *Responsibility:* Guarantees execution of cleanup code when the application context pops, regardless of whether the request succeeded or raised an exception.
  - *Depends on:* A callable to register.
  - *Connects to:* Flask's request lifecycle.
  - *Shape:* Lifecycle hook boundary.
- **`current_app`**
  - *What it is:* A proxy to the Flask application handling the current request or context.
  - *Implementation:* `flask.current_app` proxy object.
  - *Its use:* Allows access to `app.config` inside functions (like CLI commands) that don't have the `app` object directly in scope.
  - *Type:* Context Local Proxy
  - *Responsibility:* Points to the correct Flask application instance dynamically.
  - *Depends on:* An active application context.
  - *Connects to:* Configuration, application state.
  - *Shape:* Framework proxy.
- **`app.cli.command`**
  - *What it is:* A decorator to register a custom command with the `flask` CLI tool.
  - *Implementation:* `@app.cli.command(name)`
  - *Its use:* Registers `init-db` as a command line utility.
  - *Type:* Method (used as decorator)
  - *Responsibility:* Exposes a Python function as a terminal command.
  - *Depends on:* Click (the underlying CLI library used by Flask).
  - *Connects to:* Terminal input/output.
  - *Shape:* CLI entry point.
- **`with_appcontext`**
  - *What it is:* A decorator that automatically pushes a Flask application context when a CLI command runs.
  - *Implementation:* `@with_appcontext`
  - *Its use:* Wraps the `init_db_command` so it can access `current_app` and `get_db()`.
  - *Type:* Decorator function
  - *Responsibility:* Sets up the environment required for Flask context-dependent code to run outside of an HTTP request.
  - *Depends on:* An application instance being discoverable by the CLI.
  - *Connects to:* CLI commands, application context stack.
  - *Shape:* Context manager wrapper.

## Concept Unit: Flask's application context and g

### The Problem
If we store database connections in a standard global variable, requests running concurrently might overwrite or close each other's connections. How do we store a variable that acts like a global but is strictly isolated to a single HTTP request?

### Introduce the concept in isolation
```python
from flask import Flask, g
app = Flask(__name__)

@app.route('/')
def index():
    if not hasattr(g, 'request_count'):
        g.request_count = 0
    g.request_count += 1
    print(f'g.request_count this request: {g.request_count}')
    return '<p>Hello</p>'

with app.app_context():
    g.test = 'hello'
    print('g.test in context:', g.test)
```
Output proves: `g` is created fresh for each request. It acts as a namespace proxy that stores state securely scoped to the current context.

### Discard the throwaway
This route and context test are deleted and will not appear in the project again.

### Project Change
- **Reference Source**: No reference counterpart — this is a from-scratch addition because we are initializing our database module.
- **Files affected**: Created `db.py`.
- **Change type**: Add.
- **Location**: Top of `db.py`.
- **Dependencies**: None.

### The New Code
```python
from flask import g, current_app

# g will be used here shortly
```

### The Updated Project
```python
# 1: from flask import g, current_app
# 2: 
# 3: # g will be used here shortly
```
The file is set up with the imports we need for context management.

### Mechanical walkthrough
- `from flask import g`: Imports the global proxy object for per-request state.
- `from flask import current_app`: Imports the proxy to the active Flask application.

### CS lens
Thread-local storage (which `g` builds upon) solves the problem of global state in concurrent environments by providing a separate instance of the global variable for each executing thread or context, ensuring thread safety without locking.

### SE lens
Using context-local proxies like `g` prevents tightly coupling our database logic to the request object. We don't have to pass a `request` object down through every function call just to access shared state.

### Commands needed
None yet.

### Run it
No execution needed for this skeleton setup.

### One sentence connecting to previous unit
Now that we have a place to store per-request data, we need a way to populate it with a database connection.

## Concept Unit: get_db() — lazy connection on first use

### The Problem
Opening a database connection takes time and resources. If we open it at the start of every request, we waste resources on requests that don't even need the database. How do we open it only when needed, but ensure we don't accidentally open it multiple times in a single request?

### Introduce the concept in isolation
```python
import sqlite3
from flask import Flask, g

app = Flask(__name__)
app.config['DATABASE'] = 'app.db'

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(
            app.config['DATABASE'],
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA journal_mode=WAL')
        g.db.execute('PRAGMA foreign_keys=ON')
    return g.db

with app.app_context():
    print('get_db() type:', type(get_db()))
    print('Same object on 2nd call:', get_db() is get_db())
```
Output proves: `get_db()` returns an SQLite connection, and subsequent calls in the same context return the *exact same* object without re-opening.

### Discard the throwaway
This throwaway script is deleted and will not appear in the project again.

### Project Change
- **Reference Source**: No reference counterpart.
- **Files affected**: Modified `db.py`.
- **Change type**: Add.
- **Location**: Below imports.
- **Dependencies**: `sqlite3`.

### The New Code
```python
import sqlite3

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(
            current_app.config['DATABASE'],
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA journal_mode=WAL')
        g.db.execute('PRAGMA foreign_keys=ON')
    return g.db
```

### The Updated Project
```python
# 1: import sqlite3
# 2: from flask import g, current_app
# 3: 
# 4: def get_db(): # ← new
# 5:     if 'db' not in g: # ← new
# 6:         g.db = sqlite3.connect( # ← new
# 7:             current_app.config['DATABASE'], # ← new
# 8:             detect_types=sqlite3.PARSE_DECLTYPES # ← new
# 9:         ) # ← new
# 10:        g.db.row_factory = sqlite3.Row # ← new
# 11:        g.db.execute('PRAGMA journal_mode=WAL') # ← new
# 12:        g.db.execute('PRAGMA foreign_keys=ON') # ← new
# 13:    return g.db # ← new
```
We now have a lazy-loading function that provides a configured database connection.

### Mechanical walkthrough
- `if 'db' not in g:`: Checks if the namespace already holds a connection.
- `g.db = sqlite3.connect(...)`: Opens the connection and assigns it to `g.db`.
- `current_app.config['DATABASE']`: Accesses the database path dynamically from the current app.
- `g.db.row_factory = sqlite3.Row`: Configures results to behave like dictionaries.
- `PRAGMA journal_mode=WAL`: Enables Write-Ahead Logging for better concurrency.
- `PRAGMA foreign_keys=ON`: Enforces relational constraints.
- `return g.db`: Returns the connection.

### CS lens
This is the Singleton pattern scoped to a request. It ensures exactly one instance of a resource exists per context, avoiding the overhead of redundant instantiations.

### SE lens
Lazy initialization ("lazy loading") improves performance by deferring expensive work until it is absolutely required. A request that hits a cached template will never trigger the `sqlite3.connect` call.

### Commands needed
None yet.

### Run it
No execution needed until integrated with a route.

### One sentence connecting to previous unit
Opening connections efficiently is good, but failing to close them is a critical bug, which we must fix next.

## Concept Unit: teardown_appcontext — guaranteed cleanup

### The Problem
If our view function crashes and raises an exception, standard closing logic at the end of the route might be skipped, leaving the connection open. How do we guarantee the connection closes no matter how the request ends?

### Introduce the concept in isolation
```python
import sqlite3
from flask import Flask, g

app = Flask(__name__)
app.config['DATABASE'] = 'app.db'

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
    return g.db

@app.teardown_appcontext
def close_db(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()
        print('DB connection closed.')
    if exception:
        print(f'Request ended with exception: {exception}')

@app.route('/maybe-crash')
def maybe_crash():
    db = get_db()
    raise RuntimeError('Oops!')
```
Output proves: Even when `RuntimeError` is raised, `teardown_appcontext` fires and `db.close()` is executed, preventing a leak.

### Discard the throwaway
This throwaway script is deleted and will not appear in the project again.

### Project Change
- **Reference Source**: No reference counterpart.
- **Files affected**: Modified `db.py`.
- **Change type**: Add.
- **Location**: Below `get_db()`.
- **Dependencies**: None.

### The New Code
```python
def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()
```

### The Updated Project
```python
# ... (get_db implementation)
# 14: def close_db(e=None): # ← new
# 15:     db = g.pop('db', None) # ← new
# 16:     if db is not None: # ← new
# 17:         db.close() # ← new
```
We defined the cleanup function, though we still need to register it with the app.

### Mechanical walkthrough
- `def close_db(e=None)`: Takes an optional exception argument `e` passed by Flask if a crash occurred.
- `g.pop('db', None)`: Removes `db` from `g` and returns it, or returns `None` if it was never set.
- `if db is not None:`: Checks if a connection was actually opened during this request.
- `db.close()`: Closes the SQLite connection.

### CS lens
Resource acquisition is initialization (RAII) principles apply here: resources acquired during a lifecycle phase must have deterministic release mechanisms tied to the end of that phase.

### SE lens
Relying on framework hooks for teardown centralizes cleanup logic. It removes the burden of writing `finally: db.close()` blocks in every single route function.

### Commands needed
None yet.

### Run it
No execution needed.

### One sentence connecting to previous unit
With connection lifecycle management handled, we need a way to initialize the actual database schema.

## Concept Unit: init_db — schema initialization

### The Problem
We have a connection, but the SQLite file is empty. We need to create our tables for users and notes safely, without throwing errors if they already exist.

### Introduce the concept in isolation
```python
import sqlite3

db = sqlite3.connect(':memory:')
SCHEMA = '''
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE
);
'''
db.executescript(SCHEMA)
db.commit()
print('Tables created.')
```
Output proves: `executescript` can run a block of SQL to define schema. The `IF NOT EXISTS` clause makes it safe to run multiple times.

### Discard the throwaway
This script is deleted and will not appear in the project again.

### Project Change
- **Reference Source**: No reference counterpart.
- **Files affected**: Modified `db.py`.
- **Change type**: Add.
- **Location**: Below `close_db()`.
- **Dependencies**: None.

### The New Code
```python
def init_db():
    db = get_db()
    with current_app.open_resource('schema.sql') as f:
        db.executescript(f.read().decode('utf8'))
```
*(Assuming `schema.sql` contains our SCHEMA script).*

### The Updated Project
```python
# ... (close_db implementation)
# 18: def init_db(): # ← new
# 19:     db = get_db() # ← new
# 20:     with current_app.open_resource('schema.sql') as f: # ← new
# 21:         db.executescript(f.read().decode('utf8')) # ← new
```
The initialization logic is in place to read and execute our schema file.

### Mechanical walkthrough
- `db = get_db()`: Grabs a connection using our existing lazy-loader.
- `current_app.open_resource('schema.sql')`: Safely locates a file bundled with the Flask app package.
- `db.executescript(...)`: Executes the multiple SQL statements found in the decoded file contents.

### CS lens
Idempotency is the property that an operation can be applied multiple times without changing the result beyond the initial application. `CREATE TABLE IF NOT EXISTS` makes schema initialization idempotent.

### SE lens
Separating schema definitions into `.sql` files rather than embedding them as Python strings keeps syntax highlighting intact and separates database concerns from application logic.

### Commands needed
None yet.

### Run it
No execution needed.

### One sentence connecting to previous unit
We have the function to initialize the database, but we need a convenient way to trigger it from the terminal.

## Concept Unit: Flask CLI command for db init

### The Problem
We don't want to run `init_db()` automatically every time the server starts; we only want to run it on demand when setting up the project. How do we expose this Python function to the command line?

### Introduce the concept in isolation
```python
import click
from flask import Flask
from flask.cli import with_appcontext

app = Flask(__name__)

@app.cli.command('hello')
@with_appcontext
def hello_command():
    click.echo('Hello from the CLI!')

# Run via: flask hello
```
Output proves: `@app.cli.command` exposes functions to the `flask` command line tool, and `click.echo` prints to the terminal.

### Discard the throwaway
This script is deleted and will not appear in the project again.

### Project Change
- **Reference Source**: No reference counterpart.
- **Files affected**: Modified `db.py`.
- **Change type**: Add.
- **Location**: Below `init_db()`.
- **Dependencies**: `click`, `with_appcontext`.

### The New Code
```python
import click
from flask.cli import with_appcontext

@click.command('init-db')
@with_appcontext
def init_db_command():
    """Clear the existing data and create new tables."""
    init_db()
    click.echo('Initialized the database.')
```

### The Updated Project
```python
# 1: import sqlite3
# 2: import click # ← new
# 3: from flask import g, current_app
# 4: from flask.cli import with_appcontext # ← new
# ...
# 22: @click.command('init-db') # ← new
# 23: @with_appcontext # ← new
# 24: def init_db_command(): # ← new
# 25:     """Clear the existing data and create new tables.""" # ← new
# 26:     init_db() # ← new
# 27:     click.echo('Initialized the database.') # ← new
```
We wrapped our internal logic in a CLI command for easy access.

### Mechanical walkthrough
- `@click.command('init-db')`: Registers the function as a command named `init-db`.
- `@with_appcontext`: Automatically pushes a Flask application context so `current_app` and `g` function correctly even outside an HTTP request.
- `init_db()`: Calls our schema initialization function.
- `click.echo(...)`: Prints a success message to the terminal safely.

### CS lens
Command Line Interfaces act as the control plane for applications, allowing administrative tasks to be executed out-of-band without interfering with the data plane (the web server handling user requests).

### SE lens
Using the framework's native CLI integration (rather than writing standalone `scripts/` Python files) ensures that the administrative command boots up the exact same configuration, environment, and dependencies as the web server.

### Commands needed
Run: `python app.py` (assuming integration is wired in app.py) or `flask --app your_app init-db`. 

### Run it
No execution needed here, as we are defining the module for later use.

### One sentence connecting to previous unit
This CLI command ties off our database connection management, readying it for use in our application.

## Closing

### Connect the pieces
We have built a robust, leak-free connection management system for Flask. When a user requests a route:
1. `get_db()` opens the SQLite connection and caches it in `g.db`.
2. The route executes its queries using this connection.
3. The response is generated.
4. Flask tears down the context, triggering `close_db()`, which safely closes the connection exactly once. 
Because `g` is isolated per-request, concurrent users never trample on each other's connections, and because `teardown_appcontext` always fires, even crashes won't cause connection leaks. Next, we will use this foundation to build our data models.
