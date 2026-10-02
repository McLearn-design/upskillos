// A step whose code is a whole project (several files) rather than one snippet: a WPF
// window's XAML and C#, or a small console program. Each file gets an editor tab.
// "Launch app" (WPF) builds the files and opens the real window; "Run" (console) runs the
// program. On a challenge step, "Run Tests" builds them with the lesson's tests and reports
// the results. "Generated code" builds them and adds read-only tabs showing what the build
// produced: the project file, the C# that XAML compiles into, the implicit usings. All of
// these need the desktop app.

import { useState, useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { setupOpenCalcMonaco } from '../../utils/monacoThemes.js'
import { useGlobalTheme } from '../../context/ThemeContext.jsx'
import type { LessonProject, LessonStep, OutputLine, TestResult, UiTheme } from './types'
import type { GeneratedFile } from './executor'
import { runProjectTests, launchProject, inspectProject } from './projectRunner'

interface Props {
  step: LessonStep
  project: LessonProject
  ui: UiTheme
  onResults?: (results: TestResult[]) => void
  onOutput?: (lines: { text: string; kind: string }[]) => void
}

type Status = 'idle' | 'testing' | 'launching' | 'app-open' | 'inspecting'

// Generated tabs are kept apart from the lesson's files by this prefix on their tab id.
const GENERATED = 'generated:'

function startingFiles(project: LessonProject): Record<string, string> {
  return Object.fromEntries(project.files.map(f => [f.path, f.code]))
}

function languageOf(path: string): string {
  if (path.endsWith('.xaml') || path.endsWith('.csproj') || path.endsWith('.xml')) return 'xml'
  if (path.endsWith('.cs')) return 'csharp'
  return 'plaintext'
}

// The generated file a lesson most likely wants to show first.
function mostInteresting(generated: GeneratedFile[]): GeneratedFile | undefined {
  return generated.find(f => f.path.endsWith('MainWindow.g.cs'))
    ?? generated.find(f => f.path.endsWith('GlobalUsings.g.cs'))
    ?? generated[0]
}

export default function ProjectStep({ step, project, ui, onResults, onOutput }: Props) {
  const { themeStyles } = useGlobalTheme() as any
  const monacoTheme = themeStyles?.monaco ?? 'vs-dark'
  const onDesktop = typeof window !== 'undefined' && !!(window as any).openCalcDesktop?.runProject
  const isWpf = project.kind === 'wpf'

  const [files, setFiles] = useState(() => startingFiles(project))
  const [generated, setGenerated] = useState<GeneratedFile[]>([])
  const [activeTab, setActiveTab] = useState(project.files[0]?.path ?? '')
  const [status, setStatus] = useState<Status>('idle')
  // Output from the open app accumulates until its window closes.
  const appOutput = useRef<OutputLine[]>([])

  useEffect(() => {
    setFiles(startingFiles(project))
    setGenerated([])
    setActiveTab(project.files[0]?.path ?? '')
    setStatus('idle')
  }, [project])

  const isChallenge = step.tests !== null && step.challenge !== null
  // A console challenge has no entry point of its own, so only its tests can run it.
  const canRun = isWpf || !isChallenge
  const busy = status === 'testing' || status === 'launching' || status === 'inspecting'
  const edited = project.files.some(f => files[f.path] !== f.code)

  const activeGenerated = activeTab.startsWith(GENERATED) ? generated.find(g => GENERATED + g.path === activeTab) : undefined
  const activeFile = activeGenerated ? undefined : (project.files.find(f => f.path === activeTab) ?? project.files[0])

  async function handleRunTests() {
    if (!step.tests) return
    setStatus('testing')
    try {
      const { results, output } = await runProjectTests(project, files, step.tests)
      onResults?.(results)
      // Anything the test run printed besides results (warnings) goes to the output.
      const extra = output.lines.filter(l => l.kind !== 'stdout' || !l.text.startsWith('__OC_TEST__'))
      if (extra.length) onOutput?.(extra)
    } finally {
      setStatus(s => (s === 'testing' ? 'idle' : s))
    }
  }

  async function handleLaunch() {
    setStatus('launching')
    appOutput.current = []
    const result = await launchProject(project, files, (line) => {
      if (line === null) {
        // The learner closed the window.
        setStatus('idle')
        if (appOutput.current.length) onOutput?.([...appOutput.current, { kind: 'stdout', text: '(app closed)' }])
        return
      }
      appOutput.current = [...appOutput.current, line]
      onOutput?.(appOutput.current)
    })
    if (result.launched) {
      setStatus('app-open')
      appOutput.current = result.lines
      if (result.lines.length) onOutput?.(result.lines)
    } else {
      setStatus('idle')
      onOutput?.(result.lines.length ? result.lines : [{ kind: isWpf ? 'error' : 'stdout', text: isWpf ? 'The app did not start.' : '(no output)' }])
    }
  }

  async function handleInspect() {
    setStatus('inspecting')
    try {
      const result = await inspectProject(project, files)
      const found = result.generated ?? []
      setGenerated(found)
      const first = mostInteresting(found)
      if (first) setActiveTab(GENERATED + first.path)
      // Build errors (or the desktop-only message) explain an empty result.
      const problems = result.lines.filter(l => l.kind === 'error')
      if (problems.length || !found.length) onOutput?.(problems.length ? problems : [{ kind: 'error', text: 'The build produced no generated files.' }])
    } finally {
      setStatus('idle')
    }
  }

  function resetFiles() {
    setFiles(startingFiles(project))
    setGenerated([])
    if (activeTab.startsWith(GENERATED)) setActiveTab(project.files[0]?.path ?? '')
  }

  const button = 'text-xs font-semibold px-3 py-0.5 rounded border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
  const desktopOnly = onDesktop ? undefined
    : 'A browser can\'t build .NET projects. Read and edit the files here, or copy them into Visual Studio or another editor and run them with your own .NET SDK; the UpSkillOS desktop app runs them in place.'
  const tabClass = (active: boolean) => `relative px-3 py-1.5 text-[12px] font-mono font-medium rounded-t-md border-t border-l border-r transition-colors cursor-pointer shrink-0 ${
    active ? `-mb-px border-brand-500/30 ${ui.bg0} text-brand-400` : `mb-0 ${ui.border} bg-transparent ${ui.txt2} hover:text-brand-400`
  }`

  return (
    <div className="flex flex-col h-full">
      <div className={`flex items-center px-2 pt-1.5 border-b ${ui.border} ${ui.bg1} shrink-0 gap-1 overflow-x-auto`}>
        {project.files.map(file => (
          <button key={file.path} type="button" onClick={() => setActiveTab(file.path)} className={tabClass(activeFile?.path === file.path)}>
            {file.path}
            {file.readOnly && <span className="ml-1.5 text-[9px] opacity-40 font-sans">read-only</span>}
          </button>
        ))}
        {generated.map(file => (
          <button key={file.path} type="button" title={`Generated by the build: ${file.path}`}
            onClick={() => setActiveTab(GENERATED + file.path)}
            className={`${tabClass(activeGenerated?.path === file.path)} italic`}>
            {file.path.split('/').pop()}
            <span className="ml-1.5 text-[9px] opacity-50 font-sans not-italic">generated</span>
          </button>
        ))}

        <div className="flex items-center gap-2 ml-auto pb-1 shrink-0">
          {!onDesktop && <span className={`text-[11px] ${ui.txt2}`} title={desktopOnly}>Can't run in the browser: follow along, or copy into your own editor</span>}
          {status === 'app-open' && <span className={`text-[11px] ${ui.txt2}`}>App open: close its window when you're done</span>}
          {(edited || generated.length > 0) && (
            <button type="button" title="Put every file back to how the lesson started it"
              className={`text-[11px] ${ui.txt2} hover:text-brand-400 bg-transparent border-none cursor-pointer`}
              onClick={resetFiles} disabled={busy}>↺ Reset</button>
          )}
          <button type="button" title={desktopOnly ?? 'Build these files and show the code the build generates from them'}
            className={`${button} border ${ui.border} ${ui.bg0} ${ui.txt2} hover:text-brand-400`}
            onClick={handleInspect} disabled={!onDesktop || busy}>
            {status === 'inspecting' ? 'Building…' : '{ } Generated code'}
          </button>
          {canRun && (
            <button type="button" title={desktopOnly ?? (isWpf ? 'Build these files and open the window' : 'Build and run this program')}
              className={`${button} border ${ui.border} ${ui.bg0} ${ui.txt1} hover:text-brand-400`}
              onClick={handleLaunch} disabled={!onDesktop || busy}>
              {status === 'launching' ? 'Building…' : status === 'app-open' ? '↺ Relaunch' : isWpf ? '▶ Launch app' : '▶ Run'}
            </button>
          )}
          {isChallenge && (
            <button type="button" title={desktopOnly ?? 'Build these files and run the lesson tests'}
              className={`${button} bg-brand-500 hover:bg-brand-600 text-white`}
              onClick={handleRunTests} disabled={!onDesktop || busy}>
              {status === 'testing' ? 'Testing…' : '▶ Run Tests'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {activeGenerated ? (
          <Editor
            key={GENERATED + activeGenerated.path}
            height="100%"
            language={languageOf(activeGenerated.path)}
            value={activeGenerated.text}
            theme={monacoTheme}
            beforeMount={setupOpenCalcMonaco}
            options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, readOnly: true, domReadOnly: true, padding: { top: 8, bottom: 8 } }}
          />
        ) : activeFile && (
          <Editor
            key={`${step.id}/${activeFile.path}`}
            height="100%"
            language={activeFile.lang}
            value={files[activeFile.path] ?? ''}
            theme={monacoTheme}
            beforeMount={setupOpenCalcMonaco}
            onChange={v => { if (!activeFile.readOnly) setFiles(prev => ({ ...prev, [activeFile.path]: v ?? '' })) }}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              lineNumbers: 'on',
              padding: { top: 8, bottom: 8 },
              fontLigatures: false,
              readOnly: activeFile.readOnly,
              domReadOnly: activeFile.readOnly,
            }}
          />
        )}
      </div>
    </div>
  )
}
