// The Help modal's "Formatting" section. Split out of src/components/ui/HelpModal.jsx.

import { useState } from "react";
import { Cb, CodeBlock, H3, Note, Para, SectionHeading } from "../primitives.jsx";

// ─── SECTION: FORMATTING GUIDE ──────────────────────────────────────────────

const LATEX_CHEATSHEET = [
  { cmd: "\\\\frac{a}{b}", output: "a/b fraction", ex: "\\\\frac{x^2}{2}" },
  { cmd: "\\\\sqrt{x}", output: "Square root", ex: "\\\\sqrt{x+1}" },
  {
    cmd: "\\\\lim_{x \\\\to a}",
    output: "Limit notation",
    ex: "\\\\lim_{x \\\\to 0}",
  },
  { cmd: "x^{2}", output: "Superscript (power)", ex: "e^{x+1}" },
  { cmd: "x_{n}", output: "Subscript", ex: "x_{n+1}" },
  {
    cmd: "\\\\int_a^b",
    output: "Definite integral",
    ex: "\\\\int_0^1 f(x)\\\\,dx",
  },
  {
    cmd: "\\\\sum_{k=1}^{n}",
    output: "Summation",
    ex: "\\\\sum_{k=1}^{n} k^2",
  },
  { cmd: "\\\\infty", output: "Infinity symbol", ex: "x \\\\to \\\\infty" },
  { cmd: "\\\\cdot", output: "Multiplication dot", ex: "a \\\\cdot b" },
  { cmd: "\\\\pm", output: "Plus-or-minus", ex: "x = \\\\pm 3" },
  {
    cmd: "\\\\leq, \\\\geq",
    output: "Less/greater or equal",
    ex: "0 \\\\leq x \\\\leq 1",
  },
  {
    cmd: "\\\\approx",
    output: "Approximately equal",
    ex: "\\\\pi \\\\approx 3.14",
  },
  { cmd: "\\\\neq", output: "Not equal", ex: "x \\\\neq 0" },
  {
    cmd: "\\\\left( \\\\right)",
    output: "Auto-sized brackets",
    ex: "\\\\left( \\\\frac{a}{b} \\\\right)",
  },
  {
    cmd: "\\\\dfrac{a}{b}",
    output: "Display-size fraction",
    ex: "Use in display math for readability",
  },
  {
    cmd: "\\\\text{word}",
    output: "Roman text inside math",
    ex: "\\\\text{where } x > 0",
  },
];

const PIPELINE_ROWS = [
  {
    field: "expression",
    where: "math.examples[].steps[].expression",
    pipeline: "KatexBlock",
    rules:
      "Pure LaTeX. No $…$ delimiters. Backslashes must be doubled in JS strings.",
    example: '"\\\\frac{x^2 - 1}{x - 1}"',
  },
  {
    field: "annotation",
    where: "math.examples[].steps[].annotation",
    pipeline: "parseProse()",
    rules:
      "Mixed prose + math. Wrap EVERY math fragment in $…$. Use **bold**. Write prose, not \\\\n lists.",
    example: '"Substitute $x = 2$ and simplify: **Result** is $3$."',
  },
  {
    field: "Prose fields",
    where: "intuition.text, rigor.text, hook.realWorldContext",
    pipeline: "MarkdownProse",
    rules:
      "Full Markdown + KaTeX. $…$ for inline math, \\[…\\] or $$…$$ for display math. GFM supported.",
    example:
      '"The **limit** $\\\\lim_{x\\\\to 0} \\\\frac{\\\\sin x}{x} = 1$."',
  },
];

