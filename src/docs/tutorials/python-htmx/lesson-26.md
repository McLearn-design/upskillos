# Lesson 26: Login-Required Decorator — functools.wraps, Redirects, and current_user

What you will build
In this lesson, you will build a suite of authentication enforcement mechanisms to protect application routes. You will implement standard and parameterized decorators to enforce login state, a request-scoped cache for the current user object, a freshness check for sensitive actions, and a secure logout process. The transferable problem this solves is applying cross-cutting concerns (like access control) cleanly across multiple functions without duplicating the validation logic, all while preserving the web framework's routing metadata.

What you need to know first
- Lesson 25's basic Flask setup and session initialization logic.

Terms used in this lesson
- **Decorator** — A function that takes another function and extends its behavior without explicitly modifying it. It solves the problem of needing to inject reusable logic before or after many different functions across a codebase.
- **Decorator factory** — A function that returns a decorator, allowing you to pass arguments to the decorator itself. It solves the problem of parameterizing decorator behavior when the target function alone isn't enough context.
- **Session** — A mechanism to store data across requests for a specific client. It solves the HTTP statelessness problem by persisting information (like user identity) in a signed cookie.
- **Endpoint** — The internal name Flask uses to identify a route. It solves the problem of decoupling URLs from the view functions that handle them, preventing hardcoded paths.
- **Closure** — A technique where an inner function captures the state of the outer function. It solves the problem of maintaining state or arguments inside a dynamically generated function over time.
- **Context Local** — An object that appears global but actually points to data specific to the current thread or request. It solves the problem of passing request state down the call stack without adding it as a parameter to every function.

Objects and methods used
- **`functools.wraps`**
  - *What it is:* A helper function that updates a wrapper function to look like the wrapped function.
  - *Implementation:* `@functools.wraps(wrapped_func)`
  - *Its use:* Preserves the `__name__` and `__doc__` of the original view function so Flask doesn't confuse route endpoints.
  - *Type:* Decorator factory.
  - *Responsibility:* Copies identifying metadata from one function object to another to mask the wrapping layer.
  - *Depends on:* The original function being wrapped.
  - *Connects to:* Modifies the wrapper function object (the caller).
  - *Shape:* A standard library utility used at the definition seam of higher-order functions.
- **`flask.redirect`**
  - *What it is:* A function that returns a response object instructing the client to navigate to a different URL.
  - *Implementation:* `redirect(location)`
  - *Its use:* Bounces unauthenticated users to the login page when they attempt to access protected views.
  - *Type:* Standard function.
  - *Responsibility:* Generates a valid HTTP 302 response with the `Location` header set.
  - *Depends on:* A target URL string.
  - *Connects to:* Called by route handlers, returns data to the Flask framework layer.
  - *Shape:* A response factory at the controller boundary.
- **`flask.url_for`**
  - *What it is:* A function that builds a URL for a specific endpoint.
  - *Implementation:* `url_for(endpoint, **values)`
  - *Its use:* Dynamically resolves the login route URL instead of hardcoding `/login`, while appending the destination to return to.
  - *Type:* Standard function.
  - *Responsibility:* Maps an internal function name to an external path, appending query parameters for extra arguments.
  - *Depends on:* An endpoint string and optional keyword arguments.
  - *Connects to:* Reads the app's URL map and generates a string for `redirect`.
  - *Shape:* A routing utility used internally by view logic.
- **`flask.request`**
  - *What it is:* A global proxy object representing the current HTTP request.
  - *Implementation:* `request.path`, `request.headers.get('HX-Request')`
  - *Its use:* Checks where the user was trying to go (`request.path`) and whether the request came from HTMX (`HX-Request`).
  - *Type:* Context local object.
  - *Responsibility:* Exposes all incoming HTTP data (URL, headers, form data) to the view.
  - *Depends on:* An active Flask request context.
  - *Connects to:* Read by view functions or decorators.
  - *Shape:* The input boundary from the client.
- **`flask.session`**
  - *What it is:* A dictionary-like object representing the client's secure cookie session.
  - *Implementation:* `session.get('user_id')`, `session.clear()`
  - *Its use:* Checks if a user is logged in, and clears authentication data on logout.
  - *Type:* Context local dictionary.
  - *Responsibility:* Serializes, signs, and deserializes state between the server and the client's cookie.
  - *Depends on:* An active Flask request context and the app's `SECRET_KEY`.
  - *Connects to:* Read/modified by views; Flask handles writing it to the `Set-Cookie` header.
  - *Shape:* The state management boundary across requests.
