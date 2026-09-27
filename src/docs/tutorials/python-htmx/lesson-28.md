# Lesson 28: "Remember Me" — Persistent Cookies, Token-Based Remember, and Secure Long-Lived Sessions

What you will build
You will build a "Remember Me" feature that extends a user's logged-in session beyond a single browser visit, eventually lasting for days or weeks. This transfers to the broader problem of managing long-lived authentication state securely: balancing user convenience against the risk of stolen session tokens. You will start with the simple approach (making the primary session persistent) and then upgrade to a secure approach (using a separate, long-lived, rotating, opaque token stored in the database).

What you need to know first
- Python Full-Stack with HTMX / Module 5: Authentication / Lesson 27: Passwords and Sessions

Terms used in this lesson
- **Persistent cookie** — A cookie with a `Max-Age` or `Expires` attribute set. Why it exists: so the browser retains the cookie even after being closed and reopened, unlike a session cookie which is deleted on close.
- **Session cookie** — A cookie without an explicit expiration. Why it exists: to hold temporary state that should automatically be cleared when the user closes their browser window.
- **Opaque token** — A random string with no intrinsic meaning or embedded data, used as a reference to a database record. Why it exists: it cannot be tampered with or decoded by the user, and it can be revoked instantly on the server by deleting the corresponding record.
- **Entropy** — A measure of unpredictability or randomness in data. Why it exists: to quantify how difficult it is for an attacker to guess a token. 256 bits of entropy is computationally infeasible to brute-force.
- **Token rotation** — The practice of issuing a new token and invalidating the old one upon use. Why it exists: to limit the lifespan of any single token, making it harder for an attacker to reuse a stolen token without detection.

Objects and methods used

- **`session.permanent`**
  - *What it is:* A boolean flag on the Flask session object indicating whether the session should use a persistent cookie.
  - *Implementation:* `session.permanent = True` or `session.permanent = False`
  - *Its use:* To control whether the user's session survives a browser restart.
  - *Type:* Boolean property on the `session` object.
  - *Responsibility:* Tells Flask's session interface to set a `Max-Age` or `Expires` on the outgoing `Set-Cookie` header.
  - *Depends on:* The `PERMANENT_SESSION_LIFETIME` configuration value.
  - *Connects to:* Accessed by view functions to toggle persistence; read by Flask's response finalization to construct headers.
  - *Shape:* A framework-provided state flag on the global request context boundary.

- **`PERMANENT_SESSION_LIFETIME`**
  - *What it is:* A Flask configuration key defining the duration of permanent sessions.
  - *Implementation:* `app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)`
  - *Its use:* To specify exactly how long "remember me" should last (e.g., 30 days) before the cookie expires.
  - *Type:* Application configuration key (string mapped to a `datetime.timedelta` or integer).
  - *Responsibility:* Determines the exact `Max-Age` value sent to the browser for permanent session cookies.
  - *Depends on:* The Flask application configuration dictionary.
  - *Connects to:* Used by Flask's session saving mechanism when `session.permanent` is True.
  - *Shape:* Framework configuration value at the application root level.

- **`secrets.token_urlsafe`**
  - *What it is:* A function in the Python standard library that generates a random, URL-safe text string.
  - *Implementation:* `token = secrets.token_urlsafe(32)`
  - *Its use:* To generate the long-lived, opaque, unguessable "remember me" token for the database and cookie.
  - *Type:* Standard library function returning a string.
  - *Responsibility:* Uses the OS's cryptographically secure pseudo-random number generator (CSPRNG) to produce a base64url-encoded string of a specified byte length.
  - *Depends on:* An integer parameter specifying the number of random bytes (e.g., 32 for 256 bits).
  - *Connects to:* Called by the application during token creation; outputs to a variable stored in the DB and sent as a cookie.
  - *Shape:* Utility function call in the business logic layer.

- **`request.cookies.get`**
  - *What it is:* A method to retrieve the value of a specific cookie sent by the browser.
  - *Implementation:* `cookie_token = request.cookies.get('remember_token')`
  - *Its use:* To check if the user has presented a "remember me" token upon returning to the site.
  - *Type:* Method on the immutable dictionary-like `request.cookies` object.
  - *Responsibility:* Safely fetches the string value of a cookie by name, returning `None` (or a default) if absent.
  - *Depends on:* The string name of the cookie being requested.
  - *Connects to:* Reads from the parsed incoming HTTP request headers; returns data to the view or `before_request` hook.
  - *Shape:* Input boundary method on the active request context.

