interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
  return (
    <div className={`${sizes[size]} border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin ${className}`} />
  )
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <img
        src="/logo.png"
        alt="CURRYiT"
        className="w-28 h-28 object-contain mb-6 animate-pulse"
        style={{ animationDuration: '1.5s' }}
      />
      <Spinner size="lg" className="mx-auto" />
    </div>
  )
}
