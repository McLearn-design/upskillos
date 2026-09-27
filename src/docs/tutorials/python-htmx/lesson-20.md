# Lesson 20: HTTP is Stateless — Cookies as the Identity Mechanism

**What you will build**
You will build a series of small routes to demonstrate how HTTP state is lost between requests and how cookies bridge this gap. By the end, you'll understand how to set, read, and secure cookies to persist data like login state across independent requests.

**What you need to know first**
- You should understand basic Flask routing from previous lessons.

**Terms used in this lesson**
- **Stateless** — A protocol design where each request is independent; the server has no memory of previous requests. It exists to simplify server design and improve scalability.
- **Cookie** — A small key-value string sent by the server and stored by the browser. It exists to allow stateless protocols to maintain user sessions.
- **HttpOnly** — A security attribute that prevents JavaScript from accessing a cookie. It exists to block Cross-Site Scripting (XSS) attacks from stealing session tokens.
- **Secure** — A security attribute that ensures the cookie is only sent over HTTPS. It exists to prevent interception over unencrypted networks.
- **SameSite** — A security attribute that controls when cookies are sent in cross-origin requests. It exists to prevent Cross-Site Request Forgery (CSRF) attacks.
- **Max-Age** — An attribute specifying how long a cookie lives in seconds. It exists to manage the lifespan of persistent state.

**Objects and methods used**
- **`Flask`**
  - *What it is:* The main application object for a web app.
  - *Implementation:* `class Flask`
  - *Its use:* Used to define routes and run the server.
  - *Type:* Class
  - *Responsibility:* Manages routing and request dispatching.
  - *Depends on:* The WSGI environment.
  - *Connects to:* Routes incoming requests to view functions.
  - *Shape:* Central framework object.
- **`request`**
  - *What it is:* The global request object.
  - *Implementation:* `request` proxy object
  - *Its use:* Used to read cookies.
  - *Type:* Context local proxy
  - *Responsibility:* Provides access to incoming HTTP data.
  - *Depends on:* An active request context.
  - *Connects to:* Read by view functions.
  - *Shape:* Public API surface for incoming data.
- **`make_response`**
  - *What it is:* Helper to create a response object.
  - *Implementation:* `def make_response(*args)`
  - *Its use:* Allows setting cookies on the response.
  - *Type:* Function
  - *Responsibility:* Converts view returns into a Response object.
  - *Depends on:* View function output.
  - *Connects to:* Used by view functions.
  - *Shape:* Public API surface for outgoing data.
- **`set_cookie`**
  - *What it is:* Method to set a cookie header.
  - *Implementation:* `def set_cookie(key, value='', max_age=None, secure=False, httponly=False, samesite=None)`
  - *Its use:* Instructs browser to store data.
  - *Type:* Instance method
  - *Responsibility:* Sets the `Set-Cookie` header.
  - *Depends on:* Response object.
  - *Connects to:* Outgoing HTTP headers.
  - *Shape:* Protocol boundary.
- **`delete_cookie`**
  - *What it is:* Method to delete a cookie.
  - *Implementation:* `def delete_cookie(key)`
  - *Its use:* Instructs browser to remove a cookie.
  - *Type:* Instance method
  - *Responsibility:* Sets cookie max-age to 0.
  - *Depends on:* Response object.
  - *Connects to:* Outgoing HTTP headers.
  - *Shape:* Protocol boundary.
- **`request.cookies.get`**
  - *What it is:* Method to safely retrieve a cookie.
  - *Implementation:* `def get(key, default=None)`
  - *Its use:* Gets cookie value or default.
  - *Type:* Dictionary method
  - *Responsibility:* Safely accesses stored cookies.
  - *Depends on:* Incoming request.
  - *Connects to:* Read by view functions.
  - *Shape:* Internal implementation detail.

## Concept Unit: Demonstrating statelessness

### The Problem
HTTP has no memory. How do we prove that a server forgets variables between requests?

### Introduce the concept in isolation
We can demonstrate a local variable resetting by calling a function multiple times.
```python
def stateless_counter():
    count = 0
    count += 1
    return count

print(stateless_counter())
print(stateless_counter())
```
Predicted output:
```
1
1
```
This proves that local variables are destroyed when the function exits.

### Discard the throwaway
We will discard this basic function and use a real Flask route instead.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are building a minimal demo.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** At the bottom of `app.py`
- **Dependencies:** Flask