- **`make_response`**
  - *What it is:* A Flask function that converts a return value into a proper HTTP response object.
  - *Implementation:* `resp = make_response(redirect(url_for('index')))`
  - *Its use:* To get a handle on the outgoing response so we can explicitly manipulate its cookies before returning it.
  - *Type:* Framework utility function returning a `Response` object.
  - *Responsibility:* Standardizes view return values (strings, tuples, redirects) into a full `Response` instance that can be mutated.
  - *Depends on:* The underlying content or redirect instruction passed to it.
  - *Connects to:* Called by view functions; its result is eventually sent to the WSGI server.
  - *Shape:* Response construction boundary in the view layer.

- **`delete_cookie`**
  - *What it is:* A method on the Flask response object to instruct the browser to delete a cookie.
  - *Implementation:* `resp.delete_cookie('remember_token')`
  - *Its use:* To explicitly remove the "remember me" token from the user's browser during logout.
  - *Type:* Method on the `Response` object.
  - *Responsibility:* Appends a `Set-Cookie` header with the target name, an empty value, and an expiration date in the past (or `Max-Age=0`).
  - *Depends on:* The exact name of the cookie to delete.
  - *Connects to:* Mutates the outgoing HTTP response headers; interpreted by the receiving browser.
  - *Shape:* Output boundary mutator on the response object.

- **`@app.before_request`**
  - *What it is:* A Flask decorator that registers a function to run before every single request.
  - *Implementation:* `@app.before_request\ndef load_user(): ...`
  - *Its use:* To check for a "remember me" cookie and transparently restore the session before the target view function runs.
  - *Type:* Method decorator on the `Flask` application instance.
  - *Responsibility:* Ensures the decorated hook function executes unconditionally across all routes right after request context creation.
  - *Depends on:* A callable function to decorate.
  - *Connects to:* Called by Flask's request dispatching loop; can short-circuit the request if it returns a response, though here it just mutates state.
  - *Shape:* Middleware/hook registration at the application level.

## Concept Unit: The simple approach: session.permanent

### The Problem
When a user logs in, we establish a session. By default, Flask uses session cookies, which the browser deletes when the window is closed. If the user wants to stay logged in for days ("Remember Me"), a session cookie isn't enough. We need to tell the browser to hold onto the cookie even when closed. Given that the cookie contains our signed session state, what happens if we just tell the browser to keep it for 30 days?

### Introduce the concept in isolation
We can use `session.permanent = True` combined with `PERMANENT_SESSION_LIFETIME` to issue a persistent cookie.

```python
import secrets
from flask import Flask, session, request, redirect, url_for
from datetime import timedelta

app = Flask(__name__)
app.config.update(
    SECRET_KEY=secrets.token_hex(32),
    PERMANENT_SESSION_LIFETIME=timedelta(days=30),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
)

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username', '')
    remember = request.form.get('remember') == 'on'
    
    session.clear()
    session['user_id'] = 1
    session['username'] = username
    
    if remember:
        session.permanent = True   # 30-day persistent cookie
    else:
        session.permanent = False  # session cookie
        
    return redirect(url_for('dashboard'))

@app.route('/dashboard')
def dashboard():
    return f'Dashboard. Permanent: {session.permanent}. user_id: {session.get("user_id")}'

with app.test_client() as c:
    r = c.post('/login', data={'username':'alice', 'password':'password', 'remember':'on'})
    print('Login Status:', r.status_code)
    
    r2 = c.get('/dashboard')
    print('Dashboard Data:', r2.data.decode())
```

*Predicted output:*
The login status will be 302, and the dashboard will print `Dashboard. Permanent: True. user_id: 1`. 
This proves that setting `session.permanent = True` instructs Flask to attach a `Max-Age` to the session cookie when sending it back to the browser, making it persistent for the configured lifetime (30 days).

### Discard the throwaway
This throwaway example is discarded and will not appear in our project. The simple approach extends the vulnerability window of a stolen session cookie to 30 days, which is too risky for our production application.

### Project Change
- **Reference Source**: No reference counterpart — this is a from-scratch addition because we are exploring the simple approach before moving to the secure token-based approach.
- **Files affected**: `app.py` (modified)
- **Change type**: Configure and refactor
- **Location**: In application setup and the `/login` route.
- **Dependencies**: None.

