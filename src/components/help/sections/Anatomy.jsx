// The Help modal's "Anatomy" section. Split out of src/components/ui/HelpModal.jsx.

import { Check } from "lucide-react";
import { Note, Para, SectionHeading } from "../primitives.jsx";

// ─── SECTION: CELL TYPES ─────────────────────────────────────────────────────

export function SectionAnatomy() {
  return (
    <div>
      <SectionHeading sub="A lesson is a set of sections — add the ones your topic needs.">
        Lesson Sections
      </SectionHeading>
      <Para>
        In the Lesson Builder, <strong>Add Section</strong> lists every section
        type. Identity (title, id, slug) is always there; the rest are optional,
        and the lesson renders them top to bottom. The most used:
      </Para>

      <div className="space-y-4 my-4">
        {[
          {
            icon: "🧠",
            label: "Intuition, Math, Rigor",
            color: "border-blue-300/60 bg-blue-50/50 dark:bg-blue-950/20",
            badge: "text-blue-600 dark:text-blue-400",
            points: [
              "The explanation: Intuition first, then formal Math, then proof in Rigor",
              "Inside each, add Prose, Callout, Visualization and Image blocks",
              "Prose is Markdown with LaTeX: $f(x)$ inline, $$\\int$$ on its own line",
              "'∫≈ Visual Math…' in the prose toolbar writes LaTeX for you",
            ],
          },
          {
            icon: "🧪",
            label: "Quiz (scored)",
            color: "border-orange-300/60 bg-orange-50/50 dark:bg-orange-950/20",
            badge: "text-orange-600 dark:text-orange-400",
            points: [
              "Questions with one clear correct answer",
              "The lesson counts as complete when every question is answered correctly",
              "LaTeX works in questions and answers",
            ],
          },
          {
            icon: "📋",
            label: "Assessment (unscored)",
            color: "border-teal-300/60 bg-teal-50/50 dark:bg-teal-950/20",
            badge: "text-teal-600 dark:text-teal-400",
            points: [
              "No score — open-ended questions",
              "Learners write an answer, then compare it with a model answer",
              "Best for 'explain it in your own words'",
            ],
          },
          {
            icon: "🔭",
            label: "Visualization blocks",
            color: "border-violet-300/60 bg-violet-50/50 dark:bg-violet-950/20",
            badge: "text-violet-600 dark:text-violet-400",
            points: [
              "Embed a registered visualization by its id (case-sensitive)",
              "Props configure it: { id: 'RiemannSum', props: { defaultN: 10 } }",
              "PythonNotebook and JSNotebook are visualizations too",
              "Available ids are listed under 'Using Vizs'",
            ],
          },
          {
            icon: "🐍",
            label: "Python, Cells, Examples, Challenges",
            color:
              "border-emerald-300/60 bg-emerald-50/50 dark:bg-emerald-950/20",
            badge: "text-emerald-600 dark:text-emerald-400",
            points: [
              "Python: runnable notebook cells (Pyodide), with the opencalc library",
              "Cells: notebook cells for markdown, JavaScript, challenges and walkthroughs",
              "Examples: worked examples, step by step",
              "Challenges: practice problems with an answer and walkthrough",
            ],
          },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border ${c.color} p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{c.icon}</span>
              <span className={`text-sm font-bold ${c.badge}`}>{c.label}</span>
            </div>
            <ul className="space-y-1">
              {c.points.map((p, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400"
                >
                  <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Note color="blue">
        More sections are in <strong>Add Section</strong>: Walkthroughs,
        Checkpoints, Semantics, Spiral, Misconceptions, Transfer Prompts,
        Debugging and Mastery. Hover one to see what it's for.
      </Note>
    </div>
  );
}
