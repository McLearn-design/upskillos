// Lesson 4.6: undo and redo. Two stacks; a change pushes onto one and clears the other. Two ways to store a step:
// snapshots of the whole state (memento, what MeshLab does) or commands that know how to undo themselves.

const STACKS = `// The "scene": a list of points. Every change goes through one function that snapshots before and after.
let doc = [[0, 0], [1, 0], [1, 1]]
const undoStack = [], redoStack = []
function change(label, fn) {
  const before = JSON.stringify(doc)
  fn()
  const after = JSON.stringify(doc)
  if (before === after) return                       // nothing changed: nothing to undo
  undoStack.push({ label, before, after })
  redoStack.length = 0                               // a new change ends the undone future
}
function undo() { const s = undoStack.pop(); if (!s) return; redoStack.push(s); doc = JSON.parse(s.before) }
function redo() { const s = redoStack.pop(); if (!s) return; undoStack.push(s); doc = JSON.parse(s.after) }
const show = (what) => console.log(what + ': ' + JSON.stringify(doc) + '   undo [' + undoStack.map((s) => s.label) + ']  redo [' + redoStack.map((s) => s.label) + ']')
`;

const SNAPSHOTS = `${STACKS}
change('move', () => { doc[2] = [1, 2] }); show('move')
change('add', () => { doc.push([0, 2]) }); show('add')
undo(); show('undo')
undo(); show('undo')
redo(); show('redo')`;

const COMMANDS = `// The command pattern: each step stores what it did and how to reverse it, not the whole state.
let doc = Array.from({ length: 1000 }, (_, i) => [i, 0])     // a bigger scene: 1000 points
const moveCommand = (i, dx, dy) => ({ label: 'move ' + i, do: () => { doc[i][0] += dx; doc[i][1] += dy }, undo: () => { doc[i][0] -= dx; doc[i][1] -= dy }, size: JSON.stringify([i, dx, dy]).length })
const cmd = moveCommand(7, 0, 2)
const before = JSON.stringify(doc)
cmd.do()
const snapshotBytes = before.length + JSON.stringify(doc).length
console.log('point 7 after the move: ' + JSON.stringify(doc[7]))
cmd.undo()
console.log('after undo: ' + JSON.stringify(doc[7]) + ', the scene is as it was: ' + (JSON.stringify(doc) === before))
console.log('stored for this one step: snapshots ' + snapshotBytes + ' characters, command ' + cmd.size)`;

const REDO = `${STACKS}
change('A', () => { doc.push([5, 5]) })
change('B', () => { doc.push([6, 6]) })
change('C', () => { doc.push([7, 7]) })
undo(); undo(); show('undo twice')
change('D', () => { doc[0] = [9, 9] }); show('then D')
redo(); show('redo')`;

const DRAG = `// A gizmo drag is many small moves but one undo step: snapshot at the start, push at the end.
let doc = { x: 0 }
const undoStack = []
let liveBefore = null
const beginLive = () => { liveBefore = JSON.stringify(doc) }
const endLive = (label) => { undoStack.push({ label, before: liveBefore, after: JSON.stringify(doc) }); liveBefore = null }
beginLive()
for (let i = 0; i < 30; i++) doc.x += 0.05                       // 30 mouse moves
endLive('Move')
console.log('after the drag: x = ' + doc.x.toFixed(2) + ', undo steps: ' + undoStack.length)
doc = JSON.parse(undoStack.pop().before)
console.log('one Ctrl+Z: x = ' + doc.x)`;

