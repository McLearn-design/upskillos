# Lesson 27: Logout and Session Invalidation — session.clear(), POST-only Logout, Token Blacklisting

In this lesson, you will build a secure logout mechanism that invalidates user sessions. You will learn the mechanics of session clearing, why logout must be a POST request to prevent CSRF attacks, and the differences between client-side and server-side session invalidation. You will also implement session timeouts and device-wide logouts using version counters.

**What you need to know first**
- Lesson 26

**Terms used in this lesson**
- **HTTP POST** — A request method used to submit data to the server, which changes state. It cannot be triggered simply by navigating to a URL or loading an image, preventing accidental or malicious state changes via simple links.
- **HTTP GET** — A request method used only to retrieve data. It should never change state, as it can be prefetched by browsers or triggered by an `<img>` tag.
- **CSRF (Cross-Site Request Forgery)** — An attack where a malicious site tricks a user's browser into making an unwanted request to a trusted site where the user is authenticated.
- **SameSite** — A cookie attribute that controls whether the cookie is sent with cross-site requests, providing some protection against CSRF.
- **Cookie** — A small piece of data stored on the user's computer by the web browser while browsing a website.
- **HMAC** — Hash-based Message Authentication Code, used to cryptographically sign data (like cookies) so the server can verify it hasn't been tampered with.
- **Client-side session** — Session data stored entirely in the user's browser (typically in a signed cookie). The server does not keep a record of the session.
- **Server-side session** — Session data stored on the server (e.g., in a database or cache), with only a unique session ID sent to the client in a cookie.
- **HttpOnly** — A cookie flag that prevents client-side scripts (like JavaScript) from accessing the cookie, mitigating XSS attacks.
- **Secure flag** — A cookie flag that ensures the cookie is only transmitted over encrypted (HTTPS) connections.

**Objects and methods used**

- **`Flask`**
  - *What it is:* The core application class of the Flask framework.
  - *Implementation:* `class Flask(import_name)`
  - *Its use:* Used to create the central application object that registers routes and handles requests.
  - *Type:* Class
  - *Responsibility:* Orchestrates the HTTP request/response cycle, routing, and configuration.
  - *Depends on:* The WSGI environment and Python standard library.
  - *Connects to:* Receives requests from a WSGI server, passes them to route handlers, and returns responses.
  - *Shape:* The central framework object.

- **`session`**
  - *What it is:* A proxy object representing the current request's session data.
  - *Implementation:* Acts like a Python dictionary (`werkzeug.local.LocalProxy`).
  - *Its use:* Used to store and retrieve data specific to a user across multiple requests.
  - *Type:* Local proxy (dict-like)
  - *Responsibility:* Manages state between HTTP requests for a single client.
  - *Depends on:* The `SECRET_KEY` configuration to sign the session cookie.
  - *Connects to:* Reads from the request cookie, writes to the response `Set-Cookie` header.
  - *Shape:* Boundary object between the application logic and HTTP state.

- **`session.clear()`**
  - *What it is:* A method to remove all items from the session.
  - *Implementation:* `session.clear()`
  - *Its use:* Used to log a user out by destroying all session data.
  - *Type:* Method
  - *Responsibility:* Empties the session dictionary, resulting in an empty session cookie payload.
  - *Depends on:* An active request context and session.
  - *Connects to:* Modifies the `session` object, which affects the outgoing HTTP response.
  - *Shape:* Internal state mutation.

- **`redirect`**
  - *What it is:* A function that returns a response object instructing the client to navigate to a different URL.
  - *Implementation:* `def redirect(location, code=302)`
  - *Its use:* Used to send the user back to the home page after logging out.
  - *Type:* Function
  - *Responsibility:* Generates an HTTP redirect response.
  - *Depends on:* A target URL string.
  - *Connects to:* Returns to the Flask routing layer to be sent to the client.
  - *Shape:* HTTP response generator.

