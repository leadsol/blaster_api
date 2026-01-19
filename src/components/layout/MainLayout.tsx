'use client'

import { Sidebar } from './Sidebar'
import { useTheme } from '@/contexts/ThemeContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { Menu } from 'lucide-react'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { darkMode } = useTheme()
  const { isCollapsed, isMobileOpen, isMobile, openMobileSidebar, closeMobileSidebar } = useSidebar()

  return (
    <div className="min-h-screen lg:h-screen overflow-y-auto lg:overflow-hidden bg-[#030733]" dir="rtl">
      {/* Background blur circles - hidden on small screens for performance */}
      <div className="hidden sm:block fixed w-[551px] h-[551px] rounded-full bg-[#0043E0] opacity-[0.22] blur-[216px] -top-[270px] right-[384px] pointer-events-none" />
      <div className="hidden sm:block fixed w-[551px] h-[551px] rounded-full bg-[#0043E0] opacity-[0.22] blur-[216px] top-[815px] left-[200px] pointer-events-none" />
      <div className="hidden sm:block fixed w-[551px] h-[551px] rounded-full bg-[#0043E0] opacity-[0.22] blur-[216px] -top-[24px] -left-[200px] pointer-events-none" />

      {/* Mobile Header - shown only on mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-[60px] bg-[#030733] z-30 flex items-center justify-between px-4 safe-area-inset">
        <button
          onClick={openMobileSidebar}
          className="w-10 h-10 flex items-center justify-center text-white rounded-lg hover:bg-white/10 transition-colors"
          aria-label="פתח תפריט"
        >
          <Menu className="w-6 h-6" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://res.cloudinary.com/dimsgvsze/image/upload/v1768252823/9355f35c-2671-4e32-831f-21d63a876684_zjmk09.png"
          alt="LeadSol Logo"
          className="h-[28px] w-auto"
        />
        <div className="w-10" /> {/* Spacer for balance */}
      </div>

      {/* Mobile Overlay */}
      {isMobile && (
        <div
          className={`mobile-nav-overlay ${isMobileOpen ? 'active' : ''}`}
          onClick={closeMobileSidebar}
        />
      )}

      {/* Sidebar - Desktop: fixed, Mobile: slide-in */}
      <div className={`
        ${isMobile
          ? `mobile-sidebar ${isMobileOpen ? 'active' : ''}`
          : 'hidden lg:block'
        }
      `}>
        <Sidebar />
      </div>

      {/* Main content area */}
      <main
        className={`lg:h-screen transition-all duration-300
          p-2 sm:p-3 lg:p-[19px]
          pt-[68px] lg:pt-[19px]
          pb-4 lg:pb-[19px]
          ${isCollapsed ? 'lg:mr-0' : 'lg:mr-[268px]'}
        `}
      >
        <div
          className={`lg:h-[calc(100vh-38px)] overflow-y-auto lg:overflow-hidden transition-colors duration-300
            rounded-[15px] sm:rounded-[20px] lg:rounded-[25px]
            ${darkMode
              ? 'bg-[#0a1628] text-white'
              : 'bg-[#F2F3F8] text-[#030733]'
            }`}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
