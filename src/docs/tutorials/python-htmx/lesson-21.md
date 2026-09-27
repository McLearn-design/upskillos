# Lesson 21: Flask Sessions — The session Object, SECRET_KEY, and Signed Cookies

**What you will build**
You will implement user sessions in a Flask application to persist state across multiple requests. The transferable insight here is understanding how client-side sessions work: Flask's `session` is a dictionary-like object stored as a cryptographically signed cookie. The server never stores the session data — it's all in the cookie, signed with `SECRET_KEY` using HMAC-SHA1. The signature prevents tampering: if a user modifies the cookie, the signature check fails and Flask rejects it.

**What you need to know first**
- Lesson 20: Routing and request handling.

**Terms used in this lesson**
- **Client-side session** — A mechanism for persisting state across stateless HTTP requests where the data itself is stored in the user's browser (usually in a cookie), rather than on the server, saving server memory.
- **Cryptographic signing** — The process of attaching a calculated hash (like HMAC) to data using a secret key, so that any tampering with the data can be detected by recalculating the hash and comparing it.
- **Base64 encoding** — A way to represent binary data (or text) using a restricted set of 64 characters. It exists to safely transport data across systems that might not handle all raw bytes well, but it provides zero cryptographic security or encryption.
- **Session fixation** — An attack where a malicious user tricks a victim into using a known session identifier, so that when the victim logs in, the attacker is also logged in as the victim.

**Objects and methods used**

- **`Flask`**
  - *What it is:* The main application class for a Flask web application.
  - *Implementation:* `class Flask(import_name: str, ...)`
  - *Its use:* We use it to create our web app instance and configure our `SECRET_KEY`.
  - *Type:* Class
  - *Responsibility:* Manages the application configuration, routing, and lifecycle of the web server.
  - *Depends on:* An import name (`__name__`) to know where to look for resources.
  - *Connects to:* Receives requests from the WSGI server, passes them to route functions.
  - *Shape:* The central registry and configuration object at the root of the application architecture.

- **`session`**
  - *What it is:* A proxy object representing the current request's session data.
  - *Implementation:* `session: LocalProxy` behaving as a `dict`.
  - *Its use:* We read from and write to it to persist user state (like `visits` or `user_id`) across requests.
  - *Type:* Context-local Proxy object (dict-like)
  - *Responsibility:* Exposes session data to the application code and triggers the cookie serialization/deserialization process.
  - *Depends on:* The application's `SECRET_KEY` configuration and the incoming request's cookies.
  - *Connects to:* Read/written by route handlers; serialized into HTTP response cookies by Flask.
  - *Shape:* A thread-local data structure bridging application code and the HTTP cookie layer.

- **`SECRET_KEY`**
  - *What it is:* A configuration key used for cryptographic signing.
  - *Implementation:* `app.config['SECRET_KEY'] = <string or bytes>`
  - *Its use:* Required by Flask to sign the session cookie, ensuring users cannot forge or tamper with their session data.
  - *Type:* Configuration dictionary key
  - *Responsibility:* Acts as the symmetric key for HMAC generation and validation.
  - *Depends on:* Must be set securely by the developer before accessing `session`.
  - *Connects to:* Consumed by Flask's session interface during cookie generation and validation.
  - *Shape:* A foundational configuration value in the application layer.

## Concept Unit: Using the session object

### The Problem
HTTP is stateless. When a user requests page A and then page B, the server has no built-in way to know it's the same user. How do we remember data (like a visit count or login state) across multiple requests without forcing the server to keep a massive database of every active user?

### Introduce the concept in isolation
```python
import secrets
from flask import Flask, session, request, redirect, url_for

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

@app.route('/')
def index():
    visits = session.get('visits', 0)
    session['visits'] = visits + 1
    return f'<p>Visits: {session["visits"]}. <a href="/clear">Clear</a></p>'

@app.route('/clear')
def clear():
    session.clear()  # removes all session data
    return redirect(url_for('index'))

with app.test_client() as client:
    r1 = client.get('/')  # visits=1
    r2 = client.get('/')  # visits=2 (cookie retained)
    r3 = client.get('/')  # visits=3
    print('Response:', r3.data.decode())
    client.get('/clear')
    r4 = client.get('/')  # visits=1 again after clear
    print('After clear:', r4.data.decode())
```
This is called a **client-side session**. The output proves that the `session` object acts like a dictionary that persists state across requests, and that clearing it resets the state.

