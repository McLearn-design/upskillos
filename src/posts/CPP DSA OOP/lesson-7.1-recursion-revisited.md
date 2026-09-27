# Lesson 7.1: Recursion, Revisited Properly — With the Call Stack Visible

*Phase 7 — Trees, Recursion, and the Iterator Pattern*
*You know this from Python, but now with the call stack finally visible.*

---

## What you already know

You've written recursive Python functions before — a function that calls itself, with some base case that stops the recursion. That concept hasn't changed at all. What's new is that you now know, from Lesson 1.1, *exactly* what's physically happening every time a recursive call happens: a new stack frame gets pushed, holding that call's local variables, and it gets popped the instant that specific call returns. Recursion was always "the call stack, visible" — Python just never made you look at it. This lesson makes you look.

## A simple recursive function, traced frame by frame

```cpp
int factorial(int n) {
    if (n <= 1) {
        return 1;   // base case
    }
    return n * factorial(n - 1);   // recursive case
}
```

Call `factorial(4)`. Here's what the call stack (Lesson 1.1's exact mechanism) actually looks like at its deepest point, before anything starts returning:

```
┌─────────────────────┐
│ factorial(1) n=1      │  <- top of stack, about to return 1
├─────────────────────┤
│ factorial(2) n=2      │  <- waiting for factorial(1) to return
├─────────────────────┤
│ factorial(3) n=3      │  <- waiting for factorial(2) to return
├─────────────────────┤
│ factorial(4) n=4      │  <- waiting for factorial(3) to return
├─────────────────────┤
│ main()                │
└─────────────────────┘
```

Every single one of these frames is real, physical memory on the stack — four separate copies of the local variable `n`, one per frame, each with its own address (exactly the way Lesson 1.1's `showAddress` example proved stack frames are real). `factorial(1)` returns first, popping off the top; its return value (`1`) is used by `factorial(2)`'s still-waiting frame to compute `2 * 1 = 2`; *that* frame then returns and pops, and so on, unwinding back down to `main()`. This unwinding sequence — last one pushed, first one popped — is exactly the LIFO discipline from Lesson 6.1's stack, and it's not a metaphor here: the actual call stack genuinely *is* a stack, in the precise data-structure sense.

## Confirming this is real, not just a diagram

```cpp
#include <iostream>

int factorial(int n) {
    std::cout << "entering factorial(" << n << "), &n = " << &n << std::endl;
    int result;
    if (n <= 1) {
        result = 1;
    } else {
        result = n * factorial(n - 1);
    }
    std::cout << "leaving factorial(" << n << ")" << std::endl;
    return result;
}
```

Run this with `factorial(4)` and read the output closely. You'll see four "entering" lines print, in order (4, 3, 2, 1), each with a different address for `n` — direct, printed proof of four separate stack frames genuinely coexisting. Then you'll see four "leaving" lines print in the **reverse** order (1, 2, 3, 4) — direct, printed proof of the LIFO unwinding.

## Why every recursive function needs a base case — revisited with real consequences

You already know, conceptually, that a recursive function without a base case runs forever. Lesson 1.1 showed you the *actual* failure mode directly:

```cpp
void recurseForever(int depth) {
    std::cout << depth << std::endl;
    recurseForever(depth + 1);   // no base case
}
```

This isn't an abstract "infinite loop" the way Python's `RecursionError` politely, safely catches it (a counted safety net, checked by the interpreter). In C++, every call genuinely pushes a real stack frame onto a real, physically finite region of memory — and Lesson 1.1's stack overflow, the actual hardware limit being exhausted, is what stops this, not a graceful check. Revisit that lesson's exercise now with the deeper understanding this lesson has added: you're not just "running out of some abstract limit" — you are, node by node, filling up a real, finite piece of RAM with real stack frames, and the crash is what happens when there's none left.

## Recursion and Phase 5's linked structures — why this phase comes right after that one

Recursion turns out to be a remarkably natural fit for traversing structures that are themselves built recursively — and a linked list, looked at the right way, *is* a recursive structure: **a list is either empty, or it's one node followed by a (smaller) list.** This definition translates almost directly into code:

```cpp
void printRecursive(Node* node) {
    if (node == nullptr) {
        return;   // base case: an empty list has nothing to print
    }
    std::cout << node->value << " ";
    printRecursive(node->next);   // recursive case: print the REST of the list
}
```

Compare this against Lesson 5.1's `printAll()`, which used an explicit `while` loop. Both traverse the identical list, in the identical order, producing identical output — but this version has no loop variable at all; the call stack itself *is* doing the iteration, one stack frame per node. This connection — the same traversal expressed as an explicit loop versus as recursion, over the exact same data — is precisely what Lesson 7.3 is about to formalize and compare directly, once you have a tree (not just a list) to traverse both ways.

## Try it yourself

**1. Run the instrumented `factorial` above and confirm the entering/leaving order and the differing addresses**, exactly as described. Predict the full output, line by line, before running it.

**2. Write a recursive `sum(Node* node)` function that adds up every value in a linked list**, using the same "base case: empty list returns 0; recursive case: this node's value plus the sum of the rest" shape as `printRecursive` above. Confirm it matches an iterative version's result on the same list.

**3. Deliberately build a very long linked list (say, 200,000 nodes) and call a recursive `sum()` or `printRecursive()` on it.** On many systems, this will crash with a stack overflow — direct, felt proof that recursion has a real, finite depth limit tied to the stack's fixed size (Lesson 1.1's table), something the *iterative* `while`-loop version of the same traversal never runs into, since a loop reuses the exact same stack frame on every iteration instead of pushing a new one. This is a genuinely important, practical takeaway: recursion is elegant, but it is not free, and "how deep could this recursion realistically go" is a real design question, not a theoretical one.

**4. Trace, on paper, what `factorial(-1)` would do with the `factorial` function defined at the top of this lesson.** (It never terminates in the intended way — `n <= 1` is true immediately, so this particular function is actually safe for negative input by accident, terminating instantly. Now imagine a *different* base case, like `n == 0` specifically, and trace what `factorial(-1)` would do under that version instead — a good exercise in noticing how fragile a base case's exact condition can be.)

## What this cost / bought us

| | Iterative (`while`/`for`) | Recursive |
|---|---|---|
| Uses the call stack | Minimally — one frame, reused | Heavily — one new frame per call, genuinely |
| Maximum depth | Limited only by your loop's own logic | Limited by the stack's fixed size (Lesson 1.1) — a real, finite ceiling |
| Code shape for naturally recursive structures (lists, and soon, trees) | Can require explicit bookkeeping (Phase 7.3 will show this directly for trees) | Often mirrors the structure's own recursive definition almost exactly |
| Risk | Off-by-one errors in loop bounds | Stack overflow on unexpectedly deep input; easy to forget a base case entirely |

This lesson didn't teach you a new concept — it gave the concept you already had (from Python) a physical, felt mechanism underneath it, using exactly the stack-frame model Lesson 1.1 built four phases ago. Everything from here forward in Phase 7 — tree traversal, especially — leans on this mechanism directly and repeatedly.

---

**Next up: Lesson 7.2 — Binary trees, traversal.** Your first genuinely hierarchical structure — each node points to *two* children instead of one `next`, and recursion (just covered) turns out to be almost exactly the natural language for walking one.
