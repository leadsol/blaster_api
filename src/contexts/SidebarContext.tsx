'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    if (saved === 'true') {
      setIsCollapsed(true)
    }

    // Check if mobile on mount and on resize
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false)
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileOpen(!isMobileOpen)
    } else {
      const newValue = !isCollapsed
      setIsCollapsed(newValue)
      localStorage.setItem('sidebarCollapsed', String(newValue))
    }
  }

  const openMobileSidebar = () => setIsMobileOpen(true)
  const closeMobileSidebar = () => setIsMobileOpen(false)

  return (
    <SidebarContext.Provider value={{
      isCollapsed,
      isMobileOpen,
      isMobile,
      toggleSidebar,
      setIsCollapsed,
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
