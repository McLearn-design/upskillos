---
title: 2 — A TCP Echo Server and Client
track: Networking
runtime: cpp
reference: optional
console: true
---

An **echo server** sends back every byte it receives. It's the "hello world" of networking: small enough to write in a lesson, but it has every part of a real server.

A TCP connection takes a few calls on each side to set up:

| Server | Client |
|---|---|
| `socket`: get a socket | `socket` |
| `bind`: choose its address | |
| `listen`: accept connections | |
| `accept`: wait for a client; returns a **new** socket for it | `connect`: reach the server |
| `recv` / `send` | `send` / `recv` |
| `close` | `close` |

The server ends up with two kinds of socket: the **listening** socket, which only accepts, and one **connected** socket per client, which carries that client's bytes.

Then there's the part that catches everyone. TCP is a **stream of bytes**, not a series of messages:

- `send` may accept **fewer** bytes than you gave it, when its buffer is full. The rest is your job.
- `recv` returns **whatever has arrived so far**: part of what the other side sent, or two sends at once. "hello" can arrive as "hel" and "lo".

On the loopback this almost never happens with small messages, which is exactly why code that ignores it passes every test on your machine and then fails on a real network. This lesson handles it properly, and tests it in a way that doesn't depend on luck.

## Step 1 — Listen, accept, connect

**This step: create `net/tcp.h` with three functions: `listen_loopback`, `accept_client` and `connect_loopback`.**

```cpp
// A listening socket on 127.0.0.1 and a port the system picks.
inline Socket listen_loopback()
{
    Socket s = open_socket(SOCK_STREAM);
    bind_loopback(s, 0);
    if (::listen(s.get(), SOMAXCONN) != 0)
        fail("listen");
    return s;
}
```

- `SOCK_STREAM` is TCP; `SOCK_DGRAM` was UDP.
- `::listen`'s second argument is the **backlog**: how many connections the system will complete and queue up before you `accept` them. `SOMAXCONN` asks for the system's maximum.
- **Port 0, again.** Tests must never use a fixed port: two test runs at once, or any other program on that port, would make them fail for reasons that have nothing to do with your code. Port 0 can't clash, and `local_port` tells the client where to connect.
- `return s;` **moves** the `Socket` out: it can't be copied, and doesn't need to be.

`accept_client(listener)` wraps `::accept(listener.get(), nullptr, nullptr)` (the two `nullptr`s say "I don't need the client's address") in a `Socket`, and calls `fail("accept")` if it isn't valid. `connect_loopback(port)` opens a TCP socket and calls `::connect` with `loopback(port)`, cast to `sockaddr*` as with `sendto`.

Mark every function `inline`, as in `socket.h`: a function **defined** in a header is compiled into every `.cpp` file that includes it, and `inline` tells the linker those copies are the same function.

Nothing uses these yet. The tests arrive with the next functions.

```cpp file=net/tcp.h
// tcp.h: TCP connections.
#pragma once

#include <cstdint>

#include "socket.h"

namespace net {

// A listening socket on 127.0.0.1 and a port the system picks.
// Read the port back with local_port().
inline Socket listen_loopback()
{
    Socket s = open_socket(SOCK_STREAM);
    bind_loopback(s, 0);
    if (::listen(s.get(), SOMAXCONN) != 0)
        fail("listen");
    return s;
}

// Waits for the next client and returns the socket connected to it.
inline Socket accept_client(const Socket& listener)
{
    Socket client(::accept(listener.get(), nullptr, nullptr));
    if (!client.valid())
        fail("accept");
    return client;
}

// Connects to 127.0.0.1:port.
inline Socket connect_loopback(std::uint16_t port)
{
    Socket s = open_socket(SOCK_STREAM);
    sockaddr_in a = loopback(port);
    if (::connect(s.get(), reinterpret_cast<sockaddr*>(&a), sizeof a) != 0)
        fail("connect");
    return s;
}

} // namespace net
```

