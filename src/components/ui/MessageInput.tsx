'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Smile,
  Paperclip,
  Mic,
  Send,
  X,
  FileText,
  Camera,
  BarChart3,
  Image,
  User,
  Zap,
  Square,
  Trash2
} from 'lucide-react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'

interface MessageInputProps {
  value: string
  onChange: (value: string) => void
  onSend?: () => void
  onAttachment?: (type: 'document' | 'camera' | 'survey' | 'image' | 'contact' | 'quickReply', file?: File) => void
  onVoiceRecording?: (audioBlob: Blob) => void
  placeholder?: string
  darkMode?: boolean
  showSendButton?: boolean
  disabled?: boolean
  maxLength?: number
  rows?: number
  className?: string
  inputClassName?: string
}

export default function MessageInput({
  value,
  onChange,
  onSend,
  onAttachment,
  onVoiceRecording,
  placeholder = 'הקלד הודעה...',
  darkMode = false,
  showSendButton = true,
  disabled = false,
  maxLength,
  rows = 3,
  className = '',
  inputClassName = '',
}: MessageInputProps) {
  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)

  // Attachments menu state
  const [showAttachmentsMenu, setShowAttachmentsMenu] = useState(false)
  const attachmentsMenuRef = useRef<HTMLDivElement>(null)
  const attachmentsButtonRef = useRef<HTMLButtonElement>(null)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // File input refs
  const documentInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Textarea ref
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmojiPicker])

  // Close attachments menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
  }, [showAttachmentsMenu])

  // Handle emoji selection
  const handleEmojiSelect = (emoji: { native: string }) => {
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = value.substring(0, start) + emoji.native + value.substring(end)
      onChange(newValue)
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.native.length
        textarea.focus()
      }, 0)
    } else {
      onChange(value + emoji.native)
    }
    setShowEmojiPicker(false)
  }

  // Handle voice recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('לא ניתן לגשת למיקרופון. אנא בדוק את ההרשאות.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
    }
  }, [isRecording])

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    setAudioBlob(null)
    setRecordingTime(0)
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }
  }, [isRecording])

  const sendRecording = useCallback(() => {
    if (audioBlob && onVoiceRecording) {
      onVoiceRecording(audioBlob)
      setAudioBlob(null)
      setRecordingTime(0)
    }
  }, [audioBlob, onVoiceRecording])

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Handle attachment selection
  const handleAttachmentClick = (type: 'document' | 'camera' | 'survey' | 'image' | 'contact' | 'quickReply') => {
    setShowAttachmentsMenu(false)

    switch (type) {
      case 'document':
        documentInputRef.current?.click()
        break
      case 'image':
        imageInputRef.current?.click()
        break
      case 'camera':
        cameraInputRef.current?.click()
        break
      case 'survey':
      case 'contact':
      case 'quickReply':
        onAttachment?.(type)
        break
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'document' | 'image' | 'camera') => {
    const file = event.target.files?.[0]
    if (file) {
      onAttachment?.(type, file)
    }
    event.target.value = ''
  }

  // Handle send
  const handleSend = () => {
    if (value.trim() && onSend) {
      onSend()
    }
  }

  // Handle key down
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && onSend) {
      e.preventDefault()
      handleSend()
    }
  }

  // Attachments menu items
  const attachmentItems = [
    { type: 'document' as const, icon: FileText, label: 'הוספת מסמך', color: 'text-purple-500' },
    { type: 'camera' as const, icon: Camera, label: 'מצלמה', color: 'text-pink-500' },
    { type: 'survey' as const, icon: BarChart3, label: 'הוספת סקר', color: 'text-green-500' },
    { type: 'image' as const, icon: Image, label: 'הוספת תמונה', color: 'text-blue-500' },
    { type: 'contact' as const, icon: User, label: 'שיתוף איש קשר', color: 'text-cyan-500' },
    { type: 'quickReply' as const, icon: Zap, label: 'מענה מהיר', color: 'text-yellow-500' },
  ]

  return (
    <div className={`relative ${className}`}>
      {/* Hidden file inputs */}
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'document')}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'image')}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'camera')}
      />

      {/* Recording UI */}
      {(isRecording || audioBlob) && (
        <div className={`absolute inset-0 z-10 flex items-center justify-between px-4 rounded-[10px] ${
          darkMode ? 'bg-[#142241]' : 'bg-white'
        }`}>
          <div className="flex items-center gap-3">
            {isRecording ? (
              <>
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  מקליט... {formatTime(recordingTime)}
                </span>
              </>
            ) : (
              <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                הקלטה קולית ({formatTime(recordingTime)})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cancelRecording}
              className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
              title="ביטול"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            {isRecording ? (
              <button
                onClick={stopRecording}
                className="p-2 text-white bg-red-500 hover:bg-red-600 rounded-full transition-colors"
                title="עצור הקלטה"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                onClick={sendRecording}
                className="p-2 text-white bg-green-500 hover:bg-green-600 rounded-full transition-colors"
                title="שלח הקלטה"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main input container */}
      <div className={`relative rounded-[10px] ${
        darkMode ? 'bg-[#142241]' : 'bg-white'
      } ${isRecording || audioBlob ? 'invisible' : ''}`}>
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          rows={rows}
          className={`w-full p-3 pb-12 rounded-[10px] resize-none outline-none text-sm ${
            darkMode
              ? 'bg-[#142241] text-white placeholder-gray-400'
              : 'bg-white text-gray-800 placeholder-gray-400'
          } ${inputClassName}`}
          dir="rtl"
        />

        {/* Bottom toolbar */}
        <div className={`absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 border-t ${
          darkMode ? 'border-[#1e3a5f]' : 'border-gray-100'
        }`}>
          {/* Right side - attachment and emoji buttons */}
          <div className="flex items-center gap-1">
            {/* Attachment button */}
            <button
              ref={attachmentsButtonRef}
              onClick={() => setShowAttachmentsMenu(!showAttachmentsMenu)}
              className={`p-1.5 rounded-full transition-colors ${
                darkMode
                  ? 'text-gray-400 hover:text-white hover:bg-[#1e3a5f]'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title="הוספת קובץ"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Emoji button */}
            <button
              ref={emojiButtonRef}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-1.5 rounded-full transition-colors ${
                darkMode
                  ? 'text-gray-400 hover:text-white hover:bg-[#1e3a5f]'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title="הוספת אימוג'י"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Voice recording button */}
            {onVoiceRecording && (
              <button
                onClick={startRecording}
                className={`p-1.5 rounded-full transition-colors ${
                  darkMode
                    ? 'text-gray-400 hover:text-white hover:bg-[#1e3a5f]'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title="הקלטה קולית"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Left side - character count and send button */}
          <div className="flex items-center gap-2">
            {maxLength && (
              <span className={`text-xs ${
                darkMode ? 'text-gray-500' : 'text-gray-400'
              }`}>
                {value.length}/{maxLength}
              </span>
            )}
            {showSendButton && onSend && (
              <button
                onClick={handleSend}
                disabled={!value.trim() || disabled}
                className={`p-1.5 rounded-full transition-colors ${
                  value.trim() && !disabled
                    ? 'text-white bg-green-500 hover:bg-green-600'
                    : darkMode
                      ? 'text-gray-600 bg-[#1e3a5f]'
                      : 'text-gray-400 bg-gray-100'
                }`}
                title="שלח"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="absolute bottom-full mb-2 right-0 z-50"
        >
          <Picker
            data={data}
            onEmojiSelect={handleEmojiSelect}
            theme={darkMode ? 'dark' : 'light'}
            locale="he"
            previewPosition="none"
            skinTonePosition="search"
            searchPosition="sticky"
            navPosition="top"
            perLine={8}
            maxFrequentRows={2}
          />
        </div>
      )}

      {/* Attachments Menu Popup */}
      {showAttachmentsMenu && (
        <div
          ref={attachmentsMenuRef}
          className={`absolute bottom-full mb-2 right-0 z-50 w-[200px] rounded-[12px] shadow-lg overflow-hidden ${
            darkMode ? 'bg-[#142241] border border-[#1e3a5f]' : 'bg-white border border-gray-200'
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-3 py-2 border-b ${
            darkMode ? 'border-[#1e3a5f]' : 'border-gray-100'
          }`}>
            <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              הוספת קובץ
            </span>
            <button
              onClick={() => setShowAttachmentsMenu(false)}
              className={`p-1 rounded-full transition-colors ${
                darkMode ? 'hover:bg-[#1e3a5f] text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Menu items */}
          <div className="py-1">
            {attachmentItems.map((item) => (
              <button
                key={item.type}
                onClick={() => handleAttachmentClick(item.type)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-right transition-colors ${
                  darkMode
                    ? 'hover:bg-[#1e3a5f] text-white'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  darkMode ? 'bg-[#1e3a5f]' : 'bg-gray-100'
                }`}>
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <span className="text-sm">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
