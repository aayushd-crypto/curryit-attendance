import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Plus, Check, X, Calendar, AlertCircle, Briefcase, Wallet } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { Modal } from '../Modal'
import { Spinner } from '../Spinner'
import { formatDate, getLeaveDays, statusLabel, logAudit } from '../helpers'

type LType = 'casual'

interface Req {
  id: string; employee_id: string; leave_type?: string
  start_date: string; end_date: string; total_days?: number
  reason: string; status: string; remarks: string | null
  employees?: { name: string }
}
interface Balance {
  casual_total: number; casual_used: number
}

const leaveTypeLabels: Record<LType, string> = {
  casual: 'Casual Leave',
}

export default function LeavePage() {
  const { user, profile, role } = useAuth()
  const isAdmin = role === 'admin' || role === 'super_admin'

  const [leaves, setLeaves]     = useState<Req[]>([])
  const [balance, setBalance]   = useState<Balance | null>(null)
  const [empId, setEmpId]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [remark, setRemark]     = useState('')
  const [filter, setFilter]     = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [error, setError]       = useState<string | null>(null)
  const [busy, setBusy]           = useState(false)
  const [decideError, setDecideError] = useState<string | null>(null)

  // form
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
    if (!isAdmin && myEmpId) lq = lq.eq('employee_id', myEmpId)

    const { data: l } = await lq
    setLeaves((l ?? []) as Req[])

    if (myEmpId) {
      const { data: bal } = await supabase.from('leave_balances').select('casual_total, casual_used')
        .eq('employee_id', myEmpId).eq('year', new Date().getFullYear()).maybeSingle()
      setBalance(bal as Balance | null)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.email])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile || !empId) { setError('Your account is not linked to an employee record. Contact admin.'); return }
    setBusy(true); setError(null)
    const days = getLeaveDays(startDate, endDate)
    if (days <= 0) { setError('End date must be on or after start date.'); setBusy(false); return }

    // Balance check: block if no balance row or not enough casual leaves
    if (!balance) {
      setError('Leave balance not set up for your account. Please contact admin.')
      setBusy(false); return
    }
    const remaining = balance.casual_total - balance.casual_used
    if (days > remaining) {
      setError(`Not enough casual leave balance. You have ${remaining} day(s) remaining but requested ${days}.`)
      setBusy(false); return
    }

    const { error: err } = await supabase.from('leave_requests').insert({
      employee_id: empId, leave_type: 'casual', start_date: startDate,
      end_date: endDate, total_days: days, reason, status: 'pending',
    })
    if (err) setError('Failed to submit. Please try again.')
    else {
      await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!,
        action: `Applied casual leave (${days}d)` })
      setModal(false); setStartDate(''); setEndDate(''); setReason('')
      await load()
    }
    setBusy(false)
  }

  const decide = async (id: string, status: 'approved' | 'rejected', remarks?: string) => {
    if (!user || !profile) return
    setDecideError(null)
    const { error: err } = await supabase.from('leave_requests').update({ status, remarks: remarks ?? null, approved_by: user.id }).eq('id', id)
    if (err) { setDecideError('Failed to update leave request. Please try again.'); return }
    await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `${status} leave request` })
    setRejectId(null); setRemark('')
    await load()
  }

  const rows = leaves.filter(r => filter === 'all' || r.status === filter)

  const badge = (s: string) =>
    s === 'approved' ? <span className="badge-approved">Approved</span>
    : s === 'rejected' ? <span className="badge-rejected">Rejected</span>
    : <span className="badge-pending">Pending</span>

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  const casualRemaining = balance ? balance.casual_total - balance.casual_used : 0

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leave</h1>
          <p className="page-subtitle">{leaves.filter(l => l.status === 'pending').length} pending requests</p>
        </div>
        {(role === 'employee' || role === 'cmk_coordinator') && (
          <button onClick={() => { setModal(true); setError(null) }} className="btn-primary">
            <Plus size={15} /> Apply leave
          </button>
        )}
      </div>

      {/* Casual leave balance card — employees */}
      {(role === 'employee' || role === 'cmk_coordinator') && balance && (
        <div className="card p-5 flex items-center gap-6">
          <div className="p-3 rounded-xl bg-blue-50">
            <Wallet size={20} className="text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Casual Leave Balance</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-black text-blue-600">{casualRemaining}</p>
              <p className="text-sm text-gray-400 mb-1">/ {balance.casual_total} days remaining</p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden w-full max-w-xs">
              <div className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${balance.casual_total ? Math.min(100, (casualRemaining / balance.casual_total) * 100) : 0}%` }} />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">{balance.casual_used} used · {casualRemaining} remaining</p>
          </div>
          {casualRemaining === 0 && (
            <div className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg">No leaves left</div>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg shadow-brand-500/25"
          style={{ background: 'linear-gradient(135deg,#E8531D,#C44010)' }}>
          <Briefcase size={14} /> Leave requests
        </div>
        <div className="flex-1" />
        {(['all','pending','approved','rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
              filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 border border-gray-200'}`}>
            {statusLabel(f)}
          </button>
        ))}
      </div>

      {decideError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
          <AlertCircle size={15} /> {decideError}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {isAdmin && <th>Employee</th>}
                <th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                  <Calendar size={22} className="mx-auto mb-2 text-gray-300" />
                  No leave requests found.
                </td></tr>
              ) : rows.map(r => (
                <tr key={r.id}>
                  {isAdmin && <td className="font-semibold whitespace-nowrap">{r.employees?.name ?? '—'}</td>}
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
                          <button onClick={() => decide(r.id, 'approved')}
                            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors" title="Approve">
                            <Check size={14} />
                          </button>
                          <button onClick={() => { setRejectId(r.id); setRemark('') }}
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

      {/* Apply leave modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Apply for casual leave">
        <form onSubmit={submit} className="space-y-4">
          <div className="px-3.5 py-2.5 rounded-xl bg-blue-50 text-sm text-blue-700 font-medium">
            Casual Leave · {casualRemaining} day(s) remaining
          </div>
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
              placeholder="Briefly describe the reason..." required />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
              <AlertCircle size={15} /> {error}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={busy || casualRemaining === 0} className="btn-primary flex-1 justify-center">
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
            <button onClick={() => rejectId && decide(rejectId, 'rejected', remark)}
              className="btn-danger flex-1 justify-center">Confirm reject</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
