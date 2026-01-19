'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import {
  Search,
  Upload,
  Download,
  Trash2,
  Edit2,
  Users,
  X,
  FileText,
  Filter,
  UserPlus,
  Loader2,
  MessageSquare
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { ConfirmModal } from '@/components/modals'
import { format } from 'date-fns'
import { normalizePhone, formatPhoneForDisplay } from '@/lib/phone-utils'

interface Contact {
  id: string
  phone: string
  name: string | null
  email: string | null
  is_blacklisted: boolean
  created_at: string
  labels?: string[]
  last_message?: string
  status?: string
}

const statusOptions = [
  { value: 'all', label: 'כל הסטטוסים' },
  { value: 'active', label: 'פעיל' },
  { value: 'new', label: 'חדש' },
  { value: 'blocked', label: 'חסום' },
]

const labelColors: Record<string, { bg: string; text: string }> = {
  'VIP': { bg: 'bg-[#FFD700]/20', text: 'text-[#B8860B]' },
  'ליד חדש': { bg: 'bg-[#187C55]/20', text: 'text-[#187C55]' },
  'חם': { bg: 'bg-[#CD1B1B]/20', text: 'text-[#CD1B1B]' },
  'ממתין': { bg: 'bg-[#0043E0]/20', text: 'text-[#0043E0]' },
  'הושלם': { bg: 'bg-[#595C7A]/20', text: 'text-[#595C7A]' },
}

