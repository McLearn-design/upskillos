# Lesson 29: AuthN vs AuthZ — Who You Are vs What You Can Do

What you will build
In this lesson, you will build routing protections that differentiate between verifying a user's identity (authentication) and checking if that verified user is permitted to perform a specific action (authorization). The transferable problem is ensuring that these two distinct concepts are never conflated, preventing scenarios where simply being logged in grants access to restricted administrative areas or allows a user to access another user's private resources.

What you need to know first
- **Lesson 28** for basic session management and setting up a SQLite database in Flask.

Terms used in this lesson
- **Authentication (AuthN)** — The process of verifying who a user is, typically through credentials like a username and password. This answers the question "Who are you?".
- **Authorization (AuthZ)** — The process of determining whether an authenticated user is permitted to perform a requested action or access a specific resource. This answers the question "Are you allowed to do this?".
- **Decorator** — A Python feature that allows you to modify the behavior of a function or class. In Flask, decorators are heavily used to apply routing and access control checks before a view function executes.
- **IDOR (Insecure Direct Object Reference)** — A security vulnerability that occurs when an application provides direct access to objects based on user-supplied input (like a URL parameter) without properly checking if the current user owns or has permission to access that object.
- **401 Unauthorized** — An HTTP status code indicating that the request lacks valid authentication credentials for the target resource. It means "tell me who you are."
- **403 Forbidden** — An HTTP status code indicating that the server understands the request but refuses to authorize it. It means "I know who you are, but the answer is still no."

Objects and methods used

**`flask.session`**
- *What it is:* A dictionary-like object in Flask that stores data specific to a user's session.
- *Implementation:* `session.get(key)`, `session[key] = value`. Stored as a cryptographically signed cookie in the user's browser.
- *Its use:* To persist a user's logged-in state (e.g., storing `user_id` and optionally `role`) across multiple HTTP requests.
- *Type:* A proxy object to a dictionary-like session interface.
- *Responsibility:* Manages session data, handling the serialization to and deserialization from the signed cookie.
- *Depends on:* The application's `SECRET_KEY` configuration for cryptographic signing.
- *Connects to:* Read and written by view functions or `before_request` handlers to track user state.
- *Shape:* A global-acting thread-local object used within the application's request context.

**`flask.g`**
- *What it is:* An object in Flask provided for storing data during a single request or application context.
- *Implementation:* `g.user = user_data`.
- *Its use:* To store the user record fetched from the database during `before_request` so it can be accessed throughout the request lifecycle without re-querying.
- *Type:* A thread-local proxy object.
- *Responsibility:* Provides a temporary storage location for data that is only valid for the duration of one request.
- *Depends on:* The Flask application context.
- *Connects to:* Populated by `before_request` functions, read by view functions and templates.
- *Shape:* A request-scoped container.

**`functools.wraps`**
- *What it is:* A utility from the Python standard library used when writing decorators.
- *Implementation:* `@functools.wraps(f)`.
- *Its use:* To ensure that the wrapper function inherits the name, docstring, and other metadata from the original function being decorated.
- *Type:* A decorator.
- *Responsibility:* Preserves the identity and metadata of a decorated function.
- *Depends on:* The function being wrapped (`f`).
- *Connects to:* Called within a decorator factory to update the inner wrapper function.
- *Shape:* A utility function in the standard library.

**`flask.abort`**
- *What it is:* A function in Flask that immediately halts request processing and returns an HTTP error response.
- *Implementation:* `abort(403)`.
- *Its use:* To terminate a request with a specific status code (like 403 Forbidden) when an authorization check fails.
- *Type:* A function.
- *Responsibility:* Halts execution and triggers the generation of an error response.
- *Depends on:* An HTTP status code integer.
- *Connects to:* Called by authorization checks; raises an exception that Flask catches to generate the final HTTP response.
- *Shape:* A utility function within the framework's control flow.

**Everything else in the file, not this lesson's subject but still explained:**

