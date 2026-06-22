import { useEffect, useState } from 'react'
import { Plus, Trash2, Key, AlertCircle, MapPin, Navigation, Users, Building2, ChevronDown } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { Modal } from '../Modal'
import { Spinner } from '../Spinner'
import type { Department, Location } from '../database'

// ── Accordion section wrapper ─────────────────────────────────────────────
function Section({ icon, title, subtitle, children, defaultOpen = false }: {
  icon: React.ReactNode; title: string; subtitle?: string
  children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full table-header flex items-center justify-between gap-3 text-left hover:bg-gray-50/60 transition-colors"
        style={{ cursor: 'pointer' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl flex-shrink-0" style={{ background: 'rgba(232,83,29,0.08)' }}>
            {icon}
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <ChevronDown
          size={18}
          className="text-gray-400 flex-shrink-0 transition-transform duration-300"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? '2000px' : '0px', opacity: open ? 1 : 0, transition: 'max-height 0.35s ease, opacity 0.25s ease' }}>
        {children}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { user, profile } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading]   = useState(true)
  const [deptModal, setDeptModal] = useState(false)
  const [pwModal, setPwModal]   = useState(false)
  const [deptName, setDeptName] = useState('')
  const [deptLoc, setDeptLoc]   = useState<Location>('office')
  const [newPw, setNewPw]       = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)

  const [geoSettings, setGeoSettings] = useState<Record<string, any>>({})
  const [geoSaving, setGeoSaving] = useState<string | null>(null)

  const [admins, setAdmins] = useState<any[]>([])
  const [savingAdmin, setSavingAdmin] = useState<string | null>(null)

  const loadAdmins = async () => {
    const { data } = await supabase
      .from('profiles').select('id, full_name, email, role, department_id')
      .in('role', ['admin']).order('full_name')
    setAdmins(data ?? [])
  }

  const loadGeo = async () => {
    const { data } = await supabase.from('geo_settings').select('*')
    const map: Record<string, any> = {}
    ;(data ?? []).forEach((r: any) => { map[r.location] = { ...r } })
    setGeoSettings(map)
  }

  const saveGeo = async (location: string) => {
    const s = geoSettings[location]
    if (!s) return
    setGeoSaving(location)
    await supabase.from('geo_settings').update({ lat: s.lat, lng: s.lng, radius_m: s.radius_m, enabled: s.enabled }).eq('location', location)
    setGeoSaving(null)
    setSuccess('Geo settings saved!')
    setTimeout(() => setSuccess(null), 2000)
  }

  const useMyLocation = (location: string) => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      setGeoSettings(prev => ({ ...prev, [location]: { ...prev[location], lat: pos.coords.latitude, lng: pos.coords.longitude } }))
    })
  }

  const loadDepts = async () => {
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepartments((data ?? []) as Department[])
    setLoading(false)
  }

  useEffect(() => { loadDepts(); loadGeo(); if (profile?.role === 'super_admin') loadAdmins() }, [profile?.role])

  const addDepartment = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('departments').insert({ name: deptName, location: deptLoc, status: 'active' })
    setDeptModal(false); setDeptName('')
    await loadDepts(); setSaving(false)
  }

  const removeDepartment = async (id: string) => {
    if (!confirm('Remove this department? Employees assigned to it will need to be reassigned.')) return
    await supabase.from('departments').update({ status: 'inactive' }).eq('id', id)
    await loadDepts()
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    if (newPw !== confirmPw) { setError('New passwords do not match.'); return }
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) setError(error.message)
    else { setSuccess('Password updated successfully.'); setPwModal(false); setNewPw(''); setConfirmPw('') }
    setSaving(false)
  }

  const isSuperAdmin = profile?.role === 'super_admin'

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Tap any section to expand</p>
        </div>
      </div>

      {success && <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3 text-sm text-green-700">✓ {success}</div>}

      {/* ── Departments ── */}
      <Section
        icon={<Building2 size={15} style={{ color: '#E8531D' }} />}
        title="Departments"
        subtitle={`${departments.filter(d => d.status === 'active').length} active`}
        >
        <div className="p-5 border-t border-gray-50">
          <div className="flex justify-end mb-4">
            <button onClick={() => setDeptModal(true)} className="btn-primary">
              <Plus size={15} /> Add department
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full">
              <thead>
                <tr><th>Department</th><th>Location</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {departments.map(d => (
                  <tr key={d.id}>
                    <td className="font-medium text-gray-900">{d.name}</td>
                    <td><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${d.location === 'office' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{d.location === 'office' ? 'Office' : 'CMK'}</span></td>
                    <td><span className={d.status === 'active' ? 'badge-present' : 'badge-rejected'}>{d.status}</span></td>
                    <td>
                      {d.status === 'active' && (
                        <button onClick={() => removeDepartment(d.id)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors">
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
      </Section>

      {/* ── Account ── */}
      <Section
        icon={<Key size={15} style={{ color: '#E8531D' }} />}
        title="Account"
        subtitle="Password & profile">
        <div className="p-5 border-t border-gray-50">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
            <div>
              <p className="font-semibold text-gray-900">{profile?.full_name}</p>
              <p className="text-sm text-gray-500">{profile?.email}</p>
            </div>
            <button onClick={() => setPwModal(true)} className="btn-secondary">
              <Key size={15} /> Change password
            </button>
          </div>
        </div>
      </Section>

      {/* ── Geo-Fencing ── */}
      {isSuperAdmin && (
        <Section
          icon={<MapPin size={15} style={{ color: '#E8531D' }} />}
          title="Geo-Fencing"
          subtitle="Office & CMK location boundaries">
          <div className="p-5 border-t border-gray-50 space-y-5">
            {['office', 'cmk'].map(loc => {
              const s = geoSettings[loc] ?? { lat: 0, lng: 0, radius_m: 200, enabled: false }
              return (
                <div key={loc} className="p-5 rounded-2xl border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-800">{loc === 'cmk' ? 'CMK Location' : 'Office Location'}</h4>
                    <div className="flex items-center gap-2 cursor-pointer"
                      onClick={() => setGeoSettings(p => ({ ...p, [loc]: { ...p[loc], enabled: !p[loc]?.enabled } }))}>
                      <span className="text-xs font-semibold text-gray-500">Enforce</span>
                      <div className="w-10 h-5 rounded-full transition-colors relative"
                        style={{ background: s.enabled ? '#E8531D' : '#E5E7EB' }}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${s.enabled ? 'left-5' : 'left-0.5'}`} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Latitude</label>
                      <input type="number" step="any" value={s.lat}
                        onChange={e => setGeoSettings(p => ({ ...p, [loc]: { ...p[loc], lat: parseFloat(e.target.value)||0 } }))}
                        className="input" placeholder="e.g. 28.6139" />
                    </div>
                    <div>
                      <label className="label">Longitude</label>
                      <input type="number" step="any" value={s.lng}
                        onChange={e => setGeoSettings(p => ({ ...p, [loc]: { ...p[loc], lng: parseFloat(e.target.value)||0 } }))}
                        className="input" placeholder="e.g. 77.2090" />
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="label">Allowed radius (metres)</label>
                      <input type="number" value={s.radius_m}
                        onChange={e => setGeoSettings(p => ({ ...p, [loc]: { ...p[loc], radius_m: parseInt(e.target.value)||100 } }))}
                        className="input" />
                    </div>
                    <button onClick={() => useMyLocation(loc)} className="btn-secondary gap-2 flex items-center">
                      <Navigation size={14} /> Use my location
                    </button>
                  </div>
                  <button onClick={() => saveGeo(loc)} disabled={geoSaving === loc} className="btn-primary w-full justify-center">
                    {geoSaving === loc ? <Spinner size="sm" /> : <MapPin size={14} />}
                    Save {loc === 'cmk' ? 'CMK' : 'Office'} settings
                  </button>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* ── Admin Management ── */}
      {isSuperAdmin && (
        <Section
          icon={<Users size={15} style={{ color: '#E8531D' }} />}
          title="Admin Management"
          subtitle="Assign department scope to each admin">
          <div className="p-5 border-t border-gray-50">
            <div className="overflow-x-auto rounded-2xl border border-gray-100">
              <table className="w-full">
                <thead><tr><th>Admin</th><th>Email</th><th>Department</th><th>Save</th></tr></thead>
                <tbody>
                  {admins.map(a => (
                    <tr key={a.id}>
                      <td className="font-semibold text-gray-900">{a.full_name}</td>
                      <td className="text-gray-500 text-xs">{a.email}</td>
                      <td>
                        <select defaultValue={a.department_id ?? ''}
                          onChange={e => { a._newDept = e.target.value }}
                          className="input py-1.5 text-xs appearance-none">
                          <option value="">All departments</option>
                          {departments.filter(d => d.status === 'active').map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button disabled={savingAdmin === a.id}
                          onClick={async () => {
                            setSavingAdmin(a.id)
                            const deptId = a._newDept !== undefined ? a._newDept : a.department_id
                            await supabase.from('profiles').update({ department_id: deptId || null }).eq('id', a.id)
                            await loadAdmins(); setSavingAdmin(null)
                          }}
                          className="btn-primary py-1.5 text-xs px-3">
                          {savingAdmin === a.id ? 'Saving…' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {admins.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-gray-400 py-6 text-sm">No admin accounts found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      )}

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
              {saving ? <Spinner size="sm" /> : null} Add
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
              {saving ? <Spinner size="sm" /> : null} Update password
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
