import { useEffect, useState } from 'react'
import { Plus, Trash2, Key, AlertCircle, MapPin, Navigation, Users, Building2, ChevronDown, CalendarDays, Upload, Download, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, parseISO, isFuture, isToday } from 'date-fns'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { Modal } from '../Modal'
import { Spinner } from '../Spinner'
import type { Department, Location } from '../database'
import { GeoPickerMap } from '../components/GeoPickerMap'

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
  // ── Holidays state ─────────────────────────────────────────────────────
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const locationLabel = (l: string) => l === 'all' ? 'All' : l === 'office' ? 'Office' : 'CMK'
  const locationColor  = (l: string) =>
    l === 'all' ? 'bg-purple-100 text-purple-700' : l === 'office' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'

  const [hYear, setHYear]           = useState(new Date().getFullYear())
  const [holidays, setHolidays]     = useState<{id:string;holiday_date:string;name:string;location:string}[]>([])
  const [hLoading, setHLoading]     = useState(false)
  const [addHModal, setAddHModal]   = useState(false)
  const [newHDate, setNewHDate]     = useState('')
  const [newHName, setNewHName]     = useState('')
  const [newHLoc, setNewHLoc]       = useState<'all'|'office'|'cmk'>('all')
  const [hSaving, setHSaving]       = useState(false)
  const [hSaveErr, setHSaveErr]     = useState<string|null>(null)
  const [csvModal, setCsvModal]     = useState(false)
  const [csvText, setCsvText]       = useState('')
  const [csvRows, setCsvRows]       = useState<{date:string;name:string;location:string;err?:string}[]>([])
  const [importing, setImporting]   = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [delIds, setDelIds]         = useState<Set<string>>(new Set())
  const [delBusy, setDelBusy]       = useState(false)

  const loadHolidays = async () => {
    setHLoading(true)
    const { data } = await supabase.from('holidays').select('id,holiday_date,name,location')
      .gte('holiday_date', `${hYear}-01-01`).lte('holiday_date', `${hYear}-12-31`).order('holiday_date')
    setHolidays((data ?? []) as any); setHLoading(false)
  }

  useEffect(() => { if (isSuperAdmin) loadHolidays() }, [hYear, isSuperAdmin])

  const saveHoliday = async (e: React.FormEvent) => {
    e.preventDefault(); setHSaveErr(null); setHSaving(true)
    const { error } = await (supabase.from('holidays') as any).insert({ holiday_date: newHDate, name: newHName.trim(), location: newHLoc })
    if (error) { setHSaveErr(error.message); setHSaving(false); return }
    setAddHModal(false); setNewHDate(''); setNewHName(''); setNewHLoc('all'); await loadHolidays(); setHSaving(false)
  }
  const parseCSV = (raw: string) => {
    return raw.trim().split('\n').filter(l => l.trim()).map(line => {
      const [date, name, location = 'all'] = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date); const locOk = ['all','office','cmk'].includes(location)
      return { date, name, location, err: !dateOk ? 'Invalid date' : !name ? 'Name required' : !locOk ? 'Bad location' : undefined }
    })
  }
  const importCSV = async () => {
    const valid = csvRows.filter(r => !r.err); if (!valid.length) return
    setImporting(true)
    await (supabase.from('holidays') as any).insert(valid.map(r => ({ holiday_date: r.date, name: r.name, location: r.location })))
    setImportDone(true); setImporting(false); await loadHolidays()
    setTimeout(() => { setCsvModal(false); setCsvText(''); setCsvRows([]); setImportDone(false) }, 1500)
  }
  const toggleDel = (id: string) => setDelIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const deleteSelected = async () => {
    if (!delIds.size) return; setDelBusy(true)
    await supabase.from('holidays').delete().in('id', [...delIds]); setDelIds(new Set()); await loadHolidays(); setDelBusy(false)
  }
  const hByMonth: Record<number, typeof holidays> = {}
  holidays.forEach(h => { const m = parseISO(h.holiday_date).getMonth(); if (!hByMonth[m]) hByMonth[m] = []; hByMonth[m].push(h) })


  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="page-header flex-wrap gap-2">
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
          <div className="p-4 sm:p-5 border-t border-gray-50 space-y-5">
            {['office', 'cmk'].map(loc => {
              const s = geoSettings[loc] ?? { lat: 0, lng: 0, radius_m: 200, enabled: false }
              const hasCoords = s.lat !== 0 || s.lng !== 0
              return (
                <div key={loc} className="rounded-2xl border border-gray-100 overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50/60">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${loc === 'cmk' ? 'bg-brand-500' : 'bg-blue-500'}`} />
                      <h4 className="font-bold text-gray-800 text-sm">{loc === 'cmk' ? 'CMK Location' : 'Office Location'}</h4>
                    </div>
                    <div className="flex items-center gap-2 cursor-pointer"
                      onClick={() => setGeoSettings(p => ({ ...p, [loc]: { ...p[loc], enabled: !p[loc]?.enabled } }))}>
                      <span className="text-xs font-semibold text-gray-400">Enforce</span>
                      <div className="w-10 h-5 rounded-full transition-colors relative flex-shrink-0"
                        style={{ background: s.enabled ? '#E8531D' : '#E5E7EB' }}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${s.enabled ? 'left-5' : 'left-0.5'}`} />
                      </div>
                    </div>
                  </div>

                  {/* Map */}
                  <div className="p-4 space-y-4">
                    <div className="rounded-xl overflow-hidden border border-gray-100">
                      {hasCoords ? (
                        <GeoPickerMap
                          lat={s.lat} lng={s.lng} radiusM={s.radius_m}
                          onChange={(lat, lng, radiusM) =>
                            setGeoSettings(p => ({ ...p, [loc]: { ...p[loc], lat, lng, radius_m: radiusM } }))
                          }
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-40 bg-gray-50 text-gray-400 text-sm gap-2">
                          <MapPin size={24} className="text-gray-300" />
                          <p>Click "Use my location" or enter coordinates below to set up the map</p>
                        </div>
                      )}
                    </div>

                    {/* Coords display (read-only) */}
                    {hasCoords && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-gray-50 rounded-xl px-3 py-2">
                          <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">Latitude</p>
                          <p className="font-mono font-bold text-gray-700">{s.lat.toFixed(6)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl px-3 py-2">
                          <p className="text-gray-400 font-semibold uppercase tracking-wider text-[10px] mb-0.5">Longitude</p>
                          <p className="font-mono font-bold text-gray-700">{s.lng.toFixed(6)}</p>
                        </div>
                      </div>
                    )}

                    {/* Radius slider */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="label mb-0">Allowed radius</label>
                        <span className="text-sm font-black text-brand-600">{s.radius_m}m</span>
                      </div>
                      <input type="range" min={50} max={1000} step={10} value={s.radius_m}
                        onChange={e => setGeoSettings(p => ({ ...p, [loc]: { ...p[loc], radius_m: parseInt(e.target.value) } }))}
                        className="w-full accent-brand-500" />
                      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                        <span>50m</span><span>500m</span><span>1000m</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button onClick={() => useMyLocation(loc)} className="btn-secondary flex-1 justify-center text-sm">
                        <Navigation size={13} /> Use my location
                      </button>
                      <button onClick={() => saveGeo(loc)} disabled={geoSaving === loc} className="btn-primary flex-1 justify-center text-sm">
                        {geoSaving === loc ? <Spinner size="sm" /> : <MapPin size={13} />}
                        Save {loc === 'cmk' ? 'CMK' : 'Office'}
                      </button>
                    </div>
                  </div>
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


      {/* ── Holidays ── */}
      {isSuperAdmin && (
        <Section
          icon={<CalendarDays size={15} style={{ color: '#E8531D' }} />}
          title="Holidays"
          subtitle={`${holidays.length} holidays in ${hYear}`}>
          <div className="p-5 border-t border-gray-50 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setHYear(y => y - 1)} className="p-1.5 rounded-xl border border-gray-200 hover:bg-gray-50"><ChevronLeft size={15} /></button>
                <span className="text-lg font-black text-gray-900 min-w-[50px] text-center">{hYear}</span>
                <button onClick={() => setHYear(y => y + 1)} className="p-1.5 rounded-xl border border-gray-200 hover:bg-gray-50"><ChevronRight size={15} /></button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {delIds.size > 0 && (
                  <button onClick={deleteSelected} disabled={delBusy} className="btn-secondary text-red-600 border-red-200">
                    {delBusy ? <Spinner size="sm" /> : <Trash2 size={14} />} Delete ({delIds.size})
                  </button>
                )}
                <button onClick={() => { setCsvModal(true); setImportDone(false) }} className="btn-secondary">
                  <Upload size={14} /> Bulk Import
                </button>
                <button onClick={() => { setAddHModal(true); setHSaveErr(null) }} className="btn-primary">
                  <Plus size={14} /> Add Holiday
                </button>
              </div>
            </div>

            {hLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
              Object.keys(hByMonth).length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <CalendarDays size={32} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm">No holidays for {hYear}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(hByMonth).map(([mStr, hols]) => {
                    const m = Number(mStr)
                    return (
                      <div key={m} className="p-3 rounded-2xl border border-gray-100">
                        <h4 className="font-black text-gray-600 text-xs uppercase tracking-wider mb-2">{MONTHS[m]}</h4>
                        <div className="space-y-1.5">
                          {hols.map(h => {
                            const selected = delIds.has(h.id)
                            return (
                              <div key={h.id} className={`flex items-center gap-2 p-2 rounded-xl ${selected ? 'bg-red-50' : 'bg-gray-50'}`}>
                                <input type="checkbox" checked={selected} onChange={() => toggleDel(h.id)}
                                  className="w-3.5 h-3.5 accent-red-500 flex-shrink-0" />
                                <span className="font-bold text-gray-700 text-sm w-8 flex-shrink-0">{format(parseISO(h.holiday_date), 'dd')}</span>
                                <span className="flex-1 text-sm text-gray-800 truncate">{h.name}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${locationColor(h.location)}`}>{locationLabel(h.location)}</span>
                                <button onClick={async () => { await supabase.from('holidays').delete().eq('id', h.id); await loadHolidays() }}
                                  className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
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
