
import ArenaDisplay from '@/components/game/arena-display';
import GameUIOverlay from '@/components/game/game-ui-overlay';

export default function HomePage() {
  return (
    // Reverted to simpler flex-1 for growth within MainLayout's central div
    <div className="w-full h-full relative overflow-hidden flex-1"> 
      <ArenaDisplay />
      <GameUIOverlay />
    </div>
  );
}
