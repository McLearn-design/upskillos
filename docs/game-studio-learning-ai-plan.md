# Learning AI in your own games: plan

Status: approved by the user on 2026-10-03. It extends the bonus lesson (mg8-001, Q-learning on Breakout) into a
chapter.

## What is missing today

The agent can only **be the player**: its actions are the project's input actions, and it drives the game by pressing
keys. **Training lives in the editor:** the trained table exists only while the dialog is open, so nothing ships with
the game, and an enemy cannot use it. The environment is JSON node paths, which suits Breakout but not a guard
that needs "can I see the player?".

To give your own NPCs learned behaviour, Game Studio needs four things:

1. **Agents defined in script.** A script on the NPC says what the agent sees, does and earns, in code:
   `observe()`, `act(action)` and `reward()`. The action is the NPC's own move, not a key the player would
   press. The JSON spec stays for simple cases.
2. **Brains as project files.** Training saves `brains/<name>.json`: the method, bins or features, and the table
   or weights. It is exported with the game. At run time a script loads it and asks it what to do:

   ```js
   const brain = brains.load('brains/ghost.json')
   const action = brain.act(this.observe())
   ```

3. **Training with others in the scene.** While one NPC learns, everything else in the scene runs its own script:
   - a scripted player (one that flees, or wanders), so the NPC can be trained before any human plays;
   - or several NPCs sharing one brain, all learning from the same table.
4. **Seeing what it thinks.** While the game runs, a debug overlay over the NPC shows its state, its Q values and
   the action it chose.

Then **beyond tables**: linear Q-learning on features, for when bins make too many states. It is the step that
leads to deep Q-networks, and it is still small enough to read.

## The chapter: "Game AI that learns" (chapter 9, after the bonus)

**Revised 2026-10-03, at the user's request.** The user is studying Q-learning for a course assignment this week
and asked that the lab teach every concept of the topic, in whatever language the assignment uses. So the
chapter now covers the whole of tabular TD control (Sutton & Barto ch. 6, with the pieces of ch. 2, 3 and 9–10 it
leans on) before applying it to your own games.

The user does their own assignment. The lessons teach and give practice; they do not solve anything set for the
course.

Each lesson has:
- a notebook: the maths, built by hand on a small problem, every number tested;
- a Game Studio task on Cliff Walk or another example, using the lab's instruments: Train in view, Step and
  Predict, Compare, and the overlay.

| # | Lesson | Concepts | In Game Studio |
|---|---|---|---|
| 1 | Learning from every step | Prediction vs control; Monte Carlo vs TD(0); bootstrapping; the TD error; the random walk (Ex. 6.2) | Step and Predict through Cliff Walk's updates |
| 2 | Exploration | ε-greedy and its schedules, softmax (Boltzmann), optimistic initial values; exploration vs exploitation | Compare schedules and starting values on the cliff |
| 3 | On-policy and off-policy: SARSA and Q-learning | The two targets; why SARSA walks safe and Q-learning walks the edge (Ex. 6.6, Fig. 6.4) | Train both in view; Compare them over seeds |
| 4 | Expected SARSA and Double Q-learning | Averaging over the policy; maximization bias (Ex. 6.7) and its fix | Compare all four updates |
| 5 | Experiments that mean something | α, γ and episodes; seeds and spread; learning curves vs greedy scores; reporting results | Compare sweeps of α and γ |
| 6 | Bigger state spaces | Binning, aliasing and the Markov property; how many bins; state design | Breakout and the chaser: bins measured |
| 7 | Beyond tables | Linear function approximation, features, the semi-gradient update; DQN's replay buffer and target network | (notebook; linear Q in Game Studio later) |
| 8 | NPCs that learn in your own game | Script agents, brains, ai.training, scripted opponents, shared brains | Maze Chase: a ghost that learns |
| 9 | When not to learn | Search, state machines, behaviour trees vs learning, measured | The learned ghost vs the breadth-first-search ghost |
| 10 | Capstone | A learning enemy in your own game | Your project |