**`sqlite3.connect`**
- *What it is:* A standard library function to open a connection to a SQLite database.
- *Implementation:* `sqlite3.connect(':memory:')`.
- *Its use:* To connect to an in-memory database for testing and demonstration purposes.
- *Type:* A function returning a `Connection` object.
- *Responsibility:* Establishes and manages the connection to the SQLite database file or memory space.
- *Depends on:* A database path or connection string.
- *Connects to:* Returns a connection object used to execute queries.
- *Shape:* An entry point to the standard library's database API.


## Concept Unit: The distinction with a concrete example

### The Problem
When building a web application, we need to know who a user is and what they are allowed to do. If we only verify their identity, any logged-in user might be able to access administrative controls. How do we structure our code to clearly separate checking identity from checking permissions?

### Introduce the concept in isolation
```python
from flask import Flask, session, redirect, url_for
import functools, secrets
app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Authentication: verified identity
def is_authenticated():
    return 'user_id' in session

# Authorization: permission check
def is_admin():
    return session.get('role') == 'admin'

# login_required: Authentication check only
def login_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        if not is_authenticated():
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

# admin_required: AuthN + AuthZ
def admin_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        if not is_authenticated():
            return redirect(url_for('login'))
        if not is_admin():
            return 'Access denied.', 403  # authenticated but not authorized
        return f(*args, **kwargs)
    return decorated

@app.route('/dashboard')
@login_required  # any logged-in user
def dashboard(): return '<h1>Dashboard</h1>'

@app.route('/admin')
@admin_required  # only admins
def admin(): return '<h1>Admin Panel</h1>'

if __name__ == '__main__':
    print('401 Unauthorized: not authenticated. 403 Forbidden: authenticated but not authorized.')
```
This isolates the conceptual difference between the two checks.

### Discard the throwaway
This throwaway code is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are starting a new file for this lesson.
- **Files affected:** `app.py` created.
- **Change type:** Add
- **Location:** The entire file.
- **Dependencies:** Flask installed.

### The New Code
```python
from flask import Flask, session, redirect, url_for
import functools, secrets
app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

def is_authenticated():
    return 'user_id' in session

def is_admin():
    return session.get('role') == 'admin'

def login_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        if not is_authenticated():
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        if not is_authenticated():
            return redirect(url_for('login'))
        if not is_admin():
            return 'Access denied.', 403
        return f(*args, **kwargs)
    return decorated

@app.route('/dashboard')
@login_required
def dashboard(): return '<h1>Dashboard</h1>'

@app.route('/admin')
@admin_required
def admin(): return '<h1>Admin Panel</h1>'
```

### The Updated Project
```python
1: from flask import Flask, session, redirect, url_for
2: import functools, secrets
3: app = Flask(__name__)
4: app.config['SECRET_KEY'] = secrets.token_hex(32)
5: 
6: def is_authenticated():
7:     return 'user_id' in session
8: 
9: def is_admin():
10:     return session.get('role') == 'admin'
11: 
12: def login_required(f):
13:     @functools.wraps(f)
14:     def decorated(*args, **kwargs):
15:         if not is_authenticated():
16:             return redirect(url_for('login'))
17:         return f(*args, **kwargs)
18:     return decorated
19: 
20: def admin_required(f):
21:     @functools.wraps(f)
22:     def decorated(*args, **kwargs):
23:         if not is_authenticated():
24:             return redirect(url_for('login'))
25:         if not is_admin():
26:             return 'Access denied.', 403
27:         return f(*args, **kwargs)
28:     return decorated
29: 
30: @app.route('/dashboard')
31: @login_required
32: def dashboard(): return '<h1>Dashboard</h1>'
33: 
34: @app.route('/admin')
35: @admin_required
36: def admin(): return '<h1>Admin Panel</h1>'
```
We now have decorators that separate identity verification from access control.

### Mechanical walkthrough
- `def is_authenticated():` defines a helper function.
- `return 'user_id' in session` returns True if the session contains a 'user_id' key.
- `def is_admin():` defines a helper function for authorization.
- `return session.get('role') == 'admin'` fetches the 'role' from the session and checks if it equals 'admin'.
- `@functools.wraps(f)` applies the wraps decorator to preserve function metadata.
- `if not is_authenticated():` checks identity.
- `return redirect(url_for('login'))` redirects unauthenticated users.
- `if not is_admin():` checks permissions for admins.
- `return 'Access denied.', 403` returns a 403 status code when authorization fails.

