---
title: 2.2 — Expectation, Variance and the Standard Error
track: Reinforcement Learning in pygame
runtime: python
run: means_view.py
---

On the ice from lesson 2.1, say an agent aims right at a goal: it scores +1 if it lands where it aimed and −1 if it slides. What does one press score? There's no single answer: sometimes +1, sometimes −1. But two numbers describe the situation exactly:

- the **expected value**: the average score per press over a long run, the number an agent's value table tries to learn;
- the **variance**: how widely single presses scatter around that average, which decides how much experience it takes to learn it.

Then comes the question every experiment in this series has to answer: you averaged some presses (or some training runs) and got 0.58. How far from the truth might that be? The answer is the **standard error**. It also explains the margins in the tests you've been running, such as `abs(share - 0.3) < 0.02`.

## Read the tests first

**This step: create the supplied test file and read it. No code yet.**

Click **Create provided tests/test_stats.py** above.

```python file=tests/test_stats.py provided
# Tests for stats.py and means_view.py. Run them with:
#   .venv\Scripts\python -m pytest -q tests/test_stats.py
import numpy as np
import pygame
from pytest import approx

import stats

DATA = [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]   # mean 5; squared distances add up to 32


def test_expected_value_weights_each_value_by_its_probability():
    assert stats.expected_value([1.0, -1.0], [0.8, 0.2]) == approx(0.6)
    assert stats.expected_value([1, 2, 3, 4, 5, 6], [1 / 6] * 6) == approx(3.5), "a fair die"


def test_expected_value_of_a_certain_outcome_is_that_outcome():
    assert stats.expected_value([7.0, 100.0], [1.0, 0.0]) == approx(7.0)


def test_variance_is_the_expected_squared_distance_from_the_mean():
    assert stats.variance([1.0, -1.0], [0.8, 0.2]) == approx(0.64)
    assert stats.variance([1, 2, 3, 4, 5, 6], [1 / 6] * 6) == approx(35 / 12), "a fair die"
    assert stats.variance([7.0, 100.0], [1.0, 0.0]) == approx(0.0), "no spread when nothing is random"


def test_sample_mean_and_std():
    assert stats.sample_mean(DATA) == approx(5.0)
    assert stats.sample_std(DATA) == approx(np.sqrt(32 / 7)), "divide the squared distances by n - 1 = 7"


def test_standard_error_shrinks_with_the_square_root_of_n():
    assert stats.standard_error(DATA) == approx(np.sqrt(32 / 7) / np.sqrt(8))
    four_times = DATA * 4
    ratio = stats.standard_error(DATA) / stats.standard_error(four_times)
    assert 1.9 < ratio < 2.2, "four times the data should roughly halve the standard error"


def test_interval_is_two_standard_errors_each_side():
    low, high = stats.interval(DATA)
    se = stats.standard_error(DATA)
    assert low == approx(5.0 - 2 * se)
    assert high == approx(5.0 + 2 * se)


def test_interval_contains_the_true_mean_about_95_percent_of_the_time():
    rng = np.random.default_rng(0)
    hits = 0
    for _ in range(2000):
        rewards = np.where(rng.random(100) < 0.2, -1.0, 1.0)
        low, high = stats.interval(rewards)
        hits += low <= 0.6 <= high
    assert 0.93 < hits / 2000 < 0.975, f"the interval held the true mean in {hits / 2000:.3f} of 2000 experiments"


def test_view_experiment_averages_n_presses():
    import means_view
    rng = np.random.default_rng(1)
    means = [means_view.experiment(1000, rng) for _ in range(20)]
    assert all(-1.0 <= m <= 1.0 for m in means)
    assert abs(np.mean(means) - 0.6) < 0.02


def test_view_means_spread_less_with_more_presses():
    import means_view
    rng = np.random.default_rng(2)
    small = np.std([means_view.experiment(10, rng) for _ in range(800)])
    large = np.std([means_view.experiment(160, rng) for _ in range(800)])
    assert 3.3 < small / large < 4.8, f"16 times the presses should spread the means about 4 times less, got {small / large:.2f}"


def test_view_bins_count_every_mean_in_range():
    import means_view
    counts = means_view.bin_counts([0.0, 0.6, 0.6, 1.0])
    assert counts.sum() == 4
    assert len(counts) == means_view.BINS


def test_view_to_x_maps_the_range_onto_the_window():
    import means_view
    assert means_view.to_x(means_view.LOW) == 0
    assert means_view.to_x(means_view.HIGH) == means_view.WIDTH


def test_view_window_opens_and_closes():
    import means_view
    assert means_view.run(max_frames=2) == 2
```

New here: `approx`. The expected score is 0.8 × 1 + 0.2 × (−1), which is 0.6, but Python says:

```text
>>> 0.8 * 1 + 0.2 * -1
0.6000000000000001
```