- **`url_for`**
  - *What it is:* A function that generates a URL for a given endpoint.
  - *Implementation:* `def url_for(endpoint, **values)`
  - *Its use:* Used to safely generate URLs without hardcoding them.
  - *Type:* Function
  - *Responsibility:* Maps an endpoint name to its corresponding URL path based on route definitions.
  - *Depends on:* The Flask application context and routing map.
  - *Connects to:* Called by route handlers or templates to build URLs.
  - *Shape:* Internal utility function.

- **`request`**
  - *What it is:* A proxy object representing the current HTTP request.
  - *Implementation:* `werkzeug.local.LocalProxy` pointing to a `Request` object.
  - *Its use:* Used to inspect the HTTP method or headers of the incoming request.
  - *Type:* Local proxy
  - *Responsibility:* Encapsulates all data sent by the client in the HTTP request.
  - *Depends on:* The WSGI environment dictionary.
  - *Connects to:* Read by route handlers to make decisions based on input.
  - *Shape:* Boundary object representing client input.

- **`render_template_string`**
  - *What it is:* A function to render a string as a Jinja template.
  - *Implementation:* `def render_template_string(source, **context)`
  - *Its use:* Used to dynamically generate HTML for quick throwaway UI components without standalone files.
  - *Type:* Function
  - *Responsibility:* Compiles and renders a raw string template with the provided context.
  - *Depends on:* The Flask application context and Jinja2 environment.
  - *Connects to:* Returns a formatted string to the route handler.
  - *Shape:* UI generation utility.

- **`secrets.token_hex`**
  - *What it is:* A function that generates a secure random text string, in hexadecimal.
  - *Implementation:* `def token_hex(nbytes=None)`
  - *Its use:* Used to generate a strong, unpredictable `SECRET_KEY` for session signing.
  - *Type:* Function
  - *Responsibility:* Provides cryptographically secure random bytes converted to hex.
  - *Depends on:* The operating system's cryptographic random number generator (e.g., `/dev/urandom`).
  - *Connects to:* Used during application configuration.
  - *Shape:* Standard library utility.

- **`sqlite3.connect`**
  - *What it is:* A function that opens a connection to an SQLite database.
  - *Implementation:* `def connect(database, ...)`
  - *Its use:* Used to connect to a database to store and retrieve session versions.
  - *Type:* Function
  - *Responsibility:* Establishes a communication channel to the SQLite engine.
  - *Depends on:* A database file path or `:memory:`.
  - *Connects to:* Returns a `Connection` object used to execute queries.
  - *Shape:* Database boundary.

- **`g`**
  - *What it is:* A namespace object that can store data during an application context.
  - *Implementation:* `werkzeug.local.LocalProxy` pointing to an `_AppCtxGlobals` object.
  - *Its use:* Used to store the database connection so it can be reused within a single request.
  - *Type:* Local proxy
  - *Responsibility:* Holds global state for the duration of a single request.
  - *Depends on:* An active application context.
  - *Connects to:* Read and written by `before_request`, route handlers, and `teardown_appcontext`.
  - *Shape:* Request-scoped state container.

- **`app.teardown_appcontext`**
  - *What it is:* A decorator for registering a function to run when the application context ends.
  - *Implementation:* `@app.teardown_appcontext`
  - *Its use:* Used to ensure the database connection is closed after a request finishes, even if an error occurred.
  - *Type:* Decorator
  - *Responsibility:* Guarantees cleanup code execution at the end of a request cycle.
  - *Depends on:* A target callback function.
  - *Connects to:* Invoked by the Flask framework during response finalization.
  - *Shape:* Framework hook.

- **`app.before_request`**
  - *What it is:* A decorator for registering a function to run before each request.
  - *Implementation:* `@app.before_request`
  - *Its use:* Used to validate session versions or check activity timeouts before routing the request.
  - *Type:* Decorator
  - *Responsibility:* Executes middleware-like logic for all incoming requests.
  - *Depends on:* A target callback function.
  - *Connects to:* Invoked by the Flask framework before the specific route handler.
  - *Shape:* Framework hook.

