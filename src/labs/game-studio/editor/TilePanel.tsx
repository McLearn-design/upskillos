// The TileMap panel (the specification's §40): for the selected TileMapLayer, its tileset, the
// tools (paint, erase, rectangle, bucket fill, pick), and the palette of tiles to paint with. In
// "Solid tiles" mode, clicking a tile in the palette marks it solid or not: the tileset's
// collision, shared by every layer that uses it. Painting itself happens in the viewport.

import React, { useEffect, useRef, useState } from 'react';
import type { Store } from './store';
import { C, NumberField, TextField, selectStyle, useStore } from './kit';
import { propValue } from '../core/registry';
import { tileRect, tilesetGrid } from '../core/tiles';

const btn = (on: boolean): React.CSSProperties => ({ background: on ? C.accent : C.raised, color: on ? '#0b1320' : C.text, border: `1px solid ${on ? C.accent : C.border}`, borderRadius: 3, fontSize: 11, cursor: 'pointer', padding: '1px 7px' });
const TOOLS = [['paint', '✎ Paint', 'Click or drag to paint the chosen tile'], ['erase', '⌫ Erase', 'Click or drag to empty cells'], ['rect', '▭ Rectangle', 'Drag a rectangle to fill with the chosen tile'], ['bucket', '🪣 Bucket', 'Fill the joined area of the same tile (or of empty cells)'], ['pick', '◉ Pick', 'Click a cell to paint with its tile (or Alt-click with any tool)']] as const;

