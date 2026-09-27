# Machine Learning Lab audit — 2026-09-27

## Verdict

The Machine Learning Lab is technically healthy and far beyond a prototype. All 61 labs are present, the curriculum runs from Python and array basics through production ML and advanced theory, and the automated suite currently passes 576 tests across 74 files.

The remaining work is concentrated in the learning system around that content. A learner can study, experiment, run notebooks, complete practice ladders, and attempt an implementation challenge, but the app does not yet preserve or summarize all of that evidence as one trustworthy path from beginner to mastery.

No release-blocking content failure was found in this audit. The lab is safe to continue testing. The high-priority items below should be completed before describing the experience as a complete mastery system.

## Evidence reviewed

- Read `docs/ML_LAB_STATUS.md`, the lab README, roadmap, shell, learning path, Python runtimes, progress storage, and responsive styles.
- Opened the real app and reviewed all three Lab 01 surfaces: Learn & experiment, Implement in Python, and Your learning path.
- Confirmed the beginner lesson starts with Python runtime behavior, arrays, shapes, weighted sums, predictions, runnable cells, checks, math-to-code mapping, and a synchronized experiment.
- Ran `vitest run src/labs/ml-lab`: 74 files and 576 tests passed.
- Ran the production build successfully after the current OpenMAT work.
- Checked the registry: all 61 lab folders are present.

This was an engineering and browser UX audit. It was not an observed study with first-time learners.

## What is already strong

1. **The beginning is genuinely beginner-oriented.** Lab 01 starts before NumPy and linear algebra assumptions, explains the Python runtime, and connects concrete units to weights and predictions.
2. **The curriculum has a coherent progression.** It moves through evidence, classical ML, geometry, neural networks, production engineering, optional specializations, and advanced theory.
3. **Lessons connect representations.** Prose, equations, code, interactive figures, predictions, checkpoints, and experiments use the same examples.
4. **Practice is more than multiple choice.** The ladders move from tracing through repair and implementation to seeded variants and delayed returns.
5. **The notebook runtime has meaningful safeguards.** It isolates notebooks, supports stopping and restarting, caps output and figures, preserves drafts, and exports valid notebooks.
6. **The implementation challenges are honest about their evidence.** Their copy states what checks establish instead of claiming that passing proves general mastery.
7. **The automated content discipline is excellent.** Tests cover lesson composition, math links, figures, engines, notebooks, ladders, and lab smoke behavior.

## Findings

### P1 — implementation challenge completion is not saved

The implementation tab can report that all checks passed, but `runPython` only updates transient status text. It does not save a completion record in the lab progress object. Reloading the app loses that result.

This causes three problems:

- the path can send the learner to “Next: implement and explain” but cannot tell when that work is complete;
- the app cannot distinguish a read checkpoint from a passed implementation;
- a learner cannot show which lab implementations they completed without exporting files manually.

**Fix:** store an implementation evidence record per lab: challenge version, passed checks, completion time, whether the solution was revealed first, and the learner-code fingerprint. Invalidate or mark it stale when the challenge version or saved code changes.

### P1 — the implementation worker counts setup time as execution time

The lesson-notebook runtime starts its deadline only when Python reports `running`. The separate implementation challenge starts its 90-second timer immediately after posting the job, while Pyodide and packages may still be downloading.

The implementation worker is also terminated after every completed run. Browser caching reduces network cost, but Pyodide still has to initialize again for the next check.

**Fix:** give implementation jobs explicit `loading` and `running` states, start the deadline on `running`, and keep one idle worker alive for a bounded period. Reuse the established notebook runtime pattern where practical.

### P1 — “mastery” progress currently means checkpoint count

The prominent progress display counts passed lesson checkpoints only. Practice ladders, delayed returns, notebook work, explanations, implementation checks, and capstones do not contribute to the path summary.

The copy correctly says checkpoints are not certification, but the page is titled “mastery path,” so the visual progress signal is still too narrow.

**Fix:** show separate evidence lanes instead of one score:

- concepts checked;
- practice completed without help;
- delayed returns completed;
- implementation challenge passed;
- lab build or capstone artifact completed;
- reflection or report exported.

A lab should be “reviewed,” “practiced,” or “demonstrated,” with each term defined. Avoid a single mastery percentage.

### P1 — progress has no complete backup and restore path

Progress, code, journals, ladders, and notebook drafts live in browser storage. The current lab can export notes and checkpoints, individual notebooks can export `.ipynb`, and implementation code can be downloaded, but there is no whole-course export/import.

For a long program with 317 lesson checkpoints, losing a browser profile would be costly.

**Fix:** add versioned “Export all ML Lab progress” and “Import ML Lab progress” actions. Include checkpoint evidence, ladder evidence, implementation records, journals, code drafts, notebook drafts, current position, and schema version. Preview conflicts before replacing local data.

### P1 — two seeded engines still use engine-dependent shuffling

