# Lesson 25: User Login — Verify Hash, Create Session, Redirect

What you will build
We will build the user login flow: displaying a login form, verifying the user's password against the stored Argon2 hash, preventing timing attacks, setting up a secure session (including 'remember me' functionality), and safely redirecting the user. The core transferable insights are that login consists of these precise steps, that we must return generic error messages to prevent username enumeration, and that we must always execute the expensive hashing operation to prevent timing attacks.

What you need to know first
- Lesson 24

Terms used in this lesson
- **Timing attack** — An attack where the time taken to respond to a request reveals information about the system, such as whether a username exists. We solve this by always performing the same expensive operations.
- **Username enumeration** — An attack where an adversary can determine which usernames are valid by observing differences in error messages or response times. We prevent this by returning generic "Invalid credentials" messages.
- **Session fixation** — An attack where an adversary sets a user's session identifier. Clearing the session before logging in prevents this.
- **Open redirect** — A vulnerability where an attacker can supply a malicious URL in a `next` parameter, redirecting a user to a phishing site after login. We prevent this by validating URLs to ensure they are relative.
- **hx-post** — HTMX attribute to issue a POST request on form submission, avoiding full page reloads.
- **hx-target** — HTMX attribute specifying where to place the response in the DOM.
- **hx-push-url** — HTMX attribute to push the new URL to the browser history.

Objects and methods used
- **Flask**
  - What it is: The web application object.
  - Implementation: `class Flask`
  - Its use: Serves as the central application registry.
  - Type: Class.
  - Responsibility: Manages routing, configuration, and request dispatch.
  - Depends on: Configuration variables.
  - Connects to: Routes and request context.
  - Shape: Application framework core.

- **render_template**
  - What it is: Function to render a Jinja2 template.
  - Implementation: `def render_template(template_name, **context)`
  - Its use: Renders HTML with dynamic context for the login form.
  - Type: Function.
  - Responsibility: Combines a template with context variables to produce a string.
  - Depends on: The template file and context variables.
  - Connects to: Flask application context.
  - Shape: View layer rendering function.

- **PasswordHasher**
  - What it is: Argon2 password hashing utility.
  - Implementation: `class PasswordHasher`
  - Its use: Hashes and verifies passwords securely.
  - Type: Class.
  - Responsibility: Executes the Argon2 algorithm for hashing and verification.
  - Depends on: Raw password inputs and stored hashes.
  - Connects to: The authentication logic.
  - Shape: Security library.

- **PasswordHasher.verify**
  - What it is: Method to verify a password against a hash.
  - Implementation: `def verify(hash, password)`
  - Its use: Checks if the provided password matches the database hash.
  - Type: Instance method.
  - Responsibility: Validates credentials securely.
  - Depends on: Stored hash and plain-text password.
  - Connects to: PasswordHasher instance.
  - Shape: Authentication boundary.

- **request**
  - What it is: The current HTTP request object.
  - Implementation: Local proxy to request context.
  - Its use: Accesses submitted form data from the user.
  - Type: Proxy object.
  - Responsibility: Encapsulates all data from the client's HTTP request.
  - Depends on: The active Flask request context.
  - Connects to: The route handler.
  - Shape: Request context.

- **session**
  - What it is: The user session dictionary.
  - Implementation: Local proxy to session context.
  - Its use: Stores user ID and username across requests.
  - Type: Proxy object (dict-like).
  - Responsibility: Maintains state between HTTP requests via signed cookies.
  - Depends on: Flask SECRET_KEY.
  - Connects to: The browser via cookies.
  - Shape: State management.

- **redirect**
  - What it is: Function to create a 302 redirect response.
  - Implementation: `def redirect(location)`
  - Its use: Sends the user to a different page after successful login.
  - Type: Function.
  - Responsibility: Generates an HTTP redirect response.
  - Depends on: The target URL.
  - Connects to: The client browser.
  - Shape: Response generator.

- **url_for**
  - What it is: URL generation function.
  - Implementation: `def url_for(endpoint, **values)`
  - Its use: Safely generates URLs for named routes like the dashboard.
  - Type: Function.
  - Responsibility: Resolves endpoint names to URLs based on routing rules.
  - Depends on: Flask routing table.
  - Connects to: `redirect` or templates.
  - Shape: Routing utility.

