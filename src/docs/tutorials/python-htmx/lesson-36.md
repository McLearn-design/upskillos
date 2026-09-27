# Lesson 36: Capstone — Search, Pagination, and Filtering with HTMX

What you will build: You will implement a live-search feature that updates a list of notes as the user types, without reloading the page. You will also build a load-more pagination system that appends new pages of results to the bottom of the list. These features solve the transferable problems of how to handle large datasets gracefully using SQL limits, and how to prevent excessive server requests using debounce.

What you need to know first: You need to know how to set up basic Flask routes and render templates from previous lessons. 

Terms used in this lesson:
- **Debounce** — A rate-limiting technique that delays the execution of a function until a certain amount of time has passed since the last time it was called. It exists to prevent operations (like server requests) from firing too rapidly, such as on every single keystroke.
- **LIKE operator** — A SQL operator used in a WHERE clause to search for a specified pattern in a column. It exists to enable substring matching and wildcard searches within database text fields.
- **Pagination** — The process of dividing a large dataset into smaller, manageable chunks or pages. It exists to improve application performance and user experience by not loading thousands of records at once.
- **LIMIT and OFFSET** — SQL clauses used together for pagination. LIMIT restricts the number of rows returned, and OFFSET specifies how many rows to skip before starting to return data. They exist to allow a database to fetch only a specific slice of a larger result set.
- **SQL injection prevention** — The practice of safeguarding database queries from maliciously crafted user input. It exists to ensure that user input is treated strictly as data, never as executable code.
- **Parameterization** — The mechanism of passing variables to a SQL query using placeholders (like `?`) instead of string formatting. It exists to separate the SQL statement structure from the user-provided data, neutralizing SQL injection vulnerabilities.

Objects and methods used:
- **hx-get**
  - *What it is:* An HTMX attribute that declares an endpoint to fetch data from.
  - *Implementation:* An HTML attribute, e.g., `hx-get="/notes/search"`.
  - *Its use:* Tells the input element which backend route to call when a search is triggered.
  - *Type:* HTML attribute.
  - *Responsibility:* Initiates an HTTP GET request to the specified URL when the element's trigger fires.
  - *Depends on:* An active server endpoint that responds with HTML.
  - *Connects to:* The Flask routing system on the backend.
  - *Shape:* A declarative boundary defining where the client gets its data.

- **hx-trigger**
  - *What it is:* An HTMX attribute that dictates what events cause a request to fire.
  - *Implementation:* An HTML attribute, e.g., `hx-trigger="input delay:300ms, search"`.
  - *Its use:* Ensures a search request only happens 300ms after the user stops typing, or when the search input is explicitly cleared/submitted.
  - *Type:* HTML attribute.
  - *Responsibility:* Listens for browser DOM events and applies timing modifiers before allowing a request to proceed.
  - *Depends on:* The browser firing the specified DOM events (like `input` or `search`).
  - *Connects to:* The `hx-get` attribute on the same element.
  - *Shape:* An event-handling configuration layer.

- **hx-target**
  - *What it is:* An HTMX attribute that specifies the destination element for the server's response.
  - *Implementation:* An HTML attribute containing a CSS selector, e.g., `hx-target="#notes-list"`.
  - *Its use:* Directs the newly rendered HTML list items into the existing unordered list on the page.
  - *Type:* HTML attribute.
  - *Responsibility:* Locates the precise DOM element that should be updated.
  - *Depends on:* An element in the DOM matching the provided CSS selector.
  - *Connects to:* The browser's DOM tree and the incoming response payload.
  - *Shape:* A targeting mechanism bridging the network response to the UI.

- **hx-swap**
  - *What it is:* An HTMX attribute that defines the method of DOM replacement.
  - *Implementation:* An HTML attribute, e.g., `hx-swap="innerHTML"`.
  - *Its use:* Replaces the content inside the `<ul>` for searches, or replaces the "load more" button itself during pagination.
  - *Type:* HTML attribute.
  - *Responsibility:* Controls exactly how the response HTML is grafted into the document (e.g., inside, outside, appending).
  - *Depends on:* The element selected by `hx-target`.
  - *Connects to:* The browser's DOM rendering engine.
  - *Shape:* A DOM mutation instruction.

- **hx-include**
  - *What it is:* An HTMX attribute that forces the inclusion of other elements' values in a request.
  - *Implementation:* An HTML attribute with a CSS selector, e.g., `hx-include="[name='q']"`.
  - *Its use:* Ensures that when pagination triggers, the current search term is sent along so the next page is filtered correctly.
  - *Type:* HTML attribute.
  - *Responsibility:* Scrapes values from input elements matching the selector and appends them to the outgoing request.
  - *Depends on:* Target input elements existing in the DOM.
  - *Connects to:* The payload of the HTMX HTTP request.
  - *Shape:* A data-gathering directive for request parameters.

