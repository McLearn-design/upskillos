# Reinforcement Learning in pygame — track plan

A Project Studio track (desktop app only) that takes a learner from an empty folder to tabular Q-learning and real Gymnasium environments. Each lesson adds to one project, `rl-workbench`: a pygame program where the environment, the agent and what the agent has learned are all visible while it runs.

Lessons live in `src/labs/project-studio/tracks/rl-pygame/`. Supplied files live in its `support/` folder.

## Why a Project Studio track and not the ML lab

The ML lab and the Notebook Lab series run Python in the browser (Pyodide). They can't open a window, run for minutes, use a GPU or install packages such as Gymnasium's renderers. Project Studio already runs real files from a folder on disk, with diffs, a terminal and checks that run the learner's code. Since this change, a project with a `.venv` runs on that environment's Python (`desktop/app/runtimes/python.cjs`, `projectCommand`).

## The route, compared with the suggested fast track

The suggested fast track uses Notebook Lab ML series lessons 1, 2, 10, 11, 12, 17 and 64–70. Checking those lessons against what Q-learning needs:

| Suggestion | Decision | Evidence |
|---|---|---|
| 1–2 NumPy | Keep | A Q-table is a 2D array; `Q[s].argmax()`, `Q.max(axis=1)` and fancy indexing appear in every RL lesson. |
| 10, 12 Probability, expectation | Keep | Slippery moves, ε-greedy and returns are random; their averages are the values being learned. |
| 11 Distributions | Shrink | Only uniform choices, Bernoulli slips and normal rewards are used. They are taught where they first appear. |
| 13 Estimation and uncertainty | **Add** (standard error only) | Comparing two agents means averaging over seeds and knowing how much the average can be trusted. One lucky run proves nothing. |
| 17 What learning is | **Replace** | Its sections are features, labels, loss, test sets: supervised framing that Q-learning doesn't use. |
| (none) | **Add: the running average** | Every RL method updates `estimate += step × (target − estimate)`. The notebook series first meets it inside the bandits lesson. Here it gets its own lesson first. |
| 64–70 RL core | Keep, in order | Each method fixes a flaw of the one before. Bandits move before the grid world (Sutton & Barto's order): a bandit is the running average with actions and no states. |
| (none) | **Add: Gymnasium** | No notebook lesson covers it. Termination vs truncation changes the Q-learning target, so it gets a lesson. |
| (none) | **Add: setup and pygame** | A virtual environment, pinned packages, a GPU check and the game loop. The game loop is the agent–environment loop. |

## Chapters

| # | Lesson | Notebook source | Status |
|---|---|---|---|
| 0.1 | A project with its own Python (venv, pinned packages) | — | Written |
| 0.2 | Know your machine: `doctor.py` (Python, packages, GPU) | — | Written |
| 0.3 | A window and a loop (pygame game loop) | — | Written |
| 1.1 | Arrays: the shape of a Q-table | 1 | Written |
| 1.2 | Indexing and broadcasting: reading and writing Q[s, a] | 2 | Written |
| 2.1 | Probability by simulation: seeds and a slippery floor | 10, 11 | Written |
| 2.2 | Expectation, variance and the standard error | 12, 13 | Written |
| 2.3 | The running average and the step size α | — | Written |
| 3.1 | A room of slot machines (play it yourself) | 65 | Written |
| 3.2 | Greedy, ε-greedy, optimism, fair comparison over many rooms | 65 | Written |
| 4.1 | The grid world as a class: `reset` and `step` | 64 | Planned |
| 4.2 | Returns and discounting; a random policy | 64 | Planned |
| 4.3 | The MDP as tables: P and R, the Markov property | 66 | Planned |
| 5.1 | Policy evaluation, painted on the grid | 66, 67 | Planned |
| 5.2 | Value iteration and the greedy policy | 67 | Planned |
| 6.1 | Monte Carlo: learning from whole episodes | 68 | Planned |
| 6.2 | TD(0) and SARSA; the cliff | 69 | Planned |
| 7.1 | Q-learning: one term changes | 70 | Planned |
| 7.2 | Evaluating an agent honestly | 70, 13 | Planned |
| 8.1 | Your grid world as a `gymnasium.Env` | — | Planned |
| 8.2 | FrozenLake with your agent | — | Planned |
| 8.3 | CartPole: when the table breaks | — | Planned |

Lessons can be inserted later without renumbering existing files: use a new number between two existing ones (for example `02-04-…`). A lesson's progress key is its file name, so never rename a published lesson.

After Chapter 8: neural networks (ML series 46–52) and DQN in PyTorch, which is where the GPU first matters.

## How lessons are written

- **Explain how, not only what.** Every new call, term or game mechanic gets its mechanism, usually as a worked example with real numbers or a short trace: how `clock.tick` decides how long to sleep, how `reshape` avoids copying, how one uniform number picks a weighted outcome. The learner knows Python but not game development.
- **Measure every number the text quotes.** Outputs, timings and spreads in a lesson come from running the code (the walkthrough runs every step; prompt sessions and measurements were run by hand).
- **Read the tests first.** Each lesson opens with its supplied test file and explains how to read it. Steps are checked with `pytest -k <name>`; a later step's test name must not contain an earlier step's `-k` text (this has caught real bugs: `values` matched `test_normalise_all_equal_values…`).
- **Every check has at least one wrong answer** in `tracks/rl-pygame.walkthrough.js` that it must reject. A wrong answer that passes means the test is weak: the absolute-distance variance passed for ±1 rewards until a die case was added.

- **Prediction checkpoints.** A ```predict fence (format in `src/labs/project-studio/predictions.js`) asks the learner to commit to an answer before the explanation is shown. Number predictions must, and choice predictions may, have a `verify:` command (or `verify: script name.py`, run from `tracks/rl-pygame/verify/`); the walkthrough runs it and fails if the code doesn't produce the stated answer.

## Supplied files and where they are taught

Things may be handed over up front, but by the end of the track everything handed over is taught. The table below records each supplied file.

| Supplied file | First supplied | Taught in |
|---|---|---|
| `tests/test_*.py` | 0.2 onwards | Shown and read in each lesson ("Read the tests first"); writing your own tests is a planned lesson before Chapter 4 |
| `tests/conftest.py` (SDL dummy drivers) | 0.3 | Explained line by line in 0.3 |

## Runtime decisions

Measured on 2026-10-03 (Windows 11, Python 3.13.14):

- **Python 3.12 or newer.** `numpy==2.5.3` requires Python ≥ 3.12 (its `Requires-Python`).
- **pygame-ce, not pygame.** `pygame==2.6.1` has no wheel for Python 3.14 (`pip download --python-version 3.14` finds none); `pygame-ce==2.5.8` has wheels for 3.12, 3.13 and 3.14 and is still imported as `pygame`.
- **Plain `gymnasium`, no `[toy-text]` or `[classic-control]` extras.** Those extras require upstream `pygame`, which would install over pygame-ce. With `pygame-ce` installed, FrozenLake and CartPole render (`render_mode="rgb_array"` returned 256×256 and 400×600 frames).
- **Checks run `.venv/Scripts/python`** by path, so they don't depend on whether the learner activated the environment. Windows PowerShell's default execution policy (`Restricted`) blocks `Activate.ps1`; Lesson 0.1 explains that error.
- **GPU.** Tabular methods gain nothing from a GPU. The RTX 5060 on the development machine reports compute capability 12.0 (Blackwell), which needs a PyTorch build for CUDA 12.8 or newer. That is taught when PyTorch arrives, using what `doctor.py` reports.

## Verification

`src/labs/project-studio/rlPygame.desktop.test.js` walks the track like a learner: it creates the venv, installs `requirements.txt`, types each step's file, runs every check, and tries the wrong answers listed in `tracks/rl-pygame.walkthrough.js` (each must fail the named checks).

```sh
npx vitest run src/labs/project-studio/rlPygame.desktop.test.js
```