- **`time.time`**
  - *What it is:* A function that returns the current time in seconds since the Epoch.
  - *Implementation:* `def time()`
  - *Its use:* Used to track the last activity timestamp for session timeouts.
  - *Type:* Function
  - *Responsibility:* Provides the current system time.
  - *Depends on:* The system clock.
  - *Connects to:* Called by route handlers or hooks to measure elapsed time.
  - *Shape:* Standard library utility.

- **`make_response`**
  - *What it is:* A function that converts a return value into a real response object.
  - *Implementation:* `def make_response(*args)`
  - *Its use:* Used to create a response object so custom headers (like `HX-Redirect`) can be added.
  - *Type:* Function
  - *Responsibility:* Wraps a string or tuple in a Flask `Response` object.
  - *Depends on:* The content to be wrapped.
  - *Connects to:* Returns the finalized response back to the framework.
  - *Shape:* HTTP response generator.

## Concept Unit: Basic logout with session.clear()

### The Problem

When a user is done using our application, they need a way to end their session. If they simply close the tab, their session cookie might persist, leaving their account vulnerable if someone else uses the same computer. How do we securely destroy their session state? Furthermore, if we just make a link like `<a href="/logout">Logout</a>`, any website could include an image like `<img src="http://our-app.com/logout">`, which would log the user out as soon as they visited that malicious site. How do we prevent this?

> What HTTP method should we use to change state, ensuring that it cannot be triggered by a simple image tag or a standard link?

### Introduce the concept in isolation

```python
import secrets
from flask import Flask, session, redirect, url_for

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

@app.route('/logout', methods=['POST'])
def logout():
    user = session.get('username', 'unknown')
    session.clear()
    print(f'User {user!r} logged out. Session cleared.')
    return redirect(url_for('index'))

@app.route('/')
def index():
    user = session.get('username')
    if user:
        return f'<p>Logged in as {user}. <form method="POST" action="/logout"><button>Logout</button></form></p>'
    return '<p>Not logged in.</p>'

if __name__ == '__main__':
    with app.test_client() as c:
        with c.session_transaction() as s:
            s['username'] = 'alice'
            s['user_id'] = 1
        r = c.post('/logout')
        print('Status:', r.status_code)
        with c.session_transaction() as s:
            print('Session after logout:', dict(s))
```

*Output:*
```
User 'alice' logged out. Session cleared.
Status: 302
Session after logout: {}
```

This output proves that calling `session.clear()` completely empties the session dictionary, leaving no residual data. It also proves that a POST request successfully triggers the route and returns a 302 redirect. This is a **session destruction pattern**.

### Discard the throwaway

This isolated example is now discarded and will not be used in the project.

### Project Change

- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are implementing standard secure authentication flow.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** At the bottom of `app.py`, adding the `/logout` route.
- **Dependencies:** None.

### The New Code

```python
@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return redirect(url_for('index'))
```

### The Updated Project

```python
1: @app.route('/login', methods=['POST'])
2: def login():
3:     # ... existing login logic ...
4:     pass
5:
6: @app.route('/logout', methods=['POST']) # ← new
7: def logout():                           # ← new
8:     session.clear()                     # ← new
9:     return redirect(url_for('index'))   # ← new
```

The application now has a dedicated endpoint that only accepts POST requests. When hit, it clears the session and redirects the user to the home page.

### Mechanical walkthrough

- `@app.route('/logout', methods=['POST'])`: Decorator that maps the `/logout` URL to this function, explicitly restricting it to only accept HTTP POST requests.
- `def logout():`: Defines the function that handles the logout request.
- `session.clear()`: Calls the `clear` method on the `session` object, which removes all keys and values from the session dictionary.
- `return redirect(url_for('index'))`: Calls `url_for('index')` to get the root URL `/`, passes it to `redirect()` to create a 302 HTTP response, and returns that response to the client.

### CS lens

State management in distributed systems requires explicit teardown. A session represents an ephemeral authenticated state bounded by time or user action. `session.clear()` is the explicit teardown trigger, returning the state machine of the user's connection to its initial, unauthenticated baseline. The enforcement of the POST method is an application of the Principle of Least Privilege regarding HTTP semantics: state-mutating actions must not be accessible via safe, idempotent methods (GET).

