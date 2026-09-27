# Lesson 31: Role-Based Access Control — Admin Routes, role_required, and Promoting Users

**What you will build:** You will add a new `role` column to the `users` table and implement a role-based access control (RBAC) system. You will create a reusable `@role_required` decorator to protect routes based on the user's role hierarchy (e.g., 'user', 'moderator', 'admin'). You will also build an admin panel that allows promoting users to higher roles, and you will implement an audit log to record every time an administrator changes a user's role. Transferable insight: Role-Based Access Control (RBAC) assigns permissions to roles, not to individual users. A user has a role ('user', 'moderator', 'admin'). Permissions are defined per route. Checking role in the DB (not the session) prevents role spoofing. Admin panels must be protected by both authentication AND a role check. Promoting a user to admin changes one column in the DB.

**What you need to know first:**
- Lesson 30 (Authentication and Session Management) - how to use `session` and `g.user` to track the logged-in user.

**Terms used in this lesson:**
- **Role-Based Access Control (RBAC)** — A security model where permissions are tied to predefined roles (e.g., 'admin', 'moderator', 'user') rather than individual users. Every route check simply asks "does this user's current role grant access to this action?"
- **Role Hierarchy** — A design where higher roles automatically inherit all permissions of lower roles. An 'admin' can do everything a 'moderator' can, which means a route only needs to check for the *minimum* required role.
- **Whitelist** — A security technique where only explicitly permitted values are accepted, and everything else is rejected. This prevents arbitrary string injection into the database.
- **Audit Logging** — The practice of recording sensitive actions (like promoting a user) into a permanent, immutable append-only table, recording who did it, to whom, when, and from where.
- **Decorator** — A Python syntax (using the `@` symbol) that wraps a function with another function, allowing you to run code before and after the wrapped function executes. Used here to check permissions before letting a route run.
- **Blueprint `before_request`** — A Flask hook that runs a function before *every* route within a specific blueprint, allowing you to apply protection (like an admin check) to an entire group of routes at once without decorating each one individually.

**Objects and methods used:**

- **`functools.wraps`**
  - *What it is:* A decorator from Python's standard library used when writing your own decorators.
  - *Implementation:* `@functools.wraps(f)`
  - *Its use:* It ensures the wrapped function retains its original name and docstring, which Flask requires to correctly register routes.
  - *Type:* Standard library decorator.
  - *Responsibility:* Preserves metadata of the original decorated function.
  - *Depends on:* The original function being decorated.
  - *Connects to:* Flask's route registration, which relies on function names (`__name__`) being unique.
  - *Shape:* An internal implementation detail of a custom decorator.

- **`abort`**
  - *What it is:* A Flask function that immediately stops the request and returns an HTTP error response.
  - *Implementation:* `abort(403)`
  - *Its use:* Used to halt a request and return a 403 Forbidden status when a user lacks the required role.
  - *Type:* Framework function.
  - *Responsibility:* Instantly terminates request processing and returns the specified HTTP status code to the client.
  - *Depends on:* An HTTP status code integer.
  - *Connects to:* The client browser, which receives the error page.
  - *Shape:* A control-flow boundary halting execution.

- **`request.form.get`**
  - *What it is:* A method to safely retrieve data submitted via an HTML form (POST request).
  - *Implementation:* `request.form.get('role', 'user')`
  - *Its use:* Used to get the requested new role from the admin's submission, providing a fallback default if missing.
  - *Type:* Framework dictionary-like method.
  - *Responsibility:* Safely extracts incoming form payload data.
  - *Depends on:* The incoming POST request body.
  - *Connects to:* Validation logic (the whitelist).
  - *Shape:* An input boundary between the HTTP request and application logic.

- **`request.remote_addr`**
  - *What it is:* A property of the Flask `request` object that holds the IP address of the client making the request.
  - *Implementation:* `ip = request.remote_addr`
  - *Its use:* Used to record the originating IP in the audit log when an admin performs an action.
  - *Type:* Framework property.
  - *Responsibility:* Provides the client's network address.
  - *Depends on:* The incoming HTTP connection.
  - *Connects to:* The audit logging database insert.
  - *Shape:* Contextual metadata for the current request.

