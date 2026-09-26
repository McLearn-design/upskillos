// The Help modal's "AIPrompts" section. Split out of src/components/ui/HelpModal.jsx.

import { useState } from "react";
import { ClipboardCopy } from "lucide-react";
import { H3, Para, SectionHeading } from "../primitives.jsx";

// ─── SECTION: AI PROMPTS ─────────────────────────────────────────────────────

const AI_PROMPTS = [
  {
    id: "math-lesson",
    label: "Math Lesson",
    color: "blue",
    prompt: `You are generating a lesson for open-calc, an interactive math/STEM platform.

The lesson is a JS file with one default export. File goes in:
  src/courses/{course-id}/{N}-{chapter-slug}/{NNN}-{lesson-slug}.js

Example: src/courses/calculus/3-derivatives/006-product-rule.js

export default {
  id: 'product-rule',              // kebab-case, globally unique (no chapter prefix)
  slug: 'product-rule',            // same as id — used in the URL
  chapter: 3,                      // integer — the leading N in the chapter folder name
  order: 6,                        // integer position within chapter (matches NNN prefix)
  title: 'The Product Rule',
  subtitle: 'One-line plain-English description',
  tags: ['calculus', 'derivatives', 'product-rule'], // lowercase, hyphenated

  hook: {
    question: 'How do you differentiate a product of two functions?',
    realWorldContext: 'One paragraph explaining real-world relevance.',
    previewVisualizationId: 'SecantToTangent', // optional — omit if none
  },

  mentalModel: ['Key takeaway 1.', 'Key takeaway 2.'],

  // triggers: flash-card style recall cues (optional but recommended)
  triggers: [
    { prompt: 'Differentiate f(x)·g(x)', recall: "f'g + fg' — first times derivative of second plus second times derivative of first" },
  ],

  // spiral: links to prerequisite and follow-on lessons (optional but recommended)
  spiral: {
    recoveryPoints: [
      { label: 'Derivative Definition (Lesson 1)', note: 'Review if the limit definition feels shaky.' },
    ],
    futureLinks: [
      { label: 'Quotient Rule (Next Lesson)', note: 'The quotient rule is derived from the product rule.' },
    ],
  },

  intuition: {
    // semantics: symbol glossary — what every variable and notation means (optional)
    semantics: {
      core: [
        { symbol: 'f(x)', meaning: 'first factor' },
        { symbol: 'g(x)', meaning: 'second factor' },
      ],
      rulesOfThumb: [
        "You can't just multiply the individual derivatives — try f=x², g=x² and verify.",
      ],
    },
    // blocks: ordered content blocks — mix prose, images, and visualizations
    blocks: [
      {
        type: 'prose',
        paragraphs: [
          'Paragraph 1 in plain English. No LaTeX here.',
          'Paragraph 2.',
        ],
      },
      // { type: 'image', src: importedSvgUrl, alt: 'Alt text', caption: 'Caption.' },
      // { type: 'viz',   id: 'SecantToTangent', title: 'Display title', props: {} },
      // { type: 'callout', calloutType: 'important', title: 'Key idea', body: 'Explanation.' },
    ],
  },

  examples: [
    {
      title: 'Example: Power functions',
      problem: 'Find the derivative of f(x) = x² · x³.',
      solution: 'Apply the product rule: f\'g + fg\'.',
      latex: 'f\'(x)=2x \\\\cdot x^3 + x^2 \\\\cdot 3x^2 = 5x^4',
    },
  ],

  checkpoints: ['read-intuition'],
  quiz: [
    {
      id: 'q1',
      type: 'choice',
      text: 'The product rule states that (fg)\\'(x) equals…',
      options: ["f'g + fg'", "f'g'", "f'(x) · g'(x)", "(f+g)'"],
      answer: 0, // 0-indexed correct answer
      explanation: 'Because the derivative distributes across a product as f\'g + fg\'.',
    },
  ],
};

RULES:
- id and slug are the same short kebab-case string — NO chapter prefix, no numbers
- chapter is an integer matching the leading N in the chapter folder name
- prose paragraphs are plain English — NO LaTeX, NO Markdown formatting
- LaTeX goes in: latex fields and callout body strings (use \\\\frac, not \\frac)
- calloutType must be one of: 'important', 'tip', 'warning'
- Do not invent visualization IDs — only use ones explicitly provided to you
- triggers and spiral are optional but strongly recommended for completeness
- id must be unique across the entire codebase`,
  },
  {
    id: "js-playground",
    label: "JS Notebook Lesson",
    color: "amber",
    prompt: `You are generating an interactive JS coding lesson for open-calc using the JSNotebook component.

The file has TWO parts — a notebook cells const, then a lesson metadata export.

PART 1 — Notebook cells (define at module top level):

const LESSON_MY_TOPIC = {
  title: 'Lesson Title',
  subtitle: 'One-line description',
  sequential: true,
  cells: [
    // MARKDOWN cell — explanation/context only, no code
    {
      type: 'markdown',
      instruction: '## Section heading\n\nExplanation prose. Use **bold** for emphasis.',
    },
    // JS cell — live runnable code
    {
      type: 'js',
      instruction: 'What this cell teaches (use backtick code spans for keywords).',
      html: '<div id="output"></div>',
      css: 'body { background: #0f172a; color: #e2e8f0; padding: 12px; font-family: monospace; }',
      startCode: '// Starter code the student sees and can run',
      outputHeight: 300,
    },
    // CHALLENGE cell — student fills in blanks
    {
      type: 'challenge',
      instruction: '**Challenge:** Complete the function...',
      html: '<div id="result"></div>',
      css: 'body { background: #0f172a; color: #e2e8f0; padding: 12px; }',
      startCode: '// Scaffold with YOUR CODE HERE comments',
      solutionCode: '// The complete working solution',
      check: (code) => /expectedPattern/.test(code),
      successMessage: 'Correct! Here is why it works.',
      failMessage: 'Check X and Y in your code.',
      outputHeight: 400,
    },
  ],
};

PART 2 — Lesson metadata export:

// File goes in: src/courses/{course-id}/{N}-{chapter-slug}/{NNN}-{lesson-slug}.js
// Example: src/courses/tetris/1-build-tetris/002-tetris-describing-a-piece.js

export default {
  id: 'tetris-02-describing-a-piece',   // unique kebab-case id
  slug: 'tetris-describing-a-piece',    // used in the URL
  chapter: 1,                           // integer — leading N in the chapter folder name
  order: 2,                             // integer position within chapter (matches NNN)
  title: 'Describing a Piece',
  subtitle: '...',
  tags: ['javascript', 'arrays'],
  hook: { question: '...', realWorldContext: '...', previewVisualizationId: 'JSNotebook' },
  intuition: {
    prose: ['...'],
    callouts: [],
    visualizations: [{ id: 'JSNotebook', title: 'Lesson display title', props: { lesson: LESSON_MY_TOPIC } }],
  },
  math: { prose: [], callouts: [], visualizations: [] },
  rigor: { prose: [], callouts: [], visualizations: [] },
  examples: [],
  challenges: [],
  mentalModel: ['Takeaway 1.', 'Takeaway 2.'],
  checkpoints: ['read-intuition'],
  quiz: [],
};

RULES:
- sequential: true means later cells can use variables declared in earlier cells
- Every js/challenge cell must have: html, css, startCode, outputHeight
- Every challenge cell must also have: solutionCode, check(), successMessage, failMessage
- CSS uses dark theme by default: background #0f172a, text #e2e8f0
- check() receives the student's full code as a string — use regex to verify key patterns
- Keep each cell focused on ONE concept
- Don't import anything — the notebook environment provides the browser globals`,
  },
  {
    id: "viz-component",
    label: "New Viz Component",
    color: "violet",
    prompt: `═══════════════════════════════════════════════
FILL THIS IN — replace before sending
═══════════════════════════════════════════════
TOPIC: [e.g. "The unit circle — interactive, drag the angle point around the circle and watch sin/cos/tan update live"]
STYLE: [canvas (D3 SVG math graph) | prose (sliders, toggles, step-through panels) | both]

═══════════════════════════════════════════════
WHAT YOU ARE BUILDING
═══════════════════════════════════════════════
A self-contained React component that teaches one math/STEM concept visually and interactively.
It renders inside a lesson card — roughly 300–500px tall, full container width.
Students interact with it: drag points, move sliders, step through stages, watch values update live.
The goal is to make the concept physically tangible — not just a static diagram.

File: src/components/viz/react/MyComponent.jsx
One file, one default export. No TypeScript. Vite + React 18 + JSX.
Props: ({ params = {} }) — params is optional config from the lesson.

═══════════════════════════════════════════════
DARK MODE — copy this hook verbatim into the file
═══════════════════════════════════════════════
function useIsDark() {
  const isDark = () => document.documentElement.classList.contains('dark');
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(isDark()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
// In draw() or render: const dark = useIsDark();
// Then produce a color object branching on dark, e.g.:
// const C = {
//   bg:    dark ? '#0f172a' : '#ffffff',   // slate-900 / white
//   panel: dark ? '#1e293b' : '#f1f5f9',   // slate-800 / slate-100
//   axis:  dark ? '#475569' : '#94a3b8',   // slate-600 / slate-400
//   curve: dark ? '#38bdf8' : '#0284c7',   // sky-400 / sky-600
//   accent:dark ? '#34d399' : '#059669',   // emerald-400 / emerald-600
//   warn:  dark ? '#fbbf24' : '#d97706',   // amber-400 / amber-600
//   point: dark ? '#f472b6' : '#db2777',   // pink-400 / pink-700
//   text:  dark ? '#94a3b8' : '#64748b',   // slate-400 / slate-500
// };

═══════════════════════════════════════════════
CSS VARIABLES (defined in the app — safe to use)
═══════════════════════════════════════════════
var(--color-surface)     // #ffffff light / #0f172a dark — card background
var(--color-border)      // #e2e8f0 light / #334155 dark — borders
var(--color-text-muted)  // #64748b light / #94a3b8 dark — captions

═══════════════════════════════════════════════
CANVAS PATTERN — for math graphs, geometry, animations
═══════════════════════════════════════════════
import { useRef, useEffect, useState } from 'react';

export default function MyComponent({ params = {} }) {
  const dark = useIsDark();
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [value, setValue] = useState(1); // example slider state

  useEffect(() => {
    const draw = () => {
      const C = { bg: dark ? '#0f172a' : '#ffffff', curve: dark ? '#38bdf8' : '#0284c7' /* etc */ };
      const W = containerRef.current?.clientWidth || 480;
      const H = 260;
      // d3 is available globally — do NOT import it
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();
      svg.attr('width', W).attr('height', H);
      // build scales, draw axes, paths, circles...
    };
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    draw();
    return () => ro.disconnect();
  }, [dark, value]); // re-draw on theme change OR state change

  return (
    <div ref={containerRef} style={{ padding: 12 }}>
      <input type="range" min={0} max={10} step={0.1} value={value}
        onChange={e => setValue(+e.target.value)} style={{ width: '100%', accentColor: '#38bdf8' }} />
      <svg ref={svgRef} style={{ width: '100%', display: 'block', borderRadius: 8,
        background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
    </div>
  );
}

═══════════════════════════════════════════════
PROSE + TOGGLES PATTERN — for step-through, comparisons, interactive panels
═══════════════════════════════════════════════
export default function MyComponent({ params = {} }) {
  const dark = useIsDark();
  const [step, setStep] = useState(0);
  const panel = dark ? '#1e293b' : '#f1f5f9';
  const border = dark ? '#334155' : '#e2e8f0';
  const text   = dark ? '#e2e8f0' : '#1e293b';
  const muted  = dark ? '#94a3b8' : '#64748b';

  const steps = ['Step 1 content', 'Step 2 content', 'Step 3 content'];
  return (
    <div style={{ background: panel, borderRadius: 12, padding: 16, border: \`1px solid \${border}\` }}>
      <p style={{ color: text, fontSize: 14 }}>{steps[step]}</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={() => setStep(s => Math.max(0, s - 1))}
          style={{ padding: '6px 14px', borderRadius: 6, background: dark ? '#334155' : '#e2e8f0', color: text, border: 'none', cursor: 'pointer' }}>← Back</button>
        <button onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))}
          style={{ padding: '6px 14px', borderRadius: 6, background: '#0284c7', color: '#fff', border: 'none', cursor: 'pointer' }}>Next →</button>
      </div>
    </div>
  );
}

═══════════════════════════════════════════════
AVAILABLE GLOBALS (do NOT import these)
═══════════════════════════════════════════════
d3    — full D3 library (scales, shapes, selections, transitions)
THREE — Three.js for 3D

═══════════════════════════════════════════════
HARD RULES
═══════════════════════════════════════════════
- No CSS files, no CSS modules, no styled-components — inline styles only
- No document.querySelector outside useEffect
- No height: 100vh — use natural heights
- Always return a cleanup: () => { ro.disconnect(); cancelAnimationFrame(raf); }
- Under 500 lines. All sub-components in the same file.
- No TypeScript, no prop-types`,
  },
  {
    id: "new-course",
    label: "New Course",
    color: "green",
    prompt: `You are adding a new course to open-calc. The course system auto-discovers content — NO manual registration in any index or courses file is needed.

DIRECTORY STRUCTURE
src/courses/{course-id}/                    ← course root
  meta.json                                 ← course metadata (required)
  {N}-{chapter-slug}/                       ← one folder per chapter
    {NNN}-{lesson-slug}.js                  ← one file per lesson

Example for a new "statistics" course, chapter 1 "Probability", lesson 1:
  src/courses/statistics/meta.json
  src/courses/statistics/1-probability/001-probability-intro.js

STEP 1 — Create src/courses/{course-id}/meta.json
{
  "icon": "📊",
  "description": "One sentence describing the course.",
  "domain": "math"
}
domain options: "math" | "cs" | "science" | "engineering" | "creative" | "other"

STEP 2 — Create the chapter folder and first lesson
Folder: src/courses/{course-id}/1-{chapter-slug}/
File:   src/courses/{course-id}/1-{chapter-slug}/001-{lesson-slug}.js

Use the Math Lesson schema for the lesson export. Key fields:
  chapter: 1          // integer matching the leading N in the chapter folder name
  order: 1            // integer matching the leading NNN in the filename
  id: 'lesson-slug'   // kebab-case, no chapter prefix, globally unique

STEP 3 — Add additional chapters and lessons as needed
Each new N-{chapter-slug}/ folder is a new chapter.
Each new NNN-{lesson-slug}.js inside it is a new lesson.
courseLoader.js auto-discovers all of them via import.meta.glob.

STEP 4 (only if lessons use new viz components) — Register in VizFrame.jsx
Add the import and a case in the viz switch. Otherwise skip this step.

VALIDATION: Run npm run dev and navigate to /courses to confirm the course appears.
  ✔ Course card shows on the courses page
  ✔ Chapter and lesson nav renders correctly
  ✔ "npm run build" completes with no errors`,
  },
];

