import { useEffect, useRef, useState } from 'react';

function remembered(key, fallback) {
  try { const value = Number(localStorage.getItem(key)); return value > 0 ? value : fallback; }
  catch { return fallback; }
}
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function Divider({ label, value, min, max, direction, onChange, C }) {
  const drag = useRef(null);
  return <div role="separator" aria-label={label} aria-orientation="vertical" tabIndex={0}
    aria-valuemin={Math.round(min)} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(value)}
    aria-valuetext={`${Math.round(value)} pixels wide`}
    title={`${label}: drag or use Left/Right arrows`}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault();
      drag.current = { x: event.clientX, value };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => { if (drag.current) onChange(clamp(drag.current.value + direction * (event.clientX - drag.current.x), min, max)); }}
    onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
    onPointerCancel={() => { drag.current = null; }}
    onLostPointerCapture={() => { drag.current = null; }}
    onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); onChange(clamp(value + direction * (event.key === 'ArrowRight' ? 20 : -20), min, max));
    }}
    style={{ width: 7, flexShrink: 0, cursor: 'col-resize', touchAction: 'none', background: C.border, outlineOffset: -2 }} />;
}

export default function StudioPanes({ explorer, editor, lesson, explorerVisible, C }) {
  const host = useRef(null);
  const [width, setWidth] = useState(1000);
  const [explorerWidth, setExplorerWidth] = useState(() => remembered('project-studio:explorer-width', 210));
  const [lessonWidth, setLessonWidth] = useState(() => remembered('project-studio:lesson-width', 440));
  useEffect(() => {
    const measure = () => setWidth(host.current.getBoundingClientRect().width || 1000);
    measure(); const observer = new ResizeObserver(measure); observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { try { localStorage.setItem('project-studio:explorer-width', String(explorerWidth)); localStorage.setItem('project-studio:lesson-width', String(lessonWidth)); } catch {} }, [explorerWidth, lessonWidth]);
  const minimumEditor = Math.min(220, width * 0.35);
  const minimumLesson = Math.min(200, width * 0.3);
  const minimumExplorer = Math.min(120, width * 0.2);
  const left = explorerVisible ? clamp(explorerWidth, minimumExplorer, Math.max(minimumExplorer, width - minimumEditor - (lesson ? minimumLesson + 7 : 0) - 7)) : 0;
  const maxLesson = Math.max(minimumLesson, width - minimumEditor - (explorerVisible ? left + 7 : 0) - 7);
  const right = lesson ? clamp(lessonWidth, minimumLesson, maxLesson) : 0;
  return <div ref={host} style={{ display: 'flex', flex: 1, height: '100%', minHeight: 0, minWidth: 0, overflow: 'hidden', position: 'relative', isolation: 'isolate', background: C.canvasSurface || (C.dark ? '#1e293b' : '#ffffff') }}>
    {explorerVisible && <>
      <div data-pane="explorer" style={{ width: left, flexShrink: 0, minHeight: 0, overflow: 'hidden', background: C.surface }}>{explorer}</div>
      <Divider label="Resize file explorer" value={left} min={minimumExplorer} max={Math.max(minimumExplorer, width - minimumEditor - right - (lesson ? 14 : 7))} direction={1} onChange={setExplorerWidth} C={C} />
    </>}
    <div data-pane="editor" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{editor}</div>
    {lesson && <>
      <Divider label="Resize lesson" value={right} min={minimumLesson} max={maxLesson} direction={-1} onChange={setLessonWidth} C={C} />
      <div data-pane="lesson" style={{ width: right, flexShrink: 0, minHeight: 0, overflow: 'hidden' }}>{lesson}</div>
    </>}
  </div>;
}
