---
title: 4 — Composition and Interfaces: Code You Can Test
track: Classes and Abstraction
runtime: cpp
reference: optional
console: true
---

Nobody wants a 3 a.m. text saying the nightly report is ready. The next class, `Notifier`, holds normal messages during **quiet hours** (22:00 to 06:59) and sends them in the morning. Urgent messages always go straight out.

Here's the obvious way to write it:

```cpp
void notify(const std::string& message)
{
    std::time_t now = std::time(nullptr);
    int hour = std::localtime(&now)->tm_hour;
    if (hour >= 22 || hour < 7)
        held_.push_back(message);
    else
        send_sms(message);       // a real text message
}
```

**How would you test it?** To check that a message is held at 23:00, you'd have to run the test at 23:00. And every passing test sends a real SMS.

The problem is that `notify` reaches out and grabs the clock and the SMS service itself. The fix is to **hand them in**: `Notifier` receives "something that tells the time" and "something that sends", as abstract interfaces. The real program passes the real ones; tests pass fakes they control. This is called **dependency injection**, and it's built from composition rather than inheritance.

The project is `notifier/`, with CMake and tests.

## Step 1 — The project's build file

**This step: create the supplied `notifier/CMakeLists.txt`.**

Two programs: `notifier` (the real thing, from `main.cpp`) and `notifier_tests`. Both are built with `notifier.cpp`.

```cmake file=notifier/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(notifier LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(notifier main.cpp notifier.cpp)

# Every tests/*_test.cpp file becomes part of the test program.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(notifier_tests ../testing/test_main.cpp ${TEST_SOURCES} notifier.cpp)
target_include_directories(notifier_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/../testing)

foreach(target notifier notifier_tests)
    if(MSVC)
        target_compile_options(${target} PRIVATE /W4)
    else()
        target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic)
    endif()
endforeach()
```

```check
file notifier/CMakeLists.txt
```

## Step 2 — Interfaces

**This step: create `notifier/interfaces.h` with two abstract classes, `Clock` and `Channel`.**

```cpp
class Clock {
public:
    virtual ~Clock() = default;
    virtual int hour() const = 0;     // the local hour, 0 to 23
};

class Channel {
public:
    virtual ~Channel() = default;
    virtual void send(const std::string& message) = 0;
};
```

- **`= 0`** makes a function **pure virtual**: declared, with no body. Derived classes must override it.
- A class with a pure virtual function is **abstract**: you can't create a `Clock`, only classes derived from it. That's exactly right: "a clock" isn't a thing until you say which one.
- An abstract class with no data and only pure virtual functions is an **interface**. It says *what* is needed, and nothing about *how*.
- The virtual destructor is there for the reason you saw in lesson 3.

`Notifier` needs exactly one thing from a clock, the hour, so that's all the interface has. Small interfaces are easy to implement, and easy to fake.

```cpp file=notifier/interfaces.h
#pragma once

#include <string>

// What Notifier needs from the outside world, and nothing more.
// Each is an abstract class: an interface with no data and no code.

class Clock {
public:
    virtual ~Clock() = default;
    virtual int hour() const = 0;     // the local hour, 0 to 23
};

class Channel {
public:
    virtual ~Channel() = default;
    virtual void send(const std::string& message) = 0;
};
```

```check
matches notifier/interfaces.h "virtual\s+int\s+hour\s*\(\s*\)\s*const\s*=\s*0" label="Clock::hour() const is pure virtual"
matches notifier/interfaces.h "virtual\s+void\s+send\s*\([^)]*\)\s*=\s*0" label="Channel::send is pure virtual"
matches notifier/interfaces.h "virtual\s+~Clock" label="Clock has a virtual destructor"
matches notifier/interfaces.h "virtual\s+~Channel" label="Channel has a virtual destructor"
```

## Step 3 — The specification

**This step: create the supplied `notifier/tests/notifier_test.cpp` and read it.**

Look at how each test is built:

```cpp
FakeClock clock(23);           // it is 23:00, because the test says so
FakeChannel channel;           // records what it was asked to send
Notifier notifier(clock, channel);
```

- The test **controls time**: `clock.set_hour(8)` moves to the morning instantly.
- The test **observes** what was sent by reading `channel.sent`, instead of checking someone's phone.

The tests use two classes that don't exist yet, `FakeClock` and `FakeChannel` from `fakes.h`, and the `Notifier` itself. You'll write all three.

