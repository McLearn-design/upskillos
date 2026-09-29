# Design Pattern: Observer — A Dependency Graph That Rebuilds Itself

*Phase 9 — Graphs*
*Compared against a signal/slot-style callback list.*

---

## The need, stated plainly

Lesson 9.3 modeled dependencies as a directed graph: an edge `A → B` meant "A must happen before B." That answered the question "in what order should things run once?" A different, equally common question comes next: **when something changes, how do the things that depend on it find out?**

Think of a spreadsheet. Cell `C1` contains `=A1+B1`. When you edit `A1`, `C1` must recompute, and anything depending on `C1` must recompute after that. Or a build system: when `utils.cpp` changes, everything that includes it needs rebuilding. Or a UI: when the underlying data changes, every widget displaying it needs to refresh.

The naive approach has the changed thing manually call every dependent: `A1.changed() { C1.recompute(); D5.recompute(); ... }`. That hardwires `A1` to knowledge of everything downstream, so adding a new dependent means editing `A1` itself, the exact coupling problem Visitor (Lesson 7) and Strategy (Lesson 4) also existed to escape. The **Observer pattern** inverts the arrangement: a **subject** keeps a list of **observers**, and observers register themselves. When the subject changes, it notifies whoever registered, without knowing or caring who they are.

## Version 1: classic OOP Observer

```cpp
#include <vector>
#include <string>
#include <iostream>

class Observer {
public:
    virtual ~Observer() {}
    virtual void update(const std::string& sourceName, int newValue) = 0;
};

class Subject {
private:
    std::string name;
    int value;
    std::vector<Observer*> observers;   // non-owning raw pointers — see the ownership note below

public:
    Subject(const std::string& n, int v) : name(n), value(v) {}

    void attach(Observer* obs) {
        observers.push_back(obs);
    }

    void detach(Observer* obs) {
        observers.erase(std::remove(observers.begin(), observers.end(), obs), observers.end());
    }

    void setValue(int newValue) {
        value = newValue;
        for (Observer* obs : observers) {
            obs->update(name, value);   // notify everyone who registered
        }
    }

    int getValue() const { return value; }
};

class PrintObserver : public Observer {
private:
    std::string label;

public:
    PrintObserver(const std::string& l) : label(l) {}

    void update(const std::string& sourceName, int newValue) override {
        std::cout << "[" << label << "] " << sourceName << " changed to " << newValue << std::endl;
    }
};
```

```cpp
int main() {
    Subject temperature("temperature", 20);

    PrintObserver display("display");
    PrintObserver logger("logger");

    temperature.attach(&display);
    temperature.attach(&logger);

    temperature.setValue(25);   // both observers are notified automatically

    return 0;
}
```

`Subject` never mentions `PrintObserver`. It only knows the `Observer` interface (an abstract base class, Lesson 4.3). Adding a third observer of a completely different kind requires zero changes to `Subject`, the same extensibility payoff as every pattern in this curriculum so far.

### An ownership note, connecting back to Lesson 5.3

Notice `observers` holds raw `Observer*` pointers, not `unique_ptr`s. That's deliberate, and it's the same ownership-direction principle Lesson 5.3 established for doubly linked lists: **the subject doesn't own its observers; it just references them.** Something else (here, `main`'s local variables) owns each observer's lifetime. This works, but it carries a real hazard worth naming: if an observer is destroyed while still attached, the subject holds a dangling pointer (Lesson 1.4's vocabulary) and will call into freed memory on the next notification. Real implementations handle this either by requiring observers to `detach` in their destructors (RAII, Lesson 2.5, applied to registration: attach in the constructor, detach in the destructor), or by using `std::weak_ptr`, a non-owning smart pointer that can safely detect the object it refers to has been destroyed, a more advanced tool this curriculum won't build out but that is worth knowing exists.

## Chaining observers into a dependency graph

The graph connection: an observer can itself be a subject. When cell `C1` (observing `A1` and `B1`) recomputes, it *is* a subject whose own observers now need notifying. Each attach relationship is a directed edge in a dependency graph, exactly Lesson 9.3's model, with notification propagating along the edges.

```cpp
class Cell : public Observer {
private:
    std::string name;
    int value;
    std::function<int()> formula;   // how to recompute this cell's value
    std::vector<Cell*> dependents;   // cells that depend on THIS one — this cell is their subject

public:
    Cell(const std::string& n, int v = 0) : name(n), value(v) {}

    void setFormula(std::function<int()> f) { formula = f; }
    void addDependent(Cell* c) { dependents.push_back(c); }

    void setValue(int v) {
        value = v;
        notifyDependents();
    }

    void update(const std::string&, int) override {
        if (formula) {
            value = formula();
            std::cout << name << " recomputed to " << value << std::endl;
            notifyDependents();   // propagate along the graph
        }
    }

    int getValue() const { return value; }

private:
    void notifyDependents() {
        for (Cell* d : dependents) {
            d->update(name, value);
        }
    }
};
```

```cpp
int main() {
    Cell a("A1", 3);
    Cell b("B1", 4);
    Cell c("C1");
    Cell d("D1");

    c.setFormula([&]() { return a.getValue() + b.getValue(); });
    d.setFormula([&]() { return c.getValue() * 2; });

    a.addDependent(&c);
    b.addDependent(&c);
    c.addDependent(&d);

    a.setValue(10);   // C1 recomputes, then D1 recomputes — propagation follows the graph's edges

    return 0;
}
```

