import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { CheckCircle, Clock, Building2, Wifi, CalendarDays, AlertCircle } from 'lucide-react'
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

    // Get employee linked to this user
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('email', profile?.email ?? '')
      .single()

    if (!emp) { setLoading(false); return }

    // Today's record
    const { data: today } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', emp.id)
      .eq('date', todayStr)
      .maybeSingle()

    setTodayRecord(today ?? null)

    // Last 30 days history
    const { data: hist } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', emp.id)
      .order('date', { ascending: false })
      .limit(30)

    setHistory(hist ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAttendance() }, [])

  const markAttendance = async () => {
    if (!user || !profile) return
    setMarking(true)
    setError(null)

    const { data: emp } = await supabase
      .from('employees')
      .select('id, location')
      .eq('email', profile.email ?? '')
      .single()

    if (!emp) {
      setError('Your employee record was not found. Contact your admin.')
      setMarking(false)
      return
    }

    const now = format(new Date(), 'HH:mm:ss')

    const { error: insertError } = await supabase
      .from('attendance')
      .insert({
        employee_id: emp.id,
        date: todayStr,
        check_in_time: now,
        location: emp.location,
        work_mode: workMode,
        status: 'present',
        source: 'self_marked',
        marked_by: user.id,
      })

    if (insertError) {
      if (insertError.code === '23505') {
        setError('Attendance already marked for today.')
      } else {
        setError('Failed to mark attendance. Please try again.')
      }
    } else {
      setSuccess(true)
      await logAudit({
        userId: user.id,
        userName: profile.full_name,
        userRole: role!,
        action: `Marked attendance — ${workMode}`,
      })
      await loadAttendance()
    }
    setMarking(false)
  }

  const statusBadge = (status: string, workMode: string | null) => {
    if (status === 'present' && workMode === 'remote') return <span className="badge-remote">Remote</span>
    if (status === 'present') return <span className="badge-present">Present</span>
    if (status === 'absent')  return <span className="badge-absent">Absent</span>
    if (status === 'leave')   return <span className="badge-leave">On Leave</span>
    return <span className="badge-pending">{status}</span>
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mark Attendance</h1>
          <p className="page-subtitle">{formatDate(todayStr)}</p>
        </div>
      </div>

      {/* Mark attendance card */}
      <div className="card p-6">
        {todayRecord ? (
          <div className="text-center py-4">
            <CheckCircle size={48} className="mx-auto text-green-500 mb-3" />
            <h2 className="text-lg font-semibold text-gray-900">Attendance marked!</h2>
            <p className="text-sm text-gray-500 mt-1">
              You marked yourself as {' '}
              <strong>{todayRecord.work_mode === 'remote' ? 'Remote' : 'In Office'}</strong>
              {' '}at {formatTime(todayRecord.check_in_time ?? '')}
            </p>
            {success && (
              <div className="mt-4 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700">
                ✓ Attendance recorded successfully for today.
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Today's attendance</h2>
            <p className="text-sm text-gray-500 mb-6">Select your work mode and mark your attendance for today.</p>

            {/* Work mode selector */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setWorkMode('office')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  workMode === 'office'
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Building2 size={28} />
                <span className="font-medium text-sm">In Office</span>
                <span className="text-xs text-gray-400">Working from office</span>
              </button>
              <button
                onClick={() => setWorkMode('remote')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  workMode === 'remote'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Wifi size={28} />
                <span className="font-medium text-sm">Remote</span>
                <span className="text-xs text-gray-400">Working from home</span>
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              onClick={markAttendance}
              disabled={marking}
              className="w-full btn-primary justify-center py-3 rounded-xl text-base"
            >
              {marking ? <Spinner size="sm" /> : <CheckCircle size={20} />}
              {marking ? 'Marking...' : 'Mark Present'}
            </button>

            <p className="text-xs text-center text-gray-400 mt-3 flex items-center justify-center gap-1">
              <Clock size={12} />
              Attendance can only be marked once per day.
            </p>
          </div>
        )}
      </div>

      {/* Attendance history */}
      <div className="card">
        <div className="table-header">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-gray-400" />
            <h3 className="font-semibold text-gray-900">Recent attendance</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Check-in</th>
                <th>Work mode</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-400">No attendance records yet.</td>
                </tr>
              ) : (
                history.map(rec => (
                  <tr key={rec.id}>
                    <td className="font-medium">{formatDate(rec.date)}</td>
                    <td>{statusBadge(rec.status, rec.work_mode)}</td>
                    <td>{rec.check_in_time ? formatTime(rec.check_in_time) : '—'}</td>
                    <td className="capitalize">{rec.work_mode ?? '—'}</td>
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
