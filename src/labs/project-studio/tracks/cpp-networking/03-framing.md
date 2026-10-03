---
title: 3 — Protocol Design: Frames and Byte Packing
track: Networking
runtime: cpp
reference: optional
console: true
---

A TCP connection delivers a stream of bytes. Your programs want to exchange **messages**: a chat line, a move in a game, a request. A **protocol** is the agreement between the two ends about how messages are laid out as bytes, and the first thing it must settle is where each message **ends**. That's called **framing**, and there are three common answers:

| Framing | Example | Trade-off |
|---|---|---|
| a **delimiter** ends each message | lines ending in `\n`; HTTP's headers | easy to read and type; the delimiter can't appear inside a message without escaping |
| a **length prefix** before each message | `00 00 00 05 hello` | any bytes allowed in the message; not human-readable |
| a **fixed size** for every message | 64-byte records | trivial; wasteful, inflexible |

This lesson builds the length prefix: a 4-byte **big-endian** length, then that many bytes. You'll use it in the chat room and the game server.

A protocol also has to survive the other end being **wrong**, or hostile. A length prefix is a number the peer chose. Believe a 4-byte header that says 4,000,000,000, and you've allocated 4 GB because a stranger asked you to. Every part of this lesson is tested **without a network**: just functions, bytes and tests, including tests written by a suspicious reviewer.

## Step 1 — The project's build file

**This step: create the supplied `frames/CMakeLists.txt`.**

The same shape as `echo/`: the code you write goes in `net/frame.h`, shared by the later projects, and this folder holds only its tests.

```cmake file=frames/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(frames LANGUAGES CXX)

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
add_executable(frame_tests ../testing/test_main.cpp ${TEST_SOURCES})
```

```check
file frames/CMakeLists.txt
```

## Step 2 — The specification for packing

**This step: create the supplied `frames/tests/frame_test.cpp` and read it.**

- `put_u32` and `get_u32` are lesson 1's byte packers, now taking `char*`: the type `std::string` uses.
- `encode_frame("hello")` must give exactly `00 00 00 05 68 65 6c 6c 6f`. The `hex` helper prints bytes so that a failing test shows you what was sent, not a string full of unprintable characters.

```cpp file=frames/tests/frame_test.cpp provided
// Provided by the lesson: packing numbers and encoding frames.
#include "studio_test.hpp"

#include <string>

#include "frame.h"

namespace {

// The bytes of s as hex: "00 00 00 05".
std::string hex(const std::string& s)
{
    const char* digits = "0123456789abcdef";
    std::string out;
    for (char c : s) {
        auto b = static_cast<unsigned char>(c);
        if (!out.empty())
            out += ' ';
        out += digits[b >> 4];
        out += digits[b & 15];
    }
    return out;
}

} // namespace

TEST(put_u32_writes_big_endian)
{
    std::string bytes(4, '\0');
    net::put_u32(0x12345678, bytes.data());
    CHECK_EQ(hex(bytes), std::string("12 34 56 78"));
    net::put_u32(5, bytes.data());
    CHECK_EQ(hex(bytes), std::string("00 00 00 05"));
}

TEST(get_u32_reads_what_put_u32_wrote)
{
    char bytes[4];
    for (std::uint32_t v : {0u, 1u, 300u, 65536u, 0x12345678u}) {
        net::put_u32(v, bytes);
        CHECK_EQ(net::get_u32(bytes), v);
    }
}

TEST(encode_frame_puts_the_length_first)
{
    CHECK_EQ(hex(net::encode_frame("hello")),
             std::string("00 00 00 05 68 65 6c 6c 6f"));
}

TEST(an_empty_payload_is_just_a_header)
{
    CHECK_EQ(hex(net::encode_frame("")), std::string("00 00 00 00"));
}
```

```check
file frames/tests/frame_test.cpp
```

## Step 3 — Packing numbers into bytes

**This step: create `net/frame.h` with `max_frame`, `put_u32`, `get_u32` and `encode_frame`. Configure, build and run the tests.**

```cpp
// The largest payload we accept: 1 MiB.
inline constexpr std::uint32_t max_frame = 1024 * 1024;
```

- `put_u32(value, out)` is lesson 1's, writing `char`s: `out[0] = static_cast<char>(value >> 24);` and so on.
- `get_u32(in)` has a trap. **`char` may be signed**: on most PCs, the byte `0x80` read as a `char` is `-128`. Converted straight to a wider type, `-128` becomes `0xffffff80`, and its extra `1` bits spill into the other bytes when you `|` them together. Convert each byte to `unsigned char` first, then to `std::uint32_t`, then shift:

