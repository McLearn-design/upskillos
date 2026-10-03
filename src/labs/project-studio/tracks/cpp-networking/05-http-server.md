---
title: 5 — An HTTP/1.1 Server
track: Networking
runtime: cpp
reference: optional
console: true
---

**HTTP** is the protocol of the web, and it runs on TCP. Its messages are plain text, which you can read and even type by hand. When a browser opens `http://127.0.0.1:8080/hello`, it connects and sends:

```text
GET /hello HTTP/1.1
Host: 127.0.0.1:8080
User-Agent: Mozilla/5.0 ...
Accept: text/html

```

and the server answers:

```text
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 26
Connection: close

<h1>Hello from C++</h1>
```

| Part | What it is |
|---|---|
| request line | method (`GET`), target (`/hello`), version |
| headers | `Name: value` lines; names ignore case |
| blank line | the end of the **head** |
| status line | version, status code (`200`, `404`, ...), reason phrase |
| `Content-Length` | how many bytes of body follow: HTTP's **length prefix** |

Every line ends in `\r\n` (carriage return, line feed), and a blank line ends the head: so the head's framing is a **delimiter**, `\r\n\r\n`, and the body's is a **length**. Both of lesson 3's ideas in one protocol.

You'll build the server in layers, each tested on its own: a parser (no network), responses and routing (no network), then the server, tested by a C++ client. At the end your browser will be the client.

## Step 1 — The interface

**This step: create the supplied `http/http.h` and read it.**

Notice what's separate:

- **`parse_request`** turns text into a `Request`. It knows nothing about sockets.
- **`handle`** decides the `Response` to a `Request`: the server's "application". It knows nothing about text formats or sockets.
- **`format_response`** turns a `Response` back into text.
- **`Server`** moves bytes: it reads a head, calls those three, and sends the result.

Each layer can be tested, and changed, without the others. `http::Server` has the same `port()`, `run()` and `stop()` as `ChatServer`, so `net::RunningServer` will run it in tests.

```cpp file=http/http.h provided
// http.h: a small HTTP/1.1 server.
#pragma once

#include <atomic>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "socket.h"

namespace http {

struct Request {
    std::string method;    // "GET"
    std::string target;    // "/index.html"
    std::string version;   // "HTTP/1.1"
    // Header names in lower case (HTTP ignores their case), with the
    // spaces around each value trimmed.
    std::vector<std::pair<std::string, std::string>> headers;

    // The value of the header with this name, in any case, or "".
    std::string header(std::string_view name) const;
};

// Parses a request's head: its request line and header lines, each
// ending in "\r\n", without the blank line that ends the head.
// Returns nothing if it isn't a valid HTTP/1.x request.
std::optional<Request> parse_request(std::string_view head);

struct Response {
    int status = 200;
    std::string content_type = "text/plain; charset=utf-8";
    std::string body;
};

// "OK", "Bad Request", "Not Found", "Method Not Allowed".
std::string reason_phrase(int status);

// The status line, headers (with Content-Length) and body, as sent.
std::string format_response(const Response& response);

// What this server answers to a request:
//   GET /       an HTML page
//   GET /agent  "you are using " + the User-Agent header
//   GET other   404, "not found: " + the target
//   not GET     405
Response handle(const Request& request);

// Serves one request per connection, one connection at a time.
class Server {
public:
    Server();                          // 127.0.0.1, any free port
    std::uint16_t port() const;
    void run();                        // until stop()
    void stop();                       // from any thread

private:
    void serve(net::Socket& client);

    net::Socket listener_;
    std::atomic<bool> stopping_{false};
};

} // namespace http
```

```check
file http/http.h
```

## Step 2 — The project's build file

**This step: create the supplied `http/CMakeLists.txt`.**

The same as `chat/`: every `.cpp` file in `http/` is part of the test program.

```cmake file=http/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(http LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Warnings for every program below.
if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# This folder, the shared net/ folder and the test framework.
include_directories(. ../net ../testing)

# Every program links Winsock on Windows, and the thread library
# (std::thread) everywhere.
find_package(Threads REQUIRED)
link_libraries(Threads::Threads)
if(WIN32)
    link_libraries(ws2_32)
endif()

# The http library: every .cpp file in this folder.
file(GLOB LIB_SOURCES CONFIGURE_DEPENDS *.cpp)

# Every tests/*_test.cpp file becomes part of the test program.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(http_tests ../testing/test_main.cpp ${TEST_SOURCES} ${LIB_SOURCES})
```

