---
title: 3.1 — A Room of Slot Machines
track: Reinforcement Learning in pygame
runtime: python
run: slot_room.py
---

Five slot machines stand in a row. Each pays out a different amount on average, and you don't know which is best. Every pull earns you money, and every pull also teaches you something about the machine you pulled. If you only pull the machine that has looked best so far, you may never find out that another is better. If you spend many pulls testing the others, you lose money on machines you already suspect are worse.

This is the **multi-armed bandit** problem (an old nickname for a slot machine is a "one-armed bandit"). It's reinforcement learning with everything stripped away except one difficulty, the **exploration–exploitation trade-off**: whether to *exploit* what you know or *explore* to learn more. There are actions and rewards, but no states: the room is the same after every pull. Chapter 4 adds states. Until then, the trade-off gets your full attention.

In this lesson you'll build the room, play it yourself, and then watch a simple agent play it and fall into a trap that you'll fix in lesson 3.2.

## Read the tests first

**This step: create the supplied test file and read it. No code yet.**

Click **Create provided tests/test_slots.py** above.

```python file=tests/test_slots.py provided
# Tests for bandit.py and slot_room.py (lesson 3.1). Run them with:
#   .venv\Scripts\python -m pytest -q tests/test_slots.py
import numpy as np
import pygame
from pytest import approx

from bandit import Bandit


def test_bandit_has_one_hidden_mean_per_machine():
    bandit = Bandit(5, np.random.default_rng(0))
    assert bandit.means.shape == (5,)


def test_bandit_same_seed_same_machines():
    a = Bandit(5, np.random.default_rng(3))
    b = Bandit(5, np.random.default_rng(3))
    assert a.means.tolist() == b.means.tolist()


def test_bandit_payouts_average_to_the_machine_mean():
    bandit = Bandit(5, np.random.default_rng(1))
    pays = [bandit.pull(2) for _ in range(10_000)]
    assert abs(np.mean(pays) - bandit.means[2]) < 0.05, "10,000 payouts with standard deviation 1: standard error 0.01"
    assert 0.9 < np.std(pays) < 1.1, "each payout scatters with standard deviation 1 around the mean"
    assert isinstance(pays[0], float)


def test_bandit_best_arm_and_regret():
    bandit = Bandit(5, np.random.default_rng(2))
    best = bandit.best_arm()
    assert best == int(np.argmax(bandit.means))
    assert bandit.regret(best) == 0.0
    worst = int(np.argmin(bandit.means))
    assert bandit.regret(worst) == approx(bandit.means.max() - bandit.means.min())


def test_learner_starts_knowing_nothing():
    from bandit import Learner
    learner = Learner(4, np.random.default_rng(0))
    assert learner.Q.tolist() == [0.0, 0.0, 0.0, 0.0]
    assert learner.N.tolist() == [0, 0, 0, 0]


def test_learner_estimates_are_the_average_payout_of_each_machine():
    from bandit import Learner
    learner = Learner(3, np.random.default_rng(0))
    for arm, reward in [(0, 2.0), (1, -1.0), (0, 4.0), (0, 0.0), (1, 3.0)]:
        learner.learn(arm, reward)
    assert learner.Q.tolist() == approx([2.0, 1.0, 0.0])
    assert learner.N.tolist() == [3, 2, 0]


def test_learner_chooses_the_best_estimate():
    from bandit import Learner
    learner = Learner(3, np.random.default_rng(0))
    learner.learn(1, 5.0)
    assert {learner.choose() for _ in range(50)} == {1}


def test_room_timer_fires_once_per_interval():
    from slot_room import Timer
    timer = Timer(200)
    assert timer.tick(150) == 0
    assert timer.tick(100) == 1, "150 + 100 = 250 ms: one interval has passed, 50 ms carry over"
    assert timer.tick(150) == 1, "50 + 150 = 200 ms"
    assert timer.tick(450) == 2, "a slow frame can owe several pulls"


def test_room_keys_one_to_five_are_machines():
    from slot_room import key_to_arm
    assert key_to_arm(pygame.K_1) == 0
    assert key_to_arm(pygame.K_5) == 4
    assert key_to_arm(pygame.K_6) is None
    assert key_to_arm(pygame.K_a) is None


def test_room_pull_keeps_score():
    from slot_room import Room
    room = Room(seed=4)
    best = room.bandit.best_arm()
    room.pull(best)
    assert room.pulls == 1 and room.regret == 0.0, "pulling the best machine costs no regret"
    other = (best + 1) % 5
    reward = room.pull(other)
    assert room.regret == approx(room.bandit.regret(other))
    assert room.last == (other, reward)
    assert room.learner.N[other] == 1


def test_room_window_opens_and_closes():
    from slot_room import run
    assert run(max_frames=3) == 3
```

