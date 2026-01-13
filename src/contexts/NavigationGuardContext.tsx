'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react'

interface NavigationGuardContextType {
  isBlocking: boolean
  setBlocking: (blocking: boolean, confirmCallback?: () => void) => void
  checkNavigation: (targetUrl: string, navigateCallback: (url: string) => void) => boolean
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
  const navigateCallbackRef = useRef<((url: string) => void) | null>(null)

  const setBlocking = useCallback((blocking: boolean, callback?: () => void) => {
    setIsBlocking(blocking)
    setConfirmCallback(() => callback)
  }, [])

  const checkNavigation = useCallback((targetUrl: string, navigateCallback: (url: string) => void): boolean => {
    if (!isBlocking) {
      return true // Allow navigation
    }
    // Store the navigation callback for later use
    navigateCallbackRef.current = navigateCallback
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
    const navigate = navigateCallbackRef.current
    setPendingUrl(null)
    setIsBlocking(false)
    navigateCallbackRef.current = null

    // Navigate using the stored callback (Next.js router)
    if (url && navigate) {
      navigate(url)
    }
  }, [confirmCallback, pendingUrl])

  const cancelNavigation = useCallback(() => {
    setShowConfirmDialog(false)
    setPendingUrl(null)
    navigateCallbackRef.current = null
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
