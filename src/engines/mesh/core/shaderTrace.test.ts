import { describe, expect, it } from 'vitest';
import { lintShaderBody, traceShaderAssembly } from './shaderTrace';
import { DEFAULT_CUSTOM, fragmentShader } from './shading';
import { Trace } from './trace';

describe('assembling a shader', () => {
  it('the body lands where the viewport\'s error mapping expects it', () => {
    const t = new Trace('Trace assembling the shader');
    const r = traceShaderAssembly('custom', DEFAULT_CUSTOM, false, t);
    const lines = fragmentShader('custom', DEFAULT_CUSTOM).split('\n');
    // Viewport: start = index of "vec3 shade(" + 2 (as a 1-based line number of the first body line).
    expect(r.bodyStart).toBe(lines.findIndex((l) => l.startsWith('vec3 shade(')) + 2);
    expect(lines[r.bodyStart - 1].trim()).toBe(DEFAULT_CUSTOM.split('\n')[0].trim());
    expect(lines[r.bodyEnd - 1].trim()).toBe(DEFAULT_CUSTOM.split('\n').at(-1)!.trim());
    expect(t.steps.map((s) => s.phase)).toEqual(['Frame', 'Your code', 'main()', 'Checks']);
  });

  it('every built-in model passes the checks; the usual mistakes do not', () => {
    for (const m of ['lambert', 'blinn-phong', 'toon', 'normals', 'uv'] as const) expect(traceShaderAssembly(m).lint).toEqual([]);
    expect(lintShaderBody(DEFAULT_CUSTOM)).toEqual([]);
    expect(lintShaderBody('float d = max(dot(N, L), 0.0)\nreturn base * d;').map((x) => x.message)).toEqual(['no semicolon at the end of the line']);
    expect(lintShaderBody('return base * 2;')[0].message).toMatch(/2\.0/);
    expect(lintShaderBody('float d = 1.0;').map((x) => x.message)).toEqual(['shade() must return a colour (a vec3)']);
    expect(lintShaderBody('return (base * 2.0;').some((x) => /never closed/.test(x.message))).toBe(true);
  });
});
