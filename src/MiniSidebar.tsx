import { NavLink } from 'react-router-dom'
import { useTheme } from './useTheme'
import {
  LayoutDashboard, Calendar, Users, FileText,
  ClipboardList, Settings, Zap, Palmtree, Menu, LogOut, Users2, Moon, Sun
} from 'lucide-react'
import { useAuth } from './AuthContext'
import type { UserRole } from './database'

interface NavItem { to: string; icon: React.ElementType; label: string; roles: UserRole[] }

const navItems: NavItem[] = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard',      roles: ['super_admin','admin','cmk_coordinator','employee'] },
  { to: '/cmk-attendance', icon: Zap,             label: 'CMK Attendance', roles: ['super_admin','cmk_coordinator'] },
  { to: '/cmk-workers',     icon: Users2,         label: 'CMK Workers',    roles: ['super_admin','cmk_coordinator'] },
  { to: '/leave',          icon: Calendar,        label: 'Leave',          roles: ['super_admin','admin','cmk_coordinator','employee'] },
  { to: '/holidays',       icon: Palmtree,        label: 'Holidays',       roles: ['super_admin','admin','cmk_coordinator','employee'] },
  { to: '/employees',      icon: Users,           label: 'Employees',      roles: ['super_admin','admin'] },
  { to: '/reports',        icon: FileText,        label: 'Reports',        roles: ['super_admin','admin','cmk_coordinator'] },
  { to: '/audit-log',      icon: ClipboardList,   label: 'Audit Log',      roles: ['super_admin','admin'] },
  { to: '/settings',       icon: Settings,        label: 'Settings',       roles: ['super_admin'] },
]

interface Props { onMenuClick: () => void }

export function MiniSidebar({ onMenuClick }: Props) {
  const { role, profile, signOut } = useAuth()
  const { dark, toggle } = useTheme()
  const visible = navItems.filter(i => role && i.roles.includes(role))

  return (
    <aside className="hidden sm:flex fixed top-0 left-0 z-30 h-full w-14 flex-col items-center py-3 gap-1"
      style={{
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>
      {/* Logo */}
      <div className="mb-2 flex items-center justify-center w-10 h-10">
        <img src="/logo.png" alt="CURRYiT" className="w-8 h-8 object-contain" />
      </div>

      {/* Menu / expand button */}
      <button onClick={onMenuClick}
        title="Open menu"
        className="w-10 h-10 flex items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors mb-1">
        <Menu size={18} />
      </button>

      {/* Divider */}
      <div className="w-6 h-px bg-white/10 mb-1" />

      {/* Nav icons */}
      <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2 overflow-y-auto">
        {visible.map(item => (
          <NavLink key={item.to} to={item.to}
            title={item.label}
            className={({ isActive }) =>
              `w-10 h-10 flex items-center justify-center rounded-xl transition-all group relative
               ${isActive ? 'text-white' : 'text-white/40 hover:text-white hover:bg-white/10'}`
            }
            style={({ isActive }) => isActive ? {
              background: 'linear-gradient(135deg, rgba(232,83,29,0.9) 0%, rgba(196,64,16,0.9) 100%)',
              boxShadow: '0 4px 14px rgba(232,83,29,0.4)',
            } : {}}>
            {({ isActive }) => (
              <>
                <item.icon size={18} />
                {/* Tooltip */}
                <span className="absolute left-full ml-3 px-2 py-1 rounded-lg text-xs font-semibold text-white whitespace-nowrap
                  opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
                  style={{ background: '#1a1a2e', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User avatar */}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white"
        title={profile?.full_name ?? 'User'}
        style={{ background: 'linear-gradient(135deg, #E8531D, #C44010)', boxShadow: '0 4px 12px rgba(232,83,29,0.4)' }}>
        {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
      </div>

      {/* Dark mode toggle */}
      <button onClick={toggle} title={dark ? 'Light mode' : 'Dark mode'}
        className="w-10 h-10 flex items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors">
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      {/* Logout */}
      <button onClick={signOut} title="Sign out"
        className="w-10 h-10 flex items-center justify-center rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors mb-1">
        <LogOut size={17} />
      </button>
    </aside>
  )
}
