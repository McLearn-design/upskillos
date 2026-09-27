# Lesson 32: Security Headers, Rate Limiting, and Input Sanitization

This lesson introduces HTTP security headers, rate limiting, and input sanitization to defend against common web vulnerabilities. You will build a series of middleware functions and input validators that act as a last line of defense, intercepting malicious requests and enforcing strict browser policies. The transferable insight here is that security requires multiple layers: headers instruct the browser on what is safe, rate limiting prevents automated brute-force attacks, and sanitization ensures that user input cannot execute as code.

**What you need to know first:**
- You need to know the basic Flask request lifecycle and routing from Lesson 31.

**Terms used in this lesson:**
- **Security headers** — HTTP response headers that instruct browsers to enforce security policies, restricting what resources can load and what actions scripts can take. They exist to mitigate risks like XSS and clickjacking at the browser level.
- **Content-Security-Policy (CSP)** — An HTTP header that allows site administrators to declare approved sources of content that the browser may load. It exists to prevent Cross-Site Scripting (XSS) by explicitly blocking untrusted inline scripts and external domains.
- **Nonce** — A cryptographic number used only once. In the context of CSP, it exists to uniquely identify and allow specific, developer-authorized inline scripts to run on a page while blocking attacker-injected scripts that lack the nonce.
- **Rate limiting** — A technique for limiting network traffic, restricting the number of requests a user or IP can make in a given timeframe. It exists to protect applications from abuse, brute-force attacks, and credential stuffing.
- **Credential stuffing** — An automated attack where lists of compromised usernames and passwords are used to breach a system. Rate limiting exists to make this attack computationally unfeasible.
- **Cross-Site Scripting (XSS)** — A vulnerability where an attacker injects malicious executable scripts into the code of a trusted website. Auto-escaping and CSP exist to neutralize this threat.
- **Jinja2 auto-escaping** — A template engine feature that automatically converts special HTML characters (like `<` and `>`) into safe text representations (like `&lt;` and `&gt;`). It exists so that user input is always rendered as data, never as executable markup.
- **429 Too Many Requests** — The standard HTTP status code returned when a client has sent too many requests in a given amount of time. It exists to inform the client that they have hit a rate limit and must wait before retrying.

**Objects and methods used:**
- **`Flask.after_request`**
  - *What it is:* A Flask decorator that registers a function to run after every request, right before the response is sent to the client.
  - *Implementation:* `@app.after_request` wrapping a function `def f(response): return response`.
  - *Its use:* We use it to inject security headers into every outgoing HTTP response globally.
  - *Type:* Method decorator.
  - *Responsibility:* Intercepts the generated HTTP response and allows modification (like adding headers) before it leaves the server.
  - *Depends on:* A generated `flask.Response` object passed to it by the Flask framework.
  - *Connects to:* Called by the Flask request dispatcher; returns the modified response back to the dispatcher.
  - *Shape:* A global middleware boundary between the application's route handlers and the web server.

- **`flask.g`**
  - *What it is:* A global namespace object provided by Flask for storing data during a single application context (one request).
  - *Implementation:* `from flask import g; g.some_variable = "value"`.
  - *Its use:* We use it to store a per-request random nonce so that both the CSP header and the Jinja templates can access the exact same token.
  - *Type:* Thread-local proxy object.
  - *Responsibility:* Safely holds temporary, request-scoped data without leaking it across different concurrent requests.
  - *Depends on:* An active Flask application context and request context.
  - *Connects to:* Written to by `before_request` handlers; read by `after_request` handlers and templates.
  - *Shape:* Internal data-transfer boundary spanning the lifecycle of a single HTTP request.

- **`Flask.before_request`**
  - *What it is:* A Flask decorator that registers a function to run before the route handler for every incoming request.
  - *Implementation:* `@app.before_request` wrapping a function `def f(): pass`.
  - *Its use:* We use it to generate our random cryptographic nonce at the very start of the request so it is ready for templates and headers.
  - *Type:* Method decorator.
  - *Responsibility:* Executes setup logic and access control checks before the main application logic runs.
  - *Depends on:* The incoming HTTP request.
  - *Connects to:* Called by the Flask request dispatcher before hitting the matched view function.
  - *Shape:* A global middleware boundary on the incoming request path.

