# Design Pattern: Iterator — Giving Your BST `begin()`/`end()`

*Phase 7 — Trees, Recursion, and the Iterator Pattern*
*The payoff lesson that makes "iterators" click.*

---

## What's been true this entire curriculum, unexamined until now

Every single range-based for loop you've written since Lesson 0.5 — `for (int v : values)`, `for (const std::string& line : lines)`, `for (Shape* s : shapes)` — has worked on `std::vector`, `std::string`, arrays, and other standard containers, without you ever asking *how* the language knows how to walk through them. The answer: any type that provides `begin()` and `end()` methods returning **iterators** — objects supporting `*` (dereference, to get the current element), `++` (advance to the next element), and `!=` (compare against another iterator, typically to check "have I reached the end") — can be used in a range-based for loop and with the STL's generic algorithms (`std::sort`, `std::find`, and dozens more from `<algorithm>`). This lesson gives your BST from Lesson 7.4 exactly this capability.

## The core idea: an iterator wraps Lesson 7.3's explicit-stack traversal

Recall Lesson 7.3's proof: recursive inorder traversal and explicit-stack iterative inorder traversal produce identical output, because the explicit stack holds exactly the state the call stack was holding implicitly. A BST iterator is precisely that explicit-stack state, **packaged as an object that can pause after every single element**, handing control back to whatever's driving the loop, then resume exactly where it left off on the next `++`. This "pausable, resumable" property is exactly what Lesson 7.3 flagged as the recursive version's missing capability — this pattern is the reason that gap mattered.

```cpp
class BSTIterator {
private:
    std::stack<TreeNode*> stack;

    void pushLeftSpine(TreeNode* node) {
        while (node != nullptr) {
            stack.push(node);
            node = node->left.get();
        }
    }

public:
    BSTIterator(TreeNode* root) {
        pushLeftSpine(root);   // prime the stack: walk all the way down the leftmost path
    }

    bool hasNext() const {
        return !stack.empty();
    }

    int next() {
        TreeNode* current = stack.top();
        stack.pop();

        int value = current->value;

        if (current->right != nullptr) {
            pushLeftSpine(current->right.get());   // the NEXT smallest lives down the right subtree's left spine
        }

        return value;
    }
};
```

This is a direct, working answer to Lesson 7.3's exercise 3 (rewrite inorder using an explicit stack) — packaged into a class whose `next()` returns exactly one value per call, instead of printing everything in one uninterrupted pass. Trace `pushLeftSpine`: it's the "walk left as far as possible, pushing every node along the way" logic that inorder traversal needs — the smallest remaining value is always at the top of the stack after this call, because it's always the leftmost unvisited node.

## Try it as a plain iterator first, before wiring it into `begin()`/`end()`

```cpp
int main() {
    // ... build the BST from Lesson 7.4 ...
    BSTIterator it(root.get());
    while (it.hasNext()) {
        std::cout << it.next() << " ";
    }
    std::cout << std::endl;
    return 0;
}
```

Confirm this prints the tree's values in sorted order — identical to Lesson 7.2's recursive `inorder()` output, but now produced one value at a time, on demand, with the "what's left to visit" state held explicitly in `stack` between calls, exactly as Lesson 7.3 demonstrated is possible.

## Making it a real C++ iterator: `begin()`/`end()`, `*`, `++`, `!=`

To use range-based for loops and STL algorithms, the iterator needs to follow C++'s specific iterator *interface* — a set of operators the language and standard library expect, rather than the `hasNext()`/`next()` shape above (which is closer to how Java or Python iterators work). Here's the same underlying mechanism, wearing C++'s expected interface:

```cpp
class BST {
private:
    std::unique_ptr<TreeNode> root;

public:
    class Iterator {
    private:
        std::stack<TreeNode*> stack;

        void pushLeftSpine(TreeNode* node) {
            while (node != nullptr) {
                stack.push(node);
                node = node->left.get();
            }
        }

    public:
        Iterator(TreeNode* root) {
            pushLeftSpine(root);
        }

        int operator*() const {              // DEREFERENCE — "give me the current value"
            return stack.top()->value;
        }

        Iterator& operator++() {               // ADVANCE — "move to the next value"
            TreeNode* current = stack.top();
            stack.pop();
            if (current->right != nullptr) {
                pushLeftSpine(current->right.get());
            }
            return *this;
        }

        bool operator!=(const Iterator& other) const {   // COMPARE — used to detect "reached the end"
            return !stack.empty();   // simplification: only really meaningful compared against end()
        }
    };

    Iterator begin() {
        return Iterator(root.get());
    }

    Iterator end() {
        return Iterator(nullptr);   // an "empty" iterator — its stack starts empty, matching a finished traversal
    }
};
```

