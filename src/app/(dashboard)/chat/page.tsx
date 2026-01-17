'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/contexts/ThemeContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { formatPhoneForDisplay } from '@/lib/phone-utils'
import {
  Search,
  Send,
  Paperclip,
  Smile,
  Phone,
  Video,
  Check,
  CheckCheck,
  Mic,
  X,
  Calendar,
  MessageSquare,
  Loader2,
  Pin,
} from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { he } from 'date-fns/locale'

interface ChatContact {
  id: string
  name: string
  phone: string
  lastMessage: string
  lastMessageTime: string
  lastMessageTimestamp: number | null
  unreadCount: number
  isOnline: boolean
  avatar?: string
  labels: string[]
  isPinned?: boolean
  isFavorite?: boolean
  isGroup?: boolean
}

interface Message {
  id: string
  content: string
  fromMe: boolean
  timestamp: string
  status: 'sent' | 'delivered' | 'read'
}

interface Label {
  id: string
  name: string
  color: string
}

interface ClientNote {
  id: string
  content: string
  timestamp: string
}

interface LiveCampaign {
  id: string
  name: string
  status: string
  total_recipients: number
  sent_count: number
  failed_count: number
  estimated_duration?: number
  started_at?: string
}

interface CampaignMessage {
  id: string
  phone: string
  status: string
  contact_name?: string
  sent_at?: string
  failed_at?: string
  created_at?: string
}

const labels: Label[] = [
  { id: 'vip', name: 'VIP', color: '#FFD700' },
  { id: 'lead', name: 'ליד חדש', color: '#4CAF50' },
  { id: 'hot', name: 'חם', color: '#F44336' },
  { id: 'pending', name: 'ממתין', color: '#2196F3' },
  { id: 'done', name: 'הושלם', color: '#9E9E9E' },
]