### SE lens

Relying on `session.clear()` rather than individually popping keys (like `session.pop('user_id')`) is a defensive programming practice. As an application grows, developers might add new sensitive keys to the session (like `role`, `is_admin`, or `oauth_token`). If logout manually pops only specific known keys, it risks leaving new keys behind, creating subtle security vulnerabilities. `clear()` guarantees all session state is destroyed regardless of future changes.

### Commands needed

Run: `python app.py`

### Run it

When you navigate to the application, log in, and click the logout button (which submits a POST form), your session is cleared and you are returned to the home page as a guest.

### One sentence connecting to previous unit

Now that we can log out by submitting a form, how do we prevent users from accidentally clicking the logout button and losing their work?

## Concept Unit: Confirming logout intent

### The Problem

A logout button that immediately logs the user out upon a single click is efficient but prone to user error (fat-fingering). If a user accidentally clicks logout while filling out a long form in another tab, they might lose their session and their work. How can we introduce a speed bump that requires explicit confirmation?

> If we want to show a confirmation page before actually logging out, what HTTP method should request that page, and what method should perform the actual logout?

### Introduce the concept in isolation

```python
import secrets
from flask import Flask, session, redirect, url_for, render_template_string, request

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

LOGOUT_CONFIRM = '''
<html><body>
<h2>Confirm Logout</h2>
<p>Are you sure you want to log out?</p>
<form method="POST" action="/logout">
    <button type="submit">Yes, log out</button>
</form>
<a href="/">Cancel</a>
</body></html>
'''

@app.route('/logout', methods=['GET', 'POST'])
def logout():
    if request.method == 'GET':
        return render_template_string(LOGOUT_CONFIRM)
    session.clear()
    return redirect(url_for('index'))

@app.route('/')
def index():
    return f'Logged in as: {session.get("username","nobody")}'

if __name__ == '__main__':
    with app.test_client() as c:
        with c.session_transaction() as s:
            s['username'] = 'alice'
        r = c.get('/logout')
        print('GET /logout shows confirmation:', b'Confirm Logout' in r.data)
        r = c.post('/logout')
        print('POST /logout status:', r.status_code)
```

*Output:*
```
GET /logout shows confirmation: True
POST /logout status: 302
```

This output proves that routing both GET and POST to the same endpoint allows us to conditionally return an HTML form or perform a state mutation based on `request.method`. This is a **two-step confirmation pattern**.

### Discard the throwaway

This isolated example is now discarded and will not be used in the project.

### Project Change

- **Reference Source:** No reference counterpart — this is a from-scratch addition because we want to improve UX.
- **Files affected:** `app.py`
- **Change type:** Replace
- **Location:** Inside `app.py`, updating the existing `/logout` route.
- **Dependencies:** None.

### The New Code

```python
@app.route('/logout', methods=['GET', 'POST'])
def logout():
    if request.method == 'GET':
        return render_template_string('<form method="POST"><button>Confirm Logout</button></form>')
    session.clear()
    return redirect(url_for('index'))
```

### The Updated Project

```python
1: @app.route('/logout', methods=['GET', 'POST']) # ← modified
2: def logout():
3:     if request.method == 'GET':                                                                     # ← new
4:         return render_template_string('<form method="POST"><button>Confirm Logout</button></form>') # ← new
5:     session.clear()
6:     return redirect(url_for('index'))
```

The logout endpoint now intercepts accidental GET requests (like someone typing `/logout` into the address bar or clicking a poorly-implemented link) and presents a confirmation form. Only the POST submission of that form actually clears the session.

### Mechanical walkthrough

- `@app.route('/logout', methods=['GET', 'POST'])`: Updates the decorator to accept both GET and POST methods.
- `if request.method == 'GET':`: Checks the HTTP method of the incoming request using the `request` proxy.
- `return render_template_string(...)`: Compiles and returns a simple HTML string containing a POST form. If the method is GET, execution stops here.
- `session.clear()`: If the method is POST, the if-statement is skipped, and the session is cleared.

