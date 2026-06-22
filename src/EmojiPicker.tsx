import { useRef, useEffect } from 'react'
import { FOOD_EMOJIS } from './useUserAvatar'

interface Props {
  current: string
  onPick: (e: string) => void
  onClose: () => void
}

export function EmojiPicker({ current, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref}
      className="absolute bottom-full mb-2 left-0 z-50 p-3 rounded-2xl shadow-2xl"
      style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', width: '192px' }}>
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2 px-0.5">
        Pick your avatar
      </p>
      <div className="grid grid-cols-6 gap-1">
        {FOOD_EMOJIS.map(e => (
          <button key={e} onClick={() => { onPick(e); onClose() }}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-lg transition-all hover:scale-110"
            style={{
              background: current === e ? 'rgba(232,83,29,0.4)' : 'rgba(255,255,255,0.06)',
              outline: current === e ? '2px solid #E8531D' : 'none',
            }}
            title={e}>
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
