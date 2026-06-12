import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from './AuthContext'
import { supabase } from './supabase'

interface Hit { id: string; name: string; employee_code: string; designation: string; location: string }

export function Navbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { role } = useAuth()
  const navigate = useNavigate()
  const isAdmin = role === 'admin' || role === 'super_admin'
  const today = format(new Date(), 'EEEE, d MMMM')

  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!q.trim() || !isAdmin) { setHits([]); setOpen(false); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('employees')
        .select('id, name, employee_code, designation, location')
        .or(`name.ilike.%${q}%,employee_code.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(6)
      setHits((data ?? []) as Hit[])
      setOpen(true)
    }, 220)
    return () => clearTimeout(t)
  }, [q, isAdmin])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <header className="sticky top-0 z-20 px-5 sm:px-8 py-3.5"
      style={{
        background: 'rgba(245,245,247,0.8)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderBottom: '0.5px solid rgba(0,0,0,0.07)',
      }}>
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 -ml-2 rounded-full hover:bg-black/5 text-gray-600">
          <Menu size={20} />
        </button>

        <span className="text-[15px] font-semibold text-gray-900">{today}</span>

        <div className="flex-1" />

        {isAdmin && (
          <div ref={boxRef} className="relative hidden md:block">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-full min-w-[240px]"
              style={{ background: 'rgba(0,0,0,0.05)' }}>
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => q && setOpen(true)}
                placeholder="Search employees"
                className="bg-transparent outline-none text-[14px] text-gray-800 placeholder-gray-400 w-full" />
            </div>
            {open && hits.length > 0 && (
              <div className="absolute top-full mt-2 left-0 right-0 rounded-2xl overflow-hidden z-50 py-1"
                style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(30px)',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.14)', border: '0.5px solid rgba(0,0,0,0.08)' }}>
                {hits.map(h => (
                  <button key={h.id}
                    onClick={() => { setQ(''); setOpen(false); navigate(`/employees?q=${encodeURIComponent(h.name)}`) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.04] transition-colors text-left">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: '#E8531D' }}>
                      {h.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-gray-900 truncate">{h.name}</p>
                      <p className="text-xs text-gray-400">{h.employee_code} · {h.designation}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
