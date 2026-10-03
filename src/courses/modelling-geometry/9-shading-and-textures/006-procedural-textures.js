// Lesson 9.6: procedural textures. A texture can be a formula of (u, v) instead of an image: floor() and parity make
// checkers and stripes; a half-cell shift on alternate rows makes bricks; sines make wood rings and stand in for noise.
// The texture repeats by keeping the fractional part of (u, v) × scale, and it tiles without a join only if its
// formula is periodic: whole numbers of cells or turns across the unit square.

const TEX = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const fract = (x) => x - Math.floor(x)
// MeshLab's texture formulas (core/shading.ts): each returns an sRGB colour 0–255 for (u, v) in the unit square.
const T = 2 * Math.PI
const tex = {
  checker: (u, v) => ((Math.floor(u * 8) + Math.floor(v * 8)) % 2 === 0 ? [235, 235, 235] : [Math.round(40 + 180 * Math.floor(v * 8) / 7), 70, Math.round(220 - 150 * Math.floor(v * 8) / 7)]),
  stripes: (u, v) => (Math.floor(u * 10) % 2 ? [255, 159, 28] : [36, 40, 48]),
  bricks: (u, v) => {
    const ry = v * 8, row = Math.floor(ry), rx = u * 4 + (row % 2) * 0.5
    const mortar = ry - row < 0.08 || rx - Math.floor(rx) < 0.04, shade = 0.85 + 0.15 * Math.sin((((row % 8) + 8) % 8) * 12.9898 + (((Math.floor(rx) % 4) + 4) % 4) * 78.233)
    return mortar ? [200, 196, 188] : [Math.round(168 * shade), Math.round(74 * shade), Math.round(52 * shade)]
  },
  wood: (u, v) => {
    const rr = Math.hypot(u - 0.5, (v - 0.5) * 0.25 + 1.2) * 24 + 0.8 * Math.sin(u * 13) + 0.4 * Math.sin(v * 31), t = 0.5 + 0.5 * Math.sin(rr * T)
    return [Math.round(150 + 50 * t), Math.round(98 + 35 * t), Math.round(52 + 22 * t)]
  },
  grass: (u, v) => {
    const n = Math.sin(T * (15 * u + 2 * v)) * Math.sin(T * (12 * v - u)) + 0.5 * Math.sin(T * 34 * (u + v)) * Math.sin(T * 28 * (u - v)), t = 0.5 + 0.35 * n
    return [Math.round(70 + 60 * t), Math.round(120 + 70 * t), Math.round(45 + 25 * t)]
  },
}
`;

const CHECKER = `${TEX}
// The checker: cell (floor(8u), floor(8v)), white when the two add up to an even number.
// Predict first: is cell (3, 5) white? Draw the whole board with # for white.
for (let j = 7; j >= 0; j--) console.log(Array.from({ length: 8 }, (_, i) => (tex.checker((i + 0.5) / 8, (j + 0.5) / 8)[0] === 235 ? '#' : '.')).join(' ') + '   row ' + j)
console.log('cell (3, 5): ' + ((3 + 5) % 2 === 0 ? 'white' : 'coloured'))`;

const BRICKS = `${TEX}
// Bricks: 8 rows of 4, every other row shifted half a brick (rx = 4u + ½ on odd rows); the bottom 8% and left 4%
// of each brick are mortar. Predict first: which row is v = 0.3 in? Draw the bottom half of the square: each
// character is | where a vertical joint falls inside it, - on a row's mortar line, and B inside a brick.
const rowOf = (v) => Math.floor(v * 8), brickOf = (u, row) => Math.floor(u * 4 + (row % 2) * 0.5)
for (let j = 15; j >= 0; j--) {
  // Each row of bricks is 4 characters tall; its bottom character carries the mortar line.
  const row = rowOf((j + 0.5) / 32)
  console.log(Array.from({ length: 48 }, (_, i) => {
    if (j % 4 === 0) return '-'
    // A joint falls in this character if the brick index changes between its left edge and its right edge.
    return brickOf(i / 48 - 1e-9, row) !== brickOf((i + 1) / 48 - 1e-9, row) ? '|' : 'B'
  }).join(''))
}
console.log('v = 0.3 is in row ' + rowOf(0.3))`;

const TILING = `${TEX}
// With a texture scale above 1 the square repeats: just past u = 1 the next copy starts again at u = 0. The join is
// invisible exactly when that is what the formula would have drawn there anyway: f(u + 1, v) = f(u, v), and the same
// for v. Predict first: which textures pass?
for (const [name, f] of Object.entries(tex)) {
  let worst = 0
  for (let a = 0; a < 60; a++) for (let b = 0; b < 60; b++) {
    const u = (a + 0.5) / 60, v = (b + 0.5) / 60, here = f(u, v), right = f(u + 1, v), up = f(u, v + 1)
    worst = Math.max(worst, ...here.map((x, i) => Math.abs(x - right[i])), ...here.map((x, i) => Math.abs(x - up[i])))
  }
  console.log(name + ': largest difference one square on ' + worst + (worst <= 1 ? ' (tiles)' : ' ← a visible join'))
}`;

const PICTURE = `${TEX}
// Each texture drawn on a tile with texture scale 2: four copies meeting in the middle. Look for joins.
const canvas = document.createElement('canvas'), W = 390, H = 290
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'), img = g.createImageData(W * 2, H * 2), names = Object.keys(tex), S = 248
for (let py = 0; py < H * 2; py++) for (let px = 0; px < W * 2; px++) {
  const k = Math.floor(px / (W * 2 / 3)) + 3 * Math.floor(py / H), i = (py * W * 2 + px) * 4
  const x0 = (k % 3) * W * 2 / 3 + (W * 2 / 3 - S) / 2, y0 = Math.floor(k / 3) * H + 26, x = px - x0, y = py - y0
  if (k >= names.length || x < 0 || x >= S || y < 0 || y >= S) { img.data.set([15, 25, 35, 255], i); continue }
  const u = fract(2 * x / S), v = fract(2 * (S - 1 - y) / S)
  img.data.set([...tex[names[k]](u, v), 255], i)
}
g.putImageData(img, 0, 0)
g.scale(2, 2); g.fillStyle = '#cbd5e1'; g.font = '11px sans-serif'; g.textAlign = 'center'
names.forEach((n, k) => g.fillText(n + ' × 2', (k % 3 + 0.5) * W / 3, Math.floor(k / 3) * H / 2 + 8))
console.log('drawn: ' + names.join(', '))`;

const CHALLENGE = `// A brick wall's face has UV (0.6, 0.4) and the material repeats the texture twice (scale 2).
// Which row of bricks, and which brick along that row, does it land in?
const answer = { row: 0, brick: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { row: 0, brick: 0 }', 'const answer = { row: 6, brick: 0 }');

/** The challenge's check: fract(1.2, 0.8) = (0.2, 0.8); row floor(6.4) = 6 (even, no shift); rx = 0.8, brick 0. */
export function checkBrick(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/row\s*:\s*([^,}]+),\s*brick\s*:\s*([^,}\n]+)/);
  if (!m) return no('Keep the line const answer = { row: …, brick: … }.');
  const row = Number(m[1].trim()), brick = Number(m[2].trim());
  if (!Number.isInteger(row) || !Number.isInteger(brick)) return no('Row and brick are whole numbers.');
  if (row === 6 && brick === 0) return { pass: true, message: 'Right: the repeat gives (0.6 × 2, 0.4 × 2) = (1.2, 0.8), fractional part (0.2, 0.8). Row floor(8 × 0.8) = 6, an even row, so no shift: rx = 4 × 0.2 = 0.8, brick 0, 80% of the way along it.' };
  if (row === 0 && brick === 0) return no('First apply the repeat: multiply the UV by 2 and keep the fractional part.');
  if (row === 3 && brick === 2) return no('That is the brick at (0.6, 0.4) with no repeat. The scale is 2: (1.2, 0.8) → (0.2, 0.8).');
  if (row === 6 && brick === 1) return no('Row 6 is even, so there is no half-brick shift: rx = 4 × 0.2 = 0.8, brick 0.');
  if (row === 3) return no('Row 3 is at the original v = 0.4. After the repeat, v = 0.8.');
  if (row === 6) return no('The row is right. Along it: rx = 4u (plus ½ only on odd rows) with u = 0.2.');
  return no('Repeat first (× 2, keep the fractional part), then row = floor(8v), brick = floor(4u + ½ if the row is odd).');
}

