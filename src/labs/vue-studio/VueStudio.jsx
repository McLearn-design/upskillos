import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import LessonPanel from './LessonPanel.jsx'
import CodePanel from './CodePanel.jsx'
import RuntimePanel from './RuntimePanel.jsx'
import { SANDBOX_HTML as SANDBOX_HTML_SRC, computeDependencyGraph } from './sandbox.js'
import { useGlobalTheme } from '../../context/ThemeContext.jsx'
import { useThemeColors } from '../../hooks/useThemeColors.js'
import { SPACE_INVADERS } from './demos/space-invaders.js'
import { SPREADSHEET_MILESTONES } from './series/spreadsheet/milestones/index.js'
import { getSeriesMilestone, getStudioSeries, getWorkspaceId } from './studioSeries.js'

const DEMOS = [
  SPACE_INVADERS,
  ...SPREADSHEET_MILESTONES.map(milestone => ({
    id: `spreadsheet-checkpoint-${milestone.id}`,
    label: `Spreadsheet: ${milestone.title}`,
    description: milestone.objective,
    files: milestone.files,
  })),
]

const LS_KEY = 'vue-studio-v4'
const LEGACY_LS_KEY = 'vue-studio-v3'

function loadSavedFiles(workspaceId, starter, legacyMilestoneId = null) {
  try {
    const current = localStorage.getItem(`${LS_KEY}:files:${workspaceId}`)
    const legacy = legacyMilestoneId ? localStorage.getItem(`${LEGACY_LS_KEY}:${legacyMilestoneId}`) : null
    const saved = JSON.parse(current ?? legacy ?? 'null')
    return saved ?? starter
  } catch { return starter }
}

function saveFiles(workspaceId, files) {
  try { localStorage.setItem(`${LS_KEY}:files:${workspaceId}`, JSON.stringify(files)) } catch {}
}

function getInitialLocation() {
  try {
    const location = JSON.parse(localStorage.getItem(`${LS_KEY}:location`) ?? 'null') ?? {}
    const panel = JSON.parse(localStorage.getItem('vue-studio-panel-v1') ?? 'null') ?? {}
    const saved = Object.keys(location).length ? location : panel
    const series = getStudioSeries(saved.seriesId ?? 'intro')
    const max = series.lessons.length - 1
    const requested = Number.isInteger(saved.lessonIdx) ? saved.lessonIdx : 0
    return { seriesId: series.id, lessonIdx: Math.max(0, Math.min(max, requested)) }
  } catch { return { seriesId: 'intro', lessonIdx: 0 } }
}

