# Lesson 09: HTMX Patterns — hx-push-url, hx-boost, Modals, and Tabs

What you will build
In this lesson, you will build interactive web patterns including bookmarkable SPA navigation, progressive enhancement with hx-boost, modal dialogs, tab panels, and partial response extraction. These patterns let you build SPA-like navigation while keeping the server in control of all HTML.

What you need to know first
- Lesson 08

Terms used in this lesson
- **hx-push-url** — An HTMX attribute. Pushes the specified URL into the browser's history stack after a successful request, making the navigation bookmarkable and enabling the back button without a full page reload.
- **hx-boost** — An HTMX attribute. Upgrades normal `<a>` and `<form>` tags to use AJAX requests instead of full page reloads, progressively enhancing navigation.
- **hx-delete** — An HTMX attribute. Issues an HTTP DELETE request to the specified endpoint.
- **hx-swap** — An HTMX attribute. Specifies how the response HTML should be swapped into the DOM (e.g., `innerHTML`, `outerHTML`).
- **hx-target** — An HTMX attribute. Specifies the target element to be updated by the response.
- **hx-on::after-request** — An HTMX event handler attribute. Executes inline JavaScript after an AJAX request completes.
- **hx-select** — An HTMX attribute. Selects a specific portion of the response HTML using a CSS selector and extracts it for swapping, discarding the rest.
- **<dialog open>** — A native HTML element representing a dialog box or interactive component. The `open` attribute indicates it is active and visible.
- **innerHTML** — A DOM property/swap strategy. Replaces the contents inside the target element.
- **outerHTML** — A DOM property/swap strategy. Replaces the target element entirely, including the element itself.
- **HX-Request** — An HTTP header sent by HTMX with every request, allowing the server to distinguish between HTMX requests and normal browser requests.
- **Progressive enhancement** — A software engineering strategy where core functionality works universally (e.g., without JavaScript), while enhanced features (like HTMX) are layered on top if supported.

Objects and methods used
- **`request.headers.get`**
  - *What it is:* A dictionary lookup method on Flask's request headers.
  - *Implementation:* `def get(self, key, default=None)`
  - *Its use:* Used to check if the `HX-Request` header is set to `'true'`, allowing the server to return fragments for HTMX and full pages for normal navigation.
  - *Type:* Instance method of `werkzeug.datastructures.Headers`
  - *Responsibility:* Retrieves the value of a specific HTTP header from the incoming request.
  - *Depends on:* An active HTTP request context and the header key string.
  - *Connects to:* Called by route handlers; returns a string value or None.
  - *Shape:* Public API surface of the Flask request object.
- **`render_template`**
  - *What it is:* A Flask templating function.
  - *Implementation:* `def render_template(template_name_or_list, **context)`
  - *Its use:* Used to render full HTML pages by injecting context variables into Jinja2 templates.
  - *Type:* Standalone function in `flask` module.
  - *Responsibility:* Evaluates a Jinja template file with the provided context and returns the rendered HTML string.
  - *Depends on:* A configured Jinja environment, template files, and context data.
  - *Connects to:* Called by route handlers; returns an HTML string.
  - *Shape:* Public API surface for generating view representations.
- **`request.path`**
  - *What it is:* A property of the Flask request object.
  - *Implementation:* A string representing the path portion of the requested URI.
  - *Its use:* Used to inspect the requested URL path to determine which content to serve dynamically.
  - *Type:* Property of `flask.Request`
  - *Responsibility:* Exposes the URL path requested by the client.
  - *Depends on:* An active HTTP request context.
  - *Connects to:* Read by route handlers; returns a string.
  - *Shape:* Public API surface of the Flask request object.
- **`dict.get`**
  - *What it is:* A dictionary method.
  - *Implementation:* `def get(self, key, default=None)`
  - *Its use:* Used to safely retrieve content associated with a specific key (like a tab name or page name), providing a fallback if not found.
  - *Type:* Instance method of Python's built-in `dict`.
  - *Responsibility:* Returns the value for a key if it exists, otherwise a default value.
  - *Depends on:* A populated dictionary and a lookup key.
  - *Connects to:* Called by route handlers to map names to content.
  - *Shape:* Standard library data structure method.
- **`dict.pop`**
  - *What it is:* A dictionary method.
  - *Implementation:* `def pop(self, key, default=...)`
  - *Its use:* Used to remove an item from the data store when handling a DELETE request.
  - *Type:* Instance method of Python's built-in `dict`.
  - *Responsibility:* Removes the specified key and returns its value.
  - *Depends on:* A mutable dictionary and a lookup key.
  - *Connects to:* Called by route handlers to mutate state.
  - *Shape:* Standard library data structure method.


