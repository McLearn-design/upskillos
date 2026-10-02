// Downloadable lesson and visualization templates offered by the Help modal. Split out of src/components/ui/HelpModal.jsx.



// ─── TEMPLATE STRINGS ────────────────────────────────────────────────────────

export const TPL_MATH = `// math-lesson-template.js
// ================================================================
// MATH LESSON TEMPLATE  —  UpSkillOS
// ================================================================
// Save as src/courses/<course>/<N>-<chapter>/<NNN>-<slug>.js
// e.g.     src/courses/calculus/3-derivatives/005-chain-rule.js
// The folder sets the course and chapter, the NNN prefix sets the order in the
// chapter, and the rest of the filename is the slug in the URL
// (#/chapter/calculus-3/chain-rule). Nothing needs registering.
// Lines starting with // are instructions. Delete them when you're done.
// ================================================================

export default {
  // ── IDENTITY ──────────────────────────────────────────────────
  id: 'calc-your-topic',
  //  ^ Learners' progress is saved under this id. It must not be used by any
  //    other lesson, and must never change once the lesson is published.
  slug: 'your-topic',
  //    ^ Match the filename without its number: 005-your-topic.js -> 'your-topic'
  title: 'Your Lesson Title',
  subtitle: 'One sentence describing what this teaches.',
  tags: ['keyword1', 'keyword2'],

  // ── HOOK: the question the lesson answers ─────────────────────
  hook: {
    question: 'What question does this lesson answer?',
    realWorldContext: 'One or two sentences of real-world motivation.',
  },

  // ── INTUITION: blocks render top to bottom ────────────────────
  // Block types: prose, callout, viz, image.
  intuition: {
    blocks: [
      {
        type: 'prose',
        paragraphs: [
          'Explain the idea before the formula, as if to a curious 16-year-old.',
          'Formatting: **bold**, *italic*, \`code\`, $f(x)$ inline math, and $$\\\\int_0^1 x^2 \\\\, dx$$ on its own.',
        ],
      },
      {
        type: 'callout',
        kind: 'insight',
        title: 'The key idea',
        body: 'One sentence the learner should remember.',
      },
      // A registered visualization, by id (case-sensitive):
      // { type: 'viz', id: 'RiemannSum', props: {} },
    ],
  },

  // ── FORMAL MATH (optional) ────────────────────────────────────
  math: {
    prose: [
      "The formal statement: $f'(x) = \\\\lim_{h \\\\to 0} \\\\frac{f(x+h)-f(x)}{h}$.",
    ],
    callouts: [],
    visualizations: [],
  },

  // ── WORKED EXAMPLES (optional) ────────────────────────────────
  examples: [
    {
      id: 'ex1',
      title: 'Differentiate x²',
      problem: 'Find the derivative of $f(x) = x^2$.',
      steps: [
        { expression: "f'(x) = 2x^{2-1}", annotation: 'Power rule: bring the exponent down and subtract one.' },
        { expression: "f'(x) = 2x", annotation: 'Simplify.' },
      ],
      conclusion: "$f'(x) = 2x$.",
    },
  ],

  // ── UNDERSTANDING CHECK (not scored) ──────────────────────────
  assessment: {
    questions: [
      {
        id: 'assess-1',
        type: 'input',
        text: 'In your own words, what does this concept mean?',
        answer: 'Expected answer here.',
        hint: 'A nudge toward the answer.',
      },
    ],
  },

  // ── QUIZ (scored) ─────────────────────────────────────────────
  // An array of questions. The lesson counts as complete when every question
  // is answered correctly.
  quiz: [
    {
      id: 'q1',
      type: 'choice',
      text: 'What is the derivative of $x^3$?',
      options: ['$3x^2$', '$x^2$', '$3x^3$'],
      answer: '$3x^2$',
      //      ^ Must match one option exactly.
      hints: ['Try the power rule.', 'Multiply by the exponent, then reduce it by 1.'],
    },
    {
      id: 'q2',
      type: 'input',
      text: 'Differentiate $x^4$.',
      answer: '4*x^3',
      //      ^ Checked mathematically, so 4x^3 and 4*x^3 both count.
      hints: ['Power rule again.'],
    },
  ],
}
`;

