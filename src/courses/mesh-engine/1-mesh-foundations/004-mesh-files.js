// Mesh Engine 1.4 — Mesh Files
//
// Lesson 3 ended on an exploded mesh and said "that is what an STL file is".
// This lesson opens the file and shows it, byte by byte, without a library.
//
// The rule this lesson is written under: no word gets used before it is
// defined. "Header", "byte", "stride", "little-endian" and "buffer" are all
// introduced from nothing, because an earlier draft of this series used every
// one of them undefined and the reader was right to stop.
//
// Numbers quoted in the prose are checked by
// field-fixes/verify/check-stl-numbers.mjs.

const THREE_CDN = '<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"><\/script>';

const ORBIT = `
function orbit(camera, dom, radius) {
  var lon = 35, lat = 25, down = false, px = 0, py = 0;
  function place() {
    var a = lon * Math.PI / 180, b = lat * Math.PI / 180;
    camera.position.set(
      radius * Math.cos(b) * Math.sin(a),
      radius * Math.sin(b),
      radius * Math.cos(b) * Math.cos(a));
    camera.lookAt(0, 0, 0);
  }
  dom.addEventListener('pointerdown', function (e) { down = true; px = e.clientX; py = e.clientY; });
  window.addEventListener('pointerup', function () { down = false; });
  window.addEventListener('pointermove', function (e) {
    if (!down) return;
    lon -= (e.clientX - px) * 0.5;
    lat = Math.max(-85, Math.min(85, lat + (e.clientY - py) * 0.5));
    px = e.clientX; py = e.clientY;
    place();
  });
  place();
  return place;
}`;

// The cube from lessons 1 and 3, triangulated, wound outward. Pasted into each
// cell because JS cells are separate sandboxes and cannot share a scope.
const CUBE = `var CORNERS = [
  [-0.5,-0.5,-0.5], [0.5,-0.5,-0.5], [0.5,0.5,-0.5], [-0.5,0.5,-0.5],
  [-0.5,-0.5, 0.5], [0.5,-0.5, 0.5], [0.5,0.5, 0.5], [-0.5,0.5, 0.5],
];
var QUADS = [[0,1,5,4], [0,3,2,1], [4,5,6,7], [1,2,6,5], [3,0,4,7], [2,3,7,6]];
var TRIS = [];
QUADS.forEach(function (q) {
  TRIS.push([q[0], q[1], q[2]]);
  TRIS.push([q[0], q[2], q[3]]);
});`;

// Writing a binary STL. Used by the byte viewer and by the challenge, so the
// bytes the reader parses are bytes this lesson genuinely produced.
const WRITER = `// Build a binary STL in memory, exactly as a CAM system would write one.
//
// An ArrayBuffer is a block of raw memory of a fixed size - just bytes, with no
// idea what they mean. A DataView is a tool for writing numbers INTO that block
// at a chosen position, in a chosen format. The buffer holds; the view writes.
function writeSTL(corners, tris) {
  var size = 84 + tris.length * 50;
  var buffer = new ArrayBuffer(size);
  var view = new DataView(buffer);

  // Bytes 0..79: the header. Genuinely ignored - write anything.
  var note = 'binary STL written by mesh lesson 4';
  for (var i = 0; i < note.length && i < 80; i++) {
    view.setUint8(i, note.charCodeAt(i));
  }

  // Bytes 80..83: how many triangles follow, as a 32-bit unsigned integer.
  // The 'true' is the important part and is explained below.
  view.setUint32(80, tris.length, true);

  var at = 84;
  tris.forEach(function (t) {
    var A = corners[t[0]], B = corners[t[1]], C = corners[t[2]];

    // 12 bytes: the face normal. Three 32-bit floats.
    var u = [B[0]-A[0], B[1]-A[1], B[2]-A[2]];
    var v = [C[0]-A[0], C[1]-A[1], C[2]-A[2]];
    var n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    var L = Math.hypot(n[0], n[1], n[2]) || 1;
    view.setFloat32(at, n[0]/L, true); at += 4;
    view.setFloat32(at, n[1]/L, true); at += 4;
    view.setFloat32(at, n[2]/L, true); at += 4;

    // 36 bytes: three corners, three floats each, written out in full.
    // No indices. A corner shared by six triangles is written six times.
    [A, B, C].forEach(function (p) {
      view.setFloat32(at, p[0], true); at += 4;
      view.setFloat32(at, p[1], true); at += 4;
      view.setFloat32(at, p[2], true); at += 4;
    });

    // 2 bytes: the attribute byte count. Almost always zero.
    view.setUint16(at, 0, true); at += 2;
  });

  return buffer;
}`;

