// Downloadable lesson and visualization templates offered by the Help modal. Split out of src/components/ui/HelpModal.jsx.



// ─── TEMPLATE STRINGS ────────────────────────────────────────────────────────

export const TPL_MATH = `// math-lesson-template.js
// ================================================================
// MATH / CALCULUS LESSON TEMPLATE  —  open-calc
// ================================================================
// Lines starting with // are INSTRUCTIONS. Delete when done.
// ================================================================

export default {

  // ── IDENTITY (REQUIRED) ─────────────────────────────────────
  id: 'ch1-your-topic',
  //  ^ Unique label. Format: ch{N}-topic-name
  //    Example: 'ch0-real-numbers'   'ch3-chain-rule'
  //    IMPORTANT: Must be unique — no two lessons share one.

  slug: 'your-topic',
  //   ^ Appears in the URL: /chapter/1/your-topic

  chapter: 1,
  //       ^ Chapter NUMBER. Must match chapter file exactly.

  order: 0,
  //     ^ Position in chapter list (0 = first).

  title: 'Your Lesson Title',
  subtitle: 'One sentence describing what this teaches.',
  tags: ['keyword1', 'keyword2'],

  // ── HOOK ────────────────────────────────────────────────────
  hook: {
    question: 'What question does this lesson answer?',
    realWorldContext: 'One or two sentences of real-world motivation.',
  },

  // ── INTUITION ───────────────────────────────────────────────
  intuition: {
    text: \`
Write your explanation here.

Formatting: **bold** *italic* \\\`code\\\` $f(x)$ inline math $display math$

Tip: Explain the concept as if talking to a curious 16-year-old.
Don't introduce the formula yet — build the IDEA first.
    \`,

    visualizations: [
      // { id: 'ComponentName', props: {} }
      // Common: PythonNotebook, JSNotebook, RiemannSum, UnitCircle
    ],
  },

  // ── FORMAL MATH (optional) ──────────────────────────────────
  math: {
    definition: 'Formal statement. LaTeX: $f\'(x) = \\\\lim_{h \\\\to 0} \\\\frac{f(x+h)-f(x)}{h}$',
    examples: [
      {
        problem:  'Find the derivative of $f(x) = x^2$.',
        solution: 'Using the power rule: $f\'(x) = 2x$.',
      },
    ],
  },

  // ── UNDERSTANDING CHECK (ungraded) ───────────────────────────
  assessment: {
    questions: [
      {
        question: 'In your own words, what does this concept mean?',
        answer:   'Expected answer here.',
        hint:     'Think about... (a nudge toward the answer)',
      },
    ],
  },

  // ── SCORED QUIZ ──────────────────────────────────────────────
  quiz: {
    questions: [
      {
        question: 'What is the derivative of $x^3$?',
        answer:   '$3x^2$',
        hints: [
          'Try the power rule.',
          'Multiply by the exponent, then reduce it by 1.',
        ],
      },
    ],
  },

}
`;

export const TPL_PYTHON = `// python-lesson-template.js
// ================================================================
// PYTHON / CODING LESSON TEMPLATE  —  open-calc
// ================================================================

export default {
  id: 'py1-your-topic',
  slug: 'your-topic',
  chapter: 1,
  order: 0,
  title: 'Your Python Lesson Title',
  subtitle: 'What will students build or learn to do?',
  tags: ['python', 'your-topic'],

  hook: {
    question: 'What will students be able to do by the end of this?',
    realWorldContext: 'Why is this Python skill useful in the real world?',
  },

  intuition: {
    text: \`
Explain the concept here — BEFORE any code.

What is the big idea? What problem are we solving?
Then the notebook below lets students try it themselves.
    \`,
    visualizations: [
      // PythonNotebook adds an interactive Python editor right here.
      //
      // THE CELLS MUST LIVE IN props.initialCells.
      // normalizeViz() keeps only { id, initialProps, props, title, caption,
      // mathBridge } off this entry, so a \`cells:\` written at the top level
      // of it is dropped — and the notebook then renders its built-in
      // STARTER_CELLS instead. You get a working notebook containing somebody
      // else's content, with no error anywhere. 58 lessons had this.
      //
      // \`id\` is required. Without it the whole entry is discarded.
      {
        id: 'PythonNotebook',
        title: 'Optional heading shown above the notebook',
        caption: 'Optional line under it — say what to run and in what order.',
        props: {
          initialCells: [
            {
              id: 1,
              cellTitle: 'What this cell demonstrates',
              prose: [
                'One short paragraph per entry. Say what the code does and what to watch for.',
                'Ask for a prediction before the cell is run — that is what makes it a lesson.',
              ],
              code: [
                'import numpy as np',
                '',
                'print(np.arange(5) ** 2)',
              ].join('\n'),
            },
            {
              id: 2,
              cellTitle: 'Cells share one namespace, in order',
              prose: ['Anything cell 1 defined is still here.'],
              code: 'print("cell 2 can use cell 1\'s variables")',
            },
          ],
        },
      },
    ],
  },

  assessment: {
    questions: [
      {
        question: 'What does this code print?  print(2 ** 10)',
        answer: '1024',
        hint: '** is the Python exponentiation operator.',
      },
    ],
  },

  quiz: {
    questions: [
      {
        question: 'How do you define a function in Python?',
        answer: 'Use: def function_name(parameters): then indent the body.',
        hints: ['Start with the keyword: def', 'def add(a, b): return a + b'],
      },
    ],
  },
}
`;