- **`flask.g`**
  - *What it is:* A namespace object for storing data during a single request context.
  - *Implementation:* `g.user = user_row`
  - *Its use:* Stores the database row of the current user so views don't have to repeatedly query the database.
  - *Type:* Context local object.
  - *Responsibility:* Caches arbitrary data per-request, clearing it automatically when the request ends.
  - *Depends on:* An active Flask request context.
  - *Connects to:* Written by `before_request` hooks, read by views and templates.
  - *Shape:* Request-scoped internal memory.
- **`sqlite3.Row`**
  - *What it is:* A highly optimized row factory for SQLite that allows name-based access to columns.
  - *Implementation:* `g.user = get_db().execute(...).fetchone()` returning a Row object.
  - *Its use:* Provides dictionary-like access to database results.
  - *Type:* Class instance.
  - *Responsibility:* Wraps a tuple of database columns and exposes them via string keys.
  - *Depends on:* A database query execution.
  - *Connects to:* Produced by the `sqlite3` cursor, consumed by Python views or Jinja2 templates.
  - *Shape:* The data-transfer object from the database tier.

## Concept Unit: Writing the login_required decorator

### The Problem
We have multiple views in our application (like `/dashboard` and `/settings`) that should only be accessible if the user is authenticated. We could write an `if 'user_id' not in session:` check at the top of every single view function, but that leads to massive code duplication and makes it easy to accidentally leave a route unprotected.
- If you had 50 routes, how would you ensure that a change to the authentication logic propagates to all of them?
- What Python feature allows you to wrap existing functions with reusable behavior without altering their internals?
- If Flask registers URLs by inspecting the name of the function, what happens if we replace all our view functions with a generic wrapper function?

### Introduce the concept in isolation
```python
import functools

def simple_decorator(f):
    def wrapper(*args, **kwargs):
        return f(*args, **kwargs)
    return wrapper

def wrapping_decorator(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        return f(*args, **kwargs)
    return wrapper

@simple_decorator
def function_one(): pass

@wrapping_decorator
def function_two(): pass

print("function_one name:", function_one.__name__)
print("function_two name:", function_two.__name__)
```
Output (stated directly without execution, from certainty of standard Python behavior):
```
function_one name: wrapper
function_two name: function_two
```
This proves that a **decorator** without `functools.wraps` overwrites the original function's identity (its name becomes the wrapper's name). Flask relies on function names to generate endpoints. `functools.wraps` copies the original name and metadata over to the wrapper so it masquerades perfectly.

### Discard the throwaway
This snippet is deleted and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are introducing route protection.
- **Files affected:** `app.py`
- **Change type:** add
- **Location:** At the top level, above the route definitions.
- **Dependencies:** `functools`, `flask.redirect`, `flask.url_for`, `flask.request`

### The New Code
```python
def login_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login', next=request.path))
        return f(*args, **kwargs)
    return decorated
```

### The Updated Project
```python
1:  import functools, secrets
2:  from flask import Flask, session, redirect, url_for, request
3:  
4:  app = Flask(__name__)
5:  app.config['SECRET_KEY'] = secrets.token_hex(32)
6:  
7:  # ← new
8:  def login_required(f):
9:      @functools.wraps(f)
10:     def decorated(*args, **kwargs):
11:         if 'user_id' not in session:
12:             return redirect(url_for('login', next=request.path))
13:         return f(*args, **kwargs)
14:     return decorated
15: # ← new
16: 
17: @app.route('/dashboard')
18: @login_required
19: def dashboard():
20:     return f'<h1>Welcome, {session.get("username", "User")}!</h1>'
21: 
22: @app.route('/settings')
23: @login_required
24: def settings():
25:     return '<h1>Settings</h1>'
```
We added the decorator definition and applied it to multiple route functions.

### Mechanical walkthrough
- `def login_required(f):` declares the outer decorator function. It takes the target view function `f` as its single argument.
- `@functools.wraps(f)` applies the metadata preservation wrapper to the inner function.
- `def decorated(*args, **kwargs):` defines the inner wrapper function that will actually execute when the route is requested, capturing any arguments Flask passes to the route.
- `if 'user_id' not in session:` checks if the authentication identifier is missing from the secure cookie.
- `url_for('login', next=request.path)` builds the target URL for the login page, attaching a `next` query parameter containing the URL the user originally requested.
- `return redirect(...)` issues an HTTP 302 response to bounce the user.
- `return f(*args, **kwargs)` executes the original view function if the authentication check passes.
- `return decorated` returns the constructed wrapper function to replace the original function in memory.

