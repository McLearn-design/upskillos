// Lesson 1.7: files, OBJ and glTF (docs/modelling-course-plan.md). Four parts: the maths (index bases, bytes
// and buffers), building it (writing and reading OBJ, writing a glTF buffer and decoding it as a loader does,
// and a graded fix of a broken OBJ file), watching MeshLab do it (a traced OBJ read in Predict mode), and using
// the tool (File › Import and Export, round trips with Blender).
import { withPicture } from '../notebookScene.js';

const PYRAMID = `const vertices = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [0, 1.5, 0]]
const faces = [[0, 1, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]]`;

const WRITE_OBJ = `// The pyramid from lesson 1.2 as two lists, written as an OBJ file.
${PYRAMID}

const lines = [
  'o Pyramid',
  ...vertices.map((v) => 'v ' + v.join(' ')),
  ...faces.map((f) => 'f ' + f.map((i) => i + 1).join(' ')),   // OBJ counts vertices from 1
]
console.log(lines.join('\\n'))`;

const READ_OBJ = `// Read OBJ text back into two lists, as an importer does.
const text = \`# real files carry more than v and f lines
o Pyramid
v -1 0 -1
v 1 0 -1
v 1 0 1
v -1 0 1
v 0 1.5 0
vn 0 -1 0
f 1//1 2//1 3//1 4//1
f -4 -5 -1
f 3 2 5
f 4 3 5
f 1 4 5\`

const vertices = [], faces = []
for (const line of text.split('\\n')) {
  const [tag, ...rest] = line.trim().split(/\\s+/)
  if (tag === 'v') vertices.push(rest.map(Number))
  if (tag === 'f') faces.push(rest.map((corner) => {
    const n = parseInt(corner.split('/')[0], 10)          // "1//1": the vertex is the number before the first slash
    return n < 0 ? vertices.length + n : n - 1           // negative counts back from the last v line; else subtract 1
  }))
}
console.log(vertices.length + ' vertices; faces ' + JSON.stringify(faces))
console.log('same as the lists we started from: ' + (JSON.stringify(faces) === JSON.stringify([[0, 1, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]])))`;

const GLTF_SRC = `// Write the pyramid as glTF: triangles, positions as 32-bit floats, indices as 16-bit integers, in one buffer.
function writeGltf(vertices, faces) {
  const triangles = faces.flatMap((f) => f.slice(1, -1).map((_, i) => [f[0], f[i + 1], f[i + 2]]))   // a fan per face
  const positions = new Float32Array(vertices.flat())       // 4 bytes per number
  const indices = new Uint16Array(triangles.flat())         // 2 bytes per index
  const bytes = new Uint8Array(positions.byteLength + indices.byteLength)
  bytes.set(new Uint8Array(positions.buffer), 0)
  bytes.set(new Uint8Array(indices.buffer), positions.byteLength)
  const base64 = btoa(String.fromCharCode(...bytes))
  const gltf = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: bytes.length, uri: 'data:application/octet-stream;base64,' + base64 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 },                   // ARRAY_BUFFER
      { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength, target: 34963 },  // ELEMENT_ARRAY_BUFFER
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: vertices.length, type: 'VEC3',                       // FLOAT
        min: [0, 1, 2].map((j) => Math.min(...vertices.map((v) => v[j]))), max: [0, 1, 2].map((j) => Math.max(...vertices.map((v) => v[j]))) },
      { bufferView: 1, componentType: 5123, count: indices.length, type: 'SCALAR' },                    // UNSIGNED_SHORT
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],                  // 4: TRIANGLES
    nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
  }
  return { gltf, triangles, positions, indices, base64 }
}`;

const WRITE_GLTF = `${PYRAMID}

${GLTF_SRC}

const { gltf, triangles, positions, indices, base64 } = writeGltf(vertices, faces)
console.log('triangles: ' + triangles.length + ' (the square base became 2)')
console.log('positions: ' + vertices.length + ' × 3 floats × 4 bytes = ' + positions.byteLength + ' bytes')
console.log('indices: ' + indices.length + ' × 2 bytes = ' + indices.byteLength + ' bytes')
console.log('buffer: ' + gltf.buffers[0].byteLength + ' bytes, ' + base64.length + ' characters of base64')
console.log('position accessor: ' + JSON.stringify(gltf.accessors[0]))`;

