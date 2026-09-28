# Lesson 9.4: Dijkstra and Union-Find

*Phase 9 — Graphs*

---

Two algorithms in one lesson, because each is compact and each is built directly on a structure you already own. Dijkstra's shortest-path algorithm is Lesson 7.6's priority queue doing the work it was made for. Union-Find is a strikingly small structure, just an array and two short functions, that answers "are these two things connected?" almost instantly.

---

## Part 1: Dijkstra's algorithm

### Why BFS isn't enough anymore

Lesson 9.2's BFS finds shortest paths by *edge count*, and that's only correct when every edge is equally costly. Real graphs usually aren't like that: roads have different lengths, network links have different latencies, flights have different prices. A **weighted graph** attaches a cost to each edge, and "shortest path" now means minimum *total weight*, which might use more edges than a path with fewer, heavier ones. BFS's ring-by-ring expansion no longer guarantees anything about total cost.

### Weighted adjacency list

Lesson 9.1's adjacency list needs one small change: store the neighbor *and* the edge weight.

```cpp
struct Edge {
    int to;
    int weight;
};

std::vector<std::vector<Edge>> adjacency(numVertices);

adjacency[0].push_back({1, 4});   // edge 0 -> 1, cost 4
adjacency[0].push_back({2, 1});   // edge 0 -> 2, cost 1
adjacency[2].push_back({1, 2});   // edge 2 -> 1, cost 2
adjacency[1].push_back({3, 1});   // edge 1 -> 3, cost 1
```

### The idea

Maintain a `dist` array holding the best-known distance from the start to every vertex, initially infinity for everything except the start itself (distance 0). Repeatedly pick the **unfinished vertex with the smallest known distance**, declare that distance final, and use it to see whether any neighbor's distance can be improved by going through this vertex. The operation "repeatedly pick the smallest" is exactly what a min-heap does in O(log n), which is why Lesson 7.6 exists.

```cpp
#include <queue>
#include <vector>
#include <limits>

std::vector<int> dijkstra(const std::vector<std::vector<Edge>>& adjacency, int start) {
    const int INF = std::numeric_limits<int>::max();
    int n = adjacency.size();
    std::vector<int> dist(n, INF);

    // min-heap of (distance, vertex) pairs — the comparator flips the default max-heap
    using Pair = std::pair<int, int>;
    std::priority_queue<Pair, std::vector<Pair>, std::greater<Pair>> pq;

    dist[start] = 0;
    pq.push({0, start});

    while (!pq.empty()) {
        auto [currentDist, current] = pq.top();
        pq.pop();

        if (currentDist > dist[current]) continue;   // stale entry — a better route was already found

        for (const Edge& edge : adjacency[current]) {
            int newDist = currentDist + edge.weight;
            if (newDist < dist[edge.to]) {
                dist[edge.to] = newDist;              // found a shorter route to edge.to
                pq.push({newDist, edge.to});
            }
        }
    }

    return dist;
}
```

Trace it on the example edges above, starting from `0`. Initially `dist = [0, INF, INF, INF]` and the heap holds `(0, 0)`. Pop `0`: relax edge `0→1` (cost 4) giving `dist[1] = 4`, and edge `0→2` (cost 1) giving `dist[2] = 1`. Heap now holds `(4, 1)` and `(1, 2)`. The smallest is `(1, 2)`, so pop vertex `2`: relax edge `2→1` (cost 2), new distance `1 + 2 = 3`, which beats the current `dist[1] = 4`, so update `dist[1] = 3` and push `(3, 1)`. Next pop is `(3, 1)`: relax `1→3` (cost 1), giving `dist[3] = 4`. Then the stale entry `(4, 1)` gets popped later and skipped by the `currentDist > dist[current]` check, since `dist[1]` is already `3`. Final `dist = [0, 3, 1, 4]`. Notice the shortest path to vertex `1` goes through vertex `2`, using two edges, even though a direct one-edge route exists. That is precisely the case BFS gets wrong.

### Why greedy is correct here

The key insight: when a vertex is popped from the min-heap with distance `d`, no shorter route to it can exist, because every other unfinished vertex already has a distance at least `d`, and reaching this vertex through any of them would cost at least `d` plus a non-negative edge weight. That argument depends entirely on **edge weights being non-negative**. With a negative edge, "greedy is safe" breaks: a route through an already-finalized vertex plus a negative edge could beat a distance you'd already declared final. This isn't a minor caveat, it's a real correctness requirement, and graphs with negative weights need a different algorithm (Bellman-Ford), which is beyond this curriculum's scope but worth knowing exists.

### Complexity

Each vertex is finalized once, each edge is relaxed at most once, and each relaxation may push onto the heap in O(log n) time. Total: **O((V + E) log V)** using an adjacency list and a binary heap, a direct, measurable payoff of Lesson 7.6's O(log n) push/pop.

---

## Part 2: Union-Find (Disjoint Set Union)

### The problem