- **urlparse**
  - What it is: Function to parse URLs into components.
  - Implementation: `def urlparse(url)`
  - Its use: Inspects a redirect target to ensure it is relative.
  - Type: Function.
  - Responsibility: Breaks a URL string into structural pieces (scheme, netloc, path, etc.).
  - Depends on: The raw URL string.
  - Connects to: Open-redirect validation logic.
  - Shape: Standard library URL utility.

## Concept Unit: The login form

### The Problem
We need a way for the user to submit their credentials to our application. How do we collect a username and password securely while integrating with HTMX to provide a smooth user experience?

### Introduce the concept in isolation
Here is how we render a login form that leverages HTMX for submissions.

```python
from flask import Flask, render_template_string

app = Flask(__name__)

@app.route('/login', methods=['GET'])
def login_get():
    template = """
    <h1>Login</h1>
    {% if error %}
    <div class="alert error">{{ error }}</div>
    {% endif %}
    <form method="POST" action="/login" hx-post="/login" hx-target="body" hx-push-url="true">
        <input type="text" name="username" autocomplete="username" required>
        <input type="password" name="password" autocomplete="current-password" required>
        <button type="submit">Login</button>
    </form>
    """
    return render_template_string(template, error=None)

with app.test_request_context('/login'):
    print(login_get())
```

When run, this produces the HTML form. HTMX attributes intercept the form submission to send a POST request via AJAX, replacing the body content with the response and updating the browser URL.

### Discard the throwaway
This standalone inline template is discarded. We will use a proper template file in the project.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition.
- **Files affected:** `templates/login.html` (created), `app.py` (modified)
- **Change type:** Add
- **Location:** In `app.py`, adding a new route for `GET /login`.
- **Dependencies:** Flask, HTMX in the base template.

### The New Code
```html
<!-- templates/login.html -->
<h1>Login</h1>
{% if error %}
<div class="alert error">{{ error }}</div>
{% endif %}
<form method="POST" action="/login"
      hx-post="/login"
      hx-target="body"
      hx-push-url="true">
    <div class="field">
        <label>Username</label>
        <input type="text" name="username"
               autocomplete="username" required>
    </div>
    <div class="field">
        <label>Password</label>
        <input type="password" name="password"
               autocomplete="current-password" required>
    </div>
    <label>
        <input type="checkbox" name="remember"> Remember me
    </label>
    <button type="submit">Login</button>
    <p><a href="/register">Don't have an account? Register</a></p>
</form>
```
```python
# In app.py
@app.route('/login', methods=['GET'])
def login_get():
    return render_template('login.html', error=None)
```

### The Updated Project
```html
1: <!-- templates/login.html -->
2: <h1>Login</h1>
3: {% if error %}
4: <div class="alert error">{{ error }}</div>
5: {% endif %}
6: <!-- ← new: The form uses hx-post to submit via HTMX -->
7: <form method="POST" action="/login"
8:       hx-post="/login"
9:       hx-target="body"
10:      hx-push-url="true">
11:    <div class="field">
12:        <label>Username</label>
13:        <input type="text" name="username" autocomplete="username" required>
14:    </div>
15:    <div class="field">
16:        <label>Password</label>
17:        <input type="password" name="password" autocomplete="current-password" required>
18:    </div>
19:    <label><input type="checkbox" name="remember"> Remember me</label>
20:    <button type="submit">Login</button>
21: </form>
```
The application can now serve a login form.

### Mechanical walkthrough
- We define a route `@app.route('/login', methods=['GET'])` that responds to GET requests.
- `render_template('login.html', error=None)` renders the template, passing `None` for the error.
- In the template, `{% if error %}` evaluates to false, so the alert div is not rendered.
- The `<form>` includes `hx-post="/login"` to submit the data asynchronously.
- `hx-target="body"` tells HTMX to replace the entire body with the server response.
- `hx-push-url="true"` updates the browser's URL bar, maintaining history.
- The inputs use `autocomplete` attributes to assist password managers.

### CS lens
Form submissions are a state transition in a web application. HTMX enables these transitions to happen dynamically by manipulating the DOM directly based on server responses, bridging the gap between traditional multi-page applications and modern single-page applications without requiring heavy client-side JavaScript.

### SE lens
Providing proper `autocomplete` attributes (`username` and `current-password`) is a critical user experience and security practice. It ensures that password managers can easily identify fields, reducing friction for users with strong, generated passwords.

### Commands needed
None.

### Run it
No new commands to run. The server can render the form.

### One sentence connecting to previous unit
Now that we have a form to submit credentials, we need the backend logic to verify them against our database.