const DECODE = `${PYRAMID}

${GLTF_SRC}

// Read it back as a loader does: decode the buffer, then view its bytes through each accessor.
const { gltf } = writeGltf(vertices, faces)
const bytes = Uint8Array.from(atob(gltf.buffers[0].uri.split(',')[1]), (c) => c.charCodeAt(0))
const view = (a) => {
  const bv = gltf.bufferViews[a.bufferView], per = a.type === 'VEC3' ? 3 : 1
  const Type = a.componentType === 5126 ? Float32Array : Uint16Array
  return new Type(bytes.buffer, bv.byteOffset, a.count * per)   // the bytes, read as numbers: no parsing
}
const pos = view(gltf.accessors[0]), idx = view(gltf.accessors[1])
const verts = Array.from({ length: pos.length / 3 }, (_, i) => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]])
const tris = Array.from({ length: idx.length / 3 }, (_, i) => [idx[3 * i], idx[3 * i + 1], idx[3 * i + 2]])
console.log('decoded: ' + verts.length + ' vertices, ' + tris.length + ' triangles')
console.log('the same points: ' + (JSON.stringify(verts) === JSON.stringify(vertices)))
show({ verts, faces: tris })`;

const CHALLENGE = `// This exporter has a bug: it wrote the face lines counting from 0, as arrays do. Fix the f lines so the
// file reads back as the pyramid, every face pointing out. Leave the v lines alone.
const obj = \`o Pyramid
v -1 0 -1
v 1 0 -1
v 1 0 1
v -1 0 1
v 0 1.5 0
f 0 1 2 3
f 1 0 4
f 2 1 4
f 3 2 4
f 0 3 4\`

// Read it as an OBJ reader does, and draw what it gets (a face naming a vertex that does not exist is skipped).
const vertices = [], faces = []
for (const line of obj.split('\\n')) {
  const [tag, ...rest] = line.trim().split(/\\s+/)
  if (tag === 'v') vertices.push(rest.map(Number))
  if (tag === 'f') {
    const f = rest.map((c) => { const n = parseInt(c, 10); return n < 0 ? vertices.length + n : n - 1 })
    if (f.every((i) => i >= 0 && i < vertices.length)) faces.push(f)
  }
}
console.log(faces.length + ' faces read: ' + JSON.stringify(faces))
show({ verts: vertices, faces })`;

const SOLVED = CHALLENGE.replace('f 0 1 2 3\nf 1 0 4\nf 2 1 4\nf 3 2 4\nf 0 3 4', 'f 1 2 3 4\nf 2 1 5\nf 3 2 5\nf 4 3 5\nf 1 4 5');

const RIGHT = [[0, 1, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]];
const V_LINES = ['v -1 0 -1', 'v 1 0 -1', 'v 1 0 1', 'v -1 0 1', 'v 0 1.5 0'];

/** The challenge's check: read the OBJ text as a reader would, and say which line is wrong and why. */
export function checkObj(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+obj\s*=\s*`([\s\S]*?)`/);
  if (!m) return no('Keep the file as const obj = `…`, between backticks.');
  const lines = m[1].split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const v = lines.filter((l) => l.startsWith('v '));
  if (v.length !== 5 || v.some((l, i) => l.replace(/\s+/g, ' ') !== V_LINES[i])) return no('Leave the five v lines as they were: only the f lines need fixing.');
  const fLines = lines.filter((l) => l.startsWith('f '));
  if (fLines.length !== 5) return no(`The pyramid has 5 faces; the file has ${fLines.length} f lines.`);
  const faces = [];
  for (const line of fLines) {
    const nums = line.split(/\s+/).slice(1).map((c) => parseInt(c, 10));
    if (nums.some((n) => !Number.isInteger(n))) return no(`"${line}": every corner should be a whole number.`);
    if (nums.includes(0)) return no(`"${line}": OBJ counts vertices from 1, so there is no vertex 0.`);
    const bad = nums.find((n) => n > 5 || n < -5);
    if (bad !== undefined) return no(`"${line}" names vertex ${bad}, but the file has 5 vertices.`);
    faces.push({ line, f: nums.map((n) => (n < 0 ? 5 + n : n - 1)) });
  }
  const turns = (x, y) => x.length === y.length && x.some((_, s) => x.every((c, i) => c === y[(i + s) % y.length]));
  for (const { line, f } of faces) {
    if (RIGHT.some((r) => turns(f, r))) continue;
    if (RIGHT.some((r) => turns([...f].reverse(), r))) return no(`"${line}" reads as a face going the wrong way round: it points into the pyramid (lesson 1.2).`);
    return no(`"${line}" reads as corners ${f.join(', ')}, which is not a face of the pyramid.`);
  }
  if (new Set(faces.map(({ f }) => RIGHT.findIndex((r) => turns(f, r)))).size !== 5) return no('Two f lines are the same face, so one face of the pyramid is missing.');
  return { pass: true, message: 'All five faces read back as the pyramid, pointing out: each corner is the array index plus 1.' };
}

