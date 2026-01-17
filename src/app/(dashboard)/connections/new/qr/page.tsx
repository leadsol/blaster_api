'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { ChevronLeft, Loader2, RefreshCw, X, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

export default function QRConnectionPage() {
  const router = useRouter()
  const { darkMode } = useTheme()
  const [step, setStep] = useState<'checking' | 'loading' | 'qr' | 'success'>('checking')
  const [qrCode, setQrCode] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [connectionId, setConnectionId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showExitModal, setShowExitModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showPendingSessionModal, setShowPendingSessionModal] = useState(false)
  const hasCheckedRef = useRef(false)

  // Check for pending sessions on mount - use ref to prevent double execution in React Strict Mode
  useEffect(() => {
    if (hasCheckedRef.current) return
    hasCheckedRef.current = true
    checkPendingSessions()
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
        // Show modal that prevents creating new connection
        setShowPendingSessionModal(true)
      } else {
        // No pending sessions, proceed with creating connection
        setStep('loading')
        createConnection()
      }
    } catch (error) {
      console.error('Error checking pending sessions:', error)
      // On error, proceed anyway
      setStep('loading')
      createConnection()
    }
  }

  // Listen for connection status changes
  useEffect(() => {
    if (!connectionId) return

    const supabase = createClient()
    const channel = supabase
      .channel('qr-connection-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'connections',
          filter: `id=eq.${connectionId}`
        },
        (payload) => {
          const updated = payload.new as { status: string }
          if (updated.status === 'connected') {
            setStep('success')
          } else if (updated.status === 'disconnected' && step === 'qr') {
            setShowErrorModal(true)
            setErrorMessage('החיבור נכשל. נסה שוב.')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [connectionId, step])

  const fetchQRCode = async (session: string, retries = 5): Promise<boolean> => {
    try {
      const response = await fetch(`/api/waha/sessions/${session}/qr`)
      const data = await response.json()

      if (response.ok && data.qr) {
        setQrCode(data.qr)
        return true
      }

      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        return fetchQRCode(session, retries - 1)
      }

      return false
    } catch (error) {
      console.error('Error fetching QR code:', error)
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        return fetchQRCode(session, retries - 1)
      }
      return false
    }
  }

  const refreshQR = async () => {
    if (!sessionName) return
    setQrCode('')
    await fetchQRCode(sessionName)
  }

  const createConnection = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const wahaSessionName = await getNextSessionName()
      setSessionName(wahaSessionName)

      // Create session in WAHA
      const wahaResponse = await fetch('/api/waha/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: wahaSessionName }),
      })

      if (!wahaResponse.ok) {
        const wahaData = await wahaResponse.json()
        throw new Error(`Failed to create WAHA session: ${JSON.stringify(wahaData)}`)
      }

      // Save to database without display name (will be set after connection)
      const { data, error } = await supabase.from('connections').insert({
        user_id: user.id,
        session_name: wahaSessionName,
        status: 'qr_pending',
      }).select().single()

      if (error) throw error

      setConnectionId(data.id)

      // Fetch QR code
      const qrSuccess = await fetchQRCode(wahaSessionName)
      if (qrSuccess) {
        setStep('qr')
      } else {
        setShowErrorModal(true)
        setErrorMessage('לא הצלחנו לקבל קוד QR. נסה שוב.')
      }
    } catch (error: any) {
      console.error('Error creating connection:', error)
      setShowErrorModal(true)
      setErrorMessage(error?.message || 'שגיאה ביצירת החיבור')
    }
  }

  const deleteConnectionAndExit = async () => {
    setDeleting(true)
    try {
      // Delete from WAHA first
      if (sessionName) {
        console.log(`Deleting WAHA session: ${sessionName}`)
        const wahaResponse = await fetch(`/api/waha/sessions/${sessionName}`, {
          method: 'DELETE',
        })
        const wahaResult = await wahaResponse.json()
        console.log(`WAHA delete response:`, wahaResponse.status, wahaResult)
      }

      // Delete from database
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
      // Still navigate even if delete fails
      router.push('/connections/new')
    } finally {
      setDeleting(false)
    }
  }

  const handleBackClick = () => {
    // If we have a connection in progress, show confirmation
    if (connectionId && step !== 'success') {
      setShowExitModal(true)
    } else {
      router.push('/connections/new')
    }
  }

  const saveDisplayName = async () => {
    if (!displayName.trim() || !connectionId) return
    setSavingName(true)

    try {
      const supabase = createClient()
      await supabase.from('connections').update({
        display_name: displayName.trim()
      }).eq('id', connectionId)

      // Also update WAHA metadata
      try {
        await fetch(`/api/waha/sessions/${sessionName}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: displayName.trim() }),
        })
      } catch (e) {
        console.warn('Failed to update WAHA metadata:', e)
      }

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
        {step !== 'success' && (
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={handleBackClick}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-[#1a2942]' : 'hover:bg-white'}`}
            >
              <ChevronLeft className={`w-6 h-6 rotate-180 ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
            </button>
            <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              סריקת QR קוד
            </h1>
          </div>
        )}

        {/* Step: Checking for pending sessions */}
        {step === 'checking' && (
          <div className={`rounded-[15px] p-8 ${darkMode ? 'bg-[#1a2942]' : 'bg-white'} max-w-[503px] mx-auto flex flex-col items-center justify-center min-h-[400px]`}>
            <Loader2 className={`w-16 h-16 animate-spin ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
            <p className={`mt-4 text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              בודק חיבורים קיימים...
            </p>
          </div>
        )}

        {/* Step: Loading */}
        {step === 'loading' && (
          <div className={`rounded-[15px] p-8 ${darkMode ? 'bg-[#1a2942]' : 'bg-white'} max-w-[503px] mx-auto flex flex-col items-center justify-center min-h-[400px]`}>
            <Loader2 className={`w-16 h-16 animate-spin ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
            <p className={`mt-4 text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              מכין את הקוד...
            </p>
          </div>
        )}

        {/* Step: Show QR */}
        {step === 'qr' && (
          <div className={`rounded-[15px] p-8 ${darkMode ? 'bg-[#1a2942]' : 'bg-white'} max-w-[503px] mx-auto`}>
            {/* QR Icon */}
            <div className="flex justify-center mb-8">
              <div className="w-[49px] h-[49px] bg-[#030733] rounded-[8.91px] flex items-center justify-center">
                <svg width="27" height="27" viewBox="0 0 27 27" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4.17578 5.42862C4.17578 4.73705 4.73705 4.17578 5.42862 4.17578H10.44C11.1316 4.17578 11.6928 4.73705 11.6928 5.42862V10.44C11.6928 11.1316 11.1316 11.6928 10.44 11.6928H5.42862C5.09635 11.6928 4.77768 11.5608 4.54273 11.3259C4.30778 11.0909 4.17578 10.7723 4.17578 10.44V5.42862ZM4.17578 16.2866C4.17578 15.595 4.73705 15.0337 5.42862 15.0337H10.44C11.1316 15.0337 11.6928 15.595 11.6928 16.2866V21.2979C11.6928 21.9895 11.1316 22.5508 10.44 22.5508H5.42862C5.09635 22.5508 4.77768 22.4188 4.54273 22.1838C4.30778 21.9489 4.17578 21.6302 4.17578 21.2979V16.2866ZM15.0337 5.42862C15.0337 4.73705 15.595 4.17578 16.2866 4.17578H21.2979C21.9895 4.17578 22.5508 4.73705 22.5508 5.42862V10.44C22.5508 11.1316 21.9895 11.6928 21.2979 11.6928H16.2866C15.9543 11.6928 15.6356 11.5608 15.4007 11.3259C15.1657 11.0909 15.0337 10.7723 15.0337 10.44V5.42862Z" stroke="white" strokeWidth="1.67045" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7.51562 7.51758H8.35085V8.35281H7.51562V7.51758ZM7.51562 18.3755H8.35085V19.2108H7.51562V18.3755ZM18.3736 7.51758H19.2088V8.35281H18.3736V7.51758ZM15.0327 15.0346H15.8679V15.8699H15.0327V15.0346ZM15.0327 21.7164H15.8679V22.5517H15.0327V21.7164ZM21.7145 15.0346H22.5497V15.8699H21.7145V15.0346ZM21.7145 21.7164H22.5497V22.5517H21.7145V21.7164ZM18.3736 18.3755H19.2088V19.2108H18.3736V18.3755Z" stroke="white" strokeWidth="1.67045" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className={`text-[26px] font-semibold text-center mb-6 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              סרוק את הקוד
            </h2>

            {/* QR Code Display */}
            <div className="flex justify-center mb-8">
              {qrCode ? (
                <div className="bg-white p-4 rounded-xl shadow-lg">
                  <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                </div>
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-white rounded-xl">
                  <Loader2 className="w-12 h-12 animate-spin text-[#030733]" />
                </div>
              )}
            </div>

            {/* Description */}
            <p className={`text-[16px] text-center mb-8 ${darkMode ? 'text-gray-400' : 'text-[#030733]'}`}>
              פתח את WhatsApp בטלפון שלך ועבור ל-"מכשירים מקושרים" וסרוק את הקוד
            </p>

            {/* Refresh Button */}
            <button
              onClick={refreshQR}
              className={`w-full py-3 border rounded-lg font-semibold transition-colors flex items-center justify-center gap-2
                ${darkMode
                  ? 'border-[#2a3f5f] text-white hover:bg-[#0d1a2d]'
                  : 'border-gray-200 text-[#030733] hover:bg-gray-50'
                }`}
            >
              <RefreshCw className="w-5 h-5" />
              רענן קוד QR
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
            {/* Header */}
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

            {/* Content */}
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

            {/* Actions */}
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
                onClick={() => {
                  setShowErrorModal(false)
                  refreshQR()
                }}
                className="flex-1 py-3 bg-[#030733] text-white font-semibold rounded-lg hover:bg-[#1a1a4a] transition-colors"
              >
                רענן קוד
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-[#1a2942]' : 'bg-white'} rounded-xl w-full max-w-md overflow-hidden`} dir="rtl">
            {/* Header */}
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

            {/* Content */}
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

            {/* Actions */}
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
            {/* Header */}
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

            {/* Content */}
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

            {/* Actions */}
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
