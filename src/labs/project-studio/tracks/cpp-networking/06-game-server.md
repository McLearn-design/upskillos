---
title: 6 — Project: a Multiplayer Game Server
track: Networking
runtime: cpp
reference: optional
console: true
---

In a multiplayer game, every player's program shows the same world. Who decides what that world **is**? If each client decides for itself and tells the others, a modified client can say "I won" and everyone else has to believe it.

So real games use an **authoritative server**:

| | The server | Each client |
|---|---|---|
| Owns | the one true game state | a copy, for drawing |
| Receives | requests: "I'd like to move here" | the state, after every change |
| Decides | whether a request is legal | nothing |

This project is the smallest real version: **tic-tac-toe** for two players over TCP. The rules live in a `Board` class that knows nothing about networks, tested on its own. The server owns a `Board`, checks every move against it, and tells both players the result.

This lesson gives the least code of the track. The steps give the requirements and tests; the full code is in the reference if you need it.

## Step 1 — The rules

**This step: create the supplied `ttt/board.h` and read it.**

`Board` is a value type with one job: the rules. Nine cells, `place`, `winner`, `full`, and `str` to send it as text. It doesn't know about players, turns or sockets. The server will add those.

```cpp file=ttt/board.h provided
// board.h: the rules of tic-tac-toe, and nothing about networks.
//
// Cells are numbered 0 to 8, row by row:
//
//   0 1 2
//   3 4 5
//   6 7 8
#pragma once

#include <string>

class Board {
public:
    // 'X', 'O', or '.' for an empty cell.
    char at(int cell) const;

    // Puts mark ('X' or 'O') in an empty cell. Returns false, and
    // changes nothing, if the cell is outside 0..8 or already taken.
    bool place(int cell, char mark);

    // 'X' or 'O' if that mark has three in a row (across, down or
    // diagonally), otherwise '.'.
    char winner() const;

    // True when no cell is empty.
    bool full() const;

    // All nine cells, row by row: "X.O.X...." The game server sends
    // this to the players.
    std::string str() const;

private:
    std::string cells_ = ".........";
};
```

```check
file ttt/board.h
```

## Step 2 — The project's build file

**This step: create the supplied `ttt/CMakeLists.txt`.**

The same as `chat/` and `http/`.

```cmake file=ttt/CMakeLists.txt provided
cmake_minimum_required(VERSION 3.20)
project(ttt LANGUAGES CXX)

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

# The game library: every .cpp file in this folder.
file(GLOB LIB_SOURCES CONFIGURE_DEPENDS *.cpp)

# Every tests/*_test.cpp file becomes part of the test program.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS tests/*_test.cpp)
add_executable(ttt_tests ../testing/test_main.cpp ${TEST_SOURCES} ${LIB_SOURCES})
```

```check
file ttt/CMakeLists.txt
```

## Step 3 — Your tests for the rules

**This step: create `ttt/tests/board_test.cpp` with three tests of your own: `place_rejects_taken_and_out_of_range_cells`, `three_in_a_row_wins` and `full_board_without_a_line_is_a_draw`.**

From the comments in `board.h`. Cover every kind of line in `three_in_a_row_wins`: a row, a column and a diagonal. For the draw, you need a full board where nobody has three in a row; draw one on paper first. Here's one, if you're stuck:

```text
X O X
X O O
O X X
```

The test program won't link until `board.cpp` exists: next step.

```cpp file=ttt/tests/board_test.cpp
// My own tests for the rules.
#include "studio_test.hpp"

#include "board.h"

TEST(place_rejects_taken_and_out_of_range_cells)
{
    Board b;
    CHECK(b.place(4, 'X'));
    CHECK(!b.place(4, 'O'));
    CHECK_EQ(b.at(4), 'X');
    CHECK(!b.place(-1, 'O'));
    CHECK(!b.place(9, 'O'));
    CHECK_EQ(b.str(), std::string("....X...."));
}

TEST(three_in_a_row_wins)
{
    Board row, column, diagonal;
    for (int cell : {3, 4, 5})
        row.place(cell, 'O');
    for (int cell : {2, 5, 8})
        column.place(cell, 'X');
    for (int cell : {2, 4, 6})
        diagonal.place(cell, 'O');
    CHECK_EQ(row.winner(), 'O');
    CHECK_EQ(column.winner(), 'X');
    CHECK_EQ(diagonal.winner(), 'O');
}

TEST(full_board_without_a_line_is_a_draw)
{
    // X O X
    // X O O
    // O X X
    Board b;
    const char* marks = "XOXXOOOXX";
    for (int cell = 0; cell < 9; ++cell)
        b.place(cell, marks[cell]);
    CHECK(b.full());
    CHECK_EQ(b.winner(), '.');
}
```

