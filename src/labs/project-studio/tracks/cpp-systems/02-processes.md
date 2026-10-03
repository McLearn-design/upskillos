---
title: 2 — Processes: Exit Codes, the Environment, and a Mini Shell
track: Systems Programming
runtime: cpp
reference: optional
console: true
---

A **process** is a running program. The operating system gives each one its own memory, its own list of open files, its own **current folder**, its own copy of the **environment variables**, and at least one thread. Processes can't see into each other's memory, so they cooperate through a few narrow channels:

```text
parent process                    child process
┌──────────────┐  arguments,      ┌──────────────┐
│  minishell   │  environment ──► │    helper    │
│              │ ◄── exit code,   │              │
└──────────────┘     output       └──────────────┘
```

When your terminal runs `./files/build/du files/sample`, the shell is the parent: it starts `du` as a child, passes it the arguments, waits for it to finish, and gets back an exit code. In this lesson you write a small shell yourself.

The lesson's programs live in `proc/`, and each is built directly with `g++`.

## Step 1 — Exit codes: a program's last word

**This step: create the supplied `proc/helper.cpp`, build it, and run it a few ways.**

`helper` is a small program for your other programs to start. It can print words, exit with any code, show an environment variable, count, and fail on purpose. Lesson 3 uses `count` and `upper`.

```text
g++ -std=c++20 -Wall -Wextra proc/helper.cpp -o proc/helper
./proc/helper say hello world
./proc/helper exit 3
```

`argv` holds the words of the command line: `argv[0]` is the program's own name, `argv[1]` is `say`, and so on. The value `main` returns becomes the process's **exit code**, which the parent reads when the child ends. Your shell keeps the last one:

| Shell | Show the last exit code |
|---|---|
| PowerShell (Windows) | `$LASTEXITCODE` |
| bash or zsh (Linux, macOS) | `echo $?` |

**Predict:** `./proc/helper exit 300`. What exit code does the shell show?

```cpp file=proc/helper.cpp provided
// helper: a small program for other programs to run.
//   helper say <words...>   print the words on one line
//   helper exit <n>         exit with code n
//   helper env <NAME>       print an environment variable, or (unset)
//   helper count <n>        print 1 to n, one number per line
//   helper upper            copy standard input to output in capitals
//   helper fail             print an error message and exit with 1
#include <cctype>
#include <cstdlib>
#include <iostream>
#include <string>

int main(int argc, char* argv[])
{
    const std::string command = argc > 1 ? argv[1] : "";

    if (command == "say") {
        for (int i = 2; i < argc; ++i)
            std::cout << (i > 2 ? " " : "") << argv[i];
        std::cout << '\n';
        return 0;
    }
    if (command == "exit" && argc == 3)
        return std::atoi(argv[2]);   // main's return value is the exit code
    if (command == "env" && argc == 3) {
        const char* value = std::getenv(argv[2]);   // nullptr if unset
        std::cout << (value ? value : "(unset)") << '\n';
        return 0;
    }
    if (command == "count" && argc == 3) {
        const int n = std::atoi(argv[2]);
        for (int i = 1; i <= n; ++i)
            std::cout << i << '\n';
        return 0;
    }
    if (command == "upper") {
        char c;
        while (std::cin.get(c))
            std::cout << static_cast<char>(
                std::toupper(static_cast<unsigned char>(c)));
        return 0;
    }
    if (command == "fail") {
        std::cerr << "helper: failing on purpose\n";
        return 1;
    }

    std::cerr << "usage: helper say|exit|env|count|upper|fail ...\n";
    return 2;
}
```

### What happened

On Windows you see `300`. On Linux and macOS you see `44`: a POSIX exit code is only **8 bits**, so it's `300 % 256`. Portable programs keep their exit codes between 0 and 125:

| Code | Means, by convention |
|---|---|
| `0` | success |
| `1` | failure |
| `2` | wrong usage (bad arguments) |
| `126`, `127` | the shell couldn't run it, or couldn't find it |
| `128 + n` | (POSIX) killed by signal *n*: `139` is a segmentation fault |

Exit codes are how scripts and build tools make decisions: CMake stops when the compiler exits with non-zero, and so do the checks in this lab.

```check
run "g++ -std=c++20 -Wall -Wextra proc/helper.cpp -o proc/helper"
run "./proc/helper say hello world" stdout="hello world"
run "./proc/helper exit 3" exit=3 label="helper exit 3 exits with code 3"
```

## Step 2 — A portable process header

**This step: create `proc/process.h` with three small functions whose code differs between Windows and POSIX.**

