import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Spinner } from '../Spinner'
import { formatDateTime } from '../helpers'
import { ClipboardList } from 'lucide-react'

interface AuditEntry {
  id: string
  user_name: string
  user_role: string
  action: string
  created_at: string
}

export default function AuditLogPage() {
  const [logs, setLogs]     = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => { setLogs((data ?? []) as AuditEntry[]); setLoading(false) })
  }, [])

  const roleColor = (role: string) => {
    if (role === 'super_admin') return 'bg-purple-50 text-purple-700'
    if (role === 'admin') return 'bg-blue-50 text-blue-700'
    if (role === 'cmk_coordinator') return 'bg-amber-50 text-amber-700'
    return 'bg-gray-50 text-gray-700'
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Last 200 system actions</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">
                  <ClipboardList size={24} className="mx-auto mb-2" />
                  No audit log entries yet.
                </td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td className="text-xs text-gray-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="font-medium text-gray-900">{log.user_name}</td>
                    <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColor(log.user_role)}`}>{log.user_role.replace('_', ' ')}</span></td>
                    <td className="text-gray-600">{log.action}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
