
'use client';

import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { PLAYER_MAX_HEALTH } from '@/config/game-constants';

interface PlayerHealthContextType {
  currentHealth: number;
  setCurrentHealth: Dispatch<SetStateAction<number>>;
  maxHealth: number;
  invincibilityEndTime: number | null; // Timestamp when invincibility ends
  setInvincibilityActive: (durationInSeconds: number) => void;
  clearInvincibility: () => void; // Not strictly needed by PlayerStatsDisplay but good for completeness
  decreaseHealth: (amount: number) => void; // Function to decrease player health by a specific amount
}

const PlayerHealthContext = createContext<PlayerHealthContextType | undefined>(undefined);

export function PlayerHealthProvider({ children }: { children: ReactNode }) {
  const [currentHealth, setCurrentHealth] = useState<number>(PLAYER_MAX_HEALTH);
  const [invincibilityEndTime, setInvincibilityEndTime] = useState<number | null>(null);
  const maxHealth = PLAYER_MAX_HEALTH;

  const setInvincibilityActive = useCallback((durationInSeconds: number) => {
    setInvincibilityEndTime(Date.now() + durationInSeconds * 1000);
  }, []);

  const clearInvincibility = useCallback(() => {
    setInvincibilityEndTime(null);
  }, []);

  const decreaseHealth = useCallback((amount: number) => {
    setCurrentHealth(current => Math.max(0, current - amount));
  }, []);

  const contextValue = useMemo(() => ({
    currentHealth,
    setCurrentHealth,
    maxHealth,
    invincibilityEndTime,
    setInvincibilityActive,
    clearInvincibility,
    decreaseHealth,
  }), [currentHealth, maxHealth, invincibilityEndTime, setInvincibilityActive, clearInvincibility, decreaseHealth]);

  return (
    <PlayerHealthContext.Provider value={contextValue}>
      {children}
    </PlayerHealthContext.Provider>
  );
}

export function usePlayerHealth() {
  const context = useContext(PlayerHealthContext);
  if (context === undefined) {
    throw new Error('usePlayerHealth must be used within a PlayerHealthProvider');
  }
  return context;
}