const LESSON_MESH_1_4 = {
  title: 'What Is Actually In the File',
  subtitle: 'Open an STL a byte at a time, with nothing helping you.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### Four minutes for a part the size of a matchbox

A part 2" × 2" × 0.25" took about four minutes to process. On a fast machine.

Nothing about its size explains that, and this is the lesson where the reason
stops being mysterious: **that part was roughly 100,000 triangles.**

Here is the thing that catches everyone. **Nothing curved is ever stored.** A
bore is a many-sided prism pretending to be round. A radius is a fan of flats.
When the CAM system exported the file it chose how finely to chop every curve,
and **that choice is permanent** — the roundness is not compressed, it is gone,
and all that is left is however many flat triangles it decided to leave behind.

So a matchbox covered in small radii can be 100,000 triangles, and a part twice
the size made of flats can be 5,000. **Any expectation about speed based on how
big the part is, is worthless.** The only thing that predicts the work is the
triangle count, and the only way to know that is to open the file.

So let us open the file. No library, nothing helping.

But first — I am not going to say "the 80-byte header" at you and carry on,
because that sentence contains at least three words that mean nothing until
somebody says what they are.`,
    },

    {
      type: 'js',
      instruction: `### A file is a row of numbers between 0 and 255

Start here, because everything else is built on it.

A file on disk is **a row of bytes**. A **byte** is a single number from **0 to
255** — that is all it is. Not a letter, not a number you would recognise, just
a value in that range. A file that is 1,000 bytes long is a row of 1,000 such
numbers, in order, and nothing else.

So if a file has to store the number \`-0.5\`, there is a problem: \`-0.5\` is
not between 0 and 255. It has to be **encoded** — spread across several bytes
using an agreed scheme.

The scheme used here is **32-bit floating point**, which takes **4 bytes** per
number. Type a number below and watch which four bytes it becomes.

**Then flip the switch.** Those same four bytes can be written in either order:
smallest-first or largest-first. That choice is called **endianness**, and
little-endian means smallest-first. **STL files are little-endian.** Read them
the other way round and you get a real number that is completely wrong — not a
crash, just nonsense, which is far worse.

Try \`1\`, then \`-0.5\`, then \`0\`. Watch which bytes move and which stay put.

If binary or hexadecimal is unfamiliar, those have lessons of their own —
[Binary Numbers](#/lesson/df-2-1-binary-numbers) and
[Hexadecimal](#/lesson/df-1-2-hexadecimal). You do not need them to finish this
lesson, but they are where the 0-to-255 comes from.`,
      html: `<div style="padding:10px 2px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
  <label style="color:#9fb8e0;font:12px ui-monospace,monospace">number
    <input id="num" value="-0.5" style="width:140px;margin-left:6px;background:#161c2b;color:#dbeafe;border:1px solid #2f3a52;border-radius:4px;padding:5px 8px;font:12px ui-monospace,monospace">
  </label>
  <button id="swap" style="background:#2b313a;color:#d7dade;border:1px solid #3d4550;border-radius:4px;padding:5px 11px;cursor:pointer;font:11px ui-monospace,monospace">read it the other way round</button>
</div>
<div id="out" style="color:#9fb8e0;font:12px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:220px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// An ArrayBuffer is a fixed block of raw memory. Four bytes is enough
// for one 32-bit float.
var buffer = new ArrayBuffer(4);

// A DataView reads and writes numbers inside that block, in a format you
// choose. It is the thing that knows how to turn -0.5 into four bytes.
var view = new DataView(buffer);

// The last argument is littleEndian. true = smallest byte first.
var LITTLE = true;

function show(value, readAsLittle) {
  view.setFloat32(0, value, LITTLE);   // always WRITTEN little-endian

  var bytes = [];
  for (var i = 0; i < 4; i++) bytes.push(view.getUint8(i));

  var hex = bytes.map(function (b) {
    return b.toString(16).toUpperCase().padStart(2, '0');
  });

  // Read it back - possibly the wrong way round on purpose.
  var readBack = view.getFloat32(0, readAsLittle);

  var lines = [];
  lines.push('the number you typed      ' + value);
  lines.push('');
  lines.push('stored as 4 bytes         ' + bytes.map(function (b) {
    return (b + '').padStart(3);
  }).join('  ') + '     <- each one 0 to 255');
  lines.push('the same, in hex          ' + hex.join('   '));
  lines.push('');
  lines.push('read back as ' + (readAsLittle ? 'little-endian' : 'BIG-endian   ') +
             ' ' + readBack);
  lines.push('');
  if (readAsLittle) {
    lines.push('Correct. STL is little-endian, so this is how it must be read.');
  } else {
    lines.push('Wrong - and notice it did not crash. It handed back a perfectly');
    lines.push('real number that simply is not the one in the file. A part read');
    lines.push('this way would draw, and be nonsense.');
  }
  lines.push('');
  lines.push('A triangle needs 3 corners x 3 numbers = 9 floats = 36 bytes.');
  document.getElementById('out').textContent = lines.join('\\n');
}

var asLittle = true;
var input = document.getElementById('num');

function redraw() {
  var v = Number(input.value);
  if (!isFinite(v)) v = 0;
  show(v, asLittle);
}

input.addEventListener('input', redraw);
document.getElementById('swap').addEventListener('click', function () {
  asLittle = !asLittle;
  redraw();
});

redraw();`,
      outputHeight: 400,
    },

    {
      type: 'markdown',
      instruction: `### Now the layout, and every word in it

A binary STL is three things, in this order.

#### 1. The header — bytes 0 to 79

A **header** is just the front of the file: a fixed number of bytes reserved
before the real content starts, so a reader knows where things begin.

In an STL it is **80 bytes, and it is ignored.** Some exporters put their name
in it. Some leave it as zeros. **Nothing about the model is in there** — not
the units, not the scale, not the part number. You may not skip it, because the
count that follows sits at a fixed position, but you may not learn anything
from it either.

#### 2. The count — bytes 80 to 83

Four bytes holding one **32-bit unsigned integer**: how many triangles follow.
Unsigned means it cannot be negative, which is why all four bytes are available
for size rather than one being spent on a sign.

#### 3. The triangles — 50 bytes each, from byte 84 to the end

Every triangle is exactly **50 bytes**:

\`\`\`
 12 bytes    the face normal        3 floats x 4 bytes
 36 bytes    three corners          9 floats x 4 bytes
  2 bytes    attribute byte count   almost always 0
 ──────────
 50 bytes
\`\`\`

That fixed 50 is called the **stride** — the distance from the start of one
record to the start of the next. It never varies, which is what makes the
whole file navigable: triangle *n* begins at byte \`84 + 50n\`, and you can
jump straight to any triangle without reading the ones before it.

It also means **the file size is fully determined by the triangle count**:

\`\`\`
bytes = 84 + 50 x triangles
\`\`\`

Which runs backwards too. A 1,082,384-byte STL has
\`(1082384 - 84) / 50 = 21,646\` triangles, and you know that before reading a
single one of them. If that division does not come out whole, the file is not
a binary STL.

**One warning about the normal.** Each triangle stores which way it faces —
and that stored value is frequently wrong, because it is written by the
exporter rather than derived. Lesson 2 showed you how to compute it from the
three corners in one cross product. **Compute it. Do not trust the stored one.**`,
    },

    {
      type: 'js',
      instruction: `### See it

The cube from lesson 1, written as a real binary STL, and then shown as what it
actually is: a row of bytes.

The colours are the layout from the previous cell — grey is the 80-byte header,
blue is the 4-byte count, then each 50-byte triangle record alternates, with its
normal, its three corners and its two attribute bytes picked out.

**Click any byte** and it tells you what it is and which triangle it belongs to.

Before you click anything, work out the file size. 12 triangles. The formula is
\`84 + 50 × triangles\`. Then check it against the readout.

Look at how much of this file is repetition. The cube has **8 corners**. Count
the corners stored here and you get **36** — and lesson 3 already told you what
that costs.`,
      html: `<div style="padding:8px 2px;color:#7d8794;font:11px ui-monospace,monospace;display:flex;gap:12px;flex-wrap:wrap">
  <span style="color:#5a6472">■ header (80)</span>
  <span style="color:#4dabf7">■ count (4)</span>
  <span style="color:#ffd43b">■ normal (12)</span>
  <span style="color:#69db7c">■ corners (36)</span>
  <span style="color:#f783ac">■ attribute (2)</span>
</div>
<div id="bytes" style="font:10px/1.45 ui-monospace,monospace;padding:8px;background:#0a0f1e;border-radius:8px;max-height:260px;overflow:auto;word-break:break-all"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `${CUBE}

${WRITER}

var buffer = writeSTL(CORNERS, TRIS);
var view = new DataView(buffer);
var bytes = new Uint8Array(buffer);

// What each byte is, worked out from the layout rather than looked up.
function describe(i) {
  if (i < 80) return { what: 'header byte ' + i + ' of 80 - ignored', colour: '#5a6472' };
  if (i < 84) return { what: 'triangle count, byte ' + (i - 80) + ' of 4', colour: '#4dabf7' };
  var offset = i - 84;
  var tri = Math.floor(offset / 50);      // which record
  var within = offset % 50;               // how far into it - this is the stride at work
  if (within < 12) {
    return { what: 'triangle ' + tri + ': normal, byte ' + within + ' of 12', colour: '#ffd43b' };
  }
  if (within < 48) {
    var c = Math.floor((within - 12) / 12);
    return { what: 'triangle ' + tri + ': corner ' + c + ', byte ' + ((within - 12) % 12) + ' of 12', colour: '#69db7c' };
  }
  return { what: 'triangle ' + tri + ': attribute byte count', colour: '#f783ac' };
}

// Only the first few records are drawn - 684 bytes of coloured hex is enough
// to see the pattern, and all of it would be unreadable.
var SHOWN = Math.min(bytes.length, 84 + 50 * 3);
var html = '';
for (var i = 0; i < SHOWN; i++) {
  var d = describe(i);
  html += '<span data-i="' + i + '" style="color:' + d.colour +
          ';cursor:pointer;padding:0 1px">' +
          bytes[i].toString(16).toUpperCase().padStart(2, '0') + '</span> ';
}
html += '<span style="color:#4a5160">... ' + (bytes.length - SHOWN) +
        ' more bytes, same pattern</span>';
document.getElementById('bytes').innerHTML = html;

var count = view.getUint32(80, true);

function report(extra) {
  var lines = [];
  lines.push('triangles in the count field   ' + count);
  lines.push('file size                      ' + bytes.length + ' bytes');
  lines.push('84 + 50 x ' + count + '                 ' + (84 + 50 * count) +
             (84 + 50 * count === bytes.length ? '   <- matches' : '   <- MISMATCH'));
  lines.push('');
  lines.push('corners stored                 ' + (count * 3));
  lines.push('corners the cube actually has  8');
  lines.push('so every corner is written     ' + (count * 3 / 8) + ' times over');
  if (extra) { lines.push(''); lines.push(extra); }
  document.getElementById('out').textContent = lines.join('\\n');
}

document.getElementById('bytes').addEventListener('click', function (e) {
  var i = e.target && e.target.getAttribute && e.target.getAttribute('data-i');
  if (i === null || i === undefined) return;
  i = Number(i);
  report('byte ' + i + ' = ' + bytes[i] + '   (0x' +
         bytes[i].toString(16).toUpperCase().padStart(2, '0') + ')\\n' +
         describe(i).what);
});

report('Click a byte to see what it is.');`,
      outputHeight: 520,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Write the parser

No library. You have an \`ArrayBuffer\` of a real binary STL and everything you
need to read it.

Three steps:

1. Read the triangle count — a 32-bit unsigned integer at **byte 80**, little-endian.
2. For each triangle \`n\`, jump to byte \`84 + 50n\`, skip the 12 bytes of
   normal, and read **9 floats** — three corners of three numbers each.
3. Return \`{ points, triangles }\` in the points-plus-indices form lessons 1 and 3
   used. Since the file shares nothing, every triangle gets its own three
   points: triangle \`n\` uses points \`3n\`, \`3n+1\`, \`3n+2\`.

It draws what you parse, so a wrong stride or a wrong endianness is something
you will see rather than something you are told.

**Every read is little-endian.** Get that wrong and you will get numbers, not
an error.`,
      html: `${THREE_CDN}
<div id="app" style="width:100%;height:260px;background:#0a0f1e;border-radius:8px"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `${CUBE}

${WRITER}

var buffer = writeSTL(CORNERS, TRIS);

// ── your job ──────────────────────────────────────────────────────────────
// TODO: read the buffer and return { points, triangles }.
//
//   points    an array of [x,y,z]
//   triangles an array of [i,j,k] indexing into points
//
// Reminders:
//   view.getUint32(offset, true)   reads a 32-bit unsigned integer
//   view.getFloat32(offset, true)  reads a 32-bit float
//   the 'true' means little-endian, and it is not optional
//
// Layout:  count at byte 80  |  triangle n starts at 84 + 50*n
//          within a record:  12 bytes normal, then 9 floats, then 2 bytes
function parseSTL(buffer) {
  var view = new DataView(buffer);
  var points = [];
  var triangles = [];

  // your code here

  return { points: points, triangles: triangles };
}

// ── it draws whatever you return ──────────────────────────────────────────
var mesh = parseSTL(buffer);

var app = document.getElementById('app');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, app.clientWidth / 260, 0.1, 100);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, 260);
app.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
var lamp = new THREE.DirectionalLight(0xffffff, 0.9);
lamp.position.set(2, 3, 4);
scene.add(lamp);

