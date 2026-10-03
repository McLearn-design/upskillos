---
title: 6 — Graphs: BFS, DFS and Dijkstra
track: Data Structures and Algorithms, Measured
runtime: cpp
reference: optional
console: true
---

A **graph** is a set of things (**vertices**) and connections between them (**edges**): towns and roads, web pages and links, people and friendships, tasks and dependencies. Lists, trees and grids are all special cases.

This lesson builds a route finder for a small map. It answers two different questions, with two different algorithms:

- **Fewest roads** from one town to another: **breadth-first search** (BFS).
- **Shortest drive** in km: **Dijkstra's algorithm**, built on lesson 5's priority queue.

On the way, **depth-first search** (DFS) answers a third: does the road network contain a loop?

## Step 1 — The map

**This step: create the supplied `graph/map.txt` and sketch it on paper.**

Each line is a road: two towns and its length in km. Roads go both ways, so the graph is **undirected**; its edges have lengths, so it's **weighted**.

Draw the eight towns and the roads between them. You'll want the drawing for the predictions later. Notice Glenrock and Holt: no road connects them to the rest.

```text file=graph/map.txt provided
# Roads between towns: from to km. Every road goes both ways.
Ashby Bramley 7
Ashby Corfe 9
Ashby Fenwick 14
Bramley Corfe 10
Bramley Dunmore 15
Corfe Dunmore 11
Corfe Fenwick 2
Dunmore Eastwick 6
Eastwick Fenwick 9

# An island: no road reaches it from the mainland.
Glenrock Holt 4
```

```check
file graph/map.txt
```

## Step 2 — Adjacency lists

**This step: create the supplied `graph/graph.h` and read it.**

Two common ways to store a graph with V vertices and E edges:

| | Adjacency matrix | Adjacency lists |
|---|---|---|
| Storage | V × V table of yes/no (or lengths) | for each vertex, a list of its edges |
| Memory | O(V²) | O(V + E) |
| Is there an edge a–b? | O(1) | O(edges at a) |
| Visit a vertex's neighbours | O(V) | O(its edges) |

Road maps, social networks and the web are **sparse**: each vertex has a handful of edges out of millions of possible ones. A matrix for a million towns would need a trillion cells, so adjacency lists win.

In `Graph`, towns are numbered 0, 1, 2… in the order they're first seen, so every per-town table is a plain vector indexed by id:

```text
names:  0 Ashby   1 Bramley   2 Corfe   ...
ids:    "Ashby" → 0, "Bramley" → 1, ...
roads:  0: [→1 7km, →2 9km, →5 14km]
        1: [→0 7km, →2 10km, →3 15km]
```

`Paths` is what a search returns: for every town, its distance from the start (or -1), and the town before it on the best path (`prev`). Following `prev` back from any town retraces the path.

```cpp file=graph/graph.h provided
// graph.h: towns joined by two-way roads, stored as adjacency lists.
#pragma once

#include <istream>
#include <string>
#include <unordered_map>
#include <vector>

struct Road {
    int to;    // the town at the other end
    int km;
};

struct Graph {
    std::vector<std::string> names;              // town id -> name
    std::unordered_map<std::string, int> ids;    // name -> town id
    std::vector<std::vector<Road>> roads;        // town id -> its roads

    // The town's id, adding the town if it's new.
    int id_of(const std::string& name);
    // A road both ways between a and b.
    void add_road(const std::string& a, const std::string& b, int km);
};

// Reads lines of "from to km". Blank lines and lines starting with # are
// skipped.
Graph load_graph(std::istream& in);

// The result of a search from one start town.
struct Paths {
    // Per town: roads (BFS) or km (Dijkstra) from start; -1 if unreachable.
    std::vector<int> dist;
    // Per town: the town before it on the best path; -1 for none.
    std::vector<int> prev;
};

// Breadth-first search: the fewest roads from start to every town.
Paths bfs(const Graph& g, int start);

// Dijkstra's algorithm: the fewest km from start to every town.
Paths dijkstra(const Graph& g, int start);

// The towns on the path from the search's start to target, start first.
// Empty if target can't be reached.
std::vector<int> path_to(const Paths& paths, int target);

// Depth-first search: does any road network in g contain a loop?
bool has_cycle(const Graph& g);
```

