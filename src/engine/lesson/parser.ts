import type { ParsedLesson, LessonStep, CodeSnippet, LessonProject, ProjectFile } from './types'

// ── Frontmatter ───────────────────────────────────────────────────────────────

function parseFrontmatter(md: string): { meta: Record<string, string>; body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { meta: {}, body: md }
  const meta: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i === -1) continue
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return { meta, body: m[2] }
}

// ── Code fence extraction ─────────────────────────────────────────────────────

interface Fence { lang: string; code: string; raw: string; info: string }

// Only these langs are extracted as runnable examples or special blocks.
// All other fences (text, plaintext, no lang) stay in the prose for markdown rendering.
const RUNNABLE_LANGS = new Set([
  'python', 'py',
  'javascript', 'js',
  'typescript', 'ts',
  'html', 'css',
  'sql', 'sqlite',
  'bash', 'shell', 'sh',
  'c', 'cpp', 'c++',
  'csharp', 'cs',
  'java',
  'kotlin',
])
const SPECIAL_LANGS  = new Set(['challenge', 'test', 'project'])

function extractFences(text: string): { fences: Fence[]; prose: string } {
  const fences: Fence[] = []
  const prose = text.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (raw, lang, code) => {
    const info = (lang || '').trim()
    const l = (info || 'plaintext').split(/\s+/)[0].toLowerCase()
    if (RUNNABLE_LANGS.has(l) || SPECIAL_LANGS.has(l)) {
      fences.push({ lang: l, code: code.replace(/\n$/, ''), raw, info })
      return ''   // remove from prose — rendered by RunExample / ChallengeStep
    }
    return raw    // keep in prose — rendered as display-only by ReactMarkdown
  }).replace(/\n{3,}/g, '\n\n').trim()
  return { fences, prose }
}

// ── Lens extraction ───────────────────────────────────────────────────────────

function extractLenses(prose: string): { prose: string; lenses: { cs?: string; se?: string } } {
  const lenses: { cs?: string; se?: string } = {}
  const paragraphs = prose.split(/\n\n+/)
  const remaining: string[] = []
  for (const para of paragraphs) {
    const t = para.trim()
    if (t.startsWith('**CS lens:**')) {
      lenses.cs = t.replace(/^\*\*CS lens:\*\*\s*/, '').trim()
    } else if (t.startsWith('**SE lens:**')) {
      lenses.se = t.replace(/^\*\*SE lens:\*\*\s*/, '').trim()
    } else {
      remaining.push(para)
    }
  }
  return { prose: remaining.join('\n\n').trim(), lenses }
}

// ── Step builder ──────────────────────────────────────────────────────────────

// Langs that should not be inferred as challenge lang — they're context/display fences
const NON_CHALLENGE_LANGS = new Set(['html', 'text', 'plaintext'])

