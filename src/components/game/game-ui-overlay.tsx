"use client";

import { Shield, Skull, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { usePlayerHealth } from '@/contexts/player-health-context';

export default function GameUIOverlay() {
  const { currentHealth, maxHealth } = usePlayerHealth();
  const healthPercentage = (currentHealth / maxHealth) * 100;

  return (
    <div className="absolute inset-0 pointer-events-none p-4 md:p-6 flex flex-col text-foreground">
      {/* All UI elements moved to player-stats-display.tsx */}

      <div
        id="blocker"
        className="absolute inset-0 bg-black/70 grid place-items-center text-white text-center pointer-events-auto z-10 overflow-y-auto py-8"
      >
        <div
          id="instructions"
          className="p-8 rounded-lg bg-background/90 shadow-xl cursor-pointer max-w-4xl w-full mx-4 my-8 text-left"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-primary">WEB GLADIATOR - SURVIVAL ARENA</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            <section>
              <h3 className="text-lg font-semibold mb-2 text-accent">🎮 CONTROLS</h3>
              <ul className="space-y-1 text-sm">
                <li><span className="font-medium">WASD</span> - Move around</li>
                <li><span className="font-medium">Mouse</span> - Look around</li>
                <li><span className="font-medium">Left Click</span> or <span className="font-medium">E</span> - Attack/Shoot</li>
                <li><span className="font-medium">Right Click</span> or <span className="font-medium">R</span> - Kick</li>
                <li><span className="font-medium">Space</span> - Jump (up to 4x in air)</li>
                <li><span className="font-medium">Left Shift</span> - Run</li>
                <li><span className="font-medium">Left Ctrl/C</span> - Crouch</li>
                <li><span className="font-medium">F</span> - Toggle Torch (for night)</li>
                <li><span className="font-medium">ESC</span> - Release mouse cursor</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 text-accent">⚔️ WEAPONS</h3>
              <div className="space-y-3">
                <div>
                  <p className="font-medium">Fists (Default)</p>
                  <p className="text-xs opacity-80">Basic melee attack</p>
                </div>
                <div>
                  <p className="font-medium">Gun 1</p>
                  <p className="text-xs opacity-80">Standard sidearm with moderate damage</p>
                </div>
                <div>
                  <p className="font-medium">Gun 2</p>
                  <p className="text-xs opacity-80">Powerful sidearm with high damage</p>
                </div>
                <div>
                  <p className="font-medium">Sword</p>
                  <p className="text-xs opacity-80">Devastating melee weapon, no ammo needed</p>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <section>
              <h3 className="text-lg font-semibold mb-2 text-accent">👹 ENEMIES</h3>
              <div className="space-y-3">
                <div>
                  <p className="font-medium">Zombie</p>
                  <p className="text-xs opacity-80">Slow but tough, deals moderate damage</p>
                </div>
                <div>
                  <p className="font-medium">Skeleton</p>
                  <p className="text-xs opacity-80">Fast and aggressive, high damage</p>
                </div>
                <div>
                  <p className="font-medium">Ghost</p>
                  <p className="text-xs opacity-80">Sneaky and deadly, appears at night</p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 text-accent">✨ POWER-UPS</h3>
              <div className="space-y-2">
                <div>
                  <p className="font-medium">Health Pack</p>
                  <p className="text-xs opacity-80">Restores your health</p>
                </div>
                <div>
                  <p className="font-medium">Invincibility</p>
                  <p className="text-xs opacity-80">Temporary damage immunity (10s)</p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 text-accent">💡 GAME MECHANICS</h3>
              <ul className="space-y-1 text-sm">
                <li>• Survive against endless waves of enemies</li>
                <li>• Difficulty increases over time</li>
                <li>• Day/Night cycle affects gameplay</li>
                <li>• Use environment to your advantage</li>
                <li>• Collect weapons and power-ups to survive longer</li>
              </ul>
            </section>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-border">
          <p className="text-center text-sm opacity-80">Click anywhere to start playing</p>
          <p className="text-center text-xs mt-2 opacity-60">Press ESC anytime to access this menu</p>
        </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="font-semibold mb-2">Movement Controls:</p>
              <p className="text-md">Use W, A, S, D to move.</p>
              <p className="text-md">Move mouse to look.</p>
              <p className="text-md">Press SPACE to Jump (up to 4 times).</p>
              <p className="text-md">Hold SHIFT to Run.</p>
              <p className="text-md">Press CTRL or C to Crouch.</p>
              <p className="text-md">Press F to toggle Torch.</p>
            </div>
            
            <div>
              <p className="font-semibold mb-2">Combat Controls:</p>
              <p className="text-md">Left Mouse: Punch/use weapon.</p>
              <p className="text-md">Right Mouse: Kick.</p>
              <p className="text-md">Collect power-ups to get weapons and health.</p>
              <p className="text-md text-red-400">Watch out for villains at night!</p>
            </div>
          </div>
          
          <p className="text-lg mt-2 font-semibold">Press ESC to release mouse.</p>
          <p className="text-lg font-semibold">Press P to Pause/Resume game.</p>
        </div>
        <div
          id="paused-message"
          className="p-8 rounded-lg bg-background/90 shadow-xl"
          style={{display: 'none'}} 
        >
          <p className="text-2xl font-bold mb-4">Game Paused</p>
          <p className="text-lg">Press P to Resume</p>
        </div>
      </div>
    </div>
  );
}