## Concept Unit: Lookup and verify

### The Problem
Once the user submits their credentials, we must verify them securely. We need to look up the user by username, verify the hashed password, and establish a session if valid, while preventing username enumeration.

### Introduce the concept in isolation
We verify credentials using Argon2, and clear the session before login to prevent fixation.

```python
import sqlite3, secrets
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from flask import Flask, request, redirect, url_for, session, g

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')
ph = PasswordHasher()

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password_hash TEXT);")
        g.db.execute("INSERT INTO users (username, password_hash) VALUES ('alice', ?)", (ph.hash('secret123'),))
        g.db.commit()
    return g.db

with app.test_request_context(method='POST', data={'username': 'alice', 'password': 'secret123'}):
    username = request.form.get('username')
    password = request.form.get('password')
    user = get_db().execute('SELECT id, password_hash FROM users WHERE username=?', (username,)).fetchone()
    
    if user:
        try:
            ph.verify(user['password_hash'], password)
            session.clear()
            session['user_id'] = user['id']
            print(f"Logged in user_id: {session['user_id']}")
        except VerifyMismatchError:
            print("Invalid credentials")
```
Output:
`Logged in user_id: 1`
This demonstrates checking a password against a hash and setting a session upon success.

### Discard the throwaway
This script is discarded. We will implement this securely in our routing logic.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified)
- **Change type:** Add
- **Location:** In `app.py`, adding a POST handler for `/login`.
- **Dependencies:** `argon2`, `sqlite3`

### The New Code
```python
INVALID_MSG = 'Invalid username or password.'

@app.route('/login', methods=['POST'])
def login_post():
    username = request.form.get('username', '').strip()
    password = request.form.get('password', '')
    
    user = get_db().execute(
        'SELECT id, username, password_hash FROM users WHERE username=?', 
        (username,)
    ).fetchone()
    
    if user is None:
        return render_template('login.html', error=INVALID_MSG), 401
        
    try:
        ph.verify(user['password_hash'], password)
    except VerifyMismatchError:
        return render_template('login.html', error=INVALID_MSG), 401
        
    session.clear()
    session['user_id'] = user['id']
    session['username'] = user['username']
    return redirect(url_for('dashboard'))
```

### The Updated Project
```python
1: # In app.py
2: INVALID_MSG = 'Invalid username or password.'
3: 
4: # ← new: The login POST handler verifies credentials and creates a session
5: @app.route('/login', methods=['POST'])
6: def login_post():
7:     username = request.form.get('username', '').strip()
8:     password = request.form.get('password', '')
9:     
10:    user = get_db().execute('SELECT id, username, password_hash FROM users WHERE username=?', (username,)).fetchone()
11:    
12:    if user is None:
13:        return render_template('login.html', error=INVALID_MSG), 401
14:        
15:    try:
16:        ph.verify(user['password_hash'], password)
17:    except VerifyMismatchError:
18:        return render_template('login.html', error=INVALID_MSG), 401
19:        
20:    session.clear()
21:    session['user_id'] = user['id']
22:    session['username'] = user['username']
23:    return redirect(url_for('dashboard'))
```
The application now securely verifies user credentials and establishes a session.

### Mechanical walkthrough
- We retrieve the `username` and `password` from `request.form`.
- We query the database for a matching `username`.
- If `user is None`, we return a 401 response with `INVALID_MSG`.
- If the user exists, we call `ph.verify(user['password_hash'], password)`.
- If `VerifyMismatchError` is raised (wrong password), we catch it and return the identical `INVALID_MSG`.
- If verification passes, we call `session.clear()` to prevent session fixation attacks.
- We set `session['user_id']` and `session['username']`.
- We return a `redirect` to the dashboard route.

### CS lens
Security principles require that error messages for failed authentication do not reveal partial success. If the system returned "User not found" versus "Incorrect password", an attacker could rapidly test dictionaries of usernames to map out registered accounts (username enumeration). 

### SE lens
Returning a `401 Unauthorized` HTTP status code alongside the HTML response is structurally correct. HTMX and modern frontend tools can use this status code to understand that an error occurred, even though the body is an HTML form with an error message to render.

### Commands needed
None.

### Run it
No new commands to run.

### One sentence connecting to previous unit
While our error messages are identical, there is still a subtle vulnerability in how long the verification takes.

## Concept Unit: Timing attack prevention on login

