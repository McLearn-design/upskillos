# Phase 5 Project: `MyVector` vs. `MyLinkedList` — Same Interface, Opposite Profiles

*Same interface (push, get, remove), opposite performance profiles.*
*File-I/O checkpoint: parse a small JSON file into a linked list of records — your first real third-party library.*

---

## Part 1: A shared interface

Lesson 5.4 built the complexity table honestly, row by row. This project makes that table *usable* — one abstract interface, two wildly different implementations, and code that genuinely doesn't care which one it's holding. This is Phase 4's abstract-base-class material (Lesson 4.3), applied for the first time to something practical instead of `Shape`.

```cpp
class IIntContainer {
public:
    virtual ~IIntContainer() {}                 // Lesson 4.2 — always virtual when meant to be inherited from
    virtual void push(int value) = 0;             // pure virtual, Lesson 4.3
    virtual int get(int index) const = 0;
    virtual bool remove(int value) = 0;            // true if found and removed, false otherwise
    virtual int size() const = 0;
};
```

### `MyVector`, wrapped to implement the interface

```cpp
class MyVectorContainer : public IIntContainer {
private:
    MyVector vec;   // COMPOSITION (Lesson 4.5) — MyVectorContainer HAS-A MyVector

public:
    void push(int value) override {
        vec.pushBack(value);
    }

    int get(int index) const override {
        return vec.get(index);
    }

    bool remove(int value) override {
        for (int i = 0; i < vec.getSize(); i++) {
            if (vec.get(i) == value) {
                for (int j = i; j < vec.getSize() - 1; j++) {   // shift everything left — O(n)
                    vec[j] = vec[j + 1];
                }
                // (a real implementation would also shrink size here — omitted for brevity)
                return true;
            }
        }
        return false;
    }

    int size() const override {
        return vec.getSize();
    }
};
```

Notice this class uses composition (Lesson 4.5), not inheritance, to wrap `MyVector` — `MyVectorContainer` *has-a* `MyVector`, and delegates to it. This is a deliberate, realistic design choice: `MyVector` itself doesn't need to know anything about `IIntContainer` at all, and could be reused elsewhere unmodified.

### `MyLinkedList`, implementing the same interface

```cpp
class MyLinkedListContainer : public IIntContainer {
private:
    Node* head;   // raw pointers, Lesson 5.1 style, for clarity in this comparison
    int count;

public:
    MyLinkedListContainer() : head(nullptr), count(0) {}

    ~MyLinkedListContainer() override {
        Node* current = head;
        while (current != nullptr) {
            Node* next = current->next;
            delete current;
            current = next;
        }
    }

    void push(int value) override {   // pushFront — O(1), Lesson 5.1
        Node* newNode = new Node(value);
        newNode->next = head;
        head = newNode;
        count++;
    }

    int get(int index) const override {   // O(n), Lesson 5.4
        Node* current = head;
        for (int i = 0; i < index && current != nullptr; i++) {
            current = current->next;
        }
        return current ? current->value : -1;
    }

    bool remove(int value) override {   // O(n) search + O(1) relink, Lesson 5.4
        if (head == nullptr) return false;

        if (head->value == value) {
            Node* toDelete = head;
            head = head->next;
            delete toDelete;
            count--;
            return true;
        }

        Node* current = head;
        while (current->next != nullptr && current->next->value != value) {
            current = current->next;
        }
        if (current->next != nullptr) {
            Node* toDelete = current->next;
            current->next = current->next->next;
            delete toDelete;
            count--;
            return true;
        }
        return false;
    }

    int size() const override {
        return count;
    }
};
```

### Code that genuinely doesn't care which one it's holding

```cpp
void demo(IIntContainer& container) {
    container.push(3);
    container.push(1);
    container.push(4);
    std::cout << "size: " << container.size() << std::endl;
    for (int i = 0; i < container.size(); i++) {
        std::cout << container.get(i) << " ";
    }
    std::cout << std::endl;
    container.remove(1);
    std::cout << "after removing 1, size: " << container.size() << std::endl;
}

int main() {
    MyVectorContainer vecContainer;
    demo(vecContainer);

    MyLinkedListContainer listContainer;
    demo(listContainer);

    return 0;
}
```

