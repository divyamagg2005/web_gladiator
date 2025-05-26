
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback } from 'react';

interface DistractionFreeContextType {
  isDistractionFree: boolean;
  toggleDistractionFree: () => void;
}

const DistractionFreeContext = createContext<DistractionFreeContextType | undefined>(undefined);

export function DistractionFreeProvider({ children }: { children: ReactNode }) {
  const [isDistractionFree, setIsDistractionFree] = useState(false);

  const toggleDistractionFree = useCallback(() => {
    setIsDistractionFree(prev => !prev);
  }, []);

  return (
    <DistractionFreeContext.Provider value={{ isDistractionFree, toggleDistractionFree }}>
      {children}
    </DistractionFreeContext.Provider>
  );
}

export function useDistractionFree() {
  const context = useContext(DistractionFreeContext);
  if (context === undefined) {
    throw new Error('useDistractionFree must be used within a DistractionFreeProvider');
  }
  return context;
}
