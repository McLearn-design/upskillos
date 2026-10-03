// The app-managed C++ toolchain (llvm-mingw) lives in the app's own data folder, not on the
// learner's PATH. Terminals and step checks append its bin folder, so `g++ hello.cpp` typed in a
// lesson finds the compiler the Run button uses, and the program it builds finds libc++.dll.
import { afterAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { shellEnv } = require('../../../desktop/app/terminal.cjs');
const cpp = require('../../../desktop/app/runtimes/cpp.cjs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cpp-toolchain-path-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const pathOf = (env) => env[Object.keys(env).find((k) => k.toLowerCase() === 'path')];

describe('terminal and check PATH', () => {
  it('appends extra folders after the learner’s own PATH', async () => {
    const env = await shellEnv({ extraPath: [path.join(tmp, 'toolchain', 'bin')] });
    const entries = pathOf(env).split(path.delimiter);
    expect(entries.at(-1)).toBe(path.join(tmp, 'toolchain', 'bin'));
    expect(entries.length).toBeGreaterThan(1);
  });

  it('leaves PATH alone when there is nothing to add', async () => {
    const plain = await shellEnv();
    expect(pathOf(await shellEnv({ extraPath: [null] }))).toBe(pathOf(plain));
  });
});

describe('C++ toolchain bin folder', () => {
  it('is null before the app installs its compiler', async () => {
    expect(await cpp.toolchainBinDir({ getPath: () => path.join(tmp, 'empty') })).toBeNull();
  });

  it('is the folder holding the installed g++', async () => {
    const userData = path.join(tmp, 'user-data');
    const bin = path.join(userData, 'runtimes', 'cpp', 'llvm-mingw-x', 'bin');
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(bin, 'x86_64-w64-mingw32-g++.exe'), '');
    expect(await cpp.toolchainBinDir({ getPath: () => userData })).toBe(bin);
  });
});
