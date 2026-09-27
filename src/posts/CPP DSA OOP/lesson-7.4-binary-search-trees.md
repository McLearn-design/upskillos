# Lesson 7.4: Binary Search Trees — Insert/Search/Delete

*Phase 7 — Trees, Recursion, and the Iterator Pattern*

---

## Giving the tree a rule

Lesson 7.2's tree was arbitrary — nodes placed wherever, with no relationship enforced between a node's value and its children's values. A **binary search tree (BST)** adds exactly one invariant, applied at every single node: **everything in the left subtree is smaller than this node; everything in the right subtree is larger.** This one rule, maintained consistently, is what made Lesson 7.2's inorder traversal come out sorted — not a coincidence, as promised, but the direct, guaranteed consequence of this invariant holding everywhere in the tree.

## Search — using the invariant to skip half the tree at every step

```cpp
bool search(TreeNode* node, int target) {
    if (node == nullptr) return false;          // not found — fell off the tree
    if (node->value == target) return true;      // found it
    if (target < node->value) {
        return search(node->left.get(), target);   // only bother checking the LEFT subtree
    } else {
        return search(node->right.get(), target);  // only bother checking the RIGHT subtree
    }
}
```

This is the entire payoff of the BST invariant. At every node, one comparison tells you which *entire subtree* to ignore completely — you never need to check the subtree that can't possibly contain the target, because the invariant guarantees it doesn't. Compare this directly against Lesson 5.4's linked-list search, which had no such shortcut and had to check every node, one by one, O(n). A BST search, done right, only ever visits one path from root to (at most) a leaf — its cost is proportional to the tree's *height*, not its total size.

## Insert — find where the value belongs, using the same logic as search

```cpp
void insert(std::unique_ptr<TreeNode>& node, int value) {
    if (node == nullptr) {
        node = std::make_unique<TreeNode>(value);   // found the empty spot — place it here
        return;
    }
    if (value < node->value) {
        insert(node->left, value);
    } else if (value > node->value) {
        insert(node->right, value);
    }
    // if value == node->value, do nothing — this BST doesn't allow duplicates
}
```

Notice the parameter: `std::unique_ptr<TreeNode>& node` — a *reference to a unique_ptr*, not a raw pointer. This matters, and it's directly analogous to Lesson 1.6's `int*&` double-indirection requirement: `insert` needs to be able to actually *create* a new node and attach it into the tree at exactly the right spot — which means it needs the ability to modify the caller's actual `unique_ptr` (whichever one turns out to be `nullptr` at the insertion point), not just read a copy of it. `node = std::make_unique<TreeNode>(value);` reaches all the way back through the chain of references to the exact `unique_ptr` field (some node's `left` or `right`, or the tree's own `root`) that needs to start owning the new node.

## Delete — the genuinely tricky one

Removing a leaf node (no children) is easy — just clear the parent's pointer to it, and `unique_ptr`'s automatic destruction handles the rest (Lesson 5.2's mechanism). Removing a node with one child is also fairly easy — replace the node with its one child. The hard case: **removing a node with two children.** You can't just delete it and leave a gap — something has to take its place, and that replacement must preserve the BST invariant for the *entire* remaining tree.

```cpp
TreeNode* findMin(TreeNode* node) {
    while (node->left != nullptr) {
        node = node->left.get();   // keep going left — the minimum is always the leftmost node
    }
    return node;
}

void remove(std::unique_ptr<TreeNode>& node, int value) {
    if (node == nullptr) return;   // value not found — nothing to do

    if (value < node->value) {
        remove(node->left, value);
    } else if (value > node->value) {
        remove(node->right, value);
    } else {
        // FOUND the node to remove
        if (node->left == nullptr) {
            node = std::move(node->right);    // 0 or 1 child (right side) — promote it directly
        } else if (node->right == nullptr) {
            node = std::move(node->left);      // 1 child (left side) — promote it directly
        } else {
            // TWO children — the hard case
            TreeNode* successor = findMin(node->right.get());   // smallest value in the RIGHT subtree
            node->value = successor->value;                       // copy that value into this node
            remove(node->right, successor->value);                 // then remove the DUPLICATE from the right subtree
        }
    }
}
```

Trace the two-children case carefully — this is the heart of the lesson. The node's own value is being *removed*, but instead of trying to physically detach a node with two subtrees hanging off it (a genuinely awkward relinking problem), the code finds the **inorder successor** — the smallest value in the right subtree, found by walking as far left as possible from `node->right` — and copies *that value* into the node being "deleted." The original node keeps its position in the tree, its identity unchanged; only its stored *value* changes. Then a second, simpler removal deletes the now-duplicated successor value from the right subtree, where it's guaranteed to have at most one child (a leftmost node, by definition, can have no left child at all) — reducing the hard two-children case into one of the two easy cases you already handled above.

**Why the inorder successor specifically preserves the invariant:** the successor is, by definition, the smallest value greater than the removed node's original value — every other value in the right subtree is larger than it, and every value in the left subtree is still smaller than it (since it came from the right subtree in the first place, still bigger than the entire left subtree). Placing it where the removed value used to be keeps every ordering relationship in the tree intact.

## Try it yourself

**1. Build `search`, `insert`, and `remove`, and construct a BST by inserting the sequence `5, 3, 8, 1, 4, 7, 9` one at a time.** After each insertion, run an inorder traversal (Lesson 7.2) and confirm the output is always fully sorted — direct, repeated proof the invariant holds after every single insertion, not just at the end.

**2. Search for a value that exists and one that doesn't, and count how many comparisons each search makes** (add a counter, incremented once per node visited). Confirm the count is bounded by the tree's height, not its total node count — for a 7-node tree like the one above, no search should need more than 3 comparisons.

**3. Remove a leaf, then a one-child node, then a two-child node, one at a time, running an inorder traversal after each removal to confirm the invariant still holds.** For the two-child case specifically, predict *which* value will replace the removed one (using the inorder-successor rule) before running the code, then confirm your prediction.

**4. Build a BST by inserting values in already-sorted order: `1, 2, 3, 4, 5, 6, 7`.** Run an inorder traversal to confirm it's still correct — then think carefully about what this tree's actual *shape* looks like (hint: every node only ever gets a right child; it's degenerated into something structurally identical to a linked list). This is worth sitting with, because it's the direct motivation for the very next lesson.

## What this cost / bought us

| | Unordered binary tree (Lesson 7.2) | Binary search tree (this lesson) |
|---|---|---|
| Search | O(n) — no shortcut, must check every node | O(height) — often much better than O(n) |
| Insert | Anywhere, no rule to maintain | Must find the correct spot, maintaining the invariant |
| Delete | Simple — no ordering to preserve | Genuinely tricky for two-child nodes (inorder successor) |
| Inorder traversal output | Arbitrary | **Always sorted** — a direct, guaranteed consequence of the invariant |
| Worst-case shape | N/A — no shape guarantee to violate | Can degenerate into a linked-list shape (exercise 4) — height O(n), search back to O(n) |

That last row is the honest, important catch this lesson has been building toward, made explicit now: a BST's O(height) search is only genuinely fast when the tree's height stays small relative to its size — roughly O(log n) for a well-shaped tree, but exercise 4 just showed you a real, valid BST whose height is O(n), the worst case, entirely determined by the *order* values happened to be inserted in. This is exactly the gap the next lesson exists to address.

---

**Next up: Lesson 7.5 — Balanced trees (AVL or red-black), conceptual.** Not a from-scratch build this time — just understanding *why* they exist, directly motivated by the degenerate, linked-list-shaped BST you just built by hand in this lesson's last exercise.
