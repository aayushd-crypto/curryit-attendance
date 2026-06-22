import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell, Search, CheckCheck, Moon, Sun } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { useAuth } from './AuthContext'
import { useTheme } from './useTheme'
import { supabase } from './supabase'

interface NavbarProps { onMenuClick: () => void }
interface Hit { id: string; name: string; employee_code: string; designation: string; location: string }
interface Notif { id: string; title: string; body: string | null; type: string; read: boolean; created_at: string }

export function Navbar({ onMenuClick }: NavbarProps) {
  const { profile, role, user } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const isAdmin = role === 'admin' || role === 'super_admin'
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

  const [q, setQ]         = useState('')
  const [hits, setHits]   = useState<Hit[]>([])
  const [open, setOpen]   = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

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

  // ── Employee search ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!q.trim() || !isAdmin) { setHits([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('employees')
        .select('id, name, employee_code, designation, location')
        .or(`name.ilike.%${q}%,employee_code.ilike.%${q}%,email.ilike.%${q}%`)
        .eq('status', 'active').limit(6)
      setHits((data ?? []) as Hit[]); setOpen(true)
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const go = (hit: Hit) => {
    setQ(''); setOpen(false)
    navigate(`/employees?q=${encodeURIComponent(hit.name)}`)
  }

  return (
    <header className="sticky top-0 z-20 px-4 sm:px-6 py-3 navbar-bg"
      style={{ background: 'var(--navbar-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="sm:hidden p-2 rounded-xl bg-white text-gray-500" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <Menu size={20} />
        </button>

        {/* Mobile: compact greeting + clock */}
        <div className="flex sm:hidden flex-col leading-tight px-2 py-1 rounded-2xl" style={{ background: 'var(--tile-bg)' }}>
          <span className="text-xs font-black text-gray-800" style={{ transition: 'opacity 0.3s', opacity: greetVisible ? 1 : 0 }}>{GREETINGS[greetIdx]} {profile?.full_name?.split(' ')[0]} Ji</span>
          <span className="text-[10px] font-mono text-gray-500">{clock}</span>
        </div>

        {/* Desktop: 3 separate tiles */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-2xl" style={{ background: 'var(--tile-bg)' }}>
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-lg font-black text-gray-800 tracking-tight" style={{ transition: 'opacity 0.3s', opacity: greetVisible ? 1 : 0 }}>{GREETINGS[greetIdx]} {profile?.full_name?.split(' ')[0]} Ji</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl" style={{ background: 'var(--tile-bg)' }}>
          <span className="text-lg font-bold text-gray-700 tracking-tight">{today}</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl font-mono" style={{ background: 'var(--tile-bg)' }}>
          <span className="text-lg font-bold text-gray-700 tracking-tight">{clock}</span>
        </div>

        <div className="flex-1" />

        {/* Dark mode toggle */}
        <button onClick={toggle}
          className="p-2 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ color: 'var(--tile-subtext)' }}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Live search — admin only */}
        {isAdmin && (
          <div ref={boxRef} className="relative hidden md:block">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl min-w-[260px]"
              style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => q && setOpen(true)}
                placeholder="Search employees..."
                className="bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400 w-full" />
            </div>
            {open && hits.length > 0 && (
              <div className="absolute top-full mt-2 left-0 right-0 rounded-2xl overflow-hidden z-50 bg-white"
                style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
                {hits.map(h => (
                  <button key={h.id} onClick={() => go(h)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-50/60 transition-colors text-left">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#E8531D,#C44010)' }}>
                      {h.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{h.name}</p>
                      <p className="text-xs text-gray-400">{h.employee_code} · {h.designation}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${h.location === 'office' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                      {h.location === 'office' ? 'Office' : 'CMK'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bell + dropdown */}
        <div ref={notifRef} className="relative">
          <button onClick={openNotifs} className="relative p-2.5 rounded-xl transition-colors"
            style={{ background: notifOpen ? 'rgba(232,83,29,0.08)' : 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.07)' }}>
            <Bell size={17} className={unread > 0 ? 'text-brand-600' : 'text-gray-500'} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-[9px] font-black rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#E8531D,#C44010)' }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl overflow-hidden z-50 bg-white"
              style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="font-bold text-gray-900 text-sm">Notifications</span>
                {notifs.some(n => n.read === false) && (
                  <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-brand-600 font-semibold hover:text-brand-700">
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {notifs.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">No notifications yet</div>
                ) : notifs.map(n => (
                  <div key={n.id} className={`px-4 py-3 flex gap-3 items-start transition-colors ${n.read ? 'bg-white' : 'bg-orange-50/40'}`}>
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

        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.07)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white"
            style={{ background: 'linear-gradient(135deg,#E8531D,#C44010)' }}>
            {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <span className="hidden sm:block text-sm font-semibold text-gray-700 max-w-[120px] truncate">
            {profile?.full_name?.split(' ')[0] ?? 'User'}
          </span>
        </div>
      </div>
    </header>
  )
}
