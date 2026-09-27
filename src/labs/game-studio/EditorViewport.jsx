import { useRef, useState } from 'react';

function EntityShape({ entity, selected, onPointerDown }) {
  const { transform, display, type } = entity;
  const common = {
    transform: `translate(${transform.x} ${transform.y}) rotate(${transform.rotation}) scale(${transform.scaleX} ${transform.scaleY})`,
    onPointerDown,
    className: 'cursor-move',
  };
  const outline = selected ? '#818cf8' : 'transparent';

  if (type === 'text') {
    return (
      <g {...common}>
        <rect x={-display.width / 2} y={-display.height / 2} width={display.width} height={display.height} fill="transparent" stroke={outline} strokeWidth="3" strokeDasharray="8 5" />
        <text fill={display.color} fontSize={display.fontSize} textAnchor="middle" dominantBaseline="middle" className="pointer-events-none select-none">
          {display.text || entity.name}
        </text>
      </g>
    );
  }

  if (type === 'circle') {
    return (
      <circle {...common} cx="0" cy="0" r={Math.min(display.width, display.height) / 2} fill={display.color} stroke={selected ? outline : 'rgba(255,255,255,.25)'} strokeWidth={selected ? 5 : 2} />
    );
  }

  return (
    <rect {...common} x={-display.width / 2} y={-display.height / 2} width={display.width} height={display.height} rx="10" fill={display.color} stroke={selected ? outline : 'rgba(255,255,255,.25)'} strokeWidth={selected ? 5 : 2} />
  );
}

export default function EditorViewport({ project, scene, selectedId, onSelect, onMove }) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);

  function pointFromEvent(event) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }

  function beginDrag(event, entity) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = pointFromEvent(event);
    setDrag({ id: entity.id, dx: point.x - entity.transform.x, dy: point.y - entity.transform.y });
    onSelect(entity.id);
  }

  function moveDrag(event) {
    if (!drag) return;
    const point = pointFromEvent(event);
    onMove(drag.id, {
      x: Math.round(Math.max(0, Math.min(project.settings.width, point.x - drag.dx))),
      y: Math.round(Math.max(0, Math.min(project.settings.height, point.y - drag.dy))),
    });
  }

  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-hidden bg-slate-200 p-4 dark:bg-slate-950/70">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${project.settings.width} ${project.settings.height}`}
        onPointerMove={moveDrag}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        onPointerDown={() => onSelect(null)}
        className="max-h-full max-w-full rounded-xl border border-slate-300 shadow-2xl dark:border-slate-700"
        style={{ aspectRatio: `${project.settings.width} / ${project.settings.height}`, background: project.settings.background, touchAction: 'none' }}
        aria-label="Editable game scene"
      >
        <defs>
          <pattern id="game-studio-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(148,163,184,.12)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#game-studio-grid)" />
        {scene.entities.map((entity) => (
          <EntityShape key={entity.id} entity={entity} selected={selectedId === entity.id} onPointerDown={(event) => beginDrag(event, entity)} />
        ))}
      </svg>
    </div>
  );
}

