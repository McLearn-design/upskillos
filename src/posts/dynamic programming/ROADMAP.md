# Dynamic Programming → HJB → ML/RL: Zero to Mastery (17 lessons)

Standalone curriculum. No assumptions carried over from any other series — Python
basics (loops, conditionals, data types) assumed, nothing else.

Format for every lesson:
1. **Foundation** — the general technique, taught on a *different, simple example*
   first, with real explanation of data storage, mechanics, and function
   signatures (not just "here's code that works").
2. **Guided exploration checkpoints** — explicit "copy the file, try X" prompts
   placed at natural points, always with instructions to come back to the
   original file afterward.
3. **Challenge** — apply the technique just built to the *actual* target problem
   yourself, cold.
4. **Solution** — given in a **separate file**, after the challenge, so it's not
   visible until you want it.
5. **Go-further pointer** — only once foundation + challenge are solid, a note on
   what to google/probe next, once you have footing to make sense of it.

---

## Phase A — Decorators, Memoization, and the Core DP Idea (Lessons 1–5)
Pure Python. No math notation at all yet.

- **Lesson 1 — Decorators from fundamentals.** Functions as first-class
  values, closures built generally (not tied to caching yet), `*args`/
  `**kwargs`, decorator factories (`@repeat(3)`-style), and a real tour of
  where decorators show up in the wild (web-framework route registration,
  `@staticmethod`/`@property`, test frameworks, `functools.lru_cache`) —
  understanding the general tool before using it for one specific purpose.
- **Lesson 2 — Memoization and Fibonacci.** Applies Lesson 1's decorator
  mechanics directly to build `memoize`, then poses Fibonacci as a challenge;
  closes with tabulation (bottom-up, no recursion) built and compared against
  it directly (speed, memory, recursion-depth limits).
- **Lesson 3 — Choice-based DP (coin change).** Introduces DP problems where
  you choose the *best* of several options at each step, not just reuse a
  single answer. Exploration checkpoint: swap `min` for `max` and see what new
  problem it solves with the identical skeleton.
- **Lesson 4 — 2D grid DP (edit distance / grid paths) + Phase A capstone.**
  Introduces a DP table with two indices. Exploration checkpoint: add a third
  move option (e.g. diagonal) and see how the recurrence must change.

## Phase B — DP as Sequential Decision-Making (Lessons 6–9)
Same ideas, new vocabulary: states, actions, rewards. This is the vocabulary
bridge to Bellman equations — no new math, just relabeling what you already
built.

- **Lesson 6 — States, actions, rewards.** Reframe Lesson 3/4's DP explicitly
  in this vocabulary using a tiny made-up decision problem.
- **Lesson 7 — Value iteration on a grid-world, from scratch.** Build a small
  grid-world (a 2D array of rewards), compute a value for every cell via the
  same caching principle as Lesson 2, iterated until it stops changing.
- **Lesson 8 — Policy iteration + reward shaping.** Extract the *best action*
  at each cell from the value grid. Exploration checkpoint: change the reward
  structure (e.g. add a penalty region) and watch the optimal policy shift.
- **Lesson 9 — Phase B capstone.** A slightly larger grid-world (a simple maze)
  solved end to end, explicitly connected back to Lesson 2's caching insight.

## Phase C — From Discrete to Continuous: Getting to HJB (Lessons 10–13)
Still no calculus notation until Lesson 12 — intuition is built visually and
numerically first.

- **Lesson 10 — Shrinking the time step.** Take a discrete DP recurrence and
  simulate it with smaller and smaller time steps in code; watch it visually
  converge toward a smooth curve.
- **Lesson 11 — A continuous control toy problem.** A point moving toward a
  target under a cost function, simulated with small `dt` steps — this *is*
  optimal control, in code, before any PDE.
- **Lesson 12 — Deriving HJB.** The actual Taylor-expansion step from the
  Bellman recurrence to the HJB equation, done slowly, each symbol introduced
  as a rename of something already computed in Lesson 11's code.
- **Lesson 13 — The full legend + Linear Quadratic Regulator (LQR).** Every
  symbol in the HJB equation annotated against your own variable names; a
  classic solvable HJB special case (LQR) built and solved from scratch.

## Phase D — DP/HJB Meets ML and RL (Lessons 14–17)
Connects back to the video you found — reinforcement learning is applied,
approximate dynamic programming.

- **Lesson 14 — Q-learning from scratch.** Same Bellman equation from Phase B,
  now learned from experience instead of known rewards.
- **Lesson 15 — Function approximation.** When the state space is too large for
  a table (Lesson 7's grid), approximate the value function with a small
  model instead — built from first principles, no assumed prior ML knowledge.
- **Lesson 16 — Deep Q-Networks, conceptually.** Swap Lesson 15's simple
  approximator for a small neural net; connect back to HJB/continuous control.
- **Lesson 17 — Capstone.** A simple continuous-control problem solved with an
  approximate-DP agent, explicitly traced back through every phase to Lesson
  2's original caching insight.

---

**Status:** Roadmap complete. Lessons 1–2 delivered below. Next: Lesson 3 in
the next batch (per your usual pace of a few lessons per session).
