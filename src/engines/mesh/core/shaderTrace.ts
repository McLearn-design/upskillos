// Writing a shader (Object › Trace assembling the shader). A MeshLab material's GLSL is only the body of
// shade(N, L, V, uv, base, light); the app wraps it in a fixed frame (uniforms, varyings, main()) before the GPU
// compiles it. The compiler's error messages count lines of the whole program, so the app maps them back to lines
// of your body. This trace shows the assembly, where your lines land, and a few checks that catch the usual mistakes
// before compiling: brackets that do not match, no return, a missing semicolon, and whole numbers where GLSL wants
// floats (GLSL never turns 2 into 2.0 for you).

import { DEFAULT_CUSTOM, fragmentShader, type ShaderModel } from './shading';
import { Trace } from './trace';

export interface ShaderLint { line: number; message: string }

/** Checks that need no compiler. Lines are counted from 1 in the body. */
export function lintShaderBody(body: string): ShaderLint[] {
  const out: ShaderLint[] = [];
  const lines = body.split('\n');
  const code = (l: string) => l.replace(/\/\/.*$/, '');
  let round = 0, curly = 0;
  lines.forEach((raw, i) => {
    const l = code(raw), t = l.trim();
    for (const ch of l) { if (ch === '(') round++; if (ch === ')') round--; if (ch === '{') curly++; if (ch === '}') curly--; }
    if (round < 0) { out.push({ line: i + 1, message: 'a ) with no ( before it' }); round = 0; }
    if (t && !/[;{}]$/.test(t) && !/^(if|else|for|while)\b/.test(t) && !/^#/.test(t)) out.push({ line: i + 1, message: 'no semicolon at the end of the line' });
    // A whole number used in float arithmetic (GLSL ES does not convert int to float), outside array indices.
    const m = l.match(/(?:[*/+-]\s*|\(\s*|,\s*)(\d+)(?![.\w])/g);
    if (m && /\b(float|vec[234]|pow|mix|max|min|dot|smoothstep|step)\b|[*/]/.test(l) && !/\bint\b|\[/.test(l)) {
      for (const hit of m) { const n = hit.match(/\d+/)![0]; out.push({ line: i + 1, message: `${n} is a whole number: in float maths write ${n}.0` }); }
    }
  });
  if (round > 0) out.push({ line: lines.length, message: `${round} ( never closed` });
  if (curly !== 0) out.push({ line: lines.length, message: 'the { and } do not match' });
  if (!/\breturn\b/.test(body)) out.push({ line: lines.length, message: 'shade() must return a colour (a vec3)' });
  return out;
}

export interface ShaderAssembly { lines: number; bodyStart: number; bodyEnd: number; lint: ShaderLint[] }

export function traceShaderAssembly(model: Exclude<ShaderModel, 'pbr'>, customBody: string = DEFAULT_CUSTOM, flat = false, trace?: Trace): ShaderAssembly {
  const src = fragmentShader(model, customBody, flat), all = src.split('\n');
  // Line numbers as the compiler counts them (from 1); the body sits between "vec3 shade(" and its closing brace.
  const head = all.findIndex((l) => l.startsWith('vec3 shade(')), close = all.indexOf('}', head);
  // The body as written: the lines between "vec3 shade(...) {" and its "}", without the two spaces of indent.
  const body = all.slice(head + 1, close).map((l) => l.replace(/^ {2}/, '')).join('\n');
  const bodyLines = close - head - 1, bodyStart = head + 2, bodyEnd = close;
  const lint = lintShaderBody(body);
  if (trace) {
    const uniforms = all.filter((l) => l.startsWith('uniform ')).length, varyings = all.filter((l) => l.startsWith('varying ')).length;
    trace.step({
      phase: 'Frame', label: `The fixed frame: ${uniforms} uniforms, ${varyings} varyings, then shade() at line ${head + 1}`,
      detail: 'Uniforms are the same for every pixel: the material colour, the texture, the light\'s direction and colour, the sky and ground. Varyings are interpolated across each triangle from the vertex shader: the normal, the position and the UV. You only write the inside of shade().',
      values: [['uniforms', String(uniforms)], ['varyings', String(varyings)], ['program lines', String(all.length)]],
    });
    const probe = bodyStart + Math.min(2, bodyLines - 1);
    trace.step({
      phase: 'Your code', label: `Your ${bodyLines} line${bodyLines === 1 ? '' : 's'} become lines ${bodyStart}–${bodyEnd} of the program`,
      detail: `The compiler reports "ERROR: 0:n" with n counting the whole program. MeshLab finds the line where shade() starts and subtracts, so the message says "line … of your code" and points at your text. (three.js adds its own lines before this program, version and precision and definitions; MeshLab looks for shade() in the source as compiled, so the subtraction still lands on your line.)`,
      quiz: { prompt: `Your shade() body starts on line ${bodyStart} of the compiled program. The compiler reports an error on line ${probe}. Which line of your code is that?`, answer: [probe - bodyStart + 1], labels: ['your line'], rule: `Your line = program line − ${bodyStart - 1}.`, tolerance: 0 },
    });
    trace.step({
      phase: 'main()', label: 'main() gathers the inputs, calls shade(), and writes gl_FragColor',
      detail: `N = ${flat ? 'the face normal from the screen-space derivatives of the position (flat shading)' : 'the interpolated normal, normalised'}; flipped if the back of the face is showing. V points from the pixel to the camera, L to the sun. ambient blends ground and sky. base is the material colour times the texture. Your colour then goes through tone mapping and the sRGB encoding (three.js's tonemapping_fragment and colorspace_fragment).`,
    });
    trace.step({
      phase: 'Checks', label: lint.length ? `${lint.length} thing${lint.length === 1 ? '' : 's'} to fix before it will compile: ${lint.slice(0, 3).map((x) => `line ${x.line}: ${x.message}`).join('; ')}` : 'No problems found by the checks (the GPU compiler has the last word)',
      detail: 'These checks need no GPU: brackets that match, a return, a semicolon on every statement, and no whole numbers in float maths, the most common GLSL error (GLSL will not mix int and float: 0.5 * 2 does not compile, 0.5 * 2.0 does).',
      values: lint.slice(0, 8).map((x) => [`line ${x.line}`, x.message] as [string, string]),
    });
  }
  return { lines: all.length, bodyStart, bodyEnd, lint };
}
