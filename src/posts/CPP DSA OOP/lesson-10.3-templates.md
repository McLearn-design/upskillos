# Lesson 10.3: Function Templates & Class Templates

*Phase 10 — Sorting, Searching, and Generic Programming*
*"How do I write `MyVector` once and have it work for any type?" — the C++ answer to something Python gives you for free.*

---

## A debt this curriculum has been carrying since Phase 2

Every `MyVector`, every `TreeNode`, every `HashMap` built across this entire curriculum has been hardcoded to `int`. Want a `MyVector` of `std::string`? You'd have to copy the entire class, rename it, and replace every `int` with `std::string` by hand — genuine, exact duplication, the precise thing good engineering tries to avoid. Python never had this problem: `[1, 2, 3]` and `["a", "b", "c"]` are both just `list`s, because Python's dynamic typing (Lesson 0.2) never asked what a container holds until runtime. C++'s static typing bought real benefits throughout this curriculum — but this is the bill for it, and templates are how it gets paid.

## Function templates — the simplest case

```cpp
int maxValue(int a, int b) {
    return (a > b) ? a : b;
}

double maxValue(double a, double b) {   // a SEPARATE function, hand-duplicated, just to support double
    return (a > b) ? a : b;
}
```

A **function template** writes this once, for any type that supports `>`:

```cpp
template <typename T>
T maxValue(T a, T b) {
    return (a > b) ? a : b;
}
```

`template <typename T>` declares `T` as a **type parameter** — a placeholder the compiler fills in based on how the function is called:

```cpp
std::cout << maxValue(3, 7) << std::endl;           // T deduced as int
std::cout << maxValue(3.5, 2.1) << std::endl;         // T deduced as double
std::cout << maxValue(std::string("cat"), std::string("dog")) << std::endl;   // T deduced as std::string
```

No overload written for each type — the compiler deduces `T` from the arguments and generates the appropriate version automatically. This is called **template instantiation**, and it happens at **compile time**, not runtime — a direct, important contrast with Python's dynamic typing (Lesson 0.2), worth stating precisely: Python's `max(a, b)` works for any type because the *interpreter* checks at runtime whether `>` is supported; C++'s `maxValue<T>` works for any type because the *compiler* generates a distinct, fully concrete, statically-typed function for every `T` it's actually instantiated with, before the program ever runs. Call `maxValue` with `int` and `std::string` in the same program, and the compiler silently produces two genuinely separate functions behind the scenes — `maxValue<int>` and `maxValue<std::string>` — each as fast and as strictly typed as if you'd hand-written it yourself. **This is the concrete meaning of "zero-cost abstraction," a phrase you'll hear constantly in C++ circles: genericity here costs nothing at runtime, because the generality is fully resolved before runtime even begins.**

## The compile-time requirement, made visible

```cpp
struct Point { int x, y; };

Point p1{1, 2}, p2{3, 4};
maxValue(p1, p2);   // COMPILE ERROR — Point doesn't support operator>
```

This fails to compile, not to run — the compiler tries to instantiate `maxValue<Point>`, hits `a > b` inside the template body, and discovers `Point` has no `operator>` defined, refusing to generate code that couldn't possibly work. This is Lesson 0.1's entire "the compiler catches this before the program runs" theme, now applying to generic code specifically — a genuinely different failure mode from Python, where calling `max(p1, p2)` on two objects without `>` support would fail at the exact moment that line executes, not before.

## Class templates — the actual fix for `MyVector`

```cpp
template <typename T>
class MyVector {
private:
    T* data;
    int size;
    int capacity;

public:
    MyVector() : data(nullptr), size(0), capacity(0) {}

    ~MyVector() {
        delete[] data;
    }

    MyVector(const MyVector& other) {   // copy constructor, Lesson 2.7, unchanged in structure
        size = other.size;
        capacity = other.capacity;
        data = new T[capacity];
        for (int i = 0; i < size; i++) {
            data[i] = other.data[i];
        }
    }

    void pushBack(const T& value) {   // note: const T&, not const int& — Lesson 0.6's reasoning generalized
        if (size == capacity) {
            int newCapacity = (capacity == 0) ? 1 : capacity * 2;
            T* newData = new T[newCapacity];
            for (int i = 0; i < size; i++) {
                newData[i] = data[i];
            }
            delete[] data;
            data = newData;
            capacity = newCapacity;
        }
        data[size] = value;
        size++;
    }

    T& operator[](int index) {
        return data[index];
    }

    int getSize() const { return size; }
};
```

**Every line of logic is exactly what Phase 2's `MyVector` already had.** Not one algorithmic idea changed — the doubling strategy (Lesson 1.6), the deep-copy constructor (Lesson 2.7), the `operator[]` overload (Phase 2's project) are all completely unmodified. The *only* change: every `int` that referred to *what the vector holds* became `T`. This is worth sitting with directly, because it's the actual point of the lesson: **templates don't require rethinking your data structures — they require recognizing which parts of an already-correct implementation were incidentally tied to one specific type, and replacing exactly those with a parameter.**

