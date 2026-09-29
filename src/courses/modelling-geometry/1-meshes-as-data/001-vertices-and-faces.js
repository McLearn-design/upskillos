// Modelling & Geometry Processing, chapter 1, lesson 1: a mesh is two lists.
//
// The notebook cells below are plain JavaScript run in a sandboxed iframe. The
// drawing code (DRAW) is shared by the cells that show a picture; it loads
// three.js from a CDN with a dynamic import, so the learner's part of each cell
// stays a normal script with the two lists at the top.

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const VIEW_CSS = `#view{position:relative;height:300px;border-radius:8px;overflow:hidden;touch-action:none;cursor:grab;background:#0f1923}
#view canvas{display:block}
.lbl{position:absolute;transform:translate(-50%,-150%);font:12px ui-monospace,monospace;color:#ffd166;pointer-events:none;white-space:nowrap;text-shadow:0 0 3px #000,0 0 3px #000}
.row{margin-top:8px;font-size:13px;display:flex;gap:8px;align-items:center}`;

// Draws whatever `vertices` and `faces` hold, labels every vertex with its
// index (corners at the same place share one label: "6, 9, 12, 15"), and sets
// window.rebuild() so a cell can redraw after changing a list.
const DRAW = `

// ── Drawing ───────────────────────────────────────────────────────────
// Everything below turns the two lists into a picture with three.js.
// You don't need to read it for this lesson. Drag the picture to turn it.
var view = document.getElementById('view');
import('${THREE_URL}').then(function (THREE) {
  var W = view.clientWidth, H = view.clientHeight;
  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(W, H);
  view.appendChild(renderer.domElement);
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1923);
  var camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.6));
  var sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  var solid = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({
    color: 0x4f9dde, flatShading: true, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  var outline = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff }));
  scene.add(solid, outline);
  var labels = [];

  function usable(f) {
    return Array.isArray(f) && f.length >= 3 && f.every(function (i) { return Number.isInteger(i) && i >= 0 && i < vertices.length; });
  }

  // Rebuild the picture from whatever the two lists hold now.
  function rebuild() {
    var positions = [], triangles = [], lines = [];
    vertices.forEach(function (v) { positions.push(v[0], v[1], v[2]); });
    faces.filter(usable).forEach(function (f) {
      // The GPU draws triangles, so each face is cut into a fan from its first corner.
      for (var k = 1; k + 1 < f.length; k++) triangles.push(f[0], f[k], f[k + 1]);
      // The outline joins each corner to the next, and the last back to the first.
      f.forEach(function (a, k) {
        var b = f[(k + 1) % f.length];
        lines.push(vertices[a][0], vertices[a][1], vertices[a][2], vertices[b][0], vertices[b][1], vertices[b][2]);
      });
    });
    solid.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    solid.geometry.setIndex(triangles);
    solid.geometry.computeVertexNormals();
    outline.geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    // One label per place: corners at the same position share it.
    labels.forEach(function (l) { l.el.remove(); });
    labels = [];
    var byPlace = {};
    vertices.forEach(function (v, i) {
      var key = v.map(function (c) { return c.toFixed(3); }).join(',');
      if (!byPlace[key]) { byPlace[key] = { at: new THREE.Vector3(v[0], v[1], v[2]), names: [] }; labels.push(byPlace[key]); }
      byPlace[key].names.push(i);
    });
    labels.forEach(function (l) {
      l.el = document.createElement('div');
      l.el.className = 'lbl';
      l.el.textContent = l.names.join(', ');
      view.appendChild(l.el);
    });
  }

  var centre = new THREE.Vector3(), radius = 1;
  function frame() {
    var box = new THREE.Box3();
    vertices.forEach(function (v) { box.expandByPoint(new THREE.Vector3(v[0], v[1], v[2])); });
    // Leave room for the highest point the height slider can reach.
    var slider = document.getElementById('h');
    if (slider) box.expandByPoint(new THREE.Vector3(0, Number(slider.max), 0));
    box.getCenter(centre);
    radius = Math.max(0.5, box.getSize(new THREE.Vector3()).length() / 2);
  }

  var yaw = 0.6, pitch = 0.45, drag = null;
  view.addEventListener('pointerdown', function (e) { drag = [e.clientX, e.clientY]; view.setPointerCapture(e.pointerId); });
  view.addEventListener('pointerup', function () { drag = null; });
  view.addEventListener('pointermove', function (e) {
    if (!drag) return;
    yaw -= (e.clientX - drag[0]) * 0.01;
    pitch = Math.max(-1.4, Math.min(1.4, pitch + (e.clientY - drag[1]) * 0.01));
    drag = [e.clientX, e.clientY];
  });

  function loop() {
    var d = radius * 3.2;
    camera.position.set(centre.x + d * Math.cos(pitch) * Math.sin(yaw), centre.y + d * Math.sin(pitch), centre.z + d * Math.cos(pitch) * Math.cos(yaw));
    camera.lookAt(centre);
    renderer.render(scene, camera);
    labels.forEach(function (l) {
      var p = l.at.clone().project(camera);
      l.el.style.left = ((p.x + 1) / 2 * W) + 'px';
      l.el.style.top = ((1 - p.y) / 2 * H) + 'px';
    });
    requestAnimationFrame(loop);
  }

  window.rebuild = rebuild;
  rebuild();
  frame();
  loop();
}).catch(function (e) {
  view.textContent = 'The picture needs three.js, which could not load (' + e.message + '). The lists above still ran: see the console.';
});
`;

// ── The house challenge ─────────────────────────────────────────────────

// The fifteen real edges of the house in the challenge.
const HOUSE_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],          // floor
  [0, 4], [1, 5], [2, 6], [3, 7],          // wall corners
  [4, 7], [5, 6],                          // tops of the side walls
  [4, 8], [8, 5], [7, 9], [9, 6], [8, 9],  // roof
];
const HOUSE_VERTS = [
  [-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1],
  [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1],
  [0, 1.6, -1], [0, 1.6, 1],
];

/** Pull the `faces = [...]` list out of the learner's code without running it. */
function readFaces(code) {
  const start = code.search(/\b(?:const|let|var)\s+faces\s*=\s*\[/);
  if (start < 0) return null;
  let i = code.indexOf('[', start), depth = 0, end = -1;
  const text = code.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length)).replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  for (; i < text.length; i++) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']' && --depth === 0) { end = i; break; }
  }
  if (end < 0) return null;
  const literal = text.slice(text.indexOf('[', start), end + 1).replace(/,\s*\]/g, ']');
  try { return JSON.parse(literal); } catch { return null; }
}