Starting programs isn't fully covered by standard C++. The standard has `std::system` and `std::getenv`, and stops there. Linux and macOS share the **POSIX** interface; Windows has its own. The usual way to cope is to keep platform code in one small header, behind `#ifdef _WIN32` (every Windows compiler defines `_WIN32`, on 64-bit systems too), so the rest of the program is plain C++.

| Function | Why it's needed |
|---|---|
| `command_line(program, args)` | `cmd.exe`, the Windows shell `std::system` uses, reads `proc/helper` as the command `proc` with an option `/helper`. `path.make_preferred()` turns it into `proc\helper` on Windows, and changes nothing elsewhere. |
| `exit_code_from(status)` | On Windows, `std::system` returns the exit code. On POSIX it returns a **status** that packs the code with other information: unpack it with `WIFEXITED` and `WEXITSTATUS` from `<sys/wait.h>`. |
| `set_env(name, value)` | POSIX has `setenv`; Windows has `_putenv_s`. |

```cpp
inline int exit_code_from(int status)
{
#ifdef _WIN32
    return status;
#else
    if (WIFEXITED(status))
        return WEXITSTATUS(status);
    return -1;   // killed by a signal: there's no exit code
#endif
}
```

The preprocessor removes the branch for the other system before the compiler sees it, so `WEXITSTATUS` never needs to exist on Windows.

