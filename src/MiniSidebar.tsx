import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Users, FileText,
  Settings, Zap, Palmtree, Menu, LogOut, Users2
} from 'lucide-react'
import { useAuth } from './AuthContext'
import { getAvatar } from './Sidebar'
import { useUserAvatar } from './useUserAvatar'
import { EmojiPicker } from './EmojiPicker'
import { useState } from 'react'
import type { UserRole } from './database'

interface NavItem { to: string; icon: React.ElementType; label: string; roles: UserRole[] }
interface NavGroup { dividerAfter?: boolean; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    dividerAfter: true,
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',  roles: ['super_admin','admin','cmk_coordinator','employee'] },
      { to: '/leave',     icon: Calendar,        label: 'Leave',       roles: ['super_admin','admin','cmk_coordinator','employee'] },
      { to: '/holidays',  icon: Palmtree,        label: 'Holidays',    roles: ['admin','cmk_coordinator','employee'] },
    ],
  },
  {
    dividerAfter: true,
    items: [
      { to: '/cmk-attendance', icon: Zap,    label: 'CMK Attendance', roles: ['super_admin','cmk_coordinator'] },
      { to: '/cmk-workers',    icon: Users2, label: 'CMK Workers',    roles: ['super_admin','cmk_coordinator'] },
    ],
  },
  {
    items: [
      { to: '/employees', icon: Users,    label: 'Employees', roles: ['super_admin','admin'] },
      { to: '/reports',   icon: FileText, label: 'Reports',   roles: ['super_admin','admin','cmk_coordinator'] },
      { to: '/settings',  icon: Settings, label: 'Settings',  roles: ['super_admin'] },
    ],
  },
]

interface Props { onMenuClick: () => void }

export function MiniSidebar({ onMenuClick }: Props) {
  const { role, profile, signOut } = useAuth()
  const { emoji: myEmoji, pick: pickEmoji } = useUserAvatar()
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <aside
      className="hidden sm:flex fixed top-0 left-0 z-30 h-full flex-col items-center py-3 gap-1 group/sidebar overflow-hidden"
      style={{
        width: '56px',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.width = '200px' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.width = '56px' }}
    >
      {/* Logo */}
      <div className="flex items-center h-10 w-full px-3 mb-2 flex-shrink-0 overflow-hidden">
        <img src="/logo.png" alt="CURRYiT" className="w-8 h-8 object-contain flex-shrink-0" />
        <span className="ml-2.5 text-white font-black text-sm whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
          CURRYiT
        </span>
      </div>

      {/* Menu / expand button */}
      <button onClick={onMenuClick} title="Open full menu"
        className="w-full flex items-center h-10 px-3 text-white/40 hover:text-white hover:bg-white/10 transition-colors rounded-xl mb-1 flex-shrink-0 overflow-hidden">
        <Menu size={18} className="flex-shrink-0" />
        <span className="ml-3 text-sm font-medium whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
          Full menu
        </span>
      </button>

      <div className="w-8 h-px bg-white/10 mb-1 flex-shrink-0" />

      {/* Nav groups */}
      <nav className="flex-1 flex flex-col w-full px-2 overflow-y-auto overflow-x-hidden">
        {navGroups.map((group, gi) => {
          const visible = group.items.filter(i => role && i.roles.includes(role))
          if (!visible.length) return null
          return (
            <div key={gi} className="w-full">
              {visible.map(item => (
                <NavLink key={item.to} to={item.to}
                  className={({ isActive }) =>
                    `flex items-center h-10 px-2 rounded-xl transition-all mb-0.5 overflow-hidden
                     ${isActive ? 'text-white' : 'text-white/40 hover:text-white hover:bg-white/10'}`
                  }
                  style={({ isActive }) => isActive ? {
                    background: 'linear-gradient(135deg, rgba(232,83,29,0.9) 0%, rgba(196,64,16,0.9) 100%)',
                    boxShadow: '0 4px 14px rgba(232,83,29,0.4)',
                  } : {}}>
                  <item.icon size={18} className="flex-shrink-0" />
                  <span className="ml-3 text-sm font-medium whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
                    {item.label}
                  </span>
                </NavLink>
              ))}
              {group.dividerAfter && <div className="w-8 h-px bg-white/10 my-2" />}
            </div>
          )
        })}
      </nav>

      {/* User avatar with picker */}
      <div className="w-full flex items-center h-10 px-2.5 mb-1 overflow-hidden flex-shrink-0 relative">
        <button onClick={() => setPickerOpen(v => !v)}
          className="w-7 h-7 rounded-xl flex items-center justify-center text-base flex-shrink-0 hover:scale-110 transition-transform"
          style={{ background: 'linear-gradient(135deg, #E8531D, #C44010)', boxShadow: '0 4px 12px rgba(232,83,29,0.4)' }}
          title="Change avatar">
          {myEmoji}
        </button>
        <div className="ml-2.5 overflow-hidden opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
          <p className="text-xs font-semibold text-white whitespace-nowrap truncate" style={{ maxWidth: '130px' }}>
            {profile?.full_name ?? 'User'}
          </p>
        </div>
        {pickerOpen && (
          <EmojiPicker current={myEmoji} onPick={pickEmoji} onClose={() => setPickerOpen(false)} />
        )}
      </div>

      {/* Logout */}
      <button onClick={signOut} title="Sign out"
        className="w-full flex items-center h-10 px-2.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded-xl mb-1 flex-shrink-0 overflow-hidden">
        <LogOut size={17} className="flex-shrink-0" />
        <span className="ml-3 text-sm font-medium whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
          Sign out
        </span>
      </button>
    </aside>
  )
}