### The New Code
```python
from flask import Flask, request
app = Flask(__name__)

@app.route('/counter')
def counter():
    # HTTP is stateless: no memory between requests
    # This counter ALWAYS returns 1, no matter how many times you visit:
    count = 0  # lost after every request
    count += 1
    return f'<p>You have visited {count} time(s). (Always 1!)</p>'

# To persist state between requests, you need:
# 1. A cookie (stored in browser)
# 2. A database (server-side, keyed by session ID in cookie)
# 3. URL parameter (fragile, not for auth)
print('HTTP stateless: server has NO memory between requests')
print('Solutions: cookies, server-side sessions, URL params')
```

### The Updated Project
```python
1: from flask import Flask, request
2: app = Flask(__name__)
3:
4: @app.route('/counter')
5: def counter():
6:     count = 0
7:     count += 1
8:     return f'<p>You have visited {count} time(s). (Always 1!)</p>'
```
This route initializes `count=0` on every single request.

### Mechanical walkthrough
- The `@app.route` decorator registers the route.
- The `counter` function is called.
- `count = 0` initializes the local variable.
- `count += 1` increments it.
- A formatted string is returned.

### CS lens
Statelessness simplifies distributed systems. Any server can handle any request because no single server needs to remember the past.

### SE lens
Relying on statelessness means horizontal scaling is trivial.

### Commands needed
Run: `python app.py`

### Run it
Trace: GET `/counter`: count=0 -> count=1. GET `/counter` again: count=0 -> count=1. Server has NO shared state.

### One sentence connecting to previous unit
Because HTTP is stateless, we need a mechanism to remember things like identity.

## Concept Unit: Setting and reading cookies manually

### The Problem
How can the server tell the client to hold onto data and send it back?

### Introduce the concept in isolation
We can simulate HTTP headers with a dictionary.
```python
headers = {}
headers['Set-Cookie'] = 'username=alice'
print(headers)
```
Predicted output:
```
{'Set-Cookie': 'username=alice'}
```
This shows how the server instructs the browser using headers.

### Discard the throwaway
We will discard this dictionary simulation and use Flask's real `make_response`.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are demonstrating cookies.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** Below the `/counter` route
- **Dependencies:** None

### The New Code
```python
from flask import Flask, request, make_response
app = Flask(__name__)

@app.route('/set-cookie')
def set_cookie():
    resp = make_response('<p>Cookie set! <a href="/read-cookie">Read it</a></p>')
    # Set-Cookie header: browser stores this
    resp.set_cookie(
        'username',          # cookie name
        'alice',             # cookie value
        max_age=3600,        # seconds until expiry (0 = session cookie)
        httponly=True,       # JS cannot access (XSS protection)
        samesite='Lax',     # sent on same-site + top-level cross-site navigation
    )
    return resp

@app.route('/read-cookie')
def read_cookie():
    username = request.cookies.get('username', 'stranger')
    return f'<p>Hello, {username}! (from cookie)</p>'

@app.route('/delete-cookie')
def delete_cookie():
    resp = make_response('<p>Cookie deleted.</p>')
    resp.delete_cookie('username')  # sets Max-Age=0
    return resp

print('Set-Cookie: server instructs browser to store a cookie')
print('Cookie: browser sends stored cookies automatically on every request')
```

### The Updated Project
```python
1: @app.route('/set-cookie')
2: def set_cookie():
3:     resp = make_response('<p>Cookie set! <a href="/read-cookie">Read it</a></p>')
4:     resp.set_cookie('username', 'alice', max_age=3600, httponly=True, samesite='Lax')
5:     return resp
```
The response now includes a Set-Cookie header.

### Mechanical walkthrough
- `make_response` wraps the HTML string into a response object.
- `resp.set_cookie` sets the header.
- `request.cookies.get` reads the incoming cookie.
- `resp.delete_cookie` sets the max age to 0, expiring it.

### CS lens
Cookies act as a state-transfer mechanism, essentially closing the loop between client and server across discrete TCP connections.

### SE lens
Using cookies offloads storage from the server, but introduces trust issues since data resides on the client.

### Commands needed
Run: `python app.py`

### Run it
Trace: GET `/set-cookie`: response includes `Set-Cookie`. Browser stores it. GET `/read-cookie`: browser sends `Cookie: username=alice`.

