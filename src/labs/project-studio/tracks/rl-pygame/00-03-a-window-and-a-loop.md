---
title: 0.3 — A Window and a Loop
track: Reinforcement Learning in pygame
runtime: python
run: window.py
support: tests/conftest.py
---

A screen never shows motion. It shows still pictures, called **frames**, one after another, usually 60 a second. If each picture puts a square a few pixels further right than the last, your eye sees the square slide. Films work the same way.

So a game can't "move a square". It keeps the square's position in a variable, and builds a complete new picture from that variable for every frame. Every game is a loop that, many times a second, does three things: it reads what the player did, it updates the variables that describe the world, and it draws a new picture from them. Reinforcement learning has the same loop. An agent observes the world, chooses an action, and the world changes and hands back a reward. In this lesson you build the game version with pygame: a window, a grid, and a square you move with the arrow keys. In Chapter 4 the keyboard is replaced by an agent, and the loop stays.

## Read the tests first

**This step: create the supplied test files and read them. No code yet.**

Click **Create provided tests/test_window.py** above. It creates two files.

`tests/conftest.py` is a file pytest runs before any test in its folder:

```python
import os

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")
```

pygame is built on a C library called **SDL**, which talks to the screen, keyboard and speakers. SDL reads these environment variables when it starts. The `dummy` drivers give it a window that exists only in memory and a sound device that plays nothing. So the tests can run your game loop with no screen at all, and they don't wait about two seconds for real audio hardware to start each time. `setdefault` sets a variable only if it isn't set already.

The tests describe the four steps of this lesson:

```python file=tests/test_window.py provided
# Tests for window.py. Run them from the project folder with:
#   .venv\Scripts\python -m pytest -q tests/test_window.py
import time

import pygame

import window


def test_loop_runs_the_requested_number_of_frames():
    assert window.run(max_frames=3) == 3


def seconds_to_run(frames):
    start = time.perf_counter()
    window.run(max_frames=frames)
    return time.perf_counter() - start


def test_loop_waits_for_the_clock():
    # Opening and closing the window takes time too, so time 1 frame and 31 frames:
    # the difference is 30 frames, which take 0.5 s at 60 frames per second.
    extra = seconds_to_run(31) - seconds_to_run(1)
    assert extra > 0.4, f"30 extra frames took {extra:.3f} s; at 60 frames per second they take 0.5 s"


def test_draw_fills_the_background():
    screen = pygame.Surface((window.WIDTH, window.HEIGHT))
    window.draw(screen, (0, 0))
    assert screen.get_at((window.WIDTH - 40, window.HEIGHT - 40))[:3] == window.BACKGROUND


def test_draw_puts_the_player_in_its_cell():
    screen = pygame.Surface((window.WIDTH, window.HEIGHT))
    window.draw(screen, (1, 2))
    centre = (2 * window.CELL + window.CELL // 2, 1 * window.CELL + window.CELL // 2)
    assert screen.get_at(centre)[:3] == window.PLAYER, "row 1, column 2 is 1 cell down and 2 cells across"
    assert screen.get_at((window.CELL // 2, window.CELL // 2))[:3] == window.BACKGROUND


def test_move_one_cell():
    assert window.move((2, 2), (0, 1)) == (2, 3)
    assert window.move((2, 2), (-1, 0)) == (1, 2)


def test_move_stops_at_the_edges():
    assert window.move((0, 0), (-1, 0)) == (0, 0)
    assert window.move((0, 0), (0, -1)) == (0, 0)
    assert window.move((4, 4), (1, 0)) == (4, 4)
    assert window.move((4, 4), (0, 1)) == (4, 4)


def test_move_arrow_keys():
    assert window.MOVES[pygame.K_UP] == (-1, 0)
    assert window.MOVES[pygame.K_RIGHT] == (0, 1)
```

Three things to notice before you write any code:

- `window.run(max_frames=3)` must **return** 3. A game loop normally runs until the player closes the window, which a test can't do. So `run` takes an optional limit, and it returns how many frames it ran.
- The clock test times 1 frame and 31 frames and subtracts. Opening a window has a cost of its own, and subtracting removes it, so what's left is the time the 30 extra frames took.
- A `pygame.Surface` is a picture held in memory: a block of numbers, 4 bytes for each pixel, row after row. A 400 × 400 surface is 160,000 pixels, or 640,000 bytes. Drawing on a surface just writes numbers into that block. `screen.get_at((x, y))` reads the 4 bytes of one pixel back: red, green, blue, and an opacity value called **alpha**. `[:3]` keeps the first three. The draw tests draw onto a surface and read pixels back, which is how you test drawing without looking at it.

```check
file tests/test_window.py -- Click "Create provided tests/test_window.py" above.
file tests/conftest.py
```

## A window that stays open

Create `window.py`:

```python file=window.py
import pygame

WIDTH = HEIGHT = 400


def run(max_frames=None):
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("RL workbench")
    frames = 0
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        pygame.display.flip()
        frames += 1
        if max_frames is not None and frames >= max_frames:
            running = False
    pygame.quit()
    return frames


if __name__ == "__main__":
    run()
```

**`pygame.init()` and `set_mode`.** `init` starts each of pygame's parts (display, keyboard, sound, timers), and each one asks SDL to set up the matching part of the operating system. `set_mode((400, 400))` asks the operating system for a window, and gives you back its **surface**: the block of pixel memory from the tests above. Nothing has been written into it yet, so it's all zeros, which is black.

**The event queue: how key presses reach your program.** Your program never asks the keyboard "is a key down?" at the moment someone presses it, because at that moment it's busy drawing. Instead, the operating system notices the press and sends a **message** to the window that has focus. Messages wait in a line, a **queue**, until the program collects them. `pygame.event.get()`:

1. asks SDL to collect every message the operating system has sent to this window since the last call;
2. turns each one into a pygame **event**, an object with a `type` (`pygame.QUIT`, `pygame.KEYDOWN`, `pygame.MOUSEMOTION`, …) and details such as which key;
3. returns them as a list, oldest first, and empties the queue.

So a key pressed while one frame is being drawn shows up in the next frame's list. Nothing is lost, it's just handled a frame later, which is at most about 1/60 of a second.

Windows uses the same queue to decide whether a program is alive. If a window doesn't collect its messages for about five seconds, Windows assumes the program is frozen: it greys the window out and adds **Not Responding** to its title. That's why the loop calls `event.get()` every frame even when it only cares about one kind of event.

**`pygame.QUIT`** is the event Windows sends when you click the close button. Clicking it doesn't close anything by itself: it only puts a message in the queue. Your loop sees it, sets `running = False`, and the `while` loop ends after this pass. Then `pygame.quit()` gives the window and everything else back to the operating system.

**`pygame.display.flip()`** copies the surface onto the screen. Drawing a frame takes many separate steps (fill, then lines, then a square). If the screen showed the memory while you drew, you'd sometimes see a frame with the lines but no square yet, which looks like flickering. So you draw into the surface, which nobody sees, and when the frame is complete, `flip` copies the whole finished picture to the window in one operation.

**The frame limit.** With no limit (`max_frames` is `None`, the default), the loop runs until the window is closed. Python checks the left side of `and` first, and if it's false, it doesn't evaluate the right side at all, so `None` is never compared with a number. Traced for `run(max_frames=3)`:

```text
pass   events    frames after += 1   frames >= 3?   running
 1     []        1                   no             True
 2     []        2                   no             True
 3     []        3                   yes            False → loop ends, returns 3
```

Press **Run window.py**. A black window opens, and the close button closes it. The output pane shows one line, which pygame prints whenever it's imported:

```text
pygame-ce 2.5.8 (SDL 2.32.10, Python 3.13.14)
```

While the window is open, you'll open Task Manager (Ctrl+Shift+Esc) and find Python on the **Processes** tab.

