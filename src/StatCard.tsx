import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color: 'green' | 'red' | 'orange' | 'purple' | 'blue' | 'gray'
  sub?: string
}

const colorMap = {
  green:  { tint: '#E8F8EE', icon: '#34C759', text: '#1D7A3E' },
  red:    { tint: '#FDEEEE', icon: '#FF3B30', text: '#C0271E' },
  orange: { tint: '#FDF0EA', icon: '#E8531D', text: '#B23C0E' },
  purple: { tint: '#F3EFFC', icon: '#AF52DE', text: '#7E3AA8' },
  blue:   { tint: '#EAF3FD', icon: '#007AFF', text: '#0A5BC4' },
  gray:   { tint: '#F2F2F4', icon: '#8E8E93', text: '#3A3A3C' },
}

export function StatCard({ label, value, icon: Icon, color, sub }: StatCardProps) {
  const c = colorMap[color]
  return (
    <div className="card p-5">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
        style={{ background: c.tint }}>
        <Icon size={17} strokeWidth={2.2} style={{ color: c.icon }} />
      </div>
      <p className="text-[32px] font-bold leading-none tracking-tight mb-1.5" style={{ color: c.text }}>{value}</p>
      <p className="text-[13px] font-medium text-gray-500">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