### CS lens
A decorator is an implementation of a higher-order function: a function that takes a function as input and returns a function as output. In Python, the `@` syntax is syntactic sugar for `f = decorator(f)`.

### SE lens
This is the Aspect-Oriented Programming (AOP) pattern applied to cross-cutting concerns. Authentication is an aspect of the application that intersects with many endpoints, but doesn't belong in the core business logic of any of them. Extracting it to a decorator separates the "who can do this" policy from the "what this does" logic.

### Commands needed
Run: python app.py

### Run it
Output (stated from standard behavior): When navigating to `/dashboard` while unauthenticated, the server intercepts the request and responds with a 302 Redirect to `/login?next=/dashboard`.

### One sentence connecting to previous unit
Now that we have a standard mechanism to bounce unauthenticated users to a login page, we need to adapt it to handle AJAX requests from HTMX, which require a different style of redirect.

## Concept Unit: Decorator with arguments — login_required with redirect_to

### The Problem
Our current `@login_required` decorator hardcodes a redirect to the `'login'` endpoint via a 302 HTTP status code. But what if we have an API route that should return a JSON error, or an HTMX endpoint where a standard 302 redirect causes HTMX to swap the entire login page into a tiny `<div>`?
- How do we pass a parameter to a decorator?
- What happens if we try to call a decorator like `@login_required(redirect_to='api_login')` instead of `@login_required`?
- If an HTMX request receives a 302, it follows it using AJAX; how do we tell HTMX to do a full page redirect instead?

### Introduce the concept in isolation
```python
def multiply_by(factor):
    def decorator(f):
        def wrapper(*args, **kwargs):
            return f(*args, **kwargs) * factor
        return wrapper
    return decorator

@multiply_by(factor=10)
def add_one(x):
    return x + 1

print(add_one(3))
```
Output (stated directly from certainty): `40`
This proves that a **decorator factory** is a function that returns a decorator. Because `@` evaluates the expression to its right, `@multiply_by(10)` calls the factory, receives the inner `decorator` function, and then applies *that* to `add_one`. The innermost `wrapper` uses a closure to remember the `factor`.

### Discard the throwaway
This snippet is deleted and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** replace
- **Location:** Replacing the previous `login_required` decorator.
- **Dependencies:** `flask.make_response`

### The New Code
```python
def login_required(redirect_to='login'):
    def decorator(f):
        @functools.wraps(f)
        def decorated(*args, **kwargs):
            if 'user_id' not in session:
                if request.headers.get('HX-Request') == 'true':
                    from flask import make_response
                    resp = make_response('', 401)
                    resp.headers['HX-Redirect'] = url_for(redirect_to)
                    return resp
                return redirect(url_for(redirect_to, next=request.path))
            return f(*args, **kwargs)
        return decorated
    return decorator
```

### The Updated Project
```python
7:  # ← new (replacement)
8:  def login_required(redirect_to='login'):
9:      def decorator(f):
10:         @functools.wraps(f)
11:         def decorated(*args, **kwargs):
12:             if 'user_id' not in session:
13:                 if request.headers.get('HX-Request') == 'true':
14:                     from flask import make_response
15:                     resp = make_response('', 401)
16:                     resp.headers['HX-Redirect'] = url_for(redirect_to)
17:                     return resp
18:                 return redirect(url_for(redirect_to, next=request.path))
19:             return f(*args, **kwargs)
20:         return decorated
21:     return decorator
22: 
23: @app.route('/profile')
24: @login_required()
25: def profile():
26:     return f'Profile for user {session["user_id"]}'
27: 
28: @app.route('/api/data')
29: @login_required(redirect_to='login')
30: def api_data():
31:     return '{"data": 42}'
32: # ← new
```
We replaced the simple decorator with a factory that inspects the request headers and conditionally issues an `HX-Redirect` response for HTMX requests. Note the use of `@login_required()`.