```cpp
MyVector<int> ints;
ints.pushBack(1);
ints.pushBack(2);

MyVector<std::string> strings;
strings.pushBack("hello");
strings.pushBack("world");

MyVector<Point> points;   // works too, as long as Point doesn't need operator> anywhere in MyVector's code
points.pushBack({1, 2});
```

`MyVector<int>` and `MyVector<std::string>` are, at compile time, two entirely separate, independently generated classes — exactly the same "the compiler produces a concrete version for each type actually used" mechanism as the function template above, just applied to an entire class instead of one function.

## Why `const T&` matters more here than it seemed to in Lesson 0.6

Recall Lesson 0.6's exercise noted that `const&` on a primitive type like `int` or `double` bought little — passing a copy of 4 or 8 bytes is already cheap. Now that `pushBack` takes `const T& value`, and `T` might be instantiated as `std::string`, or a large user-defined struct, or eventually some large custom type, that same parameter that seemed like overkill for `int` becomes genuinely essential for avoiding an expensive copy on every single call. This is a concrete, felt reason generic code defaults to `const T&` for parameters almost universally, even when the specific type it'll be used with, at any given call site, happens to be small — the template doesn't know, at the point it's *written*, what `T` will eventually be, so it has to assume `T` might be expensive to copy, and write defensively for that case.

## STL containers are all class templates — this was true the entire curriculum

```cpp
std::vector<int>
std::vector<std::string>
std::map<std::string, int>
std::unique_ptr<TreeNode>
```

Every angle-bracket type you've used since Lesson 1.7 has been a class template instantiation, this entire time, without the mechanism ever being named. `std::vector<int>` and `std::vector<std::string>` are two separately-generated classes, produced from one template definition, in the exact same way your `MyVector<int>` and `MyVector<std::string>` now are. This lesson didn't introduce a new capability you'll use going forward so much as it revealed the mechanism that's been running underneath nearly every piece of standard library code you've written since Phase 1.

## Try it yourself

**1. Convert your Phase 2 `MyVector` into `MyVector<T>` following the pattern above, and confirm it works correctly with `int`, `std::string`, and a small custom struct**, running the same push/copy/index tests from Phase 2's original project.

**2. Write a generic `swap` function template** — `template <typename T> void mySwap(T& a, T& b)` — and confirm it works for `int`, `double`, and `std::string` without any changes, reusing Lesson 1.3's swap logic.

**3. Deliberately instantiate `MyVector<Point>` (a type with no `operator<` or `operator>` defined) and confirm it compiles and works fine for `pushBack`/`operator[]`/`getSize`**, since none of those operations actually require comparison. Then add a hypothetical `sort()` member function to `MyVector` that would require `operator<` internally, and confirm instantiating `MyVector<Point>::sort()` specifically (not the whole class) fails to compile with a clear error — a genuinely subtle, real C++ template behavior worth discovering directly: **a class template can be instantiated even if only some of its member functions would fail to compile for a given `T`, as long as those specific members are never actually called.**

**4. Convert Lesson 10.2's `mergeSort` into a template** — `template <typename T> void mergeSort(std::vector<T>& arr, int left, int right)` — requiring only that `T` supports `<=`. Test it on `std::vector<int>` and `std::vector<std::string>` (string comparison is lexicographic, alphabetical order, by default) and confirm both sort correctly with the identical code.

## What this cost / bought us

| | Hand-duplicated per type (`MyVector`, `MyVectorString`, ...) | Templates (this lesson) |
|---|---|---|
| Code written per new type needed | An entire new class, hand-copied and edited | Zero — instantiate the existing template |
| Risk of the copies drifting out of sync (a bug fixed in one, forgotten in another) | Real, and grows with every duplicated copy | Impossible — there's only ever one definition |
| Runtime cost | None | **None** — fully resolved at compile time, genuinely zero-cost |
| Compile-time requirement | None beyond normal type-checking | `T` must support whatever operations the template body actually uses |
| Where you've been using this without knowing it | — | Every `std::vector`, `std::map`, `std::unique_ptr` since Phase 1 |

Templates are the single mechanism that retroactively explains a huge amount of what's felt like "the standard library just handles this" throughout the entire curriculum. `MyVector<T>` closes a debt this curriculum has quietly carried since the moment `MyVector` was first built, and every hand-built structure from Phase 2 onward — `HashMap`, `TreeNode`, `LinkedList` — could now be templatized using this exact same pattern, if you wanted the practice.

---

**Next up: Lesson 10.4 — Lambdas & custom comparators.** Sort your structures by any field, plugged in as a function — a direct combination of this lesson's generic templates and Lesson 4's lambda material, closing the loop on both at once.