`demo()` takes `IIntContainer&` — it has no idea, and no need to know, whether it's operating on a `MyVectorContainer` or a `MyLinkedListContainer`. This is the exact same shape as Lesson 4's Strategy pattern (interchangeable behavior behind one interface) — here applied to interchangeable *data structures* rather than interchangeable *algorithms*, and it's genuinely the same underlying idea wearing a different hat.

## Part 2: Benchmark them honestly, and let the numbers confirm Lesson 5.4's table

```cpp
#include <chrono>

void benchmarkPushFront(IIntContainer& container, int n) {
    auto start = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < n; i++) {
        container.push(i);   // NOTE: push() means pushFront for the list, pushBack for the vector —
                               // an honest asymmetry worth calling out, addressed below
    }
    auto end = std::chrono::high_resolution_clock::now();
    std::cout << "push x" << n << ": "
              << std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count()
              << "ms" << std::endl;
}

void benchmarkGetMiddle(IIntContainer& container, int trials) {
    int mid = container.size() / 2;
    auto start = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < trials; i++) {
        volatile int v = container.get(mid);   // 'volatile' discourages the compiler from optimizing the read away entirely
    }
    auto end = std::chrono::high_resolution_clock::now();
    std::cout << "get(middle) x" << trials << ": "
              << std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count()
              << "ms" << std::endl;
}
```

**A note on the asymmetry flagged in the comment above:** `MyVectorContainer::push` calls `pushBack` (Lesson 3.1's O(1)-amortized operation) while `MyLinkedListContainer::push` calls `pushFront` (Lesson 5.1's O(1) operation) — these are each container's own *fast* insertion point, which is the fair, honest comparison to run, rather than forcing both to insert at the same literal position (which would advantage whichever structure that position happens to be cheap for). Real benchmarking always requires this kind of care: comparing two structures fairly means comparing each at its own best operation, not applying identical code to both and assuming that's automatically fair.

Run both benchmarks against both containers, with `n` around 100,000 and `trials` around 10,000. Confirm, with real timed numbers: `push()` should be roughly comparable between the two (both are O(1) or O(1)-amortized at their respective ends), while `get(middle)` should show `MyVectorContainer` dramatically outperforming `MyLinkedListContainer` — direct, measured proof of Lesson 5.4's access-time row.

## Confidence check

1. Why does `MyVectorContainer::remove` need to shift elements after finding the target, while `MyLinkedListContainer::remove` doesn't? Trace this back to Lesson 1.5's contiguity guarantee versus Lesson 5.1's scattered-node model.
2. The benchmark above deliberately lets `push()` mean different things (front vs. back) for each container. Design — in words, doesn't need code — a *second*, deliberately unfair benchmark that would make `MyLinkedListContainer` look artificially slow, and explain exactly what about it would be unfair.
3. `IIntContainer` only supports `int`. What curriculum concept, arriving properly in Phase 10, would let you write this interface *once*, generically, for any element type, instead of needing a separate interface and separate implementations for `int`, `std::string`, etc.?

---

## Part 3: File-I/O checkpoint — real JSON, your first third-party library

### Step 1: install nlohmann/json