### Mechanical walkthrough
- `def login_required(redirect_to='login'):` is the factory function that captures the configuration parameter.
- `def decorator(f):` is the actual decorator that will receive the target function.
- `if request.headers.get('HX-Request') == 'true':` checks if the request was initiated by an HTMX attribute (like `hx-get` or `hx-post`).
- `make_response('', 401)` creates an empty HTTP response with an Unauthorized status code.
- `resp.headers['HX-Redirect'] = url_for(redirect_to)` sets a custom HTMX header instructing the client-side library to trigger a full-page client-side redirect.
- `@login_required()` with parentheses executes the factory to generate the decorator, which is then applied.

### CS lens
By nesting three levels of functions, we are utilizing closures. The innermost `decorated` function retains access to both the target function `f` (from the middle scope) and the configuration parameter `redirect_to` (from the outermost scope).

### SE lens
This pattern enables graceful degradation and multi-client support from a single backend route. By sniffing the headers, the same endpoint handles standard browser navigation (returning an HTTP 302) and AJAX requests (returning a 401 with a special header), preventing the classic SPA problem of rendering a full HTML login page inside a partial widget.

### Commands needed
Run: python app.py

### Run it
Output (stated from expected behavior): Fetching `/api/data` via an `HX-Request` header results in an empty 401 response containing the `HX-Redirect: /login` header.

### One sentence connecting to previous unit
Now that routes are protected and redirect properly, we need a way for the application to easily access the data of the currently logged-in user without re-querying the database in every view.

## Concept Unit: current_user pattern — loading user from session

### The Problem
If a user is logged in, their `user_id` is in the session cookie. However, most views need more than just an ID — they need the user's username, email, or role. Querying the database manually in every view is tedious and repetitive.
- Where can we store a database row so that it is available to all views, but destroyed when the HTTP request finishes?
- How do we run a piece of code automatically before every single request?
- How do we pass this user object into Jinja2 templates without explicitly injecting it into every `render_template` call?

### Introduce the concept in isolation
```python
from flask import Flask, g, request
app = Flask(__name__)

@app.before_request
def setup_data():
    g.my_value = "Hello World"

@app.route('/')
def index():
    return g.my_value

with app.test_client() as c:
    print(c.get('/').data.decode())
```
Output (stated from certainty): `Hello World`
This proves that **`flask.g`** is a global-looking namespace that is actually tied to the lifecycle of a specific request. `before_request` hooks run automatically, and anything attached to `g` becomes immediately accessible to route handlers downstream.

### Discard the throwaway
This snippet is deleted and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** add
- **Location:** Between the database setup functions and the routes.
- **Dependencies:** `flask.g`, `sqlite3.Row`

### The New Code
```python
@app.before_request
def load_logged_in_user():
    user_id = session.get('user_id')
    if user_id is None:
        g.user = None
    else:
        g.user = get_db().execute('SELECT id,username,email FROM users WHERE id=?', (user_id,)).fetchone()
```

### The Updated Project
```python
32: def get_db():
33:     if 'db' not in g:
34:         g.db = sqlite3.connect(app.config['DATABASE'])
35:         g.db.row_factory = sqlite3.Row
36:     return g.db
37: 
38: # ← new
39: @app.before_request
40: def load_logged_in_user():
41:     user_id = session.get('user_id')
42:     if user_id is None:
43:         g.user = None
44:     else:
45:         g.user = get_db().execute('SELECT id,username,email FROM users WHERE id=?', (user_id,)).fetchone()
46: # ← new
47: 
48: @app.route('/me')
49: def me():
50:     if g.user is None:
51:         return 'Not logged in.', 401
52:     return f'Hello, {g.user["username"]} ({g.user["email"]})'
```
We registered a hook to hydrate the user state globally on every request.

### Mechanical walkthrough
- `@app.before_request` registers the decorated function to run before the view function for every incoming HTTP request.
- `session.get('user_id')` safely attempts to extract the ID, returning `None` if the cookie is missing or invalid.
- `g.user = None` explicitly clears the value on `g` if unauthenticated, guaranteeing `g.user` always exists and preventing `AttributeError` later.
- `get_db().execute(...)` performs a parameterized query for the user row.
- `.fetchone()` returns a `sqlite3.Row` object, which acts like a dictionary and is stored in `g.user`.

### CS lens
This is the Context Object pattern. The request context acts as a thread-safe singleton per request, eliminating the need to pass context variables down explicitly through deep call stacks (parameter tunneling).

