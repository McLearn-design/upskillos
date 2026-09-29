# Lesson 11.2: `std::optional`, `std::variant`

*Phase 11 — Functional-Style C++*
*A taste of Python's flexible typing, done safely.*

---

## The problem `std::optional` solves: "maybe nothing," expressed honestly

Recall Lesson 8.2's `find` function:

```cpp
bool find(const std::string& key, int& outValue) const;   // Phase 8's HashMap
```

An awkward signature: the actual value comes back through an output parameter, and the return value is really just a "did it work" flag. This pattern is common throughout the curriculum precisely because C++ historically lacked a clean way to say "this function returns a value, or it returns nothing at all, and both are legitimate outcomes." `std::optional<T>` is that clean way:

```cpp
#include <optional>

std::optional<int> findValue(const std::unordered_map<std::string, int>& map, const std::string& key) {
    auto it = map.find(key);
    if (it != map.end()) {
        return it->second;   // implicitly wrapped into std::optional<int>
    }
    return std::nullopt;      // explicitly "nothing"
}
```

```cpp
std::optional<int> result = findValue(myMap, "cat");

if (result.has_value()) {
    std::cout << "found: " << result.value() << std::endl;
} else {
    std::cout << "not found" << std::endl;
}

// or, more idiomatically:
if (result) {                      // std::optional converts to bool — true if it holds a value
    std::cout << "found: " << *result << std::endl;   // * dereferences it, same syntax as a pointer!
}
```

Notice `*result` — `std::optional` deliberately reuses pointer-like syntax (`*` to access, implicit conversion to `bool` to check presence) even though it holds its value **directly, by value, not on the heap** — no `new`, no `delete`, none of Lesson 1.4's heap-management concerns at all. This is a genuinely different thing from `nullptr` (Lesson 1.2): `std::optional<int>` can represent "no int," while a raw `int` has no equivalent — you'd have historically been forced to pick some sentinel value (`-1`, say) to mean "missing," a real, common source of bugs whenever a legitimately valid `-1` value needed to coexist with the "missing" meaning. `std::optional` removes that ambiguity entirely, at the type level, checked by the compiler.

## `std::optional` as a genuine `const T&`-vs-copy improvement over Lesson 8's return style

```cpp
// Lesson 8's style — output parameter, awkward
bool find(const std::string& key, int& outValue) const;

// std::optional style — cleaner, and the RETURN VALUE genuinely carries the "did it work" information
std::optional<int> find(const std::string& key) const;
```

The `std::optional` version reads more naturally at the call site (`if (auto v = map.find("cat"))`) and eliminates the risk of a caller reading `outValue` without checking the boolean return first — a real, if minor, class of bug the older style permitted.

## `std::variant` — a type-safe union

Recall `struct HashNode` back in Phase 8, or `struct Person` in Phase 5's checkpoint — every field had exactly one fixed type. Sometimes a value could genuinely be one of *several* different types, decided at runtime — a JSON-like value that might be a number, a string, or a boolean, say. C, and old-style C++, solved this with `union` — a construct that lets several fields share the same memory, with **no built-in tracking of which one is actually valid at any given moment**, a genuinely dangerous, error-prone tool (reading the wrong union member is undefined behavior, silently). `std::variant` is the modern, safe replacement:

```cpp
#include <variant>

std::variant<int, std::string, bool> value;

value = 42;
std::cout << std::get<int>(value) << std::endl;        // 42

value = std::string("hello");
std::cout << std::get<std::string>(value) << std::endl;   // "hello"

value = true;
// std::get<int>(value);   // THROWS std::bad_variant_access — genuinely CHECKED, unlike a raw union
```

`std::get<T>(value)` reads the currently-held value **if and only if** `T` matches whatever's actually stored — attempting to read the wrong type throws a real, catchable exception, rather than silently reinterpreting memory the way a raw `union` would. This is the entire "type-safe" claim, made concrete: the variant *knows*, at runtime, which of its alternative types is currently active, and enforces that knowledge on every access.

## Checking which type is active

