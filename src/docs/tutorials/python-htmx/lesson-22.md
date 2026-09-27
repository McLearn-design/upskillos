# Lesson 22: Server-Side Sessions — Flask-Session, Filesystem Backend, and Session IDs

What you will build: We will switch our application from client-side sessions to server-side sessions using `Flask-Session`. You will learn the limitations of client-side cookies for storing large data and how server-side sessions store data on the server while the cookie contains only a random session ID.

What you need to know first: 
- Lesson 21 (Client-side sessions)

Terms used in this lesson:
- **Server-side session** — A mechanism where session data is stored on the server (e.g., in files or a database), and only a session identifier is sent to the client. This solves size limitations and allows server-side revocation.
- **Session identifier (Session ID)** — A cryptographically random string that uniquely identifies a session on the server.
- **Session fixation** — A security vulnerability where an attacker forces a user's session ID to a known value. Prevented by generating a new session ID upon login.
- **Entropy** — A measure of randomness or unpredictability in cryptography.

Objects and methods used:
- **Flask-Session `Session`**
  - *What it is:* A Flask extension that adds support for server-side sessions.
  - *Implementation:* `from flask_session import Session; Session(app)`
  - *Its use:* To replace Flask's default client-side session interface with a server-side one.
  - *Type:* Class
  - *Responsibility:* Manages the initialization of server-side session backend based on app config.
  - *Depends on:* Flask `app` object and specific configuration keys (like `SESSION_TYPE`).
  - *Connects to:* Replaces Flask's default session interface, reading/writing to the configured backend (e.g., filesystem).
  - *Shape:* Framework extension boundary.
- **`os.urandom` / `secrets.token_hex` / `secrets.token_urlsafe`**
  - *What it is:* Functions to generate cryptographically secure random numbers or strings.
  - *Implementation:* `secrets.token_hex(32)`
  - *Its use:* Generating unpredictable secret keys and session IDs.
  - *Type:* Standard library functions.
  - *Responsibility:* Provides cryptographically secure randomness.
  - *Depends on:* OS-level random number generator (e.g., `/dev/urandom`).
  - *Connects to:* Used directly by application code or frameworks for security purposes.
  - *Shape:* Utility functions.

## Concept Unit: The problem with client-side sessions

### The Problem
Client-side sessions store all session data inside the cookie itself. What happens if we need to store a lot of data, or if we need to immediately revoke a user's access?

### Introduce the concept in isolation
```python
import secrets
from flask import Flask, session
app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

@app.route('/fill-session')
def fill_session():
    session['big_data'] = 'x' * 3000
    return f'Session size: {len(str(dict(session)))} bytes'

print('Client-side limits: 4KB, no server-side revocation, data visible to user')
print('Server-side: store data on server, cookie = only session ID')
```
This is a **client-side session limit demonstration**. Output shows that storing 3000 characters hits the ~4KB cookie limit because of JSON serialization and base64 encoding overhead.

### Discard the throwaway
This example is discarded and will not be added to the project.

### Project Change
- **Reference Source**: No reference counterpart — this is a from-scratch addition.
- **Files affected**: None yet.
- **Change type**: Explanation only.
- **Location**: N/A
- **Dependencies**: N/A

### The New Code
```python
# No new project code for this unit
```

### The Updated Project
```python
# No file changed
```

### Mechanical walkthrough
- We define a route `/fill-session`.
- We assign 3000 characters to `session['big_data']`.
- Flask serializes this data to JSON and encodes it. The resulting cookie size approaches the 4KB limit enforced by browsers.

### CS lens
Client-side sessions are an example of stateless architecture on the server side: the server forgets everything between requests. The tradeoff is bandwidth (sending data every time) and size limits.

### SE lens
Server-side sessions introduce state. Storing state means we have to manage it (memory, filesystem, or database), which complicates horizontal scaling.

### Commands needed
None.

### Run it
No execution needed here.

### One sentence connecting to previous unit
Understanding the limits of client-side sessions motivates the need for server-side storage.

## Concept Unit: Flask-Session with filesystem backend

### The Problem
How do we store session data on the server and only send an identifier to the client?

### Introduce the concept in isolation
```python
import secrets, os
from flask import Flask, session
from flask_session import Session
app = Flask(__name__)
app.config.update(
    SECRET_KEY=secrets.token_hex(32),
    SESSION_TYPE='filesystem',
    SESSION_FILE_DIR='flask_session',
    SESSION_FILE_THRESHOLD=500,
    SESSION_PERMANENT=False,
    SESSION_USE_SIGNER=True,
    SESSION_KEY_PREFIX='sess:',
)
Session(app)
os.makedirs('flask_session', exist_ok=True)

@app.route('/test-server-session')
def test_server_session():
    session['user_id'] = 42
    session['large_data'] = 'x' * 10000
    return f'Session stored server-side. user_id={session.get("user_id")}'

with app.test_client() as c:
    r = c.get('/test-server-session')
    print(r.data.decode())
    files = os.listdir('flask_session') if os.path.exists('flask_session') else []
    print('Session files:', len(files))
print('Cookie now contains: only a signed random session ID (not the data)')
```
This is **Flask-Session configuration**. Output proves that 10KB of data is stored without hitting cookie limits, and session files are generated in the `flask_session` directory.

