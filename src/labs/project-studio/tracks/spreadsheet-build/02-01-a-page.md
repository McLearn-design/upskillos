---
title: 2.1 — A Page in the Browser
runtime: none
---

The spreadsheet will be a web page: the kind of document your browser displays. This sprint puts one on the screen: a grid of cells you can see, written by hand. It won't do anything yet. Making it respond is sprint 3.

Web pages are written in **HTML**, a language for describing what's on a page: a heading here, a paragraph there, a table. HTML isn't a programming language: it has no variables, loops or `if`. It describes; the browser draws.

## Start a branch for the sprint

From now on, each piece of work happens on its own branch (lesson 1.7) and is merged into `main` when it works. Start one for this sprint:

```powershell
git switch -c grid-page
```

```check
git-branch grid-page -- Run git switch -c grid-page
```

## The smallest real page

This step opens a new file, `index.html`. Type:

```html file=index.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Spreadsheet</title>
  </head>
  <body>
    <h1>Spreadsheet</h1>
    <p>A grid of cells will go here.</p>
  </body>
</html>
```

### How HTML is written

HTML is made of **elements**. Most elements are a pair of **tags** around some content:

```html
<h1>Spreadsheet</h1>
```

`<h1>` is the **opening tag**, `</h1>` (with a `/`) the **closing tag**, and the text between them is the content. `h1` means "heading, level 1", the biggest kind of heading.

Elements go inside other elements, which is called **nesting**. The indentation shows it, the way indentation shows blocks in Python. But in HTML the indentation is only for people: the tags decide what's inside what. Every element you open must be closed, in the reverse order you opened them.

Some elements have no content and no closing tag, like `<meta charset="utf-8">`. The `charset="utf-8"` part is an **attribute**: a setting written inside the opening tag, as `name="value"`.

### Line by line

- **`<!DOCTYPE html>`** says "this is a modern HTML page". It isn't an element; it's always the first line.
- **`<html lang="en">`** contains the whole page. `lang="en"` says it's in English, which screen readers use to pronounce it.
- **`<head>`** holds information *about* the page, which isn't drawn on it:
  - **`<meta charset="utf-8">`** says how the file's characters are encoded, so `é` or `€` show up correctly.
  - **`<title>`** is the text on the browser tab.
- **`<body>`** holds what's drawn on the page: here a heading and a **`<p>`** (paragraph).

```check
file index.html
page index.html "document.title" Spreadsheet label="the tab's title is Spreadsheet" -- The <title> element, inside <head>, holds the tab's title.
page index.html "document.querySelector('h1')?.textContent" Spreadsheet label="the page has the heading Spreadsheet" -- Put <h1>Spreadsheet</h1> inside <body>.
```

## Open it in your browser

```powershell
start index.html
```

`start` (short for `Start-Process`) opens a file with whatever program Windows uses for that kind of file; for `.html`, your web browser. (On macOS: `open index.html`.)

The browser shows a big heading, *Spreadsheet*, and the sentence below it. Look at the tab: *Spreadsheet*, from `<title>`. Look at the address bar: something like `file:///C:/Users/you/Documents/spreadsheet/index.html`. `file://` means the browser is reading a file straight from your disk rather than from a website.

## Change it and refresh

Change the paragraph's text in the editor, to anything you like. Look at the browser: nothing changed.

The browser read the file once, when it opened it. It doesn't watch for changes. Press **F5** (or click the refresh button) and your change appears.

Remember this small annoyance: edit, switch to the browser, refresh, every time. In sprint 4 you'll install a tool that does the refresh for you.

## Commit

```powershell
git add index.html
git commit -m "Add a page for the spreadsheet"
```

```check
git-tracked index.html -- git add index.html, then git commit.
git-branch grid-page
```
