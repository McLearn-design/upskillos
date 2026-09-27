# Lesson 35: Capstone — CRUD Notes with HTMX (Create, Inline Edit, Delete)

**What you will build**
You will build a full CRUD (Create, Read, Update, Delete) interface for notes using HTMX. You will learn how to submit forms, swap HTML fragments into the DOM, edit items inline without leaving the page, and delete items with confirmation, all without full page reloads.

**What you need to know first**
- Lesson 34 (Flask setup and basic HTMX integration)

**Terms used in this lesson**
- **CRUD** — Create, Read, Update, Delete. The four basic operations for persistent storage.
- **HTML Fragment** — A partial piece of HTML, rather than a full HTML document. HTMX expects servers to return fragments to swap into the existing DOM.
- **Inline Editing** — The pattern of replacing a display element with an editable form in the exact same location, rather than navigating to a separate page.
- **hx-post** — HTMX attribute that issues an HTTP POST request to the specified URL when the element is triggered (e.g., a form submission).
- **hx-get** — HTMX attribute that issues an HTTP GET request to the specified URL.
- **hx-delete** — HTMX attribute that issues an HTTP DELETE request to the specified URL.
- **hx-target** — HTMX attribute specifying which DOM element should be updated with the response.
- **hx-swap** — HTMX attribute specifying how the response should be inserted into the target (e.g., `afterbegin`, `outerHTML`).
- **hx-on::after-request** — HTMX attribute that runs inline JavaScript after a request completes successfully.
- **hx-confirm** — HTMX attribute that pauses the request and shows a native browser confirmation dialog.
- **hx-swap-oob** — HTMX attribute (Out of Band) that tells HTMX to swap the element into the DOM wherever its ID matches, regardless of the primary target.

**Objects and methods used**

- **`Flask`**
  - *What it is:* The core web application object in Flask.
  - *Implementation:* `class Flask(import_name: str)`
  - *Its use:* Used to define routes and handle requests.
  - *Type:* Class
  - *Responsibility:* Routes incoming HTTP requests to the correct handler functions and manages application context.
  - *Depends on:* An import name (usually `__name__`).
  - *Connects to:* Receives requests from the WSGI server, passes them to route decorators.
  - *Shape:* The central registry and entry point for the application.

- **`request`**
  - *What it is:* A global proxy object in Flask representing the current HTTP request.
  - *Implementation:* `LocalProxy` to `Request` object.
  - *Its use:* Accessing form data submitted via POST.
  - *Type:* Object
  - *Responsibility:* Provides access to request method, form data, args, and headers.
  - *Depends on:* An active request context.
  - *Connects to:* Read by route handlers to extract user input.
  - *Shape:* A global context local providing input data to controllers.

- **`render_template_string`**
  - *What it is:* A Flask function that renders a template from a string.
  - *Implementation:* `def render_template_string(source: str, **context) -> str`
  - *Its use:* Used to generate HTML fragments dynamically from string literals for HTMX responses.
  - *Type:* Function
  - *Responsibility:* Evaluates Jinja2 template syntax within a provided string using given context variables.
  - *Depends on:* A string containing Jinja2 syntax and optional context kwargs.
  - *Connects to:* Called by route handlers, returns a rendered string to the client.
  - *Shape:* A utility function bridging data and presentation logic.

- **`abort`**
  - *What it is:* A Werkzeug function to raise HTTP errors.
  - *Implementation:* `def abort(status: int, *args, **kwargs)`
  - *Its use:* Used to return a 404 error when a requested note is not found.
  - *Type:* Function
  - *Responsibility:* Immediately stops request processing and returns an HTTP error response.
  - *Depends on:* An HTTP status code.
  - *Connects to:* Called by route handlers when an error condition is met.
  - *Shape:* Control-flow interruption utility.

---

## Concept Unit: Note list and create form

### The Problem
We need a way for users to create new notes without refreshing the entire page. How do we take a standard HTML form submission, send it to the server, and insert the new note directly into the existing list on the screen?

