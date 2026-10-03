// What a learner does at each step of the cpp-classes track, for its walkthrough test (walkCppTrack.js).
// Generated with the lessons; see tracks/cpp-foundations.walkthrough.js for the format.
import { configure } from '../walkCppTrack.js';

export const WALKTHROUGH = {
  "01-invariants#Step 1 \u2014 A struct cannot keep a promise": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
          1,
          2,
        ],
      },
    ],
  },
  "01-invariants#Step 2 \u2014 The test framework": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-invariants#Step 3 \u2014 The test runner": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-invariants#Step 4 \u2014 The project's build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-invariants#Step 5 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-invariants#Step 6 \u2014 The class": {
    "wrong": [
      {
        "name": "a struct with public fields",
        "files": {
          "fraction/fraction.h": "#pragma once\n\nstruct Fraction {\n    int num = 0;\n    int den = 1;\n};\n",
        },
        "fails": [
          0,
          1,
          2,
          3,
        ],
      },
    ],
  },
  "01-invariants#Step 7 \u2014 Establish the invariant": {
    "run": [
      configure("fraction"),
    ],
    "wrong": [
      {
        "name": "forgot to move the sign",
        "files": {
          "fraction/fraction.cpp": "#include \"fraction.h\"\n\n#include <numeric>\n#include <stdexcept>\n\nFraction::Fraction(int whole) : num_(whole), den_(1)\n{\n}\n\nFraction::Fraction(int numerator, int denominator)\n    : num_(numerator), den_(denominator)\n{\n    if (den_ == 0)\n        throw std::invalid_argument(\"Fraction: zero denominator\");\n    const int divisor = std::gcd(num_, den_);   // always positive here\n    num_ /= divisor;\n    den_ /= divisor;\n}\n\nint Fraction::numerator() const\n{\n    return num_;\n}\n\nint Fraction::denominator() const\n{\n    return den_;\n}\n",
        },
        "run": [
          configure("fraction"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "01-invariants#Step 8 \u2014 The specification for to_double": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "01-invariants#Step 9 \u2014 const member functions": {
    "wrong": [
      {
        "name": "forgot const",
        "files": {
          "fraction/fraction.h": "#pragma once\n\n// A rational number that is always stored in lowest terms, with a\n// positive denominator. Every constructor establishes that promise,\n// and nothing outside the class can break it.\nclass Fraction {\npublic:\n    Fraction() = default;                      // 0/1\n    Fraction(int whole);                       // whole/1, implicit\n    Fraction(int numerator, int denominator);  // throws on denominator 0\n\n    int numerator() const;\n    int denominator() const;\n\n    // Defined inside the class: short, and the same for every caller.\n    double to_double()\n    {\n        return static_cast<double>(num_) / den_;\n    }\n\nprivate:\n    int num_ = 0;\n    int den_ = 1;\n};\n",
        },
        "run": [
          configure("fraction"),
        ],
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "02-operators#Step 1 \u2014 The specification for comparing and printing": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-operators#Step 2 \u2014 Let the compiler write the comparisons": {
    "wrong": [
      {
        "name": "did nothing",
        "fails": [
          0,
          1,
          2,
        ],
      },
    ],
  },
  "02-operators#Step 3 \u2014 Printing, and a surprise": {
    "run": [
      configure("fraction"),
    ],
    "wrong": [
      {
        "name": "always printed the denominator",
        "files": {
          "fraction/fraction.cpp": "#include \"fraction.h\"\n\n#include <numeric>\n#include <ostream>\n#include <stdexcept>\n\nFraction::Fraction(int whole) : num_(whole), den_(1)\n{\n}\n\nFraction::Fraction(int numerator, int denominator)\n    : num_(numerator), den_(denominator)\n{\n    if (den_ == 0)\n        throw std::invalid_argument(\"Fraction: zero denominator\");\n    if (den_ < 0) {             // keep the sign in the numerator\n        num_ = -num_;\n        den_ = -den_;\n    }\n    const int divisor = std::gcd(num_, den_);   // always positive here\n    num_ /= divisor;\n    den_ /= divisor;\n}\n\nint Fraction::numerator() const\n{\n    return num_;\n}\n\nint Fraction::denominator() const\n{\n    return den_;\n}\n\nstd::ostream& operator<<(std::ostream& out, const Fraction& f)\n{\n    out << f.numerator() << '/' << f.denominator();\n    return out;\n}\n",
        },
        "run": [
          configure("fraction"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "02-operators#Step 4 \u2014 Compare by value": {
    "wrong": [
      {
        "name": "kept the defaulted <=>",
        "files": {
          "fraction/fraction.h": "#pragma once\n\n#include <compare>\n#include <iosfwd>\n\n// A rational number that is always stored in lowest terms, with a\n// positive denominator. Every constructor establishes that promise,\n// and nothing outside the class can break it.\nclass Fraction {\npublic:\n    Fraction() = default;                      // 0/1\n    Fraction(int whole);                       // whole/1, implicit\n    Fraction(int numerator, int denominator);  // throws on denominator 0\n\n    int numerator() const;\n    int denominator() const;\n\n    // Defined inside the class: short, and the same for every caller.\n    double to_double() const\n    {\n        return static_cast<double>(num_) / den_;\n    }\n\n    // Comparisons. The compiler writes ==, and != from it.\n    bool operator==(const Fraction& other) const = default;\n    auto operator<=>(const Fraction& other) const = default;\n\nprivate:\n    int num_ = 0;\n    int den_ = 1;\n};\n\n// Printing: a free function, because the left operand is the stream.\nstd::ostream& operator<<(std::ostream& out, const Fraction& f);\n",
        },
        "run": [
          configure("fraction"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "02-operators#Step 5 \u2014 The specification for arithmetic": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-operators#Step 6 \u2014 Members or free functions?": {
    "wrong": [
      {
        "name": "made operator+ a member",
        "files": {
          "fraction/fraction.h": "#pragma once\n\n#include <compare>\n#include <iosfwd>\n\n// A rational number that is always stored in lowest terms, with a\n// positive denominator. Every constructor establishes that promise,\n// and nothing outside the class can break it.\nclass Fraction {\npublic:\n    Fraction() = default;                      // 0/1\n    Fraction(int whole);                       // whole/1, implicit\n    Fraction(int numerator, int denominator);  // throws on denominator 0\n\n    int numerator() const;\n    int denominator() const;\n\n    // Defined inside the class: short, and the same for every caller.\n    double to_double() const\n    {\n        return static_cast<double>(num_) / den_;\n    }\n\n    // Arithmetic that changes this fraction: members.\n    Fraction& operator+=(const Fraction& other);\n    Fraction& operator-=(const Fraction& other);\n    Fraction& operator*=(const Fraction& other);\n    Fraction& operator/=(const Fraction& other);  // throws on zero\n    Fraction operator+(const Fraction& other) const;\n    Fraction operator-() const;                    // unary minus: -f\n\n    // Comparisons. The compiler writes ==, and != from it.\n    bool operator==(const Fraction& other) const = default;\n    std::strong_ordering operator<=>(const Fraction& other) const\n    {\n        // a/b < c/d  is  a*d < c*b, because b and d are positive.\n        // long long: the products may not fit in an int.\n        const long long left = static_cast<long long>(num_) * other.den_;\n        const long long right = static_cast<long long>(other.num_) * den_;\n        return left <=> right;\n    }\n\nprivate:\n    int num_ = 0;\n    int den_ = 1;\n};\n\n// Arithmetic that makes a new fraction: free functions, so a whole\n// number converts on either side (1 + f as well as f + 1).\nFraction operator-(Fraction left, const Fraction& right);\nFraction operator*(Fraction left, const Fraction& right);\nFraction operator/(Fraction left, const Fraction& right);\n\n// Printing: a free function, because the left operand is the stream.\nstd::ostream& operator<<(std::ostream& out, const Fraction& f);\n",
        },
        "fails": [
          1,
        ],
      },
    ],
  },
  "02-operators#Step 7 \u2014 Arithmetic": {
    "wrong": [
      {
        "name": "operator+ as a member (1 + half does not compile)",
        "files": {
          "fraction/fraction.cpp": "#include \"fraction.h\"\n\n#include <numeric>\n#include <ostream>\n#include <stdexcept>\n\nFraction::Fraction(int whole) : num_(whole), den_(1)\n{\n}\n\nFraction::Fraction(int numerator, int denominator)\n    : num_(numerator), den_(denominator)\n{\n    if (den_ == 0)\n        throw std::invalid_argument(\"Fraction: zero denominator\");\n    if (den_ < 0) {             // keep the sign in the numerator\n        num_ = -num_;\n        den_ = -den_;\n    }\n    const int divisor = std::gcd(num_, den_);   // always positive here\n    num_ /= divisor;\n    den_ /= divisor;\n}\n\nint Fraction::numerator() const\n{\n    return num_;\n}\n\nint Fraction::denominator() const\n{\n    return den_;\n}\n\nFraction& Fraction::operator+=(const Fraction& other)\n{\n    // a/b + c/d = (a*d + c*b) / (b*d); the constructor reduces it.\n    *this = Fraction(num_ * other.den_ + other.num_ * den_,\n                     den_ * other.den_);\n    return *this;\n}\n\nFraction& Fraction::operator-=(const Fraction& other)\n{\n    return *this += -other;\n}\n\nFraction& Fraction::operator*=(const Fraction& other)\n{\n    *this = Fraction(num_ * other.num_, den_ * other.den_);\n    return *this;\n}\n\nFraction& Fraction::operator/=(const Fraction& other)\n{\n    if (other.num_ == 0)\n        throw std::domain_error(\"Fraction: division by zero\");\n    *this = Fraction(num_ * other.den_, den_ * other.num_);\n    return *this;\n}\n\nFraction Fraction::operator-() const\n{\n    return Fraction(-num_, den_);\n}\n\nFraction Fraction::operator+(const Fraction& other) const\n{\n    Fraction result = *this;\n    return result += other;\n}\n\nFraction operator-(Fraction left, const Fraction& right)\n{\n    return left -= right;\n}\n\nFraction operator*(Fraction left, const Fraction& right)\n{\n    return left *= right;\n}\n\nFraction operator/(Fraction left, const Fraction& right)\n{\n    return left /= right;\n}\n\nstd::ostream& operator<<(std::ostream& out, const Fraction& f)\n{\n    out << f.numerator();\n    if (f.denominator() != 1)\n        out << '/' << f.denominator();\n    return out;\n}\n",
          "fraction/fraction.h": "#pragma once\n\n#include <compare>\n#include <iosfwd>\n\n// A rational number that is always stored in lowest terms, with a\n// positive denominator. Every constructor establishes that promise,\n// and nothing outside the class can break it.\nclass Fraction {\npublic:\n    Fraction() = default;                      // 0/1\n    Fraction(int whole);                       // whole/1, implicit\n    Fraction(int numerator, int denominator);  // throws on denominator 0\n\n    int numerator() const;\n    int denominator() const;\n\n    // Defined inside the class: short, and the same for every caller.\n    double to_double() const\n    {\n        return static_cast<double>(num_) / den_;\n    }\n\n    // Arithmetic that changes this fraction: members.\n    Fraction& operator+=(const Fraction& other);\n    Fraction& operator-=(const Fraction& other);\n    Fraction& operator*=(const Fraction& other);\n    Fraction& operator/=(const Fraction& other);  // throws on zero\n    Fraction operator+(const Fraction& other) const;\n    Fraction operator-() const;                    // unary minus: -f\n\n    // Comparisons. The compiler writes ==, and != from it.\n    bool operator==(const Fraction& other) const = default;\n    std::strong_ordering operator<=>(const Fraction& other) const\n    {\n        // a/b < c/d  is  a*d < c*b, because b and d are positive.\n        // long long: the products may not fit in an int.\n        const long long left = static_cast<long long>(num_) * other.den_;\n        const long long right = static_cast<long long>(other.num_) * den_;\n        return left <=> right;\n    }\n\nprivate:\n    int num_ = 0;\n    int den_ = 1;\n};\n\n// Arithmetic that makes a new fraction: free functions, so a whole\n// number converts on either side (1 + f as well as f + 1).\nFraction operator-(Fraction left, const Fraction& right);\nFraction operator*(Fraction left, const Fraction& right);\nFraction operator/(Fraction left, const Fraction& right);\n\n// Printing: a free function, because the left operand is the stream.\nstd::ostream& operator<<(std::ostream& out, const Fraction& f);\n",
        },
        "run": [
          configure("fraction"),
        ],
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "02-operators#Step 8 \u2014 Your own tests": {
    "wrong": [
      {
        "name": "only one test",
        "files": {
          "fraction/tests/my_arithmetic_test.cpp": "#include \"studio_test.hpp\"\n\n#include \"fraction.h\"\n\nTEST(one) { CHECK_EQ(Fraction(1) + 1, Fraction(2)); }\n",
        },
        "run": [
          configure("fraction"),
        ],
        "fails": [
          0,
        ],
      },
    ],
  },
  "02-operators#Step 9 \u2014 The reviewer's tests": {
    "wrong": [
      {
        "name": "+= returned a copy",
        "typeFile": true,
        "editFiles": {
          "fraction/fraction.h": [
            [
              "    Fraction& operator+=(const Fraction& other);",
              "    Fraction operator+=(const Fraction& other);",
            ],
          ],
          "fraction/fraction.cpp": [
            [
              "Fraction& Fraction::operator+=(const Fraction& other)",
              "Fraction Fraction::operator+=(const Fraction& other)",
            ],
          ],
        },
        "run": [
          configure("fraction"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "03-inheritance#Step 1 \u2014 Predict: which send runs?": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "03-inheritance#Step 2 \u2014 virtual and override": {
    "wrong": [
      {
        "name": "virtual, but no override",
        "files": {
          "alerts/channels.cpp": "// Notification channels: one base class, two kinds of channel.\n#include <iostream>\n#include <memory>\n#include <string>\n#include <vector>\n\nclass Channel {\npublic:\n    virtual ~Channel() = default;   // step 3 explains this line\n\n    virtual void send(const std::string& message) const\n    {\n        std::cout << \"[channel] \" << message << '\\n';\n    }\n};\n\nclass EmailChannel : public Channel {\npublic:\n    void send(const std::string& message) const\n    {\n        std::cout << \"[email] Subject: Alert | \" << message << '\\n';\n    }\n};\n\nclass SmsChannel : public Channel {\npublic:\n    void send(const std::string& message) const\n    {\n        // Text messages are short: keep the first 16 characters.\n        std::cout << \"[sms] \" << message.substr(0, 16) << '\\n';\n    }\n};\n\nvoid broadcast(const std::vector<std::unique_ptr<Channel>>& channels,\n               const std::string& message)\n{\n    for (const auto& channel : channels)\n        channel->send(message);\n}\n\nint main()\n{\n    std::vector<std::unique_ptr<Channel>> channels;\n    channels.push_back(std::make_unique<EmailChannel>());\n    channels.push_back(std::make_unique<SmsChannel>());\n\n    broadcast(channels, \"Disk almost full on build server\");\n    return 0;\n}\n",
        },
        "fails": [
          1,
        ],
      },
      {
        "name": "override that does not match (const missing)",
        "files": {
          "alerts/channels.cpp": "// Notification channels: one base class, two kinds of channel.\n#include <iostream>\n#include <memory>\n#include <string>\n#include <vector>\n\nclass Channel {\npublic:\n    virtual ~Channel() = default;   // step 3 explains this line\n\n    virtual void send(const std::string& message) const\n    {\n        std::cout << \"[channel] \" << message << '\\n';\n    }\n};\n\nclass EmailChannel : public Channel {\npublic:\n    void send(const std::string& message) const override\n    {\n        std::cout << \"[email] Subject: Alert | \" << message << '\\n';\n    }\n};\n\nclass SmsChannel : public Channel {\npublic:\n    void send(const std::string& message) override\n    {\n        // Text messages are short: keep the first 16 characters.\n        std::cout << \"[sms] \" << message.substr(0, 16) << '\\n';\n    }\n};\n\nvoid broadcast(const std::vector<std::unique_ptr<Channel>>& channels,\n               const std::string& message)\n{\n    for (const auto& channel : channels)\n        channel->send(message);\n}\n\nint main()\n{\n    std::vector<std::unique_ptr<Channel>> channels;\n    channels.push_back(std::make_unique<EmailChannel>());\n    channels.push_back(std::make_unique<SmsChannel>());\n\n    broadcast(channels, \"Disk almost full on build server\");\n    return 0;\n}\n",
        },
        "fails": [
          2,
        ],
      },
    ],
  },
  "03-inheritance#Step 3 \u2014 A destructor that never runs": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "03-inheritance#Step 4 \u2014 Virtual destructors": {
    "wrong": [
      {
        "name": "did nothing",
        "files": {
          "alerts/cleanup.cpp": "// A channel that buffers messages and writes them out when destroyed.\n#include <iostream>\n#include <memory>\n#include <string>\n#include <vector>\n\nclass Channel {\npublic:\n    ~Channel() { std::cout << \"Channel destroyed\\n\"; }\n\n    virtual void send(const std::string& message)\n    {\n        std::cout << \"[channel] \" << message << '\\n';\n    }\n};\n\nclass LogFileChannel : public Channel {\npublic:\n    ~LogFileChannel()\n    {\n        // A real one would write the lines to a file here.\n        std::cout << \"LogFileChannel: writing \" << pending_.size()\n                  << \" buffered lines to alerts.log\\n\";\n    }\n\n    void send(const std::string& message) override\n    {\n        pending_.push_back(message);\n        std::cout << \"[log] buffered: \" << message << '\\n';\n    }\n\nprivate:\n    std::vector<std::string> pending_;\n};\n\nint main()\n{\n    {\n        std::unique_ptr<Channel> channel =\n            std::make_unique<LogFileChannel>();\n        channel->send(\"Backup started\");\n        channel->send(\"Backup finished\");\n    }   // channel is destroyed here\n    std::cout << \"main ends\\n\";\n    return 0;\n}\n",
        },
        "fails": [
          0,
          2,
        ],
      },
    ],
  },
  "03-inheritance#Step 5 \u2014 Slicing": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "03-inheritance#Step 6 \u2014 Fix the slice": {
    "wrong": [
      {
        "name": "still by value",
        "files": {
          "alerts/slicing.cpp": "// Passing a channel to a function that announces a message.\n#include <iostream>\n#include <string>\n\nclass Channel {\npublic:\n    virtual ~Channel() = default;\n\n    virtual void send(const std::string& message) const\n    {\n        std::cout << \"[channel] \" << message << '\\n';\n    }\n};\n\nclass SmsChannel : public Channel {\npublic:\n    void send(const std::string& message) const override\n    {\n        std::cout << \"[sms] \" << message.substr(0, 16) << '\\n';\n    }\n};\n\nvoid announce(Channel channel, const std::string& message)\n{\n    channel.send(message);\n}\n\nint main()\n{\n    SmsChannel sms;\n    sms.send(\"Server room temperature high\");\n    announce(sms, \"Server room temperature high\");\n    return 0;\n}\n",
        },
        "fails": [
          0,
          2,
        ],
      },
    ],
  },
  "03-inheritance#Step 7 \u2014 Challenge: a push channel": {
    "wrong": [
      {
        "name": "always added ...",
        "files": {
          "alerts/channels.cpp": "// Notification channels: one base class, two kinds of channel.\n#include <iostream>\n#include <memory>\n#include <string>\n#include <vector>\n\nclass Channel {\npublic:\n    virtual ~Channel() = default;   // step 3 explains this line\n\n    virtual void send(const std::string& message) const\n    {\n        std::cout << \"[channel] \" << message << '\\n';\n    }\n};\n\nclass EmailChannel : public Channel {\npublic:\n    void send(const std::string& message) const override\n    {\n        std::cout << \"[email] Subject: Alert | \" << message << '\\n';\n    }\n};\n\nclass SmsChannel : public Channel {\npublic:\n    void send(const std::string& message) const override\n    {\n        // Text messages are short: keep the first 16 characters.\n        std::cout << \"[sms] \" << message.substr(0, 16) << '\\n';\n    }\n};\n\nclass PushChannel final : public Channel {\npublic:\n    void send(const std::string& message) const override\n    {\n        // Phone notifications: at most 24 characters, then \"...\".\n        std::cout << \"[push] \" << message.substr(0, 24) << \"...\\n\";\n    }\n};\n\nvoid broadcast(const std::vector<std::unique_ptr<Channel>>& channels,\n               const std::string& message)\n{\n    for (const auto& channel : channels)\n        channel->send(message);\n}\n\nint main()\n{\n    std::vector<std::unique_ptr<Channel>> channels;\n    channels.push_back(std::make_unique<EmailChannel>());\n    channels.push_back(std::make_unique<SmsChannel>());\n    channels.push_back(std::make_unique<PushChannel>());\n\n    broadcast(channels, \"Build passed\");\n    broadcast(channels, \"Disk almost full on build server\");\n    return 0;\n}\n",
        },
        "fails": [
          2,
        ],
      },
      {
        "name": "forgot final",
        "files": {
          "alerts/channels.cpp": "// Notification channels: one base class, two kinds of channel.\n#include <iostream>\n#include <memory>\n#include <string>\n#include <vector>\n\nclass Channel {\npublic:\n    virtual ~Channel() = default;   // step 3 explains this line\n\n    virtual void send(const std::string& message) const\n    {\n        std::cout << \"[channel] \" << message << '\\n';\n    }\n};\n\nclass EmailChannel : public Channel {\npublic:\n    void send(const std::string& message) const override\n    {\n        std::cout << \"[email] Subject: Alert | \" << message << '\\n';\n    }\n};\n\nclass SmsChannel : public Channel {\npublic:\n    void send(const std::string& message) const override\n    {\n        // Text messages are short: keep the first 16 characters.\n        std::cout << \"[sms] \" << message.substr(0, 16) << '\\n';\n    }\n};\n\nclass PushChannel : public Channel {\npublic:\n    void send(const std::string& message) const override\n    {\n        // Phone notifications: at most 24 characters, then \"...\".\n        if (message.size() <= 24)\n            std::cout << \"[push] \" << message << '\\n';\n        else\n            std::cout << \"[push] \" << message.substr(0, 24) << \"...\\n\";\n    }\n};\n\nvoid broadcast(const std::vector<std::unique_ptr<Channel>>& channels,\n               const std::string& message)\n{\n    for (const auto& channel : channels)\n        channel->send(message);\n}\n\nint main()\n{\n    std::vector<std::unique_ptr<Channel>> channels;\n    channels.push_back(std::make_unique<EmailChannel>());\n    channels.push_back(std::make_unique<SmsChannel>());\n    channels.push_back(std::make_unique<PushChannel>());\n\n    broadcast(channels, \"Build passed\");\n    broadcast(channels, \"Disk almost full on build server\");\n    return 0;\n}\n",
        },
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-interfaces#Step 1 \u2014 The project's build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-interfaces#Step 2 \u2014 Interfaces": {
    "wrong": [
      {
        "name": "no virtual destructors",
        "files": {
          "notifier/interfaces.h": "#pragma once\n\n#include <string>\n\n// What Notifier needs from the outside world, and nothing more.\n// Each is an abstract class: an interface with no data and no code.\n\nclass Clock {\npublic:\n    virtual int hour() const = 0;     // the local hour, 0 to 23\n};\n\nclass Channel {\npublic:\n    virtual void send(const std::string& message) = 0;\n};\n",
        },
        "fails": [
          2,
          3,
        ],
      },
    ],
  },
  "04-interfaces#Step 3 \u2014 The specification": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-interfaces#Step 4 \u2014 Composition": {
    "wrong": [
      {
        "name": "stored the clock by value",
        "files": {
          "notifier/notifier.h": "#pragma once\n\n#include <cstddef>\n#include <string>\n#include <vector>\n\n#include \"interfaces.h\"\n\nenum class Priority { normal, urgent };\n\n// Sends messages through a channel, but holds normal messages during\n// quiet hours (22:00 to 06:59) until deliver_held() is called after\n// them. Notifier doesn't own its clock or channel: they must outlive it.\nclass Notifier {\npublic:\n    Notifier(const Clock& clock, Channel& channel);\n\n    void notify(const std::string& message,\n                Priority priority = Priority::normal);\n    void deliver_held();\n    std::size_t held_count() const;\n\n    static bool is_quiet_hour(int hour);\n\nprivate:\n    Clock clock_;\n    Channel& channel_;\n    std::vector<std::string> held_;\n};\n",
        },
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-interfaces#Step 5 \u2014 Fakes": {
    "wrong": [
      {
        "name": "private inheritance by accident",
        "files": {
          "notifier/tests/fakes.h": "#pragma once\n\n#include <string>\n#include <vector>\n\n#include \"interfaces.h\"\n\n// Stand-ins for the real clock and channel, for the tests: a clock\n// that says whatever hour the test sets, and a channel that remembers\n// what it was asked to send.\n\nclass FakeClock : public Clock {\npublic:\n    explicit FakeClock(int hour) : hour_(hour) {}\n\n    int hour() const override { return hour_; }\n    void set_hour(int hour) { hour_ = hour; }\n\nprivate:\n    int hour_;\n};\n\nclass FakeChannel : Channel {\npublic:\n    void send(const std::string& message) override\n    {\n        sent.push_back(message);\n    }\n\n    std::vector<std::string> sent;\n};\n",
        },
        "fails": [
          1,
        ],
      },
    ],
  },
  "04-interfaces#Step 6 \u2014 The real wiring": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "04-interfaces#Step 7 \u2014 Implement Notifier": {
    "run": [
      configure("notifier"),
    ],
    "wrong": [
      {
        "name": "held urgent messages too",
        "files": {
          "notifier/notifier.cpp": "#include \"notifier.h\"\n\nNotifier::Notifier(const Clock& clock, Channel& channel)\n    : clock_(clock), channel_(channel)\n{\n}\n\nbool Notifier::is_quiet_hour(int hour)\n{\n    return hour >= 22 || hour < 7;\n}\n\nvoid Notifier::notify(const std::string& message, Priority priority)\n{\n    if (is_quiet_hour(clock_.hour())) {\n        held_.push_back(message);\n        return;\n    }\n    deliver_held();                  // anything older goes out first\n    channel_.send(message);\n}\n\nvoid Notifier::deliver_held()\n{\n    if (is_quiet_hour(clock_.hour()))\n        return;\n    for (const std::string& message : held_)\n        channel_.send(message);\n    held_.clear();\n}\n\nstd::size_t Notifier::held_count() const\n{\n    return held_.size();\n}\n",
        },
        "run": [
          configure("notifier"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "04-interfaces#Step 8 \u2014 The reviewer's tests": {
    "wrong": [
      {
        "name": "07:00 counted as quiet",
        "typeFile": true,
        "editFiles": {
          "notifier/notifier.cpp": [
            [
              "hour < 7",
              "hour <= 7",
            ],
          ],
        },
        "run": [
          configure("notifier"),
        ],
        "fails": [
          2,
        ],
      },
      {
        "name": "new message jumped the queue",
        "typeFile": true,
        "editFiles": {
          "notifier/notifier.cpp": [
            [
              "    deliver_held();                  // anything older goes out first\n",
              "",
            ],
          ],
        },
        "run": [
          configure("notifier"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "05-errors#Step 2 \u2014 C++23": {
    "wrong": [
      {
        "name": "did nothing",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-errors#Step 3 \u2014 expected, with a fallback": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-errors#Step 4 \u2014 The specification for parsing": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "05-errors#Step 5 \u2014 Declare the parser": {
    "wrong": [
      {
        "name": "did nothing",
        "fails": [
          0,
          1,
          2,
        ],
      },
    ],
  },
  "05-errors#Step 6 \u2014 Parse": {
    "wrong": [
      {
        "name": "let the constructor throw on 3/0",
        "files": {
          "fraction/fraction.cpp": "#include \"fraction.h\"\n\n#include <charconv>\n#include <numeric>\n#include <ostream>\n#include <stdexcept>\n\nFraction::Fraction(int whole) : num_(whole), den_(1)\n{\n}\n\nFraction::Fraction(int numerator, int denominator)\n    : num_(numerator), den_(denominator)\n{\n    if (den_ == 0)\n        throw std::invalid_argument(\"Fraction: zero denominator\");\n    if (den_ < 0) {             // keep the sign in the numerator\n        num_ = -num_;\n        den_ = -den_;\n    }\n    const int divisor = std::gcd(num_, den_);   // always positive here\n    num_ /= divisor;\n    den_ /= divisor;\n}\n\nint Fraction::numerator() const\n{\n    return num_;\n}\n\nint Fraction::denominator() const\n{\n    return den_;\n}\n\nFraction& Fraction::operator+=(const Fraction& other)\n{\n    // a/b + c/d = (a*d + c*b) / (b*d); the constructor reduces it.\n    *this = Fraction(num_ * other.den_ + other.num_ * den_,\n                     den_ * other.den_);\n    return *this;\n}\n\nFraction& Fraction::operator-=(const Fraction& other)\n{\n    return *this += -other;\n}\n\nFraction& Fraction::operator*=(const Fraction& other)\n{\n    *this = Fraction(num_ * other.num_, den_ * other.den_);\n    return *this;\n}\n\nFraction& Fraction::operator/=(const Fraction& other)\n{\n    if (other.num_ == 0)\n        throw std::domain_error(\"Fraction: division by zero\");\n    *this = Fraction(num_ * other.den_, den_ * other.num_);\n    return *this;\n}\n\nFraction Fraction::operator-() const\n{\n    return Fraction(-num_, den_);\n}\n\nFraction operator+(Fraction left, const Fraction& right)\n{\n    return left += right;\n}\n\nFraction operator-(Fraction left, const Fraction& right)\n{\n    return left -= right;\n}\n\nFraction operator*(Fraction left, const Fraction& right)\n{\n    return left *= right;\n}\n\nFraction operator/(Fraction left, const Fraction& right)\n{\n    return left /= right;\n}\n\nstd::ostream& operator<<(std::ostream& out, const Fraction& f)\n{\n    out << f.numerator();\n    if (f.denominator() != 1)\n        out << '/' << f.denominator();\n    return out;\n}\n\nnamespace {\n\n// Reads text that must be one whole int and nothing else: digits,\n// with a '-' in front only if allow_minus is true.\ncompat::expected<int, ParseError> parse_int(std::string_view text,\n                                            bool allow_minus)\n{\n    if (text.empty() || (text.front() == '-' && !allow_minus))\n        return compat::unexpected(ParseError::bad_format);\n    int value = 0;\n    const char* first = text.data();\n    const char* last = text.data() + text.size();\n    const auto [end, error] = std::from_chars(first, last, value);\n    if (error == std::errc::result_out_of_range)\n        return compat::unexpected(ParseError::out_of_range);\n    if (error != std::errc() || end != last)\n        return compat::unexpected(ParseError::bad_format);\n    return value;\n}\n\n} // namespace\n\ncompat::expected<Fraction, ParseError> parse_fraction(std::string_view text)\n{\n    if (text.empty())\n        return compat::unexpected(ParseError::empty);\n\n    const std::size_t slash = text.find('/');\n    const auto numerator = parse_int(text.substr(0, slash), true);\n    if (!numerator)\n        return compat::unexpected(numerator.error());\n    if (slash == std::string_view::npos)\n        return Fraction(*numerator);\n\n    const auto denominator = parse_int(text.substr(slash + 1), false);\n    if (!denominator)\n        return compat::unexpected(denominator.error());\n    return Fraction(*numerator, *denominator);\n}\n\nstd::string_view describe(ParseError error)\n{\n    switch (error) {\n    case ParseError::empty: return \"empty input\";\n    case ParseError::bad_format: return \"not a fraction\";\n    case ParseError::zero_denominator: return \"zero denominator\";\n    case ParseError::out_of_range: return \"number too large\";\n    }\n    return \"unknown error\";\n}\n",
        },
        "run": [
          configure("fraction"),
        ],
        "fails": [
          1,
        ],
      },
    ],
  },
  "05-errors#Step 7 \u2014 A calculator": {
    "wrong": [
      {
        "name": "did not write it",
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "05-errors#Step 8 \u2014 Build the calculator": {
    "wrong": [
      {
        "name": "error messages without quotes",
        "typeFile": true,
        "files": {
          "fraction/main.cpp": "// A fraction calculator: reads lines like \"1/2 + 1/3\" and prints\n// \"= 5/6\", or a clear error.\n#include <iostream>\n#include <stdexcept>\n#include <string>\n\n#include \"fraction.h\"\n\nnamespace {\n\nusing Result = compat::expected<Fraction, std::string>;\n\nstd::string explain(const std::string& text, ParseError error)\n{\n    return text + \": \" + std::string(describe(error));\n}\n\nResult calculate(const std::string& left, const std::string& op,\n                 const std::string& right)\n{\n    const auto a = parse_fraction(left);\n    if (!a)\n        return compat::unexpected(explain(left, a.error()));\n    const auto b = parse_fraction(right);\n    if (!b)\n        return compat::unexpected(explain(right, b.error()));\n\n    try {\n        if (op == \"+\") return *a + *b;\n        if (op == \"-\") return *a - *b;\n        if (op == \"*\") return *a * *b;\n        if (op == \"/\") return *a / *b;\n    } catch (const std::domain_error&) {\n        return compat::unexpected(std::string(\"division by zero\"));\n    }\n    return compat::unexpected(\"unknown operator '\" + op + \"'\");\n}\n\n} // namespace\n\nint main()\n{\n    std::string left, op, right;\n    while (std::cin >> left >> op >> right) {\n        const auto result = calculate(left, op, right);\n        if (result)\n            std::cout << \"= \" << *result << '\\n';\n        else\n            std::cout << \"error: \" << result.error() << '\\n';\n    }\n    return 0;\n}\n",
        },
        "run": [
          configure("fraction"),
        ],
        "fails": [
          3,
        ],
      },
    ],
  },
  "05-errors#Step 9 \u2014 The reviewer's tests": {
    "wrong": [
      {
        "name": "allowed a negative denominator",
        "typeFile": true,
        "editFiles": {
          "fraction/fraction.cpp": [
            [
              "parse_int(text.substr(slash + 1), false)",
              "parse_int(text.substr(slash + 1), true)",
            ],
          ],
        },
        "run": [
          configure("fraction"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "06-value-types#Step 1 \u2014 A regular type in ten lines": {
    "wrong": [
      {
        "name": "forgot the comparison",
        "files": {
          "values/version.cpp": "// Version numbers as a value type: compare them, sort them, copy them.\n#include <algorithm>\n#include <compare>\n#include <iostream>\n#include <vector>\n\nstruct Version {\n    int major = 0;\n    int minor = 0;\n    int patch = 0;\n};\n\nstd::ostream& operator<<(std::ostream& out, const Version& v)\n{\n    return out << v.major << '.' << v.minor << '.' << v.patch;\n}\n\nint main()\n{\n    std::vector<Version> releases {{1, 10, 0}, {1, 2, 3}, {2, 0, 0},\n                                   {1, 2, 10}};\n    std::sort(releases.begin(), releases.end());\n    for (const Version& v : releases)\n        std::cout << v << '\\n';\n\n    Version installed {1, 2, 3};\n    Version copy = installed;                 // an independent copy\n    copy.patch = 4;\n    std::cout << \"installed \" << installed << \", copy \" << copy << '\\n';\n    std::cout << \"update available: \" << std::boolalpha\n              << (installed < releases.back()) << '\\n';\n    return 0;\n}\n",
        },
        "fails": [
          0,
          1,
        ],
      },
    ],
  },
  "06-value-types#Step 2 \u2014 The project's build file": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-value-types#Step 3 \u2014 Requirements": {
    "wrong": [
      {
        "name": "did not create it",
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-value-types#Step 4 \u2014 Design the class": {
    "wrong": [
      {
        "name": "a struct with a public field",
        "files": {
          "money/money.h": "#pragma once\n\nstruct Money {\n    long long cents = 0;\n};\n",
        },
        "fails": [
          0,
          1,
          2,
          3,
        ],
      },
    ],
  },
  "06-value-types#Step 5 \u2014 Implement it": {
    "run": [
      configure("money"),
    ],
    "wrong": [
      {
        "name": "split dropped the leftover cents",
        "files": {
          "money/money.cpp": "#include \"money.h\"\n\n#include <ostream>\n#include <stdexcept>\n\nMoney Money::from_cents(long long cents)\n{\n    return Money(cents);\n}\n\nstd::string Money::to_string() const\n{\n    // Work with the size of the amount, and put the sign back in front:\n    // -5 cents is \"-0.05\". (cents_ / 100 and cents_ % 100 would give\n    // 0 and -5 here, and \"0.-5\".)\n    const long long size = cents_ < 0 ? -cents_ : cents_;\n    const long long whole = size / 100;\n    const long long rest = size % 100;\n    std::string text = cents_ < 0 ? \"-\" : \"\";\n    text += std::to_string(whole) + '.';\n    if (rest < 10)\n        text += '0';\n    text += std::to_string(rest);\n    return text;\n}\n\nMoney& Money::operator+=(const Money& other)\n{\n    cents_ += other.cents_;\n    return *this;\n}\n\nMoney& Money::operator-=(const Money& other)\n{\n    cents_ -= other.cents_;\n    return *this;\n}\n\nstd::vector<Money> Money::split(int parts) const\n{\n    if (parts < 1)\n        throw std::invalid_argument(\"Money::split: parts must be 1 or more\");\n    const long long size = cents_ < 0 ? -cents_ : cents_;\n    const long long sign = cents_ < 0 ? -1 : 1;\n    const long long share = size / parts;\n    const long long extra = size % parts;    // the first `extra` shares\n                                             // get one more cent\n    std::vector<Money> shares;\n    for (int i = 0; i < parts; ++i)\n        shares.push_back(Money(sign * (share + 0)));\n    return shares;\n}\n\nMoney operator+(Money left, const Money& right)\n{\n    return left += right;\n}\n\nMoney operator-(Money left, const Money& right)\n{\n    return left -= right;\n}\n\nstd::ostream& operator<<(std::ostream& out, const Money& money)\n{\n    return out << money.to_string();\n}\n",
        },
        "run": [
          configure("money"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
  "06-value-types#Step 6 \u2014 Your own tests": {
    "wrong": [
      {
        "name": "only one test",
        "files": {
          "money/tests/money_test.cpp": "#include \"studio_test.hpp\"\n\n#include \"money.h\"\n\nTEST(one) { CHECK_EQ(Money().cents(), 0); }\n",
        },
        "run": [
          configure("money"),
        ],
        "fails": [
          0,
        ],
      },
    ],
  },
  "06-value-types#Step 7 \u2014 The reviewer's tests": {
    "wrong": [
      {
        "name": "naive to_string",
        "typeFile": true,
        "files": {
          "money/money.cpp": "#include \"money.h\"\n\n#include <ostream>\n#include <stdexcept>\n\nMoney Money::from_cents(long long cents)\n{\n    return Money(cents);\n}\n\nstd::string Money::to_string() const\n{\n    const long long rest = cents_ % 100;\n    return std::to_string(cents_ / 100) + (rest < 10 ? \".0\" : \".\")\n           + std::to_string(rest);\n}\n\nMoney& Money::operator+=(const Money& other)\n{\n    cents_ += other.cents_;\n    return *this;\n}\n\nMoney& Money::operator-=(const Money& other)\n{\n    cents_ -= other.cents_;\n    return *this;\n}\n\nstd::vector<Money> Money::split(int parts) const\n{\n    if (parts < 1)\n        throw std::invalid_argument(\"Money::split: parts must be 1 or more\");\n    const long long size = cents_ < 0 ? -cents_ : cents_;\n    const long long sign = cents_ < 0 ? -1 : 1;\n    const long long share = size / parts;\n    const long long extra = size % parts;    // the first `extra` shares\n                                             // get one more cent\n    std::vector<Money> shares;\n    for (int i = 0; i < parts; ++i)\n        shares.push_back(Money(sign * (share + (i < extra ? 1 : 0))));\n    return shares;\n}\n\nMoney operator+(Money left, const Money& right)\n{\n    return left += right;\n}\n\nMoney operator-(Money left, const Money& right)\n{\n    return left -= right;\n}\n\nstd::ostream& operator<<(std::ostream& out, const Money& money)\n{\n    return out << money.to_string();\n}\n",
        },
        "run": [
          configure("money"),
        ],
        "fails": [
          2,
        ],
      },
    ],
  },
};