### CS lens
Separation of concerns. Authentication establishes identity state. Authorization reads that state to evaluate policy. Keeping them separate means you can change policy without changing how identity is verified.

### SE lens
Using decorators extracts security checks out of the core business logic of the view functions. It enforces the "fail closed" principle — if the check fails, execution immediately halts before reaching the sensitive code.

### Commands needed
Run: python app.py

### Run it
Output: `401 Unauthorized: not authenticated. 403 Forbidden: authenticated but not authorized.` (Predicted behavior based on standard HTTP status code semantics).

### One sentence connecting to previous unit
Now that we have separated the checks, let's explore how to retrieve the user's role from a database instead of trusting a session attribute directly.


## Concept Unit: Role-based access — checking role in DB

### The Problem
Checking a role stored directly in the session is convenient, but what if a user's role changes in the database while their session is still active? They would retain their old permissions. How do we ensure we evaluate authorization based on real-time data?

### Introduce the concept in isolation
```python
import sqlite3, secrets
from flask import Flask, session, g, redirect, url_for
import functools
app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user'); INSERT INTO users (username,role) VALUES ('alice','user'),('bob','admin');")
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db=g.pop('db',None)
    if db: db.close()

@app.before_request
def load_user():
    user_id = session.get('user_id')
    g.user = get_db().execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone() if user_id else None

def role_required(role):
    def decorator(f):
        @functools.wraps(f)
        def decorated(*args, **kwargs):
            if g.user is None:
                return redirect(url_for('login'))
            if g.user['role'] != role:
                return f'Access denied. Required: {role}. Your role: {g.user["role"]}', 403
            return f(*args, **kwargs)
        return decorated
    return decorator

@app.route('/admin')
@role_required('admin')
def admin_panel(): return '<h1>Admin Panel</h1>'

@app.route('/login')
def login(): return 'Login'

with app.test_request_context():
    print('Role checked from DB via g.user: cannot be spoofed by editing session cookie')
```
We load the fresh user record on every request, then check `g.user['role']` against the required role.

### Discard the throwaway
This throwaway code is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition.
- **Files affected:** `app.py`
- **Change type:** Replace
- **Location:** Replacing the previous decorators with database-backed checks.
- **Dependencies:** SQLite3.

### The New Code
```python
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user'); INSERT INTO users (username,role) VALUES ('alice','user'),('bob','admin');")
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db=g.pop('db',None)
    if db: db.close()

@app.before_request
def load_user():
    user_id = session.get('user_id')
    g.user = get_db().execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone() if user_id else None

def role_required(role):
    def decorator(f):
        @functools.wraps(f)
        def decorated(*args, **kwargs):
            if g.user is None:
                return redirect(url_for('login'))
            if g.user['role'] != role:
                return f'Access denied. Required: {role}. Your role: {g.user["role"]}', 403
            return f(*args, **kwargs)
        return decorated
    return decorator
```

### The Updated Project
```python
1: import sqlite3, secrets
2: from flask import Flask, session, g, redirect, url_for
3: import functools
4: app = Flask(__name__)
5: app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')
6: 
7: def get_db():
8:     if 'db' not in g:
9:         g.db = sqlite3.connect(app.config['DATABASE'])
10:         g.db.row_factory = sqlite3.Row
11:         g.db.executescript("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user'); INSERT INTO users (username,role) VALUES ('alice','user'),('bob','admin');")
12:     return g.db
13: 
14: @app.teardown_appcontext
15: def close_db(e=None):
16:     db=g.pop('db',None)
17:     if db: db.close()
18: 
19: @app.before_request
20: def load_user():
21:     user_id = session.get('user_id')
22:     g.user = get_db().execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone() if user_id else None
23: 
24: def role_required(role):
25:     def decorator(f):
26:         @functools.wraps(f)
27:         def decorated(*args, **kwargs):
28:             if g.user is None:
29:                 return redirect(url_for('login'))
30:             if g.user['role'] != role:
31:                 return f'Access denied. Required: {role}. Your role: {g.user["role"]}', 403
32:             return f(*args, **kwargs)
33:         return decorated
34:     return decorator
35: 
36: @app.route('/admin')
37: @role_required('admin')
38: def admin_panel(): return '<h1>Admin Panel</h1>'
```
We now enforce authorization using fresh data from the database.

