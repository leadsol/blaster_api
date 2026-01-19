'use client'

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useSyncExternalStore } from 'react'

interface ThemeContextType {
  darkMode: boolean
  toggleDarkMode: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Use useSyncExternalStore for hydration-safe mounting detection
function useHasMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

// Helper to get initial dark mode value from localStorage
function getInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('darkMode') === 'true'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(getInitialDarkMode)
  const mounted = useHasMounted()
  const initialSyncDone = useRef(false)

  // Sync the dark class with actual state - only syncs DOM, no setState
  useEffect(() => {
    // Only sync after initial mount and when darkMode changes
    if (!initialSyncDone.current) {
      initialSyncDone.current = true
    }
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const toggleDarkMode = () => {
    const newValue = !darkMode
    setDarkMode(newValue)
    localStorage.setItem('darkMode', String(newValue))

    if (newValue) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Prevent flash during hydration
  if (!mounted) {
    return null
  }

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