- **request.args.get**
  - *What it is:* A Flask method to retrieve query string parameters from an HTTP GET request.
  - *Implementation:* A Python instance method call, e.g., `request.args.get('q', '')`.
  - *Its use:* Extracts the search term and the requested page number from the URL parameters.
  - *Type:* Instance method on Werkzeug's `ImmutableMultiDict`.
  - *Responsibility:* Safely accesses dictionary keys, returning a default value if the key is missing.
  - *Depends on:* The incoming HTTP request containing query string variables.
  - *Connects to:* The controller logic that needs user input to filter or paginate data.
  - *Shape:* An extraction interface for HTTP query parameters.

- **get_db().execute**
  - *What it is:* A method to run a SQL command on an active SQLite connection.
  - *Implementation:* A Python method call, e.g., `get_db().execute('SELECT...', (param,))`.
  - *Its use:* Executes the parameterized SQL queries to fetch matching notes and count total results.
  - *Type:* Instance method on a `sqlite3.Connection` object.
  - *Responsibility:* Sends a SQL string and a tuple of parameters to the SQLite engine, returning a cursor object.
  - *Depends on:* An established connection to an SQLite database file or memory instance.
  - *Connects to:* The underlying SQLite C library that performs the database operation.
  - *Shape:* The execution boundary between the Python application and the database engine.

- **render_template_string**
  - *What it is:* A Flask utility function that renders a Jinja2 template from a raw string instead of a file.
  - *Implementation:* A Python function call, e.g., `render_template_string('...', notes=notes)`.
  - *Its use:* Quickly generates the HTML fragments required by HTMX without needing to create tiny, separate template files.
  - *Type:* Free function in the `flask` module.
  - *Responsibility:* Compiles a string into a Jinja2 template and evaluates it using the provided context variables.
  - *Depends on:* The Jinja2 templating engine being configured by Flask.
  - *Connects to:* The view function's return statement, sending HTML back to the client.
  - *Shape:* A text-processing and HTML-generation tool.

- **max**
  - *What it is:* A built-in Python function that returns the largest item in an iterable or the largest of two or more arguments.
  - *Implementation:* A Python built-in function call, e.g., `max(1, page_num)`.
  - *Its use:* Prevents the application from requesting page 0 or negative pages by enforcing a floor of 1.
  - *Type:* Python built-in function.
  - *Responsibility:* Compares inputs and yields the maximum numerical value.
  - *Depends on:* Arguments that support comparison operators.
  - *Connects to:* The pagination math calculation before it hits the database.
  - *Shape:* A standard mathematical utility.

- **int**
  - *What it is:* A built-in Python function and type used to convert a number or string to an integer.
  - *Implementation:* A Python built-in class instantiation, e.g., `int('2')`.
  - *Its use:* Converts the page number received from the URL (which is always a string) into an integer so math can be performed on it.
  - *Type:* Python built-in class/function.
  - *Responsibility:* Parses compatible string formats into an integer representation, or truncates floats.
  - *Depends on:* An input value that is structured like a valid integer.
  - *Connects to:* Mathematical operations, specifically the pagination OFFSET calculation.
  - *Shape:* A core type-casting utility.

## Concept Unit: Search input with debounce

### The Problem
We want users to be able to search through their notes instantly as they type. However, firing off a search request for every single keystroke would overwhelm the server. If the user types "flask", that's five keystrokes and potentially five separate requests in half a second. What we need is a way to wait until the user pauses typing before sending the request. How would you pause request execution until a user is done typing? What happens if they press backspace rapidly?

### Introduce the concept in isolation
This is called **debounce**. HTMX handles this with the `hx-trigger` attribute, specifically the `delay` modifier. By waiting for a brief period of inactivity, we can send one request instead of many. Let's see how a debounced input behaves in a minimal Flask app.

```python
from flask import Flask, request, session, g
import sqlite3, secrets

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT DEFAULT ""); INSERT INTO notes (user_id,title,body) VALUES (1,"Flask routing","Learn routes"),(1,"SQLite tips","Parameterized queries"),(1,"HTMX guide","hx-get hx-post")')
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db=g.pop('db',None)
    if db: db.close()

@app.route('/notes/search')
def notes_search():
    user_id = session.get('user_id', 1)
    q = request.args.get('q', '').strip()
    pattern = f'%{q}%'
    notes = get_db().execute(
        'SELECT * FROM notes WHERE user_id=? AND (title LIKE ? OR body LIKE ?) ORDER BY created DESC',
        (user_id, pattern, pattern)
    ).fetchall()
    return '\n'.join(f'<li>{n["title"]}: {n["body"]}</li>' for n in notes)

with app.test_request_context():
    print('delay:300ms: waits 300ms after last keystroke before firing request (debounce)')
    print('search: also fires when user clears the input or hits Enter')
    print('LIKE %q%: case-insensitive substring match in SQLite')
```

When we run this, HTMX intercepts the keystrokes and resets its internal timer with each new keystroke, only firing the request to `/notes/search` when the timer finally expires after 300ms. This proves that we can control the rate of network requests directly from the HTML attribute.

### Discard the throwaway
This isolated debounce example is deleted and will not appear in our project again.

