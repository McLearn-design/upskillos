import { Play } from 'lucide-react'

// What a narrated lesson player shows before it starts. Without it the
// narration area is empty until Play is pressed, and nothing says that Play
// is the first thing to press.
export default function PlayerIdleIntro({ title, resuming, steps, onStart }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={onStart}
        className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-black shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all hover:scale-105 hover:bg-slate-200"
      >
        <Play size={14} className="fill-black" /> {resuming ? 'Resume lesson' : 'Start lesson'}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-slate-100">{title}</p>
        <p className="text-xs text-slate-400">
          {resuming ? 'Pick up where you left off. ' : ''}
          The lesson talks you through the code in {steps} short steps. Press Play to begin, then the → button whenever you are ready for the next step. You can edit and Run the code at any point.
        </p>
      </div>
    </div>
  )
}
