import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Plus, Trash2, UserCheck, UserX, Users, ClipboardList } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { Modal } from '../components/Modal'
import { Spinner } from '../components/Spinner'

interface Worker { id: string; name: string; mobile: string; employee_code: string }
interface AttRecord { id: string; employee_id: string; status: string }

export default function CMKWorkers() {
  const { user, profile } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayLabel = format(new Date(), 'EEEE, dd MMM yyyy')

  const [workers, setWorkers]   = useState<Worker[]>([])
  const [att, setAtt]           = useState<AttRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [attBusy, setAttBusy]   = useState<string | null>(null)

  // Add worker modal
  const [addOpen, setAddOpen]   = useState(false)
  const [name, setName]         = useState('')
  const [mobile, setMobile]     = useState('')
  const [addBusy, setAddBusy]   = useState(false)
  const [addErr, setAddErr]     = useState('')

  // Delete confirm
  const [delId, setDelId]       = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data: emps, error: empErr } = await supabase
        .from('employees')
        .select('id, name, mobile, employee_code')
        .eq('employee_type', 'labor')
        .eq('location', 'cmk')
        .eq('status', 'active')
        .order('name')

      if (empErr) { console.error('Load workers error:', empErr); setLoading(false); return }

      const ids = (emps ?? []).map(e => e.id)
      const attData = ids.length > 0
        ? (await supabase.from('attendance').select('id, employee_id, status').eq('date', today).in('employee_id', ids)).data
        : []

      setWorkers((emps ?? []) as Worker[])
      setAtt((attData ?? []) as AttRecord[])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const markAttendance = async (workerId: string, status: 'present' | 'absent') => {
    setAttBusy(workerId)
    const existing = att.find(a => a.employee_id === workerId)
    if (existing) {
      await supabase.from('attendance').update({ status }).eq('id', existing.id)
      setAtt(prev => prev.map(a => a.employee_id === workerId ? { ...a, status } : a))
    } else {
      const { data } = await supabase.from('attendance').insert({
        employee_id: workerId,
        date: today,
        status,
        location: 'cmk',
        work_mode: 'office',
      }).select().single()
      if (data) setAtt(prev => [...prev, data as AttRecord])
    }
    setAttBusy(null)
  }

  const addWorker = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setAddErr('Name is required'); return }
    setAddBusy(true); setAddErr('')

    // Generate employee code
    const { count } = await supabase.from('employees').select('*', { count: 'exact', head: true })
    const code = `CMK${String((count ?? 0) + 1).padStart(3, '0')}`

    const { error } = await supabase.from('employees').insert({
      employee_code: code,
      name: name.trim(),
      mobile: mobile.trim() || '',
      email: `${code.toLowerCase()}@cmk.labor`,
      location: 'cmk',
      employee_type: 'labor',
      designation: 'CMK Worker',
      joining_date: today,
      status: 'active',
    })

    if (error) { setAddErr(error.message); setAddBusy(false); return }
    setName(''); setMobile(''); setAddOpen(false); setAddBusy(false)
    await load()
  }

  const deleteWorker = async (id: string) => {
    await supabase.from('employees').delete().eq('id', id)
    setDelId(null)
    await load()
  }

  const getStatus = (workerId: string) => att.find(a => a.employee_id === workerId)?.status ?? null

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  const presentCount = workers.filter(w => getStatus(w.id) === 'present').length
  const absentCount  = workers.filter(w => getStatus(w.id) === 'absent').length
  const unmarked     = workers.filter(w => !getStatus(w.id)).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">CMK Workers</h1>
          <p className="page-subtitle">{todayLabel}</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary gap-2">
          <Plus size={16} /> Add Worker
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Present', value: presentCount, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Absent',  value: absentCount,  color: 'text-red-500',     bg: 'bg-red-50' },
          { label: 'Unmarked',value: unmarked,      color: 'text-amber-500',   bg: 'bg-amber-50' },
        ].map(t => (
          <div key={t.label} className={`card-elevated rounded-2xl p-5 text-center ${t.bg}`}>
            <p className={`text-3xl font-black ${t.color}`}>{t.value}</p>
            <p className="text-xs font-bold text-gray-500 mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      {workers.length === 0 ? (
        <div className="card rounded-3xl p-12 text-center">
          <Users size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-semibold">No workers added yet</p>
          <p className="text-sm text-gray-400 mt-1">Click "Add Worker" to get started</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-header">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ background: 'rgba(232,83,29,0.08)' }}>
                <ClipboardList size={15} style={{ color: '#E8531D' }} />
              </div>
              <h3 className="font-bold text-gray-900">Mark Today's Attendance</h3>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {workers.map(w => {
              const status = getStatus(w.id)
              const busy = attBusy === w.id
              return (
                <div key={w.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#E8531D,#C44010)' }}>
                    {w.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{w.name}</p>
                    <p className="text-xs text-gray-400">{w.employee_code}{w.mobile ? ` · ${w.mobile}` : ''}</p>
                  </div>

                  {/* Status badge */}
                  {status === 'present' && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">Present</span>
                  )}
                  {status === 'absent' && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600">Absent</span>
                  )}
                  {!status && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-600">Unmarked</span>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => markAttendance(w.id, 'present')} disabled={!!busy}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        status === 'present'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}>
                      {busy ? <Spinner size="sm" /> : <UserCheck size={13} />} P
                    </button>
                    <button onClick={() => markAttendance(w.id, 'absent')} disabled={!!busy}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        status === 'absent'
                          ? 'bg-red-500 text-white'
                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}>
                      {busy ? <Spinner size="sm" /> : <UserX size={13} />} A
                    </button>
                    <button onClick={() => setDelId(w.id)}
                      className="p-1.5 rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add Worker Modal */}
      <Modal isOpen={addOpen} onClose={() => { setAddOpen(false); setAddErr('') }} title="Add CMK Worker" size="sm">
        <form onSubmit={addWorker} className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Worker name" autoFocus />
          </div>
          <div>
            <label className="label">Mobile (optional)</label>
            <input value={mobile} onChange={e => setMobile(e.target.value)} className="input" placeholder="10-digit number" />
          </div>
          {addErr && <p className="text-sm text-red-500">{addErr}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setAddOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={addBusy} className="btn-primary flex-1 justify-center">
              {addBusy ? <Spinner size="sm" /> : <Plus size={15} />} Add Worker
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!delId} onClose={() => setDelId(null)} title="Remove worker?" size="sm">
        <p className="text-sm text-gray-500 mb-4">This will remove the worker and all their attendance records.</p>
        <div className="flex gap-3">
          <button onClick={() => setDelId(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={() => delId && deleteWorker(delId)} className="btn-danger flex-1 justify-center">Remove</button>
        </div>
      </Modal>
    </div>
  )
}