```check
matches ttt/tests/board_test.cpp "TEST\(\s*place_rejects_taken_and_out_of_range_cells\s*\)" label="has the test place_rejects_taken_and_out_of_range_cells"
matches ttt/tests/board_test.cpp "TEST\(\s*three_in_a_row_wins\s*\)" label="has the test three_in_a_row_wins"
matches ttt/tests/board_test.cpp "TEST\(\s*full_board_without_a_line_is_a_draw\s*\)" label="has the test full_board_without_a_line_is_a_draw"
```

## Step 4 — The board

**This step: create `ttt/board.cpp`. Configure, build and run your tests.**

- `place`: check the range **before** looking at the cell.
- `winner`: there are exactly 8 lines: 3 rows, 3 columns, 2 diagonals. A table of them, `static const int lines[8][3] = {{0, 1, 2}, ...};`, is easier to get right than 8 `if`s.
- `full`: no `'.'` left in `cells_`.

```text
cmake -S ttt -B ttt/build -G "MinGW Makefiles"     (Windows)
cmake -S ttt -B ttt/build                          (macOS, Linux)
```

```text
cmake --build ttt/build
./ttt/build/ttt_tests
```

```cpp file=ttt/board.cpp
#include "board.h"

char Board::at(int cell) const
{
    return cells_[static_cast<std::size_t>(cell)];
}

bool Board::place(int cell, char mark)
{
    if (cell < 0 || cell > 8 || at(cell) != '.')
        return false;
    cells_[static_cast<std::size_t>(cell)] = mark;
    return true;
}

char Board::winner() const
{
    static const int lines[8][3] = {
        {0, 1, 2}, {3, 4, 5}, {6, 7, 8},   // rows
        {0, 3, 6}, {1, 4, 7}, {2, 5, 8},   // columns
        {0, 4, 8}, {2, 4, 6},              // diagonals
    };
    for (const auto& line : lines) {
        char a = at(line[0]);
        if (a != '.' && a == at(line[1]) && a == at(line[2]))
            return a;
    }
    return '.';
}

bool Board::full() const
{
    return cells_.find('.') == std::string::npos;
}

std::string Board::str() const
{
    return cells_;
}
```

```check
file ttt/build/CMakeCache.txt label="ttt/build has been configured" -- Run the configure command for your system, from the track folder.
run "cmake --build ttt/build"
tests "./ttt/build/ttt_tests" require="place_rejects_taken_and_out_of_range_cells three_in_a_row_wins full_board_without_a_line_is_a_draw" timeout=90 -- There are 8 lines to check: 3 rows, 3 columns and 2 diagonals.
```

## Step 5 — The game protocol

**This step: create the supplied `ttt/game_server.h` and read it.**

The protocol is in the comment at the top, and every message is a frame. A whole game, as the two players see it:

```text
X connects        X hears: you X
O connects        O hears: you O
                  both:    board .........   turn X
X: move 4         both:    board ....X....   turn O
O: move 4         O hears: error taken
...
X: move 2         both:    board XXX.OO...   win X
                  the server closes both connections
```

The server never trusts a client to know whose turn it is, or whether a cell is free: it checks with its own `Board`. A client is free to draw the board, guess, or cheat; the only messages that count are the server's.

