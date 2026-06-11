import { Menu, Bell, Search, Users } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from './AuthContext'

interface NavbarProps {
  onMenuClick: () => void
  notifCount?: number
}

export function Navbar({ onMenuClick, notifCount = 0 }: NavbarProps) {
  const { profile, role } = useAuth()
  const today = format(new Date(), 'EEEE, dd MMM yyyy')
  const isAdmin = role === 'admin' || role === 'super_admin'

  return (
    <header className="sticky top-0 z-20 px-4 sm:px-6 py-3"
      style={{
        background: 'rgba(240,242,247,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Mobile menu */}
        <button onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-white text-gray-500 transition-colors"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <Menu size={20} />
        </button>

        {/* Date */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.7)' }}>
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-gray-500">{today}</span>
        </div>

        <div className="flex-1" />

        {/* Search — admin only */}
        {isAdmin && (
          <div className="hidden md:flex items-center gap-2.5 px-4 py-2.5 rounded-xl cursor-pointer transition-all min-w-[220px] group"
            style={{
              background: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(0,0,0,0.07)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            <Search size={14} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
            <span className="text-sm text-gray-400 flex-1">Search employees...</span>
            <div className="flex gap-0.5">
              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">⌘</span>
              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">K</span>
            </div>
          </div>
        )}

        {/* Notif bell */}
        <button className="relative p-2.5 rounded-xl transition-all"
          style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <Bell size={17} className="text-gray-500" />
          {notifCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-[9px] font-black rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #E8531D, #C44010)' }}>
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white"
            style={{ background: 'linear-gradient(135deg, #E8531D, #C44010)', boxShadow: '0 2px 8px rgba(232,83,29,0.35)' }}>
            {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <span className="hidden sm:block text-sm font-semibold text-gray-700 max-w-[120px] truncate">
            {profile?.full_name?.split(' ')[0] ?? 'User'}
          </span>
        </div>
      </div>
    </header>
  )
}
