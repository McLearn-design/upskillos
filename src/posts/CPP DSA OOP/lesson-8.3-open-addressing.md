# Lesson 8.3: Open Addressing / Linear Probing

*Phase 8 — Hashing*

---

## A different answer to the same problem

Lesson 8.2 handled collisions by letting each slot hold a whole chain. **Open addressing** takes a completely different approach: **every slot holds at most one entry, always — no linked lists, no extra memory per node at all.** When a collision happens, instead of chaining, you find a *different* empty slot in the same array and put the entry there instead. The entire table is one contiguous array (Lesson 1.5's structure, once again), nothing else.

## Linear probing: the simplest probing strategy

**Linear probing**'s rule: if your computed slot is occupied, check the next slot, and the next, wrapping around (Lesson 6.2's modulo-wraparound trick, reappearing here) until you find an empty one.

```cpp
class OpenAddressingMap {
private:
    struct Slot {
        std::string key;
        int value;
        bool occupied = false;
        bool wasDeleted = false;   // explained below — this matters
    };

    std::vector<Slot> table;
    int tableSize;

    int hash(const std::string& key) const {
        long long h = 0;
        for (char c : key) {
            h = (h * 31 + c) % tableSize;
        }
        return static_cast<int>(h);
    }

public:
    OpenAddressingMap(int size) : tableSize(size) {
        table.resize(tableSize);
    }

    void insert(const std::string& key, int value) {
        int index = hash(key);
        int startIndex = index;

        while (table[index].occupied && table[index].key != key) {
            index = (index + 1) % tableSize;   // PROBE: try the next slot
            if (index == startIndex) {
                std::cerr << "table full!" << std::endl;
                return;
            }
        }

        table[index] = {key, value, true, false};
    }

    bool find(const std::string& key, int& outValue) const {
        int index = hash(key);
        int startIndex = index;

        while (table[index].occupied || table[index].wasDeleted) {
            if (table[index].occupied && table[index].key == key) {
                outValue = table[index].value;
                return true;
            }
            index = (index + 1) % tableSize;
            if (index == startIndex) break;
        }
        return false;
    }
};
```

Trace `insert("cat", 1)` followed by `insert("act", 2)`, assuming both hash to index `7` in a table of size `10`: `"cat"` lands cleanly at index `7`. `"act"` computes index `7` too, finds it occupied by a *different* key, and probes forward — index `8`, checked, found empty, `"act"` lands there instead. No chain, no extra pointer, no extra allocation at all — both entries live directly inside the one contiguous `table` array.

## Why deletion is genuinely trickier than it looks

Here's the subtlety this lesson exists to teach, and it's the reason `Slot` has a `wasDeleted` flag instead of just resetting `occupied = false;` on removal. Picture this sequence: insert `"cat"` at index 7, insert `"act"` (collides, lands at index 8 via probing), then **delete `"cat"`** by naively setting `table[7].occupied = false;`. Now search for `"act"`: hash it, land at index 7, find it `occupied == false` — and if `find`'s loop stops the instant it sees an empty slot, it will **incorrectly conclude `"act"` doesn't exist at all**, even though it's sitting right there at index 8, because the search never continues past the now-empty slot 7 that used to be in the way.

```cpp
void remove(const std::string& key) {
    int index = hash(key);
    int startIndex = index;

    while (table[index].occupied || table[index].wasDeleted) {
        if (table[index].occupied && table[index].key == key) {
            table[index].occupied = false;
            table[index].wasDeleted = true;   // <- mark as a "tombstone," NOT simply empty
            return;
        }
        index = (index + 1) % tableSize;
        if (index == startIndex) break;
    }
}
```