You're given a collection of items and a stream of "these two are connected" facts, and you need to answer "are these two items in the same group?" quickly, interleaved with new connection facts arriving. Rerunning BFS or DFS from scratch on every question would be wasteful. Union-Find maintains the answer incrementally.

### The structure: a forest stored in a plain array

Each group is a tree, but stored not as nodes with pointers, only as an array where `parent[i]` names element `i`'s parent. A root is an element that is its own parent. Two elements are in the same group exactly when they share the same root.

```cpp
class UnionFind {
private:
    std::vector<int> parent;
    std::vector<int> rank;

public:
    UnionFind(int n) : parent(n), rank(n, 0) {
        for (int i = 0; i < n; i++) parent[i] = i;   // initially every element is its own group
    }

    int find(int x) {
        if (parent[x] != x) {
            parent[x] = find(parent[x]);   // PATH COMPRESSION — flatten the tree while walking up
        }
        return parent[x];
    }

    void unite(int a, int b) {
        int rootA = find(a);
        int rootB = find(b);
        if (rootA == rootB) return;   // already in the same group

        // UNION BY RANK — attach the shorter tree under the taller one
        if (rank[rootA] < rank[rootB]) {
            parent[rootA] = rootB;
        } else if (rank[rootA] > rank[rootB]) {
            parent[rootB] = rootA;
        } else {
            parent[rootB] = rootA;
            rank[rootA]++;
        }
    }

    bool connected(int a, int b) {
        return find(a) == find(b);
    }
};
```

This is Lesson 7.6's trick again: a tree shape stored in a plain array with no node objects, relationships expressed as indices. Two optimizations make it dramatically fast, and both are worth understanding rather than copying:

**Path compression** (inside `find`): as `find` walks up from `x` to the root, it rewires every visited node to point *directly* at the root. The next `find` on any of those nodes is a single step. The tree flattens itself as a side effect of being used.

**Union by rank** (inside `unite`): when merging two trees, hang the shorter one under the taller one's root, so the combined tree grows in height only when the two heights were equal. This keeps trees shallow.

Together, these bring the amortized cost per operation to essentially constant time. The precise bound is the inverse Ackermann function, which grows so slowly that it stays below 5 for any input size that could fit in the observable universe. In practice: treat each operation as O(1), a striking result for a structure this small.

### A natural application: connected components

```cpp
UnionFind uf(6);
uf.unite(0, 1);
uf.unite(1, 2);
uf.unite(3, 4);

std::cout << uf.connected(0, 2) << std::endl;   // 1 — linked through 1
std::cout << uf.connected(0, 3) << std::endl;   // 0 — different groups
std::cout << uf.connected(5, 5) << std::endl;   // 1 — trivially, an element is connected to itself
```

This answers the same question as Lesson 9.2's DFS-based connected-components exercise, but incrementally: each new edge costs almost nothing to process, instead of requiring a full re-traversal. It's also the core ingredient of Kruskal's minimum-spanning-tree algorithm, a natural next step for anyone who wants to go further after this phase.

## Try it yourself

**1. Build `dijkstra` and test it on a small graph you can solve by hand.** Verify your `dist` array against your own trace, especially a case like the example above where a multi-edge path beats a direct edge.

**2. Compare against BFS on an unweighted graph.** Set every edge weight to 1 and run both Dijkstra and Lesson 9.2's distance-tracking BFS on the same graph. Confirm they produce identical distances, and reason about why: with uniform weights, Dijkstra degenerates into BFS.

**3. Extend Dijkstra to reconstruct the actual path**, not just distances. Add a `std::vector<int> previous(n, -1)` array, set `previous[edge.to] = current` whenever you improve a distance, then walk backward from the target to the start to recover the route. Print the path for a few queries.

**4. Build `UnionFind` and process a stream of `unite` calls on 100,000 elements.** Time it with and without path compression (comment out the compression line), then with and without union by rank. The differences at large scale should be dramatic and are the clearest way to see why both optimizations matter.

**5. Use Union-Find to detect cycles in an undirected graph.** For each edge `(u, v)`, if `connected(u, v)` is already true *before* uniting them, adding that edge closes a cycle. Test on a graph with and without a cycle.

## What this cost / bought us

| | Dijkstra | Union-Find |
|---|---|---|
| Solves | Shortest paths from one source, non-negative weights | Dynamic connectivity: "are these connected?" as edges arrive |
| Built directly on | Lesson 7.6's priority queue | Lesson 1.5's array, plus tree-shaped indexing (Lesson 7.6's trick again) |
| Complexity | O((V + E) log V) | Near-O(1) amortized per operation |
| Key requirement | Non-negative edge weights | None beyond the element universe being known up front |
| Contrast with earlier lesson | Generalizes BFS (9.2) to weighted edges | Incremental answer to what DFS-based components (9.2) computed in one batch |

---

**Phase 9's algorithm lessons are complete.**

**Next up: the Observer pattern — model a graph of "subscribers" (e.g., a dependency graph triggering rebuilds), compared against a signal/slot-style callback list.** Followed by the API checkpoint: pulling real data from a free public API, building a weighted graph from it, and running Dijkstra on live data.