```cpp file=notifier/tests/notifier_test.cpp provided
// Provided by the lesson: what Notifier must do, tested with fakes.
#include "studio_test.hpp"

#include "fakes.h"
#include "notifier.h"

TEST(sends_immediately_during_the_day)
{
    FakeClock clock(9);
    FakeChannel channel;
    Notifier notifier(clock, channel);

    notifier.notify("Build passed");

    CHECK_EQ(channel.sent.size(), 1u);
    CHECK_EQ(channel.sent[0], "Build passed");
}

TEST(holds_messages_during_quiet_hours)
{
    FakeClock clock(23);
    FakeChannel channel;
    Notifier notifier(clock, channel);

    notifier.notify("Nightly report ready");

    CHECK(channel.sent.empty());
    CHECK_EQ(notifier.held_count(), 1u);
}

TEST(deliver_held_sends_once_quiet_hours_are_over)
{
    FakeClock clock(23);
    FakeChannel channel;
    Notifier notifier(clock, channel);
    notifier.notify("Nightly report ready");

    clock.set_hour(8);               // the test controls time
    notifier.deliver_held();

    CHECK_EQ(channel.sent.size(), 1u);
    CHECK_EQ(channel.sent[0], "Nightly report ready");
    CHECK_EQ(notifier.held_count(), 0u);
}

TEST(deliver_held_waits_while_it_is_still_quiet)
{
    FakeClock clock(23);
    FakeChannel channel;
    Notifier notifier(clock, channel);
    notifier.notify("Nightly report ready");

    clock.set_hour(3);
    notifier.deliver_held();

    CHECK(channel.sent.empty());
    CHECK_EQ(notifier.held_count(), 1u);
}

TEST(urgent_messages_ignore_quiet_hours)
{
    FakeClock clock(2);
    FakeChannel channel;
    Notifier notifier(clock, channel);

    notifier.notify("Server down", Priority::urgent);

    CHECK_EQ(channel.sent.size(), 1u);
    CHECK_EQ(channel.sent[0], "Server down");
}
```

```check
file notifier/tests/notifier_test.cpp
```

## Step 4 — Composition

**This step: create `notifier/notifier.h` declaring `Notifier`, which holds a `const Clock&` and a `Channel&`.**

```cpp
enum class Priority { normal, urgent };

class Notifier {
public:
    Notifier(const Clock& clock, Channel& channel);

    void notify(const std::string& message,
                Priority priority = Priority::normal);
    void deliver_held();
    std::size_t held_count() const;

    static bool is_quiet_hour(int hour);

private:
    const Clock& clock_;
    Channel& channel_;
    std::vector<std::string> held_;
};
```

- **Composition**: a Notifier *has* a clock and a channel, as members. It doesn't *inherit* from them. A `QuietSmsChannel : SmsChannel` would have tied quiet hours to SMS forever; this works with any Channel and any Clock.
- The members are **references to interfaces**. `Clock clock_;` wouldn't even compile: Clock is abstract. And storing a copy would slice it.
- References mean Notifier **doesn't own** them: the clock and channel must outlive it (the memory track's lifetime rules, again). A Notifier that should own its channel would hold a `std::unique_ptr<Channel>` instead.
- **`static`** member functions belong to the class, not to an object: `Notifier::is_quiet_hour(23)`. It needs no clock, so it's easy to test on its own.
- `Priority priority = Priority::normal` is a **default argument**: `notify("x")` means `notify("x", Priority::normal)`.

```cpp file=notifier/notifier.h
#pragma once

#include <cstddef>
#include <string>
#include <vector>

#include "interfaces.h"

enum class Priority { normal, urgent };

// Sends messages through a channel, but holds normal messages during
// quiet hours (22:00 to 06:59) until deliver_held() is called after
// them. Notifier doesn't own its clock or channel: they must outlive it.
class Notifier {
public:
    Notifier(const Clock& clock, Channel& channel);

    void notify(const std::string& message,
                Priority priority = Priority::normal);
    void deliver_held();
    std::size_t held_count() const;

    static bool is_quiet_hour(int hour);

private:
    const Clock& clock_;
    Channel& channel_;
    std::vector<std::string> held_;
};
```

```check
matches notifier/notifier.h "const\s+Clock\s*&\s*clock_" label="holds a const Clock& member"
matches notifier/notifier.h "Channel\s*&\s*channel_" label="holds a Channel& member"
contains notifier/notifier.h "enum class Priority"
matches notifier/notifier.h "static\s+bool\s+is_quiet_hour\s*\(\s*int" label="declares static bool is_quiet_hour(int)"
```

## Step 5 — Fakes