export function SectionFormatting() {
  const [activeTab, setActiveTab] = useState("rules");
  const tabs = [
    { id: "rules", label: "Rules & Examples" },
    { id: "pipeline", label: "Which Renderer?" },
    { id: "cheatsheet", label: "LaTeX Cheat Sheet" },
  ];
  return (
    <div>
      <SectionHeading sub="How to write math, bold, and formatted text in lesson files.">
        Formatting Guide
      </SectionHeading>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${activeTab === t.id ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "rules" && (
        <div>
          <H3>Rule 1 — Double every backslash in JS strings</H3>
          <Para>
            LaTeX commands begin with <Cb>\</Cb>. Inside a JavaScript string, a
            single backslash is an escape character — it does NOT produce a
            backslash in the output. Always write two backslashes.
          </Para>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
              <div className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
                ✗ Wrong
              </div>
              <CodeBlock>{`expression: "\\frac{1}{x}"
// ↑ \\f is a form-feed character
// KaTeX renders garbage or crashes`}</CodeBlock>
            </div>
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
              <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-2">
                ✓ Correct
              </div>
              <CodeBlock>{`expression: "\\\\frac{1}{x}"
// ↑ \\\\ in JS string = \\ delivered to KaTeX
// KaTeX renders: ½ fraction`}</CodeBlock>
            </div>
          </div>

          <H3>Rule 2 — Wrap annotation math in $…$</H3>
          <Para>
            The <Cb>annotation</Cb> field uses <Cb>parseProse()</Cb>, which
            renders math only where you put <Cb>$</Cb> delimiters. Bare LaTeX
            commands without delimiters appear as raw text.
          </Para>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
              <div className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
                ✗ Wrong
              </div>
              <CodeBlock>{`annotation: "Substitute \\\\frac{1}{2}"
// Renders as literal text: Substitute \\frac{1}{2}`}</CodeBlock>
            </div>
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
              <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-2">
                ✓ Correct
              </div>
              <CodeBlock>{`annotation: "Substitute $\\\\frac{1}{2}$"
// Renders: Substitute [rendered fraction]`}</CodeBlock>
            </div>
          </div>

          <H3>Rule 3 — No \\n for line breaks in annotations</H3>
          <Para>
            The <Cb>\\n</Cb> character collapses to a space in HTML. Write
            annotations as natural flowing prose. Use <Cb>**Step 1:**</Cb>{" "}
            inline rather than separate lines for multi-step explanations.
          </Para>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
              <div className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
                ✗ Wrong
              </div>
              <CodeBlock>{`annotation: "Step 1: factor\\nStep 2: cancel"
// Renders as: Step 1: factor Step 2: cancel`}</CodeBlock>
            </div>
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
              <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-2">
                ✓ Correct
              </div>
              <CodeBlock>{`annotation: "**Step 1:** factor $(x-1)$, then **Step 2:** cancel the common term."
// Renders bold labels inline with flowing prose`}</CodeBlock>
            </div>
          </div>

          <H3>Rule 4 — No Unicode math symbols</H3>
          <Para>
            Unicode superscripts and subscripts (x², x³, x₁, x₂) are NOT LaTeX —
            KaTeX cannot process them as math. Use LaTeX syntax inside{" "}
            <Cb>$…$</Cb> instead.
          </Para>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-4">
            <div className="grid grid-cols-3 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
              <span>Avoid (Unicode)</span>
              <span>Use instead (LaTeX)</span>
              <span>In a string</span>
            </div>
            {[
              ["x²", "$x^2$", '"$x^2$"'],
              ["x³", "$x^3$", '"$x^3$"'],
              ["x₁", "$x_1$", '"$x_1$"'],
              ["x₂", "$x_2$", '"$x_2$"'],
              ["π", "$\\pi$", '"$\\\\pi$"'],
              ["→", "$\\to$", '"$\\\\to$"'],
            ].map(([bad, good, str], i) => (
              <div
                key={i}
                className={`grid grid-cols-3 gap-3 px-3 py-2 text-xs border-b border-slate-100 dark:border-slate-800 last:border-0 ${i % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-slate-900/30"}`}
              >
                <span className="text-red-500 dark:text-red-400 font-mono">
                  {bad}
                </span>
                <span className="text-green-600 dark:text-green-400 font-mono">
                  {good}
                </span>
                <code className="text-slate-500 dark:text-slate-400 font-mono">
                  {str}
                </code>
              </div>
            ))}
          </div>

          <H3>Text formatting in annotations and prose</H3>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-4">
            <div className="grid grid-cols-3 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
              <span>Syntax</span>
              <span>Effect</span>
              <span>Example</span>
            </div>
            {[
              ["$…$", "Inline math (KaTeX)", '"$f(x) = x^2$"'],
              [
                "\\[…\\]",
                "Display / block math",
                '"\\\\[\\\\int_0^1 x\\\\,dx\\\\]"',
              ],
              ["**text**", "Bold", '"**Prerequisite:**"'],
              ["*text*", "Italic", '"*Note:*"'],
              ["`text`", "Inline code (prose only)", '"`parseProse`"'],
            ].map(([syn, effect, ex], i) => (
              <div
                key={i}
                className={`grid grid-cols-3 gap-3 px-3 py-2.5 text-xs border-b border-slate-100 dark:border-slate-800 last:border-0 ${i % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-slate-900/30"}`}
              >
                <code className="font-mono text-teal-600 dark:text-teal-400">
                  {syn}
                </code>
                <span className="text-slate-600 dark:text-slate-400">
                  {effect}
                </span>
                <code className="font-mono text-slate-400">{ex}</code>
              </div>
            ))}
          </div>

          <Note color="amber">
            <strong>Template literal tip:</strong> Use backtick strings (
            <Cb>{`\`...\``}</Cb>) for long multi-line prose fields. Inside a
            template literal, backslashes still need doubling:{" "}
            <Cb>\{"\\\\"}frac</Cb> not <Cb>\{"\\"}frac</Cb>.
          </Note>
        </div>
      )}

      {activeTab === "pipeline" && (
        <div>
          <Para>
            Different fields in a lesson file go through different rendering
            pipelines. Each pipeline has different rules.
          </Para>
          <div className="space-y-3">
            {PIPELINE_ROWS.map((row, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                  <code className="font-mono text-sm font-bold text-brand-600 dark:text-brand-400">
                    {row.field}
                  </code>
                  <span className="text-xs text-slate-400 font-mono">
                    {row.where}
                  </span>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300">
                    {row.pipeline}
                  </span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {row.rules}
                  </p>
                  <CodeBlock>{row.example}</CodeBlock>
                </div>
              </div>
            ))}
          </div>
          <Note color="blue">
            <strong>Quick rule:</strong> If the field name contains "expression"
            or "latex" — no delimiters. If the field name is "annotation" — use{" "}
            <Cb>$…$</Cb>. Everything else (long prose) — full Markdown.
          </Note>
        </div>
      )}

      {activeTab === "cheatsheet" && (
        <div>
          <Para>
            Common LaTeX commands for lesson writing. Remember to double all
            backslashes inside JS strings.
          </Para>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-4">
            <div className="grid grid-cols-3 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
              <span>Command (in LaTeX)</span>
              <span>What it renders</span>
              <span>Example usage</span>
            </div>
            {LATEX_CHEATSHEET.map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-3 gap-3 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 ${i % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-slate-900/30"}`}
              >
                <code className="font-mono text-xs text-teal-600 dark:text-teal-400 break-all">
                  {row.cmd}
                </code>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {row.output}
                </span>
                <code className="font-mono text-xs text-slate-400 break-all">
                  {row.ex}
                </code>
              </div>
            ))}
          </div>
          <Note color="green">
            <strong>In a JS string:</strong> every <Cb>\</Cb> in the LaTeX
            column above becomes <Cb>\\</Cb>. So <Cb>{"\\frac"}</Cb> → write{" "}
            <Cb>{"\\\\frac"}</Cb> in your file.
          </Note>
          <H3>Full worked example</H3>
          <CodeBlock>{`// In a math example step:
{
  expression: "\\\\frac{x^2 - 1}{x - 1}",       // KatexBlock — no $
  annotation: "Factor the numerator: $(x-1)(x+1)$, "
            + "then cancel **the common** $(x-1)$ term.",
}

// In a prose field (template literal, so no extra escaping needed):
intuition: {
  text: \`The **limit** $\\\\lim_{x \\\\to 1} \\\\frac{x^2-1}{x-1} = 2$
is found by factoring, even though direct substitution gives $\\\\frac{0}{0}$.\`,
},`}</CodeBlock>
        </div>
      )}
    </div>
  );
}
