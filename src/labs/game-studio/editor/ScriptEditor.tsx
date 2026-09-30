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

  const onMount: OnMount = (editor, monaco) => {
    ed.current = editor;
    if (!typesAdded) {
      typesAdded = true;
      monaco.languages.typescript.javascriptDefaults.addExtraLib(ENGINE_DTS, 'file:///game-studio-engine.d.ts');
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({ target: monaco.languages.typescript.ScriptTarget.ES2020, allowNonTsExtensions: true, checkJs: false, module: monaco.languages.typescript.ModuleKind.ESNext });
    }
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { store.saveScript(path); });
    if (store.reveal?.path === path) {
      const r = store.reveal; store.reveal = null;
      editor.revealLineInCenter(r.line); editor.setPosition({ lineNumber: r.line, column: r.column }); editor.focus();
    }
  };

  return (
    <div data-testid="script-editor" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '3px 8px', fontSize: 11, color: C.faint, borderBottom: `1px solid ${C.border}`, fontFamily: C.mono }}>
        {path}{store.isScriptDirty(path) ? '  ● unsaved (Ctrl/Cmd+S)' : '  saved'}
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