---

## Concept Unit: Simple role column on the users table

### The Problem

We have a working authentication system where users can log in, but right now, every logged-in user is treated exactly the same. If we want an admin dashboard or a page to manage other users, we need a way to distinguish a standard user from an administrator. How do we securely track who is allowed to do what?

### Introduce the concept in isolation

```python
import sqlite3
con = sqlite3.connect(':memory:')
con.row_factory = sqlite3.Row
con.executescript('''
    CREATE TABLE users (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        role     TEXT NOT NULL DEFAULT 'user'  -- 'user', 'moderator', 'admin'
    );
    INSERT INTO users (username, role) VALUES
        ('alice', 'user'),
        ('bob',   'moderator'),
        ('carol', 'admin');
''')
# Check role:
def get_user_role(username):
    row = con.execute('SELECT role FROM users WHERE username=?', (username,)).fetchone()
    return row['role'] if row else None
print('alice role:', get_user_role('alice'))      # 'user'
print('bob role:',   get_user_role('bob'))        # 'moderator'
print('carol role:', get_user_role('carol'))      # 'admin'

# Promote user:
def promote_to_admin(user_id):
    con.execute('UPDATE users SET role=? WHERE id=?', ('admin', user_id))
    con.commit()
    print(f'User {user_id} promoted to admin')
promote_to_admin(1)  # alice is now admin
print('alice role after promote:', get_user_role('alice'))  # 'admin'
```

**Output:**
```text
alice role: user
bob role: moderator
carol role: admin
User 1 promoted to admin
alice role after promote: admin
```

The output proves that a simple string column `role` can effectively categorize users. Because this column has a `DEFAULT 'user'`, every new account automatically gets the safest, lowest permission level. Promoting a user is just a standard `UPDATE` statement changing that one string. Because the role is stored in the database — and read directly from it on each check — it cannot be modified by the user on the client side.

### Discard the throwaway

This isolated database script is just to demonstrate the schema change and will not be kept.

### Project Change

- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are adding RBAC to the schema.
- **Files affected:** `schema.sql` (modified)
- **Change type:** modify
- **Location:** Inside the `CREATE TABLE users` statement.
- **Dependencies:** The existing database initialization script.

### The New Code

```sql
role TEXT NOT NULL DEFAULT 'user'
```

### The Updated Project

```sql
  CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
1:    role TEXT NOT NULL DEFAULT 'user' // ← new
  );
```

We added a `role` column to the `users` table, ensuring it defaults to `'user'` so no one accidentally signs up as an admin.

### Mechanical walkthrough

1. **`role TEXT`**: We define a new column named `role` to store a text string.
2. **`NOT NULL`**: We enforce that every user *must* have a role; a missing role is a corrupted record.
3. **`DEFAULT 'user'`**: When an `INSERT` statement creates a user without explicitly providing a role, SQLite automatically fills this in with `'user'`.

### CS lens

RBAC (Role-Based Access Control) decouples identity from capability. Instead of saying "Alice is allowed to delete posts," you say "Moderators are allowed to delete posts," and then you assign Alice the "Moderator" role. This indirection makes it vastly easier to manage permissions as the system grows: you manage the capabilities of a role once, and you can easily move users between roles by flipping a single database field.

### SE lens

Relying on the database for the user's role is a deliberate security choice. While you *could* store the role in the encrypted session cookie, doing so introduces a caching problem: if you demote a malicious admin, they would remain an admin until their session cookie expired or they logged out. By looking up the role in the database on every request (which we already do to load `g.user`), any role change takes effect instantly on their very next click.

### Commands needed

Run: `python app.py`

### Run it

We haven't added UI for this yet, but new users will now be saved with a default role.

### One sentence connecting to previous unit

Now that the database tracks a user's role, we need a way to enforce that role on specific routes.

---

## Concept Unit: role_required decorator

### The Problem

We need to protect certain routes so that only users with a specific role can access them. We could write an `if` statement at the top of every single protected route, but that's repetitive and easy to forget. How can we cleanly enforce a role check across many routes?

