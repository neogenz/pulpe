interface GridBackgroundProps {
  className?: string
  gridOpacity?: number
}

export function GridBackground({
  className = '',
  gridOpacity = 0.06,
}: GridBackgroundProps) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      aria-hidden="true"
      style={{
        backgroundSize: 'var(--grid-size) var(--grid-size)',
        backgroundImage: `
          linear-gradient(to right, rgba(0, 110, 37, ${gridOpacity}) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0, 110, 37, ${gridOpacity}) 1px, transparent 1px)
        `,
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 100%)',
      }}
    />
  )
}
