// Lesson 4.7: every click is code. Each change made through the interface is written as the script line that
// would make it; run in order on the starting scene, the log rebuilds the scene exactly. Literals must round-trip
// and objects must be named, not numbered.

// A small editor: a scene of named objects, one path for every change, and a log.
const EDITOR = `// Numbers trimmed to 6 decimals (tiny ones to 0); arrays and objects written out; strings as JSON.
function lit(x) {
  if (typeof x === 'number') return String(Math.abs(x) < 5e-7 ? 0 : +x.toFixed(6))
  if (Array.isArray(x)) return '[' + x.map(lit).join(', ') + ']'
  if (x && typeof x === 'object') return '{ ' + Object.entries(x).map(([k, v]) => k + ': ' + lit(v)).join(', ') + ' }'
  return JSON.stringify(x)
}
const ref = (name) => 'scene.get(' + JSON.stringify(name) + ')'
function makeScene() {
  // Positions and rotations have x, y and z, as MeshLab's script objects do, so .position.x means what it says.
  const objects = [{ name: 'Box', position: { x: 0, y: 0.5, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, smooth: false }]
  return { objects, get: (name) => objects.find((o) => o.name === name), add: (o) => { objects.push(o); return o } }
}
let scene = makeScene()
const start = JSON.stringify(scene.objects)
const log = []
// The one path: make the change, and log the line that would make it.
function run(code, fn) { fn(); log.push(code) }
const setSmooth = (name, v) => run(ref(name) + '.smooth = ' + v, () => { scene.get(name).smooth = v })
const setTransform = (name, field, axis, v) => run(ref(name) + '.' + field + '.' + 'xyz'[axis] + ' = ' + lit(v), () => { scene.get(name)[field]['xyz'[axis]] = v })
const addObject = (o) => run('scene.add(' + lit(o) + ')', () => { scene.add(JSON.parse(JSON.stringify(o))) })
`;

const CLICKS = `${EDITOR}
// Three clicks in the interface: Shade smooth, Position X = 1.5, Rotation Y = 45° (stored in radians).
setSmooth('Box', true)
setTransform('Box', 'position', 0, 1.5)
setTransform('Box', 'rotation', 1, 45 * Math.PI / 180)
log.forEach((l, i) => console.log((i + 1) + ': ' + l))`;

const LITERALS = `${EDITOR}
console.log(lit(Math.PI / 4) + '   ' + lit(1e-9) + '   ' + lit(2.5000001) + '   ' + lit([1, 0.333333333, -0]))
console.log(lit({ name: 'Cone', position: [0, 1, 0] }) + '   ' + lit('a "quoted" name'))
// Trimming to 6 decimals loses at most 0.0000005, far below anything visible.
console.log('largest error from trimming π/4: ' + Math.abs(Number(lit(Math.PI / 4)) - Math.PI / 4).toExponential(1))`;

const REPLAY = `${EDITOR}
setSmooth('Box', true)
setTransform('Box', 'position', 0, 1.5)
setTransform('Box', 'rotation', 1, 45 * Math.PI / 180)
addObject({ name: 'Cone', position: { x: 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, smooth: true })
// Replay: a fresh copy of the starting scene, and the log run as a program.
const fresh = makeScene()
for (const line of log) Function('scene', line)(fresh)
const close = (a, b) => JSON.stringify(a, (k, v) => typeof v === 'number' ? +v.toFixed(6) : v) === JSON.stringify(b, (k, v) => typeof v === 'number' ? +v.toFixed(6) : v)
console.log(log.length + ' lines replayed; the same scene: ' + close(fresh.objects, scene.objects))
console.log('the start was ' + start.length + ' characters; the log is ' + log.join('\\n').length)`;