### The New Code
```python
from datetime import timedelta

app.config.update(
    PERMANENT_SESSION_LIFETIME=timedelta(days=30)
)

# Inside login():
remember = request.form.get('remember') == 'on'
if remember:
    session.permanent = True
else:
    session.permanent = False
```

### The Updated Project
```python
# 1: from flask import Flask, session, request, redirect, url_for, render_template
# 2: from datetime import timedelta # ← new
# 3: 
# 4: app = Flask(__name__)
# 5: app.config.update(
# 6:     SECRET_KEY='super-secret',
# 7:     PERMANENT_SESSION_LIFETIME=timedelta(days=30) # ← new
# 8: )
# 9: 
# 10: @app.route('/login', methods=['POST'])
# 11: def login():
# 12:     username = request.form.get('username')
# 13:     password = request.form.get('password')
# 14:     remember = request.form.get('remember') == 'on' # ← new
# 15:     
# 16:     if verify_password(username, password):
# 17:         session.clear()
# 18:         session['user_id'] = get_user_id(username)
# 19:         
# 20:         if remember: # ← new
# 21:             session.permanent = True # ← new
# 22:         else: # ← new
# 23:             session.permanent = False # ← new
# 24:             
# 25:         return redirect(url_for('dashboard'))
```
The application now checks for a 'remember' checkbox in the login form. If checked, it marks the session as permanent, extending its life to 30 days.

### Mechanical walkthrough
- **`timedelta(days=30)`**: Creates a time duration object representing exactly 30 days.
- **`app.config.update(...)`**: Injects `PERMANENT_SESSION_LIFETIME` into Flask's configuration.
- **`request.form.get('remember') == 'on'`**: Checks the submitted form data. HTML checkboxes send the value `'on'` if checked, and omit the key entirely if unchecked.
- **`session.permanent = True`**: Sets the boolean flag on the session. When Flask saves the session at the end of the request, this flag tells it to set the `Max-Age` and `Expires` directives on the `Set-Cookie` header to 30 days in the future.

### CS lens
Extending the session cookie's lifetime trades security for convenience. A session cookie contains authenticated state. If an attacker intercepts this cookie (e.g., via XSS or physical access to an unlocked machine), they impersonate the user. Normally, this window of vulnerability closes when the browser shuts. Making the session permanent artificially props open that window for a month, meaning a stolen session remains valid long after the user has left the machine. 

### SE lens
This is a standard framework feature because it's trivial to implement and often "good enough" for low-stakes applications. However, in professional engineering, making the primary session token long-lived is a severe anti-pattern. If a user loses their laptop, there is no way for the server to invalidate *just* that stolen cookie, because Flask's default sessions are stateless (cryptographically signed, but not tracked in the database). The only way to invalidate it is to change the application's `SECRET_KEY`, which forcefully logs out *every single user* on the platform. 

### Commands needed
Run: python app.py

### Run it
Check the "Remember Me" box, log in, and inspect your browser's Developer Tools (Application -> Cookies). You will see the `session` cookie now has an explicit Expiration date 30 days in the future.

### One sentence connecting to previous unit
Because extending the stateless session cookie is too dangerous, we need a way to issue a long-lived token that we *can* track and revoke independently of the main session.

## Concept Unit: Token-based remember me — separate persistent token

### The Problem
We need the user to stay logged in for 30 days, but we want the primary `session` cookie to remain strictly short-lived (deleted on browser close). If they close their browser and return tomorrow, the session cookie is gone. How do we recognize them securely without relying on a permanent session cookie, in a way that allows us to revoke access if their device is stolen?

### Introduce the concept in isolation
We will generate a highly random, opaque token and store it in the database alongside an expiration date.

```python
import sqlite3, secrets
from flask import Flask, g

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS remember_tokens (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token   TEXT    NOT NULL UNIQUE,
                created TEXT    DEFAULT (datetime('now')),
                expires TEXT    NOT NULL
            );
            INSERT INTO users (username) VALUES ('alice');
        ''')
    return g.db

def create_remember_token(user_id):
    import datetime
    # 32 bytes = 256 bits of entropy
    token = secrets.token_urlsafe(32)  
    expires = (datetime.datetime.now() + datetime.timedelta(days=30)).isoformat()
    get_db().execute(
        'INSERT INTO remember_tokens (user_id, token, expires) VALUES (?, ?, ?)',
        (user_id, token, expires)
    )
    get_db().commit()
    return token

with app.test_request_context():
    token = create_remember_token(1)
    print('Generated Token:', token)
    print('Length:', len(token), 'characters')
```

