import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { CheckCircle2, Clock, Building2, Wifi, CalendarDays, AlertCircle, Sparkles } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { Spinner } from '../Spinner'
import { formatDate, formatTime, logAudit } from '../helpers'

interface AttRecord {
  id: string
  status: string
  work_mode: string | null
  check_in_time: string | null
  date: string
}

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
    const now = format(new Date(), 'HH:mm:ss')
    const { error: insertError } = await supabase.from('attendance').insert({
      employee_id: emp.id, date: todayStr, check_in_time: now,
      location: emp.location, work_mode: workMode, status: 'present',
      source: 'self_marked', marked_by: user.id,
    })
    if (insertError) {
      setError(insertError.code === '23505' ? 'Attendance already marked for today.' : 'Failed to mark attendance. Please try again.')
    } else {
      setSuccess(true)
      await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `Marked attendance — ${workMode}` })
      await loadAttendance()
    }
    setMarking(false)
  }

  const statusBadge = (status: string, wm: string | null) => {
    if (status === 'present' && wm === 'remote') return <span className="badge-remote">Remote</span>
    if (status === 'present') return <span className="badge-present">Present</span>
    if (status === 'absent')  return <span className="badge-absent">Absent</span>
    if (status === 'leave')   return <span className="badge-leave">On Leave</span>
    return <span className="badge-pending">{status}</span>
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mark Attendance</h1>
          <p className="page-subtitle">{formatDate(todayStr)}</p>
        </div>
      </div>

      {/* Mark card */}
      <div className="card p-6">
        {todayRecord ? (
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={40} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">You're marked in!</h2>
            <p className="text-gray-400 text-sm mb-4">
              {todayRecord.work_mode === 'remote' ? '🏠 Working remotely' : '🏢 Working from office'}
              {' · '}checked in at {formatTime(todayRecord.check_in_time ?? '')}
            </p>
            {success && (
              <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2 justify-center">
                <Sparkles size={14} /> Attendance recorded successfully for today!
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 className="font-bold text-gray-900 text-lg mb-1">Today's attendance</h2>
            <p className="text-sm text-gray-400 mb-6">Choose your work mode and tap Mark Present.</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setWorkMode('office')}
                className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                  workMode === 'office'
                    ? 'border-brand-500 bg-brand-50 shadow-lg shadow-brand-500/10'
                    : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                }`}
              >
                <div className={`p-3 rounded-xl ${workMode === 'office' ? 'bg-brand-500' : 'bg-gray-200'}`}>
                  <Building2 size={24} className={workMode === 'office' ? 'text-white' : 'text-gray-500'} />
                </div>
                <div>
                  <p className={`font-bold text-sm ${workMode === 'office' ? 'text-brand-700' : 'text-gray-600'}`}>In Office</p>
                  <p className="text-xs text-gray-400 mt-0.5">Working from office</p>
                </div>
              </button>

              <button
                onClick={() => setWorkMode('remote')}
                className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                  workMode === 'remote'
                    ? 'border-purple-500 bg-purple-50 shadow-lg shadow-purple-500/10'
                    : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                }`}
              >
                <div className={`p-3 rounded-xl ${workMode === 'remote' ? 'bg-purple-500' : 'bg-gray-200'}`}>
                  <Wifi size={24} className={workMode === 'remote' ? 'text-white' : 'text-gray-500'} />
                </div>
                <div>
                  <p className={`font-bold text-sm ${workMode === 'remote' ? 'text-purple-700' : 'text-gray-600'}`}>Remote</p>
                  <p className="text-xs text-gray-400 mt-0.5">Working from home</p>
                </div>
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <button
              onClick={markAttendance}
              disabled={marking}
              className="w-full btn-primary justify-center py-4 rounded-2xl text-base"
            >
              {marking ? <Spinner size="sm" /> : <CheckCircle2 size={20} />}
              {marking ? 'Marking...' : 'Mark Present'}
            </button>

            <p className="text-xs text-center text-gray-400 mt-3 flex items-center justify-center gap-1">
              <Clock size={11} /> One attendance entry per day only.
            </p>
          </>
        )}
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="table-header">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-50 rounded-xl">
              <CalendarDays size={16} className="text-brand-500" />
            </div>
            <h3 className="font-bold text-gray-900">Recent attendance</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr><th>Date</th><th>Status</th><th>Check-in</th><th>Work mode</th></tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-gray-400">No attendance records yet.</td></tr>
              ) : (
                history.map(rec => (
                  <tr key={rec.id}>
                    <td className="font-medium">{formatDate(rec.date)}</td>
                    <td>{statusBadge(rec.status, rec.work_mode)}</td>
                    <td className="text-gray-500">{rec.check_in_time ? formatTime(rec.check_in_time) : '—'}</td>
                    <td className="capitalize text-gray-500">{rec.work_mode ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
