'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { ChevronLeft, Loader2, Copy, CheckCircle, X, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Convert Israeli phone number to international format
const formatIsraeliPhone = (phone: string): string => {
  let cleaned = phone.replace(/[^0-9]/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = '972' + cleaned.substring(1)
  } else if (!cleaned.startsWith('972') && cleaned.length === 9) {
    cleaned = '972' + cleaned
  }
  return cleaned
}

// Get next session number from global counter (LEADSOL1, LEADSOL2, etc.)
const getNextSessionName = async (): Promise<string> => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_next_session_number')

  if (error) {
    console.error('Error getting next session number:', error)
    return `LEADSOL_${Date.now()}`
  }

  return `LEADSOL${data}`
}

function CodeConnectionPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { darkMode } = useTheme()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [step, setStep] = useState<'checking' | 'phone' | 'loading' | 'code' | 'success'>('checking')
  const [linkCode, setLinkCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [connectionId, setConnectionId] = useState('')
  const [copied, setCopied] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showExitModal, setShowExitModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showPendingSessionModal, setShowPendingSessionModal] = useState(false)
  const [isExistingSession, setIsExistingSession] = useState(false)
  const hasCheckedRef = useRef(false)

  // Check for existing session from query params or pending sessions on mount
  useEffect(() => {
    if (hasCheckedRef.current) return
    hasCheckedRef.current = true

    // Check if we're reconnecting an existing session
    const existingSession = searchParams.get('session')
    const existingConnectionId = searchParams.get('connectionId')

    if (existingSession && existingConnectionId) {
      // Use existing session
      setIsExistingSession(true)
      setSessionName(existingSession)
      setConnectionId(existingConnectionId)
      loadExistingSession(existingConnectionId)
    } else {
      // New session - check for pending
      checkPendingSessions()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkPendingSessions = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Check if there are any non-connected sessions (qr_pending, disconnected, connecting)
      // Only 'connected' status means the session is working and scanned
      const { data: nonConnectedSessions } = await supabase
        .from('connections')
        .select('id')
        .eq('user_id', user.id)
        .neq('status', 'connected')

      if (nonConnectedSessions && nonConnectedSessions.length > 0) {
        setShowPendingSessionModal(true)
      } else {
        setStep('phone')
      }
    } catch (error) {
      console.error('Error checking pending sessions:', error)
      setStep('phone')
    }
  }

  // Load existing session - go directly to phone input
  const loadExistingSession = async (connId: string) => {
    try {
      const supabase = createClient()
      const { data: connection } = await supabase
        .from('connections')
        .select('display_name, status')
        .eq('id', connId)
        .single()

      if (connection?.display_name) {
        setDisplayName(connection.display_name)
      }

      // If already connected, go to success
      if (connection?.status === 'connected') {
        setStep('success')
        return
      }

      // Go to phone input step
      setStep('phone')
    } catch (error) {
      console.error('Error loading existing session:', error)
      setStep('phone')
    }
  }

  // Warn user before leaving page during code verification
  useEffect(() => {
    // Only show warning when we have an active session/connection and not yet connected
    if ((!sessionName && !connectionId) || step === 'success' || step === 'checking' || step === 'phone' || isExistingSession) {
      return
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'אם תצא מדף זה החיבור יימחק'
      return 'אם תצא מדף זה החיבור יימחק'
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [sessionName, connectionId, step, isExistingSession])

  // Listen for connection status changes via Supabase Realtime
  useEffect(() => {
    if (!connectionId) return

    console.log('Setting up realtime subscription for connection:', connectionId)
    const supabase = createClient()

    const channel = supabase
      .channel(`connection-${connectionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'connections',
          filter: `id=eq.${connectionId}`
        },
        (payload) => {
          console.log('Realtime update received:', payload)
          const updated = payload.new as { status: string }
          if (updated.status === 'connected') {
            setStep('success')
          } else if (updated.status === 'disconnected' && step === 'code') {
            setShowErrorModal(true)
            setErrorMessage('החיבור נכשל. נסה שוב.')
          }
        }
      )
      .subscribe((status, err) => {
        console.log('Realtime subscription status:', status, err)
      })

    return () => {
      console.log('Cleaning up realtime subscription')
      supabase.removeChannel(channel)
    }
  }, [connectionId, step])

  const fetchLinkCode = async (session: string, retries = 8): Promise<boolean> => {
    try {
      // Wait for session to be ready
      if (retries === 8) {
        console.log('Waiting for session to be ready...')
        await new Promise(resolve => setTimeout(resolve, 3000))

        const statusResponse = await fetch(`/api/waha/sessions/${session}/status`)
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          console.log('Session status:', statusData.status)
          if (statusData.status !== 'SCAN_QR_CODE' && statusData.status !== 'WORKING') {
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      }

      const cleanPhone = formatIsraeliPhone(phoneNumber)
      console.log(`Requesting code for phone: ${cleanPhone}`)

      const response = await fetch(`/api/waha/sessions/${session}/auth/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: cleanPhone }),
      })

      const data = await response.json()
      console.log('Request code response:', data)

      if (response.ok && data.code) {
        setLinkCode(data.code)
        return true
      }

      if (retries > 0) {
        console.log(`Code not ready, retrying in 3 seconds... (${retries} retries left)`)
        await new Promise(resolve => setTimeout(resolve, 3000))
        return fetchLinkCode(session, retries - 1)
      }

      console.log('Failed to get link code after retries:', data)
      setErrorMessage('לא הצלחנו לקבל קוד מ-WhatsApp. נסה שוב.')
      return false
    } catch (error) {
      console.log('Error fetching link code:', error)
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        return fetchLinkCode(session, retries - 1)
      }
      setErrorMessage('אירעה שגיאה בתקשורת עם השרת. נסה שוב.')
      return false
    }
  }

  const createConnection = async () => {
    if (!phoneNumber.trim()) return
    setLoading(true)
    setStep('loading')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      let wahaSessionName = sessionName
      let connId = connectionId

      // If this is a new session (not existing), create it
      if (!isExistingSession) {
        wahaSessionName = await getNextSessionName()
        setSessionName(wahaSessionName)

        // Create session in WAHA
        const wahaResponse = await fetch('/api/waha/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: wahaSessionName }),
        })

        if (!wahaResponse.ok) {
          console.log('Failed to create WAHA session')
          setErrorMessage('לא הצלחנו ליצור חיבור. נסה שוב.')
          setStep('phone')
          setShowErrorModal(true)
          setLoading(false)
          return
        }

        // Save to database without display name
        const { data, error } = await supabase.from('connections').insert({
          user_id: user.id,
          session_name: wahaSessionName,
          status: 'qr_pending',
        }).select().single()

        if (error) throw error

        connId = data.id
        setConnectionId(connId)
      }

      // Fetch link code (for both new and existing sessions)
      const codeSuccess = await fetchLinkCode(wahaSessionName)
      if (codeSuccess) {
        setStep('code')
      } else {
        setStep('phone')
        setShowErrorModal(true)
      }
    } catch (error: any) {
      console.log('Error creating connection:', error)
      setStep('phone')
      setErrorMessage('שגיאה ביצירת החיבור. נסה שוב.')
      setShowErrorModal(true)
    } finally {
      setLoading(false)
    }
  }

  const deleteConnectionAndExit = async () => {
    setDeleting(true)
    try {
      // Delete from WAHA first - always try if we have a session name
      if (sessionName) {
        console.log(`Deleting WAHA session: ${sessionName}`)
        try {
          const wahaResponse = await fetch(`/api/waha/sessions/${sessionName}`, {
            method: 'DELETE',
          })
          const wahaResult = await wahaResponse.json()
          console.log(`WAHA delete response:`, wahaResponse.status, wahaResult)
        } catch (wahaError) {
          console.error('WAHA delete error:', wahaError)
          // Continue even if WAHA delete fails
        }
      }

      // Delete from database if we have a connection ID
      if (connectionId) {
        console.log(`Deleting connection from DB: ${connectionId}`)
        const supabase = createClient()
        const { error } = await supabase.from('connections').delete().eq('id', connectionId)
        if (error) {
          console.error('DB delete error:', error)
        } else {
          console.log('DB delete successful')
        }
      }

      router.push('/connections/new')
    } catch (error) {
      console.error('Error deleting connection:', error)
      router.push('/connections/new')
    } finally {
      setDeleting(false)
    }
  }

  const handleBackClick = () => {
    // If this is an existing session, just go back without confirmation
    if (isExistingSession) {
      router.push('/connections')
      return
    }
    // If we have a session or connection in progress (and not yet connected), show confirmation
    if ((sessionName || connectionId) && step !== 'success') {
      setShowExitModal(true)
    } else {
      router.push('/connections/new')
    }
  }

  const retryConnection = async () => {
    setShowErrorModal(false)
    if (sessionName) {
      setStep('loading')
      setLoading(true)
      const codeSuccess = await fetchLinkCode(sessionName)
      if (codeSuccess) {
        setStep('code')
      } else {
        setStep('phone')
        setShowErrorModal(true)
      }
      setLoading(false)
    } else {
      createConnection()
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(linkCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatCode = (code: string) => {
    if (code.length === 8) {
      return `${code.slice(0, 4)}-${code.slice(4)}`
    }
    return code
  }

  const saveDisplayName = async () => {
    if (!displayName.trim() || !connectionId) return
    setSavingName(true)

    try {
      const supabase = createClient()
      await supabase.from('connections').update({
        display_name: displayName.trim()
      }).eq('id', connectionId)

      // Note: We no longer update WAHA metadata for new connections
      // as it causes session restarts. Display name is stored only in our database.

      router.push('/connections')
    } catch (error) {
      console.error('Error saving display name:', error)
    } finally {
      setSavingName(false)
    }
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#0a1628]' : 'bg-[#F2F3F8]'}`} dir="rtl">
      <div className="w-full max-w-2xl mx-auto px-6 py-8">
        {/* Header - only show when not in success state */}
        {step !== 'success' && step !== 'checking' && (
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={handleBackClick}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-[#1a2942]' : 'hover:bg-white'}`}
            >
              <ChevronLeft className={`w-6 h-6 rotate-180 ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
            </button>
            <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              חיבור באמצעות קוד אימות
            </h1>
          </div>
        )}

        {/* Step: Checking */}
        {step === 'checking' && (
          <div className={`rounded-[15px] p-8 ${darkMode ? 'bg-[#1a2942]' : 'bg-white'} max-w-[503px] mx-auto flex flex-col items-center justify-center min-h-[400px]`}>
            <Loader2 className={`w-16 h-16 animate-spin ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
            <p className={`mt-4 text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              בודק חיבורים קיימים...
            </p>
          </div>
        )}

        {/* Step: Enter Phone */}
        {step === 'phone' && (
          <div className={`rounded-[15px] p-8 ${darkMode ? 'bg-[#1a2942]' : 'bg-white'} max-w-[503px] mx-auto`}>
            {/* Lock Icon */}
            <div className="flex justify-center mb-8">
              <div className="w-[49px] h-[49px] bg-[#030733] rounded-[8.91px] flex items-center justify-center">
                <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.1875 10.9375V7.03125C17.1875 5.78805 16.6936 4.59576 15.8146 3.71669C14.9355 2.83761 13.7432 2.34375 12.5 2.34375C11.2568 2.34375 10.0645 2.83761 9.18544 3.71669C8.30636 4.59576 7.8125 5.78805 7.8125 7.03125V10.9375M7.03125 22.6562H17.9687C18.5904 22.6562 19.1865 22.4093 19.626 21.9698C20.0656 21.5302 20.3125 20.9341 20.3125 20.3125V13.2812C20.3125 12.6596 20.0656 12.0635 19.626 11.624C19.1865 11.1844 18.5904 10.9375 17.9687 10.9375H7.03125C6.40965 10.9375 5.81351 11.1844 5.37397 11.624C4.93443 12.0635 4.6875 12.6596 4.6875 13.2812V20.3125C4.6875 20.9341 4.93443 21.5302 5.37397 21.9698C5.81351 22.4093 6.40965 22.6562 7.03125 22.6562Z" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            <h2 className={`text-[26px] font-semibold text-center mb-2 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              הזן מספר טלפון
            </h2>
            <p className={`text-[16px] text-center mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              מספר הטלפון של WhatsApp שתרצה לחבר
            </p>

            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="05XXXXXXXX"
              className={`w-full h-[60px] px-4 rounded-[10px] text-[18px] mb-6 ${
                darkMode
                  ? 'bg-[#0d1a2d] text-white placeholder-gray-500'
                  : 'bg-gray-50 text-[#030733] placeholder-[#A2A2A2]'
              } border ${darkMode ? 'border-[#2a3f5f]' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-[#030733]`}
              dir="ltr"
            />

            <button
              onClick={createConnection}
              disabled={!phoneNumber.trim() || loading}
              className={`w-full h-[60px] bg-[#030733] text-white text-[18px] font-semibold rounded-[10px] transition-colors
                ${!phoneNumber.trim() || loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#1a1a4a]'}`}
            >
              קבל קוד אימות
            </button>
          </div>
        )}

        {/* Step: Loading */}
        {step === 'loading' && (
          <div className={`rounded-[15px] p-8 ${darkMode ? 'bg-[#1a2942]' : 'bg-white'} max-w-[503px] mx-auto flex flex-col items-center justify-center min-h-[400px]`}>
            <Loader2 className={`w-16 h-16 animate-spin ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
            <p className={`mt-4 text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              מקבל קוד אימות...
            </p>
          </div>
        )}

        {/* Step: Show Code */}
        {step === 'code' && (
          <div className={`rounded-[15px] p-8 ${darkMode ? 'bg-[#1a2942]' : 'bg-white'} max-w-[503px] mx-auto`}>
            {/* Lock Icon */}
            <div className="flex justify-center mb-8">
              <div className="w-[49px] h-[49px] bg-[#030733] rounded-[8.91px] flex items-center justify-center">
                <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.1875 10.9375V7.03125C17.1875 5.78805 16.6936 4.59576 15.8146 3.71669C14.9355 2.83761 13.7432 2.34375 12.5 2.34375C11.2568 2.34375 10.0645 2.83761 9.18544 3.71669C8.30636 4.59576 7.8125 5.78805 7.8125 7.03125V10.9375M7.03125 22.6562H17.9687C18.5904 22.6562 19.1865 22.4093 19.626 21.9698C20.0656 21.5302 20.3125 20.9341 20.3125 20.3125V13.2812C20.3125 12.6596 20.0656 12.0635 19.626 11.624C19.1865 11.1844 18.5904 10.9375 17.9687 10.9375H7.03125C6.40965 10.9375 5.81351 11.1844 5.37397 11.624C4.93443 12.0635 4.6875 12.6596 4.6875 13.2812V20.3125C4.6875 20.9341 4.93443 21.5302 5.37397 21.9698C5.81351 22.4093 6.40965 22.6562 7.03125 22.6562Z" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className={`text-[26px] font-semibold text-center mb-6 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              שליחת הקוד לצד השני
            </h2>

            {/* Large Code Display */}
            <div className="flex justify-center mb-8">
              <p className={`text-[65px] font-semibold tracking-wide ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                {formatCode(linkCode)}
              </p>
            </div>

            {/* Description */}
            <p className={`text-[16px] text-center mb-4 ${darkMode ? 'text-gray-400' : 'text-[#030733]'}`}>
              שלח את הקוד למי שמחזיק בטלפון אותו תרצה לחבר
            </p>

            {/* Warning message */}
            <p className={`text-[14px] text-center mb-8 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
              * אם הכנסת את קוד האימות, המתן עד לחיבור מלא ואל תצא מדף זה
            </p>

            {/* Copy Button */}
            <button
              onClick={copyCode}
              className="w-full py-3 bg-[#030733] text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 hover:bg-[#1a1a4a]"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  הועתק!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  העתק קוד
                </>
              )}
            </button>
          </div>
        )}

        {/* Step: Success - Name Input */}
        {step === 'success' && (
          <div className="flex items-center justify-center min-h-[80vh]">
            <div className={`rounded-[25px] p-8 w-full max-w-[600px] ${darkMode ? 'bg-[#1a2942]' : 'bg-[#F2F3F8]'}`}>
              {/* Title */}
              <h2 className={`text-[32px] font-semibold text-center mb-4 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                הטלפון חובר ואומת בהצלחה!
              </h2>

              {/* Subtitle */}
              <p className={`text-[18px] text-center mb-8 ${darkMode ? 'text-gray-400' : 'text-[#454545]'}`}>
                רק דבר אחרון, איך תרצה לקרוא לחיבור הזה?
              </p>

              {/* Input */}
              <div className="mb-4">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="דוגמא: טלפון שירות לקוחות חנות איקומרס 'שם החנות'"
                  className={`w-full h-[60px] px-4 rounded-[10px] text-[18px] ${
                    darkMode
                      ? 'bg-[#0d1a2d] text-white placeholder-gray-500'
                      : 'bg-white text-[#030733] placeholder-[#A2A2A2]'
                  } focus:outline-none focus:ring-2 focus:ring-[#030733]`}
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={saveDisplayName}
                disabled={!displayName.trim() || savingName}
                className={`w-full h-[60px] bg-[#030733] text-white text-[18px] font-semibold rounded-[10px] transition-colors
                  ${!displayName.trim() || savingName ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#1a1a4a]'}`}
              >
                {savingName ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    שומר...
                  </span>
                ) : (
                  'סיימתי'
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-[#1a2942]' : 'bg-white'} rounded-xl w-full max-w-md overflow-hidden`} dir="rtl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200/20">
              <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                החיבור נכשל
              </h3>
              <button
                onClick={() => setShowErrorModal(false)}
                className={`p-1 rounded-lg ${darkMode ? 'hover:bg-[#0d1a2d]' : 'hover:bg-gray-100'}`}
              >
                <X className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>

            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-white" />
              </div>
              <p className={`text-lg mb-2 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                {errorMessage || 'החיבור נכשל'}
              </p>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                נסה שוב או רענן את הקוד
              </p>
            </div>

            <div className="p-4 flex gap-3">
              <button
                onClick={() => setShowErrorModal(false)}
                className={`flex-1 py-3 border rounded-lg font-semibold transition-colors
                  ${darkMode
                    ? 'border-[#2a3f5f] text-white hover:bg-[#0d1a2d]'
                    : 'border-gray-200 text-[#030733] hover:bg-gray-50'
                  }`}
              >
                סגור
              </button>
              <button
                onClick={retryConnection}
                className="flex-1 py-3 bg-[#030733] text-white font-semibold rounded-lg hover:bg-[#1a1a4a] transition-colors"
              >
                נסה שוב
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-[#1a2942]' : 'bg-white'} rounded-xl w-full max-w-md overflow-hidden`} dir="rtl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200/20">
              <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                לצאת מהחיבור?
              </h3>
              <button
                onClick={() => setShowExitModal(false)}
                className={`p-1 rounded-lg ${darkMode ? 'hover:bg-[#0d1a2d]' : 'hover:bg-gray-100'}`}
              >
                <X className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>

            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <p className={`text-lg mb-2 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                אם תצא עכשיו, החיבור יימחק
              </p>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                האם אתה בטוח שברצונך לצאת?
              </p>
            </div>

            <div className="p-4 flex gap-3">
              <button
                onClick={() => setShowExitModal(false)}
                className={`flex-1 py-3 border rounded-lg font-semibold transition-colors
                  ${darkMode
                    ? 'border-[#2a3f5f] text-white hover:bg-[#0d1a2d]'
                    : 'border-gray-200 text-[#030733] hover:bg-gray-50'
                  }`}
              >
                המשך לחבר
              </button>
              <button
                onClick={deleteConnectionAndExit}
                disabled={deleting}
                className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors"
              >
                {deleting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    מוחק...
                  </span>
                ) : (
                  'צא ומחק'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Session Modal */}
      {showPendingSessionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-[#1a2942]' : 'bg-white'} rounded-xl w-full max-w-md overflow-hidden`} dir="rtl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200/20">
              <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                לא ניתן ליצור חיבור חדש
              </h3>
              <button
                onClick={() => router.push('/connections/new')}
                className={`p-1 rounded-lg ${darkMode ? 'hover:bg-[#0d1a2d]' : 'hover:bg-gray-100'}`}
              >
                <X className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>

            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <p className={`text-lg mb-2 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                יש לך כבר חיבור שלא מחובר
              </p>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                אפשר ליצור רק חיבור אחד בכל פעם. חבר את החיבור הקיים או מחק אותו כדי ליצור חדש.
              </p>
            </div>

            <div className="p-4">
              <button
                onClick={() => router.push('/connections')}
                className="w-full py-3 bg-[#030733] text-white font-semibold rounded-lg hover:bg-[#1a1a4a] transition-colors"
              >
                חזור לחיבורים
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CodeConnectionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F2F3F8] flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin text-[#030733]" />
      </div>
    }>
      <CodeConnectionPageContent />
    </Suspense>
  )
}
