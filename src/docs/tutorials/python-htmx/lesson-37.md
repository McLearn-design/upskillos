# Lesson 37: Capstone — Error Handling, Logging, and Flash Messages

**What you will build**
You will build robust error handling and logging into a Flask application. We will intercept raw exceptions, transforming them into friendly custom error pages for end users while simultaneously writing structured, traceable logs to the filesystem for developers. We will add one-shot flash messages to give users immediate feedback after actions, resulting in a production-ready application that never exposes internal tracebacks to the user.

**What you need to know first**
- Python Full-Stack with HTMX / Module 6

**Terms used in this lesson**
- **Exception** — An error that disrupts the normal flow of execution, requiring a handler to catch it; without one, the program crashes.
- **Traceback** — The full stack of function calls that led to an exception; vital for developers but a security risk if shown to end users.
- **`try` / `except`** — Python syntax for catching and handling exceptions directly where they occur.
- **`ZeroDivisionError`** — A built-in Python exception raised when division by zero is attempted; used here to intentionally trigger errors.
- **Middleware** — Code that runs before or after every request, letting you intercept and log traffic without modifying individual route views.
- **Flash message** — A temporary, one-shot notification stored in the user's session, shown on the next page load, and immediately cleared.
- **Jinja2 control blocks** — Template syntax like `{% for %}` that adds logic (loops and conditionals) directly into HTML.
- **`sqlite3.OperationalError`** — An exception raised by SQLite when a database operation fails, like querying a missing table.

**Objects and methods used**

**`Flask`**
- *What it is:* The central application object that registers routes, configuration, and error handlers.
- *Implementation:* `class Flask(import_name: str)`
- *Its use:* We use it to register application-wide error handlers and middleware.
- *Type:* Class
- *Responsibility:* Coordinates incoming requests, routes them to the correct view, and manages the application context.
- *Depends on:* An import name (usually `__name__`).
- *Connects to:* Receives requests from the WSGI server; calls view functions and error handlers.
- *Shape:* The outermost container of the web application framework.

**`@app.errorhandler`**
- *What it is:* A decorator that registers a function to handle a specific HTTP status code or exception type.
- *Implementation:* `def errorhandler(code_or_exception: int | Type[Exception])`
- *Its use:* We use it to catch 404, 403, and 500 errors and render friendly HTML instead of Flask's default text.
- *Type:* Decorator method on the Flask app instance.
- *Responsibility:* Maps specific error conditions to custom response-generating functions.
- *Depends on:* The specific integer status code or Exception class to catch.
- *Connects to:* Called by Flask's internal dispatch when a route raises an exception or aborts.
- *Shape:* Application-level configuration hook.

**`render_template_string`**
- *What it is:* A function that renders a Jinja2 template directly from a Python string rather than a file.
- *Implementation:* `def render_template_string(source: str, **context: Any) -> str`
- *Its use:* We use it to quickly render our error pages and flash message layouts inline.
- *Type:* Free function in the `flask` module.
- *Responsibility:* Parses and evaluates Jinja2 templates, interpolating variables into the text.
- *Depends on:* A string template and keyword arguments for the context variables.
- *Connects to:* Called by our view functions; passes the string to Jinja2's parser.
- *Shape:* Internal template rendering utility.

**`app.logger`**
- *What it is:* A standard Python `logging.Logger` instance attached to the Flask app.
- *Implementation:* `logger: logging.Logger`
- *Its use:* We use it to record debug, info, warning, and error messages during request processing.
- *Type:* Property on the Flask app instance.
- *Responsibility:* Provides a unified interface for writing log messages at various severity levels.
- *Depends on:* The application being initialized and optionally a configured logging setup.
- *Connects to:* Called by our views; sends records to configured `logging.Handler`s.
- *Shape:* Application-wide diagnostic tool.

**`logging.basicConfig`**
- *What it is:* A convenience function to configure the root logger's format and handlers.
- *Implementation:* `def basicConfig(**kwargs: Any)`
- *Its use:* We use it to route log messages to both `stderr` and a file (`app.log`), and set the format.
- *Type:* Free function in the `logging` module.
- *Responsibility:* Sets up default handlers, formatters, and level for the Python logging system.
- *Depends on:* Keyword arguments like `level`, `format`, and `handlers`.
- *Connects to:* Called during app initialization; modifies the global logging configuration.
- *Shape:* Global configuration entry point.

**`logging.StreamHandler`**
- *What it is:* A logging handler that writes log records to a stream, typically `sys.stderr`.
- *Implementation:* `class StreamHandler(stream: TextIO = None)`
- *Its use:* We use it to see logs in the terminal while running the app locally.
- *Type:* Class in the `logging` module.
- *Responsibility:* Formats and outputs log records to console streams.
- *Depends on:* Optionally, a stream (defaults to `sys.stderr`).
- *Connects to:* Receives records from the Logger; writes bytes to the OS standard error.
- *Shape:* Output destination for logs.

**`logging.FileHandler`**
- *What it is:* A logging handler that writes log records to a file on disk.
- *Implementation:* `class FileHandler(filename: str, mode: str = 'a')`
- *Its use:* We use it to persist logs to `app.log` for later debugging.
- *Type:* Class in the `logging` module.
- *Responsibility:* Opens a file and appends formatted log records to it.
- *Depends on:* A filename string.
- *Connects to:* Receives records from the Logger; writes bytes to the file system.
- *Shape:* Output destination for logs.

