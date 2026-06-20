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
    if (!email.trim()) { setError('Enter your email above first.'); return }
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
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #1a0a00 0%, #0d0d1a 40%, #0f1a2e 100%)' }}>

      {/* Background orbs */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #E8531D 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-80px] right-[-80px] w-[400px] h-[400px] rounded-full opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #C44010 0%, transparent 70%)' }} />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* Single centred card */}
      <div className="relative z-10 w-full max-w-md">

        {/* Logo + brand */}
        <div className="text-center mb-10">
          <img src="/logo.png" alt="CURRYiT" className="h-24 w-auto mx-auto mb-4 drop-shadow-2xl" />
          <p className="text-white/30 text-[10px] font-bold uppercase tracking-[4px] mb-6">real taste, real easy.</p>
          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-[3px] mb-2">Attendance Portal</p>
          <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
            People first.<br />
            <span style={{
              background: 'linear-gradient(135deg, #E8531D 0%, #ff9a5c 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>Always.</span>
          </h1>
        </div>

        {/* Form */}
        {resetSent ? (
          <div className="text-center py-8 px-4 rounded-2xl"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <p className="text-3xl mb-3">📩</p>
            <p className="font-bold text-emerald-400 mb-1">Reset link sent!</p>
            <p className="text-white/40 text-sm">Check your inbox for the password reset link.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" placeholder="you@curryit.in"
                className="w-full px-4 py-3.5 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={e => { e.target.style.border = '1px solid rgba(232,83,29,0.6)'; e.target.style.background = 'rgba(255,255,255,0.09)' }}
                onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(255,255,255,0.07)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password" placeholder="••••••••"
                  className="w-full px-4 py-3.5 rounded-xl text-sm text-white placeholder-white/20 outline-none pr-12 transition-all"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => { e.target.style.border = '1px solid rgba(232,83,29,0.6)'; e.target.style.background = 'rgba(255,255,255,0.09)' }}
                  onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(255,255,255,0.07)' }}
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl text-sm font-medium text-red-300"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-sm text-white transition-all"
              style={{
                background: loading ? 'rgba(232,83,29,0.5)' : 'linear-gradient(135deg, #E8531D 0%, #C44010 100%)',
                boxShadow: loading ? 'none' : '0 8px 32px rgba(232,83,29,0.4)',
              }}>
              {loading ? <Spinner size="sm" /> : <ArrowRight size={16} />}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <button type="button" onClick={forgotPassword}
              className="w-full text-center text-xs text-white/30 hover:text-white/60 transition-colors py-1">
              Forgot password?
            </button>
          </form>
        )}

        <p className="text-center text-white/15 text-[10px] font-medium mt-8">
          © {new Date().getFullYear()} CURRYiT · Attendance Management
        </p>
        <p className="text-center text-white/20 text-[10px] mt-1">
          Designed & Developed by <span className="font-semibold text-white/30">Aayush Dhiman</span>
        </p>
      </div>
    </div>
  )
}
