// One shared musical model, many views. Every room reads and writes this, so a
// change of key, tuning or reference pitch follows the learner from room to room.
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { tunedFreq, midiToName, pitchClassName } from './theory/index.js'

const STORAGE_KEY = 'upskillos.musicLab.model.v1'

export const DEFAULT_MODEL = {
  a4: 440,
  tuning: 'equal',
  tonic: 0,
  octave: 4,
  scale: [0, 2, 4, 5, 7, 9, 11],
  chord: [0, 4, 7],
  mathMode: true,
  flats: false,
  voice: 'triangle',
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_MODEL, ...JSON.parse(raw) } : DEFAULT_MODEL
  } catch {
    return DEFAULT_MODEL
  }
}

const Ctx = createContext(null)

export function MusicModelProvider({ children }) {
  const [model, setModel] = useState(load)

  const set = useCallback((patch) => {
    setModel((m) => {
      const next = { ...m, ...(typeof patch === 'function' ? patch(m) : patch) }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* storage full or blocked */ }
      return next
    })
  }, [])

  const value = useMemo(() => {
    const opts = { tuning: model.tuning, tonic: model.tonic, a4: model.a4 }
    return {
      model,
      set,
      /** Frequency of a MIDI note in the current tuning, tonic and reference. */
      freq: (midi) => tunedFreq(midi, opts),
      name: (midi) => midiToName(midi, { flats: model.flats }),
      pcName: (pc) => pitchClassName(pc, { flats: model.flats }),
      /** MIDI number of the tonic in the working octave. */
      tonicMidi: (model.octave + 1) * 12 + model.tonic,
    }
  }, [model, set])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMusic() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useMusic must be used inside <MusicModelProvider>')
  return v
}

// ── Progress: concept-based, stored locally ─────────────────────────────────
const PROGRESS_KEY = 'upskillos.musicLab.progress.v1'

export function loadProgress() {
  try {
    return { visited: {}, ear: {}, challenges: {}, ...JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') }
  } catch {
    return { visited: {}, ear: {}, challenges: {} }
  }
}

export function saveProgress(update) {
  const next = typeof update === 'function' ? update(loadProgress()) : update
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  return next
}

/** Mark a challenge solved (by id) so the concept map can show it. */
export function solveChallenge(id) {
  saveProgress((p) => ({ ...p, challenges: { ...p.challenges, [id]: true } }))
}
