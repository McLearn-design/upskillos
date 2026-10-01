// The script editor: Monaco, with the engine's globals declared so completion and
// hover work (input, scene, Vec2, the node classes). Edits stay in the editor until
// saved (Ctrl/Cmd+S, or Run, which saves first); an unsaved script shows ● on its tab.

import React, { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { Store } from './store';
import { C, useStore } from './kit';
import { ENGINE_DTS } from './engineTypes';

type MonacoEditor = Parameters<OnMount>[0];
let typesAdded = false;

export function ScriptEditor({ store, path }: { store: Store; path: string }) {
  useStore(store);
  const ed = useRef<MonacoEditor | null>(null);
  const text = store.scriptText(path);

  const reveal = store.reveal;
  useEffect(() => {
    if (!reveal || reveal.path !== path || !ed.current) return;
    ed.current.revealLineInCenter(reveal.line);
    ed.current.setPosition({ lineNumber: reveal.line, column: reveal.column });
    ed.current.focus();
    store.reveal = null;
  }, [reveal, path, store]);

  // Every project script is a Monaco model, not only the one open, so an import of another
  // script ("./grid.js") resolves, and completion knows what that script exports.
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const syncModels = () => {
    const monaco = monacoRef.current;
    if (!monaco || !store.project) return;
    for (const sc of store.project.scripts) {
      if (sc.path === path) continue;   // the open one belongs to the editor
      const uri = monaco.Uri.parse(`file:///${sc.path}`), text = store.scriptText(sc.path);
      const model = monaco.editor.getModel(uri);
      if (!model) monaco.editor.createModel(text, 'javascript', uri);
      else if (model.getValue() !== text) model.setValue(text);
    }
  };
  useEffect(syncModels);

  const onMount: OnMount = (editor, monaco) => {
    ed.current = editor;
    // For browser tests, in development only (like window.__gameStudio).
    if (import.meta.env?.DEV) (window as unknown as { __gameStudioMonaco?: unknown }).__gameStudioMonaco = monaco;
    if (!typesAdded) {
      typesAdded = true;
      monaco.languages.typescript.javascriptDefaults.addExtraLib(ENGINE_DTS, 'file:///game-studio-engine.d.ts');
      // JavaScript itself and the Game API, but not the browser's DOM: scripts do not use it, and its
      // own Node type would hide the engine's Node from completion and hover. checkJs underlines a
      // misspelt name (this.isOnFlor()) before the game runs; the example scripts check clean.
      // Monaco checks only syntax in JavaScript unless told otherwise. The "could be typed" hints are
      // noise in plain JavaScript, so they are off.
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false, noSuggestionDiagnostics: true });
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({ target: monaco.languages.typescript.ScriptTarget.ES2020, lib: ['es2020'], allowNonTsExtensions: true, allowJs: true, checkJs: true, module: monaco.languages.typescript.ModuleKind.ESNext, moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs });
    }
    monacoRef.current = monaco;
    syncModels();
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { store.saveScript(path); });
    if (store.reveal?.path === path) {
      const r = store.reveal; store.reveal = null;
      editor.revealLineInCenter(r.line); editor.setPosition({ lineNumber: r.line, column: r.column }); editor.focus();
    }
  };

  return (
    <div data-testid="script-editor" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', padding: '3px 8px', fontSize: 11, color: C.faint, borderBottom: `1px solid ${C.border}`, fontFamily: C.mono }}>
        <span style={{ flex: 1 }}>{path}{store.isScriptDirty(path) ? '  ● unsaved (Ctrl/Cmd+S)' : '  saved'}</span>
        <span role="link" data-testid="script-reference" onClick={() => store.showReference()} title="Every class, method and global a script can use" style={{ color: C.accent, cursor: 'pointer', fontFamily: 'system-ui, sans-serif' }}>API reference</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          path={`file:///${path}`}
          language="javascript"
          theme="vs-dark"
          value={text}
          onChange={(v) => store.editScript(path, v ?? '')}
          onMount={onMount}
          options={{ fontSize: 13, minimap: { enabled: false }, tabSize: 2, scrollBeyondLastLine: false, automaticLayout: true }}
        />
      </div>
    </div>
  );
}
