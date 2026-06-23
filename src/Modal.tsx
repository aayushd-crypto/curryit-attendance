import { X } from 'lucide-react'
import React from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative rounded-2xl shadow-xl w-full ${widths[size]}`}
          style={{ background: 'var(--dropdown-bg)' }}
          onClick={e => e.stopPropagation()}>
          {/* Sticky header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-gray-100 rounded-t-2xl"
            style={{ background: 'var(--dropdown-bg)' }}>
            <h2 className="font-semibold text-gray-900">{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="px-5 py-5">{children}</div>
        </div>
      </div>
    </div>
  )
}