```check
matches net/tcp.h "::listen\s*\(" label="listen_loopback calls ::listen"
matches net/tcp.h "::accept\s*\(" label="accept_client calls ::accept"
matches net/tcp.h "::connect\s*\(" label="connect_loopback calls ::connect"
```

## Step 2 — The specification for whole messages

**This step: create the supplied `echo/tests/stream_test.cpp` and read it.**

You're about to write `write_all` and `read_exact`: loops that keep calling `send` or `recv` until **all** the bytes have gone, or arrived. How do you test that, when a real loopback socket nearly always moves everything in one call?

You take the socket out of the picture. `write_all` won't call `send` directly; it calls a function you pass in, `write_some`. Real code passes one that calls `send`. The tests pass **fakes**:

- `TrickleWriter` accepts at most 3 bytes per call, like a busy socket.
- `TrickleReader` hands out at most 2 bytes per call, then returns `0`: "the other side closed".

Now partial writes and reads happen on **every** call, deterministically. A `write_all` that sends once and hopes fails every time, instead of once a month in production. Writing code so its outside world can be swapped for a fake is the main trick for testing anything that touches a network, a disk or a clock.

```cpp file=echo/tests/stream_test.cpp provided
// Provided by the lesson: write_all and read_exact, without a network.
//
// A real socket hands over fewer bytes than asked for only now and
// then, so a bug that ignores it can pass a hundred tests and fail in
// production. These fakes do it on every call.
#include "studio_test.hpp"

#include <cstddef>
#include <string>

#include "tcp.h"

namespace {

// Accepts at most 3 bytes per call, like a busy socket.
struct TrickleWriter {
    std::string written;
    int calls = 0;
    long operator()(const char* data, std::size_t n)
    {
        ++calls;
        std::size_t take = n < 3 ? n : 3;
        written.append(data, take);
        return static_cast<long>(take);
    }
};

// Hands out its input at most 2 bytes per call, then 0: closed.
struct TrickleReader {
    std::string input;
    std::size_t pos = 0;
    long operator()(char* out, std::size_t n)
    {
        std::size_t left = input.size() - pos;
        std::size_t take = n < 2 ? n : 2;
        if (take > left)
            take = left;
        input.copy(out, take, pos);
        pos += take;
        return static_cast<long>(take);
    }
};

} // namespace

TEST(write_all_keeps_going_after_a_short_write)
{
    TrickleWriter w;
    std::string msg = "hello, network";
    CHECK(net::write_all([&](const char* p, std::size_t n) { return w(p, n); },
                         msg.data(), msg.size()));
    CHECK_EQ(w.written, msg);
    CHECK_EQ(w.calls, 5);
}

TEST(write_all_stops_on_failure)
{
    auto broken = [](const char*, std::size_t) { return -1L; };
    CHECK(!net::write_all(broken, "abc", 3));
}

TEST(read_exact_keeps_going_after_a_short_read)
{
    TrickleReader r{"hello, network"};
    char buf[5];
    CHECK(net::read_exact([&](char* p, std::size_t n) { return r(p, n); },
                          buf, 5));
    CHECK_EQ(std::string(buf, 5), std::string("hello"));
    CHECK_EQ(r.pos, 5u);   // it read no more than it was asked for
}

TEST(read_exact_reports_a_close_in_the_middle)
{
    TrickleReader r{"abc"};
    char buf[5];
    CHECK(!net::read_exact([&](char* p, std::size_t n) { return r(p, n); },
                           buf, 5));
}

TEST(read_exact_reports_an_error)
{
    auto broken = [](char*, std::size_t) { return -1L; };
    char buf[4];
    CHECK(!net::read_exact(broken, buf, 4));
}
```

```check
file echo/tests/stream_test.cpp
```

## Step 3 — The project's build file

**This step: create the supplied `echo/CMakeLists.txt`.**

Compared with `basics/`:

- `include_directories(. ../net ../testing)`: this folder, the socket layer and the test framework.
- `find_package(Threads REQUIRED)` and `link_libraries(Threads::Threads)`: the tests will run a server on a second thread, and `std::thread` needs the system's thread library on some platforms. `Threads::Threads` is CMake's portable name for it.
- The test program is `test_main.cpp` plus every `tests/*_test.cpp`. The echo server itself will be a header, so there's nothing else to compile.

