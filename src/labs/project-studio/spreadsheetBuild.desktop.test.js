// Walks the "Build a Spreadsheet" track the way a learner would, in a fresh temporary project
// folder: every step's file is typed in (its target content written), the commands the lesson
// tells the learner to run are run in PowerShell, and then every check on the step must pass.
//
// Then, for steps with checks, deliberately wrong answers are tried on a copy of the project
// as it was at that step, and the named checks must FAIL. A check that passes a wrong answer
// is a bug in the lesson.
//
// Needs Windows (the lessons' commands are PowerShell), Python, Node and Git. `page` checks
// run in Playwright's Chromium.
import { afterAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { TRACKS } from './trackLoader.js';
import { WALKTHROUGH } from './tracks/spreadsheet-build.walkthrough.js';

const require = createRequire(import.meta.url);
const { runChecks, shellRun } = require('../../../desktop/app/project-checks.cjs');
const { shellEnv } = require('../../../desktop/app/terminal.cjs');

const isWindows = process.platform === 'win32';
const lessons = TRACKS['spreadsheet-build'] ?? [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spreadsheet-walk-'));
const project = path.join(tmp, 'spreadsheet');
fs.mkdirSync(project);

afterAll(() => {
  // WALKTHROUGH_KEEP=<folder> keeps a copy of the finished project, to record a later lesson's
  // commands in a project that really went through every earlier step.
  if (process.env.WALKTHROUGH_KEEP) {
    fs.rmSync(process.env.WALKTHROUGH_KEEP, { recursive: true, force: true });
    fs.cpSync(project, process.env.WALKTHROUGH_KEEP, { recursive: true });
    fs.copyFileSync(globalConfig, `${process.env.WALKTHROUGH_KEEP}.gitconfig`);
  }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
});

// The walkthrough learner starts with no Git settings of their own: `git config --global` writes
// to this file instead of the real user's ~/.gitconfig. (The system-wide settings of Git for
// Windows, such as core.autocrlf, still apply, as they would for a new learner.)
const globalConfig = path.join(tmp, 'learner.gitconfig');
fs.writeFileSync(globalConfig, '');
// GitHub, for lesson 1.8: a bare repository on disk. "{BARE}" in a command means its path.
const bare = path.join(tmp, 'github-spreadsheet.git').replace(/\\/g, '/');

let baseEnv;
async function getEnv(configFile = globalConfig) {
  if (!baseEnv) {
    baseEnv = await shellEnv();
    for (const k of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'GIT_DIR', 'GIT_WORK_TREE']) delete baseEnv[k];
  }
  return { ...baseEnv, GIT_CONFIG_GLOBAL: configFile, GIT_PAGER: 'cat' };
}

// Do what the learner does for a step: type its file, apply extra files, run its commands.
async function perform(dir, step, action = {}, configFile = globalConfig) {
  // before: commands the learner runs before typing the step's file (e.g. git mv, then edit).
  await runCommands(dir, action.before ?? [], action, configFile);
  if (step.file && step.target != null && action.typeFile !== false) {
    const abs = path.join(dir, step.file);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, step.target + '\n');
  }
  // edit: [[from, to], ...] applied to the step's own target, written to the step's file.
  if (action.edit) {
    let content = step.target + '\n';
    for (const [from, to] of action.edit) {
      if (!content.includes(from)) throw new Error(`Walkthrough edit not found in ${step.file}: ${from}`);
      content = content.replace(from, to);
    }
    fs.writeFileSync(path.join(dir, step.file), content);
  }
  // editFiles: { rel: [[from, to], ...] } applied to a file as it is in the project now.
  for (const [rel, pairs] of Object.entries(action.editFiles ?? {})) {
    let content = fs.readFileSync(path.join(dir, rel), 'utf8');
    for (const [from, to] of pairs) {
      if (!content.includes(from)) throw new Error(`Walkthrough edit not found in ${rel}: ${from}`);
      content = content.replace(from, to);
    }
    fs.writeFileSync(path.join(dir, rel), content);
  }
  for (const [rel, content] of Object.entries(action.files ?? {})) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  await runCommands(dir, action.run ?? [], action, configFile);
}