## Order of work

1. **Engine.** Script agents (`observe`, `act`, `reward`), brains as files, the run-time `brains` API, and export.
   Each comes with tests, and an acceptance test where a trained ghost runs in an exported game.
2. **Training with other scripts running.** A scripted opponent, and shared brains.
3. **The overlay.**
4. **Linear Q-learning,** in `ml/` next to the tabular version.
5. **The lessons,** in order, each verified as 8.1 was: notebook numbers tested, the task's steps proved by
   `tutorials.shots.mjs`, and results measured over several seeds and quoted as measured.

Estimated size: the engine work is about one session; the lessons are about one session per two lessons. The
real bottleneck is measuring each lesson's claims (training runs over seeds), not writing.

## Progress

**Step 1, the engine: done (2026-10-03).**
- **Script agents** (`engine/game.ts`, `ml/env.ts`):
  - A node whose script has `observe()` and `act(action)` is an agent. It can also have `actions` and
    `observations` (names), `reward()`, `done()` and `decideEvery`.
  - The engine drives it from the brain named in its `brain` field, every `decideEvery` frames.
  - `GameEnv` trains it from `{ agent: 'Path', bins: [...] }`, through the same two methods, so it behaves the
    same in training and in the game.
- **Brains** (project format 4, `BrainData`):
  - `project.saveBrain` / `removeBrain` are undo steps and lines of GUI → code, checked by `problems()`.
  - Brains are saved with the project and exported in `project.json`; older projects migrate to `brains: []`.
- **The `ai` global:** `ai.training` (true while an agent trains, so a player script can play itself),
  `ai.has(path)` and `ai.act(path, numbers)`.
- **The dialog:**
  - Run › Train an agent… accepts `{ agent, bins }`, and takes labels from the trainer (a `describe` message).
  - It has **Save as brain**. "Watch it play" drives a script agent through `game.setAgentPolicy`.
- **Policy code** moved to `ml/brain.ts`, which imports nothing, so the engine uses brains without the trainer.
- **Tests:**
  - `ml/agents.test.ts`: a chaser NPC trained, saved, replayed from the code log, driven by its brain in a
    fresh game, and exported.
  - `ml.acceptance.mjs` 10/10, including Save as brain; `q-agent` shots 5/5; Game Studio unit tests 236/236.
- **Found while testing (for lesson 3, "States that work"):**
  - With only the direction to the target (−1, 0, 1), the chaser stayed in one state for many steps. Every
    action bootstrapped from that same state, and it could not learn in 80 episodes.
  - With the offset in 60 px units cut into 5 bins per axis (25 states), it learns in 200.

**Train in view: done (2026-10-03).** The user wanted to see the machine learn, not only the result.
- **One learner:** Q-learning is now a step-at-a-time `QLearner` (`ml/qlearning.ts`). The worker runs it flat out,
  and the game's runtime runs it inside the visible game, a few ticks per drawn frame.
  - Speeds are real time, 4×, 16×, 64× and Max (game frames per drawn frame).
  - Only the last frame of each burst is drawn.
  - Random play and the final score are measured headless.
- **The same draws in the same order.** Watching learns exactly what headless training learns:
  - `trainview.acceptance.mjs` checks the same score and the same greedy checks, in both;
  - `qlearning.test.ts` locks Breakout's ten greedy checks, 48 44 44 43 44 −5 13 22 −2 48, unchanged by the refactor.
- **The panel:** a strip under the game (the game shrinks to fit above it, so nothing is covered). It shows:
  - what the learner is doing: the episode and how much it explores, or a greedy check game;
  - the speed buttons and the live learning curve;
  - when it is done, Watch it play and the way to Save as brain.
- **Scope:** the player's keys are ignored while it trains; Pause pauses training; Stop ends it.
- **Pictures:** `$TMPDIR/game-studio-train-in-view.png`, `game-studio-train-hud.png`.