```cmake file=echo/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(echo LANGUAGES CXX)

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

# Every tests/*_test.cpp file becomes part of the test program.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(echo_tests ../testing/test_main.cpp ${TEST_SOURCES})
```

```check
file echo/CMakeLists.txt
```

## Step 4 — write_all and read_exact

**This step: add `write_all`, `read_exact`, `send_all` and `recv_exact` to `net/tcp.h`. Configure, build and run the tests.**

```cpp
// Calls write_some(data, n) until all n bytes are written.
template <typename WriteSome>
bool write_all(WriteSome write_some, const char* data, std::size_t n)
{
    while (n > 0) {
        long sent = write_some(data, n);
        if (sent <= 0)
            return false;
        data += sent;    // skip what went
        n -= static_cast<std::size_t>(sent);
    }
    return true;
}
```

- It's a **template**, so `write_some` can be anything callable: a fake from the tests, or a lambda that calls `send_some`.
- `read_exact(read_some, out, n)` has the same shape. `read_some` returns `0` when the other side has **closed** the connection, and `-1` on an error. Either way, the `n` bytes will never come: return `false`.
- Then the socket versions are two lambdas away:

```cpp
inline bool send_all(const Socket& s, std::string_view data)
{
    auto write_some = [&](const char* p, std::size_t n) {
        return send_some(s, p, n);
    };
    return write_all(write_some, data.data(), data.size());
}
```

`recv_exact(const Socket& s, char* out, std::size_t n)` is the same, with `read_exact` and `recv_some`. Add `#include <cstddef>`, `<string>` and `<string_view>`.

```text
cmake -S echo -B echo/build -G "MinGW Makefiles"     (Windows)
cmake -S echo -B echo/build                          (macOS, Linux)
```

```text
cmake --build echo/build
./echo/build/echo_tests
```

```cpp file=net/tcp.h
// tcp.h: TCP connections, and sending and receiving whole messages.
#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>

#include "socket.h"

namespace net {

// A listening socket on 127.0.0.1 and a port the system picks.
// Read the port back with local_port().
inline Socket listen_loopback()
{
    Socket s = open_socket(SOCK_STREAM);
    bind_loopback(s, 0);
    if (::listen(s.get(), SOMAXCONN) != 0)
        fail("listen");
    return s;
}

// Waits for the next client and returns the socket connected to it.
inline Socket accept_client(const Socket& listener)
{
    Socket client(::accept(listener.get(), nullptr, nullptr));
    if (!client.valid())
        fail("accept");
    return client;
}

// Connects to 127.0.0.1:port.
inline Socket connect_loopback(std::uint16_t port)
{
    Socket s = open_socket(SOCK_STREAM);
    sockaddr_in a = loopback(port);
    if (::connect(s.get(), reinterpret_cast<sockaddr*>(&a), sizeof a) != 0)
        fail("connect");
    return s;
}

// Calls write_some(data, n) until all n bytes are written.
// write_some returns how many bytes it wrote, or <= 0 on failure.
template <typename WriteSome>
bool write_all(WriteSome write_some, const char* data, std::size_t n)
{
    while (n > 0) {
        long sent = write_some(data, n);
        if (sent <= 0)
            return false;
        data += sent;
        n -= static_cast<std::size_t>(sent);
    }
    return true;
}

// Calls read_some(out, n) until exactly n bytes have arrived.
// read_some returns how many bytes it read: 0 when the other side
// has closed, < 0 on failure. Either way, read_exact returns false.
template <typename ReadSome>
bool read_exact(ReadSome read_some, char* out, std::size_t n)
{
    while (n > 0) {
        long got = read_some(out, n);
        if (got <= 0)
            return false;
        out += got;
        n -= static_cast<std::size_t>(got);
    }
    return true;
}

inline bool send_all(const Socket& s, std::string_view data)
{
    auto write_some = [&](const char* p, std::size_t n) {
        return send_some(s, p, n);
    };
    return write_all(write_some, data.data(), data.size());
}

inline bool recv_exact(const Socket& s, char* out, std::size_t n)
{
    auto read_some = [&](char* p, std::size_t len) {
        return recv_some(s, p, len);
    };
    return read_exact(read_some, out, n);
}

} // namespace net
```

