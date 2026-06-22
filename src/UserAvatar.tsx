import { INITIALS_MODE, getInitials } from './useUserAvatar'

interface Props {
  value: string          // emoji or INITIALS_MODE
  name: string | null | undefined
  size?: number          // px, default 32
  className?: string
}

// Renders either food emoji or 2-letter name initials
export function UserAvatar({ value, name, size = 32, className = '' }: Props) {
  const isInitials = value === INITIALS_MODE

  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 font-black text-white ${className}`}
      style={{
        width: size, height: size,
        borderRadius: Math.round(size * 0.35),
        background: 'linear-gradient(135deg,#E8531D,#C44010)',
        boxShadow: '0 3px 10px rgba(232,83,29,0.4)',
        fontSize: isInitials ? size * 0.38 : size * 0.55,
      }}>
      {isInitials ? getInitials(name) : value}
    </div>
  )
}
