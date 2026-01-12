'use client'

import { useState } from 'react'
import {
  HelpCircle,
  MessageSquare,
  Bug,
  Lightbulb,
  CreditCard,
  Upload,
  Send,
  Loader2,
  CheckCircle,
  X
} from 'lucide-react'
import { Modal } from './Modal'

interface SupportModalProps {
  isOpen: boolean
  onClose: () => void
}

type TicketType = 'question' | 'bug' | 'feature' | 'billing' | null

const ticketTypes = [
  { id: 'question', label: 'שאלה כללית', icon: HelpCircle, color: 'bg-[#0043E0]/20 text-[#6B9AFF]' },
  { id: 'bug', label: 'דיווח על באג', icon: Bug, color: 'bg-[#CD1B1B]/20 text-[#FF6B6B]' },
  { id: 'feature', label: 'בקשת פיצ\'ר', icon: Lightbulb, color: 'bg-[#FFD700]/20 text-[#FFD700]' },
  { id: 'billing', label: 'חשבונית ותשלום', icon: CreditCard, color: 'bg-[#187C55]/20 text-[#4ADE80]' },
]

export function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const [ticketType, setTicketType] = useState<TicketType>(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Map ticket type to category
      const categoryMap: Record<string, string> = {
        question: 'other',
        bug: 'technical',
        feature: 'feature',
        billing: 'billing',
      }

      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          description: message,
          category: categoryMap[ticketType || 'other'],
          priority: ticketType === 'bug' ? 'high' : 'medium',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit ticket')
      }

      setSubmitted(true)

      // Auto close after success
      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch (error) {
      console.error('Error submitting support ticket:', error)
      alert('אירעה שגיאה בשליחת הפנייה. אנא נסה שוב.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setTicketType(null)
    setSubject('')
    setMessage('')
    setAttachments([])
    setSubmitted(false)
    onClose()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)])
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <div className="max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0043E0]/30 rounded-[10px] flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-[#6B9AFF]" />
            </div>
            <div>
              <h3 className="text-[18px] font-semibold text-white">פתיחת פנייה</h3>
              <p className="text-[14px] text-[#A8A8A8]">נשמח לעזור לך בכל שאלה</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-[#187C55]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-[#4ADE80]" />
              </div>
              <h3 className="text-[18px] font-semibold text-white mb-2">הפנייה נשלחה בהצלחה!</h3>
              <p className="text-[#A8A8A8] text-[14px]">נחזור אליך בהקדם האפשרי</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Ticket Type */}
              <div>
                <label className="block text-[14px] font-medium text-white mb-3">
                  סוג הפנייה
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {ticketTypes.map((type) => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setTicketType(type.id as TicketType)}
                        className={`p-4 rounded-[10px] border-2 text-right transition-all flex items-center gap-3 ${
                          ticketType === type.id
                            ? 'border-[#0043E0] bg-[#0043E0]/10'
                            : 'border-white/10 hover:border-white/30 bg-white/5'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center ${type.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="font-medium text-white text-[14px]">{type.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[14px] font-medium text-white mb-2">
                  נושא
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="תאר בקצרה את הנושא"
                  className="w-full h-[49px] px-4 bg-white/5 border border-white/10 rounded-[10px] text-white placeholder-[#A8A8A8] outline-none focus:ring-2 focus:ring-[#0043E0] focus:border-transparent text-[14px]"
                  required
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-[14px] font-medium text-white mb-2">
                  תיאור מפורט
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="ספר לנו יותר על הבעיה או הבקשה שלך..."
                  rows={4}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-[10px] text-white placeholder-[#A8A8A8] outline-none focus:ring-2 focus:ring-[#0043E0] focus:border-transparent resize-none text-[14px]"
                  required
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-[14px] font-medium text-white mb-2">
                  קבצים מצורפים (אופציונלי)
                </label>
                <div className="border-2 border-dashed border-white/20 rounded-[10px] p-4 hover:border-[#0043E0] transition-colors">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    accept="image/*,.pdf,.doc,.docx"
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center cursor-pointer"
                  >
                    <Upload className="w-8 h-8 text-[#A8A8A8] mb-2" />
                    <span className="text-[14px] text-white">גרור קבצים או לחץ להעלאה</span>
                    <span className="text-[12px] text-[#A8A8A8] mt-1">PNG, JPG, PDF עד 10MB</span>
                  </label>
                </div>
                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white/5 border border-white/10 rounded-[8px] px-3 py-2"
                      >
                        <span className="text-[14px] text-white truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="text-[#A8A8A8] hover:text-[#FF6B6B] transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact Info Note */}
              <div className="bg-[#0043E0]/10 border border-[#0043E0]/30 rounded-[10px] p-4 text-[14px] text-white">
                <p>
                  <strong>שים לב:</strong> נשלח את התשובה לכתובת המייל הרשומה בחשבונך.
                  זמן תגובה ממוצע: עד 24 שעות בימי עסקים.
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
          <div className="p-6 border-t border-white/10 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 h-[49px] border border-white/20 rounded-[10px] text-[#A8A8A8] font-medium hover:bg-white/5 hover:text-white transition-colors"
            >
              ביטול
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !ticketType || !subject || !message}
              className="flex-1 h-[49px] bg-white text-[#030733] rounded-[10px] hover:bg-[#0043E0] hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-[#030733] flex items-center justify-center gap-2 font-semibold"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  שלח פנייה
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
