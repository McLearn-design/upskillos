---
title: 0.2 — Know Your Machine
track: Reinforcement Learning in pygame
runtime: python
run: doctor.py
console: true
---

When a program works on one computer and not on another, the cause is usually not the code. It's the machine: a different Python, a missing package, a package at the wrong version, a different graphics card. Professionals don't guess at these. They ask the machine.

In this lesson you write `doctor.py`, a script that reports three things:

- which Python is running, and whether it's the project's environment;
- whether every package in `requirements.txt` is installed at its pinned version;
- which NVIDIA GPU the machine has, if any.

Run it on any computer you move this project to, and you'll know in a second whether that machine is set up the same way.

## Which Python ran this?

Create `doctor.py` and type:

```python file=doctor.py
import sys


def python_report():
    in_venv = sys.prefix != sys.base_prefix
    where = "the project's .venv" if in_venv else "NOT a virtual environment"
    return [
        f"Python {sys.version.split()[0]} at {sys.executable}",
        f"Environment: {where}",
    ]


def main():
    for line in python_report():
        print(line)


if __name__ == "__main__":
    main()
```

- `sys.prefix` is the folder of the Python environment that's running, and `sys.base_prefix` is the folder of the Python it was made from. Python fills both in as it starts, using the `pyvenv.cfg` lookup from lesson 0.1. With no `pyvenv.cfg`, both are the installation folder. With one, `sys.prefix` becomes `.venv` while `sys.base_prefix` keeps the `home` folder. So "different" means "in a virtual environment".
- `sys.version` is a long string such as `3.13.14 (tags/v3.13.14:…) [MSC v.1944 64 bit (AMD64)]`. `.split()` breaks it at spaces, and `[0]` keeps the first piece, the version number.
- `python_report` returns lines instead of printing them. A function that returns its result can be tested: a test can call it and look at what came back. One that prints can only be watched. `main` does the printing.
- `if __name__ == "__main__":` works because every module has a variable `__name__` that Python sets before running the file. For the file named on the command line (`python doctor.py`), Python sets it to the string `"__main__"`. For a file loaded by `import doctor`, it's set to the module's name, `"doctor"`. Importing a module runs the whole file from top to bottom, so without this test the import would print the report. With it, an import only defines the functions. The tests you'll meet next import `doctor`.

Run it both ways in the terminal:

```powershell
.venv\Scripts\python doctor.py
python doctor.py
```

```predict
question: Before you run them: which lines of the report will differ between the two commands?
choice: Only the Environment line
choice: Both lines: the Python path and the Environment line
choice: Neither: it's the same script
answer: Both lines: the Python path and the Environment line
explain: Two different Pythons run the same file. The first line prints `sys.executable`, the path of whichever Python is running, so it shows `.venv\Scripts\python.exe` for one and the system installation for the other. The second line compares `sys.prefix` with `sys.base_prefix`: the `.venv` Python says `Environment: the project's .venv`, and the system Python says `NOT a virtual environment`.

The **Run** button uses the project's `.venv`, so it agrees with the first command.
```

```check
run ".venv/Scripts/python doctor.py" stdout="Environment: the project's .venv" -- Check the in_venv line: inside .venv, sys.prefix and sys.base_prefix are different.
```

## Read the tests first

**This step: create the supplied test file and read it. Don't change `doctor.py` yet.**

Click **Create provided tests/test_doctor.py** above. It describes the next two parts of `doctor.py` before you write them. Writing the tests before the code is a common professional habit, because a test states exactly what "working" means.

```python file=tests/test_doctor.py provided
# Tests for doctor.py. Run them from the project folder with:
#   .venv\Scripts\python -m pytest -q tests/test_doctor.py
from importlib.metadata import version

import doctor


def write_requirements(tmp_path, text):
    path = tmp_path / "requirements.txt"
    path.write_text(text)
    return path


def test_package_at_the_pinned_version_is_ok(tmp_path):
    have = version("pytest")
    path = write_requirements(tmp_path, f"pytest=={have}\n")
    assert doctor.package_report(path) == [f"pytest {have}: ok"]


def test_package_at_another_version_is_a_mismatch(tmp_path):
    have = version("pytest")
    path = write_requirements(tmp_path, "pytest==0.0.1\n")
    assert doctor.package_report(path) == [f"pytest {have}: MISMATCH (want 0.0.1)"]


def test_package_that_is_not_installed_is_missing(tmp_path):
    path = write_requirements(tmp_path, "no-such-package-for-doctor==1.0\n")
    assert doctor.package_report(path) == ["no-such-package-for-doctor: MISSING (want 1.0)"]