export default function ContactsPage() {
  const { darkMode } = useTheme()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewContactModal, setShowNewContactModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [newContact, setNewContact] = useState({ phone: '', name: '', email: '' })
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)
  const [showDeleteMultipleConfirm, setShowDeleteMultipleConfirm] = useState(false)

  // Define loadContacts before useEffect
  const loadContacts = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setContacts([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setContacts(data)
    } else {
      setContacts([])
    }
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial data fetch on mount is intentional
    loadContacts()
  }, [])

  // Realtime subscription for contacts
  useEffect(() => {
    const supabase = createClient()

    // Get current user for filtering
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Subscribe to contacts changes for current user
      const contactsChannel = supabase
        .channel('contacts-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'contacts',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            logger.debug('[REALTIME] Contact inserted:', payload.new)
            setContacts(prev => [payload.new as Contact, ...prev])
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'contacts',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            logger.debug('[REALTIME] Contact updated:', payload.new)
            setContacts(prev => prev.map(c =>
              c.id === payload.new.id ? { ...c, ...payload.new as Contact } : c
            ))
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'contacts',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            logger.debug('[REALTIME] Contact deleted:', payload.old)
            setContacts(prev => prev.filter(c => c.id !== payload.old.id))
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(contactsChannel)
      }
    }

    const cleanup = setupRealtime()
    return () => {
      cleanup.then(fn => fn?.())
    }
  }, [])

  const createContact = async () => {
    if (!newContact.phone.trim()) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase.from('contacts').insert({
      user_id: user.id,
      phone: normalizePhone(newContact.phone),
      first_name: newContact.name?.split(' ')[0] || null,
      last_name: newContact.name?.split(' ').slice(1).join(' ') || null,
    }).select().single()

    if (!error && data) {
      setContacts([data, ...contacts])
      setShowNewContactModal(false)
      setNewContact({ phone: '', name: '', email: '' })
    }
  }

  const deleteContact = (contact: Contact) => {
    setContactToDelete(contact)
  }

  const confirmDeleteContact = async () => {
    if (!contactToDelete) return
    const supabase = createClient()
    await supabase.from('contacts').delete().eq('id', contactToDelete.id)
    setContacts(contacts.filter(c => c.id !== contactToDelete.id))
    setContactToDelete(null)
  }

  const toggleSelectContact = (id: string) => {
    setSelectedContacts(prev =>
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([])
    } else {
      setSelectedContacts(filteredContacts.map(c => c.id))
    }
  }

  const deleteSelectedContacts = () => {
    setShowDeleteMultipleConfirm(true)
  }

  const confirmDeleteSelectedContacts = async () => {
    setShowDeleteMultipleConfirm(false)
    const supabase = createClient()
    await supabase.from('contacts').delete().in('id', selectedContacts)

    setContacts(contacts.filter(c => !selectedContacts.includes(c.id)))
    setSelectedContacts([])
  }

  const exportContacts = () => {
    if (contacts.length === 0) return

    const csv = [
      ['phone', 'name', 'email', 'status'].join(','),
      ...contacts.map(c => [c.phone, c.name || '', c.email || '', c.status || ''].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contacts-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  const filteredContacts = contacts.filter(c => {
    const matchesSearch =
      (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-[#0043E0]" />
      </div>
    )
  }

  return (
    <div className="p-2 sm:p-3 md:p-4 lg:p-5 xl:p-6 2xl:p-[35px] h-full overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[8px] sm:rounded-[10px] min-h-[60px] sm:min-h-[66px] md:min-h-[70px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 md:px-5 md:py-0 lg:px-6 xl:px-[20px] xl:py-0 mb-3 sm:mb-4 md:mb-5 lg:mb-6 xl:mb-[20px]`}>
        <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
          <div className={`w-[26px] h-[26px] sm:w-[30px] sm:h-[30px] md:w-[32px] md:h-[32px] ${darkMode ? 'bg-white' : 'bg-[#030733]'} rounded-full flex items-center justify-center flex-shrink-0`}>
            <Users className={`w-[12px] h-[12px] sm:w-[14px] sm:h-[14px] md:w-[15px] md:h-[15px] ${darkMode ? 'text-[#030733]' : 'text-white'}`} />
          </div>
          <div className="text-right">
            <p className={`${darkMode ? 'text-white' : 'text-[#030733]'} text-[14px] sm:text-[16px] md:text-[17px] lg:text-[18px] xl:text-[19px] font-semibold`}>אנשי קשר</p>
            <p className={`${darkMode ? 'text-gray-400' : 'text-[#595C7A]'} text-[11px] sm:text-[12px] md:text-[13px]`}>נהל את רשימת אנשי הקשר שלך</p>
          </div>
        </div>

        {/* Filter tabs - horizontal scroll on mobile */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 lg:gap-[10px] overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
          {statusOptions.slice(1).map((option) => (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              className={`px-2.5 sm:px-3 md:px-4 lg:px-[15px] py-[5px] sm:py-[6px] md:py-[7px] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-[13px] md:text-[14px] lg:text-[15px] transition-colors whitespace-nowrap flex-shrink-0 ${
                statusFilter === option.value
                  ? 'bg-[#030733] text-white'
                  : darkMode ? 'bg-[#1a2d4a] text-white hover:bg-[#243a5a]' : 'bg-white text-[#030733] hover:bg-[#F2F3F8]'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 sm:px-3 md:px-4 lg:px-[15px] py-[5px] sm:py-[6px] md:py-[7px] rounded-[6px] sm:rounded-[8px] text-[11px] sm:text-[13px] md:text-[14px] lg:text-[15px] transition-colors whitespace-nowrap flex-shrink-0 ${
              statusFilter === 'all' ? 'bg-[#030733] text-white' : darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-white text-[#030733]'
            }`}
          >
            הכל
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 md:gap-5 lg:gap-6 xl:gap-[20px]">
        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-2 sm:gap-2.5 md:gap-3 lg:gap-[10px]">
          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5 md:gap-3 lg:gap-[10px]">
            {/* Search Row */}
            <div className="flex gap-2 sm:gap-2.5 md:gap-3 lg:gap-[10px] flex-1">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="חפש..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full h-[36px] sm:h-[38px] md:h-[42px] lg:h-[45px] xl:h-[47px] ${darkMode ? 'bg-[#1a2d4a] text-white placeholder-gray-400' : 'bg-white text-[#505050] placeholder-[#505050]'} rounded-[6px] sm:rounded-[8px] pr-[10px] sm:pr-[12px] md:pr-[15px] pl-[32px] sm:pl-[35px] md:pl-[40px] lg:pl-[45px] text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0]`}
                />
                <Search className={`w-[14px] h-[14px] sm:w-[16px] sm:h-[16px] md:w-[18px] md:h-[18px] lg:w-[20px] lg:h-[20px] absolute left-[8px] sm:left-[10px] md:left-[12px] lg:left-[15px] top-1/2 -translate-y-1/2 ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
              </div>
              <button className={`h-[36px] sm:h-[38px] md:h-[42px] lg:h-[45px] xl:h-[47px] px-2.5 sm:px-3 md:px-4 lg:px-5 xl:px-[20px] ${darkMode ? 'bg-[#1a2d4a]' : 'bg-white'} rounded-[6px] sm:rounded-[8px] flex items-center gap-1 sm:gap-2`}>
                <span className={`${darkMode ? 'text-white' : 'text-[#030733]'} text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] hidden md:inline`}>סנן</span>
                <Filter className={`w-[14px] h-[14px] sm:w-[16px] sm:h-[16px] md:w-[18px] md:h-[18px] lg:w-[20px] lg:h-[20px] ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
              </button>
            </div>
            {/* Actions Row */}
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-2.5 lg:gap-[10px]">
              <button
                onClick={() => setShowImportModal(true)}
                className={`h-[36px] sm:h-[38px] md:h-[42px] lg:h-[45px] xl:h-[47px] px-2 sm:px-2.5 md:px-3 lg:px-4 xl:px-[20px] ${darkMode ? 'bg-[#1a2d4a] hover:bg-[#243a5a]' : 'bg-white hover:bg-[#F2F3F8]'} rounded-[6px] sm:rounded-[8px] flex items-center gap-1 sm:gap-1.5 md:gap-2 transition-colors`}
              >
                <Upload className={`w-[13px] h-[13px] sm:w-[14px] sm:h-[14px] md:w-[16px] md:h-[16px] lg:w-[18px] lg:h-[18px] ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
                <span className={`${darkMode ? 'text-white' : 'text-[#030733]'} text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] xl:text-[14px]`}>ייבוא</span>
              </button>
              <button
                onClick={exportContacts}
                disabled={contacts.length === 0}
                className={`h-[36px] sm:h-[38px] md:h-[42px] lg:h-[45px] xl:h-[47px] px-2 sm:px-2.5 md:px-3 lg:px-4 xl:px-[20px] ${darkMode ? 'bg-[#1a2d4a] hover:bg-[#243a5a]' : 'bg-white hover:bg-[#F2F3F8]'} rounded-[6px] sm:rounded-[8px] flex items-center gap-1 sm:gap-1.5 md:gap-2 transition-colors disabled:opacity-50`}
              >
                <Download className={`w-[13px] h-[13px] sm:w-[14px] sm:h-[14px] md:w-[16px] md:h-[16px] lg:w-[18px] lg:h-[18px] ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
                <span className={`${darkMode ? 'text-white' : 'text-[#030733]'} text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] xl:text-[14px]`}>ייצוא</span>
              </button>
              <button
                onClick={() => setShowNewContactModal(true)}
                className="h-[36px] sm:h-[38px] md:h-[42px] lg:h-[45px] xl:h-[47px] px-2.5 sm:px-3 md:px-4 lg:px-5 xl:px-[25px] bg-[#0043E0] text-white rounded-[6px] sm:rounded-[8px] flex items-center gap-1 sm:gap-1.5 md:gap-2 hover:bg-[#0035b0] transition-colors"
              >
                <UserPlus className="w-[13px] h-[13px] sm:w-[14px] sm:h-[14px] md:w-[16px] md:h-[16px] lg:w-[18px] lg:h-[18px] xl:w-[20px] xl:h-[20px]" />
                <span className="text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] xl:text-[14px] font-semibold whitespace-nowrap">הוסף</span>
              </button>
            </div>
          </div>

          {/* Selection Bar */}
          {selectedContacts.length > 0 && (
            <div className="bg-[#030733] rounded-[10px] h-[40px] sm:h-[50px] flex items-center justify-between px-3 sm:px-[20px]">
              <span className="text-white text-[12px] sm:text-[14px]">{selectedContacts.length} נבחרים</span>
              <button
                onClick={deleteSelectedContacts}
                className="flex items-center gap-1 sm:gap-2 text-[#CD1B1B] hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-[12px] sm:text-[14px]">מחק</span>
              </button>
            </div>
          )}

          {/* Contacts List */}
          <div className="space-y-[3px] sm:space-y-[5px]">
            {/* Table Header - Desktop only */}
            <div className={`hidden lg:flex h-[40px] sm:h-[50px] ${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[10px] items-center px-2 sm:px-[17px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'} text-[12px] sm:text-[14px]`}>
              <div className="w-[30px] sm:w-[40px]">
                <input
                  type="checkbox"
                  checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                  onChange={toggleSelectAll}
                  className={`w-[14px] h-[14px] sm:w-[17px] sm:h-[17px] rounded-[4px] border-[0.65px] ${darkMode ? 'border-gray-400' : 'border-[#030733]'}`}
                />
              </div>
              <div className="flex-1">שם</div>
              <div className="w-[120px] lg:w-[150px]">טלפון</div>
              <div className="w-[140px] lg:w-[180px] hidden xl:block">אימייל</div>
              <div className="w-[100px] lg:w-[120px] hidden xl:block">תגיות</div>
              <div className="w-[80px] lg:w-[100px]">סטטוס</div>
              <div className="w-[80px] lg:w-[100px]">פעולות</div>
            </div>

            {/* Mobile Header - Select All */}
            <div className={`lg:hidden flex items-center justify-between ${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[8px] px-3 py-2`}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                  onChange={toggleSelectAll}
                  className={`w-[14px] h-[14px] rounded-[4px] border-[0.65px] ${darkMode ? 'border-gray-400' : 'border-[#030733]'}`}
                />
                <span className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>בחר הכל</span>
              </label>
              <span className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>{filteredContacts.length} אנשי קשר</span>
            </div>

            {filteredContacts.length === 0 ? (
              <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[10px] p-6 sm:p-12 text-center`}>
                <div className={`w-[50px] h-[50px] sm:w-[80px] sm:h-[80px] ${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#F2F3F8]'} rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4`}>
                  <Users className={`w-[24px] h-[24px] sm:w-[40px] sm:h-[40px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`} />
                </div>
                <h3 className={`text-[14px] sm:text-[18px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'} mb-2`}>אין אנשי קשר</h3>
                <p className={`${darkMode ? 'text-gray-400' : 'text-[#595C7A]'} text-[12px] sm:text-[14px] mb-4 sm:mb-6`}>
                  {searchQuery ? 'לא נמצאו תוצאות לחיפוש' : 'הוסף אנשי קשר או ייבא מקובץ CSV'}
                </p>
                <button
                  onClick={() => setShowNewContactModal(true)}
                  className="inline-flex items-center gap-2 bg-[#0043E0] text-white px-4 sm:px-6 py-2 sm:py-3 rounded-[10px] hover:bg-[#0035b0] transition-colors text-[12px] sm:text-[14px] font-semibold"
                >
                  <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                  הוסף איש קשר
                </button>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`${darkMode ? 'bg-[#142241] hover:bg-[#1a2d4a]' : 'bg-white hover:bg-[#F2F3F8]'} rounded-[8px] sm:rounded-[10px] transition-colors`}
                >
                  {/* Desktop View */}
                  <div className="hidden lg:flex h-[60px] xl:h-[72px] items-center px-2 sm:px-[17px]">
                    <div className="w-[30px] sm:w-[40px]">
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(contact.id)}
                        onChange={() => toggleSelectContact(contact.id)}
                        className={`w-[14px] h-[14px] sm:w-[17px] sm:h-[17px] rounded-[4px] border-[0.65px] ${darkMode ? 'border-gray-400' : 'border-[#030733]'}`}
                      />
                    </div>
                    <div className="flex-1 flex items-center gap-2 sm:gap-3">
                      <div className="w-[28px] h-[28px] sm:w-[35px] sm:h-[35px] bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-[10px] sm:text-[12px] flex-shrink-0">
                        {contact.name?.[0] || contact.phone[0]}
                      </div>
                      <span className={`${darkMode ? 'text-white' : 'text-[#030733]'} text-[13px] sm:text-[15px] font-medium truncate`}>{contact.name || '-'}</span>
                    </div>
                    <div className={`w-[120px] lg:w-[150px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'} text-[12px] sm:text-[14px]`} dir="ltr">{formatPhoneForDisplay(contact.phone)}</div>
                    <div className={`w-[140px] lg:w-[180px] hidden xl:block ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'} text-[12px] sm:text-[14px] truncate`} dir="ltr">{contact.email || '-'}</div>
                    <div className="w-[100px] lg:w-[120px] hidden xl:flex flex-wrap gap-1">
                      {contact.labels?.map((label, index) => (
                        <span
                          key={index}
                          className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[11px] font-medium ${labelColors[label]?.bg || 'bg-[#F2F3F8]'} ${labelColors[label]?.text || 'text-[#595C7A]'}`}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className="w-[80px] lg:w-[100px]">
                      <span className={`px-2 sm:px-[10px] py-1 sm:py-[5px] rounded-[6px] sm:rounded-[8px] text-[10px] sm:text-[12px] font-medium ${
                        contact.status === 'active' ? 'bg-[#187C55] text-white' :
                        contact.status === 'new' ? 'bg-[#0043E0] text-white' :
                        contact.status === 'blocked' ? 'bg-[#CD1B1B] text-white' :
                        darkMode ? 'bg-[#1a2d4a] text-gray-400' : 'bg-[#F2F3F8] text-[#595C7A]'
                      }`}>
                        {contact.status === 'active' ? 'פעיל' :
                         contact.status === 'new' ? 'חדש' :
                         contact.status === 'blocked' ? 'חסום' : '-'}
                      </span>
                    </div>
                    <div className="w-[80px] lg:w-[100px] flex items-center gap-0.5 sm:gap-1">
                      <button
                        className={`p-1.5 sm:p-2 ${darkMode ? 'text-white hover:bg-[#243a5a]' : 'text-[#030733] hover:bg-[#F2F3F8]'} rounded-lg transition-colors`}
                        title="צפה בשיחה"
                      >
                        <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        className={`p-1.5 sm:p-2 ${darkMode ? 'text-white hover:bg-[#243a5a]' : 'text-[#030733] hover:bg-[#F2F3F8]'} rounded-lg transition-colors`}
                        title="ערוך"
                      >
                        <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={() => deleteContact(contact)}
                        className={`p-1.5 sm:p-2 text-[#CD1B1B] ${darkMode ? 'hover:bg-red-900/30' : 'hover:bg-red-50'} rounded-lg transition-colors`}
                        title="מחק"
                      >
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Mobile View - Card */}
                  <div className="lg:hidden p-2.5 sm:p-3">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(contact.id)}
                        onChange={() => toggleSelectContact(contact.id)}
                        className={`w-[14px] h-[14px] rounded-[4px] border-[0.65px] mt-1 flex-shrink-0 ${darkMode ? 'border-gray-400' : 'border-[#030733]'}`}
                      />
                      <div className="w-[28px] h-[28px] bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium text-[10px] flex-shrink-0">
                        {contact.name?.[0] || contact.phone[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`${darkMode ? 'text-white' : 'text-[#030733]'} text-[12px] font-medium truncate`}>{contact.name || '-'}</span>
                          <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-medium flex-shrink-0 ${
                            contact.status === 'active' ? 'bg-[#187C55] text-white' :
                            contact.status === 'new' ? 'bg-[#0043E0] text-white' :
                            contact.status === 'blocked' ? 'bg-[#CD1B1B] text-white' :
                            darkMode ? 'bg-[#1a2d4a] text-gray-400' : 'bg-[#F2F3F8] text-[#595C7A]'
                          }`}>
                            {contact.status === 'active' ? 'פעיל' :
                             contact.status === 'new' ? 'חדש' :
                             contact.status === 'blocked' ? 'חסום' : '-'}
                          </span>
                        </div>
                        <div className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'} mt-0.5`} dir="ltr">{formatPhoneForDisplay(contact.phone)}</div>
                        {contact.email && (
                          <div className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'} truncate`} dir="ltr">{contact.email}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          className={`p-1.5 ${darkMode ? 'text-white' : 'text-[#030733]'} rounded`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteContact(contact)}
                          className="p-1.5 text-[#CD1B1B] rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar - Stats - Move to top on mobile */}
        <div className="w-full lg:w-[280px] xl:w-[300px] flex flex-col gap-2 sm:gap-[15px] order-first lg:order-last">
          {/* Stats - Horizontal on mobile, vertical on desktop */}
          <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[8px] sm:rounded-[10px] p-3 sm:p-[20px]`}>
            <h3 className={`${darkMode ? 'text-white' : 'text-[#030733]'} text-[14px] sm:text-[18px] font-semibold mb-2 sm:mb-4`}>סיכום אנשי קשר</h3>
            <div className="grid grid-cols-4 lg:grid-cols-1 gap-2 sm:gap-4">
              <div className="flex flex-col lg:flex-row items-center lg:justify-between text-center lg:text-right">
                <span className={`${darkMode ? 'text-gray-400' : 'text-[#595C7A]'} text-[10px] sm:text-[14px]`}>סה&quot;כ</span>
                <span className={`${darkMode ? 'text-white' : 'text-[#030733]'} text-[14px] sm:text-[18px] font-bold`}>{contacts.length}</span>
              </div>
              <div className="flex flex-col lg:flex-row items-center lg:justify-between text-center lg:text-right">
                <span className={`${darkMode ? 'text-gray-400' : 'text-[#595C7A]'} text-[10px] sm:text-[14px]`}>פעילים</span>
                <span className="text-[#187C55] text-[14px] sm:text-[18px] font-bold">
                  {contacts.filter(c => c.status === 'active').length}
                </span>
              </div>
              <div className="flex flex-col lg:flex-row items-center lg:justify-between text-center lg:text-right">
                <span className={`${darkMode ? 'text-gray-400' : 'text-[#595C7A]'} text-[10px] sm:text-[14px]`}>חדשים</span>
                <span className="text-[#0043E0] text-[14px] sm:text-[18px] font-bold">
                  {contacts.filter(c => c.status === 'new').length}
                </span>
              </div>
              <div className="flex flex-col lg:flex-row items-center lg:justify-between text-center lg:text-right">
                <span className={`${darkMode ? 'text-gray-400' : 'text-[#595C7A]'} text-[10px] sm:text-[14px]`}>חסומים</span>
                <span className="text-[#CD1B1B] text-[14px] sm:text-[18px] font-bold">
                  {contacts.filter(c => c.status === 'blocked').length}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions - Hidden on mobile, shown on desktop */}
          <div className="hidden lg:block bg-[#030733] rounded-[10px] p-[20px]">
            <h3 className="text-white text-[16px] xl:text-[18px] font-semibold mb-4">פעולות מהירות</h3>
            <div className="space-y-3">
              <button
                onClick={() => setShowNewContactModal(true)}
                className="w-full h-[38px] xl:h-[42px] bg-[#0043E0] text-white rounded-[8px] flex items-center justify-center gap-2 hover:bg-[#0035b0] transition-colors text-[13px] xl:text-[14px]"
              >
                <UserPlus className="w-4 h-4" />
                הוסף איש קשר
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="w-full h-[38px] xl:h-[42px] bg-white/10 text-white rounded-[8px] flex items-center justify-center gap-2 hover:bg-white/20 transition-colors text-[13px] xl:text-[14px]"
              >
                <Upload className="w-4 h-4" />
                ייבוא מ-CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* New Contact Modal */}
      {showNewContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[12px] sm:rounded-[18px] p-4 sm:p-6 w-full max-w-[480px]`} dir="rtl">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className={`text-[14px] sm:text-[18px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>הוספת איש קשר חדש</h3>
              <button onClick={() => setShowNewContactModal(false)} className={`p-1 sm:p-1.5 ${darkMode ? 'hover:bg-[#1a2d4a]' : 'hover:bg-[#F2F3F8]'} rounded-lg`}>
                <X className={`w-4 h-4 sm:w-5 sm:h-5 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`} />
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className={`block text-[12px] sm:text-[14px] font-medium ${darkMode ? 'text-gray-300' : 'text-[#030733]'} mb-1.5 sm:mb-2`}>טלפון *</label>
                <input
                  type="tel"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="050-1234567"
                  className={`w-full h-[40px] sm:h-[49px] px-3 sm:px-4 ${darkMode ? 'bg-[#1a2d4a] text-white placeholder-gray-500' : 'bg-[#F2F3F8] text-[#030733]'} rounded-[8px] sm:rounded-[10px] text-[13px] sm:text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0]`}
                  dir="ltr"
                />
              </div>
              <div>
                <label className={`block text-[12px] sm:text-[14px] font-medium ${darkMode ? 'text-gray-300' : 'text-[#030733]'} mb-1.5 sm:mb-2`}>שם מלא</label>
                <input
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="שם מלא"
                  className={`w-full h-[40px] sm:h-[49px] px-3 sm:px-4 ${darkMode ? 'bg-[#1a2d4a] text-white placeholder-gray-500' : 'bg-[#F2F3F8] text-[#030733]'} rounded-[8px] sm:rounded-[10px] text-[13px] sm:text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0]`}
                />
              </div>
              <div>
                <label className={`block text-[12px] sm:text-[14px] font-medium ${darkMode ? 'text-gray-300' : 'text-[#030733]'} mb-1.5 sm:mb-2`}>אימייל</label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="email@example.com"
                  className={`w-full h-[40px] sm:h-[49px] px-3 sm:px-4 ${darkMode ? 'bg-[#1a2d4a] text-white placeholder-gray-500' : 'bg-[#F2F3F8] text-[#030733]'} rounded-[8px] sm:rounded-[10px] text-[13px] sm:text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0]`}
                  dir="ltr"
                />
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => setShowNewContactModal(false)}
                className={`flex-1 h-[40px] sm:h-[49px] border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-[#1a2d4a]' : 'border-[#595C7A] text-[#030733] hover:bg-[#F2F3F8]'} rounded-[8px] sm:rounded-[10px] font-medium text-[13px] sm:text-[14px] transition-colors`}
              >
                ביטול
              </button>
              <button
                onClick={createContact}
                className="flex-1 h-[40px] sm:h-[49px] bg-[#0043E0] rounded-[8px] sm:rounded-[10px] text-white font-semibold text-[13px] sm:text-[14px] hover:bg-[#0035b0] transition-colors"
              >
                הוסף
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className={`${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[12px] sm:rounded-[18px] p-4 sm:p-6 w-full max-w-[480px]`} dir="rtl">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className={`text-[14px] sm:text-[18px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>ייבוא מקובץ CSV</h3>
              <button onClick={() => setShowImportModal(false)} className={`p-1 sm:p-1.5 ${darkMode ? 'hover:bg-[#1a2d4a]' : 'hover:bg-[#F2F3F8]'} rounded-lg`}>
                <X className={`w-4 h-4 sm:w-5 sm:h-5 ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`} />
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div className={`border-2 border-dashed ${darkMode ? 'border-gray-600 hover:border-[#0043E0]' : 'border-[#595C7A] hover:border-[#0043E0]'} rounded-[8px] sm:rounded-[10px] p-5 sm:p-8 text-center transition-colors`}>
                <FileText className={`w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 ${darkMode ? 'text-gray-500' : 'text-[#595C7A]'}`} />
                <p className={`${darkMode ? 'text-white' : 'text-[#030733]'} text-[12px] sm:text-[14px] mb-2`}>גרור קובץ CSV לכאן</p>
                <p className={`${darkMode ? 'text-gray-500' : 'text-[#595C7A]'} text-[11px] sm:text-[12px] mb-3 sm:mb-4`}>או</p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                  />
                  <span className="bg-[#0043E0] text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-[8px] hover:bg-[#0035b0] inline-block text-[12px] sm:text-[14px]">
                    בחר קובץ
                  </span>
                </label>
              </div>
              <div className={`${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#F2F3F8]'} rounded-[8px] sm:rounded-[10px] p-3 sm:p-4`}>
                <p className={`text-[10px] sm:text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                  <strong className={`${darkMode ? 'text-white' : 'text-[#030733]'}`}>פורמט:</strong> phone (חובה), name, email
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Contact Confirmation Modal */}
      <ConfirmModal
        isOpen={!!contactToDelete}
        onClose={() => setContactToDelete(null)}
        onConfirm={confirmDeleteContact}
        title={`האם למחוק את ${contactToDelete?.name || contactToDelete?.phone}?`}
        subtitle="פעולה זו לא ניתנת לביטול"
        confirmText="כן, מחק"
        cancelText="לא, בטל"
        variant="danger"
      />

      {/* Delete Multiple Contacts Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteMultipleConfirm}
        onClose={() => setShowDeleteMultipleConfirm(false)}
        onConfirm={confirmDeleteSelectedContacts}
        title={`האם למחוק ${selectedContacts.length} אנשי קשר?`}
        subtitle="פעולה זו לא ניתנת לביטול"
        confirmText="כן, מחק"
        cancelText="לא, בטל"
        variant="danger"
      />
    </div>
  )
}
