import { useEffect, useState } from 'react'
import { format, subDays } from 'date-fns'
import { Download, FileSpreadsheet, FileText, ChevronDown, Filter, ClipboardList, BarChart2 } from 'lucide-react'
import { supabase } from '../supabase'
import { Spinner } from '../Spinner'
import { formatDate, formatTime, formatDateTime, statusLabel, exportToExcel, exportToCSV, exportToPDF } from '../helpers'
import { useAuth } from '../AuthContext'

interface ReportRow {
  date: string; employee_code: string; employee_name: string
  department: string; location: string; status: string
  work_mode: string; check_in_time: string; source: string
}
interface AuditEntry {
  id: string; user_name: string; user_role: string; action: string; created_at: string
}

export default function ReportsPage() {
  const { role, profile } = useAuth()
  const isSuperAdmin = role === 'super_admin'
  const [tab, setTab] = useState<'reports' | 'audit'>('reports')

  // ── Reports state ────────────────────────────────────────────────────────
  const [adminDeptId, setAdminDeptId] = useState<string | null>(null)
  const [rows, setRows]       = useState<ReportRow[]>([])
  const [loadingR, setLoadingR] = useState(false)
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [location, setLocation] = useState<'all'|'office'|'cmk'>(role === 'cmk_coordinator' ? 'cmk' : 'all')
  const [statusF, setStatusF] = useState('all')
  const [workModeF, setWorkModeF] = useState('all')

  const loadReport = async () => {
    setLoadingR(true)
    let deptId = adminDeptId
    if (role === 'admin' && deptId === null && profile?.email) {
      try {
        const { data: prof } = await supabase.from('profiles').select('department_id').eq('email', profile.email).maybeSingle()
        deptId = prof?.department_id ?? null; setAdminDeptId(deptId)
      } catch { deptId = null }
    }
    let query = supabase.from('attendance')
      .select('date, status, work_mode, check_in_time, source, location, employees(employee_code, name, department_id, departments(name))')
      .gte('date', dateFrom).lte('date', dateTo).order('date', { ascending: false })
    if (location !== 'all') query = query.eq('location', location)
    if (statusF  !== 'all') query = query.eq('status', statusF)
    if (workModeF !== 'all') query = query.eq('work_mode', workModeF)
    const { data } = await query
    const filtered = deptId ? (data ?? []).filter((r: any) => r.employees?.department_id === deptId) : (data ?? [])
    setRows(filtered.map((r: any) => ({
      date: r.date, employee_code: r.employees?.employee_code ?? '—',
      employee_name: r.employees?.name ?? '—', department: r.employees?.departments?.name ?? '—',
      location: statusLabel(r.location ?? ''), status: statusLabel(r.status ?? ''),
      work_mode: statusLabel(r.work_mode ?? '') || '—',
      check_in_time: r.check_in_time ? formatTime(r.check_in_time) : '—',
      source: statusLabel(r.source ?? ''),
    })))
    setLoadingR(false)
  }

  // ── Audit log state ──────────────────────────────────────────────────────
  const [logs, setLogs]       = useState<AuditEntry[]>([])
  const [loadingA, setLoadingA] = useState(false)
  const [auditSearch, setAuditSearch] = useState('')

  const loadAudit = async () => {
    setLoadingA(true)
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200)
    setLogs((data ?? []) as AuditEntry[])
    setLoadingA(false)
  }

  useEffect(() => { loadReport() }, [])
  useEffect(() => { if (tab === 'audit' && logs.length === 0) loadAudit() }, [tab])

  const roleColor = (r: string) => {
    if (r === 'super_admin') return 'bg-purple-50 text-purple-700'
    if (r === 'admin')       return 'bg-blue-50 text-blue-700'
    if (r === 'cmk_coordinator') return 'bg-amber-50 text-amber-700'
    return 'bg-gray-50 text-gray-700'
  }

  const filteredLogs = auditSearch
    ? logs.filter(l => l.user_name?.toLowerCase().includes(auditSearch.toLowerCase()) || l.action?.toLowerCase().includes(auditSearch.toLowerCase()))
    : logs

  const exportData = rows.map(r => ({
    'Date': formatDate(r.date), 'Employee ID': r.employee_code, 'Employee Name': r.employee_name,
    'Department': r.department, 'Location': r.location, 'Status': r.status,
    'Work Mode': r.work_mode, 'Check-in Time': r.check_in_time, 'Source': r.source,
  }))
  const filename = `CURRYiT_Attendance_${dateFrom}_to_${dateTo}`

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="page-header flex-wrap gap-2">
        <div>
          <h1 className="page-title">{tab === 'reports' ? 'Reports' : 'Audit Log'}</h1>
          <p className="page-subtitle">{tab === 'reports' ? `${rows.length} records` : `${filteredLogs.length} entries`}</p>
        </div>
        {tab === 'reports' && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => exportToExcel(exportData, filename)} disabled={!rows.length} className="btn-secondary disabled:opacity-50">
              <FileSpreadsheet size={15} className="text-green-600" /> Excel
            </button>
            <button onClick={() => exportToCSV(exportData, filename)} disabled={!rows.length} className="btn-secondary disabled:opacity-50">
              <Download size={15} /> CSV
            </button>
            <button onClick={() => exportToPDF(`Attendance Report — ${formatDate(dateFrom)} to ${formatDate(dateTo)}`,
              ['Date','Emp ID','Name','Department','Location','Status','Work Mode','Check-in','Source'],
              rows.map(r => [formatDate(r.date), r.employee_code, r.employee_name, r.department, r.location, r.status, r.work_mode, r.check_in_time, r.source]),
              filename)} disabled={!rows.length} className="btn-primary disabled:opacity-50">
              <FileText size={15} /> PDF
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl bg-gray-100" style={{ width: 'fit-content' }}>
        {[
          { key: 'reports', label: 'Attendance Report', icon: BarChart2 },
          ...(isSuperAdmin || role === 'admin' ? [{ key: 'audit', label: 'Audit Log', icon: ClipboardList }] : []),
        ].map((item) => { const { key, label, icon: Icon } = item as any; const labelShort = (item as any).labelShort ?? label; return (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{labelShort}</span>
          </button>
        )})}
      </div>

      {/* ── REPORTS TAB ── */}
      {tab === 'reports' && (
        <>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
              <Filter size={15} /> Filters
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div><label className="label">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" /></div>
              <div><label className="label">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input" /></div>
              <div><label className="label">Location</label>
                <div className="relative">
                  <select value={location} onChange={e => setLocation(e.target.value as any)} className="input pr-8 appearance-none" disabled={role === 'cmk_coordinator'}>
                    <option value="all">All</option><option value="office">Office</option><option value="cmk">CMK</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div></div>
              <div><label className="label">Status</label>
                <div className="relative">
                  <select value={statusF} onChange={e => setStatusF(e.target.value)} className="input pr-8 appearance-none">
                    <option value="all">All</option><option value="present">Present</option>
                    <option value="absent">Absent</option><option value="leave">Leave</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div></div>
              <div><label className="label">Work mode</label>
                <div className="relative">
                  <select value={workModeF} onChange={e => setWorkModeF(e.target.value)} className="input pr-8 appearance-none">
                    <option value="all">All</option><option value="office">In Office</option><option value="remote">Remote</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div></div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={loadReport} disabled={loadingR} className="btn-primary">
                {loadingR ? <Spinner size="sm" /> : <Filter size={15} />} {loadingR ? 'Loading…' : 'Apply filters'}
              </button>
            </div>
          </div>

          {rows.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total records', val: rows.length, cls: 'text-gray-900' },
                { label: 'Present / Remote', val: rows.filter(r => r.status === 'Present' || r.work_mode === 'Remote').length, cls: 'text-green-700' },
                { label: 'Absent', val: rows.filter(r => r.status === 'Absent').length, cls: 'text-red-700' },
                { label: 'On leave', val: rows.filter(r => r.status === 'On Leave').length, cls: 'text-orange-700' },
              ].map(s => (
                <div key={s.label} className="card p-4 text-center">
                  <p className={`text-2xl font-bold ${s.cls}`}>{s.val}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="card overflow-hidden">
            {loadingR ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead><tr>
                    <th>Date</th><th>Emp ID</th><th>Name</th><th>Department</th>
                    <th>Location</th><th>Status</th><th>Work Mode</th><th>Check-in</th><th>Source</th>
                  </tr></thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-400">No records found.</td></tr>
                    ) : rows.map((r, i) => (
                      <tr key={i}>
                        <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                        <td className="font-mono text-xs text-gray-500">{r.employee_code}</td>
                        <td className="font-medium text-gray-900 whitespace-nowrap">{r.employee_name}</td>
                        <td className="text-gray-500">{r.department}</td>
                        <td><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.location === 'CMK' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{r.location}</span></td>
                        <td>{r.status === 'Present' ? <span className="badge-present">Present</span> : r.status === 'Absent' ? <span className="badge-absent">Absent</span> : r.status === 'On Leave' ? <span className="badge-leave">On Leave</span> : <span className="badge-pending">{r.status}</span>}</td>
                        <td className="text-gray-500">{r.work_mode}</td>
                        <td className="text-gray-500">{r.check_in_time}</td>
                        <td className="text-gray-400 text-xs">{r.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── AUDIT LOG TAB ── */}
      {tab === 'audit' && (
        <>
          <div className="card p-4">
            <input value={auditSearch} onChange={e => setAuditSearch(e.target.value)}
              className="input" placeholder="Search by name or action…" />
          </div>
          <div className="card overflow-hidden">
            {loadingA ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px]">
                  <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th></tr></thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-12 text-gray-400">No audit entries found.</td></tr>
                    ) : filteredLogs.map(l => (
                      <tr key={l.id}>
                        <td className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                        <td className="font-medium text-gray-900">{l.user_name}</td>
                        <td><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${roleColor(l.user_role)}`}>{l.user_role?.replace('_', ' ')}</span></td>
                        <td className="text-gray-700">{l.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