Changing `a` triggers `c` to recompute (`10 + 4 = 14`), which in turn triggers `d` (`14 * 2 = 28`). The propagation walks the dependency graph exactly like a DFS from the changed vertex.

**A real hazard hiding here:** this naive propagation has two genuine problems that real spreadsheet and build engines must solve. First, if `C1` depends on both `A1` and `B1`, and some upstream change causes *both* to update, `C1` gets recomputed twice, once per notification, when once (after both have settled) would suffice. That's the same problem Lesson 9.3's topological sort solves: process cells in dependency order so each is computed exactly once, after all its inputs are final. Second, a cyclic dependency (`A1` depends on `B1`, which depends on `A1`) would recurse forever, which is exactly what Lesson 9.3's cycle detection exists to catch *before* allowing such a dependency to be registered. A production-grade reactive system combines Observer with Lesson 9.3's topological ordering and cycle checks. The pattern by itself is only the notification mechanism.

## Version 2: signal/slot-style callback list

An alternative that skips the class hierarchy entirely: the subject holds a list of plain callables, and "observing" means registering a function.

```cpp
#include <functional>

class Signal {
private:
    std::vector<std::function<void(int)>> slots;

public:
    void connect(std::function<void(int)> slot) {
        slots.push_back(slot);
    }

    void emit(int value) {
        for (auto& slot : slots) {
            slot(value);
        }
    }
};
```

```cpp
int main() {
    Signal onTemperatureChanged;

    onTemperatureChanged.connect([](int v) {
        std::cout << "[display] temperature is now " << v << std::endl;
    });

    std::string logPrefix = "[logger]";
    onTemperatureChanged.connect([logPrefix](int v) {
        std::cout << logPrefix << " recorded " << v << std::endl;
    });

    onTemperatureChanged.emit(25);

    return 0;
}
```

This is the same Strategy/Command/Visitor comparison for the fourth time, and by now you can predict how it goes: no `Observer` base class, no subclass per observer, each observer is a lambda registered inline, capturing whatever local state it needs (Lesson 4's capture-list payoff, again). This exact shape appears in real frameworks under the name **signals and slots** (Qt's central mechanism, and Boost.Signals2 in the C++ ecosystem).

## Comparing the two, honestly

| | OOP `Observer` hierarchy | Signal/slot (callback list) |
|---|---|---|
| Registering an observer | Create a class implementing `Observer`, then `attach` | Write a lambda, `connect` it inline |
| Observer needing its own persistent state and multiple related methods | Natural — fields and methods on the class | Needs captured variables, or a separate object the lambda closes over |
| Unregistering | Straightforward — `detach(obs)` compares the pointer | Awkward — `std::function` objects aren't comparable, so real libraries return a **connection handle** you keep and use to disconnect |
| Lifetime hazard (dangling observer) | Present — mitigated by RAII attach/detach | Present too — a lambda capturing a reference to a destroyed object dangles just as badly |
| Ceremony per observer | A class | A few lines |

Notice the unregistration row, since it's the one genuinely new wrinkle relative to earlier pattern comparisons: `std::function` has no equality operator, so you can't write `slots.erase(find(slot))` the way `detach` compared raw pointers. Real signal/slot libraries solve this by having `connect` return a handle object (often RAII, disconnecting automatically when the handle is destroyed). Worth noticing as a concrete limitation of the functional approach that the class-based approach doesn't have.

## Try it yourself

**1. Build Version 1's `Subject`/`Observer`, attach two `PrintObserver`s, and confirm both print on `setValue`.** Then `detach` one and confirm only the other prints on the next change.

**2. Build the `Cell` chain from this lesson and trace, by hand, the exact order of recompute calls for a change to `A1`.** Then extend it so `D1` depends on *both* `C1` and `A1`, and observe `D1` get recomputed twice from a single `A1` change. Confirm you've reproduced the double-recompute problem described above.

**3. Fix the double-recompute problem using Lesson 9.3.** Instead of immediate recursive notification, collect the set of dirty cells reachable from the changed one, topologically sort them (using Kahn's algorithm or DFS-postorder from Lesson 9.3), and recompute each exactly once in that order. This is a genuine integration exercise: Observer's notification structure plus topological ordering, the way a real reactive engine works.

**4. Build the signal/slot version, connect three different lambdas, and emit a value.** Then try to add a `disconnect` capability and run into the `std::function`-not-comparable problem yourself. Solve it by having `connect` return an integer ID and storing slots in a `std::unordered_map<int, std::function<void(int)>>` (Phase 8's hash map, doing real work again).

**5. Deliberately create the dangling-observer bug.** Attach an observer to a subject, let the observer go out of scope (destroy it), then call `setValue` on the subject. Observe the undefined behavior. Then fix it by giving `Observer` a destructor that detaches itself, and confirm the crash disappears.

## What this cost / bought us

Like Strategy, Command, and Visitor before it, Observer costs nothing conceptually new. What it names is a recurring shape: **when many things care about one thing changing, and the changing thing shouldn't need to know who they are, let the interested parties register themselves and let the changing thing notify whoever signed up.** Four patterns in, a pattern of patterns is visible: each one is "decouple X from Y by putting an interface (a base class or a callable) between them," with the class-hierarchy and callable versions trading ceremony against convenience each time. That meta-recognition is worth more than any individual pattern.

---

**Next up: the API checkpoint.** Pull real data from a free public API using libcurl or cpr, build a weighted graph from it, and run your own Dijkstra on live data.
