import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Users, FileText,
  Settings, LogOut, X, ChevronRight,
  Zap, KeyRound, Palmtree, Users2
} from 'lucide-react'
import { useAuth } from './AuthContext'
import { useUserAvatar } from './useUserAvatar'
import { UserAvatar } from './UserAvatar'
import { EmojiPicker } from './EmojiPicker'
import { supabase } from './supabase'
import type { UserRole } from './database'

interface NavItem {
  to: string; icon: React.ElementType; label: string; roles: UserRole[]
}
interface NavGroup {
  heading?: string; items: NavItem[]
}

// Food emoji avatar — deterministic per name
const FOOD_EMOJIS = ['🍕','🍔','🌮','🍜','🍣','🍩','🧇','🌯','🥗','🍛','🍱','🥘','🍝','🌽','🫕','🥙','🍟','🧆','🥞','🍙','🍤','🌶️','🥐','🧀','🥨']
export function getAvatar(name: string | null | undefined): string {
  if (!name) return '🍕'
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return FOOD_EMOJIS[hash % FOOD_EMOJIS.length]
}

const navGroups: NavGroup[] = [
  {
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['super_admin','admin','cmk_coordinator','employee'] },
      { to: '/leave',     icon: Calendar,        label: 'Leave',      roles: ['super_admin','admin','cmk_coordinator','employee'] },
      { to: '/holidays',  icon: Palmtree,        label: 'Holidays',   roles: ['admin','cmk_coordinator','employee'] },
    ],
  },
  {
    heading: 'CMK',
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

const roleLabel: Record<UserRole, string> = {
  super_admin: 'Super Admin', admin: 'Admin',
  cmk_coordinator: 'CMK Coordinator', employee: 'Employee',
}

interface SidebarProps { open: boolean; onClose: () => void }

export function Sidebar({ open, onClose }: SidebarProps) {
  const { profile, role, signOut } = useAuth()

  const { value, pick } = useUserAvatar()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pwModal, setPwModal]     = useState(false)
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwBusy, setPwBusy]       = useState(false)
  const [pwError, setPwError]     = useState<string | null>(null)
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
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      )}
      <aside className={`
        fixed top-0 left-0 z-40 h-full w-64 flex flex-col
        transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
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
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
              <X size={16} />
            </button>
          </div>
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mt-3 ml-0.5">
            Attendance Management
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
          {navGroups.map((group, gi) => {
            const visible = group.items.filter(i => role && i.roles.includes(role))
            if (!visible.length) return null
            return (
              <div key={gi}>
                {group.heading && (
                  <p className="text-[10px] font-extrabold text-white/20 uppercase tracking-widest px-3 mb-2">
                    {group.heading}
                  </p>
                )}
                <div className="space-y-0.5">
                  {visible.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium
                        transition-all duration-150 group relative
                        ${isActive ? 'text-white' : 'text-white/50 hover:text-white/90 hover:bg-white/6'}
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
                </div>
              </div>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 p-3 rounded-xl mb-2"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="relative">
              <button onClick={() => setPickerOpen(v => !v)}
                className="hover:scale-110 transition-transform"
                style={{ background: 'none', boxShadow: 'none', padding: 0 }}
                title="Change avatar">
                <UserAvatar value={value} name={profile?.full_name} size={36} />
              </button>
              {pickerOpen && (
                <div className="absolute left-0 bottom-full mb-2 z-50">
                  <EmojiPicker current={value} name={profile?.full_name} onPick={pick} onClose={() => setPickerOpen(false)} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{profile?.full_name ?? 'User'}</p>
              <p className="text-xs text-white/40 truncate">{role ? roleLabel[role] : ''}</p>
            </div>
          </div>
          <button
            onClick={() => { setPwModal(true); setPwError(null); setNewPw(''); setConfirmPw('') }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-white/40 hover:text-white/80 rounded-xl transition-colors mb-0.5"
          >
            <KeyRound size={15} />
            Change password
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-white/40 hover:text-red-400 rounded-xl transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Change Password Modal */}
      {pwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">Change password</h3>
              <button onClick={() => setPwModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            {pwSuccess ? (
              <div className="text-center py-4">
                <p className="text-2xl mb-2">✅</p>
                <p className="font-semibold text-gray-800">Password updated!</p>
              </div>
            ) : (
              <form onSubmit={changePassword} className="space-y-4">
                <div>
                  <label className="label">New password</label>
                  <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                    className="input" required minLength={8} placeholder="Min 8 characters" />
                </div>
                <div>
                  <label className="label">Confirm new password</label>
                  <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                    className="input" required placeholder="Repeat password" />
                </div>
                {pwError && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{pwError}</p>
                )}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setPwModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                  <button type="submit" disabled={pwBusy} className="btn-primary flex-1 justify-center">
                    {pwBusy ? 'Saving...' : 'Update'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
