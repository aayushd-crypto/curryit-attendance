import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, UserCheck, Monitor, Plane, TrendingUp, RefreshCw, CheckSquare, ChevronLeft, ChevronRight, LogIn, LogOut, Building2, Wifi, Clock } from 'lucide-react'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO, addMonths, subMonths, isSameMonth, isToday, isSunday } from 'date-fns'
import { supabase } from '../supabase'
import { StatCard } from '../StatCard'
import { Spinner } from '../Spinner'
import { useAuth } from '../AuthContext'
import { formatDate, formatTime, statusLabel, logAudit } from '../helpers'

interface TodaySummary {
  totalEmployees: number
  presentTotal: number
  remoteTotal: number
  absentTotal: number
  leaveTotal: number
  attendancePct: number
  officePresent: number
  officeRemote: number
  officeAbsent: number
  officeLeave: number
  cmkPresent: number
  cmkAbsent: number
  cmkLeave: number
}

interface DayRecord {
  date: string
  status: string
  work_mode: string | null
}

interface PendingLeave {
  id: string
  employee_name: string
  leave_type: string
  start_date: string
  end_date: string
  total_days: number
}

// ── Monthly Calendar Component ────────────────────────────────────────────────
function AttendanceCalendar({ employeeId, location }: { employeeId?: string | null, location?: string }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [records, setRecords] = useState<DayRecord[]>([])
  const [holidays, setHolidays] = useState<{ holiday_date: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [totalEmp, setTotalEmp] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayDetails, setDayDetails] = useState<any[]>([])
  const [dayLoading, setDayLoading] = useState(false)

  const loadMonth = async () => {
    setLoading(true)
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end   = format(endOfMonth(currentMonth),   'yyyy-MM-dd')

    let query = supabase
      .from('attendance')
      .select('date, status, work_mode')
      .gte('date', start)
      .lte('date', end)

    if (employeeId) query = query.eq('employee_id', employeeId)
    if (!employeeId && location) query = query.eq('location', location)

    const { data } = await query
    setRecords(data ?? [])
    const { data: hols } = await supabase.from('holidays').select('holiday_date, name')
      .gte('holiday_date', start).lte('holiday_date', end)
    setHolidays(hols ?? [])

    if (!employeeId) {
      let empQ = supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'active')
      if (location) empQ = empQ.eq('location', location)
      const { count } = await empQ
      setTotalEmp(count ?? 0)
    }

    setLoading(false)
  }

  useEffect(() => { loadMonth() }, [currentMonth, employeeId, location])

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const firstDayOfWeek = getDay(startOfMonth(currentMonth)) // 0=Sun

  const getHoliday = (date: Date) => holidays.find(h => h.holiday_date === format(date, 'yyyy-MM-dd'))

  const getDayStatus = (date: Date) => {
    if (getHoliday(date)) return 'festival'
    if (isSunday(date)) return 'sunday'
    const rec = records.find(r => r.date === format(date, 'yyyy-MM-dd'))
    if (!rec) return 'none'
    if (rec.status === 'present' && rec.work_mode === 'remote') return 'remote'
    return rec.status
  }

  const getPresentCount = (date: Date) =>
    records.filter(r => r.date === format(date, 'yyyy-MM-dd') && (r.status === 'present')).length

  const openDay = async (date: Date) => {
    if (employeeId) return
    const dateStr = format(date, 'yyyy-MM-dd')
    setSelectedDate(dateStr)
    setDayLoading(true)
    let q = supabase
      .from('attendance')
      .select('status, work_mode, check_in_time, check_out_time, employees(name, employee_code)')
      .eq('date', dateStr)
    if (location) q = q.eq('location', location)
    const { data } = await q
    setDayDetails(data ?? [])
    setDayLoading(false)
  }
  const statusStyle: Record<string, string> = {
    present: 'bg-green-100 text-green-700 font-semibold border border-green-200',
    remote:  'bg-purple-100 text-purple-700 font-semibold border border-purple-200',
    absent:  'bg-red-100 text-red-600 font-semibold border border-red-200',
    leave:   'bg-orange-100 text-orange-700 font-semibold border border-orange-200',
    sunday:  'bg-gray-100 text-gray-400 border border-gray-200',
    festival: 'bg-sky-100 text-sky-700 font-bold border border-sky-200',
    none:    'bg-white text-gray-400 border border-gray-100',
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="card p-5">
      {/* Calendar header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Monthly attendance</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-700 w-28 text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            disabled={isSameMonth(currentMonth, new Date())}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { label: 'Present', cls: 'bg-green-100 text-green-700 border border-green-200' },
          { label: 'Remote',  cls: 'bg-purple-100 text-purple-700 border border-purple-200' },
          { label: 'Absent',  cls: 'bg-red-100 text-red-600 border border-red-200' },
          { label: 'Leave',   cls: 'bg-orange-100 text-orange-700 border border-orange-200' },
          { label: 'Sunday',  cls: 'bg-gray-100 text-gray-400 border border-gray-200' },
          { label: 'Holiday', cls: 'bg-sky-100 text-sky-700 border border-sky-200' },
        ].map(l => (
          <span key={l.label} className={`text-xs px-2 py-0.5 rounded-full ${l.cls}`}>{l.label}</span>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Spinner size="md" /></div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {/* Week day headers */}
          {weekDays.map(d => (
            <div key={d} className={`text-center text-xs font-medium py-1 ${d === 'Sun' ? 'text-red-400' : 'text-gray-400'}`}>
              {d}
            </div>
          ))}

          {/* Empty cells before first day */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {/* Day cells */}
          {days.map(day => {
            const status = getDayStatus(day)
            const today  = isToday(day)
            const present = getPresentCount(day)
            const clickable = !employeeId && !isSunday(day) && day <= new Date()
            return (
              <div
                key={day.toISOString()}
                title={getHoliday(day)?.name ?? ''}
                onClick={() => clickable && openDay(day)}
                className={`
                  aspect-square flex flex-col items-center justify-center rounded-xl text-xs gap-0.5
                  ${statusStyle[status]}
                  ${today ? 'ring-2 ring-brand-500 ring-offset-1' : ''}
                  ${clickable ? 'cursor-pointer hover:opacity-80' : ''}
                `}
              >
                <span>{format(day, 'd')}</span>
                {!employeeId && status !== 'sunday' && status !== 'festival' && totalEmp > 0 && (
                  <span className="text-[9px] font-normal opacity-70">{present}/{totalEmp}</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Monthly summary */}
      <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-100">
        {[
          { label: 'Present', count: records.filter(r => r.status === 'present' && r.work_mode !== 'remote').length, cls: 'text-green-600' },
          { label: 'Remote',  count: records.filter(r => r.work_mode === 'remote').length, cls: 'text-purple-600' },
          { label: 'Absent',  count: records.filter(r => r.status === 'absent').length,  cls: 'text-red-600' },
          { label: 'Leave',   count: records.filter(r => r.status === 'leave').length,   cls: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className={`text-xl font-bold ${s.cls}`}>{s.count}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {holidays.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Holidays this month</p>
          <div className="flex flex-wrap gap-2">
            {holidays.map(h => (
              <span key={h.holiday_date} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-sky-700"
                style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)' }}>
                🎉 {h.name} · {format(parseISO(h.holiday_date), 'dd MMM')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Day detail modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setSelectedDate(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto p-5"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {format(parseISO(selectedDate), 'EEEE, dd MMM yyyy')}
              </h3>
              <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            {dayLoading ? (
              <div className="flex justify-center py-8"><Spinner size="md" /></div>
            ) : dayDetails.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No attendance records for this date.</p>
            ) : (
              <div className="space-y-2">
                {dayDetails.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{r.employees?.name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{r.employees?.employee_code}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyle[r.status === 'present' && r.work_mode === 'remote' ? 'remote' : r.status]}`}>
                        {r.status === 'present' && r.work_mode === 'remote' ? 'Remote' : statusLabel(r.status)}
                      </span>
                      {r.check_in_time && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          {formatTime(r.check_in_time)}{r.check_out_time ? ` – ${formatTime(r.check_out_time)}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, role, profile } = useAuth()
  const [summary, setSummary]       = useState<TodaySummary | null>(null)
  const [pendingLeaves, setPending] = useState<PendingLeave[]>([])
  const [loading, setLoading]       = useState(true)
  const [empId, setEmpId]           = useState<string | null>(null)
  const [empLocation, setEmpLocation] = useState<string>('office')
  const [calendarLocation, setCalendarLocation] = useState<string>('office')
  const [todayRecord, setTodayRecord] = useState<any>(null)
  const [ciBusy, setCiBusy] = useState(false)
  const [ciError, setCiError] = useState<string | null>(null)
  const [wfhApproved, setWfhApproved] = useState(false)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const isAdmin = role === 'admin' || role === 'super_admin'
  const isEmployee = role === 'employee'

  const loadDashboard = async () => {
    setLoading(true)
    try {
      // Get employee record for current user
      if (profile?.email) {
        const { data: emp } = await supabase
          .from('employees')
          .select('id, location')
          .eq('email', profile.email)
          .maybeSingle()
        if (emp) {
          setEmpId(emp.id)
          setEmpLocation(emp.location)

          const { data: today } = await supabase
            .from('attendance').select('*')
            .eq('employee_id', emp.id).eq('date', todayStr).maybeSingle()
          setTodayRecord(today ?? null)

          try {
            const { data: wfh } = await supabase
              .from('wfh_requests').select('id')
              .eq('employee_id', emp.id).eq('status', 'approved')
              .lte('start_date', todayStr).gte('end_date', todayStr).limit(1)
            setWfhApproved((wfh ?? []).length > 0)
          } catch {
            setWfhApproved(false)
          }
        }
      }

      // Total active employees (scoped by location for non-admins)
      let empQuery = supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'active')
      if (!isAdmin && empLocation) empQuery = empQuery.eq('location', empLocation)
      const { count: totalEmployees } = await empQuery

      // Today's attendance
      let attQuery = supabase.from('attendance').select('status, work_mode, location, employee_id').eq('date', todayStr)
      const { data: todayAtt } = await attQuery

      const att = todayAtt ?? []
      const presentTotal  = att.filter(r => r.status === 'present' && r.work_mode !== 'remote').length
      const remoteTotal   = att.filter(r => r.work_mode === 'remote').length
      const absentTotal   = att.filter(r => r.status === 'absent').length
      const leaveTotal    = att.filter(r => r.status === 'leave').length
      const total         = totalEmployees ?? 0
      const attendancePct = total ? Math.round(((presentTotal + remoteTotal) / total) * 100) : 0

      const officeAtt = att.filter(r => r.location === 'office')
      const cmkAtt    = att.filter(r => r.location === 'cmk')

      setSummary({
        totalEmployees: total,
        presentTotal, remoteTotal, absentTotal, leaveTotal, attendancePct,
        officePresent: officeAtt.filter(r => r.status === 'present' && r.work_mode !== 'remote').length,
        officeRemote:  officeAtt.filter(r => r.work_mode === 'remote').length,
        officeAbsent:  officeAtt.filter(r => r.status === 'absent').length,
        officeLeave:   officeAtt.filter(r => r.status === 'leave').length,
        cmkPresent:    cmkAtt.filter(r => r.status === 'present').length,
        cmkAbsent:     cmkAtt.filter(r => r.status === 'absent').length,
        cmkLeave:      cmkAtt.filter(r => r.status === 'leave').length,
      })

      // Pending leaves (admin only)
      if (isAdmin) {
        const { data: leaves } = await supabase
          .from('leave_requests')
          .select('id, leave_type, start_date, end_date, total_days, employees(name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5)

        setPending((leaves ?? []).map((l: any) => ({
          id: l.id,
          employee_name: l.employees?.name ?? '—',
          leave_type: l.leave_type,
          start_date: l.start_date,
          end_date: l.end_date,
          total_days: l.total_days,
        })))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDashboard() }, [role, profile])

  const checkIn = async (workMode: 'office' | 'remote') => {
    if (!user || !profile || !empId) return
    setCiBusy(true); setCiError(null)
    const { error: e } = await supabase.from('attendance').insert({
      employee_id: empId,
      date: todayStr,
      check_in_time: '00:00:00',
      location: empLocation as any,
      work_mode: workMode,
      status: 'present',
      source: 'self_marked',
      marked_by: user.id,
    })
    if (e) {
      if (e.message?.includes('WFH_NOT_APPROVED'))
        setCiError('Remote check-in requires an approved WFH request for today.')
      else if (e.code === '23505')
        setCiError('You have already checked in today.')
      else
        setCiError(`Check-in failed: ${e.message}`)
    } else {
      await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `Checked in — ${workMode}` })
      await loadDashboard()
    }
    setCiBusy(false)
  }

  const checkOut = async () => {
    if (!user || !profile || !todayRecord) return
    setCiBusy(true); setCiError(null)
    const { error: e } = await supabase
      .from('attendance')
      .update({ check_out_time: '00:00:00' })
      .eq('id', todayRecord.id)
    if (e) {
      if (e.message?.includes('ALREADY_CHECKED_OUT'))
        setCiError('You have already checked out today.')
      else
        setCiError(`Check-out failed: ${e.message}`)
    } else {
      await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: 'Checked out' })
      await loadDashboard()
    }
    setCiBusy(false)
  }

  const pieData = summary ? [
    { name: 'Present',  value: summary.presentTotal + summary.remoteTotal, color: '#16a34a' },
    { name: 'Absent',   value: summary.absentTotal,  color: '#dc2626' },
    { name: 'On Leave', value: summary.leaveTotal,   color: '#E8531D' },
  ] : []

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )

  // ── EMPLOYEE VIEW ─────────────────────────────────────────────────────────
  if (isEmployee) {
    return (
      <div className="space-y-5 max-w-3xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Dashboard</h1>
            <p className="page-subtitle">{formatDate(todayStr)} · {empLocation === 'office' ? 'Office' : 'CMK'}</p>
          </div>
          <button onClick={loadDashboard} className="btn-secondary">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {/* Employee stats — only their location */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="card p-4 text-center bg-gray-50">
            <p className="text-3xl font-bold text-gray-700">{summary?.totalEmployees ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Total employees</p>
          </div>
          <div className="card p-4 text-center bg-green-50">
            <p className="text-3xl font-bold text-green-600">{summary?.presentTotal ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Present today</p>
          </div>
          <div className="card p-4 text-center bg-purple-50">
            <p className="text-3xl font-bold text-purple-600">{summary?.remoteTotal ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Remote today</p>
          </div>
          <div className="card p-4 text-center bg-orange-50">
            <p className="text-3xl font-bold text-orange-600">{summary?.leaveTotal ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">On leave</p>
          </div>
          <div className="card p-4 text-center bg-blue-50">
            <p className="text-3xl font-bold text-blue-600">{summary?.attendancePct ?? 0}%</p>
            <p className="text-xs text-gray-500 mt-1">Attendance %</p>
          </div>
        </div>

        {/* Check in / Check out */}
        <div className="card p-5">
          {!todayRecord ? (
            <>
              <h3 className="font-semibold text-gray-900 mb-3">Mark your attendance</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => checkIn('office')}
                  disabled={ciBusy}
                  className="btn-primary flex-1 justify-center py-3 rounded-xl"
                >
                  {ciBusy ? <Spinner size="sm" /> : <Building2 size={16} />}
                  Check In — Office
                </button>
                <button
                  onClick={() => wfhApproved && checkIn('remote')}
                  disabled={ciBusy || !wfhApproved}
                  title={!wfhApproved ? 'Needs approved WFH request for today' : ''}
                  className="btn-secondary flex-1 justify-center py-3 rounded-xl disabled:opacity-50"
                >
                  <Wifi size={16} />
                  Check In — Remote
                </button>
              </div>
              {!wfhApproved && (
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                  <Clock size={11} /> Remote check-in needs an approved WFH request for today.
                </p>
              )}
            </>
          ) : !todayRecord.check_out_time ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">You're checked in</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Since {formatTime(todayRecord.check_in_time)} · {todayRecord.work_mode === 'remote' ? '🏠 Remote' : '🏢 Office'}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-700"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Working now
                </span>
              </div>
              <button onClick={checkOut} disabled={ciBusy} className="btn-primary w-full justify-center py-3 rounded-xl">
                {ciBusy ? <Spinner size="sm" /> : <LogOut size={16} />}
                Check Out
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Today's attendance done ✓</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatTime(todayRecord.check_in_time)} – {formatTime(todayRecord.check_out_time)}
                  {' · '}{todayRecord.work_mode === 'remote' ? '🏠 Remote' : '🏢 Office'}
                </p>
              </div>
              <CheckSquare className="text-green-500" size={28} />
            </div>
          )}
          {ciError && (
            <p className="text-sm text-red-600 mt-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)' }}>{ciError}</p>
          )}
        </div>

        {/* Monthly calendar for this employee */}
        <AttendanceCalendar employeeId={empId} location={empLocation} />
      </div>
    )
  }

  // ── ADMIN / SUPER ADMIN VIEW ──────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Today's overview — {formatDate(todayStr)}</p>
        </div>
        <button onClick={loadDashboard} className="btn-secondary">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total employees"  value={summary?.totalEmployees ?? 0}              icon={Users}     color="gray"   />
        <StatCard label="Present today"    value={summary?.presentTotal ?? 0}                icon={UserCheck} color="green"  sub="In office" />
        <StatCard label="Remote today"     value={summary?.remoteTotal ?? 0}                 icon={Monitor}   color="purple" />
        <StatCard label="On leave"         value={summary?.leaveTotal ?? 0}                  icon={Plane}     color="orange" />
        <StatCard label="Attendance %"     value={`${summary?.attendancePct ?? 0}%`}         icon={TrendingUp} color="blue"  sub="vs total active" />
      </div>

      {/* Office and CMK side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Office */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
            Office attendance
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Present', val: summary?.officePresent ?? 0, cls: 'text-green-600',  bg: 'bg-green-50'  },
              { label: 'Remote',  val: summary?.officeRemote  ?? 0, cls: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Absent',  val: summary?.officeAbsent  ?? 0, cls: 'text-red-600',    bg: 'bg-red-50'    },
              { label: 'Leave',   val: summary?.officeLeave   ?? 0, cls: 'text-orange-600', bg: 'bg-orange-50' },
            ].map(({ label, val, cls, bg }) => (
              <div key={label} className={`text-center p-3 ${bg} rounded-xl`}>
                <p className={`text-2xl font-bold ${cls}`}>{val}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CMK */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-brand-500 rounded-full" />
            CMK attendance
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Present', val: summary?.cmkPresent ?? 0, cls: 'text-green-600',  bg: 'bg-green-50'  },
              { label: 'Absent',  val: summary?.cmkAbsent  ?? 0, cls: 'text-red-600',    bg: 'bg-red-50'    },
              { label: 'Leave',   val: summary?.cmkLeave   ?? 0, cls: 'text-orange-600', bg: 'bg-orange-50' },
            ].map(({ label, val, cls, bg }) => (
              <div key={label} className={`text-center p-3 ${bg} rounded-xl`}>
                <p className={`text-2xl font-bold ${cls}`}>{val}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar + Pie chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCalendarLocation('office')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                calendarLocation === 'office'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1.5 align-middle" style={{ background: calendarLocation === 'office' ? '#fff' : '#3b82f6' }} />
              Office
            </button>
            <button
              onClick={() => setCalendarLocation('cmk')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                calendarLocation === 'cmk'
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: calendarLocation === 'cmk' ? '#fff' : '#E8531D' }} />
              CMK
            </button>
          </div>
          <AttendanceCalendar location={calendarLocation} />
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Today's breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pending leaves */}
      {pendingLeaves.length > 0 ? (
        <div className="card">
          <div className="table-header">
            <div>
              <h3 className="font-semibold text-gray-900">Pending leave approvals</h3>
              <p className="text-xs text-gray-500 mt-0.5">{pendingLeaves.length} request{pendingLeaves.length > 1 ? 's' : ''} awaiting review</p>
            </div>
            <Link to="/leave" className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th>
                </tr>
              </thead>
              <tbody>
                {pendingLeaves.map(leave => (
                  <tr key={leave.id}>
                    <td className="font-medium text-gray-900">{leave.employee_name}</td>
                    <td><span className="badge-pending">{statusLabel(leave.leave_type)}</span></td>
                    <td>{formatDate(leave.start_date)}</td>
                    <td>{formatDate(leave.end_date)}</td>
                    <td>{leave.total_days}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <CheckSquare size={32} className="mx-auto text-green-400 mb-2" />
          <p className="font-medium text-gray-700">All caught up!</p>
          <p className="text-sm text-gray-500 mt-1">No pending leave approvals right now.</p>
        </div>
      )}
    </div>
  )
}
