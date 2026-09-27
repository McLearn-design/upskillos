# Lesson 24: User Registration — Form → Validate → Hash → Store

**What you will build**
You will build a full user registration flow. The feature is a complete HTML form for signing up. The transferable problem is how to safely accept untrusted user input, validate it against strict rules, hash the password securely before storing it, and handle the database insertion cleanly while providing real-time feedback for username availability.

**What you need to know first**
- Lesson 23: Database setup and routing.

**Terms used in this lesson**
- **Validation** — The process of checking input data against a set of rules (like length or format) to ensure it is safe and correct before processing it. It exists to protect the system from bad data and provide useful feedback to the user.
- **Hashing** — A one-way mathematical function that converts a password into a scrambled string. It exists so that even if the database is compromised, the original passwords remain unknown.
- **Session fixation prevention** — Clearing existing session data before logging a new user in. It exists to ensure a malicious user cannot trick a victim into using a known session ID.
- **Regular expression (Regex)** — A sequence of characters specifying a search pattern. It exists to enforce complex text matching rules, like ensuring an email looks valid or a username only contains allowed characters.

**Objects and methods used**
- **`PasswordHasher`**
  - *What it is:* A utility class from the `argon2` library for hashing and verifying passwords.
  - *Implementation:* `ph = PasswordHasher()` and `ph.hash(password)`.
  - *Its use:* We use it to securely hash user passwords before storing them in the database.
  - *Type:* Class in `argon2`.
  - *Responsibility:* Handles the cryptographic hashing of passwords using the Argon2id algorithm.
  - *Depends on:* The `argon2-cffi` package.
  - *Connects to:* Called by the registration route to transform the password string into a hash string.
  - *Shape:* A security boundary utility between the application logic and the database.
- **`sqlite3.IntegrityError`**
  - *What it is:* An exception raised by SQLite when a database constraint fails.
  - *Implementation:* `except sqlite3.IntegrityError:`
  - *Its use:* We catch this to detect when a user tries to register a username that already exists (failing the `UNIQUE` constraint).
  - *Type:* Exception class in `sqlite3`.
  - *Responsibility:* Signals that a database operation violated the schema rules.
  - *Depends on:* A failed database execution.
  - *Connects to:* Caught by the application route to map a database error to a user-facing validation error.
  - *Shape:* Error boundary between the database driver and the application.
- **`re.match()`**
  - *What it is:* A function in Python's `re` module that checks if a regex pattern matches at the beginning of a string.
  - *Implementation:* `re.match(pattern, string)`
  - *Its use:* We use it to enforce allowed characters in usernames and validate email formats.
  - *Type:* Function in `re`.
  - *Responsibility:* Applies a regular expression pattern to a string and returns a match object or None.
  - *Depends on:* A valid regular expression string and a target string.
  - *Connects to:* Called by the validation logic to check input validity.
  - *Shape:* Internal validation utility.
- **`session.clear()`**
  - *What it is:* A method that empties the current Flask session dictionary.
  - *Implementation:* `session.clear()`
  - *Its use:* We use it right before logging in a newly registered user to prevent session fixation attacks.
  - *Type:* Method on the `session` object in Flask.
  - *Responsibility:* Discards all data in the current session.
  - *Depends on:* An active request context.
  - *Connects to:* Modifies the user's cookie state.
  - *Shape:* State management boundary.

## Concept Unit: The registration form

### The Problem
We need a way for a user to send their registration details to our application. How do we collect a username, email, and password, and how do we show errors if they make a mistake, without losing what they already typed?

### Introduce the concept in isolation
```python
from flask import Flask, render_template_string
app = Flask(__name__)

template = """
<form method="POST">
    <input type="text" name="username" value="{{ form.username }}">
    <span class="error">{{ errors.username }}</span>
</form>
"""

with app.test_request_context():
    html = render_template_string(template, form={'username': 'al'}, errors={'username': 'Too short'})
    print(html)
```
Output:
```html
<form method="POST">
    <input type="text" name="username" value="al">
    <span class="error">Too short</span>
</form>
```
This proves that by passing a `form` dictionary and an `errors` dictionary into the template, we can dynamically set the value of an input (repopulating it) and render targeted error messages next to the relevant field.

