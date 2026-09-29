# Lesson 10.2: Merge Sort, Quicksort, Heap Sort — Compared to `std::sort`

*Phase 10 — Sorting, Searching, and Generic Programming*

---

## Three genuinely different strategies, each a payoff of earlier material

This curriculum has already built the core idea behind each of these three algorithms, in a different context. Merge sort is divide-and-conquer, the same recursive shape as Lesson 7.1's tree recursion. Quicksort is partitioning around a pivot, a technique that rhymes with the BST invariant from Lesson 7.4. Heap sort is, almost literally, Lesson 7.6's `MinHeap` exercise 1, which already promised this lesson by name. None of these should feel like entirely new territory — they're familiar ideas, reapplied to the specific goal of producing a fully sorted array.

## Merge sort — divide, conquer, merge

```cpp
void merge(std::vector<int>& arr, int left, int mid, int right) {
    std::vector<int> temp;
    int i = left, j = mid + 1;

    while (i <= mid && j <= right) {
        if (arr[i] <= arr[j]) temp.push_back(arr[i++]);
        else                   temp.push_back(arr[j++]);
    }
    while (i <= mid)   temp.push_back(arr[i++]);
    while (j <= right) temp.push_back(arr[j++]);

    for (int k = 0; k < temp.size(); k++) {
        arr[left + k] = temp[k];
    }
}

void mergeSort(std::vector<int>& arr, int left, int right) {
    if (left >= right) return;   // base case, Lesson 7.1 — a range of 0 or 1 elements is already sorted

    int mid = left + (right - left) / 2;   // same overflow-safe midpoint as Lesson 10.1
    mergeSort(arr, left, mid);              // conquer the left half
    mergeSort(arr, mid + 1, right);         // conquer the right half
    merge(arr, left, mid, right);           // combine two sorted halves into one
}
```

Trace the recursion shape against Lesson 7.1's `factorial` stack diagram: `mergeSort` splits its range in half, recurses on each half independently, and only does real work (`merge`) *after* both recursive calls return — a direct structural cousin of Lesson 7.2's postorder traversal, where the "visit" step happens after both children are processed. `merge` itself is the one genuinely new piece: given two already-sorted subranges, it interleaves them into one sorted range in a single linear pass, comparing the fronts of each and taking the smaller one each time.

**Complexity:** each level of recursion does O(n) total work across all the merges at that level, and there are O(log n) levels (halving until ranges reach size 1) — giving **O(n log n)** overall, the best possible complexity for a general comparison-based sort (a real, provable lower bound, not just an observation). The cost: `merge` allocates a temporary vector, so merge sort uses **O(n) extra space**, a real, honest tradeoff worth naming rather than glossing over.

## Quicksort — partition, then conquer

```cpp
int partition(std::vector<int>& arr, int low, int high) {
    int pivot = arr[high];   // choosing the LAST element as pivot — simple, but see the exercise below
    int i = low - 1;

    for (int j = low; j < high; j++) {
        if (arr[j] < pivot) {
            i++;
            std::swap(arr[i], arr[j]);
        }
    }
    std::swap(arr[i + 1], arr[high]);
    return i + 1;   // the pivot's FINAL, correct sorted position
}

void quickSort(std::vector<int>& arr, int low, int high) {
    if (low >= high) return;

    int pivotIndex = partition(arr, low, high);   // do the real work FIRST, unlike merge sort
    quickSort(arr, low, pivotIndex - 1);
    quickSort(arr, pivotIndex + 1, high);
}
```

Notice the structural mirror image of merge sort: quicksort does its real work (`partition`) *before* recursing, not after. `partition` picks a pivot and rearranges the range so everything smaller than the pivot ends up to its left, everything larger ends up to its right, and the pivot itself lands in its final, correct sorted position — directly recalling the BST invariant (Lesson 7.4): "smaller goes left, larger goes right," here enforced by rearrangement instead of by tree structure. Once partitioned, each side can be sorted completely independently and recursively, since nothing on the left will ever need to interact with anything on the right again.

**Complexity — genuinely more interesting than merge sort's:** if the pivot consistently splits the range roughly in half, quicksort is O(n log n), like merge sort. But the pivot-choice strategy above (always the last element) has a real, exploitable worst case: **an already-sorted (or reverse-sorted) array causes every partition to be maximally unbalanced** — one side empty, the other holding everything else — degrading to **O(n²)**, the exact same "degenerate input breaks the average case" pattern Lesson 7.4's plain BST suffered from. This is not a hypothetical concern; it's a well-known, real weakness of naive quicksort, and it's precisely why production sort implementations use smarter pivot selection (median-of-three, or randomization) to make the worst case vanishingly unlikely rather than trivially triggerable. **Unlike merge sort, quicksort sorts in place — O(log n) extra space** for the recursion itself, no auxiliary array — a real, meaningful memory advantage traded directly against the worst-case time risk.

