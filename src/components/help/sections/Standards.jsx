// The Help modal's "Standards" section. Split out of src/components/ui/HelpModal.jsx.

import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { H2, H3 } from "../primitives.jsx";

// ─── STANDARDS SECTION ──────────────────────────────────────────────────────

const LESSON_STATES = [
  {
    label: "Draft",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    desc: "Initial content. The schema is valid and the lesson renders. Incomplete sections are allowed.",
  },
  {
    label: "Review-Ready",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    desc: "All required sections present. Prose checked for weak patterns. Math verified. At least one quiz question per learning objective.",
  },
  {
    label: "Complete",
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    desc: "Review-Ready plus: all prose quality items pass, KaTeX verified, vizs interactive and referenced from prose, spiral links accurate.",
  },
];

const REQUIREMENTS = [
  {
    zone: "🪪 Identity",
    items: [
      { req: true, text: "id, slug, title and subtitle set; the id is unique and never changes once published" },
      {
        req: true,
        text: "Prerequisites list actual lesson ids, not topic names",
      },
      {
        req: false,
        text: 'mentalModel provided: 3–5 short lines on what this "is" in plain language',
      },
    ],
  },
  {
    zone: "🎣 Hook",
    items: [
      {
        req: true,
        text: "hook.question — a real-world question that makes the concept feel necessary",
      },
      {
        req: true,
        text: "hook.realWorldContext — 1–3 sentences on why the question matters",
      },
      {
        req: false,
        text: "hook.previewVisualizationId — an interactive viz in the hook (text-only hooks rarely land)",
      },
    ],
  },
  {
    zone: "🧠 Intuition",
    items: [
      {
        req: true,
        text: "Intuition — 2+ prose paragraphs building geometric or physical sense",
      },
      {
        req: true,
        text: "At least one interactive visualization tied to the intuition",
      },
      {
        req: false,
        text: "semantics.core — the symbols the lesson introduces, with their meaning",
      },
    ],
  },
  {
    zone: "🔢 Math",
    items: [
      { req: true, text: "Math (and Rigor, for proofs) with KaTeX-formatted math" },
      {
        req: true,
        text: 'Every step of every proof or derivation is shown — no "it follows that"',
      },
      {
        req: false,
        text: "spiral.recoveryPoints (prerequisites to revisit) and spiral.futureLinks (where this leads)",
      },
    ],
  },
  {
    zone: "✅ Assessment",
    items: [
      {
        req: true,
        text: "assessment block present — checks understanding, not just computation",
      },
      {
        req: true,
        text: "quiz (an array) — at least one question per major learning objective",
      },
      {
        req: true,
        text: "All quiz answers verified correct, and hints filled in",
      },
    ],
  },
];

const PROSE_ANTI_PATTERNS = [
  {
    bad: '"This is simply…"',
    fix: "Explain the step; never imply it is obvious.",
  },
  {
    bad: '"You probably know…"',
    fix: "Define it or link to a prerequisite lesson.",
  },
  {
    bad: '"It can be shown that…"',
    fix: "Show it, or move it to a separate callout.",
  },
  {
    bad: 'Passive: "the limit is taken"',
    fix: 'Active: "we take the limit" or "the function approaches".',
  },
  {
    bad: '"Intuitively…" (then says nothing intuitive)',
    fix: 'Follow every "intuitively" with a visual or physical reference.',
  },
  {
    bad: "Wall of LaTeX with no prose",
    fix: "At least one explanatory sentence between every displayed equation.",
  },
];

export function SectionStandards() {
  const [open, setOpen] = useState(null);
  return (
    <div className="space-y-6">
      <div>
        <H2>Content Standards</H2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Every lesson moves through three states before it is considered
          complete. Use these checklists during writing and before opening a
          pull request.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {LESSON_STATES.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border px-4 py-3 ${s.bg} ${s.border}`}
          >
            <span
              className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2 ${s.badge}`}
            >
              {s.label}
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {s.desc}
            </p>
          </div>
        ))}
      </div>

      <div>
        <H3>Minimum requirements by section</H3>
        <p className="text-xs text-slate-500 dark:text-slate-500 mb-3">
          <span className="font-bold text-red-500 dark:text-red-400">
            ★ Required
          </span>{" "}
          items must be present for Review-Ready.{" "}
          <span className="font-bold text-slate-500">○ Recommended</span> items
          are needed for Complete.
        </p>
        <div className="space-y-2">
          {REQUIREMENTS.map((r) => (
            <div
              key={r.zone}
              className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                onClick={() => setOpen(open === r.zone ? null : r.zone)}
              >
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {r.zone}
                </span>
                <ChevronRight
                  className={`w-4 h-4 text-slate-400 transition-transform ${open === r.zone ? "rotate-90" : ""}`}
                />
              </button>
              {open === r.zone && (
                <div className="px-4 pb-3 pt-2 space-y-1.5">
                  {r.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span
                        className={`shrink-0 font-bold mt-0.5 ${item.req ? "text-red-500 dark:text-red-400" : "text-slate-400"}`}
                      >
                        {item.req ? "★" : "○"}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <H3>Prose quality — patterns to avoid</H3>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="grid grid-cols-2 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
            <span>Avoid</span>
            <span>Instead</span>
          </div>
          {PROSE_ANTI_PATTERNS.map((row, i) => (
            <div
              key={i}
              className={`grid grid-cols-2 gap-3 px-3 py-2.5 text-xs border-b border-slate-100 dark:border-slate-800 last:border-0 ${i % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-slate-900/30"}`}
            >
              <span className="text-red-500 dark:text-red-400 font-mono">
                {row.bad}
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                {row.fix}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <H3>Math accuracy checklist</H3>
        <div className="space-y-1.5">
          {[
            "All definitions match the standard textbook definition for this level.",
            "Every theorem includes the full set of hypotheses — no hidden assumptions.",
            "LaTeX renders without errors; fractions use \\dfrac in display math.",
            "Variable names are consistent throughout the lesson (no silent reuse).",
            "Worked examples are computed correctly — verify algebraically, not just visually.",
            "Quiz numerical answers are exact (not rounded) unless the problem says otherwise.",
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
            >
              <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
              <span className="text-slate-600 dark:text-slate-400">{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 px-4 py-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        <span className="font-bold text-brand-700 dark:text-brand-300">
          Full reference:{" "}
        </span>
        See{" "}
        <code className="font-mono bg-white/60 dark:bg-black/20 px-1 rounded">
          docs/lesson-writing-standard.md
        </code>{" "}
        in the repository for the full writing standard, and the pull request
        template for the checklist.
      </div>
    </div>
  );
}
