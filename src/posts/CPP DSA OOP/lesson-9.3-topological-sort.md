# Lesson 9.3: Topological Sort, Cycle Detection

*Phase 9 — Graphs*

---

## The problem: ordering things that depend on each other

You already know this problem from daily life: to make a sandwich you need bread and filling; to have filling you might need to slice tomatoes; to slice tomatoes you need a knife. Some steps must happen before others, and the question is: **what's a valid order to do everything in?** The same problem appears everywhere in software: a build system deciding which source files to compile first, a package manager deciding which libraries to install before which, a spreadsheet deciding which cells to recalculate first, a course catalog deciding which prerequisites to take in what order.

Model it as a **directed graph** (Lesson 9.1): each task is a vertex, and an edge `A → B` means "A must happen before B." A **topological sort** is an ordering of all vertices such that for every edge `A → B`, `A` appears before `B` in the ordering. This is only possible on a **directed acyclic graph (DAG)** — a directed graph with no cycles. If the graph *has* a cycle (A depends on B, B depends on C, C depends on A), no valid ordering exists at all — every task in the cycle is waiting on another one in the cycle, forever. Detecting this is the second half of this lesson, and it turns out to fall out of the same algorithm.

## Approach 1: DFS-based topological sort

Recall Lesson 7.2's **postorder** traversal — a node is processed *after* all its children. Applied to a DAG via DFS, that has a remarkable property: **a vertex finishes (all its descendants fully explored) only after everything that depends on it has already finished.** If you record vertices in the order they *finish*, then reverse that list, you get a valid topological order.

```cpp
void dfsTopo(const std::vector<std::vector<int>>& adjacency,
              int current,
              std::vector<bool>& visited,
              std::vector<int>& finishOrder) {
    visited[current] = true;

    for (int neighbor : adjacency[current]) {
        if (!visited[neighbor]) {
            dfsTopo(adjacency, neighbor, visited, finishOrder);
        }
    }

    finishOrder.push_back(current);   // POSTORDER position — record AFTER all descendants finish
}

std::vector<int> topologicalSort(const std::vector<std::vector<int>>& adjacency) {
    int n = adjacency.size();
    std::vector<bool> visited(n, false);
    std::vector<int> finishOrder;

    for (int v = 0; v < n; v++) {
        if (!visited[v]) {
            dfsTopo(adjacency, v, visited, finishOrder);
        }
    }

    std::reverse(finishOrder.begin(), finishOrder.end());
    return finishOrder;
}
```

Trace it on a tiny example: tasks `0 → 1`, `0 → 2`, `1 → 3`, `2 → 3` (0 must precede 1 and 2; both must precede 3). DFS from `0` goes to `1`, then `3`; `3` has no outgoing edges, so it finishes first, pushed first. Then `1` finishes. Back at `0`, DFS proceeds to `2`; `3` is already visited, so `2` finishes. Finally `0` finishes. `finishOrder` = `[3, 1, 2, 0]`. Reversed: `[0, 2, 1, 3]` — a valid topological order (0 before 2 and 1, both before 3). Note `[0, 1, 2, 3]` is *also* valid — topological orders aren't generally unique when independent tasks exist, and which one you get depends on the order DFS happens to explore neighbors.

**Why reversing postorder works:** if there's an edge `A → B`, then `B` necessarily finishes before `A` does (DFS from `A` must fully explore `B`'s subtree, or `B` was already finished earlier, before `A` completes). So `B` appears *earlier* in `finishOrder` than `A`, meaning after reversal `A` appears before `B` — exactly what the ordering constraint requires. The correctness argument fits in one sentence, which is part of what makes this algorithm so elegant.

## Approach 2: Kahn's algorithm — BFS-style, using in-degrees

A completely different way to reach the same answer, and one that gives cycle detection almost for free. Define a vertex's **in-degree** as the number of edges pointing *into* it — the number of prerequisites it's still waiting on. A vertex with in-degree 0 has no unfinished prerequisites, so it's safe to do right now.

```cpp
std::vector<int> kahnTopologicalSort(const std::vector<std::vector<int>>& adjacency) {
    int n = adjacency.size();
    std::vector<int> inDegree(n, 0);

    for (int u = 0; u < n; u++) {
        for (int v : adjacency[u]) {
            inDegree[v]++;
        }
    }

    std::queue<int> q;
    for (int v = 0; v < n; v++) {
        if (inDegree[v] == 0) q.push(v);   // all currently-ready tasks
    }

    std::vector<int> order;
    while (!q.empty()) {
        int current = q.front();
        q.pop();
        order.push_back(current);

        for (int neighbor : adjacency[current]) {
            inDegree[neighbor]--;               // one prerequisite of neighbor is now done
            if (inDegree[neighbor] == 0) {
                q.push(neighbor);               // neighbor just became ready
            }
        }
    }

    return order;
}
```

