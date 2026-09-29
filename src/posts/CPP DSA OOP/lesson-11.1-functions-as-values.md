# Lesson 11.1: Functions as Values, Function Pointers, `std::function`

*Phase 11 — Functional-Style C++*
*A deliberate perspective shift after roughly twenty weeks of object-thinking.*

---

## A shift, not new material

Every idea in this lesson has already appeared, scattered across earlier phases — Lesson 4's Strategy pattern, Lesson 6's Command pattern, Lesson 10.4's comparators. This phase gathers the functional side of C++ into one deliberate, focused perspective: instead of asking "what object should own this behavior," ask "can this behavior just be a value, passed around like any other?" It's the same underlying capability, examined directly rather than as a supporting detail inside an OOP-framed pattern.

## Function pointers — the raw mechanism

A function, once compiled, lives at some address in memory, exactly like any other piece of data (Lesson 1.2's core claim, extended). A **function pointer** stores that address:

```cpp
int add(int a, int b) { return a + b; }
int subtract(int a, int b) { return a - b; }

int main() {
    int (*operation)(int, int);   // a pointer to a function taking (int, int), returning int

    operation = add;
    std::cout << operation(3, 4) << std::endl;   // 7

    operation = subtract;
    std::cout << operation(3, 4) << std::endl;   // -1

    return 0;
}
```

`int (*operation)(int, int);` reads, admittedly awkwardly, as "`operation` is a pointer to a function taking two `int`s and returning `int`." Once declared, `operation` can be reassigned to point at any function matching that exact signature, and calling `operation(3, 4)` calls whichever function it currently points to — the same underlying mechanism as `virtual` dispatch's vtable lookup (Lesson 4.2), except here you're managing the indirection explicitly and by hand rather than the compiler generating it automatically per object.

## Why `std::function` mostly replaced raw function pointers

Function pointers have a real, structural limitation: they can only point at plain functions, not at lambdas with captures (Lesson 4's capture lists) or at member functions bound to a specific object. `std::function`, introduced properly in Lesson 4's Strategy comparison, is the general-purpose replacement:

```cpp
#include <functional>

std::function<int(int, int)> operation;

operation = add;                                    // a plain function — works
operation = [](int a, int b) { return a * b; };      // a lambda — works
int threshold = 10;
operation = [threshold](int a, int b) { return a + b + threshold; };   // a CAPTURING lambda — works,
                                                                          // and this is exactly what a
                                                                          // raw function pointer CANNOT do
```

`std::function<int(int, int)>` reads as "any callable taking two `int`s and returning `int`" — genuinely any callable, not just plain functions. This generality has a real cost, worth restating precisely from Lesson 10.4: `std::function` typically involves a small heap allocation and a layer of indirection (**type erasure** — the mechanism that lets it hold genuinely different concrete callable types behind one uniform interface, a real, non-trivial piece of engineering worth appreciating even without implementing it yourself), while a raw function pointer is just one machine word, as fast as any other pointer.

## Passing functions as parameters — three ways, compared directly

```cpp
// Way 1: raw function pointer parameter
void apply1(int (*fn)(int), int value) {
    std::cout << fn(value) << std::endl;
}

// Way 2: std::function parameter
void apply2(std::function<int(int)> fn, int value) {
    std::cout << fn(value) << std::endl;
}

// Way 3: template parameter — Lesson 10.3's mechanism, applied here
template <typename Func>
void apply3(Func fn, int value) {
    std::cout << fn(value) << std::endl;
}
```

```cpp
int square(int x) { return x * x; }

apply1(square, 5);                                    // works — plain function fits a function pointer
apply2(square, 5);                                    // works — std::function accepts a plain function too
apply3(square, 5);                                    // works

int multiplier = 3;
// apply1([multiplier](int x) { return x * multiplier; }, 5);   // COMPILE ERROR — a capturing lambda
                                                                    // cannot decay to a raw function pointer
apply2([multiplier](int x) { return x * multiplier; }, 5);       // works — std::function handles captures
apply3([multiplier](int x) { return x * multiplier; }, 5);       // works — and with ZERO runtime overhead,
                                                                    // Lesson 10.3's "zero-cost" claim again
```

This table of behavior is worth internalizing directly: **Way 1 is the least flexible but fastest and simplest; Way 2 is the most flexible but has real, measurable overhead; Way 3 gets both flexibility and speed, at the cost of the function needing to be a template** (meaning its implementation must be visible wherever it's used — Lesson 10.3's compile-time-instantiation requirement, applying here too). This is the identical Version-A-versus-Version-B distinction Lesson 10.4 drew for comparators, now generalized to functions-as-parameters broadly, because it's genuinely the same underlying tradeoff appearing again.

## A function returning a function

```cpp
std::function<int(int)> makeMultiplier(int factor) {
    return [factor](int x) {   // this lambda CAPTURES factor and OUTLIVES makeMultiplier's own call
        return x * factor;
    };
}

int main() {
    auto triple = makeMultiplier(3);
    auto double_ = makeMultiplier(2);

    std::cout << triple(5) << std::endl;    // 15
    std::cout << double_(5) << std::endl;    // 10

    return 0;
}
```

This is worth tracing carefully against Lesson 1.1's stack-frame model. `factor` is a parameter to `makeMultiplier` — an ordinary stack variable that would normally vanish the instant `makeMultiplier` returns (exactly Lesson 1.1's automatic stack cleanup). But the lambda *captures* `factor` **by value** (no `&`), meaning a genuine copy of `factor`'s value is stored *inside* the lambda object itself, which is what actually gets returned and lives on independently, in the caller's own scope, entirely disconnected from `makeMultiplier`'s now-long-gone stack frame. This is a direct, concrete answer to a question this curriculum first raised back in Lesson 1.1: *can a piece of data outlive the function call that created it, without living on the heap explicitly?* Yes — by being copied into an object (here, a lambda's closure) that itself gets returned and kept alive by whatever holds onto it afterward, exactly the same "the data's lifetime is now tied to the object holding it" logic that's underpinned every RAII class since Lesson 2.5.