if (mesh.triangles.length) {
  var xyz = [];
  mesh.triangles.forEach(function (t) {
    t.forEach(function (i) {
      var p = mesh.points[i] || [0, 0, 0];
      xyz.push(p[0], p[1], p[2]);
    });
  });
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(xyz), 3));
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    color: 0x8c96a3, side: THREE.DoubleSide })));
}

${ORBIT}
orbit(camera, renderer.domElement, 3.2);
(function frame() { requestAnimationFrame(frame); renderer.render(scene, camera); }());

document.getElementById('out').textContent =
  'file        ' + buffer.byteLength + ' bytes\\n' +
  'points      ' + mesh.points.length + '   (expect 36)\\n' +
  'triangles   ' + mesh.triangles.length + '   (expect 12)';`,
      check: (js) => {
        const no = (message) => ({ pass: false, message });

        // Build the same file the cell builds, independently of the reader's code.
        const CORNERS = [
          [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
          [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
        ];
        const QUADS = [[0, 1, 5, 4], [0, 3, 2, 1], [4, 5, 6, 7],
                       [1, 2, 6, 5], [3, 0, 4, 7], [2, 3, 7, 6]];
        const TRIS = [];
        QUADS.forEach((q) => {
          TRIS.push([q[0], q[1], q[2]]);
          TRIS.push([q[0], q[2], q[3]]);
        });
        const size = 84 + TRIS.length * 50;
        const buffer = new ArrayBuffer(size);
        const dv = new DataView(buffer);
        dv.setUint32(80, TRIS.length, true);
        let at = 84;
        for (const t of TRIS) {
          at += 12;
          for (const n of t) {
            dv.setFloat32(at, CORNERS[n][0], true); at += 4;
            dv.setFloat32(at, CORNERS[n][1], true); at += 4;
            dv.setFloat32(at, CORNERS[n][2], true); at += 4;
          }
          at += 2;
        }

        let parseSTL;
        try {
          // eslint-disable-next-line no-new-func
          parseSTL = new Function(
            js.replace(/^\s*\/\/ ── it draws whatever you return[\s\S]*$/m, '') +
            '\nreturn parseSTL;',
          )();
        } catch (e) {
          return no('The code did not run: ' + e.message);
        }
        if (typeof parseSTL !== 'function') return no('parseSTL is not a function.');

        let out;
        try {
          out = parseSTL(buffer);
        } catch (e) {
          if (/outside the bounds/i.test(e.message)) {
            return no('The parser read past the end of the file, which means the triangle '
              + 'count came out far too large. This file is ' + buffer.byteLength
              + ' bytes, so it holds (' + buffer.byteLength + ' - 84) / 50 = '
              + ((buffer.byteLength - 84) / 50) + ' triangles. Check the count is read as '
              + 'view.getUint32(80, true) — at byte 80, and little-endian.');
          }
          return no('parseSTL threw: ' + e.message);
        }
        if (!out || !Array.isArray(out.points) || !Array.isArray(out.triangles)) {
          return no('parseSTL should return { points: [...], triangles: [...] }.');
        }
        if (out.triangles.length === 0) {
          return no('No triangles came back. The count is a uint32 at byte 80 — '
            + 'view.getUint32(80, true).');
        }
        if (out.triangles.length !== 12) {
          return no('Got ' + out.triangles.length + ' triangles, expected 12. '
            + 'The count field says how many records follow; each is 50 bytes.');
        }
        if (out.points.length !== 36) {
          return no('Got ' + out.points.length + ' points, expected 36. The file shares '
            + 'nothing, so each of the 12 triangles brings its own 3 corners.');
        }
        const flat = out.triangles.flat();
        if (flat.length !== 36 || !flat.every((i) => Number.isInteger(i) && i >= 0 && i < out.points.length)) {
          return no('Some triangle index does not point at a real entry in points.');
        }
        if (out.points.some((p) => !Array.isArray(p) || p.length !== 3 || p.some((c) => !Number.isFinite(c)))) {
          return no('Some point is not three finite numbers. A NaN here usually means a '
            + 'read went past the end of a record — check the stride is 50.');
        }

        // Every parsed corner must be an actual corner of the cube. This is what
        // catches a wrong stride or the wrong endianness: both produce real
        // numbers, in the wrong places.
        const near = (p, q) => Math.abs(p[0] - q[0]) < 1e-5
          && Math.abs(p[1] - q[1]) < 1e-5 && Math.abs(p[2] - q[2]) < 1e-5;
        const stray = out.points.findIndex((p) => !CORNERS.some((c) => near(p, c)));
        if (stray >= 0) {
          const p = out.points[stray];
          // Reading these bytes the wrong way round gives absurd magnitudes in
          // EITHER direction: -0.5 big-endian comes back as 2.676e-43, not as
          // a large number. Catch both, or the lesson's flagship mistake gets
          // the generic offsets message.
          const absurd = p.some((c) => c !== 0 && (Math.abs(c) > 1e3 || Math.abs(c) < 1e-6));
          return no('Point ' + stray + ' came out as [' + p.map((n) => n.toPrecision(4)).join(', ')
            + '], which is not a corner of this cube. '
            + (absurd
              ? 'Numbers that far from the 0.5s this cube is made of almost always mean the '
                + 'bytes were read in the wrong order. Every getFloat32 and getUint32 needs '
                + 'true as its second argument — the file is little-endian.'
              : 'Check the offsets: triangle n starts at 84 + 50*n, and the 9 corner '
                + 'floats begin 12 bytes into the record, after the normal.'));
        }

        // All 8 distinct corners must appear, or some records were skipped.
        const found = CORNERS.filter((c) => out.points.some((p) => near(p, c)));
        if (found.length !== 8) {
          return no('Only ' + found.length + ' of the cube’s 8 corners turned up. '
            + 'Some records are being missed — check the loop runs for every one of '
            + 'the 12 triangles.');
        }

        return {
          pass: true,
          message: '12 triangles, 36 points, every one a real corner. You just read a '
            + 'binary file with nothing but offsets and a stride — which is all any '
            + 'parser is.',
        };
      },
      successMessage: '✓ Parsed.',
      failMessage: '✗ Not yet.',
      outputHeight: 480,
    },

    {
      type: 'markdown',
      instruction: `### What the file does not contain