def test_package_blank_and_comment_lines_are_skipped(tmp_path):
    path = write_requirements(tmp_path, "# pinned for this series\n\npytest==0.0.1\n")
    assert len(doctor.package_report(path)) == 1


def test_gpu_one_row_is_split_into_three_fields():
    text = "NVIDIA GeForce RTX 5060, 8151 MiB, 12.0\n"
    assert doctor.parse_gpu_rows(text) == [
        {"name": "NVIDIA GeForce RTX 5060", "memory": "8151 MiB", "capability": "12.0"},
    ]


def test_gpu_each_row_is_one_gpu():
    text = "NVIDIA GeForce RTX 3090, 24576 MiB, 8.6\nNVIDIA GeForce RTX 3090, 24576 MiB, 8.6\n"
    assert len(doctor.parse_gpu_rows(text)) == 2


def test_gpu_no_output_means_no_gpus():
    assert doctor.parse_gpu_rows("") == []
```

How to read it, and how pytest runs it:

- **Finding tests.** pytest searches the folders you give it for files named `test_*.py`, imports each one, and collects every function whose name starts with `test_`. Then it calls each function, separately, with no arguments of yours.
- **Pass or fail.** A test passes if its function returns normally. It fails if anything raises an exception. `assert condition, message` raises `AssertionError` when the condition is false, so an `assert` is how a test says "this must be true".
- **Why failures show values.** A plain Python `assert a == b` only says it failed. pytest rewrites the `assert` statements in test files as it imports them, adding code that remembers each side of the comparison. That's how its report can show what went wrong, here for a `package_report` that says `ok` without comparing versions:

  ```text
  E       AssertionError: assert ['pytest 9.1.1: ok'] == ['pytest 9.1....(want 0.0.1)']
  E         At index 0 diff: 'pytest 9.1.1: ok' != 'pytest 9.1.1: MISMATCH (want 0.0.1)'
  ```

  Read it as: your function returned the left side, and the test expected the right.
- **Fixtures.** `tmp_path` is a **fixture**. Before calling a test, pytest reads the names of the function's parameters. For each one, it looks for a fixture with that name, runs it, and passes in the result. The `tmp_path` fixture makes a new, empty temporary folder and returns its path, a new one for each test. The package tests write a small `requirements.txt` there, so they never depend on, or change, your real one.
- `version("pytest")` asks which version of pytest is installed. The first test pins exactly that version, so it expects `ok`. The second pins `0.0.1`, which can't match.
- The GPU tests give `parse_gpu_rows` the text that `nvidia-smi` prints, so they pass on any computer, with or without a GPU.

Run them:

```powershell
.venv\Scripts\python -m pytest -q tests/test_doctor.py
```

Every test fails with `AttributeError: module 'doctor' has no attribute 'package_report'`. That's correct: the functions don't exist yet.

Why `python -m pytest` and not just `pytest`? An `import` searches the folders in the list `sys.path`, in order. Started with `-m`, Python puts the **current folder** first in that list, and the current folder is the project. Started as plain `pytest`, the first entry is the `tests` folder instead, which has no `doctor.py`, so `import doctor` fails with `ModuleNotFoundError`.

```check
file tests/test_doctor.py -- Click "Create provided tests/test_doctor.py" above.
```

## Which packages?

Add `package_report`, and have `main` print both reports:

```python file=doctor.py
import sys
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path


def python_report():
    in_venv = sys.prefix != sys.base_prefix
    where = "the project's .venv" if in_venv else "NOT a virtual environment"
    return [
        f"Python {sys.version.split()[0]} at {sys.executable}",
        f"Environment: {where}",
    ]


def package_report(requirements="requirements.txt"):
    lines = []
    for raw in Path(requirements).read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        name, wanted = line.split("==")
        try:
            have = version(name)
        except PackageNotFoundError:
            lines.append(f"{name}: MISSING (want {wanted})")
            continue
        if have == wanted:
            lines.append(f"{name} {have}: ok")
        else:
            lines.append(f"{name} {have}: MISMATCH (want {wanted})")
    return lines


def main():
    for section in (python_report(), package_report()):
        for line in section:
            print(line)


if __name__ == "__main__":
    main()