Each test's name starts with the part it tests (`test_bandit_…`, `test_learner_…`, `test_room_…`), and each step of this lesson checks its own group with `-k`. (`-k` also matches the file's name, which is why this file is called `test_slots.py` and not `test_bandit.py`: `-k bandit` would then select every test in it.) The tests for later parts import them **inside** the test function (`from bandit import Learner`), so the file can be collected before those parts exist.

```check
file tests/test_slots.py -- Click "Create provided tests/test_slots.py" above.
```

## A machine with a hidden average

Create `bandit.py`:

```python file=bandit.py
import numpy as np


class Bandit:
    def __init__(self, k, rng):
        self.rng = rng
        self.means = rng.normal(0.0, 1.0, k)

    def pull(self, arm):
        return float(self.rng.normal(self.means[arm], 1.0))

    def best_arm(self):
        return int(self.means.argmax())

    def regret(self, arm):
        return float(self.means.max() - self.means[arm])
```

**How a class works.** A class is a recipe for making objects that carry their own data around with them. `Bandit(5, rng)`:

1. makes a new, empty object;
2. calls `__init__` with that object as its first argument, `self`, followed by your arguments, `k = 5` and `rng`;
3. `__init__` stores data **on the object**: `self.means = …` creates an attribute named `means` that belongs to this one bandit;
4. returns the object.

A method call such as `bandit.pull(2)` is shorthand: Python finds `pull` in the class and calls `Bandit.pull(bandit, 2)`. That's how `pull` gets `self`, and through it this bandit's own `means` and `rng`. Two bandits made from the same class have separate means and don't affect each other.

**Where the payouts come from.** Each machine's average payout is drawn once, when the room is built, and kept hidden in `self.means`. `rng.normal(0.0, 1.0, k)` draws `k` numbers from a **normal distribution**, the bell curve from lesson 2.2, with mean 0 and standard deviation 1. About 68% of draws land within 1 of the mean, and about 95% within 2. So most machines average somewhere between −2 and +2.

Each pull then draws a payout from another bell curve, centred on that machine's own mean, with standard deviation 1: `rng.normal(self.means[arm], 1.0)`. A machine that averages 0.6 can easily pay −0.5 on one pull and +1.8 on the next. That noise is what makes the problem hard. (NumPy makes normally distributed numbers from the same uniform bits as `random()`, using a method called the **ziggurat** algorithm, which reshapes evenly spread numbers into a bell curve.)

This set-up, normal means and unit-variance payouts, is the standard **10-armed testbed** from Sutton and Barto's *Reinforcement Learning: An Introduction*, the field's main textbook, here with 5 arms. Using a standard set-up means your numbers can be compared with published ones.

**Regret** is how much worse a choice is than the best machine, measured by **means**, not payouts: `means.max() − means[arm]`. Measuring by payouts would mix in luck. A lucky pull on a bad machine isn't a good decision. Adding up the regret of every pull gives the total cost of not knowing which machine was best.

```check
run ".venv/Scripts/python -m pytest -q tests/test_slots.py -k bandit" label="Bandit hides a mean per machine and pays around it" -- Draw the k hidden means once in __init__, then each pull draws one payout around that machine's mean with standard deviation 1.
```

## A learner that keeps averages

The learner's job is to estimate each machine's mean from the payouts it has seen, and to choose. It's the update rule from lesson 2.3, with one estimate per machine:

```python file=bandit.py
import numpy as np

from averages import update
from qtable import greedy_action


class Bandit:
    def __init__(self, k, rng):
        self.rng = rng
        self.means = rng.normal(0.0, 1.0, k)

    def pull(self, arm):
        return float(self.rng.normal(self.means[arm], 1.0))

    def best_arm(self):
        return int(self.means.argmax())

    def regret(self, arm):
        return float(self.means.max() - self.means[arm])


class Learner:
    def __init__(self, k, rng):
        self.Q = np.zeros(k)
        self.N = np.zeros(k, dtype=int)
        self.rng = rng

    def choose(self):
        return greedy_action(self.Q, self.rng)

    def learn(self, arm, reward):
        self.N[arm] += 1
        self.Q[arm] = update(self.Q[arm], reward, 1 / self.N[arm])
```