Every method here is operator overloading (Lesson 2.7's mechanism, first met there for `operator=`) applied to entirely new operators: `operator*` for dereferencing, `operator++` for advancing, `operator!=` for comparison. This is the *exact* interface `std::vector`'s own iterators implement — you've been using this interface all along without seeing its definition; now you've written one yourself.

## The payoff

```cpp
int main() {
    BST tree;
    tree.insert(5);
    tree.insert(3);
    tree.insert(8);
    tree.insert(1);
    tree.insert(4);

    for (int value : tree) {   // RANGE-BASED FOR LOOP — on YOUR OWN TREE
        std::cout << value << " ";
    }
    std::cout << std::endl;

    return 0;
}
```

`for (int value : tree)` — this is genuinely, literally the same syntax as `for (int v : myVector)` from Lesson 0.5, now working on a `BST`. Under the hood, the compiler expands this into something conceptually equivalent to:

```cpp
for (auto it = tree.begin(); it != tree.end(); ++it) {
    int value = *it;
    std::cout << value << " ";
}
```

— exactly the `operator*`/`operator++`/`operator!=` triad your `Iterator` class defines. This is what a range-based for loop has *always* secretly expanded into, for every container you've ever looped over in this entire curriculum, made visible for the first time now that you've built the machinery it depends on yourself.

## STL algorithms now work on your tree too

```cpp
#include <algorithm>

BST tree;
// ... insert values ...

auto it = std::find(tree.begin(), tree.end(), 4);   // std::find works on ANY type with begin()/end()!
if (it != tree.end()) {
    std::cout << "found 4" << std::endl;
}

int count = std::count_if(tree.begin(), tree.end(), [](int v) { return v > 3; });
std::cout << "values greater than 3: " << count << std::endl;
```

`std::find` and `std::count_if` (from `<algorithm>`, a genuine preview of Phase 11's "STL algorithms" material) were never written with your specific `BST` class in mind — they're written generically, against *any* type providing the iterator interface, and now that your `BST` provides it, these functions work correctly on it with zero modification. This is the concrete payoff of the entire pattern: implement one small, well-defined interface, and your custom type gets to participate in the standard library's entire generic-algorithm ecosystem for free.

## Try it yourself

**1. Build the full `BST` class with its nested `Iterator`, insert a handful of values, and confirm the range-based for loop produces correctly sorted output.**

**2. Run `std::find` and `std::count_if` against your tree exactly as shown above, and confirm both produce correct results** — direct, hands-on proof the generic-algorithm claim is real, not asserted.

**3. Add a print statement inside `operator++` and step through a range-based for loop manually with a debugger, or just trace the printed output — confirm each call to `operator++` correctly resumes exactly where the previous call left off**, rather than restarting the traversal each time. This is the "pausable, resumable" property from this lesson's opening, made concrete.

**4. Try using your `BST`'s iterator with `std::vector<int> sorted(tree.begin(), tree.end());`** — the `std::vector` range constructor, which also works generically against any iterator pair. Confirm `sorted` ends up holding the tree's values in sorted order, copied out via the exact same iterator interface.

## What this cost / bought us

| | A `printInorder()` member function | A full C++ `Iterator` (this lesson) |
|---|---|---|
| Range-based for loop support | No | Yes |
| Works with STL algorithms (`std::find`, `std::sort`, etc.) | No | Yes |
| Can pause mid-traversal and resume later | No | Yes — the whole mechanism's point |
| Implementation complexity | Simple — one recursive or looped function | More involved — a full iterator class, operator overloading |
| Underlying mechanism | Direct traversal | Lesson 7.3's explicit-stack technique, wrapped as an object |

This pattern is the direct, concrete synthesis of nearly everything this phase has built: Lesson 7.1's recursion, Lesson 7.3's "recursion is just stored state" proof, Lesson 7.4's BST, and Lesson 2.7's operator overloading, all converging into one class that makes your own data structure a full, first-class citizen of the C++ standard library's generic ecosystem — genuinely indistinguishable, from the outside, from `std::vector` or `std::set`.

---

**Next up: the Visitor pattern — walk a tree applying different operations without modifying the tree class, compared against a `std::variant`-based alternative.** Your fourth design pattern, and the last major topic before Phase 8's hashing begins.