```check
file http/CMakeLists.txt
```

## Step 3 — The specification for the parser

**This step: create the supplied `http/tests/parse_test.cpp` and read it.**

The parser gets the head **without** its final blank line: the server will find the `\r\n\r\n`, and pass everything before it. So the last line has no `\r\n` at all.

Read `rejects_a_bad_request_line` carefully: two spaces in a row, a fourth word, a target without a leading `/`, and a version that isn't `HTTP/1.x` are all refused. A server that guesses what a malformed request meant is a server that can be tricked.

```cpp file=http/tests/parse_test.cpp provided
// Provided by the lesson: parse_request.
#include "studio_test.hpp"

#include <string>

#include "http.h"

TEST(parses_the_request_line)
{
    auto r = http::parse_request("GET /index.html HTTP/1.1");
    CHECK(r.has_value());
    CHECK_EQ(r->method, std::string("GET"));
    CHECK_EQ(r->target, std::string("/index.html"));
    CHECK_EQ(r->version, std::string("HTTP/1.1"));
    CHECK(r->headers.empty());
}

TEST(parses_headers)
{
    auto r = http::parse_request("GET / HTTP/1.1\r\n"
                                 "Host: example.com\r\n"
                                 "Accept: */*");
    CHECK(r.has_value());
    CHECK_EQ(r->headers.size(), 2u);
    CHECK_EQ(r->header("Host"), std::string("example.com"));
    CHECK_EQ(r->header("Accept"), std::string("*/*"));
}

TEST(header_names_ignore_case)
{
    auto r = http::parse_request("GET / HTTP/1.1\r\nUser-Agent: curl/8.5");
    CHECK(r.has_value());
    CHECK_EQ(r->header("user-agent"), std::string("curl/8.5"));
    CHECK_EQ(r->header("USER-AGENT"), std::string("curl/8.5"));
    CHECK_EQ(r->headers[0].first, std::string("user-agent"));
}

TEST(a_missing_header_is_empty)
{
    auto r = http::parse_request("GET / HTTP/1.1\r\nHost: a");
    CHECK(r.has_value());
    CHECK_EQ(r->header("Cookie"), std::string(""));
}

TEST(values_are_trimmed)
{
    auto r = http::parse_request("GET / HTTP/1.1\r\nHost:   spaced.org  ");
    CHECK(r.has_value());
    CHECK_EQ(r->header("Host"), std::string("spaced.org"));
}

TEST(a_value_can_contain_a_colon)
{
    auto r = http::parse_request("GET / HTTP/1.1\r\nHost: localhost:8080");
    CHECK(r.has_value());
    CHECK_EQ(r->header("Host"), std::string("localhost:8080"));
}

TEST(rejects_a_bad_request_line)
{
    CHECK(!http::parse_request("").has_value());
    CHECK(!http::parse_request("GET /").has_value());
    CHECK(!http::parse_request("GET  / HTTP/1.1").has_value());
    CHECK(!http::parse_request("GET / HTTP/1.1 extra").has_value());
    CHECK(!http::parse_request("GET index.html HTTP/1.1").has_value());
    CHECK(!http::parse_request("GET / SPDY/3").has_value());
}

TEST(rejects_a_header_without_a_name)
{
    CHECK(!http::parse_request("GET / HTTP/1.1\r\nno colon here").has_value());
    CHECK(!http::parse_request("GET / HTTP/1.1\r\n: no name").has_value());
}
```

```check
file http/tests/parse_test.cpp
```

## Step 4 — The parser

**This step: create `http/http.cpp` with `Request::header` and `parse_request`. Configure, build and run the tests.**

Work with `std::string_view` throughout: it's a pointer and a length, so taking pieces of the head with `substr` copies nothing.

