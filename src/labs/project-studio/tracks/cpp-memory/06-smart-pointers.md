---
title: 6 — Smart Pointers: Owning, Sharing and Observing
track: Memory, Lifetime and Ownership
runtime: cpp
reference: optional
console: true
---

`std::unique_ptr` appeared in lesson 1. This lesson completes the set of smart pointers, each a different answer to "who owns this?":

| Type | Ownership |
|---|---|
| `std::unique_ptr<T>` | exactly one owner; ownership can be handed on (moved) |
| `std::shared_ptr<T>` | several owners; the object dies when the last one lets go |
| `std::weak_ptr<T>` | not an owner: watches a `shared_ptr`'s object, which may already be gone |

The programs live in `smart/`, built directly with `g++`.

## Step 1 — A Tracer you can include

**This step: create the supplied `smart/tracer.h`.**

The same `Tracer` as in lesson 1, as a header the programs in this lesson include. Its output is a timeline of construction and destruction.

```cpp file=smart/tracer.h provided
#pragma once

#include <iostream>
#include <string>
#include <utility>

// Announces its construction and destruction, so lifetimes show up in the output.
struct Tracer {
    std::string name;
    explicit Tracer(std::string n) : name(std::move(n)) { std::cout << "construct " << name << '\n'; }
    ~Tracer() { std::cout << "destroy " << name << '\n'; }
};
```

```check
file smart/tracer.h
```

## Step 2 — Handing ownership over

**This step: create `smart/unique.cpp`: hand a `unique_ptr` to a function that takes ownership.**

```cpp
void keep_until_done(std::unique_ptr<Tracer> owned)
{
    std::cout << "now owned by keep_until_done: " << owned->name << '\n';
}   // owned is destroyed here, and deletes the Tracer
```

- The parameter is a `unique_ptr` **by value**: the function's signature says "give me ownership".
- `keep_until_done(report);` doesn't compile: copying a `unique_ptr` would make two owners. You must write `keep_until_done(std::move(report));`, an explicit, visible hand-over.
- Afterwards `report` is empty (`nullptr`).

Print `main no longer owns it` if `report == nullptr`, then `main ends`.

**Predict:** does `destroy report` appear before or after `main no longer owns it`?

```cpp file=smart/unique.cpp
#include <iostream>
#include <memory>

#include "tracer.h"

// Takes ownership: whoever calls this hands their Tracer over for good.
void keep_until_done(std::unique_ptr<Tracer> owned)
{
    std::cout << "now owned by keep_until_done: " << owned->name << '\n';
}   // owned is destroyed here, and deletes the Tracer

int main()
{
    std::unique_ptr<Tracer> report = std::make_unique<Tracer>("report");
    keep_until_done(std::move(report));
    if (report == nullptr)
        std::cout << "main no longer owns it\n";
    std::cout << "main ends\n";
    return 0;
}
```

```check
contains smart/unique.cpp "std::move"
run "g++ -std=c++20 -Wall -Wextra -Werror smart/unique.cpp -o smart/unique" -- Passing a unique_ptr by value needs std::move: a copy would make two owners.
run "./smart/unique" stdout="destroy report\nmain no longer owns it" label="the Tracer dies when keep_until_done ends"
```

## Step 3 — Shared ownership

**This step: create `smart/shared.cpp`: two `shared_ptr`s owning one Tracer.**

```cpp
std::shared_ptr<Tracer> first = std::make_shared<Tracer>("texture");
std::shared_ptr<Tracer> second = first;   // copying a shared_ptr adds an owner
first.use_count();                        // how many owners right now
first.reset();                            // this owner lets go
```

- A `shared_ptr` keeps a **reference count** next to the object. Copies add one; destroying or resetting a copy subtracts one; reaching zero destroys the object.
- Use it when ownership is genuinely shared, such as one texture used by many sprites. Don't use it as a default: `unique_ptr` is cheaper and its ownership is easier to follow.

Print `owners:` with the count after creating `first`, inside a block that makes `second`, and after that block. Then `reset()` `first`, and print `main ends`.

**Predict** the three counts, and where `destroy texture` appears.

```cpp file=smart/shared.cpp
#include <iostream>
#include <memory>

#include "tracer.h"

int main()
{
    std::shared_ptr<Tracer> first = std::make_shared<Tracer>("texture");
    std::cout << "owners: " << first.use_count() << '\n';
    {
        std::shared_ptr<Tracer> second = first;   // a second owner of the same Tracer
        std::cout << "owners: " << first.use_count() << '\n';
    }
    std::cout << "owners: " << first.use_count() << '\n';
    first.reset();                                // the last owner lets go
    std::cout << "main ends\n";
    return 0;
}
```