### Discard the throwaway
This throwaway template script is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are building the registration interface.
- **Files affected:** `templates/register.html` (created), `app.py` (modified).
- **Change type:** Add.
- **Location:** New template file, and new route in `app.py`.
- **Dependencies:** Flask, HTMX.

### The New Code
```html
<!-- templates/register.html -->
<h1>Create Account</h1>
<form method="POST" action="/register"
      hx-post="/register"
      hx-target="#form-wrap"
      hx-swap="outerHTML">
    <div id="form-wrap">
        <div class="field">
            <label>Username</label>
            <input type="text" name="username"
                   value="{{ form.username }}"
                   hx-post="/validate/username"
                   hx-target="#username-err"
                   hx-trigger="blur">
            <span id="username-err" class="error">{{ errors.username }}</span>
        </div>
        <div class="field">
            <label>Email</label>
            <input type="email" name="email"
                   value="{{ form.email }}">
            <span class="error">{{ errors.email }}</span>
        </div>
        <div class="field">
            <label>Password</label>
            <input type="password" name="password">
            <span class="error">{{ errors.password }}</span>
        </div>
        <button type="submit">Register</button>
    </div>
</form>
```

```python
# app.py
from flask import render_template

@app.route('/register', methods=['GET'])
def register_get():
    return render_template('register.html', form={}, errors={})
```

### The Updated Project
```python
1: from flask import Flask, render_template
2: app = Flask(__name__)
3: 
4: # ← new
5: @app.route('/register', methods=['GET'])
6: def register_get():
7:     return render_template('register.html', form={}, errors={})
```
The new template provides the structure for the registration page, and the new route serves it. We pass empty `form` and `errors` dictionaries so the initial page load has no errors and empty fields.

### Mechanical walkthrough
- `@app.route('/register', methods=['GET'])` defines a route that only responds to HTTP GET requests.
- `render_template('register.html', form={}, errors={})` renders the template, injecting two empty dictionaries.
- In the HTML, `<form method="POST" action="/register"` sets the standard browser fallback.
- `hx-post="/register"` tells HTMX to intercept the form submission and send an AJAX POST request instead.
- `hx-target="#form-wrap"` and `hx-swap="outerHTML"` instruct HTMX to replace the inner `div` with the HTML response, preventing a full page reload.
- `value="{{ form.username }}"` injects the previous value if validation fails.
- `hx-post="/validate/username"` on the input sends a request when the user leaves the field (`hx-trigger="blur"`).

### CS lens
In web applications, forms bridge the gap between user intent and system state. Using HTMX shifts the interaction model from a stateless document-exchange architecture (full page reloads) to a component-driven update model, where partial DOM swaps mimic single-page application reactivity while keeping all state logic on the server.

### SE lens
Separating the `GET` (render form) and `POST` (process form) routes is a fundamental pattern. It cleanly isolates the responsibility of showing the UI from the responsibility of mutating data. Injecting a `form` and `errors` dictionary uniformly simplifies the templating logic, as the template doesn't need to check if these variables exist.

### Commands needed
```bash
pip install flask argon2-cffi
Run: python app.py
```

### Run it
Navigating to `/register` displays the form. Inspecting the source shows that `value=""` is rendered where `value="{{ form.username }}"` is, because the initial dictionary is empty.

### One sentence connecting to previous unit
Now that we have a form to collect data, we must rigorously validate that data when the user submits it.

## Concept Unit: Server-side validation

### The Problem
Users might submit an empty username, a short password, or an invalid email. How do we check all these constraints and return a comprehensive list of errors instead of failing one by one?

