// What a learner does at each step of the cpp-memory track, for its walkthrough test (walkCppTrack.js).
// Generated with the lessons; see tracks/cpp-foundations.walkthrough.js for the format.
import { configure } from '../walkCppTrack.js';

export const WALKTHROUGH = {
  "01-lifetime#Step 1 \u2014 Predict the lifetimes": {
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
  "01-lifetime#Step 2 \u2014 Objects you destroy yourself": {
    "wrong": [
      {
        "name": "forgot delete",
        "typeFile": true,
        "editFiles": {
          "lifetime/tracer.cpp": [
            [
              "    delete h;\n",
              "",
            ],
          ],
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "01-lifetime#Step 3 \u2014 Let the type clean up: std::unique_ptr": {
    "wrong": [
      {
        "name": "kept new and delete",
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "02-use-after-free#Step 1 \u2014 A program that seems to work": {
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
  "02-use-after-free#Step 4 \u2014 Fix the design, not the symptom": {
    "wrong": [
      {
        "name": "moved the delete to the end of main",
        "files": {
          "lifetime/dangling.cpp": "#include <iostream>\n#include <string>\n\n// Builds a greeting on the heap and hands back its address.\nstd::string* make_greeting(const std::string& name)\n{\n    std::string* greeting = new std::string(\"Hello, \" + name + \"!\");\n    return greeting;\n}\n\n// Prints the text, then tidies up after itself.\nvoid print_and_cleanup(std::string* text)\n{\n    std::cout << *text << '\\n';\n}\n\nint main()\n{\n    std::string* greeting = make_greeting(\"Ada\");\n    print_and_cleanup(greeting);\n    std::cout << \"Length: \" << greeting->size() << '\\n';\n    delete greeting;\n    return 0;\n}\n",
        },
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "03-dynamic-array#Step 1 \u2014 The test framework": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-dynamic-array#Step 2 \u2014 The test runner": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-dynamic-array#Step 3 \u2014 The project's build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-dynamic-array#Step 4 \u2014 The class declaration": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-dynamic-array#Step 5 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-dynamic-array#Step 6 \u2014 A class that owns memory": {
    "run": [
      configure("dynarray"),
    ],
    "wrong": [
      {
        "name": "forgot the const versions",
        "files": {
          "dynarray/int_array.cpp": "#include \"int_array.h\"\n\nIntArray::IntArray(std::size_t size) : data_(new int[size]()), size_(size)\n{\n}\n\nIntArray::~IntArray()\n{\n    delete[] data_;\n}\n\nstd::size_t IntArray::size() const\n{\n    return size_;\n}\n\nint& IntArray::operator[](std::size_t index)\n{\n    return data_[index];\n}\n\n",
        },
        "run": [
          configure("dynarray"),
        ],
        "fails": [
          1,
          2,
          3,
        ],
      },
    ],
  },
  "03-dynamic-array#Step 7 \u2014 The specification for growing": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-dynamic-array#Step 8 \u2014 Size and capacity": {
    "wrong": [
      {
        "name": "did nothing",
        "fails": [
          0,
          1,
          2,
        ],
      },
    ],
  },
  "03-dynamic-array#Step 9 \u2014 push_back, and why doubling": {
    "wrong": [
      {
        "name": "grew by one each time",
        "typeFile": true,
        "editFiles": {
          "dynarray/int_array.cpp": [
            [
              "capacity_ == 0 ? 4 : capacity_ * 2",
              "capacity_ + 1",
            ],
          ],
        },
        "run": [
          configure("dynarray"),
        ],
        "fails": [
          2,
          3,
        ],
      },
    ],
  },
  "04-copies#Step 1 \u2014 Copying goes wrong": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-copies#Step 2 \u2014 The rule of three: declare it": {
    "wrong": [
      {
        "name": "did nothing",
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "04-copies#Step 3 \u2014 Deep copies": {
    "wrong": [
      {
        "name": "copied the pointer (shallow)",
        "files": {
          "dynarray/int_array.cpp": "#include \"int_array.h\"\n\nIntArray::IntArray() : data_(nullptr), size_(0), capacity_(0)\n{\n}\n\nIntArray::IntArray(std::size_t size) : data_(new int[size]()), size_(size), capacity_(size)\n{\n}\n\nIntArray::IntArray(const IntArray& other)\n    : data_(other.data_), size_(other.size_), capacity_(other.capacity_)\n{\n}\n\nIntArray& IntArray::operator=(const IntArray& other)\n{\n    if (this == &other)\n        return *this;\n    IntArray copy(other);            // copy first: if that throws, *this is untouched\n    delete[] data_;\n    data_ = copy.data_;\n    size_ = copy.size_;\n    capacity_ = copy.capacity_;\n    copy.data_ = nullptr;            // copy no longer owns the buffer\n    return *this;\n}\n\nIntArray::~IntArray()\n{\n    delete[] data_;\n}\n\nstd::size_t IntArray::size() const\n{\n    return size_;\n}\n\nstd::size_t IntArray::capacity() const\n{\n    return capacity_;\n}\n\nint& IntArray::operator[](std::size_t index)\n{\n    return data_[index];\n}\n\nconst int& IntArray::operator[](std::size_t index) const\n{\n    return data_[index];\n}\n\nvoid IntArray::push_back(int value)\n{\n    if (size_ == capacity_) {\n        const std::size_t new_capacity = capacity_ == 0 ? 4 : capacity_ * 2;\n        int* bigger = new int[new_capacity];\n        for (std::size_t i = 0; i < size_; ++i)\n            bigger[i] = data_[i];\n        delete[] data_;\n        data_ = bigger;\n        capacity_ = new_capacity;\n    }\n    data_[size_] = value;\n    ++size_;\n}\n",
        },
        "run": [
          configure("dynarray"),
        ],
        "fails": [
          1,
          3,
        ],
      },
    ],
  },
  "04-copies#Step 4 \u2014 Challenge: bounds checking (the header)": {
    "wrong": [
      {
        "name": "only one at",
        "files": {
          "dynarray/int_array.h": "#pragma once\n\n#include <cstddef>\n\n// A resizable array of ints that owns its memory — a small std::vector<int>.\nclass IntArray {\npublic:\n    IntArray();                            // empty\n    explicit IntArray(std::size_t size);   // `size` elements, all zero\n    ~IntArray();\n\n    IntArray(const IntArray& other);              // copy constructor\n    IntArray& operator=(const IntArray& other);   // copy assignment\n\n    std::size_t size() const;\n    std::size_t capacity() const;\n    int& operator[](std::size_t index);\n    const int& operator[](std::size_t index) const;\n\n    int& at(std::size_t index);                // throws std::out_of_range\n\n    void push_back(int value);\n    void pop_back();                           // throws std::out_of_range if empty\n\nprivate:\n    int* data_;\n    std::size_t size_;\n    std::size_t capacity_;\n};\n",
        },
        "fails": [
          1,
        ],
      },
    ],
  },
  "04-copies#Step 5 \u2014 Challenge: bounds checking (the code)": {
    "wrong": [
      {
        "name": "did nothing",
        "run": [
          configure("dynarray"),
        ],
        "fails": [
          0,
          1,
          2,
        ],
      },
    ],
  },
  "04-copies#Step 6 \u2014 Your own tests": {
    "wrong": [
      {
        "name": "only one test",
        "files": {
          "dynarray/tests/at_test.cpp": "#include \"studio_test.hpp\"\n\n#include \"int_array.h\"\nTEST(one) { IntArray a(1); CHECK_EQ(a.at(0), 0); }\n",
        },
        "run": [
          configure("dynarray"),
        ],
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-copies#Step 7 \u2014 The reviewer's tests": {
    "wrong": [
      {
        "name": "allowed index == size()",
        "typeFile": true,
        "editFiles": {
          "dynarray/int_array.cpp": [
            [
              "    if (index >= size_)\n        throw std::out_of_range(\"IntArray::at: index out of range\");\n    return data_[index];\n}\n\nconst",
              "    if (index > size_)\n        throw std::out_of_range(\"IntArray::at: index out of range\");\n    return data_[index];\n}\n\nconst",
            ],
          ],
        },
        "run": [
          configure("dynarray"),
        ],
        "fails": [
          2,
          3,
        ],
      },
    ],
  },
  "05-move-semantics#Step 1 \u2014 The specification for moving": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-move-semantics#Step 2 \u2014 Declare the moves": {
    "wrong": [
      {
        "name": "forgot noexcept",
        "files": {
          "dynarray/int_array.h": "#pragma once\n\n#include <cstddef>\n\n// A resizable array of ints that owns its memory — a small std::vector<int>.\nclass IntArray {\npublic:\n    IntArray();                            // empty\n    explicit IntArray(std::size_t size);   // `size` elements, all zero\n    ~IntArray();\n\n    IntArray(const IntArray& other);              // copy constructor\n    IntArray& operator=(const IntArray& other);   // copy assignment\n\n    IntArray(IntArray&& other);              // move constructor\n    IntArray& operator=(IntArray&& other);   // move assignment\n\n    std::size_t size() const;\n    std::size_t capacity() const;\n    const int* data() const;\n    int& operator[](std::size_t index);\n    const int& operator[](std::size_t index) const;\n\n    int& at(std::size_t index);                // throws std::out_of_range\n    const int& at(std::size_t index) const;\n\n    void push_back(int value);\n    void pop_back();                           // throws std::out_of_range if empty\n\nprivate:\n    int* data_;\n    std::size_t size_;\n    std::size_t capacity_;\n};\n",
        },
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "05-move-semantics#Step 3 \u2014 Steal the buffer": {
    "wrong": [
      {
        "name": "copied instead of stealing",
        "files": {
          "dynarray/int_array.cpp": "#include \"int_array.h\"\n\n#include <stdexcept>\n\nIntArray::IntArray() : data_(nullptr), size_(0), capacity_(0)\n{\n}\n\nIntArray::IntArray(std::size_t size) : data_(new int[size]()), size_(size), capacity_(size)\n{\n}\n\nIntArray::IntArray(const IntArray& other)\n    : data_(other.capacity_ ? new int[other.capacity_] : nullptr), size_(other.size_), capacity_(other.capacity_)\n{\n    for (std::size_t i = 0; i < size_; ++i)\n        data_[i] = other.data_[i];\n}\n\nIntArray& IntArray::operator=(const IntArray& other)\n{\n    if (this == &other)\n        return *this;\n    IntArray copy(other);            // copy first: if that throws, *this is untouched\n    delete[] data_;\n    data_ = copy.data_;\n    size_ = copy.size_;\n    capacity_ = copy.capacity_;\n    copy.data_ = nullptr;            // copy no longer owns the buffer\n    return *this;\n}\n\nIntArray::IntArray(IntArray&& other) noexcept\n    : IntArray(static_cast<const IntArray&>(other))\n{\n    return;\n    // Take the buffer, and leave `other` empty but valid: its destructor must not free what we took.\n    other.data_ = nullptr;\n    other.size_ = 0;\n    other.capacity_ = 0;\n}\n\nIntArray& IntArray::operator=(IntArray&& other) noexcept\n{\n    if (this == &other)\n        return *this;\n    delete[] data_;\n    data_ = other.data_;\n    size_ = other.size_;\n    capacity_ = other.capacity_;\n    other.data_ = nullptr;\n    other.size_ = 0;\n    other.capacity_ = 0;\n    return *this;\n}\n\nIntArray::~IntArray()\n{\n    delete[] data_;\n}\n\nstd::size_t IntArray::size() const\n{\n    return size_;\n}\n\nstd::size_t IntArray::capacity() const\n{\n    return capacity_;\n}\n\nconst int* IntArray::data() const\n{\n    return data_;\n}\n\nint& IntArray::operator[](std::size_t index)\n{\n    return data_[index];\n}\n\nconst int& IntArray::operator[](std::size_t index) const\n{\n    return data_[index];\n}\n\nvoid IntArray::push_back(int value)\n{\n    if (size_ == capacity_) {\n        const std::size_t new_capacity = capacity_ == 0 ? 4 : capacity_ * 2;\n        int* bigger = new int[new_capacity];\n        for (std::size_t i = 0; i < size_; ++i)\n            bigger[i] = data_[i];\n        delete[] data_;\n        data_ = bigger;\n        capacity_ = new_capacity;\n    }\n    data_[size_] = value;\n    ++size_;\n}\n\nint& IntArray::at(std::size_t index)\n{\n    if (index >= size_)\n        throw std::out_of_range(\"IntArray::at: index out of range\");\n    return data_[index];\n}\n\nconst int& IntArray::at(std::size_t index) const\n{\n    if (index >= size_)\n        throw std::out_of_range(\"IntArray::at: index out of range\");\n    return data_[index];\n}\n\nvoid IntArray::pop_back()\n{\n    if (size_ == 0)\n        throw std::out_of_range(\"IntArray::pop_back: array is empty\");\n    --size_;\n}\n",
        },
        "run": [
          configure("dynarray"),
        ],
        "fails": [
          1,
          3,
        ],
      },
    ],
  },
  "05-move-semantics#Step 5 \u2014 The rule of five, and the rule of zero": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-move-semantics#Step 6 \u2014 Challenge: Grid, with the rule of zero": {
    "files": {},
    "wrong": [
      {
        "name": "did nothing",
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "05-move-semantics#Step 7 \u2014 The reviewer's tests": {
    "editFiles": {
      "dynarray/CMakeLists.txt": [
        [
          "${TEST_SOURCES} int_array.cpp)",
          "${TEST_SOURCES} int_array.cpp grid.cpp)",
        ],
      ],
    },
    "wrong": [
      {
        "name": "forgot to add grid.cpp to the build",
        "typeFile": true,
        "run": [
          configure("dynarray"),
        ],
        "fails": [
          1,
          2,
        ],
      },
    ],
  },
  "06-smart-pointers#Step 1 \u2014 A Tracer you can include": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-smart-pointers#Step 2 \u2014 Handing ownership over": {
    "wrong": [
      {
        "name": "tried to copy the unique_ptr",
        "files": {
          "smart/unique.cpp": "#include <iostream>\n#include <memory>\n\n#include \"tracer.h\"\n\n// Takes ownership: whoever calls this hands their Tracer over for good.\nvoid keep_until_done(std::unique_ptr<Tracer> owned)\n{\n    std::cout << \"now owned by keep_until_done: \" << owned->name << '\\n';\n}   // owned is destroyed here, and deletes the Tracer\n\nint main()\n{\n    std::unique_ptr<Tracer> report = std::make_unique<Tracer>(\"report\");\n    keep_until_done(report);\n    if (report == nullptr)\n        std::cout << \"main no longer owns it\\n\";\n    std::cout << \"main ends\\n\";\n    return 0;\n}\n",
        },
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "06-smart-pointers#Step 3 \u2014 Shared ownership": {
    "wrong": [
      {
        "name": "never reset",
        "files": {
          "smart/shared.cpp": "#include <iostream>\n#include <memory>\n\n#include \"tracer.h\"\n\nint main()\n{\n    std::shared_ptr<Tracer> first = std::make_shared<Tracer>(\"texture\");\n    std::cout << \"owners: \" << first.use_count() << '\\n';\n    {\n        std::shared_ptr<Tracer> second = first;   // a second owner of the same Tracer\n        std::cout << \"owners: \" << first.use_count() << '\\n';\n    }\n    std::cout << \"owners: \" << first.use_count() << '\\n';\n    std::cout << \"main ends\\n\";\n    return 0;\n}\n",
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "06-smart-pointers#Step 4 \u2014 A leak with no new in sight": {
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
  "06-smart-pointers#Step 5 \u2014 Break the cycle with weak_ptr": {
    "wrong": [
      {
        "name": "made the parent's pointer weak instead",
        "files": {
          "smart/cycle.cpp": "#include <iostream>\n#include <memory>\n#include <string>\n\nstruct Child;\n\nstruct Parent {\n    std::string name;\n    std::weak_ptr<Child> child;\n    ~Parent() { std::cout << \"destroy parent \" << name << '\\n'; }\n};\n\nstruct Child {\n    std::string name;\n    std::shared_ptr<Parent> parent;   // the child also owns its parent...\n    ~Child() { std::cout << \"destroy child \" << name << '\\n'; }\n};\n\nint main()\n{\n    {\n        auto mum = std::make_shared<Parent>();\n        mum->name = \"Ada\";\n        auto kid = std::make_shared<Child>();\n        kid->name = \"Byron\";\n        mum->child = kid;\n        kid->parent = mum;\n        std::cout << kid->name << \"'s parent is \" << kid->parent->name << '\\n';\n    }\n    std::cout << \"main ends\\n\";\n    return 0;\n}\n",
        },
        "fails": [
          0,
          2,
        ],
      },
    ],
  },
};