### Introduce the concept in isolation

```python
import sqlite3, secrets, functools
from flask import Flask, session, g, redirect, url_for, abort

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, role TEXT DEFAULT 'user'); INSERT INTO users (username,role) VALUES ('alice','user'),('carol','admin');")
    return g.db

@app.before_request
def load_user():
    uid = session.get('user_id')
    g.user = get_db().execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone() if uid else None

ROLE_HIERARCHY = {'user': 0, 'moderator': 1, 'admin': 2}

def role_required(minimum_role):
    def decorator(f):
        @functools.wraps(f)
        def decorated(*args, **kwargs):
            if g.user is None:
                return redirect(url_for('login'))
            user_level = ROLE_HIERARCHY.get(g.user['role'], 0)
            required_level = ROLE_HIERARCHY.get(minimum_role, 99)
            if user_level < required_level:
                abort(403)
            return f(*args, **kwargs)
        return decorated
    return decorator

@app.route('/admin/dashboard')
@role_required('admin')
def admin_dashboard(): 
    return '<h1>Admin Dashboard</h1>'

@app.route('/moderate')
@role_required('moderator')
def moderate(): 
    return '<h1>Moderation Panel</h1>'

@app.route('/login')
def login(): return 'Login'

print('ROLE_HIERARCHY: admin(2) >= moderator(1) >= user(0)')
print('admin can access moderator routes (higher level satisfies lower requirement)')
```

**Output:**
```text
ROLE_HIERARCHY: admin(2) >= moderator(1) >= user(0)
admin can access moderator routes (higher level satisfies lower requirement)
```

The output proves that a hierarchical check allows an `admin` (level 2) to access a route that only requires a `moderator` (level 1). The `@role_required` decorator intercepts the request: if `g.user` is missing, it redirects to login; if the user's numeric role level is lower than the required level, it immediately calls `abort(403)` to halt the request. If the check passes, it allows the actual route function to run.

### Discard the throwaway

This standalone Flask app is a demonstration and will not be kept.

### Project Change

- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are building our own authorization layer.
- **Files affected:** `app.py` (modified)
- **Change type:** add
- **Location:** After the `load_logged_in_user` function.
- **Dependencies:** The existing `g.user` loading mechanism, `functools.wraps`, and `abort`.

### The New Code

```python
import functools
from flask import abort

ROLE_HIERARCHY = {'user': 0, 'moderator': 1, 'admin': 2}

def role_required(minimum_role):
    def decorator(f):
        @functools.wraps(f)
        def decorated(*args, **kwargs):
            if g.user is None:
                return redirect(url_for('login'))
            user_level = ROLE_HIERARCHY.get(g.user['role'], 0)
            required_level = ROLE_HIERARCHY.get(minimum_role, 99)
            if user_level < required_level:
                abort(403)
            return f(*args, **kwargs)
        return decorated
    return decorator
```

### The Updated Project

```python
  @app.before_request
  def load_logged_in_user():
      user_id = session.get('user_id')
      if user_id is None:
          g.user = None
      else:
          g.user = get_db().execute(
              'SELECT * FROM users WHERE id = ?', (user_id,)
          ).fetchone()

1:import functools // ← new
2:from flask import abort // ← new
3:
4:ROLE_HIERARCHY = {'user': 0, 'moderator': 1, 'admin': 2} // ← new
5:
6:def role_required(minimum_role): // ← new
7:    def decorator(f): // ← new
8:        @functools.wraps(f) // ← new
9:        def decorated(*args, **kwargs): // ← new
10:            if g.user is None: // ← new
11:                return redirect(url_for('login')) // ← new
12:            user_level = ROLE_HIERARCHY.get(g.user['role'], 0) // ← new
13:            required_level = ROLE_HIERARCHY.get(minimum_role, 99) // ← new
14:            if user_level < required_level: // ← new
15:                abort(403) // ← new
16:            return f(*args, **kwargs) // ← new
17:        return decorated // ← new
18:    return decorator // ← new
```

We added a reusable `@role_required` decorator that maps role strings to numeric levels, checks the current user's level, and blocks unauthorized access with a 403 Forbidden error.

