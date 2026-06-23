import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color: 'green' | 'red' | 'orange' | 'purple' | 'blue' | 'gray'
  sub?: string
}

const colorMap = {
  green:  { grad: 'linear-gradient(135deg, #10B981, #059669)', glow: 'rgba(16,185,129,0.25)',  bg: '#F0FDF4', text: '#065F46' },
  red:    { grad: 'linear-gradient(135deg, #EF4444, #DC2626)', glow: 'rgba(239,68,68,0.25)',   bg: '#FEF2F2', text: '#991B1B' },
  orange: { grad: 'linear-gradient(135deg, #E8531D, #C44010)', glow: 'rgba(232,83,29,0.25)',   bg: '#FFF7F4', text: '#9A3412' },
  purple: { grad: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', glow: 'rgba(139,92,246,0.25)',  bg: '#F5F3FF', text: '#5B21B6' },
  blue:   { grad: 'linear-gradient(135deg, #3B82F6, #2563EB)', glow: 'rgba(59,130,246,0.25)',  bg: '#EFF6FF', text: '#1E40AF' },
  gray:   { grad: 'linear-gradient(135deg, #6B7280, #4B5563)', glow: 'rgba(107,114,128,0.2)',  bg: '#F9FAFB', text: '#1F2937' },
}

export function StatCard({ label, value, icon: Icon, color, sub }: StatCardProps) {
  const c = colorMap[color]
  return (
    <div className="rounded-2xl p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: c.bg,
        border: `1px solid ${c.glow.replace('0.25', '0.2')}`,
        boxShadow: `0 2px 8px ${c.glow}, 0 1px 3px rgba(0,0,0,0.04)`,
      }}>
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="p-2.5 rounded-xl" style={{ background: c.grad, boxShadow: `0 4px 14px ${c.glow}` }}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <p className="text-2xl sm:text-4xl font-black leading-none mb-2 tracking-tight truncate" style={{ color: c.text }}>{value}</p>
      <p className="text-sm font-semibold text-gray-600">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
