---
title: 7 — Structs, References and const: an Inventory
track: C++ Foundations — Thinking in Types
runtime: cpp
reference: optional
console: true
---

`int`, `double` and `std::string` only go so far. Real programs model *things*: an inventory item has a name, a quantity and a price that belong together. In C++ you define your own types for that.

This lesson also tackles the biggest difference between C++ and Python: **C++ copies values by default.** In Python, `b = a` gives one object two names. In C++, `Item b = a;` makes a second, independent `Item`. That's usually exactly what you want, and occasionally a bug. You'll meet both.

The project is `inventory/`, set up like the others: a library (`inventory.h` and `inventory.cpp`), a program (`main.cpp`) and tests.

## Step 1 — The project's build file

**This step: create the supplied `inventory/CMakeLists.txt`.**

```cmake file=inventory/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(inventory LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(inventory main.cpp inventory.cpp)

# Every tests/*_test.cpp file becomes part of the test program.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(inventory_tests ../testing/test_main.cpp ${TEST_SOURCES} inventory.cpp)
target_include_directories(inventory_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)

foreach(target inventory inventory_tests)
    if(MSVC)
        target_compile_options(${target} PRIVATE /W4)
    else()
        target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic)
    endif()
endforeach()
```

```check
file inventory/CMakeLists.txt
```

## Step 2 — A placeholder main

**This step: create the supplied `inventory/main.cpp`.**

```cpp file=inventory/main.cpp provided
#include <iostream>

#include "inventory.h"

int main()
{
    // You will print the inventory here in the final step.
    return 0;
}
```

```check
file inventory/main.cpp
```

## Step 3 — The specification for Item

**This step: create the supplied `inventory/tests/item_test.cpp` and read it.**

These tests use a type that doesn't exist yet. Reading them tells you what it must look like: it has a `name`, a `quantity` and a `price`, it can be created with `{"bolts", 120, 0.25}`, and an `Item` created with no values starts with zero quantity and price.

```cpp file=inventory/tests/item_test.cpp provided
// Provided by the lesson.
#include "studio_test.hpp"

#include "inventory.h"

TEST(item_holds_its_fields)
{
    Item bolts {"bolts", 120, 0.25};
    CHECK_EQ(bolts.name, std::string("bolts"));
    CHECK_EQ(bolts.quantity, 120);
    CHECK_NEAR(bolts.price, 0.25, 1e-12);
}

TEST(item_fields_default_to_zero)
{
    Item nothing;
    CHECK_EQ(nothing.quantity, 0);
    CHECK_NEAR(nothing.price, 0.0, 1e-12);
    CHECK(nothing.name.empty());
}

TEST(total_value_adds_quantity_times_price)
{
    const std::vector<Item> items {{"bolts", 120, 0.25}, {"nuts", 80, 0.10}};
    CHECK_NEAR(total_value(items), 38.0, 1e-9);
}

TEST(total_value_of_empty_inventory_is_zero)
{
    CHECK_NEAR(total_value({}), 0.0, 1e-12);
}
```

```check
file inventory/tests/item_test.cpp
```

## Step 4 — Your own type

**This step: create `inventory/inventory.h` defining `struct Item` and declaring `total_value`.**

A `struct` groups named values, called **members**, into one new type:

```cpp
struct Item {
    std::string name;
    int quantity = 0;      // default member initialiser: used when no value is given
    double price = 0.0;
};                         // this semicolon is required
```

Create and use one:

```cpp
Item bolts {"bolts", 120, 0.25};   // members in the order they're declared
Item nothing;                      // name "", quantity 0, price 0.0
bolts.quantity += 10;              // reach a member with .
```

Also declare the function the tests call:

```cpp
double total_value(const std::vector<Item>& items);   // the sum of quantity × price
```

```cpp file=inventory/inventory.h
#pragma once

#include <string>
#include <vector>

struct Item {
    std::string name;
    int quantity = 0;
    double price = 0.0;
};

double total_value(const std::vector<Item>& items);
```

```check
matches inventory/inventory.h "\bstruct\s+Item\b" label="inventory.h defines struct Item"
matches inventory/inventory.h "double\s+total_value\s*\(\s*const\s+std::vector<\s*Item\s*>\s*&" label="inventory.h declares total_value taking const std::vector<Item>&"
```

## Step 5 — Implement total_value

**This step: create `inventory/inventory.cpp`, then configure, build and run the tests.**

```cpp
for (const Item& item : items)
    total += item.quantity * item.price;
```

- `const Item& item` looks at each item in place, without copying it, and promises not to change it.