### The Problem
Even if we return the same error message for "wrong username" and "wrong password", verifying an Argon2 hash takes a long time (e.g., 100ms), while checking a non-existent username takes almost zero time. An attacker can measure this time difference to perform username enumeration via a timing attack.

### Introduce the concept in isolation
We can equalize the response time by hashing a dummy password when the user is not found.

```python
import sqlite3, secrets
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher()
DUMMY_HASH = ph.hash('dummy-password-to-equalize-timing')

def login_timing_safe(user_record, password):
    if user_record is None:
        try:
            ph.verify(DUMMY_HASH, password)
        except VerifyMismatchError:
            pass
        return False
        
    try:
        ph.verify(user_record['password_hash'], password)
        return True
    except VerifyMismatchError:
        return False

print("Timing safe login: always takes time regardless of username existence")
```
By always running `ph.verify()`, we ensure the operation takes roughly the same amount of time, masking whether the username existed in the database.

### Discard the throwaway
This snippet is discarded. We will integrate the dummy hash into our route.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified)
- **Change type:** Refactor
- **Location:** At the top of `app.py` to define the dummy hash, and inside `login_post`.
- **Dependencies:** Argon2

### The New Code
```python
DUMMY_HASH = ph.hash('dummy-password-to-equalize-timing')

@app.route('/login', methods=['POST'])
def login_post():
    username = request.form.get('username', '').strip()
    password = request.form.get('password', '')
    
    user = get_db().execute('SELECT id, username, password_hash FROM users WHERE username=?', (username,)).fetchone()
    
    if user is None:
        # Prevent timing attack by doing equivalent work
        try:
            ph.verify(DUMMY_HASH, password)
        except VerifyMismatchError:
            pass
        return render_template('login.html', error=INVALID_MSG), 401
        
    try:
        ph.verify(user['password_hash'], password)
    except VerifyMismatchError:
        return render_template('login.html', error=INVALID_MSG), 401
        
    session.clear()
    session['user_id'] = user['id']
    session['username'] = user['username']
    return redirect(url_for('dashboard'))
```

### The Updated Project
```python
1: # In app.py
2: ph = PasswordHasher()
3: DUMMY_HASH = ph.hash('dummy-password-to-equalize-timing')
4: INVALID_MSG = 'Invalid username or password.'
5: 
6: @app.route('/login', methods=['POST'])
7: def login_post():
8:     username = request.form.get('username', '').strip()
9:     password = request.form.get('password', '')
10:    
11:    user = get_db().execute('SELECT id, username, password_hash FROM users WHERE username=?', (username,)).fetchone()
12:    
13:    if user is None:
14:        # ← new: Prevent timing attacks by running the hash verify anyway
15:        try:
16:            ph.verify(DUMMY_HASH, password)
17:        except VerifyMismatchError:
18:            pass
19:        return render_template('login.html', error=INVALID_MSG), 401
20:        
21:    try:
22:        ph.verify(user['password_hash'], password)
23:    except VerifyMismatchError:
24:        return render_template('login.html', error=INVALID_MSG), 401
25:        
26:    session.clear()
27:    session['user_id'] = user['id']
28:    session['username'] = user['username']
29:    return redirect(url_for('dashboard'))
```
The login endpoint is now resistant to timing attacks.

### Mechanical walkthrough
- We compute `DUMMY_HASH` once at application startup using `ph.hash`.
- When `user is None`, we invoke `ph.verify(DUMMY_HASH, password)`.
- This inevitably raises a `VerifyMismatchError`, which we catch and `pass`.
- We then return the standard 401 error message.
- Because Argon2 takes significant time by design, the total response time for valid and invalid usernames is equalized.

### CS lens
Timing attacks are a form of side-channel attack where the physical implementation of a system (in this case, processing time) leaks information about the system's internal state. Security algorithms are deliberately designed to mitigate side-channels by executing in "constant time".

### SE lens
Computing `DUMMY_HASH` globally at application startup means we don't pay the cost of generating a brand new hash on every invalid request—we only pay the cost of *verifying* against it, which perfectly mirrors what happens on a valid request.

### Commands needed
None.

### Run it
No new commands to run.

### One sentence connecting to previous unit
Now that authentication is rock solid, we can improve user convenience by adding persistent sessions.

## Concept Unit: 'Remember me' functionality

### The Problem
By default, Flask sessions use "session cookies" which are deleted when the user closes their browser. Users often prefer to stay logged in across sessions using a "Remember me" checkbox.

