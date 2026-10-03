---
title: 2.1 — Probability by Simulation: a Slippery Floor
track: Reinforcement Learning in pygame
runtime: python
run: slippery.py
---

Reinforcement learning happens in worlds that aren't certain. An agent presses "right", and on ice it might slide up instead. It tries a slot machine, and the payout is different every time. To learn anything in such a world, an agent has to deal in **probabilities**: how often each outcome happens.

This lesson builds randomness from the ground up. You'll start from the one random operation a computer really offers, a number between 0 and 1, and build from it a yes/no event, a choice among several outcomes with given chances, and a slippery floor. Then you'll walk on it in pygame and watch counted frequencies home in on the true probabilities.

The idea underneath everything: **a probability is a long-run share.** "This move slides with probability 0.2" means: over many tries, it slides in about 20% of them. So you can measure a probability by simulating many tries and counting, which is what you'll do.

## Read the tests first

**This step: create the supplied test file and read it. No code yet.**

Click **Create provided tests/test_chance.py** above.

```python file=tests/test_chance.py provided
# Tests for chance.py and slippery.py. Run them with:
#   .venv\Scripts\python -m pytest -q tests/test_chance.py
import numpy as np
import pygame

import chance


class FixedRandom:
    """Stands in for a generator: random() hands out the given numbers in order."""

    def __init__(self, *values):
        self.values = list(values)

    def random(self):
        return self.values.pop(0)


def test_bernoulli_is_true_below_p():
    assert chance.bernoulli(0.3, FixedRandom(0.29)) is True
    assert chance.bernoulli(0.3, FixedRandom(0.3)) is False, "random() < p: exactly p counts as false"
    assert chance.bernoulli(0.3, FixedRandom(0.9)) is False


def test_bernoulli_frequency_is_close_to_p():
    rng = np.random.default_rng(0)
    share = np.mean([chance.bernoulli(0.3, rng) for _ in range(10_000)])
    assert abs(share - 0.3) < 0.02, f"true in {share:.3f} of 10,000 tries, expected about 0.3"


def test_sample_walks_the_running_totals():
    probs = [0.5, 0.3, 0.2]   # running totals 0.5, 0.8, 1.0
    assert chance.sample(probs, FixedRandom(0.0)) == 0
    assert chance.sample(probs, FixedRandom(0.49)) == 0
    assert chance.sample(probs, FixedRandom(0.5)) == 1, "0.5 is the first number past outcome 0's share"
    assert chance.sample(probs, FixedRandom(0.79)) == 1
    assert chance.sample(probs, FixedRandom(0.8)) == 2
    assert chance.sample(probs, FixedRandom(0.999)) == 2


def test_sample_never_runs_off_the_end():
    probs = [0.1] * 10   # the running totals end at 0.9999999999999999, not 1
    largest = np.nextafter(1.0, 0.0)   # the largest number random() can return
    assert chance.sample(probs, FixedRandom(largest)) == 9


def test_sample_frequencies_match_the_probabilities():
    rng = np.random.default_rng(1)
    draws = [chance.sample([0.5, 0.3, 0.2], rng) for _ in range(20_000)]
    assert np.allclose(np.bincount(draws, minlength=3) / 20_000, [0.5, 0.3, 0.2], atol=0.02)


def test_slip_distribution_splits_the_slip_between_the_two_sides():
    assert chance.slip_distribution(3, 0.2).tolist() == [0.1, 0.1, 0.0, 0.8], "right slides up or down"
    assert chance.slip_distribution(0, 0.2).tolist() == [0.8, 0.0, 0.1, 0.1], "up slides left or right"


def test_slip_distribution_with_no_slip_is_certain():
    assert chance.slip_distribution(1, 0.0).tolist() == [0.0, 1.0, 0.0, 0.0]


def test_slip_distribution_never_goes_backwards():
    for action, backwards in [(0, 1), (1, 0), (2, 3), (3, 2)]:
        assert chance.slip_distribution(action, 0.5)[backwards] == 0.0


def test_slippery_action_same_seed_same_slides():
    a = np.random.default_rng(5)
    b = np.random.default_rng(5)
    assert [chance.slippery_action(3, 0.2, a) for _ in range(50)] == [chance.slippery_action(3, 0.2, b) for _ in range(50)]


def test_frequencies_are_shares_of_the_total():
    assert chance.frequencies(np.array([0, 1, 1, 3]), 4).tolist() == [0.25, 0.5, 0.0, 0.25]


def test_view_press_moves_and_reports_a_slide():
    import slippery
    rng = np.random.default_rng(2)
    results = [slippery.press((2, 2), 3, rng) for _ in range(5000)]
    cells = {cell for cell, _ in results}
    assert cells <= {(2, 3), (1, 2), (3, 2)}, "pressing right from (2, 2) goes right, or slides up or down"
    share = np.mean([slid for _, slid in results])
    assert abs(share - slippery.SLIP) < 0.02, f"slid in {share:.3f} of presses"


def test_view_bar_height_scales_a_fraction():
    import slippery
    assert slippery.bar_height(0.5, 200) == 100
    assert slippery.bar_height(0.0, 200) == 0


def test_view_draws_the_aimed_bar_to_its_share():
    import slippery
    pygame.font.init()
    screen = pygame.Surface((slippery.WIDTH, slippery.HEIGHT))
    slippery.draw(screen, pygame.font.Font(None, 24), (2, 2), [0, 0, 0, 1])
    x = slippery.GRID * slippery.CELL + 40 + 30
    top = slippery.FLOOR - slippery.bar_height(0.75)
    assert screen.get_at((x, top + 2))[:3] == slippery.BAR, "3 of 4 presses went as aimed"
    assert screen.get_at((x, top - 4))[:3] != slippery.BAR, "the bar stops at three quarters of its full height"


def test_view_window_opens_and_closes():
    import slippery
    assert slippery.run(max_frames=2) == 2
```