### Mechanical walkthrough
- `def load_user():` defines a function to run before every request.
- `user_id = session.get('user_id')` retrieves the ID from the session cookie.
- `g.user = get_db().execute(...)` assigns the database record to `g.user`.
- `def role_required(role):` defines a decorator factory that takes a `role` argument.
- `if g.user['role'] != role:` compares the user's live role from the DB to the required role.

### CS lens
Cache invalidation. A session cookie is a cache of user state. By moving the role out of the cookie and into a per-request database lookup, we trade some performance for immediate consistency — removing the risk of stale authorization state.

### SE lens
Centralizing user loading in `@app.before_request` means individual view functions and decorators can assume `g.user` is populated. This DRYs up the code and provides a consistent interface for accessing user data.

### Commands needed
Run: python app.py

### Run it
Output: `Role checked from DB via g.user: cannot be spoofed by editing session cookie`

### One sentence connecting to previous unit
Role-based authorization checks if you belong to a specific group, but what if we need to check if you own a specific piece of data?


## Concept Unit: Resource-level authorization — does this user own this item?

### The Problem
Roles are global, but many actions are local to a specific resource. If Alice is an authenticated user, she should be able to view her own notes, but she shouldn't be able to view Bob's notes just by changing the ID in the URL. How do we verify ownership of a specific resource?

### Introduce the concept in isolation
```python
import sqlite3, secrets
from flask import Flask, session, g, abort
app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL); CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, body TEXT); INSERT INTO users (username) VALUES ('alice'),('bob'); INSERT INTO notes (user_id,title,body) VALUES (1,'Alice Note','Private'),(2,'Bob Note','Also private');")
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db=g.pop('db',None)
    if db: db.close()

@app.route('/notes/<int:note_id>')
def get_note(note_id):
    user_id = session.get('user_id')
    if not user_id:
        abort(401)
    
    note = get_db().execute('SELECT * FROM notes WHERE id=?', (note_id,)).fetchone()
    if note is None:
        abort(404)
        
    if note['user_id'] != user_id:
        abort(403)  # authenticated, but does not own this note
        
    return f'Note: {note["title"]} | {note["body"]}'

with app.test_request_context():
    print('Row-level auth: always check user_id ownership before returning data')
```
We load the resource by its ID, and then explicitly check if its `user_id` matches the session's `user_id`.

### Discard the throwaway
This throwaway code is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** Adding a new route to the file.
- **Dependencies:** None.

### The New Code
```python
@app.route('/notes/<int:note_id>')
def get_note(note_id):
    user_id = session.get('user_id')
    if not user_id:
        abort(401)
    
    note = get_db().execute('SELECT * FROM notes WHERE id=?', (note_id,)).fetchone()
    if note is None:
        abort(404)
        
    if note['user_id'] != user_id:
        abort(403)
        
    return f'Note: {note["title"]} | {note["body"]}'
```

### The Updated Project
```python
1: @app.route('/notes/<int:note_id>')
2: def get_note(note_id):
3:     user_id = session.get('user_id')
4:     if not user_id:
5:         abort(401)
6:     
7:     note = get_db().execute('SELECT * FROM notes WHERE id=?', (note_id,)).fetchone()
8:     if note is None:
9:         abort(404)
10:         
11:     if note['user_id'] != user_id:
12:         abort(403)
13:         
14:     return f'Note: {note["title"]} | {note["body"]}'
```
We verify that the resource actually belongs to the authenticated user.

### Mechanical walkthrough
- `@app.route('/notes/<int:note_id>')` maps the URL pattern containing an integer ID.
- `if not user_id:` checks if the user is authenticated.
- `abort(401)` returns a 401 Unauthorized error immediately.
- `note = get_db().execute(...)` retrieves the row from the database.
- `if note['user_id'] != user_id:` checks if the resource's owner ID matches the session's user ID.
- `abort(403)` returns a 403 Forbidden error if ownership validation fails.

