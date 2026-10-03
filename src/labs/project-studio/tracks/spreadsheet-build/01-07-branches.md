---
title: 1.7 — Branches: Trying Something on the Side
runtime: none
---

So far every commit went in a line, one after another, on `main`. Real work doesn't go in a line. You start a feature, and halfway through you need to fix something urgent in the version that works. Or you want to try an idea without risking the code that runs.

A **branch** is a separate line of commits. You make one, work on it, and `main` doesn't change until you decide to bring the work in. Every feature in this series will be built on its own branch.

## Make a branch

```powershell
git switch -c say-goodbye
git branch
```

```text
PS C:\Users\you\Documents\spreadsheet> git switch -c say-goodbye
Switched to a new branch 'say-goodbye'
PS C:\Users\you\Documents\spreadsheet> git branch
  main
* say-goodbye
```

`git switch` moves you to a branch; `-c` creates it first. The new branch starts at the commit you were on. `git branch` lists branches, with `*` marking the one you're on.

A branch is cheap: it's just a name pointing at a commit. Making one copies no files.

```check
git-branch say-goodbye -- Run git switch -c say-goodbye
```

## Commit on the branch

Add a goodbye line to `hello.js`:

```javascript file=hello.js
const name = "spreadsheet";
const cells = 26 * 100;
console.log("Hello from Node, building a", name);
console.log("It will have", cells, "cells to start with.");
console.log("Goodbye for now.");
```

Commit it:

```powershell
git commit -am "Say goodbye at the end"
git log --oneline
```

`-a` stages every *tracked* file that changed before committing, so you can skip `git add` for files Git already knows. It never adds new files; those always need `git add`.

```text
PS C:\Users\you\Documents\spreadsheet> git log --oneline
363fc14 (HEAD -> say-goodbye) Say goodbye at the end
7352ff0 (main) Store and check out text files with LF line endings
0d7b9c3 Never commit .env, where secrets will live
0410cec Add the Python and exit-code examples from sprint 0
52f1fec Say how many cells the sheet starts with
dee5d6d Add hello.js, a first JavaScript program
```

Look at the first two lines: you (`HEAD`) are on `say-goodbye`, one commit ahead of `main`.

```check
git-branch say-goodbye
git-message "goodbye" label="a commit on this branch mentions the goodbye"
git-clean
```

## Switch back and forth

```powershell
git switch main
node hello.js
git switch say-goodbye
node hello.js
```

```text
PS C:\Users\you\Documents\spreadsheet> git switch main
Switched to branch 'main'
PS C:\Users\you\Documents\spreadsheet> node hello.js
Hello from Node, building a spreadsheet
It will have 2600 cells to start with.
PS C:\Users\you\Documents\spreadsheet> git switch say-goodbye
Switched to branch 'say-goodbye'
PS C:\Users\you\Documents\spreadsheet> node hello.js
Hello from Node, building a spreadsheet
It will have 2600 cells to start with.
Goodbye for now.
```

Watch `hello.js` in the editor while you switch: the goodbye line disappears and comes back. `git switch` rewrites the files in your folder to match the branch's latest commit. Your folder always shows one branch at a time.

That's why Git refuses to switch if you have uncommitted changes that would be overwritten. Commit (or `git restore`) first.

## Merge the branch into main

The goodbye works, so bring it into `main`. You merge *into* the branch you're on, so switch to `main` first:

```powershell
git switch main
git merge say-goodbye
```

```text
PS C:\Users\you\Documents\spreadsheet> git merge say-goodbye
Updating 7352ff0..363fc14
Fast-forward
 hello.js | 1 +
 1 file changed, 1 insertion(+)
```

**Fast-forward** is the simplest kind of merge: `main` hadn't moved since the branch started, so Git just moved the name `main` forward to the branch's commit. No new commit was needed. (When both branches have new commits, Git has to combine them; sprint 8 does that, conflicts and all.)

The branch has done its job. Delete the name:

```powershell
git branch -d say-goodbye
```

```text
PS C:\Users\you\Documents\spreadsheet> git branch -d say-goodbye
Deleted branch say-goodbye (was 363fc14).
```

Only the name is deleted. The commit is part of `main` now. (`-d` refuses to delete a branch whose commits aren't merged anywhere, so you can't lose work this way by accident.)

```check
git-branch main -- Switch back with git switch main.
contains hello.js "Goodbye for now." label="main has the goodbye line" -- Run git merge say-goodbye while on main.
git-clean
git-no-branch say-goodbye -- Run git branch -d say-goodbye
```
