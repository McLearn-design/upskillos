// The example project gallery, and the guide shown beside the viewport once a
// project is open.
import React, { useState } from 'react';
import { PROJECTS, PROJECT_GROUPS, type ExampleProject } from '../core/projects';
import { Btn, C } from './kit';

export function ProjectGallery({ onOpen, onClose, busy }: { onOpen: (p: ExampleProject) => void; onClose: () => void; busy: string | null }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000a', display: 'grid', placeItems: 'center', zIndex: 100 }}>
      <div data-testid="project-gallery" onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, width: 900, maxWidth: '94vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: 15 }}>Example projects</b>
            <div style={{ color: C.dim, fontSize: 12, marginTop: 3 }}>Finished scenes to open, play and take apart. Each is built by a script you can read, step through and change; one undo takes it back.</div>
          </div>
          <Btn small onClick={onClose}>Close</Btn>
        </div>
        <div style={{ overflowY: 'auto', padding: '6px 18px 18px' }}>
          {PROJECT_GROUPS.map((g) => (
            <div key={g}>
              <div style={{ color: C.dim, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, margin: '14px 0 8px' }}>{g.toUpperCase()}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {PROJECTS.filter((p) => p.group === g).map((p) => (
                  <button key={p.id} type="button" disabled={!!busy} onClick={() => onOpen(p)} style={{ textAlign: 'left', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px', color: C.text, cursor: busy ? 'wait' : 'pointer', display: 'flex', gap: 10 }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.accent)} onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>{p.icon}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>{p.title}{p.lang === 'python' ? <span style={{ color: C.blue, fontWeight: 400, fontSize: 11 }}> · Python</span> : null}</span>
                      <span style={{ display: 'block', color: C.dim, fontSize: 11.5, lineHeight: 1.4, marginTop: 3 }}>{busy === p.id ? 'Opening…' : p.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** What to look at in the open project. Collapses to its title. */
export function ProjectGuide({ project, onClose, onShowScript }: { project: ExampleProject; onClose: () => void; onShowScript: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div data-testid="project-guide" style={{ position: 'absolute', right: 10, top: 8, width: 320, maxWidth: 'calc(100% - 20px)', background: '#16181cee', border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 12, color: C.dim, zIndex: 2, lineHeight: 1.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{project.icon}</span>
        <b style={{ color: C.text, flex: 1 }}>{project.title}</b>
        <button onClick={() => setOpen(!open)} title={open ? 'Collapse' : 'Show the guide'} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer' }}>{open ? '▾' : '▸'}</button>
        <button onClick={onClose} title="Close the guide" style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 14 }}>×</button>
      </div>
      {open && (
        <>
          <div style={{ margin: '4px 0 6px' }}>{project.desc}</div>
          <div style={{ color: C.text, fontWeight: 600, fontSize: 11, letterSpacing: 0.4 }}>LOOK AND TRY</div>
          <ol style={{ margin: '4px 0 8px 18px', padding: 0 }}>
            {project.guide.map((g, i) => <li key={i} style={{ marginBottom: 4 }}>{g}</li>)}
          </ol>
          <Btn small onClick={onShowScript}>Show how it was built (script)</Btn>
        </>
      )}
    </div>
  );
}