### Introduce the concept in isolation
We can control cookie persistence in Flask using `session.permanent`.

```python
import secrets
from flask import Flask, session, request
from datetime import timedelta

app = Flask(__name__)
app.config.update(
    SECRET_KEY=secrets.token_hex(32),
    PERMANENT_SESSION_LIFETIME=timedelta(days=30)
)

@app.route('/login', methods=['POST'])
def login():
    remember = request.form.get('remember') == 'on'
    session.clear()
    session['user_id'] = 1
    session.permanent = remember
    return "Logged in"

with app.test_request_context(method='POST', data={'remember': 'on'}):
    login()
    print(f"Permanent session: {session.permanent}")
```
Output:
`Permanent session: True`
When `session.permanent` is True, Flask sets a `Max-Age` on the cookie based on `PERMANENT_SESSION_LIFETIME`.

### Discard the throwaway
This isolated logic is discarded. We will implement it in our actual `/login` route.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified)
- **Change type:** Add
- **Location:** App configuration and in `login_post`.
- **Dependencies:** `timedelta` from `datetime`.

### The New Code
```python
from datetime import timedelta

app.config.update(
    PERMANENT_SESSION_LIFETIME=timedelta(days=30)
)

# Inside login_post:
    remember = request.form.get('remember') == 'on'
    session.clear()
    session['user_id'] = user['id']
    session['username'] = user['username']
    
    if remember:
        session.permanent = True
    else:
        session.permanent = False
        
    return redirect(url_for('dashboard'))
```

### The Updated Project
```python
1: # In app.py
2: from datetime import timedelta
3: 
4: app.config.update(
5:     # ... existing config ...
6:     PERMANENT_SESSION_LIFETIME=timedelta(days=30)
7: )
8: 
9: @app.route('/login', methods=['POST'])
10: def login_post():
11:     username = request.form.get('username', '').strip()
12:     password = request.form.get('password', '')
13:     # ← new: Extract 'remember' checkbox value
14:     remember = request.form.get('remember') == 'on'
15:     
16:     # ... DB lookup and verify ...
17:     
18:     session.clear()
19:     session['user_id'] = user['id']
20:     session['username'] = user['username']
21:     
22:     # ← new: Set session permanence based on checkbox
23:     if remember:
24:         session.permanent = True
25:     else:
26:         session.permanent = False
27:         
28:     return redirect(url_for('dashboard'))
```
The session will now persist for 30 days if the user checks the box.

### Mechanical walkthrough
- We configure `PERMANENT_SESSION_LIFETIME` to a `timedelta` of 30 days.
- In the route, we read `request.form.get('remember')`. If the checkbox was checked, browsers send the value `'on'`.
- We assign `True` to `session.permanent` if they want to be remembered.
- Flask translates `session.permanent = True` by adding an `Expires` and `Max-Age` attribute to the Set-Cookie header.
- If it's `False`, those attributes are omitted, creating a transient session cookie.

### CS lens
Session management relies on client-side state (cookies) to maintain identity across stateless HTTP requests. The persistence of this state is fundamentally governed by the browser's cookie eviction policies, which we direct using HTTP header directives.

### SE lens
Being explicit about `session.permanent = False` when the checkbox is unchecked ensures that we don't accidentally inherit a permanent session state if the session dictionary was somehow reused or polluted.

### Commands needed
None.

### Run it
No new commands to run.

### One sentence connecting to previous unit
Sometimes a user lands on the login page because they were redirected from a protected route; we should send them back where they came from after login.

## Concept Unit: Redirect to 'next' URL after login

### The Problem
If a user tries to access `/profile`, is forced to log in, and then is unconditionally redirected to `/dashboard`, the user experience is broken. We can accept a `next` parameter to redirect them back, but blindly redirecting to any URL is a security risk called an open redirect.

### Introduce the concept in isolation
We use `urlparse` to ensure the redirect target is a safe, relative path on our own domain.

```python
from urllib.parse import urlparse

def safe_redirect_url(target, default='/dashboard'):
    if not target:
        return default
        
    parsed = urlparse(target)
    # Reject: absolute URLs (netloc present), protocol-relative (//evil.com)
    if parsed.netloc or parsed.scheme:
        return default
        
    return target

print('Safe redirect:', safe_redirect_url('/profile'))
print('Blocked open redirect:', safe_redirect_url('//evil.com'))
print('Blocked absolute:', safe_redirect_url('https://evil.com'))
```
Output:
`Safe redirect: /profile`
`Blocked open redirect: /dashboard`
`Blocked absolute: /dashboard`