```check
file graph/graph.h
```

## Step 3 — The build file

**This step: create the supplied `graph/CMakeLists.txt`.**

`graph_tests` for now, from the tests and `graph.cpp`. You'll add the route program at the end of the lesson.

```cmake file=graph/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(graph LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Timings mean nothing without optimisation: build Release unless
# configured with -DCMAKE_BUILD_TYPE=Debug.
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# Warnings for every target below.
if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# This folder, the benchmark harness and the test framework.
include_directories(. ../bench ../testing)

# Every tests/*_test.cpp file becomes part of the test program.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(graph_tests ../testing/test_main.cpp ${TEST_SOURCES} graph.cpp)
```

```check
file graph/CMakeLists.txt
```

## Step 4 — The specification

**This step: create the supplied `graph/tests/graph_test.cpp` and read it.**

The tests build graphs from a `std::istringstream`: a stream that reads from a string. `load_graph` takes any `std::istream&`, so the same function reads a file in the real program and a string in the tests.

In `bfs_counts_roads_not_km`, C is **one** road from A, even though that road is 5 km and the way through B is only 2 km. BFS counts roads.

```cpp file=graph/tests/graph_test.cpp provided
// Provided by the lesson: loading a graph, BFS and path_to.
#include "studio_test.hpp"

#include <sstream>
#include <string>
#include <vector>

#include "graph.h"

namespace {

// A -- B -- C -- D, plus a shortcut A -- C, and E on its own with F.
Graph example()
{
    std::istringstream in("# a comment\n"
                          "A B 1\n"
                          "B C 1\n"
                          "\n"
                          "C D 1\n"
                          "A C 5\n"
                          "E F 2\n");
    return load_graph(in);
}

std::vector<std::string> names(const Graph& g, const std::vector<int>& ids)
{
    std::vector<std::string> out;
    for (int id : ids)
        out.push_back(g.names[id]);
    return out;
}

} // namespace

TEST(load_skips_comments_and_blank_lines)
{
    Graph g = example();
    CHECK_EQ(g.names.size(), 6u);
    CHECK_EQ(g.names[0], std::string("A"));
    CHECK_EQ(g.ids.at("D"), 3);
}

TEST(roads_go_both_ways)
{
    Graph g = example();
    int b = g.ids.at("B");
    CHECK_EQ(g.roads[b].size(), 2u);   // to A and to C
    int e = g.ids.at("E");
    CHECK_EQ(g.roads[e].size(), 1u);
    CHECK_EQ(g.roads[e][0].to, g.ids.at("F"));
    CHECK_EQ(g.roads[e][0].km, 2);
}

TEST(id_of_reuses_existing_towns)
{
    Graph g;
    CHECK_EQ(g.id_of("X"), 0);
    CHECK_EQ(g.id_of("Y"), 1);
    CHECK_EQ(g.id_of("X"), 0);
    CHECK_EQ(g.names.size(), 2u);
}

TEST(bfs_counts_roads_not_km)
{
    Graph g = example();
    Paths p = bfs(g, g.ids.at("A"));
    CHECK_EQ(p.dist[g.ids.at("A")], 0);
    CHECK_EQ(p.dist[g.ids.at("B")], 1);
    CHECK_EQ(p.dist[g.ids.at("C")], 1);   // the 5 km shortcut is one road
    CHECK_EQ(p.dist[g.ids.at("D")], 2);
}

TEST(bfs_marks_unreachable_towns)
{
    Graph g = example();
    Paths p = bfs(g, g.ids.at("A"));
    CHECK_EQ(p.dist[g.ids.at("E")], -1);
    CHECK(path_to(p, g.ids.at("F")).empty());
}

TEST(path_to_lists_the_towns_in_order)
{
    Graph g = example();
    Paths p = bfs(g, g.ids.at("A"));
    CHECK(names(g, path_to(p, g.ids.at("D")))
          == (std::vector<std::string>{"A", "C", "D"}));
    CHECK(names(g, path_to(p, g.ids.at("A")))
          == (std::vector<std::string>{"A"}));
}
```

