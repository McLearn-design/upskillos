# Lesson 7.3: Recursive vs. Explicit-Stack Iterative Traversal

*Phase 7 — Trees, Recursion, and the Iterator Pattern*
*Direct proof that "recursion is just stored state."*

---

## The claim this lesson proves, not just asserts

Lesson 7.1 showed you that recursion uses the real call stack — genuine stack frames, genuine addresses, genuine LIFO unwinding. This lesson goes one step further and proves something stronger: **you can take any recursive traversal and mechanically rewrite it using an explicit stack (Lesson 6.1's `VectorStack`, or even `std::stack`) instead of the implicit call stack, and get byte-for-byte identical output.** If that's true, it means recursion was never a fundamentally different *capability* from iteration-with-an-explicit-stack — it was the same underlying mechanism, with the bookkeeping done automatically by the language instead of by you.

## Preorder, recursive (from Lesson 7.2, unchanged)

```cpp
void preorderRecursive(TreeNode* node) {
    if (node == nullptr) return;
    std::cout << node->value << " ";
    preorderRecursive(node->left.get());
    preorderRecursive(node->right.get());
}
```

## Preorder, rebuilt with an explicit stack

```cpp
#include <stack>

void preorderIterative(TreeNode* root) {
    if (root == nullptr) return;

    std::stack<TreeNode*> stack;
    stack.push(root);

    while (!stack.empty()) {
        TreeNode* current = stack.top();
        stack.pop();

        std::cout << current->value << " ";   // VISIT

        // push RIGHT first, so LEFT gets popped and processed first — LIFO order matters here
        if (current->right) stack.push(current->right.get());
        if (current->left)  stack.push(current->left.get());
    }
}
```

Run both against Lesson 7.2's tree. Both print `4 2 1 3 6 5 7` — identical.

## Why the push order (`right` before `left`) is the entire trick

This is the one genuinely non-obvious detail in this lesson, worth tracing carefully. A stack is LIFO — whatever you push *last* comes out *first*. Because you want `left` processed before `right` (matching preorder's definition), you must push `right` onto the stack *first*, so that `left` ends up on *top* and gets popped — and therefore visited — first. This single ordering detail is the explicit-stack version doing, by hand, exactly what the recursive version does automatically: the recursive version's `preorderRecursive(node->left.get())` call happens *before* its `preorderRecursive(node->right.get())` call in the source code, which means the *left* call's stack frame gets pushed onto the real call stack first and fully resolves (all its own nested calls complete) before the *right* call's frame is even created. The explicit-stack version is reproducing that exact same "left work finishes before right work starts" guarantee, just with you controlling the push order directly instead of the language controlling it via call order.

## Tracing both versions side by side, frame by frame vs. stack-entry by stack-entry

For the tiny subtree `2` (with children `1` and `3`):

**Recursive — real call stack:**
```
preorderRecursive(2) called
  prints "2"
  preorderRecursive(1) called
    prints "1"
    preorderRecursive(nullptr) called -> returns immediately (base case)
    preorderRecursive(nullptr) called -> returns immediately
  preorderRecursive(1) returns
  preorderRecursive(3) called
    prints "3"
    ...
  preorderRecursive(3) returns
preorderRecursive(2) returns
```

**Iterative — explicit `std::stack<TreeNode*>`:**
```
stack: [2]
pop 2, print "2", push 3, push 1  -> stack: [3, 1]   (1 is on TOP, will be popped next)
pop 1, print "1", (no children to push)  -> stack: [3]
pop 3, print "3", (no children to push)  -> stack: []
```

Same visiting order (`2 1 3`), reached through two genuinely different mechanisms — one using real, language-managed stack frames holding a "which node am I on, and how far through my own body have I gotten" state implicitly; the other using one explicit data structure holding exactly the nodes still waiting to be processed, tracked entirely by your own code. This is the literal, concrete meaning of "recursion is just stored state" — the call stack was storing *exactly* the information (which nodes remain to be visited, in what order) that the explicit `std::stack` above is now storing directly, in a form you can see, inspect, and manipulate yourself.

## Why you'd ever choose the harder-to-write iterative version

Given that the recursive version is shorter and arguably more readable, why bother with the iterative rewrite at all? Two real, practical reasons, both direct callbacks to earlier lessons:

1. **No stack-overflow risk from deep recursion (Lesson 7.1's exercise 3).** An explicit `std::stack` lives on the *heap* (well, more precisely — internally, `std::stack` defaults to wrapping `std::deque`, which manages heap-allocated chunks per Lesson 6.3), which can grow far larger than the fixed-size call stack before running into real memory limits. A tree so deep that recursive traversal overflows the call stack can often still be traversed iteratively, safely, because you're no longer bound by the call stack's specific fixed size.
2. **Pausable, resumable traversal.** The iterative version's entire state — "what's left to visit" — lives in one visible variable (`stack`) that you can inspect, save, or even pause and resume across multiple separate function calls. A recursive traversal's state is smeared invisibly across the real call stack, which you cannot pause, inspect field-by-field, or serialize at all. This distinction becomes directly relevant in Phase 7's Iterator pattern lesson, arriving shortly, which needs *exactly* this pausable/resumable property to work at all.

## Try it yourself

**1. Build both `preorderRecursive` and `preorderIterative`, run both against Lesson 7.2's tree, and confirm identical output**, character for character.

**2. Deliberately push `left` before `right`** (swapping this lesson's crucial ordering detail) and rerun — confirm the output changes and no longer matches the recursive version. This is worth doing specifically so the "why the order matters" explanation above isn't just something you read, but something you broke and watched break.

**3. Rewrite `inorder` (Lesson 7.2) using an explicit stack.** This one is genuinely trickier than preorder, because you can't just "visit on pop" — you need to walk all the way down the left spine first, pushing nodes as you go, and only print a node once you've fully exhausted its left subtree. (Hint: use a `while (current != nullptr || !stack.empty())` outer loop, with an inner `while (current != nullptr) { stack.push(current); current = current->left.get(); }` to walk left before ever popping.) This is a meaningfully harder exercise than preorder's translation — budget real time for it, and don't be discouraged if it takes a few attempts to get exactly right.

**4. Build a very deep, lopsided tree (each node has only a left child, several hundred thousand levels deep — essentially a linked list wearing tree syntax) and confirm the recursive traversal overflows the stack (matching Lesson 7.1's exercise) while the iterative version handles it without crashing.** Direct, measured proof of reason #1 above.

## What this cost / bought us

| | Recursive | Iterative (explicit stack) |
|---|---|---|
| Where "what's left to do" is stored | The real call stack, implicitly, via stack frames | One explicit `std::stack` variable, visible and inspectable |
| Maximum safe depth | Bounded by the call stack's fixed size (Lesson 1.1) | Bounded only by available heap memory — usually much larger |
| Code length/readability | Usually shorter, closer to the structure's natural recursive definition | Usually longer, requires manually replicating the ordering the language handles automatically |
| Pausable/resumable | No | Yes — genuinely important for Iterator pattern (next major topic) |

This lesson's real payoff isn't the specific preorder rewrite — it's the general principle now proven, not just claimed: **recursion and explicit-stack iteration are two views of the same underlying mechanism.** Anywhere you see deep recursion in real code that worries you (stack-overflow risk, or a need to pause partway through), this lesson is the direct playbook for converting it into an equally correct, more controllable iterative form.

---

**Next up: Lesson 7.4 — Binary search trees: insert/search/delete.** Time to give tree structure actual *meaning* — Lesson 7.2's inorder-traversal observation (sorted output) stops being a coincidence and becomes the entire point.
