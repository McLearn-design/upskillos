---
title: 2.3 — The Running Average and the Step Size α
track: Reinforcement Learning in pygame
runtime: python
run: tracker.py
---

Lesson 2.2 said an agent has to turn single results (+1, −1, +1, +1, −1, …) into an expected value. It can't wait until it has seen everything and then average. It has to keep a current estimate and improve it **after every result**, the way a person updates an opinion. This lesson builds that one update rule:

```text
estimate ← estimate + step × (target − estimate)
```

This line is the heart of nearly every method in this series. Bandits in Chapter 3 use it to learn a slot machine's payout. Monte Carlo, SARSA and Q-learning in Chapters 6 and 7 use it with a cleverer `target`. Get to know it well here, where the target is just the latest result.

## Read the tests first

**This step: create the supplied test file and read it. No code yet.**

Click **Create provided tests/test_averages.py** above.

```python file=tests/test_averages.py provided
# Tests for averages.py and tracker.py. Run them with:
#   .venv\Scripts\python -m pytest -q tests/test_averages.py
import numpy as np
import pygame
from pytest import approx

import averages


def test_update_moves_a_fraction_of_the_way_to_the_target():
    assert averages.update(0.0, 10.0, 0.5) == approx(5.0)
    assert averages.update(4.0, 10.0, 0.25) == approx(5.5), "a quarter of the way from 4 to 10"
    assert averages.update(4.0, 10.0, 1.0) == approx(10.0), "step 1 jumps to the target"
    assert averages.update(4.0, 10.0, 0.0) == approx(4.0), "step 0 ignores it"


def test_running_mean_equals_the_mean_of_everything_so_far():
    xs = np.array([3.0, -1.0, 4.0, 1.0, 5.0, -9.0, 2.0])
    expected = [xs[:n].mean() for n in range(1, len(xs) + 1)]
    assert averages.running_mean(xs) == approx(expected)


def test_running_mean_ignores_the_starting_estimate():
    assert averages.running_mean([7.0])[0] == approx(7.0), "with step 1/1 the first result replaces the start"


def test_running_average_with_a_constant_step():
    assert averages.running_average([10.0, 10.0], 0.5) == approx([5.0, 7.5])


def test_running_average_remembers_its_start_less_and_less():
    after = averages.running_average(np.zeros(50), 0.1, start=100.0)
    assert after[-1] == approx(100 * 0.9 ** 50), "each update keeps 90% of the start's share"


def test_weights_halve_each_step_when_the_step_is_one_half():
    assert averages.weights(0.5, 3) == approx([0.5, 0.25, 0.125])


def test_weights_are_what_the_average_really_gives_each_result():
    step = 0.1
    for k in range(5):
        xs = np.zeros(20)
        xs[-1 - k] = 1.0          # a single 1, k results before the end
        assert averages.running_average(xs, step)[-1] == approx(averages.weights(step, 5)[k])


def test_weights_of_a_long_history_add_up_to_one():
    assert averages.weights(0.1, 1000).sum() == approx(1.0)


def test_tracking_a_constant_step_follows_a_change_and_the_mean_does_not():
    rng = np.random.default_rng(0)
    xs = np.concatenate([np.where(rng.random(1000) < 0.2, -1.0, 1.0),
                         np.where(rng.random(1000) < 0.6, -1.0, 1.0)])   # true mean 0.6, then -0.2
    assert abs(averages.running_average(xs, 0.05)[-1] - (-0.2)) < 0.3
    assert averages.running_mean(xs)[-1] > 0.1, "the all-time mean is still stuck between 0.6 and -0.2"


def test_view_rewards_change_at_the_switch():
    import tracker
    rng = np.random.default_rng(1)
    before = np.mean([tracker.reward(t, rng) for t in range(tracker.SWITCH)])
    after = np.mean([tracker.reward(tracker.SWITCH + t, rng) for t in range(5000)])
    assert abs(before - tracker.true_mean(0)) < 0.1
    assert abs(after - tracker.true_mean(tracker.SWITCH)) < 0.05


def test_view_to_y_puts_high_values_near_the_top():
    import tracker
    assert tracker.to_y(tracker.HIGH) == tracker.TOP
    assert tracker.to_y(tracker.LOW) == tracker.BOTTOM
    assert tracker.to_y(0.5) < tracker.to_y(0.0), "a larger value is drawn higher up, so with a smaller y"


def test_view_line_points_keep_only_what_fits():
    import tracker
    points = tracker.line_points(list(range(tracker.WIDTH + 100)))
    assert len(points) == tracker.WIDTH
    assert points[0][0] == 0


def test_view_draws_each_line_at_its_height():
    import tracker
    pygame.font.init()
    screen = pygame.Surface((tracker.WIDTH, tracker.HEIGHT))
    history = {"true": [1.0] * 50, "mean": [0.5] * 50, "average": [-0.5] * 50}
    tracker.draw(screen, pygame.font.Font(None, 22), history, 0.1)
    assert screen.get_at((20, tracker.to_y(1.0)))[:3] == tracker.TRUE
    assert screen.get_at((20, tracker.to_y(0.5)))[:3] == tracker.MEAN
    assert screen.get_at((20, tracker.to_y(-0.5)))[:3] == tracker.AVERAGE


def test_view_window_opens_and_closes():
    import tracker
    assert tracker.run(max_frames=3) == 3
```