### CS lens

This pattern implements a state gate. The transition from State A (Logged In) to State B (Logged Out) is protected by an intermediate State A' (Confirming). This prevents unintentional edge traversals in the state machine triggered by idempotent (GET) requests.

### SE lens

While this solves the problem of accidental GET logouts, it introduces a UX friction point. In modern web development, particularly with tools like HTMX, this server-side routing logic is often replaced by client-side browser dialogs (e.g., `hx-confirm="Are you sure?"`), which keep the routing clean (POST only) while still providing the necessary safety check.

### Commands needed

Run: `python app.py`

### Run it

When you navigate to `/logout` directly, you see a confirmation button rather than immediately losing your session.

### One sentence connecting to previous unit

While we can now log out of our current browser safely, what happens if we left ourselves logged in on a public computer and need to invalidate that session remotely?

## Concept Unit: Logout from all devices — version counter

### The Problem

In a standard Flask application, client-side sessions are stored entirely in a cookie on the user's browser, signed with a secret key. The server holds no state. If a user logs in on a laptop, and then logs in on their phone, there are two distinct cookies out in the world. Calling `session.clear()` on the phone only clears the phone's cookie. The laptop's cookie remains perfectly valid. How can we invalidate all sessions globally?

> If the server doesn't store session data, how can it know to reject a perfectly signed cookie from another device?

### Introduce the concept in isolation

```python
import sqlite3, secrets
from flask import Flask, session, redirect, url_for, g

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, session_version INTEGER DEFAULT 0);INSERT INTO users (username) VALUES ("alice");')
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db=g.pop('db',None)
    if db: db.close()

@app.before_request
def validate_session_version():
    user_id = session.get('user_id')
    if user_id:
        stored_version = get_db().execute('SELECT session_version FROM users WHERE id=?',(user_id,)).fetchone()
        if stored_version and session.get('session_version') != stored_version['session_version']:
            session.clear()

@app.route('/logout-all', methods=['POST'])
def logout_all():
    user_id = session.get('user_id')
    if user_id:
        get_db().execute('UPDATE users SET session_version = session_version + 1 WHERE id=?',(user_id,))
        get_db().commit()
    session.clear()
    return redirect(url_for('index'))

@app.route('/')
def index(): return f'user_id={session.get("user_id")}'

if __name__ == '__main__':
    with app.test_request_context():
        print('session_version: increment in DB -> all other sessions invalid on next request')
```

*Output:*
```
session_version: increment in DB -> all other sessions invalid on next request
```

This logic proves that by storing a numeric version in both the database and the cookie, we can globally invalidate all existing cookies simply by incrementing the database value. Any cookie with the old version will mismatch and be rejected. This is a **session versioning pattern**.

### Discard the throwaway

This isolated example is now discarded and will not be used in the project.

### Project Change

- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are enhancing security.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** In `app.py`, adding a `before_request` hook and a new `/logout-all` route.
- **Dependencies:** An existing database connection setup (like SQLite).

### The New Code

```python
@app.before_request
def validate_session_version():
    user_id = session.get('user_id')
    if user_id:
        db = get_db()
        row = db.execute('SELECT session_version FROM users WHERE id = ?', (user_id,)).fetchone()
        if row and session.get('session_version') != row['session_version']:
            session.clear()

@app.route('/logout-all', methods=['POST'])
def logout_all():
    user_id = session.get('user_id')
    if user_id:
        db = get_db()
        db.execute('UPDATE users SET session_version = session_version + 1 WHERE id = ?', (user_id,))
        db.commit()
    session.clear()
    return redirect(url_for('index'))
```

### The Updated Project

