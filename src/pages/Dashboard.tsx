import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, UserCheck, Monitor, Plane, TrendingUp, RefreshCw, CheckSquare, ChevronLeft, ChevronRight, CheckCircle2, Clock, Building2, Wifi, CalendarDays, AlertCircle, LogIn, LogOut, Timer, Zap, X } from 'lucide-react'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO, addMonths, subMonths, isSameMonth, isToday, isSunday } from 'date-fns'
import { supabase } from '../supabase'
import { StatCard } from '../StatCard'
import { Spinner } from '../Spinner'
import { Modal } from '../Modal'
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
  worked_minutes: number | null
  check_in_time?: string | null
  check_out_time?: string | null
  employee_id?: string
  employee_name?: string
  location?: string
}

interface AttRecord {
  id: string; status: string; work_mode: string | null
  check_in_time: string | null; check_out_time: string | null
  worked_minutes: number; overtime_minutes: number; date: string
}

const fmtMins = (m: number) => {
  const h = Math.floor(m / 60); const min = m % 60
  return h > 0 ? `${h}h ${min}m` : `${min}m`
}

const fmtHrsShort = (m: number) => {
  const h = m / 60
  return `${h.toFixed(1)}h`
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
function AttendanceCalendar({ employeeId, location, compact, empMap, onDayClick }: { employeeId?: string | null, location?: string, compact?: boolean, empMap?: Record<string, string>, onDayClick?: (dateStr: string, records: DayRecord[]) => void }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [records, setRecords] = useState<DayRecord[]>([])
  const [holidays, setHolidays] = useState<{ holiday_date: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)

  const loadMonth = async () => {
    setLoading(true)
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const end   = format(endOfMonth(currentMonth),   'yyyy-MM-dd')

    let query = supabase
      .from('attendance')
      .select('date, status, work_mode, worked_minutes, check_in_time, check_out_time, employee_id, location')
      .gte('date', start)
      .lte('date', end)

    if (employeeId) query = query.eq('employee_id', employeeId)
    if (!employeeId && location) query = query.eq('location', location)

    const { data } = await query
    const enriched = (data ?? []).map((r: any) => ({
      ...r,
      employee_name: empMap?.[r.employee_id] ?? undefined,
    }))
    setRecords(enriched)
    const { data: hols } = await supabase.from('holidays').select('holiday_date, name')
      .gte('holiday_date', start).lte('holiday_date', end)
    setHolidays(hols ?? [])
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

  const statusStyle: Record<string, string> = {
    present:  'bg-green-100 text-green-700 font-semibold border border-green-200',
    remote:   'bg-yellow-100 text-yellow-700 font-semibold border border-yellow-200',
    absent:   'bg-red-100 text-red-600 font-semibold border border-red-200',
    leave:    'bg-red-100 text-red-600 font-semibold border border-red-200',
    sunday:   'bg-gray-100 text-gray-400 border border-gray-200',
    festival: 'bg-gray-900 text-white font-bold border border-gray-800',
    none:     'bg-white text-gray-400 border border-gray-100',
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weekDaysShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  const getWorkedMins = (date: Date) => {
    const rec = records.find(r => r.date === format(date, 'yyyy-MM-dd'))
    return rec?.worked_minutes ?? null
  }

  return (
    <div className={compact ? 'card p-3' : 'card p-5'}>
      {/* Calendar header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={compact ? 'font-semibold text-gray-900 text-sm' : 'font-semibold text-gray-900'}>
          {compact ? 'My calendar' : 'Monthly attendance'}
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={14} />
          </button>
          <span className={`text-xs font-medium text-gray-700 text-center ${compact ? 'w-20' : 'w-28 text-sm'}`}>
            {format(currentMonth, compact ? 'MMM yyyy' : 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Legend */}
      {!compact && (
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { label: 'Present', cls: 'bg-green-100 text-green-700 border border-green-200' },
            { label: 'Remote',  cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
            { label: 'Absent',  cls: 'bg-red-100 text-red-600 border border-red-200' },
            { label: 'Leave',   cls: 'bg-red-100 text-red-600 border border-red-200' },
            { label: 'Sunday',  cls: 'bg-gray-100 text-gray-400 border border-gray-200' },
            { label: 'Holiday', cls: 'bg-gray-900 text-white border border-gray-800' },
          ].map(l => (
            <span key={l.label} className={`text-xs px-2 py-0.5 rounded-full ${l.cls}`}>{l.label}</span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Spinner size="md" /></div>
      ) : (
        <div className="grid grid-cols-7 gap-0.5">
          {/* Week day headers */}
          {(compact ? weekDaysShort : weekDays).map((d, i) => (
            <div key={`${d}-${i}`} className={`text-center font-medium py-1 ${compact ? 'text-[10px]' : 'text-xs'} ${i === 0 ? 'text-red-400' : 'text-gray-400'}`}>
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
            const worked = getWorkedMins(day)
            return (
              <button
                key={day.toISOString()}
                title={getHoliday(day)?.name ?? (onDayClick && status !== 'none' && status !== 'sunday' && status !== 'festival' ? 'Click for details' : '')}
                onClick={() => {
                  if (!onDayClick || status === 'sunday' || status === 'festival' || status === 'none') return
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const dayRecs = records.filter(r => r.date === dateStr)
                  onDayClick(dateStr, dayRecs)
                }}
                className={`
                  flex flex-col items-center justify-center rounded-lg w-full
                  ${compact ? 'py-1' : 'aspect-square text-xs'}
                  ${statusStyle[status]}
                  ${today ? 'ring-2 ring-brand-500 ring-offset-1' : ''}
                  ${onDayClick && status !== 'none' && status !== 'sunday' && status !== 'festival' ? 'hover:brightness-95 cursor-pointer' : 'cursor-default'}
                `}
              >
                <span className={compact ? 'text-[10px] leading-tight' : ''}>{format(day, 'd')}</span>
                {worked != null && worked > 0 && (
                  <span className={`leading-tight font-normal opacity-70 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
                    {fmtHrsShort(worked)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Monthly summary */}
      <div className={`grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-100 ${compact ? 'gap-1' : ''}`}>
        {[
          { label: 'Present', count: records.filter(r => r.status === 'present' && r.work_mode !== 'remote').length, cls: 'text-green-600' },
          { label: 'Remote',  count: records.filter(r => r.work_mode === 'remote').length, cls: 'text-purple-600' },
          { label: 'Absent',  count: records.filter(r => r.status === 'absent').length,  cls: 'text-red-600' },
          { label: 'Leave',   count: records.filter(r => r.status === 'leave').length,   cls: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className={`font-bold ${s.cls} ${compact ? 'text-sm' : 'text-xl'}`}>{s.count}</p>
            <p className={`text-gray-400 mt-0.5 ${compact ? 'text-[10px]' : 'text-xs'}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {holidays.length > 0 && !compact && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Holidays this month</p>
          <div className="flex flex-wrap gap-2">
            {holidays.map(h => (
              <span key={h.holiday_date} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
                style={{ background: '#111827', border: '1px solid #1f2937' }}>
                🎉 {h.name} · {format(parseISO(h.holiday_date), 'dd MMM')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface MonthSummary {
  totalPresent: number
  totalRemote: number
  totalAbsent: number
  totalLeave: number
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, role, profile } = useAuth()
  const navigate = useNavigate()
  const [summary, setSummary]           = useState<TodaySummary | null>(null)
  const [monthSummary, setMonthSummary] = useState<MonthSummary | null>(null)
  const [pendingLeaves, setPending]     = useState<PendingLeave[]>([])
  const [loading, setLoading]           = useState(true)
  const [empId, setEmpId]               = useState<string | null>(null)
  const [empLocation, setEmpLocation]   = useState<string>('office')
  const [calendarLocation, setCalendarLocation] = useState<string>('office')
  const todayStr   = format(new Date(), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const monthEnd   = format(endOfMonth(new Date()), 'yyyy-MM-dd')

  // ── Attendance check-in/out state (merged from Attendance page) ──────────
  const [todayRecord, setTodayRecord] = useState<AttRecord | null>(null)
  const [history, setHistory]         = useState<AttRecord[]>([])
  const [workMode, setWorkMode]       = useState<'office' | 'remote'>('office')
  const [attBusy, setAttBusy]         = useState(false)
  const [attError, setAttError]       = useState<string | null>(null)
  const [now, setNow]                 = useState(new Date())

  const [empMap, setEmpMap]             = useState<Record<string, string>>({})
  const [todayAttFull, setTodayAttFull] = useState<any[]>([])
  const [drillModal, setDrillModal]   = useState<{ title: string; rows: { name: string; sub?: string }[] } | null>(null)

  // live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const isAdmin    = role === 'admin' || role === 'super_admin'
  const isEmployee = role === 'employee' || role === 'cmk_coordinator'

  const loadDashboard = async () => {
    setLoading(true)
    try {
      // Get employee record for current user
      let myLocation = 'office'
      if (profile?.email) {
        const { data: emp } = await supabase
          .from('employees')
          .select('id, location')
          .eq('email', profile.email)
          .maybeSingle()
        if (emp) {
          setEmpId(emp.id)
          setEmpLocation(emp.location)
          myLocation = emp.location
        }
      }

      // Total active employees (scoped by location for non-admins)
      let empQuery = supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'active')
      if (!isAdmin && myLocation) empQuery = empQuery.eq('location', myLocation)
      const { count: totalEmployees } = await empQuery

      // Fetch employee name map
      const { data: allEmps } = await supabase.from('employees').select('id, name, employee_code')
      const empMap: Record<string, string> = Object.fromEntries((allEmps ?? []).map((e: any) => [e.id, e.name]))
      setEmpMap(empMap)

      // Today's attendance
      let attQuery = supabase.from('attendance').select('status, work_mode, location, employee_id').eq('date', todayStr)
      const { data: todayAtt } = await attQuery
      setTodayAttFull((todayAtt ?? []).map((r: any) => ({ ...r, empName: empMap[r.employee_id] ?? '—' })) as any[])

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

      // Current month attendance summary (admin only)
      if (isAdmin) {
        const { data: monthAtt } = await supabase
          .from('attendance').select('status, work_mode, employee_id')
          .gte('date', monthStart).lte('date', monthEnd)
        const ma = monthAtt ?? []
        const uniqueEmps = new Set(ma.map(r => r.employee_id)).size
        setMonthSummary({
          totalPresent: ma.filter(r => r.status === 'present' && r.work_mode !== 'remote').length,
          totalRemote:  ma.filter(r => r.work_mode === 'remote').length,
          totalAbsent:  ma.filter(r => r.status === 'absent').length,
          totalLeave:   ma.filter(r => r.status === 'leave').length,
        })
      }

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

  useEffect(() => { loadDashboard() }, [role, profile?.email])

  // ── Load today's attendance + current month history for employee ─────────
  const loadAttendance = async (employeeId: string) => {
    setAttError(null)
    const { data: today } = await supabase
      .from('attendance').select('*')
      .eq('employee_id', employeeId).eq('date', todayStr).maybeSingle()
    setTodayRecord(today ?? null)

    const { data: hist } = await supabase
      .from('attendance').select('*')
      .eq('employee_id', employeeId)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false })
    setHistory(hist ?? [])
  }

  useEffect(() => {
    if (isEmployee && empId) loadAttendance(empId)
  }, [isEmployee, empId])

  const checkIn = async () => {
    if (!user || !profile || !empId) {
      setAttError('Your account is not linked to an employee record. Please contact admin.')
      return
    }
    setAttBusy(true); setAttError(null)

    const { error: e } = await supabase.from('attendance').insert({
      employee_id: empId,
      date: todayStr,
      check_in_time: '00:00:00', // server trigger overwrites with real IST time
      location: empLocation as any,
      work_mode: workMode,
      status: 'present',
      source: 'self_marked',
      marked_by: user.id,
    })

    if (e) {
      if (e.code === '23505')
        setAttError('You have already checked in today.')
      else
        setAttError(`Check-in failed: ${e.message}`)
    } else {
      setAttError(null)
      await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `Checked in — ${workMode}` })
      await loadAttendance(empId)
    }
    setAttBusy(false)
  }

  const checkOut = async () => {
    if (!user || !profile || !todayRecord || !empId) return
    setAttBusy(true); setAttError(null)

    const { error: e } = await supabase
      .from('attendance')
      .update({ check_out_time: '00:00:00' }) // server trigger overwrites with real IST time
      .eq('id', todayRecord.id)

    if (e) {
      if (e.message?.includes('ALREADY_CHECKED_OUT'))
        setAttError('You have already checked out today.')
      else
        setAttError(`Check-out failed: ${e.message}`)
    } else {
      await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: 'Checked out' })
      await loadAttendance(empId)
    }
    setAttBusy(false)
  }

  // live worked time counter
  const liveWorked = (() => {
    if (!todayRecord?.check_in_time || todayRecord.check_out_time) return null
    const [h, m, s] = todayRecord.check_in_time.split(':').map(Number)
    const start = new Date(); start.setHours(h, m, s ?? 0, 0)
    return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000))
  })()

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

  // ── Drill-down modal (top-anchored) ──────────────────────────────────────
  const DrillModal = drillModal ? (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4 pb-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setDrillModal(null)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-sm">{drillModal.title}</h3>
          <button onClick={() => setDrillModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto max-h-[70vh] divide-y divide-gray-50">
          {drillModal.rows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No records found.</p>
          ) : drillModal.rows.map((row, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <p className="text-sm font-semibold text-gray-800">{row.name}</p>
              {row.sub && <p className="text-xs text-gray-500 font-mono text-right ml-3">{row.sub}</p>}
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-gray-100">
          <button onClick={() => setDrillModal(null)} className="btn-secondary w-full justify-center">Close</button>
        </div>
      </div>
    </div>
  ) : null

  // ── EMPLOYEE VIEW ─────────────────────────────────────────────────────────
  if (isEmployee) {
    const checkedIn  = !!todayRecord
    const checkedOut = !!todayRecord?.check_out_time

    return (
      <div className="space-y-5 max-w-5xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Dashboard</h1>
            <p className="page-subtitle">{formatDate(todayStr)} · {format(now, 'hh:mm:ss a')} · {empLocation === 'office' ? 'Office' : 'CMK'}</p>
          </div>
          <button onClick={loadDashboard} className="btn-secondary">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {/* Employee — personal current month stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Present this month', color: 'bg-green-50', cls: 'text-green-600',  rows: history.filter(r => r.status === 'present' && r.work_mode !== 'remote') },
            ...(role !== 'cmk_coordinator' ? [{ label: 'Remote this month',  color: 'bg-purple-50', cls: 'text-purple-600', rows: history.filter(r => r.work_mode === 'remote') }] : []),
            { label: 'Absent this month',  color: 'bg-red-50',    cls: 'text-red-600',    rows: history.filter(r => r.status === 'absent') },
            { label: 'On leave this month',color: 'bg-orange-50', cls: 'text-orange-600', rows: history.filter(r => r.status === 'leave') },
          ].map(({ label, color, cls, rows }) => (
            <button key={label} onClick={() => setDrillModal({ title: label, rows: rows.map(r => ({ name: formatDate(r.date), sub: r.check_in_time ? `${formatTime(r.check_in_time)}${r.check_out_time ? ' → ' + formatTime(r.check_out_time) : ''}` : undefined })) })}
              className={`card p-4 text-center ${color} cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all`}>
              <p className={`text-3xl font-bold ${cls}`}>{rows.length}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </button>
          ))}
        </div>

        {/* Check-in/out widget + compact calendar side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Check-in/out card — hidden for CMK coordinators */}
          <div className="lg:col-span-2 card-elevated rounded-3xl p-7">
            {/* ── NOT CHECKED IN ── */}
            {!checkedIn && !attError && (
              <>
                <h2 className="font-black text-gray-900 text-xl mb-1 tracking-tight">Check in</h2>
                <p className="text-sm text-gray-400 mb-6">
                  Time is recorded by the server and cannot be edited.
                </p>

                {/* CMK employees get no work-mode choice — they always check in at CMK */}
                {empLocation === 'cmk' ? (
                  <div className="flex justify-center mb-6">
                    <div className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-brand-500 shadow-xl shadow-brand-500/15 w-48">
                      <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg,#E8531D,#C44010)' }}>
                        <Building2 size={22} className="text-white" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-sm text-brand-700">At CMK</p>
                        <p className="text-xs text-gray-400 mt-0.5">Working from CMK</p>
                      </div>
                    </div>
                  </div>
                ) : (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {/* Office */}
                  <button onClick={() => setWorkMode('office')}
                    className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                      workMode === 'office'
                        ? 'border-brand-500 shadow-xl shadow-brand-500/15'
                        : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
                    }`}>
                    <div className="p-3 rounded-xl"
                      style={{ background: workMode === 'office' ? 'linear-gradient(135deg,#E8531D,#C44010)' : '#E5E7EB' }}>
                      <Building2 size={22} className={workMode === 'office' ? 'text-white' : 'text-gray-400'} />
                    </div>
                    <div className="text-center">
                      <p className={`font-bold text-sm ${workMode === 'office' ? 'text-brand-700' : 'text-gray-500'}`}>In Office</p>
                      <p className="text-xs text-gray-400 mt-0.5">Working from office</p>
                    </div>
                  </button>

                  {/* Remote */}
                  <button
                    onClick={() => setWorkMode('remote')}
                    className={`relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                      workMode === 'remote'
                        ? 'border-violet-500 shadow-xl shadow-violet-500/15'
                        : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
                    }`}>
                    <div className="p-3 rounded-xl"
                      style={{ background: workMode === 'remote' ? 'linear-gradient(135deg,#8B5CF6,#7C3AED)' : '#E5E7EB' }}>
                      <Wifi size={22} className={workMode === 'remote' ? 'text-white' : 'text-gray-400'} />
                    </div>
                    <div className="text-center">
                      <p className={`font-bold text-sm ${workMode === 'remote' ? 'text-violet-700' : 'text-gray-500'}`}>Remote</p>
                      <p className="text-xs text-gray-400 mt-0.5">Working from home</p>
                    </div>
                  </button>
                </div>
                )}

                <button onClick={checkIn} disabled={attBusy}
                  className="btn-primary w-full justify-center py-4 rounded-2xl text-base">
                  {attBusy ? <Spinner size="sm" /> : <LogIn size={19} />}
                  {attBusy ? 'Checking in...' : 'Check In'}
                </button>
                <p className="text-xs text-center text-gray-400 mt-3 flex items-center justify-center gap-1.5">
                  <Clock size={11} /> One entry per day · time is server-stamped
                </p>
              </>
            )}

            {/* Error banner for missing employee record */}
            {attError && !checkedIn && (
              <div className="flex items-start gap-3 px-5 py-4 rounded-2xl text-sm text-red-700"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{attError}</span>
              </div>
            )}

            {/* ── CHECKED IN, NOT OUT ── */}
            {checkedIn && !checkedOut && (
              <div className="text-center py-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Working now</span>
                </div>

                <p className="text-5xl font-black text-gray-900 tracking-tight mb-1 tabular-nums">
                  {liveWorked !== null ? fmtMins(liveWorked) : '—'}
                </p>
                <p className="text-sm text-gray-400 mb-2">
                  Checked in at {formatTime(todayRecord!.check_in_time ?? '')}
                  {' · '}
                  {todayRecord!.work_mode === 'remote' ? '🏠 Remote' : '🏢 Office'}
                </p>
                {liveWorked !== null && liveWorked > 540 && (
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 mb-3">
                    <Zap size={12} /> Overtime: {fmtMins(liveWorked - 540)}
                  </p>
                )}

                {attError && (
                  <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-600 text-left"
                    style={{ background: 'rgba(239,68,68,0.06)' }}>{attError}</div>
                )}

                <button onClick={checkOut} disabled={attBusy}
                  className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-semibold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg,#374151,#1F2937)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                  {attBusy ? <Spinner size="sm" /> : <LogOut size={19} />}
                  {attBusy ? 'Checking out...' : 'Check Out'}
                </button>
                <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1.5">
                  <Clock size={11} /> Standard day: 9 hours · overtime tracked automatically
                </p>
              </div>
            )}

            {/* ── CHECKED OUT ── */}
            {checkedOut && (
              <div className="text-center py-4">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ background: 'linear-gradient(135deg,#D1FAE5,#A7F3D0)', boxShadow: '0 8px 30px rgba(16,185,129,0.2)' }}>
                  <CheckCircle2 size={38} className="text-emerald-600" />
                </div>
                <h2 className="text-xl font-black text-gray-900 mb-4">Day complete!</h2>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Check in',  val: formatTime(todayRecord!.check_in_time ?? '') },
                    { label: 'Check out', val: formatTime(todayRecord!.check_out_time ?? '') },
                    { label: 'Worked',    val: fmtMins(todayRecord!.worked_minutes ?? 0) },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-2xl bg-gray-50">
                      <p className="text-sm font-black text-gray-900">{s.val}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                {(todayRecord!.overtime_minutes ?? 0) > 0 && (
                  <p className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-amber-700"
                    style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <Zap size={12} /> Overtime: {fmtMins(todayRecord!.overtime_minutes)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Compact monthly calendar */}
          <AttendanceCalendar employeeId={empId} location={empLocation} compact onDayClick={(dateStr) => navigate(`/attendance/${dateStr}`)} />
        </div>

        {/* History table */}
        <div className="card overflow-hidden">
          <div className="table-header">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ background: 'rgba(232,83,29,0.08)' }}>
                <CalendarDays size={15} style={{ color: '#E8531D' }} />
              </div>
              <h3 className="font-bold text-gray-900">This month — {format(new Date(), 'MMMM yyyy')}</h3>
            </div>
            {history.some(r => r.overtime_minutes > 0) && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                <Timer size={13} />
                Total OT: {fmtMins(history.reduce((a, r) => a + (r.overtime_minutes || 0), 0))}
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr><th>Date</th><th>Status</th><th>In</th><th>Out</th><th>Hours</th><th>OT</th></tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No records yet.</td></tr>
                ) : history.map(r => (
                  <tr key={r.id}>
                    <td className="font-semibold whitespace-nowrap">{formatDate(r.date)}</td>
                    <td>
                      {r.status === 'present' && r.work_mode !== 'remote' && <span className="badge-present">Present</span>}
                      {r.work_mode === 'remote' && <span className="badge-remote">Remote</span>}
                      {r.status === 'absent'  && <span className="badge-absent">Absent</span>}
                      {r.status === 'leave'   && <span className="badge-leave">Leave</span>}
                    </td>
                    <td className="text-gray-400">{r.check_in_time  ? formatTime(r.check_in_time)  : '—'}</td>
                    <td className="text-gray-400">{r.check_out_time ? formatTime(r.check_out_time) : '—'}</td>
                    <td className="font-medium text-gray-600">{r.worked_minutes ? fmtMins(r.worked_minutes) : '—'}</td>
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
        </div>
      </div>
    )
  }

  // ── ADMIN / SUPER ADMIN VIEW ──────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="page-header flex-wrap gap-2">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Today — {formatDate(todayStr)} · {format(now, 'hh:mm a')}</p>
        </div>
        <button onClick={loadDashboard} className="btn-secondary">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Link to="/employees" className="block">
          <StatCard label="Total employees"  value={summary?.totalEmployees ?? 0} icon={Users} color="gray" sub="Tap to manage" />
        </Link>
        <button className="text-left" onClick={() => setDrillModal({ title: 'Present today — office', rows: todayAttFull.filter(r => r.status === 'present' && r.work_mode !== 'remote').map(r => ({ name: (r as any).empName, sub: '' })) })}>
          <StatCard label="Present today"  value={summary?.presentTotal ?? 0}                icon={UserCheck} color="green"  sub="Tap to see who" />
        </button>
        <button className="text-left" onClick={() => setDrillModal({ title: 'Remote today', rows: todayAttFull.filter(r => r.work_mode === 'remote').map(r => ({ name: (r as any).empName, sub: '' })) })}>
          <StatCard label="Remote today"   value={summary?.remoteTotal ?? 0}                 icon={Monitor}   color="purple" sub="Tap to see who" />
        </button>
        <button className="text-left" onClick={() => setDrillModal({ title: 'On leave today', rows: todayAttFull.filter(r => r.status === 'leave').map(r => ({ name: (r as any).empName, sub: '' })) })}>
          <StatCard label="On leave"       value={summary?.leaveTotal ?? 0}                  icon={Plane}     color="orange" sub="Tap to see who" />
        </button>
        <StatCard label="Attendance %"     value={`${summary?.attendancePct ?? 0}%`}         icon={TrendingUp} color="blue"  sub="vs total active" />
      </div>

      {/* Current month summary */}
      {monthSummary && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CalendarDays size={16} className="text-brand-500" />
            {format(new Date(), 'MMMM yyyy')} — monthly overview
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total present days', val: monthSummary.totalPresent, cls: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Total remote days',  val: monthSummary.totalRemote,  cls: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Total absent days',  val: monthSummary.totalAbsent,  cls: 'text-red-600',    bg: 'bg-red-50'    },
              { label: 'Total leave days',   val: monthSummary.totalLeave,   cls: 'text-orange-600', bg: 'bg-orange-50' },
            ].map(({ label, val, cls, bg }) => (
              <div key={label} className={`text-center p-4 ${bg} rounded-xl`}>
                <p className={`text-3xl font-bold ${cls}`}>{val}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Office and CMK side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Office */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
            Office attendance
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Present', cls: 'text-green-600',  bg: 'bg-green-50',  filter: (r: any) => r.location === 'office' && r.status === 'present' && r.work_mode !== 'remote' },
              { label: 'Remote',  cls: 'text-purple-600', bg: 'bg-purple-50', filter: (r: any) => r.location === 'office' && r.work_mode === 'remote' },
              { label: 'Absent',  cls: 'text-red-600',    bg: 'bg-red-50',    filter: (r: any) => r.location === 'office' && r.status === 'absent' },
              { label: 'Leave',   cls: 'text-orange-600', bg: 'bg-orange-50', filter: (r: any) => r.location === 'office' && r.status === 'leave' },
            ].map(({ label, cls, bg, filter: fn }) => {
              const rows = todayAttFull.filter(fn)
              return (
                <button key={label} onClick={() => setDrillModal({ title: `Office — ${label} today`, rows: rows.map(r => ({ name: (r as any).empName })) })}
                  className={`text-center p-3 ${bg} rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all w-full`}>
                  <p className={`text-2xl font-bold ${cls}`}>{rows.length}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* CMK */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-brand-500 rounded-full" />
            CMK attendance
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'Present', cls: 'text-green-600',  bg: 'bg-green-50',  filter: (r: any) => r.location === 'cmk' && r.status === 'present' },
              { label: 'Absent',  cls: 'text-red-600',    bg: 'bg-red-50',    filter: (r: any) => r.location === 'cmk' && r.status === 'absent' },
              { label: 'Leave',   cls: 'text-orange-600', bg: 'bg-orange-50', filter: (r: any) => r.location === 'cmk' && r.status === 'leave' },
            ].map(({ label, cls, bg, filter: fn }) => {
              const rows = todayAttFull.filter(fn)
              return (
                <button key={label} onClick={() => setDrillModal({ title: `CMK — ${label} today`, rows: rows.map(r => ({ name: (r as any).empName })) })}
                  className={`text-center p-3 ${bg} rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all w-full`}>
                  <p className={`text-2xl font-bold ${cls}`}>{rows.length}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </button>
              )
            })}
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
          <AttendanceCalendar location={calendarLocation} empMap={empMap} onDayClick={(dateStr) => navigate(`/attendance/${dateStr}`)} />
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
            <table className="w-full min-w-[400px]">
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
      {DrillModal}
    </div>
  )
}