```cpp
if (std::holds_alternative<int>(value)) {
    std::cout << "currently holds an int" << std::endl;
} else if (std::holds_alternative<std::string>(value)) {
    std::cout << "currently holds a string" << std::endl;
}
```

`std::holds_alternative<T>` is the safe, check-first alternative to blindly calling `std::get<T>` and hoping — analogous to `std::optional`'s `has_value()`/implicit-bool check before dereferencing.

## `std::visit` — applying an operation regardless of which type is active

```cpp
#include <iostream>

struct Printer {
    void operator()(int i) const { std::cout << "int: " << i << std::endl; }
    void operator()(const std::string& s) const { std::cout << "string: " << s << std::endl; }
    void operator()(bool b) const { std::cout << "bool: " << (b ? "true" : "false") << std::endl; }
};

std::visit(Printer{}, value);   // calls the CORRECT operator() overload automatically, based on the active type
```

This is worth connecting directly back to Phase 7's Visitor pattern lesson, which explicitly promised a `std::variant`-based alternative and is finally delivering on it. `Printer` defines `operator()` for every alternative type `std::variant<int, std::string, bool>` might hold — this is **operator overloading** (Lesson 2.7's mechanism) applied to the function-call operator `()` specifically, making `Printer` a genuine callable object (a "functor," in C++ terminology). `std::visit` inspects which alternative is actually active and dispatches to the matching overload — functionally identical to Lesson 4.2's `virtual`-based dynamic dispatch, but resolved through `std::variant`'s type-tracking instead of a vtable, and without needing any inheritance relationship between `int`, `std::string`, and `bool` at all (which would be impossible anyway — you can't inherit from `int`).

## Try it yourself

**1. Rewrite Lesson 8's `HashMap::find` to return `std::optional<int>` instead of using an output parameter, and update every call site from earlier exercises to use the new style.** Confirm behavior is identical, and note whether you find the new call sites more or less readable.

**2. Build a `std::variant<int, std::string, bool>`, assign each of the three types to it in turn, and use `std::holds_alternative` to correctly identify which type is active at each step.**

**3. Deliberately call `std::get<int>` on a variant currently holding a `std::string`, wrapped in a `try`/`catch`, and confirm you catch a real `std::bad_variant_access` exception** — direct, hands-on proof of the "genuinely checked, unlike a raw union" claim.

**4. Build the `Printer` functor and use `std::visit` to print a `std::vector<std::variant<int, std::string, bool>>`'s contents, one element at a time, each correctly dispatched to the matching `operator()` overload.** This is a small, real JSON-value-like structure — a direct, concrete preview of what a real JSON library (like Phase 5's `nlohmann::json`) is conceptually doing internally to represent "a value that could be several different JSON types."

## What this cost / bought us

| | Old style | Modern replacement |
|---|---|---|
| "Might not have a value" | Sentinel values (`-1`, `nullptr`) or output parameters + bool | `std::optional<T>` — explicit, type-checked, no ambiguity |
| "Might be one of several types" | Raw `union`, with manual, unchecked bookkeeping of which member is valid | `std::variant<Types...>` — the active type is tracked and enforced at runtime |
| Reading the wrong thing | Undefined behavior, silently | A real, catchable exception |
| Dispatching based on the active type | Manual `if`/`switch` on a hand-maintained tag | `std::visit`, resolved automatically |

Neither tool is conceptually new — `std::optional` is a small wrapper you could have built yourself with a `bool` flag and some careful discipline; `std::variant` is a safer `union`. What they buy is the compiler enforcing correctness that used to depend entirely on programmer discipline — the exact same theme that's run through this whole curriculum since Lesson 2.3's constructors made "forgot to initialize" impossible instead of merely inadvisable.

---

**Next up: Lesson 11.3 — STL algorithms (`transform`, `filter`/`copy_if`, `accumulate`).** The C++ equivalent of Python's `map`/`filter`/`reduce`/comprehensions — genuinely functional-style data processing, built entirely on the iterator interface Phase 7's Iterator pattern already gave your own custom types.
