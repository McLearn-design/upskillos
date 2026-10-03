---
title: 3 — Build a Hash Map
track: Data Structures and Algorithms, Measured
runtime: cpp
reference: optional
console: true
---

Binary search finds a key in O(log n) steps, but only in sorted data, and keeping data sorted makes inserting slow. A **hash map** finds, inserts and erases in O(1) steps on average, by computing *where* a key should be instead of searching for it.

You'll build one, test it, and race it against `std::unordered_map`.

```text
key "apple" ──hash──► 9817263451 ──% 8──► bucket 3

bucket 0: []
bucket 1: [("pear", 5)]
bucket 2: []
bucket 3: [("apple", 3), ("fig", 1)]   ← two keys landed here
...
bucket 7: [("plum", 2)]
```

- A **hash function** turns a key into a big number. The same key always gives the same number; different keys *usually* give different numbers.
- `hash % bucket_count` picks a **bucket**. Looking up a key means hashing it and searching only that bucket.
- When two keys land in the same bucket, that's a **collision**. This map uses **separate chaining**: each bucket is a small vector of entries.

## Step 1 — The interface

**This step: create the supplied `hashmap/hash_map.h` and read it.**

`HashMap` maps `std::string` keys to `int` values.

- `find` returns a **pointer** to the value, or `nullptr` if the key is missing. The caller can test it and change the value through it: `if (int* n = m.find("apple")) ++*n;`. `std::unordered_map::find` returns an iterator for the same reason.
- The **load factor** is entries per bucket. If it grows, chains grow, and lookups slow down. Keeping it at or below `max_load_factor` (1.0) keeps chains short.
- `buckets_` is a vector of buckets; each bucket is a vector of `(key, value)` pairs. `std::pair` holds two values, reached as `.first` and `.second`.

```cpp file=hashmap/hash_map.h provided
// hash_map.h: a hash map from std::string keys to int values,
// using separate chaining: each bucket holds a small vector of entries.
#pragma once

#include <cstddef>
#include <string>
#include <utility>
#include <vector>

class HashMap {
public:
    HashMap();

    // Sets key's value. Returns true if the key was new, false if it was
    // already there (its value is replaced).
    bool insert_or_assign(const std::string& key, int value);

    // The key's value, or nullptr if the key isn't in the map.
    int* find(const std::string& key);
    const int* find(const std::string& key) const;

    // Removes key. Returns true if it was there.
    bool erase(const std::string& key);

    std::size_t size() const;
    std::size_t bucket_count() const;
    double load_factor() const;   // entries per bucket: size() / bucket_count()

    static constexpr double max_load_factor = 1.0;

private:
    using Entry = std::pair<std::string, int>;

    std::size_t bucket_for(const std::string& key) const;
    void rehash(std::size_t new_bucket_count);

    std::vector<std::vector<Entry>> buckets_;
    std::size_t size_;
};
```

```check
file hashmap/hash_map.h
```

## Step 2 — The specification

**This step: create the supplied `hashmap/tests/hash_map_test.cpp` and read it.**

Notice `many_keys_survive`: 10,000 keys, every one found with the right value. A map with only 8 buckets would still pass it, just slowly. Correct isn't the same as fast. That's for later in the lesson.

```cpp file=hashmap/tests/hash_map_test.cpp provided
// Provided by the lesson: what HashMap must do.
#include "studio_test.hpp"

#include <string>

#include "hash_map.h"

TEST(new_map_is_empty)
{
    HashMap m;
    CHECK_EQ(m.size(), 0u);
    CHECK(m.find("anything") == nullptr);
}

TEST(insert_then_find)
{
    HashMap m;
    CHECK(m.insert_or_assign("apple", 3));
    CHECK(m.insert_or_assign("pear", 5));
    CHECK_EQ(m.size(), 2u);
    CHECK(m.find("apple") != nullptr);
    CHECK_EQ(*m.find("apple"), 3);
    CHECK_EQ(*m.find("pear"), 5);
    CHECK(m.find("plum") == nullptr);
}

TEST(assign_replaces_the_value)
{
    HashMap m;
    m.insert_or_assign("apple", 3);
    CHECK(!m.insert_or_assign("apple", 10));
    CHECK_EQ(m.size(), 1u);
    CHECK_EQ(*m.find("apple"), 10);
}

TEST(find_lets_you_change_the_value)
{
    HashMap m;
    m.insert_or_assign("apple", 3);
    *m.find("apple") += 1;
    CHECK_EQ(*m.find("apple"), 4);
}

TEST(erase_removes_only_that_key)
{
    HashMap m;
    m.insert_or_assign("apple", 3);
    m.insert_or_assign("pear", 5);
    CHECK(m.erase("apple"));
    CHECK(!m.erase("apple"));
    CHECK_EQ(m.size(), 1u);
    CHECK(m.find("apple") == nullptr);
    CHECK_EQ(*m.find("pear"), 5);
}

TEST(many_keys_survive)
{
    HashMap m;
    for (int i = 0; i < 10000; ++i)
        m.insert_or_assign("key" + std::to_string(i), i);
    CHECK_EQ(m.size(), 10000u);
    for (int i = 0; i < 10000; ++i) {
        const int* value = m.find("key" + std::to_string(i));
        CHECK(value != nullptr);
        CHECK_EQ(*value, i);
    }
}
```

