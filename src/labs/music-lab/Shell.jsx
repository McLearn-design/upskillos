import { useState } from 'react'
import { MusicModelProvider, useMusic } from './model.jsx'
import SoundRoom from './rooms/SoundRoom.jsx'
import PitchRoom from './rooms/PitchRoom.jsx'
import IntervalRoom from './rooms/IntervalRoom.jsx'
import ScaleRoom from './rooms/ScaleRoom.jsx'
import ChordRoom from './rooms/ChordRoom.jsx'
import CreativeDaw from './MusicLab/MusicLab.jsx'

const ROOMS = [
  { id: 'sound', label: '1. Sound & Harmonics', comp: SoundRoom },
  { id: 'pitch', label: '2. Pitch & Tuning', comp: PitchRoom },
  { id: 'interval', label: '3. Intervals', comp: IntervalRoom },
  { id: 'scale', label: '4. Scales', comp: ScaleRoom },
  { id: 'chord', label: '5. Chords & Harmony', comp: ChordRoom },
  // Placeholder for the remaining rooms we'll add next:
  // { id: 'circle', label: '6. Circle of Fifths', comp: CircleRoom },
  // { id: 'rhythm', label: '7. Rhythm', comp: RhythmRoom },
  // { id: 'ear', label: '8. Ear Training', comp: EarRoom },
  { id: 'creative', label: 'Creative DAW', comp: CreativeDaw },
]

function LabNavigation({ activeId, onSelect, onBack }) {
  const { model, set } = useMusic()
  return (
    <div className="flex h-full flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-zinc-800 p-4">
        {onBack && (
          <button type="button" onClick={onBack} className="rounded px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            ← Back
          </button>
        )}
        <h1 className="font-semibold text-zinc-100">Music Lab</h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {ROOMS.map(r => (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
              activeId === r.id 
                ? 'bg-violet-500/20 text-violet-300' 
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </nav>

      <div className="border-t border-zinc-800 p-4">
        <label className="flex items-center justify-between text-sm text-zinc-300 cursor-pointer">
          <span>Show Math</span>
          <div className={`relative h-5 w-9 rounded-full transition-colors ${model.mathMode ? 'bg-violet-500' : 'bg-zinc-700'}`}>
            <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${model.mathMode ? 'left-5' : 'left-1'}`} />
          </div>
          <input type="checkbox" className="sr-only" checked={model.mathMode} onChange={(e) => set({ mathMode: e.target.checked })} />
        </label>
      </div>
    </div>
  )
}

function LabContent({ activeId, setRoom }) {
  const room = ROOMS.find(r => r.id === activeId)
  if (!room) return null
  
  const Comp = room.comp
  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 border-b border-zinc-800 pb-4">
          <h2 className="text-2xl font-bold">{room.label}</h2>
        </div>
        <Comp goRoom={setRoom} />
      </div>
    </div>
  )
}

// Ensure the old DAW receives the onBack prop if it needs it (it renders full screen essentially)
export default function MusicLabShell({ onBack }) {
  const [room, setRoom] = useState('sound')

  return (
    <MusicModelProvider>
      <div className="flex h-screen w-full bg-slate-950 overflow-hidden font-sans text-zinc-100">
        {room === 'creative' ? (
          <CreativeDaw onBack={() => setRoom('sound')} />
        ) : (
          <>
            <div className="w-64 flex-none">
              <LabNavigation activeId={room} onSelect={setRoom} onBack={onBack} />
            </div>
            <div className="flex-1 min-w-0">
              <LabContent activeId={room} setRoom={setRoom} />
            </div>
          </>
        )}
      </div>
    </MusicModelProvider>
  )
}
