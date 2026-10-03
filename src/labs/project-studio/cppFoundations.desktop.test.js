// Walks "C++ from Zero — Tools of the Trade" the way a learner would, in a fresh temporary
// project folder: every step's file is typed in (or created, for a provided file), the commands
// the lesson tells the learner to run are run in the terminal's shell, and then every check on
// the step must pass.
//
// Before each step, deliberately wrong answers are tried on a copy of the project, and the named
// checks must FAIL. A check that passes a wrong answer is a bug in the lesson.
//
// Needs a C++ compiler reachable as g++ (a system one, or the app's toolchain on PATH), and CMake
// for the CMake lesson. Runs on Windows (PowerShell, as in the app), macOS and Linux.
import { afterAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TRACKS } from './trackLoader.js';
import { WALKTHROUGH } from './tracks/cpp-foundations.walkthrough.js';

const require = createRequire(import.meta.url);
const { runChecks, shellRun } = require('../../../desktop/app/project-checks.cjs');
const { shellEnv } = require('../../../desktop/app/terminal.cjs');

const lessons = TRACKS['cpp-foundations'] ?? [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cpp-foundations-walk-'));
const project = path.join(tmp, 'cpp-foundations');
fs.mkdirSync(project);
afterAll(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} });

// CPP_TOOLCHAIN_BIN=<folder>: walk with the app's own toolchain (its llvm-mingw bin folder),
// appended to PATH exactly as the app does for its terminals and checks.
const env = await shellEnv({ extraPath: [process.env.CPP_TOOLCHAIN_BIN] });
const has = async (cmd) => (await shellRun(cmd, { cwd: tmp, env, timeoutMs: 30000 })).code === 0;
const hasCompiler = await has('g++ --version');
const hasCMake = await has('cmake --version');

async function perform(dir, step, action = {}) {
  if (step.file && step.target != null && action.typeFile !== false) {
    fs.writeFileSync(path.join(dir, step.file), step.target + '\n');
  }
  for (const [rel, pairs] of Object.entries(action.editFiles ?? {})) {
    let content = fs.readFileSync(path.join(dir, rel), 'utf8');
    for (const [from, to] of pairs) {
      if (!content.includes(from)) throw new Error(`Walkthrough edit not found in ${rel}: ${from}`);
      content = content.replace(from, to);
    }
    fs.writeFileSync(path.join(dir, rel), content);
  }
  for (const [rel, content] of Object.entries(action.files ?? {})) {
    fs.writeFileSync(path.join(dir, rel), content);
  }
  for (const cmd of action.run ?? []) {
    const r = await shellRun(cmd, { cwd: dir, env, timeoutMs: 180000 });
    if (r.code !== 0 && !action.allowFailure) throw new Error(`Walkthrough command failed: ${cmd}\n${r.stdout}\n${r.stderr}`);
  }
}

function describeResults(checks, results) {
  return results.map((r, i) => `${r.pass ? 'PASS' : 'FAIL'} ${checks[i].label}${r.pass ? '' : `\n     ${String(r.detail).split('\n').join('\n     ')}`}`).join('\n');
}

describe('C++ from Zero track', () => {
  it('has five lessons, and every walkthrough entry names a real step', () => {
    expect(lessons.map((l) => l.id.split('/')[1])).toEqual([
      '01-first-program', '02-reading-errors', '03-compiler-and-linker', '04-cmake', '05-first-crash',
    ]);
    const keys = new Set(lessons.flatMap((l) => l.steps.map((s) => `${l.id.split('/')[1]}#${s.title}`)));
    for (const key of Object.keys(WALKTHROUGH)) expect(keys, `walkthrough key "${key}"`).toContain(key);
  });

  it('gives every step that changes code a check', () => {
    for (const lesson of lessons) {
      for (const step of lesson.steps) {
        if (step.file) expect(step.checks.length, `${lesson.title} / ${step.title}`).toBeGreaterThan(0);
      }
    }
  });
});

describe.skipIf(!hasCompiler)('C++ from Zero walkthrough', () => {
  for (const lesson of lessons) {
    const lessonKey = lesson.id.split('/')[1];
    const needsCMake = lessonKey === '04-cmake';
    it.skipIf(needsCMake && !hasCMake)(lesson.title, async () => {
      for (const step of lesson.steps) {
        const action = WALKTHROUGH[`${lessonKey}#${step.title}`] ?? {};

        for (const wrong of action.wrong ?? []) {
          const copy = path.join(tmp, `wrong-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
          // A CMake build folder records its source folder's absolute path, so a copied one
          // would still build the original. Wrong answers that need one configure their own.
          fs.cpSync(project, copy, { recursive: true, filter: (src) => path.basename(src) !== 'build-cmake' });
          try {
            await perform(copy, step, { typeFile: false, ...wrong, allowFailure: true });
            const res = await runChecks(copy, step.checks, { env });
            const failed = res.results.map((r, i) => (r.pass ? null : i)).filter((i) => i != null);
            for (const i of wrong.fails) {
              expect(failed, `${lesson.title} / ${step.title}: wrong answer "${wrong.name}" should fail check "${step.checks[i]?.label}"\n${describeResults(step.checks, res.results)}`).toContain(i);
            }
          } finally {
            fs.rmSync(copy, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
          }
        }

        await perform(project, step, action);
        if (step.checks.length) {
          const res = await runChecks(project, step.checks, { env });
          expect(res.results.every((r) => r.pass), `${lesson.title} / ${step.title}\n${describeResults(step.checks, res.results)}`).toBe(true);
        }
      }
    }, 600000);
  }
});
