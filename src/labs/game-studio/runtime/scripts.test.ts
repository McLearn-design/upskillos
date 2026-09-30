import { describe, expect, it } from 'vitest';
import { checkSyntax, importOrder, locate, resolveImport, rewriteImports } from './scripts';

describe('script imports', () => {
  it('resolve relative and project paths, and refuse anything else with a reason', () => {
    expect(resolveImport('scripts/player.js', './util.js')).toBe('scripts/util.js');
    expect(resolveImport('scripts/enemies/bat.js', '../util')).toBe('scripts/util.js');
    expect(resolveImport('scripts/player.js', 'scripts/lib/math.js')).toBe('scripts/lib/math.js');
    expect(resolveImport('scripts/player.js', 'phaser')).toEqual({ error: expect.stringMatching(/"phaser" cannot be imported[\s\S]*project scripts/) });
  });

  it('order scripts after what they import, and name a missing file or a circle', () => {
    const s = (path: string, source: string) => ({ path, source });
    const { order } = importOrder([
      s('scripts/player.js', "import { clamp } from './util.js';\nexport default class Player {}"),
      s('scripts/util.js', "export { lerp } from './lerp.js';\nexport const clamp = (v) => v;"),
      s('scripts/lerp.js', 'export const lerp = (a, b, t) => a + (b - a) * t;'),
    ]);
    expect(order).toEqual(['scripts/lerp.js', 'scripts/util.js', 'scripts/player.js']);
    expect(() => importOrder([s('scripts/a.js', "import './b.js'")])).toThrow(/no scripts\/b.js in the project/);
    expect(() => importOrder([s('scripts/a.js', "import './b.js'"), s('scripts/b.js', "import x from './a.js'")])).toThrow(/circle: scripts\/a.js → scripts\/b.js → scripts\/a.js/);
  });

  it('rewrite only the specifiers, keeping every line in place so errors keep their line numbers', () => {
    const src = "import { clamp } from './util.js';\nconst m = await import(\"./util.js\");\nexport default class P {}";
    const out = rewriteImports(src, new Map([['./util.js', 'blob:null/abc']]));
    expect(out).toBe("import { clamp } from 'blob:null/abc';\nconst m = await import(\"blob:null/abc\");\nexport default class P {}");
    expect(out.split('\n')).toHaveLength(src.split('\n').length);
  });

  it('find the file, line and column of an error in Chromium and Firefox stack traces', () => {
    const names = (u: string) => (u === 'blob:null/1234' ? 'scripts/player.js' : null);
    expect(locate('Error: boom\n    at Player.update (blob:null/1234:12:9)\n    at Game.call (runtime.js:1:5)', names)).toEqual({ file: 'scripts/player.js', line: 12, column: 9 });
    expect(locate('update@blob:null/1234:3:7\ncall@runtime.js:1:5', names)).toEqual({ file: 'scripts/player.js', line: 3, column: 7 });
    expect(locate('    at Player.update (scripts/player.js:5:2)', names)).toEqual({ file: 'scripts/player.js', line: 5, column: 2 });
    expect(locate('    at runtime.js:1:5', names)).toBeNull();
  });

  it('find syntax errors before loading, with the line and column a browser would not give', () => {
    expect(checkSyntax([{ path: 'scripts/ok.js', source: "import { a } from './a.js';\nexport default class A extends Node2D { update(dt) { this.x ??= 1; } }" }])).toEqual([]);
    expect(checkSyntax([{ path: 'scripts/bad.js', source: 'export default class P {\n  update(dt) {\n    this.x = ;\n  }\n}' }]))
      .toEqual([{ file: 'scripts/bad.js', line: 3, column: 14, message: 'Unexpected token' }]);
  });
});