### Mechanical walkthrough

1. **`ROLE_HIERARCHY = {'user': 0, ...}`**: We define a dictionary that maps role strings to integers, establishing a hierarchy where higher numbers mean more power.
2. **`def role_required(minimum_role):`**: The outer function takes the required role string (e.g., `'admin'`) as an argument.
3. **`def decorator(f):`**: This takes the actual route function `f` that we are protecting.
4. **`@functools.wraps(f)`**: This decorator preserves the original route function's name. Flask needs this to map URLs correctly.
5. **`def decorated(*args, **kwargs):`**: This is the wrapper function that will actually execute when a user visits the route.
6. **`if g.user is None:`**: If there is no logged-in user at all, they can't have a role, so we instantly return a `redirect` to the `login` page.
7. **`ROLE_HIERARCHY.get(g.user['role'], 0)`**: We fetch the user's numeric role level. The `get(..., 0)` means if their role is somehow missing or invalid in the DB, they get level 0 (the lowest).
8. **`ROLE_HIERARCHY.get(minimum_role, 99)`**: We fetch the required numeric level. If the developer types a bad role name like `@role_required('superadmin')`, the `get(..., 99)` ensures it defaults to unreachable, failing securely.
9. **`if user_level < required_level:`**: This is the actual hierarchical check. If they are a 'user' (0) trying to access an 'admin' (2) route, this is true.
10. **`abort(403)`**: We call Flask's `abort` to immediately stop execution and return a 403 Forbidden HTTP status, meaning "I know who you are, but you aren't allowed to do this."
11. **`return f(*args, **kwargs)`**: If all checks pass, we finally call the original route function `f` and return its result.

### CS lens

The decorator pattern wraps an existing function with new behavior without modifying the function itself. Here, it acts as a gatekeeper. By implementing a hierarchy (integers) rather than exact matches, we avoid needing to annotate a route with `@role_required(['moderator', 'admin', 'superadmin'])`. The hierarchy inherently understands that anyone above the threshold is authorized.

### SE lens

Failing closed is a critical security principle. Notice the fallback values: `get(g.user['role'], 0)` and `get(minimum_role, 99)`. If the database contains an unexpected role string, or if a developer typos the required role in the decorator, the system defaults to the safest possible outcome: the user gets the lowest power, and the route requires the highest power, ensuring access is denied rather than accidentally granted.

### Commands needed

Run: `python app.py`

### Run it

The decorator is defined but not yet used on any route.

### One sentence connecting to previous unit

With the gatekeeper in place, we can now build the actual admin routes and protect them.

---

## Concept Unit: Admin panel — user management routes

### The Problem

We need a way for administrators to actually change user roles in the database. If an admin submits a form saying "make user 5 a moderator", how do we ensure they don't submit "make user 5 a super-hacker" or inject bad data into the role column?

### Introduce the concept in isolation

```python
import sqlite3, secrets, functools
from flask import Flask, session, g, request, redirect, url_for, abort

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, role TEXT DEFAULT 'user'); INSERT INTO users (username,role) VALUES ('alice','user'),('bob','user'),('carol','admin');")
    return g.db

@app.before_request
def load_user():
    uid = session.get('user_id')
    g.user = get_db().execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone() if uid else None

def admin_required(f):
    @functools.wraps(f)
    def decorated(*args,**kwargs):
        if g.user is None: return redirect(url_for('login'))
        if g.user['role']!='admin': abort(403)
        return f(*args,**kwargs)
    return decorated

@app.route('/admin/users/<int:uid>/role', methods=['POST'])
@admin_required
def admin_set_role(uid):
    new_role = request.form.get('role','user')
    if new_role not in ('user','moderator','admin'): 
        abort(400)
    get_db().execute('UPDATE users SET role=? WHERE id=?', (new_role, uid))
    get_db().commit()
    return redirect(url_for('admin_users'))

print('Role whitelist: only accept valid role strings to prevent injection')
```

**Output:**
```text
Role whitelist: only accept valid role strings to prevent injection
```