```check
file hashmap/tests/hash_map_test.cpp
```

## Step 3 — The build file

**This step: create the supplied `hashmap/CMakeLists.txt`.**

The same pattern as lesson 2, with one program for now: `hash_map_tests`, built from the tests and `hash_map.cpp`. It's a Release build, as every project in this track is.

```cmake file=hashmap/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(hashmap LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Timings mean nothing without optimisation: build Release unless
# configured with -DCMAKE_BUILD_TYPE=Debug.
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# Warnings for every target below.
if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# This folder, the benchmark harness and the test framework.
include_directories(. ../bench ../testing)

# Every tests/*_test.cpp file becomes part of the test program.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(hash_map_tests ../testing/test_main.cpp ${TEST_SOURCES} hash_map.cpp)
```

```check
file hashmap/CMakeLists.txt
```

## Step 4 — Hashing and chaining

**This step: create `hashmap/hash_map.cpp`. Start with 8 buckets and no growing. Configure, build and run the tests.**

Every operation starts the same way: hash the key and find its bucket.

```cpp
std::size_t HashMap::bucket_for(const std::string& key) const
{
    return std::hash<std::string>{}(key) % buckets_.size();
}
```

- `std::hash<std::string>{}` creates the standard library's hash function object for strings, and `(key)` calls it. Include `<functional>`.

Then search only that bucket:

```cpp
int* HashMap::find(const std::string& key)
{
    for (Entry& entry : buckets_[bucket_for(key)]) {
        if (entry.first == key)
            return &entry.second;
    }
    return nullptr;
}
```

- The `const` version of `find` is the same, with `const Entry&` and `const int*`.
- `insert_or_assign`: if `find` finds the key, replace its value and return `false`. Otherwise `push_back` a new entry into the key's bucket, count it in `size_`, and return `true`.
- `erase`: order inside a bucket doesn't matter, so remove an entry by moving the bucket's **last** entry into its place and calling `pop_back()`. That's O(1), with no shifting.
- The constructor makes 8 empty buckets: `HashMap::HashMap() : buckets_(8), size_(0) {}`.
- `load_factor` divides `size_` by the bucket count. Convert both to `double` first, or the division rounds down to a whole number.

```text
cmake -S hashmap -B hashmap/build -G "MinGW Makefiles"     (Windows)
cmake -S hashmap -B hashmap/build                          (macOS, Linux)
```

```text
cmake --build hashmap/build
./hashmap/build/hash_map_tests
```

```cpp file=hashmap/hash_map.cpp
#include "hash_map.h"

#include <functional>

HashMap::HashMap() : buckets_(8), size_(0)
{
}

std::size_t HashMap::bucket_for(const std::string& key) const
{
    return std::hash<std::string>{}(key) % buckets_.size();
}

bool HashMap::insert_or_assign(const std::string& key, int value)
{
    if (int* existing = find(key)) {
        *existing = value;   // already there: replace the value
        return false;
    }
    buckets_[bucket_for(key)].push_back({key, value});
    ++size_;
    return true;
}

int* HashMap::find(const std::string& key)
{
    for (Entry& entry : buckets_[bucket_for(key)]) {
        if (entry.first == key)
            return &entry.second;
    }
    return nullptr;
}

const int* HashMap::find(const std::string& key) const
{
    for (const Entry& entry : buckets_[bucket_for(key)]) {
        if (entry.first == key)
            return &entry.second;
    }
    return nullptr;
}

bool HashMap::erase(const std::string& key)
{
    std::vector<Entry>& bucket = buckets_[bucket_for(key)];
    for (std::size_t i = 0; i < bucket.size(); ++i) {
        if (bucket[i].first == key) {
            bucket[i] = std::move(bucket.back());   // order inside a bucket
            bucket.pop_back();                      // doesn't matter
            --size_;
            return true;
        }
    }
    return false;
}

std::size_t HashMap::size() const
{
    return size_;
}

std::size_t HashMap::bucket_count() const
{
    return buckets_.size();
}

double HashMap::load_factor() const
{
    return static_cast<double>(size_) / static_cast<double>(buckets_.size());
}
```