Look at `FixedRandom`. Random code is hard to test exactly, because its answers change. So these tests hand your functions a fake generator, a **test double**, whose `random()` returns numbers the test chose. That works because Python doesn't check an object's type before calling a method on it. `sample(probs, rng)` only ever calls `rng.random()`, so any object with a `random()` method will do. This is called **duck typing** ("if it quacks like a duck…"). With chosen numbers, the test can check exact boundaries, such as what `sample` does with 0.5 when the first outcome's share ends at 0.5. A real generator might never hand you exactly 0.5.

The other tests use real generators with fixed seeds, and allow a margin, `abs(share - 0.3) < 0.02`, because a counted share is never exactly the probability. Lesson 2.2 shows where a margin like 0.02 comes from.

```check
file tests/test_chance.py -- Click "Create provided tests/test_chance.py" above.
```

## A yes-or-no event

Create `chance.py`:

```python file=chance.py
import numpy as np


def bernoulli(p, rng):
    return bool(rng.random() < p)
```

**Where `rng.random()` comes from.** The generator's basic operation produces a 64-bit whole number: a pattern of 64 bits that looks random, worked out by scrambling its internal state (lesson 1.2). You can see one:

```text
>>> import numpy as np
>>> np.random.default_rng(0).integers(0, 2**64, dtype=np.uint64)
np.uint64(11749869230777074271)
```

`random()` turns such a number into a fraction. It keeps 53 of the bits, which is a whole number `k` from 0 up to 2⁵³ − 1, and divides by 2⁵³. (53 bits is exactly the precision of a `float`.) So `random()` returns one of 2⁵³ evenly spaced values, `0, 1/2⁵³, 2/2⁵³, …`, each equally likely. That's what **uniform on [0, 1)** means: any stretch of the interval of length L contains a share L of the possible values. The `)` means 1 itself is never returned. The largest value is `1 − 1/2⁵³`, which Python prints as `0.9999999999999999`.

**Why `rng.random() < p` is true with probability p.** The values below `p` make up the stretch from 0 to `p`, which is a share `p` of the whole interval. Picture p = 0.3:

```text
0 ─────────── 0.3 ──────────────────────────── 1
  [ true: 30% ]   [ false: the other 70%     ]
```

A yes/no event with probability `p` is called a **Bernoulli** event, after the mathematician Jacob Bernoulli. `bool(…)` turns NumPy's own true/false type into Python's `True`/`False`.

Now measure the probability by counting. `np.mean` of a list of `True`/`False` counts `True` as 1 and `False` as 0, so it's the share that came out true. Type this at the prompt, but predict before you press Enter on the last line:

```text
>>> from chance import bernoulli
>>> rng = np.random.default_rng(0)
>>> for n in [10, 100, 1000, 10_000, 100_000]:
...     print(n, np.mean([bernoulli(0.3, rng) for _ in range(n)]))
...
```

```predict
question: As `n` grows from 10 to 100,000, how will the shares behave?
choice: Each one is closer to 0.3 than the one before
choice: They wander, but the big misses get rarer as n grows
choice: They are all exactly 0.3, because p is 0.3
answer: They wander, but the big misses get rarer as n grows
explain: The output:

    10 0.3
    100 0.25
    1000 0.29
    10000 0.3003
    100000 0.29947

The first is exactly right, by luck. With 100 tries it's off by 0.05, which is worse than with 10.
```

As `n` grows, the share settles towards 0.3, but it never gets there exactly, and it doesn't improve steadily. This settling is the **law of large numbers**: the share of a long run of independent tries gets as close to the probability as you like, if you're willing to make enough tries.

```check
run ".venv/Scripts/python -m pytest -q tests/test_chance.py -k bernoulli" label="bernoulli is true with probability p" -- Compare one rng.random() with p: true when it's smaller.
```

## Choosing among several outcomes

A slippery move has three possible results, not two. To pick one outcome when each has its own probability, say `[0.5, 0.3, 0.2]`, divide the interval [0, 1) into consecutive pieces, one per outcome, each as long as its probability. Then take one `random()` and see which piece it lands in:

```text
0 ────────── 0.5 ────── 0.8 ──── 1
  [ outcome 0 ][ outcome 1 ][ 2  ]
```

Every point in a piece of length 0.3 is equally likely, so the number lands in outcome 1's piece with probability 0.3. That's the same argument as the Bernoulli event, applied to each piece.

The pieces' right-hand ends are the **running totals** of the probabilities, 0.5, 0.8 and 1.0, which `np.cumsum` ("cumulative sum") computes. So "which piece?" becomes "what is the first running total that's **greater** than my number?"

```python file=chance.py
import numpy as np


def bernoulli(p, rng):
    return bool(rng.random() < p)


def sample(probs, rng):
    cumulative = np.cumsum(probs)
    index = int(np.searchsorted(cumulative, rng.random(), side="right"))
    return min(index, len(probs) - 1)
```

How `sample` finds the piece:

1. `np.cumsum([0.5, 0.3, 0.2])` gives `[0.5, 0.8, 1.0]`.
2. `np.searchsorted(totals, u, side="right")` returns the position of the first total greater than `u`. For `u = 0.63`: 0.5 isn't greater, 0.8 is, so it returns 1. The totals are in increasing order, so it can use **binary search**: check the middle, discard the half that can't contain the answer, repeat. For 3 totals that makes no difference. For thousands of outcomes it means a dozen comparisons instead of thousands.
3. `side="right"` decides what happens when `u` *equals* a total. At exactly 0.5, `"right"` returns 1, because 0.5 is the first number that is **not** in outcome 0's piece `[0, 0.5)`. `side="left"` would return 0 and give outcome 0 a tiny bit too much. One of the tests checks exactly this case.

**Why the last line, `min(index, len(probs) - 1)`?** Because the running totals don't always end at exactly 1:

```text
>>> np.cumsum([0.1] * 10)[-1]
np.float64(0.9999999999999999)
```

A `float` stores numbers in binary, and 0.1 has no exact binary form, just as 1/3 has no exact decimal form. Each 0.1 is stored very slightly off, and the small errors add up. Here they add up to exactly `0.9999999999999999`, the largest value `random()` can return. If `random()` returns that value, which is one chance in 2⁵³, then no total is *greater* than it, and `searchsorted` returns 10, one past the last outcome. The `min` caps it at the last real outcome. It almost never matters, and it costs one line, and a program that crashes once in a very long training run is very hard to debug.

```check
run ".venv/Scripts/python -m pytest -q tests/test_chance.py -k sample" label="sample picks outcomes by their probabilities" -- Find the first running total greater than one random() number (np.cumsum, then np.searchsorted with side="right"), and never return past the last outcome.
```

## A slippery floor

