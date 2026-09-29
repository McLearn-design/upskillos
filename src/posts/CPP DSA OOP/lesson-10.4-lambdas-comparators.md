# Lesson 10.4: Lambdas & Custom Comparators

*Phase 10 — Sorting, Searching, and Generic Programming*

---

## Two threads converging

This lesson combines Lesson 10.3's templates (code that doesn't care what type it operates on) with Lesson 4's lambdas (behavior passed around as a first-class value) into the single most common everyday use of both: **sorting your own data by whatever field or rule you want, decided at the call site, without touching the sort function itself.**

## The problem `operator<` alone can't solve

```cpp
struct Person {
    std::string name;
    int age;
};

std::vector<Person> people = {
    {"Bob", 25}, {"Alice", 30}, {"Carol", 22}
};

std::sort(people.begin(), people.end());   // COMPILE ERROR — Person has no operator<
```

`std::sort` needs some way to compare two elements, and by default it reaches for `operator<`. `Person` doesn't have one — and even if it did, hardcoding one specific field as "the" way to compare `Person`s would be wrong the moment you need to sort by a *different* field in some other part of the program. This is exactly the situation Lesson 4's Strategy pattern existed to solve: the comparison logic needs to be interchangeable, decided by the caller, not baked into the type.

## Fix 1: a comparator lambda, passed directly

```cpp
std::sort(people.begin(), people.end(), [](const Person& a, const Person& b) {
    return a.age < b.age;   // sort by age, ascending
});
```

`std::sort`'s three-argument overload accepts exactly this: a callable taking two elements and returning `true` if the first should come before the second. This is Lesson 4's Strategy pattern's `std::function`/lambda version, reused completely unmodified — `std::sort` itself never needed to change to support this; it was written generically from the start (Lesson 10.3's whole point) to accept *any* comparator satisfying this shape.

```cpp
// Sort by name instead — same data, same std::sort call, different lambda
std::sort(people.begin(), people.end(), [](const Person& a, const Person& b) {
    return a.name < b.name;
});

// Sort by age DESCENDING — flip the comparison
std::sort(people.begin(), people.end(), [](const Person& a, const Person& b) {
    return a.age > b.age;
});
```

Three completely different sort orders, zero changes to `Person`, zero changes to any sorting logic — only the lambda passed at the call site changes. This is the direct, practical payoff Phase 4's Strategy pattern promised in the abstract, now landing on the single most common real use case in all of everyday C++ programming.

## Applying it to your own templated sort from Lesson 10.3

```cpp
template <typename T, typename Comparator>
void mergeSort(std::vector<T>& arr, int left, int right, Comparator comp) {
    if (left >= right) return;

    int mid = left + (right - left) / 2;
    mergeSort(arr, left, mid, comp);
    mergeSort(arr, mid + 1, right, comp);
    merge(arr, left, mid, right, comp);
}

// merge itself needs the comparator too, replacing every "<=" with "comp(...)"
template <typename T, typename Comparator>
void merge(std::vector<T>& arr, int left, int mid, int right, Comparator comp) {
    std::vector<T> temp;
    int i = left, j = mid + 1;

    while (i <= mid && j <= right) {
        if (comp(arr[i], arr[j])) temp.push_back(arr[i++]);   // comp() replaces "<="
        else                        temp.push_back(arr[j++]);
    }
    while (i <= mid)   temp.push_back(arr[i++]);
    while (j <= right) temp.push_back(arr[j++]);

    for (size_t k = 0; k < temp.size(); k++) {
        arr[left + k] = temp[k];
    }
}
```

Notice `Comparator` is itself a **second template parameter** — the compiler deduces its type from whatever callable is actually passed in, exactly the way it deduced `T` from the vector's element type. This is genuinely the same mechanism from Lesson 10.3, just with two independent placeholders instead of one, working together.

```cpp
std::vector<Person> people = { /* ... */ };
mergeSort(people, 0, people.size() - 1,
    [](const Person& a, const Person& b) { return a.age < b.age; });
```

Your own hand-built merge sort from Lesson 10.2, now genuinely as flexible as `std::sort` — templated over both the element type *and* the comparison logic. This is the full synthesis this lesson has been building toward: Lesson 10.2's algorithm, Lesson 10.3's genericity, and Lesson 4's interchangeable behavior, combined into one function that handles any type, sorted by any rule, decided entirely by the caller.

## `std::function` vs. a template parameter for the comparator — a real, worth-knowing distinction

