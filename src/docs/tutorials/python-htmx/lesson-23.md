# Lesson 23: CSRF Attacks and Protection — Tokens, SameSite Cookies, and Double Submit

What you will build:
In this lesson, you will implement defenses against Cross-Site Request Forgery (CSRF). A CSRF attack tricks a logged-in user's browser into making an unwanted request to your site. Because the browser automatically sends cookies, the request looks authenticated. You will fix this by requiring a secret token in every state-changing request, utilizing the SameSite=Lax cookie attribute, and exploring the double-submit cookie pattern.

What you need to know first:
- Lesson 22

Terms used in this lesson:
- **CSRF (Cross-Site Request Forgery)** — An attack that forces an end user to execute unwanted actions on a web application in which they're currently authenticated.
- **Same-origin policy** — A web browser security mechanism that restricts how a document or script loaded by one origin can interact with a resource from another origin, preventing evil.com from reading bank.com's responses.
- **Idempotent** — An operation that produces the same result no matter how many times it is executed. GET requests should be idempotent (read-only), while POST/PUT/DELETE modify state.
- **Synchronizer token pattern** — A defense mechanism where a state-changing request must include a secure random token that the server validates against the user's session.

Objects and methods used:
- **`secrets.token_hex`**
  - *What it is:* A function generating a secure random string.
  - *Implementation:* `secrets.token_hex([nbytes=None]) -> str`
  - *Its use:* To create an unguessable CSRF token.
  - *Type:* Standard library function.
  - *Responsibility:* Returns cryptographically strong random hexadecimal strings.
  - *Depends on:* OS-level random sources.
  - *Connects to:* Called by our `generate_csrf_token()` function.
  - *Shape:* Internal implementation detail.

- **`hmac.compare_digest`**
  - *What it is:* A string comparison function that mitigates timing attacks.
  - *Implementation:* `hmac.compare_digest(a, b) -> bool`
  - *Its use:* To safely compare the user-submitted CSRF token with the session token.
  - *Type:* Standard library function.
  - *Responsibility:* Compares two strings in constant time.
  - *Depends on:* Two input strings to compare.
  - *Connects to:* Used in our validation functions to securely check matches.
  - *Shape:* Internal implementation detail.

- **`app.config.update`**
  - *What it is:* A method to update multiple Flask configuration values at once.
  - *Implementation:* `update([E, ]**F) -> None`
  - *Its use:* To set multiple cookie-related security flags simultaneously.
  - *Type:* Instance method on Flask configuration object.
  - *Responsibility:* Modifies the application's configuration mapping.
  - *Depends on:* Keyword arguments representing configuration keys.
  - *Connects to:* Configures the underlying Flask application behavior.
  - *Shape:* Setup and configuration layer.

- **`htmx:configRequest`**
  - *What it is:* An HTMX event fired before an AJAX request is issued.
  - *Implementation:* Custom DOM event triggered by HTMX on the `document.body`.
  - *Its use:* To intercept outgoing HTMX requests and inject the CSRF token header.
  - *Type:* DOM Event.
  - *Responsibility:* Allows modification of request parameters (like headers) before the network call.
  - *Depends on:* HTMX library and an active event listener.
  - *Connects to:* Intercepts HTMX's fetch logic to append `X-CSRF-Token`.
  - *Shape:* Client-side network boundary.

---

## Concept Unit: How CSRF works

### The Problem
How can a malicious website force a user to perform an action on a completely different, trusted website without the user's consent? What happens if a banking site allows money transfers via simple GET or POST requests and relies solely on cookies for authentication?

### Introduce the concept in isolation
```python
# CSRF attack scenario:
# 1. User logs into bank.com -> session cookie stored
# 2. User visits evil.com while still logged in
# 3. evil.com's page contains:
#    <img src="https://bank.com/transfer?to=attacker&amount=1000">
#    OR:
#    <form action="https://bank.com/transfer" method="POST">
#      <input type="hidden" name="to" value="attacker">
#      <input type="hidden" name="amount" value="1000">
#    </form>
#    <script>document.forms[0].submit()</script>
# 4. Browser sends GET/POST to bank.com WITH the session cookie (automatic!)
# 5. bank.com sees valid session -> executes transfer
# Why it works: browser sends cookies automatically for any request to the domain
# Even if the request originates from a different site
print('CSRF: browser sends cookies automatically -> server sees valid session')
print('evil.com cannot READ the response (same-origin policy)')
print('But it can TRIGGER state-changing requests (write operations)')
print('CSRF affects: POST, PUT, DELETE (state changes)')
print('CSRF does NOT affect: GET if GET is read-only (idempotent)')
```

