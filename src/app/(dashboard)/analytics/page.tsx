'use client'

import React, { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Loader2, Search, ChevronDown, Clock,
  Trash2, Copy, Download, MessageCircle,
  SlidersHorizontal, CheckCheck, Check, X, StopCircle, Play, Pencil
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { ConfirmModal, AlertModal } from '@/components/modals'

interface CampaignStats {
  id: string
  name: string
  sent_count: number
  delivered_count: number
  read_count: number
  reply_count: number
  failed_count?: number
  status: string
  scheduled_at?: string
  started_at?: string
  total_recipients: number
  estimated_duration?: number // in seconds
}

interface Recipient {
  id: string
  phone: string
  name?: string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'replied' | 'failed' | 'cancelled'
  sent_at?: string
  created_at?: string
  message_content?: string
  sent_message_content?: string // The actual message that was sent (after variation selection)
  sender_session_name?: string // The session/device name that sent this message
  sender_phone?: string // The phone number of the sender
  variables?: Record<string, string>
  error_message?: string
}

interface Connection {
  id: string
  session_name: string
  phone_number: string | null
  display_name: string | null
  status: 'connected' | 'disconnected' | 'connecting' | 'qr_pending'
}

function AnalyticsContent() {
  const { darkMode } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const campaignIdFromUrl = searchParams.get('campaign')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignStats | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [recipientsLoading, setRecipientsLoading] = useState(false)
  const [checkedCampaigns, setCheckedCampaigns] = useState<Set<string>>(new Set())
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [showConnectionDropdown, setShowConnectionDropdown] = useState(false)
  const [countdown, setCountdown] = useState<string | null>(null)

  // Modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message?: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ isOpen: false, title: '', type: 'info' })

  const statusFilters = [
    { key: 'custom', label: "תאריך מותאם אישית: 'לא נבחר כלום'" },
    { key: 'completed', label: 'הושלם' },
    { key: 'scheduled', label: 'מתוזמן' },
    { key: 'failed', label: 'נכשל' },
    { key: 'running', label: 'פעיל' },
    { key: 'draft', label: 'טיוטה' },
    { key: 'all', label: 'הכל' },
  ]

  useEffect(() => {
    loadData()
  }, [])

  // Realtime subscription for campaigns and messages updates
  useEffect(() => {
    const supabase = createClient()

    // Subscribe to campaign changes (status updates, counts)
    const campaignsChannel = supabase
      .channel('campaigns-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns'
        },
        (payload) => {
          console.log('[Analytics] Campaign realtime update:', payload.eventType, payload.new)

          if (payload.eventType === 'INSERT') {
            const newCampaign = payload.new as CampaignStats
            setCampaigns(prev => [newCampaign, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as CampaignStats
            setCampaigns(prev =>
              prev.map(c => c.id === updated.id ? updated : c)
            )
            // Also update selectedCampaign if it's the one being updated
            if (selectedCampaign?.id === updated.id) {
              setSelectedCampaign(updated)
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id
            setCampaigns(prev => prev.filter(c => c.id !== deletedId))
            if (selectedCampaign?.id === deletedId) {
              setSelectedCampaign(null)
              setRecipients([])
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[Analytics] Campaigns channel status:', status)
      })

    return () => {
      supabase.removeChannel(campaignsChannel)
    }
  }, [selectedCampaign])

  // Helper function to sort recipients by send order (most recent first)
  const sortRecipients = (recipientsList: Recipient[]): Recipient[] => {
    return [...recipientsList].sort((a, b) => {
      // Sort by sent_at first (most recent sent at top), then by created_at
      const aTime = a.sent_at || a.created_at || ''
      const bTime = b.sent_at || b.created_at || ''
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })
  }

  // Realtime subscription for recipients (campaign_messages) of selected campaign
  useEffect(() => {
    if (!selectedCampaign) return

    const supabase = createClient()
    const campaignId = selectedCampaign.id

    const messagesChannel = supabase
      .channel(`messages-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_messages',
          filter: `campaign_id=eq.${campaignId}`
        },
        (payload) => {
          console.log('Message realtime update:', payload)

          if (payload.eventType === 'INSERT') {
            const newRecipient = payload.new as Recipient
            setRecipients(prev => sortRecipients([...prev, newRecipient]))
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Recipient
            setRecipients(prev => {
              const newList = prev.map(r => r.id === updated.id ? updated : r)
              return sortRecipients(newList)
            })
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id
            setRecipients(prev => prev.filter(r => r.id !== deletedId))
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Analytics] Messages channel status for ${campaignId}:`, status)
      })

    return () => {
      supabase.removeChannel(messagesChannel)
    }
  }, [selectedCampaign?.id])

  // Select campaign from URL parameter
  useEffect(() => {
    if (campaignIdFromUrl && campaigns.length > 0 && !selectedCampaign) {
      const campaignFromUrl = campaigns.find(c => c.id === campaignIdFromUrl)
      if (campaignFromUrl) {
        setSelectedCampaign(campaignFromUrl)
      }
    }
  }, [campaignIdFromUrl, campaigns, selectedCampaign])

  useEffect(() => {
    if (selectedCampaign) {
      loadRecipients(selectedCampaign.id)
    }
  }, [selectedCampaign])

  // Countdown timer for running campaigns
  useEffect(() => {
    if (!selectedCampaign || selectedCampaign.status !== 'running' || !selectedCampaign.started_at || !selectedCampaign.estimated_duration) {
      setCountdown(null)
      return
    }

    const calculateCountdown = () => {
      const startTime = new Date(selectedCampaign.started_at!).getTime()
      const estimatedEndTime = startTime + (selectedCampaign.estimated_duration! * 1000)
      const now = Date.now()
      const remainingMs = estimatedEndTime - now

      if (remainingMs <= 0) {
        setCountdown('מסיים...')
        return
      }

      const hours = Math.floor(remainingMs / 3600000)
      const minutes = Math.floor((remainingMs % 3600000) / 60000)
      const seconds = Math.floor((remainingMs % 60000) / 1000)

      if (hours > 0) {
        setCountdown(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      } else {
        setCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`)
      }
    }

    calculateCountdown()
    const interval = setInterval(calculateCountdown, 1000)

    return () => clearInterval(interval)
  }, [selectedCampaign?.id, selectedCampaign?.status, selectedCampaign?.started_at, selectedCampaign?.estimated_duration])

  const loadData = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    // Load connections
    const { data: connectionsData } = await supabase
      .from('connections')
      .select('id, session_name, phone_number, display_name, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (connectionsData && connectionsData.length > 0) {
      setConnections(connectionsData)
      // Select first connected one, or first one if none connected
      const connectedOne = connectionsData.find(c => c.status === 'connected') || connectionsData[0]
      setSelectedConnection(connectedOne)
    }

    // Load campaigns with failed_count, started_at, and estimated_duration
    const { data: campaignsData, error } = await supabase
      .from('campaigns')
      .select('id, name, status, sent_count, delivered_count, read_count, reply_count, failed_count, total_recipients, scheduled_at, started_at, estimated_duration')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && campaignsData) {
      setCampaigns(campaignsData)
    }

    setLoading(false)
  }

  const loadRecipients = async (campaignId: string) => {
    setRecipientsLoading(true)
    const supabase = createClient()
    // Load ALL recipients (not limited) to get accurate counts
    // Sort by created_at to maintain order, and put sent messages with time first
    const { data } = await supabase
      .from('campaign_messages')
      .select('id, phone, name, status, sent_at, message_content, sent_message_content, sender_session_name, sender_phone, variables, error_message, created_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })

    if (data) {
      // Sort by send order - most recent sent/processed first
      const sorted = [...data].sort((a, b) => {
        const aTime = a.sent_at || a.created_at
        const bTime = b.sent_at || b.created_at
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })
      setRecipients(sorted)
    }
    setRecipientsLoading(false)
  }

  const handleDeleteCampaign = () => {
    // Check if we have checked campaigns (bulk delete) or just selected campaign
    const campaignsToDelete = checkedCampaigns.size > 0
      ? campaigns.filter(c => checkedCampaigns.has(c.id))
      : selectedCampaign ? [selectedCampaign] : []

    if (campaignsToDelete.length === 0) return

    // Check if any campaign is running
    const runningCampaigns = campaignsToDelete.filter(c => c.status === 'running')
    if (runningCampaigns.length > 0) {
      setAlertModal({
        isOpen: true,
        title: 'לא ניתן למחוק קמפיין פעיל',
        message: runningCampaigns.length === 1
          ? 'עצור את הקמפיין קודם'
          : `יש ${runningCampaigns.length} קמפיינים פעילים - עצור אותם קודם`,
        type: 'warning'
      })
      return
    }

    setShowDeleteConfirm(true)
  }

  const confirmDeleteCampaign = async () => {
    // Get campaigns to delete - checked ones or selected one
    const campaignIdsToDelete = checkedCampaigns.size > 0
      ? Array.from(checkedCampaigns)
      : selectedCampaign ? [selectedCampaign.id] : []

    if (campaignIdsToDelete.length === 0) return
    setShowDeleteConfirm(false)

    setDeleting(true)
    try {
      // Delete all campaigns
      const deletePromises = campaignIdsToDelete.map(id =>
        fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      )

      const results = await Promise.all(deletePromises)
      const failedDeletes = results.filter(r => !r.ok)

      if (failedDeletes.length === 0) {
        // All deleted successfully
        setCampaigns(prev => prev.filter(c => !campaignIdsToDelete.includes(c.id)))
        setCheckedCampaigns(new Set())
        if (selectedCampaign && campaignIdsToDelete.includes(selectedCampaign.id)) {
          setSelectedCampaign(null)
          setRecipients([])
        }
      } else if (failedDeletes.length < campaignIdsToDelete.length) {
        // Some deleted, some failed
        const successfulIds = campaignIdsToDelete.filter((_, i) => results[i].ok)
        setCampaigns(prev => prev.filter(c => !successfulIds.includes(c.id)))
        setCheckedCampaigns(prev => {
          const newSet = new Set(prev)
          successfulIds.forEach(id => newSet.delete(id))
          return newSet
        })
        setAlertModal({
          isOpen: true,
          title: 'חלק מהקמפיינים נמחקו',
          message: `${successfulIds.length} נמחקו, ${failedDeletes.length} נכשלו`,
          type: 'warning'
        })
      } else {
        // All failed
        setAlertModal({
          isOpen: true,
          title: 'שגיאה במחיקת הקמפיינים',
          message: 'אירעה שגיאה, נסה שוב',
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Delete error:', error)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה במחיקת הקמפיינים',
        message: 'אירעה שגיאה, נסה שוב',
        type: 'error'
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleDuplicateCampaign = async () => {
    if (!selectedCampaign) return

    // Redirect to new campaign page with duplicate parameter
    router.push(`/campaigns/new?duplicate=${selectedCampaign.id}`)
  }

  const handleEditCampaign = () => {
    if (!selectedCampaign) return

    // Only drafts can be edited
    if (selectedCampaign.status !== 'draft') {
      setAlertModal({
        isOpen: true,
        title: 'לא ניתן לערוך קמפיין זה',
        message: 'ניתן לערוך רק קמפיינים בסטטוס טיוטה',
        type: 'warning'
      })
      return
    }

    // Redirect to new campaign page with edit parameter
    router.push(`/campaigns/new?edit=${selectedCampaign.id}`)
  }

  const handleCancelCampaign = () => {
    if (!selectedCampaign) return

    if (!['running', 'paused', 'scheduled'].includes(selectedCampaign.status)) {
      setAlertModal({
        isOpen: true,
        title: 'לא ניתן לבטל קמפיין זה',
        message: 'ניתן לבטל רק קמפיינים פעילים, מושהים או מתוזמנים',
        type: 'warning'
      })
      return
    }

    setShowCancelConfirm(true)
  }

  const confirmCancelCampaign = async () => {
    if (!selectedCampaign) return
    setShowCancelConfirm(false)

    try {
      const response = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' })
      })

      if (response.ok) {
        setCampaigns(prev => prev.map(c =>
          c.id === selectedCampaign.id ? { ...c, status: 'failed' } : c
        ))
        setSelectedCampaign({ ...selectedCampaign, status: 'failed' })
        setAlertModal({
          isOpen: true,
          title: 'הקמפיין בוטל בהצלחה',
          type: 'success'
        })
      } else {
        const data = await response.json()
        setAlertModal({
          isOpen: true,
          title: 'שגיאה בביטול הקמפיין',
          message: data.error || 'אירעה שגיאה, נסה שוב',
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Cancel error:', error)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה בביטול הקמפיין',
        message: 'אירעה שגיאה, נסה שוב',
        type: 'error'
      })
    }
  }

  const handlePauseCampaign = async () => {
    if (!selectedCampaign) return

    if (selectedCampaign.status !== 'running') {
      setAlertModal({
        isOpen: true,
        title: 'לא ניתן להשהות קמפיין זה',
        message: 'ניתן להשהות רק קמפיינים פעילים',
        type: 'warning'
      })
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' })
      })

      if (response.ok) {
        setCampaigns(prev => prev.map(c =>
          c.id === selectedCampaign.id ? { ...c, status: 'paused' } : c
        ))
        setSelectedCampaign({ ...selectedCampaign, status: 'paused' })
        setAlertModal({
          isOpen: true,
          title: 'הקמפיין הושהה',
          type: 'success'
        })
      } else {
        const data = await response.json()
        setAlertModal({
          isOpen: true,
          title: 'שגיאה בהשהיית הקמפיין',
          message: data.error || 'אירעה שגיאה, נסה שוב',
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Pause error:', error)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה בהשהיית הקמפיין',
        message: 'אירעה שגיאה, נסה שוב',
        type: 'error'
      })
    }
  }

  const handleResumeCampaign = async () => {
    if (!selectedCampaign) return

    if (selectedCampaign.status !== 'paused') {
      setAlertModal({
        isOpen: true,
        title: 'לא ניתן להמשיך קמפיין זה',
        message: 'ניתן להמשיך רק קמפיינים מושהים',
        type: 'warning'
      })
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' })
      })

      if (response.ok) {
        setCampaigns(prev => prev.map(c =>
          c.id === selectedCampaign.id ? { ...c, status: 'running' } : c
        ))
        setSelectedCampaign({ ...selectedCampaign, status: 'running' })
        setAlertModal({
          isOpen: true,
          title: 'הקמפיין ממשיך לרוץ',
          type: 'success'
        })
      } else {
        const data = await response.json()
        setAlertModal({
          isOpen: true,
          title: 'שגיאה בהמשכת הקמפיין',
          message: data.error || 'אירעה שגיאה, נסה שוב',
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Resume error:', error)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה בהמשכת הקמפיין',
        message: 'אירעה שגיאה, נסה שוב',
        type: 'error'
      })
    }
  }

  const handleExportCampaign = async () => {
    if (!selectedCampaign || recipients.length === 0) return

    // Create CSV content
    const headers = ['טלפון', 'שם', 'סטטוס', 'זמן שליחה', 'משתנים']
    const rows = recipients.map(r => [
      r.phone,
      r.name || '',
      r.status,
      r.sent_at ? new Date(r.sent_at).toLocaleString('he-IL') : '',
      r.variables ? JSON.stringify(r.variables) : ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Add BOM for Hebrew support
    const bom = '\uFEFF'
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedCampaign.name}_recipients.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return 'מתוזמן'
      case 'running': return 'פעיל'
      case 'completed': return 'הושלם'
      case 'failed': return 'נכשל'
      case 'cancelled': return 'בוטל'
      case 'paused': return 'מושהה'
      case 'draft': return 'טיוטה'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-[#F2F3F8] text-[#030733]'
      case 'running': return 'bg-[#0043E0] text-white'
      case 'completed': return 'bg-[#187C55] text-white'
      case 'failed': return 'bg-[#CD1B1B] text-white'
      case 'cancelled': return 'bg-[#6B7280] text-white'
      case 'paused': return 'bg-[#F59E0B] text-white'
      case 'draft': return 'bg-[#9CA3AF] text-white'
      default: return 'bg-[#F2F3F8] text-[#030733]'
    }
  }

  const filteredCampaigns = campaigns.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === 'all' || filterStatus === 'custom' || c.status === filterStatus
    return matchesSearch && matchesStatus
  })

  // Filter recipients by search
  const filteredRecipients = recipients.filter(r => {
    if (!recipientSearch.trim()) return true
    const search = recipientSearch.toLowerCase()
    return (
      r.phone.toLowerCase().includes(search) ||
      (r.name && r.name.toLowerCase().includes(search))
    )
  })

  // Handle Select All checkbox
  const handleSelectAll = () => {
    if (checkedCampaigns.size === filteredCampaigns.length) {
      // All are selected, deselect all
      setCheckedCampaigns(new Set())
    } else {
      // Select all filtered campaigns
      setCheckedCampaigns(new Set(filteredCampaigns.map(c => c.id)))
    }
  }

  // Check if all filtered campaigns are selected
  const allSelected = filteredCampaigns.length > 0 && checkedCampaigns.size === filteredCampaigns.length
  const someSelected = checkedCampaigns.size > 0 && checkedCampaigns.size < filteredCampaigns.length

  const handleCheck = (id: string) => {
    const newChecked = new Set(checkedCampaigns)
    if (newChecked.has(id)) {
      newChecked.delete(id)
    } else {
      newChecked.add(id)
    }
    setCheckedCampaigns(newChecked)
  }

  // Calculate stats from actual recipients data
  const campaignStats = useMemo(() => {
    if (!selectedCampaign || recipients.length === 0) {
      return { sent: 0, delivered: 0, read: 0, replied: 0, failed: 0, pending: 0, total: 0 }
    }

    // Count actual statuses from recipients
    const counts = recipients.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      sent: counts['sent'] || 0,
      delivered: counts['delivered'] || 0,
      read: counts['read'] || 0,
      replied: counts['replied'] || 0,
      failed: counts['failed'] || 0,
      pending: counts['pending'] || 0,
      total: recipients.length
    }
  }, [selectedCampaign, recipients])

  // Calculate rates based on total recipients
  const successRate = campaignStats.total > 0 ? Math.round((campaignStats.sent / campaignStats.total) * 100) : 0
  const failRate = campaignStats.total > 0 ? Math.round((campaignStats.failed / campaignStats.total) * 100) : 0
  const pendingRate = campaignStats.total > 0 ? Math.round((campaignStats.pending / campaignStats.total) * 100) : 0
  const replyRate = campaignStats.sent > 0 ? Math.round((campaignStats.replied / campaignStats.sent) * 100) : 0
  const readRate = campaignStats.sent > 0 ? Math.round((campaignStats.read / campaignStats.sent) * 100) : 0

  // Calculate campaign duration from actual sent times
  const campaignDuration = useMemo(() => {
    const sentRecipients = recipients.filter(r => r.sent_at)
    if (sentRecipients.length < 2) return null

    const times = sentRecipients.map(r => new Date(r.sent_at!).getTime())
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    const durationMs = maxTime - minTime

    if (durationMs < 60000) {
      return `${Math.round(durationMs / 1000)} שניות`
    } else if (durationMs < 3600000) {
      const minutes = Math.round(durationMs / 60000)
      return `${minutes} דקות`
    } else {
      const hours = Math.floor(durationMs / 3600000)
      const minutes = Math.round((durationMs % 3600000) / 60000)
      return minutes > 0 ? `${hours} שעות ו-${minutes} דקות` : `${hours} שעות`
    }
  }, [recipients])

  // Format phone number for display
  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return 'לא זמין'
    // Format as 052-XXXXXXX
    if (phone.startsWith('972')) {
      const local = phone.slice(3)
      return `0${local.slice(0, 2)}-${local.slice(2)}`
    }
    return phone
  }

  // Format duration in seconds to readable format (short version for campaign list)
  const formatDurationShort = (seconds: number | undefined | null) => {
    if (!seconds) return null
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return minutes > 0 ? `${hours}ש׳ ${minutes}ד׳` : `${hours}ש׳`
    }
    return `${minutes}ד׳`
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-[#0043E0]" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen p-8 pb-4 ${darkMode ? 'bg-[#0a1628]' : 'bg-[#F2F3F8]'}`} dir="rtl">
      <div className="max-w-[1600px] mx-auto">
        <div className="grid grid-cols-12 gap-6">
          {/* RIGHT COLUMN - Campaign List (col-span-5) - EXPANDED */}
          <div className="col-span-5 space-y-4 order-1">
            {/* Connection Header - Above Campaigns */}
            <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[10px] px-5 py-4`}>
              <div className="flex items-center gap-4 relative">
                <button
                  className={`${selectedConnection?.status === 'connected' ? 'bg-[#030733]' : 'bg-gray-400'} rounded-full w-[30px] h-[30px] flex items-center justify-center`}
                >
                  {selectedConnection?.status === 'connected' ? (
                    <Check className="text-white" size={16} />
                  ) : (
                    <span className="text-white text-[10px]">!</span>
                  )}
                </button>
                <button
                  onClick={() => setShowConnectionDropdown(!showConnectionDropdown)}
                  className="flex items-center gap-2"
                >
                  <ChevronDown className={`${darkMode ? 'text-white' : 'text-[#030733]'} transition-transform ${showConnectionDropdown ? 'rotate-180' : ''}`} size={18} />
                </button>
                <div className="text-right flex-1">
                  <p className={`text-[13px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                    {selectedConnection
                      ? `אתה מחובר וצופה בנתונים עבור "${selectedConnection.display_name || selectedConnection.session_name}"`
                      : 'לא נבחר חיבור'
                    }
                  </p>
                  <p className={`text-[14px] font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                    מספר וואטצאפ: {formatPhoneNumber(selectedConnection?.phone_number || null)}
                  </p>
                </div>

                {/* Dropdown */}
                {showConnectionDropdown && connections.length > 0 && (
                  <div className={`absolute top-full right-0 left-0 mt-2 ${darkMode ? 'bg-[#1a2d4a]' : 'bg-white'} rounded-[10px] shadow-lg border ${darkMode ? 'border-[#2a3f5f]' : 'border-gray-200'} z-10 overflow-hidden`}>
                    {connections.map((conn) => (
                      <button
                        key={conn.id}
                        onClick={() => {
                          setSelectedConnection(conn)
                          setShowConnectionDropdown(false)
                        }}
                        className={`w-full px-4 py-3 text-right flex items-center justify-between hover:${darkMode ? 'bg-[#142241]' : 'bg-gray-50'} transition-colors ${
                          selectedConnection?.id === conn.id ? (darkMode ? 'bg-[#142241]' : 'bg-gray-50') : ''
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${conn.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div className="flex-1 mr-3">
                          <p className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                            {conn.display_name || conn.session_name}
                          </p>
                          <p className={`text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                            {formatPhoneNumber(conn.phone_number)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
              {statusFilters.slice().reverse().map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setFilterStatus(filter.key)}
                  className={`px-[15px] py-[7px] rounded-[8px] text-[14px] transition-colors ${
                    filterStatus === filter.key
                      ? 'bg-[#030733] text-white'
                      : darkMode ? 'bg-[#142241] text-white' : 'bg-white text-[#030733]'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="flex gap-2">
              <button className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[8px] px-4 py-3 flex items-center gap-2`}>
                <SlidersHorizontal className={`${darkMode ? 'text-white' : 'text-[#030733]'}`} size={20} />
                <span className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>סנן</span>
              </button>
              <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[8px] px-4 py-3 flex-1 flex items-center gap-3`}>
                <input
                  type="text"
                  placeholder="חפש נמענים"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`flex-1 bg-transparent outline-none text-[14px] text-right ${darkMode ? 'text-white placeholder-gray-400' : 'text-[#505050]'}`}
                />
                <Search className={`${darkMode ? 'text-gray-400' : 'text-[#505050]'}`} size={20} />
              </div>
            </div>

            {/* Campaign List */}
            <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
              {/* Select All Header */}
              {filteredCampaigns.length > 0 && (
                <div className={`${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#E8E9ED]'} rounded-[10px] px-4 py-3 flex items-center gap-3`}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={handleSelectAll}
                    className={`w-[17px] h-[17px] rounded border cursor-pointer ${darkMode ? 'border-gray-400' : 'border-[#030733]'}`}
                  />
                  <span className={`text-[13px] ${darkMode ? 'text-gray-300' : 'text-[#595C7A]'}`}>
                    {checkedCampaigns.size > 0
                      ? `נבחרו ${checkedCampaigns.size} קמפיינים`
                      : 'בחר הכל'}
                  </span>
                </div>
              )}
              {filteredCampaigns.length === 0 ? (
                <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[10px] p-8 text-center`}>
                  <Users className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`} />
                  <p className={`${darkMode ? 'text-gray-400' : 'text-[#505050]'} text-[14px]`}>אין קמפיינים עדיין</p>
                </div>
              ) : (
                filteredCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    onClick={() => setSelectedCampaign(campaign)}
                    className={`${darkMode ? 'bg-[#142241] hover:bg-[#1a2d4a]' : 'bg-white hover:bg-[#F8F8F8]'} rounded-[10px] px-4 py-4 cursor-pointer transition-colors ${
                      selectedCampaign?.id === campaign.id ? 'ring-2 ring-[#030733]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <input
                        type="checkbox"
                        checked={checkedCampaigns.has(campaign.id)}
                        onChange={(e) => {
                          e.stopPropagation()
                          handleCheck(campaign.id)
                        }}
                        className={`w-[17px] h-[17px] rounded border cursor-pointer mt-1 ${darkMode ? 'border-gray-400' : 'border-[#030733]'}`}
                      />
                      <div className={`${getStatusColor(campaign.status)} px-3 py-1.5 rounded-[8px] text-[13px] whitespace-nowrap`}>
                        {getStatusLabel(campaign.status)}
                      </div>
                      <div className="flex-1 text-right">
                        <h3 className={`text-[14px] font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{campaign.name}</h3>
                        <div className="flex items-center gap-1 mt-1 justify-end">
                          <span className={`text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                            {(campaign.total_recipients || campaign.sent_count || 0).toLocaleString()} נמענים
                          </span>
                          <Users size={12} className={`${darkMode ? 'text-white' : 'text-[#030733]'}`} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 justify-end">
                      <div className="flex items-center gap-1">
                        <span className={`text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                          {campaign.scheduled_at
                            ? `${new Date(campaign.scheduled_at).toLocaleDateString('he-IL')}, ${new Date(campaign.scheduled_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
                            : '-'
                          }
                        </span>
                        <Clock size={12} className="text-[#0043E0]" />
                      </div>
                      {campaign.estimated_duration && (
                        <span className={`text-[11px] px-2 py-0.5 rounded ${darkMode ? 'bg-[#1a2d4a] text-gray-300' : 'bg-[#F2F3F8] text-[#595C7A]'}`}>
                          {formatDurationShort(campaign.estimated_duration)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* MIDDLE + LEFT - Top Row spans full width (col-span-7) */}
          <div className="col-span-7 flex flex-col gap-4 order-2">
            {/* TOP ROW: Selected Campaign + Send Time + Response Time - COMPACT */}
            <div className="grid grid-cols-3 gap-4">
              {/* Selected Campaign Card - Dark - Compact */}
              <div className="bg-[#030733] rounded-[10px] px-4 py-3 text-white">
                <h3 className="text-[14px] font-semibold mb-1 text-right">הקמפיין שבחרת</h3>
                <p className="text-[13px] text-right">{selectedCampaign?.name || 'בחר קמפיין'}</p>
                <div className="flex items-center gap-3 justify-end mt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-[#B5B5B5]">
                      {recipients.length > 0 ? recipients.length.toLocaleString() : (selectedCampaign?.total_recipients || 0).toLocaleString()}
                    </span>
                    <Users size={12} className="text-white" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-[#B5B5B5]">
                      {selectedCampaign?.scheduled_at
                        ? new Date(selectedCampaign.scheduled_at).toLocaleDateString('he-IL')
                        : '-'
                      }
                    </span>
                    <Clock size={12} className="text-[#0043E0]" />
                  </div>
                </div>
              </div>

              {/* Send Time Card - Compact with countdown */}
              <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[10px] px-4 py-3`}>
                <h3 className={`text-[14px] font-semibold mb-1 text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                  {selectedCampaign?.status === 'running' && countdown ? 'זמן שנותר' : 'זמן שליחת הקמפיין'}
                </h3>
                {selectedCampaign?.status === 'running' && countdown ? (
                  <>
                    <p className={`text-[20px] font-bold text-right ${darkMode ? 'text-[#0043E0]' : 'text-[#0043E0]'}`} dir="ltr">
                      {countdown}
                    </p>
                    <p className={`text-[11px] text-right ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                      סה״כ: {formatDurationShort(selectedCampaign.estimated_duration)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className={`text-[13px] text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>משך השליחה הכולל</p>
                    <p className={`text-[12px] text-right ${darkMode ? 'text-gray-400' : 'text-[#454545]'}`}>
                      {campaignDuration || (selectedCampaign?.status === 'running' ? 'בתהליך...' : '-')}
                    </p>
                  </>
                )}
              </div>

              {/* Average Response Time Card - Compact */}
              <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[10px] px-4 py-3`}>
                <h3 className={`text-[14px] font-semibold mb-1 text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                  ממוצע מענה מהלקוח
                </h3>
                <p className={`text-[13px] text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>זמן תגובה ממוצע</p>
                <p className={`text-[12px] text-right ${darkMode ? 'text-gray-400' : 'text-[#454545]'}`}>
                  {selectedCampaign ? '-' : '-'}
                </p>
              </div>
            </div>

            {/* BOTTOM ROW: Recipients Panel + Stats Column */}
            <div className="grid grid-cols-7 gap-4 flex-1">
              {/* Recipients Panel (takes 4 cols) - with frame, stretched to bottom */}
              <div className={`col-span-4 ${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[15px] p-5 flex flex-col`}>
                <h3 className={`text-[18px] font-semibold mb-4 text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                  נמענים בקמפיין זה
                </h3>

                <div className="flex gap-2 mb-4">
                  <button className={`${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#F2F3F8]'} rounded-[8px] px-3 py-2 flex items-center gap-2`}>
                    <SlidersHorizontal className={`${darkMode ? 'text-white' : 'text-[#030733]'}`} size={18} />
                    <span className={`text-[13px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>סנן</span>
                  </button>
                  <div className={`${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#F2F3F8]'} rounded-[8px] px-3 py-2 flex-1 flex items-center gap-2`}>
                    <input
                      type="text"
                      placeholder="חפש נמענים"
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      className={`flex-1 bg-transparent outline-none text-[13px] text-right ${darkMode ? 'text-white placeholder-gray-400' : 'text-[#505050]'}`}
                    />
                    <Search className={`${darkMode ? 'text-gray-400' : 'text-[#505050]'}`} size={18} />
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[500px]">
                  {!selectedCampaign ? (
                    <div className="flex items-center justify-center h-[280px]">
                      <p className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>אנא בחר קמפיין לצפייה בנתונים</p>
                    </div>
                  ) : recipientsLoading ? (
                    <div className="flex items-center justify-center h-[280px]">
                      <Loader2 className="w-8 h-8 animate-spin text-[#0043E0]" />
                    </div>
                  ) : recipients.length === 0 ? (
                    <div className="flex items-center justify-center h-[280px]">
                      <p className={`text-[14px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>אין נמענים בקמפיין זה</p>
                    </div>
                  ) : filteredRecipients.length === 0 ? (
                    <div className="flex items-center justify-center h-[280px]">
                      <p className={`text-[14px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>לא נמצאו נמענים לחיפוש זה</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredRecipients.map((recipient) => (
                        <div
                          key={recipient.id}
                          onClick={() => setSelectedRecipient(recipient)}
                          className={`${darkMode ? 'bg-[#1a2d4a] hover:bg-[#243556]' : 'bg-[#F2F3F8] hover:bg-[#E8E9ED]'} rounded-[8px] px-4 py-2.5 cursor-pointer transition-colors`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] px-2 py-0.5 rounded ${
                                recipient.status === 'sent' ? 'bg-[#187C55] text-white' :
                                recipient.status === 'delivered' ? 'bg-[#10B981] text-white' :
                                recipient.status === 'read' ? 'bg-[#0043E0] text-white' :
                                recipient.status === 'replied' ? 'bg-[#8B5CF6] text-white' :
                                recipient.status === 'failed' ? 'bg-[#CD1B1B] text-white' :
                                recipient.status === 'cancelled' ? 'bg-[#6B7280] text-white' :
                                recipient.status === 'pending' ? (darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-700') :
                                'bg-[#0043E0] text-white'
                              }`}>
                                {recipient.status === 'sent' ? 'נשלח' :
                                 recipient.status === 'delivered' ? 'נמסר' :
                                 recipient.status === 'read' ? 'נקרא' :
                                 recipient.status === 'replied' ? 'הגיב' :
                                 recipient.status === 'failed' ? 'נכשל' :
                                 recipient.status === 'cancelled' ? 'בוטל' :
                                 recipient.status === 'pending' ? 'ממתין' :
                                 recipient.status}
                              </span>
                              <span className={`text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                                {recipient.sent_at
                                  ? new Date(recipient.sent_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                                  : '-'}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className={`text-[13px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                                {recipient.name || recipient.phone}
                              </span>
                              {recipient.name && (
                                <span className={`text-[11px] mr-2 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                                  {recipient.phone}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Show sender info if exists */}
                          {recipient.sender_session_name && (
                            <div className={`mt-1 text-[11px] ${darkMode ? 'text-blue-400' : 'text-blue-600'} flex items-center gap-1`}>
                              <span>נשלח מ: {recipient.sender_session_name}</span>
                              {recipient.sender_phone && (
                                <span dir="ltr">({formatPhoneNumber(recipient.sender_phone)})</span>
                              )}
                            </div>
                          )}
                          {/* Show error hint if exists */}
                          {recipient.error_message && (
                            <div className={`mt-1 text-[11px] ${darkMode ? 'text-red-400' : 'text-red-600'} truncate`}>
                              ⚠️ {recipient.error_message.substring(0, 50)}{recipient.error_message.length > 50 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Column (takes 3 cols) */}
              <div className="col-span-3 space-y-4">
                {/* Stats Overview - Donut Chart + Percentages */}
                <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[15px] p-5`}>
                  <h3 className={`text-[16px] font-semibold mb-4 text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                    סקירת שליחת הודעות
                  </h3>

                  {/* Large Donut Chart - Centered */}
                  <div className="flex justify-center mb-4">
                    <div className="relative w-[180px] h-[180px]">
                      <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                        <circle cx="50" cy="50" r="42" fill="none" stroke={darkMode ? '#1a2d4a' : '#E5E7EB'} strokeWidth="8" />
                        {successRate > 0 && (
                          <circle
                            cx="50" cy="50" r="42" fill="none"
                            stroke="#187C55" strokeWidth="8"
                            strokeDasharray={`${successRate * 2.64} ${264 - successRate * 2.64}`}
                            strokeDashoffset="0"
                          />
                        )}
                        {failRate > 0 && (
                          <circle
                            cx="50" cy="50" r="42" fill="none"
                            stroke="#CD1B1B" strokeWidth="8"
                            strokeDasharray={`${failRate * 2.64} ${264 - failRate * 2.64}`}
                            strokeDashoffset={`${-successRate * 2.64}`}
                          />
                        )}
                        {pendingRate > 0 && (
                          <circle
                            cx="50" cy="50" r="42" fill="none"
                            stroke="#9CA3AF" strokeWidth="8"
                            strokeDasharray={`${pendingRate * 2.64} ${264 - pendingRate * 2.64}`}
                            strokeDashoffset={`${-(successRate + failRate) * 2.64}`}
                          />
                        )}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className={`text-[32px] font-bold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                          {campaignStats.total}
                        </p>
                        <p className={`text-[13px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>סה״כ הודעות</p>
                      </div>
                    </div>
                  </div>

                  {/* Percentages below donut - same section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="bg-[#187C55] text-white text-[12px] px-3 py-1 rounded-[6px]">{successRate}%</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[13px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{campaignStats.sent}</span>
                        <span className={`text-[13px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>נשלחו בהצלחה</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="bg-[#CD1B1B] text-white text-[12px] px-3 py-1 rounded-[6px]">{failRate}%</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[13px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{campaignStats.failed}</span>
                        <span className={`text-[13px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>נכשלו בשליחה</span>
                      </div>
                    </div>
                    {campaignStats.pending > 0 && (
                      <div className="flex items-center justify-between">
                        <span className={`${darkMode ? 'bg-gray-600' : 'bg-gray-400'} text-white text-[12px] px-3 py-1 rounded-[6px]`}>{pendingRate}%</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[13px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{campaignStats.pending}</span>
                          <span className={`text-[13px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>ממתינים</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Responses Received */}
                <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[10px] p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <MessageCircle size={17} className={`${darkMode ? 'text-white' : 'text-[#030733]'}`} />
                    <h3 className={`text-[15px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>תגובות שהתקבלו</h3>
                  </div>
                  <div className="mb-2">
                    <div className={`${darkMode ? 'bg-[#030733]/40' : 'bg-[rgba(3,7,51,0.24)]'} h-[6px] rounded-[50px] overflow-hidden`}>
                      <div className="bg-[#030733] h-full rounded-[50px] transition-all duration-300" style={{ width: `${replyRate}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-[#454545]'}`}>
                      <span className={`font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{campaignStats.sent}</span> סה״כ
                    </span>
                    <div className={`${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                      <span className="font-medium">{campaignStats.replied}/</span>
                      <span className={`${darkMode ? 'text-gray-400' : 'text-[#454545]'}`}>{replyRate}%</span>
                    </div>
                  </div>
                </div>

                {/* Messages Viewed */}
                <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[10px] p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <CheckCheck size={17} className={`${darkMode ? 'text-white' : 'text-[#030733]'}`} />
                    <h3 className={`text-[15px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>הודעות שנצפו</h3>
                  </div>
                  <div className="mb-2">
                    <div className={`${darkMode ? 'bg-[#030733]/40' : 'bg-[rgba(3,7,51,0.24)]'} h-[6px] rounded-[50px] overflow-hidden`}>
                      <div className="bg-[#030733] h-full rounded-[50px] transition-all duration-300" style={{ width: `${readRate}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-[#454545]'}`}>
                      <span className={`font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{campaignStats.sent}</span> סה״כ
                    </span>
                    <div className={`${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                      <span className="font-medium">{campaignStats.read}/</span>
                      <span className={`${darkMode ? 'text-gray-400' : 'text-[#454545]'}`}>{readRate}%</span>
                    </div>
                  </div>
                </div>

                {/* Campaign Control Buttons */}
                {selectedCampaign && ['running', 'paused', 'scheduled'].includes(selectedCampaign.status) && (
                  <div className="flex gap-2 justify-center mb-3">
                    {selectedCampaign.status === 'running' && (
                      <button
                        onClick={handlePauseCampaign}
                        className="flex-1 bg-[#F59E0B] rounded-[9px] py-2.5 px-4 flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
                        title="השהה קמפיין"
                      >
                        <span className="text-white text-[13px] font-medium">השהה</span>
                      </button>
                    )}
                    {selectedCampaign.status === 'paused' && (
                      <button
                        onClick={handleResumeCampaign}
                        className="flex-1 bg-[#187C55] rounded-[9px] py-2.5 px-4 flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
                        title="המשך קמפיין"
                      >
                        <Play size={18} className="text-white" />
                        <span className="text-white text-[13px] font-medium">המשך</span>
                      </button>
                    )}
                    <button
                      onClick={handleCancelCampaign}
                      className="flex-1 bg-[#CD1B1B] rounded-[9px] py-2.5 px-4 flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
                      title="בטל קמפיין"
                    >
                      <StopCircle size={18} className="text-white" />
                      <span className="text-white text-[13px] font-medium">בטל</span>
                    </button>
                  </div>
                )}

                {/* Social/Action Buttons */}
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={handleDeleteCampaign}
                    disabled={(checkedCampaigns.size === 0 && !selectedCampaign) || deleting}
                    className="bg-[#CD1B1B] rounded-[9px] p-2.5 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50"
                    title={checkedCampaigns.size > 0 ? `מחק ${checkedCampaigns.size} קמפיינים` : 'מחק קמפיין'}
                  >
                    {deleting ? <Loader2 size={22} className="text-white animate-spin" /> : <Trash2 size={22} className="text-white" />}
                    {checkedCampaigns.size > 1 && <span className="text-white text-xs mr-1">({checkedCampaigns.size})</span>}
                  </button>
                  <button
                    onClick={handleExportCampaign}
                    disabled={!selectedCampaign || recipients.length === 0}
                    className="bg-[#030733] rounded-[9px] p-2.5 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50"
                    title="ייצא לקובץ CSV"
                  >
                    <Download size={22} className="text-white" />
                  </button>
                  <button
                    onClick={handleDuplicateCampaign}
                    disabled={!selectedCampaign}
                    className="bg-[#030733] rounded-[9px] p-2.5 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50"
                    title="שכפל קמפיין"
                  >
                    <Copy size={22} className="text-white" />
                  </button>
                  {/* Edit button - only visible for draft campaigns */}
                  {selectedCampaign?.status === 'draft' && (
                    <button
                      onClick={handleEditCampaign}
                      className="bg-[#F59E0B] rounded-[9px] p-2.5 flex items-center justify-center hover:opacity-80 transition-opacity"
                      title="ערוך טיוטה"
                    >
                      <Pencil size={22} className="text-white" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recipient Details Modal */}
      {selectedRecipient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedRecipient(null)}>
          <div
            className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[15px] p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto`}
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setSelectedRecipient(null)}
                className={`p-1 rounded hover:bg-gray-200 ${darkMode ? 'hover:bg-[#1a2d4a]' : ''}`}
              >
                <X size={20} className={darkMode ? 'text-white' : 'text-[#030733]'} />
              </button>
              <h3 className={`text-[18px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                פרטי נמען
              </h3>
            </div>

            <div className="space-y-4">
              {/* Basic Info */}
              <div className={`${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#F2F3F8]'} rounded-[10px] p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded ${
                    selectedRecipient.status === 'sent' ? 'bg-[#187C55] text-white' :
                    selectedRecipient.status === 'delivered' ? 'bg-[#10B981] text-white' :
                    selectedRecipient.status === 'read' ? 'bg-[#0043E0] text-white' :
                    selectedRecipient.status === 'replied' ? 'bg-[#8B5CF6] text-white' :
                    selectedRecipient.status === 'failed' ? 'bg-[#CD1B1B] text-white' :
                    selectedRecipient.status === 'cancelled' ? 'bg-[#6B7280] text-white' :
                    selectedRecipient.status === 'pending' ? (darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-700') :
                    'bg-[#0043E0] text-white'
                  }`}>
                    {selectedRecipient.status === 'sent' ? 'נשלח' :
                     selectedRecipient.status === 'delivered' ? 'נמסר' :
                     selectedRecipient.status === 'read' ? 'נקרא' :
                     selectedRecipient.status === 'replied' ? 'הגיב' :
                     selectedRecipient.status === 'failed' ? 'נכשל' :
                     selectedRecipient.status === 'cancelled' ? 'בוטל' :
                     selectedRecipient.status === 'pending' ? 'ממתין' :
                     selectedRecipient.status}
                  </span>
                  <span className={`text-[14px] font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>סטטוס</span>
                </div>
                {selectedRecipient.name && (
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{selectedRecipient.name}</span>
                    <span className={`text-[14px] font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>שם</span>
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{selectedRecipient.phone}</span>
                  <span className={`text-[14px] font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>טלפון</span>
                </div>
                {selectedRecipient.sent_at && (
                  <div className="flex items-center justify-between">
                    <span className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                      {new Date(selectedRecipient.sent_at).toLocaleString('he-IL')}
                    </span>
                    <span className={`text-[14px] font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>זמן שליחה</span>
                  </div>
                )}
              </div>

              {/* Sender Info */}
              {selectedRecipient.sender_session_name && (
                <div className={`${darkMode ? 'bg-blue-900/30' : 'bg-blue-50'} rounded-[10px] p-4 border ${darkMode ? 'border-blue-800' : 'border-blue-200'}`}>
                  <h4 className={`text-[14px] font-semibold mb-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>פרטי שולח</h4>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[13px] ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>{selectedRecipient.sender_session_name}</span>
                    <span className={`text-[13px] font-medium ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>שם מכשיר</span>
                  </div>
                  {selectedRecipient.sender_phone && (
                    <div className="flex items-center justify-between">
                      <span className={`text-[13px] ${darkMode ? 'text-blue-300' : 'text-blue-700'}`} dir="ltr">{formatPhoneNumber(selectedRecipient.sender_phone)}</span>
                      <span className={`text-[13px] font-medium ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>מספר שולח</span>
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {selectedRecipient.error_message && (
                <div className={`${darkMode ? 'bg-red-900/30' : 'bg-red-50'} rounded-[10px] p-4 border ${darkMode ? 'border-red-800' : 'border-red-200'}`}>
                  <h4 className={`text-[14px] font-semibold mb-2 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>שגיאה</h4>
                  <p className={`text-[13px] ${darkMode ? 'text-red-300' : 'text-red-700'}`}>
                    {selectedRecipient.error_message}
                  </p>
                </div>
              )}

              {/* Variables */}
              {selectedRecipient.variables && Object.keys(selectedRecipient.variables).length > 0 && (
                <div className={`${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#F2F3F8]'} rounded-[10px] p-4`}>
                  <h4 className={`text-[14px] font-semibold mb-3 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>משתנים</h4>
                  <div className="space-y-2">
                    {Object.entries(selectedRecipient.variables).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className={`text-[13px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{value}</span>
                        <span className={`text-[13px] font-medium ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>{key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Content - Show the actual sent message if available, otherwise the template */}
              {(selectedRecipient.sent_message_content || selectedRecipient.message_content) && (
                <div className={`${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#F2F3F8]'} rounded-[10px] p-4`}>
                  <h4 className={`text-[14px] font-semibold mb-3 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                    {selectedRecipient.sent_message_content ? 'ההודעה שנשלחה' : 'תוכן ההודעה'}
                  </h4>
                  <p className={`text-[13px] whitespace-pre-wrap ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                    {selectedRecipient.sent_message_content || selectedRecipient.message_content}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Campaign Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDeleteCampaign}
        title={checkedCampaigns.size > 1
          ? `האם למחוק ${checkedCampaigns.size} קמפיינים?`
          : `האם למחוק את "${selectedCampaign?.name}"?`}
        subtitle="פעולה זו לא ניתנת לביטול"
        confirmText={checkedCampaigns.size > 1 ? `כן, מחק ${checkedCampaigns.size}` : "כן, מחק"}
        cancelText="לא, בטל"
        variant="danger"
      />

      {/* Cancel Campaign Confirmation Modal */}
      <ConfirmModal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={confirmCancelCampaign}
        title={`האם לבטל את "${selectedCampaign?.name}"?`}
        subtitle="הקמפיין ייעצר והשליחה תיפסק"
        confirmText="כן, בטל קמפיין"
        cancelText="לא, המשך"
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

// Wrap with Suspense to handle useSearchParams
export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">טוען...</div>}>
      <AnalyticsContent />
    </Suspense>
  )
}
