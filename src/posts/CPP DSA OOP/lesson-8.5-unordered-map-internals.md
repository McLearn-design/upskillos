# Lesson 8.5: `std::unordered_map` Internals

*Phase 8 — Hashing*

---

## What you can now recognize immediately

```cpp
#include <unordered_map>

std::unordered_map<std::string, int> wordCounts;
wordCounts["cat"] = 3;
wordCounts["dog"]++;

if (wordCounts.find("cat") != wordCounts.end()) {
    std::cout << "found: " << wordCounts["cat"] << std::endl;
}
```

Four lessons ago, this was a black box — Phase 0's own mini-project used `std::map` (a different container, built on a red-black tree — Lesson 7.5's structure) without you having any way to understand what was happening underneath. `std::unordered_map`, specifically, is what you've actually been building by hand this entire phase. This lesson is a direct, explicit tour connecting every piece you built to the real thing.

## The mapping, piece by piece

| Real `std::unordered_map` concept | What you built | Lesson |
|---|---|---|
| Hash function for the key type | `hashString` | 8.1 |
| Collision resolution | Separate chaining (most common; some implementations use open addressing variants) | 8.2 / 8.3 |
| `max_load_factor()` | `MAX_LOAD_FACTOR` | 8.4 |
| Automatic rehashing when the load factor is exceeded | `rehash()`, triggered inside `insert` | 8.4 |
| `operator[]` | `insert`, adapted to also handle "create if missing" | 8.2 |
| `.find(key)` | `find` | 8.2 |
| `.erase(key)` | `remove` | 8.2 |

Every method call you've ever made on a `std::unordered_map`, going back to Phase 0, was quietly doing everything this phase built explicitly. Worth sitting with that directly: the "magic" was never magic — it was these five lessons, running invisibly, every single time.

## `operator[]`'s genuinely subtle behavior — worth knowing precisely

```cpp
std::unordered_map<std::string, int> counts;
std::cout << counts["missing"] << std::endl;   // prints 0 — but ALSO just inserted "missing" -> 0!
std::cout << counts.size() << std::endl;         // 1, not 0 — the lookup itself created an entry
```

This surprises people the first time they see it, and now you have the machinery to understand exactly why it happens: `operator[]` is specified to **insert a default-constructed value if the key doesn't already exist**, then return a reference to it. There's no way to "just check" using `operator[]` alone without risking an unwanted insertion — this is precisely why `.find()` exists as a separate method, returning an iterator you check against `.end()` rather than a value that might have just been silently created:

```cpp
if (counts.find("missing") != counts.end()) {   // does NOT insert — a pure, side-effect-free check
    std::cout << "found" << std::endl;
} else {
    std::cout << "not found, and nothing was inserted" << std::endl;
}
```

This is a genuinely important, practical distinction for real code — using `operator[]` when you meant `.find()` is a real, common source of subtle bugs (accidentally populating a map with unwanted zero/default entries), and understanding *why* it happens (because `operator[]`'s contract genuinely requires "find or create," by design, not by accident) makes the bug much easier to spot and avoid.

## `std::unordered_map` vs. `std::map` — the choice you can now make with real understanding

| | `std::unordered_map` (this phase) | `std::map` (Lesson 7.5 — red-black tree) |
|---|---|---|
| Average lookup/insert/delete | O(1) | O(log n) |
| Worst-case lookup/insert/delete | O(n) — pathological hash collisions | **O(log n), guaranteed** — no equivalent worst case |
| Iteration order | Unspecified, effectively arbitrary | Always sorted by key |
| Memory overhead | Hash table + chain pointers (or open-addressing slack) | Tree node pointers (typically 3 per node: left, right, parent) |
| Requires | A hash function for the key type | A `<` comparison for the key type |

This table should now read completely differently than it would have before this phase — every row connects to something you built and measured yourself, not something you're being asked to trust. The real, practical decision rule: **if you need sorted iteration, or a hard guarantee against worst-case degradation, use `std::map`. If you just need fast average-case lookup and don't care about order, use `std::unordered_map`** — which is the more common choice in practice, precisely because most real code doesn't actually need sorted iteration, and the average-case speed difference (O(1) versus O(log n)) is genuinely meaningful at scale.

## Try it yourself

**1. Reproduce the `operator[]`-inserts-a-default-entry behavior directly** with `std::unordered_map<std::string, int>`, confirming `.size()` grows after a "read-only-looking" `operator[]` access on a missing key.

**2. Rebuild the same experiment using `.find()` instead, and confirm `.size()` does NOT grow** — direct, hands-on proof of the distinction.

**3. Insert the same large dataset into both `std::unordered_map` and `std::map`, and time lookups for both**, using the `<chrono>` technique from Phase 3. Confirm `std::unordered_map` wins on raw lookup speed, and separately confirm `std::map`'s iteration produces sorted keys while `std::unordered_map`'s does not (loop over both with a range-based for loop — Lesson 7's Iterator-pattern payoff, still paying off — and print the keys in the order each container yields them).

**4. Call `.load_factor()` and `.max_load_factor()` on a real `std::unordered_map` after inserting a range of elements**, and confirm the reported load factor stays under the maximum — direct, real confirmation that Lesson 8.4's rehashing discipline is genuinely running underneath the real container, not just something you're told to believe.

## What this cost / bought us

Nothing new was built in this lesson — it's entirely a naming exercise, connecting five lessons' worth of your own work to one real, trusted standard-library type. That connection is the actual point: **`std::unordered_map` was never a black box you had to trust blindly — it's a specific, well-understood combination of a hash function, a collision-handling scheme, and load-factor management, each of which you've now built, broken, measured, and fixed by hand.**

---

**Project: build `MyHashMap`, then re-implement your CSV/JSON loaders from earlier phases to load into it instead of a vector. Compare lookup speed.**

**Then: the Flyweight pattern — dedupe repeated string data using your hash map**, closing out this phase's design-pattern thread with a genuinely practical, memory-saving application of everything you just built.