You have now read the whole format. Notice what was never there.

| | |
|---|---|
| **No units** | The file says \`1.25\`. Inches? Millimetres? **Nothing says.** You know because you know. |
| **No indices** | A corner shared by six triangles is stored six times, in full. |
| **No adjacency** | Nothing states that two triangles touch. Lesson 3 exists entirely because of this. |
| **No inside** | Nothing marks which side is metal. |
| **No features** | Nothing knows those 400 triangles are one bore. |

Measured on a real part: **64,938 stored corners for 21,646 triangles** —
exactly 3 each, nothing shared — which weld down to **10,825 actual points.**
Six sevenths of that file is the same handful of numbers written again and
again.

#### And the trap that catches people who use a library

\`trimesh.load\` and \`pyvista.read\` **weld on the way in, by default, with a
tolerance you did not choose, and they do not mention it.**

On that same file, \`pv.read\` hands back 10,825 points. The file holds 64,938.
Run \`.clean()\` afterwards and it finds nothing to do — because the work was
already done silently — and it reads exactly like a job that worked.

Two loaders on one file gave two different point counts, and neither said a
word about it.

**So: when a loader hands you data, find out what it changed.** Compare what
came back against what the file says. The count field is right there at byte
80, and it does not lie.

The Python half below does exactly that comparison.`,
    },

  ],
};

