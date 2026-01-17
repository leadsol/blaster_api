'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Search,
  Plus,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  Check,
  Loader2,
  Users,
  Calendar,
  Share2,
  Upload,
  Download,
  Copy
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { ConfirmModal } from '@/components/modals'
import { normalizePhone, formatPhoneForDisplay } from '@/lib/phone-utils'
import * as XLSX from 'xlsx'

interface ContactList {
  id: string
  name: string
  description: string | null
  contact_count: number
  created_at: string
}

interface BlacklistEntry {
  id: string
  user_id: string
  phone: string
  reason: string | null
  created_at: string
}

interface Contact {
  id: string
  list_id: string
  phone: string
  name: string | null
  email: string | null
  variables: Record<string, string>
  is_blacklisted: boolean
  created_at: string
}

interface ListHistoryItem {
  id: string
  list_id: string
  action_type: 'campaign' | 'contacts_added' | 'contacts_removed' | 'name_changed' | 'duplicated' | 'exported' | 'imported'
  description: string
  campaign_id: string | null
  created_at: string
}

export default function ListsPage() {
  useTheme() // Keep theme context for consistency
  const [lists, setLists] = useState<ContactList[]>([])
  const [selectedList, setSelectedList] = useState<ContactList | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [searchListQuery, setSearchListQuery] = useState('')
  const [searchContactQuery, setSearchContactQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [checkedLists, setCheckedLists] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'regular' | 'blacklist'>('regular')

  // Blacklist
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([])
  const [blacklistLoading, setBlacklistLoading] = useState(false)
  const [selectedBlacklistEntries, setSelectedBlacklistEntries] = useState<Set<string>>(new Set())
  const [newBlacklistPhone, setNewBlacklistPhone] = useState('')
  const [newBlacklistReason, setNewBlacklistReason] = useState('')
  const [blacklistSelected, setBlacklistSelected] = useState(false) // Whether blacklist "item" is selected in sidebar
  const [editingBlacklistEntry, setEditingBlacklistEntry] = useState<BlacklistEntry | null>(null)

  // Sorting for lists
  const [listSortBy, setListSortBy] = useState<'name' | 'count'>('name')
  const [listSortOrder, setListSortOrder] = useState<'asc' | 'desc'>('asc')

  // Sorting for contacts table
  const [contactSortBy, setContactSortBy] = useState<string>('phone')
  const [contactSortOrder, setContactSortOrder] = useState<'asc' | 'desc'>('asc')

  // Modals
  const [showNewContactModal, setShowNewContactModal] = useState(false)
  const [listToDelete, setListToDelete] = useState<ContactList | null>(null)
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  // Inline form mode (replaces sidebar with form)
  const [showInlineNewListForm, setShowInlineNewListForm] = useState(false)
  const [showInlineBlacklistForm, setShowInlineBlacklistForm] = useState(false)
  const [formActiveTab, setFormActiveTab] = useState<'regular' | 'blacklist'>('regular')

  // Upload method states (same as campaigns/new)
  const [loadMethodDetails, setLoadMethodDetails] = useState('')

  // Manual entry popup
  const [showManualEntryPopup, setShowManualEntryPopup] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [manualEntryMode, setManualEntryMode] = useState<'single' | 'paste'>('single')
  const [pastedText, setPastedText] = useState('')
  const [parsedRows, setParsedRows] = useState<string[][]>([])
  const [columnNames, setColumnNames] = useState<string[]>([])
  const [manualCustomFields, setManualCustomFields] = useState<{name: string, value: string}[]>([])
  const [showColumnMapping, setShowColumnMapping] = useState(false)

  // Excel popup
  const [showExcelPopup, setShowExcelPopup] = useState(false)
  const [excelData, setExcelData] = useState<string[][]>([])
  const [excelColumnNames, setExcelColumnNames] = useState<string[]>([])
  const [hasHeaders, setHasHeaders] = useState(true)
  const [excelFileName, setExcelFileName] = useState('')

  // Google Sheets
  const [sheetsUrl, setSheetsUrl] = useState('')
  const [sheetsLoading, setSheetsLoading] = useState(false)

  // Recipients loaded from file/manual
  const [loadedContacts, setLoadedContacts] = useState<{id: string, name: string, phone: string, variables?: Record<string, string>}[]>([])

  // Alert/Confirm popups
  const [alertPopup, setAlertPopup] = useState<{ show: boolean; message: string }>({ show: false, message: '' })
  const [confirmPopup, setConfirmPopup] = useState<{ show: boolean; message: string; confirmText?: string; onConfirm: () => void }>({ show: false, message: '', confirmText: '', onConfirm: () => {} })

  // Form states
  const [newListName, setNewListName] = useState('')
  const [newContactPhone, setNewContactPhone] = useState('')
  const [newContactVariables, setNewContactVariables] = useState<Record<string, string>>({})
  const [newFieldName, setNewFieldName] = useState('')
  const [customFields, setCustomFields] = useState<string[]>([])

  // History
  const [listHistory, setListHistory] = useState<ListHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    loadLists()
    loadBlacklist()
  }, [])

  useEffect(() => {
    if (selectedList) {
      loadContacts(selectedList.id)
      loadHistory(selectedList.id)
    } else {
      setContacts([])
      setListHistory([])
    }
  }, [selectedList])

  const loadLists = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLists([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('contact_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setLists(data)
      if (data.length > 0 && !selectedList) {
        setSelectedList(data[0])
      }
    }
    setLoading(false)
  }

  const loadContacts = async (listId: string) => {
    setContactsLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setContacts(data)
    } else {
      setContacts([])
    }
    setContactsLoading(false)
  }

  const loadHistory = async (listId: string) => {
    setHistoryLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('list_history')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setListHistory(data)
    } else {
      setListHistory([])
    }
    setHistoryLoading(false)
  }

  const loadBlacklist = async () => {
    setBlacklistLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setBlacklist([])
      setBlacklistLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('blacklist')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setBlacklist(data)
    } else {
      setBlacklist([])
    }
    setBlacklistLoading(false)
  }

  const addToBlacklist = async () => {
    if (!newBlacklistPhone.trim()) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('blacklist')
      .insert({
        user_id: user.id,
        phone: normalizePhone(newBlacklistPhone),
        reason: newBlacklistReason.trim() || null
      })
      .select()
      .single()

    if (!error && data) {
      setBlacklist([data, ...blacklist])
      setNewBlacklistPhone('')
      setNewBlacklistReason('')
    }
  }

  const removeFromBlacklist = async (entryId: string) => {
    const supabase = createClient()
    await supabase.from('blacklist').delete().eq('id', entryId)
    setBlacklist(blacklist.filter(b => b.id !== entryId))
    setSelectedBlacklistEntries(prev => {
      const newSet = new Set(prev)
      newSet.delete(entryId)
      return newSet
    })
  }

  const removeSelectedFromBlacklist = async () => {
    if (selectedBlacklistEntries.size === 0) return

    const supabase = createClient()
    const entryIds = Array.from(selectedBlacklistEntries)
    await supabase.from('blacklist').delete().in('id', entryIds)
    setBlacklist(blacklist.filter(b => !selectedBlacklistEntries.has(b.id)))
    setSelectedBlacklistEntries(new Set())
  }

  const toggleBlacklistSelect = (entryId: string) => {
    const newSelected = new Set(selectedBlacklistEntries)
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId)
    } else {
      newSelected.add(entryId)
    }
    setSelectedBlacklistEntries(newSelected)
  }

  const toggleSelectAllBlacklist = () => {
    if (selectedBlacklistEntries.size === filteredBlacklist.length) {
      setSelectedBlacklistEntries(new Set())
    } else {
      setSelectedBlacklistEntries(new Set(filteredBlacklist.map(b => b.id)))
    }
  }

  const openEditBlacklistEntry = (entry: BlacklistEntry) => {
    setEditingBlacklistEntry(entry)
    setNewBlacklistPhone(entry.phone)
    setNewBlacklistReason(entry.reason || '')
  }

  const updateBlacklistEntry = async () => {
    if (!editingBlacklistEntry || !newBlacklistPhone.trim()) return

    const supabase = createClient()

    const { error } = await supabase
      .from('blacklist')
      .update({
        phone: normalizePhone(newBlacklistPhone),
        reason: newBlacklistReason.trim() || null
      })
      .eq('id', editingBlacklistEntry.id)

    if (!error) {
      setBlacklist(blacklist.map(b =>
        b.id === editingBlacklistEntry.id
          ? { ...b, phone: normalizePhone(newBlacklistPhone), reason: newBlacklistReason.trim() || null }
          : b
      ))
      setEditingBlacklistEntry(null)
      setNewBlacklistPhone('')
      setNewBlacklistReason('')
    }
  }

  // ==================== UPLOAD FUNCTIONS (copied from campaigns/new) ====================

  // Google Sheets loading
  const handleLoadGoogleSheets = async () => {
    if (!sheetsUrl.trim()) {
      setAlertPopup({ show: true, message: 'יש להזין קישור ל-Google Sheets' })
      return
    }

    setSheetsLoading(true)

    try {
      const response = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetsUrl })
      })

      const data = await response.json()

      if (!response.ok) {
        setAlertPopup({ show: true, message: data.error || 'שגיאה בטעינת הגיליון' })
        setSheetsLoading(false)
        return
      }

      // Use the same popup as Excel for column mapping
      const allRows = [data.headers, ...data.rows]
      setExcelData(allRows)
      setExcelColumnNames(allRows[0].map(() => ''))
      setHasHeaders(true)
      setExcelFileName('Google Sheets')
      setShowExcelPopup(true)
      setSheetsUrl('')

    } catch (error) {
      console.error('Error loading Google Sheets:', error)
      setAlertPopup({ show: true, message: 'שגיאה בטעינת הגיליון' })
    }

    setSheetsLoading(false)
  }

  // Excel file upload
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setExcelFileName(file.name)
      const reader = new FileReader()
      reader.onload = (event) => {
        const data = event.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][]

        // Filter out empty rows
        const filteredData = jsonData.filter(row => row.some(cell => cell !== undefined && cell !== ''))

        if (filteredData.length > 0) {
          setExcelData(filteredData)
          // Initialize column names as empty (user will select from dropdown)
          const firstRow = filteredData[0]
          setExcelColumnNames(firstRow.map(() => ''))
          setHasHeaders(true)
          setShowExcelPopup(true)
        }
      }
      reader.readAsBinaryString(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  // Add contacts from Excel data
  const handleAddExcelContacts = (skipNameCheck = false) => {
    const nameIndex = excelColumnNames.findIndex(n => n === 'שם')
    const phoneIndex = excelColumnNames.findIndex(n => n === 'טלפון')

    if (phoneIndex === -1) {
      setAlertPopup({ show: true, message: 'חובה לבחור עמודת טלפון' })
      return
    }

    if (nameIndex === -1 && !skipNameCheck) {
      // Close Excel popup first, then show confirm
      setShowExcelPopup(false)
      setConfirmPopup({
        show: true,
        message: 'לא נבחרה עמודת שם.\n\nהנמענים ייכנסו לרשימה ללא שם - האם אתה מאשר?',
        confirmText: 'אישור - הכנס ללא שם',
        onConfirm: () => {
          // Add contacts without names
          const dataRows = hasHeaders ? excelData.slice(1) : excelData

          const newContacts = dataRows.map((row, idx) => {
            const variables: Record<string, string> = {}
            excelColumnNames.forEach((colName, colIdx) => {
              if (colIdx !== phoneIndex && colName && row[colIdx]) {
                variables[colName] = String(row[colIdx])
              }
            })
            return {
              id: `excel-${Date.now()}-${idx}`,
              name: '',
              phone: normalizePhone(String(row[phoneIndex] || '')),
              variables,
            }
          }).filter(r => r.phone)

          setLoadedContacts(prev => [...prev, ...newContacts])

          // Reset Excel state
          setExcelData([])
          setExcelColumnNames([])
          setExcelFileName('')
        }
      })
      return
    }

    // Skip first row if it has headers
    const dataRows = hasHeaders ? excelData.slice(1) : excelData

    const newContacts = dataRows.map((row, idx) => {
      const variables: Record<string, string> = {}
      excelColumnNames.forEach((colName, colIdx) => {
        if (colIdx !== nameIndex && colIdx !== phoneIndex && colName && row[colIdx]) {
          variables[colName] = String(row[colIdx])
        }
      })
      return {
        id: `excel-${Date.now()}-${idx}`,
        name: nameIndex !== -1 ? String(row[nameIndex] || '') : '',
        phone: normalizePhone(String(row[phoneIndex] || '')),
        variables,
      }
    }).filter(r => r.phone)

    setLoadedContacts(prev => [...prev, ...newContacts])

    // Reset Excel state
    setShowExcelPopup(false)
    setExcelData([])
    setExcelColumnNames([])
    setExcelFileName('')
  }

  // Parse pasted text into rows and columns
  const handlePasteText = (text: string) => {
    setPastedText(text)
    if (!text.trim()) {
      setParsedRows([])
      setColumnNames([])
      setShowColumnMapping(false)
      return
    }

    // Split by newlines to get rows
    const lines = text.trim().split('\n').filter(line => line.trim())

    // For each line, try to detect columns by common separators (tab, comma, or spaces)
    const rows = lines.map(line => {
      // Try tab first
      if (line.includes('\t')) {
        return line.split('\t').map(col => col.trim())
      }
      // Then comma
      if (line.includes(',')) {
        return line.split(',').map(col => col.trim())
      }
      // Fall back to multiple spaces or single space
      return line.split(/\s+/).map(col => col.trim())
    })

    setParsedRows(rows)

    // Initialize column names based on first row's column count
    if (rows.length > 0) {
      const colCount = Math.max(...rows.map(r => r.length))
      setColumnNames(new Array(colCount).fill(''))
      setShowColumnMapping(true)
    }
  }

  // Add contacts from parsed data (manual entry)
  const handleAddParsedContacts = (skipNameCheck = false) => {
    const nameIndex = columnNames.findIndex(n => n === 'שם')
    const phoneIndex = columnNames.findIndex(n => n === 'טלפון')

    if (phoneIndex === -1) {
      setAlertPopup({ show: true, message: 'חובה לבחור עמודת טלפון' })
      return
    }

    if (nameIndex === -1 && !skipNameCheck) {
      // Close manual popup first, then show confirm
      setShowManualEntryPopup(false)
      setConfirmPopup({
        show: true,
        message: 'לא נבחרה עמודת שם.\n\nהנמענים ייכנסו לרשימה ללא שם - האם אתה מאשר?',
        confirmText: 'אישור - הכנס ללא שם',
        onConfirm: () => {
          // Add contacts without names
          const newContacts = parsedRows.map((row, idx) => {
            const variables: Record<string, string> = {}
            columnNames.forEach((colName, colIdx) => {
              if (colIdx !== phoneIndex && colName && row[colIdx]) {
                variables[colName] = row[colIdx]
              }
            })
            return {
              id: `parsed-${Date.now()}-${idx}`,
              name: '',
              phone: normalizePhone(row[phoneIndex] || ''),
              variables,
            }
          }).filter(r => r.phone)

          setLoadedContacts(prev => [...prev, ...newContacts])

          // Reset paste state
          setPastedText('')
          setParsedRows([])
          setColumnNames([])
          setShowColumnMapping(false)
          setManualEntryMode('single')
        }
      })
      return
    }

    const newContacts = parsedRows.map((row, idx) => {
      const variables: Record<string, string> = {}
      columnNames.forEach((colName, colIdx) => {
        if (colIdx !== nameIndex && colIdx !== phoneIndex && colName && row[colIdx]) {
          variables[colName] = row[colIdx]
        }
      })
      return {
        id: `parsed-${Date.now()}-${idx}`,
        name: nameIndex !== -1 ? (row[nameIndex] || '') : '',
        phone: normalizePhone(row[phoneIndex] || ''),
        variables,
      }
    }).filter(r => r.phone)

    setLoadedContacts(prev => [...prev, ...newContacts])

    // Reset paste state
    setPastedText('')
    setParsedRows([])
    setColumnNames([])
    setShowColumnMapping(false)
    setManualEntryMode('single')
    setShowManualEntryPopup(false)
  }

  // Add custom field for manual entry
  const handleAddCustomField = () => {
    setManualCustomFields(prev => [...prev, { name: '', value: '' }])
  }

  // Update custom field
  const handleUpdateCustomField = (index: number, field: 'name' | 'value', value: string) => {
    setManualCustomFields(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f))
  }

  // Remove custom field
  const handleRemoveCustomField = (index: number) => {
    setManualCustomFields(prev => prev.filter((_, i) => i !== index))
  }

  // Add single manual contact with custom fields
  const handleAddManualContactWithCustomFields = () => {
    if (!manualPhone.trim()) return

    const variables: Record<string, string> = {}
    manualCustomFields.forEach(field => {
      if (field.name.trim() && field.value.trim()) {
        variables[field.name.trim()] = field.value.trim()
      }
    })

    const newContact = {
      id: `manual-${Date.now()}`,
      name: manualName.trim(),
      phone: normalizePhone(manualPhone),
      variables,
    }

    setLoadedContacts(prev => [...prev, newContact])

    // Reset
    setManualName('')
    setManualPhone('')
    setManualCustomFields([])
  }

  // Reset all form states
  const resetFormStates = () => {
    setLoadMethodDetails('')
    setLoadedContacts([])
    setShowManualEntryPopup(false)
    setManualName('')
    setManualPhone('')
    setManualEntryMode('single')
    setPastedText('')
    setParsedRows([])
    setColumnNames([])
    setManualCustomFields([])
    setShowColumnMapping(false)
    setShowExcelPopup(false)
    setExcelData([])
    setExcelColumnNames([])
    setHasHeaders(true)
    setExcelFileName('')
    setSheetsUrl('')
    setSheetsLoading(false)
    setNewListName('')
    setNewBlacklistPhone('')
    setNewBlacklistReason('')
  }

  // ==================== END UPLOAD FUNCTIONS ====================

  const addHistoryEntry = async (
    listId: string,
    actionType: ListHistoryItem['action_type'],
    description: string,
    campaignId?: string
  ) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('list_history')
      .insert({
        list_id: listId,
        user_id: user.id,
        action_type: actionType,
        description,
        campaign_id: campaignId || null
      })
      .select()
      .single()

    if (data) {
      setListHistory([data, ...listHistory])
    }
  }

  const createList = async () => {
    if (!newListName.trim()) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('contact_lists')
      .insert({
        user_id: user.id,
        name: newListName.trim(),
        contact_count: 0
      })
      .select()
      .single()

    if (!error && data) {
      setLists([data, ...lists])
      setSelectedList(data)
      setNewListName('')
    }
  }

  const deleteList = async () => {
    if (!listToDelete) return

    const supabase = createClient()
    await supabase.from('contacts').delete().eq('list_id', listToDelete.id)
    await supabase.from('contact_lists').delete().eq('id', listToDelete.id)

    setLists(lists.filter(l => l.id !== listToDelete.id))
    if (selectedList?.id === listToDelete.id) {
      setSelectedList(lists.find(l => l.id !== listToDelete.id) || null)
    }
    setListToDelete(null)
  }

  const createContact = async () => {
    if (!newContactPhone.trim() || !selectedList) return

    const supabase = createClient()

    // Filter out empty values from variables
    const cleanVariables: Record<string, string> = {}
    Object.entries(newContactVariables).forEach(([key, value]) => {
      if (value.trim()) {
        cleanVariables[key] = value.trim()
      }
    })

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        list_id: selectedList.id,
        phone: normalizePhone(newContactPhone),
        name: null,
        email: null,
        variables: cleanVariables,
        is_blacklisted: false
      })
      .select()
      .single()

    if (!error && data) {
      setContacts([data, ...contacts])
      await supabase
        .from('contact_lists')
        .update({ contact_count: selectedList.contact_count + 1 })
        .eq('id', selectedList.id)

      setSelectedList({ ...selectedList, contact_count: selectedList.contact_count + 1 })
      setLists(lists.map(l => l.id === selectedList.id ? { ...l, contact_count: l.contact_count + 1 } : l))

      // Add history entry
      const date = new Date().toLocaleDateString('he-IL')
      await addHistoryEntry(selectedList.id, 'contacts_added', `הוספת נמען לקבוצה ב- ${date}`)

      setShowNewContactModal(false)
      setNewContactPhone('')
      setNewContactVariables({})
    }
  }

  const deleteContact = async () => {
    if (!contactToDelete || !selectedList) return

    const supabase = createClient()
    await supabase.from('contacts').delete().eq('id', contactToDelete.id)

    setContacts(contacts.filter(c => c.id !== contactToDelete.id))

    await supabase
      .from('contact_lists')
      .update({ contact_count: Math.max(0, selectedList.contact_count - 1) })
      .eq('id', selectedList.id)

    setSelectedList({ ...selectedList, contact_count: Math.max(0, selectedList.contact_count - 1) })
    setLists(lists.map(l => l.id === selectedList.id ? { ...l, contact_count: Math.max(0, l.contact_count - 1) } : l))

    // Add history entry
    const date = new Date().toLocaleDateString('he-IL')
    await addHistoryEntry(selectedList.id, 'contacts_removed', `מחיקת נמען מהקבוצה ב- ${date}`)

    setContactToDelete(null)
  }

  const updateContact = async () => {
    if (!editingContact || !newContactPhone.trim()) return

    const supabase = createClient()

    // Filter out empty values from variables
    const cleanVariables: Record<string, string> = {}
    Object.entries(newContactVariables).forEach(([key, value]) => {
      if (value.trim()) {
        cleanVariables[key] = value.trim()
      }
    })

    const { error } = await supabase
      .from('contacts')
      .update({
        phone: normalizePhone(newContactPhone),
        variables: cleanVariables
      })
      .eq('id', editingContact.id)

    if (!error) {
      setContacts(contacts.map(c =>
        c.id === editingContact.id
          ? { ...c, phone: normalizePhone(newContactPhone), variables: cleanVariables }
          : c
      ))
      setEditingContact(null)
      setNewContactPhone('')
      setNewContactVariables({})
      setCustomFields([])
    }
  }

  const openEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setNewContactPhone(contact.phone)
    setNewContactVariables(contact.variables || {})
    setCustomFields([])
  }

  const toggleContactSort = (column: string) => {
    if (contactSortBy === column) {
      setContactSortOrder(contactSortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setContactSortBy(column)
      setContactSortOrder('asc')
    }
  }

  const deleteSelectedContacts = async () => {
    if (selectedContacts.size === 0 || !selectedList) return

    const supabase = createClient()
    const contactIds = Array.from(selectedContacts)

    await supabase.from('contacts').delete().in('id', contactIds)

    setContacts(contacts.filter(c => !selectedContacts.has(c.id)))

    const newCount = Math.max(0, selectedList.contact_count - contactIds.length)
    await supabase
      .from('contact_lists')
      .update({ contact_count: newCount })
      .eq('id', selectedList.id)

    setSelectedList({ ...selectedList, contact_count: newCount })
    setLists(lists.map(l => l.id === selectedList.id ? { ...l, contact_count: newCount } : l))

    // Add history entry
    const date = new Date().toLocaleDateString('he-IL')
    await addHistoryEntry(selectedList.id, 'contacts_removed', `מחיקת ${contactIds.length} נמענים מהקבוצה ב- ${date}`)

    setSelectedContacts(new Set())
  }

  const toggleListCheck = (listId: string) => {
    const newChecked = new Set(checkedLists)
    if (newChecked.has(listId)) {
      newChecked.delete(listId)
    } else {
      newChecked.add(listId)
    }
    setCheckedLists(newChecked)
  }

  const toggleContactSelect = (contactId: string) => {
    const newSelected = new Set(selectedContacts)
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId)
    } else {
      newSelected.add(contactId)
    }
    setSelectedContacts(newSelected)
  }

  const toggleSelectAllContacts = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set())
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)))
    }
  }

  const exportList = () => {
    if (!selectedList || contacts.length === 0) return

    // Get all unique variable keys from contacts
    const allVarKeys = new Set<string>()
    contacts.forEach(c => {
      if (c.variables) {
        Object.keys(c.variables).forEach(key => allVarKeys.add(key))
      }
    })
    const varKeysArray = Array.from(allVarKeys)

    const headers = ['phone', ...varKeysArray]
    const rows = contacts.map(c => {
      const row = [
        c.phone,
        ...varKeysArray.map(key => c.variables?.[key] || '')
      ]
      return row.join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedList.name}.csv`
    a.click()
    URL.revokeObjectURL(url)

    // Add history entry
    const date = new Date().toLocaleDateString('he-IL')
    addHistoryEntry(selectedList.id, 'exported', `ייצוא נמענים מהקבוצה ב- ${date}`)
  }

  const toggleListSort = (column: 'name' | 'count') => {
    if (listSortBy === column) {
      setListSortOrder(listSortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setListSortBy(column)
      setListSortOrder('asc')
    }
  }

  const filteredLists = lists
    .filter(l => l.name.toLowerCase().includes(searchListQuery.toLowerCase()))
    .sort((a, b) => {
      if (listSortBy === 'name') {
        const comparison = a.name.localeCompare(b.name, 'he')
        return listSortOrder === 'asc' ? comparison : -comparison
      } else {
        const comparison = a.contact_count - b.contact_count
        return listSortOrder === 'asc' ? comparison : -comparison
      }
    })

  const filteredContacts = contacts
    .filter(c => {
      const searchLower = searchContactQuery.toLowerCase()
      // Search in phone and all variables
      if (c.phone.includes(searchContactQuery)) return true
      if (c.name?.toLowerCase().includes(searchLower)) return true
      if (c.variables) {
        for (const value of Object.values(c.variables)) {
          if (value?.toLowerCase().includes(searchLower)) return true
        }
      }
      return false
    })
    .sort((a, b) => {
      let aVal: string, bVal: string
      if (contactSortBy === 'phone') {
        aVal = a.phone
        bVal = b.phone
      } else {
        aVal = a.variables?.[contactSortBy] || ''
        bVal = b.variables?.[contactSortBy] || ''
      }
      const comparison = aVal.localeCompare(bVal, 'he')
      return contactSortOrder === 'asc' ? comparison : -comparison
    })

  // Get dynamic column headers from contacts' variables
  const variableColumns = useMemo(() => {
    const allKeys = new Set<string>()
    contacts.forEach(c => {
      if (c.variables) {
        Object.keys(c.variables).forEach(key => {
          if (c.variables[key]) { // Only add if there's a value
            allKeys.add(key)
          }
        })
      }
    })
    return Array.from(allKeys)
  }, [contacts])

  const filteredBlacklist = blacklist.filter(b => {
    const query = searchContactQuery.toLowerCase()
    return b.phone.includes(searchContactQuery) ||
      b.reason?.toLowerCase().includes(query)
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('he-IL')
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F2F3F8]" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-[#0043E0]" />
      </div>
    )
  }

  return (
    <div className="h-full bg-[#F2F3F8] overflow-hidden flex" dir="rtl">
      {/* Right Sidebar - Lists */}
      <div className="w-[650px] flex flex-col h-full relative p-[30px]">
        {(showInlineNewListForm || showInlineBlacklistForm) ? (
          /* Inline Form - Regular Lists or Blacklist */
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Search Lists - TOP (same as normal view) */}
            <div className="bg-white rounded-[8px] h-[47px] flex items-center px-4 mb-4">
              <Search className="w-5 h-5 text-[#030733]" />
              <input
                type="text"
                placeholder="חפש רשימה מסויימת"
                value={searchListQuery}
                onChange={(e) => setSearchListQuery(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-right pr-3 text-[14px] text-[#030733] placeholder-[#A2A2A2]"
              />
            </div>

            {/* Tabs Row + Create Button */}
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => {
                  setFormActiveTab('regular')
                  setShowInlineNewListForm(true)
                  setShowInlineBlacklistForm(false)
                }}
                className={`px-[15px] py-[7px] rounded-[8px] text-[14px] ${
                  formActiveTab === 'regular' ? 'bg-white text-[#454545]' : 'bg-white text-[#454545]'
                }`}
              >
                רשימות לקוחות רגילות
              </button>
              <button
                onClick={() => {
                  setFormActiveTab('blacklist')
                  setShowInlineBlacklistForm(true)
                  setShowInlineNewListForm(false)
                }}
                className={`px-[15px] py-[7px] rounded-[8px] text-[14px] ${
                  formActiveTab === 'blacklist' ? 'bg-white text-[#454545]' : 'bg-white text-[#454545]'
                }`}
              >
                בלאק ליסט / רשימת שחורה
              </button>
              {/* Create List Button with X */}
              <button
                onClick={() => {
                  setShowInlineNewListForm(false)
                  setShowInlineBlacklistForm(false)
                  resetFormStates()
                }}
                className="px-[15px] py-[7px] rounded-[8px] text-[14px] bg-[#030733] text-white flex items-center gap-2 mr-auto"
              >
                <X className="w-4 h-4" />
                <span>צור רשימה</span>
              </button>
            </div>

            {formActiveTab === 'regular' ? (
              /* Regular List Form */
              <>
                {/* Title */}
                <h2 className="text-[20px] font-semibold text-[#030733] text-right mb-4">
                  הזנת שם לרשימת לקוחות חדשה
                </h2>

                {/* List Name Input */}
                <div className="bg-white rounded-[10px] h-[47px] flex items-center px-4 mb-6">
                  <input
                    type="text"
                    placeholder="דוגמא: לקוחות VIP מהשנה האחרונה"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-right text-[14px] text-[#030733] placeholder-[#A2A2A2]"
                  />
                </div>

                {/* Upload Method Title */}
                <h2 className="text-[20px] font-semibold text-[#030733] text-right mb-4">
                  איך תרצה לטעון את רשימת הנמענים?
                </h2>

                {/* Upload Method Select - First Dropdown */}
                <div className="relative mb-3">
                  <select
                    value={loadMethodDetails}
                    onChange={(e) => setLoadMethodDetails(e.target.value)}
                    className={`w-full h-[47px] px-4 rounded-[10px] text-[14px] outline-none appearance-none cursor-pointer bg-white ${loadMethodDetails ? 'text-[#030733]' : 'text-[#A2A2A2]'}`}
                  >
                    <option value="">בחר שיטת טעינה</option>
                    <option value="excel">קובץ Excel</option>
                    <option value="manual">הזנה ידנית</option>
                    <option value="sheets">Google Sheets</option>
                  </select>
                  <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[#030733] pointer-events-none" />
                </div>

                {/* Excel Upload */}
                {loadMethodDetails === 'excel' && (
                  <label className="w-full h-[47px] px-4 rounded-[10px] text-[14px] flex items-center justify-center cursor-pointer border-2 border-dashed bg-white border-gray-300 text-[#a2a2a2] hover:border-gray-400 mb-3">
                    <Upload className="w-[18px] h-[18px] ml-2" />
                    <span>לחץ להעלאת קובץ Excel</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleExcelUpload}
                      className="hidden"
                    />
                  </label>
                )}

                {/* Google Sheets URL */}
                {loadMethodDetails === 'sheets' && (
                  <div className="flex flex-col gap-2 mb-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={sheetsUrl}
                        onChange={(e) => setSheetsUrl(e.target.value)}
                        placeholder="הדבק קישור ל-Google Sheets"
                        className="flex-1 h-[47px] px-4 rounded-[10px] text-[14px] outline-none bg-white text-[#030733] placeholder-[#a2a2a2]"
                      />
                      <button
                        onClick={handleLoadGoogleSheets}
                        disabled={sheetsLoading || !sheetsUrl.trim()}
                        className="h-[47px] px-[18px] rounded-[10px] text-[14px] font-medium transition-colors disabled:opacity-50 bg-[#030733] text-white hover:bg-[#0a1628]"
                      >
                        {sheetsLoading ? 'טוען...' : 'טען'}
                      </button>
                    </div>
                    <p className="text-[12px] text-gray-500">
                      הגיליון חייב להיות ציבורי (כל מי שיש לו את הקישור יכול לצפות)
                    </p>
                  </div>
                )}

                {/* Manual Entry Button */}
                {loadMethodDetails === 'manual' && (
                  <button
                    onClick={() => setShowManualEntryPopup(true)}
                    className="w-full h-[47px] px-4 rounded-[10px] text-[14px] font-medium bg-white text-[#030733] hover:bg-gray-100 mb-3"
                  >
                    פתח חלון הזנה ידנית
                  </button>
                )}

                {/* Show loaded contacts count */}
                {loadedContacts.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-[10px] p-3 mb-3">
                    <p className="text-[14px] text-green-700 font-medium text-right">
                      ✓ נטענו {loadedContacts.length} נמענים
                    </p>
                  </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Create Button - Blue */}
                <button
                  onClick={async () => {
                    if (newListName.trim()) {
                      // Create list first
                      const supabase = createClient()
                      const { data: { user } } = await supabase.auth.getUser()
                      if (!user) return

                      const { data: newList, error } = await supabase
                        .from('contact_lists')
                        .insert({
                          user_id: user.id,
                          name: newListName.trim(),
                          contact_count: loadedContacts.length
                        })
                        .select()
                        .single()

                      if (!error && newList) {
                        // Add contacts to list
                        if (loadedContacts.length > 0) {
                          const contactsToInsert = loadedContacts.map(c => ({
                            list_id: newList.id,
                            phone: c.phone,
                            name: c.name || null,
                            email: null,
                            variables: c.variables || {},
                            is_blacklisted: false
                          }))

                          await supabase.from('contacts').insert(contactsToInsert)
                        }

                        setLists([newList, ...lists])
                        setSelectedList(newList)
                        loadContacts(newList.id)
                        setShowInlineNewListForm(false)
                        resetFormStates()
                      }
                    }
                  }}
                  disabled={!newListName.trim()}
                  className={`w-full h-[47px] rounded-[10px] text-[16px] font-semibold transition-colors ${
                    newListName.trim()
                      ? 'bg-[#0043E0] text-white hover:bg-[#0035b0]'
                      : 'bg-[#7B7B7B] text-white cursor-not-allowed'
                  }`}
                >
                  סיימתי, צור רשימה {loadedContacts.length > 0 && `(${loadedContacts.length} נמענים)`}
                </button>
              </>
            ) : (
              /* Blacklist Form */
              <>
                {/* Title */}
                <h2 className="text-[20px] font-semibold text-[#030733] text-right mb-4">
                  הוספה לרשימה שחורה
                </h2>

                {/* Upload Method Select */}
                <div className="relative mb-3">
                  <select
                    value={loadMethodDetails}
                    onChange={(e) => setLoadMethodDetails(e.target.value)}
                    className={`w-full h-[47px] px-4 rounded-[10px] text-[14px] outline-none appearance-none cursor-pointer bg-white ${loadMethodDetails ? 'text-[#030733]' : 'text-[#A2A2A2]'}`}
                  >
                    <option value="">בחר שיטת טעינה</option>
                    <option value="excel">קובץ Excel</option>
                    <option value="manual">הזנה ידנית</option>
                    <option value="sheets">Google Sheets</option>
                  </select>
                  <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[#030733] pointer-events-none" />
                </div>

                {/* Excel Upload */}
                {loadMethodDetails === 'excel' && (
                  <label className="w-full h-[47px] px-4 rounded-[10px] text-[14px] flex items-center justify-center cursor-pointer border-2 border-dashed bg-white border-gray-300 text-[#a2a2a2] hover:border-gray-400 mb-3">
                    <Upload className="w-[18px] h-[18px] ml-2" />
                    <span>לחץ להעלאת קובץ Excel</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleExcelUpload}
                      className="hidden"
                    />
                  </label>
                )}

                {/* Google Sheets URL */}
                {loadMethodDetails === 'sheets' && (
                  <div className="flex flex-col gap-2 mb-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={sheetsUrl}
                        onChange={(e) => setSheetsUrl(e.target.value)}
                        placeholder="הדבק קישור ל-Google Sheets"
                        className="flex-1 h-[47px] px-4 rounded-[10px] text-[14px] outline-none bg-white text-[#030733] placeholder-[#a2a2a2]"
                      />
                      <button
                        onClick={handleLoadGoogleSheets}
                        disabled={sheetsLoading || !sheetsUrl.trim()}
                        className="h-[47px] px-[18px] rounded-[10px] text-[14px] font-medium transition-colors disabled:opacity-50 bg-[#030733] text-white hover:bg-[#0a1628]"
                      >
                        {sheetsLoading ? 'טוען...' : 'טען'}
                      </button>
                    </div>
                    <p className="text-[12px] text-gray-500">
                      הגיליון חייב להיות ציבורי (כל מי שיש לו את הקישור יכול לצפות)
                    </p>
                  </div>
                )}

                {/* Manual Entry Button */}
                {loadMethodDetails === 'manual' && (
                  <button
                    onClick={() => setShowManualEntryPopup(true)}
                    className="w-full h-[47px] px-4 rounded-[10px] text-[14px] font-medium bg-white text-[#030733] hover:bg-gray-100 mb-3"
                  >
                    פתח חלון הזנה ידנית
                  </button>
                )}

                {/* Show loaded contacts count */}
                {loadedContacts.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-[10px] p-3 mb-3">
                    <p className="text-[14px] text-red-700 font-medium text-right">
                      ✓ נטענו {loadedContacts.length} מספרים להוספה לרשימה שחורה
                    </p>
                  </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Add Button - Red */}
                <button
                  onClick={async () => {
                    if (loadedContacts.length > 0) {
                      const supabase = createClient()
                      const { data: { user } } = await supabase.auth.getUser()
                      if (!user) return

                      // Add all loaded contacts to blacklist
                      const blacklistEntries = loadedContacts.map(c => ({
                        user_id: user.id,
                        phone: c.phone,
                        reason: 'נוסף מקובץ/הזנה ידנית'
                      }))

                      // Upsert to avoid duplicates
                      const { error } = await supabase
                        .from('blacklist')
                        .upsert(blacklistEntries, { onConflict: 'user_id,phone', ignoreDuplicates: true })

                      if (!error) {
                        await loadBlacklist()
                        setShowInlineBlacklistForm(false)
                        resetFormStates()
                      }
                    }
                  }}
                  disabled={loadedContacts.length === 0}
                  className={`w-full h-[47px] rounded-[10px] text-[16px] font-semibold transition-colors ${
                    loadedContacts.length > 0
                      ? 'bg-[#CD1B1B] text-white hover:bg-[#b01818]'
                      : 'bg-[#7B7B7B] text-white cursor-not-allowed'
                  }`}
                >
                  הוסף {loadedContacts.length} לרשימה שחורה
                </button>

                {/* Cancel link */}
                <button
                  onClick={() => {
                    setShowInlineBlacklistForm(false)
                    resetFormStates()
                  }}
                  className="mt-3 text-[14px] text-[#595C7A] hover:underline"
                >
                  ביטול
                </button>
              </>
            )}
          </div>
        ) : (
          /* Normal Lists View */
          <>
            {/* Search Lists - TOP */}
            <div className="bg-white rounded-[8px] h-[47px] flex items-center px-4 mb-4">
              <Search className="w-5 h-5 text-[#030733]" />
              <input
                type="text"
                placeholder="חפש רשימה מסויימת"
                value={searchListQuery}
                onChange={(e) => setSearchListQuery(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-right pr-3 text-[14px] text-[#030733] placeholder-[#A2A2A2]"
              />
            </div>

            {/* Tabs + Add Button Row */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => {
                  setActiveTab('regular')
                  setSelectedBlacklistEntries(new Set())
                  setBlacklistSelected(false)
                }}
                className={`px-[15px] py-[7px] rounded-[8px] text-[14px] ${
                  activeTab === 'regular'
                    ? 'bg-[#030733] text-white'
                    : 'bg-white text-[#454545]'
                }`}
              >
                רשימות לקוחות רגילות
              </button>
              <button
                onClick={() => {
                  setActiveTab('blacklist')
                  setSelectedList(null)
                  setSelectedContacts(new Set())
                  setBlacklistSelected(true)
                }}
                className={`px-[15px] py-[7px] rounded-[8px] text-[14px] ${
                  activeTab === 'blacklist'
                    ? 'bg-[#030733] text-white'
                    : 'bg-white text-[#454545]'
                }`}
              >
                בלאק ליסט / רשימת שחורה
              </button>
              {/* Add Button - LEFT of tabs */}
              <button
                onClick={() => activeTab === 'regular' ? setShowInlineNewListForm(true) : setShowInlineBlacklistForm(true)}
                className="w-[35px] h-[35px] bg-[#030733] rounded-[6px] flex items-center justify-center"
              >
                <Plus className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Scroll Up Arrow */}
            <div className="flex justify-end mb-2">
              <ChevronUp className="w-[15px] h-[15px] text-[#030733]" />
            </div>

            {activeTab === 'regular' ? (
              <>
                {/* Column Headers - aligned with list items below */}
                <div className="flex items-center px-3 mb-2">
                  {/* Empty space for checkbox */}
                  <div className="w-[17px] ml-2 flex-shrink-0" />

                  {/* שם קבוצת הלקוחות - above list name - clickable for sorting */}
                  <button
                    onClick={() => toggleListSort('name')}
                    className="flex-1 flex items-center gap-1 hover:opacity-70 transition-opacity"
                  >
                    <span className="text-[14px] text-[#030733]">שם קבוצת הלקוחות</span>
                    {listSortBy === 'name' ? (
                      listSortOrder === 'asc' ? (
                        <ChevronUp className="w-[13px] h-[13px] text-[#030733]" />
                      ) : (
                        <ChevronDown className="w-[13px] h-[13px] text-[#030733]" />
                      )
                    ) : (
                      <ChevronDown className="w-[13px] h-[13px] text-[#030733] opacity-50" />
                    )}
                  </button>

                  {/* נמענים - above count - clickable for sorting */}
                  <button
                    onClick={() => toggleListSort('count')}
                    className="flex items-center justify-start gap-1 ml-6 hover:opacity-70 transition-opacity"
                  >
                    <span className="text-[14px] text-[#030733]">נמענים</span>
                    {listSortBy === 'count' ? (
                      listSortOrder === 'asc' ? (
                        <ChevronUp className="w-[13px] h-[13px] text-[#030733]" />
                      ) : (
                        <ChevronDown className="w-[13px] h-[13px] text-[#030733]" />
                      )
                    ) : (
                      <ChevronDown className="w-[13px] h-[13px] text-[#030733] opacity-50" />
                    )}
                  </button>

                  {/* Empty space for delete button */}
                  <div className="w-[30px] flex-shrink-0" />
                </div>

                {/* Lists */}
                <div className="flex-1 overflow-y-auto space-y-[5px] relative">
                  {filteredLists.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-[14px] text-[#595C7A]">
                        {searchListQuery ? 'לא נמצאו רשימות' : 'אין רשימות עדיין'}
                      </p>
                      <button
                        onClick={() => setShowInlineNewListForm(true)}
                        className="mt-3 text-[#0043E0] text-[14px] font-medium hover:underline"
                      >
                        צור רשימה חדשה
                      </button>
                    </div>
                  ) : (
                    filteredLists.map((list) => {
                      const isSelected = selectedList?.id === list.id
                      return (
                        <div
                          key={list.id}
                          onClick={() => setSelectedList(list)}
                          className={`w-full h-[47px] rounded-[8px] flex items-center px-3 cursor-pointer overflow-hidden relative ${
                            isSelected
                              ? 'bg-[#030733]'
                              : 'bg-white'
                          }`}
                        >
                          {/* Checkbox - RIGHT side (first in RTL flex) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleListCheck(list.id)
                            }}
                            className={`w-[17px] h-[17px] rounded-[4.25px] border flex items-center justify-center flex-shrink-0 ml-2 ${
                              checkedLists.has(list.id)
                                ? isSelected ? 'bg-white border-white' : 'bg-[#030733] border-[#030733]'
                                : isSelected
                                  ? 'border-white'
                                  : 'border-[#030733]'
                            }`}
                          >
                            {checkedLists.has(list.id) && (
                              <Check className={`w-[10px] h-[10px] ${isSelected ? 'text-[#030733]' : 'text-white'}`} />
                            )}
                          </button>

                          {/* List Name */}
                          <div className="flex-1 truncate">
                            <span className={`text-[14px] font-semibold ${isSelected ? 'text-white' : 'text-[#030733]'}`}>
                              {list.name}
                            </span>
                          </div>

                          {/* Count */}
                          <span className={`text-[14px] ml-6 flex-shrink-0 ${isSelected ? 'text-[#D7D7D7]' : 'text-[#454545]'}`}>
                            {list.contact_count} נמענים
                          </span>

                          {/* Delete Button - LEFT side (last in RTL flex) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setListToDelete(list)
                            }}
                            className="w-[30px] h-[30px] rounded-[5px] flex items-center justify-center flex-shrink-0"
                          >
                            <Trash2 className="w-[17px] h-[17px] text-[#CD1B1B]" />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Blacklist - same layout as regular lists */}
                <div className="flex items-center px-3 mb-2">
                  {/* Empty space for checkbox */}
                  <div className="w-[17px] ml-2 flex-shrink-0" />

                  {/* שם הרשימה */}
                  <div className="flex-1">
                    <span className="text-[14px] text-[#030733]">שם הרשימה</span>
                  </div>

                  {/* נמענים */}
                  <div className="flex items-center justify-start gap-1 ml-6">
                    <span className="text-[14px] text-[#030733]">נמענים</span>
                  </div>

                  {/* Empty space for delete button */}
                  <div className="w-[30px] flex-shrink-0" />
                </div>

                {/* Blacklist as single "list" item */}
                <div className="flex-1 overflow-y-auto space-y-[5px] relative">
                  {blacklistLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-[#0043E0]" />
                    </div>
                  ) : (
                    <div
                      onClick={() => setBlacklistSelected(true)}
                      className={`w-full h-[47px] rounded-[8px] flex items-center px-3 cursor-pointer overflow-hidden relative ${
                        blacklistSelected
                          ? 'bg-[#030733]'
                          : 'bg-white'
                      }`}
                    >
                      {/* Checkbox placeholder */}
                      <div className="w-[17px] h-[17px] ml-2 flex-shrink-0" />

                      {/* List Name */}
                      <div className="flex-1 truncate">
                        <span className={`text-[14px] font-semibold ${blacklistSelected ? 'text-white' : 'text-[#030733]'}`}>
                          רשימה שחורה
                        </span>
                      </div>

                      {/* Count */}
                      <span className={`text-[14px] ml-6 flex-shrink-0 ${blacklistSelected ? 'text-[#D7D7D7]' : 'text-[#454545]'}`}>
                        {blacklist.length} נמענים
                      </span>

                      {/* Empty space for delete button alignment */}
                      <div className="w-[30px] flex-shrink-0" />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Scroll Down Arrow */}
            <div className="py-2 flex justify-end">
              <ChevronDown className="w-[15px] h-[15px] text-[#030733]" />
            </div>
          </>
        )}
      </div>

      {/* Main Content - Contacts Table */}
      <div className="w-[565px] flex-shrink-0 p-[35px] pl-[35px] pr-0">
        {(showInlineNewListForm || showInlineBlacklistForm) ? (
          /* Load Recipients Form when creating new list */
          <div className="bg-white rounded-[15px] h-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-5 pb-0">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-[20px] font-semibold text-[#030733]">
                    'טען רשימת נמענים'
                  </h2>
                  <div className="flex items-center gap-1 mt-1">
                    <Users className="w-[18px] h-[18px] text-[#030733]" />
                    <span className="text-[14px] text-[#454545]">
                      טען נמענים
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="mx-5 border-b border-[#030733]/40" />

            {/* Search and Actions Row */}
            <div className="p-5 pb-0">
              <div className="flex items-center gap-2">
                {/* Delete Button */}
                <button
                  onClick={() => {
                    setLoadedContacts([])
                  }}
                  className="w-[47px] h-[47px] bg-[#CD1B1B] rounded-[8px] flex items-center justify-center"
                  disabled={loadedContacts.length === 0}
                >
                  <Trash2 className="w-6 h-6 text-white" />
                </button>

                {/* Add Contact Button */}
                <button
                  onClick={() => setShowManualEntryPopup(true)}
                  className="w-[47px] h-[47px] bg-[#030733] rounded-[8px] flex items-center justify-center"
                >
                  <span className="text-white text-[32px] font-normal leading-none">+</span>
                </button>

                {/* Search Input */}
                <div className="flex-1 bg-[#F2F3F8] rounded-[8px] h-[47px] flex items-center px-4">
                  <Search className="w-5 h-5 text-[#030733]" />
                  <input
                    type="text"
                    placeholder="חפש נמענים"
                    className="flex-1 bg-transparent border-none outline-none text-right pr-3 text-[14px] text-[#030733] placeholder-[#505050]"
                  />
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex items-center justify-center p-5">
              {loadedContacts.length === 0 ? (
                <p className="text-[14px] text-[#030733]">
                  טען רשימת לקוחות על מנת לצפות ולערוך אותם
                </p>
              ) : (
                <div className="w-full h-full overflow-y-auto">
                  {/* Table of loaded contacts */}
                  <table className="w-full">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-right border-b">
                        <th className="py-2 px-3 text-[12px] font-medium text-[#030733]">שם</th>
                        <th className="py-2 px-3 text-[12px] font-medium text-[#030733]">טלפון</th>
                        <th className="py-2 px-3 text-[12px] font-medium text-[#030733]">פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadedContacts.map((contact, index) => (
                        <tr key={contact.id || index} className="border-b border-gray-100">
                          <td className="py-2 px-3 text-[12px] text-[#030733]">{contact.name || '-'}</td>
                          <td className="py-2 px-3 text-[12px] text-[#030733]" dir="ltr">{contact.phone}</td>
                          <td className="py-2 px-3">
                            <button
                              onClick={() => setLoadedContacts(prev => prev.filter((_, i) => i !== index))}
                              className="text-[#CD1B1B] hover:opacity-70"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : selectedList ? (
          <div className="bg-white rounded-[15px] h-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-5 pb-0">
              {/* Top Row - Title and Info + Action Buttons */}
              <div className="flex items-start justify-between mb-4">
                {/* Title and Info - RIGHT side in RTL */}
                <div>
                  <h2 className="text-[20px] font-semibold text-[#030733]">
                    {selectedList.name}
                  </h2>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1">
                      <Users className="w-[18px] h-[18px] text-[#030733]" />
                      <span className="text-[14px] text-[#454545]">
                        כמות נמענים - {selectedList.contact_count}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-[18px] h-[18px] text-[#030733]" />
                      <span className="text-[14px] text-[#454545]">
                        תאריך יצירה - {formatDate(selectedList.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - LEFT side in RTL */}
                <div className="flex items-center gap-[5px]">
                  <button
                    onClick={() => setListToDelete(selectedList)}
                    className="w-[42px] h-[42px] bg-[#CD1B1B] rounded-[9px] flex items-center justify-center"
                  >
                    <Trash2 className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={exportList}
                    className="w-[42px] h-[42px] bg-[#030733] rounded-[9px] flex items-center justify-center"
                  >
                    <Download className="w-6 h-6 text-white" />
                  </button>
                  <button className="w-[42px] h-[42px] bg-[#030733] rounded-[9px] flex items-center justify-center">
                    <Copy className="w-6 h-6 text-white" />
                  </button>
                  <button className="w-[42px] h-[42px] bg-[#030733] rounded-[9px] flex items-center justify-center">
                    <Upload className="w-6 h-6 text-white" />
                  </button>
                  <button className="w-[42px] h-[42px] bg-[#030733] rounded-[9px] flex items-center justify-center">
                    <Share2 className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="h-[0.5px] bg-[#030733]/40 mb-4" />

              {/* Search and Actions Row */}
              <div className="flex items-center justify-between mb-4">
                {/* Search Contacts - RIGHT side in RTL */}
                <div className="bg-[#F2F3F8] rounded-[8px] h-[47px] flex items-center px-4 w-[488px]">
                  <Search className="w-5 h-5 text-[#030733]" />
                  <input
                    type="text"
                    placeholder="חפש נמענים"
                    value={searchContactQuery}
                    onChange={(e) => setSearchContactQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-right pr-3 text-[14px] text-[#030733] placeholder-[#505050]"
                  />
                </div>

                {/* Action Buttons - LEFT side in RTL */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowNewContactModal(true)}
                    className="w-[47px] h-[47px] bg-[#030733] rounded-[8px] flex items-center justify-center"
                  >
                    <span className="text-white text-[30px] font-light leading-none">+</span>
                  </button>
                  <button
                    onClick={deleteSelectedContacts}
                    disabled={selectedContacts.size === 0}
                    className="w-[47px] h-[47px] bg-[#CD1B1B] rounded-[8px] flex items-center justify-center disabled:opacity-50"
                  >
                    <Trash2 className="w-[27px] h-[27px] text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Table Header */}
            <div className="px-5 flex items-center h-[40px] relative">
              {/* Active indicator for table */}
              <div className="absolute left-[10px] top-1/2 -translate-y-1/2 w-[3px] h-[39px] bg-[#030733] rounded-full" />

              {/* Checkbox - RIGHT side in RTL */}
              <div className="w-[40px] flex-shrink-0 flex justify-center">
                <button
                  onClick={toggleSelectAllContacts}
                  className={`w-[17px] h-[17px] rounded-[4.25px] border border-[#030733] flex items-center justify-center ${
                    selectedContacts.size === filteredContacts.length && filteredContacts.length > 0
                      ? 'bg-[#030733]'
                      : ''
                  }`}
                >
                  {selectedContacts.size === filteredContacts.length && filteredContacts.length > 0 && (
                    <Check className="w-[10px] h-[10px] text-white" />
                  )}
                </button>
              </div>

              {/* טלפון - always shown - clickable for sorting */}
              <button
                onClick={() => toggleContactSort('phone')}
                className="w-[120px] flex items-center justify-start gap-1 px-2 hover:opacity-70 transition-opacity"
              >
                <span className="text-[14px] text-[#030733]">טלפון</span>
                {contactSortBy === 'phone' ? (
                  contactSortOrder === 'asc' ? (
                    <ChevronUp className="w-[13px] h-[13px] text-[#030733]" />
                  ) : (
                    <ChevronDown className="w-[13px] h-[13px] text-[#030733]" />
                  )
                ) : (
                  <ChevronDown className="w-[13px] h-[13px] text-[#030733] opacity-50" />
                )}
              </button>

              {/* Dynamic columns from variables - clickable for sorting */}
              {variableColumns.map((column) => (
                <button
                  key={column}
                  onClick={() => toggleContactSort(column)}
                  className="flex-1 flex items-center justify-start gap-1 px-2 min-w-[100px] hover:opacity-70 transition-opacity"
                >
                  <span className="text-[14px] text-[#030733]">{column}</span>
                  {contactSortBy === column ? (
                    contactSortOrder === 'asc' ? (
                      <ChevronUp className="w-[13px] h-[13px] text-[#030733]" />
                    ) : (
                      <ChevronDown className="w-[13px] h-[13px] text-[#030733]" />
                    )
                  ) : (
                    <ChevronDown className="w-[13px] h-[13px] text-[#030733] opacity-50" />
                  )}
                </button>
              ))}
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-y-auto px-5">
              {contactsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0043E0]" />
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Users className="w-16 h-16 mb-4 text-gray-300" />
                  <p className="text-[16px] font-medium text-[#030733] mb-2">
                    {searchContactQuery ? 'לא נמצאו תוצאות' : 'הרשימה ריקה'}
                  </p>
                  <p className="text-[14px] text-[#595C7A] mb-4">
                    הוסף נמענים או ייבא מקובץ Excel
                  </p>
                  <button
                    onClick={() => setShowNewContactModal(true)}
                    className="bg-[#0043E0] text-white px-6 py-2 rounded-[8px] text-[14px] font-semibold hover:bg-[#0035b0] transition-colors"
                  >
                    הוסף נמען
                  </button>
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    onClick={() => openEditContact(contact)}
                    className="h-[43px] flex items-center border-t border-[#030733]/40 cursor-pointer hover:bg-[#F2F3F8] transition-colors"
                  >
                    {/* Checkbox */}
                    <div className="w-[40px] flex-shrink-0 flex justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleContactSelect(contact.id)
                        }}
                        className={`w-[17px] h-[17px] rounded-[4.25px] border border-[#030733] flex items-center justify-center ${
                          selectedContacts.has(contact.id) ? 'bg-[#030733]' : ''
                        }`}
                      >
                        {selectedContacts.has(contact.id) && (
                          <Check className="w-[10px] h-[10px] text-white" />
                        )}
                      </button>
                    </div>

                    {/* טלפון - always shown */}
                    <div className="w-[120px] px-2 text-right">
                      <span className="text-[14px] text-[#505050]" dir="ltr">
                        {formatPhoneForDisplay(contact.phone)}
                      </span>
                    </div>

                    {/* Dynamic columns from variables */}
                    {variableColumns.map((column) => (
                      <div key={column} className="flex-1 px-2 min-w-[100px] truncate text-right">
                        <span className="text-[14px] text-[#505050]">
                          {contact.variables?.[column] || '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Bottom scroll arrow */}
            <div className="flex justify-start px-4 py-2">
              <ChevronDown className="w-[15px] h-[15px] text-[#030733]" />
            </div>
          </div>
        ) : activeTab === 'blacklist' && blacklistSelected ? (
          <div className="bg-white rounded-[15px] h-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-5 pb-0">
              {/* Top Row - Title and Info + Action Buttons */}
              <div className="flex items-start justify-between mb-4">
                {/* Title and Info - RIGHT side in RTL */}
                <div>
                  <h2 className="text-[20px] font-semibold text-[#030733]">
                    רשימה שחורה
                  </h2>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1">
                      <Users className="w-[18px] h-[18px] text-[#030733]" />
                      <span className="text-[14px] text-[#454545]">
                        כמות נמענים - {blacklist.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - LEFT side in RTL */}
                <div className="flex items-center gap-[5px]">
                  <button
                    onClick={removeSelectedFromBlacklist}
                    disabled={selectedBlacklistEntries.size === 0}
                    className="w-[42px] h-[42px] bg-[#CD1B1B] rounded-[9px] flex items-center justify-center disabled:opacity-50"
                  >
                    <Trash2 className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="h-[0.5px] bg-[#030733]/40 mb-4" />

              {/* Search and Actions Row */}
              <div className="flex items-center justify-between mb-4">
                {/* Search - RIGHT side in RTL */}
                <div className="bg-[#F2F3F8] rounded-[8px] h-[47px] flex items-center px-4 w-[488px]">
                  <Search className="w-5 h-5 text-[#030733]" />
                  <input
                    type="text"
                    placeholder="חפש נמענים"
                    value={searchContactQuery}
                    onChange={(e) => setSearchContactQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-right pr-3 text-[14px] text-[#030733] placeholder-[#505050]"
                  />
                </div>

                {/* Action Buttons - LEFT side in RTL */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setFormActiveTab('blacklist')
                      setShowInlineBlacklistForm(true)
                    }}
                    className="w-[47px] h-[47px] bg-[#030733] rounded-[8px] flex items-center justify-center"
                  >
                    <span className="text-white text-[30px] font-light leading-none">+</span>
                  </button>
                  <button
                    onClick={removeSelectedFromBlacklist}
                    disabled={selectedBlacklistEntries.size === 0}
                    className="w-[47px] h-[47px] bg-[#CD1B1B] rounded-[8px] flex items-center justify-center disabled:opacity-50"
                  >
                    <Trash2 className="w-[27px] h-[27px] text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Table Header */}
            <div className="px-5 flex items-center h-[40px] relative">
              {/* Active indicator for table */}
              <div className="absolute left-[10px] top-1/2 -translate-y-1/2 w-[3px] h-[39px] bg-[#CD1B1B] rounded-full" />

              {/* Checkbox - RIGHT side in RTL */}
              <div className="w-[40px] flex-shrink-0 flex justify-center">
                <button
                  onClick={toggleSelectAllBlacklist}
                  className={`w-[17px] h-[17px] rounded-[4.25px] border border-[#030733] flex items-center justify-center ${
                    selectedBlacklistEntries.size === filteredBlacklist.length && filteredBlacklist.length > 0
                      ? 'bg-[#030733]'
                      : ''
                  }`}
                >
                  {selectedBlacklistEntries.size === filteredBlacklist.length && filteredBlacklist.length > 0 && (
                    <Check className="w-[10px] h-[10px] text-white" />
                  )}
                </button>
              </div>

              {/* טלפון */}
              <div className="w-[150px] flex items-center justify-start gap-1 px-2">
                <span className="text-[14px] text-[#030733]">טלפון</span>
              </div>

              {/* סיבה */}
              <div className="flex-1 flex items-center justify-start gap-1 px-2">
                <span className="text-[14px] text-[#030733]">סיבה</span>
              </div>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-y-auto px-5">
              {blacklistLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0043E0]" />
                </div>
              ) : filteredBlacklist.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Users className="w-16 h-16 mb-4 text-gray-300" />
                  <p className="text-[16px] font-medium text-[#030733] mb-2">
                    {searchContactQuery ? 'לא נמצאו תוצאות' : 'הרשימה ריקה'}
                  </p>
                  <p className="text-[14px] text-[#595C7A] mb-4">
                    הוסף מספרים לרשימה השחורה
                  </p>
                  <button
                    onClick={() => {
                      setFormActiveTab('blacklist')
                      setShowInlineBlacklistForm(true)
                    }}
                    className="bg-[#CD1B1B] text-white px-6 py-2 rounded-[8px] text-[14px] font-semibold hover:bg-[#b01818] transition-colors"
                  >
                    הוסף לרשימה שחורה
                  </button>
                </div>
              ) : (
                filteredBlacklist.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => openEditBlacklistEntry(entry)}
                    className="h-[43px] flex items-center border-t border-[#030733]/40 cursor-pointer hover:bg-[#F2F3F8] transition-colors"
                  >
                    {/* Checkbox */}
                    <div className="w-[40px] flex-shrink-0 flex justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleBlacklistSelect(entry.id)
                        }}
                        className={`w-[17px] h-[17px] rounded-[4.25px] border border-[#030733] flex items-center justify-center ${
                          selectedBlacklistEntries.has(entry.id) ? 'bg-[#030733]' : ''
                        }`}
                      >
                        {selectedBlacklistEntries.has(entry.id) && (
                          <Check className="w-[10px] h-[10px] text-white" />
                        )}
                      </button>
                    </div>

                    {/* טלפון */}
                    <div className="w-[150px] px-2 text-right">
                      <span className="text-[14px] text-[#505050]" dir="ltr">
                        {formatPhoneForDisplay(entry.phone)}
                      </span>
                    </div>

                    {/* סיבה */}
                    <div className="flex-1 px-2 truncate text-right">
                      <span className="text-[14px] text-[#505050]">
                        {entry.reason || '-'}
                      </span>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFromBlacklist(entry.id)
                      }}
                      className="w-[30px] h-[30px] rounded-[5px] flex items-center justify-center flex-shrink-0 ml-2"
                    >
                      <Trash2 className="w-[17px] h-[17px] text-[#CD1B1B]" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Bottom scroll arrow */}
            <div className="flex justify-start px-4 py-2">
              <ChevronDown className="w-[15px] h-[15px] text-[#030733]" />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[15px] h-full flex flex-col items-center justify-center">
            <Users className="w-20 h-20 mb-4 text-gray-300" />
            <p className="text-[18px] font-medium text-[#030733] mb-2">
              בחר רשימה
            </p>
            <p className="text-[14px] text-[#595C7A]">
              או צור רשימה חדשה כדי להתחיל
            </p>
          </div>
        )}
      </div>

      {/* Left Sidebar - History - Always visible but hidden content when creating list */}
      <div className="w-[350px] flex flex-col h-full p-[35px] pr-0">
        {(showInlineNewListForm || showInlineBlacklistForm) ? (
          /* Empty state when creating new list - keeps layout but no content */
          null
        ) : (
          <>
            <h2 className="text-[16px] font-semibold text-[#030733] mb-4 text-right">
              היסטוריה על הקבוצה
            </h2>

            <div className="flex-1 overflow-y-auto space-y-[10px]">
              {!selectedList ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-[11px] text-[#595C7A]">בחר רשימה לצפייה בהיסטוריה</p>
                </div>
              ) : historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#0043E0]" />
            </div>
          ) : listHistory.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-[11px] text-[#595C7A]">אין היסטוריה עדיין</p>
            </div>
          ) : (
            listHistory.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-[10px] h-[48px] flex items-center justify-between px-3"
              >
                <span className="text-[11px] font-semibold text-[#030733] text-right">
                  {item.description}
                </span>
                {item.campaign_id && (
                  <button
                    onClick={() => window.location.href = `/campaigns/${item.campaign_id}`}
                    className="text-[11px] text-[#454545] underline hover:opacity-70"
                  >
                    לנתוני הקמפיין
                  </button>
                )}
              </div>
            ))
          )}
            </div>
          </>
        )}
      </div>

      {/* New Contact Modal */}
      {showNewContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[18px] p-6 w-full max-w-[400px] max-h-[80vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[18px] font-semibold text-[#030733]">הוספת נמען</h3>
              <button onClick={() => {
                setShowNewContactModal(false)
                setCustomFields([])
                setNewFieldName('')
              }} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-[#595C7A]" />
              </button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[14px] font-medium text-[#030733] mb-2">טלפון *</label>
                <input
                  type="tel"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  placeholder="050-1234567"
                  className="w-full h-[49px] px-4 bg-[#F2F3F8] text-[#030733] rounded-[10px] text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0]"
                  dir="ltr"
                />
              </div>

              {/* Existing columns from the list */}
              {variableColumns.map((column) => (
                <div key={column}>
                  <label className="block text-[14px] font-medium text-[#030733] mb-2">{column}</label>
                  <input
                    type="text"
                    value={newContactVariables[column] || ''}
                    onChange={(e) => setNewContactVariables({ ...newContactVariables, [column]: e.target.value })}
                    placeholder={column}
                    className="w-full h-[49px] px-4 bg-[#F2F3F8] text-[#030733] rounded-[10px] text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0]"
                  />
                </div>
              ))}

              {/* Custom fields added by user */}
              {customFields.map((field) => (
                <div key={field}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[14px] font-medium text-[#030733]">{field}</label>
                    <button
                      onClick={() => {
                        setCustomFields(customFields.filter(f => f !== field))
                        const newVars = { ...newContactVariables }
                        delete newVars[field]
                        setNewContactVariables(newVars)
                      }}
                      className="text-[#CD1B1B] hover:opacity-70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newContactVariables[field] || ''}
                    onChange={(e) => setNewContactVariables({ ...newContactVariables, [field]: e.target.value })}
                    placeholder={field}
                    className="w-full h-[49px] px-4 bg-[#F2F3F8] text-[#030733] rounded-[10px] text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0]"
                  />
                </div>
              ))}

              {/* Add new field */}
              <div className="border-t border-[#030733]/20 pt-4">
                <label className="block text-[14px] font-medium text-[#030733] mb-2">הוסף שדה חדש</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="שם השדה (לדוגמה: עיר, חברה...)"
                    className="flex-1 h-[49px] px-4 bg-[#F2F3F8] text-[#030733] rounded-[10px] text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newFieldName.trim()) {
                        e.preventDefault()
                        if (!variableColumns.includes(newFieldName.trim()) && !customFields.includes(newFieldName.trim())) {
                          setCustomFields([...customFields, newFieldName.trim()])
                          setNewFieldName('')
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newFieldName.trim() && !variableColumns.includes(newFieldName.trim()) && !customFields.includes(newFieldName.trim())) {
                        setCustomFields([...customFields, newFieldName.trim()])
                        setNewFieldName('')
                      }
                    }}
                    disabled={!newFieldName.trim() || variableColumns.includes(newFieldName.trim()) || customFields.includes(newFieldName.trim())}
                    className="h-[49px] px-4 bg-[#030733] text-white rounded-[10px] text-[14px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNewContactModal(false)
                  setCustomFields([])
                  setNewFieldName('')
                }}
                className="flex-1 h-[49px] border border-[#595C7A] text-[#030733] hover:bg-gray-100 rounded-[10px] font-medium text-[14px] transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={() => {
                  createContact()
                  setCustomFields([])
                  setNewFieldName('')
                }}
                disabled={!newContactPhone.trim()}
                className="flex-1 h-[49px] bg-[#0043E0] rounded-[10px] text-white font-semibold text-[14px] hover:bg-[#0035b0] transition-colors disabled:opacity-50"
              >
                הוסף
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {editingContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[18px] p-6 w-full max-w-[400px] max-h-[80vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[18px] font-semibold text-[#030733]">עריכת נמען</h3>
              <button onClick={() => {
                setEditingContact(null)
                setNewContactPhone('')
                setNewContactVariables({})
                setCustomFields([])
                setNewFieldName('')
              }} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-[#595C7A]" />
              </button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[14px] font-medium text-[#030733] mb-2">טלפון *</label>
                <input
                  type="tel"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  placeholder="050-1234567"
                  className="w-full h-[49px] px-4 bg-[#F2F3F8] text-[#030733] rounded-[10px] text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0]"
                  dir="ltr"
                />
              </div>

              {/* Existing columns from the list */}
              {variableColumns.map((column) => (
                <div key={column}>
                  <label className="block text-[14px] font-medium text-[#030733] mb-2">{column}</label>
                  <input
                    type="text"
                    value={newContactVariables[column] || ''}
                    onChange={(e) => setNewContactVariables({ ...newContactVariables, [column]: e.target.value })}
                    placeholder={column}
                    className="w-full h-[49px] px-4 bg-[#F2F3F8] text-[#030733] rounded-[10px] text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0]"
                  />
                </div>
              ))}

              {/* Custom fields added by user */}
              {customFields.map((field) => (
                <div key={field}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[14px] font-medium text-[#030733]">{field}</label>
                    <button
                      onClick={() => {
                        setCustomFields(customFields.filter(f => f !== field))
                        const newVars = { ...newContactVariables }
                        delete newVars[field]
                        setNewContactVariables(newVars)
                      }}
                      className="text-[#CD1B1B] hover:opacity-70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newContactVariables[field] || ''}
                    onChange={(e) => setNewContactVariables({ ...newContactVariables, [field]: e.target.value })}
                    placeholder={field}
                    className="w-full h-[49px] px-4 bg-[#F2F3F8] text-[#030733] rounded-[10px] text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0]"
                  />
                </div>
              ))}

              {/* Add new field */}
              <div className="border-t border-[#030733]/20 pt-4">
                <label className="block text-[14px] font-medium text-[#030733] mb-2">הוסף שדה חדש</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="שם השדה (לדוגמה: עיר, חברה...)"
                    className="flex-1 h-[49px] px-4 bg-[#F2F3F8] text-[#030733] rounded-[10px] text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newFieldName.trim()) {
                        e.preventDefault()
                        if (!variableColumns.includes(newFieldName.trim()) && !customFields.includes(newFieldName.trim())) {
                          setCustomFields([...customFields, newFieldName.trim()])
                          setNewFieldName('')
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newFieldName.trim() && !variableColumns.includes(newFieldName.trim()) && !customFields.includes(newFieldName.trim())) {
                        setCustomFields([...customFields, newFieldName.trim()])
                        setNewFieldName('')
                      }
                    }}
                    disabled={!newFieldName.trim() || variableColumns.includes(newFieldName.trim()) || customFields.includes(newFieldName.trim())}
                    className="h-[49px] px-4 bg-[#030733] text-white rounded-[10px] text-[14px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditingContact(null)
                  setNewContactPhone('')
                  setNewContactVariables({})
                  setCustomFields([])
                  setNewFieldName('')
                }}
                className="flex-1 h-[49px] border border-[#595C7A] text-[#030733] hover:bg-gray-100 rounded-[10px] font-medium text-[14px] transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={() => {
                  updateContact()
                  setCustomFields([])
                  setNewFieldName('')
                }}
                disabled={!newContactPhone.trim()}
                className="flex-1 h-[49px] bg-[#0043E0] rounded-[10px] text-white font-semibold text-[14px] hover:bg-[#0035b0] transition-colors disabled:opacity-50"
              >
                שמור שינויים
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Blacklist Entry Modal */}
      {editingBlacklistEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[18px] p-6 w-full max-w-[400px]" dir="rtl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[18px] font-semibold text-[#030733]">עריכת רשומה ברשימה שחורה</h3>
              <button onClick={() => {
                setEditingBlacklistEntry(null)
                setNewBlacklistPhone('')
                setNewBlacklistReason('')
              }} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-[#595C7A]" />
              </button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[14px] font-medium text-[#030733] mb-2">מספר טלפון *</label>
                <input
                  type="tel"
                  value={newBlacklistPhone}
                  onChange={(e) => setNewBlacklistPhone(e.target.value)}
                  placeholder="050-1234567"
                  className="w-full h-[49px] px-4 bg-[#F2F3F8] text-[#030733] rounded-[10px] text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-[14px] font-medium text-[#030733] mb-2">סיבה (אופציונלי)</label>
                <input
                  type="text"
                  value={newBlacklistReason}
                  onChange={(e) => setNewBlacklistReason(e.target.value)}
                  placeholder="לדוגמה: ביקש להסיר מרשימת תפוצה"
                  className="w-full h-[49px] px-4 bg-[#F2F3F8] text-[#030733] rounded-[10px] text-[14px] outline-none focus:ring-2 focus:ring-[#0043E0]"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditingBlacklistEntry(null)
                  setNewBlacklistPhone('')
                  setNewBlacklistReason('')
                }}
                className="flex-1 h-[49px] border border-[#595C7A] text-[#030733] hover:bg-gray-100 rounded-[10px] font-medium text-[14px] transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={updateBlacklistEntry}
                disabled={!newBlacklistPhone.trim()}
                className="flex-1 h-[49px] bg-[#0043E0] rounded-[10px] text-white font-semibold text-[14px] hover:bg-[#0035b0] transition-colors disabled:opacity-50"
              >
                שמור שינויים
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Popup */}
      {showManualEntryPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowManualEntryPopup(false)}>
          <div
            className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto rounded-[15px] p-4 sm:p-[20px] bg-white"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <h3 className="text-[18px] font-semibold mb-[15px] text-right text-[#030733]">
              הוספת נמענים ידנית
            </h3>

            {/* Mode Toggle */}
            <div className="flex gap-[8px] mb-[15px]">
              <button
                onClick={() => setManualEntryMode('single')}
                className={`flex-1 h-[36px] rounded-[8px] text-[13px] font-medium transition-colors ${
                  manualEntryMode === 'single'
                    ? 'bg-[#030733] text-white'
                    : 'bg-[#f2f3f8] text-[#595C7A]'
                }`}
              >
                הזנה בודדת
              </button>
              <button
                onClick={() => setManualEntryMode('paste')}
                className={`flex-1 h-[36px] rounded-[8px] text-[13px] font-medium transition-colors ${
                  manualEntryMode === 'paste'
                    ? 'bg-[#030733] text-white'
                    : 'bg-[#f2f3f8] text-[#595C7A]'
                }`}
              >
                הדבקת טקסט
              </button>
            </div>

            {manualEntryMode === 'single' ? (
              <>
                {/* Single Entry Mode */}
                <div className="flex flex-col gap-[12px]">
                  <div>
                    <label className="text-[14px] mb-[4px] block text-right text-[#030733]">
                      שם
                    </label>
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="הזן שם"
                      className="w-full h-[40px] px-[14px] rounded-[10px] text-[14px] outline-none text-right bg-[#f2f3f8] text-[#030733] placeholder-[#a2a2a2]"
                    />
                  </div>

                  <div>
                    <label className="text-[14px] mb-[4px] block text-right text-[#030733]">
                      טלפון
                    </label>
                    <input
                      type="tel"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      placeholder="הזן מספר טלפון"
                      className="w-full h-[40px] px-[14px] rounded-[10px] text-[14px] outline-none text-right bg-[#f2f3f8] text-[#030733] placeholder-[#a2a2a2]"
                      dir="ltr"
                    />
                  </div>

                  {/* Custom Fields */}
                  {manualCustomFields.map((field, index) => (
                    <div key={index} className="flex gap-[8px] items-end">
                      <div className="flex-1">
                        <label className="text-[12px] mb-[2px] block text-right text-[#595C7A]">
                          שם השדה
                        </label>
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => handleUpdateCustomField(index, 'name', e.target.value)}
                          placeholder="לדוגמה: עיר"
                          className="w-full h-[36px] px-[12px] rounded-[8px] text-[13px] outline-none text-right bg-[#f2f3f8] text-[#030733] placeholder-[#a2a2a2]"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[12px] mb-[2px] block text-right text-[#595C7A]">
                          ערך
                        </label>
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => handleUpdateCustomField(index, 'value', e.target.value)}
                          placeholder="הזן ערך"
                          className="w-full h-[36px] px-[12px] rounded-[8px] text-[13px] outline-none text-right bg-[#f2f3f8] text-[#030733] placeholder-[#a2a2a2]"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveCustomField(index)}
                        className="w-[36px] h-[36px] rounded-[8px] flex items-center justify-center bg-red-100 text-red-600 hover:bg-red-200"
                      >
                        <Trash2 className="w-[16px] h-[16px]" />
                      </button>
                    </div>
                  ))}

                  {/* Add Custom Field Button */}
                  <button
                    onClick={handleAddCustomField}
                    className="w-full h-[36px] rounded-[8px] text-[13px] font-medium border-2 border-dashed flex items-center justify-center gap-[6px] border-gray-300 text-[#595C7A] hover:border-gray-400"
                  >
                    <Plus className="w-[14px] h-[14px]" />
                    הוסף פרמטר נוסף
                  </button>
                </div>

                <div className="flex gap-[10px] mt-[20px]">
                  <button
                    onClick={() => handleAddManualContactWithCustomFields()}
                    disabled={!manualPhone}
                    className="flex-1 h-[40px] bg-[#030733] text-white rounded-[10px] text-[14px] font-medium hover:bg-[#0a1628] transition-colors disabled:opacity-50"
                  >
                    הוסף והמשך
                  </button>
                  <button
                    onClick={() => {
                      handleAddManualContactWithCustomFields()
                      setShowManualEntryPopup(false)
                    }}
                    disabled={!manualPhone}
                    className="flex-1 h-[40px] bg-[#030733] text-white rounded-[10px] text-[14px] font-medium hover:bg-[#0a1628] transition-colors disabled:opacity-50"
                  >
                    הוסף וסגור
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Paste Mode */}
                {!showColumnMapping ? (
                  /* Step 1: Paste the text */
                  <div className="flex flex-col gap-[12px]">
                    <div>
                      <label className="text-[14px] mb-[4px] block text-right text-[#030733]">
                        שלב 1: הדבק את הרשימה
                      </label>
                      <p className="text-[12px] mb-[6px] text-right text-[#595C7A]">
                        הדבק את כל הרשימה שלך - כל שורה היא נמען אחד
                      </p>
                      <textarea
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        placeholder={`אלירן חדרה 0506842063\nיוסי תל אביב 0501234567\nדני ירושלים 0521234567`}
                        className="w-full h-[150px] p-[12px] rounded-[10px] text-[13px] outline-none text-right resize-none bg-[#f2f3f8] text-[#030733] placeholder-[#a2a2a2]"
                      />
                    </div>

                    <button
                      onClick={() => handlePasteText(pastedText)}
                      disabled={!pastedText.trim()}
                      className="w-full h-[40px] bg-[#030733] text-white rounded-[10px] text-[14px] font-medium hover:bg-[#0a1628] transition-colors disabled:opacity-50"
                    >
                      המשך לזיהוי עמודות
                    </button>
                  </div>
                ) : (
                  /* Step 2: Name the columns */
                  <div className="flex flex-col gap-[12px]">
                    <div>
                      <label className="text-[14px] mb-[4px] block text-right text-[#030733]">
                        שלב 2: בחר את סוג כל עמודה
                      </label>
                      <p className="text-[12px] mb-[6px] text-right text-[#595C7A]">
                        זיהינו {parsedRows[0]?.length || 0} עמודות ב-{parsedRows.length} שורות. בחר את סוג כל עמודה:
                      </p>
                    </div>

                    {/* Column naming - one per column */}
                    <div className="p-[15px] rounded-[10px] flex flex-col gap-[12px] bg-[#f2f3f8]">
                      {parsedRows[0]?.map((col, idx) => (
                        <div key={idx} className="flex items-center gap-[10px]">
                          <div className="w-[120px] text-[12px] px-[10px] py-[6px] rounded-[6px] text-center truncate bg-white text-[#595C7A]">
                            {col}
                          </div>
                          <span className="text-[14px] text-[#595C7A]">=</span>
                          <select
                            value={(columnNames[idx] === 'שם' || columnNames[idx] === 'טלפון' || columnNames[idx] === '' || !columnNames[idx]) ? (columnNames[idx] || '') : 'אחר'}
                            onChange={(e) => {
                              const newNames = [...columnNames]
                              newNames[idx] = e.target.value === 'אחר' ? 'custom_' + idx : e.target.value
                              setColumnNames(newNames)
                            }}
                            className={`w-[130px] h-[36px] px-[12px] rounded-[8px] text-[13px] outline-none text-right appearance-none cursor-pointer bg-white text-[#030733] ${columnNames[idx] === 'שם' ? 'border-2 border-green-500' : columnNames[idx] === 'טלפון' ? 'border-2 border-blue-500' : ''}`}
                          >
                            <option value="">-- לא נבחר --</option>
                            <option value="שם">שם</option>
                            <option value="טלפון">טלפון</option>
                            <option value="אחר">שדה מותאם אישית</option>
                          </select>
                          {columnNames[idx] && columnNames[idx] !== 'שם' && columnNames[idx] !== 'טלפון' && (
                            <input
                              type="text"
                              value={columnNames[idx]?.startsWith('custom_') ? '' : columnNames[idx]}
                              onChange={(e) => {
                                const newNames = [...columnNames]
                                newNames[idx] = e.target.value || 'custom_' + idx
                                setColumnNames(newNames)
                              }}
                              placeholder="שם השדה"
                              className="flex-1 h-[36px] px-[12px] rounded-[8px] text-[13px] outline-none text-right bg-white text-[#030733] placeholder-[#a2a2a2]"
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    <p className="text-[12px] text-right text-yellow-600">
                      חובה: לבחור עמודת "טלפון" | מומלץ: לבחור עמודת "שם"
                    </p>

                    {/* Preview table */}
                    <div className="p-[10px] rounded-[10px] bg-[#f2f3f8]">
                      <p className="text-[12px] font-medium mb-[8px] text-right text-[#030733]">
                        תצוגה מקדימה (3 שורות ראשונות):
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr>
                              {columnNames.map((name, idx) => (
                                <th key={idx} className="px-[8px] py-[4px] text-right font-medium text-[#030733]">
                                  {name || `עמודה ${idx + 1}`}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {parsedRows.slice(0, 3).map((row, rowIdx) => (
                              <tr key={rowIdx}>
                                {row.map((cell, cellIdx) => (
                                  <td key={cellIdx} className="px-[8px] py-[4px] text-right text-[#595C7A]">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex gap-[10px]">
                      <button
                        onClick={() => {
                          setShowColumnMapping(false)
                          setParsedRows([])
                          setColumnNames([])
                        }}
                        className="w-[100px] h-[40px] rounded-[10px] text-[14px] font-medium bg-white text-[#595C7A] hover:text-[#030733]"
                      >
                        חזור
                      </button>
                      <button
                        onClick={() => handleAddParsedContacts()}
                        className="flex-1 h-[40px] bg-[#030733] text-white rounded-[10px] text-[14px] font-medium hover:bg-[#0a1628] transition-colors"
                      >
                        הוסף {parsedRows.length} נמענים
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              onClick={() => {
                setShowManualEntryPopup(false)
                setManualName('')
                setManualPhone('')
                setPastedText('')
                setParsedRows([])
                setColumnNames([])
                setShowColumnMapping(false)
                setManualCustomFields([])
                setManualEntryMode('single')
              }}
              className="mt-[15px] text-center w-full text-[14px] text-[#595C7A] hover:underline"
            >
              סגור
            </button>
          </div>
        </div>
      )}

      {/* Excel Popup */}
      {showExcelPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowExcelPopup(false)}>
          <div
            className="w-full max-w-[550px] max-h-[90vh] overflow-y-auto rounded-[15px] p-4 sm:p-[20px] bg-white"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <h3 className="text-[18px] font-semibold mb-[5px] text-right text-[#030733]">
              ייבוא מקובץ Excel
            </h3>
            <p className="text-[13px] mb-[15px] text-right text-[#595C7A]">
              {excelFileName}
            </p>

            {/* Has Headers Toggle */}
            <div className="flex items-center gap-[10px] mb-[15px]">
              <div
                onClick={() => setHasHeaders(!hasHeaders)}
                className={`w-[44px] h-[24px] rounded-full cursor-pointer transition-colors relative ${
                  hasHeaders ? 'bg-[#030733]' : 'bg-gray-300'
                }`}
              >
                <div className={`absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white transition-all ${
                  hasHeaders ? 'right-[2px]' : 'right-[22px]'
                }`} />
              </div>
              <span className="text-[14px] text-[#030733]">
                השורה הראשונה היא כותרות
              </span>
            </div>

            {/* Column mapping */}
            <div className="flex flex-col gap-[12px] mb-[15px]">
              <p className="text-[14px] font-medium text-right text-[#030733]">
                בחר את סוג כל עמודה:
              </p>

              <div className="p-[15px] rounded-[10px] flex flex-col gap-[10px] bg-[#f2f3f8]">
                {excelColumnNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-[10px]">
                    <div className="w-[120px] text-[12px] px-[10px] py-[6px] rounded-[6px] text-center truncate bg-white text-[#595C7A]">
                      {hasHeaders && excelData[0]?.[idx] ? String(excelData[0][idx]) : `עמודה ${idx + 1}`}
                    </div>
                    <span className="text-[14px] text-[#595C7A]">=</span>
                    <select
                      value={name === 'שם' || name === 'טלפון' || name === '' ? name : 'אחר'}
                      onChange={(e) => {
                        const newNames = [...excelColumnNames]
                        newNames[idx] = e.target.value === 'אחר' ? 'custom_' + idx : e.target.value
                        setExcelColumnNames(newNames)
                      }}
                      className={`w-[130px] h-[36px] px-[12px] rounded-[8px] text-[13px] outline-none text-right appearance-none cursor-pointer bg-white text-[#030733] ${name === 'שם' ? 'border-2 border-green-500' : name === 'טלפון' ? 'border-2 border-blue-500' : ''}`}
                    >
                      <option value="">-- לא נבחר --</option>
                      <option value="שם">שם</option>
                      <option value="טלפון">טלפון</option>
                      <option value="אחר">שדה מותאם אישית</option>
                    </select>
                    {name !== 'שם' && name !== 'טלפון' && name !== '' && (
                      <input
                        type="text"
                        value={name.startsWith('custom_') ? '' : name}
                        onChange={(e) => {
                          const newNames = [...excelColumnNames]
                          newNames[idx] = e.target.value || 'custom_' + idx
                          setExcelColumnNames(newNames)
                        }}
                        placeholder="שם השדה"
                        className="flex-1 h-[36px] px-[12px] rounded-[8px] text-[13px] outline-none text-right bg-white text-[#030733] placeholder-[#a2a2a2]"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[12px] mb-[10px] text-right text-yellow-600">
              חובה: לבחור עמודת "טלפון" | מומלץ: לבחור עמודת "שם"
            </p>

            {/* Preview table */}
            <div className="p-[10px] rounded-[10px] mb-[15px] bg-[#f2f3f8]">
              <p className="text-[12px] font-medium mb-[8px] text-right text-[#030733]">
                תצוגה מקדימה ({hasHeaders ? excelData.length - 1 : excelData.length} שורות):
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr>
                      {excelColumnNames.map((name, idx) => (
                        <th key={idx} className="px-[8px] py-[4px] text-right font-medium text-[#030733]">
                          {name || `עמודה ${idx + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(hasHeaders ? excelData.slice(1, 4) : excelData.slice(0, 3)).map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-[8px] py-[4px] text-right text-[#595C7A]">
                            {String(cell || '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-[10px]">
              <button
                onClick={() => {
                  setShowExcelPopup(false)
                  setExcelData([])
                  setExcelColumnNames([])
                  setExcelFileName('')
                }}
                className="w-[100px] h-[40px] rounded-[10px] text-[14px] font-medium bg-[#f2f3f8] text-[#595C7A] hover:text-[#030733]"
              >
                ביטול
              </button>
              <button
                onClick={() => handleAddExcelContacts()}
                className="flex-1 h-[40px] bg-[#030733] text-white rounded-[10px] text-[14px] font-medium hover:bg-[#0a1628] transition-colors"
              >
                הוסף {hasHeaders ? excelData.length - 1 : excelData.length} נמענים
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Popup */}
      {alertPopup.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[15px] p-6 max-w-[400px] w-full" dir="rtl">
            <p className="text-[16px] text-[#030733] mb-6 text-center whitespace-pre-line">{alertPopup.message}</p>
            <button
              onClick={() => setAlertPopup({ show: false, message: '' })}
              className="w-full h-[44px] bg-[#030733] text-white rounded-[10px] text-[14px] font-medium hover:bg-[#0a1628]"
            >
              אישור
            </button>
          </div>
        </div>
      )}

      {/* Confirm Popup */}
      {confirmPopup.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[15px] p-6 max-w-[400px] w-full" dir="rtl">
            <p className="text-[16px] text-[#030733] mb-6 text-center whitespace-pre-line">{confirmPopup.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmPopup({ show: false, message: '', confirmText: '', onConfirm: () => {} })}
                className="flex-1 h-[44px] border border-[#595C7A] text-[#030733] rounded-[10px] text-[14px] font-medium hover:bg-gray-100"
              >
                ביטול
              </button>
              <button
                onClick={() => {
                  confirmPopup.onConfirm()
                  setConfirmPopup({ show: false, message: '', confirmText: '', onConfirm: () => {} })
                }}
                className="flex-1 h-[44px] bg-[#030733] text-white rounded-[10px] text-[14px] font-medium hover:bg-[#0a1628]"
              >
                {confirmPopup.confirmText || 'אישור'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete List Confirmation */}
      <ConfirmModal
        isOpen={!!listToDelete}
        onClose={() => setListToDelete(null)}
        onConfirm={deleteList}
        title={`למחוק את הרשימה "${listToDelete?.name}"?`}
        subtitle={`פעולה זו תמחק ${listToDelete?.contact_count} נמענים ולא ניתנת לביטול`}
        confirmText="כן, מחק"
        cancelText="לא, בטל"
        variant="danger"
      />

      {/* Delete Contact Confirmation */}
      <ConfirmModal
        isOpen={!!contactToDelete}
        onClose={() => setContactToDelete(null)}
        onConfirm={deleteContact}
        title={`למחוק את ${contactToDelete?.name || contactToDelete?.phone}?`}
        subtitle="פעולה זו לא ניתנת לביטול"
        confirmText="כן, מחק"
        cancelText="לא, בטל"
        variant="danger"
      />
    </div>
  )
}
