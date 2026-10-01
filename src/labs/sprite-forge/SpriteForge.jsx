import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SpriteCanvas from './SpriteCanvas.jsx'
import ToolRail from './ToolRail.jsx'
import PalettePanel from './PalettePanel.jsx'
import FrameStrip, { AnimationPreview, usePlayback } from './FrameStrip.jsx'
import ExportPanel from './ExportPanel.jsx'
import SpriteLibrary from './SpriteLibrary.jsx'
import ImportDialog from './ImportDialog.jsx'
import {
  MAX_SIZE,
  MIN_SIZE,
  TRANSPARENT,
  clampSize,
  createDoc,
  normalizeDoc,
  totalDuration,
} from './pixelDoc.js'
import { useAutosave, useSpriteDoc } from './useSpriteDoc.js'
import { getPref, loadSprite, saveSprite, setPref } from './db.js'
import { useOpenLab } from '../../components/desktop/useOpenLab.js'
import { listenForArt, sendArt } from '../../utils/artBridge.js'
import { docFromBlob, spriteMessage } from './gameStudio.js'
import { SPRITE_API_NAMES, cmd, runSpriteCode } from './spriteApi.js'
import { EXAMPLES } from './examples.js'
import CodeLogPanel from '../../components/ui/CodeLogPanel.jsx'

const SIZE_PRESETS = [8, 16, 24, 32, 48, 64]

