---
title: 0.1 — A Project With Its Own Python
track: Reinforcement Learning in pygame
trackOrder: 13
runtime: none
---

This series builds a **reinforcement learning workbench**: a pygame program where you can watch an agent act in a world, see what it believes about that world, and watch those beliefs change as it learns. It ends with Q-learning running on real Gymnasium environments such as FrozenLake and CartPole.

Every piece of the learning code is yours: you type it, and **Check my work** runs it. Some things are handed to you up front, such as the test files that the checks run. Nothing stays a black box: every supplied file is explained by the end of the series.

You need to know basic Python: variables, functions, lists, loops and `if`. The terminal commands are explained as they appear. (If the terminal is new to you, lesson 0.1 of the *Build a Spreadsheet* track starts from zero.)

This lesson sets up the project: a folder, a Python environment that belongs only to it, and the exact packages the series uses.

## Choose the project folder

1. Click **Choose folder…** in the middle of this window.
2. Go to your **Documents** folder, make a **New folder** named `rl-workbench`, select it and click **Select Folder**.

The terminal at the bottom now runs inside `rl-workbench`. Check which Python you have:

```powershell
python --version
```

```text
Python 3.13.14
```

This series needs **Python 3.12 or newer**. One of its packages, NumPy 2.5, doesn't install on older versions.

If PowerShell says `python` isn't recognized, or opens the Microsoft Store, install Python from [python.org](https://www.python.org/downloads/). In the installer, tick **Add python.exe to PATH**. Then close and reopen this window so the terminal sees it.

```check
run "python -c \"import sys; assert sys.version_info >= (3, 12), sys.version\"" label="Python 3.12 or newer runs from the terminal" -- Install Python 3.12 or newer from python.org and tick "Add python.exe to PATH", then reopen this window.
```

## Make a virtual environment

When you `pip install` a package, it goes into one Python installation's `site-packages` folder, shared by every program that uses that Python. Two projects that need different versions of the same package would then break each other. A **virtual environment** fixes this. It's a folder holding a Python of its own, with its own empty `site-packages`, so this project's packages can't affect anything else on your machine.

Type:

```powershell
python -m venv .venv
```

`-m venv` means "run the module named `venv`", which is part of Python's standard library. `.venv` is the folder it creates. The leading dot is a convention: editors such as VS Code look for a folder with that name, and macOS and Linux hide names that start with a dot. It takes a few seconds and prints nothing.

The file tree now shows `.venv`. Three things inside it matter:

- `.venv\pyvenv.cfg`: a short text file naming the Python this environment was made from. Open it and read it.
- `.venv\Scripts\python.exe`: this environment's Python. (On macOS: `.venv/bin/python`.)
- `.venv\Lib\site-packages`: where this project's packages will go. It holds only pip for now.

### How a folder becomes a separate Python

`.venv` doesn't contain a copy of Python. `.venv\Scripts\python.exe` is about 250 KB, while a full Python installation is far larger. It's a small **launcher**, and the redirection happens through `pyvenv.cfg`. Open it:

```text
home = C:\Users\you\AppData\Local\Programs\Python\Python313
include-system-site-packages = false
version = 3.13.14
```

When any Python starts, one of the first things it does is look for a file named `pyvenv.cfg` beside its own `.exe` (or one folder up). If it finds one:

1. `home` tells it where the real installation is. It loads the **standard library** (`os`, `json`, `random`, …) from there, so that part is shared and never copied.
2. It sets `sys.prefix`, "where am I installed?", to the `.venv` folder instead of `home`. The original location is kept in `sys.base_prefix`.
3. It builds its list of folders to import packages from (`sys.path`) with `.venv\Lib\site-packages` in it, and **without** the real installation's `site-packages`. That's what `include-system-site-packages = false` means.

So `import numpy` searches only this project's packages. The system Python finds no `pyvenv.cfg`, so it keeps using its own `site-packages`. The two stay apart.

```check
file .venv/pyvenv.cfg -- Type python -m venv .venv in the terminal, inside the rl-workbench folder.
run ".venv/Scripts/python -c \"import sys; assert sys.prefix != sys.base_prefix\"" label=".venv contains a working virtual environment"
```

