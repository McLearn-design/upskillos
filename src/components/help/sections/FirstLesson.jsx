// The Help modal's "FirstLesson" section. Split out of src/components/ui/HelpModal.jsx.

import { Para, SectionHeading, StepWizard } from "../primitives.jsx";

// ─── SECTION: FIRST LESSON ───────────────────────────────────────────────────

const FIRST_LESSON_STEPS = [
  {
    title: "Open the Lesson Builder",
    desc: "Click the Start Menu (^ logo, top-left) and choose 'Lesson Builder' — or navigate directly to /lesson-builder. No setup, no install.",
    note: "The Lesson Builder works entirely in your browser. You can build and preview a complete lesson without touching any code.",
    bullets: [
      "Start Menu → Lesson Builder",
      "Or navigate to /lesson-builder in the URL bar",
      "The page opens with a blank lesson ready to fill in",
    ],
  },
  {
    title: "Set your lesson title and subtitle",
    desc: "At the top of the builder, click the title field and type your lesson title. Add a subtitle — one sentence describing what the lesson teaches.",
    note: "The title and subtitle are the first thing students see. Make the title a clear concept name, and the subtitle an active description: 'The instantaneous rate of change', not just 'Derivatives'.",
  },
  {
    title: "Add a Markdown cell for your explanation",
    desc: "Click '+ Add Cell' and choose Markdown. This is your main lesson body. Write the intuitive explanation here — prose, LaTeX math, and formatted text.",
    code: `Write plain text and use:
**bold**   *italic*   \`code\`

Inline math:   $f'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}$

Display math:
$$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$`,
    note: "Not sure how to write a formula? Click the '∫≈ Visual Math…' button in the toolbar to open the visual equation editor — draw or type the formula and it inserts the LaTeX for you.",
    noteColor: "green",
  },
  {
    title: "Add a Quiz cell",
    desc: "Click '+ Add Cell' → Quiz. Add 3–5 questions. Each question has an answer and optional hints (revealed one at a time). Getting ≥80% marks the lesson complete with a ★.",
    code: `Question: What is the derivative of $f(x) = x^3$?
Answer:   $3x^2$
Hint 1:   Use the power rule.
Hint 2:   Multiply the exponent by the coefficient, reduce exponent by 1.`,
    note: "Write questions with a single definitive correct answer. Open-ended reflection questions belong in an Assessment cell (no score, students see model answer).",
    noteColor: "blue",
  },
  {
    title: "Add a Viz cell (optional)",
    desc: "Click '+ Add Cell' → Viz to embed any registered interactive visualization. Type the visualization ID exactly as it appears in the registry.",
    code: `Common IDs:
SecantToTangent     RiemannSum
UnitCircle          PythonNotebook
JSNotebook          ParametricCurve3D`,
    note: "The full list of available IDs is in the 'Using Vizs' section of this guide. IDs are case-sensitive.",
    noteColor: "amber",
  },
  {
    title: "Preview your lesson",
    desc: "Click the eye icon (👁) or the 'Preview' button in the toolbar to see exactly how your lesson will look to students. The preview updates live as you edit.",
    bullets: [
      "LaTeX math renders correctly in preview",
      "Quiz questions are interactive",
      "Any embedded viz loads live",
      "Scroll through to check the full layout",
    ],
  },
  {
    title: "Export and submit a PR",
    desc: "Click 'Export' to download the lesson as a .js file. Then create a GitHub pull request to add it to the right chapter folder in the repository.",
    code: `// Destination path pattern:
src/courses/{subject}/{chapter-folder}/{order}-{topic}.js

// Example:
src/courses/calculus/2-derivatives/005-chain-rule.js`,
    note: "Fork the repo first if you don't have write access. Ask in Discord if you're unsure which folder your lesson belongs in.",
    noteColor: "green",
    bullets: [
      "Open a PR on GitHub — maintainers review and merge",
      "Your lesson appears in the app for all students",
      "Join Discord to announce it to the community",
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
        Follow these steps. By the end you'll have a complete lesson built in
        the app and ready to submit. No code required — just write content.
      </Para>
      <StepWizard steps={FIRST_LESSON_STEPS} />
    </div>
  );
}
