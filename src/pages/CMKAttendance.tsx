import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Search, Save, CheckSquare, ChevronLeft, ChevronRight, ChevronDown, Users, AlertCircle, Clock } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { Spinner } from '../Spinner'
import { formatDate, logAudit } from '../helpers'

type AttStatus = 'present' | 'absent' | 'leave'

interface CMKEmployee {
  id: string
  employee_code: string
  name: string
  department: string
  status: AttStatus | null
  saved: boolean
  editing: boolean
  overtime: boolean
  recordedAt: string | null  // created_at for 24h edit window
}

export default function CMKAttendancePage() {
  const { user, profile, role } = useAuth()
  const [employees, setEmployees]     = useState<CMKEmployee[]>([])
  const [filtered, setFiltered]       = useState<CMKEmployee[]>([])
  const [search, setSearch]           = useState('')
  const [deptFilter, setDeptFilter]   = useState('all')
  const [departments, setDepartments] = useState<string[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [savedCount, setSavedCount]   = useState(0)
  const [error, setError]             = useState<string | null>(null)

  const todayStr    = format(new Date(), 'yyyy-MM-dd')
  const yesterdayStr = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')
  const [selectedDate, setSelectedDate] = useState(todayStr)

  const loadEmployees = async (dateStr?: string) => {
    const date = dateStr ?? selectedDate
    setLoading(true)
    const { data: emps } = await supabase
      .from('employees')
      .select('id, employee_code, name, email, departments(name)')
      .eq('location', 'cmk')
      .eq('status', 'active')
      .order('name')

    // Check existing records for the selected date
    const { data: existing } = await supabase
      .from('attendance')
      .select('employee_id, status, overtime_minutes, created_at')
      .eq('date', date)
      .in('location', ['cmk'])

    const existingMap = new Map((existing ?? []).map((r: any) => [r.employee_id, r]))

    // Exclude the logged-in coordinator from the list (they self check-in)
    const empList = (emps ?? []).filter((e: any) => e.email !== profile?.email)

    const list: CMKEmployee[] = empList.map((e: any) => ({
      id: e.id,
      employee_code: e.employee_code,
      name: e.name,
      department: e.departments?.name ?? 'General',
      status: (existingMap.get(e.id)?.status as AttStatus) ?? null,
      saved: existingMap.has(e.id),
      editing: false,
      overtime: (existingMap.get(e.id)?.overtime_minutes ?? 0) > 0,
      recordedAt: existingMap.get(e.id)?.created_at ?? null,
    }))

    setEmployees(list)
    setFiltered(list)
    setDepartments([...new Set(list.map(e => e.department))])
    setLoading(false)
  }

  useEffect(() => { loadEmployees(selectedDate) }, [selectedDate])

  useEffect(() => {
    let f = employees
    if (search) f = f.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.employee_code.toLowerCase().includes(search.toLowerCase()))
    if (deptFilter !== 'all') f = f.filter(e => e.department === deptFilter)
    setFiltered(f)
  }, [search, deptFilter, employees])

  const setStatus = (id: string, status: AttStatus) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, status } : e))
  }

  const toggleEdit = (id: string) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, editing: !e.editing } : e))
  }

  const markAllPresent = () => {
    setEmployees(prev => prev.map(e => filtered.find(f => f.id === e.id) ? { ...e, status: 'present' } : e))
  }


  const toggleOvertime = (id: string) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, overtime: !e.overtime } : e))
  }

  const saveAttendance = async () => {
    if (!user || !profile) return
    const unmarked = filtered.filter(e => !e.status && !e.saved)
    if (unmarked.length > 0) {
      setError(`Please mark attendance for all employees before saving. ${unmarked.length} unmarked.`)
      return
    }
    setError(null)
    setSaving(true)

    const toSave = filtered.filter(e => e.status && (!e.saved || e.editing))
    if (toSave.length === 0) { setSaving(false); return }

    // Use IST time (UTC+5:30) for check_in_time
    const istNow = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000))
    const nowIST = istNow.toISOString().slice(11, 19)
    const records = toSave.map(e => ({
      employee_id: e.id,
      date: selectedDate,
      check_in_time: nowIST,
      location: 'cmk' as const,
      work_mode: null,
      status: e.status!,
      source: 'coordinator_marked' as const,
      marked_by: user.id,
      overtime_minutes: e.overtime ? 60 : 0,
    }))

    const { error: upsertError } = await supabase
      .from('attendance')
      .upsert(records, { onConflict: 'employee_id,date' })

    if (upsertError) {
      setError('Failed to save attendance. Please try again.')
    } else {
      setSavedCount(toSave.length)
      await logAudit({
        userId: user.id,
        userName: profile.full_name,
        userRole: role!,
        action: `Saved/updated CMK attendance for ${toSave.length} employees`,
      })
      await loadEmployees()
    }
    setSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  const unsaved = filtered.filter(e => e.status && (!e.saved || e.editing)).length
  const total   = filtered.length
  const marked  = filtered.filter(e => e.status !== null).length

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="page-header flex-wrap gap-2">
        <div>
          <h1 className="page-title">CMK Daily Attendance</h1>
          <p className="page-subtitle">{formatDate(selectedDate)} · {employees.filter(e => e.saved).length} of {employees.length} saved</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date navigation — today and yesterday only */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setSelectedDate(yesterdayStr)}
              disabled={selectedDate === yesterdayStr}
              className="px-3 py-2 hover:bg-gray-50 disabled:opacity-30 transition-colors"
              title="Yesterday"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="px-3 text-sm font-semibold text-gray-700">
              {selectedDate === todayStr ? 'Today' : 'Yesterday'}
            </span>
            <button
              onClick={() => setSelectedDate(todayStr)}
              disabled={selectedDate === todayStr}
              className="px-3 py-2 hover:bg-gray-50 disabled:opacity-30 transition-colors"
              title="Today"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <button onClick={markAllPresent} className="btn-secondary">
            <CheckSquare size={15} />
            Mark all present
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employee name or ID..."
            className="input pl-9"
          />
        </div>
        <div className="relative">
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="input pr-8 appearance-none min-w-[160px]"
          >
            <option value="all">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600">Attendance progress</span>
          <span className="font-medium text-gray-900">{marked}/{total} marked</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-300"
            style={{ width: total ? `${(marked / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Attendance table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Department</th>
                <th className="text-center">Present</th>
                <th className="text-center">Absent</th>
                <th className="text-center">Leave</th>
                <th>Status</th>
                <th className="text-center">Overtime</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">
                  <Users size={24} className="mx-auto mb-2" />
                  No CMK employees found.
                </td></tr>
              ) : (
                filtered.map(emp => (
                  <tr key={emp.id} className={emp.saved && !emp.editing ? 'opacity-60' : ''}>
                    <td className="font-mono text-xs text-gray-500">{emp.employee_code}</td>
                    <td className="font-medium text-gray-900">{emp.name}</td>
                    <td className="text-gray-500">{emp.department}</td>
                    {(['present', 'absent', 'leave'] as AttStatus[]).map(s => (
                      <td key={s} className="text-center">
                        <button
                          onClick={() => (!emp.saved || emp.editing) && setStatus(emp.id, s)}
                          disabled={emp.saved && !emp.editing}
                          className={`w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center transition-colors ${
                            emp.status === s
                              ? s === 'present' ? 'bg-green-500 border-green-500'
                                : s === 'absent' ? 'bg-red-500 border-red-500'
                                : 'bg-orange-500 border-orange-500'
                              : 'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          {emp.status === s && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </button>
                      </td>
                    ))}
                    <td>
                      <div className="flex items-center gap-2">
                        {emp.saved && !emp.editing ? (
                          emp.status === 'present' ? <span className="badge-present">Present</span>
                          : emp.status === 'absent' ? <span className="badge-absent">Absent</span>
                          : <span className="badge-leave">Leave</span>
                        ) : (
                          !emp.status ? <span className="text-xs text-gray-400">Not marked</span>
                          : <span className="text-xs text-gray-500 italic">Unsaved</span>
                        )}
                        {emp.saved && (() => {
                          const within24h = emp.recordedAt
                            ? Date.now() - new Date(emp.recordedAt).getTime() < 24 * 3600 * 1000
                            : false
                          return within24h ? (
                            <button
                              type="button"
                              onClick={() => toggleEdit(emp.id)}
                              className="text-xs font-medium text-brand-600 hover:text-brand-700 underline"
                            >
                              {emp.editing ? 'Cancel' : 'Edit'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-300 flex items-center gap-0.5" title="Edit window expired (24h)">
                              <Clock size={10} /> Locked
                            </span>
                          )
                        })()}
                      </div>
                    </td>
                    <td className="text-center">
                      {emp.status === 'present' && (
                        <button
                          onClick={() => (!emp.saved || emp.editing) && toggleOvertime(emp.id)}
                          disabled={emp.saved && !emp.editing}
                          className={`w-8 h-5 rounded-full transition-colors ${
                            emp.overtime ? 'bg-amber-500' : 'bg-gray-200'
                          } ${emp.saved && !emp.editing ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
                          title={emp.overtime ? 'Overtime: Yes' : 'Overtime: No'}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${emp.overtime ? 'translate-x-3' : 'translate-x-0'}`} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Success */}
      {savedCount > 0 && (
        <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700">
          ✓ Attendance saved for {savedCount} employees.
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={saveAttendance}
          disabled={saving || unsaved === 0}
          className="btn-primary px-8 py-3 rounded-xl disabled:opacity-50"
        >
          {saving ? <Spinner size="sm" /> : <Save size={16} />}
          {saving ? 'Saving...' : `Save attendance${unsaved > 0 ? ` (${unsaved})` : ''}`}
        </button>
      </div>
    </div>
  )
}
