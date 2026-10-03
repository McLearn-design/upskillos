---
title: 3 — Pipes, Standard Streams and Buffering
track: Systems Programming
runtime: cpp
reference: optional
console: true
---

Every process starts with three streams already open:

| Number | Name | In C++ | Normally |
|---|---|---|---|
| 0 | standard input | `std::cin` | the keyboard |
| 1 | standard output | `std::cout` | the terminal |
| 2 | standard error | `std::cerr` | the terminal, too |

The program doesn't know or care where they lead. The shell decides, before the program starts: `prog > out.txt` connects standard output to a file, and `a | b` connects `a`'s standard output to `b`'s standard input through a **pipe**. That's how small programs, each doing one thing, are combined into bigger tools.

This lesson's programs live in `proc/`, beside `helper`.

## Step 1 — A program that reads a stream

**This step: write `proc/sum.cpp`, which reads whole numbers until its input ends and prints how many there were and their total. Then feed it from `helper` through a pipe.**

```text
g++ -std=c++20 -Wall -Wextra proc/sum.cpp -o proc/sum
./proc/sum
```

Type a few numbers, then end the input: Ctrl+D on Linux and macOS, Ctrl+Z then Enter on Windows. It prints `3 numbers, total 6` for `1 2 3`.

- `while (std::cin >> word)` reads words until the input ends. Read *words*, not numbers: `std::cin >> number` simply stops at `x`, and the program would report a wrong total as if nothing were wrong.
- Convert each word with `std::stoll`, which throws for a word that isn't a number. Its second argument reports how many characters it used: `12abc` uses 2, so check that it used them all.
- A word that isn't a whole number prints `sum: not a whole number: x` to `std::cerr`, and `main` returns `1`.

Now connect two programs:

```text
./proc/helper count 100 | ./proc/sum
```

```cpp file=proc/sum.cpp
// sum: reads whole numbers from standard input until it ends,
// then prints how many there were and their total.
#include <iostream>
#include <stdexcept>
#include <string>

int main()
{
    long long total = 0;
    long long count = 0;
    std::string word;
    while (std::cin >> word) {   // false at the end of the input
        try {
            std::size_t used = 0;
            const long long value = std::stoll(word, &used);
            if (used != word.size())
                throw std::invalid_argument(word);
            total += value;
            ++count;
        } catch (const std::exception&) {   // invalid_argument, out_of_range
            std::cerr << "sum: not a whole number: " << word << '\n';
            return 1;
        }
    }
    std::cout << count << " numbers, total " << total << '\n';
}
```

### What happened

`100 numbers, total 5050`. The shell started **both** programs at once, and connected them:

```text
helper count 100 ──stdout──► [ pipe ] ──stdin──► sum
  writes 1..100               a buffer           reads until
  then exits                  in the OS          end of input
```

- Neither program knows about the other. `helper` writes to its standard output; `sum` reads its standard input.
- A pipe holds a limited amount (64 KiB on Linux). When it's full, the writer **waits** until the reader catches up. When it's empty, the reader waits. A fast producer can't run away from a slow consumer.
- `sum` sees the end of its input when `helper` exits and the write end closes. That's what ends `while (std::cin >> word)`.

Try `./proc/helper count 1000000 | ./proc/sum`: a million numbers, and neither program ever holds them all.

```check
run "g++ -std=c++20 -Wall -Wextra proc/sum.cpp -o proc/sum"
run "./proc/sum" stdin="1 2 3\n" stdout="3 numbers, total 6"
run "./proc/helper count 100 | ./proc/sum" stdout="100 numbers, total 5050" label="helper count 100 | sum prints the total"
run "./proc/sum" stdin="1 x\n" exit=1 stderr="sum: not a whole number: x" label="a word that isn't a number: an error and exit code 1" -- Read words, convert each with std::stoll, and return 1 if one fails.
```

## Step 2 — Output in the wrong order

**This step: create the supplied `proc/order.cpp`, build it and run it twice: once on its own, and once into a pipe.**

```text
g++ -std=c++20 -Wall -Wextra proc/order.cpp -o proc/order
./proc/order
./proc/order | ./proc/helper upper
```

`order` prints a line, has `helper` print a line, then prints another. `helper upper` copies its input in capitals, so you can see what came through the pipe.

**Predict:** the code prints `before`, `hello`, `after`, in that order. Will both runs show that order?

```cpp file=proc/order.cpp provided
// order: prints a line, lets a child program print one, then prints another.
#include "process.h"

#include <cstdlib>
#include <iostream>

int main()
{
    std::cout << "parent: before\n";
    std::system(command_line("proc/helper", "say child: hello").c_str());
    std::cout << "parent: after\n";
}
```

### What happened

On its own, the order is right. Through the pipe:

