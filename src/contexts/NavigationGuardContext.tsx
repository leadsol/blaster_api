'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface NavigationGuardContextType {
  isBlocking: boolean
  setBlocking: (blocking: boolean, confirmCallback?: () => void) => void
  checkNavigation: (targetUrl: string) => boolean // Returns true if navigation should proceed
  showConfirmDialog: boolean
  pendingUrl: string | null
  confirmNavigation: () => void
  cancelNavigation: () => void
}

const NavigationGuardContext = createContext<NavigationGuardContextType | undefined>(undefined)

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const [isBlocking, setIsBlocking] = useState(false)
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | undefined>()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)

  const setBlocking = useCallback((blocking: boolean, callback?: () => void) => {
    setIsBlocking(blocking)
    setConfirmCallback(() => callback)
  }, [])

  const checkNavigation = useCallback((targetUrl: string): boolean => {
    if (!isBlocking) {
      return true // Allow navigation
    }
    // Block navigation and show confirm dialog
    setPendingUrl(targetUrl)
    setShowConfirmDialog(true)
    return false // Block navigation
  }, [isBlocking])

  const confirmNavigation = useCallback(() => {
    if (confirmCallback) {
      confirmCallback() // Clean up (clear storage, etc.)
    }
    setShowConfirmDialog(false)
    const url = pendingUrl
    setPendingUrl(null)
    setIsBlocking(false)

    // Navigate after state update
    if (url) {
      window.location.href = url
    }
  }, [confirmCallback, pendingUrl])

  const cancelNavigation = useCallback(() => {
    setShowConfirmDialog(false)
    setPendingUrl(null)
  }, [])

  return (
    <NavigationGuardContext.Provider value={{
      isBlocking,
      setBlocking,
      checkNavigation,
      showConfirmDialog,
      pendingUrl,
      confirmNavigation,
      cancelNavigation
    }}>
      {children}
    </NavigationGuardContext.Provider>
  )
}

export function useNavigationGuard() {
  const context = useContext(NavigationGuardContext)
  if (context === undefined) {
    throw new Error('useNavigationGuard must be used within a NavigationGuardProvider')
  }
  return context
}
