// The Help modal's "BuildViz" section. Split out of src/components/ui/HelpModal.jsx.

import { useState } from "react";
import { TPL_CANVAS, TPL_VIZ } from "../lessonTemplates.js";
import { Cb, CodeBlock, DownloadCard, H3, Note, Para, SectionHeading } from "../primitives.jsx";

// ─── SECTION: BUILD VIZ ──────────────────────────────────────────────────────

export function SectionBuildViz() {
  const [tpl, setTpl] = useState("prose");
  return (
    <div>
      <SectionHeading sub="Create a new interactive visualization from scratch.">
        Building a Visualization
      </SectionHeading>
      <Para>
        A visualization is a React component file. Save it in a course's{" "}
        <Cb>viz/</Cb> folder and it's available to every lesson — there's
        nothing to register.
      </Para>

      <H3>The 2-step process</H3>
      <div className="space-y-3 my-4">
        {[
          {
            n: "1",
            t: "Create the file",
            d: "Save a .jsx file in src/courses/<course>/viz/, for example src/courses/calculus/viz/MyVizComponent.jsx. It is found automatically; the file name (without .jsx) is its id.",
          },
          {
            n: "2",
            t: "Use it in a lesson",
            d: "Add { type: 'viz', id: 'MyVizComponent' } to a section's blocks, or { id: 'MyVizComponent' } to its visualizations list. Any course's lessons can use it.",
          },
        ].map((item) => (
          <div
            key={item.n}
            className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            <div className="w-8 h-8 rounded-full bg-brand-500 text-white text-sm font-bold flex items-center justify-center shrink-0">
              {item.n}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-0.5">
                {item.t}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {item.d}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Note color="amber">
        The id is CASE-SENSITIVE: <Cb>MyVizComponent.jsx</Cb> is used as{" "}
        <Cb>MyVizComponent</Cb>. Give the file a default export. Ids are shared
        across courses, so pick a name no other course's <Cb>viz/</Cb> folder
        uses. Only shared components used everywhere (such as{" "}
        <Cb>PythonNotebook</Cb>) are registered by hand in{" "}
        <Cb>src/components/viz/VizFrame.jsx</Cb>.
      </Note>

      <H3>Download a template</H3>
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          ["prose", "Prose + toggles"],
          ["canvas", "Canvas (graphs / animation)"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTpl(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tpl === id ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tpl === "prose" ? (
        <DownloadCard
          icon="🧩"
          title="Prose Viz Template"
          filename="MyVizComponent.jsx"
          template={TPL_VIZ}
          desc="For text panels, toggles, step-through explanations, and comparison layouts. No canvas needed."
        />
      ) : (
        <DownloadCard
          icon="🎨"
          title="Canvas Viz Template"
          filename="MyCanvasViz.jsx"
          template={TPL_CANVAS}
          desc="For animated graphs, geometry diagrams, and physics simulations. Includes ResizeObserver and the full 5-part canvas pattern."
        />
      )}

      <H3>Required: the colors hook</H3>
      <Para>
        Import this into every viz component — don't paste the implementation
        in. It makes your component react to dark/light mode and the active
        studio theme automatically, and a fix to the palette only has to happen
        once.
      </Para>
      <CodeBlock>{`import { useThemeColors } from '../../../hooks/useThemeColors'

export default function MyVizComponent() {
  const C = useThemeColors()
  // C.bg, C.surface, C.text, C.blue, C.teal, C.amber, C.green, C.red, C.purple, C.orange ...
}`}</CodeBlock>

      <H3>Canvas: the 5 required parts</H3>
      <div className="space-y-2 my-3">
        {[
          {
            p: "A",
            t: 'canvasRef (not "ref")',
            c: "const canvasRef = useRef(null)",
            d: "A house convention: every canvas viz names it canvasRef, so they all read the same way in review.",
          },
          {
            p: "B",
            t: "roRef",
            c: "const roRef = useRef(null)",
            d: "The ResizeObserver ref. Keeps the canvas up to date on window resize.",
          },
          {
            p: "C",
            t: "Set size inside draw()",
            c: "cv.width = cv.offsetWidth || 500\ncv.height = 300",
            d: "Must be set INSIDE draw(), every time. Setting width also clears the canvas: that's intentional.",
          },
          {
            p: "D",
            t: "Observe parentElement",
            c: "roRef.current.observe(canvasRef.current.parentElement)",
            d: "Observe the PARENT, not the canvas. The canvas has no CSS width to observe.",
          },
          {
            p: "E",
            t: "Cleanup",
            c: "return () => { roRef.current?.disconnect() }",
            d: "Without cleanup the observer keeps running after the component is gone — memory leak.",
          },
        ].map((item) => (
          <div
            key={item.p}
            className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {item.p}
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {item.t}
              </span>
            </div>
            <div className="px-3 py-2.5">
              <code className="text-xs font-mono text-teal-600 dark:text-teal-400 block mb-1 whitespace-pre">
                {item.c}
              </code>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {item.d}
              </span>
            </div>
          </div>
        ))}
      </div>

      <H3>Common crash causes</H3>
      <div className="space-y-2">
        {[
          {
            icon: "🔴",
            l: "Variable named H",
            f: "Use canvasH — H shadows the Heading component.",
          },
          {
            icon: "🔴",
            l: "Observing canvas instead of parentElement",
            f: "roRef.current.observe(canvasRef.current.parentElement) not canvasRef.current.",
          },
          {
            icon: "🔴",
            l: "Missing cleanup for ResizeObserver",
            f: "Always return () => { roRef.current?.disconnect() } from useEffect.",
          },
          {
            icon: "🟡",
            l: "C not in useEffect deps",
            f: "Colors go stale after dark mode toggle. Include C in the deps array.",
          },
          {
            icon: "🟡",
            l: "Drawing before setting cv.width / cv.height",
            f: "Setting dimensions clears the canvas — always set them first.",
          },
        ].map((item) => (
          <div
            key={item.l}
            className="flex items-start gap-2.5 text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
          >
            <span className="text-base shrink-0">{item.icon}</span>
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {item.l}:{" "}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {item.f}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