### Project Change
- **Reference Source**: No reference counterpart — this is a from-scratch addition because we are introducing a new search feature to the notes list.
- **Files affected**: `templates/notes_list.html`
- **Change type**: Add
- **Location**: Above the `<ul>` element in the notes list.
- **Dependencies**: HTMX library.

### The New Code
```html
<input type="search"
       name="q"
       placeholder="Search notes..."
       hx-get="/notes/search"
       hx-trigger="input delay:300ms, search"
       hx-target="#notes-list"
       hx-swap="innerHTML"
       hx-include="[name='q']"
       autocomplete="off">
```

### The Updated Project
Here is where the new input lives inside the existing notes template.

```html
1 <!-- ← new -->
2 <input type="search"
3        name="q"
4        placeholder="Search notes..."
5        hx-get="/notes/search"
6        hx-trigger="input delay:300ms, search"
7        hx-target="#notes-list"
8        hx-swap="innerHTML"
9        hx-include="[name='q']"
10       autocomplete="off">
11 <ul id="notes-list">
12     {% for note in notes %}
13         {% include 'notes/_note.html' %}
14     {% endfor %}
15 </ul>
```

This structure places a search input directly above the list of notes. When triggered, it will fetch new results and replace the contents of the `<ul>`.

### Mechanical walkthrough
- `<input type="search"`: Standard HTML input element specialized for search queries.
- `name="q"`: The key that will be used to send the input's value in the query string (e.g., `?q=flask`).
- `placeholder="Search notes..."`: Placeholder text shown when the input is empty.
- `hx-get="/notes/search"`: Instructs HTMX to make an HTTP GET request to `/notes/search`.
- `hx-trigger="input delay:300ms, search"`: Tells HTMX to trigger the request when the `input` event fires, but only after a 300ms delay of no further input. It also triggers immediately on the `search` event (like hitting Enter or clicking an X to clear).
- `hx-target="#notes-list"`: Specifies that the HTML response should be placed into the element with the ID `notes-list`.
- `hx-swap="innerHTML"`: Instructs HTMX to replace the inside content of the target element, leaving the `<ul>` tags intact.
- `hx-include="[name='q']"`: Ensures the value of the element named `q` is included in the request, which is useful when other elements trigger requests but need the search query.
- `autocomplete="off"`: Disables the browser's native autocomplete dropdown to avoid obstructing the live search results.

### CS lens
In computer science, debouncing is a rate-limiting strategy that ensures a function is not called again until a certain amount of time has passed without it being called. It is fundamentally a problem of state and timers. By enforcing a quiet period before execution, we transform a rapid stream of continuous events into a single, discrete event, effectively compressing noise into intent.

### SE lens
From a software engineering perspective, placing the debounce logic in the declarative HTML attribute (`hx-trigger`) pushes UI synchronization concerns to the frontend library where they belong. The backend route `/notes/search` doesn't need to know it's being called by a live-search input; it just receives a `q` parameter and returns HTML. This separates the presentation timing from the business logic.

### Commands needed
Run: python app.py

### Run it
Open your browser and type into the search box. Watch the network tab: you will see requests only fire after you pause typing.

### One sentence connecting to previous unit
Now that the frontend is configured to send debounced search queries, the backend needs a route capable of filtering the database based on that query string.

## Concept Unit: Search route with parameterized LIKE

### The Problem
The frontend is sending a search query as `?q=flask`, but the database needs to find notes that contain that string anywhere in their title or body. A simple equality check (`title = 'flask'`) won't work because it demands an exact match. Furthermore, we must safely pass the user's input into the SQL query without risking SQL injection. How do we search for a partial string match inside a database field securely? What happens if the user searches for `%` or `' OR 1=1 --`?

### Introduce the concept in isolation
This is solved using the SQL **LIKE operator** and **parameterization**. The `LIKE` operator allows wildcard matching, where `%` represents zero or more characters. By safely injecting the wildcard characters in Python *before* passing the string as a parameter to the database, we ensure the input is treated entirely as a literal string. Let's look at how this behaves in isolation.

```python
import sqlite3, secrets
from flask import Flask, session, g, request, render_template_string

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT DEFAULT "", created TEXT DEFAULT (datetime("now"))); INSERT INTO notes (user_id,title,body) VALUES (1,"Python basics","Variables loops"),(1,"Flask setup","pip install flask"),(1,"SQLite queries","SELECT INSERT UPDATE DELETE")')
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db=g.pop('db',None)
    if db: db.close()

NOTE_ITEMS = '{% for note in notes %}<li id="note-{{ note.id }}"><strong>{{ note.title }}</strong><p>{{ note.body }}</p></li>{% else %}<li>No notes found.</li>{% endfor %}'

@app.route('/notes/search')
def notes_search():
    user_id = session.get('user_id', 1)
    q = request.args.get('q', '').strip()
    pattern = f'%{q}%'
    notes = get_db().execute(
        'SELECT id, title, body FROM notes WHERE user_id=? AND (title LIKE ? OR body LIKE ?) ORDER BY created DESC LIMIT 50',
        (user_id, pattern, pattern)
    ).fetchall()
    return render_template_string(NOTE_ITEMS, notes=notes)

with app.test_request_context():
    with app.test_client() as c:
        r = c.get('/notes/search?q=flask')
        print('Search "flask":', r.data.decode())
        r2 = c.get('/notes/search?q=')
        print('Empty search:', r2.data.decode()[:60])
```