### Introduce the concept in isolation
```python
import re

def validate_email(email):
    pattern = r'^[^@\s]+@[^@\s]+\.[^@\s]+$'
    return bool(re.match(pattern, email))

print("Valid:", validate_email("test@example.com"))
print("Invalid:", validate_email("bad-email"))
```
Output:
```
Valid: True
Invalid: False
```
This proves that a regular expression can efficiently check if a string matches the structural requirements of an email address.

### Discard the throwaway
This throwaway email validation script is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified).
- **Change type:** Add.
- **Location:** Above the route definitions in `app.py`.
- **Dependencies:** Python's `re` module.

### The New Code
```python
import re

def validate_registration(username, email, password):
    errors = {}
    
    if not username:
        errors['username'] = 'Username is required.'
    elif len(username) < 3:
        errors['username'] = 'Username must be at least 3 characters.'
    elif len(username) > 32:
        errors['username'] = 'Username must be 32 characters or fewer.'
    elif not re.match(r'^[a-zA-Z0-9_]+$', username):
        errors['username'] = 'Username: letters, numbers, and underscores only.'
        
    email_pattern = r'^[^@\s]+@[^@\s]+\.[^@\s]+$'
    if not email:
        errors['email'] = 'Email is required.'
    elif not re.match(email_pattern, email):
        errors['email'] = 'Enter a valid email address.'
        
    if not password:
        errors['password'] = 'Password is required.'
    elif len(password) < 8:
        errors['password'] = 'Password must be at least 8 characters.'
    elif len(password) > 128:
        errors['password'] = 'Password must be 128 characters or fewer.'
        
    return errors
```

### The Updated Project
```python
1: from flask import Flask, render_template
2: import re # ← new
3: 
4: app = Flask(__name__)
5: 
6: # ← new
7: def validate_registration(username, email, password):
8:     errors = {}
9:     # ... validation logic ...
10:    return errors
11: 
12: @app.route('/register', methods=['GET'])
```
The new function acts as a centralized validation pipeline for registration input, accumulating all errors into a single dictionary so the user sees everything wrong at once.

### Mechanical walkthrough
- `errors = {}` initializes an empty dictionary to collect issues.
- `if not username:` checks for emptiness.
- `elif len(username) < 3:` enforces a minimum length.
- `re.match(r'^[a-zA-Z0-9_]+$', username)` applies a regular expression. `^` matches the start, `[a-zA-Z0-9_]+` matches one or more alphanumeric characters or underscores, and `$` matches the end.
- The `email_pattern` checks for characters, an `@`, characters, a `.`, and characters.
- If an error is found, it is added to the `errors` dictionary keyed by the field name.
- `return errors` yields the populated dictionary, which will be empty if all checks pass.

### CS lens
Validation is a form of parsing and bounds checking. Input at a system boundary is entirely untrusted. By validating all fields in a single pass before returning, the system provides "fail-complete" feedback, which is vastly superior UX compared to "fail-fast" feedback that requires a user to fix one error only to discover another upon the next submission.

### SE lens
Isolating validation into a pure function `validate_registration` separates domain rules from HTTP routing. This function does not know about Flask, `request`, or HTTP status codes. It only knows data. This makes it easily testable in isolation.

### Commands needed
```bash
Run: python app.py
```

### Run it
Calling `validate_registration('al', 'bad', 'short')` will return `{'username': 'Username must be at least 3 characters.', 'email': 'Enter a valid email address.', 'password': 'Password must be at least 8 characters.'}`.

### One sentence connecting to previous unit
With validation ensuring the data is correctly shaped, we must now securely transform the password before saving the user to the database.

## Concept Unit: Hash and store

### The Problem
Storing passwords as plain text means that anyone who accesses the database can read them. How do we store a representation of the password that can be verified later but cannot be reversed into the original password, and how do we handle database insertion?