```check
file hashmap/build/CMakeCache.txt label="hashmap/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build hashmap/build" -- Define every member declared in hash_map.h except rehash, which comes later.
tests "./hashmap/build/hash_map_tests" require="assign_replaces_the_value erase_removes_only_that_key many_keys_survive" -- insert_or_assign must look for the key first, and replace its value if it is already there.
```

## Step 5 — Predict: 8 buckets, 100,000 keys

**This step: create the supplied `hashmap/tests/growth_test.cpp`, then answer the prediction.**

The new test asks the map to keep its load factor at or below `max_load_factor` as it fills, and so to end up with at least 1,000 buckets for 1,000 keys. The tests will fail until you implement growing in the next step.

**Predict:** with 8 buckets and no growing, how many entries does a lookup search, on average, once the map holds 100,000 keys? What's the Big-O of `find`, then?

### Answer

About 100,000 / 8 = 12,500 per bucket, so a lookup compares against thousands of keys: **O(n)**. A hash map's O(1) is a promise *only while the load factor stays bounded*. The fix is to **rehash**: when the map gets too full, make more buckets and move every entry to its new bucket.

```cpp file=hashmap/tests/growth_test.cpp provided
// Provided by the lesson: HashMap must grow as it fills.
#include "studio_test.hpp"

#include <string>

#include "hash_map.h"

TEST(grows_to_keep_the_load_factor_low)
{
    HashMap m;
    for (int i = 0; i < 1000; ++i) {
        m.insert_or_assign("key" + std::to_string(i), i);
        CHECK(m.load_factor() <= HashMap::max_load_factor);
    }
    CHECK(m.bucket_count() >= 1000u);
}
```

```check
file hashmap/tests/growth_test.cpp
```

## Step 6 — Rehash

**This step: implement `rehash`, and call it from `insert_or_assign` when one more entry would push the load factor over `max_load_factor`. Double the bucket count each time.**

```cpp
void HashMap::rehash(std::size_t new_bucket_count)
{
    std::vector<std::vector<Entry>> old = std::move(buckets_);
    buckets_ = std::vector<std::vector<Entry>>(new_bucket_count);
    for (std::vector<Entry>& bucket : old) {
        for (Entry& entry : bucket) {   // to its new bucket
            std::size_t b = bucket_for(entry.first);
            buckets_[b].push_back(std::move(entry));
        }
    }
}
```

- An entry's bucket is `hash % bucket_count`. Change the bucket count and almost every key belongs somewhere new, so **every** entry must be redistributed. Just making the vector of buckets bigger would leave keys stranded in buckets `find` never looks in.
- `std::move(buckets_)` hands the old buckets to `old` without copying them (track 2, lesson 5), and `std::move(entry)` moves each key string instead of copying it.

In `insert_or_assign`, grow *before* choosing the bucket for the new entry:

```cpp
if (static_cast<double>(size_ + 1) > max_load_factor * buckets_.size())
    rehash(buckets_.size() * 2);
```

**Why double?** A rehash costs O(n). Doubling means the next one is n inserts away, so the cost averages out to O(1) per insert: the same **amortised** argument as `std::vector`'s growth.

