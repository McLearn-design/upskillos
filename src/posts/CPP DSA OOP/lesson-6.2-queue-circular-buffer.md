# Lesson 6.2: Queue, Circular Buffer

*Phase 6 — Stacks, Queues, Deques*

---

## The opposite discipline

A **queue** enforces **first in, first out (FIFO)** — the opposite discipline from Lesson 6.1's stack. Think of a real line at a store: people join at the back, get served from the front, and the order they arrive in is the order they're served in. Add at one end, remove from the other — that's the entire rule.

## The naive approach, and exactly why it's slow

The instinct, after Lesson 6.1, might be: "just use `MyVector` again, add at the back, remove from the front."

```cpp
class NaiveQueue {
private:
    MyVector vec;

public:
    void enqueue(int value) {
        vec.pushBack(value);   // O(1) amortized — fine
    }

    int dequeue() {
        int front = vec.get(0);
        // now shift EVERYTHING left by one, to close the gap at the front
        for (int i = 0; i < vec.getSize() - 1; i++) {
            vec[i] = vec[i + 1];
        }
        // (shrink size by 1 here)
        return front;
    }
};
```

`dequeue()` here is O(n) — exactly Lesson 5.4's table, "remove from the front of a vector," the specific operation that table flagged as expensive. Unlike Lesson 6.1's stack (where you got to *choose* the cheap end for both operations), a queue's entire definition forces you to add at one end and remove from the *other* — and a plain `MyVector` is only ever cheap at one end (the back). This is a genuinely different structural challenge than the stack was, not just a variation on the same theme.

## Fix attempt 1: a linked list

```cpp
class LinkedListQueue {
private:
    Node* head;   // dequeue from here — O(1)
    Node* tail;   // enqueue here — O(1), IF tail is tracked (Lesson 5.3)
    int count;

public:
    // enqueue: attach at tail, O(1) — exactly Lesson 5.3's tail-tracked pushBack
    // dequeue: remove head, O(1) — exactly Lesson 5.1's logic
};
```

This genuinely works, and it's O(1) for both operations — a direct, correct application of Lesson 5.3's tail-tracking. But it costs one pointer per element (the `next` field) and scattered, non-contiguous memory (Lesson 1.5's cache-locality cost, named explicitly in Lesson 6.1's comparison table). For a queue specifically, there's a cleverer option that keeps `MyVector`-style contiguous memory while still being O(1) at both ends.

## The circular buffer

The core insight: instead of physically shifting elements when you remove from the front, just **move a marker** for where the front "logically" is, and let the underlying array's indices wrap around from the end back to the beginning, like a clock face.

```cpp
class CircularQueue {
private:
    int* data;
    int capacity;
    int frontIndex;   // where the current front element lives
    int count;         // how many elements are currently in the queue

public:
    CircularQueue(int cap) : capacity(cap), frontIndex(0), count(0) {
        data = new int[capacity];
    }

    ~CircularQueue() {
        delete[] data;
    }

    bool enqueue(int value) {
        if (count == capacity) {
            std::cerr << "queue full!" << std::endl;
            return false;
        }
        int insertIndex = (frontIndex + count) % capacity;   // <- the key trick
        data[insertIndex] = value;
        count++;
        return true;
    }

    int dequeue() {
        if (count == 0) {
            std::cerr << "queue empty!" << std::endl;
            return -1;
        }
        int value = data[frontIndex];
        frontIndex = (frontIndex + 1) % capacity;   // <- move the front marker, WRAPPING around
        count--;
        return value;
    }

    bool isEmpty() const { return count == 0; }
    bool isFull() const { return count == capacity; }
};
```

The entire trick lives in one operator: `%` (modulo). `(frontIndex + count) % capacity` computes "where does the next new element go," and when that number would run past the end of the array, `%` wraps it back around to `0` automatically — exactly like a clock's hour hand passing 12 and continuing from 1 again. `dequeue()`'s `frontIndex = (frontIndex + 1) % capacity;` does the identical wraparound when advancing the front marker.

## Tracing it by hand — this is worth doing slowly

