import { memo, useMemo } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { cn } from '../../lib/cn'

type ColorProp = string | string[]

interface ShineBorderProps {
  borderRadius?: number
  borderWidth?: number
  duration?: number
  color?: ColorProp
  className?: string
  children: ReactNode
}

export const ShineBorder = memo(function ShineBorder({
  borderRadius = 12,
  borderWidth = 2,
  duration = 8,
  color = 'var(--color-primary)',
  className,
  children,
}: ShineBorderProps) {
  const style = useMemo(() => {
    const colorValue = Array.isArray(color) ? color.join(',') : color
    return {
      '--shine-border-radius': `${borderRadius}px`,
      '--shine-border-width': `${borderWidth}px`,
      '--shine-duration': `${duration}s`,
      '--shine-gradient': `radial-gradient(transparent, transparent, ${colorValue}, transparent, transparent)`,
    } as CSSProperties
  }, [borderRadius, borderWidth, duration, color])

  return (
    <div
      style={style}
      className={cn(
        'shine-border-wrapper relative grid place-items-center rounded-[var(--shine-border-radius)]',
        className
      )}
    >
      <div
        className="shine-border-effect pointer-events-none absolute inset-0 rounded-[var(--shine-border-radius)]"
        aria-hidden="true"
      />
      {children}
    </div>
  )
})