```text
cmake -S inventory -B inventory/build -G "MinGW Makefiles"     (Windows)
cmake -S inventory -B inventory/build                          (macOS, Linux)
cmake --build inventory/build --target inventory_tests
./inventory/build/inventory_tests
```

```cpp file=inventory/inventory.cpp
#include "inventory.h"

double total_value(const std::vector<Item>& items)
{
    double total = 0;
    for (const Item& item : items)
        total += item.quantity * item.price;
    return total;
}
```

```check
file inventory/build/CMakeCache.txt label="inventory/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build inventory/build --target inventory_tests" -- The struct needs ; after its closing }. Members with defaults: int quantity = 0;
tests "./inventory/build/inventory_tests" require="item_fields_default_to_zero" -- Give quantity and price default member initialisers.
```

## Step 6 — A teammate's restock function

**This step: create the supplied `inventory/restock.h` and read it.**

A teammate has written `restock`, which adds stock to an item. It's short enough to live in a header: `inline` lets a function be *defined* in a header that several `.cpp` files include, without the linker complaining that it's defined more than once.

Read it carefully. It looks right.

```cpp file=inventory/restock.h provided
#pragma once

#include "inventory.h"

// Adds `amount` to the item's quantity.
inline void restock(Item item, int amount)
{
    item.quantity += amount;
}
```

```check
file inventory/restock.h
```

## Step 7 — The bug that copies

**This step: create the supplied `inventory/tests/restock_test.cpp`, build and run the tests, and investigate the failure before you fix anything.**

```text
CHECK_EQ(nuts.quantity, 100) failed
    left:  80
    right: 100
```

`restock` clearly adds `amount` to the quantity, so why didn't `nuts` change?

**Investigate first.** Write a tiny `scratch.cpp` that makes an `Item`, calls `restock`, and prints the quantity *inside* `restock` (add a temporary `std::cout`) and again *after* it returns. Or open it in **🔬 Trace in CodeLens** and watch the two `quantity` values in the stack panel: one in `restock`'s frame, one in `main`'s.

### What's happening

```cpp
inline void restock(Item item, int amount)    // item is a COPY of the caller's object
```

A parameter is a new variable, initialised by **copying** the argument. `restock` updates its own copy, which is destroyed when the function returns. The caller's `nuts` is never touched.

```cpp file=inventory/tests/restock_test.cpp provided
// Provided by the lesson. Don't change this test: fix restock instead.
#include "studio_test.hpp"

#include "restock.h"

TEST(restock_increases_the_quantity)
{
    Item nuts {"nuts", 80, 0.10};
    restock(nuts, 20);
    CHECK_EQ(nuts.quantity, 100);
}
```

```check
file inventory/tests/restock_test.cpp
run "cmake --build inventory/build --target inventory_tests"
run "./inventory/build/inventory_tests" exit=1 stdout="[  FAILED  ] restock_increases_the_quantity" label="the restock test fails, as it should for now" -- Create the provided files without fixing restock yet.
```

## Step 8 — Fix it with a reference

**This step: change `restock` in `inventory/restock.h` to take the item by reference.**

```cpp
inline void restock(Item& item, int amount)   // item IS the caller's object, under another name
```

- A **reference** (`Item&`) is another name for an existing object. No copy is made, and changes go straight to the original.

```cpp file=inventory/restock.h
#pragma once

#include "inventory.h"

// Adds `amount` to the item's quantity.
inline void restock(Item& item, int amount)
{
    item.quantity += amount;
}
```

```check
matches inventory/restock.h "restock\s*\(\s*Item\s*&" label="restock takes the item by reference"
run "cmake --build inventory/build --target inventory_tests"
tests "./inventory/build/inventory_tests" -- Item& item: then item IS the caller's object.
```

## Step 9 — Predict: choosing a parameter type

**This step: think it through. No file changes.**

You're writing `print_item`, which only reads an `Item` to display it.

```cpp
void a(Item item);           // a copy
void b(Item& item);          // the caller's item, may change it
void c(const Item& item);    // the caller's item, read-only
void d(Item* item);          // its address, which may be null
```

**Predict:** which is best for `print_item`, and what's wrong with each of the others?

### The answer

`const Item&`: no copy, and `const` is a compiler-checked promise not to change it. That's the default for passing anything bigger than a few numbers into a function that only reads it.

- `Item` works, but copies the whole item, string included, on every call.
- `Item&` tells every reader that `print_item` might change the item, and it can't accept a `const Item`.
- `Item*` could be null, so the function would have to handle "no item", and callers must write `&item`. Prefer references when "no object" isn't a valid input.