The isolated route shows a whitelist in action: `if new_role not in ('user','moderator','admin')`. Even though the route is protected by `@admin_required`, we still don't blindly trust the string the admin submitted in the form. If they submit a fabricated role, we `abort(400)` (Bad Request). If it's valid, we run the `UPDATE` statement.

### Discard the throwaway

This minimal app isolating the route logic will not be kept.

### Project Change

- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified)
- **Change type:** add
- **Location:** At the bottom of `app.py`.
- **Dependencies:** The `@role_required` decorator and the database.

### The New Code

```python
from flask import request

@app.route('/admin/users/<int:uid>/role', methods=['POST'])
@role_required('admin')
def admin_set_role(uid):
    new_role = request.form.get('role', 'user')
    if new_role not in ('user', 'moderator', 'admin'):
        abort(400)
    
    db = get_db()
    db.execute('UPDATE users SET role = ? WHERE id = ?', (new_role, uid))
    db.commit()
    
    return redirect(url_for('index'))
```

### The Updated Project

```python
  # ... existing routes ...

1:from flask import request // ← new
2:
3:@app.route('/admin/users/<int:uid>/role', methods=['POST']) // ← new
4:@role_required('admin') // ← new
5:def admin_set_role(uid): // ← new
6:    new_role = request.form.get('role', 'user') // ← new
7:    if new_role not in ('user', 'moderator', 'admin'): // ← new
8:        abort(400) // ← new
9:    // ← new
10:    db = get_db() // ← new
11:    db.execute('UPDATE users SET role = ? WHERE id = ?', (new_role, uid)) // ← new
12:    db.commit() // ← new
13:    // ← new
14:    return redirect(url_for('index')) // ← new
```

We added a POST route that accepts a user ID and a role, validates the role against a strict whitelist, and updates the database, all protected by the `@role_required` decorator.

### Mechanical walkthrough

1. **`@app.route('/admin/users/<int:uid>/role', methods=['POST'])`**: The route captures the user ID from the URL as an integer `uid` and only accepts POST requests (since it changes state).
2. **`@role_required('admin')`**: We apply our custom decorator. If the user isn't an admin, this route function will never even be called.
3. **`request.form.get('role', 'user')`**: We extract the submitted role from the POST payload, defaulting to `'user'` if the field is completely missing.
4. **`if new_role not in ('user', 'moderator', 'admin'):`**: We check the submitted string against an explicit tuple of allowed strings (the whitelist).
5. **`abort(400)`**: If the string is invalid, we return a 400 Bad Request error.
6. **`db.execute('UPDATE ...', (new_role, uid))`**: We execute the safe parameterized query to update the specific user's role, and then commit the transaction.

### CS lens

A whitelist (allowlist) explicitly defines the set of all safe, permitted values and rejects everything else. This is the opposite of a blacklist (blocklist), which tries to define bad values and allows everything else. Whitelists are conceptually robust because the space of "invalid" inputs is infinite, while the space of "valid" inputs is finite and known.

### SE lens

Trusting the user is always dangerous, even when the user is an admin. An admin's browser is still a client that can be manipulated to send custom HTTP POST requests. If we didn't validate the `new_role` string before putting it in the database, a compromised admin account or a buggy form could write garbage data into the `role` column, potentially breaking the application.

### Commands needed

Run: `python app.py`

### Run it

We have an endpoint that can promote users securely.

### One sentence connecting to previous unit

While decorating individual routes works, protecting an entire section of an application piece-by-piece is fragile.

---

## Concept Unit: Protecting admin routes at the blueprint level

### The Problem

If we build a large admin panel with dozens of routes (`/admin/users`, `/admin/settings`, `/admin/reports`), we have to remember to put `@role_required('admin')` on every single one. If we forget it on just one route, we have a security hole. How can we protect an entire section of the application by default?

### Introduce the concept in isolation