This is a header-only library (no separate compiled binary needed) — download `json.hpp` from the [nlohmann/json GitHub releases page](https://github.com/nlohmann/json/releases) and place it alongside your source file, or install it via your system's package manager (`apt install nlohmann-json3-dev` on many Linux distributions, `brew install nlohmann-json` on macOS). This is worth pausing on: every library up to this point in the curriculum has been part of the C++ standard library itself (`<vector>`, `<memory>`, `<fstream>`) — this is your first time pulling in code that isn't bundled with the compiler at all, a genuinely different, common experience in real-world C++ development.

### Step 2: generate realistic JSON test data with Python

```python
# generate_people.py
import json
import random

names = ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "Heidi"]

people = [
    {"name": random.choice(names), "age": random.randint(18, 80)}
    for _ in range(10)
]

with open("people.json", "w") as f:
    json.dump(people, f, indent=2)

print("Wrote people.json")
```

Run `python generate_people.py`. You'll get a `people.json` looking something like:

```json
[
  { "name": "Alice", "age": 34 },
  { "name": "Grace", "age": 61 },
  ...
]
```

### Step 3: a linked list of records, not just integers

```cpp
struct Person {
    std::string name;
    int age;
};

class PersonNode {
public:
    Person data;
    std::unique_ptr<PersonNode> next;   // Lesson 5.2's ownership model, applied to a real record type

    PersonNode(const Person& p) : data(p), next(nullptr) {}
};

class PersonList {
private:
    std::unique_ptr<PersonNode> head;

public:
    PersonList() : head(nullptr) {}

    void pushFront(const Person& p) {
        auto newNode = std::make_unique<PersonNode>(p);
        newNode->next = std::move(head);
        head = std::move(newNode);
    }

    void printAll() const {
        PersonNode* current = head.get();
        while (current != nullptr) {
            std::cout << current->data.name << " (" << current->data.age << ")" << std::endl;
            current = current->next.get();
        }
    }
};
```

This is genuinely just Lesson 5.2's `LinkedList`, with `int value` swapped for `Person data` — direct, concrete proof that everything you built this phase generalizes to real records, not just bare integers.

### Step 4: parse the JSON and build the list

```cpp
#include <iostream>
#include <fstream>
#include <nlohmann/json.hpp>

int main() {
    std::ifstream file("people.json");   // Lesson 2's <fstream>, unchanged
    if (!file.is_open()) {
        std::cerr << "Could not open people.json" << std::endl;
        return 1;
    }

    nlohmann::json j;
    file >> j;   // parse the ENTIRE file into a json object in one call

    PersonList list;

    for (const auto& entry : j) {
        Person p;
        p.name = entry["name"];
        p.age = entry["age"];
        list.pushFront(p);
    }

    std::cout << "Loaded people:" << std::endl;
    list.printAll();

    return 0;
}
```

`file >> j;` parses the whole JSON document in one line — `nlohmann::json` overloads `operator>>` (Lesson 2.7's operator-overloading idea, now seen in a real library rather than something you wrote yourself) to make file-to-JSON parsing read almost like ordinary stream input. `for (const auto& entry : j)` is a range-based for loop (Lesson 0.5) over the JSON array; `entry["name"]` and `entry["age"]` pull individual fields out, with the library handling the type conversion into `std::string` and `int` for you.

## Try it yourself

**1. Run the full pipeline: generate `people.json` with Python, compile and run the C++ program above, and confirm the printed list matches the file's contents (in reverse order, since `pushFront` reverses insertion order — exactly as in Lesson 5.1).**

**2. Modify `generate_people.py` to add a third field — say, `"city"`** — and update `Person`, `PersonNode`, and the parsing loop to carry it through. Confirm the whole pipeline still works end to end after the change, touching every layer this phase built.

**3. Add error handling for a malformed JSON file.** Manually corrupt `people.json` (delete a closing brace, say) and confirm your program handles the resulting parse failure gracefully rather than crashing — `nlohmann::json` throws a real C++ exception (`nlohmann::json::parse_error`) on malformed input, which you can catch with `try`/`catch`, a genuine, practical use of the exception-handling syntax you've seen glimpses of since Lesson 2.5's RAII-survives-exceptions example.

## What this cost / bought us

| | Interface-free, separate benchmarking code for each container | `IIntContainer`-based (this project) |
|---|---|---|
| Code reuse | None — `demo()`-equivalent logic duplicated per container type | One `demo()`, works with any current or future `IIntContainer` implementation |
| Adding a third container type later | Requires touching every place that used the old containers directly | Just implement `IIntContainer` — nothing else needs to change |
| What you learned about `MyVector` vs `MyLinkedList` | Assertions from Lesson 5.4's table | The same claims, now measured, with real milliseconds |
| Data source | Hardcoded, throughout this entire curriculum until now | Real, external, third-party-parsed JSON |

---

**Phase 5 is complete.** You've built singly and doubly linked structures, understood ownership-direction design, learned amortized and honest-assumption complexity analysis, implemented a real algorithmic trick (Floyd's cycle detection), unified two very different structures behind one interface, and pulled in your first external C++ library.

**Next up: Phase 6 — Stacks, Queues, Deques.** Shorter, faster-moving territory: you'll build a `Stack` on top of both `MyVector` and `MyLinkedList` (a direct callback to Lesson 4.5's composition preview), then meet your second design pattern — Command, used to build a real undo/redo text editor.
