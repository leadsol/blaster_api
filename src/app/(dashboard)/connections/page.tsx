'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
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
  Unplug,
  MoreVertical,
  Bell
} from 'lucide-react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { useTheme } from '@/contexts/ThemeContext'
import { ConfirmModal, AlertModal } from '@/components/modals'
import { formatPhoneForDisplay } from '@/lib/phone-utils'

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
  const router = useRouter()
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
  const [deleting, setDeleting] = useState(false)
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
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'name' | 'first_connected' | 'last_update' | 'status'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [connectionAlerts, setConnectionAlerts] = useState<Array<{
    id: string
    type: 'connected' | 'disconnected' | 'name_changed' | 'created' | 'deleted'
    connectionName: string
    timestamp: Date
    message: string
  }>>([])

  // Load alerts from localStorage on mount
  useEffect(() => {
    const savedAlerts = localStorage.getItem('connectionAlerts')
    if (savedAlerts) {
      try {
        const parsed = JSON.parse(savedAlerts)
        // Convert timestamp strings back to Date objects
        const alerts = parsed.map((alert: { id: string; type: string; connectionName: string; timestamp: string; message: string }) => ({
          ...alert,
          timestamp: new Date(alert.timestamp)
        }))
        setConnectionAlerts(alerts)
      } catch (e) {
        console.error('Error loading alerts from localStorage:', e)
      }
    }
  }, [])

  // Save alerts to localStorage when they change
  useEffect(() => {
    if (connectionAlerts.length > 0) {
      localStorage.setItem('connectionAlerts', JSON.stringify(connectionAlerts))
    }
  }, [connectionAlerts])

  useEffect(() => {
    loadConnections()
  }, [])

  // Realtime subscription for connection status updates - stable subscription
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
          logger.debug('Realtime update received:', payload)

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
            // Add alert for new connection
            setConnectionAlerts(prev => [{
              id: `${newConnection.id}-${Date.now()}`,
              type: 'created' as const,
              connectionName: newConnection.display_name || 'חיבור חדש',
              timestamp: new Date(),
              message: `חיבור "${newConnection.display_name || 'חיבור חדש'}" נוצר`
            }, ...prev].slice(0, 10)) // Keep max 10 alerts
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Connection
            const old = payload.old as Partial<Connection>

            logger.debug('Connection updated:', updated.id, 'status:', updated.status)

            // Update the connection in state
            setConnections(prev =>
              prev.map(c => c.id === updated.id ? updated : c)
            )

            // Add alerts for status changes
            if (old.status !== updated.status) {
              if (updated.status === 'connected') {
                setConnectionAlerts(prev => [{
                  id: `${updated.id}-${Date.now()}`,
                  type: 'connected' as const,
                  connectionName: updated.display_name || 'חיבור',
                  timestamp: new Date(),
                  message: `"${updated.display_name || 'החיבור'}" התחבר בהצלחה`
                }, ...prev].slice(0, 10))
              } else if (updated.status === 'disconnected') {
                setConnectionAlerts(prev => [{
                  id: `${updated.id}-${Date.now()}`,
                  type: 'disconnected' as const,
                  connectionName: updated.display_name || 'חיבור',
                  timestamp: new Date(),
                  message: `"${updated.display_name || 'החיבור'}" התנתק`
                }, ...prev].slice(0, 10))
              }
            }

            // Add alert for name change
            if (old.display_name !== updated.display_name && old.display_name) {
              setConnectionAlerts(prev => [{
                id: `${updated.id}-${Date.now()}`,
                type: 'name_changed' as const,
                connectionName: updated.display_name || 'חיבור',
                timestamp: new Date(),
                message: `שם שונה מ-"${old.display_name}" ל-"${updated.display_name}"`
              }, ...prev].slice(0, 10))
            }
          } else if (payload.eventType === 'DELETE') {
            // Connection deleted
            const deletedConnection = payload.old as Connection
            setConnections(prev => prev.filter(c => c.id !== deletedConnection.id))
            // Add alert for deleted connection
            setConnectionAlerts(prev => [{
              id: `${deletedConnection.id}-${Date.now()}`,
              type: 'deleted' as const,
              connectionName: deletedConnection.display_name || 'חיבור',
              timestamp: new Date(),
              message: `"${deletedConnection.display_name || 'חיבור'}" נמחק`
            }, ...prev].slice(0, 10))
          }
        }
      )
      .subscribe((status, err) => {
        logger.debug('Connections page realtime subscription status:', status, err)
      })

    // Cleanup subscription on unmount
    return () => {
      logger.debug('Cleaning up connections realtime subscription')
      supabase.removeChannel(channel)
    }
  }, []) // Empty deps - stable subscription

  // Handle modal state changes for connection success/failure
  useEffect(() => {
    if (!currentSessionId) return

    // Find current connection status
    const currentConnection = connections.find(c => c.id === currentSessionId)
    if (!currentConnection) return

    if ((step === 2 || showQRModal) && currentConnection.status === 'connected') {
      setConnectionSuccess(true)
      setConnectionFailed(false)
      setSuccessConnectionName(currentConnection.display_name || 'החיבור')
      setQrCode('')
      setLinkCode('')
    }
  }, [connections, currentSessionId, step, showQRModal])

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

      // Create session in WAHA with auto-generated name and display name in metadata
      const wahaResponse = await fetch('/api/waha/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: wahaSessionName, displayName: displayName.trim() }),
      })

      const wahaData = await wahaResponse.json()
      logger.debug('WAHA response:', wahaData)

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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'שגיאה לא ידועה'
      console.error('Error creating connection:', errorMessage)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה ביצירת החיבור',
        message: errorMessage,
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
        logger.debug(`QR not ready, retrying in 2 seconds... (${retries} retries left)`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        return fetchQRCode(sessionName, retries - 1)
      }

      logger.debug('QR not available after retries:', data)
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
        logger.debug('Waiting for session to be ready...')
        await new Promise(resolve => setTimeout(resolve, 3000))

        // Check if session is ready
        const statusResponse = await fetch(`/api/waha/sessions/${sessionName}/status`)
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          logger.debug('Session status:', statusData.status)
          if (statusData.status !== 'SCAN_QR_CODE' && statusData.status !== 'WORKING') {
            // Session not ready yet, wait more
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      }

      // Format phone number to international format (Israeli: 05X → 9725X)
      const cleanPhone = formatIsraeliPhone(phoneNumber)
      logger.debug(`Requesting code for phone: ${cleanPhone}`)

      const response = await fetch(`/api/waha/sessions/${sessionName}/auth/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: cleanPhone }),
      })

      const data = await response.json()
      logger.debug('Request code response:', data)

      if (response.ok && data.code) {
        setLinkCode(data.code)
        return true
      }

      // If not ready yet and we have retries left, wait and try again
      if (retries > 0) {
        logger.debug(`Code not ready, retrying in 3 seconds... (${retries} retries left)`)
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
        logger.debug('Session status before code request:', statusData.status)

        // Session needs to be in SCAN_QR_CODE state to request pairing code
        if (statusData.status !== 'SCAN_QR_CODE') {
          needsRestart = true
        }
      } else {
        needsRestart = true
      }

      // If session is not ready, restart it
      if (needsRestart) {
        logger.debug('Restarting session to get pairing code...')
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
            logger.debug(`Session status check ${attempts + 1}:`, checkData.status)
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
      logger.debug(`Requesting code for phone: ${cleanPhone}`)

      const response = await fetch(`/api/waha/sessions/${connectionToRequestCode.session_name}/auth/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: cleanPhone }),
      })

      const data = await response.json()
      logger.debug('Code request response:', data)

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

    setDeleting(true)
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
    } finally {
      setDeleting(false)
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
      const supabase = createClient()

      // Call WAHA logout endpoint
      const response = await fetch(`/api/waha/sessions/${connectionToDisconnect.session_name}/logout`, {
        method: 'POST',
      })

      // Even if WAHA returns an error (e.g., session already logged out or doesn't exist),
      // we should still update our database to mark it as disconnected
      if (!response.ok) {
        console.warn(`WAHA logout returned ${response.status}, proceeding with local update`)
      }

      // Update status in database regardless of WAHA response
      await supabase.from('connections').update({
        status: 'disconnected',
        phone_number: null,
      }).eq('id', connectionToDisconnect.id)

      setConnections(prev => prev.map(c =>
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
    const oldName = connectionToEdit.display_name || 'חיבור WhatsApp'
    const newName = editDisplayName.trim() || 'חיבור WhatsApp'
    const now = new Date()

    try {
      const supabase = createClient()

      // Update in database with updated_at
      await supabase.from('connections').update({
        display_name: editDisplayName.trim() || null,
        updated_at: now.toISOString(),
      }).eq('id', connectionToEdit.id)

      // Update WAHA metadata with display name
      if (connectionToEdit.session_name) {
        await fetch(`/api/waha/sessions/${connectionToEdit.session_name}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metadata: { displayName: editDisplayName.trim() }
          }),
        })
      }

      setConnections(connections.map(c =>
        c.id === connectionToEdit.id
          ? { ...c, display_name: editDisplayName.trim() || null, updated_at: now.toISOString() }
          : c
      ))

      // Add alert to log
      if (oldName !== newName) {
        setConnectionAlerts(prev => [{
          id: `name-${connectionToEdit.id}-${Date.now()}`,
          type: 'name_changed' as const,
          connectionName: newName,
          timestamp: now,
          message: `שם החיבור שונה מ-"${oldName}" ל-"${newName}"`
        }, ...prev].slice(0, 50))
      }

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
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <h1 className={`text-lg sm:text-xl lg:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>החיבורים שלך</h1>
        <p className={`text-xs sm:text-sm lg:text-base ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>נהל את חיבורי WhatsApp</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        {/* Status Card - Full width on mobile, side on desktop */}
        <div className="lg:col-span-4 order-2 lg:order-2 lg:sticky lg:top-6 lg:h-[calc(100vh-180px)] flex flex-col">
          <div className={`${darkMode ? 'bg-[#1a2942] border-[#2a3f5f]' : 'bg-white'} rounded-[15px] p-3 md:p-4 flex-shrink-0`}>
            <h3 className={`text-center text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>סטטוס החיבורים שלך</h3>
            <div className="flex items-center justify-center mb-4">
              <div className="relative w-32 h-32 md:w-36 md:h-36">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background circle - Gray for disconnected */}
                  <circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    stroke="#EAEAEA"
                    strokeWidth="8"
                  />
                  {/* Foreground circle - Green for connected */}
                  <circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    stroke="#187C55"
                    strokeWidth="8"
                    strokeDasharray={`${(connectedCount / Math.max(totalCount, 1)) * 264} 264`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-[24px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{connectedCount}/{totalCount}</span>
                  <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-[#030733]'}`}>מכשירים מחוברים</span>
                </div>
              </div>
            </div>

            {/* Expand Package Button */}
            <button className="w-full h-10 bg-[#030733] text-white rounded-[8px] font-semibold text-sm hover:bg-[#1a1a4a] transition-colors">
              הרחב חבילה
            </button>
          </div>

          {/* Connection Alerts Log */}
          <div className={`${darkMode ? 'bg-[#1a2942] border-[#2a3f5f]' : 'bg-white'} rounded-[15px] p-4 mt-4 flex-1 min-h-0 flex flex-col`}>
            <h3 className={`text-center text-xl font-semibold mb-4 flex-shrink-0 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>התראות</h3>
            <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
              {connectionAlerts.length === 0 ? (
                <p className={`text-sm text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  אין התראות עדיין
                </p>
              ) : (
                connectionAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 ${darkMode ? 'bg-[#0f172a]' : 'bg-[#F2F3F8]'} rounded-lg`}
                  >
                    <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#030733]'}`}>
                      {alert.message}
                    </p>
                    <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {format(alert.timestamp, 'HH:mm dd/MM', { locale: he })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Connections List */}
        <div className="lg:col-span-8 order-1 lg:order-1">
          {/* Header Row */}
          <div className={`hidden md:flex items-center justify-between px-4 py-2 mb-2 ${darkMode ? 'text-gray-400' : 'text-[#030733]'}`}>
            <div className="flex items-center gap-2 w-[180px] flex-shrink-0">
              <div className="w-5 flex-shrink-0"></div>
              <button
                onClick={() => {
                  if (sortField === 'name') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                  } else {
                    setSortField('name')
                    setSortDirection('asc')
                  }
                }}
                className="text-sm font-normal flex items-center gap-1 hover:opacity-70 transition-opacity"
              >
                שם הקונקשן
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform ${sortField === 'name' && sortDirection === 'desc' ? 'rotate-180' : ''}`}>
                  <path d="M10.5625 4.46875L6.5 8.53125L2.4375 4.46875" stroke="currentColor" strokeWidth="0.8125" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-8">
              <button
                onClick={() => {
                  if (sortField === 'first_connected') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                  } else {
                    setSortField('first_connected')
                    setSortDirection('asc')
                  }
                }}
                className="text-sm font-normal w-[90px] flex items-center justify-center gap-1 whitespace-nowrap hover:opacity-70 transition-opacity"
              >
                חיבור ראשוני
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform ${sortField === 'first_connected' && sortDirection === 'desc' ? 'rotate-180' : ''}`}>
                  <path d="M10.5625 4.46875L6.5 8.53125L2.4375 4.46875" stroke="currentColor" strokeWidth="0.8125" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                onClick={() => {
                  if (sortField === 'last_update') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                  } else {
                    setSortField('last_update')
                    setSortDirection('asc')
                  }
                }}
                className="text-sm font-normal w-[120px] flex items-center justify-center gap-1 whitespace-nowrap hover:opacity-70 transition-opacity"
              >
                עדכון אחרון
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform ${sortField === 'last_update' && sortDirection === 'desc' ? 'rotate-180' : ''}`}>
                  <path d="M10.5625 4.46875L6.5 8.53125L2.4375 4.46875" stroke="currentColor" strokeWidth="0.8125" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                onClick={() => {
                  if (sortField === 'status') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                  } else {
                    setSortField('status')
                    setSortDirection('asc')
                  }
                }}
                className="text-sm font-normal w-[110px] flex items-center justify-center gap-1 hover:opacity-70 transition-opacity"
              >
                סטטוס
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform ${sortField === 'status' && sortDirection === 'desc' ? 'rotate-180' : ''}`}>
                  <path d="M10.5625 4.46875L6.5 8.53125L2.4375 4.46875" stroke="currentColor" strokeWidth="0.8125" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <span className="text-sm font-normal">פעולות</span>
          </div>

          {/* Desktop Rows */}
          <div className="hidden md:block space-y-2">
            {loading ? (
              <div className={`p-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </div>
            ) : connections.length === 0 ? (
              <div className="p-12 text-center">
                <div className={`w-16 h-16 ${darkMode ? 'bg-[#2a3f5f]' : 'bg-gray-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                  <Smartphone className={`w-8 h-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>
                <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>אין חיבורים עדיין</h3>
                <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>חבר את WhatsApp שלך כדי להתחיל לשלוח הודעות</p>
                <button
                  onClick={() => router.push('/connections/new')}
                  className="inline-flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-lg hover:bg-[#20bd5a] transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  הוסף חיבור ראשון
                </button>
              </div>
            ) : (
              [...connections].sort((a, b) => {
                let aVal: string | number = ''
                let bVal: string | number = ''

                switch (sortField) {
                  case 'name':
                    aVal = (a.display_name || 'חיבור WhatsApp').toLowerCase()
                    bVal = (b.display_name || 'חיבור WhatsApp').toLowerCase()
                    break
                  case 'first_connected':
                    aVal = a.first_connected_at || a.created_at || ''
                    bVal = b.first_connected_at || b.created_at || ''
                    break
                  case 'last_update':
                    const aLastSeen = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0
                    const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : 0
                    const bLastSeen = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0
                    const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0
                    aVal = Math.max(aLastSeen, aUpdated).toString()
                    bVal = Math.max(bLastSeen, bUpdated).toString()
                    break
                  case 'status':
                    aVal = a.status
                    bVal = b.status
                    break
                }

                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
                return 0
              }).map((connection) => (
                <div
                  key={connection.id}
                  className={`flex items-center justify-between px-4 h-[58px] rounded-lg ${darkMode ? 'bg-[#1a2942] hover:bg-[#1a2942]/80' : 'bg-white hover:bg-gray-50'}`}
                >
                  {/* צד ימין - צ'קבוקס + שם */}
                  <div className="flex items-center gap-2 w-[180px] flex-shrink-0">
                    <input
                      type="checkbox"
                      className={`w-4 h-4 rounded border flex-shrink-0 ${darkMode ? 'border-gray-600 bg-transparent' : 'border-gray-300'}`}
                    />
                    <p className={`font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {(connection.display_name || 'חיבור WhatsApp').slice(0, 20)}
                    </p>
                  </div>

                  {/* אמצע - תאריכים וסטטוס */}
                  <div className="flex items-center gap-8">
                    <span className={`text-sm w-[90px] text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {connection.first_connected_at
                        ? format(new Date(connection.first_connected_at), 'dd/MM/yyyy', { locale: he })
                        : connection.created_at
                        ? format(new Date(connection.created_at), 'dd/MM/yyyy', { locale: he })
                        : '-'}
                    </span>

                    <span className={`text-sm w-[120px] text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {(() => {
                        const lastSeen = connection.last_seen_at ? new Date(connection.last_seen_at) : null
                        const lastUpdated = connection.updated_at ? new Date(connection.updated_at) : null
                        const latestDate = lastSeen && lastUpdated
                          ? (lastSeen > lastUpdated ? lastSeen : lastUpdated)
                          : (lastSeen || lastUpdated)
                        return latestDate
                          ? format(latestDate, 'dd/MM/yyyy HH:mm', { locale: he })
                          : '-'
                      })()}
                    </span>

                    <span className={`inline-flex items-center justify-center w-[110px] px-2 py-1.5 rounded text-sm font-semibold ${
                      connection.status === 'connected'
                        ? 'bg-[#187C55] text-white'
                        : connection.status === 'disconnected'
                        ? 'bg-[#CD1B1B] text-white'
                        : connection.status === 'qr_pending'
                        ? 'bg-blue-500 text-white'
                        : 'bg-yellow-500 text-white'
                    }`}>
                      {statusLabels[connection.status]}
                    </span>
                  </div>

                  {/* צד שמאל - פעולות */}
                  <div className="relative">
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === connection.id ? null : connection.id)}
                        className={`p-2 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-[#2a3f5f]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'} rounded-lg transition-colors`}
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {/* Dropdown Menu */}
                      {openDropdownId === connection.id && (
                        <>
                          {/* Backdrop to close dropdown */}
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenDropdownId(null)}
                          />
                          <div className={`absolute left-0 top-full mt-1 w-48 ${darkMode ? 'bg-[#1a2942] border-[#2a3f5f]' : 'bg-white border-gray-200'} border rounded-lg shadow-lg z-20`}>
                            <div className="py-1">
                              {/* רענן סטטוס */}
                              <button
                                onClick={() => {
                                  refreshConnection(connection)
                                  setOpenDropdownId(null)
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-[#2a3f5f]' : 'text-gray-700 hover:bg-gray-100'}`}
                              >
                                <RefreshCw className="w-4 h-4" />
                                רענן סטטוס
                              </button>

                              {/* ערוך שם */}
                              <button
                                onClick={() => {
                                  openEditModal(connection)
                                  setOpenDropdownId(null)
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-[#2a3f5f]' : 'text-gray-700 hover:bg-gray-100'}`}
                              >
                                <Pencil className="w-4 h-4" />
                                ערוך שם
                              </button>

                              {/* הצג QR - רק אם לא מחובר */}
                              {connection.status !== 'connected' && (
                                <button
                                  onClick={() => {
                                    setOpenDropdownId(null)
                                    router.push(`/connections/new/qr?session=${connection.session_name}&connectionId=${connection.id}`)
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-[#2a3f5f]' : 'text-gray-700 hover:bg-gray-100'}`}
                                >
                                  <QrCode className="w-4 h-4" />
                                  הצג QR
                                </button>
                              )}

                              {/* בקש קוד - רק אם לא מחובר */}
                              {connection.status !== 'connected' && (
                                <button
                                  onClick={() => {
                                    setOpenDropdownId(null)
                                    router.push(`/connections/new/code?session=${connection.session_name}&connectionId=${connection.id}`)
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-[#2a3f5f]' : 'text-gray-700 hover:bg-gray-100'}`}
                                >
                                  <Link2 className="w-4 h-4" />
                                  בקש קוד
                                </button>
                              )}

                              {/* שלח QR - רק אם לא מחובר */}
                              {connection.status !== 'connected' && (
                                <button
                                  onClick={() => {
                                    setOpenDropdownId(null)
                                    router.push(`/connections/new/send?session=${connection.session_name}&connectionId=${connection.id}`)
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-[#2a3f5f]' : 'text-gray-700 hover:bg-gray-100'}`}
                                >
                                  <Send className="w-4 h-4" />
                                  שלח QR
                                </button>
                              )}

                              {/* נתק חיבור - רק אם מחובר */}
                              {connection.status === 'connected' && (
                                <button
                                  onClick={() => {
                                    disconnectConnection(connection)
                                    setOpenDropdownId(null)
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${darkMode ? 'text-orange-400 hover:bg-orange-500/10' : 'text-orange-600 hover:bg-orange-50'}`}
                                >
                                  <Unplug className="w-4 h-4" />
                                  נתק חיבור
                                </button>
                              )}

                              {/* מחק חיבור */}
                              <button
                                onClick={() => {
                                  deleteConnection(connection)
                                  setOpenDropdownId(null)
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${darkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}
                              >
                                <Trash2 className="w-4 h-4" />
                                מחק חיבור
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                  </div>
                </div>
              ))
            )}
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
                  onClick={() => router.push('/connections/new')}
                  className="inline-flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-lg"
                >
                  <Plus className="w-5 h-5" />
                  הוסף חיבור
                </button>
              </div>
            ) : (
              <div className={`divide-y ${darkMode ? 'divide-[#2a3f5f]' : 'divide-gray-100'}`}>
                {connections.map((connection) => (
                  <div key={connection.id} className={`p-4 ${darkMode ? 'bg-[#1a2942]' : 'bg-white'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className={`w-4 h-4 rounded border ${darkMode ? 'border-gray-600 bg-transparent' : 'border-gray-300'}`}
                        />
                        <div>
                          <p className={`font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                            {connection.display_name || 'חיבור WhatsApp'}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded text-xs font-semibold ${
                        connection.status === 'connected'
                          ? 'bg-[#187C55] text-white'
                          : connection.status === 'disconnected'
                          ? 'bg-[#CD1B1B] text-white'
                          : 'bg-blue-500 text-white'
                      }`}>
                        {statusLabels[connection.status]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-[#454545]'}`}>
                        {connection.first_connected_at
                          ? format(new Date(connection.first_connected_at), 'dd/MM/yyyy', { locale: he })
                          : connection.created_at
                          ? format(new Date(connection.created_at), 'dd/MM/yyyy', { locale: he })
                          : 'לא חובר עדיין'}
                      </span>
                      {/* 3 dots menu for mobile */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === `mobile-${connection.id}` ? null : `mobile-${connection.id}`)}
                          className={`p-2 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} rounded-lg`}
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>

                        {/* Mobile Dropdown Menu */}
                        {openDropdownId === `mobile-${connection.id}` && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenDropdownId(null)}
                            />
                            <div className={`absolute left-0 top-full mt-1 w-48 ${darkMode ? 'bg-[#1a2942] border-[#2a3f5f]' : 'bg-white border-gray-200'} border rounded-lg shadow-lg z-20`}>
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    refreshConnection(connection)
                                    setOpenDropdownId(null)
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-[#2a3f5f]' : 'text-gray-700 hover:bg-gray-100'}`}
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  רענן סטטוס
                                </button>
                                <button
                                  onClick={() => {
                                    openEditModal(connection)
                                    setOpenDropdownId(null)
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-[#2a3f5f]' : 'text-gray-700 hover:bg-gray-100'}`}
                                >
                                  <Pencil className="w-4 h-4" />
                                  ערוך שם
                                </button>
                                {connection.status !== 'connected' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setOpenDropdownId(null)
                                        router.push(`/connections/new/qr?session=${connection.session_name}&connectionId=${connection.id}`)
                                      }}
                                      className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-[#2a3f5f]' : 'text-gray-700 hover:bg-gray-100'}`}
                                    >
                                      <QrCode className="w-4 h-4" />
                                      הצג QR
                                    </button>
                                    <button
                                      onClick={() => {
                                        setOpenDropdownId(null)
                                        router.push(`/connections/new/code?session=${connection.session_name}&connectionId=${connection.id}`)
                                      }}
                                      className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-[#2a3f5f]' : 'text-gray-700 hover:bg-gray-100'}`}
                                    >
                                      <Link2 className="w-4 h-4" />
                                      בקש קוד
                                    </button>
                                    <button
                                      onClick={() => {
                                        setOpenDropdownId(null)
                                        router.push(`/connections/new/send?session=${connection.session_name}&connectionId=${connection.id}`)
                                      }}
                                      className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-[#2a3f5f]' : 'text-gray-700 hover:bg-gray-100'}`}
                                    >
                                      <Send className="w-4 h-4" />
                                      שלח QR
                                    </button>
                                  </>
                                )}
                                {connection.status === 'connected' && (
                                  <button
                                    onClick={() => {
                                      disconnectConnection(connection)
                                      setOpenDropdownId(null)
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${darkMode ? 'text-orange-400 hover:bg-orange-500/10' : 'text-orange-600 hover:bg-orange-50'}`}
                                  >
                                    <Unplug className="w-4 h-4" />
                                    נתק חיבור
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    deleteConnection(connection)
                                    setOpenDropdownId(null)
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm ${darkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  מחק חיבור
                                </button>
                              </div>
                            </div>
                          </>
                        )}
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
              onClick={() => router.push('/connections/new')}
              className="w-12 h-12 bg-[#030733] rounded-full flex items-center justify-center text-white hover:bg-[#1a1a4a] transition-colors shadow-lg"
            >
              <Plus className="w-6 h-6" />
            </button>
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
                      maxLength={20}
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
                        /* eslint-disable-next-line @next/next/no-img-element */
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
                    /* eslint-disable-next-line @next/next/no-img-element */
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
                        {formatPhoneForDisplay(connectionToEdit.phone_number)}
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
                  maxLength={20}
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
        onClose={() => !deleting && setConnectionToDelete(null)}
        onConfirm={confirmDeleteConnection}
        title={`האם למחוק את ${connectionToDelete?.display_name || 'החיבור'}?`}
        subtitle="פעולה זו תמחק את החיבור לצמיתות מהמערכת"
        confirmText={deleting ? 'מוחק...' : 'כן, מחק'}
        cancelText="לא, בטל"
        variant="danger"
        loading={deleting}
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
