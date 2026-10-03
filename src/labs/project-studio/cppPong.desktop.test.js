import { afterAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TRACKS, TRACK_KEYS, trackTitle, getSupportFiles } from './trackLoader.js';

const require = createRequire(import.meta.url);
const cpp = require('../../../desktop/app/runtimes/cpp.cjs');
const { runChecks } = require('../../../desktop/app/project-checks.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pong-lesson-'));
const app = { getPath: () => root };
const status = await cpp.getStatus(app);
const lesson = TRACKS['cpp-game']?.[0];
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('classic C++ game discovery', () => {
  it('adds Pong without changing the established default tracks', () => {
    expect(TRACK_KEYS.slice(0, 2)).toEqual(['spreadsheet-build', 'pyside6-engine']);
    expect(trackTitle('cpp-game')).toBe('Classic Games in C++ — Pong');
    expect(lesson.runtime).toBe('cpp');
    expect(lesson.run).toBe('main.cpp');
    expect(lesson.steps).toHaveLength(9);
    expect(lesson.steps.every(s => s.file === 'main.cpp')).toBe(true);
    expect(lesson.steps[0].provided).toBe(true);
    expect(lesson.meta.reference).toBe('optional');
    expect(lesson.steps.every(s => !s.extraTargets?.length)).toBe(true);
  });
});

