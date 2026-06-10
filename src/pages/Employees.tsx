import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, UserX, UserCheck, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/Common/Modal'
import { Spinner } from '../components/Common/Spinner'
import { formatDate, logAudit } from '../utils/helpers'
import type { Employee, Department, Location, EmployeeStatus } from '../types/database'

export default function EmployeesPage() {
  const { user, profile, role } = useAuth()
  const [employees, setEmployees]   = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [locFilter, setLocFilter]   = useState<'all' | Location>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | EmployeeStatus>('all')
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<Employee | null>(null)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    name: '', mobile: '', email: '', department_id: '',
    designation: '', location: 'office' as Location,
    joining_date: '', status: 'active' as EmployeeStatus,
  })

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
    setForm({ name: '', mobile: '', email: '', department_id: '', designation: '', location: 'office', joining_date: '', status: 'active' })
    setError(null)
    setModalOpen(true)
  }

  const openEdit = (emp: Employee) => {
    setEditing(emp)
    setForm({
      name: emp.name, mobile: emp.mobile, email: emp.email,
      department_id: emp.department_id, designation: emp.designation,
      location: emp.location, joining_date: emp.joining_date, status: emp.status,
    })
    setError(null)
    setModalOpen(true)
  }

  const generateCode = () => `EMP${String(Math.floor(Math.random() * 9000) + 1000)}`

  const saveEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile) return
    setSaving(true)
    setError(null)

    if (editing) {
      const { error: updateError } = await supabase.from('employees').update(form).eq('id', editing.id)
      if (updateError) { setError('Failed to update employee.'); setSaving(false); return }
      await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `Updated employee: ${form.name}`, affectedEmployeeId: editing.id })
    } else {
      const { error: insertError } = await supabase.from('employees').insert({ ...form, employee_code: generateCode() })
      if (insertError) {
        setError(insertError.code === '23505' ? 'Email already exists.' : 'Failed to add employee.')
        setSaving(false); return
      }
      await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `Added new employee: ${form.name}` })
    }

    setModalOpen(false)
    await loadData()
    setSaving(false)
  }

  const toggleStatus = async (emp: Employee) => {
    if (!user || !profile) return
    const newStatus: EmployeeStatus = emp.status === 'active' ? 'inactive' : 'active'
    await supabase.from('employees').update({ status: newStatus }).eq('id', emp.id)
    await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `Set employee ${emp.name} to ${newStatus}`, affectedEmployeeId: emp.id })
    await loadData()
  }

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.employee_code.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase())
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
          <Plus size={16} />
          Add employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, ID or email..." className="input pl-9" />
        </div>
        <div className="relative">
          <select value={locFilter} onChange={e => setLocFilter(e.target.value as any)} className="input pr-8 appearance-none min-w-[130px]">
            <option value="all">All locations</option>
            <option value="office">Office</option>
            <option value="cmk">CMK</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="input pr-8 appearance-none min-w-[120px]">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Location</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">No employees found.</td></tr>
              ) : (
                filtered.map(emp => (
                  <tr key={emp.id} className={emp.status === 'inactive' ? 'opacity-60' : ''}>
                    <td className="font-mono text-xs text-gray-500">{emp.employee_code}</td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-semibold text-xs flex-shrink-0">
                          {emp.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{emp.name}</p>
                          <p className="text-xs text-gray-400">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-gray-500">{(emp as any).departments?.name ?? '—'}</td>
                    <td className="text-gray-500">{emp.designation}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.location === 'office' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                        {emp.location === 'office' ? 'Office' : 'CMK'}
                      </span>
                    </td>
                    <td className="text-gray-500">{formatDate(emp.joining_date)}</td>
                    <td>
                      <span className={emp.status === 'active' ? 'badge-present' : 'badge-rejected'}>
                        {emp.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(emp)} className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => toggleStatus(emp)} className={`p-1.5 rounded-lg transition-colors ${emp.status === 'active' ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-green-50 hover:bg-green-100 text-green-600'}`} title={emp.status === 'active' ? 'Deactivate' : 'Activate'}>
                          {emp.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit employee' : 'Add new employee'} size="lg">
        <form onSubmit={saveEmployee} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full name</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input" required placeholder="Ravi Kumar" />
            </div>
            <div>
              <label className="label">Mobile</label>
              <input value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} className="input" required placeholder="9876543210" maxLength={10} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input" required placeholder="ravi@curryit.in" />
            </div>
            <div>
              <label className="label">Designation</label>
              <input value={form.designation} onChange={e => setForm({...form, designation: e.target.value})} className="input" required placeholder="e.g. Operations Executive" />
            </div>
            <div>
              <label className="label">Department</label>
              <div className="relative">
                <select value={form.department_id} onChange={e => setForm({...form, department_id: e.target.value})} className="input pr-8 appearance-none" required>
                  <option value="">Select department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="label">Location</label>
              <div className="relative">
                <select value={form.location} onChange={e => setForm({...form, location: e.target.value as Location})} className="input pr-8 appearance-none">
                  <option value="office">Office</option>
                  <option value="cmk">CMK</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="label">Joining date</label>
              <input type="date" value={form.joining_date} onChange={e => setForm({...form, joining_date: e.target.value})} className="input" required />
            </div>
            <div>
              <label className="label">Status</label>
              <div className="relative">
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value as EmployeeStatus})} className="input pr-8 appearance-none">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Spinner size="sm" /> : null}
              {saving ? 'Saving...' : (editing ? 'Save changes' : 'Add employee')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