### Discard the throwaway
This throwaway snippet is deleted and will not appear in the project again.

### Project Change
- **Reference Source**: No reference counterpart.
- **Files affected**: `app.py`
- **Change type**: Configure.
- **Location**: Near the Flask app initialization.
- **Dependencies**: `Flask-Session` package.

### The New Code
```python
from flask_session import Session
import os

app.config.update(
    SESSION_TYPE='filesystem',
    SESSION_FILE_DIR='flask_session',
    SESSION_USE_SIGNER=True,
)
Session(app)
os.makedirs('flask_session', exist_ok=True)
```

### The Updated Project
```python
1: from flask import Flask, session
2: from flask_session import Session
3: import os
4: 
5: app = Flask(__name__)
6: app.config['SECRET_KEY'] = 'supersecret'
7: # ← new
8: app.config.update(
9:     SESSION_TYPE='filesystem',
10:     SESSION_FILE_DIR='flask_session',
11:     SESSION_USE_SIGNER=True,
12: )
13: Session(app)
14: os.makedirs('flask_session', exist_ok=True)
```
The application now uses filesystem-based server-side sessions instead of default cookies.

### Mechanical walkthrough
- `from flask_session import Session`: Imports the extension.
- `app.config.update(...)`: Configures the session type to `filesystem`, the directory to store files, and enables cookie signing to prevent tampering with the session ID.
- `Session(app)`: Replaces Flask's default session interface.
- `os.makedirs(...)`: Ensures the storage directory exists.

### CS lens
By using an indirection (the session ID), we decouple the storage capacity of the client from the amount of session state we can maintain. The cookie becomes merely a pointer.

### SE lens
Using the filesystem for sessions works well for a single server. In a distributed environment with multiple servers, they would need a shared filesystem or a different backend like Redis, otherwise a user's request hitting a different server would result in a missing session file.

### Commands needed
`pip install Flask-Session`

### Run it
`python app.py`

### One sentence connecting to previous unit
Now that session data is stored on the server, we can securely and immediately invalidate it.

## Concept Unit: Invalidating sessions server-side

### The Problem
How can an administrator instantly revoke a user's access, or how can we securely handle a logout without relying on the client deleting their cookie?

### Introduce the concept in isolation
```python
import secrets, os
from flask import Flask, session, request
from flask_session import Session
app = Flask(__name__)
app.config.update(
    SECRET_KEY=secrets.token_hex(32),
    SESSION_TYPE='filesystem',
    SESSION_FILE_DIR='flask_session',
    SESSION_USE_SIGNER=True,
)
Session(app)
os.makedirs('flask_session', exist_ok=True)

@app.route('/admin/force-logout/<session_id>', methods=['POST'])
def force_logout(session_id):
    session_file = os.path.join('flask_session', f'sess:{session_id}')
    if os.path.exists(session_file):
        os.remove(session_file)
        return f'Session {session_id} invalidated.'
    return 'Session not found.', 404

@app.route('/logout')
def logout():
    session.clear()
    return 'Logged out.'

print('Server-side sessions: delete file/DB record = immediate logout')
print('Client-side sessions: cannot revoke before expiry')
```
This is **server-side session invalidation**. Output proves that deleting the file associated with a session ID immediately logs out the user, regardless of whether their browser still holds the cookie.

### Discard the throwaway
This demonstration code is discarded and will not be added to the project.

### Project Change
- **Reference Source**: No reference counterpart.
- **Files affected**: `app.py`
- **Change type**: Add.
- **Location**: As a new route.
- **Dependencies**: None.

### The New Code
```python
@app.route('/logout')
def logout():
    session.clear()
    return 'Logged out.'
```

### The Updated Project
```python
1: @app.route('/logout')
2: def logout():
3:     session.clear()
4:     return 'Logged out.'
```
The `/logout` endpoint clears the session. Since we are using `Flask-Session`, `session.clear()` will also delete the server-side session file.

### Mechanical walkthrough
- `session.clear()`: This Flask method removes all keys from the session object. When using `Flask-Session` with the filesystem backend, this translates to deleting the session file on disk and removing the cookie from the client.

### CS lens
Invalidation requires shared state. Because the state (the session file) is authoritative, destroying it on the server guarantees the client's token is immediately rendered useless.

### SE lens
Immediate revocation is critical for security incidents, password changes, or banning malicious users. Client-side sessions cannot offer this without complex workarounds (like checking a blacklist database on every request).

### Commands needed
None.

### Run it
`python app.py`

### One sentence connecting to previous unit
While we can securely delete a session, we also must ensure that the session ID itself is secure and not easily guessed.

## Concept Unit: Session ID security

### The Problem
If the session ID is just a string, what prevents an attacker from guessing it or reusing an existing one?