```check
file graph/tests/graph_test.cpp
```

## Step 5 — Load the graph, then breadth-first search

**This step: create `graph/graph.cpp` with `id_of`, `add_road`, `load_graph`, `bfs` and `path_to`. Configure, build and run the tests.**

**Loading:** `id_of` looks the name up in `ids`; a new town gets the next id, a slot in `names`, and an empty list in `roads` (`roads.emplace_back()`). `add_road` adds the road to *both* towns' lists. `load_graph` reads lines with `std::getline`, skips empty ones and `#` comments, and reads the three fields with a `std::istringstream`.

**Breadth-first search** explores in rings: first the start, then every town one road away, then every town two roads away…

```cpp
std::queue<int> frontier;      // towns found but not yet explored
p.dist[start] = 0;
frontier.push(start);
while (!frontier.empty()) {
    int town = frontier.front();
    frontier.pop();
    for (const Road& road : g.roads[town]) {
        if (p.dist[road.to] == -1) {      // not seen yet
            p.dist[road.to] = p.dist[town] + 1;
            p.prev[road.to] = town;
            frontier.push(road.to);
        }
    }
}
```

- `std::queue` is first-in, first-out, so every town at distance 1 is explored before any at distance 2. The first time BFS reaches a town is therefore by the fewest roads.
- Each town enters the queue once and each road is looked at twice (once from each end): **O(V + E)**.
- `path_to` follows `prev` from the target back to the start (`prev` is -1 there), then reverses: inserting each town at the front of a vector does that as it goes.

```text
cmake -S graph -B graph/build -G "MinGW Makefiles"     (Windows)
cmake -S graph -B graph/build                          (macOS, Linux)
```

```text
cmake --build graph/build
./graph/build/graph_tests
```

```cpp file=graph/graph.cpp
#include "graph.h"

#include <queue>
#include <sstream>

int Graph::id_of(const std::string& name)
{
    auto found = ids.find(name);
    if (found != ids.end())
        return found->second;
    int id = static_cast<int>(names.size());
    ids[name] = id;
    names.push_back(name);
    roads.emplace_back();   // the new town has no roads yet
    return id;
}

void Graph::add_road(const std::string& a, const std::string& b, int km)
{
    int from = id_of(a);
    int to = id_of(b);
    roads[from].push_back({to, km});
    roads[to].push_back({from, km});
}

Graph load_graph(std::istream& in)
{
    Graph g;
    std::string line;
    while (std::getline(in, line)) {
        if (line.empty() || line[0] == '#')
            continue;
        std::istringstream fields(line);
        std::string a;
        std::string b;
        int km = 0;
        if (fields >> a >> b >> km)
            g.add_road(a, b, km);
    }
    return g;
}

Paths bfs(const Graph& g, int start)
{
    Paths p{std::vector<int>(g.names.size(), -1),
            std::vector<int>(g.names.size(), -1)};
    std::queue<int> frontier;
    p.dist[start] = 0;
    frontier.push(start);
    while (!frontier.empty()) {
        int town = frontier.front();
        frontier.pop();
        for (const Road& road : g.roads[town]) {
            if (p.dist[road.to] == -1) {        // not seen yet
                p.dist[road.to] = p.dist[town] + 1;
                p.prev[road.to] = town;
                frontier.push(road.to);
            }
        }
    }
    return p;
}

std::vector<int> path_to(const Paths& paths, int target)
{
    if (paths.dist[target] == -1)
        return {};
    std::vector<int> path;
    for (int town = target; town != -1; town = paths.prev[town])
        path.insert(path.begin(), town);   // walk back to the start
    return path;
}
```