describe.skipIf(process.platform !== 'win32' || !status.installed)('Pong lesson on the real desktop compiler', () => {
  it('builds every runnable step and runs all final checks in a fresh project', async () => {
    for (const step of lesson.steps) {
      if (step.provided) for (const file of getSupportFiles('cpp-game', lesson.meta.support)) {
        fs.writeFileSync(path.join(root, file.file), file.content);
      }
      fs.writeFileSync(path.join(root, step.file), step.target);
      if (step.file === 'main.cpp') await cpp.projectCommand(app, path.join(root, 'main.cpp'), root);
      const result = await runChecks(root, step.checks);
      expect(result.ok).toBe(true);
      expect(result.results.filter(r => !r.pass)).toEqual([]);
    }
  }, 60000);

  it('tests the taught input and boundary rules independently of textual checks', async () => {
    fs.writeFileSync(path.join(root, 'main.cpp'), lesson.steps.at(-1).target);
    const probe = `#define main lesson_main
#include "main.cpp"
#undef main
int main() {
    GameState game;
    update(game, Input{}); if (game.leftY != 160) return 1;
    Input input; input.leftDown = true;
    update(game, input); if (game.leftY != 162) return 2;
    input.leftDown = false; input.leftUp = true;
    update(game, input); if (game.leftY != 160) return 3;
    input.leftDown = true;
    update(game, input); if (game.leftY != 160) return 4;
    game.leftY = 1; input.leftDown = false;
    update(game, input); if (game.leftY != 0) return 5;
    game.leftY = 319; input.leftUp = false; input.leftDown = true;
    update(game, input); if (game.leftY != 320) return 6;
    if (game.rightY != 160 || game.ballX != 314 || game.ballY != 194) return 7;
}`;
    fs.writeFileSync(path.join(root, 'paddle-probe.cpp'), probe);
    const command = await cpp.projectCommand(app, path.join(root, 'paddle-probe.cpp'), root);
    expect(execFileSync(command.command, [], { windowsHide: true, timeout: 10000 }).toString()).toBe('');
    const broken = lesson.steps.at(-1).target.replace('game.leftY = 0;', 'game.leftY = -1;');
    fs.writeFileSync(path.join(root, 'main.cpp'), broken);
    const invalid = await cpp.projectCommand(app, path.join(root, 'paddle-probe.cpp'), root);
    expect(() => execFileSync(invalid.command, [], { windowsHide: true, timeout: 10000 })).toThrow();
  }, 60000);

  it('checks both paddles, four boundaries, both goals, and native window events independently', async () => {
    // Preserve the earlier playable prototype as an optional reference, outside
    // the beginner lesson. Its mechanics still receive independent coverage.
    fs.writeFileSync(path.join(root, 'main.cpp'), getSupportFiles('cpp-game', 'rally-reference.cpp')[0].content);
    const probe = `#include <windows.h>
// Create the real native window hidden during this automated smoke test.
#define ShowWindow(window, command) ShowWindow(window, SW_HIDE)
#define main lesson_main
#include "main.cpp"
#undef main
#undef ShowWindow
#include <iostream>
int ticks = 0;
void smokeUpdate(GameState& game, const Input& input) {
    update(game, input);
    HWND window = FindWindowA("UpSkillOSPong", nullptr);
    if (++ticks == 3) {
        SendMessageA(window, WM_PAINT, 0, 0);
        SendMessageA(window, WM_KEYDOWN, VK_ESCAPE, 0);
    }
}
int main() {
    if (movePaddle(100, true, false) != 95 || movePaddle(100, false, true) != 105) return 1;
    if (movePaddle(100, true, true) != 100) return 2;
    GameState g;
    Input keys; keys.leftUp = true; keys.rightDown = true;
    update(g, keys);
    if (g.leftY != 155 || g.rightY != 165 || g.ballX != 318 || g.ballY != 197) return 3;
    g = GameState{}; g.ballY = 388; g.velocityY = 3;
    update(g, Input{}); if (g.ballY != 388 || g.velocityY != -3) return 4;
    g = GameState{}; g.ballY = 0; g.velocityY = -3;
    update(g, Input{}); if (g.ballY != 0 || g.velocityY != 3) return 5;
    g = GameState{}; g.ballX = rightX - ballSize; g.ballY = 180;
    update(g, Input{}); if (g.velocityX != -4 || g.ballX != rightX - ballSize) return 6;
    g = GameState{}; g.ballX = leftX + paddleWidth; g.ballY = 180; g.velocityX = -4;
    update(g, Input{}); if (g.velocityX != 4 || g.ballX != leftX + paddleWidth) return 7;
    g = GameState{}; g.ballX = courtWidth; g.ballY = 20;
    update(g, Input{}); if (g.leftScore != 1 || g.rightScore != 0 || g.ballX != 314) return 8;
    g = GameState{}; g.ballX = -ballSize; g.ballY = 20; g.velocityX = -4;
    update(g, Input{}); if (g.rightScore != 1 || g.leftScore != 0 || g.ballX != 314) return 9;
    update(g, Input{}); if (g.rightScore != 1) return 10;
    g = GameState{};
    if (runGame(g, smokeUpdate) != 0 || ticks != 3) return 11;
    std::cout << "rules-and-window-ok";
}`;
    fs.writeFileSync(path.join(root, 'probe.cpp'), probe);
    const command = await cpp.projectCommand(app, path.join(root, 'probe.cpp'), root);
    expect(execFileSync(command.command, [], { cwd: root, windowsHide: true, timeout: 10000 }).toString()).toBe('rules-and-window-ok');
  }, 60000);

  it('opens a visible lesson window with the actual project launch setting', async () => {
    fs.writeFileSync(path.join(root, 'game.h'), getSupportFiles('cpp-game', 'game.h')[0].content);
    fs.writeFileSync(path.join(root, 'visible.cpp'), `#include "game.h"
int ticks = 0;
bool visible = false;
void update(GameState&, const Input&) {
    HWND window = FindWindowA("UpSkillOSPong", nullptr);
    visible = IsWindowVisible(window) != 0;
    if (++ticks == 3) SendMessageA(window, WM_KEYDOWN, VK_ESCAPE, 0);
}
int main() {
    GameState game;
    int result = runGame(game, update);
    return result == 0 && visible && ticks == 3 ? 0 : 1;
}`);
    const command = await cpp.projectCommand(app, path.join(root, 'visible.cpp'), root);
    expect(command.windowsHide).toBe(false);
    expect(() => execFileSync(command.command, command.args, { cwd: root, windowsHide: command.windowsHide, timeout: 10000 })).not.toThrow();
  }, 60000);

  it('fails the supplied check when a paddle return is broken', async () => {
    const final = getSupportFiles('cpp-game', 'rally-reference.cpp')[0].content;
    const broken = final.replace('game.ballX = leftX + paddleWidth;\n        game.velocityX = -game.velocityX;', 'game.ballX = leftX + paddleWidth;');
    expect(broken).not.toBe(final);
    fs.writeFileSync(path.join(root, 'main.cpp'), broken);
    const command = await cpp.projectCommand(app, path.join(root, 'main.cpp'), root);
    expect(() => execFileSync(command.command, ['--check'], { windowsHide: true })).toThrow();
    fs.writeFileSync(path.join(root, 'main.cpp'), final);
  }, 60000);
});