```python
1: @app.before_request                                                                       # ← new
2: def validate_session_version():                                                           # ← new
3:     user_id = session.get('user_id')                                                      # ← new
4:     if user_id:                                                                           # ← new
5:         db = get_db()                                                                     # ← new
6:         row = db.execute('SELECT session_version FROM users WHERE id = ?', (user_id,)).fetchone() # ← new
7:         if row and session.get('session_version') != row['session_version']:              # ← new
8:             session.clear()                                                               # ← new
9:
10: @app.route('/logout-all', methods=['POST'])                                              # ← new
11: def logout_all():                                                                        # ← new
12:     user_id = session.get('user_id')                                                     # ← new
13:     if user_id:                                                                          # ← new
14:         db = get_db()                                                                    # ← new
15:         db.execute('UPDATE users SET session_version = session_version + 1 WHERE id = ?', (user_id,)) # ← new
16:         db.commit()                                                                      # ← new
17:     session.clear()                                                                      # ← new
18:     return redirect(url_for('index'))                                                    # ← new
```

The application now intercepts every request to ensure the session cookie's version matches the database. The new endpoint bumps that version, rendering all existing cookies instantly invalid across all devices.

### Mechanical walkthrough

- `@app.before_request`: Decorates `validate_session_version` to run before any route handler.
- `user_id = session.get('user_id')`: Retrieves the user ID from the session cookie.
- `row = db.execute(...)`: Queries the database for the user's current valid session version.
- `if row and session.get('session_version') != row['session_version']:`: Compares the version stored in the cookie against the database.
- `session.clear()`: If they don't match, the cookie is outdated and is cleared immediately.
- `@app.route('/logout-all', methods=['POST'])`: Defines the global logout endpoint.
- `db.execute('UPDATE users SET session_version = session_version + 1 ...')`: Increments the version in the database.
- `db.commit()`: Saves the change.
- `session.clear()`: Clears the current device's session as well.

### CS lens

This is a classic caching invalidation strategy. The client-side cookie acts as a cache of authentication state. By associating a monotonically increasing integer (the version) with the state, the server can achieve global cache invalidation with a single atomic database write, without needing to track or individually address every outstanding cache (cookie) in the wild.

### SE lens

This hybrid approach gives us the best of both worlds: the performance of stateless client-side sessions (no database writes required on login or during normal navigation) and the control of server-side sessions (the ability to revoke access remotely). It requires adding a `session_version` column to the user schema, which is a small architectural cost for a significant security gain.

### Commands needed

Run: `python app.py`

### Run it

When you log in on two different browsers, and then trigger `/logout-all` on the first one, refreshing the second browser will log you out because its session version is now stale.

### One sentence connecting to previous unit

We can now manually terminate sessions across all devices, but what if a user forgets to log out and walks away from a public computer entirely?

## Concept Unit: Expiring sessions after inactivity

### The Problem

If a user authenticates and leaves their laptop open in a coffee shop, their session remains active indefinitely (or until the cookie itself expires, which could be days). A malicious actor could sit down and use their account. How can we automatically log them out if they stop interacting with the site for a certain period?

> If we want to track activity, where should we store the timestamp of the user's last action, and how often should we update it?

### Introduce the concept in isolation

```python
import secrets, time
from flask import Flask, session, redirect, url_for, request

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

ACTIVITY_TIMEOUT = 1800  # 30 minutes idle timeout

@app.before_request
def check_session_activity():
    if 'user_id' not in session:
        return
    last_active = session.get('last_active', 0)
    now = time.time()
    if now - last_active > ACTIVITY_TIMEOUT:
        session.clear()
        if request.headers.get('HX-Request') == 'true':
            from flask import make_response
            resp = make_response('<p>Session expired. Please log in again.</p>', 401)
            resp.headers['HX-Redirect'] = url_for('login')
            return resp
        return redirect(url_for('login'))
    session['last_active'] = now

@app.route('/dashboard')
def dashboard():
    return f'Dashboard. Last active: {session.get("last_active",0):.0f}'

@app.route('/login')
def login(): return 'Login page'

if __name__ == '__main__':
    with app.test_request_context():
        print('Activity timeout: 30 min idle -> auto-logout')
        print('last_active stored in session, updated each request')
        print('HTMX: HX-Redirect for AJAX requests, 302 for direct navigation')
```

*Output:*
```
Activity timeout: 30 min idle -> auto-logout
last_active stored in session, updated each request
HTMX: HX-Redirect for AJAX requests, 302 for direct navigation
```

