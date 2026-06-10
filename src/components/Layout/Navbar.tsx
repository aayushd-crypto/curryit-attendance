import { Menu, Bell, Search } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../../context/AuthContext'

interface NavbarProps {
  onMenuClick: () => void
  notifCount?: number
}

export function Navbar({ onMenuClick, notifCount = 0 }: NavbarProps) {
  const { profile } = useAuth()
  const today = format(new Date(), 'EEEE, dd MMM yyyy')

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 sm:px-6 py-3">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-500"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        {/* Date display */}
        <div className="hidden sm:block text-sm text-gray-500">{today}</div>

        <div className="flex-1" />

        {/* Search hint */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl text-sm text-gray-400 border border-gray-100">
          <Search size={14} />
          <span>Search employees...</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <Bell size={18} />
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-semibold text-sm">
          {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
        </div>
      </div>
    </header>
  )
}