### Introduce the concept in isolation
```python
from flask import Flask
app = Flask(__name__)

@app.route('/test')
def test():
    return '''
    <form hx-post="/submit" hx-target="#results" hx-swap="afterbegin" hx-on::after-request="this.reset()">
        <input name="item" required>
        <button type="submit">Add</button>
    </form>
    <ul id="results"></ul>
    '''

@app.route('/submit', methods=['POST'])
def submit():
    return '<li>New Item</li>'

with app.test_request_context():
    print("When submitted, the form sends a POST to /submit.")
    print("The server returns <li>New Item</li>.")
    print("HTMX inserts this at the top (afterbegin) of #results and resets the form.")
```

### Discard the throwaway
This test code demonstrates the mechanics of HTMX form submission and swapping, but it will be discarded. We will now implement this in our actual notes application.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition because we are building the capstone UI.
- **Files affected:** `templates/notes/list.html`, `app.py`
- **Change type:** Add
- **Location:** New template file and new route in the main app file.
- **Dependencies:** Flask and HTMX.

### The New Code
```html
<!-- templates/notes/list.html (extends base.html) -->
<!-- {% block content %} -->
<h1>My Notes</h1>
<form hx-post="/notes"
      hx-target="#notes-list"
      hx-swap="afterbegin"
      hx-on::after-request="this.reset()">
    <input type="text" name="title" placeholder="Note title" required>
    <textarea name="body" placeholder="Note body..."></textarea>
    <button type="submit">Add Note</button>
</form>
<ul id="notes-list">
    {% for note in notes %}
        {% include 'notes/_note.html' %}
    {% endfor %}
</ul>
<!-- {% endblock %} -->
```
```python
import sqlite3, secrets
from flask import Flask, session, g, request, render_template_string

app = Flask(__name__)
app.config.update(SECRET_KEY=secrets.token_hex(32), DATABASE=':memory:')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.executescript('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT DEFAULT "", created TEXT DEFAULT (datetime("now")), updated TEXT DEFAULT (datetime("now")))')
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db=g.pop('db',None)
    if db: db.close()

@app.route('/notes')
def notes_list():
    user_id = session.get('user_id')
    if not user_id: return 'Unauthorized', 401
    notes = get_db().execute('SELECT * FROM notes WHERE user_id=? ORDER BY created DESC', (user_id,)).fetchall()
    return str([dict(n) for n in notes])
```

### The Updated Project
```html
1: <h1>My Notes</h1>
2: <form hx-post="/notes" <!-- ← new -->
3:       hx-target="#notes-list" <!-- ← new -->
4:       hx-swap="afterbegin" <!-- ← new -->
5:       hx-on::after-request="this.reset()"> <!-- ← new -->
6:     <input type="text" name="title" placeholder="Note title" required>
7:     <textarea name="body" placeholder="Note body..."></textarea>
8:     <button type="submit">Add Note</button>
9: </form>
10: <ul id="notes-list">
11:     {% for note in notes %}
12:         {% include 'notes/_note.html' %}
13:     {% endfor %}
14: </ul>
```
This is the main view. We now have a form configured to submit asynchronously via HTMX, targeting the `notes-list` element.

### Mechanical walkthrough
- `hx-post="/notes"` instructs HTMX to hijack the form submission and send an AJAX POST request to `/notes`.
- `hx-target="#notes-list"` tells HTMX to place the response inside the `<ul>` element with the ID `notes-list`.
- `hx-swap="afterbegin"` specifies exactly *where* to place the new HTML. `afterbegin` inserts it just inside the target, before its first child (at the very top of the list).
- `hx-on::after-request="this.reset()"` uses HTMX's event system to execute a tiny piece of JavaScript. When the request finishes, `this.reset()` clears the form inputs.
- `get_db().execute('SELECT ...')` fetches existing notes to populate the list on initial load.

