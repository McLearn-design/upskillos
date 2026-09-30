// The 2D viewport: the scene as saved, drawn from the model (ADR 2). It is not a
// running game; it draws what placeNodes() says, which is where the engine will put
// everything.
//
//   left-drag on a node      move it (snapped to the grid if Snap is on); one undo step
//   left-click               select (Shift adds)
//   middle- or right-drag,   pan
//   or Space + drag
//   wheel                    zoom about the pointer
//   drop an image            a new Sprite2D there

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Store } from './store';
import { C, useStore } from './kit';
import { placeNodes, type PlacedNode } from '../core/sceneView';
import { apply, invert, multiply, type Mat2D } from '../core/math2d';
import { propValue } from '../core/registry';
import type { Vec2 } from '../core/types';

interface Camera { x: number; y: number; zoom: number }
export const ASSET_DRAG = 'application/x-game-studio-asset';

/** The pixel box a node is drawn in, in its own coordinates (sprites: the image, centred). */
function localBox(store: Store, p: PlacedNode): { w: number; h: number } | null {
  if (p.node.type !== 'Sprite2D') return null;
  const img = store.imageFor(propValue(p.node.type, p.node.props, 'texture') as string | null);
  return img ? { w: img.naturalWidth, h: img.naturalHeight } : { w: 32, h: 32 };
}

