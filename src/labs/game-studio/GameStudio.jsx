import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Box,
  Circle,
  Code2,
  Copy,
  Download,
  Gamepad2,
  Image,
  MousePointer2,
  Pause,
  Play,
  Plus,
  Redo2,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
} from 'lucide-react';
import EditorViewport from './EditorViewport';
import CodeRecipeModal from './CodeRecipeModal';
import ExampleLibraryModal from './ExampleLibraryModal';
import PhaserPreview from './PhaserPreview';
import { GAME_STUDIO_EXAMPLES } from './examples';
import { GAME_CODE_RECIPES } from './codeRecipes';
import {
  addEntity,
  createProject,
  duplicateEntity,
  getActiveScene,
  normalizeProject,
  patchEntity,
  removeEntity,
} from './projectModel';
import { getLastProjectId, loadProject, saveProject, setLastProjectId } from './storage';
import { GAME_SCRIPT_API_REFERENCE, validateLearnerScript } from './scriptRuntime';

const buttonBase = 'inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40';
const button = `${buttonBase} border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-300`;
const field = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const sectionTitle = 'text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400';

function useProjectHistory(initialProject) {
  const [state, setState] = useState({ past: [], present: initialProject, future: [] });
  const setProject = useCallback((next, record = true) => {
    setState((current) => {
      const value = typeof next === 'function' ? next(current.present) : next;
      if (value === current.present) return current;
      if (!record) return { ...current, present: value };
      return { past: [...current.past.slice(-59), current.present], present: value, future: [] };
    });
  }, []);
  const replaceProject = useCallback((project) => setState({ past: [], present: project, future: [] }), []);
  const undo = useCallback(() => setState((current) => {
    if (!current.past.length) return current;
    const present = current.past[current.past.length - 1];
    return { past: current.past.slice(0, -1), present, future: [current.present, ...current.future] };
  }), []);
  const redo = useCallback(() => setState((current) => {
    if (!current.future.length) return current;
    const [present, ...future] = current.future;
    return { past: [...current.past, current.present], present, future };
  }), []);
  return { project: state.present, setProject, replaceProject, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}

function NumberField({ label, value, onChange, step = 1 }) {
  return (
    <label className="min-w-0 text-xs font-medium text-slate-500 dark:text-slate-400">
      <span className="mb-1 block">{label}</span>
      <input className={field} type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ScenePanel({ scene, selectedId, onSelect, onAdd }) {
  return (
    <aside className="flex min-h-0 w-60 shrink-0 flex-col border-r border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <span className={sectionTitle}>Scene</span>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{scene.entities.length}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <Box className="h-4 w-4 text-brand-500" /> {scene.name}
        </div>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {scene.entities.map((entity) => {
          const Icon = entity.type === 'text' ? Type : entity.type === 'circle' ? Circle : Square;
          return (
            <button
              key={entity.id}
              type="button"
              onClick={() => onSelect(entity.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${selectedId === entity.id ? 'bg-brand-100 font-semibold text-brand-800 dark:bg-brand-950/70 dark:text-brand-200' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900'}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{entity.name}</span>
            </button>
          );
        })}
        {!scene.entities.length && <p className="px-2 py-8 text-center text-xs leading-5 text-slate-500">This scene is empty. Add an object below.</p>}
      </div>
      <div className="grid grid-cols-3 gap-1.5 border-t border-slate-200 p-2 dark:border-slate-800">
        <button className={button} onClick={() => onAdd('rectangle')} title="Add rectangle"><Square className="h-4 w-4" /></button>
        <button className={button} onClick={() => onAdd('circle')} title="Add circle"><Circle className="h-4 w-4" /></button>
        <button className={button} onClick={() => onAdd('text')} title="Add text"><Type className="h-4 w-4" /></button>
      </div>
    </aside>
  );
}

function Inspector({ entity, onPatch, onDuplicate, onDelete }) {
  if (!entity) {
    return (
      <aside className="flex w-72 shrink-0 items-center justify-center border-l border-slate-200 bg-slate-50/90 p-6 text-center dark:border-slate-800 dark:bg-slate-950/60">
        <div>
          <MousePointer2 className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Select an object</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Choose it in the scene tree or click it in the viewport.</p>
        </div>
      </aside>
    );
  }
  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-50/90 p-3 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mb-4 flex items-center gap-2">
        <input className={field} value={entity.name} onChange={(event) => onPatch({ name: event.target.value })} aria-label="Object name" />
        <button className={button} onClick={onDuplicate} title="Duplicate"><Copy className="h-4 w-4" /></button>
        <button className={`${button} hover:!border-rose-400 hover:!text-rose-500`} onClick={onDelete} title="Delete"><Trash2 className="h-4 w-4" /></button>
      </div>

      <div className="space-y-5">
        <section>
          <h3 className={sectionTitle}>Transform</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <NumberField label="X" value={entity.transform.x} onChange={(x) => onPatch({ transform: { x } })} />
            <NumberField label="Y" value={entity.transform.y} onChange={(y) => onPatch({ transform: { y } })} />
            <NumberField label="Rotation" value={entity.transform.rotation} onChange={(rotation) => onPatch({ transform: { rotation } })} />
            <NumberField label="Scale" value={entity.transform.scaleX} step={0.1} onChange={(scale) => onPatch({ transform: { scaleX: scale, scaleY: scale } })} />
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Appearance</h3>
          <div className="mt-2 space-y-2">
            {entity.type === 'text' && (
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Text
                <input className={`${field} mt-1`} value={entity.display.text} onChange={(event) => onPatch({ display: { text: event.target.value } })} />
              </label>
            )}
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Width" value={entity.display.width} onChange={(width) => onPatch({ display: { width } })} />
              <NumberField label="Height" value={entity.display.height} onChange={(height) => onPatch({ display: { height } })} />
            </div>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Color
              <input type="color" value={entity.display.color} onChange={(event) => onPatch({ display: { color: event.target.value } })} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent" />
            </label>
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Behavior</h3>
          <select className={`${field} mt-2`} value={entity.behavior.type} onChange={(event) => onPatch({ behavior: { type: event.target.value } })}>
            <option value="none">None</option>
            <option value="topDown">Arrow-key movement</option>
            <option value="platformer">Platform movement + jump</option>
            <option value="patrol">Patrol between two points</option>
            <option value="bounce">Bounce with velocity</option>
          </select>
          {entity.behavior.type !== 'none' && <div className="mt-2"><NumberField label="Speed" value={entity.behavior.speed} onChange={(speed) => onPatch({ behavior: { speed } })} /></div>}
          {entity.behavior.type === 'patrol' && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Axis
                <select className={`${field} mt-1`} value={entity.behavior.axis} onChange={(event) => onPatch({ behavior: { axis: event.target.value } })}><option value="x">Horizontal</option><option value="y">Vertical</option></select>
              </label>
              <NumberField label="Range" value={entity.behavior.range} onChange={(range) => onPatch({ behavior: { range } })} />
            </div>
          )}
        </section>

        <section>
          <h3 className={sectionTitle}>Game role</h3>
          <select className={`${field} mt-2`} value={entity.gameplay?.role || 'none'} onChange={(event) => onPatch({ gameplay: { role: event.target.value } })}>
            <option value="none">None / scenery</option>
            <option value="player">Player</option>
            <option value="collectible">Collectible</option>
            <option value="hazard">Hazard</option>
            <option value="goal">Goal</option>
          </select>
          {entity.gameplay?.role === 'collectible' && <div className="mt-2"><NumberField label="Points" value={entity.gameplay.points} onChange={(points) => onPatch({ gameplay: { points } })} /></div>}
          {entity.gameplay?.role === 'player' && <div className="mt-2"><NumberField label="Lives" value={entity.gameplay.lives} onChange={(lives) => onPatch({ gameplay: { lives } })} /></div>}
        </section>

        {entity.type !== 'text' && (
          <section>
            <h3 className={sectionTitle}>Physics</h3>
            <label className="mt-2 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              Enabled
              <input type="checkbox" checked={entity.physics.enabled} onChange={(event) => onPatch({ physics: { enabled: event.target.checked } })} className="h-4 w-4 accent-brand-600" />
            </label>
            {entity.physics.enabled && <div className="mt-2"><NumberField label="Bounce (0–1)" value={entity.physics.bounce} step={0.1} onChange={(bounce) => onPatch({ physics: { bounce } })} /></div>}
          </section>
        )}
      </div>
    </aside>
  );
}

function LearningDrawer({ activeTab, setActiveTab, project, selectedEntity, onPatchSelected, onLoadExample, onOpenRecipes }) {
  const [selectedExample, setSelectedExample] = useState(GAME_STUDIO_EXAMPLES[0].id);
  const example = GAME_STUDIO_EXAMPLES.find((item) => item.id === selectedExample) || GAME_STUDIO_EXAMPLES[0];
  const tabs = ['Learn', 'Code', 'Assets', 'Project'];
  const scriptCheck = selectedEntity ? validateLearnerScript(selectedEntity.script?.source || '') : { valid: true, error: '' };
  return (
    <section className="h-52 shrink-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-10 items-center gap-1 border-b border-slate-200 px-3 dark:border-slate-800">
        {tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`h-full border-b-2 px-3 text-xs font-bold ${activeTab === tab ? 'border-brand-500 text-brand-600 dark:text-brand-300' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>{tab}</button>)}
      </div>
      <div className="h-[calc(100%-2.5rem)] overflow-y-auto p-3">
        {activeTab === 'Learn' && (
          <div className="grid h-full grid-cols-[230px_1fr_auto] gap-4">
            <div className="space-y-1 overflow-y-auto">
              {GAME_STUDIO_EXAMPLES.map((item) => <button key={item.id} onClick={() => setSelectedExample(item.id)} className={`w-full rounded-lg px-3 py-2 text-left text-xs ${item.id === example.id ? 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}><span className="block font-bold">{item.title}</span><span className="text-[10px] opacity-70">{item.level}</span></button>)}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{example.title}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{example.summary}</p>
              <ol className="mt-2 grid gap-1 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-3">
                {example.steps.map((step, index) => <li key={step} className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-950/70"><strong className="mr-1 text-brand-500">{index + 1}.</strong>{step}</li>)}
              </ol>
            </div>
            <button className={`${button} self-center !bg-brand-600 !px-4 !py-2 !text-white hover:!bg-brand-500`} onClick={() => onLoadExample(example)}>Load a copy</button>
          </div>
        )}
        {activeTab === 'Code' && (
          selectedEntity ? (
            <div className="grid h-full grid-cols-[minmax(420px,1.2fr)_minmax(300px,.8fr)] gap-3">
              <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-700">
                <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2"><div><span className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">{selectedEntity.name} · update script</span><p className="mt-0.5 text-[10px] text-slate-500">Runs once per frame in Play mode</p></div><label className="flex items-center gap-2 text-xs font-semibold text-slate-300"><input type="checkbox" checked={selectedEntity.script?.enabled || false} onChange={(event) => onPatchSelected({ script: { enabled: event.target.checked } })} className="accent-violet-500" />Enabled</label></div>
                <textarea value={selectedEntity.script?.source || ''} onChange={(event) => onPatchSelected({ script: { source: event.target.value } })} spellCheck="false" placeholder="Choose Code patterns, then insert a runnable script…" className="min-h-0 flex-1 resize-none bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-200 outline-none" aria-label="Selected object script" />
                {!scriptCheck.valid && <p className="border-t border-rose-900 bg-rose-950/70 px-3 py-1.5 text-[10px] text-rose-300">{scriptCheck.error}</p>}
              </div>
              <div className="min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/70">
                <div className="flex items-center justify-between"><div><h3 className="text-xs font-bold">Small, safe object scripts</h3><p className="mt-1 text-[10px] text-slate-500">Use the supplied API; the scene and browser stay isolated.</p></div><button className={button} onClick={onOpenRecipes}><Code2 className="h-3.5 w-3.5" />Patterns</button></div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">{GAME_SCRIPT_API_REFERENCE.map(([name, description]) => <div key={name} className="min-w-0"><code className="text-[10px] font-bold text-violet-500">{name}</code><p className="truncate text-[9px] text-slate-500" title={description}>{description}</p></div>)}</div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-center"><div><Code2 className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-2 text-sm font-bold">Select an object to edit its script</p><p className="mt-1 text-xs text-slate-500">Scripts add custom movement and behavior without changing the editor.</p><button className={`${button} mt-3`} onClick={onOpenRecipes}>Browse code patterns</button></div></div>
          )
        )}
        {activeTab === 'Assets' && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="oc-premium-card-inner flex items-center gap-3 p-3"><Image className="h-7 w-7 text-fuchsia-500" /><div className="flex-1"><h3 className="text-sm font-bold">Sprite Forge</h3><p className="text-xs text-slate-500">Draw and animate sprites. The import adapter is planned without changing the existing editor.</p></div><a className={button} href="#/lab/sprite-forge" target="_blank" rel="noreferrer">Open</a></div>
            <div className="oc-premium-card-inner flex items-center gap-3 p-3"><Gamepad2 className="h-7 w-7 text-emerald-500" /><div className="flex-1"><h3 className="text-sm font-bold">Tile Mapper</h3><p className="text-xs text-slate-500">Paint levels and collision maps. Game Studio will consume exported maps through an adapter.</p></div><a className={button} href="#/lab/tile-mapper" target="_blank" rel="noreferrer">Open</a></div>
          </div>
        )}
        {activeTab === 'Project' && <pre className="overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-300">{JSON.stringify({ kind: project.kind, version: project.version, settings: project.settings, scenes: project.scenes.map(({ id, name, entities }) => ({ id, name, entityCount: entities.length })) }, null, 2)}</pre>}
      </div>
    </section>
  );
}

export default function GameStudio({ onBack }) {
  const history = useProjectHistory(useMemo(() => createProject(), []));
  const { project, setProject, replaceProject } = history;
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('edit');
  const [activeTab, setActiveTab] = useState('Learn');
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [recipesOpen, setRecipesOpen] = useState(false);
  const [saveState, setSaveState] = useState('Loading…');
  const [notice, setNotice] = useState('');
  const fileRef = useRef(null);
  const scene = getActiveScene(project);
  const selected = scene.entities.find((entity) => entity.id === selectedId) || null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await getLastProjectId();
        const saved = id ? await loadProject(id) : null;
        if (!cancelled && saved) replaceProject(normalizeProject(saved));
        if (!cancelled) setSaveState('Saved locally');
      } catch {
        if (!cancelled) setSaveState('Local saving unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, [replaceProject]);

  useEffect(() => {
    if (saveState === 'Loading…') return undefined;
    setSaveState('Saving…');
    const timer = setTimeout(async () => {
      try {
        await saveProject(project);
        await setLastProjectId(project.id);
        setSaveState('Saved locally');
      } catch {
        setSaveState('Local saving unavailable');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [project]); // eslint-disable-line react-hooks/exhaustive-deps

  function add(kind) {
    const result = addEntity(project, scene.id, kind);
    setProject(result.project);
    setSelectedId(result.entity.id);
  }

  function patchSelected(patch) {
    if (selected) setProject(patchEntity(project, scene.id, selected.id, patch));
  }

  function moveEntity(id, transform) {
    setProject(patchEntity(project, scene.id, id, { transform }), false);
  }

  function loadExample(example) {
    const next = example.create();
    next.name = `${example.title} Copy`;
    replaceProject(next);
    setSelectedId(getActiveScene(next).entities[0]?.id || null);
    setMode('edit');
    setNotice(`${example.title} loaded as a new project.`);
    setExamplesOpen(false);
  }

  function insertRecipe(recipe) {
    if (!selected) return;
    let next = patchEntity(project, scene.id, selected.id, {
      behavior: { type: 'none' },
      physics: { enabled: recipe.physics ? true : selected.physics.enabled, body: 'dynamic', collideWorldBounds: true },
      script: { enabled: true, source: recipe.code },
    });
    if (recipe.gravityY) next = { ...next, settings: { ...next.settings, gravityY: recipe.gravityY } };
    setProject(next);
    setActiveTab('Code');
    setNotice(`${recipe.title} inserted into ${selected.name}.`);
    setRecipesOpen(false);
  }

  function exportProject() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'game'}.game.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importProject(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const next = normalizeProject(JSON.parse(await file.text()));
      replaceProject(next);
      setSelectedId(null);
      setNotice(`Imported ${next.name}.`);
    } catch (error) {
      setNotice(error.message || 'That project could not be imported.');
    }
  }

  return (
    <div className="flex h-full min-h-[620px] w-full select-none flex-col overflow-hidden bg-[var(--color-page-bg)] text-slate-800 dark:text-slate-200">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 backdrop-blur-xl">
        <button className={button} onClick={onBack} title="Back to labs"><ArrowLeft className="h-4 w-4" /></button>
        <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-600 text-white"><Gamepad2 className="h-4 w-4" /></span><div><p className="text-sm font-black leading-none">GAME STUDIO</p><p className="mt-1 text-[10px] text-slate-500">Learn by building</p></div></div>
        <input className="ml-3 w-52 border-0 bg-transparent px-2 text-sm font-semibold outline-none focus:ring-0" value={project.name} onChange={(event) => setProject({ ...project, name: event.target.value, updatedAt: new Date().toISOString() })} aria-label="Project name" />
        <span className="flex items-center gap-1 text-[10px] text-slate-500"><Save className="h-3 w-3" />{saveState}</span>
        <div className="flex-1" />
        <button className={button} onClick={() => setExamplesOpen(true)}><BookOpen className="h-4 w-4" />Examples</button>
        <button className={button} onClick={() => setRecipesOpen(true)}><Code2 className="h-4 w-4" />Code patterns</button>
        <button className={button} disabled={!history.canUndo || mode === 'play'} onClick={history.undo}><Undo2 className="h-4 w-4" />Undo</button>
        <button className={button} disabled={!history.canRedo || mode === 'play'} onClick={history.redo}><Redo2 className="h-4 w-4" />Redo</button>
        <button className={button} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />Import</button>
        <button className={button} onClick={exportProject}><Download className="h-4 w-4" />Export</button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={importProject} className="hidden" />
        <button className={`${buttonBase} min-w-24 ${mode === 'play' ? 'border-amber-400 bg-amber-400 text-slate-950 hover:bg-amber-300' : 'border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-500'}`} onClick={() => setMode((value) => value === 'edit' ? 'play' : 'edit')}>
          {mode === 'play' ? <><Pause className="h-4 w-4" />Stop</> : <><Play className="h-4 w-4" />Play</>}
        </button>
      </header>

      {notice && <button onClick={() => setNotice('')} className="shrink-0 bg-brand-50 px-4 py-2 text-left text-xs font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-200">{notice} <span className="ml-2 opacity-60">Click to dismiss</span></button>}

      <div className="flex min-h-0 flex-1">
        {mode === 'edit' && <ScenePanel scene={scene} selectedId={selectedId} onSelect={setSelectedId} onAdd={add} />}
        <main className="min-w-0 flex-1">
          {mode === 'edit'
            ? <EditorViewport project={project} scene={scene} selectedId={selectedId} onSelect={setSelectedId} onMove={moveEntity} />
            : <PhaserPreview project={project} scene={scene} />}
        </main>
        {mode === 'edit' && (
          <Inspector
            entity={selected}
            onPatch={patchSelected}
            onDuplicate={() => { const result = duplicateEntity(project, scene.id, selected.id); setProject(result.project); setSelectedId(result.entity?.id || null); }}
            onDelete={() => { setProject(removeEntity(project, scene.id, selected.id)); setSelectedId(null); }}
          />
        )}
      </div>

      {mode === 'edit' && <LearningDrawer activeTab={activeTab} setActiveTab={setActiveTab} project={project} selectedEntity={selected} onPatchSelected={patchSelected} onLoadExample={loadExample} onOpenRecipes={() => setRecipesOpen(true)} />}
      {examplesOpen && <ExampleLibraryModal examples={GAME_STUDIO_EXAMPLES} initialId="neon-maze" onClose={() => setExamplesOpen(false)} onLoadExample={loadExample} />}
      {recipesOpen && <CodeRecipeModal recipes={GAME_CODE_RECIPES} selectedEntity={selected} onClose={() => setRecipesOpen(false)} onInsert={insertRecipe} />}
    </div>
  );
}
