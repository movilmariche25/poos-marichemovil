
"use client";

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';

const ADMIN_PASSWORD = "2026";
const SESSION_STORAGE_KEY = 'app_unlocked';

interface AppLockContextType {
  isLocked: boolean;
  unlockApp: (password: string) => boolean;
}

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    // Check session storage on initial client-side load
    try {
      const isUnlockedInSession = sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true';
      if (isUnlockedInSession) {
        setIsLocked(false);
      }
    } catch (error) {
      console.error("Could not access session storage:", error);
    }
  }, []);

  const unlockApp = useCallback((password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
      } catch (error) {
         console.error("Could not access session storage:", error);
      }
      setIsLocked(false);
      return true;
    }
    return false;
  }, []);

  const value = { isLocked, unlockApp };

  return (
    <AppLockContext.Provider value={value}>
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  const context = useContext(AppLockContext);
  if (context === undefined) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }
  return context;
}
