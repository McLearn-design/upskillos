---
title: 3 — Inheritance and Virtual Functions
track: Classes and Abstraction
runtime: cpp
reference: optional
console: true
---

A build server needs to tell people when something happens: by email, by text message, by a phone notification. Each **channel** sends differently, but the code that raises an alert shouldn't care which channels exist. It wants to say "send this" to every one of them.

That's what **inheritance** with **virtual functions** is for: one interface (`Channel`), many implementations (`EmailChannel`, `SmsChannel`), and code that calls the right one at run time without knowing which it has.

```text
            Channel            send(message)
           /       \
 EmailChannel     SmsChannel   each sends its own way
```

This lesson builds that, then breaks it in the three classic ways (a missing `virtual`, a missing virtual destructor, and slicing) so you'll recognise each one. Every program is one `.cpp` file in `alerts/`, built directly with `g++`, so you can also open any of them in **🔬 Trace in CodeLens**.

## Step 1 — Predict: which send runs?

**This step: create the supplied `alerts/channels.cpp`. Read it and predict the output, then build and run it.**

- `class EmailChannel : public Channel` means an EmailChannel **is a** Channel: it has everything Channel has, and can be used anywhere a Channel is expected.
- `broadcast` holds the channels as `std::unique_ptr<Channel>`: pointers to the base class. That's how one vector can hold different kinds of channel.
- Each derived class has its own `send`.

**Predict:** `broadcast` calls `channel->send(message)` on an EmailChannel, then an SmsChannel. What two lines appear?

```text
g++ -std=c++20 -Wall -Wextra alerts/channels.cpp -o alerts/channels
./alerts/channels
```

```cpp file=alerts/channels.cpp provided
// Notification channels: one base class, two kinds of channel.
#include <iostream>
#include <memory>
#include <string>
#include <vector>

class Channel {
public:
    void send(const std::string& message) const
    {
        std::cout << "[channel] " << message << '\n';
    }
};

class EmailChannel : public Channel {
public:
    void send(const std::string& message) const
    {
        std::cout << "[email] Subject: Alert | " << message << '\n';
    }
};

class SmsChannel : public Channel {
public:
    void send(const std::string& message) const
    {
        // Text messages are short: keep the first 16 characters.
        std::cout << "[sms] " << message.substr(0, 16) << '\n';
    }
};

void broadcast(const std::vector<std::unique_ptr<Channel>>& channels,
               const std::string& message)
{
    for (const auto& channel : channels)
        channel->send(message);
}

int main()
{
    std::vector<std::unique_ptr<Channel>> channels;
    channels.push_back(std::make_unique<EmailChannel>());
    channels.push_back(std::make_unique<SmsChannel>());

    broadcast(channels, "Disk almost full on build server");
    return 0;
}
```

### What happened

```text
[channel] Disk almost full on build server
[channel] Disk almost full on build server
```

Both calls ran **Channel's** `send`. By default, C++ decides which function to call from the **static type**, the type the compiler sees: `channel` is a pointer to `Channel`, so `channel->send` is `Channel::send`. The object's real type, its **dynamic type**, isn't consulted. This is called static binding, and it's the default because it costs nothing at run time.

```check
run "g++ -std=c++20 -Wall -Wextra -Werror alerts/channels.cpp -o alerts/channels"
run "./alerts/channels" stdout="[channel] Disk almost full on build server" label="the base class send runs"
```

## Step 2 — virtual and override

**This step: make `send` virtual in `Channel`, mark each derived `send` with `override`, and give `Channel` a virtual destructor. Build and run.**

```cpp
class Channel {
public:
    virtual ~Channel() = default;   // step 4 explains this line

    virtual void send(const std::string& message) const
    { ... }
};

class SmsChannel : public Channel {
public:
    void send(const std::string& message) const override
    { ... }
};
```

- **`virtual`** asks for **dynamic binding**: the call is decided at run time, by the object's real type.
- **`override`** says "this replaces a virtual function of the base class". It's optional, but always write it: if the signatures don't match exactly, the compiler tells you, instead of silently creating a second, unrelated function.