**This step: create `notifier/tests/fakes.h` with `FakeClock` and `FakeChannel`.**

`FakeClock` is given:

```cpp
class FakeClock : public Clock {
public:
    explicit FakeClock(int hour) : hour_(hour) {}

    int hour() const override { return hour_; }
    void set_hour(int hour) { hour_ = hour; }

private:
    int hour_;
};
```

Write `FakeChannel` yourself. The tests need:

- it derives **publicly** from `Channel` and overrides `send`;
- `send` appends the message to a public member, `std::vector<std::string> sent`.

Watch the word `public`. With `class`, inheritance is **private** by default: `class FakeChannel : Channel` compiles, but then a FakeChannel is no longer usable as a Channel outside the class, and `Notifier notifier(clock, channel)` fails with `'Channel' is an inaccessible base of 'FakeChannel'`.

A fake that records calls is often called a **spy**. Fakes are ordinary classes: no framework needed. That's the benefit of small interfaces.

```cpp file=notifier/tests/fakes.h
#pragma once

#include <string>
#include <vector>

#include "interfaces.h"

// Stand-ins for the real clock and channel, for the tests: a clock
// that says whatever hour the test sets, and a channel that remembers
// what it was asked to send.

class FakeClock : public Clock {
public:
    explicit FakeClock(int hour) : hour_(hour) {}

    int hour() const override { return hour_; }
    void set_hour(int hour) { hour_ = hour; }

private:
    int hour_;
};

class FakeChannel : public Channel {
public:
    void send(const std::string& message) override
    {
        sent.push_back(message);
    }

    std::vector<std::string> sent;
};
```

```check
matches notifier/tests/fakes.h "class\s+FakeClock\s*:\s*public\s+Clock" label="FakeClock derives publicly from Clock"
matches notifier/tests/fakes.h "class\s+FakeChannel\s*(final\s*)?:\s*public\s+Channel" label="FakeChannel derives publicly from Channel" -- With class, inheritance is private unless you write public.
matches notifier/tests/fakes.h "std::vector\s*<\s*std::string\s*>\s+sent" label="FakeChannel records messages in sent"
```

## Step 6 — The real wiring

**This step: create the supplied `notifier/main.cpp` and read it.**

The real program defines the real implementations: `SystemClock` reads the computer's clock, `ConsoleChannel` prints. (A real system would have an SMS channel here.)

`main` is the only place that knows which concrete classes are used. It's called the **composition root**: everything is created and connected in one place, and the rest of the code only sees interfaces.

```cpp file=notifier/main.cpp provided
// The real program: the only place that knows which Clock and Channel
// a Notifier really gets.
#include <ctime>
#include <iostream>
#include <string>

#include "notifier.h"

class SystemClock : public Clock {
public:
    int hour() const override
    {
        const std::time_t now = std::time(nullptr);
        return std::localtime(&now)->tm_hour;
    }
};

class ConsoleChannel : public Channel {
public:
    void send(const std::string& message) override
    {
        std::cout << "[console] " << message << '\n';
    }
};

int main()
{
    SystemClock clock;
    ConsoleChannel console;
    Notifier notifier(clock, console);

    std::cout << "Notifier demo, hour " << clock.hour() << '\n';
    notifier.notify("Build passed");
    notifier.notify("Server down", Priority::urgent);
    std::cout << notifier.held_count() << " message(s) held until 07:00\n";
    return 0;
}
```

```check
file notifier/main.cpp
```

## Step 7 — Implement Notifier

**This step: create `notifier/notifier.cpp`. Then configure, build, run the tests and run the program.**

Requirements:

- The constructor stores the two references: `: clock_(clock), channel_(channel)`. References must be bound in the initialiser list; they can't be assigned later.
- `is_quiet_hour(hour)`: true from 22:00 to 06:59.
- `notify`: a **normal** message during quiet hours is held. Otherwise, first deliver anything held (older messages go first), then send the message.
- `deliver_held()`: if it's no longer quiet, send every held message in order, then forget them.
- `held_count()`: how many are waiting.

```text
cmake -S notifier -B notifier/build -G "MinGW Makefiles"     (Windows)
cmake -S notifier -B notifier/build                          (macOS, Linux)
```

```text
cmake --build notifier/build
./notifier/build/notifier_tests
./notifier/build/notifier
```

The real program's output depends on the time of day you run it. The tests' output never does: that's what the interfaces bought you.