```cpp
auto byte = [&](int i) {
    return std::uint32_t{static_cast<unsigned char>(in[i])};
};
return (byte(0) << 24) | (byte(1) << 16) | (byte(2) << 8) | byte(3);
```

- `encode_frame(payload)` throws `std::length_error` if the payload is longer than `max_frame`. Otherwise it makes a 4-byte string, `put_u32`s the length into it, and appends the payload.

```text
cmake -S frames -B frames/build -G "MinGW Makefiles"     (Windows)
cmake -S frames -B frames/build                          (macOS, Linux)
```

```text
cmake --build frames/build
./frames/build/frame_tests
```

```cpp file=net/frame.h
// frame.h: length-prefixed messages ("frames") over a TCP stream.
//
// On the wire, a frame is a 4-byte length in network byte order
// (big-endian), then that many bytes of payload:
//
//   00 00 00 05  h e l l o
#pragma once

#include <cstddef>
#include <cstdint>
#include <stdexcept>
#include <string>
#include <string_view>

namespace net {

// The largest payload we accept: 1 MiB. Without a limit, four bytes
// of garbage could ask us to allocate 4 GB.
inline constexpr std::uint32_t max_frame = 1024 * 1024;

inline void put_u32(std::uint32_t value, char* out)
{
    out[0] = static_cast<char>(value >> 24);
    out[1] = static_cast<char>(value >> 16);
    out[2] = static_cast<char>(value >> 8);
    out[3] = static_cast<char>(value);
}

inline std::uint32_t get_u32(const char* in)
{
    // char may be signed: convert to unsigned char first, or a byte
    // like 0x80 becomes -128 and its sign bits spread across the rest.
    auto byte = [&](int i) {
        return std::uint32_t{static_cast<unsigned char>(in[i])};
    };
    return (byte(0) << 24) | (byte(1) << 16) | (byte(2) << 8) | byte(3);
}

// The 4-byte header followed by the payload.
inline std::string encode_frame(std::string_view payload)
{
    if (payload.size() > max_frame)
        throw std::length_error("frame payload too large");
    std::string frame(4, '\0');
    put_u32(static_cast<std::uint32_t>(payload.size()), frame.data());
    frame += payload;
    return frame;
}

} // namespace net
```

```check
file frames/build/CMakeCache.txt label="frames/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build frames/build"
tests "./frames/build/frame_tests" require="put_u32_writes_big_endian get_u32_reads_what_put_u32_wrote encode_frame_puts_the_length_first" timeout=90 -- The most significant byte goes first: out[0] = value >> 24.
```

## Step 4 — The specification for decoding

**This step: create the supplied `frames/tests/decoder_test.cpp` and read it.**

Encoding was easy. **Decoding** is where TCP's byte stream bites: `recv` hands you whatever has arrived, which might be half a header, one and a half frames, or three frames at once.

So the decoder is a small **state machine** with a buffer. You `feed` it bytes as they arrive, in pieces of any size, and ask for the `next` complete frame until there isn't one:

```cpp
decoder.feed(bytes_from_recv);
while (auto frame = decoder.next())
    handle(*frame);
```

`next` returns `std::optional<std::string>`: a payload, or `std::nullopt` for "not yet". The tests feed a frame whole, in two pieces, and as a lone half-header.

```cpp file=frames/tests/decoder_test.cpp provided
// Provided by the lesson: FrameDecoder, fed bytes the way recv
// delivers them: in pieces of any size.
#include "studio_test.hpp"

#include <optional>
#include <string>

#include "frame.h"

TEST(decodes_a_whole_frame)
{
    net::FrameDecoder d;
    d.feed(net::encode_frame("hello"));
    std::optional<std::string> frame = d.next();
    CHECK(frame.has_value());
    CHECK_EQ(*frame, std::string("hello"));
    CHECK(!d.next().has_value());
    CHECK_EQ(d.buffered(), 0u);
}

TEST(waits_for_the_rest_of_a_frame)
{
    net::FrameDecoder d;
    std::string bytes = net::encode_frame("hello, world");
    d.feed(bytes.substr(0, 7));        // the header and 3 letters
    CHECK(!d.next().has_value());
    CHECK_EQ(d.buffered(), 7u);         // kept, not thrown away
    d.feed(bytes.substr(7));
    CHECK_EQ(d.next().value_or("<none>"), std::string("hello, world"));
}

TEST(nothing_before_the_header_is_complete)
{
    net::FrameDecoder d;
    d.feed(std::string("\0\0", 2));
    CHECK(!d.next().has_value());
    CHECK(!d.broken());
}
```