### Discard the throwaway
This throwaway example is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are demonstrating session basics.
- **Files affected:** `app.py` (created)
- **Change type:** add
- **Location:** at the top level
- **Dependencies:** `flask`

### The New Code
```python
import secrets
from flask import Flask, session

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

@app.route('/')
def index():
    session['visits'] = session.get('visits', 0) + 1
    return f'Visits: {session["visits"]}'
```

### The Updated Project
```python
# 1: import secrets
# 2: from flask import Flask, session
# 3: 
# 4: app = Flask(__name__)
# 5: app.config['SECRET_KEY'] = secrets.token_hex(32) # ← new
# 6: 
# 7: @app.route('/')
# 8: def index():
# 9:     session['visits'] = session.get('visits', 0) + 1 # ← new
# 10:    return f'Visits: {session["visits"]}'
```
This structure creates a Flask app, generates a secure secret key, and defines a route that increments a persistent visit counter in the user's session.

### Mechanical walkthrough
1. `import secrets`: Imports Python's built-in module for generating cryptographically strong random numbers.
2. `from flask import Flask, session`: Imports the core application class and the session proxy.
3. `app = Flask(__name__)`: Initializes the application instance.
4. `app.config['SECRET_KEY'] = secrets.token_hex(32)`: Sets the `SECRET_KEY` configuration variable to a random 64-character hex string. This is required to use sessions.
5. `@app.route('/')`: Maps the root URL to the `index` function.
6. `session['visits'] = session.get('visits', 0) + 1`: Reads the `visits` key from the dictionary-like `session` (defaulting to 0 if missing), adds 1, and stores it back.
7. `return f'Visits: {session["visits"]}'`: Returns the value as an HTTP response. Flask will automatically serialize the session dict, sign it with the `SECRET_KEY`, and send it as a `Set-Cookie` header.

### CS lens
In computer science, distributed state management is a fundamental challenge. By placing the state in the client (the browser) and relying on cryptographic signatures for integrity, we trade bandwidth (sending the state back and forth on every request) for memory and scalability (the server holds zero state).

### SE lens
Relying on a randomly generated `SECRET_KEY` on startup means that every time the server restarts, all existing sessions become invalid (because they were signed with the old key). In a real production environment, you must provide a persistent, static secret key via environment variables so sessions survive deployments.

### Commands needed
Run: `python app.py`

### Run it
Execute the script and visit `http://127.0.0.1:5000/`. Refreshing the page increments the counter.

### One sentence connecting to previous unit
Now that we can store data across requests, we need to understand exactly how this data is traveling between the client and server.

## Concept Unit: What a Flask session cookie looks like

### The Problem
If the server isn't storing our session dictionary, where exactly is it? And if it's sent to the user, can the user read or modify our application state?

### Introduce the concept in isolation
```python
import secrets
from flask import Flask, session
from itsdangerous import URLSafeTimedSerializer

app = Flask(__name__)
app.config['SECRET_KEY'] = 'demo-key-for-inspection'

@app.route('/inspect-session')
def inspect_session():
    session['user_id'] = 42
    session['role'] = 'admin'
    return 'Session set. Check cookies in browser DevTools.'

# What Flask actually does internally (simplified):
secret = 'demo-key-for-inspection'
data = {'user_id': 42, 'role': 'admin', '_fresh': True}
import json, base64, hmac, hashlib
payload = base64.urlsafe_b64encode(json.dumps(data).encode()).decode()
mac = hmac.new(secret.encode(), payload.encode(), hashlib.sha1).hexdigest()[:40]
fake_cookie = f'{payload}.{mac}'
print('Fake session cookie (simplified):', fake_cookie[:60], '...')
```
This is called a **signed cookie payload**. The output proves that the data is merely base64-encoded, not encrypted. Anyone can decode it, but no one can modify it without failing the HMAC check.

### Discard the throwaway
This throwaway example is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified)
- **Change type:** replace
- **Location:** `app.config['SECRET_KEY']` definition
- **Dependencies:** None