```check
file echo/build/CMakeCache.txt label="echo/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build echo/build" -- write_all and read_exact are templates: define them in the header, before send_all and recv_exact use them.
tests "./echo/build/echo_tests" require="write_all_keeps_going_after_a_short_write read_exact_keeps_going_after_a_short_read read_exact_reports_a_close_in_the_middle" timeout=90 -- Loop while bytes remain: after each call, move the pointer forward and subtract what was moved. Stop with false on 0 or less.
```

## Step 5 — A server inside a test

**This step: create the supplied `net/background.h` and read it.**

To test a server, you need a server **and** a client, running at the same time. The simplest way: one test program, with the server on a second **thread** and the client on the test's own thread.

`std::thread` has a trap for tests. If a `std::thread` object is destroyed while its thread could still be running, the program calls `std::terminate`: it crashes. And a failing `CHECK` **throws**, so it skips any `join()` written after it.

`net::Background` is RAII for a thread: its destructor waits (`join`) for the thread to finish, whichever way the scope ends.

Then the order of declarations matters, because objects are destroyed in **reverse** order:

```cpp
EchoServer server;
net::Background serving([&] { server.serve_one(); });
net::Socket client = net::connect_loopback(server.port());
// ... at the end: client closes first, so serve_one sees the
// client leave and returns, then serving joins the thread.
```

Declare them the other way round, and `serving`'s destructor would wait for a server that is waiting for the client to leave: the test would hang forever.

```cpp file=net/background.h provided
// background.h: run a function on another thread for a test.
#pragma once

#include <thread>
#include <utility>

namespace net {

// Starts f on a new thread, and waits for it to finish when the
// Background object is destroyed: at the end of the scope, or when a
// failing CHECK throws out of the test. A plain std::thread that is
// still joinable when destroyed calls std::terminate instead.
//
// Declare it BEFORE the client sockets the thread is waiting on:
// objects are destroyed in reverse order, so the sockets close first,
// the server sees its clients leave, and the join can finish.
class Background {
public:
    template <typename F>
    explicit Background(F f) : thread_(std::move(f)) {}
    ~Background()
    {
        if (thread_.joinable())
            thread_.join();
    }
    Background(const Background&) = delete;
    Background& operator=(const Background&) = delete;

private:
    std::thread thread_;
};

} // namespace net
```

```check
file net/background.h
```

## Step 6 — The specification for the echo server

**This step: create the supplied `echo/tests/echo_test.cpp` and read it.**

Each test starts a real `EchoServer` on a free port, serves it on a `Background` thread, and connects a real client over the loopback.

- Every client calls `net::set_receive_timeout(client, 5000)`. If the server is broken and never answers, `recv_exact` fails after 5 seconds, the `CHECK` fails, and the test ends. Without the timeout, a broken server would hang the test program forever.
- `echoes_every_message_until_the_client_leaves` sends three messages on one connection, the last of 20,000 bytes.
- `serves_clients_one_after_another` calls `serve_one` twice.

The test program won't build until `echo_server.h` exists.