*Predicted output:*
The script will output a random base64url-encoded string like `abc123XYZ_...` exactly 43 characters long.
This proves we can generate an unguessable token and bind it to a specific `user_id` in our database.

### Discard the throwaway
This isolated script is discarded and will not appear in the project. The concept of an opaque token stored in a `remember_tokens` table is what we carry forward.

### Project Change
- **Reference Source**: No reference counterpart — this is a from-scratch addition.
- **Files affected**: `db.py` (modified), `app.py` (modified)
- **Change type**: Add table and modify login logic.
- **Location**: Database schema file and the `login` route.
- **Dependencies**: The `secrets` and `datetime` standard libraries.

### The New Code
```python
import secrets
from datetime import datetime, timedelta

def create_remember_token(user_id):
    token = secrets.token_urlsafe(32)
    expires = (datetime.now() + timedelta(days=30)).isoformat()
    get_db().execute(
        'INSERT INTO remember_tokens (user_id, token, expires) VALUES (?, ?, ?)',
        (user_id, token, expires)
    )
    get_db().commit()
    return token
```

### The Updated Project
```python
# 1: @app.route('/login', methods=['POST'])
# 2: def login():
# 3:     username = request.form.get('username')
# 4:     password = request.form.get('password')
# 5:     remember = request.form.get('remember') == 'on'
# 6:     
# 7:     if verify_password(username, password):
# 8:         session.clear()
# 9:         user_id = get_user_id(username)
# 10:        session['user_id'] = user_id
# 11:        
# 12:        resp = make_response(redirect(url_for('dashboard'))) # ← new
# 13:        
# 14:        if remember:
# 15:            token = create_remember_token(user_id) # ← new
# 16:            resp.set_cookie('remember_token', token, max_age=30*24*3600, httponly=True, samesite='Lax') # ← new
# 17:            
# 18:        return resp # ← new
```
Instead of making the session permanent, we generate a highly random string, store it in the database, and issue it to the browser as a separate, long-lived persistent cookie called `remember_token`.

### Mechanical walkthrough
- **`secrets.token_urlsafe(32)`**: Calls the cryptographically secure random generator to yield 32 random bytes (256 bits), encoded safely for HTTP headers and URLs. 
- **`make_response(redirect(...))`**: Wraps our standard redirect instruction into a tangible `Response` object that we can mutate before returning it to the server.
- **`resp.set_cookie('remember_token', token, ...)`**: Attaches a `Set-Cookie` header for our new opaque string. 
- **`max_age=30*24*3600`**: Hardcodes the browser's retention policy to 30 days in seconds.
- **`httponly=True`**: Prevents JavaScript (like XSS attacks) from reading the cookie.

### CS lens
Using 256 bits of entropy is critical. If we used an incremental ID or a predictable string, an attacker could simply guess valid tokens and hijack accounts. At 256 bits of entropy, guessing a token is statistically impossible. The token is "opaque" because it contains no embedded user data — it is merely a random pointer to a row in our database. If the database row is deleted, the token instantly becomes meaningless data.

### SE lens
Separating the long-lived state (`remember_token`) from the short-lived state (`session`) is a core security principle. The `session` cookie remains the authority for current access, but expires quickly. The `remember_token` is a specialized, long-term credential whose sole job is to *re-issue* a session cookie when the user returns. Because we track each token in the database, a user logging in from their phone and laptop gets two distinct tokens. If the laptop is stolen, we can delete the laptop's token from the database, invalidating it immediately without affecting the phone's access or resetting the global `SECRET_KEY`.

### Commands needed
Run: python app.py

### Run it
Log in with "Remember Me" checked. Inspect your cookies. You will see a transient `session` cookie, and a persistent `remember_token` cookie with a 30-day Max-Age containing a random string.

### One sentence connecting to previous unit
Now that the browser securely holds a long-lived pointer to a database record, we need a mechanism to intercept returning users whose primary session has expired, and log them back in automatically.

## Concept Unit: Verifying the remember token on request

### The Problem
The user closes their browser and the `session` cookie is destroyed. When they return the next day, Flask sees them as logged out because `session` is empty. However, their browser automatically sends the 30-day `remember_token` cookie. We need a way to catch this token, look it up in the database, and reconstruct their session *before* our normal route logic runs, so they appear seamlessly logged in.

### Introduce the concept in isolation
We can use a `before_request` hook to inspect the incoming cookies on every request.

