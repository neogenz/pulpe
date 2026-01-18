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
  rotation?: number
  animationDelay?: number
  className?: string
}

const variantStyles: Record<
  FloatingCardVariant,
  { base: string; colors: string; radius: string }
> = {
  // Small icon + text badge (white bg)
  mini: {
    base: 'px-3 py-2 text-xs font-medium flex items-center gap-2',
    colors: 'bg-surface text-text',
    radius: 'rounded-xl',
  },
  // Rounded pill for categories (white bg)
  pill: {
    base: 'px-4 py-2 text-sm font-medium flex items-center gap-2',
    colors: 'bg-surface text-text',
    radius: 'rounded-full',
  },
  // Icon + message notification (white bg)
  notification: {
    base: 'px-4 py-3 text-sm flex items-center gap-3',
    colors: 'bg-surface text-text',
    radius: 'rounded-2xl',
  },
  // Medium stat display (white bg)
  stat: {
    base: 'px-5 py-4 text-sm font-medium',
    colors: 'bg-surface text-text',
    radius: 'rounded-2xl',
  },
  // Large prominent card (white bg, bigger)
  large: {
    base: 'px-6 py-5 text-base font-semibold',
    colors: 'bg-surface text-text',
    radius: 'rounded-2xl',
  },
  // Primary background highlight (focal point)
  highlight: {
    base: 'px-6 py-5 text-sm font-semibold',
    colors: 'bg-primary text-white',
    radius: 'rounded-2xl',
  },
  // Small primary badge for trends/percentages
  trend: {
    base: 'px-3 py-1.5 text-xs font-bold flex items-center gap-1.5',
    colors: 'bg-primary text-white',
    radius: 'rounded-full',
  },
}

export function FloatingCard({
  variant,
  children,
  rotation = 0,
  animationDelay = 0,
  className = '',
}: FloatingCardProps) {
  const style: CSSProperties = {
    '--rotation': `${rotation}deg`,
    animationDelay: animationDelay ? `${animationDelay}s` : undefined,
  } as CSSProperties

  const { base, colors, radius } = variantStyles[variant]

  return (
    <div
      className={`
        float-bob
        ${radius}
        shadow-[var(--shadow-floating)]
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
}