Running this shows that searching for "flask" returns only the "Flask setup" note. Searching for an empty string sets the pattern to `%%`, which matches every note. If a malicious input like `x' OR '1'='1` is provided, it simply searches for that exact literal string surrounded by wildcards, keeping the database safe.

### Discard the throwaway
This isolated database search example is deleted and will not appear in our project again.

### Project Change
- **Reference Source**: No reference counterpart — this is a from-scratch addition because we are adding the backend endpoint to handle the search request.
- **Files affected**: `app.py`
- **Change type**: Add
- **Location**: Below the existing notes routes in `app.py`.
- **Dependencies**: SQLite database connection.

### The New Code
```python
@app.route('/notes/search')
def notes_search():
    user_id = session.get('user_id', 1)
    q = request.args.get('q', '').strip()
    
    # Always use parameterized query: % wildcards are safe OUTSIDE the placeholder
    pattern = f'%{q}%'  # q is not SQL, just a string inside a safe Python f-string
    
    notes = get_db().execute(
        'SELECT id, title, body FROM notes WHERE user_id=? AND (title LIKE ? OR body LIKE ?) ORDER BY created DESC LIMIT 50',
        (user_id, pattern, pattern)
    ).fetchall()
    
    return render_template_string(NOTE_ITEMS, notes=notes)
```

### The Updated Project
Here is where the new route sits alongside the database configuration.

```python
1 # ... existing imports and db setup
2 NOTE_ITEMS = '{% for note in notes %}<li id="note-{{ note.id }}"><strong>{{ note.title }}</strong><p>{{ note.body }}</p></li>{% else %}<li>No notes found.</li>{% endfor %}'
3
4 # ← new
5 @app.route('/notes/search')
6 def notes_search():
7     user_id = session.get('user_id', 1)
8     q = request.args.get('q', '').strip()
9     
10    pattern = f'%{q}%'
11    
12    notes = get_db().execute(
13        'SELECT id, title, body FROM notes WHERE user_id=? AND (title LIKE ? OR body LIKE ?) ORDER BY created DESC LIMIT 50',
14        (user_id, pattern, pattern)
15    ).fetchall()
16    
17    return render_template_string(NOTE_ITEMS, notes=notes)
```

This establishes the `/notes/search` endpoint that HTMX will query, grabbing the search term, querying the database, and returning the rendered HTML snippet.

### Mechanical walkthrough
- `@app.route('/notes/search')`: Decorator registering the function to handle GET requests at the `/notes/search` URL.
- `def notes_search():`: Defines the view function.
- `user_id = session.get('user_id', 1)`: Retrieves the currently logged-in user's ID from the session (defaulting to 1 for this lesson).
- `q = request.args.get('q', '').strip()`: Retrieves the query parameter `q` from the URL, defaults to an empty string, and removes leading/trailing whitespace.
- `pattern = f'%{q}%'`: Constructs the SQL search pattern in Python. The `%` wildcards mean "match any characters before or after the search term."
- `notes = get_db().execute(...)`: Executes the SQL query against the database.
- `'SELECT id, title, body FROM notes WHERE user_id=? AND (title LIKE ? OR body LIKE ?) ORDER BY created DESC LIMIT 50'`: The SQL string. It asks for notes belonging to the user where either the title or body contains the pattern. Results are ordered newest first and capped at 50 to prevent huge payloads.
- `(user_id, pattern, pattern)`: A tuple of values to safely bind to the `?` placeholders in the SQL string. `pattern` is provided twice because there are two `LIKE ?` clauses.
- `.fetchall()`: Fetches all rows returned by the executed query as a list of dictionary-like objects.
- `return render_template_string(NOTE_ITEMS, notes=notes)`: Renders the HTMX fragment string using the fetched notes data and returns it to the client.

### CS lens
String matching is a core database operation. A SQL `LIKE` query with a leading wildcard (like `%flask%`) forces the database to perform a sequential scan of every row because an index on a string column organizes data alphabetically from left to right. It cannot jump to strings containing "flask" in the middle. For small personal datasets like a user's notes, this sequential scan is extremely fast; for massive enterprise tables, full-text search engines (like Elasticsearch or SQLite FTS5) are required.

### SE lens
Parameterizing queries is the absolute golden rule of database security. We never build SQL strings by concatenating user input directly (e.g., `f"LIKE '%{q}%'"` directly in the SQL). By letting the database engine handle the parameters, it treats the input strictly as a literal value to match against, not as executable syntax. The f-string `pattern = f'%{q}%'` happens purely in Python memory, preparing a string value that is *then* passed as a parameter.

### Commands needed
Run: python app.py

### Run it
Execute the app and type a search term. The database processes the parameterized query and returns the filtered HTML snippet directly into the unordered list.

### One sentence connecting to previous unit
Now that we can search and filter notes, we need a way to manage large sets of results so the page doesn't try to render thousands of items at once.

