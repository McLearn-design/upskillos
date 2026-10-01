// The Help modal's "Opencalc" section. Split out of src/components/ui/HelpModal.jsx.

import { Cb, CodeBlock, H3, Note, Para, SectionHeading } from "../primitives.jsx";

// ─── SECTION: OPENCALC ───────────────────────────────────────────────────────

export function SectionOpencalc() {
  return (
    <div>
      <SectionHeading sub="The built-in Python visualization library — no installation needed.">
        opencalc Python Library
      </SectionHeading>
      <Para>
        <strong>opencalc</strong> is available automatically in every Python
        notebook. Students just import it and start drawing.
      </Para>

      <H3>Quick start</H3>
      <CodeBlock>{`from opencalc import Figure, quick_plot

# One-liner: plot a function
print(quick_plot(lambda x: x**2, title='y = x²'))

# Full control:
fig = Figure(xmin=-5, xmax=5, ymin=-2, ymax=10)
fig.grid().axes()
fig.plot(lambda x: x**2, color='blue', label='x²')
fig.point([1, 1], label='(1, 1)')
fig.show()          # ← draws the figure`}</CodeBlock>
      <Note color="amber">
        End the cell with <Cb>fig.show()</Cb>, or print it with{" "}
        <Cb>print(fig.show())</Cb> — both draw the figure. A cell shows one
        figure: the last one it produces.
      </Note>

      <H3>Drawing methods (all chainable)</H3>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-4">
        {[
          [".grid(step, color)", "Background grid lines."],
          [
            ".axes(labels, ticks)",
            "X and Y axes with optional tick marks and labels.",
          ],
          [
            ".plot(fn, color, label, fill)",
            "Plot a function y = f(x). fn is a Python lambda or function.",
          ],
          [
            ".parametric(xfn, yfn, tmin, tmax)",
            "Parametric curve (x(t), y(t)) over a t range.",
          ],
          [
            ".scatter(xs, ys, color, radius)",
            "Scatter plot from two lists of numbers.",
          ],
          [".point(pos, color, label)", "Single labeled dot at [x, y]."],
          [".arrow(start, end, color)", "Arrow from [x1,y1] to [x2,y2]."],
          [".vector(v, color, label, origin)", "Vector drawn from origin."],
          [
            ".fill_between(fn_top, fn_bot)",
            "Shaded region between two functions.",
          ],
          [
            ".circle(center, radius, color)",
            "Circle by center point and radius.",
          ],
          [
            ".rect(x, y, w, h, color)",
            "Rectangle at corner (x, y) with given size.",
          ],
          [
            ".polygon(points, color, fill)",
            "Filled polygon from a list of [x,y] points.",
          ],
          [".text(pos, content, color)", "Text label at a coordinate."],
          [
            ".riemann(fn, a, b, n, method)",
            "Riemann sum rectangles (midpoint / left / right).",
          ],
          [".tangent(fn, x0, color)", "Tangent line at x0 with slope label."],
          [
            ".bars(labels, values, color)",
            "Bar chart from label and value lists.",
          ],
          [
            ".transformed_grid(matrix)",
            "Visualize a 2×2 matrix transformation.",
          ],
          [
            ".hline(y) / .vline(x)",
            "Horizontal or vertical dashed reference line.",
          ],
        ].map(([method, desc], i) => (
          <div
            key={i}
            className={`flex gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 ${i % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-slate-900/30"}`}
          >
            <code className="font-mono text-xs text-teal-600 dark:text-teal-400 shrink-0 w-52">
              {method}
            </code>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {desc}
            </span>
          </div>
        ))}
      </div>

      <H3>Shortcut helpers</H3>
      <CodeBlock>{`quick_plot(lambda x: x**2, xmin=-3, xmax=3, title='Square')
quick_vectors([1, 2], [3, -1], labels=['a', 'b'])
quick_transform([[2, 0], [0, 1]])       # stretch x by 2
quick_transform([[0, -1], [1, 0]])      # 90° rotation`}</CodeBlock>

      <H3>Available colors</H3>
      <div className="flex flex-wrap gap-2 my-3">
        {[
          "blue",
          "amber",
          "green",
          "red",
          "purple",
          "teal",
          "gray",
          "muted",
        ].map((c) => (
          <span
            key={c}
            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-600 dark:text-slate-300"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