```cpp file=hashmap/hash_map.cpp
#include "hash_map.h"

#include <functional>

HashMap::HashMap() : buckets_(8), size_(0)
{
}

std::size_t HashMap::bucket_for(const std::string& key) const
{
    return std::hash<std::string>{}(key) % buckets_.size();
}

bool HashMap::insert_or_assign(const std::string& key, int value)
{
    if (int* existing = find(key)) {
        *existing = value;   // already there: replace the value
        return false;
    }
    if (static_cast<double>(size_ + 1) > max_load_factor * buckets_.size())
        rehash(buckets_.size() * 2);   // too full: double the buckets first
    buckets_[bucket_for(key)].push_back({key, value});
    ++size_;
    return true;
}

int* HashMap::find(const std::string& key)
{
    for (Entry& entry : buckets_[bucket_for(key)]) {
        if (entry.first == key)
            return &entry.second;
    }
    return nullptr;
}

const int* HashMap::find(const std::string& key) const
{
    for (const Entry& entry : buckets_[bucket_for(key)]) {
        if (entry.first == key)
            return &entry.second;
    }
    return nullptr;
}

bool HashMap::erase(const std::string& key)
{
    std::vector<Entry>& bucket = buckets_[bucket_for(key)];
    for (std::size_t i = 0; i < bucket.size(); ++i) {
        if (bucket[i].first == key) {
            bucket[i] = std::move(bucket.back());   // order inside a bucket
            bucket.pop_back();                      // doesn't matter
            --size_;
            return true;
        }
    }
    return false;
}

std::size_t HashMap::size() const
{
    return size_;
}

std::size_t HashMap::bucket_count() const
{
    return buckets_.size();
}

double HashMap::load_factor() const
{
    return static_cast<double>(size_) / static_cast<double>(buckets_.size());
}

void HashMap::rehash(std::size_t new_bucket_count)
{
    std::vector<std::vector<Entry>> old = std::move(buckets_);
    buckets_ = std::vector<std::vector<Entry>>(new_bucket_count);
    for (std::vector<Entry>& bucket : old) {
        for (Entry& entry : bucket) {   // to its new bucket
            std::size_t b = bucket_for(entry.first);
            buckets_[b].push_back(std::move(entry));
        }
    }
}
```

```check
run "cmake --build hashmap/build"
tests "./hashmap/build/hash_map_tests" require="grows_to_keep_the_load_factor_low many_keys_survive" -- Rehash before adding the entry, and move every old entry into the bucket bucket_for gives it now.
```

## Step 7 — Race std::unordered_map

**This step: create the supplied `hashmap/main.cpp`, add a `compare` program to `hashmap/CMakeLists.txt`, build it and run it.**

Add this line at the end of `CMakeLists.txt`:

```cmake
add_executable(compare main.cpp hash_map.cpp)
```

`main.cpp` inserts 200,000 keys into each map and then finds every one, and checks the two maps agree.

**Predict:** `std::unordered_map` was written by experts and tuned for years. How much faster than yours will it be?

```text
cmake --build hashmap/build
./hashmap/build/compare
```

```cpp file=hashmap/main.cpp provided
// Races your HashMap against std::unordered_map.
#include <cstdint>
#include <iomanip>
#include <iostream>
#include <string>
#include <unordered_map>
#include <vector>

#include "bench.h"
#include "hash_map.h"

int main()
{
    const int n = 200'000;
    std::vector<std::string> keys;
    for (int i = 0; i < n; ++i)
        keys.push_back("user" + std::to_string(i * 7919));

    // The same work for both maps: insert every key, then find each one.
    double mine = bench::median_ns([&] {
        HashMap m;
        for (int i = 0; i < n; ++i)
            m.insert_or_assign(keys[i], i);
        std::uint64_t total = 0;
        for (const std::string& key : keys)
            total += static_cast<std::uint64_t>(*m.find(key));
        bench::keep(total);
    }, 5);
    double theirs = bench::median_ns([&] {
        std::unordered_map<std::string, int> m;
        for (int i = 0; i < n; ++i)
            m.insert_or_assign(keys[i], i);
        std::uint64_t total = 0;
        for (const std::string& key : keys)
            total += static_cast<std::uint64_t>(m.find(key)->second);
        bench::keep(total);
    }, 5);

    std::cout << "Insert " << n << " keys, then find each one:\n"
              << std::fixed << std::setprecision(1)
              << "  HashMap              " << std::setw(7) << mine / 1e6
              << " ms\n"
              << "  std::unordered_map   " << std::setw(7) << theirs / 1e6
              << " ms\n";

    // Do they agree?
    HashMap m;
    std::unordered_map<std::string, int> um;
    for (int i = 0; i < n; ++i) {
        m.insert_or_assign(keys[i], i);
        um[keys[i]] = i;
    }
    int agree = 0;
    for (const std::string& key : keys) {
        if (m.find(key) != nullptr && *m.find(key) == um.at(key))
            ++agree;
    }
    std::cout << "both maps agree on " << agree << " of " << n << " keys\n";
    std::cout << "HashMap: " << m.size() << " entries in "
              << m.bucket_count() << " buckets\n";
}
```