## Concept Unit: hx-push-url

### The Problem
When using HTMX to update parts of a page dynamically, the browser's URL does not change by default. This means users cannot bookmark the current state, and the back button won't work as expected. How do we update the URL bar while still keeping the fast, fragment-only updates of HTMX?

### Introduce the concept in isolation
We will use the **hx-push-url** attribute to tell HTMX to push a new URL into the browser's history stack.

```html
<!-- Throwaway Lab -->
<button hx-get="/fragment" hx-target="#result" hx-push-url="/new-url">
  Update and push URL
</button>
<div id="result"></div>
```

When clicked, this button fetches content from `/fragment`, swaps it into `#result`, and immediately updates the browser's address bar to `/new-url`. 

### Discard the throwaway
This throwaway code is discarded and will not be added to the project.

### Project Change
- **Reference Source:** No reference counterpart — this is a from-scratch addition.
- **Files affected:** Modified `templates/layout.html`, `app.py`
- **Change type:** Add
- **Location:** Inside the main layout and app routing.

### The New Code
We add a navigation menu using `hx-push-url`.

```html
<nav>
  <a hx-get="/page/home"
     hx-target="#content"
     hx-push-url="/home">Home</a>
  <a hx-get="/page/about"
     hx-target="#content"
     hx-push-url="/about">About</a>
  <a hx-get="/page/contact"
     hx-target="#content"
     hx-push-url="/contact">Contact</a>
</nav>
<div id="content">Welcome home.</div>
```

This needs to be supported by a Python backend that handles both fragment requests and full page navigations.

```python
from flask import Flask, request, render_template
app = Flask(__name__)
PAGES = {
    'home':    '<h1>Home</h1><p>Welcome to the homepage.</p>',
    'about':   '<h1>About</h1><p>We build things with Python and HTMX.</p>',
    'contact': '<h1>Contact</h1><p>Email us at hello@example.com</p>',
}

@app.route('/page/<name>')
def page_fragment(name):
    content = PAGES.get(name, '<p>Page not found.</p>')
    if request.headers.get('HX-Request') == 'true':
        return content  # fragment only
    return render_template('layout.html', content=content)  # full page on direct nav

@app.route('/home')
@app.route('/about')
@app.route('/contact')
def spa_page():
    name = request.path.lstrip('/')
    return render_template('layout.html', content=PAGES.get(name, ''))
```

### The Updated Project
The navigation now updates the URL while swapping the content.

```html
1: <!DOCTYPE html>
2: <html>
3: <body>
4: <!-- ← new -->
5: <nav>
6:   <a hx-get="/page/home" hx-target="#content" hx-push-url="/home">Home</a>
7:   <a hx-get="/page/about" hx-target="#content" hx-push-url="/about">About</a>
8:   <a hx-get="/page/contact" hx-target="#content" hx-push-url="/contact">Contact</a>
9: </nav>
10: <div id="content">{{ content | safe }}</div>
11: <!-- /new -->
12: </body>
13: </html>
```

### Mechanical walkthrough
- **hx-get="/page/about"**: Tells HTMX to issue a GET request to `/page/about` when clicked.
- **hx-target="#content"**: Instructs HTMX to take the response and swap it into the element with the ID `content`.
- **hx-push-url="/about"**: Commands HTMX to push `/about` into the browser's history stack, changing the URL bar without reloading the page.
- **request.headers.get('HX-Request')**: The server checks if the request was made by HTMX. If true, it sends only the HTML fragment. If false (e.g., a direct browser visit), it wraps the fragment in the full `layout.html`.

### CS lens
History management in browsers is fundamentally a stack data structure. Pushing a new URL with `window.history.pushState` (which `hx-push-url` wraps) adds a new frame to this stack without tearing down the current Document Object Model (DOM).

### SE lens
Supporting both HTMX fragment requests and direct full-page loads (via bookmark or refresh) ensures robust architecture. If a user shares a link, the server must be capable of rendering the full page context, not just an isolated fragment.

### Commands needed
Run: `python app.py`

### Run it
Click the "About" link. Notice that only the content area updates, but the browser URL changes to `/about`.

### One sentence connecting to previous unit
Now that we have bookmarkable links using explicit HTMX attributes, we can look at a simpler way to upgrade existing links automatically.


## Concept Unit: hx-boost

### The Problem
Adding `hx-get` and `hx-push-url` to every single navigation link is tedious and repetitive. Is there a way to tell HTMX to automatically upgrade standard standard HTML `<a>` tags to use AJAX without rewriting them?

