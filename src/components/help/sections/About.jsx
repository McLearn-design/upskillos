// The Help modal's "About" section. Split out of src/components/ui/HelpModal.jsx.

import { Github, Heart, Shield } from "lucide-react";

// ─── NAVIGATION ──────────────────────────────────────────────────────────────

// ─── SECTION: ABOUT ──────────────────────────────────────────────────────────
export function SectionAbout() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
          About UpSkillOS
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Project info, license, and how to contribute
        </p>
      </div>

      {/* Created by */}
      <section className="flex items-start gap-4 p-5 rounded-2xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20">
        <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-500 dark:text-rose-400 shrink-0">
          <Heart className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
            Created By
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            UpSkillOS was created by <strong>Michael McLean</strong>, combining
            a passion for rigorous mathematical pedagogy with interactive web
            technology. Built to be free for students everywhere.
          </p>
        </div>
      </section>

      {/* License */}
      <section className="flex items-start gap-4 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20">
        <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 dark:text-indigo-400 shrink-0">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
            Open Source License — GPL-3.0
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            This project is licensed under <strong>GPL-3.0-or-later</strong> —
            free to use, modify, and distribute. Derivative works must remain
            open source; no proprietary fork is possible by design.
          </p>
        </div>
      </section>

      {/* Community */}
      <section className="p-5 rounded-2xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/50 dark:bg-sky-950/20 space-y-3">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">
          Community
        </h3>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://discord.gg/epd2kYBDVt"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-sm font-semibold hover:bg-sky-200 dark:hover:bg-sky-900/60 transition-colors"
          >
            🎮 Join Discord
          </a>
          <a
            href="https://github.com/g4m3rm1k3/upskillos"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Github className="w-4 h-4" /> GitHub
          </a>
        </div>
      </section>

      {/* Contributing */}
      <section className="flex items-start gap-4 p-5 rounded-2xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20">
        <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 shrink-0">
          <Github className="w-5 h-5" />
        </div>
        <div className="space-y-3 w-full">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
              How to Contribute
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Use the Lesson Builder to write lessons visually — no setup
              required. For code-level contributions (vizualizations, features,
              bug fixes), clone the repo and open a PR.
            </p>
          </div>
          <a
            href="https://github.com/g4m3rm1k3/upskillos"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
          >
            <Github className="w-4 h-4" />
            github.com/g4m3rm1k3/upskillos
          </a>
        </div>
      </section>

      {/* Dev mode tip */}
      <section className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-1.5 shrink-0">
          <kbd className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            Shift
          </kbd>
          <span className="text-slate-400 text-xs">+</span>
          <kbd className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            D
          </kbd>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Toggle <strong>Dev Mode</strong> — shows the component name on every
          visualization to help you find the right file to edit.
        </p>
      </section>
    </div>
  );
}
