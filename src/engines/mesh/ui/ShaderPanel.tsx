// The shader of the selected object: the whole GLSL program, with the part that
// defines the model (the body of shade) editable for the custom shader.
import React, { useEffect, useState } from 'react';
import type { Editor } from '../core/Editor';
import type { Viewport } from '../render/Viewport';
import { DEFAULT_CUSTOM, SHADER_INFO, fragmentShader } from '../core/shading';
import { Btn, C, useEditorVersion } from './kit';

export function ShaderPanel({ editor, viewport }: { editor: Editor; viewport: Viewport | null }) {
  useEditorVersion(editor);
  const o = editor.activeObject;
  const [draft, setDraft] = useState<string | null>(null);
  const [, bump] = useState(0);
  useEffect(() => { if (!viewport) return; viewport.onShaderError = () => bump((n) => n + 1); return () => { viewport.onShaderError = undefined; }; }, [viewport]);
  useEffect(() => setDraft(null), [o?.id, o?.material.glsl]);
  if (!o?.mesh) return <div style={{ padding: 14, color: C.faint }}>Select a mesh to see its shader.</div>;
  const model = o.material.shader ?? 'pbr';
  const info = SHADER_INFO[model];
  const body = draft ?? o.material.glsl ?? DEFAULT_CUSTOM;
  const error = viewport?.shaderErrors.get(o.id);
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ width: 320, padding: '10px 14px', borderRight: `1px solid ${C.border}`, overflowY: 'auto', fontSize: 12, color: C.dim, lineHeight: 1.6, flexShrink: 0 }}>
        <b style={{ color: C.text }}>{info.label}</b>
        <div style={{ fontFamily: C.mono, color: C.text, background: C.bg, borderRadius: 4, padding: '6px 8px', margin: '6px 0' }}>{info.equation}</div>
        <div>{info.about}</div>
        <div style={{ marginTop: 8, color: C.faint }}>N is the surface normal, L the direction to the light (the scene's sun), V the direction to the eye, all unit vectors in world space. The shader runs once per pixel on the GPU.</div>
        {model === 'pbr' && <div style={{ marginTop: 8 }}>PBR is three.js's own material; its code is long and generated. Choose Lambert, Blinn–Phong or Custom in the inspector's Material section to see and change a shader here.</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {model === 'custom' ? (
          <>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 8px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.dim, fontSize: 11, fontFamily: C.mono }}>vec3 shade(vec3 N, vec3 L, vec3 V, vec2 uv, vec3 base, vec3 light) {'{'}</span>
              <span style={{ flex: 1 }} />
              <Btn small active disabled={draft === null} onClick={() => { if (draft !== null) editor.setMaterial(o.id, { glsl: draft }); }} title="Compile and use it (Ctrl+Enter)">Apply</Btn>
              <Btn small onClick={() => { setDraft(null); editor.setMaterial(o.id, { glsl: DEFAULT_CUSTOM }); }}>Reset</Btn>
            </div>
            <textarea data-testid="shader-body" value={body} spellCheck={false} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && draft !== null) { e.preventDefault(); editor.setMaterial(o.id, { glsl: draft }); } }}
              style={{ flex: 1, background: C.bg, color: C.text, border: 'none', padding: '8px 12px', fontFamily: C.mono, fontSize: 12.5, lineHeight: 1.5, resize: 'none', outline: 'none' }} />
            {error && <div data-testid="shader-error" style={{ color: C.bad, fontFamily: C.mono, fontSize: 11.5, padding: '6px 10px', borderTop: `1px solid ${C.border}`, whiteSpace: 'pre-wrap', maxHeight: 90, overflowY: 'auto' }}>Did not compile (showing Lambert until it does):{'\n'}{error.message}</div>}
          </>
        ) : model !== 'pbr' ? (
          <pre style={{ margin: 0, flex: 1, overflow: 'auto', background: C.bg, color: C.text, padding: '8px 12px', fontFamily: C.mono, fontSize: 12 }}>{fragmentShader(model, undefined, !o.smooth).trim()}</pre>
        ) : <div style={{ padding: 14, color: C.faint }}>No readable shader for PBR.</div>}
      </div>
    </div>
  );
}
