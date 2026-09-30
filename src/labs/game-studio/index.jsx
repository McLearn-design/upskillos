import GameStudio from './GameStudio.tsx';

export { default as meta } from './meta';

export default function GameStudioEntry({ onBack, onClose }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <GameStudio onBack={onBack ?? onClose} />
    </div>
  );
}

