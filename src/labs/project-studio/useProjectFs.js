// useProjectFs.js
// Thin hook over the project:* IPC surface (desktop/app/project-fs.cjs).
// Everything here is desktop-only; `available` is false in a browser tab,
// which the lab uses to render an explanation instead of crashing.
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';

const api = () => (typeof window !== 'undefined' ? window.openCalcDesktop?.project : null);

export const isDesktop = () => !!api();

export function useProjectFs(scope) {
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [loadedScope, setLoadedScope] = useState(null);
  const projectApi = useMemo(() => {
    const bridge = api();
    if (!bridge) return null;
    return Object.fromEntries(['pick', 'get', 'tree', 'read', 'write', 'create', 'mkdir', 'remove', 'rename', 'run', 'check'].map(name => [name, (...args) => {
      if (!bridge[name]) return Promise.resolve({ ok: false, reason: 'Restart the updated desktop app to enable file creation.' });
      return bridge[name](...args, scope);
    }]));
  }, [scope]);
  const [root, setRoot] = useState(null);
  const [missing, setMissing] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    const fs = projectApi;
    if (!fs) { setLoading(false); return; }
    const res = await fs.tree();
    if (currentScope.current !== scope) return;
    if (res.ok) {
      setRoot(res.root);
      setEntries(res.entries);
      setError(null);
    } else {
      setEntries([]);
      // "No project folder is open" is the normal first-run state, not an
      // error worth shouting about.
      setError(res.reason === 'No project folder is open' ? null : res.reason);
    }
    setLoading(false);
  }, [projectApi, scope]);

  useEffect(() => {
    const fs = projectApi;
    if (!fs) { setLoading(false); return; }
    setRoot(null); setEntries([]); setMissing(null); setLoading(true);
    let cancelled = false;
    fs.get().then((res) => {
      if (cancelled) return;
      if (res.scope !== scope) { setError('Restart the updated desktop app to enable separate project folders.'); setLoading(false); return; }
      setLoadedScope(scope);
      setError(null);
      setRoot(res.root);
      setMissing(res.missing ?? null);
      if (res.root) refresh();
      else setLoading(false);
    }).catch(failure => { if (!cancelled) { setError(failure.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [refresh, projectApi, scope]);

  const pick = useCallback(async () => {
    const fs = projectApi;
    if (!fs) return;
    if (loadedScope !== scope) { setError('Wait for project setup, or restart the updated desktop app.'); return; }
    const res = await fs.pick();
    if (currentScope.current !== scope) return;
    if (res.ok) {
      setLoadedScope(scope);
      setRoot(res.root);
      setMissing(null);
      await refresh();
    } else if (!res.canceled) setError(res.reason);
  }, [refresh, projectApi, scope, loadedScope]);

  const readFile = useCallback(async (rel) => {
    const fs = projectApi;
    if (!fs) return '';
    const res = await fs.read(rel);
    return res.ok ? res.content : '';
  }, [projectApi, scope]);

  const writeFile = useCallback(async (rel, content) => {
    const fs = projectApi;
    if (!fs) return { ok: false };
    return fs.write(rel, content);
  }, [projectApi, scope]);

  const mkdir = useCallback(async (rel) => {
    const fs = projectApi;
    if (!fs) return { ok: false };
    const res = await fs.mkdir(rel);
    await refresh();
    return res;
  }, [refresh, projectApi, scope]);

  const remove = useCallback(async (rel) => {
    const fs = projectApi;
    if (!fs) return { ok: false };
    const res = await fs.remove(rel);
    await refresh();
    return res;
  }, [refresh, projectApi, scope]);

  const run = useCallback(async (runtime, rel) => {
    const fs = projectApi;
    if (!fs) return { ok: false, reason: 'Desktop app required' };
    return fs.run(runtime, rel);
  }, [projectApi, scope]);

  return { available: !!api(), root: loadedScope === scope ? root : null, missing, entries: loadedScope === scope ? entries : [], loading, error, api: projectApi, pick, refresh, readFile, writeFile, mkdir, remove, run };
}