```check
file frames/tests/decoder_test.cpp
```

## Step 5 — The decoder

**This step: add the `FrameDecoder` class to `net/frame.h`. Build and run the tests.**

```cpp
class FrameDecoder {
public:
    void feed(std::string_view bytes);
    std::optional<std::string> next();
    bool broken() const { return broken_; }
    std::size_t buffered() const { return buffer_.size(); }

private:
    std::string buffer_;
    bool broken_ = false;
};
```

Define the members inside the class. The rules:

- **`feed`** appends to `buffer_`, unless the decoder is broken.
- **`next`**:
  1. broken, or fewer than 4 bytes buffered: return `std::nullopt`.
  2. read the length with `get_u32(buffer_.data())`.
  3. if it's more than `max_frame`, the stream is **broken**: set `broken_`, clear the buffer, return `std::nullopt`. There's no way to find where the next frame starts, so the connection can't be trusted any more.
  4. if the payload hasn't all arrived, return `std::nullopt`, and **keep** the buffer: the rest is on its way.
  5. otherwise copy out the payload with `buffer_.substr(4, length)`, `erase` the header and payload from the front of the buffer, and return the payload.

Add `#include <optional>`.

> Erasing from the front of a string moves everything after it. For the small buffers in this track it doesn't matter. A high-traffic server would keep a read position instead and compact the buffer now and then.

```cpp file=net/frame.h
// frame.h: length-prefixed messages ("frames") over a TCP stream.
//
// On the wire, a frame is a 4-byte length in network byte order
// (big-endian), then that many bytes of payload:
//
//   00 00 00 05  h e l l o
#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>

namespace net {

// The largest payload we accept: 1 MiB. Without a limit, four bytes
// of garbage could ask us to allocate 4 GB.
inline constexpr std::uint32_t max_frame = 1024 * 1024;

inline void put_u32(std::uint32_t value, char* out)
{
    out[0] = static_cast<char>(value >> 24);
    out[1] = static_cast<char>(value >> 16);
    out[2] = static_cast<char>(value >> 8);
    out[3] = static_cast<char>(value);
}

inline std::uint32_t get_u32(const char* in)
{
    // char may be signed: convert to unsigned char first, or a byte
    // like 0x80 becomes -128 and its sign bits spread across the rest.
    auto byte = [&](int i) {
        return std::uint32_t{static_cast<unsigned char>(in[i])};
    };
    return (byte(0) << 24) | (byte(1) << 16) | (byte(2) << 8) | byte(3);
}

// The 4-byte header followed by the payload.
inline std::string encode_frame(std::string_view payload)
{
    if (payload.size() > max_frame)
        throw std::length_error("frame payload too large");
    std::string frame(4, '\0');
    put_u32(static_cast<std::uint32_t>(payload.size()), frame.data());
    frame += payload;
    return frame;
}

// Turns bytes, in pieces of any size, back into frames.
class FrameDecoder {
public:
    // Adds bytes that arrived. Ignored once the decoder is broken.
    void feed(std::string_view bytes)
    {
        if (!broken_)
            buffer_ += bytes;
    }

    // The next complete frame's payload, or nothing if it hasn't all
    // arrived yet, or if the stream is broken.
    std::optional<std::string> next()
    {
        if (broken_ || buffer_.size() < 4)
            return std::nullopt;
        std::uint32_t length = get_u32(buffer_.data());
        if (length > max_frame) {
            broken_ = true;   // no way to find the next frame: give up
            buffer_.clear();
            return std::nullopt;
        }
        if (buffer_.size() - 4 < length)
            return std::nullopt;
        std::string payload = buffer_.substr(4, length);
        buffer_.erase(0, 4 + std::size_t{length});
        return payload;
    }

    // True once a header announced a frame bigger than max_frame.
    bool broken() const { return broken_; }

    // Bytes received but not yet returned as a frame.
    std::size_t buffered() const { return buffer_.size(); }

private:
    std::string buffer_;
    bool broken_ = false;
};

} // namespace net
```