Repeatedly take any task with no remaining prerequisites, "complete" it, and reduce the in-degree of everything that depended on it — any dependent whose in-degree hits zero becomes newly ready. This mirrors exactly how you'd actually schedule real work by hand, and reuses Phase 6's queue as its frontier container, closing one more small loop with earlier material.

## Cycle detection falls out for free

Here's the elegant payoff of Kahn's algorithm: **if the graph contains a cycle, the algorithm can't process every vertex.** Vertices inside a cycle each have at least one prerequisite that's also inside the cycle, so their in-degrees never reach zero — they never enter the queue. Detecting this requires one line:

```cpp
std::vector<int> order = kahnTopologicalSort(adjacency);
if (order.size() != adjacency.size()) {
    std::cout << "Cycle detected — no valid ordering exists!" << std::endl;
}
```

If `order` contains fewer vertices than the graph has, some vertices were unreachable through the "in-degree hits zero" process — exactly the ones trapped in, or downstream of, a cycle. This is a much cleaner approach to cycle detection in *directed* graphs than the visited-set alone would provide, and it's genuinely worth contrasting with Lesson 5.5's Floyd algorithm for linked-list cycles: same underlying problem (does this structure loop back on itself?), completely different technique, because a graph's cycles aren't confined to a single chain of `next` pointers.

## Cycle detection with DFS: the three-color technique

The DFS approach can detect cycles too, but needs a subtler bookkeeping than a plain `visited` flag. A vertex being visited twice isn't necessarily a cycle (in a DAG, two paths can legitimately converge on the same vertex, like `3` in the example above). What signals a *cycle* is reaching a vertex that's **currently on the recursion stack** — one you started exploring but haven't finished yet:

```cpp
enum Color { WHITE, GRAY, BLACK };   // unvisited / on the current DFS path / fully finished

bool dfsHasCycle(const std::vector<std::vector<int>>& adjacency,
                  int current,
                  std::vector<Color>& color) {
    color[current] = GRAY;   // now "in progress" — on the recursion stack

    for (int neighbor : adjacency[current]) {
        if (color[neighbor] == GRAY) {
            return true;   // reached a vertex still being explored — that's a back-edge, i.e., a CYCLE
        }
        if (color[neighbor] == WHITE && dfsHasCycle(adjacency, neighbor, color)) {
            return true;
        }
    }

    color[current] = BLACK;   // fully explored, safely finished
    return false;
}
```

Three states instead of two: a `GRAY` vertex is precisely one whose DFS call is still active somewhere up the call stack (Lesson 7.1's stack frames, visible again). Reaching a `GRAY` vertex means you've found a path from a vertex back to one of its own ancestors in the current DFS path — the definition of a cycle. Reaching a `BLACK` vertex is harmless — it's fully finished, meaning that region of the graph was already explored without finding a cycle through it.

## Try it yourself

**1. Build both topological sort implementations and run them on the same DAG (for instance, a made-up build dependency graph with 8 or so tasks).** Confirm both outputs are valid topological orders — check by hand that for every edge `A → B`, `A` appears before `B` in each result. Notice they may differ from each other, and that's fine.

**2. Write a small validation function** `bool isValidTopologicalOrder(adjacency, order)` that checks the defining property directly (record each vertex's position in `order`, then verify every edge goes from an earlier position to a later one). Use it to confirm both algorithms' outputs pass.

**3. Introduce a cycle deliberately** (add an edge that closes a loop, e.g. `3 → 0` in the example above), and confirm both `kahnTopologicalSort`'s size check and `dfsHasCycle` correctly flag it. For the DFS version, trace by hand which vertex is `GRAY` at the moment the cycle is detected.

**4. Apply it to a real dependency structure.** Write a small Python script that generates a random DAG (edges only from lower-numbered to higher-numbered vertices guarantees acyclicity), saves it as JSON, and load it in C++ using nlohmann/json (Phase 5's checkpoint tool). Topologically sort it and print the order. This mirrors, at small scale, exactly what a real build tool does with a project's file dependencies.

## What this cost / bought us

| | DFS-based (reverse postorder) | Kahn's algorithm (in-degree + queue) |
|---|---|---|
| Underlying idea | Finish time from DFS, reversed | Repeatedly remove vertices with no prerequisites |
| Frontier container | Recursion (implicit call stack) | Explicit queue |
| Cycle detection | Needs a separate three-color check | Built in — output size mismatch reveals it |
| Time complexity | O(V + E) | O(V + E) |
| Preferred when | You already have DFS machinery and want brevity | You want cycle detection integrated, or a non-recursive, easily-inspected process |

Both approaches solve the same problem in the same asymptotic time — the recurring lesson of this curriculum yet again: the choice comes down to which fits the surrounding needs, not which is universally superior.

---

**Next up: Lesson 9.4 — Dijkstra and Union-Find.** Two more graph algorithms, each built directly on a structure from an earlier phase: Dijkstra's shortest-path algorithm uses Lesson 7.6's priority queue, and Union-Find is a strikingly compact structure for tracking which vertices are connected.
