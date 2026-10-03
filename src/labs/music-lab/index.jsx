import Shell from './Shell.jsx'

export const meta = {
  label: 'Music Lab',
  emoji: '🎵',
  color: 'violet',
  desc: 'Interactive music theory and math environment plus a full DAW. Explore sound, frequency, intervals, scales, chords, and then make beats.',
  tags: ['Music', 'Audio', 'Creative', 'Interactive', 'Math'],
  cover: { grad: 'from-violet-600 via-purple-700 to-indigo-950', mark: 'ƒ(t)', sub: 'Theory & DAW' },
}

export default function MusicLabEntry({ onBack }) {
  return <Shell onBack={onBack} />
}