- **`flask.request`**
  - *What it is:* A proxy object that encapsulates the current HTTP request data.
  - *Implementation:* `from flask import request; ip = request.remote_addr`.
  - *Its use:* We use it to extract the client's IP address for rate limiting and to read submitted form data.
  - *Type:* Thread-local proxy object.
  - *Responsibility:* Provides access to URL parameters, form data, headers, and metadata of the incoming HTTP request.
  - *Depends on:* The WSGI environment provided by the web server.
  - *Connects to:* Read by view functions and middleware to make decisions based on client input.
  - *Shape:* The primary input boundary between the client and the application logic.

- **`flask.render_template_string`**
  - *What it is:* A function that renders a raw string as a Jinja2 template.
  - *Implementation:* `render_template_string("Hello {{ name }}", name="Alice")`.
  - *Its use:* We use it to demonstrate Jinja2's auto-escaping behavior inline without needing a separate HTML file.
  - *Type:* Free function.
  - *Responsibility:* Parses and evaluates a Jinja2 template string, interpolating provided variables safely.
  - *Depends on:* A string containing valid Jinja2 syntax and keyword arguments for template context.
  - *Connects to:* Called by view functions; returns a fully rendered string (usually HTML) to form the response body.
  - *Shape:* An internal presentation boundary that transforms data into the final output format.

---

## Concept Unit: Security headers with after_request

### The Problem
When a web browser visits your application, it tries to be helpful by guessing content types, allowing iframes, and executing scripts. This default permissiveness is dangerous. How do we explicitly tell the browser to restrict these behaviors, block cross-site framing (clickjacking), and only load scripts from trusted domains?

### Introduce the concept in isolation
```python
import secrets
from flask import Flask

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

@app.after_request
def set_security_headers(response):
    # Content-Security-Policy: whitelist allowed sources
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' https://unpkg.com https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "frame-ancestors 'none';"
    )
    # X-Frame-Options: old browser fallback for frame-ancestors
    response.headers['X-Frame-Options'] = 'DENY'
    # X-Content-Type-Options: prevent MIME sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    # Referrer-Policy: limit referrer info sent cross-site
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    # Permissions-Policy: disable unused browser features
    response.headers['Permissions-Policy'] = 'geolocation=(), camera=(), microphone=()'
    return response

@app.route('/')
def index(): 
    return '<h1>Secure App</h1>'

with app.test_client() as c:
    r = c.get('/')
    print('CSP:', r.headers.get('Content-Security-Policy')[:40], '...')
    print('X-Frame-Options:', r.headers.get('X-Frame-Options'))
    print('X-Content-Type-Options:', r.headers.get('X-Content-Type-Options'))
```
**Output:**
```
CSP: default-src 'self'; script-src 'self' ht ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
```
This proves that by hooking into `after_request`, we can append strict HTTP headers to every outgoing response. The browser will read these headers and enforce the policies, such as blocking MIME sniffing (`nosniff`) and denying iframe embedding (`DENY`).

### Discard the throwaway
This throwaway demonstration is discarded and will not be added to the project.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are introducing a security perimeter.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** After the application initialization in `app.py`.
- **Dependencies:** `Flask`.

### The New Code
```python
@app.after_request
def set_security_headers(response):
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' https://unpkg.com https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "frame-ancestors 'none';"
    )
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'geolocation=(), camera=(), microphone=()'
    return response
```