### Introduce the concept in isolation
We use the **hx-boost** attribute on a container to automatically upgrade all links and forms within it.

```html
<!-- Throwaway Lab -->
<div hx-boost="true">
  <a href="/some-page">This is a standard link, boosted.</a>
</div>
```

This transforms the standard `href` into an HTMX AJAX request that swaps the `<body>` by default and pushes the URL.

### Discard the throwaway
This throwaway code is discarded and will not be added to the project.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** Modified `templates/base.html`, `app.py`
- **Change type:** Add
- **Location:** On the `<body>` tag.

### The New Code
We add `hx-boost="true"` to the body.

```html
<body hx-boost="true">
  <nav>
    <a href="/">Home</a>       <!-- now uses HTMX -->
    <a href="/about">About</a> <!-- now uses HTMX -->
  </nav>
  <main id="main-content">
    <!-- hx-boost replaces this element's innerHTML with each navigation -->
  </main>
</body>
```

The backend code to support this:

```python
@app.route('/')
def index():
    if request.headers.get('HX-Request') == 'true':
        return '<h1>Home</h1><p>Loaded via HTMX.</p>'
    return render_template('base.html', content='<h1>Home</h1>')

@app.route('/about')
def about():
    if request.headers.get('HX-Request') == 'true':
        return '<h1>About</h1><p>About page fragment.</p>'
    return render_template('base.html', content='<h1>About</h1>')
```

### The Updated Project
The `<body>` tag now cascades the boost behavior to all internal links.

```html
1: <!DOCTYPE html>
2: <html>
3: <!-- ← new -->
4: <body hx-boost="true">
5:   <nav>
6:     <a href="/">Home</a>
7:     <a href="/about">About</a>
8:   </nav>
9:   <main id="main-content">{{ content | safe }}</main>
10: </body>
11: <!-- /new -->
12: </html>
```

### Mechanical walkthrough
- **hx-boost="true"**: Tells HTMX to intercept all clicks on `<a>` tags and form submissions inside this element.
- **href="/about"**: The standard HTML link. HTMX reads this, prevents the default browser navigation, and instead issues an AJAX GET request to `/about`.
- **request.headers.get('HX-Request')**: The server detects the HTMX request and returns only the necessary fragment. By default, `hx-boost` will replace the `<body>` innerHTML and update the URL.

### CS lens
This pattern represents the decorator or wrapper pattern applied to the DOM. A single attribute on an ancestor node intercepts and alters the behavior of all relevant descendant nodes via event bubbling.

### SE lens
Progressive enhancement ensures that if JavaScript is disabled or fails to load, the links still function as standard browser navigations. The application remains fully functional, just with full page reloads instead of fast SPA swaps.

### Commands needed
Run: `python app.py`

### Run it
Click the standard links. The page updates without a full reload, but if you disable JavaScript, the links still work flawlessly.

### One sentence connecting to previous unit
With navigation smoothed out, we can tackle overlaying interactive components like modal dialogs without leaving the current page.


## Concept Unit: Modal dialog pattern

### The Problem
We need to ask the user for confirmation before deleting an item. Redirecting them to a separate "Are you sure?" page is disruptive. How do we show a confirmation dialog using HTMX without writing custom JavaScript?

### Introduce the concept in isolation
We use a native HTML `<dialog open>` element loaded via HTMX to create a modal.

```html
<!-- Throwaway Lab -->
<button hx-get="/modal" hx-target="#modal-container">Open Dialog</button>
<div id="modal-container"></div>
```

The server returns:

```html
<!-- Throwaway Lab Response -->
<dialog open>Hello, Modal!</dialog>
```

This renders a native modal popup.

### Discard the throwaway
This throwaway code is discarded and will not be added to the project.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** Modified `templates/fragments/modal.html`, `app.py`
- **Change type:** Add
- **Location:** Route definitions and fragments.

### The New Code
The trigger and container for the modal:

```html
<button hx-get="/modal/confirm-delete/42"
        hx-target="#modal-container"
        hx-swap="innerHTML">Delete Item 42</button>
<div id="modal-container"></div>
```

The modal fragment (`modal.html`):

```html
<dialog id="app-modal" open>
  <h2>Confirm Delete</h2>
  <p>Delete item {{ item_id }}? This cannot be undone.</p>
  <form hx-delete="/items/{{ item_id }}"
        hx-target="#item-{{ item_id }}"
        hx-swap="outerHTML"
        hx-on::after-request="document.getElementById('app-modal').remove()">
    <button type="submit">Yes, delete</button>
    <button type="button" onclick="this.closest('dialog').remove()">Cancel</button>
  </form>
</dialog>
```