1. **Split into lines** at each `"\r\n"`. Remember the last line has none.
2. **The request line** must have exactly two spaces. Find them with `find(' ')`, and `find(' ', first + 1)`, and make sure there's no third. The three parts must be non-empty, the target must start with `/`, and the version with `HTTP/1.`.
3. **Each header line** splits at its **first** colon. The name is everything before it, stored in lower case. The value is everything after it, with spaces and tabs trimmed from both ends. No colon, or nothing before it: invalid.
4. **`header(name)`** lowers `name` and looks for it.

Two helpers in an anonymous namespace keep `parse_request` readable:

```cpp
namespace {

std::string lower(std::string_view s)
{
    std::string out(s);
    for (char& c : out)
        c = static_cast<char>(
            std::tolower(static_cast<unsigned char>(c)));
    return out;
}

std::string_view trim(std::string_view s);   // you write this one

} // namespace
```

`std::tolower` is another place where a signed `char` bites: it's undefined for negative values other than `EOF`, so convert to `unsigned char` first.

```text
cmake -S http -B http/build -G "MinGW Makefiles"     (Windows)
cmake -S http -B http/build                          (macOS, Linux)
```

```text
cmake --build http/build
./http/build/http_tests
```

```cpp file=http/http.cpp
#include "http.h"

#include <cctype>
#include <cstddef>

namespace http {

namespace {

std::string lower(std::string_view s)
{
    std::string out(s);
    for (char& c : out)
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    return out;
}

std::string_view trim(std::string_view s)
{
    while (!s.empty() && (s.front() == ' ' || s.front() == '\t'))
        s.remove_prefix(1);
    while (!s.empty() && (s.back() == ' ' || s.back() == '\t'))
        s.remove_suffix(1);
    return s;
}

// Splits text into lines that end in "\r\n". The last line may lack
// one, since the head arrives without its final "\r\n\r\n".
std::vector<std::string_view> lines(std::string_view text)
{
    std::vector<std::string_view> out;
    while (!text.empty()) {
        std::size_t end = text.find("\r\n");
        out.push_back(text.substr(0, end));
        if (end == std::string_view::npos)
            break;
        text.remove_prefix(end + 2);
    }
    return out;
}

} // namespace

std::string Request::header(std::string_view name) const
{
    std::string wanted = lower(name);
    for (const auto& [n, value] : headers) {
        if (n == wanted)
            return value;
    }
    return "";
}

std::optional<Request> parse_request(std::string_view head)
{
    std::vector<std::string_view> all = lines(head);
    if (all.empty())
        return std::nullopt;

    // The request line: METHOD SP TARGET SP VERSION, single spaces.
    std::string_view line = all[0];
    std::size_t first = line.find(' ');
    std::size_t second = line.find(' ', first + 1);
    if (first == std::string_view::npos || second == std::string_view::npos ||
        line.find(' ', second + 1) != std::string_view::npos)
        return std::nullopt;
    Request r;
    r.method = line.substr(0, first);
    r.target = line.substr(first + 1, second - first - 1);
    r.version = line.substr(second + 1);
    if (r.method.empty() || r.target.empty() || r.target[0] != '/' ||
        r.version.rfind("HTTP/1.", 0) != 0)
        return std::nullopt;

    // Header lines: NAME ":" VALUE. Split at the FIRST colon only:
    // "Host: localhost:8080" has a colon in its value.
    for (std::size_t i = 1; i < all.size(); ++i) {
        std::size_t colon = all[i].find(':');
        if (colon == std::string_view::npos || colon == 0)
            return std::nullopt;
        r.headers.emplace_back(lower(all[i].substr(0, colon)),
                               std::string(trim(all[i].substr(colon + 1))));
    }
    return r;
}

} // namespace http
```

```check
file http/build/CMakeCache.txt label="http/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build http/build"
tests "./http/build/http_tests" require="parses_the_request_line parses_headers header_names_ignore_case values_are_trimmed a_value_can_contain_a_colon rejects_a_bad_request_line rejects_a_header_without_a_name" timeout=90 -- Split each header at its first colon, lower-case the name, and trim the value.
```

## Step 5 — Your tests for responses

**This step: create `http/tests/response_test.cpp` with four tests of your own for `format_response` and `handle`.**

Write them before the code, from the comments in `http.h`. Name them:

| Test | What it checks |
|---|---|
| `formats_a_response_with_content_length` | the exact text for `{200, "text/plain", "hi\n"}` |
| `the_home_page_is_html` | `GET /` is 200 with an HTML content type |
| `unknown_paths_are_404` | `GET /nope` is 404, with the body `not found: /nope` and a newline |
| `only_get_is_allowed` | `POST /` is 405 |

The exact text a response should have, with its blank line:

```text
HTTP/1.1 200 OK\r\n
Content-Type: text/plain\r\n
Content-Length: 3\r\n
Connection: close\r\n
\r\n
hi\n
```

`Content-Length: 3` counts **bytes**: `h`, `i` and the newline. `Connection: close` tells the client that the server will close the connection after this response, so the client knows the conversation is over.

The test program won't link until `format_response` and `handle` exist: next step.

```cpp file=http/tests/response_test.cpp
// My own tests for responses and routes.
#include "studio_test.hpp"

#include <string>

#include "http.h"

namespace {

http::Response get(const std::string& target)
{
    return http::handle(*http::parse_request("GET " + target + " HTTP/1.1"));
}

} // namespace

TEST(formats_a_response_with_content_length)
{
    http::Response r{200, "text/plain", "hi\n"};
    CHECK_EQ(http::format_response(r),
             std::string("HTTP/1.1 200 OK\r\n"
                         "Content-Type: text/plain\r\n"
                         "Content-Length: 3\r\n"
                         "Connection: close\r\n"
                         "\r\n"
                         "hi\n"));
}

TEST(the_home_page_is_html)
{
    http::Response r = get("/");
    CHECK_EQ(r.status, 200);
    CHECK(r.content_type.find("text/html") == 0);
}

TEST(unknown_paths_are_404)
{
    http::Response r = get("/nope");
    CHECK_EQ(r.status, 404);
    CHECK_EQ(r.body, std::string("not found: /nope\n"));
}

TEST(only_get_is_allowed)
{
    auto request = http::parse_request("POST / HTTP/1.1");
    CHECK_EQ(http::handle(*request).status, 405);
}
```

```check
matches http/tests/response_test.cpp "TEST\(\s*formats_a_response_with_content_length\s*\)" label="has the test formats_a_response_with_content_length"
matches http/tests/response_test.cpp "TEST\(\s*the_home_page_is_html\s*\)" label="has the test the_home_page_is_html"
matches http/tests/response_test.cpp "TEST\(\s*unknown_paths_are_404\s*\)" label="has the test unknown_paths_are_404"
matches http/tests/response_test.cpp "TEST\(\s*only_get_is_allowed\s*\)" label="has the test only_get_is_allowed"
```

## Step 6 — Responses and routes

**This step: add `reason_phrase`, `format_response` and `handle` to `http/http.cpp`. Build and run the tests.**

- **`reason_phrase`**: a `switch` on the status: 200 `OK`, 400 `Bad Request`, 404 `Not Found`, 405 `Method Not Allowed`, anything else `Unknown`.
- **`format_response`**: the status line and three headers, each ending in `"\r\n"`, then an empty line, then the body. `std::to_string(response.body.size())` is the length.
- **`handle`**: the routes in the comment in `http.h`. `Response` is an aggregate, so `return {404, "text/plain; charset=utf-8", "not found: " + request.target + "\n"};` builds one.

The home page is yours to write: any HTML will do, as long as it contains `<h1>Hello from C++</h1>` (a test in a later step looks for it).

```text
cmake --build http/build
./http/build/http_tests
```

