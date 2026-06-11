import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { CheckCircle2, Clock, Building2, Wifi, CalendarDays, AlertCircle, Sparkles } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { Spinner } from '../Spinner'
import { formatDate, formatTime, logAudit } from '../helpers'

interface AttRecord { id: string; status: string; work_mode: string | null; check_in_time: string | null; date: string }

export default function AttendancePage() {
  const { user, profile, role } = useAuth()
  const [todayRecord, setTodayRecord] = useState<AttRecord | null>(null)
  const [history, setHistory]         = useState<AttRecord[]>([])
  const [workMode, setWorkMode]       = useState<'office' | 'remote'>('office')
  const [loading, setLoading]         = useState(true)
  const [marking, setMarking]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState(false)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const loadAttendance = async () => {
    if (!user) return
    setLoading(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', profile?.email ?? '').single()
    if (!emp) { setLoading(false); return }
    const { data: today } = await supabase.from('attendance').select('*').eq('employee_id', emp.id).eq('date', todayStr).maybeSingle()
    setTodayRecord(today ?? null)
    const { data: hist } = await supabase.from('attendance').select('*').eq('employee_id', emp.id).order('date', { ascending: false }).limit(30)
    setHistory(hist ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAttendance() }, [])

  const markAttendance = async () => {
    if (!user || !profile) return
    setMarking(true); setError(null)
    const { data: emp } = await supabase.from('employees').select('id, location').eq('email', profile.email ?? '').single()
    if (!emp) { setError('Employee record not found. Contact your admin.'); setMarking(false); return }
    const { error: insertError } = await supabase.from('attendance').insert({
      employee_id: emp.id, date: todayStr, check_in_time: format(new Date(), 'HH:mm:ss'),
      location: emp.location, work_mode: workMode, status: 'present', source: 'self_marked', marked_by: user.id,
    })
    if (insertError) {
      setError(insertError.code === '23505' ? 'Attendance already marked for today.' : 'Failed to mark. Please try again.')
    } else {
      setSuccess(true)
      await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `Marked attendance — ${workMode}` })
      await loadAttendance()
    }
    setMarking(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mark Attendance</h1>
          <p className="page-subtitle">{formatDate(todayStr)}</p>
        </div>
      </div>

      {/* Mark card */}
      <div className="card-elevated rounded-3xl p-7">
        {todayRecord ? (
          <div className="text-center py-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)', boxShadow: '0 8px 30px rgba(16,185,129,0.2)' }}>
              <CheckCircle2 size={38} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">You're checked in!</h2>
            <p className="text-gray-400 text-sm">
              {todayRecord.work_mode === 'remote' ? '🏠 Remote' : '🏢 In Office'} · {formatTime(todayRecord.check_in_time ?? '')}
            </p>
            {success && (
              <div className="mt-5 flex items-center gap-2 justify-center px-4 py-3 rounded-2xl text-sm font-medium text-emerald-700"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <Sparkles size={14} /> Attendance recorded successfully!
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 className="font-black text-gray-900 text-xl mb-1 tracking-tight">Today's attendance</h2>
            <p className="text-sm text-gray-400 mb-7">Choose your work mode and tap Mark Present.</p>

            <div className="grid grid-cols-2 gap-3 mb-7">
              {[
                { mode: 'office' as const, icon: Building2, label: 'In Office', sub: 'Working from office',
                  active: 'border-brand-500 shadow-brand-500/15', iconBg: 'linear-gradient(135deg,#E8531D,#C44010)', textColor: 'text-brand-700' },
                { mode: 'remote' as const, icon: Wifi, label: 'Remote', sub: 'Working from home',
                  active: 'border-violet-500 shadow-violet-500/15', iconBg: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', textColor: 'text-violet-700' },
              ].map(opt => (
                <button key={opt.mode} onClick={() => setWorkMode(opt.mode)}
                  className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 ${
                    workMode === opt.mode ? `${opt.active} shadow-xl` : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
                  }`}>
                  <div className="p-3 rounded-xl" style={{ background: workMode === opt.mode ? opt.iconBg : '#E5E7EB' }}>
                    <opt.icon size={22} className={workMode === opt.mode ? 'text-white' : 'text-gray-400'} />
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${workMode === opt.mode ? opt.textColor : 'text-gray-500'}`}>{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>
                  </div>
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm text-red-600"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <button onClick={markAttendance} disabled={marking} className="btn-primary w-full justify-center py-4 rounded-2xl text-base">
              {marking ? <Spinner size="sm" /> : <CheckCircle2 size={20} />}
              {marking ? 'Marking...' : 'Mark Present'}
            </button>
            <p className="text-xs text-center text-gray-400 mt-3 flex items-center justify-center gap-1.5">
              <Clock size={11} /> One entry per day only
            </p>
          </>
        )}
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="table-header">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(232,83,29,0.08)' }}>
              <CalendarDays size={15} style={{ color: '#E8531D' }} />
            </div>
            <h3 className="font-bold text-gray-900">Recent attendance</h3>
          </div>
        </div>
        <table className="w-full">
          <thead><tr><th>Date</th><th>Status</th><th>Check-in</th><th>Mode</th></tr></thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">No attendance records yet.</td></tr>
            ) : history.map(rec => (
              <tr key={rec.id}>
                <td className="font-semibold">{formatDate(rec.date)}</td>
                <td>
                  {rec.status === 'present' && rec.work_mode !== 'remote' && <span className="badge-present">Present</span>}
                  {rec.work_mode === 'remote' && <span className="badge-remote">Remote</span>}
                  {rec.status === 'absent' && <span className="badge-absent">Absent</span>}
                  {rec.status === 'leave' && <span className="badge-leave">Leave</span>}
                </td>
                <td className="text-gray-400">{rec.check_in_time ? formatTime(rec.check_in_time) : '—'}</td>
                <td className="capitalize text-gray-400">{rec.work_mode ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
