// What a learner does at each step of "C++ Foundations — Thinking in Types", for the walkthrough
// test (cppLanguageBasics.desktop.test.js, using walkCppTrack.js). Keyed "<lesson>#<step title>".
// See tracks/cpp-foundations.walkthrough.js for the format.
import { configure } from '../walkCppTrack.js';

const CALC = configure('calculator');
const WORDS = configure('words');
const GRADES = configure('gradebook');
const INV = configure('inventory');

const main = (body) => `#include <iostream>\n\nint main()\n{\n${body}\n    return 0;\n}\n`;

export const WALKTHROUGH = {
  // ── 1. Values, types and a first calculator ──────────────────────────────
  '01-values-and-input#Step 1 — The calculator\'s build file': {
    wrong: [{ name: 'did not create it', fails: [0] }],
  },
  '01-values-and-input#Step 2 — Variables have types': {
    run: [CALC],
    wrong: [
      { name: 'printed the line as text', files: { 'calculator/main.cpp': main('    std::cout << "7.5 + 2.5 = 10\\n";') }, run: [CALC], fails: [0] },
      { name: 'did not configure', fails: [1, 2] },
    ],
  },
  '01-values-and-input#Step 3 — Reading input': {
    wrong: [
      { name: 'kept the fixed numbers', run: [CALC], fails: [0, 2] },
      {
        name: 'read into int variables',
        files: { 'calculator/main.cpp': main('    int a = 0;\n    int b = 0;\n    std::cin >> a >> b;\n    std::cout << a << " + " << b << " = " << a + b << \'\\n\';') },
        run: [CALC],
        fails: [3],
      },
    ],
  },
  '01-values-and-input#Step 5 — All four operations': {
    wrong: [{
      name: 'used int, so 3 / 4 is 0',
      files: { 'calculator/main.cpp': main('    int a = 0;\n    int b = 0;\n    std::cin >> a >> b;\n    std::cout << a << " - " << b << " = " << a - b << \'\\n\';\n    std::cout << a << " * " << b << " = " << a * b << \'\\n\';\n    std::cout << a << " / " << b << " = " << a / b << \'\\n\';') },
      run: [CALC],
      fails: [3],
    }],
  },
  '01-values-and-input#Step 6 — Challenge: an expression calculator': {
    wrong: [
      { name: 'did not check for zero', typeFile: true, editFiles: { 'calculator/main.cpp': [['        if (b == 0) {\n            std::cout << "Error: division by zero\\n";\n            return 0;\n        }\n', '']] }, run: [CALC], fails: [4] },
      { name: 'kept the four fixed lines', run: [CALC], fails: [1, 2, 3, 4, 5] },
    ],
  },

  // ── 2. Functions, headers and unit tests ─────────────────────────────────
  '02-functions-and-tests#Step 1 — A test framework you can read': { wrong: [{ name: 'did not create it', fails: [0] }] },
  '02-functions-and-tests#Step 2 — The test program\'s main': { wrong: [{ name: 'did not create it', fails: [0] }] },
  '02-functions-and-tests#Step 3 — Declare an interface': {
    wrong: [
      { name: 'did nothing', fails: [0, 1, 2, 3, 4] },
      { name: 'took int parameters', files: { 'calculator/calc.h': '#pragma once\n\ndouble add(int a, int b);\ndouble subtract(int a, int b);\ndouble multiply(int a, int b);\ndouble divide(int a, int b);\n' }, fails: [1, 2, 3, 4] },
    ],
  },
  '02-functions-and-tests#Step 4 — Define them': {
    wrong: [{ name: 'forgot to include calc.h', typeFile: true, editFiles: { 'calculator/calc.cpp': [['#include "calc.h"\n', '']] }, fails: [0] }],
  },
  '02-functions-and-tests#Step 5 — Use them from main': { wrong: [{ name: 'did nothing', fails: [0, 1] }] },
  '02-functions-and-tests#Step 6 — Build the program and its tests': {
    wrong: [{
      name: 'did not add calc.cpp',
      typeFile: true,
      editFiles: { 'calculator/CMakeLists.txt': [['add_executable(calculator main.cpp calc.cpp)', 'add_executable(calculator main.cpp)']] },
      run: [CALC],
      fails: [0, 2],
    }],
  },
  '02-functions-and-tests#Step 7 — Your first test': {
    wrong: [{
      name: 'named the file without _test',
      files: { 'calculator/tests/calc.cpp': '#include "studio_test.hpp"\n#include "calc.h"\nTEST(add_two_positive_numbers) { CHECK_EQ(add(2, 3), 5); }\n' },
      run: [CALC],
      fails: [0, 2],
    }],
  },
  '02-functions-and-tests#Step 8 — Test every function': { wrong: [{ name: 'did nothing', fails: [0, 1, 2] }] },
  '02-functions-and-tests#Step 9 — Red: a test for behaviour that doesn\'t exist yet': {
    wrong: [{ name: 'did nothing', run: [CALC], fails: [0, 2] }],
  },
  '02-functions-and-tests#Step 10 — Green: make divide throw': {
    wrong: [{ name: 'did nothing', run: [CALC], fails: [0, 2] }],
  },
  '02-functions-and-tests#Step 11 — Refactor: catch it in main': {
    wrong: [{
      name: 'removed the zero check but did not catch',
      typeFile: true,
      editFiles: { 'calculator/main.cpp': [['    try {\n', '    {\n'], ['    } catch (const std::invalid_argument& e) {\n        std::cout << "Error: " << e.what() << \'\\n\';\n    }\n', '    }\n']] },
      run: [CALC],
      fails: [0, 3],
    }],
  },

  // ── 3. GCD and LCM ───────────────────────────────────────────────────────
  '03-gcd-and-lcm#Step 1 — The specification arrives as tests': { wrong: [{ name: 'did not create it', fails: [0] }] },
  '03-gcd-and-lcm#Step 2 — Declare gcd': { wrong: [{ name: 'used int', files: { 'calculator/calc.h': '#pragma once\nint gcd(int a, int b);\n' }, fails: [0] }] },
  '03-gcd-and-lcm#Step 3 — Implement gcd': {
    wrong: [{
      name: 'did not handle negative numbers',
      typeFile: true,
      editFiles: { 'calculator/calc.cpp': [['    a = a < 0 ? -a : a;\n    b = b < 0 ? -b : b;\n    while', '    while']] },
      run: [CALC],
      fails: [2, 4],
    }],
  },
  '03-gcd-and-lcm#Step 6 — Write your own tests': {
    wrong: [{ name: 'only one test', files: { 'calculator/tests/lcm_test.cpp': '#include "studio_test.hpp"\n#include "calc.h"\nTEST(lcm_small) { CHECK_EQ(lcm(4, 6), 12); }\n' }, run: [CALC], fails: [1] }],
  },
  '03-gcd-and-lcm#Step 7 — The reviewer\'s tests': {
    wrong: [{
      name: 'multiplied before dividing (overflows)',
      typeFile: true,
      editFiles: { 'calculator/calc.cpp': [['return a / gcd(a, b) * b;', 'return a * b / gcd(a, b);']] },
      run: [CALC],
      fails: [2, 3],
    }],
  },
  // ── 4. Loops ─────────────────────────────────────────────────────────────
  '04-loops#Step 1 — Read until the input runs out': {
    wrong: [{ name: 'read only one number', files: { 'stats/stats.cpp': main('    double value = 0;\n    std::cin >> value;\n    std::cout << "count: 1\\nsum: " << value << \'\\n\';') }, fails: [0, 2] }],
  },
  '04-loops#Step 2 — Smallest, largest, average, and nothing at all': {
    wrong: [
      { name: 'started min at 0', typeFile: true, editFiles: { 'stats/stats.cpp': [['if (count == 0 || value < min)', 'if (value < min)']] }, fails: [1, 3] },
      { name: 'no empty check', typeFile: true, editFiles: { 'stats/stats.cpp': [['    if (count == 0) {\n        std::cout << "no numbers\\n";\n        return 0;\n    }\n', '']] }, fails: [4] },
    ],
  },
  '04-loops#Step 4 — Challenge: a multiplication table': {
    wrong: [
      { name: 'left a space at the end of each line', typeFile: true, editFiles: { 'stats/table.cpp': [['            if (col > 1)\n                std::cout << \' \';\n            std::cout << row * col;', '            std::cout << row * col << \' \';']] }, fails: [1] },
      { name: 'returned 0 for a bad n', typeFile: true, editFiles: { 'stats/table.cpp': [['        return 1;', '        return 0;']] }, fails: [4] },
    ],
  },

  // ── 5. Strings ───────────────────────────────────────────────────────────
  '05-strings#Step 5 — Characters, one at a time': {
    run: [WORDS],
    wrong: [{ name: 'returned the text unchanged', files: { 'words/text.cpp': '#include "text.h"\n\nstd::string to_lower(const std::string& text)\n{\n    return text;\n}\n' }, run: [WORDS], fails: [2, 4] }],
  },
  '05-strings#Step 7 — Splitting text into words': {
    wrong: [{
      name: 'forgot the last word',
      typeFile: true,
      editFiles: { 'words/text.cpp': [['    if (!current.empty())\n        words.push_back(current);\n    return words;', '    return words;']] },
      run: [WORDS],
      fails: [3, 4],
    }],
  },
  '05-strings#Step 8 — A command-line word counter': {
    wrong: [{ name: 'counted words with >> (no lines)', files: { 'words/main.cpp': main('    std::string w;\n    int n = 0;\n    while (std::cin >> w) ++n;\n    std::cout << "words: " << n << \'\\n\';').replace('#include <iostream>', '#include <iostream>\n#include <string>') }, run: [WORDS], fails: [1, 2, 3] }],
  },
  '05-strings#Step 11 — Your own tests': {
    wrong: [{ name: 'only one test', files: { 'words/tests/palindrome_test.cpp': '#include "studio_test.hpp"\n#include "text.h"\nTEST(p) { CHECK(is_palindrome("abba")); }\n' }, run: [WORDS], fails: [0] }],
  },
  '05-strings#Step 12 — The reviewer\'s tests': {
    wrong: [{
      name: 'did not ignore case',
      typeFile: true,
      editFiles: { 'words/text.cpp': [['            letters += static_cast<char>(std::tolower(static_cast<unsigned char>(c)));', '            letters += c;']] },
      run: [WORDS],
      fails: [2, 4],
    }],
  },

  // ── 6. Vectors ───────────────────────────────────────────────────────────
  '06-vectors#Step 4 — A list that grows': {
    run: [GRADES],
    wrong: [{ name: 'printed only the count', files: { 'gradebook/main.cpp': main('    std::cout << "count: 0\\n";') }, run: [GRADES], fails: [0, 3] }],
  },
  '06-vectors#Step 6 — Average, with an algorithm': {
    wrong: [{ name: 'started the sum at 0 (int division)', typeFile: true, editFiles: { 'gradebook/grades.cpp': [['    const double total = std::accumulate(scores.begin(), scores.end(), 0.0);\n    return total / static_cast<double>(scores.size());', '    const int total = std::accumulate(scores.begin(), scores.end(), 0);\n    return total / static_cast<int>(scores.size());']] }, run: [GRADES], fails: [1, 3] }],
  },
  '06-vectors#Step 8 — Median: sorting a copy': {
    wrong: [{ name: 'divided by 2 (int)', typeFile: true, editFiles: { 'gradebook/grades.cpp': [['    return (scores[mid - 1] + scores[mid]) / 2.0;', '    return (scores[mid - 1] + scores[mid]) / 2;']] }, run: [GRADES], fails: [1, 3] }],
  },
  '06-vectors#Step 11 — The full report': {
    wrong: [{ name: 'no empty check', typeFile: true, editFiles: { 'gradebook/main.cpp': [['    if (scores.empty()) {\n        std::cout << "no scores\\n";\n        return 0;\n    }\n', '']] }, run: [GRADES], fails: [2] }],
  },
  '06-vectors#Step 12 — The reviewer\'s tests': {
    wrong: [{
      name: 'used > instead of >= at the boundaries',
      typeFile: true,
      editFiles: { 'gradebook/grades.cpp': [['if (s >= 90)', 'if (s > 90)']] },
      run: [GRADES],
      fails: [2, 3],
    }],
  },

  // ── 7. Structs ───────────────────────────────────────────────────────────
  '07-structs#Step 5 — Implement total_value': {
    run: [INV],
    wrong: [{ name: 'forgot the ; after the struct', files: { 'inventory/inventory.h': '#pragma once\n#include <string>\n#include <vector>\nstruct Item {\n    std::string name;\n    int quantity = 0;\n    double price = 0.0;\n}\ndouble total_value(const std::vector<Item>& items);\n' }, typeFile: true, run: [INV], fails: [1, 2, 3] }],
  },
  '07-structs#Step 7 — The bug that copies': {
    wrong: [{ name: 'did not create the test', fails: [0, 2] }],
  },
  '07-structs#Step 8 — Fix it with a reference': {
    wrong: [{ name: 'did nothing', run: [INV], fails: [0, 2] }],
  },
  '07-structs#Step 12 — Implement find_index': {
    wrong: [{ name: 'returned position 0 when missing', typeFile: true, editFiles: { 'inventory/inventory.cpp': [['    return std::nullopt;', '    return 0;']] }, run: [INV], fails: [1, 2] }],
  },
  '07-structs#Step 16 — The reviewer\'s tests': {
    wrong: [{
      name: 'counted items instead of their quantities',
      typeFile: true,
      editFiles: { 'inventory/inventory.cpp': [['            total += item.quantity;', '            total += 1;']] },
      run: [INV],
      fails: [2, 3],
    }],
  },
};