```python
import sqlite3, secrets, datetime
from flask import Flask, session, request, g

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript('''
            CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS remember_tokens (id INTEGER, user_id INTEGER, token TEXT, expires TEXT);
            INSERT INTO users (id, username) VALUES (1, "alice");
            INSERT INTO remember_tokens (user_id, token, expires) VALUES (1, "abc", "2099-01-01");
        ''')
    return g.db

@app.before_request
def load_user_from_remember_token():
    if 'user_id' in session:
        return
    
    cookie_token = request.cookies.get('remember_token')
    if not cookie_token:
        return
        
    row = get_db().execute('SELECT * FROM remember_tokens WHERE token=?', (cookie_token,)).fetchone()
    if not row or row['expires'] < datetime.datetime.now().isoformat():
        return
        
    user = get_db().execute('SELECT id, username FROM users WHERE id=?', (row['user_id'],)).fetchone()
    if user:
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['_fresh'] = False  # Mark as a restored session

with app.test_request_context(headers={'Cookie': 'remember_token=abc'}):
    load_user_from_remember_token()
    print('Restored session user_id:', session.get('user_id'))
    print('Fresh login:', session.get('_fresh'))
```

*Predicted output:*
The hook will see the cookie `abc`, look it up, find user 1, and populate the session. The output will be `Restored session user_id: 1` and `Fresh login: False`.

### Discard the throwaway
This isolated hook demonstrates the restoration logic. We discard it and implement the real version in our app structure.

### Project Change
- **Reference Source**: No reference counterpart.
- **Files affected**: `app.py` (modified)
- **Change type**: Add application middleware.
- **Location**: Near the top of `app.py` after initialization.
- **Dependencies**: None.

### The New Code
```python
@app.before_request
def restore_session():
    if 'user_id' in session:
        return
        
    cookie_token = request.cookies.get('remember_token')
    if not cookie_token:
        return
        
    row = get_db().execute('SELECT * FROM remember_tokens WHERE token=?', (cookie_token,)).fetchone()
    if not row or row['expires'] < datetime.now().isoformat():
        return
        
    user = get_db().execute('SELECT id, username FROM users WHERE id=?', (row['user_id'],)).fetchone()
    if user:
        session['user_id'] = user['id']
        session['_fresh'] = False
```

### The Updated Project
```python
# 1: app = Flask(__name__)
# 2: 
# 3: @app.before_request # ← new
# 4: def restore_session(): # ← new
# 5:     if 'user_id' in session: # ← new
# 6:         return # ← new
# 7:         
# 8:     cookie_token = request.cookies.get('remember_token') # ← new
# 9:     if not cookie_token: # ← new
# 10:        return # ← new
# 11:        
# 12:     row = get_db().execute('SELECT * FROM remember_tokens WHERE token=?', (cookie_token,)).fetchone() # ← new
# 13:     if not row or row['expires'] < datetime.now().isoformat(): # ← new
# 14:         return # ← new
# 15:         
# 16:     user = get_db().execute('SELECT id, username FROM users WHERE id=?', (row['user_id'],)).fetchone() # ← new
# 17:     if user: # ← new
# 18:         session['user_id'] = user['id'] # ← new
# 19:         session['_fresh'] = False # ← new
# 20: 
# 21: @app.route('/login', methods=['POST'])
```
The middleware runs automatically before any route. It gracefully checks for an active session, falling back to reading the database if a `remember_token` cookie is present.

### Mechanical walkthrough
- **`@app.before_request`**: Registers `restore_session` to execute on the incoming request before dispatching it to routes like `/dashboard`.
- **`if 'user_id' in session:`**: An early exit. If they already have a short-lived session, we do no database work.
- **`request.cookies.get('remember_token')`**: Safely extracts the string token from the HTTP headers, returning `None` if missing.
- **`row['expires'] < datetime.now().isoformat()`**: Compares the ISO-8601 string in the database against the current time to ensure the token hasn't aged out on the server side.
- **`session['_fresh'] = False`**: A custom flag added to the session dict. We set it to `False` to explicitly record that this authentication came from a long-lived, potentially stale token, not a recent password entry.

### CS lens
By placing this in a middleware/hook layer (`before_request`), we achieve separation of concerns. The individual view functions (like `/dashboard`) remain entirely ignorant of *how* the user authenticated. They just check if `session['user_id']` exists. The token validation logic acts as an invisible shim that transparently elevates a returning visitor to an authenticated state just in time.

