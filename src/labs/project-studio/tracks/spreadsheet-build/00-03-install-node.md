---
title: 0.3 — Install Node.js
runtime: none
---

The spreadsheet will run in a web browser, and browsers run one programming language: **JavaScript**. You'll learn JavaScript from Python starting in sprint 3. Before that, you need a way to run JavaScript outside a browser, the way `python` runs Python files. That program is **Node.js** (usually just called Node).

Node also brings **npm**, which installs JavaScript libraries the way `pip` installs Python ones. The spreadsheet's build tools and test tools all come through npm.

## Is Node already installed?

Ask for its version:

```powershell
node --version
```

If Node is installed, you get a version number, like `v24.12.0`. Skip to the step **Check both programs**.

If it isn't, you get the error from lesson 0.1, now with `node` in it: *The term 'node' is not recognized…* You know what that means now: no folder on your PATH holds a `node.exe`. Installing Node fixes that.

## Install Node

1. Open **https://nodejs.org** in your web browser.
2. Download the version marked **LTS**. LTS means "long-term support": the version that gets fixes for the longest, which is what you want for real work. The other choice is the newest version, which is for trying new features.
3. Run the installer (a `.msi` file on Windows, `.pkg` on macOS) and accept the defaults. If the Windows installer offers to install "Tools for Native Modules", leave that box unchecked: this series doesn't need them.

The installer copies `node.exe` into a folder (on Windows, usually `C:\Program Files\nodejs`) and adds that folder to PATH.

## Check both programs

The terminal below started before Node was installed, so its PATH is out of date (lesson 0.2 explained why). Press **Restart** above the terminal to get a new one, then type:

```powershell
node --version
npm --version
```

```text
PS C:\Users\you\Documents\spreadsheet> node --version
v24.12.0
PS C:\Users\you\Documents\spreadsheet> npm --version
11.6.2
```

Your numbers may be newer. Any version 24 or higher works for this series.

`node --version` printing a number means the shell found Node. It's the same test you did for Python with `python --version`.

(If you use another editor's terminal, such as VS Code's, it has the same out-of-date PATH. Close the editor completely and open it again.)

```check
run "node --version" stdout="v" label="`node --version` prints a version" -- Install Node from nodejs.org, then press Restart above the terminal.
run "npm --version" label="`npm --version` works"
```

## Node's interactive prompt

Python has an interactive prompt (`>>>`) where you type a line and see the answer immediately. Node has one too. Type `node` on its own:

```powershell
node
```

The prompt changes to `>`. Type each of these lines and press Enter after each:

```text
PS C:\Users\you\Documents\spreadsheet> node
Welcome to Node.js v24.12.0.
Type ".help" for more information.
> 1 + 2
3
> "spread" + "sheet"
'spreadsheet'
> 7 / 2
3.5
> Math.floor(7 / 2)
3
> .exit
PS C:\Users\you\Documents\spreadsheet>
```

That's JavaScript, and it looks a lot like Python: `+` adds numbers and joins strings. One difference already: JavaScript has no `//` operator for whole-number division, because in JavaScript `//` starts a comment. `Math.floor(7 / 2)` rounds down instead, giving `3` like Python's `7 // 2`.

`.exit` leaves Node's prompt and returns you to PowerShell; the `PS` prompt comes back. (Pressing **Ctrl+C** twice does the same.)
