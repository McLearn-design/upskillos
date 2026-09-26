// The Help modal's "Anatomy" section. Split out of src/components/ui/HelpModal.jsx.

import { Check } from "lucide-react";
import { Note, Para, SectionHeading } from "../primitives.jsx";

// ─── SECTION: CELL TYPES ─────────────────────────────────────────────────────

export function SectionAnatomy() {
  return (
    <div>
      <SectionHeading sub="Every lesson is made of cells — pick the right type for each block of content.">
        Cell Types
      </SectionHeading>
      <Para>
        The Lesson Builder composes lessons from cells. Each cell type renders
        differently for students. Add cells in any order — the lesson renders
        top-to-bottom.
      </Para>

      <div className="space-y-4 my-4">
        {[
          {
            icon: "📝",
            label: "Markdown",
            color: "border-blue-300/60 bg-blue-50/50 dark:bg-blue-950/20",
            badge: "text-blue-600 dark:text-blue-400",
            points: [
              "Prose, headings, bold, italic, inline code",
              "Inline math: $f(x)$    Display math: $$\\int$$",
              "Use '∫≈ Visual Math…' toolbar button for WYSIWYG LaTeX",
              "Renders markdown + KaTeX — no HTML needed",
            ],
          },
          {
            icon: "❓",
            label: "Quiz (scored)",
            color: "border-orange-300/60 bg-orange-50/50 dark:bg-orange-950/20",
            badge: "text-orange-600 dark:text-orange-400",
            points: [
              "≥80% earns ★ completion — shown permanently in sidebar",
              "Each question: answer + up to 3 hints (revealed one at a time)",
              "Best for: clear right/wrong questions",
              "Supports LaTeX in both question and answer",
            ],
          },
          {
            icon: "💭",
            label: "Assessment (unscored)",
            color: "border-teal-300/60 bg-teal-50/50 dark:bg-teal-950/20",
            badge: "text-teal-600 dark:text-teal-400",
            points: [
              "No score — zero pressure, open-ended reflection",
              "Students type an answer and then see the model answer",
              "One hint per question (a single nudge, not an array)",
              "Best for: 'explain in your own words' questions",
            ],
          },
          {
            icon: "📊",
            label: "Viz",
            color: "border-violet-300/60 bg-violet-50/50 dark:bg-violet-950/20",
            badge: "text-violet-600 dark:text-violet-400",
            points: [
              "Embeds any registered interactive visualization by ID",
              "ID must exactly match the VIZ_REGISTRY key (case-sensitive)",
              "Pass props to configure the viz: { id: 'RiemannSum', props: { defaultN: 10 } }",
              "Full list in the 'Using Vizs' section",
            ],
          },
          {
            icon: "💻",
            label: "Code (Python / JS)",
            color:
              "border-emerald-300/60 bg-emerald-50/50 dark:bg-emerald-950/20",
            badge: "text-emerald-600 dark:text-emerald-400",
            points: [
              "PythonNotebook: Pyodide, opencalc charts, Shift+Enter to run",
              "JSNotebook: live HTML/CSS output, Monaco editor",
              "Added via a Viz cell with id: 'PythonNotebook' or 'JSNotebook'",
              "opencalc library available automatically in Python cells",
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
        <strong>LaTeX tip:</strong> Use the <strong>∫≈ Visual Math…</strong>{" "}
        button in the Markdown cell toolbar to open a WYSIWYG equation editor.
        Type or draw a formula, click Insert — the LaTeX is written for you.
      </Note>
    </div>
  );
}