And the Python backend:

```python
items = {i: f'Item {i}' for i in range(1, 6)}

@app.route('/modal/confirm-delete/<int:item_id>')
def confirm_delete_modal(item_id):
    return render_template('fragments/modal.html', item_id=item_id)

@app.route('/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    items.pop(item_id, None)
    return ''  # empty response
```

### The Updated Project
The items are rendered alongside the modal container.

```html
1: <div id="item-42">
2:   Item 42
3:   <!-- ← new -->
4:   <button hx-get="/modal/confirm-delete/42" hx-target="#modal-container">Delete</button>
5:   <!-- /new -->
6: </div>
7: <div id="modal-container"></div>
```

### Mechanical walkthrough
- **<dialog id="app-modal" open>**: The native HTML dialog element. The `open` attribute makes it visible immediately upon being swapped into the DOM.
- **hx-delete="/items/{{ item_id }}"**: Submits an HTTP DELETE request to the server when the form is submitted.
- **hx-target="#item-{{ item_id }}"**: Targets the specific item row in the UI for the update.
- **hx-swap="outerHTML"**: Replaces the entire target element. Because the server returns an empty string (`''`), the target element is effectively removed from the DOM.
- **hx-on::after-request**: An HTMX event listener that executes JavaScript to remove the modal from the DOM after the AJAX request completes.

### CS lens
This represents a multi-step state machine handled statelessly by the server. The client transitions from "viewing" to "confirming" to "deleted" purely based on HTML fragments swapped in and out.

### SE lens
Using native HTML `<dialog>` elements removes the need for bulky CSS frameworks or complex JavaScript libraries to handle overlay positioning and focus trapping.

### Commands needed
Run: `python app.py`

### Run it
Click the delete button. The modal appears. Click "Yes, delete", and observe the modal close while the item is instantly removed from the list.

### One sentence connecting to previous unit
Just as modals load temporary context over the page, we can use HTMX to flip through different contexts horizontally using tab panels.


## Concept Unit: Tab panel pattern

### The Problem
We have multiple sections of content (Overview, Details, Reviews) but only want to show one at a time to save space. Loading all of them and hiding them with CSS can be slow if the content is large. How can we load tabs dynamically on demand?

### Introduce the concept in isolation
We can use a set of buttons that target the same container to create tabs.

```html
<!-- Throwaway Lab -->
<button hx-get="/tab1" hx-target="#panel">Tab 1</button>
<button hx-get="/tab2" hx-target="#panel">Tab 2</button>
<div id="panel"></div>
```

Clicking a button overwrites the `#panel` contents with the respective tab.

### Discard the throwaway
This throwaway code is discarded and will not be added to the project.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** Modified `templates/product.html`, `app.py`
- **Change type:** Add
- **Location:** The product details view.

### The New Code
The HTML for the tabs:

```html
<div class="tabs">
  <button hx-get="/tabs/overview"
          hx-target="#tab-panel"
          hx-swap="innerHTML"
          class="tab active">Overview</button>
  <button hx-get="/tabs/details"
          hx-target="#tab-panel"
          hx-swap="innerHTML"
          class="tab">Details</button>
  <button hx-get="/tabs/reviews"
          hx-target="#tab-panel"
          hx-swap="innerHTML"
          class="tab">Reviews</button>
</div>
<div id="tab-panel"><!-- active tab content --></div>
```

The Python route to serve the content:

```python
TAB_CONTENT = {
    'overview': '<h2>Overview</h2><p>Product overview content here.</p>',
    'details':  '<h2>Details</h2><ul><li>Weight: 1kg</li><li>Color: Blue</li></ul>',
    'reviews':  '<h2>Reviews</h2><p>★★★★☆ 4.2/5 from 128 reviews</p>',
}

@app.route('/tabs/<tab_name>')
def tab(tab_name):
    content = TAB_CONTENT.get(tab_name, '<p>Tab not found.</p>')
    return content
```

### The Updated Project
The product page now includes the interactive tabs.

```html
1: <div class="product-page">
2:   <h1>Product Title</h1>
3:   <!-- ← new -->
4:   <div class="tabs">
5:     <button hx-get="/tabs/overview" hx-target="#tab-panel">Overview</button>
6:     <button hx-get="/tabs/details" hx-target="#tab-panel">Details</button>
7:   </div>
8:   <div id="tab-panel"></div>
9:   <!-- /new -->
10: </div>
```

