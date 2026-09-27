import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, Copy, Play, Search, Sparkles, X } from 'lucide-react';
import PhaserPreview from './PhaserPreview';
import { getActiveScene } from './projectModel';

const modalButton = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-300';

export default function ExampleLibraryModal({ examples, initialId, onClose, onLoadExample }) {
  const [selectedId, setSelectedId] = useState(initialId || examples.find((item) => item.featured)?.id || examples[0]?.id);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const closeRef = useRef(null);
  const selected = examples.find((item) => item.id === selectedId) || examples[0];
  const previewProject = useMemo(() => selected?.create(), [selected]);
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const map = new Map();
    examples.forEach((example) => {
      const haystack = [example.title, example.summary, example.level, example.category, ...example.concepts].join(' ').toLowerCase();
      if (needle && !haystack.includes(needle)) return;
      if (!map.has(example.category)) map.set(example.category, []);
      map.get(example.category).push(example);
    });
    return [...map.entries()];
  }, [examples, query]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => setCopied(false), [selectedId]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(selected.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  if (!selected || !previewProject) return null;
  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="game-examples-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="flex h-full max-h-[94vh] w-full max-w-[1760px] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-page-bg)] text-slate-800 shadow-2xl dark:text-slate-200">
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 backdrop-blur-xl">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white"><BookOpen className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-500">Game Studio example library</p>
            <h2 id="game-examples-title" className="truncate text-lg font-bold">Play it, understand the code, then rebuild it your way</h2>
          </div>
          <span className="hidden rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 dark:border-slate-700 lg:block">{examples.length} working projects</span>
          <button ref={closeRef} className={modalButton} onClick={onClose} aria-label="Close example library"><X className="h-4 w-4" /></button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(430px,1.05fr)_minmax(390px,.95fr)]">
          <aside className="min-h-0 overflow-y-auto border-r border-[var(--color-border)] bg-slate-50/80 dark:bg-slate-950/50">
            <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-slate-50/95 p-3 backdrop-blur dark:bg-slate-950/95">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                <Search className="h-4 w-4 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games and skills…" className="min-w-0 flex-1 bg-transparent text-xs outline-none" aria-label="Search game examples" />
              </label>
            </div>
            <nav className="p-2.5" aria-label="Game examples">
              {groups.map(([category, items]) => (
                <section key={category} className="mb-4">
                  <div className="mb-1 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400"><span>{category}</span><span>{items.length}</span></div>
                  <div className="space-y-1">
                    {items.map((example) => (
                      <button key={example.id} onClick={() => setSelectedId(example.id)} className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${selected.id === example.id ? 'border-brand-400 bg-brand-50 text-brand-900 dark:border-brand-500 dark:bg-brand-950/70 dark:text-brand-100' : 'border-transparent text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900'}`}>
                        <span className="flex items-center gap-1.5 text-xs font-bold">{example.featured && <Sparkles className="h-3.5 w-3.5 text-amber-500" />}{example.title}</span>
                        <span className="mt-1 block text-[10px] opacity-70">{example.level}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
              {!groups.length && <p className="p-4 text-center text-xs text-slate-500">No examples match that search.</p>}
            </nav>
          </aside>

          <main className="min-h-0 overflow-y-auto border-r border-[var(--color-border)] p-5">
            <div className="mx-auto max-w-3xl">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:bg-brand-950 dark:text-brand-200">{selected.level}</span><span className="text-xs text-slate-500">{selected.category}</span></div>
              <h3 className="mt-2 text-2xl font-bold">{selected.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{selected.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{selected.concepts.map((concept) => <span key={concept} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{concept}</span>)}</div>

              <section className="mt-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-500">Code walkthrough</p>
                <div className="mt-2 space-y-3">
                  {selected.walkthrough.map((step, index) => (
                    <article key={`${step.title}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                      <div className="p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-500">Concept {index + 1}</p>
                        <h4 className="mt-1 text-sm font-bold">{step.title}</h4>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{step.detail}</p>
                      </div>
                      <pre className="overflow-x-auto border-t border-slate-800 bg-slate-950 p-3 text-[11px] leading-5 text-slate-200"><code>{step.code}</code></pre>
                    </article>
                  ))}
                </div>
              </section>

              <section className="mt-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Complete Phaser pattern</span><button onClick={copyCode} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-500">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy code'}</button></div>
                <pre className="max-h-80 overflow-auto p-4 text-[11px] leading-5 text-slate-200"><code>{selected.code}</code></pre>
              </section>

              <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Try this next</p>
                <p className="mt-1 text-sm text-amber-950 dark:text-amber-100">{selected.challenge}</p>
              </section>
            </div>
          </main>

          <section className="flex min-h-0 flex-col bg-slate-50/80 p-4 dark:bg-slate-950/50">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-500">Live playable preview</p><p className="mt-1 text-xs text-slate-500">This uses the same Phaser runtime as Play mode.</p></div>
              <button onClick={() => onLoadExample(selected)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-500"><Play className="h-3.5 w-3.5" />Load a copy</button>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-300 bg-slate-950 shadow-xl dark:border-slate-700">
              <PhaserPreview project={previewProject} scene={getActiveScene(previewProject)} />
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">How to explore it</p>
              <ol className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">{selected.steps.map((step, index) => <li key={step} className="flex gap-2"><span className="font-bold text-brand-500">{index + 1}.</span><span>{step}</span></li>)}</ol>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

