interface GradientBlobProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASSES = {
  sm: 'w-48 h-48',
  md: 'w-72 h-72',
  lg: 'w-96 h-96',
}

export function GradientBlob({ className = '', size = 'md' }: GradientBlobProps) {
  return (
    <div
      className={`absolute rounded-full blur-3xl opacity-30 bg-gradient-to-br from-primary/20 to-primary/5 pointer-events-none ${SIZE_CLASSES[size]} ${className}`}
      aria-hidden="true"
    />
  )
}