```check
run "cmake --build frames/build"
tests "./frames/build/frame_tests" require="decodes_a_whole_frame waits_for_the_rest_of_a_frame nothing_before_the_header_is_complete" timeout=90 -- When the payload is incomplete, return std::nullopt and keep the buffer.
```

## Step 6 — Your own tests

**This step: create `frames/tests/my_frame_test.cpp` with three tests of your own: `two_frames_in_one_feed`, `one_byte_at_a_time` and `empty_payload`. Build and run them.**

The specification tests were written by someone else. Now you think about what else could arrive:

| Test | Feed | Expect |
|---|---|---|
| `two_frames_in_one_feed` | `encode_frame("one") + encode_frame("two")` | "one", then "two", then nothing |
| `one_byte_at_a_time` | a frame, one byte per `feed` | exactly one frame, after the last byte |
| `empty_payload` | an empty frame, then another | `""`, then the other |

`d.next().value_or("<none>")` gives a string even when there's no frame, so `CHECK_EQ` can print what went wrong.

```text
cmake --build frames/build
./frames/build/frame_tests
```

```cpp file=frames/tests/my_frame_test.cpp
// My own tests for FrameDecoder.
#include "studio_test.hpp"

#include <string>

#include "frame.h"

TEST(two_frames_in_one_feed)
{
    net::FrameDecoder d;
    d.feed(net::encode_frame("one") + net::encode_frame("two"));
    CHECK_EQ(d.next().value_or("<none>"), std::string("one"));
    CHECK_EQ(d.next().value_or("<none>"), std::string("two"));
    CHECK(!d.next().has_value());
}

TEST(one_byte_at_a_time)
{
    net::FrameDecoder d;
    std::string bytes = net::encode_frame("slowly");
    int frames = 0;
    for (char c : bytes) {
        d.feed(std::string(1, c));
        if (auto f = d.next()) {
            ++frames;
            CHECK_EQ(*f, std::string("slowly"));
        }
    }
    CHECK_EQ(frames, 1);
}

TEST(empty_payload)
{
    net::FrameDecoder d;
    d.feed(net::encode_frame("") + net::encode_frame("after"));
    CHECK_EQ(d.next().value_or("<none>"), std::string(""));
    CHECK_EQ(d.next().value_or("<none>"), std::string("after"));
}
```

```check
run "cmake --build frames/build"
tests "./frames/build/frame_tests" require="two_frames_in_one_feed one_byte_at_a_time empty_payload" timeout=90 -- Name the three tests exactly as listed.
```

## Step 7 — The reviewer's tests

**This step: create the supplied `frames/tests/frame_review_test.cpp`, build, and run the tests. If any fail, fix `net/frame.h`.**

A reviewer read your decoder with one question in mind: *what's the worst thing the other end could send?* Their tests:

| Test | The attack, or accident |
|---|---|
| `bytes_with_the_top_bit_set_read_back` | lengths with bytes ≥ `0x80`: the signed `char` trap |
| `a_frame_of_200_bytes_decodes` | the same trap, through the decoder |
| `the_largest_frame_is_allowed` | exactly `max_frame`: is the limit `>` or `>=`? |
| `encode_refuses_a_payload_over_the_limit` | don't **send** what you'd refuse to receive |
| `a_huge_length_breaks_the_stream` | a header of `ff ff ff ff`: 4 GB, please |
| `a_broken_stream_stays_broken` | after garbage, a valid-looking frame is still garbage |
| `a_header_split_across_feeds` | the header itself arriving in 3 pieces |

**Predict** which of these your code fails, then run them.

```text
cmake --build frames/build
./frames/build/frame_tests
```

The signed-`char` bug is worth remembering. It passes every test with small numbers, because they never set a top bit. The first time a frame is 128 bytes long, its length's last byte is `0x80`, `get_u32` returns about 4 billion, and the connection breaks.

This decoder **never trusts** the length: it checks the limit before allocating anything, and once confused, it stays broken, so the server can close the connection. Everything a network peer sends is input from a stranger.