### CS lens
The `afterbegin` swap strategy aligns perfectly with the `ORDER BY created DESC` SQL clause. By prepending the new element directly into the DOM, we maintain the newest-first sorting client-side without having to re-fetch and re-render the entire sorted list from the database. This is a classic local state update mirroring a remote state constraint.

### SE lens
Using `hx-on::after-request` for the form reset is an example of graceful degradation and keeping logic local. Instead of the server sending back an explicit command to clear the form, the form itself owns its lifecycle: "when my submission succeeds, I clear myself." This decouples the server's concern (saving the note) from the UI's concern (resetting the input fields).

### Commands needed
Run: `python app.py`

### Run it
Execute the code. Trace: GET `/notes` runs `SELECT WHERE user_id=session['user_id'] ORDER BY created DESC`. It returns all notes newest-first. The list template iterates over them. The create form has `hx-post='/notes'`, `target='#notes-list'`, `swap='afterbegin'`.

### One sentence connecting to previous unit
Now that we have a form capable of sending a request via HTMX and receiving a fragment, we need a server route to handle that POST request and return the HTML fragment for the new note.

---

## Concept Unit: Create note route — returns HTML fragment

### The Problem
When the form from the previous unit submits a POST request, the server needs to save the note to the database and return exactly the HTML needed to represent that single new note. If we return JSON, HTMX won't know how to render it.

### Introduce the concept in isolation
```python
from flask import Flask, request

app = Flask(__name__)

@app.route('/create', methods=['POST'])
def create():
    title = request.form.get('title', 'Unknown')
    # Returning an HTML fragment, not a full document or JSON
    return f'<li><h3>{title}</h3><p>Content</p></li>'

with app.test_request_context('/create', method='POST', data={'title': 'Test'}):
    print("POST /create returns a fragment:")
    print(app.dispatch_request())
```

### Discard the throwaway
This isolated route proves that we can return raw HTML fragments directly from a Flask route. We discard this and implement the real database-backed creation route.

### Project Change
- **Reference Source:** No reference counterpart — from scratch.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** Below the `notes_list` route in `app.py`.
- **Dependencies:** `sqlite3`, `render_template_string`.

### The New Code
```python
NOTE_CARD = '''
<li id="note-{{ note.id }}">
    <h3>{{ note.title }}</h3>
    <p>{{ note.body }}</p>
    <button hx-get="/notes/{{ note.id }}/edit-inline"
            hx-target="#note-{{ note.id }}"
            hx-swap="outerHTML">Edit</button>
    <button hx-delete="/notes/{{ note.id }}"
            hx-target="#note-{{ note.id }}"
            hx-swap="outerHTML"
            hx-confirm="Delete this note?">Delete</button>
</li>
'''

@app.route('/notes', methods=['POST'])
def note_create():
    user_id = session.get('user_id')
    if not user_id: return 'Unauthorized', 401
    
    title = request.form.get('title', '').strip()
    body  = request.form.get('body', '').strip()
    if not title: return '<span class="error">Title required.</span>', 422
    
    db = get_db()
    db.execute('INSERT INTO notes (user_id,title,body) VALUES (?,?,?)', (user_id, title, body))
    db.commit()
    
    note = db.execute('SELECT * FROM notes WHERE id=last_insert_rowid()').fetchone()
    return render_template_string(NOTE_CARD, note=note)
```

### The Updated Project
```python
1: @app.route('/notes', methods=['POST']) # ← new
2: def note_create():
3:     user_id = session.get('user_id')
4:     if not user_id: return 'Unauthorized', 401
5:     
6:     title = request.form.get('title', '').strip()
7:     body  = request.form.get('body', '').strip()
8:     if not title: return '<span class="error">Title required.</span>', 422
9:     
10:     db = get_db()
11:     db.execute('INSERT INTO notes (user_id,title,body) VALUES (?,?,?)', (user_id, title, body))
12:     db.commit()
13:     
14:     note = db.execute('SELECT * FROM notes WHERE id=last_insert_rowid()').fetchone()
15:     return render_template_string(NOTE_CARD, note=note)
```
The server now accepts the form POST, saves the data, fetches the newly created row, and renders just the `NOTE_CARD` template string to return a single `<li>` fragment.

