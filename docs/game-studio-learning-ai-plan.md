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

Each lesson has a notebook (the maths, built by hand on a small game) and a Game Studio task, as 8.1 does.

| # | Lesson | What you learn | In Game Studio |
|---|---|---|---|
| 1 | Q-learning (today's 8.1) | The loop, Q, Bellman, the TD update, exploration | Breakout, 14 states |
| 2 | Designing an environment for any game | A checklist: what decides the action, relative coordinates, what ends an episode, how often to decide | The platformer: an agent that reaches the flag |
| 3 | States that work | The Markov question, aliasing, how many bins, measuring instead of guessing | Experiments with bins, compared on the curve |
| 4 | Rewards and shaping | Misspecification, potential-based shaping (with the proof), sparse vs dense rewards | A reward that teaches the wrong thing, then fixed |
| 5 | An NPC that learns | Agents in script; brains as files; training against a scripted player | Maze Chase: a ghost that learns to corner you, shipped in the game |
| 6 | Many NPCs, one brain | Shared experience, and the opponent problem (a moving target; self-play) | Zombie Arena: zombies that learn to flank |
| 7 | Beyond tables | Linear Q-learning with features: the gradient view of the update, and why it can diverge | The same ghost with features instead of bins |
| 8 | Debugging and judging agents | Seeds, held-out games, overlays, and when a state machine or path-finding is the better tool | The overlay, and the ghost against the breadth-first-search ghost |
| 9 | Capstone: a learning enemy in your own game | The whole recipe on a game you made | Your project |

Lesson 8 is there on purpose. Most game NPCs are better written by hand, with state machines, path-finding and
behaviour trees. Learning earns its place for:
- tuning behaviour that is hard to write down;
- opponents that adapt;
- finding exploits in your own game (an agent that breaks a level shows you where).

The course should teach that judgement, not only the technique.

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

**Next:**
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
