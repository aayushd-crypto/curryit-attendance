import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { Spinner } from '../Spinner'
import { supabase } from '../supabase'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setLoading(true)
    const { error } = await signIn(email.trim(), password)
    if (error) { setError('Incorrect email or password.'); setLoading(false) }
    else navigate('/dashboard')
  }

  const forgotPassword = async () => {
    if (!email.trim()) { setError('Enter your email first, then tap Forgot password.'); return }
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/reset-password',
    })
    if (error) setError('Could not send reset email. Check the address.')
    else setResetSent(true)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: '#F5F5F7' }}>

      <img src="/logo.png" alt="CURRYiT" className="h-16 w-auto mb-8" />

      <div className="w-full max-w-[380px] rounded-3xl p-8 bg-white"
        style={{ border: '0.5px solid rgba(0,0,0,0.07)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

        <h1 className="text-[26px] font-bold text-gray-900 tracking-tight mb-1">Sign in</h1>
        <p className="text-[15px] text-gray-400 mb-7">to CURRYiT Attendance</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="input" placeholder="you@curryit.in" required autoComplete="email" />
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} className="input pr-12"
                placeholder="••••••••" required autoComplete="current-password" />
              <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
          )}
          {resetSent && (
            <p className="text-sm text-green-700 bg-green-50 px-4 py-3 rounded-xl">
              Reset link sent — check your inbox.
            </p>
          )}

          <button type="submit" disabled={loading}
            className="btn-primary w-full py-3.5 text-[16px] mt-1">
            {loading && <Spinner size="sm" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <button type="button" onClick={forgotPassword}
          className="block mx-auto text-[13px] font-medium text-brand-600 hover:text-brand-700 mt-5">
          Forgot password?
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-8">
        © {new Date().getFullYear()} Homechef India Ventures Pvt. Ltd.
      </p>
    </div>
  )
}
