'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { ChevronLeft, Loader2, X, RefreshCw, Copy, CheckCircle, Download, AlertTriangle } from 'lucide-react'
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

export default function SendQRConnectionPage() {
  const router = useRouter()
  const { darkMode } = useTheme()
  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [step, setStep] = useState<'checking' | 'loading' | 'qr' | 'success' | 'error'>('checking')
  const [qrCode, setQrCode] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [connectionId, setConnectionId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [copied, setCopied] = useState(false)
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
          } else if (updated.status === 'disconnected' && step === 'qr') {
            setStep('error')
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
        setStep('error')
        setErrorMessage('לא הצלחנו לקבל קוד QR. נסה שוב.')
      }
    } catch (error: any) {
      console.error('Error creating connection:', error)
      setStep('error')
      setErrorMessage(error?.message || 'שגיאה ביצירת החיבור')
    }
  }

  const copyQRImage = async () => {
    if (!qrCode) return

    try {
      // Convert base64 to blob
      const response = await fetch(qrCode)
      const blob = await response.blob()

      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ])

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Error copying QR:', error)
      // Fallback: try copying as text/image
      try {
        const img = document.createElement('img')
        img.src = qrCode
        document.body.appendChild(img)
        const range = document.createRange()
        range.selectNode(img)
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
        document.execCommand('copy')
        window.getSelection()?.removeAllRanges()
        document.body.removeChild(img)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError)
        alert('לא הצלחנו להעתיק את הקוד. נסה להוריד אותו במקום.')
      }
    }
  }

  const downloadQR = () => {
    if (!qrCode) return

    const link = document.createElement('a')
    link.href = qrCode
    link.download = `whatsapp-qr-connection.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
    <div className={`min-h-screen ${darkMode ? 'bg-[#0a1628]' : 'bg-[#e8f4fc]'}`} dir="rtl">
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
              שליחת QR לטלפון אחר
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

        {/* Step: Show QR with Copy/Download options - Full page design */}
        {step === 'qr' && (
          <div className={`rounded-[15px] p-8 ${darkMode ? 'bg-[#1a2942]' : 'bg-white'} max-w-[503px] mx-auto`}>
            {/* Send Icon */}
            <div className="flex justify-center mb-8">
              <div className="w-[49px] h-[49px] bg-[#030733] rounded-[8.91px] flex items-center justify-center">
                <svg width="27" height="27" viewBox="0 0 27 27" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24.9215 3.99805L12.5743 23.6306L10.6952 13.9595L2.25 8.88588L24.9215 3.99805Z" stroke="white" strokeWidth="1.6875" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10.6367 13.9997L24.9207 3.99805" stroke="white" strokeWidth="1.6875" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className={`text-[26px] font-semibold text-center mb-6 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              שליחת הקוד לצד השני
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
              שלח את הקוד למי שמחזיק בטלפון אותו תרצה לחבר
            </p>

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={copyQRImage}
                disabled={!qrCode}
                className={`w-full py-3 bg-[#030733] text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2
                  ${!qrCode ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#1a1a4a]'}`}
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    הועתק!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    העתק קוד QR
                  </>
                )}
              </button>

              <button
                onClick={downloadQR}
                disabled={!qrCode}
                className={`w-full py-3 border rounded-lg font-semibold transition-colors flex items-center justify-center gap-2
                  ${darkMode
                    ? 'border-[#2a3f5f] text-white hover:bg-[#0d1a2d]'
                    : 'border-gray-200 text-[#030733] hover:bg-gray-50'
                  }
                  ${!qrCode ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Download className="w-5 h-5" />
                הורד קוד QR
              </button>

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

        {/* Step: Error */}
        {step === 'error' && (
          <div className={`rounded-[24px] p-8 text-center ${darkMode ? 'bg-[#1a2942]' : 'bg-white'}`}>
            <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <X className="w-10 h-10 text-white" />
            </div>
            <h2 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              שגיאה
            </h2>
            <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {errorMessage}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('loading')
                  setQrCode('')
                  setErrorMessage('')
                  createConnection()
                }}
                className={`flex-1 py-3 border rounded-lg font-semibold transition-colors
                  ${darkMode
                    ? 'border-[#2a3f5f] text-white hover:bg-[#0d1a2d]'
                    : 'border-gray-200 text-[#030733] hover:bg-gray-50'
                  }`}
              >
                נסה שוב
              </button>
              <button
                onClick={() => router.push('/connections')}
                className="flex-1 py-3 bg-[#030733] text-white font-semibold rounded-lg hover:bg-[#1a1a4a] transition-colors"
              >
                חזור לחיבורים
              </button>
            </div>
          </div>
        )}
      </div>

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
