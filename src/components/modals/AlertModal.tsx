'use client'

import { Modal } from './Modal'
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message?: string
  type?: 'success' | 'error' | 'warning' | 'info'
  confirmText?: string
}

const typeConfig = {
  success: {
    icon: CheckCircle,
    iconBg: 'bg-[#187C55]/20',
    iconColor: 'text-[#4ADE80]'
  },
  error: {
    icon: AlertCircle,
    iconBg: 'bg-[#CD1B1B]/20',
    iconColor: 'text-[#FF6B6B]'
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-[#FFD700]/20',
    iconColor: 'text-[#FFD700]'
  },
  info: {
    icon: Info,
    iconBg: 'bg-[#0043E0]/20',
    iconColor: 'text-[#6B9AFF]'
  }
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'הבנתי'
}: AlertModalProps) {
  const config = typeConfig[type]
  const Icon = config.icon

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="px-8 py-10 text-center">
        {/* Icon */}
        <div className={`w-16 h-16 ${config.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Icon className={`w-8 h-8 ${config.iconColor}`} />
        </div>

        {/* Title */}
        <h3 className="text-[20px] font-semibold text-white mb-2">
          {title}
        </h3>

        {/* Message */}
        {message && (
          <p className="text-[14px] text-[#A8A8A8] mb-8">
            {message}
          </p>
        )}

        {/* Confirm button */}
        <button
          onClick={onClose}
          className="px-8 py-[11px] rounded-[10px] text-[12px] font-semibold bg-white text-[#030733] hover:bg-[#0043E0] hover:text-white transition-colors mt-4"
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}
