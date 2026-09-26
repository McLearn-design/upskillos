// The Help modal's "Feedback" section. Split out of src/components/ui/HelpModal.jsx.

import { useState } from "react";
import { Bot, Bug, Check, Download, Lightbulb, X } from "lucide-react";
import ReportBugButton from "../../ui/ReportBugButton.jsx";
import SuggestionBoxButton from "../../ui/SuggestionBoxButton.jsx";
import { useFeedbackBoard } from "../../../hooks/useFeedbackBoard.js";
import { BUG_LESSON_CONTRACT, buildLessonPrompt } from "../../../utils/lessonPrompt.js";
import { useDesktop } from "../../desktop/DesktopProvider.jsx";
import { getLabEntry } from "../../../labs/labLoader.js";
import { H3, Note, Para, downloadFile } from "../primitives.jsx";

// ─── SECTION: FEEDBACK & BUGS ─────────────────────────────────────────────────

function feedbackTimeAgo(ts) {
  if (!ts?.toDate) return ''
  const diffMs = Date.now() - ts.toDate().getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return ts.toDate().toLocaleDateString()
}

function FeedbackRow({ item, onOpenPrompt }) {
  const isBug = item.kind === 'bug'

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 mb-2.5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {isBug ? (
            <Bug className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          ) : (
            <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          )}
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug truncate">
            {item.title}
          </h4>
        </div>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
          {item.status === 'closed' ? 'Closed' : 'Open'}
        </span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap mb-2">
        {item.description}
      </p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {item.displayName || 'Anonymous'} · {feedbackTimeAgo(item.createdAt)}
        </p>
        <button
          onClick={() => onOpenPrompt(item)}
          className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Get a prompt for an AI coding agent to turn this into a lesson"
        >
          <Bot className="w-3 h-3" />
          Lesson Prompt
        </button>
      </div>
    </div>
  )
}

function LessonPromptModal({ item, onClose }) {
  const [downloaded, setDownloaded] = useState(false)
  if (!item) return null

  const handleDownload = () => {
    const prefix = item.kind === 'suggestion' ? 'suggestion' : 'bug'
    downloadFile(`${prefix}-${item.id}-lesson-prompt.md`, buildLessonPrompt(item))
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-[0_16px_64px_rgba(0,0,0,0.3)] border border-slate-200 dark:border-slate-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-white/10 bg-gradient-to-r from-brand-50/80 to-white/80 dark:from-brand-500/10 dark:to-slate-900/40">
          <div className="bg-brand-500/20 p-1.5 rounded-lg shrink-0">
            <Bot className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          </div>
          <h2 className="flex-1 text-sm font-black text-slate-800 dark:text-slate-100 tracking-wide uppercase">
            Lesson Prompt
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">
            for: {item.title}
          </p>

          <H3>What this is</H3>
          <Para>
            A text file that turns{' '}
            {item.kind === 'suggestion' ? 'this idea' : 'this bug'} into a{' '}
            <strong>lesson</strong> — not a fix, not a feature PR — with an
            AI's help. Built for a <strong>free</strong> chat AI (ChatGPT,
            Claude.ai), not a paid coding agent — no repo access or tools
            required on the AI's side, just you copying files back and
            forth.
          </Para>

          <H3>Why it exists</H3>
          <Para>
            UpSkillOS teaches by showing real work. Every bug and every
            feature idea is real material for the{' '}
            <strong>How to Contribute</strong> lessons — this turns the
            app's own maintenance into content instead of throwing it away
            once it's fixed.
          </Para>

          <Note color="amber">
            <strong>Do the "How to Contribute" lessons first</strong> if you
            haven't — this only works if you can find your way around an
            unfamiliar file and know basic Git. The prompt says so too, but
            it's worth knowing before you start.
          </Note>

          <H3>How to use it</H3>
          <ol className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed list-decimal list-inside space-y-1 mb-3">
            <li>Download the file below.</li>
            <li>Paste its full contents into any free AI chat.</li>
            <li>It'll ask for the real code it needs — that part is brief.</li>
            <li>Then it teaches: what each piece is, why it exists, how it connects — the actual contract, not a summary.</li>
            <li>Review the lesson it writes, then open a PR.</li>
          </ol>

          <button
            onClick={handleDownload}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors ${downloaded ? 'bg-emerald-500 text-white' : 'bg-brand-600 hover:bg-brand-700 text-white'}`}
          >
            {downloaded ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {downloaded ? 'Downloaded!' : 'Download Lesson Prompt'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SectionFeedback() {
  const { open, closed } = useFeedbackBoard()
  const [tab, setTab] = useState('open')
  const [promptItem, setPromptItem] = useState(null)
  const items = tab === 'open' ? open : closed
  const { openWindow } = useDesktop()

  // Opens the same way every lab does from the Start Menu — a floating
  // window over the desktop, not a route change. A plain <a href="#/lab/...">
  // here would navigate the whole app away from wherever the learner was,
  // with no way back except guessing. This keeps them exactly where they were.
  const openContributorLessons = async () => {
    const entry = await getLabEntry('lesson-engine')
    if (entry?.component) {
      openWindow({ id: 'lesson-engine', label: 'Lesson Engine', emoji: '📖', Component: entry.component, backTo: '/' })
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-amber-500 leading-tight mb-2 flex items-center gap-3">
          <Bug className="w-8 h-8 text-rose-500" />
          Feedback & Bugs
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Found a bug, have an idea, or want to fix something yourself?
        </p>
      </div>

      <Para>
        Every bug and idea reported here is public — anyone can see what's
        been flagged and what's already been dealt with, signed in or not.
        Filing one takes an account; browsing doesn't.
      </Para>

      <div className="flex flex-wrap gap-3 my-5">
        <ReportBugButton />
        <SuggestionBoxButton />
      </div>

      <Note color="blue">
        <strong>Want to fix it yourself instead?</strong> The{' '}
        <strong>How to Contribute</strong> lessons cover Markdown, Git,
        branches &amp; PRs, reading unfamiliar code, and making your first
        pull request — no prior experience assumed.{' '}
        <button onClick={openContributorLessons} className="font-bold underline">
          → Open the lessons
        </button>
        {' · '}
        <button
          onClick={() => downloadFile('BUG_LESSON_CONTRACT.md', BUG_LESSON_CONTRACT)}
          className="font-bold underline"
          title="The teaching contract itself, on its own — no specific bug or suggestion attached"
        >
          → Download the contract
        </button>
      </Note>

      <H3>What's been reported</H3>

      <div className="flex gap-2 mb-4">
        {[
          { id: 'open', label: 'Open' },
          { id: 'closed', label: 'Closed' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
              tab === t.id
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {items === null && (
        <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
      )}
      {items !== null && items.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">
          {tab === 'open' ? 'Nothing open right now.' : 'Nothing closed yet.'}
        </p>
      )}
      {items?.map(item => (
        <FeedbackRow key={`${item.kind}-${item.id}`} item={item} onOpenPrompt={setPromptItem} />
      ))}

      <LessonPromptModal item={promptItem} onClose={() => setPromptItem(null)} />
    </div>
  )
}