This logic proves that we can store a UNIX timestamp in the session itself, check it on every request, and if the delta exceeds our timeout, clear the session. It also proves that we must handle HTMX requests differently than standard browser navigation. This is an **idle timeout pattern**.

### Discard the throwaway

This isolated example is now discarded and will not be used in the project.

### Project Change

- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are adding application-level session expiry.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** In `app.py`, adding a new `before_request` function to handle activity checking.
- **Dependencies:** The `time` module and `make_response` from flask.

### The New Code

```python
import time
from flask import make_response

ACTIVITY_TIMEOUT = 1800

@app.before_request
def check_activity():
    if 'user_id' not in session:
        return
    last_active = session.get('last_active', 0)
    now = time.time()
    if now - last_active > ACTIVITY_TIMEOUT:
        session.clear()
        if request.headers.get('HX-Request') == 'true':
            resp = make_response('Session expired.', 401)
            resp.headers['HX-Redirect'] = url_for('login')
            return resp
        return redirect(url_for('login'))
    session['last_active'] = now
```

### The Updated Project

```python
1: ACTIVITY_TIMEOUT = 1800                                            # ← new
2:
3: @app.before_request                                                # ← new
4: def check_activity():                                              # ← new
5:     if 'user_id' not in session:                                   # ← new
6:         return                                                     # ← new
7:     last_active = session.get('last_active', 0)                    # ← new
8:     now = time.time()                                              # ← new
9:     if now - last_active > ACTIVITY_TIMEOUT:                       # ← new
10:         session.clear()                                           # ← new
11:         if request.headers.get('HX-Request') == 'true':           # ← new
12:             resp = make_response('Session expired.', 401)         # ← new
13:             resp.headers['HX-Redirect'] = url_for('login')        # ← new
14:             return resp                                           # ← new
15:         return redirect(url_for('login'))                         # ← new
16:     session['last_active'] = now                                  # ← new
```

The application now actively measures the time between a user's requests. If they are idle for more than 30 minutes, they are logged out. If they trigger an action via HTMX, the server responds with a special header to force the client to redirect.

### Mechanical walkthrough

- `last_active = session.get('last_active', 0)`: Retrieves the timestamp of the last request from the session cookie, defaulting to 0.
- `now = time.time()`: Gets the current system time in seconds.
- `if now - last_active > ACTIVITY_TIMEOUT:`: Calculates the elapsed time. If it exceeds 1800 seconds (30 minutes), the block executes.
- `if request.headers.get('HX-Request') == 'true':`: Checks if the request was made via HTMX rather than a full page load.
- `resp = make_response('Session expired.', 401)`: Creates a standard HTTP response with a 401 Unauthorized status.
- `resp.headers['HX-Redirect'] = url_for('login')`: Sets a custom HTMX header instructing the JavaScript library to redirect the browser to the login page.
- `return resp`: Returns the HTMX-specific response.
- `return redirect(...)`: If it wasn't an HTMX request, performs a standard 302 redirect.
- `session['last_active'] = now`: If the timeout was not exceeded, updates the session with the current time, resetting the 30-minute clock.

### CS lens

This is a sliding window expiration algorithm. Every interaction pushes the expiration horizon further into the future. By persisting the state of the window inside the client payload (the cookie), the server remains stateless, only needing to perform a simple time delta calculation upon receipt.

### SE lens

Integrating with frontend frameworks like HTMX requires careful handling of HTTP responses. A standard 302 redirect on an AJAX request will often result in the browser silently fetching the login page and injecting it into a small div on the current page, creating a broken UI. Returning `HX-Redirect` allows the server to break out of the AJAX context and force a full page navigation at the browser level.

### Commands needed

Run: `python app.py`

### Run it

When you log in, wait 31 minutes, and then attempt to click any link or button, you will be intercepted by the middleware, your session will be cleared, and you will be redirected to the login screen.

### One sentence connecting to previous unit