### Introduce the concept in isolation
```python
from argon2 import PasswordHasher

ph = PasswordHasher()
hash_str = ph.hash("mysecretpassword")
print("Hash:", hash_str)
print("Verify:", ph.verify(hash_str, "mysecretpassword"))
```
Output:
```
Hash: $argon2id$v=19$m=65536,t=3,p=4$RAB...
Verify: True
```
This proves that hashing creates a secure, one-way representation of a password. The `verify` method can confirm the original string matches the hash without reversing it.

### Discard the throwaway
This throwaway hashing script is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified).
- **Change type:** Add.
- **Location:** Adding the database logic and the POST route.
- **Dependencies:** `argon2-cffi`, `sqlite3`.

### The New Code
```python
import sqlite3
from argon2 import PasswordHasher
from flask import request, redirect, url_for, g

ph = PasswordHasher()

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect('app.db')
        g.db.row_factory = sqlite3.Row
        g.db.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL, password_hash TEXT NOT NULL)')
        g.db.commit()
    return g.db

@app.route('/register', methods=['POST'])
def register_post():
    username = request.form.get('username','').strip()
    email    = request.form.get('email','').strip().lower()
    password = request.form.get('password','')
    
    errors = validate_registration(username, email, password)
    
    if errors:
        return render_template('register.html', form={'username':username,'email':email}, errors=errors), 422
        
    password_hash = ph.hash(password)
    
    try:
        get_db().execute('INSERT INTO users (username,email,password_hash) VALUES (?,?,?)', (username,email,password_hash))
        get_db().commit()
    except sqlite3.IntegrityError:
        errors['username'] = 'Username already taken.'
        return render_template('register.html', form={'username':username,'email':email}, errors=errors), 422
        
    return redirect(url_for('login'))
```

### The Updated Project
```python
1: import sqlite3
2: from argon2 import PasswordHasher
3: from flask import Flask, render_template, request, redirect, url_for, g
4: 
5: app = Flask(__name__)
6: ph = PasswordHasher() # ← new
7: 
8: # ← new get_db() function here
9: 
10: @app.route('/register', methods=['GET'])
11: def register_get():
12:     return render_template('register.html', form={}, errors={})
13: 
14: # ← new
15: @app.route('/register', methods=['POST'])
16: def register_post():
17:     # ... processes form, validates, hashes, inserts ...
```
The POST route handles the form submission, extracting the data, passing it through our validation function, hashing the password if validation passes, and then attempting to write the user record to the database.

### Mechanical walkthrough
- `ph = PasswordHasher()` instantiates the Argon2 hasher.
- `request.form.get('username','').strip()` safely retrieves the username and removes leading/trailing whitespace.
- `email.lower()` normalizes the email so `Alice@Example.com` is treated as `alice@example.com`.
- `validate_registration(...)` is called. If `errors` is not empty, the template is re-rendered with a `422 Unprocessable Entity` status.
- `ph.hash(password)` generates the secure Argon2 hash.
- `get_db().execute(...)` uses parameterized queries `(?,?,?)` to safely insert the data.
- `except sqlite3.IntegrityError:` catches the database error thrown if the `username` already exists in the `users` table due to the `UNIQUE` constraint, turning it into a user-friendly error.

### CS lens
Cryptographic hashing is fundamentally different from encryption. Encryption is a two-way street (with a key, you can decrypt). Hashing is one-way. Argon2id specifically provides resistance to GPU cracking attacks by requiring significant memory and time to compute, making brute-force attacks infeasible.

### SE lens
Catching the `IntegrityError` from the database rather than doing a prior `SELECT` query prevents a race condition (Time-Of-Check to Time-Of-Use). If we `SELECT` to check availability, and another request inserts the same username a millisecond later, our `INSERT` would crash. Letting the database enforce uniqueness and catching the resulting error is robust and safe.

### Commands needed
```bash
Run: python app.py
```

### Run it
Submitting a valid registration creates the table, hashes the password, inserts the record, and returns a `302 Found` redirect to the login page. A duplicate username submission results in the form repopulating with the error "Username already taken."

