import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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

// generate a strong temp password
const genPassword = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function EmployeesPage() {
  const { user, profile, role } = useAuth()
  const [params] = useSearchParams()

  const [employees, setEmployees]     = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState(params.get('q') ?? '')
  const [locFilter, setLocFilter]     = useState<'all' | Location>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | EmployeeStatus>('all')
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState<Employee | null>(null)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [successMsg, setSuccessMsg]   = useState<string | null>(null)
  const [showPw, setShowPw]           = useState(false)
  const [copied, setCopied]           = useState(false)

  // balance modal
  const [balEmp, setBalEmp]   = useState<Employee | null>(null)
  const [bal, setBal]         = useState({ casual_total: 12, sick_total: 12, emergency_total: 6, paid_total: 15 })
  const [balBusy, setBalBusy] = useState(false)

  // form state
  const [form, setForm] = useState({
    name: '', mobile: '', email: '', department_id: '',
    designation: '', location: 'office' as Location,
    joining_date: '', role: 'employee', temp_password: genPassword(),
  })
  const [editForm, setEditForm] = useState({
    name: '', mobile: '', department_id: '', designation: '',
    location: 'office' as Location, joining_date: '', status: 'active' as EmployeeStatus,
  })

  useEffect(() => { const q = params.get('q'); if (q) setSearch(q) }, [params])

  const loadData = async () => {
    setLoading(true)
    const [{ data: emps }, { data: depts }] = await Promise.all([
      supabase.from('employees').select('*, departments(name, location)').order('name'),
      supabase.from('departments').select('*').eq('status', 'active').order('name'),
    ])
    setEmployees((emps ?? []) as unknown as Employee[])
    setDepartments((depts ?? []) as Department[])
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
      joining_date: emp.joining_date, status: emp.status })
    setError(null); setModalOpen(true)
  }

  // ── Add: calls Edge Function — creates auth user + employee + profile in one shot
  const addEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true); setError(null)

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
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Failed to create employee.')
    } else {
      setSuccessMsg(json.message)
      await logAudit({ userId: user.id, userName: profile!.full_name, userRole: role!, action: `Created employee: ${form.name}` })
      await loadData()
    }
    setSaving(false)
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

  const openBalance = async (emp: Employee) => {
    const { data } = await supabase.from('leave_balances').select('*')
      .eq('employee_id', emp.id).eq('year', new Date().getFullYear()).maybeSingle()
    if (data) setBal({ casual_total: data.casual_total, sick_total: data.sick_total, emergency_total: data.emergency_total, paid_total: (data as any).paid_total ?? 15 })
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

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">{employees.filter(e => e.status === 'active').length} active employees</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus size={16} /> Add employee
        </button>
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
          <table className="w-full">
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
                        <p className="font-semibold text-gray-900 text-sm">{emp.name}</p>
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
                      <button onClick={() => openEdit(emp)} className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors" title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => openBalance(emp)} className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors" title="Leave balance">
                        <Wallet size={13} />
                      </button>
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

      {/* ── ADD Employee Modal ── */}
      <Modal isOpen={modalOpen && !editing} onClose={() => { setModalOpen(false); setSuccessMsg(null) }}
        title="Add new employee" size="lg">

        {successMsg ? (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl text-center" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="text-3xl mb-2">✅</div>
              <p className="font-black text-gray-900 text-lg mb-1">Employee created!</p>
              <p className="text-sm text-gray-500">{successMsg}</p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Share login details</p>
              <p className="text-sm text-gray-700"><span className="font-semibold">Email:</span> {form.email}</p>
              <p className="text-sm text-gray-700 mt-1"><span className="font-semibold">Password:</span> {form.temp_password}</p>
            </div>
            <button onClick={() => { setModalOpen(false); setSuccessMsg(null) }} className="btn-primary w-full justify-center">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={addEmployee} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Full name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" required placeholder="Ravi Kumar" />
              </div>
              <div>
                <label className="label">Mobile</label>
                <input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} className="input" placeholder="9876543210" maxLength={10} />
              </div>
              <div>
                <label className="label">Email (used for login)</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" required placeholder="ravi@curryit.in" />
              </div>
              <div>
                <label className="label">Designation</label>
                <input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} className="input" required placeholder="e.g. Operations Executive" />
              </div>
              <div>
                <label className="label">Department</label>
                <div className="relative">
                  <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })} className="input pr-8 appearance-none">
                    <option value="">Select department</option>
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
                    <option value="admin">Admin</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Temp password */}
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
                <button type="button" onClick={copyPassword}
                  className="btn-secondary px-4 flex-shrink-0">
                  {copied ? <CheckCheck size={15} className="text-green-500" /> : <Copy size={15} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Employee logs in with their email + this password. They can change it later.</p>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl text-sm text-red-600" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
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
      <Modal isOpen={modalOpen && !!editing} onClose={() => setModalOpen(false)} title={`Edit — ${editing?.name}`} size="lg">
        <form onSubmit={saveEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
              <label className="label">Department</label>
              <div className="relative">
                <select value={editForm.department_id} onChange={e => setEditForm({ ...editForm, department_id: e.target.value })} className="input pr-8 appearance-none">
                  <option value="">Select department</option>
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
              <label className="label">Joining date</label>
              <input type="date" value={editForm.joining_date} onChange={e => setEditForm({ ...editForm, joining_date: e.target.value })} className="input" required />
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
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving && <Spinner size="sm" />} {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── BALANCE Modal ── */}
      <Modal isOpen={!!balEmp} onClose={() => setBalEmp(null)} title={`Leave balance — ${balEmp?.name ?? ''} (${new Date().getFullYear()})`} size="sm">
        <form onSubmit={saveBalance} className="space-y-4">
          {([
            ['casual_total',    'Casual leaves / year'],
            ['sick_total',      'Sick leaves / year'],
            ['emergency_total', 'Emergency leaves / year'],
            ['paid_total',      'Paid leaves / year'],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input type="number" min={0} max={365}
                value={(bal as any)[key]}
                onChange={e => setBal({ ...bal, [key]: parseInt(e.target.value) || 0 })}
                className="input" />
            </div>
          ))}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setBalEmp(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={balBusy} className="btn-primary flex-1 justify-center">
              {balBusy ? 'Saving...' : 'Save balance'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
