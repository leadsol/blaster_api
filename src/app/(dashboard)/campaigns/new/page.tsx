'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { normalizePhone, formatPhoneForDisplay } from '@/lib/phone-utils'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import {
  Search,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  Smile,
  Mic,
  X,
  Paperclip,
  FileText,
  Camera,
  BarChart3,
  Image,
  User,
  Zap,
  Square,
  Upload,
  Play,
  Pause,
  Pencil,
  FolderOpen
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useNavigationGuard } from '@/contexts/NavigationGuardContext'
import * as XLSX from 'xlsx'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'

interface ContactList {
  id: string
  name: string
  contact_count: number
}

interface Recipient {
  id: string
  name: string
  phone: string
  variables?: Record<string, string>
  [key: string]: string | Record<string, string> | undefined
}

interface Connection {
  id: string
  session_name: string
  phone_number: string | null
  display_name: string | null
  status: string
  busy_in_campaign?: {
    id: string
    name: string
    status: string
  } | null
}

function NewCampaignContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { darkMode } = useTheme()
  const { setBlocking } = useNavigationGuard()
  const [loading, setLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)

  // Edit mode
  const editCampaignId = searchParams.get('edit')
  const duplicateCampaignId = searchParams.get('duplicate')
  const [isEditMode, setIsEditMode] = useState(false)
  const [editCampaignLoaded, setEditCampaignLoaded] = useState(false)
  const [duplicateLoaded, setDuplicateLoaded] = useState(false)

  // Form data
  const [name, setName] = useState('')
  const [loadMethod, setLoadMethod] = useState('')
  const [loadMethodDetails, setLoadMethodDetails] = useState('')
  const [messageTemplate, setMessageTemplate] = useState('')

  // Checkboxes
  const [hasExclusionList, setHasExclusionList] = useState(false)
  const [hasScheduling, setHasScheduling] = useState(false)
  const [hasActiveHours, setHasActiveHours] = useState(false)
  const [hasPause, setHasPause] = useState(false)
  const [createNewList, setCreateNewList] = useState(false)
  const [assignToExistingList, setAssignToExistingList] = useState(false)
  const [hasMultiDevice, setHasMultiDevice] = useState(false)
  const [selectedDevices, setSelectedDevices] = useState<string[]>([])

  // Expanded fields
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [activeHoursStart, setActiveHoursStart] = useState('09:00')
  const [activeHoursEnd, setActiveHoursEnd] = useState('18:00')
  const [pauseAfterMessages, setPauseAfterMessages] = useState(0)
  const [pauseDuration, setPauseDuration] = useState(0)
  const [pauseTimeUnit, setPauseTimeUnit] = useState<'seconds' | 'minutes' | 'hours'>('seconds')
  const [newListName, setNewListName] = useState('')
  const [selectedExistingList, setSelectedExistingList] = useState('')

  // Tabs
  const [activeTab, setActiveTab] = useState<'recipients' | 'exclusion'>('recipients')

  // Expand message box
  const [isMessageExpanded, setIsMessageExpanded] = useState(false)

  // Mobile step (1 = form & recipients, 2 = message & preview)
  const [mobileStep, setMobileStep] = useState(1)

  // Manual entry popup
  const [showManualEntryPopup, setShowManualEntryPopup] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [manualEntryMode, setManualEntryMode] = useState<'single' | 'paste'>('single')
  const [pastedText, setPastedText] = useState('')
  const [parsedRows, setParsedRows] = useState<string[][]>([])
  const [columnNames, setColumnNames] = useState<string[]>([])
  const [customFields, setCustomFields] = useState<{name: string, value: string}[]>([])
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

  // Exclusion list
  const [exclusionLoadMethod, setExclusionLoadMethod] = useState('')
  const [exclusionList, setExclusionList] = useState<{id: string, phone: string}[]>([])
  const [showExclusionPopup, setShowExclusionPopup] = useState(false)
  const [exclusionData, setExclusionData] = useState<string[][]>([])
  const [exclusionColumnNames, setExclusionColumnNames] = useState<string[]>([])
  const [exclusionHasHeaders, setExclusionHasHeaders] = useState(true)
  const [exclusionFileName, setExclusionFileName] = useState('')
  const [exclusionSheetsUrl, setExclusionSheetsUrl] = useState('')
  const [exclusionSheetsLoading, setExclusionSheetsLoading] = useState(false)
  const [showExclusionManualPopup, setShowExclusionManualPopup] = useState(false)
  const [exclusionManualPhone, setExclusionManualPhone] = useState('')
  const [exclusionSearchQuery, setExclusionSearchQuery] = useState('')
  const [selectedExclusions, setSelectedExclusions] = useState<Set<string>>(new Set())

  // Custom alert/confirm popups
  const [alertPopup, setAlertPopup] = useState<{ show: boolean; message: string }>({ show: false, message: '' })
  const [confirmPopup, setConfirmPopup] = useState<{ show: boolean; message: string; confirmText?: string; onConfirm: () => void }>({ show: false, message: '', confirmText: '', onConfirm: () => {} })

  // Leave page confirmation popup
  const [leavePagePopup, setLeavePagePopup] = useState<{ show: boolean; pendingUrl?: string }>({ show: false })

  // Tooltip state
  const [showPauseTooltip, setShowPauseTooltip] = useState(false)
  const [showActiveHoursTooltip, setShowActiveHoursTooltip] = useState(false)
  const [showTimingInfo, setShowTimingInfo] = useState(false)
  const [showSettingsTooltip, setShowSettingsTooltip] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

  // Cell tooltip state for truncated text
  const [cellTooltip, setCellTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  // Advanced settings state
  const [removalWords, setRemovalWords] = useState<string[]>([])
  const [removalWordInput, setRemovalWordInput] = useState('')
  const [skipDuplicateNumbers, setSkipDuplicateNumbers] = useState(false)
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [sendSettingsSchedule, setSendSettingsSchedule] = useState(false)
  const [sendSettingsLink, setSendSettingsLink] = useState(false)
  const [activeVariables, setActiveVariables] = useState<string[]>([])
  const [advancedSearchQuery, setAdvancedSearchQuery] = useState('')

  // Message variations state
  const [hasMessageVariations, setHasMessageVariations] = useState(false)
  const [variationCount, setVariationCount] = useState(2)
  const [messageVariations, setMessageVariations] = useState<string[]>([])
  const [currentVariationIndex, setCurrentVariationIndex] = useState(0)
  const [showVariationSavePopup, setShowVariationSavePopup] = useState(false)
  const [pendingVariationMessage, setPendingVariationMessage] = useState('')

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)

  // Attachments menu state
  const [showAttachmentsMenu, setShowAttachmentsMenu] = useState(false)
  const attachmentsMenuRef = useRef<HTMLDivElement>(null)
  const attachmentsButtonRef = useRef<HTMLButtonElement>(null)

  // Audio popup state
  const [showAudioPopup, setShowAudioPopup] = useState(false)
  const [audioPopupType, setAudioPopupType] = useState<'document' | 'image' | 'camera' | 'audio' | 'survey'>('audio')

  // Saved files popup state
  const [showSavedFilesPopup, setShowSavedFilesPopup] = useState(false)

  // Survey state
  const [surveyQuestion, setSurveyQuestion] = useState('')
  const [surveyOptions, setSurveyOptions] = useState<string[]>(['', ''])
  const [allowMultipleAnswers, setAllowMultipleAnswers] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [isConverting, setIsConverting] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioPreviewRef = useRef<HTMLAudioElement>(null)
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const ffmpegLoadedRef = useRef(false)

  // Attached media for campaign
  const [attachedMedia, setAttachedMedia] = useState<{
    type: 'document' | 'image' | 'audio' | 'poll' | null
    file: File | null
    url: string | null
    name: string
    poll?: {
      question: string
      options: string[]
      multipleAnswers: boolean
    }
  }>({ type: null, file: null, url: null, name: '' })

  // Skip delete confirmation for this campaign session
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(false)
  const [deleteConfirmPopup, setDeleteConfirmPopup] = useState<{
    show: boolean
    recipientId: string
    recipientName: string
    dontShowAgain: boolean
  }>({ show: false, recipientId: '', recipientName: '', dontShowAgain: false })

  // Storage management
  interface StoredFile {
    name: string
    path: string
    size: number
    createdAt: string
    type: 'audio' | 'image' | 'document'
  }
  const [storageFullPopup, setStorageFullPopup] = useState<{
    show: boolean
    currentUsageMB: number
    maxStorageMB: number
    fileSizeMB: number
  }>({ show: false, currentUsageMB: 0, maxStorageMB: 512, fileSizeMB: 0 })
  const [storageManagePopup, setStorageManagePopup] = useState(false)
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set())
  const [selectedFilesToDelete, setSelectedFilesToDelete] = useState<Set<string>>(new Set())

  // Data
  const [contactLists, setContactLists] = useState<ContactList[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [deviceDailyLimits, setDeviceDailyLimits] = useState<Record<string, { sent: number, limit: number }>>({})
  const [selectedConnection, setSelectedConnection] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [allColumns, setAllColumns] = useState<string[]>([]) // All columns loaded from file (including שם, טלפון)
  const [removedColumns, setRemovedColumns] = useState<string[]>([]) // Track removed columns that can be restored
  const [removedColumnData, setRemovedColumnData] = useState<Record<string, Record<string, string>>>({}) // Store removed column data for restore: { columnName: { recipientId: value } }
  const [sortColumn, setSortColumn] = useState<string | null>(null) // Current sort column
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc') // Sort direction
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set())

  // Delay settings (10-60 seconds between messages for safe delivery)
  const [delayMin, setDelayMin] = useState(10)
  const [delayMax, setDelayMax] = useState(60)

  // Track if form has been modified (for unsaved changes warning)
  const [formModified, setFormModified] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // SessionStorage key for draft data (clears when tab closes, persists on refresh)
  const DRAFT_STORAGE_KEY = 'campaign_draft_data'
  const PAGE_MARKER_KEY = 'campaign_page_active'

  // Function to check if form has meaningful data
  const hasFormData = (): boolean => {
    return (
      name.trim() !== '' ||
      messageTemplate.trim() !== '' ||
      recipients.length > 0 ||
      exclusionList.length > 0 ||
      attachedMedia.type !== null ||
      Boolean(surveyQuestion && surveyQuestion.trim() !== '')
    )
  }

  // Save form data to localStorage
  // Optional parameter to pass updated recipients (for immediate save after deletion)
  const saveDraftToStorage = (updatedRecipients?: Recipient[]) => {
    if (editCampaignId || duplicateCampaignId) return // Don't save drafts when editing existing campaigns

    const draftData = {
      name,
      messageTemplate,
      recipients: updatedRecipients ?? recipients,
      exclusionList,
      allColumns,
      hasExclusionList,
      hasScheduling,
      hasActiveHours,
      hasPause,
      createNewList,
      assignToExistingList,
      hasMultiDevice,
      selectedDevices,
      scheduleDate,
      scheduleTime,
      activeHoursStart,
      activeHoursEnd,
      pauseAfterMessages,
      pauseDuration,
      pauseTimeUnit,
      newListName,
      selectedExistingList,
      selectedConnection,
      delayMin,
      delayMax,
      hasMessageVariations,
      variationCount,
      messageVariations,
      surveyQuestion,
      surveyOptions,
      allowMultipleAnswers,
      attachedMedia: attachedMedia.type === 'poll' ? attachedMedia : {
        type: attachedMedia.type,
        url: attachedMedia.url,
        name: attachedMedia.name,
        file: null // Can't serialize File object
      },
      savedAt: new Date().toISOString()
    }

    try {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData))
    } catch (e) {
      console.error('Failed to save draft to sessionStorage:', e)
    }
  }

  // Load draft from sessionStorage (only on page refresh, not navigation)
  const loadDraftFromStorage = () => {
    if (editCampaignId || duplicateCampaignId) return false // Don't load drafts when editing

    try {
      // Check if we're coming from a refresh (marker was set before beforeunload cleared it)
      // If marker is not present, it means we navigated away and came back - clear old data
      const wasOnPage = sessionStorage.getItem(PAGE_MARKER_KEY) === 'true'

      const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY)
      if (!saved) return false

      // If we weren't on this page before (navigated from elsewhere), clear the draft
      if (!wasOnPage) {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY)
        return false
      }

      const draftData = JSON.parse(saved)

      // Check if draft is older than 24 hours
      const savedAt = new Date(draftData.savedAt)
      const hoursSinceSave = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60)
      if (hoursSinceSave > 24) {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY)
        return false
      }

      // Restore form data
      if (draftData.name) setName(draftData.name)
      if (draftData.messageTemplate) setMessageTemplate(draftData.messageTemplate)
      if (draftData.recipients) setRecipients(draftData.recipients)
      if (draftData.exclusionList) setExclusionList(draftData.exclusionList)
      if (draftData.allColumns) setAllColumns(draftData.allColumns)
      if (draftData.hasExclusionList !== undefined) setHasExclusionList(draftData.hasExclusionList)
      if (draftData.hasScheduling !== undefined) setHasScheduling(draftData.hasScheduling)
      if (draftData.hasActiveHours !== undefined) setHasActiveHours(draftData.hasActiveHours)
      if (draftData.hasPause !== undefined) setHasPause(draftData.hasPause)
      if (draftData.createNewList !== undefined) setCreateNewList(draftData.createNewList)
      if (draftData.assignToExistingList !== undefined) setAssignToExistingList(draftData.assignToExistingList)
      if (draftData.hasMultiDevice !== undefined) setHasMultiDevice(draftData.hasMultiDevice)
      if (draftData.selectedDevices) setSelectedDevices(draftData.selectedDevices)
      if (draftData.scheduleDate) setScheduleDate(draftData.scheduleDate)
      if (draftData.scheduleTime) setScheduleTime(draftData.scheduleTime)
      if (draftData.activeHoursStart) setActiveHoursStart(draftData.activeHoursStart)
      if (draftData.activeHoursEnd) setActiveHoursEnd(draftData.activeHoursEnd)
      if (draftData.pauseAfterMessages) setPauseAfterMessages(draftData.pauseAfterMessages)
      if (draftData.pauseDuration) setPauseDuration(draftData.pauseDuration)
      if (draftData.pauseTimeUnit) setPauseTimeUnit(draftData.pauseTimeUnit)
      if (draftData.newListName) setNewListName(draftData.newListName)
      if (draftData.selectedExistingList) setSelectedExistingList(draftData.selectedExistingList)
      if (draftData.selectedConnection) setSelectedConnection(draftData.selectedConnection)
      if (draftData.delayMin) setDelayMin(draftData.delayMin)
      if (draftData.delayMax) setDelayMax(draftData.delayMax)
      if (draftData.hasMessageVariations !== undefined) setHasMessageVariations(draftData.hasMessageVariations)
      if (draftData.variationCount) setVariationCount(draftData.variationCount)
      if (draftData.messageVariations) setMessageVariations(draftData.messageVariations)
      if (draftData.surveyQuestion) setSurveyQuestion(draftData.surveyQuestion)
      if (draftData.surveyOptions) setSurveyOptions(draftData.surveyOptions)
      if (draftData.allowMultipleAnswers !== undefined) setAllowMultipleAnswers(draftData.allowMultipleAnswers)
      if (draftData.attachedMedia) setAttachedMedia(draftData.attachedMedia)

      return true
    } catch (e) {
      console.error('Failed to load draft from sessionStorage:', e)
      return false
    }
  }

  // Clear draft from localStorage
  const clearDraftFromStorage = () => {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch (e) {
      console.error('Failed to clear draft from sessionStorage:', e)
    }
  }

  // Save draft whenever form data changes
  useEffect(() => {
    if (isInitialLoad) return // Don't save during initial load

    const timeoutId = setTimeout(() => {
      if (hasFormData()) {
        saveDraftToStorage()
        setFormModified(true)
      }
    }, 500) // Debounce saves

    return () => clearTimeout(timeoutId)
  }, [
    name, messageTemplate, recipients, exclusionList, allColumns,
    hasExclusionList, hasScheduling, hasActiveHours, hasPause, createNewList,
    assignToExistingList, hasMultiDevice, selectedDevices,
    scheduleDate, scheduleTime, activeHoursStart, activeHoursEnd, pauseAfterMessages, pauseDuration,
    pauseTimeUnit, newListName, selectedExistingList, selectedConnection,
    delayMin, delayMax, hasMessageVariations, variationCount, messageVariations,
    surveyQuestion, surveyOptions, allowMultipleAnswers, attachedMedia
  ])

  // Update navigation guard blocking state when form data changes
  useEffect(() => {
    const shouldBlock = formModified && hasFormData()
    setBlocking(shouldBlock, () => {
      // This callback is called when user confirms navigation
      clearDraftFromStorage()
      sessionStorage.removeItem(PAGE_MARKER_KEY)
    })
    // Cleanup - unblock when component unmounts
    return () => {
      setBlocking(false)
    }
  }, [formModified, name, messageTemplate, recipients.length, setBlocking])

  // Clear data when leaving page (browser navigation/close)
  // Set page marker when page mounts to detect refresh vs navigation
  useEffect(() => {
    // Set marker that we're on this page
    sessionStorage.setItem(PAGE_MARKER_KEY, 'true')

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Show browser warning if form has data
      if (formModified && hasFormData()) {
        e.preventDefault()
        e.returnValue = '' // Chrome requires returnValue to be set
        return ''
      }
      // Clear the page marker when leaving
      // If user is refreshing, the page will set the marker again when it loads
      sessionStorage.removeItem(PAGE_MARKER_KEY)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // Also clear when component unmounts (internal navigation)
      sessionStorage.removeItem(PAGE_MARKER_KEY)
    }
  }, [formModified])

  // Handle navigation away from page (internal links)
  const handleNavigateAway = (url: string) => {
    if (formModified && hasFormData()) {
      setLeavePagePopup({ show: true, pendingUrl: url })
    } else {
      // Clear sessionStorage when navigating away without draft
      clearDraftFromStorage()
      router.push(url)
    }
  }

  // Confirm leaving the page
  const confirmLeavePage = () => {
    clearDraftFromStorage()
    setFormModified(false)
    if (leavePagePopup.pendingUrl) {
      router.push(leavePagePopup.pendingUrl)
    }
    setLeavePagePopup({ show: false })
  }

  // Cancel leaving - stay on page
  const cancelLeavePage = () => {
    setLeavePagePopup({ show: false })
  }

  useEffect(() => {
    loadData()

    // Load draft from localStorage on initial load (if not editing)
    if (!editCampaignId && !duplicateCampaignId) {
      const hasDraft = loadDraftFromStorage()
      if (hasDraft) {
        console.log('Loaded campaign draft from sessionStorage')
      }
    }

    // Mark initial load as complete after a short delay
    setTimeout(() => {
      setIsInitialLoad(false)
    }, 1000)

    // Subscribe to connection changes for real-time sync
    const supabase = createClient()
    const channel = supabase
      .channel('connections-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connections' },
        () => {
          // Reload connections when any change occurs
          loadData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Reset edit state when campaign ID changes
  useEffect(() => {
    if (editCampaignId) {
      setEditCampaignLoaded(false)
      setIsEditMode(false)
    }
  }, [editCampaignId])

  // Load existing campaign for editing
  useEffect(() => {
    if (editCampaignId && !editCampaignLoaded) {
      loadCampaignForEdit(editCampaignId)
    }
  }, [editCampaignId, editCampaignLoaded])

  const loadCampaignForEdit = async (campaignId: string) => {
    const supabase = createClient()

    // Clear existing data first
    setRecipients([])
    setAllColumns([])
    setExclusionList([])

    // Load campaign data
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      console.error('Error loading campaign:', campaignError)
      setAlertPopup({ show: true, message: 'שגיאה בטעינת הקמפיין' })
      return
    }

    // Load campaign messages (recipients)
    const { data: messages, error: messagesError } = await supabase
      .from('campaign_messages')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error loading campaign messages:', messagesError)
    }

    // Set campaign data to form
    setName(campaign.name)
    setMessageTemplate(campaign.message_template)
    setSelectedConnection(campaign.connection_id)

    // Scheduling
    if (campaign.scheduled_at) {
      setHasScheduling(true)
      const scheduledDate = new Date(campaign.scheduled_at)
      setScheduleDate(scheduledDate.toISOString().split('T')[0])
      setScheduleTime(scheduledDate.toTimeString().slice(0, 5))
    }

    // Pause settings
    if (campaign.pause_after_messages && campaign.pause_seconds) {
      setHasPause(true)
      setPauseAfterMessages(campaign.pause_after_messages)
      // Convert seconds to appropriate unit
      if (campaign.pause_seconds >= 3600 && campaign.pause_seconds % 3600 === 0) {
        setPauseDuration(campaign.pause_seconds / 3600)
        setPauseTimeUnit('hours')
      } else if (campaign.pause_seconds >= 60 && campaign.pause_seconds % 60 === 0) {
        setPauseDuration(campaign.pause_seconds / 60)
        setPauseTimeUnit('minutes')
      } else {
        setPauseDuration(campaign.pause_seconds)
        setPauseTimeUnit('seconds')
      }
    }

    // Active hours settings
    if (campaign.respect_active_hours !== undefined) {
      setHasActiveHours(campaign.respect_active_hours)
    }
    if (campaign.active_hours_start) {
      setActiveHoursStart(campaign.active_hours_start.slice(0, 5)) // Extract HH:MM from TIME
    }
    if (campaign.active_hours_end) {
      setActiveHoursEnd(campaign.active_hours_end.slice(0, 5)) // Extract HH:MM from TIME
    }

    // List settings
    if (campaign.new_list_name) {
      setCreateNewList(true)
      setNewListName(campaign.new_list_name)
    }
    if (campaign.existing_list_id) {
      setAssignToExistingList(true)
      setSelectedExistingList(campaign.existing_list_id)
    }

    // Multi-device
    if (campaign.multi_device && campaign.device_ids && campaign.device_ids.length > 0) {
      setHasMultiDevice(true)
      setSelectedDevices(campaign.device_ids)
    }

    // Message variations
    if (campaign.message_variations && campaign.message_variations.length > 0) {
      setHasMessageVariations(true)
      setMessageVariations(campaign.message_variations)
      setVariationCount(campaign.message_variations.length)
    }

    // Delay settings
    if (campaign.delay_min) setDelayMin(campaign.delay_min)
    if (campaign.delay_max) setDelayMax(campaign.delay_max)

    // Poll/Survey
    if (campaign.poll_question && campaign.poll_options) {
      setSurveyQuestion(campaign.poll_question)
      setSurveyOptions(campaign.poll_options)
      setAllowMultipleAnswers(campaign.poll_multiple_answers || false)
      setAttachedMedia({
        type: 'poll',
        file: null,
        url: null,
        name: 'סקר'
      })
    }

    // Media
    if (campaign.media_url && campaign.media_type) {
      setAttachedMedia({
        type: campaign.media_type as 'document' | 'image' | 'audio',
        file: null,
        url: campaign.media_url,
        name: campaign.media_url.split('/').pop() || 'קובץ מצורף'
      })
    }

    // Load recipients from messages
    if (messages && messages.length > 0) {
      const loadedRecipients: Recipient[] = messages.map((msg, index) => ({
        id: msg.id || `recipient-${index}`,
        name: msg.name || '',
        phone: msg.phone,
        variables: msg.variables || {}
      }))
      setRecipients(loadedRecipients)

      // Extract variable columns from recipients
      const variableKeys = new Set<string>()
      messages.forEach(msg => {
        if (msg.variables) {
          Object.keys(msg.variables).forEach(key => variableKeys.add(key))
        }
      })
      if (variableKeys.size > 0) {
        setAllColumns(Array.from(variableKeys))
      }
    }

    setIsEditMode(true)
    setEditCampaignLoaded(true)
  }

  // Load campaign for duplication
  useEffect(() => {
    if (duplicateCampaignId && !duplicateLoaded) {
      loadCampaignForDuplicate(duplicateCampaignId)
    }
  }, [duplicateCampaignId, duplicateLoaded])

  const loadCampaignForDuplicate = async (campaignId: string) => {
    const supabase = createClient()

    // Clear existing data first
    setRecipients([])
    setAllColumns([])
    setExclusionList([])

    // Load campaign data
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      console.error('Error loading campaign for duplication:', campaignError)
      setAlertPopup({ show: true, message: 'שגיאה בטעינת הקמפיין לשכפול' })
      return
    }

    // Load campaign messages (recipients)
    const { data: messages, error: messagesError } = await supabase
      .from('campaign_messages')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error loading campaign messages:', messagesError)
    }

    // Set campaign data to form (with modified name)
    setName(`${campaign.name} (העתק)`)
    setMessageTemplate(campaign.message_template)
    setSelectedConnection(campaign.connection_id)

    // Scheduling - don't copy, let user set new schedule
    setHasScheduling(false)
    setScheduleDate('')
    setScheduleTime('')

    // Pause settings
    if (campaign.pause_after_messages && campaign.pause_seconds) {
      setHasPause(true)
      setPauseAfterMessages(campaign.pause_after_messages)
      if (campaign.pause_seconds >= 3600 && campaign.pause_seconds % 3600 === 0) {
        setPauseDuration(campaign.pause_seconds / 3600)
        setPauseTimeUnit('hours')
      } else if (campaign.pause_seconds >= 60 && campaign.pause_seconds % 60 === 0) {
        setPauseDuration(campaign.pause_seconds / 60)
        setPauseTimeUnit('minutes')
      } else {
        setPauseDuration(campaign.pause_seconds)
        setPauseTimeUnit('seconds')
      }
    }

    // Active hours settings
    if (campaign.respect_active_hours !== undefined) {
      setHasActiveHours(campaign.respect_active_hours)
    }
    if (campaign.active_hours_start) {
      setActiveHoursStart(campaign.active_hours_start.slice(0, 5)) // Extract HH:MM from TIME
    }
    if (campaign.active_hours_end) {
      setActiveHoursEnd(campaign.active_hours_end.slice(0, 5)) // Extract HH:MM from TIME
    }

    // List settings - don't copy list assignment
    setCreateNewList(false)
    setNewListName('')
    setAssignToExistingList(false)
    setSelectedExistingList('')

    // Multi-device
    if (campaign.multi_device && campaign.device_ids && campaign.device_ids.length > 0) {
      setHasMultiDevice(true)
      setSelectedDevices(campaign.device_ids)
    }

    // Message variations
    if (campaign.message_variations && campaign.message_variations.length > 0) {
      setHasMessageVariations(true)
      setMessageVariations(campaign.message_variations)
      setVariationCount(campaign.message_variations.length)
    }

    // Delay settings
    if (campaign.delay_min) setDelayMin(campaign.delay_min)
    if (campaign.delay_max) setDelayMax(campaign.delay_max)

    // Poll/Survey
    if (campaign.poll_question && campaign.poll_options) {
      setSurveyQuestion(campaign.poll_question)
      setSurveyOptions(campaign.poll_options)
      setAllowMultipleAnswers(campaign.poll_multiple_answers || false)
      setAttachedMedia({
        type: 'poll',
        file: null,
        url: null,
        name: 'סקר'
      })
    }

    // Media
    if (campaign.media_url && campaign.media_type) {
      setAttachedMedia({
        type: campaign.media_type as 'document' | 'image' | 'audio',
        file: null,
        url: campaign.media_url,
        name: campaign.media_url.split('/').pop() || 'קובץ מצורף'
      })
    }

    // Load recipients from messages
    if (messages && messages.length > 0) {
      const loadedRecipients: Recipient[] = messages.map((msg, index) => ({
        id: `recipient-${index}`,
        name: msg.name || '',
        phone: msg.phone,
        variables: msg.variables || {}
      }))
      setRecipients(loadedRecipients)

      // Extract variable columns from recipients
      const variableKeys = new Set<string>()
      messages.forEach(msg => {
        if (msg.variables) {
          Object.keys(msg.variables).forEach(key => variableKeys.add(key))
        }
      })
      if (variableKeys.size > 0) {
        setAllColumns(Array.from(variableKeys))
      }
    }

    // NOT edit mode - this is a new campaign
    setIsEditMode(false)
    setDuplicateLoaded(true)
  }

  // Close emoji picker and attachments menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close emoji picker
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false)
      }
      // Close attachments menu
      if (
        showAttachmentsMenu &&
        attachmentsMenuRef.current &&
        !attachmentsMenuRef.current.contains(event.target as Node) &&
        attachmentsButtonRef.current &&
        !attachmentsButtonRef.current.contains(event.target as Node)
      ) {
        setShowAttachmentsMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmojiPicker, showAttachmentsMenu])

  const loadData = async () => {
    const supabase = createClient()

    // Load contact lists
    const { data: listsData } = await supabase.from('contact_lists').select('*')
    if (listsData) setContactLists(listsData)

    // Load all connections (show all, let user choose)
    const { data: connectionsData, error: connError } = await supabase
      .from('connections')
      .select('*')

    console.log('Connections loaded:', connectionsData, 'Error:', connError)

    if (connectionsData && connectionsData.length > 0) {
      // Check which devices are busy in running campaigns
      const connectionsWithBusyStatus = await Promise.all(
        connectionsData.map(async (conn) => {
          // Find if this device is used in any running campaign
          const { data: runningCampaigns } = await supabase
            .from('campaigns')
            .select('id, name, status')
            .eq('status', 'running')
            .or(`connection_id.eq.${conn.id},device_ids.cs.{${conn.id}}`)
            .limit(1)
            .single()

          return {
            ...conn,
            busy_in_campaign: runningCampaigns || null
          }
        })
      )

      setConnections(connectionsWithBusyStatus)
      // Auto-select first connection if available and not busy
      if (!selectedConnection) {
        const availableConn = connectionsWithBusyStatus.find(c => !c.busy_in_campaign)
        if (availableConn) {
          setSelectedConnection(availableConn.id)
        }
      }

      // Calculate daily limits for each device
      await calculateDeviceDailyLimits(connectionsWithBusyStatus)
    } else {
      console.log('No connections found or empty array')
    }
  }

  // Calculate how many messages each device can still send today
  const calculateDeviceDailyLimits = async (devicesData: Connection[]) => {
    const supabase = createClient()
    const BASE_LIMIT = 90
    const VARIATION_BONUS = 10
    const limits: Record<string, { sent: number, limit: number }> = {}

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    for (const device of devicesData) {
      if (!device.phone_number) {
        limits[device.id] = { sent: 0, limit: BASE_LIMIT }
        continue
      }

      // Get all campaigns using this device (including running, paused, scheduled)
      const { data: deviceCampaigns } = await supabase
        .from('campaigns')
        .select('message_variations, status')
        .or(`connection_id.eq.${device.id},device_ids.cs.{${device.id}}`)
        .in('status', ['running', 'paused', 'scheduled', 'draft']) // Active campaigns

      // Find highest variation bonus for this device across all its active campaigns
      let maxVariationBonus = 0
      if (deviceCampaigns) {
        deviceCampaigns.forEach(camp => {
          const variations: string[] = camp.message_variations || []
          const variationCount = variations.length > 1 ? variations.length : 0
          const bonus = variationCount > 1 ? (variationCount - 1) * VARIATION_BONUS : 0
          maxVariationBonus = Math.max(maxVariationBonus, bonus)
        })
      }

      const deviceLimit = BASE_LIMIT + maxVariationBonus
      console.log(`[DEVICE-LIMIT] ${device.display_name || device.session_name}: Base=${BASE_LIMIT}, Bonus=${maxVariationBonus}, Total=${deviceLimit}`)

      // Count messages sent today from this device
      const { data: campaignsUsingDevice } = await supabase
        .from('campaigns')
        .select('id')
        .or(`connection_id.eq.${device.id},device_ids.cs.{${device.id}}`)

      const campaignIds = campaignsUsingDevice?.map(c => c.id) || []

      if (campaignIds.length === 0) {
        limits[device.id] = { sent: 0, limit: deviceLimit }
        continue
      }

      // Count sent messages today from this device
      const { count: sentToday } = await supabase
        .from('campaign_messages')
        .select('id', { count: 'exact', head: true })
        .in('campaign_id', campaignIds)
        .eq('status', 'sent')
        .eq('sender_phone', device.phone_number)
        .gte('sent_at', todayStart.toISOString())

      limits[device.id] = {
        sent: sentToday || 0,
        limit: deviceLimit
      }
    }

    setDeviceDailyLimits(limits)
  }

  // Note: Phone normalization now handled by normalizePhone() utility function

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      setAlertPopup({ show: true, message: 'יש להזין שם לקמפיין' })
      return
    }

    if (!selectedConnection) {
      setAlertPopup({ show: true, message: 'יש לבחור חיבור WhatsApp פעיל' })
      return
    }

    // Check if any selected devices are busy in running campaigns
    const devicesToCheck = hasMultiDevice ? selectedDevices : [selectedConnection]
    const supabase = createClient()

    for (const deviceId of devicesToCheck) {
      const { data: runningCampaign } = await supabase
        .from('campaigns')
        .select('id, name, status')
        .eq('status', 'running')
        .or(`connection_id.eq.${deviceId},device_ids.cs.{${deviceId}}`)
        .limit(1)
        .single()

      if (runningCampaign) {
        const device = connections.find(c => c.id === deviceId)
        const deviceName = device?.display_name || device?.session_name || 'לא ידוע'
        setAlertPopup({
          show: true,
          message: `המכשיר "${deviceName}" עסוק בקמפיין "${runningCampaign.name}". אנא בחר מכשיר אחר.`
        })
        return
      }
    }

    // Validation for message content - check variations if enabled
    if (hasMessageVariations) {
      if (messageVariations.length === 0) {
        setAlertPopup({ show: true, message: 'יש להזין לפחות וריאציה אחת של הודעה' })
        return
      }
      // Check if at least one variation has content
      const hasValidVariation = messageVariations.some(v => v && v.trim())
      if (!hasValidVariation) {
        setAlertPopup({ show: true, message: 'יש להזין תוכן לפחות לוריאציה אחת' })
        return
      }
    } else if (!messageTemplate.trim() && !attachedMedia.type) {
      setAlertPopup({ show: true, message: 'יש להזין תוכן הודעה או לצרף קובץ' })
      return
    }

    if (recipients.length === 0) {
      setAlertPopup({ show: true, message: 'יש להוסיף לפחות נמען אחד' })
      return
    }

    // Build scheduled_at if scheduling is enabled
    let scheduled_at: string | null = null
    if (hasScheduling && scheduleDate && scheduleTime) {
      scheduled_at = new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
    } else if (hasScheduling && (!scheduleDate || !scheduleTime)) {
      setAlertPopup({ show: true, message: 'יש לבחור תאריך ושעה לתזמון' })
      return
    }

    setLoading(true)

    // Calculate pause duration in seconds based on selected time unit
    let pauseSeconds = 0
    if (hasPause && pauseDuration > 0) {
      switch (pauseTimeUnit) {
        case 'seconds':
          pauseSeconds = pauseDuration
          break
        case 'minutes':
          pauseSeconds = pauseDuration * 60
          break
        case 'hours':
          pauseSeconds = pauseDuration * 3600
          break
      }
    }

    try {
      // If variations are enabled, use the first variation as message_template for backward compatibility
      // and include all variations in the message_variations array
      const effectiveMessageTemplate = hasMessageVariations && messageVariations.length > 0
        ? messageVariations[0]
        : messageTemplate

      // Upload media file to Supabase Storage if present
      let mediaUrl: string | null = null
      let mediaType: string | null = null

      // Storage limits (Supabase free tier limit is 50MB per file)
      const MAX_FILE_SIZE_MB = 48
      const MAX_USER_STORAGE_MB = 512

      if (attachedMedia.type && attachedMedia.type !== 'poll' && attachedMedia.file) {
        const supabase = createClient()

        // Check file size (128MB limit)
        const fileSizeMB = attachedMedia.file.size / (1024 * 1024)
        if (fileSizeMB > MAX_FILE_SIZE_MB) {
          setAlertPopup({ show: true, message: `הקובץ גדול מדי. הגבלה: ${MAX_FILE_SIZE_MB}MB (גודל הקובץ: ${fileSizeMB.toFixed(1)}MB)` })
          setLoading(false)
          return
        }

        // Get current user for folder organization
        const { data: { user } } = await supabase.auth.getUser()
        const userId = user?.id || 'anonymous'

        // Check user's total storage usage (512MB limit)
        const { data: userFiles, error: listError } = await supabase.storage
          .from('leadsol_storage')
          .list(`campaigns`, {
            search: userId
          })

        if (!listError && userFiles) {
          // Calculate total storage by listing all user's files recursively
          let totalStorageBytes = 0
          const getAllFiles = async (path: string): Promise<number> => {
            const { data: files } = await supabase.storage.from('leadsol_storage').list(path)
            let size = 0
            if (files) {
              for (const file of files) {
                if (file.id) {
                  // It's a file
                  size += file.metadata?.size || 0
                } else {
                  // It's a folder, recurse
                  size += await getAllFiles(`${path}/${file.name}`)
                }
              }
            }
            return size
          }

          // Get all files for this user - path: campaigns/USER_ID/MEDIA_TYPE/filename
          const { data: typeFolders } = await supabase.storage.from('leadsol_storage').list(`campaigns/${userId}`)
          if (typeFolders) {
            for (const typeFolder of typeFolders) {
              const { data: files } = await supabase.storage.from('leadsol_storage').list(`campaigns/${userId}/${typeFolder.name}`)
              if (files) {
                for (const file of files) {
                  totalStorageBytes += file.metadata?.size || 0
                }
              }
            }
          }

          const totalStorageMB = totalStorageBytes / (1024 * 1024)
          const newTotalMB = totalStorageMB + fileSizeMB

          if (newTotalMB > MAX_USER_STORAGE_MB) {
            setStorageFullPopup({
              show: true,
              currentUsageMB: totalStorageMB,
              maxStorageMB: MAX_USER_STORAGE_MB,
              fileSizeMB: fileSizeMB
            })
            setLoading(false)
            return
          }
        }

        // Organize by: user_id/media_type/filename
        const mediaTypeFolder = attachedMedia.type // 'audio', 'image', 'document'

        const safeFileName = attachedMedia.file.name
          .replace(/[^a-zA-Z0-9._\u0590-\u05FF-]/g, '_') // Allow Hebrew chars
          .substring(0, 50) // Limit filename length
        const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`
        const fileName = `${uniqueId}_${safeFileName}`

        // Path structure: campaigns/user-id/audio/filename.ogg
        const filePath = `campaigns/${userId}/${mediaTypeFolder}/${fileName}`

        // Set content type explicitly - especially important for audio/voice messages
        const contentType = attachedMedia.type === 'audio'
          ? 'audio/ogg; codecs=opus' // Required for WhatsApp voice messages (PTT)
          : attachedMedia.file.type || 'application/octet-stream'

        const { error: uploadError } = await supabase.storage
          .from('leadsol_storage')
          .upload(filePath, attachedMedia.file, {
            contentType,
            upsert: false
          })

        if (uploadError) {
          console.error('Error uploading media:', uploadError)
          setAlertPopup({ show: true, message: 'שגיאה בהעלאת הקובץ' })
          setLoading(false)
          return
        }

        // Get signed URL (valid for 7 days) since bucket is not public
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('leadsol_storage')
          .createSignedUrl(filePath, 60 * 60 * 24 * 7) // 7 days

        if (signedUrlError || !signedUrlData?.signedUrl) {
          console.error('Error getting signed URL:', signedUrlError)
          setAlertPopup({ show: true, message: 'שגיאה ביצירת קישור לקובץ' })
          setLoading(false)
          return
        }

        mediaUrl = signedUrlData.signedUrl
        mediaType = attachedMedia.type
      }

      const campaignData = {
        name,
        connection_id: selectedConnection,
        message_template: effectiveMessageTemplate,
        scheduled_at,
        delay_min: delayMin,
        delay_max: delayMax,
        pause_after_messages: hasPause ? pauseAfterMessages : null,
        pause_seconds: hasPause ? pauseSeconds : null,
        respect_active_hours: hasActiveHours,
        active_hours_start: hasActiveHours ? activeHoursStart : null,
        active_hours_end: hasActiveHours ? activeHoursEnd : null,
        new_list_name: createNewList ? newListName : null,
        existing_list_id: assignToExistingList ? selectedExistingList : null,
        multi_device: hasMultiDevice,
        device_ids: hasMultiDevice ? selectedDevices : [selectedConnection],
        recipients: recipients.map(r => ({
          phone: normalizePhone(r.phone),
          name: r.name,
          variables: r.variables || {}
        })),
        exclusion_list: exclusionList.map(e => normalizePhone(e.phone)),
        // Message variations
        has_message_variations: hasMessageVariations,
        message_variations: hasMessageVariations ? messageVariations : [],
        variation_count: hasMessageVariations ? variationCount : 0,
        daily_message_bonus: hasMessageVariations && messageVariations.length > 1
          ? (messageVariations.length - 1) * 10
          : 0,
        // Media data
        media_url: mediaUrl,
        media_type: mediaType,
        // Poll data
        poll_question: attachedMedia.type === 'poll' && attachedMedia.poll ? attachedMedia.poll.question : null,
        poll_options: attachedMedia.type === 'poll' && attachedMedia.poll ? attachedMedia.poll.options : null,
        poll_multiple_answers: attachedMedia.type === 'poll' && attachedMedia.poll ? attachedMedia.poll.multipleAnswers : false
      }

      let response: Response
      if (isEditMode && editCampaignId) {
        // Update existing campaign
        response = await fetch(`/api/campaigns/${editCampaignId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(campaignData)
        })
      } else {
        // Create new campaign
        response = await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(campaignData)
        })
      }

      const data = await response.json()

      if (!response.ok) {
        // If device is busy but can save as draft, offer that option
        if (response.status === 409 && data.canSaveAsDraft) {
          setLoading(false)
          setConfirmPopup({
            show: true,
            message: data.error + '\n\nהאם לשמור כטיוטה?',
            confirmText: 'שמור כטיוטה',
            onConfirm: () => {
              setConfirmPopup({ show: false, message: '', onConfirm: () => {} })
              handleSaveDraft()
            }
          })
          return
        }
        setAlertPopup({ show: true, message: data.error || (isEditMode ? 'שגיאה בעדכון הקמפיין' : 'שגיאה ביצירת הקמפיין') })
        setLoading(false)
        return
      }

      // Success - clear draft and redirect to campaign summary
      clearDraftFromStorage()
      setFormModified(false) // Prevent beforeunload warning
      const campaignId = isEditMode ? editCampaignId : data.campaign.id
      router.push(`/campaigns/${campaignId}/summary`)

    } catch (error) {
      console.error('Error saving campaign:', error)
      setAlertPopup({ show: true, message: isEditMode ? 'שגיאה בעדכון הקמפיין' : 'שגיאה ביצירת הקמפיין' })
      setLoading(false)
    }
  }

  // Handle save as draft - minimal validation, saves to DB with draft status
  const handleSaveDraft = async () => {
    // Only require campaign name for draft
    if (!name.trim()) {
      setAlertPopup({ show: true, message: 'יש להזין שם לקמפיין כדי לשמור כטיוטה' })
      return
    }

    // Validate recipients
    if (!recipients || recipients.length === 0) {
      setAlertPopup({ show: true, message: 'לא ניתן לשמור טיוטה ללא נמענים. נא להוסיף לפחות נמען אחד.' })
      return
    }

    // Validate that all recipients have phone numbers
    const recipientsWithoutPhone = recipients.filter(r => !r.phone || r.phone.trim() === '')
    if (recipientsWithoutPhone.length > 0) {
      setAlertPopup({
        show: true,
        message: `יש ${recipientsWithoutPhone.length} נמענים ללא מספר טלפון. נא למלא את כל המספרים או למחוק את הנמענים הריקים.`
      })
      return
    }

    setSavingDraft(true)

    try {
      // Calculate pause duration in seconds based on selected time unit
      let pauseSeconds = 0
      if (hasPause && pauseDuration > 0) {
        switch (pauseTimeUnit) {
          case 'seconds':
            pauseSeconds = pauseDuration
            break
          case 'minutes':
            pauseSeconds = pauseDuration * 60
            break
          case 'hours':
            pauseSeconds = pauseDuration * 3600
            break
        }
      }

      // Build scheduled_at if scheduling is enabled
      let scheduled_at: string | null = null
      if (hasScheduling && scheduleDate && scheduleTime) {
        scheduled_at = new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
      }

      // Use variations if enabled
      const effectiveMessageTemplate = hasMessageVariations && messageVariations.length > 0
        ? messageVariations[0]
        : messageTemplate

      // Upload media if present
      let mediaUrl: string | null = null
      let mediaType: string | null = null

      if (attachedMedia.type && attachedMedia.type !== 'poll' && attachedMedia.file) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const userId = user?.id || 'anonymous'

        const mediaTypeFolder = attachedMedia.type
        const safeFileName = attachedMedia.file.name
          .replace(/[^a-zA-Z0-9._\u0590-\u05FF-]/g, '_')
          .substring(0, 50)
        const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`
        const fileName = `${uniqueId}_${safeFileName}`
        const filePath = `campaigns/${userId}/${mediaTypeFolder}/${fileName}`

        const contentType = attachedMedia.type === 'audio'
          ? 'audio/ogg; codecs=opus'
          : attachedMedia.file.type || 'application/octet-stream'

        const { error: uploadError } = await supabase.storage
          .from('leadsol_storage')
          .upload(filePath, attachedMedia.file, {
            contentType,
            upsert: false
          })

        if (!uploadError) {
          const { data: signedUrlData } = await supabase.storage
            .from('leadsol_storage')
            .createSignedUrl(filePath, 60 * 60 * 24 * 7)

          if (signedUrlData?.signedUrl) {
            mediaUrl = signedUrlData.signedUrl
            mediaType = attachedMedia.type
          }
        }
      }

      const draftData = {
        campaign_id: editCampaignId || undefined, // Pass campaign ID for update
        name,
        connection_id: selectedConnection || undefined,
        message_template: effectiveMessageTemplate || '',
        scheduled_at,
        delay_min: delayMin,
        delay_max: delayMax,
        pause_after_messages: hasPause ? pauseAfterMessages : null,
        pause_seconds: hasPause ? pauseSeconds : null,
        respect_active_hours: hasActiveHours,
        active_hours_start: hasActiveHours ? activeHoursStart : null,
        active_hours_end: hasActiveHours ? activeHoursEnd : null,
        new_list_name: createNewList ? newListName : null,
        existing_list_id: assignToExistingList ? selectedExistingList : null,
        multi_device: hasMultiDevice,
        device_ids: hasMultiDevice ? selectedDevices : selectedConnection ? [selectedConnection] : [],
        recipients: recipients.map(r => ({
          phone: normalizePhone(r.phone),
          name: r.name,
          variables: r.variables || {}
        })),
        exclusion_list: exclusionList.map(e => normalizePhone(e.phone)),
        has_message_variations: hasMessageVariations,
        message_variations: hasMessageVariations ? messageVariations : [],
        variation_count: hasMessageVariations ? variationCount : 0,
        media_url: mediaUrl,
        media_type: mediaType,
        poll_question: attachedMedia.type === 'poll' && attachedMedia.poll ? attachedMedia.poll.question : null,
        poll_options: attachedMedia.type === 'poll' && attachedMedia.poll ? attachedMedia.poll.options : null,
        poll_multiple_answers: attachedMedia.type === 'poll' && attachedMedia.poll ? attachedMedia.poll.multipleAnswers : false,
        is_draft: true // Signal to API this is a draft save
      }

      const response = await fetch('/api/campaigns/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftData)
      })

      const data = await response.json()

      if (!response.ok) {
        setAlertPopup({ show: true, message: data.error || 'שגיאה בשמירת הטיוטה' })
        setSavingDraft(false)
        return
      }

      // Success - clear local draft and redirect to analytics
      clearDraftFromStorage()
      setFormModified(false)
      setSavingDraft(false)
      setAlertPopup({ show: true, message: 'הטיוטה נשמרה בהצלחה' })
      setTimeout(() => {
        router.push('/analytics')
      }, 1000)

    } catch (error) {
      console.error('Error saving draft:', error)
      setAlertPopup({ show: true, message: 'שגיאה בשמירת הטיוטה' })
      setSavingDraft(false)
    }
  }

  // Handle column sort
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, start with ascending
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Show tooltip for truncated cell content
  const showCellTooltip = (e: React.MouseEvent<HTMLDivElement>, text: string) => {
    const element = e.currentTarget
    // Only show tooltip if text is truncated
    if (element.scrollWidth > element.clientWidth && text && text !== '-') {
      const rect = element.getBoundingClientRect()
      setCellTooltip({
        text,
        x: rect.left + rect.width / 2,
        y: rect.top - 8
      })
    }
  }

  const hideCellTooltip = () => {
    setCellTooltip(null)
  }

  // Filter and sort recipients
  const filteredRecipients = recipients
    .filter(r =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.phone.includes(searchQuery) ||
      allColumns.some(col => {
        const val = r[col]
        return typeof val === 'string' && val.toLowerCase().includes(searchQuery.toLowerCase())
      })
    )
    .sort((a, b) => {
      if (!sortColumn) return 0

      let aVal: string = ''
      let bVal: string = ''

      if (sortColumn === 'name') {
        aVal = a.name || ''
        bVal = b.name || ''
      } else if (sortColumn === 'phone') {
        aVal = a.phone || ''
        bVal = b.phone || ''
      } else {
        // Dynamic column
        aVal = (a[sortColumn] as string) || ''
        bVal = (b[sortColumn] as string) || ''
      }

      const comparison = aVal.localeCompare(bVal, 'he')
      return sortDirection === 'asc' ? comparison : -comparison
    })

  // Toggle recipient selection
  const toggleRecipientSelection = (id: string) => {
    setSelectedRecipients(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Select all filtered recipients
  const selectAllRecipients = () => {
    if (selectedRecipients.size === filteredRecipients.length) {
      setSelectedRecipients(new Set())
    } else {
      setSelectedRecipients(new Set(filteredRecipients.map(r => r.id)))
    }
  }

  // Remove a column and its data from all recipients
  const removeColumn = (columnName: string, columnIndex: number) => {
    // Save the column data for potential restore
    const columnData: Record<string, string> = {}
    recipients.forEach(r => {
      if (r.variables && r.variables[columnName]) {
        columnData[r.id] = r.variables[columnName]
      }
    })
    setRemovedColumnData(prev => ({ ...prev, [columnName]: columnData }))

    // Remove from allColumns
    setAllColumns(allColumns.filter((_, i) => i !== columnIndex))

    // Add to removedColumns
    setRemovedColumns([...removedColumns, columnName])

    // Remove the variable from all recipients
    setRecipients(recipients.map(r => {
      if (r.variables && r.variables[columnName]) {
        const { [columnName]: removed, ...restVariables } = r.variables
        return { ...r, variables: restVariables }
      }
      return r
    }))
  }

  // Restore a removed column and its data
  const restoreColumn = (columnName: string, columnIndex: number) => {
    // Add back to allColumns
    setAllColumns([...allColumns, columnName])

    // Remove from removedColumns
    setRemovedColumns(removedColumns.filter((_, i) => i !== columnIndex))

    // Restore the variable data to recipients
    const savedData = removedColumnData[columnName]
    if (savedData) {
      setRecipients(recipients.map(r => {
        if (savedData[r.id]) {
          return {
            ...r,
            variables: { ...r.variables, [columnName]: savedData[r.id] }
          }
        }
        return r
      }))

      // Clear the saved data for this column
      setRemovedColumnData(prev => {
        const { [columnName]: removed, ...rest } = prev
        return rest
      })
    }
  }

  // Delete selected recipients
  const deleteSelectedRecipients = () => {
    if (selectedRecipients.size === 0) return

    setConfirmPopup({
      show: true,
      message: `האם למחוק ${selectedRecipients.size} נמענים שנבחרו?`,
      confirmText: 'מחק',
      onConfirm: () => {
        const newRecipients = recipients.filter(r => !selectedRecipients.has(r.id))
        setRecipients(newRecipients)
        setSelectedRecipients(new Set())
        // Save draft immediately after deletion (pass newRecipients to avoid stale state)
        if (newRecipients.length === 0) {
          setAllColumns([])
          setRemovedColumns([])
          clearDraftFromStorage()
        } else {
          saveDraftToStorage(newRecipients)
        }
      }
    })
  }

  // Delete single recipient
  const deleteRecipient = (id: string) => {
    const recipient = recipients.find(r => r.id === id)

    // If skip confirmation is enabled, delete immediately
    if (skipDeleteConfirm) {
      const newRecipients = recipients.filter(r => r.id !== id)
      setRecipients(newRecipients)
      setSelectedRecipients(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
      // Save draft immediately after deletion (pass newRecipients to avoid stale state)
      if (newRecipients.length === 0) {
        setAllColumns([])
        setRemovedColumns([])
        clearDraftFromStorage()
      } else {
        saveDraftToStorage(newRecipients)
      }
      return
    }

    // Show confirmation popup
    setDeleteConfirmPopup({
      show: true,
      recipientId: id,
      recipientName: recipient?.name || recipient?.phone || '',
      dontShowAgain: false
    })
  }

  // Confirm delete recipient
  const confirmDeleteRecipient = () => {
    const { recipientId, dontShowAgain } = deleteConfirmPopup

    // Update skip setting if checkbox was checked
    if (dontShowAgain) {
      setSkipDeleteConfirm(true)
    }

    // Delete the recipient
    const newRecipients = recipients.filter(r => r.id !== recipientId)
    setRecipients(newRecipients)
    setSelectedRecipients(prev => {
      const newSet = new Set(prev)
      newSet.delete(recipientId)
      return newSet
    })

    // Save draft immediately after deletion (pass newRecipients to avoid stale state)
    if (newRecipients.length === 0) {
      setAllColumns([])
      setRemovedColumns([])
      clearDraftFromStorage()
    } else {
      saveDraftToStorage(newRecipients)
    }

    // Close popup
    setDeleteConfirmPopup({ show: false, recipientId: '', recipientName: '', dontShowAgain: false })
  }

  const handleAddManualRecipient = () => {
    if (manualName && manualPhone) {
      // Add שם and טלפון to allColumns if not already present
      setAllColumns(prev => {
        const newCols = new Set([...prev, 'שם', 'טלפון'])
        return Array.from(newCols)
      })

      setRecipients(prev => [...prev, {
        id: Date.now().toString(),
        name: manualName,
        phone: normalizePhone(manualPhone)
      }])
      setManualName('')
      setManualPhone('')
    }
  }

  // Load data from Google Sheets
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

  // Exclusion list - Excel upload
  const handleExclusionExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setExclusionFileName(file.name)
      const reader = new FileReader()
      reader.onload = (event) => {
        const data = event.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][]

        const filteredData = jsonData.filter(row => row.some(cell => cell !== undefined && cell !== ''))

        if (filteredData.length > 0) {
          setExclusionData(filteredData)
          setExclusionColumnNames(filteredData[0].map(() => ''))
          setExclusionHasHeaders(true)
          setShowExclusionPopup(true)
        }
      }
      reader.readAsBinaryString(file)
    }
    e.target.value = ''
  }

  // Exclusion list - Google Sheets
  const handleExclusionLoadGoogleSheets = async () => {
    if (!exclusionSheetsUrl.trim()) {
      setAlertPopup({ show: true, message: 'יש להזין קישור ל-Google Sheets' })
      return
    }

    setExclusionSheetsLoading(true)

    try {
      const response = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: exclusionSheetsUrl })
      })

      const data = await response.json()

      if (!response.ok) {
        setAlertPopup({ show: true, message: data.error || 'שגיאה בטעינת הגיליון' })
        setExclusionSheetsLoading(false)
        return
      }

      const allRows = [data.headers, ...data.rows]
      setExclusionData(allRows)
      setExclusionColumnNames(allRows[0].map(() => ''))
      setExclusionHasHeaders(true)
      setExclusionFileName('Google Sheets')
      setShowExclusionPopup(true)
      setExclusionSheetsUrl('')

    } catch (error) {
      console.error('Error loading Google Sheets:', error)
      setAlertPopup({ show: true, message: 'שגיאה בטעינת הגיליון' })
    }

    setExclusionSheetsLoading(false)
  }

  // Add exclusion list phones
  const handleAddExclusionList = () => {
    const phoneIndex = exclusionColumnNames.findIndex(n => n === 'טלפון')

    if (phoneIndex === -1) {
      setAlertPopup({ show: true, message: 'חובה לבחור עמודת טלפון' })
      return
    }

    const dataRows = exclusionHasHeaders ? exclusionData.slice(1) : exclusionData

    const newExclusions = dataRows
      .map((row, idx) => ({
        id: `excl-${Date.now()}-${idx}`,
        phone: normalizePhone(String(row[phoneIndex] || ''))
      }))
      .filter(item => item.phone)

    // Filter out duplicates
    setExclusionList(prev => {
      const existingPhones = new Set(prev.map(p => p.phone))
      const uniqueNew = newExclusions.filter(n => !existingPhones.has(n.phone))
      return [...prev, ...uniqueNew]
    })

    // Reset
    setShowExclusionPopup(false)
    setExclusionData([])
    setExclusionColumnNames([])
    setExclusionFileName('')
  }

  // Add manual exclusion
  const handleAddManualExclusion = () => {
    if (exclusionManualPhone) {
      const formattedPhone = normalizePhone(exclusionManualPhone)
      // Check if already exists
      if (!exclusionList.some(e => e.phone === formattedPhone)) {
        setExclusionList(prev => [...prev, {
          id: `excl-manual-${Date.now()}`,
          phone: formattedPhone
        }])
      }
      setExclusionManualPhone('')
    }
  }

  // Filtered exclusion list
  const filteredExclusionList = exclusionList.filter(e =>
    e.phone.includes(exclusionSearchQuery)
  )

  // Toggle exclusion selection
  const toggleExclusionSelection = (id: string) => {
    setSelectedExclusions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Select all exclusions
  const selectAllExclusions = () => {
    if (selectedExclusions.size === filteredExclusionList.length) {
      setSelectedExclusions(new Set())
    } else {
      setSelectedExclusions(new Set(filteredExclusionList.map(e => e.id)))
    }
  }

  // Delete selected exclusions
  const deleteSelectedExclusions = () => {
    if (selectedExclusions.size === 0) return

    setConfirmPopup({
      show: true,
      message: `האם למחוק ${selectedExclusions.size} מספרים מרשימת אי-ההכללה?`,
      confirmText: 'מחק',
      onConfirm: () => {
        setExclusionList(prev => prev.filter(e => !selectedExclusions.has(e.id)))
        setSelectedExclusions(new Set())
      }
    })
  }

  // Delete single exclusion
  const deleteExclusion = (id: string) => {
    setExclusionList(prev => prev.filter(e => e.id !== id))
    setSelectedExclusions(prev => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }

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

  // Add recipients from Excel data
  const handleAddExcelRecipients = (skipNameCheck = false) => {
    const nameIndex = excelColumnNames.findIndex(n => n === 'שם')
    const phoneIndex = excelColumnNames.findIndex(n => n === 'טלפון')

    console.log('handleAddExcelRecipients called', { nameIndex, phoneIndex, skipNameCheck, excelColumnNames })

    if (phoneIndex === -1) {
      setAlertPopup({ show: true, message: 'חובה לבחור עמודת טלפון' })
      return
    }

    if (nameIndex === -1 && !skipNameCheck) {
      console.log('Showing confirm popup for no name column')
      // Close Excel popup first, then show confirm
      setShowExcelPopup(false)
      setConfirmPopup({
        show: true,
        message: 'לא נבחרה עמודת שם.\n\nהנמענים ייכנסו לרשימה ללא שם - האם אתה מאשר?',
        confirmText: 'אישור - הכנס ללא שם',
        onConfirm: () => {
          // Add recipients without names
          const dataRows = hasHeaders ? excelData.slice(1) : excelData

          // Get all column names that exist in the file (including טלפון)
          const allLoadedColumns = excelColumnNames.filter(colName => colName)

          const newRecipients = dataRows.map((row, idx) => {
            const variables: Record<string, string> = {}
            // Add extra columns to variables
            excelColumnNames.forEach((colName, colIdx) => {
              if (colIdx !== phoneIndex && colName && row[colIdx]) {
                variables[colName] = String(row[colIdx])
              }
            })
            const recipient: Recipient = {
              id: `excel-${Date.now()}-${idx}`,
              name: '',
              phone: normalizePhone(String(row[phoneIndex] || '')),
              variables,
            }
            // Also add to recipient directly for table display
            Object.entries(variables).forEach(([key, value]) => {
              recipient[key] = value
            })
            return recipient
          }).filter(r => r.phone)

          setRecipients(prev => [...prev, ...newRecipients])

          // Update all columns (merge with existing)
          setAllColumns(prev => {
            const newCols = new Set([...prev, ...allLoadedColumns])
            return Array.from(newCols)
          })

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

    // Get all column names that exist in the file
    const allLoadedColumns = excelColumnNames.filter(colName => colName)

    const newRecipients = dataRows.map((row, idx) => {
      const variables: Record<string, string> = {}
      // Add extra columns to variables
      excelColumnNames.forEach((colName, colIdx) => {
        if (colIdx !== nameIndex && colIdx !== phoneIndex && colName && row[colIdx]) {
          variables[colName] = String(row[colIdx])
        }
      })
      const recipient: Recipient = {
        id: `excel-${Date.now()}-${idx}`,
        name: nameIndex !== -1 ? String(row[nameIndex] || '') : '',
        phone: normalizePhone(String(row[phoneIndex] || '')),
        variables,
      }
      // Also add to recipient directly for table display
      Object.entries(variables).forEach(([key, value]) => {
        recipient[key] = value
      })
      return recipient
    }).filter(r => r.phone)

    setRecipients(prev => [...prev, ...newRecipients])

    // Update all columns (merge with existing)
    setAllColumns(prev => {
      const newCols = new Set([...prev, ...allLoadedColumns])
      return Array.from(newCols)
    })

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

  // Add recipients from parsed data
  const handleAddParsedRecipients = (skipNameCheck = false) => {
    const nameIndex = columnNames.findIndex(n => n === 'שם')
    const phoneIndex = columnNames.findIndex(n => n === 'טלפון')

    console.log('handleAddParsedRecipients called', { nameIndex, phoneIndex, skipNameCheck, columnNames })

    if (phoneIndex === -1) {
      setAlertPopup({ show: true, message: 'חובה לבחור עמודת טלפון' })
      return
    }

    if (nameIndex === -1 && !skipNameCheck) {
      console.log('Showing confirm popup for no name column (manual)')
      // Close manual popup first, then show confirm
      setShowManualEntryPopup(false)
      setConfirmPopup({
        show: true,
        message: 'לא נבחרה עמודת שם.\n\nהנמענים ייכנסו לרשימה ללא שם - האם אתה מאשר?',
        confirmText: 'אישור - הכנס ללא שם',
        onConfirm: () => {
          // Get all column names that exist in the data (including טלפון)
          const allLoadedColumns = columnNames.filter(colName => colName)

          // Add recipients without names
          const newRecipients = parsedRows.map((row, idx) => {
            const variables: Record<string, string> = {}
            // Add extra columns to variables
            columnNames.forEach((colName, colIdx) => {
              if (colIdx !== phoneIndex && colName && row[colIdx]) {
                variables[colName] = row[colIdx]
              }
            })
            const recipient: Recipient = {
              id: `parsed-${Date.now()}-${idx}`,
              name: '',
              phone: normalizePhone(row[phoneIndex] || ''),
              variables,
            }
            // Also add to recipient directly for table display
            Object.entries(variables).forEach(([key, value]) => {
              recipient[key] = value
            })
            return recipient
          }).filter(r => r.phone)

          setRecipients(prev => [...prev, ...newRecipients])

          // Update all columns (merge with existing)
          setAllColumns(prev => {
            const newCols = new Set([...prev, ...allLoadedColumns])
            return Array.from(newCols)
          })

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

    // Get all column names that exist in the data
    const allLoadedColumns = columnNames.filter(colName => colName)

    const newRecipients = parsedRows.map((row, idx) => {
      const variables: Record<string, string> = {}
      // Add extra columns to variables
      columnNames.forEach((colName, colIdx) => {
        if (colIdx !== nameIndex && colIdx !== phoneIndex && colName && row[colIdx]) {
          variables[colName] = row[colIdx]
        }
      })
      const recipient: Recipient = {
        id: `parsed-${Date.now()}-${idx}`,
        name: nameIndex !== -1 ? (row[nameIndex] || '') : '',
        phone: normalizePhone(row[phoneIndex] || ''),
        variables,
      }
      // Also add to recipient directly for table display
      Object.entries(variables).forEach(([key, value]) => {
        recipient[key] = value
      })
      return recipient
    }).filter(r => r.phone)

    setRecipients(prev => [...prev, ...newRecipients])

    // Update all columns (merge with existing)
    setAllColumns(prev => {
      const newCols = new Set([...prev, ...allLoadedColumns])
      return Array.from(newCols)
    })

    // Reset paste state
    setPastedText('')
    setParsedRows([])
    setColumnNames([])
    setShowColumnMapping(false)
    setManualEntryMode('single')
    setShowManualEntryPopup(false)
  }

  // Add custom field
  const handleAddCustomField = () => {
    setCustomFields(prev => [...prev, { name: '', value: '' }])
  }

  // Update custom field
  const handleUpdateCustomField = (index: number, field: 'name' | 'value', value: string) => {
    setCustomFields(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f))
  }

  // Remove custom field
  const handleRemoveCustomField = (index: number) => {
    setCustomFields(prev => prev.filter((_, i) => i !== index))
  }

  // Add manual recipient with custom fields
  const handleAddManualRecipientWithCustomFields = () => {
    if (manualName && manualPhone) {
      const customData = customFields.reduce((acc, field) => {
        if (field.name && field.value) {
          acc[field.name] = field.value
        }
        return acc
      }, {} as Record<string, string>)

      const formattedPhone = normalizePhone(manualPhone)
      console.log('Adding manual recipient:', { original: manualPhone, formatted: formattedPhone })

      // Update all columns with שם, טלפון and custom field names
      const newColumnNames = ['שם', 'טלפון', ...customFields.filter(f => f.name).map(f => f.name)]
      setAllColumns(prev => {
        const newCols = new Set([...prev, ...newColumnNames])
        return Array.from(newCols)
      })

      setRecipients(prev => [...prev, {
        id: Date.now().toString(),
        name: manualName,
        phone: formattedPhone,
        ...customData
      }])
      setManualName('')
      setManualPhone('')
      setCustomFields([])
    }
  }

  // Handle emoji selection from emoji-mart
  const handleEmojiSelect = (emoji: { native: string }) => {
    setMessageTemplate(prev => prev + emoji.native)
    setShowEmojiPicker(false)
  }

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Try to use OGG/OPUS format which WhatsApp supports natively
      // Falls back to webm if not supported
      let mimeType = 'audio/webm;codecs=opus'
      if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Determine file extension based on actual mimeType used
        const isOgg = mediaRecorder.mimeType.includes('ogg')
        const blobType = isOgg ? 'audio/ogg' : 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type: blobType })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      setAlertPopup({ show: true, message: 'לא ניתן לגשת למיקרופון. אנא בדוק את ההרשאות.' })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    setAudioBlob(null)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    setAudioUrl(null)
    setRecordingTime(0)
    setUploadedFileName('')
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }
  }

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate daily messages with variations bonus
  const calculateDailyMessages = () => {
    const baseMessages = 90
    const bonusPerVariation = 10
    const deviceCount = hasMultiDevice ? selectedDevices.length : 1
    const variationBonus = hasMessageVariations && messageVariations.length > 1
      ? (messageVariations.length - 1) * bonusPerVariation
      : 0
    return (baseMessages + variationBonus) * deviceCount
  }

  // Handle saving message as variation
  const handleSaveVariation = () => {
    if (pendingVariationMessage.trim()) {
      const newVariations = [...messageVariations]
      newVariations[currentVariationIndex] = pendingVariationMessage
      setMessageVariations(newVariations)
      setShowVariationSavePopup(false)
      setPendingVariationMessage('')

      // Move to next variation if available
      if (currentVariationIndex < variationCount - 1) {
        setCurrentVariationIndex(currentVariationIndex + 1)
        setMessageTemplate('')
      } else {
        // All variations filled, show first one
        setCurrentVariationIndex(0)
        setMessageTemplate(newVariations[0])
      }
    }
  }

  // Handle message input when variations are enabled
  const handleMessageInputBlur = () => {
    if (hasMessageVariations && messageTemplate.trim() && messageVariations.length < variationCount) {
      setPendingVariationMessage(messageTemplate)
      setShowVariationSavePopup(true)
    }
  }

  // Load user's stored files for storage management
  const loadStoredFiles = async () => {
    setLoadingFiles(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoadingFiles(false)
      return
    }

    const files: StoredFile[] = []
    const userId = user.id
    const validMediaTypes = ['audio', 'image', 'document']

    // Helper function to check if item is a real file (not a folder)
    const isRealFile = (item: { id: string | null; name: string; metadata?: { size?: number } | null }) => {
      // Must have an ID and metadata with size > 0
      return item.id && item.metadata && typeof item.metadata.size === 'number' && item.metadata.size > 0
    }

    // Get all files for this user - NEW path: campaigns/USER_ID/MEDIA_TYPE/filename
    const { data: typeFolders } = await supabase.storage.from('leadsol_storage').list(`campaigns/${userId}`)
    if (typeFolders) {
      for (const typeFolder of typeFolders) {
        if (!typeFolder.name || !validMediaTypes.includes(typeFolder.name)) continue
        const mediaType = typeFolder.name as 'audio' | 'image' | 'document'
        const { data: mediaFiles } = await supabase.storage.from('leadsol_storage').list(`campaigns/${userId}/${typeFolder.name}`)
        if (mediaFiles) {
          for (const file of mediaFiles) {
            if (isRealFile(file)) {
              files.push({
                name: file.name,
                path: `campaigns/${userId}/${typeFolder.name}/${file.name}`,
                size: file.metadata?.size || 0,
                createdAt: file.created_at || '',
                type: mediaType
              })
            }
          }
        }
      }
    }

    // Also check OLD path structure for backward compatibility: campaigns/YEAR/MONTH/USER_ID/MEDIA_TYPE/filename
    const { data: yearFolders } = await supabase.storage.from('leadsol_storage').list('campaigns')
    if (yearFolders) {
      for (const yearFolder of yearFolders) {
        // Skip if it looks like a user ID (new structure) instead of a year
        if (!yearFolder.name || yearFolder.name.includes('-')) continue
        const { data: monthFolders } = await supabase.storage.from('leadsol_storage').list(`campaigns/${yearFolder.name}`)
        if (monthFolders) {
          for (const monthFolder of monthFolders) {
            if (!monthFolder.name) continue
            const { data: userFolders } = await supabase.storage.from('leadsol_storage').list(`campaigns/${yearFolder.name}/${monthFolder.name}/${userId}`)
            if (userFolders) {
              for (const typeFolder of userFolders) {
                if (!typeFolder.name || !validMediaTypes.includes(typeFolder.name)) continue
                const mediaType = typeFolder.name as 'audio' | 'image' | 'document'
                const { data: mediaFiles } = await supabase.storage.from('leadsol_storage').list(`campaigns/${yearFolder.name}/${monthFolder.name}/${userId}/${typeFolder.name}`)
                if (mediaFiles) {
                  for (const file of mediaFiles) {
                    if (isRealFile(file)) {
                      files.push({
                        name: file.name,
                        path: `campaigns/${yearFolder.name}/${monthFolder.name}/${userId}/${typeFolder.name}/${file.name}`,
                        size: file.metadata?.size || 0,
                        createdAt: file.created_at || '',
                        type: mediaType
                      })
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // Sort by date descending
    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    setStoredFiles(files)
    setLoadingFiles(false)
  }

  // Delete selected files
  const deleteSelectedFiles = async () => {
    if (selectedFilesToDelete.size === 0) return

    const supabase = createClient()
    const filesToDelete = Array.from(selectedFilesToDelete)

    setDeletingFiles(new Set(filesToDelete))

    for (const filePath of filesToDelete) {
      const { error } = await supabase.storage.from('leadsol_storage').remove([filePath])
      if (error) {
        console.error('Error deleting file:', error)
      }
    }

    // Refresh file list
    setSelectedFilesToDelete(new Set())
    setDeletingFiles(new Set())
    await loadStoredFiles()
  }

  // Delete single file
  const deleteSingleFile = async (filePath: string) => {
    const supabase = createClient()
    setDeletingFiles(new Set([filePath]))

    const { error } = await supabase.storage.from('leadsol_storage').remove([filePath])
    if (error) {
      console.error('Error deleting file:', error)
      setAlertPopup({ show: true, message: 'שגיאה במחיקת הקובץ' })
    }

    setDeletingFiles(new Set())
    await loadStoredFiles()
  }

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Calculate total storage used
  const getTotalStorageUsed = (): number => {
    return storedFiles.reduce((total, file) => total + file.size, 0)
  }

  // Load FFmpeg for audio conversion
  const loadFFmpeg = useCallback(async () => {
    if (ffmpegLoadedRef.current || ffmpegRef.current) return ffmpegRef.current

    const ffmpeg = new FFmpeg()
    ffmpegRef.current = ffmpeg

    try {
      // Load FFmpeg with CDN URLs
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      ffmpegLoadedRef.current = true
      console.log('FFmpeg loaded successfully')
      return ffmpeg
    } catch (error) {
      console.error('Failed to load FFmpeg:', error)
      ffmpegRef.current = null
      return null
    }
  }, [])

  // Convert any audio file/blob to OGG format using FFmpeg
  const convertToOgg = useCallback(async (input: File | Blob, originalName?: string): Promise<File> => {
    setIsConverting(true)
    try {
      const ffmpeg = await loadFFmpeg()
      if (!ffmpeg) {
        // Fallback: return original with renamed extension (WAHA will try to convert)
        console.warn('FFmpeg not available, using fallback')
        const name = originalName || `audio_${Date.now()}`
        const baseName = name.replace(/\.[^/.]+$/, '')
        return new File([input], `${baseName}.ogg`, { type: 'audio/ogg' })
      }

      // Determine input extension
      const inputName = input instanceof File ? input.name : 'input.webm'
      const inputExt = inputName.split('.').pop() || 'webm'
      const inputFileName = `input.${inputExt}`
      const outputFileName = 'output.ogg' // WhatsApp requires .ogg extension

      // Write input file to FFmpeg virtual filesystem
      await ffmpeg.writeFile(inputFileName, await fetchFile(input))

      // Convert to Opus codec in OGG container (WhatsApp voice message format)
      // WhatsApp requires: OGG container + Opus codec for PTT voice messages
      try {
        await ffmpeg.exec([
          '-i', inputFileName,
          '-c:a', 'libopus',
          '-b:a', '32k',
          '-ar', '48000',
          '-ac', '1',
          '-vbr', 'on', // Variable bitrate for better quality
          outputFileName
        ])
      } catch {
        // Fallback to vorbis codec (may not work as PTT but still playable)
        console.warn('libopus not available, falling back to libvorbis')
        await ffmpeg.exec([
          '-i', inputFileName,
          '-c:a', 'libvorbis',
          '-b:a', '64k',
          '-ar', '48000',
          '-ac', '1',
          outputFileName
        ])
      }

      // Read output file
      const outputData = await ffmpeg.readFile(outputFileName)
      // Convert FileData (Uint8Array) to proper ArrayBuffer for Blob
      const outputBuffer = outputData instanceof Uint8Array
        ? new Uint8Array(outputData).buffer
        : outputData
      const outputBlob = new Blob([outputBuffer], { type: 'audio/ogg; codecs=opus' })

      // Clean up
      try { await ffmpeg.deleteFile(inputFileName) } catch {}
      try { await ffmpeg.deleteFile(outputFileName) } catch {}

      // Create final file with .ogg extension (required by WhatsApp for PTT)
      const baseName = (originalName || inputName).replace(/\.[^/.]+$/, '')
      const finalFile = new File([outputBlob], `${baseName}.ogg`, { type: 'audio/ogg; codecs=opus' })

      console.log(`Converted ${inputName} to OGG/Opus (${finalFile.size} bytes)`)
      return finalFile
    } catch (error) {
      console.error('FFmpeg conversion failed:', error)
      // Fallback - keep original but rename to .ogg for WAHA to try to convert
      const name = originalName || `audio_${Date.now()}`
      const baseName = name.replace(/\.[^/.]+$/, '')
      return new File([input], `${baseName}.ogg`, { type: 'audio/ogg; codecs=opus' })
    } finally {
      setIsConverting(false)
    }
  }, [loadFFmpeg])

  // Convert recorded audio blob to OGG file
  const convertToAudioFile = useCallback(async (blob: Blob): Promise<File> => {
    const fileName = `voice_${Date.now()}`
    // Always convert to OGG for WhatsApp compatibility
    return await convertToOgg(blob, fileName)
  }, [convertToOgg])

  // Handle audio file upload
  const handleAudioFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Check if it's an audio file
      if (!file.type.startsWith('audio/')) {
        setAlertPopup({ show: true, message: 'אנא בחר קובץ אודיו בלבד' })
        return
      }

      // Convert to OGG if not already OGG
      let audioFile = file
      if (!file.type.includes('ogg') && !file.name.toLowerCase().endsWith('.ogg')) {
        audioFile = await convertToOgg(file, file.name)
      }
      const url = URL.createObjectURL(audioFile)
      // Save directly to attachedMedia
      setAttachedMedia({
        type: 'audio',
        file: audioFile,
        url,
        name: audioFile.name
      })
      setShowAudioPopup(false)
    }
    event.target.value = ''
  }

  // Handle document file upload
  const handleDocumentFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setAttachedMedia({
        type: 'document',
        file,
        url,
        name: file.name
      })
      setShowAudioPopup(false)
    }
    event.target.value = ''
  }

  // Handle image file upload
  const handleImageFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        setAlertPopup({ show: true, message: 'אנא בחר קובץ תמונה בלבד' })
        return
      }
      const url = URL.createObjectURL(file)
      setAttachedMedia({
        type: 'image',
        file,
        url,
        name: file.name
      })
      setShowAudioPopup(false)
    }
    event.target.value = ''
  }

  // Save audio to attached media
  const saveAudioToMedia = async () => {
    if (audioBlob) {
      const audioFile = await convertToAudioFile(audioBlob)
      setAttachedMedia({
        type: 'audio',
        file: audioFile,
        url: audioUrl,
        name: uploadedFileName || audioFile.name
      })
      // Reset audio popup state
      setAudioBlob(null)
      setAudioUrl(null)
      setRecordingTime(0)
      setUploadedFileName('')
      setShowAudioPopup(false)
    }
  }

  // Toggle audio preview playback
  const toggleAudioPreview = () => {
    if (audioPreviewRef.current) {
      if (isPlayingPreview) {
        audioPreviewRef.current.pause()
      } else {
        audioPreviewRef.current.play()
      }
      setIsPlayingPreview(!isPlayingPreview)
    }
  }

  // Remove attached media
  const removeAttachedMedia = () => {
    if (attachedMedia.url) {
      URL.revokeObjectURL(attachedMedia.url)
    }
    setAttachedMedia({ type: null, file: null, url: null, name: '' })
  }

  // Handle attachment selection
  const handleAttachmentClick = (type: 'document' | 'camera' | 'survey' | 'image' | 'audio' | 'saved') => {
    setShowAttachmentsMenu(false)

    if (type === 'audio') {
      setAudioPopupType('audio')
      setShowAudioPopup(true)
    } else if (type === 'document') {
      setAudioPopupType('document')
      setShowAudioPopup(true)
    } else if (type === 'image') {
      setAudioPopupType('image')
      setShowAudioPopup(true)
    } else if (type === 'camera') {
      setAudioPopupType('camera')
      setShowAudioPopup(true)
    } else if (type === 'survey') {
      setAudioPopupType('survey')
      setSurveyQuestion('')
      setSurveyOptions(['', ''])
      setAllowMultipleAnswers(false)
      setShowAudioPopup(true)
    } else if (type === 'saved') {
      loadStoredFiles()
      setShowSavedFilesPopup(true)
    }
  }

  // Attachments menu items
  const attachmentItems = [
    { type: 'audio' as const, icon: Mic, label: 'הודעה קולית' },
    { type: 'document' as const, icon: FileText, label: 'מסמך' },
    { type: 'image' as const, icon: Image, label: 'תמונה' },
    { type: 'camera' as const, icon: Camera, label: 'מצלמה' },
    { type: 'survey' as const, icon: BarChart3, label: 'סקר' },
    { type: 'saved' as const, icon: FolderOpen, label: 'קבצים שמורים' },
  ]

  // Hebrew translations for emoji picker categories
  const emojiI18n = {
    search: 'חיפוש',
    search_no_results_1: 'אוי לא!',
    search_no_results_2: 'לא נמצאו אימוג\'ים',
    pick: 'בחר אימוג\'י...',
    add_custom: 'הוסף אימוג\'י מותאם',
    categories: {
      activity: 'פעילויות',
      custom: 'מותאם אישית',
      flags: 'דגלים',
      foods: 'אוכל ושתייה',
      frequent: 'נפוצים',
      nature: 'טבע ובעלי חיים',
      objects: 'אובייקטים',
      people: 'אנשים',
      places: 'מקומות ונסיעות',
      symbols: 'סמלים',
    },
    skins: {
      choose: 'בחר גוון עור ברירת מחדל',
      '1': 'ברירת מחדל',
      '2': 'בהיר',
      '3': 'בהיר-בינוני',
      '4': 'בינוני',
      '5': 'כהה-בינוני',
      '6': 'כהה',
    },
  }

  // Checkbox component
  const Checkbox = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <div
      onClick={() => onChange(!checked)}
      className={`w-[17px] h-[17px] rounded-[4px] border cursor-pointer flex items-center justify-center transition-colors ${
        checked
          ? 'bg-[#030733] border-[#030733]'
          : darkMode ? 'border-gray-400 bg-transparent' : 'border-[#030733] bg-transparent'
      }`}
    >
      {checked && (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M2.70898 7.04102L4.87565 9.20768L10.2923 3.79102" stroke="white" strokeWidth="0.933333" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  )

  return (
    <div className={`min-h-screen lg:h-screen lg:max-h-screen overflow-y-auto lg:overflow-hidden ${darkMode ? 'bg-[#0a1628]' : 'bg-[#f2f3f8]'} p-3 sm:p-[15px] 2xl:p-[20px] relative lg:flex lg:flex-col`} dir="rtl">

      {/* Mobile Step 2 - iPhone Preview & Message (shown only on mobile when step 2) */}
      {mobileStep === 2 && (
        <div className="lg:hidden flex flex-col gap-3 sm:gap-4 pb-6 px-3 sm:px-4 md:px-6">
          {/* Back button */}
          <button
            onClick={() => setMobileStep(1)}
            className={`self-start flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-[10px] text-[13px] sm:text-[14px] md:text-[15px] font-medium ${
              darkMode ? 'bg-[#142241] text-white' : 'bg-white text-[#030733]'
            }`}
          >
            <ChevronDown className="w-4 h-4 sm:w-[18px] sm:h-[18px] rotate-90" />
            חזור
          </button>

          {/* iPhone Preview for Mobile */}
          <div className="flex justify-center px-2 sm:px-4">
            <div className="relative w-[260px] h-[460px] sm:w-[280px] sm:h-[500px] md:w-[300px] md:h-[540px]">
              <img
                src="https://res.cloudinary.com/dimsgvsze/image/upload/v1768252870/yhgqfirwamy9jtrd9bxk_ptizqs.png"
                alt="iPhone Preview"
                className="w-full h-full object-contain"
              />
              {/* Message Overlay - Show variations if enabled, otherwise show single message */}
              {hasMessageVariations ? (
                <div className="absolute top-[16%] right-[10%] left-[8%] max-h-[58%] overflow-y-auto flex flex-col gap-[12px] pt-[10px]">
                  {Array.from({ length: variationCount }).map((_, idx) => {
                    const content = idx === currentVariationIndex
                      ? messageTemplate
                      : messageVariations[idx] || ''
                    if (!content) return null
                    return (
                      <div key={idx} className="relative mr-[8px]">
                        {/* Variation number badge - inside bubble */}
                        <div className={`absolute right-[6px] top-[6px] w-[18px] h-[18px] rounded-full flex items-center justify-center z-10 ${
                          idx === currentVariationIndex ? 'bg-[#030733]' : 'bg-[#030733]/60'
                        }`}>
                          <span className="text-[10px] text-white font-bold">{idx + 1}</span>
                        </div>
                        <div
                          className="absolute -right-[8px] top-[0px] w-[8px] h-[12px]"
                          style={{
                            background: idx === currentVariationIndex ? '#187C55' : '#145c40',
                            clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                          }}
                        />
                        <div className={`rounded-bl-[6px] rounded-br-[6px] rounded-tl-[6px] p-3 pt-[26px] shadow-sm ${
                          idx === currentVariationIndex ? 'bg-[#187C55]' : 'bg-[#145c40]'
                        }`}>
                          <p className="text-[11px] text-white whitespace-pre-wrap leading-[14px] break-words text-right" style={{ wordBreak: 'break-word', fontWeight: 400 }}>{content}</p>
                          <div className="flex items-center justify-start gap-1 mt-2">
                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                              <path d="M0.6875 5.72852L2.55555 7.59655C2.66294 7.70398 2.83706 7.70398 2.94445 7.59655L4.125 6.41602" stroke="#53BDEB" strokeWidth="0.6875" strokeLinecap="round"/>
                              <path d="M7.33333 3.20898L5.5 5.04232" stroke="#53BDEB" strokeWidth="0.6875" strokeLinecap="round"/>
                              <path d="M3.20898 5.50065L5.30618 7.59785C5.41361 7.70528 5.58769 7.70528 5.69512 7.59785L10.084 3.20898" stroke="#53BDEB" strokeWidth="0.6875" strokeLinecap="round"/>
                            </svg>
                            <span className="text-[10px] text-[#DEDEDE]">19:57</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (messageTemplate || attachedMedia.type) && (
                <div className="absolute top-[14%] right-[10%] left-[8%] max-h-[60%] overflow-hidden">
                  <div className="relative mr-[8px]">
                    <div
                      className="absolute -right-[8px] top-0 w-[8px] h-[12px]"
                      style={{
                        background: '#187C55',
                        clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                      }}
                    />
                    <div className="bg-[#187C55] rounded-bl-[6px] rounded-br-[6px] rounded-tl-[6px] p-3 shadow-sm">
                      {/* Attached Media Preview */}
                      {attachedMedia.type === 'image' && attachedMedia.url && (
                        <div className="mb-2 rounded-[4px] overflow-hidden">
                          <img src={attachedMedia.url} alt="תמונה מצורפת" className="w-full h-auto max-h-[120px] object-cover" />
                        </div>
                      )}
                      {attachedMedia.type === 'document' && (
                        <div className="mb-2 bg-[#0d5c3f] rounded-[4px] p-2 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-white/80" />
                          <span className="text-[10px] text-white/90 truncate flex-1">{attachedMedia.name}</span>
                        </div>
                      )}
                      {attachedMedia.type === 'audio' && (
                        <div className="mb-2 bg-[#0d5c3f] rounded-[4px] p-2 flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            <Play className="w-4 h-4 text-white fill-white" />
                          </div>
                          <div className="flex-1">
                            <div className="h-[3px] bg-white/30 rounded-full">
                              <div className="h-full w-[30%] bg-white rounded-full" />
                            </div>
                            <span className="text-[9px] text-white/70 mt-1">0:00</span>
                          </div>
                        </div>
                      )}
                      {attachedMedia.type === 'poll' && attachedMedia.poll && (
                        <div className="mb-2 bg-[#0d5c3f] rounded-[4px] p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <BarChart3 className="w-3 h-3 text-white/80" />
                            <span className="text-[10px] text-white/90 font-medium">סקר</span>
                          </div>
                          <p className="text-[10px] text-white font-medium mb-1">{attachedMedia.poll.question}</p>
                          <div className="space-y-1">
                            {attachedMedia.poll.options.slice(0, 3).map((opt, i) => (
                              <div key={i} className="bg-white/10 rounded px-2 py-0.5 text-[9px] text-white/80">{opt}</div>
                            ))}
                            {attachedMedia.poll.options.length > 3 && (
                              <span className="text-[8px] text-white/60">+{attachedMedia.poll.options.length - 3} עוד</span>
                            )}
                          </div>
                        </div>
                      )}
                      {messageTemplate && (
                        <p className="text-[11px] text-white whitespace-pre-wrap leading-[14px] break-words text-right" style={{ wordBreak: 'break-word', fontWeight: 400 }}>{messageTemplate}</p>
                      )}
                      <div className="flex items-center justify-start gap-1 mt-2">
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                          <path d="M0.6875 5.72852L2.55555 7.59655C2.66294 7.70398 2.83706 7.70398 2.94445 7.59655L4.125 6.41602" stroke="#53BDEB" strokeWidth="0.6875" strokeLinecap="round"/>
                          <path d="M7.33333 3.20898L5.5 5.04232" stroke="#53BDEB" strokeWidth="0.6875" strokeLinecap="round"/>
                          <path d="M3.20898 5.50065L5.30618 7.59785C5.41361 7.70528 5.58769 7.70528 5.69512 7.59785L10.084 3.20898" stroke="#53BDEB" strokeWidth="0.6875" strokeLinecap="round"/>
                        </svg>
                        <span className="text-[10px] text-[#DEDEDE]">19:57</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Message Input for Mobile Step 2 */}
          <div className="flex flex-col gap-[6px] sm:gap-[8px]">
            {/* Variables chips */}
            {recipients.length > 0 && allColumns.length > 0 && (
              <div className="flex items-center gap-[6px] sm:gap-[8px] flex-wrap">
                <p className={`text-[13px] sm:text-[14px] md:text-[15px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                  <span className="font-semibold">משתנים: </span>
                </p>
                {allColumns.map((colName) => (
                  <div
                    key={colName}
                    className="px-[8px] sm:px-[10px] py-[3px] sm:py-[4px] bg-[#030733] rounded-[7px] cursor-pointer hover:bg-[#0a1628] transition-colors touch-manipulation"
                    onClick={() => setMessageTemplate(prev => prev + `{${colName}}`)}
                  >
                    <span className="text-white text-[11px] sm:text-[12px] md:text-[13px]">{colName}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Message textarea */}
            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              placeholder="כתוב את ההודעה כאן..."
              className={`w-full h-[110px] sm:h-[120px] md:h-[140px] p-3 sm:p-4 rounded-[10px] text-[13px] sm:text-[14px] md:text-[15px] outline-none resize-none ${
                darkMode ? 'bg-[#142241] text-white placeholder-gray-400' : 'bg-white text-[#030733] placeholder-[#a2a2a2]'
              }`}
            />

            {/* Media buttons for mobile */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
              <button
                onClick={() => { setAudioPopupType('audio'); setShowAudioPopup(true); }}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 h-[44px] rounded-[8px] text-[12px] sm:text-[13px] md:text-[14px] touch-manipulation ${
                  darkMode ? 'bg-[#142241] text-white' : 'bg-white text-[#030733]'
                }`}
              >
                <Mic className="w-[16px] h-[16px] sm:w-4 sm:h-4" />
                הקלטה
              </button>
              <button
                onClick={() => { setAudioPopupType('image'); setShowAudioPopup(true); }}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 h-[44px] rounded-[8px] text-[12px] sm:text-[13px] md:text-[14px] touch-manipulation ${
                  darkMode ? 'bg-[#142241] text-white' : 'bg-white text-[#030733]'
                }`}
              >
                <Image className="w-[16px] h-[16px] sm:w-4 sm:h-4" />
                תמונה
              </button>
              <button
                onClick={() => { setAudioPopupType('document'); setShowAudioPopup(true); }}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 h-[44px] rounded-[8px] text-[12px] sm:text-[13px] md:text-[14px] touch-manipulation ${
                  darkMode ? 'bg-[#142241] text-white' : 'bg-white text-[#030733]'
                }`}
              >
                <FileText className="w-[16px] h-[16px] sm:w-4 sm:h-4" />
                מסמך
              </button>
            </div>

            {/* Attached Media Indicator for mobile */}
            {attachedMedia.type && (
              <div className={`p-3 rounded-[10px] flex items-center justify-between ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}>
                <button
                  onClick={removeAttachedMedia}
                  className="text-red-500 hover:text-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  {/* Edit button for poll */}
                  {attachedMedia.type === 'poll' && attachedMedia.poll && (
                    <button
                      onClick={() => {
                        setSurveyQuestion(attachedMedia.poll!.question)
                        setSurveyOptions(attachedMedia.poll!.options)
                        setAllowMultipleAnswers(attachedMedia.poll!.multipleAnswers)
                        setAudioPopupType('survey')
                        setShowAudioPopup(true)
                      }}
                      className={`p-1 rounded transition-colors ${darkMode ? 'hover:bg-[#1e3a5f] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span className={`text-sm ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                    {attachedMedia.name}
                  </span>
                  {attachedMedia.type === 'audio' && <Mic className={`w-4 h-4 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />}
                  {attachedMedia.type === 'document' && <FileText className={`w-4 h-4 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />}
                  {attachedMedia.type === 'image' && <Image className={`w-4 h-4 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />}
                  {attachedMedia.type === 'poll' && <BarChart3 className={`w-4 h-4 ${darkMode ? 'text-orange-400' : 'text-orange-600'}`} />}
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={loading || !name || !selectedConnection || (!messageTemplate && !attachedMedia.type) || recipients.length === 0}
              className="w-full h-[48px] sm:h-[50px] md:h-[52px] bg-[#030733] text-white rounded-[10px] text-[14px] sm:text-[15px] md:text-[16px] font-semibold hover:bg-[#0a1628] transition-colors disabled:opacity-50 touch-manipulation"
            >
              {loading ? 'שומר...' : 'צור קמפיין'}
            </button>
          </div>
        </div>
      )}

      {/* iPhone - Fixed Position - Hidden on mobile/tablet (Desktop only) */}
      <div className="hidden xl:flex absolute left-[8px] xl:left-[10px] 2xl:left-[20px] top-[8px] xl:top-[10px] 2xl:top-[20px] bottom-[8px] xl:bottom-[10px] 2xl:bottom-[20px] w-[280px] xl:w-[300px] 2xl:w-[350px] items-start justify-center z-10 overflow-hidden">
        <div className="relative" style={{ height: 'calc(100vh - 90px)' }}>
          <img
            src="https://res.cloudinary.com/dimsgvsze/image/upload/v1768252870/yhgqfirwamy9jtrd9bxk_ptizqs.png"
            alt="iPhone Preview"
            className="h-full w-auto object-contain object-top transition-all"
          />
          {/* Message Overlay - Show variations if enabled, otherwise show single message */}
          {hasMessageVariations ? (
            <div className="absolute top-[16%] right-[10%] left-[8%] max-h-[58%] overflow-y-auto flex flex-col gap-[12px] pt-[10px]">
              {/* Show all saved variations + current editing variation */}
              {Array.from({ length: variationCount }).map((_, idx) => {
                // Get the content: if it's the current variation being edited, show live messageTemplate
                const content = idx === currentVariationIndex
                  ? messageTemplate
                  : messageVariations[idx] || ''

                if (!content) return null // Don't show empty variations

                return (
                  <div key={idx} className="relative mr-[8px]">
                    {/* Variation number badge - positioned inside the bubble */}
                    <div className={`absolute right-[6px] top-[6px] w-[18px] h-[18px] rounded-full flex items-center justify-center z-10 ${
                      idx === currentVariationIndex ? 'bg-[#030733]' : 'bg-[#030733]/60'
                    }`}>
                      <span className="text-[10px] text-white font-bold">{idx + 1}</span>
                    </div>
                    {/* Tail pointing right */}
                    <div
                      className="absolute -right-[8px] top-[0px] w-[8px] h-[12px]"
                      style={{
                        background: idx === currentVariationIndex ? '#187C55' : '#145c40',
                        clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                      }}
                    />
                    <div className={`rounded-bl-[6px] rounded-br-[6px] rounded-tl-[6px] p-3 pt-[26px] shadow-sm ${
                      idx === currentVariationIndex ? 'bg-[#187C55]' : 'bg-[#145c40]'
                    }`}>
                      <p className="text-[11px] text-white whitespace-pre-wrap leading-[14px] break-words text-right" style={{ wordBreak: 'break-word', fontWeight: 400 }}>{content}</p>
                      <div className="flex items-center justify-start gap-1 mt-2">
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                          <path d="M0.6875 5.72852L2.55555 7.59655C2.66294 7.70398 2.83706 7.70398 2.94445 7.59655L4.125 6.41602" stroke="#53BDEB" strokeWidth="0.6875" strokeLinecap="round"/>
                          <path d="M7.33333 3.20898L5.5 5.04232" stroke="#53BDEB" strokeWidth="0.6875" strokeLinecap="round"/>
                          <path d="M3.20898 5.50065L5.30618 7.59785C5.41361 7.70528 5.58769 7.70528 5.69512 7.59785L10.084 3.20898" stroke="#53BDEB" strokeWidth="0.6875" strokeLinecap="round"/>
                        </svg>
                        <span className="text-[10px] text-[#DEDEDE]">19:57</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (messageTemplate || attachedMedia.type) && (
            <div className="absolute top-[14%] right-[10%] left-[8%] max-h-[60%] overflow-hidden">
              <div className="relative mr-[8px]">
                {/* Tail pointing right */}
                <div
                  className="absolute -right-[8px] top-0 w-[8px] h-[12px]"
                  style={{
                    background: '#187C55',
                    clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                  }}
                />
                <div className="bg-[#187C55] rounded-bl-[6px] rounded-br-[6px] rounded-tl-[6px] p-3 shadow-sm">
                  {/* Attached Media Preview */}
                  {attachedMedia.type === 'image' && attachedMedia.url && (
                    <div className="mb-2 rounded-[4px] overflow-hidden">
                      <img src={attachedMedia.url} alt="תמונה מצורפת" className="w-full h-auto max-h-[150px] object-cover" />
                    </div>
                  )}
                  {attachedMedia.type === 'document' && (
                    <div className="mb-2 bg-[#0d5c3f] rounded-[4px] p-2 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-white/80" />
                      <span className="text-[10px] text-white/90 truncate flex-1">{attachedMedia.name}</span>
                    </div>
                  )}
                  {attachedMedia.type === 'audio' && (
                    <div className="mb-2 bg-[#0d5c3f] rounded-[4px] p-2 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <Play className="w-4 h-4 text-white fill-white" />
                      </div>
                      <div className="flex-1">
                        <div className="h-[3px] bg-white/30 rounded-full">
                          <div className="h-full w-[30%] bg-white rounded-full" />
                        </div>
                        <span className="text-[9px] text-white/70 mt-1">0:00</span>
                      </div>
                    </div>
                  )}
                  {attachedMedia.type === 'poll' && attachedMedia.poll && (
                    <div className="mb-2 bg-[#0d5c3f] rounded-[4px] p-2">
                      <div className="flex items-center gap-1 mb-1">
                        <BarChart3 className="w-3 h-3 text-white/80" />
                        <span className="text-[10px] text-white/90 font-medium">סקר</span>
                      </div>
                      <p className="text-[10px] text-white font-medium mb-1">{attachedMedia.poll.question}</p>
                      <div className="space-y-1">
                        {attachedMedia.poll.options.slice(0, 3).map((opt, i) => (
                          <div key={i} className="bg-white/10 rounded px-2 py-0.5 text-[9px] text-white/80">{opt}</div>
                        ))}
                        {attachedMedia.poll.options.length > 3 && (
                          <span className="text-[8px] text-white/60">+{attachedMedia.poll.options.length - 3} עוד</span>
                        )}
                      </div>
                    </div>
                  )}
                  {messageTemplate && (
                    <p className="text-[11px] text-white whitespace-pre-wrap leading-[14px] break-words text-right" style={{ wordBreak: 'break-word', fontWeight: 400 }}>{messageTemplate}</p>
                  )}
                  <div className="flex items-center justify-start gap-1 mt-2">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M0.6875 5.72852L2.55555 7.59655C2.66294 7.70398 2.83706 7.70398 2.94445 7.59655L4.125 6.41602" stroke="#53BDEB" strokeWidth="0.6875" strokeLinecap="round"/>
                      <path d="M7.33333 3.20898L5.5 5.04232" stroke="#53BDEB" strokeWidth="0.6875" strokeLinecap="round"/>
                      <path d="M3.20898 5.50065L5.30618 7.59785C5.41361 7.70528 5.58769 7.70528 5.69512 7.59785L10.084 3.20898" stroke="#53BDEB" strokeWidth="0.6875" strokeLinecap="round"/>
                    </svg>
                    <span className="text-[10px] text-[#DEDEDE]">19:57</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Draft Button - Centered below iPhone mockup (Desktop only) */}
      <button
        onClick={handleSaveDraft}
        disabled={savingDraft || loading}
        className="hidden xl:flex fixed left-[85px] 2xl:left-[102px] bottom-[20px] 2xl:bottom-[30px] w-[150px] 2xl:w-[175px] h-[44px] bg-gray-500 hover:bg-gray-600 text-white rounded-[10px] text-[14px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed items-center justify-center gap-2 z-20"
      >
        {savingDraft ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <span>שומר טיוטה...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            <span>שמירת טיוטה</span>
          </>
        )}
      </button>

      {/* Main Content - Hidden on mobile when step 2 */}
      <div className={`${mobileStep === 2 ? 'hidden lg:flex' : 'flex'} flex-col lg:flex-row gap-3 sm:gap-4 md:gap-[12px] lg:gap-[15px] xl:gap-[18px] 2xl:gap-[20px] xl:ml-[320px] 2xl:ml-[380px] lg:flex-1 lg:min-h-0 p-3 sm:p-4 md:p-5 lg:p-0`}>

        {/* RIGHT SIDE - Form (מימין) */}
        <div className={`w-full lg:w-[320px] xl:w-[350px] 2xl:w-[400px] flex flex-col gap-4 sm:gap-5 md:gap-[18px] lg:gap-[20px] xl:gap-[24px] 2xl:gap-[28px] lg:shrink-0 lg:pr-[10px] xl:pr-[15px] 2xl:pr-[20px] relative z-20 lg:overflow-y-auto ${darkMode ? 'dark-scrollbar' : ''}`}>
          {/* Campaign Name */}
          <div>
            <p className={`text-[14px] sm:text-[15px] md:text-[16px] lg:text-[16px] xl:text-[17px] font-semibold mb-[6px] md:mb-[7px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              הזנת שם לקמפיין
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="דוגמא: לקוחות שרכשו - הפצה 28/03/2024"
              className={`w-full h-[44px] sm:h-[46px] md:h-[48px] lg:h-[40px] xl:h-[42px] 2xl:h-[44px] px-[12px] sm:px-[14px] md:px-[16px] lg:px-[14px] rounded-[10px] text-[13px] sm:text-[14px] md:text-[15px] lg:text-[13px] xl:text-[14px] outline-none ${
                darkMode ? 'bg-[#142241] text-white placeholder-gray-400' : 'bg-white text-[#030733] placeholder-[#a2a2a2]'
              }`}
            />
          </div>

          {/* WhatsApp Connection */}
          <div>
            <p className={`text-[14px] sm:text-[15px] md:text-[16px] lg:text-[16px] xl:text-[17px] font-semibold mb-[6px] md:mb-[7px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              בחירת חיבור WhatsApp
            </p>
            {connections.length === 0 ? (
              <div className={`w-full h-[44px] sm:h-[46px] md:h-[48px] lg:h-[40px] xl:h-[42px] 2xl:h-[44px] px-[12px] sm:px-[14px] md:px-[16px] lg:px-[14px] rounded-[10px] text-[13px] sm:text-[14px] md:text-[15px] lg:text-[13px] xl:text-[14px] flex items-center ${
                darkMode ? 'bg-[#142241] text-gray-400' : 'bg-white text-[#a2a2a2]'
              }`}>
                <span>אין חיבורים זמינים - </span>
                <button
                  onClick={() => handleNavigateAway('/connections')}
                  className="text-blue-500 hover:underline mr-1 text-[13px] sm:text-[14px]"
                >
                  הוסף חיבור
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <select
                    value={selectedConnection}
                    onChange={(e) => setSelectedConnection(e.target.value)}
                    className={`w-full h-[44px] sm:h-[46px] md:h-[48px] lg:h-[40px] xl:h-[42px] 2xl:h-[44px] px-[12px] sm:px-[14px] md:px-[16px] lg:px-[14px] rounded-[10px] text-[13px] sm:text-[14px] md:text-[15px] lg:text-[13px] xl:text-[14px] outline-none appearance-none cursor-pointer ${
                      darkMode ? 'bg-[#142241] text-white' : 'bg-white text-[#030733]'
                    }`}
                  >
                    {connections.map((conn) => (
                      <option key={conn.id} value={conn.id}>
                        {conn.display_name || conn.phone_number || conn.session_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={`absolute left-[12px] sm:left-[14px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] sm:w-[15px] sm:h-[15px] md:w-[16px] md:h-[16px] pointer-events-none ${darkMode ? 'text-gray-400' : 'text-[#030733]'}`} />
                </div>

                {/* Daily Limit Stats - Always show 90 as base limit */}
                {(() => {
                  const BASE_LIMIT = 90
                  let sent = 0

                  if (selectedConnection && deviceDailyLimits[selectedConnection]) {
                    sent = deviceDailyLimits[selectedConnection].sent
                  }

                  const remaining = Math.max(0, BASE_LIMIT - sent)
                  const exceeded = sent > BASE_LIMIT ? sent - BASE_LIMIT : 0
                  const isExceeded = exceeded > 0
                  const isWarning = !isExceeded && remaining <= 10

                  return (
                    <div className={`flex items-center gap-[12px] mt-[8px] text-[13px] font-medium ${
                      isExceeded ? 'text-red-500' : isWarning ? 'text-orange-500' : darkMode ? 'text-green-400' : 'text-green-600'
                    }`}>
                      <span>נשלחו: {sent}</span>
                      <span>נשארו: {remaining}</span>
                      {isExceeded && (
                        <span className="text-red-500 font-medium">חריגה: {exceeded}</span>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Load Method */}
          <div>
            <p className={`text-[14px] sm:text-[15px] md:text-[16px] lg:text-[16px] xl:text-[17px] font-semibold mb-[6px] md:mb-[7px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              איך תרצה לטעון את רשימת הנמענים?
            </p>
            {/* First select - Source type */}
            <div className="relative mb-[6px] md:mb-[8px]">
              <select
                value={loadMethodDetails}
                onChange={(e) => {
                  setLoadMethodDetails(e.target.value)
                  setLoadMethod('') // Reset second select when first changes
                }}
                className={`w-full h-[44px] sm:h-[46px] md:h-[48px] lg:h-[40px] xl:h-[42px] 2xl:h-[44px] px-[12px] sm:px-[14px] md:px-[16px] lg:px-[14px] rounded-[10px] text-[13px] sm:text-[14px] md:text-[15px] lg:text-[13px] xl:text-[14px] outline-none appearance-none cursor-pointer ${
                  darkMode ? 'bg-[#142241] text-gray-400' : 'bg-white text-[#a2a2a2]'
                } ${loadMethodDetails ? (darkMode ? 'text-white' : 'text-[#030733]') : ''}`}
              >
                <option value="">בחר שיטת טעינה</option>
                <option value="excel">קובץ Excel</option>
                <option value="manual">הזנה ידנית</option>
                <option value="contactList">רשימת לקוחות קיימת</option>
                <option value="sheets">Google Sheets</option>
              </select>
              <ChevronDown className={`absolute left-[12px] sm:left-[14px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] sm:w-[15px] sm:h-[15px] md:w-[16px] md:h-[16px] pointer-events-none ${darkMode ? 'text-gray-400' : 'text-[#030733]'}`} />
            </div>

            {/* Second section - depends on first selection */}
            {loadMethodDetails === 'excel' && (
              <label className={`w-full h-[44px] sm:h-[46px] md:h-[48px] lg:h-[40px] xl:h-[42px] 2xl:h-[44px] px-[12px] sm:px-[14px] md:px-[16px] lg:px-[14px] rounded-[10px] text-[13px] sm:text-[14px] md:text-[15px] lg:text-[13px] xl:text-[14px] flex items-center justify-center cursor-pointer border-2 border-dashed ${
                darkMode ? 'bg-[#142241] border-gray-600 text-gray-400 hover:border-gray-400' : 'bg-white border-gray-300 text-[#a2a2a2] hover:border-gray-400'
              }`}>
                <Upload className="w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] md:w-[20px] md:h-[20px] ml-2" />
                <span>לחץ להעלאת קובץ Excel</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
              </label>
            )}

            {loadMethodDetails === 'sheets' && (
              <div className="flex flex-col gap-[6px] md:gap-[8px]">
                <div className="flex gap-[6px] sm:gap-[8px]">
                  <input
                    type="text"
                    value={sheetsUrl}
                    onChange={(e) => setSheetsUrl(e.target.value)}
                    placeholder="הדבק קישור ל-Google Sheets"
                    className={`flex-1 h-[44px] sm:h-[46px] md:h-[48px] lg:h-[40px] xl:h-[42px] 2xl:h-[44px] px-[12px] sm:px-[14px] md:px-[16px] lg:px-[14px] rounded-[10px] text-[13px] sm:text-[14px] md:text-[15px] lg:text-[13px] xl:text-[14px] outline-none ${
                      darkMode ? 'bg-[#142241] text-white placeholder-gray-400' : 'bg-white text-[#030733] placeholder-[#a2a2a2]'
                    }`}
                  />
                  <button
                    onClick={handleLoadGoogleSheets}
                    disabled={sheetsLoading || !sheetsUrl.trim()}
                    className={`h-[44px] sm:h-[46px] md:h-[48px] lg:h-[40px] xl:h-[42px] 2xl:h-[44px] px-[14px] sm:px-[16px] md:px-[18px] lg:px-[16px] rounded-[10px] text-[13px] sm:text-[14px] md:text-[15px] lg:text-[13px] xl:text-[14px] font-medium transition-colors disabled:opacity-50 ${
                      darkMode ? 'bg-[#030733] text-white hover:bg-[#0a1628]' : 'bg-[#030733] text-white hover:bg-[#1a2d4a]'
                    }`}
                  >
                    {sheetsLoading ? 'טוען...' : 'טען'}
                  </button>
                </div>
                <p className={`text-[10px] sm:text-[11px] md:text-[12px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  הגיליון חייב להיות ציבורי (כל מי שיש לו את הקישור יכול לצפות)
                </p>
              </div>
            )}

            {loadMethodDetails === 'manual' && (
              <button
                onClick={() => setShowManualEntryPopup(true)}
                className={`w-full h-[44px] sm:h-[46px] md:h-[48px] lg:h-[40px] xl:h-[42px] 2xl:h-[44px] px-[12px] sm:px-[14px] md:px-[16px] lg:px-[14px] rounded-[10px] text-[13px] sm:text-[14px] md:text-[15px] lg:text-[13px] xl:text-[14px] font-medium ${
                  darkMode ? 'bg-[#142241] text-white hover:bg-[#1a2d4a]' : 'bg-white text-[#030733] hover:bg-gray-100'
                }`}
              >
                פתח חלון הזנה ידנית
              </button>
            )}

            {loadMethodDetails === 'contactList' && (
              <div className="relative">
                <select
                  disabled
                  className={`w-full h-[40px] px-[14px] rounded-[10px] text-[13px] outline-none appearance-none cursor-not-allowed opacity-50 ${
                    darkMode ? 'bg-[#142241] text-gray-500' : 'bg-white text-gray-400'
                  }`}
                >
                  <option value="">בחר רשימת לקוחות (בקרוב)</option>
                  {contactLists.map((list) => (
                    <option key={list.id} value={list.id}>{list.name} ({list.contact_count} אנשי קשר)</option>
                  ))}
                </select>
                <ChevronDown className={`absolute left-[14px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] pointer-events-none text-gray-400`} />
                <p className={`text-[11px] mt-[4px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  אפשרות זו תהיה זמינה בקרוב
                </p>
              </div>
            )}
          </div>

          {/* Checkbox 1 - Exclusion List */}
          <div className="flex flex-col gap-[6px]">
            <div className="flex items-center gap-[6px]">
              <Checkbox checked={hasExclusionList} onChange={setHasExclusionList} />
              <span className={`text-[16px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                רשימת אי-הכללה
              </span>
              {exclusionList.length > 0 && (
                <span className={`text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                  ({exclusionList.length} מספרים)
                </span>
              )}
            </div>
            {hasExclusionList && (
              <>
                <div className="relative">
                  <select
                    value={exclusionLoadMethod}
                    onChange={(e) => setExclusionLoadMethod(e.target.value)}
                    className={`w-full h-[40px] px-[14px] rounded-[10px] text-[13px] outline-none appearance-none cursor-pointer ${
                      darkMode ? 'bg-[#142241] text-gray-400' : 'bg-white text-[#a2a2a2]'
                    } ${exclusionLoadMethod ? (darkMode ? 'text-white' : 'text-[#030733]') : ''}`}
                  >
                    <option value="">בחר שיטת טעינה</option>
                    <option value="excel">קובץ Excel</option>
                    <option value="manual">הזנה ידנית</option>
                    <option value="sheets">Google Sheets</option>
                    <option value="contactList">רשימת לקוחות קיימת</option>
                  </select>
                  <ChevronDown className={`absolute left-[14px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] pointer-events-none ${darkMode ? 'text-gray-400' : 'text-[#030733]'}`} />
                </div>

                {exclusionLoadMethod === 'excel' && (
                  <label className={`w-full h-[40px] px-[14px] rounded-[10px] text-[13px] flex items-center justify-center cursor-pointer border-2 border-dashed ${
                    darkMode ? 'bg-[#142241] border-gray-600 text-gray-400 hover:border-gray-400' : 'bg-white border-gray-300 text-[#a2a2a2] hover:border-gray-400'
                  }`}>
                    <span>לחץ להעלאת קובץ Excel</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleExclusionExcelUpload}
                      className="hidden"
                    />
                  </label>
                )}

                {exclusionLoadMethod === 'manual' && (
                  <button
                    onClick={() => setShowExclusionManualPopup(true)}
                    className={`w-full h-[40px] px-[14px] rounded-[10px] text-[13px] font-medium ${
                      darkMode ? 'bg-[#142241] text-white hover:bg-[#1a2d4a]' : 'bg-white text-[#030733] hover:bg-gray-100'
                    }`}
                  >
                    פתח חלון הזנה ידנית
                  </button>
                )}

                {exclusionLoadMethod === 'sheets' && (
                  <div className="flex flex-col gap-[6px]">
                    <div className="flex gap-[6px]">
                      <input
                        type="text"
                        value={exclusionSheetsUrl}
                        onChange={(e) => setExclusionSheetsUrl(e.target.value)}
                        placeholder="הדבק קישור ל-Google Sheets"
                        className={`flex-1 h-[40px] px-[14px] rounded-[10px] text-[13px] outline-none ${
                          darkMode ? 'bg-[#142241] text-white placeholder-gray-400' : 'bg-white text-[#030733] placeholder-[#a2a2a2]'
                        }`}
                      />
                      <button
                        onClick={handleExclusionLoadGoogleSheets}
                        disabled={exclusionSheetsLoading || !exclusionSheetsUrl.trim()}
                        className={`h-[40px] px-[16px] rounded-[10px] text-[13px] font-medium transition-colors disabled:opacity-50 ${
                          darkMode ? 'bg-[#030733] text-white hover:bg-[#0a1628]' : 'bg-[#030733] text-white hover:bg-[#1a2d4a]'
                        }`}
                      >
                        {exclusionSheetsLoading ? 'טוען...' : 'טען'}
                      </button>
                    </div>
                    <p className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      הגיליון חייב להיות ציבורי (כל מי שיש לו את הקישור יכול לצפות)
                    </p>
                  </div>
                )}

                {exclusionLoadMethod === 'contactList' && (
                  <div className="relative">
                    <select
                      disabled
                      className={`w-full h-[40px] px-[14px] rounded-[10px] text-[13px] outline-none appearance-none cursor-not-allowed opacity-50 ${
                        darkMode ? 'bg-[#142241] text-gray-500' : 'bg-white text-gray-400'
                      }`}
                    >
                      <option value="">בחר רשימת לקוחות (בקרוב)</option>
                      {contactLists.map((list) => (
                        <option key={list.id} value={list.id}>{list.name} ({list.contact_count} אנשי קשר)</option>
                      ))}
                    </select>
                    <ChevronDown className={`absolute left-[14px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] pointer-events-none text-gray-400`} />
                    <p className={`text-[11px] mt-[4px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      אפשרות זו תהיה זמינה בקרוב
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Checkbox 2 - Scheduling */}
          <div className="flex flex-col gap-[6px]">
            <div className="flex items-center gap-[6px]">
              <Checkbox checked={hasScheduling} onChange={setHasScheduling} />
              <span className={`text-[16px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                תזמון ההודעה
              </span>
              <span className={`text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#030733]'}`}>
                (אם לא תזמנת, זה ישלח באותו הרגע)
              </span>
            </div>
            {hasScheduling && (
              <div className="flex gap-[8px]">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={scheduleDate ? scheduleDate.split('-').reverse().join('/') : ''}
                    readOnly
                    placeholder="תאריך הפצה"
                    onClick={(e) => {
                      const hiddenInput = e.currentTarget.nextElementSibling as HTMLInputElement
                      hiddenInput?.showPicker?.()
                    }}
                    className={`w-full h-[38px] pr-[12px] pl-[36px] rounded-[10px] text-[13px] outline-none cursor-pointer ${
                      darkMode ? 'bg-[#142241] text-white placeholder-gray-400' : 'bg-white text-[#030733] placeholder-[#a2a2a2]'
                    }`}
                  />
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="absolute opacity-0 w-0 h-0"
                  />
                  <Calendar className={`absolute left-[12px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] pointer-events-none ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
                </div>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={scheduleTime}
                    readOnly
                    placeholder="שעת הפצה"
                    onClick={(e) => {
                      const hiddenInput = e.currentTarget.nextElementSibling as HTMLInputElement
                      hiddenInput?.showPicker?.()
                    }}
                    className={`w-full h-[38px] pr-[12px] pl-[36px] rounded-[10px] text-[13px] outline-none cursor-pointer ${
                      darkMode ? 'bg-[#142241] text-white placeholder-gray-400' : 'bg-white text-[#030733] placeholder-[#a2a2a2]'
                    }`}
                  />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="absolute opacity-0 w-0 h-0"
                  />
                  <Clock className={`absolute left-[12px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] pointer-events-none ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
                </div>
              </div>
            )}
          </div>

          {/* Checkbox 2.5 - Active Hours */}
          <div className="flex flex-col gap-[6px]">
            <div className="flex items-center gap-[6px]">
              <Checkbox checked={hasActiveHours} onChange={setHasActiveHours} />
              <span className={`text-[16px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                שעות פעילות
              </span>
              <div
                className="relative"
                onMouseEnter={() => setShowActiveHoursTooltip(true)}
                onMouseLeave={() => setShowActiveHoursTooltip(false)}
              >
                <div className={`w-[15px] h-[15px] rounded-full flex items-center justify-center text-[11px] cursor-help ${
                  darkMode ? 'bg-white text-[#030733]' : 'bg-[#030733] text-[#f2f3f8]'
                }`}>
                  ?
                </div>
                {/* Tooltip */}
                {showActiveHoursTooltip && (
                  <div className="absolute right-0 sm:right-[-80px] top-[22px] w-[250px] sm:w-[300px] p-3 sm:p-[15px] bg-[#030733] rounded-[10px] z-50 animate-fade-in" style={{ direction: 'rtl' }}>
                    <p className="text-white text-[12px] sm:text-[14px] font-semibold mb-[6px] sm:mb-[8px]">מה זה שעות פעילות?</p>
                    <p className="text-[#F2F3F8] text-[11px] sm:text-[14px] font-light leading-[1.5] sm:leading-[1.6]">
                      קבע את השעות שבהן ההודעות יישלחו.
                      <br /><br />
                      לדוגמה: אם תקבע &quot;09:00 - 18:00&quot; - המערכת תשלח הודעות רק בין השעות האלו.
                      <br /><br />
                      הודעות שמתוזמנות מחוץ לשעות אלו ימתינו עד שעת הפעילות הבאה.
                      <br /><br />
                      זה עוזר להימנע משליחת הודעות בשעות לא נוחות ומשפר את שיעור התגובה.
                    </p>
                  </div>
                )}
              </div>
            </div>
            {hasActiveHours && (
              <div className="flex gap-[12px] items-center flex-wrap">
                <span className={`text-[14px] font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>משעה</span>
                <div className="relative">
                  <input
                    type="text"
                    value={activeHoursStart}
                    readOnly
                    placeholder="09:00"
                    onClick={(e) => {
                      const hiddenInput = e.currentTarget.nextElementSibling as HTMLInputElement
                      hiddenInput?.showPicker?.()
                    }}
                    className={`w-[100px] h-[44px] pr-[14px] pl-[40px] rounded-[10px] text-[15px] outline-none cursor-pointer text-center ${
                      darkMode ? 'bg-[#142241] text-white placeholder-gray-400' : 'bg-white text-[#030733] placeholder-[#a2a2a2]'
                    }`}
                  />
                  <input
                    type="time"
                    value={activeHoursStart}
                    onChange={(e) => setActiveHoursStart(e.target.value)}
                    className="absolute opacity-0 w-0 h-0"
                  />
                  <Clock className={`absolute left-[14px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] pointer-events-none ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
                </div>
                <span className={`text-[14px] font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>עד שעה</span>
                <div className="relative">
                  <input
                    type="text"
                    value={activeHoursEnd}
                    readOnly
                    placeholder="18:00"
                    onClick={(e) => {
                      const hiddenInput = e.currentTarget.nextElementSibling as HTMLInputElement
                      hiddenInput?.showPicker?.()
                    }}
                    className={`w-[100px] h-[44px] pr-[14px] pl-[40px] rounded-[10px] text-[15px] outline-none cursor-pointer text-center ${
                      darkMode ? 'bg-[#142241] text-white placeholder-gray-400' : 'bg-white text-[#030733] placeholder-[#a2a2a2]'
                    }`}
                  />
                  <input
                    type="time"
                    value={activeHoursEnd}
                    onChange={(e) => setActiveHoursEnd(e.target.value)}
                    className="absolute opacity-0 w-0 h-0"
                  />
                  <Clock className={`absolute left-[14px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] pointer-events-none ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
                </div>
              </div>
            )}
          </div>

          {/* Checkbox 3 - Pause */}
          <div className="flex flex-col gap-[6px]">
            <div className="flex items-center gap-[6px]">
              <Checkbox checked={hasPause} onChange={setHasPause} />
              <span className={`text-[16px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                הפוגה בשליחה
              </span>
              <div
                className="relative"
                onMouseEnter={() => setShowPauseTooltip(true)}
                onMouseLeave={() => setShowPauseTooltip(false)}
              >
                <div className={`w-[15px] h-[15px] rounded-full flex items-center justify-center text-[11px] cursor-help ${
                  darkMode ? 'bg-white text-[#030733]' : 'bg-[#030733] text-[#f2f3f8]'
                }`}>
                  ?
                </div>
                {/* Tooltip */}
                {showPauseTooltip && (
                  <div className="absolute right-0 sm:right-[-80px] top-[22px] w-[250px] sm:w-[300px] p-3 sm:p-[15px] bg-[#030733] rounded-[10px] z-50 animate-fade-in" style={{ direction: 'rtl' }}>
                    <p className="text-white text-[12px] sm:text-[14px] font-semibold mb-[6px] sm:mb-[8px]">מה זה הפוגה בשליחה?</p>
                    <p className="text-[#F2F3F8] text-[11px] sm:text-[14px] font-light leading-[1.5] sm:leading-[1.6]">
                      אפשרות זו מאפשרת להגדיר הפסקות אוטומטיות במהלך ההפצה.
                      <br /><br />
                      לדוגמה: אם תגדירו &quot;לאחר כל 20 הודעות, השהיה של 60 שניות&quot; -
                      המערכת תשלח 20 הודעות, תעצור לדקה, ואז תמשיך לשלוח עוד 20 הודעות, וחוזר חלילה.
                      <br /><br />
                      זה עוזר למנוע חסימות מצד WhatsApp ומגביר את אמינות ההפצה.
                    </p>
                  </div>
                )}
              </div>
            </div>
            {hasPause && (
              <div className="flex items-center gap-[6px] flex-wrap">
                <span className={`text-[12px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>לאחר כל</span>
                <input
                  type="number"
                  value={pauseAfterMessages || ''}
                  onChange={(e) => setPauseAfterMessages(Number(e.target.value))}
                  className={`w-[40px] h-[38px] rounded-[8px] text-[13px] text-center outline-none ${
                    darkMode ? 'bg-[#142241] text-white' : 'bg-white text-[#030733]'
                  }`}
                />
                <span className={`text-[12px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>הודעות, השהיה של</span>
                <input
                  type="number"
                  value={pauseDuration || ''}
                  onChange={(e) => setPauseDuration(Number(e.target.value))}
                  className={`w-[40px] h-[38px] rounded-[8px] text-[13px] text-center outline-none ${
                    darkMode ? 'bg-[#142241] text-white' : 'bg-white text-[#030733]'
                  }`}
                />
                <div className="relative">
                  <select
                    value={pauseTimeUnit}
                    onChange={(e) => setPauseTimeUnit(e.target.value as 'seconds' | 'minutes' | 'hours')}
                    className={`h-[38px] pl-[28px] pr-[10px] rounded-[8px] text-[12px] text-right outline-none appearance-none cursor-pointer ${
                      darkMode ? 'bg-[#142241] text-white' : 'bg-white text-[#030733]'
                    }`}
                  >
                    <option value="seconds">שניות</option>
                    <option value="minutes">דקות</option>
                    <option value="hours">שעות</option>
                  </select>
                  <ChevronDown className={`absolute left-[8px] top-1/2 -translate-y-1/2 w-[12px] h-[12px] pointer-events-none ${darkMode ? 'text-gray-400' : 'text-[#030733]'}`} />
                </div>
              </div>
            )}
          </div>

          {/* Checkbox 4 - Create New List */}
          <div className="flex flex-col gap-[6px]">
            <div className="flex items-center gap-[6px]">
              <Checkbox checked={createNewList} onChange={setCreateNewList} />
              <span className={`text-[16px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                צור רשימת לקוחות חדשה מהפצה זו
              </span>
            </div>
            {createNewList && (
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="בחרו שם לרשימה"
                className={`w-full h-[38px] px-[12px] rounded-[10px] text-[13px] outline-none ${
                  darkMode ? 'bg-[#142241] text-white placeholder-gray-400' : 'bg-white text-[#030733] placeholder-[#a2a2a2]'
                }`}
              />
            )}
          </div>

          {/* Checkbox 5 - Assign to Existing List */}
          <div className="flex flex-col gap-[6px]">
            <div className="flex items-center gap-[6px]">
              <Checkbox checked={assignToExistingList} onChange={setAssignToExistingList} />
              <span className={`text-[16px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                שייך את הנמענים לרשימת לקוחות קיימת
              </span>
            </div>
            {assignToExistingList && (
              <div className="relative">
                <select
                  value={selectedExistingList}
                  onChange={(e) => setSelectedExistingList(e.target.value)}
                  className={`w-full h-[38px] px-[12px] rounded-[10px] text-[13px] outline-none appearance-none cursor-pointer ${
                    darkMode ? 'bg-[#142241] text-gray-400' : 'bg-white text-[#a2a2a2]'
                  }`}
                >
                  <option value="">בחרו מרשימה שכבר קיימת במערכת</option>
                  {contactLists.map((list) => (
                    <option key={list.id} value={list.id}>{list.name}</option>
                  ))}
                </select>
                <ChevronDown className={`absolute left-[12px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] pointer-events-none ${darkMode ? 'text-gray-400' : 'text-[#030733]'}`} />
              </div>
            )}
          </div>

          {/* Timing Info Accordion */}
          <div className="mt-[10px]">
            <button
              onClick={() => setShowTimingInfo(!showTimingInfo)}
              className={`flex items-center gap-[6px] text-[14px] ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-[#595C7A] hover:text-[#030733]'} transition-colors`}
            >
              {showTimingInfo ? (
                <ChevronUp className="w-[16px] h-[16px]" />
              ) : (
                <ChevronDown className="w-[16px] h-[16px]" />
              )}
              <span>הסבר על זמני הדיוור</span>
            </button>
            {showTimingInfo && (
              <div className={`mt-[10px] p-[15px] rounded-[10px] ${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#f8f9fc]'} animate-slide-down`}>
                <p className={`text-[13px] leading-[1.8] ${darkMode ? 'text-gray-300' : 'text-[#595C7A]'}`}>
                  המערכת פועלת בצורה חכמה כדי להבטיח שההודעות שלכם יגיעו ליעד בצורה בטוחה ואמינה.
                  <br /><br />
                  <strong className={darkMode ? 'text-white' : 'text-[#030733]'}>תזמון אקראי:</strong> בין כל הודעה להודעה, המערכת ממתינה פרק זמן אקראי. זה מחקה התנהגות אנושית טבעית ומונע זיהוי כספאם.
                  <br /><br />
                  <strong className={darkMode ? 'text-white' : 'text-[#030733]'}>הפסקות אוטומטיות:</strong> לאחר שליחת מספר מסוים של הודעות, המערכת עוצרת לזמן קצר ואז ממשיכה. זה מגביר את אמינות החשבון שלכם.
                  <br /><br />
                  <strong className={darkMode ? 'text-white' : 'text-[#030733]'}>התאמה דינמית:</strong> המערכת מתאימה את קצב השליחה בהתאם לתגובות מ-WhatsApp, כדי למקסם את כמות ההודעות שמגיעות בהצלחה.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE - White Box with Recipients */}
        <div className={`w-full lg:flex-1 lg:min-w-[500px] lg:max-w-[800px] xl:max-w-[850px] 2xl:max-w-[900px] min-h-[250px] sm:min-h-[280px] md:min-h-[300px] max-h-[400px] sm:max-h-[450px] md:max-h-[500px] lg:max-h-none lg:min-h-[350px] xl:min-h-[400px] ${darkMode ? 'bg-[#142241]' : 'bg-white'} rounded-[12px] sm:rounded-[13px] md:rounded-[14px] lg:rounded-[15px] flex flex-col overflow-hidden shadow-sm`}>
          {/* Tabs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-[8px] md:gap-[9px] lg:gap-[10px] pt-3 sm:pt-[16px] md:pt-[18px] lg:pt-[20px] px-3 sm:px-[16px] md:px-[19px] lg:px-[22px]">
            <button
              onClick={() => setActiveTab('recipients')}
              className={`w-full sm:w-[300px] md:w-[320px] lg:w-[350px] h-[44px] sm:h-[46px] md:h-[48px] lg:h-auto py-[10px] sm:py-[10px] md:py-[11px] lg:py-[11px] rounded-[10px] text-[13px] sm:text-[14px] md:text-[15px] lg:text-[16px] transition-colors ${
                activeTab === 'recipients'
                  ? 'bg-[#030733] text-white font-semibold'
                  : darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-[#f2f3f8] text-[#030733]'
              }`}
            >
              רשימת הלקוחות שטענת
            </button>
            <button
              onClick={() => setActiveTab('exclusion')}
              className={`w-full sm:w-[200px] md:w-[220px] lg:w-[235px] h-[44px] sm:h-[46px] md:h-[48px] lg:h-auto py-[10px] sm:py-[10px] md:py-[11px] lg:py-[11px] rounded-[10px] text-[13px] sm:text-[14px] md:text-[15px] lg:text-[16px] transition-colors ${
                activeTab === 'exclusion'
                  ? 'bg-[#030733] text-white font-semibold'
                  : darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-[#f2f3f8] text-[#030733]'
              }`}
            >
              רשימת אי הכללה שטענת
            </button>
          </div>

          {/* Search and Actions */}
          <div className="flex items-center gap-[4px] sm:gap-[6px] md:gap-[8px] px-3 sm:px-[16px] md:px-[19px] lg:px-[22px] py-2 sm:py-[10px] md:py-[12px]">
            {/* Search - shrinks to icon when settings are open (rightmost in RTL) */}
            <div className={`h-[44px] sm:h-[46px] md:h-[47px] ${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#f2f3f8]'} rounded-[8px] flex items-center transition-all duration-300 ${
              showAdvancedSettings ? 'w-[44px] sm:w-[46px] md:w-[47px] justify-center px-0' : 'flex-1 px-[12px] sm:px-[14px] md:px-[15px]'
            }`}>
              {!showAdvancedSettings && (
                <input
                  type="text"
                  value={activeTab === 'recipients' ? searchQuery : exclusionSearchQuery}
                  onChange={(e) => activeTab === 'recipients' ? setSearchQuery(e.target.value) : setExclusionSearchQuery(e.target.value)}
                  placeholder={activeTab === 'recipients' ? 'חפש נמענים' : 'חפש מספר...'}
                  className={`flex-1 bg-transparent outline-none text-[13px] sm:text-[14px] md:text-[15px] ${
                    darkMode ? 'text-white placeholder-gray-400' : 'text-[#505050] placeholder-[#505050]'
                  }`}
                />
              )}
              <Search className={`w-[18px] h-[18px] sm:w-[19px] sm:h-[19px] md:w-[20px] md:h-[20px] ${darkMode ? 'text-white' : 'text-[#030733]'} flex-shrink-0`} />
            </div>

            {/* Settings button - to the left of search, expands when active with X inside */}
            <div
              className={`relative ${showAdvancedSettings ? 'flex-1' : ''}`}
              onMouseEnter={() => !showAdvancedSettings && setShowSettingsTooltip(true)}
              onMouseLeave={() => setShowSettingsTooltip(false)}
            >
              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className={`h-[44px] sm:h-[46px] md:h-[47px] rounded-[8px] flex items-center transition-all duration-500 ease-out ${
                  showAdvancedSettings
                    ? 'bg-[#030733] w-full px-[10px] sm:px-[12px] flex-row-reverse justify-between'
                    : darkMode ? 'bg-[#1a2d4a] w-[44px] sm:w-[46px] md:w-[47px] justify-center' : 'bg-[#f2f3f8] w-[44px] sm:w-[46px] md:w-[47px] justify-center'
                }`}
              >
                {/* X on the left side (appears left due to flex-row-reverse) */}
                {showAdvancedSettings && (
                  <X className="w-[16px] h-[16px] sm:w-[17px] sm:h-[17px] md:w-[18px] md:h-[18px] text-white flex-shrink-0" />
                )}
                {/* Gear icon + text grouped together on the right */}
                <div className={`flex items-center gap-[3px] ${showAdvancedSettings ? '' : 'contents'}`}>
                  <svg width="20" height="20" viewBox="0 0 23 23" fill="none" className="flex-shrink-0 sm:w-[21px] sm:h-[21px] md:w-[23px] md:h-[23px]">
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.6167 2.15625C9.73793 2.15625 8.98851 2.79162 8.8438 3.65796L8.67322 4.68529C8.65405 4.80029 8.56301 4.93446 8.3886 5.01879C8.06022 5.17664 7.74434 5.35925 7.44368 5.56504C7.2846 5.67525 7.1236 5.68579 7.01243 5.64458L6.0378 5.2785C5.63937 5.12923 5.20089 5.12618 4.80042 5.26991C4.39995 5.41364 4.06347 5.69481 3.85089 6.06337L2.9673 7.59383C2.75464 7.96218 2.67953 8.39402 2.75534 8.81253C2.83114 9.23105 3.05295 9.60911 3.3813 9.87946L4.1863 10.5426C4.27735 10.6174 4.34922 10.7621 4.33389 10.9547C4.30658 11.318 4.30658 11.6829 4.33389 12.0462C4.34826 12.2379 4.27735 12.3836 4.18726 12.4583L3.3813 13.1215C3.05295 13.3918 2.83114 13.7699 2.75534 14.1884C2.67953 14.6069 2.75464 15.0388 2.9673 15.4071L3.85089 16.9376C4.06362 17.306 4.40016 17.5869 4.80062 17.7305C5.20108 17.874 5.63948 17.8709 6.0378 17.7215L7.01435 17.3554C7.12455 17.3142 7.28555 17.3257 7.4456 17.434C7.7446 17.6391 8.05989 17.8221 8.38955 17.9802C8.56397 18.0646 8.65501 18.1987 8.67418 18.3157L8.84476 19.342C8.98947 20.2084 9.73889 20.8438 10.6177 20.8438H12.3848C13.2627 20.8438 14.0131 20.2084 14.1578 19.342L14.3283 18.3147C14.3475 18.1997 14.4376 18.0655 14.613 17.9802C14.9426 17.8221 15.2579 17.6391 15.5569 17.434C15.717 17.3247 15.878 17.3142 15.9882 17.3554L16.9657 17.7215C17.3639 17.8703 17.8019 17.873 18.202 17.7293C18.602 17.5856 18.9382 17.3048 19.1507 16.9366L20.0352 15.4062C20.2479 15.0378 20.323 14.606 20.2472 14.1875C20.1714 13.7689 19.9496 13.3909 19.6212 13.1205L18.8162 12.4574C18.7252 12.3826 18.6533 12.2379 18.6686 12.0453C18.6959 11.682 18.6959 11.3171 18.6686 10.9537C18.6533 10.7621 18.7252 10.6164 18.8153 10.5417L19.6203 9.8785C20.2988 9.32075 20.4741 8.35475 20.0352 7.59287L19.1516 6.06242C18.9389 5.69402 18.6024 5.41305 18.2019 5.2695C17.8014 5.12596 17.363 5.12915 16.9647 5.2785L15.9872 5.64458C15.878 5.68579 15.717 5.67429 15.5569 5.56504C15.2566 5.35928 14.941 5.17667 14.613 5.01879C14.4376 4.93542 14.3475 4.80125 14.3283 4.68529L14.1568 3.65796C14.0869 3.23827 13.8704 2.857 13.5457 2.58201C13.2211 2.30701 12.8094 2.15614 12.3839 2.15625H10.6177H10.6167ZM11.5003 15.0938C12.4534 15.0938 13.3675 14.7151 14.0415 14.0412C14.7154 13.3672 15.0941 12.4531 15.0941 11.5C15.0941 10.5469 14.7154 9.63279 14.0415 8.95883C13.3675 8.28488 12.4534 7.90625 11.5003 7.90625C10.5472 7.90625 9.6331 8.28488 8.95914 8.95883C8.28518 9.63279 7.90655 10.5469 7.90655 11.5C7.90655 12.4531 8.28518 13.3672 8.95914 14.0412C9.6331 14.7151 10.5472 15.0938 11.5003 15.0938Z" fill={showAdvancedSettings ? 'white' : '#949494'}/>
                  </svg>
                  {showAdvancedSettings && (
                    <span className="text-white text-[14px] sm:text-[15px] md:text-[16px] whitespace-nowrap">הגדרות מתקדמות</span>
                  )}
                </div>
              </button>
              {/* Settings Tooltip */}
              {showSettingsTooltip && !showAdvancedSettings && (
                <div className="absolute left-0 top-[55px] w-[280px] sm:w-[372px] p-3 sm:p-4 bg-[#030733] rounded-[10px] z-50 animate-fade-in" style={{ direction: 'rtl' }}>
                  <p className="text-white text-[14px] sm:text-[16px] font-semibold mb-[6px] sm:mb-[8px]">הגדרות מתקדמות</p>
                  <p className="text-[#BDBDBD] text-[12px] sm:text-[14px] leading-[1.5] sm:leading-[1.6]">
                    כאן תוכל להסתכל ולערוך הגדרות מתקדמות בקמפיין, כגון:<br/>
                    מילות הסרה, מספרים כפולים, הגדרות הפצה וכדומה.
                  </p>
                </div>
              )}
            </div>

            {/* Select All button - hidden when in advanced settings */}
            {!showAdvancedSettings && activeTab === 'recipients' && filteredRecipients.length > 0 && (
              <button
                onClick={selectAllRecipients}
                className={`h-[47px] px-[12px] rounded-[8px] flex items-center justify-center text-[13px] font-medium ${
                  selectedRecipients.size === filteredRecipients.length
                    ? 'bg-[#030733] text-white'
                    : darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-[#f2f3f8] text-[#030733]'
                }`}
              >
                {selectedRecipients.size === filteredRecipients.length ? 'בטל בחירה' : 'בחר הכל'}
              </button>
            )}
            {!showAdvancedSettings && activeTab === 'exclusion' && filteredExclusionList.length > 0 && (
              <button
                onClick={selectAllExclusions}
                className={`h-[47px] px-[12px] rounded-[8px] flex items-center justify-center text-[13px] font-medium ${
                  selectedExclusions.size === filteredExclusionList.length
                    ? 'bg-[#030733] text-white'
                    : darkMode ? 'bg-[#1a2d4a] text-white' : 'bg-[#f2f3f8] text-[#030733]'
                }`}
              >
                {selectedExclusions.size === filteredExclusionList.length ? 'בטל בחירה' : 'בחר הכל'}
              </button>
            )}

            {/* Delete selected button - hidden when in advanced settings */}
            {!showAdvancedSettings && (
              <button
                onClick={activeTab === 'recipients' ? deleteSelectedRecipients : deleteSelectedExclusions}
                disabled={activeTab === 'recipients' ? selectedRecipients.size === 0 : selectedExclusions.size === 0}
                className={`w-[47px] h-[47px] rounded-[8px] flex items-center justify-center transition-colors ${
                  (activeTab === 'recipients' ? selectedRecipients.size > 0 : selectedExclusions.size > 0)
                    ? 'bg-[#cd1b1b] cursor-pointer'
                    : darkMode ? 'bg-[#1a2d4a] cursor-not-allowed' : 'bg-[#f2f3f8] cursor-not-allowed'
                }`}
                title="מחק נבחרים"
              >
                <Trash2 className={`w-[20px] h-[20px] ${(activeTab === 'recipients' ? selectedRecipients.size > 0 : selectedExclusions.size > 0) ? 'text-white' : darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              </button>
            )}

            {/* Selected count badge - hidden when in advanced settings */}
            {!showAdvancedSettings && activeTab === 'recipients' && selectedRecipients.size > 0 && (
              <span className={`text-[13px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                {selectedRecipients.size} נבחרו
              </span>
            )}
            {!showAdvancedSettings && activeTab === 'exclusion' && selectedExclusions.size > 0 && (
              <span className={`text-[13px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                {selectedExclusions.size} נבחרו
              </span>
            )}
          </div>

          {/* Recipients/Exclusion Area or Advanced Settings */}
          <div className="flex-1 px-[22px] pb-[20px] overflow-y-auto overflow-x-auto">
            {showAdvancedSettings ? (
              // Advanced Settings View
              <div className="h-full flex flex-col">
                {/* Settings Content - Scrollable */}
                <div className="flex-1 overflow-y-auto space-y-[24px]">
                  {/* מילות הסרה - Removal Words */}
                  <div>
                    <p className={`text-[20px] font-semibold mb-[12px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                      מילות הסרה
                    </p>
                    {/* Input for adding words */}
                    <div className={`h-[47px] px-[16px] rounded-[10px] mb-[12px] flex items-center ${
                      darkMode ? 'bg-[#1a2d4a]' : 'bg-[#F2F3F8]'
                    }`}>
                      <input
                        type="text"
                        placeholder="רוצה להוסיף מילה? כתוב אותה כאן..."
                        value={removalWordInput}
                        onChange={(e) => setRemovalWordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && removalWordInput.trim()) {
                            setRemovalWords([...removalWords, removalWordInput.trim()])
                            setRemovalWordInput('')
                          }
                        }}
                        className={`flex-1 bg-transparent text-[14px] outline-none ${
                          darkMode ? 'text-white placeholder:text-gray-500' : 'text-[#030733] placeholder:text-[#A2A2A2]'
                        }`}
                      />
                    </div>
                    {/* Tags */}
                    <div className="flex flex-wrap gap-[8px]">
                      {removalWords.map((word, index) => (
                        <div
                          key={index}
                          className={`h-[37px] flex items-center gap-[3px] px-[23px] py-[4px] rounded-[5px] ${
                            darkMode ? 'bg-[#1a2d4a]' : 'bg-[#F2F3F8]'
                          }`}
                        >
                          <button
                            onClick={() => setRemovalWords(removalWords.filter((_, i) => i !== index))}
                            className={`${darkMode ? 'text-white' : 'text-[#030733]'}`}
                          >
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                              <path fillRule="evenodd" clipRule="evenodd" d="M2.96256 2.96328C3.03873 2.88721 3.14199 2.84448 3.24964 2.84448C3.3573 2.84448 3.46055 2.88721 3.53673 2.96328L6.49964 5.9262L9.46256 2.96328C9.49975 2.92337 9.5446 2.89136 9.59443 2.86915C9.64427 2.84695 9.69806 2.83501 9.75261 2.83405C9.80716 2.83309 9.86134 2.84312 9.91192 2.86355C9.96251 2.88398 10.0085 2.9144 10.047 2.95297C10.0856 2.99155 10.116 3.0375 10.1365 3.08809C10.1569 3.13867 10.1669 3.19285 10.166 3.2474C10.165 3.30195 10.1531 3.35574 10.1309 3.40558C10.1087 3.45541 10.0766 3.50026 10.0367 3.53745L7.07381 6.50037L10.0367 9.46328C10.0766 9.50048 10.1087 9.54533 10.1309 9.59516C10.1531 9.64499 10.165 9.69879 10.166 9.75333C10.1669 9.80788 10.1569 9.86206 10.1365 9.91265C10.116 9.96323 10.0856 10.0092 10.047 10.0478C10.0085 10.0863 9.96251 10.1168 9.91192 10.1372C9.86134 10.1576 9.80716 10.1676 9.75261 10.1667C9.69806 10.1657 9.64427 10.1538 9.59443 10.1316C9.5446 10.1094 9.49975 10.0774 9.46256 10.0375L6.49964 7.07453L3.53673 10.0375C3.45971 10.1092 3.35786 10.1483 3.25261 10.1464C3.14736 10.1446 3.04695 10.1019 2.97251 10.0275C2.89808 9.95306 2.85545 9.85265 2.85359 9.7474C2.85173 9.64215 2.8908 9.5403 2.96256 9.46328L5.92548 6.50037L2.96256 3.53745C2.88648 3.46128 2.84375 3.35802 2.84375 3.25037C2.84375 3.14271 2.88648 3.03946 2.96256 2.96328Z" fill="currentColor"/>
                            </svg>
                          </button>
                          <span className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>{word}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* מספרים כפולים - Duplicate Numbers */}
                  <div>
                    <div className="flex items-center gap-[8px] mb-[12px]">
                      <p className={`text-[20px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                        מספרים כפולים {duplicateCount > 0 && `(${duplicateCount})`}
                      </p>
                      {/* Question mark tooltip */}
                      <div className="relative group">
                        <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[11px] font-normal cursor-help ${
                          darkMode ? 'bg-[#1a2d4a] text-gray-300' : 'bg-[#F2F3F8] text-[#030733]'
                        }`}>
                          ?
                        </div>
                        <div className={`absolute right-0 top-[24px] w-[200px] p-[10px] rounded-[8px] text-[12px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 ${
                          darkMode ? 'bg-[#030733] text-gray-300' : 'bg-[#030733] text-white'
                        }`}>
                          המערכת תזהה מספרים שמופיעים יותר מפעם אחת ותשלח להם הודעה פעם אחת בלבד
                        </div>
                      </div>
                    </div>
                    {/* Checkbox */}
                    <label className="flex items-center gap-[10px] cursor-pointer">
                      <div
                        onClick={() => setSkipDuplicateNumbers(!skipDuplicateNumbers)}
                        className={`w-[18px] h-[18px] rounded-[4px] border-2 cursor-pointer flex items-center justify-center transition-colors ${
                          skipDuplicateNumbers
                            ? 'bg-[#030733] border-[#030733]'
                            : darkMode ? 'border-gray-500 hover:border-gray-300' : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {skipDuplicateNumbers && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.39062 6.2114L4.30239 8.12316L9.0818 3.34375" stroke="white" strokeWidth="0.823529" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <span className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                        הפץ את ההודעה גם למספרים הכפולים
                      </span>
                    </label>
                  </div>

                  {/* הגדרות שליחה - Send Settings */}
                  <div>
                    <p className={`text-[20px] font-semibold mb-[12px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                      הגדרות שליחה
                    </p>
                    <div className="space-y-[10px]">
                      {/* First option */}
                      <label className="flex items-center gap-[10px] cursor-pointer">
                        <div
                          onClick={() => setSendSettingsSchedule(!sendSettingsSchedule)}
                          className={`w-[18px] h-[18px] rounded-[4px] border-2 cursor-pointer flex items-center justify-center transition-colors ${
                            sendSettingsSchedule
                              ? 'bg-[#030733] border-[#030733]'
                              : darkMode ? 'border-gray-500 hover:border-gray-300' : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {sendSettingsSchedule && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2.39062 6.2114L4.30239 8.12316L9.0818 3.34375" stroke="white" strokeWidth="0.823529" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                          הפץ את ההודעה גם ללקוח שהגיב בקמפיין הקודם
                        </span>
                      </label>
                      {/* Second option */}
                      <label className="flex items-center gap-[10px] cursor-pointer">
                        <div
                          onClick={() => setSendSettingsLink(!sendSettingsLink)}
                          className={`w-[18px] h-[18px] rounded-[4px] border-2 cursor-pointer flex items-center justify-center transition-colors ${
                            sendSettingsLink
                              ? 'bg-[#030733] border-[#030733]'
                              : darkMode ? 'border-gray-500 hover:border-gray-300' : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {sendSettingsLink && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2.39062 6.2114L4.30239 8.12316L9.0818 3.34375" stroke="white" strokeWidth="0.823529" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                          הפץ את ההודעה גם ללקוח שהשיב הודעה בחזרה בקמפיין הקודם
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* ריבוי מכשירים - Multi Device */}
                  <div>
                    <div className="flex items-center gap-[8px] mb-[12px]">
                      <p className={`text-[20px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                        ריבוי מכשירים
                      </p>
                      {/* Question mark tooltip */}
                      <div className="relative group">
                        <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[11px] font-normal cursor-help ${
                          darkMode ? 'bg-[#1a2d4a] text-gray-300' : 'bg-[#F2F3F8] text-[#030733]'
                        }`}>
                          ?
                        </div>
                        <div className={`absolute right-0 top-[24px] w-[280px] p-[10px] rounded-[8px] text-[12px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 ${
                          darkMode ? 'bg-[#030733] text-gray-300' : 'bg-[#030733] text-white'
                        }`}>
                          חלק את ההודעות בין מספר מכשירים כדי לשלוח יותר הודעות ביום.
                          <br /><br />
                          כל מכשיר יכול לשלוח עד 90 הודעות ליום.
                        </div>
                      </div>
                    </div>
                    {/* Checkbox to enable */}
                    <label className="flex items-center gap-[10px] cursor-pointer mb-[12px]">
                      <div
                        onClick={() => {
                          setHasMultiDevice(!hasMultiDevice)
                          if (hasMultiDevice) {
                            setSelectedDevices([])
                          }
                        }}
                        className={`w-[18px] h-[18px] rounded-[4px] border-2 cursor-pointer flex items-center justify-center transition-colors ${
                          hasMultiDevice
                            ? 'bg-[#030733] border-[#030733]'
                            : darkMode ? 'border-gray-500 hover:border-gray-300' : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {hasMultiDevice && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.39062 6.2114L4.30239 8.12316L9.0818 3.34375" stroke="white" strokeWidth="0.823529" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <span className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                        הפעל ריבוי מכשירים
                      </span>
                    </label>
                    {/* Device selection */}
                    {hasMultiDevice && (
                      <div className="flex flex-col gap-[8px]">
                        <span className={`text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                          בחר מכשירים להפצה (כל מכשיר = 90 הודעות ליום):
                        </span>
                        <div className="flex flex-col gap-[6px]">
                          {connections.map((conn) => {
                            const isBusy = conn.busy_in_campaign !== null && conn.busy_in_campaign !== undefined
                            const isDisabled = isBusy

                            return (
                            <label
                              key={conn.id}
                              className={`flex items-center gap-[8px] p-[10px] rounded-[8px] transition-colors ${
                                isDisabled
                                  ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
                                  : selectedDevices.includes(conn.id)
                                  ? darkMode ? 'bg-[#0043e0]/20 border border-[#0043e0] cursor-pointer' : 'bg-blue-50 border border-blue-300 cursor-pointer'
                                  : darkMode ? 'bg-[#1a2d4a] hover:bg-[#1a3358] cursor-pointer' : 'bg-[#F2F3F8] hover:bg-gray-200 cursor-pointer'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedDevices.includes(conn.id)}
                                disabled={isDisabled}
                                onChange={(e) => {
                                  if (isDisabled) return
                                  if (e.target.checked) {
                                    setSelectedDevices([...selectedDevices, conn.id])
                                  } else {
                                    setSelectedDevices(selectedDevices.filter(id => id !== conn.id))
                                  }
                                }}
                                className="w-4 h-4 rounded"
                              />
                              <div className="flex-1 flex items-center justify-between">
                                <div className="flex items-center gap-[8px]">
                                  <span className={`text-[13px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                                    {conn.display_name || conn.session_name}
                                  </span>
                                  {conn.phone_number && (
                                    <span className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`} dir="ltr">
                                      ({conn.phone_number})
                                    </span>
                                  )}
                                  <span className={`text-[10px] px-[6px] py-[2px] rounded ${
                                    conn.status === 'connected'
                                      ? 'bg-green-500/20 text-green-500'
                                      : 'bg-red-500/20 text-red-500'
                                  }`}>
                                    {conn.status === 'connected' ? 'מחובר' : 'מנותק'}
                                  </span>
                                  {/* Busy status indicator */}
                                  {isBusy && conn.busy_in_campaign && (
                                    <span className="text-[10px] px-[6px] py-[2px] rounded bg-red-500/20 text-red-500">
                                      🔴 עסוק ב-"{conn.busy_in_campaign.name}"
                                    </span>
                                  )}
                                </div>
                                {/* Daily limit indicator */}
                                {!isBusy && deviceDailyLimits[conn.id] && (
                                  <span className={`text-[11px] font-medium ${
                                    deviceDailyLimits[conn.id].sent >= deviceDailyLimits[conn.id].limit
                                      ? 'text-red-500'
                                      : deviceDailyLimits[conn.id].limit - deviceDailyLimits[conn.id].sent <= 10
                                      ? 'text-orange-500'
                                      : 'text-green-500'
                                  }`}>
                                    נשאר: {deviceDailyLimits[conn.id].limit - deviceDailyLimits[conn.id].sent}/{deviceDailyLimits[conn.id].limit}
                                  </span>
                                )}
                              </div>
                            </label>
                            )
                          })}
                        </div>
                        {selectedDevices.length > 0 && (
                          <div className={`text-[12px] mt-[4px] ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                            נבחרו {selectedDevices.length} מכשירים = עד {calculateDailyMessages()} הודעות ליום
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* וריאציות הודעות - Message Variations */}
                  <div>
                    <div className="flex items-center gap-[8px] mb-[12px]">
                      <p className={`text-[20px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                        וריאציות הודעות
                      </p>
                      {/* Question mark tooltip */}
                      <div className="relative group">
                        <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[11px] font-normal cursor-help ${
                          darkMode ? 'bg-[#1a2d4a] text-gray-300' : 'bg-[#F2F3F8] text-[#030733]'
                        }`}>
                          ?
                        </div>
                        <div className={`absolute right-0 top-[24px] w-[280px] p-[10px] rounded-[8px] text-[12px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 ${
                          darkMode ? 'bg-[#030733] text-gray-300' : 'bg-[#030733] text-white'
                        }`}>
                          צור מספר גרסאות של אותה הודעה. המערכת תבחר באופן רנדומלי איזו גרסה לשלוח לכל נמען.
                          <br /><br />
                          <span className="text-green-400">בונוס:</span> כל וריאציה נוספת מוסיפה 10 הודעות ליום למכשיר!
                        </div>
                      </div>
                    </div>
                    {/* Checkbox to enable */}
                    <label className="flex items-center gap-[10px] cursor-pointer mb-[12px]">
                      <div
                        onClick={() => {
                          setHasMessageVariations(!hasMessageVariations)
                          if (hasMessageVariations) {
                            // Disable - reset variations
                            setMessageVariations([])
                            setCurrentVariationIndex(0)
                          }
                        }}
                        className={`w-[18px] h-[18px] rounded-[4px] border-2 cursor-pointer flex items-center justify-center transition-colors ${
                          hasMessageVariations
                            ? 'bg-[#030733] border-[#030733]'
                            : darkMode ? 'border-gray-500 hover:border-gray-300' : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {hasMessageVariations && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.39062 6.2114L4.30239 8.12316L9.0818 3.34375" stroke="white" strokeWidth="0.823529" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <span className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                        הפעל וריאציות הודעות
                      </span>
                    </label>
                    {/* Variation count selection */}
                    {hasMessageVariations && (
                      <div className="flex flex-col gap-[12px]">
                        <div className="flex items-center gap-[10px]">
                          <span className={`text-[13px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                            מספר וריאציות:
                          </span>
                          <div className="flex items-center gap-[6px]">
                            <button
                              onClick={() => setVariationCount(Math.max(2, variationCount - 1))}
                              className={`w-[28px] h-[28px] rounded-[6px] flex items-center justify-center text-[16px] font-bold transition-colors ${
                                darkMode ? 'bg-[#1a2d4a] text-white hover:bg-[#243a5e]' : 'bg-[#F2F3F8] text-[#030733] hover:bg-gray-200'
                              }`}
                            >
                              -
                            </button>
                            <span className={`w-[30px] text-center text-[16px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                              {variationCount}
                            </span>
                            <button
                              onClick={() => setVariationCount(Math.min(10, variationCount + 1))}
                              className={`w-[28px] h-[28px] rounded-[6px] flex items-center justify-center text-[16px] font-bold transition-colors ${
                                darkMode ? 'bg-[#1a2d4a] text-white hover:bg-[#243a5e]' : 'bg-[#F2F3F8] text-[#030733] hover:bg-gray-200'
                              }`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        {/* Variation status - just numbers, no X/X format */}
                        <div className="flex flex-wrap gap-[8px]">
                          {Array.from({ length: variationCount }).map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                // Auto-save current variation before switching
                                if (messageTemplate.trim()) {
                                  const newVariations = [...messageVariations]
                                  newVariations[currentVariationIndex] = messageTemplate
                                  setMessageVariations(newVariations)
                                }
                                setCurrentVariationIndex(idx)
                                setMessageTemplate(messageVariations[idx] || '')
                              }}
                              className={`w-[32px] h-[32px] rounded-full text-[14px] font-bold transition-colors ${
                                messageVariations[idx]
                                  ? currentVariationIndex === idx
                                    ? 'bg-green-500 text-white'
                                    : darkMode ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-green-100 text-green-600 hover:bg-green-200'
                                  : currentVariationIndex === idx
                                    ? 'bg-[#030733] text-white'
                                    : darkMode ? 'bg-[#1a2d4a] text-gray-400 hover:bg-[#243a5e]' : 'bg-[#F2F3F8] text-[#595C7A] hover:bg-gray-200'
                              }`}
                            >
                              {idx + 1}
                            </button>
                          ))}
                        </div>
                        {/* Bonus info - based on variationCount, updates immediately */}
                        <div className={`text-[12px] ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                          {variationCount > 1
                            ? `+${(variationCount - 1) * 10} הודעות בונוס ליום לכל מכשיר`
                            : 'הוסף עוד וריאציות לקבלת בונוס הודעות!'
                          }
                        </div>
                      </div>
                    )}
                  </div>

                  {/* עריכת משתנים שנטענו - Edit Loaded Variables */}
                  <div>
                    <p className={`text-[20px] font-semibold mb-[12px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                      עריכת משתנים שנטענו
                    </p>
                    {/* Active variables (dark tags) */}
                    {allColumns.length > 0 && (
                      <div className="flex flex-wrap gap-[8px] mb-[12px]">
                        {allColumns.map((col, index) => (
                          <div
                            key={`col-${index}`}
                            className="h-[37px] flex items-center gap-[3px] px-[23px] py-[4px] rounded-[5px] bg-[#030733]"
                          >
                            <button
                              onClick={() => removeColumn(col, index)}
                              className="text-white hover:text-red-300 transition-colors"
                              title="הסר עמודה"
                            >
                              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                <path fillRule="evenodd" clipRule="evenodd" d="M2.96256 2.96328C3.03873 2.88721 3.14199 2.84448 3.24964 2.84448C3.3573 2.84448 3.46055 2.88721 3.53673 2.96328L6.49964 5.9262L9.46256 2.96328C9.49975 2.92337 9.5446 2.89136 9.59443 2.86915C9.64427 2.84695 9.69806 2.83501 9.75261 2.83405C9.80716 2.83309 9.86134 2.84312 9.91192 2.86355C9.96251 2.88398 10.0085 2.9144 10.047 2.95297C10.0856 2.99155 10.116 3.0375 10.1365 3.08809C10.1569 3.13867 10.1669 3.19285 10.166 3.2474C10.165 3.30195 10.1531 3.35574 10.1309 3.40558C10.1087 3.45541 10.0766 3.50026 10.0367 3.53745L7.07381 6.50037L10.0367 9.46328C10.0766 9.50048 10.1087 9.54533 10.1309 9.59516C10.1531 9.64499 10.165 9.69879 10.166 9.75333C10.1669 9.80788 10.1569 9.86206 10.1365 9.91265C10.116 9.96323 10.0856 10.0092 10.047 10.0478C10.0085 10.0863 9.96251 10.1168 9.91192 10.1372C9.86134 10.1576 9.80716 10.1676 9.75261 10.1667C9.69806 10.1657 9.64427 10.1538 9.59443 10.1316C9.5446 10.1094 9.49975 10.0774 9.46256 10.0375L6.49964 7.07453L3.53673 10.0375C3.45971 10.1092 3.35786 10.1483 3.25261 10.1464C3.14736 10.1446 3.04695 10.1019 2.97251 10.0275C2.89808 9.95306 2.85545 9.85265 2.85359 9.7474C2.85173 9.64215 2.8908 9.5403 2.96256 9.46328L5.92548 6.50037L2.96256 3.53745C2.88648 3.46128 2.84375 3.35802 2.84375 3.25037C2.84375 3.14271 2.88648 3.03946 2.96256 2.96328Z" fill="currentColor"/>
                              </svg>
                            </button>
                            <span className="text-[14px] text-white">{col}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Removed variables that can be restored (light tags with +) */}
                    {removedColumns.length > 0 && (
                      <div className="flex flex-wrap gap-[8px]">
                        {removedColumns.map((variable, index) => (
                          <button
                            key={`removed-${index}`}
                            onClick={() => restoreColumn(variable, index)}
                            className={`h-[37px] flex items-center gap-[3px] px-[23px] py-[4px] rounded-[5px] transition-colors ${
                              darkMode ? 'bg-[#1a2d4a] hover:bg-[#243a5e] text-white' : 'bg-[#F2F3F8] hover:bg-gray-200 text-[#030733]'
                            }`}
                            title="שחזר עמודה"
                          >
                            <svg width="19" height="19" viewBox="0 0 19 19" fill="none">
                              <g clipPath="url(#clip_plus)">
                                <path fillRule="evenodd" clipRule="evenodd" d="M4.19106 9.19297C4.19113 9.08531 4.23393 8.98208 4.31005 8.90596C4.38618 8.82983 4.48941 8.78703 4.59706 8.78697L8.78726 8.78697L8.78726 4.59677C8.78533 4.54225 8.79441 4.4879 8.81395 4.43696C8.83348 4.38602 8.86308 4.33954 8.90097 4.30029C8.93886 4.26104 8.98427 4.22982 9.03449 4.2085C9.0847 4.18718 9.1387 4.17619 9.19326 4.17619C9.24781 4.17619 9.30181 4.18718 9.35203 4.2085C9.40224 4.22982 9.44765 4.26104 9.48554 4.30029C9.52343 4.33954 9.55303 4.38602 9.57256 4.43696C9.5921 4.4879 9.60118 4.54225 9.59925 4.59677L9.59925 8.78697H13.7894C13.844 8.78504 13.8983 8.79412 13.9493 8.81366C14.0002 8.83319 14.0467 8.86279 14.0859 8.90068C14.1252 8.93857 14.1564 8.98398 14.1777 9.0342C14.199 9.08441 14.21 9.13841 14.21 9.19297C14.21 9.24752 14.199 9.30152 14.1777 9.35174C14.1564 9.40195 14.1252 9.44736 14.0859 9.48525C14.0467 9.52314 14.0002 9.55274 13.9493 9.57227C13.8983 9.59181 13.844 9.60089 13.7894 9.59896L9.59925 9.59896L9.59925 13.7892C9.59554 13.8944 9.55114 13.994 9.47541 14.0671C9.39967 14.1402 9.29852 14.1811 9.19326 14.1811C9.08799 14.1811 8.98684 14.1402 8.91111 14.0671C8.83537 13.994 8.79097 13.8944 8.78726 13.7892L8.78726 9.59896L4.59706 9.59896C4.48941 9.5989 4.38618 9.5561 4.31005 9.47997C4.23393 9.40385 4.19113 9.30062 4.19106 9.19297Z" fill="currentColor"/>
                              </g>
                              <defs>
                                <clipPath id="clip_plus">
                                  <rect width="13" height="13" fill="white" transform="translate(0 9.19336) rotate(-45)"/>
                                </clipPath>
                              </defs>
                            </svg>
                            <span className="text-[14px]">{variable}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : activeTab === 'recipients' ? (
              // Recipients Table
              filteredRecipients.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className={`text-[14px] ${darkMode ? 'text-gray-400' : 'text-[#030733]'}`}>
                    טען רשימת נמענים על מנת לצפות ולערוך אותם
                  </p>
                </div>
              ) : (
                <div className="w-full">
                  {/* Table Header */}
                  <div className={`flex items-center py-[12px] border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} sticky top-0 ${darkMode ? 'bg-[#142241]' : 'bg-white'} z-10`}>
                    {/* Checkbox column */}
                    <div className="w-[40px] shrink-0 flex justify-center">
                      <div
                        onClick={selectAllRecipients}
                        className={`w-[18px] h-[18px] rounded-[4px] border-2 cursor-pointer flex items-center justify-center transition-colors ${
                          selectedRecipients.size === filteredRecipients.length && filteredRecipients.length > 0
                            ? 'bg-[#030733] border-[#030733]'
                            : darkMode ? 'border-gray-500 hover:border-gray-300' : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {selectedRecipients.size === filteredRecipients.length && filteredRecipients.length > 0 && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </div>
                    {/* Name header */}
                    <div
                      onClick={() => handleSort('name')}
                      className={`flex-1 min-w-0 px-[8px] text-[13px] font-semibold cursor-pointer hover:opacity-80 transition-opacity ${darkMode ? 'text-white' : 'text-[#030733]'}`}
                    >
                      <div className="flex items-center gap-[4px]">
                        <span className="truncate">שם פרטי</span>
                        {sortColumn === 'name' ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="w-[12px] h-[12px] shrink-0" />
                          ) : (
                            <ChevronDown className="w-[12px] h-[12px] shrink-0" />
                          )
                        ) : (
                          <ChevronDown className="w-[12px] h-[12px] opacity-30 shrink-0" />
                        )}
                      </div>
                    </div>
                    {/* Phone header */}
                    <div
                      onClick={() => handleSort('phone')}
                      className={`flex-1 min-w-0 px-[8px] text-[13px] font-semibold cursor-pointer hover:opacity-80 transition-opacity ${darkMode ? 'text-white' : 'text-[#030733]'}`}
                    >
                      <div className="flex items-center gap-[4px]">
                        <span className="truncate">מספר טלפון</span>
                        {sortColumn === 'phone' ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="w-[12px] h-[12px] shrink-0" />
                          ) : (
                            <ChevronDown className="w-[12px] h-[12px] shrink-0" />
                          )
                        ) : (
                          <ChevronDown className="w-[12px] h-[12px] opacity-30 shrink-0" />
                        )}
                      </div>
                    </div>
                    {/* Dynamic columns headers (excluding שם and טלפון which are already shown) */}
                    {allColumns.filter(col => col !== 'שם' && col !== 'טלפון').map((colName) => (
                      <div
                        key={colName}
                        onClick={() => handleSort(colName)}
                        className={`flex-1 min-w-0 px-[8px] text-[13px] font-semibold cursor-pointer hover:opacity-80 transition-opacity ${darkMode ? 'text-white' : 'text-[#030733]'}`}
                      >
                        <div className="flex items-center gap-[4px]">
                          <span className="truncate">{colName}</span>
                          {sortColumn === colName ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp className="w-[12px] h-[12px] shrink-0" />
                            ) : (
                              <ChevronDown className="w-[12px] h-[12px] shrink-0" />
                            )
                          ) : (
                            <ChevronDown className="w-[12px] h-[12px] opacity-30 shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                    {/* Delete column spacer */}
                    <div className="w-[40px] shrink-0"></div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredRecipients.map((recipient) => (
                      <div
                        key={recipient.id}
                        className={`flex items-center py-[12px] group hover:${darkMode ? 'bg-[#1a2d4a]/50' : 'bg-gray-50'} transition-colors`}
                      >
                        {/* Checkbox */}
                        <div className="w-[40px] shrink-0 flex justify-center">
                          <div
                            onClick={() => toggleRecipientSelection(recipient.id)}
                            className={`w-[18px] h-[18px] rounded-[4px] border-2 cursor-pointer flex items-center justify-center transition-colors ${
                              selectedRecipients.has(recipient.id)
                                ? 'bg-[#030733] border-[#030733]'
                                : darkMode ? 'border-gray-500 hover:border-gray-300' : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {selectedRecipients.has(recipient.id) && (
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                        </div>

                        {/* Name */}
                        <div
                          className={`flex-1 min-w-0 px-[8px] text-[13px] truncate cursor-default ${darkMode ? 'text-white' : 'text-[#030733]'}`}
                          onMouseEnter={(e) => showCellTooltip(e, recipient.name || '-')}
                          onMouseLeave={hideCellTooltip}
                        >
                          {recipient.name || '-'}
                        </div>

                        {/* Phone */}
                        <div
                          className={`flex-1 min-w-0 px-[8px] text-[13px] truncate cursor-default ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}
                          onMouseEnter={(e) => showCellTooltip(e, formatPhoneForDisplay(recipient.phone))}
                          onMouseLeave={hideCellTooltip}
                        >
                          {formatPhoneForDisplay(recipient.phone)}
                        </div>

                        {/* Dynamic columns values (excluding שם and טלפון which are already shown) */}
                        {allColumns.filter(col => col !== 'שם' && col !== 'טלפון').map((colName) => (
                          <div
                            key={colName}
                            className={`flex-1 min-w-0 px-[8px] text-[13px] truncate cursor-default ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}
                            onMouseEnter={(e) => showCellTooltip(e, (recipient[colName] as string) || '-')}
                            onMouseLeave={hideCellTooltip}
                          >
                            {(recipient[colName] as string) || '-'}
                          </div>
                        ))}

                        {/* Delete button */}
                        <div className="w-[40px] shrink-0 flex justify-center">
                          <button
                            onClick={() => deleteRecipient(recipient.id)}
                            className={`w-[26px] h-[26px] rounded-[6px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${
                              darkMode ? 'bg-red-900/50 hover:bg-red-900' : 'bg-red-100 hover:bg-red-200'
                            }`}
                          >
                            <Trash2 className={`w-[12px] h-[12px] ${darkMode ? 'text-red-400' : 'text-red-600'}`} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              // Exclusion List
              filteredExclusionList.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className={`text-[14px] ${darkMode ? 'text-gray-400' : 'text-[#030733]'}`}>
                    טען רשימת אי-הכללה על מנת לצפות ולערוך אותה
                  </p>
                </div>
              ) : (
                <div className="w-full space-y-[8px]">
                  {filteredExclusionList.map((item) => (
                    <div
                      key={item.id}
                      className={`h-[50px] ${darkMode ? 'bg-[#1a2d4a]' : 'bg-[#f2f3f8]'} rounded-[8px] flex items-center px-[15px] gap-[12px] group`}
                    >
                      {/* Checkbox */}
                      <div
                        onClick={() => toggleExclusionSelection(item.id)}
                        className={`w-[20px] h-[20px] rounded-[4px] border-2 cursor-pointer flex items-center justify-center transition-colors shrink-0 ${
                          selectedExclusions.has(item.id)
                            ? 'bg-[#030733] border-[#030733]'
                            : darkMode ? 'border-gray-500 hover:border-gray-300' : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {selectedExclusions.has(item.id) && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>

                      {/* Phone */}
                      <span className={`text-[14px] flex-1 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                        {item.phone}
                      </span>

                      {/* Delete single button */}
                      <button
                        onClick={() => deleteExclusion(item.id)}
                        className={`w-[28px] h-[28px] rounded-[6px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${
                          darkMode ? 'bg-red-900/50 hover:bg-red-900' : 'bg-red-100 hover:bg-red-200'
                        }`}
                      >
                        <Trash2 className={`w-[14px] h-[14px] ${darkMode ? 'text-red-400' : 'text-red-600'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

      </div>

      {/* Mobile "Next" Button - Only shown on mobile step 1 */}
      {mobileStep === 1 && (
        <div className="lg:hidden mt-3 sm:mt-4 pb-5 sm:pb-6 px-3 sm:px-4 md:px-6">
          <button
            onClick={() => setMobileStep(2)}
            disabled={!name || recipients.length === 0}
            className="w-full h-[48px] sm:h-[50px] md:h-[52px] bg-[#030733] text-white rounded-[10px] text-[14px] sm:text-[15px] md:text-[16px] font-semibold hover:bg-[#0a1628] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
          >
            המשך לכתיבת הודעה
            <ChevronDown className="w-[18px] h-[18px] sm:w-5 sm:h-5 rotate-90" />
          </button>
        </div>
      )}

      {/* Bottom Section - Message Input (Desktop only) */}
      <div className="hidden lg:flex flex-col lg:flex-row gap-3 lg:gap-[15px] 2xl:gap-[20px] mt-3 lg:mt-[8px] xl:ml-[320px] 2xl:ml-[380px] lg:shrink-0 pb-6 lg:pb-[30px]">
        <div className="hidden lg:block lg:w-[320px] xl:w-[350px] 2xl:w-[400px] lg:shrink-0" />
        <div className="w-full lg:flex-1 lg:min-w-[500px] lg:max-w-[800px] 2xl:max-w-[900px] flex flex-col gap-[6px]">
          {/* Variation indicator when variations are enabled */}
          {hasMessageVariations && (
            <div className="flex items-center gap-[8px] mb-[4px]">
              <span className={`text-[14px] font-medium ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                עורך הודעה:
              </span>
              <div className="flex items-center gap-[6px]">
                {Array.from({ length: variationCount }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      // Auto-save current message before switching
                      if (messageTemplate.trim()) {
                        const newVariations = [...messageVariations]
                        newVariations[currentVariationIndex] = messageTemplate
                        setMessageVariations(newVariations)
                      }
                      setCurrentVariationIndex(idx)
                      setMessageTemplate(messageVariations[idx] || '')
                    }}
                    className={`w-[28px] h-[28px] rounded-full text-[12px] font-bold transition-colors ${
                      currentVariationIndex === idx
                        ? 'bg-[#030733] text-white'
                        : messageVariations[idx]
                          ? darkMode ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-green-100 text-green-600 hover:bg-green-200'
                          : darkMode ? 'bg-[#142241] text-gray-400 hover:bg-[#1a2d4a]' : 'bg-[#F2F3F8] text-[#595C7A] hover:bg-gray-200'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              {/* Show which variation is being edited */}
              <span className={`text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                (הודעה {currentVariationIndex + 1})
              </span>
            </div>
          )}

          {/* Variables chips and expand button */}
          <div className="flex items-center gap-[8px] flex-wrap">
            {recipients.length > 0 && allColumns.length > 0 && (
              <>
                <p className={`text-[16px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                  <span className="font-semibold">המשתנים שנטענו </span>
                  <span className="font-normal">({allColumns.length})</span>
                </p>
                {/* Variables from loaded columns */}
                {allColumns.map((colName) => (
                  <div
                    key={colName}
                    className="px-[13px] py-[6px] bg-[#030733] rounded-[7px] cursor-pointer hover:bg-[#0a1628] transition-colors"
                    onClick={() => {
                      const varText = `{${colName}}`
                      setMessageTemplate(prev => prev + varText)
                    }}
                  >
                    <span className="text-white text-[14px]">{colName}</span>
                  </div>
                ))}
              </>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setIsMessageExpanded(!isMessageExpanded)}
              className={`px-[12px] py-[4px] rounded-[5px] text-[13px] font-medium transition-colors ${
                darkMode ? 'bg-[#142241] text-white hover:bg-[#1a2d4a]' : 'bg-white text-[#030733] hover:bg-gray-100'
              }`}
            >
              {isMessageExpanded ? 'צמצם' : 'הרחב'}
            </button>
          </div>
          <div className={`${isMessageExpanded ? 'h-[230px]' : 'h-[51px]'} bg-[#030733] rounded-[10px] flex ${isMessageExpanded ? 'flex-col' : 'items-center'} relative ${showEmojiPicker || showAttachmentsMenu ? 'overflow-visible' : 'overflow-hidden'} transition-all`}>
            {isMessageExpanded ? (
              <>
                {/* Expanded textarea */}
                <textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  placeholder="כתוב את ההודעה כאן"
                  className="flex-1 bg-transparent text-white placeholder-[#a2a2a2] text-[14px] outline-none p-[15px] text-right resize-none"
                />
                {/* Bottom bar with icons and button */}
                <div className="h-[45px] border-t border-white/10 flex items-center px-[15px] shrink-0">
                  <div className="flex items-center gap-[6px]">
                    <button onClick={() => { setAudioPopupType('audio'); setShowAudioPopup(true); }} className="text-white hover:text-white/80">
                      <Mic className="w-[13px] h-[13px]" />
                    </button>
                    {/* Emoji button with popup */}
                    <div className="relative">
                      <button ref={emojiButtonRef} onClick={() => { setShowAttachmentsMenu(false); setShowEmojiPicker(!showEmojiPicker); }} className="text-white hover:text-white/80">
                        <Smile className="w-[13px] h-[13px]" />
                      </button>
                      {/* Emoji Picker Popup - positioned above button, opens to the left */}
                      {showEmojiPicker && (
                        <div
                          ref={emojiPickerRef}
                          className="absolute bottom-full mb-2 right-[-4px] z-[60]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Arrow/Triangle pointing down to the icon */}
                          <div className="absolute -bottom-[6px] right-[6px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#030733] z-10" />
                          <Picker
                            data={data}
                            onEmojiSelect={handleEmojiSelect}
                            theme="dark"
                            locale="he"
                            i18n={emojiI18n}
                            previewPosition="none"
                            skinTonePosition="none"
                            searchPosition="sticky"
                            navPosition="top"
                            perLine={9}
                            emojiSize={28}
                            maxFrequentRows={1}
                          />
                        </div>
                      )}
                    </div>
                    {/* Attachments button with popup */}
                    <div className="relative">
                      <button ref={attachmentsButtonRef} onClick={() => { setShowEmojiPicker(false); setShowAttachmentsMenu(!showAttachmentsMenu); }} className="text-white hover:text-white/80">
                        <Paperclip className="w-[15px] h-[15px]" />
                      </button>
                      {/* Attachments Menu Popup - positioned above button */}
                      {showAttachmentsMenu && (
                        <div
                          ref={attachmentsMenuRef}
                          className="absolute bottom-full mb-2 right-[-4px] z-[60] w-[160px] rounded-[10px] bg-[#030733] shadow-lg overflow-visible"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Arrow/Triangle pointing down to the icon */}
                          <div className="absolute -bottom-[6px] right-[6px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#030733]" />

                          <div className="py-1.5">
                            {attachmentItems.map((item) => (
                              <button
                                key={item.type}
                                onClick={() => handleAttachmentClick(item.type)}
                                className="w-full flex items-center justify-start gap-2 px-3 py-1.5 transition-colors hover:bg-white/10 text-white"
                              >
                                <item.icon className="w-4 h-4 text-white" />
                                <span className="text-[13px]">{item.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1" />
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !name || !selectedConnection || (!messageTemplate && !attachedMedia.type) || recipients.length === 0}
                    className="px-[10px] py-[4px] bg-[#f2f3f8] text-[#030733] rounded-[5px] text-[14px] font-semibold hover:bg-white transition-colors disabled:opacity-50"
                  >
                    {loading ? 'שומר...' : 'סיימתי'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Submit Button on left */}
                <button
                  onClick={handleSubmit}
                  disabled={loading || !name || !selectedConnection || (!messageTemplate && !attachedMedia.type) || recipients.length === 0}
                  className="absolute left-[10px] top-[11px] px-[10px] py-[4px] bg-[#f2f3f8] text-[#030733] rounded-[5px] text-[14px] font-semibold hover:bg-white transition-colors disabled:opacity-50"
                >
                  {loading ? 'שומר...' : 'סיימתי'}
                </button>

                {/* Input */}
                <input
                  type="text"
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  placeholder="כתוב את ההודעה כאן"
                  className="flex-1 bg-transparent text-white placeholder-[#a2a2a2] text-[14px] outline-none px-[100px] text-right"
                />

                {/* Icons on right */}
                <div className="absolute right-[15px] top-[14px] flex items-center gap-[6px]">
                  {/* Attachments button with popup */}
                  <div className="relative">
                    <button onClick={() => { setShowEmojiPicker(false); setShowAttachmentsMenu(!showAttachmentsMenu); }} className="text-white hover:text-white/80">
                      <Paperclip className="w-[15px] h-[15px]" />
                    </button>
                    {/* Attachments Menu Popup - positioned above button */}
                    {showAttachmentsMenu && (
                      <div
                        className="absolute bottom-full mb-2 right-[-4px] z-[60] w-[160px] rounded-[10px] bg-[#030733] shadow-lg overflow-visible"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Arrow/Triangle pointing down to the icon */}
                        <div className="absolute -bottom-[6px] right-[6px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#030733]" />

                        <div className="py-1.5">
                          {attachmentItems.map((item) => (
                            <button
                              key={item.type}
                              onClick={() => handleAttachmentClick(item.type)}
                              className="w-full flex items-center justify-start gap-2 px-3 py-1.5 transition-colors hover:bg-white/10 text-white"
                            >
                              <item.icon className="w-4 h-4 text-white" />
                              <span className="text-[13px]">{item.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Emoji button with popup */}
                  <div className="relative">
                    <button onClick={() => { setShowAttachmentsMenu(false); setShowEmojiPicker(!showEmojiPicker); }} className="text-white hover:text-white/80">
                      <Smile className="w-[13px] h-[13px]" />
                    </button>
                    {/* Emoji Picker Popup - positioned above button, opens to the left */}
                    {showEmojiPicker && (
                      <div
                        className="absolute bottom-full mb-2 right-[-4px] z-[60]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Arrow/Triangle pointing down to the icon */}
                        <div className="absolute -bottom-[6px] right-[6px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#030733] z-10" />
                        <Picker
                          data={data}
                          onEmojiSelect={handleEmojiSelect}
                          theme="dark"
                          locale="he"
                          i18n={emojiI18n}
                          previewPosition="none"
                          skinTonePosition="none"
                          searchPosition="sticky"
                          navPosition="top"
                          perLine={9}
                          emojiSize={28}
                          maxFrequentRows={1}
                        />
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setAudioPopupType('audio'); setShowAudioPopup(true); }} className="text-white hover:text-white/80">
                    <Mic className="w-[13px] h-[13px]" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Attached Media Indicator */}
          {attachedMedia.type && (
            <div className={`mt-2 p-3 rounded-[10px] flex items-center justify-between ${darkMode ? 'bg-[#0a1628]' : 'bg-[#f2f3f8]'}`}>
              <button
                onClick={removeAttachedMedia}
                className="text-red-500 hover:text-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                {/* Edit button for poll */}
                {attachedMedia.type === 'poll' && attachedMedia.poll && (
                  <button
                    onClick={() => {
                      setSurveyQuestion(attachedMedia.poll!.question)
                      setSurveyOptions(attachedMedia.poll!.options)
                      setAllowMultipleAnswers(attachedMedia.poll!.multipleAnswers)
                      setAudioPopupType('survey')
                      setShowAudioPopup(true)
                    }}
                    className={`p-1 rounded transition-colors ${darkMode ? 'hover:bg-[#1e3a5f] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                <span className={`text-sm ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                  {attachedMedia.name}
                </span>
                {attachedMedia.type === 'audio' && <Mic className={`w-4 h-4 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />}
                {attachedMedia.type === 'document' && <FileText className={`w-4 h-4 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />}
                {attachedMedia.type === 'image' && <Image className={`w-4 h-4 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />}
                {attachedMedia.type === 'poll' && <BarChart3 className={`w-4 h-4 ${darkMode ? 'text-orange-400' : 'text-orange-600'}`} />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Media Upload Popup (Audio/Document/Image) */}
      {showAudioPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 md:p-6" onClick={() => { cancelRecording(); setShowAudioPopup(false); }}>
          <div
            className={`w-full max-w-[340px] sm:max-w-[380px] md:max-w-[400px] rounded-[12px] sm:rounded-[14px] md:rounded-[15px] p-4 sm:p-5 md:p-6 ${darkMode ? 'bg-[#142241]' : 'bg-white'} shadow-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <button
                onClick={() => { cancelRecording(); setShowAudioPopup(false); }}
                className={`p-1 sm:p-1.5 rounded-full transition-colors touch-manipulation ${darkMode ? 'hover:bg-[#1e3a5f] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <X className="w-[18px] h-[18px] sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </button>
              <h3 className={`text-[16px] sm:text-[17px] md:text-[18px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                {audioPopupType === 'audio' ? 'הודעה קולית' :
                 audioPopupType === 'document' ? 'מסמך' :
                 audioPopupType === 'camera' ? 'מצלמה' :
                 audioPopupType === 'survey' ? 'סקר' : 'תמונה'}
              </h3>
            </div>

            {/* Audio Popup Content */}
            {audioPopupType === 'audio' && (
              <>
                {/* Hidden audio input */}
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*,.ogg,.mp3,.wav,.m4a,.webm"
                  className="hidden"
                  onChange={handleAudioFileUpload}
                />

                {/* Recording / Preview Area */}
                <div className={`rounded-[12px] p-6 mb-4 ${darkMode ? 'bg-[#0a1628]' : 'bg-[#f2f3f8]'}`}>
                  {isRecording ? (
                    // Recording in progress
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mb-4 animate-pulse">
                        <Mic className="w-8 h-8 text-white" />
                      </div>
                      <span className={`text-2xl font-mono mb-2 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                        {formatRecordingTime(recordingTime)}
                      </span>
                      <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        מקליט...
                      </span>
                    </div>
                  ) : audioUrl ? (
                    // Audio preview
                    <div className="flex flex-col items-center">
                      <audio
                        ref={audioPreviewRef}
                        src={audioUrl}
                        onEnded={() => setIsPlayingPreview(false)}
                        className="hidden"
                      />
                      <button
                        onClick={toggleAudioPreview}
                        className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
                          isPlayingPreview ? 'bg-orange-500' : 'bg-green-500'
                        }`}
                      >
                        {isPlayingPreview ? (
                          <Pause className="w-8 h-8 text-white" />
                        ) : (
                          <Play className="w-8 h-8 text-white mr-[-4px]" />
                        )}
                      </button>
                      <span className={`text-sm mb-1 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                        {uploadedFileName || `הקלטה (${formatRecordingTime(recordingTime)})`}
                      </span>
                      <button
                        onClick={cancelRecording}
                        className="text-red-500 text-sm hover:text-red-600 transition-colors"
                      >
                        מחק והתחל מחדש
                      </button>
                    </div>
                  ) : (
                    // Initial state - ready to record or upload
                    <div className="flex flex-col items-center">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${darkMode ? 'bg-[#1e3a5f]' : 'bg-gray-200'}`}>
                        <Mic className={`w-8 h-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                      </div>
                      <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        לחץ להקלטה או העלה קובץ
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {isRecording ? (
                    // Stop recording button
                    <button
                      onClick={stopRecording}
                      className="flex-1 h-[44px] bg-red-500 text-white rounded-[10px] font-medium flex items-center justify-center gap-2 hover:bg-red-600 transition-colors"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      עצור הקלטה
                    </button>
                  ) : audioUrl ? (
                    // Save audio button
                    <button
                      onClick={saveAudioToMedia}
                      className="flex-1 h-[44px] bg-green-500 text-white rounded-[10px] font-medium flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
                    >
                      שמור
                    </button>
                  ) : (
                    // Record and Upload buttons
                    <>
                      <button
                        onClick={startRecording}
                        className="flex-1 h-[44px] bg-red-500 text-white rounded-[10px] font-medium flex items-center justify-center gap-2 hover:bg-red-600 transition-colors"
                      >
                        <Mic className="w-4 h-4" />
                        הקלט
                      </button>
                      <button
                        onClick={() => audioInputRef.current?.click()}
                        className={`flex-1 h-[44px] rounded-[10px] font-medium flex items-center justify-center gap-2 transition-colors ${
                          darkMode
                            ? 'bg-[#1e3a5f] text-white hover:bg-[#2a4a6f]'
                            : 'bg-[#f2f3f8] text-[#030733] hover:bg-gray-200'
                        }`}
                      >
                        <Upload className="w-4 h-4" />
                        העלה קובץ
                      </button>
                    </>
                  )}
                </div>

                {/* Format hint */}
                <p className={`text-xs text-center mt-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  פורמטים נתמכים: OGG, MP3, WAV, M4A
                </p>
              </>
            )}

            {/* Document Popup Content */}
            {audioPopupType === 'document' && (
              <>
                <input
                  ref={documentInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  className="hidden"
                  onChange={handleDocumentFileUpload}
                />

                <div className={`rounded-[12px] p-6 mb-4 ${darkMode ? 'bg-[#0a1628]' : 'bg-[#f2f3f8]'}`}>
                  <div className="flex flex-col items-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${darkMode ? 'bg-[#1e3a5f]' : 'bg-gray-200'}`}>
                      <FileText className={`w-8 h-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    </div>
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      לחץ להעלאת מסמך
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => documentInputRef.current?.click()}
                  className={`w-full h-[44px] rounded-[10px] font-medium flex items-center justify-center gap-2 transition-colors ${
                    darkMode
                      ? 'bg-[#1e3a5f] text-white hover:bg-[#2a4a6f]'
                      : 'bg-[#030733] text-white hover:bg-[#0a1a4a]'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  בחר מסמך
                </button>

                <p className={`text-xs text-center mt-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  פורמטים נתמכים: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT
                </p>
              </>
            )}

            {/* Image Popup Content */}
            {(audioPopupType === 'image' || audioPopupType === 'camera') && (
              <>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  capture={audioPopupType === 'camera' ? 'environment' : undefined}
                  className="hidden"
                  onChange={handleImageFileUpload}
                />

                <div className={`rounded-[12px] p-6 mb-4 ${darkMode ? 'bg-[#0a1628]' : 'bg-[#f2f3f8]'}`}>
                  <div className="flex flex-col items-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${darkMode ? 'bg-[#1e3a5f]' : 'bg-gray-200'}`}>
                      {audioPopupType === 'camera' ? (
                        <Camera className={`w-8 h-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                      ) : (
                        <Image className={`w-8 h-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                      )}
                    </div>
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {audioPopupType === 'camera' ? 'לחץ לצילום תמונה' : 'לחץ להעלאת תמונה'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => imageInputRef.current?.click()}
                  className={`w-full h-[44px] rounded-[10px] font-medium flex items-center justify-center gap-2 transition-colors ${
                    darkMode
                      ? 'bg-[#1e3a5f] text-white hover:bg-[#2a4a6f]'
                      : 'bg-[#030733] text-white hover:bg-[#0a1a4a]'
                  }`}
                >
                  {audioPopupType === 'camera' ? (
                    <>
                      <Camera className="w-4 h-4" />
                      צלם תמונה
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      בחר תמונה
                    </>
                  )}
                </button>

                <p className={`text-xs text-center mt-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  פורמטים נתמכים: JPG, PNG, GIF, WEBP
                </p>
              </>
            )}

            {/* Survey Popup Content */}
            {audioPopupType === 'survey' && (
              <>
                {/* Question Input */}
                <div className="mb-4">
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    שאלת הסקר
                  </label>
                  <input
                    type="text"
                    value={surveyQuestion}
                    onChange={(e) => setSurveyQuestion(e.target.value)}
                    placeholder="הזן את שאלת הסקר..."
                    className={`w-full h-[44px] px-4 rounded-[10px] text-[14px] outline-none ${
                      darkMode ? 'bg-[#0a1628] text-white placeholder-gray-500' : 'bg-[#f2f3f8] text-[#030733] placeholder-gray-400'
                    }`}
                  />
                </div>

                {/* Options */}
                <div className="mb-4">
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    אפשרויות תשובה
                  </label>
                  <div className="space-y-2">
                    {surveyOptions.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          darkMode ? 'bg-[#1e3a5f] text-white' : 'bg-gray-200 text-gray-700'
                        }`}>
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...surveyOptions]
                            newOptions[index] = e.target.value
                            setSurveyOptions(newOptions)
                          }}
                          placeholder={`אפשרות ${index + 1}`}
                          className={`flex-1 h-[40px] px-3 rounded-[8px] text-[14px] outline-none ${
                            darkMode ? 'bg-[#0a1628] text-white placeholder-gray-500' : 'bg-[#f2f3f8] text-[#030733] placeholder-gray-400'
                          }`}
                        />
                        {surveyOptions.length > 2 && (
                          <button
                            onClick={() => {
                              const newOptions = surveyOptions.filter((_, i) => i !== index)
                              setSurveyOptions(newOptions)
                            }}
                            className="text-red-500 hover:text-red-600 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {surveyOptions.length < 10 && (
                    <button
                      onClick={() => setSurveyOptions([...surveyOptions, ''])}
                      className={`mt-2 text-sm flex items-center gap-1 ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                    >
                      <Plus className="w-4 h-4" />
                      הוסף אפשרות
                    </button>
                  )}
                </div>

                {/* Multiple Answers Toggle */}
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowMultipleAnswers}
                      onChange={(e) => setAllowMultipleAnswers(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      אפשר בחירת מספר תשובות
                    </span>
                  </label>
                </div>

                {/* Save Button */}
                <button
                  onClick={() => {
                    if (!surveyQuestion.trim()) {
                      setAlertPopup({ show: true, message: 'יש להזין שאלת סקר' })
                      return
                    }
                    const validOptions = surveyOptions.filter(o => o.trim())
                    if (validOptions.length < 2) {
                      setAlertPopup({ show: true, message: 'יש להזין לפחות 2 אפשרויות' })
                      return
                    }
                    // Save poll to attachedMedia (will be sent via WAHA sendPoll API)
                    setAttachedMedia({
                      type: 'poll',
                      file: null,
                      url: null,
                      name: surveyQuestion,
                      poll: {
                        question: surveyQuestion,
                        options: validOptions,
                        multipleAnswers: allowMultipleAnswers
                      }
                    })
                    setShowAudioPopup(false)
                  }}
                  disabled={!surveyQuestion.trim() || surveyOptions.filter(o => o.trim()).length < 2}
                  className={`w-full h-[44px] rounded-[10px] font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                    darkMode
                      ? 'bg-[#1e3a5f] text-white hover:bg-[#2a4a6f]'
                      : 'bg-[#030733] text-white hover:bg-[#0a1a4a]'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  הוסף סקר
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Saved Files Popup */}
      {showSavedFilesPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSavedFilesPopup(false)}>
          <div
            className={`w-full max-w-[450px] rounded-[15px] p-5 ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => setShowSavedFilesPopup(false)}
                className={`p-1 rounded-full transition-colors ${darkMode ? 'hover:bg-[#1e3a5f] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className={`text-[18px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                קבצים שמורים
              </h3>
            </div>

            {/* Files List */}
            <div className="max-h-[400px] overflow-y-auto">
              {loadingFiles ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : storedFiles.length === 0 ? (
                <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">אין קבצים שמורים</p>
                  <p className="text-xs mt-1">קבצים שתעלה יישמרו כאן</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {storedFiles.map((file) => (
                    <div
                      key={file.path}
                      className={`flex items-center justify-between p-3 rounded-[10px] ${
                        darkMode ? 'bg-[#0a1628] hover:bg-[#1e3a5f]' : 'bg-[#f2f3f8] hover:bg-gray-200'
                      } cursor-pointer transition-colors group`}
                      onClick={() => {
                        // Get public URL and set as attached media
                        const supabase = createClient()
                        const { data: { publicUrl } } = supabase.storage
                          .from('leadsol_storage')
                          .getPublicUrl(file.path)

                        setAttachedMedia({
                          type: file.type,
                          file: null,
                          url: publicUrl,
                          name: file.name.split('_').slice(2).join('_') || file.name
                        })
                        setShowSavedFilesPopup(false)
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-[8px] flex items-center justify-center ${
                          file.type === 'audio' ? 'bg-purple-500/20 text-purple-500' :
                          file.type === 'image' ? 'bg-green-500/20 text-green-500' :
                          'bg-blue-500/20 text-blue-500'
                        }`}>
                          {file.type === 'audio' ? <Mic className="w-5 h-5" /> :
                           file.type === 'image' ? <Image className="w-5 h-5" /> :
                           <FileText className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-medium truncate ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                            {file.name.split('_').slice(2).join('_') || file.name}
                          </p>
                          <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            {formatFileSize(file.size)} • {file.type === 'audio' ? 'אודיו' : file.type === 'image' ? 'תמונה' : 'מסמך'} • {new Date(file.createdAt).toLocaleDateString('he-IL')}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteSingleFile(file.path)
                        }}
                        disabled={deletingFiles.has(file.path)}
                        className={`p-2 rounded-[6px] opacity-0 group-hover:opacity-100 transition-opacity ${
                          deletingFiles.has(file.path)
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-red-500 hover:bg-red-600 text-white'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Storage info */}
            {storedFiles.length > 0 && (
              <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                    {storedFiles.length} קבצים
                  </span>
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                    {formatFileSize(getTotalStorageUsed())} מתוך 512MB
                  </span>
                </div>
                {/* Progress bar */}
                <div className={`mt-2 h-1.5 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.min((getTotalStorageUsed() / (512 * 1024 * 1024)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Entry Popup */}
      {showManualEntryPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowManualEntryPopup(false)}>
          <div
            className={`w-full max-w-[500px] max-h-[90vh] overflow-y-auto rounded-[15px] p-4 sm:p-[20px] ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={`text-[18px] font-semibold mb-[15px] text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              הוספת נמענים ידנית
            </h3>

            {/* Mode Toggle */}
            <div className="flex gap-[8px] mb-[15px]">
              <button
                onClick={() => setManualEntryMode('single')}
                className={`flex-1 h-[36px] rounded-[8px] text-[13px] font-medium transition-colors ${
                  manualEntryMode === 'single'
                    ? 'bg-[#030733] text-white'
                    : darkMode ? 'bg-[#0a1628] text-gray-400' : 'bg-[#f2f3f8] text-[#595C7A]'
                }`}
              >
                הזנה בודדת
              </button>
              <button
                onClick={() => setManualEntryMode('paste')}
                className={`flex-1 h-[36px] rounded-[8px] text-[13px] font-medium transition-colors ${
                  manualEntryMode === 'paste'
                    ? 'bg-[#030733] text-white'
                    : darkMode ? 'bg-[#0a1628] text-gray-400' : 'bg-[#f2f3f8] text-[#595C7A]'
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
                    <label className={`text-[14px] mb-[4px] block text-right ${darkMode ? 'text-gray-300' : 'text-[#030733]'}`}>
                      שם
                    </label>
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="הזן שם"
                      className={`w-full h-[40px] px-[14px] rounded-[10px] text-[14px] outline-none text-right ${
                        darkMode ? 'bg-[#0a1628] text-white placeholder-gray-400' : 'bg-[#f2f3f8] text-[#030733] placeholder-[#a2a2a2]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`text-[14px] mb-[4px] block text-right ${darkMode ? 'text-gray-300' : 'text-[#030733]'}`}>
                      טלפון
                    </label>
                    <input
                      type="tel"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      placeholder="הזן מספר טלפון"
                      className={`w-full h-[40px] px-[14px] rounded-[10px] text-[14px] outline-none text-right ${
                        darkMode ? 'bg-[#0a1628] text-white placeholder-gray-400' : 'bg-[#f2f3f8] text-[#030733] placeholder-[#a2a2a2]'
                      }`}
                    />
                  </div>

                  {/* Custom Fields */}
                  {customFields.map((field, index) => (
                    <div key={index} className="flex gap-[8px] items-end">
                      <div className="flex-1">
                        <label className={`text-[12px] mb-[2px] block text-right ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                          שם השדה
                        </label>
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => handleUpdateCustomField(index, 'name', e.target.value)}
                          placeholder="לדוגמה: עיר"
                          className={`w-full h-[36px] px-[12px] rounded-[8px] text-[13px] outline-none text-right ${
                            darkMode ? 'bg-[#0a1628] text-white placeholder-gray-400' : 'bg-[#f2f3f8] text-[#030733] placeholder-[#a2a2a2]'
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className={`text-[12px] mb-[2px] block text-right ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                          ערך
                        </label>
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => handleUpdateCustomField(index, 'value', e.target.value)}
                          placeholder="הזן ערך"
                          className={`w-full h-[36px] px-[12px] rounded-[8px] text-[13px] outline-none text-right ${
                            darkMode ? 'bg-[#0a1628] text-white placeholder-gray-400' : 'bg-[#f2f3f8] text-[#030733] placeholder-[#a2a2a2]'
                          }`}
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveCustomField(index)}
                        className={`w-[36px] h-[36px] rounded-[8px] flex items-center justify-center ${
                          darkMode ? 'bg-red-900/50 text-red-400 hover:bg-red-900' : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }`}
                      >
                        <Trash2 className="w-[16px] h-[16px]" />
                      </button>
                    </div>
                  ))}

                  {/* Add Custom Field Button */}
                  <button
                    onClick={handleAddCustomField}
                    className={`w-full h-[36px] rounded-[8px] text-[13px] font-medium border-2 border-dashed flex items-center justify-center gap-[6px] ${
                      darkMode ? 'border-gray-600 text-gray-400 hover:border-gray-400' : 'border-gray-300 text-[#595C7A] hover:border-gray-400'
                    }`}
                  >
                    <Plus className="w-[14px] h-[14px]" />
                    הוסף פרמטר נוסף
                  </button>
                </div>

                <div className="flex gap-[10px] mt-[20px]">
                  <button
                    onClick={() => handleAddManualRecipientWithCustomFields()}
                    disabled={!manualName || !manualPhone}
                    className="flex-1 h-[40px] bg-[#030733] text-white rounded-[10px] text-[14px] font-medium hover:bg-[#0a1628] transition-colors disabled:opacity-50"
                  >
                    הוסף והמשך
                  </button>
                  <button
                    onClick={() => {
                      handleAddManualRecipientWithCustomFields()
                      setShowManualEntryPopup(false)
                    }}
                    disabled={!manualName || !manualPhone}
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
                      <label className={`text-[14px] mb-[4px] block text-right ${darkMode ? 'text-gray-300' : 'text-[#030733]'}`}>
                        שלב 1: הדבק את הרשימה
                      </label>
                      <p className={`text-[12px] mb-[6px] text-right ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                        הדבק את כל הרשימה שלך - כל שורה היא נמען אחד
                      </p>
                      <textarea
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        placeholder={`אלירן חדרה 0506842063\nיוסי תל אביב 0501234567\nדני ירושלים 0521234567`}
                        className={`w-full h-[150px] p-[12px] rounded-[10px] text-[13px] outline-none text-right resize-none ${
                          darkMode ? 'bg-[#0a1628] text-white placeholder-gray-500' : 'bg-[#f2f3f8] text-[#030733] placeholder-[#a2a2a2]'
                        }`}
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
                      <label className={`text-[14px] mb-[4px] block text-right ${darkMode ? 'text-gray-300' : 'text-[#030733]'}`}>
                        שלב 2: בחר את סוג כל עמודה
                      </label>
                      <p className={`text-[12px] mb-[6px] text-right ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                        זיהינו {parsedRows[0]?.length || 0} עמודות ב-{parsedRows.length} שורות. בחר את סוג כל עמודה:
                      </p>
                    </div>

                    {/* Column naming - one per column */}
                    <div className={`p-[15px] rounded-[10px] flex flex-col gap-[12px] ${darkMode ? 'bg-[#0a1628]' : 'bg-[#f2f3f8]'}`}>
                      {parsedRows[0]?.map((col, idx) => (
                        <div key={idx} className="flex items-center gap-[10px]">
                          <div className={`w-[120px] text-[12px] px-[10px] py-[6px] rounded-[6px] text-center truncate ${
                            darkMode ? 'bg-[#142241] text-gray-300' : 'bg-white text-[#595C7A]'
                          }`}>
                            {col}
                          </div>
                          <span className={`text-[14px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>=</span>
                          <select
                            value={(columnNames[idx] === 'שם' || columnNames[idx] === 'טלפון' || columnNames[idx] === '' || !columnNames[idx]) ? (columnNames[idx] || '') : 'אחר'}
                            onChange={(e) => {
                              const newNames = [...columnNames]
                              newNames[idx] = e.target.value === 'אחר' ? 'custom_' + idx : e.target.value
                              setColumnNames(newNames)
                            }}
                            className={`w-[130px] h-[36px] px-[12px] rounded-[8px] text-[13px] outline-none text-right appearance-none cursor-pointer ${
                              darkMode ? 'bg-[#142241] text-white' : 'bg-white text-[#030733]'
                            } ${columnNames[idx] === 'שם' ? 'border-2 border-green-500' : columnNames[idx] === 'טלפון' ? 'border-2 border-blue-500' : ''}`}
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
                              className={`flex-1 h-[36px] px-[12px] rounded-[8px] text-[13px] outline-none text-right ${
                                darkMode ? 'bg-[#142241] text-white placeholder-gray-500' : 'bg-white text-[#030733] placeholder-[#a2a2a2]'
                              }`}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    <p className={`text-[12px] text-right ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                      חובה: לבחור עמודת "טלפון" | מומלץ: לבחור עמודת "שם"
                    </p>

                    {/* Preview table */}
                    <div className={`p-[10px] rounded-[10px] ${darkMode ? 'bg-[#0a1628]' : 'bg-[#f2f3f8]'}`}>
                      <p className={`text-[12px] font-medium mb-[8px] text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                        תצוגה מקדימה (3 שורות ראשונות):
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr>
                              {columnNames.map((name, idx) => (
                                <th key={idx} className={`px-[8px] py-[4px] text-right font-medium ${
                                  darkMode ? 'text-gray-300' : 'text-[#030733]'
                                }`}>
                                  {name || `עמודה ${idx + 1}`}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {parsedRows.slice(0, 3).map((row, rowIdx) => (
                              <tr key={rowIdx}>
                                {row.map((cell, cellIdx) => (
                                  <td key={cellIdx} className={`px-[8px] py-[4px] text-right ${
                                    darkMode ? 'text-gray-400' : 'text-[#595C7A]'
                                  }`}>
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
                        className={`w-[100px] h-[40px] rounded-[10px] text-[14px] font-medium ${
                          darkMode ? 'bg-[#0a1628] text-gray-400 hover:text-white' : 'bg-white text-[#595C7A] hover:text-[#030733]'
                        }`}
                      >
                        חזור
                      </button>
                      <button
                        onClick={() => {
                          console.log('Manual button clicked!')
                          handleAddParsedRecipients()
                        }}
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
                setManualEntryMode('single')
                setPastedText('')
                setParsedRows([])
                setColumnNames([])
                setShowColumnMapping(false)
                setCustomFields([])
              }}
              className={`w-full h-[40px] mt-[10px] rounded-[10px] text-[14px] font-medium ${
                darkMode ? 'bg-[#0a1628] text-gray-400 hover:text-white' : 'bg-[#f2f3f8] text-[#595C7A] hover:text-[#030733]'
              }`}
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
            className={`w-full max-w-[550px] max-h-[90vh] overflow-y-auto rounded-[15px] p-4 sm:p-[20px] ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={`text-[18px] font-semibold mb-[5px] text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              ייבוא מקובץ Excel
            </h3>
            <p className={`text-[13px] mb-[15px] text-right ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
              {excelFileName}
            </p>

            {/* Has Headers Toggle */}
            <div className="flex items-center gap-[10px] mb-[15px]">
              <div
                onClick={() => setHasHeaders(!hasHeaders)}
                className={`w-[44px] h-[24px] rounded-full cursor-pointer transition-colors relative ${
                  hasHeaders ? 'bg-[#030733]' : darkMode ? 'bg-gray-600' : 'bg-gray-300'
                }`}
              >
                <div className={`absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white transition-all ${
                  hasHeaders ? 'right-[2px]' : 'right-[22px]'
                }`} />
              </div>
              <span className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                השורה הראשונה היא כותרות
              </span>
            </div>

            {/* Column mapping */}
            <div className="flex flex-col gap-[12px] mb-[15px]">
              <p className={`text-[14px] font-medium text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                בחר את סוג כל עמודה:
              </p>

              <div className={`p-[15px] rounded-[10px] flex flex-col gap-[10px] ${darkMode ? 'bg-[#0a1628]' : 'bg-[#f2f3f8]'}`}>
                {excelColumnNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-[10px]">
                    <div className={`w-[120px] text-[12px] px-[10px] py-[6px] rounded-[6px] text-center truncate ${
                      darkMode ? 'bg-[#142241] text-gray-300' : 'bg-white text-[#595C7A]'
                    }`}>
                      {hasHeaders && excelData[0]?.[idx] ? String(excelData[0][idx]) : `עמודה ${idx + 1}`}
                    </div>
                    <span className={`text-[14px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>=</span>
                    <select
                      value={name === 'שם' || name === 'טלפון' || name === '' ? name : 'אחר'}
                      onChange={(e) => {
                        const newNames = [...excelColumnNames]
                        newNames[idx] = e.target.value === 'אחר' ? 'custom_' + idx : e.target.value
                        setExcelColumnNames(newNames)
                      }}
                      className={`w-[130px] h-[36px] px-[12px] rounded-[8px] text-[13px] outline-none text-right appearance-none cursor-pointer ${
                        darkMode ? 'bg-[#142241] text-white' : 'bg-white text-[#030733]'
                      } ${name === 'שם' ? 'border-2 border-green-500' : name === 'טלפון' ? 'border-2 border-blue-500' : ''}`}
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
                        className={`flex-1 h-[36px] px-[12px] rounded-[8px] text-[13px] outline-none text-right ${
                          darkMode ? 'bg-[#142241] text-white placeholder-gray-500' : 'bg-white text-[#030733] placeholder-[#a2a2a2]'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <p className={`text-[12px] mb-[10px] text-right ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
              חובה: לבחור עמודת "טלפון" | מומלץ: לבחור עמודת "שם"
            </p>

            {/* Preview table */}
            <div className={`p-[10px] rounded-[10px] mb-[15px] ${darkMode ? 'bg-[#0a1628]' : 'bg-[#f2f3f8]'}`}>
              <p className={`text-[12px] font-medium mb-[8px] text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                תצוגה מקדימה ({hasHeaders ? excelData.length - 1 : excelData.length} שורות):
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr>
                      {excelColumnNames.map((name, idx) => (
                        <th key={idx} className={`px-[8px] py-[4px] text-right font-medium ${
                          darkMode ? 'text-gray-300' : 'text-[#030733]'
                        }`}>
                          {name || `עמודה ${idx + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(hasHeaders ? excelData.slice(1, 4) : excelData.slice(0, 3)).map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className={`px-[8px] py-[4px] text-right ${
                            darkMode ? 'text-gray-400' : 'text-[#595C7A]'
                          }`}>
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
                className={`w-[100px] h-[40px] rounded-[10px] text-[14px] font-medium ${
                  darkMode ? 'bg-[#0a1628] text-gray-400 hover:text-white' : 'bg-[#f2f3f8] text-[#595C7A] hover:text-[#030733]'
                }`}
              >
                ביטול
              </button>
              <button
                onClick={() => {
                  console.log('Button clicked!')
                  handleAddExcelRecipients()
                }}
                className="flex-1 h-[40px] bg-[#030733] text-white rounded-[10px] text-[14px] font-medium hover:bg-[#0a1628] transition-colors"
              >
                הוסף {hasHeaders ? excelData.length - 1 : excelData.length} נמענים
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exclusion List Column Mapping Popup */}
      {showExclusionPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`w-full max-w-[500px] max-h-[80vh] overflow-y-auto rounded-[15px] p-4 sm:p-[20px] ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}
          >
            <h3 className={`text-[18px] font-semibold mb-[10px] text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              רשימת אי-הכללה
            </h3>
            <p className={`text-[13px] mb-[15px] text-right ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
              {exclusionFileName}
            </p>

            {/* Has Headers Toggle */}
            <div className="flex items-center gap-[10px] mb-[15px]">
              <div
                onClick={() => setExclusionHasHeaders(!exclusionHasHeaders)}
                className={`w-[44px] h-[24px] rounded-full cursor-pointer transition-colors relative ${
                  exclusionHasHeaders ? 'bg-[#030733]' : darkMode ? 'bg-gray-600' : 'bg-gray-300'
                }`}
              >
                <div className={`absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white transition-all ${
                  exclusionHasHeaders ? 'right-[2px]' : 'right-[22px]'
                }`} />
              </div>
              <span className={`text-[14px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                השורה הראשונה היא כותרות
              </span>
            </div>

            {/* Column mapping */}
            <div className="flex flex-col gap-[12px] mb-[15px]">
              <p className={`text-[14px] font-medium text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                בחר את עמודת הטלפון:
              </p>

              <div className={`p-[15px] rounded-[10px] flex flex-col gap-[10px] ${darkMode ? 'bg-[#0a1628]' : 'bg-[#f2f3f8]'}`}>
                {exclusionColumnNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-[10px]">
                    <div className={`w-[120px] text-[12px] px-[10px] py-[6px] rounded-[6px] text-center truncate ${
                      darkMode ? 'bg-[#142241] text-gray-300' : 'bg-white text-[#595C7A]'
                    }`}>
                      {exclusionHasHeaders && exclusionData[0]?.[idx] ? String(exclusionData[0][idx]) : `עמודה ${idx + 1}`}
                    </div>
                    <span className={`text-[14px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>=</span>
                    <select
                      value={name}
                      onChange={(e) => {
                        const newNames = [...exclusionColumnNames]
                        // Clear other phone selections
                        if (e.target.value === 'טלפון') {
                          newNames.forEach((_, i) => { if (newNames[i] === 'טלפון') newNames[i] = '' })
                        }
                        newNames[idx] = e.target.value
                        setExclusionColumnNames(newNames)
                      }}
                      className={`flex-1 h-[36px] px-[12px] rounded-[8px] text-[13px] outline-none text-right appearance-none cursor-pointer ${
                        darkMode ? 'bg-[#142241] text-white' : 'bg-white text-[#030733]'
                      } ${name === 'טלפון' ? 'border-2 border-blue-500' : ''}`}
                    >
                      <option value="">-- לא נבחר --</option>
                      <option value="טלפון">טלפון</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <p className={`text-[12px] mb-[10px] text-right ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
              חובה: לבחור עמודת "טלפון"
            </p>

            {/* Preview table */}
            <div className={`p-[10px] rounded-[10px] mb-[15px] ${darkMode ? 'bg-[#0a1628]' : 'bg-[#f2f3f8]'}`}>
              <p className={`text-[12px] font-medium mb-[8px] text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                תצוגה מקדימה ({exclusionHasHeaders ? exclusionData.length - 1 : exclusionData.length} שורות):
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr>
                      {exclusionColumnNames.map((name, idx) => (
                        <th key={idx} className={`px-[8px] py-[4px] text-right font-medium ${
                          darkMode ? 'text-gray-300' : 'text-[#030733]'
                        }`}>
                          {name || `עמודה ${idx + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(exclusionHasHeaders ? exclusionData.slice(1, 4) : exclusionData.slice(0, 3)).map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className={`px-[8px] py-[4px] text-right ${
                            darkMode ? 'text-gray-400' : 'text-[#595C7A]'
                          }`}>
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
                  setShowExclusionPopup(false)
                  setExclusionData([])
                  setExclusionColumnNames([])
                  setExclusionFileName('')
                }}
                className={`w-[100px] h-[40px] rounded-[10px] text-[14px] font-medium ${
                  darkMode ? 'bg-[#0a1628] text-gray-400 hover:text-white' : 'bg-[#f2f3f8] text-[#595C7A] hover:text-[#030733]'
                }`}
              >
                ביטול
              </button>
              <button
                onClick={handleAddExclusionList}
                className="flex-1 h-[40px] bg-[#030733] text-white rounded-[10px] text-[14px] font-medium hover:bg-[#0a1628] transition-colors"
              >
                הוסף {exclusionHasHeaders ? exclusionData.length - 1 : exclusionData.length} מספרים לאי-הכללה
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exclusion Manual Entry Popup */}
      {showExclusionManualPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`w-full max-w-[400px] rounded-[15px] p-4 sm:p-[20px] ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}
          >
            <h3 className={`text-[18px] font-semibold mb-[15px] text-right ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              הוספת מספר לרשימת אי-הכללה
            </h3>

            <div className="flex flex-col gap-[10px]">
              <div>
                <label className={`text-[13px] mb-[4px] block text-right ${darkMode ? 'text-gray-300' : 'text-[#030733]'}`}>
                  מספר טלפון
                </label>
                <div className="flex gap-[8px]">
                  <input
                    type="text"
                    value={exclusionManualPhone}
                    onChange={(e) => setExclusionManualPhone(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddManualExclusion()
                      }
                    }}
                    placeholder="לדוגמה: 0501234567"
                    className={`flex-1 h-[40px] px-[12px] rounded-[8px] text-[14px] outline-none text-right ${
                      darkMode ? 'bg-[#0a1628] text-white placeholder-gray-500' : 'bg-[#f2f3f8] text-[#030733] placeholder-[#a2a2a2]'
                    }`}
                  />
                  <button
                    onClick={handleAddManualExclusion}
                    disabled={!exclusionManualPhone}
                    className="h-[40px] px-[16px] bg-[#030733] text-white rounded-[8px] text-[13px] font-medium hover:bg-[#0a1628] transition-colors disabled:opacity-50"
                  >
                    הוסף
                  </button>
                </div>
              </div>

              {exclusionList.length > 0 && (
                <div className={`p-[10px] rounded-[8px] ${darkMode ? 'bg-[#0a1628]' : 'bg-[#f2f3f8]'}`}>
                  <p className={`text-[12px] mb-[6px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                    {exclusionList.length} מספרים ברשימה
                  </p>
                  <div className="max-h-[100px] overflow-y-auto space-y-[4px]">
                    {exclusionList.slice(-5).reverse().map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <span className={`text-[12px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                          {item.phone}
                        </span>
                        <button
                          onClick={() => deleteExclusion(item.id)}
                          className={`text-[11px] ${darkMode ? 'text-red-400' : 'text-red-500'}`}
                        >
                          מחק
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setShowExclusionManualPopup(false)
                setExclusionManualPhone('')
              }}
              className={`w-full h-[40px] mt-[15px] rounded-[10px] text-[14px] font-medium ${
                darkMode ? 'bg-[#0a1628] text-gray-400 hover:text-white' : 'bg-[#f2f3f8] text-[#595C7A] hover:text-[#030733]'
              }`}
            >
              סגור
            </button>
          </div>
        </div>
      )}

      {/* Custom Alert Popup */}
      {alertPopup.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div
            className={`w-full max-w-[350px] rounded-[15px] p-4 sm:p-[20px] ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}
          >
            <div className="flex items-center justify-center mb-[15px]">
              <div className={`w-[50px] h-[50px] rounded-full flex items-center justify-center ${
                darkMode ? 'bg-red-900/30' : 'bg-red-100'
              }`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#f87171' : '#dc2626'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
            </div>
            <p
              className={`text-[15px] text-center mb-[20px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}
              dangerouslySetInnerHTML={{ __html: alertPopup.message }}
            />
            <button
              onClick={() => setAlertPopup({ show: false, message: '' })}
              className="w-full h-[40px] bg-[#030733] text-white rounded-[10px] text-[14px] font-medium hover:bg-[#0a1628] transition-colors"
            >
              הבנתי
            </button>
          </div>
        </div>
      )}

      {/* Storage Full Popup */}
      {storageFullPopup.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div
            className={`w-full max-w-[450px] rounded-[15px] p-4 sm:p-[20px] ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}
          >
            <div className="flex items-center justify-center mb-[15px]">
              <div className={`w-[50px] h-[50px] rounded-full flex items-center justify-center ${
                darkMode ? 'bg-orange-900/30' : 'bg-orange-100'
              }`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#fb923c' : '#ea580c'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
            </div>
            <h3 className={`text-[18px] font-semibold text-center mb-2 ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              האחסון שלך מלא
            </h3>
            <p className={`text-[14px] text-center mb-4 ${darkMode ? 'text-white/70' : 'text-[#505050]'}`}>
              נפח האחסון המקסימלי הוא {storageFullPopup.maxStorageMB}MB
            </p>

            {/* Storage bar */}
            <div className={`rounded-lg p-3 mb-4 ${darkMode ? 'bg-[#030733]' : 'bg-[#f2f3f8]'}`}>
              <div className="flex justify-between text-[12px] mb-2">
                <span className={darkMode ? 'text-white/70' : 'text-[#505050]'}>
                  בשימוש: {storageFullPopup.currentUsageMB.toFixed(1)}MB
                </span>
                <span className={darkMode ? 'text-white/70' : 'text-[#505050]'}>
                  {storageFullPopup.maxStorageMB}MB
                </span>
              </div>
              <div className={`h-2 rounded-full ${darkMode ? 'bg-white/10' : 'bg-gray-200'}`}>
                <div
                  className="h-full rounded-full bg-orange-500"
                  style={{ width: `${Math.min(100, (storageFullPopup.currentUsageMB / storageFullPopup.maxStorageMB) * 100)}%` }}
                />
              </div>
              <p className={`text-[11px] mt-2 ${darkMode ? 'text-white/50' : 'text-[#505050]'}`}>
                גודל הקובץ שניסית להעלות: {storageFullPopup.fileSizeMB.toFixed(1)}MB
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStorageFullPopup({ ...storageFullPopup, show: false })}
                className={`flex-1 h-[40px] rounded-[10px] text-[14px] font-medium transition-colors ${
                  darkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-[#f2f3f8] text-[#030733] hover:bg-gray-200'
                }`}
              >
                סגור
              </button>
              <button
                onClick={() => {
                  setStorageFullPopup({ ...storageFullPopup, show: false })
                  setStorageManagePopup(true)
                  loadStoredFiles()
                }}
                className="flex-1 h-[40px] bg-[#0043e0] text-white rounded-[10px] text-[14px] font-medium hover:bg-[#0036b3] transition-colors"
              >
                נהל אחסון
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Storage Management Popup */}
      {storageManagePopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div
            className={`w-full max-w-[600px] max-h-[80vh] rounded-[15px] overflow-hidden flex flex-col ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}
          >
            {/* Header */}
            <div className={`p-4 border-b ${darkMode ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-[18px] font-semibold ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                  ניהול אחסון
                </h3>
                <button
                  onClick={() => {
                    setStorageManagePopup(false)
                    setSelectedFilesToDelete(new Set())
                  }}
                  className={`p-1 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                >
                  <X className={`w-5 h-5 ${darkMode ? 'text-white' : 'text-[#030733]'}`} />
                </button>
              </div>

              {/* Storage bar */}
              <div className={`rounded-lg p-3 ${darkMode ? 'bg-[#030733]' : 'bg-[#f2f3f8]'}`}>
                <div className="flex justify-between text-[12px] mb-2">
                  <span className={darkMode ? 'text-white/70' : 'text-[#505050]'}>
                    בשימוש: {(getTotalStorageUsed() / (1024 * 1024)).toFixed(1)}MB
                  </span>
                  <span className={darkMode ? 'text-white/70' : 'text-[#505050]'}>
                    512MB
                  </span>
                </div>
                <div className={`h-2 rounded-full ${darkMode ? 'bg-white/10' : 'bg-gray-200'}`}>
                  <div
                    className={`h-full rounded-full transition-all ${
                      getTotalStorageUsed() / (1024 * 1024) > 400 ? 'bg-orange-500' : 'bg-[#0043e0]'
                    }`}
                    style={{ width: `${Math.min(100, (getTotalStorageUsed() / (1024 * 1024) / 512) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingFiles ? (
                <div className="flex items-center justify-center py-8">
                  <div className={`text-[14px] ${darkMode ? 'text-white/70' : 'text-[#505050]'}`}>
                    טוען קבצים...
                  </div>
                </div>
              ) : storedFiles.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className={`text-[14px] ${darkMode ? 'text-white/70' : 'text-[#505050]'}`}>
                    אין קבצים באחסון
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {storedFiles.map((file) => (
                    <div
                      key={file.path}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        selectedFilesToDelete.has(file.path)
                          ? darkMode ? 'bg-red-900/30' : 'bg-red-50'
                          : darkMode ? 'bg-[#030733] hover:bg-[#0a1155]' : 'bg-[#f2f3f8] hover:bg-gray-200'
                      }`}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedFilesToDelete.has(file.path)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedFilesToDelete)
                          if (e.target.checked) {
                            newSelected.add(file.path)
                          } else {
                            newSelected.delete(file.path)
                          }
                          setSelectedFilesToDelete(newSelected)
                        }}
                        className="w-4 h-4 rounded"
                      />

                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        file.type === 'audio' ? 'bg-purple-500/20' :
                        file.type === 'image' ? 'bg-blue-500/20' : 'bg-gray-500/20'
                      }`}>
                        {file.type === 'audio' ? (
                          <Mic className="w-4 h-4 text-purple-400" />
                        ) : file.type === 'image' ? (
                          <Image className="w-4 h-4 text-blue-400" />
                        ) : (
                          <FileText className="w-4 h-4 text-gray-400" />
                        )}
                      </div>

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] truncate ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
                          {file.name.split('_').slice(2).join('_') || file.name}
                        </p>
                        <p className={`text-[11px] ${darkMode ? 'text-white/50' : 'text-[#505050]'}`}>
                          {formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString('he-IL')}
                        </p>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => deleteSingleFile(file.path)}
                        disabled={deletingFiles.has(file.path)}
                        className={`p-2 rounded-lg transition-colors ${
                          deletingFiles.has(file.path)
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-red-500/20'
                        }`}
                      >
                        <Trash2 className={`w-4 h-4 ${darkMode ? 'text-red-400' : 'text-red-500'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`p-4 border-t ${darkMode ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setStorageManagePopup(false)
                    setSelectedFilesToDelete(new Set())
                  }}
                  className={`flex-1 h-[40px] rounded-[10px] text-[14px] font-medium transition-colors ${
                    darkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-[#f2f3f8] text-[#030733] hover:bg-gray-200'
                  }`}
                >
                  סגור
                </button>
                {selectedFilesToDelete.size > 0 && (
                  <button
                    onClick={deleteSelectedFiles}
                    disabled={deletingFiles.size > 0}
                    className="flex-1 h-[40px] bg-red-500 text-white rounded-[10px] text-[14px] font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    מחק {selectedFilesToDelete.size} קבצים
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Popup */}
      {confirmPopup.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div
            className={`w-full max-w-[400px] rounded-[15px] p-4 sm:p-[20px] ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}
          >
            <div className="flex items-center justify-center mb-[15px]">
              <div className={`w-[50px] h-[50px] rounded-full flex items-center justify-center ${
                darkMode ? 'bg-yellow-900/30' : 'bg-yellow-100'
              }`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#fbbf24' : '#d97706'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
            </div>
            <p className={`text-[15px] text-center mb-[20px] whitespace-pre-line ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              {confirmPopup.message}
            </p>
            <div className="flex gap-[10px]">
              <button
                onClick={() => setConfirmPopup({ show: false, message: '', confirmText: '', onConfirm: () => {} })}
                className={`flex-1 h-[40px] rounded-[10px] text-[14px] font-medium ${
                  darkMode ? 'bg-[#0a1628] text-gray-400 hover:text-white' : 'bg-[#f2f3f8] text-[#595C7A] hover:text-[#030733]'
                }`}
              >
                ביטול
              </button>
              <button
                onClick={() => {
                  confirmPopup.onConfirm()
                  setConfirmPopup({ show: false, message: '', confirmText: '', onConfirm: () => {} })
                }}
                className="flex-1 h-[40px] bg-[#030733] text-white rounded-[10px] text-[14px] font-medium hover:bg-[#0a1628] transition-colors"
              >
                {confirmPopup.confirmText || 'המשך בכל זאת'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Page Confirmation Popup */}
      {leavePagePopup.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div
            className={`w-full max-w-[400px] rounded-[15px] p-4 sm:p-[20px] ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}
          >
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
              אם תעזוב את הדף, תאבד את כל הנתונים שהזנת.
              <br />
              <strong>אם תרצה, תוכל לשמור את הקמפיין כטיוטה</strong> - לחץ על כפתור "שמור כטיוטה"
            </p>
            <div className="flex flex-col gap-[10px]">
              <button
                onClick={async () => {
                  // Save as draft
                  await handleSaveDraft()
                  // Then navigate
                  setFormModified(false)
                  if (leavePagePopup.pendingUrl) {
                    router.push(leavePagePopup.pendingUrl)
                  }
                  setLeavePagePopup({ show: false })
                }}
                className="w-full h-[40px] bg-[#0043e0] text-white rounded-[10px] text-[14px] font-medium hover:bg-[#0036b3] transition-colors"
                disabled={savingDraft}
              >
                {savingDraft ? 'שומר...' : 'שמור כטיוטה ועזוב'}
              </button>
              <div className="flex gap-[10px]">
                <button
                  onClick={cancelLeavePage}
                  className={`flex-1 h-[40px] rounded-[10px] text-[14px] font-medium ${
                    darkMode ? 'bg-[#0a1628] text-gray-400 hover:text-white' : 'bg-[#f2f3f8] text-[#595C7A] hover:text-[#030733]'
                  } transition-colors`}
                >
                  להישאר בדף
                </button>
                <button
                  onClick={confirmLeavePage}
                  className="flex-1 h-[40px] bg-red-600 text-white rounded-[10px] text-[14px] font-medium hover:bg-red-700 transition-colors"
                >
                  עזוב ומחק הכל
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Recipient Confirm Popup */}
      {deleteConfirmPopup.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div
            className={`w-full max-w-[380px] rounded-[15px] p-4 sm:p-[20px] ${darkMode ? 'bg-[#142241]' : 'bg-white'}`}
          >
            <div className="flex items-center justify-center mb-[15px]">
              <div className={`w-[50px] h-[50px] rounded-full flex items-center justify-center ${
                darkMode ? 'bg-red-900/30' : 'bg-red-100'
              }`}>
                <Trash2 className={`w-[24px] h-[24px] ${darkMode ? 'text-red-400' : 'text-red-600'}`} />
              </div>
            </div>
            <p className={`text-[16px] font-semibold text-center mb-[8px] ${darkMode ? 'text-white' : 'text-[#030733]'}`}>
              האם למחוק את הנמען?
            </p>
            <p className={`text-[14px] text-center mb-[20px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
              {deleteConfirmPopup.recipientName}
            </p>

            {/* Don't show again checkbox */}
            <div
              onClick={() => setDeleteConfirmPopup(prev => ({ ...prev, dontShowAgain: !prev.dontShowAgain }))}
              className={`flex items-center gap-[8px] mb-[20px] cursor-pointer justify-center`}
            >
              <div className={`w-[18px] h-[18px] rounded-[4px] border-2 flex items-center justify-center transition-colors ${
                deleteConfirmPopup.dontShowAgain
                  ? 'bg-[#030733] border-[#030733]'
                  : darkMode ? 'border-gray-500' : 'border-gray-300'
              }`}>
                {deleteConfirmPopup.dontShowAgain && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className={`text-[13px] ${darkMode ? 'text-gray-400' : 'text-[#595C7A]'}`}>
                לא להציג הודעה זו שוב
              </span>
            </div>

            <div className="flex gap-[10px]">
              <button
                onClick={() => setDeleteConfirmPopup({ show: false, recipientId: '', recipientName: '', dontShowAgain: false })}
                className={`flex-1 h-[40px] rounded-[10px] text-[14px] font-medium ${
                  darkMode ? 'bg-[#0a1628] text-gray-400 hover:text-white' : 'bg-[#f2f3f8] text-[#595C7A] hover:text-[#030733]'
                }`}
              >
                ביטול
              </button>
              <button
                onClick={confirmDeleteRecipient}
                className="flex-1 h-[40px] bg-[#cd1b1b] text-white rounded-[10px] text-[14px] font-medium hover:bg-[#b01818] transition-colors"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variation Save Popup */}
      {showVariationSavePopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="w-full max-w-[400px] rounded-[20px] overflow-hidden relative" style={{ backgroundColor: '#030733' }}>
            {/* Decorative blur ellipses */}
            <div className="absolute top-[-50px] right-[-50px] w-[200px] h-[200px] rounded-full opacity-30" style={{ background: 'radial-gradient(circle, #0066FF 0%, transparent 70%)' }} />
            <div className="absolute bottom-[-30px] left-[-30px] w-[150px] h-[150px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #0066FF 0%, transparent 70%)' }} />

            {/* Close button */}
            <button
              onClick={() => {
                setShowVariationSavePopup(false)
                setPendingVariationMessage('')
              }}
              className="absolute top-[15px] left-[15px] text-white/60 hover:text-white transition-colors z-10"
            >
              <X className="w-[20px] h-[20px]" />
            </button>

            <div className="relative z-10 p-[25px]">
              <h3 className="text-[20px] font-bold text-white text-center mb-[8px]">
                שמירת הודעה {currentVariationIndex + 1}/{variationCount}
              </h3>
              <p className="text-[14px] text-gray-400 text-center mb-[20px]">
                האם לשמור את ההודעה כוריאציה מספר {currentVariationIndex + 1}?
              </p>

              {/* Preview of the message */}
              <div className={`p-[12px] rounded-[10px] mb-[20px] max-h-[100px] overflow-y-auto ${darkMode ? 'bg-white/10' : 'bg-white/10'}`}>
                <p className="text-[13px] text-white/80 whitespace-pre-wrap break-words">
                  {pendingVariationMessage}
                </p>
              </div>

              <div className="flex gap-[10px]">
                <button
                  onClick={() => {
                    setShowVariationSavePopup(false)
                    setPendingVariationMessage('')
                  }}
                  className="flex-1 h-[45px] rounded-[10px] text-[14px] font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  ביטול
                </button>
                <button
                  onClick={handleSaveVariation}
                  className="flex-1 h-[45px] bg-white text-[#030733] rounded-[10px] text-[14px] font-semibold hover:bg-gray-100 transition-colors"
                >
                  שמור הודעה {currentVariationIndex + 1}/{variationCount}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cell Tooltip for truncated text */}
      {cellTooltip && (
        <div
          className="fixed z-[100] px-3 py-2 bg-[#030733] text-white text-[12px] rounded-lg shadow-lg max-w-[300px] break-words whitespace-pre-wrap pointer-events-none"
          style={{
            left: cellTooltip.x,
            top: cellTooltip.y,
            transform: 'translate(-50%, -100%)'
          }}
        >
          {cellTooltip.text}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#030733]"
          />
        </div>
      )}

    </div>
  )
}

// Wrap with Suspense to handle useSearchParams
export default function NewCampaignPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">טוען...</div>}>
      <NewCampaignContent />
    </Suspense>
  )
}