**`@app.before_request`**
- *What it is:* A decorator that registers a function to run before every incoming request.
- *Implementation:* `def before_request(f: Callable)`
- *Its use:* We use it to record the start time and log the incoming request path.
- *Type:* Decorator method on the Flask app instance.
- *Responsibility:* Injects pre-processing logic before route views are executed.
- *Depends on:* The view function it wraps.
- *Connects to:* Called by Flask during request dispatch, before the matched route.
- *Shape:* Request lifecycle hook.

**`@app.after_request`**
- *What it is:* A decorator that registers a function to run after every request, before the response is sent.
- *Implementation:* `def after_request(f: Callable)`
- *Its use:* We use it to calculate the request duration and log the final status code.
- *Type:* Decorator method on the Flask app instance.
- *Responsibility:* Injects post-processing logic and allows modification of the response.
- *Depends on:* The view function it wraps, and it must take and return a response object.
- *Connects to:* Called by Flask after the route view returns a response.
- *Shape:* Request lifecycle hook.

**`time.perf_counter`**
- *What it is:* A function that returns a high-resolution timestamp.
- *Implementation:* `def perf_counter() -> float`
- *Its use:* We use it to measure exactly how many milliseconds a request took to process.
- *Type:* Free function in the `time` module.
- *Responsibility:* Provides a monotonic clock for accurate short-duration timing.
- *Depends on:* The OS providing a high-resolution clock.
- *Connects to:* Called directly by our timing middleware.
- *Shape:* System utility.

**`g`**
- *What it is:* An object for storing data that needs to be shared across functions during a single request.
- *Implementation:* `g: _AppCtxGlobals`
- *Its use:* We use it to store the `start_time` in `before_request` so `after_request` can read it, and to store the database connection.
- *Type:* Global object in the `flask` module (proxy to request context).
- *Responsibility:* Acts as a temporary per-request storage container.
- *Depends on:* An active application context.
- *Connects to:* Read and written by middleware and view functions.
- *Shape:* Context-local state container.

**`request`**
- *What it is:* An object that encapsulates the HTTP request data sent by the client.
- *Implementation:* `request: Request`
- *Its use:* We use it to read `request.method`, `request.path`, and `request.remote_addr` for logging.
- *Type:* Global object in the `flask` module (proxy to request context).
- *Responsibility:* Provides access to URL parameters, form data, headers, and metadata of the incoming request.
- *Depends on:* An active request context.
- *Connects to:* Populated by Flask from the WSGI environment; read by views and middleware.
- *Shape:* Input data boundary.

**`flash`**
- *What it is:* A function that stores a message in the session for the next request.
- *Implementation:* `def flash(message: str, category: str = 'message')`
- *Its use:* We use it to queue a success or info message after a user performs an action.
- *Type:* Free function in the `flask` module.
- *Responsibility:* Appends messages to a hidden list inside the user's secure cookie session.
- *Depends on:* A string message, an optional category, and `SECRET_KEY` being configured.
- *Connects to:* Called by views; writes to `flask.session`.
- *Shape:* User feedback mechanism.

**`get_flashed_messages`**
- *What it is:* A function that pulls and clears all flash messages from the session.
- *Implementation:* `def get_flashed_messages(with_categories: bool = False) -> list`
- *Its use:* We use it inside our Jinja2 template to display the alerts.
- *Type:* Free function in the `flask` module, also available globally in Jinja2 templates.
- *Responsibility:* Retrieves queued messages and permanently removes them from the session.
- *Depends on:* An active session.
- *Connects to:* Called from templates; reads and mutates `flask.session`.
- *Shape:* User feedback mechanism.

**`session`**
- *What it is:* A dictionary-like object that stores data across requests securely in a browser cookie.
- *Implementation:* `session: SessionMixin`
- *Its use:* We use it to retrieve the `user_id`, and Flask uses it internally for `flash()`.
- *Type:* Global object in the `flask` module (proxy to request context).
- *Responsibility:* Provides stateful storage between independent HTTP requests.
- *Depends on:* An active request context and `app.config['SECRET_KEY']`.
- *Connects to:* Read/written by views; serialized into HTTP headers by Flask.
- *Shape:* Persistent state boundary.

**`redirect`**
- *What it is:* A function that generates an HTTP 302 Redirect response.
- *Implementation:* `def redirect(location: str) -> Response`
- *Its use:* We use it to send the user to the `show_flash` view after an action.
- *Type:* Free function in the `flask` module.
- *Responsibility:* Instructs the browser to make a new GET request to a different URL.
- *Depends on:* A destination URL string.
- *Connects to:* Called by views; returns a response back to the client browser.
- *Shape:* Navigation utility.

**`url_for`**
- *What it is:* A function that generates a URL to the given endpoint.
- *Implementation:* `def url_for(endpoint: str, **values: Any) -> str`
- *Its use:* We use it with `redirect` to dynamically construct the URL for the `show_flash` view.
- *Type:* Free function in the `flask` module.
- *Responsibility:* Decouples code from hardcoded URLs by looking up routes by function name.
- *Depends on:* The name of the target view function.
- *Connects to:* Called by views; queries Flask's routing map.
- *Shape:* Routing utility.

**`abort`**
- *What it is:* A function that immediately halts the request and raises an HTTP error.
- *Implementation:* `def abort(code: int)`
- *Its use:* We use it to trigger our 404 or 500 `@app.errorhandler` manually when we detect an issue.
- *Type:* Free function in the `flask` module.
- *Responsibility:* Short-circuits view logic by throwing an internal `HTTPException`.
- *Depends on:* An integer HTTP status code.
- *Connects to:* Called by views; caught by Flask to invoke error handlers.
- *Shape:* Control flow interruption.

