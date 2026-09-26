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
        The app has dozens of pre-built interactive visualizations. Adding one
        to your lesson takes exactly one line in the <Cb>visualizations</Cb>{" "}
        array.
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
  text: 'Your explanation...',
  visualizations: [
    { id: 'RiemannSum', props: {} },
  ],
},`}</CodeBlock>
      <Para>
        The <Cb>id</Cb> must exactly match the registration name in{" "}
        <Cb>VizFrame.jsx</Cb>. It is case-sensitive.
      </Para>

      <H3>Multiple vizs</H3>
      <CodeBlock>{`visualizations: [
  { id: 'SecantToTangent', props: {} },
  { id: 'PythonNotebook', props: {} },
],`}</CodeBlock>

      <H3>Passing parameters</H3>
      <CodeBlock>{`{ id: 'RiemannSum', props: { defaultN: 10, defaultMethod: 'midpoint' } }`}</CodeBlock>

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
        For the full list, open <Cb>src/components/viz/VizFrame.jsx</Cb> — every
        registered name is at the top of that file in <Cb>VIZ_REGISTRY</Cb>.
      </Note>
    </div>
  );
}