```text
CHILD: HELLO
PARENT: BEFORE
PARENT: AFTER
```

The child's line came **first**, though it was written second. `std::cout` keeps a buffer, like the `ofstream` in lesson 1, and how often it hands the buffer over depends on where the output goes:

| Standard output goes to | The buffer is sent |
|---|---|
| a terminal | at every `'\n'`: you're watching |
| a pipe or a file | only when it's full (a few KiB), or at exit |

Into the pipe, `parent: before` sat in `order`'s buffer. `helper` is a different process, with its own buffer, which it sent when it exited. `order` sent its buffer at the end of `main`.

This is how a build log or a test log gets out of order as soon as it's saved to a file.

```check
run "g++ -std=c++20 -Wall -Wextra proc/order.cpp -o proc/order"
run "./proc/order" stdout="child: hello" label="order and helper both print"
```

## Step 3 — Flush before you hand over

**This step: flush `std::cout` before `order` starts the child, so the output comes out in order through a pipe as well.**

```cpp
std::cout << "parent: before" << std::endl;   // '\n', then flush
```

`std::endl` writes `'\n'` **and flushes** the buffer. `std::cout.flush()` flushes without a newline: that's what `launch` and `minishell` did in lesson 2, for this exact reason.

### `std::endl` or `'\n'`?

A flush is a system call, so flushing after every line throws away what the buffer was for. Writing a million lines with `std::endl` can be many times slower than with `'\n'`.

| Use | When |
|---|---|
| `'\n'` | almost always |
| a flush | when **someone else** is about to write to the same place (before you start a child), or someone is waiting to read it (a prompt, a progress line) |
| `std::cerr` | errors and diagnostics: it isn't buffered at all, so they come out at once |

Rebuild, and run `./proc/order | ./proc/helper upper` again.

```cpp file=proc/order.cpp
// order: prints a line, lets a child program print one, then prints another.
#include "process.h"

#include <cstdlib>
#include <iostream>

int main()
{
    std::cout << "parent: before" << std::endl;   // \n, then flush
    std::system(command_line("proc/helper", "say child: hello").c_str());
    std::cout << "parent: after\n";
}
```

```check
run "g++ -std=c++20 -Wall -Wextra proc/order.cpp -o proc/order"
run "./proc/order" stdout="parent: before\nchild: hello\nparent: after" label="the lines come out in order through a pipe" -- Flush std::cout before calling std::system.
```

## Step 4 — Lost last words

**This step: create the supplied `proc/crash.cpp`, build it, and run it on its own and into a pipe.**

```text
g++ -std=c++20 -Wall -Wextra proc/crash.cpp -o proc/crash
./proc/crash
./proc/crash | ./proc/helper upper
```

