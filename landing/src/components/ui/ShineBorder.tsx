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

/**
 * Animated shine border effect component.
 * Creates a rotating gradient border animation around its children.
 */
export function ShineBorder({
  borderRadius = 12,
  borderWidth = 2,
  duration = 8,
  color = 'var(--color-primary)',
  className,
  children,
}: ShineBorderProps) {
  const colorValue = Array.isArray(color) ? color.join(',') : color

  return (
    <div
      style={
        {
          '--shine-border-radius': `${borderRadius}px`,
          '--shine-border-width': `${borderWidth}px`,
          '--shine-duration': `${duration}s`,
          '--shine-gradient': `radial-gradient(transparent, transparent, ${colorValue}, transparent, transparent)`,
        } as CSSProperties
      }
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
}
