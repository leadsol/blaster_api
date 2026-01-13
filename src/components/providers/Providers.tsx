'use client'

import { ThemeProvider } from '@/contexts/ThemeContext'
import { SidebarProvider } from '@/contexts/SidebarContext'
import { NavigationGuardProvider } from '@/contexts/NavigationGuardContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <NavigationGuardProvider>{children}</NavigationGuardProvider>
      </SidebarProvider>
    </ThemeProvider>
  )
}
