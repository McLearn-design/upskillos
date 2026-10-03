// Lesson 9.7: write a shader. A MeshLab custom material is the body of shade(N, L, V, uv, base, light) in GLSL: vectors
// and colours as vec3, arithmetic component by component, floats always written with a decimal point. The app wraps
// the body in a fixed frame, the GPU driver compiles it, and its error line numbers are mapped back to your lines.
// The colour you return is linear; values above 1 are tone-mapped or clipped, then encoded to sRGB.

const VEC = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
// GLSL's vec3 arithmetic, written out in JavaScript: everything works component by component.
const v3 = (x, y, z) => [x, y, z]
const add = (a, b) => a.map((x, i) => x + (Array.isArray(b) ? b[i] : b))
const mul = (a, b) => a.map((x, i) => x * (Array.isArray(b) ? b[i] : b))
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const normalize = (a) => a.map((x) => x / Math.hypot(...a))
const max = Math.max, pow = Math.pow, floor = Math.floor
`;

const SHADE = `${VEC}
// The body of a toon shader with a rim, as you would write it in GLSL (left) and as JavaScript computes it (right):
//   float d = floor(max(dot(N, L), 0.0) * 3.0) / 3.0;        →  const d = floor(max(dot(N, L), 0) * 3) / 3
//   float rim = pow(1.0 - max(dot(N, V), 0.0), 4.0);         →  const rim = pow(1 - max(dot(N, V), 0), 4)
//   return base * (ambient + d * light) + rim * light * 0.35; →  add(mul(base, add(ambient, mul(light, d))), mul(light, rim * 0.35))
function shade(N, L, V, uv, base, light, ambient) {
  const d = floor(max(dot(N, L), 0) * 3) / 3
  const rim = pow(1 - max(dot(N, V), 0), 4)
  return add(mul(base, add(ambient, mul(light, d))), mul(light, rim * 0.35))
}
// Predict first: the colour at a point facing the light, and at one edge-on to the eye.
const base = v3(0.8, 0.2, 0.1), light = v3(1, 1, 1), ambient = v3(0.1, 0.1, 0.12), L = normalize(v3(0, 1, 0)), V = v3(0, 0, 1)
for (const [name, N] of [['facing the light', v3(0, 1, 0)], ['45° from it', normalize(v3(0, 1, 1))], ['edge-on to the eye', v3(1, 0, 0)]]) {
  console.log(name + ': (' + shade(N, L, V, [0, 0], base, light, ambient).map(r).join(', ') + ')')
}`;

const LINES = `${VEC}
// MeshLab writes the frame around your body; the compiler numbers every line of the result.
const frame = ['uniform vec3 uBase;', '// … 10 more uniforms …', 'varying vec3 vNormalW;', '// … 2 more varyings …', 'vec3 ambient;', '', 'vec3 shade(vec3 N, vec3 L, vec3 V, vec2 uv, vec3 base, vec3 light) {']
const yours = ['float d = max(dot(N, L), 0.0);', 'float rim = pow(1.0 - max(dot(N, V), 0.0), 3);', 'return base * (ambient + d * light) + rim * light;']
const program = [...frame, ...yours.map((l) => '  ' + l), '}', 'void main() { … }']
const start = program.findIndex((l) => l.startsWith('vec3 shade(')) + 2       // the first body line, counting from 1
// Predict first: the compiler says "ERROR: 0:9". Which of your lines is that?
const error = 'ERROR: 0:9: \\'pow\\' : no matching overloaded function found'
const n = +error.match(/ERROR: 0:(\\d+)/)[1]
console.log('your body starts on program line ' + start)
console.log(error.replace(/ERROR: 0:(\\d+):/, 'line ' + (n - start + 1) + ' of your code:'))
console.log('that line: ' + yours[n - start])`;

const FLOATS = `${VEC}
// GLSL never turns a whole number into a float for you: 2 is an int, 2.0 a float, and int * float does not compile.
// A rough check, like MeshLab's: a bare whole number next to float maths. Predict first: which lines fail?
const lines = ['float d = max(dot(N, L), 0);', 'float d = max(dot(N, L), 0.0);', 'vec3 c = base * 2.0;', 'vec3 c = base * 2;', 'float s = pow(d, 40.0);', 'float s = pow(d, 40);']
for (const l of lines) {
  const bad = /(?:[*/+-]\\s*|\\(\\s*|,\\s*)(\\d+)(?![.\\w])/.test(l)
  console.log((bad ? '✗ ' : '✓ ') + l)
}`;

const TONE = `${VEC}
// A bright highlight can make a colour above 1. Screens stop at 1: clipping cuts everything above to white. Tone
// mapping squeezes the whole range into 0 … 1 first; Reinhard's c / (1 + c) is the simplest.
// Predict first: after clipping, can you tell 1.5 from 3 apart? After Reinhard?
const toSRGB = (c) => (c < 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
for (const c of [0.25, 0.5, 1, 1.5, 3, 10]) {
  const clip = Math.round(255 * toSRGB(Math.min(c, 1))), reinhard = Math.round(255 * toSRGB(c / (1 + c)))
  console.log('linear ' + c + ': clipped ' + clip + ', Reinhard ' + reinhard)
}`;

const PICTURE = `${VEC}
// Two balls with the same bright Blinn–Phong highlight (peak above 1). Left: clipped. Right: Reinhard tone mapping.
// Your shade() is the function below: change it and run again.
function shade(N, L, V, base, light) {
  const d = max(dot(N, L), 0), H = normalize(add(L, V)), s = d > 0 ? pow(max(dot(N, H), 0), 30) : 0
  return add(mul(base, 0.08 + d * light), s * light * 1.5)
}
const toSRGB = (c) => (c < 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
const canvas = document.createElement('canvas'), W = 340, H = 170
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'), img = g.createImageData(W * 2, H * 2)
const L = normalize([0.5, 0.6, 0.6]), V = [0, 0, 1], base = [0.15, 0.35, 0.8]
let brightest = 0
for (let py = 0; py < H * 2; py++) for (let px = 0; px < W * 2; px++) {
  const k = px < W ? 0 : 1, cx = (k + 0.5) * W, cy = H - 6, R = H * 0.8, i = (py * W * 2 + px) * 4
  const x = (px - cx) / R, y = (cy - py) / R
  if (x * x + y * y > 1) { img.data.set([15, 25, 35, 255], i); continue }
  const c = shade([x, y, Math.sqrt(1 - x * x - y * y)], L, V, base, 1)
  brightest = Math.max(brightest, ...c)
  img.data.set([...c.map((t) => Math.round(255 * toSRGB(k ? t / (1 + t) : Math.min(t, 1)))), 255], i)
}
g.putImageData(img, 0, 0)
g.scale(2, 2); g.fillStyle = '#cbd5e1'; g.font = '11px sans-serif'; g.textAlign = 'center'
g.fillText('clipped', W / 4, H - 2); g.fillText('Reinhard', W * 3 / 4, H - 2)
console.log('brightest linear value: ' + r(brightest))`;

const CHALLENGE = `// MeshLab's frame puts "vec3 shade(...) {" on program line 18, so your body starts on line 19.
// The compiler reports: ERROR: 0:24: 'return' : function return is not matching type
// Which line of your code is that?
const yourLine = 0
console.log(yourLine)`;

const SOLVED = CHALLENGE.replace('const yourLine = 0', 'const yourLine = 24 - 19 + 1');

/** The challenge's check: 24 − 19 + 1 = 6. */
export function checkErrorLine(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+yourLine\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const yourLine = …, with a number or plain arithmetic.');
  const e = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^[\d\s+\-*/()]+$/.test(e)) return no('Write the line as a number or plain arithmetic, like 24 - 18.');
  let v;
  try { v = Number(new Function('return (' + e + ')')()); } catch { return no('That expression did not run.'); }
  if (v === 6) return { pass: true, message: 'Line 6: your line 1 is program line 19, so program line n is your line n − 18; 24 − 18 = 6. MeshLab does this subtraction for you in the error under the code.' };
  if (v === 0) return no('Your line 1 is program line 19. Count on from there to line 24.');
  if (v === 5) return no('24 − 19 = 5 is how many lines after your first line; your first line is line 1, so add 1.');
  if (v === 24) return no('24 counts the whole program, including MeshLab\'s frame. Subtract the 18 lines before your body.');
  if (v === 7) return no('Line 18 is the shade() header itself; your body starts on 19. 24 − 18 = 6.');
  return no(`${v} is not right: your line = program line − 18.`);
}

export default {
  id: 'modelling-geometry-9-007',
  slug: 'write-a-shader',
  chapter: 'modelling-geometry',
  order: 7,
  title: 'Write a shader',
  subtitle: 'Your own shade() in GLSL: vectors and floats, how the app wraps and compiles it, reading its errors, and what happens to colours above 1.',
  tags: ['shaders', 'glsl', 'fragment shader', 'compiling', 'errors', 'tone mapping', 'colour space'],
  coreConcept: 'A custom MeshLab material is the body of vec3 shade(vec3 N, vec3 L, vec3 V, vec2 uv, vec3 base, vec3 light) in GLSL. vec3 holds directions and colours; arithmetic works component by component; dot, normalize, max, pow, mix and floor are built in; and every float must be written with a decimal point, because GLSL never converts int to float. The app wraps the body in a fixed frame (uniforms, varyings, main()), the graphics driver compiles it, and the compiler\'s line numbers, which count the whole program, are mapped back to your lines by subtracting the frame. The colour returned is linear: values above 1 are clipped or tone-mapped (Reinhard c/(1 + c) is the simplest), then encoded to sRGB for the screen.',
  prerequisites: ['modelling-geometry-9-004', 'modelling-geometry-9-001'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-10-001',

  hook: {
    question: 'Every look in this chapter, matte, glossy, cartoon, debug, was a few lines of shader code. What does it take to write your own, and when it fails with "ERROR: 0:24: no matching overloaded function", how do you find the mistake?',
    realWorldContext: 'Shaders are written in GLSL (OpenGL, WebGL), HLSL (DirectX) and WGSL (WebGPU), and edited visually as node graphs in Blender, Unity and Unreal, which generate the same code. Reading compiler errors and avoiding int/float mix-ups are everyday skills for technical artists.',
  },

  intuition: {
    prose: [
      'A **fragment shader** is a small function the GPU runs for every pixel. In MeshLab you write only its heart: the body of $\\texttt{shade(N, L, V, uv, base, light)}$, returning a $\\texttt{vec3}$ colour. A $\\texttt{vec3}$ is three floats, a direction or a colour; adding, multiplying and mixing them work component by component, and $\\texttt{dot}$, $\\texttt{normalize}$, $\\texttt{max}$, $\\texttt{pow}$ and $\\texttt{floor}$ do what they did in this chapter\'s notebooks. Before running cell 1, predict the toon shader\'s colour at a point edge-on to the eye: its rim adds $0.35$ of the light.',
      'The app wraps your body in a **frame**: uniforms (the material colour, the light, the sky), varyings (the interpolated normal, position, UV) and $\\texttt{main()}$, which calls $\\texttt{shade()}$. The graphics driver compiles the whole thing. Its errors read "ERROR: 0:n", where $n$ counts lines of the whole program, so MeshLab subtracts the lines before your body. Before running cell 2, predict which of your lines "ERROR: 0:9" points to.',
      'The most common error: GLSL **never turns an int into a float**. $\\texttt{2}$ is an int, $\\texttt{2.0}$ a float, and $\\texttt{base * 2}$ or $\\texttt{pow(d, 40)}$ do not compile. Before running cell 3, predict which of six lines fail.',
      'Last, the colour you return is **linear**, and it can exceed 1: a strong highlight adds light on top of the diffuse. A screen cannot show more than 1, so the value is either **clipped** (everything above 1 becomes the same white) or **tone-mapped**: squeezed smoothly into $0 \\ldots 1$, like Reinhard\'s $c/(1 + c)$, keeping the difference between bright and brighter. Then it is encoded to sRGB (lesson 9.1). Before running cell 4, predict whether clipping can tell 1.5 from 3.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Writing and debugging a shade() body',
        body: 'Step 1. Start from a working body (the Shader tab shows each model\'s GLSL); change one thing at a time.\nStep 2. Write every float with a decimal point: 2.0, 0.5, 40.0.\nStep 3. Apply. If it fails, the object falls back to Lambert and the error appears under the code, as "line n of your code".\nStep 4. Go to that line; read the message ("no matching overloaded function" usually means an int where a float was needed).\nStep 5. Check with a debug view: return N * 0.5 + 0.5 or vec3(d) to see an intermediate value as a colour.',
      },
      {
        type: 'warning',
        title: 'Whole numbers are ints',
        body: 'pow(d, 40), base * 2, max(x, 0) all fail in GLSL ES: there is no overload mixing float and int. Write 40.0, 2.0, 0.0. MeshLab\'s checks flag these before the compiler does.',
      },
      {
        type: 'warning',
        title: 'Return a vec3',
        body: 'shade() must return a vec3. Returning a float (return d;) does not compile; write vec3(d) to make a grey, or multiply a vec3 by it.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: shader errors',
        body: 'The compiler runs inside the graphics driver, so messages differ between GPUs and browsers, but the line number is always there. Mapping it to your own lines is what makes an editor usable; MeshLab does it by finding shade() in the compiled source.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "a colour can only be between 0 and 1". The highlight\'s linear value is above 1. Clipped (left), the whole highlight is one flat white blob; tone-mapped (right), it keeps its round falloff.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'Cell 1\'s comments set GLSL beside the JavaScript that computes the same thing; cell 2 is MeshLab\'s line mapping; cell 3 is its float check; cell 4 is tone mapping.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'three.js prepends its own header (version, precision, defines) and appends tonemapping_fragment and colorspace_fragment to your program. Every pixel of the object runs main(), and so your shade(), in parallel.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Inspector › Shader: Custom; the Shader tab edits the body (Apply or Ctrl+Enter). Object › Trace assembling the shader shows the frame, which program lines your body becomes (predict where an error points), main(), and the checks. In a script: obj.material.glsl = "…", obj.traceShader().' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: a shader, its errors and its output',
        caption: 'A shade() body, mapping error lines, the float rule, tone mapping, and two highlights.',
        props: {
          lesson: {
            title: 'Write a shader',
            subtitle: 'shade(N, L, V, uv, base, light).',
            cells: [
              { type: 'js', instruction: '### 1. A shade() body\nPredict first: the colour edge-on to the eye.', startCode: SHADE },
              { type: 'js', instruction: '### 2. Error lines\nPredict first: which of your lines ERROR: 0:9 is.', startCode: LINES },
              { type: 'js', instruction: '### 3. Floats, not ints\nPredict first: which lines fail.', startCode: FLOATS },
              { type: 'js', instruction: '### 4. Above 1\nPredict first: can clipping tell 1.5 from 3?', startCode: TONE },
              { type: 'js', instruction: '### 5. See it\nClipped and tone-mapped. Change shade() and run again.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 230 },
              { type: 'challenge', instruction: '### 6. Challenge: where is the error?\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkErrorLine },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Write a shader" in MeshLab](#/lab/mesh-lab?project=write-a-shader). A custom shader with a mistake on line 2; the assembly is traced: press Play, and predict where a compiler error points. Then fix it in the Shader tab.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Inspector › Shader: Custom**, then the **Shader** tab.\n- **Object › Trace assembling the shader.**\n- [The "A toon shader of your own" challenge](#/lab/mesh-lab?challenge=toon-shader): four bands and an outline.\n- [The "Shader gallery"](#/lab/mesh-lab?project=shader-gallery): every model\'s GLSL to start from.\n- **Elsewhere:** The Book of Shaders, Shadertoy, Blender\'s shader nodes.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Component-wise arithmetic.** For $a, b \\in \\mathbb{R}^3$ and $s \\in \\mathbb{R}$: $a + b$, $a * b = (a_x b_x, a_y b_y, a_z b_z)$ (the Hadamard product, how colours filter light), and $s * a$. $\\texttt{dot}(a, b) = \\sum a_i b_i$ is the only built-in that mixes components.',
      '**Error line mapping.** If the line "vec3 shade(...) {" is line $h$ of the compiled source, your body\'s line $k$ is program line $h + k$, so an error on program line $n$ is your line $n - h$.',
      '**Tone mapping.** Clipping is $\\min(c, 1)$: all $c \\ge 1$ map to 1. Reinhard\'s $T(c) = c/(1 + c)$ is increasing for all $c \\ge 0$, so it keeps every difference in order, compressing the bright end most; $T(1) = \\tfrac12$, so mid-tones darken unless the exposure is raised first.',
    ],
    equations: [
      { label: 'Hadamard product', latex: 'a * b = (a_x b_x,\\; a_y b_y,\\; a_z b_z)' },
      { label: 'Your line', latex: 'k = n - h' },
      { label: 'Reinhard', latex: 'T(c) = \\frac{c}{1 + c}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** GLSL ES 3.00 has no implicit conversion from int to float in function calls or binary operators: an overload is chosen only if every argument type matches exactly, so pow(float, int) has no match and the program fails to link. Tone mapping functions are monotone maps from [0, ∞) into [0, 1); clipping is monotone but not injective on [1, ∞).',
      '**Invariant viewpoint.** Your shade() sees only vectors in world space and colours in linear units; it is the same function whatever the object\'s size or place, which is what makes one material reusable on any mesh.',
      '**Geometric picture.** A shader is a recipe run on every pixel at once: same steps, different N, L and V each time.',
      '**Where this goes.** Chapter 10 animates objects; their shaders run unchanged, because the inputs (N, L, V) already follow the motion.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-9-007-ex1',
      title: 'Fix the float',
      problem: 'Why does float s = pow(d, 40); fail, and what is the fix?',
      steps: [{ expression: '\\texttt{pow(float, int)}', annotation: 'No such overload.' }],
      conclusion: 'Write pow(d, 40.0).',
    },
    {
      id: 'modelling-geometry-9-007-ex2',
      title: 'Colour filtering',
      problem: 'base = (0.8, 0.2, 0.1), light = (1.0, 0.9, 0.5). What is base * light?',
      steps: [{ expression: '(0.8, 0.18, 0.05)', annotation: 'Component by component.' }],
      conclusion: 'A warm light deepens the orange: (0.8, 0.18, 0.05).',
    },
    {
      id: 'modelling-geometry-9-007-ex3',
      title: 'Tone-map a highlight',
      problem: 'A highlight reaches linear 2.0. Clipped and Reinhard?',
      steps: [{ expression: '\\min(2, 1) = 1, \\quad 2/3 = 0.667', annotation: 'Before sRGB encoding.' }],
      conclusion: 'Clipped 1 (white, 255); Reinhard 0.667 (screen 213).',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-9-007-ch1',
      difficulty: 'easy',
      problem: 'Why does MeshLab draw a broken custom shader with Lambert instead of nothing?',
      walkthrough: [{ expression: '\\text{no program, no pixels}', annotation: 'A failed compile draws nothing.' }],
      answer: 'A shader that does not compile cannot draw at all; falling back to a working model keeps the object visible while you fix it, and the error under the code says where the problem is.',
    },
    {
      id: 'modelling-geometry-9-007-ch2',
      difficulty: 'medium',
      problem: 'How can you see the value of an intermediate variable, like d, inside a shader?',
      walkthrough: [{ expression: '\\texttt{return vec3(d);}', annotation: 'A debug view of your own.' }],
      answer: 'There is no print in a shader. Return it as a colour: return vec3(d); shows d as grey from black (0) to white (1), on every pixel, exactly like the Normals and UV views of lesson 9.5.',
    },
    {
      id: 'modelling-geometry-9-007-ch3',
      difficulty: 'hard',
      problem: 'Show that Reinhard tone mapping never reverses the order of two brightnesses, and that clipping can lose it.',
      walkthrough: [
        { expression: 'T\'(c) = \\frac{1}{(1 + c)^2} > 0', annotation: 'Strictly increasing.' },
        { expression: '\\min(1.5, 1) = \\min(3, 1) = 1', annotation: 'Clipping merges them.' },
      ],
      answer: 'T(c) = c/(1 + c) has derivative 1/(1 + c)² > 0, so a brighter input always stays brighter. Clipping maps every value above 1 to 1, so 1.5 and 3 become equal: the order is lost (not reversed), which is why clipped highlights look flat.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\texttt{vec3}', meaning: 'Three floats: a direction or a colour.' },
      { symbol: '\\texttt{shade(N, L, V, uv, base, light)}', meaning: 'The function you write; it returns the pixel\'s colour.' },
      { symbol: '2.0 \\text{ vs } 2', meaning: 'A float and an int; GLSL will not mix them.' },
      { symbol: 'n - h', meaning: 'Your line, from the compiler\'s line n.' },
      { symbol: 'c / (1 + c)', meaning: 'Reinhard tone mapping.' },
      { symbol: '\\min(c, 1)', meaning: 'Clipping.' },
    ],
    rulesOfThumb: [
      'Floats always have a decimal point.',
      'Return a vec3.',
      'Change one thing, then Apply.',
      'Show values as colours to debug.',
      'Tone-map highlights, don\'t clip them.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-9-004', label: 'Stylised shading', note: 'A body worth rewriting yourself.' },
      { lessonId: 'modelling-geometry-9-001', label: 'Light and the cosine law', note: 'Linear light and the sRGB encoding.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-10-001', label: 'Chapter 10: Animation', note: 'Things that move.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-9-007-1', label: 'Read what shade() receives and returns', type: 'read' },
    { id: 'cp-modelling-geometry-9-007-2', label: 'Read how error lines are mapped', type: 'read' },
    { id: 'cp-modelling-geometry-9-007-3', label: 'Read the float rule and tone mapping', type: 'read' },
    { id: 'cp-modelling-geometry-9-007-4', label: 'Run cells 1 to 4: shade(), lines, floats, tone mapping', type: 'lab' },
    { id: 'cp-modelling-geometry-9-007-5', label: 'Fix a shader in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-9-007-6', label: 'Work through example 1, fix the float', type: 'example' },
    { id: 'cp-modelling-geometry-9-007-7', label: 'Work through example 3, tone-map a highlight', type: 'example' },
    { id: 'cp-modelling-geometry-9-007-8', label: 'Complete the challenge: where is the error?', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-9-007-assess-1',
        type: 'choice',
        text: 'Which line compiles in GLSL?',
        options: ['vec3 c = base * 2.0;', 'vec3 c = base * 2;', 'float s = pow(d, 8);', 'return d;'],
        answer: 'vec3 c = base * 2.0;',
        hint: 'Floats need a decimal point; shade() returns a vec3.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-9-007-quiz-1',
      type: 'choice',
      text: 'In GLSL, base * light for two vec3 colours is:',
      options: ['Component by component', 'A dot product', 'A cross product', 'An error'],
      answer: 'Component by component',
      hints: ['Cell 1.', 'Math, Component-wise arithmetic.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-9-007-quiz-2',
      type: 'choice',
      text: 'If shade() starts on program line 7, an error on program line 9 is your line:',
      options: ['2', '9', '3', '16'],
      answer: '2',
      hints: ['Cell 2.', 'n − h with h = 7.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-9-007-quiz-3',
      type: 'choice',
      text: 'pow(d, 40) fails in GLSL because:',
      options: ['40 is an int and GLSL will not convert it', 'pow does not exist', '40 is too big', 'd must be a vec3'],
      answer: '40 is an int and GLSL will not convert it',
      hints: ['Cell 3.', 'Warning "Whole numbers are ints".'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-9-007-quiz-4',
      type: 'choice',
      text: 'After clipping, linear 1.5 and 3 show as:',
      options: ['The same white', 'Different brightnesses', 'Black', 'Errors'],
      answer: 'The same white',
      hints: ['Cell 4.', 'min(c, 1).'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-9-007-quiz-5',
      type: 'choice',
      text: 'Reinhard tone mapping maps linear 1 to:',
      options: ['0.5', '1', '0', '0.75'],
      answer: '0.5',
      hints: ['c / (1 + c).', 'Math, Tone mapping.'],
      reviewSection: 'Math',
    },
    {
      id: 'modelling-geometry-9-007-quiz-6',
      type: 'choice',
      text: 'How do you look at an intermediate value in a shader?',
      options: ['Return it as a colour, e.g. vec3(d)', 'console.log', 'A breakpoint', 'You cannot'],
      answer: 'Return it as a colour, e.g. vec3(d)',
      hints: ['Challenge 2.', 'Lesson 9.5.'],
      reviewSection: 'Challenge',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A colour can only be between 0 and 1.',
      whyStudentsThinkIt: 'Screens show 0 to 255.',
      correctionExample: 'Cell 5: the highlight\'s linear value is above 1; only the final step maps it into the screen\'s range.',
      contrastCase: 'After tone mapping and encoding, it is between 0 and 1.',
    },
    {
      falseBelief: 'GLSL works like JavaScript with numbers.',
      whyStudentsThinkIt: 'The syntax looks similar.',
      correctionExample: 'Cell 3: 2 and 2.0 are different types, and mixing them does not compile.',
      contrastCase: 'In JavaScript every number is a float.',
    },
    {
      falseBelief: 'The compiler\'s line number is the line in my editor.',
      whyStudentsThinkIt: 'Other tools work that way.',
      correctionExample: 'Cell 2 and the challenge: it counts the whole program; subtract the frame.',
      contrastCase: 'MeshLab\'s error message has already done the subtraction.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A shader works on one laptop and fails to compile on a phone.',
      competingTechniques: ['Rewrite it from scratch', 'Look for implicit int-to-float conversions and precision assumptions'],
      whyThisTechniqueWins: 'Some desktop drivers accept int/float mixing that GLSL ES rejects; writing every float with a decimal point makes it portable.',
    },
    {
      situation: 'A bright metal\'s highlights look like flat white stickers.',
      competingTechniques: ['Lower the light', 'Tone-map instead of clipping'],
      whyThisTechniqueWins: 'Clipping merges everything above 1; tone mapping keeps the falloff, so the highlight stays round without dimming the rest.',
    },
  ],

  debugging: [
    {
      commonError: 'Writing integer literals in float maths.',
      symptom: '"no matching overloaded function" or "wrong operand types".',
      whyItHappened: 'GLSL has no implicit int-to-float conversion.',
      repairStrategy: 'Add .0 to every float constant.',
    },
    {
      commonError: 'Returning a float from shade().',
      symptom: '"function return is not matching type".',
      whyItHappened: 'shade() is declared to return vec3.',
      repairStrategy: 'return vec3(d); or multiply a vec3 by d.',
    },
    {
      commonError: 'Counting error lines from the top of the editor.',
      symptom: 'Looking for the mistake on the wrong line.',
      whyItHappened: 'The compiler counts the whole program.',
      repairStrategy: 'Use MeshLab\'s mapped message, or subtract the frame (n − h).',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Write a shade() body, fix its compile errors and choose clipping or tone mapping.',
    explainVerbally: 'Explain the frame, the line mapping, the float rule and tone mapping.',
    detectIncorrectApplication: 'Recognise int literals, float returns and miscounted error lines.',
    transferToUnfamiliar: 'Read and write shaders in GLSL, HLSL or a node editor.',
  },
};
