import { useRef, useEffect } from 'react'
import { FOOD_EMOJIS, INITIALS_MODE, getInitials } from './useUserAvatar'

interface Props {
  current: string
  name: string | null | undefined
  onPick: (v: string) => void
  onClose: () => void
}

export function EmojiPicker({ current, name, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const initials = getInitials(name)
  const isInitialsMode = current === INITIALS_MODE

  return (
    <div ref={ref}
      className="absolute bottom-full mb-2 left-0 z-50 p-3 rounded-2xl shadow-2xl"
      style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', width: '204px' }}>
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2 px-0.5">
        Your avatar
      </p>

      {/* Name initials option */}
      <button
        onClick={() => { onPick(INITIALS_MODE); onClose() }}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl mb-2 transition-all"
        style={{
          background: isInitialsMode ? 'rgba(232,83,29,0.25)' : 'rgba(255,255,255,0.06)',
          outline: isInitialsMode ? '2px solid #E8531D' : 'none',
        }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#E8531D,#C44010)' }}>
          {initials}
        </div>
        <div className="text-left">
          <p className="text-xs font-bold text-white">{initials} — Name initials</p>
          <p className="text-[10px] text-white/40">Default</p>
        </div>
        {isInitialsMode && <span className="ml-auto text-orange-400 text-xs">✓</span>}
      </button>

      <div className="w-full h-px bg-white/10 mb-2" />

      {/* Food emojis grid */}
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5 px-0.5">
        Food emojis
      </p>
      <div className="grid grid-cols-6 gap-1">
        {FOOD_EMOJIS.map(e => (
          <button key={e} onClick={() => { onPick(e); onClose() }}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-base transition-all hover:scale-110"
            style={{
              background: current === e ? 'rgba(232,83,29,0.4)' : 'rgba(255,255,255,0.06)',
              outline: current === e ? '2px solid #E8531D' : 'none',
            }}>
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