// ── The Python half ───────────────────────────────────────────────────────
const PY_CELLS = [
  {
    id: 'write',
    cellTitle: 'Write the file, so you know what is in it',
    prose: [
      'Parsing a file somebody else wrote is hard to check: if you get a wrong answer you cannot tell whether your parser is wrong or your expectation is. So write one first, from a cube you already know, and then read it back.',
      'struct.pack is Python’s tool for turning numbers into bytes. Its first argument is a format string: "<" means little-endian, "I" is a 32-bit unsigned integer, "f" is a 32-bit float, and "12f" means twelve of them in a row. Those letters are the whole of the encoding scheme.',
      'b"" is a bytes literal rather than a string - a row of values 0 to 255, which is what a file is. Note the header is 80 bytes of nothing, written only because the count that follows has to sit at byte 80.',
    ],
    code: `import struct
import numpy as np

CORNERS = np.array([
    [-0.5,-0.5,-0.5], [0.5,-0.5,-0.5], [0.5,0.5,-0.5], [-0.5,0.5,-0.5],
    [-0.5,-0.5, 0.5], [0.5,-0.5, 0.5], [0.5,0.5, 0.5], [-0.5,0.5, 0.5],
], dtype=np.float32)

QUADS = [(0,1,5,4), (0,3,2,1), (4,5,6,7), (1,2,6,5), (3,0,4,7), (2,3,7,6)]
TRIS = np.array([t for q in QUADS
                   for t in ((q[0],q[1],q[2]), (q[0],q[2],q[3]))])

def write_stl(corners, tris):
    out = bytearray()
    out += b"mesh lesson 4".ljust(80, b"\\0")     # 80 bytes, ignored
    out += struct.pack("<I", len(tris))           # 4 bytes, the count
    for t in tris:
        A, B, C = corners[t[0]], corners[t[1]], corners[t[2]]
        n = np.cross(B - A, C - A)
        L = np.linalg.norm(n) or 1.0
        out += struct.pack("<3f", *(n / L))       # 12 bytes
        out += struct.pack("<9f", *A, *B, *C)     # 36 bytes
        out += struct.pack("<H", 0)               # 2 bytes
    return bytes(out)

data = write_stl(CORNERS, TRIS)

print("triangles written ", len(TRIS))
print("bytes             ", len(data))
print("84 + 50 x", len(TRIS), "      ", 84 + 50 * len(TRIS))
print()
print("first 16 bytes    ", data[:16])
print("the count field   ", struct.unpack("<I", data[80:84])[0])`,
  },
  {
    id: 'parse',
    cellTitle: 'Read it back without a loop',
    prose: [
      'The obvious parser walks the records one at a time. For 21,646 triangles that is 21,646 trips round a Python loop, and Python loops are slow enough that this alone can dominate the load time.',
      'np.frombuffer reads raw bytes straight into an array with no copying and no loop. The trick is the dtype: instead of describing a number, describe the whole 50-byte record - a field of 3 floats, a field of 9 floats, and a field of 2 raw bytes. numpy then walks the file at that stride itself, in C.',
      'The offset=84 argument is what skips the header and the count, so the first record starts where it should. Once that is set up, data["corners"] is every corner of every triangle, already shaped (n, 3, 3).',
      'Compare the two timings at the bottom. That difference is the whole reason for learning the dtype form.',
    ],
    code: `import time

# One record, described to numpy exactly as the format lays it out.
RECORD = np.dtype([
    ("normal",  "<3f4"),   # 12 bytes  - 3 little-endian float32
    ("corners", "<9f4"),   # 36 bytes  - 9 of them
    ("attr",    "<u2"),    #  2 bytes  - unsigned 16-bit
])
print("numpy agrees the stride is", RECORD.itemsize, "bytes")

def parse_stl(raw):
    count = struct.unpack("<I", raw[80:84])[0]
    records = np.frombuffer(raw, dtype=RECORD, count=count, offset=84)
    corners = records["corners"].reshape(count, 3, 3)
    return count, corners, records["normal"]

count, corners, normals = parse_stl(data)
print("triangles         ", count)
print("corners array     ", corners.shape, " <- (triangles, 3 corners, xyz)")
print()
print("triangle 0 corner 0", corners[0][0])
print("matches the cube   ", bool(np.allclose(corners[0][0], CORNERS[TRIS[0][0]])))

# And the loop version, for the comparison that matters.
def parse_slow(raw):
    n = struct.unpack("<I", raw[80:84])[0]
    out = []
    for i in range(n):
        at = 84 + 50 * i + 12
        out.append(struct.unpack("<9f", raw[at:at + 36]))
    return np.array(out).reshape(n, 3, 3)

big = write_stl(CORNERS, np.tile(TRIS, (500, 1)))   # 6,000 triangles
t0 = time.perf_counter(); parse_stl(big);  t1 = time.perf_counter()
t2 = time.perf_counter(); parse_slow(big); t3 = time.perf_counter()
print()
print(f"6,000 triangles   frombuffer {1000*(t1-t0):7.2f} ms")
print(f"                  python loop{1000*(t3-t2):7.2f} ms")
print(f"                  {(t3-t2)/(t1-t0):.0f}x")`,
  },
  {
    id: 'ch-parse',
    challengeType: 'write',
    challengeTitle: 'Read the count without trusting the count',
    difficulty: 'warm-up',
    prompt:
      'A truncated or mislabelled file will still have a number sitting at byte 80, and it '
      + 'may be a large one. Write stl_triangle_count(raw) that returns the triangle count '
      + 'implied by the FILE SIZE - (len - 84) / 50 - or None if that does not divide '
      + 'evenly, which means it is not a binary STL. Then compare it against the stored count.',
    hint:
      'len(raw) gives the size in bytes. The division must come out whole: use the modulo '
      + 'operator to check there is no remainder before dividing. This is the cheapest '
      + 'sanity check there is, and it costs no reading at all.',
    code: `def stl_triangle_count(raw):
    # TODO: return the count implied by the file size, or None
    pass


print(stl_triangle_count(data), "should be 12")
print(stl_triangle_count(data + b"junk"), "should be None")
print(stl_triangle_count(b"too short"), "should be None")`,
    solution: `def stl_triangle_count(raw):
    if len(raw) < 84:
        return None
    body = len(raw) - 84
    if body % 50 != 0:
        return None
    return body // 50


print(stl_triangle_count(data), "should be 12")
print(stl_triangle_count(data + b"junk"), "should be None")
print(stl_triangle_count(b"too short"), "should be None")`,
    testCode: `assert stl_triangle_count(data) == 12, (
    f"the cube file is 12 triangles, got {stl_triangle_count(data)}")
assert stl_triangle_count(data + b"junk") is None, (
    "4 stray bytes make the body indivisible by 50, so this is not a valid binary STL")
assert stl_triangle_count(b"too short") is None, (
    "anything under 84 bytes cannot even hold a header and a count")
assert stl_triangle_count(write_stl(CORNERS, np.tile(TRIS, (7, 1)))) == 84, (
    "84 triangles expected from 7 copies of the cube")
"SUCCESS: the file size alone tells you the triangle count, before you read anything."`,
  },
  {
    id: 'ch-dtype',
    challengeType: 'write',
    challengeTitle: 'Describe the record to numpy yourself',
    difficulty: 'core',
    prompt:
      'Build the record dtype from the layout rather than copying it. Call it MY_RECORD, '
      + 'with three fields named normal, corners and attr, so that its itemsize comes to '
      + 'exactly 50 bytes and np.frombuffer can walk a real file with it. Getting the '
      + 'itemsize wrong by even one byte scrambles every triangle after the first.',
    hint:
      'np.dtype takes a list of (name, format) pairs. "<3f4" is three little-endian '
      + '4-byte floats, so 12 bytes; "<u2" is one unsigned 2-byte integer. The three '
      + 'fields are 12 + 36 + 2. Check RECORD.itemsize as you go.',
    code: `MY_RECORD = np.dtype([
    # TODO: three fields - normal, corners, attr - totalling 50 bytes
])

print("itemsize:", MY_RECORD.itemsize, "should be 50")

if MY_RECORD.itemsize == 50:
    n = struct.unpack("<I", data[80:84])[0]
    recs = np.frombuffer(data, dtype=MY_RECORD, count=n, offset=84)
    print("triangles read:", len(recs))
    print("corner 0 of triangle 0:", recs["corners"].reshape(n, 3, 3)[0][0])`,
    solution: `MY_RECORD = np.dtype([
    ("normal",  "<3f4"),
    ("corners", "<9f4"),
    ("attr",    "<u2"),
])

print("itemsize:", MY_RECORD.itemsize, "should be 50")

if MY_RECORD.itemsize == 50:
    n = struct.unpack("<I", data[80:84])[0]
    recs = np.frombuffer(data, dtype=MY_RECORD, count=n, offset=84)
    print("triangles read:", len(recs))
    print("corner 0 of triangle 0:", recs["corners"].reshape(n, 3, 3)[0][0])`,
    testCode: `assert 'MY_RECORD' in dir(), "MY_RECORD was never defined."
assert MY_RECORD.itemsize == 50, (
    f"itemsize is {MY_RECORD.itemsize}, not 50. The record is 12 bytes of normal, "
    f"36 of corners and 2 of attribute.")
for f in ("normal", "corners", "attr"):
    assert f in MY_RECORD.names, f"no field named '{f}' - got {MY_RECORD.names}"
assert MY_RECORD["normal"].shape == (3,), "normal should be 3 floats"
assert MY_RECORD["corners"].shape == (9,), "corners should be 9 floats"

_n = struct.unpack("<I", data[80:84])[0]
_r = np.frombuffer(data, dtype=MY_RECORD, count=_n, offset=84)
assert len(_r) == 12, f"read {len(_r)} records, expected 12"
_c = _r["corners"].reshape(_n, 3, 3)
assert np.allclose(_c[0][0], CORNERS[TRIS[0][0]]), (
    "the first corner does not match the cube - check the field order: "
    "normal comes before corners.")
_flat = _c.reshape(-1, 3)
assert len(np.unique(_flat, axis=0)) == 8, (
    "the 36 corners should reduce to the cube's 8 distinct points")
"SUCCESS: 50 bytes, described once, and numpy strides the whole file with no loop."`,
  },
  {
    id: 'missing',
    cellTitle: 'What is not in there',
    prose: [
      'The parser works, so now measure what the format threw away.',
      'The corner count against the welded point count is the one that costs you later. Everything lesson 3 built exists because this number is what it is.',
      'And note the units line. There is no answer to print, because the file does not contain one - a fact worth seeing as a blank rather than being told about.',
    ],
    code: `flat = corners.reshape(-1, 3)
welded = np.unique(flat, axis=0)

print("corners stored in the file    ", len(flat))
print("distinct points they represent", len(welded))
print("stored per actual point       ", len(flat) / len(welded))
print()
print("units declared by the format  ", None, " <- there is no field for it")
print("adjacency declared            ", None, " <- lesson 3 exists for this")
print("which side is material        ", None)
print()

# The stored normals are written by the exporter, not derived. Check them
# against the cross product from lesson 2 rather than believing them.
A = corners[:, 0]; B = corners[:, 1]; C = corners[:, 2]
computed = np.cross(B - A, C - A)
lengths = np.linalg.norm(computed, axis=1, keepdims=True)
computed = computed / np.where(lengths == 0, 1, lengths)
agree = np.allclose(computed, normals, atol=1e-5)
print("stored normals match computed ", agree)
print("  (they do here because this file was written correctly two cells ago -")
print("   on a file from a real exporter, check rather than assume)")`,
  },
  {
    id: 'loader',
    cellTitle: 'Do not trust the loader',
    prose: [
      'trimesh.load and pyvista.read weld on the way in, by default, with a tolerance you did not choose, and they say nothing about it.',
      'That is not a bug and it is usually what you want. The problem is only that it is silent: you ask for a file, you get back something that is not what the file contains, and nothing marks the difference. A .clean() afterwards then finds nothing to do and reads exactly like a job that worked.',
      'So compare. The count field at byte 80 does not lie, and the file size confirms it independently. Whatever a loader hands you, those two numbers are what was actually on disk.',
    ],
    code: `import micropip
await micropip.install("trimesh")
import trimesh, io

on_disk_tris = struct.unpack("<I", data[80:84])[0]
on_disk_corners = on_disk_tris * 3

loaded = trimesh.load(io.BytesIO(data), file_type="stl")

print(f"{'':<28}{'corners/points':>15}{'triangles':>11}")
print(f"{'the file itself':<28}{on_disk_corners:>15}{on_disk_tris:>11}")
print(f"{'what trimesh handed back':<28}{len(loaded.vertices):>15}{len(loaded.faces):>11}")
print()
if len(loaded.vertices) != on_disk_corners:
    lost = on_disk_corners - len(loaded.vertices)
    print(f"It merged {lost} of the {on_disk_corners} corners on the way in.")
    print("Nothing warned you. The triangle count is unchanged, so the only")
    print("sign is a vertex count that does not match the file.")
else:
    print("This build did not weld on load - which is itself worth knowing,")
    print("because it means the behaviour depends on the version.")
print()
print("watertight", loaded.is_watertight, " euler", loaded.euler_number)
print()
print("On a real part measured for this series: the file holds 64,938 corners")
print("for 21,646 triangles, and pyvista.read returns 10,825 points.")`,
  },
  {
    id: 'ch-audit',
    challengeType: 'write',
    challengeTitle: 'Audit what a loader did',
    difficulty: 'core',
    prompt:
      'Write audit(raw, loaded_vertex_count) returning a dict with keys file_corners, '
      + 'file_triangles, returned_points and welded - where welded is True when the loader '
      + 'gave back fewer points than the file holds corners. This is the check that should '
      + 'run on every import, because it costs two numbers and catches a silent change.',
    hint:
      'The triangle count is a uint32 at bytes 80 to 84; struct.unpack("<I", raw[80:84])[0] '
      + 'reads it. Corners is three times that. You do not need to parse a single triangle '
      + 'to answer this.',
    code: `def audit(raw, loaded_vertex_count):
    # TODO: return the four keys described above
    pass


print(audit(data, len(loaded.vertices)))`,
    solution: `def audit(raw, loaded_vertex_count):
    tris = struct.unpack("<I", raw[80:84])[0]
    corners = tris * 3
    return {
        "file_corners": corners,
        "file_triangles": tris,
        "returned_points": loaded_vertex_count,
        "welded": loaded_vertex_count < corners,
    }


print(audit(data, len(loaded.vertices)))`,
    testCode: `r = audit(data, 8)
assert r is not None, "audit returned None - 'pass' is still there."
for k in ("file_corners", "file_triangles", "returned_points", "welded"):
    assert k in r, f"the returned dict has no '{k}' key"
assert r["file_triangles"] == 12, f"file_triangles was {r['file_triangles']}, expected 12"
assert r["file_corners"] == 36, f"file_corners was {r['file_corners']}, expected 36 (3 per triangle)"
assert r["welded"] is True, "8 points back from a file holding 36 corners IS a weld"
assert audit(data, 36)["welded"] is False, "36 back from 36 is not a weld"
"SUCCESS: two numbers, read without parsing a triangle, and a silent weld cannot hide."`,
  },
  {
    id: 'upload',
    cellTitle: 'Now do it to your own part',
    prose: [
      'Use the upload button above the notebook to add an STL of your own. It goes into the browser’s own filesystem at /home/pyodide/uploads and never leaves your machine.',
      'Then run this. It reports the triangle count, the file size check, the corner-to-point ratio, and whether it is closed - all from the parser written here rather than from a library.',
      'This is the moment the lesson stops being about a cube. If you have the part that took four minutes, put that one in: the triangle count is the number that explains it.',
    ],
    code: `import os

UPLOADS = "/home/pyodide/uploads"
files = sorted(f for f in os.listdir(UPLOADS)) if os.path.isdir(UPLOADS) else []

if not files:
    print("No files uploaded yet - use the upload button and run this again.")
    print("Falling back to the cube written earlier.")
    raw, name = data, "cube (generated)"
else:
    name = files[0]
    with open(os.path.join(UPLOADS, name), "rb") as fh:
        raw = fh.read()

print("file          ", name)
print("bytes         ", len(raw))

implied = (len(raw) - 84) / 50 if len(raw) >= 84 else -1
if implied != int(implied) or implied < 0:
    print()
    print("This is not a binary STL - the body does not divide into 50-byte")
    print("records. It may be an ASCII STL, which is a different format.")
    print("First 80 bytes:", raw[:80])
else:
    count, corners, normals = parse_stl(raw)
    flat = corners.reshape(-1, 3)
    welded = np.unique(flat, axis=0)
    print("triangles     ", count, " (size implies", int(implied), "- agrees:", count == int(implied), ")")
    print("corners stored", len(flat))
    print("actual points ", len(welded))
    print("stored per pt ", round(len(flat) / len(welded), 2))
    print()
    size = flat.max(axis=0) - flat.min(axis=0)
    print("bounding box  ", np.round(size, 4), "in whatever units the file does not state")
    print()
    print("Triangle count is what predicts the work. Physical size does not.")`,
  },
];

