// The Help modal's "Overview" section. Split out of src/components/ui/HelpModal.jsx.

import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Cb, H3, Note, Para, SectionHeading } from "../primitives.jsx";

// ─── SECTION: OVERVIEW ───────────────────────────────────────────────────────

export function SectionOverview({ onNavigate }) {
  return (
    <div>
      <SectionHeading sub="Two paths to contribute — pick the one that fits.">
        How to Contribute
      </SectionHeading>
      <Para>
        UpSkillOS is an open-source interactive STEM learning platform. Every
        topic is a <strong>lesson</strong>. Lessons are grouped into{" "}
        <strong>chapters</strong>. There are three tools for building content:
      </Para>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-5">
        <div className="p-5 rounded-2xl border-2 border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20">
          <div className="text-2xl mb-2">🔨</div>
          <div className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-1">
            Lesson Builder
          </div>
          <div className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed mb-3">
            Visual editor built into the app. Add cells, preview instantly, no
            setup needed.
          </div>
          <Link
            to="/lesson-builder"
            onClick={onNavigate}
            className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline"
          >
            → Open Lesson Builder
          </Link>
        </div>
        <div className="p-5 rounded-2xl border-2 border-sky-400/50 bg-sky-50/60 dark:bg-sky-950/20">
          <div className="text-2xl mb-2">🔭</div>
          <div className="text-sm font-bold text-sky-800 dark:text-sky-300 mb-1">
            Viz Builder
          </div>
          <div className="text-xs text-sky-700 dark:text-sky-400 leading-relaxed mb-3">
            Build interactive visualizations and diagrams. Export directly into
            any lesson.
          </div>
          <Link
            to="/viz-builder"
            onClick={onNavigate}
            className="text-xs font-bold text-sky-700 dark:text-sky-300 hover:underline"
          >
            → Open Viz Builder
          </Link>
        </div>
        <div className="p-5 rounded-2xl border-2 border-slate-300/50 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
          <div className="text-2xl mb-2">💻</div>
          <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
            Code Editor (Git)
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
            Clone the repo, edit <Cb>.js</Cb> files directly, run{" "}
            <Cb>npm run dev</Cb> to preview. Full control, all lesson types.
          </div>
          <a
            href="https://github.com/g4m3rm1k3/upskillos"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:underline"
          >
            → GitHub Repo
          </a>
        </div>
      </div>

      <Note color="green">
        <strong>New contributor?</strong> Start with the{" "}
        <strong>Lesson Builder</strong> — head to{" "}
        <strong>Your First Lesson</strong> in the sidebar for a step-by-step
        walkthrough.
      </Note>

      <H3>How lessons become content</H3>
      <div className="flex flex-wrap items-center gap-2 my-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        {[
          {
            icon: "🔨",
            label: "Build in Lesson Builder",
            cls: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40",
          },
          null,
          {
            icon: "📤",
            label: "Export as .js file",
            cls: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40",
          },
          null,
          {
            icon: "🔀",
            label: "Submit a PR",
            cls: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40",
          },
          null,
          {
            icon: "🎓",
            label: "Students learn!",
            cls: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40",
          },
        ].map((item, i) =>
          item === null ? (
            <ArrowRight
              key={i}
              className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0"
            />
          ) : (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl ${item.cls}`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-xs font-semibold">{item.label}</span>
            </div>
          ),
        )}
      </div>

      <H3>Community</H3>
      <div className="flex flex-wrap gap-3 mt-3">
        <a
          href="https://discord.gg/epd2kYBDVt"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-sm font-semibold hover:bg-sky-100 dark:hover:bg-sky-950/50 transition-colors"
        >
          🎮 Join Discord
        </a>

        <a
          href="https://github.com/g4m3rm1k3/upskillos"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          ⭐ GitHub
        </a>
      </div>
    </div>
  );
}