export default function VueStudio({ onBack }) {
  const { themeStyles } = useGlobalTheme()
  const C = useThemeColors()

  // Persisted across sessions — user resumes the lesson they were on
  const [location, setLocation] = useState(getInitialLocation)
  const activeSeries = getStudioSeries(location.seriesId)
  const milestone = getSeriesMilestone(activeSeries, location.lessonIdx)
  const workspaceId = getWorkspaceId(activeSeries, location.lessonIdx)

  // Virtual file system: { 'src/App.vue': content, ... }
  const [files, setFiles] = useState(() => loadSavedFiles(
    workspaceId,
    milestone.starter ?? milestone.files,
    activeSeries.id === 'intro' ? milestone.id : null,
  ))
  const [activeFile, setActiveFile] = useState(() => Object.keys(milestone.starter ?? milestone.files)[0] ?? '')

  // Runtime panel
  const [logs, setLogs] = useState([])
  const [componentTree, setComponentTree] = useState(null)
  const [reactiveHistory, setReactiveHistory] = useState(() => new Map())
  const [execState, setExecState] = useState(null)
  const iframeRef = useRef(null)

  // Dependency graph — recomputed when files change (debounced by useMemo)
  const depGraph = useMemo(() => computeDependencyGraph(files), [files])

  // Timeline — last 60 reactive-update snapshots (used by bottom panel)
  const [timeline, setTimeline] = useState([])

  // VDom diff: track previous tree snapshot to highlight changed components
  const prevTreeRef = useRef(null)
  const [treeChanges, setTreeChanges] = useState(new Set())

  // Last clicked element info (from sandbox) — used for code-specific step explanations
  const [lastClick, setLastClick] = useState(null)

  // Accumulate reactive history outside React state so timeline snapshots are pure
  const reactiveHistoryAccRef = useRef(new Map())

  // Panel dimensions
  const [lessonW,  setLessonW]  = useState(340)
  const [previewW, setPreviewW] = useState(320)
  const [bottomH,  setBottomH]  = useState(240)
  const [lessonVisible, setLessonVisible] = useState(true)
  const [previewVisible, setPreviewVisible] = useState(true)

  // When a demo is active its files must not overwrite the lesson's saved state
  const [demoActive, setDemoActive] = useState(false)
  const [activeDemo, setActiveDemo] = useState(null)

  // If the active file was deleted, fall back to the first remaining file
  useEffect(() => {
    if (activeFile && !files[activeFile]) {
      const first = Object.keys(files)[0]
      if (first) setActiveFile(first)
    }
  }, [files, activeFile])

  // Persist file edits as the student types — skipped when a demo is running
  useEffect(() => {
    if (!demoActive) saveFiles(workspaceId, files)
  }, [files, workspaceId, demoActive])

  const filesRef = useRef(files)
  useEffect(() => { filesRef.current = files }, [files])

  // Clear old v2 localStorage keys on first load
  useEffect(() => {
    Object.keys(localStorage).filter(k => k.startsWith('vue-studio-v2:')).forEach(k => localStorage.removeItem(k))
  }, [])

  // Handle postMessage events from the iframe runtime
  useEffect(() => {
    let execTimer1 = null
    let execTimer2 = null
    const handler = (event) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      const { data } = event
      if (!data?.type) return
      if (data.type === 'sandbox-ready') {
        iframeRef.current?.contentWindow?.postMessage({ type: 'run', files: filesRef.current }, '*')
      } else if (data.type === 'log') {
        setLogs(prev => [...prev, { level: data.level ?? 'log', args: data.args ?? [] }])
      } else if (data.type === 'error') {
        setLogs(prev => [...prev, { level: 'error', args: [data.message] }])
      } else if (data.type === 'tree') {
        setComponentTree(data.tree)
      } else if (data.type === 'reactive-update') {
        setComponentTree(data.tree)

        // VDom diff: collect paths of nodes whose data changed vs prev snapshot
        const changed = new Set()
        const diffTree = (prev, next, path = '') => {
          if (!next) return
          const prevData = prev?.data ?? {}
          const nextData = next.data ?? {}
          const anyChanged = Object.keys(nextData).some(
            k => JSON.stringify(prevData[k]) !== JSON.stringify(nextData[k])
          )
          if (anyChanged) changed.add(path || next.name)
          ;(next.children ?? []).forEach((child, i) =>
            diffTree(prev?.children?.[i], child, `${path}/${child.name}:${i}`)
          )
        }
        diffTree(prevTreeRef.current, data.tree)
        prevTreeRef.current = data.tree
        setTreeChanges(changed)

        // Build next reactive history map from the accumulated ref (not from prev state)
        // so timeline snapshots can be recorded outside a state updater (which must be pure)
        const nextHistory = new Map(reactiveHistoryAccRef.current)
        const flatten = (node) => {
          if (!node) return
          Object.entries(node.data ?? {}).forEach(([k, v]) => {
            const existing = nextHistory.get(k)
            nextHistory.set(k, { value: v, prevValue: existing?.value ?? v, updateCount: (existing?.updateCount ?? 0) + 1 })
          })
          node.children?.forEach(flatten)
        }
        flatten(data.tree)
        reactiveHistoryAccRef.current = nextHistory
        setReactiveHistory(new Map(nextHistory))
        setTimeline(t => [...t.slice(-59), { ts: Date.now(), reactiveHistory: new Map(nextHistory), tree: data.tree }])
        clearTimeout(execTimer1)
        clearTimeout(execTimer2)
        setExecState('updating')
        execTimer1 = setTimeout(() => setExecState('done'), 500)
        execTimer2 = setTimeout(() => setExecState(null), 1500)
      } else if (data.type === 'user-click') {
        setLastClick({ tag: data.tag, text: data.text, id: data.id })
        setExecState('click')
        // Snapshot prevValues so the diff after the next reactive-update is accurate
        const withPrev = new Map()
        reactiveHistoryAccRef.current.forEach((v, k) => withPrev.set(k, { ...v, prevValue: v.value }))
        reactiveHistoryAccRef.current = withPrev
        setReactiveHistory(new Map(withPrev))
      }
    }
    window.addEventListener('message', handler)
    return () => {
      window.removeEventListener('message', handler)
      clearTimeout(execTimer1)
      clearTimeout(execTimer2)
    }
  }, [])

  // Switch the editor to the workspace owned by a lesson series.
  const goToWorkspace = useCallback((seriesId, lessonIdx) => {
    const series = getStudioSeries(seriesId)
    if (!series.lessons[lessonIdx]) return
    const m = getSeriesMilestone(series, lessonIdx)
    const nextWorkspaceId = getWorkspaceId(series, lessonIdx)
    try {
      localStorage.setItem(`${LS_KEY}:location`, JSON.stringify({ seriesId: series.id, lessonIdx }))
      if (series.id === 'intro') localStorage.setItem(`${LEGACY_LS_KEY}:milestone-idx`, String(lessonIdx))
    } catch {}
    setDemoActive(false)
    setActiveDemo(null)
    setLocation({ seriesId: series.id, lessonIdx })
    const defaultFiles = m.starter ?? m.files
    const saved = loadSavedFiles(nextWorkspaceId, defaultFiles, series.id === 'intro' ? m.id : null)
    setFiles(saved)
    setActiveFile(Object.keys(defaultFiles)[0] ?? '')
    setLogs([])
    setComponentTree(null)
    setReactiveHistory(new Map())
    setExecState(null)
    setTimeline([])
    setTreeChanges(new Set())
    prevTreeRef.current = null
    reactiveHistoryAccRef.current = new Map()
    iframeRef.current?.contentWindow?.postMessage({ type: 'run', files: saved }, '*')
  }, [])

  const handleRun = useCallback(() => {
    setLogs([])
    setComponentTree(null)
    iframeRef.current?.contentWindow?.postMessage({ type: 'run', files }, '*')
  }, [files])

  const updateFile = useCallback((filename, content) => {
    setFiles(prev => ({ ...prev, [filename]: content }))
  }, [])

  // Delete a file from the virtual filesystem (cannot delete the last file)
  const deleteFile = useCallback((filename) => {
    setFiles(prev => {
      if (Object.keys(prev).length <= 1) return prev
      const next = { ...prev }
      delete next[filename]
      return next
    })
  }, [])

  // Reset to the lesson's blank starter (clears the student's saved work)
  const resetFiles = useCallback(() => {
    const defaultFiles = milestone.starter ?? milestone.files
    setDemoActive(false)
    setActiveDemo(null)
    setFiles(defaultFiles)
    setActiveFile(Object.keys(defaultFiles)[0] ?? '')
    saveFiles(workspaceId, defaultFiles)
    setLogs([])
    setComponentTree(null)
    setReactiveHistory(new Map())
    setExecState(null)
    setTimeline([])
    setTreeChanges(new Set())
    prevTreeRef.current = null
    reactiveHistoryAccRef.current = new Map()
    iframeRef.current?.contentWindow?.postMessage({ type: 'run', files: defaultFiles }, '*')
  }, [milestone, workspaceId])

  // Load the reference solution for this lesson and run it immediately
  const loadSolution = useCallback(() => {
    const solutionFiles = milestone.files
    setDemoActive(false)
    setActiveDemo(null)
    setFiles(solutionFiles)
    setActiveFile(Object.keys(solutionFiles)[0] ?? '')
    setLogs([])
    setComponentTree(null)
    setReactiveHistory(new Map())
    setExecState(null)
    setTimeline([])
    setTreeChanges(new Set())
    prevTreeRef.current = null
    reactiveHistoryAccRef.current = new Map()
    iframeRef.current?.contentWindow?.postMessage({ type: 'run', files: solutionFiles }, '*')
  }, [milestone])

  const startResize = useCallback((setter, getStart, axis = 'x', min = 160, max = 800, dir = 1) => (e) => {
    const startPos = axis === 'x' ? e.clientX : e.clientY
    const startSize = getStart()
    const cursor = axis === 'x' ? 'col-resize' : 'row-resize'
    const overlay = document.createElement('div')
    overlay.style.cssText = `position:fixed;inset:0;cursor:${cursor};z-index:9999`
    document.body.appendChild(overlay)
    const onMove = (ev) => {
      const delta = (axis === 'x' ? ev.clientX : ev.clientY) - startPos
      setter(Math.max(min, Math.min(max, startSize + dir * delta)))
    }
    const onUp = () => { document.body.removeChild(overlay); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // Load a demo and auto-run it immediately — passes files directly so we don't
  // wait for React state to settle before posting to the iframe
  const loadDemo = useCallback((demo) => {
    setDemoActive(true)
    setActiveDemo(demo)
    setFiles(demo.files)
    setActiveFile(Object.keys(demo.files)[0] ?? '')
    setLogs([])
    setComponentTree(null)
    iframeRef.current?.contentWindow?.postMessage({ type: 'run', files: demo.files }, '*')
  }, [])

  const clearDemo = useCallback(() => {
    setActiveDemo(null)
    goToWorkspace(location.seriesId, location.lessonIdx)
  }, [location, goToWorkspace])

  const addFile = useCallback((filename) => {
    if (!filename || files[filename] !== undefined) return
    const ext = filename.split('.').pop()
    const starter = ext === 'vue'
      ? `<script setup lang="ts">\n</script>\n\n<template>\n  <div>\n  </div>\n</template>\n`
      : ext === 'ts' ? `// ${filename}\n` : `/* ${filename} */\n`
    setFiles(prev => ({ ...prev, [filename]: starter }))
    setActiveFile(filename)
  }, [files])

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>

      {/* Lesson panel + collapse rail */}
      {lessonVisible && (
        <div style={{ width: lessonW, flexShrink: 0, borderRight: `1px solid ${C.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <LessonPanel
            activeSeriesId={location.seriesId}
            activeLessonIdx={location.lessonIdx}
            onSelectWorkspace={goToWorkspace}
            onBack={onBack}
            ui={themeStyles.ui}
          />
        </div>
      )}
      <div
        onMouseDown={lessonVisible ? startResize(setLessonW, () => lessonW) : undefined}
        style={{ width: lessonVisible ? 12 : 28, cursor: lessonVisible ? 'col-resize' : 'default', background: C.surface2, borderRight: `1px solid ${C.border}`, flexShrink: 0, position: 'relative' }}
      >
        <button
          type="button"
          aria-label={lessonVisible ? 'Hide lesson panel' : 'Show lesson panel'}
          title={lessonVisible ? 'Hide lesson panel' : 'Show lesson panel'}
          onMouseDown={event => event.stopPropagation()}
          onClick={() => setLessonVisible(value => !value)}
          style={{ position: 'absolute', top: 8, left: lessonVisible ? -8 : 3, width: 22, height: 26, borderRadius: 5, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, cursor: 'pointer', zIndex: 2 }}
        >
          {lessonVisible ? '‹' : '›'}
        </button>
      </div>

      {/* Middle column: editor (top) + visualization (bottom) */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Code editor */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <CodePanel
            files={files}
            activeFile={activeFile}
            onActiveFileChange={setActiveFile}
            onFileChange={updateFile}
            onDeleteFile={deleteFile}
            onNewFile={addFile}
            onRun={handleRun}
            onResetFiles={resetFiles}
            onLoadSolution={milestone.hasSolution === false ? null : loadSolution}
            demos={DEMOS}
            onLoadDemo={loadDemo}
            activeDemo={activeDemo}
            onClearDemo={clearDemo}
            reactiveHistory={reactiveHistory}
          />
        </div>

        {/* Vertical resize handle */}
        <div
          onMouseDown={startResize(setBottomH, () => bottomH, 'y', 120, 480, -1)}
          style={{ height: 4, cursor: 'row-resize', background: C.border, flexShrink: 0, opacity: 0.5 }}
        />

        {/* Bottom visualization panel */}
        <div style={{ height: bottomH, flexShrink: 0, overflow: 'hidden', borderTop: `1px solid ${C.border}` }}>
          <RuntimePanel
            logs={logs}
            componentTree={componentTree}
            reactiveHistory={reactiveHistory}
            execState={execState}
            onClearLogs={() => setLogs([])}
            depGraph={depGraph}
            treeChanges={treeChanges}
            timeline={timeline}
            milestone={milestone}
            files={files}
            activeFile={activeFile}
            lastClick={lastClick}
          />
        </div>
      </div>

      <div
        onMouseDown={previewVisible ? startResize(setPreviewW, () => previewW, 'x', 240, 700, -1) : undefined}
        style={{ width: previewVisible ? 12 : 28, cursor: previewVisible ? 'col-resize' : 'default', background: C.surface2, borderLeft: `1px solid ${C.border}`, flexShrink: 0, position: 'relative' }}
      >
        <button
          type="button"
          aria-label={previewVisible ? 'Hide preview panel' : 'Show preview panel'}
          title={previewVisible ? 'Hide preview panel' : 'Show preview panel'}
          onMouseDown={event => event.stopPropagation()}
          onClick={() => setPreviewVisible(value => !value)}
          style={{ position: 'absolute', top: 8, left: previewVisible ? -3 : 3, width: 22, height: 26, borderRadius: 5, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, cursor: 'pointer', zIndex: 2 }}
        >
          {previewVisible ? '›' : '‹'}
        </button>
      </div>

      {/* Live preview — full height, no tabs */}
      {previewVisible && (
        <div style={{ width: previewW, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.hint, borderBottom: `1px solid ${C.border}`, background: C.surface2, flexShrink: 0 }}>
            Preview
          </div>
          <iframe
            ref={iframeRef}
            srcDoc={SANDBOX_HTML_SRC}
            sandbox="allow-scripts"
            title="Vue Studio Preview"
            style={{ flex: 1, border: 'none', background: '#fff', minHeight: 0 }}
          />
        </div>
      )}
    </div>
  )
}
