# Lesson 12.3: JSON with `nlohmann/json` — Serialize/Deserialize Your Own Classes

*Phase 12 — Persistence Layer: Files, JSON, XML, CSV, SQLite*

---

## Closing the read-only loop

Phase 5's checkpoint read JSON into a `PersonList`. Phase 9's checkpoint read JSON from a live API. Every use so far has been one direction: JSON file or response → C++ objects. This lesson closes the loop with the other direction — C++ objects → JSON — and then shows how `nlohmann/json` lets you automate the conversion so it isn't written by hand at every call site.

## Manual serialization — building a `json` object field by field

```cpp
#include <nlohmann/json.hpp>

struct Person {
    std::string name;
    int age;
    std::vector<std::string> hobbies;
};

nlohmann::json personToJson(const Person& p) {
    nlohmann::json j;
    j["name"] = p.name;
    j["age"] = p.age;
    j["hobbies"] = p.hobbies;   // nlohmann::json handles std::vector<std::string> automatically
    return j;
}

Person jsonToPerson(const nlohmann::json& j) {
    Person p;
    p.name = j["name"];
    p.age = j["age"];
    p.hobbies = j["hobbies"].get<std::vector<std::string>>();   // explicit .get<T>() for a container type
    return p;
}
```

```cpp
Person alice{"Alice", 30, {"reading", "chess"}};

nlohmann::json j = personToJson(alice);
std::cout << j.dump(2) << std::endl;   // dump(2) = pretty-print with 2-space indentation
```

Output:
```json
{
  "name": "Alice",
  "age": 30,
  "hobbies": ["reading", "chess"]
}
```

`j["hobbies"] = p.hobbies;` is doing real, non-trivial work silently: `nlohmann::json` has built-in support for converting `std::vector<T>` into a JSON array, for any `T` it already knows how to convert — recursively, automatically. This is worth noticing as a genuine application of Lesson 10.3's templates, used inside a real, widely-used library rather than just in this curriculum's own exercises.

## Writing to a file, and reading it back

```cpp
void savePerson(const Person& p, const std::string& filename) {
    nlohmann::json j = personToJson(p);
    std::ofstream file(filename);
    file << j.dump(2);   // write the formatted JSON text to disk — Lesson 12.1's text-mode fstream, doing real work
}

Person loadPerson(const std::string& filename) {
    std::ifstream file(filename);
    nlohmann::json j;
    file >> j;   // Phase 5's exact parsing pattern
    return jsonToPerson(j);
}
```

```cpp
int main() {
    Person alice{"Alice", 30, {"reading", "chess"}};
    savePerson(alice, "alice.json");

    Person loaded = loadPerson("alice.json");
    std::cout << loaded.name << ", " << loaded.age << std::endl;

    return 0;
}
```

A full round trip: a real C++ object, serialized to a real file, read back into a genuinely new, independent object — direct, practical **persistence**, the actual subject this phase is named for.

## Automating the conversion: `to_json`/`from_json`

Writing `personToJson`/`jsonToPerson` by hand, for every type, is real, repetitive work — exactly the kind of duplication this curriculum has repeatedly eliminated with generic tools (templates, Lesson 10.3; the Repository pattern, arriving later this phase). `nlohmann::json` provides a hook: define two specifically-named free functions, and the library's own `=` and `.get<T>()` machinery picks them up automatically.

```cpp
void to_json(nlohmann::json& j, const Person& p) {
    j = nlohmann::json{
        {"name", p.name},
        {"age", p.age},
        {"hobbies", p.hobbies}
    };
}

void from_json(const nlohmann::json& j, Person& p) {
    j.at("name").get_to(p.name);
    j.at("age").get_to(p.age);
    j.at("hobbies").get_to(p.hobbies);
}
```

