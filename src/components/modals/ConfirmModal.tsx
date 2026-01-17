'use client'

import { Loader2 } from 'lucide-react'
import { Modal } from './Modal'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  subtitle?: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'default'
  loading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  confirmText = 'כן אני בטוח',
  cancelText = 'לא, תחזור אחורה',
  variant = 'default',
  loading = false
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="px-8 py-10 text-center">
        {/* Title */}
        <h3 className="text-[20px] font-semibold text-white mb-2">
          {title}
        </h3>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-[14px] text-[#A8A8A8] mb-8">
            {subtitle}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-col items-center gap-4 mt-12">
          {/* Confirm button */}
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`
              px-8 py-[11px] rounded-[10px] text-[12px] font-semibold transition-colors flex items-center gap-2
              ${loading ? 'opacity-70 cursor-not-allowed' : ''}
              ${variant === 'danger'
                ? 'bg-white text-[#030733] hover:bg-[#CD1B1B] hover:text-white'
                : 'bg-white text-[#030733] hover:bg-[#0043E0] hover:text-white'
              }
            `}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>

          {/* Cancel button */}
          <button
            onClick={onClose}
            disabled={loading}
            className={`text-[12px] font-light text-[#A8A8A8] hover:text-white transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
