import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color: 'green' | 'red' | 'orange' | 'purple' | 'blue' | 'gray'
  sub?: string
  trend?: number
}

const colorMap = {
  green:  { bg: 'bg-green-50',  icon: 'bg-green-500',  text: 'text-green-600',  shadow: 'shadow-green-500/20'  },
  red:    { bg: 'bg-red-50',    icon: 'bg-red-500',    text: 'text-red-600',    shadow: 'shadow-red-500/20'    },
  orange: { bg: 'bg-orange-50', icon: 'bg-brand-500',  text: 'text-brand-600',  shadow: 'shadow-brand-500/20'  },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-500', text: 'text-purple-600', shadow: 'shadow-purple-500/20' },
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-500',   text: 'text-blue-600',   shadow: 'shadow-blue-500/20'   },
  gray:   { bg: 'bg-gray-50',   icon: 'bg-gray-500',   text: 'text-gray-700',   shadow: 'shadow-gray-500/20'   },
}

export function StatCard({ label, value, icon: Icon, color, sub, trend }: StatCardProps) {
  const c = colorMap[color]
  return (
    <div className={`card p-5 ${c.bg} border-0`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${c.icon} shadow-lg ${c.shadow}`}>
          <Icon size={18} className="text-white" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${trend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className={`text-3xl font-black ${c.text} leading-none mb-1`}>{value}</p>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
