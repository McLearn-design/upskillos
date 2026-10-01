// The Home page's Spotlight: the apps that give a learner the most for their time,
// with a fuller description than a topic card's one line. Only the curated text lives
// here; the label, emoji, color and route come from the lab/course registries at render
// time (TopicTable.jsx resolveEntry), so a renamed or moved app can't go stale here.
//
// Keep claims checkable: each one should match what the app actually does today. A
// spotlight entry that oversells is worse than no entry.

export const SPOTLIGHT = [
  {
    kind: 'lab',
    key: 'lesson-engine',
    headline: 'The heart of UpSkillOS: 48 lesson series you learn by writing real code',
    description:
      'Every lesson explains a concept, shows runnable examples, then hands you a challenge that is graded by real tests against the code you wrote. 48 series and over 400 levels cover Python, JavaScript, TypeScript, C++, C#, WPF, Java, Kotlin, Rust, Go, SQL, HTML and CSS, React, Vue, Git, testing, design patterns and software architecture.',
    highlights: [
      'Challenges are checked by real tests, not by matching text',
      'In the desktop app, C++, C#, WPF and Python run on your own compilers and SDKs',
      'Step-by-step debugger for Python and JavaScript, and an AI tutor that gives hints without giving the answer',
    ],
    bestFor: 'Learning a language or a discipline properly, from first principles to professional practice.',
  },
  {
    kind: 'lab',
    key: 'codelens',
    headline: 'Watch your code run, one step at a time',
    description:
      'Paste a program and step through its execution: the call stack, every variable in scope, the objects on the heap and the references between them, with a plain-English explanation of each step. Built for the moments when you can read code but can\'t yet picture what it does.',
    highlights: [
      'Step forwards and backwards through every line that ran',
      'Heap graph that shows which variables point at which objects',
      'Runs safely: infinite loops and runaway recursion are stopped with an explanation',
    ],
    bestFor: 'Understanding recursion, references, closures and data structures by seeing them.',
  },
  {
    kind: 'lab',
    key: 'openmat',
    headline: 'A full math computation engine',
    description:
      'Symbolic algebra, 3D graphing and matrix tools in one place: the workbench to reach for while working through any of the mathematics courses.',
    highlights: [
      'Symbolic algebra',
      '3D graphing',
      'Matrix tools',
    ],
    bestFor: 'Checking and exploring mathematics as you learn it.',
  },
  {
    kind: 'lab',
    key: 'html-lab',
    headline: 'Build web pages by hand and by drag-and-drop, and see both at once',
    description:
      'Drag real HTML elements (div, p, h1, button, span and more) onto a live canvas and style them through a properties panel, while the code panel shows the HTML and CSS you are producing. Edit either side and the other follows, with the box model drawn live so margins, borders and padding stop being guesswork.',
    highlights: [
      'Visual editor and code panel stay in sync both ways',
      'Properties panel for inline CSS',
      'Live box-model view of every element',
    ],
    bestFor: 'Learning HTML and CSS by seeing exactly what each line of markup does.',
  },
  {
    kind: 'lab',
    key: 'notebook-lab',
    headline: 'Real Python notebooks, nothing to install',
    description:
      'Create and run Python notebooks in the browser: write code in cells, see output and plots, and move work in and out as standard .ipynb files that open in Jupyter. Import notebooks straight from GitHub.',
    highlights: [
      'Full Python in the browser, with the scientific libraries',
      'Download and upload .ipynb files compatible with Jupyter',
      'Import notebooks from GitHub',
    ],
    bestFor: 'Data work and experiments when you want results, not setup.',
  },
  {
    kind: 'lab',
    key: 'ml-lab',
    headline: 'Machine learning from the gradients up',
    description:
      'Understand how models actually learn: derive the gradients, inspect training as it happens, write the NumPy yourself, and evaluate whether the predictions are any good.',
    highlights: [
      'Gradients derived, not just called',
      'Write the NumPy yourself, in the browser',
      'Inspect training and evaluate predictions',
    ],
    bestFor: 'Learning what machine-learning libraries do underneath.',
  },
  {
    kind: 'lab',
    key: 'mesh-lab',
    headline: 'A programmable 3D laboratory with the math in plain sight',
    description:
      'Select objects in a 3D scene and inspect the transform matrices that place them, then change the scene from a scripting console and watch the result. Panels for traces, a timeline, UV mapping and shaders show what a 3D engine does at each step, instead of hiding it behind buttons.',
    highlights: [
      'Inspect every object\'s transform matrix',
      'Scripting console for live scene changes',
      'Trace, timeline, UV and shader panels',
    ],
    bestFor: '3D graphics and the linear algebra that drives it.',
  },
  {
    kind: 'lab',
    key: 'code-typing',
    headline: 'Type real code until the symbols stop slowing you down',
    description:
      'Practise typing real code snippets from the concept library, not random words. Each next key is highlighted with the keys to press for it (Shift + [ for a brace), speed and accuracy update as you type, and when you finish, a JavaScript, TypeScript or Python snippet runs so you see what the code you just typed does, with a line-by-line explanation.',
    highlights: [
      'Real snippets in JavaScript, Python and more',
      'Key-by-key hints for braces, brackets and symbols',
      'Live WPM and accuracy, then your typed code runs (JavaScript, TypeScript, Python)',
    ],
    bestFor: 'Building the typing fluency that makes writing code feel natural.',
  },
  {
    kind: 'lab',
    key: 'project-studio',
    headline: 'Build a real multi-file project, on disk',
    description:
      'Work on an actual project folder on your computer, step by step: real files, run by a real interpreter, with a diff at each step showing exactly what that step added and why. The bridge between exercises and building things on your own.',
    highlights: [
      'Real files in a folder you choose',
      'Diffs that show what each step changes',
      'Desktop app only',
    ],
    bestFor: 'Moving from single exercises to real, multi-file programs.',
  },
  {
    kind: 'lab',
    key: 'dsa-patterns',
    headline: 'Data structures and design patterns, taught together',
    description:
      'Arrays, linked lists, stacks, trees and graphs alongside the design patterns you need to build them properly, written in TypeScript throughout, with CodeLens walkthroughs that let you watch the structures change.',
    highlights: [
      'Each structure built with the patterns that make it clean',
      '42 CodeLens walkthroughs that open the code in the step-by-step viewer',
      'TypeScript throughout',
    ],
    bestFor: 'Interview preparation and writing data-structure code you would ship.',
  },
  {
    kind: 'lab',
    key: 'game-studio',
    headline: 'A game engine you can see inside',
    description:
      'A browser game engine in the spirit of Godot: a scene tree of nodes, an Inspector, real JavaScript scripts and a Phaser runtime. Every editor action is shown as the code it corresponds to, so building a game teaches you how engines work.',
    highlights: [
      'Scene tree, Inspector and scripts, like a desktop engine',
      'Every action shown as the code it produces',
      'Runs on Phaser, a real game framework',
    ],
    bestFor: 'Learning game development and how engines are structured.',
  },
  {
    kind: 'lab',
    key: 'backend-lab',
    headline: 'Build a real backend from scratch',
    description:
      'Routes, middleware, services and a database, added one felt need at a time, so each layer arrives when the code without it has started to hurt. A built-in request client lets you test your own endpoints as you go.',
    highlights: [
      'Each layer introduced when you need it',
      'Test your endpoints with the built-in request client',
      'A real database behind the API',
    ],
    bestFor: 'Understanding what a web backend is made of, and why.',
  },
]
