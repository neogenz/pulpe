import { memo, useMemo } from 'react'
import type { ReactNode, CSSProperties } from 'react'

type FloatingCardVariant =
  | 'mini'
  | 'pill'
  | 'notification'
  | 'stat'
  | 'large'
  | 'highlight'
  | 'trend'

interface FloatingCardProps {
  variant: FloatingCardVariant
  children: ReactNode
  animationDelay?: number
  className?: string
}

const VARIANT_STYLES: Record<
  FloatingCardVariant,
  { base: string; colors: string; radius: string }
> = {
  mini: {
    base: 'px-3 py-2 text-xs font-medium flex items-center gap-2',
    colors: 'bg-surface text-text',
    radius: 'rounded-xl',
  },
  pill: {
    base: 'px-4 py-2 text-sm font-medium flex items-center gap-2',
    colors: 'bg-surface text-text',
    radius: 'rounded-full',
  },
  notification: {
    base: 'px-4 py-3 text-sm flex items-center gap-3',
    colors: 'bg-surface text-text',
    radius: 'rounded-2xl',
  },
  stat: {
    base: 'px-5 py-4 text-sm font-medium',
    colors: 'bg-surface text-text',
    radius: 'rounded-2xl',
  },
  large: {
    base: 'px-6 py-5 text-base font-semibold',
    colors: 'bg-surface text-text',
    radius: 'rounded-2xl',
  },
  highlight: {
    base: 'px-6 py-5 text-sm font-semibold',
    colors: 'bg-surface-alt text-primary',
    radius: 'rounded-2xl',
  },
  trend: {
    base: 'px-3 py-1.5 text-xs font-bold flex items-center gap-1.5',
    colors: 'bg-surface-alt text-primary',
    radius: 'rounded-full',
  },
}

export const FloatingCard = memo(function FloatingCard({
  variant,
  children,
  animationDelay = 0,
  className = '',
}: FloatingCardProps) {
  const style: CSSProperties = useMemo(
    () => (animationDelay ? { animationDelay: `${animationDelay}s` } : {}),
    [animationDelay]
  )

  const { base, colors, radius } = VARIANT_STYLES[variant]

  return (
    <div
      className={`
        float-bob
        ${radius}
        shadow-sm
        ${base}
        ${colors}
        ${className}
      `}
      style={style}
      aria-hidden="true"
    >
      {children}
    </div>
  )
})
