# Lesson 12.6: Calling a Free REST API, Parsing the Response Into Your Own Objects

*Phase 12 — Persistence Layer: Files, JSON, XML, CSV, SQLite*

---

## Formalizing what Phase 9 already did once

Phase 9's checkpoint fetched city coordinates from a live geocoding API to build a weighted graph. That lesson's focus was the graph and Dijkstra; the API call itself was a means to an end, introduced quickly. This lesson makes the HTTP/JSON pipeline itself the subject, and — closing the loop properly — combines it with Lesson 12.3's `to_json`/`from_json` hooks so the response lands directly in a real, typed C++ object rather than being picked apart field by field at every call site.

## The pipeline, named explicitly

Every API-consuming program in this curriculum follows the same four-stage shape, worth naming precisely because recognizing the shape is more valuable than any one specific API's details:

1. **Request** — send an HTTP request to some URL, with whatever parameters the API requires.
2. **Response** — receive raw text back (almost always JSON, for a modern REST API).
3. **Parse** — turn that raw text into a structured `nlohmann::json` object (Phase 5's and Phase 9's exact mechanism).
4. **Deserialize** — turn the structured JSON into your own typed C++ objects (Lesson 12.3's `from_json` hook).

## A full example: fetching weather data

The [Open-Meteo Weather API](https://open-meteo.com/en/docs) (the same free, no-key-required provider from Phase 9's geocoding checkpoint) returns current weather for any coordinate:

```cpp
#include <cpr/cpr.h>
#include <nlohmann/json.hpp>
#include <iostream>
#include <optional>

struct Weather {
    double temperature;
    double windSpeed;
    int weatherCode;
};

void from_json(const nlohmann::json& j, Weather& w) {   // Lesson 12.3's hook, applied to API data this time
    const auto& current = j.at("current");
    current.at("temperature_2m").get_to(w.temperature);
    current.at("wind_speed_10m").get_to(w.windSpeed);
    current.at("weather_code").get_to(w.weatherCode);
}

std::optional<Weather> fetchWeather(double latitude, double longitude) {
    cpr::Response response = cpr::Get(
        cpr::Url{"https://api.open-meteo.com/v1/forecast"},
        cpr::Parameters{
            {"latitude", std::to_string(latitude)},
            {"longitude", std::to_string(longitude)},
            {"current", "temperature_2m,wind_speed_10m,weather_code"}
        }
    );

    if (response.status_code != 200) {
        std::cerr << "Request failed: " << response.status_code << std::endl;
        return std::nullopt;
    }

    try {
        nlohmann::json j = nlohmann::json::parse(response.text);
        return j.get<Weather>();   // Lesson 12.3's deserialization, triggered via the implicit from_json hook
    } catch (const nlohmann::json::exception& e) {
        std::cerr << "JSON parse error: " << e.what() << std::endl;
        return std::nullopt;
    }
}
```

```cpp
int main() {
    auto weather = fetchWeather(35.6762, 139.6503);   // Tokyo's coordinates

    if (weather) {
        std::cout << "Temperature: " << weather->temperature << "°C" << std::endl;
        std::cout << "Wind speed: " << weather->windSpeed << " km/h" << std::endl;
    } else {
        std::cout << "Failed to fetch weather" << std::endl;
    }

    return 0;
}
```

`fetchWeather` returns `std::optional<Weather>` (Lesson 11.2), correctly distinguishing "the request genuinely failed" or "the response couldn't be parsed" from "here's a real `Weather` object" — no sentinel values, no awkward output parameters, and the caller is forced by the type system to handle the missing case (`if (weather)`) before accessing the data at all.

## Every real failure mode, handled explicitly — not glossed over

This function has three genuinely distinct failure points, each handled separately and deliberately, worth naming precisely because real network code needs to anticipate all of them:

- **Network/HTTP failure** — the request itself fails, or the server returns a non-200 status code (404 not found, 500 server error, and so on). Checked via `response.status_code != 200`.
- **Malformed JSON** — the response body isn't valid JSON at all (a server error page, truncated data, a network issue corrupting the response). Caught via the `try`/`catch` around `nlohmann::json::parse`, exactly Phase 5's checkpoint exercise 3, now applied to network data instead of a corrupted local file.
- **Valid JSON, wrong shape** — the response parses fine as JSON but doesn't have the fields `from_json` expects (an API version change, an unexpected error-response shape instead of the expected data shape). `j.at("current")` throws if the key is missing (unlike `j["current"]`, which would silently create a null entry — a genuinely important, easy-to-miss distinction, directly recalling Lesson 8.5's `operator[]`-silently-inserts gotcha, now showing up in a JSON library instead of a hash map), and that exception is caught by the same `catch` block.

Real production code calling external APIs needs to anticipate all three of these independently — a program that only checks the HTTP status code, while assuming the body is always well-formed and always has the expected shape, is a program that will eventually crash or silently produce wrong data the first time the external API has any kind of hiccup, which happens to every real external API eventually.

## Combining this with SQLite — a complete, realistic small pipeline

```cpp
void cacheWeather(sqlite3* db, double lat, double lon, const Weather& w) {
    sqlite3_stmt* stmt;
    const char* sql = "INSERT INTO weather_cache (lat, lon, temp, wind, code) VALUES (?, ?, ?, ?, ?);";

    sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);   // Lesson 12.5's SAFE, prepared-statement pattern
    sqlite3_bind_double(stmt, 1, lat);
    sqlite3_bind_double(stmt, 2, lon);
    sqlite3_bind_double(stmt, 3, w.temperature);
    sqlite3_bind_double(stmt, 4, w.windSpeed);
    sqlite3_bind_int(stmt, 5, w.weatherCode);

    sqlite3_step(stmt);
    sqlite3_finalize(stmt);
}
```

This single function chains together Lesson 12.5's prepared-statement discipline with this lesson's API-fetched `Weather` struct — a genuinely realistic small system: fetch live data from the network, cache it in a real local database, exactly the shape of a huge number of real-world applications (a weather app, a stock tracker, any program that talks to an external service and wants to avoid refetching the same data unnecessarily, directly recalling Phase 9's checkpoint exercise 4's caching suggestion, now actually built out with a real database instead of a flat file).

## Try it yourself

**1. Build `fetchWeather` and confirm it correctly retrieves and prints live weather for a few different coordinates of your choosing.**

**2. Deliberately break each failure mode and confirm your error handling catches it correctly**: pass an invalid URL (triggering the HTTP-failure path), temporarily replace `response.text` with a deliberately malformed string before parsing (triggering the JSON-parse-failure path), and temporarily rename one of the fields `from_json` looks for (triggering the wrong-shape failure path, via `j.at`'s exception). Confirm all three are caught cleanly, with no crash, and a sensible `std::nullopt` or error message in each case.

**3. Build the `cacheWeather` function and a matching `loadCachedWeather` (reusing Lesson 12.5's `SELECT`-with-`WHERE` pattern), and build a small program that checks the cache first, only calling the live API if no cached entry exists for the given coordinates** — a genuinely practical, real caching strategy, combining this entire phase's tools in one small, coherent piece of work.

**4. Compare `j["current"]` versus `j.at("current")` directly** — deliberately query a missing key both ways and confirm `[]` silently returns a null JSON value (no exception, no error) while `.at()` throws immediately. This is worth doing hands-on specifically because the `[]`-silently-creates-or-returns-null behavior is a genuinely easy trap to fall into when it's new, exactly the way Lesson 8.5's `operator[]` trap was for `std::unordered_map`.

## What this cost / bought us

This lesson built nothing conceptually new — every piece (HTTP via cpr, JSON parsing, `to_json`/`from_json` hooks, `std::optional`, prepared statements) was already yours. What it bought is the **named, complete pipeline shape** — request, response, parse, deserialize, each with its own distinct, independently-handled failure mode — which is worth recognizing as a template for essentially any real program that talks to the outside world, a category covering a large fraction of real, professional software.

---

**Design pattern: Repository — wrap your SQLite/JSON/CSV access behind one clean interface so the rest of your code doesn't care which storage backend it's talking to.** This is the pattern that ties "OOP interfaces" (Phase 4) directly to the practical file/DB work this entire phase has built.
