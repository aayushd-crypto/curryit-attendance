import { useEffect, useState } from 'react'
import { Users, UserCheck, Monitor, UserX, Plane, TrendingUp, RefreshCw, CheckSquare } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, subDays, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { StatCard } from '../components/Dashboard/StatCard'
import { Spinner } from '../components/Common/Spinner'
import { useAuth } from '../context/AuthContext'
import { formatDate, statusLabel } from '../utils/helpers'

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

interface TrendPoint {
  date: string
  present: number
  absent: number
  leave: number
}

interface PendingLeave {
  id: string
  employee_name: string
  leave_type: string
  start_date: string
  end_date: string
  total_days: number
}

export default function Dashboard() {
  const { role } = useAuth()
  const [summary, setSummary]         = useState<TodaySummary | null>(null)
  const [trend, setTrend]             = useState<TrendPoint[]>([])
  const [pendingLeaves, setPending]   = useState<PendingLeave[]>([])
  const [loading, setLoading]         = useState(true)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const loadDashboard = async () => {
    setLoading(true)
    try {
      // Total active employees
      const { count: totalEmployees } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      // Today's attendance
      const { data: todayAtt } = await supabase
        .from('attendance')
        .select('status, work_mode, location')
        .eq('date', todayStr)

      const att = todayAtt ?? []
      const presentTotal  = att.filter(r => r.status === 'present').length
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
        officePresent: officeAtt.filter(r => r.status === 'present' && r.work_mode === 'office').length,
        officeRemote:  officeAtt.filter(r => r.work_mode === 'remote').length,
        officeAbsent:  officeAtt.filter(r => r.status === 'absent').length,
        officeLeave:   officeAtt.filter(r => r.status === 'leave').length,
        cmkPresent:    cmkAtt.filter(r => r.status === 'present').length,
        cmkAbsent:     cmkAtt.filter(r => r.status === 'absent').length,
        cmkLeave:      cmkAtt.filter(r => r.status === 'leave').length,
      })

      // 7-day trend
      const days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'))
      const { data: trendData } = await supabase
        .from('attendance')
        .select('date, status, work_mode')
        .gte('date', days[0])
        .lte('date', days[6])

      setTrend(days.map(date => {
        const dayAtt = (trendData ?? []).filter(r => r.date === date)
        return {
          date: format(parseISO(date), 'EEE'),
          present: dayAtt.filter(r => r.status === 'present' || r.work_mode === 'remote').length,
          absent:  dayAtt.filter(r => r.status === 'absent').length,
          leave:   dayAtt.filter(r => r.status === 'leave').length,
        }
      }))

      // Pending leaves (admin/super_admin only)
      if (role === 'admin' || role === 'super_admin') {
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

  useEffect(() => { loadDashboard() }, [])

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Today's overview — {formatDate(todayStr)}</p>
        </div>
        <button onClick={loadDashboard} className="btn-secondary">
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total employees"  value={summary?.totalEmployees ?? 0}   icon={Users}     color="gray"   />
        <StatCard label="Present today"    value={summary?.presentTotal ?? 0}     icon={UserCheck} color="green"  sub="In office" />
        <StatCard label="Remote today"     value={summary?.remoteTotal ?? 0}      icon={Monitor}   color="purple" />
        <StatCard label="On leave"         value={summary?.leaveTotal ?? 0}       icon={Plane}     color="orange" />
        <StatCard label="Attendance %"     value={`${summary?.attendancePct ?? 0}%`} icon={TrendingUp} color="blue" sub="vs total active" />
      </div>

      {/* Location split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Office card */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
            Office attendance
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Present',  val: summary?.officePresent ?? 0, cls: 'text-green-600' },
              { label: 'Remote',   val: summary?.officeRemote ?? 0,  cls: 'text-purple-600' },
              { label: 'Absent',   val: summary?.officeAbsent ?? 0,  cls: 'text-red-600' },
              { label: 'Leave',    val: summary?.officeLeave ?? 0,   cls: 'text-orange-600' },
            ].map(({ label, val, cls }) => (
              <div key={label} className="text-center p-3 bg-gray-50 rounded-xl">
                <p className={`text-2xl font-bold ${cls}`}>{val}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CMK card */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-brand-500 rounded-full" />
            CMK attendance
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Present', val: summary?.cmkPresent ?? 0, cls: 'text-green-600' },
              { label: 'Absent',  val: summary?.cmkAbsent ?? 0,  cls: 'text-red-600' },
              { label: 'Leave',   val: summary?.cmkLeave ?? 0,   cls: 'text-orange-600' },
            ].map(({ label, val, cls }) => (
              <div key={label} className="text-center p-3 bg-gray-50 rounded-xl">
                <p className={`text-2xl font-bold ${cls}`}>{val}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 7-day trend bar chart */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">7-day attendance trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend} barSize={14} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
              <Bar dataKey="present" name="Present" fill="#16a34a" radius={[4,4,0,0]} />
              <Bar dataKey="absent"  name="Absent"  fill="#fca5a5" radius={[4,4,0,0]} />
              <Bar dataKey="leave"   name="Leave"   fill="#fed7aa" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
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

      {/* Pending leaves table (admin only) */}
      {(role === 'admin' || role === 'super_admin') && pendingLeaves.length > 0 && (
        <div className="card">
          <div className="table-header">
            <div>
              <h3 className="font-semibold text-gray-900">Pending leave approvals</h3>
              <p className="text-xs text-gray-500 mt-0.5">{pendingLeaves.length} request{pendingLeaves.length > 1 ? 's' : ''} awaiting your review</p>
            </div>
            <a href="/leave" className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all →</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Days</th>
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
      )}

      {/* Empty state for pending leaves */}
      {(role === 'admin' || role === 'super_admin') && pendingLeaves.length === 0 && (
        <div className="card p-8 text-center">
          <CheckSquare size={32} className="mx-auto text-green-400 mb-2" />
          <p className="font-medium text-gray-700">All caught up!</p>
          <p className="text-sm text-gray-500 mt-1">No pending leave approvals right now.</p>
        </div>
      )}
    </div>
  )
}
