import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  CheckCircle2, Clock, Building2, Wifi, CalendarDays, AlertCircle,
  LogIn, LogOut, Timer, Zap, Lock
} from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { Spinner } from '../Spinner'
import { formatDate, formatTime, logAudit } from '../helpers'

interface AttRecord {
  id: string; status: string; work_mode: string | null
  check_in_time: string | null; check_out_time: string | null
  worked_minutes: number; overtime_minutes: number; date: string
}

const fmtMins = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`

export default function AttendancePage() {
  const { user, profile, role } = useAuth()
  const [todayRecord, setTodayRecord] = useState<AttRecord | null>(null)
  const [history, setHistory]   = useState<AttRecord[]>([])
  const [workMode, setWorkMode] = useState<'office' | 'remote'>('office')
  const [wfhApproved, setWfhApproved] = useState(false)
  const [empId, setEmpId]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [now, setNow]           = useState(new Date())
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const load = async () => {
    if (!user) return
    setLoading(true)
    const { data: emp } = await supabase.from('employees').select('id').eq('email', profile?.email ?? '').maybeSingle()
    if (!emp) { setLoading(false); return }
    setEmpId(emp.id)

    const [{ data: today }, { data: hist }, { data: wfh }] = await Promise.all([
      supabase.from('attendance').select('*').eq('employee_id', emp.id).eq('date', todayStr).maybeSingle(),
      supabase.from('attendance').select('*').eq('employee_id', emp.id).order('date', { ascending: false }).limit(30),
      supabase.from('wfh_requests').select('id').eq('employee_id', emp.id).eq('status', 'approved')
        .lte('start_date', todayStr).gte('end_date', todayStr).limit(1),
    ])
    setTodayRecord(today ?? null)
    setHistory(hist ?? [])
    setWfhApproved((wfh ?? []).length > 0)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const checkIn = async () => {
    if (!user || !profile || !empId) return
    setBusy(true); setError(null)
    const { data: emp } = await supabase.from('employees').select('location').eq('id', empId).single()
    const { error: e } = await supabase.from('attendance').insert({
      employee_id: empId, date: todayStr, check_in_time: '00:00:00',
      location: emp?.location ?? 'office', work_mode: workMode,
      status: 'present', source: 'self_marked', marked_by: user.id,
    })
    if (e) {
      if (e.message?.includes('WFH_NOT_APPROVED')) setError('Remote check-in needs an approved Work From Home request. Apply from the Leave page.')
      else if (e.code === '23505') setError('Already checked in today.')
      else setError('Check-in failed. Please try again.')
    } else {
      await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: `Checked in — ${workMode}` })
      await load()
    }
    setBusy(false)
  }

  const checkOut = async () => {
    if (!user || !profile || !todayRecord) return
    setBusy(true); setError(null)
    const { error: e } = await supabase.from('attendance')
      .update({ check_out_time: '00:00:00' })
      .eq('id', todayRecord.id)
    if (e) {
      setError(e.message?.includes('ALREADY_CHECKED_OUT') ? 'You already checked out today.' : 'Check-out failed. Please try again.')
    } else {
      await logAudit({ userId: user.id, userName: profile.full_name, userRole: role!, action: 'Checked out' })
      await load()
    }
    setBusy(false)
  }

  // live worked time while checked in
  const liveWorked = (() => {
    if (!todayRecord?.check_in_time || todayRecord.check_out_time) return null
    const [h, m, s] = todayRecord.check_in_time.split(':').map(Number)
    const start = new Date(); start.setHours(h, m, s ?? 0, 0)
    return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000))
  })()

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  const checkedIn  = !!todayRecord
  const checkedOut = !!todayRecord?.check_out_time

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">{formatDate(todayStr)} · {format(now, 'hh:mm:ss a')}</p>
        </div>
      </div>

      {/* Main card */}
      <div className="card-elevated rounded-3xl p-7">
        {!checkedIn && (
          <>
            <h2 className="font-black text-gray-900 text-xl mb-1 tracking-tight">Check in</h2>
            <p className="text-sm text-gray-400 mb-6">Time is recorded by the server — it cannot be edited later.</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button onClick={() => setWorkMode('office')}
                className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                  workMode === 'office' ? 'border-brand-500 shadow-xl shadow-brand-500/15' : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'}`}>
                <div className="p-3 rounded-xl" style={{ background: workMode === 'office' ? 'linear-gradient(135deg,#E8531D,#C44010)' : '#E5E7EB' }}>
                  <Building2 size={22} className={workMode === 'office' ? 'text-white' : 'text-gray-400'} />
                </div>
                <p className={`font-bold text-sm ${workMode === 'office' ? 'text-brand-700' : 'text-gray-500'}`}>In Office</p>
              </button>

              <button onClick={() => wfhApproved && setWorkMode('remote')}
                className={`relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                  !wfhApproved ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                  : workMode === 'remote' ? 'border-violet-500 shadow-xl shadow-violet-500/15' : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'}`}>
                {!wfhApproved && <Lock size={13} className="absolute top-3 right-3 text-gray-400" />}
                <div className="p-3 rounded-xl" style={{ background: workMode === 'remote' && wfhApproved ? 'linear-gradient(135deg,#8B5CF6,#7C3AED)' : '#E5E7EB' }}>
                  <Wifi size={22} className={workMode === 'remote' && wfhApproved ? 'text-white' : 'text-gray-400'} />
                </div>
                <p className={`font-bold text-sm ${workMode === 'remote' && wfhApproved ? 'text-violet-700' : 'text-gray-500'}`}>Remote</p>
                {!wfhApproved && <p className="text-[10px] text-gray-400 -mt-2">Needs WFH approval</p>}
              </button>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm text-red-600"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {error}
              </div>
            )}

            <button onClick={checkIn} disabled={busy} className="btn-primary w-full justify-center py-4 rounded-2xl text-base">
              {busy ? <Spinner size="sm" /> : <LogIn size={19} />}
              {busy ? 'Checking in...' : 'Check In'}
            </button>
          </>
        )}

        {checkedIn && !checkedOut && (
          <div className="text-center py-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Working now</span>
            </div>

            <p className="text-5xl font-black text-gray-900 tracking-tight mb-1 tabular-nums">
              {liveWorked !== null ? fmtMins(liveWorked) : '—'}
            </p>
            <p className="text-sm text-gray-400 mb-1">
              Checked in at {formatTime(todayRecord!.check_in_time ?? '')} · {todayRecord!.work_mode === 'remote' ? '🏠 Remote' : '🏢 Office'}
            </p>
            {liveWorked !== null && liveWorked > 480 && (
              <p className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 mb-4">
                <Zap size={12} /> Overtime: {fmtMins(liveWorked - 480)}
              </p>
            )}

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-600 text-left"
                style={{ background: 'rgba(239,68,68,0.06)' }}>{error}</div>
            )}

            <button onClick={checkOut} disabled={busy}
              className="w-full justify-center py-4 rounded-2xl text-base inline-flex items-center gap-2 font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg,#374151,#1F2937)', boxShadow: '0 4px 15px rgba(0,0,0,0.25)' }}>
              {busy ? <Spinner size="sm" /> : <LogOut size={19} />}
              {busy ? 'Checking out...' : 'Check Out'}
            </button>
            <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1.5">
              <Clock size={11} /> Standard day: 8 hours · overtime counted automatically
            </p>
          </div>
        )}

        {checkedOut && (
          <div className="text-center py-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: 'linear-gradient(135deg,#D1FAE5,#A7F3D0)', boxShadow: '0 8px 30px rgba(16,185,129,0.2)' }}>
              <CheckCircle2 size={38} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-3">Day complete!</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Check in',  val: formatTime(todayRecord!.check_in_time ?? '') },
                { label: 'Check out', val: formatTime(todayRecord!.check_out_time ?? '') },
                { label: 'Worked',    val: fmtMins(todayRecord!.worked_minutes) },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-2xl bg-gray-50">
                  <p className="text-sm font-black text-gray-900">{s.val}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            {todayRecord!.overtime_minutes > 0 && (
              <p className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full text-xs font-bold text-amber-700"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Zap size={12} /> Overtime today: {fmtMins(todayRecord!.overtime_minutes)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="table-header">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(232,83,29,0.08)' }}>
              <CalendarDays size={15} style={{ color: '#E8531D' }} />
            </div>
            <h3 className="font-bold text-gray-900">Last 30 days</h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
            <Timer size={13} />
            Total OT: {fmtMins(history.reduce((a, r) => a + (r.overtime_minutes || 0), 0))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th>Date</th><th>Status</th><th>In</th><th>Out</th><th>Hours</th><th>OT</th></tr></thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No records yet.</td></tr>
              ) : history.map(r => (
                <tr key={r.id}>
                  <td className="font-semibold whitespace-nowrap">{formatDate(r.date)}</td>
                  <td>
                    {r.status === 'present' && r.work_mode !== 'remote' && <span className="badge-present">Present</span>}
                    {r.work_mode === 'remote' && <span className="badge-remote">Remote</span>}
                    {r.status === 'absent' && <span className="badge-absent">Absent</span>}
                    {r.status === 'leave' && <span className="badge-leave">Leave</span>}
                  </td>
                  <td className="text-gray-400">{r.check_in_time ? formatTime(r.check_in_time) : '—'}</td>
                  <td className="text-gray-400">{r.check_out_time ? formatTime(r.check_out_time) : '—'}</td>
                  <td className="text-gray-500 font-medium">{r.worked_minutes ? fmtMins(r.worked_minutes) : '—'}</td>
                  <td>{r.overtime_minutes > 0
                    ? <span className="text-xs font-bold text-amber-600">+{fmtMins(r.overtime_minutes)}</span>
                    : <span className="text-gray-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