const PICTURE = `// The two stacks after: A, B, C, undo, undo, D.
const undoStack = ['A', 'D'], redoStack = []
const before = { undo: ['A'], redo: ['C', 'B'] }                   // just before D
const canvas = document.createElement('canvas')
canvas.width = 560; canvas.height = 240
canvas.style.cssText = 'display: block; margin: 8px auto; max-width: 100%'
document.body.appendChild(canvas)
const g = canvas.getContext('2d')
g.fillStyle = '#1e293b'; g.fillRect(0, 0, 560, 240)
g.font = '14px sans-serif'; g.textAlign = 'center'
function column(x, title, items, colour) {
  g.fillStyle = '#e2e8f0'; g.fillText(title, x, 225)
  items.forEach((label, i) => {
    g.fillStyle = colour; g.fillRect(x - 40, 190 - (i + 1) * 34, 80, 28)
    g.fillStyle = '#0f172a'; g.fillText(label, x, 190 - (i + 1) * 34 + 19)
  })
}
column(80, 'undo (before D)', before.undo, '#4f8fd9')
column(200, 'redo (before D)', before.redo, '#f59e0b')
column(360, 'undo (after D)', undoStack, '#4f8fd9')
column(480, 'redo (after D)', redoStack, '#f59e0b')
g.fillStyle = '#94a3b8'; g.fillText('→ D →', 280, 120)
console.log('before D: undo [A], redo [C, B] (B on top); after D: undo [A, D], redo empty')`;

const CHALLENGE = `// Start empty. Do A, do B, undo, do C, undo, undo, redo.
// What is on each stack at the end? List them oldest first (the top of the stack last).
const undoStack = []
const redoStack = []

console.log('undo [' + undoStack + ']  redo [' + redoStack + ']')`;

const SOLVED = CHALLENGE.replace("const undoStack = []\nconst redoStack = []", "const undoStack = ['A']\nconst redoStack = ['C']");