### SE lens
By hydrating the user object once globally, we achieve two major software engineering benefits: we eliminate redundant database queries if multiple functions in the request cycle need the user data, and we guarantee a consistent, single source of truth for the user's state across the entire request, ensuring views and templates never see a mismatched or stale version of the user object.

### Commands needed
Run: python app.py

### Run it
Output (stated from expected behavior): Navigating to `/me` while logged in automatically queries the database once and returns `Hello, alice (alice@x.com)`.

### One sentence connecting to previous unit
While the session persists a user's logged-in state across requests, highly sensitive actions require verifying that this authentication happened recently, not days ago.

## Concept Unit: fresh_login_required — requiring recent authentication

### The Problem
If a user checks a "Remember Me" box, their session cookie might be valid for a month. This is fine for browsing, but dangerous if they walk away from their unlocked laptop and someone tries to delete their account or change their password.
- How can we distinguish between a session that was created 5 minutes ago versus 20 days ago?
- When a user performs a sensitive action, how do we temporarily suspend their request and force them to re-enter their password?
- What data needs to be added to the session cookie at the exact moment of login?

### Introduce the concept in isolation
```python
import time

login_time = time.time() - 1000  # simulated 1000 seconds ago
TIMEOUT = 900

if time.time() - login_time > TIMEOUT:
    print("Session too old, re-authenticate")
else:
    print("Session fresh")
```
Output (stated from certainty): `Session too old, re-authenticate`
This proves that by comparing the current Unix timestamp (`time.time()`) against a **stored timestamp**, we can measure elapsed duration and enforce absolute freshness constraints on a state that is otherwise technically valid.

### Discard the throwaway
This snippet is deleted and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** add
- **Location:** Below `login_required`.
- **Dependencies:** `time`

### The New Code
```python
REAUTH_TIMEOUT = 900

def fresh_login_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login', next=request.path))
        
        login_time = session.get('login_time', 0)
        if time.time() - login_time > REAUTH_TIMEOUT:
            session.pop('user_id', None)
            session['reauth_next'] = request.path
            return redirect(url_for('login'))
            
        return f(*args, **kwargs)
    return decorated
```

### The Updated Project
```python
15:                     return resp
16:                 return redirect(url_for(redirect_to, next=request.path))
17:             return f(*args, **kwargs)
18:         return decorated
19:     return decorator
20: 
21: # ← new
22: REAUTH_TIMEOUT = 900  # 15 minutes
23: 
24: def fresh_login_required(f):
25:     @functools.wraps(f)
26:     def decorated(*args, **kwargs):
27:         if 'user_id' not in session:
28:             return redirect(url_for('login', next=request.path))
29:         
30:         login_time = session.get('login_time', 0)
31:         if time.time() - login_time > REAUTH_TIMEOUT:
32:             session.pop('user_id', None)
33:             session['reauth_next'] = request.path
34:             return redirect(url_for('login'))
35:             
36:         return f(*args, **kwargs)
37:     return decorated
38: # ← new
39: 
40: @app.route('/account/delete', methods=['POST'])
41: @fresh_login_required
42: def delete_account():
43:     return '<p>Account deleted.</p>'
```
We added a second, stricter decorator for high-risk actions. (Note: the login route must now `session['login_time'] = time.time()` on successful login).

### Mechanical walkthrough
- `REAUTH_TIMEOUT = 900` sets the threshold to 15 minutes.
- `if 'user_id' not in session:` is the baseline check; you must be logged in first.
- `login_time = session.get('login_time', 0)` retrieves the timestamp when the user originally provided their password. Defaults to `0` (the Unix epoch) if missing, automatically triggering the expiry branch.
- `time.time() - login_time > REAUTH_TIMEOUT:` checks the mathematical difference between now and the login time against the threshold.
- `session.pop('user_id', None)` deliberately drops the user's authentication claim, revoking the session.
- `session['reauth_next'] = request.path` saves the target path so the login route can redirect back here after the password is re-verified.

### CS lens
This implements a time-to-live (TTL) invalidation strategy. Rather than maintaining stateful server-side session expiration timers, the expiry is enforced statelessly at the time of access by evaluating a cryptographically signed timestamp against the server's current clock.

### SE lens
Security UX is about balancing friction and safety. Forcing a login on every click is unusable; never expiring a session is unsafe. A dual-tier access model (base login vs. fresh login) applies friction only to destructive operations (account deletion, password changes) while leaving standard read operations frictionless.

### Commands needed
Run: python app.py