## Concept Unit: Pagination with LIMIT/OFFSET

### The Problem
If a user has hundreds or thousands of notes, returning all of them in a single query consumes excessive memory on the server, takes too long to transmit over the network, and makes the browser sluggish while rendering a massive DOM tree. We need a way to fetch notes in manageable batches. How do you tell a database to only return rows 11 through 20? How do you calculate how many batches exist in total?

### Introduce the concept in isolation
This is solved using **Pagination**. In SQL, this is achieved using the `LIMIT` and `OFFSET` clauses. `LIMIT` caps the total number of rows returned, and `OFFSET` tells the database how many rows to skip before starting the output. By doing some basic arithmetic with the requested page number, we can slice the dataset. Let's see this arithmetic and SQL in isolation.

```python
import sqlite3, secrets
from flask import Flask, session, g, request, render_template_string

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT DEFAULT "", created TEXT DEFAULT (datetime("now")))')
        for i in range(25):
            g.db.execute('INSERT INTO notes (user_id,title,body) VALUES (?,?,?)', (1,f'Note {i+1}',f'Body {i+1}'))
        g.db.commit()
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db=g.pop('db',None)
    if db: db.close()

PER_PAGE = 10

@app.route('/notes')
def notes_list():
    user_id = session.get('user_id', 1)
    page = max(1, int(request.args.get('page', 1)))
    offset = (page - 1) * PER_PAGE
    
    notes = get_db().execute(
        'SELECT id, title, body FROM notes WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?',
        (user_id, PER_PAGE, offset)
    ).fetchall()
    
    total = get_db().execute('SELECT COUNT(*) FROM notes WHERE user_id=?', (user_id,)).fetchone()[0]
    total_pages = (total + PER_PAGE - 1) // PER_PAGE
    
    return render_template_string(
        '{% for n in notes %}<li>{{n.title}}</li>{% endfor %}<p>Page {{page}} of {{pages}}</p>',
        notes=notes, page=page, pages=total_pages
    )

with app.test_request_context():
    print('LIMIT per_page OFFSET (page-1)*per_page: classic SQL pagination')
    print('total_pages: ceiling division (total + per_page - 1) // per_page')
```

Running this code demonstrates that on page 1, the offset is 0, so it fetches the first 10 notes. On page 2, the offset is 10, skipping the first 10 and fetching the next batch. The total pages calculation correctly determines that 25 items divided by 10 per page requires 3 pages.

### Discard the throwaway
This isolated pagination logic example is deleted and will not appear in our project again.

### Project Change
- **Reference Source**: No reference counterpart — this is a from-scratch addition because we are implementing pagination for the first time.
- **Files affected**: `app.py`
- **Change type**: Configure
- **Location**: Inside the route that serves the notes list.
- **Dependencies**: None.

### The New Code
```python
PER_PAGE = 10

# Inside your notes fetching function:
page = max(1, int(request.args.get('page', 1)))
offset = (page - 1) * PER_PAGE

notes = get_db().execute(
    'SELECT id, title, body FROM notes WHERE user_id=? ORDER BY created DESC LIMIT ? OFFSET ?',
    (user_id, PER_PAGE, offset)
).fetchall()

total = get_db().execute('SELECT COUNT(*) FROM notes WHERE user_id=?', (user_id,)).fetchone()[0]
```

### The Updated Project
Here is how the pagination calculation integrates into a generic notes route.

```python
1 PER_PAGE = 10
2 
3 @app.route('/notes')
4 def notes_page():
5     user_id = session.get('user_id', 1)
6     # ← new
7     page = max(1, int(request.args.get('page', 1)))
8     offset = (page - 1) * PER_PAGE
9     
10    notes = get_db().execute(
11        'SELECT id, title, body FROM notes WHERE user_id=? ORDER BY created DESC LIMIT ? OFFSET ?',
12        (user_id, PER_PAGE, offset)
13    ).fetchall()
14    
15    total = get_db().execute('SELECT COUNT(*) FROM notes WHERE user_id=?', (user_id,)).fetchone()[0]
16    # ... template rendering
```

By adding the limit, offset, and count, the server is now aware of which specific slice of data it needs to fetch and return.

### Mechanical walkthrough
- `PER_PAGE = 10`: A constant defining how many notes constitute a single page.
- `request.args.get('page', 1)`: Retrieves the string value of the `page` query parameter, defaulting to `1`.
- `int(...)`: Converts that string into an integer.
- `max(1, ...)`: Ensures the page number is at least 1. If a user manually types `?page=0` or `?page=-5`, this function corrects it to 1.
- `offset = (page - 1) * PER_PAGE`: Calculates how many rows to skip. Page 1 skips 0; Page 2 skips 10.
- `LIMIT ? OFFSET ?`: SQL syntax telling the database to return at most `PER_PAGE` rows, starting after `offset` rows.
- `(user_id, PER_PAGE, offset)`: Binds the computed limit and offset to the SQL query securely.
- `SELECT COUNT(*) FROM notes WHERE user_id=?`: A secondary query that returns the total number of notes the user owns, regardless of pagination limits.
- `.fetchone()[0]`: Retrieves the single row returned by `COUNT(*)` and accesses its first column (index 0) to get the actual integer count.

