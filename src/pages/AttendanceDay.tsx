import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Calendar } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { Spinner } from '../Spinner'
import { formatTime } from '../helpers'

interface DayRow {
  id: string
  employee_id: string
  employee_name: string
  employee_code: string
  location: string
  status: string
  work_mode: string | null
  check_in_time: string | null
  check_out_time: string | null
  worked_minutes: number | null
  overtime_minutes: number | null
}

const fmtMins = (m: number | null) => {
  if (!m) return '—'
  const h = Math.floor(m / 60); const min = m % 60
  return h > 0 ? `${h}h ${min}m` : `${min}m`
}

export default function AttendanceDayPage() {
  const { date } = useParams<{ date: string }>()
  const navigate  = useNavigate()
  const { role, profile } = useAuth()
  const isAdmin   = role === 'admin' || role === 'super_admin'

  const [rows, setRows]       = useState<DayRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | 'present' | 'remote' | 'absent' | 'leave'>('all')

  useEffect(() => {
    if (!date || !isValidDate) return
    const load = async () => {
      setLoading(true)

      if (isAdmin) {
        // Fetch all attendance for this date + employee info
        const { data: att } = await supabase
          .from('attendance')
          .select('id, employee_id, location, status, work_mode, check_in_time, check_out_time, worked_minutes, overtime_minutes')
          .eq('date', date)
          .order('location')

        const empIds = (att ?? []).map(r => r.employee_id)
        const { data: emps } = await supabase
          .from('employees')
          .select('id, name, employee_code')
          .in('id', empIds.length ? empIds : ['00000000-0000-0000-0000-000000000000'])

        const empMap: Record<string, { name: string; employee_code: string }> =
          Object.fromEntries((emps ?? []).map((e: any) => [e.id, e]))

        setRows((att ?? []).map(r => ({
          ...r,
          employee_name: empMap[r.employee_id]?.name ?? '—',
          employee_code: empMap[r.employee_id]?.employee_code ?? '—',
        })))
      } else {
        // Employee: fetch own record for this date
        if (!profile?.email) return
        const { data: emp } = await supabase
          .from('employees').select('id, name, employee_code, location')
          .eq('email', profile.email).maybeSingle()
        if (!emp) return

        const { data: att } = await supabase
          .from('attendance').select('*')
          .eq('employee_id', emp.id).eq('date', date).maybeSingle()

        if (att) {
          setRows([{ ...att, employee_name: emp.name, employee_code: emp.employee_code }])
        } else {
          setRows([])
        }
      }
      setLoading(false)
    }
    load()
  }, [date, isAdmin])

  const filtered = rows.filter(r => {
    if (filter === 'all')     return true
    if (filter === 'remote')  return r.work_mode === 'remote'
    if (filter === 'present') return r.status === 'present' && r.work_mode !== 'remote'
    return r.status === filter
  })

  const isValidDate = date ? !isNaN(new Date(date).getTime()) : false
  const displayDate = isValidDate ? format(parseISO(date!), 'EEEE, dd MMMM yyyy') : 'Invalid date'

  const statusBadge = (r: DayRow) => {
    if (r.work_mode === 'remote') return <span className="badge-remote">Remote</span>
    if (r.status === 'present')   return <span className="badge-present">Present</span>
    if (r.status === 'absent')    return <span className="badge-absent">Absent</span>
    if (r.status === 'leave')     return <span className="badge-leave">On Leave</span>
    return <span className="text-xs text-gray-400">{r.status}</span>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Calendar size={20} className="text-brand-500" />
              {displayDate}
            </h1>
            <p className="page-subtitle">
              {loading ? 'Loading...' : `${rows.length} record${rows.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      {isAdmin && (
        <div className="flex gap-2 flex-wrap">
          {(['all', 'present', 'remote', 'absent', 'leave'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors capitalize ${
                filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300'}`}>
              {f === 'all' ? `All (${rows.length})` : f === 'present' ? `Office (${rows.filter(r => r.status === 'present' && r.work_mode !== 'remote').length})` : f === 'remote' ? `Remote (${rows.filter(r => r.work_mode === 'remote').length})` : f === 'absent' ? `Absent (${rows.filter(r => r.status === 'absent').length})` : `Leave (${rows.filter(r => r.status === 'leave').length})`}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Calendar size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No attendance records for this day.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {isAdmin && <><th>Employee</th><th>Location</th></>}
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Hours</th>
                  <th>Overtime</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    {isAdmin && (
                      <>
                        <td>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{r.employee_name}</p>
                            <p className="text-xs text-gray-400 font-mono">{r.employee_code}</p>
                          </div>
                        </td>
                        <td>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${r.location === 'cmk' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                            {r.location === 'cmk' ? 'CMK' : 'Office'}
                          </span>
                        </td>
                      </>
                    )}
                    <td>{statusBadge(r)}</td>
                    <td className="font-mono text-sm text-gray-600">{r.check_in_time  ? formatTime(r.check_in_time)  : '—'}</td>
                    <td className="font-mono text-sm text-gray-600">{r.check_out_time ? formatTime(r.check_out_time) : '—'}</td>
                    <td className="font-semibold text-gray-700">{fmtMins(r.worked_minutes)}</td>
                    <td>
                      {(r.overtime_minutes ?? 0) > 0
                        ? <span className="text-xs font-bold text-amber-600">+{fmtMins(r.overtime_minutes)}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