### Mechanical walkthrough
- `request.form.get('title')` retrieves the form data submitted by the client.
- `db.execute('INSERT ...')` saves the new note to the SQLite database.
- `db.commit()` finalizes the transaction.
- `last_insert_rowid()` is a SQLite function that retrieves the integer primary key of the row we just inserted.
- `render_template_string(NOTE_CARD, note=note)` takes our multi-line HTML string and interpolates the database row values into it, returning an HTML fragment.

### CS lens
Returning HTML over the wire instead of JSON shifts the responsibility of rendering away from the client and back to the server. This reduces client-side complexity (no JavaScript state management or template rendering required) and takes advantage of Hypermedia As The Engine Of Application State (HATEOAS).

### SE lens
Using `render_template_string` with a constant `NOTE_CARD` keeps the template close to the logic for this capstone example. In a larger production app, this string would reside in an external file (e.g., `_note.html`) and be rendered using `render_template()`. Returning small fragments instead of full pages reduces payload sizes and speeds up rendering, as the browser only needs to parse and paint the new node.

### Commands needed
Run: `python app.py`

### Run it
Execute the code. Trace: POST `/notes` with title='My Note', body='Hello'. The server performs `INSERT INTO notes` and fetches the new row using `SELECT WHERE id=last_insert_rowid()`. It then runs `render_template_string` which returns `<li id="note-1"><h3>My Note</h3>...`. HTMX receives this and swaps this `<li>` at `afterbegin` of `#notes-list`. Existing list items are pushed down. The user sees the new note appear at the top instantly.

### One sentence connecting to previous unit
Now that we can create notes and append them to the DOM dynamically, we need a way to let users edit these notes without leaving the page.

---

## Concept Unit: Inline edit — loading and saving

### The Problem
Traditional edits require navigating to a completely different `/edit` URL, breaking the user's flow. We want the user to click "Edit" on a note, and have that specific note card transform into an edit form right there in the list.

### Introduce the concept in isolation
```python
from flask import Flask

app = Flask(__name__)

@app.route('/edit-form')
def edit_form():
    return '''
    <form hx-post="/save" hx-swap="outerHTML">
        <input name="text" value="Old text">
        <button>Save</button>
    </form>
    '''

with app.test_request_context('/edit-form'):
    print("GET /edit-form returns a form fragment.")
    print("This fragment is meant to replace an existing element entirely (outerHTML).")
```

### Discard the throwaway
This snippet shows how a form fragment is structured for an outer HTML replacement. We will discard it and implement the full inline edit cycle: fetching the form and submitting the update.

### Project Change
- **Reference Source:** No reference counterpart — from scratch.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** Below the `note_create` route.
- **Dependencies:** `abort`

### The New Code
```python
@app.route('/notes/<int:note_id>/edit-inline')
def note_edit_inline(note_id):
    user_id = session.get('user_id', 1)
    note = get_db().execute('SELECT * FROM notes WHERE id=? AND user_id=?', (note_id, user_id)).fetchone()
    if not note: abort(404)
    return f'<li id="note-{note["id"]}"><form hx-post="/notes/{note["id"]}/edit" hx-target="#note-{note["id"]}" hx-swap="outerHTML"><input name="title" value="{note["title"]}"><button>Save</button></form></li>'

@app.route('/notes/<int:note_id>/edit', methods=['POST'])
def note_save(note_id):
    user_id = session.get('user_id', 1)
    title = request.form.get('title','').strip()
    body  = request.form.get('body', '').strip()
    db = get_db()
    db.execute('UPDATE notes SET title=?,body=?,updated=datetime("now") WHERE id=? AND user_id=?', (title,body,note_id,user_id))
    db.commit()
    note = db.execute('SELECT * FROM notes WHERE id=?', (note_id,)).fetchone()
    return f'<li id="note-{note["id"]}"><h3>{note["title"]}</h3><p>{note["body"]}</p></li>'
```