```cpp file=ttt/game_server.h provided
// game_server.h: an authoritative tic-tac-toe server for two players.
//
// The server owns the one true Board. Players only ask; the server
// checks every move against the rules, and tells both players what
// happened. Every message is a frame (frame.h).
//
// Server to player
//   "you X"         on connecting: the first player is X, the second O
//   "full"          to a third player, who is then disconnected
//   "board X...O.." both players: after the second player connects,
//                   and after every move
//   "turn X"        both players: who moves next
//   "win X"         both players: the game is over, X won
//   "draw"          both players: the game is over, nobody won
//   "left X"        to the other player, if X disconnects mid-game
//   "error ..."     to one player whose message broke the rules:
//                   "error waiting for opponent", "error not your
//                   turn", "error taken", "error bad move"
//
// Player to server
//   "move N"        put my mark in cell N (0..8)
//
// When the game is over, the server closes both connections, and
// run() returns.
#pragma once

#include <atomic>
#include <cstdint>
#include <string>
#include <vector>

#include "board.h"
#include "frame.h"
#include "socket.h"

class GameServer {
public:
    GameServer();                      // 127.0.0.1, any free port
    std::uint16_t port() const;
    void run();                        // one game, or until stop()
    void stop();                       // from any thread

private:
    struct Player {
        net::Socket socket;
        net::FrameDecoder decoder;
        char mark;
    };

    void accept_new();
    bool read_from(Player& player);    // false: the player left
    void handle(Player& player, const std::string& message);
    void send_to(Player& player, const std::string& text);
    void tell_both(const std::string& text);

    net::Socket listener_;
    std::vector<Player> players_;      // at most 2
    Board board_;
    char turn_ = 'X';
    bool over_ = false;
    std::atomic<bool> stopping_{false};
};
```

```check
file ttt/game_server.h
```

## Step 6 — The specification for a game

**This step: create the supplied `ttt/tests/game_test.cpp` and read it.**

Look at `struct Game`. Its members are initialised **in the order they're declared**, and that's used to make the test deterministic: `x_hello = x.hear()` runs before `o` connects, so X is certainly the first player the server accepts.

`both_hear` reads the next message from **both** players, and reports if they heard different things. `play` plays a list of cells, X first, and returns how the last move ended.

```cpp file=ttt/tests/game_test.cpp provided
// Provided by the lesson: games, played by two test clients.
#include "studio_test.hpp"

#include <string>

#include "game_server.h"
#include "test_client.h"

namespace {

// A running server and two players, connected in this order. Members
// are created top to bottom, so X has heard "you X" before O connects.
struct Game {
    net::Startup startup;
    net::RunningServer<GameServer> server;
    net::TestClient x{server.port()};
    std::string x_hello = x.hear();
    net::TestClient o{server.port()};
    std::string o_hello = o.hear();
};

// The next message both players hear, if it's the same for both.
std::string both_hear(Game& g)
{
    std::string to_x = g.x.hear();
    std::string to_o = g.o.hear();
    return to_x == to_o ? to_x : "X heard " + to_x + ", O heard " + to_o;
}

// Plays the moves in order, X first, and returns the last message.
std::string play(Game& g, const std::string& cells)
{
    both_hear(g);   // the empty board
    both_hear(g);   // turn X
    std::string last;
    for (std::size_t i = 0; i < cells.size(); ++i) {
        net::TestClient& mover = i % 2 == 0 ? g.x : g.o;
        mover.say(std::string("move ") + cells[i]);
        both_hear(g);           // the board
        last = both_hear(g);    // turn, win or draw
    }
    return last;
}

} // namespace

TEST(the_first_player_is_x_and_the_second_o)
{
    Game g;
    CHECK_EQ(g.x_hello, std::string("you X"));
    CHECK_EQ(g.o_hello, std::string("you O"));
    CHECK_EQ(both_hear(g), std::string("board ........."));
    CHECK_EQ(both_hear(g), std::string("turn X"));
}

TEST(a_move_is_shown_to_both_players)
{
    Game g;
    both_hear(g);   // the empty board
    both_hear(g);   // turn X
    g.x.say("move 4");
    CHECK_EQ(both_hear(g), std::string("board ....X...."));
    CHECK_EQ(both_hear(g), std::string("turn O"));
    g.o.say("move 0");
    CHECK_EQ(both_hear(g), std::string("board O...X...."));
    CHECK_EQ(both_hear(g), std::string("turn X"));
}

TEST(three_in_a_row_wins_and_ends_the_game)
{
    Game g;
    // X takes the top row: 0, 1, 2. O plays 3 and 4.
    CHECK_EQ(play(g, "03142"), std::string("win X"));
    CHECK_EQ(g.x.hear(), std::string("<nothing>"));   // disconnected
    CHECK_EQ(g.o.hear(), std::string("<nothing>"));
}

TEST(a_full_board_without_a_line_is_a_draw)
{
    Game g;
    // X O X
    // X O O
    // O X X
    CHECK_EQ(play(g, "012435768"), std::string("draw"));
}
```