```cpp file=http/http.cpp
#include "http.h"

#include <cctype>
#include <cstddef>

namespace http {

namespace {

std::string lower(std::string_view s)
{
    std::string out(s);
    for (char& c : out)
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    return out;
}

std::string_view trim(std::string_view s)
{
    while (!s.empty() && (s.front() == ' ' || s.front() == '\t'))
        s.remove_prefix(1);
    while (!s.empty() && (s.back() == ' ' || s.back() == '\t'))
        s.remove_suffix(1);
    return s;
}

// Splits text into lines that end in "\r\n". The last line may lack
// one, since the head arrives without its final "\r\n\r\n".
std::vector<std::string_view> lines(std::string_view text)
{
    std::vector<std::string_view> out;
    while (!text.empty()) {
        std::size_t end = text.find("\r\n");
        out.push_back(text.substr(0, end));
        if (end == std::string_view::npos)
            break;
        text.remove_prefix(end + 2);
    }
    return out;
}

} // namespace

std::string Request::header(std::string_view name) const
{
    std::string wanted = lower(name);
    for (const auto& [n, value] : headers) {
        if (n == wanted)
            return value;
    }
    return "";
}

std::optional<Request> parse_request(std::string_view head)
{
    std::vector<std::string_view> all = lines(head);
    if (all.empty())
        return std::nullopt;

    // The request line: METHOD SP TARGET SP VERSION, single spaces.
    std::string_view line = all[0];
    std::size_t first = line.find(' ');
    std::size_t second = line.find(' ', first + 1);
    if (first == std::string_view::npos || second == std::string_view::npos ||
        line.find(' ', second + 1) != std::string_view::npos)
        return std::nullopt;
    Request r;
    r.method = line.substr(0, first);
    r.target = line.substr(first + 1, second - first - 1);
    r.version = line.substr(second + 1);
    if (r.method.empty() || r.target.empty() || r.target[0] != '/' ||
        r.version.rfind("HTTP/1.", 0) != 0)
        return std::nullopt;

    // Header lines: NAME ":" VALUE. Split at the FIRST colon only:
    // "Host: localhost:8080" has a colon in its value.
    for (std::size_t i = 1; i < all.size(); ++i) {
        std::size_t colon = all[i].find(':');
        if (colon == std::string_view::npos || colon == 0)
            return std::nullopt;
        r.headers.emplace_back(lower(all[i].substr(0, colon)),
                               std::string(trim(all[i].substr(colon + 1))));
    }
    return r;
}

std::string reason_phrase(int status)
{
    switch (status) {
    case 200: return "OK";
    case 400: return "Bad Request";
    case 404: return "Not Found";
    case 405: return "Method Not Allowed";
    default: return "Unknown";
    }
}

std::string format_response(const Response& response)
{
    // Content-Length counts bytes, not characters: body.size().
    return "HTTP/1.1 " + std::to_string(response.status) + " " +
           reason_phrase(response.status) + "\r\n" +
           "Content-Type: " + response.content_type + "\r\n" +
           "Content-Length: " + std::to_string(response.body.size()) + "\r\n" +
           "Connection: close\r\n" +
           "\r\n" + response.body;
}

Response handle(const Request& request)
{
    if (request.method != "GET")
        return {405, "text/plain; charset=utf-8", "only GET is allowed\n"};
    if (request.target == "/")
        return {200, "text/html; charset=utf-8",
                "<!doctype html>\n<title>C++ server</title>\n"
                "<h1>Hello from C++</h1>\n"
                "<p>This page came from your own HTTP server.</p>\n"};
    if (request.target == "/agent")
        return {200, "text/plain; charset=utf-8",
                "you are using " + request.header("User-Agent") + "\n"};
    return {404, "text/plain; charset=utf-8",
            "not found: " + request.target + "\n"};
}

} // namespace http
```

```check
run "cmake --build http/build"
tests "./http/build/http_tests" require="formats_a_response_with_content_length the_home_page_is_html unknown_paths_are_404 only_get_is_allowed" timeout=90 -- Every header line ends in \r\n, and one more \r\n comes before the body.
```

## Step 7 — The specification for the server

**This step: create the supplied `http/tests/server_test.cpp` and read it.**

These tests are an HTTP **client** in C++: `fetch` connects, sends a request, and reads until the server closes the connection. That's how a client knows the response is complete when the server says `Connection: close`. A client that wanted to keep the connection open would read the head, then exactly `Content-Length` bytes.

- `a_head_in_pieces_is_put_together` sends one request in four `send`s. Whether they arrive as four pieces or one, the server must handle it.
- `a_client_that_gives_up_does_not_stop_the_server` connects, sends half a request, and leaves. The server must shrug and serve the next client.