```cpp file=echo/tests/echo_test.cpp provided
// Provided by the lesson: a real server and a real client, in one
// process, over the loopback.
#include "studio_test.hpp"

#include <string>

#include "background.h"
#include "echo_server.h"
#include "tcp.h"

namespace {

// Sends text and reads back exactly as many bytes.
std::string round_trip(const net::Socket& client, const std::string& text)
{
    if (!net::send_all(client, text))
        return "<send failed>";
    std::string reply(text.size(), '\0');
    if (!net::recv_exact(client, reply.data(), reply.size()))
        return "<no reply>";
    return reply;
}

} // namespace

TEST(server_listens_on_a_real_port)
{
    net::Startup startup;
    EchoServer server;
    CHECK(server.port() != 0);
}

TEST(echoes_one_message)
{
    net::Startup startup;
    EchoServer server;
    net::Background serving([&] { server.serve_one(); });

    net::Socket client = net::connect_loopback(server.port());
    net::set_receive_timeout(client, 5000);
    CHECK_EQ(round_trip(client, "hello"), std::string("hello"));
}   // client closes, serve_one returns, serving joins

TEST(echoes_every_message_until_the_client_leaves)
{
    net::Startup startup;
    EchoServer server;
    net::Background serving([&] { server.serve_one(); });

    net::Socket client = net::connect_loopback(server.port());
    net::set_receive_timeout(client, 5000);
    CHECK_EQ(round_trip(client, "one"), std::string("one"));
    CHECK_EQ(round_trip(client, "two, three"), std::string("two, three"));
    std::string big(20000, 'x');
    CHECK(round_trip(client, big) == big);
}

TEST(serves_clients_one_after_another)
{
    net::Startup startup;
    EchoServer server;
    net::Background serving([&] {
        server.serve_one();
        server.serve_one();
    });

    for (std::string name : {"first", "second"}) {
        net::Socket client = net::connect_loopback(server.port());
        net::set_receive_timeout(client, 5000);
        CHECK_EQ(round_trip(client, name), name);
    }
}
```

```check
file echo/tests/echo_test.cpp
```

## Step 7 — The echo server

**This step: create `echo/echo_server.h` with the `EchoServer` class. Build and run the tests.**

```cpp
class EchoServer {
public:
    // Listens on 127.0.0.1, on a port the system picks.
    EchoServer() : listener_(net::listen_loopback()) {}

    std::uint16_t port() const { return net::local_port(listener_); }

    // Waits for one client, and echoes everything it sends until it
    // closes the connection.
    void serve_one();

private:
    net::Socket listener_;
};
```

Write `serve_one` inside the class. It accepts a client, then loops:

1. `recv_some` into a `char buffer[4096]`.
2. `0` or less: the client closed (or failed), so return. The client's `Socket` closes itself.
3. Otherwise `send_all` back **exactly the `got` bytes received**: `std::string_view data(buffer, got)`. Not the whole buffer, and not `recv_exact`: an echo server can't know how many bytes to wait for.

**Predict:** the client sends 20,000 bytes in one `send_all`. How many times will the server go round its loop?

```text
cmake --build echo/build
./echo/build/echo_tests
```

> To watch it, set a breakpoint on `EchoServer::serve_one` and run `echo_tests` in the debugger. When it stops, list the threads (`thread list` in lldb, `info threads` in gdb): the test is on one, the server on another.

```cpp file=echo/echo_server.h
// echo_server.h: a TCP server that sends back whatever it receives.
#pragma once

#include <cstddef>
#include <cstdint>
#include <string_view>

#include "socket.h"
#include "tcp.h"

class EchoServer {
public:
    // Listens on 127.0.0.1, on a port the system picks.
    EchoServer() : listener_(net::listen_loopback()) {}

    std::uint16_t port() const { return net::local_port(listener_); }

    // Waits for one client, and echoes everything it sends until it
    // closes the connection.
    void serve_one()
    {
        net::Socket client = net::accept_client(listener_);
        char buffer[4096];
        while (true) {
            long got = net::recv_some(client, buffer, sizeof buffer);
            if (got <= 0)
                return;   // 0: the client closed; < 0: an error
            std::string_view data(buffer, static_cast<std::size_t>(got));
            if (!net::send_all(client, data))
                return;
        }
    }

private:
    net::Socket listener_;
};
```

### What happened

All the tests pass, and the answer to the prediction is "it depends": the loop runs as many times as `recv_some` returns pieces. With a 4,096-byte buffer, 20,000 bytes take at least 5 calls, and often more, depending on how the system happens to split them. Your server doesn't care, because it never assumed a message arrives in one piece.

```check
run "cmake --build echo/build" -- Include socket.h and tcp.h, and define serve_one inside the class.
tests "./echo/build/echo_tests" require="echoes_one_message echoes_every_message_until_the_client_leaves serves_clients_one_after_another" timeout=90 -- Echo exactly the bytes recv_some returned, and keep looping until it returns 0 or less.
```

