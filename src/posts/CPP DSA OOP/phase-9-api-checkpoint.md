# Phase 9 API Checkpoint: Cities, Live Distances, Dijkstra

*Pull real data from a free public API and build a graph from it — cities as nodes, distances as weighted edges, run Dijkstra on live data.*

---

## The plan

Every graph this phase has used was hand-built in code. This checkpoint builds one from data that doesn't exist in your program until you ask the network for it: real city coordinates, fetched live from a free, no-API-key geocoding service, turned into a weighted graph via real great-circle distance math, then handed straight to Lesson 9.4's `dijkstra`.

## Step 1: install an HTTP library

C++ has no built-in HTTP client (unlike Python's `requests`, bundled and ready). The standard approach is **libcurl**, the same networking library underneath `curl` itself, or **cpr** (C++ Requests), a modern wrapper around libcurl with an interface deliberately modeled on Python's `requests` to ease exactly this kind of transition.

```bash
# Debian/Ubuntu
sudo apt install libcurl4-openssl-dev

# macOS
brew install curl
```

cpr can be added via CMake's `FetchContent`, or installed via a package manager (`brew install cpr`, or building from source). This lesson uses cpr for its Python-`requests`-like readability; the equivalent raw-libcurl code is more verbose but does the identical job.

## Step 2: fetch one city's coordinates

The [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) requires no API key and returns JSON. A single request:

```cpp
#include <cpr/cpr.h>
#include <nlohmann/json.hpp>   // Phase 5's library, back for real work
#include <iostream>

struct City {
    std::string name;
    double latitude;
    double longitude;
};

City fetchCityCoordinates(const std::string& cityName) {
    cpr::Response response = cpr::Get(
        cpr::Url{"https://geocoding-api.open-meteo.com/v1/search"},
        cpr::Parameters{{"name", cityName}, {"count", "1"}}
    );

    if (response.status_code != 200) {
        throw std::runtime_error("API request failed: " + std::to_string(response.status_code));
    }

    nlohmann::json j = nlohmann::json::parse(response.text);   // exact same parsing pattern as Phase 5

    if (j["results"].empty()) {
        throw std::runtime_error("City not found: " + cityName);
    }

    auto result = j["results"][0];
    return City{
        result["name"],
        result["latitude"],
        result["longitude"]
    };
}
```

`cpr::Get` sends the request; `response.text` holds the raw JSON body, parsed exactly the way Phase 5's `file >> j;` parsed a file — the *source* of the JSON has changed from disk to network, but `nlohmann::json`'s handling of it hasn't changed at all. This is worth noticing directly: the file-I/O checkpoint's investment in learning a real JSON library pays off again here, unmodified, against a completely different data source.

## Step 3: compute real distances — the haversine formula

Great-circle distance between two points on a sphere (a reasonable approximation of Earth) isn't simple subtraction — it needs actual spherical trigonometry:

```cpp
#include <cmath>

double haversineDistance(double lat1, double lon1, double lat2, double lon2) {
    const double R = 6371.0;   // Earth's radius in kilometers

    double dLat = (lat2 - lat1) * M_PI / 180.0;
    double dLon = (lon2 - lon1) * M_PI / 180.0;

    lat1 = lat1 * M_PI / 180.0;
    lat2 = lat2 * M_PI / 180.0;

    double a = std::sin(dLat / 2) * std::sin(dLat / 2) +
               std::cos(lat1) * std::cos(lat2) *
               std::sin(dLon / 2) * std::sin(dLon / 2);
    double c = 2 * std::atan2(std::sqrt(a), std::sqrt(1 - a));

    return R * c;
}
```

This is real, standard geographic math — the same formula behind every "distance between two coordinates" feature in real mapping software. You don't need to derive it yourself; using it correctly, and understanding what it returns (a real, physical straight-line distance in kilometers, not an approximation of driving distance), is what matters here.

## Step 4: build the weighted graph

```cpp
#include <vector>
#include <unordered_map>

struct Edge {
    int to;
    int weight;   // Dijkstra from Lesson 9.4 expects int weights
};

int main() {
    std::vector<std::string> cityNames = {
        "Tokyo", "Seoul", "Beijing", "Bangkok", "Singapore", "Manila"
    };

    std::vector<City> cities;
    for (const auto& name : cityNames) {
        cities.push_back(fetchCityCoordinates(name));
        std::cout << "fetched " << cities.back().name
                  << " (" << cities.back().latitude << ", " << cities.back().longitude << ")" << std::endl;
    }

    int n = cities.size();
    std::vector<std::vector<Edge>> adjacency(n);

    // Connect every city to every other city — a complete graph, weighted by real distance
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            if (i == j) continue;
            double km = haversineDistance(cities[i].latitude, cities[i].longitude,
                                            cities[j].latitude, cities[j].longitude);
            adjacency[i].push_back({j, static_cast<int>(km)});
        }
    }

    // ... run dijkstra(adjacency, 0) here — see below ...

    return 0;
}
```

This builds a **complete graph** (every vertex connected to every other) for simplicity — a real-world routing application would more likely connect only geographically sensible pairs (adjacent cities, or existing flight routes), but a complete graph is the honest, simplest choice for this checkpoint and still produces a genuine, non-trivial weighted graph to run Dijkstra against.

## Step 5: run Dijkstra on it

```cpp
std::vector<int> distances = dijkstra(adjacency, 0);   // from Tokyo (index 0)

for (int i = 0; i < n; i++) {
    std::cout << "Tokyo -> " << cities[i].name << ": " << distances[i] << " km" << std::endl;
}
```

Because this graph is complete, Dijkstra's answer for every destination will simply equal the direct haversine distance — there's no shorter route through an intermediate city when every city is already directly connected. This is worth confirming rather than assuming: **compute the direct haversine distance for each pair yourself and check it matches Dijkstra's output exactly.** The real test of the algorithm comes next.

## Step 6: make the graph genuinely non-trivial

Remove most of the edges, keeping only a plausible subset (say, connections roughly mimicking real flight routes), and rerun Dijkstra. Now a shortest path might genuinely route through an intermediate city rather than going direct:

```cpp
std::vector<std::vector<Edge>> sparseAdjacency(n);

auto addRoute = [&](int i, int j) {
    double km = haversineDistance(cities[i].latitude, cities[i].longitude,
                                    cities[j].latitude, cities[j].longitude);
    sparseAdjacency[i].push_back({j, static_cast<int>(km)});
    sparseAdjacency[j].push_back({i, static_cast<int>(km)});
};

// A deliberately sparse, hand-picked set of "routes"
addRoute(0, 1);   // Tokyo - Seoul
addRoute(0, 2);   // Tokyo - Beijing
addRoute(2, 3);   // Beijing - Bangkok
addRoute(3, 4);   // Bangkok - Singapore
addRoute(3, 5);   // Bangkok - Manila
addRoute(1, 2);   // Seoul - Beijing
```

Now ask: what's the shortest route from Tokyo to Singapore? There's no direct edge — Dijkstra has to find the best path through the sparse network, exactly the scenario Lesson 9.4 was built for.

## Try it yourself

**1. Run the full pipeline: fetch real coordinates for 6 cities of your choosing, build both the complete and sparse graphs, and run Dijkstra from your chosen start city on both.** Confirm the complete-graph distances match direct haversine calculations exactly, and that the sparse-graph distances are equal to or greater than the complete-graph ones (a sparse graph can never offer a shorter route than a complete one, since it's a subset of the same possible edges — a good sanity check on your own implementation).

**2. Reconstruct and print the actual shortest path** (not just the distance) from your start city to a far-away one in the sparse graph, using the `previous[]` array technique from Lesson 9.4's exercise 3. Confirm the printed route matches your own intuition about which intermediate city should be on the way.

**3. Handle a real API failure gracefully.** Deliberately misspell a city name and confirm your `fetchCityCoordinates` throws a clear, catchable exception rather than crashing — wrap the whole fetch loop in a `try`/`catch` and print a useful error message, the same discipline Phase 5's JSON checkpoint exercise asked for with malformed files, now applied to a network failure instead of a file-parsing one.

**4. Cache the API responses to a local file with Python or C++**, so repeated runs of your program don't need to re-fetch the same coordinates from the network every time. This is a genuinely practical habit for real API-consuming programs — combined with `<fstream>` (Phase 2) and `nlohmann::json` (Phase 5), write the fetched cities to a local `cities_cache.json` on first run, and load from that file instead of the network on subsequent runs if it exists.

## What this cost / bought us

| | Every earlier graph in this phase | This checkpoint |
|---|---|---|
| Where the data came from | Hand-written in code | A live network API |
| Edge weights | Made up for illustration | Real, physically meaningful distances |
| Failure modes to handle | None — the data was always valid | Network errors, missing results, malformed responses |
| What this proves | The algorithm is correctly implemented | The algorithm works on real, externally-sourced data, end to end |

This checkpoint closes Phase 9 the same way Phase 2's file-I/O checkpoint and Phase 5's JSON checkpoint closed theirs: proof that everything built in isolation — the graph representation, Dijkstra, JSON parsing — composes correctly into something that does real work against the outside world, not just against data you control completely.

---

**Phase 9 is complete.** Graph representations and their honest tradeoffs, BFS and DFS unified as one algorithm parameterized by container choice, topological sort two ways with cycle detection nearly free from one of them, Dijkstra built on your own priority queue, Union-Find's near-constant-time trick, the Observer pattern chained into a real dependency graph, and a live API driving real algorithmic work.

**Next up: Phase 10 — Sorting, Searching, and Generic Programming.** A return to fundamentals with new tools: binary search, the classic sorting algorithms compared against `std::sort`, and templates — the answer to a question this curriculum has quietly deferred since `MyVector` was first built only for `int`.