export const TPL_PYTHON = `// python-lesson-template.js
// ================================================================
// PYTHON LESSON TEMPLATE  —  UpSkillOS
// ================================================================
// Save as src/courses/<course>/<N>-<chapter>/<NNN>-<slug>.js
// e.g.     src/courses/python/1-basics/003-your-topic.js
// Nothing needs registering: the file's location puts it in the course.
// ================================================================

export default {
  id: 'py-your-topic',
  //  ^ Unique across all lessons; never change it once published.
  slug: 'your-topic',
  title: 'Your Python Lesson Title',
  subtitle: 'What will learners build or learn to do?',
  tags: ['python', 'your-topic'],

  hook: {
    question: 'What will learners be able to do by the end of this?',
    realWorldContext: 'Why is this Python skill useful in the real world?',
  },

  intuition: {
    blocks: [
      {
        type: 'prose',
        paragraphs: [
          'Explain the concept here, before any code. What problem are we solving?',
          'The notebook below lets learners try it themselves. Ask them to predict the output before running a cell.',
        ],
      },
      {
        // An interactive Python notebook (runs in the browser with Pyodide).
        // The cells must be in props.initialCells; cells written anywhere else
        // are ignored and the notebook shows placeholder cells instead.
        type: 'viz',
        id: 'PythonNotebook',
        title: 'Optional heading shown above the notebook',
        props: {
          initialCells: [
            {
              id: 1,
              cellTitle: 'What this cell demonstrates',
              prose: ['One short paragraph per entry: what the code does and what to watch for.'],
              code: [
                'import numpy as np',
                '',
                'print(np.arange(5) ** 2)',
              ].join('\\n'),
            },
            {
              id: 2,
              cellTitle: 'Cells share one namespace, in order',
              prose: ['Anything cell 1 defined is still available here.'],
              code: "print(\\"cell 2 can use cell 1's variables\\")",
            },
          ],
        },
      },
    ],
  },

  assessment: {
    questions: [
      {
        id: 'assess-1',
        type: 'input',
        text: 'What does this code print?  print(2 ** 10)',
        answer: '1024',
        hint: '** is the Python exponentiation operator.',
      },
    ],
  },

  // A lesson with a quiz counts as complete when every question is answered correctly.
  quiz: [
    {
      id: 'q1',
      type: 'choice',
      text: 'Which keyword defines a function in Python?',
      options: ['def', 'function', 'fn', 'lambda'],
      answer: 'def',
      hints: ['It is three letters long.'],
    },
  ],
}
`;

export const TPL_PROOF = `// proof-lesson-template.js
// ================================================================
// PROOF LESSON TEMPLATE  —  UpSkillOS
// ================================================================
// Save as src/courses/<course>/<N>-<chapter>/<NNN>-<slug>.js
// e.g.     src/courses/geometry/2-reasoning-and-proof/004-your-proof.js
// Nothing needs registering: the file's location puts it in the course.
// ================================================================

export default {
  id: 'geo-your-proof',
  //  ^ Unique across all lessons; never change it once published.
  slug: 'your-proof',
  title: 'Your Theorem Name',
  subtitle: 'What surprising result does this prove?',
  tags: ['proof', 'geometry', 'theorem'],

  hook: {
    question: 'What surprising or useful result are we about to prove?',
    realWorldContext: 'Where is this theorem used in the real world?',
  },

  // Before the proof: why should this result be true?
  intuition: {
    blocks: [
      {
        type: 'prose',
        paragraphs: [
          'Draw a picture in words. Walk the learner through the geometric or intuitive argument first.',
        ],
      },
    ],
  },

  math: {
    prose: [
      '**Theorem:** State the theorem formally here.',
      '**Given:** What we start with (the hypothesis).',
      '**Prove:** What we need to show (the conclusion).',
    ],
    callouts: [],
    visualizations: [],
  },

  // The proof, one step per entry: the statement and why it holds.
  rigor: {
    prose: ['**Proof.**'],
    proofSteps: [
      { expression: 'AB = AC', annotation: 'Given: the triangle is isosceles.' },
      { expression: '\\\\angle B = \\\\angle C', annotation: 'Base angles of an isosceles triangle are equal.' },
    ],
    callouts: [],
    visualizations: [],
  },

  // Proof lessons often have no scored quiz: ask learners to restate the result.
  assessment: {
    questions: [
      {
        id: 'assess-1',
        type: 'input',
        text: 'Can you state the theorem in your own words?',
        answer: 'The core result in plain language.',
        hint: 'Focus on what the theorem guarantees, not the proof steps.',
      },
    ],
  },
}
`;

export const TPL_VIZ = `// MyVizComponent.jsx
// ================================================================
// VIZ COMPONENT (prose + toggles)  —  UpSkillOS
// ================================================================
// Save as src/courses/<course>/viz/<Name>.jsx — it is found automatically,
// nothing to register. The filename (without .jsx) is the id lessons use.

import { useState, useEffect } from 'react'
import { useThemeColors } from '../../../hooks/useThemeColors'
// ── COLORS HOOK: shared across every viz — import it, don't copy it. ──
// (Adding a color? Edit src/hooks/useThemeColors.js once and every viz gets it.)

// Name the file after the component: MyVizComponent.jsx -> id 'MyVizComponent'.
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

// USE IT IN A LESSON:
//    intuition: { blocks: [ { type: 'viz', id: 'MyVizComponent', props: {} } ] }
// or in a section's visualizations list:
//    visualizations: [{ id: 'MyVizComponent', props: {} }]
`;

export const TPL_CANVAS = `// MyCanvasViz.jsx
// ================================================================
// VIZ COMPONENT (HTML5 Canvas)  —  UpSkillOS
// ================================================================
// Save as src/courses/<course>/viz/<Name>.jsx — it is found automatically,
// nothing to register. The filename (without .jsx) is the id lessons use.

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