`wasDeleted` marks a **tombstone** — a slot that's empty *but was once occupied*, distinct from a slot that was *never* occupied. Look back at `find`'s loop condition: `while (table[index].occupied || table[index].wasDeleted)` — it keeps probing through tombstones (they don't stop the search), but only stops at a slot that's genuinely, truly always been empty. This is the entire fix: a tombstone says "something used to be here, keep looking past me," while true emptiness says "nothing has ever been placed anywhere past this point in this probe sequence, stop looking." Getting this distinction wrong is a real, classic, easy-to-introduce bug in open-addressing implementations — worth understanding deeply rather than copying the code without grasping why the flag exists.

## `std::unordered_map` uses neither of these exact schemes exclusively

Worth knowing honestly: real-world hash table implementations vary — some standard library implementations of `std::unordered_map` use separate chaining (Lesson 8.2's approach, close to what you built), while other high-performance hash table designs (outside the C++ standard library specifically, like Google's `absl::flat_hash_map` or Rust's default `HashMap`) use open-addressing variants, often with more sophisticated probing than simple linear probing (quadratic probing, double hashing, or Robin Hood hashing — each solving specific weaknesses of plain linear probing, beyond this lesson's scope but worth knowing exist). Neither family is universally "correct" — this is Lesson 3.2's tradeoff framing again, now applied to hash table design itself.

## Comparing chaining vs. open addressing, honestly

| | Separate chaining (Lesson 8.2) | Open addressing / linear probing (this lesson) |
|---|---|---|
| Extra memory per entry | One `next` pointer per node | **None** — data lives directly in the array |
| Memory layout | Scattered (each chain node heap-allocated separately) | **Contiguous** — cache-friendly, Lesson 1.5's benefit |
| Behavior as the table fills up | Chains get longer, gracefully | Probing sequences get longer, and can degrade sharply as the table nears full |
| Deletion complexity | Simple — Lesson 8.2's splice-out logic | Genuinely trickier — requires tombstones, as shown above |
| Can exceed table size | Yes — chains can grow arbitrarily long | **No** — hard capped at `tableSize` slots, full stop |

That last row matters enormously in practice, and it's the direct motivation for the next lesson: an open-addressing table has a hard capacity ceiling built into its very design, and even a chaining table's performance degrades badly if it's allowed to fill up relative to its size (long chains, however "gracefully" they grow, are still eventually slow). Both schemes need a real answer to "what happens as the table fills up" — which is exactly what load factor and rehashing, arriving next, are about.

## Try it yourself

**1. Build `OpenAddressingMap` fully, reproduce the exact `"cat"`/`"act"` collision-then-deletion scenario from this lesson's explanation, and confirm the tombstone mechanism genuinely works** — that `find("act")` still succeeds after `"cat"` has been deleted.

**2. Deliberately remove the `wasDeleted` mechanism (revert `remove` to simply setting `occupied = false`) and reproduce the exact same scenario.** Confirm `find("act")` now incorrectly fails — direct, hands-on proof of the bug this lesson's tombstone mechanism exists to prevent.

**3. Fill an `OpenAddressingMap` close to its capacity (say, 90% full) and measure average probe sequence length for `find` calls, comparing against the same measurement at 50% full.** You should see probe lengths grow noticeably as the table fills — a real, measured preview of exactly the problem the next lesson addresses directly.

**4. Compare against Lesson 8.2's chaining-based `HashMap`** by inserting the same dataset into both and timing `find` across a large number of lookups, at a few different fill levels. This connects directly back to the comparison table above — confirm chaining stays more gracefully behaved as the table fills, at the direct cost of scattered memory and per-node overhead.

## What this cost / bought us

Open addressing buys contiguous, cache-friendly memory and zero per-entry pointer overhead — genuinely valuable, measurable advantages (Lesson 1.5's whole case for contiguity, applying here too) — in exchange for a hard capacity limit and meaningfully trickier deletion logic. Neither scheme from this phase's two collision-handling lessons is unconditionally better; the right choice depends on your actual workload's insert/delete/lookup ratio and memory constraints, exactly the kind of judgment call this curriculum has been building your instincts for since Lesson 3.2.

---

**Next up: Lesson 8.4 — Load factor & rehashing.** The table-filling-up problem, named precisely and solved directly — the hash-table equivalent of Lesson 1.6's `MyVector` doubling strategy, applied to a fundamentally different structure.
