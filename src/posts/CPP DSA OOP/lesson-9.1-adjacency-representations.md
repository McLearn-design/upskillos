# Lesson 9.1: Representations — Adjacency List vs. Adjacency Matrix

*Phase 9 — Graphs*
*A direct callback to Phase 3's very first time/space tradeoff discussion.*

---

## Trees, generalized

Every tree in Phase 7 had a strict shape: exactly one parent per node (except the root, which has none), no cycles, a clear hierarchy. A **graph** drops every one of those restrictions. A node (now usually called a **vertex**) can connect to any number of other vertices, in any pattern — cycles are allowed, a vertex can have many "parents" or none at all, and the whole structure might not even be connected (some vertices might be entirely unreachable from others). This generality is exactly why graphs are so widely useful — road networks, social connections, dependency chains, the World Wide Web itself, all naturally fit this shape and refuse to fit a tree's stricter one.

## Two fundamentally different ways to store the same graph

Consider a small graph: vertices `0, 1, 2, 3`, with edges `0-1`, `0-2`, `1-2`, `2-3`.

```
    0
   / \
  1---2
       \
        3
```

### Adjacency matrix — a 2D grid of connections

```cpp
class GraphMatrix {
private:
    std::vector<std::vector<bool>> matrix;
    int numVertices;

public:
    GraphMatrix(int n) : numVertices(n) {
        matrix.resize(n, std::vector<bool>(n, false));
    }

    void addEdge(int u, int v) {
        matrix[u][v] = true;
        matrix[v][u] = true;   // undirected graph — connection goes both ways
    }

    bool hasEdge(int u, int v) const {
        return matrix[u][v];
    }
};
```

For the graph above, `matrix` looks like:

```
    0  1  2  3
0 [ 0  1  1  0 ]
1 [ 1  0  1  0 ]
2 [ 1  1  0  1 ]
3 [ 0  0  1  0 ]
```

`hasEdge(0, 2)` is a single array lookup — `matrix[0][2]` — O(1), direct address arithmetic, exactly Lesson 1.5's contiguity trick, now applied in two dimensions. But notice: the matrix has `numVertices * numVertices` cells, **regardless of how many edges actually exist**. This graph has only 4 real edges, but the matrix stores `4 * 4 = 16` cells — most of them `false`, representing connections that don't exist at all. This is O(V²) space, where V is the vertex count, no matter how sparse or dense the actual graph is.

### Adjacency list — one list of neighbors per vertex

```cpp
class GraphList {
private:
    std::vector<std::vector<int>> adjacency;   // adjacency[v] = list of v's neighbors
    int numVertices;

public:
    GraphList(int n) : numVertices(n) {
        adjacency.resize(n);
    }

    void addEdge(int u, int v) {
        adjacency[u].push_back(v);
        adjacency[v].push_back(u);   // undirected — both directions recorded
    }

    bool hasEdge(int u, int v) const {
        for (int neighbor : adjacency[u]) {
            if (neighbor == v) return true;
        }
        return false;
    }
};
```

For the same graph:

```
adjacency[0] = [1, 2]
adjacency[1] = [0, 2]
adjacency[2] = [0, 1, 3]
adjacency[3] = [2]
```

`hasEdge(0, 2)` here requires scanning `adjacency[0]`'s list — O(degree of the vertex), not O(1) — genuinely slower than the matrix for this specific check. But the *total* memory used is proportional to the number of edges actually present (each edge contributes exactly two entries, one per direction, across the whole structure) — **O(V + E)** space, where E is the edge count. For a sparse graph (relatively few edges compared to the maximum possible `V²`), this is dramatically smaller than the matrix.

## The tradeoff, named precisely — this is Lesson 3.2, recurring in a new domain

