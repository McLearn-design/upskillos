// What a learner does at each step of the cpp-generic track, for its walkthrough test (walkCppTrack.js).
// Generated with the lessons; see tracks/cpp-foundations.walkthrough.js for the format.
import { configure } from '../walkCppTrack.js';

export const WALKTHROUGH = {
  "01-function-templates#Step 1 \u2014 Three copies of one function": {
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
  "01-function-templates#Step 2 \u2014 One template instead of three": {
    "wrong": [
      {
        "name": "added the template but kept the copies",
        "files": {
          "templates/max_of.cpp": "// Three functions with the same body. Only the types differ.\n#include <iostream>\n#include <string>\n\ntemplate <typename T>\nT max_of(const T& a, const T& b)\n{\n    return a < b ? b : a;\n}\n\nint max_of(int a, int b)\n{\n    return a < b ? b : a;\n}\n\ndouble max_of(double a, double b)\n{\n    return a < b ? b : a;\n}\n\nstd::string max_of(const std::string& a, const std::string& b)\n{\n    return a < b ? b : a;\n}\n\nint main()\n{\n    std::cout << max_of(3, 7) << '\\n';\n    std::cout << max_of(2.5, 1.5) << '\\n';\n    std::cout << max_of(std::string(\"pear\"), std::string(\"apple\")) << '\\n';\n    std::cout << max_of('a', 'z') << '\\n';\n}\n",
        },
        "fails": [
          1,
        ],
      },
    ],
  },
  "01-function-templates#Step 3 \u2014 Deduction, and when it fails": {
    "wrong": [
      {
        "name": "left deduction to guess",
        "files": {
          "templates/max_of.cpp": "// One template instead of three copies.\n#include <iostream>\n#include <string>\n\ntemplate <typename T>\nT max_of(const T& a, const T& b)\n{\n    return a < b ? b : a;\n}\n\nint main()\n{\n    std::cout << max_of(3, 7) << '\\n';\n    std::cout << max_of(2.5, 1.5) << '\\n';\n    std::cout << max_of(std::string(\"pear\"), std::string(\"apple\")) << '\\n';\n    std::cout << max_of('a', 'z') << '\\n';\n    std::cout << max_of(3, 7.5) << '\\n';\n}\n",
        },
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "01-function-templates#Step 4 \u2014 A template error, on purpose": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-function-templates#Step 5 \u2014 Fix it: give Point an order": {
    "wrong": [
      {
        "name": "compared by y only",
        "files": {
          "templates/points.cpp": "// largest() works for ints. Does it work for Points?\n#include <iostream>\n#include <vector>\n\ntemplate <typename T>\nT max_of(const T& a, const T& b)\n{\n    return a < b ? b : a;\n}\n\ntemplate <typename T>\nT largest(const std::vector<T>& items)\n{\n    T best = items.at(0);\n    for (const T& item : items)\n        best = max_of(best, item);\n    return best;\n}\n\nstruct Point {\n    int x;\n    int y;\n\n    bool operator<(const Point& other) const { return y < other.y; }\n};\n\nint main()\n{\n    std::vector<int> scores{4, 9, 2};\n    std::cout << largest(scores) << '\\n';\n\n    std::vector<Point> points{{1, 2}, {3, 1}, {2, 5}};\n    Point p = largest(points);\n    std::cout << p.x << ',' << p.y << '\\n';\n}\n",
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "01-function-templates#Step 6 \u2014 Challenge: two templates of your own": {
    "wrong": [
      {
        "name": "a space after every item",
        "files": {
          "templates/challenge.cpp": "#include <cstddef>\n#include <iostream>\n#include <string>\n#include <vector>\n\ntemplate <typename T>\nvoid print_row(const std::vector<T>& items)\n{\n    for (std::size_t i = 0; i < items.size(); ++i) {\n        std::cout << items[i] << ' ';\n    }\n    std::cout << '\\n';\n}\n\ntemplate <typename T>\nstd::size_t count_greater(const std::vector<T>& items, const T& limit)\n{\n    std::size_t count = 0;\n    for (const T& item : items)\n        if (limit < item)\n            ++count;\n    return count;\n}\n\nint main()\n{\n    std::vector<int> numbers{3, 8, 1, 9};\n    std::vector<std::string> fruit{\"pear\", \"fig\", \"apple\"};\n\n    print_row(numbers);\n    std::cout << count_greater(numbers, 5) << \" greater than 5\\n\";\n    print_row(fruit);\n    std::cout << count_greater(fruit, std::string(\"kiwi\"))\n              << \" greater than kiwi\\n\";\n}\n",
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "02-class-templates#Step 1 \u2014 The test framework": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-class-templates#Step 2 \u2014 The test runner": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-class-templates#Step 3 \u2014 The project's build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-class-templates#Step 4 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-class-templates#Step 5 \u2014 Write Stack<T>": {
    "run": [
      configure("generic"),
    ],
    "wrong": [
      {
        "name": "forgot the const top()",
        "files": {
          "generic/stack.h": "#pragma once\n\n#include <cstddef>\n#include <stdexcept>\n#include <vector>\n\n// A last-in, first-out stack of any copyable type, built on std::vector.\ntemplate <typename T>\nclass Stack {\npublic:\n    void push(const T& value) { items_.push_back(value); }\n    void pop();\n    T& top();\n\n    bool empty() const { return items_.empty(); }\n    std::size_t size() const { return items_.size(); }\n\nprivate:\n    std::vector<T> items_;\n};\n\n// Members defined outside the class are templates too, so each one\n// repeats the template header, and the class is named Stack<T>.\ntemplate <typename T>\nvoid Stack<T>::pop()\n{\n    if (items_.empty())\n        throw std::out_of_range(\"Stack::pop: the stack is empty\");\n    items_.pop_back();\n}\n\ntemplate <typename T>\nT& Stack<T>::top()\n{\n    if (items_.empty())\n        throw std::out_of_range(\"Stack::top: the stack is empty\");\n    return items_.back();\n}\n\n",
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          1,
        ],
      },
      {
        "name": "pop on an empty stack is not checked",
        "files": {
          "generic/stack.h": "#pragma once\n\n#include <cstddef>\n#include <stdexcept>\n#include <vector>\n\n// A last-in, first-out stack of any copyable type, built on std::vector.\ntemplate <typename T>\nclass Stack {\npublic:\n    void push(const T& value) { items_.push_back(value); }\n    void pop();\n    T& top();\n    const T& top() const;\n\n    bool empty() const { return items_.empty(); }\n    std::size_t size() const { return items_.size(); }\n\nprivate:\n    std::vector<T> items_;\n};\n\n// Members defined outside the class are templates too, so each one\n// repeats the template header, and the class is named Stack<T>.\ntemplate <typename T>\nvoid Stack<T>::pop()\n{\n    if (!items_.empty())\n        items_.pop_back();\n}\n\ntemplate <typename T>\nT& Stack<T>::top()\n{\n    if (items_.empty())\n        throw std::out_of_range(\"Stack::top: the stack is empty\");\n    return items_.back();\n}\n\ntemplate <typename T>\nconst T& Stack<T>::top() const\n{\n    if (items_.empty())\n        throw std::out_of_range(\"Stack::top: the stack is empty\");\n    return items_.back();\n}\n",
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "02-class-templates#Step 6 \u2014 Your own tests: Stack<std::string>": {
    "wrong": [
      {
        "name": "only one test",
        "files": {
          "generic/tests/stack_string_test.cpp": "#include \"studio_test.hpp\"\n\n#include \"stack.h\"\n\n#include <string>\n\nTEST(one) { Stack<std::string> s; s.push(\"a\"); CHECK_EQ(s.top(), \"a\"); }\n",
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "02-class-templates#Step 7 \u2014 Why not a .cpp file?": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-class-templates#Step 8 \u2014 A linker error, on purpose": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-class-templates#Step 9 \u2014 Explicit instantiation, and its price": {
    "wrong": [
      {
        "name": "wrote a specialisation instead",
        "files": {
          "linkdemo/twice.cpp": "// twice is defined here, in its own .cpp file, the way you would\n// split an ordinary function into a header and a source file.\ntemplate <typename T>\nT twice(T value)\n{\n    return value + value;\n}\n\ntemplate <> int twice<int>(int);\n",
        },
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "03-concepts#Step 1 \u2014 An error far from the mistake": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-concepts#Step 2 \u2014 Constrain the template": {
    "wrong": [
      {
        "name": "defined the concept but did not use it",
        "files": {
          "concepts/mean.cpp": "// mean() works for ages and prices. What about names?\n#include <concepts>\n#include <iostream>\n#include <string>\n#include <vector>\n\ntemplate <typename T>\nT sum(const std::vector<T>& values)\n{\n    T total{};\n    for (const T& value : values)\n        total += value;\n    return total;\n}\n\n// A concept: a named, compile-time yes/no question about a type.\ntemplate <typename T>\nconcept Number = std::integral<T> || std::floating_point<T>;\n\ntemplate <typename T>\ndouble mean(const std::vector<T>& values)\n{\n    return sum(values) / static_cast<double>(values.size());\n}\n\nint main()\n{\n    std::vector<int> ages{31, 45, 28};\n    std::vector<double> prices{2.5, 4.0};\n    std::vector<std::string> names{\"Ada\", \"Grace\"};\n\n    std::cout << mean(ages) << '\\n';\n    std::cout << mean(prices) << '\\n';\n    std::cout << mean(names) << '\\n';\n}\n",
        },
        "fails": [
          1,
        ],
      },
    ],
  },
  "03-concepts#Step 3 \u2014 Concepts are questions you can ask": {
    "wrong": [
      {
        "name": "kept the call with names",
        "files": {
          "concepts/mean.cpp": "// mean() accepts numbers, and says so in its signature.\n#include <concepts>\n#include <iostream>\n#include <string>\n#include <vector>\n\ntemplate <typename T>\nT sum(const std::vector<T>& values)\n{\n    T total{};\n    for (const T& value : values)\n        total += value;\n    return total;\n}\n\n// A concept: a named, compile-time yes/no question about a type.\ntemplate <typename T>\nconcept Number = std::integral<T> || std::floating_point<T>;\n\ntemplate <Number T>\ndouble mean(const std::vector<T>& values)\n{\n    return sum(values) / static_cast<double>(values.size());\n}\n\nstatic_assert(Number<int>);\nstatic_assert(Number<double>);\nstatic_assert(!Number<std::string>);\n\nint main()\n{\n    std::vector<std::string> names{\"Ada\", \"Grace\"};\n    std::cout << mean(names) << '\\n';\n    std::vector<int> ages{31, 45, 28};\n    std::vector<double> prices{2.5, 4.0};\n\n    std::cout << mean(ages) << '\\n';\n    std::cout << mean(prices) << '\\n';\n}\n",
        },
        "fails": [
          1,
          2,
        ],
      },
    ],
  },
  "03-concepts#Step 4 \u2014 A concept of your own: the specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-concepts#Step 5 \u2014 Write the Shape concept": {
    "wrong": [
      {
        "name": "Shape only asks for area()",
        "files": {
          "generic/shapes.h": "#pragma once\n\n#include <concepts>\n#include <stdexcept>\n#include <string>\n#include <vector>\n\n// A type is a Shape if it can tell you its area and its name.\ntemplate <typename T>\nconcept Shape = requires(const T& shape) {\n    { shape.area() } -> std::convertible_to<double>;\n};\n\ntemplate <Shape S>\ndouble total_area(const std::vector<S>& shapes)\n{\n    double total = 0.0;\n    for (const S& shape : shapes)\n        total += shape.area();\n    return total;\n}\n\ntemplate <Shape S>\nconst S& largest(const std::vector<S>& shapes)\n{\n    if (shapes.empty())\n        throw std::invalid_argument(\"largest: there are no shapes\");\n    const S* best = &shapes.front();\n    for (const S& shape : shapes)\n        if (shape.area() > best->area())\n            best = &shape;\n    return *best;\n}\n",
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          1,
          2,
        ],
      },
    ],
  },
  "03-concepts#Step 6 \u2014 Challenge: Summable": {
    "wrong": [
      {
        "name": "an unconstrained sum",
        "files": {
          "generic/sum.h": "#pragma once\n\n#include <concepts>\n#include <vector>\n\n// Summable: you can make an empty one (T{}), and adding two gives a T.\ntemplate <typename T>\nconcept Summable =\n    std::default_initializable<T> && requires(const T& a, const T& b) {\n        { a + b } -> std::convertible_to<T>;\n    };\n\ntemplate <typename T>\nT sum(const std::vector<T>& values)\n{\n    T total{};\n    for (const T& value : values)\n        total = total + value;\n    return total;\n}\n",
        },
        "fails": [
          1,
        ],
      },
    ],
  },
  "03-concepts#Step 7 \u2014 Challenge: test it, at compile time and at run time": {
    "wrong": [
      {
        "name": "no compile-time tests",
        "files": {
          "generic/tests/sum_test.cpp": "// My tests for Summable and sum.\n#include \"studio_test.hpp\"\n\n#include \"sum.h\"\n\n#include <string>\n#include <vector>\n\nnamespace {\nstruct Colour {   // can't be added\n    int r, g, b;\n};\n} // namespace\n\n\nTEST(sum_adds_ints)\n{\n    CHECK_EQ(sum(std::vector<int>{1, 2, 3, 4}), 10);\n}\n\nTEST(sum_of_nothing_is_the_empty_value)\n{\n    CHECK_EQ(sum(std::vector<int>{}), 0);\n    CHECK_EQ(sum(std::vector<std::string>{}), \"\");\n}\n\nTEST(sum_joins_strings)\n{\n    CHECK_EQ(sum(std::vector<std::string>{\"gen\", \"er\", \"ic\"}), \"generic\");\n}\n",
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-iterators#Step 1 \u2014 A ring buffer: the specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-iterators#Step 2 \u2014 Write Ring<T, N>": {
    "wrong": [
      {
        "name": "a full ring ignores new values",
        "files": {
          "generic/ring.h": "#pragma once\n\n#include <array>\n#include <concepts>\n#include <cstddef>\n#include <stdexcept>\n\n// A fixed-size ring buffer: it keeps the last N values pushed.\n// When it's full, a push overwrites the oldest value.\ntemplate <std::semiregular T, std::size_t N>\nclass Ring {\n    static_assert(N > 0, \"a Ring needs room for at least one value\");\n\npublic:\n    void push(const T& value)\n    {\n        if (size_ < N) {\n            items_[size_] = value;\n            ++size_;\n        }\n    }\n\n    std::size_t size() const { return size_; }\n    static constexpr std::size_t capacity() { return N; }\n    bool empty() const { return size_ == 0; }\n    bool full() const { return size_ == N; }\n\n    // Index 0 is the oldest value, size() - 1 the newest.\n    const T& operator[](std::size_t index) const\n    {\n        return items_[(start_ + index) % N];\n    }\n\n    const T& at(std::size_t index) const\n    {\n        if (index >= size_)\n            throw std::out_of_range(\"Ring::at: index out of range\");\n        return (*this)[index];\n    }\n\nprivate:\n    std::array<T, N> items_{};\n    std::size_t start_ = 0; // where the oldest value is\n    std::size_t size_ = 0;\n};\n",
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "04-iterators#Step 3 \u2014 What range-for needs": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-iterators#Step 4 \u2014 Write the iterator": {
    "wrong": [
      {
        "name": "iterated over the raw array",
        "files": {
          "generic/ring.h": "#pragma once\n\n#include <array>\n#include <concepts>\n#include <cstddef>\n#include <iterator>\n#include <stdexcept>\n\n// A fixed-size ring buffer: it keeps the last N values pushed.\n// When it's full, a push overwrites the oldest value.\ntemplate <std::semiregular T, std::size_t N>\nclass Ring {\n    static_assert(N > 0, \"a Ring needs room for at least one value\");\n\npublic:\n    void push(const T& value)\n    {\n        items_[(start_ + size_) % N] = value;\n        if (size_ < N)\n            ++size_;\n        else\n            start_ = (start_ + 1) % N; // the oldest value was overwritten\n    }\n\n    std::size_t size() const { return size_; }\n    static constexpr std::size_t capacity() { return N; }\n    bool empty() const { return size_ == 0; }\n    bool full() const { return size_ == N; }\n\n    // Index 0 is the oldest value, size() - 1 the newest.\n    const T& operator[](std::size_t index) const\n    {\n        return items_[(start_ + index) % N];\n    }\n\n    const T& at(std::size_t index) const\n    {\n        if (index >= size_)\n            throw std::out_of_range(\"Ring::at: index out of range\");\n        return (*this)[index];\n    }\n\n    // Walks the values from oldest to newest. It remembers the ring and\n    // a logical index (0 = oldest), not a position in items_.\n    class const_iterator {\n    public:\n        using iterator_category = std::forward_iterator_tag;\n        using value_type = T;\n        using difference_type = std::ptrdiff_t;\n        using pointer = const T*;\n        using reference = const T&;\n\n        const_iterator() = default;\n        const_iterator(const Ring* ring, std::size_t index)\n            : ring_(ring), index_(index)\n        {\n        }\n\n        const T& operator*() const { return ring_->items_[index_]; }\n        const T* operator->() const { return &(*ring_)[index_]; }\n\n        const_iterator& operator++() // ++it\n        {\n            ++index_;\n            return *this;\n        }\n\n        const_iterator operator++(int) // it++\n        {\n            const_iterator old = *this;\n            ++index_;\n            return old;\n        }\n\n        bool operator==(const const_iterator&) const = default;\n\n    private:\n        const Ring* ring_ = nullptr;\n        std::size_t index_ = 0;\n    };\n\n    const_iterator begin() const { return const_iterator(this, 0); }\n    const_iterator end() const { return const_iterator(this, size_); }\n\nprivate:\n    std::array<T, N> items_{};\n    std::size_t start_ = 0; // where the oldest value is\n    std::size_t size_ = 0;\n};\n",
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          2,
        ],
      },
      {
        "name": "no default constructor",
        "files": {
          "generic/ring.h": "#pragma once\n\n#include <array>\n#include <concepts>\n#include <cstddef>\n#include <iterator>\n#include <stdexcept>\n\n// A fixed-size ring buffer: it keeps the last N values pushed.\n// When it's full, a push overwrites the oldest value.\ntemplate <std::semiregular T, std::size_t N>\nclass Ring {\n    static_assert(N > 0, \"a Ring needs room for at least one value\");\n\npublic:\n    void push(const T& value)\n    {\n        items_[(start_ + size_) % N] = value;\n        if (size_ < N)\n            ++size_;\n        else\n            start_ = (start_ + 1) % N; // the oldest value was overwritten\n    }\n\n    std::size_t size() const { return size_; }\n    static constexpr std::size_t capacity() { return N; }\n    bool empty() const { return size_ == 0; }\n    bool full() const { return size_ == N; }\n\n    // Index 0 is the oldest value, size() - 1 the newest.\n    const T& operator[](std::size_t index) const\n    {\n        return items_[(start_ + index) % N];\n    }\n\n    const T& at(std::size_t index) const\n    {\n        if (index >= size_)\n            throw std::out_of_range(\"Ring::at: index out of range\");\n        return (*this)[index];\n    }\n\n    // Walks the values from oldest to newest. It remembers the ring and\n    // a logical index (0 = oldest), not a position in items_.\n    class const_iterator {\n    public:\n        using iterator_category = std::forward_iterator_tag;\n        using value_type = T;\n        using difference_type = std::ptrdiff_t;\n        using pointer = const T*;\n        using reference = const T&;\n\n        const_iterator(const Ring* ring, std::size_t index)\n            : ring_(ring), index_(index)\n        {\n        }\n\n        const T& operator*() const { return (*ring_)[index_]; }\n        const T* operator->() const { return &(*ring_)[index_]; }\n\n        const_iterator& operator++() // ++it\n        {\n            ++index_;\n            return *this;\n        }\n\n        const_iterator operator++(int) // it++\n        {\n            const_iterator old = *this;\n            ++index_;\n            return old;\n        }\n\n        bool operator==(const const_iterator&) const = default;\n\n    private:\n        const Ring* ring_ = nullptr;\n        std::size_t index_ = 0;\n    };\n\n    const_iterator begin() const { return const_iterator(this, 0); }\n    const_iterator end() const { return const_iterator(this, size_); }\n\nprivate:\n    std::array<T, N> items_{};\n    std::size_t start_ = 0; // where the oldest value is\n    std::size_t size_ = 0;\n};\n",
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "04-iterators#Step 5 \u2014 Challenge: Range, with a sentinel": {
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
  "04-iterators#Step 6 \u2014 The reviewer's tests": {
    "wrong": [
      {
        "name": "only counts up",
        "typeFile": true,
        "editFiles": {
          "generic/range.h": [
            [
              "return step_ > 0 ? current_ >= stop_ : current_ <= stop_;",
              "return current_ >= stop_;",
            ],
          ],
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "05-lambdas#Step 1 \u2014 A function object, and the lambda that writes one": {
    "wrong": [
      {
        "name": "only the lambda",
        "files": {
          "lambdas/basics.cpp": "#include <algorithm>\n#include <cstddef>\n#include <iostream>\n#include <string>\n#include <vector>\n\n// A function object: a struct with operator(), so you can call it.\nstruct LongerThan {\n    std::size_t limit;\n\n    bool test(const std::string& word) const\n    {\n        return word.size() > limit;\n    }\n};\n\nint main()\n{\n    std::vector<std::string> words{\"map\", \"iterator\", \"lambda\", \"fn\",\n                                   \"template\"};\n\n    LongerThan longer_than_5{5};\n    std::cout << \"functor: \"\n              << std::count_if(words.begin(), words.end(), [&](const std::string& w) { return longer_than_5.test(w); })\n              << '\\n';\n\n    std::size_t limit = 5;\n    auto is_long = [limit](const std::string& word) {\n        return word.size() > limit;\n    };\n    std::cout << \"lambda: \"\n              << std::count_if(words.begin(), words.end(), is_long) << '\\n';\n}\n",
        },
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-lambdas#Step 2 \u2014 Captures: snapshots, references and mutable": {
    "wrong": [
      {
        "name": "captured both by value",
        "files": {
          "lambdas/basics.cpp": "#include <algorithm>\n#include <cstddef>\n#include <iostream>\n#include <string>\n#include <vector>\n\n// A function object: a struct with operator(), so you can call it.\nstruct LongerThan {\n    std::size_t limit;\n\n    bool operator()(const std::string& word) const\n    {\n        return word.size() > limit;\n    }\n};\n\nint main()\n{\n    std::vector<std::string> words{\"map\", \"iterator\", \"lambda\", \"fn\",\n                                   \"template\"};\n\n    LongerThan longer_than_5{5};\n    std::cout << \"functor: \"\n              << std::count_if(words.begin(), words.end(), longer_than_5)\n              << '\\n';\n\n    std::size_t limit = 5;\n    auto is_long = [limit](const std::string& word) {\n        return word.size() > limit;\n    };\n    std::cout << \"lambda: \"\n              << std::count_if(words.begin(), words.end(), is_long) << '\\n';\n\n    // Captures by value are a snapshot, taken when the lambda is made.\n    auto is_long_ref = [limit](const std::string& word) {\n        return word.size() > limit;\n    };\n    limit = 2;\n    std::cout << \"by value: \"\n              << std::count_if(words.begin(), words.end(), is_long) << '\\n';\n    std::cout << \"by reference: \"\n              << std::count_if(words.begin(), words.end(), is_long_ref) << '\\n';\n\n    // mutable lets the lambda change its own copy of what it captured.\n    auto next_id = [n = 0]() mutable { return ++n; };\n    std::cout << \"ids: \" << next_id() << ' ';\n    std::cout << next_id() << ' ';\n    auto copy = next_id;\n    std::cout << copy() << ' ';\n    std::cout << next_id() << '\\n';\n}\n",
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "05-lambdas#Step 3 \u2014 A callback that outlives what it captured": {
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
  "05-lambdas#Step 4 \u2014 Fix it: capture by value": {
    "wrong": [
      {
        "name": "switched to [&]",
        "files": {
          "lambdas/dangling.cpp": "// Callbacks registered now, run later. It compiles cleanly. Is it right?\n#include <functional>\n#include <iostream>\n#include <string>\n#include <vector>\n\nstd::vector<std::function<void()>> callbacks;\n\nvoid add_greeter(const std::string& who)\n{\n    std::string message = \"Hello, \" + who + \"! Welcome back.\";\n    callbacks.push_back([&] { std::cout << message << '\\n'; });\n}\n\nint main()\n{\n    add_greeter(\"Ada\");\n    add_greeter(\"Grace\");\n    for (const auto& callback : callbacks)\n        callback();\n}\n",
        },
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-lambdas#Step 5 \u2014 Signal: the specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-lambdas#Step 6 \u2014 Write Signal": {
    "wrong": [
      {
        "name": "disconnect does nothing",
        "files": {
          "generic/signal.h": "#pragma once\n\n#include <algorithm>\n#include <cstddef>\n#include <functional>\n#include <utility>\n#include <vector>\n\n// A Signal calls every connected function (\"slot\") when it's emitted.\n// Signal<int> passes an int to each slot; Signal<> passes nothing.\ntemplate <typename... Args>\nclass Signal {\npublic:\n    using Slot = std::function<void(Args...)>;\n    using Id = std::size_t;\n\n    Id connect(Slot slot)\n    {\n        slots_.push_back(Entry{next_id_, std::move(slot)});\n        return next_id_++;\n    }\n\n    bool disconnect(Id id)\n    {\n        auto found =\n            std::find_if(slots_.begin(), slots_.end(),\n                         [id](const Entry& entry) { return entry.id == id; });\n        if (found == slots_.end())\n            return false;\n        return true;\n    }\n\n    void emit(Args... args) const\n    {\n        for (const Entry& entry : slots_)\n            entry.slot(args...);\n    }\n\n    std::size_t size() const { return slots_.size(); }\n\nprivate:\n    struct Entry {\n        Id id;\n        Slot slot;\n    };\n\n    std::vector<Entry> slots_;\n    Id next_id_ = 1;\n};\n",
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          3,
        ],
      },
    ],
  },
  "05-lambdas#Step 7 \u2014 Your own tests": {
    "wrong": [
      {
        "name": "only one test",
        "files": {
          "generic/tests/signal_own_test.cpp": "#include \"studio_test.hpp\"\n\n#include \"signal.h\"\n\nTEST(one) { Signal<> s; CHECK_EQ(s.size(), 0u); }\n",
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-lambdas#Step 8 \u2014 The reviewer's tests": {
    "wrong": [
      {
        "name": "ids from the number of slots",
        "typeFile": true,
        "editFiles": {
          "generic/signal.h": [
            [
              "        slots_.push_back(Entry{next_id_, std::move(slot)});\n        return next_id_++;",
              "        slots_.push_back(Entry{slots_.size(), std::move(slot)});\n        return slots_.size() - 1;",
            ],
          ],
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "06-ranges#Step 1 \u2014 Views are lazy": {
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
  "06-ranges#Step 2 \u2014 An endless range": {
    "wrong": [
      {
        "name": "took four before filtering",
        "files": {
          "ranges/lazy.cpp": "// A pipeline of views. When does each lambda actually run?\n#include <iostream>\n#include <ranges>\n#include <vector>\n\nint main()\n{\n    std::vector<int> numbers{1, 2, 3, 4, 5, 6, 7, 8};\n\n    auto is_even = [](int n) {\n        std::cout << \"  is_even(\" << n << \")\\n\";\n        return n % 2 == 0;\n    };\n    auto square = [](int n) {\n        std::cout << \"  square(\" << n << \")\\n\";\n        return n * n;\n    };\n\n    auto pipeline = numbers | std::views::filter(is_even)\n                            | std::views::transform(square)\n                            | std::views::take(2);\n    std::cout << \"pipeline built\\n\";\n\n    for (int n : pipeline)\n        std::cout << \"got \" << n << '\\n';\n\n    // An endless range: only as much is computed as take(4) asks for.\n    auto odd_squares = std::views::iota(1)\n                     | std::views::take(4)\n                     | std::views::filter([](int n) { return n % 2 == 1; })\n                     | std::views::transform([](int n) { return n * n; });\n    std::cout << \"odd squares:\";\n    for (int n : odd_squares)\n        std::cout << ' ' << n;\n    std::cout << '\\n';\n}\n",
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "06-ranges#Step 3 \u2014 The grade analyser, written with loops": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-ranges#Step 4 \u2014 Tests before the rewrite": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-ranges#Step 5 \u2014 Rewrite with algorithms, views and projections": {
    "wrong": [
      {
        "name": "kept the insertion sort",
        "typeFile": true,
        "editFiles": {
          "generic/grades.h": [
            [
              "    std::ranges::stable_sort(results, std::ranges::greater{},\n                             &Result::score);",
              "    for (std::size_t i = 1; i < results.size(); ++i) {\n        Result moving = results[i];\n        std::size_t j = i;\n        while (j > 0 && results[j - 1].score < moving.score) {\n            results[j] = results[j - 1];\n            --j;\n        }\n        results[j] = moving;\n    }",
            ],
          ],
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          0,
          1,
        ],
      },
      {
        "name": "sorted lowest first",
        "typeFile": true,
        "editFiles": {
          "generic/grades.h": [
            [
              "std::ranges::stable_sort(results, std::ranges::greater{},",
              "std::ranges::stable_sort(results, {},",
            ],
          ],
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          4,
        ],
      },
    ],
  },
  "06-ranges#Step 6 \u2014 The report program": {
    "wrong": [
      {
        "name": "counted bad lines as results",
        "files": {
          "grades/report.cpp": "// Reads \"name,subject,score\" lines and prints a short report.\n#include \"grades.h\"\n\n#include <iostream>\n#include <string>\n#include <vector>\n\nint main()\n{\n    std::vector<Result> results;\n    int skipped = 0;\n    std::string line;\n    while (std::getline(std::cin, line)) {\n        if (!line.empty() && line.back() == '\\r') // a file saved on Windows\n            line.pop_back();\n        if (auto r = parse_result(line))\n            results.push_back(*r);\n        else\n            ++skipped;\n    }\n\n    std::cout << \"results: \" << results.size() + skipped << \" (\" << skipped\n              << \" skipped)\\n\";\n    std::cout << \"maths average: \" << average(results, \"maths\") << '\\n';\n    std::cout << \"failing: \" << count_failing(results, 50) << '\\n';\n\n    std::cout << \"passed:\";\n    for (const std::string& name : passed(results, 50))\n        std::cout << ' ' << name;\n    std::cout << '\\n';\n\n    std::cout << \"top 3:\\n\";\n    for (const Result& r : top(results, 3))\n        std::cout << \"  \" << r.name << ' ' << r.subject << ' ' << r.score\n                  << '\\n';\n}\n",
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "07-flat-set#Step 1 \u2014 Requirements and specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "07-flat-set#Step 2 \u2014 Build FlatSet": {
    "wrong": [
      {
        "name": "insert appends without sorting",
        "files": {
          "generic/flat_set.h": "#pragma once\n\n#include <algorithm>\n#include <concepts>\n#include <cstddef>\n#include <functional>\n#include <initializer_list>\n#include <utility>\n#include <vector>\n\n// A set kept as a sorted vector: fast lookups by binary search, and\n// cache-friendly iteration. Compare decides the order, and two values\n// are \"the same\" when neither comes before the other.\ntemplate <std::copyable T, typename Compare = std::ranges::less>\n    requires std::strict_weak_order<Compare, const T&, const T&>\nclass FlatSet {\npublic:\n    using const_iterator = typename std::vector<T>::const_iterator;\n\n    FlatSet() = default;\n    explicit FlatSet(Compare compare) : compare_(std::move(compare)) {}\n\n    FlatSet(std::initializer_list<T> values, Compare compare = Compare())\n        : compare_(std::move(compare))\n    {\n        for (const T& value : values)\n            insert(value);\n    }\n\n    bool insert(const T& value)\n    {\n        auto at = std::ranges::lower_bound(items_, value, compare_);\n        if (at != items_.end() && !compare_(value, *at))\n            return false; // an equivalent value is already here\n        items_.push_back(value);\n        return true;\n    }\n\n    bool contains(const T& value) const\n    {\n        return std::ranges::binary_search(items_, value, compare_);\n    }\n\n    bool erase(const T& value)\n    {\n        auto at = std::ranges::lower_bound(items_, value, compare_);\n        if (at == items_.end() || compare_(value, *at))\n            return false;\n        items_.erase(at);\n        return true;\n    }\n\n    std::size_t size() const { return items_.size(); }\n    bool empty() const { return items_.empty(); }\n\n    const_iterator begin() const { return items_.begin(); }\n    const_iterator end() const { return items_.end(); }\n\nprivate:\n    std::vector<T> items_;\n    Compare compare_{};\n};\n",
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "07-flat-set#Step 3 \u2014 Your own tests": {
    "wrong": [
      {
        "name": "no comparator test",
        "files": {
          "generic/tests/flat_set_own_test.cpp": "// My tests for FlatSet.\n#include \"studio_test.hpp\"\n\n#include \"flat_set.h\"\n\n#include <string>\n#include <vector>\n\nTEST(inserting_the_smallest_and_largest)\n{\n    FlatSet<int> s{5};\n    s.insert(9);\n    s.insert(1);\n    CHECK_EQ(*s.begin(), 1);\n    CHECK_EQ(*(s.end() - 1), 9);\n}\n\nTEST(erase_from_an_empty_set_is_harmless)\n{\n    FlatSet<int> s;\n    CHECK(!s.erase(3));\n    CHECK(s.empty());\n}\n\nTEST(third)\n{\n    CHECK(FlatSet<int>{1, 1}.size() == 1u);\n}\n",
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "07-flat-set#Step 4 \u2014 The reviewer's tests": {
    "wrong": [
      {
        "name": "default comparator std::less<T>",
        "typeFile": true,
        "editFiles": {
          "generic/flat_set.h": [
            [
              "typename Compare = std::ranges::less>",
              "typename Compare = std::less<T>>",
            ],
          ],
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          1,
        ],
      },
      {
        "name": "contains uses ==",
        "typeFile": true,
        "editFiles": {
          "generic/flat_set.h": [
            [
              "return std::ranges::binary_search(items_, value, compare_);",
              "return std::ranges::find(items_, value) != items_.end();",
            ],
          ],
        },
        "run": [
          configure("generic"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
};
