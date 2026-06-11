import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { Spinner } from '../Spinner'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setLoading(true)
    const { error } = await signIn(email.trim(), password)
    if (error) { setError('Invalid email or password. Please try again.'); setLoading(false) }
    else navigate('/dashboard')
  }

  const features = ['Office & CMK attendance', 'Leave management', 'Real-time reports', 'Role-based access']

  return (
    <div className="min-h-screen flex" style={{ background: '#0f0f1a' }}>

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col items-center justify-center p-16 relative overflow-hidden">
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #E8531D, transparent)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{ background: 'radial-gradient(circle, #7C3AED, transparent)' }} />
        <div className="absolute top-3/4 left-1/3 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: 'radial-gradient(circle, #0EA5E9, transparent)' }} />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative z-10 text-center max-w-md">
          <img src="/logo.png" alt="CURRYiT" className="h-24 w-auto mx-auto mb-10 drop-shadow-2xl" />

          <h1 className="text-5xl font-black text-white mb-4 leading-[1.1] tracking-tight">
            Smarter<br />
            <span style={{ background: 'linear-gradient(135deg, #E8531D, #FF8C5A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Attendance
            </span>
          </h1>
          <p className="text-white/50 text-lg leading-relaxed mb-10">
            One platform for your entire team — from office to CMK.
          </p>

          <div className="grid grid-cols-2 gap-3 text-left">
            {features.map(f => (
              <div key={f} className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CheckCircle2 size={15} style={{ color: '#E8531D', flexShrink: 0 }} />
                <span className="text-xs font-semibold text-white/70">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(135deg, #F8F9FF 0%, #F0F2F7 100%)' }}>
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <img src="/logo.png" alt="CURRYiT" className="h-14 w-auto mx-auto" />
          </div>

          <div className="rounded-3xl p-8"
            style={{
              background: 'rgba(255,255,255,0.95)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.8)',
              border: '1px solid rgba(255,255,255,0.9)',
            }}>
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
                style={{ background: 'rgba(232,83,29,0.08)', border: '1px solid rgba(232,83,29,0.15)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">Secure Login</span>
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-1 tracking-tight">Welcome back</h2>
              <p className="text-gray-400 text-sm">Sign in to your CURRYiT account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="input" placeholder="you@curryit.in" required autoComplete="email" />
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} className="input pr-12"
                    placeholder="Enter your password" required autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm text-red-600"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <span>⚠</span> {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3.5 rounded-2xl text-base mt-2">
                {loading ? <Spinner size="sm" /> : <ArrowRight size={18} />}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6">
              Forgot your password? Contact your admin.
            </p>
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            © {new Date().getFullYear()} Homechef India Ventures Pvt. Ltd.
          </p>
        </div>
      </div>
    </div>
  )
}
