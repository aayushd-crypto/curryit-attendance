import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Users, FileText,
  Settings, Zap, Palmtree, LogOut, Users2
} from 'lucide-react'
import { useAuth } from './AuthContext'
import type { UserRole } from './database'

interface NavItem { to: string; icon: React.ElementType; label: string; roles: UserRole[] }
interface NavGroup { heading?: string; dividerAfter?: boolean; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',  roles: ['super_admin','admin','cmk_coordinator','employee'] },
      { to: '/leave',     icon: Calendar,        label: 'Leave',       roles: ['super_admin','admin','cmk_coordinator','employee'] },
      { to: '/holidays',  icon: Palmtree,        label: 'Holidays',    roles: ['admin','cmk_coordinator','employee'] },
    ],
  },
  {
    heading: 'CMK',
    dividerAfter: true,
    items: [
      { to: '/cmk-attendance', icon: Zap,    label: 'CMK Attendance', roles: ['super_admin','cmk_coordinator'] },
      { to: '/cmk-workers',    icon: Users2, label: 'CMK Workers',    roles: ['super_admin','cmk_coordinator'] },
    ],
  },
  {
    heading: 'Office',
    items: [
      { to: '/employees', icon: Users,    label: 'Employees', roles: ['super_admin','admin'] },
      { to: '/reports',   icon: FileText, label: 'Reports',   roles: ['super_admin','admin','cmk_coordinator'] },
      { to: '/settings',  icon: Settings, label: 'Settings',  roles: ['super_admin'] },
    ],
  },
]

export function MiniSidebar() {
  const { role, signOut } = useAuth()
  const [hovered, setHovered] = useState(false)

  return (
    <aside
      className="hidden sm:flex fixed top-0 left-0 z-30 h-full flex-col py-4 overflow-hidden"
      style={{
        width: hovered ? '210px' : '60px',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Logo */}
      <div className="flex items-center h-10 px-4 mb-3 flex-shrink-0">
        <img src="/logo.png" alt="CURRYiT" className="w-8 h-8 object-contain flex-shrink-0" />
        <span className="ml-3 font-black text-white text-sm whitespace-nowrap"
          style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.15s', transitionDelay: hovered ? '0.08s' : '0s' }}>
          CURRYiT
        </span>
      </div>

      <div className="w-8 h-px bg-white/10 mx-auto mb-3 flex-shrink-0" />

      {/* Nav */}
      <nav className="flex-1 flex flex-col w-full px-2 overflow-y-auto overflow-x-hidden gap-0.5">
        {navGroups.map((group, gi) => {
          const visible = group.items.filter(i => role && i.roles.includes(role))
          if (!visible.length) return null
          return (
            <div key={gi} className="w-full">
              {group.heading && (
                <p className="text-[9px] font-extrabold text-white/20 uppercase tracking-widest px-3 mb-1 mt-2 whitespace-nowrap overflow-hidden"
                  style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.12s' }}>
                  {group.heading}
                </p>
              )}
              {visible.map(item => (
                <NavLink key={item.to} to={item.to}
                  className={({ isActive }) =>
                    `flex items-center h-10 px-3 rounded-xl transition-all mb-0.5 overflow-hidden whitespace-nowrap
                     ${isActive ? 'text-white' : 'text-white/45 hover:text-white hover:bg-white/10'}`
                  }
                  style={({ isActive }) => isActive ? {
                    background: 'linear-gradient(135deg, rgba(232,83,29,0.9) 0%, rgba(196,64,16,0.9) 100%)',
                    boxShadow: '0 4px 14px rgba(232,83,29,0.35)',
                  } : {}}>
                  <item.icon size={18} className="flex-shrink-0" />
                  <span className="ml-3 text-sm font-medium"
                    style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.12s', transitionDelay: hovered ? '0.06s' : '0s' }}>
                    {item.label}
                  </span>
                </NavLink>
              ))}
              {group.dividerAfter && <div className="w-8 h-px bg-white/10 my-2 mx-1" />}
            </div>
          )
        })}
      </nav>

      {/* Sign out only */}
      <div className="px-2 mt-2 flex-shrink-0">
        <button onClick={signOut}
          className="w-full flex items-center h-10 px-3 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors overflow-hidden whitespace-nowrap">
          <LogOut size={16} className="flex-shrink-0" />
          <span className="ml-3 text-sm font-medium"
            style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.12s', transitionDelay: hovered ? '0.06s' : '0s' }}>
            Sign out
          </span>
        </button>
      </div>
    </aside>
  )
}
