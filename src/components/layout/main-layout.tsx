
"use client";

import type { ReactNode } from 'react';
import { GameLogo } from '@/components/icons/game-logo';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import PlayerStatsDisplay from '@/components/game/player-stats-display';
import { PlayerHealthProvider } from '@/contexts/player-health-context';


type MainLayoutProps = {
  children: ReactNode;
};

export default function MainLayout({ children }: MainLayoutProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <PlayerHealthProvider>
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 max-w-screen-2xl items-center">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <GameLogo className="h-8 w-8 text-primary" />
              <span className="font-bold text-xl sm:inline-block text-primary hover:text-accent transition-colors">
                WebGladiator
              </span>
            </Link>
          </div>
        </header>

        <main className="relative flex flex-row flex-grow overflow-hidden">
          <aside className="w-64 bg-card p-4 flex flex-col items-center justify-center text-muted-foreground border-r border-border/40 transition-all duration-300 ease-in-out hidden md:flex overflow-y-auto">
            <div className="flex flex-col items-center text-center space-y-4">
              <img 
                src="/images/gladiator-logo.png" 
                alt="Gladiator" 
                className="w-40 h-40 mb-4"
              />
              <h2 className="text-xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                The Cursed Coliseum
              </h2>
              <div className="space-y-3 text-sm max-w-[90%] mx-auto">
                <p>In the realm of Netheron, the Eternal Coliseum rises from the mist, where fallen warriors battle endlessly.</p>
                <p className="border-l-2 border-r-2 border-red-500 px-3 py-1 italic text-foreground mx-auto max-w-[90%]">
                  "Only by surviving the undead hordes can the curse be broken."
                </p>
                <p>Face <span className="text-blue-300">Ghosts</span>, <span className="text-white">Skeletons</span>, and <span className="text-green-400">Zombies</span> in this endless battle for freedom.</p>
              </div>
            </div>
          </aside>

          <div
            className="flex flex-col bg-background flex-grow overflow-hidden"
          >
            {children}
            <Analytics />
            <SpeedInsights />
          </div>

          <aside className="w-64 bg-card p-1 flex flex-col items-center text-muted-foreground border-l border-border/40 transition-all duration-300 ease-in-out hidden md:flex overflow-y-auto">
            {/* PlayerStatsDisplay will get health from context */}
            {isClient && <PlayerStatsDisplay />}
          </aside>
        </main>
      </div>
    </PlayerHealthProvider>
  );
}
