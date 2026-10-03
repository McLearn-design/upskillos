// What a learner does at each step of the cpp-dsa track, for its walkthrough test (walkCppTrack.js).
// Generated with the lessons; see tracks/cpp-foundations.walkthrough.js for the format.
import { configure } from '../walkCppTrack.js';

export const WALKTHROUGH = {
  "01-complexity#Step 1 \u2014 A benchmark harness": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-complexity#Step 2 \u2014 Two ways to search": {
    "wrong": [
      {
        "name": "used <= in binary_find",
        "files": {
          "bench/search.cpp": "#include <cstddef>\n#include <iostream>\n#include <vector>\n\n// Returns the index of x in v, or v.size() if x isn't there.\n// Adds the number of elements it looked at to `looked`.\nstd::size_t linear_find(const std::vector<int>& v, int x, long& looked)\n{\n    for (std::size_t i = 0; i < v.size(); ++i) {\n        ++looked;\n        if (v[i] == x)\n            return i;\n    }\n    return v.size();\n}\n\n// The same, for a sorted v: halve the range [lo, hi) until it is empty.\nstd::size_t binary_find(const std::vector<int>& v, int x, long& looked)\n{\n    std::size_t lo = 0;\n    std::size_t hi = v.size();\n    while (lo < hi) {\n        std::size_t mid = lo + (hi - lo) / 2;\n        ++looked;\n        if (v[mid] <= x)\n            lo = mid + 1;   // x can only be to the right of mid\n        else\n            hi = mid;       // x is at mid or to its left\n    }\n    if (lo < v.size() && v[lo] == x)\n        return lo;\n    return v.size();\n}\n\n// 0, 2, 4, ...: n sorted even numbers, so every odd number is missing.\nstd::vector<int> evens(int n)\n{\n    std::vector<int> v;\n    for (int i = 0; i < n; ++i)\n        v.push_back(2 * i);\n    return v;\n}\n\nint main()\n{\n    std::vector<int> v = evens(1000);\n    long looked = 0;\n    int agree = 0;\n    for (int x = -1; x < 2000; ++x) {\n        if (linear_find(v, x, looked) == binary_find(v, x, looked))\n            ++agree;\n    }\n    std::cout << \"linear_find and binary_find agree on \" << agree\n              << \" of 2001 lookups\\n\";\n}\n",
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "01-complexity#Step 3 \u2014 Count the work": {
    "wrong": [
      {
        "name": "kept counting across sizes",
        "files": {
          "bench/search.cpp": "#include <cstddef>\n#include <iostream>\n#include <vector>\n\n// Returns the index of x in v, or v.size() if x isn't there.\n// Adds the number of elements it looked at to `looked`.\nstd::size_t linear_find(const std::vector<int>& v, int x, long& looked)\n{\n    for (std::size_t i = 0; i < v.size(); ++i) {\n        ++looked;\n        if (v[i] == x)\n            return i;\n    }\n    return v.size();\n}\n\n// The same, for a sorted v: halve the range [lo, hi) until it is empty.\nstd::size_t binary_find(const std::vector<int>& v, int x, long& looked)\n{\n    std::size_t lo = 0;\n    std::size_t hi = v.size();\n    while (lo < hi) {\n        std::size_t mid = lo + (hi - lo) / 2;\n        ++looked;\n        if (v[mid] < x)\n            lo = mid + 1;   // x can only be to the right of mid\n        else\n            hi = mid;       // x is at mid or to its left\n    }\n    if (lo < v.size() && v[lo] == x)\n        return lo;\n    return v.size();\n}\n\n// 0, 2, 4, ...: n sorted even numbers, so every odd number is missing.\nstd::vector<int> evens(int n)\n{\n    std::vector<int> v;\n    for (int i = 0; i < n; ++i)\n        v.push_back(2 * i);\n    return v;\n}\n\nint main()\n{\n    std::vector<int> v = evens(1000);\n    long looked = 0;\n    int agree = 0;\n    for (int x = -1; x < 2000; ++x) {\n        if (linear_find(v, x, looked) == binary_find(v, x, looked))\n            ++agree;\n    }\n    std::cout << \"linear_find and binary_find agree on \" << agree\n              << \" of 2001 lookups\\n\";\n\n    // The worst case: a value bigger than everything, so it is missing.\n    std::cout << \"\\nLooking for a missing value:\\n\";\n    long lin = 0;\n    long bin = 0;\n    for (int n : {1000, 10000, 100000, 1000000}) {\n        std::vector<int> big = evens(n);\n        linear_find(big, 2 * n + 1, lin);\n        binary_find(big, 2 * n + 1, bin);\n        std::cout << \"n=\" << n << \": linear looks at \" << lin\n                  << \", binary at \" << bin << '\\n';\n    }\n}\n",
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "01-complexity#Step 4 \u2014 Now time it": {
    "wrong": [
      {
        "name": "forgot to include bench.h",
        "files": {
          "bench/search.cpp": "#include <cstddef>\n#include <iomanip>\n#include <iostream>\n#include <vector>\n\n\n// Returns the index of x in v, or v.size() if x isn't there.\n// Adds the number of elements it looked at to `looked`.\nstd::size_t linear_find(const std::vector<int>& v, int x, long& looked)\n{\n    for (std::size_t i = 0; i < v.size(); ++i) {\n        ++looked;\n        if (v[i] == x)\n            return i;\n    }\n    return v.size();\n}\n\n// The same, for a sorted v: halve the range [lo, hi) until it is empty.\nstd::size_t binary_find(const std::vector<int>& v, int x, long& looked)\n{\n    std::size_t lo = 0;\n    std::size_t hi = v.size();\n    while (lo < hi) {\n        std::size_t mid = lo + (hi - lo) / 2;\n        ++looked;\n        if (v[mid] < x)\n            lo = mid + 1;   // x can only be to the right of mid\n        else\n            hi = mid;       // x is at mid or to its left\n    }\n    if (lo < v.size() && v[lo] == x)\n        return lo;\n    return v.size();\n}\n\n// 0, 2, 4, ...: n sorted even numbers, so every odd number is missing.\nstd::vector<int> evens(int n)\n{\n    std::vector<int> v;\n    for (int i = 0; i < n; ++i)\n        v.push_back(2 * i);\n    return v;\n}\n\nint main()\n{\n    std::vector<int> v = evens(1000);\n    long looked = 0;\n    int agree = 0;\n    for (int x = -1; x < 2000; ++x) {\n        if (linear_find(v, x, looked) == binary_find(v, x, looked))\n            ++agree;\n    }\n    std::cout << \"linear_find and binary_find agree on \" << agree\n              << \" of 2001 lookups\\n\";\n\n    // The worst case: a value bigger than everything, so it is missing.\n    std::cout << \"\\nLooking for a missing value:\\n\";\n    for (int n : {1000, 10000, 100000, 1000000}) {\n        std::vector<int> big = evens(n);\n        long lin = 0;\n        long bin = 0;\n        linear_find(big, 2 * n + 1, lin);\n        binary_find(big, 2 * n + 1, bin);\n        std::cout << \"n=\" << n << \": linear looks at \" << lin\n                  << \", binary at \" << bin << '\\n';\n    }\n\n    // Time 100 lookups of values spread across the whole range.\n    std::cout << \"\\nTime per lookup (median of 7 runs):\\n\";\n    std::cout << \"         n   linear ns   binary ns\\n\";\n    for (int n : {1000, 10000, 100000, 1000000}) {\n        std::vector<int> big = evens(n);\n        auto lookups = [&](auto find) {\n            long looked = 0;\n            for (int q = 0; q < 100; ++q)\n                find(big, (2 * n / 100) * q + 1, looked);\n            bench::keep(looked);\n        };\n        double lin = bench::median_ns([&] { lookups(linear_find); }) / 100;\n        double bin = bench::median_ns([&] { lookups(binary_find); }) / 100;\n        std::cout << std::setw(10) << n << std::setw(12) << std::fixed\n                  << std::setprecision(1) << lin << std::setw(12) << bin\n                  << '\\n';\n    }\n}\n",
        },
        "fails": [
          1,
          3,
        ],
      },
    ],
  },
  "01-complexity#Step 6 \u2014 Mistake on purpose: an impossible benchmark": {
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
  "01-complexity#Step 7 \u2014 Fix the benchmark": {
    "wrong": [
      {
        "name": "kept the result but never printed it",
        "files": {
          "bench/broken.cpp": "// A benchmark from a colleague: \"my loop adds up 20 million numbers\n// in no time at all!\" Is it right?\n#include <cstdint>\n#include <iostream>\n\n#include \"bench.h\"\n\nint main()\n{\n    const std::uint64_t n = 20'000'000;\n    double ns = bench::median_ns([&] {\n        std::uint64_t sum = 0;\n        for (std::uint64_t i = 0; i < n; ++i)\n            sum += i % 7;\n        bench::keep(sum);\n    });\n    std::cout << \"adding up \" << n << \" numbers took \" << ns / 1e6\n              << \" ms\\n\";\n}\n",
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "02-sequences#Step 1 \u2014 The test framework": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-sequences#Step 2 \u2014 The test runner": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-sequences#Step 3 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-sequences#Step 4 \u2014 The race, and a prediction": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-sequences#Step 5 \u2014 The build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-sequences#Step 6 \u2014 Write the helpers, then race": {
    "run": [
      configure("containers"),
    ],
    "wrong": [
      {
        "name": "appended then called std::sort",
        "files": {
          "containers/sorted.h": "// sorted.h: helpers that work on any sequence container (vector, list, deque).\n#pragma once\n\n#include <algorithm>\n\n// Inserts value into c, which is sorted, so that c stays sorted.\n// Walks from the front to the first element that isn't smaller.\ntemplate <typename Container>\nvoid insert_sorted(Container& c, int value)\n{\n    c.push_back(value);\n    std::sort(c.begin(), c.end());\n}\n\n// Adds up every element, visiting them in order.\ntemplate <typename Container>\nlong long sum(const Container& c)\n{\n    long long total = 0;\n    for (int x : c)\n        total += x;\n    return total;\n}\n",
        },
        "run": [
          configure("containers"),
        ],
        "fails": [
          1,
          2,
          3,
        ],
      },
    ],
  },
  "02-sequences#Step 7 \u2014 Challenge: prepend": {
    "wrong": [
      {
        "name": "used push_front, which vector lacks",
        "files": {
          "containers/sorted.h": "// sorted.h: helpers that work on any sequence container (vector, list, deque).\n#pragma once\n\n// Inserts value into c, which is sorted, so that c stays sorted.\n// Walks from the front to the first element that isn't smaller.\ntemplate <typename Container>\nvoid insert_sorted(Container& c, int value)\n{\n    auto it = c.begin();\n    while (it != c.end() && *it < value)\n        ++it;\n    c.insert(it, value);\n}\n\n// Adds up every element, visiting them in order.\ntemplate <typename Container>\nlong long sum(const Container& c)\n{\n    long long total = 0;\n    for (int x : c)\n        total += x;\n    return total;\n}\n\n// Inserts value at the front of c.\ntemplate <typename Container>\nvoid prepend(Container& c, int value)\n{\n    c.push_front(value);\n}\n",
          "containers/tests/use_prepend_test.cpp": "#include \"studio_test.hpp\"\n\n#include <vector>\n\n#include \"sorted.h\"\n\nTEST(vector_prepend) { std::vector<int> v; prepend(v, 1); CHECK(v.size() == 1u); }\n",
        },
        "run": [
          configure("containers"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "02-sequences#Step 8 \u2014 Your own tests": {
    "wrong": [
      {
        "name": "only one test",
        "files": {
          "containers/tests/prepend_test.cpp": "// My tests for prepend.\n#include \"studio_test.hpp\"\n\n#include <deque>\n#include <list>\n#include <vector>\n\n#include \"sorted.h\"\n\nTEST(prepend_to_an_empty_vector)\n{\n    std::vector<int> v;\n    prepend(v, 4);\n    CHECK(v == std::vector<int>{4});\n}\n\n",
        },
        "run": [
          configure("containers"),
        ],
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-hash-map#Step 1 \u2014 The interface": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-hash-map#Step 2 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-hash-map#Step 3 \u2014 The build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-hash-map#Step 4 \u2014 Hashing and chaining": {
    "run": [
      configure("hashmap"),
    ],
    "wrong": [
      {
        "name": "always appended a new entry",
        "files": {
          "hashmap/hash_map.cpp": "#include \"hash_map.h\"\n\n#include <functional>\n\nHashMap::HashMap() : buckets_(8), size_(0)\n{\n}\n\nstd::size_t HashMap::bucket_for(const std::string& key) const\n{\n    return std::hash<std::string>{}(key) % buckets_.size();\n}\n\nbool HashMap::insert_or_assign(const std::string& key, int value)\n{\n    buckets_[bucket_for(key)].push_back({key, value});\n    ++size_;\n    return true;\n}\n\nint* HashMap::find(const std::string& key)\n{\n    for (Entry& entry : buckets_[bucket_for(key)]) {\n        if (entry.first == key)\n            return &entry.second;\n    }\n    return nullptr;\n}\n\nconst int* HashMap::find(const std::string& key) const\n{\n    for (const Entry& entry : buckets_[bucket_for(key)]) {\n        if (entry.first == key)\n            return &entry.second;\n    }\n    return nullptr;\n}\n\nbool HashMap::erase(const std::string& key)\n{\n    std::vector<Entry>& bucket = buckets_[bucket_for(key)];\n    for (std::size_t i = 0; i < bucket.size(); ++i) {\n        if (bucket[i].first == key) {\n            bucket[i] = std::move(bucket.back());   // order inside a bucket\n            bucket.pop_back();                      // doesn't matter\n            --size_;\n            return true;\n        }\n    }\n    return false;\n}\n\nstd::size_t HashMap::size() const\n{\n    return size_;\n}\n\nstd::size_t HashMap::bucket_count() const\n{\n    return buckets_.size();\n}\n\ndouble HashMap::load_factor() const\n{\n    return static_cast<double>(size_) / static_cast<double>(buckets_.size());\n}\n",
        },
        "run": [
          configure("hashmap"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "03-hash-map#Step 5 \u2014 Predict: 8 buckets, 100,000 keys": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-hash-map#Step 6 \u2014 Rehash": {
    "wrong": [
      {
        "name": "resized the buckets without moving entries",
        "files": {
          "hashmap/hash_map.cpp": "#include \"hash_map.h\"\n\n#include <functional>\n\nHashMap::HashMap() : buckets_(8), size_(0)\n{\n}\n\nstd::size_t HashMap::bucket_for(const std::string& key) const\n{\n    return std::hash<std::string>{}(key) % buckets_.size();\n}\n\nbool HashMap::insert_or_assign(const std::string& key, int value)\n{\n    if (int* existing = find(key)) {\n        *existing = value;   // already there: replace the value\n        return false;\n    }\n    if (static_cast<double>(size_ + 1) > max_load_factor * buckets_.size())\n        rehash(buckets_.size() * 2);   // too full: double the buckets first\n    buckets_[bucket_for(key)].push_back({key, value});\n    ++size_;\n    return true;\n}\n\nint* HashMap::find(const std::string& key)\n{\n    for (Entry& entry : buckets_[bucket_for(key)]) {\n        if (entry.first == key)\n            return &entry.second;\n    }\n    return nullptr;\n}\n\nconst int* HashMap::find(const std::string& key) const\n{\n    for (const Entry& entry : buckets_[bucket_for(key)]) {\n        if (entry.first == key)\n            return &entry.second;\n    }\n    return nullptr;\n}\n\nbool HashMap::erase(const std::string& key)\n{\n    std::vector<Entry>& bucket = buckets_[bucket_for(key)];\n    for (std::size_t i = 0; i < bucket.size(); ++i) {\n        if (bucket[i].first == key) {\n            bucket[i] = std::move(bucket.back());   // order inside a bucket\n            bucket.pop_back();                      // doesn't matter\n            --size_;\n            return true;\n        }\n    }\n    return false;\n}\n\nstd::size_t HashMap::size() const\n{\n    return size_;\n}\n\nstd::size_t HashMap::bucket_count() const\n{\n    return buckets_.size();\n}\n\ndouble HashMap::load_factor() const\n{\n    return static_cast<double>(size_) / static_cast<double>(buckets_.size());\n}\n\nvoid HashMap::rehash(std::size_t new_bucket_count)\n{\n    buckets_.resize(new_bucket_count);\n}\n",
        },
        "run": [
          configure("hashmap"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "03-hash-map#Step 7 \u2014 Race std::unordered_map": {
    "editFiles": {
      "hashmap/CMakeLists.txt": [
        [
          "add_executable(hash_map_tests ../testing/test_main.cpp ${TEST_SOURCES} hash_map.cpp)",
          "add_executable(hash_map_tests ../testing/test_main.cpp ${TEST_SOURCES} hash_map.cpp)\n\nadd_executable(compare main.cpp hash_map.cpp)",
        ],
      ],
    },
    "wrong": [
      {
        "name": "forgot the CMake line",
        "typeFile": true,
        "run": [
          configure("hashmap"),
        ],
        "fails": [
          0,
          2,
        ],
      },
    ],
  },
  "03-hash-map#Step 8 \u2014 The reviewer's tests": {
    "wrong": [
      {
        "name": "erase popped the last entry instead of the erased one",
        "typeFile": true,
        "editFiles": {
          "hashmap/hash_map.cpp": [
            [
              "            bucket[i] = std::move(bucket.back());   // order inside a bucket\n            bucket.pop_back();                      // doesn't matter\n",
              "            bucket.pop_back();\n",
            ],
          ],
        },
        "run": [
          configure("hashmap"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "04-search-trees#Step 1 \u2014 The interface": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-search-trees#Step 2 \u2014 The build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-search-trees#Step 3 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-search-trees#Step 4 \u2014 Insert, find, and walk in order": {
    "run": [
      configure("bst"),
    ],
    "wrong": [
      {
        "name": "inserted duplicates",
        "files": {
          "bst/int_set.cpp": "#include \"int_set.h\"\n\n#include <algorithm>\n\nbool IntSet::insert(int value)\n{\n    // slot points at the unique_ptr where value belongs: start at the root\n    // and go left or right until we reach an empty one.\n    std::unique_ptr<Node>* slot = &root_;\n    while (*slot) {\n        Node& node = **slot;\n        slot = value < node.value ? &node.left : &node.right;\n    }\n    *slot = std::make_unique<Node>(Node{value, nullptr, nullptr});\n    ++size_;\n    return true;\n}\n\nbool IntSet::contains(int value) const\n{\n    const Node* node = root_.get();\n    while (node) {\n        if (value == node->value)\n            return true;\n        node = value < node->value ? node->left.get() : node->right.get();\n    }\n    return false;\n}\n\nstd::size_t IntSet::size() const\n{\n    return size_;\n}\n\n// Helpers that only this file needs go in an unnamed namespace.\nnamespace {\n\ntemplate <typename Node>\nint height_of(const Node* node)\n{\n    if (!node)\n        return 0;\n    return 1 + std::max(height_of(node->left.get()),\n                        height_of(node->right.get()));\n}\n\ntemplate <typename Node>\nvoid visit_in_order(const Node* node, std::vector<int>& out)\n{\n    if (!node)\n        return;\n    visit_in_order(node->left.get(), out);    // everything smaller first\n    out.push_back(node->value);               // then this node\n    visit_in_order(node->right.get(), out);   // then everything bigger\n}\n\n} // namespace\n\nint IntSet::height() const\n{\n    return height_of(root_.get());\n}\n\nstd::vector<int> IntSet::in_order() const\n{\n    std::vector<int> out;\n    visit_in_order(root_.get(), out);\n    return out;\n}\n",
        },
        "run": [
          configure("bst"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "04-search-trees#Step 5 \u2014 The degenerate tree": {
    "editFiles": {
      "bst/CMakeLists.txt": [
        [
          "add_executable(int_set_tests ../testing/test_main.cpp ${TEST_SOURCES} int_set.cpp)",
          "add_executable(int_set_tests ../testing/test_main.cpp ${TEST_SOURCES} int_set.cpp)\n\nadd_executable(heights main.cpp int_set.cpp)",
        ],
      ],
    },
    "wrong": [
      {
        "name": "forgot the CMake line",
        "typeFile": true,
        "run": [
          configure("bst"),
        ],
        "fails": [
          0,
          2,
        ],
      },
    ],
  },
  "04-search-trees#Step 6 \u2014 Ordered queries: the specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-search-trees#Step 7 \u2014 Challenge: lower_bound": {
    "wrong": [
      {
        "name": "stopped at the first node >= value",
        "files": {
          "bst/int_set.cpp": "#include \"int_set.h\"\n\n#include <algorithm>\n\nbool IntSet::insert(int value)\n{\n    // slot points at the unique_ptr where value belongs: start at the root\n    // and go left or right until we reach an empty one.\n    std::unique_ptr<Node>* slot = &root_;\n    while (*slot) {\n        Node& node = **slot;\n        if (value == node.value)\n            return false;\n        slot = value < node.value ? &node.left : &node.right;\n    }\n    *slot = std::make_unique<Node>(Node{value, nullptr, nullptr});\n    ++size_;\n    return true;\n}\n\nbool IntSet::contains(int value) const\n{\n    const Node* node = root_.get();\n    while (node) {\n        if (value == node->value)\n            return true;\n        node = value < node->value ? node->left.get() : node->right.get();\n    }\n    return false;\n}\n\nstd::size_t IntSet::size() const\n{\n    return size_;\n}\n\n// Helpers that only this file needs go in an unnamed namespace.\nnamespace {\n\ntemplate <typename Node>\nint height_of(const Node* node)\n{\n    if (!node)\n        return 0;\n    return 1 + std::max(height_of(node->left.get()),\n                        height_of(node->right.get()));\n}\n\ntemplate <typename Node>\nvoid visit_in_order(const Node* node, std::vector<int>& out)\n{\n    if (!node)\n        return;\n    visit_in_order(node->left.get(), out);    // everything smaller first\n    out.push_back(node->value);               // then this node\n    visit_in_order(node->right.get(), out);   // then everything bigger\n}\n\n} // namespace\n\nint IntSet::height() const\n{\n    return height_of(root_.get());\n}\n\nstd::vector<int> IntSet::in_order() const\n{\n    std::vector<int> out;\n    visit_in_order(root_.get(), out);\n    return out;\n}\n\nstd::optional<int> IntSet::lower_bound(int value) const\n{\n    std::optional<int> best;   // the smallest value >= value seen so far\n    const Node* node = root_.get();\n    while (node) {\n        if (node->value >= value) {\n            return node->value;\n        } else {\n            node = node->right.get(); // too small: look right\n        }\n    }\n    return best;\n}\n",
        },
        "run": [
          configure("bst"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "04-search-trees#Step 8 \u2014 Your own tests: what std::map can do": {
    "wrong": [
      {
        "name": "tested only lower_bound",
        "files": {
          "bst/tests/map_test.cpp": "// My tests: what std::map's ordered queries do.\n#include \"studio_test.hpp\"\n\n#include <map>\n#include <string>\n\nnamespace {\n\nstd::map<int, std::string> scores()\n{\n    return {{50, \"Ada\"}, {70, \"Grace\"}, {90, \"Alan\"}};\n}\n\n} // namespace\n\nTEST(map_iterates_in_key_order)\n{\n    std::map<int, std::string> m{{90, \"Alan\"}, {50, \"Ada\"}, {70, \"Grace\"}};\n    std::string names;\n    for (const auto& [score, name] : m)\n        names += name + \" \";\n    CHECK_EQ(names, std::string(\"Ada Grace Alan \"));\n}\n\nTEST(map_lower_bound_includes_the_key)\n{\n    auto m = scores();\n    CHECK_EQ(m.lower_bound(70)->second, std::string(\"Grace\"));\n    CHECK_EQ(m.lower_bound(71)->second, std::string(\"Alan\"));\n    CHECK(m.lower_bound(91) == m.end());\n}\n\n",
        },
        "run": [
          configure("bst"),
        ],
        "fails": [
          0,
          2,
        ],
      },
    ],
  },
  "05-heaps#Step 1 \u2014 A tree stored in a vector": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-heaps#Step 2 \u2014 The build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-heaps#Step 3 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-heaps#Step 4 \u2014 Sift up, sift down": {
    "run": [
      configure("heap"),
    ],
    "wrong": [
      {
        "name": "sift_down looked only at the left child",
        "files": {
          "heap/min_heap.cpp": "#include \"min_heap.h\"\n\n#include <stdexcept>\n#include <utility>\n\nvoid MinHeap::push(int value)\n{\n    data_.push_back(value);        // the new leaf, at the end\n    sift_up(data_.size() - 1);     // then restore the heap rule above it\n}\n\nint MinHeap::top() const\n{\n    if (data_.empty())\n        throw std::out_of_range(\"MinHeap::top: the heap is empty\");\n    return data_[0];\n}\n\nint MinHeap::pop()\n{\n    if (data_.empty())\n        throw std::out_of_range(\"MinHeap::pop: the heap is empty\");\n    int smallest = data_[0];\n    data_[0] = data_.back();       // the last leaf fills the hole at the root\n    data_.pop_back();\n    if (!data_.empty())\n        sift_down(0);              // then sinks to where it belongs\n    return smallest;\n}\n\nstd::size_t MinHeap::size() const\n{\n    return data_.size();\n}\n\nbool MinHeap::empty() const\n{\n    return data_.empty();\n}\n\nvoid MinHeap::sift_up(std::size_t i)\n{\n    while (i > 0) {\n        std::size_t parent = (i - 1) / 2;\n        if (data_[parent] <= data_[i])\n            return;                         // the heap rule holds: done\n        std::swap(data_[parent], data_[i]);\n        i = parent;\n    }\n}\n\nvoid MinHeap::sift_down(std::size_t i)\n{\n    while (true) {\n        std::size_t left = 2 * i + 1;\n        std::size_t right = 2 * i + 2;\n        std::size_t smallest = i;   // the smallest of i and its children\n        if (left < data_.size() && data_[left] < data_[smallest])\n            smallest = left;\n        if (smallest == i)\n            return;                         // both children are bigger: done\n        std::swap(data_[i], data_[smallest]);\n        i = smallest;\n    }\n}\n",
        },
        "run": [
          configure("heap"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "05-heaps#Step 5 \u2014 The reviewer's tests": {
    "wrong": [
      {
        "name": "threw std::runtime_error",
        "typeFile": true,
        "editFiles": {
          "heap/min_heap.cpp": [
            [
              "throw std::out_of_range(\"MinHeap::pop: the heap is empty\")",
              "throw std::runtime_error(\"MinHeap::pop: the heap is empty\")",
            ],
          ],
        },
        "run": [
          configure("heap"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "05-heaps#Step 6 \u2014 Mistake on purpose: an unfair scheduler": {
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
  "05-heaps#Step 7 \u2014 Fix the tie-break": {
    "wrong": [
      {
        "name": "flipped the priority comparison",
        "files": {
          "heap/scheduler.cpp": "// A task scheduler: the most important task runs first, and tasks with the\n// same priority run in the order they were added.\n//\n//   add <priority> <name>    queue a task (bigger priority = more urgent)\n//   run                      run the most urgent task\n//   count                    how many tasks are waiting\n#include <iostream>\n#include <queue>\n#include <string>\n#include <vector>\n\nstruct Task {\n    int priority;\n    long order;         // 0 for the first task added, 1 for the next, ...\n    std::string name;\n};\n\n// std::priority_queue keeps the \"biggest\" element on top, where \"a is\n// smaller than b\" means: a runs later than b.\nstruct RunsLater {\n    bool operator()(const Task& a, const Task& b) const\n    {\n        if (a.priority != b.priority)\n            return a.priority > b.priority;   // less urgent runs later\n        return a.order > b.order;             // added later runs later\n    }\n};\n\nint main()\n{\n    std::priority_queue<Task, std::vector<Task>, RunsLater> waiting;\n    long added = 0;\n    std::string command;\n    while (std::cin >> command) {\n        if (command == \"add\") {\n            Task task;\n            std::cin >> task.priority >> task.name;\n            task.order = added++;\n            waiting.push(task);\n            std::cout << \"added \" << task.name << '\\n';\n        } else if (command == \"run\") {\n            if (waiting.empty()) {\n                std::cout << \"nothing to run\\n\";\n            } else {\n                std::cout << \"running \" << waiting.top().name << '\\n';\n                waiting.pop();\n            }\n        } else if (command == \"count\") {\n            std::cout << waiting.size() << \" waiting\\n\";\n        } else {\n            std::cout << \"unknown command: \" << command << '\\n';\n        }\n    }\n}\n",
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "06-graphs#Step 1 \u2014 The map": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-graphs#Step 2 \u2014 Adjacency lists": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-graphs#Step 3 \u2014 The build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-graphs#Step 4 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-graphs#Step 5 \u2014 Load the graph, then breadth-first search": {
    "run": [
      configure("graph"),
    ],
    "wrong": [
      {
        "name": "added each road one way only",
        "files": {
          "graph/graph.cpp": "#include \"graph.h\"\n\n#include <queue>\n#include <sstream>\n\nint Graph::id_of(const std::string& name)\n{\n    auto found = ids.find(name);\n    if (found != ids.end())\n        return found->second;\n    int id = static_cast<int>(names.size());\n    ids[name] = id;\n    names.push_back(name);\n    roads.emplace_back();   // the new town has no roads yet\n    return id;\n}\n\nvoid Graph::add_road(const std::string& a, const std::string& b, int km)\n{\n    int from = id_of(a);\n    int to = id_of(b);\n    roads[from].push_back({to, km});\n}\n\nGraph load_graph(std::istream& in)\n{\n    Graph g;\n    std::string line;\n    while (std::getline(in, line)) {\n        if (line.empty() || line[0] == '#')\n            continue;\n        std::istringstream fields(line);\n        std::string a;\n        std::string b;\n        int km = 0;\n        if (fields >> a >> b >> km)\n            g.add_road(a, b, km);\n    }\n    return g;\n}\n\nPaths bfs(const Graph& g, int start)\n{\n    Paths p{std::vector<int>(g.names.size(), -1),\n            std::vector<int>(g.names.size(), -1)};\n    std::queue<int> frontier;\n    p.dist[start] = 0;\n    frontier.push(start);\n    while (!frontier.empty()) {\n        int town = frontier.front();\n        frontier.pop();\n        for (const Road& road : g.roads[town]) {\n            if (p.dist[road.to] == -1) {        // not seen yet\n                p.dist[road.to] = p.dist[town] + 1;\n                p.prev[road.to] = town;\n                frontier.push(road.to);\n            }\n        }\n    }\n    return p;\n}\n\nstd::vector<int> path_to(const Paths& paths, int target)\n{\n    if (paths.dist[target] == -1)\n        return {};\n    std::vector<int> path;\n    for (int town = target; town != -1; town = paths.prev[town])\n        path.insert(path.begin(), town);   // walk back to the start\n    return path;\n}\n",
        },
        "run": [
          configure("graph"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "06-graphs#Step 6 \u2014 Tests first: has_cycle": {
    "wrong": [
      {
        "name": "only one test",
        "files": {
          "graph/tests/cycle_test.cpp": "// My tests for has_cycle.\n#include \"studio_test.hpp\"\n\n#include <sstream>\n\n#include \"graph.h\"\n\nnamespace {\n\nGraph from_text(const char* text)\n{\n    std::istringstream in(text);\n    return load_graph(in);\n}\n\n} // namespace\n\nTEST(a_line_has_no_cycle)\n{\n    CHECK(!has_cycle(from_text(\"A B 1\\nB C 1\\nC D 1\\n\")));\n}\n\n",
        },
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-graphs#Step 7 \u2014 Depth-first search": {
    "run": [
      configure("graph"),
    ],
    "wrong": [
      {
        "name": "counted the road back as a cycle",
        "files": {
          "graph/graph.cpp": "#include \"graph.h\"\n\n#include <queue>\n#include <sstream>\n\nint Graph::id_of(const std::string& name)\n{\n    auto found = ids.find(name);\n    if (found != ids.end())\n        return found->second;\n    int id = static_cast<int>(names.size());\n    ids[name] = id;\n    names.push_back(name);\n    roads.emplace_back();   // the new town has no roads yet\n    return id;\n}\n\nvoid Graph::add_road(const std::string& a, const std::string& b, int km)\n{\n    int from = id_of(a);\n    int to = id_of(b);\n    roads[from].push_back({to, km});\n    roads[to].push_back({from, km});\n}\n\nGraph load_graph(std::istream& in)\n{\n    Graph g;\n    std::string line;\n    while (std::getline(in, line)) {\n        if (line.empty() || line[0] == '#')\n            continue;\n        std::istringstream fields(line);\n        std::string a;\n        std::string b;\n        int km = 0;\n        if (fields >> a >> b >> km)\n            g.add_road(a, b, km);\n    }\n    return g;\n}\n\nPaths bfs(const Graph& g, int start)\n{\n    Paths p{std::vector<int>(g.names.size(), -1),\n            std::vector<int>(g.names.size(), -1)};\n    std::queue<int> frontier;\n    p.dist[start] = 0;\n    frontier.push(start);\n    while (!frontier.empty()) {\n        int town = frontier.front();\n        frontier.pop();\n        for (const Road& road : g.roads[town]) {\n            if (p.dist[road.to] == -1) {        // not seen yet\n                p.dist[road.to] = p.dist[town] + 1;\n                p.prev[road.to] = town;\n                frontier.push(road.to);\n            }\n        }\n    }\n    return p;\n}\n\nstd::vector<int> path_to(const Paths& paths, int target)\n{\n    if (paths.dist[target] == -1)\n        return {};\n    std::vector<int> path;\n    for (int town = target; town != -1; town = paths.prev[town])\n        path.insert(path.begin(), town);   // walk back to the start\n    return path;\n}\n\nnamespace {\n\n// Visits every town reachable from town. Returns true if it finds a road\n// back to an already-visited town, other than the road it arrived by.\nbool dfs_finds_cycle(const Graph& g, int town, int came_from,\n                     std::vector<bool>& visited)\n{\n    visited[town] = true;\n    for (const Road& road : g.roads[town]) {\n        if (visited[road.to])\n            return true;               // another way to a visited town\n        if (dfs_finds_cycle(g, road.to, town, visited))\n            return true;\n    }\n    return false;\n}\n\n} // namespace\n\nbool has_cycle(const Graph& g)\n{\n    std::vector<bool> visited(g.names.size(), false);\n    for (int town = 0; town < static_cast<int>(g.names.size()); ++town) {\n        if (!visited[town] && dfs_finds_cycle(g, town, -1, visited))\n            return true;\n    }\n    return false;\n}\n",
        },
        "run": [
          configure("graph"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "06-graphs#Step 8 \u2014 Dijkstra's algorithm": {
    "wrong": [
      {
        "name": "did nothing",
        "typeFile": false,
        "run": [
          configure("graph"),
        ],
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "06-graphs#Step 9 \u2014 The route finder": {
    "editFiles": {
      "graph/CMakeLists.txt": [
        [
          "add_executable(graph_tests ../testing/test_main.cpp ${TEST_SOURCES} graph.cpp)",
          "add_executable(graph_tests ../testing/test_main.cpp ${TEST_SOURCES} graph.cpp)\n\nadd_executable(route main.cpp graph.cpp)",
        ],
      ],
    },
    "wrong": [
      {
        "name": "never improved a distance once set",
        "typeFile": true,
        "editFiles": {
          "graph/CMakeLists.txt": [
            [
              "add_executable(graph_tests ../testing/test_main.cpp ${TEST_SOURCES} graph.cpp)",
              "add_executable(graph_tests ../testing/test_main.cpp ${TEST_SOURCES} graph.cpp)\n\nadd_executable(route main.cpp graph.cpp)",
            ],
          ],
          "graph/graph.cpp": [
            [
              "if (p.dist[road.to] == -1 || via < p.dist[road.to]) {",
              "if (p.dist[road.to] == -1) {",
            ],
          ],
        },
        "run": [
          configure("graph"),
        ],
        "fails": [
          3,
        ],
      },
    ],
  },
  "07-dynamic-programming#Step 1 \u2014 Count the calls": {
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
  "07-dynamic-programming#Step 2 \u2014 Memoisation: remember the answers": {
    "wrong": [
      {
        "name": "stored the answers as int",
        "files": {
          "dp/fib.cpp": "// How much work does the obvious recursive Fibonacci do?\n#include <iostream>\n#include <vector>\n\nlong long calls = 0;   // how many times fib has been called\n\nlong long fib(int n)\n{\n    ++calls;\n    if (n < 2)\n        return n;\n    return fib(n - 1) + fib(n - 2);\n}\n\nlong long memo_calls = 0;\n\n// memo[n] is fib(n) once it has been worked out, or -1 before that.\nlong long fib_memo(int n, std::vector<int>& memo)\n{\n    ++memo_calls;\n    if (n < 2)\n        return n;\n    if (memo[n] != -1)\n        return memo[n];            // solved before: reuse the answer\n    memo[n] = static_cast<int>(fib_memo(n - 1, memo) + fib_memo(n - 2, memo));\n    return memo[n];\n}\n\nlong long fib_memo(int n)\n{\n    std::vector<int> memo(n + 1, -1);\n    return fib_memo(n, memo);\n}\n\nint main()\n{\n    for (int n : {10, 20, 30, 40}) {\n        calls = 0;\n        long long result = fib(n);\n        std::cout << \"fib(\" << n << \") = \" << result << \" after \" << calls\n                  << \" calls\\n\";\n    }\n    for (int n : {40, 90}) {\n        memo_calls = 0;\n        long long result = fib_memo(n);\n        std::cout << \"fib_memo(\" << n << \") = \" << result << \" after \"\n                  << memo_calls << \" calls\\n\";\n    }\n}\n",
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "07-dynamic-programming#Step 3 \u2014 Tabulation: bottom-up": {
    "wrong": [
      {
        "name": "stopped the loop one early",
        "files": {
          "dp/fib.cpp": "// How much work does the obvious recursive Fibonacci do?\n#include <iostream>\n#include <vector>\n\nlong long calls = 0;   // how many times fib has been called\n\nlong long fib(int n)\n{\n    ++calls;\n    if (n < 2)\n        return n;\n    return fib(n - 1) + fib(n - 2);\n}\n\nlong long memo_calls = 0;\n\n// memo[n] is fib(n) once it has been worked out, or -1 before that.\nlong long fib_memo(int n, std::vector<long long>& memo)\n{\n    ++memo_calls;\n    if (n < 2)\n        return n;\n    if (memo[n] != -1)\n        return memo[n];            // solved before: reuse the answer\n    memo[n] = fib_memo(n - 1, memo) + fib_memo(n - 2, memo);\n    return memo[n];\n}\n\nlong long fib_memo(int n)\n{\n    std::vector<long long> memo(n + 1, -1);\n    return fib_memo(n, memo);\n}\n\n// Bottom-up: start from the smallest problems, keep only the last two.\nlong long fib_table(int n)\n{\n    if (n < 2)\n        return n;\n    long long before = 0;   // fib(i - 2)\n    long long last = 1;     // fib(i - 1)\n    for (int i = 2; i < n; ++i) {\n        long long next = before + last;\n        before = last;\n        last = next;\n    }\n    return last;\n}\n\nint main()\n{\n    for (int n : {10, 20, 30, 40}) {\n        calls = 0;\n        long long result = fib(n);\n        std::cout << \"fib(\" << n << \") = \" << result << \" after \" << calls\n                  << \" calls\\n\";\n    }\n    for (int n : {40, 90}) {\n        memo_calls = 0;\n        long long result = fib_memo(n);\n        std::cout << \"fib_memo(\" << n << \") = \" << result << \" after \"\n                  << memo_calls << \" calls\\n\";\n    }\n    std::cout << \"fib_table(90) = \" << fib_table(90) << '\\n';\n}\n",
        },
        "fails": [
          1,
        ],
      },
    ],
  },
  "07-dynamic-programming#Step 4 \u2014 The build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "07-dynamic-programming#Step 5 \u2014 Coin change: the specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "07-dynamic-programming#Step 6 \u2014 Coin change, bottom-up": {
    "run": [
      configure("dp"),
    ],
    "wrong": [
      {
        "name": "used the greedy strategy",
        "files": {
          "dp/dp.h": "// dp.h: dynamic programming, bottom-up.\n#pragma once\n\n#include <algorithm>\n#include <string>\n#include <vector>\n\n// The fewest coins that add up to amount, using any number of each coin.\n// -1 if no combination of coins makes exactly amount.\ninline int min_coins(const std::vector<int>& coins, int amount)\n{\n    // Greedy: take as many of the biggest coin as fit, then the next.\n    std::vector<int> sorted = coins;\n    std::sort(sorted.rbegin(), sorted.rend());\n    int count = 0;\n    for (int coin : sorted) {\n        count += amount / coin;\n        amount %= coin;\n    }\n    return amount == 0 ? count : -1;\n}\n",
        },
        "run": [
          configure("dp"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "07-dynamic-programming#Step 7 \u2014 Edit distance: the reviewer's tests": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "07-dynamic-programming#Step 8 \u2014 Challenge: edit distance": {
    "wrong": [
      {
        "name": "left the first row and column at zero",
        "files": {
          "dp/dp.h": "// dp.h: dynamic programming, bottom-up.\n#pragma once\n\n#include <algorithm>\n#include <cstddef>\n#include <string>\n#include <vector>\n\n// The fewest coins that add up to amount, using any number of each coin.\n// -1 if no combination of coins makes exactly amount.\ninline int min_coins(const std::vector<int>& coins, int amount)\n{\n    // best[a] = the fewest coins that make a, or -1 if a can't be made.\n    std::vector<int> best(amount + 1, -1);\n    best[0] = 0;                                // zero coins make 0\n    for (int a = 1; a <= amount; ++a) {\n        for (int coin : coins) {\n            if (coin > a || best[a - coin] == -1)\n                continue;   // this coin can't be the last one\n            int with_coin = best[a - coin] + 1;   // a - coin, plus this coin\n            if (best[a] == -1 || with_coin < best[a])\n                best[a] = with_coin;\n        }\n    }\n    return best[amount];\n}\n\n// The fewest single-character insertions, deletions and replacements\n// that turn a into b.\ninline int edit_distance(const std::string& a, const std::string& b)\n{\n    // d[i][j] = the distance between the first i characters of a and the\n    // first j characters of b.\n    std::vector<std::vector<int>> d(a.size() + 1,\n                                    std::vector<int>(b.size() + 1, 0));\n    for (std::size_t i = 1; i <= a.size(); ++i) {\n        for (std::size_t j = 1; j <= b.size(); ++j) {\n            int replace = d[i - 1][j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1);\n            int remove = d[i - 1][j] + 1;\n            int insert = d[i][j - 1] + 1;\n            d[i][j] = std::min({replace, remove, insert});\n        }\n    }\n    return d[a.size()][b.size()];\n}\n",
        },
        "run": [
          configure("dp"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "08-mini-database#Step 1 \u2014 The interface": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "08-mini-database#Step 2 \u2014 The build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "08-mini-database#Step 3 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "08-mini-database#Step 4 \u2014 Version 1: correct first": {
    "run": [
      configure("minidb"),
    ],
    "wrong": [
      {
        "name": "forgot to sort",
        "files": {
          "minidb/db.cpp": "#include \"db.h\"\n\n#include <algorithm>\n\nbool Database::insert(const Record& record)\n{\n    return rows_.insert({record.id, record}).second;   // false if id is taken\n}\n\nbool Database::erase(int id)\n{\n    return rows_.erase(id) == 1;\n}\n\nconst Record* Database::get(int id) const\n{\n    auto found = rows_.find(id);\n    return found == rows_.end() ? nullptr : &found->second;\n}\n\nstd::vector<Record> Database::in_city(const std::string& city) const\n{\n    std::vector<Record> out;\n    for (const auto& [id, record] : rows_) {   // look at every row\n        if (record.city == city)\n            out.push_back(record);\n    }\n    return out;\n}\n\nstd::vector<Record> Database::aged(int lo, int hi) const\n{\n    std::vector<Record> out;\n    for (const auto& [id, record] : rows_) {\n        if (lo <= record.age && record.age <= hi)\n            out.push_back(record);\n    }\n    std::sort(out.begin(), out.end(), [](const Record& a, const Record& b) {\n        if (a.age != b.age)\n            return a.age < b.age;\n        return a.id < b.id;\n    });\n    return out;\n}\n\nstd::size_t Database::size() const\n{\n    return rows_.size();\n}\n",
        },
        "run": [
          configure("minidb"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "08-mini-database#Step 5 \u2014 Measure": {
    "editFiles": {
      "minidb/CMakeLists.txt": [
        [
          "add_executable(db_tests ../testing/test_main.cpp ${TEST_SOURCES} db.cpp)",
          "add_executable(db_tests ../testing/test_main.cpp ${TEST_SOURCES} db.cpp)\n\nadd_executable(db_bench bench.cpp db.cpp)",
        ],
      ],
    },
    "wrong": [
      {
        "name": "forgot the CMake line",
        "typeFile": true,
        "run": [
          configure("minidb"),
        ],
        "fails": [
          0,
          2,
        ],
      },
    ],
  },
  "08-mini-database#Step 6 \u2014 Choose the indexes": {
    "wrong": [
      {
        "name": "indexed age with a hash map too",
        "files": {
          "minidb/db.h": "// db.h: a tiny in-memory database of people.\n#pragma once\n\n#include <cstddef>\n#include <map>\n#include <set>\n#include <string>\n#include <unordered_map>\n#include <vector>\n\nstruct Record {\n    int id;\n    std::string name;\n    std::string city;\n    int age;\n};\n\nclass Database {\npublic:\n    // Adds the record. Returns false, and changes nothing, if its id is taken.\n    bool insert(const Record& record);\n\n    // Removes the record with this id. Returns false if there isn't one.\n    bool erase(int id);\n\n    // The record with this id, or nullptr.\n    const Record* get(int id) const;\n\n    // Everyone in this city, smallest id first.\n    std::vector<Record> in_city(const std::string& city) const;\n\n    // Everyone with lo <= age <= hi, youngest first; for the same age,\n    // smallest id first.\n    std::vector<Record> aged(int lo, int hi) const;\n\n    std::size_t size() const;\n\nprivate:\n    std::unordered_map<int, Record> rows_;   // id -> record\n\n    // Indexes: kept up to date by insert and erase.\n    std::unordered_map<std::string, std::set<int>> by_city_;   // city -> ids\n    std::unordered_map<int, std::set<int>> by_age_;                      // age -> ids\n};\n",
        },
        "fails": [
          1,
        ],
      },
    ],
  },
  "08-mini-database#Step 7 \u2014 Version 2: use the indexes": {
    "wrong": [
      {
        "name": "erase forgot the indexes",
        "files": {
          "minidb/db.cpp": "#include \"db.h\"\n\nbool Database::insert(const Record& record)\n{\n    if (!rows_.insert({record.id, record}).second)\n        return false;                     // id taken: change nothing\n    by_city_[record.city].insert(record.id);\n    by_age_[record.age].insert(record.id);\n    return true;\n}\n\nbool Database::erase(int id)\n{\n    auto found = rows_.find(id);\n    if (found == rows_.end())\n        return false;\n    const Record& record = found->second;\n    (void)record;\n    rows_.erase(found);                   // last: record refers into it\n    return true;\n}\n\nconst Record* Database::get(int id) const\n{\n    auto found = rows_.find(id);\n    return found == rows_.end() ? nullptr : &found->second;\n}\n\nstd::vector<Record> Database::in_city(const std::string& city) const\n{\n    std::vector<Record> out;\n    auto found = by_city_.find(city);         // one hash lookup\n    if (found == by_city_.end())\n        return out;\n    for (int id : found->second)              // a std::set: ids in order\n        out.push_back(rows_.at(id));\n    return out;\n}\n\nstd::vector<Record> Database::aged(int lo, int hi) const\n{\n    std::vector<Record> out;\n    // Jump to the first age >= lo, then walk forward in age order.\n    auto it = by_age_.lower_bound(lo);\n    for (; it != by_age_.end() && it->first <= hi; ++it) {\n        for (int id : it->second)\n            out.push_back(rows_.at(id));\n    }\n    return out;\n}\n\nstd::size_t Database::size() const\n{\n    return rows_.size();\n}\n",
        },
        "run": [
          configure("minidb"),
        ],
        "fails": [
          3,
        ],
      },
    ],
  },
  "08-mini-database#Step 8 \u2014 Challenge: the minidb program": {
    "editFiles": {
      "minidb/CMakeLists.txt": [
        [
          "add_executable(db_bench bench.cpp db.cpp)",
          "add_executable(db_bench bench.cpp db.cpp)\nadd_executable(minidb main.cpp db.cpp)",
        ],
      ],
    },
    "wrong": [
      {
        "name": "printed \"1 rows\"",
        "files": {
          "minidb/main.cpp": "// minidb: type commands to store and query people.\n#include <iostream>\n#include <string>\n#include <vector>\n\n#include \"db.h\"\n\nnamespace {\n\nvoid print(const Record& r)\n{\n    std::cout << r.id << ' ' << r.name << ' ' << r.city << ' ' << r.age\n              << '\\n';\n}\n\nvoid print_all(const std::vector<Record>& rows)\n{\n    for (const Record& r : rows)\n        print(r);\n    std::cout << \"(\" << rows.size()\n              << \" rows\" << \")\\n\";\n}\n\n} // namespace\n\nint main()\n{\n    Database db;\n    std::string command;\n    while (std::cin >> command) {\n        if (command == \"insert\") {\n            Record r;\n            std::cin >> r.id >> r.name >> r.city >> r.age;\n            if (db.insert(r))\n                std::cout << \"inserted \" << r.id << '\\n';\n            else\n                std::cout << \"id \" << r.id << \" already exists\\n\";\n        } else if (command == \"get\") {\n            int id = 0;\n            std::cin >> id;\n            if (const Record* r = db.get(id))\n                print(*r);\n            else\n                std::cout << \"no row \" << id << '\\n';\n        } else if (command == \"delete\") {\n            int id = 0;\n            std::cin >> id;\n            if (db.erase(id))\n                std::cout << \"deleted \" << id << '\\n';\n            else\n                std::cout << \"no row \" << id << '\\n';\n        } else if (command == \"city\") {\n            std::string city;\n            std::cin >> city;\n            print_all(db.in_city(city));\n        } else if (command == \"age\") {\n            int lo = 0;\n            int hi = 0;\n            std::cin >> lo >> hi;\n            print_all(db.aged(lo, hi));\n        } else if (command == \"count\") {\n            std::cout << db.size() << \" rows\\n\";\n        } else {\n            std::cout << \"unknown command: \" << command << '\\n';\n        }\n    }\n}\n",
        },
        "editFiles": {
          "minidb/CMakeLists.txt": [
            [
              "add_executable(db_bench bench.cpp db.cpp)",
              "add_executable(db_bench bench.cpp db.cpp)\nadd_executable(minidb main.cpp db.cpp)",
            ],
          ],
        },
        "run": [
          configure("minidb"),
        ],
        "fails": [
          4,
        ],
      },
    ],
  },
  "08-mini-database#Step 9 \u2014 The reviewer's tests": {
    "wrong": [
      {
        "name": "updated the indexes before checking the id",
        "typeFile": true,
        "files": {
          "minidb/db.cpp": "#include \"db.h\"\n\nbool Database::insert(const Record& record)\n{\n    by_city_[record.city].insert(record.id);\n    by_age_[record.age].insert(record.id);\n    return rows_.insert({record.id, record}).second;\n}\n\nbool Database::erase(int id)\n{\n    auto found = rows_.find(id);\n    if (found == rows_.end())\n        return false;\n    const Record& record = found->second;\n    // Remove the id from both indexes, and drop index entries left empty.\n    auto city = by_city_.find(record.city);\n    city->second.erase(id);\n    if (city->second.empty())\n        by_city_.erase(city);\n    auto age = by_age_.find(record.age);\n    age->second.erase(id);\n    if (age->second.empty())\n        by_age_.erase(age);\n    rows_.erase(found);                   // last: record refers into it\n    return true;\n}\n\nconst Record* Database::get(int id) const\n{\n    auto found = rows_.find(id);\n    return found == rows_.end() ? nullptr : &found->second;\n}\n\nstd::vector<Record> Database::in_city(const std::string& city) const\n{\n    std::vector<Record> out;\n    auto found = by_city_.find(city);         // one hash lookup\n    if (found == by_city_.end())\n        return out;\n    for (int id : found->second)              // a std::set: ids in order\n        out.push_back(rows_.at(id));\n    return out;\n}\n\nstd::vector<Record> Database::aged(int lo, int hi) const\n{\n    std::vector<Record> out;\n    // Jump to the first age >= lo, then walk forward in age order.\n    auto it = by_age_.lower_bound(lo);\n    for (; it != by_age_.end() && it->first <= hi; ++it) {\n        for (int id : it->second)\n            out.push_back(rows_.at(id));\n    }\n    return out;\n}\n\nstd::size_t Database::size() const\n{\n    return rows_.size();\n}\n",
        },
        "run": [
          configure("minidb"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
};