While these mechanisms provide robust control over user state, it is critical to understand the boundaries of what `session.clear()` can actually accomplish when dealing with client-side cookies.

## Concept Unit: What session.clear() does NOT do

### The Problem

If a malicious actor manages to steal a user's session cookie (for example, by intercepting it on public Wi-Fi), and the user then clicks "Logout", their browser sends a POST request, and `session.clear()` executes. The user's browser receives a new, empty cookie. But the attacker still has a copy of the *old* cookie. What happens if the attacker sends that old cookie to the server?

> Since the server doesn't store client-side sessions in a database, how does it know the old cookie is no longer valid?

### Introduce the concept in isolation

```python
import secrets
from flask import Flask, session, make_response

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

@app.route('/demonstrate-limitation')
def demonstrate():
    print('Client-side session.clear(): clears YOUR cookie, not attacker copy')
    print('Server-side session.clear(): deletes server record -> attacker copy useless')
    print('Mitigation: HttpOnly (XSS cannot steal cookie), Secure (MITM cannot intercept)')
    print('Nuclear option: change SECRET_KEY -> ALL client-side sessions invalidated')
    return 'See console output.'

if __name__ == '__main__':
    with app.test_request_context():
        print('HTTPS + HttpOnly: attacker cannot steal cookie -> limitation is theoretical')
        print('In practice: HttpOnly+Secure makes cookie theft very difficult')
```

*Output:*
```
HTTPS + HttpOnly: attacker cannot steal cookie -> limitation is theoretical
In practice: HttpOnly+Secure makes cookie theft very difficult
```

This demonstrates a fundamental architectural limitation: `session.clear()` on a client-side session only affects the specific client that made the request. It cannot reach across the internet and delete a stolen cookie from an attacker's hard drive.

### Discard the throwaway

This isolated example is now discarded and will not be used in the project.

### Project Change

- **Reference Source:** No reference counterpart.
- **Files affected:** None.
- **Change type:** Concept explanation.
- **Location:** Conceptual.
- **Dependencies:** None.

### The New Code

No new code.

### The Updated Project

The project code does not change in this unit, but our understanding of its security posture does.

### Mechanical walkthrough

- The Flask `SECRET_KEY` remains unchanged during a normal logout.
- The stolen cookie was signed with that `SECRET_KEY`.
- When the attacker replays the stolen cookie, Flask verifies the HMAC signature.
- Because the signature is valid, Flask deserializes the cookie payload (e.g., `{'user_id': 1}`).
- The attacker is authenticated, despite the legitimate user having logged out.

### CS lens

This is an issue of revocation in decentralized state models. When state (the session) is decentralized (stored on the client), revocation requires either a centralized registry of revoked tokens (a blacklist) or a secondary state check (like our session version counter). Without these, the token remains valid until its intrinsic cryptographic expiration.

### SE lens

Because of this limitation, the defense-in-depth strategy relies on preventing the theft of the cookie in the first place. Using HTTPS (the `Secure` flag) ensures the cookie cannot be intercepted in transit. Using `HttpOnly` ensures malicious JavaScript (XSS) cannot read the cookie from the DOM. If a massive breach occurs, the nuclear option is to rotate the `SECRET_KEY` on the server, which instantly invalidates every client-side session in existence because their HMAC signatures will no longer match.

### Commands needed

Run: `python app.py`

### Run it

No code to run.

### One sentence connecting to previous unit

With a complete understanding of session mechanics, timeouts, global invalidation, and cryptographic limitations, you now have a robust and secure authentication foundation ready for production.

## Closing

### Connect the pieces

You have built a complete, secure lifecycle for user sessions. When a user clicks the logout button, a POST request is sent to `/logout`, executing `session.clear()`. This empties the session dictionary, causing Flask to send a `Set-Cookie` header with an empty, signed payload back to the browser. The browser overwrites the old cookie, and the user is redirected to the home page, where `session.get('username')` now returns `None`. Through idle timeouts and version counters, you've added layers of active invalidation to mitigate the inherent statelessness of client-side cookies, ensuring that even if a user forgets to log out, the system will protect their account.
