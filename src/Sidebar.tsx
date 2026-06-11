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
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard',   roles: ['super_admin','admin','cmk_coordinator','employee'] },
  { to: '/attendance',     icon: Clock,           label: 'Attendance',  roles: ['super_admin','admin','employee'] },
  { to: '/cmk-attendance', icon: Clock,           label: 'CMK Attendance', roles: ['super_admin','admin','cmk_coordinator'] },
  { to: '/leave',          icon: Calendar,        label: 'Leave',       roles: ['super_admin','admin','cmk_coordinator','employee'] },
  { to: '/employees',      icon: Users,           label: 'Employees',   roles: ['super_admin','admin'] },
  { to: '/reports',        icon: FileText,        label: 'Reports',     roles: ['super_admin','admin','cmk_coordinator'] },
  { to: '/audit-log',      icon: ClipboardList,   label: 'Audit Log',   roles: ['super_admin','admin'] },
  { to: '/settings',       icon: Settings,        label: 'Settings',    roles: ['super_admin'] },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { profile, role, signOut } = useAuth()

  const visible = navItems.filter(i => role && i.roles.includes(role))

  const roleLabel: Record<UserRole, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    cmk_coordinator: 'CMK Coordinator',
    employee: 'Employee',
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar panel */}
      <aside className={`
        fixed top-0 left-0 z-40 h-full w-64 bg-white border-r border-gray-100 flex flex-col
        transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <Logo size="md" />
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visible.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-colors duration-150 group
                ${isActive
                  ? 'bg-brand-50 text-brand-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={isActive ? 'text-brand-500' : 'text-gray-400 group-hover:text-gray-600'} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight size={14} className="text-brand-400" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User info + sign out */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-semibold text-sm flex-shrink-0">
              {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile?.full_name ?? 'User'}</p>
              <p className="text-xs text-gray-500">{role ? roleLabel[role] : ''}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