**Lab instruments for the concepts: done (2026-10-03).**
- **Four updates** in `QLearner`: Q-learning, SARSA, Expected SARSA and Double Q-learning.
- **Exploration options:** ε-greedy or softmax; linear, exponential or constant schedules; optimistic starting Q.
  Q-learning's default numbers are unchanged; Breakout's checks are locked in the test.
- `ml/td.test.ts` reproduces Sutton & Barto:
  - Example 6.6: Q-learning's 13-move edge path, SARSA's top-row path, SARSA earning more while exploring;
  - Example 6.7: maximization bias, Q-learning against Double Q-learning.
- **Cliff Walk** (`examples/cliffWalk.ts`), the textbook gridworld, as a playable example:
  - the Walker is a script agent; its cell is its state;
  - `ml/overlay.ts` draws the table on the grid while it trains and plays (a `rect` draw kind);
  - `ml/cliff.test.ts` gets the textbook result on the real engine.
- **Step and Predict** (`editor/TrainTrace.tsx`):
  - pause and step one update at a time, written in its algorithm's formula with its real numbers;
  - Predict hides the target and the new Q until you check;
  - `TrainTrace.test.tsx` proves the shown arithmetic gives the learner's numbers, for all four updates.
- **Compare** (`ml/compare.ts`, `editor/CompareView.tsx`):
  - settings over the same seeds, with averaged curves and mean ± sample sd of late return and greedy score;
  - on the cliff it shows Fig. 6.4's shape.
- **Browser:** `cliff.acceptance.mjs` 8/8 (in `npm run game:acceptance`).

**Lesson 9.1, "Learning from Every Step": done (2026-10-03).**
- `src/courses/making-games/9-game-ai-that-learns/001-learning-from-every-step.js`, from the YAML (chapter 9).
- **Notebook:** the random walk; one episode learned by every-visit MC and by TD(0); error curves over 100 runs
  (TD α 0.1: 0.054, α 0.05: 0.035; MC α 0.03: 0.090, α 0.01: 0.094); one Q-learning update; the TD(0) challenge,
  which checks itself.
- **Try it:** the `td-step` task (its pictures made; all 4 steps tick).
- **Checks:** `courses/making-games/td.test.js` pins every printed number. The browser probe ran every cell and
  opened the Try it card. mg8-001's nextLesson is mg9-001.
- **The task panel** now stops above the training strip (it had covered Predict's Check).

**Lesson 9.2, "Exploration": done (2026-10-03).**
- `002-exploration.js`.
- **Notebook,** on the 10-armed bandit over 200 runs: greedy reaches the best arm 42% of the time against ε 0.1's
  82%. Optimistic greedy ends highest (1.41), then UCB (1.39) and softmax (1.36). Also the incremental average and
  constant-α weights, the reward curves, and the ε-greedy probabilities challenge.
- **Try it:** the `explore-compare` task, 3 steps that tick in shots.
  - Cliff, 5 seeds, late return: ε 0.1 constant −43.4 ± 7.2; linear −25.9 ± 8.1; exponential −16.7 ± 2.1;
    softmax −13 ± 0.
  - Greedy ε 0: Q₀ 0 gives −13 on every seed; Q₀ −100 gives a greedy return of −14.2 ± 1.1.
- **Test:** `explore.test.js`.

**Next:**
- the lessons above, from 9.3;
- then step 2 (shared brains, a scripted opponent), the NPC overlay, and linear Q in Game Studio.

**Earlier list, kept for reference:**
- step 2: shared brains, several NPCs learning one table, and a scripted opponent in an example;
- step 3: the overlay;
- step 4: linear Q-learning;
- then the lessons, starting with 9.2.

## Decisions

- **Where it goes:** a new chapter 9 after the bonus (the user, 2026-10-03).
- **Lesson 8 stays in:** when not to use learning, measured against the breadth-first-search ghost (the user,
  2026-10-03).
- **Brains ship in exported games:** part of the approved plan; a trained ghost should work on a website too.
- **Python:** the ML Lab's Python could later train on the same environments. Not part of this plan.