```check
file graph/build/CMakeCache.txt label="graph/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build graph/build"
tests "./graph/build/graph_tests" require="roads_go_both_ways bfs_counts_roads_not_km path_to_lists_the_towns_in_order" -- add_road adds the road to both towns' lists.
```

## Step 6 — Tests first: has_cycle

**This step: create `graph/tests/cycle_test.cpp` with at least three tests of `has_cycle`, before writing it.**

`has_cycle(g)` returns true if you can leave some town and come back to it without using any road twice. Writing the tests first makes you decide exactly what that means before you write any code. Good cases:

- a line of towns A–B–C–D: no cycle;
- a triangle A–B–C–A: a cycle;
- a graph in two pieces, where only the second piece has a loop (so the search must not stop after the first piece);
- an empty graph, `Graph{}`.

Use `load_graph` with a `std::istringstream`, as the provided tests do. The tests won't link until `has_cycle` exists: tests that fail first, then pass, are the rhythm of **test-driven development**.

```cpp file=graph/tests/cycle_test.cpp
// My tests for has_cycle.
#include "studio_test.hpp"

#include <sstream>

#include "graph.h"

namespace {

Graph from_text(const char* text)
{
    std::istringstream in(text);
    return load_graph(in);
}

} // namespace

TEST(a_line_has_no_cycle)
{
    CHECK(!has_cycle(from_text("A B 1\nB C 1\nC D 1\n")));
}

TEST(a_triangle_is_a_cycle)
{
    CHECK(has_cycle(from_text("A B 1\nB C 1\nC A 1\n")));
}

TEST(a_cycle_in_a_second_island_is_found)
{
    CHECK(has_cycle(from_text("A B 1\nX Y 1\nY Z 1\nZ X 1\n")));
}

TEST(an_empty_graph_has_no_cycle)
{
    CHECK(!has_cycle(Graph{}));
}
```

```check
matches graph/tests/cycle_test.cpp "(\bTEST\s*\([\s\S]*){3}" label="cycle_test.cpp has at least three tests"
contains graph/tests/cycle_test.cpp "has_cycle("
```

## Step 7 — Depth-first search

**This step: implement `has_cycle` in `graph/graph.cpp` with a recursive depth-first search, and make every test pass.**

DFS goes as **deep** as it can along one path before backing up to try another. Recursion does the backing up for you:

```text
visit(town, came_from):
    mark town visited
    for each road from town:
        skip the road back to came_from
        if road.to is already visited: found a cycle
        otherwise visit(road.to, town)
```

- Why skip `came_from`? Every road is in both towns' lists, so from B you'd always see the road back to A, which you've just used. That isn't a loop.
- Reaching an already-visited town any *other* way means there are two different routes to it: a cycle.
- Start a DFS from every town that hasn't been visited yet, so separate pieces of the graph are all checked.
- Put the recursive helper in an unnamed `namespace { }` and pass `std::vector<bool>& visited` along.

DFS also visits every town reachable from its start, so it answers "can I get from A to B at all?" as well as BFS does. BFS is the one to use when you want *fewest steps*; DFS is simpler for questions about structure, such as cycles, and the order to do tasks with dependencies.

> On a graph with a million vertices in a long chain, recursion this deep would overflow the stack. Production code uses an explicit `std::vector` as a stack instead.