### The New Code
```python
app.config['SECRET_KEY'] = 'dev-static-key'
```

### The Updated Project
```python
# 1: import secrets
# 2: from flask import Flask, session
# 3: 
# 4: app = Flask(__name__)
# 5: app.config['SECRET_KEY'] = 'dev-static-key' # ← new (replaced random key)
# 6: 
# 7: @app.route('/')
# 8: def index():
# 9:     session['visits'] = session.get('visits', 0) + 1
# 10:    return f'Visits: {session["visits"]}'
```
This structure changes our key to a predictable static string, so we can inspect the generated cookie predictably.

### Mechanical walkthrough
1. `app.config['SECRET_KEY'] = 'dev-static-key'`: We hardcode a string instead of using a random hex string. This allows the session signature to be deterministic and survive restarts for development inspection.

### CS lens
HMAC (Hash-based Message Authentication Code) provides integrity, not confidentiality. The server computes `hash(secret + data)`. The client returns `data + hash`. The server recomputes `hash(secret + returned_data)`. If they match, the data is untampered. Confidentiality (encryption) would require a different mechanism.

### SE lens
Because session data is readable by the client (base64 encoded), you must never store sensitive information like passwords, API keys, or credit card numbers in a Flask session. You only store non-sensitive identifiers, like `user_id`, or UI state, like flash messages.

### Commands needed
Run: `python app.py`

### Run it
Open the application in a browser, open Developer Tools (F12), go to the Application/Storage tab, and look at the Cookies. You will see a cookie named `session`. Its value has a dot-separated structure where the first part is a readable base64 string.

### One sentence connecting to previous unit
Now that we know the session is just a cookie, we must consider how long that cookie lives on the user's machine.

## Concept Unit: session.permanent and session lifetime

### The Problem
By default, a browser deletes a "session cookie" as soon as the user closes the browser window. What if we want to implement a "Remember Me" feature so the user stays logged in for a week?

### Introduce the concept in isolation
```python
import secrets
from flask import Flask, session, request
from datetime import timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username', '')
    remember = request.form.get('remember') == 'on'
    session['user_id'] = 1
    session['username'] = username
    if remember:
        session.permanent = True
    else:
        session.permanent = False
    return f'Logged in. Permanent: {session.permanent}'

with app.test_client() as c:
    r = c.post('/login', data={'username': 'alice', 'remember': 'on'})
    print(r.data.decode())
```
This is called **session persistence configuration**. The output proves that setting `session.permanent = True` applies a specific lifetime to the session cookie, changing it from a temporary browser session to a persistent one.

### Discard the throwaway
This throwaway example is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified)
- **Change type:** add
- **Location:** below `SECRET_KEY` configuration
- **Dependencies:** `datetime.timedelta`

### The New Code
```python
from datetime import timedelta
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

@app.route('/login')
def login():
    session.permanent = True
    session['user_id'] = 1
    return 'Logged in permanently'
```

### The Updated Project
```python
# 1: import secrets
# 2: from flask import Flask, session
# 3: from datetime import timedelta # ← new
# 4: 
# 5: app = Flask(__name__)
# 6: app.config['SECRET_KEY'] = 'dev-static-key'
# 7: app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7) # ← new
# 8: 
# 9: @app.route('/login') # ← new route
# 10: def login():
# 11:     session.permanent = True
# 12:     session['user_id'] = 1
# 13:     return 'Logged in permanently'
```
This structure introduces a configuration variable to govern cookie expiry, and a route that creates a session explicitly marked as permanent.

### Mechanical walkthrough
1. `from datetime import timedelta`: Imports the `timedelta` object used to represent durations.
2. `app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)`: Sets the duration for permanent sessions to 7 days (604,800 seconds).
3. `@app.route('/login')`: A new route handler.
4. `session.permanent = True`: A boolean flag on the session proxy. When set to `True`, Flask will add an explicit `Expires` and `Max-Age` attribute to the `Set-Cookie` header in the HTTP response.
5. `session['user_id'] = 1`: Stores arbitrary state alongside the permanence flag.

