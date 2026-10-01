export type Lang = string

export interface UiTheme {
  bg0: string; bg1: string; bg2: string
  border: string
  txt1: string; txt2: string
  hoverBg: string; hoverTx: string
  btnBorder: string
  primary: string; primaryBg: string
}

export interface CodeSnippet {
  lang: Lang
  code: string
  /** Reference-only fence (e.g. a full .vue SFC listing) — never auto-rendered/previewed. */
  noRender?: boolean
  /** Explicit opt-in: mount this html fence with a real Vue 3 runtime in the preview. */
  vueMount?: boolean
}

export interface OutputLine {
  kind: 'stdout' | 'stderr' | 'error' | 'preview'
  text: string
}

export interface ExecutionResult {
  lines: OutputLine[]
  durationMs?: number
}

export type Executor = (code: string, lang: Lang) => Promise<ExecutionResult>

export interface TestResult {
  label: string
  passed: boolean
  detail?: string
}

// One file of a multi-file project lesson (e.g. a WPF window's MainWindow.xaml).
export interface ProjectFile {
  path: string                // e.g. "MainWindow.xaml", relative to the project folder
  lang: string                // editor language: 'xml' for .xaml, 'csharp' for .cs
  code: string                // starting content
  readOnly: boolean
}

// A step whose code is a whole project rather than one snippet. From ```project <kind>
// file=...``` fences (an example to edit and launch) or ```challenge <kind> file=...```
// fences (the same, plus the step's test fence).
export interface LessonProject {
  kind: string                // 'wpf'
  files: ProjectFile[]
}

export interface LessonStep {
  id: string
  title: string
  prose: string               // markdown with code fences and lenses removed
  lenses?: { cs?: string; se?: string }
  examples: CodeSnippet[]     // runnable examples that live with the prose
  challenge: CodeSnippet | null
  tests: string | null        // raw test assertions
  project?: LessonProject | null
}

export interface ParsedLesson {
  title: string
  series: string
  level: number
  topic?: string
  lang: Lang
  steps: LessonStep[]
}