## Heap sort — Lesson 7.6's promise, redeemed

```cpp
void heapSort(std::vector<int>& arr) {
    MinHeap heap;   // Lesson 7.6, unmodified
    for (int v : arr) {
        heap.push(v);
    }
    for (int i = 0; i < arr.size(); i++) {
        arr[i] = heap.pop();   // pops always return the current minimum — Lesson 7.6's whole point
    }
}
```

This is literally Lesson 7.6's exercise 1, given a name. Push everything, then pop everything — since `pop` always returns the current minimum, the popped sequence is, by construction, fully sorted. **Complexity: O(n log n)**, since both `push` and `pop` are O(log n) (Lesson 7.6) and you do n of each. **Space: O(n)** for the heap's own storage in this version — though a genuinely more sophisticated variant sorts *in place*, using the same array being sorted as the heap's own backing storage (build a max-heap in place, then repeatedly swap the root with the last unsorted element and shrink the heap by one), achieving O(1) extra space. That in-place version is a worthwhile exercise once this simpler one is solid, and it's the version real standard-library implementations actually use when they fall back to heap sort (see below).

## `std::sort` — and why it's none of these three, exactly

```cpp
#include <algorithm>
std::sort(arr.begin(), arr.end());
```

`std::sort` is not required by the C++ standard to use any specific algorithm — but nearly every real implementation uses **introsort**: start with quicksort (fast in the common case), but **switch to heap sort if the recursion depth grows suspiciously large** (a signal that quicksort has hit something close to its O(n²) worst case), guaranteeing O(n log n) even in quicksort's worst-case scenario, and often **switch to insertion sort for very small subranges** (under some small threshold like 16 elements), since insertion sort's low constant-factor overhead beats quicksort's recursive overhead for tiny inputs. This is a genuinely elegant piece of engineering: it's not "pick the best algorithm," it's "combine three algorithms, each covering the others' weaknesses," directly recalling this curriculum's very first comparison exercise (Lesson 3.3) — the standard library earning its reputation by doing real, considered engineering work you can now actually appreciate the shape of.

## Try it yourself

**1. Implement all three algorithms and confirm each correctly sorts the same set of test arrays**, including edge cases: an already-sorted array, a reverse-sorted array, an array with many duplicate values, and an array of size 0 or 1.

**2. Reproduce quicksort's O(n²) worst case directly.** Run the naive last-element-pivot `quickSort` on an already-sorted array of increasing size (1,000, then 10,000, then 100,000 elements) and time each run. Confirm the time grows quadratically, not log-linearly — plot or print the ratio of consecutive timings and confirm it roughly matches what O(n²) predicts (a 10x larger input should take roughly 100x longer, not roughly 10x longer as O(n log n) would predict).

**3. Fix the pivot-choice weakness** using the "median of three" heuristic: instead of always picking the last element, compare the first, middle, and last elements of the range and use whichever is the median of the three as the pivot. Rerun exercise 2's already-sorted-array benchmark with the fixed version and confirm the quadratic blowup disappears.

**4. Benchmark all three of your implementations against `std::sort`**, on the same large random dataset, using the `<chrono>` technique from Phase 3. Predict which will be fastest before running — then confirm or update your prediction with the real numbers. `std::sort`, backed by introsort and years of tuning, will very likely win, echoing Lesson 3.3's `MyVector`-versus-`std::vector` result.

**5. Confirm the space-complexity claims directly**, by instrumenting each algorithm to count total allocations (or peak extra memory used) during a sort, and compare merge sort's O(n) auxiliary space against quicksort's O(log n) recursion-only space.

## What this cost / bought us

| | Merge sort | Quicksort (naive pivot) | Heap sort |
|---|---|---|---|
| Time (average) | O(n log n) | O(n log n) | O(n log n) |
| Time (worst case) | **O(n log n), guaranteed** | O(n²) — degenerate input | **O(n log n), guaranteed** |
| Extra space | O(n) | O(log n) | O(n) (this version) / O(1) (in-place version) |
| Stable (equal elements keep their relative order) | Yes | No, generally | No |
| In place | No | Yes | Yes (in-place version) |
| Underlying earlier-curriculum idea | Divide-and-conquer recursion (Lesson 7.1) | Partition around an invariant (Lesson 7.4's BST spirit) | A heap, used exactly as designed (Lesson 7.6) |

No single algorithm wins on every axis — exactly the pattern this entire curriculum has trained you to expect by now. `std::sort`'s real engineering answer, introsort, isn't a fourth clever algorithm; it's a considered combination of the three you just built, each covering a specific weakness of the others.

---

**Next up: Lesson 10.3 — Function templates & class templates.** Every structure in this curriculum since `MyVector` has been locked to `int`. Time to fix that, permanently, with the single mechanism that makes writing a container "once, for any type" actually possible.