### Mechanical walkthrough
- **hx-get="/tabs/details"**: Fetches the HTML fragment for the "details" tab.
- **hx-target="#tab-panel"**: All tabs share the exact same target. Clicking a new tab replaces whatever was previously in the panel.
- **hx-swap="innerHTML"**: Replaces the content inside the panel, preserving the panel container itself.
- **dict.get**: The Python dictionary lookup retrieves the correct HTML snippet based on the URL parameter.

### CS lens
This is multiplexing over a single UI resource. Multiple control inputs (the tab buttons) are routed into a single output channel (the tab panel container).

### SE lens
Lazy loading tab content reduces initial page load size and server rendering time. Content is only generated and sent over the wire when the user explicitly asks for it.

### Commands needed
Run: `python app.py`

### Run it
Click between the "Overview" and "Details" tabs. The content in the panel swaps out seamlessly without a page reload.

### One sentence connecting to previous unit
Sometimes, instead of building a dedicated fragment endpoint like we did for tabs, we just want to grab a piece of an existing full page.


## Concept Unit: hx-select

### The Problem
You already have a full page route (like `/products/42`) that renders an entire HTML layout. You want to load just the product card from that page into a side panel using HTMX, but you don't want to create a separate fragment-only route just for this one action.

### Introduce the concept in isolation
The **hx-select** attribute allows you to fetch a full HTML page, but extract only a specific element from the response before swapping it in.

```html
<!-- Throwaway Lab -->
<button hx-get="/full-page" hx-select="#just-this" hx-target="#panel">
  Fetch part
</button>
```

HTMX downloads the full page, finds `#just-this`, and discards the rest.

### Discard the throwaway
This throwaway code is discarded and will not be added to the project.

### Project Change
- **Reference Source:** No reference counterpart.
- **Files affected:** Modified `templates/index.html`, `app.py`
- **Change type:** Add
- **Location:** The product listing page.

### The New Code
The trigger using `hx-select`:

```html
<a href="/products/42"
   hx-get="/products/42"
   hx-select="#product-card"
   hx-target="#detail-pane"
   hx-swap="innerHTML">
  View Product 42
</a>
<div id="detail-pane"></div>
```

The backend code returns a normal, full HTML page:

```python
@app.route('/products/<int:product_id>')
def product(product_id):
    data = {'id': product_id, 'name': f'Product {product_id}', 'price': product_id * 9.99}
    return render_template('product.html', product=data)
```

Where `product.html` contains:
```html
<div id="product-card">
  <h2>{{ product.name }}</h2>
  <p>${{ product.price }}</p>
</div>
```

### The Updated Project
The product list now opens details in a pane.

```html
1: <div class="layout">
2:   <!-- ← new -->
3:   <a hx-get="/products/42" hx-select="#product-card" hx-target="#detail-pane">View</a>
4:   <div id="detail-pane"></div>
5:   <!-- /new -->
6: </div>
```

### Mechanical walkthrough
- **hx-get="/products/42"**: Makes an AJAX request to the full page endpoint.
- **hx-select="#product-card"**: Before swapping, HTMX parses the returned HTML payload, finds the element matching the `#product-card` CSS selector, and isolates it. The `<head>`, `<nav>`, and other wrappers are discarded.
- **hx-target="#detail-pane"**: Swaps the extracted fragment into the target container.

### CS lens
This acts as a client-side filter or projection over network data. The server sends the entire object (the full page), but the client projects only the necessary subset (the component) into the DOM tree.

### SE lens
This prevents route bloat. By extracting what you need on the client side, you reuse your existing full-page routes, maintaining a smaller and more maintainable backend API.

### Commands needed
Run: `python app.py`

### Run it
Click "View Product 42". The detail pane will populate with just the product card, ignoring the rest of the full page layout returned by the server.

### One sentence connecting to previous unit
With all these patterns, we can construct rich interactions while keeping the server firmly in control.


## Closing

### Connect the pieces
Let's trace a user interaction through a fully enhanced application: The user clicks an "About" navigation link inside a `<body hx-boost="true">`. HTMX intercepts the click and prevents the full page reload. It issues a `GET /about` request, attaching the `HX-Request: true` header. The Flask backend detects this header and returns only the necessary HTML fragment instead of the full layout. HTMX receives the fragment, swaps the `<body>`'s `innerHTML`, and via `hx-push-url` behavior built into `hx-boost`, updates the browser's address bar to `/about`. The navigation is fully bookmarkable, fast, and driven entirely by HTML over the wire.