### Discard the throwaway
This attack scenario is for demonstration purposes only and will be discarded. It will not appear in the project again.

### Project Change
No reference counterpart — this is a conceptual foundation because we are illustrating an attack vector before defending against it.
- **Files affected:** None.
- **Change type:** None.
- **Location:** None.
- **Dependencies:** None.

### The New Code
```python
# (Conceptual illustration only; no project code added)
```

### The Updated Project
```python
# (Conceptual illustration only; no project code added)
```

### Mechanical walkthrough
- The browser automatically attaches cookies scoped to `bank.com` on any outgoing request to that domain, even if initiated by an `<img>` tag on `evil.com`.
- The server at `bank.com` receives the request, sees a valid authentication cookie, and processes it.
- The same-origin policy prevents `evil.com` from reading the response of the request, meaning CSRF is purely a "write" exploit.
- Therefore, GET requests must never modify state, and state-changing requests (POST, PUT, DELETE) require additional protection beyond cookies.

### CS lens
CSRF exploits the ambient authority provided by cookies. The browser acts as a confused deputy, automatically appending the user's credentials to a request crafted by a malicious third party.

### SE lens
Relying solely on ambient credentials (like cookies) for state-changing operations violates the principle of explicit intent. A system must verify that the user explicitly intended to perform the action, not just that their browser sent a request.

### Commands needed
Run: python app.py

### Run it
The output demonstrates the theory: the browser sends cookies automatically, the server sees a valid session, but the attacker cannot read the response due to the same-origin policy.

### One sentence connecting to previous unit
Understanding how CSRF exploits automatic cookie inclusion reveals the need for a secondary authentication mechanism that the attacker cannot forge.

---

## Concept Unit: CSRF token — the synchronizer token pattern

### The Problem
If cookies are automatically sent, how can the server distinguish between a legitimate request originating from its own front-end and a forged request originating from `evil.com`? What piece of data can the legitimate site include that the attacker cannot guess or read?

### Introduce the concept in isolation
```python
import secrets, hmac, hashlib
from flask import Flask, session, request, render_template_string

app = Flask(__name__)
app.config['SECRET_KEY'] = 'dev-secret'

def generate_csrf_token():
    if '_csrf_token' not in session:
        session['_csrf_token'] = secrets.token_hex(32)
    return session['_csrf_token']

def validate_csrf():
    token = request.form.get('csrf_token', '')
    session_token = session.get('_csrf_token', '')
    if not session_token or not hmac.compare_digest(token, session_token):
        return False
    return True

@app.route('/transfer', methods=['GET', 'POST'])
def transfer():
    if request.method == 'GET':
        csrf = generate_csrf_token()
        return render_template_string('''
            <form method="POST">
                <input type="hidden" name="csrf_token" value="{{ csrf }}">
                <input name="amount"> <button>Transfer</button>
            </form>''', csrf=csrf)
    
    if not validate_csrf():
        return 'Invalid CSRF token.', 403
        
    amount = request.form.get('amount', '0')
    return f'Transfer of ${amount} authorized.'

print('CSRF token: secret value in form, verified server-side')
print('evil.com cannot read your session -> cannot forge the token')
```

### Discard the throwaway
This isolated Flask application demonstrating synchronizer tokens is discarded and will not be used in the main project code.

### Project Change
No reference counterpart — this is a from-scratch addition because we are implementing a basic CSRF protection mechanism.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** At the top of the file, above route definitions.
- **Dependencies:** Flask, secrets, hmac.

### The New Code
```python
def generate_csrf_token():
    if '_csrf_token' not in session:
        session['_csrf_token'] = secrets.token_hex(32)
    return session['_csrf_token']
```

### The Updated Project
```python
# app.py
from flask import Flask, session, request
import secrets

app = Flask(__name__)
app.config['SECRET_KEY'] = 'dev-secret'

# ← new
def generate_csrf_token():
    if '_csrf_token' not in session:
        session['_csrf_token'] = secrets.token_hex(32)
    return session['_csrf_token']
```
The `generate_csrf_token` function creates a secure 32-byte hexadecimal string and stores it in the user's session if one doesn't already exist.

### Mechanical walkthrough
- `secrets.token_hex(32)` generates 64 characters of cryptographically secure random hexadecimal.
- `session['_csrf_token']` stores this token server-side (or in a signed cookie), associating it securely with the user.
- During a GET request, this token is injected into a hidden HTML form field (`<input type="hidden" name="csrf_token">`).
- When the form is POSTed, `validate_csrf()` extracts the token from `request.form` and compares it to the session token using `hmac.compare_digest`.
- If an attacker on `evil.com` tries to forge a POST, they cannot read the user's session (due to the same-origin policy) and therefore cannot include the correct token in their forged form.

