# Lesson 6.1: Stack — On Top of `MyVector`, Then `MyLinkedList`

*Phase 6 — Stacks, Queues, Deques*

---

## What a stack actually is

A **stack** is a data structure with exactly one rule: **last in, first out (LIFO).** You can only add to one end (the "top") and only remove from that same end. Think of a physical stack of plates — you place a new plate on top, and you can only ever take the top plate off; reaching into the middle isn't allowed. That's the entire concept. The interesting part of this lesson isn't the concept — it's that a stack isn't really a *new* data structure at all. It's a **restricted interface** wrapped around a structure you already have.

## Stack on top of `MyVector`

```cpp
class VectorStack {
private:
    MyVector vec;   // composition, Lesson 4.5 — VectorStack HAS-A MyVector

public:
    void push(int value) {
        vec.pushBack(value);   // add to the END
    }

    void pop() {
        if (vec.isEmpty()) {
            std::cerr << "pop() on empty stack!" << std::endl;
            return;
        }
        // MyVector doesn't have a popBack in Phase 2's version — add one, or
        // simulate it here by tracking size directly. For this lesson, assume
        // MyVector has been extended with a popBack() that decrements size by 1.
        vec.popBack();
    }

    int top() const {
        if (vec.isEmpty()) {
            std::cerr << "top() on empty stack!" << std::endl;
            return -1;
        }
        return vec.get(vec.getSize() - 1);
    }

    bool isEmpty() const {
        return vec.isEmpty();
    }

    int size() const {
        return vec.getSize();
    }
};
```