### CS lens
Insecure Direct Object Reference (IDOR). This vulnerability occurs when a system trusts the client-provided ID (`note_id`) and uses it directly without authorization checks. Always enforce access control rules on the server side.

### SE lens
An alternative, and often safer, implementation is to include the `user_id` directly in the SQL query: `SELECT * FROM notes WHERE id=? AND user_id=?`. This pushes the authorization check into the database layer, completely preventing the retrieval of unauthorized data.

### Commands needed
Run: python app.py

### Run it
Output: `Row-level auth: always check user_id ownership before returning data`

### One sentence connecting to previous unit
We've seen multiple types of checks (authentication, role-based, ownership); let's see how we can consolidate some of these checks cleanly.


## Concept Unit: Combining authentication and authorization checks cleanly

### The Problem
Writing multiple decorators or inline checks for every route becomes repetitive and error-prone. How do we create a single, flexible mechanism to declare varying security requirements for our routes?

### Introduce the concept in isolation
```python
import sqlite3, secrets, functools
from flask import Flask, session, g, abort, redirect, url_for
app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, role TEXT DEFAULT 'user'); INSERT INTO users (username,role) VALUES ('alice','user'),('admin_bob','admin');")
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db=g.pop('db',None)
    if db: db.close()

@app.before_request
def load_user():
    uid = session.get('user_id')
    g.user = get_db().execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone() if uid else None

def require(*, authenticated=True, role=None, fresh=False):
    def decorator(f):
        @functools.wraps(f)
        def decorated(*args, **kwargs):
            if authenticated and g.user is None:
                return redirect(url_for('login'))
            if role and (g.user is None or g.user['role'] != role):
                abort(403)
            if fresh and not session.get('_fresh', False):
                return redirect(url_for('login'))  # need re-authentication
            return f(*args, **kwargs)
        return decorated
    return decorator

@app.route('/login')
def login(): return 'Login page'

@app.route('/admin/users')
@require(role='admin')
def admin_users(): return 'Admin: user list'

@app.route('/account/delete')
@require(authenticated=True, fresh=True)
def delete_account(): return 'Account deleted (needs fresh login)'

with app.test_request_context():
    print('@require(role="admin"): must be logged in AND have admin role')
```
We define a comprehensive `@require` decorator that accepts keyword arguments to toggle different security checks.

### Discard the throwaway
This throwaway code is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** Replace
- **Location:** Replacing previous individual decorators.
- **Dependencies:** None.

### The New Code
```python
def require(*, authenticated=True, role=None, fresh=False):
    def decorator(f):
        @functools.wraps(f)
        def decorated(*args, **kwargs):
            if authenticated and g.user is None:
                return redirect(url_for('login'))
            if role and (g.user is None or g.user['role'] != role):
                abort(403)
            if fresh and not session.get('_fresh', False):
                return redirect(url_for('login'))
            return f(*args, **kwargs)
        return decorated
    return decorator
```

### The Updated Project
```python
1: def require(*, authenticated=True, role=None, fresh=False):
2:     def decorator(f):
3:         @functools.wraps(f)
4:         def decorated(*args, **kwargs):
5:             if authenticated and g.user is None:
6:                 return redirect(url_for('login'))
7:             if role and (g.user is None or g.user['role'] != role):
8:                 abort(403)
9:             if fresh and not session.get('_fresh', False):
10:                 return redirect(url_for('login'))
11:             return f(*args, **kwargs)
12:         return decorated
13:     return decorator
14: 
15: @app.route('/admin/users')
16: @require(role='admin')
17: def admin_users(): return 'Admin: user list'
```
We can now declarative state the security requirements for any route.

### Mechanical walkthrough
- `def require(*, authenticated=True, role=None, fresh=False):` defines a decorator factory using keyword-only arguments (enforced by the `*`).
- `if authenticated and g.user is None:` checks the basic authentication condition.
- `if role and (g.user is None or g.user['role'] != role):` conditionally evaluates role requirements.
- `if fresh and not session.get('_fresh', False):` checks a special session flag to ensure the user logged in recently, not via a long-lived "remember me" token.