## Two Pythons

There are now two Pythons on your machine, and it matters which one runs. Ask each one where it is:

```powershell
python -c "import sys; print(sys.executable)"
.venv\Scripts\python -c "import sys; print(sys.executable)"
```

```text
C:\Users\you\AppData\Local\Programs\Python\Python313\python.exe
C:\Users\you\Documents\rl-workbench\.venv\Scripts\python.exe
```

The first is the system Python. The second is this project's. `sys.executable` is the path of the Python that is running, and you'll use it in the next lesson to check which one ran a script.

### How the terminal chooses which `python`

When you type a bare name such as `python`, the shell has to find a program with that name. It reads the environment variable `PATH`, which is a list of folders separated by `;`, and looks in each folder **in order**. The first `python.exe` it finds is the one that runs. See the list with:

```powershell
$env:PATH -split ";"
```

A path with a folder in it, like `.venv\Scripts\python`, skips the search entirely: it names the exact file.

Typing `.venv\Scripts\python` every time is tedious, so environments come with an **activation** script:

```powershell
.venv\Scripts\Activate.ps1
```

The prompt gains a prefix to remind you:

```text
(.venv) PS C:\Users\you\Documents\rl-workbench>
```

Activation is less magic than it looks. `Activate.ps1` does three things to *this terminal session*:

1. It puts `.venv\Scripts` at the **front** of `$env:PATH`. The search for `python` now reaches the environment's folder first, and stops there.
2. It sets `$env:VIRTUAL_ENV` to the `.venv` folder's path. Other tools read this to learn that an environment is active.
3. It redefines the function PowerShell calls to draw the prompt, adding `(.venv)`.

Run the `sys.executable` command again with plain `python`: it now prints the `.venv` path. Run `$env:PATH -split ";"` again too, and the first entry is now `.venv\Scripts`.

**If you get a red error ending in "running scripts is disabled on this system":** Windows PowerShell refuses to run any script file (`.ps1`) until you allow it, and `Activate.ps1` is a script. Allow scripts for your own user account:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

`RemoteSigned` means scripts made on this computer may run, and scripts downloaded from the internet must be signed by their publisher. `-Scope CurrentUser` changes the setting for you only, not for other users of the computer, and needs no administrator rights. Then run `Activate.ps1` again.

Activation lasts only for this terminal session, because environment variables belong to a running process: changing `$env:PATH` here changes nothing in other windows or on your system. `deactivate` puts the old `PATH` and prompt back, and closing the terminal discards them. That's why this series' checks never rely on it: they always run `.venv\Scripts\python` by its path. The **Run** button does too: when a project has a `.venv` folder, Run uses its Python.

## Pin the packages

The series uses four packages:

- **NumPy**: arrays of numbers. Q-tables, rewards and probabilities all live in arrays.
- **pygame-ce**: windows, drawing and keyboard input. It's the community edition of pygame, and you still write `import pygame`. It's used here because it's actively maintained and has packages for the newest Pythons. Plain `pygame` 2.6.1 has none for Python 3.14.
- **Gymnasium**: the standard interface for reinforcement learning environments. Its FrozenLake and CartPole draw themselves with pygame.
- **pytest**: runs the test files that check your code.

Create a file named `requirements.txt` in the project folder: right-click in the file tree, or **New file** in the editor. Type this into it:

```text file=requirements.txt
numpy==2.5.3
pygame-ce==2.5.8
gymnasium==1.3.0
pytest==9.1.1
```

`==` **pins** an exact version. Without pins, `pip` installs whatever is newest on the day you run it. Then a project that worked in March can break in June, and two machines can disagree, with no change to your code. With pins, every install of this project gets the same packages, and these four versions were tested together for this series.

### What pip downloads, and why the version of Python matters

pip downloads packages as **wheels**: zip files of ready-to-use files, named after what they were built for. NumPy is written mostly in C, so its compiled code only works on one version of Python and one operating system, and the wheel's name says which:

```text
numpy-2.5.3-cp313-cp313-win_amd64.whl
              │             └ Windows, 64-bit
              └ CPython 3.13
```