### CS lens
The synchronizer token pattern ties a piece of stateless data (the HTML form) to stateful server memory (the session). It breaks the ambient authority problem by requiring proof of origin.

### SE lens
Using `hmac.compare_digest` instead of `==` is crucial for security. Standard string comparison fails early if a character mismatches, allowing an attacker to deduce the token character-by-character by measuring response times (a timing attack). Constant-time comparison prevents this.

### Commands needed
Run: python app.py

### Run it
The printed output states that the secret value in the form is verified server-side, and evil.com cannot forge the token since it cannot read the session.

### One sentence connecting to previous unit
Now that we have a secure token embedded in HTML forms, we need to adapt this strategy to modern asynchronous requests made via HTMX.

---

## Concept Unit: CSRF with HTMX — hx-headers

### The Problem
Traditional forms submit the CSRF token as a form field. But what if your application uses HTMX for various `hx-post`, `hx-put`, or `hx-delete` requests across many elements? Adding a hidden input to every single HTMX element is tedious and error-prone. How can we configure HTMX to automatically send the token with every state-changing request?

### Introduce the concept in isolation
```html
<!-- HTMX: send CSRF token in a custom header on every request -->
<!-- Add to base template <head>: -->
<meta name="csrf-token" content="{{ csrf_token() }}">
<script>
    document.addEventListener('DOMContentLoaded', function() {
        // Configure HTMX to send CSRF token header on every request:
        document.body.addEventListener('htmx:configRequest', function(evt) {
            var token = document.querySelector('meta[name=csrf-token]').getAttribute('content');
            evt.detail.headers['X-CSRF-Token'] = token;
        });
    });
</script>
```
```python
from flask import Flask, session, request
import secrets, hmac

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

def get_csrf_token():
    if '_csrf' not in session:
        session['_csrf'] = secrets.token_hex(32)
    return session['_csrf']

def check_csrf():
    # HTMX sends token in X-CSRF-Token header:
    token = request.headers.get('X-CSRF-Token', '')
    expected = session.get('_csrf', '')
    return bool(expected) and hmac.compare_digest(token, expected)

@app.route('/api/note', methods=['POST'])
def create_note():
    if not check_csrf():
        return '<p class="error">CSRF check failed.</p>', 403
    title = request.form.get('title', '')
    return f'<li>{title}</li>'

app.jinja_env.globals['csrf_token'] = get_csrf_token

print('HTMX: X-CSRF-Token header sent on every hx-post/hx-delete/hx-put')
print('Server: check request.headers["X-CSRF-Token"] against session token')
```

### Discard the throwaway
This snippet demonstrating HTMX header injection is discarded and will not appear in the project again.

### Project Change
No reference counterpart — this is a from-scratch addition because we are configuring global HTMX behavior.
- **Files affected:** `templates/base.html`
- **Change type:** Add
- **Location:** Inside the `<head>` tag.
- **Dependencies:** HTMX library.

### The New Code
```html
<meta name="csrf-token" content="{{ csrf_token() }}">
<script>
    document.addEventListener('DOMContentLoaded', function() {
        document.body.addEventListener('htmx:configRequest', function(evt) {
            var token = document.querySelector('meta[name=csrf-token]').getAttribute('content');
            evt.detail.headers['X-CSRF-Token'] = token;
        });
    });
</script>
```

### The Updated Project
```html
<!-- templates/base.html -->
<head>
    <title>My App</title>
    <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    <!-- ← new -->
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            document.body.addEventListener('htmx:configRequest', function(evt) {
                var token = document.querySelector('meta[name=csrf-token]').getAttribute('content');
                evt.detail.headers['X-CSRF-Token'] = token;
            });
        });
    </script>
</head>
```
The base template now renders a `<meta>` tag containing the CSRF token and sets up an event listener to append it as a custom header (`X-CSRF-Token`) on all outgoing HTMX requests.

### Mechanical walkthrough
- The server renders the page and injects the session's CSRF token into the `<meta name="csrf-token">` tag.
- When HTMX prepares to make an AJAX request, it fires the `htmx:configRequest` event on `document.body`.
- Our event listener catches this event, reads the token from the `<meta>` tag, and adds it to `evt.detail.headers['X-CSRF-Token']`.
- HTMX sends the request (POST, PUT, DELETE) including both the session cookie (automatically) and the custom `X-CSRF-Token` header.
- The server validates the request by comparing `request.headers.get('X-CSRF-Token')` against the session token.
- An attacker on `evil.com` cannot read the `<meta>` tag (same-origin policy) and cannot set custom headers on cross-origin requests without a permissive CORS configuration, rendering the attack impossible.

