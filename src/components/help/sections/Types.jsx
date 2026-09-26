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
          The classic lesson type. Build it in the Lesson Builder: one or more
          Markdown cells for explanation, a Viz cell for the interactive, and a
          Quiz cell at the end. Emphasis on building intuition first, then
          formal definition, then practice.
        </Para>
        <H3>Recommended cell order</H3>
        <CodeBlock>{`Markdown (hook question + real-world context)
Markdown (intuitive explanation, no formulas yet)
Viz      (interactive — SecantToTangent, RiemannSum, etc.)
Markdown (formal definition with LaTeX)
Assessment (open-ended reflection)
Quiz     (scored — ≥80% earns ★)`}</CodeBlock>
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
          For lessons where students write and run Python code. An interactive
          Python notebook (powered by Pyodide — no installation needed) is
          embedded as a Viz cell.
        </Para>
        <H3>In the Lesson Builder</H3>
        <Para>
          Add a Viz cell and set the ID to <Cb>PythonNotebook</Cb>. That's it.
          The cell appears with syntax highlighting and Shift+Enter to run.
          Students edit it live — output appears immediately.
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
          For lessons that walk through a mathematical proof step by step. Heavy
          on prose (Markdown cells) — build intuition first, then present the
          formal proof. Often no scored quiz — just an Assessment cell asking
          students to paraphrase the result.
        </Para>
        <H3>Recommended cell order</H3>
        <CodeBlock>{`Markdown (hook — why should this result be true?)
Markdown (intuitive geometric argument, no symbols)
Markdown (formal proof — use **Step 1:**, **Step 2:**)
Assessment (explain the result in your own words)`}</CodeBlock>
        <H3>Writing the proof body in Markdown</H3>
        <CodeBlock>{`**Proof:**

**Step 1:** Since triangle ABC is isosceles, $AB = AC$.

**Step 2:** By the Angle Bisector Theorem...

**Therefore:** $\\angle B = \\angle C$. $\\square$`}</CodeBlock>
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
          Used for chemistry and digital-fundamentals lessons. The entire lesson
          — prose, callouts, steps, and interactive viz — is packaged inside a{" "}
          <Cb>ScienceNotebook</Cb> component. This is <strong>Schema E</strong>.
          Requires a code editor (not available in the Lesson Builder yet).
        </Para>
        <H3>File structure — two exports required</H3>
        <CodeBlock>{`// lesson1-0.js
const LESSON_CHEM_1_0 = { ...full lesson object... }
export { LESSON_CHEM_1_0 }   // named export — for the viz wrapper
export default LESSON_CHEM_1_0  // default export — for the chapter index`}</CodeBlock>
        <H3>Cells in a ScienceNotebook lesson</H3>
        <CodeBlock>{`cells: [
  { type: 'prose',    content: 'Explanation text...' },
  { type: 'callout',  variant: 'key-idea', title: 'Big Idea', body: '...' },
  { type: 'step',     label: '1', content: 'First step...' },
  { type: 'formula',  latex: 'E = mc^2' },
  { type: 'viz',      id: 'MyVizId' },
]`}</CodeBlock>
        <H3>Viz wrapper — required for every ScienceNotebook lesson</H3>
        <Para>
          Create a wrapper file in <Cb>src/components/viz/react/</Cb> that
          self-imports the lesson and passes it to ScienceNotebook. Each lesson
          needs its own wrapper so VizFrame can load it by ID.
        </Para>
        <CodeBlock>{`// src/components/viz/react/WhyChemistry.jsx
import ScienceNotebook from './ScienceNotebook.jsx'
import { LESSON_CHEM_1_0 } from '../../../courses/chemistry/1-elements-atomic-structure/001-lesson1-0.js'

export default function WhyChemistry({ params }) {
  return <ScienceNotebook lesson={LESSON_CHEM_1_0} params={params} />
}`}</CodeBlock>
        <Para>
          Then register it in <Cb>VizFrame.jsx</Cb>:
        </Para>
        <CodeBlock>{`WhyChemistry: lazy(() => import('./react/WhyChemistry.jsx')),`}</CodeBlock>
        <Note color="amber">
          Do NOT set <Cb>previewVisualizationId</Cb> in the lesson's{" "}
          <Cb>hook</Cb> — the viz is rendered from{" "}
          <Cb>intuition.visualizations</Cb> only. Setting it in both causes a
          double-render.
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
          Add a Viz cell and set the ID to <Cb>JSNotebook</Cb>. The Monaco
          editor appears with live HTML/CSS/JS output in a panel beside it.
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
      <SectionHeading sub="Conventions for which cells to use based on subject matter.">
        Lesson Types
      </SectionHeading>
      <Para>
        "Types" are conventions for cell order and content style based on
        subject. The Lesson Builder supports all types except Science Notebook
        (which requires a code editor). Check ARCHITECTURE.md § 4 for the
        course→schema mapping before starting.
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
