import MeshLab from './MeshLab.tsx'
import metaData from './meta.js'

export const meta = metaData;

interface MeshLabEntryProps {
  onBack?: () => void
}

export default function MeshLabEntry({ onBack }: MeshLabEntryProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 50 }}>
      <MeshLab onBack={onBack} />
    </div>
  )
}