```predict
question: How busy will the processor be, for a program that draws nothing but black?
choice: Almost idle: there's nothing to draw
choice: One processor core kept fully busy
choice: Every core fully busy
answer: One processor core kept fully busy
explain: Nothing in the loop ever waits. As soon as one pass ends, the next begins: thousands of passes a second, each copying a black picture to the screen. A processor core runs whatever it's given as fast as it can, so the one running this loop stays fully busy, doing work nobody can see, since the screen only shows 60 frames a second anyway. The program does one thing at a time, so it can keep only one core busy. Task Manager shows its share of the *whole* processor, so on an 8-core machine that's about 12%.

Look now, then close the window and watch the number drop.
```

```check
run ".venv/Scripts/python -m pytest -q tests/test_window.py -k frames" label="run(max_frames=3) runs 3 frames and returns 3" -- run must return frames, and the loop must stop once frames reaches max_frames.
```

## Sixty frames a second

A screen redraws about 60 times a second, so there's no point drawing faster than that. A `Clock` slows the loop down:

```python file=window.py
import pygame

WIDTH = HEIGHT = 400


def run(max_frames=None):
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("RL workbench")
    clock = pygame.time.Clock()
    frames = 0
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        pygame.display.flip()
        clock.tick(60)
        frames += 1
        if max_frames is not None and frames >= max_frames:
            running = False
    pygame.quit()
    return frames


if __name__ == "__main__":
    run()
```

How `clock.tick(60)` works:

1. 60 frames a second means one frame every 1000 / 60 ≈ 16.7 milliseconds (ms). That's the **frame budget**.
2. The clock remembers the time of the previous `tick`. Now it measures how long has passed since then: the time this pass spent handling events and drawing.
3. If that's less than 16.7 ms, it **sleeps** for the difference. If this frame's work took 3 ms, it sleeps about 13.7 ms.
4. It returns the milliseconds since the previous `tick`, called the **delta time**, which you'll use later to measure speed.

**Sleeping** means the program tells the operating system "don't run me again for 13 ms". The operating system takes it off the processor and runs other programs, or nothing, until the time is up. That's why the processor goes quiet: the loop now spends most of each frame not running at all.