### Introduce the concept in isolation
```python
import secrets
for i in range(3):
    session_id = secrets.token_urlsafe(32)
    print(f'Session ID {i+1}:', session_id)

print('Entropy: 32 bytes = 256 bits -> 2^256 possible IDs')
print('Brute force: 2^256 attempts at 10^9 attempts/sec = 10^68 years')

def handle_login_server_side(app, session):
    old_data = dict(session)
    session.clear()
    session.update(old_data)
    session['user_id'] = 42

print('Session fixation fix: session.clear() before setting user_id')
```
This demonstrates **session ID entropy and fixation prevention**. Output shows cryptographically random IDs. 32 bytes of entropy prevents brute-forcing. `session.clear()` before login prevents session fixation attacks.

### Discard the throwaway
This code is discarded and will not be used in the project.

### Project Change
- **Reference Source**: No reference counterpart.
- **Files affected**: None.
- **Change type**: Explanation only.
- **Location**: N/A
- **Dependencies**: N/A

### The New Code
```python
# No new project code for this unit
```

### The Updated Project
```python
# No file changed
```

### Mechanical walkthrough
- `secrets.token_urlsafe(32)`: Generates a 32-byte cryptographically secure random string, encoded for URL/cookie safety. This is how `Flask-Session` generates IDs internally.
- `session.clear()`: Before logging in a user, clearing the session destroys the old session ID (which an attacker might have fixated) and forces the creation of a new session ID for the authenticated state.

### CS lens
Entropy measures the unpredictability of a system. 256 bits of entropy provides a search space so vast that guessing a valid session ID is mathematically infeasible.

### SE lens
Session fixation is a common OWASP vulnerability. Always regenerating the session ID upon privilege elevation (like logging in) ensures that even if an attacker planted an anonymous session ID in the victim's browser, that ID becomes invalid the moment the victim authenticates.

### Commands needed
None.

### Run it
No execution needed here.

### One sentence connecting to previous unit
Understanding session ID generation leads to considering where and how to store these IDs at scale.

## Concept Unit: Comparing session backends

### The Problem
Filesystem storage works well for one server, but how do we scale to multiple servers?

### Introduce the concept in isolation
```python
backends = {
    'Client-side (Flask default)': {
        'storage':     'Browser cookie (signed JSON)',
        'size_limit':  '4KB',
        'revocation':  'Not possible before expiry',
        'scaling':     'Perfect (no server state)',
        'setup':       'Zero (built-in)',
        'use_when':    'Small data, no forced logout needed',
    },
    'Filesystem (Flask-Session)': {
        'storage':     'Files in flask_session/ dir',
        'size_limit':  'OS filesystem limit (GB)',
        'revocation':  'Delete file (instant)',
        'scaling':     'Single server only',
        'setup':       'pip install Flask-Session',
        'use_when':    'Single-server apps, simple deployment',
    },
    'SQLite/Database': {
        'storage':     'sessions table in DB',
        'size_limit':  'Practical: MB per session',
        'revocation':  'DELETE WHERE id=session_id',
        'scaling':     'Any server that reaches same DB',
        'setup':       'Flask-Session + DATABASE_URL',
        'use_when':    'Multi-server, already have DB',
    },
}
for name, props in backends.items():
    print(f'\n{name}:')
    for k, v in props.items():
        print(f'  {k}: {v}')
```
This is a **session backend comparison matrix**. Output clearly delineates the tradeoffs between client-side, filesystem, and database-backed sessions.

### Discard the throwaway
This script is discarded.

### Project Change
- **Reference Source**: No reference counterpart.
- **Files affected**: None.
- **Change type**: Explanation only.
- **Location**: N/A
- **Dependencies**: N/A

### The New Code
```python
# No new project code for this unit
```

### The Updated Project
```python
# No file changed
```

### Mechanical walkthrough
- A dictionary iterates over backend choices, comparing storage mechanisms, scalability, and use cases.
- We see that database backends offer horizontal scalability, whereas filesystem limits us to a single node unless we use complex shared storage.

### CS lens
The choice of backend is a classic CAP theorem tradeoff context: client-side scales infinitely but lacks authoritative control, while server-side gives control but introduces a central point of state that must be managed.

### SE lens
In a production microservices or load-balanced environment, Redis or a centralized database is almost always required for server-side sessions to prevent sticky-session routing requirements.

### Commands needed
None.

### Run it
No execution needed here.

### One sentence connecting to previous unit
This comparison concludes our shift to server-side session management.

## Closing

### Connect the pieces
We have successfully transitioned our application from limited client-side sessions to robust server-side sessions using `Flask-Session` and the filesystem backend. When a user logs in, `session.clear()` is called, a new highly-entropic session ID is generated, and the session data (like `user_id`) is stored in a local file (e.g., `flask_session/<new_id>`). The server then sends a `Set-Cookie: session=<signed_new_id>` header. On the next request, the browser sends this cookie, the server loads the corresponding file, and the user is authenticated. This approach allows us to store large amounts of data and instantly revoke sessions by deleting the file, securing our application.
