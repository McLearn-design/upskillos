// Musical views: keyboard, pitch-class circle, staff and plots. All are pure SVG
// renderings of numbers from the shared model.
import { isBlackKey, mod12, midiToName, FLAT_NAMES, SHARP_NAMES } from '../theory/index.js'

// ── Piano ────────────────────────────────────────────────────────────────────
export function Piano({ low = 48, high = 72, color, label, onPress, height = 120 }) {
  const W = 26
  const BW = 16
  const BH = height * 0.62
  const whites = []
  const blacks = []
  let wi = 0
  for (let m = low; m <= high; m++) {
    if (isBlackKey(m)) blacks.push({ m, x: wi * W - BW / 2 })
    else whites.push({ m, x: wi++ * W })
  }
  const width = wi * W
  return (
    <svg viewBox={`0 0 ${width} ${height + 2}`} className="w-full select-none" style={{ maxHeight: height + 40 }}>
      {whites.map(({ m, x }) => {
        const c = color?.(m)
        return (
          <g key={m} onPointerDown={() => onPress?.(m)} className="cursor-pointer">
            <rect x={x + 0.5} y={0.5} width={W - 1} height={height} rx={3} fill={c ?? '#f4f4f5'} stroke="#3f3f46" />
            {label?.(m) && (
              <text x={x + W / 2} y={height - 8} textAnchor="middle" fontSize={9} fill={c ? '#fff' : '#52525b'} fontWeight="600">{label(m)}</text>
            )}
          </g>
        )
      })}
      {blacks.map(({ m, x }) => {
        const c = color?.(m)
        return (
          <g key={m} onPointerDown={() => onPress?.(m)} className="cursor-pointer">
            <rect x={x} y={0.5} width={BW} height={BH} rx={2} fill={c ?? '#18181b'} stroke="#000" />
            {label?.(m) && (
              <text x={x + BW / 2} y={BH - 6} textAnchor="middle" fontSize={8} fill="#fff">{label(m)}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Pitch-class circle ───────────────────────────────────────────────────────
/**
 * 12 pitch classes on a clock. order 'chromatic' (semitone steps) or 'fifths'
 * (7-semitone steps). Active classes are joined into a polygon, so scales and
 * chords show their shape — transposing just rotates the shape.
 */
export function PitchCircle({ active = [], root = null, order = 'chromatic', onToggle, highlight, size = 260, flats = false, labels, showPolygon = true, arrows = [] }) {
  const r = size / 2 - 26
  const c = size / 2
  const pos = (pc) => {
    const k = order === 'fifths' ? mod12(7 * pc) : mod12(pc)
    const a = (k / 12) * 2 * Math.PI - Math.PI / 2
    return [c + r * Math.cos(a), c + r * Math.sin(a)]
  }
  const names = flats ? FLAT_NAMES : SHARP_NAMES
  const sorted = [...new Set(active.map(mod12))].sort((a, b) => (order === 'fifths' ? mod12(7 * a) - mod12(7 * b) : a - b))
  const poly = sorted.map((pc) => pos(pc).join(',')).join(' ')
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full" style={{ maxWidth: size }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#3f3f46" strokeDasharray="2 4" />
      {showPolygon && sorted.length > 1 && <polygon points={poly} fill="rgba(139,92,246,0.18)" stroke="#a78bfa" strokeWidth={2} />}
      {arrows.map(([a, b], i) => {
        const [x1, y1] = pos(a)
        const [x2, y2] = pos(b)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fbbf24" strokeWidth={2.5} markerEnd="url(#mlArrow)" />
      })}
      <defs>
        <marker id="mlArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24" />
        </marker>
      </defs>
      {Array.from({ length: 12 }, (_, pc) => {
        const [x, y] = pos(pc)
        const on = sorted.includes(pc)
        const isRoot = root != null && mod12(root) === pc
        const hl = highlight?.(pc)
        return (
          <g key={pc} onClick={() => onToggle?.(pc)} className={onToggle ? 'cursor-pointer' : ''}>
            <circle cx={x} cy={y} r={17} fill={hl ?? (isRoot ? '#f59e0b' : on ? '#8b5cf6' : '#27272a')} stroke={on || isRoot ? '#ede9fe' : '#52525b'} strokeWidth={1.5} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight="700" fill={on || isRoot || hl ? '#fff' : '#a1a1aa'}>{labels ? labels(pc) : names[pc]}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Staff ────────────────────────────────────────────────────────────────────
const LETTER_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }

/** Diatonic position (C0 = 0) and accidental for a MIDI note in sharp/flat spelling. */
function spell(midi, flats) {
  const name = midiToName(midi, { flats })
  const letter = name[0]
  const acc = name.includes('#') ? '♯' : name.includes('b') ? '♭' : ''
  const octave = Math.floor(midi / 12) - 1
  return { step: octave * 7 + LETTER_INDEX[letter], acc }
}

/**
 * Grand-staff-lite: treble staff (with ledger lines). `stacked` draws all notes
 * at one x (a chord); otherwise notes run left to right (a melody or scale).
 */
export function Staff({ midis = [], stacked = false, flats = false, height = 130, highlight = -1 }) {
  const gap = 8
  const E4 = 4 * 7 + 2 // bottom line of the treble staff
  const top = 30
  const yOf = (step) => top + (E4 + 8 - step) * (gap / 2)
  const noteX = (i) => 60 + (stacked ? 0 : i * 30)
  const width = Math.max(200, stacked ? 140 : 80 + midis.length * 30)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height + 20 }}>
      {[0, 1, 2, 3, 4].map((l) => (
        <line key={l} x1={10} x2={width - 10} y1={yOf(E4 + 2 * l)} y2={yOf(E4 + 2 * l)} stroke="#71717a" />
      ))}
      <text x={14} y={yOf(E4) + 6} fontSize={46} fill="#a1a1aa" fontFamily="serif">𝄞</text>
      {midis.map((m, i) => {
        const { step, acc } = spell(m, flats)
        const x = noteX(i) + (stacked && i > 0 && step - spell(midis[i - 1], flats).step === 1 ? 12 : 0)
        const y = yOf(step)
        const ledgers = []
        for (let s = E4 - 2; s >= step; s -= 2) ledgers.push(s)
        for (let s = E4 + 10; s <= step; s += 2) ledgers.push(s)
        const fill = i === highlight ? '#fbbf24' : '#e4e4e7'
        return (
          <g key={i}>
            {ledgers.map((s) => <line key={s} x1={x - 10} x2={x + 10} y1={yOf(s)} y2={yOf(s)} stroke="#71717a" />)}
            <ellipse cx={x} cy={y} rx={6} ry={4.5} fill={fill} transform={`rotate(-20 ${x} ${y})`} />
            {acc && <text x={x - 16} y={y + 4} fontSize={13} fill={fill}>{acc}</text>}
          </g>
        )
      })}
    </svg>
  )
}

// ── Plots ────────────────────────────────────────────────────────────────────
/** Line plot of y-values in [-yMax, yMax]. */
export function WavePlot({ ys, height = 120, color = '#a78bfa', yMax = 1, grid = true, markers = [] }) {
  const w = 600
  const h = height
  const pts = ys.map((y, i) => `${(i / (ys.length - 1)) * w},${h / 2 - (y / yMax) * (h / 2 - 6)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full rounded-lg bg-zinc-950" style={{ height }}>
      {grid && <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="#27272a" />}
      {markers.map((x, i) => <line key={i} x1={x * w} x2={x * w} y1={0} y2={h} stroke="#3f3f46" strokeDasharray="3 3" />)}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Bar chart of amplitudes (a spectrum). bars: [{ label, value, color? }] */
export function Bars({ bars, height = 120, onSet, max = 1 }) {
  return (
    <div className="flex items-end gap-1 rounded-lg bg-zinc-950 p-2" style={{ height }}>
      {bars.map((b, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
          <div
            className={`w-full rounded-t ${onSet ? 'cursor-ns-resize' : ''}`}
            style={{ height: `${Math.min(1, Math.abs(b.value) / max) * 80}%`, background: b.color ?? '#8b5cf6', minHeight: b.value ? 2 : 0 }}
            onPointerDown={onSet ? (e) => {
              const col = e.currentTarget.parentElement
              const setFrom = (ev) => {
                const rect = col.getBoundingClientRect()
                const v = Math.max(0, Math.min(1, (rect.bottom - ev.clientY - 16) / (rect.height * 0.8)))
                onSet(i, Math.round(v * 100) / 100 * max)
              }
              setFrom(e)
              const move = (ev) => setFrom(ev)
              const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
              window.addEventListener('pointermove', move)
              window.addEventListener('pointerup', up)
            } : undefined}
          />
          <div className="text-[10px] text-zinc-500">{b.label}</div>
        </div>
      ))}
    </div>
  )
}