**`sqlite3`**
- *What it is:* The standard library module providing an interface to the SQLite database engine.
- *Implementation:* `module sqlite3`
- *Its use:* We use it to connect to an in-memory database to store our notes.
- *Type:* Python standard library module.
- *Responsibility:* Exposes the C-level SQLite engine to Python, handling SQL compilation and execution.
- *Depends on:* The SQLite shared library on the host machine.
- *Connects to:* Read/written by our database logic.
- *Shape:* External system integration.

**`sqlite3.connect`**
- *What it is:* A function that opens a connection to an SQLite database.
- *Implementation:* `def connect(database: str) -> Connection`
- *Its use:* We use it to connect to an in-memory database to store our notes.
- *Type:* Free function in the `sqlite3` module.
- *Responsibility:* Manages the raw file I/O or memory allocation for the database engine.
- *Depends on:* A filepath or `':memory:'`.
- *Connects to:* Called when `get_db` first runs; communicates with the SQLite C library.
- *Shape:* Database entry point.

**`db.execute`**
- *What it is:* A method that prepares and runs an SQL statement.
- *Implementation:* `def execute(sql: str, parameters: tuple = ()) -> Cursor`
- *Its use:* We use it to query the database.
- *Type:* Instance method on `sqlite3.Connection`.
- *Responsibility:* Translates an SQL string into an internal execution plan and runs it.
- *Depends on:* A valid SQL string and optional parameters to prevent SQL injection.
- *Connects to:* Called by our view and database initialization logic.
- *Shape:* Database query operation.

**`db.commit`**
- *What it is:* A method that persists changes made in the current transaction.
- *Implementation:* `def commit()`
- *Its use:* We use it to save our table creation and data insertion permanently.
- *Type:* Instance method on `sqlite3.Connection`.
- *Responsibility:* Flushes pending database operations to disk (or memory).
- *Depends on:* An active connection with pending changes.
- *Connects to:* Called after schema changes or inserts.
- *Shape:* Database transaction boundary.

**`fetchone`**
- *What it is:* A method that retrieves the next row of a query result set.
- *Implementation:* `def fetchone() -> tuple | Row | None`
- *Its use:* We use it to retrieve a single note by ID, returning `None` if it doesn't exist.
- *Type:* Instance method on `sqlite3.Cursor`.
- *Responsibility:* Advances the cursor and returns exactly one record from the database.
- *Depends on:* A previously executed query.
- *Connects to:* Called by our view functions after an `execute`; returns data to Python.
- *Shape:* Database read operation.

**`@app.teardown_appcontext`**
- *What it is:* A decorator that registers a function to run when the application context ends.
- *Implementation:* `def teardown_appcontext(f: Callable)`
- *Its use:* We use it to ensure the database connection is closed after every request, even if an error occurred.
- *Type:* Decorator method on the Flask app instance.
- *Responsibility:* Provides a guaranteed cleanup hook, similar to a `finally` block for the whole request.
- *Depends on:* A function taking an exception object as an argument.
- *Connects to:* Called by Flask when tearing down the context; we use it to call `db.close()`.
- *Shape:* Resource cleanup hook.

---

## Concept Unit: Custom error pages

### The Problem
When a user requests a URL that doesn't exist, Flask automatically returns a plain text "404 Not Found" page. If our code crashes due to a bug, Flask returns a generic "500 Internal Server Error" page. In development, we might even see the full Python traceback, exposing our internal logic.

How can we intercept these errors before Flask sends its default response? Given that we know how to return HTML from standard routes, what would you try here first if you wanted a custom HTML page to appear when an error happens? Try sketching out a decorator name that might solve this before reading on.

### Introduce the concept in isolation
We can use an error handler decorator to return custom HTML.

```python
from flask import Flask, render_template_string
import secrets
app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

@app.errorhandler(404)
def not_found(e):
    return render_template_string("<h1>404 Not Found</h1>"), 404

with app.test_client() as c:
    r = c.get('/nonexistent-page')
    print('404 status:', r.status_code)
    print('404 body:', r.data.decode())
```

This is called an **error handler**.
1. `c.get('/nonexistent-page')` — makes a test request to a route that does not exist.
2. Flask searches for a matching route, fails, and internally raises a `NotFound` exception.
3. `@app.errorhandler(404)` — catches this exception and executes the `not_found(e)` function instead of generating the default text.
4. `render_template_string("<h1>404 Not Found</h1>"), 404` — returns the HTML and the explicit 404 status code, overriding Flask's default behavior.

### Discard the throwaway
This minimal throwaway script is discarded. We will not use it in our project.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are standardizing the visual experience of errors.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** After the `app = Flask(__name__)` initialization block.
- **Dependencies:** None.

