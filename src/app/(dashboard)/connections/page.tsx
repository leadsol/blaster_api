'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus,
  RefreshCw,
  Trash2,
  QrCode,
  Check,
  X,
  Loader2,
  Smartphone,
  Send,
  Link2,
  Copy,
  CheckCircle,
  AlertCircle,
  Phone,
  Wifi,
  WifiOff,
  Settings,
  ChevronRight,
  Menu,
  Pencil,
  Unplug
} from 'lucide-react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { useTheme } from '@/contexts/ThemeContext'
import { ConfirmModal, AlertModal } from '@/components/modals'

interface Connection {
  id: string
  session_name: string
  phone_number: string | null
  display_name: string | null
  status: 'connected' | 'disconnected' | 'connecting' | 'qr_pending'
  first_connected_at: string | null
  last_seen_at: string | null
  created_at: string
  updated_at: string
  user_id: string
}

const statusLabels: Record<string, string> = {
  connected: 'מחובר',
  disconnected: 'מנותק',
  connecting: 'מתחבר...',
  qr_pending: 'ממתין לסריקה',
}

const statusColors: Record<string, string> = {
  connected: 'bg-green-500',
  disconnected: 'bg-red-500',
  connecting: 'bg-yellow-500',
  qr_pending: 'bg-blue-500',
}

type ConnectionMethod = 'scan' | 'send' | 'code' | null

// Convert Israeli phone number to international format
// 0501234567 → 972501234567
// 501234567 → 972501234567
// 972501234567 → 972501234567
const formatIsraeliPhone = (phone: string): string => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/[^0-9]/g, '')

  // If starts with 0, remove it and add 972
  if (cleaned.startsWith('0')) {
    cleaned = '972' + cleaned.substring(1)
  }
  // If doesn't start with 972 and is 9 digits (Israeli mobile without prefix)
  else if (!cleaned.startsWith('972') && cleaned.length === 9) {
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
    // Fallback to timestamp-based ID if RPC fails
    return `LEADSOL_${Date.now()}`
  }

  return `LEADSOL${data}`
}

