import { Moon, Sun } from 'lucide-react'
import { useTheme } from './useTheme'

export function DarkModeToggle() {
  const { dark, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="fixed bottom-6 right-6 z-50 group flex items-center gap-2.5 px-3 py-2.5 rounded-2xl
                 transition-all duration-300 hover:scale-105 active:scale-95"
      style={{
        background: dark
          ? 'linear-gradient(135deg, #1e2d4a 0%, #162038 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f0f2f7 100%)',
        boxShadow: dark
          ? '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,120,200,0.15), inset 0 1px 0 rgba(255,255,255,0.06)'
          : '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
      }}>

      {/* Icon */}
      <div className="w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-300"
        style={{
          background: dark
            ? 'linear-gradient(135deg, #E8531D, #C44010)'
            : 'linear-gradient(135deg, #1a1a2e, #0f3460)',
          boxShadow: dark
            ? '0 3px 12px rgba(232,83,29,0.5)'
            : '0 3px 12px rgba(15,52,96,0.4)',
        }}>
        {dark
          ? <Sun size={14} className="text-white" />
          : <Moon size={14} className="text-white" />}
      </div>

      {/* Toggle switch */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold"
          style={{ color: dark ? '#6b7a9a' : '#9ca3af' }}>
          {dark ? 'Light' : 'Dark'}
        </span>
        {/* Switch pill */}
        <div className="w-9 h-5 rounded-full relative transition-colors duration-300"
          style={{ background: dark ? '#E8531D' : '#d1d5db' }}>
          <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300"
            style={{ left: dark ? '18px' : '2px', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
        </div>
      </div>
    </button>
  )
}
