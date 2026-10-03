import { afterAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const cpp = require('../../../desktop/app/runtimes/cpp.cjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cpp-project-studio-'));
const app = { getPath: () => tmp };
const status = await cpp.getStatus(app);
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('Project Studio C++ compiler adapter', () => {
  it('rejects non-C++ entry files before compiling', async () => {
    await expect(cpp.projectCommand(app, path.join(tmp, 'main.py'))).rejects.toThrow('Choose a C++ source file');
  });

  it('returns unavailable without downloading or invoking a compiler', async () => {
    const filename = require.resolve('../../../desktop/app/runtimes/cpp.cjs');
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      module, process,
      require: (name) => name === './_toolchains.cjs'
        ? { systemCpp: async () => ({ found: null }) }
        : name === './_shared.cjs' ? { findFile: async () => null } : require(name),
    });
    expect(await module.exports.projectCommand(app, path.join(tmp, 'main.cpp'))).toBeNull();
  });

  it.skipIf(!status.installed)('builds persistent source with sibling headers and spaces in the project path', async () => {
    const root = path.join(tmp, 'project with spaces');
    const source = path.join(root, 'src', 'main.cpp');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'score.h'), 'constexpr int score = 7;\n');
    fs.writeFileSync(source, '#include "score.h"\n#include <iostream>\nint main() { std::cout << "score=" << score; }\n');
    const command = await cpp.projectCommand(app, source, root);
    expect(command.command).toBe(path.join(root, 'build', 'main.exe'));
    expect(command.windowsHide).toBe(false);
    expect(execFileSync(command.command, command.args, { cwd: root, windowsHide: true }).toString()).toBe('score=7');
    expect(fs.readFileSync(source, 'utf8')).toContain('#include "score.h"');
    // Rebuild from the edited disk file, not a notebook scratch copy.
    fs.writeFileSync(path.join(root, 'src', 'score.h'), 'constexpr int score = 9;\n');
    const rebuilt = await cpp.projectCommand(app, source, root);
    expect(execFileSync(rebuilt.command, [], { windowsHide: true }).toString()).toBe('score=9');
    fs.writeFileSync(source, 'this is not C++;');
    await expect(cpp.projectCommand(app, source, root)).rejects.toThrow('C++ build failed');
    expect(fs.existsSync(command.command)).toBe(false);
  }, 60000);
});

describe('project filesystem runtime handoff', () => {
  it('stops a live project process by its run id and reports its exit', async () => {
    const root = path.join(tmp, 'stoppable-project');
    const data = path.join(tmp, 'stoppable-data');
    fs.mkdirSync(root); fs.mkdirSync(data);
    fs.writeFileSync(path.join(root, 'main.cpp'), 'int main() {}');
    fs.writeFileSync(path.join(data, 'project-config.json'), JSON.stringify({ projectRoot: root }));
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve('../../../desktop/app/project-fs.cjs'), 'utf8'), {
      module, process, console,
      require: name => name === 'electron' ? { dialog: {} } : require(name),
    });
    const project = module.exports;
    let resolveExit;
    const exited = new Promise(resolve => { resolveExit = resolve; });
    const res = await project.runProjectFile({ getPath: () => data }, {
      cpp: { projectCommand: async () => ({ command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'], windowsHide: false }) },
    }, 'cpp', 'main.cpp', evt => { if (evt.stream === 'exit') resolveExit(evt); });
    try {
      expect(res.ok).toBe(true);
      expect(project.killProjectRun('unknown')).toBe(false);
      expect(project.killProjectRun(res.runId)).toBe(true);
      expect((await exited).runId).toBe(res.runId);
      expect(project.killProjectRun(res.runId)).toBe(false);
    } finally { project.killAllProjectRuns(); }
  });
  it('passes the picked root to an adapter and retains unsupported runtime behavior', async () => {
    const root = path.join(tmp, 'picked project');
    const data = path.join(tmp, 'user-data');
    fs.mkdirSync(root);
    fs.mkdirSync(data);
    fs.writeFileSync(path.join(root, 'main.cpp'), 'int main() {}');
    fs.writeFileSync(path.join(data, 'project-config.json'), JSON.stringify({ projectRoot: root }));
    const filename = require.resolve('../../../desktop/app/project-fs.cjs');
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      module, process, console,
      require: (name) => name === 'electron' ? { dialog: {} } : require(name),
    });
    const project = module.exports;
    const calls = [];
    const pickedApp = { getPath: () => data };
    const runtimes = { cpp: { projectCommand: async (...args) => { calls.push(args); return null; } } };
    expect(await project.runProjectFile(pickedApp, runtimes, 'cpp', 'main.cpp')).toMatchObject({ ok: false });
    expect(calls[0]).toEqual([pickedApp, path.join(root, 'main.cpp'), root]);
    expect(await project.runProjectFile(pickedApp, runtimes, 'other', 'main.cpp')).toMatchObject({ ok: false, reason: 'Running project files isn\'t supported for "other" yet' });
    await project.runProjectFile(pickedApp, runtimes, 'cpp', '../outside.cpp');
    expect(calls).toHaveLength(1);
  });
});
