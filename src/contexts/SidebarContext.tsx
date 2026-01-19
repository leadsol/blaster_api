'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

interface SidebarContextType {
  isCollapsed: boolean
  isMobileOpen: boolean
  isMobile: boolean
  toggleSidebar: () => void
  setIsCollapsed: (value: boolean) => void
  openMobileSidebar: () => void
  closeMobileSidebar: () => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

// Helper to get initial collapsed state from localStorage
function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('sidebarCollapsed') === 'true'
}

// Helper to get initial mobile state
function getInitialMobile(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 1024
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsed)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(getInitialMobile)

  // Handle resize events
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      if (!mobile) {
        setIsMobileOpen(false)
      }
    }

    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setIsMobileOpen(prev => !prev)
    } else {
      setIsCollapsed(prev => {
        const newValue = !prev
        localStorage.setItem('sidebarCollapsed', String(newValue))
        return newValue
      })
    }
  }, [isMobile])

  const openMobileSidebar = useCallback(() => setIsMobileOpen(true), [])
  const closeMobileSidebar = useCallback(() => setIsMobileOpen(false), [])

  const handleSetIsCollapsed = useCallback((value: boolean) => {
    setIsCollapsed(value)
    localStorage.setItem('sidebarCollapsed', String(value))
  }, [])

  return (
    <SidebarContext.Provider value={{
      isCollapsed,
      isMobileOpen,
      isMobile,
      toggleSidebar,
      setIsCollapsed: handleSetIsCollapsed,
      openMobileSidebar,
      closeMobileSidebar
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