### One sentence connecting to previous unit
Now that we can read and write cookies, we can build a persistent counter.

## Concept Unit: The cookie lifecycle and browser storage

### The Problem
How do we update a cookie's value over multiple requests?

### Introduce the concept in isolation
Parsing string counts to integers and back.
```python
count = int("0")
count += 1
print(str(count))
```
Predicted output:
```
1
```
This is the core logic of reading, modifying, and saving the cookie.

### Discard the throwaway
We will discard this string conversion and apply it to the actual cookie string.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** Below the read/delete cookie routes
- **Dependencies:** None

### The New Code
```python
from flask import Flask, request, make_response
app = Flask(__name__)

@app.route('/visit-counter')
def visit_counter():
    # Read existing count from cookie:
    count = int(request.cookies.get('visit_count', '0'))
    count += 1  # increment
    resp = make_response(f'<p>Visit #{count}. <a href="/visit-counter">Refresh</a></p>')
    # Store new count in cookie:
    resp.set_cookie('visit_count', str(count), max_age=86400)  # 24 hours
    return resp

# Now the counter PERSISTS across requests (stored in browser)
# Limitations of cookie-stored state:
# 1. Browser can clear cookies -> count resets
# 2. Different browser = different cookie = different count
# 3. Max cookie size: 4KB (cannot store large data)
# 4. Visible to user: can be manipulated (not signed)
# 5. Security: must set HttpOnly, Secure (HTTPS), SameSite
print('Cookie as state: persists in browser, not on server')
print('Problem: 4KB limit, user-visible, not inherently tamper-proof')
print('Solution: sign cookies (Flask session) or store server-side (session ID in cookie)')
```

### The Updated Project
```python
1: @app.route('/visit-counter')
2: def visit_counter():
3:     count = int(request.cookies.get('visit_count', '0'))
4:     count += 1
5:     resp = make_response(f'<p>Visit #{count}. <a href="/visit-counter">Refresh</a></p>')
6:     resp.set_cookie('visit_count', str(count), max_age=86400)
7:     return resp
```
The endpoint now reads, increments, and overwrites the cookie.

### Mechanical walkthrough
- `request.cookies.get` fetches the current count or defaults to `'0'`.
- `int(...)` converts it to an integer.
- `count += 1` increments it.
- `str(count)` converts it back.
- `resp.set_cookie` overwrites the old cookie with the new value.

### CS lens
This is essentially an eventually-consistent read-modify-write cycle using the client as storage.

### SE lens
Storing unencrypted state in a cookie means users can manipulate it. Never trust client-side data for authorization.

### Commands needed
Run: `python app.py`

### Run it
Trace: First GET `/visit-counter`: sets `visit_count=1`. Second GET: sends `visit_count=1`, server sets `visit_count=2`.

### One sentence connecting to previous unit
Because users can intercept cookies, we must secure them properly.

## Concept Unit: Cookie security attributes

### The Problem
How do we stop attackers from stealing or abusing these cookies?

### Introduce the concept in isolation
Checking flag configurations.
```python
secure_flag = True
print("Secure:", secure_flag)
```
Predicted output:
```
Secure: True
```
This demonstrates setting a boolean flag.

### Discard the throwaway
We will discard this flag and pass it to Flask.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** Below the visit counter
- **Dependencies:** None

### The New Code
```python
from flask import Flask, make_response
app = Flask(__name__)
app.config['SESSION_COOKIE_SECURE'] = True  # only send over HTTPS

@app.route('/secure-demo')
def secure_demo():
    resp = make_response('<p>Secure cookie demo</p>')
    # Secure: only sent over HTTPS (not HTTP)
    # HttpOnly: not accessible via JavaScript (blocks XSS cookie theft)
    # SameSite: controls cross-site sending
    #   'Strict': only sent on same-site requests (breaks some OAuth flows)
    #   'Lax': sent on same-site + top-level navigation (recommended default)
    #   'None': sent on all requests (requires Secure=True)
    resp.set_cookie(
        'auth_token',
        'some-value',
        secure=True,         # HTTPS only
        httponly=True,       # no JS access
        samesite='Lax',     # CSRF protection
        max_age=7200,        # 2 hours
        path='/',            # sent for all paths
        domain=None,         # current domain only (not subdomains)
    )
    return resp

# What each attribute prevents:
print('Secure: prevents cookie theft over unencrypted HTTP (MITM attack)')
print('HttpOnly: prevents XSS script stealing cookie via document.cookie')
print('SameSite=Lax: prevents CSRF (form submission from evil.com does not send cookie)')
print('Max-Age: prevents cookie living forever (reduces session hijacking window)')
```