export default function SpriteForge({ onBack }) {
  const { doc, act, log, start, apply, undo, redo, replaceDoc, canUndo, canRedo } = useSpriteDoc()
  // Nothing may be written to storage until the attempt to restore the previous
  // session has settled. Otherwise the blank document this hook starts with
  // races the restore: it saves itself, overwrites "last opened", and the real
  // sprite is still on disk but no longer findable.
  const [ready, setReady] = useState(false)
  const saveStatus = useAutosave(doc, { enabled: ready })

  const [frameIndex, setFrameIndex] = useState(0)
  const [tool, setTool] = useState('pencil')
  const [value, setValue] = useState(1)
  const [brushSize, setBrushSize] = useState(1)
  const [symmetry, setSymmetry] = useState({ mirrorX: false, mirrorY: false })
  const [showGrid, setShowGrid] = useState(true)
  const [onionSkin, setOnionSkin] = useState(false)
  const [tileGuide, setTileGuide] = useState(0)
  const [zoom, setZoom] = useState(0)
  const [hover, setHover] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [previewScale, setPreviewScale] = useState(2)
  const [applyToAll, setApplyToAll] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const canvasRef = useRef(null)

  const [playbackIndex] = usePlayback(doc, playing)

  const frame = doc.frames[Math.min(frameIndex, doc.frames.length - 1)]

  // Reopen whatever was last being worked on. A lab that greets you with a
  // blank canvas every time is a lab you cannot use for anything that takes
  // more than one sitting.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const lastId = await getPref('lastSpriteId')
        const existing = lastId ? await loadSprite(lastId) : null
        if (existing && !cancelled) replaceDoc(existing)
      } catch {
        // A sprite that will not load should not block the editor from opening.
      } finally {
        // Marked ready in the same update as the restore, so the effect below
        // records the restored id rather than the blank one it replaced.
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [replaceDoc])

  useEffect(() => {
    if (ready) setPref('lastSpriteId', doc.id)
  }, [doc.id, ready])

  // Game Studio asks for a new sprite, or sends one of its pictures to edit (src/utils/artBridge.js).
  // Taken only once the restore above has settled, so the restored sprite cannot replace it.
  const openLab = useOpenLab()
  const [bridgeNote, setBridgeNote] = useState('')
  useEffect(() => {
    if (!ready) return undefined
    return listenForArt('sprite-forge', async (m) => {
      try {
        if (m.type === 'new-sprite') {
          replaceDoc({ ...createDoc({ width: 32, height: 32, name: m.name }), link: m.link })
        } else if (m.type === 'edit-sprite') {
          // Made here before: open the original, frames and all. Otherwise read the picture.
          const original = m.doc ? await loadSprite(m.doc) : null
          replaceDoc(original ? { ...original, link: m.link } : await docFromBlob(m.blob, m.name, m.link))
        } else return
        setFrameIndex(0)
        setBridgeNote(`For Game Studio (${m.link?.projectName ?? 'a project'}): Send to Game Studio when it is done`)
      } catch (e) {
        setBridgeNote(e instanceof Error ? e.message : String(e))
      }
    })
  }, [ready, replaceDoc])

  // Every frame as a PNG, with its timing and tags; Game Studio adds them, or updates the picture this came from.
  const sendToGameStudio = async () => {
    try {
      await saveSprite(doc) // so Edit in Sprite Forge can open this document again later
      sendArt('game-studio', await spriteMessage(doc))
      setBridgeNote(`Sent to Game Studio${doc.link?.projectName ? ` (${doc.link.projectName})` : ''}`)
      await openLab('game-studio')
    } catch (e) {
      setBridgeNote(e instanceof Error ? e.message : String(e))
    }
  }

  // Deleting frames can leave the edit cursor past the end of the array.
  useEffect(() => {
    if (frameIndex > doc.frames.length - 1) setFrameIndex(doc.frames.length - 1)
  }, [doc.frames.length, frameIndex])

  // Which palette entries appear in the current frame — the palette panel marks
  // the rest, which is how you notice a shade you meant to use and did not, or
  // one you can safely retire.
  const colorUsage = useMemo(() => {
    const used = new Uint8Array(doc.palette.length + 1)
    for (let i = 0; i < frame.pixels.length; i++) used[frame.pixels[i]] = 1
    return used
  }, [frame, doc.palette.length])

  const fps = useMemo(() => {
    const avg = totalDuration(doc) / doc.frames.length
    return Math.max(1, Math.round(1000 / avg))
  }, [doc])

  // --- edits --------------------------------------------------------------

  const commitPixels = useCallback(
    (pixels) => {
      act((d) => cmd.paint(d, frameIndex, pixels))
    },
    [act, frameIndex],
  )

  // Frame transforms respect the "all frames" switch, because a flip or a nudge
  // that has to be repeated by hand across eight frames of a walk cycle is how
  // frames drift out of alignment in the first place. Each is a named command
  // (spriteApi.js), so it is logged as the line that makes it.
  const which = applyToAll ? 'all' : frameIndex
  const transform = (name, ...args) => act((d) => cmd[name](d, ...args, which))
  const clearFrame = () => transform('clear')

  const newSprite = (opts) => {
    replaceDoc(createDoc(opts))
    setFrameIndex(0)
    setValue(1)
    setLibraryOpen(false)
  }

  // An example is code on the sprite API, run on an empty sprite: the Code panel shows how it was drawn.
  const openExample = (ex) => {
    replaceDoc(createDoc({ width: ex.width, height: ex.height, name: ex.title }))
    const err = act({ label: `Example: ${ex.title}`, code: ex.code, run: (d) => runSpriteCode(d, ex.code) })
    setFrameIndex(0)
    setCodeOpen(true)
    setBridgeNote(err ?? `${ex.title}: ${ex.about}`)
  }

  const openSprite = async (id) => {
    const next = await loadSprite(id)
    if (next) {
      replaceDoc(next)
      setFrameIndex(0)
      setLibraryOpen(false)
    }
  }

  const importProjectFile = async (file) => {
    const text = await file.text()
    replaceDoc(normalizeDoc(JSON.parse(text)))
    setFrameIndex(0)
  }

  // Imported frames arrive as bare pixel arrays; whether they replace the
  // document or extend it is the user's call in the dialog.
  const applyImport = ({ frames, palette, mode }) => {
    act((d) => cmd.importFrames(d, mode, frames, palette))
    setImportOpen(false)
  }

  // --- keyboard -----------------------------------------------------------

  useEffect(() => {
    const onKey = (e) => {
      // Never steal a keystroke that is going into a text field — the frame
      // duration and tag name inputs contain letters and digits that collide
      // with almost every shortcut here.
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (e.ctrlKey || e.metaKey) return

      const k = e.key
      if (k === '[') return setBrushSize((s) => Math.max(1, s - 1))
      if (k === ']') return setBrushSize((s) => Math.min(8, s + 1))
      if (k === ',') return setFrameIndex((i) => Math.max(0, i - 1))
      if (k === '.') return setFrameIndex((i) => Math.min(doc.frames.length - 1, i + 1))
      if (k === 'Enter') {
        e.preventDefault()
        return setPlaying((p) => !p)
      }
      if (k === "'") return setShowGrid((g) => !g)
      if (k === ';') return setOnionSkin((o) => !o)
      if (k === 'X' && e.shiftKey) return setSymmetry((s) => ({ ...s, mirrorX: !s.mirrorX }))
      if (k === 'Y' && e.shiftKey) return setSymmetry((s) => ({ ...s, mirrorY: !s.mirrorY }))
      if (e.altKey && k.toLowerCase() === 'n') {
        e.preventDefault()
        act((d) => cmd.addFrame(d, frameIndex, { copy: true }))
        setFrameIndex((i) => i + 1)
        return
      }
      // Digits pick a palette entry; 0 picks transparent, matching its actual
      // pixel value rather than an off-by-one keyboard mapping.
      if (/^[0-9]$/.test(k)) {
        const n = Number(k)
        if (n === 0) return setValue(TRANSPARENT)
        if (n <= doc.palette.length) return setValue(n)
        return undefined
      }

      const lower = k.toLowerCase()
      const map = {
        b: 'pencil',
        e: 'eraser',
        g: 'fill',
        l: 'line',
        r: e.shiftKey ? 'rectFill' : 'rect',
        o: e.shiftKey ? 'ellipseFill' : 'ellipse',
        i: 'picker',
        h: 'pan',
      }
      if (map[lower]) setTool(map[lower])
      return undefined
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, act, frameIndex, doc.frames.length, doc.palette.length])

  // --- chrome -------------------------------------------------------------

  const headerBtn =
    'rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <div className="flex h-full w-full flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        {onBack && (
          <button type="button" onClick={onBack} className={headerBtn} title="Back to labs">
            ← Labs
          </button>
        )}
        <span className="text-sm">🧿</span>
        <input
          value={doc.name}
          onChange={(e) => apply((prev) => ({ ...prev, name: e.target.value }))}
          className="w-44 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold hover:border-slate-300 focus:border-brand-500 focus:outline-none dark:hover:border-slate-700"
          title="Sprite name — also the export file name"
        />

        <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />

        <button type="button" onClick={undo} disabled={!canUndo} className={headerBtn} title="Undo (Ctrl+Z)">
          ↶
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} className={headerBtn} title="Redo (Ctrl+Shift+Z)">
          ↷
        </button>

        <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Canvas size. Changing it re-anchors existing art top-left rather than
            resampling it — scaling pixel art destroys it, so the safe default is
            to crop or pad and let the artist move things. */}
        <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={doc.width}
            onChange={(e) => act((d) => cmd.resize(d, e.target.value, d.height))}
            className="w-14 rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-[11px] dark:border-slate-600 dark:bg-slate-800"
          />
          ×
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={doc.height}
            onChange={(e) => act((d) => cmd.resize(d, d.width, e.target.value))}
            className="w-14 rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-[11px] dark:border-slate-600 dark:bg-slate-800"
          />
        </label>
        <select
          value=""
          onChange={(e) => {
            const s = clampSize(e.target.value)
            act((d) => cmd.resize(d, s, s))
          }}
          className="rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          title="Square size presets"
        >
          <option value="">preset…</option>
          {SIZE_PRESETS.map((s) => (
            <option key={s} value={s}>
              {s}×{s}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            data-testid="sprite-forge-send"
            onClick={sendToGameStudio}
            className={`${headerBtn} font-semibold text-fuchsia-700 dark:text-fuchsia-300`}
            title={doc.link?.asset
              ? `Update ${doc.link.asset} in Game Studio${doc.link.projectName ? ` (${doc.link.projectName})` : ''}: every node using it shows the new picture`
              : 'Add this sprite to the project open in Game Studio: one image per frame, and an AnimatedSprite2D when it has several'}
          >
            Send to Game Studio
          </button>
          <button type="button" onClick={() => setImportOpen(true)} className={headerBtn} title="Import a PNG — including slicing an existing sheet back into frames">
            Import image
          </button>
          <label className={`${headerBtn} cursor-pointer`} title="Open a .sprite.json project file">
            Open file
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importProjectFile(f).catch(() => {})
                e.target.value = ''
              }}
            />
          </label>
          <select
            data-testid="sprite-forge-examples"
            value=""
            onChange={(e) => { const ex = EXAMPLES.find((x) => x.id === e.target.value); if (ex) openExample(ex) }}
            className="rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            title="Example sprites, drawn by code: open one and read how in the Code panel"
          >
            <option value="">Examples…</option>
            {EXAMPLES.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
          </select>
          <button type="button" data-testid="sprite-forge-code-toggle" onClick={() => setCodeOpen(!codeOpen)} className={headerBtn} title="GUI → code: every edit as the line of code that makes it, and a box to run your own">
            {'</> Code'}{log.length ? ` (${log.length})` : ''}
          </button>
          <button type="button" onClick={() => setLibraryOpen(true)} className={headerBtn}>
            Sprites…
          </button>
          <span
            className="ml-1 font-mono text-[10px] text-slate-400"
            title="Every change is saved to this browser automatically"
          >
            {saveStatus === 'saved' ? '● saved' : saveStatus === 'error' ? '● local save failed' : '○ saving'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        <ToolRail
          tool={tool}
          onSelectTool={setTool}
          brushSize={brushSize}
          onBrushSize={setBrushSize}
          symmetry={symmetry}
          onSymmetry={setSymmetry}
          showGrid={showGrid}
          onShowGrid={setShowGrid}
          onionSkin={onionSkin}
          onOnionSkin={setOnionSkin}
          tileGuide={tileGuide}
          onTileGuide={setTileGuide}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <SpriteCanvas
              ref={canvasRef}
              doc={doc}
              frameIndex={frameIndex}
              tool={tool}
              value={value}
              brushSize={brushSize}
              symmetry={symmetry}
              showGrid={showGrid}
              tileGuide={tileGuide}
              onionSkin={onionSkin}
              onStrokeCommit={commitPixels}
              onPickValue={setValue}
              onHoverChange={setHover}
              onViewChange={setZoom}
            />
          </div>

          {codeOpen && (
            <CodeLogPanel
              testid="sprite-forge-code"
              log={log}
              start={`from ${start.name}, ${start.width} × ${start.height}, ${start.frames.length} frame${start.frames.length === 1 ? '' : 's'}, as it was opened`}
              run={runSpriteCode}
              onRun={act}
              onClose={() => setCodeOpen(false)}
              placeholder={`sprite.paint(${frameIndex}, [[0, 0, 1]])   ·   for (let x = 0; x < sprite.width; x++) sprite.paint(${frameIndex}, [[x, sprite.height - 1, 2]])`}
              help={`The sprite API: ${SPRITE_API_NAMES.map((n) => `sprite.${n}`).join(', ')}; and sprite.width, sprite.height, sprite.frames, sprite.colors. Colour 0 is transparent; n is the nth swatch.`}
            />
          )}

          {/* Status bar */}
          <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 px-3 py-1 font-mono text-[10px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span className="w-24">
              {hover?.inside ? `${hover.x}, ${hover.y}` : '—'}
            </span>
            <span>
              {doc.width}×{doc.height}
            </span>
            <span>frame {frameIndex}</span>
            <button type="button" onClick={() => canvasRef.current?.zoomOut()} className="px-1 hover:text-slate-800 dark:hover:text-slate-100">
              −
            </button>
            <span className="w-10 text-center">{zoom}x</span>
            <button type="button" onClick={() => canvasRef.current?.zoomIn()} className="px-1 hover:text-slate-800 dark:hover:text-slate-100">
              +
            </button>
            <button type="button" onClick={() => canvasRef.current?.fit()} className="px-1 hover:text-slate-800 dark:hover:text-slate-100">
              fit
            </button>
            {bridgeNote && (
              <span data-testid="sprite-forge-note" className="truncate text-fuchsia-700 dark:text-fuchsia-300">
                {bridgeNote}
              </span>
            )}
            <span className="ml-auto hidden sm:inline">
              right-drag erases · space+drag or middle-drag pans · wheel zooms
            </span>
          </div>
        </div>

        {/* Right column */}
        <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
          <PalettePanel
            doc={doc}
            value={value}
            colorUsage={colorUsage}
            onSelectValue={setValue}
            onEditColor={(i, hex) => act((d) => cmd.color(d, i, hex))}
            onAddColor={() => {
              act((d) => cmd.addColor(d))
              setValue(doc.palette.length + 1)
            }}
            onRemoveColor={(i) => {
              act((d) => cmd.removeColor(d, i))
              setValue(TRANSPARENT)
            }}
            onApplyPreset={(preset) => act((d) => cmd.palette(d, preset.colors, preset.id))}
          />

          <AnimationPreview
            doc={doc}
            index={playing ? playbackIndex : frameIndex}
            scale={previewScale}
            onScale={setPreviewScale}
            playing={playing}
            onTogglePlay={() => setPlaying((p) => !p)}
            fps={fps}
          />

          {/* Transforms */}
          <div className="flex flex-col gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Transform
              </h3>
              <label className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                  className="h-3 w-3"
                />
                all frames
              </label>
            </div>
            <div className="grid grid-cols-4 gap-1">
              <TBtn onClick={() => transform('flipH')} title="Flip horizontally">
                ⇔
              </TBtn>
              <TBtn onClick={() => transform('flipV')} title="Flip vertically">
                ⇕
              </TBtn>
              <TBtn
                onClick={() => transform('rotate')}
                title={doc.width === doc.height ? 'Rotate 90° clockwise' : 'Rotation needs a square canvas'}
                disabled={doc.width !== doc.height}
              >
                ↻
              </TBtn>
              <TBtn onClick={clearFrame} title="Clear to transparent">
                ⌫
              </TBtn>
              <TBtn onClick={() => transform('nudge', 0, -1)} title="Nudge up (wraps)">
                ↑
              </TBtn>
              <TBtn onClick={() => transform('nudge', 0, 1)} title="Nudge down (wraps)">
                ↓
              </TBtn>
              <TBtn onClick={() => transform('nudge', -1, 0)} title="Nudge left (wraps)">
                ←
              </TBtn>
              <TBtn onClick={() => transform('nudge', 1, 0)} title="Nudge right (wraps)">
                →
              </TBtn>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-400">
              Nudges wrap around the edges, so a tile stays seamless — draw past one side and the pixels
              reappear on the other.
            </p>
          </div>

          <ExportPanel doc={doc} onTagsChange={(tags) => act((d) => cmd.tags(d, tags))} />
        </div>
      </div>

      <FrameStrip
        doc={doc}
        frameIndex={frameIndex}
        playbackIndex={playbackIndex}
        playing={playing}
        onSelect={setFrameIndex}
        onAdd={(i, opts) => {
          act((d) => cmd.addFrame(d, i, opts))
          setFrameIndex(i + 1)
        }}
        onDuplicate={(i) => {
          act((d) => cmd.addFrame(d, i, { copy: true }))
          setFrameIndex(i + 1)
        }}
        onRemove={(i) => act((d) => cmd.removeFrame(d, i))}
        onMove={(from, to) => {
          act((d) => cmd.moveFrame(d, from, to))
          if (to >= 0 && to < doc.frames.length) setFrameIndex(to)
        }}
        onDurationChange={(i, ms) => act((d) => cmd.frame(d, i, { duration: ms }))}
        onAllDurations={(ms) => act((d) => cmd.durations(d, ms))}
      />

      {libraryOpen && (
        <SpriteLibrary
          currentId={doc.id}
          onOpen={openSprite}
          onNew={newSprite}
          onClose={() => setLibraryOpen(false)}
        />
      )}
      {importOpen && (
        <ImportDialog doc={doc} onApply={applyImport} onClose={() => setImportOpen(false)} />
      )}
    </div>
  )
}

function TBtn({ onClick, title, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="rounded border border-slate-300 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  )
}