### One sentence connecting to previous unit
Catching uniqueness errors upon submission is safe, but we can provide a better user experience by checking availability instantly as the user types.

## Concept Unit: Inline username uniqueness check with HTMX

### The Problem
Waiting until the user clicks "Register" to tell them a username is taken is frustrating. How can we check the username against the database in real-time as they interact with the form, without submitting the entire page?

### Introduce the concept in isolation
```python
from flask import Flask, request

app = Flask(__name__)

@app.route('/validate', methods=['POST'])
def validate():
    username = request.form.get('username', '')
    if username == 'alice':
         return '<span class="error">Taken</span>'
    return '<span class="ok">Available</span>'

with app.test_request_context():
    with app.test_client() as c:
        print(c.post('/validate', data={'username': 'alice'}).data.decode())
        print(c.post('/validate', data={'username': 'bob'}).data.decode())
```
Output:
```html
<span class="error">Taken</span>
<span class="ok">Available</span>
```
This proves a small route can receive a single field via POST and return just a fragment of HTML (a span) representing the validation state.

### Discard the throwaway
This throwaway validation stub is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified).
- **Change type:** Add.
- **Location:** New route in `app.py`.
- **Dependencies:** Database access.

### The New Code
```python
@app.route('/validate/username', methods=['POST'])
def validate_username():
    username = request.form.get('username','').strip()
    
    if not username: 
        return '<span class="error">Required.</span>', 422
    if len(username) < 3: 
        return '<span class="error">Min 3 characters.</span>', 422
    
    import re
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return '<span class="error">Letters, numbers, underscores only.</span>', 422
        
    existing = get_db().execute('SELECT id FROM users WHERE username=?', (username,)).fetchone()
    if existing:
        return '<span class="error">Username already taken.</span>', 422
        
    return '<span class="ok">✓ Available</span>'
```

### The Updated Project
```python
1: @app.route('/register', methods=['POST'])
2: def register_post():
3:     # ... existing registration logic ...
4: 
5: # ← new
6: @app.route('/validate/username', methods=['POST'])
7: def validate_username():
8:     # ... inline HTMX validation logic ...
```
This endpoint pairs with the `hx-post="/validate/username"` we added to the username input in the HTML earlier. It receives only the username, runs the basic checks, and does a database lookup to determine availability.

### Mechanical walkthrough
- `username = request.form.get('username','').strip()` gets the current input value.
- The route manually duplicates the length and format checks from our centralized validation. It returns `422` status codes and HTML snippets for errors.
- `get_db().execute('SELECT id FROM users WHERE username=?', (username,)).fetchone()` queries the database for the username.
- If `existing` is not `None`, it returns an error span.
- If all checks pass, it returns a success span. HTMX receives this HTML and swaps it into the `#username-err` element.

### CS lens
This is partial evaluation of input. We are bringing backend validation rules closer to the frontend interaction loop. Because the client only trusts the server, we don't write duplicate JavaScript validation; we just ask the server to run its rules on a partial subset of the data (just the username).

### SE lens
Note that the server *still* fully validates the username in `register_post` upon final submission. The client-side HTMX check is purely for user experience (UX). Never rely on client-triggered partial validations for data integrity; the final POST must always re-verify everything.

### Commands needed
```bash
Run: python app.py
```

### Run it
Typing a name into the registration form and clicking out of the field triggers a POST to `/validate/username`. The server responds with HTML, and HTMX replaces the error span. Typing "alice" shows it is taken; typing "bob" shows "✓ Available".

### One sentence connecting to previous unit
Once the user submits a valid and unique form, they are in the database, but we still need to seamlessly log them into their new account.

## Concept Unit: Post-registration flow

### The Problem
After inserting the user into the database, redirecting them to the login page forces them to type their credentials again. How do we automatically log them in and securely initialize their session state?

