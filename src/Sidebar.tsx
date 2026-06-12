import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Clock, Calendar, Users, FileText,
  ClipboardList, Settings, LogOut, X, Zap
} from 'lucide-react'
import { useAuth } from './AuthContext'
import type { UserRole } from './database'

interface NavItem { to: string; icon: React.ElementType; label: string; roles: UserRole[] }

const navItems: NavItem[] = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard',      roles: ['super_admin','admin','cmk_coordinator','employee'] },
  { to: '/attendance',     icon: Clock,           label: 'Attendance',     roles: ['employee'] },
  { to: '/cmk-attendance', icon: Zap,             label: 'CMK Attendance', roles: ['super_admin','admin','cmk_coordinator'] },
  { to: '/leave',          icon: Calendar,        label: 'Leave & WFH',    roles: ['super_admin','admin','cmk_coordinator','employee'] },
  { to: '/employees',      icon: Users,           label: 'Employees',      roles: ['super_admin','admin'] },
  { to: '/reports',        icon: FileText,        label: 'Reports',        roles: ['super_admin','admin','cmk_coordinator'] },
  { to: '/audit-log',      icon: ClipboardList,   label: 'Audit Log',      roles: ['super_admin','admin'] },
  { to: '/settings',       icon: Settings,        label: 'Settings',       roles: ['super_admin'] },
]

const roleLabel: Record<UserRole, string> = {
  super_admin: 'Super Admin', admin: 'Admin',
  cmk_coordinator: 'CMK Coordinator', employee: 'Employee',
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, role, signOut } = useAuth()
  const visible = navItems.filter(i => role && i.roles.includes(role))

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed top-0 left-0 z-40 h-full w-[248px] flex flex-col transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static`}
        style={{
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderRight: '0.5px solid rgba(0,0,0,0.08)',
        }}
      >
        {/* Logo */}
        <div className="px-6 pt-7 pb-5 flex items-center justify-between">
          <img src="/logo.png" alt="CURRYiT" className="h-9 w-auto" />
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-full hover:bg-black/5 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3.5 py-2 space-y-0.5 overflow-y-auto">
          {visible.map(item => (
            <NavLink key={item.to} to={item.to} onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-[9px] rounded-xl text-[14px] font-medium transition-all duration-150
                 ${isActive ? 'text-white' : 'text-gray-600 hover:bg-black/[0.04]'}`
              }
              style={({ isActive }) => isActive
                ? { background: '#E8531D', boxShadow: '0 1px 8px rgba(232,83,29,0.35)' }
                : {}}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={17} strokeWidth={2.2}
                    className={isActive ? 'text-white' : 'text-gray-400'} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 pb-5 pt-3" style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ background: '#E8531D' }}>
              {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-gray-900 truncate leading-tight">{profile?.full_name ?? 'User'}</p>
              <p className="text-xs text-gray-400">{role ? roleLabel[role] : ''}</p>
            </div>
            <button onClick={signOut} title="Sign out"
              className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
