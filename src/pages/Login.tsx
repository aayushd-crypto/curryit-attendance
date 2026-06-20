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
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a0a00 0%, #0d0d1a 40%, #0f1a2e 100%)' }}>

      {/* Background orbs — full screen */}
      <div className="absolute top-[-80px] left-[-80px] w-[500px] h-[500px] rounded-full opacity-30 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #E8531D 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-100px] right-[-60px] w-[400px] h-[400px] rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #C44010 0%, transparent 70%)' }} />
      <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #ff9a5c 0%, transparent 70%)' }} />

      {/* Dot grid */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-between p-14 relative z-10 items-center">

        {/* Top — logo + tagline */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <img src="/logo.png" alt="CURRYiT" className="h-16 w-auto drop-shadow-lg" />
          </div>
          <p className="text-white/30 text-xs font-semibold uppercase tracking-[3px]">real taste, real easy.</p>
        </div>

        {/* Middle — hero text */}
        <div className="py-8">
          <p className="text-[11px] font-bold text-orange-400 uppercase tracking-[3px] mb-4">Attendance Portal</p>
          <h1 className="text-5xl font-black text-white leading-[1.08] tracking-tight mb-6">
            People first.<br />
            <span style={{
              background: 'linear-gradient(135deg, #E8531D 0%, #ff9a5c 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>Always.</span>
          </h1>
          <p className="text-white/50 text-base leading-relaxed max-w-sm">
            One place to track attendance, manage leaves, and keep your team running — just like a well-spiced curry.
          </p>
        </div>
        <p className="text-white/20 text-[11px] font-medium mt-6">
          © {new Date().getFullYear()} CURRYiT · Attendance Management System
        </p>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative z-10">

        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center gap-2 mb-10">
            <img src="/logo.png" alt="CURRYiT" className="h-20 w-auto drop-shadow-lg" />
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-[3px]">Attendance Portal</p>
          </div>

          <h2 className="text-3xl font-black text-white mb-1 tracking-tight">Welcome back</h2>
          <p className="text-white/40 text-sm mb-8 font-medium">Sign in to manage your team</p>

          {resetSent ? (
            <div className="text-center py-8 px-4 rounded-2xl"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <p className="text-3xl mb-3">📩</p>
              <p className="font-bold text-emerald-400 mb-1">Reset link sent!</p>
              <p className="text-white/40 text-sm">Check your inbox for the password reset link.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Email */}
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

              {/* Password */}
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
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-sm text-white transition-all mt-2"
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
        </div>
      </div>
    </div>
  )
}
