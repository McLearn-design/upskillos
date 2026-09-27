# Design Pattern: Visitor — Operations Without Modifying the Tree

*Phase 7 — Trees, Recursion, and the Iterator Pattern*
*Compared against a `std::variant`-based alternative.*

---

## The problem: new operations keep meaning new tree code

Suppose your `TreeNode` structure needs to support several different operations over time: sum all values, count nodes, find the maximum, print a formatted view, serialize to JSON. The naive approach adds a new member function to `TreeNode` for every one:

```cpp
class TreeNode {
public:
    int value;
    std::unique_ptr<TreeNode> left, right;

    int sum() { /* ... */ }
    int count() { /* ... */ }
    int findMax() { /* ... */ }
    std::string toJson() { /* ... */ }
    // every new operation means editing TreeNode itself, forever, growing without bound
};
```

Every new operation touches the tree's own class definition — genuinely awkward if `TreeNode` is used across a large codebase, shared with other developers, or, worse, defined in a library you don't control at all and can't edit. The **Visitor pattern**'s idea: separate "the tree's structure" from "operations performed on it," so new operations can be added *without ever touching the tree class again*.

## Version 1: classic OOP Visitor

```cpp
class TreeNode;   // forward declaration

class Visitor {
public:
    virtual ~Visitor() {}
    virtual void visit(TreeNode& node) = 0;
};

class TreeNode {
public:
    int value;
    std::unique_ptr<TreeNode> left, right;

    TreeNode(int v) : value(v) {}

    void accept(Visitor& visitor) {   // the ONLY tree-related method TreeNode ever needs
        visitor.visit(*this);
        if (left)  left->accept(visitor);
        if (right) right->accept(visitor);
    }
};
```

`TreeNode::accept` is the entire, permanent interface `TreeNode` needs — it never changes again, no matter how many new operations get added later. Each *operation* becomes its own `Visitor` subclass:

```cpp
class SumVisitor : public Visitor {
public:
    int total = 0;
    void visit(TreeNode& node) override {
        total += node.value;
    }
};

class CountVisitor : public Visitor {
public:
    int count = 0;
    void visit(TreeNode& node) override {
        count++;
    }
};

class MaxVisitor : public Visitor {
public:
    int maxValue = std::numeric_limits<int>::min();
    void visit(TreeNode& node) override {
        if (node.value > maxValue) maxValue = node.value;
    }
};
```

```cpp
int main() {
    // ... build a tree ...

    SumVisitor sumV;
    root->accept(sumV);
    std::cout << "sum: " << sumV.total << std::endl;

    CountVisitor countV;
    root->accept(countV);
    std::cout << "count: " << countV.count << std::endl;

    return 0;
}
```

Adding `MaxVisitor` required zero changes to `TreeNode` — this is the whole point, proven directly: `TreeNode::accept` was written once, and every future operation is a brand new class implementing `Visitor`, entirely separate from the tree's own definition. Notice `accept` itself performs the traversal (preorder-shaped here, visiting the current node then recursing left and right) — the *shape* of the walk lives in `TreeNode`, while *what happens at each node* lives in whichever `Visitor` you pass in. This is a genuine, concrete instance of Lesson 4.5's "favor composition, keep responsibilities separated" thinking, applied at the level of an entire traversal rather than a single object relationship.

## Version 2: `std::variant`-based, without a `Visitor` hierarchy at all

An entirely different way to achieve the same separation, using `std::variant` (a genuine preview of Phase 11) plus `std::function` instead of a class hierarchy:

```cpp
#include <variant>
#include <functional>

struct TreeNode {
    int value;
    std::unique_ptr<TreeNode> left, right;

    TreeNode(int v) : value(v) {}
};

void traverse(TreeNode* node, const std::function<void(int)>& operation) {
    if (node == nullptr) return;
    operation(node->value);          // apply whatever operation was passed in
    traverse(node->left.get(), operation);
    traverse(node->right.get(), operation);
}
```

