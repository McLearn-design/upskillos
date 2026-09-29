# Lesson 12.1: `<fstream>` Fundamentals — Text and Binary

*Phase 12 — Persistence Layer: Files, JSON, XML, CSV, SQLite*

---

## Formalizing what's been sprinkled throughout

`<fstream>` first appeared in Phase 2's checkpoint, reading a CSV of numbers. It reappeared in Phase 5's JSON checkpoint, Phase 9's API-caching exercise. Every use so far has been the same handful of lines, treated as a tool to get to the *real* lesson (building `MyVector`, parsing JSON, running Dijkstra). This phase makes file I/O itself the subject, starting with the two fundamentally different modes every file operation happens in.

## Text mode — what you've already been using

```cpp
#include <fstream>
#include <string>

std::ofstream outFile("data.txt");   // "output file stream" — for WRITING
outFile << "Hello, file!" << std::endl;
outFile << 42 << " " << 3.14 << std::endl;
outFile.close();   // RAII (Lesson 2.5) makes this optional but still good practice — the destructor would handle it too

std::ifstream inFile("data.txt");    // "input file stream" — for READING, exactly Phase 2's pattern
std::string line;
while (std::getline(inFile, line)) {
    std::cout << line << std::endl;
}
inFile.close();
```

`std::ofstream` and `std::ifstream` both inherit from a common base sharing the `<<`/`>>` operators you've used with `std::cout`/`std::cin` since Lesson 0.1 — this is worth stating precisely, since it's a genuinely elegant piece of standard library design: **a file stream and the console are the same kind of object, differing only in where the bytes ultimately go.** `outFile << 42` and `std::cout << 42` use the identical operator, the identical formatting logic (Lesson 2.7's operator overloading, once again) — the only difference is the destination.

## Text mode's hidden cost: everything is converted to and from human-readable characters

```cpp
int value = 12345;
outFile << value;   // writes the CHARACTERS '1', '2', '3', '4', '5' — five bytes, not four
```

An `int` is 4 bytes in memory (Lesson 0.2's `sizeof(int)`), but writing it in text mode converts it to its decimal character representation first — `"12345"` is 5 characters, 5 bytes, and that conversion (and the reverse, parsing text back into a real `int` on read) costs real CPU time. For large amounts of numeric data, this overhead is genuinely significant, and it's the direct motivation for binary mode.

## Binary mode — write the actual bytes, no conversion at all

```cpp
std::ofstream binFile("data.bin", std::ios::binary);   // the std::ios::binary flag changes everything

int value = 12345;
binFile.write(reinterpret_cast<const char*>(&value), sizeof(value));   // write the RAW 4 bytes of value
binFile.close();

std::ifstream binIn("data.bin", std::ios::binary);
int readValue;
binIn.read(reinterpret_cast<char*>(&readValue), sizeof(readValue));    // read the RAW 4 bytes back
std::cout << readValue << std::endl;   // 12345
```

`reinterpret_cast<const char*>(&value)` is worth understanding precisely, not just copying: `&value` gives the address of `value`'s 4 bytes (Lesson 1.2), and `reinterpret_cast` tells the compiler "treat this address as pointing to raw `char` bytes, not as pointing to an `int`" — a genuinely low-level operation, one of the few places in this curriculum where you're explicitly telling the compiler to set aside its normal type-safety reasoning (Lesson 0.2's whole apparatus) and just move bytes. `.write()` then copies exactly `sizeof(value)` bytes — 4, for an `int` — directly to the file, with zero conversion, zero formatting, zero interpretation of what those bytes "mean." This is precisely the same "raw memory, exactly as it sits" idea as Lesson 1.5's array contiguity, now applied to a file instead of RAM.

## Text vs. binary — a real, honest tradeoff, not just "binary is faster"

| | Text mode | Binary mode |
|---|---|---|
| Human-readable | Yes — open it in any text editor | No — appears as garbage in a text editor |
| File size | Larger, generally (each digit is its own byte) | Smaller, generally (fixed-size raw representation) |
| Write/read speed | Slower — conversion overhead | Faster — direct byte copy |
| Portability across different machines/compilers | High — text is text everywhere | **Lower** — see the caveat below |
| Debuggability | High — you can just look at the file | Low — needs a hex viewer or your own program to inspect |

The portability caveat is real and worth stating precisely: an `int`'s exact byte layout (how many bytes, and in what order — **endianness**, a real, non-trivial topic beyond this lesson's scope) can differ between different CPU architectures. A binary file written on one system is not guaranteed to read back correctly on a different kind of system, while a text file's `"12345"` means the same thing everywhere. This is exactly why JSON, XML, and CSV (this phase's next several lessons) are all *text*-based formats — human-readability and cross-system portability, at the cost of the conversion overhead named above.

## Reading and writing binary data for a whole struct at once

```cpp
struct Point {
    int x;
    int y;
};

Point p{3, 4};
binFile.write(reinterpret_cast<const char*>(&p), sizeof(Point));   // writes BOTH fields in one call

Point readPoint;
binIn.read(reinterpret_cast<char*>(&readPoint), sizeof(Point));
```

This works because `Point` (Lesson 2.1's `struct`) is stored as one contiguous block of memory — the "boxes" model from Lesson 0.3, still true, still doing real work this many phases later. Writing `sizeof(Point)` bytes starting at `&p` captures both `x` and `y` in one shot, because they're laid out back-to-back in memory, exactly the way Lesson 4.1's memory-layout diagrams showed for inherited objects. **A genuine, sharp warning:** this technique only works reliably for types with no pointers, no `std::string`, no `std::vector` — any type holding a pointer to heap memory (Lesson 1.4) would have that raw pointer *value* written to the file, which is meaningless once read back into a different program run, since the heap memory it pointed to no longer exists at that address, or may not exist at all. Raw binary struct-dumping is only safe for what's sometimes called a "POD" (plain old data) type — no owned resources, just inline, fixed-size fields.

## Try it yourself

**1. Write the same `int` value to a file in both text and binary mode, then inspect both files' actual byte sizes** (using your operating system's file-size reporting, or `ls -la` on Linux/macOS) — confirm the text version is larger, and reason through exactly why, digit by digit, for a specific number.

**2. Write a `Point` struct to a binary file, read it back, and confirm both fields match exactly.** Then deliberately try the same technique with a struct containing a `std::string` field, and inspect the resulting file's contents (a hex viewer, or simply noting the file's size relative to what you'd expect) to observe that something has gone wrong — the string's actual character data isn't in the file at all, only whatever internal pointer/metadata `std::string` happens to store inline.

**3. Measure the real speed difference.** Write one million random integers to a file in text mode, then write the same million integers to a different file in binary mode, timing both with the `<chrono>` technique from Phase 3. Confirm binary mode is meaningfully faster, and compare the two files' sizes as well.

**4. Write a small "binary record" file format of your own** — a fixed number of `Point` structs written back-to-back — then read them back into a `std::vector<Point>`, confirming the round trip is exact. This is a real, if simplified, preview of what a genuine binary file format (like an image file, or a database's raw storage layer) is conceptually doing.

## What this cost / bought us

Text and binary modes aren't a strict "one is better" choice — they're the opening statement of this entire phase's actual theme, arriving in the very next lessons: **every format from here forward (CSV, JSON, XML) is fundamentally a text-mode convention**, a human-readable, portable way of encoding structured data using exactly the `<<`/`>>` and `std::getline` mechanics this lesson just formalized. Binary mode remains the right tool specifically when raw speed matters more than readability or portability, and knowing precisely when to reach for each is the actual skill this lesson was building toward.

---

**Next up: Lesson 12.2 — CSV parsing, hand-rolled, then with a small library.** The simplest real structured text format, built by hand first — exactly this curriculum's recurring "understand the mechanism before trusting the library" discipline, one more time.
