
'use client';

import { Heart, Timer, CheckSquare, AlertTriangle, ShieldEllipsis, Skull, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';
import { usePlayerHealth } from '@/contexts/player-health-context';

// Timer and checkpoint constants
const INITIAL_TIME = 120; // 2 minutes
const TOTAL_CHECKPOINTS = 5;

// Game state types
type GameState = 'playing' | 'won' | 'lost';

export default function PlayerStatsDisplay() {
  const { currentHealth, maxHealth, invincibilityEndTime } = usePlayerHealth();
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [checkpointsFound, setCheckpointsFound] = useState(0);
  // Threat status removed as requested
  const [invincibilityTimeLeft, setInvincibilityTimeLeft] = useState<number | null>(null);
  const [activeVillains, setActiveVillains] = useState(0);
  const [killedVillains, setKilledVillains] = useState(0);
  const [gameState, setGameState] = useState<GameState>('playing');
  const [gameOverReason, setGameOverReason] = useState<string>('');

  // Timer countdown effect that only starts when game begins and stops when game is paused or over
  useEffect(() => {
    // Check for game pause state - only consider paused when pointer is unlocked (ESC pressed)
    const checkGamePaused = () => {
      // Check if pointer is locked - if not, game is paused
      return !document.pointerLockElement;
    };
    
    // Check if game has started
    const checkGameStarted = () => {
      const startedElement = document.getElementById('game-started');
      return startedElement ? startedElement.textContent === 'true' : false;
    };
    
    const timerInterval = setInterval(() => {
      // Only decrement timer if:
      // 1. Game has started
      // 2. Game is not paused
      // 3. Game is still in playing state (not won or lost)
      if (checkGameStarted() && !checkGamePaused() && gameState === 'playing') {
        setTimeLeft((prevTime) => (prevTime > 0 ? prevTime - 1 : 0));
      }
    }, 1000);
    
    return () => clearInterval(timerInterval);
  }, [gameState]);

  // Threat status toggle effect removed as requested
  
  // Effect to update villain counts from DOM elements
  useEffect(() => {
    const updateVillainCounts = () => {
      const villainCountElement = document.getElementById('villain-count');
      const villainKillCountElement = document.getElementById('villain-kill-count');
      
      if (villainCountElement) {
        setActiveVillains(parseInt(villainCountElement.textContent || '0', 10));
      }
      
      if (villainKillCountElement) {
        setKilledVillains(parseInt(villainKillCountElement.textContent || '0', 10));
      }
    };
    
    // Update initially
    updateVillainCounts();
    
    // Set up an interval to check for updates
    const interval = setInterval(updateVillainCounts, 1000);
    return () => clearInterval(interval);
  }, []);

  // Effect to update checkpoint count from DOM element
  useEffect(() => {
    const updateCheckpointCount = () => {
      const checkpointCountElement = document.getElementById('checkpoint-count');
      
      if (checkpointCountElement) {
        const count = parseInt(checkpointCountElement.textContent || '0', 10);
        if (count !== checkpointsFound) {
          setCheckpointsFound(count);
        }
      }
    };
    
    // Update initially
    updateCheckpointCount();
    
    // Set up an interval to check for updates
    const interval = setInterval(updateCheckpointCount, 500); // Check more frequently for responsive UI
    return () => clearInterval(interval);
  }, [checkpointsFound]);
  
  // Effect to check for win/lose conditions
  useEffect(() => {
    // Only check if the game is still in progress
    if (gameState !== 'playing') return;
    
    // Win condition: All checkpoints collected
    if (checkpointsFound >= TOTAL_CHECKPOINTS) {
      setGameState('won');
      setGameOverReason('You collected all checkpoints!');
      
      // Signal game over to arena display
      updateGameOverState('won', 'You collected all checkpoints!');
      return;
    }
    
    // Lose condition 1: Health depleted
    if (currentHealth <= 0) {
      setGameState('lost');
      setGameOverReason('Your health depleted!');
      
      // Signal game over to arena display
      updateGameOverState('lost', 'Your health depleted!');
      return;
    }
    
    // Lose condition 2: Time's up
    if (timeLeft <= 0) {
      setGameState('lost');
      setGameOverReason('Time ran out!');
      
      // Signal game over to arena display
      updateGameOverState('lost', 'Time ran out!');
      return;
    }
  }, [gameState, checkpointsFound, currentHealth, timeLeft]);
  
  // Function to update game over state in DOM for arena display to read
  const updateGameOverState = (state: 'won' | 'lost', reason: string) => {
    // Update game-over element
    const gameOverElement = document.getElementById('game-over');
    if (gameOverElement) {
      gameOverElement.textContent = state;
    } else {
      const newElement = document.createElement('div');
      newElement.id = 'game-over';
      newElement.style.display = 'none'; // Hidden element
      newElement.textContent = state;
      document.body.appendChild(newElement);
    }
    
    // Update game-over-reason element
    const gameOverReasonElement = document.getElementById('game-over-reason');
    if (gameOverReasonElement) {
      gameOverReasonElement.textContent = reason;
    } else {
      const newElement = document.createElement('div');
      newElement.id = 'game-over-reason';
      newElement.style.display = 'none'; // Hidden element
      newElement.textContent = reason;
      document.body.appendChild(newElement);
    }
  };

  // Invincibility Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (invincibilityEndTime) {
      const updateTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((invincibilityEndTime - now) / 1000));
        setInvincibilityTimeLeft(remaining);

        if (remaining <= 0) {
          setInvincibilityTimeLeft(null); // Timer ends
          // No need to call clearInvincibility here, ArenaDisplay manages isInvincibleRef
          if (interval) clearInterval(interval);
        }
      };

      updateTimer(); // Initial call
      interval = setInterval(updateTimer, 1000);
    } else {
      setInvincibilityTimeLeft(null); // Clear timer if invincibility ends externally
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [invincibilityEndTime]);


  const healthPercentage = maxHealth > 0 ? (currentHealth / maxHealth) * 100 : 0;

  return (
    <div className="w-full p-4 space-y-4 max-w-sm mx-auto bg-black/40 backdrop-blur-md rounded-lg border border-gray-800 shadow-2xl">
      {/* Game Over Overlay */}
      {gameState !== 'playing' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="bg-gray-900/90 border-2 border-gray-700 rounded-lg p-8 max-w-md text-center transform animate-fadeIn">
            <h2 className={`text-4xl font-bold mb-4 ${gameState === 'won' ? 'text-green-500' : 'text-red-500'}`}>
              {gameState === 'won' ? 'VICTORY!' : 'GAME OVER'}
            </h2>
            <p className="text-xl text-white mb-6">{gameOverReason}</p>
            <div className="flex flex-col space-y-4">
              <div className="flex justify-between text-white">
                <span>Checkpoints:</span>
                <span className="font-bold">{checkpointsFound}/{TOTAL_CHECKPOINTS}</span>
              </div>
              <div className="flex justify-between text-white">
                <span>Time Left:</span>
                <span className="font-bold">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
              </div>
              <div className="flex justify-between text-white">
                <span>Villains Killed:</span>
                <span className="font-bold">{killedVillains}</span>
              </div>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-8 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors duration-200"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
      
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-white/90 uppercase tracking-wider">Game Status</h2>
        <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent mt-1"></div>
      </div>
      
      {/* Health with animated pulse when low */}
      <Card className={`bg-gradient-to-r ${currentHealth < maxHealth * 0.3 ? 'from-red-900/80 to-red-800/80 animate-pulse' : 'from-gray-900/80 to-gray-800/80'} backdrop-blur-sm border-gray-700 shadow-lg overflow-hidden`}>
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-lg flex items-center text-white">
            <Heart className={`h-5 w-5 mr-2 ${currentHealth < maxHealth * 0.3 ? 'text-red-400 animate-pulse' : 'text-red-500'}`} />
            Player Health
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <Progress 
            value={healthPercentage} 
            className="w-full h-4 mb-1 overflow-hidden" 
            style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '9999px',
            }}
          />
          <p className="text-sm text-right font-semibold text-white/90">
            {currentHealth} / {maxHealth}
          </p>
        </CardContent>
      </Card>

      {/* Invincibility with pulsing glow effect */}
      {invincibilityTimeLeft !== null && invincibilityTimeLeft > 0 && (
        <Card className="bg-gradient-to-r from-purple-900/80 to-blue-800/80 backdrop-blur-sm border-blue-700 shadow-lg overflow-hidden">
          <div className="absolute inset-0 bg-blue-500/20 animate-pulse rounded-lg"></div>
          <CardHeader className="p-3 pb-0 relative z-10">
            <CardTitle className="text-lg flex items-center text-white">
              <ShieldEllipsis className="h-5 w-5 mr-2 text-blue-300 animate-pulse" />
              Invincible!
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 relative z-10">
            <p className="text-3xl font-bold text-center text-white">
              {invincibilityTimeLeft}s
            </p>
          </CardContent>
        </Card>
      )}

      {/* Time left with digital clock style */}
      <Card className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-sm border-gray-700 shadow-lg overflow-hidden">
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-lg flex items-center text-white">
            <Timer className="h-5 w-5 mr-2 text-blue-400" />
            Time Left
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="bg-black/50 rounded-md p-2 border border-gray-700">
            <p className="text-3xl font-mono font-bold text-center text-blue-400">
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Checkpoints with progress indicator */}
      <Card className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-sm border-gray-700 shadow-lg overflow-hidden">
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-lg flex items-center text-white">
            <CheckSquare className="h-5 w-5 mr-2 text-green-400" />
            Checkpoints
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="flex justify-between items-center">
            {[...Array(TOTAL_CHECKPOINTS)].map((_, i) => (
              <div 
                key={i} 
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  i < checkpointsFound 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-800 text-gray-500 border border-gray-700'
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <p className="text-sm text-center mt-2 font-semibold text-white/80">
            {checkpointsFound} / {TOTAL_CHECKPOINTS} collected
          </p>
        </CardContent>
      </Card>

      {/* Villain counters with improved visuals */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gradient-to-r from-red-900/70 to-gray-800/70 backdrop-blur-sm border-red-900/50 shadow-lg overflow-hidden">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-lg flex items-center text-white">
              <Skull className="h-5 w-5 mr-2 text-red-400" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 text-center">
            <p className="text-3xl font-bold text-red-400">{activeVillains}</p>
            <p className="text-xs text-gray-400 mt-1">villains</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-yellow-900/70 to-gray-800/70 backdrop-blur-sm border-yellow-900/50 shadow-lg overflow-hidden">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-lg flex items-center text-white">
              <Trophy className="h-5 w-5 mr-2 text-yellow-400" />
              Killed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 text-center">
            <p className="text-3xl font-bold text-yellow-400">{killedVillains}</p>
            <p className="text-xs text-gray-400 mt-1">villains</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Footer removed as requested */}
    </div>
  );
}
