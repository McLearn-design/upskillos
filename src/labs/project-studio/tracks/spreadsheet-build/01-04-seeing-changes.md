---
title: 1.4 — Seeing What Changed
runtime: none
---

The point of history is comparing: what's different now from the last snapshot? This lesson changes a file and has Git show you the change, line by line, before you commit it.

## Change hello.js

Add two lines to `hello.js`, so it says how many cells the spreadsheet will start with:

```javascript file=hello.js
const name = "spreadsheet";
const cells = 26 * 100;
console.log("Hello from Node, building a", name);
console.log("It will have", cells, "cells to start with.");
```

26 columns (A to Z) by 100 rows: that's the grid you'll draw in sprint 2.

Run it to see it works: `node hello.js`.

```check
run "node hello.js" stdout="It will have 2600 cells to start with." -- Add the two lines shown, then run node hello.js.
```

## git status and git diff

```powershell
git status
```

```text
PS C:\Users\you\Documents\spreadsheet> git status
On branch main
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   hello.js

Untracked files:
  (use "git add <file>..." to include in what will be committed)
        exit-code.js
        greet.py
        hello.py

no changes added to commit (use "git add" and/or "git commit -a")
```

`modified: hello.js` says *that* it changed. To see *how*:

```powershell
git diff
```

```text
PS C:\Users\you\Documents\spreadsheet> git diff
warning: in the working copy of 'hello.js', LF will be replaced by CRLF the next time Git touches it
diff --git a/hello.js b/hello.js
index f85e032..c8215ec 100644
--- a/hello.js
+++ b/hello.js
@@ -1,2 +1,4 @@
 const name = "spreadsheet";
+const cells = 26 * 100;
 console.log("Hello from Node, building a", name);
+console.log("It will have", cells, "cells to start with.");
```

This format is called a **diff**, and you'll read thousands of them: it's how code changes are reviewed on every team.

- `--- a/hello.js` is the old version (the last commit) and `+++ b/hello.js` the new one (your file now).
- `@@ -1,2 +1,4 @@` says where: the old file's lines 1–2 became the new file's lines 1–4.
- Lines starting with **`+`** were added. Lines starting with **`-`** were removed (none here). Lines starting with a space are unchanged; they're shown so you can see where the change sits.

(If the diff is long, it pages like `git log`: **Space** for more, **q** to quit.)

## Stage it, and see the diff move

```powershell
git add hello.js
git diff
git diff --staged
```

After `git add`, plain `git diff` prints **nothing**. That surprises everyone once. `git diff` compares your files with the **staging area**, and you just put the change there. To see what's staged, compared with the last commit, use `git diff --staged`; it shows the same two `+` lines.

So there are three versions of a file to keep in mind: the last commit, the staging area, and the file in your folder. `git diff` compares the last two; `git diff --staged` compares the first two.

```powershell
git commit -m "Say how many cells the sheet starts with"
```

```text
PS C:\Users\you\Documents\spreadsheet> git commit -m "Say how many cells the sheet starts with"
[main 52f1fec] Say how many cells the sheet starts with
 1 file changed, 2 insertions(+)
```

```check
git-commits 2 -- Stage hello.js and commit it.
git-message "cells" label="a commit message mentions the cells" -- Commit with a message that says what changed, e.g. "Say how many cells the sheet starts with".
```

## Commit the rest

The other three files from sprint 0 belong in the history too. `git add` accepts several names:

```powershell
git add hello.py greet.py exit-code.js
git commit -m "Add the Python and exit-code examples from sprint 0"
git log --oneline
```

`git add` prints the line-ending warning once for each file; that's expected until the next lesson.

```text
PS C:\Users\you\Documents\spreadsheet> git log --oneline
0410cec (HEAD -> main) Add the Python and exit-code examples from sprint 0
52f1fec Say how many cells the sheet starts with
dee5d6d Add hello.js, a first JavaScript program
```

`--oneline` shows one line per commit, newest first: the short hash and the message. It's the quickest way to see the shape of your history.

```check
git-tracked hello.py
git-tracked greet.py
git-tracked exit-code.js
git-clean -- Commit everything; git status should say "nothing to commit, working tree clean".
```

`git status` now says:

```text
On branch main
nothing to commit, working tree clean
```

**Working tree** is Git's name for your project folder as it is on disk. *Clean* means it matches the last commit exactly. That's a good state to be in before starting something new.