export default {
  id: 'modelling-geometry-9-006',
  slug: 'procedural-textures',
  chapter: 'modelling-geometry',
  order: 6,
  title: 'Procedural textures',
  subtitle: 'Textures written as formulas of (u, v): checkers, bricks, wood and noise, how they repeat, and why some tile and some do not.',
  tags: ['textures', 'procedural', 'floor', 'periodic functions', 'noise', 'tiling', 'texture scale'],
  coreConcept: 'A procedural texture computes each texel from a formula of (u, v) instead of reading an image. floor() splits the square into cells: (floor(8u), floor(8v)) with the parity of their sum gives a checker, floor(10u) stripes, and rows with a half-cell shift on alternate rows give bricks. Sines make periodic bands: rings of distance through sin(2πr) look like wood, and products of sines at unrelated frequencies stand in for noise. The material repeats a texture by keeping the fractional part of (u, v) × scale; the copies meet without a visible join only if the formula is periodic over the unit square, with a whole number of cells or turns across it.',
  prerequisites: ['modelling-geometry-8-001', 'modelling-geometry-9-001'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-9-007',

  hook: {
    question: 'A brick wall, a wooden floor and a lawn can each be textured without a single image file: the texture is a few lines of arithmetic. How do floor() and sin() become bricks and grain, and why does one texture repeat seamlessly while another shows a line every time it repeats?',
    realWorldContext: 'Procedural textures are used in film (Pixar\'s RenderMan shaders), in Blender\'s and Substance\'s node editors, in games for terrain and effects, and wherever memory is tight: a formula costs no texture memory and has no resolution limit.',
  },

  intuition: {
    prose: [
      'A texture is a function from the UV square to colours. An image stores that function as a grid of texels; a **procedural** texture computes it on the spot. The building block is **floor()**: $\\lfloor 8u \\rfloor$ says which of 8 columns $u$ is in. A checker colours cell $(\\lfloor 8u\\rfloor, \\lfloor 8v\\rfloor)$ white when the two indices add up to an even number. Before running cell 1, predict whether cell $(3, 5)$ is white: $3 + 5 = 8$, even, yes.',
      '**Bricks** are rows, $\\lfloor 8v \\rfloor$, of bricks, $\\lfloor 4u \\rfloor$, with one twist: on every odd row, $u$ is shifted half a brick, so the vertical joints are staggered as in a real wall. The position inside the cell, the fractional part, decides mortar (near the bottom or left edge) or brick. Before running cell 2, predict which row $v = 0.3$ is in: $\\lfloor 2.4 \\rfloor = 2$.',
      '**Sines** make smooth periodic bands. Wood grain is rings round the trunk, seen from the side: the distance $r$ from an axis just off the square, turned into light and dark bands by $\\sin(2\\pi r)$, with small sines added to wobble the rings. Products of sines at frequencies with no simple ratio look random but are perfectly repeatable: a cheap stand-in for noise.',
      'A material **repeats** a texture by multiplying the UV by its scale and keeping the fractional part. The copies then meet edge to edge, and the join is invisible only if the formula gives the same colour at $u = 0$ and $u = 1$ (and $v = 0$ and $v = 1$). Whole numbers of cells do (8 checker columns, 4 bricks); sines tile only when they turn a whole number of times across the square, $\\sin(2\\pi k u)$ with $k$ an integer. Before running cell 3, predict which of MeshLab\'s five textures pass: stripes, bricks and grass. Wood fails, because its rings are not periodic; the checker\'s squares tile, but its row tint (blue at the bottom to red at the top) restarts with every copy, on purpose, so you can see where each copy begins.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Evaluating a procedural texel',
        body: 'Step 1. Repeat: (u, v) ← fractional part of (u, v) × scale.\nStep 2. Cells: i = floor(n·u), j = floor(n·v) for an n × n pattern; offsets for staggered rows.\nStep 3. Inside the cell: the fractional parts n·u − i and n·v − j, for mortar, lines and edges.\nStep 4. Bands and noise: sines of positions or distances, scaled into 0 … 1.\nStep 5. Mix colours by the results; the colour is sRGB, decoded before lighting.',
      },
      {
        type: 'warning',
        title: 'Periodic or it shows',
        body: 'Every repeat puts u = 1 next to u = 0. A formula with sin(13u) or a distance from a point is not periodic there, and the join shows as a straight line across the surface every repeat. Use whole numbers of cells, or sines of 2π·k·u with integer k.',
      },
      {
        type: 'warning',
        title: 'Hard edges alias',
        body: 'floor() makes perfectly sharp edges, and far away many edges fall inside one pixel: the pattern shimmers (moiré). Image textures avoid this with mipmaps; procedural ones need their edges softened by the pixel\'s size (fwidth in GLSL).',
      },
      {
        type: 'insight',
        title: 'The graphics strand: texture scale and repeating',
        body: 'The Inspector\'s texture × multiplies the UVs before the formula: 2 gives four copies over the same surface, each half the size. The UV layout does not change; only the lookup does.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "any texture can be repeated". Every tile shows its texture twice in each direction. Stripes, bricks and grass meet themselves invisibly; wood shows a hard line down the middle and across, where its rings do not match; the checker\'s squares continue, but its tint jumps from red back to blue where each copy starts.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'tex.checker is Steps 2 and 5; tex.bricks adds the shift and the mortar test of Step 3; fract() is Step 1; the tiling cell compares the colour at both edges.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'MeshLab bakes each formula into a 256 × 256 image once (textureRGBA) and lets the GPU repeat and filter it; a shader could also evaluate the formula per pixel, at any resolution, with floor(), fract() and sin() in GLSL.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Inspector › Material › Texture and its ×. UV › Trace the texture formula (one face) follows one face\'s UV through the repeat and the formula (predict the cell or row) to its colour. In a script: obj.material.texture = "bricks", obj.traceTexture(face).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: procedural textures',
        caption: 'A checker and bricks from floor(), the tiling test, and every texture repeated twice.',
        props: {
          lesson: {
            title: 'Procedural textures',
            subtitle: 'Textures from formulas.',
            cells: [
              { type: 'js', instruction: '### 1. A checker\nPredict first: cell (3, 5).', startCode: CHECKER },
              { type: 'js', instruction: '### 2. Bricks\nPredict first: the row of v = 0.3.', startCode: BRICKS },
              { type: 'js', instruction: '### 3. Which textures tile?\nPredict first.', startCode: TILING },
              { type: 'js', instruction: '### 4. See it\nEach texture repeated twice.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 350 },
              { type: 'challenge', instruction: '### 5. Challenge: find the brick\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkBrick },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Procedural textures" in MeshLab](#/lab/mesh-lab?project=procedural-textures). Six tiles, six textures; one face of the brick tile is traced: press Play, and predict its row.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Inspector › Material › Texture** and **×** (the repeat).\n- **Edit mode, select a face, UV › Trace the texture formula.**\n- In a script: `obj.material.texture = "wood"`, `obj.material.textureScale = 2`, `obj.traceTexture(face)`.\n- [Open "Dining set"](#/lab/mesh-lab?project=dining-set) for wood, and [the low-poly island](#/lab/mesh-lab?project=island) for grass.\n- **Elsewhere:** Blender\'s Brick, Checker, Wave and Noise texture nodes; The Book of Shaders.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Cells.** $i = \\lfloor nu \\rfloor$ and the in-cell coordinate $\\{nu\\} = nu - \\lfloor nu \\rfloor$ split $[0, 1)$ into $n$ cells. A checker is $(i + j) \\bmod 2$; bricks use $i = \\lfloor 4u + \\tfrac12 (j \\bmod 2) \\rfloor$ with $j = \\lfloor 8v \\rfloor$.',
      '**Repeat.** With scale $s$, the texture is read at $(\\{su\\}, \\{sv\\})$, so the texture has period $1/s$ on the surface.',
      '**Tiling.** The repeated texture is continuous across the joins iff $f(0, v) = f(1, v)$ and $f(u, 0) = f(u, 1)$: $f$ extended periodically has no jump. Cell patterns with an integer number of cells satisfy it; $\\sin(2\\pi k u)$ does iff $k$ is an integer.',
      '**Wood rings.** $r = 24\\,\\big|(u - \\tfrac12, \\tfrac14(v - \\tfrac12) + 1.2)\\big|$ is the distance from an axis outside the square; $\\tfrac12 + \\tfrac12\\sin 2\\pi r$ makes one light and one dark band per unit of $r$, and stretching $v$ by $\\tfrac14$ turns circles into long grain.',
    ],
    equations: [
      { label: 'Checker', latex: '(\\lfloor 8u \\rfloor + \\lfloor 8v \\rfloor) \\bmod 2' },
      { label: 'Brick column', latex: '\\Big\\lfloor 4u + \\tfrac12\\,(\\lfloor 8v \\rfloor \\bmod 2)\\Big\\rfloor' },
      { label: 'Repeat', latex: '(u, v) \\mapsto (\\{su\\}, \\{sv\\})' },
      { label: 'Tiling', latex: 'f(0, v) = f(1, v), \\quad f(u, 0) = f(u, 1)' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** A function f on [0, 1)² extends to a continuous function on the torus (and so tiles the plane without seams) iff it is continuous on the square and its values agree on opposite edges. Piecewise-constant cell patterns are continuous at the joins when their cell boundaries include the square\'s edges and the pattern\'s index period divides the cell count.',
      '**Invariant viewpoint.** A procedural texture is defined in UV space, so it follows the UV map: moving or deforming the mesh carries the pattern with it, and distortion in the UVs (lesson 8.5) shows as distortion in the bricks.',
      '**Geometric picture.** Wallpaper: a design printed on a roll matches itself at the edges so strips join invisibly; a photograph cut into strips does not.',
      '**Where this goes.** Lesson 9.7 writes shader code that evaluates such formulas per pixel; chapter 10 animates them over time.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-9-006-ex1',
      title: 'A stripe',
      problem: 'Which of 10 stripes is u = 0.47 in, and is it dark or orange?',
      steps: [{ expression: '\\lfloor 4.7 \\rfloor = 4', annotation: 'Even.' }],
      conclusion: 'Stripe 4: dark.',
    },
    {
      id: 'modelling-geometry-9-006-ex2',
      title: 'A shifted row',
      problem: 'At u = 0.2, v = 0.15, which brick?',
      steps: [{ expression: '\\lfloor 8 \\cdot 0.15 \\rfloor = 1', annotation: 'Odd row: shift.' }, { expression: '\\lfloor 0.8 + 0.5 \\rfloor = 1', annotation: 'Brick column.' }],
      conclusion: 'Row 1, brick 1.',
    },
    {
      id: 'modelling-geometry-9-006-ex3',
      title: 'Does it tile?',
      problem: 'Does sin(2π · 3.5 u) tile when repeated?',
      steps: [{ expression: '\\sin(0) = 0 \\ne \\sin(7\\pi) \\text{\'s slope}', annotation: 'Values match, slopes do not.' }],
      conclusion: 'No: 3.5 turns leave the wave going the other way at the join, a visible crease. 3 or 4 turns tile.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-9-006-ch1',
      difficulty: 'easy',
      problem: 'Why are alternate rows of bricks shifted half a brick?',
      walkthrough: [{ expression: 'rx = 4u + \\tfrac12 \\text{ on odd rows}', annotation: 'Staggered joints.' }],
      answer: 'Real walls stagger their vertical joints so no crack runs straight up; the half-brick shift on odd rows reproduces that pattern.',
    },
    {
      id: 'modelling-geometry-9-006-ch2',
      difficulty: 'medium',
      problem: 'A texture uses sin(50u). Will it tile, and how would you fix it?',
      walkthrough: [{ expression: '50 / 2\\pi = 7.96', annotation: 'Not a whole number of turns.' }],
      answer: 'No: 50 radians is 7.96 turns, so u = 0 and u = 1 meet at different phases. Use sin(2π · 8 u), 8 whole turns, which is nearly the same frequency and tiles.',
    },
    {
      id: 'modelling-geometry-9-006-ch3',
      difficulty: 'hard',
      problem: 'Show that the brick pattern tiles: f(u + 1, v) = f(u, v) and f(u, v + 1) = f(u, v).',
      walkthrough: [
        { expression: 'r_x(u + 1) = r_x(u) + 4', annotation: 'Four whole bricks further along.' },
        { expression: '\\lfloor r_x + 4 \\rfloor \\bmod 4 = \\lfloor r_x \\rfloor \\bmod 4', annotation: 'The same shade, and the same position in the brick.' },
        { expression: '\\lfloor 8(v + 1) \\rfloor = \\lfloor 8v \\rfloor + 8', annotation: 'Eight rows on: same parity, same row mod 8.' },
      ],
      answer: 'Moving u by 1 adds exactly 4 to rx: the position inside the brick (and so the mortar test) is unchanged, and the shade uses floor(rx) mod 4, which is unchanged too. Moving v by 1 adds 8 to the row: an even number, so the half-brick shift is the same, and the shade uses row mod 8. So f(u + 1, v) = f(u, v) and f(u, v + 1) = f(u, v): the texture is periodic and repeats with no join. (Without the mod 4, the half brick at the end of an odd row and its other half at the start of the next copy would get different shades.)',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\lfloor nu \\rfloor', meaning: 'Which of n cells u is in.' },
      { symbol: '\\{nu\\}', meaning: 'Where in that cell (the fractional part).' },
      { symbol: '(i + j) \\bmod 2', meaning: 'The checker\'s parity.' },
      { symbol: 's', meaning: 'Texture scale: the number of repeats.' },
      { symbol: '\\sin(2\\pi k u)', meaning: 'A band pattern that tiles for integer k.' },
      { symbol: 'f(0, v) = f(1, v)', meaning: 'The tiling condition.' },
    ],
    rulesOfThumb: [
      'floor() for cells, fract() for inside them.',
      'Shift alternate rows for bricks.',
      'Sines for bands and fake noise.',
      'Whole numbers of cells or turns, or it shows.',
      'Soften hard edges far away.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-8-001', label: 'What UVs are', note: 'The (u, v) the formulas take.' },
      { lessonId: 'modelling-geometry-9-001', label: 'Light and the cosine law', note: 'The base colour a texture feeds.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-9-007', label: 'Write a shader', note: 'Formulas evaluated per pixel.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-9-006-1', label: 'Read cells with floor() and parity', type: 'read' },
    { id: 'cp-modelling-geometry-9-006-2', label: 'Read bricks, wood and sine noise', type: 'read' },
    { id: 'cp-modelling-geometry-9-006-3', label: 'Read repeating and the tiling condition', type: 'read' },
    { id: 'cp-modelling-geometry-9-006-4', label: 'Run cells 1 to 3: checker, bricks, tiling', type: 'lab' },
    { id: 'cp-modelling-geometry-9-006-5', label: 'Trace a texture formula in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-9-006-6', label: 'Work through example 2, a shifted row', type: 'example' },
    { id: 'cp-modelling-geometry-9-006-7', label: 'Work through example 3, does it tile?', type: 'example' },
    { id: 'cp-modelling-geometry-9-006-8', label: 'Complete the challenge: find the brick', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-9-006-assess-1',
        type: 'choice',
        text: 'With texture scale 3, the point u = 0.5 reads the texture at:',
        options: ['0.5', '1.5', '0.1667', '0'],
        answer: '0.5',
        hint: 'The fractional part of 1.5.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-9-006-quiz-1',
      type: 'choice',
      text: 'In an 8 × 8 checker, cell (3, 5) is:',
      options: ['White (3 + 5 is even)', 'Coloured', 'A border', 'Depends on the scale'],
      answer: 'White (3 + 5 is even)',
      hints: ['Cell 1.', 'Parity.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-9-006-quiz-2',
      type: 'choice',
      text: 'Alternate brick rows are shifted by:',
      options: ['Half a brick', 'A whole brick', 'A quarter brick', 'Nothing'],
      answer: 'Half a brick',
      hints: ['Cell 2.', 'Challenge 1.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-9-006-quiz-3',
      type: 'choice',
      text: 'Which of MeshLab\'s textures shows a join when repeated?',
      options: ['Wood', 'Stripes', 'Bricks', 'Grass'],
      answer: 'Wood',
      hints: ['Cell 3.', 'Its rings are not periodic.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-9-006-quiz-4',
      type: 'choice',
      text: 'sin(2πku) tiles across the repeat when:',
      options: ['k is a whole number', 'k is large', 'k is small', 'Always'],
      answer: 'k is a whole number',
      hints: ['Example 3.', 'Math, Tiling.'],
      reviewSection: 'Math',
    },
    {
      id: 'modelling-geometry-9-006-quiz-5',
      type: 'choice',
      text: 'A texture scale of 2 makes the pattern:',
      options: ['Repeat twice across the same surface, half the size', 'Twice as big', 'Twice as bright', 'Move'],
      answer: 'Repeat twice across the same surface, half the size',
      hints: ['The graphics strand.', 'fract(2u).'],
      reviewSection: 'Intuition',
    },
    {
      id: 'modelling-geometry-9-006-quiz-6',
      type: 'choice',
      text: 'Why do procedural checkers shimmer in the distance?',
      options: ['Their sharp edges alias when many fall inside one pixel', 'They are low resolution', 'The formula is random', 'Lighting'],
      answer: 'Their sharp edges alias when many fall inside one pixel',
      hints: ['Warning "Hard edges alias".', 'No mipmaps.'],
      reviewSection: 'Warning "Hard edges alias"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Any texture can be repeated.',
      whyStudentsThinkIt: 'Repeating just copies it.',
      correctionExample: 'Cell 3 and the picture: wood\'s copies meet at a visible line.',
      contrastCase: 'Formulas periodic over the square (stripes, bricks, grass) repeat invisibly.',
    },
    {
      falseBelief: 'Noise needs random numbers.',
      whyStudentsThinkIt: 'It looks random.',
      correctionExample: 'Grass is sines: the same (u, v) always gives the same green, so it is stable frame to frame.',
      contrastCase: 'Truly random values per frame would flicker.',
    },
    {
      falseBelief: 'A procedural texture has a resolution.',
      whyStudentsThinkIt: 'Images do.',
      correctionExample: 'The formula can be evaluated at any (u, v); MeshLab only bakes it into 256 × 256 for the GPU.',
      contrastCase: 'Once baked, it does have that resolution.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A large floor needs a wood texture without a repeating join every metre.',
      competingTechniques: ['Repeat the wood texture 10 times', 'Unwrap each plank separately, each with its own offset into a single non-repeating texture'],
      whyThisTechniqueWins: 'Wood is not periodic, so repeats show; giving every plank its own UV region avoids the joins and adds variety.',
    },
    {
      situation: 'A shader needs a lawn texture that never shows a seam on a huge terrain.',
      competingTechniques: ['sin(91.7u) noise', 'Sines of 2π·k·u with integer k, or proper periodic noise'],
      whyThisTechniqueWins: 'Only periodic formulas tile; the integer frequencies keep the look while removing the join.',
    },
  ],

  debugging: [
    {
      commonError: 'A visible straight line across a repeated texture.',
      symptom: 'A seam every repeat.',
      whyItHappened: 'The formula is not periodic over the unit square.',
      repairStrategy: 'Use whole numbers of cells or turns (2πk with integer k).',
    },
    {
      commonError: 'Brick joints lined up vertically.',
      symptom: 'The wall looks like tiles.',
      whyItHappened: 'The half-brick shift on odd rows is missing.',
      repairStrategy: 'rx = 4u + ½ (row mod 2).',
    },
    {
      commonError: 'Negative UVs breaking the pattern.',
      symptom: 'Mirrored or jumbled cells where u < 0.',
      whyItHappened: 'x % 1 is negative for negative x in JavaScript and GLSL\'s mod differs.',
      repairStrategy: 'Use x − floor(x) (fract) for the repeat.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Write checker, stripe and brick formulas and test whether a texture tiles.',
    explainVerbally: 'Explain floor, fract and periodic sines in textures, and the repeat.',
    detectIncorrectApplication: 'Recognise non-periodic joins, missing brick shifts and negative-UV errors.',
    transferToUnfamiliar: 'Design tiling textures and choose when to unwrap instead of repeat.',
  },
};