### Run it
Output (stated from expected behavior): Submitting a POST to `/account/delete` 20 minutes after login pops the user's session and redirects them to `/login` to prove they are still at the keyboard.

### One sentence connecting to previous unit
If we can revoke a session programmatically on a timeout, we must also provide a way for the user to revoke it deliberately.

## Concept Unit: Logout — proper session invalidation

### The Problem
When a user is done, they click a "Log Out" button. To end their access, the server needs to forget their identity.
- How do we remove data from a signed cookie?
- Why must a logout route use a `POST` request instead of a simple `GET` link (`<a href="/logout">`)?
- What happens if an attacker places `<img src="https://yoursite.com/logout">` on a malicious third-party forum?

### Introduce the concept in isolation
```python
my_session = {'user_id': 1, 'username': 'alice', 'login_time': 1700000000}
my_session.clear()
print(my_session)
```
Output (stated from certainty): `{}`
This proves that calling `clear()` on a dictionary-like object drops all keys simultaneously, leaving an empty structure. In Flask, clearing the session object forces the framework to write an empty, signed session cookie back to the client.

### Discard the throwaway
This snippet is deleted and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** add
- **Location:** A new route at the bottom of the file.
- **Dependencies:** None

### The New Code
```python
@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return redirect(url_for('login'))
```

### The Updated Project
```python
45: @app.route('/account/delete', methods=['POST'])
46: @fresh_login_required
47: def delete_account():
48:     return '<p>Account deleted.</p>'
49: 
50: # ← new
51: @app.route('/logout', methods=['POST'])
52: def logout():
53:     session.clear()
54:     return redirect(url_for('login'))
55: # ← new
```
We created a POST-only logout endpoint that dumps the entire session object.

### Mechanical walkthrough
- `@app.route('/logout', methods=['POST'])` restricts the route to HTTP POST methods. GET requests will receive a 405 Method Not Allowed error.
- `session.clear()` calls the dictionary `.clear()` method on the context local session proxy. This removes `user_id`, `username`, `login_time`, and anything else stored there.
- Flask automatically sees that the session was modified, signs the empty dictionary with `SECRET_KEY`, and sends a `Set-Cookie` header to the browser overwriting the old cookie.
- `return redirect(...)` bounces the now-unauthenticated user back to the login interface.

### CS lens
Session destruction is state transition from an authenticated state graph node to an unauthenticated one. Cryptographically, because we use client-side signed cookies rather than server-side session stores, we cannot physically destroy the old cookie on the user's hard drive; we instead instruct the browser to overwrite it with an empty valid state.

### SE lens
Restricting logout to `POST` prevents Cross-Site Request Forgery (CSRF). If logout were a `GET` route, any other website on the internet could include an invisible `<img>` tag pointing to your `/logout` URL. Because browsers automatically send cookies with image requests, the user would be abruptly logged out of your app simply by visiting a malicious site. By requiring a `POST`, and combined with modern `SameSite=Lax` cookie flags, cross-site logout vectors are effectively neutralized.

### Commands needed
Run: python app.py

### Run it
Output (stated from expected behavior): Sending a POST request to `/logout` clears the session data and returns a 302 redirect. Subsequent requests to protected routes will fail the `login_required` check.

### One sentence connecting to previous unit
With decorators protecting routes, global context hydrating the user, and secure login/logout flows established, the core authentication perimeter is complete.

## Closing

### Connect the pieces
Let's trace an unauthenticated user attempting to access a secure feature. 
1. The user requests `GET /dashboard`.
2. The `@login_required` decorator fires. It checks `session.get('user_id')`.
3. Finding no user, it suspends execution of `dashboard()`. It generates a redirect to `/login?next=/dashboard` and returns a 302.
4. The user logs in via a POST request. The server sets `session['user_id'] = 1` and `session['login_time'] = time.time()`.
5. The login endpoint redirects the user back to the `next` parameter (`/dashboard`).
6. The user requests `GET /dashboard` again, now carrying the signed cookie.
7. The `@app.before_request` hook fires. It reads `session['user_id']`, queries the database, and attaches the Row to `g.user`.
8. The `@login_required` decorator fires. It reads `session['user_id']`. It passes, and calls `dashboard()`.
9. `dashboard()` accesses `g.user['username']` and returns the personalized HTML.
Through this cycle, the decorators protect the endpoints, the session maintains the state statelessly, and the request context shares the database load across the system.