### SE lens
Setting `session['_fresh'] = False` is a crucial defense-in-depth tactic. An attacker holding a stolen laptop might wake it from sleep and have a valid remember token. By marking the session as not "fresh", the application knows to demand a password re-entry (a "sudo mode" prompt) before permitting high-stakes actions like changing the password, changing the email, or deleting the account. The long-lived token grants access to everyday browsing, but fresh credentials are required for destruction.

### Commands needed
Run: python app.py

### Run it
Log in with Remember Me. Close the browser entirely. Reopen it and visit `/dashboard`. You will be automatically logged in because the `before_request` hook found your cookie, looked it up, and restored your session.

### One sentence connecting to previous unit
If a user realizes their laptop is stolen, they need a way to log into the application from their phone and kill the stolen device's token.

## Concept Unit: Revoking remember tokens

### The Problem
We have issued a persistent token to a device, and the database considers it valid for 30 days. If the user logs out manually on that device, we need to destroy the token so it cannot be reused by someone who digs it out of the browser cache. If the user wants to log out remotely (e.g. "Sign out of all devices"), we need to destroy *all* tokens associated with their account.

### Introduce the concept in isolation
We manipulate the database to delete the token rows, and instruct the browser to delete the cookie by setting its age to zero.

```python
import sqlite3, secrets
from flask import Flask, session, redirect, request, g, make_response

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.executescript('''
            CREATE TABLE remember_tokens (token TEXT, user_id INTEGER);
            INSERT INTO remember_tokens (token, user_id) VALUES ('abc', 1), ('xyz', 1);
        ''')
    return g.db

@app.route('/logout-all', methods=['POST'])
def logout_all():
    user_id = 1 # hardcoded for isolation
    get_db().execute('DELETE FROM remember_tokens WHERE user_id=?', (user_id,))
    get_db().commit()
    
    session.clear()
    resp = make_response("Logged out of everywhere")
    resp.delete_cookie('remember_token')
    return resp

with app.test_client() as c:
    r = c.post('/logout-all')
    print('Headers sent to browser:')
    for header in r.headers:
        print(header)
    
    with app.app_context():
        count = get_db().execute('SELECT COUNT(*) FROM remember_tokens').fetchone()[0]
        print(f'Tokens remaining in DB: {count}')
```

*Predicted output:*
The script will output the HTTP headers, notably `Set-Cookie: remember_token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/`.
The database count will be 0.
This proves that we simultaneously destroy the server-side record and send a command to obliterate the client-side cookie.

### Discard the throwaway
This isolated logout logic is discarded. We will implement specific revocation routes in our project.

### Project Change
- **Reference Source**: No reference counterpart.
- **Files affected**: `app.py` (modified)
- **Change type**: Add endpoints.
- **Location**: Near the existing `/logout` endpoint.
- **Dependencies**: None.

### The New Code
```python
@app.route('/logout', methods=['POST'])
def logout():
    cookie_token = request.cookies.get('remember_token')
    if cookie_token:
        get_db().execute('DELETE FROM remember_tokens WHERE token=?', (cookie_token,))
        get_db().commit()
        
    session.clear()
    resp = make_response(redirect(url_for('index')))
    resp.delete_cookie('remember_token')
    return resp

@app.route('/logout-all-devices', methods=['POST'])
def logout_all():
    user_id = session.get('user_id')
    if user_id:
        get_db().execute('DELETE FROM remember_tokens WHERE user_id=?', (user_id,))
        get_db().commit()
        
    session.clear()
    resp = make_response(redirect(url_for('index')))
    resp.delete_cookie('remember_token')
    return resp
```

### The Updated Project
```python
# 1: @app.route('/logout', methods=['POST'])
# 2: def logout():
# 3:     cookie_token = request.cookies.get('remember_token') # ← new
# 4:     if cookie_token: # ← new
# 5:         get_db().execute('DELETE FROM remember_tokens WHERE token=?', (cookie_token,)) # ← new
# 6:         get_db().commit() # ← new
# 7:         
# 8:     session.clear()
# 9:     resp = make_response(redirect(url_for('index'))) # ← new
# 10:    resp.delete_cookie('remember_token') # ← new
# 11:    return resp # ← new
# 12: 
# 13: @app.route('/logout-all-devices', methods=['POST']) # ← new
# 14: def logout_all(): # ← new
# 15:     user_id = session.get('user_id') # ← new
# 16:     if user_id: # ← new
# 17:         get_db().execute('DELETE FROM remember_tokens WHERE user_id=?', (user_id,)) # ← new
# 18:         get_db().commit() # ← new
# 19:         
# 20:     session.clear() # ← new
# 21:     resp = make_response(redirect(url_for('index'))) # ← new
# 22:     resp.delete_cookie('remember_token') # ← new
# 23:     return resp # ← new
```
We replace the naive `/logout` with one that deletes the specific token presented. We also add a panic-button endpoint that deletes all tokens for the user globally.