- `self.Q` holds one estimate per machine. In reinforcement learning, Q stands for the *quality* of an action. It's the same Q as the Q-table, here with a single state.
- `self.N` counts the pulls of each machine. `dtype=int` stores whole numbers, since a count is never a fraction.
- `learn` adds one to that machine's count and moves its estimate with step `1 / N`, which is the exact running mean from lesson 2.3. After three pulls of machine 0 paying 2, 4 and 0, `Q[0]` is (2 + 4 + 0) / 3 = 2.
- `choose` is **greedy**: it always pulls the machine with the best estimate so far, breaking ties at random with `greedy_action` from lesson 1.2.

```predict
question: The greedy learner plays 200 pulls in a room of 5 machines. In a typical room, how many different machines will it try?
choice: All 5: it has to try them all to compare them
choice: Often only 1 or 2
choice: Exactly 1, every time
answer: Often only 1 or 2
explain: Over 1000 rooms, the greedy learner tried just 1 machine in 29% of them, and 1 or 2 in 52%. All estimates start at 0, so the first pull is a random tie-break. If that payout is positive, that machine's estimate is now above 0 and beats every untried machine's 0. Greedy pulls it again and again, and as long as its average stays above 0, the others are never tried. The learner ended on the truly best machine in only 58% of rooms.
verify: script greedy_tries.py
```

This trap is the whole exploration problem in one picture. The estimate of an untried machine never improves, because improving it would mean pulling it, and greedy never pulls a machine that looks worse. A machine judged on one unlucky pull is never given a second chance.

```check
run ".venv/Scripts/python -m pytest -q tests/test_slots.py -k learner" label="Learner keeps a running average per machine and picks the best" -- learn: count the pull first, then update with step 1 / N[arm], so the first payout replaces the starting 0.
```

## The room

Now the room itself, where you pull the levers:

```python file=slot_room.py
import numpy as np
import pygame

from bandit import Bandit, Learner

K = 5
WIDTH, HEIGHT = 700, 420
BOX_W, BOX_H, GAP = 110, 150, 25
TOP = 80
AGENT_INTERVAL = 200          # milliseconds between the agent's pulls
BACKGROUND = (24, 26, 33)
BOX = (51, 65, 85)
LAST = (94, 234, 212)
TRUE = (248, 113, 113)
TEXT = (226, 232, 240)
HINT = (148, 163, 184)


class Timer:
    def __init__(self, interval):
        self.interval = interval
        self.waited = 0

    def tick(self, dt):
        self.waited += dt
        fired = self.waited // self.interval
        self.waited -= fired * self.interval
        return int(fired)


class Room:
    def __init__(self, seed):
        rng = np.random.default_rng(seed)
        self.bandit = Bandit(K, rng)
        self.learner = Learner(K, rng)
        self.pulls = 0
        self.total = 0.0
        self.regret = 0.0
        self.last = None

    def pull(self, arm):
        reward = self.bandit.pull(arm)
        self.learner.learn(arm, reward)
        self.pulls += 1
        self.total += reward
        self.regret += self.bandit.regret(arm)
        self.last = (arm, reward)
        return reward


def key_to_arm(key):
    arm = key - pygame.K_1
    return arm if 0 <= arm < K else None


def box_rect(arm):
    return pygame.Rect(GAP + arm * (BOX_W + GAP), TOP, BOX_W, BOX_H)


def draw(screen, font, room, reveal, auto):
    screen.fill(BACKGROUND)
    for arm in range(K):
        rect = box_rect(arm)
        is_last = room.last is not None and room.last[0] == arm
        pygame.draw.rect(screen, LAST if is_last else BOX, rect, border_radius=10)
        lines = [f"machine {arm + 1}", f"pulls {room.learner.N[arm]}"]
        if room.learner.N[arm]:
            lines.append(f"avg {room.learner.Q[arm]:+.2f}")
        if reveal:
            lines.append(f"true {room.bandit.means[arm]:+.2f}")
        for row, text in enumerate(lines):
            colour = TRUE if text.startswith("true") else (BACKGROUND if is_last else TEXT)
            screen.blit(font.render(text, True, colour), (rect.x + 10, rect.y + 12 + row * 24))
    status = [f"pulls {room.pulls}   total {room.total:+.1f}   regret {room.regret:.1f}"]
    if room.last is not None:
        status.append(f"last: machine {room.last[0] + 1} paid {room.last[1]:+.2f}")
    status.append("keys 1-5 pull   A agent " + ("on" if auto else "off") + "   Tab show true means   R new room")
    for row, text in enumerate(status):
        screen.blit(font.render(text, True, TEXT if row < 2 else HINT), (GAP, TOP + BOX_H + 40 + row * 28))


def run(max_frames=None, seed=0):
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Slot machine room")
    font = pygame.font.Font(None, 24)
    clock = pygame.time.Clock()
    room = Room(seed)
    timer = Timer(AGENT_INTERVAL)
    reveal = auto = False
    frames = 0
    running = True
    while running:
        dt = clock.tick(60)
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                arm = key_to_arm(event.key)
                if arm is not None:
                    room.pull(arm)
                elif event.key == pygame.K_a:
                    auto = not auto
                elif event.key == pygame.K_TAB:
                    reveal = not reveal
                elif event.key == pygame.K_r:
                    seed += 1
                    room = Room(seed)
        if auto:
            for _ in range(timer.tick(dt)):
                room.pull(room.learner.choose())
        draw(screen, font, room, reveal, auto)
        pygame.display.flip()
        frames += 1
        if max_frames is not None and frames >= max_frames:
            running = False
    pygame.quit()
    return frames


if __name__ == "__main__":
    run()
```