export default {
  id: 'modelling-geometry-1-007',
  slug: 'obj-and-gltf',
  chapter: 'modelling-geometry-1',
  order: 7,
  title: 'Files: OBJ and glTF',
  subtitle: 'The same two lists, written as text for people and as bytes for the GPU.',
  tags: ['meshes', 'file formats', 'obj', 'gltf', 'buffers'],
  aliases: 'obj wavefront gltf glb file format index base one-based zero-based buffer accessor bufferview float32 uint16 base64 import export blender meshlab',
  timeToComplete: 45,
  coreConcept: 'An OBJ file writes the two lists as text: a v line per vertex and an f line per face, with vertices counted from 1. glTF stores triangles in binary buffers that a program reads straight into GPU memory, described by accessors (what type, how many). OBJ keeps quads for editing; glTF is built for drawing.',
  prerequisites: ['modelling-geometry-1-006'],
  nextLesson: null,

  hook: {
    question: 'You send a model from MeshLab to Blender and back as OBJ, and its quads survive. Send it as glTF and they come back as triangles. Why do the two formats keep different things, and what is actually inside each file?',
    realWorldContext: 'OBJ is the oldest common format and still the easiest way to move a model between modelling tools. glTF (and its binary form GLB) is what the web, game engines and AR viewers load. Knowing what each stores is how you choose, and how you debug an import that looks wrong.',
  },

  intuition: {
    prose: [
      'An **OBJ** file is the two lists from lesson 1.1 written as text. Each vertex is a line `v x y z`; each face is a line `f` followed by its corners. Open one in a text editor and you can read it. The pyramid is 5 v lines and 5 f lines.',
      'The catch is the counting. OBJ numbers vertices from 1, in the order their v lines appear; arrays number from 0. So the face `[0, 1, 2, 3]` is written `f 1 2 3 4`, and a reader subtracts 1 again. Forgetting either step is the most common OBJ bug: everything shifts by one vertex.',
      'Real OBJ files carry more: `vt` lines (texture coordinates), `vn` lines (normals), and corners like `1/2/3` that give a vertex, a texture coordinate and a normal for that corner. A negative number counts back from the last v line so far: `-1` is the latest. A reader that only needs the shape takes the first number of each corner.',
      'A **glTF** file is written for the GPU instead. It stores triangles, because that is what the GPU draws, so the pyramid\'s square base becomes 2 triangles and the file holds 6. The numbers are not text but bytes: every coordinate a 4-byte float, every corner index a 2-byte integer, packed into one **buffer**. The pyramid\'s buffer is 60 bytes of positions and 36 of indices.',
      'Before reading on, predict: how does a reader know where the positions end and the indices start? A JSON part describes the buffer. **Buffer views** say which bytes are which (positions are bytes 0 to 59, indices 60 to 95), and **accessors** say how to read them: 5 values of type VEC3, each 3 floats; 18 values of type SCALAR, each an unsigned 16-bit integer. A loader does no parsing at all: it views the bytes as numbers and hands them to the GPU.',
      'So the two formats keep different things. OBJ keeps faces of any size, so quads and n-gons survive a round trip, and it is the format for swapping models between modelling tools. glTF keeps what drawing needs, triangles in GPU-ready buffers, plus materials, animation and scenes, and it is the format for delivering a finished model.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Read an OBJ file',
        body: 'Step 1. Split the text into lines; skip empty lines and lines starting with #.\nStep 2. A `v` line: push its three numbers onto the vertex list.\nStep 3. An `f` line: for each corner take the number before any slash; if it is negative add the vertex count so far, otherwise subtract 1.\nStep 4. Push the converted corners as a face. Ignore `vt`, `vn` and other lines unless you need them.',
      },
      {
        type: 'warning',
        title: 'Off by one',
        body: 'A face line with a 0 in it is always wrong: OBJ has no vertex 0. An exporter that forgets to add 1 writes such lines, and a reader that forgets to subtract 1 draws every face one vertex out, a tangle of wrong triangles.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: what glTF hands the GPU',
        body: 'Each buffer view marked ARRAY_BUFFER (34962) becomes a GPU vertex buffer, and each accessor describes it exactly as the GPU needs: component type FLOAT (5126), 3 per vertex, how many. The ELEMENT_ARRAY_BUFFER (34963) view becomes the index buffer, and mode 4 says to draw triangles. Nothing is converted on the way, which is why glTF loads fast. OBJ text has to be parsed number by number, and its separate v/vt/vn numbers per corner have to be combined into GPU vertices first.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: OBJ and glTF',
        props: {
          lesson: {
            title: 'Writing and reading mesh files',
            subtitle: 'Write and read OBJ, pack a glTF buffer, decode it as a loader does, and fix an exporter\'s off-by-one.',
            cells: [
              { type: 'js', instruction: '### 1. Write OBJ\nThe pyramid\'s lists as text. Every face corner is its array index plus 1.', startCode: WRITE_OBJ },
              { type: 'js', instruction: '### 2. Read OBJ\nA file with a normal line, corners written 1//1, and a face written with negative numbers. Reading it gives back exactly the lists we started from.', startCode: READ_OBJ },
              { type: 'js', instruction: '### 3. Write glTF\nTriangulate, pack the positions as 4-byte floats and the indices as 2-byte integers into one buffer, and describe it with buffer views and accessors: 96 bytes in all.', startCode: WRITE_GLTF },
              { type: 'js', instruction: '### 4. Read it back as a loader does\nDecode the buffer and view its bytes through the accessors: the numbers come out without any parsing. Drag the picture to turn the 6 triangles.', startCode: withPicture(DECODE), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 5. Challenge: fix the exporter\'s file\nThe f lines were written counting from 0. Run it first: the reader skips the three lines with a 0 and builds two faces from the others, both wrong, every corner one vertex off. Fix the lines so the file reads back as the pyramid with every face pointing out. The check reads your file as an OBJ reader would and names the first line that is wrong.', startCode: withPicture(CHALLENGE), solutionCode: withPicture(SOLVED), check: checkObj, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "OBJ files" in MeshLab](#/lab/mesh-lab?project=obj-files). It reads the pyramid from OBJ text with **Record traces** on, one trace step per line. The Algorithm trace is in **Predict** mode: at the first face line, f 1 2 3 4, it asks which vertex numbers MeshLab stores. Then the script writes the scene back out as OBJ, numbered from 1 again. Change a face in edit mode and write it out once more to see its line change.' },
              { type: 'markdown', instruction: '### Use the tool\n- **File › Import OBJ / glTF / GLB…** reads a file into new objects. OBJ keeps its faces as they are; glTF arrives as triangles, welded (lesson 1.6).\n- **File › Export OBJ** writes every visible mesh, quads and all, for Blender. **File › Export GLB** writes binary glTF: triangles, plus the scene and animation.\n- In a script: scene.fromOBJ(text) and scene.toOBJ().\n- **In Blender:** the File menu imports and exports Wavefront (.obj) and glTF 2.0 (.glb/.gltf). Use OBJ to keep editing a model, glTF to deliver one.\n- For the same files from the engineering side (STL, units, what a CAD export contains), see [Mesh Files in the Mesh Engine course](#/chapter/mesh-engine-1/mesh-files).' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      'Index bases: if an array stores vertex $i$ at position $i$ (0-based), OBJ calls it $i + 1$ (1-based). Writing adds 1 to every corner; reading subtracts 1. A negative OBJ index $n$ means $V_{\\text{so far}} + n$ in 0-based terms, so $-1$ is the last vertex read.',
      'A face with $k$ corners becomes $k - 2$ triangles when fanned from its first corner. The pyramid: $2 + 4 \\times 1 = 6$ triangles, $3 \\times 6 = 18$ indices.',
      'Sizes: a FLOAT is 4 bytes, an UNSIGNED_SHORT 2 bytes (indices up to 65,535; larger meshes use 4-byte UNSIGNED_INT). The pyramid\'s positions take $5 \\times 3 \\times 4 = 60$ bytes and its indices $18 \\times 2 = 36$, so the buffer is 96 bytes. Base64 writes every 3 bytes as 4 characters: $96 / 3 \\times 4 = 128$ characters.',
      'An accessor of type VEC3 and component type FLOAT, starting at byte offset $o$, gives vertex $i$ at bytes $o + 12i$ to $o + 12i + 11$. That fixed stride is what lets the GPU find vertex $i$ without reading the ones before it.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'OBJ indices are global across the file: every `o` object\'s faces count from the first v line of the whole file, not of the object. An importer that gives each object its own list has to renumber, as MeshLab does; one that restarts the count per object reads every object after the first wrong.',
      'Byte alignment: glTF requires each accessor\'s data to start at a multiple of its component size, so floats on 4-byte boundaries and shorts on 2-byte ones. Putting the 60 bytes of positions first leaves the indices at byte 60, which is aligned. The order matters when a file mixes sizes.',
      'What each format loses: OBJ has no standard for animation, rigs or scene hierarchy, and its materials live in a separate .mtl file. glTF loses faces larger than triangles, and it splits a vertex wherever its normal or texture coordinate differs, because a GPU vertex carries exactly one of each: a flat-shaded cube is 24 glTF vertices, not 8.',
      'The edge table, pieces and V − E + F (lessons 1.3 to 1.5) work on either, once it is read into two lists. A glTF read in as triangles with split vertices needs welding (lesson 1.6) before those counts mean anything: MeshLab welds on import for that reason.',
    ],
    callouts: [
      { type: 'insight', title: 'Bridge: from index bases to code', body: 'i + 1 on the way out and n − 1 on the way in are the whole conversion, in cells 1 and 2.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'new Float32Array(bytes.buffer, offset, count) in cell 4 is what a loader does before handing the array to WebGL.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'File › Export OBJ and scene.toOBJ() add 1 to every index; scene.fromOBJ() and File › Import subtract it, traced line by line.' },
    ],
    visualizations: [],
  },

  examples: [
    {
      id: 'modelling-geometry-1-007-ex1',
      title: 'Writing a face',
      difficulty: 'easy',
      problem: 'Write the face [3, 2, 4] as an OBJ line.',
      steps: [{ expression: '[3, 2, 4] \\to f\\ 4\\ 3\\ 5', annotation: 'Add 1 to each corner.', strategyTitle: 'Step 1: Shift' }],
      answer: 'f 4 3 5',
    },
    {
      id: 'modelling-geometry-1-007-ex2',
      title: 'Reading negative indices',
      difficulty: 'medium',
      problem: 'After 5 v lines, a file has the line f -4 -5 -1. Which 0-based vertices is that?',
      steps: [
        { expression: '-4 \\to 5 - 4 = 1', annotation: 'Add the count so far.', strategyTitle: 'Step 1: First corner' },
        { expression: '-5 \\to 0,\\ -1 \\to 4', annotation: 'The same for the others: −1 is the last vertex read.', strategyTitle: 'Step 2: The rest' },
      ],
      answer: '[1, 0, 4]: the pyramid\'s face 1.',
    },
    {
      id: 'modelling-geometry-1-007-ex3',
      title: 'Sizing a glTF buffer',
      difficulty: 'hard',
      problem: 'A closed cube of 6 quads, 8 vertices, positions only. How many bytes are its positions and indices in glTF?',
      steps: [
        { expression: '6 \\times 2 = 12 \\text{ triangles},\\ 36 \\text{ indices}', annotation: 'Each quad fans into 2 triangles.', strategyTitle: 'Step 1: Triangles' },
        { expression: '8 \\times 12 = 96,\\quad 36 \\times 2 = 72', annotation: '12 bytes per position, 2 per index.', strategyTitle: 'Step 2: Bytes' },
      ],
      answer: '96 bytes of positions and 72 of indices: 168 bytes. (With flat normals each corner would need its own vertex: 24 vertices.)',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-1-007-ch1',
      title: 'Spot the bug',
      difficulty: 'easy',
      problem: 'An OBJ file has the line f 0 1 2. What is wrong?',
      hint: 'Where does OBJ start counting?',
      answer: 'OBJ has no vertex 0: the exporter wrote 0-based indices. It should have written f 1 2 3.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-1-007-ch2',
      title: 'Quads in, triangles out',
      difficulty: 'medium',
      problem: 'A model of 1,000 quads is exported as glTF and imported again. How many faces come back?',
      hint: 'glTF stores triangles.',
      answer: '2,000 triangles: each quad was split along a diagonal. Export OBJ to keep the quads.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-1-007-ch3',
      title: 'Bigger than 16 bits',
      difficulty: 'hard',
      problem: 'A scan has 120,000 vertices. Can its glTF indices be UNSIGNED_SHORT?',
      hint: 'What is the largest 16-bit unsigned number?',
      answer: 'No: 16 bits reach 65,535. It needs UNSIGNED_INT (5125), 4 bytes per index, or splitting into pieces of at most 65,536 vertices.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      { symbol: '\\text{v } x\\ y\\ z', meaning: 'An OBJ vertex line.' },
      { symbol: '\\text{f } a\\ b\\ c', meaning: 'An OBJ face line: its corners, counted from 1.' },
      { symbol: '\\text{buffer}', meaning: 'The raw bytes of a glTF file: numbers packed back to back.' },
      { symbol: '\\text{buffer view}', meaning: 'Which bytes of the buffer hold one kind of data.' },
      { symbol: '\\text{accessor}', meaning: 'How to read a buffer view: component type, values per element, how many.' },
      { symbol: '\\text{index base}', meaning: 'Whether counting starts at 0 (arrays, glTF) or 1 (OBJ).' },
    ],
    rulesOfThumb: [
      'Writing OBJ: add 1. Reading OBJ: subtract 1 (or add the count to a negative).',
      'OBJ to keep editing (quads survive); glTF to deliver (triangles, GPU-ready).',
      'A 0 in an OBJ face line is always a bug.',
      'After importing triangles, weld before counting edges or pieces.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'OBJ and glTF store the same thing in different syntax.',
      whyStudentsThinkIt: 'Both open as the same-looking model.',
      correctionExample: 'The pyramid is 5 faces in OBJ and 6 triangles in glTF; a flat-shaded cube is 8 vertices in OBJ and 24 in glTF.',
      contrastCase: 'The shape is the same; what is stored differs, because the formats serve different jobs.',
    },
    {
      falseBelief: 'Vertex numbers in an OBJ file restart for each object.',
      whyStudentsThinkIt: 'Each o line looks like a fresh start.',
      correctionExample: 'In a file with two cubes, the second cube\'s faces use numbers 9 to 16.',
      contrastCase: 'MeshLab renumbers each imported object from 0, but the file itself counts through.',
    },
  ],

  transferPrompts: [
    {
      situation: 'You are sending a model to a colleague who will keep editing it in Blender.',
      competingTechniques: ['Export OBJ', 'Export GLB'],
      whyThisTechniqueWins: 'OBJ keeps quads and n-gons, so edge loops and subdivision still work; GLB would arrive triangulated.',
    },
    {
      situation: 'A finished, animated model has to load quickly on a web page.',
      competingTechniques: ['Export GLB', 'Export OBJ'],
      whyThisTechniqueWins: 'GLB is binary and GPU-ready, and carries the animation and materials; OBJ has no animation and must be parsed as text.',
    },
  ],

  debugging: [
    {
      commonError: 'Reading OBJ face numbers without subtracting 1.',
      symptom: 'The model is a tangle of wrong triangles, or crashes on the last vertex.',
      whyItHappened: 'Every corner points at the next vertex along; the last points past the end.',
      repairStrategy: 'Subtract 1 from every positive face number (and handle negatives).',
    },
    {
      commonError: 'Restarting vertex numbers for each o object while reading.',
      symptom: 'The first object is right; every later one is built from the wrong vertices.',
      whyItHappened: 'OBJ numbers are global through the file.',
      repairStrategy: 'Keep one vertex list for the whole file, then split it per object if you need to.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Write and read OBJ, and pack and decode a minimal glTF buffer.',
    explainVerbally: 'Explain the index base difference, and why glTF stores triangles in binary buffers.',
    detectIncorrectApplication: 'Recognise off-by-one OBJ files and per-object renumbering bugs from what they draw.',
    transferToUnfamiliar: 'Choose a format for a job, and size a glTF buffer, including when 16-bit indices are not enough.',
  },

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-1-007-assess-1',
        type: 'choice',
        text: 'The face [0, 3, 4] is written in OBJ as…',
        options: ['f 1 4 5', 'f 0 3 4', 'f -1 2 3', 'f 4 5 1'],
        answer: 'f 1 4 5',
        hint: 'Add 1 to each corner.',
      },
    ],
  },

  quiz: [
    { id: 'modelling-geometry-1-007-quiz-1', type: 'choice', text: 'OBJ numbers vertices starting from…', options: ['1', '0', '−1', 'Whatever the file says'], answer: '1', hints: ['Arrays start at 0; OBJ does not.'], reviewSection: 'Intuition — the counting' },
    { id: 'modelling-geometry-1-007-quiz-2', type: 'choice', text: 'After 5 v lines, the corner −1 is the 0-based vertex…', options: ['4', '0', '−1', '5'], answer: '4', hints: ['The last vertex read.'], reviewSection: 'Examples — negative indices' },
    { id: 'modelling-geometry-1-007-quiz-3', type: 'choice', text: 'Why does a round trip through glTF lose quads?', options: ['glTF stores triangles', 'glTF rounds coordinates', 'glTF drops faces', 'It does not lose them'], answer: 'glTF stores triangles', hints: ['What does the GPU draw?'], reviewSection: 'Intuition — glTF' },
    { id: 'modelling-geometry-1-007-quiz-4', type: 'choice', text: 'The pyramid\'s glTF buffer is how many bytes?', options: ['96', '60', '36', '128'], answer: '96', hints: ['60 of positions, 36 of indices. 128 is the base64 length.'], reviewSection: 'Math — sizes' },
    { id: 'modelling-geometry-1-007-quiz-5', type: 'choice', text: 'What says how to read a glTF buffer view as numbers?', options: ['An accessor', 'The base64', 'The mesh name', 'The node'], answer: 'An accessor', hints: ['Component type, type, count.'], reviewSection: 'Intuition — buffer views and accessors' },
    { id: 'modelling-geometry-1-007-quiz-6', type: 'choice', text: 'Why does glTF load faster than OBJ?', options: ['Its bytes go to the GPU as they are, without parsing', 'It is always smaller', 'It skips the normals', 'Browsers cache it'], answer: 'Its bytes go to the GPU as they are, without parsing', hints: ['OBJ is text.'], reviewSection: 'Intuition — the graphics strand' },
  ],

  checkpoints: [
    { id: 'cp-modelling-geometry-1-007-1', label: 'Read how OBJ writes the two lists, counting from 1', type: 'read' },
    { id: 'cp-modelling-geometry-1-007-2', label: 'Read buffers, buffer views and accessors', type: 'read' },
    { id: 'cp-modelling-geometry-1-007-3', label: 'Read what glTF hands the GPU', type: 'read' },
    { id: 'cp-modelling-geometry-1-007-4', label: 'Complete the fix-the-exporter challenge in the notebook', type: 'lab' },
    { id: 'cp-modelling-geometry-1-007-5', label: 'Predict the face conversion in MeshLab\'s trace, then change a face and write the file again', type: 'lab' },
    { id: 'cp-modelling-geometry-1-007-6', label: 'Work through the negative-indices example', type: 'example' },
    { id: 'cp-modelling-geometry-1-007-7', label: 'Work through the glTF-sizing example', type: 'example' },
    { id: 'cp-modelling-geometry-1-007-8', label: 'Attempt the 16-bit challenge', type: 'challenge' },
  ],
};
