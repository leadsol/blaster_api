'use client'

import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  showCloseButton?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({
  isOpen,
  onClose,
  children,
  showCloseButton = true,
  size = 'md'
}: ModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'w-[400px]',
    md: 'w-[524px]',
    lg: 'w-[680px]'
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      dir="rtl"
    >
      <div
        className={`${sizeClasses[size]} relative bg-[#030733] rounded-[24px] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative glowing ellipses */}
        <div
          className="absolute w-[257px] h-[257px] -bottom-[12px] -left-[70px] rounded-full pointer-events-none"
          style={{
            background: 'rgba(0, 67, 224, 0.22)',
            filter: 'blur(100px)'
          }}
        />
        <div
          className="absolute w-[257px] h-[257px] -top-[200px] -right-[10px] rounded-full pointer-events-none"
          style={{
            background: 'rgba(0, 67, 224, 0.22)',
            filter: 'blur(100px)'
          }}
        />

        {/* Close button */}
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-[17px] right-[20px] p-1.5 hover:bg-white/10 rounded-lg transition-colors z-10"
          >
            <X className="w-[17px] h-[17px] text-white" />
          </button>
        )}

        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </div>
  )
}
