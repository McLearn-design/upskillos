# Using Libraries: Build Things With Other People's Code

## What this series is

You already know a programming language. This series teaches the skill that comes after that: **taking someone else's code and using it to build something real.**

Every post follows the same loop:

1. A problem you want to solve
2. A small attempt at solving it yourself
3. Meeting the library that solves it better
4. Learning the library's mental model, then only the small slice of its API that matters (the 80/20)
5. Typing the code yourself, one piece at a time
6. Breaking it on purpose
7. Refactoring, and asking what the library actually bought you

## How to work through a post

- **You type everything.** Code is delivered in small pieces. Type each one, run it, and look at what happened before moving on. Reading without typing doesn't stick.
- **One growing file per project.** You keep extending the same file (or folder) within a lesson instead of starting fresh each step.
- **Variable names are deliberately long.** If a name doesn't tell you what the value represents, it is taxing your memory for no reason.
- **Challenges come before their solutions.** Solutions live in a separate `solutions/` file. Try first, then look.
- **"Explore" blocks are specific.** They tell you exactly what to copy, what to swap, and what to compare. Do them once you understand the material up to that point, then go further on your own with docs and search.

## Folder layout

```
using-libraries/
    00-series-map.md
    lessons/
        level-0/
            lesson-0.1-dice-roller.md
            lesson-0.2-build-a-tiny-library.md
        level-1/
            lesson-1.1-file-organizer-pathlib.md
            lesson-1.2-config-with-json.md
    solutions/
        solutions-batch-1.md
```

## Terms used throughout

| Term | Meaning |
| --- | --- |
| **Library** | Code someone else wrote, organized around an API, that you call from your own program |
| **API** | The set of names, inputs and outputs a library promises to keep stable |
| **Binding** | A library that lets one language use a library written in another (PySide6 is Python's binding to Qt) |
| **Framework** | Code that calls *you*, and imposes the shape of your application. Not covered here (Django, React, etc.) |
| **Standard library** | Libraries that ship with the language itself |

## Levels (full roadmap)

| Level | Theme | Languages |
| --- | --- | --- |
| 0 | What is a library? | Python |
| 1 | The standard library | Python |
| 2 | Small external libraries (`rich`, `typer`) | Python |
| 3 | HTTP and APIs (`requests`/`httpx`, then `fetch`) | Python, JS |
| 4 | Data (NumPy, Pillow, pandas, Matplotlib) | Python |
| 5 | Visualization (Chart.js, D3) | JS |
| 6 | Browser UI without frameworks | JS |
| 7 | Parsing and validation (Papa Parse, Zod) | JS |
| 8 | Mapping (Leaflet) | JS |
| 9 | 3D (Three.js) | JS |
| 10 | Python GUI (Tkinter, PySide6) | Python |
| 11 | Python plus browser (pywebview) | Python, JS |
| 12 | Databases | Python, JS, C++ |
| 13 | C++ libraries (fmt, JSON, testing, libcurl, Eigen, OpenCV) | C++ |
| 14 | C++ graphics (raylib, SDL) | C++ |
| 15-16 | OpenGL, WebGL | C++, JS |
| 17 | WebAssembly | C++, JS |
| 18 | WebGPU | JS |
| 19 | Vulkan | C++ |
| 20 | Bindings (pybind11) | C++, Python |

## Batch 2

| Lesson | Project | Library | What survives if you throw the library away |
| --- | --- | --- | --- |
| 1.3 | Coffee-shop sales analyzer | `csv`, `collections` | Text to typed values, grouping and aggregating |
| 1.4 | Web-server log parser | `re`, `datetime` | Pattern matching as a language of its own |
| 1.5 | `logstats` command-line tool | `argparse` | Arguments, exit codes, importable vs runnable |
| 1.6 | Community-workshop tool lending | `sqlite3` | SQL, parameters, transactions |

Lesson 1.5 builds on the parser from 1.4. Level 1 will finish with `logging`, `subprocess`, and `urllib`.

## Batch 1

| Lesson | Project | Library | What survives if you throw the library away |
| --- | --- | --- | --- |
| 0.1 | Dice roller | `random` | Reading a function signature, namespaces |
| 0.2 | Your own mini library | none (you write it) | A library is code organized around an API |
| 1.1 | File organizer | `pathlib` | Treating paths as objects, not strings |
| 1.2 | Config tool | `json` | Serialization and defaults |

Lessons 1.1 and 1.2 build on each other: the organizer from 1.1 gets its rules from the config system in 1.2.
