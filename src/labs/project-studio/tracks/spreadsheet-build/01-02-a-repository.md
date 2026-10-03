---
title: 1.2 — Make the Folder a Repository
runtime: none
---

Git doesn't watch every folder on your computer. It keeps history only for folders you turn into **repositories** (often shortened to *repo*). This lesson turns your project folder into one, and shows where Git keeps the history.

## Before: not a repository

Ask Git about the folder:

```powershell
git status
```

```text
PS C:\Users\you\Documents\spreadsheet> git status
fatal: not a git repository (or any of the parent directories): .git
```

Read it as you learned in lesson 0.1. `fatal:` means Git stopped without doing anything. The rest says why: it looked for a folder called `.git` here, then in each folder above this one, and found none. `.git` is where a repository keeps its history, so no `.git` means no repository.

## git init

```powershell
git init
```

```text
PS C:\Users\you\Documents\spreadsheet> git init
Initialized empty Git repository in C:/Users/you/Documents/spreadsheet/.git/
```

`init` means "initialize": start a new, empty repository here. Your files haven't changed and nothing is recorded yet. Git has only made its `.git` folder. (Git prints the path with `/` even on Windows; Git came from Linux, and Windows accepts both.)

```check
git-repo -- Run git init in the terminal (in your spreadsheet folder).
```

## The hidden .git folder

`ls` doesn't show `.git`, and neither does the file tree, because it's a **hidden** folder. Ask `ls` to show everything with `-Force`:

```powershell
ls -Force
```

```text
PS C:\Users\you\Documents\spreadsheet> ls -Force


    Directory: C:\Users\you\Documents\spreadsheet


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d--h--         10/2/2026   8:11 PM                .git
-a----         10/2/2026   8:08 PM             61 exit-code.js
-a----         10/2/2026   8:05 PM             84 greet.py
-a----         10/2/2026   8:06 PM             78 hello.js
-a----         10/2/2026   8:06 PM             66 hello.py
```

The `h` in `d--h--` marks it hidden. (On macOS: `ls -a`.)

Everything Git knows about your project lives inside `.git`: every snapshot, every message, every branch. Two rules follow from that:

- **Don't edit anything inside `.git` by hand.** Git manages it; you use `git` commands.
- **Deleting `.git` deletes the history.** Your current files stay, but every snapshot is gone. Copying the project folder *with* `.git` copies the history too.

## git status, again

```powershell
git status
```

```text
PS C:\Users\you\Documents\spreadsheet> git status
On branch main

No commits yet

Untracked files:
  (use "git add <file>..." to include in what will be committed)
        exit-code.js
        greet.py
        hello.js
        hello.py

nothing added to commit but untracked files present (use "git add" to track)
```

Line by line:

- **On branch main**: you're on the branch called `main` (lesson 1.1 set that name).
- **No commits yet**: no snapshots have been recorded.
- **Untracked files**: files Git can see in the folder but has never recorded. Git doesn't record a file until you tell it to, so that nothing ends up in your history by accident.
- The lines in brackets are hints: the command that would act on what's listed.

`git status` is the command you'll run most. Whenever you're unsure what state the project is in, run it. It never changes anything.

```check
git-repo
```