### CS lens
Declarative programming. Instead of writing imperative control flow (`if/else`) inside every route, we declare the rules upfront in the decorator signature. The framework handles the evaluation logic.

### SE lens
A unified `@require` decorator creates a single source of truth for access control logic. If you need to add auditing, logging, or change how roles are evaluated, you only have to update this one function.

### Commands needed
Run: python app.py

### Run it
Output: `@require(role="admin"): must be logged in AND have admin role`

### One sentence connecting to previous unit
Securing the backend is critical, but we also need to ensure our frontend reflects these permissions accurately.


## Concept Unit: What to show unauthorized users — UI considerations

### The Problem
If a user is not an administrator, they shouldn't see a link to the Admin Panel. However, hiding the link in the UI does not prevent them from typing the URL directly into their browser. How do we approach UI visibility versus actual security?

### Introduce the concept in isolation
```python
import secrets
from flask import Flask, session, g, render_template_string
app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

TEMPLATE = '''
<nav>
    <a href="/">Home</a>
    {% if g.user %}
        <a href="/dashboard">Dashboard</a>
        {% if g.user.role == 'admin' %}
            <a href="/admin">Admin</a>  <!-- hidden from non-admins -->
        {% endif %}
        <form method="POST" action="/logout" style="display:inline">
            <button>Logout</button>
        </form>
    {% else %}
        <a href="/login">Login</a>
    {% endif %}
</nav>
'''

@app.route('/')
def index():
    class FakeUser:
        role = 'user'
        username = 'alice'
    g.user = FakeUser()
    return render_template_string(TEMPLATE)

with app.test_request_context():
    print('Template: hide admin link from non-admins (UX only, NOT security)')
```
We use conditional logic in our template to show or hide the Admin link based on the user's role.

### Discard the throwaway
This throwaway code is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** Inside the template rendering.
- **Dependencies:** Jinja2 (included with Flask).

### The New Code
```python
# Simulated template snippet showing UI logic
TEMPLATE = '''
{% if g.user and g.user.role == 'admin' %}
    <a href="/admin">Admin</a>
{% endif %}
'''
```

### The Updated Project
```python
1: TEMPLATE = '''
2: <nav>
3:     <a href="/">Home</a>
4:     {% if g.user %}
5:         <a href="/dashboard">Dashboard</a>
6:         {% if g.user.role == 'admin' %}
7:             <a href="/admin">Admin</a>
8:         {% endif %}
9:         <form method="POST" action="/logout" style="display:inline">
10:             <button>Logout</button>
11:         </form>
12:     {% else %}
13:         <a href="/login">Login</a>
14:     {% endif %}
15: </nav>
16: '''
```
The navigation menu dynamically adapts to the user's state.

### Mechanical walkthrough
- `{% if g.user %}` is a Jinja2 template tag that checks if `g.user` is truthy (the user is logged in).
- `{% if g.user.role == 'admin' %}` checks the user's specific role property.
- `<a href="/admin">Admin</a>` is only rendered and sent to the client if the condition is true.

### CS lens
Defense in depth. You apply multiple layers of defense. The UI layer hides the affordance (the button or link) to improve User Experience (UX) and prevent confusion. The backend routing layer enforces the actual security constraint (AuthZ) preventing execution.

### SE lens
Never rely on the client (the browser) for security. An attacker can use `curl`, Postman, or simply manually type the URL to bypass any UI-level hiding. Security must always be enforced on the server.

### Commands needed
Run: python app.py

### Run it
Output: `Template: hide admin link from non-admins (UX only, NOT security)`

### One sentence connecting to previous unit
By combining robust backend enforcement with adaptive frontend rendering, we create an application that is both secure and user-friendly.

## Closing

### Connect the pieces
Authentication and Authorization are distinct responsibilities. Authentication establishes identity (who you are), while authorization evaluates policy against that identity (what you can do). By implementing backend checks using decorators and ensuring data ownership checks at the resource level, we secure our application against unauthorized access. We simultaneously adapt the UI to hide restricted actions, providing defense in depth—combining strong server-side security with a clean user experience.