/** Grade a face list for the house. Says what is wrong, never what to write. */
export function checkHouse(code) {
  const no = (message) => ({ pass: false, message });
  const faces = readFaces(code);
  if (!Array.isArray(faces) || !faces.every(Array.isArray)) {
    return no('Couldn\u2019t read your face list. Keep it as lists of plain numbers, like [0, 1, 2, 3], inside const faces = [ ... ].');
  }
  const n = HOUSE_VERTS.length;
  const edgeKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const real = new Set(HOUSE_EDGES.map(([a, b]) => edgeKey(a, b)));
  for (let k = 0; k < faces.length; k++) {
    const f = faces[k];
    if (f.length < 3) return no(`Face ${k} has ${f.length} corner${f.length === 1 ? '' : 's'}. A face needs at least three.`);
    const bad = f.find((i) => !Number.isInteger(i) || i < 0 || i >= n);
    if (bad !== undefined) return no(`Face ${k} uses vertex ${bad}, but the vertices are numbered 0 to ${n - 1}.`);
    if (new Set(f).size !== f.length) return no(`Face ${k} lists the same corner twice. Each corner of a face appears once.`);
    for (let j = 0; j < f.length; j++) {
      const a = f[j], b = f[(j + 1) % f.length];
      if (!real.has(edgeKey(a, b))) {
        return no(`Face ${k} goes straight from vertex ${a} to vertex ${b}, but those corners aren\u2019t joined by an edge of the house. List a face\u2019s corners in the order you meet them walking round its edge (the last one joins back to the first).`);
      }
    }
    // All corners in one flat plane: every corner is on the plane of the first three.
    const p = f.map((i) => HOUSE_VERTS[i]);
    const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
    const u = sub(p[1], p[0]), v = sub(p[2], p[0]);
    const nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (p.some((q) => Math.abs(nrm[0] * (q[0] - p[0][0]) + nrm[1] * (q[1] - p[0][1]) + nrm[2] * (q[2] - p[0][2])) > 1e-9)) {
      return no(`Face ${k}\u2019s corners don\u2019t all lie in one flat plane: it bends round a corner of the house. A face is flat, so split it where it bends.`);
    }
  }
  const sets = faces.map((f) => [...f].sort((a, b) => a - b).join(','));
  for (let k = 0; k < sets.length; k++) {
    const j = sets.indexOf(sets[k]);
    if (j !== k) return no(`Faces ${j} and ${k} cover the same piece of the house. Each piece needs one face.`);
  }
  const uses = new Map();
  for (const f of faces) f.forEach((a, j) => { const key = edgeKey(a, f[(j + 1) % f.length]); uses.set(key, (uses.get(key) ?? 0) + 1); });
  for (const [key, count] of uses) {
    if (count > 2) return no(`The edge from vertex ${key.replace('-', ' to vertex ')} has ${count} faces beside it. An edge of a closed surface has exactly two: one on each side.`);
  }
  const open = HOUSE_EDGES.map(([a, b]) => edgeKey(a, b)).filter((key) => (uses.get(key) ?? 0) < 2);
  if (open.length) {
    const unused = HOUSE_VERTS.map((_, i) => i).filter((i) => !faces.some((f) => f.includes(i)));
    const first = open[0].replace('-', ' to vertex ');
    return no(`${faces.length} face${faces.length === 1 ? '' : 's'} so far, and the house is still open: ${open.length} of its 15 edges have fewer than two faces beside them (for example the edge from vertex ${first}).` +
      (unused.length ? ` Vertices ${unused.join(', ')} aren\u2019t in any face yet.` : ''));
  }
  const slots = faces.reduce((s, f) => s + f.length, 0);
  return { pass: true, message: `${faces.length} faces and ${slots} corner slots. Every vertex is in exactly 3 faces, and 10 × 3 = ${slots}: the two ways of counting agree.` };
}

// ── Notebook cells ──────────────────────────────────────────────────────

const PYRAMID_LISTS = `// 1. Where each corner is: vertex i is the point [x, y, z].
const vertices = [
  [-1, 0, -1],   // vertex 0
  [ 1, 0, -1],   // vertex 1
  [ 1, 0,  1],   // vertex 2
  [-1, 0,  1],   // vertex 3
  [ 0, 1.5, 0],  // vertex 4: the tip
];
// 2. Which corners make each face, in order around its edge.
const faces = [
  [0, 1, 2, 3],  // face 0: the square base
  [1, 0, 4],     // face 1
  [2, 1, 4],     // face 2
  [3, 2, 4],     // face 3
  [0, 3, 4],     // face 4
];`;

const HOUSE_START = `// A house. Its ten corners are given; write the face list.
const vertices = [
  [-1, 0, -1], [ 1, 0, -1], [ 1, 0,  1], [-1, 0,  1],   // 0-3: the floor corners
  [-1, 1, -1], [ 1, 1, -1], [ 1, 1,  1], [-1, 1,  1],   // 4-7: the tops of the walls
  [ 0, 1.6, -1], [ 0, 1.6, 1],                          // 8-9: the ends of the roof ridge
];
const faces = [
  [0, 1, 2, 3],   // the floor (done for you)
  // TODO: the two side walls, at x = -1 and x = 1
  // TODO: the two end walls, each with a pointed top: five corners
  // TODO: the two roof slopes
];`;

const HOUSE_SOLUTION = `// A house. Its ten corners are given; write the face list.
const vertices = [
  [-1, 0, -1], [ 1, 0, -1], [ 1, 0,  1], [-1, 0,  1],   // 0-3: the floor corners
  [-1, 1, -1], [ 1, 1, -1], [ 1, 1,  1], [-1, 1,  1],   // 4-7: the tops of the walls
  [ 0, 1.6, -1], [ 0, 1.6, 1],                          // 8-9: the ends of the roof ridge
];
const faces = [
  [0, 1, 2, 3],      // the floor
  [1, 5, 6, 2],      // side wall, x = 1
  [0, 3, 7, 4],      // side wall, x = -1
  [3, 2, 6, 9, 7],   // end wall, z = 1: five corners
  [0, 4, 8, 5, 1],   // end wall, z = -1
  [4, 7, 9, 8],      // roof slope, x < 0
  [5, 8, 9, 6],      // roof slope, x > 0
];`;

