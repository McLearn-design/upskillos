// The Home page's Spotlight category: the apps that give a learner the most for their
// time, shown with full descriptions instead of a topic card's one truncated line. The
// first entry (the Lesson Engine) spans the full width as the app's centrepiece.
// Text comes from src/data/spotlight.js; names, icons, colors and routes from the
// registries, through TopicTable's resolveEntry.

import { useNavigate } from 'react-router-dom'
import { Check, ArrowRight } from 'lucide-react'
import { usePinLauncher } from '../../hooks/usePinLauncher.js'
import { GLASS_META } from '../../styles/courseColors.js'
import { resolveEntry, launchEntry } from './TopicTable.jsx'
import { SPOTLIGHT } from '../../data/spotlight.js'

// intro: the sentence under the heading. The desktop Home page has a topic bar to point at;
// the phone Home page doesn't.
export default function SpotlightGrid({ intro = 'The apps that give you the most for your time. Start here, or use the topics above to browse everything.' }) {
  const navigate = useNavigate()
  const { openPin } = usePinLauncher()

  const entries = SPOTLIGHT
    .map(item => ({ item, entry: resolveEntry({ kind: item.kind, key: item.key }) }))
    .filter(({ entry }) => entry)   // an app removed from its registry drops out quietly

  return (
    <section aria-labelledby="spotlight-heading" className="relative">
      <div className="mb-6 px-1">
        <h2 id="spotlight-heading" className="text-3xl font-black tracking-tight bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
          Spotlight
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
          {intro}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {entries.map(({ item, entry }, index) => {
          const meta = GLASS_META[entry.color ?? entry.cardItem.color] ?? GLASS_META.slate
          const featured = index === 0
          // The cards after the featured one sit two to a row; an odd one out at the end
          // takes the whole row rather than leaving a gap beside it.
          const lastAlone = index === entries.length - 1 && (entries.length - 1) % 2 === 1
          return (
            <article
              key={`${entry.kind}-${entry.key}`}
              className={`relative overflow-hidden rounded-3xl border-2 ${meta.border} bg-white/85 dark:bg-[#0b0f19]/90 backdrop-blur-xl p-6 flex flex-col ${featured || lastAlone ? 'lg:col-span-2' : ''}`}
            >
              <div className={`absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-br ${meta.header} rounded-full blur-[90px] opacity-20 pointer-events-none`} />

              <div className="relative flex items-start gap-4">
                <span className="text-5xl leading-none shrink-0" aria-hidden="true">{entry.cardItem.icon || entry.emoji}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`text-xl font-black tracking-tight ${meta.text}`}>{entry.label}</h3>
                    {featured && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-300 border border-amber-400/40">
                        Start here
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">{item.headline}</p>
                </div>
              </div>

              <p className="relative mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.description}</p>

              <ul className={`relative mt-4 grid gap-2 ${featured ? 'md:grid-cols-3' : ''}`}>
                {item.highlights.map(highlight => (
                  <li key={highlight} className="flex items-start gap-2 text-[13px] text-slate-700 dark:text-slate-300">
                    <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>

              <div className="relative mt-auto pt-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 min-w-0 sm:flex-1 max-w-xl">
                  <span className="font-bold uppercase tracking-wider text-[10px] mr-1.5">Best for</span>
                  {item.bestFor}
                </p>
                <button
                  type="button"
                  onClick={() => launchEntry(entry, { navigate, openPin })}
                  className={`shrink-0 self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r ${meta.header} shadow hover:brightness-110 transition`}
                >
                  Open {entry.label}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