## Step 10 — Maybe there's an answer: the specification

**This step: create the supplied `inventory/tests/find_test.cpp` and read it.**

In *C++ from Zero*, `find_item` returned `nullptr` for "not found", and the caller forgot to check and crashed. These tests ask for a function whose **return type** says "there might be no answer".

```cpp file=inventory/tests/find_test.cpp provided
// Provided by the lesson.
#include "studio_test.hpp"

#include "inventory.h"

#include <optional>

TEST(find_index_finds_an_item_by_name)
{
    const std::vector<Item> items {{"bolts", 120, 0.25}, {"nuts", 80, 0.10}};
    const std::optional<std::size_t> i = find_index(items, "nuts");
    CHECK(i.has_value());
    CHECK_EQ(*i, 1u);
}

TEST(find_index_reports_missing_items)
{
    const std::vector<Item> items {{"bolts", 120, 0.25}};
    CHECK(!find_index(items, "screws").has_value());
    CHECK(!find_index({}, "bolts").has_value());
}
```

```check
file inventory/tests/find_test.cpp
```

## Step 11 — Declare find_index with std::optional

**This step: add `find_index` to `inventory/inventory.h`.**

```cpp
#include <optional>

std::optional<std::size_t> find_index(const std::vector<Item>& items, const std::string& name);
```

- `std::optional<T>` either holds a `T` or holds nothing (`std::nullopt`).
- The type itself tells every caller to check: `if (auto i = find_index(stock, "nuts")) { use stock[*i]; }`.
- `*i` gets the value out of an optional that has one.

```cpp file=inventory/inventory.h
#pragma once

#include <optional>
#include <string>
#include <vector>

struct Item {
    std::string name;
    int quantity = 0;
    double price = 0.0;
};

double total_value(const std::vector<Item>& items);

// Position of the item called `name`, or std::nullopt if there is none.
std::optional<std::size_t> find_index(const std::vector<Item>& items, const std::string& name);
```

```check
contains inventory/inventory.h "#include <optional>"
matches inventory/inventory.h "std::optional<\s*std::size_t\s*>\s+find_index\s*\(" label="inventory.h declares find_index"
```

## Step 12 — Implement find_index

**This step: add the definition to `inventory/inventory.cpp`.**

Return the position of the first item with that name, or `std::nullopt` if there isn't one. Returning `i` from a function whose return type is `std::optional<std::size_t>` wraps it in an optional automatically.

```cpp file=inventory/inventory.cpp
#include "inventory.h"

double total_value(const std::vector<Item>& items)
{
    double total = 0;
    for (const Item& item : items)
        total += item.quantity * item.price;
    return total;
}

std::optional<std::size_t> find_index(const std::vector<Item>& items, const std::string& name)
{
    for (std::size_t i = 0; i < items.size(); ++i) {
        if (items[i].name == name)
            return i;
    }
    return std::nullopt;
}
```

```check
run "cmake --build inventory/build --target inventory_tests"
tests "./inventory/build/inventory_tests" require="find_index_reports_missing_items" -- After the loop, return std::nullopt.
```

## Step 13 — Challenge: categories (the header)

**This step: no code is given. Add categories to `inventory/inventory.h`.**

Every item now needs a category: tool, part or consumable.

```cpp
enum class Category { Tool, Part, Consumable };
```

- An **`enum class`** is a type with a fixed set of named values. You write `Category::Tool`. It doesn't silently convert to `int`, and it can't be confused with any other enum.

Requirements:

1. Define `Category` **above** `struct Item`, which will use it.
2. Add `Category category = Category::Part;` as the **last** member of `Item`, so existing code like `{"bolts", 120, 0.25}` still compiles.
3. Declare `int count_in(const std::vector<Item>& items, Category category);`, the total *quantity* in that category, and `std::string to_string(Category category);`, which gives `"tool"`, `"part"` or `"consumable"`.

```cpp file=inventory/inventory.h
#pragma once

#include <optional>
#include <string>
#include <vector>

enum class Category { Tool, Part, Consumable };

struct Item {
    std::string name;
    int quantity = 0;
    double price = 0.0;
    Category category = Category::Part;
};

double total_value(const std::vector<Item>& items);

// Position of the item called `name`, or std::nullopt if there is none.
std::optional<std::size_t> find_index(const std::vector<Item>& items, const std::string& name);

// Total quantity of all items in `category`.
int count_in(const std::vector<Item>& items, Category category);

std::string to_string(Category category);
```

