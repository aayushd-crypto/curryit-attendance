import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Plus, Check, X, Calendar, ChevronDown, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/Common/Modal'
import { Spinner } from '../components/Common/Spinner'
import { formatDate, getLeaveDays, statusLabel, logAudit } from '../utils/helpers'
import type { LeaveRequest, LeaveType } from '../types/database'

export default function LeavePage() {
  const { user, profile, role } = useAuth()
  const isAdmin = role === 'admin' || role === 'super_admin'

  const [leaves, setLeaves]       = useState<LeaveRequest[]>([])
  const [loading, setLoading]     = useState(true)
  const [applyOpen, setApplyOpen] = useState(false)
  const [remarkOpen, setRemarkOpen] = useState<string | null>(null)
  const [remark, setRemark]       = useState('')
  const [filter, setFilter]       = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [error, setError]         = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Apply leave form state
  const [leaveType, setLeaveType] = useState<LeaveType>('casual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [reason, setReason]       = useState('')

  const loadLeaves = async () => {
    setLoading(true)
    let query = supabase
      .from('leave_requests')
      .select('*, employees(name, employee_code)')
      .order('created_at', { ascending: false })

    // Employees only see their own leaves
    if (!isAdmin && role !== 'cmk_coordinator') {
      const { data: emp } = await supabase.from('employees').select('id').eq('email', profile?.email ?? '').single()
      if (emp) query = query.eq('employee_id', emp.id)
    }

    const { data } = await query
    setLeaves((data ?? []) as unknown as LeaveRequest[])
    setLoading(false)
  }

  useEffect(() => { loadLeaves() }, [])

  const applyLeave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile) return
    setError(null)
    setSubmitting(true)

    const { data: emp } = await supabase.from('employees').select('id').eq('email', profile.email ?? '').single()
    if (!emp) { setError('Employee record not found.'); setSubmitting(false); return }

    const days = getLeaveDays(startDate, endDate)
    if (days <= 0) { setError('End date must be after start date.'); setSubmitting(false); return }

    const { error: insertError } = await supabase.from('leave_requests').insert({
      employee_id: emp.id,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      total_days: days,
      reason,
      status: 'pending',
    })

    if (insertError) {
      setError('Failed to submit leave. Please try again.')
    } else {
      setApplyOpen(false)
      setLeaveType('casual'); setStartDate(''); setEndDate(''); setReason('')
      await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `Applied ${leaveType} leave for ${days} day(s)` })
      await loadLeaves()
    }
    setSubmitting(false)
  }

  const updateLeave = async (id: string, status: 'approved' | 'rejected', remarks?: string) => {
    if (!user || !profile) return
    await supabase.from('leave_requests').update({ status, remarks: remarks ?? null, approved_by: user.id }).eq('id', id)
    await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `${status} leave request` })
    setRemarkOpen(null)
    setRemark('')
    await loadLeaves()
  }

  const displayed = filter === 'all' ? leaves : leaves.filter(l => l.status === filter)

  const statusBadge = (s: string) => {
    if (s === 'approved') return <span className="badge-approved">Approved</span>
    if (s === 'rejected') return <span className="badge-rejected">Rejected</span>
    return <span className="badge-pending">Pending</span>
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p className="page-subtitle">{leaves.filter(l => l.status === 'pending').length} pending requests</p>
        </div>
        {(role === 'employee') && (
          <button onClick={() => setApplyOpen(true)} className="btn-primary">
            <Plus size={16} />
            Apply leave
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === f ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {statusLabel(f)} {f !== 'all' && `(${leaves.filter(l => l.status === f).length})`}
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
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 6} className="text-center py-10 text-gray-400">
                    <Calendar size={24} className="mx-auto mb-2" />
                    No leave requests found.
                  </td>
                </tr>
              ) : (
                displayed.map(leave => (
                  <tr key={leave.id}>
                    {isAdmin && <td className="font-medium">{(leave as any).employees?.name ?? '—'}</td>}
                    <td>{statusLabel(leave.leave_type)}</td>
                    <td>{formatDate(leave.start_date)}</td>
                    <td>{formatDate(leave.end_date)}</td>
                    <td>{leave.total_days}d</td>
                    <td className="max-w-[200px] truncate text-gray-500">{leave.reason}</td>
                    <td>{statusBadge(leave.status)}</td>
                    {isAdmin && (
                      <td>
                        {leave.status === 'pending' && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => updateLeave(leave.id, 'approved')}
                              className="p-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors"
                              title="Approve"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => { setRemarkOpen(leave.id); setRemark('') }}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
                              title="Reject with remark"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                        {leave.remarks && <p className="text-xs text-gray-400 mt-1 italic">{leave.remarks}</p>}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Leave Modal */}
      <Modal isOpen={applyOpen} onClose={() => setApplyOpen(false)} title="Apply for leave">
        <form onSubmit={applyLeave} className="space-y-4">
          <div>
            <label className="label">Leave type</label>
            <div className="relative">
              <select value={leaveType} onChange={e => setLeaveType(e.target.value as LeaveType)} className="input pr-8 appearance-none">
                <option value="casual">Casual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="emergency">Emergency Leave</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">From date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" required min={format(new Date(), 'yyyy-MM-dd')} />
            </div>
            <div>
              <label className="label">To date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input" required min={startDate || format(new Date(), 'yyyy-MM-dd')} />
            </div>
          </div>
          {startDate && endDate && (
            <p className="text-sm text-brand-600 bg-brand-50 px-3 py-2 rounded-xl">
              Total: <strong>{getLeaveDays(startDate, endDate)} day(s)</strong>
            </p>
          )}
          <div>
            <label className="label">Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} className="input resize-none" rows={3} placeholder="Briefly describe the reason for leave..." required />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setApplyOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
              {submitting ? <Spinner size="sm" /> : null}
              {submitting ? 'Submitting...' : 'Submit request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reject with remark modal */}
      <Modal isOpen={!!remarkOpen} onClose={() => setRemarkOpen(null)} title="Reject leave — add remark" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Rejection remark (optional)</label>
            <textarea value={remark} onChange={e => setRemark(e.target.value)} className="input resize-none" rows={3} placeholder="Reason for rejection..." />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setRemarkOpen(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={() => remarkOpen && updateLeave(remarkOpen, 'rejected', remark)} className="btn-danger flex-1 justify-center">
              Confirm rejection
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