/** A form for a new tileset from one of the project's images. */
function NewTileset({ store, onDone }: { store: Store; onDone: (path: string | null) => void }) {
  const images = store.project?.assets ?? [];
  const [image, setImage] = useState(images.find((a) => /tilemap|sheet|tiles/i.test(a.path))?.path ?? images[0]?.path ?? '');
  const [size, setSize] = useState({ w: 16, h: 16, margin: 0, spacing: 0 });
  const base = image.split('/').pop()?.replace(/\.[a-z]+$/i, '').replace(/[^A-Za-z0-9_-]/g, '_') || 'tiles';
  const [name, setName] = useState('');
  const path = `tilesets/${name || base}.tileset`;
  const a = images.find((x) => x.path === image);
  const grid = a ? tilesetGrid({ tileWidth: size.w, tileHeight: size.h, margin: size.margin, spacing: size.spacing }, a.width, a.height) : null;
  return (
    <div data-testid="new-tileset" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '4px 0' }}>
      {images.length === 0 ? <span style={{ color: C.faint }}>Import a tileset image first: in Starter art, Tiny Dungeon or Pixel Platformer › tilemap has whole sheets of tiles.</span> : <>
        <span style={{ color: C.dim }}>Image</span>
        <select data-testid="new-tileset-image" value={image} onChange={(e) => setImage(e.target.value)} style={{ ...selectStyle, maxWidth: 260 }}>
          {images.map((x) => <option key={x.id} value={x.path}>{x.path.replace(/^assets\//, '')} ({x.width} × {x.height})</option>)}
        </select>
        <span style={{ color: C.dim }}>tile</span>
        <NumberField testid="new-tileset-w" value={size.w} width={40} onCommit={(w) => setSize({ ...size, w: Math.max(1, Math.round(w)) })} /><span style={{ color: C.faint }}>×</span>
        <NumberField testid="new-tileset-h" value={size.h} width={40} onCommit={(h) => setSize({ ...size, h: Math.max(1, Math.round(h)) })} />
        <span style={{ color: C.dim }} title="Pixels round the whole image">margin</span><NumberField value={size.margin} width={34} onCommit={(m) => setSize({ ...size, margin: Math.max(0, Math.round(m)) })} />
        <span style={{ color: C.dim }} title="Pixels between tiles">spacing</span><NumberField testid="new-tileset-spacing" value={size.spacing} width={34} onCommit={(sp) => setSize({ ...size, spacing: Math.max(0, Math.round(sp)) })} />
        <span style={{ color: C.dim }}>name</span><span style={{ width: 110 }}><TextField testid="new-tileset-name" value={name || base} onCommit={(n) => setName(n.trim())} /></span>
        {grid && <span style={{ color: C.faint }}>{grid.columns} × {grid.rows} = {grid.count} tiles</span>}
        <button type="button" data-testid="new-tileset-create" style={btn(false)} disabled={!grid?.count} onClick={() => {
          const ok = store.act((d) => { d.createTileset(path, { image, tileWidth: size.w, tileHeight: size.h, margin: size.margin, spacing: size.spacing }); return true; });
          if (ok) onDone(path);
        }}>Create</button>
      </>}
      <button type="button" style={{ ...btn(false), color: C.dim }} onClick={() => onDone(null)}>Cancel</button>
    </div>
  );
}

/** The tileset's image, enlarged, as a grid of tiles to click. */
function Palette({ store, path }: { store: Store; path: string }) {
  const info = store.tilesetInfo(path)!;
  const canvas = useRef<HTMLCanvasElement>(null);
  const img = store.imageFor(info.data.image);
  const tw = info.data.tileWidth, th = info.data.tileHeight;
  const k = Math.min(4, Math.max(1, Math.ceil(24 / Math.min(tw, th))));   // shown at least 24 px a tile
  const solid = new Set(info.data.solid), chosen = store.tile.tileId, collision = store.tile.collision;
  useEffect(() => {
    const el = canvas.current; if (!el || !img) return;
    el.width = info.columns * tw * k; el.height = info.rows * th * k;
    const g = el.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, el.width, el.height);
    for (let id = 0; id < info.count; id++) {
      const r = tileRect(info.data, info.columns, id), x = (id % info.columns) * tw * k, y = Math.floor(id / info.columns) * th * k;
      g.drawImage(img, r.x, r.y, r.w, r.h, x, y, tw * k, th * k);
      if (solid.has(id)) { g.fillStyle = 'rgba(56,189,248,0.35)'; g.fillRect(x, y, tw * k, th * k); g.strokeStyle = 'rgba(56,189,248,0.95)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, tw * k - 2, th * k - 2); }
      if (id === chosen && !collision) { g.strokeStyle = C.warm; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, tw * k - 3, th * k - 3); }
    }
  });
  const at = (e: React.MouseEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    const col = Math.floor((e.clientX - r.left) / (tw * k)), row = Math.floor((e.clientY - r.top) / (th * k));
    return col >= 0 && col < info.columns && row >= 0 && row < info.rows ? row * info.columns + col : -1;
  };
  if (!img) return <div style={{ color: C.faint }}>Loading {info.data.image}…</div>;
  return (
    <canvas ref={canvas} data-testid="tile-palette" style={{ display: 'block', cursor: 'pointer', imageRendering: 'pixelated', background: 'repeating-conic-gradient(#2a2e35 0 25%, #22252b 0 50%) 0 0 / 16px 16px' }}
      title={collision ? 'Click a tile to make it solid, or not' : 'Click a tile to paint with it'}
      onClick={(e) => {
        const id = at(e); if (id < 0) return;
        if (collision) {
          const next = solid.has(id) ? info.data.solid.filter((x) => x !== id) : [...info.data.solid, id];
          store.act((d) => d.setTileset(path, 'solid', next.sort((a, b) => a - b), `${solid.has(id) ? 'Not solid' : 'Solid'}: tile ${id} of ${path}`));
        } else { store.tile = { ...store.tile, tileId: id, tool: store.tile.tool === 'erase' || store.tile.tool === 'pick' ? 'paint' : store.tile.tool }; store.changed(); }
      }} />
  );
}

export function TilePanel({ store }: { store: Store }) {
  useStore(store);
  const [creating, setCreating] = useState(false);
  const s = store.scene, layer = store.selected?.type === 'TileMapLayer' ? store.selected : null;
  if (!s || !layer) {
    return <div style={{ color: C.faint, fontSize: 12, padding: 4 }}>
      Select a TileMapLayer to paint it (add one with <b>+ Add… › TileMapLayer</b>). Layers are separate TileMapLayer nodes: a floor layer, a walls layer in front of it, and so on.
    </div>;
  }
  const path = propValue('TileMapLayer', layer.props, 'tileset') as string | null;
  const info = store.tilesetInfo(path);
  const tilesets = store.project?.tilesets ?? [];
  return (
    <div data-testid="tile-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingBottom: 4 }}>
        <b>▦ {layer.name}</b>
        <span style={{ color: C.dim }}>tileset</span>
        <select data-testid="tile-tileset" value={path ?? ''} onChange={(e) => store.act((d) => d.setProp(s.id, layer.id, 'tileset', e.target.value || null, `${layer.name}: tileset ${e.target.value || 'none'}`))} style={selectStyle}>
          <option value="">(none)</option>
          {tilesets.map((t) => <option key={t.path} value={t.path}>{t.path.replace(/^tilesets\//, '')}</option>)}
        </select>
        <button type="button" data-testid="tile-new-tileset" style={btn(creating)} onClick={() => setCreating(!creating)}>+ New tileset…</button>
        {info && <>
          <span style={{ width: 1, height: 16, background: C.border }} />
          {TOOLS.map(([t, label, help]) => (
            <button key={t} type="button" data-testid={`tile-tool-${t}`} title={help} style={btn(store.tile.tool === t && !store.tile.collision)} onClick={() => { store.tile = { ...store.tile, tool: t, collision: false }; store.changed(); }}>{label}</button>
          ))}
          <span style={{ width: 1, height: 16, background: C.border }} />
          <button type="button" data-testid="tile-collision" title="Click tiles in the palette to make them solid (bodies stop at them) or not. This is part of the tileset, so every layer using it changes." style={btn(store.tile.collision)}
            onClick={() => { store.tile = { ...store.tile, collision: !store.tile.collision }; store.changed(); }}>■ Solid tiles</button>
          <span style={{ color: C.faint }}>{store.tile.collision ? `${info.data.solid.length} solid` : `tile ${store.tile.tileId}`} · {info.data.tileWidth} × {info.data.tileHeight} px</span>
        </>}
      </div>
      {creating && <NewTileset store={store} onDone={(created) => { setCreating(false); if (created) store.act((d) => d.setProp(s.id, layer.id, 'tileset', created, `${layer.name}: tileset ${created}`)); }} />}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${C.border}`, borderRadius: 3, padding: 4 }}>
        {info && path ? <Palette store={store} path={path} />
          : <div style={{ color: C.faint, padding: 4 }}>{path ? `There is no tileset "${path}".` : 'Choose a tileset, or make one from an image with + New tileset…'}</div>}
      </div>
    </div>
  );
}
