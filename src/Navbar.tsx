import { Menu, Bell, Search } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from './AuthContext'

interface NavbarProps {
  onMenuClick: () => void
  notifCount?: number
}

export function Navbar({ onMenuClick, notifCount = 0 }: NavbarProps) {
  const { profile } = useAuth()
  const today = format(new Date(), 'EEEE, dd MMM yyyy')

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 py-3.5">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <Menu size={20} />
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm text-gray-400 font-medium">{today}</span>
        </div>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-2.5 px-4 py-2 bg-gray-50 rounded-xl text-sm text-gray-400 border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors min-w-[200px]">
          <Search size={14} />
          <span>Search employees...</span>
          <span className="ml-auto text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-md">⌘K</span>
        </div>

        <button className="relative p-2.5 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <Bell size={18} />
          {notifCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-brand-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>

        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-brand-500/30 cursor-pointer">
          {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
        </div>
      </div>
    </header>
  )
}