### The New Code
```python
ERROR_PAGE = '''
<!DOCTYPE html><html><body>
<h1>{{ code }} — {{ title }}</h1>
<p>{{ message }}</p>
<a href="/">Go Home</a>
</body></html>
'''

@app.errorhandler(404)
def not_found(e):
    return render_template_string(ERROR_PAGE, code=404, title='Not Found',
        message='The page you requested does not exist.'), 404

@app.errorhandler(403)
def forbidden(e):
    return render_template_string(ERROR_PAGE, code=403, title='Forbidden',
        message='You do not have permission to access this page.'), 403

@app.errorhandler(500)
def server_error(e):
    app.logger.error(f'500 error: {e}')
    return render_template_string(ERROR_PAGE, code=500, title='Server Error',
        message='Something went wrong. Please try again later.'), 500

@app.errorhandler(429)
def rate_limited(e):
    return render_template_string(ERROR_PAGE, code=429, title='Too Many Requests',
        message='You are making requests too quickly. Please wait.'), 429
```

### The Updated Project
```python
1: import secrets
2: from flask import Flask, render_template_string
3: app = Flask(__name__)
4: app.config['SECRET_KEY'] = secrets.token_hex(32)
5: 
6: // ← new
7: ERROR_PAGE = '''
8: <!DOCTYPE html><html><body>
9: <h1>{{ code }} — {{ title }}</h1>
10: <p>{{ message }}</p>
11: <a href="/">Go Home</a>
12: </body></html>
13: '''
14: // ← new
15: @app.errorhandler(404)
16: def not_found(e):
17:     return render_template_string(ERROR_PAGE, code=404, title='Not Found',
18:         message='The page you requested does not exist.'), 404
19: // ← new
20: @app.errorhandler(403)
21: def forbidden(e):
22:     return render_template_string(ERROR_PAGE, code=403, title='Forbidden',
23:         message='You do not have permission to access this page.'), 403
24: // ← new
25: @app.errorhandler(500)
26: def server_error(e):
27:     app.logger.error(f'500 error: {e}')
28:     return render_template_string(ERROR_PAGE, code=500, title='Server Error',
29:         message='Something went wrong. Please try again later.'), 500
30: // ← new
31: @app.errorhandler(429)
32: def rate_limited(e):
33:     return render_template_string(ERROR_PAGE, code=429, title='Too Many Requests',
34:         message='You are making requests too quickly. Please wait.'), 429
```
The application now intercepts 404, 403, 500, and 429 status codes, returning a consistently styled HTML page instead of exposing unhandled tracebacks or plain text defaults.

### Mechanical walkthrough
- `@app.errorhandler` is a decorator mapping a specific integer status code to the function directly below it.
- `404` is the integer HTTP status code indicating that a resource was not found.
- `def not_found(e):` is the function that Flask invokes. The `e` argument receives the actual exception object raised internally.
- `return render_template_string(ERROR_PAGE, ...), 404` returns a tuple. Flask uses the first element as the response body and the second element as the HTTP status code. If we omit `, 404`, Flask would default to returning our error page with a `200 OK` success status!
- `render_template_string` is a Flask function that compiles our `ERROR_PAGE` string variable as a Jinja2 template.
- `code=404`, `title='Not Found'`, and `message='...'` are keyword arguments passed into the template, filling in the `{{ code }}`, `{{ title }}`, and `{{ message }}` slots respectively.
- `@app.errorhandler(500)` maps server crashes.
- `app.logger.error(f'500 error: {e}')` writes the actual error message to the server's logs, ensuring developers can still debug the problem even though the user sees a friendly page.

### CS lens
This is a form of the **Chain of Responsibility** pattern. When an error occurs, control flow drops out of the normal routing path and falls through a series of internal framework catch blocks. By registering an error handler, we are inserting our own link into that chain, declaring "if the error looks like this, let me process it instead of falling back to the default handler."
Also recognized in: GUI event bubbling, firewall rule processing, and POSIX signal handling.

### SE lens
Handling errors gracefully separates the developer experience from the user experience. Unhandled exceptions in production often reveal stack traces, which are a critical security risk because they expose file paths, framework versions, and sometimes even database queries. By intercepting these errors, we guarantee that users see a professional, non-threatening message, while the developer uses logging (added next) to capture the actual traceback securely.

### Commands needed
Run: `python app.py`
This command starts the Flask development server. Success output looks like `* Running on http://127.0.0.1:5000`.

### Run it
Since this relies on internal Flask routing logic, we can test it directly with our client.

```
404 status: 404
404 body: <!DOCTYPE html><html><body>\n<h1>404 — Not Found</h1>
```

### One sentence connecting to previous unit
Now that we are catching server errors and showing friendly pages, we need a way to actually record what went wrong behind the scenes, which we'll do using Flask's logger.

---

## Concept Unit: Flask's built-in logger

### The Problem
If our application crashes and we show the user a friendly "Something went wrong" page, how do we, the developers, know what actually broke? We can't rely on the terminal window staying open forever. 

If `print()` only outputs to the console running the server, what would you try here first to ensure messages are saved permanently so you can inspect them days later? Try sketching out the function call you might use before continuing.

### Introduce the concept in isolation
We can use Python's built-in logging module to write structured messages to a file.

```python
import logging
from flask import Flask

app = Flask(__name__)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('test_app.log')
    ]
)

app.logger.info("This is an info message")
app.logger.error("This is an error message")
```

This is called **structured logging**.
1. `logging.basicConfig(...)` — configures the global logging system to record messages of `INFO` severity or higher.
2. `logging.FileHandler('test_app.log')` — instructs the logger to append messages to a text file on disk.
3. `app.logger.info("This is an info message")` — writes a formatted log entry containing the timestamp, severity, and our message string.

### Discard the throwaway
This throwaway script is discarded. The real project will integrate logging directly into the main app initialization.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are adding observability.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** At the top of the file, alongside imports, and right after `app = Flask(__name__)`.
- **Dependencies:** The `logging` module.

