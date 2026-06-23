import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell, Search, CheckCheck, X } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { useAuth } from './AuthContext'
import { getAvatar } from './Sidebar'
import { useUserAvatar } from './useUserAvatar'
import { UserAvatar } from './UserAvatar'
import { EmojiPicker } from './EmojiPicker'
import { supabase } from './supabase'

interface NavbarProps { onMenuClick: () => void }
interface EmpHit { kind: 'employee'; id: string; name: string; employee_code: string; designation: string; location: string }
interface PageHit { kind: 'page'; label: string; description: string; to: string; icon: string }
type Hit = EmpHit | PageHit
interface Notif { id: string; title: string; body: string | null; type: string; read: boolean; created_at: string }

export function Navbar({ onMenuClick }: NavbarProps) {
  const { profile, role, user } = useAuth()
  const { value, pick } = useUserAvatar()
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const navigate = useNavigate()
  const isAdmin = role === 'manager' || role === 'super_admin'
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const today = format(now, 'EEEE, dd MMM yyyy')
  const clock = format(now, 'hh:mm:ss a')

  const GREETINGS = ['नमस्ते', 'Hello', 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', 'నమస్కారం', 'வணக்கம்', 'নমস্কার']
  const [greetIdx, setGreetIdx] = useState(0)
  const [greetVisible, setGreetVisible] = useState(true)
  useEffect(() => {
    const flip = setInterval(() => {
      setGreetVisible(false)
      setTimeout(() => {
        setGreetIdx(i => (i + 1) % GREETINGS.length)
        setGreetVisible(true)
      }, 300)
    }, 3000)
    return () => clearInterval(flip)
  }, [])

  const [q, setQ]               = useState('')
  const [hits, setHits]         = useState<Hit[]>([])
  const [open, setOpen]         = useState(false)
  const [mobileSearch, setMobileSearch] = useState(false)
  const boxRef        = useRef<HTMLDivElement>(null)
  const mobileBoxRef  = useRef<HTMLDivElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifs, setNotifs]       = useState<Notif[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const unread = notifs.filter(n => !n.read).length

  const loadNotifs = async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifs((data ?? []) as Notif[])
  }

  const markAllRead = async () => {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  useEffect(() => {
    loadNotifs()
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user?.id}` },
        (payload) => { setNotifs(prev => [payload.new as Notif, ...prev]) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  // close notif dropdown on outside click
  useEffect(() => {
    const close = (e: MouseEvent) => { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const openNotifs = () => { setNotifOpen(v => !v); if (!notifOpen) markAllRead() }

  const typeIcon = (type: string) => {
    if (type === 'leave_approved') return '✅'
    if (type === 'leave_rejected') return '❌'
    if (type === 'leave_request') return '📋'
    if (type === 'holiday') return '🎉'
    return '🔔'
  }

  // ── Global search ───────────────────────────────────────────────────────
  const ALL_PAGES: PageHit[] = [
    { kind: 'page', label: 'Dashboard',      description: 'Overview & check-in',         to: '/dashboard',      icon: '🏠' },
    { kind: 'page', label: 'Leave',          description: 'Apply for or manage leave',   to: '/leave',          icon: '🌴' },
    { kind: 'page', label: 'Holidays',       description: 'Upcoming & past holidays',    to: '/holidays',       icon: '🎉' },
    { kind: 'page', label: 'Employees',      description: 'Manage office employees',     to: '/employees',      icon: '👥' },
    { kind: 'page', label: 'Reports',        description: 'Attendance reports & audit',  to: '/reports',        icon: '📊' },
    { kind: 'page', label: 'CMK Attendance', description: 'CMK daily attendance',        to: '/cmk-attendance', icon: '⚡' },
    { kind: 'page', label: 'CMK Workers',    description: 'CMK labor management',        to: '/cmk-workers',    icon: '👷' },
    { kind: 'page', label: 'Settings',       description: 'Departments, geo, holidays',  to: '/settings',       icon: '⚙️' },
  ]

  useEffect(() => {
    const trimmed = q.trim()
    if (!trimmed) { setHits([]); setOpen(false); return }
    const lower = trimmed.toLowerCase()

    const pageHits = ALL_PAGES.filter(p =>
      p.label.toLowerCase().includes(lower) || p.description.toLowerCase().includes(lower)
    ).slice(0, 3) as Hit[]

    const t = setTimeout(async () => {
      let empHits: Hit[] = []
      if (isAdmin) {
        const { data } = await supabase.from('employees')
          .select('id, name, employee_code, designation, location')
          .or(`name.ilike.%${trimmed}%,employee_code.ilike.%${trimmed}%`)
          .eq('status', 'active').limit(5)
        empHits = (data ?? []).map((d: any) => ({ kind: 'employee' as const, ...d }))
      }
      const combined = [...pageHits, ...empHits].slice(0, 7)
      setHits(combined); setOpen(combined.length > 0)
    }, 220)
    return () => clearTimeout(t)
  }, [q, isAdmin])

  // close desktop search on outside click
  useEffect(() => {
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  // close mobile search on outside click
  useEffect(() => {
    if (!mobileSearch) return
    const close = (e: MouseEvent) => {
      if (mobileBoxRef.current && !mobileBoxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [mobileSearch])

  // auto-focus mobile search input when opened
  useEffect(() => {
    if (mobileSearch) {
      setTimeout(() => mobileInputRef.current?.focus(), 50)
    } else {
      setQ(''); setOpen(false)
    }
  }, [mobileSearch])

  const go = (hit: Hit) => {
    setQ(''); setOpen(false); setMobileSearch(false)
    if (hit.kind === 'page') { navigate(hit.to); return }
    navigate(`/employees?q=${encodeURIComponent(hit.name)}`)
  }

  const SearchResults = ({ width }: { width?: string }) => (
    open && hits.length > 0 ? (
      <div className={`absolute top-full mt-2 left-0 rounded-2xl overflow-hidden z-50 bg-white ${width ?? 'w-[340px]'}`}
        style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
        {hits.map((h) => h.kind === 'page' ? (
          <button key={h.to} onClick={() => go(h)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50/60 active:bg-orange-50 transition-colors text-left border-b border-gray-50 last:border-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
              style={{ background: 'rgba(232,83,29,0.08)' }}>
              {h.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">{h.label}</p>
              <p className="text-xs text-gray-400">{h.description}</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 flex-shrink-0">Page</span>
          </button>
        ) : (
          <button key={h.id} onClick={() => go(h)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left border-b border-gray-50 last:border-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#E8531D,#C44010)' }}>
              {getAvatar(h.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{h.name}</p>
              <p className="text-xs text-gray-400">{h.employee_code} · {h.designation}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${h.location === 'office' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
              {h.location === 'office' ? 'Office' : 'CMK'}
            </span>
          </button>
        ))}
      </div>
    ) : null
  )

  return (
    <header className="sticky top-0 z-20 navbar-bg"
      style={{ background: 'var(--navbar-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>

      {/* ── Main row ── */}
      <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3">

        {/* Hamburger — mobile only */}
        <button onClick={onMenuClick} className="sm:hidden p-2 rounded-xl bg-white text-gray-500 flex-shrink-0" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <Menu size={20} />
        </button>

        {/* Mobile: compact greeting + clock */}
        <div className="flex sm:hidden items-center gap-2 px-3 py-1.5 rounded-2xl min-w-0 flex-1" style={{ background: 'var(--tile-bg)' }}>
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-xs font-black text-gray-800 truncate" style={{ transition: 'opacity 0.3s', opacity: greetVisible ? 1 : 0 }}>{GREETINGS[greetIdx]} {profile?.full_name?.split(' ')[0]}</span>
        </div>

        {/* Desktop: 3 separate tiles */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-2xl flex-shrink-0" style={{ background: 'var(--tile-bg)' }}>
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-lg font-black text-gray-800 tracking-tight" style={{ transition: 'opacity 0.3s', opacity: greetVisible ? 1 : 0 }}>{GREETINGS[greetIdx]} {profile?.full_name?.split(' ')[0]}</span>
        </div>


        <div className="hidden sm:block flex-1" />

        {/* Desktop search */}
        <div ref={boxRef} className="relative hidden md:block">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl min-w-[260px]"
            style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => q && setOpen(true)}
              placeholder="Search pages, employees..."
              className="bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400 w-full" />
          </div>
          <SearchResults />
        </div>

        {/* Mobile search toggle */}
        <button
          onClick={() => setMobileSearch(v => !v)}
          className="md:hidden p-2.5 rounded-xl flex-shrink-0 transition-colors"
          style={{ background: mobileSearch ? 'rgba(232,83,29,0.08)' : 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.07)' }}>
          {mobileSearch ? <X size={17} className="text-brand-600" /> : <Search size={17} className="text-gray-500" />}
        </button>

        {/* Bell + dropdown */}
        <div ref={notifRef} className="relative flex-shrink-0">
          <button onClick={openNotifs} className="relative p-2.5 rounded-xl transition-colors"
            style={{ background: notifOpen ? 'rgba(232,83,29,0.08)' : 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.07)' }}>
            <Bell size={17} className={unread > 0 ? 'text-orange-500' : 'text-gray-500'} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-[9px] font-black rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#E8531D,#C44010)' }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 rounded-2xl overflow-hidden z-50 bg-white"
              style={{
                width: 'min(320px, calc(100vw - 1rem))',
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                border: '1px solid rgba(0,0,0,0.06)',
              }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="font-bold text-gray-900 text-sm">Notifications</span>
                {notifs.some(n => !n.read) && (
                  <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-orange-600 font-semibold hover:text-orange-700">
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {notifs.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">No notifications yet</div>
                ) : notifs.map(n => (
                  <div key={n.id} className={`px-4 py-3 flex gap-3 items-start ${n.read ? 'bg-white' : 'bg-orange-50/40'}`}>
                    <span className="text-lg flex-shrink-0 mt-0.5">{typeIcon(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${n.read ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>{n.title}</p>
                      {n.body && <p className="text-xs text-gray-400 mt-0.5">{n.body}</p>}
                      <p className="text-[10px] text-gray-300 mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                    </div>
                    {!n.read && <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#E8531D' }} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Avatar pill + emoji picker */}
        <div className="relative flex-shrink-0">
          <button onClick={() => setAvatarPickerOpen(v => !v)}
            className="flex items-center gap-2 sm:gap-2.5 px-2 sm:px-3 py-2 rounded-xl hover:bg-black/5 transition-colors"
            style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.07)' }}
            title="Change avatar">
            <UserAvatar value={value} name={profile?.full_name} size={28} />
            <span className="hidden sm:block text-sm font-semibold text-gray-700 max-w-[120px] truncate">
              {profile?.full_name?.split(' ')[0] ?? 'User'}
            </span>
          </button>
          {avatarPickerOpen && (
            <div className="absolute right-0 top-full mt-2 z-50">
              <EmojiPicker current={value} name={profile?.full_name} onPick={pick} onClose={() => setAvatarPickerOpen(false)} />
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile search row (expands below main row) ── */}
      {mobileSearch && (
        <div className="md:hidden px-4 pb-3" ref={mobileBoxRef}>
          <div className="relative">
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl w-full"
              style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <Search size={15} className="text-gray-400 flex-shrink-0" />
              <input
                ref={mobileInputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                onFocus={() => q && setOpen(true)}
                placeholder="Search pages, employees..."
                className="bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400 flex-1"
              />
              {q && (
                <button onClick={() => { setQ(''); setOpen(false) }} className="text-gray-300 hover:text-gray-500">
                  <X size={14} />
                </button>
              )}
            </div>
            {/* Mobile search results — full width */}
            {open && hits.length > 0 && (
              <div className="absolute top-full mt-2 left-0 right-0 rounded-2xl overflow-hidden z-50 bg-white"
                style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
                {hits.map((h) => h.kind === 'page' ? (
                  <button key={h.to} onClick={() => go(h)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50/60 active:bg-orange-50 transition-colors text-left border-b border-gray-50 last:border-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: 'rgba(232,83,29,0.08)' }}>
                      {h.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{h.label}</p>
                      <p className="text-xs text-gray-400">{h.description}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 flex-shrink-0">Page</span>
                  </button>
                ) : (
                  <button key={h.id} onClick={() => go(h)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left border-b border-gray-50 last:border-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#E8531D,#C44010)' }}>
                      {getAvatar(h.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{h.name}</p>
                      <p className="text-xs text-gray-400">{h.employee_code} · {h.designation}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${h.location === 'office' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                      {h.location === 'office' ? 'Office' : 'CMK'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
