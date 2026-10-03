---
title: 4 — Building with CMake
track: C++ from Zero — Tools of the Trade
runtime: cpp
reference: optional
---

Typing `g++ hello.cpp -o hello` is fine for one file. Real projects have hundreds of files, libraries, tests, and different compilers on different operating systems. Nobody types those commands by hand: a **build system** does.

**CMake** is the standard build system for C++. You describe *what* to build in a file called `CMakeLists.txt`; CMake generates the actual build commands for the tools on your machine, then runs them.

This lesson continues in the **same folder** as lesson 1, and builds your `hello.cpp`.

## Step 1 — Install CMake

**This step: install one program, then check it from a new terminal.**

CMake isn't part of the compiler, so it needs installing once.

- **Windows** (PowerShell): `winget install Kitware.CMake`, or the installer from cmake.org. Tick "Add CMake to the PATH" if it asks.
- **macOS:** `brew install cmake`
- **Linux:** `sudo apt install cmake` (Debian/Ubuntu) or `sudo dnf install cmake` (Fedora)

A terminal reads PATH when it starts, so **close the terminal and open a new one**, then:

```text
cmake --version
```

```check
run "cmake --version" -- Install CMake, then open a NEW terminal so it picks up the updated PATH.
```

## Step 2 — Describe the program

**This step: create `CMakeLists.txt` (exact capitals) with three lines.**

```cmake
cmake_minimum_required(VERSION 3.20)
project(hello LANGUAGES CXX)

add_executable(hello hello.cpp)
```