```

- `Path(requirements).read_text()` reads the whole file as one string, and `.splitlines()` cuts it into lines. `Path` accepts a file name as a string, or a path object like the ones the tests pass in.
- `.strip()` removes spaces and the line ending at both ends. An empty line becomes `""`, and `not ""` is true, so blank lines are skipped along with `#` comments. `continue` jumps straight to the next line.
- `line.split("==")` turns `"numpy==2.5.3"` into `["numpy", "2.5.3"]`, and the two names on the left unpack the two pieces. This series only pins exact versions, so every line has exactly one `==`. A line such as `numpy>=2` would raise `ValueError` here. Real tools parse the full version syntax: pip uses the `packaging` library to do it.
- `importlib.metadata.version(name)` reads the record pip left behind. As lesson 0.1 showed, pip makes a folder such as `numpy-2.5.3.dist-info` in `site-packages` for every package it installs. `version("numpy")` looks through the `sys.path` folders for a `*.dist-info` folder belonging to `numpy`, opens the `METADATA` file inside, and returns its `Version:` line:

  ```text
  Metadata-Version: 2.4
  Name: numpy
  Version: 2.5.3
  ```

  Names are compared after **normalising**: lower-case, with `-`, `_` and `.` treated the same. That's why `version("pygame-ce")` finds the folder `pygame_ce-2.5.8.dist-info`. If no folder matches, it raises `PackageNotFoundError`, and the `except` turns that into a `MISSING` line instead of a crash.
- Look in `.venv\Lib\site-packages` in the file tree and find the `dist-info` folders. Deleting one would make `doctor.py` report that package as `MISSING`, even though its code is still there. The record and the code are separate files.

Run the tests again, then run `doctor.py`:

```text
Python 3.13.14 at C:\Users\you\Documents\rl-workbench\.venv\Scripts\python.exe
Environment: the project's .venv
numpy 2.5.3: ok
pygame-ce 2.5.8: ok
gymnasium 1.3.0: ok
pytest 9.1.1: ok
```

**Try it:** change `numpy==2.5.3` in `requirements.txt` to `numpy==2.0.0`, but don't run anything yet.

```predict
question: What will the numpy line of the report say now?
choice: numpy 2.0.0: ok
choice: numpy 2.5.3: MISMATCH (want 2.0.0)
choice: numpy: MISSING (want 2.0.0)
answer: numpy 2.5.3: MISMATCH (want 2.0.0)
explain: Editing `requirements.txt` changes what you *want*, not what's installed. `version("numpy")` still reads `numpy-2.5.3.dist-info`, so the installed version is 2.5.3, the wanted one is 2.0.0, and they differ. Only `pip install -r requirements.txt` would change what's installed.

Run `doctor.py` to see it, then put `numpy==2.5.3` back.
```

```check
run ".venv/Scripts/python -m pytest -q tests/test_doctor.py -k package" label="the package tests pass" -- Read the first failing test's assert: pytest prints what package_report returned and what was expected.
run ".venv/Scripts/python doctor.py" stdout="pygame-ce 2.5.8: ok" label="doctor.py reports the installed packages"
```

## Which GPU?

NVIDIA's driver installs a command-line tool, `nvidia-smi`. Try it in the terminal (if it isn't found, your machine has no NVIDIA driver, and that's fine):

```powershell
nvidia-smi --query-gpu=name,memory.total,compute_cap --format=csv,noheader
```

```text
NVIDIA GeForce RTX 5060, 8151 MiB, 12.0
```

`doctor.py` runs that same command and turns its output into report lines. Add the GPU part:

```python file=doctor.py
import shutil
import subprocess
import sys
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path


def python_report():
    in_venv = sys.prefix != sys.base_prefix
    where = "the project's .venv" if in_venv else "NOT a virtual environment"
    return [
        f"Python {sys.version.split()[0]} at {sys.executable}",
        f"Environment: {where}",
    ]


def package_report(requirements="requirements.txt"):
    lines = []
    for raw in Path(requirements).read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        name, wanted = line.split("==")
        try:
            have = version(name)
        except PackageNotFoundError:
            lines.append(f"{name}: MISSING (want {wanted})")
            continue
        if have == wanted:
            lines.append(f"{name} {have}: ok")
        else:
            lines.append(f"{name} {have}: MISMATCH (want {wanted})")
    return lines


def parse_gpu_rows(text):
    gpus = []
    for row in text.strip().splitlines():
        name, memory, capability = [part.strip() for part in row.split(",")]
        gpus.append({"name": name, "memory": memory, "capability": capability})
    return gpus


def gpu_report():
    if shutil.which("nvidia-smi") is None:
        return ["GPU: no NVIDIA driver found"]
    result = subprocess.run(
        ["nvidia-smi", "--query-gpu=name,memory.total,compute_cap", "--format=csv,noheader"],
        capture_output=True,
        text=True,
        timeout=20,
    )
    if result.returncode != 0:
        return [f"GPU: nvidia-smi failed: {result.stderr.strip()}"]
    lines = []
    for gpu in parse_gpu_rows(result.stdout):
        lines.append(f"GPU: {gpu['name']}, {gpu['memory']}, compute capability {gpu['capability']}")
    return lines


def main():
    for section in (python_report(), package_report(), gpu_report()):
        for line in section:
            print(line)


if __name__ == "__main__":
    main()
```