### CS lens
An HTTP cookie without an `Expires` or `Max-Age` directive is treated by standard-compliant browsers as a "session cookie" — held in volatile memory and purged on exit. By supplying an expiration time, we force the browser to write the cookie to persistent disk storage, allowing it to survive application restarts on the client side.

### SE lens
It is good practice to keep session lifetimes relatively short and force re-authentication for sensitive actions (like changing a password). A long-lived cookie increases the window of opportunity for an attacker if a device is compromised.

### Commands needed
Run: `python app.py`

### Run it
Access the `/login` route. Inspect the cookie in DevTools again; you will now see an explicit Expiration date set exactly 7 days in the future.

### One sentence connecting to previous unit
While storing primitive data types like integers and strings works seamlessly, managing complex objects inside the session requires extra care.

## Concept Unit: Modifying session and the modified flag

### The Problem
If you store a list or a dictionary inside the Flask session, and then append a new item to that list, the new item mysteriously vanishes on the next request. Why didn't Flask save the changes?

### Introduce the concept in isolation
```python
import secrets
from flask import Flask, session

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

@app.route('/mutable-demo')
def mutable_demo():
    session['cart'] = ['apple', 'banana']
    session['cart'].append('cherry')  # DOES NOT trigger re-sign!
    print('Modified flag (wrong):', session.modified)  # False
    
    # Fix 1: reassign
    cart = session['cart']
    cart.append('cherry')
    session['cart'] = cart  
    print('After reassign:', session.modified)  # True
    
    # Fix 2: manual flag
    session.modified = True 
    return f'Cart: {session["cart"]}'
```
This is called **mutation tracking failure**. The output proves that mutating an object in-place bypasses the dictionary's item-assignment triggers, leaving the session marked as unmodified, unless we explicitly intervene.

### Discard the throwaway
This throwaway example is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified)
- **Change type:** add
- **Location:** new route at the bottom
- **Dependencies:** None

### The New Code
```python
@app.route('/add-item')
def add_item():
    cart = session.get('cart', [])
    cart.append('cherry')
    session['cart'] = cart  # MUST reassign!
    return f'Cart: {session["cart"]}'
```

### The Updated Project
```python
# ... (previous code unchanged)
# 14: 
# 15: @app.route('/add-item') # ← new
# 16: def add_item():
# 17:     cart = session.get('cart', [])
# 18:     cart.append('cherry')
# 19:     session['cart'] = cart
# 20:     return f'Cart: {session["cart"]}'
```
This structure retrieves a list from the session, mutates it, and safely reassigns it to guarantee the framework serializes the update.

### Mechanical walkthrough
1. `cart = session.get('cart', [])`: Fetches the `cart` list if it exists, or initializes a new empty list.
2. `cart.append('cherry')`: Mutates the local list reference. Flask has no way to intercept this standard Python operation.
3. `session['cart'] = cart`: The crucial step. Reassigning the key calls `__setitem__` on the session proxy, which flips `session.modified = True`.
4. `return ...`: When the response finalizes, Flask checks `session.modified`. Since it is `True`, Flask generates a newly signed cookie and sends it to the browser.

### CS lens
Flask's session behaves like a Python dictionary. Dictionaries only know when a key is explicitly assigned (`dict[key] = value`) or deleted. They cannot observe internal state changes of objects held as values. This is a fundamental limitation of reference semantics in memory management.

### SE lens
A common alternative to the reassignment pattern is setting `session.modified = True` unconditionally. However, explicit reassignment is generally preferred because it reads predictably and avoids relying on framework-specific "magic flags" scattered in business logic.

### Commands needed
Run: `python app.py`

### Run it
Visit `/add-item`. Refresh multiple times. The list correctly grows: `['cherry']`, `['cherry', 'cherry']`.

### One sentence connecting to previous unit
Knowing how to reliably persist data, we must secure the session mechanism against common web vulnerabilities.

## Concept Unit: Session security best practices

### The Problem
If a user clicks a malicious link that forces a pre-determined session ID onto their browser, and then they log in, the attacker (who knows that session ID) is now logged into their account too. How do we prevent this?

