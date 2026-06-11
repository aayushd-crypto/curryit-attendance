import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color: 'green' | 'red' | 'orange' | 'purple' | 'blue' | 'gray'
  sub?: string
}

const colorMap = {
  green:  { bg: 'bg-green-50',  icon: 'bg-green-100 text-green-600',  value: 'text-green-700'  },
  red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-600',      value: 'text-red-700'    },
  orange: { bg: 'bg-brand-50',  icon: 'bg-brand-100 text-brand-600',  value: 'text-brand-700'  },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600',value: 'text-purple-700' },
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',    value: 'text-blue-700'   },
  gray:   { bg: 'bg-gray-50',   icon: 'bg-gray-100 text-gray-600',    value: 'text-gray-700'   },
}

export function StatCard({ label, value, icon: Icon, color, sub }: StatCardProps) {
  const c = colorMap[color]
  return (
    <div className={`card p-5 ${c.bg}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-gray-600 font-medium">{label}</p>
        <div className={`p-2 rounded-xl ${c.icon}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className={`text-3xl font-bold ${c.value}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}
