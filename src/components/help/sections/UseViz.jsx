// The Help modal's "UseViz" section. Split out of src/components/ui/HelpModal.jsx.

import { Link } from "react-router-dom";
import { Cb, CodeBlock, H3, Note, Para, SectionHeading } from "../primitives.jsx";

// ─── SECTION: USING VIZ ──────────────────────────────────────────────────────

export function SectionUseViz({ onNavigate }) {
  return (
    <div>
      <SectionHeading sub="Add any existing visualization to a lesson — just one line.">
        Using Existing Visualizations
      </SectionHeading>
      <Para>
        The app has hundreds of interactive visualizations. Adding one to a
        lesson takes one line: a Visualization block in a section's{" "}
        <Cb>blocks</Cb>, or an entry in its <Cb>visualizations</Cb> list.
      </Para>

      <Note color="green">
        <strong>No code editor?</strong> Open the{" "}
        <Link to="/viz-builder" onClick={onNavigate} className="font-bold underline">Viz Builder</Link>{" "}
        (🔭 in Labs), configure a viz in the Build tab, click{" "}
        <strong>Export →</strong>, then <strong>"Or insert directly into a
        lesson"</strong>. Search for the target lesson, pick a section
        (Intuition / Math / Rigor), and it drops straight into that lesson's
        diff/save/PR flow — the same pipeline lessons already use.
      </Note>

      <H3>How to add a viz</H3>
      <CodeBlock>{`intuition: {
  blocks: [
    { type: 'prose', paragraphs: ['Your explanation…'] },
    { type: 'viz', id: 'RiemannSum' },   // shown right here, in order
  ],
},

// or, at the end of a section:
math: {
  prose: ['…'],
  visualizations: [{ id: 'RiemannSum' }],
},`}</CodeBlock>
      <Para>
        The <Cb>id</Cb> is the visualization's file name: a file in{" "}
        <Cb>src/courses/&lt;course&gt;/viz/</Cb> (for example{" "}
        <Cb>RiemannSum.jsx</Cb> → <Cb>RiemannSum</Cb>) is found automatically.
        A few shared ones, such as <Cb>PythonNotebook</Cb>,{" "}
        <Cb>JSNotebook</Cb> and <Cb>ScienceNotebook</Cb>, are registered in{" "}
        <Cb>src/components/viz/VizFrame.jsx</Cb>. Ids are case-sensitive.
      </Para>

      <H3>Multiple vizs</H3>
      <CodeBlock>{`visualizations: [
  { id: 'SecantToTangent' },
  { id: 'UnitCircle' },
],`}</CodeBlock>

      <H3>Passing parameters</H3>
      <Para>
        <Cb>props</Cb> reach the visualization as <Cb>params</Cb>. Most
        visualizations take none; check the component for{" "}
        <Cb>params.something</Cb> before relying on a prop.
      </Para>
      <CodeBlock>{`{ id: 'ContinuityViz', props: { variant: 'Jump' } }   // opens on the jump discontinuity
{ id: 'PythonNotebook', props: { initialCells: [ /* cells */ ] } }`}</CodeBlock>

      <H3>Available visualizations</H3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 my-3">
        {[
          ["SecantToTangent", "Derivative intuition — secant → tangent line"],
          ["RiemannSum", "Integration — Riemann sum explorer"],
          ["LimitApproach", "Limits — approach from both sides"],
          ["EpsilonDelta", "ε-δ definition explorer"],
          ["ChainRulePeeler", "Chain rule decomposition"],
          ["NewtonsMethod", "Root-finding iteration"],
          ["MVTViz", "Mean Value Theorem visualization"],
          ["CurveSketchingBoard", "Full curve sketching tool"],
          ["AreaBetweenCurves", "Integration applications"],
          ["PythagoreanProof", "Visual proof of Pythagorean theorem"],
          ["UnitCircle", "Interactive unit circle"],
          ["UnitCircleMirror", "Sine and cosine from unit circle"],
          ["PythonNotebook", "Interactive Python cell (runs in browser)"],
          ["JSNotebook", "Interactive JavaScript cell"],
          ["ParametricCurve3D", "3D parametric curve (Three.js)"],
          ["TangentPlane3D", "3D tangent plane visualization"],
          ["ForceBlockSim", "Physics — force and acceleration (Matter.js)"],
          ["InclinedPlaneSim", "Physics — inclined plane simulation"],
        ].map(([name, desc]) => (
          <div
            key={name}
            className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
          >
            <code className="font-mono text-xs text-brand-600 dark:text-brand-400 shrink-0 mt-0.5">
              {name}
            </code>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {desc}
            </span>
          </div>
        ))}
      </div>
      <Note color="blue">
        For the full list, browse the <strong>Viz Builder</strong>'s gallery,
        or look in the <Cb>viz/</Cb> folder of each course under{" "}
        <Cb>src/courses/</Cb>.
      </Note>
    </div>
  );
}