async function runCommands(dir, commands, action, configFile) {
  for (const raw of commands) {
    const cmd = raw.replaceAll('{BARE}', bare);
    const r = await shellRun(cmd, { cwd: dir, env: { ...(await getEnv(configFile)), ...(action.env ?? {}) }, timeoutMs: 120000 });
    if (r.code !== 0 && !action.allowFailure) {
      throw new Error(`Walkthrough command failed: ${cmd}\n${r.stdout}\n${r.stderr}`);
    }
  }
}

// `page` checks: in the app a hidden Electron window loads the learner's page; here Playwright's
// Chromium does the same job (both are Chromium).
let browser;
async function evalInPage(target, expr, { timeoutMs = 15000 } = {}) {
  if (!browser) {
    const { chromium } = require('playwright');
    browser = await chromium.launch();
  }
  const page = await browser.newPage();
  const errors = [];
  const logs = [];
  page.on('console', (m) => { logs.push(m.text()); if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => { logs.push(String(e.message)); errors.push(String(e.message)); });
  try {
    const url = /^https?:\/\//.test(target) ? target : pathToFileURL(target).href;
    try {
      await page.goto(url, { timeout: timeoutMs });
    } catch (e) {
      return { ok: false, reason: `The page didn't load: ${e.message}`, errors, logs };
    }
    await page.waitForTimeout(50);
    try {
      const value = await page.evaluate(`(async () => (${expr}))()`);
      return { ok: true, value: value === undefined ? null : value, errors, logs };
    } catch (e) {
      return { ok: false, reason: `Checking \`${expr}\` on the page failed: ${String(e.message).split('\n')[0]}`, errors, logs };
    }
  } finally {
    await page.close();
  }
}
afterAll(async () => { await browser?.close(); });

const runnable = (checks) => checks;

function describeResults(checks, results) {
  return results.map((r, i) => `${r.pass ? 'PASS' : 'FAIL'} ${checks[i].label}${r.pass ? '' : `\n     ${String(r.detail).split('\n').join('\n     ')}`}`).join('\n');
}

describe.skipIf(!isWindows)('Build a Spreadsheet walkthrough', () => {
  it('has lessons, and every walkthrough entry names a real step', async () => {
    const r = await shellRun(`git init -q --bare "${bare}"`, { cwd: tmp, env: await getEnv(), timeoutMs: 30000 });
    expect(r.code).toBe(0);
    expect(lessons.length).toBeGreaterThan(0);
    const keys = new Set(lessons.flatMap((l) => l.steps.map((s) => `${l.id.split('/')[1]}#${s.title}`)));
    for (const key of Object.keys(WALKTHROUGH)) expect(keys, `walkthrough key "${key}"`).toContain(key);
  });

  for (const lesson of lessons) {
    const lessonKey = lesson.id.split('/')[1];
    it(`${lesson.title}`, async () => {
      for (const step of lesson.steps) {
        const action = WALKTHROUGH[`${lessonKey}#${step.title}`] ?? {};
        const checks = runnable(step.checks);

        // Wrong answers first, each on a copy of the project as it was before this step.
        for (const wrong of action.wrong ?? []) {
          const copy = path.join(tmp, `wrong-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
          fs.cpSync(project, copy, { recursive: true });
          // Its own copy of the learner's Git settings and of "GitHub", so a wrong answer can't
          // change what the real walkthrough sees.
          const copyConfig = `${copy}.gitconfig`;
          fs.copyFileSync(globalConfig, copyConfig);
          try {
            await perform(copy, step, { typeFile: false, ...wrong, allowFailure: true }, copyConfig);
            const res = await runChecks(copy, checks, { env: await getEnv(copyConfig), evalInPage });
            const failed = res.results.map((r, i) => (r.pass ? null : i)).filter((i) => i != null);
            for (const i of wrong.fails) {
              expect(failed, `${lesson.title} / ${step.title}: wrong answer "${wrong.name}" should fail check "${checks[i]?.label}"\n${describeResults(checks, res.results)}`).toContain(i);
            }
          } finally {
            fs.rmSync(copy, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
            fs.rmSync(copyConfig, { force: true });
          }
        }

        await perform(project, step, action);
        if (checks.length) {
          const res = await runChecks(project, checks, { env: await getEnv(), evalInPage });
          expect(res.results.every((r) => r.pass), `${lesson.title} / ${step.title}\n${describeResults(checks, res.results)}`).toBe(true);
        }
      }
    }, 300000);
  }
});