### The Updated Project
```python
1: @app.route('/notes/<int:note_id>/edit-inline') # ← new
2: def note_edit_inline(note_id):
3:     user_id = session.get('user_id', 1)
4:     note = get_db().execute('SELECT * FROM notes WHERE id=? AND user_id=?', (note_id, user_id)).fetchone()
5:     if not note: abort(404)
6:     return f'<li id="note-{note["id"]}"><form hx-post="/notes/{note["id"]}/edit" hx-target="#note-{note["id"]}" hx-swap="outerHTML"><input name="title" value="{note["title"]}"><button>Save</button></form></li>'
7: 
8: @app.route('/notes/<int:note_id>/edit', methods=['POST']) # ← new
9: def note_save(note_id):
10:     user_id = session.get('user_id', 1)
11:     title = request.form.get('title','').strip()
12:     body  = request.form.get('body', '').strip()
13:     db = get_db()
14:     db.execute('UPDATE notes SET title=?,body=?,updated=datetime("now") WHERE id=? AND user_id=?', (title,body,note_id,user_id))
15:     db.commit()
16:     note = db.execute('SELECT * FROM notes WHERE id=?', (note_id,)).fetchone()
17:     return f'<li id="note-{note["id"]}"><h3>{note["title"]}</h3><p>{note["body"]}</p></li>'
```
We added two routes: one to fetch the inline edit form (which replaces the note card), and one to process the save action (which updates the database and replaces the form with the updated note card).

### Mechanical walkthrough
- `note_edit_inline` responds to `GET`. It queries the note and returns a `<form>` wrapped in an `<li>`. Because the button in the note card uses `hx-swap="outerHTML"`, this incoming `<li>` will completely overwrite the existing `<li>` note card.
- `note_save` responds to `POST`. It reads the updated form fields.
- `db.execute('UPDATE ...')` modifies the database record.
- The `return f'<li...>'` statement in `note_save` sends back the read-only display card for the note. Since the edit form targeted its own `<li>` with `outerHTML`, this new card replaces the form, restoring the list view seamlessly.

### CS lens
This pattern implements a finite state machine at the UI level. The list item has two states: "view" and "edit". Transitions between these states are triggered by user actions (clicking Edit, clicking Save/Cancel) which fetch the representation of the target state from the server and replace the current state representation in the DOM.

### SE lens
Notice the check `AND user_id=?` in the queries. This is crucial for multi-tenant security. Even though the UI only shows a user their own notes, an attacker could manually craft an HTTP request to edit note ID 5. By enforcing the `user_id` constraint in the SQL update statement itself, we ensure a user can only ever mutate records they own, providing defense in depth.

### Commands needed
Run: `python app.py`

### Run it
Execute the code. Trace: Click Edit on `note-3`: `hx-get='/notes/3/edit-inline'`, `hx-target='#note-3'`, `hx-swap='outerHTML'`. The server returns `<li id='note-3'><form...>`. HTMX replaces `#note-3` with the form. The user edits the title and clicks Save. `POST /notes/3/edit` runs `UPDATE notes SET title=new WHERE id=3 AND user_id=session`. It returns the updated `<li id='note-3'><h3>New Title</h3>`. HTMX replaces the form with the updated card.

### One sentence connecting to previous unit
We can now create and update notes inline, leaving deletion as the final CRUD operation to implement.

---

## Concept Unit: Delete note — hx-delete, empty response, outerHTML

### The Problem
When a user clicks "Delete," we want to remove the record from the database and remove the note card from the page immediately. How do we tell HTMX to remove an element entirely using the response from the server?

### Introduce the concept in isolation
```python
from flask import Flask

app = Flask(__name__)

@app.route('/delete-item', methods=['DELETE'])
def delete_item():
    return '', 200

with app.test_request_context('/delete-item', method='DELETE'):
    print("DELETE /delete-item returns an empty string.")
    print("If HTMX swaps this empty string with outerHTML, the element is erased from the DOM.")
```