How it works: every class with virtual functions gets a hidden table of function pointers, the **vtable**, and every object carries a pointer to its class's table.

```text
SmsChannel object          vtable for SmsChannel
┌──────────────┐           ┌─────────────────────────┐
│ vptr ────────┼─────────► │ send → SmsChannel::send │
└──────────────┘           └─────────────────────────┘
```

`channel->send(...)` becomes "follow the object's vptr, call the `send` entry": one extra pointer lookup.

**Watch it dispatch:** in the debugger, set a breakpoint in `broadcast` (lldb `breakpoint set --name broadcast`, gdb `break broadcast`), run, and use `step` on the `send` line: you land in `EmailChannel::send`, then next time round in `SmsChannel::send`. gdb's `print *channel` even shows the hidden pointer as `_vptr.Channel = <vtable for SmsChannel+16>`. In CodeLens, the frame that appears on the call stack tells you which `send` ran.

**Experiment:** delete `const` from `SmsChannel::send` but keep `override`, and rebuild. The compiler says `marked 'override', but does not override`. Without `override`, that typo would compile, and SMS alerts would quietly go through `Channel::send`. Put the `const` back.

```cpp file=alerts/channels.cpp
// Notification channels: one base class, two kinds of channel.
#include <iostream>
#include <memory>
#include <string>
#include <vector>

class Channel {
public:
    virtual ~Channel() = default;   // step 3 explains this line

    virtual void send(const std::string& message) const
    {
        std::cout << "[channel] " << message << '\n';
    }
};

class EmailChannel : public Channel {
public:
    void send(const std::string& message) const override
    {
        std::cout << "[email] Subject: Alert | " << message << '\n';
    }
};

class SmsChannel : public Channel {
public:
    void send(const std::string& message) const override
    {
        // Text messages are short: keep the first 16 characters.
        std::cout << "[sms] " << message.substr(0, 16) << '\n';
    }
};

void broadcast(const std::vector<std::unique_ptr<Channel>>& channels,
               const std::string& message)
{
    for (const auto& channel : channels)
        channel->send(message);
}

int main()
{
    std::vector<std::unique_ptr<Channel>> channels;
    channels.push_back(std::make_unique<EmailChannel>());
    channels.push_back(std::make_unique<SmsChannel>());

    broadcast(channels, "Disk almost full on build server");
    return 0;
}
```

```check
matches alerts/channels.cpp "virtual\s+void\s+send" label="Channel::send is virtual"
matches alerts/channels.cpp "(\boverride\b[\s\S]*){2}" label="both derived send functions say override"
run "g++ -std=c++20 -Wall -Wextra -Werror alerts/channels.cpp -o alerts/channels" -- An override must match the base function exactly, const included.
run "./alerts/channels" stdout="[email] Subject: Alert | Disk almost full on build server\n[sms] Disk almost full" label="each channel sends its own way"
```

## Step 3 — A destructor that never runs

**This step: create the supplied `alerts/cleanup.cpp`, predict its output, then build and run it.**

`LogFileChannel` buffers messages and writes them out in its destructor. The program owns one through a `std::unique_ptr<Channel>`, exactly like `channels.cpp` did, but this `Channel` has an ordinary, non-virtual destructor.

**Predict:** when `channel` goes out of scope, does `LogFileChannel: writing 2 buffered lines` appear?

```text
g++ -std=c++20 -Wall -Wextra alerts/cleanup.cpp -o alerts/cleanup
./alerts/cleanup
```

Clang warns about this program (`delete called on non-final 'Channel' that has virtual functions but non-virtual destructor`). GCC says nothing with `-Wall -Wextra`; it needs `-Wnon-virtual-dtor`. Either way, it builds.