Once these two functions exist (the library finds them via a mechanism called **argument-dependent lookup**, a real C++ feature worth knowing the name of even without diving into its full mechanics here — it's how the compiler finds `to_json`/`from_json` automatically based on the argument types involved, without you needing to explicitly register anything), `nlohmann::json` treats `Person` as a first-class type it already knows how to convert:

```cpp
Person alice{"Alice", 30, {"reading", "chess"}};

nlohmann::json j = alice;         // implicit conversion — calls YOUR to_json automatically
Person loaded = j.get<Person>();   // implicit conversion — calls YOUR from_json automatically
```

No more `personToJson`/`jsonToPerson` wrapper functions needed anywhere — `Person` now behaves like any of the library's own built-in types (`int`, `std::string`, `std::vector`) as far as JSON conversion goes. This is a genuine, real-world instance of a broader idea worth naming directly: **a well-designed library doesn't just solve problems for the types it already knows about — it provides an extension point (here, `to_json`/`from_json`) that lets your own types plug into the same machinery, uniformly.** You've seen this shape before, in a different form: Lesson 7's Iterator pattern let your own `BST` plug into the STL's generic algorithms by implementing the expected interface; this lesson's `to_json`/`from_json` hook is the identical idea, applied to a serialization library instead of the algorithm library.

## Nested objects — serializing a tree-shaped structure

```cpp
struct Address {
    std::string city;
    std::string country;
};

struct Employee {
    std::string name;
    Address address;   // a NESTED custom type
};

void to_json(nlohmann::json& j, const Address& a) {
    j = nlohmann::json{{"city", a.city}, {"country", a.country}};
}

void to_json(nlohmann::json& j, const Employee& e) {
    j = nlohmann::json{{"name", e.name}, {"address", e.address}};   // Address converts AUTOMATICALLY,
                                                                       // because its own to_json exists
}
```

```json
{
  "name": "Bob",
  "address": {
    "city": "Tokyo",
    "country": "Japan"
  }
}
```

`Employee`'s `to_json` doesn't need to manually unpack `Address`'s fields — it just assigns `e.address` directly, and the library recursively applies `Address`'s own `to_json` wherever it encounters an `Address` value, automatically. This composability is the direct payoff of defining the hooks per-type rather than writing one giant, type-specific serialization function by hand — a genuine, concrete instance of this curriculum's running theme that small, well-defined, composable pieces beat one large, monolithic piece of code.

## Try it yourself

**1. Build the manual `personToJson`/`jsonToPerson` functions, save a `Person` to a file, load it back, and confirm every field matches exactly**, including the `hobbies` vector.

**2. Convert to the `to_json`/`from_json` hook style, delete the manual wrapper functions, and confirm the exact same round trip still works**, now via implicit conversion.

**3. Build the nested `Address`/`Employee` example, serialize an `Employee` with a populated `Address`, and confirm the resulting JSON file's structure matches the nested shape shown above** (open the file in a text editor, or print `j.dump(2)` to the console, and visually confirm the nesting).

**4. Extend the `Person`/`Employee` structures with a `std::optional<std::string> nickname` field (Lesson 11.2), and write the corresponding `to_json`/`from_json` logic for it**, handling both the "has a nickname" and "no nickname" cases correctly in the resulting JSON (a missing field, or a JSON `null`, are both reasonable choices — pick one and implement it consistently).

**5. Round-trip a `std::vector<Person>` (a whole JSON array of people, not just one) using the techniques above**, confirming `nlohmann::json`'s automatic container support extends cleanly to a vector of your own custom type, once that type has `to_json`/`from_json` defined.

## What this cost / bought us

| | Manual JSON building (field by field) | `to_json`/`from_json` hooks |
|---|---|---|
| Code needed per type | A pair of conversion functions, called explicitly everywhere | A pair of conversion functions, called implicitly, everywhere, automatically |
| Nested custom types | Must manually flatten/unflatten at every level | Composes automatically — each type's hook only handles its own fields |
| Fits naturally into containers (`std::vector<Person>`) | Requires a manual loop | Works automatically, the same way it works for built-in types |
| Extension mechanism | None — ad hoc | A genuine, intentional library extension point |

---

**Next up: Lesson 12.4 — XML with `tinyxml2`.** A different, older, more verbose structured-text format — understanding why JSON largely displaced it for most modern use cases, while XML remains genuinely necessary in specific, real domains.
