'use client'

import { ThemeProvider } from '@/contexts/ThemeContext'
import { SidebarProvider } from '@/contexts/SidebarContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SidebarProvider>{children}</SidebarProvider>
    </ThemeProvider>
  )
}