## Step 8 — The server as a program

**This step: create the supplied `echo/apps/server.cpp`, add an `echo_server` program to `echo/CMakeLists.txt`, and build it.**

```cmake
add_executable(echo_server apps/server.cpp)
```

The program calls `serve_one` forever, printing a line each time a client leaves. Don't run it yet: the next step writes a client for it.

```cpp file=echo/apps/server.cpp provided
// The echo server as a program: serves clients one at a time, forever.
// Stop it with Ctrl+C.
#include <iostream>

#include "echo_server.h"

int main()
{
    net::Startup startup;
    EchoServer server;
    std::cout << "echo server on 127.0.0.1:" << server.port() << std::endl;
    while (true) {
        server.serve_one();
        std::cout << "a client left" << std::endl;
    }
}
```

```check
contains echo/CMakeLists.txt "add_executable(echo_server apps/server.cpp)" -- Add add_executable(echo_server apps/server.cpp) to the end of echo/CMakeLists.txt.
run "cmake --build echo/build"
```

## Step 9 — A client, and two terminals

**This step: create `echo/apps/client.cpp`: `echo_client PORT` connects to `127.0.0.1:PORT`, sends each line you type, and prints the echo. Add it to `echo/CMakeLists.txt` and build.**

```cmake
add_executable(echo_client apps/client.cpp)
```

- With the wrong number of arguments, print `usage: echo_client PORT` to `std::cerr` and return `2`.
- `std::stoi(argv[1])` turns the port into a number; cast it to `std::uint16_t`.
- For each line from `std::getline`, add back the `'\n'` that `getline` removed, `send_all` it, and `recv_exact` the same number of bytes.
- Put the work in a `try` block: `connect_loopback` throws if nobody is listening.

Now try it, in **two terminals** in the track folder:

```text
./echo/build/echo_server            (terminal 1)
echo server on 127.0.0.1:52344

./echo/build/echo_client 52344      (terminal 2, with that port)
```

Type a few lines into the client; end it with Ctrl+D (on Windows, Ctrl+Z then Enter). The server prints `a client left`. Stop the server with Ctrl+C.

**Experiment:** start **two** clients against one server. The second one connects (the system completes the connection and queues it) but gets no echo until the first one leaves: `serve_one` serves one client at a time. Lesson 4 fixes that.

```cpp file=echo/apps/client.cpp
// echo_client PORT: sends each line you type to the echo server on
// 127.0.0.1:PORT and prints what comes back.
#include <cstdint>
#include <iostream>
#include <stdexcept>
#include <string>

#include "socket.h"
#include "tcp.h"

int main(int argc, char* argv[])
{
    if (argc != 2) {
        std::cerr << "usage: echo_client PORT\n";
        return 2;
    }
    try {
        net::Startup startup;
        auto port = static_cast<std::uint16_t>(std::stoi(argv[1]));
        net::Socket server = net::connect_loopback(port);
        net::set_receive_timeout(server, 5000);
        std::cout << "connected; type lines, end with Ctrl+D "
                     "(Ctrl+Z then Enter on Windows)\n";

        std::string line;
        while (std::getline(std::cin, line)) {
            line += '\n';
            std::string reply(line.size(), '\0');
            if (!net::send_all(server, line) ||
                !net::recv_exact(server, reply.data(), reply.size())) {
                std::cout << "the server went away\n";
                return 1;
            }
            std::cout << "echo: " << reply;
        }
    } catch (const std::exception& e) {
        std::cerr << e.what() << '\n';
        return 1;
    }
}
```

```check
contains echo/CMakeLists.txt "add_executable(echo_client apps/client.cpp)" -- Add add_executable(echo_client apps/client.cpp) to the end of echo/CMakeLists.txt.
run "cmake --build echo/build"
run "./echo/build/echo_client" exit=2 stderr="usage: echo_client PORT" -- With no port, print the usage line to std::cerr and return 2.
```