```cpp file=frames/tests/frame_review_test.cpp provided
// The reviewer's tests: what a hostile or broken peer could send.
#include "studio_test.hpp"

#include <stdexcept>
#include <string>

#include "frame.h"

namespace {

std::string header(std::uint32_t length)
{
    std::string h(4, '\0');
    net::put_u32(length, h.data());
    return h;
}

} // namespace

TEST(bytes_with_the_top_bit_set_read_back)
{
    // 0x80 and 0xff are negative if char is signed.
    for (std::uint32_t v : {0x80u, 0xffu, 0x8000u, 0x80808080u, 0xffffffffu}) {
        char bytes[4];
        net::put_u32(v, bytes);
        CHECK_EQ(net::get_u32(bytes), v);
    }
}

TEST(a_frame_of_200_bytes_decodes)
{
    // 200 is 0xc8: the length's low byte has its top bit set.
    net::FrameDecoder d;
    std::string payload(200, 'p');
    d.feed(net::encode_frame(payload));
    CHECK(d.next().value_or("<none>") == payload);
}

TEST(the_largest_frame_is_allowed)
{
    std::string payload(net::max_frame, 'x');
    net::FrameDecoder d;
    d.feed(net::encode_frame(payload));
    CHECK(d.next().value_or("<none>") == payload);
    CHECK(!d.broken());
}

TEST(encode_refuses_a_payload_over_the_limit)
{
    std::string payload(net::max_frame + 1, 'x');
    CHECK_THROWS(net::encode_frame(payload), std::length_error);
}

TEST(a_huge_length_breaks_the_stream)
{
    net::FrameDecoder d;
    d.feed(header(0xffffffff));
    CHECK(!d.next().has_value());
    CHECK(d.broken());
}

TEST(a_broken_stream_stays_broken)
{
    net::FrameDecoder d;
    d.feed(header(net::max_frame + 1));
    CHECK(!d.next().has_value());
    d.feed(net::encode_frame("innocent"));   // can't be trusted now
    CHECK(!d.next().has_value());
    CHECK(d.broken());
}

TEST(a_header_split_across_feeds)
{
    net::FrameDecoder d;
    std::string bytes = net::encode_frame("split");
    d.feed(bytes.substr(0, 1));
    CHECK(!d.next().has_value());
    d.feed(bytes.substr(1, 2));
    CHECK(!d.next().has_value());
    d.feed(bytes.substr(3));
    CHECK_EQ(d.next().value_or("<none>"), std::string("split"));
}
```

```check
run "cmake --build frames/build"
tests "./frames/build/frame_tests" require="bytes_with_the_top_bit_set_read_back a_huge_length_breaks_the_stream a_broken_stream_stays_broken the_largest_frame_is_allowed" timeout=90 -- Convert each byte to unsigned char before widening it, and check the length against max_frame before waiting for the payload.
```

## Step 8 — The specification for frames over a socket

**This step: create the supplied `frames/tests/socket_frame_test.cpp` and read it.**

Back to a real connection. A thread accepts one client and sends it three frames: `"first"`, an empty one, and one of 100,000 bytes. The client receives them with `recv_frame` and, after the sender closes, `recv_frame` must return `false`.

The second test sends only a header claiming `max_frame + 1` bytes. `recv_frame` must refuse it **without** allocating anything for the payload.

```cpp file=frames/tests/socket_frame_test.cpp provided
// Provided by the lesson: frames over a real connection.
#include "studio_test.hpp"

#include <string>

#include "background.h"
#include "frame.h"
#include "tcp.h"

TEST(frames_cross_a_connection_intact)
{
    net::Startup startup;
    net::Socket listener = net::listen_loopback();
    std::string big(100000, 'b');

    net::Background sender([&] {
        net::Socket peer = net::accept_client(listener);
        net::send_frame(peer, "first");
        net::send_frame(peer, "");
        net::send_frame(peer, big);
    });   // peer closes when the thread finishes

    net::Socket client = net::connect_loopback(net::local_port(listener));
    net::set_receive_timeout(client, 5000);
    std::string payload;
    CHECK(net::recv_frame(client, payload));
    CHECK_EQ(payload, std::string("first"));
    CHECK(net::recv_frame(client, payload));
    CHECK_EQ(payload, std::string(""));
    CHECK(net::recv_frame(client, payload));
    CHECK(payload == big);
    CHECK(!net::recv_frame(client, payload));   // the sender closed
}

TEST(recv_frame_refuses_an_oversized_frame)
{
    net::Startup startup;
    net::Socket listener = net::listen_loopback();

    net::Background sender([&] {
        net::Socket peer = net::accept_client(listener);
        char header[4];
        net::put_u32(net::max_frame + 1, header);
        net::send_all(peer, {header, 4});
    });

    net::Socket client = net::connect_loopback(net::local_port(listener));
    net::set_receive_timeout(client, 5000);
    std::string payload;
    CHECK(!net::recv_frame(client, payload));
    CHECK(payload.empty());
}
```