`test_weights_are_what_the_average_really_gives_each_result` is a neat trick worth understanding. It feeds the average a history of zeros with a single 1 in it. Whatever the final estimate comes out as must be exactly the share of the result that the 1 occupied, which is its **weight**. Moving the 1 further back shows how quickly older results fade.

```check
file tests/test_averages.py -- Click "Create provided tests/test_averages.py" above.
```

## One update rule

Create `averages.py`:

```python file=averages.py
import numpy as np


def update(estimate, target, step):
    return estimate + step * (target - estimate)
```

Read it in two parts:

1. `target - estimate` is the **error**: how far the estimate is from what just happened, with a sign. Positive means the estimate was too low.
2. `step × error` moves the estimate a **fraction** of the way towards the target. The fraction is called the **step size**, usually written α (the Greek letter alpha).

Worked through with estimate 4 and target 10, so the error is 6:

```text
step 0.25:  4 + 0.25 × 6 = 5.5     a quarter of the way
step 0.5:   4 + 0.5  × 6 = 7       halfway
step 1:     4 + 1    × 6 = 10      all the way: forget the old estimate
step 0:     4 + 0    × 6 = 4       ignore the new result
```

So the step size says how much one new result is trusted compared with everything before it. In lesson 7.1, Q-learning's learning step will be exactly this function: `Q[s, a] = update(Q[s, a], target, alpha)`.

```check
run ".venv/Scripts/python -m pytest -q tests/test_averages.py -k update" label="update moves a fraction of the way to the target" -- Add step times (target - estimate) to the estimate.
```

## The exact mean, one result at a time

The plain average of everything so far needs the whole list of results. But it can be updated one result at a time, keeping only the current mean and a count. Write M for the mean of the first n results, and x for the n-th result:

```text
(n − 1) × M_old         is the total of the first n − 1 results
(n − 1) × M_old + x     is the total of all n
M_new = ((n − 1) × M_old + x) / n
      = M_old − M_old / n + x / n
      = M_old + (1 / n) × (x − M_old)
```

The last line is `update(M_old, x, 1 / n)`. **The exact mean is the update rule with step 1/n.**

```python file=averages.py
import numpy as np


def update(estimate, target, step):
    return estimate + step * (target - estimate)


def running_mean(xs):
    estimate = 0.0
    estimates = []
    for n, x in enumerate(xs, start=1):
        estimate = update(estimate, x, 1 / n)
        estimates.append(estimate)
    return np.array(estimates)
```