### The Updated Project
```python
1: app = Flask(__name__)
2: app.config['SECRET_KEY'] = secrets.token_hex(32)
3: 
4: # ← new
5: @app.after_request
6: def set_security_headers(response):
7:     response.headers['Content-Security-Policy'] = (
8:         "default-src 'self'; "
9:         "script-src 'self' https://unpkg.com https://cdn.jsdelivr.net; "
10:        "style-src 'self' 'unsafe-inline'; "
11:        "img-src 'self' data:; "
12:        "frame-ancestors 'none';"
13:    )
14:    response.headers['X-Frame-Options'] = 'DENY'
15:    response.headers['X-Content-Type-Options'] = 'nosniff'
16:    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
17:    response.headers['Permissions-Policy'] = 'geolocation=(), camera=(), microphone=()'
18:    return response
```
The application now automatically attaches a strict security policy to every HTTP response it serves.

### Mechanical walkthrough
- `@app.after_request` registers the function to run exactly once per request, right before the server sends the HTTP response back to the client.
- `def set_security_headers(response):` receives the generated Flask response object as its single argument.
- `response.headers['Content-Security-Policy']` assigns our CSP rule string. `default-src 'self'` restricts resources to the same origin. `script-src` explicitly whitelists our domain (`'self'`) and two CDNs (unpkg, jsdelivr) needed for HTMX and frontend libraries. `frame-ancestors 'none'` blocks any other site from putting our app inside an `<iframe>`.
- `response.headers['X-Frame-Options'] = 'DENY'` sets the older header equivalent to `frame-ancestors 'none'` to protect users on legacy browsers from clickjacking.
- `response.headers['X-Content-Type-Options'] = 'nosniff'` forces the browser to strictly follow the declared `Content-Type` and prevents MIME-type confusion attacks.
- `response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'` ensures that full URLs are never leaked to external domains via the `Referer` header, protecting sensitive path parameters.
- `response.headers['Permissions-Policy']` disables unused browser features (geolocation, camera, microphone) outright, reducing the attack surface.
- `return response` passes the modified response back to Flask for transmission.

### CS lens
Security headers demonstrate the principle of **Defense in Depth**. Even if your application logic has a flaw (such as accidentally echoing unescaped user input), the Content-Security-Policy acts as a secondary, independent failure boundary enforced by the client's browser, preventing the injected code from executing.

### SE lens
Defining security policies in a global middleware (`@app.after_request`) is an application of **Aspect-Oriented Programming** principles. Rather than tangling header-setting logic into every individual view function, the security requirement is factored out into a single cross-cutting concern that applies uniformly to the entire application.

### Commands needed
Run: `python app.py`

### Run it
Execute the server and inspect the response headers using a browser's network tab or `curl -I`. The security headers will be present on every request.

### One sentence connecting to previous unit
With external script sources locked down, we must now address how to safely permit our own legitimate inline scripts to run without opening the door to XSS payloads.

---

## Concept Unit: Content-Security-Policy and nonces for inline scripts

### The Problem
Sometimes you need to include a small inline `<script>` tag directly in your HTML. But a strict CSP blocks all inline scripts to prevent attackers from injecting malicious ones. How do we tell the browser that *our* inline script is legitimate, while continuing to block *injected* inline scripts?

### Introduce the concept in isolation
```python
import secrets
from flask import Flask, g

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

@app.before_request
def generate_nonce():
    g.csp_nonce = secrets.token_urlsafe(16)  # random per-request nonce

@app.after_request
def set_csp(response):
    nonce = getattr(g, 'csp_nonce', '')
    response.headers['Content-Security-Policy'] = (
        f"default-src 'self'; "
        f"script-src 'self' 'nonce-{nonce}' https://unpkg.com;"
    )
    return response

@app.route('/')
def index():
    from flask import g as flask_g
    nonce = getattr(flask_g, 'csp_nonce', 'no-nonce')
    return f'<script nonce="{nonce}">console.log("This runs")</script><script>console.log("This is blocked")</script>'

with app.test_client() as c:
    r = c.get('/')
    csp = r.headers.get('Content-Security-Policy','')
    print('Nonce in CSP:', 'nonce-' in csp)
    print('Nonce per-request (random):', csp[csp.find('nonce-'):csp.find('nonce-')+22] if 'nonce-' in csp else 'N/A')
    print('nonce: attacker cannot guess it -> injected scripts cannot use it -> XSS blocked')
```
**Output:**
```
Nonce in CSP: True
Nonce per-request (random): nonce-abc123def456ghi... (random string)
nonce: attacker cannot guess it -> injected scripts cannot use it -> XSS blocked
```
This proves that by generating a random string (a **nonce**) per request and including it in both the CSP header and the authorized `<script>` tag, the browser can differentiate between trusted inline code and unauthorized injected code.