/** The challenge's check: replay the sequence and compare both stacks. */
export function checkStacks(code) {
  const no = (message) => ({ pass: false, message });
  const read = (name) => { const m = code.match(new RegExp(`^\\s*const\\s+${name}\\s*=\\s*\\[([^\\]\\n]*)\\]`, 'm')); return m ? [...m[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => x[1] ?? x[2]) : null; };
  const u = read('undoStack'), r = read('redoStack');
  if (!u || !r) return no('Keep the two lines const undoStack = [ … ] and const redoStack = [ … ], with quoted labels.');
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (same(u, ['A']) && same(r, ['C'])) return { pass: true, message: 'A, B: undo [A, B]. Undo: redo [B]. Do C: undo [A, C], and redo is emptied, so B is gone for good. Undo, undo: undo [], redo [C, A]. Redo pops A: undo [A], redo [C].' };
  if (!u.length && !r.length) return no('Replay it step by step: a change pushes onto undo and empties redo; undo moves the top step to redo; redo moves it back.');
  if (r.includes('B') || u.includes('B')) return no('B is gone: doing C after undoing B emptied the redo stack. A new change ends the undone future.');
  if (same(u, ['C']) && same(r, ['A'])) return no('The order is the other way: after the two undos, redo holds C then A, with A on top (it was undone last), so redo brings back A.');
  if (same(u, ['A', 'C']) || same(u, ['A', 'C'].reverse())) return no('The last redo only restores one step: after undo, undo, there is one redo, so only A comes back.');
  return no(`undo [${u}], redo [${r}] is not what the sequence leaves. Replay it one action at a time.`);
}

export default {
  id: 'modelling-geometry-4-006',
  slug: 'undo-and-redo',
  chapter: 'modelling-geometry',
  order: 6,
  title: 'Undo and redo',
  subtitle: 'Two stacks, one rule: a new change ends the undone future. Snapshots or commands, and a drag as one step.',
  tags: ['undo', 'redo', 'memento', 'command pattern', 'state'],
  coreConcept: 'Undo and redo are two stacks: a change pushes a step on the undo stack and empties the redo stack; undo pops a step, restores the state before it and pushes it on the redo stack; redo does the reverse. A step is either a pair of snapshots (simple, always correct, costs memory) or a command with its own undo (small, but every command must be reversible); a continuous drag is grouped into one step.',
  prerequisites: ['modelling-geometry-4-004'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-4-007',

  hook: {
    question: 'You make three changes, undo twice, then make a new one. Can you still redo the two you undid? Every program answers this the same way. Why, and how is undo stored at all?',
    realWorldContext: 'Undo is the feature people use most and notice least, until it breaks: a step that will not undo, a drag that takes thirty presses of Ctrl+Z to reverse, a crash from running out of memory. Modelling tools, text editors and design apps all build it from the same two stacks.',
  },

  intuition: {
    prose: [
      'Keep two stacks: **undo** and **redo**. Make a change: push it on the undo stack. Press Ctrl+Z: pop the top step, put the scene back as it was before it, and push the step on the redo stack. Press Ctrl+Shift+Z: pop from redo, put the scene as it was after, push it back on undo.',
      'Before running cell 3, predict: you do A, B and C, undo twice, then do D. What is on the redo stack?',
      'Nothing. A new change **empties the redo stack**. B and C were changes to a scene that D has now replaced; there is no sensible way to put them back on top of D. The history is a line, not a tree.',
      'What is stored for each step? MeshLab stores **snapshots**: the whole scene before and after, as text. This is the **memento** pattern. It is simple, and every kind of change can be undone the same way, because every change goes through one function that takes the snapshots (lesson 4.7 builds on that same path).',
      'The cost is memory. Moving one point in a scene of 1000 points stores two copies of all 1000. The **command pattern** stores only the change: "move point 7 by (0, 2)", with an undo that moves it back. Cell 2 compares: $15{,}782$ characters of snapshots against $7$ for the command. The price is that every command must know exactly how to reverse itself, and a single wrong undo corrupts the scene.',
      'A drag with the gizmo is many tiny moves. Making each one a step would take thirty presses to undo one drag. Instead the scene is snapshotted when the drag **starts** and the step pushed when it **ends**: one step. A step that changes nothing (setting a value it already has) is not pushed at all.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Undo and redo with snapshots',
        body: 'Step 1. Every change goes through one function: snapshot the state (before), apply the change, snapshot again (after).\nStep 2. If before equals after, stop: nothing to record.\nStep 3. Push (label, before, after) on the undo stack; empty the redo stack.\nStep 4. Undo: pop from undo, restore before, push on redo.\nStep 5. Redo: pop from redo, restore after, push on undo.\nStep 6. For a drag: snapshot at the start, push one step at the end.\nStep 7. Cap the undo stack (MeshLab: 200 steps), dropping the oldest.',
      },
      {
        type: 'warning',
        title: 'Changes that skip the one path cannot be undone',
        body: 'If some code changes the scene without going through the snapshotting function, its change is not in the history, and the next undo restores a "before" that silently throws it away. Route every change through one place.',
      },
      {
        type: 'warning',
        title: 'Undo is not a time machine for everything',
        body: 'Selection, the camera view and which panel is open are usually not undone: they are not part of the scene. Restoring them would make undo feel strange, so tools leave them alone.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: none, but restore must redraw',
        body: 'Restoring a snapshot replaces the whole scene, so the viewport must rebuild every object\'s geometry. MeshLab compares a cheap signature of each mesh to rebuild only what changed.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "undone steps wait on the redo stack until you need them". Before D, B and C wait there; after D the redo stack is empty. Invariant: the undo stack is always the line of history that leads to the current scene.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'change() in cell 1 is Steps 1 to 3; undo() and redo() are Steps 4 and 5; beginLive and endLive in cell 4 are Step 6.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The GPU knows nothing of history: after an undo, the viewport simply draws the restored scene on the next frame.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'MeshLab\'s Editor.run is Step 1 to 3 for every command, script and gizmo drag; Ctrl+Z and Ctrl+Shift+Z are Steps 4 and 5. Edit › Trace the undo stack shows the stacks and their size.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: undo and redo',
        caption: 'Snapshots, commands, the cleared redo stack, a drag as one step, and the stacks drawn.',
        props: {
          lesson: {
            title: 'Undo and redo',
            subtitle: 'Two stacks and one rule, with snapshots or with commands.',
            cells: [
              { type: 'js', instruction: '### 1. Snapshots\nEvery change through one function; undo restores "before", redo "after".', startCode: SNAPSHOTS },
              { type: 'js', instruction: '### 2. Commands\nStore the change and its reverse instead of the whole scene.', startCode: COMMANDS },
              { type: 'js', instruction: '### 3. A new change ends the future\nPredict first: after A, B, C, undo, undo, D, what can be redone?', startCode: REDO },
              { type: 'js', instruction: '### 4. A drag is one step\nThirty mouse moves, one snapshot pair.', startCode: DRAG },
              { type: 'js', instruction: '### 5. See the stacks\nBefore and after D.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 260 },
              { type: 'challenge', instruction: '### 6. Challenge: replay a sequence\nGive both stacks at the end. The check names the slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkStacks },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Undo and redo" in MeshLab](#/lab/mesh-lab?project=undo-redo). Make three changes, then **Edit › Trace the undo stack** with **Record traces** on. In **Predict** mode, predict what is left after two undos and what survives a new change.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Ctrl+Z** undo, **Ctrl+Shift+Z** redo (also in the Edit menu).\n- One step per command, script run or gizmo drag; up to 200 steps.\n- **Edit › Trace the undo stack** shows the steps and their memory.\n- **In Blender:** Ctrl+Z, Ctrl+Shift+Z; Edit › Undo History lists the steps and jumps to any of them.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why two stacks are enough.** The history is a sequence of states $S_0, S_1, \\ldots, S_n$ with the current one at position $k$. The undo stack holds the steps $S_0 \\to S_1$ up to $S_{k-1} \\to S_k$, and the redo stack the steps after $k$, top first. Undo moves $k$ back by one, redo forward by one: each moves one step between the stacks.',
      '**Why a new change empties redo.** A new change makes a new state $S\'$ after $S_k$. The old $S_{k+1}, \\ldots$ were reached from $S_k$ by steps that do not start from $S\'$, so they no longer form a line through the current state.',
      '**Why snapshots are always correct.** Restoring "before" puts the exact text of the old state back, whatever the change did. A command\'s undo is correct only if it is the exact inverse of its do; for "move by $d$" that is "move by $-d$", but for "delete a face" it must also put the face back in the same place in the list.',
      '**Why memory differs.** Snapshots cost the size of the whole scene per step: $O(\\text{scene})$. Commands cost the size of the change: $O(\\text{change})$. For small edits in big scenes the difference is a factor of thousands.',
    ],
    equations: [
      { label: 'Undo', latex: '\\text{undo}: \\; (U, R) = (U\' \\cdot s, R) \\mapsto (U\', R \\cdot s), \\quad \\text{state} := s.\\text{before}' },
      { label: 'A new change', latex: '(U, R) \\mapsto (U \\cdot s, \\varnothing)' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** Linear undo maintains the invariant that the current state equals the "after" of the top of the undo stack (or the initial state if it is empty), and the "before" of the top of the redo stack. Every operation preserves it: a new change pushes a step whose before is the current state and clears redo; undo and redo move one step across.',
      '**Invariant viewpoint.** Undo then redo returns the exact same state, and redo then undo too: they are inverses on the history. A change followed by an undo returns to the old state, but not to the old redo stack, which the change emptied.',
      '**Geometric picture.** History is a path through states. Linear undo moves back and forth along it; a new change cuts off the rest of the path and starts a new branch. Branching undo (an undo tree) keeps the cut-off branches; some editors offer it.',
      '**Where this goes.** Lesson 4.7 records each step\'s script line in the GUI → code log, so the history can be replayed as a program. Version control (git) is the same idea for files: snapshots of the whole project, with branches.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-4-006-ex1',
      title: 'A change and an undo',
      problem: 'The scene is $S_0$. Make change $A$ (giving $S_1$), then undo. What are the stacks and the state?',
      steps: [
        { expression: 'U = [A], \\; R = [\\,], \\; S_1', annotation: 'Step 3: push A, empty redo.' },
        { expression: 'U = [\\,], \\; R = [A], \\; S_0', annotation: 'Step 4: pop A, restore its before, push it on redo.' },
      ],
      conclusion: 'After the undo the scene is $S_0$ again and $A$ waits on the redo stack.',
    },
    {
      id: 'modelling-geometry-4-006-ex2',
      title: 'Undo twice, then a new change',
      problem: 'Do A, B, C; undo twice; do D. What are the stacks?',
      steps: [
        { expression: 'U = [A, B, C], \\; R = [\\,]', annotation: 'Three changes.' },
        { expression: 'U = [A], \\; R = [C, B]', annotation: 'Two undos: C then B move across; B is on top of redo.' },
        { expression: 'U = [A, D], \\; R = [\\,]', annotation: 'Step 3: D pushes and empties redo.' },
      ],
      conclusion: 'B and C are gone: the redo stack is empty, and redo does nothing.',
    },
    {
      id: 'modelling-geometry-4-006-ex3',
      title: 'What a drag stores',
      problem: 'A gizmo drag makes 30 small moves of 0.05 each. How many undo steps, and what do they store?',
      steps: [
        { expression: '\\text{beginLive: before} = \\{ x: 0 \\}', annotation: 'Step 6: one snapshot when the drag starts.' },
        { expression: '\\text{30 moves: no steps pushed}', annotation: 'The scene changes live, without history.' },
        { expression: '\\text{endLive: push (Move, before, after = \\{ x: 1.5 \\})}', annotation: 'One step when the drag ends.' },
      ],
      conclusion: 'One step, from $x = 0$ to $x = 1.5$: a single Ctrl+Z undoes the whole drag.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-4-006-ch1',
      difficulty: 'easy',
      problem: 'You press Ctrl+Z with an empty undo stack. What happens?',
      walkthrough: [{ expression: '\\text{pop from } [\\,] \\Rightarrow \\text{nothing}', annotation: 'There is no step to undo.' }],
      answer: 'Nothing: there is no step to pop, so the scene and both stacks stay as they are.',
    },
    {
      id: 'modelling-geometry-4-006-ch2',
      difficulty: 'medium',
      problem: 'Setting an object\'s colour to the colour it already has is not added to the undo stack. Why is that the right choice?',
      walkthrough: [
        { expression: '\\text{before} = \\text{after}', annotation: 'Step 2: the snapshots are identical.' },
        { expression: '\\text{pushing it would cost a Ctrl+Z that changes nothing}', annotation: 'And it would empty the redo stack for no reason.' },
      ],
      answer: 'Its before and after snapshots are equal, so recording it would only add an undo step that does nothing and would wrongly empty the redo stack.',
    },
    {
      id: 'modelling-geometry-4-006-ch3',
      difficulty: 'hard',
      problem: 'A scene is 5 MB of text and the tool keeps 200 snapshot steps. Estimate the memory, and propose a design that keeps snapshots\' simplicity at a fraction of the cost.',
      walkthrough: [
        { expression: '200 \\times 2 \\times 5 \\text{ MB} = 2 \\text{ GB}', annotation: 'Two whole snapshots per step.' },
        { expression: '\\text{share: step } k\\text{\'s after is step } k+1\\text{\'s before}', annotation: 'Store each state once: about 1 GB.' },
        { expression: '\\text{store per object, and only objects that changed}', annotation: 'Unchanged objects are shared between snapshots: memory grows with the change, not the scene.' },
      ],
      answer: 'About 2 GB (200 × 2 × 5 MB); store each state once (after = next before) and, better, snapshot per object and share unchanged objects between states, so each step costs about the size of what changed while undo stays "restore the snapshot".',
    },
  ],

  semantics: {
    core: [
      { symbol: 'U, \\; R', meaning: 'The undo and redo stacks.' },
      { symbol: '(\\text{label}, \\text{before}, \\text{after})', meaning: 'A snapshot step: the state before and after one change.' },
      { symbol: '\\text{memento}', meaning: 'Storing whole states to restore later: MeshLab\'s undo.' },
      { symbol: '\\text{command}', meaning: 'Storing a change with its own reverse: small, but every reverse must be exact.' },
      { symbol: 'R := \\varnothing', meaning: 'What a new change does to the redo stack.' },
      { symbol: '\\text{live drag}', meaning: 'Many moves recorded as one step: snapshot at the start, push at the end.' },
    ],
    rulesOfThumb: [
      'Every change through one path, or undo will lose some.',
      'A new change empties redo.',
      'Group continuous edits (drags, typing) into one step.',
      'Skip steps that change nothing.',
      'Snapshots for simplicity, commands for memory; share unchanged data to get both.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-4-004', label: 'Dragging with a gizmo', note: 'A drag is many moves, grouped here into one step.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-4-007', label: 'Every click is code', note: 'Each step also records a script line: the history as a program.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-4-006-1', label: 'Read how the two stacks move steps back and forth', type: 'read' },
    { id: 'cp-modelling-geometry-4-006-2', label: 'Read why a new change empties redo', type: 'read' },
    { id: 'cp-modelling-geometry-4-006-3', label: 'Read snapshots versus commands', type: 'read' },
    { id: 'cp-modelling-geometry-4-006-4', label: 'Run cells 1 to 4: snapshots, commands, the cleared future, a drag', type: 'lab' },
    { id: 'cp-modelling-geometry-4-006-5', label: 'Make changes in MeshLab and trace the undo stack in Predict mode', type: 'lab' },
    { id: 'cp-modelling-geometry-4-006-6', label: 'Work through example 2, undo twice then a new change', type: 'example' },
    { id: 'cp-modelling-geometry-4-006-7', label: 'Work through example 3, what a drag stores', type: 'example' },
    { id: 'cp-modelling-geometry-4-006-8', label: 'Complete the challenge: replay a sequence', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-4-006-assess-1',
        type: 'choice',
        text: 'Do A, B; undo; do C. What can be redone?',
        options: ['Nothing', 'B', 'B and C', 'A'],
        answer: 'Nothing',
        hint: 'C is a new change, which empties the redo stack (B is gone).',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-4-006-quiz-1',
      type: 'choice',
      text: 'What does undo restore?',
      options: ['The top step\'s "before" snapshot', 'The top step\'s "after" snapshot', 'The first snapshot ever', 'The redo stack'],
      answer: 'The top step\'s "before" snapshot',
      hints: ['Undo goes back to how it was before the last change.', 'Redo restores "after".'],
      reviewSection: 'Procedure step 4',
    },
    {
      id: 'modelling-geometry-4-006-quiz-2',
      type: 'choice',
      text: 'A gizmo drag of 40 mouse moves is undone with how many Ctrl+Z presses?',
      options: ['1', '40', '2', '20'],
      answer: '1',
      hints: ['Snapshot at the start, push at the end.', 'Cell 4.'],
      reviewSection: 'Intuition: the drag paragraph',
    },
    {
      id: 'modelling-geometry-4-006-quiz-3',
      type: 'choice',
      text: 'Which stores less for a small edit in a big scene?',
      options: ['A command', 'A snapshot pair', 'They are the same', 'Neither stores anything'],
      answer: 'A command',
      hints: ['A command stores the change.', 'Snapshots store the whole scene twice.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-4-006-quiz-4',
      type: 'choice',
      text: 'Which of these does NOT clear the redo stack?',
      options: ['Undo', 'Moving an object', 'Running a script that changes the scene', 'Adding a cube'],
      answer: 'Undo',
      hints: ['Undo adds to the redo stack.', 'Only new changes clear it.'],
      reviewSection: 'Procedure step 3',
    },
    {
      id: 'modelling-geometry-4-006-quiz-5',
      type: 'choice',
      text: 'Why must every change go through one function?',
      options: ['So every change is snapshotted and can be undone', 'For speed', 'So the GPU sees it', 'So it can be drawn'],
      answer: 'So every change is snapshotted and can be undone',
      hints: ['A change made elsewhere is not in the history.', 'Warning "Changes that skip the one path cannot be undone".'],
      reviewSection: 'Warning "Changes that skip the one path cannot be undone"',
    },
    {
      id: 'modelling-geometry-4-006-quiz-6',
      type: 'choice',
      text: 'After A, B, C and two undos, what is on top of the redo stack?',
      options: ['B', 'C', 'A', 'Nothing'],
      answer: 'B',
      hints: ['C was undone first, then B.', 'The last one pushed is on top.'],
      reviewSection: 'Example 2',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Undone steps stay available to redo until you need them.',
      whyStudentsThinkIt: 'Redo feels like a second history.',
      correctionExample: 'After A, B, C, undo, undo, D, the redo stack is empty: B and C are gone.',
      contrastCase: 'An undo tree (some editors) does keep branches you can return to.',
    },
    {
      falseBelief: 'Undo reverses each mouse movement.',
      whyStudentsThinkIt: 'A drag is made of movements.',
      correctionExample: 'A 30-move drag is one step: one Ctrl+Z takes x from 1.5 back to 0.',
      contrastCase: 'Thirty separate clicks on the Inspector arrows are thirty steps.',
    },
    {
      falseBelief: 'Undo stores only what changed.',
      whyStudentsThinkIt: 'That would be the efficient way.',
      correctionExample: 'MeshLab stores the whole scene before and after each step: 15,782 characters for moving one point of 1000 in cell 2.',
      contrastCase: 'The command pattern stores 7 characters for the same move.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A text editor must undo typing without one step per keystroke.',
      competingTechniques: ['One step per keystroke', 'Group keystrokes into one step until a pause, a cursor jump or a different kind of edit'],
      whyThisTechniqueWins: 'Grouping (like the drag) makes Ctrl+Z undo a word or a sentence, which is what people mean; one per keystroke makes undo tediously slow.',
    },
    {
      situation: 'A huge CAD model makes every snapshot take a second.',
      competingTechniques: ['Snapshot the whole model per step', 'Commands, or snapshots per part that share unchanged parts'],
      whyThisTechniqueWins: 'Storing only what changed makes each step cost the size of the edit, not the model.',
    },
  ],

  debugging: [
    {
      commonError: 'Not clearing the redo stack on a new change.',
      symptom: 'Redo after a new edit restores an old state on top of it, losing the new edit or mixing two histories.',
      whyItHappened: 'The redo steps were made for a state that no longer exists.',
      repairStrategy: 'Empty redo in the one function every change goes through.',
    },
    {
      commonError: 'Pushing a step for every mouse move of a drag.',
      symptom: 'Undoing one drag takes dozens of presses.',
      whyItHappened: 'Each move was treated as a change.',
      repairStrategy: 'Snapshot at the drag start and push one step at its end.',
    },
    {
      commonError: 'A command whose undo is not the exact reverse.',
      symptom: 'After undo the scene looks right but differs subtly (a face in a different place in the list), and later undos go wrong.',
      whyItHappened: 'The reverse was approximate.',
      repairStrategy: 'Test do-then-undo restores exactly the same serialised state, or use snapshots.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Trace both stacks through any sequence of changes, undos and redos, with snapshots or commands.',
    explainVerbally: 'Explain why a new change empties redo, and the trade-off between snapshots and commands.',
    detectIncorrectApplication: 'Recognise uncleared redo, per-move drag steps, inexact command undos and changes that bypass history.',
    transferToUnfamiliar: 'Design undo grouping for a text editor or memory-light undo for a huge model.',
  },
};
