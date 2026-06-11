import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Plus, Check, X, Calendar, ChevronDown, AlertCircle, Home, Briefcase, Wallet } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { Modal } from '../Modal'
import { Spinner } from '../Spinner'
import { formatDate, getLeaveDays, statusLabel, logAudit } from '../helpers'

type Tab = 'leaves' | 'wfh'
type LType = 'casual' | 'sick' | 'emergency' | 'paid' | 'unpaid'

interface Req {
  id: string; employee_id: string; leave_type?: string
  start_date: string; end_date: string; total_days?: number
  reason: string; status: string; remarks: string | null
  employees?: { name: string }
}
interface Balance {
  casual_total: number; casual_used: number; sick_total: number; sick_used: number
  emergency_total: number; emergency_used: number; paid_total: number; paid_used: number
}

const leaveTypeLabels: Record<LType, string> = {
  casual: 'Casual Leave', sick: 'Sick Leave', emergency: 'Emergency Leave',
  paid: 'Paid Leave', unpaid: 'Unpaid Leave',
}

export default function LeavePage() {
  const { user, profile, role } = useAuth()
  const isAdmin = role === 'admin' || role === 'super_admin'

  const [tab, setTab]           = useState<Tab>('leaves')
  const [leaves, setLeaves]     = useState<Req[]>([])
  const [wfh, setWfh]           = useState<Req[]>([])
  const [balance, setBalance]   = useState<Balance | null>(null)
  const [empId, setEmpId]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<'leave' | 'wfh' | null>(null)
  const [rejectId, setRejectId] = useState<{ id: string; kind: Tab } | null>(null)
  const [remark, setRemark]     = useState('')
  const [filter, setFilter]     = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [error, setError]       = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)

  // form
  const [leaveType, setLeaveType] = useState<LType>('casual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [reason, setReason]       = useState('')

  const load = async () => {
    setLoading(true)
    let myEmpId: string | null = null
    if (profile?.email) {
      const { data: emp } = await supabase.from('employees').select('id').eq('email', profile.email).maybeSingle()
      myEmpId = emp?.id ?? null
      setEmpId(myEmpId)
    }

    let lq = supabase.from('leave_requests').select('*, employees(name)').order('created_at', { ascending: false })
    let wq = supabase.from('wfh_requests').select('*, employees(name)').order('created_at', { ascending: false })
    if (!isAdmin && myEmpId) { lq = lq.eq('employee_id', myEmpId); wq = wq.eq('employee_id', myEmpId) }

    const [{ data: l }, { data: w }] = await Promise.all([lq, wq])
    setLeaves((l ?? []) as Req[]); setWfh((w ?? []) as Req[])

    if (myEmpId) {
      const { data: bal } = await supabase.from('leave_balances').select('*')
        .eq('employee_id', myEmpId).eq('year', new Date().getFullYear()).maybeSingle()
      setBalance(bal as Balance | null)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile || !empId) { setError('Employee record not linked. Contact admin.'); return }
    setBusy(true); setError(null)
    const days = getLeaveDays(startDate, endDate)
    if (days <= 0) { setError('End date must be on or after start date.'); setBusy(false); return }

    let err
    if (modal === 'leave') {
      ;({ error: err } = await supabase.from('leave_requests').insert({
        employee_id: empId, leave_type: leaveType, start_date: startDate,
        end_date: endDate, total_days: days, reason, status: 'pending',
      }))
    } else {
      ;({ error: err } = await supabase.from('wfh_requests').insert({
        employee_id: empId, start_date: startDate, end_date: endDate, reason, status: 'pending',
      }))
    }
    if (err) setError('Failed to submit. Please try again.')
    else {
      await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!,
        action: modal === 'leave' ? `Applied ${leaveType} leave (${days}d)` : `Requested WFH (${days}d)` })
      setModal(null); setStartDate(''); setEndDate(''); setReason('')
      await load()
    }
    setBusy(false)
  }

  const decide = async (id: string, kind: Tab, status: 'approved' | 'rejected', remarks?: string) => {
    if (!user || !profile) return
    const table = kind === 'leaves' ? 'leave_requests' : 'wfh_requests'
    await supabase.from(table).update({ status, remarks: remarks ?? null, approved_by: user.id }).eq('id', id)
    await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `${status} ${kind === 'leaves' ? 'leave' : 'WFH'} request` })
    setRejectId(null); setRemark('')
    await load()
  }

  const rows = (tab === 'leaves' ? leaves : wfh).filter(r => filter === 'all' || r.status === filter)

  const badge = (s: string) =>
    s === 'approved' ? <span className="badge-approved">Approved</span>
    : s === 'rejected' ? <span className="badge-rejected">Rejected</span>
    : <span className="badge-pending">Pending</span>

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  const balCards = balance ? [
    { label: 'Casual',    used: balance.casual_used,    total: balance.casual_total,    color: '#3B82F6' },
    { label: 'Sick',      used: balance.sick_used,      total: balance.sick_total,      color: '#10B981' },
    { label: 'Emergency', used: balance.emergency_used, total: balance.emergency_total, color: '#EF4444' },
    { label: 'Paid',      used: balance.paid_used,      total: balance.paid_total,      color: '#E8531D' },
  ] : []

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leave & WFH</h1>
          <p className="page-subtitle">
            {leaves.filter(l => l.status === 'pending').length + wfh.filter(w => w.status === 'pending').length} pending requests
          </p>
        </div>
        {role === 'employee' && (
          <div className="flex gap-2">
            <button onClick={() => { setModal('wfh'); setError(null) }} className="btn-secondary">
              <Home size={15} /> Request WFH
            </button>
            <button onClick={() => { setModal('leave'); setError(null) }} className="btn-primary">
              <Plus size={15} /> Apply leave
            </button>
          </div>
        )}
      </div>

      {/* Balance cards — employees */}
      {role === 'employee' && balance && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {balCards.map(b => {
            const left = b.total - b.used
            const pct = b.total ? Math.min(100, (b.used / b.total) * 100) : 0
            return (
              <div key={b.label} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{b.label}</p>
                  <Wallet size={13} style={{ color: b.color }} />
                </div>
                <p className="text-2xl font-black" style={{ color: b.color }}>{left}<span className="text-sm text-gray-300 font-bold">/{b.total}</span></p>
                <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${100 - pct}%`, background: b.color }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">{b.used} used · {left} remaining</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('leaves')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            tab === 'leaves' ? 'text-white shadow-lg shadow-brand-500/25' : 'bg-white text-gray-500 border border-gray-200'}`}
          style={tab === 'leaves' ? { background: 'linear-gradient(135deg,#E8531D,#C44010)' } : {}}>
          <Briefcase size={14} /> Leave requests
        </button>
        <button onClick={() => setTab('wfh')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            tab === 'wfh' ? 'text-white shadow-lg shadow-violet-500/25' : 'bg-white text-gray-500 border border-gray-200'}`}
          style={tab === 'wfh' ? { background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)' } : {}}>
          <Home size={14} /> Work from home
        </button>
        <div className="flex-1" />
        {(['all','pending','approved','rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
              filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 border border-gray-200'}`}>
            {statusLabel(f)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {isAdmin && <th>Employee</th>}
                {tab === 'leaves' && <th>Type</th>}
                <th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                  <Calendar size={22} className="mx-auto mb-2 text-gray-300" />
                  No {tab === 'leaves' ? 'leave' : 'WFH'} requests found.
                </td></tr>
              ) : rows.map(r => (
                <tr key={r.id}>
                  {isAdmin && <td className="font-semibold whitespace-nowrap">{r.employees?.name ?? '—'}</td>}
                  {tab === 'leaves' && <td className="whitespace-nowrap">{leaveTypeLabels[(r.leave_type ?? 'casual') as LType]}</td>}
                  <td className="whitespace-nowrap">{formatDate(r.start_date)}</td>
                  <td className="whitespace-nowrap">{formatDate(r.end_date)}</td>
                  <td>{r.total_days ?? getLeaveDays(r.start_date, r.end_date)}d</td>
                  <td className="max-w-[180px] truncate text-gray-400">{r.reason}</td>
                  <td>
                    {badge(r.status)}
                    {r.remarks && <p className="text-[10px] text-gray-400 mt-1 italic">{r.remarks}</p>}
                  </td>
                  {isAdmin && (
                    <td>
                      {r.status === 'pending' && (
                        <div className="flex gap-1.5">
                          <button onClick={() => decide(r.id, tab, 'approved')}
                            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors" title="Approve">
                            <Check size={14} />
                          </button>
                          <button onClick={() => { setRejectId({ id: r.id, kind: tab }); setRemark('') }}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors" title="Reject">
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply modal */}
      <Modal isOpen={!!modal} onClose={() => setModal(null)}
        title={modal === 'leave' ? 'Apply for leave' : 'Request work from home'}>
        <form onSubmit={submit} className="space-y-4">
          {modal === 'leave' && (
            <div>
              <label className="label">Leave type</label>
              <div className="relative">
                <select value={leaveType} onChange={e => setLeaveType(e.target.value as LType)} className="input pr-8 appearance-none">
                  {(Object.keys(leaveTypeLabels) as LType[]).map(t => {
                    const left = balance ? (
                      t === 'casual' ? balance.casual_total - balance.casual_used
                      : t === 'sick' ? balance.sick_total - balance.sick_used
                      : t === 'emergency' ? balance.emergency_total - balance.emergency_used
                      : t === 'paid' ? balance.paid_total - balance.paid_used : null
                    ) : null
                    return <option key={t} value={t}>{leaveTypeLabels[t]}{left !== null ? ` (${left} left)` : ''}</option>
                  })}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="input" required min={format(new Date(), 'yyyy-MM-dd')} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="input" required min={startDate || format(new Date(), 'yyyy-MM-dd')} />
            </div>
          </div>
          {startDate && endDate && (
            <p className="text-sm font-semibold text-brand-600 bg-brand-50 px-3.5 py-2.5 rounded-xl">
              Total: {getLeaveDays(startDate, endDate)} day(s)
            </p>
          )}
          <div>
            <label className="label">Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} className="input resize-none" rows={3}
              placeholder={modal === 'leave' ? 'Briefly describe the reason...' : 'Why do you need to work from home?'} required />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
              <AlertCircle size={15} /> {error}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary flex-1 justify-center">
              {busy && <Spinner size="sm" />} {busy ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reject modal */}
      <Modal isOpen={!!rejectId} onClose={() => setRejectId(null)} title="Reject request" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Remark (optional)</label>
            <textarea value={remark} onChange={e => setRemark(e.target.value)} className="input resize-none" rows={3} placeholder="Reason for rejection..." />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setRejectId(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={() => rejectId && decide(rejectId.id, rejectId.kind, 'rejected', remark)}
              className="btn-danger flex-1 justify-center">Confirm reject</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