### CS lens
Offset-based pagination is conceptually simple but scales poorly on massive datasets. If you request `LIMIT 10 OFFSET 100000`, the database must sequentially read and discard 100,000 rows just to find the 10 rows you want. For huge tables, "keyset pagination" (where you filter by `WHERE id > last_seen_id`) is required. However, for a user's personal notes collection, offset pagination is perfectly performant and easier to implement.

### SE lens
We execute two separate database queries: one to fetch the slice of data, and another to count the total. This is standard practice. Knowing the total allows the frontend UI to display "Page 1 of 3" or to decide whether to render a "Next Page" button at all.

### Commands needed
Run: python app.py

### Run it
If you have more than 10 notes in the database, navigating to `/notes?page=2` will show the second batch, while the database correctly skips the first batch.

### One sentence connecting to previous unit
Now that the backend understands how to slice data into pages, we need the frontend to trigger requests for those next pages without reloading the document.

## Concept Unit: HTMX load-more pagination

### The Problem
Traditional pagination uses explicit page links (1, 2, 3, Next) that reload the entire page. A smoother user experience is an "infinite scroll" or "Load More" pattern, where clicking a button simply appends the next page of results to the bottom of the existing list. How do we make a button fetch new HTML and inject it without replacing what's already there?

### Introduce the concept in isolation
We can achieve this using the **HTMX load-more pattern**. A "Load more" button is placed at the end of the list. When clicked, it fetches the next page and uses `hx-swap="outerHTML"` to replace *itself* with the new batch of notes, plus a brand new "Load more" button for the page after that. Let's examine this flow.

```python
import sqlite3, secrets
from flask import Flask, session, g, request, render_template_string

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL)')
        for i in range(25):
            g.db.execute('INSERT INTO notes (user_id,title) VALUES (?,?)', (1,f'Note {i+1}'))
        g.db.commit()
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db=g.pop('db',None)
    if db: db.close()

PER_PAGE = 10

@app.route('/notes')
def notes_page():
    user_id = session.get('user_id', 1)
    page = max(1, int(request.args.get('page', 1)))
    offset = (page - 1) * PER_PAGE
    
    notes = get_db().execute('SELECT id, title FROM notes WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?', (user_id, PER_PAGE, offset)).fetchall()
    total = get_db().execute('SELECT COUNT(*) FROM notes WHERE user_id=?', (user_id,)).fetchone()[0]
    
    has_next = (page * PER_PAGE) < total
    
    items = ''.join(f'<li id="note-{n["id"]}">{n["title"]}</li>' for n in notes)
    
    if has_next:
        items += f'<li id="load-more"><button hx-get="/notes?page={page+1}" hx-target="#load-more" hx-swap="outerHTML">Load more ({total - page*PER_PAGE} remaining)</button></li>'
        
    return items

with app.test_request_context():
    print('Load-more: hx-target=#load-more hx-swap=outerHTML: button replaced by next page + new button')
    print('has_next: (page * per_page) < total')
```

When this runs, clicking the button replaces the entire `<li id="load-more">` element with the next 10 `<li>` note items, followed by a new `<li id="load-more">` pointing to page 3. When we reach the final page, `has_next` evaluates to false, and no button is rendered, cleanly ending the list.

### Discard the throwaway
This isolated HTMX pagination example is deleted and will not appear in our project again.

### Project Change
- **Reference Source**: No reference counterpart — this is a from-scratch addition.
- **Files affected**: `templates/notes_list.html`
- **Change type**: Add
- **Location**: At the bottom of the notes loop.
- **Dependencies**: HTMX library.

### The New Code
```html
{% if has_next %}
  <li id="load-more">
    <button hx-get="/notes?page={{ next_page }}"
            hx-target="#load-more"
            hx-swap="outerHTML">
      Load more
    </button>
  </li>
{% endif %}
```

### The Updated Project
Here is the template structure integrating the load-more button at the end of the loop.

```html
1 <ul id="notes-list">
2     {% for note in notes %}
3         {% include 'notes/_note.html' %}
4     {% endfor %}
5     <!-- ← new -->
6     {% if has_next %}
7       <li id="load-more">
8         <button hx-get="/notes?page={{ next_page }}"
9                 hx-target="#load-more"
10                hx-swap="outerHTML">
11          Load more
12        </button>
13      </li>
14    {% endif %}
15 </ul>
```

The button is dynamically rendered with the ID of the next page, provided there is more data to fetch.

### Mechanical walkthrough
- `{% if has_next %}`: A Jinja2 condition that checks if there are more pages available. If not, the block is skipped and the list just ends.
- `<li id="load-more">`: A list item container with a specific ID. This is critical for HTMX targeting.
- `<button hx-get="/notes?page={{ next_page }}"`: An HTML button configured to make a GET request to the `/notes` endpoint, passing the pre-calculated `next_page` variable in the query string.
- `hx-target="#load-more"`: Tells HTMX that the response should be targeted at the element with the ID `load-more` (which is the `<li>` wrapping this button).
- `hx-swap="outerHTML"`: Instructs HTMX to replace the *entire* target element (the `<li>` and the `<button>` inside it) with the new HTML returned by the server. Because the server returns the next batch of notes plus a *new* load-more button, the old button is overwritten by the new data.