export function Viewport({ store, onFrameRef }: { store: Store; onFrameRef?: (fns: { frameAll: () => void; frameSelected: () => void }) => void }) {
  useStore(store);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cam = useRef<Camera>({ x: 480, y: 270, zoom: 1 });
  const [mouse, setMouse] = useState<Vec2 | null>(null);
  const space = useRef(false);
  const drag = useRef<{ kind: 'pan' | 'move'; sx: number; sy: number; cx: number; cy: number; id?: string; grab?: Vec2; start?: Vec2; parentInv?: Mat2D; moved?: boolean } | null>(null);

  /** Screen (CSS pixels in the canvas) ↔ world. */
  const view = useCallback((): Mat2D => {
    const el = canvas.current!, c = cam.current;
    return [c.zoom, 0, 0, c.zoom, el.clientWidth / 2 - c.x * c.zoom, el.clientHeight / 2 - c.y * c.zoom];
  }, []);
  const toWorld = useCallback((sx: number, sy: number): Vec2 => apply(invert(view()), { x: sx, y: sy }), [view]);

  const draw = useCallback(() => {
    const el = canvas.current, s = store.scene, p = store.project;
    if (!el || !p) return;
    const dpr = window.devicePixelRatio || 1, W = el.clientWidth, H = el.clientHeight;
    if (el.width !== Math.round(W * dpr) || el.height !== Math.round(H * dpr)) { el.width = Math.round(W * dpr); el.height = Math.round(H * dpr); }
    const g = el.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    const v = view(), z = cam.current.zoom;
    const set = (m: Mat2D) => { const t = multiply(v, m); g.setTransform(dpr * t[0], dpr * t[1], dpr * t[2], dpr * t[3], dpr * t[4], dpr * t[5]); };
    // The game area, then the grid over it.
    set([1, 0, 0, 1, 0, 0]);
    g.fillStyle = p.settings.background; g.fillRect(0, 0, p.settings.width, p.settings.height);
    const step = store.grid;
    if (step * z >= 6) {
      const tl = toWorld(0, 0), br = toWorld(W, H);
      g.beginPath();
      for (let x = Math.floor(tl.x / step) * step; x <= br.x; x += step) { g.moveTo(x, tl.y); g.lineTo(x, br.y); }
      for (let y = Math.floor(tl.y / step) * step; y <= br.y; y += step) { g.moveTo(tl.x, y); g.lineTo(br.x, y); }
      g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1 / z; g.stroke();
    }
    g.strokeStyle = 'rgba(90,169,255,0.7)'; g.lineWidth = 1.5 / z; g.strokeRect(0, 0, p.settings.width, p.settings.height);
    if (!s) return;
    const placed = placeNodes(s), sel = new Set(store.selection);
    // Sprites, in the engine's drawing order.
    for (const pn of [...placed].sort((a, b) => a.depth - b.depth)) {
      if (!pn.visible || pn.node.type !== 'Sprite2D') continue;
      const tex = propValue('Sprite2D', pn.node.props, 'texture') as string | null;
      const img = store.imageFor(tex), box = localBox(store, pn)!;
      const fx = propValue('Sprite2D', pn.node.props, 'flipX') ? -1 : 1, fy = propValue('Sprite2D', pn.node.props, 'flipY') ? -1 : 1;
      set(multiply(pn.world, [fx, 0, 0, fy, 0, 0]));
      g.globalAlpha = propValue('Sprite2D', pn.node.props, 'opacity') as number;
      if (img) g.drawImage(img, -box.w / 2, -box.h / 2);
      else { g.setLineDash([4 / z, 3 / z]); g.strokeStyle = C.faint; g.lineWidth = 1 / z; g.strokeRect(-16, -16, 32, 32); g.setLineDash([]); }
      g.globalAlpha = 1;
    }
    // Markers for 2D nodes without a picture, and the selection.
    for (const pn of placed) {
      if (!pn.is2D) continue;
      const o = apply(multiply(v, pn.world), { x: 0, y: 0 });
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const isSel = sel.has(pn.node.id);
      if (pn.node.type !== 'Sprite2D' && pn.node.id !== s.root.id) {
        g.strokeStyle = isSel ? C.warm : pn.node.type === 'CharacterBody2D' ? '#8bd450' : C.dim; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(o.x - 7, o.y); g.lineTo(o.x + 7, o.y); g.moveTo(o.x, o.y - 7); g.lineTo(o.x, o.y + 7); g.stroke();
        if (pn.node.type === 'CharacterBody2D') { g.beginPath(); g.arc(o.x, o.y, 5, 0, Math.PI * 2); g.stroke(); }
      }
      if (isSel) {
        const box = localBox(store, pn);
        if (box) {
          const m = multiply(v, pn.world), pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => apply(m, { x: (a * box.w) / 2, y: (b * box.h) / 2 }));
          g.strokeStyle = C.warm; g.lineWidth = 1.5; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath(); g.stroke();
        }
        g.fillStyle = C.warm; g.beginPath(); g.arc(o.x, o.y, 3, 0, Math.PI * 2); g.fill();
      }
    }
  }, [store, view, toWorld]);

  // Redraw on every change, and when images finish loading.
  useEffect(() => { const id = requestAnimationFrame(draw); return () => cancelAnimationFrame(id); });
  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [draw]);

  const frameRect = useCallback((x0: number, y0: number, x1: number, y1: number) => {
    const el = canvas.current; if (!el) return;
    const w = Math.max(x1 - x0, 32), h = Math.max(y1 - y0, 32);
    cam.current = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, zoom: Math.min(8, Math.max(0.05, Math.min(el.clientWidth / w, el.clientHeight / h) * 0.85)) };
    draw();
  }, [draw]);
  const frameAll = useCallback(() => { const p = store.project; if (p) frameRect(0, 0, p.settings.width, p.settings.height); }, [store, frameRect]);
  const frameSelected = useCallback(() => {
    const s = store.scene; if (!s || !store.selection.length) return frameAll();
    const pts: Vec2[] = [];
    for (const pn of placeNodes(s)) if (store.selection.includes(pn.node.id)) {
      const box = localBox(store, pn) ?? { w: 64, h: 64 };
      for (const [a, b] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) pts.push(apply(pn.world, { x: (a * box.w) / 2, y: (b * box.h) / 2 }));
    }
    frameRect(Math.min(...pts.map((q) => q.x)), Math.min(...pts.map((q) => q.y)), Math.max(...pts.map((q) => q.x)), Math.max(...pts.map((q) => q.y)));
  }, [store, frameRect, frameAll]);
  useEffect(() => { onFrameRef?.({ frameAll, frameSelected }); }, [onFrameRef, frameAll, frameSelected]);
  const projectKey = store.projectId;
  useEffect(() => { requestAnimationFrame(frameAll); }, [projectKey, frameAll]);

  /** The topmost node under a screen point: sprites by their image box, other 2D nodes by their marker. */
  const hit = (sx: number, sy: number): string | null => {
    const s = store.scene; if (!s) return null;
    const placed = placeNodes(s).filter((p) => p.is2D && p.visible && p.node.id !== s.root.id).sort((a, b) => b.depth - a.depth);
    const v = view();
    for (const pn of placed) {
      const box = localBox(store, pn);
      if (box) {
        let q: Vec2; try { q = apply(invert(multiply(v, pn.world)), { x: sx, y: sy }); } catch { continue; }
        if (Math.abs(q.x) <= box.w / 2 && Math.abs(q.y) <= box.h / 2) return pn.node.id;
      } else {
        const o = apply(multiply(v, pn.world), { x: 0, y: 0 });
        if (Math.hypot(o.x - sx, o.y - sy) <= 9) return pn.node.id;
      }
    }
    return null;
  };

  const onDown = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    (e.target as Element).setPointerCapture(e.pointerId);
    if (e.button === 1 || e.button === 2 || space.current) { drag.current = { kind: 'pan', sx, sy, cx: cam.current.x, cy: cam.current.y }; return; }
    const id = hit(sx, sy), s = store.scene;
    if (!id || !s) { if (!e.shiftKey) store.select([]); return; }
    store.select(e.shiftKey ? [...store.selection.filter((x) => x !== id), id] : [id]);
    const pn = placeNodes(s).find((p) => p.node.id === id)!;
    const start = propValue(pn.node.type, pn.node.props, 'position') as Vec2;
    drag.current = { kind: 'move', sx, sy, cx: 0, cy: 0, id, start, grab: toWorld(sx, sy), parentInv: invert(pn.parentWorld) };
  };

  const onMove = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    setMouse(toWorld(sx, sy));
    const d = drag.current; if (!d) return;
    if (d.kind === 'pan') { cam.current = { ...cam.current, x: d.cx - (sx - d.sx) / cam.current.zoom, y: d.cy - (sy - d.sy) / cam.current.zoom }; draw(); return; }
    // A click that wobbles a pixel is still a click: moving starts after 3 pixels.
    if (!d.moved && Math.hypot(sx - d.sx, sy - d.sy) < 3) return;
    d.moved = true;
    // The pointer's movement in the world, turned into the parent's coordinates, added to the start position.
    const w = toWorld(sx, sy);
    const a = apply(d.parentInv!, w), b = apply(d.parentInv!, d.grab!);
    let pos = { x: d.start!.x + a.x - b.x, y: d.start!.y + a.y - b.y };
    if (store.snap) pos = { x: Math.round(pos.x / store.grid) * store.grid, y: Math.round(pos.y / store.grid) * store.grid };
    store.doc!.beginLive();
    store.doc!.liveProp(store.sceneId!, d.id!, 'position', pos);
  };

  const onUp = () => {
    const d = drag.current; drag.current = null;
    if (d?.kind === 'move' && store.doc && store.sceneId) {
      const n = store.doc.node(store.sceneId, d.id!);
      store.doc.endLive(`Move ${n?.name}`, store.sceneId, d.id!, ['position']);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = canvas.current!.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const before = toWorld(sx, sy);
    const zoom = Math.min(16, Math.max(0.05, cam.current.zoom * Math.exp(-e.deltaY * 0.0015)));
    cam.current.zoom = zoom;
    const after = toWorld(sx, sy);
    cam.current = { ...cam.current, x: cam.current.x + before.x - after.x, y: cam.current.y + before.y - after.y };
    draw();
  };

  const onDrop = (e: React.DragEvent) => {
    const path = e.dataTransfer.getData(ASSET_DRAG);
    const s = store.scene; if (!path || !s) return;
    e.preventDefault();
    const r = canvas.current!.getBoundingClientRect();
    let w = toWorld(e.clientX - r.left, e.clientY - r.top);
    if (store.snap) w = { x: Math.round(w.x / store.grid) * store.grid, y: Math.round(w.y / store.grid) * store.grid };
    const name = path.split('/').pop()!.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9]+(.)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toUpperCase()) || 'Sprite';
    store.addNode('Sprite2D', { parentId: s.root.id, name, props: { position: w, texture: path } });
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target as HTMLElement).closest('input, textarea, .monaco-editor')) space.current = true; };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') space.current = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  return (
    <div ref={wrap} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas ref={canvas} data-testid="viewport" style={{ width: '100%', height: '100%', display: 'block', cursor: drag.current?.kind === 'pan' ? 'grabbing' : 'default' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => setMouse(null)} onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()} onDragOver={(e) => { if (e.dataTransfer.types.includes(ASSET_DRAG)) e.preventDefault(); }} onDrop={onDrop} />
      {!store.scene && store.project && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: C.dim, fontSize: 13, pointerEvents: 'none' }}>
          This project has no scene yet. Scene › New scene makes one.
        </div>
      )}
      <div style={{ position: 'absolute', left: 8, bottom: 6, color: C.faint, fontFamily: C.mono, fontSize: 11, pointerEvents: 'none' }}>
        {mouse ? `x ${Math.round(mouse.x)}  y ${Math.round(mouse.y)}` : ''}{`   zoom ${Math.round(cam.current.zoom * 100)}%`}
      </div>
    </div>
  );
}
