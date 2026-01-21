import { memo, useMemo } from 'react'
import type { CSSProperties } from 'react'

interface GridBackgroundProps {
  className?: string
  gridOpacity?: number
}

const MASK_IMAGE =
  'radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 100%)'

export const GridBackground = memo(function GridBackground({
  className = '',
  gridOpacity = 0.06,
}: GridBackgroundProps) {
  const style: CSSProperties = useMemo(
    () => ({
      backgroundSize: 'var(--grid-size) var(--grid-size)',
      backgroundImage: `
        linear-gradient(to right, rgba(0, 110, 37, ${gridOpacity}) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(0, 110, 37, ${gridOpacity}) 1px, transparent 1px)
      `,
      maskImage: MASK_IMAGE,
      WebkitMaskImage: MASK_IMAGE,
    }),
    [gridOpacity]
  )

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      aria-hidden="true"
      style={style}
    />
  )
})
