import { useEffect, useState } from 'react'
import { Plus, Trash2, Key, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/Common/Modal'
import { Spinner } from '../components/Common/Spinner'
import type { Department, Location } from '../types/database'

export default function SettingsPage() {
  const { user, profile } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading]   = useState(true)
  const [deptModal, setDeptModal] = useState(false)
  const [pwModal, setPwModal]   = useState(false)
  const [deptName, setDeptName] = useState('')
  const [deptLoc, setDeptLoc]   = useState<Location>('office')
  const [oldPw, setOldPw]       = useState('')
  const [newPw, setNewPw]       = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)

  const loadDepts = async () => {
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepartments((data ?? []) as Department[])
    setLoading(false)
  }

  useEffect(() => { loadDepts() }, [])

  const addDepartment = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('departments').insert({ name: deptName, location: deptLoc, status: 'active' })
    setDeptModal(false)
    setDeptName('')
    await loadDepts()
    setSaving(false)
  }

  const removeDepartment = async (id: string) => {
    if (!confirm('Remove this department? Employees assigned to it will need to be reassigned.')) return
    await supabase.from('departments').update({ status: 'inactive' }).eq('id', id)
    await loadDepts()
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (newPw !== confirmPw) { setError('New passwords do not match.'); return }
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) setError(error.message)
    else { setSuccess('Password updated successfully.'); setPwModal(false); setOldPw(''); setNewPw(''); setConfirmPw('') }
    setSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">System configuration</p>
        </div>
      </div>

      {success && <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700">✓ {success}</div>}

      {/* Departments */}
      <div className="card">
        <div className="table-header">
          <div>
            <h3 className="font-semibold text-gray-900">Departments</h3>
            <p className="text-xs text-gray-500 mt-0.5">{departments.filter(d => d.status === 'active').length} active</p>
          </div>
          <button onClick={() => setDeptModal(true)} className="btn-primary">
            <Plus size={15} />
            Add department
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>Department name</th>
                <th>Location</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {departments.map(d => (
                <tr key={d.id}>
                  <td className="font-medium text-gray-900">{d.name}</td>
                  <td><span className={`px-2 py-0.5 rounded-full text-xs ${d.location === 'office' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{d.location === 'office' ? 'Office' : 'CMK'}</span></td>
                  <td><span className={d.status === 'active' ? 'badge-present' : 'badge-rejected'}>{d.status}</span></td>
                  <td>
                    {d.status === 'active' && (
                      <button onClick={() => removeDepartment(d.id)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Account settings</h3>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div>
            <p className="font-medium text-gray-900">{profile?.full_name}</p>
            <p className="text-sm text-gray-500">{profile?.email}</p>
          </div>
          <button onClick={() => setPwModal(true)} className="btn-secondary">
            <Key size={15} />
            Change password
          </button>
        </div>
      </div>

      {/* Add department modal */}
      <Modal isOpen={deptModal} onClose={() => setDeptModal(false)} title="Add department" size="sm">
        <form onSubmit={addDepartment} className="space-y-4">
          <div>
            <label className="label">Department name</label>
            <input value={deptName} onChange={e => setDeptName(e.target.value)} className="input" required placeholder="e.g. Operations" />
          </div>
          <div>
            <label className="label">Location</label>
            <select value={deptLoc} onChange={e => setDeptLoc(e.target.value as Location)} className="input">
              <option value="office">Office</option>
              <option value="cmk">CMK</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setDeptModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Spinner size="sm" /> : null}
              Add
            </button>
          </div>
        </form>
      </Modal>

      {/* Change password modal */}
      <Modal isOpen={pwModal} onClose={() => setPwModal(false)} title="Change password" size="sm">
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="label">New password</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="input" required minLength={8} />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="input" required />
          </div>
          {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} />{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setPwModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <Spinner size="sm" /> : null}
              Update password
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
