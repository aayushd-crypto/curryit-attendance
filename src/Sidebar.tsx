import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Clock, Calendar, Users, FileText,
  ClipboardList, Settings, LogOut, X, ChevronRight
} from 'lucide-react'
import { Logo } from './Logo'
import { useAuth } from './AuthContext'
import type { UserRole } from './database'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  roles: UserRole[]
}

const navItems: NavItem[] = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard',      roles: ['super_admin','admin','cmk_coordinator','employee'] },
  { to: '/attendance',     icon: Clock,           label: 'Attendance',     roles: ['super_admin','admin','employee'] },
  { to: '/cmk-attendance', icon: Clock,           label: 'CMK Attendance', roles: ['super_admin','admin','cmk_coordinator'] },
  { to: '/leave',          icon: Calendar,        label: 'Leave',          roles: ['super_admin','admin','cmk_coordinator','employee'] },
  { to: '/employees',      icon: Users,           label: 'Employees',      roles: ['super_admin','admin'] },
  { to: '/reports',        icon: FileText,        label: 'Reports',        roles: ['super_admin','admin','cmk_coordinator'] },
  { to: '/audit-log',      icon: ClipboardList,   label: 'Audit Log',      roles: ['super_admin','admin'] },
  { to: '/settings',       icon: Settings,        label: 'Settings',       roles: ['super_admin'] },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { profile, role, signOut } = useAuth()

  const visible = navItems.filter(i => role && i.roles.includes(role))

  const roleLabel: Record<UserRole, string> = {
    super_admin:     'Super Admin',
    admin:           'Admin',
    cmk_coordinator: 'CMK Coordinator',
    employee:        'Employee',
  }

  const roleColor: Record<UserRole, string> = {
    super_admin:     'bg-purple-100 text-purple-700',
    admin:           'bg-blue-100 text-blue-700',
    cmk_coordinator: 'bg-amber-100 text-amber-700',
    employee:        'bg-green-100 text-green-700',
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 z-40 h-full w-64 flex flex-col
        bg-white border-r border-gray-100
        transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo area */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100">
          <Logo size="md" />
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-xl hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visible.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150 group
                ${isActive
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={17} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight size={14} className="text-white/70" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-2">
            <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{profile?.full_name ?? 'User'}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${role ? roleColor[role] : 'bg-gray-100 text-gray-500'}`}>
                {role ? roleLabel[role] : ''}
              </span>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