### Discard the throwaway
This snippet proves that returning an empty string combined with an `outerHTML` swap effectively deletes the target element. We will discard this and add a delete route.

### Project Change
- **Reference Source:** No reference counterpart — from scratch.
- **Files affected:** `app.py`
- **Change type:** Add
- **Location:** Below the `note_save` route.
- **Dependencies:** HTMX `hx-delete` and `hx-confirm`.

### The New Code
```python
@app.route('/notes/<int:note_id>', methods=['DELETE'])
def note_delete(note_id):
    user_id = session.get('user_id', 1)
    db = get_db()
    db.execute('DELETE FROM notes WHERE id=? AND user_id=?', (note_id, user_id))
    db.commit()
    # Return empty string: hx-swap outerHTML with '' removes the element
    return '', 200
```

### The Updated Project
```python
1: @app.route('/notes/<int:note_id>', methods=['DELETE']) # ← new
2: def note_delete(note_id):
3:     user_id = session.get('user_id', 1)
4:     db = get_db()
5:     db.execute('DELETE FROM notes WHERE id=? AND user_id=?', (note_id, user_id))
6:     db.commit()
7:     return '', 200
```
This route handles the HTTP DELETE verb, deletes the matching record for the current user, and returns an empty 200 OK response.

### Mechanical walkthrough
- The delete button in our `NOTE_CARD` template specifies `hx-delete="/notes/{{ note.id }}"`. This sends an HTTP DELETE request.
- `hx-confirm="Delete this note?"` tells HTMX to pause and display the native browser `confirm()` prompt before sending the request. If the user clicks Cancel, the request is aborted.
- `hx-target="#note-{{ note.id }}"` and `hx-swap="outerHTML"` instruct HTMX to take the response and replace the entire `<li>` element.
- The server route `note_delete` executes a SQL `DELETE`.
- The route returns `''` (an empty string).
- HTMX replaces the `<li>` with the empty string, successfully removing it from the visual document.

### CS lens
Using the HTTP `DELETE` method aligns perfectly with REST semantics. Instead of sending a `POST` request with an action parameter (like `POST /delete-note`), we use the protocol's built-in verb. HTMX enables this, whereas standard HTML forms only support GET and POST.

### SE lens
Returning an empty string is a highly efficient way to manage UI removal. The server doesn't need to re-render the surrounding list, and the browser doesn't have to parse a new document. The response payload is functionally 0 bytes, minimizing bandwidth usage and latency.

### Commands needed
Run: `python app.py`

### Run it
Execute the code. Trace: Click Delete on `note-3`. `hx-confirm` triggers, the browser shows a confirm dialog. User clicks OK. HTMX issues `DELETE /notes/3`. The server runs `DELETE FROM notes WHERE id=3 AND user_id=session`, and returns `('', 200)`. HTMX processes `hx-swap='outerHTML'` and replaces `#note-3` with `''`, meaning the element is removed from the DOM. The user sees the note disappear instantly. No page reload occurs.

### One sentence connecting to previous unit
The CRUD loop is complete for the note elements themselves, but what if deleting a note needs to update a summary count elsewhere on the page, outside the note list?

---

## Concept Unit: Out-of-band swap — updating note count in nav

### The Problem
When a note is deleted, the note card is removed. However, if we have a "Total Notes: X" badge in our navigation bar, it will become out of sync. Since the delete button targets the note card itself, how can we update a completely different part of the page in the same response?

### Introduce the concept in isolation
```python
from flask import Flask

app = Flask(__name__)

@app.route('/delete-oob')
def delete_oob():
    return '''
    <!-- The primary response is empty, removing the target -->
    
    <!-- The OOB response updates an element elsewhere -->
    <span id="note-count" hx-swap-oob="true">5 notes</span>
    '''

with app.test_request_context('/delete-oob'):
    print("The server returns OOB elements alongside the primary response.")
    print("HTMX finds elements with hx-swap-oob=true and swaps them into the DOM where their IDs match.")
```

