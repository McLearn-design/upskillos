---
title: 0.1 — Your Project Folder and the Terminal
track: Build a Spreadsheet
trackOrder: 1
runtime: none
---

Over this series you'll build a spreadsheet, the kind of program Excel is. It starts as an empty folder and ends as a real app: formulas, a matrix language you write yourself, Python running inside the sheet, a server, and a desktop app. Every piece arrives when the spreadsheet needs it, and you'll know why it's there.

You know how to write Python scripts. That's all this series assumes. Everything else, starting with the terminal in this lesson, is explained when it first appears.

This window has four parts. The **lesson** is on the right (you're reading it). The **file tree** on the left lists the files in your project folder. The **editor** in the middle is where you type code. The **terminal** at the bottom is where you run programs. Only this lesson exists until you choose a folder.

## Make the project's folder

A program you build is a folder of files. Everything in this series lives in one folder, which you're about to make.

1. Click **Choose folder…** in the middle of this window.
2. In the window that opens, go to your **Documents** folder.
3. Click **New folder**, name it `spreadsheet`, and press Enter.
4. Select the new `spreadsheet` folder and click **Select Folder**.

The folder has an address, called its **path**, that says how to reach it from the top of the drive. On Windows it looks like this, with your own user name in the middle:

```text
C:\Users\you\Documents\spreadsheet
```

Read it left to right: the drive `C:`, then the folder `Users`, then your user's folder, then `Documents`, then `spreadsheet`. Each `\` means "go inside". (On macOS paths use `/` and start with `/`, like `/Users/you/Documents/spreadsheet`.)

This folder is yours, not the app's. You can open it in File Explorer or any other editor, and it stays when you close this app.

## Meet the terminal

The panel at the bottom of the window is a **terminal**. It runs a **shell**, a program whose whole job is to run other programs when you type their names. On Windows the shell here is **Windows PowerShell**. (On macOS it's **zsh**. Where the two differ, this series says so.)

The text at the start of the line is the **prompt**:

```text
PS C:\Users\you\Documents\spreadsheet>
```

`PS` means PowerShell. The path after it is the shell's **current directory**, the folder that commands act on unless you say otherwise. It starts in your project folder.

Click in the terminal and type this, then press **Enter**:

```powershell
pwd
```

PowerShell answers:

```text
PS C:\Users\you\Documents\spreadsheet> pwd

Path
----
C:\Users\you\Documents\spreadsheet


PS C:\Users\you\Documents\spreadsheet>
```

A new prompt at the end means the shell has finished and is waiting for your next command.

`pwd` stands for "print working directory" (*working directory* is another name for the current directory). It's the same thing Python's `os.getcwd()` tells you.

## Look inside the folder

Type:

```powershell
ls
```

Nothing comes back, and that's the right answer: the folder is empty. `ls` means "list": it shows what's in the current directory, like the file tree on the left does.

In PowerShell, `ls` is a short nickname, called an **alias**, for a longer command named `Get-ChildItem`. `pwd` is an alias for `Get-Location`. The short names exist because they're the names these commands have on macOS and Linux, so the same habits work everywhere.

## Make a folder from the terminal

Type:

```powershell
mkdir scratch
```

```text
PS C:\Users\you\Documents\spreadsheet> mkdir scratch


    Directory: C:\Users\you\Documents\spreadsheet


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----         10/2/2026   7:28 PM                scratch
```

`mkdir` means "make directory", and *directory* is another word for folder. PowerShell describes what it made: `Mode` starting with `d` means it's a directory. (On macOS, `mkdir` prints nothing when it works. Silence means success there.)

Look at the file tree on the left: `scratch` is there. The terminal and the file tree look at the same real folder on your disk.

```check
dir scratch -- Type mkdir scratch in the terminal and press Enter.
```

## Move around

Type these three commands one at a time, pressing Enter after each:

```powershell
cd scratch
pwd
cd ..
```

`cd` means "change directory". After `cd scratch`, the prompt changes, because the current directory changed:

```text
PS C:\Users\you\Documents\spreadsheet> cd scratch
PS C:\Users\you\Documents\spreadsheet\scratch> pwd

Path
----
C:\Users\you\Documents\spreadsheet\scratch


PS C:\Users\you\Documents\spreadsheet\scratch> cd ..
PS C:\Users\you\Documents\spreadsheet>
```

`..` always means "the folder this one is inside" (its *parent*), so `cd ..` takes you back up to `spreadsheet`.

`scratch` here is a **relative path**: it's looked up starting from the current directory. `C:\Users\you\Documents\spreadsheet\scratch` is an **absolute path**: it starts from the top of the drive, so it means the same folder wherever you are.

This explains a Python mystery you may have met already. `open("data.csv")` uses a relative path, so Python looks for `data.csv` in the current directory: the folder the terminal was in when you ran the script, *not* the folder the script is in. Run the same script from a different folder and it "can't find" a file that's sitting right next to it.

## When the shell doesn't know a command

Type this, misspelled on purpose:

```powershell
pyhton --version
```

```text
PS C:\Users\you\Documents\spreadsheet> pyhton --version
pyhton : The term 'pyhton' is not recognized as the name of a cmdlet, function, script file, or
operable program. Check the spelling of the name, or if a path was included, verify that the path
is correct and try again.
At line:1 char:1
+ pyhton --version
+ ~~~~~~
    + CategoryInfo          : ObjectNotFound: (pyhton:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException
```

Error messages look alarming, but read the first line and most of the answer is there: *the term 'pyhton' is not recognized*. The shell looked for a program called `pyhton` and found none. The `+ ~~~~~~` line underlines the part it didn't understand. The last lines are details for other programs to read; you can usually skip them.

Now spell it correctly:

```powershell
python --version
```

```text
PS C:\Users\you\Documents\spreadsheet> python --version
Python 3.13.14
```

(Your version number may be different.) The shell found the Python you already use to run your scripts. *How* it finds programs by name is the next lesson.

## Delete the scratch folder

Type:

```powershell
Remove-Item scratch
```

`Remove-Item` deletes a file or folder (its alias is `rm`). It prints nothing when it works. Check with `ls`: the folder is gone, from the file tree too.

**Deleting from the terminal skips the Recycle Bin.** There's no undo. If the folder still has files in it, PowerShell stops and asks first:

```text
Confirm
The item at C:\Users\you\Documents\spreadsheet\scratch has children and the Recurse parameter was
 not specified. If you continue, all children will be removed with the item. Are you sure you want
to continue?
[Y] Yes  [A] Yes to All  [N] No  [L] No to All  [S] Suspend  [?] Help (default is "Y"):
```

Typing `n` and Enter cancels. Read the question before pressing Enter: the default answer is Yes.

```check
missing scratch -- Type Remove-Item scratch in the terminal and press Enter.
```

Two habits that save a lot of typing: press **↑** to bring back the previous command, and press **Tab** while typing a file or folder name to have the shell finish it for you.
