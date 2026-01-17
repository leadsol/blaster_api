'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, ChevronLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { SupportModal } from '@/components/modals/SupportModal'
import { ConfirmModal } from '@/components/modals/ConfirmModal'
import { useTheme } from '@/contexts/ThemeContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { useNavigationGuard } from '@/contexts/NavigationGuardContext'

interface Connection {
  id: string
  session_name: string
  display_name: string | null
  status: string
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { toggleDarkMode } = useTheme()
  const { isCollapsed, toggleSidebar, isMobile, closeMobileSidebar } = useSidebar()
  const { checkNavigation, showConfirmDialog, confirmNavigation, cancelNavigation } = useNavigationGuard()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [userName, setUserName] = useState('')
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    loadUserData()
    loadConnections()
    loadUnreadCount()
  }, [])

  const loadUserData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'משתמש'
      setUserName(fullName)
    }
  }

  const loadConnections = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('connections')
      .select('id, session_name, display_name, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data && data.length > 0) {
      setConnections(data)
      // Select the first connected one, or just the first one
      const connected = data.find(c => c.status === 'connected') || data[0]
      setSelectedConnection(connected)
    }
  }

  const loadUnreadCount = async () => {
    try {
      const response = await fetch('/api/notifications')
      if (response.ok) {
        const notifications = await response.json()
        const unread = notifications.filter((n: { is_read: boolean }) => !n.is_read).length
        setUnreadCount(unread)
      }
    } catch {
      // Silently fail - user might not be logged in
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Handle link click - check navigation guard and close sidebar on mobile
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Always prevent default - we'll handle navigation ourselves
    e.preventDefault()

    // Check if navigation should be blocked (pass router.push as callback)
    if (!checkNavigation(href, (url) => router.push(url))) {
      return // Navigation blocked, dialog will show
    }

    // Navigation allowed - close mobile sidebar and navigate
    if (isMobile) {
      closeMobileSidebar()
    }
    router.push(href)
  }

  if (isCollapsed && !isMobile) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed right-0 top-6 w-10 h-10 bg-[#030733] text-white rounded-l-lg flex items-center justify-center z-40 hover:bg-[#0a1050] transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
    )
  }

  return (
    <aside className={`
      ${isMobile ? 'w-full h-full' : 'fixed right-0 top-0 h-screen w-[268px]'}
      bg-[#030733] text-white flex flex-col z-40
      ${isMobile ? 'rounded-none' : 'rounded-[30px]'}
      overflow-hidden
    `} dir="rtl">
      {/* Background blur circles */}
      <div className="absolute w-[551px] h-[551px] -left-[1268px] top-[281px] rotate-180 bg-[rgba(0,67,224,0.22)] rounded-full blur-[216px] pointer-events-none" />
      <div className="absolute w-[551px] h-[551px] left-[69px] top-[1366px] rotate-180 bg-[rgba(0,67,224,0.22)] rounded-full blur-[216px] pointer-events-none" />
      <div className="absolute w-[551px] h-[551px] left-[298px] top-[24px] rotate-180 bg-[rgba(0,67,224,0.22)] rounded-full blur-[216px] pointer-events-none" />

      {/* Header with Logo and Arrow/Close */}
      <div className="flex items-center justify-between px-[30px] pt-[44px] pb-6">
        <Link href="/" onClick={(e) => handleLinkClick(e, '/')}>
          <img
            src="https://res.cloudinary.com/dimsgvsze/image/upload/v1768252823/9355f35c-2671-4e32-831f-21d63a876684_zjmk09.png"
            alt="LeadSol Logo"
            className="h-[35px] w-auto"
          />
        </Link>
        <button
          onClick={isMobile ? closeMobileSidebar : toggleSidebar}
          className="w-10 h-10 flex items-center justify-center text-white hover:text-white/80 hover:bg-white/10 rounded-lg transition-colors"
          aria-label={isMobile ? "סגור תפריט" : "כווץ תפריט"}
        >
          {isMobile ? (
            <X className="w-6 h-6" />
          ) : (
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.15625 2.8125L9.84375 7.5L5.15625 12.1875" stroke="white" strokeWidth="0.9375" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      {/* Session Selector */}
      <div className="px-[30px] mb-4 relative">
        <button
          onClick={() => connections.length > 0 && setShowDropdown(!showDropdown)}
          className="w-full h-[52px] bg-[rgba(0,67,224,0.31)] rounded-[8px] flex items-center justify-between px-3"
        >
          <div className="flex flex-col text-right">
            <span className="text-[#A8A8A8] text-[13px]">
              {selectedConnection ? 'מחובר ל' : 'אין חיבורים'}
            </span>
            <span className="text-white text-[16px]">
              {selectedConnection?.display_name || selectedConnection?.session_name || 'הוסף חיבור'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {connections.length > 1 && (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn("transition-transform", showDropdown && "rotate-180")}>
                <path d="M12.1875 5.15625L7.5 9.84375L2.8125 5.15625" stroke="white" strokeWidth="0.9375" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            <div className={cn(
              "w-[34px] h-[34px] rounded-[5.67px] flex items-center justify-center",
              selectedConnection?.status === 'connected'
                ? "bg-gradient-to-br from-[#2E67EE] via-[#0043E0] to-[#3B72F4]"
                : "bg-gray-500"
            )}>
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.2505 2.87585C14.5276 2.63513 14.9396 2.63513 15.2167 2.87585L17.6088 4.954C17.7596 5.08496 17.957 5.14911 18.1559 5.13177L21.3128 4.85658C21.6784 4.82469 22.0118 5.06689 22.0945 5.42452L22.8082 8.51184C22.8533 8.70638 22.9752 8.87433 23.1463 8.97723L25.8621 10.6101C26.1766 10.7993 26.3039 11.1911 26.1605 11.5291L24.9234 14.4463C24.8455 14.6302 24.8455 14.8377 24.9234 15.0216L26.1605 17.9388C26.3039 18.2767 26.1766 18.6686 25.8621 18.8578L23.1463 20.4906C22.9752 20.5935 22.8533 20.7615 22.8082 20.9561L22.0945 24.0433C22.0118 24.401 21.6784 24.6432 21.3128 24.6113L18.1559 24.3361C17.957 24.3187 17.7596 24.3829 17.6088 24.5138L15.2167 26.5921C14.9396 26.8327 14.5276 26.8327 14.2505 26.5921L11.8583 24.5138C11.7076 24.3829 11.5102 24.3187 11.3112 24.3361L8.15446 24.6113C7.78879 24.6432 7.45544 24.401 7.37276 24.0433L6.65898 20.9561C6.614 20.7615 6.49198 20.5935 6.32085 20.4906L3.60521 18.8578C3.29063 18.6686 3.1633 18.2767 3.30662 17.9388L4.54385 15.0216C4.6218 14.8377 4.6218 14.6302 4.54385 14.4463L3.30662 11.5291C3.1633 11.1911 3.29063 10.7993 3.60521 10.6101L6.32085 8.97723C6.49198 8.87433 6.614 8.70638 6.65898 8.51184L7.37276 5.42452C7.45544 5.06689 7.78879 4.82469 8.15446 4.85658L11.3112 5.13177C11.5102 5.14911 11.7076 5.08496 11.8583 4.954L14.2505 2.87585Z" fill="white"/>
                <path d="M11.0508 15.9607L13.5063 18.4162L16.5758 15.3468L19.6452 12.2773" stroke="#0043E0" strokeWidth="1.05498" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </button>
        {showDropdown && connections.length > 1 && (
          <div className="absolute left-[30px] right-[30px] mt-1 bg-white rounded-[8px] shadow-lg py-1 z-50">
            {connections.map((conn) => (
              <button
                key={conn.id}
                onClick={() => {
                  setSelectedConnection(conn)
                  setShowDropdown(false)
                }}
                className="w-full px-3 py-2 text-right text-[#030733] hover:bg-[#F2F3F8] flex items-center gap-2 text-[14px]"
              >
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  conn.status === 'connected' ? "bg-[#187C55]" : "bg-gray-400"
                )} />
                <span>{conn.display_name || conn.session_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-[30px] h-[0.5px] bg-white/30 mb-4" />

      {/* Section Label */}
      <div className="px-[30px] mb-2">
        <span className="text-[#A8A8A8] text-[14px]">ניווט בפלטפורמה</span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-[30px] overflow-y-auto dark-scrollbar">
        {/* צאט */}
        <Link
          href="/chat"
          onClick={(e) => handleLinkClick(e, '/chat')}
          className={cn(
            "flex items-center gap-3 h-[47px] px-3 rounded-[8px] mb-1 hover:bg-white/5 transition-colors",
            pathname === '/chat' && "bg-[rgba(0,67,224,0.31)]"
          )}
        >
          <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14.875 10.9375C15.1166 10.9375 15.3125 10.7416 15.3125 10.5C15.3125 10.2584 15.1166 10.0625 14.875 10.0625C14.6334 10.0625 14.4375 10.2584 14.4375 10.5C14.4375 10.7416 14.6334 10.9375 14.875 10.9375Z" fill="white" stroke="white" strokeWidth="1.3125" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10.5 10.9375C10.7416 10.9375 10.9375 10.7416 10.9375 10.5C10.9375 10.2584 10.7416 10.0625 10.5 10.0625C10.2584 10.0625 10.0625 10.2584 10.0625 10.5C10.0625 10.7416 10.2584 10.9375 10.5 10.9375Z" fill="white" stroke="white" strokeWidth="1.3125" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6.125 10.9375C6.36662 10.9375 6.5625 10.7416 6.5625 10.5C6.5625 10.2584 6.36662 10.0625 6.125 10.0625C5.88338 10.0625 5.6875 10.2584 5.6875 10.5C5.6875 10.7416 5.88338 10.9375 6.125 10.9375Z" fill="white" stroke="white" strokeWidth="1.3125" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10.5 19.25C15.3324 19.25 19.25 15.3324 19.25 10.5C19.25 5.66751 15.3324 1.75 10.5 1.75C5.66751 1.75 1.75 5.66751 1.75 10.5C1.75 12.0937 2.1761 13.588 2.92059 14.875L2.1875 18.8125L6.125 18.0794C7.41201 18.8239 8.90627 19.25 10.5 19.25Z" stroke="white" strokeWidth="1.3125" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-white text-[18px]">צאט</span>
        </Link>

        {/* אנליטיקס */}
        <Link
          href="/analytics"
          onClick={(e) => handleLinkClick(e, '/analytics')}
          className={cn(
            "flex items-center gap-3 h-[47px] px-3 rounded-[8px] mb-1 hover:bg-white/5 transition-colors",
            pathname === '/analytics' && "bg-[rgba(0,67,224,0.31)]"
          )}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.7077 2.29102H7.29102C4.52959 2.29102 2.29102 4.52959 2.29102 7.29102V12.7077C2.29102 15.4691 4.52959 17.7077 7.29102 17.7077H12.7077C15.4691 17.7077 17.7077 15.4691 17.7077 12.7077V7.29102C17.7077 4.52959 15.4691 2.29102 12.7077 2.29102Z" stroke="white"/>
            <path d="M6.39258 13.5188V9.26953" stroke="white" strokeLinecap="round"/>
            <path d="M10.1035 13.5178V6.48047" stroke="white" strokeLinecap="round"/>
            <path d="M13.6074 13.5194V8.18359" stroke="white" strokeLinecap="round"/>
          </svg>
          <span className="text-white text-[18px]">אנליטיקס</span>
        </Link>

        {/* קמפיינים - ישר ליצירת קמפיין */}
        <Link
          href="/campaigns/new"
          onClick={(e) => handleLinkClick(e, '/campaigns/new')}
          className={cn(
            "flex items-center gap-3 h-[47px] px-3 rounded-[8px] mb-1 hover:bg-white/5 transition-colors",
            (pathname === '/campaigns/new' || pathname === '/campaigns') && "bg-[rgba(0,67,224,0.31)]"
          )}
        >
          <svg width="21" height="21" viewBox="0 0 27 27" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_campaigns)">
              <path d="M3.29192 12.8352C3.19803 12.8868 3.11986 12.9628 3.06569 13.0553C3.01152 13.1477 2.98338 13.2531 2.98424 13.3602C2.9851 13.4674 3.01494 13.5723 3.07058 13.6638C3.12623 13.7554 3.20561 13.8302 3.30032 13.8803L9.0869 16.944L13.8541 12.1769C13.9654 12.0655 14.1165 12.0029 14.2739 12.0029C14.4314 12.0029 14.5824 12.0655 14.6938 12.1769C14.8051 12.2882 14.8677 12.4392 14.8677 12.5967C14.8677 12.7542 14.8051 12.9052 14.6938 13.0165L9.92659 17.7837L12.9903 23.5703C13.0405 23.6649 13.1154 23.7441 13.2069 23.7996C13.2984 23.8551 13.4032 23.8848 13.5103 23.8856C13.6173 23.8864 13.7226 23.8582 13.8149 23.8041C13.9073 23.75 13.9833 23.6719 14.0349 23.5782C16.6611 18.7983 18.4518 13.6051 19.33 8.22247C19.3452 8.1295 19.3381 8.03424 19.3092 7.94456C19.2803 7.85489 19.2305 7.77338 19.1639 7.70676C19.0973 7.64014 19.0157 7.59033 18.9261 7.56145C18.8364 7.53256 18.7411 7.52543 18.6482 7.54065C13.2654 8.41856 8.07199 10.2091 3.29192 12.8352Z" fill="white"/>
            </g>
            <defs>
              <clipPath id="clip0_campaigns">
                <rect width="19" height="19" fill="white" transform="translate(0 13.4355) rotate(-45)"/>
              </clipPath>
            </defs>
          </svg>
          <span className="text-white text-[18px]">קמפיינים</span>
        </Link>

        {/* רשימת לקוחות */}
        <Link
          href="/lists"
          onClick={(e) => handleLinkClick(e, '/lists')}
          className={cn(
            "flex items-center gap-3 h-[47px] px-3 rounded-[8px] mb-1 hover:bg-white/5 transition-colors",
            pathname === '/lists' && "bg-[rgba(0,67,224,0.31)]"
          )}
        >
          <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.468 4.75C12.468 5.53736 12.1552 6.29247 11.5984 6.84922C11.0417 7.40597 10.2866 7.71875 9.49921 7.71875C8.71185 7.71875 7.95673 7.40597 7.39999 6.84922C6.84324 6.29247 6.53046 5.53736 6.53046 4.75C6.53046 3.96264 6.84324 3.20753 7.39999 2.65078C7.95673 2.09403 8.71185 1.78125 9.49921 1.78125C10.2866 1.78125 11.0417 2.09403 11.5984 2.65078C12.1552 3.20753 12.468 3.96264 12.468 4.75ZM3.5625 15.9267C3.58794 14.369 4.2246 12.8837 5.33518 11.7911C6.44576 10.6985 7.94128 10.0862 9.49921 10.0862C11.0571 10.0862 12.5527 10.6985 13.6632 11.7911C14.7738 12.8837 15.4105 14.369 15.4359 15.9267C13.5734 16.7808 11.5482 17.2215 9.49921 17.2187C7.38071 17.2187 5.36988 16.7564 3.5625 15.9267Z" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-white text-[18px]">רשימת לקוחות</span>
        </Link>

        {/* חיבורים */}
        <Link
          href="/connections"
          onClick={(e) => handleLinkClick(e, '/connections')}
          className={cn(
            "flex items-center gap-3 h-[47px] px-3 rounded-[8px] mb-1 hover:bg-white/5 transition-colors",
            pathname === '/connections' && "bg-[rgba(0,67,224,0.31)]"
          )}
        >
          <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14.1617 2.40625H6.83936C5.9659 2.40625 5.25781 3.13501 5.25781 4.034V16.966C5.25781 17.865 5.9659 18.5938 6.83936 18.5938H14.1617C15.0351 18.5938 15.7431 17.865 15.7431 16.966V4.034C15.7431 3.13501 15.0351 2.40625 14.1617 2.40625Z" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10.4993 16.4263C10.7503 16.4263 10.9537 16.2228 10.9537 15.9719C10.9537 15.721 10.7503 15.5176 10.4993 15.5176C10.2484 15.5176 10.0449 15.721 10.0449 15.9719C10.0449 16.2228 10.2484 16.4263 10.4993 16.4263Z" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.75195 4.61328H12.2471" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-white text-[18px]">חיבורים</span>
        </Link>

        {/* בוט - Coming Soon (disabled) */}
        <div className="flex items-center gap-3 h-[47px] px-3 rounded-[8px] mb-1 cursor-not-allowed opacity-50">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.255 3.59375H7.745C5.45232 3.59375 3.59375 5.45232 3.59375 7.745V12.255C3.59375 14.5477 5.45232 16.4062 7.745 16.4062H12.255C14.5477 16.4062 16.4062 14.5477 16.4062 12.255V7.745C16.4062 5.45232 14.5477 3.59375 12.255 3.59375Z" stroke="#A8A8A8"/>
            <path d="M16.3379 12.9889H17.6875C17.914 12.9889 18.1313 12.8989 18.2915 12.7388C18.4516 12.5786 18.5416 12.3613 18.5416 12.1348V7.86393C18.5416 7.63739 18.4516 7.42013 18.2915 7.25994C18.1313 7.09976 17.914 7.00977 17.6875 7.00977H16.3379" stroke="#A8A8A8"/>
            <path d="M3.66273 12.9889H2.31315C2.08661 12.9889 1.86935 12.8989 1.70917 12.7388C1.54898 12.5786 1.45898 12.3613 1.45898 12.1348V7.86393C1.45898 7.63739 1.54898 7.42013 1.70917 7.25994C1.86935 7.09976 2.08661 7.00977 2.31315 7.00977H3.66273" stroke="#A8A8A8"/>
            <path d="M2.30273 7.01042V3.59375" stroke="#A8A8A8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M17.6883 7.01042L17.6797 3.59375" stroke="#A8A8A8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.2832 12.9902H11.6998" stroke="#A8A8A8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6.56641 9.14517L7.42057 8.29102L8.27474 9.14517" stroke="#A8A8A8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11.6914 9.14517L12.5456 8.29102L13.3997 9.14517" stroke="#A8A8A8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="flex items-center gap-2">
            <span className="text-[#A8A8A8] text-[18px]">בוט</span>
            <span className="px-[7px] py-[1px] bg-white/10 rounded-[50px] text-[#D2D2D2] text-[11px]">בקרוב</span>
          </div>
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="px-[30px] pb-6">
        {/* Divider */}
        <div className="h-[0.5px] bg-white/30 mb-4" />

        {/* דארק מוד */}
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-3 h-[47px] px-3 rounded-[8px] w-full hover:bg-white/5 transition-colors"
        >
          <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M11.1563 17.6893C14.8355 17.3578 17.7188 14.2656 17.7188 10.5C17.7188 6.73444 14.8355 3.64228 11.1563 3.31065L11.1563 17.6893ZM19.0313 10.5C19.0313 15.2117 15.2117 19.0313 10.5 19.0313C5.7883 19.0313 1.96875 15.2117 1.96875 10.5C1.96875 5.7883 5.7883 1.96875 10.5 1.96875C15.2117 1.96875 19.0313 5.7883 19.0313 10.5Z" fill="white"/>
          </svg>
          <span className="text-white text-[18px]">דארק מוד</span>
        </button>

        {/* התראות */}
        <Link
          href="/notifications"
          onClick={(e) => handleLinkClick(e, '/notifications')}
          className={cn(
            "flex items-center gap-3 h-[47px] px-3 rounded-[8px] hover:bg-white/5 transition-colors",
            pathname === '/notifications' && "bg-[rgba(0,67,224,0.31)]"
          )}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.6191 15.6585C15.327 15.4563 17.0051 15.0532 18.6186 14.4577C17.2522 12.9441 16.4972 10.9766 16.5002 8.9375V8.25C16.5002 6.79131 15.9207 5.39236 14.8893 4.36091C13.8578 3.32946 12.4589 2.75 11.0002 2.75C9.5415 2.75 8.14256 3.32946 7.11111 4.36091C6.07966 5.39236 5.50019 6.79131 5.50019 8.25V8.9375C5.50296 10.9767 4.7476 12.9442 3.38086 14.4577C4.96944 15.0443 6.64419 15.4523 8.38128 15.6585M13.6191 15.6585C11.8793 15.8649 10.1211 15.8649 8.38128 15.6585M13.6191 15.6585C13.7512 16.0709 13.7841 16.5086 13.715 16.9361C13.6459 17.3635 13.4769 17.7687 13.2216 18.1184C12.9664 18.4682 12.6321 18.7528 12.2461 18.949C11.8601 19.1452 11.4332 19.2474 11.0002 19.2474C10.5672 19.2474 10.1403 19.1452 9.75427 18.949C9.36825 18.7528 9.03401 18.4682 8.77876 18.1184C8.52352 17.7687 8.35448 17.3635 8.28541 16.9361C8.21633 16.5086 8.24918 16.0709 8.38128 15.6585" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="flex items-center gap-2">
            <span className="text-white text-[18px]">התראות</span>
            {unreadCount > 0 && (
              <div className="w-[17px] h-[17px] bg-[#0043E0] rounded-full flex items-center justify-center">
                <span className="text-white text-[12px]">{unreadCount > 9 ? '9+' : unreadCount}</span>
              </div>
            )}
          </div>
        </Link>

        {/* מרכז משאבים */}
        <Link
          href="/resources"
          onClick={(e) => handleLinkClick(e, '/resources')}
          className={cn(
            "flex items-center gap-3 h-[47px] px-3 rounded-[8px] hover:bg-white/5 transition-colors",
            pathname === '/resources' && "bg-[rgba(0,67,224,0.31)]"
          )}
        >
          <svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8.5 2.57835C7.03477 1.23755 5.13502 0.497236 3.16667 0.500008C2.23156 0.500008 1.33378 0.663229 0.5 0.964281V13.8859C1.35655 13.5776 2.25837 13.4206 3.16667 13.4217C5.21556 13.4217 7.08489 14.2078 8.5 15.5M8.5 2.57835C9.96519 1.23747 11.865 0.49715 13.8333 0.500008C14.7684 0.500008 15.6662 0.663229 16.5 0.964281V13.8859C15.6434 13.5776 14.7416 13.4206 13.8333 13.4217C11.865 13.4189 9.96523 14.1592 8.5 15.5M8.5 2.57835V15.5" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-white text-[18px]">מרכז משאבים</span>
        </Link>

        {/* User Profile */}
        <div className="relative mt-2">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 h-[47px] px-3 rounded-[8px] w-full hover:bg-white/5 transition-colors"
          >
            <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.50065 1.58398C5.12839 1.58398 1.58398 5.12839 1.58398 9.50065C1.58398 13.8729 5.12839 17.4173 9.50065 17.4173C13.8729 17.4173 17.4173 13.8729 17.4173 9.50065C17.4173 5.12839 13.8729 1.58398 9.50065 1.58398Z" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.38086 14.5243C3.38086 14.5243 5.1455 12.2715 9.49965 12.2715C13.8538 12.2715 15.6185 14.5243 15.6185 14.5243" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.5 9.5C10.8117 9.5 11.875 8.43671 11.875 7.125C11.875 5.81333 10.8117 4.75 9.5 4.75C8.18829 4.75 7.125 5.81333 7.125 7.125C7.125 8.43671 8.18829 9.5 9.5 9.5Z" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-white text-[18px]">{userName}</span>
            <div className="flex flex-col gap-[3px] mr-auto">
              <div className="w-[3px] h-[3px] bg-[#E4E4E4] rounded-full" />
              <div className="w-[3px] h-[3px] bg-[#E4E4E4] rounded-full" />
              <div className="w-[3px] h-[3px] bg-[#E4E4E4] rounded-full" />
            </div>
          </button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-[8px] shadow-lg py-1 z-50">
              <Link
                href="/profile"
                className="flex items-center gap-2 px-3 py-2 text-[#030733] hover:bg-[#F2F3F8] text-[14px]"
                onClick={(e) => { setShowUserMenu(false); handleLinkClick(e, '/profile'); }}
              >
                <svg width="16" height="16" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9.50065 1.58398C5.12839 1.58398 1.58398 5.12839 1.58398 9.50065C1.58398 13.8729 5.12839 17.4173 9.50065 17.4173C13.8729 17.4173 17.4173 13.8729 17.4173 9.50065C17.4173 5.12839 13.8729 1.58398 9.50065 1.58398Z" stroke="#030733" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3.38086 14.5243C3.38086 14.5243 5.1455 12.2715 9.49965 12.2715C13.8538 12.2715 15.6185 14.5243 15.6185 14.5243" stroke="#030733" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9.5 9.5C10.8117 9.5 11.875 8.43671 11.875 7.125C11.875 5.81333 10.8117 4.75 9.5 4.75C8.18829 4.75 7.125 5.81333 7.125 7.125C7.125 8.43671 8.18829 9.5 9.5 9.5Z" stroke="#030733" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>הפרופיל שלי</span>
              </Link>
              <button
                onClick={() => setShowSupportModal(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[#030733] hover:bg-[#F2F3F8] text-[14px]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#030733" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span>תמיכה</span>
              </button>
              <hr className="my-1 border-[#F2F3F8]" />
              <button
                onClick={() => { setShowUserMenu(false); setShowLogoutModal(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[#CD1B1B] hover:bg-red-50 text-[14px]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CD1B1B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>התנתק</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Support Modal */}
      <SupportModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        title="אתה בטוח שאתה רוצה להתנתק?"
        subtitle="תצטרך להזין מחדש את פרטי ההתחברות"
        confirmText="כן אני בטוח"
        cancelText="לא, תחזור אחורה"
        variant="danger"
      />

      {/* Navigation Guard Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmDialog}
        onClose={cancelNavigation}
        onConfirm={confirmNavigation}
        title="יש נתונים שלא נשמרו"
        subtitle="אם תעזוב את הדף הנתונים שהזנת יאבדו. האם להמשיך?"
        confirmText="כן, עזוב"
        cancelText="לא, הישאר"
        variant="danger"
      />
    </aside>
  )
}
