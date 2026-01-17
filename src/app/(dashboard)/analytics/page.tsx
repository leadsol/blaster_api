'use client'

import React, { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Loader2, Search, ChevronDown, Clock,
  Trash2, Copy, Download, MessageCircle,
  SlidersHorizontal, CheckCheck, Check, X, StopCircle, Play, Pause, Pencil
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { ConfirmModal, AlertModal } from '@/components/modals'
import { formatPhoneForDisplay } from '@/lib/phone-utils'

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
  paused_at?: string // When campaign was paused (for countdown)
  total_recipients: number
  estimated_duration?: number // in seconds
  connection_id: string
  device_ids?: string[]
  multi_device?: boolean
  message_variations?: string[]
  error_message?: string // Error message when campaign fails
  respect_active_hours?: boolean
  active_hours_start?: string | null
  active_hours_end?: string | null
  is_active?: boolean // Master toggle for campaign
}

interface Recipient {
  id: string
  phone: string
  name?: string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'replied' | 'failed' | 'cancelled' | 'blacklisted'
  sent_at?: string
  failed_at?: string
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
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set()) // Multiple device selection
  const [showConnectionDropdown, setShowConnectionDropdown] = useState(false)
  const [showDeviceStatsDropdown, setShowDeviceStatsDropdown] = useState(false)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [dailyMessageCount, setDailyMessageCount] = useState<number>(0)
  const [dailyLimit, setDailyLimit] = useState<number>(0)
  const [resumeAt, setResumeAt] = useState<string | null>(null)
  const [deviceMessagesCount, setDeviceMessagesCount] = useState<Record<string, number>>({}) // Per-device message count in selected campaign
  const [allDevicesStats, setAllDevicesStats] = useState<Array<{
    id: string
    name: string
    phone: string | null
    sentToday: number
    limit: number // Base limit (90)
    exemptAllowed: number // Exempt messages allowed (from variations)
    status: string
  }>>([]) // Daily stats for all devices

  // Modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message?: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ isOpen: false, title: '', type: 'info' })
  const [editActiveHoursModal, setEditActiveHoursModal] = useState<{
    isOpen: boolean
    campaignId: string
    start: string
    end: string
  }>({ isOpen: false, campaignId: '', start: '09:00', end: '18:00' })

  const statusFilters = [
    { key: 'completed', label: 'הושלם' },
    { key: 'scheduled', label: 'מתוזמן' },
    { key: 'failed', label: 'נכשל' },
    { key: 'running', label: 'פעיל' },
    { key: 'paused', label: 'מושהה' },
    { key: 'cancelled', label: 'בוטל' },
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
      // Sort by most recent activity - sent_at or failed_at, then created_at
      const aTime = a.sent_at || a.failed_at || a.created_at || ''
      const bTime = b.sent_at || b.failed_at || b.created_at || ''
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

  // Recalculate daily usage when device selection changes
  useEffect(() => {
    if (selectedConnection) {
      calculateDailyUsageForDevice(selectedConnection.id)
    } else {
      setDailyMessageCount(0)
      setDailyLimit(0)
    }
  }, [selectedConnection])

  // Load all devices stats when connections or campaigns change
  useEffect(() => {
    if (connections.length > 0) {
      loadAllDevicesStats()
      // Auto-select all devices on initial load
      if (selectedDevices.size === 0) {
        setSelectedDevices(new Set(connections.map(c => c.id)))
      }
    }
  }, [connections, campaigns])

  // Countdown timer for running/paused campaigns
  useEffect(() => {
    const isRunningOrPaused = selectedCampaign?.status === 'running' || selectedCampaign?.status === 'paused'
    if (!selectedCampaign || !isRunningOrPaused || !selectedCampaign.started_at || !selectedCampaign.estimated_duration) {
      setCountdown(null)
      setResumeAt(null)
      return
    }

    const calculateCountdown = () => {
      // Check if all messages are sent or failed (no pending)
      const pendingCount = recipients.filter(r => r.status === 'pending').length
      if (pendingCount === 0 && recipients.length > 0) {
        setCountdown(null) // Don't show countdown if everything is done
        return
      }

      const startTime = new Date(selectedCampaign.started_at!).getTime()
      const estimatedEndTime = startTime + (selectedCampaign.estimated_duration! * 1000)

      // For paused campaigns, calculate remaining time from when it was paused
      // For running campaigns, calculate from current time
      let referenceTime: number
      if (selectedCampaign.status === 'paused' && selectedCampaign.paused_at) {
        referenceTime = new Date(selectedCampaign.paused_at).getTime()

        // Check if reached daily limit - show resume at midnight
        const reachedDailyLimit = dailyLimit > 0 && dailyMessageCount >= dailyLimit

        if (reachedDailyLimit) {
          // Reached daily limit - resume at midnight
          const midnight = new Date()
          midnight.setDate(midnight.getDate() + 1)
          midnight.setHours(0, 0, 0, 0)
          setResumeAt(midnight.toISOString())
        } else if (selectedCampaign.respect_active_hours && selectedCampaign.active_hours_start && selectedCampaign.active_hours_end) {
          // Check if outside active hours
          const now = new Date()
          const [startH, startM] = selectedCampaign.active_hours_start.split(':').map(Number)
          const [endH, endM] = selectedCampaign.active_hours_end.split(':').map(Number)

          const currentMinutes = now.getHours() * 60 + now.getMinutes()
          const startMinutes = startH * 60 + startM
          const endMinutes = endH * 60 + endM

          const isOutsideActiveHours = currentMinutes < startMinutes || currentMinutes >= endMinutes

          if (isOutsideActiveHours) {
            // Outside active hours - show resume at next active hours start
            const resumeDate = new Date()
            if (currentMinutes >= endMinutes) {
              resumeDate.setDate(resumeDate.getDate() + 1)
            }
            resumeDate.setHours(startH, startM, 0, 0)
            setResumeAt(resumeDate.toISOString())
          } else {
            // Inside active hours but manually paused - don't show resume time
            setResumeAt(null)
          }
        } else {
          // No active hours, not at daily limit - manually paused, don't show resume time
          setResumeAt(null)
        }
      } else {
        referenceTime = Date.now()
        setResumeAt(null)
      }

      const remainingMs = estimatedEndTime - referenceTime

      if (remainingMs <= 0) {
        setCountdown('...מסיים')
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

    // Only set interval for running campaigns (paused campaigns show frozen time)
    if (selectedCampaign.status === 'running') {
      const interval = setInterval(calculateCountdown, 1000)
      return () => clearInterval(interval)
    }
  }, [selectedCampaign?.id, selectedCampaign?.status, selectedCampaign?.started_at, selectedCampaign?.estimated_duration, selectedCampaign?.paused_at, recipients])

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
      // Don't auto-select - let user choose device or "all devices"
    }

    // Load campaigns with connection details
    const { data: campaignsData, error } = await supabase
      .from('campaigns')
      .select('id, name, status, sent_count, delivered_count, read_count, reply_count, failed_count, total_recipients, scheduled_at, started_at, paused_at, estimated_duration, connection_id, device_ids, multi_device, message_variations, respect_active_hours, active_hours_start, active_hours_end, is_active')
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
    // Include failed_at for proper sorting
    const { data } = await supabase
      .from('campaign_messages')
      .select('id, phone, name, status, sent_at, failed_at, message_content, sent_message_content, sender_session_name, sender_phone, variables, error_message, created_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })

    if (data) {
      // Sort by most recent activity - prioritize sent_at or failed_at, then created_at
      const sorted = [...data].sort((a, b) => {
        const aTime = a.sent_at || a.failed_at || a.created_at
        const bTime = b.sent_at || b.failed_at || b.created_at
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })
      setRecipients(sorted)

      // Calculate per-device message counts for this campaign
      const deviceCounts: Record<string, number> = {}
      sorted.forEach(msg => {
        if (msg.status === 'sent' && msg.sender_phone) {
          const phone = msg.sender_phone
          deviceCounts[phone] = (deviceCounts[phone] || 0) + 1
        }
      })
      setDeviceMessagesCount(deviceCounts)
    }

    // Calculate device-level daily usage (if a device is selected)
    if (selectedConnection) {
      await calculateDailyUsageForDevice(selectedConnection.id)
    } else {
      setDailyMessageCount(0)
      setDailyLimit(0)
    }

    setRecipientsLoading(false)
  }

  // Calculate daily usage for a specific device
  const calculateDailyUsageForDevice = async (deviceId: string) => {
    const supabase = createClient()

    // Get device info to check for variations
    const { data: deviceData } = await supabase
      .from('connections')
      .select('id')
      .eq('id', deviceId)
      .single()

    if (!deviceData) return

    // Calculate daily limit per device
    // Base limit is 90 messages - exempt messages from variations don't count
    const BASE_MESSAGES_PER_DAY_PER_DEVICE = 90
    const EXEMPT_MESSAGES_PER_VARIATION = 10

    // Get all campaigns using this device to find highest exempt allowance
    const { data: deviceCampaigns } = await supabase
      .from('campaigns')
      .select('message_variations')
      .or(`connection_id.eq.${deviceId},device_ids.cs.{${deviceId}}`)

    let maxExemptAllowed = 0
    if (deviceCampaigns) {
      deviceCampaigns.forEach(camp => {
        const messageVariations: string[] = camp.message_variations || []
        const validVariations = messageVariations.filter(v => v && v.trim().length > 0)
        const variationCount = validVariations.length
        const exemptAllowed = variationCount > 1 ? (variationCount - 1) * EXEMPT_MESSAGES_PER_VARIATION : 0
        maxExemptAllowed = Math.max(maxExemptAllowed, exemptAllowed)
      })
    }

    // Base limit is always 90 - exempt messages are separate
    const perDeviceLimit = BASE_MESSAGES_PER_DAY_PER_DEVICE

    // Count messages sent TODAY from this device across ALL campaigns
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // Get all campaigns using this device
    const { data: allCampaignsWithDevice } = await supabase
      .from('campaigns')
      .select('id')
      .or(`connection_id.eq.${deviceId},device_ids.cs.{${deviceId}}`)

    const campaignIdsUsingDevice = allCampaignsWithDevice?.map(c => c.id) || []

    if (campaignIdsUsingDevice.length === 0) {
      setDailyMessageCount(0)
      setDailyLimit(perDeviceLimit)
      return
    }

    // Count messages sent today from this device
    // We need to match by sender_phone (which is the device's phone number)
    const { data: deviceConnection } = await supabase
      .from('connections')
      .select('phone_number')
      .eq('id', deviceId)
      .single()

    if (!deviceConnection?.phone_number) {
      setDailyMessageCount(0)
      setDailyLimit(perDeviceLimit)
      return
    }

    const { count: sentTodayFromDevice } = await supabase
      .from('campaign_messages')
      .select('id', { count: 'exact', head: true })
      .in('campaign_id', campaignIdsUsingDevice)
      .eq('status', 'sent')
      .eq('sender_phone', deviceConnection.phone_number)
      .gte('sent_at', todayStart.toISOString())

    setDailyMessageCount(sentTodayFromDevice || 0)
    setDailyLimit(perDeviceLimit)
  }

  // Calculate daily stats for ALL devices
  const loadAllDevicesStats = async () => {
    const supabase = createClient()

    if (connections.length === 0) {
      setAllDevicesStats([])
      return
    }

    const BASE_MESSAGES_PER_DAY_PER_DEVICE = 90
    const EXEMPT_MESSAGES_PER_VARIATION = 10
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const stats = await Promise.all(
      connections.map(async (conn) => {
        // Get all campaigns using this device
        const { data: deviceCampaigns } = await supabase
          .from('campaigns')
          .select('message_variations')
          .or(`connection_id.eq.${conn.id},device_ids.cs.{${conn.id}}`)

        // Calculate max exempt messages allowed across all campaigns using this device
        let maxExemptAllowed = 0
        if (deviceCampaigns) {
          deviceCampaigns.forEach(camp => {
            const messageVariations: string[] = camp.message_variations || []
            const validVariations = messageVariations.filter(v => v && v.trim().length > 0)
            const variationCount = validVariations.length
            const exemptAllowed = variationCount > 1 ? (variationCount - 1) * EXEMPT_MESSAGES_PER_VARIATION : 0
            maxExemptAllowed = Math.max(maxExemptAllowed, exemptAllowed)
          })
        }

        // Count messages sent today from this device
        let sentToday = 0
        if (conn.phone_number) {
          const { data: allCampaignsWithDevice } = await supabase
            .from('campaigns')
            .select('id')
            .or(`connection_id.eq.${conn.id},device_ids.cs.{${conn.id}}`)

          const campaignIdsUsingDevice = allCampaignsWithDevice?.map(c => c.id) || []

          if (campaignIdsUsingDevice.length > 0) {
            const { count: sentTodayFromDevice } = await supabase
              .from('campaign_messages')
              .select('id', { count: 'exact', head: true })
              .in('campaign_id', campaignIdsUsingDevice)
              .eq('status', 'sent')
              .eq('sender_phone', conn.phone_number)
              .gte('sent_at', todayStart.toISOString())

            sentToday = sentTodayFromDevice || 0
          }
        }

        return {
          id: conn.id,
          name: conn.display_name || conn.session_name,
          phone: conn.phone_number,
          sentToday,
          limit: BASE_MESSAGES_PER_DAY_PER_DEVICE,
          exemptAllowed: maxExemptAllowed,
          status: conn.status
        }
      })
    )

    setAllDevicesStats(stats)
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
        const pausedAt = new Date().toISOString()
        setCampaigns(prev => prev.map(c =>
          c.id === selectedCampaign.id ? { ...c, status: 'paused', paused_at: pausedAt } : c
        ))
        setSelectedCampaign({ ...selectedCampaign, status: 'paused', paused_at: pausedAt })
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

    // Check if outside active hours
    if (selectedCampaign.respect_active_hours && selectedCampaign.active_hours_start && selectedCampaign.active_hours_end) {
      const now = new Date()
      const currentTime = now.toTimeString().slice(0, 5) // HH:MM
      const startTime = selectedCampaign.active_hours_start.slice(0, 5)
      const endTime = selectedCampaign.active_hours_end.slice(0, 5)

      if (currentTime < startTime || currentTime > endTime) {
        setAlertModal({
          isOpen: true,
          title: 'מחוץ לשעות הפעילות',
          message: `לא ניתן להפעיל את הקמפיין כעת.\nשעות הפעילות: ${startTime} - ${endTime}\nהשעה הנוכחית: ${currentTime}\n\nניתן לערוך את שעות הפעילות בעמוד עריכת הקמפיין.`,
          type: 'warning'
        })
        return
      }
    }

    try {
      const response = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' })
      })

      if (response.ok) {
        // Get updated campaign data from server to ensure accurate started_at
        const updatedResponse = await fetch(`/api/campaigns/${selectedCampaign.id}`)
        if (updatedResponse.ok) {
          const { campaign: updatedCampaign } = await updatedResponse.json()

          setCampaigns(prev => prev.map(c =>
            c.id === selectedCampaign.id ? updatedCampaign : c
          ))
          setSelectedCampaign(updatedCampaign)
        }
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

  const handleToggleActive = async () => {
    if (!selectedCampaign) return

    const newIsActive = selectedCampaign.is_active === false ? true : false

    try {
      const response = await fetch(`/api/campaigns/${selectedCampaign.id}/toggle-active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newIsActive })
      })

      if (response.ok) {
        const data = await response.json()
        // Update local state - also update status if campaign was paused
        const updates = { is_active: newIsActive, ...(data.status === 'paused' && selectedCampaign.status === 'running' ? { status: 'paused', paused_at: new Date().toISOString() } : {}) }

        setCampaigns(prev => prev.map(c =>
          c.id === selectedCampaign.id ? { ...c, ...updates } : c
        ))
        setSelectedCampaign(prev => prev ? { ...prev, ...updates } : null)

        setAlertModal({
          isOpen: true,
          title: newIsActive ? 'הקמפיין פעיל' : 'הקמפיין לא פעיל',
          message: newIsActive ? 'הקמפיין ישלח הודעות במסגרת שעות הפעילות והמכסה היומית' : 'הקמפיין הושהה ולא ישלח הודעות עד שיופעל מחדש',
          type: newIsActive ? 'success' : 'info'
        })
      } else {
        const data = await response.json()
        setAlertModal({
          isOpen: true,
          title: 'שגיאה',
          message: data.error || 'אירעה שגיאה, נסה שוב',
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Toggle active error:', error)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה',
        message: 'אירעה שגיאה, נסה שוב',
        type: 'error'
      })
    }
  }

  const handleExportCampaign = async () => {
    if (!selectedCampaign || recipients.length === 0) return

    // Create CSV content
    const headers = ['טלפון', 'שם', 'סטטוס', 'זמן שליחה', 'זמן כישלון', 'משתנים']
    const rows = recipients.map(r => [
      r.phone,
      r.name || '',
      r.status,
      r.sent_at ? new Date(r.sent_at).toLocaleString('he-IL') : '',
      r.failed_at ? new Date(r.failed_at).toLocaleString('he-IL') : '',
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

  const handleSaveActiveHours = async () => {
    if (!editActiveHoursModal.campaignId) return

    try {
      const response = await fetch(`/api/campaigns/${editActiveHoursModal.campaignId}/active-hours`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active_hours_start: editActiveHoursModal.start,
          active_hours_end: editActiveHoursModal.end
        })
      })

      if (response.ok) {
        // Update local state - also set respect_active_hours to true
        setCampaigns(prev => prev.map(c =>
          c.id === editActiveHoursModal.campaignId
            ? { ...c, respect_active_hours: true, active_hours_start: editActiveHoursModal.start, active_hours_end: editActiveHoursModal.end }
            : c
        ))
        if (selectedCampaign?.id === editActiveHoursModal.campaignId) {
          setSelectedCampaign(prev => prev ? {
            ...prev,
            respect_active_hours: true,
            active_hours_start: editActiveHoursModal.start,
            active_hours_end: editActiveHoursModal.end
          } : null)
        }

        setEditActiveHoursModal({ isOpen: false, campaignId: '', start: '09:00', end: '18:00' })
        setAlertModal({
          isOpen: true,
          title: 'שעות הפעילות עודכנו בהצלחה',
          type: 'success'
        })
      } else {
        const data = await response.json()
        setAlertModal({
          isOpen: true,
          title: 'שגיאה בעדכון שעות הפעילות',
          message: data.error || 'אירעה שגיאה, נסה שוב',
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Save active hours error:', error)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה בעדכון שעות הפעילות',
        message: 'אירעה שגיאה, נסה שוב',
        type: 'error'
      })
    }
  }

  const handleRemoveActiveHours = async () => {
    if (!editActiveHoursModal.campaignId) return

    try {
      const response = await fetch(`/api/campaigns/${editActiveHoursModal.campaignId}/active-hours`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remove_active_hours: true })
      })

      if (response.ok) {
        // Update local state
        setCampaigns(prev => prev.map(c =>
          c.id === editActiveHoursModal.campaignId
            ? { ...c, respect_active_hours: false, active_hours_start: null, active_hours_end: null }
            : c
        ))
        if (selectedCampaign?.id === editActiveHoursModal.campaignId) {
          setSelectedCampaign(prev => prev ? {
            ...prev,
            respect_active_hours: false,
            active_hours_start: null,
            active_hours_end: null
          } : null)
        }

        setEditActiveHoursModal({ isOpen: false, campaignId: '', start: '09:00', end: '18:00' })
        setAlertModal({
          isOpen: true,
          title: 'שעות הפעילות הוסרו בהצלחה',
          type: 'success'
        })
      } else {
        const data = await response.json()
        setAlertModal({
          isOpen: true,
          title: 'שגיאה בהסרת שעות הפעילות',
          message: data.error || 'אירעה שגיאה, נסה שוב',
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Remove active hours error:', error)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה בהסרת שעות הפעילות',
        message: 'אירעה שגיאה, נסה שוב',
        type: 'error'
      })
    }
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

    // Filter by selected device (if any)
    let matchesDevice = true
    if (selectedConnection) {
      const deviceId = selectedConnection.id
      // Campaign matches if it uses this device (either as primary or in multi-device)
      const campaignDevices = c.multi_device && c.device_ids ? c.device_ids : [c.connection_id]
      matchesDevice = campaignDevices.includes(deviceId)
    }

    return matchesSearch && matchesStatus && matchesDevice
  })

  // Filter recipients by search
  const filteredRecipients = recipients.filter(r => {
    // Filter out recipients without phone numbers
    if (!r.phone || r.phone.trim() === '') return false

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

    // Filter out recipients without phone numbers (invalid entries)
    const validRecipients = recipients.filter(r => r.phone && r.phone.trim() !== '')

    // Count actual statuses from valid recipients only
    const counts = validRecipients.reduce((acc, r) => {
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
      total: validRecipients.length
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

  // Format phone number for display (using utility)
  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return 'לא זמין'
    return formatPhoneForDisplay(phone)
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
        <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 animate-spin text-[#0043E0]" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen p-2 sm:p-4 md:p-6 lg:p-8 xl:p-10 2xl:p-12 pb-2 sm:pb-3 md:pb-4 ${darkMode ? 'bg-[#0a1628]' : 'bg-[#F2F3F8]'}`} dir="rtl">
      <div className="max-w-full sm:max-w-full md:max-w-full lg:max-w-[1400px] xl:max-w-[1600px] 2xl:max-w-[2000px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 md:gap-4 lg:gap-5 xl:gap-6 2xl:gap-8">
          {/* RIGHT COLUMN - Campaign List - RESPONSIVE */}
          <div className="lg:col-span-5 xl:col-span-5 space-y-2 sm:space-y-3 md:space-y-4 order-1 lg:order-1">
            {/* Connection Header - Above Campaigns */}
            <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[8px] sm:rounded-[10px] md:rounded-[12px] px-3 sm:px-4 md:px-5 xl:px-6 py-2 sm:py-3 md:py-4`}>
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4 relative">
                <button
                  className={`${selectedConnection?.status === 'connected' ? 'bg-[#030733]' : 'bg-gray-400'} rounded-full w-[24px] h-[24px] sm:w-[28px] sm:h-[28px] md:w-[30px] md:h-[30px] xl:w-[34px] xl:h-[34px] flex items-center justify-center flex-shrink-0`}
                >
                  {selectedConnection?.status === 'connected' ? (
                    <Check className="text-white" size={14} />
                  ) : (
                    <span className="text-white text-[9px] sm:text-[10px]">!</span>
                  )}
                </button>
                <button
                  onClick={() => setShowConnectionDropdown(!showConnectionDropdown)}
                  className="flex items-center gap-1 sm:gap-2 flex-shrink-0"
                >
                  <ChevronDown className={`${darkMode ? 'text-white' : 'text-[#030733]'} transition-transform ${showConnectionDropdown ? 'rotate-180' : ''}`} size={16} />
                </button>
                <div className="text-right flex-1 min-w-0">
                  <p className={`text-[11px] sm:text-[12px] md:text-[13px] xl:text-[14px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'} truncate`}>
                    {selectedConnection
                      ? `אתה מחובר וצופה בנתונים עבור "${selectedConnection.display_name || selectedConnection.session_name}"`
                      : 'בחר מכשיר לצפייה בקמפיינים'
                    }
                  </p>
                  <p className={`text-[12px] sm:text-[13px] md:text-[14px] xl:text-[15px] 2xl:text-[16px] font-medium ${darkMode ? 'text-white' : 'text-[#030733]'} truncate`}>
                    {selectedConnection
                      ? `מספר וואטצאפ: ${formatPhoneNumber(selectedConnection.phone_number || null)}`
                      : 'כל המכשירים'
                    }
                  </p>
                  {/* Daily limit stats - נשלחו / נשארו / חריגה */}
                  {(() => {
                    // Calculate stats based on selection
                    let totalSent = 0
                    let totalLimit = 0
                    let totalExemptAllowed = 0

                    if (selectedConnection) {
                      // Single device selected
                      totalSent = dailyMessageCount
                      totalLimit = dailyLimit
                      // Find exempt allowed for this device
                      const deviceStats = allDevicesStats.find(d => d.id === selectedConnection.id)
                      totalExemptAllowed = deviceStats?.exemptAllowed || 0
                    } else {
                      // All devices - sum up all stats
                      totalSent = allDevicesStats.reduce((sum, d) => sum + d.sentToday, 0)
                      totalLimit = allDevicesStats.reduce((sum, d) => sum + d.limit, 0)
                      totalExemptAllowed = allDevicesStats.reduce((sum, d) => sum + d.exemptAllowed, 0)
                    }

                    const remaining = totalLimit - Math.min(totalSent, totalLimit)
                    const exemptUsed = Math.max(0, totalSent - totalLimit)

                    if (totalLimit === 0 && allDevicesStats.length === 0) return null

                    return (
                      <div className={`flex items-center gap-3 mt-1 text-[10px] sm:text-[11px] md:text-[12px] xl:text-[13px]`}>
                        <span className={darkMode ? 'text-gray-400' : 'text-[#595C7A]'}>
                          נשלחו: <span className={`font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{totalSent}</span>
                        </span>
                        <span className={darkMode ? 'text-gray-400' : 'text-[#595C7A]'}>
                          נשארו: <span className={`font-medium ${remaining <= 0 ? 'text-red-500' : darkMode ? 'text-white' : 'text-[#030733]'}`}>{remaining}</span>
                        </span>
                        {exemptUsed > 0 && (
                          <span className={darkMode ? 'text-gray-400' : 'text-[#595C7A]'}>
                            חריגה: <span className="font-medium text-orange-500">{exemptUsed}</span>
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* Dropdown */}
                {showConnectionDropdown && connections.length > 0 && (
                  <div className={`absolute top-full right-0 left-0 mt-1 sm:mt-2 ${darkMode ? 'bg-[#1a2d4a]' : 'bg-white'} rounded-[8px] sm:rounded-[10px] shadow-lg border ${darkMode ? 'border-[#2a3f5f]' : 'border-gray-200'} z-10 overflow-hidden max-h-[60vh] overflow-y-auto`}>
                    {/* "All Devices" option */}
                    <button
                      onClick={() => {
                        setSelectedConnection(null)
                        setShowConnectionDropdown(false)
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-right flex items-center justify-between hover:${darkMode ? 'bg-[#142241]' : 'bg-gray-50'} transition-colors ${
                        !selectedConnection ? (darkMode ? 'bg-[#142241]' : 'bg-gray-50') : ''
                      }`}
                    >
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      <div className="flex-1 mr-2 sm:mr-3 min-w-0">
                        <p className={`text-[12px] sm:text-[13px] md:text-[14px] font-medium ${darkMode ? 'text-white' : 'text-[#030733]'} truncate`}>
                          כל המכשירים
                        </p>
                        <p className={`text-[10px] sm:text-[11px] md:text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'} truncate`}>
                          הצג קמפיינים מכל המכשירים
                        </p>
                      </div>
                    </button>
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


            {/* Filter Tabs - RESPONSIVE */}
            <div className="flex gap-1 sm:gap-1.5 md:gap-2 flex-wrap">
              {statusFilters.slice().reverse().map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setFilterStatus(filter.key)}
                  className={`px-2 sm:px-2.5 md:px-3 lg:px-[10px] py-1 sm:py-1.5 md:py-[5px] rounded-[6px] sm:rounded-[7px] md:rounded-[8px] text-[10px] sm:text-[11px] md:text-[12px] xl:text-[13px] transition-colors ${
                    filterStatus === filter.key
                      ? 'bg-[#030733] text-white'
                      : darkMode ? 'bg-[#142241] text-white' : 'bg-white text-[#030733]'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Search Bar with Select All - RESPONSIVE */}
            <div className="flex gap-1.5 sm:gap-2 items-center">
              {/* Select All - compact */}
              {filteredCampaigns.length > 0 && (
                <label className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[6px] sm:rounded-[8px] px-2 sm:px-2.5 md:px-3 py-2 sm:py-2.5 md:py-3 flex items-center gap-1.5 sm:gap-2 cursor-pointer flex-shrink-0`}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={handleSelectAll}
                    className={`w-[13px] h-[13px] sm:w-[14px] sm:h-[14px] md:w-[15px] md:h-[15px] rounded border cursor-pointer ${darkMode ? 'border-gray-400' : 'border-[#030733]'}`}
                  />
                  <span className={`text-[10px] sm:text-[11px] md:text-[12px] whitespace-nowrap ${darkMode ? 'text-gray-300' : 'text-[#595C7A]'}`}>
                    {checkedCampaigns.size > 0 ? `${checkedCampaigns.size}` : 'הכל'}
                  </span>
                </label>
              )}

              <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[6px] sm:rounded-[8px] px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 flex-1 flex items-center gap-2 sm:gap-2.5 md:gap-3`}>
                <input
                  type="text"
                  placeholder="חפש קמפיינים"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`flex-1 bg-transparent outline-none text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] text-right ${darkMode ? 'text-white placeholder-gray-400' : 'text-[#505050]'}`}
                />
                <Search className={`${darkMode ? 'text-gray-400' : 'text-[#505050]'} flex-shrink-0`} size={16} />
              </div>
            </div>

            {/* Campaign List - RESPONSIVE */}
            <div className="space-y-1.5 sm:space-y-2 max-h-[calc(100vh-300px)] sm:max-h-[calc(100vh-350px)] md:max-h-[calc(100vh-400px)] overflow-y-auto">
              {filteredCampaigns.length === 0 ? (
                <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[8px] sm:rounded-[10px] p-4 sm:p-6 md:p-8 text-center`}>
                  <Users className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 mx-auto mb-2 sm:mb-3 md:mb-4 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`} />
                  <p className={`${darkMode ? 'text-gray-400' : 'text-[#505050]'} text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px]`}>אין קמפיינים עדיין</p>
                </div>
              ) : (
                filteredCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    onClick={() => setSelectedCampaign(campaign)}
                    className={`${darkMode ? 'bg-[#142241] hover:bg-[#1a2d4a]' : 'bg-white hover:bg-[#F8F8F8]'} rounded-[8px] sm:rounded-[10px] px-2 sm:px-3 md:px-4 py-2 sm:py-3 md:py-4 cursor-pointer transition-colors ${
                      selectedCampaign?.id === campaign.id ? 'ring-1 sm:ring-2 ring-[#030733]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5 sm:gap-2 md:gap-3">
                      <input
                        type="checkbox"
                        checked={checkedCampaigns.has(campaign.id)}
                        onChange={(e) => {
                          e.stopPropagation()
                          handleCheck(campaign.id)
                        }}
                        className={`w-[14px] h-[14px] sm:w-[15px] sm:h-[15px] md:w-[17px] md:h-[17px] rounded border cursor-pointer mt-0.5 sm:mt-1 flex-shrink-0 ${darkMode ? 'border-gray-400' : 'border-[#030733]'}`}
                      />
                      <div className={`${getStatusColor(campaign.status)} px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 rounded-[6px] sm:rounded-[7px] md:rounded-[8px] text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] whitespace-nowrap flex-shrink-0`}>
                        {getStatusLabel(campaign.status)}
                      </div>
                      <div className="flex-1 text-right min-w-0">
                        <h3 className={`text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] xl:text-[15px] font-medium ${darkMode ? 'text-white' : 'text-[#030733]'} truncate`}>{campaign.name}</h3>
                        {campaign.status === 'failed' && campaign.error_message && (
                          <p className={`text-[9px] sm:text-[10px] md:text-[11px] mt-0.5 sm:mt-1 ${darkMode ? 'text-red-400' : 'text-red-600'} truncate`}>
                            ⚠️ {campaign.error_message}
                          </p>
                        )}
                        <div className="flex items-center gap-0.5 sm:gap-1 mt-0.5 sm:mt-1 justify-end">
                          <span className={`text-[10px] sm:text-[11px] md:text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                            {(campaign.total_recipients || campaign.sent_count || 0).toLocaleString()} נמענים
                          </span>
                          <Users size={10} className={`${darkMode ? 'text-white' : 'text-[#030733]'} flex-shrink-0`} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1 sm:mt-1.5 md:mt-2 justify-end flex-wrap">
                      {campaign.respect_active_hours === true && campaign.active_hours_start && campaign.active_hours_end && (
                        <span className={`text-[9px] sm:text-[10px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                          {campaign.active_hours_end.slice(0, 5)} - {campaign.active_hours_start.slice(0, 5)}
                        </span>
                      )}
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <span className={`text-[9px] sm:text-[10px] md:text-[11px] lg:text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'} truncate`}>
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

          {/* MIDDLE + LEFT - Stats and Details - RESPONSIVE */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col gap-2 sm:gap-3 md:gap-4 order-2 lg:order-2">
            {/* TOP ROW: Selected Campaign + Send Time + Response Time - RESPONSIVE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
              {/* Selected Campaign Card - Dark - Compact */}
              <div className="bg-[#030733] rounded-[6px] sm:rounded-[8px] px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 md:py-2 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] sm:text-[11px] md:text-[12px] font-semibold">הקמפיין שבחרת</h3>
                  {selectedCampaign?.respect_active_hours === true && selectedCampaign?.active_hours_start && selectedCampaign?.active_hours_end && (
                    <div className="flex items-center gap-1 text-[8px] sm:text-[9px] text-[#B5B5B5]">
                      <span>שעות פעילות</span>
                      <Clock size={9} className="text-[#0043E0]" />
                      <span>{selectedCampaign.active_hours_end.slice(0, 5)} - {selectedCampaign.active_hours_start.slice(0, 5)}</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] sm:text-[11px] md:text-[12px] text-right truncate">{selectedCampaign?.name || 'בחר קמפיין'}</p>
                <div className="flex items-center justify-between mt-0.5">
                  {/* Campaign Devices - left side */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {selectedCampaign && (() => {
                      const deviceIds = selectedCampaign.multi_device && selectedCampaign.device_ids
                        ? selectedCampaign.device_ids
                        : [selectedCampaign.connection_id]
                      const campaignDevices = connections.filter(c => deviceIds.includes(c.id))
                      return campaignDevices.length > 0 ? (
                        campaignDevices.map((device) => (
                          <span
                            key={device.id}
                            className={`text-[8px] sm:text-[9px] px-1 py-0.5 rounded ${
                              device.status === 'connected'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {device.display_name || device.session_name}
                          </span>
                        ))
                      ) : null
                    })()}
                  </div>
                  {/* Recipients count - right side */}
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <span className="text-[9px] sm:text-[10px] md:text-[11px] text-[#B5B5B5]">
                      {recipients.length > 0 ? recipients.length.toLocaleString() : (selectedCampaign?.total_recipients || 0).toLocaleString()}
                    </span>
                    <Users size={10} className="text-white flex-shrink-0" />
                  </div>
                </div>
              </div>

              {/* Send Time Card - Compact with countdown - RESPONSIVE */}
              <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[6px] sm:rounded-[8px] px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 md:py-2`}>
                <h3 className={`text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] font-semibold mb-0.5 text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                  {(selectedCampaign?.status === 'running' || selectedCampaign?.status === 'paused') && countdown
                    ? (selectedCampaign?.status === 'paused' ? 'זמן שנותר (מושהה)' : 'זמן שנותר')
                    : (selectedCampaign?.status === 'running' || selectedCampaign?.status === 'paused') ? 'הושלם' : 'זמן שליחת הקמפיין'}
                </h3>
                {(selectedCampaign?.status === 'running' || selectedCampaign?.status === 'paused') && countdown ? (
                  <div className="flex items-center justify-between">
                    <div className={`text-[8px] sm:text-[9px] text-left ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                      <p>סה״כ: {formatDurationShort(selectedCampaign.estimated_duration)}</p>
                      {selectedCampaign?.status === 'paused' && resumeAt && (
                        <p className={`${darkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                          ימשיך ב-{new Date(resumeAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                    <p className={`text-[12px] sm:text-[14px] md:text-[16px] font-bold ${selectedCampaign?.status === 'paused' ? 'text-[#F59E0B]' : 'text-[#0043E0]'}`} dir="ltr">
                      {countdown}
                      {selectedCampaign?.status === 'paused' && <span className="text-[9px] mr-1">⏸</span>}
                    </p>
                  </div>
                ) : (selectedCampaign?.status === 'running' || selectedCampaign?.status === 'paused') ? (
                  <>
                    <p className={`text-[20px] font-bold text-right text-[#187C55]`}>✓</p>
                    <p className={`text-[11px] text-right ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                      כל ההודעות נשלחו/נכשלו
                    </p>
                    {dailyLimit > 0 && (
                      <p className={`text-[11px] text-right mt-1 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                        היום: {dailyMessageCount}/{dailyLimit} הודעות
                      </p>
                    )}
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

              {/* Device Messages Distribution Card - Shows how many messages each device sent */}
              <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[6px] sm:rounded-[8px] px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 md:py-2`}>
                <h3 className={`text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] font-semibold mb-0.5 text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                  הודעות לפי מכשיר
                </h3>
                {selectedCampaign && Object.keys(deviceMessagesCount).length > 0 ? (
                  <div className="space-y-1 mt-2">
                    {Object.entries(deviceMessagesCount).map(([phone, count]) => {
                      // Find the connection with this phone number
                      const deviceConn = connections.find(c => c.phone_number === phone)
                      const deviceName = deviceConn?.display_name || deviceConn?.session_name || formatPhoneForDisplay(phone)
                      return (
                        <div key={phone} className="flex items-center justify-between">
                          <span className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                            {count} הודעות
                          </span>
                          <span className={`text-[12px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                            {deviceName}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className={`text-[12px] text-right ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                    {selectedCampaign ? 'אין הודעות שנשלחו עדיין' : 'בחר קמפיין'}
                  </p>
                )}
              </div>
            </div>

            {/* BOTTOM ROW: Recipients Panel + Stats Column - RESPONSIVE */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-2 sm:gap-3 md:gap-4 flex-1 min-h-0 overflow-y-auto">
              {/* Recipients Panel - RESPONSIVE */}
              <div className={`lg:col-span-4 ${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[10px] sm:rounded-[12px] md:rounded-[15px] p-3 sm:p-4 md:p-5 flex flex-col`}>
                <h3 className={`text-[13px] sm:text-[14px] md:text-[16px] lg:text-[17px] xl:text-[18px] 2xl:text-[20px] font-semibold mb-2 sm:mb-3 md:mb-4 text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                  נמענים בקמפיין זה
                </h3>

                <div className="flex gap-1.5 sm:gap-2 mb-2 sm:mb-3 md:mb-4">
                  <button className={`${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#F2F3F8]'} rounded-[6px] sm:rounded-[8px] px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0`}>
                    <SlidersHorizontal className={`${darkMode ? 'text-white' : 'text-[#030733]'}`} size={14} />
                    <span className={`text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>סנן</span>
                  </button>
                  <div className={`${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#F2F3F8]'} rounded-[6px] sm:rounded-[8px] px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 flex-1 flex items-center gap-1.5 sm:gap-2`}>
                    <input
                      type="text"
                      placeholder="חפש נמענים"
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      className={`flex-1 bg-transparent outline-none text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] text-right ${darkMode ? 'text-white placeholder-gray-400' : 'text-[#505050]'}`}
                    />
                    <Search className={`${darkMode ? 'text-gray-400' : 'text-[#505050]'} flex-shrink-0`} size={14} />
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
                                recipient.status === 'blacklisted' ? 'bg-[#6B7280] text-white' :
                                recipient.status === 'cancelled' ? 'bg-[#6B7280] text-white' :
                                recipient.status === 'pending' ? (darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-700') :
                                'bg-[#0043E0] text-white'
                              }`}>
                                {recipient.status === 'sent' ? 'נשלח' :
                                 recipient.status === 'delivered' ? 'נמסר' :
                                 recipient.status === 'read' ? 'נקרא' :
                                 recipient.status === 'replied' ? 'הגיב' :
                                 recipient.status === 'failed' ? 'נכשל' :
                                 recipient.status === 'blacklisted' ? 'רשימה שחורה' :
                                 recipient.status === 'cancelled' ? 'בוטל' :
                                 recipient.status === 'pending' ? 'ממתין' :
                                 recipient.status}
                              </span>
                              <span className={`text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                                {recipient.sent_at
                                  ? new Date(recipient.sent_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                                  : recipient.failed_at
                                  ? new Date(recipient.failed_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                                  : '-'}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className={`text-[13px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                                {recipient.name || formatPhoneForDisplay(recipient.phone)}
                              </span>
                              {recipient.name && (
                                <span className={`text-[11px] mr-2 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                                  {formatPhoneForDisplay(recipient.phone)}
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

              {/* Stats Column - RESPONSIVE */}
              <div className="lg:col-span-3 space-y-2 sm:space-y-3 md:space-y-4 overflow-y-auto max-h-full">
                {/* Stats Overview - Donut Chart + Percentages - RESPONSIVE */}
                <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[10px] sm:rounded-[12px] md:rounded-[15px] p-3 sm:p-4 md:p-5`}>
                  <h3 className={`text-[12px] sm:text-[13px] md:text-[14px] lg:text-[15px] xl:text-[16px] 2xl:text-[18px] font-semibold mb-2 sm:mb-3 md:mb-4 text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                    סקירת שליחת הודעות
                  </h3>

                  {/* Large Donut Chart - Centered - RESPONSIVE */}
                  <div className="flex justify-center mb-2 sm:mb-3 md:mb-4">
                    <div className="relative w-[100px] h-[100px] sm:w-[110px] sm:h-[110px] md:w-[120px] md:h-[120px] lg:w-[130px] lg:h-[130px] xl:w-[140px] xl:h-[140px] 2xl:w-[150px] 2xl:h-[150px]">
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
                        <p className={`text-[20px] sm:text-[24px] md:text-[28px] lg:text-[32px] xl:text-[36px] 2xl:text-[40px] font-bold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                          {campaignStats.total}
                        </p>
                        <p className={`text-[9px] sm:text-[10px] md:text-[11px] lg:text-[12px] xl:text-[13px] 2xl:text-[14px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>סה״כ הודעות</p>
                      </div>
                    </div>
                  </div>

                  {/* Percentages below donut - RESPONSIVE */}
                  <div className="space-y-2 sm:space-y-2.5 md:space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="bg-[#187C55] text-white text-[9px] sm:text-[10px] md:text-[11px] lg:text-[12px] px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 rounded-[5px] sm:rounded-[6px]">{successRate}%</span>
                      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                        <span className={`text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] xl:text-[14px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{campaignStats.sent}</span>
                        <span className={`text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] xl:text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>נשלחו בהצלחה</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="bg-[#CD1B1B] text-white text-[9px] sm:text-[10px] md:text-[11px] lg:text-[12px] px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 rounded-[5px] sm:rounded-[6px]">{failRate}%</span>
                      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                        <span className={`text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] xl:text-[14px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{campaignStats.failed}</span>
                        <span className={`text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] xl:text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>נכשלו בשליחה</span>
                      </div>
                    </div>
                    {campaignStats.pending > 0 && (
                      <div className="flex items-center justify-between">
                        <span className={`${darkMode ? 'bg-gray-600' : 'bg-gray-400'} text-white text-[9px] sm:text-[10px] md:text-[11px] lg:text-[12px] px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 rounded-[5px] sm:rounded-[6px]`}>{pendingRate}%</span>
                        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                          <span className={`text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] xl:text-[14px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{campaignStats.pending}</span>
                          <span className={`text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] xl:text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>ממתינים</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Responses Received - RESPONSIVE */}
                <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[8px] sm:rounded-[10px] p-2 sm:p-3 md:p-4`}>
                  <div className="flex items-center justify-between mb-2 sm:mb-2.5 md:mb-3">
                    <MessageCircle size={14} className={`${darkMode ? 'text-white' : 'text-[#030733]'} flex-shrink-0`} />
                    <h3 className={`text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] xl:text-[15px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>תגובות שהתקבלו</h3>
                  </div>
                  <div className="mb-2">
                    <div className={`${darkMode ? 'bg-[#030733]/40' : 'bg-[rgba(3,7,51,0.24)]'} h-[6px] rounded-[50px] overflow-hidden`}>
                      <div className="bg-[#030733] h-full rounded-[50px] transition-all duration-300" style={{ width: `${replyRate}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[9px] sm:text-[10px] md:text-[11px] lg:text-[12px]">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-[#454545]'}`}>
                      <span className={`font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{campaignStats.sent}</span> סה״כ
                    </span>
                    <div className={`${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                      <span className="font-medium">{campaignStats.replied}/</span>
                      <span className={`${darkMode ? 'text-gray-400' : 'text-[#454545]'}`}>{replyRate}%</span>
                    </div>
                  </div>
                </div>

                {/* Messages Viewed - RESPONSIVE */}
                <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[8px] sm:rounded-[10px] p-2 sm:p-3 md:p-4`}>
                  <div className="flex items-center justify-between mb-2 sm:mb-2.5 md:mb-3">
                    <CheckCheck size={14} className={`${darkMode ? 'text-white' : 'text-[#030733]'} flex-shrink-0`} />
                    <h3 className={`text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] xl:text-[15px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>הודעות שנצפו</h3>
                  </div>
                  <div className="mb-2">
                    <div className={`${darkMode ? 'bg-[#030733]/40' : 'bg-[rgba(3,7,51,0.24)]'} h-[6px] rounded-[50px] overflow-hidden`}>
                      <div className="bg-[#030733] h-full rounded-[50px] transition-all duration-300" style={{ width: `${readRate}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[9px] sm:text-[10px] md:text-[11px] lg:text-[12px]">
                    <span className={`${darkMode ? 'text-gray-400' : 'text-[#454545]'}`}>
                      <span className={`font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{campaignStats.sent}</span> סה״כ
                    </span>
                    <div className={`${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                      <span className="font-medium">{campaignStats.read}/</span>
                      <span className={`${darkMode ? 'text-gray-400' : 'text-[#454545]'}`}>{readRate}%</span>
                    </div>
                  </div>
                </div>

                {/* Campaign Control Buttons - RESPONSIVE - All in one row */}
                {selectedCampaign && ['running', 'paused', 'scheduled'].includes(selectedCampaign.status) && (() => {
                  // Check if outside active hours
                  const now = new Date()
                  const currentTime = now.toTimeString().slice(0, 5)
                  const isOutsideActiveHours = selectedCampaign.respect_active_hours &&
                    selectedCampaign.active_hours_start && selectedCampaign.active_hours_end &&
                    (currentTime < selectedCampaign.active_hours_start.slice(0,5) || currentTime > selectedCampaign.active_hours_end.slice(0,5))

                  // Check if daily limit reached
                  const isDailyLimitReached = dailyLimit > 0 && dailyMessageCount >= dailyLimit

                  // Pause/Resume should be disabled when outside hours, limit reached, or is_active is false
                  const isInactive = selectedCampaign.is_active === false
                  const isPauseResumeDisabled = isOutsideActiveHours || isDailyLimitReached || isInactive

                  return (
                  <div className="flex gap-1.5 sm:gap-2 justify-center items-center mb-2 sm:mb-3 flex-wrap">
                    {/* Active Toggle - controls is_active field */}
                    <div className="flex items-center gap-1">
                      <span className={`text-[8px] sm:text-[9px] ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {selectedCampaign.is_active !== false ? 'פעיל' : 'לא פעיל'}
                      </span>
                      <button
                        onClick={() => handleToggleActive()}
                        className={`relative w-8 h-4 rounded-full transition-colors ${
                          selectedCampaign.is_active !== false ? 'bg-[#187C55]' : 'bg-gray-500'
                        }`}
                        title={selectedCampaign.is_active !== false ? 'כבה קמפיין' : 'הפעל קמפיין'}
                      >
                        <span
                          className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                            selectedCampaign.is_active !== false ? 'right-0.5' : 'right-[18px]'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Pause/Resume Buttons */}
                    {selectedCampaign.status === 'running' && (
                      <button
                        onClick={handlePauseCampaign}
                        disabled={isPauseResumeDisabled}
                        className={`rounded-[7px] sm:rounded-[8px] py-1.5 sm:py-2 px-2 sm:px-3 flex items-center justify-center gap-1 transition-opacity ${
                          isPauseResumeDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#F59E0B] hover:opacity-80'
                        }`}
                        title={isPauseResumeDisabled ? (isInactive ? 'הקמפיין לא פעיל' : isOutsideActiveHours ? 'מחוץ לשעות פעילות' : 'הגעת למכסה היומית') : 'השהה קמפיין'}
                      >
                        <Pause size={12} className="text-white flex-shrink-0" />
                        <span className="text-white text-[9px] sm:text-[10px] font-medium">השהה</span>
                      </button>
                    )}
                    {selectedCampaign.status === 'paused' && (
                      <button
                        onClick={handleResumeCampaign}
                        disabled={isPauseResumeDisabled}
                        className={`rounded-[7px] sm:rounded-[8px] py-1.5 sm:py-2 px-2 sm:px-3 flex items-center justify-center gap-1 transition-opacity ${
                          isPauseResumeDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#187C55] hover:opacity-80'
                        }`}
                        title={isPauseResumeDisabled ? (isInactive ? 'הקמפיין לא פעיל' : isOutsideActiveHours ? 'מחוץ לשעות פעילות' : 'הגעת למכסה היומית') : 'המשך קמפיין'}
                      >
                        <Play size={12} className="text-white flex-shrink-0" />
                        <span className="text-white text-[9px] sm:text-[10px] font-medium">המשך</span>
                      </button>
                    )}

                    {/* Cancel Button */}
                    <button
                      onClick={handleCancelCampaign}
                      className="bg-[#CD1B1B] rounded-[7px] sm:rounded-[8px] py-1.5 sm:py-2 px-2 sm:px-3 flex items-center justify-center gap-1 hover:opacity-80 transition-opacity"
                      title="בטל קמפיין"
                    >
                      <StopCircle size={12} className="text-white flex-shrink-0" />
                      <span className="text-white text-[9px] sm:text-[10px] font-medium">בטל</span>
                    </button>

                    {/* Edit Active Hours Button - always visible */}
                    <button
                      onClick={() => setEditActiveHoursModal({ isOpen: true, campaignId: selectedCampaign.id, start: selectedCampaign.active_hours_start?.slice(0,5) || '09:00', end: selectedCampaign.active_hours_end?.slice(0,5) || '18:00' })}
                      className={`rounded-[7px] sm:rounded-[8px] py-1.5 sm:py-2 px-2 sm:px-3 flex items-center justify-center gap-1 hover:opacity-80 transition-opacity ${selectedCampaign.respect_active_hours ? 'bg-[#0043E0]' : 'bg-gray-500'}`}
                      title={selectedCampaign.respect_active_hours ? 'ערוך שעות פעילות' : 'הוסף שעות פעילות'}
                    >
                      <Clock size={12} className="text-white flex-shrink-0" />
                    </button>
                  </div>
                  )
                })()}

                {/* Social/Action Buttons - RESPONSIVE */}
                <div className="flex gap-1.5 sm:gap-2 justify-center">
                  <button
                    onClick={handleDeleteCampaign}
                    disabled={(checkedCampaigns.size === 0 && !selectedCampaign) || deleting}
                    className="bg-[#CD1B1B] rounded-[7px] sm:rounded-[8px] md:rounded-[9px] p-1.5 sm:p-2 md:p-2.5 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50"
                    title={checkedCampaigns.size > 0 ? `מחק ${checkedCampaigns.size} קמפיינים` : 'מחק קמפיין'}
                  >
                    {deleting ? <Loader2 size={18} className="text-white animate-spin" /> : <Trash2 size={18} className="text-white" />}
                    {checkedCampaigns.size > 1 && <span className="text-white text-[9px] sm:text-[10px] mr-0.5 sm:mr-1">({checkedCampaigns.size})</span>}
                  </button>
                  <button
                    onClick={handleExportCampaign}
                    disabled={!selectedCampaign || recipients.length === 0}
                    className="bg-[#030733] rounded-[7px] sm:rounded-[8px] md:rounded-[9px] p-1.5 sm:p-2 md:p-2.5 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50"
                    title="ייצא לקובץ CSV"
                  >
                    <Download size={18} className="text-white" />
                  </button>
                  <button
                    onClick={handleDuplicateCampaign}
                    disabled={!selectedCampaign}
                    className="bg-[#030733] rounded-[7px] sm:rounded-[8px] md:rounded-[9px] p-1.5 sm:p-2 md:p-2.5 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50"
                    title="שכפל קמפיין"
                  >
                    <Copy size={18} className="text-white" />
                  </button>
                  {/* Edit button - only visible for draft campaigns */}
                  {selectedCampaign?.status === 'draft' && (
                    <button
                      onClick={handleEditCampaign}
                      className="bg-[#F59E0B] rounded-[7px] sm:rounded-[8px] md:rounded-[9px] p-1.5 sm:p-2 md:p-2.5 flex items-center justify-center hover:opacity-80 transition-opacity"
                      title="ערוך טיוטה"
                    >
                      <Pencil size={18} className="text-white" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recipient Details Modal - RESPONSIVE */}
      {selectedRecipient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" onClick={() => setSelectedRecipient(null)}>
          <div
            className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[10px] sm:rounded-[12px] md:rounded-[15px] p-3 sm:p-4 md:p-6 max-w-lg w-full max-h-[90vh] sm:max-h-[85vh] md:max-h-[80vh] overflow-y-auto`}
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
              <button
                onClick={() => setSelectedRecipient(null)}
                className={`p-0.5 sm:p-1 rounded hover:bg-gray-200 ${darkMode ? 'hover:bg-[#1a2d4a]' : ''}`}
              >
                <X size={18} className={darkMode ? 'text-white' : 'text-[#030733]'} />
              </button>
              <h3 className={`text-[14px] sm:text-[16px] md:text-[18px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                פרטי נמען
              </h3>
            </div>

            <div className="space-y-2 sm:space-y-3 md:space-y-4">
              {/* Basic Info */}
              <div className={`${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#F2F3F8]'} rounded-[8px] sm:rounded-[10px] p-2 sm:p-3 md:p-4`}>
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <span className={`text-[9px] sm:text-[10px] md:text-[11px] px-1.5 sm:px-2 py-0.5 rounded ${
                    selectedRecipient.status === 'sent' ? 'bg-[#187C55] text-white' :
                    selectedRecipient.status === 'delivered' ? 'bg-[#10B981] text-white' :
                    selectedRecipient.status === 'read' ? 'bg-[#0043E0] text-white' :
                    selectedRecipient.status === 'replied' ? 'bg-[#8B5CF6] text-white' :
                    selectedRecipient.status === 'failed' ? 'bg-[#CD1B1B] text-white' :
                    selectedRecipient.status === 'blacklisted' ? 'bg-[#6B7280] text-white' :
                    selectedRecipient.status === 'cancelled' ? 'bg-[#6B7280] text-white' :
                    selectedRecipient.status === 'pending' ? (darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-300 text-gray-700') :
                    'bg-[#0043E0] text-white'
                  }`}>
                    {selectedRecipient.status === 'sent' ? 'נשלח' :
                     selectedRecipient.status === 'delivered' ? 'נמסר' :
                     selectedRecipient.status === 'read' ? 'נקרא' :
                     selectedRecipient.status === 'replied' ? 'הגיב' :
                     selectedRecipient.status === 'failed' ? 'נכשל' :
                     selectedRecipient.status === 'blacklisted' ? 'רשימה שחורה' :
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
                  <span className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{formatPhoneForDisplay(selectedRecipient.phone)}</span>
                  <span className={`text-[14px] font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>טלפון</span>
                </div>
                {selectedRecipient.sent_at && (
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                      {new Date(selectedRecipient.sent_at).toLocaleString('he-IL')}
                    </span>
                    <span className={`text-[14px] font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>זמן שליחה</span>
                  </div>
                )}
                {selectedRecipient.failed_at && (
                  <div className="flex items-center justify-between">
                    <span className={`text-[14px] ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
                      {new Date(selectedRecipient.failed_at).toLocaleString('he-IL')}
                    </span>
                    <span className={`text-[14px] font-medium ${darkMode ? 'text-red-300' : 'text-red-600'}`}>זמן כישלון</span>
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

      {/* Edit Active Hours Modal */}
      {editActiveHoursModal.isOpen && (() => {
        const campaign = campaigns.find(c => c.id === editActiveHoursModal.campaignId)
        const hasActiveHours = campaign?.respect_active_hours
        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditActiveHoursModal({ ...editActiveHoursModal, isOpen: false })}>
          <div
            className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[15px] p-6 max-w-sm w-full`}
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                {hasActiveHours ? 'עריכת שעות פעילות' : 'הוספת שעות פעילות'}
              </h3>
              <button
                onClick={() => setEditActiveHoursModal({ ...editActiveHoursModal, isOpen: false })}
                className={`p-1 rounded-full hover:bg-gray-100 ${darkMode ? 'hover:bg-gray-700' : ''}`}
              >
                <X size={20} className={darkMode ? 'text-white' : 'text-gray-500'} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>שעת התחלה</label>
                <input
                  type="time"
                  value={editActiveHoursModal.start}
                  onChange={(e) => setEditActiveHoursModal({ ...editActiveHoursModal, start: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-[#0A1628] border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </div>
              <div>
                <label className={`block text-sm mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>שעת סיום</label>
                <input
                  type="time"
                  value={editActiveHoursModal.end}
                  onChange={(e) => setEditActiveHoursModal({ ...editActiveHoursModal, end: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-[#0A1628] border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleSaveActiveHours}
                  className="flex-1 bg-[#0043E0] text-white py-2 px-4 rounded-lg hover:opacity-80 transition-opacity"
                >
                  {hasActiveHours ? 'שמור' : 'הוסף'}
                </button>
                <button
                  onClick={() => setEditActiveHoursModal({ ...editActiveHoursModal, isOpen: false })}
                  className={`flex-1 py-2 px-4 rounded-lg border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                >
                  ביטול
                </button>
              </div>

              {hasActiveHours && (
                <button
                  onClick={handleRemoveActiveHours}
                  className="w-full mt-2 py-2 px-4 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  הסר שעות פעילות
                </button>
              )}
            </div>
          </div>
        </div>
        )
      })()}
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
