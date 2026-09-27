# Lesson 8.1: Hash Functions

*Phase 8 — Hashing*
*You already trust Python's `dict` completely — now you build one.*

---

## What you've been trusting, unexamined

Every time you've written `some_dict[key]` in Python, or `counts[word]++` in this curriculum's own Phase 0 mini-project, you've relied on near-instant, O(1) lookup by an arbitrary key — not an index, a genuine key, of any type. This phase builds that mechanism from scratch, the same way Phase 1 built `MyVector` before you ever trusted `std::vector`. It starts with one question: **given a key (an integer, a string, anything), how do you turn it into an array index, instantly, without searching?**

## The core idea: a hash function

A **hash function** takes a key and deterministically produces a number — a **hash code**. That number, reduced to fit within an array's bounds, becomes the index where the key's associated value gets stored. If you can compute an index directly from a key, in O(1), you've eliminated the search entirely — no walking a list, no comparing against a BST's nodes, just: hash the key, go straight to that array slot.

```cpp
int simpleHash(int key, int tableSize) {
    return key % tableSize;   // the simplest possible hash function for integers
}
```

For key `17` and a table of size `10`: `17 % 10 = 7` — store this key's value at index `7`, always, every time, deterministically. Look it up later by computing `17 % 10` again — same index, immediately, no search.

## Why strings need a different approach

Integers hash naturally via arithmetic. Strings need their characters combined into a single number first. A genuinely common, simple technique — **polynomial rolling hash**:

```cpp
int hashString(const std::string& s, int tableSize) {
    long long hash = 0;
    int prime = 31;   // an arbitrary small prime, chosen for good distribution properties

    for (char c : s) {
        hash = (hash * prime + c) % tableSize;
    }

    return static_cast<int>(hash);
}
```

Each character contributes to the running hash, weighted by its position (via the repeated multiplication by `prime`) — meaning `"abc"` and `"cba"`, despite containing the same characters, produce genuinely different hash values, because the *order* of characters affects the arithmetic. Trace this by hand for a short string to build real intuition: for `"ab"` with `prime = 31` and, say, `tableSize = 100`: `hash = (0 * 31 + 'a') % 100`, then `hash = (that * 31 + 'b') % 100` — each character folds into an accumulating number that depends on everything before it.

## The properties a good hash function actually needs

**Determinism — the same key must always produce the same hash, every time, no exceptions.** This isn't a nice-to-have; it's the entire foundation everything else in this phase depends on. If `hashString("cat")` could return different values on different calls, you could store a value under one index and then be completely unable to find it again — the whole structure would be broken beyond repair. Every hash function in this lesson, and every one you'll write in this phase, must be a pure function of its input: same key in, same hash out, unconditionally.

**Uniform distribution — different keys should, on average, spread evenly across the available table slots, not cluster.** A "hash function" that always returns `0` is technically deterministic and technically legal, but useless — every single key would collide (next lesson's subject) at the same slot, degrading every operation to a linear search. `key % tableSize` is deterministic and reasonably well-distributed for many practical inputs, though it has known weak points (if every key happens to be a multiple of `tableSize`, they'll all collide) — real production hash functions (like the polynomial rolling hash above, or more sophisticated ones like MurmurHash or FNV, beyond this lesson's scope) are specifically engineered to avoid these weak points across a much wider range of realistic input patterns.

**Speed — computing a hash needs to be fast, since it happens on essentially every single operation.** This is a genuine engineering constraint, not an afterthought: a hash function that's slower than the linear search it's meant to replace would defeat its entire purpose.

## Why hashing gives up something BSTs (Phase 7) never gave up

Worth stating directly, connecting back to the previous phase: a hash function scrambles keys into essentially arbitrary-looking numbers, by design — this is exactly what buys you the O(1)-average lookup this phase is building toward. But it also means **hashing destroys ordering information completely.** `hashString("apple")` and `hashString("banana")` bear no meaningful numeric relationship to each other, even though `"apple" < "banana"` alphabetically — a BST's inorder traversal (Lesson 7.2) gives you sorted output for free; a hash-based structure fundamentally cannot, because the whole mechanism that makes it fast is precisely the thing that erases any relationship between a key's value and where it ends up stored. This is Lesson 7.6's heap-versus-BST tradeoff, recurring in a new shape: every structure in this curriculum buys some capability by deliberately giving up another.

## Try it yourself

**1. Implement `simpleHash` and `hashString` above, and hash a variety of keys against a small table size (say, 10) — print the results and confirm they're deterministic** by calling the function twice on the same key and confirming identical output.

**2. Confirm order matters for `hashString`** — hash `"abc"` and `"cba"` and confirm they produce different values (assuming your `tableSize` is large enough to not coincidentally collide — try a table size of at least 1000 to make an accidental match unlikely for this specific check).

**3. Measure distribution quality directly.** Generate a few thousand random strings with Python, hash all of them into a table of size 100 using `hashString`, and count how many land in each of the 100 slots. Plot or print this distribution (a simple histogram of counts per slot) and confirm it's roughly even — not perfectly uniform (that's genuinely hard to achieve), but without wild spikes in a handful of slots. This is a real, hands-on way to evaluate "is this a *good* hash function" empirically, rather than just trusting the claim.

**4. Deliberately build a bad hash function** — say, one that only looks at a string's first character (`return s[0] % tableSize;`) — and repeat the distribution measurement from exercise 3. You should see dramatic clustering (every string starting with the same letter collides into the same slot), direct, measured proof of why the polynomial approach, which factors in *every* character, is meaningfully better.

## What this cost / bought us

There's no comparison table this lesson — it's laying groundwork rather than making a design tradeoff. The one idea to carry forward: **a hash function is the entire mechanism that makes O(1) average-case lookup possible at all** — everything else in this phase (handling collisions, growing the table, `std::unordered_map`'s real internals) is really about making this one core idea work correctly and efficiently in practice, at scale, for real, messy, adversarial-in-the-worst-case data. The very next lesson tackles the first real problem this mechanism inevitably runs into: what happens when two different keys hash to the same slot?

---

**Next up: Lesson 8.2 — Separate chaining, using your `MyLinkedList` from Phase 5.** Two keys colliding at the same index isn't a bug to prevent entirely — it's a certainty to plan for, and Phase 5's linked list turns out to be exactly the right tool for handling it.