```check
matches inventory/inventory.h "enum\s+class\s+Category\b" label="inventory.h defines enum class Category"
matches inventory/inventory.h "Category\s+category\s*=\s*Category::Part" label="Item has a category that defaults to Part"
run "cmake --build inventory/build --target inventory_tests" -- The enum must come before struct Item, which uses it.
```

## Step 14 — Challenge: categories (the implementation)

**This step: no code is given. Define `count_in` and `to_string` in `inventory/inventory.cpp`.**

Use a `switch` for `to_string`. **Try this:** leave one `case` out and build. With warnings on, the compiler tells you which enumerator you forgot. That's a big reason to prefer `switch` over `if` chains for enums.

```cpp file=inventory/inventory.cpp
#include "inventory.h"

double total_value(const std::vector<Item>& items)
{
    double total = 0;
    for (const Item& item : items)
        total += item.quantity * item.price;
    return total;
}

std::optional<std::size_t> find_index(const std::vector<Item>& items, const std::string& name)
{
    for (std::size_t i = 0; i < items.size(); ++i) {
        if (items[i].name == name)
            return i;
    }
    return std::nullopt;
}

int count_in(const std::vector<Item>& items, Category category)
{
    int total = 0;
    for (const Item& item : items) {
        if (item.category == category)
            total += item.quantity;
    }
    return total;
}

std::string to_string(Category category)
{
    switch (category) {
    case Category::Tool: return "tool";
    case Category::Part: return "part";
    case Category::Consumable: return "consumable";
    }
    return "unknown";
}
```

```check
contains inventory/inventory.cpp "count_in"
contains inventory/inventory.cpp "to_string"
run "cmake --build inventory/build --target inventory_tests" -- Definitions must match the declarations in inventory.h.
```

## Step 15 — Print the inventory

**This step: write `inventory/main.cpp` to build this inventory and print it.**

```text
bolts (part): 120
wrench (tool): 2
oil (consumable): 5
total value: 69
```

Build the vector with four values per item, such as `{"wrench", 2, 12.0, Category::Tool}`, then loop and print.

```cpp file=inventory/main.cpp
#include <iostream>

#include "inventory.h"

int main()
{
    std::vector<Item> items {
        {"bolts", 120, 0.25, Category::Part},
        {"wrench", 2, 12.0, Category::Tool},
        {"oil", 5, 3.0, Category::Consumable},
    };
    for (const Item& item : items)
        std::cout << item.name << " (" << to_string(item.category) << "): " << item.quantity << '\n';
    std::cout << "total value: " << total_value(items) << '\n';
    return 0;
}
```

```check
run "cmake --build inventory/build --target inventory" -- Build each item with four values, e.g. {"wrench", 2, 12.0, Category::Tool}
run "./inventory/build/inventory" stdout="bolts (part): 120\nwrench (tool): 2\noil (consumable): 5\ntotal value: 69"
```

## Step 16 — The reviewer's tests

**This step: create the supplied `inventory/tests/category_review_test.cpp`, run the tests, and fix `inventory.cpp` if any fail.**

```cpp file=inventory/tests/category_review_test.cpp provided
// The reviewer's tests for categories. Do not edit them: make them pass.
#include "studio_test.hpp"

#include "inventory.h"

TEST(review_item_category_defaults_to_part)
{
    Item i {"bolts", 1, 0.5};
    CHECK(i.category == Category::Part);
}

TEST(review_count_in_counts_units_per_category)
{
    std::vector<Item> items {{"bolts", 120, 0.25}, {"nuts", 80, 0.10}, {"wrench", 2, 12.0}, {"oil", 5, 3.0}};
    items[2].category = Category::Tool;
    items[3].category = Category::Consumable;
    CHECK_EQ(count_in(items, Category::Part), 200);
    CHECK_EQ(count_in(items, Category::Tool), 2);
    CHECK_EQ(count_in(items, Category::Consumable), 5);
    CHECK_EQ(count_in({}, Category::Tool), 0);
}

TEST(review_category_names)
{
    CHECK_EQ(to_string(Category::Tool), std::string("tool"));
    CHECK_EQ(to_string(Category::Part), std::string("part"));
    CHECK_EQ(to_string(Category::Consumable), std::string("consumable"));
}
```

```check
file inventory/tests/category_review_test.cpp
run "cmake --build inventory/build --target inventory_tests"
tests "./inventory/build/inventory_tests" require="review_count_in_counts_units_per_category" -- count_in adds up quantities, not the number of items.
```