const NOTEBOOK = {
  title: 'Two lists, drawn',
  subtitle: 'Press Run on each cell. Drag a picture to turn it.',
  cells: [
    {
      type: 'js',
      instruction: '### 1. The pyramid\nThe two lists from the lesson, drawn. Each yellow number is a vertex\u2019s index. Before you move the slider, **predict**: which numbers in `faces` will change? The console prints `faces` every time you let go.',
      html: '<div id="view"></div><div class="row"><label for="h">Tip height</label><input id="h" type="range" min="0.3" max="3" step="0.1" value="1.5"><span id="hv">1.5</span></div>',
      css: VIEW_CSS,
      startCode: `// A square pyramid as two lists.
${PYRAMID_LISTS}
console.log(vertices.length + ' vertices, ' + faces.length + ' faces');

// The slider changes ONE number: the tip's height, vertices[4][1].
var slider = document.getElementById('h');
slider.oninput = function () {
  vertices[4][1] = Number(slider.value);
  document.getElementById('hv').textContent = slider.value;
  if (window.rebuild) window.rebuild();
};
slider.onchange = function () {
  console.log('tip at ' + JSON.stringify(vertices[4]) + '   faces = ' + JSON.stringify(faces));
};` + DRAW,
      outputHeight: 360,
    },
    {
      type: 'js',
      instruction: '### 2. The same pyramid, nothing shared\nHere every face gets its own copies of its corners, so there are 16 vertices. The tip is written four times, and its label shows all four numbers. The slider moves **one** copy: face 1\u2019s. Predict what you\u2019ll see, then try it.',
      html: '<div id="view"></div><div class="row"><label for="h">Face 1\u2019s tip height</label><input id="h" type="range" min="0.3" max="3" step="0.1" value="1.5"><span id="hv">1.5</span></div>',
      css: VIEW_CSS,
      startCode: `// The pyramid with shared corners...
const shared = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [0, 1.5, 0]];
const sharedFaces = [[0, 1, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]];

// ...rewritten so every face has its own copies of its corners.
const vertices = [];
const faces = [];
sharedFaces.forEach(function (f) {
  const face = [];
  f.forEach(function (i) {
    face.push(vertices.length);          // this face's own new vertex number
    vertices.push(shared[i].slice());    // a copy of the corner's position
  });
  faces.push(face);
});
console.log(vertices.length + ' vertices, ' + faces.length + ' faces');
console.log('faces = ' + JSON.stringify(faces));

// Face 1 is [1, 0, 4] in the shared version; its copy of the tip is its third corner.
const tipCopy = faces[1][2];
console.log('face 1 calls its tip vertex ' + tipCopy);

var slider = document.getElementById('h');
slider.oninput = function () {
  vertices[tipCopy][1] = Number(slider.value);
  document.getElementById('hv').textContent = slider.value;
  if (window.rebuild) window.rebuild();
};` + DRAW,
      outputHeight: 360,
    },
    {
      type: 'js',
      instruction: '### 3. Reading and checking the lists\nNo picture this time: this cell reads a face back as points, counts each vertex\u2019s degree, and checks a face list for the mistakes in the procedure. Run it, then break `faces` on purpose (use vertex 5, or give a face two corners) and run it again.',
      startCode: `// The pyramid again.
${PYRAMID_LISTS}

// Read a face back as points: replace each index with the vertex it names.
function facePoints(face) {
  return face.map(function (i) { return vertices[i]; });
}
console.log('face 2 = ' + JSON.stringify(faces[2]));
console.log('its corners: ' + JSON.stringify(facePoints(faces[2])));

// The degree of a vertex: how many faces use it.
const degree = vertices.map(function () { return 0; });
faces.forEach(function (f) {
  f.forEach(function (i) { degree[i] += 1; });
});
console.log('degree of each vertex: ' + JSON.stringify(degree));

// Two ways to count the same corner slots.
var slots = 0;
faces.forEach(function (f) { slots += f.length; });
var sumOfDegrees = degree.reduce(function (a, b) { return a + b; }, 0);
console.log('corner slots in the face list: ' + slots + '   sum of degrees: ' + sumOfDegrees);

// Step 3 of the procedure: check the lists.
function problems(vertices, faces) {
  var found = [];
  faces.forEach(function (f, k) {
    if (f.length < 3) found.push('face ' + k + ' has fewer than 3 corners');
    f.forEach(function (i) {
      if (!Number.isInteger(i) || i < 0 || i >= vertices.length) {
        found.push('face ' + k + ' uses vertex ' + i + ', but vertices go 0 to ' + (vertices.length - 1));
      }
    });
    if (new Set(f).size !== f.length) found.push('face ' + k + ' repeats a corner');
  });
  vertices.forEach(function (v, i) {
    if (!faces.some(function (f) { return f.indexOf(i) >= 0; })) found.push('vertex ' + i + ' is in no face');
  });
  return found;
}
var found = problems(vertices, faces);
console.log(found.length ? 'problems: ' + found.join('; ') : 'no problems found');`,
      outputHeight: 60,
    },
    {
      type: 'challenge',
      instruction: '### 🎯 Challenge: write the house\nThe ten corners of a house are numbered for you, and the floor face is done. Write the other faces. Your faces appear in the picture as you add them; the check tells you what is still wrong. Winding (which way round you walk) doesn\u2019t matter yet: that is the next lesson.',
      html: '<div id="view"></div>',
      css: VIEW_CSS,
      startCode: HOUSE_START + DRAW,
      solutionCode: HOUSE_SOLUTION + DRAW,
      check: checkHouse,
      successMessage: '✓ The house is closed: every one of its 15 edges has a face on each side.',
      failMessage: 'Not yet.',
      outputHeight: 330,
    },
    {
      type: 'markdown',
      instruction: '### Hands on in MeshLab\n[Open the two pyramids in MeshLab](#/lab/mesh-lab?project=two-lists). The Script tab has the same two lists. Select the left pyramid, press Tab, click its tip and press G to pull it up: every side follows. Do the same to the right one and it tears open.',
    },
  ],
};