const NAMES = `${EDITOR}
// Why objects are named, not numbered. Log by position in the list instead:
const byIndex = []
scene.add({ name: 'Cone', position: { x: 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, smooth: false })
byIndex.push('scene.objects.splice(0, 1)')                       // delete the Box (object 0)
scene.objects.splice(0, 1)
byIndex.push('scene.objects[0].smooth = true')                   // shade the Cone, now object 0
scene.objects[0].smooth = true
// Replay on a scene where someone added a Light first: object 0 is now the Light.
const other = makeScene()
other.objects.unshift({ name: 'Light', position: { x: 0, y: 3, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, smooth: false })
other.add({ name: 'Cone', position: { x: 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, smooth: false })
for (const line of byIndex) Function('scene', line)(other)
console.log('by number: ' + other.objects.map((o) => o.name + (o.smooth ? ' (smooth)' : '')).join(', ') + ': the wrong object was deleted and shaded')
console.log('by name, "scene.get(\\"Cone\\").smooth = true" would shade the Cone whatever its place in the list')`;

const PICTURE = `${EDITOR}
setTransform('Box', 'position', 0, 1.5)
setTransform('Box', 'rotation', 2, 30 * Math.PI / 180)
const fresh = makeScene()
for (const line of log) Function('scene', line)(fresh)
// Draw the box from above, seen in each scene: yours (left) and the replay (right).
const canvas = document.createElement('canvas')
canvas.width = 560; canvas.height = 220
canvas.style.cssText = 'display: block; margin: 8px auto; max-width: 100%'
document.body.appendChild(canvas)
const g = canvas.getContext('2d')
g.fillStyle = '#1e293b'; g.fillRect(0, 0, 560, 220)
g.font = '14px sans-serif'; g.textAlign = 'center'
function draw(o, cx, title, colour) {
  g.save(); g.translate(cx + o.position.x * 40, 110); g.rotate(-o.rotation.z)
  g.fillStyle = colour; g.fillRect(-25, -25, 50, 50); g.restore()
  g.fillStyle = '#e2e8f0'; g.fillText(title, cx + 30, 205)
}
draw(scene.get('Box'), 120, 'your scene', '#4f8fd9')
draw(fresh.get('Box'), 380, 'replayed from the log', '#f59e0b')
console.log('log: ' + log.join('; '))`;

const CHALLENGE = `// In the Inspector you set Box's Rotation Y to 30°. Write the line MeshLab logs for it.
// (Objects by name, rotations in radians, numbers to 6 decimals.)
const line = ''

console.log(line)`;

const SOLVED = CHALLENGE.replace("const line = ''", 'const line = \'scene.get("Box").rotation.y = 0.523599\'');

