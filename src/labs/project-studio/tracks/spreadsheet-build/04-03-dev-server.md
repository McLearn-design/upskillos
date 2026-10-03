---
title: 4.3 — The Development Server
runtime: none
---

Vite is installed. Start it, and the page that broke in lesson 4.1 works again. You'll also lose a chore you've had since sprint 2: switching to the browser and refreshing after every change.

## Start Vite

```powershell
npm run dev
```

```text
PS C:\Users\you\Documents\spreadsheet> npm run dev

> spreadsheet@0.1.0 dev
> vite


  VITE v8.3.2  ready in 838 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

The two `>` lines are npm saying which script it's running. Then Vite reports that its **server** is ready.

- **`http://localhost:5173/`** is where to find it. **`localhost`** means "this computer": the server isn't on the internet, only reachable from your own machine. **`5173`** is the **port**: one computer can run many servers, and each listens on its own numbered port, like extensions on one phone line.
- **Network: use --host to expose** confirms the server can't be reached from other computers unless you ask.

Unlike every command so far, `npm run dev` doesn't finish. A server waits for requests until it's stopped, like `ticker.js` in lesson 0.4. The terminal is busy while it runs.

```check
page index.html "document.querySelectorAll('tbody td').length" 2600 server=vite errors=none label="through Vite, the grid builds again"
page index.html "document.querySelector('#name-box').textContent" A1 server=vite label="and A1 is selected"
```

## Open it

Type `http://localhost:5173` into your browser's address bar. The full grid is back, selection and formula bar working. The address isn't `file:///` any more, so the module rule from lesson 4.1 is satisfied.

## Use a second terminal

The first terminal is busy running Vite, and you still need one for Git. Click **+** above the terminal: a second terminal opens, in the project folder, while Vite keeps running in the first. Switch between them with their tabs.

Professional developers work like this all day: one terminal for the dev server, one or more for everything else.

## Edits appear by themselves

Arrange the browser where you can see it, then change something in `style.css`: make the header background `#e8f0fe`, a pale blue, instead of `#f3f4f6`.

The browser changes **as you type**, without a refresh. Vite watches your files; when one changes, it tells the browser, which swaps in the new CSS on the spot. This is called **hot module replacement** (HMR). For a change to `grid.js`, Vite reloads the page for you instead.

Vite's terminal reports each one, with the time:

```text
5:20:24 AM [vite] (client) hmr update /style.css?direct
5:20:27 AM [vite] (client) page reload grid.js
```

Change the colour back (or keep it, if you prefer it), and notice that the sprint 2 chore of edit, switch, refresh is gone for good.

## Stop the server

Click the first terminal's tab and press **Ctrl+C** (lesson 0.4). The prompt returns, and the browser page can't reach the server any more: refresh it and the browser shows an error page saying the site can't be reached. Start it again with `npm run dev` whenever you work on the project.

## Commit

In your second terminal:

```powershell
git commit -am "Serve the page with Vite"
```

If you didn't change any file in this lesson, Git says *nothing to commit*. That's fine: everything is already committed.

```check
git-clean
```