### Discard the throwaway
This throwaway demonstration is discarded and will not be added to the project.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** Above the `set_security_headers` function in `app.py`.
- **Dependencies:** `secrets`, `g` from `flask`.

### The New Code
```python
@app.before_request
def generate_nonce():
    g.csp_nonce = secrets.token_urlsafe(16)
```

### The Updated Project
```python
1: from flask import Flask, g, request
2: import secrets
3: 
4: app = Flask(__name__)
5: app.config['SECRET_KEY'] = secrets.token_hex(32)
6: 
7: # ← new
8: @app.before_request
9: def generate_nonce():
10:    g.csp_nonce = secrets.token_urlsafe(16)
11: 
12: @app.after_request
13: def set_security_headers(response):
14:    nonce = getattr(g, 'csp_nonce', '')
15:    response.headers['Content-Security-Policy'] = (
16:        f"default-src 'self'; "
17:        f"script-src 'self' 'nonce-{nonce}' https://unpkg.com https://cdn.jsdelivr.net; "
18:        "style-src 'self' 'unsafe-inline'; "
19:        "img-src 'self' data:; "
20:        "frame-ancestors 'none';"
21:    )
22:    # ... other headers
```
The application now securely tags authorized inline scripts, rendering injected payload scripts useless.

### Mechanical walkthrough
- `@app.before_request` hooks the `generate_nonce` function to run immediately when a request arrives, before it reaches any route.
- `secrets.token_urlsafe(16)` generates 16 bytes of cryptographically secure random data and encodes it as a URL-safe string. This provides high entropy, making it impossible for an attacker to guess.
- `g.csp_nonce =` assigns the random string to Flask's global context object `g`, saving it for the duration of this single request.
- Down in `set_security_headers`, `getattr(g, 'csp_nonce', '')` retrieves the saved nonce.
- `f"script-src 'self' 'nonce-{nonce}'"` injects the exact nonce value into the CSP header.
- In your HTML templates, you can now write `<script nonce="{{ g.csp_nonce }}">`. The browser executes this script because its nonce matches the header. An injected `<script>` lacks the nonce and is rejected.

### CS lens
A nonce represents a **Capability**. By requiring the unpredictable nonce token to execute a script, execution rights are transformed from an ambient authority (any `<script>` tag works) to an explicitly granted capability (only `<script>` tags holding the correct, unpredictable token work).

### SE lens
Using `g` to pass the nonce from `before_request` to `after_request` is an example of **Context Propagation**. It allows different decoupled middleware layers to communicate out-of-band without needing to change the signature of every view function to accept and pass along the nonce manually.

### Commands needed
Run: `python app.py`

### Run it
When the app runs, any inline script missing the correct nonce will be visibly blocked by the browser, with an error logged in the developer console.

### One sentence connecting to previous unit
Now that the browser is instructed to defend the frontend against XSS, we must defend our backend endpoints against automated brute-force attacks.

---

## Concept Unit: Simple rate limiting with a dict

### The Problem
If a login endpoint processes any username and password it receives, an attacker can write a script to submit 10,000 compromised password combinations per minute (credential stuffing) until one works. How do we detect and reject automated, high-frequency requests from a single IP address?