### Discard the throwaway
This logic is discarded, though we will implement an identical `safe_redirect_url` utility in our app.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified), `templates/login.html` (modified)
- **Change type:** Add
- **Location:** In `app.py`, adding the helper function and using it in `login_post`. In `login.html`, forwarding the `next` param.
- **Dependencies:** `urlparse` from `urllib.parse`.

### The New Code
```python
# In app.py
from urllib.parse import urlparse

def safe_redirect_url(target):
    if not target:
        return url_for('dashboard')
    parsed = urlparse(target)
    if parsed.netloc or parsed.scheme:
        return url_for('dashboard')
    return target

# In login_post, replace the final return:
    next_url = request.form.get('next', '')
    return redirect(safe_redirect_url(next_url))

# In login_get, pass the next argument to the template:
@app.route('/login', methods=['GET'])
def login_get():
    next_url = request.args.get('next', '')
    return render_template('login.html', error=None, next_url=next_url)
```
```html
<!-- In templates/login.html, add this inside the form: -->
<input type="hidden" name="next" value="{{ next_url }}">
```

### The Updated Project
```python
1: # In app.py
2: from urllib.parse import urlparse
3: 
4: def safe_redirect_url(target):
5:     if not target:
6:         return url_for('dashboard')
7:     parsed = urlparse(target)
8:     if parsed.netloc or parsed.scheme:
9:         return url_for('dashboard')
10:    return target
11:
12: @app.route('/login', methods=['GET'])
13: def login_get():
14:     next_url = request.args.get('next', '')
15:     return render_template('login.html', error=None, next_url=next_url)
16:
17: @app.route('/login', methods=['POST'])
18: def login_post():
19:     # ... setup and verification ...
20:     
21:     # ← new: Safely redirect to next_url
22:     next_url = request.form.get('next', '')
23:     return redirect(safe_redirect_url(next_url))
```
```html
1: <!-- In templates/login.html -->
2: <form method="POST" action="/login" hx-post="/login" hx-target="body" hx-push-url="true">
3:     <!-- ← new: Hidden input for next URL -->
4:     <input type="hidden" name="next" value="{{ next_url }}">
5:     <!-- ... other inputs ... -->
6: </form>
```
The user is now safely redirected to their original destination after login.

### Mechanical walkthrough
- `login_get` reads the `next` parameter from the query string via `request.args.get('next')`.
- It passes `next_url` into the template context.
- The template renders `<input type="hidden" name="next" value="{{ next_url }}">`, ensuring the value is submitted when the form posts.
- `login_post` reads the submitted `next` value from `request.form`.
- `safe_redirect_url(target)` calls `urlparse(target)`.
- If the parsed URL has a `netloc` (domain) or `scheme` (http/https), it is rejected as potentially malicious, and it falls back to `url_for('dashboard')`.
- Finally, `redirect()` creates the 302 response to the safe URL.

### CS lens
Input validation isn't just for database queries. A URL provided by the user must be treated as untrusted data because it dictates control flow (the redirect). 

### SE lens
Handling redirects securely on the server-side removes the responsibility from the frontend and guarantees that all login forms, whether submitted traditionally or via HTMX, behave safely.

### Commands needed
`pip install flask argon2-cffi`
Run: `python app.py`

### Run it
No new commands to run in the background. With the app running, logging in directs appropriately.

### One sentence connecting to previous unit
With our users successfully logging in and getting their sessions, we now need to protect the rest of the application so only authenticated users can access it.

## Closing

### Connect the pieces
Let's trace a complete login attempt with everything in place:
A user attempts to visit `/profile` (which we assume requires login) and is redirected to `/login?next=/profile`. 
A GET request is made to `/login`. The server renders the form, hiding the `/profile` path inside a hidden input.
The user enters "alice" and "secret123" and submits the form via HTMX. 
A POST request is made to `/login`. The database executes `SELECT` and finds the user. `ph.verify` checks the hash and succeeds.
The session is cleared to prevent fixation, then `user_id` and `username` are set.
Because the "Remember me" box was checked, `session.permanent = True` sets a 30-day cookie.
`safe_redirect_url` evaluates `/profile`, determines it has no domain, and allows it. 
A `302 Found` redirect is returned, and HTMX seamlessly navigates the user to their original destination, fully authenticated.