function buildStep(raw: string, idx: number, metaLang: string): LessonStep {
  const lines = raw.split('\n')
  const titleLine = lines[0] ?? ''
  const title = titleLine.replace(/^##\s*/, '').trim()
  const body = lines.slice(1).join('\n')

  const { fences, prose: rawProse } = extractFences(body)
  const { prose, lenses } = extractLenses(rawProse)

  const examples: CodeSnippet[] = []
  let challenge: CodeSnippet | null = null
  let tests: string | null = null
  let project: LessonProject | null = null
  let projectIsChallenge = false

  for (let i = 0; i < fences.length; i++) {
    const f = fences[i]
    const tokens = f.info.split(/\s+/)
    const file = tokens.find(t => t.startsWith('file='))?.slice('file='.length)
    if ((f.lang === 'project' || f.lang === 'challenge') && file) {
      // One file of a project: ```project wpf file=MainWindow.xaml``` (an example) or
      // ```challenge wpf file=MainWindow.xaml``` (graded by the step's test fence).
      // Add `readonly` for a file the learner reads but doesn't edit.
      const kind = (tokens[1] ?? '').toLowerCase()
      project ??= { kind, files: [] }
      project.files.push(projectFile(file, f.code, tokens.includes('readonly')))
      if (f.lang === 'challenge') projectIsChallenge = true
      continue
    }
    if (f.lang === 'challenge') {
      // Explicit language wins: ```challenge javascript```. Written the same way every
      // other fence declares its language, and it's the only reliable way to grade a
      // scenario-style challenge (e.g. a JS quiz object inside a bash-topic lesson) —
      // inferring from context guesses wrong in exactly that case.
      const explicit = f.info.split(/\s+/)[1]?.toLowerCase()
      // Otherwise infer lang from the previous runnable fence, skipping display/context
      // fences. Fall back to the lesson's meta.lang so CSS challenges get lang:'css'
      // even when the previous fence is the HTML structure context.
      const prev = fences[i - 1]?.lang
      const inferredLang = explicit || ((prev && !NON_CHALLENGE_LANGS.has(prev)) ? prev : metaLang)
      challenge = { lang: inferredLang, code: f.code }
    } else if (f.lang === 'test') {
      tests = f.code
    } else {
      const flags = f.info.split(/\s+/).slice(1)
      examples.push({
        lang: f.lang,
        code: f.code,
        noRender: flags.includes('noplay'),
        vueMount: flags.includes('vue-mount'),
      })
    }
  }

  // A project challenge is still a challenge to the rest of the engine (step type, Tests
  // tab, lesson completion); its `challenge` is the first file the learner edits.
  if (project && projectIsChallenge && !challenge) {
    const firstEditable = project.files.find(f => !f.readOnly) ?? project.files[0]
    challenge = { lang: project.kind, code: firstEditable.code }
  }

  return { id: `step-${idx}`, title, prose, lenses, examples, challenge, tests, project }
}

const LANG_BY_EXTENSION: Record<string, string> = { xaml: 'xml', cs: 'csharp', xml: 'xml', json: 'json', csproj: 'xml' }

function projectFile(path: string, code: string, readOnly: boolean): ProjectFile {
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  return { path, lang: LANG_BY_EXTENSION[extension] ?? 'plaintext', code, readOnly }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function parseLesson(rawMarkdown: string): ParsedLesson {
  // Vite's `?raw` loader does NOT normalize line endings — on a CRLF-checked-out
  // file (Windows, core.autocrlf=true) every `\n`-anchored regex below silently
  // fails to match (frontmatter parsing in particular), and `\r` characters leak
  // into extracted code. Normalize once, up front, so nothing downstream needs
  // to special-case it.
  const markdown = rawMarkdown.replace(/\r\n/g, '\n')
  const { meta, body } = parseFrontmatter(markdown)

  // Split on ## headers — keep delimiter on each chunk
  const rawSteps = body.split(/(?=^## )/m).filter(s => s.trim())

  // If first chunk has no ## it's the intro prose (under the # title)
  const steps: LessonStep[] = []
  let introProse = ''

  const metaLang = meta.lang ?? 'python'

  for (let i = 0; i < rawSteps.length; i++) {
    const chunk = rawSteps[i].trim()
    if (chunk.startsWith('## ')) {
      steps.push(buildStep(chunk, i, metaLang))
    } else {
      // intro section — extract the # title and remaining prose
      introProse = chunk.replace(/^#[^#][^\n]*\n?/, '').trim()
    }
  }

  // Title: from frontmatter, or first # heading in body
  const titleFromBody = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? 'Lesson'
  const title = meta.title ?? titleFromBody

  // Merge intro prose into the first step so there's no thin intro-only step
  if (introProse && steps.length > 0) {
    steps[0] = { ...steps[0], prose: introProse + (steps[0].prose ? '\n\n' + steps[0].prose : '') }
  } else if (introProse) {
    steps.unshift({ id: 'step-intro', title: '', prose: introProse, examples: [], challenge: null, tests: null })
  }

  return {
    title,
    series: meta.series ?? 'unknown',
    level: parseInt(meta.level ?? '0', 10),
    topic: meta.topic,
    lang: meta.lang ?? 'python',
    steps,
  }
}