Now the ice. A move goes the way you aimed with probability `1 - slip`. Otherwise it slides sideways, half the time to each side, and never backwards. (Gymnasium's FrozenLake, in Chapter 8, uses this kind of ice with its own numbers.) Each action's possible results form a **probability distribution**: a probability for each of the 4 directions, adding up to 1.

```python file=chance.py
import numpy as np

# Which way each action slides on ice: up and down slide left or right,
# left and right slide up or down. (Action numbers as in qtable.ACTIONS.)
SIDEWAYS = {0: (2, 3), 1: (2, 3), 2: (0, 1), 3: (0, 1)}


def bernoulli(p, rng):
    return bool(rng.random() < p)


def sample(probs, rng):
    cumulative = np.cumsum(probs)
    index = int(np.searchsorted(cumulative, rng.random(), side="right"))
    return min(index, len(probs) - 1)


def slip_distribution(action, slip):
    probs = np.zeros(4)
    probs[action] = 1 - slip
    for side in SIDEWAYS[action]:
        probs[side] += slip / 2
    return probs


def slippery_action(action, slip, rng):
    return sample(slip_distribution(action, slip), rng)


def frequencies(outcomes, n_outcomes):
    return np.bincount(outcomes, minlength=n_outcomes) / len(outcomes)
```

- `SIDEWAYS` lists the two directions each action can slide to. With up = 0, down = 1, left = 2, right = 3, aiming up or down slides left or right, and aiming left or right slides up or down.
- `slip_distribution(3, 0.2)` builds the distribution for "right" on ice that slips 20% of the time. It starts from all zeros, sets right to 0.8, then adds 0.1 to up and to down: `[0.1, 0.1, 0.0, 0.8]`. In order, that's up 10%, down 10%, left never, right 80%.
- `slippery_action` is `sample` applied to that distribution. It returns the direction the agent actually moves.
- `frequencies(outcomes, n)` counts how often each outcome happened, as shares. `np.bincount` counts each whole number: `np.bincount([0, 1, 1, 3])` is `[1, 2, 0, 1]`, meaning one 0, two 1s, no 2s, one 3. Dividing by the number of outcomes turns counts into shares. `minlength` makes sure an outcome that never happened still gets its 0.

```check
run ".venv/Scripts/python -m pytest -q tests/test_chance.py -k \"slip or frequencies\"" label="slip_distribution, slippery_action and frequencies work" -- slip_distribution: 1 - slip on the aimed action, slip / 2 on each of its SIDEWAYS directions, 0 everywhere else.
```

## Walk on the ice

`slippery.py` puts the player on the ice, and keeps score of how many presses went as aimed and how many slid, next to the true probabilities:

```python file=slippery.py
import numpy as np
import pygame

from chance import frequencies, slippery_action
from qtable import ACTIONS
from window import CELL, GRID, draw as draw_grid, move

SLIP = 0.2
PANEL = 240
WIDTH = GRID * CELL + PANEL
HEIGHT = GRID * CELL
TALLEST = 260
FLOOR = HEIGHT - 60
BAR = (94, 234, 212)
EXPECTED = (248, 113, 113)
TEXT = (226, 232, 240)
KEY_ACTIONS = {pygame.K_UP: 0, pygame.K_DOWN: 1, pygame.K_LEFT: 2, pygame.K_RIGHT: 3}


def press(player, action, rng):
    actual = slippery_action(action, SLIP, rng)
    return move(player, ACTIONS[actual]), int(actual != action)


def bar_height(fraction, tallest=TALLEST):
    return round(fraction * tallest)


def draw(screen, font, player, outcomes):
    draw_grid(screen, player)
    left = GRID * CELL
    shares = frequencies(np.array(outcomes, dtype=int), 2) if outcomes else np.zeros(2)
    expected = [1 - SLIP, SLIP]
    for i, label in enumerate(["as aimed", "slid"]):
        x = left + 40 + i * 100
        height = bar_height(shares[i])
        pygame.draw.rect(screen, BAR, (x, FLOOR - height, 60, height))
        marker = FLOOR - bar_height(expected[i])
        pygame.draw.line(screen, EXPECTED, (x - 6, marker), (x + 66, marker), 2)
        screen.blit(font.render(label, True, TEXT), (x, FLOOR + 10))
        screen.blit(font.render(f"{shares[i]:.3f}", True, TEXT), (x, FLOOR + 30))
    screen.blit(font.render(f"presses: {len(outcomes)}", True, TEXT), (left + 40, 20))


def run(max_frames=None, seed=0):
    rng = np.random.default_rng(seed)
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Slippery floor")
    font = pygame.font.Font(None, 24)
    clock = pygame.time.Clock()
    player = (2, 2)
    outcomes = []
    frames = 0
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key in KEY_ACTIONS:
                player, slid = press(player, KEY_ACTIONS[event.key], rng)
                outcomes.append(slid)
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
                for _ in range(1000):
                    outcomes.append(press(player, 3, rng)[1])
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_r:
                outcomes = []
        draw(screen, font, player, outcomes)
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

New game mechanics in this file:

- **Text.** pygame can't draw text directly onto the screen. `pygame.font.Font(None, 24)` loads a typeface (`None` means pygame's built-in one) at 24 pixels high. `font.render(text, True, colour)` draws the text into a **new, small surface** of its own, just big enough to hold it. `True` turns on **antialiasing**: pixels along a letter's edge get colours partway between the text and the background, so the edges look smooth instead of jagged.
- **`blit`.** `screen.blit(surface, (x, y))` copies every pixel of one surface onto another, with the copy's top-left corner at `(x, y)`. The name is short for "block transfer". This is the basic operation of 2D games: text, characters and backgrounds are all small surfaces, blitted onto the screen in order every frame, with later ones covering earlier ones.
- **Bars that grow upwards.** Since y grows *downwards*, a bar standing on a floor at `FLOOR` with height `h` has its top edge at `FLOOR - h`. The rectangle is `(x, FLOOR - h, width, h)`. When the share rises, `h` grows, and the top edge moves up the screen.
- **The red markers** are drawn at the heights the true probabilities, 0.8 and 0.2, would give. The counted bars should settle on them.
- **Key handling.** `KEY_ACTIONS` maps arrow keys to action numbers (`MOVES` in `window.py` mapped them to deltas). Arrow keys make one slippery move each. **Space** simulates 1000 presses of "right" all at once, without moving the player, which takes a few milliseconds, all within one frame. **R** clears the score.
- `press` returns the new cell and `int(actual != action)`: 1 if the move slid, 0 if it went as aimed. Those 0s and 1s are what `frequencies` counts.
- `draw_grid` is `window.py`'s `draw`, renamed as it's imported (`import … as`) so it doesn't clash with this file's own `draw`.

Run it, but don't press anything yet.

```predict
question: After 20 arrow presses, what will the "slid" share be?
choice: Exactly 0.200
choice: Somewhere around 0.05 to 0.35: close-ish, but rarely exact
choice: Around 0.5, since each press either slides or doesn't
answer: Somewhere around 0.05 to 0.35: close-ish, but rarely exact
explain: 20 presses is a small sample. Each slides with probability 0.2, so the expected number of slides is 4, but 2, 3, 5 or 6 are all common, which is 0.10 to 0.30 as a share. "Exactly 0.200" needs exactly 4 slides, which happens only about 22% of the time. Lesson 2.2 gives the exact size of a typical miss: about 0.09 for 20 presses.

Now press the arrow keys 20 times and read the shares. Then press Space a few times, and watch the bars settle onto the markers.
```

**Seeds, and what they guarantee.** `run` makes its generator with `seed=0`, so every run of the program makes the same slides in the same order. Run it twice and press the same keys, and you get the same moves. That's useful: a surprising result can be replayed and examined. But one seed is **one possible history**, not the truth. Here's the share of slides in 100 presses of "right" for five different seeds:

```text
seed 0: 0.19    seed 1: 0.19    seed 2: 0.23    seed 3: 0.19    seed 4: 0.14
```

All five are the same ice, which slips 20% of the time. If you tested a learning agent with only seed 4, you might conclude the ice is gentler than it is. Comparing two agents on one seed each is a comparison of luck as much as of agents. That's why this series always reports results over many seeds, and lesson 2.2 shows how to say how much an average over seeds can be trusted.

```check
run ".venv/Scripts/python -m pytest -q tests/test_chance.py" label="all lesson 2.1 tests pass" -- A bar standing on FLOOR with height h has its top at FLOOR - h, because y grows downwards.
```