### Mechanical walkthrough
- **`DELETE FROM remember_tokens WHERE token=?`**: Finds the exact opaque string presented by this specific browser and removes only that row, leaving any other devices unharmed.
- **`resp.delete_cookie('remember_token')`**: Overwrites the existing cookie on the client with an empty value and an expiration date in 1970 (`Max-Age=0`), forcing the browser to instantly drop it.
- **`DELETE FROM remember_tokens WHERE user_id=?`**: Finds every single active token globally tied to this account and destroys them all simultaneously.

### CS lens
Revocation is the fundamental difference between stateful tokens (stored in a DB) and stateless tokens (like simple signed cookies). Because the `remember_tokens` table maintains the state of what is currently allowed, we have authoritative server-side control over access. When `logout-all-devices` runs, the server doesn't need to communicate with the stolen device. It just deletes the database rows. When the stolen device tries to make a request, its token is checked against the database, isn't found, and access is silently denied.

### SE lens
Failing to destroy the server-side record on logout is a critical security bug. If an application only issues `delete_cookie` but leaves the token valid in the database, an attacker who previously copied the cookie string from the browser cache can manually inject it back into their requests, and the server will gladly log them back in. True logout must destroy the credential on the server, making the client's cached string completely worthless.

### Commands needed
Run: python app.py

### Run it
Log in. Verify the `remember_token` cookie exists. Hit the `/logout` endpoint. Observe that the cookie is completely gone from the browser, and running a manual query against the SQLite database will show zero rows in the `remember_tokens` table.

### One sentence connecting to previous unit
We can now issue and revoke tokens, but if a token is silently copied by malware while the user is actively logged in, we need a way to detect that theft automatically.

## Concept Unit: Rotating remember tokens on use

### The Problem
A user logs into their laptop. The laptop holds a valid 30-day token. Malware silently reads their cookies and transmits the `remember_token` to an attacker. The user doesn't know, so they don't click "logout-all". Now two computers possess the exact same valid token. How do we limit the lifespan of this token and actively detect when it has been cloned?

### Introduce the concept in isolation
We implement Token Rotation: every time a token is used to restore a session, we immediately delete it and issue a brand new one.

```python
import sqlite3, secrets, datetime
from flask import Flask, g

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.executescript('''
            CREATE TABLE remember_tokens (token TEXT, user_id INTEGER, expires TEXT);
            INSERT INTO remember_tokens VALUES ('stolen_token', 1, '2099-01-01');
        ''')
    return g.db

def rotate_remember_token(old_token, user_id):
    new_token = secrets.token_urlsafe(32)
    expires = (datetime.datetime.now() + datetime.timedelta(days=30)).isoformat()
    
    get_db().execute('DELETE FROM remember_tokens WHERE token=?', (old_token,))
    get_db().execute('INSERT INTO remember_tokens (user_id, token, expires) VALUES (?,?,?)', 
                     (user_id, new_token, expires))
    get_db().commit()
    return new_token

with app.app_context():
    print("User visits site. Token rotated.")
    new_t = rotate_remember_token('stolen_token', 1)
    
    print("Attacker tries to use old token...")
    row = get_db().execute('SELECT * FROM remember_tokens WHERE token=?', ('stolen_token',)).fetchone()
    if not row:
        print("Attacker token INVALID (already deleted).")
```

*Predicted output:*
The output will state the token is rotated, and then explicitly report `Attacker token INVALID (already deleted)`.
This proves that a token can only be used *once* to restore a session. The first person to use it gets a new valid token; the second person gets rejected.

### Discard the throwaway
This isolated rotation logic is discarded. We will integrate it directly into our middleware.

### Project Change
- **Reference Source**: No reference counterpart.
- **Files affected**: `app.py` (modified)
- **Change type**: Add logic to existing middleware.
- **Location**: At the end of `restore_session()`.
- **Dependencies**: None.

