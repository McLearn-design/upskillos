# Lesson 9.2: BFS, DFS

*Phase 9 — Graphs*

---

## Trees never had to worry about this

Phase 7's tree traversals — preorder, inorder, postorder, level-order — could all walk a tree without ever tracking where they'd already been. That worked because a tree has no cycles: following child pointers downward can never bring you back to a node you've already visited. A graph breaks this guarantee completely. Follow edges around a cycle and you'll arrive back where you started, and a traversal that doesn't notice will loop forever — the exact same infinite-loop failure Lesson 5.5 diagnosed for a linked list with an accidental cycle, now a routine fact of life for graphs rather than a rare bug.

The fix is universal to every graph traversal: **keep a record of which vertices you've already visited, and never revisit one.**

## BFS — breadth-first, using Phase 6's queue

**Breadth-first search** explores the graph in expanding "rings" outward from a starting vertex: first the start itself, then everything one edge away, then everything two edges away, and so on. This is precisely Lesson 7.2's level-order traversal, generalized from trees to graphs — and, exactly like level-order, it needs a FIFO queue (Lesson 6.2) to work.

```cpp
#include <queue>
#include <vector>

void bfs(const std::vector<std::vector<int>>& adjacency, int start) {
    std::vector<bool> visited(adjacency.size(), false);
    std::queue<int> q;

    visited[start] = true;
    q.push(start);

    while (!q.empty()) {
        int current = q.front();
        q.pop();
        std::cout << current << " ";

        for (int neighbor : adjacency[current]) {
            if (!visited[neighbor]) {
                visited[neighbor] = true;   // mark BEFORE enqueuing, not after popping — this matters
                q.push(neighbor);
            }
        }
    }
    std::cout << std::endl;
}
```

Notice the one crucial detail flagged in the comment: `visited[neighbor] = true` happens at the moment a vertex is *enqueued*, not when it's later dequeued. If you waited until dequeue time to mark it, the same vertex could be pushed onto the queue multiple times (once from each neighbor that reaches it before it's finally processed), wasting work and, in dense graphs, blowing up the queue's size dramatically. Marking at enqueue time guarantees each vertex enters the queue exactly once, ever.

For the 4-vertex graph from Lesson 9.1 (`0-1`, `0-2`, `1-2`, `2-3`), BFS starting from vertex `0` visits: `0`, then its neighbors `1` and `2`, then `2`'s unvisited neighbor `3` — output `0 1 2 3`. Every vertex at distance 1 from `0` is visited before any vertex at distance 2, which is precisely BFS's defining property, and the direct reason it's the correct tool for **shortest-path-by-edge-count in an unweighted graph** — the first time BFS reaches a vertex, it has necessarily done so via a path with the fewest possible edges, because closer vertices are always processed before farther ones.

## DFS — depth-first, using recursion (or Lesson 7.3's explicit stack)

**Depth-first search** does the opposite: go as deep as possible along one path before backtracking, exactly like Lesson 7.2's preorder traversal, generalized to graphs.

```cpp
void dfsRecursive(const std::vector<std::vector<int>>& adjacency,
                   int current,
                   std::vector<bool>& visited) {
    visited[current] = true;
    std::cout << current << " ";

    for (int neighbor : adjacency[current]) {
        if (!visited[neighbor]) {
            dfsRecursive(adjacency, neighbor, visited);
        }
    }
}
```

The recursive version is clean and short, using the call stack (Lesson 7.1) as its implicit "where do I backtrack to" memory. For the same 4-vertex graph starting at `0`: visit `0`, recurse into its first unvisited neighbor `1`, recurse into `1`'s first unvisited neighbor `2`, recurse into `2`'s unvisited neighbor `3`, hit a dead end, backtrack — output `0 1 2 3` here, though on graphs with more branching the visiting order differs sharply from BFS, since DFS commits fully to one direction before exploring alternatives.

## DFS again, with an explicit stack — Lesson 7.3's proof, reapplied

Lesson 7.3 proved recursion and explicit-stack iteration are two views of the same mechanism, and warned that deep recursion risks stack overflow. A graph with a very long path (imagine a chain of a hundred thousand vertices) hits exactly that risk for `dfsRecursive`. The iterative version fixes it directly:

```cpp
void dfsIterative(const std::vector<std::vector<int>>& adjacency, int start) {
    std::vector<bool> visited(adjacency.size(), false);
    std::stack<int> stack;

    stack.push(start);

    while (!stack.empty()) {
        int current = stack.top();
        stack.pop();

        if (visited[current]) continue;   // may have been pushed multiple times before being visited
        visited[current] = true;
        std::cout << current << " ";

        for (int neighbor : adjacency[current]) {
            if (!visited[neighbor]) {
                stack.push(neighbor);
            }
        }
    }
    std::cout << std::endl;
}
```

Notice a genuine contrast with BFS's visited-marking: here, `visited` is checked when a vertex is *popped*, not when it's pushed, because a stack-based DFS can legitimately push the same vertex several times (from different neighbors) before it's ever actually visited — the `if (visited[current]) continue;` at pop time is what filters out the duplicates. This asymmetry between the two traversals' marking discipline is a real, subtle detail — and it traces straight back to the queue-versus-stack distinction Lesson 7.2's level-order-versus-depth-first exercise first made concrete.

## BFS vs. DFS — same skeleton, opposite container

Look at the two iterative versions side by side. Strip away the details and they are *nearly identical*: initialize a container with the start vertex, loop while it's non-empty, take one out, process it, add its unvisited neighbors. **The only structural difference is which container you use — a FIFO queue gives BFS; a LIFO stack gives DFS.** This is the same observation Lesson 7.2's exercise 3 had you discover for tree traversal (swap the queue for a stack in level-order and get a depth-first order instead), now fully generalized: this is genuinely one algorithm skeleton, parameterized by the discipline of the container holding the frontier of "vertices still to explore." That's one of the most elegant unifying ideas in this whole curriculum, and it's worth pausing on.

## Complexity

Both BFS and DFS visit each vertex once and examine each edge a constant number of times, giving **O(V + E)** time with an adjacency list — proportional to the actual size of the graph, nothing more. (With an adjacency *matrix*, finding a vertex's neighbors requires scanning a full O(V) row per vertex, making the total O(V²) — direct, concrete payoff of Lesson 9.1's representation tradeoff, now visible as a real algorithmic cost difference rather than just a space one.)

## Try it yourself

**1. Build `bfs` and both DFS versions, run all three on a graph with at least 8 vertices and some branching, and print the visiting order for each.** Confirm BFS visits vertices in order of increasing distance from the start, and that the two DFS versions may produce visiting orders that differ from each other slightly depending on neighbor ordering (an instructive discrepancy worth tracing by hand — why might recursive and iterative DFS differ on neighbor ordering, given how each one processes a vertex's neighbor list?).

**2. Use BFS to compute actual shortest distances.** Modify `bfs` to maintain a `std::vector<int> distance(V, -1)`, setting `distance[start] = 0` and `distance[neighbor] = distance[current] + 1` when first discovering a neighbor. Print every vertex's distance from the start, and hand-verify a few against the graph drawing.

**3. Deliberately break the visited-tracking.** Comment out every `visited` check in `bfs` and run it on a graph containing a cycle. Confirm it loops forever (or until memory runs out) — direct, felt proof of why the visited set isn't optional bookkeeping but the entire correctness mechanism for graph traversal.

**4. Use DFS to count connected components.** Run DFS from vertex `0`, then look for any vertex still unvisited, and run DFS again from it, counting how many times you had to restart. Test on a graph deliberately built with two or three disconnected clusters. This is a genuinely practical application (finding isolated "islands" in a network) built directly on the traversal you just wrote.

## What this cost / bought us

| | BFS | DFS |
|---|---|---|
| Container holding the frontier | FIFO queue | LIFO stack (explicit, or the implicit call stack) |
| Visiting order | Expanding rings outward from the start | Commits fully to one path before backtracking |
| Finds shortest path (by edge count, unweighted) | **Yes — guaranteed** | No |
| Memory in the worst case | Can hold a very wide frontier (many vertices at the same distance) | Can hold a very deep path (recursion depth, or stack size) |
| Time complexity (adjacency list) | O(V + E) | O(V + E) |
| Natural fit for | Shortest paths, "nearest X" queries, level-by-level processing | Exhaustive exploration, cycle detection, connected components, topological ordering (next lesson) |

---

**Next up: Lesson 9.3 — Topological sort, cycle detection.** Two immediately practical applications of exactly the DFS you just wrote: ordering tasks with dependencies, and detecting when a dependency graph is impossibly circular — the mechanism underneath every build system and package manager you've ever used.