Picture a `CircularQueue` with `capacity = 4`:

```
enqueue(10): data = [10, _, _, _]   frontIndex=0  count=1
enqueue(20): data = [10, 20, _, _]  frontIndex=0  count=2
enqueue(30): data = [10, 20, 30, _] frontIndex=0  count=3
dequeue()  -> returns 10.           frontIndex=1  count=2   (data itself unchanged: [10,20,30,_])
enqueue(40): data = [10,20,30,40]   frontIndex=1  count=3
enqueue(50): insertIndex = (1+3)%4 = 0 -> data = [50,20,30,40]  frontIndex=1  count=4
```

Look closely at that last line: `50` was written into index `0` — the *physical* start of the array — even though `frontIndex` is `1`. The array's beginning and end have become logically connected, wrapping around, without a single element ever being physically shifted (contrast this directly against `NaiveQueue`'s `dequeue()`, which shifted every remaining element on every single call). This is the entire payoff: **O(1) enqueue and O(1) dequeue, with contiguous, cache-friendly memory (Lesson 1.5), and zero shifting, ever.**

## The tradeoff: a circular buffer is fixed-size

Notice `CircularQueue`'s constructor takes a fixed `capacity`, and `enqueue` simply fails once full — there's no `MyVector`-style doubling-and-copying growth built into the version above. This is a genuine, real design tradeoff, not an oversight: a *growable* circular buffer is possible (resize similarly to Lesson 1.6's doubling, but you must carefully "unwrap" the existing elements into the new, larger array in their correct logical order during the copy — a real, non-trivial exercise, included below), but the fixed-size version is simpler, is exactly what's needed for a huge number of real use cases (bounded task queues, audio/video streaming buffers, network packet buffers), and is worth understanding in its pure form first.

## Try it yourself

**1. Build `CircularQueue` above and trace through the exact sequence from the hand-trace section, printing `data`, `frontIndex`, and `count` after every operation.** Confirm your printed output matches the trace exactly.

**2. Deliberately fill the queue to capacity, then dequeue everything, then enqueue past the original "end" of the array multiple times** — confirm the wraparound keeps working correctly indefinitely, not just for one lap around the array.

**3. Compare `CircularQueue` against `NaiveQueue` with a real benchmark** — enqueue and dequeue 100,000 elements alternately (enqueue a few, dequeue a few, repeat) and time both. The gap should be dramatic, direct measured proof of the O(n)-shifting cost this lesson exists to eliminate.

**4. (Harder, optional) Implement growth for `CircularQueue`.** When `enqueue` is called on a full queue, allocate a new, larger array (double the capacity, Lesson 1.6-style) and copy the existing elements into it **starting from index 0 in their correct logical order** — meaning you must read starting from `frontIndex`, wrapping around as needed, and write into the new array sequentially from the start. Reset `frontIndex` to `0` once the copy is done. This is a genuinely good exercise in combining this lesson's wraparound logic with Lesson 1.6's growth logic.

## What this cost / bought us

| | `NaiveQueue` (vector, shift on dequeue) | `LinkedListQueue` (tail-tracked) | `CircularQueue` (this lesson) |
|---|---|---|---|
| `enqueue` | O(1) amortized | O(1) | O(1) |
| `dequeue` | **O(n)** — must shift everything | O(1) | O(1) |
| Memory layout | Contiguous | Scattered | Contiguous |
| Fixed vs. growable | Growable (but slow dequeue) | Growable, O(1) always | Fixed-size by default (growable with real extra work) |
| Extra memory per element | None | One pointer (`next`) | None |

A circular buffer is a genuinely elegant piece of engineering — same underlying array-based structure from Phase 1, one clever indexing trick (`%`), and an entire class of O(n) operations disappears. This is worth remembering the next time an operation looks unavoidably expensive: sometimes the fix isn't a different data structure entirely, just a different way of *interpreting* the same memory.

---

**Next up: Lesson 6.3 — `std::deque`, and how it actually differs from a vector internally.** You've now built the "vector but fast at both ends" idea by hand, in miniature — time to see how the real standard library solves the exact same problem, generalized and growable.
