// The Help modal's "FirstLesson" section. Split out of src/components/ui/HelpModal.jsx.

import { Para, SectionHeading, StepWizard } from "../primitives.jsx";

// ─── SECTION: FIRST LESSON ───────────────────────────────────────────────────

const FIRST_LESSON_STEPS = [
  {
    title: "Open the Lesson Builder",
    desc: "To improve a lesson you're reading, press 🔨 Edit in Builder next to its title — the builder opens with that lesson loaded. To start a new one, open Lesson Builder from the Start menu (desktop) or go to #/lesson-builder.",
    note: "The builder runs in your browser. You can build and check a whole lesson without installing anything.",
    bullets: [
      "Existing lesson: 🔨 Edit in Builder on the lesson page",
      "New lesson: Start menu → Lesson Builder, or #/lesson-builder",
      "The Lesson Map on the right shows the lesson's structure; click a node to jump to it",
    ],
  },
  {
    title: "Fill in the Identity section",
    desc: "Every lesson starts with Identity: its title, a one-line subtitle, its id, slug and chapter, and search tags.",
    note: "The id is the key learners' progress is saved under. For a new lesson pick one that no other lesson uses; never change the id of a lesson that is already published.",
    noteColor: "amber",
  },
  {
    title: "Add the sections your lesson needs",
    desc: "Use Add Section on the left — click to append, or drag onto the canvas to insert. Most lessons start with Intuition; add Math, Examples, Quiz, Python and others as needed. Inside Intuition, Math and Rigor you add Prose, Callout, Visualization and Image blocks.",
    code: `Prose supports Markdown and LaTeX:
**bold**   *italic*   \`code\`

Inline math:   $f'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}$

Display math:
$$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$`,
    note: "Not sure how to write a formula? The prose editor's toolbar has a '∫≈ Visual Math…' button that writes the LaTeX for you. Math is checked as you type, so a broken equation shows up straight away.",
    noteColor: "green",
  },
  {
    title: "Add a Quiz",
    desc: "Add the Quiz section and write questions with one clear correct answer. A lesson with a quiz counts as complete when the learner answers every question correctly.",
    note: "Open-ended 'explain it in your own words' questions belong in the Assessment section, which has no score.",
    noteColor: "blue",
  },
  {
    title: "Add a visualization (optional)",
    desc: "Inside Intuition (or Math), add a Visualization block and choose a registered visualization by its id. Python notebooks are visualizations too: PythonNotebook.",
    code: `Common ids:
SecantToTangent     RiemannSum
UnitCircle          PythonNotebook
JSNotebook          ParametricCurve3D`,
    note: "Ids are case-sensitive. 'Using Vizs' in this guide lists what's available; the Viz Builder can insert a configured visualization for you.",
    noteColor: "amber",
  },
  {
    title: "Check how it looks",
    desc: "Each section on the canvas shows how it will render for learners; click a section to edit it and click away to see the result again.",
    bullets: [
      "LaTeX renders as you type",
      "Visualizations load live",
      "Use the Lesson Map to check the order of sections",
    ],
  },
  {
    title: "Export and open a pull request",
    desc: "Press Export .js in the top bar. From the export panel you can copy the lesson source, or submit it as a pull request: paste a GitHub personal access token and the builder forks the repository, creates a branch, commits the file and opens the pull request for you.",
    code: `// Where a lesson file lives:
src/courses/{course}/{N}-{chapter}/{NNN}-{slug}.js

// Example:
src/courses/calculus/3-derivatives/005-chain-rule.js`,
    note: "If you run the app locally with npm run dev, the panel can also show a diff and save straight to your files. Ask in Discord if you're unsure which chapter a new lesson belongs in.",
    noteColor: "green",
    bullets: [
      "A maintainer reviews and merges the pull request",
      "Once merged, the lesson appears in the app automatically — nothing to register",
    ],
  },
];

export function SectionFirstLesson() {
  return (
    <div>
      <SectionHeading sub="From blank page to live lesson — using the Lesson Builder.">
        Your First Lesson
      </SectionHeading>
      <Para>
        Follow these steps. By the end you'll have a lesson built or improved in
        the app and submitted for review. No code required — just write content.
      </Para>
      <StepWizard steps={FIRST_LESSON_STEPS} />
    </div>
  );
}
