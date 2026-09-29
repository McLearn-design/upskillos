# Design Pattern: Template Method vs. a Generic Templated Function

*Phase 10 — Sorting, Searching, and Generic Programming*
*Same "define the skeleton, plug in the steps" idea, shown two ways.*

---

## A pattern you've already half-seen

Lesson 2.3 briefly mentioned this shape without naming it: an abstract class can provide real, shared behavior alongside pieces that only derived classes can fill in correctly. Lesson 10.4's comparator-based `mergeSort` did something structurally similar from a completely different angle: the overall algorithm (`mergeSort`'s recursive splitting and merging) stayed fixed, while one specific piece (how to compare two elements) was supplied from outside. This closing lesson names both approaches explicitly and puts them side by side, because they're solving the identical underlying problem — **an algorithm has a fixed overall shape, but one or more steps within it need to vary** — using two genuinely different C++ mechanisms.

## Version 1: Template Method — inheritance and `virtual`

```cpp
class SortAlgorithm {
public:
    virtual ~SortAlgorithm() {}

    void sort(std::vector<int>& arr) {   // the SKELETON — fixed, never overridden
        std::cout << "starting sort of " << arr.size() << " elements" << std::endl;
        doSort(arr);                       // the VARYING step — delegated to a subclass
        std::cout << "sort complete" << std::endl;
    }

protected:
    virtual void doSort(std::vector<int>& arr) = 0;   // pure virtual, Lesson 4.3 — the "plug in the steps" part
};

class BubbleSortAlgorithm : public SortAlgorithm {
protected:
    void doSort(std::vector<int>& arr) override {
        for (size_t i = 0; i < arr.size(); i++) {
            for (size_t j = 0; j < arr.size() - i - 1; j++) {
                if (arr[j] > arr[j + 1]) std::swap(arr[j], arr[j + 1]);
            }
        }
    }
};

class MergeSortAlgorithm : public SortAlgorithm {
protected:
    void doSort(std::vector<int>& arr) override {
        mergeSort(arr, 0, arr.size() - 1);   // Lesson 10.2's implementation, reused
    }
};
```

```cpp
void runSort(SortAlgorithm& algo, std::vector<int>& data) {
    algo.sort(data);   // ALWAYS calls the fixed skeleton — logging happens no matter which subclass this is
}
```

The name "Template Method" refers to `sort()` itself — a method that defines an algorithm's fixed *template* (its unchanging skeleton, structure, and surrounding steps like the logging here), while delegating one or more specific steps to `virtual` functions that subclasses override. This is directly, structurally the same shape as Lesson 4.3's `Shape::describe()` calling the pure-virtual `area()` internally — a concrete, real second application of a pattern you first saw without a name, several phases ago.

## Version 2: a generic templated function

```cpp
template <typename SortFunc>
void runSortGeneric(std::vector<int>& arr, SortFunc sortImpl) {
    std::cout << "starting sort of " << arr.size() << " elements" << std::endl;
    sortImpl(arr);   // the varying step, as a plain callable — no class hierarchy at all
    std::cout << "sort complete" << std::endl;
}
```

```cpp
runSortGeneric(data, [](std::vector<int>& arr) {
    mergeSort(arr, 0, arr.size() - 1);
});

runSortGeneric(data, [](std::vector<int>& arr) {
    // bubble sort inline
    for (size_t i = 0; i < arr.size(); i++)
        for (size_t j = 0; j < arr.size() - i - 1; j++)
            if (arr[j] > arr[j + 1]) std::swap(arr[j], arr[j + 1]);
});
```

The skeleton — the "starting"/"complete" messages surrounding the actual sort — is identical between the two calls, exactly as fixed as `SortAlgorithm::sort()` was. The varying step is a lambda instead of an overridden virtual method. This is the same comparison this curriculum has now run four separate times — Strategy (Phase 4), Command (Phase 6), Visitor (Phase 7), and now this — arriving, once again, at the identical underlying choice: **class hierarchy versus first-class callable**, applied to a fifth different concrete problem.

## What's actually different this time, worth noticing precisely

Every earlier pattern comparison in this curriculum framed the class-hierarchy version and the callable version as fully interchangeable alternatives. This lesson's version 1 has something the others didn't emphasize as strongly: **the skeleton and the varying step share the same object, with the skeleton able to call the varying step as many times as it wants, in whatever sequence it wants, interleaved with other fixed logic, using the object's own accumulated state along the way.** A `SortAlgorithm` subclass could, if it needed to, maintain internal fields tracking statistics across multiple calls to `doSort` (a counter of comparisons made, say), naturally, as ordinary object state. The generic-function version can approximate this with captured variables in a lambda's closure, but it's a slightly more awkward fit for state that needs to persist and accumulate across a genuinely complex, multi-step algorithm with many distinct customization points, rather than just one.

## Try it yourself

**1. Build both versions above and confirm both produce identical output** ("starting sort..." / sorted correctly / "sort complete") for both a bubble-sort and a merge-sort implementation.

**2. Extend `SortAlgorithm` with a second customization point** — a `virtual bool shouldLog() const { return true; }` that a subclass can override to suppress the logging messages — and confirm one subclass can opt out while another keeps the default behavior. Then try to achieve the same flexibility with the generic-function version, and notice how much more natural this is to express as object state (a field, checked in the skeleton) than as a second lambda parameter threaded through every call site.

**3. Add real accumulated state**: give `SortAlgorithm` (or a specific subclass) a `int comparisonCount = 0;` field, increment it inside `doSort`, and print it after `sort()` completes. Then attempt the same thing with the generic-function version, using a captured `int&` reference in the lambda, and compare how naturally each approach expresses "this operation accumulates state across its own internal steps."

**4. Write your own short paragraph deciding which version you'd use for a real project needing several interchangeable sort algorithms, each with the possibility of tracking its own internal statistics.** This mirrors the open design question Phase 7's Visitor lesson asked directly — there's a real, defensible answer either way, and forming your own is more valuable than being handed one.

## What this cost / bought us

| | Template Method (OOP) | Generic templated function |
|---|---|---|
| Skeleton | A non-virtual method calling virtual "hook" methods | A function taking a callable parameter |
| Varying step | Overridden `virtual` function in a subclass | A lambda or other callable, passed in |
| Natural fit for accumulated internal state across steps | Strong — ordinary object fields | Weaker — requires captured variables |
| Ceremony to add a new variant | A new subclass | A new lambda |
| Underlying idea | **Identical** — fixed skeleton, pluggable steps | **Identical** — fixed skeleton, pluggable steps |

---

**Phase 10 is complete.** Binary search built on the same halving idea as a BST, three sorting algorithms each redeeming a promise from an earlier phase and honestly compared against `std::sort`'s real introsort strategy, templates finally freeing every structure in this curriculum from being locked to `int`, comparator lambdas as the single most common real-world use of everything Phase 4 and this phase built together, and a fifth and final appearance of the Strategy-shaped pattern that's been recurring since Phase 4.

**Next up: Phase 11 — Functional-Style C++.** A deliberate perspective shift after roughly twenty weeks of object-thinking — functions as values properly formalized, `std::optional` and `std::variant`, and the STL algorithms that are, quietly, this curriculum's version of Python's `map`/`filter`/`reduce`.