### The New Code
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log'),
    ]
)

@app.route('/demo-logging')
def demo_logging():
    app.logger.info('GET /demo-logging')
    try:
        x = 1 / 0
    except ZeroDivisionError:
        app.logger.exception('Exception with full traceback:')
    return '<p>Logging demo. Check app.log</p>'
```

### The Updated Project
```python
1: import secrets
2: // ← new
3: import logging
4: from flask import Flask, render_template_string, request
5: 
6: app = Flask(__name__)
7: app.config.update(SECRET_KEY=secrets.token_hex(32), DEBUG=False)
8: 
9: // ← new
10: logging.basicConfig(
11:     level=logging.INFO,
12:     format='%(asctime)s %(levelname)s %(name)s: %(message)s',
13:     handlers=[
14:         logging.StreamHandler(),
15:         logging.FileHandler('app.log'),
16:     ]
17: )
18: 
19: // ← new
20: @app.route('/demo-logging')
21: def demo_logging():
22:     app.logger.info('GET /demo-logging')
23:     try:
24:         x = 1 / 0
25:     except ZeroDivisionError:
26:         app.logger.exception('Exception with full traceback:')
27:     return '<p>Logging demo. Check app.log</p>'
```
The application now writes structured logs to both the terminal output and a persistent `app.log` file, capturing info messages and detailed tracebacks when exceptions occur.

### Mechanical walkthrough
- `import logging` brings in Python's standard library logging framework.
- `logging.basicConfig(...)` configures the root logger.
- `level=logging.INFO` sets the minimum severity threshold. `DEBUG` messages are ignored, while `INFO`, `WARNING`, `ERROR`, and `CRITICAL` are recorded.
- `format='%(asctime)s ...'` defines the string template for each line, automatically injecting the timestamp and severity level.
- `handlers=[...]` takes a list of destinations for the log output.
- `logging.StreamHandler()` writes to `sys.stderr` (the console).
- `logging.FileHandler('app.log')` opens a file and appends every log line to it.
- `@app.route('/demo-logging')` creates a test endpoint.
- `app.logger.info('GET /demo-logging')` writes a standard informational message.
- `try:` starts a block of code where we anticipate errors.
- `x = 1 / 0` intentionally triggers a built-in mathematical error.
- `except ZeroDivisionError:` catches that specific exception instead of letting it crash the request.
- `app.logger.exception(...)` is a special method that logs the provided message with an `ERROR` severity, and automatically appends the full traceback of the caught exception to the log file.

### CS lens
This is **Event Stream Processing** applied to diagnostics. A running application generates a continuous stream of events. The logging framework acts as a dispatcher: it filters the stream (by severity level), transforms it (via formatters), and multiplexes it to multiple sinks (handlers like streams and files) asynchronously or synchronously.
Also recognized in: Unix syslog, telemetry data pipelines, pub/sub message brokers.

### SE lens
Why use `logging` instead of `print()`? A `print()` statement is ephemeral and unconfigurable. In production, no developer is staring at the terminal. `logging` allows us to persist data to disk, filter out noise by changing the `level` parameter without editing code, and automatically capture full tracebacks via `app.logger.exception` without exposing them to users.

### Commands needed
Run: `python app.py`

### Run it
When the `/demo-logging` route is hit, the application processes the try/except block.

```
2024-01-01 12:00:00 INFO app: GET /demo-logging
2024-01-01 12:00:00 ERROR app: Exception with full traceback:
Traceback (most recent call last):
  File "app.py", line 24, in demo_logging
    x = 1 / 0
ZeroDivisionError: division by zero
```

### One sentence connecting to previous unit
Now that we can manually log messages inside our views, we can automate logging for every single request using Flask middleware.

---

## Concept Unit: Request logging middleware

### The Problem
Writing `app.logger.info(...)` at the top of every route is repetitive and prone to being forgotten. 

If we want to record the path and execution time of every single request our server receives, what would you try here first? Try guessing the name of a Flask decorator that might let you run code before a request even reaches its route.

### Introduce the concept in isolation
We can use middleware hooks to run code automatically.

```python
import time
from flask import Flask, g, request

app = Flask(__name__)

@app.before_request
def start_timer():
    g.start_time = time.perf_counter()

@app.after_request
def end_timer(response):
    duration = time.perf_counter() - g.start_time
    print(f"{request.path} took {duration:.4f} seconds")
    return response

@app.route('/')
def home():
    return "Home"

with app.test_client() as c:
    c.get('/')
```

This is called **middleware**.
1. `@app.before_request` — runs `start_timer()` before the matched route view executes.
2. `g.start_time = time.perf_counter()` — records a high-precision timestamp into `g`, a temporary storage object scoped strictly to this single request.
3. The view function `home()` executes and generates a response.
4. `@app.after_request` — runs `end_timer(response)` before sending the data to the client, retrieving `g.start_time` to calculate the total elapsed time.

### Discard the throwaway
This throwaway snippet is discarded. We will implement robust logging middleware directly in our main file.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are standardizing request metrics.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** After the logging configuration block.
- **Dependencies:** `time`, `request`, and `g`.

### The New Code
```python
import time
from flask import g, request

@app.before_request
def log_request_start():
    g.start_time = time.perf_counter()
    app.logger.info(f'-> {request.method} {request.path} from {request.remote_addr}')

