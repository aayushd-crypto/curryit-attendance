interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'full' | 'icon'
}

export function Logo({ size = 'md', variant = 'full' }: LogoProps) {
  const heights = { sm: 28, md: 36, lg: 48 }
  const h = heights[size]

  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/logo.png"
        alt="CURRYiT"
        style={{ height: h, width: 'auto', objectFit: 'contain' }}
        className="flex-shrink-0"
      />
    </div>
  )
}