export default {
  id: 'modelling-geometry-1-001',
  slug: 'vertices-and-faces',
  chapter: 1,
  order: 1,
  title: 'A Mesh Is Two Lists',
  subtitle: 'Every 3D model is a list of corner positions and a list of faces that name those corners by number.',
  tags: ['mesh', 'vertices', 'faces', 'polygon mesh', 'index', 'degree', 'MeshLab'],
  aliases: 'vertex list face list indexed mesh polygon mesh shared vertices',
  timeToComplete: 35,
  coreConcept: 'A polygon mesh is two lists: a vertex list of positions and a face list of index lists. Keeping them separate is why a model can move without tearing, and why the same faces can take many shapes.',
  prerequisites: [],
  nextLesson: null,

  hook: {
    question: 'A game character has 20,000 corners and is redrawn 60 times a second, in a new pose each time. What does the computer change from one frame to the next, and what does it leave alone?',
    realWorldContext: 'Every 3D model you will meet (in Blender, in a game engine, in a 3D-printing file, in MeshLab) is stored the same way: as two lists. One says where the corners are. The other says which corners make each face. Once you can read and write those two lists, you can read a model file, build a model from code, and explain why some models tear when you pull on them and others don\u2019t.',
  },

  intuition: {
    prose: [
      'Here is a square pyramid, written as numbers. Its base has corners at $(-1, 0, -1)$, $(1, 0, -1)$, $(1, 0, 1)$ and $(-1, 0, 1)$, and its tip is at $(0, 1.5, 0)$. Number them 0 to 4 in that order. The pyramid has five flat faces: a square base and four triangular sides. To say which corners make the base, you don\u2019t write the points again. You write their numbers: $[0, 1, 2, 3]$. The side at the back is $[1, 0, 4]$: base corners 1 and 0, and the tip, corner 4.',
      'So the whole pyramid is two lists. The first says where each corner is. The second says which corners make each face:\n\n```\nvertices = [ [-1,0,-1], [1,0,-1], [1,0,1], [-1,0,1], [0,1.5,0] ]\nfaces    = [ [0,1,2,3], [1,0,4], [2,1,4], [3,2,4], [0,3,4] ]\n```\n\nA corner of a mesh is called a **vertex** (plural *vertices*). The number that stands for a vertex is its **index**. Indices start at 0, so the fifth vertex has index 4.',
      '**Before reading on, predict:** you raise the tip from height 1.5 to height 3. Which numbers in the face list change?',
      'None of them. The tip is still vertex 4. Only `vertices[4]` changes, from $(0, 1.5, 0)$ to $(0, 3, 0)$. All four sides name vertex 4, so all four follow it. That is the job of the second list: it records **which corners are joined**, and leaves **where they are** to the first. The vertex list is the mesh\u2019s *geometry*. The face list is its *connectivity*, also called its *topology*.',
      'Why not store each face as its own points instead? Count what that costs. The base has 4 corners and each side has 3, so the faces have $4 + 3 + 3 + 3 + 3 = 16$ corner slots. Stored separately, that is 16 points, and the tip is written four times. Raise one copy and only that side moves: the pyramid tears open. With a shared vertex list, the tip is written once, and the pyramid cannot tear.',
      'The order inside a face matters. List the corners in the order you meet them walking around the face\u2019s edge. Each corner is joined to the next, and the last is joined back to the first. $[0, 1, 2, 3]$ walks around the base. $[0, 2, 1, 3]$ has the same four corners, but it jumps across the diagonal from 0 to 2. Its outline crosses itself like a bow-tie. Starting somewhere else is fine: $[1, 2, 3, 0]$ walks the same edges, so it is the same face.',
      'One count you will use constantly is the **degree** of a vertex: the number of faces that use it. Write it $\\deg(v)$ for a vertex $v$. Each base corner of the pyramid is in the base and two sides, so its degree is 3. The tip is in four sides, so its degree is 4.',
      'Write $|f|$ for the number of corners of a face $f$. Now count the corner slots two ways. Face by face: $|f|$ is 4 for the base and 3 for each side, giving 16. Vertex by vertex: the degrees add to $3 + 3 + 3 + 3 + 4 = 16$. The two totals must agree. Every slot in the face list is one use of one vertex, so both totals count the same slots.',
      'That pair of lists is a **polygon mesh**. A face can have any number of corners from three up. A mesh of triangles only is a *triangle mesh*. A mesh of mostly four-cornered faces is a *quad mesh*, the kind that Blender and MeshLab are built to edit.',
    ],
    callouts: [
      {
        type: 'definition',
        title: 'Definition: polygon mesh',
        body: 'A **vertex list**: vertex $i$ is a point $v_i = (x_i, y_i, z_i)$, for $i = 0, 1, \\ldots, n-1$, where $n$ is the number of vertices.\n\nA **face list**: each face is a list of at least three different indices, in order around the face\u2019s edge.',
      },
      {
        type: 'procedure',
        title: 'Procedure: write a shape as a mesh',
        body: 'Step 1. List every corner once. Number them from 0 in the order you listed them.\n\nStep 2. For each flat face, walk around its edge. Write down the numbers of the corners you pass, in that order.\n\nStep 3. Check the lists. Every index is between 0 and $n-1$, and every face has at least 3 corners, none repeated. Every vertex appears in some face.\n\nStep 4. Check the order. In each face, each corner and the next (and the last and the first) must be joined by a real edge of the shape.',
      },
      {
        type: 'warning',
        title: 'The bow-tie',
        body: 'Listing a face\u2019s corners in the wrong order does not raise an error: the numbers are all valid. The face just comes out wrong. Its outline crosses itself, and part of it is drawn twice while another part is missing. If a face looks torn or folded, read its corners in order and check that each step follows an edge.',
      },
      {
        type: 'insight',
        title: 'Hands on in MeshLab',
        body: '[Open the two pyramids in MeshLab](#/lab/mesh-lab?project=two-lists). One shares its corners, and the other gives every face its own copies. The Script tab shows both pairs of lists. Pull the tip of each, and see which one tears.',
      },
      {
        type: 'insight',
        title: 'Bridge: Visual -> Formula',
        body: 'In the picture, one number moved (the tip\u2019s height) while the face list stayed the same. The math section says this in symbols. The tip is the vertex $v_4$, the faces are the list $F$, and moving the tip changes $v_4$ and nothing in $F$.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Two lists, drawn',
        caption: 'The misconception this answers: that a face stores its own corner positions. The invariant to watch: moving a vertex changes one entry of the vertex list and nothing in the face list.',
        props: { lesson: NOTEBOOK },
      },
    ],
  },

  math: {
    prose: [
      'Write the mesh as the pair $M = (V, F)$. The vertex list $V$ holds the points $v_0, v_1, \\ldots, v_{n-1}$. The face list $F$ holds the faces. A face $f$ is a list of indices $(i_0, i_1, \\ldots, i_{k-1})$ with $k = |f| \\ge 3$.',
      'Reading a face back as geometry replaces each index by its vertex. Face $f$ has the corner points $v_{i_0}, v_{i_1}, \\ldots, v_{i_{k-1}}$. Its edges join each corner to the next, and $v_{i_{k-1}}$ back to $v_{i_0}$. For the pyramid\u2019s face $[2, 1, 4]$, the corners are $v_2 = (1, 0, 1)$, $v_1 = (1, 0, -1)$ and $v_4 = (0, 1.5, 0)$.',
      'The two counts of corner slots agree for every mesh:\n$$\\sum_{f \\in F} |f| \\;=\\; \\sum_{i=0}^{n-1} \\deg(v_i).$$\nBoth sides count the same slots. The left side counts them face by face. The right side counts them vertex by vertex, because vertex $v_i$ fills exactly $\\deg(v_i)$ slots, one in each face that uses it. For the pyramid, both sides are 16.',
      'The storage cost follows from the same count. With shared vertices, a mesh stores $3n$ coordinates and $\\sum_f |f|$ indices. With separate faces, it stores $3 \\sum_f |f|$ coordinates. For the pyramid, that is 15 coordinates and 16 indices, against 48 coordinates. For a cube with 8 vertices and 6 square faces, it is 24 and 24, against 72.',
      'Changing one vertex $v_i$ changes exactly the faces that contain the index $i$, which is $\\deg(v_i)$ faces, and no others. The face list itself does not change. That is the precise form of the prediction in the intuition: moving the tip changes one entry of $V$ and no entry of $F$.',
    ],
    callouts: [
      {
        type: 'strategy',
        title: 'Bridge: Formula -> Proof Logic',
        body: 'The slot count rests on one assumption: every slot holds a valid index, from 0 to $n - 1$. Break it and the two sides differ. A face that names vertex $n$ fills a slot on the left, but no vertex on the right owns it. That mismatch is exactly the off-by-one error in the debugging list.',
      },
    ],
    visualizations: [],
  },

  rigor: {
    prose: [
      '**Formal statement.** A polygon mesh is a pair $M = (V, F)$. Here $V = (v_0, \\ldots, v_{n-1})$ with each $v_i \\in \\mathbb{R}^3$. $F$ is a finite list of faces. Each face is a cyclic sequence of $k \\ge 3$ distinct indices from $\\{0, \\ldots, n-1\\}$, whose points lie in one plane and form a polygon that does not cross itself. A well-formed mesh also uses every index, and has no two faces that are the same cycle. *Cyclic* means the starting point doesn\u2019t matter: $(1, 0, 4)$, $(0, 4, 1)$ and $(4, 1, 0)$ are one face. Reversing the order, as in $(4, 0, 1)$, gives the same polygon walked the other way. The next lesson shows why that difference matters.',
      '**What stays the same.** Two kinds of change touch different lists. Moving vertices, by any transform or by hand, changes $V$ and never $F$. Renumbering the vertices by a permutation $\\pi$ reorders $V$ and replaces every index $i$ in $F$ by $\\pi(i)$, yet it describes exactly the same shape. So a mesh is defined only up to relabelling. Tools rely on this: the numbers in an exported file need not match the numbers in the editor, and a model file that was re-saved can list its vertices in a different order.',
      '**The picture behind it.** Think of $F$ as a drawing without coordinates: which corners are joined, and which loops of joined corners are faces. $V$ places that drawing in space. The same $F$ with different $V$ gives a whole family of shapes that bend alike: a pyramid of any height, a squashed one, even a flattened one whose sides have no area. This is why animation and skinning, later in this course, change only $V$ from frame to frame. It is also why a model with torn faces is hard to repair: if two faces have separate copies of a corner, $F$ does not say that they meet.',
      '**Where this leads.** The face list holds more than it first seems to. From it you can build the list of edges, and find each edge\u2019s neighbouring faces (lesson 3). The order of each face decides which side is outside (lesson 2). For a closed surface without holes, the number of vertices, minus the number of edges, plus the number of faces, is always 2 (lesson 4). Subdivision (chapter 4) builds a new $F$ from the old one. Differential geometry (chapter 5) turns $F$ into a sparse matrix.',
    ],
    callouts: [
      {
        type: 'real-world',
        title: 'Bridge: Proof -> Real World',
        body: 'Real file formats are these two lists. An OBJ file has lines `v x y z` (the vertex list) and `f 1 2 3 4` (the face list, numbered from 1 in that format). A glTF file stores a position buffer and an index buffer. STL stores every triangle\u2019s own three points, so an STL model must be welded into a shared vertex list before a tool can tell which triangles touch.',
      },
    ],
    visualizations: [],
  },

  examples: [
    {
      id: 'modelling-geometry-1-001-ex1',
      title: 'A single square tile',
      difficulty: 'easy',
      problem: 'A flat square floor tile has its corners at $(0, 0, 0)$, $(1, 0, 0)$, $(1, 0, 1)$ and $(0, 0, 1)$. Write it as a mesh.',
      steps: [
        { expression: 'vertices = [ [0,0,0], [1,0,0], [1,0,1], [0,0,1] ]', annotation: 'List every corner once, in the order given, and number them 0, 1, 2, 3.', strategyTitle: 'Step 1: list and number the corners' },
        { expression: 'faces = [ [0, 1, 2, 3] ]', annotation: 'There is one face. Walk around its edge: from corner 0 along to 1, up to 2, across to 3, and back to 0.', strategyTitle: 'Step 2: walk around each face' },
        { expression: 'indices 0–3 with n = 4; one face, 4 corners, none repeated; all 4 vertices used', annotation: 'Every index is between 0 and $n - 1 = 3$. The face has at least 3 corners, and no corner appears twice. No vertex is left out.', strategyTitle: 'Step 3: check the lists' },
        { expression: '0–1, 1–2, 2–3, 3–0 are the four sides of the square', annotation: 'Each corner and the next are joined by a side of the tile, and so are the last and the first. So the order is right.', strategyTitle: 'Step 4: check the order' },
      ],
      answer: 'The tile is vertices = [[0,0,0], [1,0,0], [1,0,1], [0,0,1]] with faces = [[0,1,2,3]]: four vertices and one face.',
    },
    {
      id: 'modelling-geometry-1-001-ex2',
      title: 'Reading the pyramid back',
      difficulty: 'medium',
      problem: 'In the pyramid, vertices = [[-1,0,-1], [1,0,-1], [1,0,1], [-1,0,1], [0,1.5,0]] and faces = [[0,1,2,3], [1,0,4], [2,1,4], [3,2,4], [0,3,4]]. What are the corner points of face 3? If vertex 2 moves to $(1, 0.5, 1)$, which faces change shape?',
      steps: [
        { expression: 'face 3 = [3, 2, 4]', annotation: 'Faces are numbered from 0 too, so face 3 is the fourth entry of the face list.', strategyTitle: 'Step 1: find the face' },
        { expression: '[3, 2, 4] → (-1, 0, 1), (1, 0, 1), (0, 1.5, 0)', annotation: 'Replace each index with the vertex it names: $v_3$, then $v_2$, then $v_4$.', strategyTitle: 'Step 2: replace indices by points' },
        { expression: 'faces containing 2: face 0 [0,1,2,3], face 2 [2,1,4], face 3 [3,2,4]', annotation: 'A moved vertex changes exactly the faces that name it. Search the face list for the index 2.', strategyTitle: 'Step 3: find the faces that use the vertex' },
        { expression: 'deg(v₂) = 3', annotation: 'That is three faces: the base and the two sides on either side of that corner. The face list itself does not change at all.', strategyTitle: 'Step 4: count them' },
      ],
      answer: 'Face 3 has the corners (-1, 0, 1), (1, 0, 1) and (0, 1.5, 0). Moving vertex 2 changes the shape of faces 0, 2 and 3 (its degree is 3), and changes no numbers in the face list.',
    },
    {
      id: 'modelling-geometry-1-001-ex3',
      title: 'A cube numbered by a rule',
      difficulty: 'hard',
      problem: 'A unit cube numbers its corners by a rule. Vertex $i$ (for $i = 0, \\ldots, 7$) is at $x = i \\bmod 2$, $y = \\lfloor i/2 \\rfloor \\bmod 2$, $z = \\lfloor i/4 \\rfloor$. Write the vertex list and the face list, and check the slot count.',
      steps: [
        { expression: 'vertices = [ [0,0,0], [1,0,0], [0,1,0], [1,1,0], [0,0,1], [1,0,1], [0,1,1], [1,1,1] ]', annotation: 'Apply the rule. For example, $i = 6$ gives $x = 0$, $y = 3 \\bmod 2 = 1$, $z = 1$. (In binary, the three bits of $i$ are $z$, $y$, $x$.)', strategyTitle: 'Step 1: list and number the corners' },
        { expression: 'x = 0 side: corners 0, 2, 4, 6 → walk 0, 4, 6, 2', annotation: 'Pick out the four corners with $x = 0$. Walk around them: 0 to 4 is along $z$, 4 to 6 along $y$, 6 to 2 back along $z$, and 2 to 0 back along $y$. The order 0, 2, 4, 6 would cut across the diagonal from 2 to 4.', strategyTitle: 'Step 2: walk around each face' },
        { expression: 'faces = [ [0,4,6,2], [1,3,7,5], [0,1,5,4], [2,6,7,3], [0,2,3,1], [4,5,7,6] ]', annotation: 'Do the same for the other five sides: $x = 1$, $y = 0$, $y = 1$, $z = 0$, $z = 1$.', strategyTitle: 'Step 2 (continued)' },
        { expression: 'each face: neighbours differ in one coordinate', annotation: 'Two corners of a cube are joined by an edge exactly when they differ in one coordinate. That means their indices differ in one bit. Check this for every step around every face, including last to first.', strategyTitle: 'Step 4: check the order' },
        { expression: '6 × 4 = 24 = 8 × 3', annotation: 'Six faces of four corners give 24 slots. Every corner of a cube is on three faces, so the degrees add to $8 \\times 3 = 24$. The counts agree.', strategyTitle: 'Check: two counts of the slots' },
      ],
      answer: 'vertices = [[0,0,0], [1,0,0], [0,1,0], [1,1,0], [0,0,1], [1,0,1], [0,1,1], [1,1,1]] and faces = [[0,4,6,2], [1,3,7,5], [0,1,5,4], [2,6,7,3], [0,2,3,1], [4,5,7,6]]. That is 24 corner slots, and every vertex has degree 3.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-1-001-ch1',
      title: 'A triangular prism',
      difficulty: 'easy',
      problem: 'A prism has a triangular end at $z = 0$ with corners $(0, 0, 0)$, $(2, 0, 0)$, $(1, 1.5, 0)$, and the same triangle at $z = 3$. Number the corners 0–2 at the front and 3–5 at the back, with vertex $i + 3$ behind vertex $i$. Write the face list, and check it by counting the slots two ways.',
      hint: 'Two faces are triangles. The three faces along the sides are rectangles, each made of one front edge and the back edge behind it.',
      answer: 'faces = [[0,1,2], [3,4,5], [0,1,4,3], [1,2,5,4], [2,0,3,5]]. That is 3 + 3 + 4 + 4 + 4 = 18 slots, and each of the 6 vertices has degree 3, so 6 × 3 = 18.',
      walkthrough: [
        { expression: '[0,1,2] and [3,4,5]', annotation: 'The two triangular ends, each walked around its three edges.' },
        { expression: '[0,1,4,3]', annotation: 'The rectangle under the front edge 0–1. It goes from 0 to 1, then back along the prism to 4 (behind 1), across to 3 (behind 0), and forward to 0.' },
        { expression: '[1,2,5,4], [2,0,3,5]', annotation: 'The same pattern for the edges 1–2 and 2–0.' },
        { expression: '18 = 6 × 3', annotation: 'Every corner touches its end triangle and two rectangles, so it has degree 3.' },
      ],
    },
    {
      id: 'modelling-geometry-1-001-ch2',
      title: 'Debug the tile',
      difficulty: 'medium',
      problem: 'Someone wrote the floor tile from Example 1 as faces = [[0, 1, 3, 2]], with vertices = [[0,0,0], [1,0,0], [1,0,1], [0,0,1]]. When it is drawn, its outline crosses in the middle, and a triangular notch is missing by the edge from corner 1 to corner 2. What is wrong, and what is the fix?',
      hint: 'Walk the face in the order written. Is every step along a side of the square?',
      answer: 'The step from 1 to 3, and the step from 2 back to 0, cut across the square\u2019s diagonals. The face walks a bow-tie, not the square. Listing the corners in order around the edge, faces = [[0, 1, 2, 3]], fixes it.',
      walkthrough: [
        { expression: '0 → 1: along the front edge ✓', annotation: 'Corners 0 and 1 differ only in $x$, so they are joined by a side.' },
        { expression: '1 → 3: (1,0,0) to (0,0,1) ✗', annotation: 'These differ in both $x$ and $z$, so this is a diagonal, not a side.' },
        { expression: '3 → 2 ✓, 2 → 0 ✗', annotation: 'The closing step is the other diagonal. Two diagonals cross in the middle, which is the bow-tie.' },
        { expression: 'fix: [0, 1, 2, 3]', annotation: 'Walk around the edge instead. The same four indices in a different order.' },
      ],
    },
    {
      id: 'modelling-geometry-1-001-ch3',
      title: 'Count the faces you can\u2019t see',
      difficulty: 'hard',
      problem: 'A closed mesh has 12 vertices, and every face is a triangle. Every vertex has degree 5. How many faces does it have? How many coordinates would it take to store with every face keeping its own corners, compared with shared vertices?',
      hint: 'Count the corner slots two ways: from the faces, and from the degrees.',
      answer: 'It has 20 faces, because 3 × (number of faces) = 12 × 5 = 60. With separate faces it stores 60 corners, so 180 coordinates. With shared vertices it stores 36 coordinates plus 60 indices. (This mesh is an icosahedron.)',
      walkthrough: [
        { expression: 'sum of degrees = 12 × 5 = 60', annotation: 'Count vertex by vertex.' },
        { expression: 'sum of |f| = 3 × (number of faces)', annotation: 'Count face by face. Each face is a triangle.' },
        { expression: '3 × faces = 60, so faces = 20', annotation: 'Both counts are counting the same slots, so they are equal.' },
        { expression: 'separate: 60 × 3 = 180 coordinates; shared: 12 × 3 = 36 coordinates + 60 indices', annotation: 'Separate faces store one point per slot. Shared vertices store each point once.' },
      ],
    },
  ],

  semantics: {
    core: [
      { symbol: '$v_i$', meaning: 'Vertex $i$: the point $(x_i, y_i, z_i)$ stored at position $i$ of the vertex list. Moving the vertex means changing these three numbers.' },
      { symbol: '$n$', meaning: 'The number of vertices. Valid indices run from $0$ to $n - 1$.' },
      { symbol: '$f = (i_0, \\ldots, i_{k-1})$', meaning: 'A face: the indices of its corners, in order around its edge. It names corners by number, and never stores their positions.' },
      { symbol: '$|f|$', meaning: 'The number of corners of face $f$: 3 for a triangle, 4 for a quad.' },
      { symbol: '$\\deg(v)$', meaning: 'The degree of a vertex: how many faces use it. It is also how many faces change shape when that vertex moves.' },
      { symbol: '$M = (V, F)$', meaning: 'A mesh, as its vertex list $V$ (the geometry) and its face list $F$ (the connectivity).' },
    ],
    rulesOfThumb: [
      'Moving things changes the vertex list. Cutting, joining and adding faces changes the face list.',
      'If a model tears when you pull a corner, two faces have separate copies of a corner that should be shared.',
      'Read a face aloud as a walk: "0 to 1 to 2 to 3, back to 0". Every step should follow an edge you can see.',
      'Number from 0. The largest index in the face list must be one less than the length of the vertex list.',
      'Check a face list by counting slots two ways. The face sizes and the degrees must add to the same total.',
    ],
  },

  spiral: {
    recoveryPoints: [],
    futureLinks: [
      { lessonId: 'three-js-2-1-0-buffer-geometry', label: 'Three.js: BufferGeometry', note: 'How three.js stores the same two lists, as a position buffer and an index buffer of triangles.' },
      { lessonId: 'mesh-engine-1-3-topology-and-welding', label: 'Mesh Engine: topology and welding', note: 'How to rebuild a shared vertex list from a file whose faces each keep their own corners.' },
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Each face stores the positions of its own corners.',
      whyStudentsThinkIt: 'On screen, a face looks like a separate flat polygon with its own corners, and some file formats (such as STL) really do store each triangle\u2019s points.',
      correctionExample: 'The pyramid\u2019s side [1, 0, 4] stores three numbers, not three points. Its tip is vertex 4, which is stored once at (0, 1.5, 0) and shared by all four sides.',
      contrastCase: 'If each face kept its own corners, the pyramid would need 16 points. Raising one copy of the tip would move only one side and tear the pyramid open, which is what happens in the notebook\u2019s second cell.',
    },
    {
      falseBelief: 'Any order of a face\u2019s corners describes the same face.',
      whyStudentsThinkIt: 'A face is thought of as a set of corners, and sets have no order.',
      correctionExample: 'For the tile, [0, 1, 2, 3] walks around the square. [0, 2, 1, 3] uses the same four corners but jumps across a diagonal, and draws a bow-tie that crosses itself.',
      contrastCase: '[1, 2, 3, 0] is a different list but the same face. It walks the same edges starting at a different corner, so rotating the list is harmless, while reordering it is not.',
    },
    {
      falseBelief: 'The faces of a mesh have to be triangles.',
      whyStudentsThinkIt: 'Graphics cards draw only triangles, and many file formats and tutorials use triangles only.',
      correctionExample: 'The house in the challenge has two five-cornered faces, [3, 2, 6, 9, 7] and [0, 4, 8, 5, 1], and its walls are four-cornered. Modelling tools edit faces like these directly.',
      contrastCase: 'Only when the mesh is drawn is each face cut into triangles, and that is a separate step from the mesh itself (lesson 5). The notebook\u2019s drawing code does this with a fan from each face\u2019s first corner.',
    },
  ],

  transferPrompts: [
    {
      situation: 'You are writing a program that animates a flag waving in the wind. Its 400 corners move every frame, and the cloth must never tear.',
      competingTechniques: ['Keep the face list fixed and update only the vertex list each frame', 'Rebuild the face list every frame from the new positions', 'Store each triangle with its own three points and move them all'],
      whyThisTechniqueWins: 'The flag\u2019s connectivity never changes, only its geometry does. Updating the vertex list moves every face that shares a corner together, so the cloth cannot tear. Rebuilding the faces is wasted work, and separate triangles would drift apart.',
    },
    {
      situation: 'A 3D-printing file lists 10,000 triangles, each written as its own three points. You need to know which triangles touch each other.',
      competingTechniques: ['Merge equal points into one shared vertex list, then compare indices', 'Compare every triangle\u2019s points with every other triangle\u2019s points'],
      whyThisTechniqueWins: 'Once equal points share one index, two triangles touch exactly when they share an index, which is a cheap comparison of whole numbers. Comparing points pairwise over all triangles takes about 50 million comparisons of floating-point coordinates.',
    },
  ],

  debugging: [
    {
      commonError: 'Numbering the vertices from 1 instead of 0.',
      symptom: 'One corner of the model is missing or lands in the wrong place, and the drawing code may crash on an index equal to the length of the vertex list.',
      whyItHappened: 'Arrays in JavaScript, Python and on the GPU start at 0. Index $n$ is one past the end of a list of $n$ vertices.',
      repairStrategy: 'Find the largest number in the face list. It must be exactly one less than the number of vertices, and 0 must appear somewhere.',
    },
    {
      commonError: 'Listing a face\u2019s corners in a jumbled order.',
      symptom: 'The face\u2019s outline crosses itself, part of it is drawn twice, and a triangle-shaped piece is missing.',
      whyItHappened: 'The corners were listed as a set (say, lowest number first) rather than in the order you meet them walking round the edge.',
      repairStrategy: 'Read the face aloud as a walk, and check each step, including last to first, against an edge of the shape. Fix the first step that cuts across the face.',
    },
    {
      commonError: 'Building a model face by face, with each face given its own new corners.',
      symptom: 'The model looks right until something moves. Then gaps open along its edges, and smooth shading shows a hard crease at every edge.',
      whyItHappened: 'Faces that should share a corner each have their own copy, so the face list does not say that they meet.',
      repairStrategy: 'Before adding a corner, check whether a vertex already exists at that position. If it does, use its index.',
    },
  ],

  mastery: {
    targetLevel: 2,
    solveIndependently: 'Write the vertex list and face list for a small shape, such as a prism or a house, from a picture or a description, with every face in walking order.',
    explainVerbally: 'Explain why a face lists indices rather than points, and why moving a vertex changes no number in the face list.',
    detectIncorrectApplication: 'Spot a face whose corners are out of order, an index out of range, and a model whose faces keep separate copies of shared corners.',
    transferToUnfamiliar: 'Use the two counts of corner slots to find an unknown number of faces or vertices from the degrees, as in the icosahedron challenge.',
  },

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-1-001-assess-1',
        type: 'choice',
        text: 'A mesh has vertices = [[0,0,0], [2,0,0], [2,2,0], [0,2,0]] and faces = [[0, 1, 2, 3]]. You change vertices[2] to [3, 3, 0]. What happens to the face list?',
        options: ['Nothing: it is still [[0, 1, 2, 3]]', 'It becomes [[0, 1, 3, 3]]', 'Face 0 must be rewritten with the new point', 'It becomes empty until the face is rebuilt'],
        answer: 'Nothing: it is still [[0, 1, 2, 3]]',
        hint: 'The face names its corners by index. Vertex 2 is still vertex 2; only its position changed.',
      },
      {
        id: 'modelling-geometry-1-001-assess-2',
        type: 'choice',
        text: 'A closed mesh made only of quads has 30 faces. How many corner slots does its face list have, and so what do the degrees of its vertices add up to?',
        options: ['120', '30', '90', '60'],
        answer: '120',
        hint: 'Each quad fills 4 slots. The degrees count the same slots, vertex by vertex.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-1-001-quiz-1',
      type: 'choice',
      text: 'What does the face [2, 1, 4] store?',
      options: ['The indices of three vertices, in order around the face', 'Three points in space', 'The positions of vertices 2, 1 and 4, copied from the vertex list', 'A triangle\u2019s area and normal'],
      answer: 'The indices of three vertices, in order around the face',
      hints: ['A face names its corners; the vertex list says where they are.'],
      reviewSection: 'Intuition — Definition: polygon mesh',
    },
    {
      id: 'modelling-geometry-1-001-quiz-2',
      type: 'choice',
      text: 'In the pyramid, which vertex has degree 4?',
      options: ['Vertex 4, the tip', 'Vertex 0', 'Every vertex', 'None: every vertex has degree 3'],
      answer: 'Vertex 4, the tip',
      hints: ['Count the faces that name each vertex. The base corners are in the base and two sides.'],
      reviewSection: 'Intuition — the paragraph on degree',
    },
    {
      id: 'modelling-geometry-1-001-quiz-3',
      type: 'choice',
      text: 'The square with corners 0 (0,0), 1 (1,0), 2 (1,1), 3 (0,1) must be written as one face. Which list is NOT a correct way to write it?',
      options: ['[0, 2, 1, 3]', '[0, 1, 2, 3]', '[1, 2, 3, 0]', '[2, 3, 0, 1]'],
      answer: '[0, 2, 1, 3]',
      hints: ['Walk each list, including from the last corner back to the first. Does every step follow a side of the square?'],
      reviewSection: 'Intuition — Procedure: write a shape as a mesh (Step 4)',
    },
    {
      id: 'modelling-geometry-1-001-quiz-4',
      type: 'choice',
      text: 'A mesh has 6 vertices. Which face is invalid?',
      options: ['[3, 4, 6]', '[0, 1, 2]', '[5, 4, 3, 2]', '[0, 5, 1]'],
      answer: '[3, 4, 6]',
      hints: ['With 6 vertices, the indices run from 0 to 5.'],
      reviewSection: 'Intuition — Procedure: write a shape as a mesh (Step 3)',
    },
    {
      id: 'modelling-geometry-1-001-quiz-5',
      type: 'choice',
      text: 'A pyramid is stored with every face keeping its own corners: 16 vertices. You raise one copy of the tip. What happens?',
      options: ['One side moves and the pyramid tears open', 'All four sides follow the tip', 'Nothing moves until the face list is updated', 'The base moves up with the tip'],
      answer: 'One side moves and the pyramid tears open',
      hints: ['Only one face names that copy. The other three name their own copies, which did not move.'],
      reviewSection: 'Intuition — the paragraph on storing faces separately',
    },
    {
      id: 'modelling-geometry-1-001-quiz-6',
      type: 'choice',
      text: 'A closed triangle mesh has 8 faces and every vertex has degree 4. How many vertices does it have?',
      options: ['6', '8', '24', '32'],
      answer: '6',
      hints: ['The faces fill 8 × 3 = 24 slots, and every vertex fills 4 of them.'],
      reviewSection: 'Math — the two counts of corner slots',
    },
    {
      id: 'modelling-geometry-1-001-quiz-7',
      type: 'choice',
      text: 'An animation moves every vertex of a character each frame. Which list does it change?',
      options: ['Only the vertex list', 'Only the face list', 'Both lists, every frame', 'Neither: the GPU moves the faces'],
      answer: 'Only the vertex list',
      hints: ['Moving is geometry. The corners stay joined the same way.'],
      reviewSection: 'Rigor — What stays the same',
    },
  ],

  checkpoints: [
    { id: 'cp-modelling-geometry-1-001-1', label: 'Read the pyramid as two lists', type: 'read' },
    { id: 'cp-modelling-geometry-1-001-2', label: 'Predict which face numbers change when the tip moves', type: 'read' },
    { id: 'cp-modelling-geometry-1-001-3', label: 'Read the procedure for writing a shape as a mesh', type: 'read' },
    { id: 'cp-modelling-geometry-1-001-4', label: 'Run the pyramid cell and move the tip', type: 'lab' },
    { id: 'cp-modelling-geometry-1-001-5', label: 'Run the separate-faces cell and tear the pyramid', type: 'lab' },
    { id: 'cp-modelling-geometry-1-001-6', label: 'Work through the single square tile', type: 'example' },
    { id: 'cp-modelling-geometry-1-001-7', label: 'Work through the cube numbered by a rule', type: 'example' },
    { id: 'cp-modelling-geometry-1-001-8', label: 'Complete the house challenge', type: 'challenge' },
  ],
};