**A genuine, sharp warning worth stating directly:** capturing **by reference** (`[&factor]`) in a lambda that outlives the scope where `factor` was declared creates a **dangling reference** — the returned lambda would hold a reference to stack memory that's already been reclaimed, undefined behavior the instant it's called, precisely Lesson 1.1's "returning a pointer to a local variable" mistake, wearing a lambda's clothing. This is a real, easy mistake in exactly this "function returns a function" pattern — capture by value whenever the lambda needs to outlive its creating scope, and only capture by reference when you're certain the referenced variable will still be alive for the entire time the lambda might be called.

## Try it yourself

**1. Build the three `apply` functions and confirm the exact compile-success/compile-failure pattern described above** — specifically, confirm `apply1` genuinely fails to compile with a capturing lambda, while `apply2` and `apply3` succeed.

**2. Build `makeMultiplier` and confirm `triple` and `double_` behave independently and correctly**, each remembering its own captured `factor` value correctly, even though both were created by the same function.

**3. Deliberately create the dangling-reference bug** — write a version of `makeMultiplier` that captures `factor` by reference (`[&factor]`) instead of by value, and observe (or reason through, if your compiler/system doesn't crash predictably) that the returned lambda is now broken, referencing stack memory that no longer exists.

**4. Measure the real performance difference between all three `apply` versions**, calling each a very large number of times in a tight loop with the same simple lambda, using the `<chrono>` technique from Phase 3. Confirm whether `apply3`'s template version genuinely outperforms `apply2`'s `std::function` version on your system and compiler.

## What this cost / bought us

| | Function pointer | `std::function` | Template parameter |
|---|---|---|---|
| Can hold a capturing lambda | No | Yes | Yes |
| Runtime overhead | None | Small, real (type erasure) | **None** — resolved at compile time |
| Requires the function itself to be a template | No | No | Yes |
| Can be stored in a variable, reassigned, put in a container of mixed callables | Only other function pointers | Yes, genuinely flexible | No — the type is fixed once instantiated |

This lesson is the direct, close-up view of a mechanism this curriculum has been using since Phase 4 without stopping to name every piece of it precisely. From here, the rest of Phase 11 builds on this same foundation: `std::optional` and `std::variant` next, as safer alternatives to patterns you've been improvising with raw pointers and unions since early in the curriculum.

---

**Next up: Lesson 11.2 — `std::optional`, `std::variant`.** A taste of Python's flexible typing, done safely — genuine, type-checked alternatives to `nullptr`-as-a-signal and to the manual "which type is this really" bookkeeping every `union`-based trick has always required.
