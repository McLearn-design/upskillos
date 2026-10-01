// The project's files (the specification's §18): scenes, scripts and images. Click a
// scene or script to open it; drag an image into the viewport to make a Sprite2D.

import React, { useRef, useState } from 'react';
import type { Store } from './store';
import { Btn, C, useStore } from './kit';
import { ASSET_DRAG } from './Viewport';

function Group({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 8px 2px', color: C.faint, fontSize: 11, fontWeight: 700, letterSpacing: 0.4 }}>
        <span style={{ flex: 1 }}>{title}</span>{action}
      </div>
      {children}
    </div>
  );
}

// Long names shorten with "…" so the buttons at the end of a row (★, ⧉) stay in view.
const item = (active: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px 2px 14px', fontSize: 12, cursor: 'pointer', background: active ? '#2b4a6e' : 'transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 });

export function Files({ store }: { store: Store }) {
  useStore(store);
  const p = store.project;
  const file = useRef<HTMLInputElement>(null);
  const [naming, setNaming] = useState<'scene' | 'script' | null>(null);
  if (!p) return null;

  const create = (kind: 'scene' | 'script', raw: string) => {
    setNaming(null);
    const stem = raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    if (!stem) return;
    if (kind === 'scene') store.createScene(`scenes/${stem}.scene`);
    else { store.act((d) => d.writeScript(`scripts/${stem}.js`, `// ${stem}.js\n`, `New script scripts/${stem}.js`)); store.openScript(`scripts/${stem}.js`); }
  };
  const namer = (kind: 'scene' | 'script') => naming === kind && (
    <input autoFocus data-testid={`new-${kind}-name`} placeholder={kind === 'scene' ? 'level_1' : 'utils'}
      onBlur={(e) => create(kind, e.target.value)}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setNaming(null); }}
      style={{ margin: '2px 8px 4px 14px', width: 'calc(100% - 22px)', background: C.bg, color: C.text, border: `1px solid ${C.accent}`, fontSize: 12, padding: '1px 4px' }} />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        <Group title="scenes/" action={<Btn small testid="new-scene" onClick={() => setNaming('scene')} title="New scene">+</Btn>}>
          {p.scenes.map((s) => (
            <div key={s.id} data-testid={`file-${s.path}`} onClick={() => store.openScene(s.id)} style={item(store.sceneId === s.id && store.tab.kind === 'scene')}>
              <span>🎬</span><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.path.replace(/^scenes\//, '')}</span>
              {p.settings.mainScene === s.path
                ? <span title="The main scene: Run Project starts here" style={{ color: C.warn }}>★</span>
                : <span title="Make this the main scene" onClick={(e) => { e.stopPropagation(); store.act((d) => d.setMainScene(s.path)); }} style={{ color: C.faint }}>☆</span>}
              {store.sceneId && store.sceneId !== s.id && (
                <span data-testid={`instance-${s.path}`} title={`Put an instance of ${s.path} into the scene you are editing (under the selected node). Changing ${s.path} later changes every instance.`}
                  onClick={(e) => { e.stopPropagation(); store.addInstance(s.path); }} style={{ color: C.accent, cursor: 'pointer', marginLeft: 4 }}>⧉</span>
              )}
            </div>
          ))}
          {namer('scene')}
        </Group>
        <Group title="scripts/" action={<Btn small onClick={() => setNaming('script')} title="New script file">+</Btn>}>
          {p.scripts.map((x) => (
            <div key={x.path} data-testid={`file-${x.path}`} onClick={() => store.openScript(x.path)} style={item(store.tab.kind === 'script' && store.tab.path === x.path)}>
              <span style={{ color: C.warn, fontSize: 10 }}>JS</span><span>{x.path.replace(/^scripts\//, '')}{store.isScriptDirty(x.path) ? ' ●' : ''}</span>
            </div>
          ))}
          {namer('script')}
        </Group>
        {(p.tilesets ?? []).length > 0 && (
          <Group title="tilesets/">
            {(p.tilesets ?? []).map((t) => (
              <div key={t.path} data-testid={`file-${t.path}`} title={`${t.image}, tiles ${t.tileWidth} × ${t.tileHeight}, ${t.solid.length} solid. Edit it in the TileMap panel with a TileMapLayer that uses it selected.`} style={item(false)}>
                <span style={{ color: C.accent, fontSize: 10 }}>▦</span><span>{t.path.replace(/^tilesets\//, '')}</span>
              </div>
            ))}
          </Group>
        )}
        <Group title="assets/" action={<Btn small testid="import-image" onClick={() => file.current?.click()} title="Import images (PNG, JPEG, WebP, GIF), or a Tiled map (.tmx or .tmj) with its tileset files (.tsx, .tsj): choose them together">Import…</Btn>}>
          <input ref={file} data-testid="import-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,.tmx,.tmj,.tsx,.tsj" multiple style={{ display: 'none' }}
            onChange={async (e) => { await store.importFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
          {p.assets.map((a) => {
            const img = store.images.get(a.id);
            return (
              <div key={a.id} data-testid={`asset-${a.path}`} draggable onDragStart={(e) => { e.dataTransfer.setData(ASSET_DRAG, a.path); e.dataTransfer.effectAllowed = 'copy'; }}
                title={`${a.path} · ${a.width} × ${a.height}. Drag into the viewport to make a Sprite2D.`} style={item(false)}>
                {img ? <img src={img.src} alt="" style={{ width: 18, height: 18, objectFit: 'contain', imageRendering: 'pixelated' }} /> : <span>🖼</span>}
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.path.replace(/^assets\//, '')}</span>
              </div>
            );
          })}
          {!p.assets.length && <div style={{ padding: '2px 14px', color: C.faint, fontSize: 11 }}>No images yet.</div>}
        </Group>
      </div>
    </div>
  );
}
