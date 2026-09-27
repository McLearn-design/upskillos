# Lesson 8.2: Separate Chaining

*Phase 8 — Hashing*
*Using your `MyLinkedList` from Phase 5 — everything connects.*

---

## Collisions are guaranteed, not just possible

Lesson 8.1 hashed keys into a fixed-size table. Here's an unavoidable fact, worth naming precisely: if you have more possible keys than table slots — which is essentially always true (infinitely many possible strings, a finite table) — **some two keys must eventually hash to the same index.** This isn't a sign of a bad hash function; it's a mathematical certainty called the **pigeonhole principle** (more pigeons than holes means some hole gets two pigeons), and it applies no matter how good your hash function is. This lesson is about handling that certainty correctly, not preventing it — prevention isn't on the table.

## The idea: each slot holds a list, not a single value

**Separate chaining**'s answer: instead of each table slot holding one value directly, each slot holds a small **linked list** of all the key-value pairs that happened to hash there. A collision doesn't overwrite anything — it just means the colliding key gets added to the same slot's chain, alongside whatever was already there.

```
table[7]  ──►  [("cat", 3)] -> [("act", 7)] -> nullptr
                     ▲                ▲
              both "cat" and "act" happened to hash to index 7
```

This is, directly and literally, Phase 5's linked list — put to real, practical use for the first time since it was built by hand across five lessons. Every ownership lesson from Phase 5 (`unique_ptr`-based chaining, Lesson 5.2's automatic cascading cleanup) applies here completely unchanged.

## Building it

```cpp
struct HashNode {
    std::string key;
    int value;
    std::unique_ptr<HashNode> next;   // Phase 5's exact ownership model

    HashNode(const std::string& k, int v) : key(k), value(v), next(nullptr) {}
};

class HashMap {
private:
    std::vector<std::unique_ptr<HashNode>> table;   // an array of CHAIN HEADS
    int tableSize;

    int hash(const std::string& key) const {
        long long h = 0;
        for (char c : key) {
            h = (h * 31 + c) % tableSize;
        }
        return static_cast<int>(h);
    }

public:
    HashMap(int size) : tableSize(size) {
        table.resize(tableSize);   // every slot starts as an empty chain (nullptr)
    }

    void insert(const std::string& key, int value) {
        int index = hash(key);
        HashNode* current = table[index].get();

        while (current != nullptr) {
            if (current->key == key) {
                current->value = value;   // key already exists — UPDATE, don't duplicate
                return;
            }
            current = current->next.get();
        }

        // key not found in this chain — add a NEW node at the front (Lesson 5.1's pushFront)
        auto newNode = std::make_unique<HashNode>(key, value);
        newNode->next = std::move(table[index]);
        table[index] = std::move(newNode);
    }

    bool find(const std::string& key, int& outValue) const {
        int index = hash(key);
        HashNode* current = table[index].get();

        while (current != nullptr) {
            if (current->key == key) {
                outValue = current->value;
                return true;
            }
            current = current->next.get();
        }
        return false;
    }

    bool remove(const std::string& key) {
        int index = hash(key);
        std::unique_ptr<HashNode>* current = &table[index];   // pointer to a unique_ptr — needed to relink

        while (*current != nullptr) {
            if ((*current)->key == key) {
                *current = std::move((*current)->next);   // splice this node out, keep the rest of the chain
                return true;
            }
            current = &(*current)->next;
        }
        return false;
    }
};
```

Notice `insert`'s search-before-add step: walking the existing chain first isn't optional — without it, inserting the same key twice would silently create two separate nodes for it, and `find` would only ever see whichever one happens to be first, a real, subtle correctness bug. This connects directly to Lesson 2.4's invariant-protection theme: a `HashMap`'s invariant is "each key appears in at most one chain node," and `insert` has to actively maintain that invariant, exactly the way `MyVector::pushBack` actively maintained `size == capacity` correctly.

`remove`'s `std::unique_ptr<HashNode>* current` — a raw pointer *to* a `unique_ptr` — is a genuinely subtle piece of Phase 5's ownership model, applied carefully: it needs to be able to splice a node out of the *middle* of an owned chain, which means modifying whichever `unique_ptr` currently points at the node being removed (either `table[index]` itself, or some earlier node's `next`) — the same "need a reference/pointer to the owning slot itself, not just the owned value" pattern that Lesson 1.6's `int*&` and Lesson 7.4's `std::unique_ptr<TreeNode>&` both required, appearing here a third time in a fourth, slightly different shape.

## Complexity — and why it depends entirely on chain length

```cpp
// Best/average case: chains stay short
// Worst case: EVERYTHING hashes to the same slot
```

If keys distribute evenly (Lesson 8.1's "uniform distribution" property doing its job), each chain stays short — close to constant length regardless of how many total keys are stored — and `insert`/`find`/`remove` are all close to O(1) on average, since walking a short chain is fast. But if the hash function is poor (Lesson 8.1's deliberately-bad exercise), or if an adversary specifically crafts keys designed to all hash to the same slot (a real, documented attack against poorly-designed hash tables in real systems), every operation degrades toward **O(n)** — you'd be doing nothing more than a Phase 5 linked-list search, having paid for all the hashing machinery and gotten none of its benefit. This is the same honest-worst-case discipline Lesson 7.4 and 7.5 insisted on for BSTs — **an average-case claim is not a guarantee**, and knowing exactly when it breaks down is as important as knowing when it holds.

## Try it yourself

**1. Build the full `HashMap` above, insert a handful of key-value pairs, some deliberately chosen to collide (pick keys and a small enough `tableSize` that you can predict two will land at the same index), and confirm `find` correctly retrieves every value, including the colliding ones.**

**2. Confirm the update-not-duplicate behavior**: insert `("cat", 1)`, then insert `("cat", 2)`, then `find("cat")` and confirm you get `2`, not a chain with two separate `"cat"` entries.

**3. Add a method to report the longest chain length in the table**, and use it to directly measure the difference between a well-distributed hash function and Lesson 8.1's deliberately bad one (first-character-only), inserting the same thousand random strings into both. Confirm the bad hash function produces one wildly long chain (everything starting with a common letter) while the good one keeps chains short and roughly even.

**4. Measure the real performance consequence directly**, timing `find` calls against both versions from exercise 3 for a large number of lookups. The good-hash version should stay fast; the bad-hash version should degrade toward the linear-search speed of a single, very long Phase 5 linked list — direct, measured proof that this phase's whole premise (O(1) average lookup) is conditional on the hash function actually doing its job.

## What this cost / bought us

| | No collision handling (broken) | Separate chaining (this lesson) |
|---|---|---|
| What happens on a collision | Data loss — the second key overwrites or corrupts the first | Both keys coexist, correctly, in the same slot's chain |
| Lookup, average case | N/A | O(1) average, assuming short chains |
| Lookup, worst case | N/A | O(n) — if all keys collide into one chain |
| Extra memory per entry | None | One `next` pointer per node — Phase 5's cost, recurring |
| Reuses which earlier structure | — | **Phase 5's linked list, directly and completely** |

This lesson is a genuine, satisfying payoff of the curriculum's own recurring promise: "everything connects." Phase 5's five lessons on linked lists — built, at the time, with no obvious immediate application beyond understanding pointers and ownership deeply — turn out to be *exactly* the right tool for solving hashing's first real problem, three phases later, with zero modification needed to the underlying ownership model.

---

**Next up: Lesson 8.3 — Open addressing / linear probing.** A genuinely different way to resolve the same collision problem — no linked lists at all, keeping everything inside the array itself.