New game mechanics, and how they work:

- **Doing something every 200 milliseconds without stopping the loop.** The agent should pull 5 times a second, but the loop runs 60 times a second, and a frame isn't always exactly 16.7 ms long. `clock.tick(60)` returns how many milliseconds the last frame took (lesson 0.3), and the loop now keeps that as `dt`. `Timer.tick(dt)` adds it to `waited`, the time owed so far, and counts how many whole intervals fit: `waited // interval`. Then it subtracts what it used, so the leftover carries into the next frame. Traced for a 200 ms timer:

  ```text
  frame takes   waited    fires   left over
     150 ms       150       0        150
     100 ms       250       1         50
     150 ms       200       1          0
     450 ms       450       2         50     (a slow frame owes two pulls)
  ```

  Games time everything this way: animations, enemy spawns, the agent's actions. Never with `time.sleep`, which would freeze the whole loop, events and drawing included.
- **`pygame.Rect`** is pygame's rectangle object: `x`, `y`, `width`, `height`, plus helpers. `box_rect(arm)` places machine `arm` at `GAP + arm × (BOX_W + GAP)` pixels across, so each box is one box-width plus one gap further right than the one before. `border_radius=10` rounds the corners.
- **`key_to_arm`** uses the same trick as lesson 2.3: key codes for `1` to `5` are consecutive, so subtracting `pygame.K_1` gives 0 to 4. Anything outside that range isn't a machine and returns `None`.
- **`Room`** gathers everything one game needs: the bandit, the learner's estimates, and the score. A pull goes through `room.pull`, whoever makes it, so the score and the estimates under each machine always agree. Your pulls and the agent's share one `Learner`: when you switch the agent on, it continues from what you've learned.
- **Toggles.** `auto = not auto` flips a `True`/`False` setting, the same as pausing in lesson 2.3. `reveal` works the same way and shows the hidden means in red.
- The last machine pulled is drawn in teal, with its text in the background colour so it stays readable on the bright box.

Run it. **Play first:** you have 30 pulls with keys 1–5. Try to finish with the highest total you can. Watch the averages under each machine as you go.

```predict
question: After your 30 pulls, before pressing Tab: which machine do you think is best, and how sure are you? Write down the machine and a rough confidence.
explain: Press Tab to show the true means in red. With payouts that scatter by about 1 around each mean, an average of 3 or 4 pulls is uncertain by about ±0.5 (1 / √4, lesson 2.2). That's often more than the gap between the two best machines. If you were confidently wrong, that's the lesson: a few pulls can't tell close machines apart.
```

Now press **A** and watch the greedy agent continue. Press **R** for a new room, and watch the agent from the start a few times.

Over many rooms, greedy settles on one machine within a few pulls and is wrong about 4 times in 10. People usually explore more than greedy does, often a little too much. Lesson 3.2 turns "explore a little" into a rule, measures how much is right, and compares strategies fairly over thousands of rooms.

```check
run ".venv/Scripts/python -m pytest -q tests/test_slots.py" label="all lesson 3.1 tests pass" -- Timer: add dt to what's owed, fire once for every whole interval, and keep the remainder for next time.
```