export default {
  id: 'mesh-engine-1-4-mesh-files',
  slug: 'mesh-files',
  chapter: 'mesh-engine.1',
  order: 3,
  title: 'Mesh Files',
  subtitle: 'Open an STL a byte at a time, and find out what the format never stored.',
  tags: [
    'STL', 'binary format', 'byte', 'endianness', 'stride', 'header',
    'DataView', 'ArrayBuffer', 'struct', 'np.frombuffer', 'chord tolerance',
    'parser', 'trimesh',
  ],
  aliases: 'binary STL parser byte endian little-endian header stride record offset DataView ArrayBuffer struct.pack np.frombuffer dtype chord tolerance triangle count attribute byte count trimesh.load pyvista.read silent weld',
  timeToComplete: 60,
  coreConcept:
    'A binary STL is an 80-byte header nobody reads, a 4-byte triangle count, and then one fixed 50-byte record per triangle: 12 bytes of normal, 36 bytes of corners, 2 bytes ignored. Because the stride never varies, the file size alone gives the triangle count. What it does not hold is units, indices, adjacency, which side is material, or any notion of a feature - and the curves were replaced by flats at export, permanently, which is why physical size predicts nothing about how long a part takes to process.',
  prerequisites: ['mesh-engine-1-3-topology-and-welding'],
  nextLesson: 'mesh-engine-1-5-point-to-triangle',

  semantics: {
    core: [
      { symbol: 'byte', meaning: 'One number from 0 to 255. A file is a row of them and nothing else.' },
      { symbol: 'float32', meaning: 'A number encoded across 4 bytes. Nine of them make a triangle’s corners.' },
      { symbol: 'little-endian', meaning: 'Smallest byte first. STL is little-endian; reading it the other way returns a real number that is simply wrong.' },
      { symbol: 'header', meaning: 'A fixed block at the front of a file before the content. In STL it is 80 bytes and holds nothing about the model.' },
      { symbol: 'stride', meaning: 'The distance from one record to the next. 50 bytes here, never varying, which is what makes triangle n reachable at 84 + 50n.' },
      { symbol: '84 + 50n', meaning: 'Where triangle n begins, and with it the file size formula - so a size tells you a triangle count.' },
      { symbol: 'attribute byte count', meaning: 'The last 2 bytes of a record. Almost always zero. Some exporters hide colour there, non-standardly.' },
      { symbol: 'chord tolerance', meaning: 'How finely the exporter chopped the curves. Chosen once, at export, and permanent - the roundness is gone, not compressed.' },
    ],
    rulesOfThumb: [
      'Check the file size against 84 + 50 x count before reading anything. If it does not divide evenly it is not a binary STL.',
      'Every read is little-endian. A wrong-endian read produces numbers, not errors.',
      'Compute the normal from the corners. The stored one is written by the exporter and is often wrong.',
      'Triangle count predicts the work. Physical size predicts nothing.',
      'When a loader hands you a mesh, compare its vertex count against the file. Silent welding is the default in both trimesh and pyvista.',
      'Parse with a record dtype, not a loop. The stride is the whole reason numpy can do it without one.',
    ],
  },

  hook: {
    question: 'A 2" x 2" x 0.25" part took four minutes to process on a fast machine. A part twice that size took seconds. What does physical size tell you about how long a mesh takes to handle?',
    realWorldContext: 'Nothing at all. The small part was roughly 100,000 triangles because it was covered in small radii, and every curve had been chopped into flats at export time. The large one was mostly flat faces and came to about 5,000. The choice of how finely to chop was made once by the CAM system and is permanent - the roundness is not compressed in the file, it is absent from it. The only number that predicts the work is the triangle count, and it is four bytes at offset 80.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'A file is a row of bytes, each one a number from 0 to 255. Anything else it appears to contain is a decision about how to read them.',
      'A 32-bit float takes four of those bytes, and the order they go in is a convention. STL uses little-endian, smallest first.',
      'The layout is 80 bytes of header that means nothing, 4 bytes saying how many triangles follow, then one 50-byte record each.',
      'Because that 50 never varies, triangle n starts at 84 + 50n - so you can jump to any triangle, and the file size alone gives you the count.',
      'Each record holds a normal you should not trust and nine floats you should, written out in full with nothing shared.',
      'What is absent matters more than what is present: no units, no indices, no adjacency, no inside, no features.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: read a binary STL',
        body: 'Step 1. Check len(file) >= 84 and (len - 84) % 50 == 0. If not, it is not a binary STL.\nStep 2. Read a uint32 at byte 80, little-endian. That is the triangle count.\nStep 3. Confirm it agrees with (len - 84) / 50.\nStep 4. For each n, go to 84 + 50n, skip 12 bytes of normal, read 9 little-endian float32.\nStep 5. Compute your own normals from the corners.\nStep 6. Weld if you need topology, and verify with the boundary-edge count from lesson 3.',
      },
      {
        type: 'warning',
        title: 'A wrong-endian read does not fail',
        body: 'Reading a little-endian float as big-endian returns a perfectly valid number that is not the one in the file. There is no error and nothing looks broken until the part draws as noise, or worse, draws as something plausible. The same is true of a wrong stride. This is why the challenge checks every parsed corner against the corners the cube actually has, rather than only counting them.',
      },
      {
        type: 'warning',
        title: 'The stored normal is not evidence',
        body: 'Each record carries a face normal written by the exporter rather than derived from the corners. It is frequently wrong, sometimes zero, and occasionally points inward. Lesson 2 showed the cross product that computes it in one step from the three corners you already have. Compute it.',
      },
      {
        type: 'insight',
        title: 'Loaders weld silently, and then .clean() reports success',
        body: 'trimesh.load and pyvista.read both merge coincident vertices on import, by default, with a tolerance you did not pick, and neither mentions it. Measured on a real part: the file holds 64,938 corners for 21,646 triangles, and pyvista.read hands back 10,825 points. Calling .clean() afterwards then finds nothing to do, which reads exactly like a job that worked. Two loaders on one file gave two different point counts. The count field at byte 80 is the only thing that does not have an opinion.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'The bytes, then the parser',
        caption: 'Watch a number become four bytes, then read a real file with nothing but offsets.',
        props: {
          lesson: LESSON_MESH_1_4,
        },
      },
    ],
  },

  math: {
    prose: [
      'The arithmetic here is small but load-bearing: 84 + 50n locates every record, and inverting it turns a file size into a triangle count without reading anything.',
      'The notebook writes an STL before reading one, so a wrong answer can only be the parser and never the expectation.',
      'Then it parses without a loop, by describing the 50-byte record to numpy as a dtype and letting it walk the stride in C. The timing comparison is the argument.',
      'The last cells measure what the format discarded, audit what a library silently changed, and then do all of it to a part you upload yourself.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'Write it, read it, then check what a library did to it',
        mathBridge: 'The whole format rests on one linear map: byte = 84 + 50n + field offset. Because it is linear with a constant stride, it inverts - triangles = (bytes - 84) / 50 - which is why a file size is a triangle count, and why numpy can stride through the file without interpreting it.',
        caption: 'struct and np.frombuffer, then trimesh audited rather than trusted.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'The four-minute matchbox',
      prose: 'A 2" x 2" x 0.25" part, about 100,000 triangles, four minutes on a fast machine. Small radii chopped into many flats at export. A larger part made of flats came to 5,000 triangles and went in seconds. Physical size explained neither.',
    },
    {
      title: 'A file size is a triangle count',
      prose: '1,082,384 bytes. Subtract the 84 of header and count, divide by the 50-byte stride, and it is 21,646 triangles - known before reading a single record, and a check that the file is what it claims to be.',
    },
    {
      title: 'The loader that already welded',
      prose: '64,938 corners in the file, 10,825 points back from pyvista.read, no warning. A .clean() afterwards found nothing to do, because there was nothing left to do.',
    },
  ],

  challenges: [
    {
      prompt: 'Write parseSTL from nothing: count at byte 80, records at 84 + 50n, nine little-endian floats each. Get 12 triangles and 36 points out of the cube.',
      hint: 'view.getFloat32(offset, true). The corners start 12 bytes into each record, after the normal.',
    },
    {
      prompt: 'Deliberately read the floats as big-endian and look at what comes out. Note that nothing throws.',
      hint: 'Drop the true from getFloat32. The numbers will be enormous or tiny, and entirely real.',
    },
    {
      prompt: 'Write stl_triangle_count that derives the count from the file size alone and returns None when the body does not divide by 50.',
      hint: 'Check the remainder before dividing. Under 84 bytes there is not even a header.',
    },
    {
      prompt: 'Audit a loader: compare the vertex count it returns against the corner count the file holds, and report whether it welded.',
      hint: 'Three times the count field at byte 80. No triangles need parsing.',
    },
    {
      prompt: 'Upload a real part and report its triangle count, its corner-to-point ratio, and whether the size check agrees with the stored count.',
      hint: 'Uploaded files land in /home/pyodide/uploads and never leave the browser.',
    },
  ],

  misconceptions: [
    {
      claim: 'A physically small part is a small mesh.',
      reality: 'Triangle count is set by how finely curves were chopped at export, not by size. A matchbox covered in radii can be 100,000 triangles; a part twice the size made of flats can be 5,000.',
    },
    {
      claim: 'The file records the units.',
      reality: 'It records the number 1.25 and nothing else. Inches and millimetres are indistinguishable in an STL. Every unit decision lives outside the file, in what you happen to know.',
    },
    {
      claim: 'The stored normal tells you which way the triangle faces.',
      reality: 'It tells you what the exporter wrote. It is often wrong and sometimes zero. Compute it from the corners with the cross product from lesson 2.',
    },
    {
      claim: 'Reading a file with the wrong endianness will throw an error.',
      reality: 'It returns a real number that is simply not the one in the file. Wrong strides behave the same way. Nothing fails; the geometry is just wrong, which is much harder to notice.',
    },
    {
      claim: 'A loader gives you what is in the file.',
      reality: 'trimesh and pyvista both weld on import by default with a tolerance you did not choose, and say nothing. The file said 64,938 corners; the loader said 10,825 points.',
    },
    {
      claim: 'A curved surface is stored as a curve and approximated for display.',
      reality: 'The opposite. The curve was replaced by flats when the file was written, and the original is not in there at all. No amount of processing recovers it.',
    },
  ],

  transferPrompts: [
    'You are handed a 4.3 MB STL. What can you say about it before reading a single triangle, and how?',
    'A part draws but looks like noise. Name three causes in the reading code, and how you would tell them apart.',
    'Why can numpy parse this format without a Python loop, and what property of the format makes that possible?',
    'A colleague says the import worked because it did not error. What two numbers would settle it?',
  ],

  debugging: [
    {
      symptom: 'Every coordinate is astronomically large or vanishingly small.',
      cause: 'The floats are being read big-endian.',
      fix: 'Pass true as the littleEndian argument on every getFloat32 and getUint32.',
    },
    {
      symptom: 'The first triangle is right and the rest are scrambled.',
      cause: 'The stride is wrong - usually 48 instead of 50, from forgetting the two attribute bytes.',
      fix: 'Records are 50 bytes. Triangle n starts at 84 + 50n.',
    },
    {
      symptom: 'The triangle count is enormous and parsing runs off the end.',
      cause: 'The count was read at the wrong offset, or the file is an ASCII STL that happens to have bytes at position 80.',
      fix: 'Check (len - 84) % 50 == 0 first, and compare the implied count against the stored one.',
    },
    {
      symptom: 'The part renders inside out or with black faces.',
      cause: 'The stored normals were used instead of computed ones.',
      fix: 'Compute from the corners. Lesson 2 has the cross product; lesson 3 has the winding check.',
    },
    {
      symptom: 'A vertex count from a library does not match the file.',
      cause: 'The loader welded on import, silently and by default.',
      fix: 'Compare against three times the count field before doing anything else, and choose the weld yourself.',
    },
  ],

  mastery: {
    prerequisites:
      'Lesson 3 for what welding is and why boundary edges matter, and lesson 2 for the cross product used to compute a normal. Bytes and hexadecimal are introduced here from nothing, with links to the Digital Fundamentals lessons for anyone who wants the full derivation.',
    signals: [
      'Can state what a byte, a header, a stride and little-endian each are, without hedging.',
      'Can derive a triangle count from a file size and say why that also validates the file.',
      'Can write a parser using only offsets, and can explain why a wrong one produces numbers rather than errors.',
      'Treats the stored normal as unverified data.',
      'Checks what a loader changed instead of assuming it changed nothing.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-1-3-topology-and-welding', why: 'Why an exploded mesh is a problem, and the boundary-edge count that says whether a weld worked.' },
      { lessonId: 'mesh-engine-1-2-vectors-and-triangles', why: 'The cross product that computes a normal, since the stored one cannot be trusted.' },
      { lessonId: 'df-2-1-binary-numbers', why: 'Where 0-to-255 comes from, and how a number is encoded in bits.' },
      { lessonId: 'df-1-2-hexadecimal', why: 'Reading the hex the byte viewer displays.' },
    ],
    futureLinks: [
      { lessonId: 'mesh-engine-1-5-point-to-triangle', why: 'With a real mesh loaded, the first computational-geometry question: how far is a point from a triangle.' },
    ],
  },

  checkpoints: [
    'I can say what a byte is and how a number gets encoded into four of them.',
    'I can explain endianness and what a wrong-endian read produces.',
    'I can lay out a binary STL from memory and locate triangle n.',
    'I can get a triangle count from a file size and say why that is also a validity check.',
    'I can list what the format does not contain and what each omission costs later.',
    'I know that loaders weld silently and how to detect it in two numbers.',
  ],

  assessment: {
    task: 'Given an unknown STL, report its triangle count, confirm the file is internally consistent, produce a welded mesh, and state what the file did not tell you.',
    acceptance: [
      'Count derived from size and cross-checked against the stored field.',
      'Corners parsed with correct stride and endianness, verified against known geometry.',
      'Normals computed rather than read.',
      'Weld verified by boundary-edge count, not assumed.',
      'An explicit statement of what is absent: units, adjacency, features, material side.',
    ],
  },

  quiz: [
    {
      question: 'An STL is 1,082,384 bytes. How many triangles, and how do you know?',
      options: [
        '21,646 — (1,082,384 − 84) / 50, because the stride never varies',
        'You cannot know without reading the file',
        '1,082,384 / 50',
        'It depends on the units',
      ],
      answer: 0,
      explanation: '84 bytes of header and count, then a fixed 50 per triangle. The division must come out whole, which also proves the file is a binary STL.',
    },
    {
      question: 'What happens if you read the floats big-endian instead of little-endian?',
      options: [
        'You get real numbers that are simply wrong, with no error',
        'The parser throws',
        'Nothing — the format is endian-neutral',
        'The coordinates come out negated',
      ],
      answer: 0,
      explanation: 'That is what makes it dangerous. A wrong-endian read produces valid floats, so the part draws as noise or, worse, as something plausible.',
    },
    {
      question: 'What is in the 80-byte header?',
      options: [
        'Nothing about the model — some exporters write a name, many write zeros',
        'The units and the scale',
        'The triangle count',
        'The bounding box',
      ],
      answer: 0,
      explanation: 'It is ignored by the format. You must skip it because the count sits at a fixed offset, but there is nothing in it to learn.',
    },
    {
      question: 'Why can a 2" part take far longer to process than a 4" part?',
      options: [
        'Triangle count comes from how finely curves were chopped at export, not from size',
        'Smaller parts need more precision',
        'The file header is larger',
        'It cannot — that would be a bug',
      ],
      answer: 0,
      explanation: 'Small radii become many flats. The chord tolerance was chosen once at export and is permanent. Roughly 100,000 triangles against 5,000.',
    },
    {
      question: 'trimesh.load returns 10,825 vertices for a file holding 64,938 corners. What happened?',
      options: [
        'It welded coincident vertices on import, by default, without saying so',
        'The file is corrupt',
        'It dropped triangles it could not read',
        'It compressed the mesh',
      ],
      answer: 0,
      explanation: 'Silent welding is the default in both trimesh and pyvista. The triangle count is unchanged, so the only sign is a vertex count that does not match the file.',
    },
    {
      question: 'The normal stored in each 50-byte record should be:',
      options: [
        'Recomputed from the three corners, because the stored one is often wrong',
        'Used directly — it is authoritative',
        'Ignored entirely, since normals do not matter',
        'Averaged with the computed one',
      ],
      answer: 0,
      explanation: 'It is written by the exporter, not derived. It is frequently wrong, sometimes zero, sometimes inward. One cross product from lesson 2 replaces it.',
    },
  ],
};