```cpp file=graph/graph.cpp
#include "graph.h"

#include <queue>
#include <sstream>

int Graph::id_of(const std::string& name)
{
    auto found = ids.find(name);
    if (found != ids.end())
        return found->second;
    int id = static_cast<int>(names.size());
    ids[name] = id;
    names.push_back(name);
    roads.emplace_back();   // the new town has no roads yet
    return id;
}

void Graph::add_road(const std::string& a, const std::string& b, int km)
{
    int from = id_of(a);
    int to = id_of(b);
    roads[from].push_back({to, km});
    roads[to].push_back({from, km});
}

Graph load_graph(std::istream& in)
{
    Graph g;
    std::string line;
    while (std::getline(in, line)) {
        if (line.empty() || line[0] == '#')
            continue;
        std::istringstream fields(line);
        std::string a;
        std::string b;
        int km = 0;
        if (fields >> a >> b >> km)
            g.add_road(a, b, km);
    }
    return g;
}

Paths bfs(const Graph& g, int start)
{
    Paths p{std::vector<int>(g.names.size(), -1),
            std::vector<int>(g.names.size(), -1)};
    std::queue<int> frontier;
    p.dist[start] = 0;
    frontier.push(start);
    while (!frontier.empty()) {
        int town = frontier.front();
        frontier.pop();
        for (const Road& road : g.roads[town]) {
            if (p.dist[road.to] == -1) {        // not seen yet
                p.dist[road.to] = p.dist[town] + 1;
                p.prev[road.to] = town;
                frontier.push(road.to);
            }
        }
    }
    return p;
}

std::vector<int> path_to(const Paths& paths, int target)
{
    if (paths.dist[target] == -1)
        return {};
    std::vector<int> path;
    for (int town = target; town != -1; town = paths.prev[town])
        path.insert(path.begin(), town);   // walk back to the start
    return path;
}

namespace {

// Visits every town reachable from town. Returns true if it finds a road
// back to an already-visited town, other than the road it arrived by.
bool dfs_finds_cycle(const Graph& g, int town, int came_from,
                     std::vector<bool>& visited)
{
    visited[town] = true;
    for (const Road& road : g.roads[town]) {
        if (road.to == came_from)
            continue;                  // that's just the way back
        if (visited[road.to])
            return true;               // another way to a visited town
        if (dfs_finds_cycle(g, road.to, town, visited))
            return true;
    }
    return false;
}

} // namespace

bool has_cycle(const Graph& g)
{
    std::vector<bool> visited(g.names.size(), false);
    for (int town = 0; town < static_cast<int>(g.names.size()); ++town) {
        if (!visited[town] && dfs_finds_cycle(g, town, -1, visited))
            return true;
    }
    return false;
}
```

```check
matches graph/graph.cpp "bool\s+has_cycle\s*\(" label="graph.cpp defines has_cycle"
run "cmake --build graph/build"
tests "./graph/build/graph_tests" -- Skip only the road back to the town you came from; any other road to a visited town means a cycle.
```

## Step 8 — Dijkstra's algorithm

**This step: implement `dijkstra` in `graph/graph.cpp`.**

BFS finds the fewest *roads*. For the fewest *km*, a short-looking route with many tiny roads can beat one long road, so towns must be explored in order of **distance so far**, and lesson 5's priority queue is exactly the tool:

```cpp
using Item = std::pair<int, int>;              // (km so far, town)
std::priority_queue<Item, std::vector<Item>, std::greater<Item>>
    frontier;                                  // smallest km on top
p.dist[start] = 0;
frontier.push({0, start});
while (!frontier.empty()) {
    auto [km, town] = frontier.top();
    frontier.pop();
    if (km > p.dist[town])
        continue;              // an old entry: town got closer since
    for (const Road& road : g.roads[town]) {
        int via = km + road.km;
        // if road.to is unseen, or via is shorter than its best so
        // far: record via and town in dist and prev, and push it
    }
}
```

- `std::greater<Item>` turns the max-heap into a min-heap. Pairs compare by their first member first, so the smallest km comes out first. Include `<functional>` and `<utility>`.
- `auto [km, town] = ...` is a **structured binding**: it unpacks the pair into two named variables.
- When a town is popped with its current best distance, no shorter route can turn up later: every other route would go through a town that's at least as far away, plus a road of positive length. That's why Dijkstra needs **no negative lengths**.
- A town can be pushed several times as shorter routes turn up. The `continue` skips the stale entries. Each road can cause one push, so the cost is **O(E log V)**.