/** The challenge's check: the logged line for Rotation Y = 30°. */
export function checkLine(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/^\s*const\s+line\s*=\s*(['"`])(.*)\1\s*$/m);
  if (!m) return no('Keep the line const line = \'…\', with the script line in quotes.');
  const text = m[2].trim();
  if (!text) return no('Write the line: which object, which field and axis, and the value.');
  const pm = text.match(/^scene\.get\((["'])(.*?)\1\)\.rotation\.([xyz])\s*=\s*(-?[\d.]+)$/);
  if (!pm) {
    if (/scene\.objects\[\d+\]/.test(text)) return no('Name the object: scene.get("Box"). A number in the list changes when objects are added or removed, so the replay could change the wrong one.');
    if (/rotation\s*=\s*\[/.test(text)) return no('The Inspector changes one axis: write rotation.y = …, not the whole rotation.');
    return no('The form is scene.get("Box").rotation.y = <radians>.');
  }
  const [, , name, axis, val] = pm, v = Number(val);
  if (name !== 'Box') return no(`The object is named "Box", not "${name}".`);
  if (axis !== 'y') return no(`Rotation Y is the y axis, not ${axis}.`);
  if (Math.abs(v - 30) < 1e-9) return no('30 is in degrees. Rotations are stored, and logged, in radians: 30 × π / 180.');
  if (Math.abs(v - Math.PI / 6) <= 5e-7) return { pass: true, message: `scene.get("Box").rotation.y = ${val}: the object by name, one axis, and 30° as radians to 6 decimals (π/6 = 0.5235987…). Run on the starting scene, it makes exactly the same change.` };
  return no(`${val} radians is ${+(v * 180 / Math.PI).toFixed(3)}°, not 30°.`);
}

export default {
  id: 'modelling-geometry-4-007',
  slug: 'every-click-is-code',
  chapter: 'modelling-geometry',
  order: 7,
  title: 'Every click is code',
  subtitle: 'Every change in the interface is logged as the script line that makes it; replayed, the log rebuilds your scene.',
  tags: ['scripting', 'logging', 'serialisation', 'reproducibility', 'automation'],
  coreConcept: 'Because every change goes through one path, each can be written as the script line that would make it: objects referenced by name, values written as literals that round-trip (numbers to 6 decimals, rotations in radians). Run in order on the starting scene, the log rebuilds the scene exactly, so a session becomes a program to read, edit and replay.',
  prerequisites: ['modelling-geometry-4-006', 'modelling-geometry-2-008'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-5-001',

  hook: {
    question: 'You spend twenty minutes clicking a model into shape. Could a program do exactly what you did, so you could change one number and rebuild it? In MeshLab, every click already wrote that program.',
    realWorldContext: 'Blender\'s Info panel, Maya\'s script editor and Excel\'s macro recorder all turn clicks into code. That is how artists automate the boring parts, how bugs get reproduced exactly, and how a session is turned into a tool.',
  },

  intuition: {
    prose: [
      'Lesson 4.6 sent every change through one path, to snapshot it for undo. That path is also the place to write the change down as code. Shade smooth on the Box becomes `scene.get("Box").smooth = true`. Setting Position X to $1.5$ becomes `scene.get("Box").position.x = 1.5`.',
      'Before running cell 1, predict: you type $45$ into Rotation Y. What number appears in the log?',
      '$0.785398$. The Inspector shows degrees, but rotations are stored in radians (lesson 2.2), and the log writes what is stored: $45° = \\pi/4 = 0.7853981\\ldots$, trimmed to $6$ decimals.',
      'Each value is written as a **literal**: text that reads back as the same value. Numbers are trimmed to $6$ decimals, which changes them by at most $0.0000005$, far below anything visible; numbers smaller than that are written as $0$. Names and other strings are written in JSON quotes, so a name with a quote in it still reads back.',
      'Objects are referenced by **name**, `scene.get("Box")`, not by their place in the list. Cell 4 shows why: log "object 0" and replay on a scene where something else came first, and the wrong object is deleted and shaded. Names are kept unique (MeshLab adds .001 to a duplicate), so a name always means one object.',
      'Now **replay**: take the scene as it was before the first logged change, and run the log as one script. It rebuilds the scene exactly, because each line makes the same change the click made. The log is the session as a program: you can read it, change a number and run it again.',
      'Undo (lesson 4.6) takes a step\'s line back out of the log, so the log is always the program for the scene you have now.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Log every click as code',
        body: 'Step 1. Route every change through one function, given the change and the script line that makes it.\nStep 2. Reference objects by unique name: scene.get("Name").\nStep 3. Write values as literals: numbers to 6 decimals (tiny ones as 0), arrays and objects written out, strings in JSON quotes.\nStep 4. Write the stored value, not the displayed one: radians for rotations.\nStep 5. Append the line to the log; remove it again if the step is undone.\nStep 6. To replay: a copy of the starting scene, then run the log in order.',
      },
      {
        type: 'warning',
        title: 'Log what is stored, not what is shown',
        body: 'The Inspector shows rotations in degrees; the scene stores radians. A log line with 45 instead of 0.785398 would turn the object 45 radians, about 2578°.',
      },
      {
        type: 'warning',
        title: 'A replay is only as good as its starting scene',
        body: 'The log records changes, not the scene. Replayed on a different starting scene (one without a Box, say), its lines fail or change something else. MeshLab replays from the scene before the first logged change.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: none, but one source of truth',
        body: 'The viewport draws whatever the scene holds; it never sees the log. Because the interface and scripts go through the same path, a scene built by clicking and the same scene built by its log are drawn identically.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "a recorded macro is only roughly what you did". The box in your scene (blue) and the box rebuilt from the log (amber) are in exactly the same place, turned exactly the same way. Invariant: replaying the log on the starting scene always gives the current scene.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'run() in the cells is Steps 1 and 5; ref() is Step 2; lit() is Step 3; the replay loop in cell 3 is Step 6.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Nothing changes for the GPU: a replayed scene is drawn exactly as the clicked one, because they are the same scene.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'The GUI → code tab shows MeshLab\'s log as you work; Script › Trace the GUI → code log (replay it) replays it on a fresh editor and compares hashes of the two scenes. Paste the log into the Script tab to edit and rerun it.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: a logging editor',
        caption: 'Clicks become lines, literals round-trip, the log replays, names beat numbers, and the two scenes agree.',
        props: {
          lesson: {
            title: 'Every click is code',
            subtitle: 'Log every change as code, then replay it.',
            cells: [
              { type: 'js', instruction: '### 1. Clicks become lines\nPredict first: what number does Rotation Y = 45° log?', startCode: CLICKS },
              { type: 'js', instruction: '### 2. Literals that read back\nNumbers to 6 decimals, tiny ones as 0, strings in quotes.', startCode: LITERALS },
              { type: 'js', instruction: '### 3. Replay\nA fresh starting scene, the log run as a program: the same scene.', startCode: REPLAY },
              { type: 'js', instruction: '### 4. Names, not numbers\nA log that numbers its objects breaks when the list changes.', startCode: NAMES },
              { type: 'js', instruction: '### 5. See both scenes\nYour box and the box rebuilt from the log.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 240 },
              { type: 'challenge', instruction: '### 6. Challenge: write the line\nThe line MeshLab logs for one Inspector change. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkLine },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Every click is code" in MeshLab](#/lab/mesh-lab?project=every-click). Change the box three ways and watch the **GUI → code** tab grow. Then **Script › Trace the GUI → code log (replay it)** with **Record traces** on: predict how many lines it runs; it compares the replayed scene with yours.' },
              { type: 'markdown', instruction: '### Use the tool\n- **GUI → code** tab: every change as a script line, newest last; undone steps disappear.\n- Copy lines into the **Script** tab, change numbers, run.\n- **Script › Trace the GUI → code log (replay it)** checks the log rebuilds your scene.\n- **In Blender:** the Info editor lists every operator as a Python line (bpy.ops…), and right-click › Copy Python Command copies one for scripts.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why replay rebuilds the scene.** Write the scene as a state $S$ and each change as a function: $S_{k+1} = f_k(S_k)$. The log line $\\ell_k$ is written so that running it on $S_k$ gives $f_k(S_k)$. Then running $\\ell_0, \\ell_1, \\ldots$ in order on $S_0$ gives $S_1, S_2, \\ldots$, the same states, by induction.',
      '**Why names and not numbers.** For $\\ell_k$ to act on the same object in every replay, its reference must not depend on anything a line could change. Positions in the list change when objects are added or deleted; a unique name does not.',
      '**Why 6 decimals is enough.** Trimming changes a number by at most $5 \\times 10^{-7}$. A rotation of that many radians at a distance of 10 m moves a point by $5 \\mu$m: invisible. And the replay itself then uses the trimmed number, so the error does not grow from line to line beyond each line\'s own.',
      '**Why literals round-trip.** Reading the text of a literal (lesson 2.8\'s parser, or JavaScript\'s) gives back the value written. JSON quoting escapes quotes and backslashes in names, so even "a \\"quoted\\" name" reads back unchanged.',
    ],
    equations: [
      { label: 'Replay', latex: 'S_{k+1} = f_k(S_k), \\quad \\text{run}(\\ell_k, S_k) = f_k(S_k) \\;\\Rightarrow\\; \\text{run}(\\ell_0 \\ldots \\ell_{n-1}, S_0) = S_n' },
      { label: 'Trimming error', latex: '|\\operatorname{round}_6(x) - x| \\le 5 \\times 10^{-7}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** If every state change is performed by exactly one logged operation, each log line is deterministic, and references are stable (unique names), then the log is a program whose execution on the initial state reproduces the final state; with value trimming, it does so to within the trimming tolerance.',
      '**Invariant viewpoint.** The log is independent of how a change was made: a click, a key, a gizmo drag or a script all log the same kind of line. And replay commutes with undo: undoing the last change and replaying gives the same state as replaying the shorter log.',
      '**Geometric picture.** A modelling session is a path from the starting scene to the final one; the log is that path written as directions, and replay walks it again.',
      '**Where this goes.** Lesson 12.1 writes scenes as scripts from the start. Procedural modelling (node graphs, Houdini) goes further: the program is the model, and the scene is just its output for some inputs.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-4-007-ex1',
      title: 'Logging one change',
      problem: 'You set Box\'s Position X to $2$ in the Inspector. What line is logged?',
      steps: [
        { expression: '\\text{object: scene.get("Box")}', annotation: 'Step 2: by name.' },
        { expression: '\\text{field and axis: position.x}', annotation: 'The Inspector changes one axis.' },
        { expression: '\\text{value: } 2', annotation: 'Step 3: a whole number is written as is.' },
      ],
      conclusion: 'The log gains scene.get("Box").position.x = 2.',
    },
    {
      id: 'modelling-geometry-4-007-ex2',
      title: 'A rotation in the log',
      problem: 'You set Rotation Z to $90°$. What value does the log write?',
      steps: [
        { expression: '90° = \\pi / 2 = 1.5707963\\ldots', annotation: 'Step 4: rotations are stored in radians.' },
        { expression: '\\operatorname{round}_6 = 1.570796', annotation: 'Step 3: six decimals.' },
      ],
      conclusion: 'The log gains scene.get("Box").rotation.z = 1.570796.',
    },
    {
      id: 'modelling-geometry-4-007-ex3',
      title: 'Undo and the log',
      problem: 'The log has three lines; you press Ctrl+Z. What does the log hold, and what does replaying it give?',
      steps: [
        { expression: '\\text{undo pops the last step and its line}', annotation: 'Step 5.' },
        { expression: '\\text{log: two lines}', annotation: 'The program for the scene you have now.' },
        { expression: '\\text{replay gives the scene after two changes}', annotation: 'Exactly the scene after the undo.' },
      ],
      conclusion: 'Two lines, and replaying them gives exactly the current, undone-to scene.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-4-007-ch1',
      difficulty: 'easy',
      problem: 'Why is "scene.get(\\"Box\\")" written with JSON quotes, not just Box?',
      walkthrough: [{ expression: '\\text{a name can hold spaces, quotes, dots}', annotation: 'JSON quoting escapes them so the name reads back exactly.' }],
      answer: 'Because names can contain spaces or quotes; JSON quoting writes any name as a string literal that reads back exactly.',
    },
    {
      id: 'modelling-geometry-4-007-ch2',
      difficulty: 'medium',
      problem: 'A replay of a long log leaves one object slightly off from where it was. Name two causes to check.',
      walkthrough: [
        { expression: '\\text{a change that bypassed the logging path}', annotation: 'It happened in the session but is not in the log.' },
        { expression: '\\text{a value logged as displayed (degrees, rounded too hard)}', annotation: 'Not the stored value.' },
      ],
      answer: 'Either some change did not go through the one logged path (so the log misses it), or a value was logged as displayed rather than stored (degrees, or rounded to fewer decimals).',
    },
    {
      id: 'modelling-geometry-4-007-ch3',
      difficulty: 'hard',
      problem: 'You want to build ten variants of a model that differ only in one dimension you typed early on. How do you use the log, and what must be true of the later lines for it to work?',
      walkthrough: [
        { expression: '\\text{copy the log into a script; make that value a variable}', annotation: 'Then loop over ten values.' },
        { expression: '\\text{later lines must not hard-code results of that value}', annotation: 'A later "move vertex 12 to (0.75, …)" was computed for the old size.' },
        { expression: '\\text{relative operations replay well; absolute positions do not}', annotation: 'Extrude by a distance adapts; a fixed coordinate does not.' },
      ],
      answer: 'Turn the log into a script with that value as a variable and run it ten times; it works only if later lines are relative (extrude by, scale by, inset by) rather than absolute positions that were computed from the old value.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\ell_k', meaning: 'The log line for change k: the script that makes it.' },
      { symbol: 'S_0', meaning: 'The starting scene the log is replayed on.' },
      { symbol: '\\text{lit}(x)', meaning: 'A value written as source text that reads back as the same value.' },
      { symbol: '\\text{scene.get("Name")}', meaning: 'A reference by unique name, stable when the object list changes.' },
      { symbol: '\\operatorname{round}_6', meaning: 'Numbers trimmed to 6 decimals: at most 5 × 10⁻⁷ off.' },
      { symbol: '\\text{replay}', meaning: 'Running the log in order on the starting scene; it rebuilds the current scene.' },
    ],
    rulesOfThumb: [
      'One path for every change, and it writes the code.',
      'Name objects; never number them in a log.',
      'Log stored values (radians), not displayed ones (degrees).',
      'Replay on the right starting scene.',
      'Relative operations make logs reusable; absolute ones tie them to one scene.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-4-006', label: 'Undo and redo', note: 'The one path every change goes through; undo removes lines from the log too.' },
      { lessonId: 'modelling-geometry-2-008', label: 'Numbers you can type', note: 'Literals in the log are read back by a parser like the one built there.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-5-001', label: 'Extrude', note: 'Modelling operations, each logged as one line you can replay.' },
      { lessonId: 'modelling-geometry-12-001', label: 'Scripting a scene', note: 'Writing scenes as programs from the start.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-4-007-1', label: 'Read how each change is logged as a script line', type: 'read' },
    { id: 'cp-modelling-geometry-4-007-2', label: 'Read why values are written as round-tripping literals', type: 'read' },
    { id: 'cp-modelling-geometry-4-007-3', label: 'Read why objects are referenced by name', type: 'read' },
    { id: 'cp-modelling-geometry-4-007-4', label: 'Run cells 1 to 4: clicks, literals, replay, names', type: 'lab' },
    { id: 'cp-modelling-geometry-4-007-5', label: 'Change a box in MeshLab, watch the log, and trace the replay', type: 'lab' },
    { id: 'cp-modelling-geometry-4-007-6', label: 'Work through example 2, a rotation in the log', type: 'example' },
    { id: 'cp-modelling-geometry-4-007-7', label: 'Work through example 3, undo and the log', type: 'example' },
    { id: 'cp-modelling-geometry-4-007-8', label: 'Complete the challenge: write the line', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-4-007-assess-1',
        type: 'choice',
        text: 'You set Rotation X to 180° in the Inspector. Which line is logged?',
        options: ['scene.get("Box").rotation.x = 3.141593', 'scene.get("Box").rotation.x = 180', 'scene.objects[0].rotation.x = 3.141593', 'scene.get("Box").rotation = [180, 0, 0]'],
        answer: 'scene.get("Box").rotation.x = 3.141593',
        hint: 'By name, one axis, radians to 6 decimals.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-4-007-quiz-1',
      type: 'choice',
      text: 'Where in MeshLab is the code for each change written?',
      options: ['In the one path every change goes through', 'In each button separately', 'In the viewport', 'After the session ends'],
      answer: 'In the one path every change goes through',
      hints: ['The same path that snapshots for undo.', 'Lesson 4.6.'],
      reviewSection: 'Intuition: the first paragraph',
    },
    {
      id: 'modelling-geometry-4-007-quiz-2',
      type: 'choice',
      text: 'What does lit(0.0000001) write?',
      options: ['0', '0.0000001', '1e-7', 'nothing'],
      answer: '0',
      hints: ['Tiny numbers are written as 0.', 'Below 5 × 10⁻⁷.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-4-007-quiz-3',
      type: 'choice',
      text: 'Why does the log say scene.get("Box") rather than scene.objects[2]?',
      options: ['The name stays the same when objects are added or removed', 'It is shorter', 'Numbers are not allowed in scripts', 'For speed'],
      answer: 'The name stays the same when objects are added or removed',
      hints: ['Cell 4.', 'Positions in the list shift.'],
      reviewSection: 'Intuition: the names paragraph',
    },
    {
      id: 'modelling-geometry-4-007-quiz-4',
      type: 'choice',
      text: 'Which of these does NOT add a line to the log?',
      options: ['Pressing Ctrl+Z', 'Shade smooth', 'Typing a new Position X', 'Adding a cube'],
      answer: 'Pressing Ctrl+Z',
      hints: ['Undo removes a line.', 'Example 3.'],
      reviewSection: 'Example 3',
    },
    {
      id: 'modelling-geometry-4-007-quiz-5',
      type: 'choice',
      text: 'The log is replayed on an empty scene with no Box. What happens?',
      options: ['Lines that refer to Box fail', 'It rebuilds the Box anyway', 'Nothing: logs ignore the scene', 'It creates a new Box'],
      answer: 'Lines that refer to Box fail',
      hints: ['The log holds changes, not the scene.', 'Warning "A replay is only as good as its starting scene".'],
      reviewSection: 'Warning "A replay is only as good as its starting scene"',
    },
    {
      id: 'modelling-geometry-4-007-quiz-6',
      type: 'choice',
      text: 'You type 45 into Rotation Y. What number appears in the log?',
      options: ['0.785398', '45', '0.79', '0.7853981633974483'],
      answer: '0.785398',
      hints: ['Radians.', 'Six decimals.'],
      reviewSection: 'Cell 1',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'The log is an approximate record of what you did.',
      whyStudentsThinkIt: 'Macro recorders are often unreliable.',
      correctionExample: 'Replaying MeshLab\'s log on the starting scene gives the same scene hash; cell 3 checks the same for its small editor.',
      contrastCase: 'A recorder that logs mouse positions instead of operations is approximate: a moved window changes what a replayed click hits.',
    },
    {
      falseBelief: 'The log uses the numbers you typed.',
      whyStudentsThinkIt: 'You typed them.',
      correctionExample: 'Typing 45 into Rotation Y logs 0.785398: the stored radians.',
      contrastCase: 'Position and scale are stored as typed (to 6 decimals), so they look the same.',
    },
    {
      falseBelief: 'Referring to objects by their number is just as good as by name.',
      whyStudentsThinkIt: 'In one session the numbers are fixed.',
      correctionExample: 'In cell 4 the numbered log deletes the Light and shades the Box instead of the Cone on another scene.',
      contrastCase: 'With names, the same lines change the same objects wherever they are in the list.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A bug in the tool appears after a long, specific sequence of edits that is hard to describe.',
      competingTechniques: ['Write down the steps from memory', 'Send the log with the starting scene'],
      whyThisTechniqueWins: 'The log reproduces the exact sequence, values included; memory misses steps and rounds numbers.',
    },
    {
      situation: 'An artist builds one shelf by hand and needs ten of different widths.',
      competingTechniques: ['Build each by hand', 'Turn the log into a script with the width as a variable'],
      whyThisTechniqueWins: 'The script rebuilds every step for each width in seconds, provided the steps are relative to the width (challenge 3).',
    },
  ],

  debugging: [
    {
      commonError: 'Logging the displayed degrees.',
      symptom: 'Replayed objects spin wildly: a 45° turn becomes 45 radians.',
      whyItHappened: 'The scene stores radians.',
      repairStrategy: 'Log the stored value; convert in the Inspector only.',
    },
    {
      commonError: 'A change that skips the logging path.',
      symptom: 'Replays differ from the session in exactly one place.',
      whyItHappened: 'That code changed the scene directly.',
      repairStrategy: 'Route it through the one path; test with a replay-and-compare.',
    },
    {
      commonError: 'Numbering objects in the log.',
      symptom: 'Replays change the wrong objects once anything was added or removed.',
      whyItHappened: 'Positions in the list shift.',
      repairStrategy: 'Reference by unique name.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Write the log line for any change, format literals correctly, and replay a log by hand.',
    explainVerbally: 'Explain why replay rebuilds the scene, why names beat numbers, and why stored values are logged.',
    detectIncorrectApplication: 'Recognise degree logs, numbered references, unlogged changes and wrong starting scenes from replay mismatches.',
    transferToUnfamiliar: 'Use a log to report a bug exactly, or turn it into a parameterised script.',
  },
};