export default function ConnectionsPage() {
  const { darkMode } = useTheme()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>(null)
  const [displayName, setDisplayName] = useState('') // User-friendly name for display only
  const [phoneNumber, setPhoneNumber] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [linkCode, setLinkCode] = useState('')
  const [currentSessionId, setCurrentSessionId] = useState('')
  const [creatingSession, setCreatingSession] = useState(false)
  const [copied, setCopied] = useState(false)
  const [step, setStep] = useState(1)
  const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null)
  const [connectionToDisconnect, setConnectionToDisconnect] = useState<Connection | null>(null)
  const [connectionToEdit, setConnectionToEdit] = useState<Connection | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [connectionToRequestCode, setConnectionToRequestCode] = useState<Connection | null>(null)
  const [codeRequestPhone, setCodeRequestPhone] = useState('')
  const [requestingCode, setRequestingCode] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [connectionSuccess, setConnectionSuccess] = useState(false)
  const [connectionFailed, setConnectionFailed] = useState(false)
  const [connectionFailedMessage, setConnectionFailedMessage] = useState('')
  const [successConnectionName, setSuccessConnectionName] = useState('')
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message?: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ isOpen: false, title: '', type: 'info' })

  useEffect(() => {
    loadConnections()
  }, [])

  // Realtime subscription for connection status updates
  useEffect(() => {
    const supabase = createClient()

    // Subscribe to changes on the connections table
    const channel = supabase
      .channel('connections-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'connections'
        },
        (payload) => {
          console.log('Realtime update:', payload)

          if (payload.eventType === 'INSERT') {
            // New connection added - check if it already exists to prevent duplicates
            const newConnection = payload.new as Connection
            setConnections(prev => {
              // Only add if not already in list
              if (prev.some(c => c.id === newConnection.id)) {
                return prev
              }
              return [newConnection, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Connection
            const old = payload.old as Partial<Connection>

            // Update the connection in state
            setConnections(prev =>
              prev.map(c => c.id === updated.id ? updated : c)
            )

            // If status changed while modal is open, show appropriate state
            if ((step === 2 || showQRModal) && currentSessionId === updated.id) {
              if (old.status !== 'connected' && updated.status === 'connected') {
                // Show success state in the current modal
                setConnectionSuccess(true)
                setConnectionFailed(false)
                setSuccessConnectionName(updated.display_name || 'החיבור')
                setQrCode('')
                setLinkCode('')
              } else if (updated.status === 'disconnected' && old.status !== 'disconnected') {
                // Connection failed/disconnected
                setConnectionFailed(true)
                setConnectionFailedMessage('החיבור נכשל. נסה שוב.')
                setConnectionSuccess(false)
              }
            }
          } else if (payload.eventType === 'DELETE') {
            // Connection deleted
            setConnections(prev => prev.filter(c => c.id !== (payload.old as Connection).id))
          }
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [step, showQRModal, currentSessionId])

  const loadConnections = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('connections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setConnections(data)
    }
    setLoading(false)
  }

  const createConnection = async () => {
    if (!displayName.trim()) return
    setCreatingSession(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Generate unique session ID for WAHA (LEADSOL1, LEADSOL2, etc.)
      const wahaSessionName = await getNextSessionName()

      // Create session in WAHA with auto-generated name
      const wahaResponse = await fetch('/api/waha/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: wahaSessionName }),
      })

      const wahaData = await wahaResponse.json()
      console.log('WAHA response:', wahaData)

      if (!wahaResponse.ok) {
        throw new Error(`Failed to create WAHA session: ${JSON.stringify(wahaData)}`)
      }

      // Save to database with auto-generated WAHA name and user's display name
      const { data, error } = await supabase.from('connections').insert({
        user_id: user.id,
        session_name: wahaSessionName, // Auto-generated unique name for WAHA
        display_name: displayName.trim(), // User-friendly name for display
        status: 'qr_pending',
      }).select().single()

      if (error) throw error

      setConnections([data, ...connections])
      setCurrentSessionId(data.id)

      // Handle based on connection method
      if (connectionMethod === 'scan') {
        await fetchQRCode(wahaSessionName)
        setStep(2)
      } else if (connectionMethod === 'send') {
        await fetchQRCode(wahaSessionName)
        setStep(2)
      } else if (connectionMethod === 'code') {
        await fetchLinkCode(wahaSessionName)
        setStep(2)
      }
    } catch (error: any) {
      console.error('Error creating connection:', error?.message || error)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה ביצירת החיבור',
        message: error?.message || 'שגיאה לא ידועה',
        type: 'error'
      })
    } finally {
      setCreatingSession(false)
    }
  }

  const fetchQRCode = async (sessionName: string, retries = 3) => {
    try {
      const response = await fetch(`/api/waha/sessions/${sessionName}/qr`)
      const data = await response.json()

      if (response.ok && data.qr) {
        setQrCode(data.qr)
        return true
      }

      // If not ready yet and we have retries left, wait and try again
      if (retries > 0) {
        console.log(`QR not ready, retrying in 2 seconds... (${retries} retries left)`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        return fetchQRCode(sessionName, retries - 1)
      }

      console.log('QR not available after retries:', data)
      return false
    } catch (error) {
      console.error('Error fetching QR code:', error)
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        return fetchQRCode(sessionName, retries - 1)
      }
      return false
    }
  }

  const fetchLinkCode = async (sessionName: string, retries = 8) => {
    try {
      // First, wait for session to be ready (in SCAN_QR_CODE state)
      if (retries === 8) {
        console.log('Waiting for session to be ready...')
        await new Promise(resolve => setTimeout(resolve, 3000))

        // Check if session is ready
        const statusResponse = await fetch(`/api/waha/sessions/${sessionName}/status`)
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          console.log('Session status:', statusData.status)
          if (statusData.status !== 'SCAN_QR_CODE' && statusData.status !== 'WORKING') {
            // Session not ready yet, wait more
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      }

      // Format phone number to international format (Israeli: 05X → 9725X)
      const cleanPhone = formatIsraeliPhone(phoneNumber)
      console.log(`Requesting code for phone: ${cleanPhone}`)

      const response = await fetch(`/api/waha/sessions/${sessionName}/auth/request-code`, {
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

      // If not ready yet and we have retries left, wait and try again
      if (retries > 0) {
        console.log(`Code not ready, retrying in 3 seconds... (${retries} retries left)`)
        await new Promise(resolve => setTimeout(resolve, 3000))
        return fetchLinkCode(sessionName, retries - 1)
      }

      // All retries failed
      console.error('Failed to get link code after retries:', data)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה בקבלת קוד',
        message: data.details || data.error || 'לא הצלחנו לקבל קוד מ-WhatsApp. נסה שוב או השתמש בסריקת QR.',
        type: 'error'
      })
      return false
    } catch (error) {
      console.error('Error fetching link code:', error)
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        return fetchLinkCode(sessionName, retries - 1)
      }
      setAlertModal({
        isOpen: true,
        title: 'שגיאה בקבלת קוד',
        message: 'אירעה שגיאה בתקשורת עם השרת',
        type: 'error'
      })
      return false
    }
  }

  // Request code for existing connection
  const requestCodeForConnection = async () => {
    if (!connectionToRequestCode || !codeRequestPhone.trim()) return

    setRequestingCode(true)
    try {
      // First check session status
      const statusResponse = await fetch(`/api/waha/sessions/${connectionToRequestCode.session_name}/status`)
      let needsRestart = false

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        console.log('Session status before code request:', statusData.status)

        // Session needs to be in SCAN_QR_CODE state to request pairing code
        if (statusData.status !== 'SCAN_QR_CODE') {
          needsRestart = true
        }
      } else {
        needsRestart = true
      }

      // If session is not ready, restart it
      if (needsRestart) {
        console.log('Restarting session to get pairing code...')
        const restartResponse = await fetch(`/api/waha/sessions/${connectionToRequestCode.session_name}/restart`, {
          method: 'POST',
        })

        if (!restartResponse.ok) {
          throw new Error('Failed to restart session')
        }

        // Wait for session to reach SCAN_QR_CODE state
        let attempts = 0
        const maxAttempts = 10
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1500))
          const checkStatus = await fetch(`/api/waha/sessions/${connectionToRequestCode.session_name}/status`)
          if (checkStatus.ok) {
            const checkData = await checkStatus.json()
            console.log(`Session status check ${attempts + 1}:`, checkData.status)
            if (checkData.status === 'SCAN_QR_CODE') {
              break
            }
          }
          attempts++
        }

        if (attempts >= maxAttempts) {
          throw new Error('Session not ready for pairing code')
        }
      }

      // Format phone number to international format (Israeli: 05X → 9725X)
      const cleanPhone = formatIsraeliPhone(codeRequestPhone)
      console.log(`Requesting code for phone: ${cleanPhone}`)

      const response = await fetch(`/api/waha/sessions/${connectionToRequestCode.session_name}/auth/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: cleanPhone }),
      })

      const data = await response.json()
      console.log('Code request response:', data)

      if (response.ok && data.code) {
        setLinkCode(data.code)
        setCurrentSessionId(connectionToRequestCode.id)
        setConnectionToRequestCode(null)
        setCodeRequestPhone('')
        // Show the code modal
        setConnectionMethod('code')
        setStep(2)
        setShowNewModal(true)
      } else {
        setAlertModal({
          isOpen: true,
          title: 'שגיאה בקבלת קוד',
          message: data.details || data.error || 'לא הצלחנו לקבל קוד מ-WhatsApp. נסה שוב או השתמש בסריקת QR.',
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Error requesting code:', error)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה בקבלת קוד',
        message: error instanceof Error ? error.message : 'אירעה שגיאה בתקשורת עם השרת',
        type: 'error'
      })
    } finally {
      setRequestingCode(false)
    }
  }

  const refreshConnection = async (connection: Connection) => {
    try {
      const response = await fetch(`/api/waha/sessions/${connection.session_name}/status`)
      if (response.ok) {
        const data = await response.json()

        const supabase = createClient()
        // Only update display_name if it's currently empty (preserve user's custom name)
        const updateData: Record<string, unknown> = {
          status: data.status === 'WORKING' ? 'connected' : 'disconnected',
          phone_number: data.me?.id?.split('@')[0] || null,
        }

        // Only set display_name if connection doesn't have one yet
        if (!connection.display_name && data.me?.pushName) {
          updateData.display_name = data.me.pushName
        }

        // Set first_connected_at if this is the first time connecting
        if (data.status === 'WORKING' && !connection.first_connected_at) {
          updateData.first_connected_at = new Date().toISOString()
        }

        await supabase.from('connections').update(updateData).eq('id', connection.id)

        loadConnections()
      }
    } catch (error) {
      console.error('Error refreshing connection:', error)
    }
  }

  const deleteConnection = (connection: Connection) => {
    setConnectionToDelete(connection)
  }

  const confirmDeleteConnection = async () => {
    if (!connectionToDelete) return

    try {
      // Delete from WAHA
      await fetch(`/api/waha/sessions/${connectionToDelete.session_name}`, {
        method: 'DELETE',
      })

      // Delete from database
      const supabase = createClient()
      await supabase.from('connections').delete().eq('id', connectionToDelete.id)

      setConnections(connections.filter(c => c.id !== connectionToDelete.id))
      setConnectionToDelete(null)
    } catch (error) {
      console.error('Error deleting connection:', error)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה במחיקת החיבור',
        type: 'error'
      })
    }
  }

  // Disconnect session (logout) without deleting
  const disconnectConnection = (connection: Connection) => {
    setConnectionToDisconnect(connection)
  }

  const confirmDisconnectConnection = async () => {
    if (!connectionToDisconnect) return

    setDisconnecting(true)
    try {
      // Call WAHA logout endpoint
      const response = await fetch(`/api/waha/sessions/${connectionToDisconnect.session_name}/logout`, {
        method: 'POST',
      })

      if (response.ok) {
        // Update status in database
        const supabase = createClient()
        await supabase.from('connections').update({
          status: 'disconnected',
          phone_number: null,
        }).eq('id', connectionToDisconnect.id)

        setConnections(connections.map(c =>
          c.id === connectionToDisconnect.id
            ? { ...c, status: 'disconnected' as const, phone_number: null }
            : c
        ))

        setAlertModal({
          isOpen: true,
          title: 'החיבור נותק בהצלחה',
          message: 'ניתן לחבר מחדש באמצעות סריקת QR או קוד',
          type: 'success'
        })
      } else {
        throw new Error('Failed to disconnect')
      }
    } catch (error) {
      console.error('Error disconnecting:', error)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה בניתוק החיבור',
        type: 'error'
      })
    } finally {
      setDisconnecting(false)
      setConnectionToDisconnect(null)
    }
  }

  // Edit connection display name
  const openEditModal = (connection: Connection) => {
    setConnectionToEdit(connection)
    setEditDisplayName(connection.display_name || '')
  }

  const saveDisplayName = async () => {
    if (!connectionToEdit) return

    setSavingName(true)
    try {
      const supabase = createClient()
      await supabase.from('connections').update({
        display_name: editDisplayName.trim() || null,
      }).eq('id', connectionToEdit.id)

      setConnections(connections.map(c =>
        c.id === connectionToEdit.id
          ? { ...c, display_name: editDisplayName.trim() || null }
          : c
      ))

      setConnectionToEdit(null)
      setEditDisplayName('')
    } catch (error) {
      console.error('Error saving name:', error)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה בשמירת השם',
        type: 'error'
      })
    } finally {
      setSavingName(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(linkCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const resetModal = () => {
    setShowNewModal(false)
    setConnectionMethod(null)
    setDisplayName('')
    setPhoneNumber('')
    setQrCode('')
    setLinkCode('')
    setStep(1)
    setConnectionSuccess(false)
    setConnectionFailed(false)
    setConnectionFailedMessage('')
    setSuccessConnectionName('')
  }

  const connectedCount = connections.filter(c => c.status === 'connected').length
  const totalCount = connections.length

  return (
    <div className="p-3 sm:p-4 lg:p-6 h-full overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 lg:mb-8">
        <div>
          <h1 className={`text-lg sm:text-xl lg:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>החיבורים שלך</h1>
          <p className={`text-xs sm:text-sm lg:text-base ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>נהל את חיבורי WhatsApp</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center justify-center gap-1.5 sm:gap-2 bg-[#25D366] text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg hover:bg-[#20bd5a] transition-colors w-full sm:w-auto text-[13px] sm:text-[14px]"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>הוסף חיבור</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        {/* Status Card - Full width on mobile, side on desktop */}
        <div className="lg:col-span-4 order-2 lg:order-1">
          <div className={`${darkMode ? 'bg-[#1a2942] border-[#2a3f5f]' : 'bg-white border-gray-200'} rounded-xl border p-4 md:p-6`}>
            <h3 className={`font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>סטטוס החיבורים</h3>
            <div className="flex items-center justify-center mb-4 sm:mb-6">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    stroke={darkMode ? '#2a3f5f' : '#e5e7eb'}
                    strokeWidth="12"
                  />
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    stroke="#25D366"
                    strokeWidth="12"
                    strokeDasharray={`${(connectedCount / Math.max(totalCount, 1)) * 251} 251`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-xl sm:text-2xl md:text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{connectedCount}/{totalCount}</span>
                  <span className={`text-[9px] sm:text-[10px] md:text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>מחוברים</span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
                  <Wifi className="w-4 h-4" />
                  <span className="text-xl font-bold">{connectedCount}</span>
                </div>
                <span className="text-xs text-green-400">מחוברים</span>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-red-400 mb-1">
                  <WifiOff className="w-4 h-4" />
                  <span className="text-xl font-bold">{totalCount - connectedCount}</span>
                </div>
                <span className="text-xs text-red-400">מנותקים</span>
              </div>
            </div>
          </div>

          {/* Tips Section - Hidden on mobile */}
          <div className={`hidden md:block ${darkMode ? 'bg-[#1a2942] border-[#2a3f5f]' : 'bg-white border-gray-200'} rounded-xl border p-6 mt-6`}>
            <h3 className={`font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>טיפים לחיבור יציב</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                  וודא שהטלפון מחובר לאינטרנט יציב
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                  אפליקציית WhatsApp חייבת להיות פתוחה ברקע
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className={`text-sm ${darkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>
                  לא לפתוח את WhatsApp Web במקום אחר
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Connections Table */}
        <div className="lg:col-span-8 order-1 lg:order-2">
          <div className={`${darkMode ? 'bg-[#1a2942] border-[#2a3f5f]' : 'bg-white border-gray-200'} rounded-xl border overflow-hidden`}>
            <div className={`p-4 border-b ${darkMode ? 'border-[#2a3f5f]' : 'border-gray-200'} flex items-center justify-between`}>
              <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>רשימת חיבורים</h3>
              <button
                onClick={loadConnections}
                className={`flex items-center gap-2 text-sm ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} transition-colors`}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">רענן</span>
              </button>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className={darkMode ? 'bg-[#0f172a]' : 'bg-gray-50'}>
                  <tr className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <th className="text-right p-4 font-medium">שם הקמפיין</th>
                    <th className="text-right p-4 font-medium">סטטוס</th>
                    <th className="text-right p-4 font-medium">תאריך חיבור ראשוני</th>
                    <th className="text-right p-4 font-medium">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className={`p-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : connections.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center">
                        <div className={`w-16 h-16 ${darkMode ? 'bg-[#2a3f5f]' : 'bg-gray-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                          <Smartphone className={`w-8 h-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                        </div>
                        <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>אין חיבורים עדיין</h3>
                        <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>חבר את WhatsApp שלך כדי להתחיל לשלוח הודעות</p>
                        <button
                          onClick={() => setShowNewModal(true)}
                          className="inline-flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-lg hover:bg-[#20bd5a] transition-colors"
                        >
                          <Plus className="w-5 h-5" />
                          הוסף חיבור ראשון
                        </button>
                      </td>
                    </tr>
                  ) : (
                    connections.map((connection) => (
                      <tr key={connection.id} className={`border-t ${darkMode ? 'border-[#2a3f5f] hover:bg-[#0f172a]/50' : 'border-gray-100 hover:bg-gray-50'}`}>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center text-white font-medium">
                              {connection.display_name?.[0]?.toUpperCase() || 'W'}
                            </div>
                            <div>
                              <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                {connection.display_name || 'חיבור WhatsApp'}
                              </p>
                              {connection.phone_number && (
                                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} dir="ltr">{connection.phone_number}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                            connection.status === 'connected'
                              ? 'bg-green-500/20 text-green-400'
                              : connection.status === 'disconnected'
                              ? 'bg-red-500/20 text-red-400'
                              : connection.status === 'qr_pending'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            <div className={`w-2 h-2 rounded-full ${statusColors[connection.status]}`} />
                            {statusLabels[connection.status]}
                          </span>
                        </td>
                        <td className={`p-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {connection.created_at
                            ? format(new Date(connection.created_at), 'dd/MM/yyyy', { locale: he })
                            : '-'}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => refreshConnection(connection)}
                              className={`p-2 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-[#2a3f5f]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'} rounded-lg transition-colors`}
                              title="רענן סטטוס"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            {connection.status !== 'connected' && (
                              <>
                                <button
                                  onClick={async () => {
                                    setCurrentSessionId(connection.id)
                                    await fetchQRCode(connection.session_name)
                                    setShowQRModal(true)
                                  }}
                                  className={`p-2 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-[#2a3f5f]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'} rounded-lg transition-colors`}
                                  title="הצג QR"
                                >
                                  <QrCode className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setCurrentSessionId(connection.id)
                                    setConnectionToRequestCode(connection)
                                  }}
                                  className={`p-2 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-[#2a3f5f]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'} rounded-lg transition-colors`}
                                  title="בקש קוד לטלפון"
                                >
                                  <Link2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {connection.status === 'connected' && (
                              <button
                                onClick={() => disconnectConnection(connection)}
                                className={`p-2 ${darkMode ? 'text-gray-400 hover:text-orange-400 hover:bg-orange-500/10' : 'text-gray-400 hover:text-orange-600 hover:bg-orange-100'} rounded-lg transition-colors`}
                                title="נתק חיבור"
                              >
                                <Unplug className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openEditModal(connection)}
                              className={`p-2 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-[#2a3f5f]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'} rounded-lg transition-colors`}
                              title="ערוך שם"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteConnection(connection)}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="מחק חיבור"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden">
              {loading ? (
                <div className={`p-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              ) : connections.length === 0 ? (
                <div className="p-8 text-center">
                  <div className={`w-16 h-16 ${darkMode ? 'bg-[#2a3f5f]' : 'bg-gray-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <Smartphone className={`w-8 h-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  </div>
                  <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>אין חיבורים עדיין</h3>
                  <p className={`mb-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>חבר את WhatsApp שלך כדי להתחיל</p>
                  <button
                    onClick={() => setShowNewModal(true)}
                    className="inline-flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-lg"
                  >
                    <Plus className="w-5 h-5" />
                    הוסף חיבור
                  </button>
                </div>
              ) : (
                <div className={`divide-y ${darkMode ? 'divide-[#2a3f5f]' : 'divide-gray-100'}`}>
                  {connections.map((connection) => (
                    <div key={connection.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center text-white font-medium">
                            {connection.display_name?.[0]?.toUpperCase() || 'W'}
                          </div>
                          <div>
                            <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {connection.display_name || 'חיבור WhatsApp'}
                            </p>
                            {connection.phone_number && (
                              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} dir="ltr">{connection.phone_number}</p>
                            )}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          connection.status === 'connected'
                            ? 'bg-green-500/20 text-green-400'
                            : connection.status === 'disconnected'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${statusColors[connection.status]}`} />
                          {statusLabels[connection.status]}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          {connection.created_at
                            ? format(new Date(connection.created_at), 'dd/MM/yyyy', { locale: he })
                            : 'לא חובר עדיין'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => refreshConnection(connection)}
                            className={`p-2 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-900'} rounded-lg`}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          {connection.status !== 'connected' && (
                            <>
                              <button
                                onClick={async () => {
                                  setCurrentSessionId(connection.id)
                                  await fetchQRCode(connection.session_name)
                                  setShowQRModal(true)
                                }}
                                className={`p-2 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-900'} rounded-lg`}
                              >
                                <QrCode className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setCurrentSessionId(connection.id)
                                  setConnectionToRequestCode(connection)
                                }}
                                className={`p-2 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-900'} rounded-lg`}
                              >
                                <Link2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {connection.status === 'connected' && (
                            <button
                              onClick={() => disconnectConnection(connection)}
                              className={`p-2 ${darkMode ? 'text-gray-400 hover:text-orange-400' : 'text-gray-400 hover:text-orange-600'} rounded-lg`}
                            >
                              <Unplug className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(connection)}
                            className={`p-2 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-900'} rounded-lg`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteConnection(connection)}
                            className="p-2 text-gray-400 hover:text-red-400 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Connection Button at bottom */}
            <div className={`p-4 border-t ${darkMode ? 'border-[#2a3f5f]' : 'border-gray-200'} flex justify-center`}>
              <button
                onClick={() => setShowNewModal(true)}
                className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center text-white hover:bg-[#20bd5a] transition-colors shadow-lg"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* New Connection Modal */}
      {showNewModal && step === 1 && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-[#1a2942]' : 'bg-white'} rounded-xl w-full max-w-md overflow-hidden`} dir="rtl">
            <div className={`p-4 md:p-6 border-b ${darkMode ? 'border-[#2a3f5f]' : 'border-gray-200'} flex items-center justify-between`}>
              <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>יצירת קונקשן חדש</h3>
              <button onClick={resetModal} className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 md:p-6">
              <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>אנא בחר את אמצעי הזיהוי הנוחה לך לחיבור</p>

              <div className="space-y-3">
                {/* Option 1: Scan QR */}
                <button
                  onClick={() => setConnectionMethod('scan')}
                  className={`w-full p-4 rounded-xl border-2 text-right transition-all ${
                    connectionMethod === 'scan'
                      ? 'border-[#25D366] bg-[#25D366]/10'
                      : darkMode ? 'border-[#2a3f5f] hover:border-[#3a5070]' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      connectionMethod === 'scan' ? 'bg-[#25D366]' : darkMode ? 'bg-[#2a3f5f]' : 'bg-gray-100'
                    }`}>
                      <QrCode className={`w-6 h-6 ${connectionMethod === 'scan' || darkMode ? 'text-white' : 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>סריקת QR קוד</h4>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>סרוק את ה-QR מהאפליקציית וואטסאפ שלך</p>
                    </div>
                  </div>
                </button>

                {/* Option 2: Send QR */}
                <button
                  onClick={() => setConnectionMethod('send')}
                  className={`w-full p-4 rounded-xl border-2 text-right transition-all ${
                    connectionMethod === 'send'
                      ? 'border-[#25D366] bg-[#25D366]/10'
                      : darkMode ? 'border-[#2a3f5f] hover:border-[#3a5070]' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      connectionMethod === 'send' ? 'bg-[#25D366]' : darkMode ? 'bg-[#2a3f5f]' : 'bg-gray-100'
                    }`}>
                      <Send className={`w-6 h-6 ${connectionMethod === 'send' || darkMode ? 'text-white' : 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>שליחת קוד QR לטלפון אחר</h4>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>שלח את הקוד QR לעוזר/ת שיסרקו אותו עבורך</p>
                    </div>
                  </div>
                </button>

                {/* Option 3: Link with Code */}
                <button
                  onClick={() => setConnectionMethod('code')}
                  className={`w-full p-4 rounded-xl border-2 text-right transition-all ${
                    connectionMethod === 'code'
                      ? 'border-[#25D366] bg-[#25D366]/10'
                      : darkMode ? 'border-[#2a3f5f] hover:border-[#3a5070]' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      connectionMethod === 'code' ? 'bg-[#25D366]' : darkMode ? 'bg-[#2a3f5f]' : 'bg-gray-100'
                    }`}>
                      <Link2 className={`w-6 h-6 ${connectionMethod === 'code' || darkMode ? 'text-white' : 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>חיבור באמצעות קוד אימות</h4>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>קבל קוד והזן אותו באפליקציית הוואטסאפ שלך</p>
                    </div>
                  </div>
                </button>
              </div>

              {connectionMethod && (
                <div className="mt-6 space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>שם החיבור (לתצוגה)</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="לדוגמה: WhatsApp Business"
                      className={`w-full px-4 py-3 ${darkMode ? 'bg-[#0f172a] border-[#2a3f5f] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded-lg placeholder-gray-500 focus:ring-2 focus:ring-[#25D366] focus:border-transparent outline-none`}
                    />
                    <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>השם הזה יופיע רק אצלך במערכת</p>
                  </div>

                  {connectionMethod === 'code' && (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>מספר הטלפון לחיבור</label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="0501234567"
                        className={`w-full px-4 py-3 ${darkMode ? 'bg-[#0f172a] border-[#2a3f5f] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded-lg placeholder-gray-500 focus:ring-2 focus:ring-[#25D366] focus:border-transparent outline-none`}
                        dir="ltr"
                      />
                      <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>הזן מספר ישראלי רגיל (לדוגמה: 0501234567)</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={`p-4 md:p-6 border-t ${darkMode ? 'border-[#2a3f5f]' : 'border-gray-200'}`}>
              <button
                onClick={createConnection}
                disabled={creatingSession || !displayName.trim() || !connectionMethod || (connectionMethod === 'code' && !phoneNumber.trim())}
                className="w-full px-4 py-3 bg-[#25D366] rounded-lg text-white font-medium hover:bg-[#20bd5a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creatingSession ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'המשך לחיבור'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Show QR or Code */}
      {showNewModal && step === 2 && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-[#1a2942]' : 'bg-white'} rounded-xl w-full max-w-md overflow-hidden`} dir="rtl">
            <div className={`p-4 md:p-6 border-b ${darkMode ? 'border-[#2a3f5f]' : 'border-gray-200'} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                {!connectionSuccess && !connectionFailed && (
                  <ChevronRight
                    className={`w-5 h-5 cursor-pointer rotate-180 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
                    onClick={() => setStep(1)}
                  />
                )}
                <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {connectionSuccess ? 'החיבור הצליח!' : connectionFailed ? 'החיבור נכשל' : 'חיבור הטלפון'}
                </h3>
              </div>
              <button onClick={resetModal} className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 md:p-6">
              {connectionSuccess ? (
                // Success state
                <div className="text-center py-6">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                  </div>
                  <h4 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {successConnectionName} מחובר!
                  </h4>
                  <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    החיבור בוצע בהצלחה וכעת ניתן לשלוח הודעות
                  </p>
                  <button
                    onClick={resetModal}
                    className="w-full px-4 py-3 bg-[#25D366] rounded-lg text-white font-medium hover:bg-[#20bd5a] transition-colors"
                  >
                    סגור
                  </button>
                </div>
              ) : connectionFailed ? (
                // Failed state
                <div className="text-center py-6">
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-10 h-10 text-red-500" />
                  </div>
                  <h4 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    החיבור נכשל
                  </h4>
                  <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {connectionFailedMessage || 'לא הצלחנו לחבר את המכשיר. נסה שוב.'}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setConnectionFailed(false)
                        setConnectionFailedMessage('')
                        const connection = connections.find(c => c.id === currentSessionId)
                        if (connection) {
                          if (connectionMethod === 'scan' || connectionMethod === 'send') {
                            fetchQRCode(connection.session_name)
                          } else if (connectionMethod === 'code') {
                            setLinkCode('')
                            fetchLinkCode(connection.session_name)
                          }
                        }
                      }}
                      className="flex-1 px-4 py-3 bg-[#25D366] rounded-lg text-white font-medium hover:bg-[#20bd5a] transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      נסה שוב
                    </button>
                    <button
                      onClick={resetModal}
                      className={`flex-1 px-4 py-3 border rounded-lg transition-colors ${darkMode ? 'border-[#2a3f5f] text-white hover:bg-[#2a3f5f]' : 'border-gray-200 text-gray-900 hover:bg-gray-50'}`}
                    >
                      סגור
                    </button>
                  </div>
                </div>
              ) : (
                // QR/Code state - waiting for scan
                <>
                  {/* Status indicator */}
                  <div className={`flex items-center justify-center gap-2 mb-4 px-4 py-2 rounded-full ${darkMode ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className={`text-sm font-medium ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      ממתין לסריקה...
                    </span>
                  </div>

                  <p className={`text-sm mb-6 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>בצע את הפעולה הבאה</p>

                  {(connectionMethod === 'scan' || connectionMethod === 'send') && (
                    <div className="bg-white rounded-xl p-6 mb-6">
                      {qrCode ? (
                        <img src={`data:image/png;base64,${qrCode}`} alt="QR Code" className="w-full max-w-[200px] mx-auto" />
                      ) : (
                        <div className="w-[200px] h-[200px] mx-auto flex flex-col items-center justify-center">
                          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-2" />
                          <p className="text-sm text-gray-400">טוען קוד QR...</p>
                        </div>
                      )}
                    </div>
                  )}

                  {connectionMethod === 'code' && (
                    <div className={`${darkMode ? 'bg-[#0f172a]' : 'bg-gray-50'} rounded-xl p-6 mb-6 text-center`}>
                      <div className={`w-12 h-12 ${darkMode ? 'bg-[#2a3f5f]' : 'bg-gray-200'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                        <Link2 className={`w-6 h-6 ${darkMode ? 'text-white' : 'text-gray-600'}`} />
                      </div>
                      <h4 className={`font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>הזן את הקוד באפליקציית WhatsApp</h4>
                      <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        פתח את WhatsApp בטלפון שלך {'>'} הגדרות {'>'} מכשירים מקושרים {'>'} קשר מכשיר {'>'} קשר עם מספר טלפון
                      </p>
                      <div className="text-4xl font-mono font-bold text-[#25D366] tracking-widest min-h-[48px] flex items-center justify-center">
                        {linkCode ? (
                          linkCode
                        ) : (
                          <Loader2 className="w-8 h-8 animate-spin text-[#25D366]" />
                        )}
                      </div>
                      {!linkCode && (
                        <p className={`text-xs mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>מקבל קוד מ-WhatsApp...</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        const connection = connections.find(c => c.id === currentSessionId)
                        if (!connection) return

                        if (connectionMethod === 'scan' || connectionMethod === 'send') {
                          setQrCode('') // Clear to show loading
                          fetchQRCode(connection.session_name)
                        } else if (connectionMethod === 'code') {
                          setLinkCode('') // Clear current code to show loading
                          fetchLinkCode(connection.session_name)
                        }
                      }}
                      className={`flex-1 px-4 py-3 border rounded-lg transition-colors flex items-center justify-center gap-2 ${darkMode ? 'border-[#2a3f5f] text-white hover:bg-[#2a3f5f]' : 'border-gray-200 text-gray-900 hover:bg-gray-50'}`}
                    >
                      <RefreshCw className="w-4 h-4" />
                      רענן קוד
                    </button>
                    <button
                      onClick={resetModal}
                      className="flex-1 px-4 py-3 bg-[#25D366] rounded-lg text-white hover:bg-[#20bd5a] transition-colors"
                    >
                      סיום
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Modal for existing connections */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-[#1a2942]' : 'bg-white'} rounded-xl p-6 w-full max-w-sm`} dir="rtl">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {connectionSuccess ? 'החיבור הצליח!' : connectionFailed ? 'החיבור נכשל' : 'סרוק את קוד ה-QR'}
              </h3>
              <button onClick={() => { setShowQRModal(false); setConnectionSuccess(false); setConnectionFailed(false); setConnectionFailedMessage(''); setSuccessConnectionName(''); }} className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {connectionSuccess ? (
              // Success state
              <div className="text-center py-4">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h4 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {successConnectionName} מחובר!
                </h4>
                <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  החיבור בוצע בהצלחה וכעת ניתן לשלוח הודעות
                </p>
                <button
                  onClick={() => { setShowQRModal(false); setConnectionSuccess(false); setSuccessConnectionName(''); }}
                  className="w-full px-4 py-3 bg-[#25D366] rounded-lg text-white font-medium hover:bg-[#20bd5a] transition-colors"
                >
                  סגור
                </button>
              </div>
            ) : connectionFailed ? (
              // Failed state
              <div className="text-center py-4">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-10 h-10 text-red-500" />
                </div>
                <h4 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  החיבור נכשל
                </h4>
                <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {connectionFailedMessage || 'לא הצלחנו לחבר את המכשיר. נסה שוב.'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setConnectionFailed(false)
                      setConnectionFailedMessage('')
                      const connection = connections.find(c => c.id === currentSessionId)
                      if (connection) {
                        setQrCode('')
                        fetchQRCode(connection.session_name)
                      }
                    }}
                    className="flex-1 px-4 py-3 bg-[#25D366] rounded-lg text-white font-medium hover:bg-[#20bd5a] transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    נסה שוב
                  </button>
                  <button
                    onClick={() => { setShowQRModal(false); setConnectionFailed(false); setConnectionFailedMessage(''); }}
                    className={`flex-1 px-4 py-3 border rounded-lg transition-colors ${darkMode ? 'border-[#2a3f5f] text-white hover:bg-[#2a3f5f]' : 'border-gray-200 text-gray-900 hover:bg-gray-50'}`}
                  >
                    סגור
                  </button>
                </div>
              </div>
            ) : (
              // QR state - waiting for scan
              <>
                {/* Status indicator */}
                <div className={`flex items-center justify-center gap-2 mb-4 px-4 py-2 rounded-full ${darkMode ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className={`text-sm font-medium ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    ממתין לסריקה...
                  </span>
                </div>

                <div className="bg-white rounded-xl p-4 mb-4">
                  {qrCode ? (
                    <img src={`data:image/png;base64,${qrCode}`} alt="QR Code" className="w-full" />
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-2" />
                      <p className="text-sm text-gray-400">טוען קוד QR...</p>
                    </div>
                  )}
                </div>
                <p className={`text-sm text-center mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  פתח את WhatsApp בטלפון שלך וסרוק את קוד ה-QR
                </p>
                <button
                  onClick={() => {
                    const connection = connections.find(c => c.id === currentSessionId)
                    if (connection) {
                      setQrCode('') // Clear to show loading
                      fetchQRCode(connection.session_name)
                    }
                  }}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 border rounded-lg transition-colors ${darkMode ? 'border-[#2a3f5f] text-white hover:bg-[#2a3f5f]' : 'border-gray-200 text-gray-900 hover:bg-gray-50'}`}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>רענן QR</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Request Code Modal for existing connection */}
      {connectionToRequestCode && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-[#1a2942]' : 'bg-white'} rounded-xl w-full max-w-md overflow-hidden`} dir="rtl">
            <div className={`p-4 md:p-6 border-b ${darkMode ? 'border-[#2a3f5f]' : 'border-gray-200'} flex items-center justify-between`}>
              <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>בקש קוד חיבור</h3>
              <button
                onClick={() => {
                  setConnectionToRequestCode(null)
                  setCodeRequestPhone('')
                }}
                className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 md:p-6">
              <div className={`${darkMode ? 'bg-[#0f172a]' : 'bg-gray-50'} rounded-xl p-4 mb-4`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center text-white font-medium">
                    {connectionToRequestCode.display_name?.[0]?.toUpperCase() || 'W'}
                  </div>
                  <div>
                    <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {connectionToRequestCode.display_name || 'חיבור WhatsApp'}
                    </p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {statusLabels[connectionToRequestCode.status]}
                    </p>
                  </div>
                </div>
              </div>

              <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                הזן את מספר הטלפון של WhatsApp שברצונך לחבר. תקבל קוד שצריך להזין באפליקציית WhatsApp.
              </p>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>מספר הטלפון לחיבור</label>
                <input
                  type="tel"
                  value={codeRequestPhone}
                  onChange={(e) => setCodeRequestPhone(e.target.value)}
                  placeholder="0501234567"
                  className={`w-full px-4 py-3 ${darkMode ? 'bg-[#0f172a] border-[#2a3f5f] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded-lg placeholder-gray-500 focus:ring-2 focus:ring-[#25D366] focus:border-transparent outline-none`}
                  dir="ltr"
                />
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>הזן מספר ישראלי רגיל (לדוגמה: 0501234567)</p>
              </div>
            </div>

            <div className={`p-4 md:p-6 border-t ${darkMode ? 'border-[#2a3f5f]' : 'border-gray-200'} flex gap-3`}>
              <button
                onClick={() => {
                  setConnectionToRequestCode(null)
                  setCodeRequestPhone('')
                }}
                className={`flex-1 px-4 py-3 border rounded-lg transition-colors ${darkMode ? 'border-[#2a3f5f] text-white hover:bg-[#2a3f5f]' : 'border-gray-200 text-gray-900 hover:bg-gray-50'}`}
              >
                ביטול
              </button>
              <button
                onClick={requestCodeForConnection}
                disabled={requestingCode || !codeRequestPhone.trim()}
                className="flex-1 px-4 py-3 bg-[#25D366] rounded-lg text-white font-medium hover:bg-[#20bd5a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {requestingCode ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Link2 className="w-4 h-4" />
                    בקש קוד
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Display Name Modal */}
      {connectionToEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-[#1a2942]' : 'bg-white'} rounded-xl w-full max-w-md overflow-hidden`} dir="rtl">
            <div className={`p-4 md:p-6 border-b ${darkMode ? 'border-[#2a3f5f]' : 'border-gray-200'} flex items-center justify-between`}>
              <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>ערוך שם חיבור</h3>
              <button
                onClick={() => {
                  setConnectionToEdit(null)
                  setEditDisplayName('')
                }}
                className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 md:p-6">
              <div className={`${darkMode ? 'bg-[#0f172a]' : 'bg-gray-50'} rounded-xl p-4 mb-4`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center text-white font-medium">
                    {connectionToEdit.display_name?.[0] || 'W'}
                  </div>
                  <div>
                    <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {connectionToEdit.display_name || 'חיבור WhatsApp'}
                    </p>
                    {connectionToEdit.phone_number && (
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} dir="ltr">
                        {connectionToEdit.phone_number}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>שם החיבור (לתצוגה)</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="לדוגמה: WhatsApp Business"
                  className={`w-full px-4 py-3 ${darkMode ? 'bg-[#0f172a] border-[#2a3f5f] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border rounded-lg placeholder-gray-500 focus:ring-2 focus:ring-[#25D366] focus:border-transparent outline-none`}
                />
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>השם הזה יופיע רק אצלך במערכת</p>
              </div>
            </div>

            <div className={`p-4 md:p-6 border-t ${darkMode ? 'border-[#2a3f5f]' : 'border-gray-200'} flex gap-3`}>
              <button
                onClick={() => {
                  setConnectionToEdit(null)
                  setEditDisplayName('')
                }}
                className={`flex-1 px-4 py-3 border rounded-lg transition-colors ${darkMode ? 'border-[#2a3f5f] text-white hover:bg-[#2a3f5f]' : 'border-gray-200 text-gray-900 hover:bg-gray-50'}`}
              >
                ביטול
              </button>
              <button
                onClick={saveDisplayName}
                disabled={savingName}
                className="flex-1 px-4 py-3 bg-[#25D366] rounded-lg text-white font-medium hover:bg-[#20bd5a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingName ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    שמור
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Connection Confirmation Modal */}
      <ConfirmModal
        isOpen={!!connectionToDisconnect}
        onClose={() => setConnectionToDisconnect(null)}
        onConfirm={confirmDisconnectConnection}
        title={`האם לנתק את ${connectionToDisconnect?.display_name || 'החיבור'}?`}
        subtitle="החיבור יישאר במערכת וניתן יהיה לחבר מחדש"
        confirmText={disconnecting ? 'מנתק...' : 'כן, נתק'}
        cancelText="לא, בטל"
        variant="default"
      />

      {/* Delete Connection Confirmation Modal */}
      <ConfirmModal
        isOpen={!!connectionToDelete}
        onClose={() => setConnectionToDelete(null)}
        onConfirm={confirmDeleteConnection}
        title={`האם למחוק את ${connectionToDelete?.display_name || 'החיבור'}?`}
        subtitle="פעולה זו תמחק את החיבור לצמיתות מהמערכת"
        confirmText="כן, מחק"
        cancelText="לא, בטל"
        variant="danger"
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  )
}