### The New Code
```python
def rotate_remember_token(old_token, user_id):
    new_token = secrets.token_urlsafe(32)
    expires = (datetime.now() + timedelta(days=30)).isoformat()
    get_db().execute('DELETE FROM remember_tokens WHERE token=?', (old_token,))
    get_db().execute('INSERT INTO remember_tokens (user_id, token, expires) VALUES (?,?,?)', (user_id, new_token, expires))
    get_db().commit()
    return new_token

# Inside restore_session(), after populating session:
new_token = rotate_remember_token(cookie_token, user['id'])
@after_this_request
def set_new_cookie(response):
    response.set_cookie('remember_token', new_token, max_age=30*24*3600, httponly=True, samesite='Lax')
    return response
```

### The Updated Project
```python
# 1: from flask import after_this_request
# 2:
# 3: @app.before_request
# 4: def restore_session():
# 5:     if 'user_id' in session:
# 6:         return
# 7:         
# 8:     cookie_token = request.cookies.get('remember_token')
# 9:     if not cookie_token:
# 10:        return
# 11:        
# 12:     row = get_db().execute('SELECT * FROM remember_tokens WHERE token=?', (cookie_token,)).fetchone()
# 13:     if not row or row['expires'] < datetime.now().isoformat():
# 14:         return
# 15:         
# 16:     user = get_db().execute('SELECT id, username FROM users WHERE id=?', (row['user_id'],)).fetchone()
# 17:     if user:
# 18:         session['user_id'] = user['id']
# 19:         session['_fresh'] = False
# 20:         
# 21:         new_token = rotate_remember_token(cookie_token, user['id']) # ← new
# 22:         @after_this_request # ← new
# 23:         def set_new_cookie(response): # ← new
# 24:             response.set_cookie('remember_token', new_token, max_age=30*24*3600, httponly=True, samesite='Lax') # ← new
# 25:             return response # ← new
```
When a valid remember token is successfully used to restore a session, the system immediately deletes it and provisions a new token to take its place.

### Mechanical walkthrough
- **`rotate_remember_token(cookie_token, user['id'])`**: Calls our helper to perform the atomic `DELETE` of the old string and `INSERT` of the newly generated string.
- **`@after_this_request`**: A Flask utility decorator. Because we are in a `before_request` hook, we do not have a `Response` object to mutate yet. This decorator queues a function to run *after* the view completes, allowing us to attach the `Set-Cookie` header to the final response right before it leaves the server.
- **`set_new_cookie(response)`**: Takes the finalized response, attaches the newly rotated token, and returns the response so the browser saves the new credential.

### CS lens
Token rotation limits the "replay window" of a stolen credential. A token is essentially a single-use key that opens the door (restores the session) and immediately hands you a new single-use key for next time. If an attacker steals your key, they are in a race. If you use it first, the key changes, and the attacker is locked out. If the attacker uses it first, *they* get the new key, and you are locked out.

### SE lens
This race condition forms a theft detection mechanism. If the attacker uses the token first, the server deletes the original token and issues a new one to the attacker. The next time the legitimate user visits the site, their browser will send the original, now-deleted token. The server will see a request with a validly formatted token that is missing from the database. In a highly secure system, seeing a recently-deleted token is a massive red flag: it means cloning has occurred. The server can respond by immediately nuking *all* active sessions and tokens for that user account and sending an emergency password reset email.

### Commands needed
Run: python app.py

### Run it
Log in. Delete your transient `session` cookie via dev tools to force a token restore. Refresh the page. Watch the `remember_token` cookie value — it will change entirely upon page load, because the middleware successfully validated the old one, rotated it, and sent a new one.

### One sentence connecting to previous unit
You have now built a robust, stateful "Remember Me" implementation that allows long-lived access while actively defending against credential theft.

## Closing
### Connect the pieces
Let's trace a user logging in and returning weeks later. 

1. They POST to `/login` with `remember=True`.
2. The server creates an opaque string with `secrets.token_urlsafe(32)`.
3. The token is inserted into the `remember_tokens` database table.
4. The server responds with a `Set-Cookie` header making the token a persistent cookie for 30 days.
5. The user closes the browser. The short-lived `session` cookie vanishes.
6. Days later, they return. The browser sends the 30-day `remember_token` cookie.
7. Before the route runs, `@app.before_request` intercepts the request, reads the token, and queries the database.
8. Finding a match, it injects the `user_id` into the `session` and sets `_fresh=False`.
9. The hook deletes the old token, issues a new one via rotation, and queues it for the response.
10. The user seamlessly views the dashboard, completely unaware that a complex cryptographic dance just logged them back in and rotated their credentials.