```cpp file=alerts/cleanup.cpp provided
// A channel that buffers messages and writes them out when destroyed.
#include <iostream>
#include <memory>
#include <string>
#include <vector>

class Channel {
public:
    ~Channel() { std::cout << "Channel destroyed\n"; }

    virtual void send(const std::string& message)
    {
        std::cout << "[channel] " << message << '\n';
    }
};

class LogFileChannel : public Channel {
public:
    ~LogFileChannel()
    {
        // A real one would write the lines to a file here.
        std::cout << "LogFileChannel: writing " << pending_.size()
                  << " buffered lines to alerts.log\n";
    }

    void send(const std::string& message) override
    {
        pending_.push_back(message);
        std::cout << "[log] buffered: " << message << '\n';
    }

private:
    std::vector<std::string> pending_;
};

int main()
{
    {
        std::unique_ptr<Channel> channel =
            std::make_unique<LogFileChannel>();
        channel->send("Backup started");
        channel->send("Backup finished");
    }   // channel is destroyed here
    std::cout << "main ends\n";
    return 0;
}
```

### What happened

```text
[log] buffered: Backup started
[log] buffered: Backup finished
Channel destroyed
main ends
```

The `unique_ptr<Channel>` deletes its object through a `Channel*`. A destructor is a member function like any other: without `virtual`, `delete` calls the destructor of the **static** type, `~Channel`. `~LogFileChannel` never runs, so the buffered lines are lost and the vector inside is never freed.

Formally this is **undefined behaviour**, not just a leak: deleting a derived object through a base pointer without a virtual destructor. AddressSanitizer reports it as `new-delete-type-mismatch`.

```check
run "g++ -std=c++20 -Wall -Wextra alerts/cleanup.cpp -o alerts/cleanup"
run "./alerts/cleanup" stdout="Channel destroyed\nmain ends" label="it runs, but only Channel's destructor runs"
```

## Step 4 — Virtual destructors

**This step: make `Channel`'s destructor virtual in `alerts/cleanup.cpp`. Build with `-Werror` and run it.**

```cpp
virtual ~Channel() { std::cout << "Channel destroyed\n"; }
```

```text
g++ -std=c++20 -Wall -Wextra -Werror alerts/cleanup.cpp -o alerts/cleanup
./alerts/cleanup
```

**Predict** the order of the two destructor lines.

### The order

`~LogFileChannel` runs first, then `~Channel`: destruction runs from the most derived class to the base, the reverse of construction. The derived part may use the base part, so it must go first.

The rule: **a class meant to be used through a base pointer needs a public virtual destructor.** If the base has nothing to clean up, `virtual ~Channel() = default;` is enough, as in `channels.cpp`.

```cpp file=alerts/cleanup.cpp
// A channel that buffers messages and writes them out when destroyed.
#include <iostream>
#include <memory>
#include <string>
#include <vector>

class Channel {
public:
    virtual ~Channel() { std::cout << "Channel destroyed\n"; }

    virtual void send(const std::string& message)
    {
        std::cout << "[channel] " << message << '\n';
    }
};

class LogFileChannel : public Channel {
public:
    ~LogFileChannel()
    {
        // A real one would write the lines to a file here.
        std::cout << "LogFileChannel: writing " << pending_.size()
                  << " buffered lines to alerts.log\n";
    }

    void send(const std::string& message) override
    {
        pending_.push_back(message);
        std::cout << "[log] buffered: " << message << '\n';
    }

private:
    std::vector<std::string> pending_;
};

int main()
{
    {
        std::unique_ptr<Channel> channel =
            std::make_unique<LogFileChannel>();
        channel->send("Backup started");
        channel->send("Backup finished");
    }   // channel is destroyed here
    std::cout << "main ends\n";
    return 0;
}
```

```check
matches alerts/cleanup.cpp "virtual\s+~Channel" label="Channel's destructor is virtual"
run "g++ -std=c++20 -Wall -Wextra -Werror alerts/cleanup.cpp -o alerts/cleanup"
run "./alerts/cleanup" stdout="LogFileChannel: writing 2 buffered lines to alerts.log\nChannel destroyed" label="the derived destructor runs first, then the base one"
```

## Step 5 — Slicing

**This step: create the supplied `alerts/slicing.cpp`, predict its output, then build and run it.**

`send` is virtual, the destructor is virtual, `override` is there. And yet one line goes wrong. Look closely at `announce`'s parameter.