```python
import secrets, functools
from flask import Flask, Blueprint, session, g, redirect, url_for, abort, request

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)

# Admin blueprint: all routes under /admin/
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

@admin_bp.before_request
def require_admin():
    # This runs BEFORE every route in the admin blueprint:
    user_role = session.get('role', 'user')  # simplified for isolation
    if not session.get('user_id'):
        return redirect('/login')
    if user_role != 'admin':
        abort(403)  # authenticated but not admin

# All routes in this blueprint are auto-protected:
@admin_bp.route('/dashboard')
def dashboard():
    return '<h1>Admin Dashboard</h1>'

@admin_bp.route('/settings')
def settings():
    return '<h1>Admin Settings</h1>'

app.register_blueprint(admin_bp)

@app.route('/login')
def login(): return 'Login page'

print('Blueprint.before_request: protects ALL routes in the blueprint at once')
print('No need for decorators on each route individually')
```

**Output:**
```text
Blueprint.before_request: protects ALL routes in the blueprint at once
No need for decorators on each route individually
```

The isolated code demonstrates a `Blueprint` with a `before_request` hook. This hook runs before *any* route registered to that blueprint (`/admin/dashboard`, `/admin/settings`). Because the check is centralized at the blueprint level, it is impossible to accidentally expose an admin route by forgetting a decorator: adding a new route to the blueprint automatically subjects it to the same strict checks.

### Discard the throwaway

This blueprint example is just for demonstration and will not be kept.

### Project Change

- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py` (modified)
- **Change type:** refactor
- **Location:** Top of the file (imports), middle of the file (blueprint definition), and bottom (registration).
- **Dependencies:** The existing RBAC logic and the `Blueprint` class from Flask.

### The New Code

```python
from flask import Blueprint

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

@admin_bp.before_request
def require_admin():
    if g.user is None:
        return redirect(url_for('login'))
    user_level = ROLE_HIERARCHY.get(g.user['role'], 0)
    if user_level < ROLE_HIERARCHY['admin']:
        abort(403)
```

### The Updated Project

```python
  from flask import Flask, render_template, request, redirect, url_for, session, g, flash, abort
1:from flask import Blueprint // ← new
  import sqlite3
  import functools

  app = Flask(__name__)
  app.config['SECRET_KEY'] = 'dev'

  # ... database and user loading ...

2:admin_bp = Blueprint('admin', __name__, url_prefix='/admin') // ← new
3:
4:@admin_bp.before_request // ← new
5:def require_admin(): // ← new
6:    if g.user is None: // ← new
7:        return redirect(url_for('login')) // ← new
8:    user_level = ROLE_HIERARCHY.get(g.user['role'], 0) // ← new
9:    if user_level < ROLE_HIERARCHY['admin']: // ← new
10:        abort(403) // ← new

  # Change the existing admin_set_role to use the blueprint:
11:@admin_bp.route('/users/<int:uid>/role', methods=['POST']) // ← new
  # (Removed @role_required decorator)
  def admin_set_role(uid):
      new_role = request.form.get('role', 'user')
      if new_role not in ('user', 'moderator', 'admin'):
          abort(400)
      
      db = get_db()
      db.execute('UPDATE users SET role = ? WHERE id = ?', (new_role, uid))
      db.commit()
      
      return redirect(url_for('index'))

  # Register the blueprint at the very bottom