### Discard the throwaway
This snippet shows how OOB elements are tacked onto a response. We discard it and implement an OOB swap to update a note counter on our page.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** `app.py`
- **Change type:** Replace
- **Location:** The `note_delete` route.
- **Dependencies:** `hx-swap-oob`

### The New Code
```python
@app.route('/notes/<int:note_id>', methods=['DELETE'])
def note_delete(note_id):
    user_id = session.get('user_id', 1)
    db = get_db()
    db.execute('DELETE FROM notes WHERE id=? AND user_id=?', (note_id, user_id))
    db.commit()
    
    count = db.execute('SELECT COUNT(*) FROM notes WHERE user_id=?', (user_id,)).fetchone()[0]
    # Out-of-band: primary swap (empty = remove note) + OOB swap (update count badge)
    return f'<span id="note-count" hx-swap-oob="true">{count} notes</span>'
```

### The Updated Project
```python
1: @app.route('/notes/<int:note_id>', methods=['DELETE'])
2: def note_delete(note_id):
3:     user_id = session.get('user_id', 1)
4:     db = get_db()
5:     db.execute('DELETE FROM notes WHERE id=? AND user_id=?', (note_id, user_id))
6:     db.commit()
7:     
8:     count = db.execute('SELECT COUNT(*) FROM notes WHERE user_id=?', (user_id,)).fetchone()[0] # ← new
9:     return f'<span id="note-count" hx-swap-oob="true">{count} notes</span>' # ← new
```
We modified the delete route. It now queries the remaining number of notes and returns a `<span>` element with the `hx-swap-oob="true"` attribute alongside the empty primary response.

### Mechanical walkthrough
- `db.execute('SELECT COUNT(*)...')` gets the total number of remaining notes for the user.
- The returned string is `<span id="note-count" hx-swap-oob="true">{count} notes</span>`. 
- Since the response contains no visible elements meant for the primary target (the note card), the note card is effectively replaced with nothing (it is removed).
- HTMX scans the response for any elements with `hx-swap-oob="true"`.
- It finds the `span`. It looks in the current DOM for an element with the ID `note-count` and replaces it with this new span.

### CS lens
Out-of-band (OOB) swapping solves the "multi-target update" problem inherent in component-based UI updates. When a single action has side effects that cross component boundaries (a delete here affects a badge there), returning multiple fragments side-steps the need for global state management stores (like Redux) on the client.

### SE lens
OOB responses are powerful but can lead to tight coupling if abused, because a localized route (like `/delete-note`) suddenly has to know about and render global UI elements (like the navigation badge). For simple applications, it's highly productive; for complex ones, events (via `HX-Trigger` headers) often scale better by decoupling the update command from the rendering of the secondary target.

### Commands needed
Run: `python app.py`

### Run it
Execute the code. Trace: DELETE `/notes/1`. The server executes `DELETE FROM notes` and calculates `count=1`. It responds with `<span id="note-count" hx-swap-oob="true">1 notes</span>`. HTMX sees the primary target (`#note-1`) gets nothing, so `note-1` is removed. OOB logic finds `#note-count` in the page and replaces it with `1 notes`. The navigation badge updates simultaneously. No reload. Two DOM updates in one response.

### One sentence connecting to previous unit
With OOB swaps, our HTMX interactions can smoothly update disparate parts of the UI synchronously.

---

## Closing

### Connect the pieces
We have built a fully functional CRUD application without writing a single line of custom JavaScript. By leveraging HTMX, we used standard HTTP methods (GET, POST, DELETE) to fetch, create, edit, and remove records. We transformed static templates into interactive components by having the server return targeted HTML fragments. Finally, we learned how to perform secondary updates across the DOM using Out-of-Band swaps, proving that the server can remain the single source of truth for both data and presentation logic.