```check
file frames/tests/socket_frame_test.cpp
```

## Step 9 — Frames over a socket

**This step: add `send_frame` and `recv_frame` to `net/frame.h`. Build and run the tests.**

```cpp
inline bool send_frame(const Socket& s, std::string_view payload)
{
    return send_all(s, encode_frame(payload));
}
```

`recv_frame(const Socket& s, std::string& payload)`, for code that waits for one frame at a time:

1. `recv_exact` the 4-byte header, or return `false`.
2. `get_u32` it. More than `max_frame`? Return `false`, leaving `payload` alone.
3. `payload.assign(length, '\0')`, then `recv_exact` into `payload.data()`. An empty frame has nothing to receive.

Include `socket.h` and `tcp.h`.

`recv_frame` blocks until a whole frame arrives, which suits a client that waits for its answer. A server with many clients can't wait on any one of them, so it will use `FrameDecoder` instead: next lesson.

```cpp file=net/frame.h
// frame.h: length-prefixed messages ("frames") over a TCP stream.
//
// On the wire, a frame is a 4-byte length in network byte order
// (big-endian), then that many bytes of payload:
//
//   00 00 00 05  h e l l o
#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>

#include "socket.h"
#include "tcp.h"

namespace net {

// The largest payload we accept: 1 MiB. Without a limit, four bytes
// of garbage could ask us to allocate 4 GB.
inline constexpr std::uint32_t max_frame = 1024 * 1024;

inline void put_u32(std::uint32_t value, char* out)
{
    out[0] = static_cast<char>(value >> 24);
    out[1] = static_cast<char>(value >> 16);
    out[2] = static_cast<char>(value >> 8);
    out[3] = static_cast<char>(value);
}

inline std::uint32_t get_u32(const char* in)
{
    // char may be signed: convert to unsigned char first, or a byte
    // like 0x80 becomes -128 and its sign bits spread across the rest.
    auto byte = [&](int i) {
        return std::uint32_t{static_cast<unsigned char>(in[i])};
    };
    return (byte(0) << 24) | (byte(1) << 16) | (byte(2) << 8) | byte(3);
}

// The 4-byte header followed by the payload.
inline std::string encode_frame(std::string_view payload)
{
    if (payload.size() > max_frame)
        throw std::length_error("frame payload too large");
    std::string frame(4, '\0');
    put_u32(static_cast<std::uint32_t>(payload.size()), frame.data());
    frame += payload;
    return frame;
}

// Turns bytes, in pieces of any size, back into frames.
class FrameDecoder {
public:
    // Adds bytes that arrived. Ignored once the decoder is broken.
    void feed(std::string_view bytes)
    {
        if (!broken_)
            buffer_ += bytes;
    }

    // The next complete frame's payload, or nothing if it hasn't all
    // arrived yet, or if the stream is broken.
    std::optional<std::string> next()
    {
        if (broken_ || buffer_.size() < 4)
            return std::nullopt;
        std::uint32_t length = get_u32(buffer_.data());
        if (length > max_frame) {
            broken_ = true;   // no way to find the next frame: give up
            buffer_.clear();
            return std::nullopt;
        }
        if (buffer_.size() - 4 < length)
            return std::nullopt;
        std::string payload = buffer_.substr(4, length);
        buffer_.erase(0, 4 + std::size_t{length});
        return payload;
    }

    // True once a header announced a frame bigger than max_frame.
    bool broken() const { return broken_; }

    // Bytes received but not yet returned as a frame.
    std::size_t buffered() const { return buffer_.size(); }

private:
    std::string buffer_;
    bool broken_ = false;
};

// Sends one frame.
inline bool send_frame(const Socket& s, std::string_view payload)
{
    return send_all(s, encode_frame(payload));
}

// Receives one frame into payload. False if the connection closed or
// failed, or the frame is bigger than max_frame.
inline bool recv_frame(const Socket& s, std::string& payload)
{
    char header[4];
    if (!recv_exact(s, header, 4))
        return false;
    std::uint32_t length = get_u32(header);
    if (length > max_frame)
        return false;
    payload.assign(length, '\0');
    return length == 0 || recv_exact(s, payload.data(), length);
}

} // namespace net
```

```check
run "cmake --build frames/build"
tests "./frames/build/frame_tests" require="frames_cross_a_connection_intact recv_frame_refuses_an_oversized_frame" timeout=90 -- Check the length against max_frame before assigning the payload.
```
