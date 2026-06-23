import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Plus, Search, Edit2, UserX, UserCheck, KeyRound,
  ChevronDown, Eye, EyeOff, Copy, CheckCheck,
  BookOpen, Calendar, X, BarChart2, Clock, TrendingUp, Upload, Download, AlertTriangle, CheckCircle2
} from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import * as XLSX from 'xlsx'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { Modal } from '../Modal'
import { Spinner } from '../Spinner'
import { formatDate, logAudit } from '../helpers'
import type { Employee, Department, Location, EmployeeStatus } from '../database'

// generate a strong temp password
const genPassword = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

interface AttendanceRow {
  id: string; date: string; status: string; work_mode: string
  check_in_time: string | null; check_out_time: string | null; worked_minutes: number | null
}
interface LeaveRow {
  id: string; start_date: string; end_date: string; total_days: number | null
  reason: string; status: string; leave_type?: string
}
interface EmpSummary {
  casualTotal: number; casualUsed: number; casualRemaining: number
  presentDays: number; remoteDays: number; absentDays: number; leaveDays: number
  totalWorkedMins: number; totalOvertimeMins: number
  year: number
}

export default function EmployeesPage() {
  const { user, profile, role } = useAuth()
  const [adminDeptId, setAdminDeptId] = useState<string | null>(null)
  const [params] = useSearchParams()

  const [employees, setEmployees]     = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [managers, setManagers] = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState(params.get('q') ?? '')
  const [locFilter, setLocFilter]     = useState<'all' | Location>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | EmployeeStatus>('all')
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState<Employee | null>(null)
  const [pwEmp, setPwEmp]             = useState<Employee | null>(null)
  const [newPw, setNewPw]             = useState('')
  const [pwBusy, setPwBusy]           = useState(false)
  const [pwMsg, setPwMsg]             = useState<{ok:boolean;text:string}|null>(null)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [successMsg, setSuccessMsg]   = useState<string | null>(null)
  const [showPw, setShowPw]           = useState(false)
  const [copied, setCopied]           = useState(false)


  // CSV import
  const [csvModal, setCsvModal]       = useState(false)
  const [csvRows, setCsvRows]         = useState<any[]>([])
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvResults, setCsvResults]   = useState<{ name: string; ok: boolean; msg: string }[]>([])
  const [csvDone, setCsvDone]         = useState(false)

  // history modal
  const [histEmp, setHistEmp]                 = useState<Employee | null>(null)
  const [histTab, setHistTab]                 = useState<'summary' | 'attendance' | 'leaves'>('summary')
  const [histSummary, setHistSummary]         = useState<EmpSummary | null>(null)
  const [histAttendance, setHistAttendance]   = useState<AttendanceRow[]>([])
  const [histLeaves, setHistLeaves]           = useState<LeaveRow[]>([])
  const [histLoading, setHistLoading]         = useState(false)
  const [histMonth, setHistMonth]             = useState(format(new Date(), 'yyyy-MM'))

  // form state
  const [form, setForm] = useState({
    name: '', mobile: '', email: '', department_id: '',
    designation: '', location: 'office' as Location,
    joining_date: '', role: 'employee', temp_password: genPassword(),
  })
  const [editForm, setEditForm] = useState({
    name: '', mobile: '', department_id: '', designation: '',
    location: 'office' as Location, joining_date: '', status: 'active' as EmployeeStatus, manager_id: '' as string | null,
  })

  useEffect(() => { const q = params.get('q'); if (q) setSearch(q) }, [params])

  const loadData = async () => {
    setLoading(true)
    // For admin role, scope to their assigned department
    let deptId: string | null = null
    if ((role === 'manager') && profile?.email) {
      try {
        const { data: prof } = await supabase.from('profiles').select('department_id').eq('email', profile.email).maybeSingle()
        deptId = prof?.department_id ?? null
        setAdminDeptId(deptId)
      } catch { deptId = null }
    }
    let empQuery = supabase.from('employees').select('*, departments(name, location)').order('name')
    if (role === 'manager' && user?.id) {
      empQuery = empQuery.eq('manager_id', user.id)
    } else if (role === 'cmk_coordinator') {
      empQuery = empQuery.eq('location', 'cmk')
    }
    const [{ data: emps }, { data: depts }, { data: mgrs }] = await Promise.all([
      empQuery,
      supabase.from('departments').select('*').eq('status', 'active').order('name'),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'manager').order('full_name'),
    ])
    setEmployees((emps ?? []) as unknown as Employee[])
    setDepartments((depts ?? []) as Department[])
    setManagers(mgrs ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', mobile: '', email: '', department_id: '', designation: '',
      location: 'office', joining_date: '', role: 'employee', temp_password: genPassword() })
    setError(null); setSuccessMsg(null); setShowPw(false); setCopied(false)
    setModalOpen(true)
  }

  const openEdit = (emp: Employee) => {
    setEditing(emp)
    setEditForm({ name: emp.name, mobile: emp.mobile, department_id: emp.department_id,
      designation: emp.designation, location: emp.location,
      joining_date: emp.joining_date, status: emp.status, manager_id: (emp as any).manager_id ?? '' })
    setError(null); setModalOpen(true)
  }

  const openHistory = async (emp: Employee, month?: string) => {
    const m = month ?? histMonth
    setHistEmp(emp)
    setHistTab('summary')
    setHistSummary(null)
    setHistLoading(true)

    const monthDate = new Date(m + '-01')
    const start = format(startOfMonth(monthDate), 'yyyy-MM-dd')
    const end   = format(endOfMonth(monthDate), 'yyyy-MM-dd')

    const [{ data: att }, { data: lv }] = await Promise.all([
      supabase.from('attendance')
        .select('id, date, status, work_mode, check_in_time, check_out_time, worked_minutes')
        .eq('employee_id', emp.id)
        .gte('date', start).lte('date', end)
        .order('date', { ascending: false }),
      supabase.from('leave_requests')
        .select('id, start_date, end_date, total_days, reason, status, leave_type')
        .eq('employee_id', emp.id)
        .order('created_at', { ascending: false }),
    ])

    setHistAttendance((att ?? []) as AttendanceRow[])
    setHistLeaves((lv ?? []) as LeaveRow[])

    // Fetch full-year stats + leave balance for summary
    const year = new Date().getFullYear()
    const yearStart = `${year}-01-01`
    const yearEnd   = `${year}-12-31`
    const [{ data: yearAtt }, { data: bal }] = await Promise.all([
      supabase.from('attendance').select('status, work_mode, worked_minutes, overtime_minutes')
        .eq('employee_id', emp.id).gte('date', yearStart).lte('date', yearEnd),
      supabase.from('leave_balances').select('casual_total, casual_used')
        .eq('employee_id', emp.id).eq('year', year).maybeSingle(),
    ])
    const ya = yearAtt ?? []
    setHistSummary({
      casualTotal:     bal?.casual_total     ?? 12,
      casualUsed:      bal?.casual_used      ?? 0,
      casualRemaining: (bal?.casual_total ?? 12) - (bal?.casual_used ?? 0),
      presentDays:     ya.filter(r => r.status === 'present' && r.work_mode !== 'remote').length,
      remoteDays:      ya.filter(r => r.work_mode === 'remote').length,
      absentDays:      ya.filter(r => r.status === 'absent').length,
      leaveDays:       ya.filter(r => r.status === 'leave').length,
      totalWorkedMins: ya.reduce((s, r) => s + (r.worked_minutes ?? 0), 0),
      totalOvertimeMins: ya.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0),
      year,
    })
    setHistLoading(false)
  }

  const changeHistMonth = async (m: string) => {
    setHistMonth(m)
    if (histEmp) await openHistory(histEmp, m)
  }


  // ── CSV import ─────────────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const a = document.createElement('a')
    a.href = '/employee_template.xlsx'
    a.download = 'CURRYiT_Employee_Import_Template.xlsx'
    a.click()
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    const reader = new FileReader()

    reader.onload = (ev) => {
      let rows: any[] = []
      if (isXlsx) {
        const data   = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const sheetName = wb.SheetNames.find(n => n === 'Employee Import') ?? wb.SheetNames[0]
        const sheet = wb.Sheets[sheetName]

        // Read as raw 2D array so we can find the real header row ourselves
        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][]

        // Map display header → field name (handles both template and plain CSV headers)
        const headerMap: Record<string, string> = {
          'full name *': 'name',   'full name': 'name',   'name': 'name',
          'email *':     'email',  'email': 'email',
          'mobile':      'mobile',
          'designation': 'designation',
          'department':  'department_name', 'department_name': 'department_name',
          'location *':  'location', 'location': 'location',
          'role *':      'role',   'role': 'role',
          'joining date':'joining_date', 'joining_date': 'joining_date',
          'password':    'password',
        }

        // Find the header row — the one that contains "name" or "full name *"
        let headerRowIdx = -1
        for (let i = 0; i < Math.min(raw.length, 10); i++) {
          const cells = raw[i].map(c => String(c).toLowerCase().trim())
          if (cells.some(c => c === 'name' || c === 'full name *' || c === 'email *' || c === 'email')) {
            headerRowIdx = i; break
          }
        }
        if (headerRowIdx === -1) { setCsvRows([]); return }

        const colMap: Record<number, string> = {}
        raw[headerRowIdx].forEach((cell, i) => {
          const key = String(cell).toLowerCase().trim()
          if (headerMap[key]) colMap[i] = headerMap[key]
        })

        rows = raw.slice(headerRowIdx + 1)
          .filter(r => r.some(c => c !== ''))
          .map(r => {
            const obj: any = {}
            Object.entries(colMap).forEach(([i, field]) => {
              const val = r[Number(i)]
              if (val instanceof Date) {
                // Convert Excel Date → YYYY-MM-DD
                const y = val.getFullYear()
                const m = String(val.getMonth() + 1).padStart(2, '0')
                const d = String(val.getDate()).padStart(2, '0')
                obj[field] = `${y}-${m}-${d}`
              } else {
                obj[field] = String(val ?? '').trim()
              }
            })
            return obj
          })
          .filter(r => r.name && r.email)
      } else {
        // CSV path
        const text  = ev.target?.result as string
        const lines = text.trim().split('\n').filter(Boolean)
        if (lines.length < 2) return
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
        rows = lines.slice(1).filter(l => !l.trim().startsWith('#')).map(line => {
          const vals = line.split(',').map(v => v.trim())
          const obj: any = {}
          headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
          return obj
        }).filter(r => r.name && r.email)
      }
      setCsvRows(rows); setCsvResults([]); setCsvDone(false)
    }

    if (isXlsx) reader.readAsArrayBuffer(file)
    else reader.readAsText(file)
    e.target.value = ''
  }

  const importCSV = async () => {
    if (!user) return
    setCsvImporting(true); setCsvResults([]); setCsvDone(false)
    const { data: { session } } = await supabase.auth.getSession()
    const results: { name: string; ok: boolean; msg: string }[] = []

    for (const row of csvRows) {
      // Find department_id by name
      const dept = departments.find(d => d.name.toLowerCase() === (row.department_name ?? '').toLowerCase().trim())

      // Normalise location — accept "office"/"cmk" case-insensitively
      const rawLoc = (row.location ?? '').toLowerCase().trim()
      const location = rawLoc === 'cmk' ? 'cmk' : 'office'

      // Normalise role
      const validRoles = ['employee','manager','super_admin','cmk_coordinator']
      const rawRole = (row.role ?? '').toLowerCase().trim()
      const empRole = validRoles.includes(rawRole) ? rawRole : 'employee'

      // Default empty joining_date to today
      const joining_date = row.joining_date?.trim() || format(new Date(), 'yyyy-MM-dd')

      const payload = {
        name: row.name,
        email: row.email,
        mobile: row.mobile ?? '',
        designation: row.designation ?? '',
        department_id: dept?.id ?? undefined,
        location,
        role: empRole,
        joining_date,
        temp_password: row.password || genPassword(),
      }
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify(payload) }
        )
        const json = await res.json().catch(() => ({}))
        if (res.ok) {
          results.push({ name: row.name, ok: true, msg: 'Added successfully' })
          await logAudit({ userId: user.id, userName: profile!.full_name, userRole: role!, action: `Bulk import: ${row.name}` })
        } else {
          results.push({ name: row.name, ok: false, msg: json.error ?? `Error ${res.status}` })
        }
      } catch (err: any) {
        results.push({ name: row.name, ok: false, msg: err?.message ?? 'Network error' })
      }
      setCsvResults([...results])
    }
    setCsvImporting(false); setCsvDone(true)
    await loadData()
  }

  // ── Add: calls Edge Function — creates auth user + employee + profile in one shot
  const addEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true); setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(form),
        }
      )
      const text = await res.text()
      let json: any = {}
      try { json = JSON.parse(text) } catch { json = { error: text || 'Empty response from server' } }

      if (!res.ok) {
        setError(json.error ?? `Failed to create employee (status ${res.status}).`)
      } else {
        setSuccessMsg(json.message)
        await logAudit({ userId: user.id, userName: profile!.full_name, userRole: role!, action: `Created employee: ${form.name}` })
        await loadData()
      }
    } catch (err: any) {
      setError(err?.message ?? 'Network error while creating employee.')
    } finally {
      setSaving(false)
    }
  }

  // ── Super admin: reset employee password ─────────────────────────────────
  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pwEmp || !user) return
    setPwBusy(true); setPwMsg(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'reset_password', email: pwEmp.email, new_password: newPw }),
      }
    )
    const json = await res.json().catch(() => ({}))
    if (res.ok || json.updated) {
      setPwMsg({ ok: true, text: 'Password updated successfully!' })
      await logAudit({ userId: user.id, userName: profile!.full_name, userRole: role!, action: `Reset password for: ${pwEmp.name}` })
      setTimeout(() => { setPwEmp(null); setNewPw(''); setPwMsg(null) }, 1500)
    } else {
      setPwMsg({ ok: false, text: json.error ?? 'Failed to update password.' })
    }
    setPwBusy(false)
  }

  // ── Edit: only updates employee fields, does NOT touch auth
  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing || !user || !profile) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('employees').update(editForm).eq('id', editing.id)
    if (updateError) { setError('Failed to update employee.'); setSaving(false); return }
    await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `Updated employee: ${editForm.name}`, affectedEmployeeId: editing.id })
    setModalOpen(false)
    await loadData()
    setSaving(false)
  }

  const toggleStatus = async (emp: Employee) => {
    if (!user || !profile) return
    const newStatus: EmployeeStatus = emp.status === 'active' ? 'inactive' : 'active'
    await supabase.from('employees').update({ status: newStatus }).eq('id', emp.id)
    await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `Set ${emp.name} to ${newStatus}`, affectedEmployeeId: emp.id })
    await loadData()
  }



  const copyPassword = () => {
    navigator.clipboard.writeText(form.temp_password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_code.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase())
    const matchLoc    = locFilter === 'all' || e.location === locFilter
    const matchStatus = statusFilter === 'all' || e.status === statusFilter
    return matchSearch && matchLoc && matchStatus
  })

  const statusBadge = (s: string) =>
    s === 'approved' ? <span className="badge-approved">Approved</span>
    : s === 'rejected' ? <span className="badge-rejected">Rejected</span>
    : <span className="badge-pending">Pending</span>

  const fmtTime = (t: string | null) => t ? t.slice(0, 5) : '—'
  const fmtMins = (m: number | null) => {
    if (!m) return '—'
    const h = Math.floor(m / 60); const min = m % 60
    return `${h}h ${min}m`
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="page-header flex-wrap gap-2">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">{employees.filter(e => e.status === 'active').length} active employees</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setCsvModal(true); setCsvRows([]); setCsvResults([]); setCsvDone(false) }} className="btn-secondary">
            <Upload size={15} /> Import
          </button>
          <button onClick={openAdd} className="btn-primary">
            <Plus size={16} /> Add employee
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, ID or email..." className="input pl-10" />
        </div>
        <div className="relative">
          <select value={locFilter} onChange={e => setLocFilter(e.target.value as any)}
            className="input pr-8 appearance-none min-w-[130px]">
            <option value="all">All locations</option>
            <option value="office">Office</option>
            <option value="cmk">CMK</option>
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            className="input pr-8 appearance-none min-w-[120px]">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px]">
            <thead>
              <tr>
                <th>Emp ID</th><th>Name</th><th>Department</th>
                <th>Designation</th><th>Location</th><th>Joined</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No employees found.</td></tr>
              ) : filtered.map(emp => (
                <tr key={emp.id} className={emp.status === 'inactive' ? 'opacity-50' : ''}>
                  <td className="font-mono text-xs text-gray-400 font-bold">{emp.employee_code}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,#E8531D,#C44010)' }}>
                        {emp.name[0].toUpperCase()}
                      </div>
                      <div>
                        <Link to={`/employees/${emp.id}`} className="font-semibold text-blue-700 hover:text-blue-900 hover:underline text-sm transition-colors">{emp.name}</Link>
                        <p className="text-xs text-gray-400">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-gray-500">{(emp as any).departments?.name ?? '—'}</td>
                  <td className="text-gray-500">{emp.designation}</td>
                  <td>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${emp.location === 'office' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      {emp.location === 'office' ? 'Office' : 'CMK'}
                    </span>
                  </td>
                  <td className="text-gray-400 text-sm">{formatDate(emp.joining_date)}</td>
                  <td>
                    <span className={emp.status === 'active' ? 'badge-approved' : 'badge-rejected'}>
                      {emp.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1.5">
                      <button onClick={() => openHistory(emp)} className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors" title="View history">
                        <BookOpen size={13} />
                      </button>
                      <button onClick={() => openEdit(emp)} className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors" title="Edit">
                        <Edit2 size={13} />
                      </button>
                      {role === 'super_admin' && (
                        <button onClick={() => { setPwEmp(emp); setNewPw(''); setPwMsg(null) }} className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors" title="Reset password">
                          <KeyRound size={13} />
                        </button>
                      )}
                      <button onClick={() => toggleStatus(emp)}
                        className={`p-1.5 rounded-lg transition-colors ${emp.status === 'active' ? 'bg-red-50 hover:bg-red-100 text-red-500' : 'bg-green-50 hover:bg-green-100 text-green-600'}`}
                        title={emp.status === 'active' ? 'Deactivate' : 'Activate'}>
                        {emp.status === 'active' ? <UserX size={13} /> : <UserCheck size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── HISTORY Modal ── */}
      {histEmp && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", background: "rgba(15,23,42,0.25)" }}>
          <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">{histEmp.name}</h3>
                <p className="text-xs text-gray-400">{histEmp.email} · {histEmp.employee_code}</p>
              </div>
              <button onClick={() => setHistEmp(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={18} />
              </button>
            </div>

            {/* Tabs + month picker */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100">
              <button onClick={() => setHistTab('summary')}
                className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${histTab === 'summary' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                Summary
              </button>
              <button onClick={() => setHistTab('attendance')}
                className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${histTab === 'attendance' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                Attendance
              </button>
              <button onClick={() => setHistTab('leaves')}
                className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${histTab === 'leaves' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                Leaves
              </button>
              <div className="flex-1" />
              {histTab === 'attendance' && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <input type="month" value={histMonth}
                    onChange={e => changeHistMonth(e.target.value)}
                    className="input py-1 text-sm" style={{ minWidth: 0, width: 'auto' }} />
                </div>
              )}
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {histLoading ? (
                <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
              ) : histTab === 'summary' ? (
                <div className="space-y-5 p-2">
                  {/* Leave balance */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Leave Balance — {histSummary?.year}</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Total',     val: histSummary?.casualTotal,     cls: 'text-gray-700',   bg: 'bg-gray-50'   },
                        { label: 'Used',      val: histSummary?.casualUsed,      cls: 'text-red-600',    bg: 'bg-red-50'    },
                        { label: 'Remaining', val: histSummary?.casualRemaining, cls: 'text-green-600',  bg: 'bg-green-50'  },
                      ].map(({ label, val, cls, bg }) => (
                        <div key={label} className={`${bg} rounded-xl p-4 text-center`}>
                          <p className={`text-3xl font-black ${cls}`}>{val ?? '—'}</p>
                          <p className="text-xs text-gray-500 mt-1">{label} leaves</p>
                        </div>
                      ))}
                    </div>
                    {histSummary && (
                      <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full transition-all"
                          style={{ width: `${histSummary.casualTotal ? Math.min(100, (histSummary.casualUsed / histSummary.casualTotal) * 100) : 0}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Attendance stats */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Attendance — {histSummary?.year}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Days in office',  val: histSummary?.presentDays, cls: 'text-green-600',  bg: 'bg-green-50'  },
                        { label: 'Days remote',     val: histSummary?.remoteDays,  cls: 'text-purple-600', bg: 'bg-purple-50' },
                        { label: 'Days absent',     val: histSummary?.absentDays,  cls: 'text-red-600',    bg: 'bg-red-50'    },
                        { label: 'Days on leave',   val: histSummary?.leaveDays,   cls: 'text-orange-600', bg: 'bg-orange-50' },
                      ].map(({ label, val, cls, bg }) => (
                        <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
                          <p className={`text-2xl font-black ${cls}`}>{val ?? 0}</p>
                          <p className="text-xs text-gray-500 leading-tight">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hours */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Working Hours — {histSummary?.year}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Total hours worked', val: histSummary ? `${Math.floor(histSummary.totalWorkedMins / 60)}h ${histSummary.totalWorkedMins % 60}m` : '—', cls: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: 'Total overtime',     val: histSummary ? `${Math.floor(histSummary.totalOvertimeMins / 60)}h ${histSummary.totalOvertimeMins % 60}m` : '—', cls: 'text-amber-600', bg: 'bg-amber-50' },
                      ].map(({ label, val, cls, bg }) => (
                        <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
                          <p className={`text-lg font-black ${cls}`}>{val}</p>
                          <p className="text-xs text-gray-500 leading-tight">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : histTab === 'attendance' ? (
                histAttendance.length === 0 ? (
                  <p className="text-center text-gray-400 py-12 text-sm">No attendance records for this month.</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-xs font-bold text-gray-400 uppercase pb-2 pr-4">Date</th>
                        <th className="text-left text-xs font-bold text-gray-400 uppercase pb-2 pr-4">Status</th>
                        <th className="text-left text-xs font-bold text-gray-400 uppercase pb-2 pr-4">Mode</th>
                        <th className="text-left text-xs font-bold text-gray-400 uppercase pb-2 pr-4">Check In</th>
                        <th className="text-left text-xs font-bold text-gray-400 uppercase pb-2 pr-4">Check Out</th>
                        <th className="text-left text-xs font-bold text-gray-400 uppercase pb-2">Worked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histAttendance.map(r => (
                        <tr key={r.id} className="border-t border-gray-50">
                          <td className="py-2 pr-4 text-sm font-medium text-gray-700">{formatDate(r.date)}</td>
                          <td className="py-2 pr-4">
                            {r.status === 'present' ? <span className="badge-approved">Present</span>
                             : r.status === 'absent' ? <span className="badge-rejected">Absent</span>
                             : r.status === 'leave'  ? <span className="badge-pending">Leave</span>
                             : <span className="text-xs text-gray-400">{r.status}</span>}
                          </td>
                          <td className="py-2 pr-4">
                            {r.work_mode === 'remote'
                              ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">Remote</span>
                              : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Office</span>}
                          </td>
                          <td className="py-2 pr-4 text-sm text-gray-500 font-mono">{fmtTime(r.check_in_time)}</td>
                          <td className="py-2 pr-4 text-sm text-gray-500 font-mono">{fmtTime(r.check_out_time)}</td>
                          <td className="py-2 text-sm text-gray-500">{fmtMins(r.worked_minutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                histLeaves.length === 0 ? (
                  <p className="text-center text-gray-400 py-12 text-sm">No leave requests found.</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-xs font-bold text-gray-400 uppercase pb-2 pr-4">From</th>
                        <th className="text-left text-xs font-bold text-gray-400 uppercase pb-2 pr-4">To</th>
                        <th className="text-left text-xs font-bold text-gray-400 uppercase pb-2 pr-4">Days</th>
                        <th className="text-left text-xs font-bold text-gray-400 uppercase pb-2 pr-4">Reason</th>
                        <th className="text-left text-xs font-bold text-gray-400 uppercase pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histLeaves.map(r => (
                        <tr key={r.id} className="border-t border-gray-50">
                          <td className="py-2 pr-4 text-sm text-gray-700">{formatDate(r.start_date)}</td>
                          <td className="py-2 pr-4 text-sm text-gray-700">{formatDate(r.end_date)}</td>
                          <td className="py-2 pr-4 text-sm text-gray-500">{r.total_days ?? '—'}d</td>
                          <td className="py-2 pr-4 text-sm text-gray-400 max-w-[200px] truncate">{r.reason}</td>
                          <td className="py-2">{statusBadge(r.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <button onClick={() => setHistEmp(null)} className="btn-secondary w-full justify-center">Close</button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ── ADD Employee Modal ── */}
      <Modal isOpen={modalOpen && !editing} onClose={() => { setModalOpen(false); setSuccessMsg(null) }}
        title="Add new employee" size="xl">

        {successMsg ? (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl text-center" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="text-3xl mb-1.5">✅</div>
              <p className="font-black text-gray-900 text-lg mb-1">Employee created!</p>
              <p className="text-sm text-gray-500">{successMsg}</p>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex gap-6">
              <p className="text-sm text-gray-700"><span className="font-semibold">Email:</span> {form.email}</p>
              <p className="text-sm text-gray-700"><span className="font-semibold">Password:</span> {form.temp_password}</p>
            </div>
            <button onClick={() => { setModalOpen(false); setSuccessMsg(null) }} className="btn-primary w-full justify-center">Done</button>
          </div>
        ) : (
          <form onSubmit={addEmployee} className="space-y-3">
            {/* Row 1: Name, Mobile, Email, Designation */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="label">Full name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" required placeholder="Ravi Kumar" />
              </div>
              <div>
                <label className="label">Mobile</label>
                <input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} className="input" placeholder="9876543210" maxLength={10} />
              </div>
              <div>
                <label className="label">Email (login)</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" required placeholder="ravi@curryit.in" />
              </div>
              <div>
                <label className="label">Designation</label>
                <input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} className="input" required placeholder="Operations Executive" />
              </div>
            </div>
            {/* Row 2: Department, Location, Joining Date, Role */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="label">Department</label>
                <div className="relative">
                  <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })} className="input pr-8 appearance-none">
                    <option value="">Select dept</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="label">Location</label>
                <div className="relative">
                  <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value as Location })} className="input pr-8 appearance-none">
                    <option value="office">Office</option>
                    <option value="cmk">CMK</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="label">Joining date</label>
                <input type="date" value={form.joining_date} onChange={e => setForm({ ...form, joining_date: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="label">Role</label>
                <div className="relative">
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input pr-8 appearance-none">
                    <option value="employee">Employee</option>
                    <option value="cmk_coordinator">CMK Coordinator</option>
                    <option value="manager">Manager</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
            {/* Row 3: Temp password */}
            <div>
              <label className="label">Temporary password — share with employee</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input type={showPw ? 'text' : 'password'} value={form.temp_password}
                    onChange={e => setForm({ ...form, temp_password: e.target.value })}
                    className="input pr-10 font-mono" required />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <button type="button" onClick={copyPassword} className="btn-secondary px-4 flex-shrink-0">
                  {copied ? <CheckCheck size={15} className="text-green-500" /> : <Copy size={15} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Employee logs in with their email + this password. They can change it later.</p>
            </div>

            {error && (
              <div className="px-4 py-2.5 rounded-xl text-sm text-red-600" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-0.5">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                {saving && <Spinner size="sm" />}
                {saving ? 'Creating...' : 'Create employee & login'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── EDIT Modal ── */}
      <Modal isOpen={modalOpen && !!editing} onClose={() => setModalOpen(false)} title={`Edit — ${editing?.name}`} size="xl">
        <form onSubmit={saveEdit} className="space-y-3">
          {/* Row 1: Name, Mobile, Designation, Joining date */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="label">Full name</label>
              <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="label">Mobile</label>
              <input value={editForm.mobile} onChange={e => setEditForm({ ...editForm, mobile: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Designation</label>
              <input value={editForm.designation} onChange={e => setEditForm({ ...editForm, designation: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="label">Joining date</label>
              <input type="date" value={editForm.joining_date} onChange={e => setEditForm({ ...editForm, joining_date: e.target.value })} className="input" required />
            </div>
          </div>
          {/* Row 2: Department, Location, Status + optional Manager */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="label">Department</label>
              <div className="relative">
                <select value={editForm.department_id} onChange={e => setEditForm({ ...editForm, department_id: e.target.value })} className="input pr-8 appearance-none">
                  <option value="">Select dept</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="label">Location</label>
              <div className="relative">
                <select value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value as Location })} className="input pr-8 appearance-none">
                  <option value="office">Office</option>
                  <option value="cmk">CMK</option>
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <div className="relative">
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value as EmployeeStatus })} className="input pr-8 appearance-none">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            {role === 'super_admin' && (
              <div>
                <label className="label">Assign to Manager</label>
                <div className="relative">
                  <select value={editForm.manager_id ?? ''} onChange={e => setEditForm({ ...editForm, manager_id: e.target.value || null })} className="input pr-8 appearance-none">
                    <option value="">No manager</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>}
          <div className="flex gap-3 pt-0.5">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving && <Spinner size="sm" />} {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── RESET PASSWORD MODAL (super_admin) ── */}
      {pwEmp && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", background: "rgba(15,23,42,0.25)" }}>
          <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">Reset password</h3>
                <p className="text-xs text-gray-400 mt-0.5">{pwEmp.name}</p>
              </div>
              <button onClick={() => setPwEmp(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <form onSubmit={resetPassword} className="p-6 space-y-4">
              {pwMsg ? (
                <div className={`px-4 py-3 rounded-xl text-sm font-medium ${pwMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {pwMsg.ok ? '✅ ' : '⚠️ '}{pwMsg.text}
                </div>
              ) : null}
              <div>
                <label className="label">New password</label>
                <input type="text" value={newPw} onChange={e => setNewPw(e.target.value)}
                  className="input font-mono" required minLength={6} placeholder="Min 6 characters" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setPwEmp(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={pwBusy} className="btn-primary flex-1 justify-center">
                  {pwBusy ? <Spinner size="sm" /> : <KeyRound size={14} />}
                  {pwBusy ? 'Saving...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>
      )}

      {/* ── CSV IMPORT MODAL ── */}
      {csvModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">Import employees</h2>
                <p className="text-xs text-gray-400 mt-0.5">Upload the Excel template or a CSV file</p>
              </div>
              <button onClick={() => setCsvModal(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><X size={16} /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {/* Step 1: Download template */}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-blue-800">Step 1 — Download Excel template</p>
                  <p className="text-xs text-blue-500 mt-0.5">Fill in the sheet and upload it back</p>
                </div>
                <button onClick={downloadTemplate} className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-white border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-50">
                  <Download size={13} /> Template
                </button>
              </div>

              {/* Step 2: Upload */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Step 2 — Upload filled file</p>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors">
                  <Upload size={22} className="text-gray-300 mb-2" />
                  <span className="text-sm text-gray-400">Click to choose Excel or CSV file</span>
                  <span className="text-xs text-gray-300 mt-1">.xlsx · .xls · .csv</span>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
                </label>
              </div>

              {/* Preview */}
              {csvRows.length > 0 && !csvDone && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">{csvRows.length} employee(s) ready to import</p>
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Name</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Email</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Role</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Location</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Department</th>
                      </tr></thead>
                      <tbody>
                        {csvRows.map((r, i) => (
                          <tr key={i} className="border-t border-gray-50">
                            <td className="px-3 py-2 font-medium">{r.name}</td>
                            <td className="px-3 py-2 text-gray-400">{r.email}</td>
                            <td className="px-3 py-2">{r.role}</td>
                            <td className="px-3 py-2">{r.location}</td>
                            <td className="px-3 py-2">{r.department_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Progress / results */}
              {csvResults.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Import results</p>
                  {csvResults.map((r, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${r.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                      {r.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                      <span className="font-semibold">{r.name}</span>
                      <span className="ml-auto">{r.msg}</span>
                    </div>
                  ))}
                  {csvImporting && <div className="flex items-center gap-2 text-xs text-gray-400"><Spinner size="sm" /> Importing...</div>}
                </div>
              )}

              {csvDone && (
                <div className="p-3 bg-green-50 rounded-xl text-sm text-green-700 font-medium text-center">
                  ✓ Import complete — {csvResults.filter(r => r.ok).length} of {csvResults.length} added successfully
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setCsvModal(false)} className="btn-secondary flex-1 justify-center">
                {csvDone ? 'Close' : 'Cancel'}
              </button>
              {csvRows.length > 0 && !csvDone && (
                <button onClick={importCSV} disabled={csvImporting}
                  className="btn-primary flex-1 justify-center">
                  {csvImporting ? <><Spinner size="sm" /> Importing...</> : `Import ${csvRows.length} employee(s)`}
                </button>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

    </div>
  )
}