`crash` reports progress on each record, and dies suddenly on the fourth. It uses `std::_Exit(3)`, which ends the process on the spot with exit code 3, the way a crash does: no destructors, no cleanup, and no flushing. (`std::exit` *would* flush `std::cout`. A real crash, a segmentation fault or an `abort`, doesn't.)

**Predict:** which progress lines appear in each run?

```cpp file=proc/crash.cpp provided
// crash: reports progress, then dies suddenly on the fourth record.
#include <cstdlib>
#include <iostream>

void process(int record)
{
    if (record == 4)
        std::_Exit(3);   // ends the process at once, like a crash:
                         // no destructors, no flushing
}

int main()
{
    for (int record = 1; record <= 5; ++record) {
        std::cout << "processing record " << record << '\n';
        process(record);
    }
    std::cout << "all records done\n";
}
```

### What happened

On its own you see records 1 to 4. Through the pipe you see **nothing**: the four lines were still in the buffer when the process died, and they died with it.

That's the worst possible place to lose output. The last lines a program writes before it crashes are the ones that tell you where it crashed, and logs are almost always written to files or pipes.

```check
run "g++ -std=c++20 -Wall -Wextra proc/crash.cpp -o proc/crash"
run "./proc/crash" exit=3 label="crash exits with code 3"
```

## Step 5 — Make progress survive a crash

**This step: change `crash.cpp` so that every progress line reaches the pipe before the next record is processed.**

End each progress line with `std::endl`. Each line is then handed to the operating system as soon as it's written, and the operating system keeps it even if the process dies a moment later.

For a log, that cost is worth paying: one system call per line is nothing next to losing the line that explains the crash. Logging libraries flush every line, or every line above a chosen severity.

Writing progress to `std::cerr` instead would also work, since it isn't buffered. But then the progress can't be separated from real errors: choose the stream by what the text *is*, and the flushing to match.

```cpp file=proc/crash.cpp
// crash: reports progress, then dies suddenly on the fourth record.
#include <cstdlib>
#include <iostream>

void process(int record)
{
    if (record == 4)
        std::_Exit(3);   // ends the process at once, like a crash:
                         // no destructors, no flushing
}

int main()
{
    for (int record = 1; record <= 5; ++record) {
        std::cout << "processing record " << record << std::endl;
        process(record);
    }
    std::cout << "all records done\n";
}
```

```check
run "g++ -std=c++20 -Wall -Wextra proc/crash.cpp -o proc/crash"
run "./proc/crash" exit=3 stdout="processing record 3\nprocessing record 4" label="the progress lines reach the pipe before the crash" -- End each progress line with std::endl.
```

## Step 6 — Read a child's output from C++

**This step: write `proc/capture.cpp`, which runs `helper` with `run_capture` and works with what it printed.**

1. Run `helper count 5`, read the numbers out of the captured text with a `std::istringstream`, and add them up.
2. Run `helper fail`, and capture its error message too.

```text
read 5 numbers, total 15, exit 0
captured "helper: failing on purpose", exit 1
```

A pipe from `popen` carries only the child's **standard output**. `helper fail` writes to standard error, which still goes to your terminal, so the captured text is empty. Ask the shell to send standard error to the same place as standard output:

```cpp
run_capture(command_line("proc/helper", "fail 2>&1"))
```

`2>&1` means "stream 2 goes wherever stream 1 goes". It's one of the few things that's written the same way in `cmd.exe` and in POSIX `sh`.

```text
g++ -std=c++20 -Wall -Wextra proc/capture.cpp -o proc/capture
./proc/capture
```

```cpp file=proc/capture.cpp
// capture: runs other programs and reads what they print.
#include "process.h"

#include <iostream>
#include <sstream>
#include <string>

int main()
{
    // Read helper's numbers and add them up ourselves.
    const Captured counted =
        run_capture(command_line("proc/helper", "count 5"));
    std::istringstream lines(counted.output);
    int value = 0, total = 0, how_many = 0;
    while (lines >> value) {
        total += value;
        ++how_many;
    }
    std::cout << "read " << how_many << " numbers, total " << total
              << ", exit " << counted.exit_code << '\n';

    // A pipe only carries stdout. 2>&1 sends stderr into it too:
    // the same words in cmd.exe and in POSIX sh.
    const Captured failed =
        run_capture(command_line("proc/helper", "fail 2>&1"));
    const std::string first_line =
        failed.output.substr(0, failed.output.find('\n'));
    std::cout << "captured \"" << first_line << "\", exit "
              << failed.exit_code << '\n';
}
```

```check
run "g++ -std=c++20 -Wall -Wextra proc/capture.cpp -o proc/capture"
run "./proc/capture" stdout="read 5 numbers, total 15, exit 0"
run "./proc/capture" stdout="captured \"helper: failing on purpose\", exit 1" label="the error message is captured, with exit code 1" -- A pipe only carries standard output: add 2>&1 to the command.
```

## Step 7 — Challenge: keep, a filter

**This step: no code is given. Write `proc/keep.cpp`: it copies to its output only the input lines that contain a given word.**

A **filter** reads standard input and writes standard output, so it fits in the middle of a pipeline. `grep` is the classic one; `keep` is yours.

- `./proc/keep 1` copies every line containing `1`.
- Exit code `0` if any line matched, `1` if none did, `2` with a usage message on standard error if it isn't given exactly one word. (`grep` uses the same codes, so scripts can ask "was it found?".)
- Read whole lines with `std::getline`.

Three programs in one pipeline:

```text
g++ -std=c++20 -Wall -Wextra proc/keep.cpp -o proc/keep
./proc/helper count 20 | ./proc/keep 1 | ./proc/sum
```

must print `11 numbers, total 146`: 1, and 10 to 19.

```cpp file=proc/keep.cpp
// keep: copies only the input lines that contain a word, like grep.
// Exits with 0 if any line matched, 1 if none did, 2 for a usage error.
#include <iostream>
#include <string>

int main(int argc, char* argv[])
{
    if (argc != 2) {
        std::cerr << "usage: keep <word>\n";
        return 2;
    }
    const std::string word = argv[1];
    bool matched = false;
    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.find(word) != std::string::npos) {
            std::cout << line << '\n';
            matched = true;
        }
    }
    return matched ? 0 : 1;
}
```

```check
run "g++ -std=c++20 -Wall -Wextra proc/keep.cpp -o proc/keep"
run "./proc/helper count 20 | ./proc/keep 1 | ./proc/sum" stdout="11 numbers, total 146" label="helper count 20 | keep 1 | sum"
run "./proc/keep x" stdin="a\nb\n" exit=1 label="no line matched: exit code 1"
run "./proc/keep" exit=2 label="no word given: exit code 2"
```