```check
run "g++ -std=c++20 -Wall -Wextra -Werror smart/shared.cpp -o smart/shared"
run "./smart/shared" stdout="owners: 1\nowners: 2\nowners: 1" -- second is a copy of first inside a { } block, so it lets go at the closing }.
run "./smart/shared" stdout="destroy texture\nmain ends" label="the Tracer dies when the last owner resets"
```

## Step 4 — A leak with no new in sight

**This step: create the supplied `smart/cycle.cpp`, build and run it. Don't fix it yet.**

A parent owns its child, and the child owns its parent, both through `shared_ptr`.

**Predict:** both objects go out of scope at the closing `}`. Will `destroy parent Ada` and `destroy child Byron` appear?

```text
g++ -std=c++20 -Wall -Wextra smart/cycle.cpp -o smart/cycle
./smart/cycle
```

```cpp file=smart/cycle.cpp provided
#include <iostream>
#include <memory>
#include <string>

struct Child;

struct Parent {
    std::string name;
    std::shared_ptr<Child> child;
    ~Parent() { std::cout << "destroy parent " << name << '\n'; }
};

struct Child {
    std::string name;
    std::shared_ptr<Parent> parent;   // the child also owns its parent...
    ~Child() { std::cout << "destroy child " << name << '\n'; }
};

int main()
{
    {
        auto mum = std::make_shared<Parent>();
        mum->name = "Ada";
        auto kid = std::make_shared<Child>();
        kid->name = "Byron";
        mum->child = kid;
        kid->parent = mum;
        std::cout << kid->name << "'s parent is " << kid->parent->name << '\n';
    }
    std::cout << "main ends\n";
    return 0;
}
```

### A reference cycle

Neither destructor runs. When `mum` and `kid` (the local variables) are destroyed, each object's count drops from 2 to 1, not to 0: the parent is still owned by the child, and the child by the parent. They keep each other alive forever, and nothing can reach them. A leak, with no `new` anywhere.

`shared_ptr` can't detect cycles. The fix is a design decision: in a parent–child relationship, the parent owns the child, and the child only needs to *refer* to the parent.

```check
file smart/cycle.cpp
run "g++ -std=c++20 -Wall -Wextra -Werror smart/cycle.cpp -o smart/cycle"
run "./smart/cycle" stdout="main ends" label="it runs (and leaks)"
```

## Step 5 — Break the cycle with weak_ptr

**This step: make the child's `parent` a `std::weak_ptr`, so the child observes its parent without owning it.**

```cpp
std::weak_ptr<Parent> parent;      // in Child: refers to the parent, doesn't keep it alive
```

A `weak_ptr` can't be used directly, because its object may already be gone. Ask for a temporary owner first:

```cpp
if (std::shared_ptr<Parent> p = kid->parent.lock())   // a shared_ptr, or empty if the parent is gone
    std::cout << kid->name << "'s parent is " << p->name << '\n';
```

Now when the locals go, the parent's count reaches zero. It's destroyed, which destroys its `child` member, which releases the child.

```cpp file=smart/cycle.cpp
#include <iostream>
#include <memory>
#include <string>

struct Child;

struct Parent {
    std::string name;
    std::shared_ptr<Child> child;
    ~Parent() { std::cout << "destroy parent " << name << '\n'; }
};

struct Child {
    std::string name;
    std::weak_ptr<Parent> parent;     // the child refers to its parent without owning it
    ~Child() { std::cout << "destroy child " << name << '\n'; }
};

int main()
{
    {
        auto mum = std::make_shared<Parent>();
        mum->name = "Ada";
        auto kid = std::make_shared<Child>();
        kid->name = "Byron";
        mum->child = kid;
        kid->parent = mum;
        if (std::shared_ptr<Parent> p = kid->parent.lock())
            std::cout << kid->name << "'s parent is " << p->name << '\n';
    }
    std::cout << "main ends\n";
    return 0;
}
```

```check
matches smart/cycle.cpp "std::weak_ptr\s*<\s*Parent\s*>" label="Child refers to its parent with a weak_ptr"
run "g++ -std=c++20 -Wall -Wextra -Werror smart/cycle.cpp -o smart/cycle" -- A weak_ptr has no ->: call .lock() to get a shared_ptr first.
run "./smart/cycle" stdout="destroy parent Ada\ndestroy child Byron\nmain ends" label="both objects are destroyed before main ends"
```