### What happened

```text
Insert 200000 keys, then find each one:
  HashMap                 75.3 ms
  std::unordered_map      73.3 ms
```

About the same, and with some compilers yours wins. That's not because yours is clever: `std::unordered_map` *also* uses separate chaining, and pays for something yours doesn't promise. The standard requires that a reference to an element stays valid when the map rehashes, so every element must live in its own heap-allocated node. Your entries live inside bucket vectors and move when the map grows.

Faster hash maps (Abseil's `flat_hash_map`, Boost's `unordered_flat_map`) use **open addressing**: all entries in one array, and a collision moves on to the next free slot. No pointers to chase: lesson 2's cache lesson again.

**Experiment:** make `bucket_for` return `key.size() % buckets_.size()`. Every key here has a similar length, so nearly everything collides. Watch your map's time explode, then put it back. A hash map is only as good as its hash function.

```check
contains hashmap/CMakeLists.txt "add_executable(compare" -- Add add_executable(compare main.cpp hash_map.cpp) to the end of CMakeLists.txt.
run "cmake --build hashmap/build"
run "./hashmap/build/compare" stdout="both maps agree on 200000 of 200000 keys"
run "./hashmap/build/compare" stdout="200000 entries in 262144 buckets" -- Start with 8 buckets and double whenever the load factor would pass 1.0.
```

## Step 8 — The reviewer's tests

**This step: create the supplied `hashmap/tests/hash_map_review_test.cpp`, rebuild, and fix `hash_map.cpp` if any test fails.**

A reviewer's tests probe the edges: erasing from an empty map, erasing many keys and checking that the others survive, the empty string as a key, `find` on a `const` map, and overwriting one key many times, which must never grow the map.

```cpp file=hashmap/tests/hash_map_review_test.cpp provided
// The reviewer's tests for HashMap. Do not edit them: make them pass.
#include "studio_test.hpp"

#include <string>

#include "hash_map.h"

TEST(review_erase_from_an_empty_map)
{
    HashMap m;
    CHECK(!m.erase("ghost"));
    CHECK_EQ(m.size(), 0u);
}

TEST(review_erase_keeps_every_other_key)
{
    HashMap m;
    for (int i = 0; i < 100; ++i)
        m.insert_or_assign("k" + std::to_string(i), i);
    for (int i = 0; i < 100; i += 2)
        CHECK(m.erase("k" + std::to_string(i)));
    CHECK_EQ(m.size(), 50u);
    for (int i = 0; i < 100; ++i) {
        const int* value = m.find("k" + std::to_string(i));
        if (i % 2 == 0) {
            CHECK(value == nullptr);
        } else {
            CHECK(value != nullptr);
            CHECK_EQ(*value, i);
        }
    }
}

TEST(review_erase_then_insert_again)
{
    HashMap m;
    m.insert_or_assign("x", 1);
    m.erase("x");
    CHECK(m.insert_or_assign("x", 2));
    CHECK_EQ(m.size(), 1u);
    CHECK_EQ(*m.find("x"), 2);
}

TEST(review_empty_string_is_a_key)
{
    HashMap m;
    m.insert_or_assign("", 42);
    CHECK_EQ(*m.find(""), 42);
    CHECK(m.find(" ") == nullptr);
}

TEST(review_find_on_a_const_map)
{
    HashMap m;
    m.insert_or_assign("apple", 3);
    const HashMap& view = m;
    CHECK(view.find("apple") != nullptr);
    CHECK_EQ(*view.find("apple"), 3);
    CHECK(view.find("pear") == nullptr);
}

TEST(review_overwrites_never_grow_the_map)
{
    HashMap m;
    for (int round = 0; round < 50; ++round)
        m.insert_or_assign("same", round);
    CHECK_EQ(m.size(), 1u);
    CHECK_EQ(m.bucket_count(), 8u);
    CHECK_EQ(*m.find("same"), 49);
}
```

```check
file hashmap/tests/hash_map_review_test.cpp
run "cmake --build hashmap/build"
tests "./hashmap/build/hash_map_tests" require="review_erase_keeps_every_other_key review_overwrites_never_grow_the_map" -- erase must move the bucket's last entry into the erased one's place before pop_back().
```
