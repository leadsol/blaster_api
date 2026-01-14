'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/contexts/ThemeContext'
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
} from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { he } from 'date-fns/locale'

interface ChatContact {
  id: string
  name: string
  phone: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  isOnline: boolean
  avatar?: string
  labels: string[]
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

const labels: Label[] = [
  { id: 'vip', name: 'VIP', color: '#FFD700' },
  { id: 'lead', name: 'ליד חדש', color: '#4CAF50' },
  { id: 'hot', name: 'חם', color: '#F44336' },
  { id: 'pending', name: 'ממתין', color: '#2196F3' },
  { id: 'done', name: 'הושלם', color: '#9E9E9E' },
]

export default function ChatPage() {
  const { darkMode } = useTheme()
  const [contacts, setContacts] = useState<ChatContact[]>([])
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [rightPanelTab, setRightPanelTab] = useState<'live' | 'campaign'>('live')
  const [loading, setLoading] = useState(true)
  const [showContactsList, setShowContactsList] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadContacts()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadContacts = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { data: contactsData, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (!error && contactsData) {
      const formattedContacts: ChatContact[] = contactsData.map((c: any) => ({
        id: c.id,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.phone,
        phone: c.phone,
        lastMessage: '',
        lastMessageTime: c.updated_at ? format(new Date(c.updated_at), 'HH:mm', { locale: he }) : '-',
        unreadCount: 0,
        isOnline: false,
        labels: c.tags || [],
      }))
      setContacts(formattedContacts)
    }

    setLoading(false)
  }

  const loadMessages = async (contactId: string) => {
    const supabase = createClient()
    const { data: messagesData, error } = await supabase
      .from('messages')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (!error && messagesData) {
      const formattedMessages: Message[] = messagesData.map((m: any) => ({
        id: m.id,
        content: m.content || m.body || '',
        fromMe: m.from_me || m.direction === 'outgoing',
        timestamp: m.created_at,
        status: m.status || 'sent',
      }))
      setMessages(formattedMessages)
    } else {
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

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedContact) return
    const message: Message = {
      id: Date.now().toString(),
      content: newMessage,
      fromMe: true,
      timestamp: new Date().toISOString(),
      status: 'sent',
    }
    setMessages([...messages, message])
    setNewMessage('')
  }

  const filteredContacts = contacts.filter(c => {
    return c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery)
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

  return (
    <div className="h-[calc(100vh-60px)] lg:h-[calc(100vh-38px)] flex flex-col lg:flex-row p-2 sm:p-3 md:p-4 lg:p-5 xl:p-6 2xl:p-[35px] gap-2 sm:gap-3 md:gap-4 lg:gap-5 xl:gap-6 2xl:gap-[20px]" dir="rtl">
      {/* Right Panel - Contacts List */}
      <div className={`${showContactsList ? 'flex' : 'hidden'} lg:flex w-full lg:w-[300px] xl:w-[360px] 2xl:w-[422px] rounded-[10px] sm:rounded-[12px] md:rounded-[14px] lg:rounded-[16px] xl:rounded-[18px] flex-col overflow-hidden ${darkMode ? 'bg-[#142241]' : 'bg-white'} ${!selectedContact ? 'flex-1 lg:flex-none' : ''}`}>
        {/* Tabs */}
        <div className="flex p-2 sm:p-2.5 md:p-3 lg:p-4 xl:p-5 2xl:p-[19px] gap-2 sm:gap-2.5 md:gap-3 lg:gap-[10px]">
          <button
            onClick={() => setRightPanelTab('live')}
            className={`flex-1 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 2xl:py-[10px] px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 2xl:px-[22px] rounded-[6px] sm:rounded-[7px] md:rounded-[8px] lg:rounded-[9px] xl:rounded-[10px] text-[10px] sm:text-[11px] md:text-[12px] lg:text-[14px] xl:text-[15px] 2xl:text-[16px] transition-colors ${
              rightPanelTab === 'live'
                ? 'bg-[#030733] text-white font-semibold'
                : darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-[#F2F3F8] text-[#030733]'
            }`}
          >
            קמפיין לייב
          </button>
          <button
            onClick={() => setRightPanelTab('campaign')}
            className={`flex-1 py-2 sm:py-2.5 md:py-3 lg:py-3.5 xl:py-4 2xl:py-[10px] px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 2xl:px-[22px] rounded-[6px] sm:rounded-[7px] md:rounded-[8px] lg:rounded-[9px] xl:rounded-[10px] text-[10px] sm:text-[11px] md:text-[12px] lg:text-[14px] xl:text-[15px] 2xl:text-[16px] transition-colors ${
              rightPanelTab === 'campaign'
                ? 'bg-[#030733] text-white font-semibold'
                : darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-[#F2F3F8] text-[#030733]'
            }`}
          >
            נכנסות
          </button>
        </div>

        {/* Search */}
        <div className="px-2 sm:px-2.5 md:px-3 lg:px-4 xl:px-5 2xl:px-[19px] pb-2 sm:pb-2.5 md:pb-3 lg:pb-4 xl:pb-[15px]">
          <div className="relative">
            <Search className={`w-[14px] h-[14px] sm:w-[16px] sm:h-[16px] md:w-[18px] md:h-[18px] lg:w-[19px] lg:h-[19px] xl:w-[20px] xl:h-[20px] absolute right-[10px] sm:right-[12px] md:right-[13px] lg:right-[14px] xl:right-[15px] top-1/2 -translate-y-1/2 ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
            <input
              type="text"
              placeholder="חפש..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full h-[34px] sm:h-[38px] md:h-[42px] lg:h-[45px] xl:h-[47px] pr-[32px] sm:pr-[36px] md:pr-[40px] lg:pr-[43px] xl:pr-[45px] pl-2.5 sm:pl-3 md:pl-3.5 lg:pl-4 rounded-[6px] sm:rounded-[7px] md:rounded-[8px] text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0] ${
                darkMode ? 'bg-[#1a2d4a] text-white placeholder-gray-400' : 'bg-[#F2F3F8] text-[#505050] placeholder-[#505050]'
              }`}
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length === 0 ? (
            <div className="p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7 2xl:p-8 text-center">
              <MessageSquare className={`w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 xl:w-11 xl:h-11 2xl:w-12 2xl:h-12 mx-auto mb-2 sm:mb-3 md:mb-3.5 lg:mb-4 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`} />
              <p className={`text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] ${darkMode ? 'text-gray-300' : 'text-[#505050]'}`}>אין שיחות עדיין</p>
            </div>
          ) : (
            filteredContacts.map((contact, index) => (
              <div
                key={contact.id}
                onClick={() => handleSelectContact(contact)}
                className={`flex items-center gap-2 sm:gap-2.5 md:gap-3 lg:gap-3.5 xl:gap-4 p-2 sm:p-2.5 md:p-3 lg:p-3.5 xl:p-4 cursor-pointer border-t transition-colors ${
                  darkMode
                    ? `border-white/10 ${selectedContact?.id === contact.id ? 'bg-[#1a2d4a]' : 'hover:bg-[#1a2d4a]'}`
                    : `border-[rgba(3,7,51,0.38)] ${selectedContact?.id === contact.id ? 'bg-[#F2F3F8]' : 'hover:bg-[#F2F3F8]'}`
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-[28px] h-[28px] sm:w-[30px] sm:h-[30px] md:w-[32px] md:h-[32px] lg:w-[34px] lg:h-[34px] xl:w-[35px] xl:h-[35px] bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-[9px] sm:text-[10px] md:text-[11px] lg:text-[12px]">
                    {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  {contact.isOnline && (
                    <div className="absolute bottom-0 left-0 w-1.5 h-1.5 sm:w-2 sm:h-2 md:w-2.5 md:h-2.5 bg-[#187C55] rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className={`font-medium text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] xl:text-[15px] truncate ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{contact.name}</h3>
                    <span className={`text-[9px] sm:text-[10px] md:text-[11px] lg:text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>{contact.lastMessageTime}</span>
                  </div>
                  <p className={`text-[9px] sm:text-[10px] md:text-[11px] lg:text-[12px] truncate mt-0.5 md:mt-1 ${darkMode ? 'text-gray-400' : 'text-[#505050]'}`}>{contact.lastMessage || formatPhoneForDisplay(contact.phone)}</p>
                </div>
                {contact.unreadCount > 0 && (
                  <span className="bg-[#0043E0] text-white text-[8px] sm:text-[9px] md:text-[10px] rounded-full min-w-[14px] sm:min-w-[16px] md:min-w-[18px] h-[14px] sm:h-[16px] md:h-[18px] flex items-center justify-center px-1">
                    {contact.unreadCount}
                  </span>
                )}
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
              <div className="flex flex-col">
                <span className="text-white text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] xl:text-[15px] font-medium truncate max-w-[100px] sm:max-w-[120px] md:max-w-none">{selectedContact.name}</span>
                <span className="text-white/70 text-[9px] sm:text-[10px] md:text-[11px] lg:text-[12px] font-normal hidden sm:block" dir="ltr">{formatPhoneForDisplay(selectedContact.phone)}</span>
              </div>
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
            </div>
          </div>

          {/* Messages */}
          <div className={`flex-1 overflow-y-auto p-2 sm:p-2.5 md:p-3 lg:p-4 xl:p-[15px] space-y-2 sm:space-y-2.5 md:space-y-3 ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}>
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
                      <div className="flex justify-center my-2 sm:my-2.5 md:my-3 lg:my-4">
                        <span className={`text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] xl:text-[14px] px-2 sm:px-2.5 md:px-3 lg:px-[10px] py-0.5 sm:py-1 md:py-[4px] rounded-[6px] sm:rounded-[7px] ${darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-[#E6E6E6] text-[#030733]'}`}>
                          {formatDateHeader(message.timestamp)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${message.fromMe ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[90%] sm:max-w-[85%] md:max-w-[80%] lg:max-w-[75%] xl:max-w-[70%] rounded-[5px] sm:rounded-[6px] px-2 sm:px-2.5 md:px-3 lg:px-3.5 xl:px-4 py-1.5 sm:py-2 relative ${
                          message.fromMe
                            ? 'bg-[#187C55] text-white rounded-tl-none'
                            : darkMode ? 'bg-[#1a2d4a] text-white rounded-tr-none' : 'bg-[#F2F3F8] text-[#030733] rounded-tr-none'
                        }`}
                      >
                        <p className="text-[10px] sm:text-[11px] md:text-[12px] leading-[14px] sm:leading-[16px] md:leading-[18px] lg:leading-[18.6px] whitespace-pre-wrap">{message.content}</p>
                        <div className={`flex items-center justify-end gap-0.5 sm:gap-1 mt-0.5 md:mt-1 ${message.fromMe ? 'text-[#DEDEDE]' : darkMode ? 'text-gray-400' : 'text-[#2D2D2D]'}`}>
                          <span className="text-[9px] sm:text-[10px] md:text-[11px] lg:text-[12px]">{formatMessageTime(message.timestamp)}</span>
                          {message.fromMe && (
                            message.status === 'read' ? <CheckCheck className="w-[9px] h-[9px] sm:w-[10px] sm:h-[10px] md:w-[11px] md:h-[11px] text-[#53BDEB]" /> :
                            message.status === 'delivered' ? <CheckCheck className="w-[9px] h-[9px] sm:w-[10px] sm:h-[10px] md:w-[11px] md:h-[11px]" /> :
                            <Check className="w-[9px] h-[9px] sm:w-[10px] sm:h-[10px] md:w-[11px] md:h-[11px]" />
                          )}
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
          <div className="px-2 sm:px-2.5 md:px-3 lg:px-4 xl:px-[15px] pb-2 sm:pb-2.5 md:pb-3 lg:pb-4 xl:pb-[15px]">
            <div className="h-[38px] sm:h-[42px] md:h-[45px] lg:h-[47px] xl:h-[49px] bg-[#030733] rounded-[8px] sm:rounded-[10px] md:rounded-[11px] lg:rounded-[12px] xl:rounded-[13px] flex items-center px-2 sm:px-2.5 md:px-3 lg:px-[15px] gap-0.5 sm:gap-1 md:gap-1.5 lg:gap-2">
              <button onClick={handleSendMessage} className="p-0.5 sm:p-1 text-white hover:opacity-80 transition-opacity">
                <div className="w-[20px] h-[20px] sm:w-[22px] sm:h-[22px] md:w-[24px] md:h-[24px] lg:w-[26px] lg:h-[26px] bg-white rounded-full flex items-center justify-center">
                  <Send className="w-[10px] h-[10px] sm:w-[12px] sm:h-[12px] md:w-[14px] md:h-[14px] lg:w-[16px] lg:h-[16px] text-[#030733] rotate-180" />
                </div>
              </button>
              <button className="p-0.5 sm:p-1 text-white hover:opacity-80 transition-opacity hidden md:block">
                <Mic className="w-[11px] h-[11px] sm:w-[12px] sm:h-[12px] md:w-[13px] md:h-[13px]" />
              </button>
              <button className="p-0.5 sm:p-1 text-white hover:opacity-80 transition-opacity">
                <Smile className="w-[11px] h-[11px] sm:w-[12px] sm:h-[12px] md:w-[13px] md:h-[13px]" />
              </button>
              <button className="p-0.5 sm:p-1 text-white hover:opacity-80 transition-opacity">
                <Paperclip className="w-[14px] h-[14px] sm:w-[16px] sm:h-[16px] md:w-[19px] md:h-[19px] lg:w-[21px] lg:h-[21px]" />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="כתוב הודעה..."
                className="flex-1 bg-transparent text-[#D7D7D7] placeholder-[#D7D7D7] text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] outline-none text-right"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className={`hidden lg:flex flex-1 rounded-[18px] items-center justify-center ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}>
          <div className="text-center">
            <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center mx-auto mb-3 lg:mb-4 ${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#F2F3F8]'}`}>
              <MessageSquare className={`w-8 h-8 lg:w-10 lg:h-10 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`} />
            </div>
            <h2 className={`text-[16px] lg:text-[18px] font-semibold mb-2 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>בחר שיחה</h2>
            <p className={`text-[12px] lg:text-[14px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>בחר שיחה מהרשימה כדי להתחיל</p>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 md:p-5">
          <div className={`rounded-[10px] sm:rounded-[12px] md:rounded-[14px] lg:rounded-[16px] xl:rounded-[18px] p-3 sm:p-4 md:p-5 lg:p-6 w-full max-w-[320px] sm:max-w-[360px] md:max-w-[400px] lg:max-w-[440px] xl:max-w-[480px] shadow-xl ${darkMode ? 'bg-[#142241]' : 'bg-white'}`} dir="rtl">
            <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-5 lg:mb-6">
              <h3 className={`text-[13px] sm:text-[14px] md:text-[16px] lg:text-[17px] xl:text-[18px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>תזמון הודעה</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className={`p-1 sm:p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-[#1a2d4a]' : 'hover:bg-[#F2F3F8]'}`}
              >
                <X className={`w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`} />
              </button>
            </div>
            <div className="space-y-3 lg:space-y-4">
              <div>
                <label className={`block text-[12px] lg:text-[14px] font-medium mb-1 lg:mb-1.5 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>תאריך</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className={`w-full h-[40px] lg:h-[49px] px-3 lg:px-4 rounded-[8px] lg:rounded-[10px] text-[13px] lg:text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0] ${darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-[#F2F3F8] text-[#030733]'}`}
                />
              </div>
              <div>
                <label className={`block text-[12px] lg:text-[14px] font-medium mb-1 lg:mb-1.5 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>שעה</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className={`w-full h-[40px] lg:h-[49px] px-3 lg:px-4 rounded-[8px] lg:rounded-[10px] text-[13px] lg:text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0] ${darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-[#F2F3F8] text-[#030733]'}`}
                />
              </div>
              <div>
                <label className={`block text-[12px] lg:text-[14px] font-medium mb-1 lg:mb-1.5 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>הודעה</label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={3}
                  className={`w-full px-3 lg:px-4 py-2 lg:py-3 rounded-[8px] lg:rounded-[10px] text-[13px] lg:text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0] resize-none ${darkMode ? 'bg-[#1a2d4a] text-white placeholder-gray-400' : 'bg-[#F2F3F8] text-[#030733]'}`}
                  placeholder="הקלד את ההודעה..."
                />
              </div>
            </div>
            <div className="flex gap-2 lg:gap-3 mt-4 lg:mt-6">
              <button
                onClick={() => setShowScheduleModal(false)}
                className={`flex-1 h-[40px] lg:h-[49px] border rounded-[8px] lg:rounded-[10px] font-medium text-[13px] lg:text-[14px] transition-colors ${darkMode ? 'border-gray-500 text-white hover:bg-[#1a2d4a]' : 'border-[#595C7A] text-[#030733] hover:bg-[#F2F3F8]'}`}
              >
                ביטול
              </button>
              <button className="flex-1 h-[40px] lg:h-[49px] bg-[#0043E0] rounded-[8px] lg:rounded-[10px] text-white font-semibold text-[13px] lg:text-[14px] hover:bg-[#0035b0] transition-colors flex items-center justify-center gap-1.5 lg:gap-2">
                <Calendar className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                תזמן
              </button>
            </div>
          </div>
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