As in lesson 2.1, 0.8 and 0.2 have no exact binary form, and the leftover error shows up in the last digit. Testing with `==` would reject a correct answer. `x == approx(0.6)` passes if `x` is within one millionth of 0.6, relative to its size (pytest's default tolerance). Use `approx` whenever you compare a float that came from arithmetic.

```check
file tests/test_stats.py -- Click "Create provided tests/test_stats.py" above.
```

## The expected value

Create `stats.py`:

```python file=stats.py
import numpy as np


def expected_value(values, probs):
    return float(np.sum(np.asarray(values) * np.asarray(probs)))
```

**What it computes:** each possible value times its probability, all added up:

```text
E = 1 × 0.8 + (−1) × 0.2 = 0.8 − 0.2 = 0.6
```

**Why that's the long-run average.** Picture 1000 presses. About 800 land as aimed and score +1, and about 200 slide and score −1. The total is about 800 − 200 = 600, so the average per press is about 600 / 1000 = 0.6. Weighting each value by its probability is that same calculation, done for "a very large number of presses" without having to make them.

How the code does it: `np.asarray` turns lists into arrays, so `*` multiplies them element by element, `[1 × 0.8, −1 × 0.2]`, and `np.sum` adds the products. `float(…)` returns a plain Python number instead of a NumPy one.

The expected value need not be a value that can happen: a fair die's is (1 + 2 + … + 6) / 6 = 3.5, and you never roll 3.5. Likewise no single press scores 0.6.

**This is what an agent learns.** In Q-learning, each `Q[s, a]` is meant to become the expected value of what follows from taking action `a` in state `s`. The agent never sees the probabilities, only single results such as +1 and −1. Learning means turning those single results into the expected value, which is the job of lesson 2.3.

```check
run ".venv/Scripts/python -m pytest -q tests/test_stats.py -k expected_value" label="expected_value weights each value by its probability" -- Multiply each value by its probability and add the products.
```

## The variance: how far single results scatter

Two actions can have the same expected value and behave very differently: one always scores 0.6, another scores +1 or −1. The **variance** measures the difference. It's the expected **squared distance** from the mean:

```python file=stats.py
import numpy as np


def expected_value(values, probs):
    return float(np.sum(np.asarray(values) * np.asarray(probs)))


def variance(values, probs):
    mean = expected_value(values, probs)
    return expected_value((np.asarray(values) - mean) ** 2, probs)
```

Worked through for the ice (mean 0.6):

```text
value   distance from 0.6   squared   × probability
 +1          +0.4             0.16      × 0.8 = 0.128
 −1          −1.6             2.56      × 0.2 = 0.512
                                         variance = 0.640
```

How the code does it: it computes the mean, makes the array of squared distances `(values - mean) ** 2` (whole-array arithmetic, as in lesson 1.1), and then takes **their** expected value with the function you already wrote. The variance is itself an expected value: the average squared miss.

Why square the distances? Plain distances, +0.4 and −1.6, weighted by probability, add up to exactly 0, because that's what being the mean means: misses above and below balance. Squaring makes every miss count as positive, and makes big misses count far more than small ones.

The variance is in squared units ("score squared"), which is hard to picture. Its square root, the **standard deviation**, is back in the original units: √0.64 = 0.8. Roughly, a single press typically lands about 0.8 away from the mean.

```check
run ".venv/Scripts/python -m pytest -q tests/test_stats.py -k variance" label="variance is the expected squared distance from the mean" -- Compute the squared distance of every value from the mean, then take the expected value of those.
```

## From probabilities to data

An agent doesn't know the probabilities. It only has results. The same two ideas, computed from a list of observed results, are the **sample mean** and the **sample standard deviation**:

```python file=stats.py
import numpy as np


def expected_value(values, probs):
    return float(np.sum(np.asarray(values) * np.asarray(probs)))


def variance(values, probs):
    mean = expected_value(values, probs)
    return expected_value((np.asarray(values) - mean) ** 2, probs)


def sample_mean(xs):
    return float(np.mean(xs))


def sample_std(xs):
    return float(np.std(xs, ddof=1))
```

`np.mean` adds the numbers and divides by how many there are. `np.std(xs, ddof=1)` is the standard deviation, with one twist: it divides the sum of squared distances by **n − 1** instead of n. (`ddof` means "delta degrees of freedom": divide by n − ddof.)

**Why n − 1?** The squared distances are measured from the *sample's own* mean, since the true mean is unknown. The sample mean is, by definition, the point closest to that particular sample: no other point gives a smaller total of squared distances. The true mean is somewhere else, so measuring from the sample mean makes the spread look smaller than it is. Dividing by a slightly smaller number, n − 1, corrects for that. You can check it by simulation. Take 100,000 samples of only 5 presses each on the ice, where the true variance is 0.64, and average their variances:

```text
divide by n:      0.513
divide by n − 1:  0.641
```

Dividing by n is wrong by 20% for samples of 5, which is a factor of exactly 4/5. As n grows, n and n − 1 get relatively closer and the difference fades.

In the test, `DATA` has mean 5, and its squared distances from 5 add up to 9 + 1 + 1 + 1 + 0 + 0 + 4 + 16 = 32. So its sample standard deviation is √(32 / 7) ≈ 2.138.

```check
run ".venv/Scripts/python -m pytest -q tests/test_stats.py -k sample_mean" label="sample_mean and sample_std work" -- np.std divides by n unless you pass ddof=1, which divides by n - 1.
```

## How far off is an average?

You average n presses and get a sample mean. Repeat the whole experiment, and you get a slightly different mean. The **standard error** is the standard deviation of those means: how much an average of n results typically misses by.

**How it shrinks with n.** For independent random values, variances add: the total of n presses has variance n × σ², where σ² is one press's variance. The average is the total divided by n, and dividing a random value by n divides its variance by n². So the average's variance is n × σ² / n² = σ² / n, and its standard deviation is

```text
standard error = σ / √n
```

On the ice, σ = 0.8. An average of 100 presses typically misses by 0.8 / √100 = 0.08, and of 10,000 presses by 0.008. Note the square root: **four times the data only halves the error**, and a hundred times the data makes it ten times smaller. Precision gets expensive.

From data, σ is unknown, so the sample standard deviation stands in for it:

```python file=stats.py
import numpy as np


def expected_value(values, probs):
    return float(np.sum(np.asarray(values) * np.asarray(probs)))


def variance(values, probs):
    mean = expected_value(values, probs)
    return expected_value((np.asarray(values) - mean) ** 2, probs)


def sample_mean(xs):
    return float(np.mean(xs))


def sample_std(xs):
    return float(np.std(xs, ddof=1))


def standard_error(xs):
    return sample_std(xs) / np.sqrt(len(xs))


def interval(xs, z=2.0):
    mean = sample_mean(xs)
    margin = z * standard_error(xs)
    return (mean - margin, mean + margin)
```

**The interval.** Averages of many independent values pile up in a bell-shaped curve around the true mean. That's the **central limit theorem**, and it holds whatever the shape of the single values: even for ±1 presses, the averages form a bell. In a bell curve, about 95% of results land within 2 standard deviations of the centre. So "sample mean ± 2 standard errors" is an interval that contains the true mean in about 95% of experiments. The test checks this directly: 2000 experiments of 100 presses each, and the interval held the true 0.6 in 94.5% of them.

**Now the margins in your tests make sense.**

- `test_bernoulli_frequency_is_close_to_p` (lesson 2.1): 10,000 tries at p = 0.3. One try has σ = √(0.3 × 0.7) ≈ 0.458, so the standard error is 0.458 / √10,000 ≈ 0.0046. The margin 0.02 is 4.4 standard errors, so a correct `bernoulli` fails that test less than once in 50,000 runs.
- `test_greedy_action_breaks_ties_evenly` (lesson 1.2): each action is chosen with probability 1/4, 4000 times. Its count has standard deviation √(4000 × 0.25 × 0.75) ≈ 27.4 around 1000, so 850 to 1150 is ±5.5 standard errors.

A margin is a decision: too tight and correct code fails now and then, too loose and wrong code passes. Standard errors let you choose on purpose.

```check
run ".venv/Scripts/python -m pytest -q tests/test_stats.py -k \"standard_error or interval\"" label="standard_error and interval work" -- The standard error is the sample standard deviation divided by the square root of the number of values.
```

## Watch the averages narrow

`means_view.py` runs many experiments. Each experiment averages `n` presses on the ice. It draws a **histogram** of the experiments' averages, a bar chart of how many landed in each small range, with the true mean 0.6 marked in red:

```python file=means_view.py
import numpy as np
import pygame

from stats import expected_value, variance

SLIP = 0.2
REWARDS = [1.0, -1.0]          # landed where aimed, or slid
PROBS = [1 - SLIP, SLIP]
SIZES = [10, 40, 160, 640]
WIDTH, HEIGHT = 640, 400
FLOOR = HEIGHT - 70
LOW, HIGH, BINS = -0.2, 1.2, 56
BACKGROUND = (24, 26, 33)
BAR = (94, 234, 212)
TRUE = (248, 113, 113)
TEXT = (226, 232, 240)


def experiment(n, rng):
    rewards = np.where(rng.random(n) < SLIP, -1.0, 1.0)
    return float(rewards.mean())


def bin_counts(means):
    counts, _ = np.histogram(means, bins=BINS, range=(LOW, HIGH))
    return counts


def to_x(value):
    return round((value - LOW) / (HIGH - LOW) * WIDTH)


def draw(screen, font, n, means):
    screen.fill(BACKGROUND)
    width = WIDTH / BINS
    counts = bin_counts(means)
    tallest = max(counts.max(), 1) if len(means) else 1
    for i, count in enumerate(counts):
        height = round(count / tallest * (FLOOR - 60))
        pygame.draw.rect(screen, BAR, (round(i * width), FLOOR - height, round(width) - 1, height))
    true_mean = expected_value(REWARDS, PROBS)
    pygame.draw.line(screen, TRUE, (to_x(true_mean), 40), (to_x(true_mean), FLOOR), 2)
    predicted = np.sqrt(variance(REWARDS, PROBS)) / np.sqrt(n)
    lines = [f"presses per experiment n = {n}   (up/down to change, space: 100 more experiments)",
             f"experiments: {len(means)}   predicted spread: {predicted:.3f}"]
    if len(means) > 1:
        lines.append(f"measured spread of the means: {np.std(means, ddof=1):.3f}")
    for row, text in enumerate(lines):
        screen.blit(font.render(text, True, TEXT), (12, FLOOR + 8 + row * 20))


def run(max_frames=None, seed=0):
    rng = np.random.default_rng(seed)
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Averages of many presses")
    font = pygame.font.Font(None, 22)
    clock = pygame.time.Clock()
    size = 0
    means = []
    frames = 0
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_SPACE:
                means += [experiment(SIZES[size], rng) for _ in range(100)]
            elif event.type == pygame.KEYDOWN and event.key in (pygame.K_UP, pygame.K_DOWN):
                step = 1 if event.key == pygame.K_UP else -1
                size = min(max(size + step, 0), len(SIZES) - 1)
                means = []
        draw(screen, font, SIZES[size], means)
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

- **`experiment` does n presses in one go.** `rng.random(n)` returns `n` random numbers at once, as an array. `rng.random(n) < SLIP` compares all of them with 0.2, giving an array of `True`/`False`: `True` where that press slid. `np.where(condition, a, b)` builds a new array choosing, element by element, `a` where the condition is true and `b` where it's false. So each press scores −1 or +1, and `.mean()` averages them. No Python loop runs, which matters when `n` is 640 and you run 100 experiments per key press.
- **`bin_counts`** splits the range from −0.2 to 1.2 into 56 equal **bins**, each 1.4 / 56 = 0.025 wide, and counts the averages that fall in each. `np.histogram` finds a value's bin with the same arithmetic you'd use: `(value − LOW) / width`, rounded down. It returns the counts and the bin edges, and `_` is the usual name for a result you don't need.
- **`to_x`** converts a value into a pixel position across the window: how far along the range it is, `(value − LOW) / (HIGH − LOW)`, as a fraction from 0 to 1, times the window width. −0.2 maps to pixel 0, 1.2 maps to pixel 640, and 0.6 maps to the point 0.8 / 1.4 of the way across.
- **The bars are scaled** so the tallest bin always reaches the same height. The picture shows the *shape* of the pile, however many experiments you've run.
- The text compares the **predicted** spread, σ / √n using your `variance`, with the **measured** standard deviation of the averages so far.

Run it. Press **Space** a few times to add experiments of `n = 10` presses.

```predict
question: Pressing **Up** multiplies `n` by 4, from 10 presses per experiment to 40. What happens to the width of the pile of averages?
choice: It stays the same width
choice: It gets about half as wide
choice: It gets about a quarter as wide
answer: It gets about half as wide
explain: The width is the standard error, σ / √n. Four times the presses divides it by √4 = 2, not by 4. Press Up and Space a few times and compare the "measured spread" line.
verify: .venv/Scripts/python -c "import numpy as np, means_view as m; r = np.random.default_rng(9); a = np.std([m.experiment(10, r) for _ in range(2000)]); b = np.std([m.experiment(40, r) for _ in range(2000)]); print('It gets about half as wide' if 1.7 < a / b < 2.3 else a / b)"
```

Measured with 1000 experiments at each size:

```text
n      predicted spread   measured spread
10          0.253             0.263
40          0.126             0.128
160         0.063             0.067
640         0.032             0.031
```

Each step up halves the spread, as √4 = 2 says. At `n = 10`, the averages come out in steps of 0.2, since 10 presses can only score an average of −1, −0.8, …, 1. So the pile is a row of separate spikes. As `n` grows, the spikes get closer together and blend into a smooth bell.

What this means for the rest of the series: when two agents' average results differ by less than about two standard errors, you can't yet tell them apart. Run more seeds, and remember that four times as many only halves the uncertainty.

```check
run ".venv/Scripts/python -m pytest -q tests/test_stats.py" label="all lesson 2.2 tests pass" -- experiment: one random() per press, -1.0 where it's below SLIP and 1.0 elsewhere, then the mean.
```