12:app.register_blueprint(admin_bp) // ← new
```

We refactored our admin route to live inside an `admin_bp` Blueprint, and we used `@admin_bp.before_request` to apply the role check globally to that blueprint, removing the need for the individual `@role_required` decorator on that specific route.

### Mechanical walkthrough

1. **`admin_bp = Blueprint('admin', __name__, url_prefix='/admin')`**: We create a blueprint named `'admin'`. Every route inside it will automatically be prefixed with `/admin`.
2. **`@admin_bp.before_request`**: We register a function to run before any request routed to this specific blueprint.
3. **`def require_admin():`**: We reimplement the core logic of our `@role_required` decorator inside this hook.
4. **`if user_level < ROLE_HIERARCHY['admin']:`**: We check if the user meets the admin threshold. If they don't, we `abort(403)`.
5. **`@admin_bp.route('/users/<int:uid>/role')`**: We change the route decorator from `@app.route` to `@admin_bp.route`. The path is now just `/users/...` because the blueprint provides the `/admin` prefix. We also delete the `@role_required` decorator.
6. **`app.register_blueprint(admin_bp)`**: We tell the main Flask app about the blueprint so it can map the routes.

### CS lens

A Blueprint in Flask represents a modular, grouped set of routes and related logic. By organizing routes into a blueprint, you can apply cross-cutting concerns (like security checks, logging, or custom error pages) to the entire group at once, adhering to the principle of separation of concerns and reducing code duplication.

### SE lens

Default-deny is a core tenet of secure system design. By moving the security check from a per-route decorator to a blueprint-wide hook, the system changes from "you must remember to secure each new route" to "new routes are secured by default." This eliminates a massive category of human error (forgetting the decorator).

### Commands needed

Run: `python app.py`

### Run it

The role update endpoint still functions, but is now protected by the blueprint's global hook.

### One sentence connecting to previous unit

Now that admin actions are securely protected, we need to track what the admins are actually doing.

---

## Concept Unit: Audit logging for admin actions

### The Problem

When a user's role is changed, the database is updated, but there is no record of who made the change, when it happened, or what it was changed from. If a rogue admin starts demoting people, or if an honest mistake occurs, we have no trail to investigate. How do we keep a secure history of sensitive actions?

### Introduce the concept in isolation

```python
import sqlite3, secrets
from flask import Flask, session, g, request
from datetime import datetime

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript('''
            CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS audit_log (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id  INTEGER NOT NULL,
                action    TEXT NOT NULL,
                target_id INTEGER,
                detail    TEXT,
                ip        TEXT,
                created   TEXT DEFAULT (datetime("now"))
            );
            INSERT INTO users (username) VALUES ("carol");
        ''')
    return g.db

def audit(action, target_id=None, detail=None):
    admin_id = session.get('user_id', 0)
    ip = request.remote_addr
    get_db().execute(
        'INSERT INTO audit_log (admin_id, action, target_id, detail, ip) VALUES (?,?,?,?,?)',
        (admin_id, action, target_id, detail, ip)
    )
    get_db().commit()

with app.test_request_context('/', headers={'X-Forwarded-For':'1.2.3.4'}):
    with app.session_transaction() as s:
        s['user_id'] = 1
    with app.app_context():
        audit('promote_user', target_id=2, detail='role: user -> admin')
        rows = get_db().execute('SELECT * FROM audit_log').fetchall()
        print('Audit log:', [dict(r) for r in rows])
```

**Output:**
```text
Audit log: [{'id': 1, 'admin_id': 1, 'action': 'promote_user', 'target_id': 2, 'detail': 'role: user -> admin', 'ip': None, 'created': '2024-10-27 10:00:00'}]
```

The isolated code shows an `audit` function that inserts a record into an `audit_log` table. It automatically captures the acting admin's ID (from the session) and their IP address (from the request). The explicit arguments track *what* they did (`action`), *who* they did it to (`target_id`), and *why/how* (`detail`). This table is append-only; you insert records to build the trail, but you never `UPDATE` or `DELETE` them.

### Discard the throwaway

This standalone logging script will not be kept.

### Project Change

- **Reference Source:** No reference counterpart.
- **Files affected:** `schema.sql` (modified), `app.py` (modified)
- **Change type:** add
- **Location:** `schema.sql` (end of file), `app.py` (inside `admin_set_role`).
- **Dependencies:** The database and Flask's `request` object.

### The New Code

```sql
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    target_id INTEGER,
    detail TEXT,
    ip TEXT,
    created TEXT DEFAULT CURRENT_TIMESTAMP
);
```

```python
def audit_action(action, target_id, detail):
    db = get_db()
    ip = request.remote_addr
    admin_id = g.user['id']
    db.execute(
        'INSERT INTO audit_log (admin_id, action, target_id, detail, ip) VALUES (?, ?, ?, ?, ?)',
        (admin_id, action, target_id, detail, ip)
    )
    db.commit()
```

### The Updated Project

`schema.sql`:
```sql
  -- ... existing users table ...

