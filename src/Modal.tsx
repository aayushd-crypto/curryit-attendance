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
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-3xl' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', background: 'rgba(15,23,42,0.2)' }}
      onClick={onClose}>
      <div
        className={`relative rounded-2xl shadow-2xl w-full ${widths[size]} mx-4`}
        style={{ background: 'var(--dropdown-bg)' }}
        onClick={e => e.stopPropagation()}>
        {/* Header — always visible */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 rounded-t-2xl">
          <h2 className="font-semibold text-gray-900 text-base">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
