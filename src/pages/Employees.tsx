import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import {
  Plus, Search, Edit2, UserX, UserCheck,
  ChevronDown, Wallet, Eye, EyeOff, Copy, CheckCheck
} from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { Modal } from '../Modal'
import { Spinner } from '../Spinner'
import { formatDate, logAudit } from '../helpers'
import type { Employee, Department, Location, EmployeeStatus } from '../database'

// Secondary auth client — creates new logins WITHOUT touching the admin's session
const authClient = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const genPassword = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function EmployeesPage() {
  const { user, profile, role } = useAuth()
  const [params] = useSearchParams()

  const [employees, setEmployees]       = useState<Employee[]>([])
  const [departments, setDepartments]   = useState<Department[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState(params.get('q') ?? '')
  const [locFilter, setLocFilter]       = useState<'all' | Location>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | EmployeeStatus>('all')
  const [modalOpen, setModalOpen]       = useState(false)
  const [editing, setEditing]           = useState<Employee | null>(null)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [created, setCreated]           = useState<{ email: string; password: string } | null>(null)
  const [showPw, setShowPw]             = useState(false)
  const [copied, setCopied]             = useState(false)

  const [balEmp, setBalEmp]   = useState<Employee | null>(null)
  const [bal, setBal]         = useState({ casual_total: 12, sick_total: 12, emergency_total: 6, paid_total: 15 })
  const [balBusy, setBalBusy] = useState(false)

  const emptyForm = {
    name: '', mobile: '', email: '', department_id: '',
    designation: '', location: 'office' as Location,
    joining_date: new Date().toISOString().split('T')[0],
    role: 'employee', temp_password: genPassword(),
  }
  const [form, setForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState({
    name: '', mobile: '', department_id: '', designation: '',
    location: 'office' as Location, joining_date: '', status: 'active' as EmployeeStatus,
  })

  useEffect(() => { const q = params.get('q'); if (q) setSearch(q) }, [params])

  const loadData = async () => {
    setLoading(true)
    const [{ data: emps }, { data: depts }] = await Promise.all([
      supabase.from('employees').select('*, departments(name)').order('name'),
      supabase.from('departments').select('*').eq('status', 'active').order('name'),
    ])
    setEmployees((emps ?? []) as unknown as Employee[])
    setDepartments((depts ?? []) as Department[])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const nextCode = () => {
    const nums = employees
      .map(e => parseInt(e.employee_code.replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n))
    const next = nums.length ? Math.max(...nums) + 1 : 1
    return `EMP${String(next).padStart(3, '0')}`
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm, temp_password: genPassword() })
    setError(null); setCreated(null); setShowPw(false); setCopied(false)
    setModalOpen(true)
  }

  const openEdit = (emp: Employee) => {
    setEditing(emp)
    setEditForm({
      name: emp.name, mobile: emp.mobile, department_id: emp.department_id ?? '',
      designation: emp.designation, location: emp.location,
      joining_date: emp.joining_date, status: emp.status,
    })
    setError(null); setModalOpen(true)
  }

  // ── Single-step create: employee row + login, all from the app ──
  const addEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile) return
    setSaving(true); setError(null)

    const email = form.email.trim().toLowerCase()

    // 1. Create the employee record (DB trigger auto-creates leave balance
    //    and auto-links any existing profile with this email)
    const { error: empErr } = await supabase.from('employees').insert({
      employee_code: nextCode(),
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      email,
      department_id: form.department_id || null,
      designation: form.designation.trim() || 'Employee',
      location: form.location,
      joining_date: form.joining_date,
      status: 'active',
    } as any)

    if (empErr) {
      setError(empErr.code === '23505'
        ? 'An employee with this email or ID already exists.'
        : `Could not create employee: ${empErr.message}`)
      setSaving(false)
      return
    }

    // 2. Create their login (secondary client — admin stays signed in).
    //    DB trigger auto-creates their profile, linked to the employee row.
    const { error: authErr } = await authClient.auth.signUp({
      email,
      password: form.temp_password,
      options: { data: { full_name: form.name.trim(), role: form.role } },
    })

    if (authErr && !authErr.message.toLowerCase().includes('already registered')) {
      setError(`Employee saved, but login creation failed: ${authErr.message}. You can invite them from Supabase → Authentication instead.`)
      setSaving(false)
      await loadData()
      return
    }

    await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `Created employee + login: ${form.name}` })
    setCreated({ email, password: form.temp_password })
    await loadData()
    setSaving(false)
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing || !user || !profile) return
    setSaving(true); setError(null)
    const { error: updateError } = await supabase.from('employees')
      .update({ ...editForm, department_id: editForm.department_id || null } as any)
      .eq('id', editing.id)
    if (updateError) { setError('Failed to update.'); setSaving(false); return }
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

  const openBalance = async (emp: Employee) => {
    const { data } = await supabase.from('leave_balances').select('*')
      .eq('employee_id', emp.id).eq('year', new Date().getFullYear()).maybeSingle()
    if (data) setBal({
      casual_total: data.casual_total, sick_total: data.sick_total,
      emergency_total: data.emergency_total, paid_total: (data as any).paid_total ?? 15,
    })
    else setBal({ casual_total: 12, sick_total: 12, emergency_total: 6, paid_total: 15 })
    setBalEmp(emp)
  }

  const saveBalance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!balEmp || !user || !profile) return
    setBalBusy(true)
    await supabase.from('leave_balances').upsert(
      { employee_id: balEmp.id, year: new Date().getFullYear(), ...bal } as any,
      { onConflict: 'employee_id,year' }
    )
    await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `Set leave balance for ${balEmp.name}`, affectedEmployeeId: balEmp.id })
    setBalBusy(false); setBalEmp(null)
  }

  const copyCreds = () => {
    if (!created) return
    navigator.clipboard.writeText(`CURRYiT Attendance Login\nWebsite: ${window.location.origin}\nEmail: ${created.email}\nPassword: ${created.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filtered = employees.filter(e => {
    const s = search.toLowerCase()
    const matchSearch = !s || e.name.toLowerCase().includes(s) ||
      e.employee_code.toLowerCase().includes(s) || e.email.toLowerCase().includes(s)
    return matchSearch
      && (locFilter === 'all' || e.location === locFilter)
      && (statusFilter === 'all' || e.status === statusFilter)
  })

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">{employees.filter(e => e.status === 'active').length} active</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} /> New employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, ID or email" className="input pl-10" />
        </div>
        <div className="relative">
          <select value={locFilter} onChange={e => setLocFilter(e.target.value as any)}
            className="input pr-9 appearance-none min-w-[140px]">
            <option value="all">All locations</option>
            <option value="office">Office</option>
            <option value="cmk">CMK</option>
          </select>
          <ChevronDown size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            className="input pr-9 appearance-none min-w-[130px]">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <ChevronDown size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>ID</th><th>Employee</th><th>Department</th><th>Designation</th>
                <th>Location</th><th>Joined</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No employees found.</td></tr>
              ) : filtered.map(emp => (
                <tr key={emp.id} className={emp.status === 'inactive' ? 'opacity-50' : ''}>
                  <td className="font-mono text-xs text-gray-400">{emp.employee_code}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0"
                        style={{ background: '#E8531D' }}>
                        {emp.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-[14px]">{emp.name}</p>
                        <p className="text-xs text-gray-400">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-gray-500">{(emp as any).departments?.name ?? '—'}</td>
                  <td className="text-gray-500">{emp.designation}</td>
                  <td>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${emp.location === 'office' ? 'bg-blue-100/70 text-blue-800' : 'bg-amber-100/70 text-amber-800'}`}>
                      {emp.location === 'office' ? 'Office' : 'CMK'}
                    </span>
                  </td>
                  <td className="text-gray-400 text-[13px]">{formatDate(emp.joining_date)}</td>
                  <td>
                    <span className={emp.status === 'active' ? 'badge-approved' : 'badge-rejected'}>
                      {emp.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(emp)} className="p-2 rounded-full hover:bg-black/5 text-gray-400 hover:text-gray-700 transition-colors" title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => openBalance(emp)} className="p-2 rounded-full hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors" title="Leave balance">
                        <Wallet size={14} />
                      </button>
                      <button onClick={() => toggleStatus(emp)}
                        className={`p-2 rounded-full transition-colors ${emp.status === 'active' ? 'hover:bg-red-50 text-gray-400 hover:text-red-500' : 'hover:bg-green-50 text-gray-400 hover:text-green-600'}`}
                        title={emp.status === 'active' ? 'Deactivate' : 'Activate'}>
                        {emp.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ADD modal ── */}
      <Modal isOpen={modalOpen && !editing} onClose={() => setModalOpen(false)} title="New employee" size="lg">
        {created ? (
          <div className="space-y-5 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
              style={{ background: '#E8F8EE' }}>
              <CheckCheck size={28} style={{ color: '#34C759' }} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 mb-1">Employee created</p>
              <p className="text-sm text-gray-400">Login is ready. Share these credentials:</p>
            </div>
            <div className="p-5 rounded-2xl bg-gray-50 text-left space-y-2">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Email</p>
                <p className="text-[15px] font-medium text-gray-900">{created.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Password</p>
                <p className="text-[15px] font-mono font-medium text-gray-900">{created.password}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={copyCreds} className="btn-secondary flex-1">
                {copied ? <CheckCheck size={15} className="text-green-500" /> : <Copy size={15} />}
                {copied ? 'Copied' : 'Copy details'}
              </button>
              <button onClick={() => setModalOpen(false)} className="btn-primary flex-1">Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={addEmployee} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" required placeholder="Ravi Kumar" />
              </div>
              <div>
                <label className="label">Mobile</label>
                <input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} className="input" placeholder="9876543210" maxLength={10} />
              </div>
              <div>
                <label className="label">Email — used to log in</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" required placeholder="ravi@curryit.in" />
              </div>
              <div>
                <label className="label">Designation</label>
                <input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} className="input" placeholder="Operations Executive" />
              </div>
              <div>
                <label className="label">Department</label>
                <div className="relative">
                  <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })} className="input pr-9 appearance-none">
                    <option value="">None</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="label">Location</label>
                <div className="relative">
                  <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value as Location })} className="input pr-9 appearance-none">
                    <option value="office">Office</option>
                    <option value="cmk">CMK</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="label">Joining date</label>
                <input type="date" value={form.joining_date} onChange={e => setForm({ ...form, joining_date: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="label">Role</label>
                <div className="relative">
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input pr-9 appearance-none">
                    <option value="employee">Employee</option>
                    <option value="cmk_coordinator">CMK Coordinator</option>
                    <option value="admin">Admin</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label className="label">Temporary password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={form.temp_password}
                  onChange={e => setForm({ ...form, temp_password: e.target.value })}
                  className="input pr-12 font-mono" required minLength={8} />
                <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">They sign in with this and can change it later.</p>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving && <Spinner size="sm" />}
                {saving ? 'Creating…' : 'Create employee'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── EDIT modal ── */}
      <Modal isOpen={modalOpen && !!editing} onClose={() => setModalOpen(false)} title={editing?.name ?? ''} size="lg">
        <form onSubmit={saveEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <input value={editForm.designation} onChange={e => setEditForm({ ...editForm, designation: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Department</label>
              <div className="relative">
                <select value={editForm.department_id} onChange={e => setEditForm({ ...editForm, department_id: e.target.value })} className="input pr-9 appearance-none">
                  <option value="">None</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="label">Location</label>
              <div className="relative">
                <select value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value as Location })} className="input pr-9 appearance-none">
                  <option value="office">Office</option>
                  <option value="cmk">CMK</option>
                </select>
                <ChevronDown size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="label">Joining date</label>
              <input type="date" value={editForm.joining_date} onChange={e => setEditForm({ ...editForm, joining_date: e.target.value })} className="input" required />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving && <Spinner size="sm" />} {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── BALANCE modal ── */}
      <Modal isOpen={!!balEmp} onClose={() => setBalEmp(null)} title={`Leave balance · ${balEmp?.name ?? ''}`} size="sm">
        <form onSubmit={saveBalance} className="space-y-4">
          {([
            ['casual_total', 'Casual / year'],
            ['sick_total', 'Sick / year'],
            ['emergency_total', 'Emergency / year'],
            ['paid_total', 'Paid / year'],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <label className="text-[14px] font-medium text-gray-700">{label}</label>
              <input type="number" min={0} max={365}
                value={(bal as any)[key]}
                onChange={e => setBal({ ...bal, [key]: parseInt(e.target.value) || 0 })}
                className="input !w-24 text-center" />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setBalEmp(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={balBusy} className="btn-primary flex-1">
              {balBusy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