@app.after_request
def log_request_end(response):
    duration = (time.perf_counter() - g.get('start_time', time.perf_counter())) * 1000
    app.logger.info(
        f'<- {request.method} {request.path} '
        f'status={response.status_code} '
        f'duration={duration:.1f}ms '
        f'size={response.content_length or 0}B'
    )
    return response
```

### The Updated Project
```python
1: import secrets
2: import logging
3: // ← new
4: import time
5: // ← new
6: from flask import Flask, render_template_string, request, g
7: 
8: app = Flask(__name__)
9: app.config.update(SECRET_KEY=secrets.token_hex(32), DEBUG=False)
10: 
11: logging.basicConfig(
12:     level=logging.INFO,
13:     format='%(asctime)s %(levelname)s %(name)s: %(message)s',
14:     handlers=[
15:         logging.StreamHandler(),
16:         logging.FileHandler('app.log'),
17:     ]
18: )
19: 
20: // ← new
21: @app.before_request
22: def log_request_start():
23:     g.start_time = time.perf_counter()
24:     app.logger.info(f'-> {request.method} {request.path} from {request.remote_addr}')
25: 
26: // ← new
27: @app.after_request
28: def log_request_end(response):
29:     duration = (time.perf_counter() - g.get('start_time', time.perf_counter())) * 1000
30:     app.logger.info(
31:         f'<- {request.method} {request.path} '
32:         f'status={response.status_code} '
33:         f'duration={duration:.1f}ms '
34:         f'size={response.content_length or 0}B'
35:     )
36:     return response
```
The application now automatically logs every incoming request and outgoing response, calculating exactly how long the server took to process it.

### Mechanical walkthrough
- `import time` imports Python's standard time utilities.
- `@app.before_request` registers the function below it to execute before every incoming HTTP request.
- `g.start_time = ...` assigns a new property to Flask's global `g` object. `g` is unique per-request, meaning concurrent users won't overwrite each other's timestamps.
- `time.perf_counter()` reads the operating system's highest resolution clock, which is strictly monotonic (it never goes backward, unlike a wall clock).
- `app.logger.info(f'-> ...')` writes the incoming HTTP verb (`request.method`), the URL (`request.path`), and the client's IP (`request.remote_addr`).
- `@app.after_request` registers the function below it to execute right before the response is sent back to the client. It must accept and return the `response` object.
- `g.get('start_time', time.perf_counter())` safely retrieves our saved timestamp. If an error occurred before `before_request` finished, `g.get` provides a fallback to prevent a crash here.
- `( ... ) * 1000` multiplies the elapsed seconds by 1000 to convert to milliseconds.
- `response.status_code` reads the integer HTTP response code (e.g., 200, 404).
- `response.content_length or 0` retrieves the size of the payload in bytes, defaulting to 0 if none is provided.

### CS lens
This is an implementation of the **Decorator/Interceptor** pattern applied at the framework routing boundary. We are transparently wrapping the execution of arbitrary view functions with pre- and post-processing logic without modifying the views themselves. 
Also recognized in: HTTP proxies, aspect-oriented programming, and ORM lifecycle hooks.

### SE lens
Using middleware for cross-cutting concerns (like logging, authentication, or timing) prevents logic duplication. If we added logging manually to 50 routes, we would eventually forget one, or format it differently. Centralizing it in `before_request` and `after_request` guarantees consistency and creates a single place to update the log format when business requirements change.

### Commands needed
Run: `python app.py`

### Run it
When any request hits the server, the middleware wraps the transaction.

```
2024-01-01 12:00:00 INFO app: -> GET / from 127.0.0.1
2024-01-01 12:00:00 INFO app: <- GET / status=200 duration=0.5ms size=12B
```

### One sentence connecting to previous unit
With server-side observability handled, we can turn our attention back to the user experience by providing temporary UI alerts using flash messages.

---

## Concept Unit: Flash messages — one-shot user feedback

### The Problem
When a user submits a form (like creating a note), we usually redirect them to a new page to prevent duplicate submissions. However, a redirect forces a fresh HTTP request, meaning any success message we wanted to show is lost. 

If HTTP requests are entirely stateless, what would you try here first to pass a temporary "Success!" string across a redirect so the next page can display it exactly once?

### Introduce the concept in isolation
We can use flash messages, which leverage the user's session cookie.

```python
from flask import Flask, flash, get_flashed_messages, render_template_string
import secrets

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

@app.route('/set')
def set_flash():
    flash('Operation successful!', 'success')
    return "Flash set"

@app.route('/read')
def read_flash():
    msgs = get_flashed_messages(with_categories=True)
    return f"Messages: {msgs}"

with app.test_client() as c:
    c.get('/set')
    print("First read:", c.get('/read').data.decode())
    print("Second read:", c.get('/read').data.decode())
```

This is called a **flash message**.
1. `flash('Operation successful!', 'success')` — stores a tuple of `(category, message)` inside the user's secure session cookie.
2. `get_flashed_messages(...)` on the first `/read` — retrieves the list from the session, immediately clears it from the cookie, and returns `[('success', 'Operation successful!')]`.
3. `get_flashed_messages(...)` on the second `/read` — retrieves an empty list `[]` because the previous read consumed the data.

### Discard the throwaway
This throwaway demonstration is discarded.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are improving the UI flow.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** At the top level for the template, and routing functions added below middleware.
- **Dependencies:** `flash`, `get_flashed_messages`, `session`, `redirect`, `url_for`.

### The New Code
```python
from flask import flash, get_flashed_messages, session, redirect, url_for