export function SectionAIPrompts() {
  const [active, setActive] = useState("math-lesson");
  const [copied, setCopied] = useState(false);
  const prompt = AI_PROMPTS.find((p) => p.id === active);

  const copy = () => {
    navigator.clipboard.writeText(prompt.prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const colorMap = {
    blue: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    amber:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    violet:
      "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800",
    green:
      "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  };

  return (
    <div>
      <SectionHeading sub="Paste into any AI assistant. It already knows the rules.">
        AI Generation Prompts
      </SectionHeading>

      <Para>
        These prompts encode open-calc conventions — the exact lesson schema,
        JSNotebook cell format, viz registration steps, and build validation
        commands. Paste one into ChatGPT, Claude, or Copilot Chat and describe
        what you want to build.
      </Para>

      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 mb-5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <span className="font-bold text-amber-700 dark:text-amber-400">
          Why a prompt?
        </span>{" "}
        AI-generated files often deviate from project structure — wrong schema
        fields, bad import paths, invented viz IDs. These prompts front-load the
        rules so the AI follows them from the first response.
      </div>

      {/* Selector tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {AI_PROMPTS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setActive(p.id);
              setCopied(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              active === p.id
                ? colorMap[p.color]
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Prompt display */}
      <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-700">
          <span className="text-xs font-mono text-slate-400">
            {prompt?.label} prompt
          </span>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600"
          >
            <ClipboardCopy className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Copy prompt"}
          </button>
        </div>
        <pre className="px-4 py-4 text-xs text-slate-300 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
          {prompt?.prompt}
        </pre>
      </div>

      <H3>How to use</H3>
      <ol className="space-y-3 mt-3">
        {[
          "Pick the prompt matching what you want to build: Math Lesson, JS Notebook, Viz Component, or New Course.",
          "Click Copy and paste the prompt into your AI chat as the first message (system prompt or opening context).",
          'Describe your request: "Write a lesson on the chain rule with 3 worked examples" or "Build an interactive pendulum for the physics course."',
          "Review the AI output against the schema. Check: chapter matches, id is unique, no extra fields, viz IDs are real.",
          "Run npm run build and watch for [open-calc validator] warnings. Fix any chapter mismatches before committing.",
        ].map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {step}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
