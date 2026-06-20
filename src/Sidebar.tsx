import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Users, FileText,
  ClipboardList, Settings, LogOut, X, ChevronRight,
  Zap, KeyRound
} from 'lucide-react'
import { useAuth } from './AuthContext'
import { supabase } from './supabase'
import type { UserRole } from './database'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  roles: UserRole[]
  badge?: string
}

const navItems: NavItem[] = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard',      roles: ['super_admin','admin','cmk_coordinator','employee'] },
  { to: '/cmk-attendance', icon: Zap,             label: 'CMK Attendance', roles: ['super_admin','admin','cmk_coordinator'] },
  { to: '/leave',          icon: Calendar,        label: 'Leave',          roles: ['super_admin','admin','cmk_coordinator','employee'] },
  { to: '/employees',      icon: Users,           label: 'Employees',      roles: ['super_admin','admin'] },
  { to: '/reports',        icon: FileText,        label: 'Reports',        roles: ['super_admin','admin','cmk_coordinator'] },
  { to: '/audit-log',      icon: ClipboardList,   label: 'Audit Log',      roles: ['super_admin','admin'] },
  { to: '/settings',       icon: Settings,        label: 'Settings',       roles: ['super_admin'] },
]

const roleLabel: Record<UserRole, string> = {
  super_admin: 'Super Admin', admin: 'Admin',
  cmk_coordinator: 'CMK Coordinator', employee: 'Employee',
}

interface SidebarProps { open: boolean; onClose: () => void }

export function Sidebar({ open, onClose }: SidebarProps) {
  const { profile, role, signOut } = useAuth()
  const visible = navItems.filter(i => role && i.roles.includes(role))

  const [pwModal, setPwModal]   = useState(false)
  const [newPw, setNewPw]       = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwBusy, setPwBusy]     = useState(false)
  const [pwError, setPwError]   = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(null)
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    if (newPw.length < 8)   { setPwError('Password must be at least 8 characters.'); return }
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) setPwError(error.message)
    else { setPwSuccess(true); setTimeout(() => { setPwModal(false); setPwSuccess(false); setNewPw(''); setConfirmPw('') }, 1500) }
    setPwBusy(false)
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}
      <aside className={`
        fixed top-0 left-0 z-40 h-full w-64 flex flex-col
        transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}
        style={{
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <div className="px-5 py-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="CURRYiT" className="h-9 w-auto" />
            </div>
            <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
              <X size={16} />
            </button>
          </div>
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mt-3 ml-0.5">
            Attendance Management
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-extrabold text-white/20 uppercase tracking-widest px-3 mb-3">
            Navigation
          </p>
          {visible.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150 group relative
                ${isActive
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/90 hover:bg-white/6'
                }
              `}
              style={({ isActive }) => isActive ? {
                background: 'linear-gradient(135deg, rgba(232,83,29,0.9) 0%, rgba(196,64,16,0.9) 100%)',
                boxShadow: '0 4px 20px rgba(232,83,29,0.4)',
              } : {}}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={17} className={isActive ? 'text-white' : 'text-white/40 group-hover:text-white/70'} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight size={13} className="text-white/60" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 p-3 rounded-xl mb-2"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justif