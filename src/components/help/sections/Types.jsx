// The Help modal's "Types" section. Split out of src/components/ui/HelpModal.jsx.

import { useState } from "react";
import { TPL_MATH, TPL_PROOF, TPL_PYTHON } from "../lessonTemplates.js";
import { Cb, CodeBlock, DownloadCard, H3, Note, Para, SectionHeading } from "../primitives.jsx";

// ─── SECTION: LESSON TYPES ───────────────────────────────────────────────────

export function SectionTypes() {
  const [active, setActive] = useState("math");
  const types = [
    { id: "math", label: "📐 Math / Calculus" },
    { id: "python", label: "🐍 Python / Code" },
    { id: "proof", label: "📝 Proof / Geometry" },
    { id: "web", label: "🌐 Web / JavaScript" },
    { id: "science", label: "🔬 Science / ScienceNotebook" },
  ];
  const content = {
    math: (
      <div>
        <Para>
          The classic lesson type. Build intuition first, then the formal
          statement, then practice. In the Lesson Builder, add these sections in
          order.
        </Para>
        <H3>Recommended sections</H3>
        <CodeBlock>{`Hook        the question the lesson answers + real-world context
Intuition   prose (no formulas yet) + a Visualization block
            (SecantToTangent, RiemannSum, …)
Math        the formal definition, with LaTeX
Examples    worked examples, step by step
Assessment  open-ended reflection (not scored)
Quiz        scored — complete when every answer is correct`}</CodeBlock>
        <H3>Inline algebra popovers</H3>
        <Para>
          In any prose string, use <Cb>{"{{"}</Cb>
          <Cb>algebra:id|link text</Cb>
          <Cb>{"}}"}</Cb> to link a term to a pop-up reference card. The link
          text is KaTeX.
        </Para>
        <CodeBlock>{`"Factor using {{algebra:difference-of-squares|difference of squares}}."`}</CodeBlock>
        <Para>
          Available IDs: <Cb>difference-of-squares</Cb>,{" "}
          <Cb>difference-of-cubes</Cb>, <Cb>exponent-rules-multiply</Cb>,{" "}
          <Cb>exponent-rules-power</Cb>, <Cb>log-power-rule</Cb>,{" "}
          <Cb>triangle-inequality</Cb>, <Cb>conjugate-multiplication</Cb>,{" "}
          <Cb>fraction-split</Cb>, <Cb>factoring-fractional-powers</Cb>,{" "}
          <Cb>solve-simple-quadratic</Cb>. Add new ones to{" "}
          <Cb>src/reference/algebraRegistry.js</Cb>.
        </Para>
        <DownloadCard
          icon="📐"
          title="Math Lesson Template (.js)"
          filename="math-lesson-template.js"
          template={TPL_MATH}
          desc="For contributors using a code editor. All sections with commented instructions."
        />
      </div>
    ),
    python: (
      <div>
        <Para>
          For lessons where learners write and run Python code. An interactive
          Python notebook (powered by Pyodide — no installation needed) is a
          visualization you place in the lesson.
        </Para>
        <H3>In the Lesson Builder</H3>
        <Para>
          In Intuition (or another section), add a Visualization block with the
          id <Cb>PythonNotebook</Cb>. Its cells go in{" "}
          <Cb>props.initialCells</Cb> — cells written anywhere else are ignored
          and the notebook shows placeholder cells instead. Learners edit the
          code and run it with Shift+Enter; cells share one namespace, in
          order.
        </Para>
        <H3>opencalc library</H3>
        <Para>
          Every notebook automatically has access to <Cb>opencalc</Cb> — see the{" "}
          <strong>opencalc Library</strong> section for all drawing methods
          including graphs, vectors, and geometry.
        </Para>
        <DownloadCard
          icon="🐍"
          title="Python Lesson Template (.js)"
          filename="python-lesson-template.js"
          template={TPL_PYTHON}
          desc="For contributors using a code editor. Lesson with an embedded Python notebook cell."
        />
      </div>
    ),
    proof: (
      <div>
        <Para>
          For lessons that walk through a mathematical proof step by step. Build
          intuition first, then state the theorem, then prove it. Often there's
          no scored quiz — just an Assessment question asking learners to
          restate the result.
        </Para>
        <H3>Recommended sections</H3>
        <CodeBlock>{`Hook        why should this result be true?
Intuition   the geometric or intuitive argument, no symbols yet
Math        **Theorem:** / **Given:** / **Prove:**
Rigor       the proof, as proofSteps
Assessment  explain the result in your own words`}</CodeBlock>
        <H3>Proof steps</H3>
        <Para>
          Put the proof in <Cb>rigor.proofSteps</Cb>: one entry per step, each a
          statement in LaTeX and the reason it holds. Learners step through
          them one at a time.
        </Para>
        <CodeBlock>{`rigor: {
  proofSteps: [
    { expression: 'AB = AC', annotation: 'Given: the triangle is isosceles.' },
    { expression: '\\\\angle B = \\\\angle C', annotation: 'Base angles of an isosceles triangle are equal.' },
  ],
}`}</CodeBlock>
        <DownloadCard
          icon="📝"
          title="Proof Lesson Template (.js)"
          filename="proof-lesson-template.js"
          template={TPL_PROOF}
          desc="For contributors using a code editor."
        />
      </div>
    ),
    science: (
      <div>
        <Para>
          Used by the geometry, chemistry and digital-fundamentals courses. A{" "}
          <Cb>ScienceNotebook</Cb> shows a list of cells: prose, live previews,
          multiple-choice questions, coding exercises and walkthroughs. In the
          Lesson Builder, the <strong>Cells</strong> section edits them.
        </Para>
        <H3>Cell types</H3>
        <CodeBlock>{`cells: [
  { type: 'markdown',    instruction: 'Explanation text with **Markdown** and $math$.' },
  { type: 'js',          ... },   // a canvas or animation that runs by itself
  { type: 'challenge',   instruction: 'Question?', options: [...], check: ... },
  { type: 'coding',      ... },   // editor + Run + check(code)
  { type: 'walkthrough', ... },   // numbered steps with a live preview
]`}</CodeBlock>
        <H3>Showing the cells in the lesson</H3>
        <Para>
          Pass the cells to <Cb>ScienceNotebook</Cb> with a Visualization block.
          It's already registered, so there's no wrapper file to write and
          nothing to register:
        </Para>
        <CodeBlock>{`intuition: {
  blocks: [
    { type: 'viz', id: 'ScienceNotebook',
      props: { lesson: { title: 'Your lesson title', cells: [ /* cells */ ] } } },
  ],
}`}</CodeBlock>
        <Note color="amber">
          Cells kept only in a separate named export are not shown: the lesson
          page renders the file's default export. Some older chemistry lessons
          are built this way; check the page after adding cells.
        </Note>
      </div>
    ),
    web: (
      <div>
        <Para>
          For lessons where students write JavaScript, HTML, or CSS. Uses{" "}
          <Cb>JSNotebook</Cb> — students see live output immediately as they
          type.
        </Para>
        <H3>In the Lesson Builder</H3>
        <Para>
          Add a Visualization block with the id <Cb>JSNotebook</Cb>. Learners
          get a code editor with live HTML/CSS/JS output beside it.
        </Para>
        <H3>Python vs. JavaScript notebooks</H3>
        <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
          <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-700 text-teal-800 dark:text-teal-300 space-y-1">
            <div className="font-bold">PythonNotebook</div>
            <div>• Pyodide (WebAssembly)</div>
            <div>• opencalc charts built-in</div>
            <div>• Cell-by-cell execution</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 space-y-1">
            <div className="font-bold">JSNotebook</div>
            <div>• Runs native JS</div>
            <div>• Live HTML/CSS output</div>
            <div>• Monaco editor (VS Code-like)</div>
          </div>
        </div>
      </div>
    ),
  };
  return (
    <div>
      <SectionHeading sub="Which sections to use, by subject.">
        Lesson Types
      </SectionHeading>
      <Para>
        "Types" are conventions for which sections a lesson uses and in what
        order, depending on the subject. The Lesson Builder can build all of
        them. When in doubt, open an existing lesson from the same course with
        🔨 Edit in Builder and follow its shape.
      </Para>
      <div className="flex flex-wrap gap-2 mb-6">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${active === t.id ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {content[active]}
    </div>
  );
}
