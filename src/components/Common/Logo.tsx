interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'full' | 'icon'
}

export function Logo({ size = 'md', variant = 'full' }: LogoProps) {
  const sizes = { sm: 28, md: 36, lg: 48 }
  const textSizes = { sm: 'text-base', md: 'text-xl', lg: 'text-2xl' }
  const s = sizes[size]

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex items-center justify-center rounded-xl font-bold text-white"
        style={{
          width: s,
          height: s,
          background: 'linear-gradient(135deg, #E8531D 0%, #C44010 100%)',
          fontSize: s * 0.45,
          flexShrink: 0,
        }}
      >
        C
      </div>
      {variant === 'full' && (
        <span className={`font-bold text-gray-900 ${textSizes[size]}`}>
          CURRY<span className="text-brand-500">iT</span>
        </span>
      )}
    </div>
  )
}
