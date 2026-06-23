import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { ArrowLeft, Calendar, Clock, TrendingUp, UserCheck, Plane, X as XIcon, Wifi } from 'lucide-react'
import { supabase } from '../supabase'
import { Spinner } from '../Spinner'
import { formatDate, formatTime } from '../helpers'

interface EmpInfo {
  id: string; name: string; employee_code: string; email: string
  designation: string; location: string; joining_date: string; status: string
  departments?: { name: string }
}
interface AttRow {
  id: string; date: string; status: string; work_mode: string | null
  check_in_time: string | null; check_out_time: string | null
  worked_minutes: number | null; overtime_minutes: number | null
}
interface LeaveBalance {
  casual_total: number; casual_used: number
}

const fmtMins = (m: number | null) => {
  if (!m) return '—'
  const h = Math.floor(m / 60); const min = m % 60
  return h > 0 ? `${h}h ${min}m` : `${min}m`
}

export default function EmployeeDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [emp, setEmp]         = useState<EmpInfo | null>(null)
  const [rows, setRows]       = useState<AttRow[]>([])
  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth]     = useState(format(new Date(), 'yyyy-MM'))
  const [filter, setFilter]   = useState<'all' | 'present' | 'remote' | 'absent' | 'leave'>('all')

  useEffect(() => {
    if (!id) return
    supabase.from('employees').select('*, departments(name)')
      .eq('id', id).maybeSingle()
      .then(({ data }) => setEmp(data as EmpInfo))
  }, [id])

  useEffect(() => {
    if (!id) return
    loadMonth()
  }, [id, month])

  const loadMonth = async () => {
    if (!id) return
    setLoading(true)
    const monthDate = parseISO(month + '-01')
    const start = format(startOfMonth(monthDate), 'yyyy-MM-dd')
    const end   = format(endOfMonth(monthDate),   'yyyy-MM-dd')

    const [{ data: att }, { data: bal }] = await Promise.all([
      supabase.from('attendance')
        .select('id, date, status, work_mode, check_in_time, check_out_time, worked_minutes, overtime_minutes')
        .eq('employee_id', id)
        .gte('date', start).lte('date', end)
        .order('date', { ascending: false }),
      supabase.from('leave_balances')
        .select('casual_total, casual_used')
        .eq('employee_id', id)
        .eq('year', new Date().getFullYear())
        .maybeSingle(),
    ])

    setRows((att ?? []) as AttRow[])
    setBalance(bal as LeaveBalance | null)
    setLoading(false)
  }

  const filtered = rows.filter(r => {
    if (filter === 'all')     return true
    if (filter === 'remote')  return r.work_mode === 'remote'
    if (filter === 'present') return r.status === 'present' && r.work_mode !== 'remote'
    return r.status === filter
  })

  // Month summary stats
  const stats = {
    present:  rows.filter(r => r.status === 'present' && r.work_mode !== 'remote').length,
    remote:   rows.filter(r => r.work_mode === 'remote').length,
    absent:   rows.filter(r => r.status === 'absent').length,
    leave:    rows.filter(r => r.status === 'leave').length,
    totalMins: rows.reduce((s, r) => s + (r.worked_minutes ?? 0), 0),
    otMins:   rows.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0),
  }

  const statusBadge = (r: AttRow) => {
    if (r.work_mode === 'remote') return <span className="badge-remote">Remote</span>
    if (r.status === 'present')   return <span className="badge-present">Present</span>
    if (r.status === 'absent')    return <span className="badge-absent">Absent</span>
    if (r.status === 'leave')     return <span className="badge-leave">On Leave</span>
    return <span className="text-xs text-gray-400">{r.status}</span>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="page-header flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          {emp ? (
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-lg flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#E8531D,#C44010)' }}>
                {emp.name[0].toUpperCase()}
              </div>
              <div>
                <h1 className="page-title">{emp.name}</h1>
                <p className="page-subtitle">
                  {emp.employee_code} · {(emp.departments as any)?.name ?? '—'} · {emp.designation}
                  {' · '}
                  <span className={`font-semibold ${emp.location === 'cmk' ? 'text-amber-600' : 'text-blue-600'}`}>
                    {emp.location === 'cmk' ? 'CMK' : 'Office'}
                  </span>
                </p>
              </div>
            </div>
          ) : (
            <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
          )}
        </div>
      </div>

      {/* Leave balance strip */}
      {balance && (
        <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2">
            <Plane size={16} className="text-orange-500" />
            <span className="text-sm font-semibold text-gray-700">Casual Leave Balance</span>
          </div>
          <div className="flex items-center gap-4 flex-1">
            <div className="text-center">
              <p className="text-lg sm:text-xl font-black text-gray-900">{balance.casual_total}</p>
              <p className="text-[10px] text-gray-400">Total</p>
            </div>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-red-400 rounded-full transition-all"
                style={{ width: `${balance.casual_total ? Math.min(100, (balance.casual_used / balance.casual_total) * 100) : 0}%` }} />
            </div>
            <div className="text-center">
              <p className="text-lg sm:text-xl font-black text-red-600">{balance.casual_used}</p>
              <p className="text-[10px] text-gray-400">Used</p>
            </div>
            <div className="text-center">
              <p className="text-lg sm:text-xl font-black text-green-600">{balance.casual_total - balance.casual_used}</p>
              <p className="text-[10px] text-gray-400">Left</p>
            </div>
          </div>
        </div>
      )}

      {/* Month picker + summary stats */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-gray-400" />
          <input type="month" value={month} max={format(new Date(), 'yyyy-MM')}
            onChange={e => setMonth(e.target.value)}
            className="input py-2 text-sm" />
        </div>
        <div className="flex-1" />
        <div className="text-xs text-gray-500 font-medium">
          {format(parseISO(month + '-01'), 'MMMM yyyy')}
        </div>
      </div>

      {/* Stat cards */}
      {!loading && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: 'Present',  val: stats.present,         cls: 'text-green-600',  bg: 'bg-green-50',  key: 'present' as const },
            { label: 'Remote',   val: stats.remote,          cls: 'text-purple-600', bg: 'bg-purple-50', key: 'remote'  as const },
            { label: 'Absent',   val: stats.absent,          cls: 'text-red-600',    bg: 'bg-red-50',    key: 'absent'  as const },
            { label: 'Leave',    val: stats.leave,           cls: 'text-orange-600', bg: 'bg-orange-50', key: 'leave'   as const },
            { label: 'Hrs Worked', val: fmtMins(stats.totalMins), cls: 'text-blue-600',  bg: 'bg-blue-50',   key: 'all'     as const },
            { label: 'Overtime', val: fmtMins(stats.otMins), cls: 'text-amber-600',  bg: 'bg-amber-50',  key: 'all'     as const },
          ].map(({ label, val, cls, bg, key }) => (
            <button key={label}
              onClick={() => key !== 'all' ? setFilter(f => f === key ? 'all' : key) : undefined}
              className={`${bg} rounded-xl p-3 text-center transition-all ${key !== 'all' ? 'hover:shadow-md cursor-pointer' : 'cursor-default'} ${filter === key ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}>
              <p className={`text-lg font-black ${cls}`}>{val}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'present', 'remote', 'absent', 'leave'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
              filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 border border-gray-200'}`}>
            {f === 'all' ? `All (${rows.length})` : f}
          </button>
        ))}
      </div>

      {/* Attendance table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Calendar size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No records for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Hours Worked</th>
                  <th>Overtime</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td className="font-semibold whitespace-nowrap">{formatDate(r.date)}</td>
                    <td>{statusBadge(r)}</td>
                    <td className="font-mono text-sm text-gray-600">{r.check_in_time  ? formatTime(r.check_in_time)  : '—'}</td>
                    <td className="font-mono text-sm text-gray-600">{r.check_out_time ? formatTime(r.check_out_time) : '—'}</td>
                    <td className="font-semibold text-gray-700">{fmtMins(r.worked_minutes)}</td>
                    <td>
                      {(r.overtime_minutes ?? 0) > 0
                        ? <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">+{fmtMins(r.overtime_minutes)}</span>
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