### CS lens
This pattern elegantly shifts state management. The client browser doesn't need to track what page it is on in JavaScript variables. The state (the `next_page` integer) is encoded directly into the HTML payload generated by the server and stored in the DOM attribute `hx-get`. When the action occurs, the state is passed back to the server.

### SE lens
Replacing `outerHTML` is a powerful primitive. If we used `innerHTML`, the new notes would be nested *inside* the old "load-more" list item, breaking the HTML structure of the `<ul>`. By replacing the outer HTML, the old button vanishes, and the new list items snap seamlessly into the list as siblings to the older notes.

### Commands needed
Run: python app.py

### Run it
Scroll to the bottom of your notes list and click "Load more". Watch the DOM inspector to see the old button get completely overwritten by the new chunk of HTML.

### One sentence connecting to previous unit
The final piece of the puzzle is to ensure that when a user searches for a term, the pagination respects that search term so they don't lose their filtered results when clicking "Load more".

## Concept Unit: Combining search and pagination

### The Problem
If a user searches for "flask", they might get 15 results. Only 10 are shown on the first page. If they click "Load more", the request `GET /notes/search?page=2` is sent. However, without the search term `q=flask`, the backend will return the second page of *all* notes, not the second page of the "flask" search results. How do we keep the search filter and the pagination state synchronized?

### Introduce the concept in isolation
We combine them by making sure the search query and the page number are always passed together, and that the backend uses the exact same `WHERE` clause to fetch the slice and to count the total. Let's see how the backend handles both parameters simultaneously.

```python
import sqlite3, secrets
from flask import Flask, session, g, request, render_template_string

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT DEFAULT "")')
        for i, t in enumerate(['Python loops','Flask routes','SQLite joins','HTMX swaps','Argon2 hashing','CSRF tokens','Session cookies','Role-based access','IDOR prevention','Deployment']):
            g.db.execute('INSERT INTO notes (user_id,title,body) VALUES (?,?,?)',(1,t,f'Body about {t}'))
        g.db.commit()
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db=g.pop('db',None)
    if db: db.close()

@app.route('/notes/search')
def combined_search():
    user_id = session.get('user_id', 1)
    q = request.args.get('q', '').strip()
    page = max(1, int(request.args.get('page', 1)))
    per_page = 5
    offset = (page - 1) * per_page
    pattern = f'%{q}%'
    
    notes = get_db().execute(
        'SELECT id,title,body FROM notes WHERE user_id=? AND (title LIKE ? OR body LIKE ?) ORDER BY title LIMIT ? OFFSET ?',
        (user_id, pattern, pattern, per_page, offset)
    ).fetchall()
    
    total = get_db().execute('SELECT COUNT(*) FROM notes WHERE user_id=? AND (title LIKE ? OR body LIKE ?)',(user_id,pattern,pattern)).fetchone()[0]
    
    return render_template_string('{% for n in notes %}<li>{{n.title}}</li>{% endfor %}<p>{{total}} results</p>',notes=notes,total=total)

with app.test_request_context():
    with app.test_client() as c:
        r = c.get('/notes/search?q=&page=1')
        print('All notes page 1:', r.data.decode()[:80])
        r2 = c.get('/notes/search?q=flask')
        print('Search flask:', r2.data.decode())
```

When run, querying `?q=&page=1` matches all 10 notes but limits the return to the first 5, with a total count of 10. Querying `?q=flask` matches only "Flask routes", returning 1 item and an accurate total count of 1. The key is that the `WHERE` clause for the `COUNT(*)` matches the `WHERE` clause for the data fetch exactly.

### Discard the throwaway
This combined logic example is deleted and will not appear in our project again.

### Project Change
- **Reference Source**: No reference counterpart.
- **Files affected**: `app.py`
- **Change type**: Refactor
- **Location**: Inside the `/notes/search` route.
- **Dependencies**: None.

### The New Code
```python
@app.route('/notes/search')
def combined_search():
    user_id = session.get('user_id', 1)
    q = request.args.get('q', '').strip()
    page = max(1, int(request.args.get('page', 1)))
    per_page = 5
    offset = (page - 1) * per_page
    pattern = f'%{q}%'
    
    notes = get_db().execute(
        'SELECT id,title,body FROM notes WHERE user_id=? AND (title LIKE ? OR body LIKE ?) ORDER BY title LIMIT ? OFFSET ?',
        (user_id, pattern, pattern, per_page, offset)
    ).fetchall()
    
    total = get_db().execute(
        'SELECT COUNT(*) FROM notes WHERE user_id=? AND (title LIKE ? OR body LIKE ?)',
        (user_id, pattern, pattern)
    ).fetchone()[0]
    
    has_next = (page * per_page) < total
    return render_template_string(NOTE_ITEMS, notes=notes, has_next=has_next, next_page=page+1)
```

