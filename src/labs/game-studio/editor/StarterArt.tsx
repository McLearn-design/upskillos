// The starter art library (Kenney, CC0): pick a pack and a folder, then drag an image
// into the viewport (it is added to the project and a Sprite2D is made where you drop
// it), or select several and add them to the project's assets.

import React, { useMemo, useState } from 'react';
import type { Store } from './store';
import { Btn, C, selectStyle, useStore } from './kit';
import { starterPacks } from './starterLibrary';
import { STARTER_DRAG } from './Viewport';

export function StarterArt({ store }: { store: Store }) {
  useStore(store);
  const packs = useMemo(() => starterPacks(), []);
  const [packId, setPackId] = useState(packs[0]?.id ?? '');
  const pack = packs.find((p) => p.id === packId) ?? packs[0];
  const [folderName, setFolderName] = useState(pack?.folders[0]?.name ?? '');
  const folder = pack?.folders.find((f) => f.name === folderName) ?? pack?.folders[0];
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const inProject = new Set(store.project?.assets.map((a) => a.path) ?? []);
  if (!pack || !folder) return null;

  const addPicked = async () => {
    setBusy(true);
    for (const img of folder.images) if (picked.has(img.path)) await store.importStarter(img.path, img.url);
    setPicked(new Set()); setBusy(false);
  };

  return (
    <div data-testid="starter-art" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '6px 8px 4px', display: 'flex', gap: 4 }}>
        <select data-testid="starter-pack" value={pack.id} onChange={(e) => { const p = packs.find((x) => x.id === e.target.value)!; setPackId(p.id); setFolderName(p.folders[0].name); setPicked(new Set()); }} style={{ ...selectStyle, flex: 1 }}>
          {packs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <select data-testid="starter-folder" value={folder.name} onChange={(e) => { setFolderName(e.target.value); setPicked(new Set()); }} style={{ ...selectStyle, width: 88 }}>
          {pack.folders.map((f) => <option key={f.name} value={f.name}>{f.name} ({f.images.length})</option>)}
        </select>
      </div>
      <div style={{ padding: '0 8px 4px', color: C.faint, fontSize: 11, lineHeight: 1.4 }}>{pack.about} Drag one into the scene, or click to pick several. Kenney, CC0.</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 6px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))', gap: 3, alignContent: 'start' }}>
        {folder.images.map((img) => {
          const on = picked.has(img.path), have = inProject.has(img.path);
          return (
            <div key={img.path} data-testid={`starter-${img.path}`} draggable title={`${img.path}${have ? ' (in the project)' : ''}`}
              onDragStart={(e) => { e.dataTransfer.setData(STARTER_DRAG, `${img.path} ${img.url}`); e.dataTransfer.effectAllowed = 'copy'; }}
              onClick={() => setPicked((s) => { const n = new Set(s); if (n.has(img.path)) n.delete(img.path); else n.add(img.path); return n; })}
              style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', background: on ? '#2b4a6e' : C.bg, border: `1px solid ${on ? C.accent : have ? '#3d5a3d' : C.border}`, borderRadius: 3, cursor: 'grab' }}>
              <img src={img.url} alt={img.name} loading="lazy" draggable={false} style={{ maxWidth: '88%', maxHeight: '88%', imageRendering: 'pixelated' }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 6, borderTop: `1px solid ${C.border}` }}>
        <span style={{ flex: 1, color: C.faint, fontSize: 11 }}>{picked.size ? `${picked.size} picked` : `${folder.images.length} images`}</span>
        <Btn small testid="starter-add" disabled={!picked.size || busy || !store.project} onClick={() => void addPicked()}>{busy ? 'Adding…' : 'Add to project'}</Btn>
      </div>
    </div>
  );
}
