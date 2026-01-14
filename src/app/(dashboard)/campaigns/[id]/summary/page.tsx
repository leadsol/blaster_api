'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Trash2, Plus, ChevronDown, ChevronUp, ArrowRight, ArrowLeft, Pencil, X, Check } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { ConfirmModal, AlertModal } from '@/components/modals'

interface CampaignMessage {
  id: string
  phone: string
  name: string | null
  message_content: string
  sent_message_content?: string // The actual message that was sent (after variation selection)
  sender_session_name?: string // The session/device name that sent this message
  sender_phone?: string // The phone number of the sender
  status: string
  variables?: Record<string, string>
  scheduled_delay_seconds?: number // Pre-calculated delay from campaign start
}

interface Campaign {
  id: string
  name: string
  message_template: string
  status: string
  total_recipients: number
  scheduled_at: string | null
  delay_min: number
  delay_max: number
  pause_after_messages: number | null
  pause_seconds: number | null
  new_list_name: string | null
  existing_list_id: string | null
  multi_device: boolean
  device_ids: string[] | null
  estimated_duration?: number
  // Poll data
  poll_question: string | null
  poll_options: string[] | null
  poll_multiple_answers: boolean
  // Message variations
  message_variations: string[] | null
}

interface ContactList {
  id: string
  name: string
}