### Introduce the concept in isolation
```python
import time, secrets
from flask import Flask, request

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Simple in-memory rate limiter (use Redis in production for multi-process)
LOGIN_ATTEMPTS = {}  # {ip: [timestamp, ...]}
MAX_ATTEMPTS = 5
WINDOW_SECONDS = 300  # 5-minute window

def is_rate_limited(ip):
    now = time.time()
    # Remove timestamps outside the window:
    attempts = [t for t in LOGIN_ATTEMPTS.get(ip, []) if now - t < WINDOW_SECONDS]
    LOGIN_ATTEMPTS[ip] = attempts
    if len(attempts) >= MAX_ATTEMPTS:
        return True
    return False

def record_attempt(ip):
    now = time.time()
    LOGIN_ATTEMPTS.setdefault(ip, []).append(now)

@app.route('/login', methods=['POST'])
def login():
    ip = request.remote_addr
    if is_rate_limited(ip):
        return 'Too many login attempts. Try again in 5 minutes.', 429
    
    record_attempt(ip)
    username = request.form.get('username','')
    return f'Login attempt recorded for {username}'

with app.test_client() as c:
    for i in range(7):
        r = c.post('/login', data={'username': 'alice', 'password': 'wrong'})
        print(f'Attempt {i+1}: status {r.status_code}')
```
**Output:**
```
Attempt 1: status 200
Attempt 2: status 200
Attempt 3: status 200
Attempt 4: status 200
Attempt 5: status 200
Attempt 6: status 429
Attempt 7: status 429
```
This proves that by tracking timestamps per IP address, we can allow a reasonable number of requests and then immediately block further attempts with a `429 Too Many Requests` status once the threshold is crossed.

### Discard the throwaway
This throwaway demonstration is discarded and will not be added to the project.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** Above the login route in `app.py`.
- **Dependencies:** `time`.

### The New Code
```python
LOGIN_ATTEMPTS = {}
MAX_ATTEMPTS = 5
WINDOW_SECONDS = 300

def is_rate_limited(ip):
    now = time.time()
    attempts = [t for t in LOGIN_ATTEMPTS.get(ip, []) if now - t < WINDOW_SECONDS]
    LOGIN_ATTEMPTS[ip] = attempts
    if len(attempts) >= MAX_ATTEMPTS:
        return True
    return False

def record_attempt(ip):
    now = time.time()
    LOGIN_ATTEMPTS.setdefault(ip, []).append(now)
```

### The Updated Project
```python
1: # ... previous imports and middleware ...
2: import time
3: 
4: # ← new
5: LOGIN_ATTEMPTS = {}
6: MAX_ATTEMPTS = 5
7: WINDOW_SECONDS = 300
8: 
9: def is_rate_limited(ip):
10:    now = time.time()
11:    attempts = [t for t in LOGIN_ATTEMPTS.get(ip, []) if now - t < WINDOW_SECONDS]
12:    LOGIN_ATTEMPTS[ip] = attempts
13:    if len(attempts) >= MAX_ATTEMPTS:
14:        return True
15:    return False
16: 
17: def record_attempt(ip):
18:    now = time.time()
19:    LOGIN_ATTEMPTS.setdefault(ip, []).append(now)
20: 
21: @app.route('/login', methods=['POST'])
22: def login():
23:    ip = request.remote_addr
24:    if is_rate_limited(ip):
25:        return 'Too many login attempts. Try again in 5 minutes.', 429
26:    record_attempt(ip)
27:    # ... authentication logic ...
```
The application now tracks and limits login velocity, protecting user accounts from brute-force password guessing.