FLASH_TEMPLATE = '''
{% with messages = get_flashed_messages(with_categories=True) %}
    {% for category, message in messages %}
        <div class="alert alert-{{ category }}">{{ message }}</div>
    {% endfor %}
{% endwith %}
<a href="/do-action">Do Action</a>
<a href="/show-flash">Show flashes</a>
'''

@app.route('/do-action')
def do_action():
    flash('Note created successfully!', 'success')
    flash('Remember to save your work.', 'info')
    return redirect(url_for('show_flash'))

@app.route('/show-flash')
def show_flash():
    return render_template_string(FLASH_TEMPLATE)
```

### The Updated Project
```python
1: import secrets
2: import logging
3: import time
4: // ← new
5: from flask import Flask, render_template_string, request, g, flash, get_flashed_messages, session, redirect, url_for
6: 
7: app = Flask(__name__)
8: app.config.update(SECRET_KEY=secrets.token_hex(32), DEBUG=False)
9: 
10: // ← new
11: FLASH_TEMPLATE = '''
12: {% with messages = get_flashed_messages(with_categories=True) %}
13:     {% for category, message in messages %}
14:         <div class="alert alert-{{ category }}">{{ message }}</div>
15:     {% endfor %}
16: {% endwith %}
17: <a href="/do-action">Do Action</a>
18: <a href="/show-flash">Show flashes</a>
19: '''
20: // ... middleware omitted for brevity ...
21: 
22: // ← new
23: @app.route('/do-action')
24: def do_action():
25:     flash('Note created successfully!', 'success')
26:     flash('Remember to save your work.', 'info')
27:     return redirect(url_for('show_flash'))
28: 
29: // ← new
30: @app.route('/show-flash')
31: def show_flash():
32:     return render_template_string(FLASH_TEMPLATE)
```
Users can now trigger an action that queues feedback messages, redirects to a new view, and sees those messages rendered perfectly exactly once.

### Mechanical walkthrough
- `FLASH_TEMPLATE = ''' ... '''` defines an HTML string containing Jinja2 syntax.
- `{% with messages = get_flashed_messages(with_categories=True) %}` is a Jinja2 block that calls the Flask function to retrieve the consumed messages and assigns them to a local variable named `messages`.
- `{% for category, message in messages %}` loops over the list of tuples returned by the function.
- `<div class="alert alert-{{ category }}">{{ message }}</div>` interpolates the category as an HTML class (e.g., `alert-success`) and the text as the element body.
- `@app.route('/do-action')` creates our state-mutating endpoint.
- `flash('Note created successfully!', 'success')` queues the string into the session under the 'success' category.
- `redirect(url_for('show_flash'))` commands the browser to make a new GET request to the `/show-flash` URL.
- `render_template_string(FLASH_TEMPLATE)` parses the template, which naturally consumes and clears the flashed messages during rendering.

### CS lens
This is a **queue mechanism over stateless protocols**. Because HTTP has no memory between requests, we use a signed client-side cookie (the session) as a temporary transport layer payload. The queue is strictly read-once (a pop operation): rendering the messages removes them, ensuring they don't leak into subsequent page refreshes.
Also recognized in: post-redirect-get (PRG) patterns, single-delivery message queues, and OTP tokens.

### SE lens
Relying on URL query parameters (`?success=true`) for feedback is fragile and encourages users to bookmark states that shouldn't be permanent. Flash messages neatly sidestep this by using the session cookie for transport. The state is guaranteed to disappear after it is displayed once, cleanly separating the result of an action from the URL of the page displaying it.

### Commands needed
Run: `python app.py`

### Run it
The framework's internal routing handles the flash list:

1. `GET /do-action` sets flash data, returns 302 Redirect.
2. `GET /show-flash` reads the flash data, rendering the HTML output.
3. `GET /show-flash` again finds no flash data, rendering only the links.

### One sentence connecting to previous unit
With error pages, logging, and user feedback solved, we must now gracefully handle database connection errors.

---

## Concept Unit: Handling exceptions gracefully in routes

### The Problem
If our database file is corrupted or a table is missing, an `execute` call will raise a raw `sqlite3.OperationalError`. Unhandled, this crashes the entire application.

If we want to explicitly catch this error, log it to our new file, and force the user to see our custom 500 error page instead of a traceback, what would you try here first?

### Introduce the concept in isolation
We can use Python's `try/except` alongside Flask's `abort()` function.

```python
from flask import Flask, abort

app = Flask(__name__)

@app.errorhandler(500)
def server_error(e):
    return "Custom 500 Page", 500

@app.route('/crash')
def crash():
    try:
        raise ValueError("Simulated DB error")
    except ValueError as e:
        print(f"Logged: {e}")
        abort(500)

with app.test_client() as c:
    r = c.get('/crash')
    print("Response status:", r.status_code)
    print("Response body:", r.data.decode())
```

This is called **exception handling with manual abort**.
1. `raise ValueError` — simulates a failure deep in the logic.
2. `except ValueError as e:` — catches the specific error type locally.
3. `print(f"Logged: {e}")` — gives the developer the exact problem details.
4. `abort(500)` — stops route execution and immediately hands control back to our `@app.errorhandler(500)` to render a safe response.

### Discard the throwaway
This simulated throwaway script is discarded. We will apply this pattern to actual SQLite calls.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are protecting our routes.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** Database helper functions and a new route appended to the file.
- **Dependencies:** `sqlite3`, `abort`.

### The New Code
```python
import sqlite3
from flask import abort

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.execute('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL)')
        g.db.execute('INSERT INTO notes (user_id,title) VALUES (1,"Test Note")')
        g.db.commit()
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db=g.pop('db',None)
    if db: db.close()