`enumerate(xs, start=1)` hands out each result together with its position, counting from 1, so `n` is how many results have been seen, this one included. Traced on `[3, -1, 4]`:

```text
n = 1, x =  3:   0 + (1/1) × ( 3 − 0) = 3
n = 2, x = −1:   3 + (1/2) × (−1 − 3) = 1
n = 3, x =  4:   1 + (1/3) × ( 4 − 1) = 2      check: (3 − 1 + 4) / 3 = 2
```

The first step has size 1/1, so it jumps all the way to the first result. Whatever the estimate started at is forgotten at once, which is why the starting 0.0 doesn't matter.

This matters for an agent. A grid world has many states and actions, and each needs its own average. Keeping every result for every one of them would mean an ever-growing pile of lists. With the update rule, each needs only two numbers, its current estimate and its count, however long the agent runs.

```check
run ".venv/Scripts/python -m pytest -q tests/test_averages.py -k running_mean" label="running_mean keeps the exact mean of everything so far" -- Update with step 1/n, where n counts the results so far, starting at 1.
```

## A constant step

The step 1/n has a problem: it keeps shrinking. After 1000 results, a new one moves the estimate by only 1/1000 of its error. The estimate effectively stops listening. That's right if the truth never changes. In reinforcement learning, it usually does change:

- the world may change, like ice that gets worse;
- more importantly, the agent itself changes. A state's value depends on what the agent does next, and as it learns to act better, the "true" value of a state rises. Its earliest results describe a clumsier agent.

The fix is to keep the step **constant**:

```python file=averages.py
import numpy as np


def update(estimate, target, step):
    return estimate + step * (target - estimate)


def running_mean(xs):
    estimate = 0.0
    estimates = []
    for n, x in enumerate(xs, start=1):
        estimate = update(estimate, x, 1 / n)
        estimates.append(estimate)
    return np.array(estimates)


def running_average(xs, step, start=0.0):
    estimate = start
    estimates = []
    for x in xs:
        estimate = update(estimate, x, step)
        estimates.append(estimate)
    return np.array(estimates)


def weights(step, n):
    return step * (1 - step) ** np.arange(n)
```

**How a constant step weighs the past.** Write α for the step and E for the estimate. One update is `E_new = E_old + α(x − E_old)`, which rearranges to `E_new = α × x + (1 − α) × E_old`: a share α of the new result, plus a share (1 − α) of the old estimate. The old estimate was made the same way from the result before, so unfolding it repeatedly gives:

```text
E = α × x_latest + α(1 − α) × x_one_before + α(1 − α)² × x_two_before + … + (1 − α)ⁿ × start
```

Each result's weight is α times (1 − α) once for every step back. `weights(step, n)` computes those weights, newest first, using whole-array arithmetic on `np.arange(n)` = `[0, 1, 2, …]`:

```text
>>> weights(0.1, 4)
array([0.1   , 0.09  , 0.081 , 0.0729])
```

With α = 0.1, every step back keeps 90% of the weight, and a result about 7 results back counts half as much as the latest one (0.9 multiplied by itself 6.6 times is 0.5). The weights fall off **exponentially**, so this is called an **exponential recency-weighted average**. Old results never vanish completely, they just keep fading.

Two facts the tests check:

- **The weights add up to 1**, apart from the start's share. They form a geometric series: α × (1 + (1 − α) + (1 − α)² + …) = α × 1/α = 1. So the estimate is a true weighted average of the results.
- **The start is remembered, but less and less.** Its weight is (1 − α)ⁿ: after 50 updates with α = 0.1, it's 0.9⁵⁰ ≈ 0.005. With a constant step, a bad starting value hurts for a while. That will matter in Chapter 3, where a deliberately high starting value turns out to be useful.

```check
run ".venv/Scripts/python -m pytest -q tests/test_averages.py -k \"running_average or weights\"" label="running_average and weights work" -- A constant step uses the same step for every update; weights(step, n) is step * (1 - step) ** k for k = 0, 1, ..., n - 1.
```

