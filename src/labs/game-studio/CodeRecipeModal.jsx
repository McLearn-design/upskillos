import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Code2, Copy, Search, Sparkles, Wand2, X } from 'lucide-react';
import PhaserPreview from './PhaserPreview';
import { createEntity, createProject, createScene, getActiveScene } from './projectModel';

const modalButton = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand-400 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-300';

function createRecipePreview(recipe) {
  const subject = createEntity('rectangle', {
    name: 'Scripted Object',
    transform: { x: 480, y: recipe.gravityY ? 390 : 270 },
    display: { width: 64, height: 64, color: '#818cf8' },
    physics: { enabled: Boolean(recipe.physics), body: 'dynamic', bounce: 0.25, collideWorldBounds: true },
    script: { enabled: true, source: recipe.code },
  });
  const entities = [subject];
  if (recipe.gravityY) {
    entities.push(createEntity('rectangle', {
      name: 'Ground', transform: { x: 480, y: 510 }, display: { width: 900, height: 42, color: '#334155' },
      physics: { enabled: true, body: 'static', bounce: 0, collideWorldBounds: false },
    }));
  }
  const scene = createScene('Recipe Preview', entities);
  return createProject(recipe.title, { scene, settings: { background: '#0f172a', gravityY: recipe.gravityY || 0, showHud: false } });
}

export default function CodeRecipeModal({ recipes, selectedEntity, onClose, onInsert }) {
  const [selectedId, setSelectedId] = useState(recipes[0]?.id);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const closeRef = useRef(null);
  const selected = recipes.find((item) => item.id === selectedId) || recipes[0];
  const previewProject = useMemo(() => createRecipePreview(selected), [selected]);
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const map = new Map();
    recipes.forEach((recipe) => {
      if (needle && ![recipe.title, recipe.summary, recipe.category, recipe.level, ...recipe.concepts].join(' ').toLowerCase().includes(needle)) return;
      if (!map.has(recipe.category)) map.set(recipe.category, []);
      map.get(recipe.category).push(recipe);
    });
    return [...map.entries()];
  }, [query, recipes]);

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

  if (!selected) return null;
  return (
    <div className="fixed inset-0 z-[165] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="game-recipes-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="flex h-full max-h-[94vh] w-full max-w-[1700px] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-page-bg)] shadow-2xl">
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 backdrop-blur-xl">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-600 text-white"><Code2 className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-500">Game Studio code patterns</p><h2 id="game-recipes-title" className="truncate text-lg font-bold">Copy the code, read why it works, or insert it into an object</h2></div>
          <span className="hidden rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 dark:border-slate-700 lg:block">{recipes.length} runnable patterns</span>
          <button ref={closeRef} className={modalButton} onClick={onClose} aria-label="Close code patterns"><X className="h-4 w-4" /></button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(430px,1fr)_minmax(390px,.9fr)]">
          <aside className="min-h-0 overflow-y-auto border-r border-[var(--color-border)] bg-slate-50/80 dark:bg-slate-950/50">
            <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-slate-50/95 p-3 backdrop-blur dark:bg-slate-950/95"><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search code patterns…" className="min-w-0 flex-1 bg-transparent text-xs outline-none" aria-label="Search code patterns" /></label></div>
            <nav className="p-2.5" aria-label="Game code patterns">
              {groups.map(([category, items]) => <section key={category} className="mb-4"><div className="mb-1 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400"><span>{category}</span><span>{items.length}</span></div><div className="space-y-1">{items.map((recipe) => <button key={recipe.id} onClick={() => setSelectedId(recipe.id)} className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${selected.id === recipe.id ? 'border-violet-400 bg-violet-50 text-violet-950 dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-100' : 'border-transparent text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900'}`}><span className="block text-xs font-bold">{recipe.title}</span><span className="mt-1 block text-[10px] opacity-70">{recipe.level}</span></button>)}</div></section>)}
            </nav>
          </aside>

          <main className="min-h-0 overflow-y-auto border-r border-[var(--color-border)] p-5">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-center gap-2"><span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:bg-violet-950 dark:text-violet-200">{selected.level}</span><span className="text-xs text-slate-500">{selected.category}</span></div>
              <h3 className="mt-2 text-2xl font-bold">{selected.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{selected.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{selected.concepts.map((concept) => <span key={concept} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] dark:border-slate-700 dark:bg-slate-900">{concept}</span>)}</div>

              <section className="mt-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Paste into an object script</span><button onClick={copyCode} className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-500">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy code'}</button></div>
                <pre className="max-h-96 overflow-auto p-4 text-[12px] leading-6 text-slate-200"><code>{selected.code}</code></pre>
              </section>

              <section className="mt-5"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-500">Why each part exists</p><div className="mt-2 space-y-3">{selected.walkthrough.map(([title, detail, code], index) => <article key={`${title}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><div className="p-3.5"><h4 className="text-sm font-bold">{title}</h4><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p></div><pre className="overflow-x-auto border-t border-slate-800 bg-slate-950 p-3 text-[11px] text-slate-200"><code>{code}</code></pre></article>)}</div></section>
            </div>
          </main>

          <section className="flex min-h-0 flex-col bg-slate-50/80 p-4 dark:bg-slate-950/50">
            <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-500">Live script output</p><p className="mt-1 text-xs text-slate-500">{selected.outcome}</p></div>
            <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-300 bg-slate-950 shadow-xl dark:border-slate-700"><PhaserPreview project={previewProject} scene={getActiveScene(previewProject)} /></div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><p className="text-xs leading-5 text-slate-600 dark:text-slate-300">Game Studio runs object scripts once per frame through a small API. Loops, browser access, network calls, and dynamic code construction are blocked so an accidental snippet cannot take over the editor.</p></div>
              <button disabled={!selectedEntity} onClick={() => onInsert(selected)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"><Wand2 className="h-4 w-4" />{selectedEntity ? `Insert into ${selectedEntity.name}` : 'Select an object to insert'}</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