@app.route('/notes/<int:note_id>')
def note_detail(note_id):
    user_id = session.get('user_id', 1)
    try:
        note = get_db().execute('SELECT * FROM notes WHERE id=? AND user_id=?', (note_id,user_id)).fetchone()
    except sqlite3.OperationalError as e:
        app.logger.error(f'DB error fetching note {note_id}: {e}')
        abort(500)
        
    if note is None:
        abort(404)
        
    return f'<h1>{note["title"]}</h1>'
```

### The Updated Project
```python
1: import secrets
2: import logging
3: import time
4: // ← new
5: import sqlite3
6: from flask import Flask, render_template_string, request, g, flash, get_flashed_messages, session, redirect, url_for, abort
7: 
8: app = Flask(__name__)
9: app.config.update(SECRET_KEY=secrets.token_hex(32), DEBUG=False, DATABASE=':memory:')
10: // ... middleware & config ...
11: 
12: // ← new
13: def get_db():
14:     if 'db' not in g:
15:         g.db = sqlite3.connect(app.config['DATABASE'])
16:         g.db.row_factory = sqlite3.Row
17:         g.db.execute('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL)')
18:         g.db.execute('INSERT INTO notes (user_id,title) VALUES (1,"Test Note")')
19:         g.db.commit()
20:     return g.db
21: 
22: // ← new
23: @app.teardown_appcontext
24: def close_db(e=None):
25:     db = g.pop('db', None)
26:     if db: db.close()
27: 
28: // ← new
29: @app.route('/notes/<int:note_id>')
30: def note_detail(note_id):
31:     user_id = session.get('user_id', 1)
32:     try:
33:         note = get_db().execute('SELECT * FROM notes WHERE id=? AND user_id=?', (note_id, user_id)).fetchone()
34:     except sqlite3.OperationalError as e:
35:         app.logger.error(f'DB error fetching note {note_id}: {e}')
36:         abort(500)
37:         
38:     if note is None:
39:         abort(404)
40:         
41:     return f'<h1>{note["title"]}</h1>'
```
Database operations are now enclosed in safety blocks. If the query breaks, the error is quietly logged and the user sees the custom 500 error page. If the note is missing entirely, `abort(404)` intentionally summons our custom Not Found page.

### Mechanical walkthrough
- `import sqlite3` includes the standard database library.
- `def get_db():` defines our connection helper.
- `if 'db' not in g:` checks if this request already opened a connection.
- `sqlite3.connect(app.config['DATABASE'])` connects to the in-memory database.
- `g.db.row_factory = sqlite3.Row` configures rows to be accessible like dictionaries.
- `g.db.execute(...)` runs our setup SQL strings.
- `g.db.commit()` saves the setup to memory.
- `@app.teardown_appcontext` registers `close_db` to run exactly once when the request finishes, guaranteeing cleanup.
- `db = g.pop('db', None)` removes the connection from the global object.
- `if db: db.close()` safely terminates the connection if it existed.
- `@app.route('/notes/<int:note_id>')` captures an integer from the URL.
- `user_id = session.get('user_id', 1)` fetches the hardcoded user ID.
- `try:` starts the block to monitor for crashes.
- `get_db().execute('SELECT ...', (note_id, user_id)).fetchone()` queries for the single record.
- `except sqlite3.OperationalError as e:` catches only database-level structural errors (like syntax errors).
- `app.logger.error(...)` securely writes the raw exception to our `app.log` file.
- `abort(500)` stops view execution and triggers our `@app.errorhandler(500)`.
- `if note is None:` checks if the row was simply not found.
- `abort(404)` triggers our Not Found page.

### CS lens
This is the **Resource Acquisition Is Initialization (RAII)** principle applied to request context. Database connections are expensive and limited. By acquiring the connection lazily on demand (`get_db`) and guaranteeing its release at the boundary of the request lifecycle (`teardown_appcontext`), we ensure we never leak file handles or connection slots, even if the application code inside crashes unpredictably.
Also recognized in: Python's `with` statement, garbage collection destructors, and socket closing routines.

### SE lens
We never log user-provided data blindly without sanitization, but we do log error objects and context IDs. By separating the technical exception (`sqlite3.OperationalError`) from the user-facing outcome (`abort(500)`), we enforce a strict boundary: developers get the forensics, and users get a safe, generic apology. The alternative—passing `str(e)` back in the HTML response—is a severe security leak.

### Commands needed
Run: `python app.py`

### Run it
When requesting a nonexistent note, the system aborts.

```
Found: 200 <h1>Test Note</h1>
Not found: 404
```

### One sentence connecting to previous unit
With the integration of routing, safe database access, and robust observability, the core backend structure is complete and ready for production traffic.

---

## Closing

### Connect the pieces
When an unhandled exception occurs (like a `ZeroDivisionError`), Flask looks for a registered `@app.errorhandler(500)`. The `server_error(e)` function is called, which immediately uses `app.logger.exception` to securely record the full stack trace to `app.log`. The user receives a friendly HTML string rendered by `render_template_string`, entirely unaware of the underlying issue. Developers check the log file, see the traceback, and fix the bug, ensuring no sensitive data is ever exposed to the client.