**Predict:** both lines send through `sms`. Do both print `[sms]`?

```text
g++ -std=c++20 -Wall -Wextra alerts/slicing.cpp -o alerts/slicing
./alerts/slicing
```

```cpp file=alerts/slicing.cpp provided
// Passing a channel to a function that announces a message.
#include <iostream>
#include <string>

class Channel {
public:
    virtual ~Channel() = default;

    virtual void send(const std::string& message) const
    {
        std::cout << "[channel] " << message << '\n';
    }
};

class SmsChannel : public Channel {
public:
    void send(const std::string& message) const override
    {
        std::cout << "[sms] " << message.substr(0, 16) << '\n';
    }
};

void announce(Channel channel, const std::string& message)
{
    channel.send(message);
}

int main()
{
    SmsChannel sms;
    sms.send("Server room temperature high");
    announce(sms, "Server room temperature high");
    return 0;
}
```

### What happened

```text
[sms] Server room temp
[channel] Server room temperature high
```

`announce` takes a `Channel` **by value**. Passing `sms` copies it into a brand-new `Channel` object. Only the `Channel` part is copied, and the copy's vptr points to Channel's vtable: it *is* a plain Channel. That's **object slicing**: the derived part is cut off.

```text
sms (SmsChannel)            channel (Channel, a copy)
┌───────────────────┐       ┌───────────────────┐
│ Channel part      │ ───►  │ Channel part      │
│ SmsChannel part   │  ✗    └───────────────────┘
└───────────────────┘
```

**See it:** open `slicing.cpp` in **🔬 Trace in CodeLens** and stop inside `announce`. The stack panel shows `channel` as a separate object in `announce`'s frame, not an arrow to `sms` in `main`'s frame. Compare that with the next step.

The same thing happens with `std::vector<Channel>`: pushing an SmsChannel stores a sliced copy. Polymorphic objects are used through **references or pointers**, never copied by value.

```check
run "g++ -std=c++20 -Wall -Wextra -Werror alerts/slicing.cpp -o alerts/slicing" label="it compiles cleanly, even with -Werror"
run "./alerts/slicing" stdout="[channel] Server room temperature high" label="announce ran Channel's send"
```

## Step 6 — Fix the slice

**This step: change `announce` to take a `const Channel&`. Build and run.**

```cpp
void announce(const Channel& channel, const std::string& message)
```

A reference refers to the original object, with its real type and its real vptr, so the virtual call reaches `SmsChannel::send`. No copy is made, either.

Some codebases make slicing impossible instead: they give the base class a deleted (or `protected`) copy constructor, so `announce(Channel channel, ...)` stops compiling. Either way, the habit to build is: **pass polymorphic types by reference or pointer.**

```cpp file=alerts/slicing.cpp
// Passing a channel to a function that announces a message.
#include <iostream>
#include <string>

class Channel {
public:
    virtual ~Channel() = default;

    virtual void send(const std::string& message) const
    {
        std::cout << "[channel] " << message << '\n';
    }
};

class SmsChannel : public Channel {
public:
    void send(const std::string& message) const override
    {
        std::cout << "[sms] " << message.substr(0, 16) << '\n';
    }
};

void announce(const Channel& channel, const std::string& message)
{
    channel.send(message);
}

int main()
{
    SmsChannel sms;
    sms.send("Server room temperature high");
    announce(sms, "Server room temperature high");
    return 0;
}
```

```check
matches alerts/slicing.cpp "announce\s*\(\s*const\s+Channel\s*&" label="announce takes a const Channel&"
run "g++ -std=c++20 -Wall -Wextra -Werror alerts/slicing.cpp -o alerts/slicing"
run "./alerts/slicing" stdout="[sms] Server room temp\n[sms] Server room temp" label="both lines send by SMS"
```

## Step 7 — Challenge: a push channel

**This step: no code is given. Add a `PushChannel` to `alerts/channels.cpp`, marked `final`.**

Requirements:

- `PushChannel` derives publicly from `Channel` and overrides `send`.
- It prints `[push] ` and the message. A message longer than 24 characters is cut to its first 24, followed by `...`.
- Declare it `class PushChannel final : public Channel`. **`final`** means nothing may derive from it, and it lets the compiler skip the vtable lookup when it knows the exact type.
- In `main`, add a PushChannel after the SmsChannel, and broadcast `Build passed` **before** the disk message.

The output must be:

```text
[email] Subject: Alert | Build passed
[sms] Build passed
[push] Build passed
[email] Subject: Alert | Disk almost full on build server
[sms] Disk almost full
[push] Disk almost full on buil...
```

Notice what you didn't change: `broadcast`. New behaviour arrived as a new class, and the code that uses channels never noticed. That's the payoff of an interface.

```cpp file=alerts/channels.cpp
// Notification channels: one base class, two kinds of channel.
#include <iostream>
#include <memory>
#include <string>
#include <vector>

class Channel {
public:
    virtual ~Channel() = default;   // step 3 explains this line

    virtual void send(const std::string& message) const
    {
        std::cout << "[channel] " << message << '\n';
    }
};

class EmailChannel : public Channel {
public:
    void send(const std::string& message) const override
    {
        std::cout << "[email] Subject: Alert | " << message << '\n';
    }
};

class SmsChannel : public Channel {
public:
    void send(const std::string& message) const override
    {
        // Text messages are short: keep the first 16 characters.
        std::cout << "[sms] " << message.substr(0, 16) << '\n';
    }
};

class PushChannel final : public Channel {
public:
    void send(const std::string& message) const override
    {
        // Phone notifications: at most 24 characters, then "...".
        if (message.size() <= 24)
            std::cout << "[push] " << message << '\n';
        else
            std::cout << "[push] " << message.substr(0, 24) << "...\n";
    }
};

void broadcast(const std::vector<std::unique_ptr<Channel>>& channels,
               const std::string& message)
{
    for (const auto& channel : channels)
        channel->send(message);
}

int main()
{
    std::vector<std::unique_ptr<Channel>> channels;
    channels.push_back(std::make_unique<EmailChannel>());
    channels.push_back(std::make_unique<SmsChannel>());
    channels.push_back(std::make_unique<PushChannel>());

    broadcast(channels, "Build passed");
    broadcast(channels, "Disk almost full on build server");
    return 0;
}
```

```check
matches alerts/channels.cpp "class\s+PushChannel\s+final\s*:\s*public\s+Channel" label="class PushChannel final : public Channel"
run "g++ -std=c++20 -Wall -Wextra -Werror alerts/channels.cpp -o alerts/channels"
run "./alerts/channels" stdout="[push] Build passed\n[email]" label="a short message is sent whole" -- Only add ... when the message is longer than 24 characters.
run "./alerts/channels" stdout="[push] Disk almost full on buil..." label="a long message is cut to 24 characters and ..."
```

## Step 8 — When not to use inheritance

**This step: read, and decide. No file changes.**

Inheritance is the tightest coupling C++ has: a derived class depends on every detail of its base. Use it for one thing: **substitutability**. `EmailChannel` can stand in anywhere a `Channel` is expected, and every caller still gets what it was promised.

**Predict:** which of these is a good use of inheritance?

| Design | Verdict |
|---|---|
| `SmsChannel : Channel` | ✓ any code that sends through a Channel works with it |
| `Square : Rectangle` | ✗ `set_width` on a Rectangle mustn't change its height. On a Square it must. Code written for Rectangles breaks |
| `Stack : std::vector<int>` (to reuse its code) | ✗ a Stack would inherit `insert` and `operator[]`, so callers can break its "only the top" rule. *Contain* a vector instead |
| `Logger : Channel` because a logger "also prints things" | ✗ sharing some code isn't an is-a relationship |

The test is the **Liskov substitution principle**: if code that works with a base object can break when handed a derived one, the derived class shouldn't inherit.

When you only want to **reuse** code, use **composition**: make the other object a member. When you want **interchangeable parts** (a real clock or a fake one, email or SMS), use an abstract interface. That's the next lesson.