```check
file ttt/tests/game_test.cpp
```

## Step 7 — The game server

**This step: create `ttt/game_server.cpp`. Build and run the tests.**

It's an event loop like `ChatServer`'s, with at most two clients, and it stops when the game is over. The requirements:

- **`run`**: loop while not stopping and not `over_`: poll the listener and the players (50 ms timeout), read from every ready player, then accept if the listener is ready. When the loop ends, `players_.clear()` closes both connections.
- **A player who leaves** (recv returns 0 or less, or a broken decoder): the game is over, and the other player hears `left X` (the leaver's mark).
- **`accept_new`**: a third player hears `full` and is closed. Otherwise the first player is X and the second O; send `you X` or `you O`. When the second arrives, tell both the board and `turn X`.
- **`handle`**, checking in this order: fewer than two players, `error waiting for opponent`; not exactly `move ` and one digit `0` to `8`, `error bad move`; not the sender's turn, `error not your turn`; `place` fails, `error taken`. Then tell both the new board, followed by `win X`, `draw`, or the next `turn`.

All the error messages go only to the player who caused them.

```text
cmake --build ttt/build
./ttt/build/ttt_tests
```

```cpp file=ttt/game_server.cpp
#include "game_server.h"

#include <cstddef>
#include <utility>

#include "poller.h"
#include "tcp.h"

GameServer::GameServer() : listener_(net::listen_loopback()) {}

std::uint16_t GameServer::port() const
{
    return net::local_port(listener_);
}

void GameServer::stop()
{
    stopping_ = true;
}

void GameServer::run()
{
    while (!stopping_ && !over_) {
        std::vector<net::PollFd> fds;
        fds.push_back(net::watch(listener_));
        for (const Player& p : players_)
            fds.push_back(net::watch(p.socket));
        if (net::poll(fds.data(), fds.size(), 50) <= 0)
            continue;

        for (std::size_t i = 0; i < players_.size() && !over_; ++i) {
            if (fds[i + 1].revents != 0 && !read_from(players_[i])) {
                over_ = true;   // a player left: the game can't go on
                for (Player& other : players_) {
                    if (&other != &players_[i])
                        send_to(other, std::string("left ") +
                                           players_[i].mark);
                }
            }
        }
        if (!over_ && fds[0].revents != 0)
            accept_new();
    }
    players_.clear();   // closes both connections
}

void GameServer::accept_new()
{
    net::Socket socket = net::accept_client(listener_);
    if (players_.size() == 2) {
        net::send_frame(socket, "full");
        return;   // socket closes here
    }
    char mark = players_.empty() ? 'X' : 'O';
    players_.push_back(Player{std::move(socket), {}, mark});
    send_to(players_.back(), std::string("you ") + mark);
    if (players_.size() == 2) {
        tell_both("board " + board_.str());
        tell_both("turn X");
    }
}

bool GameServer::read_from(Player& player)
{
    char buffer[4096];
    long got = net::recv_some(player.socket, buffer, sizeof buffer);
    if (got <= 0)
        return false;
    player.decoder.feed({buffer, static_cast<std::size_t>(got)});
    while (!over_) {
        auto message = player.decoder.next();
        if (!message)
            break;
        handle(player, *message);
    }
    return !player.decoder.broken();
}

void GameServer::handle(Player& player, const std::string& message)
{
    if (players_.size() < 2) {
        send_to(player, "error waiting for opponent");
        return;
    }
    // "move N", with N one digit.
    if (message.size() != 6 || message.rfind("move ", 0) != 0 ||
        message[5] < '0' || message[5] > '8') {
        send_to(player, "error bad move");
        return;
    }
    if (player.mark != turn_) {
        send_to(player, "error not your turn");
        return;
    }
    if (!board_.place(message[5] - '0', player.mark)) {
        send_to(player, "error taken");
        return;
    }

    tell_both("board " + board_.str());
    if (board_.winner() != '.') {
        tell_both(std::string("win ") + board_.winner());
        over_ = true;
    } else if (board_.full()) {
        tell_both("draw");
        over_ = true;
    } else {
        turn_ = turn_ == 'X' ? 'O' : 'X';
        tell_both(std::string("turn ") + turn_);
    }
}

void GameServer::send_to(Player& player, const std::string& text)
{
    net::send_frame(player.socket, text);   // a failure shows up as a read
}

void GameServer::tell_both(const std::string& text)
{
    for (Player& p : players_)
        send_to(p, text);
}
```

```check
run "cmake --build ttt/build"
tests "./ttt/build/ttt_tests" require="the_first_player_is_x_and_the_second_o a_move_is_shown_to_both_players three_in_a_row_wins_and_ends_the_game a_full_board_without_a_line_is_a_draw" timeout=90 -- After a legal move: tell both the board, then win, draw, or the next turn. Switch turn_ only when the game goes on.
```

## Step 8 — The reviewer's tests

**This step: create the supplied `ttt/tests/game_review_test.cpp`, build, and run the tests. If any fail, fix `ttt/game_server.cpp`.**

Your specification tests played fair: every move in turn, every cell free. The reviewer plays like a cheater, a bored teenager and a flaky network:

| Test | The player... |
|---|---|
| `moving_out_of_turn_is_refused` | moves twice in a row |
| `a_taken_cell_is_refused` | moves onto the opponent's mark |
| `nonsense_is_a_bad_move` | sends `move 9`, `move -1`, `jump 3`, an empty frame... |
| `nobody_moves_before_the_opponent_arrives` | plays alone |
| `a_third_player_is_turned_away` | joins a full game |
| `leaving_ends_the_game` | quits halfway |

Each one checks that the refused move **changed nothing**: the next legal move's board is exactly what it would have been. That's the authoritative server's whole promise.

```text
cmake --build ttt/build
./ttt/build/ttt_tests
```

```cpp file=ttt/tests/game_review_test.cpp provided
// The reviewer's tests: players who break the rules.
#include "studio_test.hpp"

#include <string>

#include "game_server.h"
#include "test_client.h"

namespace {

struct Game {
    net::Startup startup;
    net::RunningServer<GameServer> server;
    net::TestClient x{server.port()};
    std::string x_hello = x.hear();
    net::TestClient o{server.port()};
    std::string o_hello = o.hear();

    Game()
    {
        for (int i = 0; i < 2; ++i) {   // the empty board, turn X
            x.hear();
            o.hear();
        }
    }
};

} // namespace

TEST(moving_out_of_turn_is_refused)
{
    Game g;
    g.o.say("move 0");
    CHECK_EQ(g.o.hear(), std::string("error not your turn"));
    g.x.say("move 8");
    // Had O's move counted, cell 0 would hold an O.
    CHECK_EQ(g.o.hear(), std::string("board ........X"));
}

TEST(a_taken_cell_is_refused)
{
    Game g;
    g.x.say("move 4");
    g.x.hear();   // board
    g.x.hear();   // turn O
    g.o.hear();
    g.o.hear();
    g.o.say("move 4");
    CHECK_EQ(g.o.hear(), std::string("error taken"));
    g.o.say("move 5");
    CHECK_EQ(g.o.hear(), std::string("board ....XO..."));
}

TEST(nonsense_is_a_bad_move)
{
    Game g;
    const char* nonsense[] = {"move 9", "move -1", "move 10", "move",
                              "jump 3", ""};
    for (const char* bad : nonsense) {
        g.x.say(bad);
        CHECK_EQ(g.x.hear(), std::string("error bad move"));
    }
    g.x.say("move 0");   // and X can still play
    CHECK_EQ(g.x.hear(), std::string("board X........"));
}

TEST(nobody_moves_before_the_opponent_arrives)
{
    net::Startup startup;
    net::RunningServer<GameServer> server;
    net::TestClient x(server.port());
    x.hear();   // you X
    x.say("move 0");
    CHECK_EQ(x.hear(), std::string("error waiting for opponent"));
}

TEST(a_third_player_is_turned_away)
{
    Game g;
    net::TestClient third(g.server.port());
    CHECK_EQ(third.hear(), std::string("full"));
    CHECK_EQ(third.hear(), std::string("<nothing>"));
    g.x.say("move 0");   // the game goes on
    CHECK_EQ(g.o.hear(), std::string("board X........"));
}

TEST(leaving_ends_the_game)
{
    Game g;
    g.o.leave();
    CHECK_EQ(g.x.hear(), std::string("left O"));
    CHECK_EQ(g.x.hear(), std::string("<nothing>"));
}
```

```check
run "cmake --build ttt/build"
tests "./ttt/build/ttt_tests" require="moving_out_of_turn_is_refused a_taken_cell_is_refused nonsense_is_a_bad_move nobody_moves_before_the_opponent_arrives a_third_player_is_turned_away leaving_ends_the_game" timeout=90 -- Check every rule before changing the board, and send each error only to the player who caused it.
```

## Step 9 — Challenge: the specification for talking

**This step: create the supplied `ttt/tests/say_test.cpp` and read it.**

The last challenge of the track: players can talk. A frame `say TEXT` sends `X says TEXT` (with the sender's mark) to the **opponent** only. It's allowed on either player's turn and doesn't change the turn, and the text is passed on exactly, spaces and all. Before the opponent arrives, it's `error waiting for opponent`, like a move.

```cpp file=ttt/tests/say_test.cpp provided
// Provided by the lesson: the challenge, players who talk.
#include "studio_test.hpp"

#include <string>

#include "game_server.h"
#include "test_client.h"

namespace {

struct Game {
    net::Startup startup;
    net::RunningServer<GameServer> server;
    net::TestClient x{server.port()};
    std::string x_hello = x.hear();
    net::TestClient o{server.port()};
    std::string o_hello = o.hear();

    Game()
    {
        for (int i = 0; i < 2; ++i) {   // the empty board, turn X
            x.hear();
            o.hear();
        }
    }
};

} // namespace

TEST(say_reaches_the_opponent)
{
    Game g;
    g.x.say("say good luck!");
    CHECK_EQ(g.o.hear(), std::string("X says good luck!"));
    g.o.say("say you too");
    CHECK_EQ(g.x.hear(), std::string("O says you too"));
}

TEST(say_does_not_echo_or_change_the_turn)
{
    Game g;
    g.o.say("say hmm");   // O can talk on X's turn
    CHECK_EQ(g.x.hear(), std::string("O says hmm"));
    g.x.say("move 0");
    // Had "say" been echoed to O, O would hear it before the board.
    CHECK_EQ(g.o.hear(), std::string("board X........"));
    CHECK_EQ(g.o.hear(), std::string("turn O"));
}

TEST(say_keeps_every_word)
{
    Game g;
    g.x.say("say  two  spaces ");
    CHECK_EQ(g.o.hear(), std::string("X says  two  spaces "));
}

TEST(nobody_to_talk_to_yet)
{
    net::Startup startup;
    net::RunningServer<GameServer> server;
    net::TestClient x(server.port());
    x.hear();   // you X
    x.say("say hello?");
    CHECK_EQ(x.hear(), std::string("error waiting for opponent"));
}
```

```check
file ttt/tests/say_test.cpp
```

## Step 10 — Challenge: say

**This step: make `GameServer` pass on `say` messages. Build and run the tests.**

No code and no hints this time, beyond one question: where in `handle` does the new check have to go, so that `say` works on either player's turn but not before the opponent arrives?

```text
cmake --build ttt/build
./ttt/build/ttt_tests
```

That's the track. You've built a portable socket layer, framed and checked every byte that arrives, served many clients from one thread, spoken HTTP to a real browser, and kept a game honest. Everything here runs on the loopback; serving other machines adds addresses other than `127.0.0.1` (and that firewall prompt), name lookup with `getaddrinfo`, and, before anything faces the internet, encryption with TLS.

```cpp file=ttt/game_server.cpp
#include "game_server.h"

#include <cstddef>
#include <utility>

#include "poller.h"
#include "tcp.h"

GameServer::GameServer() : listener_(net::listen_loopback()) {}

std::uint16_t GameServer::port() const
{
    return net::local_port(listener_);
}

void GameServer::stop()
{
    stopping_ = true;
}

void GameServer::run()
{
    while (!stopping_ && !over_) {
        std::vector<net::PollFd> fds;
        fds.push_back(net::watch(listener_));
        for (const Player& p : players_)
            fds.push_back(net::watch(p.socket));
        if (net::poll(fds.data(), fds.size(), 50) <= 0)
            continue;

        for (std::size_t i = 0; i < players_.size() && !over_; ++i) {
            if (fds[i + 1].revents != 0 && !read_from(players_[i])) {
                over_ = true;   // a player left: the game can't go on
                for (Player& other : players_) {
                    if (&other != &players_[i])
                        send_to(other, std::string("left ") +
                                           players_[i].mark);
                }
            }
        }
        if (!over_ && fds[0].revents != 0)
            accept_new();
    }
    players_.clear();   // closes both connections
}

void GameServer::accept_new()
{
    net::Socket socket = net::accept_client(listener_);
    if (players_.size() == 2) {
        net::send_frame(socket, "full");
        return;   // socket closes here
    }
    char mark = players_.empty() ? 'X' : 'O';
    players_.push_back(Player{std::move(socket), {}, mark});
    send_to(players_.back(), std::string("you ") + mark);
    if (players_.size() == 2) {
        tell_both("board " + board_.str());
        tell_both("turn X");
    }
}

bool GameServer::read_from(Player& player)
{
    char buffer[4096];
    long got = net::recv_some(player.socket, buffer, sizeof buffer);
    if (got <= 0)
        return false;
    player.decoder.feed({buffer, static_cast<std::size_t>(got)});
    while (!over_) {
        auto message = player.decoder.next();
        if (!message)
            break;
        handle(player, *message);
    }
    return !player.decoder.broken();
}

void GameServer::handle(Player& player, const std::string& message)
{
    if (players_.size() < 2) {
        send_to(player, "error waiting for opponent");
        return;
    }
    // "say TEXT": a message for the opponent. Any time, either turn.
    if (message.rfind("say ", 0) == 0) {
        for (Player& other : players_) {
            if (&other != &player)
                send_to(other, std::string(1, player.mark) + " says " +
                                   message.substr(4));
        }
        return;
    }
    // "move N", with N one digit.
    if (message.size() != 6 || message.rfind("move ", 0) != 0 ||
        message[5] < '0' || message[5] > '8') {
        send_to(player, "error bad move");
        return;
    }
    if (player.mark != turn_) {
        send_to(player, "error not your turn");
        return;
    }
    if (!board_.place(message[5] - '0', player.mark)) {
        send_to(player, "error taken");
        return;
    }

    tell_both("board " + board_.str());
    if (board_.winner() != '.') {
        tell_both(std::string("win ") + board_.winner());
        over_ = true;
    } else if (board_.full()) {
        tell_both("draw");
        over_ = true;
    } else {
        turn_ = turn_ == 'X' ? 'O' : 'X';
        tell_both(std::string("turn ") + turn_);
    }
}

void GameServer::send_to(Player& player, const std::string& text)
{
    net::send_frame(player.socket, text);   // a failure shows up as a read
}

void GameServer::tell_both(const std::string& text)
{
    for (Player& p : players_)
        send_to(p, text);
}
```

```check
run "cmake --build ttt/build"
tests "./ttt/build/ttt_tests" require="say_reaches_the_opponent say_does_not_echo_or_change_the_turn say_keeps_every_word nobody_to_talk_to_yet" timeout=90 -- Check for "say " after the waiting-for-opponent check and before the move checks; send to the other player only.
```