Check the header compiles on its own (ignore a warning about `#pragma once in main file`: it's there because a header is being compiled by itself):

```text
g++ -std=c++20 -Wall -Wextra -fsyntax-only -x c++ proc/process.h
```

`-fsyntax-only` checks the code without producing a file; `-x c++` says the file is C++.

```cpp file=proc/process.h
// process.h: starting other programs, the same way on Windows and POSIX.
#pragma once

#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <string>

#ifndef _WIN32
#include <sys/wait.h>   // WIFEXITED, WEXITSTATUS (POSIX only)
#endif

// A command line for the system's shell: the program's path with this
// system's separators (cmd.exe reads "proc/helper" as "proc" plus an
// option "/helper"), then the arguments.
inline std::string command_line(const std::string& program,
                                const std::string& args = "")
{
    std::string line = std::filesystem::path(program).make_preferred().string();
    if (!args.empty())
        line += " " + args;
    return line;
}

// std::system and pclose return a "status". On Windows that's the exit
// code. On POSIX it packs the exit code with other information.
inline int exit_code_from(int status)
{
#ifdef _WIN32
    return status;
#else
    if (WIFEXITED(status))
        return WEXITSTATUS(status);
    return -1;   // killed by a signal: there's no exit code
#endif
}

// Sets an environment variable for this process and every process it
// starts from now on.
inline void set_env(const std::string& name, const std::string& value)
{
#ifdef _WIN32
    _putenv_s(name.c_str(), value.c_str());
#else
    setenv(name.c_str(), value.c_str(), 1);   // 1: replace an old value
#endif
}
```

```check
matches proc/process.h "#ifdef\s+_WIN32" label="process.h has Windows code behind #ifdef _WIN32"
matches proc/process.h "return\s+WEXITSTATUS\s*\(" label="process.h unpacks the status with WEXITSTATUS"
run "g++ -std=c++20 -Wall -Wextra -fsyntax-only -x c++ proc/process.h" label="process.h compiles"
```

## Step 3 — Start a program: std::system

**This step: write `proc/launch.cpp`, which sets an environment variable and then starts `helper` twice with `std::system`.**

```cpp
int run(const std::string& line)
{
    std::cout.flush();   // lesson 3 explains why this is needed
    const int status = std::system(line.c_str());
    return exit_code_from(status);
}
```

`std::system(line)` hands the line to the system's shell (`/bin/sh` on POSIX, `cmd.exe` on Windows), which starts the program as a **child process**. `std::system` waits until the child has finished, and returns its status.

`main` sets `GREETING` with `set_env`, then runs `helper env GREETING` and `helper exit 7`, printing each exit code:

```text
hello from launch
helper env exited with 0
helper exit 7 exited with 7
```

### Where `hello from launch` comes from

The environment is a list of `NAME=value` strings that every process has. A child starts with a **copy** of its parent's environment, as it is at the moment the child starts. So setting `GREETING` in `launch` is visible to the `helper`s it starts afterwards, but not to your terminal, and not to a child that's already running.

```text
g++ -std=c++20 -Wall -Wextra proc/launch.cpp -o proc/launch
./proc/launch
```

```cpp file=proc/launch.cpp
// launch: start other programs with std::system and report their exit codes.
#include "process.h"

#include <cstdlib>
#include <iostream>

int run(const std::string& line)
{
    std::cout.flush();   // lesson 3 explains why this is needed
    const int status = std::system(line.c_str());
    return exit_code_from(status);
}

int main()
{
    set_env("GREETING", "hello from launch");

    int code = run(command_line("proc/helper", "env GREETING"));
    std::cout << "helper env exited with " << code << '\n';

    code = run(command_line("proc/helper", "exit 7"));
    std::cout << "helper exit 7 exited with " << code << '\n';
}
```

```check
run "g++ -std=c++20 -Wall -Wextra proc/launch.cpp -o proc/launch"
run "./proc/launch" stdout="hello from launch\nhelper env exited with 0" label="the child sees the variable launch set" -- Call set_env before you start helper.
run "./proc/launch" stdout="helper exit 7 exited with 7" -- Convert std::system's status with exit_code_from.
```

## Step 4 — Read a child's output: popen

**This step: add `run_capture` to `proc/process.h`. It runs a command and returns its exit code and everything it printed.**

With `std::system`, the child prints straight to your terminal: your program never sees the text. To read it, connect the child's output to your program with a **pipe**: a buffer inside the operating system with a write end and a read end. `popen` starts the command with its standard output connected to the write end, and gives you the read end as a `FILE*`:

```text
your program ◄── read end ══ pipe ══ write end ◄── child
            fread(...)                    std::cout << ...
```

```cpp
struct Captured {
    int exit_code = -1;
    std::string output;   // everything the command wrote to stdout
};

inline Captured run_capture(const std::string& line)
{
#ifdef _WIN32
    FILE* pipe = _popen(line.c_str(), "r");
#else
    FILE* pipe = popen(line.c_str(), "r");
#endif
    Captured result;
    if (!pipe)
        return result;   // the shell itself couldn't be started

    char buffer[4096];
    std::size_t n;
    while ((n = std::fread(buffer, 1, sizeof buffer, pipe)) > 0)
        result.output.append(buffer, n);   // until the child exits
    // pclose (_pclose on Windows): wait for the child, get its status
}
```

- `"r"` means *you* read: the child's output comes to you.
- `fread` returns `0` at **end of file**, which for a pipe means the child has closed its end: it has exited.
- `pclose` closes the pipe, waits for the child, and returns the same kind of status as `std::system`. Convert it with `exit_code_from`.
- `popen` is POSIX; Windows spells it `_popen` and `_pclose`. The names are the only difference.
- On Windows, `_popen` reads in text mode, so the `\r\n` line endings of a Windows program arrive as `\n`.

Check it compiles, as before.

```cpp file=proc/process.h
// process.h: starting other programs, the same way on Windows and POSIX.
#pragma once

#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <string>

#ifndef _WIN32
#include <sys/wait.h>   // WIFEXITED, WEXITSTATUS (POSIX only)
#endif

// A command line for the system's shell: the program's path with this
// system's separators (cmd.exe reads "proc/helper" as "proc" plus an
// option "/helper"), then the arguments.
inline std::string command_line(const std::string& program,
                                const std::string& args = "")
{
    std::string line = std::filesystem::path(program).make_preferred().string();
    if (!args.empty())
        line += " " + args;
    return line;
}

// std::system and pclose return a "status". On Windows that's the exit
// code. On POSIX it packs the exit code with other information.
inline int exit_code_from(int status)
{
#ifdef _WIN32
    return status;
#else
    if (WIFEXITED(status))
        return WEXITSTATUS(status);
    return -1;   // killed by a signal: there's no exit code
#endif
}

// Sets an environment variable for this process and every process it
// starts from now on.
inline void set_env(const std::string& name, const std::string& value)
{
#ifdef _WIN32
    _putenv_s(name.c_str(), value.c_str());
#else
    setenv(name.c_str(), value.c_str(), 1);   // 1: replace an old value
#endif
}

struct Captured {
    int exit_code = -1;
    std::string output;   // everything the command wrote to stdout
};

// Runs a command line through the system's shell, as std::system does,
// but reads its standard output through a pipe instead of letting it
// go to ours.
inline Captured run_capture(const std::string& line)
{
#ifdef _WIN32
    FILE* pipe = _popen(line.c_str(), "r");
#else
    FILE* pipe = popen(line.c_str(), "r");
#endif
    Captured result;
    if (!pipe)
        return result;   // the shell itself couldn't be started

    char buffer[4096];
    std::size_t n;
    while ((n = std::fread(buffer, 1, sizeof buffer, pipe)) > 0)
        result.output.append(buffer, n);   // until the child closes stdout

#ifdef _WIN32
    result.exit_code = exit_code_from(_pclose(pipe));
#else
    result.exit_code = exit_code_from(pclose(pipe));   // waits for it
#endif
    return result;
}
```

```check
matches proc/process.h "_popen\s*\(" label="process.h uses _popen on Windows"
matches proc/process.h "[^_]popen\s*\(" label="process.h uses popen on POSIX"
matches proc/process.h "pclose\s*\(" label="process.h closes the pipe with pclose"
run "g++ -std=c++20 -Wall -Wextra -fsyntax-only -x c++ proc/process.h" label="process.h compiles"
```

## Step 5 — A mini shell

**This step: write `proc/minishell.cpp`: read a command per line, run it with `run_capture`, and print its output and exit code.**

A shell is a loop: read a line, start the program it names, wait for it, report. Yours prints a `> ` prompt, and `[exit N]` after each command:

```text
> proc/helper say hi there
hi there
[exit 0]
> proc/helper exit 4
[exit 4]
> exit
```

- The first word is the program; the rest are its arguments. Split at the first space, and build the line with `command_line(program, args)` so the path works in `cmd.exe` too.
- `std::getline(std::cin, line)` fails at the **end of input**: Ctrl+D on Linux and macOS, Ctrl+Z then Enter on Windows. Stop then, or when the line is `exit`.
- `std::cout << "> " << std::flush;` shows the prompt *now*: without a newline, the text would otherwise wait in the output buffer.

```text
g++ -std=c++20 -Wall -Wextra proc/minishell.cpp -o proc/minishell
./proc/minishell
```

Your shell starts a second shell (`/bin/sh` or `cmd.exe`) for every line, which then starts the program. That's what `popen` does: real shells start the program directly, with `fork` and `exec` on POSIX or `CreateProcess` on Windows. The extra shell is what lets `run_capture` stay small and portable.

```cpp file=proc/minishell.cpp
// minishell: runs one command per line and reports its exit code.
#include "process.h"

#include <iostream>
#include <string>

int main()
{
    std::string line;
    while (true) {
        std::cout << "> " << std::flush;
        if (!std::getline(std::cin, line) || line == "exit")
            break;   // end of input (Ctrl+D, or Ctrl+Z on Windows)
        if (line.empty())
            continue;

        // The first word is the program; the rest are its arguments.
        const auto space = line.find(' ');
        const std::string program = line.substr(0, space);
        const std::string args =
            space == std::string::npos ? "" : line.substr(space + 1);

        const Captured result = run_capture(command_line(program, args));
        std::cout << result.output << "[exit " << result.exit_code << "]\n";
    }
    std::cout << '\n';
}
```

```check
run "g++ -std=c++20 -Wall -Wextra proc/minishell.cpp -o proc/minishell"
run "./proc/minishell" stdin="proc/helper say hi there\nproc/helper exit 4\n" stdout="hi there\n[exit 0]" label="it runs helper say and reports exit 0"
run "./proc/minishell" stdin="proc/helper say hi there\nproc/helper exit 4\n" stdout="[exit 4]" label="it reports helper exit 4's exit code"
```

## Step 6 — Why doesn't set work?

**This step: try to set an environment variable in your shell. No file changes.**

`helper env` shows a variable's value. Run your shell and type two lines, then `exit`:

```text
./proc/minishell
> set STUDIO_GREETING=hi
> proc/helper env STUDIO_GREETING
```

`set NAME=value` sets a variable in `cmd.exe`, and doesn't fail in `/bin/sh` either.

**Predict:** what does the second line print?

### What happened

It printed `(unset)`. Follow the processes:

```text
minishell ─┬─ shell 1: set STUDIO_GREETING=hi
           │  (sets it in shell 1's own copy;
           │   shell 1 exits, and its copy is gone)
           └─ shell 2: proc/helper env STUDIO_GREETING
              (a fresh copy of minishell's environment)
```

Each line runs in a new child, and a child can only change **its own** copy of the environment. Nothing flows back up to the parent. The same is true of the current folder: a child that changes folder changes only its own.

That's why every shell has **built-in** commands, run inside the shell's own process instead of in a child: `cd`, `export` and `set` in bash, `cd` and `$env:NAME = ...` in PowerShell. They're the only way to change the shell itself.

## Step 7 — Built-in commands

**This step: make `set NAME=value` a built-in command of your shell. The next command must see the variable.**

Before running a line, check its first word. For `set`, change the shell's own environment with `set_env`, print `[exit 0]`, and `continue` to the next line without starting anything:

```cpp
if (program == "set") {   // a built-in: it must change *this* process
    const auto eq = args.find('=');
    if (eq == std::string::npos) {
        std::cout << "set: expected NAME=value\n[exit 2]\n";
        continue;
    }
    set_env(args.substr(0, eq), args.substr(eq + 1));
    std::cout << "[exit 0]\n";
    continue;
}
```

Every command started after that gets a copy of the shell's environment, now with the variable in it.

```cpp file=proc/minishell.cpp
// minishell: runs one command per line and reports its exit code.
#include "process.h"

#include <iostream>
#include <string>

int main()
{
    std::string line;
    while (true) {
        std::cout << "> " << std::flush;
        if (!std::getline(std::cin, line) || line == "exit")
            break;   // end of input (Ctrl+D, or Ctrl+Z on Windows)
        if (line.empty())
            continue;

        // The first word is the program; the rest are its arguments.
        const auto space = line.find(' ');
        const std::string program = line.substr(0, space);
        const std::string args =
            space == std::string::npos ? "" : line.substr(space + 1);

        if (program == "set") {   // a built-in: it must change *this* process
            const auto eq = args.find('=');
            if (eq == std::string::npos) {
                std::cout << "set: expected NAME=value\n[exit 2]\n";
                continue;
            }
            set_env(args.substr(0, eq), args.substr(eq + 1));
            std::cout << "[exit 0]\n";
            continue;
        }

        const Captured result = run_capture(command_line(program, args));
        std::cout << result.output << "[exit " << result.exit_code << "]\n";
    }
    std::cout << '\n';
}
```

```check
contains proc/minishell.cpp "set_env("
run "g++ -std=c++20 -Wall -Wextra proc/minishell.cpp -o proc/minishell"
run "./proc/minishell" stdin="set STUDIO_GREETING=hi\nproc/helper env STUDIO_GREETING\n" stdout="[exit 0]\n> hi\n[exit 0]" label="after set, helper sees the variable" -- The name is the part before =, the value the part after it.
```

## Step 8 — Challenge: cd

**This step: no code is given. Add a built-in `cd <folder>` to your shell.**

- `std::filesystem::current_path(folder, ec)` changes the current folder of the process that calls it. Every later child starts in the new folder.
- A folder that doesn't exist prints `cd: no such folder: <folder>` and `[exit 1]`; success prints `[exit 0]`.
- Use the `error_code` version: a shell shouldn't stop because of a typo.

This input:

```text
cd nowhere
cd proc
./helper say moved
```

must print `cd: no such folder: nowhere`, `[exit 1]`, `[exit 0]`, then `moved` and `[exit 0]`. The last line works because, after `cd proc`, `./helper` is `proc/helper`.

```cpp file=proc/minishell.cpp
// minishell: runs one command per line and reports its exit code.
#include "process.h"

#include <filesystem>
#include <iostream>
#include <string>
#include <system_error>

int main()
{
    std::string line;
    while (true) {
        std::cout << "> " << std::flush;
        if (!std::getline(std::cin, line) || line == "exit")
            break;   // end of input (Ctrl+D, or Ctrl+Z on Windows)
        if (line.empty())
            continue;

        // The first word is the program; the rest are its arguments.
        const auto space = line.find(' ');
        const std::string program = line.substr(0, space);
        const std::string args =
            space == std::string::npos ? "" : line.substr(space + 1);

        if (program == "cd") {    // a built-in too: a child can't move us
            std::error_code ec;
            std::filesystem::current_path(args, ec);
            if (ec)
                std::cout << "cd: no such folder: " << args << "\n[exit 1]\n";
            else
                std::cout << "[exit 0]\n";
            continue;
        }
        if (program == "set") {   // a built-in: it must change *this* process
            const auto eq = args.find('=');
            if (eq == std::string::npos) {
                std::cout << "set: expected NAME=value\n[exit 2]\n";
                continue;
            }
            set_env(args.substr(0, eq), args.substr(eq + 1));
            std::cout << "[exit 0]\n";
            continue;
        }

        const Captured result = run_capture(command_line(program, args));
        std::cout << result.output << "[exit " << result.exit_code << "]\n";
    }
    std::cout << '\n';
}
```

```check
run "g++ -std=c++20 -Wall -Wextra proc/minishell.cpp -o proc/minishell"
run "./proc/minishell" stdin="cd nowhere\ncd proc\n./helper say moved\n" stdout="cd: no such folder: nowhere\n[exit 1]" label="cd to a missing folder fails with exit 1"
run "./proc/minishell" stdin="cd nowhere\ncd proc\n./helper say moved\n" stdout="moved\n[exit 0]" label="after cd proc, ./helper runs from proc/" -- cd must change the shell's own folder: a built-in, with std::filesystem::current_path.
```