pip picks the wheel that matches your Python. If no wheel matches, pip downloads the source code instead and tries to compile it, which needs a C compiler and the libraries the package uses. That usually fails with a long error. This is why the series uses pygame-ce: plain pygame 2.6.1 has wheels up to Python 3.13 and none for 3.14, while pygame-ce 2.5.8 has wheels for 3.12, 3.13 and 3.14. Packages written only in Python, such as Gymnasium, ship one wheel that works everywhere (`py3-none-any`).

Notice what's *not* written: `gymnasium[toy-text]`. Gymnasium's documentation suggests that form to get its drawing code, but those extras require the original `pygame` package. Installing it would write over `pygame-ce`, because both install a folder called `pygame`.

```check
contains requirements.txt "numpy==2.5.3"
contains requirements.txt "pygame-ce==2.5.8"
contains requirements.txt "gymnasium==1.3.0"
contains requirements.txt "pytest==9.1.1"
lacks requirements.txt "toy-text" label="requirements.txt doesn't ask for Gymnasium's pygame extras" -- Plain gymnasium==1.3.0: the [toy-text] extra installs the original pygame over pygame-ce.
```

## Install them

```powershell
.venv\Scripts\python -m pip install -r requirements.txt
```

`-r requirements.txt` means "install everything listed in this file".

`python -m pip` runs pip **inside that particular Python**. pip asks the Python it's running in where its `site-packages` is, and installs there. Started by `.venv\Scripts\python`, that's `.venv\Lib\site-packages`, because of `pyvenv.cfg`. A bare `pip` command is whichever `pip.exe` the `PATH` search finds first, and every `pip.exe` is tied to the Python that installed it, which may not be this one. Getting this wrong is one of the most common Python setup bugs: the install says it worked, and then your program can't find the package.

What pip does, in order:

1. It reads each line and asks the package index (pypi.org) for that exact version.
2. It reads each package's own list of requirements. For example, Gymnasium needs `cloudpickle` and `farama-notifications`, and pytest needs `pluggy` and a few others. It adds these too, choosing versions that satisfy everyone. That's why more than four packages get installed.
3. It downloads the matching wheels (about 25 MB in all) and unzips each one into `site-packages`.
4. It records each installed package in a folder named after it, such as `numpy-2.5.3.dist-info`. Your `doctor.py` will read these in the next lesson.

When it finishes, the last line reads `Successfully installed …` and lists every package it installed.

```check
run ".venv/Scripts/python -c \"import numpy, pygame, gymnasium, pytest\"" label="the four packages import in the project's Python" -- Run .venv\Scripts\python -m pip install -r requirements.txt and wait for "Successfully installed".
run ".venv/Scripts/python -c \"import pygame; assert getattr(pygame, 'IS_CE', False), 'this is the original pygame, not pygame-ce'\"" label="pygame is pygame-ce" -- If you installed plain pygame: .venv\Scripts\python -m pip uninstall -y pygame, then install requirements.txt again.
```

## Keep the environment out of version control

`.venv` holds over 100 MB of installed files that only work on this machine: `pyvenv.cfg` names this computer's Python by its full path, and the launchers in `Scripts` do the same. Nobody copies a `.venv` folder from one machine to another. They copy `requirements.txt` and run the install again. That's the real job of `requirements.txt`: it's a recipe that rebuilds the environment anywhere.

If you use Git for this project, tell it to ignore the environment and the folders that tools generate. Create `.gitignore`:

```text file=.gitignore
.venv/
__pycache__/
.pytest_cache/
```

Before running a `.py` file, Python translates it into **bytecode**: simpler instructions that its interpreter executes. When you import a module, Python saves that bytecode in `__pycache__`, and next time skips the translation if the `.py` file hasn't changed since. `.pytest_cache` is pytest's memory of the last test run, used, for example, by `pytest --lf` to rerun only the tests that failed last time. Both are rebuilt automatically, so neither belongs in version control.

```check
contains .gitignore ".venv/"
```

### What you have

```text
rl-workbench/
  .venv/             this project's Python and packages (never shared)
  requirements.txt   the recipe for .venv (shared)
  .gitignore
```

Next lesson: a script that reports exactly what this machine has (which Python, which packages, which GPU), so you can check any computer you move the project to.