```cpp
int main() {
    // ... build a tree ...

    int sum = 0;
    traverse(root.get(), [&sum](int value) { sum += value; });
    std::cout << "sum: " << sum << std::endl;

    int count = 0;
    traverse(root.get(), [&count](int value) { count++; });
    std::cout << "count: " << count << std::endl;

    return 0;
}
```

This is, structurally, exactly Phase 4's Strategy pattern comparison again — the same `std::function`-plus-lambda alternative to a class hierarchy, now applied to tree operations instead of sort comparators. `traverse`'s signature never changes, no matter how many different lambdas you pass into it — the identical "operation lives outside the structure" separation Version 1 achieved, with less ceremony per operation and no need for a `Visitor` base class at all.

## Comparing the two, honestly — this should feel familiar by now

| | OOP `Visitor` hierarchy | `std::variant`/`std::function`-based |
|---|---|---|
| Adding a new operation | New class implementing `Visitor` | New lambda passed to `traverse` |
| Operation carrying multiple pieces of related state (e.g., building a whole formatted report with several running totals) | Natural — fields on the `Visitor` subclass | Requires a `struct` captured by the lambda, or several captured variables |
| `TreeNode`'s interface | `accept(Visitor&)` — fixed, permanent | No special method needed at all beyond the plain structure |
| Traversal shape flexibility | Fixed inside `accept` unless you add traversal-order variants | Fixed inside `traverse`, same constraint |
| Ceremony per new operation | A whole class | A few lines, inline |

This is, deliberately, the exact same shape of comparison as Phase 4's Strategy pattern and Phase 6's Command pattern — worth noticing directly, because it means you're not learning a fourth unrelated idea, you're recognizing the *same* underlying design tension (a family of interchangeable behaviors, decoupled from the structure they operate on) appearing for the third time in this curriculum, in a third different context.

## Try it yourself

**1. Build both versions fully, run `SumVisitor`/`CountVisitor`/`MaxVisitor` against Version 1 and the equivalent three lambdas against Version 2, on the same test tree, and confirm all six produce matching results.**

**2. Add a `ToStringVisitor` (Version 1) and an equivalent lambda-based string-building operation (Version 2)** that concatenates every node's value into a single space-separated string, in preorder. This is a genuinely good test of the "operation carrying state" row in the table — a `Visitor` subclass with a `std::string result;` field versus a lambda capturing a `std::string&` by reference.

**3. Modify `accept`/`traverse` in both versions to perform *inorder* traversal instead of preorder** (recall Lesson 7.2's ordering distinctions) and confirm every existing visitor/lambda still works correctly with the new order — direct proof that the traversal shape and the per-node operation really are cleanly separated concerns in both versions.

**4. A genuinely open design question, worth writing your own answer to: for a large, real project with many contributors, which version would you actually choose, and why?** There's a real, defensible case for either — the OOP version gives operations a clear, discoverable, extensible home (a whole class, easy to find and document); the functional version is lighter-weight and avoids an entire class hierarchy for what might genuinely just be "run this closure at every node." This mirrors, closely, the same judgment call Phase 4's Strategy lesson asked you to make, and it's worth having your own considered opinion rather than treating "it depends" as a non-answer.

## What this cost / bought us

Visitor, like Strategy and Command before it, costs nothing conceptually new — abstract classes, `virtual`, lambdas, and `std::function` were all already yours. What you've gained, across all three patterns now, is the ability to *recognize* this recurring shape immediately when it shows up in new code you read or new problems you design for: **whenever a structure needs to support operations that will grow and change over time, and you don't want every new operation to require modifying the structure itself, separate "what the structure looks like" from "what happens when you walk it."**

---

**Phase 7 is complete.** Recursion made concrete via the call stack, four traversal orders, recursion-vs-iteration proven equivalent, a full BST with search/insert/delete, balanced trees understood conceptually, heaps built on a plain array, tries built from a real dictionary file, and two more design patterns — Iterator (the payoff of every range-based for loop you've ever written) and Visitor.

**Next up: Phase 8 — Hashing.** You already trust Python's `dict` completely. Time to build one yourself, starting with Lesson 8.1 — hash functions, the mechanism underneath every hash-based structure you've used so far without asking how it actually works.