```cpp file=http/tests/server_test.cpp provided
// Provided by the lesson: the server, with a C++ client.
#include "studio_test.hpp"

#include <string>

#include "http.h"
#include "tcp.h"
#include "test_client.h"

using Running = net::RunningServer<http::Server>;

namespace {

// Sends raw bytes and returns everything the server sends back
// before it closes the connection.
std::string fetch(std::uint16_t port, const std::string& request)
{
    net::Socket s = net::connect_loopback(port);
    net::set_receive_timeout(s, 5000);
    net::send_all(s, request);
    std::string response;
    char buffer[4096];
    long got;
    while ((got = net::recv_some(s, buffer, sizeof buffer)) > 0)
        response.append(buffer, static_cast<std::size_t>(got));
    return response;
}

std::string get(std::uint16_t port, const std::string& target)
{
    return fetch(port, "GET " + target + " HTTP/1.1\r\n"
                       "Host: localhost\r\n"
                       "User-Agent: studio-test\r\n\r\n");
}

bool starts_with(const std::string& s, const std::string& prefix)
{
    return s.rfind(prefix, 0) == 0;
}

} // namespace

TEST(serves_the_home_page)
{
    net::Startup startup;
    Running server;
    std::string r = get(server.port(), "/");
    CHECK(starts_with(r, "HTTP/1.1 200 OK\r\n"));
    CHECK(r.find("Content-Type: text/html") != std::string::npos);
    CHECK(r.find("<h1>Hello from C++</h1>") != std::string::npos);
}

TEST(content_length_matches_the_body)
{
    net::Startup startup;
    Running server;
    std::string r = get(server.port(), "/agent");
    std::size_t blank = r.find("\r\n\r\n");
    CHECK(blank != std::string::npos);
    std::string body = r.substr(blank + 4);
    CHECK_EQ(body, std::string("you are using studio-test\n"));
    CHECK(r.find("Content-Length: " + std::to_string(body.size()) + "\r\n")
          != std::string::npos);
}

TEST(answers_404_for_unknown_paths)
{
    net::Startup startup;
    Running server;
    CHECK(starts_with(get(server.port(), "/missing"),
                      "HTTP/1.1 404 Not Found\r\n"));
}

TEST(answers_400_to_nonsense)
{
    net::Startup startup;
    Running server;
    CHECK(starts_with(fetch(server.port(), "hello?\r\n\r\n"),
                      "HTTP/1.1 400 Bad Request\r\n"));
}

TEST(a_head_in_pieces_is_put_together)
{
    net::Startup startup;
    Running server;
    net::Socket s = net::connect_loopback(server.port());
    net::set_receive_timeout(s, 5000);
    const char* pieces[] = {"GET /ag", "ent HTTP/1.1\r", "\nUser-Agent: x\r\n",
                            "\r\n"};
    for (const char* piece : pieces)
        net::send_all(s, piece);
    std::string response;
    char buffer[4096];
    long got;
    while ((got = net::recv_some(s, buffer, sizeof buffer)) > 0)
        response.append(buffer, static_cast<std::size_t>(got));
    CHECK(response.find("you are using x\n") != std::string::npos);
}

TEST(serves_one_client_after_another)
{
    net::Startup startup;
    Running server;
    for (int i = 0; i < 3; ++i)
        CHECK(starts_with(get(server.port(), "/"), "HTTP/1.1 200 OK\r\n"));
}

TEST(a_client_that_gives_up_does_not_stop_the_server)
{
    net::Startup startup;
    Running server;
    {
        net::Socket quitter = net::connect_loopback(server.port());
        net::send_all(quitter, "GET / HTT");
    }   // closed before finishing its request
    CHECK(starts_with(get(server.port(), "/"), "HTTP/1.1 200 OK\r\n"));
}
```

```check
file http/tests/server_test.cpp
```

## Step 8 — The server

**This step: create `http/http_server.cpp` with `http::Server`. Build and run the tests.**

The constructor, `port` and `stop` are as in `ChatServer`. The rest, without code this time:

- **`run`**: while not stopping, `poll` just the listener with a 50 ms timeout. When it's ready, `accept_client`, `serve` that one client, and let its `Socket` close at the end of the loop body.
- **`serve(client)`**:
  1. Set a 5-second receive timeout on the client, so a client that stops halfway can't freeze the server.
  2. `recv_some` and append to a string until it contains `"\r\n\r\n"`. If the client closes or times out first, return: there's nobody to answer. If more than 8 KB arrive without a blank line, answer 400 and return.
  3. Parse **everything before** the `"\r\n\r\n"`. Not including it: the parser would see empty header lines and reject the request.
  4. `send_all` the formatted response: `handle`'s, or a 400 if parsing failed.

