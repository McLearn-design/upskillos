// What a learner does at each step of the cpp-systems track, for its walkthrough test (walkCppTrack.js).
// Generated with the lessons; see tracks/cpp-foundations.walkthrough.js for the format.
import { configure } from '../walkCppTrack.js';

export const WALKTHROUGH = {
  "01-files#Step 1 \u2014 The test framework": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-files#Step 2 \u2014 The test runner": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-files#Step 3 \u2014 A file that isn't there yet": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "01-files#Step 4 \u2014 Let the destructor close it": {
    "wrong": [
      {
        "name": "left the binary stream open",
        "files": {
          "files/write_demo.cpp": "// Writes the same text in text mode and in binary mode, and compares sizes.\n#include <filesystem>\n#include <fstream>\n#include <iostream>\n\nnamespace fs = std::filesystem;\n\nint main()\n{\n    fs::create_directories(\"files/out\");\n    const fs::path text_path = \"files/out/notes.txt\";\n    const fs::path binary_path = \"files/out/notes.bin\";\n\n    {\n        std::ofstream out(text_path);           // text mode (the default)\n        out << \"line 1\\nline 2\\n\";\n    }                                           // ~ofstream: flush, close\n\n    std::ofstream out(binary_path, std::ios::binary);\n    out << \"line 1\\nline 2\\n\";\n\n    std::cout << \"text mode: \" << fs::file_size(text_path) << \" bytes\\n\";\n    std::cout << \"binary mode: \" << fs::file_size(binary_path) << \" bytes\\n\";\n}\n",
        },
        "fails": [
          1,
        ],
      },
    ],
  },
  "01-files#Step 5 \u2014 The project's build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-files#Step 6 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-files#Step 7 \u2014 Walk the tree: write du.h": {
    "run": [
      configure("files"),
    ],
    "wrong": [
      {
        "name": "no \"(none)\" for files without an extension",
        "files": {
          "files/du.h": "// du.h: how much space a folder uses, with std::filesystem.\n#pragma once\n\n#include <cstdint>\n#include <filesystem>\n#include <fstream>\n#include <map>\n#include <string>\n#include <system_error>\n\nnamespace fs = std::filesystem;\n\nstruct Usage {\n    std::uintmax_t bytes = 0;    // total size of every regular file\n    std::size_t files = 0;\n    std::size_t folders = 0;     // below root; root itself isn't counted\n    std::map<std::string, std::uintmax_t> by_extension;   // \".txt\" -> bytes\n};\n\n// Reports problems through ec. Never throws a filesystem_error.\ninline Usage summarize(const fs::path& root, std::error_code& ec)\n{\n    Usage usage;\n    if (!fs::is_directory(root, ec)) {\n        if (!ec)   // it exists, but it's not a folder\n            ec = std::make_error_code(std::errc::not_a_directory);\n        return usage;\n    }\n\n    const auto options = fs::directory_options::skip_permission_denied;\n    fs::recursive_directory_iterator it(root, options, ec);\n    for (; !ec && it != fs::recursive_directory_iterator(); it.increment(ec)) {\n        const fs::directory_entry& entry = *it;\n        std::error_code entry_ec;   // a problem with one entry: skip it\n        if (entry.is_directory(entry_ec)) {\n            ++usage.folders;\n            continue;\n        }\n        if (!entry.is_regular_file(entry_ec))\n            continue;               // a broken link, a socket, ...\n        const std::uintmax_t size = entry.file_size(entry_ec);\n        if (entry_ec)\n            continue;               // it vanished, or can't be read\n\n        usage.bytes += size;\n        ++usage.files;\n        std::string ext = entry.path().extension().string();\n        usage.by_extension[ext] += size;\n    }\n    return usage;\n}\n\n// The same, but a problem throws std::filesystem::filesystem_error.\ninline Usage summarize(const fs::path& root)\n{\n    std::error_code ec;\n    Usage usage = summarize(root, ec);\n    if (ec)\n        throw fs::filesystem_error(\"summarize\", root, ec);\n    return usage;\n}\n\n// Writes a file of exactly `bytes` bytes, creating its folders.\ninline void write_bytes(const fs::path& path, std::size_t bytes)\n{\n    fs::create_directories(path.parent_path());\n    std::ofstream out(path, std::ios::binary);\n    out << std::string(bytes, 'x');\n}   // out is closed here, so the file is complete\n\n// A small tree with known sizes: 5750 bytes, 7 files, 4 folders.\ninline void make_sample_tree(const fs::path& root)\n{\n    fs::remove_all(root);\n    write_bytes(root / \"readme.txt\", 120);\n    write_bytes(root / \"LICENSE\", 50);\n    write_bytes(root / \"src\" / \"main.cpp\", 300);\n    write_bytes(root / \"src\" / \"util.cpp\", 200);\n    write_bytes(root / \"src\" / \"util.h\", 80);\n    write_bytes(root / \"assets\" / \"logo.png\", 1000);\n    write_bytes(root / \"assets\" / \"music\" / \"theme.ogg\", 4000);\n    fs::create_directories(root / \"assets\" / \"music\" / \"unused\");\n}\n",
        },
        "run": [
          configure("files"),
        ],
        "fails": [
          2,
        ],
      },
      {
        "name": "the throwing version never throws",
        "files": {
          "files/du.h": "// du.h: how much space a folder uses, with std::filesystem.\n#pragma once\n\n#include <cstdint>\n#include <filesystem>\n#include <fstream>\n#include <map>\n#include <string>\n#include <system_error>\n\nnamespace fs = std::filesystem;\n\nstruct Usage {\n    std::uintmax_t bytes = 0;    // total size of every regular file\n    std::size_t files = 0;\n    std::size_t folders = 0;     // below root; root itself isn't counted\n    std::map<std::string, std::uintmax_t> by_extension;   // \".txt\" -> bytes\n};\n\n// Reports problems through ec. Never throws a filesystem_error.\ninline Usage summarize(const fs::path& root, std::error_code& ec)\n{\n    Usage usage;\n    if (!fs::is_directory(root, ec)) {\n        if (!ec)   // it exists, but it's not a folder\n            ec = std::make_error_code(std::errc::not_a_directory);\n        return usage;\n    }\n\n    const auto options = fs::directory_options::skip_permission_denied;\n    fs::recursive_directory_iterator it(root, options, ec);\n    for (; !ec && it != fs::recursive_directory_iterator(); it.increment(ec)) {\n        const fs::directory_entry& entry = *it;\n        std::error_code entry_ec;   // a problem with one entry: skip it\n        if (entry.is_directory(entry_ec)) {\n            ++usage.folders;\n            continue;\n        }\n        if (!entry.is_regular_file(entry_ec))\n            continue;               // a broken link, a socket, ...\n        const std::uintmax_t size = entry.file_size(entry_ec);\n        if (entry_ec)\n            continue;               // it vanished, or can't be read\n\n        usage.bytes += size;\n        ++usage.files;\n        std::string ext = entry.path().extension().string();\n        usage.by_extension[ext.empty() ? \"(none)\" : ext] += size;\n    }\n    return usage;\n}\n\n// The same, but a problem throws std::filesystem::filesystem_error.\ninline Usage summarize(const fs::path& root)\n{\n    std::error_code ec;\n    Usage usage = summarize(root, ec);\n    return usage;\n}\n\n// Writes a file of exactly `bytes` bytes, creating its folders.\ninline void write_bytes(const fs::path& path, std::size_t bytes)\n{\n    fs::create_directories(path.parent_path());\n    std::ofstream out(path, std::ios::binary);\n    out << std::string(bytes, 'x');\n}   // out is closed here, so the file is complete\n\n// A small tree with known sizes: 5750 bytes, 7 files, 4 folders.\ninline void make_sample_tree(const fs::path& root)\n{\n    fs::remove_all(root);\n    write_bytes(root / \"readme.txt\", 120);\n    write_bytes(root / \"LICENSE\", 50);\n    write_bytes(root / \"src\" / \"main.cpp\", 300);\n    write_bytes(root / \"src\" / \"util.cpp\", 200);\n    write_bytes(root / \"src\" / \"util.h\", 80);\n    write_bytes(root / \"assets\" / \"logo.png\", 1000);\n    write_bytes(root / \"assets\" / \"music\" / \"theme.ogg\", 4000);\n    fs::create_directories(root / \"assets\" / \"music\" / \"unused\");\n}\n",
        },
        "run": [
          configure("files"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "01-files#Step 8 \u2014 The du program": {
    "editFiles": {
      "files/CMakeLists.txt": [
        [
          "    ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)\n",
          "    ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)\n\nadd_executable(du main.cpp)\n",
        ],
      ],
    },
    "wrong": [
      {
        "name": "listed in name order",
        "typeFile": true,
        "editFiles": {
          "files/CMakeLists.txt": [
            [
              "    ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)\n",
              "    ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)\n\nadd_executable(du main.cpp)\n",
            ],
          ],
          "files/main.cpp": [
            [
              "    std::stable_sort(rows.begin(), rows.end(),\n                     [](const auto& a, const auto& b) {\n                         return a.second > b.second;\n                     });\n",
              "",
            ],
          ],
        },
        "run": [
          configure("files"),
        ],
        "fails": [
          3,
        ],
      },
      {
        "name": "printed the path itself",
        "typeFile": true,
        "editFiles": {
          "files/CMakeLists.txt": [
            [
              "    ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)\n",
              "    ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)\n\nadd_executable(du main.cpp)\n",
            ],
          ],
          "files/main.cpp": [
            [
              "<< root.string() <<",
              "<< root <<",
            ],
          ],
        },
        "run": [
          configure("files"),
        ],
        "fails": [
          4,
        ],
      },
    ],
  },
  "01-files#Step 9 \u2014 Your own tests: what is an extension?": {
    "wrong": [
      {
        "name": "one test, and a wrong guess",
        "files": {
          "files/tests/extension_test.cpp": "#include \"studio_test.hpp\"\n\n#include \"du.h\"\n\nTEST(guess)\n{\n    CHECK_EQ(fs::path(\"archive.tar.gz\").extension().string(), \".tar.gz\");\n    CHECK_EQ(fs::path(\".gitignore\").extension().string(), \".gitignore\");\n}\n",
        },
        "run": [
          configure("files"),
        ],
        "fails": [
          0,
          4,
        ],
      },
    ],
  },
  "02-processes#Step 1 \u2014 Exit codes: a program's last word": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
          1,
          2,
        ],
      },
    ],
  },
  "02-processes#Step 2 \u2014 A portable process header": {
    "wrong": [
      {
        "name": "POSIX only",
        "files": {
          "proc/process.h": "// process.h: starting other programs, the same way on Windows and POSIX.\n#pragma once\n\n#include <cstdio>\n#include <cstdlib>\n#include <filesystem>\n#include <string>\n\n#ifndef _WIN32\n#include <sys/wait.h>   // WIFEXITED, WEXITSTATUS (POSIX only)\n#endif\n\n// A command line for the system's shell: the program's path with this\n// system's separators (cmd.exe reads \"proc/helper\" as \"proc\" plus an\n// option \"/helper\"), then the arguments.\ninline std::string command_line(const std::string& program,\n                                const std::string& args = \"\")\n{\n    std::string line = std::filesystem::path(program).make_preferred().string();\n    if (!args.empty())\n        line += \" \" + args;\n    return line;\n}\n\n// std::system and pclose return a \"status\". On Windows that's the exit\n// code. On POSIX it packs the exit code with other information.\ninline int exit_code_from(int status)\n{\n    return status;\n}\n\n// Sets an environment variable for this process and every process it\n// starts from now on.\ninline void set_env(const std::string& name, const std::string& value)\n{\n    setenv(name.c_str(), value.c_str(), 1);\n}\n",
        },
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "02-processes#Step 3 \u2014 Start a program: std::system": {
    "wrong": [
      {
        "name": "set the variable after starting helper",
        "files": {
          "proc/launch.cpp": "// launch: start other programs with std::system and report their exit codes.\n#include \"process.h\"\n\n#include <cstdlib>\n#include <iostream>\n\nint run(const std::string& line)\n{\n    std::cout.flush();   // lesson 3 explains why this is needed\n    const int status = std::system(line.c_str());\n    return exit_code_from(status);\n}\n\nint main()\n{\n    int code = run(command_line(\"proc/helper\", \"env GREETING\"));\n    set_env(\"GREETING\", \"hello from launch\");\n    std::cout << \"helper env exited with \" << code << '\\n';\n\n    code = run(command_line(\"proc/helper\", \"exit 7\"));\n    std::cout << \"helper exit 7 exited with \" << code << '\\n';\n}\n",
        },
        "fails": [
          1,
        ],
      },
    ],
  },
  "02-processes#Step 4 \u2014 Read a child's output: popen": {
    "wrong": [
      {
        "name": "used std::system instead",
        "files": {
          "proc/process.h": "// process.h: starting other programs, the same way on Windows and POSIX.\n#pragma once\n\n#include <cstdio>\n#include <cstdlib>\n#include <filesystem>\n#include <string>\n\n#ifndef _WIN32\n#include <sys/wait.h>   // WIFEXITED, WEXITSTATUS (POSIX only)\n#endif\n\n// A command line for the system's shell: the program's path with this\n// system's separators (cmd.exe reads \"proc/helper\" as \"proc\" plus an\n// option \"/helper\"), then the arguments.\ninline std::string command_line(const std::string& program,\n                                const std::string& args = \"\")\n{\n    std::string line = std::filesystem::path(program).make_preferred().string();\n    if (!args.empty())\n        line += \" \" + args;\n    return line;\n}\n\n// std::system and pclose return a \"status\". On Windows that's the exit\n// code. On POSIX it packs the exit code with other information.\ninline int exit_code_from(int status)\n{\n#ifdef _WIN32\n    return status;\n#else\n    if (WIFEXITED(status))\n        return WEXITSTATUS(status);\n    return -1;   // killed by a signal: there's no exit code\n#endif\n}\n\n// Sets an environment variable for this process and every process it\n// starts from now on.\ninline void set_env(const std::string& name, const std::string& value)\n{\n#ifdef _WIN32\n    _putenv_s(name.c_str(), value.c_str());\n#else\n    setenv(name.c_str(), value.c_str(), 1);   // 1: replace an old value\n#endif\n}\n\nstruct Captured {\n    int exit_code = -1;\n    std::string output;\n};\n\ninline Captured run_capture(const std::string& line)\n{\n    Captured result;\n    result.exit_code = exit_code_from(std::system(line.c_str()));\n    return result;\n}\n",
        },
        "fails": [
          0,
          1,
          2,
        ],
      },
    ],
  },
  "02-processes#Step 5 \u2014 A mini shell": {
    "wrong": [
      {
        "name": "did not report the exit code",
        "files": {
          "proc/minishell.cpp": "// minishell: runs one command per line and reports its exit code.\n#include \"process.h\"\n\n#include <iostream>\n#include <string>\n\nint main()\n{\n    std::string line;\n    while (true) {\n        std::cout << \"> \" << std::flush;\n        if (!std::getline(std::cin, line) || line == \"exit\")\n            break;   // end of input (Ctrl+D, or Ctrl+Z on Windows)\n        if (line.empty())\n            continue;\n\n        // The first word is the program; the rest are its arguments.\n        const auto space = line.find(' ');\n        const std::string program = line.substr(0, space);\n        const std::string args =\n            space == std::string::npos ? \"\" : line.substr(space + 1);\n\n        const Captured result = run_capture(command_line(program, args));\n        std::cout << result.output;\n    }\n    std::cout << '\\n';\n}\n",
        },
        "fails": [
          1,
          2,
        ],
      },
    ],
  },
  "02-processes#Step 7 \u2014 Built-in commands": {
    "wrong": [
      {
        "name": "passed NAME=value as the name",
        "files": {
          "proc/minishell.cpp": "// minishell: runs one command per line and reports its exit code.\n#include \"process.h\"\n\n#include <iostream>\n#include <string>\n\nint main()\n{\n    std::string line;\n    while (true) {\n        std::cout << \"> \" << std::flush;\n        if (!std::getline(std::cin, line) || line == \"exit\")\n            break;   // end of input (Ctrl+D, or Ctrl+Z on Windows)\n        if (line.empty())\n            continue;\n\n        // The first word is the program; the rest are its arguments.\n        const auto space = line.find(' ');\n        const std::string program = line.substr(0, space);\n        const std::string args =\n            space == std::string::npos ? \"\" : line.substr(space + 1);\n\n        if (program == \"set\") {   // a built-in: it must change *this* process\n            const auto eq = args.find('=');\n            if (eq == std::string::npos) {\n                std::cout << \"set: expected NAME=value\\n[exit 2]\\n\";\n                continue;\n            }\n            set_env(args, \"\");\n            std::cout << \"[exit 0]\\n\";\n            continue;\n        }\n\n        const Captured result = run_capture(command_line(program, args));\n        std::cout << result.output << \"[exit \" << result.exit_code << \"]\\n\";\n    }\n    std::cout << '\\n';\n}\n",
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "02-processes#Step 8 \u2014 Challenge: cd": {
    "wrong": [
      {
        "name": "cd runs in a child shell",
        "files": {
          "proc/minishell.cpp": "// minishell: runs one command per line and reports its exit code.\n#include \"process.h\"\n\n#include <iostream>\n#include <string>\n\nint main()\n{\n    std::string line;\n    while (true) {\n        std::cout << \"> \" << std::flush;\n        if (!std::getline(std::cin, line) || line == \"exit\")\n            break;   // end of input (Ctrl+D, or Ctrl+Z on Windows)\n        if (line.empty())\n            continue;\n\n        // The first word is the program; the rest are its arguments.\n        const auto space = line.find(' ');\n        const std::string program = line.substr(0, space);\n        const std::string args =\n            space == std::string::npos ? \"\" : line.substr(space + 1);\n\n        if (program == \"set\") {   // a built-in: it must change *this* process\n            const auto eq = args.find('=');\n            if (eq == std::string::npos) {\n                std::cout << \"set: expected NAME=value\\n[exit 2]\\n\";\n                continue;\n            }\n            set_env(args.substr(0, eq), args.substr(eq + 1));\n            std::cout << \"[exit 0]\\n\";\n            continue;\n        }\n\n        const Captured result = run_capture(command_line(program, args));\n        std::cout << result.output << \"[exit \" << result.exit_code << \"]\\n\";\n    }\n    std::cout << '\\n';\n}\n",
        },
        "fails": [
          1,
          2,
        ],
      },
    ],
  },
  "03-pipes#Step 1 \u2014 A program that reads a stream": {
    "wrong": [
      {
        "name": "read numbers, and stopped quietly at x",
        "files": {
          "proc/sum.cpp": "#include <iostream>\n\nint main()\n{\n    long long total = 0;\n    long long count = 0;\n    long long value;\n    while (std::cin >> value) {\n        total += value;\n        ++count;\n    }\n    std::cout << count << \" numbers, total \" << total << '\\n';\n}\n",
        },
        "fails": [
          3,
        ],
      },
    ],
  },
  "03-pipes#Step 2 \u2014 Output in the wrong order": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "03-pipes#Step 3 \u2014 Flush before you hand over": {
    "wrong": [
      {
        "name": "flushed after the child instead",
        "files": {
          "proc/order.cpp": "// order: prints a line, lets a child program print one, then prints another.\n#include \"process.h\"\n\n#include <cstdlib>\n#include <iostream>\n\nint main()\n{\n    std::cout << \"parent: before\\n\";\n    std::system(command_line(\"proc/helper\", \"say child: hello\").c_str());\n    std::cout << \"parent: after\" << std::endl;\n}\n",
        },
        "fails": [
          1,
        ],
      },
    ],
  },
  "03-pipes#Step 4 \u2014 Lost last words": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "03-pipes#Step 5 \u2014 Make progress survive a crash": {
    "wrong": [
      {
        "name": "still buffered",
        "files": {
          "proc/crash.cpp": "// crash: reports progress, then dies suddenly on the fourth record.\n#include <cstdlib>\n#include <iostream>\n\nvoid process(int record)\n{\n    if (record == 4)\n        std::_Exit(3);   // ends the process at once, like a crash:\n                         // no destructors, no flushing\n}\n\nint main()\n{\n    for (int record = 1; record <= 5; ++record) {\n        std::cout << \"processing record \" << record << '\\n';\n        process(record);\n    }\n    std::cout << \"all records done\\n\";\n}\n",
        },
        "fails": [
          1,
        ],
      },
    ],
  },
  "03-pipes#Step 6 \u2014 Read a child's output from C++": {
    "wrong": [
      {
        "name": "forgot 2>&1",
        "files": {
          "proc/capture.cpp": "// capture: runs other programs and reads what they print.\n#include \"process.h\"\n\n#include <iostream>\n#include <sstream>\n#include <string>\n\nint main()\n{\n    // Read helper's numbers and add them up ourselves.\n    const Captured counted =\n        run_capture(command_line(\"proc/helper\", \"count 5\"));\n    std::istringstream lines(counted.output);\n    int value = 0, total = 0, how_many = 0;\n    while (lines >> value) {\n        total += value;\n        ++how_many;\n    }\n    std::cout << \"read \" << how_many << \" numbers, total \" << total\n              << \", exit \" << counted.exit_code << '\\n';\n\n    // A pipe only carries stdout. 2>&1 sends stderr into it too:\n    // the same words in cmd.exe and in POSIX sh.\n    const Captured failed =\n        run_capture(command_line(\"proc/helper\", \"fail\"));\n    const std::string first_line =\n        failed.output.substr(0, failed.output.find('\\n'));\n    std::cout << \"captured \\\"\" << first_line << \"\\\", exit \"\n              << failed.exit_code << '\\n';\n}\n",
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "03-pipes#Step 7 \u2014 Challenge: keep, a filter": {
    "wrong": [
      {
        "name": "always exits with 0",
        "files": {
          "proc/keep.cpp": "// keep: copies only the input lines that contain a word, like grep.\n// Exits with 0 if any line matched, 1 if none did, 2 for a usage error.\n#include <iostream>\n#include <string>\n\nint main(int argc, char* argv[])\n{\n    if (argc != 2) {\n        std::cerr << \"usage: keep <word>\\n\";\n        return 2;\n    }\n    const std::string word = argv[1];\n    bool matched = false;\n    std::string line;\n    while (std::getline(std::cin, line)) {\n        if (line.find(word) != std::string::npos) {\n            std::cout << line << '\\n';\n            matched = true;\n        }\n    }\n    return 0;\n}\n",
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "04-threads#Step 1 \u2014 Four threads, one sum": {
    "wrong": [
      {
        "name": "forgot to join",
        "files": {
          "threads/split_sum.cpp": "// split_sum: adds 1 + 2 + ... + n on four threads at once.\n#include <iostream>\n#include <thread>\n#include <vector>\n\n// first + (first + 1) + ... + (last - 1)\nlong long sum_range(long long first, long long last)\n{\n    long long total = 0;\n    for (long long i = first; i < last; ++i)\n        total += i;\n    return total;\n}\n\nint main()\n{\n    const long long n = 100'000'000;\n    const int workers = 4;\n    std::vector<long long> partial(workers, 0);   // one slot per thread\n\n    std::vector<std::thread> threads;\n    for (int w = 0; w < workers; ++w) {\n        const long long first = n * w / workers + 1;\n        const long long last = n * (w + 1) / workers + 1;\n        threads.emplace_back([&partial, w, first, last] {\n            partial[w] = sum_range(first, last);   // runs on the new thread\n        });\n    }\n\n    long long total = 0;\n    for (long long p : partial)\n        total += p;\n    std::cout << \"total: \" << total << '\\n';\n    std::cout << \"this machine runs \" << std::thread::hardware_concurrency()\n              << \" threads at once\\n\";\n}\n",
        },
        "fails": [
          1,
        ],
      },
    ],
  },
  "04-threads#Step 2 \u2014 Forgetting join, and std::jthread": {
    "wrong": [
      {
        "name": "kept std::thread and join",
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "04-threads#Step 3 \u2014 The project's build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-threads#Step 4 \u2014 A data race": {
    "run": [
      configure("threads"),
    ],
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          1,
          2,
        ],
      },
    ],
  },
  "04-threads#Step 5 \u2014 Fix it: a mutex": {
    "wrong": [
      {
        "name": "declared a mutex but never locked it",
        "files": {
          "threads/race.cpp": "// race: four threads add 1 to the same counter, one at a time.\n#include <iostream>\n#include <mutex>\n#include <thread>\n#include <vector>\n\nint main()\n{\n    const int workers = 4;\n    const int per_thread = 1'000'000;\n    int counter = 0;          // shared by every thread...\n    std::mutex counter_mutex; // ...and only touched while this is locked\n\n    {\n        std::vector<std::jthread> threads;\n        for (int w = 0; w < workers; ++w) {\n            threads.emplace_back([&counter, &counter_mutex] {\n                for (int i = 0; i < per_thread; ++i) {\n                    ++counter;\n                }   // ~scoped_lock unlocks\n            });\n        }\n    }   // joined\n\n    std::cout << \"expected \" << workers * per_thread\n              << \", got \" << counter << '\\n';\n}\n",
        },
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-threads#Step 6 \u2014 Deadlock": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "04-threads#Step 7 \u2014 The specification: thread-safe accounts": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-threads#Step 8 \u2014 Write bank.h": {
    "wrong": [
      {
        "name": "locked one account at a time",
        "files": {
          "threads/bank.h": "// bank.h: accounts that several threads can use at once.\n#pragma once\n\n#include <mutex>\n#include <stdexcept>\n\nclass Account {\npublic:\n    explicit Account(int balance) : balance_(balance) {}\n\n    int balance() const\n    {\n        std::scoped_lock lock(m_);\n        return balance_;\n    }\n\n    friend void transfer(Account& from, Account& to, int amount);\n\nprivate:\n    mutable std::mutex m_;   // mutable: balance() is const but must lock\n    int balance_;\n};\n\n// Moves amount from one account to the other, all or nothing.\ninline void transfer(Account& from, Account& to, int amount)\n{\n    if (&from == &to)   // locking one mutex twice is undefined behaviour\n        throw std::invalid_argument(\"transfer: same account\");\n\n    std::scoped_lock lock_from(from.m_);\n    std::scoped_lock lock_to(to.m_);\n    if (from.balance_ < amount)\n        throw std::runtime_error(\"transfer: not enough money\");\n    from.balance_ -= amount;\n    to.balance_ += amount;\n}\n",
        },
        "fails": [
          0,
        ],
      },
      {
        "name": "never checked the balance",
        "files": {
          "threads/bank.h": "// bank.h: accounts that several threads can use at once.\n#pragma once\n\n#include <mutex>\n#include <stdexcept>\n\nclass Account {\npublic:\n    explicit Account(int balance) : balance_(balance) {}\n\n    int balance() const\n    {\n        std::scoped_lock lock(m_);\n        return balance_;\n    }\n\n    friend void transfer(Account& from, Account& to, int amount);\n\nprivate:\n    mutable std::mutex m_;   // mutable: balance() is const but must lock\n    int balance_;\n};\n\n// Moves amount from one account to the other, all or nothing.\ninline void transfer(Account& from, Account& to, int amount)\n{\n    if (&from == &to)   // locking one mutex twice is undefined behaviour\n        throw std::invalid_argument(\"transfer: same account\");\n\n    std::scoped_lock lock(from.m_, to.m_);   // both, without deadlock\n    from.balance_ -= amount;\n    to.balance_ += amount;\n}\n",
        },
        "run": [
          configure("threads"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "05-condition-variables#Step 1 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-condition-variables#Step 2 \u2014 Write BlockingQueue": {
    "wrong": [
      {
        "name": "push after close still pushes",
        "files": {
          "threads/blocking_queue.h": "// blocking_queue.h: a queue that threads can share. pop() waits for a\n// value; push() waits for room. close() ends it for everyone.\n#pragma once\n\n#include <condition_variable>\n#include <cstddef>\n#include <deque>\n#include <mutex>\n#include <optional>\n#include <utility>\n\ntemplate <typename T>\nclass BlockingQueue {\npublic:\n    explicit BlockingQueue(std::size_t capacity) : capacity_(capacity) {}\n\n    // Waits while the queue is full. False if the queue was closed.\n    bool push(T value)\n    {\n        std::unique_lock lock(m_);\n        not_full_.wait(lock,\n                       [this] { return items_.size() < capacity_ || closed_; });\n        items_.push_back(std::move(value));\n        not_empty_.notify_one();   // one waiting consumer can go on\n        return true;\n    }\n\n    // Waits while the queue is empty. Nothing once it's closed and empty.\n    std::optional<T> pop()\n    {\n        std::unique_lock lock(m_);\n        ++waiting_;\n        not_empty_.wait(lock, [this] { return !items_.empty() || closed_; });\n        --waiting_;\n        return take_front();\n    }\n\n    // Never waits.\n    std::optional<T> try_pop()\n    {\n        std::scoped_lock lock(m_);\n        return take_front();\n    }\n\n    // No more pushes. Values already queued can still be popped.\n    void close()\n    {\n        {\n            std::scoped_lock lock(m_);\n            closed_ = true;\n        }\n        not_empty_.notify_all();   // every waiter must re-check\n        not_full_.notify_all();\n    }\n\n    std::size_t size() const\n    {\n        std::scoped_lock lock(m_);\n        return items_.size();\n    }\n\n    // How many threads are waiting inside pop() right now.\n    std::size_t waiting() const\n    {\n        std::scoped_lock lock(m_);\n        return waiting_;\n    }\n\nprivate:\n    // Call with m_ locked.\n    std::optional<T> take_front()\n    {\n        if (items_.empty())\n            return std::nullopt;\n        T value = std::move(items_.front());\n        items_.pop_front();\n        not_full_.notify_one();   // one waiting producer can go on\n        return value;\n    }\n\n    mutable std::mutex m_;\n    std::condition_variable not_empty_;\n    std::condition_variable not_full_;\n    std::deque<T> items_;\n    std::size_t capacity_;\n    std::size_t waiting_ = 0;\n    bool closed_ = false;\n};\n",
        },
        "run": [
          configure("threads"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "05-condition-variables#Step 3 \u2014 A bug to diagnose: close": {
    "wrong": [
      {
        "name": "close wakes only one consumer",
        "typeFile": true,
        "editFiles": {
          "threads/blocking_queue.h": [
            [
              "        not_empty_.notify_all();   // every waiter must re-check",
              "        not_empty_.notify_one();",
            ],
          ],
        },
        "run": [
          configure("threads"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "05-condition-variables#Step 4 \u2014 Three stages, two queues": {
    "editFiles": {
      "threads/CMakeLists.txt": [
        [
          "target_link_libraries(threads_tests PRIVATE Threads::Threads)\n",
          "target_link_libraries(threads_tests PRIVATE Threads::Threads)\n\nadd_executable(pipeline pipeline.cpp)\ntarget_link_libraries(pipeline PRIVATE Threads::Threads)\n",
        ],
      ],
    },
    "wrong": [
      {
        "name": "forgot the CMake lines",
        "typeFile": true,
        "run": [
          configure("threads"),
        ],
        "fails": [
          0,
          2,
        ],
      },
    ],
  },
  "05-condition-variables#Step 5 \u2014 Waiting with a time limit": {
    "wrong": [
      {
        "name": "slept for the whole timeout",
        "files": {
          "threads/blocking_queue.h": "// blocking_queue.h: a queue that threads can share. pop() waits for a\n// value; push() waits for room. close() ends it for everyone.\n#pragma once\n\n#include <chrono>\n#include <condition_variable>\n#include <cstddef>\n#include <deque>\n#include <mutex>\n#include <optional>\n#include <thread>\n#include <utility>\n\ntemplate <typename T>\nclass BlockingQueue {\npublic:\n    explicit BlockingQueue(std::size_t capacity) : capacity_(capacity) {}\n\n    // Waits while the queue is full. False if the queue was closed.\n    bool push(T value)\n    {\n        std::unique_lock lock(m_);\n        not_full_.wait(lock,\n                       [this] { return items_.size() < capacity_ || closed_; });\n        if (closed_)\n            return false;\n        items_.push_back(std::move(value));\n        not_empty_.notify_one();   // one waiting consumer can go on\n        return true;\n    }\n\n    // Waits while the queue is empty. Nothing once it's closed and empty.\n    std::optional<T> pop()\n    {\n        std::unique_lock lock(m_);\n        ++waiting_;\n        not_empty_.wait(lock, [this] { return !items_.empty() || closed_; });\n        --waiting_;\n        return take_front();\n    }\n\n    // Like pop(), but gives up after the timeout and returns nothing.\n    template <typename Rep, typename Period>\n    std::optional<T> pop_for(std::chrono::duration<Rep, Period> timeout)\n    {\n        std::this_thread::sleep_for(timeout);\n        std::scoped_lock lock(m_);\n        return take_front();\n    }\n\n    // Never waits.\n    std::optional<T> try_pop()\n    {\n        std::scoped_lock lock(m_);\n        return take_front();\n    }\n\n    // No more pushes. Values already queued can still be popped.\n    void close()\n    {\n        {\n            std::scoped_lock lock(m_);\n            closed_ = true;\n        }\n        not_empty_.notify_all();   // every waiter must re-check\n        not_full_.notify_all();\n    }\n\n    std::size_t size() const\n    {\n        std::scoped_lock lock(m_);\n        return items_.size();\n    }\n\n    // How many threads are waiting inside pop() right now.\n    std::size_t waiting() const\n    {\n        std::scoped_lock lock(m_);\n        return waiting_;\n    }\n\nprivate:\n    // Call with m_ locked.\n    std::optional<T> take_front()\n    {\n        if (items_.empty())\n            return std::nullopt;\n        T value = std::move(items_.front());\n        items_.pop_front();\n        not_full_.notify_one();   // one waiting producer can go on\n        return value;\n    }\n\n    mutable std::mutex m_;\n    std::condition_variable not_empty_;\n    std::condition_variable not_full_;\n    std::deque<T> items_;\n    std::size_t capacity_;\n    std::size_t waiting_ = 0;\n    bool closed_ = false;\n};\n",
        },
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-condition-variables#Step 6 \u2014 Your own tests for pop_for": {
    "wrong": [
      {
        "name": "only single-thread tests",
        "files": {
          "threads/tests/pop_for_test.cpp": "#include \"studio_test.hpp\"\n\n#include \"blocking_queue.h\"\n\n#include <chrono>\n\nusing namespace std::chrono_literals;\nusing Clock = std::chrono::steady_clock;\n\nTEST(pop_for_returns_a_value_that_is_already_there)\n{\n    BlockingQueue<int> q(4);\n    q.push(5);\n    CHECK_EQ(q.pop_for(10s).value_or(-1), 5);\n}\n\n// wait_for with a predicate only gives up once the time has passed,\n// measured on a steady clock, so this holds on any machine.\nTEST(pop_for_on_an_empty_queue_gives_up_after_the_timeout)\n{\n    BlockingQueue<int> q(4);\n    const auto start = Clock::now();\n    CHECK(!q.pop_for(20ms).has_value());\n    CHECK(Clock::now() - start >= 20ms);\n}\n\nTEST(pop_for_on_a_closed_queue_does_not_wait)\n{\n    BlockingQueue<int> q(4);\n    q.close();\n    const auto start = Clock::now();\n    CHECK(!q.pop_for(30s).has_value());\n    CHECK(Clock::now() - start < 10s);   // generous: it should be instant\n}\n\n",
        },
        "run": [
          configure("threads"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "06-atomics#Step 1 \u2014 An atomic counter": {
    "wrong": [
      {
        "name": "counter = counter + 1",
        "files": {
          "threads/race.cpp": "// race: four threads add 1 to the same atomic counter.\n#include <atomic>\n#include <iostream>\n#include <thread>\n#include <vector>\n\nint main()\n{\n    const int workers = 4;\n    const int per_thread = 1'000'000;\n    std::atomic<int> counter = 0;   // shared, and safe to share\n\n    {\n        std::vector<std::jthread> threads;\n        for (int w = 0; w < workers; ++w) {\n            threads.emplace_back([&counter] {\n                for (int i = 0; i < per_thread; ++i)\n                    counter = counter + 1;\n            });\n        }\n    }   // joined\n\n    std::cout << \"expected \" << workers * per_thread\n              << \", got \" << counter << '\\n';\n}\n",
        },
        "fails": [
          2,
        ],
      },
      {
        "name": "kept the mutex as well",
        "files": {
          "threads/race.cpp": "// race: four threads add 1 to the same counter, one at a time.\n#include <atomic>\n#include <iostream>\n#include <mutex>\n#include <thread>\n#include <vector>\n\nint main()\n{\n    const int workers = 4;\n    const int per_thread = 1'000'000;\n    std::atomic<int> counter = 0;          // shared by every thread...\n    std::mutex counter_mutex; // ...and only touched while this is locked\n\n    {\n        std::vector<std::jthread> threads;\n        for (int w = 0; w < workers; ++w) {\n            threads.emplace_back([&counter, &counter_mutex] {\n                for (int i = 0; i < per_thread; ++i) {\n                    std::scoped_lock lock(counter_mutex);   // waits its turn\n                    ++counter;\n                }   // ~scoped_lock unlocks\n            });\n        }\n    }   // joined\n\n    std::cout << \"expected \" << workers * per_thread\n              << \", got \" << counter << '\\n';\n}\n",
        },
        "fails": [
          1,
        ],
      },
    ],
  },
  "06-atomics#Step 2 \u2014 Publishing data: acquire and release": {
    "wrong": [
      {
        "name": "relaxed on both sides",
        "files": {
          "threads/publish.cpp": "// publish: one thread prepares data, then raises a flag; another waits\n// for the flag, then reads the data.\n#include <atomic>\n#include <iostream>\n#include <string>\n#include <thread>\n\nstd::string message;              // plain data: not atomic\nint answer = 0;\nstd::atomic<bool> ready = false;  // the flag that publishes them\n\nint main()\n{\n    std::jthread writer([] {\n        message = \"hello from the writer\";\n        answer = 42;\n        ready.store(true, std::memory_order_relaxed);   // publish\n    });\n\n    std::jthread reader([] {\n        while (!ready.load(std::memory_order_relaxed))   // wait for it\n            std::this_thread::yield();\n        // Everything the writer did before its release store is\n        // visible here, after the acquire load that saw true.\n        std::cout << message << \", answer \" << answer << '\\n';\n    });\n}\n",
        },
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "06-atomics#Step 3 \u2014 Compare and exchange: the specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-atomics#Step 4 \u2014 Write update_max": {
    "wrong": [
      {
        "name": "equal counts as larger",
        "files": {
          "threads/atomic_max.h": "// atomic_max.h: lock-free updates built on compare_exchange.\n#pragma once\n\n#include <atomic>\n\n// Raises current to value if value is larger, even while other threads\n// do the same. Returns true if this call changed it.\ninline bool update_max(std::atomic<int>& current, int value)\n{\n    int seen = current.load();\n    while (seen <= value) {\n        // If current still holds seen, store value and return true.\n        // If not, another thread got there first: seen is reloaded with\n        // what current holds now, and the loop checks again.\n        if (current.compare_exchange_weak(seen, value))\n            return true;\n    }\n    return false;   // current was already at least value\n}\n",
        },
        "run": [
          configure("threads"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "06-atomics#Step 5 \u2014 A spin lock: the specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-atomics#Step 6 \u2014 Exercise: write SpinLock": {
    "wrong": [
      {
        "name": "try_lock returns the old value",
        "files": {
          "threads/spin_lock.h": "// spin_lock.h: a lock that waits by spinning instead of sleeping.\n// For learning. In real code use std::mutex: it spins briefly, then\n// sleeps, and it's what you should measure against.\n#pragma once\n\n#include <atomic>\n#include <thread>\n\nclass SpinLock {\npublic:\n    void lock()\n    {\n        // exchange returns the old value: true means someone else holds it.\n        while (locked_.exchange(true, std::memory_order_acquire)) {\n            // Spin on a plain load until it looks free, so the waiting\n            // threads only read the cache line instead of writing it.\n            while (locked_.load(std::memory_order_relaxed))\n                std::this_thread::yield();\n        }\n    }\n\n    bool try_lock()\n    {\n        return locked_.exchange(true, std::memory_order_acquire);\n    }\n\n    void unlock()\n    {\n        locked_.store(false, std::memory_order_release);\n    }\n\nprivate:\n    std::atomic<bool> locked_ = false;\n};\n",
        },
        "run": [
          configure("threads"),
        ],
        "fails": [
          3,
        ],
      },
    ],
  },
  "07-thread-pool#Step 1 \u2014 The project's build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "07-thread-pool#Step 2 \u2014 Requirements and specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "07-thread-pool#Step 3 \u2014 Build ThreadPool": {
    "run": [
      configure("pool"),
    ],
    "wrong": [
      {
        "name": "workers stop without finishing the queue",
        "files": {
          "pool/thread_pool.h": "// thread_pool.h: a fixed set of worker threads that run submitted jobs.\n#pragma once\n\n#include <condition_variable>\n#include <cstddef>\n#include <deque>\n#include <functional>\n#include <future>\n#include <memory>\n#include <mutex>\n#include <stdexcept>\n#include <thread>\n#include <type_traits>\n#include <utility>\n#include <vector>\n\nclass ThreadPool {\npublic:\n    explicit ThreadPool(std::size_t threads)\n    {\n        if (threads == 0)\n            throw std::invalid_argument(\"ThreadPool: needs a thread\");\n        for (std::size_t i = 0; i < threads; ++i)\n            workers_.emplace_back([this] { work(); });\n    }\n\n    ~ThreadPool() { shutdown(); }\n\n    ThreadPool(const ThreadPool&) = delete;\n    ThreadPool& operator=(const ThreadPool&) = delete;\n\n    // Queues job to run on a worker. The future delivers its result,\n    // or the exception it threw.\n    template <typename F>\n    auto submit(F job) -> std::future<std::invoke_result_t<F>>\n    {\n        using R = std::invoke_result_t<F>;   // what job() returns\n        // std::function must be copyable and a packaged_task isn't,\n        // so the queue holds a copyable pointer to it.\n        auto task = std::make_shared<std::packaged_task<R()>>(std::move(job));\n        std::future<R> result = task->get_future();\n        {\n            std::scoped_lock lock(m_);\n            if (stopping_)\n                throw std::runtime_error(\"ThreadPool: submit after shutdown\");\n            jobs_.push_back([task] { (*task)(); });\n            ++unfinished_;\n        }\n        job_ready_.notify_one();\n        return result;\n    }\n\n    // Waits until every job submitted so far has finished.\n    void wait_all()\n    {\n        std::unique_lock lock(m_);\n        all_done_.wait(lock, [this] { return unfinished_ == 0; });\n    }\n\n    // Stops taking jobs, finishes the queued ones, joins the workers.\n    // Safe to call more than once.\n    void shutdown()\n    {\n        {\n            std::scoped_lock lock(m_);\n            if (stopping_)\n                return;\n            stopping_ = true;\n        }\n        job_ready_.notify_all();\n        for (std::thread& t : workers_)\n            t.join();\n    }\n\n    std::size_t size() const { return workers_.size(); }\n\nprivate:\n    void work()\n    {\n        while (true) {\n            std::function<void()> job;\n            {\n                std::unique_lock lock(m_);\n                job_ready_.wait(lock, [this] {\n                    return !jobs_.empty() || stopping_;\n                });\n                if (stopping_)\n                    return;\n                job = std::move(jobs_.front());\n                jobs_.pop_front();\n            }\n            job();   // outside the lock: other workers keep going\n            {\n                std::scoped_lock lock(m_);\n                --unfinished_;\n                if (unfinished_ == 0)\n                    all_done_.notify_all();\n            }\n        }\n    }\n\n    std::mutex m_;\n    std::condition_variable job_ready_;\n    std::condition_variable all_done_;\n    std::deque<std::function<void()>> jobs_;\n    std::vector<std::thread> workers_;\n    std::size_t unfinished_ = 0;   // queued or running\n    bool stopping_ = false;\n};\n",
        },
        "run": [
          configure("pool"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "07-thread-pool#Step 4 \u2014 Your own tests": {
    "wrong": [
      {
        "name": "no single-worker test",
        "files": {
          "pool/tests/thread_pool_own_test.cpp": "#include \"studio_test.hpp\"\n\n#include \"thread_pool.h\"\n\n#include <future>\n#include <stdexcept>\n#include <vector>\n\nTEST(a_pool_needs_at_least_one_thread)\n{\n    CHECK_THROWS(ThreadPool(0), std::invalid_argument);\n}\n\n// Jobs finish in any order, but each future belongs to its own job.\nTEST(each_future_gets_its_own_jobs_result)\n{\n    ThreadPool pool(4);\n    std::vector<std::future<int>> squares;\n    for (int i = 0; i < 100; ++i)\n        squares.push_back(pool.submit([i] { return i * i; }));\n    for (int i = 0; i < 100; ++i)\n        CHECK_EQ(squares[i].get(), i * i);\n}\n\nTEST(two_waits)\n{\n    ThreadPool pool(2);\n    pool.wait_all();\n    pool.wait_all();\n}\n",
        },
        "run": [
          configure("pool"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "07-thread-pool#Step 5 \u2014 The reviewer's tests": {
    "wrong": [
      {
        "name": "shutdown joins every time",
        "typeFile": true,
        "editFiles": {
          "pool/thread_pool.h": [
            [
              "            if (stopping_)\n                return;\n            stopping_ = true;",
              "            stopping_ = true;",
            ],
          ],
        },
        "run": [
          configure("pool"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "07-thread-pool#Step 6 \u2014 A parallel sum": {
    "editFiles": {
      "pool/CMakeLists.txt": [
        [
          "target_link_libraries(pool_tests PRIVATE Threads::Threads)\n",
          "target_link_libraries(pool_tests PRIVATE Threads::Threads)\n\nadd_executable(psum main.cpp)\ntarget_link_libraries(psum PRIVATE Threads::Threads)\n",
        ],
      ],
    },
    "wrong": [
      {
        "name": "forgot the CMake lines",
        "typeFile": true,
        "run": [
          configure("pool"),
        ],
        "fails": [
          0,
          2,
        ],
      },
    ],
  },
};