## Watch them follow a change

`tracker.py` feeds rewards from the ice, one press at a time. After 600 presses the ice gets worse, and the slip jumps from 0.2 to 0.6, so the true mean falls from 0.6 to −0.2. It plots the true mean, the exact mean (step 1/n), and a constant-step average:

```python file=tracker.py
import numpy as np
import pygame

from averages import update

WIDTH, HEIGHT = 640, 400
TOP, BOTTOM = 40, HEIGHT - 70
LOW, HIGH = -1.2, 1.2
SWITCH = 600                 # after this many rewards the ice gets worse
SLIPS = (0.2, 0.6)           # slip before and after the switch
STEPS = [0.3, 0.1, 0.01]     # keys 1, 2, 3
PER_FRAME = 2                # rewards per frame
BACKGROUND = (24, 26, 33)
AXIS = (60, 64, 76)
TRUE = (248, 113, 113)
MEAN = (148, 163, 184)
AVERAGE = (94, 234, 212)
TEXT = (226, 232, 240)


def true_mean(t):
    return 1 - 2 * SLIPS[int(t >= SWITCH)]


def reward(t, rng):
    return -1.0 if rng.random() < SLIPS[int(t >= SWITCH)] else 1.0


def to_y(value):
    return round(BOTTOM - (value - LOW) / (HIGH - LOW) * (BOTTOM - TOP))


def line_points(values):
    shown = values[-WIDTH:]
    return [(x, to_y(v)) for x, v in enumerate(shown)]


def draw(screen, font, history, step):
    screen.fill(BACKGROUND)
    pygame.draw.line(screen, AXIS, (0, to_y(0)), (WIDTH, to_y(0)))
    for key, colour in (("true", TRUE), ("mean", MEAN), ("average", AVERAGE)):
        if len(history[key]) > 1:
            pygame.draw.lines(screen, colour, False, line_points(history[key]), 2)
    lines = [(f"red: true mean    grey: mean of everything (step 1/n)    teal: step {step}", TEXT),
             ("keys 1 / 2 / 3: step 0.3 / 0.1 / 0.01 (restarts)    space: pause", TEXT)]
    for row, (text, colour) in enumerate(lines):
        screen.blit(font.render(text, True, colour), (12, BOTTOM + 12 + row * 22))


def new_history():
    return {"true": [], "mean": [], "average": []}


def run(max_frames=None, seed=0):
    rng = np.random.default_rng(seed)
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Running averages")
    font = pygame.font.Font(None, 22)
    clock = pygame.time.Clock()
    step = STEPS[1]
    history = new_history()
    t, mean, average = 0, 0.0, 0.0
    paused = False
    frames = 0
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
                paused = not paused
            elif event.type == pygame.KEYDOWN and event.key in (pygame.K_1, pygame.K_2, pygame.K_3):
                step = STEPS[event.key - pygame.K_1]
                history = new_history()
                t, mean, average = 0, 0.0, 0.0
        if not paused:
            for _ in range(PER_FRAME):
                r = reward(t, rng)
                t += 1
                mean = update(mean, r, 1 / t)
                average = update(average, r, step)
                history["true"].append(true_mean(t - 1))
                history["mean"].append(mean)
                history["average"].append(average)
        draw(screen, font, history, step)
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

How it works:

- **Turning values into heights.** `to_y` maps a value to a pixel row. `(value − LOW) / (HIGH − LOW)` is how far up the range the value is, from 0 at the bottom to 1 at the top. Multiplied by the plot's height, `BOTTOM − TOP`, that gives a distance in pixels **upwards**, and since y grows downwards, it's subtracted from `BOTTOM`. So 1.2 lands on `TOP`, −1.2 on `BOTTOM`, and 0 halfway.
- **Lines.** `pygame.draw.lines(screen, colour, False, points, 2)` draws straight lines joining each point to the next, 2 pixels thick. `False` means don't join the last point back to the first. One point per reward, one pixel apart, makes a smooth-looking curve.
- **Scrolling.** `line_points` keeps only the newest `WIDTH` values (`values[-WIDTH:]`, a slice counted from the end) and numbers them from x = 0. Every frame adds 2 values, so everything shifts 2 pixels left, and the oldest drop off the edge. Nothing is moved: each frame simply redraws from the newest values.
- **The update loop.** Each frame handles `PER_FRAME = 2` rewards. `t` counts rewards. The exact mean updates with `1 / t` and the average with `step`, the same rule with two different step sizes, side by side.
- **Keys.** The keys `1`, `2` and `3` have consecutive key numbers in pygame, so `event.key - pygame.K_1` is 0, 1 or 2, an index into `STEPS`. Changing the step restarts the run. Space flips `paused` between `True` and `False` with `not`.

Run it, and make both predictions before the switch comes (it comes after 600 presses, about 5 seconds).

```predict
question: Just before the switch, which line is smoother: the grey one (step 1/n) or the teal one (step 0.1)?
choice: grey
choice: teal
choice: About the same
answer: grey
explain: By press 600, the grey line's step is 1/600, so one press moves it by a 600th of its error and it barely twitches. Its typical miss is the standard error, 0.8 / √600 ≈ 0.03. The teal line always moves a tenth of the way, so each press shoves it around, and its wobble stays about 0.18.
verify: .venv/Scripts/python -c "import numpy as np, tracker as t, averages as a; r = np.random.default_rng(0); xs = [t.reward(i, r) for i in range(t.SWITCH)]; g = a.running_mean(xs)[400:].std(); c = a.running_average(xs, 0.1)[400:].std(); print('grey' if g < c else 'teal')"
```

```predict
question: After the switch, the true mean drops from 0.6 to −0.2. What will the grey and teal lines do?
choice: Both follow it down at the same speed
choice: Teal follows within a few dozen presses; grey drifts down slowly and is still far off when the run scrolls past
choice: Grey follows first, because it has seen more data
answer: Teal follows within a few dozen presses; grey drifts down slowly and is still far off when the run scrolls past
explain: Teal trusts each new press by the same tenth, so the old ice fades out of its estimate within a few dozen presses. Grey weighs all 600 old presses equally with each new one. It can only drift towards the average of everything, old and new, which is correct for neither.
verify: .venv/Scripts/python -c "import numpy as np, tracker as t, averages as a; r = np.random.default_rng(0); xs = [t.reward(i, r) for i in range(t.SWITCH + 300)]; g = a.running_mean(xs)[-1]; c = a.running_average(xs, 0.1)[-1]; print('Teal follows within a few dozen presses; grey drifts down slowly and is still far off when the run scrolls past' if abs(c + 0.2) < 0.3 and g > 0.2 else (g, c))"
```

Then try keys 1, 2 and 3. Measured over long runs on this ice:

```text
step   wobble once settled   presses to react to the change (median)
0.3          0.34                    3
0.1          0.18                   13
0.01         0.06                  188
```

The wobble is the standard deviation of the estimate once it has settled. It comes out as σ√(α / (2 − α)), where σ = 0.8 is one press's standard deviation, which matches the measurements. The exact mean barely moves after the switch. It ends this run at about 0.21, roughly the average of the old truth and the new one, which is correct about neither.

That's the trade-off you'll tune in every learning method in this series:

- a **large step** reacts quickly but never settles, because each new result shoves it around;
- a **small step** settles smoothly but reacts slowly, because it trusts its past;
- **step 1/n** is the best possible estimate when nothing changes, and goes deaf when something does.

Next chapter: a room of slot machines, where an agent uses exactly this rule to learn which machine pays best, while choosing which one to try next.

```check
run ".venv/Scripts/python -m pytest -q tests/test_averages.py" label="all lesson 2.3 tests pass" -- to_y: a larger value must give a smaller y, since y grows downwards: subtract the height above the bottom from BOTTOM.
```