export default function CampaignSummaryPage() {
  const params = useParams()
  const router = useRouter()
  const { darkMode } = useTheme()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [messages, setMessages] = useState<CampaignMessage[]>([])
  const [existingListName, setExistingListName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [sortColumn, setSortColumn] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<{
    name: string
    phone: string
    message_content: string
    variables: Record<string, string>
  } | null>(null)

  // Dynamic columns from variables
  const [dynamicColumns, setDynamicColumns] = useState<string[]>([])

  // Modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message?: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({ isOpen: false, title: '', type: 'info' })

  useEffect(() => {
    loadCampaignData()
  }, [campaignId])

  // Track unsaved changes
  useEffect(() => {
    if (campaign?.status !== 'draft') return

    const hasChanges = editingId !== null || selectedIds.size > 0

    setHasUnsavedChanges(hasChanges)
  }, [editingId, selectedIds, campaign?.status])

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges || campaign?.status !== 'draft') return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges, campaign?.status])

  // Realtime subscription for campaign and messages
  useEffect(() => {
    if (!campaignId) return

    const supabase = createClient()

    // Subscribe to campaign changes (status updates)
    const campaignChannel = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaigns',
          filter: `id=eq.${campaignId}`
        },
        (payload) => {
          console.log('[REALTIME] Campaign updated:', payload.new)
          setCampaign(prev => prev ? { ...prev, ...payload.new } : null)
        }
      )
      .subscribe()

    // Subscribe to campaign messages changes (message status updates)
    const messagesChannel = supabase
      .channel(`campaign-messages-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaign_messages',
          filter: `campaign_id=eq.${campaignId}`
        },
        (payload) => {
          console.log('[REALTIME] Message updated:', payload.new)
          setMessages(prev => prev.map(m =>
            m.id === payload.new.id
              ? { ...m, ...payload.new as CampaignMessage }
              : m
          ))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'campaign_messages',
          filter: `campaign_id=eq.${campaignId}`
        },
        (payload) => {
          console.log('[REALTIME] Message inserted:', payload.new)
          setMessages(prev => [...prev, payload.new as CampaignMessage])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'campaign_messages',
          filter: `campaign_id=eq.${campaignId}`
        },
        (payload) => {
          console.log('[REALTIME] Message deleted:', payload.old)
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(campaignChannel)
      supabase.removeChannel(messagesChannel)
    }
  }, [campaignId])

  const loadCampaignData = async () => {
    const supabase = createClient()

    // Load campaign
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaignData) {
      console.error('Error loading campaign:', campaignError)
      router.push('/analytics')
      return
    }

    setCampaign(campaignData)

    // Load existing list name if exists
    if (campaignData.existing_list_id) {
      const { data: listData } = await supabase
        .from('contact_lists')
        .select('name')
        .eq('id', campaignData.existing_list_id)
        .single()

      if (listData) {
        setExistingListName(listData.name)
      }
    }

    // Load campaign messages - order by scheduled delay for correct sequence
    const { data: messagesData, error: messagesError } = await supabase
      .from('campaign_messages')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('scheduled_delay_seconds', { ascending: true })

    if (messagesError) {
      console.error('Error loading messages:', messagesError)
    } else {
      setMessages(messagesData || [])
      // Debug: Log first and last message to check scheduled_delay_seconds
      if (messagesData && messagesData.length > 0) {
        console.log('First message scheduled_delay_seconds:', messagesData[0]?.scheduled_delay_seconds)
        console.log('Last message scheduled_delay_seconds:', messagesData[messagesData.length - 1]?.scheduled_delay_seconds)
        console.log('Total messages:', messagesData.length)
      }

      // Extract dynamic columns from first message with variables
      if (messagesData && messagesData.length > 0) {
        const allColumns = new Set<string>()
        messagesData.forEach(msg => {
          if (msg.variables) {
            Object.keys(msg.variables).forEach(key => allColumns.add(key))
          }
        })
        setDynamicColumns(Array.from(allColumns))
      }
    }

    setLoading(false)
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMessages.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredMessages.map(m => m.id)))
    }
  }

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  const startEdit = (message: CampaignMessage) => {
    setEditingId(message.id)
    setEditData({
      name: message.name || '',
      phone: message.phone,
      message_content: message.message_content,
      variables: message.variables || {}
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData(null)
  }

  const saveEdit = async () => {
    if (!editingId || !editData) return

    const supabase = createClient()
    const { error } = await supabase
      .from('campaign_messages')
      .update({
        name: editData.name || null,
        phone: editData.phone,
        message_content: editData.message_content,
        variables: editData.variables
      })
      .eq('id', editingId)

    if (error) {
      console.error('Error updating message:', error)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה בעדכון הרשומה',
        type: 'error'
      })
      return
    }

    // Update local state
    setMessages(messages.map(m =>
      m.id === editingId
        ? { ...m, name: editData.name || null, phone: editData.phone, message_content: editData.message_content, variables: editData.variables }
        : m
    ))
    setEditingId(null)
    setEditData(null)
  }

  const addNewRecipient = async () => {
    if (!campaign || campaign.status !== 'draft') {
      setAlertModal({
        isOpen: true,
        title: 'לא ניתן להוסיף נמענים',
        message: 'ניתן להוסיף נמענים רק לקמפיינים בסטטוס טיוטה',
        type: 'warning'
      })
      return
    }

    const supabase = createClient()

    // Calculate delay for the new message based on existing messages
    const MESSAGES_PER_BULK = 30
    const BULK_PAUSE_SECONDS = [
      30 * 60,    // After 1st bulk (30 messages): 30 minutes
      60 * 60,    // After 2nd bulk (60 messages): 1 hour
      90 * 60,    // After 3rd bulk (90 messages): 1.5 hours - and this repeats
    ]

    // Get the current maximum delay from existing messages
    const maxDelay = messages.length > 0
      ? Math.max(...messages.map(m => m.scheduled_delay_seconds || 0))
      : 0

    // Current message count (before adding new one)
    const currentCount = messages.length

    // Random delay for this specific message
    const randomDelay = Math.floor(Math.random() * (campaign.delay_max - campaign.delay_min + 1)) + campaign.delay_min

    // Start with cumulative delay
    let newDelay = maxDelay + randomDelay

    // Check if we just crossed a bulk boundary
    // currentCount is the number BEFORE adding, so currentCount+1 is the new message number
    const newMessageNumber = currentCount + 1

    // Check if we need to add a bulk pause
    // We add pause if the PREVIOUS message (currentCount) completed a bulk
    // AND there are more messages after it (i.e., this new message exists)
    if (currentCount > 0 && currentCount % MESSAGES_PER_BULK === 0) {
      const bulkIndex = Math.floor(currentCount / MESSAGES_PER_BULK) - 1
      const pauseIndex = Math.min(bulkIndex, BULK_PAUSE_SECONDS.length - 1)
      const pauseAmount = BULK_PAUSE_SECONDS[pauseIndex]
      console.log(`⏸️  Adding bulk pause after message ${currentCount}: ${pauseAmount}s (${pauseAmount/60} minutes)`)
      newDelay += pauseAmount
    }

    console.log(`➕ Adding message #${newMessageNumber}: baseDelay=${maxDelay}s, random=${randomDelay}s, total=${newDelay}s`)

    // Create new empty message
    const newMessage = {
      campaign_id: campaignId,
      phone: '',
      name: null,
      message_content: campaign.message_template,
      variables: {},
      status: 'pending',
      scheduled_delay_seconds: newDelay
    }

    const { data, error } = await supabase
      .from('campaign_messages')
      .insert(newMessage)
      .select()
      .single()

    if (error) {
      console.error('Error adding recipient:', error)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה בהוספת נמען',
        type: 'error'
      })
      return
    }

    // Add new message to list
    const newMessages = [data, ...messages]

    // Start editing immediately
    setEditingId(data.id)
    setEditData({
      name: '',
      phone: '',
      message_content: data.message_content,
      variables: {}
    })

    // Recalculate all delays with the new message included
    await recalculateDelays(newMessages)
  }

  // Recalculate all message delays based on current message list
  const recalculateDelays = async (currentMessages: CampaignMessage[]) => {
    if (!campaign) return

    const supabase = createClient()
    const MESSAGES_PER_BULK = 30
    const BULK_PAUSE_SECONDS = [
      30 * 60,    // After 1st bulk (30 messages): 30 minutes
      60 * 60,    // After 2nd bulk (60 messages): 1 hour
      90 * 60,    // After 3rd bulk (90 messages): 1.5 hours - and this repeats
    ]

    let cumulativeDelaySeconds = 0
    const updates: { id: string; scheduled_delay_seconds: number }[] = []

    console.log(`🔄 Recalculating delays for ${currentMessages.length} messages`)

    for (let index = 0; index < currentMessages.length; index++) {
      const message = currentMessages[index]

      // Use existing delay or generate new random one
      const existingDelay = message.scheduled_delay_seconds || 0
      const previousCumulative = index > 0 ? updates[index - 1].scheduled_delay_seconds : 0
      const messageDelay = existingDelay - previousCumulative || Math.floor(Math.random() * (campaign.delay_max - campaign.delay_min + 1)) + campaign.delay_min

      cumulativeDelaySeconds += messageDelay

      const messageNumber = index + 1
      const isLastMessage = messageNumber === currentMessages.length

      // Add bulk pause if needed
      if (!isLastMessage && messageNumber % MESSAGES_PER_BULK === 0) {
        const bulkIndex = Math.floor(messageNumber / MESSAGES_PER_BULK) - 1
        const pauseIndex = Math.min(bulkIndex, BULK_PAUSE_SECONDS.length - 1)
        const pauseAmount = BULK_PAUSE_SECONDS[pauseIndex]
        console.log(`⏸️  [Recalc] Adding bulk pause after message ${messageNumber}: ${pauseAmount}s`)
        cumulativeDelaySeconds += pauseAmount
      }

      updates.push({
        id: message.id,
        scheduled_delay_seconds: cumulativeDelaySeconds
      })
    }

    console.log(`✅ [Recalc] Total estimated duration: ${cumulativeDelaySeconds}s (${(cumulativeDelaySeconds/60).toFixed(2)} minutes)`)

    // Update all messages in database with single batch upsert
    const { error: updateError } = await supabase
      .from('campaign_messages')
      .upsert(
        updates.map(u => ({
          id: u.id,
          scheduled_delay_seconds: u.scheduled_delay_seconds
        })),
        { onConflict: 'id' }
      )

    if (updateError) {
      console.error('Error updating message delays:', updateError)
      return
    }

    // Update campaign estimated duration
    await supabase
      .from('campaigns')
      .update({
        estimated_duration: cumulativeDelaySeconds,
        total_recipients: currentMessages.length
      })
      .eq('id', campaignId)

    // Update local state
    const updatedMessages = currentMessages.map((msg, idx) => ({
      ...msg,
      scheduled_delay_seconds: updates[idx].scheduled_delay_seconds
    }))

    setMessages(updatedMessages)
    if (campaign) {
      setCampaign({
        ...campaign,
        estimated_duration: cumulativeDelaySeconds,
        total_recipients: currentMessages.length
      })
    }
  }

  const deleteSelected = () => {
    if (selectedIds.size === 0) return
    setShowDeleteConfirm(true)
  }

  const confirmDeleteSelected = async () => {
    setShowDeleteConfirm(false)
    const supabase = createClient()
    const { error } = await supabase
      .from('campaign_messages')
      .delete()
      .in('id', Array.from(selectedIds))

    if (error) {
      console.error('Error deleting messages:', error)
      setAlertModal({
        isOpen: true,
        title: 'שגיאה במחיקת הרשומות',
        type: 'error'
      })
      return
    }

    const remainingMessages = messages.filter(m => !selectedIds.has(m.id))
    setSelectedIds(new Set())

    // Recalculate delays after deletion
    await recalculateDelays(remainingMessages)
  }

  const launchCampaign = () => {
    if (!campaign) return

    // Validate all messages have phone numbers
    const messagesWithoutPhone = messages.filter(m => !m.phone || m.phone.trim() === '')
    if (messagesWithoutPhone.length > 0) {
      setAlertModal({
        isOpen: true,
        title: 'לא ניתן לשגר קמפיין',
        message: `יש ${messagesWithoutPhone.length} נמענים ללא מספר טלפון. נא למלא את כל המספרים או למחוק את הנמענים הריקים.`,
        type: 'error'
      })
      return
    }

    setShowLaunchConfirm(true)
  }

  const confirmLaunchCampaign = async () => {
    if (!campaign) return
    setShowLaunchConfirm(false)

    setLaunching(true)

    // Start the campaign processing in the background (don't await)
    // and redirect immediately to analytics
    fetch(`/api/campaigns/${campaign.id}/process`, {
      method: 'POST'
    }).catch(error => {
      console.error('Campaign processing error:', error)
    })

    // Redirect immediately - don't wait for processing to complete
    router.push(`/analytics?campaign=${campaign.id}`)
  }

  // Filter and sort messages
  const filteredMessages = messages
    .filter(m => {
      const searchLower = searchQuery.toLowerCase()
      return (
        (m.name?.toLowerCase() || '').includes(searchLower) ||
        m.phone.includes(searchQuery) ||
        m.message_content.toLowerCase().includes(searchLower)
      )
    })
    .sort((a, b) => {
      if (!sortColumn) return 0

      let aVal = ''
      let bVal = ''

      if (sortColumn === 'name') {
        aVal = a.name || ''
        bVal = b.name || ''
      } else if (sortColumn === 'phone') {
        aVal = a.phone
        bVal = b.phone
      } else if (sortColumn === 'message') {
        aVal = a.message_content
        bVal = b.message_content
      } else if (a.variables && b.variables) {
        aVal = a.variables[sortColumn] || ''
        bVal = b.variables[sortColumn] || ''
      }

      const comparison = aVal.localeCompare(bVal, 'he')
      return sortDirection === 'asc' ? comparison : -comparison
    })

  // Extract first name and last name from name field
  const getNameParts = (fullName: string | null) => {
    if (!fullName) return { firstName: '-', lastName: '-' }
    const parts = fullName.trim().split(' ')
    return {
      firstName: parts[0] || '-',
      lastName: parts.slice(1).join(' ') || '-'
    }
  }

  // Get variable value or dash
  const getVariableValue = (message: CampaignMessage, key: string): string => {
    if (message.variables && message.variables[key]) {
      return message.variables[key]
    }
    return '-'
  }

  // Truncate message for preview
  const truncateMessage = (message: string, maxLength: number = 50) => {
    if (message.length <= maxLength) return message
    return message.substring(0, maxLength) + '...'
  }

  // Format pause duration
  const formatPauseDuration = () => {
    if (!campaign?.pause_seconds || !campaign?.pause_after_messages) return null
    const minutes = Math.floor(campaign.pause_seconds / 60)
    const seconds = campaign.pause_seconds % 60
    if (minutes > 0 && seconds > 0) {
      return `הפוגה של ${minutes} דקות ו-${seconds} שניות אחרי כל ${campaign.pause_after_messages} הודעות`
    } else if (minutes > 0) {
      return `הפוגה של ${minutes} דקות אחרי כל ${campaign.pause_after_messages} הודעות`
    } else {
      return `הפוגה של ${seconds} שניות אחרי כל ${campaign.pause_after_messages} הודעות`
    }
  }

  // Calculate estimated campaign duration using pre-calculated delays
  const calculateEstimatedDuration = () => {
    const totalMessages = messages.length
    if (totalMessages === 0) return null

    // System constants
    const BASE_MESSAGES_PER_DAY = 90
    const BONUS_PER_VARIATION = 10 // Each variation adds 10 more messages per day

    // Calculate daily limit with variations bonus
    const variationCount = campaign?.message_variations?.length || 1
    const variationBonus = variationCount > 1 ? (variationCount - 1) * BONUS_PER_VARIATION : 0
    const messagesPerDayPerDevice = BASE_MESSAGES_PER_DAY + variationBonus

    // Multiple devices multiply the daily capacity
    const deviceCount = campaign?.multi_device && campaign?.device_ids ? campaign.device_ids.length : 1
    const totalDailyLimit = messagesPerDayPerDevice * deviceCount

    // Calculate days needed
    const daysNeeded = Math.ceil(totalMessages / totalDailyLimit)

    // Get today's messages
    const messagesForToday = Math.min(totalMessages, totalDailyLimit)

    // Sort messages by scheduled_delay_seconds to get the correct last message
    const sortedMessages = [...messages].sort((a, b) =>
      (a.scheduled_delay_seconds || 0) - (b.scheduled_delay_seconds || 0)
    )

    // Use pre-calculated delay from the last message of today's batch
    // This is the EXACT time since delays were randomly generated during campaign creation
    const lastTodayMessage = sortedMessages[messagesForToday - 1]
    let totalSeconds = lastTodayMessage?.scheduled_delay_seconds || 0

    console.log('Duration calc - messagesForToday:', messagesForToday, 'lastTodayMessage index:', messagesForToday - 1)
    console.log('Duration calc - lastTodayMessage scheduled_delay_seconds:', lastTodayMessage?.scheduled_delay_seconds)
    console.log('Duration calc - totalSeconds:', totalSeconds)

    // If no pre-calculated delays exist (old campaigns), fall back to estimation
    if (!totalSeconds) {
      console.log('Duration calc - using fallback estimation (no pre-calculated delays)')
      const MESSAGES_PER_BULK = 30
      const DELAY_MIN = campaign?.delay_min || 10
      const DELAY_MAX = campaign?.delay_max || 60
      const BULK_PAUSE_SECONDS = [30 * 60, 60 * 60, 90 * 60]

      const avgDelay = (DELAY_MIN + DELAY_MAX) / 2
      totalSeconds = messagesForToday * avgDelay

      // Add bulk pauses only for COMPLETED bulks (not the last one if it's exactly 30/60/90)
      // Only add pause if there are messages after the bulk
      const numberOfCompletedBulks = Math.floor((messagesForToday - 1) / MESSAGES_PER_BULK)
      for (let i = 0; i < numberOfCompletedBulks; i++) {
        const pauseIndex = Math.min(i, BULK_PAUSE_SECONDS.length - 1)
        totalSeconds += BULK_PAUSE_SECONDS[pauseIndex]
      }
    }

    // Format the duration
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)

    let result = ''
    if (daysNeeded > 1) {
      // Multiple days - show days and explain today's portion
      result = `כ-${daysNeeded} ימים (${messagesForToday} הודעות היום, השאר מחר)`
    } else if (hours > 0) {
      result = `${hours} שעות`
      if (minutes > 0) {
        result += ` ו-${minutes} דקות`
      }
    } else if (minutes > 0) {
      result = `${minutes} דקות`
    } else {
      result = 'פחות מדקה'
    }

    return result
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-[#030733]' : 'bg-[#f2f3f8]'}`}>
        <div className={`text-lg ${darkMode ? 'text-white' : 'text-[#030733]'}`}>טוען...</div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen p-8 ${darkMode ? 'bg-[#030733]' : 'bg-[#f2f3f8]'}`} dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => {
            if (hasUnsavedChanges && campaign?.status === 'draft') {
              setPendingNavigation('/campaigns')
              setShowLeaveConfirm(true)
            } else {
              router.push('/campaigns')
            }
          }}
          className={`p-2 rounded-lg transition-colors ${
            darkMode ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-[#030733]'
          }`}
        >
          <ArrowRight className="w-6 h-6" />
        </button>
        <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
          סיכום קמפיין
        </h1>
      </div>

      {/* Main Layout - Two columns */}
      <div className="flex gap-6">
        {/* Right side - Recipients Table */}
        <div className={`flex-1 rounded-[15px] p-6 flex flex-col max-h-[calc(100vh-180px)] ${darkMode ? 'bg-[#0a1155]' : 'bg-white'}`}>
          {/* Search and Actions */}
          <div className="flex items-center justify-between gap-4 mb-6">
            {/* Search */}
            <div className={`flex-1 max-w-md flex items-center gap-3 px-4 py-3 rounded-lg ${
              darkMode ? 'bg-[#030733]' : 'bg-[#f2f3f8]'
            }`}>
              <Search className={`w-5 h-5 ${darkMode ? 'text-white/50' : 'text-[#505050]'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש נמענים"
                className={`flex-1 bg-transparent outline-none text-sm ${
                  darkMode ? 'text-white placeholder-white/50' : 'text-[#030733] placeholder-[#505050]'
                }`}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={deleteSelected}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm">מחק</span>
              </button>
              <button
                onClick={addNewRecipient}
                disabled={campaign?.status !== 'draft'}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  campaign?.status !== 'draft'
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-[#0043e0] hover:bg-[#0036b3] text-white'
                }`}
                title={campaign?.status !== 'draft' ? 'ניתן להוסיף נמענים רק בטיוטה' : 'הוסף נמען חדש'}
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">הוסף נמען</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${darkMode ? 'border-white/10' : 'border-gray-200'}`}>
                  {/* Checkbox column */}
                  <th className="py-3 px-2 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredMessages.length && filteredMessages.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </th>
                  {/* Edit column */}
                  <th className="py-3 px-2 w-10"></th>
                  {/* Expand column */}
                  <th className="py-3 px-2 w-10"></th>
                  {/* Fixed columns */}
                  <th
                    onClick={() => handleSort('name')}
                    className={`py-3 px-3 text-right text-sm font-semibold cursor-pointer select-none ${
                      darkMode ? 'text-white' : 'text-[#030733]'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span>שם פרטי</span>
                      {sortColumn === 'name' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th className={`py-3 px-3 text-right text-sm font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                    שם משפחה
                  </th>
                  <th
                    onClick={() => handleSort('phone')}
                    className={`py-3 px-3 text-right text-sm font-semibold cursor-pointer select-none ${
                      darkMode ? 'text-white' : 'text-[#030733]'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span>מספר טלפון</span>
                      {sortColumn === 'phone' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  {/* Dynamic columns */}
                  {dynamicColumns.map(col => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className={`py-3 px-3 text-right text-sm font-semibold cursor-pointer select-none ${
                        darkMode ? 'text-white' : 'text-[#030733]'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span>{col}</span>
                        {sortColumn === col && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                  ))}
                  {/* Message column */}
                  <th
                    onClick={() => handleSort('message')}
                    className={`py-3 px-3 text-right text-sm font-semibold cursor-pointer select-none ${
                      darkMode ? 'text-white' : 'text-[#030733]'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span>ההודעה שתשלח בקמפיין</span>
                      {sortColumn === 'message' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMessages.map((message) => {
                  const nameParts = getNameParts(message.name)
                  const isExpanded = expandedIds.has(message.id)
                  const isSelected = selectedIds.has(message.id)
                  const isEditing = editingId === message.id

                  return (
                    <React.Fragment key={message.id}>
                      <tr
                        className={`border-b transition-colors ${
                          darkMode
                            ? `border-white/5 ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'}`
                            : `border-gray-100 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(message.id)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                        </td>
                        {/* Edit button */}
                        <td className="py-3 px-2">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <button
                                onClick={saveEdit}
                                className="p-1 rounded text-green-500 hover:bg-green-500/20"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 rounded text-red-500 hover:bg-red-500/20"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(message)}
                              className={`p-1 rounded transition-colors ${
                                darkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-[#505050]'
                              }`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                        {/* Expand button */}
                        <td className="py-3 px-2">
                          <button
                            onClick={() => toggleExpand(message.id)}
                            className={`p-1 rounded transition-colors ${
                              darkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-[#505050]'
                            }`}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        {/* First name */}
                        <td className={`py-3 px-3 text-sm ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData?.name.split(' ')[0] || ''}
                              onChange={(e) => {
                                const lastName = editData?.name.split(' ').slice(1).join(' ') || ''
                                setEditData(prev => prev ? { ...prev, name: `${e.target.value} ${lastName}`.trim() } : null)
                              }}
                              className={`w-full px-2 py-1 rounded text-sm ${
                                darkMode ? 'bg-[#030733] text-white' : 'bg-[#f2f3f8] text-[#030733]'
                              }`}
                            />
                          ) : (
                            nameParts.firstName
                          )}
                        </td>
                        {/* Last name */}
                        <td className={`py-3 px-3 text-sm ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData?.name.split(' ').slice(1).join(' ') || ''}
                              onChange={(e) => {
                                const firstName = editData?.name.split(' ')[0] || ''
                                setEditData(prev => prev ? { ...prev, name: `${firstName} ${e.target.value}`.trim() } : null)
                              }}
                              className={`w-full px-2 py-1 rounded text-sm ${
                                darkMode ? 'bg-[#030733] text-white' : 'bg-[#f2f3f8] text-[#030733]'
                              }`}
                            />
                          ) : (
                            nameParts.lastName
                          )}
                        </td>
                        {/* Phone */}
                        <td className={`py-3 px-3 text-sm ${darkMode ? 'text-white' : 'text-[#030733]'}`} dir="ltr">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData?.phone || ''}
                              onChange={(e) => setEditData(prev => prev ? { ...prev, phone: e.target.value } : null)}
                              className={`w-full px-2 py-1 rounded text-sm ${
                                darkMode ? 'bg-[#030733] text-white' : 'bg-[#f2f3f8] text-[#030733]'
                              }`}
                            />
                          ) : (
                            message.phone
                          )}
                        </td>
                        {/* Dynamic columns */}
                        {dynamicColumns.map(col => (
                          <td
                            key={col}
                            className={`py-3 px-3 text-sm ${darkMode ? 'text-white' : 'text-[#030733]'}`}
                          >
                            {isEditing ? (
                              <input
                                type="text"
                                value={editData?.variables[col] || ''}
                                onChange={(e) => setEditData(prev => prev ? {
                                  ...prev,
                                  variables: { ...prev.variables, [col]: e.target.value }
                                } : null)}
                                className={`w-full px-2 py-1 rounded text-sm ${
                                  darkMode ? 'bg-[#030733] text-white' : 'bg-[#f2f3f8] text-[#030733]'
                                }`}
                              />
                            ) : (
                              getVariableValue(message, col)
                            )}
                          </td>
                        ))}
                        {/* Message preview - show actual sent message if available */}
                        <td className={`py-3 px-3 text-sm ${darkMode ? 'text-white/80' : 'text-[#505050]'}`}>
                          {isEditing ? (
                            <textarea
                              value={editData?.message_content || ''}
                              onChange={(e) => setEditData(prev => prev ? { ...prev, message_content: e.target.value } : null)}
                              className={`w-full px-2 py-1 rounded text-sm min-h-[60px] ${
                                darkMode ? 'bg-[#030733] text-white' : 'bg-[#f2f3f8] text-[#030733]'
                              }`}
                            />
                          ) : (
                            truncateMessage(message.sent_message_content || message.message_content)
                          )}
                        </td>
                      </tr>
                      {/* Expanded row with full message and sender info */}
                      {isExpanded && !isEditing && (
                        <tr className={darkMode ? 'bg-white/5' : 'bg-gray-50'}>
                          <td colSpan={6 + dynamicColumns.length + 1} className="py-4 px-6">
                            {/* Sender info if exists */}
                            {message.sender_session_name && (
                              <div className={`text-sm mb-3 pb-3 border-b ${darkMode ? 'border-white/10 text-blue-400' : 'border-gray-200 text-blue-600'}`}>
                                <span className="font-medium">נשלח מ: </span>
                                <span>{message.sender_session_name}</span>
                                {message.sender_phone && (
                                  <span className="mr-2" dir="ltr">
                                    ({message.sender_phone.startsWith('972')
                                      ? `0${message.sender_phone.slice(3, 5)}-${message.sender_phone.slice(5)}`
                                      : message.sender_phone})
                                  </span>
                                )}
                              </div>
                            )}
                            <div className={`text-sm leading-relaxed whitespace-pre-wrap ${
                              darkMode ? 'text-white/90' : 'text-[#030733]'
                            }`}>
                              <span className={`font-semibold mb-2 block ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                                {message.sent_message_content ? 'ההודעה שנשלחה:' : 'ההודעה המלאה:'}
                              </span>
                              {message.sent_message_content || message.message_content}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>

            {/* Empty state */}
            {filteredMessages.length === 0 && (
              <div className={`py-12 text-center ${darkMode ? 'text-white/50' : 'text-[#505050]'}`}>
                {searchQuery ? 'לא נמצאו תוצאות' : 'אין נמענים בקמפיין זה'}
              </div>
            )}
          </div>
        </div>

        {/* Left side - Campaign Info */}
        <div className="w-[400px] flex flex-col gap-4">
          {/* Campaign Data Card */}
          <div className={`rounded-[15px] p-6 ${darkMode ? 'bg-[#0a1155]' : 'bg-white'}`}>
            <h2 className={`text-[32px] font-semibold mb-6 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              נתוני הקמפיין
            </h2>

            <div className={`space-y-3 text-[16px] leading-[24.8px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              <p>
                <span className="font-semibold">שם הקמפיין - </span>
                <span className="font-normal">{campaign?.name}</span>
              </p>

              {campaign?.scheduled_at && (
                <p>
                  <span className="font-semibold">תזמון הקמפיין - </span>
                  <span className="font-normal">
                    ל-{new Date(campaign.scheduled_at).toLocaleDateString('he-IL')} בשעה {new Date(campaign.scheduled_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>
              )}

              {formatPauseDuration() && (
                <p>
                  <span className="font-semibold">הפוגת שליחה - </span>
                  <span className="font-normal">{formatPauseDuration()}</span>
                </p>
              )}

              {campaign?.new_list_name && (
                <p>
                  <span className="font-semibold">רשימת לקוחות חדשה - </span>
                  <span className="font-normal">תיווצר בעת ההפצה</span>
                </p>
              )}

              {existingListName && (
                <p>
                  <span className="font-semibold">שיוך רשימה - </span>
                  <span className="font-normal">הנמענים ברשימה זו יכנסו לרשימת הלקוחות "{existingListName}"</span>
                </p>
              )}

              <p>
                <span className="font-semibold">סה"כ נמענים - </span>
                <span className="font-normal">{messages.length}</span>
              </p>

              {campaign?.multi_device && campaign?.device_ids && campaign.device_ids.length > 1 && (
                <p>
                  <span className="font-semibold">מכשירים - </span>
                  <span className="font-normal">{campaign.device_ids.length} מכשירים (עד {campaign.device_ids.length * 90} הודעות ליום)</span>
                </p>
              )}

              {campaign?.message_variations && campaign.message_variations.length > 1 && (
                <p>
                  <span className="font-semibold">וריאציות הודעה - </span>
                  <span className="font-normal">{campaign.message_variations.length} וריאציות</span>
                </p>
              )}

              {campaign?.poll_question && campaign?.poll_options && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <span className="font-semibold block mb-2">סקר מצורף:</span>
                  <div className={`p-3 rounded-lg ${darkMode ? 'bg-[#030733]' : 'bg-[#f2f3f8]'}`}>
                    <p className="font-medium mb-2">{campaign.poll_question}</p>
                    <ul className="space-y-1">
                      {campaign.poll_options.map((option, idx) => (
                        <li key={idx} className={`text-sm flex items-center gap-2 ${darkMode ? 'text-white/70' : 'text-[#505050]'}`}>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-xs ${
                            darkMode ? 'border-white/30' : 'border-gray-300'
                          }`}>
                            {idx + 1}
                          </span>
                          {option}
                        </li>
                      ))}
                    </ul>
                    {campaign.poll_multiple_answers && (
                      <p className={`text-xs mt-2 ${darkMode ? 'text-white/50' : 'text-gray-400'}`}>
                        * ניתן לבחור מספר תשובות
                      </p>
                    )}
                  </div>
                </div>
              )}

              {calculateEstimatedDuration() && (
                <p>
                  <span className="font-semibold">זמן משוער לסיום - </span>
                  <span className="font-normal">{calculateEstimatedDuration()}</span>
                </p>
              )}
            </div>
          </div>

          {/* Launch Button */}
          <button
            onClick={launchCampaign}
            disabled={launching || campaign?.status === 'running' || campaign?.status === 'completed'}
            className="w-full h-[47px] px-[14px] py-[7px] bg-[#030733] text-white rounded-[10px] text-[16px] font-semibold hover:bg-[#0a1155] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {launching ? 'משגר...' : 'סיימתי לעבור על הנתונים, שגר את הקמפיין!'}
          </button>

          {/* Back Button */}
          <button
            onClick={() => router.push(`/campaigns/new?edit=${campaignId}`)}
            disabled={campaign?.status !== 'draft'}
            className={`w-full h-[47px] px-[14px] py-[7px] rounded-[10px] text-[16px] font-semibold transition-colors flex items-center justify-center gap-2 ${
              campaign?.status !== 'draft'
                ? darkMode
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : darkMode
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-[#f2f3f8] text-[#030733] hover:bg-gray-200'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
            <span>חזרה לעריכת הקמפיין</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDeleteSelected}
        title={`האם למחוק ${selectedIds.size} רשומות?`}
        subtitle="פעולה זו לא ניתנת לביטול"
        confirmText="כן, מחק"
        cancelText="לא, בטל"
        variant="danger"
      />

      {/* Launch Campaign Confirmation Modal */}
      <ConfirmModal
        isOpen={showLaunchConfirm}
        onClose={() => setShowLaunchConfirm(false)}
        onConfirm={confirmLaunchCampaign}
        title="האם לשגר את הקמפיין?"
        subtitle={`יישלחו ${messages.length} הודעות`}
        confirmText="כן, שגר!"
        cancelText="לא, חזור"
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      {/* Leave Page Confirmation */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className={`w-full max-w-[400px] rounded-[15px] p-4 sm:p-[20px] ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}>
            <div className="flex items-center justify-center mb-[15px]">
              <div className={`w-[50px] h-[50px] rounded-full flex items-center justify-center ${
                darkMode ? 'bg-orange-900/30' : 'bg-orange-100'
              }`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#fb923c' : '#ea580c'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
            </div>
            <h3 className={`text-[17px] font-semibold text-center mb-2 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              האם אתה בטוח שברצונך לעזוב?
            </h3>
            <p className={`text-[14px] text-center mb-[20px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
              יש לך שינויים שלא נשמרו. אם תעזוב את הדף, תאבד את השינויים האלו.
            </p>
            <div className="flex gap-[10px]">
              <button
                onClick={() => {
                  setShowLeaveConfirm(false)
                  setPendingNavigation(null)
                }}
                className={`flex-1 h-[40px] rounded-[10px] text-[14px] font-medium ${
                  darkMode ? 'bg-[#0a1628] text-gray-400 hover:text-white' : 'bg-[#f2f3f8] text-[#595C7A] hover:text-[#030733]'
                } transition-colors`}
              >
                להישאר בדף
              </button>
              <button
                onClick={() => {
                  setShowLeaveConfirm(false)
                  setHasUnsavedChanges(false)
                  if (pendingNavigation) {
                    router.push(pendingNavigation)
                  }
                }}
                className="flex-1 h-[40px] bg-red-600 text-white rounded-[10px] text-[14px] font-medium hover:bg-red-700 transition-colors"
              >
                עזוב ומחק שינויים
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