The route program in the next step will put it to work.

```cpp file=graph/graph.cpp
#include "graph.h"

#include <functional>
#include <queue>
#include <sstream>
#include <utility>

int Graph::id_of(const std::string& name)
{
    auto found = ids.find(name);
    if (found != ids.end())
        return found->second;
    int id = static_cast<int>(names.size());
    ids[name] = id;
    names.push_back(name);
    roads.emplace_back();   // the new town has no roads yet
    return id;
}

void Graph::add_road(const std::string& a, const std::string& b, int km)
{
    int from = id_of(a);
    int to = id_of(b);
    roads[from].push_back({to, km});
    roads[to].push_back({from, km});
}

Graph load_graph(std::istream& in)
{
    Graph g;
    std::string line;
    while (std::getline(in, line)) {
        if (line.empty() || line[0] == '#')
            continue;
        std::istringstream fields(line);
        std::string a;
        std::string b;
        int km = 0;
        if (fields >> a >> b >> km)
            g.add_road(a, b, km);
    }
    return g;
}

Paths bfs(const Graph& g, int start)
{
    Paths p{std::vector<int>(g.names.size(), -1),
            std::vector<int>(g.names.size(), -1)};
    std::queue<int> frontier;
    p.dist[start] = 0;
    frontier.push(start);
    while (!frontier.empty()) {
        int town = frontier.front();
        frontier.pop();
        for (const Road& road : g.roads[town]) {
            if (p.dist[road.to] == -1) {        // not seen yet
                p.dist[road.to] = p.dist[town] + 1;
                p.prev[road.to] = town;
                frontier.push(road.to);
            }
        }
    }
    return p;
}

std::vector<int> path_to(const Paths& paths, int target)
{
    if (paths.dist[target] == -1)
        return {};
    std::vector<int> path;
    for (int town = target; town != -1; town = paths.prev[town])
        path.insert(path.begin(), town);   // walk back to the start
    return path;
}

namespace {

// Visits every town reachable from town. Returns true if it finds a road
// back to an already-visited town, other than the road it arrived by.
bool dfs_finds_cycle(const Graph& g, int town, int came_from,
                     std::vector<bool>& visited)
{
    visited[town] = true;
    for (const Road& road : g.roads[town]) {
        if (road.to == came_from)
            continue;                  // that's just the way back
        if (visited[road.to])
            return true;               // another way to a visited town
        if (dfs_finds_cycle(g, road.to, town, visited))
            return true;
    }
    return false;
}

} // namespace

bool has_cycle(const Graph& g)
{
    std::vector<bool> visited(g.names.size(), false);
    for (int town = 0; town < static_cast<int>(g.names.size()); ++town) {
        if (!visited[town] && dfs_finds_cycle(g, town, -1, visited))
            return true;
    }
    return false;
}

Paths dijkstra(const Graph& g, int start)
{
    Paths p{std::vector<int>(g.names.size(), -1),
            std::vector<int>(g.names.size(), -1)};
    // (km so far, town), smallest km on top.
    using Item = std::pair<int, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<Item>> frontier;
    p.dist[start] = 0;
    frontier.push({0, start});
    while (!frontier.empty()) {
        auto [km, town] = frontier.top();
        frontier.pop();
        if (km > p.dist[town])
            continue;                  // an old, longer entry: skip it
        for (const Road& road : g.roads[town]) {
            int via = km + road.km;
            if (p.dist[road.to] == -1 || via < p.dist[road.to]) {
                p.dist[road.to] = via;     // a shorter way to road.to
                p.prev[road.to] = town;
                frontier.push({via, road.to});
            }
        }
    }
    return p;
}
```