### Mechanical walkthrough
- `LOGIN_ATTEMPTS = {}` creates an empty dictionary to map IP addresses to lists of timestamps.
- `def is_rate_limited(ip):` takes an IP address to evaluate.
- `now = time.time()` captures the current UNIX timestamp.
- `attempts = [t for t in LOGIN_ATTEMPTS.get(ip, []) if now - t < WINDOW_SECONDS]` uses a list comprehension to filter the list of past attempts, keeping only those that occurred within the last 300 seconds (5 minutes). This is a sliding window.
- `LOGIN_ATTEMPTS[ip] = attempts` updates the dictionary with the pruned list, effectively discarding old, expired timestamps.
- `if len(attempts) >= MAX_ATTEMPTS:` checks if the number of recent attempts has hit our limit (5). If so, it returns `True`, and the route handler immediately aborts with a `429` status code.
- `def record_attempt(ip):` is called only if the request is not limited.
- `LOGIN_ATTEMPTS.setdefault(ip, []).append(now)` fetches the list for the IP, creates an empty list if none exists, and appends the current timestamp to record the action.

### CS lens
This implements a **Sliding Window Log** algorithm for rate limiting. By explicitly keeping track of the timestamps of recent events, it provides highly accurate limits at the cost of memory overhead. (In production distributed systems, this is often offloaded to Redis using a Token Bucket algorithm instead).

### SE lens
Hardcoding security limits like `MAX_ATTEMPTS` inside the function reduces testability. In a mature application, these limits are pulled from configuration files or environment variables, allowing administrators to adjust them dynamically in response to active attacks without altering code.

### Commands needed
Run: `python app.py`

### Run it
Spam the login endpoint. After 5 requests, you will receive `429 Too Many Requests` responses until the 5-minute timer expires for your earliest attempt.

### One sentence connecting to previous unit
While rate limiting protects against high-volume attacks, we must also validate the contents of every single request to prevent malformed data from crashing the database.

---

## Concept Unit: Input length and type validation

### The Problem
If your database schema defines a text column, and you blindly insert whatever the user submits, an attacker can submit a 100MB payload. This forces the server to allocate massive amounts of memory, potentially crashing the application or overflowing database limits. How do we enforce sane bounds on user input before it touches our persistence layer?

### Introduce the concept in isolation
```python
from flask import Flask, request

app = Flask(__name__)

# Input validation: first line of defense against malformed input
def validate_note_input(title, body):
    errors = {}
    
    # Title:
    if not title:
        errors['title'] = 'Title is required.'
    elif len(title) > 200:
        errors['title'] = 'Title must be 200 characters or fewer.'
    elif len(title.strip()) == 0:
        errors['title'] = 'Title cannot be blank.'
        
    # Body:
    if len(body) > 10000:
        errors['body'] = 'Body must be 10,000 characters or fewer.'
        
    return errors

# Test:
print(validate_note_input('', 'some body'))                  
print(validate_note_input('   ', 'some body'))               
print(validate_note_input('Good title', 'x' * 10001))        
print(validate_note_input('Good title', 'Normal body'))      
```
**Output:**
```
{'title': 'Title is required.'}
{'title': 'Title cannot be blank.'}
{'body': 'Body must be 10,000 characters or fewer.'}
{}
```
This proves that a dedicated validation function can systematically flag missing data, whitespace-only data, and excessively large payloads, returning a structured dictionary of errors that the frontend can display.

### Discard the throwaway
This throwaway demonstration is discarded and will not be added to the project.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** Above the note creation route.
- **Dependencies:** None.

### The New Code
```python
def validate_note_input(title, body):
    errors = {}
    if not title:
        errors['title'] = 'Title is required.'
    elif len(title) > 200:
        errors['title'] = 'Title must be 200 characters or fewer.'
    elif len(title.strip()) == 0:
        errors['title'] = 'Title cannot be blank.'
        
    if len(body) > 10000:
        errors['body'] = 'Body must be 10,000 characters or fewer.'
    return errors
```

