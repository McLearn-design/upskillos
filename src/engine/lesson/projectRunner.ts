// ─── Project lessons: run tests / launch ─────────────────────────────────────
//
// A project lesson step carries several files (see parser.ts, `project` and
// `challenge <kind> file=...` fences). This file adds the generated entry point for the
// project kind and hands the whole set to executeProject.

import type { ExecutionResult, LessonProject, OutputLine, TestResult } from './types'
import { executeProject, type ProjectSpec, type GeneratedFile } from './executor'
import { parseTestResults, OC_PREFIX } from './testRunner'
import { WPF_UI_KIT, WPF_LAUNCHER } from './projects/wpf'
import { dotnetTestProgram } from './projects/dotnetTests'

// wpf: a WPF window (LessonApp.MainWindow). console: a plain .NET console program,
// whose example projects have their own Program.cs entry point and whose challenge
// projects have none (the tests supply Main).
export const PROJECT_KINDS = new Set(['wpf', 'console'])

type Files = Record<string, string>    // path -> current content (the learner's edits)

function filesFor(project: LessonProject, files: Files): ProjectSpec['files'] {
  return project.files.map(f => ({ path: f.path, content: files[f.path] ?? f.code }))
}

function assertKind(project: LessonProject) {
  if (!PROJECT_KINDS.has(project.kind)) throw new Error(`Unknown project kind: ${project.kind}`)
}

export async function runProjectTests(project: LessonProject, files: Files, testCode: string): Promise<{ results: TestResult[]; output: ExecutionResult }> {
  assertKind(project)
  const wpf = project.kind === 'wpf'
  const output = await executeProject({
    template: project.kind,
    mode: 'test',
    files: [
      ...filesFor(project, files),
      { path: 'LessonTests.cs', content: dotnetTestProgram(testCode, { sta: wpf }) },
      ...(wpf ? [{ path: 'Ui.cs', content: WPF_UI_KIT }] : []),
    ],
  })
  const stdout = output.lines.filter(l => l.kind === 'stdout').map(l => l.text)
  const errors = output.lines.filter(l => l.kind === 'error')
  const results = parseTestResults(stdout)
  // A build error, or a failure before any assertion ran (the window couldn't open):
  // show it as the one failed result instead of "0 tests".
  if (errors.length && !stdout.some(l => l.startsWith(OC_PREFIX))) {
    return { results: [{ label: errors[0].text, passed: false, detail: 'Build or setup error' }], output }
  }
  if (errors.length) results.push({ label: errors[0].text, passed: false, detail: 'Stopped before the remaining tests' })
  return { results, output }
}

// wpf: opens the window (resolves once it's open; see executeProject). console: runs
// the program's own entry point to completion and returns its output.
export async function launchProject(
  project: LessonProject,
  files: Files,
  onAfterLaunch?: (line: OutputLine | null) => void,
): Promise<ExecutionResult & { launched?: boolean }> {
  assertKind(project)
  const entry = project.kind === 'wpf' ? [{ path: 'LessonLauncher.cs', content: WPF_LAUNCHER }] : []
  return executeProject({ template: project.kind, mode: 'launch', files: [...filesFor(project, files), ...entry] }, onAfterLaunch)
}

// Builds without running and returns what the build generated: the project file, the
// C# that XAML compiles into (MainWindow.g.cs), the implicit usings (GlobalUsings.g.cs),
// assembly attributes and source-generator output. Lessons use it to show that none of
// this is magic.
export async function inspectProject(project: LessonProject, files: Files): Promise<ExecutionResult & { generated?: GeneratedFile[] }> {
  assertKind(project)
  const learnerFiles = filesFor(project, files)
  // An executable needs an entry point to build. A console challenge has none of its
  // own, so it borrows an empty test program.
  const entry = project.kind === 'wpf'
    ? [{ path: 'LessonLauncher.cs', content: WPF_LAUNCHER }]
    : learnerFiles.some(f => f.path === 'Program.cs') ? [] : [{ path: 'LessonTests.cs', content: dotnetTestProgram('', { sta: false }) }]
  return executeProject({ template: project.kind, mode: 'inspect', files: [...learnerFiles, ...entry] })
}
