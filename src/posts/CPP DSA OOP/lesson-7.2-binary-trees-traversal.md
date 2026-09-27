# Lesson 7.2: Binary Trees, Traversal

*Phase 7 — Trees, Recursion, and the Iterator Pattern*

---

## From one child to two

Every linked structure in Phase 5 had a node pointing to at most one "next." A **binary tree** relaxes that to *two* — each node can have a **left child** and a **right child**, each of which is itself the root of its own smaller tree. This is a genuinely recursive definition, and it's worth stating explicitly, the same way Lesson 7.1 stated one for linked lists: **a binary tree is either empty, or it's a node with a left subtree and a right subtree, each of which is itself a binary tree.**

```cpp
class TreeNode {
public:
    int value;
    std::unique_ptr<TreeNode> left;    // Lesson 5.2's ownership model, extended to two children
    std::unique_ptr<TreeNode> right;

    TreeNode(int v) : value(v), left(nullptr), right(nullptr) {}
};
```

`unique_ptr` for both children, exactly the reasoning from Lesson 5.2: a `TreeNode` owns its children; when a `TreeNode` is destroyed, its children's `unique_ptr`s are destroyed too, recursively cascading all the way down the tree, with zero destructor code written by you — the exact same automatic cleanup mechanism from Phase 5, now branching in two directions instead of one.

## A tree to traverse, for the rest of this lesson

```
        4
       / \
      2   6
     / \ / \
    1  3 5  7
```

```cpp
auto root = std::make_unique<TreeNode>(4);
root->left = std::make_unique<TreeNode>(2);
root->right = std::make_unique<TreeNode>(6);
root->left->left = std::make_unique<TreeNode>(1);
root->left->right = std::make_unique<TreeNode>(3);
root->right->left = std::make_unique<TreeNode>(5);
root->right->right = std::make_unique<TreeNode>(7);
```

## Preorder — visit the node, then left, then right

```cpp
void preorder(TreeNode* node) {
    if (node == nullptr) return;         // base case, Lesson 7.1
    std::cout << node->value << " ";     // VISIT first
    preorder(node->left.get());           // then left
    preorder(node->right.get());          // then right
}
```

For the tree above: `4 2 1 3 6 5 7`. Notice `node->left.get()` — the same `.get()` from Lesson 5.2, borrowing a raw pointer for traversal without touching ownership at all.

## Inorder — visit left, then the node, then right

```cpp
void inorder(TreeNode* node) {
    if (node == nullptr) return;
    inorder(node->left.get());
    std::cout << node->value << " ";     // VISIT in the middle
    inorder(node->right.get());
}
```

For the tree above: `1 2 3 4 5 6 7`. Look closely — that's sorted order. This isn't a coincidence for *this specific tree* — it's a direct, guaranteed consequence of a property called the **binary search tree** invariant (every left subtree holds smaller values, every right subtree holds larger ones), which this particular tree happens to satisfy and which Lesson 7.4 formalizes properly as its own topic. Filing this observation away now will make that lesson land immediately.

## Postorder — visit left, then right, then the node

```cpp
void postorder(TreeNode* node) {
    if (node == nullptr) return;
    postorder(node->left.get());
    postorder(node->right.get());
    std::cout << node->value << " ";     // VISIT last
}
```

For the tree above: `1 3 2 5 7 6 4`. Notice the root (`4`) prints *last* — every node's children are fully processed before the node itself. This ordering is exactly right for tasks like safely deleting an entire tree node-by-node (children before parent — you'd never want to delete a parent while its children still need visiting) or evaluating an expression tree bottom-up, a direct preview of this curriculum's capstone expression evaluator.

## Level-order — breadth, not depth, using Phase 6's queue

Pre/in/postorder all go *deep* first (all the way down one branch before backtracking) — this is called **depth-first traversal**. Sometimes you want the opposite: visit every node at depth 0, then every node at depth 1, then depth 2, and so on — **breadth-first traversal**. This one genuinely cannot be written as simple recursion the way the other three were; it needs Phase 6's queue, explicitly:

```cpp
#include <queue>

void levelOrder(TreeNode* root) {
    if (root == nullptr) return;

    std::queue<TreeNode*> q;   // Lesson 6.2's FIFO discipline, doing real work here
    q.push(root);

    while (!q.empty()) {
        TreeNode* current = q.front();
        q.pop();
        std::cout << current->value << " ";

        if (current->left)  q.push(current->left.get());
        if (current->right) q.push(current->right.get());
    }
}
```

For the tree above: `4 2 6 1 3 5 7` — exactly row by row, top to bottom, left to right. Trace *why* a queue (FIFO) produces this specific order, and not a stack (LIFO): each node, when visited, pushes its children onto the *back* of the queue — meaning every node at the current depth gets fully processed and has its children enqueued *before* any of those children get their turn, because the queue always serves whoever's been waiting longest. Swap the `std::queue` for a `VectorStack`-style LIFO structure instead, and you'd get a *depth-first* order instead (a valid, different traversal, but not level-order) — the choice of underlying structure genuinely determines the shape of the traversal, not just its implementation details.

## Try it yourself

**1. Build the tree above and run all four traversals, confirming each matches the sequences given in this lesson exactly.**

**2. Trace `inorder` by hand, on paper, following the recursive calls exactly the way Lesson 7.1 had you trace `factorial`'s call stack** — write down every call and every return, in order, until you're confident you could produce the `1 2 3 4 5 6 7` sequence without running any code at all.

**3. Rewrite `levelOrder` using a `VectorStack` instead of `std::queue` (swap FIFO for LIFO) and run it against the same tree.** Confirm the output is a valid depth-first-ish order but genuinely *not* level-order — direct, hands-on confirmation that the traversal's shape is a consequence of the underlying structure's discipline (FIFO vs. LIFO), not an incidental implementation detail.

**4. Count how many times each traversal function is called total, for the 7-node tree above** — add a counter, incremented once per call, including the calls that immediately hit the `nullptr` base case and return. You should get 15 total calls (7 real nodes + 8 `nullptr` base-case hits, since every one of the tree's 7 nodes has exactly 2 children slots, and 6 of those 14 child-slots point to real nodes while 8 point to `nullptr`). This is a small, concrete first taste of the kind of counting argument Phase 7's Big-O analysis of tree operations will build on properly later.

## What this cost / bought us

| Traversal | Order | Underlying structure | Typical use |
|---|---|---|---|
| Preorder | node, left, right | Recursion (implicit call stack) | Copying/serializing a tree's structure |
| Inorder | left, node, right | Recursion | Reading a binary *search* tree in sorted order (Lesson 7.4) |
| Postorder | left, right, node | Recursion | Safely deleting a tree; evaluating expression trees bottom-up |
| Level-order | breadth, row by row | Explicit queue (Lesson 6.2) | Finding the shortest path in unweighted structures; printing a tree "as it looks" |

Every one of the first three traversals is a small, direct variation on exactly the same recursive shape — the only difference is *when*, relative to the two recursive calls, you print the current node. That's worth noticing explicitly: you didn't really learn three separate algorithms, you learned one recursive pattern with three choices for where to place one line of code.

---

**Next up: Lesson 7.3 — Recursive traversal vs. explicit-stack iterative traversal.** Direct proof that "recursion is just stored state" — you're about to rewrite one of this lesson's recursive traversals using an explicit `VectorStack` instead of the call stack, and watch the two produce byte-for-byte identical output.
