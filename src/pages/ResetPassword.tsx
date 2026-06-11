import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { supabase } from '../supabase'
import { Spinner } from '../Spinner'

export default function ResetPasswordPage() {
  const [pw, setPw]         = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [busy, setBusy]     = useState(false)
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (pw.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (pw !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) { setError('Reset failed. The link may have expired — request a new one from the login page.'); setBusy(false) }
    else navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg,#F8F9FF,#F0F2F7)' }}>
      <div className="w-full max-w-sm rounded-3xl p-8 bg-white"
        style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.12)' }}>
        <img src="/logo.png" alt="CURRYiT" className="h-12 w-auto mx-auto mb-6" />
        <div className="flex items-center gap-2.5 mb-6">
          <div className="p-2 rounded-xl" style={{ background: 'rgba(232,83,29,0.08)' }}>
            <KeyRound size={16} style={{ color: '#E8531D' }} />
          </div>
          <div>
            <h1 className="font-black text-gray-900">Set new password</h1>
            <p className="text-xs text-gray-400">Choose a strong password (min 8 characters)</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">New password</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} className="input" required minLength={8} />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="input" required />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full justify-center py-3.5 rounded-2xl">
            {busy && <Spinner size="sm" />} {busy ? 'Saving...' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  )
}