- `cmake_minimum_required` names the oldest CMake this file is written for.
- `project` names the project and its language (`CXX` is CMake's name for C++).
- `add_executable(hello hello.cpp)` defines a **target** called `hello`: an executable built from `hello.cpp`.

**Targets** are the central idea in CMake: source files, compiler settings and libraries all attach to a target.

```cmake file=CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(hello LANGUAGES CXX)

add_executable(hello hello.cpp)
```

```check
file CMakeLists.txt -- The name is case-sensitive on macOS and Linux: CMakeLists.txt
contains CMakeLists.txt "add_executable(hello hello.cpp)"
```

## Step 3 — Configure, then build

**This step: two CMake commands in the terminal, then run the result.**

On **Windows**:

```text
cmake -S . -B build-cmake -G "MinGW Makefiles"
```

On **macOS and Linux**:

```text
cmake -S . -B build-cmake
```

Then, on every system:

```text
cmake --build build-cmake
./build-cmake/hello
```

1. **Configure** (`-S . -B build-cmake`): read `CMakeLists.txt` from this folder (`.`), find your compiler, and write a build system into the folder `build-cmake`. On Windows, `-G "MinGW Makefiles"` picks the build tool that comes with the compiler.
2. **Build** (`--build build-cmake`): run that build system, which runs the compiler and linker you already know.

All generated files go into `build-cmake/`. This is an **out-of-source build**: your source folder stays clean, and you can delete `build-cmake/` at any time to start fresh.

Look inside `build-cmake/`: `CMakeCache.txt` records what CMake found, including your compiler's path. To see the exact compiler commands, run `cmake --build build-cmake --verbose`.

```check
file build-cmake/CMakeCache.txt label="build-cmake has been configured" -- Run the configure command for your system first. If Windows says sh.exe is on your PATH, use a terminal without Git's usr\bin folder on PATH.
run "cmake --build build-cmake" -- Read the first error. Configure again if you changed CMakeLists.txt in a way CMake can't follow.
run "./build-cmake/hello" stdout="Hello C++"
```

## Step 4 — Language version and warnings

**This step: add the C++ version and warning settings to `CMakeLists.txt`, then rebuild.**

```cmake
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
```

- Without these, you get whichever C++ version the compiler defaults to, and that differs between machines. `REQUIRED ON` makes configuring fail loudly if the compiler is too old. They go **before** `add_executable`.

```cmake
if(MSVC)
    target_compile_options(hello PRIVATE /W4)
else()
    target_compile_options(hello PRIVATE -Wall -Wextra -Wpedantic)
endif()
```

- Compilers spell warning options differently: Microsoft's compiler (MSVC) uses `/W4`, GCC and Clang use `-Wall -Wextra`. The `if` is your first piece of cross-platform build code.
- `target_compile_options` attaches the options to the `hello` target, so it goes **after** `add_executable`: the target has to exist first.
- `PRIVATE` means "for building this target only".

`cmake --build build-cmake` notices that `CMakeLists.txt` changed and re-configures by itself.

```cmake file=CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(hello LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(hello hello.cpp)

if(MSVC)
    target_compile_options(hello PRIVATE /W4)
else()
    target_compile_options(hello PRIVATE -Wall -Wextra -Wpedantic)
endif()
```

```check
contains CMakeLists.txt "set(CMAKE_CXX_STANDARD 20)"
contains CMakeLists.txt "set(CMAKE_CXX_STANDARD_REQUIRED ON)"
matches CMakeLists.txt "target_compile_options\(hello PRIVATE[^)]*-Wall" label="warnings are on for the hello target"
run "cmake --build build-cmake" -- set(...) lines go before add_executable; target_compile_options goes after it.
```

## Step 5 — More than one file: the header

**This step: create `greeting.h`.**

Real programs are split into many files, as you saw in lesson 3. Move the greeting text into a function of its own: first the declaration.

```cpp file=greeting.h
#pragma once

#include <string>

std::string greeting();
```

- `std::string` is the standard library's text type; `<string>` declares it.
- `greeting()` takes no parameters and returns a `std::string`.

```check
file greeting.h
contains greeting.h "std::string greeting();"
```

## Step 6 — The definition

**This step: create `greeting.cpp`.**

```cpp file=greeting.cpp
#include "greeting.h"

std::string greeting()
{
    return "Hello C++";
}
```

- The file includes its own header, so the compiler checks that the definition matches the declaration.

```check
file greeting.cpp
contains greeting.cpp "#include \"greeting.h\""
```

## Step 7 — Use it, and predict the build

**This step: change `hello.cpp` to call `greeting()`. Then predict what happens before you rebuild.**

```cpp
#include "greeting.h"
```

```cpp
    std::cout << greeting() << '\n';
```

Replace the line that prints `Hello C++` with the `greeting()` line, and add the `#include` at the top.

**Predict:** `CMakeLists.txt` still says `add_executable(hello hello.cpp)`. Will `cmake --build build-cmake` succeed? If not, which tool will complain: the compiler or the linker?

Now rebuild. You've seen this error before: `hello.cpp` compiles, because it has the declaration, but nothing in the build *defines* `greeting()`. CMake doesn't know `greeting.cpp` exists. You'll fix that in the next step.

```cpp file=hello.cpp
#include <iostream>

#include "greeting.h"

int main()
{
    std::cout << greeting() << '\n';
    std::cout << "I compiled this myself\n";
    return 0;
}
```

```check
contains hello.cpp "#include \"greeting.h\""
contains hello.cpp "greeting()"
```

## Step 8 — Tell CMake about the new file

**This step: add `greeting.cpp` to the `hello` target, rebuild and run.**

```cmake
add_executable(hello hello.cpp greeting.cpp)
```

Every `.cpp` file that is part of a program must be listed on its target: that's how CMake knows to compile it and hand its object file to the linker. Headers don't need listing, because `#include` pulls them in.

```text
cmake --build build-cmake
./build-cmake/hello
```

You now have a real, multi-file, cross-platform C++ project. Everything after this point in the course builds this way.

```cmake file=CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(hello LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(hello hello.cpp greeting.cpp)

if(MSVC)
    target_compile_options(hello PRIVATE /W4)
else()
    target_compile_options(hello PRIVATE -Wall -Wextra -Wpedantic)
endif()
```

```check
contains CMakeLists.txt "greeting.cpp" -- List greeting.cpp next to hello.cpp in add_executable.
run "cmake --build build-cmake" -- An undefined reference to greeting() means greeting.cpp isn't on the target yet.
run "./build-cmake/hello" stdout="Hello C++\nI compiled this myself"
```
