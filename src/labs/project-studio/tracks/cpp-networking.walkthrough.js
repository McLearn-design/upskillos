// What a learner does at each step of the cpp-networking track, for its walkthrough test (walkCppTrack.js).
// Generated with the lessons; see tracks/cpp-foundations.walkthrough.js for the format.
import { configure } from '../walkCppTrack.js';

export const WALKTHROUGH = {
  "01-sockets#Step 1 \u2014 Bytes on the wire": {
    "wrong": [
      {
        "name": "wrote the bytes in memory order",
        "files": {
          "basics/byteorder.cpp": "// byteorder.cpp: how a number's bytes are laid out, in memory and on\n// the wire.\n#include <cstdint>\n#include <cstdio>\n#include <cstring>\n\nvoid print_bytes(const char* label, const unsigned char* bytes)\n{\n    std::printf(\"%-15s\", label);\n    for (int i = 0; i < 4; ++i)\n        std::printf(\" %02x\", bytes[i]);\n    std::printf(\"\\n\");\n}\n\n// Network byte order is big-endian: the most significant byte first.\nvoid put_u32(std::uint32_t value, unsigned char* out)\n{\n    out[3] = static_cast<unsigned char>(value >> 24);\n    out[2] = static_cast<unsigned char>(value >> 16);\n    out[1] = static_cast<unsigned char>(value >> 8);\n    out[0] = static_cast<unsigned char>(value);\n}\n\nstd::uint32_t get_u32(const unsigned char* in)\n{\n    return (std::uint32_t{in[0]} << 24) | (std::uint32_t{in[1]} << 16) |\n           (std::uint32_t{in[2]} << 8) | std::uint32_t{in[3]};\n}\n\nint main()\n{\n    std::uint32_t value = 0x12345678;\n\n    unsigned char memory[4];\n    std::memcpy(memory, &value, 4);   // the bytes exactly as stored\n    print_bytes(\"in memory:\", memory);\n    std::printf(\"this machine is %s-endian\\n\",\n                memory[0] == 0x78 ? \"little\" : \"big\");\n\n    unsigned char wire[4];\n    put_u32(value, wire);\n    print_bytes(\"network order:\", wire);\n    std::printf(\"read back: 0x%08x\\n\", static_cast<unsigned>(get_u32(wire)));\n}\n",
        },
        "run": [
          "g++ -std=c++20 -Wall -Wextra -Werror basics/byteorder.cpp -o basics/byteorder",
        ],
        "fails": [
          1,
          2,
        ],
      },
    ],
  },
  "01-sockets#Step 2 \u2014 A portable socket layer": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-sockets#Step 3 \u2014 A wrapper that can be copied": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-sockets#Step 4 \u2014 The project's build file": {
    "run": [
      configure("basics"),
    ],
    "wrong": [
      {
        "name": "did not configure",
        "typeFile": true,
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-sockets#Step 5 \u2014 Fix it with a move-only Socket": {
    "wrong": [
      {
        "name": "passed net::Socket by value",
        "files": {
          "basics/copy_bug.cpp": "// copy_bug.cpp, fixed: net::Socket can't be copied, only lent or moved.\n#include <iostream>\n\n#include \"socket.h\"\n\nvoid describe(net::Socket s)\n{\n    std::cout << \"describing socket \" << s.get() << '\\n';\n}\n\nint main()\n{\n    net::Startup startup;\n    net::Socket s = net::open_socket(SOCK_DGRAM);\n    describe(s);\n\n    sockaddr_in address = net::loopback(0);\n    int result = ::bind(s.get(), reinterpret_cast<sockaddr*>(&address),\n                        sizeof address);\n    std::cout << \"bind: \" << (result == 0 ? \"ok\" : \"failed\") << '\\n';\n}\n",
        },
        "run": [
          configure("basics"),
        ],
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "01-sockets#Step 6 \u2014 Hello over UDP": {
    "editFiles": {
      "basics/CMakeLists.txt": [
        [
          "add_executable(copy_bug copy_bug.cpp)",
          "add_executable(copy_bug copy_bug.cpp)\nadd_executable(udp_hello udp_hello.cpp)",
        ],
      ],
    },
    "wrong": [
      {
        "name": "forgot the CMake line",
        "typeFile": true,
        "run": [
          configure("basics"),
        ],
        "fails": [
          0,
          2,
        ],
      },
      {
        "name": "did not bind the receiver",
        "typeFile": true,
        "editFiles": {
          "basics/CMakeLists.txt": [
            [
              "add_executable(copy_bug copy_bug.cpp)",
              "add_executable(copy_bug copy_bug.cpp)\nadd_executable(udp_hello udp_hello.cpp)",
            ],
          ],
        },
        "files": {
          "basics/udp_hello.cpp": "// udp_hello.cpp: send one datagram to ourselves over the loopback.\n#include <iostream>\n#include <string>\n\n#include \"socket.h\"\n\nint main()\n{\n    net::Startup startup;\n\n    // The receiver: bound to 127.0.0.1 and a port the system picks.\n    net::Socket receiver = net::open_socket(SOCK_DGRAM);\n    sockaddr_in to = net::local_address(receiver);\n    std::cout << \"receiver is at \" << net::to_string(to) << '\\n';\n\n    // The sender: not bound. The system gives it a port on first use.\n    net::Socket sender = net::open_socket(SOCK_DGRAM);\n    std::string message = \"hello, socket\";\n    long sent = ::sendto(sender.get(), message.data(),\n                         static_cast<int>(message.size()), 0,\n                         reinterpret_cast<sockaddr*>(&to), sizeof to);\n    std::cout << \"sent \" << sent << \" bytes\\n\";\n\n    // Wait at most 5 seconds for it.\n    net::set_receive_timeout(receiver, 5000);\n    char buffer[512];\n    sockaddr_in from{};\n    socklen_t from_len = sizeof from;\n    long got = ::recvfrom(receiver.get(), buffer, sizeof buffer, 0,\n                          reinterpret_cast<sockaddr*>(&from), &from_len);\n    if (got < 0) {\n        std::cout << \"nothing arrived (error \" << net::last_error() << \")\\n\";\n        return 1;\n    }\n    std::cout << \"received \\\"\" << std::string(buffer, got) << \"\\\" from \"\n              << net::to_string(from) << '\\n';\n}\n",
        },
        "run": [
          configure("basics"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "01-sockets#Step 7 \u2014 The test framework": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-sockets#Step 8 \u2014 The test runner": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-tcp-echo#Step 1 \u2014 Listen, accept, connect": {
    "wrong": [
      {
        "name": "bound but never listened",
        "files": {
          "net/tcp.h": "// tcp.h: TCP connections.\n#pragma once\n\n#include <cstdint>\n\n#include \"socket.h\"\n\nnamespace net {\n\n// A listening socket on 127.0.0.1 and a port the system picks.\n// Read the port back with local_port().\ninline Socket listen_loopback()\n{\n    Socket s = open_socket(SOCK_STREAM);\n    bind_loopback(s, 0);\n    return s;\n}\n\n// Waits for the next client and returns the socket connected to it.\ninline Socket accept_client(const Socket& listener)\n{\n    Socket client(::accept(listener.get(), nullptr, nullptr));\n    if (!client.valid())\n        fail(\"accept\");\n    return client;\n}\n\n// Connects to 127.0.0.1:port.\ninline Socket connect_loopback(std::uint16_t port)\n{\n    Socket s = open_socket(SOCK_STREAM);\n    sockaddr_in a = loopback(port);\n    if (::connect(s.get(), reinterpret_cast<sockaddr*>(&a), sizeof a) != 0)\n        fail(\"connect\");\n    return s;\n}\n\n} // namespace net\n",
        },
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-tcp-echo#Step 2 \u2014 The specification for whole messages": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-tcp-echo#Step 3 \u2014 The project's build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-tcp-echo#Step 4 \u2014 write_all and read_exact": {
    "run": [
      configure("echo"),
    ],
    "wrong": [
      {
        "name": "called recv once and hoped",
        "files": {
          "net/tcp.h": "// tcp.h: TCP connections, and sending and receiving whole messages.\n#pragma once\n\n#include <cstddef>\n#include <cstdint>\n#include <string>\n#include <string_view>\n\n#include \"socket.h\"\n\nnamespace net {\n\n// A listening socket on 127.0.0.1 and a port the system picks.\n// Read the port back with local_port().\ninline Socket listen_loopback()\n{\n    Socket s = open_socket(SOCK_STREAM);\n    bind_loopback(s, 0);\n    if (::listen(s.get(), SOMAXCONN) != 0)\n        fail(\"listen\");\n    return s;\n}\n\n// Waits for the next client and returns the socket connected to it.\ninline Socket accept_client(const Socket& listener)\n{\n    Socket client(::accept(listener.get(), nullptr, nullptr));\n    if (!client.valid())\n        fail(\"accept\");\n    return client;\n}\n\n// Connects to 127.0.0.1:port.\ninline Socket connect_loopback(std::uint16_t port)\n{\n    Socket s = open_socket(SOCK_STREAM);\n    sockaddr_in a = loopback(port);\n    if (::connect(s.get(), reinterpret_cast<sockaddr*>(&a), sizeof a) != 0)\n        fail(\"connect\");\n    return s;\n}\n\n// Calls write_some(data, n) until all n bytes are written.\n// write_some returns how many bytes it wrote, or <= 0 on failure.\ntemplate <typename WriteSome>\nbool write_all(WriteSome write_some, const char* data, std::size_t n)\n{\n    while (n > 0) {\n        long sent = write_some(data, n);\n        if (sent <= 0)\n            return false;\n        data += sent;\n        n -= static_cast<std::size_t>(sent);\n    }\n    return true;\n}\n\n// Calls read_some(out, n) until exactly n bytes have arrived.\n// read_some returns how many bytes it read: 0 when the other side\n// has closed, < 0 on failure. Either way, read_exact returns false.\ntemplate <typename ReadSome>\nbool read_exact(ReadSome read_some, char* out, std::size_t n)\n{\n    return read_some(out, n) > 0;\n}\n\ninline bool send_all(const Socket& s, std::string_view data)\n{\n    auto write_some = [&](const char* p, std::size_t n) {\n        return send_some(s, p, n);\n    };\n    return write_all(write_some, data.data(), data.size());\n}\n\ninline bool recv_exact(const Socket& s, char* out, std::size_t n)\n{\n    auto read_some = [&](char* p, std::size_t len) {\n        return recv_some(s, p, len);\n    };\n    return read_exact(read_some, out, n);\n}\n\n} // namespace net\n",
        },
        "run": [
          configure("echo"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "02-tcp-echo#Step 5 \u2014 A server inside a test": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-tcp-echo#Step 6 \u2014 The specification for the echo server": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-tcp-echo#Step 7 \u2014 The echo server": {
    "wrong": [
      {
        "name": "echoed the whole buffer",
        "files": {
          "echo/echo_server.h": "// echo_server.h: a TCP server that sends back whatever it receives.\n#pragma once\n\n#include <cstddef>\n#include <cstdint>\n#include <string_view>\n\n#include \"socket.h\"\n#include \"tcp.h\"\n\nclass EchoServer {\npublic:\n    // Listens on 127.0.0.1, on a port the system picks.\n    EchoServer() : listener_(net::listen_loopback()) {}\n\n    std::uint16_t port() const { return net::local_port(listener_); }\n\n    // Waits for one client, and echoes everything it sends until it\n    // closes the connection.\n    void serve_one()\n    {\n        net::Socket client = net::accept_client(listener_);\n        char buffer[4096];\n        while (true) {\n            long got = net::recv_some(client, buffer, sizeof buffer);\n            if (got <= 0)\n                return;   // 0: the client closed; < 0: an error\n            std::string_view data(buffer, sizeof buffer);\n            if (!net::send_all(client, data))\n                return;\n        }\n    }\n\nprivate:\n    net::Socket listener_;\n};\n",
        },
        "run": [
          configure("echo"),
        ],
        "fails": [
          1,
        ],
      },
      {
        "name": "echoed only the first message",
        "files": {
          "echo/echo_server.h": "// echo_server.h: a TCP server that sends back whatever it receives.\n#pragma once\n\n#include <cstddef>\n#include <cstdint>\n#include <string_view>\n\n#include \"socket.h\"\n#include \"tcp.h\"\n\nclass EchoServer {\npublic:\n    // Listens on 127.0.0.1, on a port the system picks.\n    EchoServer() : listener_(net::listen_loopback()) {}\n\n    std::uint16_t port() const { return net::local_port(listener_); }\n\n    // Waits for one client, and echoes everything it sends until it\n    // closes the connection.\n    void serve_one()\n    {\n        net::Socket client = net::accept_client(listener_);\n        char buffer[4096];\n        while (true) {\n            long got = net::recv_some(client, buffer, sizeof buffer);\n            if (got <= 0)\n                return;   // 0: the client closed; < 0: an error\n            std::string_view data(buffer, static_cast<std::size_t>(got));\n            net::send_all(client, data);\n            return;\n        }\n    }\n\nprivate:\n    net::Socket listener_;\n};\n",
        },
        "run": [
          configure("echo"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "02-tcp-echo#Step 8 \u2014 The server as a program": {
    "editFiles": {
      "echo/CMakeLists.txt": [
        [
          "add_executable(echo_tests ../testing/test_main.cpp ${TEST_SOURCES})",
          "add_executable(echo_tests ../testing/test_main.cpp ${TEST_SOURCES})\n\n# The programs, to try by hand in two terminals.\nadd_executable(echo_server apps/server.cpp)",
        ],
      ],
    },
    "wrong": [
      {
        "name": "forgot the CMake line",
        "typeFile": true,
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-tcp-echo#Step 9 \u2014 A client, and two terminals": {
    "editFiles": {
      "echo/CMakeLists.txt": [
        [
          "add_executable(echo_server apps/server.cpp)",
          "add_executable(echo_server apps/server.cpp)\nadd_executable(echo_client apps/client.cpp)",
        ],
      ],
    },
    "wrong": [
      {
        "name": "forgot the CMake line",
        "typeFile": true,
        "run": [
          configure("echo"),
        ],
        "fails": [
          0,
          2,
        ],
      },
    ],
  },
  "03-framing#Step 1 \u2014 The project's build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-framing#Step 2 \u2014 The specification for packing": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-framing#Step 3 \u2014 Packing numbers into bytes": {
    "run": [
      configure("frames"),
    ],
    "wrong": [
      {
        "name": "packed least significant byte first",
        "files": {
          "net/frame.h": "// frame.h: length-prefixed messages (\"frames\") over a TCP stream.\n//\n// On the wire, a frame is a 4-byte length in network byte order\n// (big-endian), then that many bytes of payload:\n//\n//   00 00 00 05  h e l l o\n#pragma once\n\n#include <cstddef>\n#include <cstdint>\n#include <stdexcept>\n#include <string>\n#include <string_view>\n\nnamespace net {\n\n// The largest payload we accept: 1 MiB. Without a limit, four bytes\n// of garbage could ask us to allocate 4 GB.\ninline constexpr std::uint32_t max_frame = 1024 * 1024;\n\ninline void put_u32(std::uint32_t value, char* out)\n{\n    out[3] = static_cast<char>(value >> 24);\n    out[2] = static_cast<char>(value >> 16);\n    out[1] = static_cast<char>(value >> 8);\n    out[0] = static_cast<char>(value);\n}\n\ninline std::uint32_t get_u32(const char* in)\n{\n    // char may be signed: convert to unsigned char first, or a byte\n    // like 0x80 becomes -128 and its sign bits spread across the rest.\n    auto byte = [&](int i) {\n        return std::uint32_t{static_cast<unsigned char>(in[i])};\n    };\n    return (byte(0) << 24) | (byte(1) << 16) | (byte(2) << 8) | byte(3);\n}\n\n// The 4-byte header followed by the payload.\ninline std::string encode_frame(std::string_view payload)\n{\n    if (payload.size() > max_frame)\n        throw std::length_error(\"frame payload too large\");\n    std::string frame(4, '\\0');\n    put_u32(static_cast<std::uint32_t>(payload.size()), frame.data());\n    frame += payload;\n    return frame;\n}\n\n} // namespace net\n",
        },
        "run": [
          configure("frames"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "03-framing#Step 4 \u2014 The specification for decoding": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-framing#Step 5 \u2014 The decoder": {
    "wrong": [
      {
        "name": "threw away an incomplete frame",
        "files": {
          "net/frame.h": "// frame.h: length-prefixed messages (\"frames\") over a TCP stream.\n//\n// On the wire, a frame is a 4-byte length in network byte order\n// (big-endian), then that many bytes of payload:\n//\n//   00 00 00 05  h e l l o\n#pragma once\n\n#include <cstddef>\n#include <cstdint>\n#include <optional>\n#include <stdexcept>\n#include <string>\n#include <string_view>\n\nnamespace net {\n\n// The largest payload we accept: 1 MiB. Without a limit, four bytes\n// of garbage could ask us to allocate 4 GB.\ninline constexpr std::uint32_t max_frame = 1024 * 1024;\n\ninline void put_u32(std::uint32_t value, char* out)\n{\n    out[0] = static_cast<char>(value >> 24);\n    out[1] = static_cast<char>(value >> 16);\n    out[2] = static_cast<char>(value >> 8);\n    out[3] = static_cast<char>(value);\n}\n\ninline std::uint32_t get_u32(const char* in)\n{\n    // char may be signed: convert to unsigned char first, or a byte\n    // like 0x80 becomes -128 and its sign bits spread across the rest.\n    auto byte = [&](int i) {\n        return std::uint32_t{static_cast<unsigned char>(in[i])};\n    };\n    return (byte(0) << 24) | (byte(1) << 16) | (byte(2) << 8) | byte(3);\n}\n\n// The 4-byte header followed by the payload.\ninline std::string encode_frame(std::string_view payload)\n{\n    if (payload.size() > max_frame)\n        throw std::length_error(\"frame payload too large\");\n    std::string frame(4, '\\0');\n    put_u32(static_cast<std::uint32_t>(payload.size()), frame.data());\n    frame += payload;\n    return frame;\n}\n\n// Turns bytes, in pieces of any size, back into frames.\nclass FrameDecoder {\npublic:\n    // Adds bytes that arrived. Ignored once the decoder is broken.\n    void feed(std::string_view bytes)\n    {\n        if (!broken_)\n            buffer_ += bytes;\n    }\n\n    // The next complete frame's payload, or nothing if it hasn't all\n    // arrived yet, or if the stream is broken.\n    std::optional<std::string> next()\n    {\n        if (broken_ || buffer_.size() < 4)\n            return std::nullopt;\n        std::uint32_t length = get_u32(buffer_.data());\n        if (length > max_frame) {\n            broken_ = true;   // no way to find the next frame: give up\n            buffer_.clear();\n            return std::nullopt;\n        }\n        if (buffer_.size() - 4 < length) {\n            buffer_.clear();\n            return std::nullopt;\n        }\n        std::string payload = buffer_.substr(4, length);\n        buffer_.erase(0, 4 + std::size_t{length});\n        return payload;\n    }\n\n    // True once a header announced a frame bigger than max_frame.\n    bool broken() const { return broken_; }\n\n    // Bytes received but not yet returned as a frame.\n    std::size_t buffered() const { return buffer_.size(); }\n\nprivate:\n    std::string buffer_;\n    bool broken_ = false;\n};\n\n} // namespace net\n",
        },
        "run": [
          configure("frames"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "03-framing#Step 6 \u2014 Your own tests": {
    "wrong": [
      {
        "name": "only one test",
        "files": {
          "frames/tests/my_frame_test.cpp": "// My own tests for FrameDecoder.\n#include \"studio_test.hpp\"\n\n#include <string>\n\n#include \"frame.h\"\n\nTEST(two_frames_in_one_feed)\n{\n    net::FrameDecoder d;\n    d.feed(net::encode_frame(\"one\") + net::encode_frame(\"two\"));\n    CHECK_EQ(d.next().value_or(\"<none>\"), std::string(\"one\"));\n    CHECK_EQ(d.next().value_or(\"<none>\"), std::string(\"two\"));\n    CHECK(!d.next().has_value());\n}\n\n",
        },
        "run": [
          configure("frames"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "03-framing#Step 7 \u2014 The reviewer's tests": {
    "wrong": [
      {
        "name": "get_u32 widened signed chars",
        "typeFile": true,
        "files": {
          "net/frame.h": "// frame.h: length-prefixed messages (\"frames\") over a TCP stream.\n//\n// On the wire, a frame is a 4-byte length in network byte order\n// (big-endian), then that many bytes of payload:\n//\n//   00 00 00 05  h e l l o\n#pragma once\n\n#include <cstddef>\n#include <cstdint>\n#include <optional>\n#include <stdexcept>\n#include <string>\n#include <string_view>\n\nnamespace net {\n\n// The largest payload we accept: 1 MiB. Without a limit, four bytes\n// of garbage could ask us to allocate 4 GB.\ninline constexpr std::uint32_t max_frame = 1024 * 1024;\n\ninline void put_u32(std::uint32_t value, char* out)\n{\n    out[0] = static_cast<char>(value >> 24);\n    out[1] = static_cast<char>(value >> 16);\n    out[2] = static_cast<char>(value >> 8);\n    out[3] = static_cast<char>(value);\n}\n\ninline std::uint32_t get_u32(const char* in)\n{\n    // char may be signed: convert to unsigned char first, or a byte\n    // like 0x80 becomes -128 and its sign bits spread across the rest.\n    return (static_cast<std::uint32_t>(in[0]) << 24) |\n           (static_cast<std::uint32_t>(in[1]) << 16) |\n           (static_cast<std::uint32_t>(in[2]) << 8) |\n           static_cast<std::uint32_t>(in[3]);\n}\n\n// The 4-byte header followed by the payload.\ninline std::string encode_frame(std::string_view payload)\n{\n    if (payload.size() > max_frame)\n        throw std::length_error(\"frame payload too large\");\n    std::string frame(4, '\\0');\n    put_u32(static_cast<std::uint32_t>(payload.size()), frame.data());\n    frame += payload;\n    return frame;\n}\n\n// Turns bytes, in pieces of any size, back into frames.\nclass FrameDecoder {\npublic:\n    // Adds bytes that arrived. Ignored once the decoder is broken.\n    void feed(std::string_view bytes)\n    {\n        if (!broken_)\n            buffer_ += bytes;\n    }\n\n    // The next complete frame's payload, or nothing if it hasn't all\n    // arrived yet, or if the stream is broken.\n    std::optional<std::string> next()\n    {\n        if (broken_ || buffer_.size() < 4)\n            return std::nullopt;\n        std::uint32_t length = get_u32(buffer_.data());\n        if (length > max_frame) {\n            broken_ = true;   // no way to find the next frame: give up\n            buffer_.clear();\n            return std::nullopt;\n        }\n        if (buffer_.size() - 4 < length)\n            return std::nullopt;\n        std::string payload = buffer_.substr(4, length);\n        buffer_.erase(0, 4 + std::size_t{length});\n        return payload;\n    }\n\n    // True once a header announced a frame bigger than max_frame.\n    bool broken() const { return broken_; }\n\n    // Bytes received but not yet returned as a frame.\n    std::size_t buffered() const { return buffer_.size(); }\n\nprivate:\n    std::string buffer_;\n    bool broken_ = false;\n};\n\n} // namespace net\n",
        },
        "run": [
          configure("frames"),
        ],
        "fails": [
          1,
        ],
      },
      {
        "name": "trusted the length",
        "typeFile": true,
        "files": {
          "net/frame.h": "// frame.h: length-prefixed messages (\"frames\") over a TCP stream.\n//\n// On the wire, a frame is a 4-byte length in network byte order\n// (big-endian), then that many bytes of payload:\n//\n//   00 00 00 05  h e l l o\n#pragma once\n\n#include <cstddef>\n#include <cstdint>\n#include <optional>\n#include <stdexcept>\n#include <string>\n#include <string_view>\n\nnamespace net {\n\n// The largest payload we accept: 1 MiB. Without a limit, four bytes\n// of garbage could ask us to allocate 4 GB.\ninline constexpr std::uint32_t max_frame = 1024 * 1024;\n\ninline void put_u32(std::uint32_t value, char* out)\n{\n    out[0] = static_cast<char>(value >> 24);\n    out[1] = static_cast<char>(value >> 16);\n    out[2] = static_cast<char>(value >> 8);\n    out[3] = static_cast<char>(value);\n}\n\ninline std::uint32_t get_u32(const char* in)\n{\n    // char may be signed: convert to unsigned char first, or a byte\n    // like 0x80 becomes -128 and its sign bits spread across the rest.\n    auto byte = [&](int i) {\n        return std::uint32_t{static_cast<unsigned char>(in[i])};\n    };\n    return (byte(0) << 24) | (byte(1) << 16) | (byte(2) << 8) | byte(3);\n}\n\n// The 4-byte header followed by the payload.\ninline std::string encode_frame(std::string_view payload)\n{\n    if (payload.size() > max_frame)\n        throw std::length_error(\"frame payload too large\");\n    std::string frame(4, '\\0');\n    put_u32(static_cast<std::uint32_t>(payload.size()), frame.data());\n    frame += payload;\n    return frame;\n}\n\n// Turns bytes, in pieces of any size, back into frames.\nclass FrameDecoder {\npublic:\n    // Adds bytes that arrived. Ignored once the decoder is broken.\n    void feed(std::string_view bytes)\n    {\n        if (!broken_)\n            buffer_ += bytes;\n    }\n\n    // The next complete frame's payload, or nothing if it hasn't all\n    // arrived yet, or if the stream is broken.\n    std::optional<std::string> next()\n    {\n        if (broken_ || buffer_.size() < 4)\n            return std::nullopt;\n        std::uint32_t length = get_u32(buffer_.data());\n        if (buffer_.size() - 4 < length)\n            return std::nullopt;\n        std::string payload = buffer_.substr(4, length);\n        buffer_.erase(0, 4 + std::size_t{length});\n        return payload;\n    }\n\n    // True once a header announced a frame bigger than max_frame.\n    bool broken() const { return broken_; }\n\n    // Bytes received but not yet returned as a frame.\n    std::size_t buffered() const { return buffer_.size(); }\n\nprivate:\n    std::string buffer_;\n    bool broken_ = false;\n};\n\n} // namespace net\n",
        },
        "run": [
          configure("frames"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "03-framing#Step 8 \u2014 The specification for frames over a socket": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "03-framing#Step 9 \u2014 Frames over a socket": {
    "wrong": [
      {
        "name": "allocated before checking the length",
        "files": {
          "net/frame.h": "// frame.h: length-prefixed messages (\"frames\") over a TCP stream.\n//\n// On the wire, a frame is a 4-byte length in network byte order\n// (big-endian), then that many bytes of payload:\n//\n//   00 00 00 05  h e l l o\n#pragma once\n\n#include <cstddef>\n#include <cstdint>\n#include <optional>\n#include <stdexcept>\n#include <string>\n#include <string_view>\n\n#include \"socket.h\"\n#include \"tcp.h\"\n\nnamespace net {\n\n// The largest payload we accept: 1 MiB. Without a limit, four bytes\n// of garbage could ask us to allocate 4 GB.\ninline constexpr std::uint32_t max_frame = 1024 * 1024;\n\ninline void put_u32(std::uint32_t value, char* out)\n{\n    out[0] = static_cast<char>(value >> 24);\n    out[1] = static_cast<char>(value >> 16);\n    out[2] = static_cast<char>(value >> 8);\n    out[3] = static_cast<char>(value);\n}\n\ninline std::uint32_t get_u32(const char* in)\n{\n    // char may be signed: convert to unsigned char first, or a byte\n    // like 0x80 becomes -128 and its sign bits spread across the rest.\n    auto byte = [&](int i) {\n        return std::uint32_t{static_cast<unsigned char>(in[i])};\n    };\n    return (byte(0) << 24) | (byte(1) << 16) | (byte(2) << 8) | byte(3);\n}\n\n// The 4-byte header followed by the payload.\ninline std::string encode_frame(std::string_view payload)\n{\n    if (payload.size() > max_frame)\n        throw std::length_error(\"frame payload too large\");\n    std::string frame(4, '\\0');\n    put_u32(static_cast<std::uint32_t>(payload.size()), frame.data());\n    frame += payload;\n    return frame;\n}\n\n// Turns bytes, in pieces of any size, back into frames.\nclass FrameDecoder {\npublic:\n    // Adds bytes that arrived. Ignored once the decoder is broken.\n    void feed(std::string_view bytes)\n    {\n        if (!broken_)\n            buffer_ += bytes;\n    }\n\n    // The next complete frame's payload, or nothing if it hasn't all\n    // arrived yet, or if the stream is broken.\n    std::optional<std::string> next()\n    {\n        if (broken_ || buffer_.size() < 4)\n            return std::nullopt;\n        std::uint32_t length = get_u32(buffer_.data());\n        if (length > max_frame) {\n            broken_ = true;   // no way to find the next frame: give up\n            buffer_.clear();\n            return std::nullopt;\n        }\n        if (buffer_.size() - 4 < length)\n            return std::nullopt;\n        std::string payload = buffer_.substr(4, length);\n        buffer_.erase(0, 4 + std::size_t{length});\n        return payload;\n    }\n\n    // True once a header announced a frame bigger than max_frame.\n    bool broken() const { return broken_; }\n\n    // Bytes received but not yet returned as a frame.\n    std::size_t buffered() const { return buffer_.size(); }\n\nprivate:\n    std::string buffer_;\n    bool broken_ = false;\n};\n\n// Sends one frame.\ninline bool send_frame(const Socket& s, std::string_view payload)\n{\n    return send_all(s, encode_frame(payload));\n}\n\n// Receives one frame into payload. False if the connection closed or\n// failed, or the frame is bigger than max_frame.\ninline bool recv_frame(const Socket& s, std::string& payload)\n{\n    char header[4];\n    if (!recv_exact(s, header, 4))\n        return false;\n    std::uint32_t length = get_u32(header);\n    payload.assign(length, '\\0');\n    return length == 0 || recv_exact(s, payload.data(), length);\n}\n\n} // namespace net\n",
        },
        "run": [
          configure("frames"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "04-chat-room#Step 1 \u2014 Waiting for many sockets at once": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-chat-room#Step 2 \u2014 The chat protocol": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-chat-room#Step 3 \u2014 The project's build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-chat-room#Step 4 \u2014 Test helpers for any server": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-chat-room#Step 5 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-chat-room#Step 6 \u2014 The event loop": {
    "run": [
      configure("chat"),
    ],
    "wrong": [
      {
        "name": "sent each line back to its sender too",
        "files": {
          "chat/chat_server.cpp": "#include \"chat_server.h\"\n\n#include <cstddef>\n#include <string_view>\n#include <utility>\n\n#include \"poller.h\"\n#include \"tcp.h\"\n\nChatServer::ChatServer() : listener_(net::listen_loopback()) {}\n\nstd::uint16_t ChatServer::port() const\n{\n    return net::local_port(listener_);\n}\n\nvoid ChatServer::stop()\n{\n    stopping_ = true;\n}\n\nvoid ChatServer::run()\n{\n    while (!stopping_) {\n        // Watch the listener, then every client, in that order.\n        std::vector<net::PollFd> fds;\n        fds.push_back(net::watch(listener_));\n        for (const Client& c : clients_)\n            fds.push_back(net::watch(c.socket));\n\n        // Wake up at least every 50 ms to notice stop().\n        if (net::poll(fds.data(), fds.size(), 50) <= 0)\n            continue;\n\n        // fds[i + 1] belongs to clients_[i]. Read before accepting:\n        // accept_new adds to clients_.\n        for (std::size_t i = 0; i < fds.size() - 1; ++i) {\n            if (fds[i + 1].revents != 0)\n                read_from(clients_[i]);\n        }\n        remove_dead();\n        if (fds[0].revents != 0)\n            accept_new();\n    }\n}\n\nvoid ChatServer::accept_new()\n{\n    Client client;\n    client.socket = net::accept_client(listener_);\n    clients_.push_back(std::move(client));\n}\n\nvoid ChatServer::read_from(Client& client)\n{\n    if (!client.alive)\n        return;   // a failed send already marked it\n    char buffer[4096];\n    long got = net::recv_some(client.socket, buffer, sizeof buffer);\n    if (got <= 0) {\n        client.alive = false;   // closed, or failed\n        return;\n    }\n    client.decoder.feed({buffer, static_cast<std::size_t>(got)});\n    while (auto frame = client.decoder.next())\n        handle(client, *frame);\n    if (client.decoder.broken())\n        client.alive = false;\n}\n\nvoid ChatServer::handle(Client& client, const std::string& frame)\n{\n    if (client.name.empty()) {\n        client.name = frame;\n        send_to(client, \"welcome \" + frame);\n        broadcast(\"* \" + frame + \" joined\", client);\n    } else {\n        broadcast(client.name + \": \" + frame, client);\n    }\n}\n\nvoid ChatServer::remove_dead()\n{\n    for (std::size_t i = 0; i < clients_.size();) {\n        if (clients_[i].alive) {\n            ++i;\n            continue;\n        }\n        Client gone = std::move(clients_[i]);\n        clients_.erase(clients_.begin() + static_cast<long>(i));\n        if (!gone.name.empty())\n            broadcast(\"* \" + gone.name + \" left\", gone);\n        i = 0;   // that broadcast may have found another dead client\n    }\n}\n\nvoid ChatServer::send_to(Client& client, const std::string& text)\n{\n    if (client.alive && !net::send_frame(client.socket, text))\n        client.alive = false;\n}\n\nvoid ChatServer::broadcast(const std::string& text, const Client& except)\n{\n    for (Client& c : clients_) {\n        if (!c.name.empty())\n            send_to(c, text);\n    }\n}\n",
        },
        "run": [
          configure("chat"),
        ],
        "fails": [
          2,
        ],
      },
      {
        "name": "removed leavers without a word",
        "files": {
          "chat/chat_server.cpp": "#include \"chat_server.h\"\n\n#include <cstddef>\n#include <string_view>\n\n#include \"poller.h\"\n#include \"tcp.h\"\n\nChatServer::ChatServer() : listener_(net::listen_loopback()) {}\n\nstd::uint16_t ChatServer::port() const\n{\n    return net::local_port(listener_);\n}\n\nvoid ChatServer::stop()\n{\n    stopping_ = true;\n}\n\nvoid ChatServer::run()\n{\n    while (!stopping_) {\n        // Watch the listener, then every client, in that order.\n        std::vector<net::PollFd> fds;\n        fds.push_back(net::watch(listener_));\n        for (const Client& c : clients_)\n            fds.push_back(net::watch(c.socket));\n\n        // Wake up at least every 50 ms to notice stop().\n        if (net::poll(fds.data(), fds.size(), 50) <= 0)\n            continue;\n\n        // fds[i + 1] belongs to clients_[i]. Read before accepting:\n        // accept_new adds to clients_.\n        for (std::size_t i = 0; i < fds.size() - 1; ++i) {\n            if (fds[i + 1].revents != 0)\n                read_from(clients_[i]);\n        }\n        remove_dead();\n        if (fds[0].revents != 0)\n            accept_new();\n    }\n}\n\nvoid ChatServer::accept_new()\n{\n    Client client;\n    client.socket = net::accept_client(listener_);\n    clients_.push_back(std::move(client));\n}\n\nvoid ChatServer::read_from(Client& client)\n{\n    if (!client.alive)\n        return;   // a failed send already marked it\n    char buffer[4096];\n    long got = net::recv_some(client.socket, buffer, sizeof buffer);\n    if (got <= 0) {\n        client.alive = false;   // closed, or failed\n        return;\n    }\n    client.decoder.feed({buffer, static_cast<std::size_t>(got)});\n    while (auto frame = client.decoder.next())\n        handle(client, *frame);\n    if (client.decoder.broken())\n        client.alive = false;\n}\n\nvoid ChatServer::handle(Client& client, const std::string& frame)\n{\n    if (client.name.empty()) {\n        client.name = frame;\n        send_to(client, \"welcome \" + frame);\n        broadcast(\"* \" + frame + \" joined\", client);\n    } else {\n        broadcast(client.name + \": \" + frame, client);\n    }\n}\n\nvoid ChatServer::remove_dead()\n{\n    std::erase_if(clients_, [](const Client& c) { return !c.alive; });\n}\n\nvoid ChatServer::send_to(Client& client, const std::string& text)\n{\n    if (client.alive && !net::send_frame(client.socket, text))\n        client.alive = false;\n}\n\nvoid ChatServer::broadcast(const std::string& text, const Client& except)\n{\n    for (Client& c : clients_) {\n        if (&c != &except && !c.name.empty())\n            send_to(c, text);\n    }\n}\n",
        },
        "run": [
          configure("chat"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "04-chat-room#Step 7 \u2014 Chat in three terminals": {
    "editFiles": {
      "chat/CMakeLists.txt": [
        [
          "add_executable(chat_tests ../testing/test_main.cpp ${TEST_SOURCES} ${LIB_SOURCES})",
          "add_executable(chat_tests ../testing/test_main.cpp ${TEST_SOURCES} ${LIB_SOURCES})\n\n# The chat program, to try by hand in several terminals.\nadd_executable(chat apps/chat.cpp ${LIB_SOURCES})",
        ],
      ],
    },
    "wrong": [
      {
        "name": "forgot the CMake line",
        "typeFile": true,
        "run": [
          configure("chat"),
        ],
        "fails": [
          0,
          2,
        ],
      },
    ],
  },
  "04-chat-room#Step 8 \u2014 Challenge: who is here?": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-chat-room#Step 9 \u2014 Challenge: /who": {
    "wrong": [
      {
        "name": "did not add /who",
        "files": {
          "chat/chat_server.cpp": "#include \"chat_server.h\"\n\n#include <cstddef>\n#include <string_view>\n#include <utility>\n\n#include \"poller.h\"\n#include \"tcp.h\"\n\nChatServer::ChatServer() : listener_(net::listen_loopback()) {}\n\nstd::uint16_t ChatServer::port() const\n{\n    return net::local_port(listener_);\n}\n\nvoid ChatServer::stop()\n{\n    stopping_ = true;\n}\n\nvoid ChatServer::run()\n{\n    while (!stopping_) {\n        // Watch the listener, then every client, in that order.\n        std::vector<net::PollFd> fds;\n        fds.push_back(net::watch(listener_));\n        for (const Client& c : clients_)\n            fds.push_back(net::watch(c.socket));\n\n        // Wake up at least every 50 ms to notice stop().\n        if (net::poll(fds.data(), fds.size(), 50) <= 0)\n            continue;\n\n        // fds[i + 1] belongs to clients_[i]. Read before accepting:\n        // accept_new adds to clients_.\n        for (std::size_t i = 0; i < fds.size() - 1; ++i) {\n            if (fds[i + 1].revents != 0)\n                read_from(clients_[i]);\n        }\n        remove_dead();\n        if (fds[0].revents != 0)\n            accept_new();\n    }\n}\n\nvoid ChatServer::accept_new()\n{\n    Client client;\n    client.socket = net::accept_client(listener_);\n    clients_.push_back(std::move(client));\n}\n\nvoid ChatServer::read_from(Client& client)\n{\n    if (!client.alive)\n        return;   // a failed send already marked it\n    char buffer[4096];\n    long got = net::recv_some(client.socket, buffer, sizeof buffer);\n    if (got <= 0) {\n        client.alive = false;   // closed, or failed\n        return;\n    }\n    client.decoder.feed({buffer, static_cast<std::size_t>(got)});\n    while (auto frame = client.decoder.next())\n        handle(client, *frame);\n    if (client.decoder.broken())\n        client.alive = false;\n}\n\nvoid ChatServer::handle(Client& client, const std::string& frame)\n{\n    if (client.name.empty()) {\n        client.name = frame;\n        send_to(client, \"welcome \" + frame);\n        broadcast(\"* \" + frame + \" joined\", client);\n    } else {\n        broadcast(client.name + \": \" + frame, client);\n    }\n}\n\nvoid ChatServer::remove_dead()\n{\n    for (std::size_t i = 0; i < clients_.size();) {\n        if (clients_[i].alive) {\n            ++i;\n            continue;\n        }\n        Client gone = std::move(clients_[i]);\n        clients_.erase(clients_.begin() + static_cast<long>(i));\n        if (!gone.name.empty())\n            broadcast(\"* \" + gone.name + \" left\", gone);\n        i = 0;   // that broadcast may have found another dead client\n    }\n}\n\nvoid ChatServer::send_to(Client& client, const std::string& text)\n{\n    if (client.alive && !net::send_frame(client.socket, text))\n        client.alive = false;\n}\n\nvoid ChatServer::broadcast(const std::string& text, const Client& except)\n{\n    for (Client& c : clients_) {\n        if (&c != &except && !c.name.empty())\n            send_to(c, text);\n    }\n}\n",
        },
        "run": [
          configure("chat"),
        ],
        "fails": [
          1,
        ],
      },
      {
        "name": "listed clients without a name",
        "files": {
          "chat/chat_server.cpp": "#include \"chat_server.h\"\n\n#include <cstddef>\n#include <string_view>\n#include <utility>\n\n#include \"poller.h\"\n#include \"tcp.h\"\n\nChatServer::ChatServer() : listener_(net::listen_loopback()) {}\n\nstd::uint16_t ChatServer::port() const\n{\n    return net::local_port(listener_);\n}\n\nvoid ChatServer::stop()\n{\n    stopping_ = true;\n}\n\nvoid ChatServer::run()\n{\n    while (!stopping_) {\n        // Watch the listener, then every client, in that order.\n        std::vector<net::PollFd> fds;\n        fds.push_back(net::watch(listener_));\n        for (const Client& c : clients_)\n            fds.push_back(net::watch(c.socket));\n\n        // Wake up at least every 50 ms to notice stop().\n        if (net::poll(fds.data(), fds.size(), 50) <= 0)\n            continue;\n\n        // fds[i + 1] belongs to clients_[i]. Read before accepting:\n        // accept_new adds to clients_.\n        for (std::size_t i = 0; i < fds.size() - 1; ++i) {\n            if (fds[i + 1].revents != 0)\n                read_from(clients_[i]);\n        }\n        remove_dead();\n        if (fds[0].revents != 0)\n            accept_new();\n    }\n}\n\nvoid ChatServer::accept_new()\n{\n    Client client;\n    client.socket = net::accept_client(listener_);\n    clients_.push_back(std::move(client));\n}\n\nvoid ChatServer::read_from(Client& client)\n{\n    if (!client.alive)\n        return;   // a failed send already marked it\n    char buffer[4096];\n    long got = net::recv_some(client.socket, buffer, sizeof buffer);\n    if (got <= 0) {\n        client.alive = false;   // closed, or failed\n        return;\n    }\n    client.decoder.feed({buffer, static_cast<std::size_t>(got)});\n    while (auto frame = client.decoder.next())\n        handle(client, *frame);\n    if (client.decoder.broken())\n        client.alive = false;\n}\n\nvoid ChatServer::handle(Client& client, const std::string& frame)\n{\n    if (client.name.empty()) {\n        client.name = frame;\n        send_to(client, \"welcome \" + frame);\n        broadcast(\"* \" + frame + \" joined\", client);\n    } else if (frame == \"/who\") {\n        std::string names;\n        for (const Client& c : clients_)\n            names += (names.empty() ? \"\" : \", \") + c.name;\n        send_to(client, \"online: \" + names);\n    } else {\n        broadcast(client.name + \": \" + frame, client);\n    }\n}\n\nvoid ChatServer::remove_dead()\n{\n    for (std::size_t i = 0; i < clients_.size();) {\n        if (clients_[i].alive) {\n            ++i;\n            continue;\n        }\n        Client gone = std::move(clients_[i]);\n        clients_.erase(clients_.begin() + static_cast<long>(i));\n        if (!gone.name.empty())\n            broadcast(\"* \" + gone.name + \" left\", gone);\n        i = 0;   // that broadcast may have found another dead client\n    }\n}\n\nvoid ChatServer::send_to(Client& client, const std::string& text)\n{\n    if (client.alive && !net::send_frame(client.socket, text))\n        client.alive = false;\n}\n\nvoid ChatServer::broadcast(const std::string& text, const Client& except)\n{\n    for (Client& c : clients_) {\n        if (&c != &except && !c.name.empty())\n            send_to(c, text);\n    }\n}\n",
        },
        "run": [
          configure("chat"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "05-http-server#Step 1 \u2014 The interface": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-http-server#Step 2 \u2014 The project's build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-http-server#Step 3 \u2014 The specification for the parser": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-http-server#Step 4 \u2014 The parser": {
    "run": [
      configure("http"),
    ],
    "wrong": [
      {
        "name": "split headers at the last colon",
        "files": {
          "http/http.cpp": "#include \"http.h\"\n\n#include <cctype>\n#include <cstddef>\n\nnamespace http {\n\nnamespace {\n\nstd::string lower(std::string_view s)\n{\n    std::string out(s);\n    for (char& c : out)\n        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));\n    return out;\n}\n\nstd::string_view trim(std::string_view s)\n{\n    while (!s.empty() && (s.front() == ' ' || s.front() == '\\t'))\n        s.remove_prefix(1);\n    while (!s.empty() && (s.back() == ' ' || s.back() == '\\t'))\n        s.remove_suffix(1);\n    return s;\n}\n\n// Splits text into lines that end in \"\\r\\n\". The last line may lack\n// one, since the head arrives without its final \"\\r\\n\\r\\n\".\nstd::vector<std::string_view> lines(std::string_view text)\n{\n    std::vector<std::string_view> out;\n    while (!text.empty()) {\n        std::size_t end = text.find(\"\\r\\n\");\n        out.push_back(text.substr(0, end));\n        if (end == std::string_view::npos)\n            break;\n        text.remove_prefix(end + 2);\n    }\n    return out;\n}\n\n} // namespace\n\nstd::string Request::header(std::string_view name) const\n{\n    std::string wanted = lower(name);\n    for (const auto& [n, value] : headers) {\n        if (n == wanted)\n            return value;\n    }\n    return \"\";\n}\n\nstd::optional<Request> parse_request(std::string_view head)\n{\n    std::vector<std::string_view> all = lines(head);\n    if (all.empty())\n        return std::nullopt;\n\n    // The request line: METHOD SP TARGET SP VERSION, single spaces.\n    std::string_view line = all[0];\n    std::size_t first = line.find(' ');\n    std::size_t second = line.find(' ', first + 1);\n    if (first == std::string_view::npos || second == std::string_view::npos ||\n        line.find(' ', second + 1) != std::string_view::npos)\n        return std::nullopt;\n    Request r;\n    r.method = line.substr(0, first);\n    r.target = line.substr(first + 1, second - first - 1);\n    r.version = line.substr(second + 1);\n    if (r.method.empty() || r.target.empty() || r.target[0] != '/' ||\n        r.version.rfind(\"HTTP/1.\", 0) != 0)\n        return std::nullopt;\n\n    // Header lines: NAME \":\" VALUE. Split at the FIRST colon only:\n    // \"Host: localhost:8080\" has a colon in its value.\n    for (std::size_t i = 1; i < all.size(); ++i) {\n        std::size_t colon = all[i].rfind(':');\n        if (colon == std::string_view::npos || colon == 0)\n            return std::nullopt;\n        r.headers.emplace_back(lower(all[i].substr(0, colon)),\n                               std::string(trim(all[i].substr(colon + 1))));\n    }\n    return r;\n}\n\n} // namespace http\n",
        },
        "run": [
          configure("http"),
        ],
        "fails": [
          2,
        ],
      },
      {
        "name": "kept header names as sent",
        "files": {
          "http/http.cpp": "#include \"http.h\"\n\n#include <cctype>\n#include <cstddef>\n\nnamespace http {\n\nnamespace {\n\nstd::string lower(std::string_view s)\n{\n    std::string out(s);\n    for (char& c : out)\n        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));\n    return out;\n}\n\nstd::string_view trim(std::string_view s)\n{\n    while (!s.empty() && (s.front() == ' ' || s.front() == '\\t'))\n        s.remove_prefix(1);\n    while (!s.empty() && (s.back() == ' ' || s.back() == '\\t'))\n        s.remove_suffix(1);\n    return s;\n}\n\n// Splits text into lines that end in \"\\r\\n\". The last line may lack\n// one, since the head arrives without its final \"\\r\\n\\r\\n\".\nstd::vector<std::string_view> lines(std::string_view text)\n{\n    std::vector<std::string_view> out;\n    while (!text.empty()) {\n        std::size_t end = text.find(\"\\r\\n\");\n        out.push_back(text.substr(0, end));\n        if (end == std::string_view::npos)\n            break;\n        text.remove_prefix(end + 2);\n    }\n    return out;\n}\n\n} // namespace\n\nstd::string Request::header(std::string_view name) const\n{\n    std::string wanted = lower(name);\n    for (const auto& [n, value] : headers) {\n        if (n == wanted)\n            return value;\n    }\n    return \"\";\n}\n\nstd::optional<Request> parse_request(std::string_view head)\n{\n    std::vector<std::string_view> all = lines(head);\n    if (all.empty())\n        return std::nullopt;\n\n    // The request line: METHOD SP TARGET SP VERSION, single spaces.\n    std::string_view line = all[0];\n    std::size_t first = line.find(' ');\n    std::size_t second = line.find(' ', first + 1);\n    if (first == std::string_view::npos || second == std::string_view::npos ||\n        line.find(' ', second + 1) != std::string_view::npos)\n        return std::nullopt;\n    Request r;\n    r.method = line.substr(0, first);\n    r.target = line.substr(first + 1, second - first - 1);\n    r.version = line.substr(second + 1);\n    if (r.method.empty() || r.target.empty() || r.target[0] != '/' ||\n        r.version.rfind(\"HTTP/1.\", 0) != 0)\n        return std::nullopt;\n\n    // Header lines: NAME \":\" VALUE. Split at the FIRST colon only:\n    // \"Host: localhost:8080\" has a colon in its value.\n    for (std::size_t i = 1; i < all.size(); ++i) {\n        std::size_t colon = all[i].find(':');\n        if (colon == std::string_view::npos || colon == 0)\n            return std::nullopt;\n        r.headers.emplace_back(std::string(all[i].substr(0, colon)),\n                               std::string(trim(all[i].substr(colon + 1))));\n    }\n    return r;\n}\n\n} // namespace http\n",
        },
        "run": [
          configure("http"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "05-http-server#Step 5 \u2014 Your tests for responses": {
    "wrong": [
      {
        "name": "only the format test",
        "files": {
          "http/tests/response_test.cpp": "// My own tests for responses and routes.\n#include \"studio_test.hpp\"\n\n#include <string>\n\n#include \"http.h\"\n\nnamespace {\n\nhttp::Response get(const std::string& target)\n{\n    return http::handle(*http::parse_request(\"GET \" + target + \" HTTP/1.1\"));\n}\n\n} // namespace\n\nTEST(formats_a_response_with_content_length)\n{\n    http::Response r{200, \"text/plain\", \"hi\\n\"};\n    CHECK_EQ(http::format_response(r),\n             std::string(\"HTTP/1.1 200 OK\\r\\n\"\n                         \"Content-Type: text/plain\\r\\n\"\n                         \"Content-Length: 3\\r\\n\"\n                         \"Connection: close\\r\\n\"\n                         \"\\r\\n\"\n                         \"hi\\n\"));\n}\n\n",
        },
        "fails": [
          1,
          2,
          3,
        ],
      },
    ],
  },
  "05-http-server#Step 6 \u2014 Responses and routes": {
    "wrong": [
      {
        "name": "forgot the blank line",
        "files": {
          "http/http.cpp": "#include \"http.h\"\n\n#include <cctype>\n#include <cstddef>\n\nnamespace http {\n\nnamespace {\n\nstd::string lower(std::string_view s)\n{\n    std::string out(s);\n    for (char& c : out)\n        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));\n    return out;\n}\n\nstd::string_view trim(std::string_view s)\n{\n    while (!s.empty() && (s.front() == ' ' || s.front() == '\\t'))\n        s.remove_prefix(1);\n    while (!s.empty() && (s.back() == ' ' || s.back() == '\\t'))\n        s.remove_suffix(1);\n    return s;\n}\n\n// Splits text into lines that end in \"\\r\\n\". The last line may lack\n// one, since the head arrives without its final \"\\r\\n\\r\\n\".\nstd::vector<std::string_view> lines(std::string_view text)\n{\n    std::vector<std::string_view> out;\n    while (!text.empty()) {\n        std::size_t end = text.find(\"\\r\\n\");\n        out.push_back(text.substr(0, end));\n        if (end == std::string_view::npos)\n            break;\n        text.remove_prefix(end + 2);\n    }\n    return out;\n}\n\n} // namespace\n\nstd::string Request::header(std::string_view name) const\n{\n    std::string wanted = lower(name);\n    for (const auto& [n, value] : headers) {\n        if (n == wanted)\n            return value;\n    }\n    return \"\";\n}\n\nstd::optional<Request> parse_request(std::string_view head)\n{\n    std::vector<std::string_view> all = lines(head);\n    if (all.empty())\n        return std::nullopt;\n\n    // The request line: METHOD SP TARGET SP VERSION, single spaces.\n    std::string_view line = all[0];\n    std::size_t first = line.find(' ');\n    std::size_t second = line.find(' ', first + 1);\n    if (first == std::string_view::npos || second == std::string_view::npos ||\n        line.find(' ', second + 1) != std::string_view::npos)\n        return std::nullopt;\n    Request r;\n    r.method = line.substr(0, first);\n    r.target = line.substr(first + 1, second - first - 1);\n    r.version = line.substr(second + 1);\n    if (r.method.empty() || r.target.empty() || r.target[0] != '/' ||\n        r.version.rfind(\"HTTP/1.\", 0) != 0)\n        return std::nullopt;\n\n    // Header lines: NAME \":\" VALUE. Split at the FIRST colon only:\n    // \"Host: localhost:8080\" has a colon in its value.\n    for (std::size_t i = 1; i < all.size(); ++i) {\n        std::size_t colon = all[i].find(':');\n        if (colon == std::string_view::npos || colon == 0)\n            return std::nullopt;\n        r.headers.emplace_back(lower(all[i].substr(0, colon)),\n                               std::string(trim(all[i].substr(colon + 1))));\n    }\n    return r;\n}\n\nstd::string reason_phrase(int status)\n{\n    switch (status) {\n    case 200: return \"OK\";\n    case 400: return \"Bad Request\";\n    case 404: return \"Not Found\";\n    case 405: return \"Method Not Allowed\";\n    default: return \"Unknown\";\n    }\n}\n\nstd::string format_response(const Response& response)\n{\n    // Content-Length counts bytes, not characters: body.size().\n    return \"HTTP/1.1 \" + std::to_string(response.status) + \" \" +\n           reason_phrase(response.status) + \"\\r\\n\" +\n           \"Content-Type: \" + response.content_type + \"\\r\\n\" +\n           \"Content-Length: \" + std::to_string(response.body.size()) + \"\\r\\n\" +\n           \"Connection: close\\r\\n\" +\n           response.body;\n}\n\nResponse handle(const Request& request)\n{\n    if (request.method != \"GET\")\n        return {405, \"text/plain; charset=utf-8\", \"only GET is allowed\\n\"};\n    if (request.target == \"/\")\n        return {200, \"text/html; charset=utf-8\",\n                \"<!doctype html>\\n<title>C++ server</title>\\n\"\n                \"<h1>Hello from C++</h1>\\n\"\n                \"<p>This page came from your own HTTP server.</p>\\n\"};\n    if (request.target == \"/agent\")\n        return {200, \"text/plain; charset=utf-8\",\n                \"you are using \" + request.header(\"User-Agent\") + \"\\n\"};\n    return {404, \"text/plain; charset=utf-8\",\n            \"not found: \" + request.target + \"\\n\"};\n}\n\n} // namespace http\n",
        },
        "run": [
          configure("http"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "05-http-server#Step 7 \u2014 The specification for the server": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-http-server#Step 8 \u2014 The server": {
    "wrong": [
      {
        "name": "parsed the blank line too",
        "files": {
          "http/http_server.cpp": "#include <cstddef>\n#include <string>\n\n#include \"http.h\"\n#include \"poller.h\"\n#include \"tcp.h\"\n\nnamespace http {\n\nServer::Server() : listener_(net::listen_loopback()) {}\n\nstd::uint16_t Server::port() const\n{\n    return net::local_port(listener_);\n}\n\nvoid Server::stop()\n{\n    stopping_ = true;\n}\n\nvoid Server::run()\n{\n    while (!stopping_) {\n        // Wait at most 50 ms for a client, then look at stopping_.\n        net::PollFd fd = net::watch(listener_);\n        if (net::poll(&fd, 1, 50) <= 0)\n            continue;\n        net::Socket client = net::accept_client(listener_);\n        serve(client);\n    }   // client closes here: \"Connection: close\"\n}\n\nvoid Server::serve(net::Socket& client)\n{\n    // A client that stops sending mid-request mustn't freeze the\n    // server forever: give up on it after 5 seconds.\n    net::set_receive_timeout(client, 5000);\n\n    // Read until the blank line that ends the head. It can arrive in\n    // any number of pieces.\n    std::string received;\n    std::size_t end;\n    while ((end = received.find(\"\\r\\n\\r\\n\")) == std::string::npos) {\n        if (received.size() > 8192) {\n            net::send_all(client, format_response(\n                {400, \"text/plain; charset=utf-8\", \"head too large\\n\"}));\n            return;\n        }\n        char buffer[4096];\n        long got = net::recv_some(client, buffer, sizeof buffer);\n        if (got <= 0)\n            return;   // gone, or too slow: nobody to answer\n        received.append(buffer, static_cast<std::size_t>(got));\n    }\n\n    auto request = parse_request(received);\n    Response response = request\n        ? handle(*request)\n        : Response{400, \"text/plain; charset=utf-8\", \"bad request\\n\"};\n    net::send_all(client, format_response(response));\n}\n\n} // namespace http\n",
        },
        "run": [
          configure("http"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "05-http-server#Step 9 \u2014 Your browser as the client": {
    "editFiles": {
      "http/CMakeLists.txt": [
        [
          "add_executable(http_tests ../testing/test_main.cpp ${TEST_SOURCES} ${LIB_SOURCES})",
          "add_executable(http_tests ../testing/test_main.cpp ${TEST_SOURCES} ${LIB_SOURCES})\n\n# The server as a program, for a browser or curl.\nadd_executable(http_server apps/serve.cpp ${LIB_SOURCES})",
        ],
      ],
    },
    "wrong": [
      {
        "name": "forgot the CMake line",
        "typeFile": true,
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-game-server#Step 1 \u2014 The rules": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-game-server#Step 2 \u2014 The project's build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-game-server#Step 3 \u2014 Your tests for the rules": {
    "wrong": [
      {
        "name": "only the first test",
        "files": {
          "ttt/tests/board_test.cpp": "// My own tests for the rules.\n#include \"studio_test.hpp\"\n\n#include \"board.h\"\n\nTEST(place_rejects_taken_and_out_of_range_cells)\n{\n    Board b;\n    CHECK(b.place(4, 'X'));\n    CHECK(!b.place(4, 'O'));\n    CHECK_EQ(b.at(4), 'X');\n    CHECK(!b.place(-1, 'O'));\n    CHECK(!b.place(9, 'O'));\n    CHECK_EQ(b.str(), std::string(\"....X....\"));\n}\n\n",
        },
        "fails": [
          1,
          2,
        ],
      },
    ],
  },
  "06-game-server#Step 4 \u2014 The board": {
    "run": [
      configure("ttt"),
    ],
    "wrong": [
      {
        "name": "forgot the diagonals",
        "files": {
          "ttt/board.cpp": "#include \"board.h\"\n\nchar Board::at(int cell) const\n{\n    return cells_[static_cast<std::size_t>(cell)];\n}\n\nbool Board::place(int cell, char mark)\n{\n    if (cell < 0 || cell > 8 || at(cell) != '.')\n        return false;\n    cells_[static_cast<std::size_t>(cell)] = mark;\n    return true;\n}\n\nchar Board::winner() const\n{\n    static const int lines[6][3] = {\n        {0, 1, 2}, {3, 4, 5}, {6, 7, 8},   // rows\n        {0, 3, 6}, {1, 4, 7}, {2, 5, 8},   // columns\n    };\n    for (const auto& line : lines) {\n        char a = at(line[0]);\n        if (a != '.' && a == at(line[1]) && a == at(line[2]))\n            return a;\n    }\n    return '.';\n}\n\nbool Board::full() const\n{\n    return cells_.find('.') == std::string::npos;\n}\n\nstd::string Board::str() const\n{\n    return cells_;\n}\n",
        },
        "run": [
          configure("ttt"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "06-game-server#Step 5 \u2014 The game protocol": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-game-server#Step 6 \u2014 The specification for a game": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-game-server#Step 7 \u2014 The game server": {
    "wrong": [
      {
        "name": "never changed turns",
        "files": {
          "ttt/game_server.cpp": "#include \"game_server.h\"\n\n#include <cstddef>\n#include <utility>\n\n#include \"poller.h\"\n#include \"tcp.h\"\n\nGameServer::GameServer() : listener_(net::listen_loopback()) {}\n\nstd::uint16_t GameServer::port() const\n{\n    return net::local_port(listener_);\n}\n\nvoid GameServer::stop()\n{\n    stopping_ = true;\n}\n\nvoid GameServer::run()\n{\n    while (!stopping_ && !over_) {\n        std::vector<net::PollFd> fds;\n        fds.push_back(net::watch(listener_));\n        for (const Player& p : players_)\n            fds.push_back(net::watch(p.socket));\n        if (net::poll(fds.data(), fds.size(), 50) <= 0)\n            continue;\n\n        for (std::size_t i = 0; i < players_.size() && !over_; ++i) {\n            if (fds[i + 1].revents != 0 && !read_from(players_[i])) {\n                over_ = true;   // a player left: the game can't go on\n                for (Player& other : players_) {\n                    if (&other != &players_[i])\n                        send_to(other, std::string(\"left \") +\n                                           players_[i].mark);\n                }\n            }\n        }\n        if (!over_ && fds[0].revents != 0)\n            accept_new();\n    }\n    players_.clear();   // closes both connections\n}\n\nvoid GameServer::accept_new()\n{\n    net::Socket socket = net::accept_client(listener_);\n    if (players_.size() == 2) {\n        net::send_frame(socket, \"full\");\n        return;   // socket closes here\n    }\n    char mark = players_.empty() ? 'X' : 'O';\n    players_.push_back(Player{std::move(socket), {}, mark});\n    send_to(players_.back(), std::string(\"you \") + mark);\n    if (players_.size() == 2) {\n        tell_both(\"board \" + board_.str());\n        tell_both(\"turn X\");\n    }\n}\n\nbool GameServer::read_from(Player& player)\n{\n    char buffer[4096];\n    long got = net::recv_some(player.socket, buffer, sizeof buffer);\n    if (got <= 0)\n        return false;\n    player.decoder.feed({buffer, static_cast<std::size_t>(got)});\n    while (!over_) {\n        auto message = player.decoder.next();\n        if (!message)\n            break;\n        handle(player, *message);\n    }\n    return !player.decoder.broken();\n}\n\nvoid GameServer::handle(Player& player, const std::string& message)\n{\n    if (players_.size() < 2) {\n        send_to(player, \"error waiting for opponent\");\n        return;\n    }\n    // \"move N\", with N one digit.\n    if (message.size() != 6 || message.rfind(\"move \", 0) != 0 ||\n        message[5] < '0' || message[5] > '8') {\n        send_to(player, \"error bad move\");\n        return;\n    }\n    if (player.mark != turn_) {\n        send_to(player, \"error not your turn\");\n        return;\n    }\n    if (!board_.place(message[5] - '0', player.mark)) {\n        send_to(player, \"error taken\");\n        return;\n    }\n\n    tell_both(\"board \" + board_.str());\n    if (board_.winner() != '.') {\n        tell_both(std::string(\"win \") + board_.winner());\n        over_ = true;\n    } else if (board_.full()) {\n        tell_both(\"draw\");\n        over_ = true;\n    } else {\n        tell_both(std::string(\"turn \") + turn_);\n    }\n}\n\nvoid GameServer::send_to(Player& player, const std::string& text)\n{\n    net::send_frame(player.socket, text);   // a failure shows up as a read\n}\n\nvoid GameServer::tell_both(const std::string& text)\n{\n    for (Player& p : players_)\n        send_to(p, text);\n}\n",
        },
        "run": [
          configure("ttt"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "06-game-server#Step 8 \u2014 The reviewer's tests": {
    "wrong": [
      {
        "name": "trusted players to take turns",
        "typeFile": true,
        "files": {
          "ttt/game_server.cpp": "#include \"game_server.h\"\n\n#include <cstddef>\n#include <utility>\n\n#include \"poller.h\"\n#include \"tcp.h\"\n\nGameServer::GameServer() : listener_(net::listen_loopback()) {}\n\nstd::uint16_t GameServer::port() const\n{\n    return net::local_port(listener_);\n}\n\nvoid GameServer::stop()\n{\n    stopping_ = true;\n}\n\nvoid GameServer::run()\n{\n    while (!stopping_ && !over_) {\n        std::vector<net::PollFd> fds;\n        fds.push_back(net::watch(listener_));\n        for (const Player& p : players_)\n            fds.push_back(net::watch(p.socket));\n        if (net::poll(fds.data(), fds.size(), 50) <= 0)\n            continue;\n\n        for (std::size_t i = 0; i < players_.size() && !over_; ++i) {\n            if (fds[i + 1].revents != 0 && !read_from(players_[i])) {\n                over_ = true;   // a player left: the game can't go on\n                for (Player& other : players_) {\n                    if (&other != &players_[i])\n                        send_to(other, std::string(\"left \") +\n                                           players_[i].mark);\n                }\n            }\n        }\n        if (!over_ && fds[0].revents != 0)\n            accept_new();\n    }\n    players_.clear();   // closes both connections\n}\n\nvoid GameServer::accept_new()\n{\n    net::Socket socket = net::accept_client(listener_);\n    if (players_.size() == 2) {\n        net::send_frame(socket, \"full\");\n        return;   // socket closes here\n    }\n    char mark = players_.empty() ? 'X' : 'O';\n    players_.push_back(Player{std::move(socket), {}, mark});\n    send_to(players_.back(), std::string(\"you \") + mark);\n    if (players_.size() == 2) {\n        tell_both(\"board \" + board_.str());\n        tell_both(\"turn X\");\n    }\n}\n\nbool GameServer::read_from(Player& player)\n{\n    char buffer[4096];\n    long got = net::recv_some(player.socket, buffer, sizeof buffer);\n    if (got <= 0)\n        return false;\n    player.decoder.feed({buffer, static_cast<std::size_t>(got)});\n    while (!over_) {\n        auto message = player.decoder.next();\n        if (!message)\n            break;\n        handle(player, *message);\n    }\n    return !player.decoder.broken();\n}\n\nvoid GameServer::handle(Player& player, const std::string& message)\n{\n    if (players_.size() < 2) {\n        send_to(player, \"error waiting for opponent\");\n        return;\n    }\n    // \"move N\", with N one digit.\n    if (message.size() != 6 || message.rfind(\"move \", 0) != 0 ||\n        message[5] < '0' || message[5] > '8') {\n        send_to(player, \"error bad move\");\n        return;\n    }\n    if (!board_.place(message[5] - '0', player.mark)) {\n        send_to(player, \"error taken\");\n        return;\n    }\n\n    tell_both(\"board \" + board_.str());\n    if (board_.winner() != '.') {\n        tell_both(std::string(\"win \") + board_.winner());\n        over_ = true;\n    } else if (board_.full()) {\n        tell_both(\"draw\");\n        over_ = true;\n    } else {\n        turn_ = turn_ == 'X' ? 'O' : 'X';\n        tell_both(std::string(\"turn \") + turn_);\n    }\n}\n\nvoid GameServer::send_to(Player& player, const std::string& text)\n{\n    net::send_frame(player.socket, text);   // a failure shows up as a read\n}\n\nvoid GameServer::tell_both(const std::string& text)\n{\n    for (Player& p : players_)\n        send_to(p, text);\n}\n",
        },
        "run": [
          configure("ttt"),
        ],
        "fails": [
          1,
        ],
      },
      {
        "name": "accepted move 9",
        "typeFile": true,
        "files": {
          "ttt/game_server.cpp": "#include \"game_server.h\"\n\n#include <cstddef>\n#include <utility>\n\n#include \"poller.h\"\n#include \"tcp.h\"\n\nGameServer::GameServer() : listener_(net::listen_loopback()) {}\n\nstd::uint16_t GameServer::port() const\n{\n    return net::local_port(listener_);\n}\n\nvoid GameServer::stop()\n{\n    stopping_ = true;\n}\n\nvoid GameServer::run()\n{\n    while (!stopping_ && !over_) {\n        std::vector<net::PollFd> fds;\n        fds.push_back(net::watch(listener_));\n        for (const Player& p : players_)\n            fds.push_back(net::watch(p.socket));\n        if (net::poll(fds.data(), fds.size(), 50) <= 0)\n            continue;\n\n        for (std::size_t i = 0; i < players_.size() && !over_; ++i) {\n            if (fds[i + 1].revents != 0 && !read_from(players_[i])) {\n                over_ = true;   // a player left: the game can't go on\n                for (Player& other : players_) {\n                    if (&other != &players_[i])\n                        send_to(other, std::string(\"left \") +\n                                           players_[i].mark);\n                }\n            }\n        }\n        if (!over_ && fds[0].revents != 0)\n            accept_new();\n    }\n    players_.clear();   // closes both connections\n}\n\nvoid GameServer::accept_new()\n{\n    net::Socket socket = net::accept_client(listener_);\n    if (players_.size() == 2) {\n        net::send_frame(socket, \"full\");\n        return;   // socket closes here\n    }\n    char mark = players_.empty() ? 'X' : 'O';\n    players_.push_back(Player{std::move(socket), {}, mark});\n    send_to(players_.back(), std::string(\"you \") + mark);\n    if (players_.size() == 2) {\n        tell_both(\"board \" + board_.str());\n        tell_both(\"turn X\");\n    }\n}\n\nbool GameServer::read_from(Player& player)\n{\n    char buffer[4096];\n    long got = net::recv_some(player.socket, buffer, sizeof buffer);\n    if (got <= 0)\n        return false;\n    player.decoder.feed({buffer, static_cast<std::size_t>(got)});\n    while (!over_) {\n        auto message = player.decoder.next();\n        if (!message)\n            break;\n        handle(player, *message);\n    }\n    return !player.decoder.broken();\n}\n\nvoid GameServer::handle(Player& player, const std::string& message)\n{\n    if (players_.size() < 2) {\n        send_to(player, \"error waiting for opponent\");\n        return;\n    }\n    // \"move N\", with N one digit.\n    if (message.size() != 6 || message.rfind(\"move \", 0) != 0 ||\n        message[5] < '0' || message[5] > '9') {\n        send_to(player, \"error bad move\");\n        return;\n    }\n    if (player.mark != turn_) {\n        send_to(player, \"error not your turn\");\n        return;\n    }\n    if (!board_.place(message[5] - '0', player.mark)) {\n        send_to(player, \"error taken\");\n        return;\n    }\n\n    tell_both(\"board \" + board_.str());\n    if (board_.winner() != '.') {\n        tell_both(std::string(\"win \") + board_.winner());\n        over_ = true;\n    } else if (board_.full()) {\n        tell_both(\"draw\");\n        over_ = true;\n    } else {\n        turn_ = turn_ == 'X' ? 'O' : 'X';\n        tell_both(std::string(\"turn \") + turn_);\n    }\n}\n\nvoid GameServer::send_to(Player& player, const std::string& text)\n{\n    net::send_frame(player.socket, text);   // a failure shows up as a read\n}\n\nvoid GameServer::tell_both(const std::string& text)\n{\n    for (Player& p : players_)\n        send_to(p, text);\n}\n",
        },
        "run": [
          configure("ttt"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "06-game-server#Step 9 \u2014 Challenge: the specification for talking": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-game-server#Step 10 \u2014 Challenge: say": {
    "wrong": [
      {
        "name": "did not add say",
        "files": {
          "ttt/game_server.cpp": "#include \"game_server.h\"\n\n#include <cstddef>\n#include <utility>\n\n#include \"poller.h\"\n#include \"tcp.h\"\n\nGameServer::GameServer() : listener_(net::listen_loopback()) {}\n\nstd::uint16_t GameServer::port() const\n{\n    return net::local_port(listener_);\n}\n\nvoid GameServer::stop()\n{\n    stopping_ = true;\n}\n\nvoid GameServer::run()\n{\n    while (!stopping_ && !over_) {\n        std::vector<net::PollFd> fds;\n        fds.push_back(net::watch(listener_));\n        for (const Player& p : players_)\n            fds.push_back(net::watch(p.socket));\n        if (net::poll(fds.data(), fds.size(), 50) <= 0)\n            continue;\n\n        for (std::size_t i = 0; i < players_.size() && !over_; ++i) {\n            if (fds[i + 1].revents != 0 && !read_from(players_[i])) {\n                over_ = true;   // a player left: the game can't go on\n                for (Player& other : players_) {\n                    if (&other != &players_[i])\n                        send_to(other, std::string(\"left \") +\n                                           players_[i].mark);\n                }\n            }\n        }\n        if (!over_ && fds[0].revents != 0)\n            accept_new();\n    }\n    players_.clear();   // closes both connections\n}\n\nvoid GameServer::accept_new()\n{\n    net::Socket socket = net::accept_client(listener_);\n    if (players_.size() == 2) {\n        net::send_frame(socket, \"full\");\n        return;   // socket closes here\n    }\n    char mark = players_.empty() ? 'X' : 'O';\n    players_.push_back(Player{std::move(socket), {}, mark});\n    send_to(players_.back(), std::string(\"you \") + mark);\n    if (players_.size() == 2) {\n        tell_both(\"board \" + board_.str());\n        tell_both(\"turn X\");\n    }\n}\n\nbool GameServer::read_from(Player& player)\n{\n    char buffer[4096];\n    long got = net::recv_some(player.socket, buffer, sizeof buffer);\n    if (got <= 0)\n        return false;\n    player.decoder.feed({buffer, static_cast<std::size_t>(got)});\n    while (!over_) {\n        auto message = player.decoder.next();\n        if (!message)\n            break;\n        handle(player, *message);\n    }\n    return !player.decoder.broken();\n}\n\nvoid GameServer::handle(Player& player, const std::string& message)\n{\n    if (players_.size() < 2) {\n        send_to(player, \"error waiting for opponent\");\n        return;\n    }\n    // \"move N\", with N one digit.\n    if (message.size() != 6 || message.rfind(\"move \", 0) != 0 ||\n        message[5] < '0' || message[5] > '8') {\n        send_to(player, \"error bad move\");\n        return;\n    }\n    if (player.mark != turn_) {\n        send_to(player, \"error not your turn\");\n        return;\n    }\n    if (!board_.place(message[5] - '0', player.mark)) {\n        send_to(player, \"error taken\");\n        return;\n    }\n\n    tell_both(\"board \" + board_.str());\n    if (board_.winner() != '.') {\n        tell_both(std::string(\"win \") + board_.winner());\n        over_ = true;\n    } else if (board_.full()) {\n        tell_both(\"draw\");\n        over_ = true;\n    } else {\n        turn_ = turn_ == 'X' ? 'O' : 'X';\n        tell_both(std::string(\"turn \") + turn_);\n    }\n}\n\nvoid GameServer::send_to(Player& player, const std::string& text)\n{\n    net::send_frame(player.socket, text);   // a failure shows up as a read\n}\n\nvoid GameServer::tell_both(const std::string& text)\n{\n    for (Player& p : players_)\n        send_to(p, text);\n}\n",
        },
        "run": [
          configure("ttt"),
        ],
        "fails": [
          1,
        ],
      },
      {
        "name": "checked say after the move rules",
        "files": {
          "ttt/game_server.cpp": "#include \"game_server.h\"\n\n#include <cstddef>\n#include <utility>\n\n#include \"poller.h\"\n#include \"tcp.h\"\n\nGameServer::GameServer() : listener_(net::listen_loopback()) {}\n\nstd::uint16_t GameServer::port() const\n{\n    return net::local_port(listener_);\n}\n\nvoid GameServer::stop()\n{\n    stopping_ = true;\n}\n\nvoid GameServer::run()\n{\n    while (!stopping_ && !over_) {\n        std::vector<net::PollFd> fds;\n        fds.push_back(net::watch(listener_));\n        for (const Player& p : players_)\n            fds.push_back(net::watch(p.socket));\n        if (net::poll(fds.data(), fds.size(), 50) <= 0)\n            continue;\n\n        for (std::size_t i = 0; i < players_.size() && !over_; ++i) {\n            if (fds[i + 1].revents != 0 && !read_from(players_[i])) {\n                over_ = true;   // a player left: the game can't go on\n                for (Player& other : players_) {\n                    if (&other != &players_[i])\n                        send_to(other, std::string(\"left \") +\n                                           players_[i].mark);\n                }\n            }\n        }\n        if (!over_ && fds[0].revents != 0)\n            accept_new();\n    }\n    players_.clear();   // closes both connections\n}\n\nvoid GameServer::accept_new()\n{\n    net::Socket socket = net::accept_client(listener_);\n    if (players_.size() == 2) {\n        net::send_frame(socket, \"full\");\n        return;   // socket closes here\n    }\n    char mark = players_.empty() ? 'X' : 'O';\n    players_.push_back(Player{std::move(socket), {}, mark});\n    send_to(players_.back(), std::string(\"you \") + mark);\n    if (players_.size() == 2) {\n        tell_both(\"board \" + board_.str());\n        tell_both(\"turn X\");\n    }\n}\n\nbool GameServer::read_from(Player& player)\n{\n    char buffer[4096];\n    long got = net::recv_some(player.socket, buffer, sizeof buffer);\n    if (got <= 0)\n        return false;\n    player.decoder.feed({buffer, static_cast<std::size_t>(got)});\n    while (!over_) {\n        auto message = player.decoder.next();\n        if (!message)\n            break;\n        handle(player, *message);\n    }\n    return !player.decoder.broken();\n}\n\nvoid GameServer::handle(Player& player, const std::string& message)\n{\n    if (players_.size() < 2) {\n        send_to(player, \"error waiting for opponent\");\n        return;\n    }\n    // \"move N\", with N one digit.\n    if (message.size() != 6 || message.rfind(\"move \", 0) != 0 ||\n        message[5] < '0' || message[5] > '8') {\n        send_to(player, \"error bad move\");\n        return;\n    }\n    if (player.mark != turn_) {\n        send_to(player, \"error not your turn\");\n        return;\n    }\n    if (message.rfind(\"say \", 0) == 0) {\n        for (Player& other : players_) {\n            if (&other != &player)\n                send_to(other, std::string(1, player.mark) + \" says \" +\n                                   message.substr(4));\n        }\n        return;\n    }\n    if (!board_.place(message[5] - '0', player.mark)) {\n        send_to(player, \"error taken\");\n        return;\n    }\n\n    tell_both(\"board \" + board_.str());\n    if (board_.winner() != '.') {\n        tell_both(std::string(\"win \") + board_.winner());\n        over_ = true;\n    } else if (board_.full()) {\n        tell_both(\"draw\");\n        over_ = true;\n    } else {\n        turn_ = turn_ == 'X' ? 'O' : 'X';\n        tell_both(std::string(\"turn \") + turn_);\n    }\n}\n\nvoid GameServer::send_to(Player& player, const std::string& text)\n{\n    net::send_frame(player.socket, text);   // a failure shows up as a read\n}\n\nvoid GameServer::tell_both(const std::string& text)\n{\n    for (Player& p : players_)\n        send_to(p, text);\n}\n",
        },
        "run": [
          configure("ttt"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
};
