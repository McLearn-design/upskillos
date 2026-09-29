# Lesson 10.1: Binary Search

*Phase 10 — Sorting, Searching, and Generic Programming*

---

## The BST invariant, without the tree

Lesson 7.4's BST search was fast because of one guarantee: at every node, everything smaller lives left, everything larger lives right, so every comparison discards half the remaining candidates. A plain **sorted array** carries almost the identical guarantee, with no pointers, no nodes, no tree structure at all: if the array is sorted, checking the middle element tells you which half of the array the target could possibly be in, and the other half can be discarded entirely, just as confidently as a BST discards a subtree.

## The algorithm

```cpp
int binarySearch(const std::vector<int>& arr, int target) {
    int low = 0;
    int high = arr.size() - 1;

    while (low <= high) {
        int mid = low + (high - low) / 2;   // not (low + high) / 2 — see below

        if (arr[mid] == target) {
            return mid;
        } else if (arr[mid] < target) {
            low = mid + 1;    // target must be in the RIGHT half, if it exists at all
        } else {
            high = mid - 1;   // target must be in the LEFT half, if it exists at all
        }
    }

    return -1;   // not found
}
```

Every iteration halves the search space, exactly the way a BST search discards a subtree at every node. That's not a loose analogy — it's the same underlying mechanism, expressed with array indices (`low`, `high`, `mid`) instead of node pointers (`left`, `right`), which is precisely why binary search on a sorted array is O(log n), the identical complexity class as a balanced BST's search (Lesson 7.5).

## `low + (high - low) / 2`, not `(low + high) / 2`

The comment above flags a real, historically significant bug. `(low + high) / 2` looks equivalent and, for most inputs, produces the same result — but for very large arrays, `low + high` can exceed the maximum value an `int` can hold, silently wrapping around to a negative number (a real consequence of Lesson 0.2's fixed-size integer types, and the exact kind of overflow bug that has shipped in production binary search implementations, including a famous, widely-cited bug in a major published algorithms textbook and, separately, in early versions of Java's standard library). `low + (high - low) / 2` computes the identical midpoint but never adds two numbers that could individually be close to the maximum `int` value, avoiding the overflow entirely. This single detail is worth remembering specifically because it's the kind of bug that passes every small test case and fails only at scale — exactly the sort of thing careful, defensive coding habits (built across this entire curriculum) exist to catch before it reaches production.

## Precondition: binary search requires the array to already be sorted

This cannot be overstated, and it's worth testing directly rather than just accepting. Binary search's entire correctness argument depends on being able to conclude "if the target isn't at `mid`, and `arr[mid] < target`, then the target can't be anywhere in `[low, mid]`" — a conclusion that is only valid because sortedness guarantees everything at or before `mid` is `≤ arr[mid]`. Run binary search against unsorted data and it will silently return wrong answers (or fail to find something that's genuinely present) without any error or warning — a real, common source of bugs when someone forgets a prerequisite sort, or when data that used to be sorted gets modified without re-sorting.

## `std::lower_bound` and `std::upper_bound` — the real standard library versions

```cpp
#include <algorithm>

std::vector<int> sorted = {1, 3, 3, 3, 5, 7, 9};

auto it = std::lower_bound(sorted.begin(), sorted.end(), 3);
std::cout << "first position >= 3: " << (it - sorted.begin()) << std::endl;   // index 1

auto it2 = std::upper_bound(sorted.begin(), sorted.end(), 3);
std::cout << "first position > 3: " << (it2 - sorted.begin()) << std::endl;   // index 4
```

`std::lower_bound` finds the first position where an element could be inserted without breaking sortedness, specifically the first position holding a value `≥` the target — genuinely more useful than a plain "found or not found" binary search in a huge number of real situations, especially with duplicate values (as shown here, `3` appears three times, and `lower_bound`/`upper_bound` together bracket the exact range of positions holding `3`). Both are built on precisely the same halving mechanism as the hand-written version above, and both work on *any* type providing the iterator interface (Phase 7's Iterator pattern payoff, arriving again) — including your own `BST`'s iterator from that lesson, or `MyVector`, if you give it iterator support.

## Complexity and a direct, measured comparison

Binary search is O(log n). A naive linear scan (checking every element in order) is O(n) — the exact comparison Lesson 3.3 ran for `MyVector` versus `std::vector`, now repeated for search algorithms specifically.

```cpp
bool linearSearch(const std::vector<int>& arr, int target) {
    for (int v : arr) {
        if (v == target) return true;
    }
    return false;
}
```

For a million-element sorted array, binary search needs at most about 20 comparisons (log₂(1,000,000) ≈ 20) — linear search could need up to a million. This gap is dramatic enough to measure directly rather than take on faith.

## Try it yourself

**1. Implement `binarySearch` above and test it against a hand-built sorted array, searching for values that exist and values that don't.** Confirm it returns the correct index or `-1` in every case, including edge cases: searching for the smallest element, the largest element, and a value smaller than everything or larger than everything in the array.

**2. Deliberately reproduce the overflow bug.** Change `low + (high - low) / 2` to `(low + high) / 2`, then construct (or reason through) a scenario with `low` and `high` both close to `INT_MAX / 2`, and confirm the buggy version misbehaves while the safe version doesn't. (You may need a genuinely huge array to trigger this in practice — reasoning through the arithmetic by hand with `INT_MAX`-scale numbers is a legitimate substitute if allocating such an array isn't practical on your system.)

**3. Confirm the "requires sorted input" precondition directly by breaking it.** Run `binarySearch` against a deliberately unsorted array containing the target value, and find a case where it incorrectly returns `-1` despite the value being present. This is worth doing specifically so the precondition isn't just a warning you read past.

**4. Measure binary search against linear search directly**, using the `<chrono>` technique from Phase 3, on a sorted array of 10 million elements, searching for a value near the end (linear search's worst case). Confirm the gap matches the O(log n) versus O(n) prediction — it should be dramatic, likely several orders of magnitude.

**5. Use `std::lower_bound` and `std::upper_bound` together to count how many times a specific value appears in a sorted array with duplicates** (`upper_bound` position minus `lower_bound` position). Confirm it matches a manual count.

## What this cost / bought us

| | Linear search | Binary search |
|---|---|---|
| Precondition | None — works on any array | **Must be sorted** |
| Time complexity | O(n) | O(log n) |
| Underlying mechanism | Check every element | Halve the search space every comparison — same idea as a BST (Lesson 7.4) |
| Real standard-library tools | `std::find` (Phase 7's Iterator payoff) | `std::lower_bound`, `std::upper_bound`, `std::binary_search` |

Binary search is this curriculum's cleanest demonstration that a strong precondition, honestly maintained, can be worth an enormous performance payoff — a theme that will recur directly in the next lesson, where *keeping* an array sorted (or building one that starts sorted) becomes the actual work, and binary search becomes just the reward for having done it.

---

**Next up: Lesson 10.2 — Merge sort, quicksort, heap sort — implemented, then compared to `std::sort`.** Three genuinely different sorting strategies, each one a direct payoff of a structure or technique from earlier in this curriculum.