- `shutil.which("nvidia-smi")` repeats the terminal's search from lesson 0.1 in Python. It goes through the folders in `PATH` in order, and in each one tries the name with each extension listed in the environment variable `PATHEXT` (`.COM`, `.EXE`, `.BAT`, …). It returns the first match, such as `C:\Windows\system32\nvidia-smi.EXE`, or `None`. Checking first turns "no NVIDIA driver" into a normal answer instead of an exception.
- `subprocess.run` asks the operating system to start a new **process**, a separately running program, and waits for it to end. The command is a **list**: the program, then each argument as its own item. The list is handed over as it is, so a space inside an argument can't split it in two, and nothing needs quoting.
- Normally a new process prints straight to your terminal. `capture_output=True` instead connects its output to a **pipe**, a channel that Python reads from, and when the process ends, everything it printed is in `result.stdout` (errors in `result.stderr`). What arrives through a pipe is raw bytes. `text=True` decodes them into a string.
- `timeout=20`: if the process is still running after 20 seconds, Python stops it and raises `TimeoutExpired`, so a stuck driver can't freeze `doctor.py` forever.
- `returncode` is the number the program passed back when it exited, its **exit code**. By convention, 0 means success and anything else means failure. The checks in this app read exit codes the same way: a pytest run that exits with 0 passed.
- `parse_gpu_rows`, traced on one line of output:

  ```text
  "NVIDIA GeForce RTX 5060, 8151 MiB, 12.0"
  .split(",")      → ["NVIDIA GeForce RTX 5060", " 8151 MiB", " 12.0"]
  each .strip()    → ["NVIDIA GeForce RTX 5060", "8151 MiB", "12.0"]
  unpacked         → name, memory, capability
  ```

  Without `.strip()`, the memory would be `" 8151 MiB"` with a leading space, and the test comparing it to `"8151 MiB"` would fail.
- The work is split in two on purpose. `gpu_report` talks to the outside world, and `parse_gpu_rows` only turns text into dictionaries. The part that needs a real GPU stays as small as possible, and the part with the logic can be tested anywhere. You'll use this split again and again: keep the code that touches the outside world thin.

```check
run ".venv/Scripts/python -m pytest -q tests/test_doctor.py" label="all doctor tests pass" -- Each line from nvidia-smi is "name, memory, capability": split it at commas and strip the spaces around each part.
run ".venv/Scripts/python doctor.py" stdout="GPU:" label="doctor.py reports a GPU line"
```

## What the GPU line tells you

```text
GPU: NVIDIA GeForce RTX 5060, 8151 MiB, compute capability 12.0
```

- **Memory** (8151 MiB here, about 8 GB) limits how large a model and how many examples at once fit on the card.
- **Compute capability** is NVIDIA's version number for the chip's design. 8.6 is an RTX 30-series card, 8.9 is RTX 40, and 12.0 is RTX 50 (the "Blackwell" design). Software compiled for GPUs, such as PyTorch, must include code for your chip's capability. Blackwell cards need a PyTorch build made for CUDA 12.8 or newer, and a plain `pip install torch` may give you one that can't use the card. When the series reaches PyTorch, this line tells you which build to install.

**For now, the GPU does nothing for you, and that's correct.** Until Chapter 8, everything an agent learns fits in a small table: 25 states × 4 actions is 100 numbers. A GPU wins when millions of numbers are processed at once. For 100, copying them to the card takes longer than the work itself. The GPU becomes worthwhile when the table becomes a neural network.

## Check another machine

To check another computer:

1. Copy the project folder to it, without `.venv`. (A USB stick works, and so does Git: `.gitignore` already leaves `.venv` out.)
2. In that folder, make the environment again and install the recipe:

   ```powershell
   python -m venv .venv
   .venv\Scripts\python -m pip install -r requirements.txt
   ```

3. Run `.venv\Scripts\python doctor.py` and compare its report with this machine's.

If every package line says `ok`, the two machines run this project the same way. The Python line or the GPU line may differ, and now you can see exactly where.
