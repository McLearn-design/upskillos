// The Help modal's "Troubleshooting" section. Split out of src/components/ui/HelpModal.jsx.

import { useState } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { SectionHeading } from "../primitives.jsx";

// ─── SECTION: TROUBLESHOOTING ───────────────────────────────────────────────

const STORAGE_KEY = "oc-sticky-notes";

export function SectionTroubleshooting() {
  const [resetDone, setResetDone] = useState(false);

  function resetNotes() {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("oc-note-change"));
    setResetDone(true);
    setTimeout(() => setResetDone(false), 3000);
  }

  return (
    <div>
      <SectionHeading sub="Fix common issues without losing your progress.">
        Troubleshooting
      </SectionHeading>

      <div className="space-y-6">
        {/* Reset notes */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center shrink-0">
              <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                My notes are gone / showing wrong content
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Restores all bundled default notes by clearing your local
                overrides and deleted markers. Any notes you personally wrote
                will also be removed — export them first if you want to keep
                them.
              </p>
            </div>
          </div>
          <button
            onClick={resetNotes}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              resetDone
                ? "bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            {resetDone
              ? "Notes reset — refresh the page"
              : "Reset notes to defaults"}
          </button>
        </div>

        {/* Blank page after update */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Page is blank after an update
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Your browser cached the old version of the app. A hard reload
                fetches the latest files. On most browsers:{" "}
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">
                  Ctrl + Shift + R
                </span>{" "}
                (Windows/Linux) or{" "}
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">
                  ⌘ + Shift + R
                </span>{" "}
                (Mac).
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload page now
          </button>
        </div>
      </div>
    </div>
  );
}
