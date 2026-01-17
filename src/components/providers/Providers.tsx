'use client'

import { ThemeProvider } from '@/contexts/ThemeContext'
import { SidebarProvider } from '@/contexts/SidebarContext'
import { NavigationGuardProvider } from '@/contexts/NavigationGuardContext'
import { ConnectionProvider } from '@/contexts/ConnectionContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <ConnectionProvider>
          <NavigationGuardProvider>{children}</NavigationGuardProvider>
        </ConnectionProvider>
      </SidebarProvider>
    </ThemeProvider>
  )
}