### CS lens
This approach relies on the same-origin policy twice: once to prevent reading the DOM (`<meta>` tag), and once via the CORS preflight mechanism, which inherently blocks custom headers on cross-origin AJAX requests unless explicitly allowed.

### SE lens
Centralizing token management via a global event listener adheres to the DRY (Don't Repeat Yourself) principle. Developers can use `hx-post` freely without manually remembering to include CSRF tokens in every single component.

### Commands needed
Run: python app.py

### Run it
The print statement confirms that the `X-CSRF-Token` header is sent on every HTMX mutation and the server verifies it against the session.

### One sentence connecting to previous unit
While custom headers protect AJAX requests effectively, modern browsers provide a built-in cookie attribute to stop CSRF at the source.

---

## Concept Unit: SameSite cookies as CSRF mitigation

### The Problem
CSRF relies entirely on the browser automatically sending cookies to a domain, even when the request originates from a different site. What if we could tell the browser to stop doing that for cross-site requests?

### Introduce the concept in isolation
```python
from flask import Flask
import secrets

app = Flask(__name__)
app.config.update(
    SECRET_KEY=secrets.token_hex(32),
    SESSION_COOKIE_SAMESITE='Lax',   # or 'Strict'
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=False,  # True in production (HTTPS)
)
# SameSite=Lax: session cookie sent on:
# - Same-site requests: YES (forms, AJAX on same domain)
# - Cross-site top-level GET navigation: YES (clicking links from evil.com to bank.com)
# - Cross-site POST (form from evil.com): NO <- blocks CSRF
# - Cross-site GET in <img>, <iframe>: NO <- blocks simple GET CSRF
# SameSite=Strict: even stricter:
# - Cross-site top-level GET: NO (breaks OAuth callbacks, email links)
# SameSite=Lax is the recommended default (Chrome default since 2020)

@app.route('/')
def index():
    return '<p>SameSite=Lax demo. Check response headers.</p>'

with app.test_client() as c:
    r = c.get('/')
    print('Set-Cookie header present in response:', 'Set-Cookie' in r.headers)

print('SameSite=Lax: blocks cross-site POST -> CSRF POST attack blocked')
print('SameSite=Lax does NOT block all CSRF: complex scenarios may need tokens too')
print('Best practice: SameSite=Lax + CSRF tokens for state-changing requests')
```

### Discard the throwaway
This script demonstrating the SameSite cookie configuration is discarded and will not appear in the project again.

### Project Change
No reference counterpart — this is a from-scratch addition because we are enhancing global cookie security.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** Application configuration block.
- **Dependencies:** Flask configuration.

### The New Code
```python
app.config.update(
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_HTTPONLY=True,
)
```

### The Updated Project
```python
# app.py
from flask import Flask
import secrets

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)
# ← new
app.config.update(
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_HTTPONLY=True,
)
```
The application now explicitly configures the session cookie to use `SameSite=Lax` and `HttpOnly=True`, providing robust baseline protection against CSRF and XSS attacks.

### Mechanical walkthrough
- `SESSION_COOKIE_SAMESITE='Lax'` instructs Flask to append `SameSite=Lax` to the `Set-Cookie` header.
- When the browser sees `SameSite=Lax`, it will only send the cookie if the request originates from the same site, or if it is a top-level navigation (like clicking a link) using a safe HTTP method (GET).
- If a user submits a POST form from `evil.com` to `bank.com`, the browser strips the cookie. `bank.com` receives an unauthenticated request and rejects it.
- `SESSION_COOKIE_HTTPONLY=True` prevents JavaScript (`document.cookie`) from reading the session cookie, mitigating Cross-Site Scripting (XSS) token theft.

### CS lens
SameSite is a defense-in-depth mechanism at the transport layer, shifting the burden of CSRF prevention from the application logic (tokens) to the browser's cookie management engine.

### SE lens
While `SameSite=Lax` blocks the majority of CSRF vectors, best practice dictates using both SameSite and CSRF tokens (defense-in-depth). Complex scenarios, legacy browsers, or misconfigured CORS can still bypass SameSite alone.

### Commands needed
Run: python app.py

### Run it
The test client verifies that the `Set-Cookie` header is properly generated. Output confirms that SameSite blocks cross-site POSTs but requires tokens for comprehensive security.

### One sentence connecting to previous unit
When maintaining server-side session state for CSRF tokens is undesirable, an alternative stateless approach called double-submit cookies can be used.

---

## Concept Unit: Double-submit cookie pattern

### The Problem
The synchronizer token pattern requires the server to store a token in the session (`session['_csrf_token']`). In stateless architectures or heavily cached environments, maintaining server-side session state is problematic. How can we validate a token without storing it on the server?

### Introduce the concept in isolation
```python
import secrets, hmac
from flask import Flask, request, make_response

app = Flask(__name__)
app.config['SECRET_KEY'] = 'dev-secret'

# Double-submit: same token in cookie AND form/header
# Server only needs to check they match (no server state needed)
def set_csrf_cookie(resp):
    token = secrets.token_hex(32)
    resp.set_cookie('csrf_token', token, samesite='Strict', httponly=False)  # JS-readable!
    return token  # also put this in the form

@app.route('/form')
def form():
    resp = make_response('<html>placeholder</html>')
    token = set_csrf_cookie(resp)
    # Render form with token in hidden field:
    html = f'''
        <form method="POST" action="/submit">
            <input type="hidden" name="csrf" value="{token}">
            <input name="data"><button>Submit</button>
        </form>'''
    resp.data = html
    return resp

@app.route('/submit', methods=['POST'])
def submit():
    form_token   = request.form.get('csrf', '')
    cookie_token = request.cookies.get('csrf_token', '')
    
    if not hmac.compare_digest(form_token, cookie_token):
        return 'CSRF check failed.', 403
    return f'OK: {request.form.get("data")}'

print('Double-submit: token in cookie + form field. Server checks they match.')
print('httponly=False: JS can read this cookie (intentional for JS frameworks)')
```

### Discard the throwaway
This script implementing double-submit cookies is discarded and will not be used in the main project.

### Project Change
No reference counterpart — this is an alternative pattern illustration.
- **Files affected:** None.
- **Change type:** None.
- **Location:** None.
- **Dependencies:** None.

### The New Code
```python
# (Conceptual illustration only; no project code added)
```

### The Updated Project
```python
# (Conceptual illustration only; no project code added)
```

### Mechanical walkthrough
- The server generates a random token and sends it to the client in two ways: embedded in the HTML form, and as a separate cookie (`csrf_token`).
- Crucially, this cookie has `httponly=False` if JavaScript needs to read it (common in SPAs), but `SameSite=Strict` prevents it from being sent cross-origin.
- When the form is submitted, the browser sends the form data (containing the token) and the cookies (containing the same token).
- The server extracts `form_token` and `cookie_token` and uses `hmac.compare_digest` to ensure they are identical.
- An attacker on `evil.com` cannot read the `csrf_token` cookie, so they cannot copy its value into the forged form submission. The server sees a mismatch and rejects the request.

### CS lens
This is a stateless validation mechanism. By relying on the browser's same-origin policy (which prevents the attacker from reading the cookie) to guarantee the integrity of one copy of the token, the server only needs to verify equality, completely eliminating the need for server-side storage.

### SE lens
Double-submit is popular in stateless APIs and Single Page Applications (SPAs). However, it is vulnerable if an attacker can compromise a subdomain and set cookies for the parent domain (cookie tossing).

### Commands needed
Run: python app.py

### Run it
The output confirms that the server checks for equality between the cookie and the form field, requiring no server-side state.

### One sentence connecting to previous unit
Understanding token-based defenses, automated header injection, and cookie attributes completes a comprehensive security posture against CSRF.

---

## Closing

### Connect the pieces
Let's trace an HTMX POST request from a legitimate page through our newly secured architecture. 
1. The legitimate page loads, and the server renders the `<meta name='csrf-token' content='{{ csrf_token() }}'>` tag, populated with a token from the server-side session.
2. The `htmx:configRequest` event listener fires just before HTMX sends the request, reading the token from the `<meta>` tag and appending it to the `X-CSRF-Token` header.
3. The browser dispatches the POST request to the server, automatically including the session cookie (permitted by `SameSite=Lax` for same-origin requests) alongside the custom header.
4. The server receives the request. The `check_csrf()` function extracts `request.headers.get('X-CSRF-Token')` and compares it to `session.get('_csrf_token')` using `hmac.compare_digest`.
5. Since both match, the request is authorized.
6. Conversely, in a CSRF attack from `evil.com`, the attacker has no access to the `<meta>` tag. They cannot set the `X-CSRF-Token` header. The server sees an empty or missing token, `compare_digest` fails, and the request is rejected with a 403 Forbidden, protecting the application entirely.