This server handles one connection at a time, like lesson 2's. With `Connection: close` and tiny pages, that's fine for a lesson; lesson 4's event loop is how you'd lift that limit.

```text
cmake --build http/build
./http/build/http_tests
```

```cpp file=http/http_server.cpp
#include <cstddef>
#include <string>

#include "http.h"
#include "poller.h"
#include "tcp.h"

namespace http {

Server::Server() : listener_(net::listen_loopback()) {}

std::uint16_t Server::port() const
{
    return net::local_port(listener_);
}

void Server::stop()
{
    stopping_ = true;
}

void Server::run()
{
    while (!stopping_) {
        // Wait at most 50 ms for a client, then look at stopping_.
        net::PollFd fd = net::watch(listener_);
        if (net::poll(&fd, 1, 50) <= 0)
            continue;
        net::Socket client = net::accept_client(listener_);
        serve(client);
    }   // client closes here: "Connection: close"
}

void Server::serve(net::Socket& client)
{
    // A client that stops sending mid-request mustn't freeze the
    // server forever: give up on it after 5 seconds.
    net::set_receive_timeout(client, 5000);

    // Read until the blank line that ends the head. It can arrive in
    // any number of pieces.
    std::string received;
    std::size_t end;
    while ((end = received.find("\r\n\r\n")) == std::string::npos) {
        if (received.size() > 8192) {
            net::send_all(client, format_response(
                {400, "text/plain; charset=utf-8", "head too large\n"}));
            return;
        }
        char buffer[4096];
        long got = net::recv_some(client, buffer, sizeof buffer);
        if (got <= 0)
            return;   // gone, or too slow: nobody to answer
        received.append(buffer, static_cast<std::size_t>(got));
    }

    auto request = parse_request(std::string_view(received).substr(0, end));
    Response response = request
        ? handle(*request)
        : Response{400, "text/plain; charset=utf-8", "bad request\n"};
    net::send_all(client, format_response(response));
}

} // namespace http
```

```check
run "cmake --build http/build"
tests "./http/build/http_tests" require="serves_the_home_page content_length_matches_the_body answers_404_for_unknown_paths answers_400_to_nonsense a_head_in_pieces_is_put_together a_client_that_gives_up_does_not_stop_the_server" timeout=90 -- Keep reading until the received text contains \r\n\r\n, and parse only what comes before it.
```

## Step 9 — Your browser as the client

**This step: create the supplied `http/apps/serve.cpp`, add an `http_server` program to `http/CMakeLists.txt`, build it, and visit it.**

```cmake
add_executable(http_server apps/serve.cpp ${LIB_SOURCES})
```

```text
cmake --build http/build
./http/build/http_server
serving http://127.0.0.1:50817/
```

Open that address in a browser: it's your page, from your server. Try `/agent` and a path that doesn't exist. Then, in a second terminal, use **curl**, which comes with macOS, Windows 10 and later, and most Linux systems. `-i` shows the head as well as the body:

```text
curl -i http://127.0.0.1:50817/agent
curl -i -X POST http://127.0.0.1:50817/
```

> On Windows, use `curl.exe` in PowerShell: plain `curl` may be an alias for `Invoke-WebRequest`, which shows its output differently.

The browser may make a second request you didn't ask for: `GET /favicon.ico`, for the tab's icon. Your server answers 404, and the browser shrugs. Stop the server with Ctrl+C.

```cpp file=http/apps/serve.cpp provided
// The HTTP server as a program. Open the address it prints in a
// browser, or use curl. Stop it with Ctrl+C.
#include <iostream>

#include "http.h"

int main()
{
    net::Startup startup;
    http::Server server;
    std::cout << "serving http://127.0.0.1:" << server.port() << "/"
              << std::endl;
    server.run();
}
```

```check
contains http/CMakeLists.txt "add_executable(http_server apps/serve.cpp ${LIB_SOURCES})" -- Add add_executable(http_server apps/serve.cpp ${LIB_SOURCES}) to the end of http/CMakeLists.txt.
run "cmake --build http/build"
```