The README says seeded playgrounds are reproducible, while the current code still contains `sort(() => rng() - 0.5)` in Labs 22 and 55. Comparator-based random shuffles can produce different orders between JavaScript engines.

The status file says Labs 10, 22, and 55 remain; Lab 10 no longer contains this pattern, so the status is stale.

**Fix:** replace the two remaining comparator shuffles with the shared Fisher–Yates helper, then deliberately update affected expected values, prose, figures, ladder probes, and browser evidence.

### P2 — the path is comprehensive but visually overwhelming

The learning-path page renders all 61 labs and all phases in one long document. The current lab expands its lessons, but every lab card and every advanced stage is still present. The 61-item lab selector has the same scale problem.

**Fix:** lead with “Continue,” the current stage, the next three labs, and due practice. Collapse later stages by default. Group the lab selector by phase and add search. Make optional and advanced tracks visibly separate choices after the core.

### P2 — lessons are not deep-linkable

The browser remains at `#/labs`; the selected lab, lesson, and workspace tab are component state plus local storage. A learner cannot bookmark Lab 22 Lesson 3, share it, or use browser Back to retrace lesson navigation.

**Fix:** define stable routes or query state for lab, lesson, and tab. Preserve the existing local resume behavior as a fallback. Add redirects if identifiers change.

### P2 — the course needs a first-visit orientation separate from Lesson 00a

Lesson 00a explains Python cells well, but a first-time learner still lands inside a dense three-column workspace before receiving a short explanation of the entire learning loop.

**Fix:** add a dismissible first-visit start card with four actions:

1. Start from zero.
2. Check prerequisites and place me.
3. Resume my last work.
4. Browse the full path.

Explain the Learn → Practice → Implement → Return loop, local progress storage, expected time, and which tracks are optional.

### P2 — there are no cumulative stage gates

Every lab has evidence, but the path has no fresh cumulative diagnostic at the end of a stage. A learner can complete local tasks without proving transfer across labs.

**Fix:** add a short stage gate after Labs 3, 7, 16, 19, 27, and 33. Each should use fresh data and require explanation, diagnosis, and a small implementation. Use the result to recommend review; do not lock later content.

### P2 — capstones need a consistent portfolio contract

The capstone content is strong, but the path does not give one consistent artifact checklist across the tabular, deep-learning, and final projects.

**Fix:** standardize a downloadable project record: question, data permission, split policy, baseline, experiments, chosen model, error analysis, limitations, reproducibility details, model card, deployment contract, and maintenance plan.

### P2 — contributor-facing ML documentation has drifted

Before this audit, the README said only Labs 01–19 and 37 used ordered blocks even though the status file says every lab now does. The status introduction also said Labs 09–19 had no notebooks, then immediately documented those notebooks as complete.

**Fix:** keep a concise current-state section and move dated implementation history below it. Add an automated registry-derived summary test so hand-written counts and capability claims cannot silently drift.

### P3 — network readiness could be clearer

The first Python run depends on a CDN download. The lesson explains this, but there is no early readiness check or offline state before the learner reaches a run button.

**Fix:** show a small Python readiness indicator, distinguish offline/download/runtime/code errors, and offer non-running lesson content when Python is unavailable.

### P3 — real beginner validation is still missing

The automated checks prove internal consistency and catch many UI failures. They cannot show where a new learner becomes confused, stops reading, or misunderstands a successful result.

**Fix:** run five observed sessions with learners who know basic arithmetic and little or no Python. Give them Lab 01 without coaching. Record time to first successful cell, first prediction, first explanation, first checkpoint, and first implementation attempt. Convert repeated confusion into tests or copy changes.

## Recommended order

### Phase A — trust the runtime and evidence (about 2–4 focused days)

1. Persist implementation results with versioned evidence.
2. Start implementation timeouts after package loading and reuse the worker.
3. Replace the two non-deterministic shuffles and update their checked numbers.
4. Add full-course progress export/import.

### Phase B — make the path feel manageable (about 2–4 focused days)

1. Add the first-visit start card and placement entry.
2. Collapse future stages and expose current, next, and due work first.
3. Group and search the lab picker.
4. Add stable lab, lesson, and tab links.

### Phase C — connect completion to transfer (about 4–8 focused days)

1. Add multi-lane evidence summaries.
2. Add fresh cumulative stage gates.
3. Standardize capstone portfolio exports.
4. Add regression tests for progress migration, evidence invalidation, and deep links.

### Phase D — validate with people (recurring)

Run the first five beginner sessions after Phase B, fix repeated problems, then repeat at the first classical-model lab and first neural-network lab.

## Release recommendation

The current lab is suitable for continued use and content testing. Treat it as a complete curriculum with a strong practice environment. Reserve “zero-to-mastery system” for the point when implementation evidence, progress backup, cumulative transfer tasks, and first-time learner validation are in place.