| | Adjacency matrix | Adjacency list |
|---|---|---|
| Space | O(V²), always, regardless of edge count | O(V + E) — scales with actual graph density |
| `hasEdge(u, v)` | O(1) | O(degree of u) |
| Enumerate all of a vertex's neighbors | O(V) — must scan the entire row, checking every possible vertex | O(degree of u) — directly, only real neighbors are stored at all |
| Best for | Dense graphs (edges close to the maximum V² possible), or workloads needing frequent, fast edge-existence checks | Sparse graphs (most real-world graphs — social networks, road maps, dependency graphs) |

This is precisely Lesson 3.2's time/space tradeoff, now applied to an entirely new kind of structure: the matrix spends more memory to buy O(1) edge checks; the list spends less memory but pays for it with O(degree) checks. **Most real-world graphs are sparse** — a social network with a million users doesn't have each user connected to most of the other 999,999; a road network doesn't connect every city directly to every other city. For this reason, **adjacency lists are the more common choice in practice**, despite the matrix's faster edge-existence check, because the space savings for realistically sparse graphs are often enormous — a million-vertex sparse graph might need a matrix with a trillion cells (mostly wasted) versus a list needing space proportional only to its actual, much smaller edge count.

## Directed graphs — the same two representations, one small change

Everything above assumed an **undirected** graph (an edge `u-v` means you can travel in either direction). A **directed** graph (edges only go one way, like a one-way street or a "follows" relationship on social media) needs only a small adjustment — drop the second, symmetric `addEdge` line:

```cpp
// Directed version — addEdge(u, v) means ONLY u -> v, not v -> u
void addEdgeDirected(int u, int v) {
    adjacency[u].push_back(v);   // only ONE direction recorded
}
```

For the matrix version, this means `matrix[u][v]` and `matrix[v][u]` are no longer forced to match — the matrix becomes genuinely asymmetric, correctly representing one-way connections. This single, small change is the entire difference between the two graph flavors — every algorithm in the rest of this phase (BFS, DFS, topological sort, Dijkstra) works on both, with directedness affecting *how you traverse*, not *how you store*.

## Try it yourself

**1. Build both `GraphMatrix` and `GraphList` for the 4-vertex example graph above, and confirm `hasEdge` gives identical answers for every possible pair of vertices in both representations.**

**2. Measure real memory usage for a genuinely sparse graph.** Build a graph with 10,000 vertices but only 15,000 edges (a realistic sparsity ratio for many real-world networks) using both representations, and compare their actual memory footprint — for the matrix, this is `10000 * 10000` boolean cells; for the list, it's proportional to `10000 + 15000*2` integers. Compute both numbers directly and compare the ratio — it should be dramatic.

**3. Measure real memory usage for a genuinely dense graph instead** — 100 vertices, with edges between nearly every pair (close to the maximum possible `100*99/2` edges for an undirected graph). Confirm the gap between the two representations shrinks dramatically, or even reverses, for this case — direct, measured proof that "adjacency list is always better" is not the correct, unconditional lesson to take away; it's conditional on sparsity, exactly as the tradeoff table states.

**4. Build the directed version of both representations**, add a directed edge `addEdgeDirected(0, 1)` only (no reverse edge), and confirm `hasEdge(0, 1)` returns true while `hasEdge(1, 0)` returns false in both representations.

## What this cost / bought us

This lesson, like Lesson 9's phase-opening framing promises, is a direct callback: the exact same space-versus-time reasoning from Lesson 3.2 (extra memory buys faster specific operations; less memory costs some operations more) shows up again here, in a structure that looks nothing like `MyVector` or a hash table on the surface, but is governed by the identical underlying engineering logic. This is worth recognizing explicitly — the *specific* structures in this curriculum keep changing, phase to phase, but the *reasoning tools* (Big-O, amortized analysis, time/space tradeoffs) are the same handful of ideas, reapplied over and over to new material.

---

**Next up: Lesson 9.2 — BFS, DFS.** The graph generalizations of Phase 7's tree traversals — level-order becomes BFS, and preorder-style depth-first walking becomes DFS, both now needing to handle the one thing trees never had to worry about: cycles.