### The Updated Project
```python
1: @app.route('/secure-demo')
2: def secure_demo():
3:     resp = make_response('<p>Secure cookie demo</p>')
4:     resp.set_cookie('auth_token', 'some-value', secure=True, httponly=True, samesite='Lax')
5:     return resp
```
The cookie is now hardened with security flags.

### Mechanical walkthrough
- `secure=True` instructs the browser to only transmit this cookie over HTTPS.
- `httponly=True` hides the cookie from `document.cookie` in JavaScript.
- `samesite='Lax'` prevents the browser from sending this cookie when a third-party site initiates a POST request.
- `path='/'` limits the cookie to the root path and below.

### CS lens
Security attributes move responsibility from the server application to the client's browser agent, enforcing rules at the network boundary.

### SE lens
Always use HttpOnly and Secure for authentication tokens to mitigate XSS and MITM attacks.

### Commands needed
Run: `python app.py`

### Run it
Trace: SameSite=Lax blocks evil.com from submitting a form with your cookie.

### One sentence connecting to previous unit
With security configured, we can choose how long these cookies should live.

## Concept Unit: Session cookies vs persistent cookies

### The Problem
When should a cookie expire?

### Introduce the concept in isolation
Calculations of seconds.
```python
seconds_in_day = 24 * 3600
print(seconds_in_day)
```
Predicted output:
```
86400
```
This shows how `max_age` is calculated.

### Discard the throwaway
We will discard this calculation and use it directly.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** Below the secure demo
- **Dependencies:** None

### The New Code
```python
from flask import Flask, make_response
app = Flask(__name__)

@app.route('/session-cookie')
def session_cookie_demo():
    resp = make_response('<p>Session cookie set (no Max-Age)</p>')
    # Session cookie: no Max-Age, no Expires
    # Browser deletes it when browser is closed
    resp.set_cookie('temp_pref', 'dark_mode')  # no max_age
    return resp

@app.route('/persistent-cookie')
def persistent_cookie_demo():
    resp = make_response('<p>Persistent cookie set (30 days)</p>')
    # Persistent cookie: survives browser close
    resp.set_cookie('remember_me', 'user_token_here', max_age=30*24*3600)
    return resp

# For authentication:
# Session cookie: user logged out when browser closes
# Persistent cookie: 'Remember me' checkbox
# Tradeoff: persistent cookies are more convenient but increase hijacking window
print('Session cookie: max_age=None. Deleted when browser closes.')
print('Persistent cookie: max_age=seconds. Survives restarts.')
print('Auth best practice: session cookie by default, persistent only with "Remember me"')
```

### The Updated Project
```python
1: @app.route('/session-cookie')
2: def session_cookie_demo():
3:     resp = make_response('<p>Session cookie set (no Max-Age)</p>')
4:     resp.set_cookie('temp_pref', 'dark_mode')
5:     return resp
```
The session route omits `max_age`, meaning it expires on browser close.

### Mechanical walkthrough
- `set_cookie` without `max_age` creates a session cookie.
- `set_cookie` with `max_age=30*24*3600` computes the lifetime in seconds and sets a persistent cookie.

### CS lens
Session lifecycle management is a fundamental tradeoff between usability (persisting login) and security (minimizing the attack window).

### SE lens
Default to session cookies unless the user explicitly checks "Remember me".

### Commands needed
Run: `python app.py`

### Run it
Trace: Session cookie deleted on browser close. Persistent cookie survives.

### One sentence connecting to previous unit
Understanding cookie lifetimes sets the stage for implementing robust authentication.

## Closing

### Connect the pieces
HTTP is stateless. By utilizing cookies and setting appropriate security and lifecycle attributes, we can build stateful applications that remember users across requests. Trace visit counter across requests: browser sends `Cookie:visit_count=2` -> Flask reads `request.cookies['visit_count']='2'` -> `int('2')=2` -> increment to 3 -> response `Set-Cookie:visit_count=3;Max-Age=86400` -> browser updates stored value -> next request sends 3 through ALL concept units.
