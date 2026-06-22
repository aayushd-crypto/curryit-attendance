import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Users, FileText,
  Settings, Zap, Palmtree, Menu, LogOut, Users2
} from 'lucide-react'
import { useAuth } from './AuthContext'
import { getInitials } from './Sidebar'
import type { UserRole } from './database'

interface NavItem { to: string; icon: React.ElementType; label: string; roles: UserRole[] }
interface NavGroup { heading?: string; dividerAfter?: boolean; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    dividerAfter: true,
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['super_admin','admin','cmk_coordinator','employee'] },
      { to: '/leave',     icon: Calendar,        label: 'Leave',      roles: ['super_admin','admin','cmk_coordinator','employee'] },
      { to: '/holidays',  icon: Palmtree,        label: 'Holidays',   roles: ['super_admin','admin','cmk_coordinator','employee'] },
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
        className="w-10 h-10 flex items-center justify-center rounded-2xl text-white/40 hover:text-white hover:bg-white/10 transition-colors mb-1">
        <Menu size={18} />
      </button>

      <div className="w-6 h-px bg-white/10 mb-1" />

      {/* Nav icons grouped */}
      <nav className="flex-1 flex flex-col items-center w-full px-2 overflow-y-auto">
        {navGroups.map((group, gi) => {
          const visible = group.items.filter(i => role && i.roles.includes(role))
          if (!visible.length) return null
          return (
            <div key={gi} className="w-full">
              <div className="flex flex-col items-center gap-1 w-full">
                {visible.map(item => (
                  <NavLink key={item.to} to={item.to}
                    title={item.label}
                    className={({ isActive }) =>
                      `w-10 h-10 flex items-center justify-center rounded-2xl transition-all group relative
                       ${isActive ? 'text-white' : 'text-white/40 hover:text-white hover:bg-white/10'}`
                    }
                    style={({ isActive }) => isActive ? {
                      background: 'linear-gradient(135deg, rgba(232,83,29,0.9) 0%, rgba(196,64,16,0.9) 100%)',
                      boxShadow: '0 4px 14px rgba(232,83,29,0.4)',
                    } : {}}>
                    {() => (
                      <>
                        <item.icon size={18} />
                        <span className="absolute left-full ml-3 px-2 py-1 rounded-lg text-xs font-semibold text-white whitespace-nowrap
                          opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
                          style={{ background: '#1a1a2e', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                          {item.label}
                        </span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
              {group.dividerAfter && <div className="w-6 h-px bg-white/10 my-2 mx-auto" />}
            </div>
          )
        })}
      </nav>

      {/* User avatar with initials */}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white"
        title={profile?.full_name ?? 'User'}
        style={{ background: 'linear-gradient(135deg, #E8531D, #C44010)', boxShadow: '0 4px 12px rgba(232,83,29,0.4)' }}>
        {getInitials(profile?.full_name)}
      </div>

      {/* Logout */}
      <button onClick={signOut} title="Sign out"
        className="w-10 h-10 flex items-center justify-center rounded-2xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors mb-1">
        <LogOut size={17} />
      </button>
    </aside>
  )
}