export default function ChatPage() {
  const { darkMode } = useTheme()
  const { selectedConnection } = useConnection()
  const [contacts, setContacts] = useState<ChatContact[]>([])
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [rightPanelTab, setRightPanelTab] = useState<'live' | 'campaign'>('campaign')
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'groups' | 'favorites'>('all')
  const [loading, setLoading] = useState(true)
  const [showContactsList, setShowContactsList] = useState(true)
  const [connectionNotActive, setConnectionNotActive] = useState(false)
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [showCrmPanel, setShowCrmPanel] = useState(true)
  const [liveCampaign, setLiveCampaign] = useState<LiveCampaign | null>(null)
  const [campaignMessages, setCampaignMessages] = useState<CampaignMessage[]>([])
  const [remainingTime, setRemainingTime] = useState<{ minutes: number; seconds: number } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Cache key for profile pictures
  const PROFILE_CACHE_KEY = 'chat_profile_pictures'
  const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

  // Get cached profile picture
  const getCachedPicture = (contactId: string): string | null => {
    try {
      const cache = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || '{}')
      const entry = cache[contactId]
      if (entry && Date.now() - entry.timestamp < CACHE_EXPIRY_MS) {
        return entry.url
      }
    } catch {
      // Ignore cache errors
    }
    return null
  }

  // Save profile picture to cache
  const setCachedPicture = (contactId: string, url: string) => {
    try {
      const cache = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || '{}')
      cache[contactId] = { url, timestamp: Date.now() }
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache))
    } catch {
      // Ignore cache errors
    }
  }

  // Apply cached pictures to contacts list
  const applyCachedPictures = (contactsList: ChatContact[]): ChatContact[] => {
    return contactsList.map(contact => {
      if (!contact.avatar) {
        const cachedUrl = getCachedPicture(contact.id)
        if (cachedUrl) {
          return { ...contact, avatar: cachedUrl }
        }
      }
      return contact
    })
  }

  // Fetch profile pictures in background - loads all contacts sequentially for stability
  const fetchProfilePictures = async (contactsList: ChatContact[]) => {
    if (!selectedConnection) return

    // Get contacts without pictures (and not in cache)
    const contactsToFetch = contactsList.filter(c => !c.avatar && !getCachedPicture(c.id))

    for (const contact of contactsToFetch) {
      try {
        const response = await fetch(
          `/api/chat/profile-picture?connectionId=${selectedConnection.id}&contactId=${encodeURIComponent(contact.id)}`
        )
        if (response.ok) {
          const data = await response.json()
          if (data.picture) {
            // Save to cache
            setCachedPicture(contact.id, data.picture)
            // Update state
            setContacts(prev => prev.map(c =>
              c.id === contact.id ? { ...c, avatar: data.picture } : c
            ))
          }
        }
        // Small delay between requests for stability (100ms)
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch {
        // Silently fail for individual picture fetches
      }
    }
  }

  // Load conversations when selected connection changes
  useEffect(() => {
    if (selectedConnection) {
      loadConversations()
    } else {
      setContacts([])
      setLoading(false)
    }
  }, [selectedConnection])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load live campaign for selected connection
  useEffect(() => {
    if (selectedConnection) {
      loadLiveCampaign()
      // Set up real-time subscription for campaign updates only
      const supabase = createClient()
      const channel = supabase
        .channel('live-campaign-updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'campaigns',
          filter: `connection_id=eq.${selectedConnection.id}`
        }, () => {
          loadLiveCampaign()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } else {
      setLiveCampaign(null)
      setCampaignMessages([])
    }
  }, [selectedConnection])

  // Separate subscription for campaign messages - depends on liveCampaign
  useEffect(() => {
    if (!liveCampaign) return

    const supabase = createClient()
    const channel = supabase
      .channel(`campaign-messages-${liveCampaign.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'campaign_messages',
        filter: `campaign_id=eq.${liveCampaign.id}`
      }, () => {
        console.log('[DEBUG] Campaign messages subscription triggered for campaign:', liveCampaign.id)
        loadCampaignMessages(liveCampaign.id)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [liveCampaign?.id])

  // Countdown timer for live campaign
  useEffect(() => {
    if (!liveCampaign || !liveCampaign.estimated_duration || !liveCampaign.started_at || liveCampaign.status !== 'running') {
      setRemainingTime(null)
      return
    }

    const updateTimer = () => {
      const startTime = new Date(liveCampaign.started_at!).getTime()
      const now = Date.now()
      const elapsedSeconds = Math.floor((now - startTime) / 1000)
      const remainingSeconds = Math.max(0, liveCampaign.estimated_duration! - elapsedSeconds)
      const minutes = Math.floor(remainingSeconds / 60)
      const seconds = remainingSeconds % 60
      setRemainingTime({ minutes, seconds })
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [liveCampaign])

  const loadLiveCampaign = async () => {
    if (!selectedConnection) return

    try {
      const supabase = createClient()
      // Search for campaigns that use this connection (either as primary or in multi-device)
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name, status, total_recipients, sent_count, failed_count, estimated_duration, started_at')
        .or(`connection_id.eq.${selectedConnection.id},device_ids.cs.{${selectedConnection.id}}`)
        .in('status', ['running', 'paused'])
        .order('started_at', { ascending: false })
        .limit(1)

      if (campaigns && campaigns.length > 0) {
        setLiveCampaign(campaigns[0])
        loadCampaignMessages(campaigns[0].id)
      } else {
        setLiveCampaign(null)
        setCampaignMessages([])
      }
    } catch (err) {
      console.error('Error loading live campaign:', err)
      setLiveCampaign(null)
      setCampaignMessages([])
    }
  }

  const loadCampaignMessages = async (campaignId: string) => {
    try {
      const supabase = createClient()
      const { data: messages, error } = await supabase
        .from('campaign_messages')
        .select('id, phone, status, name, sent_at, failed_at, created_at')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) {
        console.error('Error loading campaign messages:', error)
        setCampaignMessages([])
        return
      }

      if (messages) {
        console.log('[DEBUG] Campaign messages from DB:', messages.slice(0, 5))
        // Map 'name' to 'contact_name' for UI consistency
        setCampaignMessages(messages.map(m => ({
          id: m.id,
          phone: m.phone,
          status: m.status,
          contact_name: m.name || undefined,
          sent_at: m.sent_at || undefined,
          failed_at: m.failed_at || undefined,
          created_at: m.created_at || undefined
        })))
      }
    } catch (err) {
      console.error('Error loading campaign messages:', err)
      setCampaignMessages([])
    }
  }

  const loadConversations = async () => {
    if (!selectedConnection) return

    setLoading(true)
    setConnectionNotActive(false)

    // Check if connection is active
    if (selectedConnection.status !== 'connected') {
      setConnectionNotActive(true)
      setContacts([])
      setLoading(false)
      return
    }

    try {
      // First try to get chats directly from WAHA
      const wahaResponse = await fetch(`/api/chat/waha-chats?connectionId=${selectedConnection.id}`)

      if (wahaResponse.ok) {
        const wahaData = await wahaResponse.json()

        // Check if connection is not active (API returns error)
        if (wahaData.error === 'Connection is not active') {
          setConnectionNotActive(true)
          setContacts([])
          setLoading(false)
          return
        }

        if (wahaData.chats && wahaData.chats.length > 0) {
          setConnectionNotActive(false)
          const formattedContacts: ChatContact[] = wahaData.chats.map((chat: any) => {
            const phone = chat.chat_id.replace('@c.us', '').replace('@g.us', '')
            const isGroup = chat.chat_id.endsWith('@g.us')
            const messageDate = chat.last_message_time ? new Date(chat.last_message_time) : null

            // Format time display: show date if not today, otherwise just time
            let timeDisplay = '-'
            if (messageDate) {
              if (isToday(messageDate)) {
                timeDisplay = format(messageDate, 'HH:mm', { locale: he })
              } else if (isYesterday(messageDate)) {
                timeDisplay = 'אתמול'
              } else {
                timeDisplay = format(messageDate, 'dd/MM/yy', { locale: he })
              }
            }

            return {
              id: chat.chat_id,
              name: chat.name || (isGroup ? `קבוצה ${phone}` : formatPhoneForDisplay(phone)),
              phone: phone,
              lastMessage: chat.last_message || '',
              lastMessageTime: timeDisplay,
              lastMessageTimestamp: messageDate ? messageDate.getTime() : null,
              unreadCount: chat.unread_count || 0,
              isOnline: false,
              labels: [],
              isGroup: isGroup,
              isPinned: chat.pinned || false,
              avatar: chat.picture || undefined,
            }
          })
          // Apply cached pictures first, then fetch missing ones
          const contactsWithCache = applyCachedPictures(formattedContacts)
          setContacts(contactsWithCache)
          // Fetch profile pictures in background for uncached contacts
          fetchProfilePictures(contactsWithCache)
          setLoading(false)
          return
        }
      }

      // Fallback: try to get from database (messages received via webhook)
      const response = await fetch(`/api/chat/conversations?connectionId=${selectedConnection.id}`)

      if (response.ok) {
        const data = await response.json()

        const formattedContacts: ChatContact[] = (data.conversations || []).map((conv: any) => {
          const phone = conv.chat_id.replace('@c.us', '').replace('@g.us', '')
          const isGroup = conv.chat_id.endsWith('@g.us')
          const messageDate = conv.last_message_time ? new Date(conv.last_message_time) : null

          // Format time display: show date if not today, otherwise just time
          let timeDisplay = '-'
          if (messageDate) {
            if (isToday(messageDate)) {
              timeDisplay = format(messageDate, 'HH:mm', { locale: he })
            } else if (isYesterday(messageDate)) {
              timeDisplay = 'אתמול'
            } else {
              timeDisplay = format(messageDate, 'dd/MM/yy', { locale: he })
            }
          }

          return {
            id: conv.chat_id,
            name: isGroup ? `קבוצה ${phone}` : formatPhoneForDisplay(phone),
            phone: phone,
            lastMessage: conv.last_message || '',
            lastMessageTime: timeDisplay,
            lastMessageTimestamp: messageDate ? messageDate.getTime() : null,
            unreadCount: conv.unread_count || 0,
            isOnline: false,
            labels: [],
            isGroup: isGroup,
            isPinned: false,
            avatar: undefined,
          }
        })
        // Apply cached pictures first, then fetch missing ones
        const contactsWithCache = applyCachedPictures(formattedContacts)
        setContacts(contactsWithCache)
        // Fetch profile pictures in background for uncached contacts
        fetchProfilePictures(contactsWithCache)
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    }
    setLoading(false)
  }

  const loadMessages = async (chatId: string) => {
    if (!selectedConnection) return

    try {
      // First try to get messages directly from WAHA
      const wahaResponse = await fetch(
        `/api/chat/waha-messages?connectionId=${selectedConnection.id}&chatId=${encodeURIComponent(chatId)}&limit=100`
      )

      if (wahaResponse.ok) {
        const wahaData = await wahaResponse.json()

        if (wahaData.messages && wahaData.messages.length > 0) {
          const formattedMessages: Message[] = wahaData.messages.map((m: any) => ({
            id: m.id,
            content: m.content || '',
            fromMe: m.from_me,
            timestamp: m.timestamp,
            status: m.ack >= 3 ? 'read' : m.ack >= 2 ? 'delivered' : 'sent',
          }))
          setMessages(formattedMessages)
          return
        }
      }

      // Fallback: try to get from database
      const response = await fetch(
        `/api/chat/history?connectionId=${selectedConnection.id}&chatId=${encodeURIComponent(chatId)}&limit=100`
      )
      if (response.ok) {
        const data = await response.json()
        const formattedMessages: Message[] = (data.messages || []).map((m: any) => ({
          id: m.id,
          content: m.content || '',
          fromMe: m.from_me,
          timestamp: m.timestamp,
          status: m.ack >= 3 ? 'read' : m.ack >= 2 ? 'delivered' : 'sent',
        }))
        setMessages(formattedMessages)
      } else {
        setMessages([])
      }
    } catch (error) {
      console.error('Error loading messages:', error)
      setMessages([])
    }
  }

  const handleSelectContact = (contact: ChatContact) => {
    setSelectedContact(contact)
    loadMessages(contact.id)
    // Hide contacts list on mobile when a contact is selected
    if (window.innerWidth < 1024) {
      setShowContactsList(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || !selectedConnection) return

    const messageContent = newMessage
    setNewMessage('')

    // Add message optimistically
    const tempMessage: Message = {
      id: Date.now().toString(),
      content: messageContent,
      fromMe: true,
      timestamp: new Date().toISOString(),
      status: 'sent',
    }
    setMessages(prev => [...prev, tempMessage])

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnection.id,
          chatId: selectedContact.id,
          content: messageContent,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Update the temp message with the real message ID
        setMessages(prev =>
          prev.map(m =>
            m.id === tempMessage.id
              ? { ...m, id: data.messageId || m.id, status: 'delivered' as const }
              : m
          )
        )
      } else {
        // Mark message as failed
        console.error('Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const filteredContacts = contacts
    .filter(c => {
      // Apply chat filter
      if (chatFilter === 'unread' && c.unreadCount === 0) return false
      if (chatFilter === 'groups' && !c.isGroup) return false
      if (chatFilter === 'favorites' && !c.isFavorite) return false
      // Apply search query
      return c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery)
    })
    .sort((a, b) => {
      // Pinned contacts first
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      // Then sort by timestamp (most recent first)
      const aTime = a.lastMessageTimestamp || 0
      const bTime = b.lastMessageTimestamp || 0
      return bTime - aTime
    })

  const formatMessageTime = (timestamp: string) => format(new Date(timestamp), 'HH:mm')

  const formatDateHeader = (timestamp: string) => {
    const date = new Date(timestamp)
    if (isToday(date)) return 'היום'
    if (isYesterday(date)) return 'אתמול'
    return format(date, 'dd/MM/yyyy', { locale: he })
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-[#0043E0]" />
      </div>
    )
  }

  if (!selectedConnection) {
    return (
      <div className="h-full flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <MessageSquare className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`} />
          <h2 className={`text-[18px] font-semibold mb-2 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
            אין חיבור WhatsApp פעיל
          </h2>
          <p className={`text-[14px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
            בחר חיבור מהתפריט הצדדי כדי לראות את הצ'אטים
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-60px)] lg:h-[calc(100vh-38px)] flex flex-col lg:flex-row p-2 sm:p-3 md:p-4 lg:p-5 xl:p-6 2xl:p-[35px] gap-2 sm:gap-3 md:gap-4 lg:gap-5 xl:gap-6 2xl:gap-[20px]" dir="rtl">
      {/* Right Panel - Contacts List */}
      <div className={`${showContactsList ? 'flex' : 'hidden'} lg:flex w-full lg:w-[300px] xl:w-[360px] 2xl:w-[422px] rounded-[16px] flex-col overflow-hidden ${darkMode ? 'bg-[#142241]' : 'bg-[#F2F3F8]'} ${!selectedContact ? 'flex-1 lg:flex-none' : ''}`}>
        {/* Search */}
        <div className="px-4 pt-4 pb-3">
          <div className="relative">
            <input
              type="text"
              placeholder="חפש או התחל צ'אט חדש"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full h-[47px] pr-4 pl-[45px] rounded-[8px] text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0] ${
                darkMode ? 'bg-[#1a2d4a] text-white placeholder-gray-400' : 'bg-white text-[#505050] placeholder-[#505050]'
              }`}
            />
            <Search className={`w-[20px] h-[20px] absolute left-[15px] top-1/2 -translate-y-1/2 ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          <button
            onClick={() => setChatFilter('all')}
            className={`px-[15px] py-[5px] rounded-[8px] text-[13px] transition-colors ${
              chatFilter === 'all'
                ? 'bg-[#030733] text-white'
                : darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-white text-[#030733]'
            }`}
          >
            הכל
          </button>
          <button
            onClick={() => setShowLabelModal(true)}
            className={`px-[15px] py-[5px] rounded-[8px] text-[13px] transition-colors ${
              darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-white text-[#030733]'
            }`}
          >
            Label
          </button>
          <button
            onClick={() => setChatFilter('favorites')}
            className={`px-[15px] py-[5px] rounded-[8px] text-[13px] transition-colors ${
              chatFilter === 'favorites'
                ? 'bg-[#030733] text-white'
                : darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-white text-[#030733]'
            }`}
          >
            מועדפים
          </button>
          <button
            onClick={() => setChatFilter('groups')}
            className={`px-[15px] py-[5px] rounded-[8px] text-[13px] transition-colors ${
              chatFilter === 'groups'
                ? 'bg-[#030733] text-white'
                : darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-white text-[#030733]'
            }`}
          >
            קבוצות
          </button>
          <button
            onClick={() => setChatFilter('unread')}
            className={`px-[15px] py-[5px] rounded-[8px] text-[13px] transition-colors ${
              chatFilter === 'unread'
                ? 'bg-[#030733] text-white'
                : darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-white text-[#030733]'
            }`}
          >
            לא נקרא
          </button>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          {connectionNotActive ? (
            <div className="p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7 2xl:p-8 text-center">
              <MessageSquare className={`w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 xl:w-11 xl:h-11 2xl:w-12 2xl:h-12 mx-auto mb-2 sm:mb-3 md:mb-3.5 lg:mb-4 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`} />
              <p className={`text-[12px] sm:text-[13px] md:text-[14px] font-medium mb-1 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>החיבור לא פעיל</p>
              <p className={`text-[11px] sm:text-[12px] md:text-[13px] ${darkMode ? 'text-gray-300' : 'text-[#505050]'}`}>
                סטטוס: {selectedConnection?.status || 'לא ידוע'}
              </p>
              <p className={`text-[10px] sm:text-[11px] md:text-[12px] mt-2 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                יש לחבר את המכשיר דרך דף החיבורים
              </p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7 2xl:p-8 text-center">
              <MessageSquare className={`w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 xl:w-11 xl:h-11 2xl:w-12 2xl:h-12 mx-auto mb-2 sm:mb-3 md:mb-3.5 lg:mb-4 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`} />
              <p className={`text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] ${darkMode ? 'text-gray-300' : 'text-[#505050]'}`}>אין שיחות עדיין</p>
            </div>
          ) : (
            filteredContacts.map((contact, index) => (
              <div key={contact.id}>
                {/* Separator line */}
                {index > 0 && (
                  <div className={`h-[0.5px] mx-4 ${darkMode ? 'bg-white/20' : 'bg-[rgba(3,7,51,0.38)]'}`} />
                )}
                <div
                  onClick={() => handleSelectContact(contact)}
                  className={`flex items-center gap-3 p-4 cursor-pointer transition-colors relative ${
                    darkMode
                      ? selectedContact?.id === contact.id ? 'bg-[#1a2d4a]' : 'hover:bg-[#1a2d4a]'
                      : selectedContact?.id === contact.id ? 'bg-white' : 'hover:bg-white/50'
                  }`}
                >
                  {/* Selected indicator bar */}
                  {selectedContact?.id === contact.id && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-[25px] bg-[#030733] rounded-[1.5px]" />
                  )}

                  {/* Avatar */}
                  <div className="w-[50px] h-[50px] rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {contact.avatar ? (
                      <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-[18px] font-medium">
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Contact info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-medium text-[16px] truncate ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                        {contact.name}
                      </h3>
                      <span className={`text-[12px] font-light ${darkMode ? 'text-gray-400' : 'text-[#030733]'}`}>
                        {contact.lastMessageTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className={`text-[13px] font-light truncate flex-1 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                        {contact.lastMessage || formatPhoneForDisplay(contact.phone)}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0 mr-2">
                        {/* Unread count badge */}
                        {contact.unreadCount > 0 && (
                          <div className="w-[20px] h-[20px] bg-[#0043E0] rounded-full flex items-center justify-center">
                            <span className="text-white text-[11px] font-medium">
                              {contact.unreadCount}
                            </span>
                          </div>
                        )}
                        {/* Pin icon */}
                        {contact.isPinned && (
                          <Pin className={`w-[16px] h-[16px] rotate-45 ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Middle - Chat Area */}
      {selectedContact ? (
        <div className={`${!showContactsList ? 'flex' : 'hidden'} lg:flex flex-1 rounded-[10px] sm:rounded-[12px] md:rounded-[14px] lg:rounded-[16px] xl:rounded-[18px] flex-col overflow-hidden ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}>
          {/* Chat Header */}
          <div className="h-[46px] sm:h-[50px] md:h-[54px] lg:h-[58px] xl:h-[61px] bg-[#030733] flex items-center justify-between px-2.5 sm:px-3 md:px-4 lg:px-5 xl:px-6 2xl:px-[26px]">
            <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
              {/* Back button on mobile */}
              <button
                onClick={() => setShowContactsList(true)}
                className="lg:hidden p-1 sm:p-1.5 text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <img
                src={selectedContact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedContact.name)}&background=random`}
                alt={selectedContact.name}
                className="w-[26px] h-[26px] sm:w-[28px] sm:h-[28px] md:w-[30px] md:h-[30px] lg:w-[33px] lg:h-[33px] xl:w-[35px] xl:h-[35px] rounded-full"
              />
              <span className="text-white text-[12px] sm:text-[13px] md:text-[14px] lg:text-[15px] xl:text-[16px] font-medium truncate max-w-[120px] sm:max-w-[150px] md:max-w-none">{selectedContact.name}</span>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 md:gap-1.5 lg:gap-2">
              <button className="p-1 sm:p-1.5 md:p-2 text-white hover:bg-white/10 rounded-lg transition-colors hidden md:block">
                <Search className="w-[14px] h-[14px] sm:w-[16px] sm:h-[16px] md:w-[18px] md:h-[18px] lg:w-[20px] lg:h-[20px]" />
              </button>
              <button className="p-1 sm:p-1.5 md:p-2 text-white hover:bg-white/10 rounded-lg transition-colors">
                <Phone className="w-[14px] h-[14px] sm:w-[16px] sm:h-[16px] md:w-[18px] md:h-[18px] lg:w-[20px] lg:h-[20px]" />
              </button>
              <button className="p-1 sm:p-1.5 md:p-2 text-white hover:bg-white/10 rounded-lg transition-colors hidden md:block">
                <Video className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px] md:w-[23px] md:h-[23px] lg:w-[26px] lg:h-[26px]" />
              </button>
              {/* Toggle CRM Panel button - only show when panel is closed */}
              {!showCrmPanel && (
                <button
                  onClick={() => setShowCrmPanel(true)}
                  className="p-1 sm:p-1.5 md:p-2 text-white hover:bg-white/10 rounded-lg transition-colors hidden lg:block"
                  title="פתח פאנל CRM"
                >
                  <svg width="20" height="20" viewBox="0 0 15 15" fill="none">
                    <path d="M5.15625 2.8125L9.84375 7.5L5.15625 12.1875" stroke="white" strokeWidth="0.9375" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className={`flex-1 overflow-y-auto px-4 sm:px-5 md:px-6 lg:px-8 py-4 space-y-3 sm:space-y-4 ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageSquare className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 mx-auto mb-2 sm:mb-3 md:mb-4 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`} />
                  <p className={`text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] ${darkMode ? 'text-gray-300' : 'text-[#505050]'}`}>אין הודעות עדיין</p>
                  <p className={`text-[9px] sm:text-[10px] md:text-[11px] lg:text-[12px] mt-1 md:mt-2 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>התחל שיחה על ידי שליחת הודעה</p>
                </div>
              </div>
            ) : (
              messages.map((message, index) => {
                const showDateHeader = index === 0 || formatDateHeader(message.timestamp) !== formatDateHeader(messages[index - 1].timestamp)
                return (
                  <div key={message.id}>
                    {showDateHeader && (
                      <div className="flex justify-center my-4">
                        <span className={`text-[14px] px-[10px] py-[4px] rounded-[4px] ${darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-[#E6E6E6] text-[#030733]'}`}>
                          {formatDateHeader(message.timestamp)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${message.fromMe ? 'justify-start' : 'justify-end'}`}>
                      <div className={`flex items-start max-w-[65%] ${message.fromMe ? 'flex-row' : 'flex-row-reverse'}`}>
                        {/* Message tail */}
                        <svg className={`w-[10px] h-[12px] flex-shrink-0 ${message.fromMe ? '-mr-[1px]' : '-ml-[1px]'}`} viewBox="0 0 10 12" fill="none">
                          {message.fromMe ? (
                            <path d="M8.84769 1.28878C9.37258 0.86863 9.07597 0 8.40363 0H0V11.5C0 11.5 2.6479 6.9771 4.8125 4.8125C6.01732 3.60768 7.64296 2.25312 8.84769 1.28878Z" fill="#187C55"/>
                          ) : (
                            <path d="M1.15231 1.28878C0.627424 0.86863 0.924033 0 1.59637 0H10V11.5C10 11.5 7.3521 6.9771 5.1875 4.8125C3.98268 3.60768 2.35704 2.25312 1.15231 1.28878Z" fill={darkMode ? '#1a2d4a' : '#F2F3F8'}/>
                          )}
                        </svg>
                        <div
                          className={`min-w-0 rounded-[6px] px-[10px] py-[8px] ${
                            message.fromMe
                              ? 'bg-[#187C55] text-white rounded-tr-none'
                              : darkMode ? 'bg-[#1a2d4a] text-white rounded-tl-none' : 'bg-[#F2F3F8] text-[#030733] rounded-tl-none'
                          }`}
                        >
                          <p className="text-[12px] leading-[18.6px] whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{message.content}</p>
                          <div className="flex items-center gap-1 mt-1 justify-start">
                            <span className={`text-[12px] leading-[18.6px] font-light ${message.fromMe ? 'text-[#DEDEDE]' : darkMode ? 'text-gray-400' : 'text-[#2D2D2D]'}`}>{formatMessageTime(message.timestamp)}</span>
                            {message.fromMe && (
                              message.status === 'read' ? <CheckCheck className="w-[11px] h-[11px] text-[#53BDEB]" /> :
                              message.status === 'delivered' ? <CheckCheck className="w-[11px] h-[11px] text-[#DEDEDE]" /> :
                              <Check className="w-[11px] h-[11px] text-[#DEDEDE]" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="px-3 sm:px-4 md:px-5 lg:px-6 pb-3 sm:pb-4 md:pb-5 lg:pb-6">
            <div className="h-[49px] bg-[#030733] rounded-[13px] flex items-center px-3 gap-2 relative">
              {/* Left side - Plus, Emoji, Mic icons */}
              <div className="flex items-center gap-2">
                {/* Plus icon */}
                <button className="p-1 text-white hover:text-white/80 transition-colors">
                  <svg width="21" height="21" viewBox="0 0 21 21" fill="none">
                    <path d="M5.25 10.5H10.5M10.5 10.5H15.75M10.5 10.5V5.25M10.5 10.5V15.75" stroke="white" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {/* Emoji icon */}
                <button className="p-1 text-white hover:text-white/80 transition-colors">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <g clipPath="url(#clip0_emoji)">
                      <path d="M6.4987 11.9154C3.50715 11.9154 1.08203 9.49021 1.08203 6.4987C1.08203 3.50715 3.50715 1.08203 6.4987 1.08203C9.49021 1.08203 11.9154 3.50715 11.9154 6.4987C11.9154 9.49021 9.49021 11.9154 6.4987 11.9154Z" stroke="white" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8.9375 7.85547C8.9375 7.85547 8.125 8.9388 6.5 8.9388C4.875 8.9388 4.0625 7.85547 4.0625 7.85547" stroke="white" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8.39583 4.8737C8.24628 4.8737 8.125 4.75244 8.125 4.60286C8.125 4.45329 8.24628 4.33203 8.39583 4.33203C8.54539 4.33203 8.66667 4.45329 8.66667 4.60286C8.66667 4.75244 8.54539 4.8737 8.39583 4.8737Z" fill="white" stroke="white" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4.60286 4.8737C4.45329 4.8737 4.33203 4.75244 4.33203 4.60286C4.33203 4.45329 4.45329 4.33203 4.60286 4.33203C4.75244 4.33203 4.8737 4.45329 4.8737 4.60286C4.8737 4.75244 4.75244 4.8737 4.60286 4.8737Z" fill="white" stroke="white" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round"/>
                    </g>
                    <defs>
                      <clipPath id="clip0_emoji">
                        <rect width="13" height="13" fill="white"/>
                      </clipPath>
                    </defs>
                  </svg>
                </button>
                {/* Mic icon */}
                <button className="p-1 text-white hover:text-white/80 transition-colors">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 10.1563C7.36195 10.1563 8.1886 9.81384 8.7981 9.20435C9.40759 8.59485 9.75 7.7682 9.75 6.90625V6.09375M6.5 10.1563C5.63805 10.1563 4.8114 9.81384 4.2019 9.20435C3.59241 8.59485 3.25 7.7682 3.25 6.90625V6.09375M6.5 10.1563V12.1875M4.46875 12.1875H8.53125M6.5 8.53125C6.06902 8.53125 5.6557 8.36005 5.35095 8.0553C5.0462 7.75055 4.875 7.33723 4.875 6.90625V2.4375C4.875 2.00652 5.0462 1.5932 5.35095 1.28845C5.6557 0.983705 6.06902 0.8125 6.5 0.8125C6.93098 0.8125 7.3443 0.983705 7.64905 1.28845C7.9538 1.5932 8.125 2.00652 8.125 2.4375V6.90625C8.125 7.33723 7.9538 7.75055 7.64905 8.0553C7.3443 8.36005 6.93098 8.53125 6.5 8.53125Z" stroke="white" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Input field */}
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="כתוב את ההודעה שלך כאן..."
                className="flex-1 bg-transparent text-[#D7D7D7] placeholder-[#D7D7D7] text-[14px] outline-none text-right font-normal"
              />

              {/* Right side - Schedule and Send buttons */}
              <div className="flex items-center gap-2">
                {/* Schedule button - Coming soon */}
                <div className="relative group">
                  <button
                    className="w-[26px] h-[26px] bg-white/20 rounded-full flex items-center justify-center cursor-not-allowed opacity-60"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <g clipPath="url(#clip0_clock)">
                        <path d="M8 4V8H12" stroke="white" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7.9987 14.6654C11.6806 14.6654 14.6654 11.6806 14.6654 7.9987C14.6654 4.3168 11.6806 1.33203 7.9987 1.33203C4.3168 1.33203 1.33203 4.3168 1.33203 7.9987C1.33203 11.6806 4.3168 14.6654 7.9987 14.6654Z" stroke="white" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </g>
                      <defs>
                        <clipPath id="clip0_clock">
                          <rect width="16" height="16" fill="white"/>
                        </clipPath>
                      </defs>
                    </svg>
                  </button>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#030733] text-white text-[12px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    פיצ׳ר לא זמין עדיין, בקרוב!
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#030733]"></div>
                  </div>
                </div>
                {/* Send button */}
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className={`w-[26px] h-[26px] rounded-full flex items-center justify-center transition-colors ${
                    newMessage.trim()
                      ? 'bg-white hover:bg-white/90 cursor-pointer'
                      : 'bg-white/20 cursor-not-allowed'
                  }`}
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <path d="M11.2272 7.48481L12.9306 13.0205C8.85584 11.8354 5.0133 9.96326 1.56864 7.48481C5.0131 5.00642 8.85543 3.1343 12.93 1.94914L11.2272 7.48481ZM11.2272 7.48481L6.54918 7.48481" stroke={newMessage.trim() ? "#030733" : "white"} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`hidden lg:flex flex-1 rounded-[18px] items-center justify-center relative ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}>
          {/* Toggle CRM Panel button when no chat selected */}
          {!showCrmPanel && (
            <button
              onClick={() => setShowCrmPanel(true)}
              className={`absolute left-4 top-4 p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10 text-white' : 'hover:bg-[#F2F3F8] text-[#030733]'}`}
              title="פתח פאנל CRM"
            >
              <svg width="20" height="20" viewBox="0 0 15 15" fill="none">
                <path d="M5.15625 2.8125L9.84375 7.5L5.15625 12.1875" stroke="currentColor" strokeWidth="0.9375" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <div className="text-center">
            <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center mx-auto mb-3 lg:mb-4 ${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#F2F3F8]'}`}>
              <MessageSquare className={`w-8 h-8 lg:w-10 lg:h-10 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`} />
            </div>
            <h2 className={`text-[16px] lg:text-[18px] font-semibold mb-2 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>בחר שיחה</h2>
            <p className={`text-[12px] lg:text-[14px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>בחר שיחה מהרשימה כדי להתחיל</p>
          </div>
        </div>
      )}

      {/* Left Panel - Client CRM / Campaign Status */}
      {showCrmPanel && (
        <div className="hidden lg:flex w-[422px] rounded-[18px] flex-col overflow-hidden bg-white" dir="rtl">
          {/* Close button */}
          <div className="px-4 pt-5">
            <button
              onClick={() => setShowCrmPanel(false)}
              className="p-1 hover:opacity-70 transition-opacity"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M9.84375 12.1875L5.15625 7.5L9.84375 2.8125" stroke="#030733" strokeWidth="0.9375" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-center gap-[11px] px-4 pt-3 pb-4">
            <button
              onClick={() => setRightPanelTab('campaign')}
              className={`px-[22px] py-[10px] rounded-[10px] text-[16px] transition-colors ${
                rightPanelTab === 'campaign'
                  ? 'bg-[#030733] text-white'
                  : 'bg-[#F2F3F8] text-[#030733]'
              }`}
            >
              נתונים על הלקוח
            </button>
            <button
              onClick={() => setRightPanelTab('live')}
              className={`px-[22px] py-[10px] rounded-[10px] text-[16px] transition-colors ${
                rightPanelTab === 'live'
                  ? 'bg-[#030733] text-white'
                  : 'bg-[#F2F3F8] text-[#030733]'
              }`}
            >
              סטטוס קמפיין בלייב
            </button>
          </div>

          {/* Notes Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {rightPanelTab === 'campaign' ? (
              !selectedContact ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center py-8 text-[#595C7A] text-[14px]">
                    בחר שיחה כדי לראות נתונים על הלקוח
                  </div>
                </div>
              ) : (
              <div className="space-y-4">
                {clientNotes.length === 0 ? (
                  <div className="text-center py-8 text-[#595C7A] text-[14px]">
                    אין הערות עדיין
                  </div>
                ) : (
                  clientNotes.map((note, index) => {
                    const noteDate = new Date(note.timestamp)
                    const today = new Date()
                    const yesterday = new Date(today)
                    yesterday.setDate(yesterday.getDate() - 1)

                    let dateLabel = ''
                    if (noteDate.toDateString() === today.toDateString()) {
                      dateLabel = 'היום'
                    } else if (noteDate.toDateString() === yesterday.toDateString()) {
                      dateLabel = 'אתמול'
                    } else {
                      dateLabel = noteDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    }

                    const showDateHeader = index === 0 ||
                      new Date(clientNotes[index - 1].timestamp).toDateString() !== noteDate.toDateString()

                    return (
                      <div key={note.id}>
                        {showDateHeader && (
                          <div className="text-[#030733] text-[12px] leading-[18.6px] text-center mb-2">
                            {dateLabel}
                          </div>
                        )}
                        <div className="bg-[#187C55] rounded-[6px] p-3">
                          <p className="text-white text-[12px] leading-[18.6px]">{note.content}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              )
            ) : (
              /* Live Campaign Status View - Figma Design */
              <div className="flex flex-col h-full">
                {!liveCampaign ? (
                  /* Empty state - no active campaigns */
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center py-8 text-[#595C7A] text-[14px]">
                      אין קמפיינים פעילים
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Sent Messages Section - takes half of available space */}
                    <div className="flex-1 flex flex-col min-h-0 mb-3">
                      <h3 className="text-[#030733] text-[14px] font-medium mb-3 flex-shrink-0">הודעות שנשלחו</h3>
                      <div className="space-y-2 flex-1 overflow-y-auto">
                        {campaignMessages.filter(m => m.status === 'sent' || m.status === 'delivered' || m.status === 'read' || m.status === 'failed').length === 0 ? (
                          <div className="text-center py-4 text-[#595C7A] text-[12px]">
                            אין הודעות שנשלחו עדיין
                          </div>
                        ) : (
                          campaignMessages
                            .filter(m => m.status === 'sent' || m.status === 'delivered' || m.status === 'read' || m.status === 'failed')
                            .sort((a, b) => {
                              // Use sent_at for sent messages, failed_at for failed, created_at as fallback
                              const timeA = a.sent_at || a.failed_at || a.created_at
                              const timeB = b.sent_at || b.failed_at || b.created_at
                              if (!timeA && !timeB) return 0
                              if (!timeA) return 1
                              if (!timeB) return -1
                              // Sort descending - newest first (top)
                              return new Date(timeB).getTime() - new Date(timeA).getTime()
                            })
                            .map((msg) => {
                              // Use sent_at for sent messages, failed_at for failed, created_at as fallback
                              const messageTime = msg.sent_at || msg.failed_at || msg.created_at
                              return (
                                <div key={msg.id} className="bg-[#030733] rounded-[8px] p-3 flex items-center justify-between">
                                  <div className="flex flex-col text-right">
                                    {msg.contact_name && (
                                      <span className="text-white text-[14px] font-medium">
                                        {msg.contact_name}
                                      </span>
                                    )}
                                    <span className="text-white/70 text-[12px]">
                                      {formatPhoneForDisplay(msg.phone)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {messageTime && (
                                      <span className="text-white/60 text-[11px]">
                                        {new Date(messageTime).toLocaleTimeString('he-IL', {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                        {' '}
                                        {new Date(messageTime).toLocaleDateString('he-IL', {
                                          day: '2-digit',
                                          month: '2-digit'
                                        })}
                                      </span>
                                    )}
                                    {msg.status === 'failed' ? (
                                      <span className="px-[10px] py-[4px] bg-[#CD1B1B] text-white text-[12px] rounded-[6px]">
                                        נכשל בשליחה
                                      </span>
                                    ) : (
                                      <span className="px-[10px] py-[4px] bg-[#187C55] text-white text-[12px] rounded-[6px]">
                                        נשלח בהצלחה
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })
                        )}
                      </div>
                    </div>

                    {/* Pending Messages Section - takes half of available space */}
                    <div className="flex-1 flex flex-col min-h-0 mb-3">
                      <h3 className="text-[#030733] text-[14px] font-medium mb-3 flex-shrink-0">הודעות בהמתנה (הבאות בתור)</h3>
                      <div className="space-y-2 flex-1 overflow-y-auto">
                        {campaignMessages.filter(m => m.status === 'pending').length === 0 ? (
                          <div className="text-center py-4 text-[#595C7A] text-[12px]">
                            אין הודעות בהמתנה
                          </div>
                        ) : (
                          campaignMessages
                            .filter(m => m.status === 'pending')
                            .map((msg) => (
                              <div key={msg.id} className="bg-[#030733] rounded-[8px] p-3 flex items-center justify-between">
                                <div className="flex flex-col text-right">
                                  {msg.contact_name && (
                                    <span className="text-white text-[14px] font-medium">
                                      {msg.contact_name}
                                    </span>
                                  )}
                                  <span className="text-white/70 text-[12px]">
                                    {formatPhoneForDisplay(msg.phone)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 px-[10px] py-[4px] bg-[#F2F3F8] rounded-[6px]">
                                  <span className="text-[#595C7A] text-[12px]">בהמתנה</span>
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M9 3L3 9M3 3L9 9" stroke="#595C7A" strokeWidth="1.5" strokeLinecap="round"/>
                                  </svg>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                    {/* Campaign Control Panel - Bottom */}
                    <div className="flex-shrink-0 bg-[#030733] rounded-[13px] p-4">
                      {/* Campaign Name */}
                      <div className="text-white text-[14px] font-semibold text-right mb-2 truncate">
                        {liveCampaign.name}
                      </div>

                      {/* Stats Row with Timer */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[#D5D5D5] text-[14px]">
                          {liveCampaign.status === 'paused' ? (
                            <span className="text-yellow-400">מושהה</span>
                          ) : !remainingTime ? (
                            'זמן משוער: מחשב...'
                          ) : remainingTime.minutes === 0 && remainingTime.seconds === 0 ? (
                            'זמן משוער: מסיים...'
                          ) : (
                            `זמן משוער: ${remainingTime.minutes} דקות ו-${remainingTime.seconds} שניות`
                          )}
                        </span>
                        <span className="text-[#D5D5D5] text-[14px]">
                          {liveCampaign.sent_count} / {liveCampaign.total_recipients} הודעות שנשלחו
                        </span>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-white/20 mb-4"></div>

                      {/* Buttons Row */}
                      <div className="flex items-center justify-between">
                        {/* Cancel button - on right */}
                        <button
                          onClick={async () => {
                            if (confirm('האם אתה בטוח שברצונך לבטל את הקמפיין?')) {
                              await fetch(`/api/campaigns/${liveCampaign.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'cancel' })
                              })
                              loadLiveCampaign()
                            }
                          }}
                          className="px-8 py-[10px] bg-[#CD1B1B] text-white text-[14px] rounded-[8px] hover:bg-[#B71C1C] transition-colors"
                        >
                          בטל קמפיין
                        </button>

                        {/* Pause/Resume button - on left (far left) */}
                        <button
                          onClick={async () => {
                            await fetch(`/api/campaigns/${liveCampaign.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: liveCampaign.status === 'running' ? 'pause' : 'resume' })
                            })
                            loadLiveCampaign()
                          }}
                          className="w-[31px] h-[31px] bg-white rounded-full flex items-center justify-center hover:bg-white/90 transition-colors"
                        >
                          {liveCampaign.status === 'running' ? (
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                              <path d="M11.8125 3.9375V14.0625M6.1875 3.9375V14.0625" stroke="#030733" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M3 2L12 7L3 12V2Z" fill="#030733"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Input Area - only show when contact is selected AND in campaign tab (not live tab) */}
          {selectedContact && rightPanelTab === 'campaign' && (
            <div className="px-4 pb-6">
              <div className="h-[49px] bg-[#030733] rounded-[13px] flex items-center px-3 gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="כתוב משהו..."
                  className="flex-1 bg-transparent text-[#D7D7D7] placeholder-[#D7D7D7] text-[14px] outline-none text-right"
                />
                <button
                  onClick={() => {
                    if (newNote.trim()) {
                      const note: ClientNote = {
                        id: Date.now().toString(),
                        content: newNote.trim(),
                        timestamp: new Date().toISOString()
                      }
                      setClientNotes(prev => [...prev, note])
                      setNewNote('')
                    }
                  }}
                  className="px-[17px] py-[8px] bg-white rounded-[10px] text-[#030733] text-[14px] hover:bg-white/90 transition-colors"
                >
                  עדכן
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Label Modal */}
      {showLabelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className={`rounded-[12px] lg:rounded-[18px] p-4 lg:p-6 w-full max-w-[300px] shadow-xl ${darkMode ? 'bg-[#142241]' : 'bg-white'}`} dir="rtl">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <h3 className={`text-[14px] lg:text-[18px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>בחר תווית</h3>
              <button
                onClick={() => setShowLabelModal(false)}
                className={`p-1 lg:p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-[#1a2d4a]' : 'hover:bg-[#F2F3F8]'}`}
              >
                <X className={`w-4 h-4 lg:w-5 lg:h-5 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`} />
              </button>
            </div>
            <div className="space-y-1.5 lg:space-y-2">
              {labels.map((label) => (
                <button
                  key={label.id}
                  onClick={() => {
                    if (selectedContact) {
                      const updatedContacts = contacts.map(c => {
                        if (c.id === selectedContact.id) {
                          const newLabels = c.labels.includes(label.id)
                            ? c.labels.filter(l => l !== label.id)
                            : [...c.labels, label.id]
                          return { ...c, labels: newLabels }
                        }
                        return c
                      })
                      setContacts(updatedContacts)
                      setSelectedContact({
                        ...selectedContact,
                        labels: selectedContact.labels.includes(label.id)
                          ? selectedContact.labels.filter(l => l !== label.id)
                          : [...selectedContact.labels, label.id]
                      })
                    }
                  }}
                  className={`w-full flex items-center gap-2 lg:gap-3 p-2.5 lg:p-3 rounded-[8px] lg:rounded-[10px] transition-colors ${
                    darkMode
                      ? selectedContact?.labels.includes(label.id) ? 'bg-[#1a2d4a]' : 'hover:bg-[#1a2d4a]'
                      : selectedContact?.labels.includes(label.id) ? 'bg-[#F2F3F8]' : 'hover:bg-[#F2F3F8]'
                  }`}
                >
                  <span className="w-3.5 h-3.5 lg:w-4 lg:h-4 rounded-full" style={{ backgroundColor: label.color }} />
                  <span className={`text-[12px] lg:text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{label.name}</span>
                  {selectedContact?.labels.includes(label.id) && (
                    <Check className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-[#0043E0] mr-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