### The Updated Project
```python
1: # ... previous rate limiting code ...
2: 
3: # ← new
4: def validate_note_input(title, body):
5:     errors = {}
6:     if not title:
7:         errors['title'] = 'Title is required.'
8:     elif len(title) > 200:
9:         errors['title'] = 'Title must be 200 characters or fewer.'
10:    elif len(title.strip()) == 0:
11:        errors['title'] = 'Title cannot be blank.'
12:        
13:    if len(body) > 10000:
14:        errors['body'] = 'Body must be 10,000 characters or fewer.'
15:    return errors
16: 
17: @app.route('/notes', methods=['POST'])
18: def create_note():
19:     title = request.form.get('title', '')
20:     body = request.form.get('body', '')
21:     
22:     errors = validate_note_input(title, body)
23:     if errors:
24:         return render_template('note_form.html', errors=errors), 400
25:     # ... insert into database ...
```
The application now enforces strict semantic and length boundaries on user data before it is ever processed or stored.

### Mechanical walkthrough
- `def validate_note_input(title, body):` accepts the raw string inputs retrieved from the form.
- `errors = {}` initializes a dictionary. If it remains empty by the end of the function, the input is valid.
- `if not title:` checks for a completely missing or empty string.
- `elif len(title) > 200:` enforces a hard maximum length, preventing buffer overflow or UI layout issues.
- `elif len(title.strip()) == 0:` uses `strip()` to remove all leading and trailing whitespace. If the result is empty, the user submitted a title consisting entirely of spaces, which is semantically invalid even though it passes the length checks.
- `if len(body) > 10000:` establishes a generous but firm 10KB cap on the note content to prevent Denial of Service (DoS) attacks that attempt to bloat the database.
- `return errors` provides the dictionary back to the caller to drive error rendering.

### CS lens
Enforcing size limits is a primary defense against **Resource Exhaustion Attacks** (a type of DoS). While SQLite `TEXT` fields do not inherently limit length, unbounded allocations at the application layer allow attackers to trivially exhaust server RAM by submitting infinitely large strings.

### SE lens
Validating at the exact boundary where data enters the application (the controller or route handler) embodies the **Fail Fast** principle. By rejecting malformed data immediately, you guarantee that deeper layers (like business logic and database queries) can operate under the assumption that their inputs are structurally sound.

### Commands needed
Run: `python app.py`

### Run it
Attempt to submit a note with 250 characters in the title, or a title made entirely of spaces. The server will reject it with a 400 Bad Request status and return the mapped errors.

### One sentence connecting to previous unit
Now that our input is securely bounded and persisted, we must ensure that when we eventually display this user-generated content back to the screen, it cannot be weaponized.

---

## Concept Unit: XSS prevention with Jinja2 auto-escaping

### The Problem
If a user submits a note title containing `<script>alert("Hacked")</script>`, and we render that title directly into the HTML of our page, the browser will execute the script. How do we ensure that user data is always treated as passive text, never as active HTML markup?

### Introduce the concept in isolation
```python
from flask import Flask, request, render_template_string

app = Flask(__name__)

# Jinja2 auto-escapes HTML in {{ }} by default in .html templates
# This prevents XSS: user input is treated as text, not HTML
XSS_DEMO = '''
<!DOCTYPE html>
<html><body>
<!-- Auto-escaped (safe): -->
<p>User input: {{ user_input }}</p>

<!-- UN-safe: using |safe filter with user input -->
<!-- NEVER DO: {{ user_input | safe }} with untrusted data -->
<p>Raw (NEVER with user input): {{ safe_html | safe }}</p>
</body></html>
'''

@app.route('/xss-demo')
def xss_demo():
    user_input = request.args.get('q', '<script>alert("XSS")</script>')
    safe_html = '<strong>This is trusted markup</strong>'  # developer-controlled
    return render_template_string(XSS_DEMO, user_input=user_input, safe_html=safe_html)

with app.test_client() as c:
    r = c.get('/xss-demo?q=<script>alert(1)</script>')
    body = r.data.decode()
    print('Escaped in output:', '&lt;script&gt;' in body)  
    print('Not executed as JS:', '<script>alert(1)</script>' not in body)  
    print('Jinja2 {{ var }}: auto-escapes & < > " \' -> &amp; &lt; &gt; &quot; &#39;')
    print('{{ var | safe }}: disables escaping. ONLY for developer-controlled HTML.')
```
**Output:**
```
Escaped in output: True
Not executed as JS: True
Jinja2 {{ var }}: auto-escapes & < > " ' -> &amp; &lt; &gt; &quot; &#39;
{{ var | safe }}: disables escaping. ONLY for developer-controlled HTML.
```
This proves that by relying on Jinja2's default `{{ }}` syntax, dangerous characters are automatically converted into safe HTML entities, rendering scripts inert.

