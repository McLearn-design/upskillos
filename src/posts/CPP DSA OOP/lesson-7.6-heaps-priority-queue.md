# Lesson 7.6: Heaps, and `std::priority_queue`

*Phase 7 — Trees, Recursion, and the Iterator Pattern*

---

## A weaker, cheaper guarantee

A binary search tree guarantees *everything* is ordered, everywhere, all the time — a strong, expensive-to-maintain guarantee (Lesson 7.5's rotations exist purely to protect it). Often, you don't actually need that much. You just need one specific, narrower question answered instantly: **what's the smallest (or largest) element right now?** A **heap** provides exactly that, and nothing more — a much weaker invariant, which turns out to be much cheaper to maintain, and, surprisingly, doesn't need pointers at all.

## The heap invariant

A **min-heap**: every node's value is less than or equal to both of its children's values. (A **max-heap** flips the inequality.) Notice what this invariant does *not* say: nothing about left versus right being smaller, nothing about siblings' relative order, nothing that would let you do a BST-style search. The only thing it guarantees is: **the root is always the smallest element in the entire structure.**

```
       1
      / \
     3   2
    / \
   5   4
```

Check the invariant at every node: `1 ≤ 3`, `1 ≤ 2`, `3 ≤ 5`, `3 ≤ 4` — holds everywhere. Notice `3` and `2` have no defined order relative to each other at all (they're siblings, invariant says nothing about siblings) — this genuinely is a weaker structure than a BST, on purpose.

## The genuinely clever part: no pointers needed at all

A heap is always kept as a **complete binary tree** — every level fully filled, except possibly the last, which fills left to right with no gaps. This specific shape constraint means a heap can be stored in a plain array, with child/parent relationships computed by pure arithmetic instead of stored pointers — directly recalling Lesson 1.5's address-arithmetic trick, applied here to tree structure instead of array indexing:

```
Array:  [1, 3, 2, 5, 4]
Index:   0  1  2  3  4

For any node at index i:
  left child index  = 2*i + 1
  right child index = 2*i + 2
  parent index       = (i - 1) / 2   (integer division)
```

Check it against the tree above: index `0` (value `1`)'s children are at `2*0+1=1` and `2*0+2=2` — values `3` and `2`. Correct. Index `1` (value `3`)'s children are at `2*1+1=3` and `2*1+2=4` — values `5` and `4`. Correct. **No `Node` class, no `left`/`right` pointers, no heap allocation per element at all** — just a `MyVector`-style contiguous array (Phase 1–2's structure, reused completely unchanged) and two lines of index arithmetic. This is a genuinely elegant piece of engineering: all the benefit of tree *structure*, none of the pointer-chasing cost from Phase 5.

## `push` — insert at the end, then "bubble up"

```cpp
class MinHeap {
private:
    MyVector data;   // reusing Phase 2's container directly

    void bubbleUp(int index) {
        while (index > 0) {
            int parentIndex = (index - 1) / 2;
            if (data[index] < data[parentIndex]) {
                std::swap(data[index], data[parentIndex]);
                index = parentIndex;
            } else {
                break;   // invariant restored, stop
            }
        }
    }

public:
    void push(int value) {
        data.pushBack(value);            // add at the very end — O(1) amortized, Lesson 3.1
        bubbleUp(data.getSize() - 1);     // then fix the invariant, walking UP toward the root
    }
};
```

New elements always go at the end of the array (the next open spot in the complete-tree shape), then repeatedly swap upward with their parent for as long as they're smaller than it — "bubbling up" until the invariant holds again or the root is reached. Because a complete binary tree's height is O(log n), this bubble-up touches at most O(log n) nodes — `push` is O(log n), meaningfully better than a BST's *worst*-case O(n) (Lesson 7.5), though not quite as fast as `MyVector`'s O(1)-amortized append, since a heap has real structural work to do that a plain array doesn't.

## `pop` (extract the minimum) — swap root with the last element, then "bubble down"

```cpp
int pop() {
    int minValue = data[0];                        // the root is ALWAYS the minimum
    data[0] = data[data.getSize() - 1];             // move the LAST element to the root
    // (shrink data's size by 1 here)
    bubbleDown(0);                                   // fix the invariant, walking DOWN from the root
    return minValue;
}

void bubbleDown(int index) {
    int size = data.getSize();
    while (true) {
        int left = 2 * index + 1;
        int right = 2 * index + 2;
        int smallest = index;

        if (left < size && data[left] < data[smallest])   smallest = left;
        if (right < size && data[right] < data[smallest]) smallest = right;

        if (smallest == index) break;   // invariant restored, stop

        std::swap(data[index], data[smallest]);
        index = smallest;
    }
}
```

`pop` reads the minimum directly (`data[0]`, O(1) — the whole point of a heap), then patches the hole left behind by moving the last element into the root's spot and letting it sink down to wherever it belongs, swapping with whichever child is smaller at each step. Same O(log n) bound as `push`, same underlying reason (bounded by the tree's height).

## Comparing to a BST, honestly

| | BST (balanced, Lesson 7.4–7.5) | Heap (this lesson) |
|---|---|---|
| Find the minimum | O(log n) — walk all the way left | **O(1)** — always the root |
| Find an arbitrary value | O(log n) | **O(n)** — no ordering shortcut beyond parent-child; a heap can't do BST-style search at all |
| Insert | O(log n) | O(log n) |
| Remove the minimum | O(log n) | O(log n) |
| Underlying storage | Pointers, scattered | A plain array — contiguous, cache-friendly (Lesson 1.5) |
| Guarantee | Everything fully ordered | Only "root is smallest" — much weaker |

The honest takeaway: **a heap trades away general searchability for a much cheaper, more cache-friendly structure, in exchange for excelling at exactly one specific, common task — repeatedly asking "what's the smallest (or largest) thing right now?"** If that's genuinely the only question you need answered repeatedly (which, in a huge number of real algorithms — Dijkstra's algorithm in Phase 9, for one — is exactly the pattern), a heap is the right, lean tool; reaching for a full BST would be paying for a guarantee (total ordering) you never actually use.

## `std::priority_queue` — the real thing

```cpp
#include <queue>

std::priority_queue<int> pq;   // MAX-heap by default
pq.push(5);
pq.push(1);
pq.push(9);
pq.push(3);

while (!pq.empty()) {
    std::cout << pq.top() << " ";   // 9 8 ... always removes the LARGEST first, by default
    pq.pop();
}
```

`std::priority_queue` is, internally, essentially exactly `MinHeap`/`MaxHeap` above, generalized — a heap built on top of a `std::vector` (by default), with `push`/`pop`/`top` doing the identical bubble-up/bubble-down dance you just implemented by hand. Note it's a **max-heap by default** in the standard library (largest element on top) — pass `std::greater<int>` as a comparator template argument to flip it into a min-heap instead, a genuine, real-world use of the comparator concept from Phase 4's Strategy pattern lesson, reappearing here in the standard library itself.

## Try it yourself

**1. Build `MinHeap` above (fill in the `pop` size-shrinking, matching `MyVector`'s own pattern), push a scrambled sequence of values, then repeatedly `pop()` and confirm the values come out in fully sorted, ascending order** — this specific technique (build a heap, then pop everything) is called **heapsort**, and it's a real, genuine O(n log n) sorting algorithm, arriving properly as its own lesson in Phase 10.

**2. Confirm the array-arithmetic claim directly** — print `data`'s raw contents after each push, and manually verify, using the index formulas, that the parent-child relationships hold at every level, without ever constructing a `TreeNode` or a pointer anywhere.

**3. Build `std::priority_queue<int>` and `std::priority_queue<int, std::vector<int>, std::greater<int>>` (the min-heap variant) side by side, push the same values into both, and confirm one pops largest-first and the other pops smallest-first.**

**4. Measure `MinHeap::push` and `MinHeap::pop`'s real cost for a large number of operations (100,000+), and compare against inserting the same values into a plain `MyVector` and finding the minimum by scanning it linearly each time.** Confirm the heap wins decisively as the operation count grows — direct, measured proof that O(log n) genuinely beats O(n) at scale, even though a single linear scan might look competitive for small inputs.

## What this cost / bought us

Heaps are the first structure in this phase that's simultaneously tree-*shaped* in its logical structure but array-*based* in its actual implementation — a genuinely satisfying synthesis of Phase 1's contiguous-array intuition and this phase's tree intuition, arriving together in one structure. The next lesson, tries, returns to pointer-based tree structures — but with a very different, genuinely useful specialization: trees built specifically around strings and prefixes, rather than numeric ordering at all.

---

**Next up: Lesson 7.7 — Tries.** Build one from a real dictionary word list loaded from a file — a direct return to this phase's recurring file-I/O thread, and a tree structure whose branching factor is the alphabet itself rather than a fixed two children per node.