1:CREATE TABLE audit_log ( // ← new
2:    id INTEGER PRIMARY KEY AUTOINCREMENT, // ← new
3:    admin_id INTEGER NOT NULL, // ← new
4:    action TEXT NOT NULL, // ← new
5:    target_id INTEGER, // ← new
6:    detail TEXT, // ← new
7:    ip TEXT, // ← new
8:    created TEXT DEFAULT CURRENT_TIMESTAMP // ← new
9:); // ← new
```

`app.py`:
```python
1:def audit_action(action, target_id, detail): // ← new
2:    db = get_db() // ← new
3:    ip = request.remote_addr // ← new
4:    admin_id = g.user['id'] // ← new
5:    db.execute( // ← new
6:        'INSERT INTO audit_log (admin_id, action, target_id, detail, ip) VALUES (?, ?, ?, ?, ?)', // ← new
7:        (admin_id, action, target_id, detail, ip) // ← new
8:    ) // ← new
9:    db.commit() // ← new

  @admin_bp.route('/users/<int:uid>/role', methods=['POST'])
  def admin_set_role(uid):
      new_role = request.form.get('role', 'user')
      if new_role not in ('user', 'moderator', 'admin'):
          abort(400)
      
      db = get_db()
      db.execute('UPDATE users SET role = ? WHERE id = ?', (new_role, uid))
10:   audit_action('set_role', uid, f"Set to {new_role}") // ← new
      db.commit()
      
      return redirect(url_for('index'))
```

We created an `audit_log` table and a helper function `audit_action`. We then integrated this helper directly into our `admin_set_role` route so that every successful role change leaves a permanent record.

### Mechanical walkthrough

1. **`CREATE TABLE audit_log`**: Defines the append-only table structure to hold the historical trail.
2. **`def audit_action(action, target_id, detail):`**: A helper function to standardize how we insert log entries.
3. **`ip = request.remote_addr`**: Captures the IP address of the client making the request, which is crucial for investigating unauthorized actions.
4. **`admin_id = g.user['id']`**: We confidently pull the ID of the logged-in user because the blueprint's `before_request` hook guarantees this route is only reachable by an authenticated admin.
5. **`db.execute('INSERT INTO audit_log ...')`**: We insert the action details into the table.
6. **`audit_action('set_role', uid, f"Set to {new_role}")`**: Inside the route, immediately after executing the `UPDATE` statement, we call the helper to log exactly what happened before we commit the transaction.

### CS lens

An audit log is a specialized form of an event log. It fundamentally shifts the database from tracking only the *current state* (the `users` table) to also tracking the *history of state transitions* (the `audit_log` table). This append-only design provides a robust timeline that can be used for compliance, debugging, and security forensics.

### SE lens

In a production system, audit logging is not optional for admin actions. If an account is compromised, the first question is "what did they change?" Without an audit log, the answer is unknowable. By building a dedicated helper function, we make it effortless for developers to add auditing to future admin endpoints, ensuring the trail remains complete as the application grows.

### Commands needed

Run: `python app.py`

### Run it

Now, when a user's role is updated, a permanent record is quietly stored in the database.

### One sentence connecting to previous unit

With roles, blueprints, and audit logs, our backend authorization layer is robust.

---

## Closing

In this lesson, we established a complete Role-Based Access Control system. We added a `role` column to securely categorize users, built a hierarchical `@role_required` decorator to enforce those categories, and utilized a Flask Blueprint to automatically protect an entire group of administrative routes without repeating ourselves. Finally, we added an immutable audit log to ensure every sensitive administrative action leaves a permanent trail. 

Trace the flow of a role promotion: an admin submits a POST request to `/admin/users/1/role` with `role='moderator'`. Before the route even runs, the blueprint's `require_admin()` hook intercepts the request, verifies the user is an admin via `g.user`, and allows it to proceed. The route validates the string `'moderator'` against a strict whitelist. The `UPDATE` statement runs on the `users` table, and `audit_action` records the event in the `audit_log` before both are committed to the database. On Alice's (user 1's) very next request, `g.user` will load her new `'moderator'` role, instantly granting her access to moderator routes.

### Connect the pieces

You now have a secure backend capable of enforcing permissions. In the next lesson, we will build out the frontend views for this administrative panel using HTMX, allowing admins to manage users dynamically without page reloads.