```check
matches graph/graph.cpp "Paths\s+dijkstra\s*\(" label="graph.cpp defines dijkstra"
contains graph/graph.cpp "priority_queue"
run "cmake --build graph/build"
tests "./graph/build/graph_tests"
```

## Step 9 — The route finder

**This step: create `graph/main.cpp`, the `route` program, and add it to `graph/CMakeLists.txt`.**

```cmake
add_executable(route main.cpp graph.cpp)
```

`route <map file> <from> <to>` reads the map, and prints both answers with their paths:

```text
./graph/build/route graph/map.txt Ashby Eastwick
fewest roads: 2 (Ashby -> Fenwick -> Eastwick)
shortest: 20 km (Ashby -> Corfe -> Fenwick -> Eastwick)
```

- `main(int argc, char* argv[])` receives the command-line words: `argv[1]` is the map file, `argv[2]` and `argv[3]` the towns. If `argc` isn't 4, print a usage message to `std::cerr` and return 2.
- Open the file with `std::ifstream` (from `<fstream>`), and pass it to `load_graph`.
- An unknown town prints `unknown town: <name>` to `std::cerr` and returns 1.
- If BFS can't reach the target, print `no route from <from> to <to>`.

**Predict** before you run it: using your drawing of the map, which route has fewest roads from Ashby to Eastwick, and which is shortest in km? Then try Ashby to Holt.

```text
cmake --build graph/build
./graph/build/route graph/map.txt Ashby Eastwick
./graph/build/route graph/map.txt Ashby Holt
```

```cpp file=graph/main.cpp
// route: the fewest roads and the shortest drive between two towns.
//   route <map file> <from> <to>
#include <cstddef>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

#include "graph.h"

namespace {

void print_path(const Graph& g, const std::vector<int>& path)
{
    for (std::size_t i = 0; i < path.size(); ++i)
        std::cout << (i ? " -> " : "") << g.names[path[i]];
}

} // namespace

int main(int argc, char* argv[])
{
    if (argc != 4) {
        std::cerr << "usage: route <map file> <from> <to>\n";
        return 2;
    }
    std::ifstream file(argv[1]);
    if (!file) {
        std::cerr << "can't open " << argv[1] << '\n';
        return 1;
    }
    Graph g = load_graph(file);
    for (int i = 2; i <= 3; ++i) {
        if (!g.ids.count(argv[i])) {
            std::cerr << "unknown town: " << argv[i] << '\n';
            return 1;
        }
    }
    int from = g.ids.at(argv[2]);
    int to = g.ids.at(argv[3]);

    Paths hops = bfs(g, from);
    if (hops.dist[to] == -1) {
        std::cout << "no route from " << argv[2] << " to " << argv[3] << '\n';
        return 0;
    }
    std::cout << "fewest roads: " << hops.dist[to] << " (";
    print_path(g, path_to(hops, to));
    std::cout << ")\n";

    Paths km = dijkstra(g, from);
    std::cout << "shortest: " << km.dist[to] << " km (";
    print_path(g, path_to(km, to));
    std::cout << ")\n";
}
```

```check
contains graph/CMakeLists.txt "add_executable(route" -- Add add_executable(route main.cpp graph.cpp) to the end of CMakeLists.txt.
run "cmake --build graph/build"
run "./graph/build/route graph/map.txt Ashby Eastwick" stdout="fewest roads: 2 (Ashby -> Fenwick -> Eastwick)"
run "./graph/build/route graph/map.txt Ashby Eastwick" stdout="shortest: 20 km (Ashby -> Corfe -> Fenwick -> Eastwick)" -- Dijkstra must update a town whenever it finds a shorter route to it, not only the first time.
run "./graph/build/route graph/map.txt Ashby Holt" stdout="no route from Ashby to Holt"
run "./graph/build/route graph/map.txt Ashby Atlantis" exit=1 stderr="unknown town: Atlantis"
```
