// Small building blocks shared by the Help modal sections. Split out of src/components/ui/HelpModal.jsx.

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Download } from "lucide-react";

// ─── SHARED PRIMITIVES ───────────────────────────────────────────────────────

export function Cb({ children }) {
  return (
    <code className="font-mono text-[12px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}

export function CodeBlock({ children }) {
  return (
    <pre className="text-[12px] font-mono bg-slate-900 dark:bg-slate-950 text-slate-200 rounded-xl p-4 overflow-x-auto leading-relaxed border border-slate-700 my-3">
      {children}
    </pre>
  );
}

export function Note({ children, color = "blue" }) {
  const s = {
    blue: "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300",
    amber:
      "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300",
    green:
      "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300",
    red: "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300",
  };
  return (
    <div
      className={`text-[12px] border-l-2 rounded-r-xl px-3 py-2.5 mb-3 leading-relaxed ${s[color]}`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({ children, sub }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
        {children}
      </h2>
      {sub && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{sub}</p>
      )}
    </div>
  );
}

export function H2({ children }) {
  return (
    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight mb-3">
      {children}
    </h2>
  );
}

export function H3({ children }) {
  return (
    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-6 mb-2">
      {children}
    </h3>
  );
}

export function Para({ children }) {
  return (
    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
      {children}
    </p>
  );
}

// ─── DOWNLOAD HELPER ─────────────────────────────────────────────────────────
export function downloadFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── DOWNLOAD CARD ───────────────────────────────────────────────────────────

export function DownloadCard({ icon, title, filename, desc, template }) {
  const [done, setDone] = useState(false);
  const handle = () => {
    downloadFile(filename, template);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:shadow-md dark:hover:shadow-slate-900/60 transition-shadow mb-3">
      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start gap-2 mb-1">
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {title}
          </span>
          <code className="text-[11px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            {filename}
          </code>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
          {desc}
        </p>
        <button
          onClick={handle}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${done ? "bg-emerald-500 text-white" : "bg-brand-600 hover:bg-brand-700 text-white"}`}
        >
          {done ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          {done ? "Downloaded!" : `Download ${filename}`}
        </button>
      </div>
    </div>
  );
}

// ─── STEP WIZARD ─────────────────────────────────────────────────────────────

export function StepWizard({ steps }) {
  const [step, setStep] = useState(0);
  const cur = steps[step];
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            title={s.title}
            className={`shrink-0 rounded-full transition-all ${i === step ? "w-7 h-2.5 bg-brand-500" : i < step ? "w-2.5 h-2.5 bg-brand-300 dark:bg-brand-700" : "w-2.5 h-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300"}`}
          />
        ))}
        <span className="text-[11px] text-slate-400 ml-1 shrink-0">
          Step {step + 1} / {steps.length}
        </span>
      </div>

      <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-9 h-9 rounded-full bg-brand-500 text-white text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
            {step + 1}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {cur.title}
            </h3>
            {cur.sub && (
              <p className="text-xs text-slate-400 mt-0.5">{cur.sub}</p>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
          {cur.desc}
        </p>
        {cur.note && <Note color={cur.noteColor ?? "amber"}>{cur.note}</Note>}
        {cur.code && <CodeBlock>{cur.code}</CodeBlock>}
        {cur.bullets && (
          <ul className="space-y-1.5 mb-4">
            {cur.bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
              >
                <ChevronRight className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
        {cur.download && (
          <button
            onClick={() =>
              downloadFile(cur.download.filename, cur.download.content)
            }
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl transition-colors mt-2"
          >
            <Download className="w-4 h-4" /> Download {cur.download.filename}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Previous
        </button>
        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="flex items-center gap-1.5 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl transition-colors"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
            <Check className="w-4 h-4" /> You're ready!
          </div>
        )}
      </div>
    </div>
  );
}
