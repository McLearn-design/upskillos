// What a learner does at each step of "C++ from Zero — Tools of the Trade", for the walkthrough
// test (cppFoundations.desktop.test.js). Keyed "<lesson file name>#<step title>".
//
// By default a step's file (its ```cpp file=... block) is typed in for you, and a `provided`
// file is created as the "Create provided …" button would. An entry adds:
//   run:   commands the lesson tells the learner to type in the terminal
//   files: other files the learner writes
//   wrong: wrong answers, tried on a copy of the project before the step; each lists the
//          indexes of the step's checks that must fail ("fails"). A wrong answer's `files`
//          replace the step's file (the step's own target is not written).

// The configure command differs by platform: on Windows the lesson picks the build tool that
// comes with the compiler (mingw32-make).
const CONFIGURE = process.platform === 'win32'
  ? 'cmake -S . -B build-cmake -G "MinGW Makefiles"'
  : 'cmake -S . -B build-cmake';

const HELLO_FINAL = `#include <iostream>

int main()
{
    std::cout << "Hello C++\\n";
    std::cout << "I compiled this myself\\n";
    return 0;
}
`;

export const WALKTHROUGH = {
  // ── 1. From a text file to a running program ─────────────────────────────
  '01-first-program#Step 2 — Create a source file': {
    files: { 'hello.cpp': '' },
    wrong: [
      { name: 'did nothing', fails: [0] },
      { name: 'named the file hello.txt', files: { 'hello.txt': '' }, fails: [0] },
    ],
  },
  '01-first-program#Step 3 — The smallest program': {
    run: ['g++ -std=c++20 -Wall -Wextra hello.cpp -o hello', './hello'],
    wrong: [
      { name: 'left the file empty', fails: [0, 1] },
      { name: 'forgot the semicolon', files: { 'hello.cpp': 'int main()\n{\n    return 0\n}\n' }, fails: [1, 2] },
      { name: 'called the function Main', files: { 'hello.cpp': 'int Main()\n{\n    return 0;\n}\n' }, fails: [0, 1] },
    ],
  },
  '01-first-program#Step 4 — Say something': {
    wrong: [
      { name: 'forgot #include <iostream>', files: { 'hello.cpp': 'int main()\n{\n    std::cout << "Hello C++\\n";\n    return 0;\n}\n' }, fails: [0, 1] },
      { name: 'printed something else', files: { 'hello.cpp': '#include <iostream>\nint main()\n{\n    std::cout << "Hello World\\n";\n}\n' }, fails: [2] },
    ],
  },
  '01-first-program#Step 5 — Run the compiler one stage at a time': {
    run: [
      'g++ -std=c++20 -E hello.cpp -o hello.ii',
      'g++ -std=c++20 -c hello.cpp -o hello.o',
      'g++ hello.o -o hello',
    ],
    wrong: [
      { name: 'did nothing', fails: [0, 1] },
      { name: 'only compiled in one go', run: ['g++ -std=c++20 hello.cpp -o hello'], fails: [0, 1] },
    ],
  },
  '01-first-program#Step 7 — Challenge: two lines, no warnings': {
    wrong: [
      { name: 'printed both on one line', files: { 'hello.cpp': '#include <iostream>\nint main()\n{\n    std::cout << "Hello C++ I compiled this myself\\n";\n}\n' }, fails: [1] },
      { name: 'left an unused variable (a warning)', files: { 'hello.cpp': HELLO_FINAL.replace('int main()\n{\n', 'int main()\n{\n    int unused = 3;\n') }, fails: [0] },
    ],
  },

  // ── 2. Reading what the compiler tells you ───────────────────────────────
  '02-reading-errors#Step 1 — Build it and read the first error': {
    // A missing file also makes g++ exit with 1, so only the file check can catch this one.
    wrong: [{ name: 'did not create the file', fails: [0] }],
  },
  '02-reading-errors#Step 2 — Fix it, rebuild, read again': {
    wrong: [{ name: 'changed nothing', fails: [0] }],
  },
  '02-reading-errors#Step 3 — Make it build and run': {
    run: ['g++ -std=c++20 -Wall -Wextra greet.cpp -o greet', './greet'],
    wrong: [{ name: 'only fixed the semicolon', fails: [0, 1] }],
  },
  '02-reading-errors#Step 4 — A program that compiles but is wrong': {
    wrong: [{ name: 'did not create the file', fails: [0] }],
  },
  '02-reading-errors#Step 5 — Fix the loop': {
    run: ['g++ -std=c++20 -Wall -Wextra count.cpp -o count', './count'],
    wrong: [
      { name: 'changed nothing', fails: [0] },
      {
        name: 'fixed the warning but not the off-by-one',
        files: { 'count.cpp': '#include <iostream>\n#include <vector>\n\nint main()\n{\n    std::vector<int> scores { 90, 72, 85 };\n    int total = 0;\n    for (std::size_t i = 0; i + 1 <= scores.size() - 1; ++i)\n        total += scores[i];\n    std::cout << "Total: " << total << \'\\n\';\n    return 0;\n}\n' },
        fails: [1],
      },
    ],
  },

  // ── 3. When the compiler is happy but the build fails ────────────────────
  '03-compiler-and-linker#Step 2 — A caller that trusts the promise': {
    run: ['g++ -std=c++20 -c shapes.cpp'],
    wrong: [{ name: 'did not create the file', fails: [0] }],
  },
  '03-compiler-and-linker#Step 3 — Link, and read who complains': {
    run: ['g++ -std=c++20 -c area.cpp'],
    wrong: [{ name: 'did not create the file', fails: [0, 1] }],
  },
  '03-compiler-and-linker#Step 4 — Keep the promise': {
    run: ['g++ -std=c++20 -Wall -Wextra shapes.cpp area.cpp -o shapes', './shapes'],
    wrong: [
      { name: 'still no definition', fails: [0] },
      { name: 'defined it with an int parameter', files: { 'area.cpp': '#include "area.h"\n\ndouble circle_area(int radius)\n{\n    return 3.14159 * radius * radius;\n}\n' }, fails: [0] },
      { name: 'used the wrong formula', files: { 'area.cpp': '#include "area.h"\n\ndouble circle_area(double radius)\n{\n    return 2 * 3.14159265358979 * radius;\n}\n' }, fails: [1] },
    ],
  },

  // ── 4. Building with CMake ───────────────────────────────────────────────
  '04-cmake#Step 2 — Describe the program': {
    wrong: [
      { name: 'did nothing', fails: [0, 1] },
      { name: 'named the target app', files: { 'CMakeLists.txt': 'cmake_minimum_required(VERSION 3.20)\nproject(hello LANGUAGES CXX)\nadd_executable(app hello.cpp)\n' }, fails: [1] },
    ],
  },
  '04-cmake#Step 3 — Configure, then build': {
    run: [CONFIGURE, 'cmake --build build-cmake'],
    wrong: [{ name: 'did not configure', fails: [0, 1] }],
  },
  '04-cmake#Step 4 — Language version and warnings': {
    run: ['cmake --build build-cmake'],
    wrong: [{ name: 'did nothing', fails: [0, 1, 2] }],
  },
  '04-cmake#Step 5 — More than one file: the header': {
    wrong: [{ name: 'did nothing', fails: [0, 1] }],
  },
  '04-cmake#Step 6 — The definition': {
    wrong: [{ name: 'did nothing', fails: [0, 1] }],
  },
  '04-cmake#Step 7 — Use it, and predict the build': {
    wrong: [{ name: 'did nothing', fails: [0, 1] }],
  },
  '04-cmake#Step 8 — Tell CMake about the new file': {
    run: ['cmake --build build-cmake'],
    wrong: [{ name: 'forgot to list greeting.cpp', run: [CONFIGURE], fails: [0, 1] }],
  },

  // ── 5. Your first crash, and the debugger ────────────────────────────────
  '05-first-crash#Step 1 — Run it and watch it fail': {
    run: ['g++ -std=c++20 -g -Wall -Wextra inventory.cpp -o inventory'],
    wrong: [{ name: 'did not create the file', fails: [0, 1] }],
  },
  '05-first-crash#Step 4 — Fix the bug': {
    run: ['g++ -std=c++20 -g -Wall -Wextra inventory.cpp -o inventory', './inventory'],
    wrong: [
      { name: 'changed nothing', fails: [1] },
      {
        name: 'skipped missing items silently',
        editFiles: { 'inventory.cpp': [['        std::cout << name << ": " << item->quantity', '        if (item == nullptr)\n            continue;\n        std::cout << name << ": " << item->quantity']] },
        fails: [1],
      },
    ],
  },
};