### Introduce the concept in isolation
```python
import secrets
from flask import Flask, session, request, redirect, url_for

app = Flask(__name__)
app.config.update(
    SECRET_KEY=secrets.token_hex(32),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_SAMESITE='Lax',
)

@app.route('/login', methods=['POST'])
def login():
    # After verifying password...
    old_data = dict(session)  
    session.clear()            
    session.update(old_data)   
    session['user_id'] = 1
    session['_fresh'] = True   
    return 'Logged in securely'
```
This is called **session regeneration** to prevent **session fixation**. The output proves that manually clearing the session before applying new authentication state breaks the link to any pre-existing compromised cookie.

### Discard the throwaway
This throwaway example is discarded and will not appear in the project again.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified)
- **Change type:** update
- **Location:** configuration section and login route
- **Dependencies:** None

### The New Code
```python
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
)

@app.route('/secure-login')
def secure_login():
    session.clear()
    session['user_id'] = 1
    session['_fresh'] = True
    return 'Logged in securely'
```

### The Updated Project
```python
# 1: import secrets
# 2: from flask import Flask, session
# 3: from datetime import timedelta
# 4: 
# 5: app = Flask(__name__)
# 6: app.config['SECRET_KEY'] = 'dev-static-key'
# 7: app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
# 8: app.config.update(                            # ← new
# 9:     SESSION_COOKIE_HTTPONLY=True,
# 10:    SESSION_COOKIE_SAMESITE='Lax',
# 11: )
# ... (other routes)
# 22: @app.route('/secure-login') # ← new
# 23: def secure_login():
# 24:     session.clear()
# 25:     session['user_id'] = 1
# 26:     session['_fresh'] = True
# 27:     return 'Logged in securely'
```
This structure applies hardened cookie parameters at the application level and demonstrates a secure login flow that purges old session state.

### Mechanical walkthrough
1. `app.config.update(...)`: Updates multiple application configuration keys simultaneously.
2. `SESSION_COOKIE_HTTPONLY=True`: Instructs the browser to deny JavaScript access to the cookie. This prevents Cross-Site Scripting (XSS) attacks from stealing the session.
3. `SESSION_COOKIE_SAMESITE='Lax'`: Instructs the browser not to send this cookie with cross-site requests, mitigating Cross-Site Request Forgery (CSRF).
4. `session.clear()`: Destroys the existing dictionary data, ensuring the next serialized cookie will be completely fresh and unrelated to the prior request state.
5. `session['_fresh'] = True`: A conventional key used to indicate the user explicitly authenticated *in this exact request*, rather than being restored implicitly from an older persistent cookie.

### CS lens
Session fixation is a vulnerability in the protocol state machine. The system incorrectly trusts a caller-supplied initial state (the pre-login session ID) and elevates its privileges. By discarding the initial state entirely (`session.clear()`), we enforce a strict state boundary where the unauthenticated phase has no influence over the authenticated phase.

### SE lens
Secure session management should be invisible to business logic. Modern extensions like Flask-Login automatically handle session regeneration and the `_fresh` attribute for you. Manually writing `session.clear()` is error-prone because developers forget; delegating security plumbing to tested libraries is the standard engineering practice.

### Commands needed
Run: `python app.py`

### Run it
Visit `/secure-login`. Inspecting the cookie will show it is now flagged with `HttpOnly` and `SameSite=Lax` in the browser's developer tools.

### One sentence connecting to previous unit
Understanding how state is securely persisted in the client allows us to build robust authentication flows in upcoming lessons.

## Closing
### Connect the pieces
The Flask `session` object acts like a simple dictionary, but it hides a powerful cryptographic pipeline. When a user logs in, we call `session.clear()` to prevent session fixation, then set `session['user_id'] = 1` and `session['_fresh'] = True`. Flask takes this dictionary, serializes it to JSON, base64-encodes it, and calculates an HMAC signature using your application's `SECRET_KEY`. This payload is delivered to the browser as a cookie with `HttpOnly` and `SameSite` protections. On the next request, the browser sends the cookie back. Flask decodes it, recalculates the HMAC, and if the signatures match, restores the dictionary so your route can read `session['user_id']`. The server scales infinitely because it holds no memory of the session itself — the cryptographically verifiable truth lives entirely in the client's hands.