### Discard the throwaway
This throwaway demonstration is discarded and will not be added to the project.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** None (this demonstrates an existing behavior we rely on).
- **Change type:** Configure / Context.
- **Location:** Template files ending in `.html`.
- **Dependencies:** Jinja2 templates.

### The New Code
```html
<p>User input: {{ user_input }}</p>
```

### The Updated Project
```html
1: <!-- In any Jinja2 .html template in the project -->
2: <div class="note-card">
3:     <!-- ← safe by default -->
4:     <h2>{{ note.title }}</h2> 
5:     <p>{{ note.body }}</p>
6: </div>
```
The application's views inherently neutralize XSS payloads because Jinja2 is configured by default to escape variables rendered in `.html` files.

### Mechanical walkthrough
- `{{ user_input }}` is the standard Jinja2 syntax for outputting a variable. 
- When rendering `.html` files, Jinja2 intercepts this operation and inspects the string for special HTML characters.
- `<` is replaced with `&lt;`, `>` is replaced with `&gt;`, `&` with `&amp;`, and quotes with `&quot;` and `&#39;`.
- The browser receives `&lt;script&gt;alert(1)&lt;/script&gt;`. Because there are no literal angle brackets, the browser's HTML parser interprets this as literal text to display on the screen, completely skipping the JavaScript execution engine.
- `{{ safe_html | safe }}` explicitly disables this protection using the `| safe` filter. This must **never** be used on variables that contain user-generated content, as it instructs Jinja2 to bypass escaping entirely, opening a direct vector for XSS.

### CS lens
Auto-escaping is an implementation of **Context-Aware Encoding**. The templating engine understands that it is generating HTML, and therefore knows exactly which characters represent structural boundaries (`<`, `>`). By automatically encoding those specific characters in dynamic data, it preserves the integrity of the HTML structure regardless of the data's content.

### SE lens
Security should be **Secure by Default**. By making auto-escaping the default behavior for all variables, Jinja2 eliminates the need for developers to remember to manually call `escape()` on every single print statement. Security failures occur when developers have to actively opt-in to safety; secure systems require them to actively opt-out (via `| safe`).

### Commands needed
Run: `python app.py`

### Run it
Inject `<script>alert('xss')</script>` into a note title. When you view the note, you will see the raw text of the tag displayed on the screen, and no alert box will pop up.

### One sentence connecting to previous unit
By combining strict browser policies (CSP) with rigorous backend constraints (rate limiting and input validation) and secure-by-default templating (auto-escaping), we have established a robust, multi-layered defense.

---

## Closing

### Connect the pieces
Let's trace a malicious login attempt through our newly secured infrastructure. Imagine an attacker initiates a POST request to `/login` from IP `203.0.113.5`, representing their 6th attempt in the last 5 minutes.
First, the request hits `generate_nonce` via `@app.before_request`, creating a secure token. Next, it reaches the `login()` view. Here, `is_rate_limited('203.0.113.5')` checks the `LOGIN_ATTEMPTS` dictionary. Finding 5 timestamps within the `WINDOW_SECONDS` threshold, the function returns `True`. The view immediately aborts, returning a `429 Too Many Requests` status. As the response exits the server, `@app.after_request` intercepts it, attaching the `Content-Security-Policy` header (complete with the generated nonce) and the clickjacking defenses. The attacker's credential-stuffing tool is blocked cold at 5 attempts, and even if they somehow injected a payload, the CSP and auto-escaping ensure it could never execute in a victim's browser. Together, these layers ensure the application fails safely when under attack.
