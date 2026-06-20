import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell, Search, Moon, Sun } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from './AuthContext'
import { useTheme } from './useTheme'
import { supabase } from './supabase'

interface NavbarProps { onMenuClick: () => void; notifCount?: number }
interface Hit { id: string; name: string; employee_code: string; designation: string; location: string }

export function Navbar({ onMenuClick, notifCount = 0 }: NavbarProps) {
  const { profile, role } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const isAdmin = role === 'admin' || role === 'super_admin'
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const today = format(now, 'EEEE, dd MMM yyyy')
  const clock = format(now, 'hh:mm:ss a')

  const [q, setQ]         = useState('')
  const [hits, setHits]   = useState<Hit[]>([])
  const [open, setOpen]   = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

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
      style={{ background: dark ? 'rgba(15,23,42,0.9)' : 'rgba(240,242,247,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)' }}>
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="p-2 rounded-xl bg-white text-gray-500" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <Menu size={20} />
        </button>

        <div className="hidden sm:flex flex-col gap-0.5 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.7)' }}>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
            <span className="text-xs font-bold text-gray-700">Namaste 🙏 {profile?.full_name?.split(' ')[0]} Ji</span>
          </div>
          <span className="text-[11px] text-gray-400 font-medium pl-3.5">{today} · {clock}</span>
        </div>

        <div className="flex-1" />

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

        {/* Dark mode toggle */}
        <button onClick={toggle} className="p-2.5 rounded-xl transition-colors"
          style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.07)' }}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {dark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-gray-500" />}
        </button>

        <button className="relative p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.07)' }}>
          <Bell size={17} className="text-gray-500" />
          {notifCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-[9px] font-black rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#E8531D,#C44010)' }}>{notifCount}</span>
          )}
        </button>

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