export const TPL_PROOF = `// proof-lesson-template.js
// ================================================================
// PROOF / GEOMETRY LESSON TEMPLATE  —  open-calc
// ================================================================

export default {
  id: 'geo1-your-proof',
  slug: 'your-proof',
  chapter: 1,
  order: 0,
  title: 'Your Theorem Name',
  subtitle: 'What surprising result does this prove?',
  tags: ['proof', 'geometry', 'theorem'],

  hook: {
    question: 'What surprising or useful result are we about to prove?',
    realWorldContext: 'Where is this theorem used in the real world?',
  },

  intuition: {
    text: \`
Before the proof, explain WHY this result should be true.

Draw a picture in words. Walk the student through the
geometric or intuitive argument first.
    \`,
    visualizations: [],
  },

  math: {
    definition: \`
**Theorem:** State the theorem formally here.

**Given:** What we are starting with (the hypothesis).

**Prove:** What we need to show (the conclusion).
    \`,
    examples: [],
  },

  rigor: {
    text: \`
**Proof:**

**Step 1:** First step.
*Justification: why this step is valid.*

**Step 2:** Second step. ...

**Therefore:** Final conclusion. $\\\\square$
    \`,
    examples: [],
  },

  assessment: {
    questions: [
      {
        question: 'Can you state the theorem in your own words?',
        answer: 'Student should describe the core result in plain language.',
        hint: 'Focus on what the theorem guarantees, not the proof steps.',
      },
    ],
  },
}
`;

export const TPL_VIZ = `// MyVizComponent.jsx
// ================================================================
// VIZ COMPONENT (prose + toggles)  —  open-calc
// ================================================================

import { useState, useEffect } from 'react'
import { useThemeColors } from '../../../hooks/useThemeColors'
// ── COLORS HOOK: shared across every viz — import it, don't copy it. ──
// (Adding a color? Edit src/hooks/useThemeColors.js once and every viz gets it.)

// IMPORTANT: Function name must EXACTLY match filename and VizFrame.jsx key.
export default function MyVizComponent({ params = {} }) {
  const C = useThemeColors()

  return (
    <div style={{ fontFamily: 'var(--font-sans)', padding: '.5rem 0', maxWidth: 740 }}>
      <div style={{ background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 12, padding: '16px 20px' }}>
        <p style={{ color: C.text, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
          Replace this with your content.
        </p>
      </div>
    </div>
  )
}

// NEXT STEPS:
// 1. Register in VizFrame.jsx:
//    MyVizComponent: lazy(() => import('./react/MyVizComponent.jsx')),
// 2. Use in a lesson:
//    visualizations: [{ id: 'MyVizComponent', props: {} }]
`;

export const TPL_CANVAS = `// MyCanvasViz.jsx
// ================================================================
// VIZ COMPONENT (HTML5 Canvas)  —  open-calc
// ================================================================

import { useState, useEffect, useRef } from 'react'
import { useThemeColors } from '../../../hooks/useThemeColors'
// ── COLORS HOOK: shared across every viz — import it, don't copy it. ──
// (Adding a color? Edit src/hooks/useThemeColors.js once and every viz gets it.)

function MyCanvas({ value, C }) {
  const canvasRef = useRef(null)  // PART A: named canvasRef (not ref or cvRef)
  const roRef     = useRef(null)  // PART B: ResizeObserver ref

  useEffect(() => {
    const draw = () => {
      const cv = canvasRef.current
      if (!cv) return

      // PART C: set dimensions INSIDE draw(), every time
      const canvasW = cv.offsetWidth || 500
      const canvasH = 300
      cv.width  = canvasW
      cv.height = canvasH

      const ctx = cv.getContext('2d')
      const pl = 50, pr = 20, pt = 20, pb = 40
      const iw = canvasW - pl - pr
      const canvasIH = canvasH - pt - pb  // NOTE: not 'ih' or 'H'

      const xMax = 10, yMax = 100
      const toX = v => pl + (v / xMax) * iw
      const toY = v => pt + canvasIH - (v / yMax) * canvasIH

      ctx.clearRect(0, 0, canvasW, canvasH)

      ctx.strokeStyle = C.blue
      ctx.lineWidth = 2.5
      ctx.beginPath()
      for (let x = 0; x <= xMax; x += 0.1) {
        const y = x * x
        if (x === 0) ctx.moveTo(toX(x), toY(y))
        else         ctx.lineTo(toX(x), toY(y))
      }
      ctx.stroke()

      const dotX = toX(value), dotY = toY(value * value)
      ctx.fillStyle = C.amber
      ctx.beginPath()
      ctx.arc(dotX, dotY, 6, 0, Math.PI * 2)
      ctx.fill()
    }

    draw()
    // PART D: observe parentElement (not the canvas itself!)
    roRef.current = new ResizeObserver(draw)
    roRef.current.observe(canvasRef.current.parentElement)
    // PART E: cleanup (prevents memory leak)
    return () => { roRef.current?.disconnect(); roRef.current = null }
  }, [value, C])  // ALL variables used in draw() must be in deps

  return <canvas ref={canvasRef} style={{ width: '100%', display: 'block', borderRadius: 8 }} />
}

export default function MyCanvasViz({ params = {} }) {
  const C = useThemeColors()
  const [value, setValue] = useState(5)

  return (
    <div style={{ fontFamily: 'var(--font-sans)', padding: '.5rem 0', maxWidth: 740 }}>
      <div style={{ background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 12, overflow: 'hidden' }}>
        <MyCanvas value={value} C={C} />
      </div>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: C.muted }}>Value</span>
        <input type="range" min={0} max={10} step={0.1} value={value}
          onChange={e => setValue(Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: C.text, minWidth: 32 }}>
          {value.toFixed(1)}
        </span>
      </div>
    </div>
  )
}
`;
