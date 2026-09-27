# Lesson 8.4: Load Factor & Rehashing

*Phase 8 — Hashing*

---

## Naming the problem precisely

Lesson 8.3 ended by measuring something real: probe sequences got longer as the table filled up. This lesson gives that observation a name and a fix. **Load factor**, usually written α (alpha), is defined precisely as:

```
load factor = number of entries stored / total number of slots
```

A table with 70 entries and 100 slots has a load factor of 0.7. This single number is the direct predictor of performance for *both* collision-handling schemes from Lessons 8.2 and 8.3 — as α climbs toward 1.0 (chaining) or especially as it approaches the hard ceiling of 1.0 (open addressing, where α literally cannot exceed 1), performance degrades, predictably and measurably.

## Why high load factor is bad — for both schemes, for related but distinct reasons

**Chaining (Lesson 8.2):** average chain length is directly proportional to α. At α = 0.5, chains average 0.5 entries — usually 0 or 1, essentially O(1) lookup. At α = 5 (five times as many entries as slots — chaining *permits* this, since chains can grow arbitrarily), chains average 5 entries each — still technically bounded, but meaningfully slower, and getting linearly worse as more entries are added without growing the table.

**Open addressing (Lesson 8.3):** the effect is sharper. As α approaches 1.0, empty slots become genuinely rare, and linear probing's "just check the next slot" strategy can require long runs of probes to find an open spot — in the worst case, approaching O(n) as the table nears completely full. This is a real, well-studied mathematical result: open addressing's expected probe length grows roughly as 1/(1-α), which stays small for α under about 0.7 but climbs sharply and non-linearly as α approaches 1 — go from α = 0.5 to α = 0.9 and the expected probe count roughly doubles; go from 0.9 to 0.99 and it roughly doubles again. This precise, sharp degradation is exactly why open addressing implementations, in practice, almost always trigger a resize well before the table is actually full — often around α = 0.7, not α = 0.99.

## The fix: rehashing, when α crosses a threshold

The fix mirrors Lesson 1.6's `MyVector` growth strategy almost exactly in spirit, though the mechanics differ in one crucial way:

```cpp
class HashMap {
private:
    std::vector<std::unique_ptr<HashNode>> table;
    int tableSize;
    int entryCount = 0;
    static constexpr double MAX_LOAD_FACTOR = 0.75;

    double loadFactor() const {
        return static_cast<double>(entryCount) / tableSize;
    }

    void rehash() {
        int newSize = tableSize * 2;   // Lesson 1.6's doubling, reused directly
        std::vector<std::unique_ptr<HashNode>> newTable(newSize);

        // walk EVERY existing entry and reinsert it into the new, larger table
        for (auto& chainHead : table) {
            HashNode* current = chainHead.get();
            while (current != nullptr) {
                int newIndex = hashWithSize(current->key, newSize);   // hash AGAIN, against the NEW size
                auto newNode = std::make_unique<HashNode>(current->key, current->value);
                newNode->next = std::move(newTable[newIndex]);
                newTable[newIndex] = std::move(newNode);
                current = current->next.get();
            }
        }

        table = std::move(newTable);
        tableSize = newSize;
    }

public:
    void insert(const std::string& key, int value) {
        if (loadFactor() >= MAX_LOAD_FACTOR) {
            rehash();
        }
        // ... normal insert logic from Lesson 8.2, using the (possibly just-updated) tableSize ...
        entryCount++;
    }
};
```

## Why this is genuinely different from `MyVector`'s resize, not just a repeat

This is worth stopping on directly, because it's a real, important distinction, not a minor implementation detail. `MyVector::pushBack`'s resize (Lesson 1.6) copied every element to the **same relative position** in the new, larger array — element at index 3 stayed at index 3, just in a bigger block. A hash table's rehash **cannot** do this: every single entry's correct location is a function of `hash(key) % tableSize`, and `tableSize` just changed. **Every entry must be re-hashed from scratch against the new table size**, because its old index has no necessary relationship to its new, correct index at all. This is real, unavoidable O(n) work at the moment a rehash triggers — genuinely more expensive, per-resize, than `MyVector`'s "just copy the bytes" resize, even though both are triggered by the identical "we're full, grow and migrate" logic.

## Amortized analysis, again — Lesson 3.1's exact reasoning, reapplied

Despite each individual rehash being a real O(n) operation, **inserting n entries total still costs O(n) amortized**, for precisely the same mathematical reason Lesson 3.1 proved for `MyVector`'s doubling: rehashes happen at table sizes `1, 2, 4, 8, 16, ...`, a geometric sequence, so the total work across all rehashes up to n entries sums to less than `2n` — spread across `n` total insertions, that's a constant amount of amortized extra work per insertion, not a growing one. If you understood Lesson 3.1's proof, this is the *exact same argument*, applied to a different trigger condition (load factor crossing a threshold, instead of `size == capacity`) but the identical doubling-based mathematics underneath.

## Try it yourself

**1. Build the full `rehash()` mechanism into your Lesson 8.2 `HashMap`, insert enough entries to trigger several rehashes, and add a print statement inside `rehash()` reporting the old and new table sizes.** Confirm the sizes double each time (`1 → 2 → 4 → 8...`, or whatever your starting size is), exactly mirroring Lesson 1.6's `MyVector` output.

**2. Confirm every entry survives a rehash correctly.** Insert a known set of key-value pairs, force enough additional insertions to trigger a rehash, and then `find()` every one of your original entries, confirming all values are still correct — direct proof the re-hashing-from-scratch logic is genuinely necessary and genuinely working, not just theoretically required.

**3. Measure average chain length before and after a rehash**, using the "longest/average chain" instrumentation from Lesson 8.2's exercises. Confirm it drops sharply right after a rehash (more slots, same entries, load factor cut roughly in half) and then climbs again as more entries are added, sawtoothing predictably — a genuinely satisfying pattern to watch directly rather than just read about.

**4. For the open-addressing version from Lesson 8.3, add the identical load-factor-triggered rehash logic**, but with a lower `MAX_LOAD_FACTOR` threshold (try 0.7, matching the real-world practice mentioned above) — and measure average probe length before and after rehashing triggers, confirming it stays consistently low instead of climbing toward the sharp 1/(1-α) degradation curve described earlier.

## What this cost / bought us

| | No rehashing (fixed table size, forever) | Rehashing at a load-factor threshold (this lesson) |
|---|---|---|
| Performance as entries grow | Degrades — chains lengthen or probe sequences grow (Lessons 8.2/8.3) | Stays close to O(1) average, indefinitely |
| Cost of a single rehash | N/A | O(n) — must re-hash every entry against the new size |
| Cost per insertion, amortized over many insertions | N/A | **O(1) amortized** — Lesson 3.1's exact mathematics, reapplied |
| Memory overhead | Fixed, potentially inefficient at extremes | Can be up to ~2x the strictly necessary size right after growth — Lesson 3.2's tradeoff, recurring again |

This lesson closes the loop that Lesson 8.1 opened: a hash table's O(1) average-case promise was never automatic — it required a good hash function (8.1), a correct collision-handling scheme (8.2 or 8.3), *and* active load-factor management (this lesson) working together. Remove any one of these three pieces and the O(1) claim quietly breaks down into something much worse. `std::unordered_map` does all three of these, invisibly, every time you use it — exactly the same "the standard library was doing real, non-trivial work the whole time" realization Phase 3 delivered for `std::vector`.

---

**Next up: Lesson 8.5 — `std::unordered_map` internals.** A direct tour of what the real standard library container is actually doing underneath, now that you've built every one of its component pieces by hand.