Measured on a test machine with 3 ms of work per frame, 120 frames returned 16 or 17 ms each (the operating system's timer counts whole milliseconds), averaging 16.5 ms, which is 60.2 frames a second. If a frame's work takes **longer** than 16.7 ms, `tick` doesn't sleep at all, and the game just runs slower than 60 frames a second.

Run it and look at Task Manager again.

This will matter later. When an agent trains, you'll want the loop as fast as possible (no `tick`, and no drawing at all). When you watch it play, you'll want it slow enough to follow. The workbench will have a speed control for exactly this.

```check
run ".venv/Scripts/python -m pytest -q tests/test_window.py -k clock" label="the loop runs at 60 frames per second" -- Call clock.tick(60) once per pass through the loop.
```

## Draw a grid

The world in the coming chapters is a grid of cells. Draw a 5 × 5 grid and a player in one cell:

```python file=window.py
import pygame

GRID = 5
CELL = 80
WIDTH = HEIGHT = GRID * CELL
BACKGROUND = (24, 26, 33)
LINE = (60, 64, 76)
PLAYER = (94, 234, 212)


def draw(screen, player):
    screen.fill(BACKGROUND)
    for i in range(GRID + 1):
        pygame.draw.line(screen, LINE, (i * CELL, 0), (i * CELL, HEIGHT))
        pygame.draw.line(screen, LINE, (0, i * CELL), (WIDTH, i * CELL))
    row, col = player
    pygame.draw.rect(screen, PLAYER, (col * CELL + 8, row * CELL + 8, CELL - 16, CELL - 16))


def run(max_frames=None):
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("RL workbench")
    clock = pygame.time.Clock()
    player = (0, 0)
    frames = 0
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        draw(screen, player)
        pygame.display.flip()
        clock.tick(60)
        frames += 1
        if max_frames is not None and frames >= max_frames:
            running = False
    pygame.quit()
    return frames


if __name__ == "__main__":
    run()
```

**Colours.** Each pixel on a screen is three tiny lights, red, green and blue, and a colour is how bright each one is, from 0 (off) to 255 (full). `(0, 0, 0)` is black, `(255, 255, 255)` is white, and `(94, 234, 212)` is mostly green and blue, a teal. Each of the three is one byte in the surface's memory, which is why they stop at 255, the largest number a byte holds.

**Why `fill` comes first.** Drawing only ever writes over pixels. Nothing is erased unless you erase it. `screen.fill(BACKGROUND)` writes the background colour into all 160,000 pixels, wiping out the previous frame. Without it, when the square moves, its old pixels stay where they were, and it leaves a trail of every place it's been. So each frame starts from a blank background and draws everything again from the variables. Redrawing everything 60 times a second sounds wasteful, but it's simple and always correct, and for a picture this size it takes well under a millisecond.

**Screen coordinates.** A pixel position is `(x, y)`, counted from the **top-left** corner: x grows to the right and y grows **downwards**, the opposite of a maths graph. That's because screens are drawn top to bottom, so row 0 of pixels is the top one. A grid cell is `(row, column)`. The row is how far down, which is y, and the column is how far across, which is x. Worked through for the player at cell `(1, 2)`:

```text
left   = col * CELL + 8 = 2 * 80 + 8 = 168   (x of the left edge)
top    = row * CELL + 8 = 1 * 80 + 8 =  88   (y of the top edge)
width  = height = CELL - 16 = 64             (an 8-pixel gap on every side)
```

`pygame.draw.rect(screen, colour, (left, top, width, height))` fills that rectangle. Swapping row and column is the most common bug in grid games. On a square grid it can hide for a long time, because the player still moves, just in the wrong direction.

**The grid lines.** For `i` from 0 to 5, two lines: a vertical one at `x = i * 80`, from the top (`y = 0`) to the bottom (`y = HEIGHT`), and a horizontal one at `y = i * 80`. That's 6 lines each way, at 0, 80, 160, 240, 320 and 400, because 5 cells need a line on both sides of each one. (The line at 400 is just past the last pixel, since pixels are numbered 0 to 399, so the right and bottom edges don't show. That's fine here.)

The loop now calls `draw` every frame, before `flip`: draw the whole picture into memory, then show it.

Run it: the player sits in the top-left cell. **Try it:** change `player = (0, 0)` to `(1, 3)`, but don't run it yet.

```predict
question: Where will the square appear now?
choice: 1 cell across, 3 cells down
choice: 1 cell down, 3 cells across
choice: In the top row, 4th cell
answer: 1 cell down, 3 cells across
explain: A cell is `(row, column)`: row 1 is the second row down, and column 3 is the fourth column across. The rectangle's left edge is `3 * 80 + 8 = 248` and its top edge is `1 * 80 + 8 = 88`.

Run it to see, then set `player` back to `(0, 0)`.
```

```check
run ".venv/Scripts/python -m pytest -q tests/test_window.py -k draw" label="draw fills the background and puts the player in its cell" -- Row is the y direction (down), column is the x direction (across): the rectangle's left edge comes from the column.
```

## Arrow keys move the player

```python file=window.py
import pygame

GRID = 5
CELL = 80
WIDTH = HEIGHT = GRID * CELL
BACKGROUND = (24, 26, 33)
LINE = (60, 64, 76)
PLAYER = (94, 234, 212)

# Each arrow key is a change in (row, column).
MOVES = {
    pygame.K_UP: (-1, 0),
    pygame.K_DOWN: (1, 0),
    pygame.K_LEFT: (0, -1),
    pygame.K_RIGHT: (0, 1),
}


def move(cell, delta, size=GRID):
    row = min(max(cell[0] + delta[0], 0), size - 1)
    col = min(max(cell[1] + delta[1], 0), size - 1)
    return (row, col)


def draw(screen, player):
    screen.fill(BACKGROUND)
    for i in range(GRID + 1):
        pygame.draw.line(screen, LINE, (i * CELL, 0), (i * CELL, HEIGHT))
        pygame.draw.line(screen, LINE, (0, i * CELL), (WIDTH, i * CELL))
    row, col = player
    pygame.draw.rect(screen, PLAYER, (col * CELL + 8, row * CELL + 8, CELL - 16, CELL - 16))


def run(max_frames=None):
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("RL workbench")
    clock = pygame.time.Clock()
    player = (0, 0)
    frames = 0
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key in MOVES:
                player = move(player, MOVES[event.key])
        draw(screen, player)
        pygame.display.flip()
        clock.tick(60)
        frames += 1
        if max_frames is not None and frames >= max_frames:
            running = False
    pygame.quit()
    return frames


if __name__ == "__main__":
    run()
```

**`MOVES`** maps each arrow key to a change in (row, column). Every key has a number, and `pygame.K_UP` is the up arrow's. A key press event carries that number in `event.key`. Up is `-1` row because rows count downwards.

**How a press becomes a move**, one frame at a time:

1. You press →. The operating system puts a key-down message in the window's queue.
2. Next frame, `event.get()` returns a `KEYDOWN` event whose `key` is `pygame.K_RIGHT`.
3. `event.key in MOVES` checks whether that number is one of the dictionary's keys. Any other key, say the space bar, is ignored.
4. `MOVES[event.key]` is `(0, 1)`, and `move(player, (0, 1))` returns the cell one column right. The loop stores it in `player`.
5. Later in the same pass, `draw` builds the picture from the new `player`, and `flip` shows it.

**One press, one move.** Hold a key down in a text editor and it repeats: after a short pause the operating system keeps sending more key-down messages. pygame ignores these repeats unless you turn them on with `pygame.key.set_repeat`, which is off when pygame starts. So a `KEYDOWN` event means a key was just pressed, once. pygame also keeps a table of which keys are down *right now*, updated as it processes events, and `pygame.key.get_pressed()` reads it. A racing game uses that, moving a little every frame while the key is held. Here you want one press to be one move: a single, discrete **action**, which is how a grid-world agent will act.

**How `move` clamps.** It adds the change, then forces each coordinate back into the range 0 to `size - 1`. `max(value, 0)` can't be less than 0, and `min(value, 4)` can't be more than 4:

```text
(0, 0) + up (-1, 0):    row = -1 → max(-1, 0) = 0 → min(0, 4) = 0     stays at (0, 0)
(4, 4) + right (0, 1):  col =  5 → max(5, 0)  = 5 → min(5, 4) = 4     stays at (4, 4)
(2, 2) + right (0, 1):  col =  3 → max(3, 0)  = 3 → min(3, 4) = 3     moves to (2, 3)
```

Walking into a wall leaves you where you were. That's a rule of this world, and the grid world in Chapter 4 keeps it.

`move` changes nothing outside itself. It returns a new cell, and the loop decides to store it. A function whose result depends only on its inputs is the easiest kind to test: the tests call it with numbers and compare, with no window needed.

Run it, click on the game window so it receives the keys, and walk around. Walk into each wall.

### The loop you just built

| Game loop | Reinforcement learning |
|---|---|
| read the key that was pressed | the agent chooses an **action** |
| `move(player, …)` | the environment's **transition** to a new state |
| `draw(…)` | the agent's **observation** of the new state |

Two things are missing: a **reward**, saying how good that move was, and an **agent**, choosing moves instead of you. Both arrive in Chapter 4. First the agent needs somewhere to keep what it learns: a table of numbers, which is the next lesson.

```check
run ".venv/Scripts/python -m pytest -q tests/test_window.py" label="all window tests pass" -- move must return a new (row, column), clamped to between 0 and size - 1 in both directions.
```