### Introduce the concept in isolation
```python
from flask import Flask, session

app = Flask(__name__)
app.secret_key = 'supersecret'

@app.route('/set')
def set_session():
    session.clear()
    session['user_id'] = 1
    session['username'] = 'alice'
    return "Session set"

with app.test_client() as c:
    c.get('/set')
    with c.session_transaction() as sess:
         print(sess)
```
Output:
```
<SecureCookieSession {'user_id': 1, 'username': 'alice'}>
```
This proves that modifying the `session` dictionary correctly sets the state required to recognize a user in future requests.

### Discard the throwaway
This throwaway session manipulation script is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified).
- **Change type:** Modify.
- **Location:** Inside `register_post`, replacing the final redirect.
- **Dependencies:** `session` and `flash` from Flask.

### The New Code
```python
from flask import session, flash

def complete_registration(user_id, username):
    session.clear()
    session['user_id'] = user_id
    session['username'] = username
    session['_fresh'] = True
    flash(f'Welcome, {username}! Your account has been created.', 'success')
    return redirect(url_for('dashboard'))
```

### The Updated Project
```python
1: @app.route('/register', methods=['POST'])
2: def register_post():
3:     # ... hash password ...
4:     try:
5:         cursor = get_db().execute('INSERT INTO users (username,email,password_hash) VALUES (?,?,?)', (username,email,password_hash))
6:         get_db().commit()
7:         user_id = cursor.lastrowid # ← new
8:     except sqlite3.IntegrityError:
9:         # ... error handling ...
10:        
11:     # ← new (replacing redirect to login)
12:     session.clear()
13:     session['user_id'] = user_id
14:     session['username'] = username
15:     session['_fresh'] = True
16:     flash(f'Welcome, {username}! Your account has been created.', 'success')
17:     return redirect(url_for('dashboard'))
```
Instead of bouncing the user back to the login screen, we capture the new `user_id` generated by SQLite, write it to the session, and send them directly into the application.

### Mechanical walkthrough
- `cursor = get_db().execute(...)` executes the insert and returns a cursor.
- `user_id = cursor.lastrowid` retrieves the auto-incremented primary key of the newly inserted row.
- `session.clear()` empties any existing session data.
- `session['user_id'] = user_id` and `session['username'] = username` establish the user's logged-in identity.
- `session['_fresh'] = True` is a standard convention indicating a recent, verified authentication event (useful for gating sensitive actions like changing a password later).
- `flash(...)` queues a one-time message to be displayed on the next page load.
- `redirect(url_for('dashboard'))` sends them to the main authenticated area.

### CS lens
Session management involves persisting state across stateless HTTP requests using signed cookies. By calling `session.clear()` before issuing the new identity, we mitigate session fixation attacks—a scenario where an attacker tricks a victim into using a pre-determined session cookie that the attacker controls.

### SE lens
We chose "Option A: auto-login after register" to minimize friction in the UX. The alternative, "Option B", would involve setting a "pending verification" flag in the session, sending an email with a token, and forcing the user to click it before logging in. While Option B is more secure against spam accounts, auto-login is superior for immediate user engagement and is suitable for our application footprint.

### Commands needed
```bash
Run: python app.py
```

### Run it
Completing the registration form now instantly redirects to `/dashboard`, and the flashed success message is displayed on the screen. The session securely holds the new user's ID.

### One sentence connecting to previous unit
With registration and auto-login complete, we must now build the actual login flow for users returning to the site.

## Closing

### Connect the pieces
We have built a resilient, secure user registration pipeline. Tracing the full flow: a `GET` request renders the initial HTML form. A user types their data; as they type, HTMX sends a partial `POST` to check if their username is taken, offering immediate feedback. Upon clicking "Register", a full `POST` request hits the server. The data passes through rigorous validation rules checking length and formatting. Once validated, the plaintext password is mathematically transformed into an Argon2id hash. The database safely inserts the new user, guaranteeing uniqueness via schema constraints. Finally, the server creates a secure session cookie, bypassing the login screen to welcome the user directly into the application.