```cpp file=notifier/notifier.cpp
#include "notifier.h"

Notifier::Notifier(const Clock& clock, Channel& channel)
    : clock_(clock), channel_(channel)
{
}

bool Notifier::is_quiet_hour(int hour)
{
    return hour >= 22 || hour < 7;
}

void Notifier::notify(const std::string& message, Priority priority)
{
    if (priority == Priority::normal && is_quiet_hour(clock_.hour())) {
        held_.push_back(message);
        return;
    }
    deliver_held();                  // anything older goes out first
    channel_.send(message);
}

void Notifier::deliver_held()
{
    if (is_quiet_hour(clock_.hour()))
        return;
    for (const std::string& message : held_)
        channel_.send(message);
    held_.clear();
}

std::size_t Notifier::held_count() const
{
    return held_.size();
}
```

```check
file notifier/build/CMakeCache.txt label="notifier/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build notifier/build" -- The constructor binds the references in its initialiser list: : clock_(clock), channel_(channel).
tests "./notifier/build/notifier_tests" require="holds_messages_during_quiet_hours deliver_held_sends_once_quiet_hours_are_over urgent_messages_ignore_quiet_hours" -- Only normal messages are held, and only while is_quiet_hour(clock_.hour()) is true.
run "./notifier/build/notifier" stdout="Notifier demo" label="the real program runs"
```

## Step 8 — The reviewer's tests

**This step: create the supplied `notifier/tests/notifier_review_test.cpp`, run the tests, and fix `notifier.cpp` if any fail.**

The reviewer checks the boundaries (is 07:00 quiet? is 22:00?), the order of held messages, and one rule that's easy to skip: when quiet hours are over, a new message must not jump ahead of the ones held overnight.

Every one of these tests runs in microseconds, at any time of day, and sends nothing. Try writing `review_held_messages_go_out_before_a_new_one` against the version that called `std::time` and sent real texts.

```cpp file=notifier/tests/notifier_review_test.cpp provided
// The reviewer's tests for Notifier. Do not edit them: make them pass.
#include "studio_test.hpp"

#include "fakes.h"
#include "notifier.h"

TEST(review_quiet_hours_run_from_22_to_6)
{
    CHECK(!Notifier::is_quiet_hour(21));
    CHECK(Notifier::is_quiet_hour(22));
    CHECK(Notifier::is_quiet_hour(0));
    CHECK(Notifier::is_quiet_hour(6));
    CHECK(!Notifier::is_quiet_hour(7));
    CHECK(!Notifier::is_quiet_hour(12));
}

TEST(review_held_messages_keep_their_order)
{
    FakeClock clock(22);
    FakeChannel channel;
    Notifier notifier(clock, channel);
    notifier.notify("first");
    notifier.notify("second");
    notifier.notify("third");

    clock.set_hour(7);
    notifier.deliver_held();

    CHECK_EQ(channel.sent.size(), 3u);
    CHECK_EQ(channel.sent[0], "first");
    CHECK_EQ(channel.sent[1], "second");
    CHECK_EQ(channel.sent[2], "third");
}

TEST(review_held_messages_go_out_before_a_new_one)
{
    FakeClock clock(23);
    FakeChannel channel;
    Notifier notifier(clock, channel);
    notifier.notify("overnight");

    clock.set_hour(9);
    notifier.notify("morning");      // no deliver_held() call

    CHECK_EQ(channel.sent.size(), 2u);
    CHECK_EQ(channel.sent[0], "overnight");
    CHECK_EQ(channel.sent[1], "morning");
}

TEST(review_messages_are_never_sent_twice)
{
    FakeClock clock(23);
    FakeChannel channel;
    Notifier notifier(clock, channel);
    notifier.notify("once");

    clock.set_hour(10);
    notifier.deliver_held();
    notifier.deliver_held();
    notifier.notify("later");

    CHECK_EQ(channel.sent.size(), 2u);
    CHECK_EQ(notifier.held_count(), 0u);
}

TEST(review_urgent_messages_are_never_held)
{
    FakeClock clock(23);
    FakeChannel channel;
    Notifier notifier(clock, channel);
    notifier.notify("Disk full", Priority::urgent);

    CHECK_EQ(notifier.held_count(), 0u);
    CHECK_EQ(channel.sent.size(), 1u);
}
```

```check
file notifier/tests/notifier_review_test.cpp
run "cmake --build notifier/build"
tests "./notifier/build/notifier_tests" require="review_quiet_hours_run_from_22_to_6 review_held_messages_go_out_before_a_new_one" -- Quiet hours are 22:00 to 06:59: 07:00 is not quiet. notify sends anything held before the new message.
```