```cpp
// Version A: comparator as a template parameter (what's used above)
template <typename T, typename Comparator>
void mergeSortA(std::vector<T>& arr, Comparator comp);

// Version B: comparator as std::function
template <typename T>
void mergeSortB(std::vector<T>& arr, std::function<bool(const T&, const T&)> comp);
```

Both work, both are common in real code, but they're not identical, and the difference connects directly back to this lesson's opening theme. **Version A** (template parameter) lets the compiler generate a fully specialized version of `mergeSortA` for each distinct comparator it's called with — a lambda passed this way can often be fully inlined, genuinely zero runtime overhead, exactly Lesson 10.3's "zero-cost abstraction" claim, extended to comparators. **Version B** (`std::function`) incurs `std::function`'s own small internal overhead (a type-erased wrapper, capable of holding *any* callable matching the signature, decided at runtime) — more flexible in some situations (you can store a `std::function` in a variable, reassign it, put it in a container of mixed callables), but not quite as fast in the hottest of hot loops. This is a genuinely real, measurable engineering choice, not a stylistic preference — Version A when you want maximum speed and the comparator is known at each call site; Version B when you need genuine runtime flexibility (deciding which comparator to use based on user input, say).

## `std::sort` with a member as the comparator, and a subtlety worth knowing

```cpp
std::sort(people.begin(), people.end(),
    [](const Person& a, const Person& b) { return a.age < b.age; });
```

A genuinely common, subtle bug: writing `<=` instead of `<` inside the comparator.

```cpp
// BROKEN comparator — uses <=
[](const Person& a, const Person& b) { return a.age <= b.age; }
```

`std::sort` requires a **strict weak ordering** — the comparator must return `false` when comparing an element to itself (`comp(a, a)` must always be `false`). `<=` violates this (`comp(a, a)` returns `true`, since anything is `<=` itself), and using it can cause `std::sort` to behave unpredictably — not necessarily crash, but potentially produce a genuinely incorrect, non-fully-sorted result, or in some implementations, undefined behavior. This is a real, easy mistake, worth explicitly testing for rather than trusting your intuition about "well, `<=` seems like it should be *more* correct than `<`."

## Try it yourself

**1. Sort the `people` vector three different ways (by age ascending, by name alphabetically, by age descending) using three different lambdas passed to `std::sort`, and print the results of each to confirm correctness.**

**2. Build the templated `mergeSort`/`merge` pair above, and sort both a `std::vector<int>` (with a simple `<` lambda) and a `std::vector<Person>` (by whichever field you choose) using the identical function.**

**3. Deliberately introduce the `<=` bug into a comparator and run it against `std::sort` on a moderately large dataset (a few thousand elements).** Check whether the output is actually, fully sorted (write a small `isSorted` verification function) — you may or may not observe an obviously broken result depending on your specific standard library implementation, which is itself the point: this bug's consequences are implementation-defined and inconsistent, exactly the kind of subtle, hard-to-diagnose issue that "looks like it should work" bugs tend to produce.

**4. Benchmark Version A (template parameter) against Version B (`std::function`) for your own `mergeSort`, sorting a large dataset many times in a tight loop**, using the `<chrono>` technique from Phase 3. Confirm whether a measurable difference actually shows up on your system and compiler — real-world results vary, and confirming this yourself, rather than trusting the claim blindly, is squarely in this curriculum's spirit.

## What this cost / bought us

| | Hardcoded `operator<` on the type itself | Comparator lambda passed at the call site |
|---|---|---|
| Number of sort orders supported | One, permanently, baked into the type | Unlimited — a new lambda per call site |
| Changing sort order later | Requires editing the type's own definition | Requires nothing — just pass a different lambda |
| Fits which earlier pattern | — | Lesson 4's Strategy pattern, directly |
| Runtime cost (template parameter version) | N/A | **None** — fully resolved at compile time |
| Runtime cost (`std::function` version) | N/A | Small, real overhead — genuine flexibility/speed tradeoff |

This lesson is, deliberately, not new material so much as a fusion of three things you already own — templates, lambdas, and the Strategy pattern's underlying idea — landing on the exact tool you'll reach for constantly in real C++ code from here forward: `std::sort(container.begin(), container.end(), [](...) {...})` is very likely the single most common non-trivial line you'll write in everyday professional C++.

---

**Design pattern: Template Method vs. a generic templated function.** Same "define the skeleton, plug in the steps" idea as this lesson's comparator-based sorting, shown from a different angle — closing out Phase 10.
