import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { Spinner } from '../Spinner'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const forgotPassword = async () => {
    if (!email.trim()) { setError('Enter your email above first, then click Forgot password.'); return }
    setError(null)
    const { error } = await (await import('../supabase')).supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/reset-password',
    })
    if (error) setError('Could not send reset email. Check the address and try again.')
    else setResetSent(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setLoading(true)
    const { error } = await signIn(email.trim(), password)
    if (error) { setError('Invalid email or password. Please try again.'); setLoading(false) }
    else navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F2F1EE' }}>

      {/* Subtle background circles */}
      <div className="fixed top-[-120px] right-[-120px] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(232,83,29,0.08) 0%, transparent 70%)' }} />
      <div className="fixed bottom-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(196,64,16,0.06) 0%, transparent 70%)' }} />

      <div className="w-full max-w-md relative">

        {/* Logo + brand */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="CURRYiT" className="h-28 w-auto mx-auto mb-4 drop-shadow-md" />
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Attendance Portal</h1>
          <p className="text-gray-400 text-sm mt-1 font-medium">real taste, real easy.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.10)' }}>

          {resetSent ? (
            <div className="text-center py-6">
              <p className="text-4xl mb-3">📩</p>
              <p className="font-bold text-gray-900 mb-1">Reset link sent!</p>
              <p className="text-gray-400 text-sm">Check your inbox for the password reset link.</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-black text-gray-900 mb-6 tracking-tight">Welcome back 👋</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Email</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required autoComplete="email"
                    placeholder="you@curryit.in"
                    className="input"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      required autoComplete="current-password"
                      placeholder="••••••••"
                      className="input pr-12"
                    />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl font-medium">{error}</p>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-4 text-base rounded-2xl mt-2">
                  {loading ? <Spinner size="sm" /> : <ArrowRight size={17} />}
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>

                <button type="button" onClick={forgotPassword}
                  className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors pt-1">
                  Forgot password?
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-300 mt-6 font-medium">
          © {new Date().getFullYear()} CURRYiT · Attendance Management
        </p>
      </div>
    </div>
  )
}
