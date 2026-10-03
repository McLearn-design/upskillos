---
title: 1 — From a Text File to a Running Program
track: C++ from Zero — Tools of the Trade
trackOrder: 4
runtime: cpp
run: hello.cpp
reference: optional
console: true
---

In Python you run `python script.py` and the interpreter reads your code while it runs. C++ works differently: **before** the program can run, a **compiler** translates your source text into machine code and writes it to a separate file, an **executable**. You run that file.

```text
hello.cpp          your source text
   │ preprocessor  pastes in #include files
   │ compiler      translates to machine code
   ▼
hello.o            an object file
   │ linker        joins it with the standard library
   ▼
hello.exe          a program you can run
```

In this lesson you build that pipeline by hand, with the real compiler, in a real terminal. Choose a **new empty folder** for this track in Project Studio: every lesson in the track adds files to the same folder, and the CMake lesson reuses this one's program.

## Step 1 — Find your compiler

**This step: type one command in the terminal. No files yet.**

Open the terminal below the editor and type:

```text
g++ --version
```

- `g++` is the name of the C++ compiler program. Typing a program's name runs it, if the terminal can find it.
- `--version` asks it to print its version and exit, without compiling anything.

**Expected:** a line or two naming the compiler and its version. If the terminal says `g++` is not recognized, click **Install C++ compiler** above the editor, wait for it to finish, close the terminal and open a new one, then try again. You can use a compiler you installed yourself (MSYS2, MinGW, LLVM or Xcode's tools); C++ Studio prefers yours when it works.

```check
run "g++ --version" -- If the terminal can't find g++, use Install C++ compiler above the editor, then open a new terminal.
```

## Step 2 — Create a source file

**This step: create one empty file.**

A C++ program starts life as plain text. By convention C++ source files end in `.cpp`. There is nothing special about the file itself; any editor can write it.

Create a new file named **`hello.cpp`** in the project folder, using the file tree or the terminal (`ni hello.cpp` in PowerShell, `touch hello.cpp` on macOS and Linux). Leave it empty for now.

```check
file hello.cpp -- The file must be called hello.cpp, directly in the project folder.
```

## Step 3 — The smallest program

**This step: type a four-line program into `hello.cpp`, compile it in the terminal, and run it.**

Every C++ program needs exactly one function named `main`. When the operating system starts your program, `main` is where execution begins.

```cpp
int main()
{
    return 0;
}
```

- `int` says `main` gives back a whole number when it finishes: the program's **exit code**.
- `main` is the function's name. The system looks for exactly this name.
- `()` is the parameter list. It's empty: `main` takes no input here.
- `{` and `}` enclose the function's **body**, the statements that run.
- `return 0;` finishes and hands `0` back to the system. `0` means success.
- `;` ends a statement. Python uses line breaks; C++ uses semicolons.

Type it yourself rather than pasting: typing is how the shape of the language gets into your fingers. Save, then in the terminal:

```text
g++ -std=c++20 -Wall -Wextra hello.cpp -o hello
./hello
```

- `-std=c++20` picks the version of the C++ language (there are several: 11, 14, 17, 20, 23).
- `-Wall -Wextra` turn on the compiler's useful warnings.
- `-o hello` names the output file. On Windows the compiler adds `.exe`, giving `hello.exe`.
- `./hello` runs the program in the current folder.

**Predict before you press Enter on `./hello`:** what will the terminal show?

**Observe:** nothing at all. The program ran, returned `0`, and finished. To see the exit code, type `echo $LASTEXITCODE` (PowerShell) or `echo $?` (macOS and Linux). Change `return 0;` to `return 7;`, rebuild, run and look again, then change it back.

```cpp file=hello.cpp
int main()
{
    return 0;
}
```

```check
matches hello.cpp "int\s+main\s*\(" label="hello.cpp defines int main()" -- A function called main that returns int: int main() { ... }
run "g++ -std=c++20 -Wall -Wextra hello.cpp -o hello" -- Read the first error the compiler prints. A missing ; or } is the usual cause.
run "./hello" -- Build it first with the g++ command above.
```

## Step 4 — Say something

**This step: make the program print `Hello C++`.**

```cpp
#include <iostream>
```

- Lines starting with `#` are for the **preprocessor**, which runs before the compiler proper. `#include` means "paste the contents of this file here".
- `<iostream>` is a standard library **header**. It *declares* `std::cout`, so the compiler knows what that name means.

```cpp
    std::cout << "Hello C++\n";
```

- `std::cout` is the *standard output* stream: text sent to it appears in the terminal.
- `std::` says the name lives in the standard library's **namespace**, which keeps its names apart from yours.
- `<<` sends the value on its right into the stream. You can chain it: `std::cout << "a" << "b";`
- `"Hello C++\n"` is a string literal. `\n` is a newline character.

Put the `#include` line at the very top of `hello.cpp`, and the `std::cout` line inside `main`, before `return 0;`. Then rebuild and run in the terminal, or press **Run hello.cpp** above the editor, which builds and runs it for you.

**Make a mistake on purpose:** delete the `#include` line and rebuild. The compiler says `cout` is not a member of `std`: without the header it has never heard of it. Read the message, then put the line back.

```cpp file=hello.cpp
#include <iostream>

int main()
{
    std::cout << "Hello C++\n";
    return 0;
}
```

```check
contains hello.cpp "#include <iostream>"
run "g++ -std=c++20 -Wall -Wextra hello.cpp -o hello" -- Read the first error. Is every statement ended with ; and is the #include at the top?
run "./hello" stdout="Hello C++" -- Capital H, capital C, a space, two plus signs.
```

## Step 5 — Run the compiler one stage at a time

**This step: three commands in the terminal. No file changes.**

So far one `g++` command did everything. The stages are still there; run them separately:

```text
g++ -std=c++20 -E hello.cpp -o hello.ii
g++ -std=c++20 -c hello.cpp -o hello.o
g++ hello.o -o hello
./hello
```

1. `-E` stops after the **preprocessor**: `#include` lines are replaced by the files they name. The result, `hello.ii`, is still C++ text.
2. `-c` **compiles** to an **object file**, `hello.o`: machine code, but not yet a complete program. The code behind `std::cout` isn't in it.
3. The last command **links**: it combines `hello.o` with the C++ standard library, which contains the code behind `std::cout`, into a runnable program.

Normally one command does all three. When a build fails, knowing *which stage* complained tells you where to look. The next two lessons use exactly that.

```check
file hello.ii label="the preprocessed file hello.ii exists" -- Run the -E command in the project folder.
file hello.o label="the object file hello.o exists" -- Run the -c command in the project folder.
run "./hello" stdout="Hello C++"
```

## Step 6 — Why is hello.ii so big?

**This step: open a file and think. No changes.**

Open `hello.ii` in the editor. Your seven-line program is at the very bottom. Scroll up: there are tens of thousands of lines above it.

**Predict before reading on:** where did all those lines come from? Is it debugging information, machine code, the whole standard library, or something else?

### What happened

`#include` is copy and paste. The preprocessor replaced `#include <iostream>` with the entire `iostream` header, and that header includes other headers, which include more. The compiler proper never sees `#include`: it sees one very large file, called a **translation unit**.

That is why big C++ projects care about which headers each file includes, and it's one reason C++20 added **modules**. It isn't machine code (that's `hello.o`), and it isn't the whole library: only the *declarations* in the headers you included. Most of the library's compiled code is in a separate file the linker uses.

## Step 7 — Challenge: two lines, no warnings

**This step: no code is given. Change `hello.cpp` so the program prints exactly:**

```text
Hello C++
I compiled this myself
```

It must build with **no warnings**: the check adds `-Werror`, which turns every warning into an error.

Your `hello` program stays in this folder: in the CMake lesson you'll build it a better way.

```cpp file=hello.cpp
#include <iostream>

int main()
{
    std::cout << "Hello C++\n";
    std::cout << "I compiled this myself\n";
    return 0;
}
```

```check
run "g++ -std=c++20 -Wall -Wextra -Werror hello.cpp -o hello" -- -Werror turns warnings into errors. Read the first one.
run "./hello" stdout="Hello C++\nI compiled this myself" -- Two lines: \n ends a line.
```