Notice, and this is the entire point of the lesson: `push`, `pop`, and `top` all operate on the **back** of the `MyVector`, not the front. This is deliberate and important — `pushBack` is O(1) amortized (Lesson 3.1), while inserting/removing at the *front* of a `MyVector` is O(n) (Lesson 5.4's comparison table). A stack built on the wrong end of a vector would silently be O(n) per operation instead of O(1) — the interface would still be *correct*, just needlessly slow. Choosing which end to build the "top" on is the one genuine design decision in this whole lesson, and it's a direct, deliberate application of Phase 3's complexity reasoning, not an arbitrary choice.

`VectorStack` **does not expose** `MyVector`'s full interface — no `operator[]`, no `get(i)` for an arbitrary `i`, nothing that would let outside code reach into the middle. This is Lesson 4.5's composition lesson, applied exactly as its own exercise predicted: composition here isn't just about reuse, it's about *deliberately narrowing* an interface down to only what a stack should allow.

## Stack on top of `MyLinkedList`

```cpp
class LinkedListStack {
private:
    Node* head;   // raw pointers, Lesson 5.1 style
    int count;

public:
    LinkedListStack() : head(nullptr), count(0) {}

    ~LinkedListStack() {
        while (head != nullptr) {
            Node* next = head->next;
            delete head;
            head = next;
        }
    }

    void push(int value) {
        Node* newNode = new Node(value);
        newNode->next = head;
        head = newNode;
        count++;
    }

    void pop() {
        if (head == nullptr) {
            std::cerr << "pop() on empty stack!" << std::endl;
            return;
        }
        Node* toDelete = head;
        head = head->next;
        delete toDelete;
        count--;
    }

    int top() const {
        if (head == nullptr) {
            std::cerr << "top() on empty stack!" << std::endl;
            return -1;
        }
        return head->value;
    }

    bool isEmpty() const {
        return head == nullptr;
    }

    int size() const {
        return count;
    }
};
```

Here, the "top" is the **front** (`head`) of the linked list, not the back — the mirror-image decision from the vector version, and for the identical underlying reason: `pushFront`/removing at the front is O(1) for a linked list (Lesson 5.1), while operating at the *back* of a singly linked list without a tracked `tail` would require an O(n) walk every time (Lesson 5.4). Both implementations independently arrived at "build the stack on whichever end is cheap for the underlying structure" — that's not a coincidence, it's the actual lesson.

## Both are genuinely, fully correct stacks

```cpp
void demoStack(/* imagine a shared IStack interface here, per Phase 5's pattern */) {
    // push 1, 2, 3
    // pop -> should return 3
    // pop -> should return 2
    // top -> should show 1
}
```

Run identical sequences of `push`/`pop`/`top` calls against both `VectorStack` and `LinkedListStack`, and they will produce **identical observable behavior**, every time — same LIFO ordering, same values, same edge-case handling. This is worth sitting with directly: two completely different underlying implementations, built on structures with opposite performance profiles (Lesson 5.4's whole table), are *behaviorally indistinguishable* from the outside. This is exactly what a well-designed interface should achieve — the caller only cares about LIFO ordering; the implementation is free to make internal tradeoffs invisibly.

## `std::stack` — the real standard library version

```cpp
#include <stack>

std::stack<int> s;
s.push(1);
s.push(2);
s.push(3);
std::cout << s.top() << std::endl;   // 3
s.pop();
std::cout << s.top() << std::endl;   // 2
```

Worth knowing directly: `std::stack` isn't its own independent data structure at all — by default, it's a thin wrapper around `std::deque` (Lesson 6.3, coming shortly), restricting the interface exactly the way `VectorStack` and `LinkedListStack` restrict theirs. This pattern — a class whose entire job is to narrow another class's interface down to a specific, restricted contract — is called an **adapter**, and `std::stack` is a real, standard-library example of exactly what you just built twice by hand.

## Try it yourself

**1. Build both `VectorStack` and `LinkedListStack`, run identical push/pop/top sequences against both, and confirm the outputs are byte-for-byte identical.**

**2. Deliberately build a "wrong-end" stack** — a `VectorStack` whose `push`/`pop` operate on the *front* of `MyVector` instead of the back — and benchmark it against the correct version, pushing 100,000 elements to each. Confirm the wrong-end version is dramatically, measurably slower, direct proof that "which end" was never a cosmetic choice.

**3. Add a real `popBack()` to `MyVector`** (if you haven't already, from this lesson's `VectorStack` implementation) — decrement `size` without shrinking `capacity` or touching `data` at all (Lesson 3.2's memory-for-speed tradeoff, recurring: keeping the allocated capacity around avoids a reallocation if the stack grows again soon after shrinking).

**4. Use a stack to check for balanced parentheses** — a classic, genuinely useful application: push every `(` you see, pop on every `)`, and confirm the stack is empty at the end and never asked to pop when already empty:

```cpp
bool isBalanced(const std::string& expr) {
    VectorStack stack;
    for (char c : expr) {
        if (c == '(') {
            stack.push(1);   // value doesn't matter, just tracking count
        } else if (c == ')') {
            if (stack.isEmpty()) return false;
            stack.pop();
        }
    }
    return stack.isEmpty();
}
```

Test it against `"(()())"` (balanced), `"(()"` (unbalanced — never closes), and `")("` (unbalanced — closes before opening). This exact technique — a stack tracking "what I'm still waiting to close" — is the same shape you'll use for Phase 7's expression-tree parsing and, much later, the capstone expression evaluator.

## What this cost / bought us

| | `VectorStack` | `LinkedListStack` |
|---|---|---|
| Underlying structure | `MyVector`, operating on the back | `MyLinkedList`, operating on the front |
| `push`/`pop`/`top` complexity | O(1) amortized | O(1) |
| Memory overhead | Possible unused capacity (Lesson 3.2) | One extra pointer per element (`next`) |
| Cache locality | Better — contiguous memory (Lesson 1.5) | Worse — scattered nodes |
| Interface exposed | Deliberately narrow — no arbitrary indexing | Deliberately narrow — no arbitrary indexing |
| Observable behavior | Identical to the other | Identical to the other |

Neither implementation is "the" correct way to build a stack — a stack is an *interface*, not a structure, and this lesson's real content is that distinction, made concrete twice, on top of two structures you'd already built and understood deeply from opposite directions.

---

**Next up: Lesson 6.2 — Queue, circular buffer.** A stack's opposite discipline: first in, first out — and a genuinely clever fixed-size structure, the circular buffer, that solves queue operations without ever needing to shift anything.