### The Updated Project
Here is the final route, processing both pagination math and search parameters together to ensure accurate subsets of data are delivered to the frontend.

```python
1 # ← refactored
2 @app.route('/notes/search')
3 def combined_search():
4     user_id = session.get('user_id', 1)
5     q = request.args.get('q', '').strip()
6     page = max(1, int(request.args.get('page', 1)))
7     per_page = 5
8     offset = (page - 1) * per_page
9     pattern = f'%{q}%'
10    
11    notes = get_db().execute(
12        'SELECT id,title,body FROM notes WHERE user_id=? AND (title LIKE ? OR body LIKE ?) ORDER BY title LIMIT ? OFFSET ?',
13        (user_id, pattern, pattern, per_page, offset)
14    ).fetchall()
15    
16    total = get_db().execute(
17        'SELECT COUNT(*) FROM notes WHERE user_id=? AND (title LIKE ? OR body LIKE ?)',
18        (user_id, pattern, pattern)
19    ).fetchone()[0]
20    
21    has_next = (page * per_page) < total
22    return render_template_string(NOTE_ITEMS, notes=notes, has_next=has_next, next_page=page+1)
```

By passing both `has_next` and `next_page` to the template context, the load-more button has the information it needs. Additionally, using `hx-include="[name='q']"` on the search input ensures the browser always attaches the current search string to pagination requests.

### Mechanical walkthrough
- `@app.route('/notes/search')`: The endpoint to handle combined filtering and pagination.
- `def combined_search():`: The updated view function.
- `user_id = session.get('user_id', 1)`: Extracts the logged-in user.
- `q = request.args.get('q', '').strip()`: Extracts the current search term.
- `page = max(1, int(request.args.get('page', 1)))`: Extracts the current page.
- `per_page = 5`: Defines the pagination chunk size.
- `offset = (page - 1) * per_page`: Calculates the SQL offset.
- `pattern = f'%{q}%'`: Formats the search term for SQL `LIKE`.
- `notes = get_db().execute(...)`: Executes the paginated and filtered query.
- `'SELECT id,title,body FROM notes WHERE user_id=? AND (title LIKE ? OR body LIKE ?) ORDER BY title LIMIT ? OFFSET ?'`: The query containing both `LIKE` filtering and pagination clauses.
- `(user_id, pattern, pattern, per_page, offset)`: Binds all parameters safely to the database driver.
- `total = get_db().execute(...)`: Executes a count query.
- `'SELECT COUNT(*) FROM notes WHERE user_id=? AND (title LIKE ? OR body LIKE ?)'`: Critically, this query applies the exact same `WHERE` clause as the main query, counting only the filtered set, not the entire database.
- `(user_id, pattern, pattern)`: Binds the search parameters to the count query.
- `.fetchone()[0]`: Extracts the integer total.
- `has_next = (page * per_page) < total`: A boolean expression calculating if there are remaining pages after the current slice.
- `return render_template_string(NOTE_ITEMS, notes=notes, has_next=has_next, next_page=page+1)`: Passes the notes, the boolean `has_next`, and the integer `next_page` to the Jinja2 template rendering engine.

### CS lens
Keeping the state of two distinct features (search filtering and page indexing) synchronized across a stateless HTTP connection requires discipline. If the `COUNT(*)` query misses the `LIKE` clauses, the server will calculate `has_next` incorrectly, tricking the client into requesting empty pages. Consistency between the query that retrieves the data and the query that measures the data is paramount.

### SE lens
This function encapsulates the heavy lifting of the Capstone project: translating URL state into database instructions. By gathering `q` and `page`, determining the exact subset required, executing the queries securely, and returning just an HTML fragment, the backend remains thin while empowering the frontend to feel like a dynamic, single-page application.

### Commands needed
Run: python app.py

### Run it
Search for a term that yields many results. Notice how the first chunk appears instantly. Scroll to the bottom, click "Load more", and the next chunk of the *filtered* results seamlessly appends to the list.

### One sentence connecting to previous unit
With the backend queries synchronized, the capstone feature is complete, bridging dynamic inputs with responsive HTMX updates.

## Closing

### Connect the pieces
Let's trace a complete interaction. The user types 'htmx' into the search input. The input has `hx-trigger='input delay:300ms'`, so HTMX waits for the typing to pause. After 300ms, HTMX issues `GET /notes/search?q=htmx`. The backend function intercepts this, extracts the query, and constructs the pattern `'%htmx%'`. It runs `SELECT ... WHERE title LIKE '%htmx%' OR body LIKE '%htmx%' LIMIT 5 OFFSET 0`, returning perhaps 1 match: 'HTMX swaps'. The server calculates the total matches (1), determines `has_next` is false, and returns the HTML: `<li>HTMX swaps</li>` with no load-more button. Finally, HTMX receives this payload and uses `hx-swap='innerHTML'` to instantly replace the contents of `#notes-list`. The user gets live, filtered, database-backed search results—all without writing a single line of client-side JavaScript.
